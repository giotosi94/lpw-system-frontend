import { useEffect, useRef, useState } from 'react'
import api from '../../../../services/api'
import { baselineScope, aggregateSnapshot, compareSnapshots, calculateSaving } from './scrapSavingMath'

const field = 'w-full border border-gray-300 rounded px-2 py-2 text-sm bg-white'
const button = 'border rounded px-3 py-2 text-sm disabled:opacity-50'
const section = 'border border-gray-200 rounded-lg bg-white p-4 space-y-3'
const fmt = value => value == null || !Number.isFinite(value) ? 'Non disponibile' : new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 }).format(value)
const empty = () => ({ mode: 'stain', scope: null, before: null, after: null, afterFrom: '', afterTo: '', manualBeforeFrom: '', manualBeforeTo: '', rows: [], costs: '', costNote: '', annualProduction: '', annualBasis: '', source: '', notes: '', reviewed: false })


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

export default function ScrapSavings({ stepData, allStepsData, onChange, major }) {
  const [form, setForm] = useState(() => ({ ...empty(), ...(stepData?.dati?.saving_economico || {}) }))
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [periodStatus, setPeriodStatus] = useState('')
  const [driverStatus, setDriverStatus] = useState('')
  const [driverVersions, setDriverVersions] = useState([])
  const [driverVersion, setDriverVersion] = useState('')
  useEffect(() => {
    api.get('/economic-drivers/versions').then(response => setDriverVersions(response.data)).catch(() => setDriverStatus('Elenco driver non disponibile: verifica il backend.'))
  }, [])
  const dirty = useRef(false)
  const revision = useRef(0)
  const baseline = Object.values(allStepsData || {}).map(item => item?.dati).find(data => data?.stain_snapshot || data?.categorie_scarto)
  useEffect(() => {
    if (!dirty.current) setForm({ ...empty(), ...(stepData?.dati?.saving_economico || {}) })
  }, [stepData?.dati])
  useEffect(() => {
    const guard = event => { if (dirty.current) { event.preventDefault(); event.returnValue = '' } }
    window.addEventListener('beforeunload', guard)
    return () => window.removeEventListener('beforeunload', guard)
  }, [])
  const change = patch => {
    dirty.current = true
    revision.current += 1
    setStatus('Modifiche da salvare')
    setForm(current => ({ ...current, ...patch, reviewed: false }))
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
      setDriverStatus('Driver applicati. Salva risultati e saving per conservarne lo snapshot.')
    } catch (error) { setDriverStatus(typeof error.response?.data?.detail === 'string' ? error.response.data.detail : error.message || 'Driver da configurare') }
    finally { setBusy(false) }
  }
  const result = calculateSaving(form.rows, form.costs, form.annualProduction)
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
  if (form.annualProduction !== '' && !form.annualBasis.trim()) issues.push('Indica la fonte del volume annuo e l’ipotesi di mix costante.')

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
  const save = async () => {
    if (issues.length) { setStatus(issues.join(' ')); return }
    const rev = revision.current
    setBusy(true)
    try {
      const payload = { ...form, formula_version: 'scrap_normalized_v1', saved_at: new Date().toISOString(), result: { gross: result.gross, avoided: result.avoided, net: result.net, annualGross: result.annualGross, rows: result.rows }, validation: form.reviewed ? 'verificato_dal_compilatore' : 'da_validare' }
      const response = await onChange({ dati: { ...(stepData?.dati || {}), saving_economico: payload }, output_compilati: { confronto_prima_dopo: true, driver_economici: true, saving_calcolato: true, verifica_risultati: form.reviewed } })
      if (response === false) throw new Error('Salvataggio rifiutato')
      dirty.current = revision.current !== rev
      setStatus(dirty.current ? 'Nuove modifiche da salvare' : 'Salvato')
    } catch { setStatus('Errore di salvataggio: dati conservati nella pagina. Riprova.') }
    finally { setBusy(false) }
  }
  useEffect(() => {
    if (form.mode !== 'stain' || form.scope || !baseline || dirty.current) return
    try {
      const scope = baselineScope(baseline)
      aggregateSnapshot(baseline.stain_snapshot, scope)
      setForm(current => current.scope ? current : { ...current, scope, before: JSON.parse(JSON.stringify(baseline.stain_snapshot)) })
    } catch {
      setPeriodStatus('Baseline non disponibile: carica e salva i dati nella Fase 1, poi importali qui.')
    }
  }, [baseline, form.mode, form.scope])
  const input = (label, key, type = 'text') => {
    const beforeDate = key === 'comparisonFrom' || key === 'comparisonTo'
    const value = beforeDate ? (key === 'comparisonFrom' ? beforeFrom : beforeTo) || '' : form[key]
    return <label className="text-sm block">{label}<input className={field} type={type} disabled={busy} min={type === 'number' ? '0' : undefined} max={type === 'date' ? today : undefined} step={type === 'number' ? 'any' : undefined} value={value} onChange={event => {
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
      <section className={section}>
        <h3 className="font-bold text-primary">2 · Driver e beneficio economico</h3>
        <p className="text-xs text-gray-600">Driver €/kg dalla versione annuale dei Settings, oppure inserimento manuale documentato. Scarto e rework distinti: non inserire gli stessi kg due volte. Le produzioni per uno stesso prodotto devono coincidere. Nessuna formula manodopera inclusa.</p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm flex-1">Versione driver economici<select className={field} disabled={busy} value={driverVersion} onChange={event => setDriverVersion(event.target.value)}><option value="">Seleziona anno e versione</option>{driverVersions.map(version => <option key={version.id} value={version.id}>{version.year} · {version.filename} · {new Date(version.created_at).toLocaleString('it-IT')}</option>)}</select></label>
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
        <div className="grid md:grid-cols-2 gap-3">{input('Costi implementazione € (anche zero)', 'costs', 'number')}{input('Descrizione e fonte dei costi', 'costNote')}</div>
      </section>
      <section className={section}>
        <h3 className="font-bold text-primary">3 · Risultato e verifica</h3>
        {!form.rows.length ? <p className="text-sm">Completa prima il confronto e i driver per vedere il risultato.</p> : issues.length > 0 ? <div className="text-sm text-amber-800">{[...new Set(issues)].map(issue => <p key={issue}>{issue}</p>)}</div> : <div className="grid md:grid-cols-3 gap-3">{[[result.avoided < 0 ? 'Kg aggiuntivi rispetto all’atteso' : 'Kg risparmiati', Math.abs(result.avoided)], [result.gross < 0 ? 'Maggior costo stimato del periodo €' : 'Saving lordo del periodo €', Math.abs(result.gross)], [result.net < 0 ? 'Saldo netto negativo, inclusi costi €' : 'Beneficio netto progetto €', Math.abs(result.net)]].map(([label, value]) => <div key={label} className="bg-gray-50 p-3 rounded"><div className="text-xs">{label}</div><strong className="text-xl">{fmt(value)}</strong></div>)}</div>}
        <details><summary className="text-sm cursor-pointer">Proiezione annuale facoltativa</summary><div className="grid md:grid-cols-2 gap-3 mt-3">{input('Produzione annua del perimetro kg', 'annualProduction', 'number')}{input('Fonte volume annuo e ipotesi mix costante', 'annualBasis')}</div><p className="text-sm mt-2">Beneficio lordo annuo stimato: {issues.length ? 'Non disponibile' : fmt(result.annualGross)} €. Proiezione a mix costante, non beneficio già maturato; costi una tantum non annualizzati.</p></details>
        <label className="block text-sm">Evidenze e nota di verifica<textarea className={field} rows={3} value={form.notes} onChange={event => change({ notes: event.target.value })} /></label>
        <label className="flex gap-2 text-sm"><input type="checkbox" checked={form.reviewed} disabled={issues.length > 0 || !form.notes.trim()} onChange={event => { dirty.current = true; revision.current += 1; setForm(current => ({ ...current, reviewed: event.target.checked })); setStatus('Modifiche da salvare') }} />Confronto verificato dal compilatore (non approvazione Finance)</label>
        <p className="text-xs text-gray-500">Stima dei benefici di progetto, non valutazione di investimento. Nessuna somma automatica con saving di Quick/Standard o altri Major.</p>
      </section>
      <div className="flex flex-wrap justify-end items-center gap-3"><span role="status" className="text-sm">{status}</span><button type="button" disabled={busy} className="bg-primary text-white px-4 py-2 rounded disabled:opacity-50" onClick={save}>{busy ? 'Attendere...' : 'Salva risultati e saving'}</button></div>
    </div>
  )
}
