import { useEffect, useMemo, useRef, useState } from 'react'
import api from '../../../../services/api'
import { useAuth } from '../../../../context/AuthContext'
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ReferenceLine, ReferenceArea } from 'recharts'
import { compareSnapshots, incomparableProducts, calculateSaving, objectiveLabel, objectiveContext, numeric } from './scrapSavingMath'

const field = 'w-full border border-gray-300 rounded px-2 py-2 text-sm bg-white disabled:bg-gray-100'
const button = 'border rounded px-3 py-2 text-sm disabled:opacity-50'
const primary = 'bg-primary text-white rounded px-4 py-2 text-sm disabled:opacity-50'
const section = 'border border-gray-200 rounded-lg bg-white p-4 space-y-3'
const fmt = (value, digits = 2) => value == null || !Number.isFinite(value) ? '-' : new Intl.NumberFormat('it-IT', { maximumFractionDigits: digits }).format(value)
const pct = value => value == null || !Number.isFinite(value) ? '-' : `${fmt(value * 100)}%`
const eur = value => value == null || !Number.isFinite(value) ? '-' : new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value)
const typeLabel = type => type === 'rework' ? 'Rework' : 'Scarto'

const empty = () => ({
  objectiveId: '',
  objectiveFingerprint: '',
  interventionRef: '',
  interventionDate: '',
  afterFrom: '',
  afterTo: '',
  rows: [],
  excluded: [],
  after: null,
  driverVersion: '',
  driverSnapshot: null,
  driverScarto: '',
  driverRework: '',
  costs: '',
  costNote: '',
  notes: '',
  reviewed: false,
  reviewedBy: '',
  reviewedAt: '',
})

function isoDay(value) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10)
}

function todayDate() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function dayAfter(value) {
  const d = new Date(`${value}T12:00:00`)
  if (Number.isNaN(d.getTime())) return ''
  d.setDate(d.getDate() + 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const itDate = value => value ? value.split('-').reverse().join('/') : '-'

function StepBar({ title }) {
  return <div className="bg-primary text-white text-center font-bold uppercase rounded-lg py-2 text-sm tracking-wide">{title}</div>
}

function Kpi({ label, value, tone }) {
  const color = tone === 'good' ? 'text-green-800' : tone === 'bad' ? 'text-red-700' : ''
  return <div className="bg-gray-50 rounded p-3"><div className="text-xs text-gray-600">{label}</div><strong className={`text-lg ${color}`}>{value}</strong></div>
}

function useInterventions(major, allStepsData) {
  const [items, setItems] = useState([])
  const carl = []
  const restoreSteps = new Set()
  Object.entries(allStepsData || {}).forEach(([stepId, step]) => {
    const data = step?.dati || {}
    if (Array.isArray(data.anomalie)) restoreSteps.add(stepId)
    ;(Array.isArray(data.anomalie) ? data.anomalie : []).forEach((row, index) => {
      if (row?.carl?.id) carl.push({ key: `carl:${row.carl.id}`, carlId: row.carl.id, label: `Ripristino · ${row.carl.codice || 'CARL'} · ${row.descrizione || `Anomalia ${index + 1}`}` })
    })
    ;(Array.isArray(data.miglioramenti) ? data.miglioramenti : []).forEach(row => {
      if (row?.carl?.id) carl.push({ key: `carl:${row.carl.id}`, carlId: row.carl.id, label: `Miglioramento · ${row.carl.codice || 'SUG'} · ${row.proposta || row.titolo || ''}` })
    })
  })
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
          return { key: `ap:${plan._id}`, label: `${restoreSteps.has(stepId) ? 'Ripristino' : 'Miglioramento'} · ${plan.numero || 'AP'} · ${plan.titolo || ''}`, date: isoDay(plan.data_completamento) }
        })
      const carlItems = await Promise.all(carl.map(async item => {
        try {
          const response = await api.get(`/carl/cartellini/${item.carlId}`)
          const done = (response.data?.storico || []).filter(row => ['FINISHED', 'CLOSED'].includes(row.stato) && row.data)
          return { ...item, date: done.length ? isoDay(done[0].data) : '' }
        } catch {
          return { ...item, date: '' }
        }
      }))
      if (active) setItems([...carlItems, ...planItems])
    }
    load()
    return () => { active = false }
  }, [signature])
  return items
}

