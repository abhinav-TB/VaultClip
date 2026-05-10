interface AudioDataEntry {
  bytes: Uint8Array
  mimeType: string
  sampleRate: number
  duration: number | null
}

const audioData = new Map<string, AudioDataEntry>()

export function registerAudioData(sessionId: string, entry: AudioDataEntry) {
  const bytes = new Uint8Array(entry.bytes.byteLength)
  bytes.set(entry.bytes)
  audioData.set(sessionId, {
    ...entry,
    bytes,
  })
}

export function getAudioData(sessionId: string | null) {
  if (!sessionId) return null
  return audioData.get(sessionId) ?? null
}

export function unregisterAudioData(sessionId: string | null) {
  if (!sessionId) return
  audioData.delete(sessionId)
}

export function clearAudioData() {
  audioData.clear()
}
