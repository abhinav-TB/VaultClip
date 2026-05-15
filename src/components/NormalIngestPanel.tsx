import type { ModelStatus } from '../store/slices/modelSlice'

interface NormalIngestPanelProps {
  modelStatus: ModelStatus
  modelProgress: number
  modelError: string | null
  buildRunning: boolean
  buildPhase: string
  buildProgress: number
  buildError: string | null
  ragReady: boolean
  audioOnlyIndex: boolean
  audioOnlyLocked: boolean
  onAudioOnlyIndexChange: (value: boolean) => void
  onLoadModel: () => void
  onBuildIndex: () => void
}

export const NormalIngestPanel = ({
  modelStatus,
  modelProgress,
  modelError,
  buildRunning,
  buildPhase,
  buildProgress,
  buildError,
  ragReady,
  audioOnlyIndex,
  audioOnlyLocked,
  onAudioOnlyIndexChange,
  onLoadModel,
  onBuildIndex,
}: NormalIngestPanelProps) => {
  const modelReady = modelStatus === 'ready'
  const modelLoading = modelStatus === 'loading'
  const primaryLabel = modelReady ? 'Build Index' : modelLoading ? 'Loading Model...' : modelStatus === 'error' ? 'Retry Load Model' : 'Load Model'
  const primaryAction = modelReady ? onBuildIndex : onLoadModel
  const disabled = modelLoading || buildRunning || ragReady

  return (
    <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wide text-blue-300">Next step</p>
          <h3 className="mt-1 text-xl font-bold text-gray-100">{getTitle(modelStatus, buildRunning, ragReady)}</h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100/70">
            {getDetail(modelStatus, buildRunning, ragReady)}
          </p>
        </div>
        {!ragReady && (
          <button
            type="button"
            onClick={primaryAction}
            disabled={disabled}
            className="shrink-0 rounded-lg border border-blue-500/50 bg-blue-600 px-5 py-3 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:border-gray-700 disabled:bg-gray-800 disabled:text-gray-500"
          >
            {primaryLabel}
          </button>
        )}
      </div>

      {!ragReady && modelReady && (
        <label className={`mt-4 flex items-center justify-between gap-4 rounded-lg border px-4 py-3 text-sm ${
          audioOnlyIndex
            ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-50'
            : 'border-gray-800 bg-gray-950/50 text-gray-300'
        }`}>
          <span className="min-w-0">
            <span className="block font-semibold">Audio-only index</span>
            <span className="mt-1 block text-xs leading-5 text-gray-500">
              {audioOnlyLocked
                ? 'Audio files always use transcript-only indexing.'
                : 'Skip visual frame summaries and build the index from the transcript only.'}
            </span>
          </span>
          <input
            type="checkbox"
            checked={audioOnlyIndex}
            disabled={audioOnlyLocked || buildRunning}
            onChange={(event) => onAudioOnlyIndexChange(event.target.checked)}
            className="h-5 w-5 shrink-0 rounded border-gray-700 bg-gray-950 text-cyan-500 focus:ring-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
          />
        </label>
      )}

      {(modelLoading || buildRunning) && (
        <ProgressBar
          progress={buildRunning ? buildProgress : modelProgress}
          phase={buildRunning ? buildPhase : 'Loading local model'}
          colorClass={buildRunning ? 'bg-cyan-500' : 'bg-blue-500'}
        />
      )}

      {(modelError || buildError) && (
        <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-100">
          {buildError ?? modelError}
        </div>
      )}
    </div>
  )
}

function getTitle(modelStatus: ModelStatus, buildRunning: boolean, ragReady: boolean) {
  if (ragReady) return 'Context is ready'
  if (buildRunning) return 'Building searchable context'
  if (modelStatus === 'ready') return 'Create the searchable index'
  return 'Load the local model'
}

function getDetail(modelStatus: ModelStatus, buildRunning: boolean, ragReady: boolean) {
  if (ragReady) return 'The recording is ready for grounded chat with timestamped citations.'
  if (buildRunning) return 'Clip Mind is preparing the transcript, optional visual context, and retrieval index for this recording.'
  if (modelStatus === 'ready') return 'The local model is ready. Build the index to unlock grounded chat for this recording.'
  return 'The model runs locally in your browser. Load it once before building the index.'
}

const ProgressBar = ({ progress, phase, colorClass }: { progress: number; phase: string; colorClass: string }) => (
  <div className="mt-4 space-y-2">
    <div className="flex items-center gap-3">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-800">
        <div className={`h-full transition-all duration-500 ${colorClass}`} style={{ width: `${progress}%` }} />
      </div>
      <span className="w-10 text-right font-mono text-xs text-gray-400">{progress}%</span>
    </div>
    <p className="text-xs text-gray-500">{phase}</p>
  </div>
)
