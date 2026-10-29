import { useEffect, useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'

const HEADERS = ['Data / periodo', 'Tipo di scarto', 'Operazione', 'Componente', 'Scarto / Rilavorazione', 'Quantità scartata', 'Produzione di riferimento', 'Note']
const KEYS = ['periodo', 'categoria', 'operazione', 'componente', 'tipo', 'quantita', 'produzione', 'note']
const uid = () => globalThis.crypto?.randomUUID?.() || `r_${Date.now()}_${Math.random().toString(16).slice(2)}`
const number = value => value === '' || value == null ? null : Number(String(value).replace(',', '.'))
const valid = value => number(value) !== null && Number.isFinite(number(value)) && number(value) >= 0
const fmt = value => value == null || !Number.isFinite(value) ? 'Non disponibile' : new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 }).format(value)
const blank = () => ({ id: uid(), periodo: '', categoria: '', operazione: '', componente: '', tipo: 'Scarto', quantita: '', produzione: '', note: '' })
const button = 'border border-gray-300 rounded px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50'
const input = 'w-full min-w-0 border border-gray-300 rounded px-2 py-2 text-sm bg-white'

function initial(data, major) {
  return {
    ...data,
    problema: data.problema || major?.descrizione || '',
    dove: data.dove || data.perimetro || '',
    quando: data.quando || '',
    coinvolti: data.coinvolti || '',
    manifestazione: data.manifestazione || '',
    impatto: data.impatto || '',
    fonte_dati: data.fonte_dati || '',
    periodo_da: data.periodo_da || '',
    periodo_a: data.periodo_a || '',
    unita_misura: data.unita_misura === '%' ? '' : data.unita_misura || '',
    frequenza_rilevazione: data.frequenza_rilevazione || '',
    responsabile_misura: data.responsabile_misura || '',
    categorie_scarto: (data.categorie_scarto || []).map(row => ({ ...blank(), ...row, id: row.id || uid() })),
    priorita: data.priorita || (data.categoria_prioritaria ? [data.categoria_prioritaria] : []),
    metrica: data.metrica || (data.unita_misura === '%' ? 'percentuale' : 'quantita'),
    perimetro_kpi: data.perimetro_kpi || 'totale',
    target: data.target ?? '',
    scadenza: data.scadenza || major?.data_target || '',
  }
}

