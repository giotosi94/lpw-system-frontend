import React, { useState, useEffect, useRef } from 'react'
import api from '../services/api'
import { FileText, Upload, Download, Search, Trash2, Edit2, X, Plus, Send, BarChart3, FileSpreadsheet, Pencil } from 'lucide-react'
import OplPublishModal from '../components/opl/OplPublishModal'
import OplNativaModal, { OplNativaPreview } from '../components/opl/OplNativaModal'
import OplReadReportModal from '../components/opl/OplReadReportModal'
import OplImportModal from '../components/opl/OplImportModal'

const API_BASE = (
  import.meta.env.VITE_API_URL ||
  'http://localhost:8000/api'
).replace(/\/api\/?$/, '')

const CATEGORIE = ['Operativa', 'Sicurezza', 'Manutenzione', 'Qualità', 'Pulizia', 'Allergeni', 'Avvio/Spegnimento']
const STATI = ['Bozza', 'In Revisione', 'Approvato', 'Obsoleto']

function getFileType(filename) {
  if (!filename) return 'unknown'
  const ext = filename.split('.').pop().toLowerCase()
  if (['pdf'].includes(ext)) return 'pdf'
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) return 'image'
  if (['xlsx', 'xls', 'docx', 'doc', 'pptx', 'ppt'].includes(ext)) return 'office'
  if (['txt', 'csv', 'log', 'json', 'xml'].includes(ext)) return 'text'
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

