import type { GenerationSettings } from '../types/generation'

const DEFAULT_EMBEDDING_MODEL = 'onnx-community/all-MiniLM-L6-v2-ONNX'

interface RagSettingsSectionProps {
  settings: GenerationSettings
  onChange: (settings: GenerationSettings) => void
}

/** Retrieval controls for timestamped media Q&A. */
export const RagSettingsSection = ({ settings, onChange }: RagSettingsSectionProps) => (
  <div className="space-y-4">
    <div className="grid gap-2 rounded-lg border border-gray-800 bg-gray-900/60 p-1 text-xs font-bold sm:grid-cols-2">
      <RetrievalModeButton
        active={settings.retrievalMode === 'hybrid'}
        title="Hybrid"
        description="Lexical + local embeddings"
        onClick={() => onChange({ ...settings, retrievalMode: 'hybrid' })}
      />
      <RetrievalModeButton
        active={settings.retrievalMode === 'lexical'}
        title="Lexical only"
        description="No embedding model"
        onClick={() => onChange({ ...settings, retrievalMode: 'lexical' })}
      />
    </div>

    <div className="space-y-2">
      <label htmlFor="settings-embedding-model" className="text-sm font-medium text-gray-200">
        Embedding model
      </label>
      <input
        id="settings-embedding-model"
        type="text"
        value={settings.embeddingModelId}
        onChange={(event) => onChange({ ...settings, embeddingModelId: event.target.value })}
        onBlur={(event) => {
          const modelId = event.target.value.trim() || DEFAULT_EMBEDDING_MODEL
          onChange({ ...settings, embeddingModelId: modelId })
        }}
        className="w-full rounded-md border border-gray-700 bg-gray-900 px-2 py-1.5 font-mono text-xs text-gray-200 focus:outline-none focus:border-blue-500"
      />
      <p className="text-xs leading-5 text-gray-500">
        Default: {DEFAULT_EMBEDDING_MODEL}. Custom models must support Transformers.js feature extraction or sentence embeddings.
      </p>
    </div>
  </div>
)

const RetrievalModeButton = ({
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
    <span className="mt-1 block text-[10px] font-medium text-gray-500">{description}</span>
  </button>
)
