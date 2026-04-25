import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export interface FrameSummary {
  timestamp: number
  summary: string
}

interface ContextState {
  transcript: string
  frameSummaries: FrameSummary[]
}

const initialState: ContextState = {
  transcript: '',
  frameSummaries: [],
}

export const contextSlice = createSlice({
  name: 'context',
  initialState,
  reducers: {
    setTranscript: (state, action: PayloadAction<string>) => {
      state.transcript = action.payload
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

export const { setTranscript, appendTranscriptSegment, addFrameSummary, clearContext } =
  contextSlice.actions
export default contextSlice.reducer
