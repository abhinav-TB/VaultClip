import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export type ModelStatus = 'idle' | 'loading' | 'ready' | 'error'

interface ModelState {
  status: ModelStatus
  progress: number
  error: string | null
}

const initialState: ModelState = {
  status: 'idle',
  progress: 0,
  error: null,
}

export const modelSlice = createSlice({
  name: 'model',
  initialState,
  reducers: {
    setStatus: (state, action: PayloadAction<ModelStatus>) => {
      state.status = action.payload
    },
    setProgress: (state, action: PayloadAction<number>) => {
      state.progress = action.payload
    },
    setError: (state, action: PayloadAction<string>) => {
      state.status = 'error'
      state.error = action.payload
    },
  },
})

export const { setStatus, setProgress, setError } = modelSlice.actions
export default modelSlice.reducer
