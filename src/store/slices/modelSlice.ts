import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { ModelLoadSource, ModelLoadStage } from '../../workers/types'

export type ModelStatus = 'idle' | 'loading' | 'ready' | 'error'

interface ModelState {
  status: ModelStatus
  progress: number
  error: string | null
  loadStage: ModelLoadStage | 'not-loaded'
  loadSource: ModelLoadSource
  loadMessage: string
  currentFile: string | null
  loadedBytes: number | null
  totalBytes: number | null
}

const initialState: ModelState = {
  status: 'idle',
  progress: 0,
  error: null,
  loadStage: 'not-loaded',
  loadSource: 'unknown',
  loadMessage: 'Gemma has not been loaded in this browser session.',
  currentFile: null,
  loadedBytes: null,
  totalBytes: null,
}

export const modelSlice = createSlice({
  name: 'model',
  initialState,
  reducers: {
    setStatus: (state, action: PayloadAction<ModelStatus>) => {
      state.status = action.payload
      if (action.payload === 'idle') {
        state.progress = 0
        state.loadStage = 'not-loaded'
        state.loadSource = 'unknown'
        state.loadMessage = 'Gemma has not been loaded in this browser session.'
        state.currentFile = null
        state.loadedBytes = null
        state.totalBytes = null
      }
      if (action.payload !== 'error') {
        state.error = null
      }
      if (action.payload === 'loading') {
        state.loadStage = 'checking-cache'
        state.loadSource = 'unknown'
        state.loadMessage = 'Checking browser cache before loading Gemma.'
      }
      if (action.payload === 'ready') {
        state.loadStage = 'ready'
        state.loadSource = 'memory'
        state.loadMessage = 'Gemma is loaded in the worker and ready for inference.'
        state.currentFile = null
        state.loadedBytes = null
        state.totalBytes = null
      }
    },
    setProgress: (state, action: PayloadAction<number>) => {
      state.progress = Math.max(0, Math.min(100, action.payload))
    },
    setError: (state, action: PayloadAction<string>) => {
      state.status = 'error'
      state.error = action.payload
      state.loadStage = 'failed'
      state.loadMessage = action.payload
    },
    setLoadDetails: (
      state,
      action: PayloadAction<{
        loadStage?: ModelState['loadStage']
        loadSource?: ModelLoadSource
        loadMessage?: string
        currentFile?: string | null
        loadedBytes?: number | null
        totalBytes?: number | null
      }>,
    ) => {
      state.loadStage = action.payload.loadStage ?? state.loadStage
      state.loadSource = action.payload.loadSource ?? state.loadSource
      state.loadMessage = action.payload.loadMessage ?? state.loadMessage
      state.currentFile = action.payload.currentFile ?? state.currentFile
      state.loadedBytes = action.payload.loadedBytes ?? state.loadedBytes
      state.totalBytes = action.payload.totalBytes ?? state.totalBytes
    },
    resetModel: () => initialState,
  },
})

export const { setStatus, setProgress, setError, setLoadDetails, resetModel } = modelSlice.actions
export default modelSlice.reducer
