export interface AudioChunk {
  startTime: number
  endTime: number
}

export function buildFixedTranscriptChunks(
  audio: Float32Array,
  sampleRate: number,
  duration: number | null,
  chunkSeconds: number,
  overlapSeconds: number,
) {
  const audioDuration = duration ?? audio.length / sampleRate
  const chunks: AudioChunk[] = []
  let cursor = 0

  while (cursor < audioDuration) {
    const endTime = Math.min(audioDuration, cursor + chunkSeconds)
    if (endTime - cursor >= 0.5) {
      chunks.push({ startTime: cursor, endTime })
    }

    if (endTime >= audioDuration) break
    cursor = Math.max(0, endTime - overlapSeconds)
  }

  return chunks
}
