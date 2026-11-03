import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Download, Search, Trash2, Upload, X } from 'lucide-react'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'

const BATCH = 10
const input = 'w-full border border-gray-300 rounded px-2 py-1.5 text-sm bg-white'
const EDIT_FIELDS = [
  ['numero', 'Numero'],
  ['titolo', 'Titolo'],
  ['tipo', 'Tipo'],
  ['posto', 'Posto'],
  ['reparto', 'Reparto'],
  ['linea', 'Linea'],
]

function formatDate(value) {
  if (!value) return '—'
  const [year, month, day] = String(value).slice(0, 10).split('-')
  return day ? `${day}/${month}/${year}` : value
}

function chunks(items, size) {
  const result = []
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size))
  return result
}

export default function KaizenArchivioPage() {
  const { user } = useAuth()
  const isAdmin = ['admin', 'administrator', 'amministratore'].includes(String(user?.role || '').toLowerCase())
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [anno, setAnno] = useState('')
  const [tipo, setTipo] = useState('')
  const [importOpen, setImportOpen] = useState(false)
  const [preview, setPreview] = useState(null)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.get('/kaizen-archivio/', { params: { search: query || undefined, anno: anno || undefined, tipo: tipo || undefined } })
      setItems(response.data || [])
    } catch (err) {
      setError(err.response?.data?.detail || 'Impossibile caricare l\u2019archivio')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [query, anno, tipo])

  const anni = useMemo(() => [...new Set(items.map(item => item.anno).filter(Boolean))].sort((a, b) => b - a), [items])
  const tipi = useMemo(() => [...new Set(items.map(item => item.tipo).filter(Boolean))].sort(), [items])

  const remove = async item => {
    if (!confirm(`Eliminare ${item.numero} dall\u2019archivio? Il PDF verrà cancellato.`)) return
    try {
      await api.delete(`/kaizen-archivio/${item._id}`)
      load()
    } catch (err) {
      alert('Errore: ' + (err.response?.data?.detail || err.message))
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <Link to="/kaizen" className="mb-1 inline-flex items-center gap-1 text-sm text-gray-600 hover:text-primary"><ArrowLeft size={15} /> Kaizen Sheet</Link>
          <h1 className="text-2xl font-bold text-gray-800">Archivio storico Kaizen</h1>
          <p className="text-sm text-gray-500">Quick Kaizen del programma precedente, in sola consultazione.</p>
        </div>
        {isAdmin && (
          <button type="button" onClick={() => setImportOpen(true)} className="bg-primary text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:opacity-90">
            <Upload size={18} /> Carica PDF
          </button>
        )}
      </div>

      <form onSubmit={event => { event.preventDefault(); setQuery(search.trim()) }} className="bg-white p-3 rounded-lg shadow-sm mb-4 flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
          <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Cerca numero, titolo o testo del Kaizen e premi Invio" className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm" />
        </div>
        <select aria-label="Anno" value={anno} onChange={event => setAnno(event.target.value)} className="border rounded-lg px-3 py-2 text-sm">
          <option value="">Tutti gli anni</option>
          {anni.map(value => <option key={value} value={value}>{value}</option>)}
        </select>
        <select aria-label="Tipo" value={tipo} onChange={event => setTipo(event.target.value)} className="border rounded-lg px-3 py-2 text-sm">
          <option value="">Tutti i tipi</option>
          {tipi.map(value => <option key={value} value={value}>{value}</option>)}
        </select>
        {(query || anno || tipo) && (
          <button type="button" onClick={() => { setSearch(''); setQuery(''); setAnno(''); setTipo('') }} className="px-3 py-2 border rounded-lg text-sm hover:bg-gray-50">Reset</button>
        )}
        <span className="self-center text-sm text-gray-500 ml-auto">{items.length} kaizen</span>
      </form>

      {error && <p role="alert" className="text-sm text-red-700 mb-3">{error}</p>}

      <div className="bg-white rounded-xl shadow overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left text-gray-500">
              <th className="p-3">Numero</th>
              <th className="p-3">Titolo</th>
              <th className="p-3">Tipo</th>
              <th className="p-3">Posto</th>
              <th className="p-3">Reparto / Linea</th>
              <th className="p-3">Apertura</th>
              <th className="p-3">Chiusura</th>
              <th className="p-3">Creatore</th>
              <th className="p-3 w-24" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="9" className="p-8 text-center text-gray-400">Caricamento...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan="9" className="p-8 text-center text-gray-400">{query || anno || tipo ? 'Nessun risultato' : 'Archivio vuoto'}</td></tr>
            ) : items.map(item => (
              <tr key={item._id} className="border-t hover:bg-gray-50">
                <td className="p-3"><button type="button" onClick={() => setPreview(item)} className="font-mono font-bold text-primary hover:underline">{item.numero}</button></td>
                <td className="p-3 font-medium max-w-xs truncate" title={item.titolo}>{item.titolo}</td>
                <td className="p-3 text-xs">{item.tipo || '—'}</td>
                <td className="p-3 text-xs">{item.posto || '—'}</td>
                <td className="p-3 text-xs">{[item.reparto, item.linea].filter(Boolean).join(' / ') || '—'}</td>
                <td className="p-3 text-xs">{formatDate(item.data_apertura)}</td>
                <td className="p-3 text-xs">{formatDate(item.data_chiusura)}</td>
                <td className="p-3 text-xs">{item.creatore || '—'}</td>
                <td className="p-3">
                  {isAdmin && (
                    <button type="button" aria-label={`Elimina ${item.numero}`} onClick={() => remove(item)} className="p-1.5 text-red-600 hover:bg-red-50 rounded"><Trash2 size={15} /></button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {importOpen && <ImportModal onClose={() => setImportOpen(false)} onDone={load} />}
      {preview && <PdfModal item={preview} onClose={() => setPreview(null)} />}
    </div>
  )
}

function PdfModal({ item, onClose }) {
  const [url, setUrl] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let objectUrl = null
    let cancelled = false
    api.get(`/kaizen-archivio/${item._id}/file`, { responseType: 'blob' })
      .then(response => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(response.data)
        setUrl(objectUrl)
      })
      .catch(() => { if (!cancelled) setError('PDF non disponibile') })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [item._id])

  const problema = item.problema || {}
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3">
      <div role="dialog" aria-modal="true" aria-label={`${item.numero} ${item.titolo}`} className="flex h-[94vh] w-full max-w-7xl flex-col rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 rounded-t-xl bg-primary px-5 py-3 text-white">
          <div className="min-w-0">
            <div className="truncate font-semibold">{item.numero} · {item.titolo}</div>
            <div className="text-xs opacity-80">{[item.tipo, item.posto, formatDate(item.data_apertura)].filter(Boolean).join(' · ')}</div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {url && <a href={url} download={item.file_name || `${item.numero}.pdf`} className="flex items-center gap-1 rounded bg-white px-3 py-1.5 text-sm text-primary hover:bg-gray-100"><Download size={16} /> Scarica</a>}
            <button type="button" aria-label="Chiudi" onClick={onClose} className="rounded p-1.5 hover:bg-white/10"><X size={20} /></button>
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <aside className="space-y-3 overflow-y-auto border-b p-4 text-sm lg:w-80 lg:border-b-0 lg:border-r">
            {[['Che cosa', problema.che_cosa], ['Dove', problema.dove], ['Quando', problema.quando], ['Chi', problema.chi], ['Quale', problema.quale], ['Come', problema.come], ['Causa radice', item.causa_radice]]
              .filter(([, value]) => value)
              .map(([label, value]) => (
                <div key={label}>
                  <div className="text-xs font-semibold uppercase text-gray-500">{label}</div>
                  <div className="text-gray-800">{value}</div>
                </div>
              ))}
            {item.partecipanti?.length > 0 && (
              <div>
                <div className="text-xs font-semibold uppercase text-gray-500">Partecipanti</div>
                <div className="text-gray-800">{item.partecipanti.join(', ')}</div>
              </div>
            )}
          </aside>
          <div className="min-h-0 flex-1 bg-gray-100">
            {error ? <p className="p-8 text-center text-red-700">{error}</p> : url ? <iframe src={url} title={item.numero} className="h-full w-full border-0" /> : <p className="p-8 text-center text-gray-500">Caricamento...</p>}
          </div>
        </div>
      </div>
    </div>
  )
}

