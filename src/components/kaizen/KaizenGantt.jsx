import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import api from '../../services/api'
import { Plus, X, ChevronLeft, ChevronRight } from 'lucide-react'
import ActionPlanFormShared from '../ActionPlanFormShared'

// Configurazioni viste
const VIEWS = [
  { id: 'week',  label: 'Settimana', unitMs: 7 * 24 * 60 * 60 * 1000 },
  { id: 'month', label: 'Mese',      unitMs: 30 * 24 * 60 * 60 * 1000 },
  { id: 'year',  label: 'Anno',      unitMs: 365 * 24 * 60 * 60 * 1000 },
]

const CELL_WIDTH = 60 // larghezza di base di una cella in pixel
const ROW_HEIGHT = 48

// Colori per stato AP
function getColorForAP(ap) {
  if (ap.is_cancelled) return { bg: '#9ca3af', label: 'Annullato' }       // grigio
  if (ap.stato === 'Done') return { bg: '#10b981', label: 'Done' }        // verde
  if (ap.stato_visuale === 'In Ritardo') return { bg: '#ef4444', label: 'In Ritardo' } // rosso
  if (ap.stato === 'In Corso') return { bg: '#f59e0b', label: 'In Corso' } // arancione
  if (ap.stato === 'In Verifica') return { bg: '#8b5cf6', label: 'In Verifica' } // viola
  return { bg: '#3b82f6', label: 'Aperto' }                              // blu default
}

