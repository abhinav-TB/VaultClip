const videoFiles = new Map<string, File>()

/**
 * Stores selected video File objects outside Redux.
 *
 * Redux keeps only serializable metadata; this registry owns the live File
 * references needed by ffmpeg extraction.
 */
export function registerVideoFile(sessionId: string, file: File) {
  videoFiles.set(sessionId, file)
}

/** Returns the File for a media session, or null if browser memory was cleared. */
export function getVideoFile(sessionId: string | null) {
  if (!sessionId) return null
  return videoFiles.get(sessionId) ?? null
}

/** Removes one registered video File reference. */
export function unregisterVideoFile(sessionId: string | null) {
  if (!sessionId) return
  videoFiles.delete(sessionId)
}

/** Clears all video File references, usually after replace/reset. */
export function clearVideoFiles() {
  videoFiles.clear()
}