function buildTrend(before, after, scope) {
  const products = new Set(scope.products || [])
  const days = new Map()
  const get = day => {
    if (!days.has(day)) days.set(day, { date: day, timestamp: Date.parse(`${day}T00:00:00Z`), production: 0, loss: 0 })
    return days.get(day)
  }
  ;[before, after].filter(Boolean).forEach(snapshot => {
    ;(snapshot.produzione || []).forEach(row => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(row.data || '')) return
      if (products.size && !products.has(row.prodotto)) return
      const kg = Number(row.kg)
      if (Number.isFinite(kg)) get(row.data).production += kg
    })
    ;(snapshot.dettaglio || []).forEach(row => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(row.data || '')) return
      if (products.size && !products.has(row.prodotto)) return
      if (!scope.types.includes(row.tipo)) return
      if (scope.priorities.length && !scope.priorities.includes(`${row.codice} - ${row.causale}`)) return
      const kg = Number(row.kg)
      if (Number.isFinite(kg)) get(row.data).loss += kg
    })
  })
  return [...days.values()]
    .sort((a, b) => a.timestamp - b.timestamp)
    .map(point => {
      const valid = point.production > 0 && point.loss >= 0 && point.loss <= point.production
      return { ...point, value: valid ? point.loss / point.production * 100 : null }
    })
}

