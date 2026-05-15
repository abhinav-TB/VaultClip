import type { PayloadAction } from '@reduxjs/toolkit'
import { createSlice } from '@reduxjs/toolkit'

export type RagStatus = 'idle' | 'indexing' | 'ready' | 'error'
export type RetrievalMode = 'hybrid' | 'lexical'
export type EmbeddingStatus = 'idle' | 'loading' | 'ready' | 'unavailable' | 'error'
export type RagChunkSource = 'transcript' | 'frame-summary' | 'mixed'

export interface RagChunk {
  id: string
  sessionId: string
  source: RagChunkSource
  startTime: number
  endTime: number
  text: string
  tokensEstimate: number
  keywords: string[]
  sourceIds: string[]
}

export interface RagRetrievedChunk extends RagChunk {
  lexicalScore: number
  semanticScore: number | null
  combinedScore: number
}

interface RagSettingsSnapshot {
  retrievalMode: RetrievalMode
  embeddingModelId: string
}

interface RagState {
  status: RagStatus
  retrievalMode: RetrievalMode
  embeddingStatus: EmbeddingStatus
  embeddingModelId: string
  progress: number
  phase: string | null
  error: string | null
  warning: string | null
  startedAtMs: number | null
  completedAtMs: number | null
  sessionId: string | null
  chunks: RagChunk[]
  settingsSnapshot: RagSettingsSnapshot | null
  lastRetrieval: {
    query: string
    selectedChunkIds: string[]
    scores: Array<{
      chunkId: string
      lexicalScore: number
      semanticScore: number | null
      combinedScore: number
    }>
  } | null
}

const initialState: RagState = {
  status: 'idle',
  retrievalMode: 'hybrid',
  embeddingStatus: 'idle',
  embeddingModelId: 'onnx-community/all-MiniLM-L6-v2-ONNX',
  progress: 0,
  phase: null,
  error: null,
  warning: null,
  startedAtMs: null,
  completedAtMs: null,
  sessionId: null,
  chunks: [],
  settingsSnapshot: null,
  lastRetrieval: null,
}

export const ragSlice = createSlice({
  name: 'rag',
  initialState,
  reducers: {
    setRagIndexingStarted: (state, action: PayloadAction<{ sessionId: string; retrievalMode: RetrievalMode; embeddingModelId: string; startedAtMs: number }>) => {
      state.status = 'indexing'
      state.retrievalMode = action.payload.retrievalMode
      state.embeddingModelId = action.payload.embeddingModelId
      state.embeddingStatus = action.payload.retrievalMode === 'hybrid' ? 'loading' : 'unavailable'
      state.progress = 0
      state.phase = 'Preparing context chunks'
      state.error = null
      state.warning = null
      state.startedAtMs = action.payload.startedAtMs
      state.completedAtMs = null
      state.sessionId = action.payload.sessionId
      state.chunks = []
      state.settingsSnapshot = action.payload
      state.lastRetrieval = null
    },
    setRagIndexProgress: (state, action: PayloadAction<{ progress: number; phase?: string }>) => {
      state.progress = Math.max(state.progress, Math.max(0, Math.min(100, Math.round(action.payload.progress))))
      state.phase = action.payload.phase ?? state.phase
    },
    setRagIndexReady: (
      state,
      action: PayloadAction<{
        sessionId: string
        chunks: RagChunk[]
        embeddingStatus: EmbeddingStatus
        warning?: string | null
        completedAtMs: number
      }>,
    ) => {
      if (state.sessionId && state.sessionId !== action.payload.sessionId) return
      state.status = 'ready'
      state.progress = 100
      state.phase = 'Context index ready'
      state.error = null
      state.warning = action.payload.warning ?? null
      state.embeddingStatus = action.payload.embeddingStatus
      state.completedAtMs = action.payload.completedAtMs
      state.chunks = action.payload.chunks
    },
    setRagIndexError: (state, action: PayloadAction<{ sessionId?: string | null; message: string; completedAtMs?: number | null }>) => {
      state.status = 'error'
      state.progress = 0
      state.phase = null
      state.error = action.payload.message
      state.embeddingStatus = 'error'
      state.completedAtMs = action.payload.completedAtMs ?? null
      state.sessionId = action.payload.sessionId ?? state.sessionId
      state.chunks = []
    },
    setLastRetrieval: (state, action: PayloadAction<RagState['lastRetrieval']>) => {
      state.lastRetrieval = action.payload
    },
    clearRag: () => initialState,
  },
})

export const { clearRag, setLastRetrieval, setRagIndexError, setRagIndexProgress, setRagIndexReady, setRagIndexingStarted } = ragSlice.actions
export default ragSlice.reducer
