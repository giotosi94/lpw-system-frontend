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

function StepBar({ title, hint }) {
  return (
    <>
      <div className="bg-primary text-white text-center font-bold uppercase rounded-lg py-2 text-sm tracking-wide">{title}</div>
      {hint && <p className="text-sm text-gray-600">{hint}</p>}
    </>
  )
}

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
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function previousDay(value) {
  const d = new Date(`${value}T12:00:00`)
  if (Number.isNaN(d.getTime())) return ''
  d.setDate(d.getDate() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function todayDate() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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
    const excluded = selected.filter(point => !point.valid && (point.production !== 0 || point.loss !== 0)).length
    const production = valid.reduce((sum, point) => sum + point.production, 0)
    const loss = valid.reduce((sum, point) => sum + point.loss, 0)
    return { label: range.label, count: valid.length, production, loss, value: production > 0 ? loss / production * 100 : null, excluded }
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
          const closed = ['chiuso', 'closed', 'completato', 'completed', 'done'].includes(String(plan.stato || '').toLowerCase())
          return { key: `ap:${plan._id}`, kind: restoreSteps.has(stepId) ? 'ripristino' : 'miglioramento', label: `${plan.numero || 'AP'} · ${plan.titolo || ''}`, closed, date: isoDay(plan.data_completamento) }
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
    const reload = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', reload)
    window.addEventListener('focus', reload)
    return () => {
      active = false
      document.removeEventListener('visibilitychange', reload)
      window.removeEventListener('focus', reload)
    }
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
        change(item ? (item.date ? { [refKey]: item.key, [dateKey]: item.date } : { [refKey]: item.key }) : { [refKey]: '' })
      }}>
        <option value="">{options.length ? 'Seleziona intervento' : 'Nessun intervento collegato'}</option>
        {options.map(item => <option key={item.key} value={item.key} disabled={!item.date && !item.closed}>{item.label}{item.date ? ` · ${item.date.split('-').reverse().join('/')}` : item.closed ? ' · chiuso' : item.unavailable ? ' · stato non disponibile' : ' · non concluso'}</option>)}
      </select>
    </label>
  )
}

