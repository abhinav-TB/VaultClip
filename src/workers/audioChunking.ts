import { buildTimeSegments, type TimeSegment } from '../lib/segmentation'

/** Timestamp range sent to Gemma as one transcription input. */
export type AudioChunk = TimeSegment

/**
 * Builds fixed transcript chunks with overlap.
 *
 * Gemma's practical audio input window is limited, so transcription uses fixed
 * timestamp ranges with configurable overlap instead of sending one long clip.
 *
 * @param audio - Decoded mono audio samples.
 * @param sampleRate - Audio sample rate in Hz.
 * @param duration - Media duration in seconds, or null to derive it from samples.
 * @param chunkSeconds - Target chunk duration in seconds.
 * @param overlapSeconds - Overlap to apply between adjacent chunks.
 * @returns Ordered timestamp ranges for transcription.
 */
export function buildFixedTranscriptChunks(
  audio: Float32Array,
  sampleRate: number,
  duration: number | null,
  chunkSeconds: number,
  overlapSeconds: number,
): AudioChunk[] {
  const audioDuration = duration ?? audio.length / sampleRate
  return buildTimeSegments(audioDuration, chunkSeconds, overlapSeconds)
}