export default function DocumentiPage() {
  const [documenti, setDocumenti] = useState([])
  const [stats, setStats] = useState({})
  const [search, setSearch] = useState('')
  const [filterTipo, setFilterTipo] = useState('')
  const [filterCategoria, setFilterCategoria] = useState('')
  const [filterStato, setFilterStato] = useState('')
  const [uploadOpen, setUploadOpen] = useState(false)
  const [editingDoc, setEditingDoc] = useState(null)
  const [previewDoc, setPreviewDoc] = useState(null)
  const [oplChoiceOpen, setOplChoiceOpen] = useState(false)
  const [oplNativaOpen, setOplNativaOpen] = useState(false)
  const [publishingDoc, setPublishingDoc] = useState(null)
  const [reportDoc, setReportDoc] = useState(null)
  const [historicalOpen, setHistoricalOpen] = useState(false)
  const [nextOplNumber, setNextOplNumber] = useState('')

  const savedUser = (() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}')
    } catch {
      return {}
    }
  })()
  const userRole = String(savedUser.role || savedUser.ruolo || '').toLowerCase()
  const isAdmin = ['admin', 'administrator', 'amministratore'].includes(userRole)

  useEffect(() => { load() }, [filterTipo, filterCategoria, filterStato])

  const load = async () => {
    try {
      const params = {}
      if (filterTipo) params.tipo = filterTipo
      if (filterCategoria) params.categoria = filterCategoria
      if (filterStato) params.stato = filterStato
      if (search) params.search = search
      const res = await api.get('/documenti', { params })
      setDocumenti(res.data)
      const statsRes = await api.get('/documenti/stats/summary')
      setStats(statsRes.data)
      if (isAdmin) {
        try {
          const nextNumberRes = await api.get('/documenti/next-number/OPL')
          setNextOplNumber(nextNumberRes.data.numero || '')
        } catch (error) {
          console.error('Errore prossima codifica OPL:', error)
          setNextOplNumber('')
        }
      }
    } catch (err) { console.error(err) }
  }

  const handleSearch = () => load()

  const openNewOpl = () => {
    if (isAdmin) setOplChoiceOpen(true)
    else setOplNativaOpen(true)
  }

  const deleteDoc = async (id) => {
    if (!confirm('Vuoi davvero eliminare questo documento?')) return
    try {
      await api.delete(`/documenti/${id}`)
      load()
    } catch (err) { console.error(err) }
  }

  const getStatoBadge = (stato) => {
    const colors = {
      'Bozza': 'bg-gray-100 text-gray-700',
      'In Revisione': 'bg-yellow-100 text-yellow-700',
      'Approvato': 'bg-green-100 text-green-700',
      'Obsoleto': 'bg-red-100 text-red-700',
    }
    return colors[stato] || 'bg-gray-100 text-gray-700'
  }

  const getTipoIcon = (tipo) => {
    return tipo === 'OPL' ? '📋' : tipo === 'SOP' ? '📑' : '📄'
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Document Manager (OPL / SOP)</h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={openNewOpl}
            className="bg-amber-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-amber-800 font-medium"
          >
            <Plus size={18} /> Nuova OPL
          </button>
          <button
            type="button"
            onClick={() => setUploadOpen(true)}
            className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-50"
          >
            <Upload size={18} /> Carica documento
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {['OPL', 'SOP'].map(tipo => {
          const total = Object.values(stats[tipo] || {}).reduce((s, n) => s + n, 0)
          const approvati = (stats[tipo] || {})['Approvato'] || 0
          return (
            <div key={tipo} className="bg-white rounded-xl shadow p-5">
              <div className="text-3xl mb-2">{getTipoIcon(tipo)}</div>
              <p className="text-sm text-gray-500">
                {tipo === 'OPL' ? 'One Point Lessons' : 'Standard Operating Procedures'}
              </p>
              <p className="text-2xl font-bold">{total} documenti</p>
              <p className="text-xs text-green-600 mt-1">{approvati} approvati</p>
            </div>
          )
        })}
        {isAdmin && (
          <div className="bg-white rounded-xl shadow p-5 md:col-start-4 border-l-4 border-amber-600">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Prossima codifica OPL
            </div>
            <div className="text-3xl font-bold text-amber-700 mt-3">
              {nextOplNumber || '...'}
            </div>
            <div className="text-xs text-gray-500 mt-2">
              Assegnata automaticamente alla prossima OPL
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Cerca per titolo o numero..."
              className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm"
            />
          </div>
          <select value={filterTipo} onChange={(e) => setFilterTipo(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
            <option value="">Tutti i tipi</option>
            <option>OPL</option>
            <option>SOP</option>
            <option>Procedura</option>
            <option>Istruzione</option>
          </select>
          <select value={filterCategoria} onChange={(e) => setFilterCategoria(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
            <option value="">Tutte le categorie</option>
            {CATEGORIE.map(c => <option key={c}>{c}</option>)}
          </select>
          <select value={filterStato} onChange={(e) => setFilterStato(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
            <option value="">Tutti gli stati</option>
            {STATI.map(s => <option key={s}>{s}</option>)}
          </select>
          <button onClick={handleSearch} className="bg-primary text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-primary-light">
            <Search size={16} /> Cerca
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left text-gray-500">
              <th className="p-4">Numero</th>
              <th className="p-4">Titolo</th>
              <th className="p-4">Tipo</th>
              <th className="p-4">Categoria</th>
              <th className="p-4">Reparto</th>
              <th className="p-4">Linea</th>
              <th className="p-4">Versione</th>
              <th className="p-4">Stato</th>
              <th className="p-4">Azioni</th>
            </tr>
          </thead>
          <tbody>
            {documenti.length === 0 ? (
              <tr><td colSpan="9" className="text-center text-gray-400 py-8">Nessun documento. Caricane uno!</td></tr>
            ) : (
              documenti.map(doc => (
                <tr key={doc._id} className="border-t hover:bg-gray-50">
                  <td className="p-4">
                    <button
                      type="button"
                      onClick={() => setPreviewDoc(doc)}
                      className="font-mono text-primary font-bold hover:underline hover:text-primary-light"
                      title="Apri documento"
                    >
                      {doc.numero}
                    </button>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <span>{getTipoIcon(doc.tipo)}</span>
                      <div>
                        <div className="font-medium">{doc.titolo}</div>
                        {doc.descrizione && <div className="text-xs text-gray-500 truncate max-w-xs">{doc.descrizione}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="p-4">{doc.tipo}</td>
                  <td className="p-4">{doc.categoria || '-'}</td>
                  <td className="p-4 text-xs">{doc.reparto || '-'}</td>
                  <td className="p-4 text-xs">{doc.linea || '-'}</td>
                  <td className="p-4">
                    <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">v{doc.versione || 1}</span>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatoBadge(doc.stato)}`}>
                      {doc.stato}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex gap-2">
                      {doc.tipo === 'OPL' && !doc.pubblicata && (
                        <button
                          type="button"
                          onClick={() => setPublishingDoc(doc)}
                          className="text-purple-600 hover:bg-purple-50 p-1 rounded"
                          title="Pubblica e assegna"
                        >
                          <Send size={16} />
                        </button>
                      )}
                      {doc.tipo === 'OPL' && doc.pubblicata && (
                        <button
                          type="button"
                          onClick={() => setReportDoc(doc)}
                          className="text-indigo-600 hover:bg-indigo-50 p-1 rounded"
                          title="Report letture"
                        >
                          <BarChart3 size={16} />
                        </button>
                      )}
                      <button onClick={() => downloadBlob(`/documenti/${doc._id}/file`, doc.file_name)} className="text-green-600 hover:bg-green-50 p-1 rounded" title="Scarica">
                        <Download size={16} />
                      </button>
                      <button onClick={() => setEditingDoc(doc)} className="text-yellow-600 hover:bg-yellow-50 p-1 rounded" title="Modifica">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => deleteDoc(doc._id)} className="text-red-600 hover:bg-red-50 p-1 rounded" title="Elimina">
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

      {oplChoiceOpen && (
        <OplChoiceModal
          onClose={() => setOplChoiceOpen(false)}
          onCreate={() => { setOplChoiceOpen(false); setOplNativaOpen(true) }}
          onImport={() => { setOplChoiceOpen(false); setHistoricalOpen(true) }}
        />
      )}
      {uploadOpen && <UploadModal onClose={() => setUploadOpen(false)} onSaved={load} />}
      {editingDoc && <EditModal doc={editingDoc} onClose={() => setEditingDoc(null)} onSaved={load} />}
      {previewDoc && <PreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />}
      {oplNativaOpen && <OplNativaModal onClose={() => setOplNativaOpen(false)} onSaved={load} />}
      {publishingDoc && (
        <OplPublishModal
          documento={publishingDoc}
          onClose={() => setPublishingDoc(null)}
          onPublished={load}
        />
      )}
      {reportDoc && (
        <OplReadReportModal
          documento={reportDoc}
          onClose={() => setReportDoc(null)}
        />
      )}
      {historicalOpen && (
        <OplImportModal
          onClose={() => setHistoricalOpen(false)}
          onImported={load}
        />
      )}
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
          <button
            type="button"
            onClick={onCreate}
            className="border rounded-lg p-5 text-left hover:border-amber-600 hover:bg-amber-50"
          >
            <Pencil className="text-amber-700 mb-3" size={26} />
            <div className="font-semibold text-gray-800">Crea scheda</div>
            <div className="text-xs text-gray-500 mt-1">Compila la OPL direttamente nel sistema</div>
          </button>
          <button
            type="button"
            onClick={onImport}
            className="border rounded-lg p-5 text-left hover:border-amber-600 hover:bg-amber-50"
          >
            <FileSpreadsheet className="text-green-700 mb-3" size={26} />
            <div className="font-semibold text-gray-800">Importa da Excel</div>
            <div className="text-xs text-gray-500 mt-1">Una o più OPL Excel, salvate come immagine</div>
          </button>
        </div>
      </div>
    </div>
  )
}

function PreviewModal({ doc, onClose }) {
  const fileType = getFileType(doc.file_name)
  const [blobUrl, setBlobUrl] = useState(null)
  const [textContent, setTextContent] = useState('')
  const [officeViewerUrl, setOfficeViewerUrl] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const handleDownload = () => downloadBlob(`/documenti/${doc._id}/file`, doc.file_name)
  const handleExcelDownload = () => downloadBlob(`/documenti/${doc._id}/excel`, doc.file_name_originale || `${doc.numero}.xlsx`)

  useEffect(() => {
    let currentUrl = null
    let cancelled = false

    async function loadFile() {
      if (fileType === 'office') {
        try {
          const tokRes = await api.post(`/documenti/${doc._id}/preview-token`)
          if (cancelled) return
          const token = tokRes.data.token
          const ext = (doc.file_name || 'file.xlsx').split('.').pop().toLowerCase()
          const publicUrl = `${API_BASE}/api/documenti/${doc._id}/preview.${ext}?token=${encodeURIComponent(token)}`
          const viewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(publicUrl)}`
          setOfficeViewerUrl(viewerUrl)
          setLoading(false)
        } catch (err) {
          if (!cancelled) {
            setError(err.response?.data?.detail || err.message || 'Errore preview Office')
            setLoading(false)
          }
        }
        return
      }

      const isOplNativaWithImage = doc.formato === 'nativa' && doc.file_id
      if (fileType !== 'pdf' && fileType !== 'image' && fileType !== 'text' && !isOplNativaWithImage) {
        setLoading(false)
        return
      }

      try {
        const res = await api.get(`/documenti/${doc._id}/file`, { responseType: 'blob' })
        if (cancelled) return
        if (fileType === 'text') {
          const text = await res.data.text()
          if (!cancelled) {
            setTextContent(text)
            setLoading(false)
          }
        } else {
          currentUrl = URL.createObjectURL(res.data)
          if (!cancelled) {
            setBlobUrl(currentUrl)
            setLoading(false)
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.detail || err.message || 'Errore caricamento')
          setLoading(false)
        }
      }
    }

    loadFile()
    return () => {
      cancelled = true
      if (currentUrl) URL.revokeObjectURL(currentUrl)
    }
  }, [doc._id, fileType])

  const previewContent = (() => {
    if (doc.formato === 'nativa' && doc.opl_data) {
      return <OplNativaPreview doc={doc} imageBlobUrl={blobUrl} />
    }
    if (loading) {
      return (
        <div className="w-full h-full flex items-center justify-center text-gray-500">
          Caricamento anteprima...
        </div>
      )
    }
    if (error) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center text-gray-500 p-8">
          <div className="text-6xl mb-4">⚠️</div>
          <div className="text-lg mb-2 font-medium">Errore caricamento</div>
          <div className="text-sm text-gray-400 mb-6">{error}</div>
          <button
            onClick={handleDownload}
            className="bg-primary text-white px-5 py-2 rounded-lg hover:bg-primary-light flex items-center gap-2"
          >
            <Download size={18} /> Scarica
          </button>
        </div>
      )
    }
    if (fileType === 'pdf' && blobUrl) {
      return React.createElement('iframe', {
        src: blobUrl,
        className: 'w-full h-full border-0',
        title: doc.titolo,
      })
    }
    if (fileType === 'image' && blobUrl) {
      return (
        <div className="w-full h-full flex items-start justify-center p-4 overflow-auto">
          {React.createElement('img', {
            src: blobUrl,
            alt: doc.titolo,
            className: 'max-w-full object-contain block',
          })}
        </div>
      )
    }
    if (fileType === 'text') {
      return (
        <pre className="w-full h-full overflow-auto p-6 bg-gray-50 text-sm font-mono whitespace-pre-wrap">
          {textContent}
        </pre>
      )
    }
    if (fileType === 'office' && officeViewerUrl) {
      return (
        <div className="w-full h-full flex flex-col">
          {React.createElement('iframe', {
            src: officeViewerUrl,
            className: 'flex-1 w-full border-0',
            title: doc.titolo,
            frameBorder: '0',
          })}
          <div className="bg-yellow-50 border-t border-yellow-200 px-4 py-2 text-xs text-yellow-800 flex-shrink-0">
            Anteprima via Office Online Viewer. Se non si carica in pochi secondi, usa Scarica.
          </div>
        </div>
      )
    }
    const isOffice = fileType === 'office'
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-gray-500 p-8">
        <div className="text-7xl mb-4">{isOffice ? '📊' : '📄'}</div>
        <div className="text-lg mb-2 font-medium">
          {isOffice ? 'Anteprima file Office non disponibile' : 'Anteprima non disponibile'}
        </div>
        <div className="text-sm mb-2 text-gray-400">{doc.file_name}</div>
        {isOffice && (
          <div className="text-xs mb-6 text-gray-400 max-w-md text-center">
            I file Excel, Word e PowerPoint richiedono di essere scaricati per essere visualizzati.
          </div>
        )}
        <button
          onClick={handleDownload}
          className="bg-primary text-white px-5 py-2 rounded-lg hover:bg-primary-light flex items-center gap-2"
        >
          <Download size={18} /> Scarica per visualizzare
        </button>
      </div>
    )
  })()

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-6xl h-[92vh] flex flex-col shadow-2xl">
        <div className="bg-primary text-white px-6 py-3 rounded-t-xl flex justify-between items-center">
          <div className="min-w-0">
            <div className="font-semibold truncate">{doc.numero} - {doc.titolo}</div>
            <div className="text-xs opacity-80 truncate">
              {doc.file_name} • v{doc.versione || 1} • {doc.stato}
              {doc.file_size && ` • ${(doc.file_size / 1024).toFixed(1)} KB`}
            </div>
          </div>
          <div className="flex gap-2 items-center flex-shrink-0">
            {doc.excel_file_id && (
              <button
                onClick={handleExcelDownload}
                className="bg-white text-green-700 px-3 py-1.5 rounded text-sm flex items-center gap-1 hover:bg-gray-100"
              >
                <FileSpreadsheet size={16} /> Excel
              </button>
            )}
            <button
              onClick={handleDownload}
              className="bg-white text-primary px-3 py-1.5 rounded text-sm flex items-center gap-1 hover:bg-gray-100"
            >
              <Download size={16} /> Scarica
            </button>
            <button onClick={onClose} className="hover:bg-primary-light p-1.5 rounded">
              <X size={20} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden bg-gray-100 relative">
          {previewContent}
        </div>
        {(doc.descrizione || doc.autore) && (
          <div className="border-t bg-white px-6 py-2 text-xs text-gray-600 flex gap-4">
            {doc.autore && <span><strong>Autore:</strong> {doc.autore}</span>}
            {doc.categoria && <span><strong>Categoria:</strong> {doc.categoria}</span>}
            {doc.descrizione && <span className="truncate">{doc.descrizione}</span>}
          </div>
        )}
      </div>
    </div>
  )
}

function UploadModal({ onClose, onSaved }) {
  const [form, setForm] = useState({
    titolo: '',
    tipo: 'SOP',
    categoria: '',
    reparto: '',
    linea: '',
    macchina: '',
    autore: '',
    descrizione: '',
    tag: '',
  })
  const [reparti, setReparti] = useState([])
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [compress, setCompress] = useState(true)
  const fileRef = useRef(null)

  useEffect(() => {
    api
      .get('/reparti/')
      .then(response => setReparti((response.data || []).filter(reparto => reparto.attivo !== false)))
      .catch(error => console.error('Errore reparti:', error))
    try {
      const savedUser = localStorage.getItem('user')
      if (savedUser) {
        const user = JSON.parse(savedUser)
        setForm(current => ({
          ...current,
          autore: user.full_name || user.email || '',
          reparto: user.reparto || '',
        }))
      }
    } catch (error) {
      console.error('Errore utente salvato:', error)
    }
  }, [])

  const lineeAvailable = reparti.find(reparto => reparto.nome === form.reparto)?.linee || []
  const macchineAvailable = lineeAvailable.find(linea => linea.nome === form.linea)?.macchine || []

  const handleSubmit = async event => {
    event.preventDefault()
    if (!file) return alert('Seleziona un file')
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('compress', compress ? 'true' : 'false')
      Object.entries(form).forEach(([key, value]) => value && formData.append(key, value))
      const response = await api.post('/documenti/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      const compression = response.data.compressione
      let message = `Documento ${response.data.numero} creato!`
      if (compression?.compressed) {
        const originalMb = (compression.original_size / 1024 / 1024).toFixed(2)
        const finalMb = (compression.final_size / 1024 / 1024).toFixed(2)
        message += `\n\nCompressione: ${originalMb} MB → ${finalMb} MB (-${compression.saved_pct}%)`
      }
      alert(message)
      onSaved()
      onClose()
    } catch (error) {
      console.error(error)
      alert('Errore upload: ' + (error.response?.data?.detail || error.message))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="bg-primary text-white p-4 rounded-t-xl flex justify-between items-center sticky top-0 z-10">
          <h2 className="text-lg font-bold">Carica Documento</h2>
          <button type="button" onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">File <span className="text-red-500">*</span></label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-primary" onClick={() => fileRef.current?.click()}>
              <input ref={fileRef} type="file" onChange={event => setFile(event.target.files?.[0] || null)} className="hidden" />
              {file ? (
                <div>
                  <FileText className="mx-auto text-green-600 mb-2" size={32} />
                  <p className="text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
              ) : (
                <div className="text-gray-400">
                  <Upload className="mx-auto mb-2" size={32} />
                  <p className="text-sm">Click per selezionare il file</p>
                  <p className="text-xs">PDF, DOCX, XLSX, PPTX, immagini (max 50MB)</p>
                </div>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Titolo <span className="text-red-500">*</span></label>
              <input required value={form.titolo} onChange={event => setForm({ ...form, titolo: event.target.value })} className="w-full border rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Tipo <span className="text-red-500">*</span></label>
              <select value={form.tipo} onChange={event => setForm({ ...form, tipo: event.target.value })} className="w-full border rounded-lg px-3 py-2">
                <option>SOP</option><option>Procedura</option><option>Istruzione</option><option>OPL</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Categoria</label>
              <select value={form.categoria} onChange={event => setForm({ ...form, categoria: event.target.value })} className="w-full border rounded-lg px-3 py-2">
                <option value="">-- Seleziona --</option>
                {CATEGORIE.map(categoria => <option key={categoria}>{categoria}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Autore</label>
              <input value={form.autore} onChange={event => setForm({ ...form, autore: event.target.value })} className="w-full border rounded-lg px-3 py-2 bg-gray-50" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Reparto</label>
              <select value={form.reparto} onChange={event => setForm({ ...form, reparto: event.target.value, linea: '', macchina: '' })} className="w-full border rounded-lg px-3 py-2">
                <option value="">-- Seleziona --</option>
                {reparti.map(reparto => <option key={reparto._id || reparto.nome} value={reparto.nome}>{reparto.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Linea</label>
              <select value={form.linea} onChange={event => setForm({ ...form, linea: event.target.value, macchina: '' })} disabled={!form.reparto} className="w-full border rounded-lg px-3 py-2 disabled:bg-gray-100">
                <option value="">-- Seleziona --</option>
                {lineeAvailable.filter(linea => linea.attivo !== false).map(linea => <option key={linea.id || linea.nome} value={linea.nome}>{linea.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Macchina</label>
              <select value={form.macchina} onChange={event => setForm({ ...form, macchina: event.target.value })} disabled={!form.linea} className="w-full border rounded-lg px-3 py-2 disabled:bg-gray-100">
                <option value="">-- Seleziona --</option>
                {macchineAvailable.filter(macchina => macchina.attivo !== false).map(macchina => <option key={macchina.id || macchina.nome} value={macchina.nome}>{macchina.nome}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Descrizione</label>
            <textarea value={form.descrizione} onChange={event => setForm({ ...form, descrizione: event.target.value })} rows={2} className="w-full border rounded-lg px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Tag (separati da virgola)</label>
            <input value={form.tag} onChange={event => setForm({ ...form, tag: event.target.value })} className="w-full border rounded-lg px-3 py-2" />
          </div>
          <label className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200 cursor-pointer">
            <input type="checkbox" checked={compress} onChange={event => setCompress(event.target.checked)} className="w-4 h-4" />
            <span className="text-sm"><strong>Comprimi automaticamente</strong> — Riduce dimensioni di immagini, PDF e file Office</span>
          </label>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg">Annulla</button>
            <button type="submit" disabled={uploading || !file} className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-light disabled:opacity-50">
              {uploading ? 'Carico...' : 'Carica'}
            </button>
          </div>
        </form>
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
      alert('Documento aggiornato!')
      onSaved()
      onClose()
    } catch (err) {
      console.error(err)
      alert('Errore: ' + (err.response?.data?.detail || err.message))
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="bg-primary text-white p-4 rounded-t-xl flex justify-between items-center sticky top-0">
          <h2 className="text-lg font-bold">Modifica {doc.numero} (v{doc.versione})</h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Titolo</label>
              <input value={form.titolo} onChange={(e) => setForm({...form, titolo: e.target.value})} className="w-full border rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Stato</label>
              <select value={form.stato} onChange={(e) => setForm({...form, stato: e.target.value})} className="w-full border rounded-lg px-3 py-2">
                {STATI.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Categoria</label>
              <select value={form.categoria} onChange={(e) => setForm({...form, categoria: e.target.value})} className="w-full border rounded-lg px-3 py-2">
                <option value="">-- Seleziona --</option>
                {CATEGORIE.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Autore</label>
              <input value={form.autore} onChange={(e) => setForm({...form, autore: e.target.value})} className="w-full border rounded-lg px-3 py-2" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Reparto</label>
              <input value={form.reparto} onChange={(e) => setForm({...form, reparto: e.target.value})} className="w-full border rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Linea</label>
              <input value={form.linea} onChange={(e) => setForm({...form, linea: e.target.value})} className="w-full border rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Macchina</label>
              <input value={form.macchina} onChange={(e) => setForm({...form, macchina: e.target.value})} className="w-full border rounded-lg px-3 py-2" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Descrizione</label>
            <textarea value={form.descrizione} onChange={(e) => setForm({...form, descrizione: e.target.value})} rows={2} className="w-full border rounded-lg px-3 py-2" />
          </div>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-primary" onClick={() => fileRef.current?.click()}>
            <input ref={fileRef} type="file" onChange={(e) => setNewFile(e.target.files[0])} className="hidden" />
            {newFile ? (
              <div>
                <FileText className="mx-auto text-green-600 mb-1" size={20} />
                <p className="text-sm">Nuova versione: <strong>{newFile.name}</strong></p>
                <p className="text-xs text-gray-500">Verrà creata v{(doc.versione || 1) + 1}</p>
              </div>
            ) : (
              <div className="text-gray-400 text-sm">
                <Upload className="mx-auto mb-1" size={20} />
                Carica nuova versione del file (opzionale)
              </div>
            )}
          </div>
          {doc.versioni_precedenti && doc.versioni_precedenti.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-1">Versioni precedenti</label>
              <div className="space-y-1">
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