// Funzioni date
function formatDate(d) {
  if (!d) return '—'
  const date = new Date(d)
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`
}

function isoString(d) {
  return new Date(d).toISOString()
}

// Costruisce la lista delle "colonne" temporali in base alla vista
function buildColumns(view, year) {
  const cols = []
  if (view === 'week') {
    // 52 settimane dell'anno
    const startOfYear = new Date(year, 0, 1)
    for (let w = 0; w < 52; w++) {
      const start = new Date(startOfYear.getTime() + w * 7 * 24 * 60 * 60 * 1000)
      const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000 - 1)
      cols.push({
        label: `W${w + 1}`,
        sublabel: `${String(start.getDate()).padStart(2, '0')}/${String(start.getMonth() + 1).padStart(2, '0')}`,
        start,
        end,
      })
    }
  } else if (view === 'month') {
    // 12 mesi
    for (let m = 0; m < 12; m++) {
      const start = new Date(year, m, 1)
      const end = new Date(year, m + 1, 0, 23, 59, 59) // ultimo giorno del mese
      cols.push({
        label: ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'][m],
        sublabel: String(year).slice(-2),
        start,
        end,
      })
    }
  } else {
    // year: 5 anni (current ± 2)
    for (let y = year - 2; y <= year + 2; y++) {
      cols.push({
        label: String(y),
        sublabel: '',
        start: new Date(y, 0, 1),
        end: new Date(y, 11, 31, 23, 59, 59),
      })
    }
  }
  return cols
}

// Calcola posizione/larghezza in pixel di una barra in base alle date e alle colonne
function getBarPosition(ap, columns) {
  if (!ap.data_inizio || !ap.data_scadenza) return null
  const start = new Date(ap.data_inizio)
  const end = new Date(ap.data_scadenza)
  if (end < columns[0].start || start > columns[columns.length - 1].end) return null // fuori range

  const totalRangeMs = columns[columns.length - 1].end.getTime() - columns[0].start.getTime()
  const totalPx = columns.length * CELL_WIDTH

  const startOffsetMs = Math.max(0, start.getTime() - columns[0].start.getTime())
  const endOffsetMs = Math.min(totalRangeMs, end.getTime() - columns[0].start.getTime())

  const x = (startOffsetMs / totalRangeMs) * totalPx
  const width = Math.max(20, ((endOffsetMs - startOffsetMs) / totalRangeMs) * totalPx)

  return { x, width }
}

// ──────────────────────────────────────────────────────────
// MAIN COMPONENT
// ──────────────────────────────────────────────────────────
export default function KaizenGantt({ kaizenId, kaizenNumero, parent = null, phases = [] }) {
  const isMajor = Boolean(parent)
  const phaseById = Object.fromEntries(phases.map(phase => [phase.step_id, phase]))
  const [actionPlans, setActionPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('week')
  const [year, setYear] = useState(new Date().getFullYear())
  const [editingAP, setEditingAP] = useState(null)
  const [showForm, setShowForm] = useState(false)

  // Drag state
  const [dragging, setDragging] = useState(null)
  // { apId, mode: 'move' | 'resize-right' | 'resize-left', startX, originalStart, originalEnd }

  const containerRef = useRef(null)
  const plansRef = useRef([])
  const movedRef = useRef(false)
  const yearSetRef = useRef(false)

  const columns = useMemo(() => buildColumns(view, year), [view, year])
  const totalWidth = columns.length * CELL_WIDTH

  // Carica gli AP del Kaizen
  const loadAP = useCallback(async () => {
    setLoading(true)
    try {
      let list
      if (isMajor) {
        const res = await api.get('/action-plans/', { params: { parent_id: parent.parent_id } })
        list = (res.data || [])
          .filter(ap => ap.parent_type === parent.parent_type && ap.parent_id === parent.parent_id)
          .sort((a, b) => new Date(a.data_inizio || a.data_scadenza || 0) - new Date(b.data_inizio || b.data_scadenza || 0))
        const first = list.find(ap => ap.data_inizio || ap.data_scadenza)
        if (first && !yearSetRef.current) {
          yearSetRef.current = true
          setYear(new Date(first.data_inizio || first.data_scadenza).getFullYear())
        }
      } else {
        const res = await api.get(`/kaizens/${kaizenId}/action-plans`)
        list = res.data || []
      }
      setActionPlans(list)
    } catch (err) {
      console.error('Errore caricamento AP:', err)
    } finally {
      setLoading(false)
    }
  }, [kaizenId, isMajor, parent?.parent_id, parent?.parent_type])

  useEffect(() => { loadAP() }, [loadAP])
  useEffect(() => { plansRef.current = actionPlans }, [actionPlans])

  // ──────────────────────────────────────────
  // DRAG: gestione mouse
  // ──────────────────────────────────────────
  function startDrag(e, ap, mode) {
    e.preventDefault()
    e.stopPropagation()
    if (!ap.data_inizio || !ap.data_scadenza) return
    movedRef.current = false
    setDragging({
      apId: ap._id,
      mode,
      startX: e.clientX,
      originalStart: new Date(ap.data_inizio),
      originalEnd: new Date(ap.data_scadenza),
    })
  }

  useEffect(() => {
    if (!dragging) return

    const onMove = (e) => {
      const deltaX = e.clientX - dragging.startX
      if (Math.abs(deltaX) > 3) movedRef.current = true
      const totalRangeMs = columns[columns.length - 1].end.getTime() - columns[0].start.getTime()
      const deltaMs = (deltaX / totalWidth) * totalRangeMs

      setActionPlans(prev =>
        prev.map(ap => {
          if (ap._id !== dragging.apId) return ap
          let newStart = new Date(dragging.originalStart.getTime())
          let newEnd = new Date(dragging.originalEnd.getTime())

          if (dragging.mode === 'move') {
            newStart = new Date(dragging.originalStart.getTime() + deltaMs)
            newEnd = new Date(dragging.originalEnd.getTime() + deltaMs)
          } else if (dragging.mode === 'resize-right') {
            newEnd = new Date(dragging.originalEnd.getTime() + deltaMs)
            // non permettere fine < inizio
            if (newEnd <= newStart) newEnd = new Date(newStart.getTime() + 24 * 60 * 60 * 1000)
          } else if (dragging.mode === 'resize-left') {
            newStart = new Date(dragging.originalStart.getTime() + deltaMs)
            // non permettere inizio > fine
            if (newStart >= newEnd) newStart = new Date(newEnd.getTime() - 24 * 60 * 60 * 1000)
          }

          return { ...ap, data_inizio: newStart.toISOString(), data_scadenza: newEnd.toISOString() }
        })
      )
    }

    const onUp = async () => {
      // Salvataggio finale al backend
      const ap = plansRef.current.find(a => a._id === dragging.apId)
      if (ap && movedRef.current) {
        try {
          await api.put(`/action-plans/${ap._id}`, {
            data_inizio: ap.data_inizio,
            data_scadenza: ap.data_scadenza,
          })
        } catch (err) {
          console.error('Errore salvataggio drag:', err)
          alert('Errore salvataggio: ' + (err.response?.data?.detail || err.message))
          loadAP() // ricarica da DB se errore
        }
      }
      setDragging(null)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging, columns, totalWidth])

  // ──────────────────────────────────────────
  // Creazione nuovo AP
  // ──────────────────────────────────────────
  async function handleNewAP() {
    if (isMajor) {
      setEditingAP(null)
      setShowForm(true)
      return
    }
    // Crea subito un AP "vuoto" con date di default e responsabile placeholder
    const today = new Date()
    const inDays14 = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000)
    try {
      const res = await api.post('/action-plans/', {
        titolo: 'Nuovo task',
        kaizen_id: kaizenId,
        parent_type: 'kaizen',
        parent_id: kaizenId,
        data_inizio: today.toISOString(),
        data_scadenza: inDays14.toISOString(),
      })
      // Aggiorna la lista e apri subito la modal per modificare il titolo
      await loadAP()
      setEditingAP(res.data)
      setShowForm(true)
    } catch (err) {
      console.error('Errore creazione AP:', err)
      alert('Errore: ' + (err.response?.data?.detail || err.message))
    }
  }

  // ──────────────────────────────────────────
  // Today line position
  // ──────────────────────────────────────────
  const todayLinePosition = useMemo(() => {
    const today = new Date()
    if (today < columns[0].start || today > columns[columns.length - 1].end) return null
    const totalRangeMs = columns[columns.length - 1].end.getTime() - columns[0].start.getTime()
    const offsetMs = today.getTime() - columns[0].start.getTime()
    return (offsetMs / totalRangeMs) * totalWidth
  }, [columns, totalWidth])

  const visiblePlans = isMajor && phases.length
    ? [...actionPlans].sort((a, b) => (phaseById[a.gant_step_id]?.ordine ?? 99) - (phaseById[b.gant_step_id]?.ordine ?? 99))
    : actionPlans

  if (loading) {
    return <div className="bg-white rounded-xl shadow p-12 text-center text-gray-400">Caricamento Gantt...</div>
  }

  return (
    <div className="space-y-3">
      {/* TOOLBAR */}
      <div className="bg-white rounded-xl shadow p-3 flex flex-wrap items-center gap-3">
        {/* Toggle vista */}
        <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
          {VIEWS.map(v => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className={`px-3 py-1 text-sm rounded-md transition-all ${
                view === v.id
                  ? 'bg-white text-primary shadow-sm font-medium'
                  : 'text-gray-600 hover:bg-gray-200'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>

        {/* Selettore anno */}
        <div className="flex items-center gap-1">
          <button onClick={() => setYear(y => y - 1)} className="p-1 hover:bg-gray-100 rounded">
            <ChevronLeft size={16} />
          </button>
          <span className="px-3 font-bold text-gray-700">{year}</span>
          <button onClick={() => setYear(y => y + 1)} className="p-1 hover:bg-gray-100 rounded">
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Stats */}
        <div className="text-xs text-gray-500 ml-auto">
          {actionPlans.length} task · {actionPlans.filter(a => a.stato === 'Done').length} completati
        </div>

        {/* Pulsante crea AP */}
        <button
          onClick={handleNewAP}
          className="bg-primary text-white px-3 py-1.5 rounded-lg text-sm flex items-center gap-1 hover:bg-primary-light"
        >
          <Plus size={14} /> Nuovo task
        </button>
      </div>

      {/* GANTT */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        {actionPlans.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <p className="mb-3">Nessun Action Plan ancora in questo {isMajor ? 'progetto' : 'Kaizen'}</p>
            <button onClick={handleNewAP} className="text-primary hover:underline text-sm">
              + Crea il primo task
            </button>
          </div>
        ) : (
          <div className="flex">
            {/* Lista task (sinistra, fissa) */}
            <div className="w-80 flex-shrink-0 border-r bg-white">
              <div className="h-14 bg-gray-50 border-b flex items-center px-4 font-bold text-sm uppercase text-gray-600">
                Action Plan
              </div>
              {visiblePlans.map((ap, idx) => (
                <div
                  key={ap._id}
                  className="border-b px-3 py-2 hover:bg-gray-50 cursor-pointer"
                  style={{ height: ROW_HEIGHT }}
                  onClick={() => { setEditingAP(ap); setShowForm(true) }}
                >
                  <div className="text-xs font-mono text-primary font-bold">
                    {ap.numero}
                    {phaseById[ap.gant_step_id] && (
                      <span className="ml-2 font-sans font-normal text-gray-500">Fase {phaseById[ap.gant_step_id].ordine} · {phaseById[ap.gant_step_id].titolo}</span>
                    )}
                  </div>
                  <div className="text-sm font-medium truncate">{ap.titolo}</div>
                  {ap.responsabile && (
                    <div className="text-[10px] text-gray-500 truncate">{ap.responsabile}</div>
                  )}
                </div>
              ))}
            </div>

            {/* Griglia temporale (destra, scrollabile) */}
            <div className="flex-1 overflow-x-auto" ref={containerRef}>
              <div style={{ width: totalWidth, minWidth: totalWidth, position: 'relative' }}>
                {/* Header colonne */}
                <div className="h-14 bg-gray-50 border-b flex">
                  {columns.map((col, idx) => (
                    <div
                      key={idx}
                      className="border-r flex flex-col items-center justify-center text-xs font-medium text-gray-600"
                      style={{ width: CELL_WIDTH, minWidth: CELL_WIDTH }}
                    >
                      <div className="font-bold">{col.label}</div>
                      {col.sublabel && (
                        <div className="text-[10px] text-gray-400">{col.sublabel}</div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Righe + barre */}
                <div className="relative">
                  {visiblePlans.map((ap, idx) => {
                    const pos = getBarPosition(ap, columns)
                    const color = getColorForAP(ap)
                    return (
                      <div
                        key={ap._id}
                        className="border-b relative"
                        style={{ height: ROW_HEIGHT }}
                      >
                        {/* Sfondo a celle */}
                        <div className="absolute inset-0 flex">
                          {columns.map((col, ci) => (
                            <div
                              key={ci}
                              className="border-r"
                              style={{ width: CELL_WIDTH, minWidth: CELL_WIDTH }}
                            />
                          ))}
                        </div>

                        {/* Barra dell'AP */}
                        {pos && (
                          <div
                            className="absolute top-1.5 rounded shadow-sm flex items-center group select-none"
                            style={{
                              left: pos.x,
                              width: pos.width,
                              height: ROW_HEIGHT - 12,
                              backgroundColor: color.bg,
                              cursor: dragging?.apId === ap._id ? 'grabbing' : 'grab',
                              opacity: ap.is_cancelled ? 0.5 : 1,
                            }}
                            onMouseDown={(e) => startDrag(e, ap, 'move')}
                            onClick={(e) => {
                              if (movedRef.current) {
                                movedRef.current = false
                                e.stopPropagation()
                                return
                              }
                              if (!dragging) {
                                e.stopPropagation()
                                setEditingAP(ap)
                                setShowForm(true)
                              }
                            }}
                            title={`${ap.titolo}\nDal: ${formatDate(ap.data_inizio)} - Al: ${formatDate(ap.data_scadenza)}`}
                          >
                            {/* Resize handle sinistro */}
                            <div
                              className="w-1.5 h-full cursor-ew-resize opacity-0 group-hover:opacity-100 bg-black bg-opacity-30 rounded-l flex-shrink-0"
                              onMouseDown={(e) => startDrag(e, ap, 'resize-left')}
                              onClick={(e) => e.stopPropagation()}
                            />

                            {/* Testo nella barra */}
                            <div className="px-2 text-xs text-white font-medium truncate flex-1 pointer-events-none">
                              {ap.titolo}
                            </div>

                            {/* Resize handle destro */}
                            <div
                              className="w-1.5 h-full cursor-ew-resize opacity-0 group-hover:opacity-100 bg-black bg-opacity-30 rounded-r flex-shrink-0"
                              onMouseDown={(e) => startDrag(e, ap, 'resize-right')}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        )}

                        {/* Placeholder se non ci sono date o fuori range */}
                        {!pos && (
                          <div
                            className="absolute inset-0 flex items-center px-3 cursor-pointer hover:bg-yellow-50"
                            onClick={() => { setEditingAP(ap); setShowForm(true) }}
                          >
                            <span className="text-xs text-gray-500 italic">
                              {(!ap.data_inizio || !ap.data_scadenza)
                                ? 'Date non impostate — click qui per impostarle'
                                : `Fuori range visualizzato (${formatDate(ap.data_inizio)} - ${formatDate(ap.data_scadenza)})`}
                            </span>
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {/* Linea OGGI */}
                  {todayLinePosition !== null && (
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-red-500 pointer-events-none"
                      style={{ left: todayLinePosition }}
                    >
                      <div className="absolute -top-5 left-1/2 transform -translate-x-1/2 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded">
                        Oggi
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Legenda */}
      <div className="bg-white rounded-xl shadow p-3 flex flex-wrap gap-4 text-xs">
        <span className="text-gray-600 font-medium">Legenda:</span>
        <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded" style={{backgroundColor: '#3b82f6'}}/>Aperto</span>
        <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded" style={{backgroundColor: '#f59e0b'}}/>In Corso</span>
        <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded" style={{backgroundColor: '#8b5cf6'}}/>In Verifica</span>
        <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded" style={{backgroundColor: '#10b981'}}/>Done</span>
        <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded" style={{backgroundColor: '#ef4444'}}/>In Ritardo</span>
        <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded" style={{backgroundColor: '#9ca3af'}}/>Annullato</span>
        <span className="text-gray-500 ml-auto italic">
          Trascina le barre per spostare · Bordo per ridimensionare · Click per modificare
        </span>
      </div>

      {/* Modal form AP */}
      {showForm && (
        <ActionPlanFormShared
          plan={editingAP?._id ? editingAP : null}
          prefilledKaizen={!isMajor && !editingAP?._id ? { kaizen_id: kaizenId, kaizen_numero: kaizenNumero } : null}
          prefilledParent={isMajor && !editingAP?._id ? parent : null}
          onClose={() => { setShowForm(false); setEditingAP(null) }}
          onSaved={() => { setShowForm(false); setEditingAP(null); loadAP() }}
        />
      )}
    </div>
  )
}
