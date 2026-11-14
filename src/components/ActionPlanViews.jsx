import { Link } from 'react-router-dom'
import { useState, useMemo } from 'react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import {
  Eye, Edit2, Trash2, Link2, Lock, AlertCircle, CheckSquare, Bug,
  TrendingUp, Shield, Wrench, MessageSquare, Calendar
} from 'lucide-react'
const PRIORITA_BG = {
  Lowest: 'bg-gray-100 text-gray-700',
  Low: 'bg-blue-100 text-blue-700',
  Medium: 'bg-yellow-100 text-yellow-700',
  High: 'bg-orange-100 text-orange-700',
  Critical: 'bg-red-100 text-red-700',
}

const TIPO_ICONS = {
  Task: CheckSquare, Bug: Bug, Improvement: TrendingUp,
  Audit: Shield, Manutenzione: Wrench, Sicurezza: AlertCircle,
}

const TIPO_COLORS = {
  Task: 'text-blue-600', Bug: 'text-red-600', Improvement: 'text-green-600',
  Audit: 'text-purple-600', Manutenzione: 'text-orange-600', Sicurezza: 'text-yellow-600',
}

const KANBAN_PALETTE = [
  { color: 'bg-gray-50 border-gray-300', headerColor: 'bg-gray-200 text-gray-700' },
  { color: 'bg-blue-50 border-blue-200', headerColor: 'bg-blue-200 text-blue-800' },
  { color: 'bg-indigo-50 border-indigo-200', headerColor: 'bg-indigo-200 text-indigo-800' },
  { color: 'bg-purple-50 border-purple-200', headerColor: 'bg-purple-200 text-purple-800' },
  { color: 'bg-green-50 border-green-200', headerColor: 'bg-green-200 text-green-800' },
  { color: 'bg-yellow-50 border-yellow-200', headerColor: 'bg-yellow-200 text-yellow-800' },
  { color: 'bg-orange-50 border-orange-200', headerColor: 'bg-orange-200 text-orange-800' },
  { color: 'bg-red-50 border-red-200', headerColor: 'bg-red-200 text-red-800' },
  { color: 'bg-pink-50 border-pink-200', headerColor: 'bg-pink-200 text-pink-800' },
]
export function isAPLocked(ap, statiConfig = []) {
  if (!ap) return false
  if (ap.is_cancelled) return true
  const statoCorrente = statiConfig.find(s => s.label === ap.stato)
  if (statoCorrente?.is_terminal) return true
  if (['Done', 'Chiuso', 'Cancelled'].includes(ap.stato)) return true
  return false
}
function Avatar({ name, size = 24, showName = true }) {
  if (!name) {
    return showName ? <span className="text-xs text-gray-400 italic">— Non assegnato</span> : null
  }
  const initials = name.split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase()
  const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-yellow-500', 'bg-orange-500']
  const color = colors[name.charCodeAt(0) % colors.length]
  return (
    <div className="flex items-center gap-2">
      <div
        className={`${color} text-white rounded-full flex items-center justify-center font-bold flex-shrink-0`}
        style={{ width: size, height: size, fontSize: size * 0.45 }}
        title={name}
      >
        {initials}
      </div>
      {showName && <span className="text-xs truncate">{name}</span>}
    </div>
  )
}

