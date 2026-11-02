import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import api from '../../../../services/api'
import ImageUpload from '../../../ImageUpload'
import UserPicker from '../../../UserPicker'
import KaizenAzioniList from '../../../kaizen/KaizenAzioniList'
import OplNativaModal from '../../../opl/OplNativaModal'
import OplImportModal from '../../../opl/OplImportModal'
import { OplChoiceModal, SopUploadModal, PreviewModal, readUser } from '../../../../pages/DocumentiPage'

const SAVE_DELAY = 800

const panel = 'bg-white border border-gray-200 rounded-lg p-4 md:p-5'
const heading = 'bg-primary text-white text-center py-2 rounded-lg font-bold mb-4'
const input = 'w-full min-w-0 border border-gray-300 rounded px-2 py-2 text-sm bg-white'
const addButton = 'inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90'
const smallButton = 'rounded border border-gray-300 px-3 py-1.5 text-xs hover:bg-gray-50'

const STATUS_LABELS = {
  saved: 'Salvato',
  dirty: 'Modifiche da salvare',
  saving: 'Salvataggio...',
  error: 'Errore di salvataggio: le modifiche restano nella pagina',
}

const list = value => (Array.isArray(value) ? value : [])

function createId(prefix) {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

function newArea() {
  return { id: createId('area'), perdita: '', zona: '', condizione: '', standard: '' }
}

function newAnomaly() {
  return { id: createId('anomaly'), zona: '', descrizione: '', foto_prima: [], foto_dopo: [], verifica: '', documento_id: '', documento_label: '' }
}

function newStandard() {
  return { id: createId('standard'), attivita: '', metodo: '', documento_id: '', documento_label: '', frequenza: '', responsabile: null }
}

function buildForm(data) {
  return {
    aree: list(data.aree).map(item => ({ ...newArea(), ...item, id: item.id || createId('area') })),
    anomalie: list(data.anomalie).map(item => ({
      ...newAnomaly(),
      ...item,
      id: item.id || createId('anomaly'),
      zona: item.zona ?? item.area_componente ?? '',
      verifica: item.verifica ?? item.note ?? '',
      foto_prima: list(item.foto_prima),
      foto_dopo: list(item.foto_dopo),
    })),
    standard_righe: list(data.standard_righe).map(item => ({ ...newStandard(), ...item, id: item.id || createId('standard') })),
  }
}

function toData(form) {
  return { aree: form.aree, anomalie: form.anomalie, standard_righe: form.standard_righe }
}

function outputs(form) {
  return {
    aree_critiche: form.aree.some(item => item.zona.trim()),
    anomalie_ripristini: form.anomalie.some(item => item.descrizione.trim()),
    standard_iniziale: form.standard_righe.some(item => item.attivita.trim()),
  }
}

function shortNumber(value) {
  return String(value || '').replace(/^(OPL|SOP)-/i, '')
}

function documentLabel(doc) {
  return `${doc.tipo} ${shortNumber(doc.numero)} - ${doc.titolo || ''}`
}

function documentNumber(doc) {
  const value = parseInt(shortNumber(doc.numero), 10)
  return Number.isNaN(value) ? 0 : value
}

const ADMIN_ROLES = ['admin', 'administrator', 'amministratore']

export default function BasicConditions({ stepData, onChange, major, allStepsData, step }) {
  const [form, setForm] = useState(() => buildForm(stepData?.dati || {}))
  const [status, setStatus] = useState('saved')
  const [documents, setDocuments] = useState([])
  const [creating, setCreating] = useState(null)
  const [previewDoc, setPreviewDoc] = useState(null)

  const formRef = useRef(form)
  const baseRef = useRef(stepData?.dati || {})
  const onChangeRef = useRef(onChange)
  const dirtyRef = useRef(false)
  const savingRef = useRef(false)
  const revisionRef = useRef(0)
  const timerRef = useRef(null)

  const lossListId = useId()
  const zoneListId = useId()

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  const persist = useCallback(async () => {
    clearTimeout(timerRef.current)
    if (savingRef.current) {
      timerRef.current = setTimeout(() => persist(), SAVE_DELAY / 2)
      return
    }
    const snapshot = formRef.current
    const revision = revisionRef.current
    savingRef.current = true
    setStatus('saving')
    try {
      await onChangeRef.current({
        dati: { ...baseRef.current, ...toData(snapshot) },
        output_compilati: outputs(snapshot),
      })
      if (revisionRef.current === revision) {
        dirtyRef.current = false
        setStatus('saved')
      } else {
        setStatus('dirty')
        timerRef.current = setTimeout(() => persist(), SAVE_DELAY)
      }
    } catch {
      setStatus('error')
    } finally {
      savingRef.current = false
    }
  }, [])

  const mutate = useCallback(update => {
    const next = typeof update === 'function' ? update(formRef.current) : { ...formRef.current, ...update }
    formRef.current = next
    setForm(next)
    revisionRef.current += 1
    dirtyRef.current = true
    setStatus('dirty')
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => persist(), SAVE_DELAY)
  }, [persist])

  useEffect(() => {
    baseRef.current = stepData?.dati || {}
    if (!dirtyRef.current && !savingRef.current) {
      const next = buildForm(stepData?.dati || {})
      formRef.current = next
      setForm(next)
    }
  }, [stepData?.dati])

  useEffect(() => {
    const guard = event => {
      if (dirtyRef.current) {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', guard)
    return () => {
      window.removeEventListener('beforeunload', guard)
      clearTimeout(timerRef.current)
      if (dirtyRef.current && !savingRef.current) {
        const snapshot = formRef.current
        Promise.resolve(onChangeRef.current({
          dati: { ...baseRef.current, ...toData(snapshot) },
          output_compilati: outputs(snapshot),
        })).catch(() => {})
      }
    }
  }, [])

  const loadDocuments = useCallback(async () => {
    try {
      const response = await api.get('/documenti')
      const loaded = (response.data || []).filter(doc => doc.tipo === 'OPL' || doc.tipo === 'SOP')
      setDocuments(loaded)
      return loaded
    } catch {
      return null
    }
  }, [])

  useEffect(() => {
    loadDocuments()
  }, [loadDocuments])

  const lossOptions = useMemo(() => {
    const values = new Set()
    Object.values(allStepsData || {}).forEach(item => {
      const data = item?.dati || {}
      ;[...list(data.priorita_stain), ...list(data.priorita_manuali)].forEach(value => value && values.add(value))
    })
    return [...values]
  }, [allStepsData])

  const zoneOptions = useMemo(
    () => [...new Set(form.aree.map(item => item.zona.trim()).filter(Boolean))],
    [form.aree],
  )

  const phases = useMemo(
    () => list(major?.route_snapshot?.steps)
      .map(item => ({ step_id: item.step_id, ordine: item.ordine, titolo: item.titolo }))
      .sort((a, b) => a.ordine - b.ordine),
    [major?.route_snapshot],
  )

  const planningParent = useMemo(() => ({
    parent_type: 'major_kaizen',
    parent_id: major?._id,
    parent_label: `${major?.numero || ''} - ${major?.titolo || ''}`,
    pillar_id: major?.pillar_id || null,
    reparto: major?.reparto || '',
    linea: major?.linea || '',
    macchina: major?.macchina || '',
  }), [major])

  const addArea = () => mutate(current => ({ ...current, aree: [...current.aree, newArea()] }))
  const patchArea = (id, patch) => mutate(current => ({
    ...current,
    aree: current.aree.map(item => (item.id === id ? { ...item, ...patch } : item)),
  }))
  const removeArea = id => mutate(current => ({ ...current, aree: current.aree.filter(item => item.id !== id) }))

  const addAnomaly = () => mutate(current => ({ ...current, anomalie: [...current.anomalie, newAnomaly()] }))
  const patchAnomaly = (id, patch) => mutate(current => ({
    ...current,
    anomalie: current.anomalie.map(item => (item.id === id ? { ...item, ...patch } : item)),
  }))
  const removeAnomaly = id => mutate(current => ({ ...current, anomalie: current.anomalie.filter(item => item.id !== id) }))

  const addStandard = () => mutate(current => ({ ...current, standard_righe: [...current.standard_righe, newStandard()] }))
  const patchStandard = (id, patch) => mutate(current => ({
    ...current,
    standard_righe: current.standard_righe.map(item => (item.id === id ? { ...item, ...patch } : item)),
  }))
  const removeStandard = id => mutate(current => ({ ...current, standard_righe: current.standard_righe.filter(item => item.id !== id) }))

  const standardDocIds = form.standard_righe.map(row => row.documento_id).filter(Boolean)

  const linkDocument = (target, id, doc) => {
    const patch = { documento_id: doc?._id || '', documento_label: doc ? documentLabel(doc) : '' }
    if (target === 'anomaly') patchAnomaly(id, patch)
    else patchStandard(id, patch)
  }

  const startCreate = (target, id, titolo) => {
    const user = readUser()
    const isAdmin = ADMIN_ROLES.includes(String(user.role || user.ruolo || '').toLowerCase())
    setCreating({ target, id, titolo: titolo || '', mode: isAdmin ? 'choice' : 'nativa' })
  }

  const handleCreated = async createdId => {
    const current = creating
    setCreating(null)
    const loaded = await loadDocuments()
    if (!current || !createdId) return
    const doc = (loaded || []).find(item => item._id === createdId)
    if (doc) linkDocument(current.target, current.id, doc)
  }

  const openDocument = async id => {
    const found = documents.find(doc => doc._id === id)
    if (found) {
      setPreviewDoc(found)
      return
    }
    try {
      const response = await api.get(`/documenti/${id}`)
      setPreviewDoc(response.data)
    } catch {
      alert('Documento non disponibile')
    }
  }

  const labelFor = row => {
    if (row.documento_label) return row.documento_label
    const doc = documents.find(item => item._id === row.documento_id)
    return doc ? documentLabel(doc) : 'Documento collegato'
  }

  const createInitial = {
    titolo: creating?.titolo || '',
    reparto: major?.reparto || '',
    linea: major?.linea || '',
    macchina: major?.macchina || '',
  }

  return (
    <div className="space-y-6">
      <section className={panel}>
        <h3 className={heading}>PASSO 1 - AREE DA CONTROLLARE</h3>
        <p className="text-sm text-gray-600 mb-3">
          Indica dove verificare le condizioni di base per i difetti prioritari e quale standard ci si aspetta.
        </p>
        <datalist id={lossListId}>
          {lossOptions.map(value => <option key={value} value={value} />)}
        </datalist>
        <button type="button" onClick={addArea} className={addButton}><Plus size={16} /> Aggiungi area</button>
        <div className="overflow-x-auto mt-4">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="text-left text-gray-600 border-b">
                <th className="p-2 font-medium">Perdita di riferimento</th>
                <th className="p-2 font-medium">Componente / zona</th>
                <th className="p-2 font-medium">Condizione da verificare</th>
                <th className="p-2 font-medium">Standard atteso</th>
                <th className="p-2 w-10" />
              </tr>
            </thead>
            <tbody>
              {form.aree.length === 0 ? (
                <tr><td colSpan="5" className="p-6 text-center text-gray-400">Nessuna area inserita</td></tr>
              ) : form.aree.map(row => (
                <tr key={row.id} className="border-b align-top">
                  <td className="p-1"><input list={lossListId} aria-label="Perdita di riferimento" className={input} value={row.perdita} onChange={event => patchArea(row.id, { perdita: event.target.value })} /></td>
                  <td className="p-1"><input aria-label="Componente o zona" className={input} value={row.zona} onChange={event => patchArea(row.id, { zona: event.target.value })} /></td>
                  <td className="p-1"><input aria-label="Condizione da verificare" className={input} value={row.condizione} onChange={event => patchArea(row.id, { condizione: event.target.value })} /></td>
                  <td className="p-1"><input aria-label="Standard atteso" className={input} value={row.standard} onChange={event => patchArea(row.id, { standard: event.target.value })} /></td>
                  <td className="p-1 text-center"><button type="button" aria-label="Elimina area" onClick={() => removeArea(row.id)} className="p-2 text-red-600 hover:bg-red-50 rounded"><Trash2 size={15} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={panel}>
        <h3 className={heading}>PASSO 2 - ISPEZIONE E RIPRISTINO</h3>
        <p className="text-sm text-gray-600 mb-3">
          Registra le anomalie trovate con pulizia e ispezione. Gli interventi di ripristino si gestiscono nel piano azioni qui sotto.
        </p>
        <datalist id={zoneListId}>
          {zoneOptions.map(value => <option key={value} value={value} />)}
        </datalist>
        <button type="button" onClick={addAnomaly} className={addButton}><Plus size={16} /> Aggiungi anomalia</button>
        <div className="mt-4 space-y-4">
          {form.anomalie.length === 0 && <p className="p-6 text-center text-sm text-gray-400">Nessuna anomalia registrata</p>}
          {form.anomalie.map((item, index) => (
            <article key={item.id} className="border border-gray-300 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-bold text-gray-700">Anomalia {index + 1}</h4>
                <button type="button" aria-label="Elimina anomalia" onClick={() => removeAnomaly(item.id)} className="p-2 text-red-600 hover:bg-red-50 rounded"><Trash2 size={15} /></button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <label className="block text-sm">Componente / zona
                  <input list={zoneListId} className={`${input} mt-1`} value={item.zona} onChange={event => patchAnomaly(item.id, { zona: event.target.value })} />
                </label>
                <label className="block text-sm md:col-span-2">Anomalia rilevata
                  <textarea rows={2} className={`${input} mt-1`} value={item.descrizione} onChange={event => patchAnomaly(item.id, { descrizione: event.target.value })} />
                </label>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
                <ImageUpload images={item.foto_prima} onChange={value => patchAnomaly(item.id, { foto_prima: value })} label="Foto prima" maxImages={4} />
                <ImageUpload images={item.foto_dopo} onChange={value => patchAnomaly(item.id, { foto_dopo: value })} label="Foto dopo" maxImages={4} />
              </div>
              <label className="block text-sm mt-4">Verifica del ripristino: come hai controllato (foto, misura, prova funzionale)
                <textarea rows={2} className={`${input} mt-1`} value={item.verifica} onChange={event => patchAnomaly(item.id, { verifica: event.target.value })} />
              </label>
              <div className="mt-4">
                <span className="block text-sm mb-1">Standard di riferimento (OPL / SOP)</span>
                <DocumentPicker
                  value={item.documento_id}
                  label={labelFor(item)}
                  documents={documents}
                  priorityIds={standardDocIds}
                  major={major}
                  onSelect={doc => linkDocument('anomaly', item.id, doc)}
                  onCreate={() => startCreate('anomaly', item.id, item.descrizione)}
                  onOpen={() => openDocument(item.documento_id)}
                />
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className={heading}>PASSO 3 - PIANO AZIONI</h3>
        <KaizenAzioniList
          parent={planningParent}
          phases={phases}
          defaultStepId={step?.step_id || ''}
        />
      </section>

      <section className={panel}>
        <h3 className={heading}>PASSO 4 - STANDARD INIZIALE</h3>
        <p className="text-sm text-gray-600 mb-3">
          Dopo i ripristini, indica come mantenere le condizioni: collega un OPL o una SOP esistente, oppure creane uno nuovo.
        </p>
        <button type="button" onClick={addStandard} className={addButton}><Plus size={16} /> Aggiungi standard</button>
        <div className="mt-4">
          {form.standard_righe.length === 0 ? (
            <p className="p-6 text-center text-sm text-gray-400">Nessuno standard inserito</p>
          ) : (
            <>
              <div className="hidden lg:grid grid-cols-[1.3fr_1.1fr_2fr_0.7fr_1.2fr_2.5rem] gap-2 border-b pb-2 text-sm font-medium text-gray-600">
                <span>Attività / controllo</span>
                <span>Metodo</span>
                <span>Documento OPL / SOP</span>
                <span>Frequenza</span>
                <span>Responsabile</span>
                <span />
              </div>
              {form.standard_righe.map(row => (
                <div key={row.id} className="grid grid-cols-1 lg:grid-cols-[1.3fr_1.1fr_2fr_0.7fr_1.2fr_2.5rem] gap-2 items-start border-b py-2">
                  <input aria-label="Attività o controllo" placeholder="Attività / controllo" className={input} value={row.attivita} onChange={event => patchStandard(row.id, { attivita: event.target.value })} />
                  <input aria-label="Metodo" placeholder="Metodo" className={input} value={row.metodo} onChange={event => patchStandard(row.id, { metodo: event.target.value })} />
                  <DocumentPicker
                    value={row.documento_id}
                    label={labelFor(row)}
                    documents={documents}
                    major={major}
                    onSelect={doc => linkDocument('standard', row.id, doc)}
                    onCreate={() => startCreate('standard', row.id, row.attivita)}
                    onOpen={() => openDocument(row.documento_id)}
                  />
                  <input aria-label="Frequenza" placeholder="Frequenza" className={input} value={row.frequenza} onChange={event => patchStandard(row.id, { frequenza: event.target.value })} />
                  <UserPicker mode="single" value={row.responsabile} onChange={value => patchStandard(row.id, { responsabile: value })} placeholder="Responsabile" />
                  <button type="button" aria-label="Elimina standard" onClick={() => removeStandard(row.id)} className="p-2 text-red-600 hover:bg-red-50 rounded"><Trash2 size={15} /></button>
                </div>
              ))}
            </>
          )}
        </div>
      </section>

      <div role="status" aria-live="polite" className="flex items-center justify-end gap-3 border-t border-gray-200 pt-4 text-sm">
        <span className={status === 'error' ? 'text-red-700' : 'text-gray-600'}>{STATUS_LABELS[status]}</span>
        {status === 'error' && <button type="button" onClick={persist} className={smallButton}>Riprova</button>}
      </div>

      {creating?.mode === 'choice' && (
        <OplChoiceModal
          onClose={() => setCreating(null)}
          onCreate={() => setCreating(current => ({ ...current, mode: 'nativa' }))}
          onImport={() => setCreating(current => ({ ...current, mode: 'import' }))}
          onSop={() => setCreating(current => ({ ...current, mode: 'sop' }))}
        />
      )}
      {creating?.mode === 'nativa' && (
        <OplNativaModal initial={createInitial} onClose={() => setCreating(null)} onSaved={doc => handleCreated(doc?._id)} />
      )}
      {creating?.mode === 'import' && (
        <OplImportModal
          onClose={() => setCreating(null)}
          onImported={created => (created?.length ? handleCreated(created[0].id) : loadDocuments())}
        />
      )}
      {creating?.mode === 'sop' && (
        <SopUploadModal initial={createInitial} onClose={() => setCreating(null)} onSaved={doc => handleCreated(doc?.id)} />
      )}
      {previewDoc && <PreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />}
    </div>
  )
}

function DocumentPicker({ value, label, documents, priorityIds = [], major, onSelect, onCreate, onOpen }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const listId = useId()
  const priorityKey = priorityIds.join('|')

  const results = useMemo(() => {
    const priority = new Set(priorityKey ? priorityKey.split('|') : [])
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
    const score = doc => {
      const place = major?.linea && doc.linea === major.linea ? 0 : major?.reparto && doc.reparto === major.reparto ? 1 : 2
      return (priority.has(doc._id) ? 0 : 3) + place
    }
    return documents
      .filter(doc => {
        const text = `${doc.tipo} ${shortNumber(doc.numero)} ${doc.titolo || ''} ${doc.macchina || ''}`.toLowerCase()
        return terms.every(term => text.includes(term))
      })
      .sort((a, b) => score(a) - score(b) || documentNumber(b) - documentNumber(a))
      .slice(0, 8)
  }, [query, documents, priorityKey, major?.linea, major?.reparto])

  const choose = doc => {
    onSelect(doc)
    setQuery('')
    setOpen(false)
  }

  if (value) {
    return (
      <div className="flex items-center gap-1 min-w-0">
        <span className="min-w-0 flex-1 truncate rounded border border-gray-300 bg-gray-50 px-2 py-2 text-sm" title={label}>{label}</span>
        <button type="button" onClick={onOpen} className={smallButton}>Apri</button>
        <button type="button" aria-label="Scollega documento" onClick={() => onSelect(null)} className="rounded p-2 text-gray-500 hover:bg-gray-100"><X size={14} /></button>
      </div>
    )
  }

  const priority = new Set(priorityIds)
  return (
    <div className="relative">
      <div className="flex gap-1">
        <input
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-label="Cerca documento OPL o SOP"
          className={input}
          placeholder="Cerca numero o titolo"
          value={query}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onChange={event => { setQuery(event.target.value); setOpen(true) }}
          onKeyDown={event => {
            if (event.key === 'Enter' && results.length) { event.preventDefault(); choose(results[0]) }
            if (event.key === 'Escape') setOpen(false)
          }}
        />
        <button type="button" onClick={onCreate} className="shrink-0 rounded border border-primary px-2 text-xs font-semibold text-primary hover:bg-gray-50">+ Nuova</button>
      </div>
      {open && (
        <ul id={listId} role="listbox" className="absolute z-30 mt-1 max-h-72 w-full min-w-[280px] overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {results.length === 0 ? (
            <li className="px-3 py-2 text-sm text-gray-500">Nessun documento trovato</li>
          ) : results.map(doc => (
            <li key={doc._id} role="option" aria-selected="false">
              <button
                type="button"
                onMouseDown={event => event.preventDefault()}
                onClick={() => choose(doc)}
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
              >
                <span className="font-semibold">{doc.tipo} {shortNumber(doc.numero)}</span> - {doc.titolo}
                <span className="block text-xs text-gray-500">
                  {priority.has(doc._id) ? 'Standard di questa fase' : [doc.reparto, doc.linea].filter(Boolean).join(' / ') || 'Senza reparto'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
