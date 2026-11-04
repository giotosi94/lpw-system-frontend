import { useEffect, useRef, useState } from 'react'
import api from '../../../../services/api'
import { baselineScope, aggregateSnapshot, compareSnapshots, calculateSaving } from './scrapSavingMath'

const field = 'w-full border border-gray-300 rounded px-2 py-2 text-sm bg-white'
const button = 'border rounded px-3 py-2 text-sm disabled:opacity-50'
const section = 'border border-gray-200 rounded-lg bg-white p-4 space-y-3'
const fmt = value => value == null || !Number.isFinite(value) ? 'Non disponibile' : new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 }).format(value)
const empty = () => ({ mode: 'stain', scope: null, before: null, after: null, afterFrom: '', afterTo: '', manualBeforeFrom: '', manualBeforeTo: '', rows: [], costs: '', costNote: '', annualProduction: '', annualBasis: '', source: '', notes: '', reviewed: false })


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
  const periodError = !firstAfter ? 'Acquisisci prima una baseline valida.' : firstAfter > today ? 'La baseline termina oggi o nel futuro: non esistono ancora giorni successivi disponibili. Per una prova storica modifica il periodo in Fase 1 e riacquisisci la baseline.' : !form.afterFrom || !form.afterTo ? 'Seleziona le date del periodo dopo.' : form.afterFrom < firstAfter ? `Il periodo dopo deve iniziare dal ${firstAfter} in avanti.` : form.afterTo < form.afterFrom ? 'La fine non puo precedere l’inizio.' : form.afterTo > today ? 'Non puoi selezionare giorni futuri.' : ''
  const confirmed = form.mode !== 'stain' || form.scope?.lineConfirmedFor === `${major?.reparto || ''}|${major?.linea || ''}|${form.scope?.line || ''}`
  if (periodError) issues.push(periodError)
  if (!confirmed) issues.push('Conferma la corrispondenza della linea STAIN con il progetto.')

  if (!beforeFrom || !beforeTo || !form.afterFrom || !form.afterTo || beforeFrom > beforeTo || form.afterFrom > form.afterTo || form.afterFrom <= beforeTo) issues.push('Definisci periodi validi, non sovrapposti: il dopo deve iniziare dopo la baseline.')
  if (form.mode === 'stain' && (!form.before || !form.after || form.after.dal !== form.afterFrom || form.after.al !== form.afterTo)) issues.push('Carica il periodo dopo per le date selezionate.')
  if (form.mode === 'manuale' && !form.source.trim()) issues.push('Documenta fonte, linea, prodotti e causali del confronto manuale.')
  if (form.costs !== '' && Number(String(form.costs).replace(',', '.')) > 0 && !form.costNote.trim()) issues.push('Descrivi i costi di implementazione.')
  if (form.annualProduction !== '' && !form.annualBasis.trim()) issues.push('Indica la fonte del volume annuo e l’ipotesi di mix costante.')

  const capture = () => {
    try {
      if (!baseline) throw new Error('Salva prima la baseline della Fase 1.')
      if (form.scope && !window.confirm('Sostituire lo snapshot baseline? Il confronto dopo e i calcoli saranno azzerati.')) return
      const scope = baselineScope(baseline)
      aggregateSnapshot(baseline.stain_snapshot, scope)
      const first = dayAfter(scope.to)
      const available = first && first <= todayDate()
      change({ scope, before: JSON.parse(JSON.stringify(baseline.stain_snapshot)), after: null, rows: [], driverSnapshot: null, afterFrom: available ? first : '', afterTo: available ? todayDate() : '' })
      setPeriodStatus(available ? 'Baseline acquisita. Date proposte automaticamente: verifica linea e periodo.' : 'Baseline acquisita, ma nessun giorno successivo disponibile.')
    } catch (error) { setPeriodStatus(error.message) }
  }
  const load = async () => {
    if (periodError || !confirmed) { setPeriodStatus(periodError || 'Conferma la linea STAIN.'); return }
    setBusy(true)
    setPeriodStatus('Lettura STAIN in corso...')
    try {
      const response = await api.get('/stain/scarti', { params: { dal: form.afterFrom, al: form.afterTo, linea: form.scope.line, tipi: form.scope.types.join(',') }, timeout: 180000 })
      const rows = compareSnapshots(form.before, response.data, form.scope, form.rows)
      change({ after: response.data, rows })
      setPeriodStatus(`Confronto caricato: ${rows.length} righe. Ora applica i driver economici.`)
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
  const input = (label, key, type = 'text') => {
    const afterDate = type === 'date' && key.startsWith('after')
    const min = type === 'number' ? '0' : key === 'afterFrom' ? firstAfter || undefined : key === 'afterTo' ? (form.afterFrom && form.afterFrom >= firstAfter ? form.afterFrom : firstAfter) || undefined : undefined
    return <label className="text-sm block">{label}<input className={field} type={type} disabled={busy || (afterDate && (!firstAfter || firstAfter > today))} min={min} max={type === 'date' ? today : undefined} step={type === 'number' ? 'any' : undefined} value={form[key]} onChange={event => {
      let value = event.target.value
      const patch = {}
      if (afterDate) {
        if (value && min && value < min) value = min
        if (value && value > today) value = today
        patch.after = null
        patch.rows = []
        if (key === 'afterFrom' && value && (!form.afterTo || form.afterTo < value)) patch.afterTo = value
        setPeriodStatus('Date aggiornate: carica nuovamente il periodo dopo.')
      }
      change({ ...patch, [key]: value })
    }} /></label>
  }
  return (
    <div className="space-y-5">
      <section className={section}>
        <h3 className="font-bold text-primary">1 · Confronto prima e dopo</h3>
        <p className="text-sm text-gray-600">Kg evitati = produzione dopo × tasso perdita baseline − perdita dopo. Calcolo separato per prodotto e tipo; i peggioramenti restano negativi.</p>
        <label className="block text-sm">Fonte<select className={field} disabled={busy} value={form.mode} onChange={event => { if (!form.rows.length || window.confirm('Cambiare fonte e azzerare il confronto?')) change({ ...empty(), mode: event.target.value }) }}><option value="stain">STAIN</option><option value="manuale">Confronto manuale in kg</option></select></label>
        {form.mode === 'stain' ? <>
          <button type="button" disabled={busy} className={button} onClick={capture}>Acquisisci baseline salvata della Fase 1</button>
          {form.scope && <div className="text-sm bg-gray-50 p-3 rounded"><p>{form.scope.line} · {form.scope.from} / {form.scope.to}</p><p>Prodotti: {form.scope.products.join(', ') || 'Tutti'} · Causali: {form.scope.priorities.join(', ') || 'Tutte le causali dei tipi selezionati'}</p><p>Snapshot congelato: gli aggiornamenti della Fase 1 non cambiano questo calcolo.</p></div>}
        </> : <><div className="grid md:grid-cols-2 gap-3">{input('Baseline da', 'manualBeforeFrom', 'date')}{input('Baseline a', 'manualBeforeTo', 'date')}</div>{input('Fonte e perimetro manuale (linea, prodotti, causali, evidenze)', 'source')}</>}
        {form.mode === 'stain' && form.scope && <div className="border rounded p-3 text-sm space-y-2">
          <p>Linea progetto: {major?.reparto} / {major?.linea}. Linea STAIN: {form.scope.line}.</p>
          <p>Se non corrispondono, correggi la selezione nella Fase 1 e riacquisisci la baseline. I nomi diversi non dimostrano da soli una corrispondenza o un errore.</p>
          <label className="flex gap-2"><input type="checkbox" disabled={busy} checked={confirmed} onChange={event => change({ scope: { ...form.scope, lineConfirmedFor: event.target.checked ? `${major?.reparto || ''}|${major?.linea || ''}|${form.scope.line}` : '' }, after: null, rows: [] })} />Confermo che la linea STAIN corrisponde al progetto.</label>
        </div>}
        <p className="text-sm text-gray-600">Prima: baseline della Fase 1. Dopo: periodo successivo agli interventi, senza sovrapposizioni. Le date automatiche non attestano quando sono avvenuti gli interventi.</p>
        {form.mode === 'stain' && firstAfter && firstAfter <= today && <button type="button" className={button} disabled={busy} onClick={() => { change({ afterFrom: firstAfter, afterTo: today, after: null, rows: [] }); setPeriodStatus('Date valide proposte: controlla e carica STAIN.') }}>Imposta date valide automaticamente</button>}
        <div className="grid md:grid-cols-2 gap-3">{input('Periodo dopo da', 'afterFrom', 'date')}{input('Periodo dopo a', 'afterTo', 'date')}</div>
        {form.mode === 'stain' && <button type="button" disabled={busy || !form.scope || Boolean(periodError) || !confirmed} className={button} onClick={load}>{busy ? 'Caricamento...' : 'Carica periodo dopo da STAIN'}</button>}
        {periodError && <p role="alert" className="text-sm text-amber-800">{periodError}</p>}
        {form.scope && !confirmed && <p className="text-sm text-amber-800">Conferma la linea prima del caricamento.</p>}
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
        {form.rows.length > 0 && <div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-xs"><thead><tr>{['Prodotto', 'Tipo', 'Produzione prima kg', 'Perdita prima kg', 'Produzione dopo kg', 'Perdita dopo kg', 'Driver €/kg', 'Anno', 'Riferimento driver', 'Kg evitati', 'Beneficio €', ''].map((label, index) => <th key={index} className="p-2 text-left border-b">{label}</th>)}</tr></thead><tbody>
          {form.rows.map(row => { const computed = result.rows.find(item => item.id === row.id); return <tr key={row.id}>
            <td className="p-1"><input aria-label="Prodotto" className={field} disabled={form.mode === 'stain'} value={row.product} onChange={event => patchRow(row.id, 'product', event.target.value)} /></td>
            <td className="p-1"><select aria-label="Tipo perdita" className={field} disabled={form.mode === 'stain'} value={row.type} onChange={event => patchRow(row.id, 'type', event.target.value)}><option value="scarto">Scarto</option><option value="rework">Rework</option></select></td>
            {['beforeProduction', 'beforeLoss', 'afterProduction', 'afterLoss', 'driver', 'driverYear', 'driverRef'].map(key => <td key={key} className="p-1"><input aria-label={key} className={field} disabled={form.mode === 'stain' && ['beforeProduction', 'beforeLoss', 'afterProduction', 'afterLoss'].includes(key)} type={key === 'driverRef' ? 'text' : 'number'} min="0" step="any" value={row[key]} onChange={event => patchRow(row.id, key, event.target.value)} /></td>)}
            <td className="p-2">{fmt(computed?.avoided)}</td><td className="p-2">{fmt(computed?.gross)}</td><td>{form.mode === 'manuale' && <button type="button" onClick={() => change({ rows: form.rows.filter(item => item.id !== row.id) })}>Elimina</button>}</td>
          </tr> })}
        </tbody></table></div>}
        <div className="grid md:grid-cols-2 gap-3">{input('Costi implementazione € (anche zero)', 'costs', 'number')}{input('Descrizione e fonte dei costi', 'costNote')}</div>
      </section>
      <section className={section}>
        <h3 className="font-bold text-primary">3 · Risultato e verifica</h3>
        {!form.rows.length ? <p className="text-sm">Completa prima il confronto e i driver per vedere il risultato.</p> : issues.length > 0 ? <div className="text-sm text-amber-800">{[...new Set(issues)].map(issue => <p key={issue}>{issue}</p>)}</div> : <div className="grid md:grid-cols-3 gap-3">{[['Kg evitati', result.avoided], ['Beneficio lordo periodo €', result.gross], ['Beneficio netto progetto €', result.net]].map(([label, value]) => <div key={label} className="bg-gray-50 p-3 rounded"><div className="text-xs">{label}</div><strong className="text-xl">{fmt(value)}</strong></div>)}</div>}
        <details><summary className="text-sm cursor-pointer">Proiezione annuale facoltativa</summary><div className="grid md:grid-cols-2 gap-3 mt-3">{input('Produzione annua del perimetro kg', 'annualProduction', 'number')}{input('Fonte volume annuo e ipotesi mix costante', 'annualBasis')}</div><p className="text-sm mt-2">Beneficio lordo annuo stimato: {issues.length ? 'Non disponibile' : fmt(result.annualGross)} €. Proiezione a mix costante, non beneficio già maturato; costi una tantum non annualizzati.</p></details>
        <label className="block text-sm">Evidenze e nota di verifica<textarea className={field} rows={3} value={form.notes} onChange={event => change({ notes: event.target.value })} /></label>
        <label className="flex gap-2 text-sm"><input type="checkbox" checked={form.reviewed} disabled={issues.length > 0 || !form.notes.trim()} onChange={event => { dirty.current = true; revision.current += 1; setForm(current => ({ ...current, reviewed: event.target.checked })); setStatus('Modifiche da salvare') }} />Confronto verificato dal compilatore (non approvazione Finance)</label>
        <p className="text-xs text-gray-500">Stima dei benefici di progetto, non valutazione di investimento. Nessuna somma automatica con saving di Quick/Standard o altri Major.</p>
      </section>
      <div className="flex flex-wrap justify-end items-center gap-3"><span role="status" className="text-sm">{status}</span><button type="button" disabled={busy} className="bg-primary text-white px-4 py-2 rounded disabled:opacity-50" onClick={save}>{busy ? 'Attendere...' : 'Salva risultati e saving'}</button></div>
    </div>
  )
}
