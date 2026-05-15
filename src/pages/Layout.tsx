import React from 'react'
import { Outlet } from 'react-router-dom'
import { ModelRuntimeStatus } from '../components/ModelRuntimeStatus'
import { SettingsModal } from '../components/SettingsModal'
import type { GenerationSettings } from '../types/generation'

interface AppLayoutProps {
  settings: GenerationSettings
  onSettingsChange: (settings: GenerationSettings) => void
  settingsOpen: boolean
  onSettingsClose: () => void
}

export function AppLayout({ settings, onSettingsChange, settingsOpen, onSettingsClose }: AppLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-900 font-sans text-slate-100 selection:bg-blue-500/30">
      <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-900/90 p-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-600/20 border border-purple-500/30">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-400">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none" />
              </svg>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white">
              Vault<span className="gradient-text">Clip</span>
            </h1>
          </div>
          <div className="flex items-center gap-3 text-xs font-medium text-slate-500">
            <ModelRuntimeStatus />
            <button
              type="button"
              onClick={onSettingsClose}
              className="rounded-lg border border-slate-700 bg-slate-900 p-2 text-slate-400 transition-colors hover:border-slate-600 hover:bg-slate-800 hover:text-white"
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
      <main className="flex flex-1 flex-col">
        <Outlet />
      </main>
      <footer className="border-t border-slate-800 p-6 text-center text-xs font-bold uppercase tracking-wide text-slate-500">
        Built with Gemma
      </footer>
      {settingsOpen && (
        <SettingsModal
          settings={settings}
          onChange={onSettingsChange}
          onClose={onSettingsClose}
        />
      )}
    </div>
  )
}

export function LandingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-900">
      {children}
    </div>
  )
}