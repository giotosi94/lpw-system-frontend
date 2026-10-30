import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import api from '../../../../services/api'
import ImageUpload from '../../../ImageUpload'
import UserPicker from '../../../UserPicker'
import ActionPlanFormShared from '../../../ActionPlanFormShared'
import ActionPlanDetailPanel from '../../../ActionPlanDetailPanel'
import { useAllConfigurations } from '../../../../hooks/useConfigurations'

const SAVE_DELAY = 800

const panel = 'bg-white border border-gray-200 rounded-lg p-4 md:p-5'
const heading = 'bg-primary text-white text-center py-2 rounded-lg font-bold mb-4'
const input = 'w-full min-w-0 border border-gray-300 rounded px-2 py-2 text-sm bg-white'
const addButton = 'inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90'
const smallButton = 'rounded border border-gray-300 px-3 py-1.5 text-xs hover:bg-gray-50'

const STATUS_LABELS = {
  saved: 'Salvato',
  dirty: 'Modifiche da salvare',
  saving: 'Salvataggio...',
  error: 'Errore di salvataggio: le modifiche restano nella pagina',
}

const list = value => (Array.isArray(value) ? value : [])

function createId(prefix) {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

function newArea() {
  return { id: createId('area'), perdita: '', zona: '', condizione: '', standard: '' }
}

function newAnomaly(descrizione = '') {
  return { id: createId('anomaly'), zona: '', descrizione, foto_prima: [], foto_dopo: [], action_plan_id: '', verifica: '' }
}

function newStandard() {
  return { id: createId('standard'), attivita: '', metodo: '', documento_id: '', documento_label: '', frequenza: '', responsabile: null }
}

function buildForm(data) {
  return {
    aree: list(data.aree).map(item => ({ ...newArea(), ...item, id: item.id || createId('area') })),
    anomalie: list(data.anomalie).map(item => ({
      ...newAnomaly(),
      ...item,
      id: item.id || createId('anomaly'),
      zona: item.zona ?? item.area_componente ?? '',
      verifica: item.verifica ?? item.note ?? '',
      foto_prima: list(item.foto_prima),
      foto_dopo: list(item.foto_dopo),
    })),
    standard_righe: list(data.standard_righe).map(item => ({ ...newStandard(), ...item, id: item.id || createId('standard') })),
  }
}

function toData(form) {
  return { aree: form.aree, anomalie: form.anomalie, standard_righe: form.standard_righe }
}

function outputs(form) {
  return {
    aree_critiche: form.aree.some(item => item.zona.trim()),
    anomalie_ripristini: form.anomalie.some(item => item.descrizione.trim()),
    azioni_ripristino: form.anomalie.some(item => item.action_plan_id),
    standard_iniziale: form.standard_righe.some(item => item.attivita.trim()),
  }
}

function shortNumber(value) {
  return String(value || '').replace(/^(OPL|SOP)-/i, '')
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString('it-IT') : 'Senza scadenza'
}

export default function BasicConditions({ stepData, onChange, major, allStepsData, step }) {
  const [form, setForm] = useState(() => buildForm(stepData?.dati || {}))
  const [status, setStatus] = useState('saved')
  const [actionPlans, setActionPlans] = useState([])
  const [plansError, setPlansError] = useState('')
  const [documents, setDocuments] = useState([])
  const [formAnomalyId, setFormAnomalyId] = useState(null)
  const [selectedPlan, setSelectedPlan] = useState(null)

  const formRef = useRef(form)
  const baseRef = useRef(stepData?.dati || {})
  const onChangeRef = useRef(onChange)
  const dirtyRef = useRef(false)
  const savingRef = useRef(false)
  const revisionRef = useRef(0)
  const timerRef = useRef(null)

  const lossListId = useId()
  const zoneListId = useId()
  const { configs } = useAllConfigurations()
  const states = configs.stato_ap || []

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
        dati: { ...baseRef.current, ...toData(snapshot) },
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
          dati: { ...baseRef.current, ...toData(snapshot) },
          output_compilati: outputs(snapshot),
        })).catch(() => {})
      }
    }
  }, [])

  const loadActionPlans = useCallback(async () => {
    if (!major?._id) return
    try {
      const response = await api.get('/action-plans/', { params: { parent_id: major._id } })
      setActionPlans((response.data || []).filter(plan => plan.parent_type === 'major_kaizen' && plan.parent_id === major._id))
      setPlansError('')
    } catch {
      setPlansError('Impossibile caricare gli Action Plan del progetto')
    }
  }, [major?._id])

  useEffect(() => {
    loadActionPlans()
  }, [loadActionPlans])

  useEffect(() => {
    let cancelled = false
    api.get('/documenti')
      .then(response => {
        if (!cancelled) setDocuments((response.data || []).filter(doc => doc.tipo === 'OPL' || doc.tipo === 'SOP'))
      })
      .catch(() => {
        if (!cancelled) setDocuments([])
      })
    return () => { cancelled = true }
  }, [])

  const planById = useMemo(() => new Map(actionPlans.map(plan => [plan._id, plan])), [actionPlans])
  const isClosed = plan => Boolean(plan?.is_cancelled || states.find(state => state.label === plan?.stato)?.is_terminal)

  const lossOptions = useMemo(() => {
    const values = new Set()
    Object.values(allStepsData || {}).forEach(step => {
      const data = step?.dati || {}
      ;[...list(data.priorita_stain), ...list(data.priorita_manuali)].forEach(value => value && values.add(value))
    })
    return [...values]
  }, [allStepsData])

  const zoneOptions = useMemo(
    () => [...new Set(form.aree.map(item => item.zona.trim()).filter(Boolean))],
    [form.aree],
  )

  const addArea = () => mutate(current => ({ ...current, aree: [...current.aree, newArea()] }))
  const patchArea = (id, patch) => mutate(current => ({
    ...current,
    aree: current.aree.map(item => (item.id === id ? { ...item, ...patch } : item)),
  }))
  const removeArea = id => mutate(current => ({ ...current, aree: current.aree.filter(item => item.id !== id) }))

  const addAnomaly = () => mutate(current => ({ ...current, anomalie: [...current.anomalie, newAnomaly()] }))
  const patchAnomaly = (id, patch) => mutate(current => ({
    ...current,
    anomalie: current.anomalie.map(item => (item.id === id ? { ...item, ...patch } : item)),
  }))
  const removeAnomaly = anomaly => {
    if (anomaly.action_plan_id && !confirm('Eliminare l\u2019anomalia? L\u2019Action Plan collegato resta disponibile nel progetto.')) return
    mutate(current => ({ ...current, anomalie: current.anomalie.filter(item => item.id !== anomaly.id) }))
  }

  const addStandard = () => mutate(current => ({ ...current, standard_righe: [...current.standard_righe, newStandard()] }))
  const patchStandard = (id, patch) => mutate(current => ({
    ...current,
    standard_righe: current.standard_righe.map(item => (item.id === id ? { ...item, ...patch } : item)),
  }))
  const removeStandard = id => mutate(current => ({ ...current, standard_righe: current.standard_righe.filter(item => item.id !== id) }))

  const selectDocument = (id, documentId) => {
    const doc = documents.find(item => item._id === documentId)
    patchStandard(id, {
      documento_id: documentId,
      documento_label: doc ? `${doc.tipo} ${shortNumber(doc.numero)} - ${doc.titolo}` : '',
    })
  }

  const handleActionPlanSaved = async plan => {
    const anomalyId = formAnomalyId
    setFormAnomalyId(null)
    mutate(current => ({
      ...current,
      anomalie: current.anomalie.map(item => (item.id === anomalyId ? { ...item, action_plan_id: plan._id } : item)),
    }))
    persist()
    await loadActionPlans()
  }

  const formAnomaly = form.anomalie.find(item => item.id === formAnomalyId)

  const linkedPlans = form.anomalie.map(item => planById.get(item.action_plan_id)).filter(Boolean)
  const closedPlans = linkedPlans.filter(isClosed).length

  return (
    <div className="space-y-6">
      <section className={panel}>
        <h3 className={heading}>PASSO 1 - AREE DA CONTROLLARE</h3>
        <p className="text-sm text-gray-600 mb-3">
          Indica dove verificare le condizioni di base per i difetti prioritari e quale standard ci si aspetta.
        </p>
        <datalist id={lossListId}>
          {lossOptions.map(value => <option key={value} value={value} />)}
        </datalist>
        <button type="button" onClick={addArea} className={addButton}><Plus size={16} /> Aggiungi area</button>
        <div className="overflow-x-auto mt-4">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="text-left text-gray-600 border-b">
                <th className="p-2 font-medium">Perdita di riferimento</th>
                <th className="p-2 font-medium">Componente / zona</th>
                <th className="p-2 font-medium">Condizione da verificare</th>
                <th className="p-2 font-medium">Standard atteso</th>
                <th className="p-2 w-10" />
              </tr>
            </thead>
            <tbody>
              {form.aree.length === 0 ? (
                <tr><td colSpan="5" className="p-6 text-center text-gray-400">Nessuna area inserita</td></tr>
              ) : form.aree.map(row => (
                <tr key={row.id} className="border-b align-top">
                  <td className="p-1"><input list={lossListId} aria-label="Perdita di riferimento" className={input} value={row.perdita} onChange={event => patchArea(row.id, { perdita: event.target.value })} /></td>
                  <td className="p-1"><input aria-label="Componente o zona" className={input} value={row.zona} onChange={event => patchArea(row.id, { zona: event.target.value })} /></td>
                  <td className="p-1"><input aria-label="Condizione da verificare" className={input} value={row.condizione} onChange={event => patchArea(row.id, { condizione: event.target.value })} /></td>
                  <td className="p-1"><input aria-label="Standard atteso" className={input} value={row.standard} onChange={event => patchArea(row.id, { standard: event.target.value })} /></td>
                  <td className="p-1 text-center"><button type="button" aria-label="Elimina area" onClick={() => removeArea(row.id)} className="p-2 text-red-600 hover:bg-red-50 rounded"><Trash2 size={15} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={panel}>
        <h3 className={heading}>PASSO 2 - ISPEZIONE E RIPRISTINO</h3>
        <p className="text-sm text-gray-600 mb-3">
          Registra le anomalie trovate con pulizia e ispezione. L&apos;intervento si gestisce nell&apos;Action Plan: responsabile, scadenza e stato arrivano da lì.
        </p>
        <datalist id={zoneListId}>
          {zoneOptions.map(value => <option key={value} value={value} />)}
        </datalist>
        <button type="button" onClick={addAnomaly} className={addButton}><Plus size={16} /> Aggiungi anomalia</button>
        {plansError && <p role="alert" className="mt-3 text-sm text-red-700">{plansError}</p>}
        <div className="mt-4 space-y-4">
          {form.anomalie.length === 0 && <p className="p-6 text-center text-sm text-gray-400">Nessuna anomalia registrata</p>}
          {form.anomalie.map((item, index) => {
            const plan = planById.get(item.action_plan_id)
            return (
              <article key={item.id} className="border border-gray-300 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-bold text-gray-700">Anomalia {index + 1}</h4>
                  <button type="button" aria-label="Elimina anomalia" onClick={() => removeAnomaly(item)} className="p-2 text-red-600 hover:bg-red-50 rounded"><Trash2 size={15} /></button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <label className="block text-sm">Componente / zona
                    <input list={zoneListId} className={`${input} mt-1`} value={item.zona} onChange={event => patchAnomaly(item.id, { zona: event.target.value })} />
                  </label>
                  <label className="block text-sm md:col-span-2">Anomalia rilevata
                    <textarea rows={2} className={`${input} mt-1`} value={item.descrizione} onChange={event => patchAnomaly(item.id, { descrizione: event.target.value })} />
                  </label>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
                  <ImageUpload images={item.foto_prima} onChange={value => patchAnomaly(item.id, { foto_prima: value })} label="Foto prima" maxImages={4} />
                  <ImageUpload images={item.foto_dopo} onChange={value => patchAnomaly(item.id, { foto_dopo: value })} label="Foto dopo" maxImages={4} />
                </div>
                <div className="mt-4 border-t border-gray-200 pt-3">
                  <ActionPlanLink
                    plan={plan}
                    linkedId={item.action_plan_id}
                    closed={isClosed(plan)}
                    onCreate={() => setFormAnomalyId(item.id)}
                    onOpen={() => setSelectedPlan(plan)}
                    onUnlink={() => patchAnomaly(item.id, { action_plan_id: '' })}
                  />
                </div>
                <label className="block text-sm mt-3">Verifica del ripristino: come hai controllato (foto, misura, prova funzionale)
                  <textarea rows={2} className={`${input} mt-1`} value={item.verifica} onChange={event => patchAnomaly(item.id, { verifica: event.target.value })} />
                </label>
              </article>
            )
          })}
        </div>
      </section>

      <section className={panel}>
        <h3 className={heading}>PASSO 3 - STANDARD INIZIALE</h3>
        <p className="text-sm text-gray-600 mb-3">
          Dopo i ripristini, indica come mantenere le condizioni: collega gli OPL e le SOP già presenti.
        </p>
        <button type="button" onClick={addStandard} className={addButton}><Plus size={16} /> Aggiungi standard</button>
        <div className="mt-4">
          {form.standard_righe.length === 0 ? (
            <p className="p-6 text-center text-sm text-gray-400">Nessuno standard inserito</p>
          ) : (
            <>
              <div className="hidden lg:grid grid-cols-[1.4fr_1.2fr_1.4fr_0.8fr_1.2fr_2.5rem] gap-2 border-b pb-2 text-sm font-medium text-gray-600">
                <span>Attività / controllo</span>
                <span>Metodo</span>
                <span>Documento OPL / SOP</span>
                <span>Frequenza</span>
                <span>Responsabile</span>
                <span />
              </div>
              {form.standard_righe.map(row => (
                <div key={row.id} className="grid grid-cols-1 lg:grid-cols-[1.4fr_1.2fr_1.4fr_0.8fr_1.2fr_2.5rem] gap-2 items-start border-b py-2">
                  <input aria-label="Attività o controllo" placeholder="Attività / controllo" className={input} value={row.attivita} onChange={event => patchStandard(row.id, { attivita: event.target.value })} />
                  <input aria-label="Metodo" placeholder="Metodo" className={input} value={row.metodo} onChange={event => patchStandard(row.id, { metodo: event.target.value })} />
                  <select aria-label="Documento OPL o SOP" className={input} value={row.documento_id} onChange={event => selectDocument(row.id, event.target.value)}>
                    <option value="">Nessun documento</option>
                    {row.documento_id && !documents.some(doc => doc._id === row.documento_id) && (
                      <option value={row.documento_id}>{row.documento_label || 'Documento non disponibile'}</option>
                    )}
                    {documents.map(doc => (
                      <option key={doc._id} value={doc._id}>{doc.tipo} {shortNumber(doc.numero)} - {doc.titolo}</option>
                    ))}
                  </select>
                  <input aria-label="Frequenza" placeholder="Frequenza" className={input} value={row.frequenza} onChange={event => patchStandard(row.id, { frequenza: event.target.value })} />
                  <UserPicker mode="single" value={row.responsabile} onChange={value => patchStandard(row.id, { responsabile: value })} placeholder="Responsabile" />
                  <button type="button" aria-label="Elimina standard" onClick={() => removeStandard(row.id)} className="p-2 text-red-600 hover:bg-red-50 rounded"><Trash2 size={15} /></button>
                </div>
              ))}
            </>
          )}
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 pt-4">
        <p className="text-sm text-gray-600">
          Aree: {form.aree.length} · Anomalie: {form.anomalie.length} · Action Plan collegati: {linkedPlans.length} · Chiusi: {closedPlans} · Standard: {form.standard_righe.length}
        </p>
        <div role="status" aria-live="polite" className="flex items-center gap-3 text-sm">
          <span className={status === 'error' ? 'text-red-700' : 'text-gray-600'}>{STATUS_LABELS[status]}</span>
          {status === 'error' && <button type="button" onClick={persist} className={smallButton}>Riprova</button>}
        </div>
      </div>

      {formAnomaly && (
        <ActionPlanFormShared
          plan={null}
          prefilledParent={{
            parent_type: 'major_kaizen',
            parent_id: major?._id,
            parent_label: `${major?.numero || ''} - ${major?.titolo || ''}`,
            pillar_id: major?.pillar_id || null,
            reparto: major?.reparto || '',
            linea: major?.linea || '',
            macchina: major?.macchina || '',
            titolo: formAnomaly.descrizione.trim().slice(0, 120),
            gant_step_id: step?.step_id || null,
          }}
          prefilledKaizen={null}
          onClose={() => setFormAnomalyId(null)}
          onSaved={handleActionPlanSaved}
        />
      )}

      {selectedPlan && (
        <ActionPlanDetailPanel
          plan={selectedPlan}
          onClose={() => setSelectedPlan(null)}
          onUpdated={loadActionPlans}
        />
      )}
    </div>
  )
}

function ActionPlanLink({ plan, linkedId, closed, onCreate, onOpen, onUnlink }) {
  if (!linkedId) {
    return (
      <button type="button" onClick={onCreate} className={addButton}>
        <Plus size={16} /> Crea Action Plan di ripristino
      </button>
    )
  }
  if (!plan) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-gray-600">
        <span>Action Plan non disponibile (eliminato o non ancora caricato)</span>
        <button type="button" onClick={onUnlink} className={smallButton}>Scollega</button>
      </div>
    )
  }
  const late = !closed && plan.stato_visuale === 'In Ritardo'
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0 text-sm">
        <span className="font-mono font-bold text-primary mr-2">{plan.numero}</span>
        <span className="font-medium">{plan.titolo}</span>
        <div className="text-xs text-gray-600 mt-1">
          {plan.responsabile || 'Senza responsabile'} · {formatDate(plan.data_scadenza)} ·{' '}
          <span className={closed ? 'text-green-700 font-semibold' : late ? 'text-red-700 font-semibold' : ''}>
            {plan.stato_visuale && plan.stato_visuale !== plan.stato ? `${plan.stato} (${plan.stato_visuale})` : plan.stato || 'Aperto'}
          </span>
        </div>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={onOpen} className={smallButton}>Apri</button>
        <button type="button" onClick={onUnlink} className={smallButton}>Scollega</button>
      </div>
    </div>
  )
}
