export type WorkflowStepState = 'complete' | 'active' | 'blocked' | 'pending'

export const WorkflowStep = ({
  state = 'pending',
  label,
  detail,
}: {
  state?: WorkflowStepState
  label: string
  detail: string
}) => {
  const stateClass = {
    complete: 'border-green-500/30 bg-green-500/10',
    active: 'border-purple-500/40 bg-purple-500/10',
    blocked: 'border-amber-500/30 bg-amber-500/10',
    pending: 'border-slate-800 bg-slate-900/70',
  }[state]
  const dotClass = {
    complete: 'bg-green-400',
    active: 'bg-purple-400',
    blocked: 'bg-amber-400',
    pending: 'bg-slate-600',
  }[state]
  const labelClass = {
    complete: 'text-green-100',
    active: 'text-purple-100',
    blocked: 'text-amber-100',
    pending: 'text-slate-300',
  }[state]

  return (
    <div className={`min-w-0 rounded-lg border px-3 py-3 ${stateClass}`}>
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 shrink-0 rounded-full ${dotClass}`} />
        <div className={`truncate font-bold ${labelClass}`}>{label}</div>
      </div>
      <div className="mt-1 truncate text-slate-500" title={detail}>{detail}</div>
    </div>
  )
}
