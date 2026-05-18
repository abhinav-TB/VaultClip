import { useEffect, useMemo, useState } from 'react'
import { getChatBlockedMessage } from '../lib/chatReadiness'
import { formatElapsedTime } from '../lib/format'

export const ContextPrepPanel = ({
  status,
  embeddingStatus,
  retrievalMode,
  chunkCount,
  warning,
  error,
  startedAtMs,
  completedAtMs,
  phase,
  progress,
  transcriptStatus,
  transcriptCount,
  frameSummaryStatus,
  frameSummaryError,
  frameSummaryCount,
  canBuildIndex,
  modelReady,
  contextReady,
  experienceMode,
  onBuildIndex,
}: {
  status: string
  embeddingStatus: string
  retrievalMode: string
  chunkCount: number
  warning: string | null
  error: string | null
  startedAtMs: number | null
  completedAtMs: number | null
  phase: string | null
  progress: number
  transcriptStatus: string
  transcriptCount: number
  frameSummaryStatus: string
  frameSummaryError: string | null
  frameSummaryCount: number
  canBuildIndex: boolean
  modelReady: boolean
  contextReady: boolean
  experienceMode: 'normal' | 'power'
  onBuildIndex: () => void
}) => (
  <div className="shrink-0 border-b border-slate-800 bg-slate-950/60 p-4">
    <ContextIndexStatus
      status={status}
      embeddingStatus={embeddingStatus}
      retrievalMode={retrievalMode}
      chunkCount={chunkCount}
      warning={warning}
      error={error}
      startedAtMs={startedAtMs}
      completedAtMs={completedAtMs}
      phase={phase}
      progress={progress}
      transcriptStatus={transcriptStatus}
      transcriptCount={transcriptCount}
      frameSummaryStatus={frameSummaryStatus}
      frameSummaryError={frameSummaryError}
      frameSummaryCount={frameSummaryCount}
      canBuildIndex={canBuildIndex}
      experienceMode={experienceMode}
      onBuildIndex={onBuildIndex}
    />
    <ChatReadinessNotice
      modelReady={modelReady}
      contextReady={contextReady}
      canBuildIndex={canBuildIndex}
      transcriptCount={transcriptCount}
      frameSummaryCount={frameSummaryCount}
    />
  </div>
)

const ChatReadinessNotice = ({
  modelReady,
  contextReady,
  canBuildIndex,
  transcriptCount,
  frameSummaryCount,
}: {
  modelReady: boolean
  contextReady: boolean
  canBuildIndex: boolean
  transcriptCount: number
  frameSummaryCount: number
}) => {
  if (modelReady && contextReady) {
    return (
      <div className="mt-3 rounded-lg border border-green-500/20 bg-green-500/10 px-3 py-2 text-xs leading-5 text-green-100/80">
        Chat is grounded in {formatTranscriptSegmentCount(transcriptCount)} and {formatVisualSegmentCount(frameSummaryCount)}.
      </div>
    )
  }

  return (
    <div className="mt-3 rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-xs leading-5 text-slate-500">
      {getChatBlockedMessage(modelReady, contextReady, canBuildIndex)}
    </div>
  )
}

