export default function MajorRouteNavigator({ steps = [], stepsData, activeKey, onSelect }) {
  return (
    <nav aria-label="Fasi del progetto" className="mb-5 flex flex-wrap gap-2 rounded-xl border border-gray-200 bg-white p-2 shadow-sm">
      {steps.map(step => {
        const complete = stepsData?.[step.step_id]?.stato === 'completato'
        const active = activeKey === step.step_id
        const tone = active
          ? 'border-primary bg-primary text-white shadow-md'
          : complete
            ? 'border-emerald-200 bg-emerald-50 text-emerald-900 hover:border-emerald-400 hover:bg-emerald-100'
            : 'border-gray-200 bg-white text-gray-700 hover:border-primary hover:bg-amber-50 hover:text-primary'
        return (
          <button key={step.step_id} type="button" onClick={() => onSelect(step.step_id)} aria-current={active ? 'step' : undefined}
            className={`flex min-h-[48px] min-w-0 items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${tone}`}>
            <span aria-hidden="true" className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${active ? 'bg-white/20 text-white' : complete ? 'bg-emerald-200 text-emerald-900' : 'bg-gray-100 text-gray-600'}`}>{step.ordine}</span>
            <span className="min-w-0 break-words">{step.titolo}</span>
            {complete && <><span aria-hidden="true" className={`ml-1 text-sm ${active ? 'text-white' : 'text-emerald-700'}`}>✓</span><span className="sr-only"> completato</span></>}
          </button>
        )
      })}
    </nav>
  )
}
