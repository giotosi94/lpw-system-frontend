import { useEffect, useMemo, useRef, useState } from 'react'
import api from '../../../../services/api'
import { useAuth } from '../../../../context/AuthContext'
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ReferenceLine, ReferenceArea } from 'recharts'
import { baselineScope, aggregateSnapshot, compareSnapshots, incomparableProducts, calculateSaving, objectiveLabel, objectiveContext, objectivePatch } from './scrapSavingMath'

const field = 'w-full border border-gray-300 rounded px-2 py-2 text-sm bg-white'
const button = 'border rounded px-3 py-2 text-sm disabled:opacity-50'
const section = 'border border-gray-200 rounded-lg bg-white p-4 space-y-3'
const fmt = value => value == null || !Number.isFinite(value) ? 'Non disponibile' : new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 }).format(value)
const empty = () => ({ verificationPeriod: 'custom', mode: 'stain', objectiveId: '', objectiveSnapshot: null, objectiveFingerprint: '', trendRestoration: '', trendImprovement: '', trendRestorationRef: '', trendImprovementRef: '', trendData: null, excluded: [], scope: null, before: null, after: null, afterFrom: '', afterTo: '', manualBeforeFrom: '', manualBeforeTo: '', rows: [], costs: '', costNote: '', annualProduction: '', annualBasis: '', source: '', notes: '', reviewed: false, reviewedBy: '', reviewedAt: '' })


function outcome(value, positive, negative, unit) {
  if (value == null || !Number.isFinite(value)) return 'Non disponibile'
  if (Math.abs(value) < 0.000001) return `Nessuna variazione (0 ${unit})`
  return `${value > 0 ? positive : negative}: ${fmt(Math.abs(value))} ${unit}`
}
function rate(loss, production) {
  const p = Number(production)
  return p > 0 ? Number(loss) / p * 100 : null
}
function dayAfter(value) {
  if (!value) return ''
  const d = new Date(`${value}T12:00:00`)
  if (Number.isNaN(d.getTime())) return ''
  d.setDate(d.getDate() + 1)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function previousDay(value) {
  const d = new Date(`${value}T12:00:00`)
  if (Number.isNaN(d.getTime())) return ''
  d.setDate(d.getDate() - 1)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function todayDate() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function trendKey(scope, from, to) {
  return JSON.stringify({ line: scope?.line, products: scope?.products, types: scope?.types, priorities: scope?.priorities, from, to })
}

function buildScrapTrend(snapshot, scope) {
  aggregateSnapshot(snapshot, scope)
  const selected = new Set(scope.products || [])
  const days = new Map()
  const get = day => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day || '')) throw new Error('Data giornaliera STAIN mancante o non valida.')
    if (!days.has(day)) days.set(day, { date: day, timestamp: Date.parse(`${day}T00:00:00Z`), production: 0, loss: 0 })
    return days.get(day)
  }
  snapshot.produzione.forEach(row => {
    if (!selected.size || selected.has(row.prodotto)) get(row.data).production += Number(row.kg)
  })
  snapshot.dettaglio.forEach(row => {
    if (selected.size && !selected.has(row.prodotto)) return
    if (!scope.types.includes(row.tipo)) return
    if (scope.priorities.length && !scope.priorities.includes(`${row.codice} - ${row.causale}`)) return
    get(row.data).loss += Number(row.kg)
  })
  const start = Date.parse(`${snapshot.dal}T00:00:00Z`)
  const end = Date.parse(`${snapshot.al}T00:00:00Z`)
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start || end - start > 366 * 86400000) throw new Error('Periodo trend non valido: massimo 367 giorni inclusi.')
  const points = []
  for (let timestamp = start; timestamp <= end; timestamp += 86400000) {
    const date = new Date(timestamp).toISOString().slice(0, 10)
    const point = days.get(date) || { date, timestamp, production: 0, loss: 0 }
    const valid = point.production > 0 && point.loss >= 0 && point.loss <= point.production
    points.push({ ...point, valid, value: valid ? point.loss / point.production * 100 : null })
  }
  return points
}

function trendSegments(points, restoration, improvement) {
  if (!restoration || !improvement || improvement <= restoration) return []
  const ranges = [
    { label: 'Prima del ripristino', includes: date => date < restoration },
    { label: 'Dopo il ripristino', includes: date => date >= restoration && date < improvement },
    { label: 'Dopo l’intervento di miglioramento', includes: date => date >= improvement },
  ]
  return ranges.map(range => {
    const selected = points.filter(point => range.includes(point.date))
    const valid = selected.filter(point => point.valid)
    const incomplete = selected.some(point => !point.valid && (point.production !== 0 || point.loss !== 0))
    const production = valid.reduce((sum, point) => sum + point.production, 0)
    const loss = valid.reduce((sum, point) => sum + point.loss, 0)
    return { label: range.label, count: valid.length, production, loss, value: !incomplete && production > 0 ? loss / production * 100 : null, incomplete }
  })
}


const DONE_CARL = ['FINISHED', 'CLOSED']

function isoDay(value) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10)
}

function carlDoneDate(detail) {
  const rows = (detail?.storico || []).filter(row => DONE_CARL.includes(row.stato) && row.data)
  return rows.length ? isoDay(rows[0].data) : ''
}

function collectInterventions(allStepsData) {
  const restoreSteps = new Set()
  const carl = []
  Object.entries(allStepsData || {}).forEach(([stepId, step]) => {
    const data = step?.dati || {}
    if (Array.isArray(data.anomalie)) restoreSteps.add(stepId)
    ;(Array.isArray(data.anomalie) ? data.anomalie : []).forEach((row, index) => {
      if (row?.carl?.id) carl.push({ key: `carl:${row.carl.id}`, carlId: row.carl.id, kind: 'ripristino', label: `${row.carl.codice || 'CARL'} · ${row.descrizione || `Anomalia ${index + 1}`}` })
    })
    ;(Array.isArray(data.miglioramenti) ? data.miglioramenti : []).forEach(row => {
      if (row?.carl?.id) carl.push({ key: `carl:${row.carl.id}`, carlId: row.carl.id, kind: 'miglioramento', label: `${row.carl.codice || 'SUG'} · ${row.proposta || row.titolo || 'Miglioramento'}` })
    })
  })
  return { carl, restoreSteps }
}

