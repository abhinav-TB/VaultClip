export interface TimeSegment {
  startTime: number
  endTime: number
}

/**
 * Builds fixed timestamp ranges with configurable overlap.
 *
 * @param duration - Media duration in seconds.
 * @param chunkSeconds - Target chunk duration in seconds.
 * @param overlapSeconds - Overlap to apply between adjacent chunks.
 * @returns Ordered timestamp ranges.
 */
export function buildTimeSegments(
  duration: number,
  chunkSeconds: number,
  overlapSeconds: number,
): TimeSegment[] {
  const segments: TimeSegment[] = []
  let cursor = 0

  while (cursor < duration) {
    const endTime = Math.min(duration, cursor + chunkSeconds)
    if (endTime - cursor >= 0.5) {
      segments.push({ startTime: cursor, endTime })
    }

    if (endTime >= duration) break
    cursor = Math.max(0, endTime - overlapSeconds)
  }

  return segments
}
