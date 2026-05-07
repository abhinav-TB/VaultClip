import { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import { useAppSelector } from './store/hooks'
import { useWorker } from './store/hooks/useWorker'


interface PreviewAttachment {
  file: File;
  type: 'image' | 'text';
  previewUrl: string;
  content: string; 
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

interface GenerationSettings {
  maxNewTokens: number
}

const GemmaChat = ({ settings }: { settings: GenerationSettings }) => {
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
    if (!modelReady || !e.target.files) return;
    const files = Array.from(e.target.files);
    
    for (const file of files) {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          setAttachments(prev => [...prev, {
            file,
            type: 'image',
            previewUrl: URL.createObjectURL(file), // Free objectUrl later to avoid mem leaks in prod
            content: event.target?.result as string
          }])
        };
        reader.readAsDataURL(file);
      } else if (file.type.startsWith('text/') || file.name.endsWith('.csv') || file.name.endsWith('.md') || file.name.endsWith('.json')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          setAttachments(prev => [...prev, {
            file,
            type: 'text',
            previewUrl: '',
            content: event.target?.result as string
          }])
        };
        reader.readAsText(file);
      } else {
        alert(`Raw parsing for ${file.name} is not supported. Please use images or text docs.`);
      }
    }
    e.target.value = ''; // Reset the input natively
  }

  const handleSend = async () => {
    if ((!input.trim() && attachments.length === 0) || busy || !modelReady) return
    
    const userMsg = input;
    const payloadAttachments = attachments.map(a => ({ type: a.type, data: a.content, name: a.file.name }));
    
    setInput('');
    setAttachments([]);
    
    setMessages(prev => [
      ...prev, 
      { role: 'user', content: userMsg || `[Sent ${payloadAttachments.length} Attachments]` },
      { role: 'ai', content: '' }
    ])
    
    try {
      const response = await startTask<ChatResponse>('CHALLENGE_RESPONSE', { 
        prompt: userMsg || "Please analyze the attached files.", 
        attachments: payloadAttachments,
        maxNewTokens: settings.maxNewTokens,
      }, (log) => {
        if (log.startsWith('[STREAM]')) {
          const chunk = log.replace('[STREAM]', '')
          setMessages(prev => {
             const newArr = [...prev]
             const lastIdx = newArr.length - 1
             if(newArr[lastIdx].role === 'ai') {
               newArr[lastIdx] = { ...newArr[lastIdx], content: newArr[lastIdx].content + chunk }
             }
             return newArr
          })
        }
      })
      
      setMessages(prev => {
        const newArr = [...prev]
        const lastIdx = newArr.length - 1
        if(newArr[lastIdx].role === 'ai') {
           newArr[lastIdx] = { 
             role: 'ai', 
             content: response.text, 
             metrics: response.metrics 
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
    <div className="flex flex-col h-[600px] w-full max-w-2xl bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden shadow-2xl">
      {/* Header */}
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

      {/* Messages */}
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

      {/* Attachment Previews */}
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

      {/* Input */}
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

const ModelRuntimeStatus = () => {
  const { loadModel } = useWorker()
  const { status, error, loadStage, loadSource } = useAppSelector((state) => state.model)

  const stateStyles = {
    idle: {
      dot: 'bg-gray-500',
      label: 'MODEL NOT LOADED',
      text: 'Load Gemma before using chat.',
    },
    loading: {
      dot: 'bg-yellow-400 animate-pulse',
      label: 'MODEL LOADING',
      text: `${getStageLabel(loadStage)} via ${getSourceLabel(loadSource)}`,
    },
    ready: {
      dot: 'bg-green-500',
      label: 'MODEL READY',
      text: 'Chat and uploads enabled.',
    },
    error: {
      dot: 'bg-red-500',
      label: 'MODEL FAILED',
      text: error || 'Load failed without a worker error message.',
    },
  }[status]

  return (
    <div className="flex min-w-0 items-center gap-3 rounded-lg border border-gray-800 bg-gray-950 px-3 py-2">
      <span className={`h-2 w-2 shrink-0 rounded-full ${stateStyles.dot}`} />
      <div className="min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-300">{stateStyles.label}</div>
        <div className="max-w-[180px] truncate text-[11px] text-gray-500" title={stateStyles.text}>
          {stateStyles.text}
        </div>
      </div>
      {(status === 'idle' || status === 'error') && (
        <button
          type="button"
          onClick={() => void loadModel().catch(() => undefined)}
          className="rounded-md border border-blue-500/50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-blue-300 transition-colors hover:bg-blue-500/10"
        >
          {status === 'error' ? 'Retry' : 'Load'}
        </button>
      )}
    </div>
  )
}

const SettingsModal = ({
  settings,
  onChange,
  onClose,
}: {
  settings: GenerationSettings
  onChange: (settings: GenerationSettings) => void
  onClose: () => void
}) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="settings-title">
    <div className="w-full max-w-md overflow-hidden rounded-xl border border-gray-800 bg-gray-950 shadow-2xl">
      <div className="flex items-center justify-between border-b border-gray-800 bg-gray-900 px-5 py-4">
        <div>
          <h2 id="settings-title" className="text-sm font-bold text-gray-100">Model Settings</h2>
          <p className="text-xs text-gray-500">Generation settings apply to the next message.</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-gray-700 p-2 text-gray-400 transition-colors hover:border-gray-600 hover:bg-gray-800 hover:text-white"
          aria-label="Close settings"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="space-y-5 p-5">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <label htmlFor="settings-max-new-tokens" className="text-sm font-medium text-gray-200">
              Output length
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="32"
                max="1024"
                step="32"
                value={settings.maxNewTokens}
                onChange={(e) => onChange({ ...settings, maxNewTokens: clampTokenLimit(Number(e.target.value)) })}
                className="w-24 rounded-md border border-gray-700 bg-gray-900 px-2 py-1.5 text-right font-mono text-sm text-gray-200 focus:outline-none focus:border-blue-500"
                aria-label="Maximum output tokens"
              />
              <span className="text-xs font-bold uppercase tracking-wide text-gray-600">tokens</span>
            </div>
          </div>
          <input
            id="settings-max-new-tokens"
            type="range"
            min="32"
            max="1024"
            step="32"
            value={settings.maxNewTokens}
            onChange={(e) => onChange({ ...settings, maxNewTokens: Number(e.target.value) })}
            className="h-2 w-full cursor-pointer accent-blue-500"
          />
          <div className="flex justify-between text-[10px] font-bold uppercase tracking-wide text-gray-600">
            <span>Short</span>
            <span>Balanced</span>
            <span>Long</span>
          </div>
        </div>

        <div className="rounded-lg border border-gray-800 bg-gray-900/70 p-3 text-xs leading-5 text-gray-500">
          Higher limits allow longer answers, but generation takes longer and uses more memory while tokens are being produced.
        </div>
      </div>
    </div>
  </div>
)

const RuntimeDetail = ({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) => (
  <div className={wide ? 'min-w-0 sm:col-span-2' : 'min-w-0'}>
    <div className="text-[10px] font-bold uppercase tracking-wide text-gray-600">{label}</div>
    <div className="truncate font-mono text-[11px] text-gray-300" title={value}>
      {value}
    </div>
  </div>
)

function getSourceLabel(source: string) {
  if (source === 'cache') return 'Browser cache'
  if (source === 'network') return 'Hugging Face'
  if (source === 'memory') return 'Worker memory'
  return 'Checking'
}

function getStageLabel(stage: string) {
  if (stage === 'checking-cache') return 'Checking cache'
  if (stage === 'loading-cache') return 'Reading cached file'
  if (stage === 'downloading') return 'Downloading model file'
  if (stage === 'initializing') return 'Initializing WebGPU'
  if (stage === 'ready') return 'Ready'
  if (stage === 'failed') return 'Failed'
  return 'Not loaded'
}

function getLoadingMessage(stage: string, source: string) {
  if (stage === 'checking-cache') return 'Checking whether Gemma is already stored in this browser.'
  if (stage === 'loading-cache') return 'Loading Gemma from browser cache. Chat will unlock when WebGPU initialization finishes.'
  if (stage === 'downloading') return 'Downloading Gemma model files from Hugging Face, then caching them for future launches.'
  if (stage === 'initializing') return 'Model files are ready. Initializing Gemma on WebGPU.'
  return `Preparing Gemma using ${getSourceLabel(source).toLowerCase()}.`
}

function getPhaseProgressLabel(stage: string, source: string) {
  if (stage === 'checking-cache') return 'Looking for existing browser storage'
  if (stage === 'loading-cache') return 'Using cached model files'
  if (stage === 'downloading') return 'Fetching model files and saving them locally'
  if (stage === 'initializing') return 'Preparing WebGPU inference session'
  return `Preparing with ${getSourceLabel(source).toLowerCase()}`
}

function clampTokenLimit(value: number) {
  if (!Number.isFinite(value)) return 128
  return Math.max(32, Math.min(1024, Math.round(value / 32) * 32))
}

function App() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [generationSettings, setGenerationSettings] = useState<GenerationSettings>({
    maxNewTokens: 128,
  })

  return (
    <div className="flex min-h-screen flex-col bg-gray-950 text-gray-100 font-sans selection:bg-blue-500/30">
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-md sticky top-0 z-10 p-4">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <h1 className="bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-2xl font-black text-transparent tracking-tighter">
            CLIP MIND
          </h1>
          <div className="flex items-center gap-4 text-xs font-medium text-gray-500">
            <ModelRuntimeStatus />
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="rounded-lg border border-gray-800 bg-gray-950 p-2 text-gray-400 transition-colors hover:border-gray-700 hover:bg-gray-900 hover:text-white"
              aria-label="Open model settings"
              title="Model settings"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.51a2 2 0 0 1 1-1.72l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {settingsOpen && (
        <SettingsModal
          settings={generationSettings}
          onChange={setGenerationSettings}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      <main className="flex flex-1 flex-col items-center p-8 gap-12">
        <Routes>
          <Route
            path="/"
            element={
              <div className="w-full max-w-6xl space-y-16 flex flex-col items-center">
                {/* Chat Section */}
                <section className="w-full flex flex-col items-center gap-8">
                   <div className="text-center space-y-2">
                    <h2 className="text-3xl font-bold tracking-tight">Private Chat</h2>
                    <p className="text-gray-500">Run Gemma-4-E2B multimodal AI directly in your browser. No server, no cloud.</p>
                  </div>
                  <GemmaChat settings={generationSettings} />
                </section>
              </div>
            }
          />
        </Routes>
      </main>

      <footer className="p-8 text-center border-t border-gray-900 text-gray-600 text-xs tracking-widest uppercase font-bold">
        Built with Google DeepMind & WebGPU Technology
      </footer>
    </div>
  )
}

export default App
