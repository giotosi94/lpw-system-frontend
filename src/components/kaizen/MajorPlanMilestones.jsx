import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import api from '../../services/api'

const list = value => Array.isArray(value) ? value : []
export function dateOnly(value) {
  const text = String(value || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return ''
  const date = new Date(`${text}T12:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text ? text : ''
}
function person(value) {
  if (typeof value === 'string') return value
  return value?.full_name || value?.name || value?.nome || value?.username || ''
}
export function collectActivities(major, plans, states = {}) {
  const phases = new Set(list(major?.route_snapshot?.steps).map(step => step.step_id))
  const phaseLabels = new Map(list(major?.route_snapshot?.steps).map(step => [step.step_id, step.titolo || step.step_id]))
  const result = []
  const seen = new Set()
  for (const plan of list(plans)) {
    if (plan.parent_type !== 'major_kaizen' || plan.parent_id !== major?._id) continue
    const fields = ['data_scadenza']
    const field = fields.find(key => dateOnly(plan[key]))
    const id = `ap:${plan._id}`
    if (seen.has(id)) continue
    seen.add(id)
    result.push({ id, sourceId: plan._id, type: 'Action Plan', stepId: phases.has(plan.gant_step_id) ? plan.gant_step_id : '', number: plan.numero || '', title: plan.titolo || plan.descrizione || 'Action Plan', description: plan.descrizione || '', owner: person(plan.responsabile || plan.owner || plan.assegnato_a), status: plan.stato || '', due: field ? dateOnly(plan[field]) : '', dueSource: field ? `Action Plan · ${field}` : '', source: 'lpw', phaseLabel: phaseLabels.get(plan.gant_step_id) || 'Non associata' })
  }
  for (const [stepId, value] of Object.entries(major?.steps_data || {})) {
    const data = value?.dati || {}
    const rows = [
      ...list(data.anomalie).filter(row => row.carl?.id).map(row => ({ row, type: 'Cartellino', title: row.descrizione })),
      ...list(data.miglioramenti).filter(row => row.carl?.id).map(row => ({ row, type: row.origine === 'sug_minipillar' ? 'SUG - Minipillar' : 'SUG', title: row.proposta })),
    ]
    for (const { row, type, title } of rows) {
      const live = states[row.carl.id]
      const item = live || row.carl
      const id = `carl:${stepId}:${row.id || row.carl.id}`
      if (seen.has(id)) continue
      seen.add(id)
      result.push({ id, sourceId: row.carl.id, source: 'carl', type, stepId: phases.has(stepId) ? stepId : '', number: item.codice || row.carl.codice || '', title: title || item.descrizione || '', description: row.causa || row.descrizione || '', owner: '', status: item.stato_label || item.stato || '', statusCode: item.stato || '', due: '', dueSource: '', cachedStatus: !live, phaseLabel: phaseLabels.get(stepId) || 'Non associata' })
    }
  }
  return result
}
export function withDeadlines(items, deadlines = {}) {
  return items.map(item => {
    const local = dateOnly(deadlines[item.id])
    return { ...item, due: item.due || local, dueSource: item.due ? item.dueSource : local ? 'Fine programmata LPW (non inviata a CARL)' : '' }
  })
}
export function activityColor(item, today) {
  const status = String(item.statusCode || item.status || '').trim().toLowerCase()
  if (['denied', 'respinta', 'annullato', 'annullata', 'cancelled', 'canceled'].includes(status)) return '#6b7280'
  if (['finished', 'closed', 'completato', 'completata', 'chiuso', 'chiusa', 'lavoro finito', 'completed'].includes(status)) return '#059669'
  return item.due && item.due < today ? '#dc2626' : '#2563eb'
}
export function columnForDate(date, columns, granularity) {
  const day = dateOnly(date)
  if (!day || !columns.length) return -1
  const last = new Date(`${columns[columns.length - 1].fullDate}T12:00:00Z`)
  if (granularity === 'day') last.setUTCDate(last.getUTCDate() + 1)
  else if (granularity === 'week') last.setUTCDate(last.getUTCDate() + 7)
  else {
    const wanted = last.getUTCDate()
    last.setUTCDate(1)
    last.setUTCMonth(last.getUTCMonth() + (granularity === 'quarter' ? 3 : 1))
    const end = new Date(Date.UTC(last.getUTCFullYear(), last.getUTCMonth() + 1, 0)).getUTCDate()
    last.setUTCDate(Math.min(wanted, end))
  }
  const endDate = last.toISOString().slice(0, 10)
  return columns.findIndex((col, index) => day >= col.fullDate && day < (columns[index + 1]?.fullDate || endDate))
}
export function useMajorPlanActivities(major, enabled, phaseKey) {
  const [plans, setPlans] = useState([])
  const [states, setStates] = useState({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const seq = useRef(0)
  const carlIds = [...new Set(collectActivities(major, []).map(item => item.sourceId))].sort().join('|')
  useEffect(() => {
    setPlans([])
    setStates({})
    setError('')
  }, [major?._id])
  useEffect(() => {
    if (!enabled || !major?._id) return
    const current = ++seq.current
    let cancelled = false
    setLoading(true)
    setError('')
    api.get('/action-plans/', { params: { parent_id: major._id } }).then(response => {
      if (!cancelled && seq.current === current) setPlans(list(response.data))
    }).catch(() => { if (!cancelled) setError('Action Plan non aggiornati: riprova. I dati eventualmente mostrati possono essere precedenti.') }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [major?._id, enabled, phaseKey, refreshKey])
  useEffect(() => {
    if (!enabled || !carlIds) return
    let cancelled = false
    const run = async () => {
      const ids = carlIds.split('|')
      const collected = {}
      try {
        for (let offset = 0; offset < ids.length; offset += 50) {
          const response = await api.post('/carl/stati', { ids: ids.slice(offset, offset + 50) })
          Object.assign(collected, response.data?.items || {})
        }
        if (!cancelled) {
          setStates(collected)
          if (Object.keys(collected).length !== ids.length) setError('Alcuni stati CARL non sono disponibili: viene mostrato lo stato salvato nel progetto.')
        }
      } catch { if (!cancelled) { setStates({}); setError('Stati CARL non aggiornati: viene mostrato lo stato salvato nel progetto.') } }
    }
    run()
    return () => { cancelled = true }
  }, [major?._id, enabled, carlIds, refreshKey])
  useEffect(() => {
    const changed = event => { if (event.detail?.parentId === major?._id) setRefreshKey(value => value + 1) }
    window.addEventListener('lpw-major-activities-changed', changed)
    return () => window.removeEventListener('lpw-major-activities-changed', changed)
  }, [major?._id])
  const items = useMemo(() => collectActivities(major, plans, states), [major, plans, states])
  return { items, error, loading, refresh: () => setRefreshKey(value => value + 1) }
}
export function MilestoneMarkers({ items, stepId, columns, granularity, cellWidth, today, onSelect }) {
  const groups = new Map()
  for (const item of items) {
    if (item.stepId !== stepId) continue
    const column = columnForDate(item.due, columns, granularity)
    if (column < 0) continue
    if (!groups.has(column)) groups.set(column, [])
    groups.get(column).push(item)
  }
  return <div className="absolute inset-x-0 top-0 h-[26px] pointer-events-none" style={{ zIndex: 30 }}>
    {[...groups].map(([column, group]) => {
      const colors = group.map(item => activityColor(item, today))
      const color = colors.includes('#dc2626') ? '#dc2626' : colors.every(value => value === '#059669') ? '#059669' : colors.every(value => value === '#6b7280') ? '#6b7280' : '#2563eb'
      return <button key={column} type="button" className="absolute pointer-events-auto flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-amber-500" style={{ left: column * cellWidth + cellWidth / 2 - 12, top: 1, width: 24, height: 24 }} aria-label={`${group.length} attivita: ${group.map(item => `${item.number} ${item.title} ${item.due}`).join('; ')}`} title="Clicca per riepilogo e fine programmata" onMouseDown={event => { event.preventDefault(); event.stopPropagation() }} onClick={event => { event.stopPropagation(); onSelect(group.map(item => item.id)) }}>
        <span className="absolute rotate-45 border-2 border-white shadow-sm" style={{ width: 15, height: 15, backgroundColor: color }} />
        {group.length > 1 && <span className="relative text-[9px] font-bold text-white">{group.length}</span>}
      </button>
    })}
  </div>
}
function DeadlineEditor({ item, onSave }) {
  const [value, setValue] = useState(item.due || '')
  const [error, setError] = useState('')
  useEffect(() => { setValue(item.due || '') }, [item.id, item.due])
  const external = item.dueSource.startsWith('Action Plan')
  return external ? <p className="text-xs text-gray-600">Fine programmata: {item.due} · {item.dueSource}. Modifica la data nell’Action Plan.</p> : <div className="space-y-1">
    <label className="block text-xs">Fine programmata LPW<input type="date" className="border rounded px-2 py-1 ml-2" value={value} onChange={event => setValue(event.target.value)} /></label>
    <div className="flex flex-wrap gap-2"><button type="button" className="border rounded px-2 py-1 text-xs" onClick={() => { if (value && !dateOnly(value)) { setError('Data non valida'); return } setError(''); onSave(item.id, value) }}>Applica data al Master Plan</button><button type="button" className="border rounded px-2 py-1 text-xs" onClick={() => { setValue(''); onSave(item.id, '') }}>Rimuovi data LPW</button></div>
    <p className="text-xs text-gray-500">Data locale al progetto: non modifica CARL o l’Action Plan. Viene salvata con il Master Plan.</p>
    {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
  </div>
}
export function ActivityInspector({ items, onClose, onOpenPhase, onDeadlineChange }) {
  const closeRef = useRef(null)
  const panelRef = useRef(null)
  const [detail, setDetail] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    const previous = document.activeElement
    closeRef.current?.focus()
    const key = event => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'Tab') {
        const controls = [...(panelRef.current?.querySelectorAll('button, input, a[href], select, textarea') || [])].filter(element => !element.disabled)
        const first = controls[0], last = controls[controls.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
      }
    }
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('keydown', key); previous?.focus?.() }
  }, [])
  const read = async item => {
    setLoading(true)
    setError('')
    setDetail(null)
    try { const response = await api.get(`/carl/cartellini/${item.sourceId}`); setDetail(response.data) }
    catch { setError('Storico CARL non disponibile.') }
    finally { setLoading(false) }
  }
  return createPortal(<div className="fixed inset-0 z-[100] bg-black/30 flex items-center justify-center p-3" onClick={onClose}>
    <section ref={panelRef} role="dialog" aria-modal="true" aria-label="Riepilogo attivita del Master Plan" className="w-full max-w-xl max-h-[85vh] overflow-y-auto bg-white rounded-lg shadow-xl p-4 space-y-3" onClick={event => event.stopPropagation()}>
      <div className="flex justify-between gap-2"><h3 className="font-semibold">Attivita e fine programmata</h3><button ref={closeRef} type="button" className="border rounded px-2 py-1 text-sm" onClick={onClose}>Chiudi</button></div>
      {!items.length && <p className="text-sm">Nessuna attivita disponibile.</p>}
      {items.map(item => <article key={item.id} className="border rounded p-3 space-y-2">
        <p className="text-xs text-gray-500">{item.type} · {item.number || 'Senza numero'}</p><h4 className="font-medium text-sm">{item.title}</h4>
        {item.description && item.description !== item.title && <p className="text-sm whitespace-pre-wrap">{item.description}</p>}
        <p className="text-xs">Fase: {item.phaseLabel || 'Non associata'}</p>
        <p className="text-xs">Stato: {item.status || 'Non disponibile'}{item.cachedStatus ? ' (ultimo stato salvato)' : ''}</p>
        <p className="text-xs">Responsabile / destinatario: {item.owner || 'Non disponibile nei dati letti'}</p>
        <DeadlineEditor item={item} onSave={onDeadlineChange} />
        <div className="flex gap-2 flex-wrap">{item.stepId && <button type="button" className="border rounded px-2 py-1 text-xs" onClick={() => { onOpenPhase?.(item.stepId); onClose() }}>Apri fase di origine</button>}{item.source === 'carl' && <button type="button" disabled={loading} className="border rounded px-2 py-1 text-xs" onClick={() => read(item)}>Leggi storico CARL</button>}</div>
      </article>)}
      {loading && <p role="status" className="text-sm">Caricamento storico...</p>}{error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {detail && <div className="border-t pt-2 text-xs space-y-1"><strong>{detail.codice} · {detail.stato_label}</strong>{list(detail.storico).map((row, index) => <p key={index}>{row.data ? new Date(row.data).toLocaleString('it-IT') : ''} · {row.stato_label} {row.commento}</p>)}</div>}
    </section>
  </div>, document.body)
}
