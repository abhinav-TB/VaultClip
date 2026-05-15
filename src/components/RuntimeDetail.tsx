export const RuntimeDetail = ({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) => (
  <div className={wide ? 'min-w-0 sm:col-span-2' : 'min-w-0'}>
    <div className="text-[10px] font-bold uppercase tracking-wide text-slate-600">{label}</div>
    <div className="truncate font-mono text-[11px] text-slate-300" title={value}>
      {value}
    </div>
  </div>
)
