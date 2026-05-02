/**
 * Standardized message types for background worker communication.
 */

export type WorkerTaskType =
  | 'INIT_MODELS'
  | 'EXTRACT_AUDIO'
  | 'TRANSCRIBE'
  | 'PROCESS_FRAMES'
  | 'CHALLENGE_RESPONSE'

export type WorkerMessageType = 'READY' | 'PROGRESS' | 'SUCCESS' | 'ERROR' | 'LOG'

export interface AttachmentPayload {
  type: 'image' | 'text'
  data: string
  name: string
}

export interface ChatPayload {
  prompt: string
  attachments?: AttachmentPayload[]
}

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