const ContextIndexStatus = ({
  status,
  embeddingStatus,
  retrievalMode,
  chunkCount,
  warning,
  error,
  startedAtMs,
  completedAtMs,
  phase,
  progress,
  transcriptStatus,
  transcriptCount,
  frameSummaryStatus,
  frameSummaryError,
  frameSummaryCount,
  canBuildIndex,
  experienceMode,
  onBuildIndex,
}: {
  status: string
  embeddingStatus: string
  retrievalMode: string
  chunkCount: number
  warning: string | null
  error: string | null
  startedAtMs: number | null
  completedAtMs: number | null
  phase: string | null
  progress: number
  transcriptStatus: string
  transcriptCount: number
  frameSummaryStatus: string
  frameSummaryError: string | null
  frameSummaryCount: number
  canBuildIndex: boolean
  experienceMode: 'normal' | 'power'
  onBuildIndex: () => void
}) => {
  const waiting = status === 'idle'
  const ready = status === 'ready'
  const indexing = status === 'indexing'
  const hasTranscript = transcriptCount > 0
  const hasFrameSummaries = frameSummaryCount > 0
  const canStartIndex = canBuildIndex || hasTranscript || hasFrameSummaries
  const title = waiting
    ? 'Context index: waiting for transcript or visual context'
    : ready
      ? `Context index: ${chunkCount} chunks ready`
      : `Context index: ${phase ?? status}`
  const detail = waiting
    ? getWaitingContextMessage(transcriptStatus, hasTranscript, frameSummaryStatus, hasFrameSummaries)
    : ready
      ? `${formatTranscriptSegmentCount(transcriptCount)} and ${formatVisualSegmentCount(frameSummaryCount)} are available for timestamped retrieval.`
      : phase ?? 'Preparing timestamped retrieval context.'
  const elapsedLabel = useElapsedTimeLabel(startedAtMs, completedAtMs, indexing)
  const dotClass = status === 'error'
    ? 'bg-red-500'
    : ready
      ? 'bg-green-500'
      : indexing
        ? 'bg-cyan-400 animate-pulse'
        : 'bg-slate-500'

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-3 text-xs text-slate-500">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${dotClass}`} />
            <span className="font-semibold text-slate-300">{title}</span>
          </div>
          <p className="mt-1 leading-5 text-slate-500">{detail}</p>
        </div>
        <span className="shrink-0 rounded-md border border-slate-800 bg-slate-900 px-2 py-1 font-bold uppercase tracking-wide text-slate-500">
          {getRetrievalLabel(retrievalMode, embeddingStatus)}
        </span>
      </div>
      {elapsedLabel && (
        <p className="mt-2 text-[11px] font-medium uppercase tracking-wide text-cyan-200/80">
          Indexing time {elapsedLabel}
        </p>
      )}
      {!indexing && canStartIndex && (
        <button
          type="button"
          onClick={onBuildIndex}
          className="mt-3 w-full rounded-lg border border-cyan-500/40 bg-cyan-600 px-3 py-2 text-xs font-bold uppercase tracking-wide text-white transition-colors hover:bg-cyan-500 disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-800 disabled:text-slate-500"
        >
          {ready ? 'Rebuild Context Index' : 'Build Context Index'}
        </button>
      )}
      {status === 'indexing' && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
          <div className="h-full bg-cyan-500 transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      )}
      {experienceMode === 'power' && frameSummaryStatus === 'error' && frameSummaryError && (
        <p className="mt-2 leading-5 text-red-200/80">Visual context failed: {frameSummaryError}</p>
      )}
      {warning && <p className="mt-2 leading-5 text-yellow-200/80">{warning}</p>}
      {error && <p className="mt-2 leading-5 text-red-200/80">{error}</p>}
    </div>
  )
}

function useElapsedTimeLabel(startedAtMs: number | null, completedAtMs: number | null, indexing: boolean) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!indexing || !startedAtMs) return
    const timer = window.setInterval(() => {
      setNow(Date.now())
    }, 200)
    return () => window.clearInterval(timer)
  }, [indexing, startedAtMs])

  return useMemo(() => {
    if (!startedAtMs) return null
    const end = completedAtMs ?? now
    const elapsedSeconds = Math.max(0, (end - startedAtMs) / 1000)
    return formatElapsedTime(elapsedSeconds)
  }, [completedAtMs, now, startedAtMs])
}

function getRetrievalLabel(retrievalMode: string, embeddingStatus: string) {
  if (retrievalMode === 'lexical') return 'lexical'
  if (embeddingStatus === 'ready') return 'hybrid + embeddings'
  if (embeddingStatus === 'loading') return 'hybrid loading'
  if (embeddingStatus === 'error') return 'hybrid fallback'
  return 'hybrid'
}

function getWaitingContextMessage(transcriptStatus: string, hasTranscript: boolean, frameSummaryStatus: string, hasFrameSummaries: boolean) {
  if (hasTranscript || hasFrameSummaries) {
    return 'Context artifacts are available. Build the index when you are ready to use them for timestamped Q&A.'
  }

  const transcriptText = transcriptStatus === 'transcribing'
    ? 'Transcript is currently running.'
    : transcriptStatus === 'ready'
      ? 'Transcript is ready.'
      : 'Run Transcribe to add spoken context.'
  const frameText = frameSummaryStatus === 'summarizing'
    ? 'Visual context is currently running.'
    : frameSummaryStatus === 'ready'
      ? 'Visual context is ready.'
      : 'Sample and summarize frames to add visual context.'

  return `${transcriptText} ${frameText}`
}

function formatTranscriptSegmentCount(count: number) {
  return `${count} transcript ${count === 1 ? 'segment' : 'segments'}`
}

function formatVisualSegmentCount(count: number) {
  return `${count} visual context ${count === 1 ? 'segment' : 'segments'}`
}
