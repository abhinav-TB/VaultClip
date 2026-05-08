const videoFiles = new Map<string, File>()

export function registerVideoFile(sessionId: string, file: File) {
  videoFiles.set(sessionId, file)
}

export function getVideoFile(sessionId: string | null) {
  if (!sessionId) return null
  return videoFiles.get(sessionId) ?? null
}

export function unregisterVideoFile(sessionId: string | null) {
  if (!sessionId) return
  videoFiles.delete(sessionId)
}

export function clearVideoFiles() {
  videoFiles.clear()
}
