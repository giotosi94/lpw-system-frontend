import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import IshikawaDiagram from '../../../kaizen/IshikawaDiagram'
import FiveWhysFlowChart from '../../../kaizen/FiveWhysFlowChart'
import KaizenAzioniList from '../../../kaizen/KaizenAzioniList'
import ActionPlanFormShared from '../../../ActionPlanFormShared'

const SAVE_DELAY = 800
const panel = 'bg-white border border-gray-200 rounded-lg p-4 md:p-5'
const heading = 'bg-primary text-white text-center py-2 rounded-lg font-bold mb-4'
const input = 'w-full min-w-0 border border-gray-300 rounded px-2 py-2 text-sm bg-white'
const STATUS_LABELS = {
  saved: 'Salvato',
  dirty: 'Modifiche da salvare',
  saving: 'Salvataggio...',
  error: 'Errore di salvataggio: le modifiche restano nella pagina',
}

const list = value => (Array.isArray(value) ? value : [])

function createId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `extra_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

function zoneOf(item) {
  return [item.macchina, item.componente].filter(Boolean).join(' · ') || item.zona || item.area_componente || ''
}

function phaseAnomalies(allStepsData, stepId) {
  const result = []
  Object.entries(allStepsData || {}).forEach(([id, step]) => {
    if (id === stepId) return
    list(step?.dati?.anomalie).forEach(item => {
      if (item?.id && (item.descrizione || '').trim()) {
        result.push({ id: item.id, descrizione: item.descrizione.trim(), zona: zoneOf(item), origine: 'Fase 2' })
      }
    })
  })
  return result
}

function buildForm(data) {
  return {
    selezionate: list(data.selezionate),
    analisi: data.analisi && typeof data.analisi === 'object' ? data.analisi : {},
    anomalie_extra: list(data.anomalie_extra),
  }
}

function walkNodes(rami, visit) {
  const walk = node => {
    if (!node) return
    visit(node)
    list(node.children).forEach(walk)
  }
  Object.values(rami || {}).forEach(branch => list(branch).forEach(walk))
}

function causeStats(analisi) {
  let cause = 0
  let confermate = 0
  Object.values(analisi || {}).forEach(entry => {
    walkNodes(entry?.rami, node => {
      if (node.label) cause += 1
      if (node.is_root_cause && node.root_cause_stato === 'confermata') confermate += 1
    })
  })
  return { cause, confermate }
}

function outputs(form) {
  const stats = causeStats(form.analisi)
  return {
    anomalie_selezionate: form.selezionate.length > 0,
    analisi_cause: stats.cause > 0,
    cause_verificate: stats.confermate > 0,
  }
}

function updateRootCauseStatus(rami, nodeId, stato) {
  const walk = nodes => nodes.map(node => {
    if (node.id === nodeId) return { ...node, root_cause_stato: stato }
    if (node.children?.length) return { ...node, children: walk(node.children) }
    return node
  })
  const next = {}
  Object.entries(rami || {}).forEach(([ramo, cause]) => {
    next[ramo] = Array.isArray(cause) ? walk(cause) : cause
  })
  return next
}

export default function AnomalyAnalysis({ stepData, onChange, major, allStepsData, step }) {
  const [form, setForm] = useState(() => buildForm(stepData?.dati || {}))
  const [status, setStatus] = useState('saved')
  const [active, setActive] = useState('')
  const [ishikawaVersion, setIshikawaVersion] = useState(0)
  const [newAnomaly, setNewAnomaly] = useState('')
  const [apPrefill, setApPrefill] = useState(null)
  const [listVersion, setListVersion] = useState(0)

  const formRef = useRef(form)
  const baseRef = useRef(stepData?.dati || {})
  const onChangeRef = useRef(onChange)
  const dirtyRef = useRef(false)
  const savingRef = useRef(false)
  const revisionRef = useRef(0)
  const timerRef = useRef(null)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  const persist = useCallback(async () => {
    clearTimeout(timerRef.current)
    if (savingRef.current) {
      timerRef.current = setTimeout(() => persist(), SAVE_DELAY / 2)
      return
    }
    const snapshot = formRef.current
    const revision = revisionRef.current
    savingRef.current = true
    setStatus('saving')
    try {
      await onChangeRef.current({
        dati: { ...baseRef.current, ...snapshot },
        output_compilati: outputs(snapshot),
      })
      if (revisionRef.current === revision) {
        dirtyRef.current = false
        setStatus('saved')
      } else {
        setStatus('dirty')
        timerRef.current = setTimeout(() => persist(), SAVE_DELAY)
      }
    } catch {
      setStatus('error')
    } finally {
      savingRef.current = false
    }
  }, [])

  const mutate = useCallback(update => {
    const next = typeof update === 'function' ? update(formRef.current) : { ...formRef.current, ...update }
    formRef.current = next
    setForm(next)
    revisionRef.current += 1
    dirtyRef.current = true
    setStatus('dirty')
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => persist(), SAVE_DELAY)
  }, [persist])

  useEffect(() => {
    baseRef.current = stepData?.dati || {}
    if (!dirtyRef.current && !savingRef.current) {
      const next = buildForm(stepData?.dati || {})
      formRef.current = next
      setForm(next)
    }
  }, [stepData?.dati])

  useEffect(() => {
    const guard = event => {
      if (dirtyRef.current) {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', guard)
    return () => {
      window.removeEventListener('beforeunload', guard)
      clearTimeout(timerRef.current)
      if (dirtyRef.current && !savingRef.current) {
        const snapshot = formRef.current
        Promise.resolve(onChangeRef.current({
          dati: { ...baseRef.current, ...snapshot },
          output_compilati: outputs(snapshot),
        })).catch(() => {})
      }
    }
  }, [])

  const anomalies = useMemo(() => {
    const fromPhase = phaseAnomalies(allStepsData, step?.step_id)
    const extra = form.anomalie_extra.map(item => ({ ...item, origine: 'Aggiunta qui' }))
    return [...fromPhase, ...extra]
  }, [allStepsData, step?.step_id, form.anomalie_extra])

  const selected = anomalies.filter(item => form.selezionate.includes(item.id))
  const current = selected.find(item => item.id === active) || selected[0]
  const stats = causeStats(form.analisi)

  const toggle = (id, checked) => mutate(state => ({
    ...state,
    selezionate: checked ? [...state.selezionate, id] : state.selezionate.filter(value => value !== id),
  }))

  const addExtra = () => {
    const descrizione = newAnomaly.trim()
    if (!descrizione) return
    const id = createId()
    setNewAnomaly('')
    mutate(state => ({
      ...state,
      anomalie_extra: [...state.anomalie_extra, { id, descrizione, zona: '' }],
      selezionate: [...state.selezionate, id],
    }))
    setActive(id)
  }

  const removeExtra = id => {
    if (form.analisi[id] && !confirm('Eliminare l\u2019anomalia e la sua analisi?')) return
    mutate(state => {
      const analisi = { ...state.analisi }
      delete analisi[id]
      return {
        ...state,
        analisi,
        anomalie_extra: state.anomalie_extra.filter(item => item.id !== id),
        selezionate: state.selezionate.filter(value => value !== id),
      }
    })
  }

  const setAnalysis = (id, data) => mutate(state => ({
    ...state,
    analisi: { ...state.analisi, [id]: { effetto: data.effetto, rami: data.rami } },
  }))

  const validate = (id, nodeId, stato) => {
    mutate(state => ({
      ...state,
      analisi: {
        ...state.analisi,
        [id]: { ...state.analisi[id], rami: updateRootCauseStatus(state.analisi[id]?.rami, nodeId, stato) },
      },
    }))
    setIshikawaVersion(value => value + 1)
  }

  const parent = useMemo(() => ({
    parent_type: 'major_kaizen',
    parent_id: major?._id,
    parent_label: `${major?.numero || ''} - ${major?.titolo || ''}`,
    pillar_id: major?.pillar_id || null,
    reparto: major?.reparto || '',
    linea: major?.linea || '',
    macchina: major?.macchina || '',
  }), [major])

  const openActionPlan = rootCause => {
    setApPrefill({
      ...parent,
      gant_step_id: step?.step_id || null,
      titolo: `Contromisura: ${(rootCause.label || 'causa radice').slice(0, 100)}`,
    })
  }

  const analysis = current ? form.analisi[current.id] || { effetto: current.descrizione, rami: {} } : null

  return (
    <div className="space-y-6">
      <section className={panel}>
        <h3 className={heading}>PASSO 1 - ANOMALIE DA ANALIZZARE</h3>
        <p className="text-sm text-gray-600 mb-3">
          Seleziona le anomalie della fase 2 che ritornano o di cui non conosci la causa. Quelle risolte con il ripristino non servono.
        </p>
        {anomalies.length === 0 ? (
          <p className="p-4 text-center text-sm text-gray-400">Nessuna anomalia nella fase 2. Puoi aggiungerne una qui sotto.</p>
        ) : (
          <div className="divide-y border rounded-lg">
            {anomalies.map(item => (
              <label key={item.id} className="flex items-start gap-3 p-3 hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.selezionate.includes(item.id)}
                  onChange={event => toggle(item.id, event.target.checked)}
                  className="mt-1"
                />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium text-gray-800">{item.descrizione}</span>
                  <span className="block text-xs text-gray-500">{[item.zona, item.origine].filter(Boolean).join(' · ')}</span>
                </span>
                {item.origine === 'Aggiunta qui' && (
                  <button type="button" aria-label="Elimina anomalia" onClick={event => { event.preventDefault(); removeExtra(item.id) }} className="p-1.5 text-red-600 hover:bg-red-50 rounded">
                    <Trash2 size={15} />
                  </button>
                )}
              </label>
            ))}
          </div>
        )}
        <div className="mt-3 flex gap-2">
          <input
            aria-label="Nuova anomalia"
            value={newAnomaly}
            onChange={event => setNewAnomaly(event.target.value)}
            onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addExtra() } }}
            placeholder="Anomalia non presente nella fase 2"
            className={input}
          />
          <button type="button" onClick={addExtra} disabled={!newAnomaly.trim()} className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
            <Plus size={16} /> Aggiungi
          </button>
        </div>
      </section>

      <section className={panel}>
        <h3 className={heading}>PASSO 2 - ANALISI DELLE CAUSE</h3>
        {selected.length === 0 ? (
          <p className="p-4 text-center text-sm text-gray-400">Seleziona almeno un&apos;anomalia nel passo 1.</p>
        ) : (
          <>
            <div role="tablist" aria-label="Anomalie selezionate" className="flex flex-wrap gap-2 mb-4">
              {selected.map(item => {
                const isActive = current?.id === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActive(item.id)}
                    className={`max-w-xs truncate rounded-lg border px-3 py-1.5 text-sm ${isActive ? 'border-primary bg-primary text-white' : 'border-gray-300 hover:bg-gray-50'}`}
                    title={item.descrizione}
                  >
                    {item.descrizione}
                  </button>
                )
              })}
            </div>
            {current && (
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-bold uppercase text-gray-600 mb-2">Ishikawa</h4>
                  <IshikawaDiagram
                    key={`${current.id}-${ishikawaVersion}`}
                    effetto={analysis.effetto}
                    rami={analysis.rami}
                    onChange={data => setAnalysis(current.id, data)}
                  />
                </div>
                <div>
                  <h4 className="text-sm font-bold uppercase text-gray-600 mb-2">5 Perché e cause radice</h4>
                  <FiveWhysFlowChart
                    effetto={analysis.effetto}
                    rami={analysis.rami}
                    onValidateRootCause={(nodeId, stato) => validate(current.id, nodeId, stato)}
                    onCreateActionPlan={openActionPlan}
                  />
                </div>
              </div>
            )}
          </>
        )}
      </section>

      <section className="space-y-3">
        <h3 className={heading}>PASSO 3 - CONTROMISURE</h3>
        <p className="text-sm text-gray-600">
          Per ogni causa radice confermata usa &quot;Crea Action Plan&quot; nei 5 Perché, oppure crea l&apos;azione qui. Cause trovate: {stats.cause} · confermate: {stats.confermate}.
        </p>
        <KaizenAzioniList key={listVersion} parent={parent} defaultStepId={step?.step_id || ''} />
      </section>

      <div role="status" aria-live="polite" className="flex items-center justify-end gap-3 border-t border-gray-200 pt-4 text-sm">
        <span className={status === 'error' ? 'text-red-700' : 'text-gray-600'}>{STATUS_LABELS[status]}</span>
        {status === 'error' && <button type="button" onClick={persist} className="rounded border border-gray-300 px-3 py-1.5 text-xs hover:bg-gray-50">Riprova</button>}
      </div>

      {apPrefill && (
        <ActionPlanFormShared
          plan={null}
          prefilledParent={apPrefill}
          prefilledKaizen={null}
          onClose={() => setApPrefill(null)}
          onSaved={() => { setApPrefill(null); setListVersion(value => value + 1) }}
        />
      )}
    </div>
  )
}
