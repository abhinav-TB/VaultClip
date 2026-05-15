import { env, pipeline } from '@huggingface/transformers'
import type { EmbedTextsPayload, EmbedTextsResult } from './types'
import { sendResponse } from './workerMessages'

env.allowLocalModels = false
configureModelFileHost()

type FeatureExtractor = (texts: string | string[], options: { pooling: 'mean'; normalize: true }) => Promise<unknown>

const extractors = new Map<string, FeatureExtractor>()

/**
 * Creates local text embeddings for RAG indexing and query retrieval.
 *
 * @param payload - Embedding model ID and text batch to embed.
 */
export async function handleEmbedTexts(payload: EmbedTextsPayload) {
  const modelId = payload.modelId.trim()
  if (!modelId) {
    throw new Error('Embedding model ID is required.')
  }
  if (!payload.texts.length) {
    throw new Error('At least one text is required for embedding.')
  }

  sendResponse({
    type: 'LOG',
    taskType: 'EMBED_TEXTS',
    data: `Loading embedding model ${modelId}`,
  })
  sendResponse({
    type: 'PROGRESS',
    taskType: 'EMBED_TEXTS',
    progress: 10,
  })

  const extractor = await getExtractor(modelId)

  sendResponse({
    type: 'LOG',
    taskType: 'EMBED_TEXTS',
    data: `Embedding ${payload.texts.length} text chunk${payload.texts.length === 1 ? '' : 's'}`,
  })
  sendResponse({
    type: 'PROGRESS',
    taskType: 'EMBED_TEXTS',
    progress: 55,
  })

  const output = await extractor(payload.texts, { pooling: 'mean', normalize: true })
  const embeddings = readEmbeddings(output, payload.texts.length)

  sendResponse({
    type: 'PROGRESS',
    taskType: 'EMBED_TEXTS',
    progress: 100,
  })
  sendResponse({
    type: 'SUCCESS',
    taskType: 'EMBED_TEXTS',
    data: {
      modelId,
      dimensions: embeddings[0]?.length ?? 0,
      embeddings,
    } satisfies EmbedTextsResult,
  })
}

async function getExtractor(modelId: string) {
  const cached = extractors.get(modelId)
  if (cached) return cached

  const extractor = await pipeline('feature-extraction', modelId) as unknown as FeatureExtractor
  extractors.set(modelId, extractor)
  return extractor
}

function readEmbeddings(output: unknown, expectedRows: number) {
  const tensor = output as {
    data?: ArrayLike<number>
    dims?: number[]
    tolist?: () => unknown
  }

  if (typeof tensor.tolist === 'function') {
    return normalizeRows(tensor.tolist(), expectedRows)
  }

  if (tensor.data && tensor.dims && tensor.dims.length >= 2) {
    const rows = tensor.dims[0]
    const columns = tensor.dims[tensor.dims.length - 1]
    const embeddings: number[][] = []

    for (let row = 0; row < rows; row += 1) {
      const start = row * columns
      embeddings.push(Array.from(tensor.data).slice(start, start + columns))
    }

    return embeddings
  }

  return normalizeRows(output, expectedRows)
}

function normalizeRows(value: unknown, expectedRows: number): number[][] {
  if (!Array.isArray(value)) {
    throw new Error('Embedding model returned an unsupported output shape.')
  }

  if (expectedRows === 1 && value.every((item) => typeof item === 'number')) {
    return [value as number[]]
  }

  const rows = value as unknown[]
  const embeddings = rows.map((row) => {
    if (!Array.isArray(row)) {
      throw new Error('Embedding model returned a non-vector row.')
    }

    if (row.every((item) => typeof item === 'number')) {
      return row as number[]
    }

    const nested = row as unknown[]
    const firstVector = nested.find((item) => Array.isArray(item) && item.every((entry) => typeof entry === 'number'))
    if (Array.isArray(firstVector)) {
      return firstVector as number[]
    }

    throw new Error('Embedding model returned an unsupported nested vector shape.')
  })

  if (embeddings.length !== expectedRows) {
    throw new Error(`Embedding model returned ${embeddings.length} vectors for ${expectedRows} texts.`)
  }

  return embeddings
}

function configureModelFileHost() {
  if (self.location.hostname.endsWith('.workers.dev')) {
    env.remoteHost = self.location.origin
    env.remotePathTemplate = '/hf/{model}/resolve/{revision}/'
  }
}
