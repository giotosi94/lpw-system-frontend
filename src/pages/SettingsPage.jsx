import React, { useState, useEffect } from 'react'
import { Settings, Plus, Edit2, Trash2, Eye, EyeOff, X, Save, Search, GripVertical, ChevronRight, ChevronDown, Info, Factory, Cpu, Upload, Copy, CopyPlus } from 'lucide-react'
import api from '../services/api'
import UserPicker from '../components/UserPicker'

const SECTIONS = [
  {
    id: 'struttura',
    label: 'Struttura Aziendale',
    color: 'indigo',
    tabs: [
      {
        id: 'pillars',
        label: 'Pillars',
        color: 'indigo',
        isPillar: true,
        description: 'Pilastri TPM Lindt (FI, AM, PM, QM, ecc.)',
        usedIn: ['Kaizen', '5 Step KPI Management', 'Master Plan', 'Action Plan (transitivo)'],
      },
      {
        id: 'reparti_linee',
        label: 'Reparti / Linee / Macchine',
        color: 'indigo',
        isRepartiTree: true,
        description: 'Struttura gerarchica della fabbrica (3 livelli)',
        usedIn: ['Action Plan', 'Kaizen', 'Documenti', 'Filtri'],
      },
    ],
  },
  {
    id: 'action_plan',
    label: 'Action Plan',
    color: 'green',
    tabs: [
      {
        id: 'tipi_action_plan',
        label: 'Tipo',
        color: 'green',
        description: 'Tipologia funzionale dell\'Action Plan',
        usedIn: ['Form Action Plan (campo "Tipo")', 'Filtri /action-plan'],
      },
      {
        id: 'priorita_ap',
        label: 'Priorita',
        color: 'green',
        description: 'Livelli di priorita per l\'Action Plan',
        usedIn: ['Form Action Plan (campo "Priorita")', 'Filtri /action-plan', 'Kanban color'],
      },
      {
        id: 'stato_ap',
        label: 'Stato',
        color: 'green',
        description: 'Stati del flusso di lavoro Action Plan',
        usedIn: ['Form Action Plan', 'Kanban board', 'Filtri'],
      },
    ],
  },
  {
    id: 'kaizen',
    label: 'Kaizen',
    color: 'red',
    tabs: [
      {
        id: 'categorie_perdita',
        label: 'Categoria Perdita (TPM)',
        color: 'red',
        description: 'Le 6 grandi perdite TPM, condivisa Kaizen + Action Plan',
        usedIn: ['Kaizen (Ishikawa)', 'Action Plan', 'Step 2 Pareto Pillar'],
      },
      {
        id: 'cluster_perdita',
        label: 'Cluster di Perdita',
        color: 'red',
        description: 'Raggruppamenti di perdite (es. Colatrice, Temperatrice, ORM). Usati nel Pareto del Pillar.',
        usedIn: ['Step 2 Pareto Pillar', 'Bridge Chart Step 3', 'Close the Loop Step 5'],
      },
      {
        id: 'argomenti',
        label: 'Argomenti / Tag',
        color: 'pink',
        description: 'Tag trasversali per hashtag in Kaizen e Action Plan',
        usedIn: ['Kaizen (hashtag)', 'Action Plan (tag)', 'Ricerca globale'],
      },
    ],
  },
  {
    id: 'documenti',
    label: 'Documenti',
    color: 'purple',
    tabs: [
      {
        id: 'categorie_documento',
        label: 'Categorie Documenti',
        color: 'purple',
        description: 'Categorizzazione dei documenti OPL/SOP/WI',
        usedIn: ['Documenti', 'Filtri Document Manager'],
      },
    ],
  },
  {
    id: 'meetings',
    label: 'Meetings',
    color: 'orange',
    tabs: [
      {
        id: 'tipi_meeting',
        label: 'Tipi di Meeting',
        color: 'orange',
        description: 'Tipologie configurabili di Meeting/Dashboard (es. PCS Daily, Steering, Weekly Review)',
        usedIn: ['Form Nuova Dashboard', 'Filtri Meetings'],
      },
    ],
  },
  {
    id: 'segnalazioni',
    label: 'Segnalazioni',
    color: 'red',
    tabs: [
      {
        id: 'categoria_segnalazione_sicurezza',
        label: 'Categorie Sicurezza',
        color: 'red',
        description: 'Categorie configurabili per le segnalazioni di sicurezza (es. Rischio meccanico, Caduta, Elettrico, DPI)',
        usedIn: ['Form Segnalazione Sicurezza (campo "Categoria")'],
      },
      {
        id: 'categoria_segnalazione_ambiente',
        label: 'Categorie Ambiente',
        color: 'green',
        description: 'Categorie configurabili per le segnalazioni di ambiente (es. Sversamento, Rifiuti, Emissioni, Rumore)',
        usedIn: ['Form Segnalazione Ambiente (campo "Categoria")'],
      },
    ],
  },
]

const TAB_ACTIVE = 'bg-primary bg-opacity-10 text-primary border-primary'

const SECTION_BG = 'bg-gray-50'

const ALL_TABS = SECTIONS.flatMap(s => s.tabs)

