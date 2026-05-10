import { FFmpeg } from '@ffmpeg/ffmpeg'
import { WorkerRequest } from './types'
import { sendResponse } from './workerMessages'
import ffmpegClassWorkerURL from '../../node_modules/@ffmpeg/ffmpeg/dist/esm/worker.js?url'
import ffmpegCoreURL from '../../node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.js?url'
import ffmpegWasmURL from '../../node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.wasm?url'

let ffmpeg: FFmpeg | null = null

export async function getFFmpeg(taskType: WorkerRequest['type']) {
  if (ffmpeg?.loaded) return ffmpeg

  ffmpeg = new FFmpeg()
  sendResponse({
    type: 'LOG',
    taskType,
    data: 'Loading ffmpeg',
  })
  sendResponse({
    type: 'PROGRESS',
    taskType,
    progress: 5,
  })

  await ffmpeg.load({
    classWorkerURL: ffmpegClassWorkerURL,
    coreURL: ffmpegCoreURL,
    wasmURL: ffmpegWasmURL,
  })

  sendResponse({
    type: 'PROGRESS',
    taskType,
    progress: 15,
  })

  return ffmpeg
}

export async function deleteFFmpegFile(activeFFmpeg: FFmpeg, path: string) {
  try {
    await activeFFmpeg.deleteFile(path)
  } catch {
    // Ignore cleanup misses; extraction may fail before a file exists.
  }
}
