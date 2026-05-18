import type { TranscriptSegment } from '../store/slices/contextSlice'
import type { FrameSummary } from '../store/slices/frameSlice'
import type { RagChunk, RagRetrievedChunk, RetrievalMode } from '../store/slices/ragSlice'
import type { MediaKind } from '../store/slices/videoSlice'
import { getChunkEmbedding } from './ragEmbeddingRegistry'

const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'for', 'from', 'has', 'have', 'he', 'her', 'his', 'i', 'in', 'is', 'it', 'its',
  'of', 'on', 'or', 'our', 'she', 'so', 'that', 'the', 'their', 'there', 'they', 'this', 'to', 'was', 'we', 'were', 'what', 'when', 'where',
  'which', 'who', 'will', 'with', 'you', 'your',
])

const PROMPT_CONTEXT_BUDGET = 1800

export interface BuildRagChunksInput {
  sessionId: string
  transcriptSegments: TranscriptSegment[]
  frameSummaries: FrameSummary[]
}

export interface RetrieveRagInput {
  chunks: RagChunk[]
  query: string
  retrievalMode: RetrievalMode
  sessionId: string | null
  embeddingModelId: string
  queryEmbedding?: number[] | null
}

/** Builds timestamped text chunks by combining transcript segments and their visual segment summaries. */
export function buildRagChunks({ sessionId, transcriptSegments, frameSummaries }: BuildRagChunksInput) {
  const chunks: RagChunk[] = []

  for (const segment of transcriptSegments) {
    const summaryItem = frameSummaries.find((s) => s.segmentId === segment.id)

    const textParts = []
    textParts.push(`Transcript:\n${segment.text}`)

    if (summaryItem) {
      textParts.push(`Visual Summary:\n${summaryItem.summary}`)
    }

    const text = textParts.join('\n\n')

    chunks.push({
      id: `${sessionId}-rag-segment-${segment.id}`,
      sessionId,
      source: 'mixed',
      startTime: segment.startTime,
      endTime: segment.endTime,
      text,
      tokensEstimate: estimateTokens(text),
      keywords: Array.from(new Set(tokenize(text))).slice(0, 24),
      sourceIds: summaryItem ? [segment.id, summaryItem.segmentId] : [segment.id],
    })
  }

  const transcriptIds = new Set(transcriptSegments.map((segment) => segment.id))
  for (const summary of frameSummaries) {
    if (transcriptIds.has(summary.segmentId)) continue

    const text = `Visual Summary:\n${summary.summary}`
    chunks.push({
      id: `${sessionId}-rag-frame-${summary.segmentId}`,
      sessionId,
      source: 'frame-summary',
      startTime: summary.startTime,
      endTime: summary.endTime,
      text,
      tokensEstimate: estimateTokens(text),
      keywords: Array.from(new Set(tokenize(text))).slice(0, 24),
      sourceIds: [summary.segmentId],
    })
  }

  return chunks
}

/** Returns the highest-scoring chunks for a question with lexical and optional semantic scores. */
export function retrieveRagChunks(input: RetrieveRagInput) {
  const queryTerms = tokenize(input.query)
  const documentFrequency = getDocumentFrequency(input.chunks)
  const averageLength = getAverageLength(input.chunks)

  const scored = input.chunks
    .map((chunk) => {
      const lexicalScore = scoreLexical(chunk, queryTerms, documentFrequency, input.chunks.length, averageLength, input.query)
      const semanticScore = input.retrievalMode === 'hybrid' && input.queryEmbedding
        ? getSemanticScore(input.sessionId, input.embeddingModelId, chunk.id, input.queryEmbedding)
        : null
      const combinedScore = combineScores(lexicalScore, semanticScore, input.retrievalMode)

      return {
        ...chunk,
        lexicalScore,
        semanticScore,
        combinedScore,
      }
    })
    .filter((chunk) => chunk.combinedScore > 0)
    .sort((a, b) => b.combinedScore - a.combinedScore)

  return selectPromptChunks(scored)
}

/** Formats retrieved chunks for the Gemma answer prompt. */
export function formatRagContext(chunks: RagRetrievedChunk[], mediaKind: MediaKind | null = null) {
  const segmentLabel = mediaKind === 'audio' ? 'Audio Segment' : mediaKind === 'video' ? 'Video Segment' : 'Media Segment'
  return chunks.map((chunk, index) => {
    return `[${index + 1}] ${segmentLabel} (${formatTime(chunk.startTime)}-${formatTime(chunk.endTime)})\n${chunk.text}`
  }).join('\n\n')
}

