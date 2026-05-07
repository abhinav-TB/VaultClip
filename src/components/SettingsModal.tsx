import { GenerationSettings } from '../types/generation'
import { clampTokenLimit, clampVideoDurationLimit, clampVideoSizeLimit } from '../lib/format'

export const SettingsModal = ({
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
          <h2 id="settings-title" className="text-sm font-bold text-gray-100">Settings</h2>
          <p className="text-xs text-gray-500">Generation and video budget settings.</p>
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

        <div className="grid gap-4 border-t border-gray-800 pt-5 sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="settings-max-video-size" className="text-sm font-medium text-gray-200">
              Max file size
            </label>
            <div className="flex items-center gap-2">
              <input
                id="settings-max-video-size"
                type="number"
                min="10"
                max="1000"
                step="10"
                value={settings.maxVideoSizeMb}
                onChange={(e) => onChange({ ...settings, maxVideoSizeMb: clampVideoSizeLimit(Number(e.target.value)) })}
                className="w-full rounded-md border border-gray-700 bg-gray-900 px-2 py-1.5 text-right font-mono text-sm text-gray-200 focus:outline-none focus:border-blue-500"
                aria-label="Maximum video file size in megabytes"
              />
              <span className="text-xs font-bold uppercase tracking-wide text-gray-600">MB</span>
            </div>
          </div>
          <div className="space-y-2">
            <label htmlFor="settings-max-video-duration" className="text-sm font-medium text-gray-200">
              Max duration
            </label>
            <div className="flex items-center gap-2">
              <input
                id="settings-max-video-duration"
                type="number"
                min="1"
                max="120"
                step="1"
                value={settings.maxVideoDurationMinutes}
                onChange={(e) => onChange({ ...settings, maxVideoDurationMinutes: clampVideoDurationLimit(Number(e.target.value)) })}
                className="w-full rounded-md border border-gray-700 bg-gray-900 px-2 py-1.5 text-right font-mono text-sm text-gray-200 focus:outline-none focus:border-blue-500"
                aria-label="Maximum video duration in minutes"
              />
              <span className="text-xs font-bold uppercase tracking-wide text-gray-600">min</span>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-800 bg-gray-900/70 p-3 text-xs leading-5 text-gray-500">
          Higher limits allow longer answers and larger videos, but browser processing takes longer and uses more memory.
        </div>
      </div>
    </div>
  </div>
)