export default function ScrapSavings({ stepData, allStepsData, onChange, major }) {
  const { user } = useAuth() || {}
  const interventions = useInterventions(major, allStepsData)
  const [form, setForm] = useState(() => ({ ...empty(), ...(stepData?.dati?.saving_economico || {}) }))
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [driverMessage, setDriverMessage] = useState('')
  const [driverVersions, setDriverVersions] = useState([])
  const [saveState, setSaveState] = useState('saved')

  const formRef = useRef(form)
  const dirty = useRef(false)
  const revision = useRef(0)
  const savingRef = useRef(false)
  const mountedRef = useRef(true)
  const timerRef = useRef(null)
  const baseRef = useRef(stepData?.dati || {})
  const onChangeRef = useRef(onChange)
  const persistRef = useRef(null)
  const stateRef = useRef(null)
  onChangeRef.current = onChange
  baseRef.current = stepData?.dati || {}

  const baseline = Object.values(allStepsData || {}).map(item => item?.dati).find(data => data?.stain_snapshot || data?.categorie_scarto)
  const objectives = Array.isArray(baseline?.obiettivi) ? baseline.obiettivi : []
  const selectedObjective = objectives.find(row => row.id === form.objectiveId)

  const objectiveState = useMemo(() => {
    if (!selectedObjective) return { context: null, error: form.objectiveId ? 'Obiettivo non più presente nella Fase 1.' : '' }
    try { return { context: objectiveContext(baseline || {}, selectedObjective), error: '' } }
    catch (error) { return { context: null, error: error.message } }
  }, [baseline, selectedObjective, form.objectiveId])
  const context = objectiveState.context
  const manual = context?.meta.source === 'manuale'
  const scope = context?.scope || null
  const baselineFrom = context?.from || ''
  const baselineTo = context?.to || ''
  const stale = Boolean(context && form.rows.length && form.objectiveFingerprint && form.objectiveFingerprint !== context.fingerprint)

  useEffect(() => {
    if (!dirty.current && !savingRef.current) {
      const next = { ...empty(), ...(stepData?.dati?.saving_economico || {}) }
      formRef.current = next
      setForm(next)
    }
  }, [stepData?.dati])

  useEffect(() => {
    api.get('/economic-drivers/versions')
      .then(response => setDriverVersions(response.data || []))
      .catch(() => setDriverMessage('Elenco driver non disponibile.'))
  }, [])

  const change = (patch, keepReview = false) => {
    const next = { ...formRef.current, ...patch, ...(keepReview ? {} : { reviewed: false, reviewedBy: '', reviewedAt: '' }) }
    formRef.current = next
    dirty.current = true
    revision.current += 1
    setSaveState('dirty')
    setForm(next)
  }

  const resetComparison = { rows: [], excluded: [], after: null, objectiveFingerprint: '' }

  useEffect(() => {
    if (form.objectiveId || objectives.length !== 1) return
    change({ objectiveId: objectives[0].id, ...resetComparison })
  }, [objectives.length, form.objectiveId])

  useEffect(() => {
    if (!manual || !context || form.rows.length) return
    change({ rows: context.rows.map(row => ({ ...row })), objectiveFingerprint: context.fingerprint })
  }, [manual, context?.fingerprint, form.rows.length])

  const driverVersion = form.driverVersion || form.driverSnapshot?.version_id || driverVersions[0]?.id || ''

  const fetchDrivers = async version => {
    if (!version) { setDriverMessage('Nessuna versione driver pubblicata nei Settings.'); return null }
    try {
      const response = await api.get(`/economic-drivers/${version}/generic`)
      setDriverMessage('')
      return response.data
    } catch (error) {
      setDriverMessage(typeof error.response?.data?.detail === 'string' ? error.response.data.detail : 'Driver non disponibili')
      return null
    }
  }

  const applyDriverVersion = async version => {
    setBusy(true)
    const snapshot = await fetchDrivers(version)
    setBusy(false)
    if (!snapshot) { change({ driverVersion: version }); return }
    change({ driverVersion: version, driverSnapshot: snapshot, driverScarto: String(snapshot.scarto ?? ''), driverRework: String(snapshot.rework ?? '') })
  }

  const selectObjective = id => {
    if (form.rows.length && !window.confirm('Cambiare obiettivo? Il risultato attuale verrà azzerato.')) return
    change({ objectiveId: id, ...resetComparison })
    setMessage('')
  }

  const selectIntervention = key => {
    const item = interventions.find(row => row.key === key)
    const date = item?.date || form.interventionDate
    change({ interventionRef: key, interventionDate: date, ...(date ? { afterFrom: date } : {}), ...resetComparison })
  }

  const today = todayDate()
  const periodError = !context
    ? ''
    : !form.afterFrom || !form.afterTo
      ? 'Indica la data intervento e il periodo di verifica.'
      : form.afterFrom > form.afterTo
        ? 'La fine della verifica deve essere successiva all’inizio.'
        : form.afterFrom <= baselineTo
          ? `La verifica deve iniziare dopo la baseline (${itDate(baselineTo)}).`
          : form.afterTo > today
            ? 'La verifica non può terminare dopo oggi.'
            : ''

  const calculate = async () => {
    if (!context || periodError) return
    const rev = revision.current
    setBusy(true)
    setMessage('Lettura STAIN in corso...')
    try {
      const response = await api.get('/stain/scarti', { params: { linea: scope.line, tipi: scope.types.join(','), dal: form.afterFrom, al: form.afterTo }, timeout: 180000 })
      const after = { ...response.data, dal: form.afterFrom, al: form.afterTo }
      const before = baseline.stain_snapshot
      const excluded = incomparableProducts(before, after, scope)
      const rows = compareSnapshots(before, after, scope, [])
      let driverPatch = {}
      if (form.driverScarto === '' && form.driverRework === '') {
        const snapshot = await fetchDrivers(driverVersion)
        if (snapshot) driverPatch = { driverVersion: snapshot.version_id, driverSnapshot: snapshot, driverScarto: String(snapshot.scarto ?? ''), driverRework: String(snapshot.rework ?? '') }
      }
      if (rev !== revision.current || !mountedRef.current) { setMessage('Dati modificati durante il calcolo: premi di nuovo Calcola.'); return }
      change({ after, rows, excluded, objectiveFingerprint: context.fingerprint, ...driverPatch })
      setMessage('')
    } catch (error) {
      setMessage(typeof error.response?.data?.detail === 'string' ? error.response.data.detail : error.message || 'Lettura STAIN non riuscita')
    } finally {
      setBusy(false)
    }
  }

  const driverRef = form.driverSnapshot ? `${form.driverSnapshot.filename} · ${form.driverSnapshot.version_id}` : 'manuale'
  const driverYear = String(form.driverSnapshot?.year || new Date().getFullYear())
  const pricedRows = form.rows.map(row => ({
    ...row,
    driver: row.type === 'rework' ? form.driverRework : form.driverScarto,
    driverYear,
    driverRef,
  }))
  const result = calculateSaving(pricedRows, form.costs === '' ? 0 : form.costs, '')
  const totals = result.totals

  const objectiveReduction = selectedObjective && Number(selectedObjective.baseline) > 0
    ? (Number(selectedObjective.baseline) - Number(selectedObjective.target)) / Number(selectedObjective.baseline)
    : null
  const targetRate = totals && objectiveReduction != null ? totals.beforeRate * (1 - objectiveReduction) : null
  const achievement = result.savingPct != null && objectiveReduction > 0 ? result.savingPct / objectiveReduction : null

  const issues = []
  if (objectiveState.error) issues.push(objectiveState.error)
  if (stale) issues.push('La Fase 1 è cambiata: premi Calcola per aggiornare il risultato.')
  if (periodError && form.rows.length) issues.push(periodError)
  result.issues.forEach(issue => { if (!issue.includes('anno e riferimento')) issues.push(issue) })
  if (numeric(form.costs) > 0 && !form.costNote.trim()) issues.push('Descrivi i costi di implementazione.')
  const ready = Boolean(form.rows.length && !issues.length)

  const trend = useMemo(() => scope && form.after && baseline?.stain_snapshot ? buildTrend(baseline.stain_snapshot, form.after, { ...scope, products: [...new Set(form.rows.map(row => row.product))] }) : [], [scope, form.after, form.rows, baseline])

  stateRef.current = { form, result, ready }
  persistRef.current = async () => {
    clearTimeout(timerRef.current)
    if (!dirty.current || savingRef.current) return
    const state = stateRef.current
    const snapshot = formRef.current
    const rev = revision.current
    const current = state.form === snapshot
    const isReady = current && state.ready
    const reviewed = Boolean(isReady && snapshot.reviewed)
    const payload = {
      ...snapshot,
      formula_version: 'scrap_normalized_v2',
      saved_at: new Date().toISOString(),
      result: isReady ? {
        gross: state.result.gross,
        avoided: state.result.avoided,
        net: state.result.net,
        savingPct: state.result.savingPct,
        totals: state.result.totals,
        products: state.result.products,
        rows: state.result.rows,
      } : null,
      validation: isReady ? (reviewed ? 'validato' : 'calcolato_non_validato') : 'bozza_incompleta',
    }
    savingRef.current = true
    if (mountedRef.current) setSaveState('saving')
    let failed = false
    try {
      const response = await onChangeRef.current({
        dati: { ...baseRef.current, saving_economico: payload },
        output_compilati: {
          confronto_prima_dopo: Boolean(current && snapshot.rows.length),
          driver_economici: Boolean(current && state.result.gross != null),
          saving_calcolato: Boolean(isReady),
          verifica_risultati: reviewed,
        },
      })
      if (response === false) throw new Error('Salvataggio rifiutato')
      if (revision.current === rev) {
        dirty.current = false
        if (mountedRef.current) setSaveState('saved')
      }
    } catch {
      failed = true
      if (mountedRef.current) setSaveState('error')
    } finally {
      savingRef.current = false
      if (dirty.current && (!failed || revision.current !== rev)) {
        if (mountedRef.current) timerRef.current = setTimeout(() => persistRef.current?.(), 800)
        else persistRef.current?.()
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

  const patchRow = (id, key, value) => change({ rows: form.rows.map(row => row.id === id ? { ...row, [key]: value } : row) })
  const types = [...new Set(form.rows.map(row => row.type))]
  const saveLabel = saveState === 'saving' ? 'Salvataggio...' : saveState === 'dirty' ? 'Modifiche da salvare...' : saveState === 'error' ? 'Errore di salvataggio' : 'Salvato'
  const labelDate = value => new Date(value).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', timeZone: 'UTC' })

  return (
    <div className="space-y-5">
      <section className={section}>
        <StepBar title="Passo 1 - Obiettivo" />
        {!objectives.length && <p className="text-sm text-amber-800">Nessun obiettivo salvato nella Fase 1.</p>}
        {objectives.length > 0 && <label className="block text-sm">Obiettivo della Fase 1
          <select className={field} disabled={busy} value={form.objectiveId} onChange={event => selectObjective(event.target.value)}>
            <option value="">Seleziona obiettivo</option>
            {objectives.map((row, index) => <option key={row.id} value={row.id}>{objectiveLabel(row, index)}</option>)}
          </select>
        </label>}
        {objectiveState.error && <p role="alert" className="text-sm text-amber-800">{objectiveState.error}</p>}
        {context && <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div className="bg-gray-50 rounded p-3"><div className="text-xs text-gray-600">Fonte · Linea</div><strong>{manual ? 'Manuale' : `STAIN · ${scope.line}`}</strong></div>
          <div className="bg-gray-50 rounded p-3"><div className="text-xs text-gray-600">Baseline</div><strong>{itDate(baselineFrom)} - {itDate(baselineTo)}</strong></div>
          <div className="bg-gray-50 rounded p-3"><div className="text-xs text-gray-600">Valore baseline</div><strong>{fmt(Number(selectedObjective.baseline))} {selectedObjective.unit}</strong></div>
          <div className="bg-green-50 rounded p-3"><div className="text-xs text-gray-600">Target</div><strong>{fmt(Number(selectedObjective.target))} {selectedObjective.unit}{objectiveReduction != null ? ` (-${fmt(objectiveReduction * 100, 0)}%)` : ''}</strong></div>
          <div className="col-span-2 md:col-span-4 text-gray-600">Prodotti: {(scope?.products || []).join(', ') || context.meta.product || 'Tutti'} · Perdite: {context.meta.categories.join(', ')}</div>
        </div>}
      </section>

      {context && <section className={section}>
        <StepBar title="Passo 2 - Periodo di verifica" />
        <div className="grid md:grid-cols-2 gap-3">
          <label className="block text-sm">Intervento
            <select className={field} disabled={busy} value={form.interventionRef} onChange={event => selectIntervention(event.target.value)}>
              <option value="">{interventions.length ? 'Seleziona intervento (facoltativo)' : 'Nessun intervento collegato'}</option>
              {interventions.map(item => <option key={item.key} value={item.key}>{item.label}{item.date ? ` · ${itDate(item.date)}` : ''}</option>)}
            </select>
          </label>
          <label className="block text-sm">Data intervento
            <input type="date" className={field} disabled={busy} min={baselineTo ? dayAfter(baselineTo) : undefined} max={today} value={form.interventionDate} onChange={event => change({ interventionDate: event.target.value, afterFrom: event.target.value, ...resetComparison })} />
          </label>
          <label className="block text-sm">Verifica da
            <input type="date" className={field} disabled={busy} min={baselineTo ? dayAfter(baselineTo) : undefined} max={today} value={form.afterFrom} onChange={event => change({ afterFrom: event.target.value, ...resetComparison })} />
          </label>
          <label className="block text-sm">Verifica a
            <input type="date" className={field} disabled={busy} min={form.afterFrom || undefined} max={today} value={form.afterTo} onChange={event => change({ afterTo: event.target.value, ...resetComparison })} />
          </label>
        </div>
        {!form.afterTo && form.afterFrom && <button type="button" className={button} onClick={() => change({ afterTo: today, ...resetComparison })}>Fino a oggi</button>}
        {periodError && <p role="alert" className="text-sm text-amber-800">{periodError}</p>}
        {!manual && <div className="flex flex-wrap items-center gap-3">
          <button type="button" className={primary} disabled={busy || Boolean(periodError)} onClick={calculate}>{busy ? 'Calcolo in corso...' : form.rows.length ? 'Ricalcola' : 'Calcola'}</button>
          {message && <span role="status" aria-live="polite" className="text-sm">{message}</span>}
        </div>}
      </section>}

      {context && (form.rows.length > 0 || manual) && <section className={section}>
        <StepBar title="Passo 3 - Risultato" />

        <div className="grid md:grid-cols-3 gap-3 items-end">
          <label className="block text-sm">Versione driver
            <select className={field} disabled={busy} value={driverVersion} onChange={event => applyDriverVersion(event.target.value)}>
              {!driverVersions.length && <option value="">Nessuna versione</option>}
              {driverVersions.map(item => <option key={item.id} value={item.id}>{item.year} · {item.filename}</option>)}
            </select>
          </label>
          {(types.length ? types : ['scarto', 'rework']).includes('scarto') && <label className="block text-sm">Driver scarto €/kg
            <input type="number" min="0" step="any" className={field} value={form.driverScarto} onChange={event => change({ driverScarto: event.target.value })} />
          </label>}
          {(types.length ? types : ['scarto', 'rework']).includes('rework') && <label className="block text-sm">Driver rework €/kg
            <input type="number" min="0" step="any" className={field} value={form.driverRework} onChange={event => change({ driverRework: event.target.value })} />
          </label>}
        </div>
        {driverMessage && <p role="alert" className="text-sm text-amber-800">{driverMessage}</p>}

        {manual && <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm">
          <thead><tr>{['Prodotto', 'Tipo', 'Produzione prima kg', 'Perdita prima kg', 'Produzione dopo kg', 'Perdita dopo kg'].map(label => <th key={label} className="p-2 text-left border-b">{label}</th>)}</tr></thead>
          <tbody>{form.rows.map(row => <tr key={row.id} className="border-b">
            <td className="p-2">{row.product}</td>
            <td className="p-2">{typeLabel(row.type)}</td>
            <td className="p-1"><input type="number" min="0" step="any" className={field} value={row.beforeProduction} onChange={event => patchRow(row.id, 'beforeProduction', event.target.value)} /></td>
            <td className="p-2">{fmt(numeric(row.beforeLoss))}</td>
            <td className="p-1"><input type="number" min="0" step="any" className={field} value={row.afterProduction} onChange={event => patchRow(row.id, 'afterProduction', event.target.value)} /></td>
            <td className="p-1"><input type="number" min="0" step="any" className={field} value={row.afterLoss} onChange={event => patchRow(row.id, 'afterLoss', event.target.value)} /></td>
          </tr>)}</tbody>
        </table></div>}

        {totals && <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi label="Perdita baseline" value={pct(totals.beforeRate)} />
            <Kpi label="Target" value={pct(targetRate)} />
            <Kpi label="Perdita in verifica" value={pct(totals.afterRate)} tone={targetRate != null && totals.afterRate <= targetRate ? 'good' : undefined} />
            <Kpi label="Raggiungimento obiettivo" value={achievement == null ? '-' : `${fmt(achievement * 100, 0)}%`} tone={achievement >= 1 ? 'good' : achievement < 0 ? 'bad' : undefined} />
            <Kpi label="Saving %" value={pct(result.savingPct)} tone={result.savingPct > 0 ? 'good' : result.savingPct < 0 ? 'bad' : undefined} />
            <Kpi label={result.avoided < 0 ? 'Kg aggiuntivi' : 'Kg evitati'} value={fmt(Math.abs(result.avoided), 0)} />
            <Kpi label="Saving €" value={eur(result.gross)} tone={result.gross > 0 ? 'good' : result.gross < 0 ? 'bad' : undefined} />
            <Kpi label="Beneficio netto €" value={eur(result.net)} />
          </div>

          {trend.length > 0 && <div className="h-72 w-full" role="img" aria-label="Andamento giornaliero della perdita">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ top: 20, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <ReferenceArea x1={Date.parse(`${form.afterFrom}T00:00:00Z`)} x2={Date.parse(`${form.afterTo}T00:00:00Z`)} fill="#15803d" fillOpacity={0.08} />
                <XAxis dataKey="timestamp" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={labelDate} />
                <YAxis unit="%" width={55} />
                <Tooltip labelFormatter={value => new Date(value).toLocaleDateString('it-IT', { timeZone: 'UTC' })} formatter={value => [`${fmt(value)}%`, 'Perdita']} />
                <Line type="linear" dataKey="value" stroke="#85583f" strokeWidth={2} dot={{ r: 2 }} connectNulls={false} isAnimationActive={false} />
                <ReferenceLine y={totals.beforeRate * 100} stroke="#6b7280" strokeDasharray="4 4" label={{ value: `Baseline ${pct(totals.beforeRate)}`, position: 'insideTopLeft', fontSize: 11 }} />
                {targetRate != null && <ReferenceLine y={targetRate * 100} stroke="#15803d" strokeDasharray="4 4" label={{ value: `Target ${pct(targetRate)}`, position: 'insideBottomLeft', fontSize: 11, fill: '#15803d' }} />}
                {form.interventionDate && <ReferenceLine x={Date.parse(`${form.interventionDate}T00:00:00Z`)} stroke="#2563eb" strokeDasharray="5 3" label={{ value: 'Intervento', position: 'insideTopRight', fill: '#2563eb', fontSize: 11 }} />}
              </LineChart>
            </ResponsiveContainer>
          </div>}

          <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm">
            <thead><tr>{['Prodotto', 'Perdita prima', 'Perdita dopo', 'Kg attesi', 'Kg dopo', 'Kg evitati', 'Saving %', 'Saving €', 'Quota'].map(label => <th key={label} className="p-2 text-left border-b text-xs">{label}</th>)}</tr></thead>
            <tbody>
              {result.products.map(item => <tr key={item.product} className="border-b">
                <td className="p-2">{item.product}</td>
                <td className="p-2">{pct(item.beforeRate)}</td>
                <td className="p-2">{pct(item.afterRate)}</td>
                <td className="p-2">{fmt(item.expected, 0)}</td>
                <td className="p-2">{fmt(item.afterLoss, 0)}</td>
                <td className={`p-2 ${item.avoided < 0 ? 'text-red-700' : 'text-green-800'}`}>{fmt(item.avoided, 0)}</td>
                <td className="p-2">{pct(item.savingPct)}</td>
                <td className="p-2">{eur(item.gross)}</td>
                <td className="p-2">{item.shareEuro != null ? pct(item.shareEuro) : pct(item.shareKg)}</td>
              </tr>)}
              <tr className="font-semibold">
                <td className="p-2">Totale</td>
                <td className="p-2">{pct(totals.beforeRate)}</td>
                <td className="p-2">{pct(totals.afterRate)}</td>
                <td className="p-2">{fmt(totals.expected, 0)}</td>
                <td className="p-2">{fmt(totals.afterLoss, 0)}</td>
                <td className="p-2">{fmt(totals.avoided, 0)}</td>
                <td className="p-2">{pct(result.savingPct)}</td>
                <td className="p-2">{eur(result.gross)}</td>
                <td className="p-2">100%</td>
              </tr>
            </tbody>
          </table></div>
          <p className="text-xs text-gray-500">Kg attesi = produzione nel periodo di verifica × perdita % baseline. Saving € = kg evitati × driver €/kg.</p>
        </>}

        {form.excluded?.length > 0 && <p className="text-sm text-amber-800">Esclusi perché non prodotti in uno dei due periodi: {form.excluded.map(item => item.product).join(', ')}</p>}

        <div className="grid md:grid-cols-2 gap-3">
          <label className="block text-sm">Costi implementazione €
            <input type="number" min="0" step="any" className={field} value={form.costs} onChange={event => change({ costs: event.target.value })} />
          </label>
          <label className="block text-sm">Descrizione dei costi
            <input className={field} value={form.costNote} onChange={event => change({ costNote: event.target.value })} />
          </label>
        </div>
        <label className="block text-sm">Note
          <textarea rows={2} className={field} value={form.notes} onChange={event => change({ notes: event.target.value })} />
        </label>

        {issues.length > 0 && <div role="alert" className="text-sm text-amber-800">{[...new Set(issues)].map(issue => <p key={issue}>{issue}</p>)}</div>}

        {ready && <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={Boolean(form.reviewed)} onChange={event => change(event.target.checked ? { reviewed: true, reviewedBy: user?.full_name || user?.email || '', reviewedAt: new Date().toISOString() } : { reviewed: false, reviewedBy: '', reviewedAt: '' }, true)} />
          Risultato verificato
          {form.reviewed && form.reviewedBy && <span className="text-xs text-gray-500">{form.reviewedBy} · {new Date(form.reviewedAt).toLocaleDateString('it-IT')}</span>}
        </label>}
      </section>}

      <div className="flex flex-wrap justify-end items-center gap-3">
        <span role="status" aria-live="polite" className={`text-sm ${saveState === 'error' ? 'text-red-700' : 'text-gray-600'}`}>{saveLabel}</span>
        {saveState === 'error' && <button type="button" className={button} onClick={() => persistRef.current?.()}>Riprova salvataggio</button>}
      </div>
    </div>
  )
}
