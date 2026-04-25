/**
 * Standardized message types for background worker communication.
 */

export type WorkerTaskType =
  | 'INIT_MODELS'
  | 'EXTRACT_AUDIO'
  | 'TRANSCRIBE'
  | 'PROCESS_FRAMES'
  | 'CHALLENGE_RESPONSE' // For the chat logic
  | 'SIMULATE_WORK' // For testing/bootstrap

export type WorkerMessageType = 'READY' | 'PROGRESS' | 'SUCCESS' | 'ERROR'

export interface WorkerRequest<T = unknown> {
  type: WorkerTaskType
  payload?: T
}

export interface WorkerResponse<T = unknown> {
  type: WorkerMessageType
  taskType: WorkerTaskType
  progress?: number
  data?: T
  error?: string
}
