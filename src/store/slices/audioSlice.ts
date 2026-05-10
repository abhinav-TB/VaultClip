import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit'

export type AudioStatus = 'idle' | 'extracting' | 'ready' | 'error'
export type AudioFormat = 'wav' | 'flac' | 'source'
export type AudioSampleRate = 16000 | 24000 | 48000

/**
 * Serializable state for transcription-ready audio.
 *
 * Raw bytes stay in the audio data registry; Redux stores status, metadata, and
 * the preview object URL.
 */
interface AudioState {
  status: AudioStatus
  progress: number
  phase: string | null
  sessionId: string | null
  objectUrl: string | null
  format: AudioFormat | null
  sampleRate: AudioSampleRate | null
  channels: 1 | null
  duration: number | null
  size: number | null
  fileName: string | null
  mimeType: string | null
  error: string | null
}

const initialState: AudioState = {
  status: 'idle',
  progress: 0,
  phase: null,
  sessionId: null,
  objectUrl: null,
  format: null,
  sampleRate: null,
  channels: null,
  duration: null,
  size: null,
  fileName: null,
  mimeType: null,
  error: null,
}

interface AudioExtractingPayload {
  sessionId: string
  format: AudioFormat
  sampleRate: AudioSampleRate
  duration: number | null
}

interface AudioReadyPayload {
  sessionId: string
  objectUrl: string
  format: AudioFormat
  sampleRate: AudioSampleRate
  channels: 1
  duration: number | null
  size: number
  fileName: string
  mimeType: string
}

interface AudioErrorPayload {
  sessionId?: string | null
  message: string
}

export const audioSlice = createSlice({
  name: 'audio',
  initialState,
  reducers: {
    setAudioExtracting: (state, action: PayloadAction<AudioExtractingPayload>) => {
      state.status = 'extracting'
      state.progress = 0
      state.phase = 'Loading ffmpeg'
      state.sessionId = action.payload.sessionId
      state.objectUrl = null
      state.format = action.payload.format
      state.sampleRate = action.payload.sampleRate
      state.channels = 1
      state.duration = action.payload.duration
      state.size = null
      state.fileName = null
      state.mimeType = null
      state.error = null
    },
    setAudioProgress: (state, action: PayloadAction<{ progress: number; phase?: string }>) => {
      state.progress = Math.max(state.progress, Math.max(0, Math.min(100, Math.round(action.payload.progress))))
      state.phase = action.payload.phase ?? state.phase
    },
    setAudioReady: (state, action: PayloadAction<AudioReadyPayload>) => {
      if (state.sessionId && state.sessionId !== action.payload.sessionId) return
      state.status = 'ready'
      state.progress = 100
      state.phase = 'Audio ready'
      state.sessionId = action.payload.sessionId
      state.objectUrl = action.payload.objectUrl
      state.format = action.payload.format
      state.sampleRate = action.payload.sampleRate
      state.channels = action.payload.channels
      state.duration = action.payload.duration
      state.size = action.payload.size
      state.fileName = action.payload.fileName
      state.mimeType = action.payload.mimeType
      state.error = null
    },
    setAudioError: (state, action: PayloadAction<AudioErrorPayload>) => {
      state.status = 'error'
      state.progress = 0
      state.phase = null
      state.sessionId = action.payload.sessionId ?? state.sessionId
      state.objectUrl = null
      state.size = null
      state.fileName = null
      state.mimeType = null
      state.error = action.payload.message
    },
    clearAudio: () => initialState,
  },
})

export const { setAudioExtracting, setAudioProgress, setAudioReady, setAudioError, clearAudio } = audioSlice.actions
export default audioSlice.reducer
