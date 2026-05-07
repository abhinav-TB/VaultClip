export const WorkflowStep = ({ active = false, label, detail }: { active?: boolean; label: string; detail: string }) => (
  <div className={`rounded-xl border px-3 py-3 ${active ? 'border-blue-500/40 bg-blue-500/10' : 'border-gray-800 bg-gray-900/70'}`}>
    <div className={active ? 'font-bold text-blue-200' : 'font-bold text-gray-300'}>{label}</div>
    <div className="mt-1 text-gray-500">{detail}</div>
  </div>
)
