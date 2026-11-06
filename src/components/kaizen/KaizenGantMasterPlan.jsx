import { useState, useEffect, useRef } from 'react'
import api from '../../services/api'
import { Plus, Trash2 } from 'lucide-react'
import { MilestoneMarkers, ActivityInspector, withDeadlines, columnForDate } from './MajorPlanMilestones'

const ROW_TYPES = [
  { id: 'planned', label: 'Pianificato', color: '#2563eb' },
  { id: 'completed', label: 'Completato', color: '#10b981' },
]

// Granularità configurabile dall'utente
const GRANULARITIES = [
  { id: 'day', label: 'Giorno' },
  { id: 'week', label: 'Settimana' },
  { id: 'month', label: 'Mese' },
  { id: 'quarter', label: 'Trimestre' },
]

const ZOOM_LEVELS = [
  { id: 'compact', label: 'Compatto', factor: 0.72 },
  { id: 'normal', label: 'Normale', factor: 1 },
  { id: 'wide', label: 'Ampio', factor: 1.35 },
]

function getDefaultGantData() {
  const currentYear = new Date().getFullYear()
  const today = new Date().toISOString().slice(0, 10)

  return {
    steps: [
      { id: 's1', num: 1, label: 'Analisi del problema' },
      { id: 's2', num: 2, label: 'Implementazione contromisure' },
      { id: 's3', num: 3, label: 'Verifica e validazione' },
      { id: 's4', num: 4, label: 'Standardizzazione' },
    ],
    cells: {},
    start_year: currentYear,
    end_year: currentYear,
    start_date: today,
    duration_count: 12,
    granularity: 'month',
  }
}

// Genera le colonne in base alla granularità
function getWeekNumber(date) {
  const value = new Date(Date.UTC(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  ))

  const dayNumber = value.getUTCDay() || 7
  value.setUTCDate(value.getUTCDate() + 4 - dayNumber)

  const yearStart = new Date(Date.UTC(value.getUTCFullYear(), 0, 1))

  return Math.ceil((((value - yearStart) / 86400000) + 1) / 7)
}

function buildColumns(granularity, startDateValue, durationCount) {
  const cols = []
  const monthLabels = [
    'Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu',
    'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'
  ]

  const startDate = startDateValue
    ? new Date(`${startDateValue}T12:00:00`)
    : new Date()

  const count = Math.max(1, parseInt(durationCount) || 1)

  for (let index = 0; index < count; index++) {
    const date = new Date(startDate)

    if (granularity === 'day') {
      date.setDate(startDate.getDate() + index)

      cols.push({
        year: date.getFullYear(),
        period: date.toISOString().slice(0, 10),
        label: `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`,
        group: String(date.getFullYear()),
        fullDate: date.toISOString().slice(0, 10),
      })
    }

    if (granularity === 'week') {
      date.setDate(startDate.getDate() + (index * 7))

      cols.push({
        year: date.getFullYear(),
        period: `${date.getFullYear()}-W${getWeekNumber(date)}`,
        label: `W${getWeekNumber(date)}`,
        group: String(date.getFullYear()),
        fullDate: date.toISOString().slice(0, 10),
      })
    }

    if (granularity === 'month') {
      date.setMonth(startDate.getMonth() + index)

      cols.push({
        year: date.getFullYear(),
        period: `${date.getFullYear()}-${date.getMonth() + 1}`,
        label: monthLabels[date.getMonth()],
        group: String(date.getFullYear()),
        fullDate: date.toISOString().slice(0, 10),
      })
    }

    if (granularity === 'quarter') {
      date.setMonth(startDate.getMonth() + (index * 3))

      cols.push({
        year: date.getFullYear(),
        period: `${date.getFullYear()}-Q${Math.floor(date.getMonth() / 3) + 1}`,
        label: `Q${Math.floor(date.getMonth() / 3) + 1}`,
        group: String(date.getFullYear()),
        fullDate: date.toISOString().slice(0, 10),
      })
    }
  }

  return cols
}

// Raggruppa le colonne per anno (per il sub-header)
function groupColsByYear(columns) {
  const groups = {}
  columns.forEach(c => {
    if (!groups[c.group]) groups[c.group] = 0
    groups[c.group]++
  })
  return Object.entries(groups).map(([year, count]) => ({ year, count }))
}

