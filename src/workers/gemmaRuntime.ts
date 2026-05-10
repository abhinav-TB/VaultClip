import type { RawImage } from '@huggingface/transformers';
import { AutoProcessor, env, Gemma4ForConditionalGeneration } from '@huggingface/transformers'
import type { ModelLoadEvent, ModelLoadSource, WorkerRequest } from './types'
import { sendModelLoadEvent, sendResponse } from './workerMessages'

env.allowLocalModels = false

const GEMMA_MODEL_ID = 'onnx-community/gemma-4-E2B-it-ONNX'
const GEMMA_REVISION = 'main'
const MODEL_FILE_SOURCE = new Map<string, ModelLoadSource>()

/** Message shape accepted by Gemma chat template processing. */
export type MessageContent =
  | string
  | Array<{ type: 'image'; url: string } | { type: 'text'; text: string }>

/** Minimal chat message contract used by Gemma worker tasks. */
export interface ChatMessage {
  role: 'user'
  content: MessageContent
}

/** Tokenizer surface used by chat and transcription decoding. */
export interface TokenizerLike {
  decode: (tokens: unknown, options: { skip_special_tokens: boolean }) => string
}

/** Processor surface used for chat templates and multimodal tensor creation. */
export interface ProcessorLike {
  tokenizer?: TokenizerLike
  audio_token?: string
  apply_chat_template: (
    messages: ChatMessage[],
    options: { tokenize: false; add_generation_prompt: true },
  ) => string | { toString: () => string }
  (
    text: string,
    images: RawImage[] | null,
    audios: Float32Array | null,
  ): Promise<Record<string, unknown>>
}

/** Generation model surface used by this worker. */
export interface GeneratorModelLike {
  generate: (inputs: Record<string, unknown>) => Promise<unknown[]>
}

let gProcessor: ProcessorLike | null = null
let gModel: GeneratorModelLike | null = null

/**
 * Loads Gemma on first use and returns the cached processor/model pair.
 *
 * Later chat and transcription calls reuse these objects from worker memory
 * instead of re-downloading or reinitializing the model.
 *
 * @param taskType - Worker task that should receive loading progress events.
 * @returns The loaded Gemma processor and generation model.
 * @throws If WebGPU is unavailable or Gemma cannot be loaded.
 */
export async function getGenerator(taskType: WorkerRequest['type'] = 'CHALLENGE_RESPONSE') {
  if (!('gpu' in navigator)) {
    throw new Error('WebGPU is not supported in this browser. Please use Chrome/Edge and ensure hardware acceleration is enabled.')
  }

  if (!gModel) {
    sendResponse({
      type: 'PROGRESS',
      taskType,
      progress: 10,
    })
    sendResponse({
      type: 'LOG',
      taskType,
      data: {
        stage: 'checking-cache',
        source: 'unknown',
        message: 'WebGPU is available. Checking browser cache for Gemma processor files.',
      } satisfies ModelLoadEvent,
    })

    gProcessor = await AutoProcessor.from_pretrained(GEMMA_MODEL_ID, {
      revision: GEMMA_REVISION,
      progress_callback: (progress: unknown) => {
        describeModelProgress(taskType, progress)
      },
    }) as unknown as ProcessorLike

    sendResponse({
      type: 'PROGRESS',
      taskType,
      progress: 35,
    })
    sendResponse({
      type: 'LOG',
      taskType,
      data: {
        stage: 'initializing',
        source: 'memory',
        message: 'Processor is ready. Loading Gemma model weights into WebGPU memory.',
      } satisfies ModelLoadEvent,
    })

    gModel = await Gemma4ForConditionalGeneration.from_pretrained(GEMMA_MODEL_ID, {
      revision: GEMMA_REVISION,
      device: 'webgpu',
      dtype: 'q4f16',
      progress_callback: (progress: unknown) => {
        describeModelProgress(taskType, progress)

        if (!progress || typeof progress !== 'object') return

        const progressInfo = progress as { progress?: number; loaded?: number; total?: number }
        if (typeof progressInfo.progress === 'number') {
          const normalizedProgress = progressInfo.progress > 1 ? progressInfo.progress / 100 : progressInfo.progress
          sendResponse({
            type: 'PROGRESS',
            taskType,
            progress: 35 + Math.round(normalizedProgress * 60),
          })
        } else if (progressInfo.loaded && progressInfo.total) {
          sendResponse({
            type: 'PROGRESS',
            taskType,
            progress: 35 + Math.round((progressInfo.loaded / progressInfo.total) * 60),
          })
        }
      },
    }) as unknown as GeneratorModelLike
  }

  if (!gProcessor || !gModel) {
    throw new Error('Failed to load Gemma model.')
  }

  sendModelLoadEvent(taskType, {
    stage: 'ready',
    source: 'memory',
    message: 'Gemma is loaded in the worker and ready for local inference.',
  })

  return { processor: gProcessor, model: gModel }
}

