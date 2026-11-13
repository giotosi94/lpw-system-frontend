import { useRef, useState } from 'react'
import { Plus, ArrowUp, ArrowDown, Copy, X } from 'lucide-react'
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
  const move = (nodes, index, delta) => {
    const next = [...nodes]
    const target = index + delta
    if (target < 0 || target >= next.length) return nodes
    const item = next.splice(index, 1)[0]
    next.splice(target, 0, item)
    return next
  }
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
  const orderButtons = (index, nodes, update) => <span className="inline-flex gap-1">
    <button type="button" className={button} disabled={busy || index === 0} aria-label="Sposta su" onClick={() => update(move(nodes, index, -1))}><ArrowUp size={12} /></button>
    <button type="button" className={button} disabled={busy || index === nodes.length - 1} aria-label="Sposta giù" onClick={() => update(move(nodes, index, 1))}><ArrowDown size={12} /></button>
  </span>
  return <div className="space-y-2 p-2">
    <div className="flex flex-wrap justify-between items-center gap-2">
      <span className="text-xs text-gray-500">Linea → Area → Macchina → Componente</span>
      <button type="button" disabled={busy} className={button} onClick={() => setCopyOpen(true)}><Copy size={12} className="inline mr-1" />Copia aree da una linea</button>
    </div>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {areas.map((area, index) => <details key={area.id} className={`border-l-2 border-gray-300 pl-2 ${area.attivo === false ? 'opacity-60' : ''}`}>
      <summary className="cursor-pointer bg-gray-50 rounded p-2 text-sm"><strong>{area.nome}</strong><span className="text-xs text-gray-500 ml-2">Area · {(area.macchine || []).length} macchine{area.attivo === false ? ' · Disattiva' : ''}</span></summary>
      <div className="space-y-2 p-2">
        <div className="flex flex-wrap items-center gap-2">{orderButtons(index, areas, next => save(next))}<button type="button" disabled={busy} className={button} onClick={() => start('Area', null, null, area)}>Modifica area</button>{area.carl_code && <span className="text-xs text-gray-500">CARL {area.carl_code}</span>}</div>
        {(area.componenti_da_assegnare || []).length > 0 && <div className="rounded border border-amber-200 bg-amber-50 p-2 space-y-2">
          <p className="text-xs text-amber-900">Componenti precedenti conservati: scegli la macchina a cui assegnarli.</p>
          {area.componenti_da_assegnare.map(component => <label key={component.id} className="flex flex-wrap items-center gap-2 text-xs"><span>{component.nome}</span><select aria-label={`Macchina per ${component.nome}`} disabled={busy} value="" onChange={event => assign(area, component, event.target.value)} className="border rounded bg-white p-1"><option value="">Assegna a macchina...</option>{(area.macchine || []).filter(machine => machine.attivo !== false).map(machine => <option key={machine.id} value={machine.id}>{machine.nome}</option>)}</select></label>)}
        </div>}
        {(area.macchine || []).map((machine, machineIndex) => <details key={machine.id} className={`border-l-2 border-gray-200 pl-2 ${machine.attivo === false ? 'opacity-60' : ''}`}>
          <summary className="cursor-pointer p-2 text-sm bg-gray-50 rounded">{machine.nome}<span className="ml-2 text-xs text-gray-500">Macchina · {(machine.componenti || []).length} componenti{machine.attivo === false ? ' · Disattiva' : ''}</span></summary>
          <div className="p-2 space-y-2">
            <div className="flex flex-wrap gap-2 items-center">{orderButtons(machineIndex, area.macchine, next => save(changeArea(area.id, value => ({ ...value, macchine: next }))))}<button type="button" disabled={busy} className={button} onClick={() => start('Macchina', area, null, machine)}>Modifica macchina</button>{machine.carl_code && <span className="text-xs text-gray-500">CARL {machine.carl_code}</span>}</div>
            {(machine.componenti || []).map(component => <div key={component.id} className={`flex items-center justify-between gap-2 border-b py-1 text-xs ${component.attivo === false ? 'opacity-60' : ''}`}><span>{component.nome}{component.attivo === false ? ' · Disattivo' : ''}</span><button type="button" disabled={busy} className={button} onClick={() => start('Componente', area, machine, component)}>Modifica</button></div>)}
            <button type="button" disabled={busy} className={button} onClick={() => start('Componente', area, machine)}><Plus size={12} className="inline mr-1" />Aggiungi componente</button>
          </div>
        </details>)}
        <button type="button" disabled={busy} className={button} onClick={() => start('Macchina', area)}><Plus size={12} className="inline mr-1" />Aggiungi macchina</button>
      </div>
    </details>)}
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
