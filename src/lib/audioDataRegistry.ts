/** In-memory audio bytes used by transcription worker tasks. */
interface AudioDataEntry {
  bytes: Uint8Array
  mimeType: string
  sampleRate: number
  duration: number | null
}

const audioData = new Map<string, AudioDataEntry>()

/**
 * Stores extracted/uploaded audio bytes outside Redux.
 *
 * The byte array is copied on write so later mutations cannot corrupt the
 * transcription input for a session.
 */
export function registerAudioData(sessionId: string, entry: AudioDataEntry) {
  const bytes = new Uint8Array(entry.bytes.byteLength)
  bytes.set(entry.bytes)
  audioData.set(sessionId, {
    ...entry,
    bytes,
  })
}

/** Returns audio bytes and metadata for a session, or null if unavailable. */
export function getAudioData(sessionId: string | null) {
  if (!sessionId) return null
  return audioData.get(sessionId) ?? null
}

/** Removes one session's in-memory audio bytes. */
export function unregisterAudioData(sessionId: string | null) {
  if (!sessionId) return
  audioData.delete(sessionId)
}

/** Clears all in-memory audio bytes, usually after replace/reset. */
export function clearAudioData() {
  audioData.clear()
}
