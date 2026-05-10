import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit'

export interface FrameSummary {
  timestamp: number
  summary: string
}

export type TranscriptStatus = 'idle' | 'transcribing' | 'ready' | 'error'

/** Timestamped transcript segment generated from one Gemma audio chunk. */
export interface TranscriptSegment {
  id: string
  index: number
  startTime: number
  endTime: number
  text: string
  source: 'gemma-audio-chunk'
}

/** Transcript and future visual context generated from the active media. */
interface ContextState {
  transcriptStatus: TranscriptStatus
  transcriptProgress: number
  transcriptPhase: string | null
  transcriptError: string | null
  transcriptWarnings: string[]
  transcript: string
  transcriptRawText: string
  transcriptSegments: TranscriptSegment[]
  frameSummaries: FrameSummary[]
}

const initialState: ContextState = {
  transcriptStatus: 'idle',
  transcriptProgress: 0,
  transcriptPhase: null,
  transcriptError: null,
  transcriptWarnings: [],
  transcript: '',
  transcriptRawText: '',
  transcriptSegments: [],
  frameSummaries: [],
}

export const contextSlice = createSlice({
  name: 'context',
  initialState,
  reducers: {
    setTranscript: (state, action: PayloadAction<string>) => {
      state.transcript = action.payload
    },
    setTranscriptTranscribing: (state) => {
      state.transcriptStatus = 'transcribing'
      state.transcriptProgress = 0
      state.transcriptPhase = 'Preparing transcription'
      state.transcriptError = null
      state.transcriptWarnings = []
      state.transcript = ''
      state.transcriptRawText = ''
      state.transcriptSegments = []
    },
    setTranscriptProgress: (state, action: PayloadAction<number>) => {
      state.transcriptProgress = Math.max(0, Math.min(100, Math.round(action.payload)))
    },
    setTranscriptPhase: (state, action: PayloadAction<string>) => {
      state.transcriptPhase = action.payload
    },
    setTranscriptResult: (state, action: PayloadAction<{ segments: TranscriptSegment[]; rawText: string; warnings?: string[] }>) => {
      state.transcriptStatus = 'ready'
      state.transcriptProgress = 100
      state.transcriptPhase = 'Transcript ready'
      state.transcriptError = null
      state.transcriptWarnings = action.payload.warnings ?? []
      state.transcriptSegments = action.payload.segments
      state.transcriptRawText = action.payload.rawText
      state.transcript = action.payload.segments.map((segment) => segment.text).join(' ')
    },
    appendTranscriptSegments: (state, action: PayloadAction<{ segments: TranscriptSegment[]; rawText: string }>) => {
      const existingIds = new Set(state.transcriptSegments.map((segment) => segment.id))
      const newSegments = action.payload.segments.filter((segment) => !existingIds.has(segment.id))
      state.transcriptSegments.push(...newSegments)
      state.transcriptSegments.sort((a, b) => a.index - b.index)
      state.transcriptRawText += `${state.transcriptRawText ? '\n\n' : ''}${action.payload.rawText}`
      state.transcript = state.transcriptSegments.map((segment) => segment.text).join(' ')
    },
    setTranscriptError: (state, action: PayloadAction<string>) => {
      state.transcriptStatus = 'error'
      state.transcriptProgress = 0
      state.transcriptPhase = null
      state.transcriptError = action.payload
      state.transcriptWarnings = []
    },
    appendTranscriptSegment: (state, action: PayloadAction<string>) => {
      state.transcript += (state.transcript ? ' ' : '') + action.payload
    },
    addFrameSummary: (state, action: PayloadAction<FrameSummary>) => {
      state.frameSummaries.push(action.payload)
    },
    clearContext: () => initialState,
  },
})

export const { setTranscript, setTranscriptTranscribing, setTranscriptProgress, setTranscriptPhase, setTranscriptResult, setTranscriptError, appendTranscriptSegments, appendTranscriptSegment, addFrameSummary, clearContext } =
  contextSlice.actions
export default contextSlice.reducer
