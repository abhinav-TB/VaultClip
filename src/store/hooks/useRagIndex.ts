import { useCallback, useEffect, useRef } from 'react'
import { buildRagChunks, retrieveRagChunks } from '../../lib/rag'
import { clearChunkEmbeddings, registerChunkEmbeddings, unregisterChunkEmbeddings } from '../../lib/ragEmbeddingRegistry'
import { workerClient } from '../../services/workerClient'
import type { GenerationSettings } from '../../types/generation'
import type { EmbedTextsResult } from '../../workers/types'
import { useAppDispatch, useAppSelector } from '../hooks'
import { clearRag, setLastRetrieval, setRagIndexError, setRagIndexProgress, setRagIndexReady, setRagIndexingStarted } from '../slices/ragSlice'

/**
 * Builds and queries the active media RAG index.
 *
 * Chunk metadata is stored in Redux; embedding vectors live in an in-memory
 * registry so large numeric arrays do not bloat app state.
 */
export function useRagIndex(settings: GenerationSettings) {
  const dispatch = useAppDispatch()
  const previousSessionRef = useRef<string | null>(null)
  const video = useAppSelector((state) => state.video)
  const transcript = useAppSelector((state) => state.context)
  const frames = useAppSelector((state) => state.frames)
  const rag = useAppSelector((state) => state.rag)
  const hasTranscript = transcript.transcriptSegments.length > 0 && transcript.transcriptStatus !== 'transcribing'
  const hasFrameSummaries = frames.summaries.length > 0 && frames.summaryStatus !== 'summarizing'

  useEffect(() => {
    const sessionId = video.sessionId
    if (previousSessionRef.current && previousSessionRef.current !== sessionId) {
      unregisterChunkEmbeddings(previousSessionRef.current)
    }
    previousSessionRef.current = sessionId

    if (!sessionId || video.status !== 'ready') {
      clearChunkEmbeddings()
      dispatch(clearRag())
      return
    }

    if (!hasTranscript && !hasFrameSummaries) {
      unregisterChunkEmbeddings(sessionId)
      dispatch(clearRag())
    }
  }, [dispatch, hasFrameSummaries, hasTranscript, video.sessionId, video.status])

  const buildIndex = useCallback(async () => {
    if (!video.sessionId || video.status !== 'ready') return

    const activeSessionId = video.sessionId
    if (!hasTranscript && !hasFrameSummaries) {
      dispatch(setRagIndexError({
        sessionId: activeSessionId,
        message: 'Run transcription or frame summarization before building a context index.',
      }))
      return
    }

    dispatch(setRagIndexingStarted({
      sessionId: activeSessionId,
      retrievalMode: settings.retrievalMode,
      embeddingModelId: settings.embeddingModelId,
    }))

    const chunks = buildRagChunks({
      sessionId: activeSessionId,
      transcriptSegments: hasTranscript ? transcript.transcriptSegments : [],
      frameSummaries: hasFrameSummaries ? frames.summaries : [],
    })

    if (!chunks.length) {
      dispatch(setRagIndexError({ sessionId: activeSessionId, message: 'No transcript or frame-summary chunks are available to index.' }))
      return
    }

    let partialDataWarning = null
    if (transcript.transcriptStatus === 'error' && frames.summaryStatus === 'error') {
      partialDataWarning = 'Note: Both transcription and frame summarization were interrupted. The index was built successfully with the available context.'
    } else if (transcript.transcriptStatus === 'error') {
      partialDataWarning = 'Note: Transcription was interrupted. The index was built successfully with the available spoken context.'
    } else if (frames.summaryStatus === 'error') {
      partialDataWarning = 'Note: Frame summarization was interrupted. The index was built successfully with the available visual context.'
    }

    if (settings.retrievalMode === 'lexical') {
      unregisterChunkEmbeddings(activeSessionId)
      dispatch(setRagIndexReady({
        sessionId: activeSessionId,
        chunks,
        embeddingStatus: 'unavailable',
        warning: partialDataWarning ? `Lexical-only retrieval is enabled. ${partialDataWarning}` : 'Lexical-only retrieval is enabled.',
      }))
      return
    }

    try {
      const result = await workerClient.runTask<EmbedTextsResult>('EMBED_TEXTS', {
        modelId: settings.embeddingModelId,
        texts: chunks.map((chunk) => chunk.text),
      }, (progress) => {
        dispatch(setRagIndexProgress({ progress, phase: progress < 55 ? 'Loading embedding model' : 'Embedding context chunks' }))
      }, (log) => {
        if (typeof log === 'string') {
          dispatch(setRagIndexProgress({ progress: 0, phase: log }))
        }
      })

      if (previousSessionRef.current !== activeSessionId) return

      registerChunkEmbeddings(activeSessionId, result.modelId, chunks.map((chunk, index) => ({
        chunkId: chunk.id,
        embedding: result.embeddings[index],
      })))
      dispatch(setRagIndexReady({
        sessionId: activeSessionId,
        chunks,
        embeddingStatus: 'ready',
        warning: partialDataWarning,
      }))
    } catch (err) {
      if (previousSessionRef.current !== activeSessionId) return

      unregisterChunkEmbeddings(activeSessionId)
      dispatch(setRagIndexReady({
        sessionId: activeSessionId,
        chunks,
        embeddingStatus: 'error',
        warning: `Embedding model failed to load. Using lexical retrieval only. ${err instanceof Error ? err.message : String(err)}`,
      }))
    }
  }, [
    dispatch,
    frames.summaries,
    frames.summaryStatus,
    hasFrameSummaries,
    hasTranscript,
    settings.embeddingModelId,
    settings.retrievalMode,
    transcript.transcriptSegments,
    transcript.transcriptStatus,
    video.sessionId,
    video.status,
  ])

  const retrieveContext = useCallback(async (query: string) => {
    if (rag.status !== 'ready' || !rag.chunks.length) return []

    let queryEmbedding: number[] | null = null
    const canUseEmbeddings = settings.retrievalMode === 'hybrid' && rag.embeddingStatus === 'ready'

    if (canUseEmbeddings) {
      try {
        const result = await workerClient.runTask<EmbedTextsResult>('EMBED_TEXTS', {
          modelId: settings.embeddingModelId,
          texts: [query],
        })
        queryEmbedding = result.embeddings[0] ?? null
      } catch {
        queryEmbedding = null
      }
    }

    const chunks = retrieveRagChunks({
      chunks: rag.chunks,
      query,
      retrievalMode: canUseEmbeddings && queryEmbedding ? 'hybrid' : 'lexical',
      sessionId: rag.sessionId,
      embeddingModelId: settings.embeddingModelId,
      queryEmbedding,
    })

    dispatch(setLastRetrieval({
      query,
      selectedChunkIds: chunks.map((chunk) => chunk.id),
      scores: chunks.map((chunk) => ({
        chunkId: chunk.id,
        lexicalScore: chunk.lexicalScore,
        semanticScore: chunk.semanticScore,
        combinedScore: chunk.combinedScore,
      })),
    }))

    return chunks
  }, [dispatch, rag.chunks, rag.embeddingStatus, rag.sessionId, rag.status, settings.embeddingModelId, settings.retrievalMode])

  return {
    buildIndex,
    canBuildIndex: Boolean(video.sessionId && video.status === 'ready' && (hasTranscript || hasFrameSummaries)),
    rag,
    retrieveContext,
  }
}
