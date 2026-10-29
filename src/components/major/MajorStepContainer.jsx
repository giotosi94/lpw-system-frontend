import { useState } from 'react'
import { getStepComponent } from './componentRegistry'

export default function MajorStepContainer({
  step,
  stepData,
  onSaveStep,
  onApproveGate,
  allStepsData = {},
  major = null,
}) {
  const [completing, setCompleting] = useState(false)
  const StepComponent = getStepComponent(step.componente)
  const sd = stepData || {}
  const completed = sd.stato === 'completato'

  const completeStep = async () => {
    if (completing || completed || !onApproveGate) return
    setCompleting(true)
    try {
      await onApproveGate()
    } finally {
      setCompleting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="border-b border-gray-200 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-gray-800">
              {step.ordine}. {step.titolo}
            </h2>
            {step.obiettivo && (
              <p className="mt-2 text-sm text-gray-700 whitespace-pre-line">
                {step.obiettivo}
              </p>
            )}
            {step.istruzioni && step.istruzioni !== step.obiettivo && (
              <p className="mt-2 text-sm text-gray-600 whitespace-pre-line">
                {step.istruzioni}
              </p>
            )}
          </div>
          <span className={`shrink-0 text-xs ${completed ? 'text-green-700' : 'text-gray-500'}`}>
            {completed ? 'Completato' : sd.stato === 'in_corso' ? 'In corso' : 'Non iniziato'}
          </span>
        </div>
      </div>

      <StepComponent
        step={step}
        stepData={sd}
        allStepsData={allStepsData}
        major={major}
        onChange={changes => onSaveStep({
          ...changes,
          stato: completed ? 'completato' : 'in_corso',
        })}
      />

      <div className="flex justify-end border-t border-gray-200 pt-4">
        {completed ? (
          <span className="text-sm text-green-700">Fase completata</span>
        ) : (
          <button
            type="button"
            onClick={completeStep}
            disabled={completing || !onApproveGate}
            className="rounded-lg bg-primary px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
          >
            {completing ? 'Completamento...' : 'Completa fase'}
          </button>
        )}
      </div>
    </div>
  )
}
