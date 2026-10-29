export default function MajorRouteNavigator({ steps = [], stepsData, activeKey, onSelect }) {
  return (
    <nav aria-label="Fasi del progetto" className="mb-5 flex gap-1 overflow-x-auto border-b border-gray-200">
      {steps.map(step => {
        const complete = stepsData?.[step.step_id]?.stato === 'completato'
        const active = activeKey === step.step_id
        return (
          <button key={step.step_id} type="button" onClick={() => onSelect(step.step_id)} aria-current={active ? 'step' : undefined}
            className={`shrink-0 border-b-2 px-3 py-3 text-sm ${active ? 'border-primary font-semibold text-primary' : 'border-transparent text-gray-600 hover:text-gray-900'}`}>
            <span className={complete ? 'text-green-700' : ''}>{step.ordine}. {step.titolo}</span>
            {complete && <span className="sr-only"> completato</span>}
          </button>
        )
      })}
    </nav>
  )
}
