export interface GenerationSettings {
  maxNewTokens: number
  maxVideoSizeMb: number
  maxVideoDurationMinutes: number
  audioSampleRate: 16000 | 24000 | 48000
  audioFormat: 'wav' | 'flac'
}
