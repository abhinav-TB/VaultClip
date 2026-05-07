import { useAppSelector } from '../store/hooks'
import { getSourceLabel, getStageLabel } from '../lib/modelRuntime'

export const ModelRuntimeStatus = () => {
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
    </div>
  )
}
