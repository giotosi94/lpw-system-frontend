import React, { useState, useEffect, useRef } from 'react'
import api from '../services/api'
import { useConfigurations } from '../hooks/useConfigurations'
import { FileText, Upload, Download, Search, Trash2, Edit2, X, Plus, Send, BarChart3, FileSpreadsheet, ZoomIn, ZoomOut } from 'lucide-react'
import OplPublishModal from '../components/opl/OplPublishModal'
import OplNativaModal, { OplNativaPreview } from '../components/opl/OplNativaModal'
import OplReadReportModal from '../components/opl/OplReadReportModal'
import OplImportModal from '../components/opl/OplImportModal'

const STATI = ['Bozza', 'In Revisione', 'Approvato', 'Obsoleto']
const STATO_BADGE = {
  'Bozza': 'bg-gray-100 text-gray-700',
  'In Revisione': 'bg-yellow-100 text-yellow-700',
  'Approvato': 'bg-green-100 text-green-700',
  'Obsoleto': 'bg-red-100 text-red-700',
}

function getFileType(filename) {
  if (!filename) return 'unknown'
  const ext = filename.split('.').pop().toLowerCase()
  if (ext === 'pdf') return 'pdf'
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) return 'image'
  return 'unknown'
}

async function downloadBlob(path, filename) {
  try {
    const res = await api.get(path, { responseType: 'blob' })
    const url = URL.createObjectURL(res.data)
    const a = document.createElement('a')
    a.href = url
    a.download = filename || 'documento'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch (err) {
    alert('Errore download: ' + (err.response?.data?.detail || err.message))
  }
}

const WIDTHS_KEY = 'lpw_documenti_colonne'
const COLUMNS = [
  { key: 'numero', label: '#' },
  { key: 'tipo', label: 'Tipo' },
  { key: 'titolo', label: 'Titolo' },
  { key: 'reparto', label: 'Reparto' },
  { key: 'linea', label: 'Linea' },
  { key: 'versione', label: 'Versione' },
  { key: 'stato', label: 'Stato' },
  { key: 'azioni', label: 'Azioni' },
]
const DEFAULT_WIDTHS = { numero: 90, tipo: 70, titolo: 420, reparto: 160, linea: 120, versione: 90, stato: 120, azioni: 150 }

function readWidths() {
  try {
    return { ...DEFAULT_WIDTHS, ...JSON.parse(localStorage.getItem(WIDTHS_KEY) || '{}') }
  } catch {
    return DEFAULT_WIDTHS
  }
}

function numeroValore(numero) {
  const value = parseInt(numeroBreve(numero), 10)
  return Number.isNaN(value) ? 0 : value
}

function numeroBreve(numero) {
  return String(numero || '').replace(/^(OPL|SOP)-/i, '')
}

function readUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}')
  } catch {
    return {}
  }
}

