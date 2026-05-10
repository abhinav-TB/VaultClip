import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit'

export type ProcessingStatus =
  | 'idle'
  | 'extracting-audio'
  | 'transcribing'
  | 'sampling'
  | 'summarizing'
  | 'complete'

interface ProcessingState {
  status: ProcessingStatus
  progress: number
  error: string | null
}

const initialState: ProcessingState = {
  status: 'idle',
  progress: 0,
  error: null,
}

export const processingSlice = createSlice({
  name: 'processing',
  initialState,
  reducers: {
    setProcessingStatus: (state, action: PayloadAction<ProcessingStatus>) => {
      state.status = action.payload
    },
    setProcessingProgress: (state, action: PayloadAction<number>) => {
      state.progress = action.payload
    },
    setProcessingError: (state, action: PayloadAction<string>) => {
      state.error = action.payload
    },
    resetProcessing: () => initialState,
  },
})

export const { setProcessingStatus, setProcessingProgress, setProcessingError, resetProcessing } =
  processingSlice.actions
export default processingSlice.reducer
