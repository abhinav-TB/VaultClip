import { useState, useEffect } from 'react'
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

interface MemoryPerformance extends Performance {
  memory?: {
    usedJSHeapSize: number
  }
  measureUserAgentSpecificMemory?: () => Promise<{ bytes: number }>
}

const GemmaChat = () => {
  const { startTask } = useWorker()
  const { status } = useAppSelector((state) => state.processing)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; content: string; metrics?: ChatMetrics }[]>([])
  const [attachments, setAttachments] = useState<PreviewAttachment[]>([])

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
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
    if ((!input.trim() && attachments.length === 0) || status !== 'idle' && status !== 'complete') return
    
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
        attachments: payloadAttachments 
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
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-sm font-medium text-gray-300">Gemma-E2B Local AI</span>
        </div>
        <span className="text-xs text-gray-500 uppercase tracking-widest font-bold">WebGPU Powered</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-2">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mb-2 opacity-50"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
            <p>Private Multimodal Chat</p>
            <p className="text-xs text-gray-600">Drag files or text into the machine directly.</p>
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
          <label className="p-3 cursor-pointer bg-gray-800 border border-gray-700 text-gray-400 rounded-xl hover:bg-gray-700 hover:border-gray-600 hover:text-white transition-all flex items-center justify-center group shrink-0 shadow-sm">
             <input type="file" multiple className="hidden" onChange={handleFileSelect} accept="image/*,.txt,.md,.csv,.json,.rtf" />
             <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:scale-110 transition-transform"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
          </label>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask Gemma something or attach files..."
            className="flex-1 bg-gray-950 border border-gray-700 rounded-xl px-4 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500 transition-colors shadow-inner"
          />
          <button
            onClick={handleSend}
            disabled={status !== 'idle' && status !== 'complete'}
            className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-500 disabled:opacity-50 transition-colors shadow-md shrink-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
          </button>
        </div>
      </div>
    </div>
  )
}

const LiveMemory = () => {
  const [memory, setMemory] = useState<string>('...');

  useEffect(() => {
    let isMounted = true;
    
    const updateMemory = async () => {
      // Attempt the advanced cross-origin API first (This correctly aggregates Worker + Main Thread memory!)
      if ('measureUserAgentSpecificMemory' in performance) {
        try {
          const result = await (performance as MemoryPerformance).measureUserAgentSpecificMemory?.();
          if (!result) return;
          if (isMounted) setMemory(`${Math.round(result.bytes / (1024 * 1024))} MB`);
          return;
        } catch {
          // If it fails (e.g. rate limited or contexts block), fall through to basic.
        }
      }
      
      // Basic fallback to the Main Thread's JS Heap
      const mem = (performance as MemoryPerformance).memory;
      if (mem && isMounted) {
        setMemory(`${Math.round(mem.usedJSHeapSize / (1024 * 1024))} MB (Main)`);
      } else if (isMounted) {
        setMemory('N/A');
      }
    };

    updateMemory();
    const int = setInterval(updateMemory, 3000); // 3 second tick
    return () => { isMounted = false; clearInterval(int); };
  }, []);

  return (
    <span className="flex items-center gap-1.5 px-3 py-1 bg-gray-800 text-blue-400 rounded-full border border-gray-700 font-mono text-[10px] uppercase font-bold tracking-wider shadow-inner">
      💾 SYS_RAM: {memory}
    </span>
  );
};

function App() {
  return (
    <div className="flex min-h-screen flex-col bg-gray-950 text-gray-100 font-sans selection:bg-blue-500/30">
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-md sticky top-0 z-10 p-4">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <h1 className="bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-2xl font-black text-transparent tracking-tighter">
            CLIP MIND
          </h1>
          <div className="flex items-center gap-4 text-xs font-medium text-gray-500">
            <LiveMemory />
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              LOCAL ENGINE READY
            </span>
          </div>
        </div>
      </header>

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
                  <GemmaChat />
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
