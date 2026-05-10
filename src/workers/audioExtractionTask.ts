import { fetchFile } from '@ffmpeg/util'
import type { ExtractAudioPayload } from './types'
import { deleteFFmpegFile, getFFmpeg } from './ffmpegRuntime'
import { sendResponse } from './workerMessages'

/**
 * Converts accepted video input into a transcription-ready mono audio artifact.
 *
 * The bytes are returned to the main thread; temporary ffmpeg FS files are not
 * persisted after this task completes.
 *
 * @param payload - Video session, source file, and requested audio settings.
 */
export async function handleExtractAudio(payload: ExtractAudioPayload) {
  const taskType = 'EXTRACT_AUDIO'
  const inputName = `input-${payload.sessionId}${getSafeExtension(payload.inputName) || '.video'}`
  const outputName = `audio-${payload.sessionId}.${payload.outputFormat}`
  const activeFFmpeg = await getFFmpeg(taskType)
  let progressHandler: ((event: { progress: number }) => void) | null = null
  let lastProgress = 15

  try {
    sendResponse({
      type: 'LOG',
      taskType,
      data: 'Extracting audio',
    })

    progressHandler = ({ progress }: { progress: number }) => {
      const normalizedProgress = progress > 1 ? progress / 100 : progress
      const visibleProgress = 15 + Math.round(Math.max(0, Math.min(1, normalizedProgress)) * 80)
      if (visibleProgress <= lastProgress) return
      lastProgress = visibleProgress
      sendResponse({
        type: 'PROGRESS',
        taskType,
        progress: visibleProgress,
      })
    }

    activeFFmpeg.on('progress', progressHandler)
    await activeFFmpeg.writeFile(inputName, await fetchFile(payload.file))

    // Keep the output conservative for transcription: no video stream, mono
    // channel layout, and user-selected sample rate/format.
    const codecArgs = payload.outputFormat === 'wav'
      ? ['-c:a', 'pcm_s16le']
      : ['-c:a', 'flac']

    const exitCode = await activeFFmpeg.exec([
      '-i',
      inputName,
      '-vn',
      '-ac',
      '1',
      '-ar',
      String(payload.sampleRate),
      ...codecArgs,
      outputName,
    ])

    if (exitCode !== 0) {
      throw new Error(`ffmpeg exited with code ${exitCode}.`)
    }

    sendResponse({
      type: 'LOG',
      taskType,
      data: 'Finalizing audio',
    })
    sendResponse({
      type: 'PROGRESS',
      taskType,
      progress: 96,
    })

    const data = await activeFFmpeg.readFile(outputName)
    const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data

    sendResponse({
      type: 'PROGRESS',
      taskType,
      progress: 100,
    })
    sendResponse({
      type: 'SUCCESS',
      taskType,
      data: {
        sessionId: payload.sessionId,
        bytes,
        mimeType: payload.outputFormat === 'wav' ? 'audio/wav' : 'audio/flac',
        fileName: outputName,
        size: bytes.byteLength,
        format: payload.outputFormat,
        sampleRate: payload.sampleRate,
        channels: 1,
      },
    })
  } catch (err) {
    sendResponse({
      type: 'ERROR',
      taskType,
      error: err instanceof Error ? err.message : String(err),
    })
  } finally {
    if (progressHandler) {
      activeFFmpeg.off('progress', progressHandler)
    }
    // ffmpeg.wasm has an in-memory virtual filesystem. Clean both paths even
    // after failures so retries do not reuse stale artifacts.
    await deleteFFmpegFile(activeFFmpeg, inputName)
    await deleteFFmpegFile(activeFFmpeg, outputName)
  }
}

function getSafeExtension(fileName: string) {
  // The extension is used only for ffmpeg input naming. Strip unexpected
  // characters to avoid odd virtual filesystem paths.
  const index = fileName.lastIndexOf('.')
  if (index < 0) return ''
  const extension = fileName.slice(index).toLowerCase().replace(/[^a-z0-9.]/g, '')
  return extension.length > 12 ? '' : extension
}
