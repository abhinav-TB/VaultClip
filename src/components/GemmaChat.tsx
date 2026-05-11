import { useState } from 'react'
import { useAppSelector } from '../store/hooks'
import { useRagIndex } from '../store/hooks/useRagIndex'
import { useWorker } from '../store/hooks/useWorker'
import type { GenerationSettings } from '../types/generation'
import { formatRagContext, formatTime } from '../lib/rag'
import { getLoadingMessage, getPhaseProgressLabel, getSourceLabel, getStageLabel } from '../lib/modelRuntime'
import { RuntimeDetail } from './RuntimeDetail'
import type { RagRetrievedChunk } from '../store/slices/ragSlice'

interface PreviewAttachment {
  file: File
  type: 'image' | 'text'
  previewUrl: string
  content: string
}

interface ChatMetrics {
  time: string
  tps: string
  memory?: { used: string } | 'Not supported'
}

interface ChatResponse {
  text: string
  metrics: ChatMetrics
}

interface ChatViewMessage {
  role: 'user' | 'ai'
  content: string
  metrics?: ChatMetrics
  citations?: RagRetrievedChunk[]
}

export const GemmaChat = ({ settings }: { settings: GenerationSettings }) => {
  const { startTask, loadModel } = useWorker()
  const { buildIndex, rag, retrieveContext } = useRagIndex(settings)
  const { status: processingStatus } = useAppSelector((state) => state.processing)
  const transcriptStatus = useAppSelector((state) => state.context.transcriptStatus)
  const transcriptCount = useAppSelector((state) => state.context.transcriptSegments.length)
  const frameSummaryStatus = useAppSelector((state) => state.frames.summaryStatus)
  const frameSummaryCount = useAppSelector((state) => state.frames.summaries.length)
  const canBuildIndex = transcriptCount > 0 || frameSummaryCount > 0
  const {
    status: modelStatus,
    error: modelError,
    progress: modelProgress,
    loadStage,
    loadSource,
  } = useAppSelector((state) => state.model)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatViewMessage[]>([])
  const [attachments, setAttachments] = useState<PreviewAttachment[]>([])
  const modelReady = modelStatus === 'ready'
  const modelLoading = modelStatus === 'loading'
  const busy = processingStatus !== 'idle' && processingStatus !== 'complete'

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!modelReady || !e.target.files) return
    const files = Array.from(e.target.files)

    for (const file of files) {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onload = (event) => {
          setAttachments(prev => [...prev, {
            file,
            type: 'image',
            previewUrl: URL.createObjectURL(file),
            content: event.target?.result as string,
          }])
        }
        reader.readAsDataURL(file)
      } else if (file.type.startsWith('text/') || file.name.endsWith('.csv') || file.name.endsWith('.md') || file.name.endsWith('.json')) {
        const reader = new FileReader()
        reader.onload = (event) => {
          setAttachments(prev => [...prev, {
            file,
            type: 'text',
            previewUrl: '',
            content: event.target?.result as string,
          }])
        }
        reader.readAsText(file)
      } else {
        alert(`Raw parsing for ${file.name} is not supported. Please use images or text docs.`)
      }
    }
    e.target.value = ''
  }

  const handleSend = async () => {
    if ((!input.trim() && attachments.length === 0) || busy || !modelReady) return

    const userMsg = input
    const payloadAttachments = attachments.map(a => ({ type: a.type, data: a.content, name: a.file.name }))
    const retrievedChunks = userMsg.trim() ? await retrieveContext(userMsg) : []
    const groundedPrompt = buildGroundedPrompt(userMsg || 'Please analyze the attached files.', retrievedChunks)

    setInput('')
    setAttachments([])

    setMessages(prev => [
      ...prev,
      { role: 'user', content: userMsg || `[Sent ${payloadAttachments.length} Attachments]` },
      { role: 'ai', content: '' },
    ])

    try {
      const response = await startTask<ChatResponse>('CHALLENGE_RESPONSE', {
        prompt: groundedPrompt,
        attachments: payloadAttachments,
        maxNewTokens: settings.maxNewTokens,
      }, (log) => {
        if (log.startsWith('[STREAM]')) {
          const chunk = log.replace('[STREAM]', '')
          setMessages(prev => {
            const newArr = [...prev]
            const lastIdx = newArr.length - 1
            if (newArr[lastIdx].role === 'ai') {
              newArr[lastIdx] = { ...newArr[lastIdx], content: newArr[lastIdx].content + chunk }
            }
            return newArr
          })
        }
      })

      setMessages(prev => {
        const newArr = [...prev]
        const lastIdx = newArr.length - 1
        if (newArr[lastIdx].role === 'ai') {
          newArr[lastIdx] = {
            role: 'ai',
            content: response.text,
            metrics: response.metrics,
            citations: retrievedChunks,
          }
        }
        return newArr
      })
    } catch (err) {
      console.error('Chat failed:', err)
      setMessages(prev => [...prev, { role: 'ai', content: '[Error: Local Inference failed]' }])
    }
  }

  return (
    <div className="flex h-[560px] w-full flex-col overflow-hidden rounded-2xl border border-gray-800 bg-gray-900 shadow-2xl">
      <div className="bg-gray-800/50 p-4 border-b border-gray-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${
            modelReady ? 'bg-green-500' : modelLoading ? 'bg-yellow-400 animate-pulse' : modelStatus === 'error' ? 'bg-red-500' : 'bg-gray-500'
          }`} />
          <span className="text-sm font-medium text-gray-300">Gemma-E2B Local AI</span>
        </div>
        <span className="text-xs text-gray-500 uppercase tracking-widest font-bold">
          {modelReady ? 'Ready for inference' : modelLoading ? 'Loading model' : modelStatus === 'error' ? 'Model failed' : 'Model not loaded'}
        </span>
      </div>

      {!modelReady && (
        <div className="border-b border-gray-800 bg-gray-950/80 px-5 py-4 text-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1 space-y-3">
              <p className="font-semibold text-gray-200">
                {modelLoading
                  ? 'Gemma is loading before chat can start.'
                  : modelStatus === 'error'
                    ? 'Gemma failed to load.'
                    : 'Load Gemma to enable chat and file analysis.'}
              </p>
              <p className="text-xs leading-5 text-gray-500">
                {modelStatus === 'error'
                  ? modelError || 'The worker returned an error without details.'
                  : getLoadingMessage(loadStage, loadSource)}
              </p>

              {modelLoading && (
                <div className="space-y-3 rounded-lg border border-gray-800 bg-gray-900/60 p-3">
                  <div className="flex items-center gap-3">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-800">
                      <div className="h-full bg-yellow-400 transition-all duration-500" style={{ width: `${modelProgress}%` }} />
                    </div>
                    <span className="w-10 text-right font-mono text-xs text-gray-400">{modelProgress}%</span>
                  </div>
                  <div className="grid gap-2 text-[11px] sm:grid-cols-2">
                    <RuntimeDetail label="Stage" value={getStageLabel(loadStage)} />
                    <RuntimeDetail label="Source" value={getSourceLabel(loadSource)} />
                    <RuntimeDetail label="Progress" value={getPhaseProgressLabel(loadStage, loadSource)} wide />
                  </div>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => void loadModel().catch(() => undefined)}
              disabled={modelLoading}
              className="shrink-0 rounded-lg border border-blue-500/50 bg-blue-600 px-3 py-2 text-xs font-bold uppercase tracking-wide text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:border-gray-700 disabled:bg-gray-800 disabled:text-gray-500"
            >
              {modelStatus === 'error' ? 'Retry Load' : modelLoading ? 'Loading...' : 'Load Model'}
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        <ContextIndexStatus
          status={rag.status}
          embeddingStatus={rag.embeddingStatus}
          retrievalMode={rag.retrievalMode}
          chunkCount={rag.chunks.length}
          warning={rag.warning}
          error={rag.error}
          phase={rag.phase}
          progress={rag.progress}
          transcriptStatus={transcriptStatus}
          transcriptCount={transcriptCount}
          frameSummaryStatus={frameSummaryStatus}
          frameSummaryCount={frameSummaryCount}
          canBuildIndex={canBuildIndex}
          onBuildIndex={() => void buildIndex()}
        />

        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-2">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mb-2 opacity-50"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
            <p>Private Multimodal Chat</p>
            <p className="text-xs text-gray-600">
              {modelReady ? 'Drag files or text into the machine directly.' : 'Load Gemma before sending prompts or attachments.'}
            </p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div className={`max-w-[80%] p-3 rounded-2xl text-sm break-words whitespace-pre-wrap shadow-sm ${
              m.role === 'user'
                ? 'bg-blue-600 text-white rounded-tr-none'
                : 'bg-gray-800 text-gray-200 rounded-tl-none border border-gray-700'
            }`}>
              {m.content || (m.role === 'ai' && <span className="animate-pulse text-gray-500 font-bold tracking-widest">. . .</span>)}
            </div>

            {m.metrics && (
              <div className="mt-1 flex items-center gap-2 text-[10px] uppercase font-bold text-gray-500 pl-1 animate-fade-in">
                <span>⚡ {m.metrics.tps} TPS</span>
                <span>•</span>
                <span>⏱ {m.metrics.time}s</span>
                {m.metrics.memory && m.metrics.memory !== 'Not supported' && (
                  <>
                    <span>•</span>
                    <span>💾 {m.metrics.memory.used}</span>
                  </>
                )}
              </div>
            )}

            {m.citations && m.citations.length > 0 && (
              <div className="mt-2 flex max-w-[80%] flex-wrap gap-2">
                {m.citations.map((citation, index) => (
                  <button
                    key={citation.id}
                    type="button"
                    onClick={() => seekMedia(citation.startTime)}
                    className="rounded-md border border-gray-700 bg-gray-900 px-2 py-1 font-mono text-[10px] text-blue-300 transition-colors hover:border-blue-500 hover:bg-blue-500/10"
                    title={citation.text}
                  >
                    [{index + 1}] {citation.source === 'frame-summary'
                      ? `${formatTime(citation.startTime)} frame`
                      : `${formatTime(citation.startTime)}-${formatTime(citation.endTime)}`}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {attachments.length > 0 && (
        <div className="p-4 bg-gray-950 border-t border-gray-800 flex gap-3 overflow-x-auto shrink-0">
          {attachments.map((att, i) => (
            <div key={i} className="relative group shrink-0">
              {att.type === 'image' ? (
                <img src={att.previewUrl} className="h-16 w-16 object-cover rounded-lg border border-gray-700" alt="attachment" />
              ) : (
                <div className="h-16 w-16 bg-gray-800 rounded-lg border border-gray-700 flex flex-col items-center justify-center p-2 text-center text-gray-400">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-1"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                  <span className="text-[9px] break-all line-clamp-1">{att.file.name.substring(0, 8)}..</span>
                </div>
              )}
              <button
                onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))}
                className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 shadow-md"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="p-4 bg-gray-800/30 border-t border-gray-800 shrink-0">
        <div className="flex gap-2">
          <label className={`p-3 border border-gray-700 rounded-xl transition-all flex items-center justify-center group shrink-0 shadow-sm ${
            modelReady
              ? 'cursor-pointer bg-gray-800 text-gray-400 hover:bg-gray-700 hover:border-gray-600 hover:text-white'
              : 'cursor-not-allowed bg-gray-900 text-gray-700'
          }`}>
            <input type="file" multiple className="hidden" onChange={handleFileSelect} accept="image/*,.txt,.md,.csv,.json,.rtf" disabled={!modelReady} />
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:scale-110 transition-transform"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
          </label>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            disabled={!modelReady}
            placeholder={modelReady ? 'Ask Gemma something or attach files...' : 'Load Gemma to start chatting'}
            className="flex-1 bg-gray-950 border border-gray-700 rounded-xl px-4 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:text-gray-600 transition-colors shadow-inner"
          />
          <button
            onClick={handleSend}
            disabled={busy || !modelReady}
            className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50 transition-colors shadow-md shrink-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
          </button>
        </div>
      </div>
    </div>
  )
}

function buildGroundedPrompt(userPrompt: string, retrievedChunks: RagRetrievedChunk[]) {
  if (!retrievedChunks.length) return userPrompt

  return [
    'Answer the user question using the retrieved local media context below.',
    'Use the provided citation numbers and timestamp ranges when evidence supports the answer.',
    'If the retrieved context is insufficient, say what is missing instead of guessing.',
    '',
    'Retrieved context:',
    formatRagContext(retrievedChunks),
    '',
    `Question: ${userPrompt}`,
  ].join('\n')
}

function seekMedia(time: number) {
  window.dispatchEvent(new CustomEvent('clipmind:seek-media', { detail: { time } }))
}

const ContextIndexStatus = ({
  status,
  embeddingStatus,
  retrievalMode,
  chunkCount,
  warning,
  error,
  phase,
  progress,
  transcriptStatus,
  transcriptCount,
  frameSummaryStatus,
  frameSummaryCount,
  canBuildIndex,
  onBuildIndex,
}: {
  status: string
  embeddingStatus: string
  retrievalMode: string
  chunkCount: number
  warning: string | null
  error: string | null
  phase: string | null
  progress: number
  transcriptStatus: string
  transcriptCount: number
  frameSummaryStatus: string
  frameSummaryCount: number
  canBuildIndex: boolean
  onBuildIndex: () => void
}) => {
  const waiting = status === 'idle'
  const ready = status === 'ready'
  const indexing = status === 'indexing'
  const hasTranscript = transcriptCount > 0
  const hasFrameSummaries = frameSummaryCount > 0
  const canStartIndex = canBuildIndex || hasTranscript || hasFrameSummaries
  const title = waiting
    ? 'Context index: waiting for transcript or frame summaries'
    : ready
      ? `Context index: ${chunkCount} chunks ready`
      : `Context index: ${phase ?? status}`
  const detail = waiting
    ? getWaitingContextMessage(transcriptStatus, hasTranscript, frameSummaryStatus, hasFrameSummaries)
    : ready
      ? `${transcriptCount} transcript segments and ${frameSummaryCount} frame summaries are available for timestamped retrieval.`
      : phase ?? 'Preparing timestamped retrieval context.'
  const dotClass = status === 'error'
    ? 'bg-red-500'
    : ready
      ? 'bg-green-500'
      : indexing
        ? 'bg-cyan-400 animate-pulse'
        : 'bg-gray-500'

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-950/70 px-3 py-3 text-xs text-gray-500">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${dotClass}`} />
            <span className="font-semibold text-gray-300">{title}</span>
          </div>
          <p className="mt-1 leading-5 text-gray-500">{detail}</p>
        </div>
        <span className="shrink-0 rounded-md border border-gray-800 bg-gray-900 px-2 py-1 font-bold uppercase tracking-wide text-gray-500">
          {getRetrievalLabel(retrievalMode, embeddingStatus)}
        </span>
      </div>
      {!indexing && canStartIndex && (
        <button
          type="button"
          onClick={onBuildIndex}
          className="mt-3 w-full rounded-lg border border-cyan-500/40 bg-cyan-600 px-3 py-2 text-xs font-bold uppercase tracking-wide text-white transition-colors hover:bg-cyan-500 disabled:cursor-not-allowed disabled:border-gray-700 disabled:bg-gray-800 disabled:text-gray-500"
        >
          {ready ? 'Rebuild Context Index' : 'Build Context Index'}
        </button>
      )}
      {status === 'indexing' && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-800">
          <div className="h-full bg-cyan-500 transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      )}
      {warning && <p className="mt-2 leading-5 text-yellow-200/80">{warning}</p>}
      {error && <p className="mt-2 leading-5 text-red-200/80">{error}</p>}
    </div>
  )
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
    ? 'Frame summaries are currently running.'
    : frameSummaryStatus === 'ready'
      ? 'Frame summaries are ready.'
      : 'Sample and summarize frames to add visual context.'

  return `${transcriptText} ${frameText}`
}
