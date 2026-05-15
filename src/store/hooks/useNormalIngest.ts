import { useCallback, useState, type RefObject } from 'react'
import { clearAudio, setAudioError, setAudioExtracting, setAudioProgress, setAudioReady } from '../slices/audioSlice'
import { appendTranscriptSegments, clearContext, setTranscriptError, setTranscriptPhase, setTranscriptProgress, setTranscriptResult, setTranscriptTranscribing, type TranscriptSegment } from '../slices/contextSlice'
import { appendFrameSummary, setFrameSamplingError, setFrameSamplingProgress, setFrameSamplingStarted, setFrameSummaryError, setFrameSummaryProgress, setFrameSummaryReady, setFrameSummaryStarted, type FrameSummary } from '../slices/frameSlice'
import { setProcessingError, setProcessingProgress, setProcessingStatus } from '../slices/processingSlice'
import { setRagIndexError, setRagIndexProgress, setRagIndexReady, setRagIndexingStarted } from '../slices/ragSlice'
import { useAppDispatch, useAppSelector } from '../hooks'
import { clearAudioData, getAudioData, registerAudioData } from '../../lib/audioDataRegistry'
import { getFrameData } from '../../lib/frameDataRegistry'
import { sampleVideoFrames, type SampledFrameBlob } from '../../lib/frameSampler'
import { buildRagChunks } from '../../lib/rag'
import { registerChunkEmbeddings, unregisterChunkEmbeddings } from '../../lib/ragEmbeddingRegistry'
import { buildTimeSegments } from '../../lib/segmentation'
import { getVideoFile } from '../../lib/videoFileRegistry'
import type { GenerationSettings } from '../../types/generation'
import { workerClient } from '../../services/workerClient'
import type { EmbedTextsResult, ExtractAudioResult, ProcessFramesPartialResult, ProcessFramesResult, TranscribePartialResult, TranscribeResult } from '../../workers/types'

interface NormalIngestState {
  running: boolean
  phase: string
  progress: number
  error: string | null
}

