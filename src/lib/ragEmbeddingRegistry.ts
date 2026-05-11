const embeddingData = new Map<string, Map<string, number[]>>()

/** Stores chunk embeddings outside Redux to avoid large serializable payloads. */
export function registerChunkEmbeddings(sessionId: string, modelId: string, vectors: Array<{ chunkId: string; embedding: number[] }>) {
  const key = getRegistryKey(sessionId, modelId)
  embeddingData.set(key, new Map(vectors.map((vector) => [vector.chunkId, vector.embedding])))
}

/** Returns the embedding vector for one indexed chunk. */
export function getChunkEmbedding(sessionId: string | null, modelId: string, chunkId: string) {
  if (!sessionId) return null
  return embeddingData.get(getRegistryKey(sessionId, modelId))?.get(chunkId) ?? null
}

/** Removes all embeddings for one active media session. */
export function unregisterChunkEmbeddings(sessionId: string | null) {
  if (!sessionId) return
  for (const key of embeddingData.keys()) {
    if (key.startsWith(`${sessionId}:`)) {
      embeddingData.delete(key)
    }
  }
}

/** Clears every in-memory embedding vector. */
export function clearChunkEmbeddings() {
  embeddingData.clear()
}

function getRegistryKey(sessionId: string, modelId: string) {
  return `${sessionId}:${modelId}`
}
