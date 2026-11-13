import { useRef, useState } from 'react'
import { Plus, GripVertical, Edit2, ChevronDown, ChevronRight, Copy, X } from 'lucide-react'
import api from '../../services/api'

const uid = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(16).slice(2)}`
const field = 'w-full border rounded px-3 py-2 text-sm bg-white'
const button = 'border rounded px-2 py-1 text-xs hover:bg-gray-50 disabled:opacity-40'
export const getAreas = line => Array.isArray(line.aree) ? line.aree : (line.macchine || []).map(machine => ({
  id: machine.id, nome: machine.nome, codice: machine.codice, carl_code: machine.carl_code,
  descrizione: machine.descrizione || '', attivo: machine.attivo !== false, legacy_macchina_id: machine.id,
  componenti_da_assegnare: machine.componenti || [], macchine: [],
}))
export const cloneAreas = line => getAreas(line).map(area => ({ ...area, id: uid(), legacy_macchina_id: null, carl_code: '',
  componenti_da_assegnare: (area.componenti_da_assegnare || []).map(component => ({ ...component, id: uid() })),
  macchine: (area.macchine || []).map(machine => ({ ...machine, id: uid(), carl_code: '', componenti: (machine.componenti || []).map(component => ({ ...component, id: uid() })) })),
}))
export const structureCounts = line => {
  const areas = getAreas(line)
  return { areas: areas.length, machines: areas.reduce((sum, area) => sum + (area.macchine || []).length, 0) }
}

export default function LineaStructure({ reparto, linea, allReparti = [], onChange }) {
  const [editor, setEditor] = useState(null)
  const [copyOpen, setCopyOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const lock = useRef(false)
  const drag = useRef(null)
  const [opened, setOpened] = useState({})
  const [dropTarget, setDropTarget] = useState('')
  const toggle = key => setOpened(current => ({ ...current, [key]: !current[key] }))
  const areas = getAreas(linea)
  const save = async next => {
    if (lock.current) return false
    lock.current = true
    setBusy(true)
    setError('')
    try {
      await api.put(`/reparti/${reparto._id}/linee/${linea.id}/struttura`, { aree: next, expected_updated_at: reparto.updated_at || null })
      setEditor(null)
      setCopyOpen(false)
      await onChange()
      return true
    } catch (failure) {
      const detail = failure.response?.data?.detail
      setError(typeof detail === 'string' ? detail : 'Salvataggio non riuscito. Ricarica la struttura e riprova.')
      return false
    } finally { lock.current = false; setBusy(false) }
  }
  const changeArea = (id, update) => areas.map(area => area.id === id ? update(area) : area)
  const reorder = (nodes, sourceId, targetId) => {
    const from = nodes.findIndex(node => node.id === sourceId)
    const to = nodes.findIndex(node => node.id === targetId)
    if (from < 0 || to < 0 || from === to) return nodes
    const next = [...nodes]
    const [node] = next.splice(from, 1)
    next.splice(to, 0, node)
    return next
  }
  const groupNodes = group => {
    if (group === 'areas') return areas
    for (const area of areas) {
      if (group === `machines:${area.id}`) return area.macchine || []
      for (const machine of area.macchine || []) if (group === `components:${machine.id}`) return machine.componenti || []
    }
    return []
  }
  const persistOrder = (group, next) => {
    if (group === 'areas') return save(next)
    return save(areas.map(area => group === `machines:${area.id}` ? { ...area, macchine: next } : {
      ...area, macchine: (area.macchine || []).map(machine => group === `components:${machine.id}` ? { ...machine, componenti: next } : machine),
    }))
  }
  const dragHandle = (group, node) => <button type="button" draggable={!busy} disabled={busy} aria-label={`Riordina ${node.nome}`} title="Trascina per riordinare. Da tastiera: Alt + freccia su o giù." className="p-1 shrink-0 text-gray-400 cursor-grab active:cursor-grabbing hover:text-gray-700 rounded focus-visible:outline focus-visible:outline-2" onClick={event => event.stopPropagation()} onDragStart={event => {
    event.stopPropagation()
    drag.current = { group, id: node.id }
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', node.id)
  }} onDragEnd={() => { drag.current = null; setDropTarget('') }} onKeyDown={event => {
    if (!event.altKey || !['ArrowUp', 'ArrowDown'].includes(event.key) || busy) return
    event.preventDefault()
    event.stopPropagation()
    const nodes = groupNodes(group)
    const index = nodes.findIndex(item => item.id === node.id)
    const target = index + (event.key === 'ArrowUp' ? -1 : 1)
    if (target >= 0 && target < nodes.length) persistOrder(group, reorder(nodes, node.id, nodes[target].id))
  }}><GripVertical size={14} /></button>
  const dropProps = (group, node) => ({
    onDragOver: event => {
      if (!busy && drag.current?.group === group && drag.current.id !== node.id) {
        event.preventDefault()
        event.stopPropagation()
        event.dataTransfer.dropEffect = 'move'
        setDropTarget(`${group}:${node.id}`)
      }
    },
    onDrop: event => {
      event.preventDefault()
      event.stopPropagation()
      const source = drag.current
      drag.current = null
      setDropTarget('')
      if (!busy && source?.group === group && source.id !== node.id) persistOrder(group, reorder(groupNodes(group), source.id, node.id))
    },
  })
  const editButton = (kind, area, machine, node) => <button type="button" disabled={busy} title={`Modifica ${kind.toLowerCase()}`} aria-label={`Modifica ${node.nome}`} className="ml-auto shrink-0 p-1.5 rounded text-amber-700 hover:bg-amber-50 disabled:opacity-40" onClick={event => { event.stopPropagation(); start(kind, area, machine, node) }}><Edit2 size={14} /></button>
  const start = (kind, area, machine, node) => setEditor({ kind, areaId: area?.id, machineId: machine?.id, node: node || null })
  const commit = form => {
    const value = { ...(editor.node || {}), ...form, id: editor.node?.id || uid(), nome: form.nome.trim() }
    const replace = nodes => editor.node ? nodes.map(node => node.id === value.id ? value : node) : [...nodes, value]
    if (editor.kind === 'Area') return save(replace(areas))
    return save(changeArea(editor.areaId, area => editor.kind === 'Macchina'
      ? { ...area, macchine: replace(area.macchine || []) }
      : { ...area, macchine: (area.macchine || []).map(machine => machine.id === editor.machineId ? { ...machine, componenti: replace(machine.componenti || []) } : machine) }))
  }
  const assign = (area, component, machineId) => {
    if (!machineId || !window.confirm(`Assegnare "${component.nome}" alla macchina selezionata?`)) return
    save(changeArea(area.id, item => ({ ...item,
      componenti_da_assegnare: (item.componenti_da_assegnare || []).filter(value => value.id !== component.id),
      macchine: (item.macchine || []).map(machine => machine.id === machineId ? { ...machine, componenti: [...(machine.componenti || []), component] } : machine),
    })))
  }
  return <div className="space-y-2 p-2">
    <div className="flex flex-wrap justify-between items-center gap-2">
      <span className="text-xs text-gray-500">Linea → Area → Macchina → Componente</span>
      <button type="button" disabled={busy} className={button} onClick={() => setCopyOpen(true)}><Copy size={12} className="inline mr-1" />Copia aree da una linea</button>
    </div>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {areas.map(area => <div key={area.id} className={`border-l-2 border-gray-300 pl-2 ${area.attivo === false ? 'opacity-60' : ''}`}>
      <div {...dropProps('areas', area)} className={`flex items-center gap-1 rounded p-2 text-sm ${dropTarget === `areas:${area.id}` ? 'bg-blue-100 ring-1 ring-blue-300' : 'bg-gray-50'}`}>
        {dragHandle('areas', area)}
        <button type="button" aria-expanded={Boolean(opened[`area:${area.id}`])} onClick={() => toggle(`area:${area.id}`)} className="flex items-center gap-1 flex-1 min-w-0 text-left">
          {opened[`area:${area.id}`] ? <ChevronDown size={14} className="shrink-0" /> : <ChevronRight size={14} className="shrink-0" />}
          <strong className="break-words">{area.nome}</strong><span className="text-xs text-gray-500 ml-1">Area · {(area.macchine || []).length} macchine{area.attivo === false ? ' · Disattiva' : ''}</span>
        </button>
        {editButton('Area', null, null, area)}
      </div>
      {opened[`area:${area.id}`] && <div className="space-y-2 p-2">
        {area.carl_code && <p className="text-xs text-gray-500">CARL {area.carl_code}</p>}
        {(area.componenti_da_assegnare || []).length > 0 && <div className="rounded border border-amber-200 bg-amber-50 p-2 space-y-2">
          <p className="text-xs text-amber-900">Componenti precedenti conservati: scegli la macchina a cui assegnarli.</p>
          {area.componenti_da_assegnare.map(component => <label key={component.id} className="flex flex-wrap items-center gap-2 text-xs"><span>{component.nome}</span><select aria-label={`Macchina per ${component.nome}`} disabled={busy} value="" onChange={event => assign(area, component, event.target.value)} className="border rounded bg-white p-1"><option value="">Assegna a macchina...</option>{(area.macchine || []).filter(machine => machine.attivo !== false).map(machine => <option key={machine.id} value={machine.id}>{machine.nome}</option>)}</select></label>)}
        </div>}
        {(area.macchine || []).map(machine => <div key={machine.id} className={`border-l-2 border-gray-200 pl-2 ${machine.attivo === false ? 'opacity-60' : ''}`}>
          <div {...dropProps(`machines:${area.id}`, machine)} className={`flex items-center gap-1 rounded p-2 text-sm ${dropTarget === `machines:${area.id}:${machine.id}` ? 'bg-blue-100 ring-1 ring-blue-300' : 'bg-gray-50'}`}>
            {dragHandle(`machines:${area.id}`, machine)}
            <button type="button" aria-expanded={Boolean(opened[`machine:${machine.id}`])} onClick={() => toggle(`machine:${machine.id}`)} className="flex items-center gap-1 flex-1 min-w-0 text-left">
              {opened[`machine:${machine.id}`] ? <ChevronDown size={14} className="shrink-0" /> : <ChevronRight size={14} className="shrink-0" />}
              <span className="break-words">{machine.nome}</span><span className="ml-1 text-xs text-gray-500">Macchina · {(machine.componenti || []).length} componenti{machine.attivo === false ? ' · Disattiva' : ''}</span>
            </button>
            {editButton('Macchina', area, null, machine)}
          </div>
          {opened[`machine:${machine.id}`] && <div className="p-2 space-y-2">
            {machine.carl_code && <p className="text-xs text-gray-500">CARL {machine.carl_code}</p>}
            {(machine.componenti || []).map(component => <div key={component.id} {...dropProps(`components:${machine.id}`, component)} className={`flex items-center gap-1 border-b py-1 text-xs ${component.attivo === false ? 'opacity-60' : ''} ${dropTarget === `components:${machine.id}:${component.id}` ? 'bg-blue-100 ring-1 ring-blue-300' : ''}`}>
              {dragHandle(`components:${machine.id}`, component)}<span className="flex-1 break-words">{component.nome}{component.attivo === false ? ' · Disattivo' : ''}</span>{editButton('Componente', area, machine, component)}
            </div>)}
            <button type="button" disabled={busy} className={button} onClick={() => start('Componente', area, machine)}><Plus size={12} className="inline mr-1" />Aggiungi componente</button>
          </div>}
        </div>)}
        <button type="button" disabled={busy} className={button} onClick={() => start('Macchina', area)}><Plus size={12} className="inline mr-1" />Aggiungi macchina</button>
      </div>}
    </div>)}
    <button type="button" disabled={busy} className="w-full border border-dashed rounded py-2 text-xs text-gray-600" onClick={() => start('Area')}><Plus size={12} className="inline mr-1" />Aggiungi area</button>
    {busy && <p role="status" className="text-xs text-gray-500">Salvataggio...</p>}
    {editor && <StructureNodeForm key={`${editor.kind}-${editor.node?.id || 'new'}`} editor={editor} busy={busy} error={error} onClose={() => { if (!busy) setEditor(null) }} onSave={commit} />}
    {copyOpen && <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"><div role="dialog" aria-modal="true" aria-label="Copia aree" className="bg-white rounded-xl p-5 max-w-lg w-full max-h-[85vh] overflow-y-auto space-y-3"><div className="flex justify-between"><h3 className="font-semibold">Copia aree da una linea</h3><button type="button" disabled={busy} onClick={() => setCopyOpen(false)} aria-label="Chiudi"><X size={18} /></button></div><p className="text-xs text-gray-500">Aggiunge una copia con nuovi identificativi. Le aree presenti non vengono sostituite; i codici CARL non vengono copiati.</p>{error && <p role="alert" className="text-sm text-red-700">{error}</p>}{allReparti.flatMap(rep => (rep.linee || []).filter(line => line.id !== linea.id && getAreas(line).length).map(line => <button type="button" disabled={busy} key={`${rep._id}-${line.id}`} className="w-full border rounded p-2 text-left text-sm" onClick={() => { if (window.confirm(`Aggiungere le aree di ${line.nome}?`)) save([...areas, ...cloneAreas(line)]) }}>{rep.nome} · {line.nome}</button>))}</div></div>}
  </div>
}

function StructureNodeForm({ editor, busy, error, onClose, onSave }) {
  const [form, setForm] = useState({ nome: editor.node?.nome || '', codice: editor.node?.codice || '', carl_code: editor.node?.carl_code || '', descrizione: editor.node?.descrizione || '', attivo: editor.node?.attivo !== false })
  return <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"><div role="dialog" aria-modal="true" aria-label={`${editor.kind}`} className="bg-white rounded-xl w-full max-w-lg p-5 max-h-[90vh] overflow-y-auto space-y-3">
    <h3 className="font-semibold">{editor.node ? 'Modifica' : 'Aggiungi'} {editor.kind.toLowerCase()}</h3>
    <form onSubmit={event => { event.preventDefault(); if (form.nome.trim()) onSave(form) }}><fieldset disabled={busy} className="space-y-3">
      <label className="block text-sm">Nome<input required autoFocus maxLength={180} className={field} value={form.nome} onChange={event => setForm(current => ({ ...current, nome: event.target.value }))} /></label>
      {editor.kind !== 'Componente' && <><label className="block text-sm">Codice<input className={field} value={form.codice} onChange={event => setForm(current => ({ ...current, codice: event.target.value }))} /></label><label className="block text-sm">Codice CARL<input className={field} value={form.carl_code} onChange={event => setForm(current => ({ ...current, carl_code: event.target.value.trim() }))} /></label><label className="block text-sm">Descrizione<textarea className={field} rows={2} value={form.descrizione} onChange={event => setForm(current => ({ ...current, descrizione: event.target.value }))} /></label></>}
      <label className="flex gap-2 text-sm"><input type="checkbox" checked={form.attivo} onChange={event => setForm(current => ({ ...current, attivo: event.target.checked }))} />Attivo</label>
      <p className="text-xs text-gray-500">Per non perdere i riferimenti, disattiva gli elementi non più utilizzati invece di eliminarli.</p>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className={button}>Annulla</button><button type="submit" disabled={!form.nome.trim()} className="bg-primary text-white rounded px-4 py-2 text-sm disabled:opacity-50">{busy ? 'Salvataggio...' : 'Salva'}</button></div>
    </fieldset></form>
  </div></div>
}
