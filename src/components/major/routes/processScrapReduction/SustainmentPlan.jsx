import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { X } from 'lucide-react'
import api from '../../../../services/api'
import UserPicker from '../../../UserPicker'
import OplNativaModal from '../../../opl/OplNativaModal'
import OplImportModal from '../../../opl/OplImportModal'
import { OplChoiceModal, SopUploadModal, PreviewModal, readUser } from '../../../../pages/DocumentiPage'

const input = 'w-full min-w-0 border border-gray-300 rounded px-2 py-2 text-sm bg-white'
const smallButton = 'rounded border border-gray-300 px-3 py-1.5 text-xs hover:bg-gray-50 disabled:opacity-50'
const list = value => Array.isArray(value) ? value : []
const uid = () => globalThis.crypto?.randomUUID?.() || `s6_${Date.now()}_${Math.random().toString(16).slice(2)}`
const LEVELS = [
  '1 - Ripristino delle condizioni di base',
  '2 - Ripristino degli standard di processo',
  '3 - Controllo e gestione visiva',
  '4 - Eliminazione della causa radice',
  '5 - Miglioramento tecnologico / di processo',
  '6 - Innovazione / riprogettazione',
]
const EXAMPLES = ['Pulizia, ordine 5S, richiamo al controllo corretto.', 'Ripristino delle procedure, cicli di pulizia e responsabilita.', 'Controlli e gestione visiva.', 'Poka yoke e interventi sulla causa radice.', 'Meccanizzazione o automazione dell’operazione.', 'Nuove tecnologie o riprogettazione del processo.']
const blankBlock = () => ({ applicable: true, reason: '' })
function buildForm(data) {
  const saved = data.standardizzazione_v2
  const initial = {
    blocks: Object.fromEntries(['standards', 'expansion', 'mp', 'ladder'].map(key => [key, blankBlock()])),
    standards: list(data.opl_collegate).map(doc => ({ id: uid(), improvement: '', change: '', documents: [{ id: doc.id || doc._id, label: `${doc.numero || ''} - ${doc.titolo || ''}` }] })),
    expansion: [], mp: [], ladder: [],
    sustain: { indicator: '', method: '', frequency: '', owner: null, date: '', reaction: '', outcome: '', note: '', checkedAt: '' },
  }
  if (!saved) return initial
  return { ...initial, ...saved, blocks: Object.fromEntries(Object.keys(initial.blocks).map(key => [key, { ...blankBlock(), ...saved.blocks?.[key] }])), standards: list(saved.standards), expansion: list(saved.expansion), mp: list(saved.mp), ladder: list(saved.ladder), sustain: { ...initial.sustain, ...saved.sustain } }
}
function outputs(form) {
  const resolved = (key, complete) => form.blocks[key].applicable ? complete : key === 'expansion' || Boolean(form.blocks[key].reason.trim())
  return {
    nuovi_standard: resolved('standards', form.standards.length > 0 && form.standards.every(row => row.documents?.length && row.change?.trim())),
    espansione_orizzontale: resolved('expansion', form.expansion.length > 0 && form.expansion.every(row => row.improvement?.trim() && row.lineKey && row.owner)),
    mp_info_eem: !form.mp.length || resolved('mp', form.mp.every(row => row.title?.trim() && row.files?.length && row.owner)),
    scala_contromisure: resolved('ladder', form.ladder.length > 0 && form.ladder.every(row => row.improvement?.trim() && row.level)),
    mantenimento: Boolean(form.sustain.owner && form.sustain.date && (form.sustain.indicator.trim() || (form.sustain.usePhase5 && form.sustain.referenceSnapshot))),
  }
}
function shortNumber(value) { return String(value || '').replace(/^(OPL|SOP)-/i, '') }
function documentLabel(doc) { return `${doc.tipo} ${shortNumber(doc.numero)} - ${doc.titolo || ''}` }
function documentNumber(doc) { return parseInt(shortNumber(doc.numero), 10) || 0 }

