import { useRef, useState } from 'react'
import { Download, FileSpreadsheet, FileText, Upload, X } from 'lucide-react'
import api from '../services/api'

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/api\/?$/, '')
const MAX_DOCUMENTS = 20
const MAX_FILE_SIZE = 20 * 1024 * 1024

function resolveUrl(url) {
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  return `${API_BASE}${url}`
}

function formatSize(size) {
  if (!size) return ''
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function DocumentIcon({ contentType }) {
  if (contentType?.includes('spreadsheet') || contentType?.includes('excel')) {
    return <FileSpreadsheet size={22} className="text-green-600" />
  }

  return <FileText size={22} className="text-blue-600" />
}

export default function DocumentUpload({
  documents = [],
  onChange,
  maxDocuments = MAX_DOCUMENTS,
}) {
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef(null)

  const uploadFiles = async files => {
    if (!files.length || uploading) return

    const availableSlots = Math.max(0, maxDocuments - documents.length)

    if (availableSlots === 0) {
      alert(`Puoi caricare al massimo ${maxDocuments} documenti.`)
      return
    }

    const selectedFiles = files.slice(0, availableSlots)

    for (const file of selectedFiles) {
      if (file.size > MAX_FILE_SIZE) {
        alert(`${file.name}: il documento supera il limite di 20 MB.`)
        return
      }
    }

    setUploading(true)

    try {
      const uploadedDocuments = []

      for (const file of selectedFiles) {
        const formData = new FormData()
        formData.append('file', file)

        const response = await api.post('/uploads/document', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        })

        uploadedDocuments.push({
          id: response.data.id,
          filename: response.data.filename || file.name,
          content_type: response.data.content_type || file.type,
          size: response.data.size || file.size,
          url: response.data.url,
          uploaded_at: new Date().toISOString(),
        })
      }

      onChange?.([...documents, ...uploadedDocuments])
    } catch (error) {
      console.error('Errore caricamento documenti:', error)
      alert(
        'Errore durante il caricamento: ' +
        (error.response?.data?.detail || error.message)
      )
    } finally {
      setUploading(false)
    }
  }

  const handleSelect = async event => {
    const files = Array.from(event.target.files || [])
    await uploadFiles(files)
    event.target.value = ''
  }

  const removeDocument = index => {
    onChange?.(documents.filter((_, documentIndex) => documentIndex !== index))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-bold text-gray-700">
            Documenti
          </h4>
          <p className="text-xs text-gray-500 mt-1">
            PDF, Word ed Excel, massimo 20 MB per file.
          </p>
        </div>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading || documents.length >= maxDocuments}
          className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-primary-light disabled:opacity-50"
        >
          <Upload size={16} />
          {uploading ? 'Caricamento...' : 'Carica documenti'}
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.doc,.docx,.xls,.xlsx"
        multiple
        onChange={handleSelect}
        className="hidden"
      />

      {documents.length === 0 ? (
        <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center text-sm text-gray-400">
          Nessun documento allegato.
        </div>
      ) : (
        <div className="divide-y rounded-lg border">
          {documents.map((document, index) => (
            <div
              key={document.id || `${document.url}_${index}`}
              className="flex items-center gap-3 p-3"
            >
              <DocumentIcon contentType={document.content_type} />

              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-800 truncate">
                  {document.filename || `Documento ${index + 1}`}
                </div>
                <div className="text-xs text-gray-500">
                  {formatSize(document.size)}
                </div>
              </div>

              <a
                href={resolveUrl(document.url)}
                target="_blank"
                rel="noreferrer"
                className="p-2 rounded-lg text-blue-600 hover:bg-blue-50"
                title="Apri o scarica"
              >
                <Download size={17} />
              </a>

              <button
                type="button"
                onClick={() => removeDocument(index)}
                className="p-2 rounded-lg text-red-500 hover:bg-red-50"
                title="Rimuovi documento"
              >
                <X size={17} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
