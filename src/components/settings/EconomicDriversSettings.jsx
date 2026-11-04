import { useEffect, useState } from 'react'
import api from '../../services/api'

const field = 'border rounded px-3 py-2 text-sm bg-white w-full'
const button = 'border rounded px-3 py-2 text-sm disabled:opacity-50'
const money = value => value == null ? 'Mancante' : new Intl.NumberFormat('it-IT', { maximumFractionDigits: 4 }).format(value)
const errorText = error => typeof error.response?.data?.detail === 'string' ? error.response.data.detail : 'Operazione non riuscita. Controlla i dati o i permessi.'

export default function EconomicDriversSettings() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [file, setFile] = useState(null)
  const [versions, setVersions] = useState([])
  const [lines, setLines] = useState([])
  const [doc, setDoc] = useState(null)
  const [mapping, setMapping] = useState({})
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const load = async () => {
    try {
      const [v, l] = await Promise.all([api.get('/economic-drivers/versions'), api.get('/economic-drivers/lines')])
      setVersions(v.data)
      setLines(l.data)
    } catch (error) { setMessage(errorText(error)) }
  }
  useEffect(() => { load() }, [])
  const preview = async () => {
    if (!file || !Number.isInteger(Number(year)) || Number(year) < 2000 || Number(year) > 2100) { setMessage('Seleziona un Excel .xlsx e un anno valido.'); return }
    setBusy(true)
    setMessage('')
    try {
      const data = new FormData()
      data.append('file', file)
      data.append('year', String(year))
      const response = await api.post('/economic-drivers/preview', data)
      setDoc(response.data)
      const codes = new Set(response.data.rows.map(row => row.code))
      const validLines = new Set(lines.map(line => line.key))
      setMapping(Object.fromEntries(Object.entries(response.data.mapping || {}).filter(([key, value]) => validLines.has(key) && codes.has(value))))
      setMessage('Anteprima caricata. Verifica anno, costi e associazioni prima di pubblicare.')
    } catch (error) { setMessage(errorText(error)) }
    finally { setBusy(false) }
  }
  const open = async id => {
    if (!id) return
    setBusy(true)
    try {
      const response = await api.get(`/economic-drivers/${id}`)
      setDoc(response.data)
      setMapping(response.data.mapping || {})
      setMessage('Versione pubblicata: dati e associazioni non modificabili. Per correggerli importa una nuova versione.')
    } catch (error) { setMessage(errorText(error)) }
    finally { setBusy(false) }
  }
  const publish = async () => {
    if (!doc || !window.confirm(`Pubblicare i driver ${doc.year}? La versione e le associazioni saranno congelate. Le linee non associate non avranno un driver automatico.`)) return
    setBusy(true)
    try {
      await api.post(`/economic-drivers/${doc.id}/publish`, { mapping })
      setDoc({ ...doc, status: 'published', mapping })
      await load()
      setMessage('Versione pubblicata. I saving esistenti non vengono modificati.')
    } catch (error) { setMessage(errorText(error)) }
    finally { setBusy(false) }
  }
  return (
    <div className="bg-white border rounded-lg p-4 space-y-4">
      <h2 className="font-semibold">Driver economici annuali</h2>
      <p className="text-sm text-gray-600">Importa il foglio Costi del modello Drivers. Celle unite riconosciute; costi mancanti non trasformati in zero. Caricamento e pubblicazione riservati agli amministratori.</p>
      <div className="grid md:grid-cols-3 gap-3">
        <label className="text-sm">Anno di validità<input type="number" min="2000" max="2100" className={field} value={year} disabled={busy} onChange={event => setYear(event.target.value)} /></label>
        <label className="text-sm">File Excel<input type="file" accept=".xlsx" className={field} disabled={busy} onChange={event => setFile(event.target.files?.[0] || null)} /></label>
        <div className="flex items-end"><button type="button" className={button} disabled={busy || !file} onClick={preview}>{busy ? 'Attendere...' : 'Carica anteprima'}</button></div>
      </div>
      <label className="block text-sm">Versioni pubblicate<select className={field} disabled={busy} value={doc?.status === 'published' ? doc.id : ''} onChange={event => open(event.target.value)}><option value="">Seleziona versione</option>{versions.map(version => <option key={version.id} value={version.id}>{version.year} · {version.filename} · {new Date(version.created_at).toLocaleString('it-IT')}</option>)}</select></label>
      {message && <p role="status" className="text-sm text-gray-700">{message}</p>}
      {doc && <>
        <p className="text-sm font-semibold">{doc.filename} · anno {doc.year} · {doc.status === 'published' ? 'Pubblicata' : 'Bozza'} · {doc.rows.length} risorse</p>
        {(doc.errors || []).map((error, index) => <p key={index} role="alert" className="text-sm text-red-700">{error}</p>)}
        <div className="overflow-x-auto max-h-80"><table className="w-full text-sm"><thead><tr>{['Risorsa', 'Descrizione', 'Scarto €/kg', 'Rework €/kg', 'Seconda qualità €/kg'].map(label => <th key={label} className="text-left p-2 border-b">{label}</th>)}</tr></thead><tbody>{doc.rows.map((row, index) => <tr key={index}><td className="p-2 font-mono">{row.code}</td><td className="p-2">{row.description}</td><td className="p-2">{money(row.scarto)}</td><td className="p-2">{money(row.rework)}</td><td className="p-2">{money(row.seconda_qualita)}</td></tr>)}</tbody></table></div>
        <h3 className="font-semibold text-sm">Associazioni alle linee LPW</h3>
        <p className="text-xs text-gray-600">Una risorsa può essere usata da più linee. Le associazioni valide della versione precedente sono riproposte, ma vanno controllate. Nessuna associazione automatica per somiglianza del nome.</p>
        <div className="space-y-2">{lines.map(line => <label key={line.key} className="grid md:grid-cols-2 gap-2 items-center text-sm"><span>{line.department} · {line.line}</span><select className={field} disabled={busy || doc.status === 'published'} value={mapping[line.key] || ''} onChange={event => setMapping(current => ({ ...current, [line.key]: event.target.value }))}><option value="">Non associata</option>{doc.rows.map((row, index) => <option key={index} value={row.code}>{row.code} · {row.description}</option>)}</select></label>)}</div>
        {doc.status === 'draft' && <button type="button" className="bg-primary text-white rounded px-4 py-2 text-sm disabled:opacity-50" disabled={busy || Boolean(doc.errors?.length) || !Object.values(mapping).some(Boolean)} onClick={publish}>Pubblica versione e associazioni</button>}
        <p className="text-xs text-gray-500">La seconda qualità viene conservata come driver distinto. Non è un costo generico del cioccolato e non viene sommata allo scarto.</p>
      </>}
    </div>
  )
}