export function useNormalIngest(
  settings: GenerationSettings,
  activeSessionRef: RefObject<string | null>,
  onAudioObjectUrl?: (objectUrl: string) => void,
  clearFrameArtifacts?: () => void,
  registerSampledFrames?: (sessionId: string, sampledFrames: SampledFrameBlob[]) => unknown,
  audioOnlyIndex = false,
) {
  const dispatch = useAppDispatch()
  const video = useAppSelector((state) => state.video)
  const audio = useAppSelector((state) => state.audio)
  const transcript = useAppSelector((state) => state.context)
  const [state, setState] = useState<NormalIngestState>({
    running: false,
    phase: '',
    progress: 0,
    error: null,
  })

  const publish = useCallback((phase: string, progress: number) => {
    setState((current) => ({ ...current, phase, progress }))
  }, [])

  const buildIndex = useCallback(async () => {
    if (!video.sessionId || video.status !== 'ready' || state.running) return

    const sessionId = video.sessionId
    setState({ running: true, phase: 'Preparing media', progress: 0, error: null })

    try {
      let audioBytes = getAudioData(sessionId)
      if (video.mediaKind === 'video' && !audioBytes) {
        const file = getVideoFile(sessionId)
        if (!file) {
          throw new Error('The selected video file is no longer available in browser memory. Replace the video and try again.')
        }

        publish('Preparing audio', 8)
        clearAudioData()
        dispatch(clearAudio())
        dispatch(clearContext())
        dispatch(setAudioExtracting({
          sessionId,
          format: settings.audioFormat,
          sampleRate: settings.audioSampleRate,
          duration: video.duration,
        }))
        dispatch(setProcessingStatus('extracting-audio'))
        dispatch(setProcessingProgress(0))
        dispatch(setProcessingError(''))

        const result = await workerClient.runTask<ExtractAudioResult>('EXTRACT_AUDIO', {
          sessionId,
          file,
          inputName: video.name ?? file.name,
          outputFormat: settings.audioFormat,
          sampleRate: settings.audioSampleRate,
        }, (progress) => {
          const rounded = Math.round(progress)
          dispatch(setAudioProgress({
            progress,
            phase: progress < 15 ? 'Loading ffmpeg' : progress < 96 ? 'Extracting audio' : 'Finalizing audio',
          }))
          dispatch(setProcessingProgress(progress))
          publish('Preparing audio', Math.min(35, 8 + Math.round(rounded * 0.27)))
        }, (log) => {
          if (typeof log === 'string') {
            dispatch(setAudioProgress({ progress: audio.progress, phase: log }))
          }
        })

        if (activeSessionRef.current !== result.sessionId) return

        const audioBytesForBlob: Uint8Array<ArrayBuffer> = new Uint8Array(result.bytes.byteLength)
        audioBytesForBlob.set(result.bytes)
        const objectUrl = URL.createObjectURL(new Blob([audioBytesForBlob.buffer], { type: result.mimeType }))
        onAudioObjectUrl?.(objectUrl)
        registerAudioData(result.sessionId, {
          bytes: result.bytes,
          mimeType: result.mimeType,
          sampleRate: result.sampleRate,
          duration: video.duration,
        })
        audioBytes = getAudioData(result.sessionId)
        dispatch(setAudioReady({
          sessionId: result.sessionId,
          objectUrl,
          format: result.format,
          sampleRate: result.sampleRate,
          channels: result.channels,
          duration: video.duration,
          size: result.size,
          fileName: result.fileName,
          mimeType: result.mimeType,
        }))
      }

      if (!audioBytes) {
        throw new Error('Audio is not available for transcription. Replace the file and try again.')
      }

      let segments: TranscriptSegment[] = transcript.transcriptSegments
      if (!segments.length) {
        publish('Transcribing media', 36)
        dispatch(setTranscriptTranscribing())
        dispatch(setProcessingStatus('transcribing'))
        dispatch(setProcessingProgress(0))
        dispatch(setProcessingError(''))

        const result = await workerClient.runTask<TranscribeResult>('TRANSCRIBE', {
          sessionId,
          bytes: audioBytes.bytes,
          mimeType: audioBytes.mimeType,
          sampleRate: audioBytes.sampleRate,
          duration: audioBytes.duration,
          maxNewTokens: settings.transcriptMaxNewTokens,
          chunkSeconds: settings.transcriptChunkSeconds,
          overlapSeconds: settings.transcriptOverlapSeconds,
        }, (progress) => {
          dispatch(setTranscriptProgress(progress))
          dispatch(setProcessingProgress(progress))
          publish('Transcribing media', Math.min(72, 36 + Math.round(progress * 0.36)))
        }, (log) => {
          if (typeof log === 'string') {
            dispatch(setTranscriptPhase(log))
          }
        }, (partial) => {
          const partialResult = partial as TranscribePartialResult
          if (partialResult.sessionId === sessionId) {
            dispatch(appendTranscriptSegments({
              segments: partialResult.segments,
              rawText: partialResult.rawText,
            }))
          }
        })

        if (activeSessionRef.current !== result.sessionId) return
        segments = result.segments
        dispatch(setTranscriptResult({
          segments,
          rawText: result.rawText,
          warnings: result.warnings,
        }))
      }

      if (!segments.length) {
        throw new Error('No transcript segments were created. Try a different file, or switch to Power User mode for troubleshooting details.')
      }

      let frameSummaries: FrameSummary[] = []
      if (video.mediaKind === 'video' && !audioOnlyIndex) {
        publish('Sampling visual context', 58)
        clearFrameArtifacts?.()
        dispatch(setFrameSamplingStarted({
          sessionId,
          settings: {
            samplingMode: settings.frameSamplingMode,
            intervalSeconds: settings.frameIntervalSeconds,
            targetFrameCount: settings.targetFrameCount,
            maxSamples: settings.maxFrameSamples,
            maxWidth: settings.frameMaxWidth,
            imageFormat: settings.frameImageFormat,
            imageQuality: settings.frameImageQuality,
          },
        }))
        dispatch(setProcessingStatus('sampling'))
        dispatch(setProcessingProgress(0))
        dispatch(setProcessingError(''))

        try {
          const sampledFrames = await sampleVideoFrames({
            fileUrl: video.fileUrl!,
            duration: video.duration ?? 0,
            settings,
            onProgress: (progress, phase) => {
              dispatch(setFrameSamplingProgress({ progress, phase }))
              dispatch(setProcessingProgress(progress))
              publish('Sampling visual context', Math.min(74, 58 + Math.round(progress * 0.16)))
            },
          })
          if (!registerSampledFrames) {
            throw new Error('Frame sample registration is not available in this view.')
          }
          registerSampledFrames(sessionId, sampledFrames)
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Frame sampling failed.'
          dispatch(setFrameSamplingError({ sessionId, message }))
          throw new Error(message)
        }

        const frameData = getFrameData(sessionId)
        if (!frameData.length) {
          throw new Error('Frame samples were not available after sampling completed.')
        }

        publish('Summarizing visual context', 75)
        dispatch(setFrameSummaryStarted({ sessionId }))
        dispatch(setProcessingStatus('summarizing'))
        dispatch(setProcessingProgress(0))
        dispatch(setProcessingError(''))

        try {
          const frameDataById = new Map(frameData)
          const frameInputs = await Promise.all(frameData.map(([id], index) => ({
            id,
            index,
            timestamp: frameDataById.get(id)?.timestamp ?? 0,
            targetTimestamp: frameDataById.get(id)?.targetTimestamp ?? 0,
            mimeType: frameDataById.get(id)?.mimeType ?? 'image/jpeg',
          })).map(async (sample) => {
            const data = frameDataById.get(sample.id)
            if (!data) return null
            return {
              id: sample.id,
              index: sample.index,
              timestamp: sample.timestamp,
              targetTimestamp: sample.targetTimestamp,
              mimeType: sample.mimeType,
              dataUrl: await blobToDataUrl(data.blob),
            }
          }))
          const availableFrames = frameInputs.filter((frame): frame is NonNullable<typeof frame> => Boolean(frame))
          const segmentBounds = buildTimeSegments(video.duration ?? 0, settings.transcriptChunkSeconds, settings.transcriptOverlapSeconds).map((segment, index) => ({
            id: `${sessionId}-segment-${index}`,
            startTime: segment.startTime,
            endTime: segment.endTime,
          }))

          const result = await workerClient.runTask<ProcessFramesResult>('PROCESS_FRAMES', {
            sessionId,
            frames: availableFrames,
            segmentBounds,
          }, (progress) => {
            dispatch(setFrameSummaryProgress({ progress }))
            dispatch(setProcessingProgress(progress))
            publish('Summarizing visual context', Math.min(88, 75 + Math.round(progress * 0.13)))
          }, (log) => {
            if (typeof log === 'string') {
              dispatch(setFrameSummaryProgress({ progress: 0, phase: log }))
            }
          }, (partial) => {
            const partialResult = partial as ProcessFramesPartialResult
            if (partialResult.sessionId === sessionId) {
              dispatch(appendFrameSummary({
                sessionId: partialResult.sessionId,
                summary: partialResult.summary,
              }))
            }
          })

          if (!result.summaries.length) {
            throw new Error('Frame summarization completed without producing any summaries.')
          }

          frameSummaries = result.summaries
          dispatch(setFrameSummaryReady({
            sessionId,
            summaries: result.summaries,
            warnings: result.warnings,
          }))
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Frame summarization failed.'
          dispatch(setFrameSummaryError({ sessionId, message }))
          throw new Error(message)
        }
      }

      publish('Building searchable context', 89)
      dispatch(setRagIndexingStarted({
        sessionId,
        retrievalMode: settings.retrievalMode,
        embeddingModelId: settings.embeddingModelId,
        startedAtMs: Date.now(),
      }))

      const chunks = buildRagChunks({
        sessionId,
        transcriptSegments: segments,
        frameSummaries,
      })

      if (settings.retrievalMode === 'lexical') {
        unregisterChunkEmbeddings(sessionId)
        dispatch(setRagIndexReady({
          sessionId,
          chunks,
          embeddingStatus: 'unavailable',
          warning: 'Lexical-only retrieval is enabled.',
          completedAtMs: Date.now(),
        }))
      } else {
        const result = await workerClient.runTask<EmbedTextsResult>('EMBED_TEXTS', {
          modelId: settings.embeddingModelId,
          texts: chunks.map((chunk) => chunk.text),
        }, (progress) => {
          dispatch(setRagIndexProgress({ progress, phase: progress < 55 ? 'Loading embedding model' : 'Embedding context chunks' }))
          publish('Building searchable context', Math.min(98, 74 + Math.round(progress * 0.24)))
        }, (log) => {
          if (typeof log === 'string') {
            dispatch(setRagIndexProgress({ progress: 0, phase: log }))
          }
        })

        registerChunkEmbeddings(sessionId, result.modelId, chunks.map((chunk, index) => ({
          chunkId: chunk.id,
          embedding: result.embeddings[index],
        })))
        dispatch(setRagIndexReady({
          sessionId,
          chunks,
          embeddingStatus: 'ready',
          warning: null,
          completedAtMs: Date.now(),
        }))
      }

      dispatch(setProcessingStatus('complete'))
      dispatch(setProcessingProgress(100))
      dispatch(setProcessingError(''))
      setState({ running: false, phase: 'Context ready', progress: 100, error: null })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Index build failed.'
      dispatch(setAudioError({ sessionId, message }))
      dispatch(setTranscriptError(message))
      dispatch(setRagIndexError({ sessionId, message, completedAtMs: Date.now() }))
      dispatch(setProcessingError(message))
      dispatch(setProcessingStatus('idle'))
      setState({ running: false, phase: 'Build failed', progress: 0, error: message })
    }
  }, [
    activeSessionRef,
    audio.progress,
    audioOnlyIndex,
    dispatch,
    publish,
    settings,
    state.running,
    transcript.transcriptSegments,
    onAudioObjectUrl,
    clearFrameArtifacts,
    registerSampledFrames,
    video.duration,
    video.fileUrl,
    video.mediaKind,
    video.name,
    video.sessionId,
    video.status,
  ])

  return {
    buildIndex,
    ...state,
  }
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
      } else {
        reject(new Error('Could not convert frame image to a data URL.'))
      }
    }
    reader.onerror = () => reject(new Error('Could not read sampled frame image from browser memory.'))
    reader.readAsDataURL(blob)
  })
}
