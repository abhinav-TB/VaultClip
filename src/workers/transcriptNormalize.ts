import { TranscriptSegment } from './types'

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

export function estimateTokenCount(text: string) {
  if (!text) return 0
  return Math.ceil(text.split(/\s+/).length * 1.35)
}

export function looksTruncated(text: string) {
  if (!text) return true
  if (/[.!?]"?$/.test(text)) return false
  const words = text.split(/\s+/)
  return words.length > 20 && /[,;:]$/.test(text)
}

export function removeBoundaryDuplicates(segments: TranscriptSegment[]) {
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
