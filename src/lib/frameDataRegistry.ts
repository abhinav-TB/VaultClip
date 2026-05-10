interface FrameDataEntry {
  blob: Blob
  timestamp: number
  targetTimestamp: number
  width: number
  height: number
  mimeType: string
}

const frameData = new Map<string, Map<string, FrameDataEntry>>()

/**
 * Stores sampled frame blobs outside Redux, keyed by media session and frame ID.
 *
 * Redux stores only serializable metadata and object URLs.
 */
export function registerFrameData(sessionId: string, frameId: string, entry: FrameDataEntry) {
  const sessionFrames = frameData.get(sessionId) ?? new Map<string, FrameDataEntry>()
  sessionFrames.set(frameId, entry)
  frameData.set(sessionId, sessionFrames)
}

/** Returns all frame blobs for a session in insertion order. */
export function getFrameData(sessionId: string | null) {
  if (!sessionId) return []
  return Array.from(frameData.get(sessionId)?.entries() ?? [])
}

/** Removes all frame blobs for one media session. */
export function unregisterFrameData(sessionId: string | null) {
  if (!sessionId) return
  frameData.delete(sessionId)
}

/** Clears every sampled frame blob, usually after replace/reset. */
export function clearFrameData() {
  frameData.clear()
}