function useProjectInterventions(major, allStepsData) {
  const [items, setItems] = useState([])
  const { carl, restoreSteps } = collectInterventions(allStepsData)
  const signature = JSON.stringify([major?._id, carl.map(item => item.key), [...restoreSteps]])
  useEffect(() => {
    let active = true
    const load = async () => {
      const plans = major?._id
        ? await api.get('/action-plans/', { params: { parent_id: major._id } }).then(response => response.data || []).catch(() => [])
        : []
      const planItems = plans
        .filter(plan => plan.parent_type === 'major_kaizen' && plan.parent_id === major._id)
        .map(plan => {
          const stepId = plan.route_source?.step_id || plan.gant_step_id
          return { key: `ap:${plan._id}`, kind: restoreSteps.has(stepId) ? 'ripristino' : 'miglioramento', label: `${plan.numero || 'AP'} · ${plan.titolo || ''}`, date: isoDay(plan.data_completamento) }
        })
      const carlItems = await Promise.all(carl.map(async item => {
        try {
          const response = await api.get(`/carl/cartellini/${item.carlId}`)
          return { ...item, date: carlDoneDate(response.data) }
        } catch {
          return { ...item, date: '', unavailable: true }
        }
      }))
      if (active) setItems([...carlItems, ...planItems])
    }
    load()
    return () => { active = false }
  }, [signature])
  return items
}

function InterventionSelect({ label, kind, items, value, refKey, dateKey, change }) {
  const options = items.filter(item => item.kind === kind)
  const selected = options.find(item => item.key === value)
  return (
      <label className="block text-sm">{label}
        <select className={field} value={selected ? selected.key : ''} onChange={event => {
          const item = options.find(row => row.key === event.target.value)
          change(item ? { [refKey]: item.key, [dateKey]: item.date } : { [refKey]: '' })
        }}>
          <option value="">{options.length ? 'Seleziona intervento' : 'Nessun intervento collegato'}</option>
          {options.map(item => <option key={item.key} value={item.key} disabled={!item.date}>{item.label}{item.date ? ` · ${item.date.split('-').reverse().join('/')}` : item.unavailable ? ' · stato non disponibile' : ' · non concluso'}</option>)}
        </select>
      </label>
  )
}

