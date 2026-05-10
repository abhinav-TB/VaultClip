import { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import { GemmaChat } from './components/GemmaChat'
import { ModelRuntimeStatus } from './components/ModelRuntimeStatus'
import { SettingsModal } from './components/SettingsModal'
import { VideoUploadPanel } from './components/VideoUploadPanel'
import { WorkflowStep } from './components/WorkflowStep'
import type { GenerationSettings } from './types/generation'

function App() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [generationSettings, setGenerationSettings] = useState<GenerationSettings>({
    maxNewTokens: 128,
    transcriptMaxNewTokens: 512,
    maxVideoSizeMb: 100,
    maxVideoDurationMinutes: 10,
    audioSampleRate: 16000,
    audioFormat: 'wav',
    transcriptChunkSeconds: 30,
    transcriptOverlapSeconds: 0.1,
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
              aria-label="Open settings"
              title="Settings"
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

      <main className="flex flex-1 flex-col items-center px-6 py-8">
        <Routes>
          <Route
            path="/"
            element={
              <div className="flex w-full max-w-7xl flex-col gap-8">
                <section className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                  <div className="max-w-2xl">
                    <p className="text-xs font-bold uppercase tracking-[0.25em] text-blue-400">Sprint 1 workflow</p>
                    <h2 className="mt-3 text-4xl font-black tracking-tight text-gray-100">Upload a video, then work with it locally.</h2>
                    <p className="mt-3 text-base leading-7 text-gray-500">
                      Select one active video session, verify the preview and metadata, then use Gemma for follow-up analysis.
                    </p>
                  </div>
                  <div className="grid gap-2 text-xs sm:grid-cols-3 lg:w-[520px]">
                    <WorkflowStep active label="1. Select" detail="Choose one file" />
                    <WorkflowStep label="2. Preview" detail="Confirm metadata" />
                    <WorkflowStep label="3. Analyze" detail="Use local AI" />
                  </div>
                </section>
                <section className="grid w-full gap-6 lg:grid-cols-[minmax(0,1.12fr)_minmax(380px,0.88fr)] lg:items-start">
                  <VideoUploadPanel settings={generationSettings} />
                  <GemmaChat settings={generationSettings} />
                </section>
              </div>
            }
          />
        </Routes>
      </main>

      <footer className="p-8 text-center border-t border-gray-900 text-gray-600 text-xs tracking-widest uppercase font-bold">
        Built with Gemma
      </footer>
    </div>
  )
}

export default App
