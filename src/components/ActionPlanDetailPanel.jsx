import { useEffect, useRef, useState } from 'react'
import {
  X,
  Edit2,
  Trash2,
  CheckSquare,
  Square,
  Send,
  AlertCircle,
  Bug,
  TrendingUp,
  Shield,
  Wrench,
  Paperclip,
  Camera,
  FileText,
  Clipboard,
  Lock,
  RotateCcw,
} from 'lucide-react'
import api from '../services/api'
import { useAllConfigurations } from '../hooks/useConfigurations'
import { useAuth } from '../context/AuthContext'
import { usePillars } from '../hooks/usePillars'
import MentionTextarea from './MentionTextarea'

const PRIORITA_BG = {
  Lowest: 'bg-gray-100 text-gray-700',
  Low: 'bg-blue-100 text-blue-700',
  Medium: 'bg-yellow-100 text-yellow-700',
  High: 'bg-orange-100 text-orange-700',
  Critical: 'bg-red-100 text-red-700',
}

const TIPO_ICONS = {
  Task: CheckSquare,
  Bug,
  Improvement: TrendingUp,
  Audit: Shield,
  Manutenzione: Wrench,
  Sicurezza: AlertCircle,
}

const TIPO_COLORS = {
  Task: 'text-blue-600',
  Bug: 'text-red-600',
  Improvement: 'text-green-600',
  Audit: 'text-purple-600',
  Manutenzione: 'text-orange-600',
  Sicurezza: 'text-yellow-600',
}

