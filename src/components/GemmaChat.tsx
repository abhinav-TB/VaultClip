import { useState } from 'react'
import { useAppSelector } from '../store/hooks'
import { useWorker } from '../store/hooks/useWorker'
import type { GenerationSettings } from '../types/generation'
import { getLoadingMessage, getPhaseProgressLabel, getSourceLabel, getStageLabel } from '../lib/modelRuntime'
import { RuntimeDetail } from './RuntimeDetail'

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

export const GemmaChat = ({ settings }: { settings: GenerationSettings }) => {
  const { startTask, loadModel } = useWorker()
  const { status: processingStatus } = useAppSelector((state) => state.processing)
  const {
    status: modelStatus,
    error: modelError,
    progress: modelProgress,
    loadStage,
    loadSource,
  } = useAppSelector((state) => state.model)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; content: string; metrics?: ChatMetrics }[]>([])
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

    setInput('')
    setAttachments([])

    setMessages(prev => [
      ...prev,
      { role: 'user', content: userMsg || `[Sent ${payloadAttachments.length} Attachments]` },
      { role: 'ai', content: '' },
    ])

    try {
      const response = await startTask<ChatResponse>('CHALLENGE_RESPONSE', {
        prompt: userMsg || 'Please analyze the attached files.',
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
