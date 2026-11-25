import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import api from '../../../../services/api'
import ImageUpload from '../../../ImageUpload'
import ActionPlanFormShared from '../../../ActionPlanFormShared'
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
  return { id: createId('area'), perdita: '', macchina: '', componente: '', standard: '' }
}

function newAnomaly() {
  return { id: createId('anomaly'), macchina: '', componente: '', descrizione: '', foto_prima: [], foto_dopo: [], verifica: '', documenti: [], carl: null, manutenzione: false, action_plan: false, area_id: '', perdita: '' }
}

function newStandard() {
  return { id: createId('standard'), attivita: '', metodo: '', documento_id: '', documento_label: '', frequenza: '', responsabile: null }
}

function splitZone(item) {
  if (item.macchina !== undefined || item.componente !== undefined) {
    return { macchina: item.macchina || '', componente: item.componente || '' }
  }
  const [macchina = '', ...rest] = String(item.zona ?? item.area_componente ?? '').split(' · ')
  return { macchina: macchina.trim(), componente: rest.join(' · ').trim() }
}

function sameName(a, b) {
  const norm = value => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ').replace(/\b0+(\d)/g, '$1')
  return Boolean(norm(a)) && norm(a) === norm(b)
}

function collectMachines(linea) {
  const found = []
  const seen = new Set()
  const add = (macchina, area) => {
    if (!macchina || macchina.attivo === false || !macchina.nome || seen.has(macchina.nome)) return
    seen.add(macchina.nome)
    found.push({
      nome: macchina.nome,
      area: area || '',
      carl_code: String(macchina.carl_code || '').trim().toUpperCase(),
      componenti: list(macchina.componenti).filter(item => item.attivo !== false).map(item => item.nome),
    })
  }
  const walk = (node, area) => {
    if (!node || typeof node !== 'object') return
    list(node.macchine).forEach(macchina => add(macchina, area))
    ;['aree', 'areas', 'children', 'figli'].forEach(key => list(node[key]).forEach(child => {
      if (child?.attivo === false) return
      walk(child, child?.nome || area)
    }))
  }
  walk(linea, '')
  return found
}

function zoneLabel(item) {
  return [item.macchina, item.componente].filter(Boolean).join(' · ')
}

function buildForm(data) {
  return {
    aree: list(data.aree).map(item => ({ ...newArea(), ...item, ...splitZone(item), id: item.id || createId('area') })),
    anomalie: list(data.anomalie).map(item => ({
      ...newAnomaly(),
      ...item,
      id: item.id || createId('anomaly'),
      ...splitZone(item),
      verifica: item.verifica ?? item.note ?? '',
      foto_prima: list(item.foto_prima),
      foto_dopo: list(item.foto_dopo),
      carl: item.carl || null,
      manutenzione: Boolean(item.manutenzione || item.carl),
      action_plan: Boolean(item.action_plan || item.action_plan_id),
      documenti: list(item.documenti).length
        ? list(item.documenti)
        : item.documento_id ? [{ id: item.documento_id, label: item.documento_label || '' }] : [],
    })),
    standard_righe: list(data.standard_righe).map(item => ({ ...newStandard(), ...item, id: item.id || createId('standard') })),
  }
}

function toData(form) {
  const withZone = item => ({ ...item, zona: zoneLabel(item) })
  return { aree: form.aree.map(withZone), anomalie: form.anomalie.map(withZone), standard_righe: form.standard_righe }
}

