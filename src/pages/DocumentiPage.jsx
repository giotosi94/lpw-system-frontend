import React, { useState, useEffect, useRef } from 'react'
import api from '../services/api'
import { FileText, Upload, Download, Search, Trash2, Edit2, X, Plus, Send, BarChart3, FileSpreadsheet, Pencil } from 'lucide-react'
import OplPublishModal from '../components/opl/OplPublishModal'
import OplNativaModal, { OplNativaPreview } from '../components/opl/OplNativaModal'
import OplReadReportModal from '../components/opl/OplReadReportModal'
import OplImportModal from '../components/opl/OplImportModal'

const CATEGORIE = ['Operativa', 'Sicurezza', 'Manutenzione', 'Qualità', 'Pulizia', 'Allergeni', 'Avvio/Spegnimento']
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

function readUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}')
  } catch {
    return {}
  }
}

export default function DocumentiPage() {
  const [documenti, setDocumenti] = useState([])
  const [search, setSearch] = useState('')
  const [filterCategoria, setFilterCategoria] = useState('')
  const [filterStato, setFilterStato] = useState('')
  const [editingDoc, setEditingDoc] = useState(null)
  const [previewDoc, setPreviewDoc] = useState(null)
  const [choiceOpen, setChoiceOpen] = useState(false)
  const [nativaOpen, setNativaOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [publishingDoc, setPublishingDoc] = useState(null)
  const [reportDoc, setReportDoc] = useState(null)
  const [nextOplNumber, setNextOplNumber] = useState('')

  const user = readUser()
  const isAdmin = ['admin', 'administrator', 'amministratore'].includes(String(user.role || user.ruolo || '').toLowerCase())

  useEffect(() => { load() }, [filterCategoria, filterStato])

  const load = async () => {
    try {
      const params = { tipo: 'OPL' }
      if (filterCategoria) params.categoria = filterCategoria
      if (filterStato) params.stato = filterStato
      if (search) params.search = search
      const res = await api.get('/documenti', { params })
      setDocumenti(res.data)
      if (isAdmin) {
        const next = await api.get('/documenti/next-number/OPL').catch(() => null)
        setNextOplNumber(next?.data?.numero || '')
      }
    } catch (err) {
      console.error(err)
    }
  }

  const openNewOpl = () => {
    if (isAdmin) setChoiceOpen(true)
    else setNativaOpen(true)
  }

  const deleteDoc = async (id) => {
    if (!confirm('Vuoi davvero eliminare questa OPL?')) return
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
          <h1 className="text-2xl font-bold text-gray-800">OPL</h1>
          {isAdmin && nextOplNumber && (
            <p className="text-sm text-gray-500 mt-1">Prossima codifica: <span className="font-semibold text-amber-700">{nextOplNumber}</span></p>
          )}
        </div>
        <button
          type="button"
          onClick={openNewOpl}
          className="bg-amber-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-amber-800 font-medium"
        >
          <Plus size={18} /> Nuova OPL
        </button>
      </div>

      <div className="bg-white rounded-xl shadow p-3 mb-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()}
            placeholder="Cerca per titolo o numero e premi Invio"
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm"
          />
        </div>
        <select value={filterCategoria} onChange={(e) => setFilterCategoria(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
          <option value="">Tutte le categorie</option>
          {CATEGORIE.map(c => <option key={c}>{c}</option>)}
        </select>
        <select value={filterStato} onChange={(e) => setFilterStato(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
          <option value="">Tutti gli stati</option>
          {STATI.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left text-gray-500">
              <th className="p-3">Numero</th>
              <th className="p-3">Titolo</th>
              <th className="p-3">Reparto</th>
              <th className="p-3">Linea</th>
              <th className="p-3">Versione</th>
              <th className="p-3">Stato</th>
              <th className="p-3 w-40">Azioni</th>
            </tr>
          </thead>
          <tbody>
            {documenti.length === 0 ? (
              <tr><td colSpan="7" className="text-center text-gray-400 py-8">Nessuna OPL</td></tr>
            ) : (
              documenti.map(doc => (
                <tr key={doc._id} className="border-t hover:bg-gray-50">
                  <td className="p-3">
                    <button
                      type="button"
                      onClick={() => setPreviewDoc(doc)}
                      className="font-mono text-primary font-bold hover:underline"
                    >
                      {doc.numero}
                    </button>
                  </td>
                  <td className="p-3 font-medium">{doc.titolo}</td>
                  <td className="p-3 text-xs">{doc.reparto || '-'}</td>
                  <td className="p-3 text-xs">{doc.linea || '-'}</td>
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
                      {doc.pubblicata ? (
                        <button type="button" onClick={() => setReportDoc(doc)} className="text-indigo-600 hover:bg-indigo-50 p-1 rounded" title="Report letture">
                          <BarChart3 size={16} />
                        </button>
                      ) : (
                        <button type="button" onClick={() => setPublishingDoc(doc)} className="text-purple-600 hover:bg-purple-50 p-1 rounded" title="Pubblica e assegna">
                          <Send size={16} />
                        </button>
                      )}
                      <button type="button" onClick={() => downloadBlob(`/documenti/${doc._id}/file`, doc.file_name)} className="text-green-600 hover:bg-green-50 p-1 rounded" title="Scarica">
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
        />
      )}
      {nativaOpen && <OplNativaModal onClose={() => setNativaOpen(false)} onSaved={load} />}
      {importOpen && <OplImportModal onClose={() => setImportOpen(false)} onImported={load} />}
      {editingDoc && <EditModal doc={editingDoc} onClose={() => setEditingDoc(null)} onSaved={load} />}
      {previewDoc && <PreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />}
      {publishingDoc && <OplPublishModal documento={publishingDoc} onClose={() => setPublishingDoc(null)} onPublished={load} />}
      {reportDoc && <OplReadReportModal documento={reportDoc} onClose={() => setReportDoc(null)} />}
    </div>
  )
}

function OplChoiceModal({ onClose, onCreate, onImport }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl" onClick={event => event.stopPropagation()}>
        <div className="px-5 py-4 border-b flex justify-between items-center">
          <h2 className="font-bold text-gray-800">Nuova OPL</h2>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-gray-100"><X size={18} /></button>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button type="button" onClick={onCreate} className="border rounded-lg p-5 text-left hover:border-amber-600 hover:bg-amber-50">
            <Pencil className="text-amber-700 mb-3" size={26} />
            <div className="font-semibold text-gray-800">Crea scheda</div>
            <div className="text-xs text-gray-500 mt-1">Compila la OPL nel sistema</div>
          </button>
          <button type="button" onClick={onImport} className="border rounded-lg p-5 text-left hover:border-amber-600 hover:bg-amber-50">
            <FileSpreadsheet className="text-green-700 mb-3" size={26} />
            <div className="font-semibold text-gray-800">Importa da Excel</div>
            <div className="text-xs text-gray-500 mt-1">Una o più OPL, salvate come immagine</div>
          </button>
        </div>
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
      <div className="h-full overflow-auto p-4 flex justify-center items-start">
        <img src={blobUrl} alt={doc.titolo} className="max-w-full block" />
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
            <div className="font-semibold truncate">{doc.numero} - {doc.titolo}</div>
            <div className="text-xs opacity-80">v{doc.versione || 1} • {doc.stato}</div>
          </div>
          <div className="flex gap-2 items-center flex-shrink-0">
            {doc.excel_file_id && (
              <button
                type="button"
                onClick={() => downloadBlob(`/documenti/${doc._id}/excel`, doc.file_name_originale || `${doc.numero}.xlsx`)}
                className="bg-white text-green-700 px-3 py-1.5 rounded text-sm flex items-center gap-1 hover:bg-gray-100"
              >
                <FileSpreadsheet size={16} /> Excel
              </button>
            )}
            <button
              type="button"
              onClick={() => downloadBlob(`/documenti/${doc._id}/file`, doc.file_name)}
              className="bg-white text-primary px-3 py-1.5 rounded text-sm flex items-center gap-1 hover:bg-gray-100"
            >
              <Download size={16} /> Scarica
            </button>
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

  const input = (label, field) => (
    <label className="block">
      <span className="block text-sm font-medium mb-1">{label}</span>
      <input value={form[field]} onChange={(e) => set(field, e.target.value)} className="w-full border rounded-lg px-3 py-2" />
    </label>
  )

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="bg-primary text-white p-4 rounded-t-xl flex justify-between items-center sticky top-0">
          <h2 className="text-lg font-bold">Modifica {doc.numero} (v{doc.versione || 1})</h2>
          <button type="button" onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {input('Titolo', 'titolo')}
            <label className="block">
              <span className="block text-sm font-medium mb-1">Stato</span>
              <select value={form.stato} onChange={(e) => set('stato', e.target.value)} className="w-full border rounded-lg px-3 py-2">
                {STATI.map(s => <option key={s}>{s}</option>)}
              </select>
            </label>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-sm font-medium mb-1">Categoria</span>
              <select value={form.categoria} onChange={(e) => set('categoria', e.target.value)} className="w-full border rounded-lg px-3 py-2">
                <option value="">-- Seleziona --</option>
                {CATEGORIE.map(c => <option key={c}>{c}</option>)}
              </select>
            </label>
            {input('Autore', 'autore')}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {input('Reparto', 'reparto')}
            {input('Linea', 'linea')}
            {input('Macchina', 'macchina')}
          </div>
          <label className="block">
            <span className="block text-sm font-medium mb-1">Descrizione</span>
            <textarea value={form.descrizione} onChange={(e) => set('descrizione', e.target.value)} rows={2} className="w-full border rounded-lg px-3 py-2" />
          </label>
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
