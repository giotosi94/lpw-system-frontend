import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { X } from 'lucide-react'
import api from '../../../../services/api'
import UserPicker from '../../../UserPicker'
import DocumentUpload from '../../../DocumentUpload'
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
    sustain: { indicator: '', method: '', frequency: '', owner: null, date: '', reaction: '' },
  }
  if (!saved) return initial
  return { ...initial, ...saved, blocks: Object.fromEntries(Object.keys(initial.blocks).map(key => [key, { ...blankBlock(), ...saved.blocks?.[key] }])), standards: list(saved.standards), expansion: list(saved.expansion), mp: list(saved.mp), ladder: list(saved.ladder), sustain: { ...initial.sustain, ...saved.sustain } }
}
function outputs(form) {
  const resolved = (key, complete) => form.blocks[key].applicable ? complete : Boolean(form.blocks[key].reason.trim())
  return {
    nuovi_standard: resolved('standards', form.standards.length > 0 && form.standards.every(row => row.documents?.length && row.change?.trim())),
    espansione_orizzontale: resolved('expansion', form.expansion.length > 0 && form.expansion.every(row => row.improvement?.trim() && row.lineKey && (row.applicability === 'Non applicabile' ? row.reason?.trim() : row.applicability === 'Applicabile' && row.owner && row.date))),
    mp_info_eem: resolved('mp', form.mp.length > 0 && form.mp.every(row => row.title?.trim() && row.files?.length && row.owner)),
    scala_contromisure: resolved('ladder', form.ladder.length > 0 && form.ladder.every(row => row.improvement?.trim() && row.level && row.reason?.trim() && row.evidence?.trim())),
    mantenimento: Boolean(form.sustain.indicator.trim() && form.sustain.frequency.trim() && form.sustain.owner && form.sustain.reaction.trim()),
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
      const response = await onChangeRef.current({ dati: { ...baseRef.current, standardizzazione_v2: snapshot }, output_compilati: outputs(snapshot) })
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
  const sources = useMemo(() => {
    const result = []
    Object.entries(allStepsData).forEach(([stepId, value]) => {
      list(value?.dati?.miglioramenti).forEach(row => {
        if (row.proposta) result.push({ id: `${stepId}:${row.id}`, label: row.proposta, ref: row.carl?.codice || '' })
      })
    })
    return result
  }, [allStepsData])
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
    <Field label="Contromisura / miglioramento" value={row.improvement} onChange={value => patch(key, row.id, { improvement: value, sourceId: '' })} />
    {sources.length > 0 && <label className="block text-xs">Riprendi un SUG della Fase 4<select className={input} value={row.sourceId || ''} onChange={event => { const source = sources.find(item => item.id === event.target.value); if (source) patch(key, row.id, { sourceId: source.id, improvement: source.label, reference: source.ref }) }}><option value="">Seleziona oppure descrivi sopra</option>{sources.map(source => <option key={source.id} value={source.id}>{source.label}</option>)}</select></label>}
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
      </Block>
      <Block title="2 · Espansione orizzontale" state={form.blocks.expansion} onChange={values => blockChange('expansion', values)}>
        <p className="text-sm text-gray-600">Identifica le altre linee su cui replicare la soluzione. Il riferimento Action Plan/CARL e registrato qui, non crea nuove attivita e non somma saving.</p>
        <button type="button" className={smallButton} onClick={() => add('expansion', { improvement: '', lineKey: '', department: '', line: '', machine: '', applicability: 'Da valutare', reason: '', owner: null, date: '', status: 'Da valutare', channel: 'LPW', reference: '', outcome: '' })}>Aggiungi linea destinataria</button>
        {form.expansion.map(row => { const target = lineOptions.find(item => item.key === row.lineKey); return <Row key={row.id} onRemove={() => remove('expansion', row.id)}>
          {sourceField(row, 'expansion')}
          <div className="grid md:grid-cols-2 gap-3">
            <label className="block text-sm">Linea destinataria<select className={input} value={row.lineKey} onChange={event => { const line = lineOptions.find(item => item.key === event.target.value); patch('expansion', row.id, { lineKey: line?.key || '', department: line?.department || '', line: line?.name || '', machine: '' }) }}><option value="">Seleziona linea</option>{row.lineKey && !target && <option value={row.lineKey}>{row.department} / {row.line} (non piu in anagrafica)</option>}{lineOptions.map(line => <option key={line.key} value={line.key}>{line.department} / {line.name}</option>)}</select></label>
            <Select label="Macchina (facoltativa)" value={row.machine} options={list(target?.machines).map(item => item.nome)} onChange={value => patch('expansion', row.id, { machine: value })} />
            <Select label="Applicabilita" value={row.applicability} options={['Da valutare', 'Applicabile', 'Non applicabile']} onChange={value => patch('expansion', row.id, { applicability: value })} />
            <Field label="Motivazione / adattamenti necessari" value={row.reason} onChange={value => patch('expansion', row.id, { reason: value })} />
            <PersonField label="Responsabile" value={row.owner} onChange={value => patch('expansion', row.id, { owner: value })} />
            <Field label="Data prevista" type="date" value={row.date} onChange={value => patch('expansion', row.id, { date: value })} />
            <Select label="Stato replica" value={row.status} options={['Da valutare', 'Pianificata', 'In corso', 'Completata', 'Verificata']} onChange={value => patch('expansion', row.id, { status: value })} />
            <Select label="Gestione attivita" value={row.channel} options={['LPW', 'CARL']} onChange={value => patch('expansion', row.id, { channel: value })} />
            <Field label="Numero / riferimento Action Plan o CARL" value={row.reference} onChange={value => patch('expansion', row.id, { reference: value })} />
            <Field label="Esito ed evidenza della replica" value={row.outcome} onChange={value => patch('expansion', row.id, { outcome: value })} />
          </div>
        </Row> })}
      </Block>
      <Block title="3 · MP Info / EEM" state={form.blocks.mp} onChange={values => blockChange('mp', values)}>
        <p className="text-sm text-gray-600">Compila il template aziendale MP Info e allegalo qui. Il referente EEM e lo stato sono registrati nel progetto: non inviano notifiche e non costituiscono approvazione Engineering o COE.</p>
        <button type="button" className={smallButton} onClick={() => add('mp', { title: '', number: '', improvement: '', owner: null, status: 'Da condividere', replication: 'Locale', note: '', files: [] })}>Aggiungi MP Info</button>
        {form.mp.map(row => <Row key={row.id} onRemove={() => remove('mp', row.id)}>
          {sourceField(row, 'mp')}
          <div className="grid md:grid-cols-2 gap-3">
            <Field label="Titolo MP Info" value={row.title} onChange={value => patch('mp', row.id, { title: value })} />
            <Field label="Numero / revisione documento" value={row.number} onChange={value => patch('mp', row.id, { number: value })} />
            <PersonField label="Referente EEM" value={row.owner} onChange={value => patch('mp', row.id, { owner: value })} />
            <Select label="Stato condivisione" value={row.status} options={['Da condividere', 'Condivisa', 'Recepita']} onChange={value => patch('mp', row.id, { status: value })} />
            <Select label="Potenziale di replica" value={row.replication} options={['Locale', 'Piattaforma tecnologica', 'Globale']} onChange={value => patch('mp', row.id, { replication: value })} />
            <Field label="Requisito trasferito / evidenza recepimento" multiline value={row.note} onChange={value => patch('mp', row.id, { note: value })} />
          </div>
          <DocumentUpload documents={list(row.files)} onChange={value => patch('mp', row.id, { files: value })} />
        </Row>)}
      </Block>
      <Block title="4 · Scala delle contromisure" state={form.blocks.ladder} onChange={values => blockChange('ladder', values)}>
        <p className="text-sm text-gray-600">Classifica la soluzione adottata con la scala FI. Nessun punteggio automatico e nessuna media tra livelli.</p>
        <button type="button" className={smallButton} onClick={() => add('ladder', { improvement: '', level: '', reason: '', evidence: '' })}>Aggiungi contromisura</button>
        {form.ladder.map(row => <Row key={row.id} onRemove={() => remove('ladder', row.id)}>
          {sourceField(row, 'ladder')}
          <Select label="Livello raggiunto" value={row.level} options={LEVELS} onChange={value => patch('ladder', row.id, { level: value })} />
          {row.level && <p className="text-xs text-gray-600">{EXAMPLES[LEVELS.indexOf(row.level)]}</p>}
          <Field label="Motivazione del livello" multiline value={row.reason} onChange={value => patch('ladder', row.id, { reason: value })} />
          <Field label="Evidenza di applicazione / rischio residuo" multiline value={row.evidence} onChange={value => patch('ladder', row.id, { evidence: value })} />
        </Row>)}
      </Block>
      <section className="bg-white border rounded-lg p-4 space-y-3">
        <h3 className="font-semibold">Mantenimento del risultato</h3>
        <div className="grid md:grid-cols-2 gap-3">
          {['indicator', 'method', 'frequency', 'date', 'reaction'].map((key, index) => <Field key={key} label={['Indicatore da controllare', 'Metodo / fonte', 'Frequenza', 'Prossima verifica', 'Soglia e azione in caso di peggioramento'][index]} type={key === 'date' ? 'date' : 'text'} value={form.sustain[key]} onChange={value => mutate(current => ({ ...current, sustain: { ...current.sustain, [key]: value } }))} />)}
          <PersonField label="Responsabile controllo" value={form.sustain.owner} onChange={value => mutate(current => ({ ...current, sustain: { ...current.sustain, owner: value } }))} />
        </div>
      </section>
      <div role="status" aria-live="polite" className="flex justify-end gap-3 text-sm"><span>{statusText}</span>{status === 'error' && <button type="button" className={smallButton} onClick={() => persistRef.current?.()}>Riprova salvataggio</button>}</div>
      {creating?.mode === 'choice' && <OplChoiceModal onClose={() => setCreating(null)} onCreate={() => setCreating(current => ({ ...current, mode: 'nativa' }))} onImport={() => setCreating(current => ({ ...current, mode: 'import' }))} onSop={() => setCreating(current => ({ ...current, mode: 'sop' }))} />}
      {creating?.mode === 'nativa' && <OplNativaModal initial={initial} onClose={() => setCreating(null)} onSaved={doc => handleCreated(doc?._id)} />}
      {creating?.mode === 'import' && <OplImportModal onClose={() => setCreating(null)} onImported={created => created?.length ? handleCreated(created[0].id) : loadDocuments()} />}
      {creating?.mode === 'sop' && <SopUploadModal initial={initial} onClose={() => setCreating(null)} onSaved={doc => handleCreated(doc?.id)} />}
      {previewDoc && <PreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />}
    </div>
  )
}
function Block({ title, state, onChange, children }) {
  return <section className="bg-white border rounded-lg p-4 space-y-3"><div className="flex flex-wrap justify-between gap-2"><h3 className="font-bold text-primary">{title}</h3><label className="text-xs flex gap-2 items-center"><input type="checkbox" checked={!state.applicable} onChange={event => onChange({ applicable: !event.target.checked })} />Non applicabile</label></div>{state.applicable ? children : <Field label="Motivazione non applicabilita" multiline value={state.reason} onChange={value => onChange({ reason: value })} />}</section>
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