export default function SettingsPage() {
  const [activeTabId, setActiveTabId] = useState(ALL_TABS[0].id)
  const [stats, setStats] = useState({})

  useEffect(() => { loadStats() }, [])

  async function loadStats() {
    try {
      const res = await api.get('/configurazioni/stats')
      setStats(res.data)
    } catch (err) { console.error(err) }
  }

  const currentTab = ALL_TABS.find(t => t.id === activeTabId)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings size={28} /> Settings
        </h1>
        <p className="text-gray-500 text-sm">
          Configura tutte le voci di sistema raggruppate per dominio
        </p>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 md:col-span-3 lg:col-span-3">
          <div className="bg-white rounded-lg shadow-sm overflow-hidden sticky top-4">
            {SECTIONS.map(section => (
              <div key={section.id} className="border-b last:border-b-0">
                <div className={`px-3 py-2 ${SECTION_BG} border-l-4 border-gray-300`}>
                  <div className="text-xs font-bold uppercase tracking-wide text-gray-600">
                    {section.label}
                  </div>
                </div>
                <div className="py-1">
                  {section.tabs.map(tab => {
                    const isActive = activeTabId === tab.id
                    const count = stats[tab.id]?.attive || 0
                    const totale = stats[tab.id]?.totale || 0
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTabId(tab.id)}
                        className={`w-full px-3 py-2 flex items-center justify-between gap-2 text-sm transition-all ${
                          isActive
                            ? `${TAB_ACTIVE} font-semibold border-l-2`
                            : 'text-gray-600 hover:bg-gray-50 border-l-2 border-transparent'
                        }`}
                      >
                        <span className="truncate">{tab.label}</span>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {totale > 0 && (
                            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                              isActive ? 'bg-white bg-opacity-70' : 'bg-gray-200 text-gray-600'
                            }`}>
                              {count}
                            </span>
                          )}
                          {isActive && <ChevronRight size={14} />}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="col-span-12 md:col-span-9 lg:col-span-9 space-y-4">
          <div className="p-4 rounded-lg border-l-4 bg-primary bg-opacity-10 border-primary text-gray-700">
            <div className="flex items-start gap-3">
              <Info size={20} className="flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="font-bold text-base mb-1">{currentTab.label}</div>
                <p className="text-sm mb-2">{currentTab.description}</p>
                <div className="text-xs">
                  <div className="font-semibold uppercase opacity-70 mb-0.5">Usato in:</div>
                  <ul className="list-disc list-inside ml-1 space-y-0.5">
                    {currentTab.usedIn.map((u, i) => <li key={i}>{u}</li>)}
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {currentTab.isPillar ? (
            <PillarsManager onChange={loadStats} />
          ) : currentTab.isRepartiTree ? (
            <RepartiTreePlaceholder />
          ) : (
            <ConfigManager
              key={currentTab.id}
              tipo={currentTab.id}
              label={currentTab.label}
              color={currentTab.color}
              onChange={loadStats}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────
// REPARTI TREE
// ──────────────────────────────────────────────────────────
function RepartiTreePlaceholder() {
  const [reparti, setReparti] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedReparti, setExpandedReparti] = useState(new Set())
  const [expandedLinee, setExpandedLinee] = useState(new Set())
  const [showRepartoForm, setShowRepartoForm] = useState(false)
  const [editingReparto, setEditingReparto] = useState(null)
  const [search, setSearch] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const res = await api.get('/reparti/?include_inactive=true')
      setReparti(res.data)
    } catch (err) {
      const detail = err.response?.data?.detail
      let msg = err.message
      if (typeof detail === 'string') msg = detail
      else if (Array.isArray(detail)) msg = detail.map(d => `${d.loc?.join('.')}: ${d.msg}`).join('\n')
      else if (detail) msg = JSON.stringify(detail)
      alert('Errore: ' + msg)
      console.error('Errore completo:', err.response?.data)
    } finally {
      setLoading(false)
    }
  }

  function toggleReparto(id) {
    setExpandedReparti(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleLinea(key) {
    setExpandedLinee(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  async function handleDeleteReparto(reparto) {
    if (!confirm(`Eliminare il reparto "${reparto.nome}" e tutte le sue linee/macchine?`)) return
    try {
      await api.delete(`/reparti/${reparto._id}`)
      load()
    } catch (err) {
      alert('Errore: ' + (err.response?.data?.detail || err.message))
    }
  }

  async function handleToggleAttivoReparto(reparto) {
    if (reparto.attivo) {
      if (!confirm(`Disattivare il reparto "${reparto.nome}"?\n\nNON verra eliminato: resta salvato con tutte le sue linee e macchine, ma verra mostrato in grigio come disattivato.`)) return
    }
    try {
      await api.put(`/reparti/${reparto._id}`, { attivo: !reparto.attivo })
      load()
    } catch (err) { alert('Errore: ' + err.message) }
  }

  const filtered = search.trim()
    ? reparti.filter(r =>
        r.nome?.toLowerCase().includes(search.toLowerCase()) ||
        r.codice?.toLowerCase().includes(search.toLowerCase()) ||
        r.linee?.some(l =>
          l.nome?.toLowerCase().includes(search.toLowerCase()) ||
          l.macchine?.some(m => m.nome?.toLowerCase().includes(search.toLowerCase()))
        )
      )
    : reparti

  const totLinee = reparti.reduce((sum, r) => sum + (r.linee?.length || 0), 0)
  const totMacchine = reparti.reduce(
    (sum, r) => sum + (r.linee?.reduce((s, l) => s + (l.macchine?.length || 0), 0) || 0),
    0
  )

  return (
    <div className="bg-white rounded-lg shadow-sm">
      <div className="p-4 border-b flex justify-between items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cerca reparto, linea o macchina..."
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm"
          />
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs text-gray-500 flex gap-3">
            <span>{reparti.length} Reparti</span>
            <span>{totLinee} Linee</span>
            <span>{totMacchine} Macchine</span>
          </div>
          <button
            onClick={() => { setEditingReparto(null); setShowRepartoForm(true) }}
            className="bg-primary text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-primary-light text-sm font-medium"
          >
            <Plus size={16} /> Aggiungi Reparto
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-gray-400">Caricamento...</div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center">
          <p className="text-gray-500 mb-3">
            {search ? 'Nessun risultato' : 'Nessun reparto configurato'}
          </p>
          {!search && (
            <button
              onClick={() => { setEditingReparto(null); setShowRepartoForm(true) }}
              className="text-primary hover:underline"
            >
              + Aggiungi il primo Reparto
            </button>
          )}
        </div>
      ) : (
        <div className="p-3 space-y-2">
          {filtered.map(reparto => (
            <RepartoCard
              key={reparto._id}
              reparto={reparto}
              allReparti={reparti}
              expanded={expandedReparti.has(reparto._id)}
              onToggle={() => toggleReparto(reparto._id)}
              expandedLinee={expandedLinee}
              onToggleLinea={toggleLinea}
              onEdit={() => { setEditingReparto(reparto); setShowRepartoForm(true) }}
              onDelete={() => handleDeleteReparto(reparto)}
              onToggleAttivo={() => handleToggleAttivoReparto(reparto)}
              onChange={load}
            />
          ))}
        </div>
      )}

      {showRepartoForm && (
        <RepartoFormModal
          reparto={editingReparto}
          onClose={() => { setShowRepartoForm(false); setEditingReparto(null) }}
          onSaved={() => { setShowRepartoForm(false); setEditingReparto(null); load() }}
        />
      )}
    </div>
  )
}

function genLocalId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return String(Date.now()) + Math.random().toString(16).slice(2)
}

function RepartoCard({ reparto, allReparti = [], expanded, onToggle, expandedLinee, onToggleLinea, onEdit, onDelete, onToggleAttivo, onChange }) {
  const [showLineaForm, setShowLineaForm] = useState(false)
  const [editingLinea, setEditingLinea] = useState(null)
  const [draggedLineaId, setDraggedLineaId] = useState(null)
  const [dragEnabledLineaId, setDragEnabledLineaId] = useState(null)
  const [dragOverLineaId, setDragOverLineaId] = useState(null)
  const linee = reparto.linee || []
  const totMacchine = linee.reduce((s, l) => s + (l.macchine?.length || 0), 0)

  async function saveLineeOrder(newLinee) {
    try {
      await api.put(`/reparti/${reparto._id}`, {
        nome: reparto.nome,
        codice: reparto.codice,
        descrizione: reparto.descrizione,
        attivo: reparto.attivo,
        linee: newLinee,
      })
      onChange()
    } catch (err) {
      alert('Errore riordino: ' + (err.response?.data?.detail || err.message))
    }
  }

  function resetLineaDrag() {
    setDraggedLineaId(null)
    setDragEnabledLineaId(null)
    setDragOverLineaId(null)
  }

  function handleLineaDrop(targetId) {
    if (!draggedLineaId || draggedLineaId === targetId) { resetLineaDrag(); return }
    const from = linee.findIndex(l => l.id === draggedLineaId)
    const to = linee.findIndex(l => l.id === targetId)
    if (from === -1 || to === -1) { resetLineaDrag(); return }
    const reordered = [...linee]
    const [moved] = reordered.splice(from, 1)
    reordered.splice(to, 0, moved)
    resetLineaDrag()
    saveLineeOrder(reordered)
  }

  async function handleDuplicateLinea(linea) {
    const clonedMacchine = (linea.macchine || []).map(m => ({ ...m, id: genLocalId() }))
    try {
      await api.post(`/reparti/${reparto._id}/linee`, {
        nome: `${linea.nome} (copia)`,
        codice: '',
        descrizione: linea.descrizione || '',
        attivo: true,
        macchine: clonedMacchine,
      })
      onChange()
    } catch (err) {
      alert('Errore duplicazione: ' + (err.response?.data?.detail || err.message))
    }
  }

  async function handleDeleteLinea(linea) {
    if (!confirm(`Eliminare la linea "${linea.nome}" e tutte le sue macchine?`)) return
    try {
      await api.delete(`/reparti/${reparto._id}/linee/${linea.id}`)
      onChange()
    } catch (err) {
      alert('Errore: ' + (err.response?.data?.detail || err.message))
    }
  }

  return (
    <div className={`border rounded-lg overflow-hidden transition-all ${!reparto.attivo ? 'opacity-60' : ''}`}>
      <div className="bg-indigo-50 border-l-4 border-indigo-500 px-3 py-2 flex items-center gap-2">
        <button onClick={onToggle} className="p-1 hover:bg-indigo-100 rounded">
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        <Factory size={20} className="text-indigo-600 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-indigo-900">{reparto.nome}</span>
            {reparto.codice && (
              <span className="font-mono text-xs px-1.5 py-0.5 bg-indigo-200 text-indigo-700 rounded">
                {reparto.codice}
              </span>
            )}
            <span className="text-xs text-gray-500">
              {linee.length} linee, {totMacchine} macchine
            </span>
            {!reparto.attivo && (
              <span className="text-[10px] px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded font-medium uppercase">
                Disattivato
              </span>
            )}
          </div>
          {reparto.descrizione && (
            <div className="text-xs text-gray-600 truncate">{reparto.descrizione}</div>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={onToggleAttivo}
            className={`p-1 rounded hover:bg-white ${reparto.attivo ? 'text-green-600' : 'text-gray-400'}`}
            title={reparto.attivo ? 'Disattiva' : 'Attiva'}
          >
            {reparto.attivo ? <Eye size={14} /> : <EyeOff size={14} />}
          </button>
          <button onClick={onEdit} className="p-1 hover:bg-yellow-100 rounded text-yellow-600" title="Modifica">
            <Edit2 size={14} />
          </button>
          <button onClick={onDelete} className="p-1 hover:bg-red-100 rounded text-red-600" title="Elimina">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="p-3 bg-white space-y-1.5">
          {linee.length === 0 ? (
            <div className="text-center py-4 text-xs text-gray-400 italic">
              Nessuna linea
            </div>
          ) : (
            linee.map(linea => (
              <div
                key={linea.id}
                draggable={dragEnabledLineaId === linea.id}
                onDragStart={(e) => { e.stopPropagation(); setDraggedLineaId(linea.id) }}
                onDragEnter={() => { if (draggedLineaId && draggedLineaId !== linea.id) setDragOverLineaId(linea.id) }}
                onDragOver={(e) => { if (draggedLineaId) e.preventDefault() }}
                onDrop={(e) => { e.stopPropagation(); handleLineaDrop(linea.id) }}
                onDragEnd={resetLineaDrag}
                className={`rounded transition-all ${draggedLineaId === linea.id ? 'opacity-40' : ''} ${dragOverLineaId === linea.id ? 'border-t-2 border-indigo-500 pt-1' : ''}`}
              >
                <LineaCard
                  reparto={reparto}
                  allReparti={allReparti}
                  linea={linea}
                  onGrabStart={() => setDragEnabledLineaId(linea.id)}
                  onGrabEnd={() => setDragEnabledLineaId(null)}
                  expanded={expandedLinee.has(`${reparto._id}_${linea.id}`)}
                  onToggle={() => onToggleLinea(`${reparto._id}_${linea.id}`)}
                  onEdit={() => { setEditingLinea(linea); setShowLineaForm(true) }}
                  onDelete={() => handleDeleteLinea(linea)}
                  onDuplicate={() => handleDuplicateLinea(linea)}
                  onChange={onChange}
                />
              </div>
            ))
          )}
          <button
            onClick={() => { setEditingLinea(null); setShowLineaForm(true) }}
            className="w-full text-xs text-blue-600 hover:bg-blue-50 py-1.5 rounded border-2 border-dashed border-blue-200 flex items-center justify-center gap-1"
          >
            <Plus size={14} /> Aggiungi Linea
          </button>
        </div>
      )}

      {showLineaForm && (
        <LineaFormModal
          reparto={reparto}
          linea={editingLinea}
          onClose={() => { setShowLineaForm(false); setEditingLinea(null) }}
          onSaved={() => { setShowLineaForm(false); setEditingLinea(null); onChange() }}
        />
      )}
    </div>
  )
}

function LineaCard({ reparto, allReparti = [], linea, expanded, onToggle, onEdit, onDelete, onDuplicate, onChange, onGrabStart, onGrabEnd }) {
  const [showMacchinaForm, setShowMacchinaForm] = useState(false)
  const [editingMacchina, setEditingMacchina] = useState(null)
  const [draggedMacchinaId, setDraggedMacchinaId] = useState(null)
  const [dragEnabledMacchinaId, setDragEnabledMacchinaId] = useState(null)
  const [dragOverMacchinaId, setDragOverMacchinaId] = useState(null)
  const [showCopyModal, setShowCopyModal] = useState(false)
  const macchine = linea.macchine || []

  async function handleDeleteMacchina(macchina) {
    if (!confirm(`Eliminare la macchina "${macchina.nome}"?`)) return
    try {
      await api.delete(`/reparti/${reparto._id}/linee/${linea.id}/macchine/${macchina.id}`)
      onChange()
    } catch (err) {
      alert('Errore: ' + (err.response?.data?.detail || err.message))
    }
  }

  async function saveMacchine(newMacchine) {
    try {
      await api.put(`/reparti/${reparto._id}/linee/${linea.id}`, {
        id: linea.id,
        nome: linea.nome,
        codice: linea.codice || null,
        descrizione: linea.descrizione || '',
        attivo: linea.attivo !== false,
        macchine: newMacchine,
      })
      onChange()
    } catch (err) {
      alert('Errore riordino macchine: ' + (err.response?.data?.detail || err.message))
    }
  }

  function resetMacchinaDrag() {
    setDraggedMacchinaId(null)
    setDragEnabledMacchinaId(null)
    setDragOverMacchinaId(null)
  }

  function handleMacchinaDrop(targetId) {
    if (!draggedMacchinaId || draggedMacchinaId === targetId) { resetMacchinaDrag(); return }
    const from = macchine.findIndex(m => m.id === draggedMacchinaId)
    const to = macchine.findIndex(m => m.id === targetId)
    if (from === -1 || to === -1) { resetMacchinaDrag(); return }
    const reordered = [...macchine]
    const [moved] = reordered.splice(from, 1)
    reordered.splice(to, 0, moved)
    resetMacchinaDrag()
    saveMacchine(reordered)
  }

  async function copyFromLinea(sourceLinea, mode) {
    const cloned = (sourceLinea.macchine || []).map(m => ({ ...m, id: genLocalId() }))
    const newMacchine = mode === 'replace' ? cloned : [...macchine, ...cloned]
    setShowCopyModal(false)
    await saveMacchine(newMacchine)
  }

  return (
    <div className={`border-l-2 border-blue-300 ml-2 rounded transition-all ${!linea.attivo ? 'opacity-50' : ''}`}>
      <div className="bg-blue-50 px-3 py-1.5 flex items-center gap-2 rounded-r">
        <GripVertical
          size={14}
          className="text-blue-400 flex-shrink-0 cursor-grab active:cursor-grabbing"
          title="Trascina per riordinare la linea"
          onMouseDown={() => onGrabStart && onGrabStart()}
          onMouseUp={() => onGrabEnd && onGrabEnd()}
        />
        <button onClick={onToggle} className="p-0.5 hover:bg-blue-100 rounded">
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-blue-900 text-sm">{linea.nome}</span>
            {linea.codice && (
              <span className="font-mono text-[10px] px-1 py-0.5 bg-blue-200 text-blue-700 rounded">
                {linea.codice}
              </span>
            )}
            <span className="text-[10px] text-gray-500">{macchine.length} macchine</span>
          </div>
          {linea.descrizione && (
            <div className="text-[10px] text-gray-600 truncate">{linea.descrizione}</div>
          )}
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button onClick={() => setShowCopyModal(true)} className="p-0.5 hover:bg-indigo-100 rounded text-indigo-600" title="Copia struttura da un'altra linea">
            <Copy size={12} />
          </button>
          {onDuplicate && (
            <button onClick={onDuplicate} className="p-0.5 hover:bg-blue-100 rounded text-blue-600" title="Duplica questa linea">
              <CopyPlus size={12} />
            </button>
          )}
          <button onClick={onEdit} className="p-0.5 hover:bg-yellow-100 rounded text-yellow-600" title="Modifica">
            <Edit2 size={12} />
          </button>
          <button onClick={onDelete} className="p-0.5 hover:bg-red-100 rounded text-red-600" title="Elimina">
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="p-2 bg-white space-y-1 ml-2">
          {macchine.length === 0 ? (
            <div className="text-center py-2 text-[10px] text-gray-400 italic">
              Nessuna macchina
            </div>
          ) : (
            macchine.map(m => (
              <div
                key={m.id}
                draggable={dragEnabledMacchinaId === m.id}
                onDragStart={(e) => { e.stopPropagation(); setDraggedMacchinaId(m.id) }}
                onDragEnter={() => { if (draggedMacchinaId && draggedMacchinaId !== m.id) setDragOverMacchinaId(m.id) }}
                onDragOver={(e) => { if (draggedMacchinaId) e.preventDefault() }}
                onDrop={(e) => { e.stopPropagation(); handleMacchinaDrop(m.id) }}
                onDragEnd={resetMacchinaDrag}
                className={`flex items-center gap-2 px-2 py-1 bg-gray-50 rounded text-xs ${!m.attivo ? 'opacity-50' : ''} ${draggedMacchinaId === m.id ? 'opacity-40' : ''} ${dragOverMacchinaId === m.id ? 'border-t-2 border-indigo-500' : ''}`}
              >
                <GripVertical
                  size={14}
                  className="text-gray-400 flex-shrink-0 cursor-grab active:cursor-grabbing"
                  onMouseDown={() => setDragEnabledMacchinaId(m.id)}
                  onMouseUp={() => setDragEnabledMacchinaId(null)}
                />
                <Cpu size={12} className="text-gray-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="font-medium">{m.nome}</span>
                  {m.codice && (
                    <span className="font-mono text-[10px] ml-2 px-1 py-0.5 bg-gray-200 text-gray-700 rounded">
                      {m.codice}
                    </span>
                  )}
                  {m.descrizione && (
                    <span className="text-[10px] text-gray-500 ml-2">{m.descrizione}</span>
                  )}
                </div>
                <button
                  onClick={() => { setEditingMacchina(m); setShowMacchinaForm(true) }}
                  className="p-0.5 hover:bg-yellow-100 rounded text-yellow-600"
                  title="Modifica"
                >
                  <Edit2 size={11} />
                </button>
                <button
                  onClick={() => handleDeleteMacchina(m)}
                  className="p-0.5 hover:bg-red-100 rounded text-red-600"
                  title="Elimina"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))
          )}
          <button
            onClick={() => { setEditingMacchina(null); setShowMacchinaForm(true) }}
            className="w-full text-[10px] text-gray-500 hover:bg-gray-100 py-1 rounded border border-dashed border-gray-300 flex items-center justify-center gap-1"
          >
            <Plus size={11} /> Aggiungi Macchina
          </button>
        </div>
      )}

      {showMacchinaForm && (
        <MacchinaFormModal
          reparto={reparto}
          linea={linea}
          macchina={editingMacchina}
          onClose={() => { setShowMacchinaForm(false); setEditingMacchina(null) }}
          onSaved={() => { setShowMacchinaForm(false); setEditingMacchina(null); onChange() }}
        />
      )}

      {showCopyModal && (
        <CopyStructureModal
          allReparti={allReparti}
          currentLineaId={linea.id}
          targetLineaNome={linea.nome}
          onClose={() => setShowCopyModal(false)}
          onCopy={copyFromLinea}
        />
      )}
    </div>
  )
}

function CopyStructureModal({ allReparti, currentLineaId, targetLineaNome, onClose, onCopy }) {
  const [search, setSearch] = useState('')
  const [mode, setMode] = useState('add')

  const sorgenti = []
  allReparti.forEach(rep => {
    (rep.linee || []).forEach(l => {
      if (l.id === currentLineaId) return
      sorgenti.push({ reparto: rep, linea: l })
    })
  })

  const filtered = search.trim()
    ? sorgenti.filter(({ reparto, linea }) =>
        linea.nome?.toLowerCase().includes(search.toLowerCase()) ||
        reparto.nome?.toLowerCase().includes(search.toLowerCase())
      )
    : sorgenti

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <div className="bg-indigo-600 text-white px-5 py-3 flex justify-between items-center">
          <h2 className="font-semibold">Copia struttura in "{targetLineaNome}"</h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <div className="p-4 border-b space-y-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cerca linea sorgente..."
              className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm"
              autoFocus
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode('add')}
              className={`flex-1 px-3 py-2 rounded-lg text-sm border-2 ${mode === 'add' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600'}`}
            >
              Aggiungi alle esistenti
            </button>
            <button
              type="button"
              onClick={() => setMode('replace')}
              className={`flex-1 px-3 py-2 rounded-lg text-sm border-2 ${mode === 'replace' ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 text-gray-600'}`}
            >
              Sostituisci tutte
            </button>
          </div>
        </div>
        <div className="overflow-y-auto flex-1 p-3 space-y-1.5">
          {filtered.length === 0 ? (
            <div className="text-center py-8 text-sm text-gray-400">Nessuna linea sorgente disponibile</div>
          ) : (
            filtered.map(({ reparto, linea }) => (
              <button
                key={`${reparto._id}_${linea.id}`}
                type="button"
                onClick={() => {
                  if (mode === 'replace' && !confirm(`Sostituire tutte le macchine di "${targetLineaNome}" con quelle di "${linea.nome}"?`)) return
                  onCopy(linea, mode)
                }}
                className="w-full text-left border rounded-lg px-3 py-2 hover:border-indigo-400 hover:bg-indigo-50 flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{linea.nome}</div>
                  <div className="text-xs text-gray-500 truncate">{reparto.nome} · {(linea.macchine || []).length} macchine</div>
                </div>
                <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function RepartoFormModal({ reparto, onClose, onSaved }) {
  const [form, setForm] = useState({
    nome: reparto?.nome || '',
    codice: reparto?.codice || '',
    descrizione: reparto?.descrizione || '',
    attivo: reparto?.attivo !== false,
  })
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.nome.trim()) return alert('Nome obbligatorio')
    setSaving(true)
    try {
      if (reparto?._id) {
        await api.put(`/reparti/${reparto._id}`, form)
      } else {
        await api.post('/reparti/', { ...form, linee: [] })
      }
      onSaved()
    } catch (err) {
      alert('Errore: ' + (err.response?.data?.detail || err.message))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="bg-indigo-600 text-white px-5 py-3 flex justify-between items-center">
          <h2 className="font-semibold">{reparto ? 'Modifica Reparto' : 'Nuovo Reparto'}</h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Nome <span className="text-red-500">*</span></label>
            <input required autoFocus value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className="w-full border rounded-lg px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Codice</label>
            <input value={form.codice} onChange={(e) => setForm({ ...form, codice: e.target.value.toUpperCase() })} className="w-full border rounded-lg px-3 py-2 font-mono" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Descrizione</label>
            <textarea value={form.descrizione} onChange={(e) => setForm({ ...form, descrizione: e.target.value })} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <label className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg cursor-pointer">
            <input type="checkbox" checked={form.attivo} onChange={(e) => setForm({ ...form, attivo: e.target.checked })} className="w-4 h-4" />
            <span className="text-sm">Attivo</span>
          </label>
          <div className="flex justify-end gap-2 pt-3 border-t">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg">Annulla</button>
            <button type="submit" disabled={saving} className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2">
              <Save size={16} />
              {saving ? 'Salvataggio...' : (reparto ? 'Salva' : 'Crea')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function LineaFormModal({ reparto, linea, onClose, onSaved }) {
  const [form, setForm] = useState({
    nome: linea?.nome || '',
    codice: linea?.codice || '',
    descrizione: linea?.descrizione || '',
    attivo: linea?.attivo !== false,
  })
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.nome.trim()) return alert('Nome obbligatorio')
    setSaving(true)
    try {
      if (linea?.id) {
        await api.put(`/reparti/${reparto._id}/linee/${linea.id}`, {
          ...form, id: linea.id, macchine: linea.macchine || [],
        })
      } else {
        await api.post(`/reparti/${reparto._id}/linee`, { ...form, macchine: [] })
      }
      onSaved()
    } catch (err) {
      alert('Errore: ' + (err.response?.data?.detail || err.message))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="bg-blue-600 text-white px-5 py-3 flex justify-between items-center">
          <h2 className="font-semibold">{linea ? 'Modifica Linea' : 'Nuova Linea'} in {reparto.nome}</h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Nome <span className="text-red-500">*</span></label>
            <input required autoFocus value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className="w-full border rounded-lg px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Codice</label>
            <input value={form.codice} onChange={(e) => setForm({ ...form, codice: e.target.value.toUpperCase() })} className="w-full border rounded-lg px-3 py-2 font-mono" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Descrizione</label>
            <textarea value={form.descrizione} onChange={(e) => setForm({ ...form, descrizione: e.target.value })} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <label className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg cursor-pointer">
            <input type="checkbox" checked={form.attivo} onChange={(e) => setForm({ ...form, attivo: e.target.checked })} className="w-4 h-4" />
            <span className="text-sm">Attiva</span>
          </label>
          <div className="flex justify-end gap-2 pt-3 border-t">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg">Annulla</button>
            <button type="submit" disabled={saving} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
              <Save size={16} />
              {saving ? 'Salvataggio...' : (linea ? 'Salva' : 'Crea')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function MacchinaFormModal({ reparto, linea, macchina, onClose, onSaved }) {
  const [form, setForm] = useState({
    nome: macchina?.nome || '',
    codice: macchina?.codice || '',
    descrizione: macchina?.descrizione || '',
    attivo: macchina?.attivo !== false,
  })
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.nome.trim()) return alert('Nome obbligatorio')
    setSaving(true)
    try {
      if (macchina?.id) {
        await api.put(`/reparti/${reparto._id}/linee/${linea.id}/macchine/${macchina.id}`, {
          ...form, id: macchina.id,
        })
      } else {
        await api.post(`/reparti/${reparto._id}/linee/${linea.id}/macchine`, form)
      }
      onSaved()
    } catch (err) {
      alert('Errore: ' + (err.response?.data?.detail || err.message))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="bg-gray-600 text-white px-5 py-3 flex justify-between items-center">
          <h2 className="font-semibold">{macchina ? 'Modifica Macchina' : 'Nuova Macchina'} in {linea.nome}</h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Nome <span className="text-red-500">*</span></label>
            <input required autoFocus value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className="w-full border rounded-lg px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Codice</label>
            <input value={form.codice} onChange={(e) => setForm({ ...form, codice: e.target.value.toUpperCase() })} className="w-full border rounded-lg px-3 py-2 font-mono" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Descrizione</label>
            <textarea value={form.descrizione} onChange={(e) => setForm({ ...form, descrizione: e.target.value })} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <label className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg cursor-pointer">
            <input type="checkbox" checked={form.attivo} onChange={(e) => setForm({ ...form, attivo: e.target.checked })} className="w-4 h-4" />
            <span className="text-sm">Attiva</span>
          </label>
          <div className="flex justify-end gap-2 pt-3 border-t">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg">Annulla</button>
            <button type="submit" disabled={saving} className="px-6 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 flex items-center gap-2">
              <Save size={16} />
              {saving ? 'Salvataggio...' : (macchina ? 'Salva' : 'Crea')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────
// CONFIG MANAGER
// ──────────────────────────────────────────────────────────
function ConfigManager({ tipo, label, color, onChange }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)

  useEffect(() => { load() }, [tipo, search])

  async function load() {
    setLoading(true)
    try {
      const params = new URLSearchParams({ tipo })
      if (search) params.append('search', search)
      const res = await api.get(`/configurazioni/?${params.toString()}`)
      setItems(res.data)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  async function handleDelete(id, itemLabel) {
    if (!confirm(`Eliminare "${itemLabel}"?`)) return
    try {
      await api.delete(`/configurazioni/${id}`)
      load()
      onChange?.()
    } catch (err) {
      alert('Errore: ' + (err.response?.data?.detail || err.message))
    }
  }

  async function handleToggle(id) {
    try {
      await api.patch(`/configurazioni/${id}/toggle`)
      load()
      onChange?.()
    } catch (err) { alert('Errore: ' + err.message) }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm">
      <div className="p-4 border-b flex justify-between items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Cerca in ${label.toLowerCase()}...`}
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm"
          />
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true) }}
          className="bg-primary text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-primary-light text-sm font-medium"
        >
          <Plus size={16} /> Aggiungi voce
        </button>
      </div>

      {loading ? (
        <div className="p-12 text-center text-gray-400">Caricamento...</div>
      ) : items.length === 0 ? (
        <div className="p-12 text-center">
          <p className="text-gray-500 mb-3">
            {search ? 'Nessun risultato' : 'Nessuna voce ancora configurata'}
          </p>
          {!search && (
            <button onClick={() => { setEditing(null); setShowForm(true) }} className="text-primary hover:underline">
              + Aggiungi la prima voce
            </button>
          )}
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b text-xs uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2 text-left w-12"></th>
              <th className="px-3 py-2 text-left w-16">Icon</th>
              <th className="px-3 py-2 text-left">Label</th>
              <th className="px-3 py-2 text-left w-32">Codice</th>
              <th className="px-3 py-2 text-left">Descrizione</th>
              <th className="px-3 py-2 text-left w-20">Stato</th>
              <th className="px-3 py-2 text-center w-32">Azioni</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item._id} className={`border-b hover:bg-gray-50 ${!item.attivo ? 'opacity-50' : ''}`}>
                <td className="px-3 py-2 text-gray-300"><GripVertical size={16} /></td>
                <td className="px-3 py-2 text-2xl">{item.icon || '-'}</td>
                <td className="px-3 py-2 font-medium">
                  <div className="flex items-center gap-2">
                    {item.color && (
                      <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: item.color }} />
                    )}
                    {item.label}
                  </div>
                </td>
                <td className="px-3 py-2 font-mono text-xs text-gray-500">{item.codice}</td>
                <td className="px-3 py-2 text-xs text-gray-600 truncate max-w-md">{item.descrizione || '-'}</td>
                <td className="px-3 py-2">
                  <button
                    onClick={() => handleToggle(item._id)}
                    className={`px-2 py-1 rounded-full text-xs ${
                      item.attivo ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {item.attivo ? 'Attivo' : 'Disattivo'}
                  </button>
                </td>
                <td className="px-3 py-2">
                  <div className="flex justify-center gap-1">
                    <button onClick={() => handleToggle(item._id)} className="p-1 hover:bg-gray-100 rounded">
                      {item.attivo ? <Eye size={14} /> : <EyeOff size={14} />}
                    </button>
                    <button onClick={() => { setEditing(item); setShowForm(true) }} className="p-1 hover:bg-yellow-100 rounded text-yellow-600">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => handleDelete(item._id, item.label)} className="p-1 hover:bg-red-100 rounded text-red-600">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showForm && (
        <ConfigForm
          tipo={tipo}
          label={label}
          item={editing}
          onClose={() => { setShowForm(false); setEditing(null) }}
          onSaved={() => { setShowForm(false); setEditing(null); load(); onChange?.() }}
        />
      )}
    </div>
  )
}

function ConfigForm({ tipo, label, item, onClose, onSaved }) {
  const [form, setForm] = useState({
    label: item?.label || '',
    codice: item?.codice || '',
    descrizione: item?.descrizione || '',
    icon: item?.icon || '',
    color: item?.color || '',
    attivo: item?.attivo !== false,
    is_terminal: item?.is_terminal === true,
  })
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.label.trim()) return alert('Label obbligatoria')
    setSaving(true)
    try {
      const payload = { ...form, tipo, codice: form.codice.trim() || null }
      if (item?._id) {
        await api.put(`/configurazioni/${item._id}`, payload)
      } else {
        await api.post('/configurazioni/', payload)
      }
      onSaved()
    } catch (err) {
      alert('Errore: ' + (err.response?.data?.detail || err.message))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="bg-primary text-white px-5 py-3 flex justify-between items-center">
          <h2 className="font-semibold">{item ? 'Modifica' : 'Nuova voce'} - {label}</h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Label <span className="text-red-500">*</span></label>
            <input required autoFocus value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} className="w-full border rounded-lg px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Codice</label>
            <input value={form.codice} onChange={(e) => setForm({ ...form, codice: e.target.value.toUpperCase() })} className="w-full border rounded-lg px-3 py-2 font-mono" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Descrizione</label>
            <textarea value={form.descrizione} onChange={(e) => setForm({ ...form, descrizione: e.target.value })} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Icon (emoji)</label>
              <input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-2xl text-center" maxLength={4} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Colore</label>
              <div className="flex gap-1">
                <input type="color" value={form.color || '#3b82f6'} onChange={(e) => setForm({ ...form, color: e.target.value })} className="w-12 h-10 border rounded cursor-pointer" />
                <input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="flex-1 border rounded-lg px-2 py-2 text-sm font-mono" />
              </div>
            </div>
          </div>
          <label className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg cursor-pointer">
            <input type="checkbox" checked={form.attivo} onChange={(e) => setForm({ ...form, attivo: e.target.checked })} className="w-4 h-4" />
            <span className="text-sm">Attivo</span>
          </label>

          {tipo === 'stato_ap' && (
            <label className="flex items-start gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_terminal}
                onChange={(e) => setForm({ ...form, is_terminal: e.target.checked })}
                className="w-4 h-4 mt-0.5"
              />
              <div className="flex-1">
                <div className="text-sm font-medium text-orange-900">Stato terminale</div>
                <div className="text-xs text-orange-700 mt-0.5">
                  Quando un Action Plan raggiunge questo stato diventa read-only.
                  Sarà comunque possibile riaprirlo per tornare modificabile.
                </div>
              </div>
            </label>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg">Annulla</button>
            <button type="submit" disabled={saving} className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-light disabled:opacity-50 flex items-center gap-2">
              <Save size={16} />
              {saving ? 'Salvataggio...' : (item ? 'Salva' : 'Crea')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────
// PILLARS MANAGER
// ──────────────────────────────────────────────────────────
function PillarsManager({ onChange }) {
  const [pillars, setPillars] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)

  useEffect(() => { load() }, [search])

  async function load() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.append('search', search)
      const res = await api.get(`/pillars/?${params.toString()}`)
      setPillars(res.data)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  async function handleDelete(pillar) {
    if (!confirm(`Eliminare il Pillar "${pillar.sigla} - ${pillar.label}"?\nI Kaizen collegati perderanno il riferimento.`)) return
    try {
      const res = await api.delete(`/pillars/${pillar._id}`)
      alert(`Pillar eliminato. ${res.data?.kaizens_scollegati || 0} Kaizen scollegati.`)
      load()
      onChange?.()
    } catch (err) {
      alert('Errore: ' + (err.response?.data?.detail || err.message))
    }
  }

  async function handleToggleActive(pillar) {
    try {
      await api.put(`/pillars/${pillar._id}`, { attivo: !pillar.attivo })
      load()
      onChange?.()
    } catch (err) { alert('Errore: ' + err.message) }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm">
      <div className="p-4 border-b flex justify-between items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cerca pillar per sigla, nome o descrizione..."
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm"
          />
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true) }}
          className="bg-primary text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-primary-light text-sm font-medium"
        >
          <Plus size={16} /> Aggiungi Pillar
        </button>
      </div>

      {loading ? (
        <div className="p-12 text-center text-gray-400">Caricamento...</div>
      ) : pillars.length === 0 ? (
        <div className="p-12 text-center">
          <p className="text-gray-500 mb-3">
            {search ? 'Nessun pillar trovato' : 'Nessun pillar configurato'}
          </p>
          {!search && (
            <button onClick={() => { setEditing(null); setShowForm(true) }} className="text-primary hover:underline">
              + Aggiungi il primo Pillar
            </button>
          )}
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b text-xs uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2 text-left w-16">Icon</th>
              <th className="px-3 py-2 text-left w-24">Sigla</th>
              <th className="px-3 py-2 text-left">Nome</th>
              <th className="px-3 py-2 text-left w-40">Leader</th>
              <th className="px-3 py-2 text-left w-24">Anno</th>
              <th className="px-3 py-2 text-left w-20">Stato</th>
              <th className="px-3 py-2 text-center w-32">Azioni</th>
            </tr>
          </thead>
          <tbody>
            {pillars.map(p => (
              <tr key={p._id} className={`border-b hover:bg-gray-50 ${!p.attivo ? 'opacity-50' : ''}`}>
                <td className="px-3 py-2">
                  <PillarIcon pillar={p} size={40} />
                </td>
                <td className="px-3 py-2 font-mono font-bold text-primary">
                  {p.color && (
                    <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ backgroundColor: p.color }} />
                  )}
                  {p.sigla}
                </td>
                <td className="px-3 py-2">
                  <div className="font-medium">{p.label}</div>
                  {p.descrizione && (
                    <div className="text-xs text-gray-500 truncate max-w-md">{p.descrizione}</div>
                  )}
                </td>
                <td className="px-3 py-2 text-xs">{p.leader || '-'}</td>
                <td className="px-3 py-2 text-xs">{p.anno || '-'}</td>
                <td className="px-3 py-2">
                  <button
                    onClick={() => handleToggleActive(p)}
                    className={`px-2 py-1 rounded-full text-xs ${
                      p.attivo ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {p.attivo ? 'Attivo' : 'Disattivo'}
                  </button>
                </td>
                <td className="px-3 py-2">
                  <div className="flex justify-center gap-1">
                    <button onClick={() => handleToggleActive(p)} className="p-1 hover:bg-gray-100 rounded">
                      {p.attivo ? <Eye size={14} /> : <EyeOff size={14} />}
                    </button>
                    <button onClick={() => { setEditing(p); setShowForm(true) }} className="p-1 hover:bg-yellow-100 rounded text-yellow-600">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => handleDelete(p)} className="p-1 hover:bg-red-100 rounded text-red-600">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showForm && (
        <PillarForm
          pillar={editing}
          onClose={() => { setShowForm(false); setEditing(null) }}
          onSaved={() => { setShowForm(false); setEditing(null); load(); onChange?.() }}
        />
      )}
    </div>
  )
}

function PillarIcon({ pillar, size = 40 }) {
  if (pillar.icon_image) {
    return React.createElement('img', {
      src: pillar.icon_image,
      alt: pillar.sigla,
      style: { width: size, height: size, backgroundColor: pillar.color || '#6366f1' },
      className: 'rounded-lg object-contain border',
    })
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        backgroundColor: pillar.color || '#6366f1',
        fontSize: size * 0.5,
      }}
      className="rounded-lg flex items-center justify-center text-white font-bold"
    >
      {pillar.icon || pillar.sigla?.charAt(0) || 'P'}
    </div>
  )
}

// ──────────────────────────────────────────────────────────
// PILLAR FORM (con UserPicker per Leader e Members)
// ──────────────────────────────────────────────────────────
function PillarForm({ pillar, onClose, onSaved }) {
  const [form, setForm] = useState({
    sigla: pillar?.sigla || '',
    label: pillar?.label || '',
    descrizione: pillar?.descrizione || '',
    icon: pillar?.icon || '',
    icon_image: pillar?.icon_image || '',
    color: pillar?.color || '#6366f1',
    leader: pillar?.leader || '',
    leader_id: pillar?.leader_id || null,
    leader_email: pillar?.leader_email || '',
    members: pillar?.members || [],
    members_ids: pillar?.members_ids || [],
    members_data: [],
    anno: pillar?.anno || new Date().getFullYear(),
    note: pillar?.note || '',
  })
  const [saving, setSaving] = useState(false)

  // Inizializza members_data dai vecchi dati se presenti
  useEffect(() => {
    if (pillar?.members && pillar.members.length > 0) {
      const data = pillar.members.map((name, idx) => ({
        id: pillar.members_ids?.[idx] || `legacy-${idx}`,
        name: name,
      }))
      setForm(f => ({ ...f, members_data: data }))
    }
  }, [pillar])

  function handleImageUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      alert('Seleziona un file immagine valido (PNG, JPG, SVG, ecc.)')
      return
    }
    if (file.size > 500 * 1024) {
      alert(`File troppo grande (${(file.size / 1024).toFixed(0)} KB). Massimo 500 KB.`)
      return
    }
    const reader = new FileReader()
    reader.onload = (event) => {
      setForm({ ...form, icon_image: event.target.result })
    }
    reader.readAsDataURL(file)
  }

  function removeImage() {
    setForm({ ...form, icon_image: '' })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.sigla.trim()) return alert('Sigla obbligatoria')
    if (!form.label.trim()) return alert('Nome obbligatorio')
    setSaving(true)
    try {
      const { members_data, ...formClean } = form
      const payload = {
        ...formClean,
        sigla: form.sigla.trim().toUpperCase(),
        members: Array.isArray(form.members) ? form.members : [],
        anno: parseInt(form.anno) || new Date().getFullYear(),
      }
      if (pillar?._id) {
        await api.put(`/pillars/${pillar._id}`, payload)
      } else {
        await api.post('/pillars/', payload)
      }
      onSaved()
    } catch (err) {
      alert('Errore: ' + (err.response?.data?.detail || err.message))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[95vh] overflow-y-auto">
        <div className="bg-indigo-600 text-white px-5 py-3 flex justify-between items-center sticky top-0 z-10">
          <h2 className="font-semibold">{pillar ? `Modifica Pillar ${pillar.sigla}` : 'Nuovo Pillar'}</h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">
                Sigla <span className="text-red-500">*</span>
              </label>
              <input
                required
                autoFocus
                maxLength={6}
                value={form.sigla}
                onChange={(e) => setForm({ ...form, sigla: e.target.value.toUpperCase() })}
                className="w-full border rounded-lg px-3 py-2 font-mono font-bold text-lg uppercase"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Anno di riferimento</label>
              <input
                type="number"
                value={form.anno}
                onChange={(e) => setForm({ ...form, anno: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
                min="2020"
                max="2050"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Nome completo <span className="text-red-500">*</span>
            </label>
            <input
              required
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Descrizione</label>
            <textarea
              value={form.descrizione}
              onChange={(e) => setForm({ ...form, descrizione: e.target.value })}
              rows={2}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>

          {/* ICONA + COLORE */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Icona</label>
              <div className="flex gap-2 items-start">
                <div
                  className="w-16 h-16 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 shadow-sm overflow-hidden border-2 text-white font-bold"
                  style={{
                    backgroundColor: form.color || '#6366f1',
                    borderColor: form.color || '#6366f1',
                  }}
                >
                  <PillarPreview form={form} />
                </div>
                <div className="flex-1 space-y-1">
                  <label className="block cursor-pointer">
                    <span className="text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 px-2 py-1 rounded inline-flex items-center gap-1">
                      <Upload size={12} /> Carica immagine
                    </span>
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  </label>
                  {form.icon_image && (
                    <button
                      type="button"
                      onClick={removeImage}
                      className="text-xs text-red-600 hover:bg-red-50 px-2 py-1 rounded block"
                    >
                      Rimuovi immagine
                    </button>
                  )}
                  {!form.icon_image && (
                    <input
                      value={form.icon}
                      onChange={(e) => setForm({ ...form, icon: e.target.value })}
                      className="w-full border rounded px-2 py-1 text-lg text-center"
                      placeholder="Emoji"
                      maxLength={4}
                    />
                  )}
                </div>
              </div>
              <div className="text-[10px] text-gray-400 mt-1">
                Max 500 KB, consigliato 200x200 px PNG/SVG
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Colore</label>
              <div className="flex gap-1">
                <input
                  type="color"
                  value={form.color || '#6366f1'}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  className="w-12 h-10 border rounded cursor-pointer"
                />
                <input
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  className="flex-1 border rounded-lg px-2 py-2 text-sm font-mono"
                />
              </div>
            </div>
          </div>

          {/* LEADER con UserPicker */}
          <div>
            <label className="block text-sm font-medium mb-1">Leader (Pillar Manager)</label>
            <UserPicker
              value={form.leader_id ? { id: form.leader_id, name: form.leader } : null}
              onChange={(selected) => {
                if (selected) {
                  setForm({ ...form, leader_id: selected.id, leader: selected.name })
                } else {
                  setForm({ ...form, leader_id: null, leader: '' })
                }
              }}
              mode="single"
              roles={['office', 'manager', 'admin']}
              placeholder="Cerca leader (office/manager/admin)..."
            />
          </div>

          {/* MEMBERS con UserPicker multi */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Membri del Team
              <span className="text-xs text-gray-500 font-normal ml-1">({form.members_data.length})</span>
            </label>
            <UserPicker
              value={form.members_data}
              onChange={(selected) => {
                setForm({
                  ...form,
                  members_data: selected,
                  members: selected.map(s => s.name),
                  members_ids: selected.map(s => s.id),
                })
              }}
              mode="multi"
              placeholder="Aggiungi membri al team..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Note</label>
            <textarea
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              rows={2}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg">
              Annulla
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
            >
              <Save size={16} />
              {saving ? 'Salvataggio...' : (pillar ? 'Salva' : 'Crea Pillar')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function PillarPreview({ form }) {
  if (form.icon_image) {
    return React.createElement('img', {
      src: form.icon_image,
      alt: 'Preview',
      className: 'w-full h-full object-contain',
    })
  }
  return <span>{form.icon || form.sigla?.charAt(0) || '?'}</span>
}