async function compressImage(file, maxSize = 1280, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = event => {
      const image = new Image()

      image.onload = () => {
        let { width, height } = image

        if (width > maxSize || height > maxSize) {
          const scale = Math.min(maxSize / width, maxSize / height)
          width = Math.round(width * scale)
          height = Math.round(height * scale)
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height

        const context = canvas.getContext('2d')
        if (!context) {
          reject(new Error('Impossibile elaborare l’immagine'))
          return
        }

        context.drawImage(image, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }

      image.onerror = reject
      image.src = event.target.result
    }

    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = event => resolve(event.target.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function ActionPlanDetailPanel({
  plan,
  onClose,
  onUpdated,
  onEdit,
  onCancel,
  onRestore,
  onDelete,
}) {
  const [detail, setDetail] = useState(plan)
  const [nuovoCommento, setNuovoCommento] = useState('')
  const [menzioniCommento, setMenzioniCommento] = useState([])
  const [nuovoChecklistItem, setNuovoChecklistItem] = useState('')
  const [uploadingAllegato, setUploadingAllegato] = useState(false)
  const [lightboxImg, setLightboxImg] = useState(null)
  const [showCamera, setShowCamera] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)

  const videoRef = useRef(null)
  const streamRef = useRef(null)

  const { configs } = useAllConfigurations()
  const { user } = useAuth()
  const { pillars = [] } = usePillars() || {}
  const [closing, setClosing] = useState(false)
  const [showFeed, setShowFeed] = useState(false)
  const [pasteHint, setPasteHint] = useState('')
  const pasteRef = useRef(null)
  const fileInputRef = useRef(null)
  const statiConfig = configs.stato_ap || []
  const statoCorrente = statiConfig.find(stato => stato.label === detail.stato)
  const isLocked = Boolean(statoCorrente?.is_terminal)
  const statoRiapertura =
    statiConfig.find(stato => stato.label === 'Aperto' && !stato.is_terminal)?.label ||
    statiConfig.find(stato => !stato.is_terminal)?.label ||
    'Aperto'

  useEffect(() => {
    api
      .get(`/action-plans/${plan._id}`)
      .then(response => setDetail(response.data))
      .catch(error => console.error(error))
  }, [plan._id])

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
        streamRef.current = null
      }
    }
  }, [])

  async function reload() {
    const response = await api.get(`/action-plans/${plan._id}`)
    setDetail(response.data)
    onUpdated?.()
  }

  async function riapriAP() {
    if (!confirm(`Riaprire questo Action Plan?\nLo stato tornerà a "${statoRiapertura}".`)) return

    try {
      await api.patch(`/action-plans/${plan._id}/stato`, { stato: statoRiapertura })
      await reload()
    } catch (error) {
      console.error(error)
      alert('Errore durante la riapertura: ' + (error.response?.data?.detail || error.message))
    }
  }

  const statoChiusura =
    statiConfig.find(stato => stato.is_terminal && stato.label === 'Chiuso')?.label ||
    statiConfig.find(stato => stato.is_terminal && !/annull|cancel/i.test(stato.label))?.label ||
    'Chiuso'

  async function chiudiAP() {
    if (closing) return
    if (!confirm(`Finalizzare questo Action Plan?\nLo stato diventerà "${statoChiusura}" e non sarà più modificabile finché non lo riapri.`)) return
    setClosing(true)
    try {
      await api.patch(`/action-plans/${plan._id}/stato`, { stato: statoChiusura })
      await reload()
    } catch (error) {
      console.error(error)
      alert('Errore durante la finalizzazione: ' + (error.response?.data?.detail || error.message))
    } finally {
      setClosing(false)
    }
  }

  async function uploadImageFiles(files) {
    const available = 10 - (detail.allegati || []).length
    if (available <= 0) {
      alert('Massimo 10 allegati per Action Plan')
      return
    }
    setUploadingAllegato(true)
    try {
      let count = (detail.allegati || []).length
      for (const file of files.slice(0, available)) {
        if (await uploadActionPlanFile(file, count)) count += 1
      }
      await reload()
    } catch (error) {
      console.error(error)
      alert('Errore durante il caricamento: ' + (error.response?.data?.detail || error.message))
    } finally {
      setUploadingAllegato(false)
    }
  }

  function pastedImages(items) {
    const files = []
    Array.from(items || []).forEach((item, index) => {
      const file = item instanceof File ? item : item.kind === 'file' ? item.getAsFile() : null
      if (!file || !file.type.startsWith('image/')) return
      const extension = (file.type.split('/')[1] || 'png').replace('jpeg', 'jpg')
      files.push(file.name && file.name !== 'image.png' ? file : new File([file], `incolla_${Date.now()}_${index}.${extension}`, { type: file.type }))
    })
    return files
  }

  async function handlePaste(event) {
    if (isLocked || uploadingAllegato) return
    const files = pastedImages(event.clipboardData?.items)
    if (!files.length) return
    event.preventDefault()
    setPasteHint('')
    await uploadImageFiles(files)
  }

  async function pasteFromClipboard() {
    if (navigator.clipboard?.read && window.isSecureContext) {
      try {
        const items = await navigator.clipboard.read()
        const files = []
        for (const item of items) {
          const type = item.types.find(value => value.startsWith('image/'))
          if (type) {
            const blob = await item.getType(type)
            files.push(new File([blob], `incolla_${Date.now()}_${files.length}.${type.split('/')[1].replace('jpeg', 'jpg')}`, { type }))
          }
        }
        if (files.length) {
          setPasteHint('')
          await uploadImageFiles(files)
          return
        }
        setPasteHint('Nessuna immagine')
        return
      } catch {
        setPasteHint('')
      }
    }
    pasteRef.current?.focus()
    setPasteHint('Premi Ctrl+V')
  }

  async function addCommento() {
  if (!nuovoCommento.trim()) return

  try {
    await api.post(`/action-plans/${plan._id}/commenti`, {
      testo: nuovoCommento,
      autore_id: user?.id || null,
      autore: user?.full_name || user?.username || 'Utente',
      autore_email: user?.email || null,
      mentions: menzioniCommento,
    })

    setNuovoCommento('')
    setMenzioniCommento([])
    await reload()
  } catch (error) {
    console.error(error)
    alert(
      'Errore durante l’aggiunta del commento: ' +
      (error.response?.data?.detail || error.message)
    )
  }
}

  async function addChecklistItem() {
    if (!nuovoChecklistItem.trim()) return

    try {
      await api.post(`/action-plans/${plan._id}/checklist`, { testo: nuovoChecklistItem })
      setNuovoChecklistItem('')
      await reload()
    } catch (error) {
      console.error(error)
      alert('Errore durante l’aggiunta dell’item: ' + (error.response?.data?.detail || error.message))
    }
  }

  async function toggleChecklist(itemId, completato) {
    try {
      await api.patch(`/action-plans/${plan._id}/checklist/${itemId}`, { completato })
      await reload()
    } catch (error) {
      console.error(error)
      alert('Errore durante l’aggiornamento della checklist: ' + (error.response?.data?.detail || error.message))
    }
  }

  async function removeChecklist(itemId) {
    try {
      await api.delete(`/action-plans/${plan._id}/checklist/${itemId}`)
      await reload()
    } catch (error) {
      console.error(error)
      alert('Errore durante la rimozione dell’item: ' + (error.response?.data?.detail || error.message))
    }
  }

  async function changeStato(stato) {
    try {
      await api.patch(`/action-plans/${plan._id}/stato`, { stato })
      await reload()
    } catch (error) {
      console.error(error)
      alert('Errore durante il cambio stato: ' + (error.response?.data?.detail || error.message))
    }
  }

  async function uploadActionPlanFile(file, currentAttachmentCount) {
    if (currentAttachmentCount >= 10) {
      alert('Massimo 10 allegati per Action Plan')
      return false
    }

    const lowerName = file.name.toLowerCase()
    const isImage = file.type.startsWith('image/')
    const isPdf = file.type === 'application/pdf' || lowerName.endsWith('.pdf')
    const isWord = file.type.includes('word') || lowerName.endsWith('.doc') || lowerName.endsWith('.docx')
    const isExcel =
      file.type.includes('excel') ||
      file.type.includes('sheet') ||
      lowerName.endsWith('.xls') ||
      lowerName.endsWith('.xlsx')

    if (!isImage && !isPdf && !isWord && !isExcel) {
      alert(`Tipo file non supportato: ${file.name}\nSupportati: immagini, PDF, Word ed Excel`)
      return false
    }

    const maxBytes = isImage ? 10 * 1024 * 1024 : 2 * 1024 * 1024
    if (file.size > maxBytes) {
      alert(
        `File troppo grande: ${file.name}\nMassimo consentito: ${
          isImage ? '10 MB per le immagini' : '2 MB per i documenti'
        }`
      )
      return false
    }

    const base64Data = isImage ? await compressImage(file) : await fileToBase64(file)
    const base64Content =
      typeof base64Data === 'string' && base64Data.includes(',')
        ? base64Data.split(',')[1]
        : base64Data
    const dimensioneFinale = Math.round((base64Content.length * 3) / 4)

    await api.post(`/action-plans/${plan._id}/allegati`, {
      nome: file.name,
      tipo: file.type || 'application/octet-stream',
      dimensione: dimensioneFinale,
      data: base64Data,
      autore: 'Default User',
    })

    return true
  }

  async function handleFileUpload(event) {
    const files = Array.from(event.target.files || [])
    if (files.length === 0) return

    const availableSlots = 10 - (detail.allegati || []).length
    if (availableSlots <= 0) {
      alert('Massimo 10 allegati per Action Plan')
      event.target.value = ''
      return
    }

    const selectedFiles = files.slice(0, availableSlots)
    if (files.length > availableSlots) {
      alert(
        `Puoi aggiungere ancora ${availableSlots} allegati. Verranno caricati soltanto i primi ${availableSlots} file.`
      )
    }

    setUploadingAllegato(true)

    try {
      let currentAttachmentCount = (detail.allegati || []).length

      for (const file of selectedFiles) {
        const uploaded = await uploadActionPlanFile(file, currentAttachmentCount)
        if (uploaded) currentAttachmentCount += 1
      }

      await reload()
    } catch (error) {
      console.error(error)
      alert('Errore durante il caricamento: ' + (error.response?.data?.detail || error.message))
    } finally {
      setUploadingAllegato(false)
      event.target.value = ''
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }

    if (videoRef.current) videoRef.current.srcObject = null
    setCameraReady(false)
  }

  async function openCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      alert('La fotocamera non è supportata dal dispositivo o dal browser.')
      return
    }

    if ((detail.allegati || []).length >= 10) {
      alert('Massimo 10 allegati per Action Plan')
      return
    }

    try {
      stopCamera()
      let stream

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        })
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      }

      streamRef.current = stream
      setShowCamera(true)

      window.setTimeout(() => {
        if (videoRef.current && streamRef.current) {
          videoRef.current.srcObject = streamRef.current
          videoRef.current.play().catch(() => {})
        }
      }, 100)
    } catch (error) {
      console.error(error)
      stopCamera()
      setShowCamera(false)

      if (error.name === 'NotAllowedError') {
        alert('Accesso alla fotocamera non autorizzato. Abilita il permesso nelle impostazioni del browser.')
      } else if (error.name === 'NotFoundError') {
        alert('Nessuna fotocamera disponibile sul dispositivo.')
      } else {
        alert('Impossibile accedere alla fotocamera.')
      }
    }
  }

  function closeCamera() {
    stopCamera()
    setShowCamera(false)
  }

  function takePhoto() {
    const video = videoRef.current

    if (!video || !video.videoWidth || !video.videoHeight) {
      alert('La fotocamera non è ancora pronta.')
      return
    }

    const canvas = document.createElement('canvas')
    const maxDimension = 1280
    let width = video.videoWidth
    let height = video.videoHeight

    if (width > maxDimension || height > maxDimension) {
      const scale = Math.min(maxDimension / width, maxDimension / height)
      width = Math.round(width * scale)
      height = Math.round(height * scale)
    }

    canvas.width = width
    canvas.height = height

    const context = canvas.getContext('2d')
    if (!context) {
      alert('Impossibile elaborare la fotografia.')
      return
    }

    context.drawImage(video, 0, 0, width, height)

    canvas.toBlob(
      async blob => {
        if (!blob) {
          alert('Impossibile acquisire la fotografia.')
          return
        }

        const file = new File([blob], `action_plan_${Date.now()}.jpg`, {
          type: 'image/jpeg',
        })

        closeCamera()
        setUploadingAllegato(true)

        try {
          const uploaded = await uploadActionPlanFile(file, (detail.allegati || []).length)
          if (uploaded) await reload()
        } catch (error) {
          console.error(error)
          alert(
            'Errore durante il caricamento della fotografia: ' +
              (error.response?.data?.detail || error.message)
          )
        } finally {
          setUploadingAllegato(false)
        }
      },
      'image/jpeg',
      0.8
    )
  }

  async function removeAllegato(allegatoId, nome) {
    if (!confirm(`Eliminare l'allegato "${nome}"?`)) return

    try {
      await api.delete(`/action-plans/${plan._id}/allegati/${allegatoId}`)
      await reload()
    } catch (error) {
      console.error(error)
      alert('Errore durante l’eliminazione: ' + (error.response?.data?.detail || error.message))
    }
  }

  const TipoIcon = TIPO_ICONS[detail.tipo] || CheckSquare
  const checklistCompletati = detail.checklist?.filter(item => item.completato).length || 0
  const checklistTotali = detail.checklist?.length || 0
  const checklistPercent = checklistTotali
    ? Math.round((checklistCompletati / checklistTotali) * 100)
    : 0
  const allegati = detail.allegati || []
  const immagini = allegati.filter(allegato => allegato.tipo?.startsWith('image/'))
  const documenti = allegati.filter(allegato => !allegato.tipo?.startsWith('image/'))

  return (
    <Modal>
      <div className="max-h-[calc(90vh-60px)] overflow-y-auto">
        <div>
          <div className="bg-primary text-white px-4 py-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex items-baseline gap-2">
                <span className="font-mono text-xs opacity-80 flex-shrink-0">{detail.numero}</span>
                <h2 className="text-base font-bold truncate" title={detail.titolo}>{detail.titolo}</h2>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
              {!isLocked && !detail.is_cancelled && onCancel && (
                <button
                  type="button"
                  onClick={() => onCancel(detail)}
                  className="p-1.5 rounded text-white hover:bg-white hover:bg-opacity-10"
                  title="Annulla"
                >
                  <AlertCircle size={14} />
                </button>
              )}
              {!isLocked && detail.is_cancelled && onRestore && (
                <button
                  type="button"
                  onClick={() => onRestore(detail)}
                  className="p-1.5 rounded text-white hover:bg-white hover:bg-opacity-10"
                  title="Ripristina"
                >
                  ↺
                </button>
              )}
              {!isLocked && onDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(detail._id)}
                  className="p-1.5 rounded text-white hover:bg-white hover:bg-opacity-10"
                  title="Elimina"
                >
                  <Trash2 size={14} />
                </button>
              )}
              {!isLocked && onEdit && (
                <button
                  type="button"
                  onClick={() => onEdit(detail)}
                  className="p-1.5 rounded text-white hover:bg-white hover:bg-opacity-10"
                  title="Modifica"
                >
                  <Edit2 size={14} />
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded text-white hover:bg-white hover:bg-opacity-10"
                title="Chiudi"
                aria-label="Chiudi"
              >
                <X size={16} />
              </button>
              </div>
            </div>
          </div>

          {isLocked && (
            <div className="bg-gray-100 border-b px-4 py-1.5 text-xs text-gray-600">
              Azione finalizzata · sola lettura
            </div>
          )}

          <div className="border-b px-4 py-3 space-y-2">
          {detail.is_cancelled && (
              <div className="bg-red-100 border border-red-300 rounded p-2 text-xs">
                <div className="font-bold text-red-800 mb-1">Action Plan annullato</div>
                {detail.cancelled_reason && (
                  <div className="text-red-700 italic">“{detail.cancelled_reason}”</div>
                )}
                {detail.cancelled_at && (
                  <div className="text-red-600 mt-1">
                    {new Date(detail.cancelled_at).toLocaleDateString('it-IT')}
                    {detail.cancelled_by && ` da ${detail.cancelled_by}`}
                  </div>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-2">
          <SidebarRow label="Stato">
            {detail.stato || '—'}
          </SidebarRow>

          <SidebarRow label="Priorità">
            {detail.priorita || '—'}
          </SidebarRow>

          {detail.tipo && (
            <SidebarRow label="Tipo">
              <span className={`text-xs flex items-center gap-1 ${TIPO_COLORS[detail.tipo] || ''}`}>
                <TipoIcon size={12} />
                {detail.tipo}
              </span>
            </SidebarRow>
          )}

          <SidebarRow label="Responsabile">
            {detail.responsabile ? (
              <div className="flex items-center gap-1">
                <Avatar name={detail.responsabile} size={16} />
                <span className="text-xs">{detail.responsabile}</span>
              </div>
            ) : (
              <span className="text-xs text-gray-400">—</span>
            )}
          </SidebarRow>


          <SidebarRow label="Scadenza">
            <span className={`text-xs ${detail.stato_visuale === 'In Ritardo' ? 'text-red-600 font-bold' : ''}`}>
              {detail.data_scadenza
                ? new Date(detail.data_scadenza).toLocaleDateString('it-IT')
                : '—'}
            </span>
          </SidebarRow>

          <SidebarRow label="Categoria Perdita">
            <span className="text-xs">
              {detail.categoria_perdita || detail.tipo_perdita || '—'}
            </span>
          </SidebarRow>

          {detail.parent_type && detail.parent_type !== 'standalone' && (
            <SidebarRow label="Collegato a">
              <div className="text-xs">
                <span>
                  {detail.parent_type === 'pillar' && 'Pillar'}
                  {detail.parent_type === 'kaizen' && 'Kaizen'}
                  {detail.parent_type === 'dashboard' && 'Dashboard'}
                  {detail.parent_label && ` · ${detail.parent_label}`}
                </span>
              </div>
            </SidebarRow>
          )}

          {detail.pillar_id && detail.parent_type !== 'pillar' && (
            <SidebarRow label="Pillar">
              <span className="text-xs text-gray-700">{pillars.find(item => item._id === detail.pillar_id)?.sigla || '—'}</span>
            </SidebarRow>
          )}

          {(detail.reparto || detail.linea || detail.macchina) && (
            <SidebarRow label="Location">
              <span title={[detail.reparto, detail.linea, detail.macchina].filter(Boolean).join(' · ')}>{[detail.reparto, detail.linea, detail.macchina].filter(Boolean).join(' · ')}</span>
            </SidebarRow>
          )}


            </div>
          </div>

          <div className="p-4 space-y-4">

            <Section title={`Checklist ${checklistTotali ? `(${checklistCompletati}/${checklistTotali})` : ''}`}>
              {checklistTotali > 0 && (
                <div className="mb-2">
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div
                      className="bg-green-500 h-1.5 rounded-full transition-all"
                      style={{ width: `${checklistPercent}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1">
                {(detail.checklist || []).map(item => (
                  <div key={item.id} className="flex items-center gap-2 group">
                    <button
                      type="button"
                      onClick={() => toggleChecklist(item.id, !item.completato)}
                      disabled={isLocked}
                      className={isLocked ? 'cursor-not-allowed' : ''}
                    >
                      {item.completato ? (
                        <CheckSquare size={16} className="text-green-600" />
                      ) : (
                        <Square size={16} className="text-gray-400" />
                      )}
                    </button>
                    <span className={`flex-1 text-sm ${item.completato ? 'line-through text-gray-400' : ''}`}>
                      {item.testo}
                    </span>
                    {!isLocked && (
                      <button
                        type="button"
                        onClick={() => removeChecklist(item.id)}
                        className="opacity-0 group-hover:opacity-100 text-red-500"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {!isLocked && (
                <div className="flex gap-2 mt-2">
                  <input
                    value={nuovoChecklistItem}
                    onChange={event => setNuovoChecklistItem(event.target.value)}
                    onKeyDown={event => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        addChecklistItem()
                      }
                    }}
                    placeholder="Aggiungi item..."
                    className="flex-1 min-w-0 border rounded px-2.5 py-1 text-sm"
                  />
                  <button
                    type="button"
                    onClick={addChecklistItem}
                    className="px-2.5 py-1 bg-gray-100 border border-gray-300 rounded text-xs hover:bg-gray-200"
                  >
                    + Item
                  </button>
                </div>
              )}
            </Section>

            <Section
              title={`Allegati ${allegati.length ? `(${allegati.length}/10)` : ''}`}
              actions={allegati.length < 10 && !isLocked && (
                <div className="flex flex-wrap gap-1.5">
                  <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadingAllegato} className={SMALL_BUTTON}>
                    <Paperclip size={13} /> {uploadingAllegato ? 'Caricamento...' : 'File'}
                  </button>
                  <button ref={pasteRef} type="button" onClick={pasteFromClipboard} onPaste={handlePaste} onBlur={() => setPasteHint('')} disabled={uploadingAllegato} title="Incolla uno screenshot con Ctrl+V" className={SMALL_BUTTON}>
                    <Clipboard size={13} /> {pasteHint || 'Incolla'}
                  </button>
                  <button type="button" onClick={openCamera} disabled={uploadingAllegato} className={SMALL_BUTTON}>
                    <Camera size={13} /> Foto
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                    onChange={handleFileUpload}
                    disabled={uploadingAllegato}
                    className="hidden"
                  />
                </div>
              )}
            >
              <div onPaste={handlePaste}>
              {immagini.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-3">
                  {immagini.map(image => (
                    <div key={image.id} className="relative group">
                      <img
                        src={image.data}
                        alt={image.nome}
                        className="w-full h-20 object-cover rounded border cursor-pointer hover:opacity-80"
                        onClick={() => setLightboxImg(image)}
                      />
                      {!isLocked && (
                        <button
                          type="button"
                          onClick={() => removeAllegato(image.id, image.nome)}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                          title="Elimina immagine"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {documenti.length > 0 && (
                <div className="space-y-1 mb-3">
                  {documenti.map(documento => (
                    <div
                      key={documento.id}
                      className="flex items-center gap-2 p-2 bg-gray-50 rounded text-sm group"
                    >
                      <FileText size={16} className="text-gray-500 flex-shrink-0" />
                      <a
                        href={documento.data}
                        download={documento.nome}
                        className="flex-1 truncate text-blue-600 hover:underline"
                      >
                        {documento.nome}
                      </a>
                      <span className="text-xs text-gray-400">
                        {documento.dimensione ? `${(documento.dimensione / 1024).toFixed(0)} KB` : ''}
                      </span>
                      {!isLocked && (
                        <button
                          type="button"
                          onClick={() => removeAllegato(documento.id, documento.nome)}
                          className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 text-red-500"
                          title="Elimina documento"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {uploadingAllegato && (
                <div className="mt-3">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                    <div className="h-full w-1/2 rounded-full bg-primary animate-pulse" />
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Caricamento allegato in corso...</div>
                </div>
              )}
              </div>
            </Section>

            <Section title={`Commenti (${detail.commenti?.length || 0})`}>
              <div className="space-y-2 mb-2">
                {(detail.commenti || [])
                  .slice()
                  .reverse()
                  .map(commento => (
                    <div key={commento.id} className="flex gap-2">
                      <Avatar name={commento.autore} size={24} />
                      <div className="flex-1 min-w-0 bg-gray-50 px-2.5 py-1.5 rounded-lg">
                        <div className="flex justify-between items-center gap-3 mb-1">
                          <strong className="text-xs">{commento.autore}</strong>
                          <span className="text-xs text-gray-400">
                            {new Date(commento.timestamp).toLocaleString('it-IT')}
                          </span>
                        </div>
                        <div className="text-sm whitespace-pre-wrap">
                          {renderWithMentionsTags(commento.testo)}
                        </div>
                      </div>
                    </div>
                  ))}

              </div>

              {!isLocked && (
                <div className="flex gap-2">
  <MentionTextarea
    value={nuovoCommento}
    onChange={setNuovoCommento}
    mentions={menzioniCommento}
    onMentionsChange={setMenzioniCommento}
  />

  <button
    type="button"
    onClick={addCommento}
    disabled={!nuovoCommento.trim()}
    className="px-3 py-1.5 bg-primary text-white rounded-md hover:bg-primary-light self-end disabled:opacity-50 disabled:cursor-not-allowed"
  >
    <Send size={14} />
  </button>
</div>
              )}
            </Section>
            {(detail.feed || []).length > 0 && (
              <div className="pt-2 border-t">
                <button
                  type="button"
                  aria-expanded={showFeed}
                  onClick={() => setShowFeed(value => !value)}
                  className="w-full flex items-center justify-between text-xs text-gray-600 hover:text-gray-900"
                >
                  <span>Attività ({detail.feed.length})</span>
                  <span aria-hidden="true">{showFeed ? '−' : '+'}</span>
                </button>
                {showFeed && (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto mt-2">
                    {(detail.feed || [])
                      .slice()
                      .reverse()
                      .slice(0, 20)
                      .map((activity, index) => (
                        <div
                          key={`${activity.timestamp}_${index}`}
                          className="text-[11px] border-l-2 border-gray-300 pl-2"
                        >
                          <div className="text-gray-500">
                            {new Date(activity.timestamp).toLocaleString('it-IT')}
                          </div>
                          <div>
                            <strong>{activity.utente}</strong> · {activity.azione}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap justify-end gap-2 border-t bg-white px-4 py-3">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-1.5 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50"
        >
          Esci
        </button>
        {!detail.is_cancelled && (isLocked ? (
          <button
            type="button"
            onClick={riapriAP}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg border border-primary text-sm font-medium text-primary hover:bg-gray-50"
          >
            <RotateCcw size={14} /> Riapri
          </button>
        ) : (
          <button
            type="button"
            onClick={chiudiAP}
            disabled={closing}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary text-sm font-medium text-white hover:bg-primary-light disabled:opacity-50"
          >
            <Lock size={14} /> {closing ? 'Finalizzazione...' : 'Finalizza'}
          </button>
        ))}
      </div>

      {showCamera && (
        <div className="fixed inset-0 bg-black bg-opacity-95 z-[70] flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-4xl">
            <div className="flex items-center justify-between text-white mb-3">
              <div>
                <div className="font-bold">Fotografia Action Plan</div>
                <div className="text-xs text-gray-300">
                  Inquadra la condizione, il problema o il risultato dell’azione
                </div>
              </div>
              <button
                type="button"
                onClick={closeCamera}
                className="p-2 rounded-full bg-white bg-opacity-10 hover:bg-opacity-20"
                title="Chiudi fotocamera"
              >
                <X size={22} />
              </button>
            </div>

            <div className="relative overflow-hidden rounded-xl bg-black">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                onLoadedMetadata={() => setCameraReady(true)}
                className="w-full max-h-[70vh] object-contain"
              />
              {!cameraReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-black text-white text-sm">
                  Avvio fotocamera...
                </div>
              )}
            </div>

            <div className="flex justify-center gap-3 mt-4">
              <button
                type="button"
                onClick={takePhoto}
                disabled={!cameraReady || uploadingAllegato}
                className="bg-primary text-white px-6 py-3 rounded-full flex items-center gap-2 font-medium hover:bg-primary-light disabled:opacity-50"
              >
                <Camera size={20} />
                {uploadingAllegato ? 'Caricamento...' : 'Scatta e carica'}
              </button>
              <button
                type="button"
                onClick={closeCamera}
                className="bg-gray-700 text-white px-6 py-3 rounded-full hover:bg-gray-600"
              >
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}

      {lightboxImg && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-[60] p-4"
          onClick={() => setLightboxImg(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxImg(null)}
            className="absolute top-4 right-4 text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-full"
            title="Chiudi anteprima"
          >
            <X size={24} />
          </button>
          <img
            src={lightboxImg.data}
            alt={lightboxImg.nome}
            className="max-w-full max-h-full object-contain"
            onClick={event => event.stopPropagation()}
          />
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black bg-opacity-50 text-white px-4 py-2 rounded text-sm">
            {lightboxImg.nome}
          </div>
        </div>
      )}
    </Modal>
  )
}

const SMALL_BUTTON = 'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs border border-gray-300 rounded-md text-gray-600 bg-white hover:border-primary hover:text-primary focus:border-primary focus:text-primary focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed'

function Modal({ children }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
        {children}
      </div>
    </div>
  )
}

function Avatar({ name, size = 24 }) {
  if (!name) return null

  const initials = name
    .split(' ')
    .map(part => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
  const colors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-indigo-500',
    'bg-yellow-500',
    'bg-orange-500',
  ]
  const color = colors[name.charCodeAt(0) % colors.length]

  return (
    <div
      style={{ width: size, height: size, fontSize: size * 0.45 }}
      className={`${color} text-white rounded-full flex items-center justify-center font-bold flex-shrink-0`}
      title={name}
    >
      {initials}
    </div>
  )
}

function Section({ title, actions, children }) {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h3 className="text-xs font-bold uppercase tracking-wide text-gray-700">{title}</h3>
        {actions || null}
      </div>
      {children}
    </div>
  )
}

function SidebarRow({ label, children }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-medium text-gray-600 mb-0.5">{label}</div>
      <div className="h-8 px-2.5 flex items-center border border-gray-200 rounded-md bg-gray-50 text-xs text-gray-800 truncate">{children}</div>
    </div>
  )
}

function renderWithMentionsTags(text) {
  if (!text) return null

  const parts = text.split(/(@[a-zA-Z0-9._-]+|#[a-zA-Z0-9_-]+)/g)

  return parts.map((part, index) => {
    if (part.startsWith('@')) {
      return (
        <span key={index} className="text-blue-600 font-medium">
          {part}
        </span>
      )
    }

    if (part.startsWith('#')) {
      return (
        <span key={index} className="text-purple-600 font-medium">
          {part}
        </span>
      )
    }

    return part
  })
}