function ImportModal({ onClose, onDone }) {
  const [files, setFiles] = useState([])
  const [rows, setRows] = useState([])
  const [busy, setBusy] = useState('')
  const [result, setResult] = useState(null)
  const fileRef = useRef(null)

  const pick = async selected => {
    const pdfs = [...selected].filter(file => file.name.toLowerCase().endsWith('.pdf'))
    if (!pdfs.length) return
    setFiles(pdfs)
    setRows([])
    setResult(null)
    const analyzed = []
    const groups = chunks(pdfs, BATCH)
    try {
      for (let index = 0; index < groups.length; index += 1) {
        setBusy(`Lettura PDF ${Math.min((index + 1) * BATCH, pdfs.length)} di ${pdfs.length}...`)
        const formData = new FormData()
        groups[index].forEach(file => formData.append('files', file))
        const response = await api.post('/kaizen-archivio/analyze', formData, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 180000 })
        analyzed.push(...(response.data?.items || []))
      }
      setRows(analyzed.map(item => ({ ...item, include: !item.error && !item.duplicate && Boolean(item.numero) })))
    } catch (err) {
      alert('Errore lettura PDF: ' + (err.response?.data?.detail || err.message))
    } finally {
      setBusy('')
    }
  }

  const patch = (filename, changes) => setRows(current => current.map(row => (row.filename === filename ? { ...row, ...changes } : row)))
  const selected = rows.filter(row => row.include)

  const save = async () => {
    const byName = new Map(files.map(file => [file.name, file]))
    const created = []
    const skipped = []
    const groups = chunks(selected, BATCH)
    try {
      for (let index = 0; index < groups.length; index += 1) {
        setBusy(`Importazione ${Math.min((index + 1) * BATCH, selected.length)} di ${selected.length}...`)
        const formData = new FormData()
        groups[index].forEach(row => formData.append('files', byName.get(row.filename)))
        formData.append('items', JSON.stringify(groups[index].map(row => ({ filename: row.filename, ...Object.fromEntries(EDIT_FIELDS.map(([key]) => [key, row[key] || ''])) }))))
        const response = await api.post('/kaizen-archivio/import', formData, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 300000 })
        created.push(...(response.data?.created || []))
        skipped.push(...(response.data?.skipped || []))
      }
      setResult({ created, skipped })
      onDone()
    } catch (err) {
      setResult({ created, skipped, error: err.response?.data?.detail || err.message })
      onDone()
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div role="dialog" aria-modal="true" aria-label="Carica PDF archivio" className="flex max-h-[92vh] w-full max-w-6xl flex-col rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between rounded-t-xl bg-primary px-5 py-3 text-white">
          <h2 className="font-semibold">Carica Kaizen storici (PDF)</h2>
          <button type="button" aria-label="Chiudi" onClick={onClose} disabled={Boolean(busy)} className="rounded p-1 hover:bg-white/10 disabled:opacity-50"><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div
            onClick={() => !busy && fileRef.current?.click()}
            onDragOver={event => event.preventDefault()}
            onDrop={event => { event.preventDefault(); if (!busy) pick(event.dataTransfer.files) }}
            className="cursor-pointer rounded-lg border-2 border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 hover:border-primary"
          >
            <input ref={fileRef} type="file" accept=".pdf,application/pdf" multiple className="hidden" onChange={event => { pick(event.target.files); event.target.value = '' }} />
            <Upload className="mx-auto mb-2" size={24} />
            Trascina qui i PDF oppure clicca. Numero, titolo, date, tipo e posto vengono letti dal PDF: controllali prima di importare.
          </div>
          {busy && <p role="status" className="text-sm font-medium text-primary">{busy}</p>}
          {result && (
            <div role="status" className={`rounded-lg border p-3 text-sm ${result.error ? 'border-red-200 bg-red-50 text-red-800' : 'border-green-200 bg-green-50 text-green-800'}`}>
              Importati {result.created.length}. {result.skipped.length > 0 && `Saltati ${result.skipped.length}: ${result.skipped.slice(0, 5).map(item => `${item.filename} (${item.motivo})`).join('; ')}${result.skipped.length > 5 ? '…' : ''}`}
              {result.error && ` Errore: ${result.error}`}
            </div>
          )}
          {rows.length > 0 && !result && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] text-xs">
                <thead>
                  <tr className="border-b text-left text-gray-600">
                    <th className="p-2 w-8">
                      <input type="checkbox" aria-label="Seleziona tutti" checked={rows.filter(row => !row.error).every(row => row.include)} onChange={event => setRows(current => current.map(row => ({ ...row, include: !row.error && event.target.checked })))} />
                    </th>
                    {EDIT_FIELDS.map(([, label]) => <th key={label} className="p-2">{label}</th>)}
                    <th className="p-2">Apertura</th>
                    <th className="p-2">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => (
                    <tr key={row.filename} className={`border-b align-top ${row.error ? 'bg-red-50' : row.duplicate ? 'bg-amber-50' : ''}`}>
                      <td className="p-2"><input type="checkbox" aria-label={`Importa ${row.filename}`} disabled={Boolean(row.error)} checked={row.include} onChange={event => patch(row.filename, { include: event.target.checked })} /></td>
                      {row.error ? (
                        <td colSpan={EDIT_FIELDS.length + 2} className="p-2 text-red-700">{row.filename}: {row.error}</td>
                      ) : (
                        <>
                          {EDIT_FIELDS.map(([key, label]) => (
                            <td key={key} className="p-1"><input aria-label={label} className={input} value={row[key] || ''} onChange={event => patch(row.filename, { [key]: event.target.value })} /></td>
                          ))}
                          <td className="p-2 whitespace-nowrap">{formatDate(row.data_apertura)}</td>
                          <td className="p-2 text-gray-500">
                            {row.duplicate ? 'Già in archivio' : !row.numero ? 'Numero mancante' : row.filename}
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between gap-3 border-t px-5 py-3">
          <span className="text-sm text-gray-500">{rows.length > 0 && !result ? `${selected.length} da importare su ${rows.length}` : ''}</span>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} disabled={Boolean(busy)} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-50">{result ? 'Chiudi' : 'Annulla'}</button>
            {!result && (
              <button type="button" onClick={save} disabled={Boolean(busy) || selected.length === 0 || selected.some(row => !String(row.numero || '').trim())} className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
                Importa {selected.length || ''}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