export default function ScrapBaseline({ stepData, onChange, major }) {
  const [form, setForm] = useState(() => initial(stepData?.dati || {}, major))
  const [status, setStatus] = useState('')
  const [saving, setSaving] = useState(false)
  const [pending, setPending] = useState(null)
  const [errors, setErrors] = useState([])
  const file = useRef(null)
  const revision = useRef(0)
  const dirty = useRef(false)
  const printArea = useRef(null)

  useEffect(() => {
    if (!dirty.current && !saving) setForm(initial(stepData?.dati || {}, major))
  }, [stepData?.dati])

  useEffect(() => {
    const guard = event => { if (dirty.current) { event.preventDefault(); event.returnValue = '' } }
    window.addEventListener('beforeunload', guard)
    return () => window.removeEventListener('beforeunload', guard)
  }, [])

  const change = update => {
    dirty.current = true
    revision.current += 1
    setStatus('Modifiche da salvare')
    setForm(current => typeof update === 'function' ? update(current) : { ...current, ...update })
  }
  const updateRow = (id, key, value) => change(current => ({ ...current, categorie_scarto: current.categorie_scarto.map(row => row.id === id ? { ...row, [key]: value } : row) }))

  const analysis = useMemo(() => {
    const groups = new Map()
    const periods = new Map()
    const issues = []
    form.categorie_scarto.forEach((row, index) => {
      if (!row.categoria.trim() && row.quantita === '') return
      if (!row.categoria.trim() || !valid(row.quantita)) { issues.push(`Riga ${index + 1}: indica scarto e quantità non negativa.`); return }
      const quantity = number(row.quantita)
      const category = row.categoria.trim()
      groups.set(category, (groups.get(category) || 0) + quantity)
      const period = row.periodo.trim()
      if (period) {
        const item = periods.get(period) || { periodo: period, totale: 0, selezionato: 0, produzione: null }
        item.totale += quantity
        if (form.priorita.includes(category)) item.selezionato += quantity
        if (row.produzione !== '') {
          if (!valid(row.produzione)) issues.push(`Riga ${index + 1}: produzione non valida.`)
          else if (item.produzione !== null && item.produzione !== number(row.produzione)) issues.push(`Periodo ${period}: produzioni diverse. Usa periodi distinti per lotti o turni differenti.`)
          else item.produzione = number(row.produzione)
        }
        periods.set(period, item)
      }
    })
    const total = [...groups.values()].reduce((a, b) => a + b, 0)
    let cumulative = 0
    const pareto = [...groups].sort((a, b) => b[1] - a[1]).map(([categoria, quantita]) => {
      cumulative += quantita
      return { categoria, quantita, quantita_calcolata: quantita, percentuale: total ? quantita / total * 100 : 0, cumulata: total ? cumulative / total * 100 : 0 }
    })
    const selected = pareto.filter(row => form.priorita.includes(row.categoria)).reduce((sum, row) => sum + row.quantita, 0)
    const timeline = [...periods.values()].sort((a, b) => a.periodo.localeCompare(b.periodo))
    const missingPeriods = form.categorie_scarto.some(row => valid(row.quantita) && row.categoria.trim() && !row.periodo.trim())
    const denominatorValid = timeline.length > 0 && !missingPeriods && timeline.every(row => row.produzione > 0 && row.totale <= row.produzione)
    const production = denominatorValid ? timeline.reduce((sum, row) => sum + row.produzione, 0) : null
    const numerator = form.perimetro_kpi === 'priorita' ? selected : total
    const baseline = issues.length || (form.perimetro_kpi === 'priorita' && !form.priorita.length) ? null : form.metrica === 'percentuale' ? production ? numerator / production * 100 : null : pareto.length ? numerator : null
    return { pareto, total, selected, timeline, baseline, issues, production }
  }, [form])

  const save = async () => {
    if (analysis.issues.length) { setStatus('Correggi i dati prima di salvare'); return }
    if (form.target !== '' && (!valid(form.target) || (form.metrica === 'percentuale' && number(form.target) > 100))) { setStatus('Target non valido'); return }
    if (form.periodo_da && form.periodo_a && form.periodo_da > form.periodo_a) { setStatus('Il periodo finale precede quello iniziale'); return }
    const currentRevision = revision.current
    setSaving(true)
    setStatus('Salvataggio...')
    try {
      const result = await onChange({ dati: { ...form, baseline: analysis.baseline ?? '', perimetro: form.dove, quantita_totale: analysis.total, pareto: analysis.pareto, categoria_prioritaria: form.priorita[0] || '' }, output_compilati: { problema: !!form.problema.trim(), perimetro: !!form.dove.trim(), fonte_dati: !!form.fonte_dati.trim(), periodo: !!(form.periodo_da && form.periodo_a), pareto: analysis.pareto.length > 0, categoria_prioritaria: form.priorita.length > 0, baseline: analysis.baseline !== null, target: form.target !== '' } })
      if (result === false) throw new Error('Salvataggio non riuscito')
      dirty.current = revision.current !== currentRevision
      setStatus(dirty.current ? 'Nuove modifiche da salvare' : 'Salvato')
    } catch (error) { setStatus('Errore di salvataggio. I dati restano nella pagina: riprova.') }
    finally { setSaving(false) }
  }

  const exportExcel = (template = false) => {
    const workbook = XLSX.utils.book_new()
    const rows = template ? [] : form.categorie_scarto.map(row => KEYS.map(key => row[key]))
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([HEADERS, ...rows]), 'Scarti')
    XLSX.writeFile(workbook, template ? 'Modello_scarti.xlsx' : 'Dati_scarti.xlsx')
  }
  const importExcel = async event => {
    const selected = event.target.files?.[0]
    event.target.value = ''
    if (!selected) return
    if (selected.size > 10 * 1024 * 1024) { setErrors(['File troppo grande: massimo 10 MB']); return }
    try {
      const workbook = XLSX.read(await selected.arrayBuffer(), { type: 'array', cellDates: false })
      const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1, defval: '', raw: false })
      if (!HEADERS.every((header, index) => String(matrix[0]?.[index] || '').trim() === header)) throw new Error('Intestazioni diverse dal modello. Scarica il modello e mantieni le colonne.')
      if (matrix.length > 5001) throw new Error('Massimo 5000 righe per importazione')
      const rows = matrix.slice(1).filter(row => row.some(value => String(value).trim())).map(row => Object.fromEntries([['id', uid()], ...KEYS.map((key, index) => [key, String(row[index] ?? '').trim()])]))
      const problems = rows.flatMap((row, index) => !row.categoria || !valid(row.quantita) || (row.produzione !== '' && !valid(row.produzione)) || !['Scarto', 'Rilavorazione'].includes(row.tipo) ? [`Riga ${index + 2}: controlla categoria, quantità, produzione e tipo (Scarto/Rilavorazione).`] : [])
      setErrors(problems)
      setPending(problems.length ? null : rows)
    } catch (error) { setPending(null); setErrors([error.message || 'File non leggibile']) }
  }
  const print = () => {
    const popup = window.open('', '_blank')
    if (!popup) { setStatus('Consenti le finestre popup per stampare'); return }
    const title = popup.document.createElement('h1')
    title.textContent = `${major?.titolo || 'Major Kaizen'} - Definire`
    popup.document.body.appendChild(title)
    const summary = popup.document.createElement('p')
    summary.textContent = `${form.problema}\nPeriodo: ${form.periodo_da} / ${form.periodo_a}. Fonte: ${form.fonte_dati}. Unità: ${form.unita_misura}. Baseline: ${fmt(analysis.baseline)}. Target: ${form.target}`
    popup.document.body.appendChild(summary)
    const table = popup.document.createElement('table')
    table.style.borderCollapse = 'collapse'
    ;[HEADERS, ...form.categorie_scarto.map(row => KEYS.map(key => row[key]))].forEach((values, index) => {
      const tr = popup.document.createElement('tr')
      values.forEach(value => { const cell = popup.document.createElement(index ? 'td' : 'th'); cell.textContent = String(value); cell.style.cssText = 'border:1px solid #aaa;padding:6px;font:12px sans-serif'; tr.appendChild(cell) })
      table.appendChild(tr)
    })
    popup.document.body.appendChild(table)
    popup.document.close()
    popup.focus()
    popup.print()
  }
  const field = (label, key, type = 'text') => <label className="block text-sm">{label}<input className={`${input} mt-1`} type={type} value={form[key]} onChange={event => change({ [key]: event.target.value })} /></label>
  const reduction = analysis.baseline > 0 && valid(form.target) ? (analysis.baseline - number(form.target)) / analysis.baseline * 100 : null

  return (
    <div ref={printArea} className="space-y-7">
      <section className="border-b pb-5">
        <h3 className="font-semibold mb-3">1. Definire il problema</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[['Cosa: difetto osservato e risultato atteso', 'problema'], ['Dove: operazione, componente e zona', 'dove'], ['Quando: condizioni in cui compare', 'quando'], ['Chi / cosa: prodotti, formati o postazioni coinvolti', 'coinvolti'], ['Come si manifesta', 'manifestazione'], ['Perché è un problema: impatto, non causa', 'impatto']].map(([label, key]) => <label key={key} className="block text-sm">{label}<textarea rows={2} className={`${input} mt-1`} value={form[key]} onChange={event => change({ [key]: event.target.value })} /></label>)}
        </div>
      </section>
      <section className="border-b pb-5">
        <h3 className="font-semibold mb-3">2. Scarti e dati</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
          {field('Periodo da', 'periodo_da', 'date')}{field('Periodo a', 'periodo_a', 'date')}{field('Fonte dati', 'fonte_dati')}
          {field('Unità quantità (kg, pezzi...)', 'unita_misura')}{field('Frequenza di rilevazione', 'frequenza_rilevazione')}{field('Responsabile della misura', 'responsabile_misura')}
        </div>
        <p className="text-xs text-gray-600 mb-3">Una riga per scarto e periodo. La produzione è il totale del periodo: se ripetuta su più categorie viene contata una sola volta. Per lotti distinti usa periodi distinti. Per i soli totali scrivi “Totale periodo”.</p>
        <div className="flex flex-wrap gap-2 mb-3">
          <button type="button" className={button} onClick={() => change(current => ({ ...current, categorie_scarto: [...current.categorie_scarto, blank()] }))}>Aggiungi riga</button>
          <button type="button" className={button} onClick={() => file.current?.click()}>Importa Excel</button>
          <button type="button" className={button} onClick={() => exportExcel()}>Esporta Excel</button>
          <button type="button" className={button} onClick={() => exportExcel(true)}>Modello Excel</button>
          <button type="button" className={button} onClick={print}>Stampa</button>
          <input ref={file} type="file" accept=".xlsx,.xls,.csv" onChange={importExcel} className="hidden" />
        </div>
        {errors.length > 0 && <div role="alert" className="text-sm text-red-700 mb-3">{errors.slice(0, 20).map((error, index) => <p key={index}>{error}</p>)}{errors.length > 20 && <p>Altri {errors.length - 20} errori. Nessuna riga importata.</p>}</div>}
        {pending && <div className="border p-3 mb-3 text-sm"><p>{pending.length} righe valide. Prime righe: {pending.slice(0, 3).map(row => `${row.categoria}: ${row.quantita}`).join('; ')}</p><div className="flex gap-2 mt-2"><button type="button" className={button} onClick={() => { change(current => ({ ...current, categorie_scarto: [...current.categorie_scarto, ...pending] })); setPending(null) }}>Aggiungi ai dati</button><button type="button" className={button} onClick={() => { if (confirm('Sostituire tutte le righe attuali?')) { change({ categorie_scarto: pending }); setPending(null) } }}>Sostituisci dati</button><button type="button" className={button} onClick={() => setPending(null)}>Annulla</button></div></div>}
        <div className="overflow-x-auto"><table className="w-full text-sm min-w-[1100px]"><thead><tr>{HEADERS.map(header => <th key={header} className="text-left p-2 border-b font-medium">{header}</th>)}<th className="p-2 border-b">Azioni</th></tr></thead><tbody>{form.categorie_scarto.map(row => <tr key={row.id}>{KEYS.map(key => <td key={key} className="p-1 border-b">{key === 'tipo' ? <select className={input} value={row.tipo} onChange={event => updateRow(row.id, key, event.target.value)}><option>Scarto</option><option>Rilavorazione</option></select> : <input aria-label={HEADERS[KEYS.indexOf(key)]} className={input} value={row[key]} type={['quantita', 'produzione'].includes(key) ? 'number' : 'text'} min="0" step="any" onChange={event => updateRow(row.id, key, event.target.value)} />}</td>)}<td className="p-2"><button type="button" className="text-red-700 text-xs" onClick={() => change(current => ({ ...current, categorie_scarto: current.categorie_scarto.filter(item => item.id !== row.id) }))}>Elimina</button></td></tr>)}</tbody></table></div>
        {analysis.issues.length > 0 && <p role="alert" className="text-red-700 text-sm mt-2">{analysis.issues.slice(0, 5).join(' ')}</p>}
      </section>
      <section className="border-b pb-5">
        <h3 className="font-semibold mb-3">3. Scegliere le priorità</h3>
        {analysis.pareto.length ? <><div className="h-72"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={analysis.pareto} margin={{ top: 10, right: 15, bottom: 25, left: 0 }}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="categoria" /><YAxis yAxisId="quantita" /><YAxis yAxisId="percentuale" orientation="right" domain={[0, 100]} unit="%" /><Tooltip /><Legend /><Bar yAxisId="quantita" dataKey="quantita" name={`Scarto (${form.unita_misura || 'quantità'})`} fill="#76513b" /><Line yAxisId="percentuale" dataKey="cumulata" name="Cumulata %" stroke="#b57928" /></ComposedChart></ResponsiveContainer></div><div className="flex flex-wrap gap-4 mt-3">{analysis.pareto.map(row => <label key={row.categoria} className="text-sm flex gap-2 items-center"><input type="checkbox" checked={form.priorita.includes(row.categoria)} onChange={event => change({ priorita: event.target.checked ? [...form.priorita, row.categoria] : form.priorita.filter(value => value !== row.categoria) })} />{row.categoria}</label>)}</div></> : <p className="text-sm text-gray-500">Inserisci gli scarti e le quantità per costruire il Pareto.</p>}
        {analysis.timeline.length > 1 && <details className="mt-4"><summary className="text-sm cursor-pointer">Andamento per periodo</summary><p className="text-xs text-gray-500 mt-2">Confronta solo periodi della stessa durata e con esposizione comparabile.</p><div className="h-60"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={analysis.timeline}><XAxis dataKey="periodo" /><YAxis /><Tooltip /><Line dataKey="totale" name="Scarto totale" stroke="#76513b" /></ComposedChart></ResponsiveContainer></div></details>}
      </section>
      <section>
        <h3 className="font-semibold mb-3">4. Baseline e obiettivo</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <label className="text-sm">KPI<select className={`${input} mt-1`} value={form.metrica} onChange={event => change({ metrica: event.target.value })}><option value="quantita">Quantità scartata</option><option value="percentuale">Percentuale di scarto</option></select></label>
          <label className="text-sm">Perimetro<select className={`${input} mt-1`} value={form.perimetro_kpi} onChange={event => change({ perimetro_kpi: event.target.value })}><option value="totale">Tutte le categorie</option><option value="priorita">Categorie prioritarie</option></select></label>
          <label className="text-sm">Baseline calcolata<output className={`${input} mt-1 block bg-gray-50`}>{fmt(analysis.baseline)} {form.metrica === 'percentuale' ? '%' : form.unita_misura}</output></label>
          {field('Target', 'target', 'number')}{field('Scadenza', 'scadenza', 'date')}
        </div>
        {form.metrica === 'percentuale' && analysis.production === null && <p className="text-sm text-amber-800 mt-2">Per calcolare la percentuale servono periodi identificati e produzione positiva coerente per ogni periodo.</p>}
        {reduction !== null && <p className="text-sm mt-3">Riduzione attesa rispetto alla baseline: {fmt(reduction)}%.</p>}
      </section>
      <div className="flex flex-wrap justify-end items-center gap-3 border-t pt-4"><span role="status" className="text-sm">{status}</span><button type="button" className="bg-primary text-white px-4 py-2 rounded disabled:opacity-50" disabled={saving} onClick={save}>{saving ? 'Salvataggio...' : 'Salva fase'}</button></div>
    </div>
  )
}
