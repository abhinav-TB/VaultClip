/**
 * Standardized message types for background worker communication.
 */

export type WorkerTaskType =
  | 'INIT_MODELS'
  | 'EXTRACT_AUDIO'
  | 'TRANSCRIBE'
  | 'PROCESS_FRAMES'
  | 'CHALLENGE_RESPONSE'

export type WorkerMessageType = 'READY' | 'PROGRESS' | 'SUCCESS' | 'ERROR' | 'LOG' | 'PARTIAL'

export type ModelLoadStage =
  | 'checking-cache'
  | 'loading-cache'
  | 'downloading'
  | 'initializing'
  | 'ready'
  | 'failed'

export type ModelLoadSource = 'cache' | 'network' | 'memory' | 'unknown'

export interface ModelLoadEvent {
  stage: ModelLoadStage
  source: ModelLoadSource
  message: string
  file?: string
  loaded?: number
  total?: number
}

export interface AttachmentPayload {
  type: 'image' | 'text'
  data: string
  name: string
}

export interface ChatPayload {
  prompt: string
  attachments?: AttachmentPayload[]
  maxNewTokens?: number
}

export type AudioFormat = 'wav' | 'flac'
export type AudioSampleRate = 16000 | 24000 | 48000

export interface ExtractAudioPayload {
  sessionId: string
  file: File
  inputName: string
  outputFormat: AudioFormat
  sampleRate: AudioSampleRate
}

export interface ExtractAudioResult {
  sessionId: string
  bytes: Uint8Array
  mimeType: string
  fileName: string
  size: number
  format: AudioFormat
  sampleRate: AudioSampleRate
  channels: 1
}

export interface TranscriptSegment {
  id: string
  index: number
  startTime: number
  endTime: number
  text: string
  source: 'gemma-audio-chunk'
}

export interface TranscribePayload {
  sessionId: string
  bytes: Uint8Array
  mimeType: string
  sampleRate: number
  duration: number | null
  maxNewTokens: 512 | 1024 | 2048 | 'unlimited'
  chunkSeconds: number
  overlapSeconds: number
}

export interface TranscribeResult {
  sessionId: string
  segments: TranscriptSegment[]
  rawText: string
}

export interface TranscribePartialResult {
  sessionId: string
  segments: TranscriptSegment[]
  rawText: string
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
