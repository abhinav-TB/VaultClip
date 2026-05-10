import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

interface ChatState {
  messages: ChatMessage[]
  isGenerating: boolean
}

const initialState: ChatState = {
  messages: [],
  isGenerating: false,
}

export const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    addMessage: (state, action: PayloadAction<ChatMessage>) => {
      state.messages.push(action.payload)
    },
    updateLastMessage: (state, action: PayloadAction<string>) => {
      const lastIndex = state.messages.length - 1
      if (lastIndex >= 0 && state.messages[lastIndex].role === 'assistant') {
        state.messages[lastIndex].content = action.payload
      }
    },
    setGeneratingStatus: (state, action: PayloadAction<boolean>) => {
      state.isGenerating = action.payload
    },
    clearChat: () => initialState,
  },
})

export const { addMessage, updateLastMessage, setGeneratingStatus, clearChat } = chatSlice.actions
export default chatSlice.reducer
