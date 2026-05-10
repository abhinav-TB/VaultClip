import type { PayloadAction } from '@reduxjs/toolkit'
import { createSlice } from '@reduxjs/toolkit'

export type FrameSamplingStatus = 'idle' | 'sampling' | 'ready' | 'error'
export type FrameSummaryStatus = 'idle' | 'summarizing' | 'ready' | 'error'
export type FrameImageFormat = 'jpeg' | 'webp'

/** Serializable metadata for one sampled video frame. */
export interface FrameSample {
  id: string
  index: number
  timestamp: number
  targetTimestamp: number
  objectUrl: string
  width: number
  height: number
  size: number
  mimeType: string
}

/** Gemma-generated visual description tied to one sampled frame. */
export interface FrameSummary {
  frameId: string
  index: number
  timestamp: number
  targetTimestamp: number
  summary: string
  source: 'gemma-frame-summary'
}

interface FrameSettingsSnapshot {
  samplingMode: 'interval' | 'count'
  intervalSeconds: number
  targetFrameCount: number
  maxSamples: number
  maxWidth: number
  imageFormat: FrameImageFormat
  imageQuality: number
}

/** Serializable state for sampled video frames. */
interface FrameState {
  status: FrameSamplingStatus
  progress: number
  phase: string | null
  error: string | null
  sessionId: string | null
  samples: FrameSample[]
  settings: FrameSettingsSnapshot | null
  summaryStatus: FrameSummaryStatus
  summaryProgress: number
  summaryPhase: string | null
  summaryError: string | null
  summaryWarnings: string[]
  summaries: FrameSummary[]
}

const initialState: FrameState = {
  status: 'idle',
  progress: 0,
  phase: null,
  error: null,
  sessionId: null,
  samples: [],
  settings: null,
  summaryStatus: 'idle',
  summaryProgress: 0,
  summaryPhase: null,
  summaryError: null,
  summaryWarnings: [],
  summaries: [],
}

interface FrameSamplingStartedPayload {
  sessionId: string
  settings: FrameSettingsSnapshot
}

interface FrameSamplingReadyPayload {
  sessionId: string
  samples: FrameSample[]
}

interface FrameSamplingErrorPayload {
  sessionId?: string | null
  message: string
}

interface FrameSummaryStartedPayload {
  sessionId: string
}

interface FrameSummaryReadyPayload {
  sessionId: string
  summaries: FrameSummary[]
  warnings: string[]
}

interface FrameSummaryErrorPayload {
  sessionId?: string | null
  message: string
}

export const frameSlice = createSlice({
  name: 'frames',
  initialState,
  reducers: {
    setFrameSamplingStarted: (state, action: PayloadAction<FrameSamplingStartedPayload>) => {
      state.status = 'sampling'
      state.progress = 0
      state.phase = 'Preparing video frames'
      state.error = null
      state.sessionId = action.payload.sessionId
      state.samples = []
      state.settings = action.payload.settings
      state.summaryStatus = 'idle'
      state.summaryProgress = 0
      state.summaryPhase = null
      state.summaryError = null
      state.summaryWarnings = []
      state.summaries = []
    },
    setFrameSamplingProgress: (state, action: PayloadAction<{ progress: number; phase?: string }>) => {
      state.progress = Math.max(state.progress, Math.max(0, Math.min(100, Math.round(action.payload.progress))))
      state.phase = action.payload.phase ?? state.phase
    },
    setFrameSamplingReady: (state, action: PayloadAction<FrameSamplingReadyPayload>) => {
      if (state.sessionId && state.sessionId !== action.payload.sessionId) return
      state.status = 'ready'
      state.progress = 100
      state.phase = 'Frames ready'
      state.error = null
      state.sessionId = action.payload.sessionId
      state.samples = action.payload.samples
    },
    setFrameSamplingError: (state, action: PayloadAction<FrameSamplingErrorPayload>) => {
      state.status = 'error'
      state.progress = 0
      state.phase = null
      state.error = action.payload.message
      state.sessionId = action.payload.sessionId ?? state.sessionId
      state.samples = []
      state.summaryStatus = 'idle'
      state.summaryProgress = 0
      state.summaryPhase = null
      state.summaryError = null
      state.summaryWarnings = []
      state.summaries = []
    },
    setFrameSummaryStarted: (state, action: PayloadAction<FrameSummaryStartedPayload>) => {
      if (state.sessionId && state.sessionId !== action.payload.sessionId) return
      state.summaryStatus = 'summarizing'
      state.summaryProgress = 0
      state.summaryPhase = 'Preparing frame summaries'
      state.summaryError = null
      state.summaryWarnings = []
      state.summaries = []
    },
    setFrameSummaryProgress: (state, action: PayloadAction<{ progress: number; phase?: string }>) => {
      state.summaryProgress = Math.max(state.summaryProgress, Math.max(0, Math.min(100, Math.round(action.payload.progress))))
      state.summaryPhase = action.payload.phase ?? state.summaryPhase
    },
    appendFrameSummary: (state, action: PayloadAction<{ sessionId: string; summary: FrameSummary }>) => {
      if (state.sessionId && state.sessionId !== action.payload.sessionId) return
      const existingIndex = state.summaries.findIndex((summary) => summary.frameId === action.payload.summary.frameId)
      if (existingIndex >= 0) {
        state.summaries[existingIndex] = action.payload.summary
      } else {
        state.summaries.push(action.payload.summary)
      }
      state.summaries.sort((a, b) => a.index - b.index)
    },
    setFrameSummaryReady: (state, action: PayloadAction<FrameSummaryReadyPayload>) => {
      if (state.sessionId && state.sessionId !== action.payload.sessionId) return
      state.summaryStatus = 'ready'
      state.summaryProgress = 100
      state.summaryPhase = 'Frame summaries ready'
      state.summaryError = null
      state.summaryWarnings = action.payload.warnings
      state.summaries = [...action.payload.summaries].sort((a, b) => a.index - b.index)
    },
    setFrameSummaryError: (state, action: PayloadAction<FrameSummaryErrorPayload>) => {
      state.summaryStatus = 'error'
      state.summaryProgress = 0
      state.summaryPhase = null
      state.summaryError = action.payload.message
      state.summaryWarnings = []
    },
    clearFrames: () => initialState,
  },
})

export const {
  appendFrameSummary,
  clearFrames,
  setFrameSamplingError,
  setFrameSamplingProgress,
  setFrameSamplingReady,
  setFrameSamplingStarted,
  setFrameSummaryError,
  setFrameSummaryProgress,
  setFrameSummaryReady,
  setFrameSummaryStarted,
} =
  frameSlice.actions
export default frameSlice.reducer
