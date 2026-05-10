import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export type VideoStatus = 'idle' | 'loading-metadata' | 'ready' | 'error'
export type MediaKind = 'video' | 'audio'

interface VideoState {
  mediaKind: MediaKind | null
  sessionId: string | null
  fileUrl: string | null
  name: string | null
  size: number | null
  type: string | null
  duration: number | null
  lastModified: number | null
  status: VideoStatus
  error: string | null
  warnings: string[]
  rejectionReason: string | null
}

const initialState: VideoState = {
  mediaKind: null,
  sessionId: null,
  fileUrl: null,
  name: null,
  size: null,
  type: null,
  duration: null,
  lastModified: null,
  status: 'idle',
  error: null,
  warnings: [],
  rejectionReason: null,
}

interface VideoLoadingPayload {
  mediaKind: MediaKind
  sessionId: string
  fileUrl: string
  name: string
  size: number
  type: string
  lastModified: number
}

interface VideoReadyPayload {
  sessionId: string
  duration: number
  warnings?: string[]
}

interface VideoErrorPayload {
  message: string
  mediaKind?: MediaKind | null
  name?: string
  size?: number
  type?: string
  lastModified?: number
}

export const videoSlice = createSlice({
  name: 'video',
  initialState,
  reducers: {
    setVideoLoading: (state, action: PayloadAction<VideoLoadingPayload>) => {
      state.mediaKind = action.payload.mediaKind
      state.sessionId = action.payload.sessionId
      state.fileUrl = action.payload.fileUrl
      state.name = action.payload.name
      state.size = action.payload.size
      state.type = action.payload.type
      state.duration = null
      state.lastModified = action.payload.lastModified
      state.status = 'loading-metadata'
      state.error = null
      state.warnings = []
      state.rejectionReason = null
    },
    setVideoReady: (state, action: PayloadAction<VideoReadyPayload>) => {
      if (state.sessionId !== action.payload.sessionId) return
      state.duration = action.payload.duration
      state.status = 'ready'
      state.error = null
      state.warnings = action.payload.warnings ?? []
      state.rejectionReason = null
    },
    setVideoError: (state, action: PayloadAction<VideoErrorPayload>) => {
      state.mediaKind = action.payload.mediaKind ?? null
      state.sessionId = null
      state.fileUrl = null
      state.name = action.payload.name ?? null
      state.size = action.payload.size ?? null
      state.type = action.payload.type ?? null
      state.duration = null
      state.lastModified = action.payload.lastModified ?? null
      state.status = 'error'
      state.error = action.payload.message
      state.warnings = []
      state.rejectionReason = action.payload.message
    },
    clearVideo: () => initialState,
  },
})

export const { setVideoLoading, setVideoReady, setVideoError, clearVideo } = videoSlice.actions
export default videoSlice.reducer