/**
 * Handles the explicit model preload request from the main thread.
 *
 * Posts worker progress, success, or error messages instead of returning model
 * objects to the caller.
 */
export async function handleInitModels() {
  try {
    await getGenerator('INIT_MODELS')

    sendResponse({
      type: 'PROGRESS',
      taskType: 'INIT_MODELS',
      progress: 100,
    })
    sendResponse({
      type: 'SUCCESS',
      taskType: 'INIT_MODELS',
      data: {
        ready: true,
      },
    })
  } catch (err) {
    sendResponse({
      type: 'ERROR',
      taskType: 'INIT_MODELS',
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

/**
 * Returns Chrome JS heap usage for debug metadata when available.
 *
 * This is not total system RAM and does not include GPU memory.
 *
 * @returns Formatted heap usage values, or `"Not supported"` outside Chrome.
 */
export function getMemoryUsage() {
  // Chrome exposes JS heap information here. It is not total system RAM and it
  // does not include GPU memory, so callers should treat it as debug-only.
  const memory = (performance as Performance & {
    memory?: {
      usedJSHeapSize: number
      totalJSHeapSize: number
      jsHeapSizeLimit: number
    }
  }).memory

  if (memory) {
    return {
      used: `${(memory.usedJSHeapSize / (1024 * 1024)).toFixed(2)} MB`,
      total: `${(memory.totalJSHeapSize / (1024 * 1024)).toFixed(2)} MB`,
      limit: `${(memory.jsHeapSizeLimit / (1024 * 1024)).toFixed(2)} MB`,
    }
  }

  return 'Not supported'
}

function describeModelProgress(taskType: WorkerRequest['type'], progress: unknown) {
  if (!progress || typeof progress !== 'object') return

  const progressInfo = progress as {
    status?: string
    file?: string
    progress?: number
    loaded?: number
    total?: number
  }
  const file = progressInfo.file

  if (progressInfo.status === 'download' && file) {
    // Transformers.js uses the same callback status for cached and network
    // loads, so we check Cache Storage ourselves to show the user the source.
    sendModelLoadEvent(taskType, {
      stage: 'checking-cache',
      source: 'unknown',
      file,
      message: `Checking browser cache for ${file}.`,
    })

    void getBrowserCacheSource(file).then((source) => {
      MODEL_FILE_SOURCE.set(file, source)
      sendModelLoadEvent(taskType, {
        stage: source === 'cache' ? 'loading-cache' : 'downloading',
        source,
        file,
        message:
          source === 'cache'
            ? `Found ${file} in browser cache. Reading it locally.`
            : source === 'network'
              ? `${file} is not cached. Downloading it from Hugging Face.`
              : `Preparing ${file}; cache availability could not be confirmed.`,
      })
    })
    return
  }

  if (progressInfo.status === 'progress' && file) {
    const source = MODEL_FILE_SOURCE.get(file) ?? 'unknown'
    const loaded = progressInfo.loaded
    const total = progressInfo.total
    const sizeText = loaded && total ? `${formatBytes(loaded)} of ${formatBytes(total)}` : null

    sendModelLoadEvent(taskType, {
      stage: source === 'cache' ? 'loading-cache' : source === 'network' ? 'downloading' : 'checking-cache',
      source,
      file,
      loaded,
      total,
      message:
        source === 'cache'
          ? `Loading ${file} from browser cache${sizeText ? ` (${sizeText})` : ''}.`
          : source === 'network'
            ? `Downloading ${file} from Hugging Face${sizeText ? ` (${sizeText})` : ''}.`
            : `Loading ${file}${sizeText ? ` (${sizeText})` : ''}.`,
    })
    return
  }

  if (progressInfo.status === 'done' && file) {
    const source = MODEL_FILE_SOURCE.get(file) ?? 'unknown'

    sendModelLoadEvent(taskType, {
      stage: source === 'cache' ? 'loading-cache' : source === 'network' ? 'downloading' : 'checking-cache',
      source,
      file,
      message:
        source === 'cache'
          ? `Finished reading ${file} from browser cache.`
          : source === 'network'
            ? `Finished downloading and caching ${file}.`
            : `Finished loading ${file}.`,
    })
  }
}

function getModelCacheUrl(file: string) {
  return `${env.remoteHost}${env.remotePathTemplate
    .replace('{model}', GEMMA_MODEL_ID)
    .replace('{revision}', encodeURIComponent(GEMMA_REVISION))}${file}`
}

async function getBrowserCacheSource(file: string): Promise<ModelLoadSource> {
  if (!('caches' in self)) return 'unknown'

  try {
    const cache = await caches.open(env.cacheKey)
    const cached = await cache.match(getModelCacheUrl(file))
    return cached ? 'cache' : 'network'
  } catch {
    return 'unknown'
  }
}

function formatBytes(bytes?: number) {
  if (!bytes) return null
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unit = 0

  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }

  return `${value >= 10 || unit === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unit]}`
}
