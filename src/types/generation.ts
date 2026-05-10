export interface GenerationSettings {
  maxNewTokens: number
  transcriptMaxNewTokens: 512 | 1024 | 2048 | 'unlimited'
  maxVideoSizeMb: number
  maxVideoDurationMinutes: number
  audioSampleRate: 16000 | 24000 | 48000
  audioFormat: 'wav' | 'flac'
  transcriptChunkSeconds: number
  transcriptOverlapSeconds: number
}
