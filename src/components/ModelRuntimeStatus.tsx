import { useAppSelector } from '../store/hooks'
import { getSourceLabel, getStageLabel } from '../lib/modelRuntime'
import { useWorker } from '../store/hooks/useWorker'

export const ModelRuntimeStatus = () => {
  const { status, error, loadStage, loadSource, progress } = useAppSelector((state) => state.model)
  const { loadModel } = useWorker()

  const stateStyles = {
    idle: {
      dot: 'bg-slate-500',
      label: 'MODEL NOT LOADED',
      text: 'Click to load Gemma model',
    },
    loading: {
      dot: 'bg-yellow-400 animate-pulse',
      label: 'MODEL LOADING',
      text: `${getStageLabel(loadStage)} via ${getSourceLabel(loadSource)} (${progress}%)`,
    },
    ready: {
      dot: 'bg-green-500',
      label: 'MODEL READY',
      text: 'Chat and uploads enabled.',
    },
    error: {
      dot: 'bg-red-500',
      label: 'MODEL FAILED',
      text: error || 'Load failed',
    },
  }[status]

  const isIdle = status === 'idle'
  const isError = status === 'error'
  const isLoading = status === 'loading'

  return (
    <button
      type="button"
      onClick={() => !isLoading && loadModel().catch(() => undefined)}
      disabled={isLoading}
      className="flex min-w-0 items-center gap-3 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-left hover:border-slate-700 disabled:cursor-wait"
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${stateStyles.dot}`} />
      <div className="min-w-0">
        <div className={`text-[10px] font-bold uppercase tracking-wider ${isError ? 'text-red-400' : isIdle ? 'text-purple-400' : isLoading ? 'text-yellow-400' : 'text-green-400'}`}>
          {stateStyles.label}
        </div>
        <div className="max-w-[180px] truncate text-[11px] text-slate-500" title={stateStyles.text}>
          {stateStyles.text}
        </div>
      </div>
    </button>
  )
}