/** Compact MM:SS timestamp used in prompts and citations. */
export function formatTime(seconds: number) {
  const safeSeconds = Math.max(0, Math.round(seconds))
  const minutes = Math.floor(safeSeconds / 60)
  const remainingSeconds = safeSeconds % 60
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

/**
 * Provides a rough token count estimate to enforce context window budgets.
 * 1.35 multiplier approximates the difference between word count and Gemma tokenization.
 */
export function estimateTokens(text: string) {
  return Math.ceil(text.split(/\s+/).filter(Boolean).length * 1.35)
}



/** Normalizes text into a flat array of stemmed tokens, ignoring stopwords and punctuation. */
function tokenize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, ' ')
    .split(/\s+/)
    .map((term) => stem(term.replace(/^'+|'+$/g, '')))
    .filter((term) => term.length > 1 && !STOPWORDS.has(term))
}

/** Applies rudimentary suffix stemming to improve lexical matching for plurals and conjugations. */
function stem(term: string) {
  return term
    .replace(/'s$/g, '')
    .replace(/(?:ing|ed|ly)$/g, '')
    .replace(/s$/g, '')
}

/**
 * Calculates the number of chunks containing each unique token.
 * Used for the Inverse Document Frequency (IDF) component of the BM25 algorithm.
 */
function getDocumentFrequency(chunks: RagChunk[]) {
  const frequencies = new Map<string, number>()
  for (const chunk of chunks) {
    for (const term of new Set(tokenize(chunk.text))) {
      frequencies.set(term, (frequencies.get(term) ?? 0) + 1)
    }
  }
  return frequencies
}

/** Calculates the average token length across all chunks for BM25 normalization. */
function getAverageLength(chunks: RagChunk[]) {
  if (!chunks.length) return 1
  return chunks.reduce((total, chunk) => total + tokenize(chunk.text).length, 0) / chunks.length
}

/**
 * Computes a BM25 relevance score for a chunk against the provided query.
 * Includes a flat boost if the exact raw query string appears in the chunk.
 */
function scoreLexical(chunk: RagChunk, queryTerms: string[], documentFrequency: Map<string, number>, chunkCount: number, averageLength: number, rawQuery: string) {
  const chunkTerms = tokenize(chunk.text)
  const termCounts = new Map<string, number>()
  for (const term of chunkTerms) {
    termCounts.set(term, (termCounts.get(term) ?? 0) + 1)
  }

  const k1 = 1.2
  const b = 0.75
  let score = 0

  for (const term of queryTerms) {
    const frequency = termCounts.get(term) ?? 0
    if (!frequency) continue

    const df = documentFrequency.get(term) ?? 0
    const idf = Math.log(1 + (chunkCount - df + 0.5) / (df + 0.5))
    const denominator = frequency + k1 * (1 - b + b * (chunkTerms.length / averageLength))
    score += idf * ((frequency * (k1 + 1)) / denominator)
  }

  const query = rawQuery.trim().toLowerCase()
  if (query.length > 3 && chunk.text.toLowerCase().includes(query)) {
    score += 1.5
  }

  return score
}

/** Retrieves the embedding vector for a chunk and calculates its cosine similarity to the query. */
function getSemanticScore(sessionId: string | null, modelId: string, chunkId: string, queryEmbedding: number[]) {
  const chunkEmbedding = getChunkEmbedding(sessionId, modelId, chunkId)
  if (!chunkEmbedding) return null
  return cosineSimilarity(queryEmbedding, chunkEmbedding)
}

/** Normalizes and weighs lexical and semantic scores into a final combined score for ranking. */
function combineScores(lexicalScore: number, semanticScore: number | null, retrievalMode: RetrievalMode) {
  const normalizedLexical = lexicalScore / (lexicalScore + 2)
  if (retrievalMode === 'hybrid' && semanticScore !== null) {
    const normalizedSemantic = Math.max(0, (semanticScore + 1) / 2)
    return (0.55 * normalizedSemantic) + (0.45 * normalizedLexical)
  }
  return normalizedLexical
}

/** Calculates the cosine similarity (distance) between two vectors. */
function cosineSimilarity(a: number[], b: number[]) {
  const length = Math.min(a.length, b.length)
  let dot = 0
  let aMagnitude = 0
  let bMagnitude = 0
  for (let index = 0; index < length; index += 1) {
    dot += a[index] * b[index]
    aMagnitude += a[index] ** 2
    bMagnitude += b[index] ** 2
  }
  if (!aMagnitude || !bMagnitude) return 0
  return dot / (Math.sqrt(aMagnitude) * Math.sqrt(bMagnitude))
}

/**
 * Filters and sorts retrieved chunks to fit within the prompt context window budget.
 * Guarantees at least 3 chunks if available, up to a maximum of 8, sorted chronologically.
 */
function selectPromptChunks(chunks: RagRetrievedChunk[]) {
  const selected: RagRetrievedChunk[] = []
  let budget = 0

  for (const chunk of chunks) {
    if (selected.length >= 8) break
    if (budget + chunk.tokensEstimate > PROMPT_CONTEXT_BUDGET && selected.length >= 3) continue
    selected.push(chunk)
    budget += chunk.tokensEstimate
  }

  return selected.sort((a, b) => a.startTime - b.startTime)
}
