import { AudioChunk, buildFixedTranscriptChunks } from './audioChunking'
import { deleteFFmpegFile, getFFmpeg } from './ffmpegRuntime'
import { GeneratorModelLike, getGenerator, ProcessorLike, TokenizerLike } from './gemmaRuntime'
import { estimateTokenCount, looksTruncated, normalizeTranscriptText, removeBoundaryDuplicates } from './transcriptNormalize'
import { TranscribePayload, TranscriptSegment, WorkerRequest } from './types'
import { sendResponse } from './workerMessages'

const DEFAULT_TRANSCRIPTION_MAX_NEW_TOKENS = 512
const UNLIMITED_TRANSCRIPTION_MAX_NEW_TOKENS = 4096
const DEFAULT_TRANSCRIPTION_CHUNK_SECONDS = 30
const DEFAULT_TRANSCRIPTION_OVERLAP_SECONDS = 0.1

export async function handleTranscribe(payload: TranscribePayload) {
  const taskType = 'TRANSCRIBE'

  try {
    sendResponse({
      type: 'LOG',
      taskType,
      data: 'Preparing transcription audio',
    })
    sendResponse({
      type: 'PROGRESS',
      taskType,
      progress: 2,
    })

    const { processor, model } = await getGenerator(taskType)
    const transcriptionSampleRate = getProcessorSampleRate(processor)
    const audio = await decodeAudioToFloat32(payload, taskType, transcriptionSampleRate)
    const chunkSeconds = getTranscriptChunkSeconds(payload.chunkSeconds)
    const overlapSeconds = getTranscriptOverlapSeconds(payload.overlapSeconds, chunkSeconds)
    const chunks = buildFixedTranscriptChunks(audio, transcriptionSampleRate, payload.duration, chunkSeconds, overlapSeconds)

    if (chunks.length === 0) {
      throw new Error('No usable audio was available for transcription.')
    }

    const rawOutputs: string[] = []
    const segments: TranscriptSegment[] = []

    for (let index = 0; index < chunks.length; index += 1) {
      const chunk = chunks[index]
      sendResponse({
        type: 'LOG',
        taskType,
        data: `Transcribing chunk ${index + 1} of ${chunks.length}`,
      })

      const chunkSegments = await transcribeChunkWithRetry({
        processor,
        model,
        tokenizer: (processor.tokenizer || processor) as unknown as TokenizerLike,
        audio,
        sampleRate: transcriptionSampleRate,
        sessionId: payload.sessionId,
        maxNewTokens: getTranscriptMaxNewTokens(payload.maxNewTokens),
        overlapSeconds,
        chunk,
        baseIndex: segments.length,
        rawOutputs,
      })

      segments.push(...chunkSegments)
      if (chunkSegments.length > 0) {
        sendResponse({
          type: 'PARTIAL',
          taskType,
          data: {
            sessionId: payload.sessionId,
            segments: chunkSegments,
            rawText: rawOutputs.slice(-chunkSegments.length).join('\n\n'),
          },
        })
      }
      sendResponse({
        type: 'PROGRESS',
        taskType,
        progress: Math.round(((index + 1) / chunks.length) * 100),
      })
    }

    const normalizedSegments = removeBoundaryDuplicates(segments).map((segment, index) => ({
      ...segment,
      index,
      id: `${payload.sessionId}-segment-${index}`,
    }))

    if (normalizedSegments.length === 0) {
      throw new Error('Gemma did not return usable transcript text.')
    }

    sendResponse({
      type: 'SUCCESS',
      taskType,
      data: {
        sessionId: payload.sessionId,
        segments: normalizedSegments,
        rawText: rawOutputs.join('\n\n'),
      },
    })
  } catch (err) {
    sendResponse({
      type: 'ERROR',
      taskType,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

async function decodeAudioToFloat32(payload: TranscribePayload, taskType: WorkerRequest['type'], sampleRate: number) {
  const activeFFmpeg = await getFFmpeg(taskType)
  const inputName = `transcribe-input-${payload.sessionId}${getAudioExtension(payload.mimeType)}`
  const outputName = `transcribe-f32-${payload.sessionId}.f32`

  try {
    await activeFFmpeg.writeFile(inputName, payload.bytes)
    const exitCode = await activeFFmpeg.exec([
      '-i',
      inputName,
      '-vn',
      '-ac',
      '1',
      '-ar',
      String(sampleRate),
      '-f',
      'f32le',
      outputName,
    ])

    if (exitCode !== 0) {
      throw new Error(`Audio decoding failed with ffmpeg exit code ${exitCode}.`)
    }

    const data = await activeFFmpeg.readFile(outputName)
    const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data
    const buffer = new ArrayBuffer(bytes.byteLength)
    new Uint8Array(buffer).set(bytes)
    return new Float32Array(buffer)
  } finally {
    await deleteFFmpegFile(activeFFmpeg, inputName)
    await deleteFFmpegFile(activeFFmpeg, outputName)
  }
}

interface TranscribeChunkArgs {
  processor: ProcessorLike
  model: GeneratorModelLike
  tokenizer: TokenizerLike
  audio: Float32Array
  sampleRate: number
  sessionId: string
  maxNewTokens: number
  overlapSeconds: number
  chunk: AudioChunk
  baseIndex: number
  rawOutputs: string[]
}

async function transcribeChunkWithRetry(args: TranscribeChunkArgs): Promise<TranscriptSegment[]> {
  const result = await transcribeSingleChunk(args, args.chunk, args.baseIndex)
  args.rawOutputs.push(result.rawText)

  if (!result.shouldRetry) {
    return result.segment ? [result.segment] : []
  }

  const midpoint = args.chunk.startTime + (args.chunk.endTime - args.chunk.startTime) / 2
  const subchunks = [
    { startTime: args.chunk.startTime, endTime: Math.min(args.chunk.endTime, midpoint + args.overlapSeconds) },
    { startTime: Math.max(args.chunk.startTime, midpoint - args.overlapSeconds), endTime: args.chunk.endTime },
  ].filter((chunk) => chunk.endTime - chunk.startTime >= 0.5)

  const segments: TranscriptSegment[] = []
  for (const subchunk of subchunks) {
    const subResult = await transcribeSingleChunk(args, subchunk, args.baseIndex + segments.length)
    args.rawOutputs.push(subResult.rawText)
    if (subResult.shouldRetry) {
      throw new Error(`Gemma could not produce usable transcript text for ${formatTimestamp(subchunk.startTime)}-${formatTimestamp(subchunk.endTime)}.`)
    }
    if (subResult.segment) {
      segments.push(subResult.segment)
    }
  }

  return segments
}

async function transcribeSingleChunk(args: TranscribeChunkArgs, chunk: AudioChunk, index: number) {
  const startSample = Math.max(0, Math.floor(chunk.startTime * args.sampleRate))
  const endSample = Math.min(args.audio.length, Math.ceil(chunk.endTime * args.sampleRate))
  const chunkAudio = args.audio.slice(startSample, endSample)
  const prompt = buildTranscriptionPrompt(args.processor)
  const templatedPrompt = args.processor.apply_chat_template([
    {
      role: 'user',
      content: prompt,
    },
  ], { tokenize: false, add_generation_prompt: true })
  const textPrompt = typeof templatedPrompt === 'string' ? templatedPrompt : templatedPrompt.toString()
  const inputs = await args.processor(textPrompt, null, chunkAudio)

  const outputTokens = await args.model.generate({
    ...inputs,
    max_new_tokens: args.maxNewTokens,
    repetition_penalty: 1.02,
    do_sample: false,
  })

  const decoded = args.tokenizer.decode(outputTokens[0], { skip_special_tokens: true })
  const text = normalizeTranscriptText(decoded)
  const hitTokenCap = estimateTokenCount(text) >= args.maxNewTokens * 0.92
  const shouldRetry = !text || hitTokenCap || looksTruncated(text)

  return {
    rawText: decoded,
    shouldRetry,
    segment: text
      ? {
          id: `${args.sessionId}-segment-${index}`,
          index,
          startTime: chunk.startTime,
          endTime: chunk.endTime,
          text,
          source: 'gemma-audio-chunk' as const,
        }
      : null,
  }
}

function buildTranscriptionPrompt(processor: ProcessorLike) {
  const audioToken = processor.audio_token ?? '<audio_soft_token>'
  return [
    audioToken,
    'Transcribe the spoken words in this audio exactly.',
    'Return only the transcript text.',
    'Do not summarize, translate, add timestamps, describe sounds, or add commentary.',
  ].join('\n')
}

function getProcessorSampleRate(processor: ProcessorLike) {
  const processorWithExtractor = processor as ProcessorLike & {
    feature_extractor?: {
      config?: {
        sampling_rate?: number
      }
    }
  }

  return processorWithExtractor.feature_extractor?.config?.sampling_rate ?? 16000
}

function getTranscriptMaxNewTokens(value: TranscribePayload['maxNewTokens']) {
  if (value === 'unlimited') return UNLIMITED_TRANSCRIPTION_MAX_NEW_TOKENS
  if (value === 1024 || value === 2048 || value === 512) return value
  return DEFAULT_TRANSCRIPTION_MAX_NEW_TOKENS
}

function getTranscriptChunkSeconds(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_TRANSCRIPTION_CHUNK_SECONDS
  return Math.max(10, Math.min(30, Math.round(value)))
}

function getTranscriptOverlapSeconds(value: number, chunkSeconds: number) {
  if (!Number.isFinite(value)) return DEFAULT_TRANSCRIPTION_OVERLAP_SECONDS
  return Math.max(0, Math.min(chunkSeconds - 0.1, Math.round(value * 10) / 10))
}

function getAudioExtension(mimeType: string) {
  if (mimeType.includes('flac')) return '.flac'
  if (mimeType.includes('mpeg')) return '.mp3'
  if (mimeType.includes('mp4') || mimeType.includes('aac')) return '.m4a'
  if (mimeType.includes('ogg') || mimeType.includes('opus')) return '.ogg'
  if (mimeType.includes('webm')) return '.webm'
  return '.wav'
}

function formatTimestamp(time: number) {
  const totalSeconds = Math.round(time)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}
