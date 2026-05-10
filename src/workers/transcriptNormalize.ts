import type { TranscriptSegment } from './types'

/**
 * Converts raw Gemma output into transcript text suitable for product state.
 *
 * Gemma can echo chat-role labels, the transcription prompt, or markdown.
 *
 * @param text - Raw decoded model output.
 * @returns Clean transcript text, or an empty string when no usable speech remains.
 */
export function normalizeTranscriptText(text: string) {
  return text
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```[a-z]*|```/gi, ''))
    .replace(/<audio_soft_token>/gi, '')
    .replace(/^\s*(user\s+model|user|model|assistant)\b\s*/i, '')
    .replace(/Transcribe the spoken words in this audio exactly\./gi, '')
    .replace(/Return only the transcript text\./gi, '')
    .replace(/Do not summarize, translate, add timestamps, describe sounds, or add commentary\./gi, '')
    .replace(/\r/g, '\n')
    .split(/\n+/)
    .map((line) => line.replace(/^\s*(transcript|output|answer|speaker\s*\d*|gemma|model)\s*:?\s*/i, '').trim())
    .filter((line) => line && !/^(\[?inaudible\]?|no speech detected\.?|there is no speech\.?)$/i.test(line))
    .join(' ')
    .replace(/^\s*(user\s+model|user|model|assistant)\b\s*/i, '')
    .replace(/\s+/g, ' ')
    .replace(/^["'“”]+|["'“”]+$/g, '')
    .trim()
}

/**
 * Estimates generated token count from text for truncation detection.
 *
 * @param text - Cleaned transcript text.
 * @returns Approximate token count.
 */
export function estimateTokenCount(text: string) {
  if (!text) return 0
  return Math.ceil(text.split(/\s+/).length * 1.35)
}

/**
 * Detects likely cut-off transcript output so the caller can retry smaller chunks.
 *
 * @param text - Cleaned transcript text.
 * @returns True when the text is empty or appears incomplete.
 */
export function looksTruncated(text: string) {
  // Heuristic only: if a longer response ends on a clause separator, retry the
  // chunk with a smaller audio range.
  if (!text) return true
  if (/[.!?]"?$/.test(text)) return false
  const words = text.split(/\s+/)
  return words.length > 20 && /[,;:]$/.test(text)
}

/**
 * Removes exact repeated word overlap between adjacent transcript segments.
 *
 * @param segments - Ordered transcript segments, usually from overlapped chunks.
 * @returns New segment list with duplicated overlap trimmed.
 */
export function removeBoundaryDuplicates(segments: TranscriptSegment[]) {
  // Overlapped chunks may repeat the last few words of the previous segment.
  // Trim only exact word overlap so we do not rewrite the transcript content.
  const deduped: TranscriptSegment[] = []

  for (const segment of segments) {
    const previous = deduped[deduped.length - 1]
    if (!previous) {
      deduped.push({ ...segment })
      continue
    }

    const text = removeOverlap(previous.text, segment.text)
    if (text) {
      deduped.push({ ...segment, text })
    }
  }

  return deduped
}

function removeOverlap(previous: string, next: string) {
  const previousWords = previous.toLowerCase().split(/\s+/)
  const nextWords = next.split(/\s+/)
  const nextLower = nextWords.map((word) => word.toLowerCase())
  const maxOverlap = Math.min(12, previousWords.length, nextWords.length)

  for (let count = maxOverlap; count >= 3; count -= 1) {
    const prevTail = previousWords.slice(-count).join(' ')
    const nextHead = nextLower.slice(0, count).join(' ')
    if (prevTail === nextHead) {
      return nextWords.slice(count).join(' ').trim()
    }
  }

  return next.trim()
}
