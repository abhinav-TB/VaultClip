import type { Action } from '@reduxjs/toolkit';
import { configureStore, combineReducers } from '@reduxjs/toolkit'
import modelReducer from './slices/modelSlice'
import videoReducer from './slices/videoSlice'
import processingReducer from './slices/processingSlice'
import contextReducer from './slices/contextSlice'
import chatReducer from './slices/chatSlice'
import audioReducer from './slices/audioSlice'

const appReducer = combineReducers({
  model: modelReducer,
  video: videoReducer,
  processing: processingReducer,
  context: contextReducer,
  chat: chatReducer,
  audio: audioReducer,
})

export const RESET_APP_STATE = 'meta/resetAppState'

// Meta-reducer to handle wiping the state clean when the user changes a video
const rootReducer = (state: ReturnType<typeof appReducer> | undefined, action: Action) => {
  if (action.type === RESET_APP_STATE) {
    // If we want to keep the model loaded when resting the video, we can preserve it:
    // This allows the user to switch videos without the AI model needing to be downloaded/initialized again
    const preservedState = {
      model: state?.model,
    }

    // We pass undefined for everything else so it falls back to initialState
    state = {
      ...appReducer(undefined, { type: '' }),
      model: preservedState.model ?? appReducer(undefined, { type: '' }).model,
    }
  }

  return appReducer(state, action)
}

export const store = configureStore({
  reducer: rootReducer,
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
