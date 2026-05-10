import { fetchFile } from '@ffmpeg/util'
import { ExtractAudioPayload } from './types'
import { deleteFFmpegFile, getFFmpeg } from './ffmpegRuntime'
import { sendResponse } from './workerMessages'

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
    await deleteFFmpegFile(activeFFmpeg, inputName)
    await deleteFFmpegFile(activeFFmpeg, outputName)
  }
}

function getSafeExtension(fileName: string) {
  const index = fileName.lastIndexOf('.')
  if (index < 0) return ''
  const extension = fileName.slice(index).toLowerCase().replace(/[^a-z0-9.]/g, '')
  return extension.length > 12 ? '' : extension
}
