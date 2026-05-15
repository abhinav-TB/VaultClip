import type { GenerationSettings } from '../types/generation'

export const ExperienceModeSection = ({
  settings,
  onChange,
}: {
  settings: GenerationSettings
  onChange: (settings: GenerationSettings) => void
}) => (
  <div className="grid gap-2 rounded-lg border border-slate-800 bg-slate-900/60 p-1 text-xs font-bold sm:grid-cols-2">
    <ExperienceModeButton
      active={settings.experienceMode === 'normal'}
      title="Normal"
      description="Upload, load model, build index, chat"
      onClick={() => onChange({ ...settings, experienceMode: 'normal' })}
    />
    <ExperienceModeButton
      active={settings.experienceMode === 'power'}
      title="Power User"
      description="Show audio, transcript, frames, and index controls"
      onClick={() => onChange({ ...settings, experienceMode: 'power' })}
    />
  </div>
)

const ExperienceModeButton = ({
  active,
  title,
  description,
  onClick,
}: {
  active: boolean
  title: string
  description: string
  onClick: () => void
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`rounded-md px-3 py-2 text-left transition-colors ${
      active
        ? 'border border-purple-500/40 bg-purple-500/15 text-purple-100'
        : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'
    }`}
  >
    {title}
    <span className="mt-1 block text-[10px] font-medium leading-4 text-slate-500">{description}</span>
  </button>
)