/**
 * KaizenGantMasterPlan — Gant configurabile (settimana/mese/trimestre)
 */
export default function KaizenGantMasterPlan({ kaizen, onSaved, value, onChange, activities = null, onOpenActivityPhase, onRefreshActivities, activitiesLoading = false, activitiesError = '' }) {
  const isControlled = typeof onChange === 'function'
  const savedGant = isControlled ? (value || null) : (kaizen?.gant_master_plan || null)
  const [data, setData] = useState(savedGant || getDefaultGantData())
  const [editingStepId, setEditingStepId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [lastSaved, setLastSaved] = useState(null)
  const [dragState, setDragState] = useState(null)
  const [zoom, setZoom] = useState('normal')
  const [selectedActivityIds, setSelectedActivityIds] = useState(null)
  const [saveError, setSaveError] = useState('')
  const saveInFlight = useRef(false)
  const saveQueued = useRef(false)
  const dataRef = useRef(data)

  useEffect(() => { dataRef.current = data }, [data])

  useEffect(() => {
    const handleMouseUp = () => {
      if (dragState) {
        finishDrag()
      }
    }

    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [dragState])

  async function doSave(silent = false) {
    if (saveInFlight.current) { saveQueued.current = true; return }
    saveInFlight.current = true
    const snapshot = dataRef.current
    if (!silent) setSaving(true)
    setSaveError('')
    try {
      if (isControlled) {
        const result = await onChange(snapshot)
        if (result === false) throw new Error('Salvataggio rifiutato')
      } else {
        await api.put(`/kaizens/${kaizen._id}`, { gant_master_plan: snapshot })
        onSaved?.()
      }
      if (!silent) {
        setLastSaved(new Date())
        setHasUnsavedChanges(dataRef.current !== snapshot)
      }
    } catch (err) {
      setHasUnsavedChanges(true)
      setSaveError(typeof err.response?.data?.detail === 'string' ? err.response.data.detail : err.message || 'Salvataggio non riuscito')
    } finally {
      saveInFlight.current = false
      if (!silent) setSaving(false)
      if (saveQueued.current) { saveQueued.current = false; doSave(false) }
    }
  }

  // Auto-save debounced
  useEffect(() => {
    if (JSON.stringify(data) === JSON.stringify(savedGant || getDefaultGantData())) return
    setHasUnsavedChanges(true)
    const timer = setTimeout(() => doSave(false), 700)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  // CRUD celle / steps
  function getCellValue(stepId, rowType, year, period) {
    const key = `${stepId}_${rowType}_${year}_${period}`

    if (Object.prototype.hasOwnProperty.call(data.cells, key)) {
      return data.cells[key] === true
    }

    const legacyKey = `${stepId}_${year}_${period}`
    const legacyValue = data.cells[legacyKey] || 0

    if (rowType === 'planned') {
      return legacyValue === 1 || legacyValue === 2
    }

    return legacyValue === 2
  }

  function toggleCell(stepId, rowType, year, period) {
    const key = `${stepId}_${rowType}_${year}_${period}`

    setData(prev => {
      const currentValue = getCellValue(stepId, rowType, year, period)
      const newCells = { ...prev.cells }

      Reflect.set(newCells, key, !currentValue)

      return { ...prev, cells: newCells }
    })
  }
  function getStepInterval(step, rowType) {
  const interval = step?.[rowType]

  if (interval?.start && interval?.end) {
    return interval
  }

  const activeColumns = columns.filter(col =>
    getCellValue(step.id, rowType, col.year, col.period)
  )

  if (activeColumns.length === 0) {
    return {
      start: null,
      end: null,
    }
  }

  return {
    start: activeColumns[0].fullDate,
    end: activeColumns[activeColumns.length - 1].fullDate,
  }
}

function updateStepInterval(stepId, rowType, start, end) {
  setData(prev => ({
    ...prev,
    steps: prev.steps.map(step => {
      if (step.id !== stepId) return step

      const updatedStep = { ...step }

      Reflect.set(updatedStep, rowType, {
        start,
        end,
      })

      return updatedStep
    }),
  }))
}

function clearStepInterval(stepId, rowType) {
  updateStepInterval(stepId, rowType, null, null)
}

function findColumnIndexByDate(date) {
  if (!date) return -1

  const exactIndex = columns.findIndex(column => column.fullDate === date)

  if (exactIndex >= 0) {
    return exactIndex
  }

  return columns.findIndex((column, index) => {
    const nextColumn = columns[index + 1]

    if (!nextColumn) {
      return date >= column.fullDate
    }

    return date >= column.fullDate && date < nextColumn.fullDate
  })
}

function startDrag(step, rowType, columnIndex, event) {
  event.preventDefault()

  const interval = getStepInterval(step, rowType)
  const startIndex = findColumnIndexByDate(interval.start)
  const endIndex = findColumnIndexByDate(interval.end)
  const hasInterval = startIndex >= 0 && endIndex >= 0

  const mode =
    hasInterval &&
    columnIndex >= startIndex &&
    columnIndex <= endIndex
      ? 'move'
      : 'create'

  setDragState({
    stepId: step.id,
    rowType,
    mode,
    anchorIndex: columnIndex,
    currentIndex: columnIndex,
    originalStartIndex: hasInterval ? startIndex : columnIndex,
    originalEndIndex: hasInterval ? endIndex : columnIndex,
  })
}

function startResize(step, rowType, mode, event) {
  event.preventDefault()
  event.stopPropagation()

  const interval = getStepInterval(step, rowType)
  const startIndex = findColumnIndexByDate(interval.start)
  const endIndex = findColumnIndexByDate(interval.end)

  if (startIndex < 0 || endIndex < 0) return

  setDragState({
    stepId: step.id,
    rowType,
    mode,
    anchorIndex: mode === 'resize-start' ? startIndex : endIndex,
    currentIndex: mode === 'resize-start' ? startIndex : endIndex,
    originalStartIndex: startIndex,
    originalEndIndex: endIndex,
  })
}
  
function updateDrag(stepId, rowType, columnIndex) {
  setDragState(prev => {
    if (!prev) return prev
    if (prev.stepId !== stepId) return prev
    if (prev.rowType !== rowType) return prev

    return {
      ...prev,
      currentIndex: columnIndex,
    }
  })
}

function getDragIndexes(state) {
  if (!state) {
    return {
      startIndex: -1,
      endIndex: -1,
    }
  }

  if (state.mode === 'create') {
    return {
      startIndex: Math.min(state.anchorIndex, state.currentIndex),
      endIndex: Math.max(state.anchorIndex, state.currentIndex),
    }
  }

  if (state.mode === 'resize-start') {
    return {
      startIndex: Math.min(state.currentIndex, state.originalEndIndex),
      endIndex: state.originalEndIndex,
    }
  }

  if (state.mode === 'resize-end') {
    return {
      startIndex: state.originalStartIndex,
      endIndex: Math.max(state.currentIndex, state.originalStartIndex),
    }
  }

  const offset = state.currentIndex - state.anchorIndex
  const originalLength = state.originalEndIndex - state.originalStartIndex

  let startIndex = state.originalStartIndex + offset
  let endIndex = startIndex + originalLength

  if (startIndex < 0) {
    startIndex = 0
    endIndex = originalLength
  }

  if (endIndex >= columns.length) {
    endIndex = columns.length - 1
    startIndex = Math.max(0, endIndex - originalLength)
  }

  return {
    startIndex,
    endIndex,
  }
}

function finishDrag() {
  setDragState(currentDrag => {
    if (!currentDrag) return null

    const indexes = getDragIndexes(currentDrag)
    const firstColumn = columns[indexes.startIndex]
    const lastColumn = columns[indexes.endIndex]

    if (firstColumn && lastColumn) {
      updateStepInterval(
        currentDrag.stepId,
        currentDrag.rowType,
        firstColumn.fullDate,
        lastColumn.fullDate
      )
    }

    return null
  })
}

function getDisplayInterval(step, rowType) {
  if (
    dragState &&
    dragState.stepId === step.id &&
    dragState.rowType === rowType
  ) {
    const indexes = getDragIndexes(dragState)

    return {
      start: columns[indexes.startIndex]?.fullDate || null,
      end: columns[indexes.endIndex]?.fullDate || null,
    }
  }

  return getStepInterval(step, rowType)
}

function isColumnInInterval(column, interval) {
  if (!interval?.start || !interval?.end) return false

  return (
    column.fullDate >= interval.start &&
    column.fullDate <= interval.end
  )
}

function isTodayColumn(columnIndex) {
  const column = columns[columnIndex]
  const nextColumn = columns[columnIndex + 1]

  if (!column) return false

  if (!nextColumn) {
    return today >= column.fullDate
  }

  return today >= column.fullDate && today < nextColumn.fullDate
}

function getDelayStatus(step) {
  const planned = getStepInterval(step, 'planned')
  const completed = getStepInterval(step, 'completed')

  if (!planned?.end) return null

  if (completed?.end) {
    if (completed.end > planned.end) {
      return {
        label: 'Completato in ritardo',
        className: 'bg-orange-100 text-orange-700',
      }
    }

    return {
      label: 'Completato nei tempi',
      className: 'bg-green-100 text-green-700',
    }
  }

  if (today > planned.end) {
    return {
      label: 'In ritardo',
      className: 'bg-red-100 text-red-700',
    }
  }

  return {
    label: 'In corso',
    className: 'bg-blue-100 text-blue-700',
  }
}  
  
function getDurationLabel(interval) {
  if (!interval?.start || !interval?.end) return ''

  const start = new Date(`${interval.start}T12:00:00`)
  const end = new Date(`${interval.end}T12:00:00`)
  const days = Math.round((end - start) / 86400000) + 1

  if (granularity === 'day') {
    return `${days} giorni`
  }

  if (granularity === 'week') {
    const weeks = Math.max(1, Math.round(days / 7))
    return `${weeks} settimane`
  }

  if (granularity === 'month') {
    const months = Math.max(
      1,
      ((end.getFullYear() - start.getFullYear()) * 12)
        + end.getMonth()
        - start.getMonth()
        + 1
    )

    return `${months} mesi`
  }

  const quarters = Math.max(
    1,
    Math.round(
      (
        ((end.getFullYear() - start.getFullYear()) * 12)
        + end.getMonth()
        - start.getMonth()
      ) / 3
    ) + 1
  )

  return `${quarters} trimestri`
}
  function clearRow(stepId) {
    if (!confirm('Pulire pianificato e completato di questa attività?')) return

    setData(prev => {
      const newCells = { ...prev.cells }

      Object.keys(newCells).forEach(key => {
        if (key.startsWith(`${stepId}_`)) {
          delete newCells[key]
        }
      })

      return {
        ...prev,
        cells: newCells,
        steps: prev.steps.map(step => {
          if (step.id !== stepId) return step

          return {
            ...step,
            planned: {
              start: null,
              end: null,
            },
            completed: {
              start: null,
              end: null,
            },
          }
        }),
      }
    })
  }
  function updateStepLabel(stepId, newLabel) {
    setData(prev => ({
      ...prev,
      steps: prev.steps.map(s => s.id === stepId ? { ...s, label: newLabel } : s),
    }))
  }
  function addStep() {
  const newId = `s${Date.now()}`
  const newNum = data.steps.length + 1

  setData(prev => ({
    ...prev,
    steps: [
      ...prev.steps,
      {
        id: newId,
        num: newNum,
        label: `Step ${newNum}`,
        planned: {
          start: null,
          end: null,
        },
        completed: {
          start: null,
          end: null,
        },
      },
    ],
  }))
}
  function removeStep(stepId) {
    if (!confirm('Eliminare questo step e tutte le sue celle?')) return
    setData(prev => {
      const newCells = { ...prev.cells }
      Object.keys(newCells).forEach(k => {
        if (k.startsWith(`${stepId}_`)) delete newCells[k]
      })
      const filteredSteps = prev.steps.filter(s => s.id !== stepId)
      const renumbered = filteredSteps.map((s, i) => ({ ...s, num: i + 1 }))
      return { ...prev, steps: renumbered, cells: newCells }
    })
  }
  function moveStep(stepId, direction) {
    setData(prev => {
      const idx = prev.steps.findIndex(s => s.id === stepId)
      if (idx < 0) return prev
      const newIdx = direction === 'up' ? idx - 1 : idx + 1
      if (newIdx < 0 || newIdx >= prev.steps.length) return prev
      const newSteps = [...prev.steps]
      const tmp = newSteps[idx]
      newSteps[idx] = newSteps[newIdx]
      newSteps[newIdx] = tmp
      const renumbered = newSteps.map((s, i) => ({ ...s, num: i + 1 }))
      return { ...prev, steps: renumbered }
    })
  }
  function updateYearRange(field, value) {
    const v = parseInt(value) || 0
    if (v < 2000 || v > 2100) return
    setData(prev => ({ ...prev, [field]: v }))
  }
  function setGranularity(g) {
    const defaultDuration = g === 'day'
      ? 30
      : g === 'week'
        ? 17
        : g === 'month'
          ? 12
          : 4

    setData(prev => ({
      ...prev,
      granularity: g,
      duration_count: defaultDuration,
    }))
  }

  function setStartDate(value) {
    if (!value) return

    const selectedDate = new Date(`${value}T12:00:00`)

    setData(prev => ({
      ...prev,
      start_date: value,
      start_year: selectedDate.getFullYear(),
    }))
  }

  function setDurationCount(value) {
    const parsed = parseInt(value)

    if (isNaN(parsed)) return

    const maximum = granularity === 'day'
      ? 366
      : granularity === 'week'
        ? 104
        : granularity === 'month'
          ? 60
          : 20

    setData(prev => ({
      ...prev,
      duration_count: Math.min(Math.max(parsed, 1), maximum),
    }))
  }

  const granularity = data.granularity || 'month'
  const startDate = data.start_date || `${data.start_year || new Date().getFullYear()}-01-01`
  const durationCount = data.duration_count || (
    granularity === 'day'
      ? 30
      : granularity === 'week'
        ? 17
        : granularity === 'month'
          ? 12
          : 4
  )

  const columns = buildColumns(
    granularity,
    startDate,
    durationCount
  )

  const yearGroups = groupColsByYear(columns)

  const baseCellWidth = granularity === 'day'
    ? 42
    : granularity === 'week'
      ? 38
      : granularity === 'month'
        ? 54
        : 72

  const zoomFactor = ZOOM_LEVELS.find(level => level.id === zoom)?.factor || 1
  const CELL_WIDTH = Math.round(baseCellWidth * zoomFactor)
  const today = new Date().toISOString().slice(0, 10)
  const milestoneItems = withDeadlines(activities || [], data.activity_deadlines || {})
  const rowIds = new Set(data.steps.map(step => step.id))
  const withoutDate = milestoneItems.filter(item => !item.due)
  const withoutPhase = milestoneItems.filter(item => !item.stepId || !rowIds.has(item.stepId))
  const outside = milestoneItems.filter(item => item.due && columnForDate(item.due, columns, granularity) < 0)
  const updateDeadline = (id, date) => {
    setData(current => ({ ...current, activity_deadlines: { ...(current.activity_deadlines || {}), [id]: date } }))
  }

  return (
    <div className="w-full max-w-full min-w-0 overflow-hidden space-y-4">
      {/* Header config */}
      <div className="w-full max-w-full min-w-0 bg-white rounded-xl shadow p-4 overflow-hidden">
        <div className="flex justify-between items-start mb-3">
          <p className="text-xs text-gray-500">Pianificazione multi-anno per macro-fasi del Kaizen</p>
          <div className="flex items-center gap-3 text-xs">
            {saving ? <span className="text-blue-600">Salvataggio...</span> :
             hasUnsavedChanges ? <span className="text-orange-600 font-medium">Non salvato</span> :
             lastSaved ? <span className="text-green-600">Salvato {lastSaved.toLocaleTimeString('it-IT')}</span> :
             <span className="text-gray-400">Pronto</span>}
            <button
              onClick={() => doSave(false)}
              disabled={saving}
              className="bg-primary text-white px-3 py-1 rounded text-xs"
            >
              Salva ora
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end pt-3 border-t">
          {/* Granularità */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Granularità</label>
            <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
              {GRANULARITIES.map(g => (
                <button
                  key={g.id}
                  onClick={() => setGranularity(g.id)}
                  className={`flex-1 px-2 py-1 text-xs rounded-md transition-all ${
                    granularity === g.id
                      ? 'bg-white text-primary shadow-sm font-medium'
                      : 'text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          {/* Anno inizio */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Data iniziale</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full border rounded px-2 py-1 text-sm"
            />
          </div>

          {/* Anno fine */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Numero di {
                granularity === 'day'
                  ? 'giorni'
                  : granularity === 'week'
                    ? 'settimane'
                    : granularity === 'month'
                      ? 'mesi'
                      : 'trimestri'
              }
            </label>

            <input
              type="number"
              min="1"
              max={
                granularity === 'day'
                  ? 366
                  : granularity === 'week'
                    ? 104
                    : granularity === 'month'
                      ? 60
                      : 20
              }
              value={durationCount}
              onChange={(e) => setDurationCount(e.target.value)}
              className="w-full border rounded px-2 py-1 text-sm"
            />
          </div>

          {/* Aggiungi step */}
          <button
            onClick={addStep}
            className="bg-primary text-white px-3 py-1.5 rounded text-sm font-medium flex items-center justify-center gap-1"
          >
            <Plus size={14} /> Aggiungi step
          </button>
        </div>

        <div className="flex gap-3 mt-3 pt-3 border-t text-xs items-center flex-wrap">
          {ROW_TYPES.map(row => (
            <div key={row.id} className="flex items-center gap-1">
              <div className="w-4 h-4 border rounded" style={{ backgroundColor: row.color }} />
              <span>{row.label}</span>
            </div>
          ))}

          <div className="flex items-center gap-1 ml-4">
            <span className="font-medium text-gray-600">Zoom:</span>
            <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
              {ZOOM_LEVELS.map(level => (
                <button
                  key={level.id}
                  type="button"
                  onClick={() => setZoom(level.id)}
                  className={`px-2 py-1 rounded text-xs ${
                    zoom === level.id
                      ? 'bg-white text-primary font-medium shadow-sm'
                      : 'text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {level.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-1 ml-2">
            <div className="w-0.5 h-4 bg-red-500" />
            <span>Oggi</span>
          </div>

          <span className="ml-auto text-gray-500 italic">Trascina sul vuoto per creare, al centro per spostare, sui bordi per ridimensionare</span>
        </div>
      </div>

      {saveError && <p role="alert" className="text-sm text-red-700">Master Plan non salvato: {saveError}. Premi Salva ora per riprovare.</p>}
      {activities !== null && <div className="bg-white border rounded-lg p-3 text-xs space-y-2">
        <div className="flex flex-wrap gap-3 items-center">
          <span>Rombi: blu pianificato · verde completato · rosso scaduto · grigio respinto/annullato.</span>
          <button type="button" className="border rounded px-2 py-1" onClick={() => setSelectedActivityIds(milestoneItems.map(item => item.id))}>Attivita e scadenze ({milestoneItems.length})</button>
          <button type="button" disabled={activitiesLoading} className="border rounded px-2 py-1 disabled:opacity-50" onClick={onRefreshActivities}>{activitiesLoading ? 'Caricamento...' : 'Aggiorna attivita'}</button>
          {withoutDate.length > 0 && <button type="button" className="text-amber-800 underline" onClick={() => setSelectedActivityIds(withoutDate.map(item => item.id))}>Senza scadenza ({withoutDate.length})</button>}
          {outside.length > 0 && <button type="button" className="text-amber-800 underline" onClick={() => setSelectedActivityIds(outside.map(item => item.id))}>Fuori intervallo ({outside.length})</button>}
          {withoutPhase.length > 0 && <button type="button" className="text-amber-800 underline" onClick={() => setSelectedActivityIds(withoutPhase.map(item => item.id))}>Senza fase corrispondente ({withoutPhase.length})</button>}
        </div>
        <p>Ogni rombo indica la fine programmata nel periodo visualizzato. Il numero raggruppa piu attivita nella stessa colonna. Le date LPW non vengono inviate a CARL.</p>
        {activitiesError && <p role="alert" className="text-red-700">{activitiesError}</p>}
      </div>}
      {selectedActivityIds !== null && <ActivityInspector items={milestoneItems.filter(item => selectedActivityIds.includes(item.id))} onClose={() => setSelectedActivityIds(null)} onOpenPhase={onOpenActivityPhase} onDeadlineChange={updateDeadline} />}

      {/* Griglia Gant */}
      <div className="w-full max-w-full min-w-0 bg-white rounded-xl shadow overflow-hidden">
        <div
          className="block w-full max-w-full min-w-0 overflow-x-auto overflow-y-hidden overscroll-x-contain"
          style={{
            WebkitOverflowScrolling: 'touch',
            scrollbarGutter: 'stable',
          }}
        >
          <div
            className="inline-block align-top"
            style={{
              width: columns.length * CELL_WIDTH + 432,
              minWidth: columns.length * CELL_WIDTH + 432,
            }}
          >
          {/* Header anni */}
          <div className="flex border-b bg-primary text-white sticky top-0 z-10">
            <div className="w-12 px-2 py-2 text-xs font-bold text-center border-r border-blue-700"></div>
            <div className="w-80 px-3 py-2 text-xs font-bold border-r border-blue-700">Step macro</div>
            <div className="w-20 px-1 py-2 text-xs font-bold text-center border-r border-blue-700">Azioni</div>
            {yearGroups.map((yg, i) => (
              <div
                key={i}
                className="border-r border-blue-700 text-center font-bold text-xs py-2"
                style={{ width: yg.count * CELL_WIDTH }}
              >
                {yg.year}
              </div>
            ))}
          </div>

          {/* Header periodi */}
          <div className="flex border-b bg-gray-50">
            <div className="w-12 border-r" />
            <div className="w-80 border-r" />
            <div className="w-20 border-r" />
            {columns.map((col, ci) => {
              const current = isTodayColumn(ci)

              return (
                <div
                  key={ci}
                  className={`relative border-r flex flex-col items-center justify-center text-[10px] py-1 ${
                    current
                      ? 'bg-red-50 text-red-700 font-bold'
                      : 'text-gray-500'
                  }`}
                  style={{
                    width: CELL_WIDTH,
                    minWidth: CELL_WIDTH,
                    borderLeft: current
                      ? '2px solid #ef4444'
                      : undefined,
                  }}
                >
                  {col.label}

                  {current && (
                    <span className="absolute -top-1 left-0 w-2 h-2 bg-red-500 rotate-45 -translate-x-1" />
                  )}
                </div>
              )
            })}
          </div>

          {/* Righe steps */}
          {data.steps.map((step, idx) => (
            <div key={step.id} className="flex border-b hover:bg-gray-50">
              <div className="w-12 px-2 py-2 text-sm font-bold text-center border-r flex items-center justify-center bg-blue-50 text-primary">
                {step.num}
              </div>

              <div className="w-80 px-2 py-1 border-r flex items-center">
                {editingStepId === step.id ? (
                  <input
                    autoFocus
                    value={step.label}
                    onChange={(e) => updateStepLabel(step.id, e.target.value)}
                    onBlur={() => setEditingStepId(null)}
                    onKeyDown={(e) => e.key === 'Enter' && setEditingStepId(null)}
                    className="w-full border rounded px-2 py-1 text-xs"
                  />
                ) : (
                   <div
                    onClick={() => setEditingStepId(step.id)}
                    className="text-xs cursor-pointer hover:bg-yellow-50 px-2 py-1 rounded w-full"
                    title="Click per modificare"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate">{step.label}</span>

                      {getDelayStatus(step) && (
                        <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-[9px] font-bold ${getDelayStatus(step).className}`}>
                          {getDelayStatus(step).label}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="w-20 px-1 border-r flex items-center justify-center gap-0.5">
                <button
                  onClick={() => moveStep(step.id, 'up')}
                  disabled={idx === 0}
                  className="text-xs px-1 hover:bg-gray-200 rounded disabled:opacity-30"
                  title="Sposta su"
                >
                  ▲
                </button>

                <button
                  onClick={() => moveStep(step.id, 'down')}
                  disabled={idx === data.steps.length - 1}
                  className="text-xs px-1 hover:bg-gray-200 rounded disabled:opacity-30"
                  title="Sposta giù"
                >
                  ▼
                </button>

                <button
                  onClick={() => clearRow(step.id)}
                  className="text-xs px-1 hover:bg-yellow-100 rounded text-yellow-600"
                  title="Pulisci riga"
                >
                  ⌫
                </button>

                <button
                  onClick={() => removeStep(step.id)}
                  className="p-0.5 hover:bg-red-100 rounded text-red-600"
                  title="Elimina step"
                >
                  <Trash2 size={11} />
                </button>
              </div>

              <div className="relative flex flex-col select-none">
                {activities !== null && <MilestoneMarkers items={milestoneItems} stepId={step.id} columns={columns} granularity={granularity} cellWidth={CELL_WIDTH} today={today} onSelect={setSelectedActivityIds} />}
                {ROW_TYPES.map(row => {
                  const interval = getDisplayInterval(step, row.id)
                  const durationLabel = getDurationLabel(interval)

                  return (
                    <div
                      key={row.id}
                      className={`flex ${row.id === 'planned' ? 'border-b' : ''}`}
                    >
                      {columns.map((col, columnIndex) => {
                        const active = isColumnInInterval(col, interval)
                        const isStart = active && col.fullDate === interval?.start
                        const isEnd = active && col.fullDate === interval?.end
                        const current = isTodayColumn(columnIndex)

                        const currentOperation =
                          dragState?.stepId === step.id &&
                          dragState?.rowType === row.id
                            ? dragState.mode
                            : null

                        return (
                          <button
                            key={`${row.id}_${columnIndex}`}
                            type="button"
                            onMouseDown={(event) => startDrag(
                              step,
                              row.id,
                              columnIndex,
                              event
                            )}
                            onMouseEnter={() => updateDrag(
                              step.id,
                              row.id,
                              columnIndex
                            )}
                            className="relative border-r transition-opacity hover:opacity-90"
                            style={{
                              width: CELL_WIDTH,
                              minWidth: CELL_WIDTH,
                              height: '26px',
                              borderRightColor: active
                                ? row.color
                                : undefined,
                              borderTopLeftRadius: isStart
                                ? '6px'
                                : '0',
                              borderBottomLeftRadius: isStart
                                ? '6px'
                                : '0',
                              borderTopRightRadius: isEnd
                                ? '6px'
                                : '0',
                              borderBottomRightRadius: isEnd
                                ? '6px'
                                : '0',
                                                            cursor: active
                                ? 'grab'
                                : 'crosshair',
                              borderLeft: current
                                ? '2px solid #ef4444'
                                : undefined,
                              backgroundColor: active
                                ? row.color
                                : current
                                  ? '#fef2f2'
                                  : 'transparent',
                            }}
                            title={
                              active
                                ? `${row.label}: ${interval.start} - ${interval.end} (${durationLabel})`
                                : `${row.label}: trascina per creare`
                            }
                          >
                            {isStart && active && (
                              <span
                                onMouseDown={(event) => startResize(
                                  step,
                                  row.id,
                                  'resize-start',
                                  event
                                )}
                                className="absolute left-0 top-0 bottom-0 w-2.5 bg-white bg-opacity-80 rounded-l cursor-w-resize z-10"
                                title="Trascina per modificare la data iniziale"
                              />
                            )}

                            {isEnd && active && (
                              <span
                                onMouseDown={(event) => startResize(
                                  step,
                                  row.id,
                                  'resize-end',
                                  event
                                )}
                                className="absolute right-0 top-0 bottom-0 w-2.5 bg-white bg-opacity-80 rounded-r cursor-e-resize z-10"
                                title="Trascina per modificare la data finale"
                              />
                            )}

                            {isStart && active && (
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[8px] font-bold text-white whitespace-nowrap pointer-events-none z-0">
                                {durationLabel}
                              </span>
                            )}

                            {currentOperation && active && (
                              <span className="absolute inset-0 ring-2 ring-yellow-300 ring-inset pointer-events-none z-20" />
                            )}
                          </button>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          {data.steps.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <p>Nessuno step. Aggiungi il primo!</p>
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  )
}