export function getActionPlanOrigin(ap) {
  if (['kaizen', 'major_kaizen', 'major-kaizen'].includes(ap.parent_type)) return 'kaizen'
  if (['dashboard', 'meeting'].includes(ap.parent_type)) return 'dashboard'
  if (['pillar', 'pilastro'].includes(ap.parent_type)) return 'pillar'
  if (ap.parent_type === 'segnalazione') return 'segnalazione'
  return !ap.parent_type || ap.parent_type === 'standalone' ? 'manuale' : 'other'
}
export function isActionPlanOverdue(ap, states = []) {
  if (isAPLocked(ap, states) || ['Annullato', 'Completed', 'Closed'].includes(ap.stato) || !ap.data_scadenza) return false
  const due = new Date(ap.data_scadenza)
  const today = new Date()
  due.setHours(0, 0, 0, 0)
  today.setHours(0, 0, 0, 0)
  return due < today
}
function CollegatoBadge({ ap }) {
  const origin = getActionPlanOrigin(ap)
  const labels = { kaizen: 'Kaizen', dashboard: 'Meeting', pillar: 'Pilastro', segnalazione: 'Segnalazione', manuale: 'Non collegato', other: 'Altro' }
  const paths = { kaizen: '/kaizen/', dashboard: '/dashboard/', pillar: '/pillars/', segnalazione: '/segnalazioni?open=' }
  const path = ['major_kaizen', 'major-kaizen'].includes(ap.parent_type) ? '/major-kaizen/' : paths[origin]
  const label = String(ap.parent_label || '')
  const code = ap.parent_numero || ap.parent_code || label.match(/\b[A-Z][A-Z0-9]*-\d+\b/i)?.[0] || (label && !/\s/.test(label) ? label : '')
  const content = <span className="inline-block bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs whitespace-nowrap">{code || '—'}</span>
  return path && ap.parent_id ? <Link to={`${path}${encodeURIComponent(ap.parent_id)}`} title={label || labels[origin]} aria-label={`Apri ${labels[origin]} ${code || ''}`} onClick={event => event.stopPropagation()} className="hover:underline">{content}</Link> : content
}
function getStatoStyle(stato, statiConfig = []) {
  const cfg = statiConfig.find(s => s.label === stato)
  if (cfg?.color) {
    const hex = cfg.color
    return {
      className: 'border font-medium',
      style: {
        backgroundColor: hex + '20',
        color: hex,
        borderColor: hex + '60',    
      },
    }
  }
  const defaultMap = {
    'Da Valutare': 'bg-gray-100 text-gray-700 border-gray-300',
    'Da valutare': 'bg-gray-100 text-gray-700 border-gray-300',
    Aperto: 'bg-blue-100 text-blue-700 border-blue-300',
    'In Corso': 'bg-indigo-100 text-indigo-700 border-indigo-300',
    'In corso': 'bg-indigo-100 text-indigo-700 border-indigo-300',
    'In Verifica': 'bg-purple-100 text-purple-700 border-purple-300',
    'In verifica': 'bg-purple-100 text-purple-700 border-purple-300',
    Done: 'bg-green-100 text-green-700 border-green-300',
    Chiuso: 'bg-green-100 text-green-700 border-green-300',
    Cancelled: 'bg-gray-100 text-gray-500 border-gray-300',
    Annullato: 'bg-gray-100 text-gray-500 border-gray-300',
  }
  return {
    className: defaultMap[stato] || 'bg-gray-100 text-gray-700 border-gray-300',
    style: {},
  }
}