function ScrapInterventionTrend({ form, change, from, to, interventions }) {
  const scope = form.scope && form.rows.length ? { ...form.scope, products: [...new Set(form.rows.map(row => row.product))] } : form.scope
  const key = form.mode + trendKey(scope, from, to)
  const start = Date.parse(`${from}T00:00:00Z`)
  const end = Date.parse(`${to}T00:00:00Z`)
  const periodValid = Boolean(scope && Number.isFinite(start) && Number.isFinite(end) && end >= start && end - start <= 366 * 86400000 && to <= todayDate())
  const restoration = form.trendRestoration || ''
  const improvement = form.trendImprovement || ''
  const markerError = restoration && improvement && improvement <= restoration
    ? 'Il miglioramento deve essere successivo al ripristino per distinguere i tre periodi.'
    : [restoration, improvement].some(date => date && (date < from || date > to))
      ? 'Le date degli interventi devono essere comprese nel periodo del trend.' : ''
  let points = []
  let dataError = ''
  if (form.rows.length && form.after && form.trendData?.key === key) {
    try { points = buildScrapTrend(form.trendData.snapshot, scope) }
    catch (error) { dataError = error.message }
  }
  const segments = markerError ? [] : trendSegments(points, restoration, improvement)
  const baselinePoints = points.filter(point => point.date >= form.scope?.from && point.date <= form.scope?.to)
  const baselineProduction = baselinePoints.reduce((sum, point) => sum + (point.valid ? point.production : 0), 0)
  const baselineRate = baselineProduction > 0 && !baselinePoints.some(point => !point.valid && (point.production || point.loss)) ? baselinePoints.reduce((sum, point) => sum + point.loss, 0) / baselineProduction * 100 : null
  const verificationPoints = points.filter(point => point.date >= form.afterFrom && point.date <= form.afterTo && point.valid)
  const invalid = points.filter(point => !point.valid && (point.loss !== 0 || point.production !== 0)).length
  const labelDate = value => new Date(value).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', timeZone: 'UTC' })
  return (
    <section className={section}>
      <h3 className="font-bold text-primary">Andamento della perdita</h3>
      <p className="text-sm text-gray-600">Stesso obiettivo e prodotti del saving. L'area verde indica il periodo di verifica; la linea tratteggiata indica la baseline selezionata. Il trend aggregato puo risentire del mix prodotto; il saving e normalizzato per prodotto.</p>
      {form.mode !== 'stain' ? <p className="text-sm text-amber-800">Il confronto manuale contiene solo totali: non viene generato un trend senza dati giornalieri.</p> : <>
        <p className="text-sm">Periodo: {from || 'Da definire'} / {to || 'Da definire'}</p>

        {!periodValid && <p className="text-sm text-amber-800">Importa il perimetro e scegli un periodo storico continuo di massimo 367 giorni.</p>}
        {markerError && <p role="alert" className="text-sm text-amber-800">{markerError}</p>}
        {dataError && <p role="alert" className="text-sm text-red-700">{dataError}</p>}
        {form.trendData && form.trendData.key !== key && <p className="text-sm text-amber-800">Date o filtri modificati: aggiorna il trend. Il precedente non viene mostrato.</p>}
        {points.length > 0 && <>
          <p className="text-sm">Verifica: {form.afterFrom} / {form.afterTo} · {verificationPoints.length} giorni produttivi validi. La durata del campione va valutata prima di confermare l’efficacia.</p>
          <div className="h-80 w-full" role="img" aria-label="Trend giornaliero della percentuale di perdita con date di ripristino e miglioramento">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={points} margin={{ top: 40, right: 30, bottom: 10, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" /><ReferenceArea x1={Date.parse(`${form.afterFrom}T00:00:00Z`)} x2={Date.parse(`${form.afterTo}T00:00:00Z`)} fill="#15803d" fillOpacity={0.1} label="Periodo del saving" />
                <XAxis dataKey="timestamp" type="number" scale="time" domain={[start, end]} tickFormatter={labelDate} />
                <YAxis unit="%" width={65} />
                <Tooltip labelFormatter={value => new Date(value).toLocaleDateString('it-IT', { timeZone: 'UTC' })} formatter={value => [`${fmt(value)}%`, 'Perdita sulla produzione']} />
                <Legend />
                <Line name="Perdita selezionata (%)" type="linear" dataKey="value" stroke="#85583f" strokeWidth={2} dot={{ r: 2 }} connectNulls={false} isAnimationActive={false} />
                {!markerError && restoration && <ReferenceLine x={Date.parse(`${restoration}T00:00:00Z`)} stroke="#2563eb" strokeWidth={2} strokeDasharray="5 3" label={{ value: 'Ripristino', position: 'insideTopLeft', fill: '#2563eb' }} />}
                {!markerError && improvement && <ReferenceLine x={Date.parse(`${improvement}T00:00:00Z`)} stroke="#15803d" strokeWidth={2} strokeDasharray="5 3" label={{ value: 'Intervento di miglioramento', position: 'insideTopRight', fill: '#15803d' }} />}
                {baselineRate != null && <ReferenceLine y={baselineRate} stroke="#6b7280" strokeDasharray="4 4" label={{ value: `Prima: ${fmt(baselineRate)}%`, position: 'insideTopRight' }} />}
              </LineChart>
            </ResponsiveContainer>
          </div>
          {!points.some(point => point.valid) && <p className="text-sm text-amber-800">Nessun giorno con produzione e perdite valide nel perimetro.</p>}
          {invalid > 0 && <p className="text-sm text-amber-800">{invalid} giorni con perdita senza produzione o quantitativi incoerenti: percentuale non calcolata. I riepiloghi dei periodi interessati non sono disponibili.</p>}
          {!restoration || !improvement ? <p className="text-sm text-gray-600">Indica entrambe le date per confrontare i tre periodi.</p> : null}
          {segments.length > 0 && <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr>{['Periodo', 'Giorni produttivi validi', 'Perdita ponderata', 'Variazione rispetto alla baseline'].map(label => <th key={label} className="text-left border-b p-2">{label}</th>)}</tr></thead><tbody>{segments.map((segment, index) => {
            const reduction = baselineRate > 0 && segment.value != null ? (baselineRate - segment.value) / baselineRate * 100 : null
            return <tr key={segment.label}><td className="p-2">{segment.label}</td><td className="p-2">{segment.count}</td><td className="p-2">{segment.value == null ? 'Non disponibile' : `${fmt(segment.value)}%`}</td><td className="p-2">{reduction == null ? 'Non disponibile' : `${reduction >= 0 ? 'Riduzione' : 'Aumento'} ${fmt(Math.abs(reduction))}%`}</td></tr>
          })}</tbody></table></div>}
          <p className="text-xs text-gray-600">Percentuale ponderata = kg persi / kg prodotti nel periodo, non media delle percentuali giornaliere. Il giorno dell'intervento appartiene al periodo successivo. Giorni senza produzione: interruzione della linea, non zero. Variazione rispetto alla baseline selezionata. Variazioni del mix prodotto possono influire sul risultato: per una verifica omogenea seleziona lo stesso prodotto. Il trend mostra l'associazione temporale, non dimostra da solo la causalita.</p>
        </>}
      </>}
    </section>
  )
}

export default function ScrapSavings({ stepData, allStepsData, onChange, major }) {
  const { user } = useAuth() || {}
  const interventions = useProjectInterventions(major, allStepsData)
  const [form, setForm] = useState(() => ({ ...empty(), ...(stepData?.dati?.saving_economico || {}) }))
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [periodStatus, setPeriodStatus] = useState('')
  const [driverStatus, setDriverStatus] = useState('')
  const [driverVersions, setDriverVersions] = useState([])
  const driverVersion = form.selectedDriverVersion || form.driverSnapshot?.version_id || ''
  useEffect(() => {
    api.get('/economic-drivers/versions').then(response => setDriverVersions(response.data)).catch(() => setDriverStatus('Elenco driver non disponibile: verifica il backend.'))
  }, [])
  const dirty = useRef(false)
  const revision = useRef(0)
  const formRef = useRef(form)
  const baseRef = useRef(stepData?.dati || {})
  const onChangeRef = useRef(onChange)
  const timerRef = useRef(null)
  const savingRef = useRef(false)
  const mountedRef = useRef(true)
  const draftStateRef = useRef(null)
  const persistRef = useRef(null)
  const [saveState, setSaveState] = useState('saved')
  onChangeRef.current = onChange
  baseRef.current = stepData?.dati || {}
  const baseline = Object.values(allStepsData || {}).map(item => item?.dati).find(data => data?.stain_snapshot || data?.categorie_scarto)
  const objectives = Array.isArray(baseline?.obiettivi) ? baseline.obiettivi : []
  const selectedObjective = objectives.find(row => row.id === form.objectiveId)
  const objectiveState = useMemo(() => {
    if (!objectives.length && !form.objectiveId) return { context: null, error: '' }
    try { return { context: objectiveContext(baseline || {}, selectedObjective), error: '' } }
    catch (error) { return { context: null, error: error.message } }
  }, [baseline, form.objectiveId])
  const currentObjective = objectiveState.context
  const objectiveError = objectiveState.error
  const objectiveStale = Boolean(currentObjective && form.objectiveFingerprint !== currentObjective.fingerprint)
  const objectiveBlocked = Boolean(objectiveError || objectiveStale)
  let phaseScope = null
  if (form.mode === 'stain' && baseline) {
    try { phaseScope = objectives.length ? currentObjective?.scope || null : baselineScope(baseline) } catch { phaseScope = null }
  }
  const scopeSignature = value => value ? JSON.stringify([value.line, [...(value.products || [])].sort(), [...(value.types || [])].sort(), [...(value.priorities || [])].sort()]) : ''
  const scopeStale = Boolean(form.scope && phaseScope && scopeSignature(form.scope) !== scopeSignature(phaseScope))
  useEffect(() => {
    if (!dirty.current && !savingRef.current) {
      const next = { ...empty(), ...(stepData?.dati?.saving_economico || {}) }
      formRef.current = next
      setForm(next)
    }
  }, [stepData?.dati])
  const change = (patch, preserveReview = false) => {
    let linked = { ...patch }
    const current = formRef.current
    const period = linked.verificationPeriod || current.verificationPeriod || 'custom'
    const restoration = linked.trendRestoration ?? current.trendRestoration
    const improvement = linked.trendImprovement ?? current.trendImprovement
    if (period !== 'custom' && ['verificationPeriod', 'trendRestoration', 'trendImprovement'].some(key => key in linked)) {
      linked.afterFrom = period === 'improvement' ? improvement || '' : restoration || ''
      if (period === 'restoration') linked.afterTo = improvement ? previousDay(improvement) : ''
    }
    if (!('rows' in linked) && ['afterFrom', 'afterTo'].some(key => key in linked && linked[key] !== current[key])) {
      linked = { ...linked, after: null, rows: current.mode === 'manuale' ? current.rows.map(row => ({ ...row, afterLoss: '', afterProduction: '' })) : [], excluded: [], result: null }
    }
    const next = { ...current, ...linked, ...(preserveReview ? {} : { reviewed: false, reviewedBy: '', reviewedAt: '' }) }
    formRef.current = next
    dirty.current = true
    revision.current += 1
    setSaveState('dirty')
    setStatus('Modifiche in attesa di salvataggio automatico')
    setForm(next)
  }
  const selectObjective = id => {
    if (busy) return
    if (form.rows.length && !window.confirm('Cambiare obiettivo? Il confronto precedente verra azzerato.')) return
    const objective = objectives.find(row => row.id === id)
    try {
      const context = objectiveContext(baseline, objective)
      change({ ...objectivePatch(context), verificationPeriod: 'custom', before: context.scope ? JSON.parse(JSON.stringify(baseline.stain_snapshot)) : null })
      setPeriodStatus(context.meta.source === 'manuale' ? 'Perdite prima recuperate. Inserisci produzione e dati dopo per lo stesso perimetro.' : 'Obiettivo acquisito. Seleziona il periodo dopo.')
    } catch (error) {
      change({ ...objectivePatch({ meta: { id, source: objective?.fonte }, fingerprint: '', scope: null, rows: [], from: '', to: '' }), objectiveSnapshot: null })
      setPeriodStatus(error.message)
    }
  }
  const patchRow = (id, key, value) => change({ rows: form.rows.map(row => row.id === id ? { ...row, [key]: value, ...(key === 'driver' ? { driverSource: 'manuale' } : {}) } : row) })
  const applyDrivers = async () => {
    if (objectiveBlocked) { setDriverStatus('Aggiorna prima obiettivo e confronto.'); return }
    if (!driverVersion || !form.rows.length) { setDriverStatus('Carica il confronto e seleziona una versione driver.'); return }
    if (!major?.reparto || !major?.linea) { setDriverStatus('Imposta reparto e linea nel Major.'); return }
    if (!window.confirm('Applicare i driver selezionati alle righe? I valori precedenti saranno sostituiti.')) return
    const requestRevision = revision.current
    setBusy(true)
    try {
      const response = await api.get(`/economic-drivers/${driverVersion}/resolve`, { params: { department: major.reparto, line: major.linea } })
      if (requestRevision !== revision.current || !mountedRef.current) { setDriverStatus('Dati modificati: applica nuovamente i driver.'); return }
      const snapshot = response.data
      change({ driverSnapshot: snapshot, rows: form.rows.map(row => {
        const value = snapshot.resource[row.type]
        if (value == null || !Number.isFinite(Number(value))) throw new Error('Driver da configurare per il tipo di perdita')
        return { ...row, driver: value, driverYear: String(snapshot.year), driverRef: `${snapshot.filename} · ${snapshot.resource.code} · ${snapshot.version_id}`, driverSource: 'settings' }
      }) })
      setDriverStatus('Driver applicati. Salvataggio automatico dello snapshot in corso.')
    } catch (error) { setDriverStatus(typeof error.response?.data?.detail === 'string' ? error.response.data.detail : error.message || 'Driver da configurare') }
    finally { setBusy(false) }
  }
  const result = calculateSaving(form.rows, form.costs === '' ? 0 : form.costs, '')
  const issues = [...result.issues]
  const beforeFrom = form.mode === 'stain' ? form.scope?.from : form.manualBeforeFrom
  const beforeTo = form.mode === 'stain' ? form.scope?.to : form.manualBeforeTo
  const today = todayDate()
  const firstAfter = dayAfter(beforeTo)
  const periodError = !beforeFrom || !beforeTo || !form.afterFrom || !form.afterTo ? 'Seleziona i quattro estremi dei periodi prima e dopo.' : beforeFrom > beforeTo || form.afterFrom > form.afterTo ? 'Ogni periodo deve avere la fine successiva o uguale all’inizio.' : form.afterFrom <= beforeTo ? 'I periodi si sovrappongono: la fine del prima deve precedere l’inizio del dopo.' : beforeTo > today || form.afterTo > today ? 'Scegli periodi gia trascorsi: non si calcolano dati futuri.' : ''

      if (objectiveError) issues.push(objectiveError)
    if (objectiveStale) issues.push('Obiettivo o dati della Fase 1 modificati: importa nuovamente obiettivo e confronto.')
    if (form.mode === 'manuale' && currentObjective && form.rows.some(row => !currentObjective.rows.some(item => item.product === row.product && item.type === row.type))) issues.push('Riga manuale fuori dal perimetro obiettivo.')
    if (periodError) issues.push(periodError)
    if (form.verificationPeriod === 'restoration' && (!form.trendRestoration || !form.trendImprovement || form.trendImprovement <= form.trendRestoration)) issues.push('Definisci ripristino e miglioramento in ordine cronologico.')
    if (form.verificationPeriod === 'improvement' && !form.trendImprovement) issues.push('Indica la data del miglioramento.')
    if (form.verificationPeriod === 'all' && !form.trendRestoration) issues.push('Indica la data del ripristino.')
  if (scopeStale) issues.push('Il perimetro della Fase 1 è cambiato dopo l’importazione: importa di nuovo linea, filtri e periodo prima di calcolare il saving.')

  if (!beforeFrom || !beforeTo || !form.afterFrom || !form.afterTo || beforeFrom > beforeTo || form.afterFrom > form.afterTo || form.afterFrom <= beforeTo) issues.push('Definisci periodi validi, non sovrapposti: il dopo deve iniziare dopo la baseline.')
  if (form.mode === 'stain' && (!form.before || form.before.dal !== beforeFrom || form.before.al !== beforeTo || !form.after || form.after.dal !== form.afterFrom || form.after.al !== form.afterTo)) issues.push('Carica entrambi i periodi per le date selezionate.')
  if (form.mode === 'manuale' && !form.source.trim()) issues.push('Documenta fonte, linea, prodotti e causali del confronto manuale.')
  if (form.costs !== '' && Number(String(form.costs).replace(',', '.')) > 0 && !form.costNote.trim()) issues.push('Descrivi i costi di implementazione.')

  const capture = () => {
    try {
      if (!baseline) throw new Error('Salva prima la baseline della Fase 1.')
      if (objectives.length) { selectObjective(form.objectiveId); return }
      if (form.scope && !window.confirm('Sostituire lo snapshot baseline? Il confronto dopo e i calcoli saranno azzerati.')) return
      const scope = baselineScope(baseline)
      aggregateSnapshot(baseline.stain_snapshot, scope)
      change({ scope, before: JSON.parse(JSON.stringify(baseline.stain_snapshot)), after: null, rows: [], driverSnapshot: null, afterFrom: '', afterTo: '' })
      setPeriodStatus('Linea e filtri acquisiti. Puoi modificare qui il periodo prima e scegliere un periodo dopo gia trascorso. La Fase 1 non viene modificata.')
    } catch (error) { setPeriodStatus(error.message) }
  }
  const load = async () => {
    if (periodError || objectiveBlocked) { setPeriodStatus(periodError || objectiveError || 'Importa nuovamente obiettivo.'); return }
    const span = Date.parse(`${form.afterTo}T00:00:00Z`) - Date.parse(`${beforeFrom}T00:00:00Z`)
    if (span > 366 * 86400000) { setPeriodStatus('Grafico e saving richiedono un periodo continuo di massimo 367 giorni.'); return }
    const requestRevision = revision.current
    setBusy(true)
    setPeriodStatus('Lettura STAIN in corso...')
    try {
      const params = { linea: form.scope.line, tipi: form.scope.types.join(',') }
      const response = await api.get('/stain/scarti', { params: { ...params, dal: beforeFrom, al: form.afterTo }, timeout: 180000 })
      const continuous = response.data
      const slice = (from, to) => ({ ...continuous, dal: from, al: to,
        produzione: (continuous.produzione || []).filter(row => row.data >= from && row.data <= to),
        dettaglio: (continuous.dettaglio || []).filter(row => row.data >= from && row.data <= to),
      })
      const beforeResponse = { data: slice(beforeFrom, beforeTo) }
      const afterResponse = { data: slice(form.afterFrom, form.afterTo) }
      if (requestRevision !== revision.current || !mountedRef.current) { setPeriodStatus('Dati modificati: ricarica il confronto.'); return }
      const excluded = incomparableProducts(beforeResponse.data, afterResponse.data, form.scope)
      const rows = compareSnapshots(beforeResponse.data, afterResponse.data, form.scope, form.rows)
      const comparableScope = { ...form.scope, products: [...new Set(rows.map(row => row.product))] }
      buildScrapTrend(continuous, comparableScope)
      change({ before: beforeResponse.data, after: afterResponse.data, rows, excluded,
        trendData: { key: form.mode + trendKey(comparableScope, beforeFrom, form.afterTo), snapshot: continuous },
      })
      setPeriodStatus(`Grafico e confronto aggiornati: ${rows.length} righe${excluded.length ? `, ${excluded.length} prodotti esclusi` : ''}. Ora applica i driver economici.`)
    } catch (error) { setPeriodStatus(error.response?.data?.detail || error.message || 'Lettura STAIN non riuscita') }
    finally { setBusy(false) }
  }
  draftStateRef.current = { form, result, issues, periodError }
  persistRef.current = async () => {
    clearTimeout(timerRef.current)
    if (!dirty.current || savingRef.current) return
    const state = draftStateRef.current
    const snapshot = formRef.current
    const rev = revision.current
    const currentCalculation = state && state.form === snapshot
    const ready = Boolean(currentCalculation && state.issues.length === 0)
    const comparisonReady = Boolean(currentCalculation && !objectiveBlocked && !scopeStale && !state.periodError && snapshot.rows.length && (
      snapshot.mode === 'manuale'
        ? snapshot.manualBeforeFrom && snapshot.manualBeforeTo && snapshot.afterFrom && snapshot.afterTo
        : snapshot.before && snapshot.after && snapshot.before.dal === snapshot.scope?.from && snapshot.before.al === snapshot.scope?.to && snapshot.after.dal === snapshot.afterFrom && snapshot.after.al === snapshot.afterTo
    ))
    const driversReady = Boolean(snapshot.rows.length && snapshot.rows.every(row =>
      row.driver !== '' && row.driver != null && Number.isFinite(Number(String(row.driver).replace(',', '.'))) && Number(String(row.driver).replace(',', '.')) >= 0 && /^\d{4}$/.test(String(row.driverYear || '')) && String(row.driverRef || '').trim()
    ))
    const reviewed = Boolean(ready && snapshot.reviewed)
    const payload = {
      ...snapshot,
      formula_version: 'scrap_normalized_v1',
      saved_at: new Date().toISOString(),
      result: ready ? {
        gross: state.result.gross,
        avoided: state.result.avoided,
        net: snapshot.costs === '' ? null : state.result.net,
        annualGross: null,
        rows: state.result.rows,
      } : null,
      validation: ready ? (reviewed ? 'validato' : 'calcolato_non_validato') : 'bozza_incompleta',
    }
    savingRef.current = true
    if (mountedRef.current) {
      setSaveState('saving')
      setStatus('Salvataggio automatico...')
    }
    let failed = false
    try {
      const response = await onChangeRef.current({
        dati: { ...baseRef.current, saving_economico: payload },
        output_compilati: {
          confronto_prima_dopo: comparisonReady,
          driver_economici: driversReady,
          saving_calcolato: ready,
          verifica_risultati: reviewed,
        },
      })
      if (response === false) throw new Error('Salvataggio rifiutato')
      if (revision.current === rev) {
        dirty.current = false
        if (mountedRef.current) {
          setSaveState('saved')
          setStatus(ready ? 'Salvato automaticamente' : 'Bozza salvata automaticamente, anche con dati incompleti')
        }
      }
    } catch {
      failed = true
      if (mountedRef.current) {
        setSaveState('error')
        setStatus('Errore di salvataggio: modifiche ancora nella pagina. Premi Riprova.')
      }
    } finally {
      savingRef.current = false
      if (dirty.current && (!failed || revision.current !== rev)) {
        if (mountedRef.current) {
          timerRef.current = setTimeout(() => persistRef.current?.(), 800)
        } else {
          persistRef.current?.()
        }
      }
    }
  }
  useEffect(() => {
    if (!dirty.current) return
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => persistRef.current?.(), 800)
    return () => clearTimeout(timerRef.current)
  }, [form])
  useEffect(() => {
    mountedRef.current = true
    const guard = event => {
      if (dirty.current || savingRef.current) {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', guard)
    return () => {
      mountedRef.current = false
      window.removeEventListener('beforeunload', guard)
      clearTimeout(timerRef.current)
      if (dirty.current && !savingRef.current) persistRef.current?.()
    }
  }, [])
  useEffect(() => {
    if (objectives.length || form.objectiveId || form.mode !== 'stain' || form.scope || !baseline || dirty.current) return
    try {
      const scope = baselineScope(baseline)
      aggregateSnapshot(baseline.stain_snapshot, scope)
      change({ scope, before: JSON.parse(JSON.stringify(baseline.stain_snapshot)) })
    } catch {
      setPeriodStatus('Baseline non disponibile: carica e salva i dati nella Fase 1, poi importali qui.')
    }
  }, [baseline, form.mode, form.scope])
  useEffect(() => {
    if (objectives.length !== 1 || form.objectiveId || busy || dirty.current || savingRef.current) return
    if (form.rows.length) return
    selectObjective(objectives[0].id)
  }, [baseline, form.objectiveId, busy, form.rows.length])
  useEffect(() => {
    if (!form.objectiveId || !objectiveBlocked || (!form.rows.length && !form.result && !form.reviewed)) return
    change({ rows: [], before: null, after: null, trendData: null, result: null, reviewed: false, reviewedBy: '', reviewedAt: '' })
  }, [objectiveBlocked, form.objectiveId, form.rows.length, form.result, form.reviewed])
  const input = (label, key, type = 'text') => {
    const beforeDate = key === 'comparisonFrom' || key === 'comparisonTo'
    const value = beforeDate ? (key === 'comparisonFrom' ? beforeFrom : beforeTo) || '' : form[key]
    return <label className="text-sm block">{label}<input className={field} type={type} disabled={busy || (key === 'afterFrom' && form.verificationPeriod && form.verificationPeriod !== 'custom') || (key === 'afterTo' && form.verificationPeriod === 'restoration')} min={   type === 'number'     ? '0'     : key === 'afterFrom'       ? dayAfter(beforeTo) || undefined       : key === 'afterTo'         ? form.afterFrom && form.afterFrom > beforeTo           ? form.afterFrom           : dayAfter(beforeTo) || undefined         : undefined } max={type === 'date' ? today : undefined} step={type === 'number' ? 'any' : undefined} value={value} onChange={event => {
      const value = event.target.value
      if (beforeDate) {
        change({ scope: { ...form.scope, [key === 'comparisonFrom' ? 'from' : 'to']: value }, before: null, after: null, rows: [] })
      } else if (type === 'date') {
        change({ [key]: value, after: null, rows: form.mode === 'manuale' ? form.rows.map(row => ({ ...row, afterLoss: '', afterProduction: '', ...(['manualBeforeFrom', 'manualBeforeTo'].includes(key) ? { beforeLoss: '', beforeProduction: '' } : {}) })) : [] })
      } else {
        change({ [key]: value })
      }
      if (type === 'date') setPeriodStatus('Date modificate. Premi Carica confronto da STAIN per ricalcolare entrambi i periodi.')
    }} /></label>
  }
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-gray-600">
        <span role="status" aria-live="polite" className={saveState === 'error' ? 'text-red-700' : ''}>{saveState === 'saving' ? 'Salvataggio...' : saveState === 'dirty' ? 'Modifiche da salvare...' : saveState === 'error' ? 'Errore: riprova in fondo alla pagina' : 'Salvato'}</span>
      </div>
      <section className={section}>
        <h3 className="font-bold text-primary">1 · Confronto prima e dopo</h3>
        <p className="text-sm text-gray-600">Confronto delle percentuali di perdita sulla produzione, per prodotto e tipo. La differenza viene valorizzata in kg e in euro: Saving indica un miglioramento; Maggior costo stimato indica un peggioramento. La variazione in punti percentuali e calcolata come dopo meno prima: positiva significa aumento delle perdite.</p>
                  {(objectives.length > 0 || form.objectiveId) && <div className="space-y-2">
            <label className="block text-sm">Obiettivo della Fase 1<select className={field} disabled={busy} value={form.objectiveId} onChange={event => selectObjective(event.target.value)}>
              <option value="">Seleziona obiettivo</option>
              {form.objectiveId && !selectedObjective && <option value={form.objectiveId}>Obiettivo rimosso</option>}
              {objectives.map((row, index) => <option key={row.id} value={row.id}>{objectiveLabel(row, index)}</option>)}
            </select></label>
            {selectedObjective && <p className="text-sm">Baseline: {fmt(selectedObjective.baseline)} {selectedObjective.unit} · Target: {fmt(selectedObjective.target)} {selectedObjective.unit}</p>}
            {objectiveBlocked && <p role="alert" className="text-sm text-amber-800">{objectiveError || 'Obiettivo modificato: importa nuovamente il confronto.'}</p>}
            <button type="button" className={button} disabled={busy || !selectedObjective} onClick={() => selectObjective(form.objectiveId)}>Importa / aggiorna obiettivo</button>
          </div>}
          <label className="block text-sm">Fonte<select className={field} disabled={busy || objectives.length > 0 || Boolean(form.objectiveId)} value={form.mode} onChange={event => { if (!form.rows.length || window.confirm('Cambiare fonte e azzerare il confronto?')) change({ ...empty(), mode: event.target.value }) }}><option value="stain">STAIN</option><option value="manuale">Confronto manuale in kg</option></select></label>
        {form.mode === 'stain' ? <>
          {!objectives.length && <button type="button" disabled={busy} className={button} onClick={capture}>Importa linea, filtri e periodo dalla Fase 1</button>}
          {scopeStale && <div role="alert" className="text-sm bg-amber-50 border border-amber-300 text-amber-900 p-3 rounded space-y-1"><p className="font-semibold">Il perimetro della Fase 1 è diverso da quello usato qui.</p><p>Fase 1 - Prodotti: {phaseScope.products.join(', ') || 'Tutti'} · Causali: {phaseScope.priorities.join(', ') || 'Tutte le causali dei tipi selezionati'}</p><p>Qui - Prodotti: {form.scope.products.join(', ') || 'Tutti'} · Causali: {form.scope.priorities.join(', ') || 'Tutte le causali dei tipi selezionati'}</p><p>Premi Importa linea, filtri e periodo dalla Fase 1. Il confronto dopo verrà azzerato e andrà ricaricato.</p></div>}
          {form.scope && <div className="text-sm bg-gray-50 p-3 rounded"><p>{form.scope.line} · {form.scope.from} / {form.scope.to}</p><p>Prodotti: {form.scope.products.join(', ') || 'Tutti'} · Causali: {form.scope.priorities.join(', ') || 'Tutte le causali dei tipi selezionati'}</p><p>Baseline del confronto. Le modifiche non cambiano la Fase 1.</p></div>}
        </> : <><div className="grid md:grid-cols-2 gap-3">{input('Baseline da', 'manualBeforeFrom', 'date')}{input('Baseline a', 'manualBeforeTo', 'date')}</div>{input('Fonte e perimetro manuale (linea, prodotti, causali, evidenze)', 'source')}{form.objectiveId && <p className="text-xs text-gray-600">Inserisci solo perdite del perimetro selezionato. La produzione non viene ricostruita dalla raccolta manuale.</p>}</>}
        <p className="text-sm text-gray-600">Scegli gli interventi e il periodo da verificare. Il saving usa questi stessi estremi.</p>
        {form.mode === 'stain' && form.scope && <div className="grid md:grid-cols-2 gap-3">{input('Periodo prima da', 'comparisonFrom', 'date')}{input('Periodo prima a', 'comparisonTo', 'date')}</div>}
        <div className="grid md:grid-cols-2 gap-3">
          <div className="space-y-2">
            <InterventionSelect label="Ripristino" kind="ripristino" items={interventions} value={form.trendRestorationRef} refKey="trendRestorationRef" dateKey="trendRestoration" change={change} />
            <label className="block text-sm">Data ripristino<input type="date" className={field} min={undefined} max={today} value={form.trendRestoration || ''} onChange={event => change({ trendRestoration: event.target.value, trendRestorationRef: '' })} /></label>
          </div>
          <div className="space-y-2">
            <InterventionSelect label="Miglioramento" kind="miglioramento" items={interventions} value={form.trendImprovementRef} refKey="trendImprovementRef" dateKey="trendImprovement" change={change} />
            <label className="block text-sm">Data miglioramento<input type="date" className={field} min={undefined} max={today} value={form.trendImprovement || ''} onChange={event => change({ trendImprovement: event.target.value, trendImprovementRef: '' })} /></label>
          </div>
        </div>
        <label className="block text-sm">Periodo da verificare<select className={field} disabled={busy} value={form.verificationPeriod || 'custom'} onChange={event => change({ verificationPeriod: event.target.value })}>
<option value="custom">Periodo personalizzato</option>
<option value="restoration" disabled={!form.trendRestoration || !form.trendImprovement}>Dopo il ripristino, prima del miglioramento</option>
<option value="improvement" disabled={!form.trendImprovement}>Dopo l'intervento di miglioramento</option>
<option value="all" disabled={!form.trendRestoration}>Intero periodo dal ripristino</option>
</select></label><p className="text-xs text-gray-600">Un solo periodo per grafico e saving. Dopo una modifica ricarica il confronto.</p>
<div className="grid md:grid-cols-2 gap-3">{input('Periodo dopo da', 'afterFrom', 'date')}{input('Periodo dopo a', 'afterTo', 'date')}</div>
        {form.mode === 'stain' && <button type="button" disabled={busy || !form.scope || Boolean(periodError) || scopeStale || objectiveBlocked} className={button} onClick={load}>{busy ? 'Caricamento...' : 'Aggiorna grafico e saving da STAIN'}</button>}
        {periodError && <p role="alert" className="text-sm text-amber-800">{periodError}</p>}
        {periodStatus && <p role="status" aria-live="polite" className="text-sm">{periodStatus}</p>}
        {form.rows.length > 0 && form.excluded?.length > 0 && <div role="alert" className="text-sm bg-amber-50 border border-amber-300 text-amber-900 p-3 rounded space-y-1"><p className="font-semibold">Prodotti esclusi dal saving: produzione assente nel periodo indicato</p>{form.excluded.map(item => <p key={item.product}>{item.product}: assente in {item.missing} · perdite prima {fmt(item.beforeLoss)} kg, dopo {fmt(item.afterLoss)} kg</p>)}<p>Le loro perdite non sono valorizzate nel saving.</p></div>}
      </section>
      <ScrapInterventionTrend form={form} change={change} from={beforeFrom} to={form.afterTo} interventions={interventions} />
      <section className={section}>
        <h3 className="font-bold text-primary">2 · Risultato del periodo selezionato</h3><p className="text-sm">Baseline: {beforeFrom || "Da definire"} / {beforeTo || "Da definire"} · Verifica: {form.afterFrom || "Da definire"} / {form.afterTo || "Da definire"}</p>
        <p className="text-xs text-gray-600">Driver €/kg dalla versione annuale dei Settings, oppure inserimento manuale documentato. Scarto e rework distinti: non inserire gli stessi kg due volte. Le produzioni per uno stesso prodotto devono coincidere. Nessuna formula manodopera inclusa.</p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm flex-1">Versione driver economici<select className={field} disabled={busy} value={driverVersion} onChange={event => change({ selectedDriverVersion: event.target.value })}><option value="">Seleziona anno e versione</option>{driverVersions.map(version => <option key={version.id} value={version.id}>{version.year} · {version.filename} · {new Date(version.created_at).toLocaleString('it-IT')}</option>)}</select></label>
          <button type="button" className={button} disabled={busy || !driverVersion || !form.rows.length} onClick={applyDrivers}>Applica driver della linea</button>
        </div>
        {!form.rows.length && <p className="text-sm text-amber-800">Prima carica il confronto nel punto 1. Solo dopo puoi applicare i costi alle righe.</p>}
        {form.rows.length > 0 && !driverVersion && <p className="text-sm">Seleziona una versione driver pubblicata nei Settings.</p>}
        {!driverVersions.length && <p className="text-sm">Nessuna versione driver disponibile: verifica la pubblicazione nei Settings.</p>}
        {driverStatus && <p role="status" className="text-sm">{driverStatus}</p>}
        {form.driverSnapshot && <p className="text-xs text-gray-600">Snapshot driver: {form.driverSnapshot.year} · {form.driverSnapshot.resource.code} · {form.driverSnapshot.filename}. I nuovi caricamenti annuali non aggiornano automaticamente questo progetto. Modifiche manuali restano distinguibili nelle righe salvate.</p>}
        {form.mode === 'manuale' && !form.objectiveId && <button type="button" disabled={busy} className={button} onClick={() => change({ rows: [...form.rows, { id: globalThis.crypto?.randomUUID?.() || `r_${Date.now()}`, product: '', type: 'scarto', beforeProduction: '', beforeLoss: '', afterProduction: '', afterLoss: '', driver: '', driverYear: '', driverRef: '' }] })}>Aggiungi prodotto / tipo</button>}
        {form.rows.length > 0 && <div className="overflow-x-auto"><table className="w-full min-w-[1450px] text-xs"><thead><tr>{['Prodotto', 'Tipo', 'Produzione prima kg', 'Perdita prima kg', 'Produzione dopo kg', 'Perdita dopo kg', 'Driver €/kg', 'Anno', 'Riferimento driver', 'Perdita prima %', 'Perdita dopo %', 'Variazione p.p.', 'Esito kg', 'Esito economico', ''].map((label, index) => <th key={index} className="p-2 text-left border-b">{label}</th>)}</tr></thead><tbody>
          {form.rows.map(row => { const computed = result.rows.find(item => item.id === row.id); return <tr key={row.id}>
            <td className="p-1"><input aria-label="Prodotto" className={field} disabled={form.mode === 'stain' || Boolean(form.objectiveId)} value={row.product} onChange={event => patchRow(row.id, 'product', event.target.value)} /></td>
            <td className="p-1"><select aria-label="Tipo perdita" className={field} disabled={form.mode === 'stain' || Boolean(form.objectiveId)} value={row.type} onChange={event => patchRow(row.id, 'type', event.target.value)}><option value="scarto">Scarto</option><option value="rework">Rework</option></select></td>
            {['beforeProduction', 'beforeLoss', 'afterProduction', 'afterLoss', 'driver', 'driverYear', 'driverRef'].map(key => <td key={key} className="p-1"><input aria-label={key} className={field} disabled={form.mode === 'stain' && ['beforeProduction', 'beforeLoss', 'afterProduction', 'afterLoss'].includes(key)} type={key === 'driverRef' ? 'text' : 'number'} min="0" step="any" value={row[key]} onChange={event => patchRow(row.id, key, event.target.value)} /></td>)}
            <td className="p-2">{fmt(rate(row.beforeLoss, row.beforeProduction))}%</td>
            <td className="p-2">{fmt(rate(row.afterLoss, row.afterProduction))}%</td>
            <td className="p-2">{fmt(rate(row.afterLoss, row.afterProduction) - rate(row.beforeLoss, row.beforeProduction))} p.p.</td>
            <td className={`p-2 ${computed?.avoided < 0 ? 'text-red-700' : 'text-green-800'}`}>{outcome(computed?.avoided, 'Risparmiati', 'Aggiuntivi', 'kg')}</td>
            <td className={`p-2 ${computed?.gross < 0 ? 'text-red-700' : 'text-green-800'}`}>{outcome(computed?.gross, 'Saving', 'Maggior costo stimato', '€')}</td><td>{form.mode === 'manuale' && !form.objectiveId && <button type="button" onClick={() => change({ rows: form.rows.filter(item => item.id !== row.id) })}>Elimina</button>}</td>
          </tr> })}
        </tbody></table></div>}
        <div className="grid md:grid-cols-2 gap-3">{input('Costi implementazione € (facoltativi)', 'costs', 'number')}{input('Descrizione e fonte dei costi', 'costNote')}</div>
        {form.rows.length > 0 && (issues.length ? <div className="text-sm text-amber-800">{[...new Set(issues)].map(issue => <p key={issue}>{issue}</p>)}</div> : <div className="grid md:grid-cols-2 gap-3">
          <div className="bg-gray-50 rounded p-3"><div className="text-xs">{result.avoided < 0 ? 'Kg aggiuntivi rispetto all’atteso' : 'Kg risparmiati'}</div><strong>{fmt(Math.abs(result.avoided))}</strong></div>
          <div className="bg-gray-50 rounded p-3"><div className="text-xs">{result.gross < 0 ? 'Maggior costo stimato del periodo €' : 'Saving lordo del periodo €'}</div><strong>{fmt(Math.abs(result.gross))}</strong></div>
          {form.costs !== '' && <p className="text-sm">{result.net < 0 ? 'Saldo netto negativo, inclusi costi' : 'Beneficio netto'}: {fmt(Math.abs(result.net))} €</p>}
        </div>)}
        {form.rows.length > 0 && !issues.length && <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={Boolean(form.reviewed)} onChange={event => change(event.target.checked ? { reviewed: true, reviewedBy: user?.full_name || user?.email || '', reviewedAt: new Date().toISOString() } : { reviewed: false, reviewedBy: '', reviewedAt: '' }, true)} />
          Risultato verificato
          {form.reviewed && form.reviewedBy && <span className="text-xs text-gray-500">{form.reviewedBy} · {new Date(form.reviewedAt).toLocaleDateString('it-IT')}</span>}
        </label>}
      </section>

      <div className="flex flex-wrap justify-end items-center gap-3">
        <span role="status" aria-live="polite" className={`text-sm ${saveState === 'error' ? 'text-red-700' : 'text-gray-600'}`}>{status || ''}</span>
        {saveState === 'error' && <button type="button" className={button} onClick={() => persistRef.current?.()}>Riprova salvataggio</button>}
      </div>
    </div>
  )
}
