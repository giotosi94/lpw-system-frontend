import { useEffect, useRef, useState } from 'react'
import api from '../../../../services/api'
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ReferenceLine } from 'recharts'
import { baselineScope, aggregateSnapshot, compareSnapshots, calculateSaving } from './scrapSavingMath'

const field = 'w-full border border-gray-300 rounded px-2 py-2 text-sm bg-white'
const button = 'border rounded px-3 py-2 text-sm disabled:opacity-50'
const section = 'border border-gray-200 rounded-lg bg-white p-4 space-y-3'
const fmt = value => value == null || !Number.isFinite(value) ? 'Non disponibile' : new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 }).format(value)
const empty = () => ({ mode: 'stain', trendRestoration: '', trendImprovement: '', trendData: null, scope: null, before: null, after: null, afterFrom: '', afterTo: '', manualBeforeFrom: '', manualBeforeTo: '', rows: [], costs: '', costNote: '', annualProduction: '', annualBasis: '', source: '', notes: '', reviewed: false })


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
    { label: 'Dopo il miglioramento', includes: date => date >= improvement },
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

function ScrapInterventionTrend({ form, change, from, to }) {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const requestRef = useRef(0)
  const scope = form.scope
  const key = form.mode + trendKey(scope, from, to)
  const keyRef = useRef(key)
  keyRef.current = key
  useEffect(() => () => { requestRef.current += 1 }, [])
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
  if (form.trendData?.key === key) {
    try { points = buildScrapTrend(form.trendData.snapshot, scope) }
    catch (error) { dataError = error.message }
  }
  const segments = markerError ? [] : trendSegments(points, restoration, improvement)
  const baselineRate = segments[0]?.value
  const invalid = points.filter(point => !point.valid && (point.loss !== 0 || point.production !== 0)).length
  const loadTrend = async () => {
    if (!periodValid || loading) return
    const request = ++requestRef.current
    setLoading(true)
    setMessage('Caricamento del periodo continuo, inclusi i giorni tra prima e dopo...')
    try {
      const response = await api.get('/stain/scarti', { params: { linea: scope.line, tipi: scope.types.join(','), dal: from, al: to }, timeout: 180000 })
      buildScrapTrend(response.data, scope)
      if (requestRef.current !== request) return
      if (keyRef.current !== key) { setMessage('Perimetro modificato durante il caricamento: ricarica il trend.'); return }
      change({ trendData: { key, snapshot: response.data } })
      setMessage('Trend caricato. Le date degli interventi e lo snapshot vengono salvati automaticamente.')
    } catch (error) {
      if (requestRef.current === request) setMessage(typeof error.response?.data?.detail === 'string' ? error.response.data.detail : error.message || 'Caricamento trend non riuscito.')
    } finally {
      if (requestRef.current === request) setLoading(false)
    }
  }
  const labelDate = value => new Date(value).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', timeZone: 'UTC' })
  return (
    <section className={section}>
      <h3 className="font-bold text-primary">Trend e verifica degli interventi</h3>
      <p className="text-sm text-gray-600">Perdita percentuale giornaliera sulla produzione, con gli stessi prodotti, tipi e causali del confronto. Il periodo continuo va dall'inizio del prima alla fine del dopo, inclusi i giorni intermedi.</p>
      {form.mode !== 'stain' ? <p className="text-sm text-amber-800">Il confronto manuale contiene solo totali: non viene generato un trend senza dati giornalieri.</p> : <>
        <p className="text-sm">Periodo: {from || 'Da definire'} / {to || 'Da definire'}</p>
        <div className="grid md:grid-cols-2 gap-3">
          <label className="block text-sm">Data ripristino<input type="date" className={field} min={from || undefined} max={to || todayDate()} value={restoration} onChange={event => change({ trendRestoration: event.target.value })} /></label>
          <label className="block text-sm">Data miglioramento<input type="date" className={field} min={restoration ? dayAfter(restoration) : from || undefined} max={to || todayDate()} value={improvement} onChange={event => change({ trendImprovement: event.target.value })} /></label>
        </div>
        <button type="button" className={button} disabled={loading || !periodValid} onClick={loadTrend}>{loading ? 'Caricamento trend...' : 'Carica / aggiorna trend da STAIN'}</button>
        {!periodValid && <p className="text-sm text-amber-800">Importa il perimetro e scegli un periodo storico continuo di massimo 367 giorni.</p>}
        {markerError && <p role="alert" className="text-sm text-amber-800">{markerError}</p>}
        {message && <p role="status" aria-live="polite" className="text-sm">{message}</p>}
        {dataError && <p role="alert" className="text-sm text-red-700">{dataError}</p>}
        {form.trendData && form.trendData.key !== key && <p className="text-sm text-amber-800">Date o filtri modificati: aggiorna il trend. Il precedente non viene mostrato.</p>}
        {points.length > 0 && <>
          <div className="h-80 w-full" role="img" aria-label="Trend giornaliero della percentuale di perdita con date di ripristino e miglioramento">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={points} margin={{ top: 40, right: 30, bottom: 10, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="timestamp" type="number" scale="time" domain={[start, end]} tickFormatter={labelDate} />
                <YAxis unit="%" width={65} />
                <Tooltip labelFormatter={value => new Date(value).toLocaleDateString('it-IT', { timeZone: 'UTC' })} formatter={value => [`${fmt(value)}%`, 'Perdita sulla produzione']} />
                <Legend />
                <Line name="Perdita selezionata (%)" type="linear" dataKey="value" stroke="#85583f" strokeWidth={2} dot={{ r: 2 }} connectNulls={false} isAnimationActive={false} />
                {!markerError && restoration && <ReferenceLine x={Date.parse(`${restoration}T00:00:00Z`)} stroke="#2563eb" strokeWidth={2} strokeDasharray="5 3" label={{ value: 'Ripristino', position: 'insideTopLeft', fill: '#2563eb' }} />}
                {!markerError && improvement && <ReferenceLine x={Date.parse(`${improvement}T00:00:00Z`)} stroke="#15803d" strokeWidth={2} strokeDasharray="5 3" label={{ value: 'Miglioramento', position: 'insideTopRight', fill: '#15803d' }} />}
                {baselineRate != null && <ReferenceLine y={baselineRate} stroke="#6b7280" strokeDasharray="4 4" label={{ value: `Prima: ${fmt(baselineRate)}%`, position: 'insideTopRight' }} />}
              </LineChart>
            </ResponsiveContainer>
          </div>
          {!points.some(point => point.valid) && <p className="text-sm text-amber-800">Nessun giorno con produzione e perdite valide nel perimetro.</p>}
          {invalid > 0 && <p className="text-sm text-amber-800">{invalid} giorni con perdita senza produzione o quantitativi incoerenti: percentuale non calcolata. I riepiloghi dei periodi interessati non sono disponibili.</p>}
          {!restoration || !improvement ? <p className="text-sm text-gray-600">Indica entrambe le date per confrontare i tre periodi.</p> : null}
          {segments.length > 0 && <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr>{['Periodo', 'Giorni produttivi validi', 'Perdita ponderata', 'Riduzione vs prima'].map(label => <th key={label} className="text-left border-b p-2">{label}</th>)}</tr></thead><tbody>{segments.map((segment, index) => {
            const reduction = index > 0 && baselineRate > 0 && segment.value != null ? (baselineRate - segment.value) / baselineRate * 100 : null
            return <tr key={segment.label}><td className="p-2">{segment.label}</td><td className="p-2">{segment.count}</td><td className="p-2">{segment.value == null ? 'Non disponibile' : `${fmt(segment.value)}%`}</td><td className="p-2">{index === 0 ? 'Riferimento' : reduction == null ? 'Non disponibile' : `${fmt(reduction)}%`}</td></tr>
          })}</tbody></table></div>}
          <p className="text-xs text-gray-600">Percentuale ponderata = kg persi / kg prodotti nel periodo, non media delle percentuali giornaliere. Il giorno dell'intervento appartiene al periodo successivo. Giorni senza produzione: interruzione della linea, non zero. Riduzione negativa: peggioramento. Variazioni del mix prodotto possono influire sul risultato: per una verifica omogenea seleziona lo stesso prodotto. Il trend mostra l'associazione temporale, non dimostra da solo la causalita.</p>
        </>}
      </>}
    </section>
  )
}

export default function ScrapSavings({ stepData, allStepsData, onChange, major }) {
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
  useEffect(() => {
    if (!dirty.current && !savingRef.current) {
      const next = { ...empty(), ...(stepData?.dati?.saving_economico || {}) }
      formRef.current = next
      setForm(next)
    }
  }, [stepData?.dati])
  const change = (patch, preserveReview = false) => {
    const next = { ...formRef.current, ...patch, ...(preserveReview ? {} : { reviewed: false }) }
    formRef.current = next
    dirty.current = true
    revision.current += 1
    setSaveState('dirty')
    setStatus('Modifiche in attesa di salvataggio automatico')
    setForm(next)
  }
  const patchRow = (id, key, value) => change({ rows: form.rows.map(row => row.id === id ? { ...row, [key]: value, ...(key === 'driver' ? { driverSource: 'manuale' } : {}) } : row) })
  const applyDrivers = async () => {
    if (!driverVersion || !form.rows.length) { setDriverStatus('Carica il confronto e seleziona una versione driver.'); return }
    if (!major?.reparto || !major?.linea) { setDriverStatus('Imposta reparto e linea nel Major.'); return }
    if (!window.confirm('Applicare i driver selezionati alle righe? I valori precedenti saranno sostituiti.')) return
    setBusy(true)
    try {
      const response = await api.get(`/economic-drivers/${driverVersion}/resolve`, { params: { department: major.reparto, line: major.linea } })
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

  if (periodError) issues.push(periodError)

  if (!beforeFrom || !beforeTo || !form.afterFrom || !form.afterTo || beforeFrom > beforeTo || form.afterFrom > form.afterTo || form.afterFrom <= beforeTo) issues.push('Definisci periodi validi, non sovrapposti: il dopo deve iniziare dopo la baseline.')
  if (form.mode === 'stain' && (!form.before || form.before.dal !== beforeFrom || form.before.al !== beforeTo || !form.after || form.after.dal !== form.afterFrom || form.after.al !== form.afterTo)) issues.push('Carica entrambi i periodi per le date selezionate.')
  if (form.mode === 'manuale' && !form.source.trim()) issues.push('Documenta fonte, linea, prodotti e causali del confronto manuale.')
  if (form.costs !== '' && Number(String(form.costs).replace(',', '.')) > 0 && !form.costNote.trim()) issues.push('Descrivi i costi di implementazione.')

  const capture = () => {
    try {
      if (!baseline) throw new Error('Salva prima la baseline della Fase 1.')
      if (form.scope && !window.confirm('Sostituire lo snapshot baseline? Il confronto dopo e i calcoli saranno azzerati.')) return
      const scope = baselineScope(baseline)
      aggregateSnapshot(baseline.stain_snapshot, scope)
      change({ scope, before: JSON.parse(JSON.stringify(baseline.stain_snapshot)), after: null, rows: [], driverSnapshot: null, afterFrom: '', afterTo: '' })
      setPeriodStatus('Linea e filtri acquisiti. Puoi modificare qui il periodo prima e scegliere un periodo dopo gia trascorso. La Fase 1 non viene modificata.')
    } catch (error) { setPeriodStatus(error.message) }
  }
  const load = async () => {
    if (periodError) { setPeriodStatus(periodError); return }
    setBusy(true)
    setPeriodStatus('Lettura STAIN in corso...')
    try {
      const params = { linea: form.scope.line, tipi: form.scope.types.join(',') }
      const [beforeResponse, afterResponse] = await Promise.all([
        api.get('/stain/scarti', { params: { ...params, dal: beforeFrom, al: beforeTo }, timeout: 180000 }),
        api.get('/stain/scarti', { params: { ...params, dal: form.afterFrom, al: form.afterTo }, timeout: 180000 }),
      ])
      const rows = compareSnapshots(beforeResponse.data, afterResponse.data, form.scope, form.rows)
      change({ before: beforeResponse.data, after: afterResponse.data, rows })
      setPeriodStatus(`Entrambi i periodi caricati: ${rows.length} righe. Ora applica i driver economici.`)
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
    const comparisonReady = Boolean(currentCalculation && !state.periodError && snapshot.rows.length && (
      snapshot.mode === 'manuale'
        ? snapshot.manualBeforeFrom && snapshot.manualBeforeTo && snapshot.afterFrom && snapshot.afterTo
        : snapshot.before && snapshot.after && snapshot.before.dal === snapshot.scope?.from && snapshot.before.al === snapshot.scope?.to && snapshot.after.dal === snapshot.afterFrom && snapshot.after.al === snapshot.afterTo
    ))
    const driversReady = Boolean(snapshot.rows.length && snapshot.rows.every(row =>
      row.driver !== '' && row.driver != null && Number.isFinite(Number(String(row.driver).replace(',', '.'))) && Number(String(row.driver).replace(',', '.')) >= 0 && /^\d{4}$/.test(String(row.driverYear || '')) && String(row.driverRef || '').trim()
    ))
    const reviewed = false
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
      validation: ready ? 'calcolato_non_validato' : 'bozza_incompleta',
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
    if (form.mode !== 'stain' || form.scope || !baseline || dirty.current) return
    try {
      const scope = baselineScope(baseline)
      aggregateSnapshot(baseline.stain_snapshot, scope)
      change({ scope, before: JSON.parse(JSON.stringify(baseline.stain_snapshot)) })
    } catch {
      setPeriodStatus('Baseline non disponibile: carica e salva i dati nella Fase 1, poi importali qui.')
    }
  }, [baseline, form.mode, form.scope])
  const input = (label, key, type = 'text') => {
    const beforeDate = key === 'comparisonFrom' || key === 'comparisonTo'
    const value = beforeDate ? (key === 'comparisonFrom' ? beforeFrom : beforeTo) || '' : form[key]
    return <label className="text-sm block">{label}<input className={field} type={type} disabled={busy} min={   type === 'number'     ? '0'     : key === 'afterFrom'       ? dayAfter(beforeTo) || undefined       : key === 'afterTo'         ? form.afterFrom && form.afterFrom > beforeTo           ? form.afterFrom           : dayAfter(beforeTo) || undefined         : undefined } max={type === 'date' ? today : undefined} step={type === 'number' ? 'any' : undefined} value={value} onChange={event => {
      const value = event.target.value
      if (beforeDate) {
        change({ scope: { ...form.scope, [key === 'comparisonFrom' ? 'from' : 'to']: value }, before: null, after: null, rows: [] })
      } else if (type === 'date') {
        change({ [key]: value, after: null, rows: [] })
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
        <label className="block text-sm">Fonte<select className={field} disabled={busy} value={form.mode} onChange={event => { if (!form.rows.length || window.confirm('Cambiare fonte e azzerare il confronto?')) change({ ...empty(), mode: event.target.value }) }}><option value="stain">STAIN</option><option value="manuale">Confronto manuale in kg</option></select></label>
        {form.mode === 'stain' ? <>
          <button type="button" disabled={busy} className={button} onClick={capture}>Importa linea, filtri e periodo dalla Fase 1</button>
          {form.scope && <div className="text-sm bg-gray-50 p-3 rounded"><p>{form.scope.line} · {form.scope.from} / {form.scope.to}</p><p>Prodotti: {form.scope.products.join(', ') || 'Tutti'} · Causali: {form.scope.priorities.join(', ') || 'Tutte le causali dei tipi selezionati'}</p><p>Confronto indipendente: modificare queste date non cambia la Fase 1.</p></div>}
        </> : <><div className="grid md:grid-cols-2 gap-3">{input('Baseline da', 'manualBeforeFrom', 'date')}{input('Baseline a', 'manualBeforeTo', 'date')}</div>{input('Fonte e perimetro manuale (linea, prodotti, causali, evidenze)', 'source')}</>}
        <p className="text-sm text-gray-600">Confronta due periodi storici: prima degli interventi e dopo gli interventi. Puoi cambiare entrambi qui. Le date vengono controllate al caricamento, senza essere riscritte automaticamente.</p>
        {form.mode === 'stain' && form.scope && <div className="grid md:grid-cols-2 gap-3">{input('Periodo prima da', 'comparisonFrom', 'date')}{input('Periodo prima a', 'comparisonTo', 'date')}</div>}
        <div className="grid md:grid-cols-2 gap-3">{input('Periodo dopo da', 'afterFrom', 'date')}{input('Periodo dopo a', 'afterTo', 'date')}</div>
        {form.mode === 'stain' && <button type="button" disabled={busy || !form.scope || Boolean(periodError)} className={button} onClick={load}>{busy ? 'Caricamento...' : 'Carica confronto da STAIN'}</button>}
        {periodError && <p role="alert" className="text-sm text-amber-800">{periodError}</p>}
        {periodStatus && <p role="status" aria-live="polite" className="text-sm">{periodStatus}</p>}
      </section>
      <ScrapInterventionTrend form={form} change={change} from={beforeFrom} to={form.afterTo} />
      <section className={section}>
        <h3 className="font-bold text-primary">2 · Driver e beneficio economico</h3>
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
        {form.mode === 'manuale' && <button type="button" disabled={busy} className={button} onClick={() => change({ rows: [...form.rows, { id: globalThis.crypto?.randomUUID?.() || `r_${Date.now()}`, product: '', type: 'scarto', beforeProduction: '', beforeLoss: '', afterProduction: '', afterLoss: '', driver: '', driverYear: '', driverRef: '' }] })}>Aggiungi prodotto / tipo</button>}
        {form.rows.length > 0 && <div className="overflow-x-auto"><table className="w-full min-w-[1450px] text-xs"><thead><tr>{['Prodotto', 'Tipo', 'Produzione prima kg', 'Perdita prima kg', 'Produzione dopo kg', 'Perdita dopo kg', 'Driver €/kg', 'Anno', 'Riferimento driver', 'Perdita prima %', 'Perdita dopo %', 'Variazione p.p.', 'Esito kg', 'Esito economico', ''].map((label, index) => <th key={index} className="p-2 text-left border-b">{label}</th>)}</tr></thead><tbody>
          {form.rows.map(row => { const computed = result.rows.find(item => item.id === row.id); return <tr key={row.id}>
            <td className="p-1"><input aria-label="Prodotto" className={field} disabled={form.mode === 'stain'} value={row.product} onChange={event => patchRow(row.id, 'product', event.target.value)} /></td>
            <td className="p-1"><select aria-label="Tipo perdita" className={field} disabled={form.mode === 'stain'} value={row.type} onChange={event => patchRow(row.id, 'type', event.target.value)}><option value="scarto">Scarto</option><option value="rework">Rework</option></select></td>
            {['beforeProduction', 'beforeLoss', 'afterProduction', 'afterLoss', 'driver', 'driverYear', 'driverRef'].map(key => <td key={key} className="p-1"><input aria-label={key} className={field} disabled={form.mode === 'stain' && ['beforeProduction', 'beforeLoss', 'afterProduction', 'afterLoss'].includes(key)} type={key === 'driverRef' ? 'text' : 'number'} min="0" step="any" value={row[key]} onChange={event => patchRow(row.id, key, event.target.value)} /></td>)}
            <td className="p-2">{fmt(rate(row.beforeLoss, row.beforeProduction))}%</td>
            <td className="p-2">{fmt(rate(row.afterLoss, row.afterProduction))}%</td>
            <td className="p-2">{fmt(rate(row.afterLoss, row.afterProduction) - rate(row.beforeLoss, row.beforeProduction))} p.p.</td>
            <td className={`p-2 ${computed?.avoided < 0 ? 'text-red-700' : 'text-green-800'}`}>{outcome(computed?.avoided, 'Risparmiati', 'Aggiuntivi', 'kg')}</td>
            <td className={`p-2 ${computed?.gross < 0 ? 'text-red-700' : 'text-green-800'}`}>{outcome(computed?.gross, 'Saving', 'Maggior costo stimato', '€')}</td><td>{form.mode === 'manuale' && <button type="button" onClick={() => change({ rows: form.rows.filter(item => item.id !== row.id) })}>Elimina</button>}</td>
          </tr> })}
        </tbody></table></div>}
        <div className="grid md:grid-cols-2 gap-3">{input('Costi implementazione € (facoltativi)', 'costs', 'number')}{input('Descrizione e fonte dei costi', 'costNote')}</div>
        {form.rows.length > 0 && (issues.length ? <div className="text-sm text-amber-800">{[...new Set(issues)].map(issue => <p key={issue}>{issue}</p>)}</div> : <div className="grid md:grid-cols-2 gap-3">
          <div className="bg-gray-50 rounded p-3"><div className="text-xs">{result.avoided < 0 ? 'Kg aggiuntivi rispetto all’atteso' : 'Kg risparmiati'}</div><strong>{fmt(Math.abs(result.avoided))}</strong></div>
          <div className="bg-gray-50 rounded p-3"><div className="text-xs">{result.gross < 0 ? 'Maggior costo stimato del periodo €' : 'Saving lordo del periodo €'}</div><strong>{fmt(Math.abs(result.gross))}</strong></div>
          {form.costs !== '' && <p className="text-sm">{result.net < 0 ? 'Saldo netto negativo, inclusi costi' : 'Beneficio netto'}: {fmt(Math.abs(result.net))} €</p>}
        </div>)}
      </section>

      <div className="flex flex-wrap justify-end items-center gap-3">
        <span role="status" aria-live="polite" className={`text-sm ${saveState === 'error' ? 'text-red-700' : 'text-gray-600'}`}>{status || ''}</span>
        {saveState === 'error' && <button type="button" className={button} onClick={() => persistRef.current?.()}>Riprova salvataggio</button>}
      </div>
    </div>
  )
}
