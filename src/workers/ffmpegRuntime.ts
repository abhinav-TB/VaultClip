import { FFmpeg } from '@ffmpeg/ffmpeg'
import type { WorkerRequest } from './types'
import { sendResponse } from './workerMessages'
import ffmpegClassWorkerURL from '../../node_modules/@ffmpeg/ffmpeg/dist/esm/worker.js?url'
import ffmpegCoreURL from '../../node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.js?url'
import ffmpegWasmURL from '../../node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.wasm?url'

let ffmpeg: FFmpeg | null = null

/**
 * Loads and returns the shared ffmpeg.wasm instance for worker media tasks.
 *
 * ffmpeg.wasm is expensive to initialize, so extraction and transcription
 * decode tasks reuse one instance inside this worker.
 *
 * @param taskType - Worker task that should receive ffmpeg loading progress.
 * @returns The loaded shared ffmpeg instance.
 */
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

/**
 * Deletes a path from ffmpeg's virtual filesystem, ignoring missing files.
 *
 * @param activeFFmpeg - Loaded ffmpeg instance that owns the virtual filesystem.
 * @param path - Virtual filesystem path to remove.
 */
export async function deleteFFmpegFile(activeFFmpeg: FFmpeg, path: string) {
  try {
    await activeFFmpeg.deleteFile(path)
  } catch {
    // Ignore cleanup misses; extraction may fail before a file exists.
  }
}