export default function DocumentiPage() {
  const [documenti, setDocumenti] = useState([])
  const [sortDesc, setSortDesc] = useState(true)
  const [widths, setWidths] = useState(readWidths)
  const [search, setSearch] = useState('')
  const [filterTipo, setFilterTipo] = useState('')
  const [filterCategoria, setFilterCategoria] = useState('')
  const [filterStato, setFilterStato] = useState('')
  const [editingDoc, setEditingDoc] = useState(null)
  const [previewDoc, setPreviewDoc] = useState(null)
  const [choiceOpen, setChoiceOpen] = useState(false)
  const [nativaOpen, setNativaOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [sopOpen, setSopOpen] = useState(false)
  const [publishingDoc, setPublishingDoc] = useState(null)
  const [reportDoc, setReportDoc] = useState(null)
  const [nextOplNumber, setNextOplNumber] = useState('')
  const { items: categorie } = useConfigurations('categorie_documento')

  const user = readUser()
  const isAdmin = ['admin', 'administrator', 'amministratore'].includes(String(user.role || user.ruolo || '').toLowerCase())

  useEffect(() => { load() }, [filterTipo, filterCategoria, filterStato])

  const load = async () => {
    try {
      const params = {}
      if (filterTipo) params.tipo = filterTipo
      if (filterCategoria) params.categoria = filterCategoria
      if (filterStato) params.stato = filterStato
      if (search) params.search = search
      const res = await api.get('/documenti', { params })
      setDocumenti((res.data || []).filter(doc => doc.tipo === 'OPL' || doc.tipo === 'SOP'))
      if (isAdmin) {
        const next = await api.get('/documenti/next-number/OPL').catch(() => null)
        setNextOplNumber(next?.data?.numero || '')
      }
    } catch (err) {
      console.error(err)
    }
  }

  const sorted = [...documenti].sort((a, b) => {
    const diff = numeroValore(a.numero) - numeroValore(b.numero)
    return sortDesc ? -diff : diff
  })

  const resizeColumn = (key, startX, startWidth) => {
    const move = event => {
      const width = Math.max(50, startWidth + event.clientX - startX)
      setWidths(current => ({ ...current, [key]: width }))
    }
    const stop = () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', stop)
      setWidths(current => {
        localStorage.setItem(WIDTHS_KEY, JSON.stringify(current))
        return current
      })
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', stop)
  }

  const openNew = () => {
    if (isAdmin) setChoiceOpen(true)
    else setNativaOpen(true)
  }

  const deleteDoc = async (id) => {
    if (!confirm('Vuoi davvero eliminare questo documento?')) return
    try {
      await api.delete(`/documenti/${id}`)
      load()
    } catch (err) {
      alert('Errore: ' + (err.response?.data?.detail || err.message))
    }
  }

  return (
    <div>
      <div className="flex justify-between items-start mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Documenti</h1>
          {isAdmin && nextOplNumber && (
            <p className="text-sm text-gray-500 mt-1">Prossima codifica: <span className="font-semibold text-amber-700">{numeroBreve(nextOplNumber)}</span></p>
          )}
        </div>
        <button
          type="button"
          onClick={openNew}
          className="bg-amber-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-amber-800 font-medium"
        >
          <Plus size={18} /> Nuovo
        </button>
      </div>

      <div className="bg-white rounded-xl shadow p-3 mb-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()}
            placeholder="Cerca"
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm"
          />
        </div>
        <select value={filterTipo} onChange={(e) => setFilterTipo(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
          <option value="">OPL e SOP</option>
          <option value="OPL">OPL</option>
          <option value="SOP">SOP</option>
        </select>
        <select value={filterCategoria} onChange={(e) => setFilterCategoria(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
          <option value="">Tutte le categorie</option>
          {categorie.map(c => <option key={c._id || c.label} value={c.label}>{c.label}</option>)}
        </select>
        <select value={filterStato} onChange={(e) => setFilterStato(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
          <option value="">Tutti gli stati</option>
          {STATI.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl shadow overflow-x-auto">
        <table className="w-full text-sm table-fixed">
          <colgroup>
            {COLUMNS.map(column => <col key={column.key} style={{ width: widths[column.key] }} />)}
          </colgroup>
          <thead className="bg-gray-50">
            <tr className="text-left text-gray-500">
              {COLUMNS.map(column => (
                <th key={column.key} className="p-3 relative select-none">
                  {column.key === 'numero' ? (
                    <button
                      type="button"
                      onClick={() => setSortDesc(value => !value)}
                      className="font-semibold hover:text-gray-800"
                      title="Ordina per numero"
                    >
                      # {sortDesc ? '↓' : '↑'}
                    </button>
                  ) : column.label}
                  {column.key !== 'azioni' && (
                    <span
                      onMouseDown={event => {
                        event.preventDefault()
                        resizeColumn(column.key, event.clientX, event.currentTarget.parentElement.offsetWidth)
                      }}
                      onDoubleClick={() => {
                        const next = { ...widths, [column.key]: DEFAULT_WIDTHS[column.key] }
                        setWidths(next)
                        localStorage.setItem(WIDTHS_KEY, JSON.stringify(next))
                      }}
                      className="absolute right-0 top-0 h-full w-2 cursor-col-resize hover:bg-amber-200"
                    />
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {documenti.length === 0 ? (
              <tr><td colSpan="8" className="text-center text-gray-400 py-8">Nessun documento</td></tr>
            ) : (
              sorted.map(doc => (
                <tr key={doc._id} className="border-t hover:bg-gray-50">
                  <td className="p-3">
                    <button
                      type="button"
                      onClick={() => setPreviewDoc(doc)}
                      className="font-mono text-primary font-bold hover:underline"
                    >
                      {numeroBreve(doc.numero)}
                    </button>
                  </td>
                  <td className="p-3 text-xs font-semibold text-gray-600">{doc.tipo}</td>
                  <td className="p-3 font-medium truncate" title={doc.titolo}>{doc.titolo}</td>
                  <td className="p-3 text-xs truncate">{doc.reparto || '-'}</td>
                  <td className="p-3 text-xs truncate">{doc.linea || '-'}</td>
                  <td className="p-3">
                    <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">v{doc.versione || 1}</span>
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATO_BADGE[doc.stato] || STATO_BADGE.Bozza}`}>
                      {doc.stato}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      {doc.tipo !== 'OPL' ? null : doc.pubblicata ? (
                        <button type="button" onClick={() => setReportDoc(doc)} className="text-indigo-600 hover:bg-indigo-50 p-1 rounded" title="Report letture">
                          <BarChart3 size={16} />
                        </button>
                      ) : (
                        <button type="button" onClick={() => setPublishingDoc(doc)} className="text-purple-600 hover:bg-purple-50 p-1 rounded" title="Pubblica e assegna">
                          <Send size={16} />
                        </button>
                      )}
                      <button type="button" onClick={() => doc.originale_file_id ? downloadBlob(`/documenti/${doc._id}/originale`, doc.file_name_originale || doc.numero) : downloadBlob(`/documenti/${doc._id}/file`, doc.file_name)} className="text-green-600 hover:bg-green-50 p-1 rounded" title="Scarica">
                        <Download size={16} />
                      </button>
                      <button type="button" onClick={() => setEditingDoc(doc)} className="text-yellow-600 hover:bg-yellow-50 p-1 rounded" title="Modifica">
                        <Edit2 size={16} />
                      </button>
                      <button type="button" onClick={() => deleteDoc(doc._id)} className="text-red-600 hover:bg-red-50 p-1 rounded" title="Elimina">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {choiceOpen && (
        <OplChoiceModal
          onClose={() => setChoiceOpen(false)}
          onCreate={() => { setChoiceOpen(false); setNativaOpen(true) }}
          onImport={() => { setChoiceOpen(false); setImportOpen(true) }}
          onSop={() => { setChoiceOpen(false); setSopOpen(true) }}
        />
      )}
      {nativaOpen && <OplNativaModal onClose={() => setNativaOpen(false)} onSaved={load} />}
      {importOpen && <OplImportModal onClose={() => setImportOpen(false)} onImported={load} />}
      {sopOpen && <SopUploadModal onClose={() => setSopOpen(false)} onSaved={load} />}
      {editingDoc && <EditModal doc={editingDoc} onClose={() => setEditingDoc(null)} onSaved={load} />}
      {previewDoc && <PreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />}
      {publishingDoc && <OplPublishModal documento={publishingDoc} onClose={() => setPublishingDoc(null)} onPublished={load} />}
      {reportDoc && <OplReadReportModal documento={reportDoc} onClose={() => setReportDoc(null)} />}
    </div>
  )
}

function OplChoiceModal({ onClose, onCreate, onImport, onSop }) {
  const options = [
    { title: 'Crea OPL', text: 'Compila la OPL nel sistema', onClick: onCreate },
    { title: 'Importa OPL da Excel', text: 'Una o più OPL, salvate come immagine', onClick: onImport },
    { title: 'Importa SOP', text: 'File PowerPoint o PDF', onClick: onSop },
  ]
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-2xl shadow-2xl" onClick={event => event.stopPropagation()}>
        <div className="px-5 py-4 border-b flex justify-between items-center">
          <h2 className="font-bold text-gray-800">Nuovo documento</h2>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-gray-100"><X size={18} /></button>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {options.map(option => (
            <button
              key={option.title}
              type="button"
              onClick={option.onClick}
              className="border rounded-lg p-5 text-left hover:border-amber-600 hover:bg-amber-50"
            >
              <div className="font-semibold text-gray-800">{option.title}</div>
              <div className="text-xs text-gray-500 mt-1">{option.text}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function SopUploadModal({ onClose, onSaved }) {
  const user = readUser()
  const [form, setForm] = useState({
    titolo: '',
    categoria: '',
    reparto: '',
    linea: '',
    macchina: '',
    autore: user.full_name || user.email || '',
    descrizione: '',
  })
  const [file, setFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef(null)
  const { items: categorie } = useConfigurations('categorie_documento')
  const set = (field, value) => setForm(current => ({ ...current, [field]: value }))

  const pickFile = selected => {
    if (!selected) return
    if (!/\.(pptx?|pdf)$/i.test(selected.name)) {
      alert('Formato non supportato. Carica un file PowerPoint o PDF')
      return
    }
    setFile(selected)
    if (!form.titolo) set('titolo', selected.name.replace(/\.(pptx?|pdf)$/i, ''))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!file) return alert('Seleziona il file della SOP')
    if (!form.titolo.trim()) return alert('Inserisci il titolo')
    setSaving(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('tipo', 'SOP')
      formData.append('compress', 'false')
      Object.entries(form).forEach(([key, value]) => value && formData.append(key, value))
      await api.post('/documenti/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      onSaved()
      onClose()
    } catch (err) {
      alert('Errore: ' + (err.response?.data?.detail || err.message))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="bg-primary text-white p-4 rounded-t-xl flex justify-between items-center sticky top-0">
          <h2 className="text-lg font-bold">Importa SOP</h2>
          <button type="button" onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div
            className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-primary"
            onClick={() => fileRef.current?.click()}
            onDragOver={event => event.preventDefault()}
            onDrop={event => { event.preventDefault(); pickFile(event.dataTransfer.files?.[0]) }}
          >
            <input ref={fileRef} type="file" accept=".pptx,.ppt,.pdf" onChange={(e) => pickFile(e.target.files?.[0])} className="hidden" />
            {file ? (
              <div>
                <FileText className="mx-auto text-red-600 mb-1" size={24} />
                <p className="text-sm font-medium">{file.name}</p>
                <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            ) : (
              <div className="text-gray-400 text-sm">
                <Upload className="mx-auto mb-1" size={24} />
                Trascina qui la SOP oppure clicca
                <div className="text-xs mt-1">PowerPoint o PDF</div>
              </div>
            )}
          </div>
          <DocumentFields form={form} setForm={setForm} categorie={categorie} />
          <div className="flex justify-end gap-2 pt-4 border-t">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg">Annulla</button>
            <button type="submit" disabled={saving || !file} className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-light disabled:opacity-50">
              {saving ? 'Carico...' : 'Carica SOP'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function PreviewModal({ doc, onClose }) {
  const fileType = getFileType(doc.file_name)
  const isNativa = doc.formato === 'nativa' && doc.opl_data
  const canShow = fileType === 'pdf' || fileType === 'image' || (isNativa && doc.file_id)
  const [blobUrl, setBlobUrl] = useState(null)
  const [loading, setLoading] = useState(canShow)
  const [error, setError] = useState(null)
  const [fit, setFit] = useState(true)
  const originalLabel = doc.excel_file_id ? 'Excel' : doc.originale_file_id ? 'PowerPoint' : null

  useEffect(() => {
    if (!canShow) return undefined
    let url = null
    let cancelled = false
    api.get(`/documenti/${doc._id}/file`, { responseType: 'blob' })
      .then(res => {
        if (cancelled) return
        url = URL.createObjectURL(res.data)
        setBlobUrl(url)
      })
      .catch(err => { if (!cancelled) setError(err.response?.data?.detail || err.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [doc._id, canShow])

  let content
  if (isNativa) {
    content = <OplNativaPreview doc={doc} imageBlobUrl={blobUrl} />
  } else if (loading) {
    content = <div className="h-full flex items-center justify-center text-gray-500">Caricamento...</div>
  } else if (error) {
    content = <div className="h-full flex items-center justify-center text-red-600 p-6">{error}</div>
  } else if (fileType === 'pdf' && blobUrl) {
    content = <iframe src={blobUrl} className="w-full h-full border-0" title={doc.titolo} />
  } else if (fileType === 'image' && blobUrl) {
    content = (
      <div className={`h-full p-2 flex justify-center ${fit ? 'items-center overflow-hidden' : 'items-start overflow-auto'}`}>
        <img
          src={blobUrl}
          alt={doc.titolo}
          onClick={() => setFit(value => !value)}
          className={fit ? 'max-w-full max-h-full object-contain cursor-zoom-in block' : 'w-full max-w-none cursor-zoom-out block'}
        />
      </div>
    )
  } else {
    content = <div className="h-full flex items-center justify-center text-gray-500">Anteprima non disponibile, usa Scarica</div>
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-6xl h-[92vh] flex flex-col shadow-2xl">
        <div className="bg-primary text-white px-6 py-3 rounded-t-xl flex justify-between items-center">
          <div className="min-w-0">
            <div className="font-semibold truncate">{doc.tipo} {numeroBreve(doc.numero)} - {doc.titolo}</div>
            <div className="text-xs opacity-80">v{doc.versione || 1} • {doc.stato}</div>
          </div>
          <div className="flex gap-2 items-center flex-shrink-0">
            {fileType === 'image' && blobUrl && (
              <button
                type="button"
                onClick={() => setFit(value => !value)}
                className="bg-white text-gray-700 px-3 py-1.5 rounded text-sm flex items-center gap-1 hover:bg-gray-100"
              >
                {fit ? <ZoomIn size={16} /> : <ZoomOut size={16} />}
                {fit ? 'Ingrandisci' : 'Adatta'}
              </button>
            )}
            {originalLabel && (
              <button
                type="button"
                onClick={() => downloadBlob(`/documenti/${doc._id}/originale`, doc.file_name_originale || doc.numero)}
                className="bg-white text-green-700 px-3 py-1.5 rounded text-sm flex items-center gap-1 hover:bg-gray-100"
              >
                <FileSpreadsheet size={16} /> {originalLabel}
              </button>
            )}
            {!doc.originale_file_id && (
              <button
                type="button"
                onClick={() => downloadBlob(`/documenti/${doc._id}/file`, doc.file_name)}
                className="bg-white text-primary px-3 py-1.5 rounded text-sm flex items-center gap-1 hover:bg-gray-100"
              >
                <Download size={16} /> Scarica
              </button>
            )}
            <button type="button" onClick={onClose} className="hover:bg-primary-light p-1.5 rounded">
              <X size={20} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden bg-gray-100">{content}</div>
      </div>
    </div>
  )
}

function EditModal({ doc, onClose, onSaved }) {
  const [form, setForm] = useState({
    titolo: doc.titolo || '',
    categoria: doc.categoria || '',
    reparto: doc.reparto || '',
    linea: doc.linea || '',
    macchina: doc.macchina || '',
    autore: doc.autore || '',
    descrizione: doc.descrizione || '',
    stato: doc.stato || 'Bozza',
  })
  const [newFile, setNewFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef(null)
  const { items: categorie } = useConfigurations('categorie_documento')
  const set = (field, value) => setForm(current => ({ ...current, [field]: value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.put(`/documenti/${doc._id}`, form)
      if (newFile) {
        const formData = new FormData()
        formData.append('file', newFile)
        await api.post(`/documenti/${doc._id}/upload-version`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      }
      onSaved()
      onClose()
    } catch (err) {
      alert('Errore: ' + (err.response?.data?.detail || err.message))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="bg-primary text-white p-4 rounded-t-xl flex justify-between items-center sticky top-0">
          <h2 className="text-lg font-bold">Modifica {doc.tipo} {numeroBreve(doc.numero)} (v{doc.versione || 1})</h2>
          <button type="button" onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <label className="block">
            <span className="block text-sm font-medium mb-1">Stato</span>
            <select value={form.stato} onChange={(e) => set('stato', e.target.value)} className="w-full border rounded-lg px-3 py-2">
              {STATI.map(s => <option key={s}>{s}</option>)}
            </select>
          </label>
          <DocumentFields form={form} setForm={setForm} categorie={categorie} />
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-primary" onClick={() => fileRef.current?.click()}>
            <input ref={fileRef} type="file" onChange={(e) => setNewFile(e.target.files?.[0] || null)} className="hidden" />
            {newFile ? (
              <div>
                <FileText className="mx-auto text-green-600 mb-1" size={20} />
                <p className="text-sm">Nuova versione: <strong>{newFile.name}</strong></p>
                <p className="text-xs text-gray-500">Verrà creata v{(doc.versione || 1) + 1}</p>
              </div>
            ) : (
              <div className="text-gray-400 text-sm">
                <Upload className="mx-auto mb-1" size={20} />
                Carica nuova versione (opzionale)
              </div>
            )}
          </div>
          {doc.versioni_precedenti?.length > 0 && (
            <div>
              <span className="block text-sm font-medium mb-1">Versioni precedenti</span>
              {doc.versioni_precedenti.map(v => (
                <button
                  type="button"
                  key={v.versione}
                  onClick={() => downloadBlob(`/documenti/${doc._id}/version/${v.versione}`, v.file_name)}
                  className="flex items-center gap-2 text-xs text-gray-600 hover:text-primary"
                >
                  <Download size={12} /> v{v.versione} — {v.file_name}
                </button>
              ))}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg">Annulla</button>
            <button type="submit" disabled={saving} className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-light disabled:opacity-50">
              {saving ? 'Salvo...' : 'Salva'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function DocumentFields({ form, setForm, categorie }) {
  const [reparti, setReparti] = useState([])
  const set = (field, value) => setForm(current => ({ ...current, [field]: value }))

  useEffect(() => {
    api.get('/reparti/')
      .then(res => setReparti((res.data || []).filter(r => r.attivo !== false)))
      .catch(err => console.error('Errore reparti:', err))
  }, [])

  const linee = (reparti.find(r => r.nome === form.reparto)?.linee || []).filter(l => l.attivo !== false)
  const macchine = (linee.find(l => l.nome === form.linea)?.macchine || []).filter(m => m.attivo !== false)
  const text = (label, field) => (
    <label className="block">
      <span className="block text-sm font-medium mb-1">{label}</span>
      <input value={form[field]} onChange={(e) => set(field, e.target.value)} className="w-full border rounded-lg px-3 py-2" />
    </label>
  )

  return (
    <>
      {text('Titolo', 'titolo')}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <SelectField
          label="Categoria"
          value={form.categoria}
          options={categorie.map(c => c.label)}
          onChange={value => set('categoria', value)}
        />
        {text('Autore', 'autore')}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <SelectField
          label="Reparto"
          value={form.reparto}
          options={reparti.map(r => r.nome)}
          onChange={value => setForm(current => ({ ...current, reparto: value, linea: '', macchina: '' }))}
        />
        <SelectField
          label="Linea"
          value={form.linea}
          options={linee.map(l => l.nome)}
          disabled={!form.reparto}
          onChange={value => setForm(current => ({ ...current, linea: value, macchina: '' }))}
        />
        <SelectField
          label="Macchina"
          value={form.macchina}
          options={macchine.map(m => m.nome)}
          disabled={!form.linea}
          onChange={value => set('macchina', value)}
        />
      </div>
      <label className="block">
        <span className="block text-sm font-medium mb-1">Descrizione</span>
        <textarea value={form.descrizione} onChange={(e) => set('descrizione', e.target.value)} rows={2} className="w-full border rounded-lg px-3 py-2" />
      </label>
    </>
  )
}

function withCurrent(options, current) {
  return current && !options.includes(current) ? [current, ...options] : options
}

function SelectField({ label, value, options, onChange, disabled = false }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium mb-1">{label}</span>
      <select
        value={value || ''}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border rounded-lg px-3 py-2 disabled:bg-gray-100"
      >
        <option value="">-- Seleziona --</option>
        {withCurrent(options, value).map(option => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  )
}