export default function ActionPlanViews({
  plans = [],
  statiConfig = [],
  onSelectAP,
  onEditAP,
  onDeleteAP,
  onUnlinkAP,
  onChangeStato,
  onChangeStepGant,
  gantSteps = [],
  unlinkLabel = 'Scollega',
  showCollegato = true,
  showStepGant = false,
  showKanban = true,
  showCalendar = true,
  defaultView = 'list',
  compact = false,
  readOnly = false,
  emptyMessage = 'Nessun Action Plan',
  emptyAction = null,
}) {
  const [viewMode, setViewMode] = useState(defaultView)
  const [calendarDays, setCalendarDays] = useState(30)

  if (plans.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow p-12 text-center">
        <p className="text-gray-500 mb-3">{emptyMessage}</p>
        {emptyAction && (
          <button onClick={emptyAction.onClick} className="text-primary hover:underline text-sm">
            {emptyAction.label}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      
      {(showKanban || showCalendar) && (
        <div className="flex justify-end">
          <div className="bg-white border rounded-lg p-1 flex gap-1 shadow-sm">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded text-sm transition-all ${viewMode === 'list' ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              Lista
            </button>
            {showKanban && (
              <button
                onClick={() => setViewMode('kanban')}
                className={`px-3 py-1.5 rounded text-sm transition-all ${viewMode === 'kanban' ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                Kanban
              </button>
            )}
            {showCalendar && (
              <button
                onClick={() => setViewMode('calendar')}
                className={`px-3 py-1.5 rounded text-sm transition-all ${viewMode === 'calendar' ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                Calendario
              </button>
            )}
          </div>
        </div>
      )}

      
      {viewMode === 'list' && (
        <ListView
          plans={plans}
          statiConfig={statiConfig}
          gantSteps={gantSteps}
          onSelectAP={onSelectAP}
          onEditAP={onEditAP}
          onDeleteAP={onDeleteAP}
          onUnlinkAP={onUnlinkAP}
          onChangeStato={onChangeStato}
          onChangeStepGant={onChangeStepGant}
          unlinkLabel={unlinkLabel}
          showCollegato={showCollegato}
          showStepGant={showStepGant}
          compact={compact}
          readOnly={readOnly}
        />
      )}
      {viewMode === 'kanban' && (
        <KanbanView
          plans={plans}
          statiConfig={statiConfig}
          onSelectAP={onSelectAP}
          onChangeStato={onChangeStato}
        />
      )}
      {viewMode === 'calendar' && (
        <CalendarView
          plans={plans}
          calendarDays={calendarDays}
          setCalendarDays={setCalendarDays}
          onSelectAP={onSelectAP}
        />
      )}
    </div>
  )
}
function ListView({
  plans, statiConfig, gantSteps, onSelectAP, onEditAP, onDeleteAP, onUnlinkAP,
  onChangeStato, onChangeStepGant, unlinkLabel, showCollegato, showStepGant, compact, readOnly,
}) {
  return (
    <div className={`bg-white rounded-xl shadow overflow-hidden ${readOnly ? 'ap-home-readonly' : ''}`}>
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b text-xs uppercase text-gray-500">
          <tr>
            <th className="px-3 py-2 text-left w-24">Numero</th>
            <th className="px-3 py-2 text-left">Titolo</th>
            <th className="px-3 py-2 text-left w-24">Tipo</th>
            <th className="px-3 py-2 text-left w-24">Priorità</th>
            <th className="px-3 py-2 text-left w-40">Responsabile</th>
            <th className="px-3 py-2 text-left w-32">Stato</th>
            <th className="px-3 py-2 text-left w-28">Scadenza</th>
            {showStepGant && <th className="px-3 py-2 text-left w-48">Step Gant</th>}
            {showCollegato && <th className="px-3 py-2 text-left w-32">Collegato a</th>}
            {!readOnly && <th className="px-3 py-2 text-center w-32">Azioni</th>}
          </tr>
        </thead>
        <tbody>
          {plans.map(ap => {
            const TipoIcon = TIPO_ICONS[ap.tipo] || CheckSquare
            const isOverdue = isActionPlanOverdue(ap, statiConfig)
            const isCancelled = ap.is_cancelled
            const locked = isAPLocked(ap, statiConfig)
            return (
              <tr
                key={ap._id}
                className={`border-b hover:bg-gray-50 cursor-pointer ${isCancelled ? 'opacity-60' : ''}`}
                onClick={() => onSelectAP?.(ap)}
              >
                <td data-label="Numero" className="px-3 py-2 font-mono text-primary text-xs font-bold">{ap.numero}</td>
                <td data-label="Titolo" className="px-3 py-2">
                  <button type="button" className="font-medium text-left break-words hover:text-primary" onClick={event => { event.stopPropagation(); onSelectAP?.(ap) }}>{ap.titolo}</button>
                </td>
                <td data-label="Tipo" className="px-3 py-2">
                  {ap.tipo ? (
                    <div className={`flex items-center gap-1 text-xs ${TIPO_COLORS[ap.tipo] || 'text-gray-500'}`}>
                      <TipoIcon size={14} />
                      <span>{ap.tipo}</span>
                    </div>
                  ) : <span className="text-xs text-gray-300">—</span>}
                </td>
                <td data-label="Priorità" className="px-3 py-2">
                  {ap.priorita ? (
                    <span className={`px-2 py-0.5 rounded text-xs ${PRIORITA_BG[ap.priorita] || 'bg-gray-100 text-gray-700'}`}>
                      {ap.priorita}
                    </span>
                  ) : <span className="text-xs text-gray-300">—</span>}
                </td>
                <td data-label="Responsabile" className="px-3 py-2">
                  <Avatar name={ap.responsabile} />
                </td>
                <td data-label="Stato" className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                  {(() => {
                    const statoStyle = getStatoStyle(ap.stato, statiConfig)
                    if (readOnly) return <span className={`inline-block text-xs px-2 py-1 rounded ${statoStyle.className}`} style={statoStyle.style}>{ap.stato || 'Non definito'}</span>
                    return (
                      <select
                        value={ap.stato || ''}
                        onChange={(e) => onChangeStato?.(ap, e.target.value)}
                        className={`text-xs px-1.5 py-1 rounded ${statoStyle.className}`}
                        style={statoStyle.style}
                      >
                        {statiConfig.length === 0 ? (
                          <option value={ap.stato || ''}>{ap.stato || '— Configura stati —'}</option>
                        ) : (
                          statiConfig.map(s => (
                            <option key={s._id} value={s.label}>{s.label}</option>
                          ))
                        )}
                      </select>
                    )
                  })()}
                </td>
                <td data-label="Scadenza" className="px-3 py-2 text-xs">
                  {ap.data_scadenza ? (
                    <div className={isOverdue ? 'text-red-600 font-bold' : 'text-gray-700'}>
                      {new Date(ap.data_scadenza).toLocaleDateString('it-IT')}
                    </div>
                  ) : '—'}
                </td>
                {showStepGant && (
                  <td data-label="Step Gant" className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    <select
                      value={ap.gant_step_id || ''}
                      onChange={(e) => onChangeStepGant?.(ap, e.target.value)}
                      disabled={locked}
                      className={`text-xs px-2 py-1 rounded border w-full ${
                        ap.gant_step_id
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : 'bg-white text-gray-500 border-gray-200'
                      } ${locked ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <option value="">— Nessuno step —</option>
                      {gantSteps.map(s => (
                        <option key={s.id} value={s.id}>Step {s.num}: {s.label}</option>
                      ))}
                    </select>
                  </td>
                )}
                {showCollegato && (
                  <td data-label="Collegato a" className="px-3 py-2 text-xs">
                    <CollegatoBadge ap={ap} />
                  </td>
                )}
                {!readOnly && <td data-label="Collegato a" className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                  <div className="flex justify-center gap-1">
                    {onSelectAP && (
                      <button onClick={() => onSelectAP(ap)} className="p-1 hover:bg-blue-100 rounded text-blue-600" title="Apri dettaglio">
                        <Eye size={14} />
                      </button>
                    )}
                    {locked ? (
                      <button
                        disabled
                        className="p-1 rounded text-gray-300 cursor-not-allowed"
                        title="Action Plan chiuso — apri il dettaglio per riaprirlo"
                      >
                        <Lock size={14} />
                      </button>
                    ) : (
                      <>
                        {onEditAP && (
                          <button onClick={() => onEditAP(ap)} className="p-1 hover:bg-yellow-100 rounded text-yellow-600" title="Modifica">
                            <Edit2 size={14} />
                          </button>
                        )}
                        {onUnlinkAP && (
                          <button onClick={() => onUnlinkAP(ap)} className="p-1 hover:bg-orange-100 rounded text-orange-600" title={unlinkLabel}>
                            <Link2 size={14} />
                          </button>
                        )}
                        {onDeleteAP && (
                          <button onClick={() => onDeleteAP(ap)} className="p-1 hover:bg-red-100 rounded text-red-600" title="Elimina definitivamente">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </td>}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
function KanbanView({ plans, statiConfig, onSelectAP, onChangeStato }) {
  if (statiConfig.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-12 text-center">
        <h3 className="font-bold text-lg mb-2">Nessuno stato configurato</h3>
        <p className="text-sm text-gray-500 mb-4">
          Per usare la vista Kanban devi prima configurare gli <strong>Stati Action Plan</strong> nelle Settings.
        </p>
        <a href="/settings" className="inline-block bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-light text-sm">
          Vai in Settings
        </a>
      </div>
    )
  }

  const columns = statiConfig.map((s, idx) => {
    const palette = KANBAN_PALETTE[idx % KANBAN_PALETTE.length]
    const hex = s.color
    if (hex) {
      return {
        id: s.label,
        label: s.label,
        isTerminal: !!s.is_terminal,
        color: 'border',
        colorStyle: { backgroundColor: hex + '15', borderColor: hex + '60' },
        headerColor: '',
        headerStyle: { backgroundColor: hex + '40', color: hex },
      }
    }
    return {
      id: s.label,
      label: s.label,
      isTerminal: !!s.is_terminal,
      color: palette.color,
      headerColor: palette.headerColor,
      colorStyle: {},
      headerStyle: {},
    }
  })

  const cancelledPlans = plans.filter(p => p.is_cancelled)
  const activePlans = plans.filter(p => !p.is_cancelled)

  const grouped = columns.reduce((acc, col) => {
    acc[col.id] = activePlans.filter(p => p.stato === col.id)
    return acc
  }, {})

  const knownStati = new Set(columns.map(c => c.id))
  const orphans = activePlans.filter(p => !knownStati.has(p.stato))
  if (orphans.length > 0) {
    columns.push({
      id: '__orphans__',
      label: 'Stato non riconosciuto',
      color: 'bg-red-50 border-red-300',
      headerColor: 'bg-red-200 text-red-800',
    })
    grouped['__orphans__'] = orphans
  }

  async function onDragEnd(result) {
    const { source, destination, draggableId } = result
    if (!destination) return
    if (source.droppableId === destination.droppableId) return
    if (destination.droppableId === '__orphans__') return
    const ap = plans.find(p => p._id === draggableId)
    if (ap) await onChangeStato?.(ap, destination.droppableId)
  }

  return (
    <>
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-3" style={{ minHeight: '70vh' }}>
          {columns.map(col => (
            <div
              key={col.id}
              className={`flex-shrink-0 w-72 rounded-lg border-2 ${col.color} flex flex-col`}
              style={col.colorStyle}
            >
              <div
                className={`${col.headerColor} px-3 py-2 rounded-t-md font-semibold text-sm flex justify-between items-center`}
                style={col.headerStyle}
              >
                <span>{col.label}</span>
                <span className="bg-white bg-opacity-50 px-2 py-0.5 rounded-full text-xs">{grouped[col.id].length}</span>
              </div>
              <Droppable droppableId={col.id} isDropDisabled={col.id === '__orphans__'}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`flex-1 p-2 space-y-2 overflow-y-auto transition-colors ${snapshot.isDraggingOver ? 'bg-white bg-opacity-50' : ''}`}
                    style={{ minHeight: '300px' }}
                  >
                    {grouped[col.id].length === 0 && !snapshot.isDraggingOver && (
                      <div className="text-center text-xs text-gray-400 py-8">Trascina qui</div>
                    )}
                    {grouped[col.id].map((plan, index) => (
                      <Draggable key={plan._id} draggableId={plan._id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            onClick={() => !snapshot.isDragging && onSelectAP?.(plan)}
                            className={`bg-white rounded-md p-3 shadow-sm border cursor-pointer hover:shadow-md transition-all ${snapshot.isDragging ? 'rotate-2 shadow-2xl ring-2 ring-primary' : ''}`}
                          >
                            <KanbanCard plan={plan} />
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>
      </DragDropContext>

      {cancelledPlans.length > 0 && (
        <div className="mt-6 bg-red-50 border-2 border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="font-bold text-red-800">Action Plan annullati ({cancelledPlans.length})</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {cancelledPlans.map(plan => (
              <div
                key={plan._id}
                onClick={() => onSelectAP?.(plan)}
                className="bg-white rounded-md p-3 shadow-sm border border-red-300 cursor-pointer hover:shadow-md transition-all opacity-75 hover:opacity-100"
              >
                <span className="font-mono text-xs text-red-600 font-bold">{plan.numero}</span>
                <div className="font-medium text-sm mb-1 line-clamp-2">{plan.titolo}</div>
                {plan.cancelled_reason && (
                  <div className="text-xs text-red-700 italic mt-2 bg-red-100 px-2 py-1 rounded">
                    {plan.cancelled_reason}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

function KanbanCard({ plan }) {
  const TipoIcon = TIPO_ICONS[plan.tipo] || CheckSquare
  const checklistCompletati = plan.checklist?.filter(c => c.completato).length || 0
  const checklistTotali = plan.checklist?.length || 0
  const isOverdue = plan.stato_visuale === 'In Ritardo'

  return (
    <>
      <div className="flex justify-between items-center mb-1">
        <span className="font-mono text-xs text-primary font-bold">{plan.numero}</span>
        {plan.priorita && (
          <span className={`text-xs px-1.5 py-0.5 rounded ${PRIORITA_BG[plan.priorita] || ''}`}>
            {plan.priorita}
          </span>
        )}
      </div>
      <div className="font-medium text-sm mb-2 line-clamp-2">{plan.titolo}</div>
      {plan.tipo && (
        <div className={`flex items-center gap-1 text-xs mb-2 ${TIPO_COLORS[plan.tipo] || ''}`}>
          <TipoIcon size={12} />
          <span>{plan.tipo}</span>
        </div>
      )}
      {plan.parent_type && plan.parent_type !== 'standalone' && (
        <div className="mb-2"><CollegatoBadge ap={plan} /></div>
      )}
      {checklistTotali > 0 && (
        <div className="mb-2">
          <div className="flex justify-between text-xs text-gray-500 mb-0.5">
            <span>{checklistCompletati}/{checklistTotali}</span>
            <span>{Math.round((checklistCompletati / checklistTotali) * 100)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1">
            <div className="bg-green-500 h-1 rounded-full" style={{ width: `${(checklistCompletati / checklistTotali) * 100}%` }} />
          </div>
        </div>
      )}
      <div className="flex justify-between items-center pt-2 border-t mt-2">
        <Avatar name={plan.responsabile} size={20} showName={false} />
        <div className="flex items-center gap-2 text-xs text-gray-500">
          {plan.commenti?.length > 0 && (
            <span className="flex items-center gap-0.5"><MessageSquare size={10} /> {plan.commenti.length}</span>
          )}
          {plan.data_scadenza && (
            <span className={`flex items-center gap-0.5 ${isOverdue ? 'text-red-600 font-bold' : ''}`}>
              <Calendar size={10} />
              {new Date(plan.data_scadenza).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })}
            </span>
          )}
        </div>
      </div>
    </>
  )
}
function CalendarView({ plans, calendarDays, setCalendarDays, onSelectAP }) {
  const oggi = new Date()
  oggi.setHours(0, 0, 0, 0)

  const fineSettimana = new Date(oggi)
  fineSettimana.setDate(fineSettimana.getDate() + (7 - oggi.getDay()))
  fineSettimana.setHours(23, 59, 59, 999)

  const fineProssimePeriodo = new Date(fineSettimana)
  fineProssimePeriodo.setDate(fineProssimePeriodo.getDate() + calendarDays)

  const apsAttivi = plans.filter(p => !p.is_cancelled && p.stato !== 'Done' && p.stato !== 'Chiuso')

  const scaduti = []
  const oggiAPs = []
  const settimanaAPs = []
  const prossimeAPs = []
  const senzaScadenza = []

  apsAttivi.forEach(ap => {
    if (!ap.data_scadenza) {
      senzaScadenza.push(ap)
      return
    }
    const scadenza = new Date(ap.data_scadenza)
    scadenza.setHours(0, 0, 0, 0)
    if (scadenza < oggi) {
      const giorniRitardo = Math.floor((oggi - scadenza) / (1000 * 60 * 60 * 24))
      scaduti.push({ ...ap, _giorniRitardo: giorniRitardo })
    } else if (scadenza.getTime() === oggi.getTime()) {
      oggiAPs.push(ap)
    } else if (scadenza <= fineSettimana) {
      settimanaAPs.push(ap)
    } else if (scadenza <= fineProssimePeriodo) {
      prossimeAPs.push(ap)
    } else {
      senzaScadenza.push(ap)
    }
  })

  const sortByDate = (a, b) => {
    if (!a.data_scadenza) return 1
    if (!b.data_scadenza) return -1
    return new Date(a.data_scadenza) - new Date(b.data_scadenza)
  }
  scaduti.sort(sortByDate)
  oggiAPs.sort(sortByDate)
  settimanaAPs.sort(sortByDate)
  prossimeAPs.sort(sortByDate)

  const colonne = [
    { id: 'scaduti', label: 'Scaduti', headerBg: 'bg-red-100', headerText: 'text-red-700', border: 'border-red-300', plans: scaduti },
    { id: 'oggi', label: 'Oggi', headerBg: 'bg-orange-100', headerText: 'text-orange-700', border: 'border-orange-300', plans: oggiAPs },
    { id: 'settimana', label: 'Questa settimana', headerBg: 'bg-yellow-100', headerText: 'text-yellow-700', border: 'border-yellow-300', plans: settimanaAPs },
    { id: 'prossime', label: `Prossimi ${calendarDays} giorni`, headerBg: 'bg-blue-100', headerText: 'text-blue-700', border: 'border-blue-300', plans: prossimeAPs },
  ]

  return (
    <div className="space-y-4">
      <div className="bg-white p-3 rounded-lg shadow-sm flex items-center gap-3 flex-wrap">
        <span className="text-xs font-medium text-gray-600 uppercase">Periodo "Prossimi giorni":</span>
        <div className="flex gap-1">
          {[7, 14, 30, 60, 90].map(d => (
            <button
              key={d}
              onClick={() => setCalendarDays(d)}
              className={`px-3 py-1 text-xs rounded ${calendarDays === d ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              {d}gg
            </button>
          ))}
        </div>
        <span className="text-xs text-gray-500 ml-auto">Solo AP attivi (esclusi Done/Chiuso e Annullati)</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {colonne.map(col => (
          <div key={col.id} className={`rounded-lg border-2 ${col.border} bg-white flex flex-col`}>
            <div className={`${col.headerBg} ${col.headerText} px-3 py-2 rounded-t-md font-semibold text-sm flex justify-between items-center`}>
              <span>{col.label}</span>
              <span className="bg-white bg-opacity-70 px-2 py-0.5 rounded-full text-xs font-bold">{col.plans.length}</span>
            </div>
            <div className="flex-1 p-2 space-y-2 overflow-y-auto" style={{ minHeight: '300px', maxHeight: '70vh' }}>
              {col.plans.length === 0 ? (
                <div className="text-center text-xs text-gray-400 py-8 italic">Nessun AP</div>
              ) : (
                col.plans.map(ap => <CalendarCard key={ap._id} ap={ap} onClick={() => onSelectAP?.(ap)} />)
              )}
            </div>
          </div>
        ))}
      </div>

      {senzaScadenza.length > 0 && (
        <div className="bg-gray-50 border-2 border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="font-bold text-gray-700">Senza scadenza o lontane</h3>
            <span className="text-xs bg-white px-2 py-0.5 rounded-full font-bold text-gray-700">{senzaScadenza.length}</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {senzaScadenza.map(ap => (
              <CalendarCard key={ap._id} ap={ap} onClick={() => onSelectAP?.(ap)} compact />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function CalendarCard({ ap, onClick, compact }) {
  const TipoIcon = TIPO_ICONS[ap.tipo] || CheckSquare
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-md p-3 shadow-sm border cursor-pointer hover:shadow-md transition-all ${compact ? 'opacity-80 hover:opacity-100' : ''}`}
    >
      <div className="flex justify-between items-start mb-1">
        <span className="font-mono text-xs text-primary font-bold">{ap.numero}</span>
        {ap.priorita && (
          <span className={`text-xs px-1.5 py-0.5 rounded ${PRIORITA_BG[ap.priorita] || ''}`}>{ap.priorita}</span>
        )}
      </div>
      <div className="font-medium text-sm mb-2 line-clamp-2">{ap.titolo}</div>
      {ap.tipo && (
        <div className={`flex items-center gap-1 text-xs mb-2 ${TIPO_COLORS[ap.tipo] || ''}`}>
          <TipoIcon size={12} />
          <span>{ap.tipo}</span>
        </div>
      )}
      {ap.parent_type && ap.parent_type !== 'standalone' && (
        <div className="mb-2"><CollegatoBadge ap={ap} /></div>
      )}
      <div className="flex justify-between items-center pt-2 border-t mt-2 text-xs">
        <Avatar name={ap.responsabile} size={20} showName={false} />
      </div>
      {ap.data_scadenza && (
        <div className="mt-2 pt-2 border-t flex items-center justify-between text-xs">
          <span className="text-gray-500">{new Date(ap.data_scadenza).toLocaleDateString('it-IT')}</span>
          {ap._giorniRitardo && ap._giorniRitardo > 0 && (
            <span className="text-red-600 font-bold">
              Da {ap._giorniRitardo} {ap._giorniRitardo === 1 ? 'giorno' : 'giorni'}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