function outputs(form) {
  return {
    aree_critiche: form.aree.some(item => item.macchina.trim()),
    anomalie_ripristini: form.anomalie.some(item => item.descrizione.trim()),
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

const CARL_BADGE = {
  REQUEST: 'bg-amber-100 text-amber-800',
  AWAITINGREAL: 'bg-blue-100 text-blue-800',
  FINISHED: 'bg-green-100 text-green-800',
  CLOSED: 'bg-gray-200 text-gray-700',
  DENIED: 'bg-red-100 text-red-700',
}

function formatDay(value) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('it-IT')
}

function carlSnapshot(item) {
  return { id: item.id, codice: item.codice, descrizione: item.descrizione, stato: item.stato, stato_label: item.stato_label, data: item.data }
}

export default function BasicConditions({ stepData, onChange, major, allStepsData, step }) {
  const [form, setForm] = useState(() => buildForm(stepData?.dati || {}))
  const [status, setStatus] = useState('saved')
  const [documents, setDocuments] = useState([])
  const [creating, setCreating] = useState(null)
  const [previewDoc, setPreviewDoc] = useState(null)
  const [machines, setMachines] = useState([])
  const [carlLine, setCarlLine] = useState('')
  const [carlOn, setCarlOn] = useState(true)
  const [carlStates, setCarlStates] = useState({})
  const [sending, setSending] = useState('')
  const [carlError, setCarlError] = useState('')
  const [carlDetail, setCarlDetail] = useState(null)
  const [carlDraft, setCarlDraft] = useState(null)
  const [apDraft, setApDraft] = useState(null)
  const [linkedPlans, setLinkedPlans] = useState([])
  const [plansVersion, setPlansVersion] = useState(0)
  const [openingAP, setOpeningAP] = useState('')
  const sendLock = useRef(false)

  const formRef = useRef(form)
  const baseRef = useRef(stepData?.dati || {})
  const onChangeRef = useRef(onChange)
  const dirtyRef = useRef(false)
  const savingRef = useRef(false)
  const revisionRef = useRef(0)
  const timerRef = useRef(null)


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
      const result = await onChangeRef.current({
        dati: { ...baseRef.current, ...toData(snapshot) },
        output_compilati: outputs(snapshot),
      })
      if (result === false) throw new Error('Salvataggio non riuscito')
      if (revisionRef.current === revision) {
        dirtyRef.current = false
        setStatus('saved')
      } else {
        setStatus('dirty')
        timerRef.current = setTimeout(() => persist(), SAVE_DELAY)
      }
      return true
    } catch {
      setStatus('error')
      return false
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

  useEffect(() => {
    let cancelled = false
    api.get('/reparti/')
      .then(response => {
        if (cancelled) return
        const reparti = list(response.data)
        const sameReparto = reparti.filter(item => sameName(item.nome, major?.reparto))
        const findLine = pool => pool.flatMap(item => list(item.linee)).find(item => sameName(item.nome, major?.linea))
        const linea = findLine(sameReparto) || findLine(reparti)
        setCarlLine(String(linea?.carl_code || '').trim())
        setMachines(collectMachines(linea)
          .sort((a, b) => (sameName(a.nome, major?.macchina) ? -1 : 0) - (sameName(b.nome, major?.macchina) ? -1 : 0)))
      })
      .catch(() => { if (!cancelled) setMachines([]) })
    return () => { cancelled = true }
  }, [major?.reparto, major?.linea, major?.macchina])

  const lossOptions = useMemo(() => {
    const baseline = Object.values(allStepsData || {}).map(item => item?.dati).find(data => data?.stain_snapshot || data?.categorie_scarto || data?.priorita_stain)
    if (!baseline) return []
    const stain = list(baseline.priorita_stain)
    const manual = list(baseline.priorita_manuali)
    return [...new Set((stain.length || !manual.length ? stain : manual).filter(Boolean))]
  }, [allStepsData])
  const lossKey = lossOptions.join('|')

  useEffect(() => {
    if (!lossOptions.length) return
    const current = formRef.current
    const keep = current.aree.filter(item => lossOptions.includes(item.perdita))
    const missing = lossOptions.filter(loss => !keep.some(item => item.perdita === loss)).map(loss => ({ ...newArea(), perdita: loss }))
    const next = [...keep, ...missing].sort((a, b) => lossOptions.indexOf(a.perdita) - lossOptions.indexOf(b.perdita))
    const same = next.length === current.aree.length && next.every((item, index) => item.id === current.aree[index].id)
    if (!same) mutate(value => ({ ...value, aree: next }))
  }, [lossKey, mutate])

  const machineGroups = machines.reduce((groups, item) => {
    const key = item.area || ''
    groups[key] = [...(groups[key] || []), item.nome]
    return groups
  }, {})
  const componentsOf = name => machines.find(item => item.nome === name)?.componenti || []
  const sameZone = (a, b) => a.macchina === b.macchina && a.componente.trim().toLowerCase() === b.componente.trim().toLowerCase()
  const missingZones = form.aree
    .filter(item => item.macchina)
    .filter((item, index, all) => all.findIndex(other => sameZone(other, item) && other.perdita === item.perdita) === index)
    .filter(item => !form.anomalie.some(anomaly => anomaly.area_id === item.id || (!anomaly.area_id && sameZone(anomaly, item) && anomaly.perdita === item.perdita)))


  const planningParent = useMemo(() => ({
    parent_type: 'major_kaizen',
    parent_id: major?._id,
    parent_label: `${major?.numero || ''} - ${major?.titolo || ''}`,
    pillar_id: major?.pillar_id || null,
    reparto: major?.reparto || '',
    linea: major?.linea || '',
    macchina: major?.macchina || '',
  }), [major])

  const addArea = perdita => mutate(current => {
    const index = current.aree.map(item => item.perdita).lastIndexOf(perdita)
    const aree = [...current.aree]
    aree.splice(index + 1, 0, { ...newArea(), perdita })
    return { ...current, aree }
  })
  const patchArea = (id, patch) => mutate(current => ({
    ...current,
    aree: current.aree.map(item => (item.id === id ? { ...item, ...patch } : item)),
  }))
  const removeArea = id => mutate(current => ({ ...current, aree: current.aree.filter(item => item.id !== id) }))

  const addAnomaly = () => mutate(current => ({ ...current, anomalie: [...current.anomalie, newAnomaly()] }))
  const addAnomaliesFromAreas = () => mutate(current => ({
    ...current,
    anomalie: [...current.anomalie, ...missingZones.map(area => ({ ...newAnomaly(), macchina: area.macchina, componente: area.componente, area_id: area.id, perdita: area.perdita }))],
  }))
  const patchAnomaly = (id, patch) => mutate(current => ({
    ...current,
    anomalie: current.anomalie.map(item => (item.id === id ? { ...item, ...patch } : item)),
  }))
  const removeAnomaly = id => mutate(current => ({ ...current, anomalie: current.anomalie.filter(item => item.id !== id) }))

  const maintenance = form.anomalie
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.manutenzione)
  const carlIds = maintenance.map(({ item }) => item.carl?.id).filter(Boolean)
  const carlKey = carlIds.join('|')

  const refreshCarl = useCallback(async () => {
    if (!carlKey) return
    try {
      const response = await api.post('/carl/stati', { ids: carlKey.split('|') })
      setCarlStates(response.data?.items || {})
      setCarlOn(true)
    } catch (err) {
      if (err.response?.status === 503) setCarlOn(false)
    }
  }, [carlKey])

  useEffect(() => {
    refreshCarl()
  }, [refreshCarl])

  const ensureSaved = async () => {
    while (savingRef.current) await new Promise(resolve => setTimeout(resolve, 100))
    if (dirtyRef.current && await persist() !== true) throw new Error('Salva prima le modifiche della fase')
    if (dirtyRef.current) return ensureSaved()
  }
  const openCarlDraft = (item, index, priorita) => {
    setCarlError('')
    setCarlDraft({ id: item.id, index, titolo: item.carl_bozza?.titolo || item.descrizione || `Anomalia ${index + 1}`, descrizione: item.carl_bozza?.descrizione ?? item.descrizione, macchina: item.carl_bozza?.macchina ?? item.macchina, componente: item.carl_bozza?.componente ?? item.componente, priorita: item.carl_bozza?.priorita || priorita })
  }
  const updateCarlDraft = patch => {
    const next = { ...carlDraft, ...patch }
    setCarlDraft(next)
    patchAnomaly(next.id, { carl_bozza: next })
  }
  const sendToCarl = async event => {
    event.preventDefault()
    if (sendLock.current || !carlDraft) return
    const draft = carlDraft
    const item = formRef.current.anomalie.find(row => row.id === draft.id)
    if (!item || item.carl) return
    sendLock.current = true
    setSending(item.id)
    setCarlError('')
    try {
      await ensureSaved()
      const machine = machines.find(entry => entry.nome === draft.macchina)
      const response = await api.post('/carl/cartellini', {
        titolo: draft.titolo.trim(),
        descrizione: [draft.descrizione, [draft.macchina, draft.componente].filter(Boolean).join(' / ')].filter(Boolean).join('\n'),
        priorita: draft.priorita,
        macchina_carl: machine?.carl_code || '',
        linea_carl: carlLine,
        riferimento: `${major?.numero || ''} / Anomalia ${draft.index + 1}`,
      })
      patchAnomaly(item.id, { carl: carlSnapshot(response.data), carl_bozza: draft })
      setCarlStates(current => ({ ...current, [response.data.id]: response.data }))
      setCarlDraft(null)
      await ensureSaved()
    } catch (err) {
      setCarlError(typeof err.response?.data?.detail === 'string' ? err.response.data.detail : err.message || 'Invio a CARL non riuscito')
    } finally {
      sendLock.current = false
      setSending('')
    }
  }
  const openAnomalyAP = async item => {
    if (openingAP) return
    setOpeningAP(item.id)
    try {
      await ensureSaved()
      const response = await api.get('/action-plans/', { params: { parent_id: major?._id } })
      const plans = (response.data || []).filter(plan => plan.parent_type === 'major_kaizen' && plan.parent_id === major?._id && plan.gant_step_id === step?.step_id)
      setLinkedPlans(plans)
      const existing = plans.find(plan => plan.route_source?.anomaly_id === item.id || plan._id === item.action_plan_id)
      setApDraft({ id: item.id, plan: existing || null, parent: { ...planningParent, titolo: item.descrizione, macchina: item.macchina, gant_step_id: step?.step_id, route_source: { step_id: step?.step_id, anomaly_id: item.id } } })
    } catch (err) {
      alert(typeof err.response?.data?.detail === 'string' ? err.response.data.detail : err.message || 'Lettura Action Plan non riuscita')
    } finally {
      setOpeningAP('')
    }
  }
  const acceptPlans = useCallback(plans => setLinkedPlans(plans), [])
  const linkedDocIds = [...new Set(form.anomalie.flatMap(item => item.documenti.map(doc => doc.id)))]

  const addDocument = (anomalyId, doc) => {
    if (!doc) return
    mutate(current => ({
      ...current,
      anomalie: current.anomalie.map(item => (item.id !== anomalyId || item.documenti.some(entry => entry.id === doc._id)
        ? item
        : { ...item, documenti: [...item.documenti, { id: doc._id, label: documentLabel(doc) }] })),
    }))
  }

  const removeDocument = (anomalyId, docId) => mutate(current => ({
    ...current,
    anomalie: current.anomalie.map(item => (item.id === anomalyId
      ? { ...item, documenti: item.documenti.filter(entry => entry.id !== docId) }
      : item)),
  }))

  const startCreate = (id, titolo) => {
    const user = readUser()
    const isAdmin = ADMIN_ROLES.includes(String(user.role || user.ruolo || '').toLowerCase())
    setCreating({ id, titolo: titolo || '', mode: isAdmin ? 'choice' : 'nativa' })
  }

  const handleCreated = async createdId => {
    const current = creating
    setCreating(null)
    const loaded = await loadDocuments()
    if (!current || !createdId) return
    const doc = (loaded || []).find(item => item._id === createdId)
    if (doc) addDocument(current.id, doc)
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

  const labelFor = entry => {
    if (entry.label) return entry.label
    const doc = documents.find(item => item._id === entry.id)
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
        {lossOptions.length === 0 ? (
          <p className="text-sm text-gray-500">Seleziona le perdite nella Fase 1.</p>
        ) : (
          <div className="text-sm">
            <div className="hidden md:grid md:grid-cols-[minmax(0,1.3fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.2fr)_4.5rem] gap-2 border-b px-1 pb-1 font-medium text-gray-600">
              <span>Perdita</span><span>Macchina</span><span>Componente</span><span>Standard atteso</span><span />
            </div>
            {form.aree.map((row, index) => {
              const first = index === 0 || form.aree[index - 1].perdita !== row.perdita
              const count = form.aree.filter(item => item.perdita === row.perdita).length
              return (
                <div key={row.id} className={`grid grid-cols-1 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.2fr)_4.5rem] gap-2 px-1 py-2 items-center ${first && index > 0 ? 'border-t border-gray-200' : ''}`}>
                  <span className={`min-w-0 truncate font-medium ${first ? '' : 'hidden md:block md:invisible'}`} title={row.perdita}>{row.perdita}</span>
                  <MachineSelect value={row.macchina} groups={machineGroups} onChange={value => patchArea(row.id, { macchina: value, componente: '' })} />
                  <ComponentInput value={row.componente} options={componentsOf(row.macchina)} onChange={value => patchArea(row.id, { componente: value })} />
                  <input aria-label="Standard atteso" placeholder="Standard atteso" className={input} value={row.standard} onChange={event => patchArea(row.id, { standard: event.target.value })} />
                  <div className="flex justify-end gap-1">
                    <button type="button" title="Aggiungi macchina per questa perdita" aria-label="Aggiungi macchina" onClick={() => addArea(row.perdita)} className="p-2 text-primary hover:bg-gray-100 rounded"><Plus size={15} /></button>
                    {count > 1 && <button type="button" aria-label="Elimina riga" onClick={() => removeArea(row.id)} className="p-2 text-red-600 hover:bg-red-50 rounded"><Trash2 size={15} /></button>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section className={panel}>
        <h3 className={heading}>PASSO 2 - ISPEZIONE E RIPRISTINO</h3>
        <div className="space-y-2">
          {form.anomalie.length === 0 && <p className="py-3 text-center text-sm text-gray-400">Nessuna anomalia registrata</p>}
          {form.anomalie.map((item, index) => {
            const planLinked = Boolean(item.action_plan_id) || linkedPlans.some(plan => plan.route_source?.anomaly_id === item.id)
            return (
              <article key={item.id} className="rounded-lg border border-gray-200 p-2 sm:p-3 space-y-2">
                <div className="grid grid-cols-1 md:grid-cols-[1.75rem_minmax(0,1.4fr)_minmax(0,1.1fr)_minmax(0,0.9fr)_2rem] gap-2 items-center">
                  <span className="hidden md:flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-700">{index + 1}</span>
                  <select aria-label="Area di riferimento" className={input} value={item.area_id || ''} onChange={event => {
                    const area = form.aree.find(row => row.id === event.target.value)
                    patchAnomaly(item.id, area ? { area_id: area.id, perdita: area.perdita, macchina: area.macchina, componente: area.componente } : { area_id: '', perdita: '' })
                  }}>
                    <option value="">Area di riferimento</option>
                    {item.area_id && !form.aree.some(area => area.id === item.area_id) && <option value={item.area_id}>Area non disponibile</option>}
                    {form.aree.map(area => <option key={area.id} value={area.id}>{[area.perdita, area.macchina].filter(Boolean).join(' / ') || 'Area da completare'}</option>)}
                  </select>
                  <MachineSelect value={item.macchina} groups={machineGroups} onChange={value => patchAnomaly(item.id, { macchina: value, componente: '' })} />
                  <ComponentInput value={item.componente} options={componentsOf(item.macchina)} onChange={value => patchAnomaly(item.id, { componente: value })} />
                  <button type="button" aria-label="Elimina anomalia" onClick={() => removeAnomaly(item.id)} className="justify-self-end p-1.5 text-red-600 hover:bg-red-50 rounded"><Trash2 size={15} /></button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <input aria-label="Anomalia rilevata" placeholder="Anomalia rilevata" className={input} value={item.descrizione} onChange={event => patchAnomaly(item.id, { descrizione: event.target.value })} />
                  <input aria-label="Verifica del ripristino" placeholder="Verifica del ripristino (foto, misura, prova)" className={input} value={item.verifica} onChange={event => patchAnomaly(item.id, { verifica: event.target.value })} />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                  <ImageUpload images={item.foto_prima} onChange={value => patchAnomaly(item.id, { foto_prima: value })} label="Foto prima" maxImages={4} showHelp={false} />
                  <ImageUpload images={item.foto_dopo} onChange={value => patchAnomaly(item.id, { foto_dopo: value })} label="Foto dopo" maxImages={4} showHelp={false} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-[auto_minmax(0,1fr)] gap-2 items-start">
                  <div className="flex flex-wrap items-center gap-3 text-sm pt-1.5">
                    <label className="flex items-center gap-1.5">
                      <input type="checkbox" checked={item.manutenzione} disabled={Boolean(item.carl)} onChange={event => patchAnomaly(item.id, { manutenzione: event.target.checked })} />
                      CARL{item.carl && <span className="text-xs text-gray-500">{item.carl.codice}</span>}
                    </label>
                    <label className="flex items-center gap-1.5">
                      <input type="checkbox" checked={item.action_plan || planLinked} disabled={planLinked} onChange={event => patchAnomaly(item.id, { action_plan: event.target.checked })} />
                      Action Plan
                    </label>
                    {(item.action_plan || planLinked) && <button type="button" className={smallButton} disabled={Boolean(openingAP) || !item.descrizione.trim()} onClick={() => openAnomalyAP(item)}>{openingAP === item.id ? 'Caricamento...' : planLinked ? 'Modifica AP' : 'Prepara AP'}</button>}
                  </div>
                  <div className="space-y-1.5 min-w-0">
                    {item.documenti.map(entry => (
                      <DocumentPicker
                        key={entry.id}
                        value={entry.id}
                        label={labelFor(entry)}
                        documents={documents}
                        major={major}
                        onSelect={doc => (doc ? addDocument(item.id, doc) : removeDocument(item.id, entry.id))}
                        onCreate={() => startCreate(item.id, item.descrizione)}
                        onOpen={() => openDocument(entry.id)}
                      />
                    ))}
                    <DocumentPicker
                      value=""
                      label=""
                      documents={documents.filter(doc => !item.documenti.some(entry => entry.id === doc._id))}
                      priorityIds={linkedDocIds}
                      major={major}
                      onSelect={doc => addDocument(item.id, doc)}
                      onCreate={() => startCreate(item.id, item.descrizione)}
                      onOpen={() => {}}
                    />
                  </div>
                </div>
              </article>
            )
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={addAnomaly} className={smallButton}><span className="inline-flex items-center gap-1"><Plus size={14} /> Anomalia</span></button>
          {missingZones.length > 0 && <button type="button" onClick={addAnomaliesFromAreas} className={smallButton}>Crea dalle aree ({missingZones.length})</button>}
        </div>
      </section>

      <section className={panel}>
        <h3 className={heading}>PASSO 3 - INTERVENTI</h3>
        <div className="space-y-4">
          {carlOn && (
            <div className="min-w-0 space-y-2">
              <div className="flex items-center justify-between border-b border-gray-200 pb-1">
                <h4 className="text-sm font-semibold text-gray-800">CARL</h4>
                {carlIds.length > 0 && <button type="button" onClick={refreshCarl} className={smallButton}>Aggiorna stati</button>}
              </div>
              {carlError && <p role="alert" className="text-sm text-red-700">{carlError}</p>}
              {maintenance.length === 0 ? (
                <p className="py-3 text-center text-sm text-gray-400">Nessuna anomalia con CARL</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {maintenance.map(({ item, index }) => (
                    <MaintenanceRow
                      key={item.id}
                      item={item}
                      index={index}
                      current={item.carl ? carlStates[item.carl.id] || item.carl : null}
                      sending={sending === item.id}
                      disabled={Boolean(sending)}
                      onSend={priorita => openCarlDraft(item, index, priorita)}
                      onOpen={() => setCarlDetail(item.carl)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="min-w-0 space-y-2">
            <div className="border-b border-gray-200 pb-1"><h4 className="text-sm font-semibold text-gray-800">Action Plan LPW</h4></div>
            <KaizenAzioniList
              parent={planningParent}
              refreshKey={plansVersion}
              onPlansLoaded={acceptPlans}
              routeOptions={form.anomalie.filter(item => item.descrizione.trim())}
              defaultStepId={step?.step_id || ''}
            />
          </div>
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
              {apDraft && <ActionPlanFormShared
          plan={apDraft.plan}
          prefilledParent={apDraft.parent}
          lockRouteSource={true}
          beforeSubmit={ensureSaved}
          onClose={() => setApDraft(null)}
          onSaved={async saved => {
            patchAnomaly(apDraft.id, { action_plan: true, action_plan_id: saved._id })
            setLinkedPlans(current => [...current.filter(plan => plan._id !== saved._id), saved])
            setApDraft(null)
            setPlansVersion(current => current + 1)
            try { await ensureSaved() } catch { setStatus('error') }
          }}
        />}
        {carlDraft && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div role="dialog" aria-modal="true" aria-label="Prepara CARL" className="w-full max-w-xl rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between bg-primary text-white rounded-t-xl px-5 py-3"><h2 className="font-semibold">Prepara CARL</h2><button type="button" disabled={Boolean(sending)} aria-label="Chiudi" onClick={() => setCarlDraft(null)}><X size={18} /></button></div>
            <form onSubmit={sendToCarl} className="p-5 space-y-3 max-h-[80vh] overflow-y-auto">
              {carlError && <p role="alert" className="text-sm text-red-700">{carlError}</p>}
              <label className="block text-sm">Titolo<input required maxLength={300} className={input} value={carlDraft.titolo} onChange={event => updateCarlDraft({ titolo: event.target.value })} /></label>
              <label className="block text-sm">Descrizione<textarea maxLength={3500} rows={4} className={input} value={carlDraft.descrizione} onChange={event => updateCarlDraft({ descrizione: event.target.value })} /></label>
              <label className="block text-sm">Macchina<MachineSelect value={carlDraft.macchina} groups={machineGroups} onChange={value => updateCarlDraft({ macchina: value, componente: '' })} /></label>
              <label className="block text-sm">Componente<ComponentInput value={carlDraft.componente} options={componentsOf(carlDraft.macchina)} onChange={value => updateCarlDraft({ componente: value })} /></label>
              <label className="block text-sm">Priorita<select className={input} value={carlDraft.priorita} onChange={event => updateCarlDraft({ priorita: event.target.value })}>{['bassa', 'media', 'alta', 'urgente'].map(value => <option key={value} value={value}>{value}</option>)}</select></label>
              <div className="flex justify-end gap-2"><button type="button" className={smallButton} disabled={Boolean(sending)} onClick={() => setCarlDraft(null)}>Chiudi</button><button type="submit" className={addButton} disabled={Boolean(sending) || !carlDraft.titolo.trim()}>{sending ? 'Invio...' : 'Conferma e invia a CARL'}</button></div>
            </form>
          </div>
        </div>}
        {carlDetail && <CarlDetailModal item={carlDetail} onClose={() => setCarlDetail(null)} />}
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
{priority.has(doc._id) ? 'Già usato in questa fase' : [doc.reparto, doc.linea].filter(Boolean).join(' / ') || 'Senza reparto'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function MachineSelect({ value, groups, onChange }) {
  const entries = Object.entries(groups)
  const all = entries.flatMap(([, names]) => names)
  return (
    <select aria-label="Macchina" className={input} value={value || ''} onChange={event => onChange(event.target.value)}>
      <option value="">{all.length ? 'Seleziona macchina' : 'Nessuna macchina in anagrafica'}</option>
      {value && !all.includes(value) && <option value={value}>{value}</option>}
      {entries.map(([area, names]) => area
        ? <optgroup key={area} label={area}>{names.map(name => <option key={name} value={name}>{name}</option>)}</optgroup>
        : names.map(name => <option key={name} value={name}>{name}</option>))}
    </select>
  )
}

function OptionSelect({ label, value, options, onChange }) {
  const values = value && !options.includes(value) ? [value, ...options] : options
  return (
    <select aria-label={label} className={input} value={value || ''} onChange={event => onChange(event.target.value)}>
      <option value="">Seleziona</option>
      {values.map(option => <option key={option} value={option}>{option}</option>)}
    </select>
  )
}

function ComponentInput({ value, options, onChange }) {
  const listId = useId()
  return (
    <>
      <input
        aria-label="Componente"
        list={listId}
        className={input}
        placeholder={options.length ? 'Scegli o scrivi' : 'Scrivi il componente'}
        value={value || ''}
        onChange={event => onChange(event.target.value)}
      />
      <datalist id={listId}>
        {options.map(option => <option key={option} value={option} />)}
      </datalist>
    </>
  )
}

function MaintenanceRow({ item, index, current, sending, disabled, onSend, onOpen }) {
  const [priorita, setPriorita] = useState('media')
  return (
    <div className="flex flex-wrap items-center gap-2 py-2 text-sm">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-700">{index + 1}</span>
      <div className="min-w-0 flex-1">
        <span className="block truncate font-medium text-gray-800" title={item.descrizione}>{item.descrizione || '—'}</span>
        <span className="block truncate text-xs text-gray-500">{[item.macchina, item.componente].filter(Boolean).join(' · ') || '—'}</span>
      </div>
      {current ? (
        <div className="flex items-center gap-2">
          <button type="button" onClick={onOpen} className="font-mono text-xs font-semibold text-primary hover:underline">{current.codice}</button>
          <span className={`rounded px-1.5 py-0.5 text-xs ${CARL_BADGE[current.stato] || 'bg-gray-100 text-gray-700'}`}>{current.stato_label}</span>
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <select aria-label="Priorità" value={priorita} onChange={event => setPriorita(event.target.value)} className="border border-gray-300 rounded px-1.5 py-1 text-xs bg-white">
            <option value="bassa">Bassa</option>
            <option value="media">Media</option>
            <option value="alta">Alta</option>
            <option value="urgente">Urgente</option>
          </select>
          <button type="button" disabled={disabled || !(item.descrizione || '').trim()} onClick={() => onSend(priorita)} className="rounded bg-primary px-2.5 py-1 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50">
            {sending ? 'Invio...' : 'Invia'}
          </button>
        </div>
      )}
    </div>
  )
}

function CarlDetailModal({ item, onClose }) {
  const [detail, setDetail] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    api.get(`/carl/cartellini/${item.id}`)
      .then(response => { if (!cancelled) setDetail(response.data) })
      .catch(err => { if (!cancelled) setError(err.response?.data?.detail || 'Lettura CARL non riuscita') })
    return () => { cancelled = true }
  }, [item.id])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div role="dialog" aria-modal="true" aria-label={`Cartellino ${item.codice}`} className="w-full max-w-lg rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between rounded-t-xl bg-primary px-5 py-3 text-white">
          <h2 className="font-semibold">{item.codice}</h2>
          <button type="button" aria-label="Chiudi" onClick={onClose} className="rounded p-1 hover:bg-white/10"><X size={18} /></button>
        </div>
        <div className="max-h-[70vh] space-y-3 overflow-y-auto p-5 text-sm">
          {error && <p role="alert" className="text-red-700">{error}</p>}
          {!detail && !error && <p className="text-gray-500">Caricamento...</p>}
          {detail && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded px-1.5 py-0.5 text-xs ${CARL_BADGE[detail.stato] || 'bg-gray-100 text-gray-700'}`}>{detail.stato_label}</span>
                <span className="text-xs text-gray-500">Aperto il {formatDay(detail.data)}</span>
                {detail.ordine_lavoro && <span className="text-xs text-gray-500">· Ordine di lavoro creato</span>}
              </div>
              <div className="font-medium text-gray-800">{detail.descrizione}</div>
              {detail.testo && <p className="whitespace-pre-line text-gray-700">{detail.testo}</p>}
              <div>
                <div className="mb-1 text-xs font-semibold uppercase text-gray-500">Storico</div>
                <ol className="space-y-1.5">
                  {detail.storico.map((row, index) => (
                    <li key={index} className="flex gap-2">
                      <span className="w-24 shrink-0 text-xs text-gray-500">{formatDay(row.data)}</span>
                      <span>
                        <span className="font-medium">{row.stato_label}</span>
                        {row.commento && <span className="block text-xs text-gray-600">{row.commento}</span>}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
