import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export type VideoStatus = 'idle' | 'selected'

interface VideoState {
  fileUrl: string | null
  name: string | null
  size: number | null
  type: string | null
  status: VideoStatus
}

const initialState: VideoState = {
  fileUrl: null,
  name: null,
  size: null,
  type: null,
  status: 'idle',
}

interface VideoPayload {
  fileUrl: string
  name: string
  size: number
  type: string
}

export const videoSlice = createSlice({
  name: 'video',
  initialState,
  reducers: {
    setVideo: (state, action: PayloadAction<VideoPayload>) => {
      state.fileUrl = action.payload.fileUrl
      state.name = action.payload.name
      state.size = action.payload.size
      state.type = action.payload.type
      state.status = 'selected'
    },
    clearVideo: (state) => {
      // Free the browser memory URL if it exists
      if (state.fileUrl) {
        URL.revokeObjectURL(state.fileUrl)
      }
      return initialState
    },
  },
})

export const { setVideo, clearVideo } = videoSlice.actions
export default videoSlice.reducer
