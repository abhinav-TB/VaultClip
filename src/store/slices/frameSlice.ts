import type { PayloadAction } from '@reduxjs/toolkit'
import { createSlice } from '@reduxjs/toolkit'

export type FrameSamplingStatus = 'idle' | 'sampling' | 'ready' | 'error'
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

interface FrameSettingsSnapshot {
  intervalSeconds: number
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
}

const initialState: FrameState = {
  status: 'idle',
  progress: 0,
  phase: null,
  error: null,
  sessionId: null,
  samples: [],
  settings: null,
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
    },
    clearFrames: () => initialState,
  },
})

export const { setFrameSamplingStarted, setFrameSamplingProgress, setFrameSamplingReady, setFrameSamplingError, clearFrames } =
  frameSlice.actions
export default frameSlice.reducer