export default function SustainmentPlan({ stepData, onChange, allStepsData = {}, major }) {
  const [form, setForm] = useState(() => buildForm(stepData?.dati || {}))
  const [status, setStatus] = useState('saved')
  const [documents, setDocuments] = useState([])
  const [departments, setDepartments] = useState([])
  const [loadError, setLoadError] = useState('')
  const [creating, setCreating] = useState(null)
  const [previewDoc, setPreviewDoc] = useState(null)
  const formRef = useRef(form)
  const baseRef = useRef(stepData?.dati || {})
  const onChangeRef = useRef(onChange)
  const dirty = useRef(false)
  const revision = useRef(0)
  const saving = useRef(false)
  const timer = useRef(null)
  const mounted = useRef(true)
  const persistRef = useRef(null)
  onChangeRef.current = onChange
  baseRef.current = stepData?.dati || {}
  persistRef.current = async () => {
    clearTimeout(timer.current)
    if (!dirty.current || saving.current) return
    const snapshot = formRef.current
    const rev = revision.current
    saving.current = true
    if (mounted.current) setStatus('saving')
    let failed = false
    try {
      const response = await onChangeRef.current({ dati: { ...baseRef.current, standardizzazione_v2: snapshot, mp_info_eem_scope: 'deferred_to_eem' }, output_compilati: outputs(snapshot) })
      if (response === false) throw new Error('Salvataggio rifiutato')
      if (revision.current === rev) {
        dirty.current = false
        if (mounted.current) setStatus('saved')
      }
    } catch {
      failed = true
      if (mounted.current) setStatus('error')
    } finally {
      saving.current = false
      if (dirty.current && (!failed || revision.current !== rev)) {
        if (mounted.current) timer.current = setTimeout(() => persistRef.current?.(), 800)
        else persistRef.current?.()
      }
    }
  }
  const mutate = update => {
    const next = typeof update === 'function' ? update(formRef.current) : { ...formRef.current, ...update }
    formRef.current = next
    dirty.current = true
    revision.current += 1
    setForm(next)
    setStatus('dirty')
    clearTimeout(timer.current)
    timer.current = setTimeout(() => persistRef.current?.(), 800)
  }
  useEffect(() => {
    if (!dirty.current && !saving.current) {
      const next = buildForm(stepData?.dati || {})
      formRef.current = next
      setForm(next)
    }
  }, [stepData?.dati])
  useEffect(() => {
    mounted.current = true
    const guard = event => { if (dirty.current || saving.current) { event.preventDefault(); event.returnValue = '' } }
    window.addEventListener('beforeunload', guard)
    return () => {
      mounted.current = false
      window.removeEventListener('beforeunload', guard)
      clearTimeout(timer.current)
      if (dirty.current && !saving.current) persistRef.current?.()
    }
  }, [])
  const loadDocuments = async () => {
    try {
      const response = await api.get('/documenti')
      const loaded = list(response.data).filter(doc => ['OPL', 'SOP'].includes(doc.tipo))
      setDocuments(loaded)
      return loaded
    } catch { setLoadError('Documenti non disponibili: riprova il caricamento.'); return null }
  }
  useEffect(() => {
    loadDocuments()
    api.get('/reparti/').then(response => setDepartments(list(response.data))).catch(() => setLoadError('Anagrafica linee non disponibile: ricarica la pagina.'))
  }, [])
  const lineOptions = departments.filter(dep => dep.attivo !== false).flatMap(dep => list(dep.linee).filter(line => line.attivo !== false).map(line => ({ key: `${dep._id || dep.id || dep.nome}:${line.id || line.nome}`, department: dep.nome, name: line.nome, machines: list(line.macchine).filter(machine => machine.attivo !== false) })))
  const [plans, setPlans] = useState([])
  useEffect(() => {
    if (!major?._id) return
    api.get('/action-plans/', { params: { parent_id: major._id } })
      .then(response => setPlans(list(response.data).filter(plan => plan.parent_type === 'major_kaizen' && plan.parent_id === major._id && plan.stato !== 'Annullato')))
      .catch(() => setPlans([]))
  }, [major?._id])
  const sources = useMemo(() => {
    const result = []
    Object.entries(allStepsData).forEach(([stepId, value]) => {
      list(value?.dati?.anomalie).forEach(row => {
        if (row.carl?.id && row.descrizione) result.push({ id: `${stepId}:${row.id}`, group: 'Ripristini CARL', label: row.descrizione, ref: row.carl.codice || '', state: row.carl.stato_label || '', documents: list(row.documenti) })
      })
      list(value?.dati?.miglioramenti).forEach(row => {
        if (row.proposta) result.push({ id: `${stepId}:${row.id}`, group: 'Miglioramenti CARL', label: row.proposta, ref: row.carl?.codice || '', state: row.carl?.stato_label || 'Bozza', documents: [] })
      })
    })
    plans.forEach(plan => result.push({ id: `ap:${plan._id}`, group: 'Action Plan', label: plan.titolo || plan.numero, ref: plan.numero || '', state: plan.stato || '', documents: [] }))
    return result
  }, [allStepsData, plans])
  const phase5 = Object.values(allStepsData).map(value => value?.dati?.saving_economico).find(Boolean)
  const checkReference = phase5?.objectiveSnapshot
    ? [phase5.objectiveSnapshot.product || 'Tutti i prodotti', ...(phase5.objectiveSnapshot.categories || [])].join(' · ')
    : phase5?.scope ? [phase5.scope.line, ...(phase5.scope.priorities || [])].filter(Boolean).join(' · ') : ''
  const checkTarget = phase5?.objectiveSnapshot?.target
  const checkUnit = phase5?.objectiveSnapshot?.unit || ''
  const groups = [...new Set(sources.map(source => source.group))]
  const patch = (key, id, values) => mutate(current => ({ ...current, [key]: current[key].map(row => row.id === id ? { ...row, ...values } : row) }))
  const add = (key, values) => mutate(current => ({ ...current, [key]: [...current[key], { id: uid(), ...values }] }))
  const remove = (key, id) => { if (window.confirm('Rimuovere questa riga dal progetto?')) mutate(current => ({ ...current, [key]: current[key].filter(row => row.id !== id) })) }
  const blockChange = (key, values) => mutate(current => ({ ...current, blocks: { ...current.blocks, [key]: { ...current.blocks[key], ...values } } }))
  const addDocument = (rowId, doc) => {
    if (!doc?._id) return
    mutate(current => ({ ...current, standards: current.standards.map(row => row.id !== rowId || list(row.documents).some(entry => entry.id === doc._id) ? row : { ...row, documents: [...list(row.documents), { id: doc._id, label: documentLabel(doc), version: doc.versione }] }) }))
  }
  const startCreate = row => {
    const user = readUser()
    const admin = ['admin', 'administrator', 'amministratore'].includes(String(user.role || user.ruolo || '').toLowerCase())
    setCreating({ rowId: row.id, titolo: row.change || row.improvement || '', mode: admin ? 'choice' : 'nativa' })
  }
  const handleCreated = async id => {
    const current = creating
    setCreating(null)
    const loaded = await loadDocuments()
    if (!current || !id) return
    const doc = list(loaded).find(item => item._id === id)
    if (doc) addDocument(current.rowId, doc)
    else setLoadError('Documento creato ma non collegato: aggiorna l’elenco e collegalo manualmente.')
  }
  const openDocument = async id => {
    const doc = documents.find(item => item._id === id)
    if (doc) { setPreviewDoc(doc); return }
    try { const response = await api.get(`/documenti/${id}`); setPreviewDoc(response.data) }
    catch { setLoadError('Documento non disponibile.') }
  }
  const initial = { titolo: creating?.titolo || '', reparto: major?.reparto || '', linea: major?.linea || '', macchina: major?.macchina || '' }
  const sourceField = (row, key) => <div className="space-y-2">
    {(!row.sourceId || !sources.some(source => source.id === row.sourceId)) && <Field label="Contromisura / miglioramento" value={row.improvement} onChange={value => patch(key, row.id, { improvement: value, sourceId: '' })} />}
      {sources.length > 0 && <label className="block text-xs">Soluzione del progetto<select className={input} value={row.sourceId || ''} onChange={event => {
        const source = sources.find(item => item.id === event.target.value)
        if (!source) return
        const values = { sourceId: source.id, improvement: source.label, reference: source.ref }
        if (key === 'standards' && !list(row.documents).length && source.documents.length) values.documents = source.documents.filter(doc => doc?.id).map(doc => ({ id: doc.id, label: doc.label || '' }))
        patch(key, row.id, values)
      }}><option value="">Seleziona oppure descrivi sopra</option>{row.sourceId && !sources.some(source => source.id === row.sourceId) && <option value={row.sourceId}>Soluzione non più disponibile</option>}{groups.map(group => <optgroup key={group} label={group}>{sources.filter(source => source.group === group).map(source => <option key={source.id} value={source.id}>{[source.ref, source.label].filter(Boolean).join(' · ')}{source.state ? ` (${source.state})` : ''}</option>)}</optgroup>)}</select></label>}
  </div>
  const statusText = { saved: 'Salvato', dirty: 'Modifiche da salvare...', saving: 'Salvataggio...', error: 'Errore: modifiche ancora nella pagina' }[status]
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap justify-between gap-2 text-sm"><span>Standardizzare ed espandere · salvataggio automatico delle bozze</span><span role="status" aria-live="polite">{statusText}</span>{status === 'error' && <button type="button" className={smallButton} onClick={() => persistRef.current?.()}>Riprova salvataggio</button>}</div>
      {loadError && <p role="alert" className="text-sm text-red-700">{loadError} <button type="button" className={smallButton} onClick={loadDocuments}>Aggiorna documenti</button></p>}
      <Block title="1 · Nuovi standard OPL / SOP" state={form.blocks.standards} onChange={values => blockChange('standards', values)}>
        <p className="text-sm text-gray-600">Collega o crea gli standard del nuovo metodo. Revisioni, pubblicazione, destinatari e letture si gestiscono nel modulo Documenti: nessun secondo registro di formazione.</p>
        <button type="button" className={smallButton} onClick={() => add('standards', { improvement: '', change: '', documents: [] })}>Aggiungi standard</button>
        {form.standards.map(row => <Row key={row.id} onRemove={() => remove('standards', row.id)}>
          {sourceField(row, 'standards')}
          <Field label="Standard introdotto o modifica richiesta" multiline value={row.change} onChange={value => patch('standards', row.id, { change: value })} />
          {list(row.documents).map(entry => <DocumentPicker key={entry.id} value={entry.id} label={entry.label || 'Documento collegato'} documents={documents} major={major} onOpen={() => openDocument(entry.id)} onCreate={() => startCreate(row)} onSelect={doc => { if (!doc) patch('standards', row.id, { documents: row.documents.filter(item => item.id !== entry.id) }) }} />)}
          <DocumentPicker value="" documents={documents.filter(doc => !list(row.documents).some(entry => entry.id === doc._id))} major={major} onSelect={doc => addDocument(row.id, doc)} onCreate={() => startCreate(row)} onOpen={() => {}} />
        </Row>)}
          <div className="border-t pt-4 space-y-3">
            <h4 className="font-semibold text-sm">Scala delle contromisure</h4>
            <p className="text-sm text-gray-600">Seleziona la soluzione e clicca il livello: la X indica quello raggiunto.</p>
            <button type="button" className={smallButton} onClick={() => add('ladder', { improvement: '', level: '', reason: '', evidence: '' })}>Classifica una soluzione</button>
            {form.ladder.map(row => <Row key={row.id} onRemove={() => remove('ladder', row.id)}>
              {sourceField(row, 'ladder')}
              <CountermeasurePyramid value={row.level} onChange={level => patch('ladder', row.id, { level })} />
            </Row>)}
          </div>
      </Block>
      <section className="bg-white border rounded-lg p-4 space-y-3">
        <h3 className="bg-primary text-white text-center py-2 rounded-lg font-bold">2 · MANTENERE IL RISULTATO</h3>
        <p className="text-sm text-gray-600">Assegna una verifica futura. Alla data prevista confronta i risultati e registra l’esito.</p>
        {checkReference && <div className="rounded bg-gray-50 p-3 text-sm"><strong>Riferimento Fase 5:</strong> {checkReference}{checkTarget != null && <span> · Target {checkTarget} {checkUnit}</span>}<p className="text-xs text-gray-500 mt-1">Riferimento recuperato, nessun ricalcolo automatico. Per aggiornare i dati usa la Fase 5.</p></div>}
        <div className="grid md:grid-cols-2 gap-3">
          <PersonField label="Responsabile" value={form.sustain.owner} onChange={owner => mutate(current => ({ ...current, sustain: { ...current.sustain, owner } }))} />
          <Field label="Data della verifica" type="date" value={form.sustain.date} onChange={date => mutate(current => ({ ...current, sustain: { ...current.sustain, date } }))} />
        </div>
        {checkReference ? <label className="flex gap-2 items-center text-sm"><input type="checkbox" checked={Boolean(form.sustain.usePhase5)} onChange={event => { const checked = event.target.checked; mutate(current => ({ ...current, sustain: { ...current.sustain, usePhase5: checked, referenceSnapshot: checked ? { label: checkReference, target: checkTarget, unit: checkUnit, objectiveId: phase5?.objectiveId || '', capturedAt: new Date().toISOString() } : null } })) }} />Usa l’obiettivo della Fase 5 come riferimento</label> : null}
        {(!checkReference || !form.sustain.usePhase5) && <Field label="Cosa controllare" value={form.sustain.indicator} onChange={indicator => mutate(current => ({ ...current, sustain: { ...current.sustain, indicator } }))} />}
        <Select label="Esito della verifica" value={form.sustain.outcome} options={['Risultato mantenuto', 'Risultato non mantenuto']} onChange={outcome => mutate(current => ({ ...current, sustain: { ...current.sustain, outcome, checkedAt: new Date().toISOString() } }))} />
        {form.sustain.outcome === 'Risultato non mantenuto' && <Field label="Cosa è peggiorato e cosa fare" multiline value={form.sustain.note} onChange={note => mutate(current => ({ ...current, sustain: { ...current.sustain, note } }))} />}
        <p className="text-xs text-gray-500">Responsabile e data definiscono il controllo; l’esito si compila dopo la verifica. Nessuna notifica automatica.</p>
      </section>
      <Block title="3 · Espansione orizzontale · facoltativa" state={form.blocks.expansion} onChange={values => blockChange('expansion', values)}>
        <p className="text-sm text-gray-600">Scegli dove replicare la soluzione e chi se ne occupa. Il riferimento collega solo il numero del piano: non crea nuove attività.</p>
        <button type="button" className={smallButton} onClick={() => add('expansion', { improvement: '', lineKey: '', department: '', line: '', machine: '', applicability: 'Applicabile', reason: '', owner: null, date: '', status: 'Da valutare', channel: 'LPW', reference: '', outcome: '' })}>Aggiungi linea destinataria</button>
        {form.expansion.map(row => { const target = lineOptions.find(item => item.key === row.lineKey); return <Row key={row.id} onRemove={() => remove('expansion', row.id)}>
          {sourceField(row, 'expansion')}
          <div className="grid md:grid-cols-2 gap-3">
            <label className="block text-sm">Linea destinataria<select className={input} value={row.lineKey} onChange={event => { const line = lineOptions.find(item => item.key === event.target.value); patch('expansion', row.id, { lineKey: line?.key || '', department: line?.department || '', line: line?.name || '', machine: '' }) }}><option value="">Seleziona linea</option>{row.lineKey && !target && <option value={row.lineKey}>{row.department} / {row.line} (non piu in anagrafica)</option>}{lineOptions.map(line => <option key={line.key} value={line.key}>{line.department} / {line.name}</option>)}</select></label>
            <Select label="Macchina (facoltativa)" value={row.machine} options={list(target?.machines).map(item => item.nome)} onChange={value => patch('expansion', row.id, { machine: value })} />
            <PersonField label="Responsabile" value={row.owner} onChange={value => patch('expansion', row.id, { owner: value })} />
          <Field label="Riferimento Action Plan / CARL (facoltativo)" value={row.reference} onChange={value => patch('expansion', row.id, { reference: value })} />
          </div>
        </Row> })}
      </Block>
      {form.mp.length > 0 && <details className="rounded border bg-white p-3 text-sm"><summary className="cursor-pointer">MP Info già registrate ({form.mp.length})</summary><p className="text-xs text-gray-500 my-2">Dati conservati. La valutazione EEM sarà gestita in una sezione dedicata; nessun invio automatico.</p>{form.mp.map(row => <div key={row.id} className="border-t py-2"><strong>{row.title || row.improvement || 'MP Info'}</strong>{list(row.files).map((file, index) => <p key={index}>{file.name || file.nome || file.filename || 'Allegato conservato'}</p>)}</div>)}</details>}
      <div role="status" aria-live="polite" className="flex justify-end gap-3 text-sm"><span>{statusText}</span>{status === 'error' && <button type="button" className={smallButton} onClick={() => persistRef.current?.()}>Riprova salvataggio</button>}</div>
      {creating?.mode === 'choice' && <OplChoiceModal onClose={() => setCreating(null)} onCreate={() => setCreating(current => ({ ...current, mode: 'nativa' }))} onImport={() => setCreating(current => ({ ...current, mode: 'import' }))} onSop={() => setCreating(current => ({ ...current, mode: 'sop' }))} />}
      {creating?.mode === 'nativa' && <OplNativaModal initial={initial} onClose={() => setCreating(null)} onSaved={doc => handleCreated(doc?._id)} />}
      {creating?.mode === 'import' && <OplImportModal onClose={() => setCreating(null)} onImported={created => created?.length ? handleCreated(created[0].id) : loadDocuments()} />}
      {creating?.mode === 'sop' && <SopUploadModal initial={initial} onClose={() => setCreating(null)} onSaved={doc => handleCreated(doc?.id)} />}
      {previewDoc && <PreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />}
    </div>
  )
}
function CountermeasurePyramid({ value, onChange }) {
  const colors = ['#ff6b6b', '#ffd0a0', '#fff59d', '#c8f7c5', '#9bd34d', '#79963d']
  return <div className="space-y-1 max-w-3xl mx-auto" role="group" aria-label="Livello della contromisura">
    {[...LEVELS].reverse().map(level => {
      const index = LEVELS.indexOf(level)
      const selected = value === level
      return <button key={level} type="button" aria-pressed={selected} onClick={() => onChange(level)} title={EXAMPLES[index]} className="block mx-auto border border-gray-700 rounded px-2 py-3 text-center text-xs md:text-sm text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" style={{ width: `${100 - index * 8}%`, backgroundColor: colors[index], fontWeight: selected ? 700 : 500 }}>
        <span className="inline-block w-6 font-bold" aria-hidden="true">{selected ? 'X' : ''}</span>{level}
      </button>
    })}
    {value && <p className="text-xs text-gray-600 pt-2 text-center">{EXAMPLES[LEVELS.indexOf(value)]}</p>}
  </div>
}
function Block({ title, state, onChange, children }) {
  return <section className="bg-white border rounded-lg p-4 space-y-3"><div className="flex flex-wrap justify-between gap-2"><h3 className="bg-primary text-white text-center py-2 px-3 rounded-lg font-bold flex-1">{title}</h3><label className="text-xs flex gap-2 items-center"><input type="checkbox" checked={!state.applicable} onChange={event => onChange({ applicable: !event.target.checked })} />{title.includes('Espansione') ? 'Non prevista' : 'Non applicabile'}</label></div>{state.applicable ? children : title.includes('Espansione') ? <p className="text-sm text-gray-500">Nessuna espansione prevista.</p> : <Field label="Motivazione non applicabilita" multiline value={state.reason} onChange={value => onChange({ reason: value })} />}</section>
}
function Row({ children, onRemove }) { return <article className="border rounded p-3 space-y-3"><div className="flex justify-end"><button type="button" className={smallButton} onClick={onRemove}>Rimuovi riga</button></div>{children}</article> }
function Field({ label, value, onChange, multiline = false, type = 'text' }) { return <label className="block text-sm">{label}{multiline ? <textarea className={input} rows={2} value={value || ''} onChange={event => onChange(event.target.value)} /> : <input className={input} type={type} value={value || ''} onChange={event => onChange(event.target.value)} />}</label> }
function Select({ label, value, options, onChange }) { const values = value && !options.includes(value) ? [value, ...options] : options; return <label className="block text-sm">{label}<select className={input} value={value || ''} onChange={event => onChange(event.target.value)}><option value="">Seleziona</option>{values.map(option => <option key={option} value={option}>{option}</option>)}</select></label> }
function PersonField({ label, value, onChange }) { return <div className="text-sm"><span>{label}</span><UserPicker value={value || null} onChange={onChange} mode="single" placeholder="Seleziona persona" />{value && <button type="button" className={smallButton} onClick={() => onChange(null)}>Rimuovi assegnazione</button>}</div> }

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