function ScrapInterventionTrend({ form, from, to }) {
  const scope = form.scope && form.rows.length ? { ...form.scope, products: [...new Set(form.rows.map(row => row.product))] } : form.scope
  const key = form.mode + trendKey(scope, from, to)
  const start = Date.parse(`${from}T00:00:00Z`)
  const end = Date.parse(`${to}T00:00:00Z`)
  const restoration = form.trendRestoration || ''
  const improvement = form.trendImprovement || ''
  const markerError = restoration && improvement && improvement <= restoration
    ? 'Il miglioramento deve essere successivo al ripristino per distinguere i tre periodi.'
    : [restoration, improvement].some(date => date && (date < from || date > to))
      ? 'Le date degli interventi devono essere comprese nel periodo del grafico.' : ''
  let points = []
  let dataError = ''
  if (form.rows.length && form.after && form.trendData?.key === key) {
    try { points = buildScrapTrend(form.trendData.snapshot, scope) }
    catch (error) { dataError = error.message }
  }
  const segments = markerError ? [] : trendSegments(points, restoration, improvement)
  const baselinePoints = points.filter(point => point.date >= form.scope?.from && point.date <= form.scope?.to)
  const baselineProduction = baselinePoints.reduce((sum, point) => sum + (point.valid ? point.production : 0), 0)
  const baselineRate = baselineProduction > 0 ? baselinePoints.reduce((sum, point) => sum + (point.valid ? point.loss : 0), 0) / baselineProduction * 100 : null
  const verificationPoints = points.filter(point => point.date >= form.afterFrom && point.date <= form.afterTo && point.valid)
  const invalid = points.filter(point => !point.valid && (point.loss !== 0 || point.production !== 0)).length
  const labelDate = value => new Date(value).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', timeZone: 'UTC' })
  return (
    <section className={section}>
      <StepBar title="Passo 2 - Andamento della perdita" hint="Il grafico si aggiorna dal Passo 1. L'area verde è il periodo verificato." />
      {form.mode !== 'stain' ? <p className="text-sm text-gray-600">Confronto manuale: grafico non disponibile senza dati giornalieri.</p> : <>
        {!points.length && !dataError && <p className="text-sm text-gray-600">Premi “Aggiorna confronto” nel Passo 1.</p>}
        {markerError && points.length > 0 && <p role="alert" className="text-sm text-amber-800">{markerError}</p>}
        {dataError && <p role="alert" className="text-sm text-red-700">{dataError}</p>}
        {form.trendData && form.trendData.key !== key && <p className="text-sm text-amber-800">Date o filtri modificati: aggiorna il confronto.</p>}
        {points.length > 0 && <>
          <p className="text-sm">Verifica: {form.afterFrom} / {form.afterTo} · {verificationPoints.length} giorni produttivi</p>
          <div className="h-80 w-full" role="img" aria-label="Andamento giornaliero della percentuale di perdita">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={points} margin={{ top: 40, right: 30, bottom: 10, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <ReferenceArea x1={Date.parse(`${form.afterFrom}T00:00:00Z`)} x2={Date.parse(`${form.afterTo}T00:00:00Z`)} fill="#15803d" fillOpacity={0.1} />
                <XAxis dataKey="timestamp" type="number" scale="time" domain={[start, end]} tickFormatter={labelDate} />
                <YAxis unit="%" width={65} />
                <Tooltip labelFormatter={value => new Date(value).toLocaleDateString('it-IT', { timeZone: 'UTC' })} formatter={value => [`${fmt(value)}%`, 'Perdita sulla produzione']} />
                <Legend />
                <Line name="Perdita (%)" type="linear" dataKey="value" stroke="#85583f" strokeWidth={2} dot={{ r: 2 }} connectNulls={false} isAnimationActive={false} />
                {!markerError && restoration && <ReferenceLine x={Date.parse(`${restoration}T00:00:00Z`)} stroke="#2563eb" strokeWidth={2} strokeDasharray="5 3" label={{ value: 'Ripristino', position: 'insideTopLeft', fill: '#2563eb' }} />}
                {!markerError && improvement && <ReferenceLine x={Date.parse(`${improvement}T00:00:00Z`)} stroke="#15803d" strokeWidth={2} strokeDasharray="5 3" label={{ value: 'Miglioramento', position: 'insideTopRight', fill: '#15803d' }} />}
                {baselineRate != null && <ReferenceLine y={baselineRate} stroke="#6b7280" strokeDasharray="4 4" label={{ value: `Baseline: ${fmt(baselineRate)}%`, position: 'insideTopRight' }} />}
              </LineChart>
            </ResponsiveContainer>
          </div>
          {!points.some(point => point.valid) && <p className="text-sm text-amber-800">Nessun giorno con produzione e perdite valide.</p>}
          {invalid > 0 && <p className="text-sm text-amber-800">{invalid} giorni con dati incoerenti esclusi dal calcolo.</p>}
          {segments.length > 0 && <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr>{['Periodo', 'Giorni produttivi', 'Perdita', 'Rispetto alla baseline'].map(label => <th key={label} className="text-left border-b p-2">{label}</th>)}</tr></thead><tbody>{segments.map(segment => {
            const reduction = baselineRate > 0 && segment.value != null ? (baselineRate - segment.value) / baselineRate * 100 : null
            return <tr key={segment.label}><td className="p-2">{segment.label}</td><td className="p-2">{segment.count}{segment.excluded > 0 ? ` (${segment.excluded} esclusi)` : ''}</td><td className="p-2">{segment.value == null ? 'Non disponibile' : `${fmt(segment.value)}%`}</td><td className="p-2">{reduction == null ? 'Non disponibile' : `${reduction >= 0 ? 'Riduzione' : 'Aumento'} ${fmt(Math.abs(reduction))}%`}</td></tr>
          })}</tbody></table></div>}
          <p className="text-xs text-gray-500">Perdita = kg persi / kg prodotti nel periodo. Il grafico mostra l'andamento, non dimostra da solo la causa.</p>
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
    if (form.rows.length && !window.confirm('Cambiare obiettivo? Il confronto precedente verrà azzerato.')) return
    const objective = objectives.find(row => row.id === id)
    try {
      const context = objectiveContext(baseline, objective)
      change({ ...objectivePatch(context), verificationPeriod: 'custom', before: context.scope ? JSON.parse(JSON.stringify(baseline.stain_snapshot)) : null })
      setPeriodStatus(context.meta.source === 'manuale' ? 'Perdite prima recuperate. Inserisci produzione e dati dopo.' : 'Obiettivo acquisito. Scegli il periodo da verificare.')
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
      setDriverStatus('Driver applicati.')
    } catch (error) { setDriverStatus(typeof error.response?.data?.detail === 'string' ? error.response.data.detail : error.message || 'Driver da configurare') }
    finally { setBusy(false) }
  }

  const result = calculateSaving(form.rows, form.costs === '' ? 0 : form.costs, '')
  const issues = [...result.issues]
  const beforeFrom = form.mode === 'stain' ? form.scope?.from : form.manualBeforeFrom
  const beforeTo = form.mode === 'stain' ? form.scope?.to : form.manualBeforeTo
  const today = todayDate()
  const periodError = !beforeFrom || !beforeTo || !form.afterFrom || !form.afterTo ? 'Seleziona le date di baseline e verifica.' : beforeFrom > beforeTo || form.afterFrom > form.afterTo ? 'Ogni periodo deve avere la fine successiva o uguale all’inizio.' : form.afterFrom <= beforeTo ? 'I periodi si sovrappongono: la verifica deve iniziare dopo la baseline.' : beforeTo > today || form.afterTo > today ? 'Scegli periodi già trascorsi.' : ''
  const interventionsInverted = Boolean(form.trendRestoration && form.trendImprovement && form.trendImprovement <= form.trendRestoration)
  const firstIntervention = [form.trendRestoration, form.trendImprovement].filter(Boolean).sort()[0]
  const timingWarning = interventionsInverted
    ? 'Il miglioramento è precedente al ripristino: controlla le date.'
    : firstIntervention && form.afterFrom && form.afterFrom < firstIntervention
      ? 'La verifica inizia prima degli interventi: il risultato non misura il loro effetto.'
      : ''

  if (objectiveError) issues.push(objectiveError)
  if (objectiveStale) issues.push('Obiettivo o dati della Fase 1 modificati: importa nuovamente obiettivo e confronto.')
  if (form.mode === 'manuale' && currentObjective && form.rows.some(row => !currentObjective.rows.some(item => item.product === row.product && item.type === row.type))) issues.push('Riga manuale fuori dal perimetro obiettivo.')
  if (periodError) issues.push(periodError)
  if (form.verificationPeriod === 'restoration' && (!form.trendRestoration || !form.trendImprovement || interventionsInverted)) issues.push('Definisci ripristino e miglioramento in ordine cronologico.')
  if (form.verificationPeriod === 'improvement' && !form.trendImprovement) issues.push('Indica la data del miglioramento.')
  if (form.verificationPeriod === 'all' && !form.trendRestoration) issues.push('Indica la data del ripristino.')
  if (scopeStale) issues.push('Il perimetro della Fase 1 è cambiato: importa di nuovo l’obiettivo.')
  if (form.mode === 'stain' && (!form.before || form.before.dal !== beforeFrom || form.before.al !== beforeTo || !form.after || form.after.dal !== form.afterFrom || form.after.al !== form.afterTo)) issues.push('Aggiorna il confronto per le date selezionate.')
  if (form.mode === 'manuale' && !form.source.trim()) issues.push('Documenta fonte, linea, prodotti e causali del confronto manuale.')
  if (form.costs !== '' && Number(String(form.costs).replace(',', '.')) > 0 && !form.costNote.trim()) issues.push('Descrivi i costi di implementazione.')

  const capture = () => {
    try {
      if (!baseline) throw new Error('Salva prima la baseline della Fase 1.')
      if (objectives.length) { selectObjective(form.objectiveId); return }
      if (form.scope && !window.confirm('Sostituire la baseline? Il confronto e i calcoli saranno azzerati.')) return
      const scope = baselineScope(baseline)
      aggregateSnapshot(baseline.stain_snapshot, scope)
      change({ scope, before: JSON.parse(JSON.stringify(baseline.stain_snapshot)), after: null, rows: [], driverSnapshot: null, afterFrom: '', afterTo: '' })
      setPeriodStatus('Baseline acquisita dalla Fase 1. Scegli il periodo da verificare.')
    } catch (error) { setPeriodStatus(error.message) }
  }

  const load = async () => {
    if (periodError || objectiveBlocked) { setPeriodStatus(periodError || objectiveError || 'Importa nuovamente obiettivo.'); return }
    const span = Date.parse(`${form.afterTo}T00:00:00Z`) - Date.parse(`${beforeFrom}T00:00:00Z`)
    if (span > 366 * 86400000) { setPeriodStatus('Baseline e verifica devono stare in massimo 367 giorni.'); return }
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
      if (requestRevision !== revision.current || !mountedRef.current) { setPeriodStatus('Dati modificati: aggiorna di nuovo il confronto.'); return }
      const excluded = incomparableProducts(beforeResponse.data, afterResponse.data, form.scope)
      const rows = compareSnapshots(beforeResponse.data, afterResponse.data, form.scope, form.rows)
      const comparableScope = { ...form.scope, products: [...new Set(rows.map(row => row.product))] }
      buildScrapTrend(continuous, comparableScope)
      change({ before: beforeResponse.data, after: afterResponse.data, rows, excluded,
        trendData: { key: form.mode + trendKey(comparableScope, beforeFrom, form.afterTo), snapshot: continuous },
      })
      setPeriodStatus(`Confronto aggiornato: ${rows.length} righe${excluded.length ? `, ${excluded.length} prodotti esclusi` : ''}.`)
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
          setStatus(ready ? 'Salvato automaticamente' : 'Bozza salvata automaticamente')
        }
      }
    } catch {
      failed = true
      if (mountedRef.current) {
        setSaveState('error')
        setStatus('Errore di salvataggio: premi Riprova.')
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
      setPeriodStatus('Baseline non disponibile: carica e salva i dati nella Fase 1.')
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
    const locked = (key === 'afterFrom' && form.verificationPeriod && form.verificationPeriod !== 'custom') || (key === 'afterTo' && form.verificationPeriod === 'restoration')
    const min = type === 'number'
      ? '0'
      : key === 'afterFrom'
        ? dayAfter(beforeTo) || undefined
        : key === 'afterTo'
          ? form.afterFrom && form.afterFrom > beforeTo ? form.afterFrom : dayAfter(beforeTo) || undefined
          : undefined
    return <label className="text-sm block">{label}<input className={field} type={type} disabled={busy || locked} min={min} max={type === 'date' ? today : undefined} step={type === 'number' ? 'any' : undefined} value={value} onChange={event => {
      const value = event.target.value
      if (beforeDate) {
        change({ scope: { ...form.scope, [key === 'comparisonFrom' ? 'from' : 'to']: value }, before: null, after: null, rows: [] })
      } else if (type === 'date') {
        change({ [key]: value, after: null, rows: form.mode === 'manuale' ? form.rows.map(row => ({ ...row, afterLoss: '', afterProduction: '', ...(['manualBeforeFrom', 'manualBeforeTo'].includes(key) ? { beforeLoss: '', beforeProduction: '' } : {}) })) : [] })
      } else {
        change({ [key]: value })
      }
      if (type === 'date') setPeriodStatus('Date modificate: premi Aggiorna confronto.')
    }} /></label>
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-gray-600">
        <span role="status" aria-live="polite" className={saveState === 'error' ? 'text-red-700' : ''}>{saveState === 'saving' ? 'Salvataggio...' : saveState === 'dirty' ? 'Modifiche da salvare...' : saveState === 'error' ? 'Errore: riprova in fondo alla pagina' : 'Salvato'}</span>
      </div>

      <section className={section}>
        <StepBar title="Passo 1 - Obiettivo e periodo" hint="Scegli l'obiettivo, gli interventi e il periodo da verificare." />

        {(objectives.length > 0 || form.objectiveId) && <div className="space-y-2">
          <label className="block text-sm">Obiettivo della Fase 1<select className={field} disabled={busy} value={form.objectiveId} onChange={event => selectObjective(event.target.value)}>
            <option value="">Seleziona obiettivo</option>
            {form.objectiveId && !selectedObjective && <option value={form.objectiveId}>Obiettivo rimosso</option>}
            {objectives.map((row, index) => <option key={row.id} value={row.id}>{objectiveLabel(row, index)}</option>)}
          </select></label>
          {objectiveBlocked && <div className="flex flex-wrap items-center gap-3"><p role="alert" className="text-sm text-amber-800">{objectiveError || 'Obiettivo modificato nella Fase 1.'}</p><button type="button" className={button} disabled={busy || !selectedObjective} onClick={() => selectObjective(form.objectiveId)}>Aggiorna obiettivo</button></div>}
        </div>}

        {!objectives.length && !form.objectiveId && <label className="block text-sm">Fonte<select className={field} disabled={busy} value={form.mode} onChange={event => { if (!form.rows.length || window.confirm('Cambiare fonte e azzerare il confronto?')) change({ ...empty(), mode: event.target.value }) }}><option value="stain">STAIN</option><option value="manuale">Confronto manuale in kg</option></select></label>}

        {form.mode === 'stain' ? <>
          {!objectives.length && <button type="button" disabled={busy} className={button} onClick={capture}>Importa baseline dalla Fase 1</button>}
          {scopeStale && <div role="alert" className="text-sm bg-amber-50 border border-amber-300 text-amber-900 p-3 rounded flex flex-wrap items-center gap-3"><span>Il perimetro della Fase 1 è cambiato.</span><button type="button" className={button} disabled={busy} onClick={capture}>Aggiorna</button></div>}
          {form.scope && <div className="text-sm bg-gray-50 p-3 rounded">
            <p><strong>{form.scope.line}</strong> · {form.objectiveSnapshot?.source === 'manuale' ? 'Manuale' : 'STAIN'}{selectedObjective ? ` · Baseline ${fmt(selectedObjective.baseline)} ${selectedObjective.unit} → Target ${fmt(selectedObjective.target)} ${selectedObjective.unit}` : ''}</p>
            <p className="text-gray-600">Prodotti: {form.scope.products.join(', ') || 'Tutti'} · Perdite: {form.scope.priorities.join(', ') || 'Tutte'}</p>
          </div>}
        </> : <>
          <div className="grid md:grid-cols-2 gap-3">{input('Baseline da', 'manualBeforeFrom', 'date')}{input('Baseline a', 'manualBeforeTo', 'date')}</div>
          {input('Fonte dei dati manuali', 'source')}
        </>}

        {form.mode === 'stain' && form.scope && <div className="grid md:grid-cols-2 gap-3">{input('Baseline da', 'comparisonFrom', 'date')}{input('Baseline a', 'comparisonTo', 'date')}</div>}

        <div className="grid md:grid-cols-2 gap-3">
          <div className="space-y-2">
            <InterventionSelect label="Ripristino" kind="ripristino" items={interventions} value={form.trendRestorationRef} refKey="trendRestorationRef" dateKey="trendRestoration" change={change} />
            <label className="block text-sm">Data ripristino<input type="date" className={field} max={today} value={form.trendRestoration || ''} onChange={event => change({ trendRestoration: event.target.value })} /></label>
            {form.trendRestorationRef && !form.trendRestoration && <p className="text-xs text-amber-800">Inserisci la data di esecuzione</p>}
          </div>
          <div className="space-y-2">
            <InterventionSelect label="Miglioramento" kind="miglioramento" items={interventions} value={form.trendImprovementRef} refKey="trendImprovementRef" dateKey="trendImprovement" change={change} />
            <label className="block text-sm">Data miglioramento<input type="date" className={field} max={today} value={form.trendImprovement || ''} onChange={event => change({ trendImprovement: event.target.value })} /></label>
            {form.trendImprovementRef && !form.trendImprovement && <p className="text-xs text-amber-800">Inserisci la data di esecuzione</p>}
          </div>
        </div>

        <label className="block text-sm">Periodo da verificare<select className={field} disabled={busy} value={form.verificationPeriod || 'custom'} onChange={event => change({ verificationPeriod: event.target.value })}>
          <option value="custom">Personalizzato</option>
          <option value="restoration" disabled={!form.trendRestoration || !form.trendImprovement || interventionsInverted}>Dopo il ripristino, prima del miglioramento</option>
          <option value="improvement" disabled={!form.trendImprovement}>Dopo il miglioramento</option>
          <option value="all" disabled={!form.trendRestoration}>Tutto dal ripristino</option>
        </select></label>

        <div className="grid md:grid-cols-2 gap-3">{input('Verifica da', 'afterFrom', 'date')}{input('Verifica a', 'afterTo', 'date')}</div>

        {timingWarning && <p role="alert" className="text-sm text-amber-800">{timingWarning}</p>}

        {form.mode === 'stain' && <button type="button" disabled={busy || !form.scope || Boolean(periodError) || scopeStale || objectiveBlocked} className="bg-primary text-white rounded px-4 py-2 text-sm disabled:opacity-50" onClick={load}>{busy ? 'Caricamento...' : 'Aggiorna confronto'}</button>}
        {periodError && <p role="alert" className="text-sm text-amber-800">{periodError}</p>}
        {periodStatus && <p role="status" aria-live="polite" className="text-sm">{periodStatus}</p>}
        {form.rows.length > 0 && form.excluded?.length > 0 && <div role="alert" className="text-sm bg-amber-50 border border-amber-300 text-amber-900 p-3 rounded space-y-1">
          <p className="font-semibold">Prodotti esclusi: non prodotti in uno dei due periodi</p>
          {form.excluded.map(item => <p key={item.product}>{item.product}: assente in {item.missing}</p>)}
        </div>}
      </section>

      <ScrapInterventionTrend form={form} from={beforeFrom} to={form.afterTo} />

      <section className={section}>
        <StepBar title="Passo 3 - Risultato economico" hint="Applica i driver €/kg e verifica il risultato del periodo." />
        <p className="text-sm">Baseline: {beforeFrom || 'Da definire'} / {beforeTo || 'Da definire'} · Verifica: {form.afterFrom || 'Da definire'} / {form.afterTo || 'Da definire'}</p>

        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm flex-1">Versione driver economici<select className={field} disabled={busy} value={driverVersion} onChange={event => change({ selectedDriverVersion: event.target.value })}><option value="">Seleziona anno e versione</option>{driverVersions.map(version => <option key={version.id} value={version.id}>{version.year} · {version.filename} · {new Date(version.created_at).toLocaleString('it-IT')}</option>)}</select></label>
          <button type="button" className={button} disabled={busy || !driverVersion || !form.rows.length} onClick={applyDrivers}>Applica driver</button>
        </div>
        {!form.rows.length && <p className="text-sm text-gray-600">Aggiorna prima il confronto nel Passo 1.</p>}
        {!driverVersions.length && <p className="text-sm">Nessuna versione driver disponibile nei Settings.</p>}
        {driverStatus && <p role="status" className="text-sm">{driverStatus}</p>}

        {form.mode === 'manuale' && !form.objectiveId && <button type="button" disabled={busy} className={button} onClick={() => change({ rows: [...form.rows, { id: globalThis.crypto?.randomUUID?.() || `r_${Date.now()}`, product: '', type: 'scarto', beforeProduction: '', beforeLoss: '', afterProduction: '', afterLoss: '', driver: '', driverYear: '', driverRef: '' }] })}>Aggiungi prodotto / tipo</button>}

        {form.rows.length > 0 && <div className="overflow-x-auto"><table className="w-full min-w-[1450px] text-xs"><thead><tr>{['Prodotto', 'Tipo', 'Produzione prima kg', 'Perdita prima kg', 'Produzione dopo kg', 'Perdita dopo kg', 'Driver €/kg', 'Anno', 'Riferimento driver', 'Perdita prima %', 'Perdita dopo %', 'Variazione p.p.', 'Esito kg', 'Esito economico', ''].map((label, index) => <th key={index} className="p-2 text-left border-b">{label}</th>)}</tr></thead><tbody>
          {form.rows.map(row => {
            const computed = result.rows.find(item => item.id === row.id)
            return <tr key={row.id}>
              <td className="p-1"><input aria-label="Prodotto" className={field} disabled={form.mode === 'stain' || Boolean(form.objectiveId)} value={row.product} onChange={event => patchRow(row.id, 'product', event.target.value)} /></td>
              <td className="p-1"><select aria-label="Tipo perdita" className={field} disabled={form.mode === 'stain' || Boolean(form.objectiveId)} value={row.type} onChange={event => patchRow(row.id, 'type', event.target.value)}><option value="scarto">Scarto</option><option value="rework">Rework</option></select></td>
              {['beforeProduction', 'beforeLoss', 'afterProduction', 'afterLoss', 'driver', 'driverYear', 'driverRef'].map(key => <td key={key} className="p-1"><input aria-label={key} className={field} disabled={form.mode === 'stain' && ['beforeProduction', 'beforeLoss', 'afterProduction', 'afterLoss'].includes(key)} type={key === 'driverRef' ? 'text' : 'number'} min="0" step="any" value={row[key]} onChange={event => patchRow(row.id, key, event.target.value)} /></td>)}
              <td className="p-2">{fmt(rate(row.beforeLoss, row.beforeProduction))}%</td>
              <td className="p-2">{fmt(rate(row.afterLoss, row.afterProduction))}%</td>
              <td className="p-2">{fmt(rate(row.afterLoss, row.afterProduction) - rate(row.beforeLoss, row.beforeProduction))} p.p.</td>
              <td className={`p-2 ${computed?.avoided < 0 ? 'text-red-700' : 'text-green-800'}`}>{outcome(computed?.avoided, 'Risparmiati', 'Aggiuntivi', 'kg')}</td>
              <td className={`p-2 ${computed?.gross < 0 ? 'text-red-700' : 'text-green-800'}`}>{outcome(computed?.gross, 'Saving', 'Maggior costo stimato', '€')}</td>
              <td>{form.mode === 'manuale' && !form.objectiveId && <button type="button" onClick={() => change({ rows: form.rows.filter(item => item.id !== row.id) })}>Elimina</button>}</td>
            </tr>
          })}
        </tbody></table></div>}

        <div className="grid md:grid-cols-2 gap-3">{input('Costi implementazione € (facoltativi)', 'costs', 'number')}{input('Descrizione dei costi', 'costNote')}</div>

        {form.rows.length > 0 && (issues.length ? <div className="text-sm text-amber-800">{[...new Set(issues)].map(issue => <p key={issue}>{issue}</p>)}</div> : <div className="grid md:grid-cols-3 gap-3">
          <div className="bg-gray-50 rounded p-3"><div className="text-xs">{result.avoided < 0 ? 'Kg aggiuntivi' : 'Kg evitati'}</div><strong>{fmt(Math.abs(result.avoided))}</strong></div>
          <div className="bg-gray-50 rounded p-3"><div className="text-xs">{result.gross < 0 ? 'Maggior costo €' : 'Saving lordo €'}</div><strong>{fmt(Math.abs(result.gross))}</strong></div>
          <div className="bg-gray-50 rounded p-3"><div className="text-xs">{result.net < 0 ? 'Saldo netto negativo €' : 'Beneficio netto €'}</div><strong>{form.costs === '' ? fmt(Math.abs(result.gross)) : fmt(Math.abs(result.net))}</strong></div>
        </div>)}

        {form.rows.length > 0 && !issues.length && timingWarning && <p role="alert" className="text-sm text-amber-800">{timingWarning}</p>}

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
