import type { GenerationSettings } from '../types/generation'

export const ExperienceModeSection = ({
  settings,
  onChange,
}: {
  settings: GenerationSettings
  onChange: (settings: GenerationSettings) => void
}) => (
  <div className="grid gap-2 rounded-lg border border-gray-800 bg-gray-900/60 p-1 text-xs font-bold sm:grid-cols-2">
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
        ? 'border border-blue-500/40 bg-blue-500/15 text-blue-100'
        : 'text-gray-500 hover:bg-gray-800 hover:text-gray-300'
    }`}
  >
    {title}
    <span className="mt-1 block text-[10px] font-medium leading-4 text-gray-500">{description}</span>
  </button>
)
