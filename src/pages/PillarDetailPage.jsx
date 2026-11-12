import MpInfoPanel from '../components/pillar/MpInfoPanel'
import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import api from '../services/api'
import { useAllConfigurations } from '../hooks/useConfigurations'
import { ArrowLeft, User, Calendar, Users, Edit2, Plus, Trash2, ClipboardList, Link2, AlertCircle, CheckSquare, Bug, TrendingUp, Shield, Wrench, X } from 'lucide-react'
import ActionPlanFormShared from '../components/ActionPlanFormShared'
import ActionPlanDetailPanel from '../components/ActionPlanDetailPanel'
import ActionPlanViews from '../components/ActionPlanViews'
import PresenzeWidget from '../components/widgets/PresenzeWidget'
import ParetoChart from '../components/pillar/ParetoChart'
import BridgeChart from '../components/pillar/BridgeChart'
import CloseTheLoopChart from '../components/pillar/CloseTheLoopChart'
import SkillMatrixTab from '../components/pillar/SkillMatrixTab'
import StoricoAnalisiModal from '../components/pillar/StoricoAnalisiModal'

export default function PillarDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [pillar, setPillar] = useState(null)
  const [stats, setStats] = useState(null)
  const [kaizens, setKaizens] = useState([])
  const [actionPlans, setActionPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('anagrafica')

  useEffect(() => { loadAll() }, [id])

  async function loadAll() {
    setLoading(true)
    try {
      const [pillarRes, statsRes, kaizensRes, apsRes] = await Promise.all([
        api.get(`/pillars/${id}`),
        api.get(`/pillars/${id}/stats`),
        api.get(`/pillars/${id}/kaizens`),
        api.get(`/action-plans/?pillar_id=${id}`),
      ])
      setPillar(pillarRes.data)
      setStats(statsRes.data)
      setKaizens(kaizensRes.data || [])
      setActionPlans(apsRes.data || [])
    } catch (err) {
      console.error(err)
      alert('Errore caricamento pillar')
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="bg-white rounded-xl shadow p-12 text-center text-gray-400">Caricamento pillar...</div>
  if (!pillar) {
    return (
      <div className="bg-white rounded-xl shadow p-12 text-center">
        <h3 className="font-semibold mb-2">Pillar non trovato</h3>
        <button onClick={() => navigate('/pillars')} className="text-primary hover:underline">← Torna ai Pillars</button>
      </div>
    )
  }

  const color = pillar.color || '#6366f1'
  const stepsCompleted = stats?.steps_completed || 0
  const stepsTotal = stats?.steps_total || 5

  const tabs = [
    { id: 'anagrafica', label: 'Anagrafica' },
    { id: 'kaizen', label: `Kaizen (${kaizens.length})` },
    { id: 'action_plan', label: `Action Plan (${actionPlans.length})` },
    { id: 'skill_matrix', label: 'Skill Matrix' },
    { id: 'maturity', label: 'Maturity Grid' },
    ...(pillar.kpi_management_enabled !== false ? [{ id: 'kpi', label: `5 Step KPI (${stepsCompleted}/${stepsTotal})` }] : []),
    ...(pillar.mp_info_enabled ? [{ id: 'mp_info', label: 'MP Info' }] : []),
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <button onClick={() => navigate('/pillars')} className="flex items-center gap-1 hover:text-primary">
          <ArrowLeft size={16} /> Pillars
        </button>
        <span>/</span>
        <span className="font-medium text-gray-700">{pillar.sigla}</span>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-300 pb-4">
        <div className="flex items-center gap-4 min-w-0 flex-1">
          {pillar.icon_image && <img src={pillar.icon_image} alt="" className="h-16 w-16 shrink-0 object-contain" onError={event => { event.currentTarget.style.display = 'none' }} />}
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 break-words">{pillar.sigla} · {pillar.label}</h1>
            {pillar.descrizione && <p className="text-sm text-gray-600 mt-1">{pillar.descrizione}</p>}
            <p className="text-xs text-gray-500 mt-2">{[pillar.leader, pillar.anno, pillar.attivo === false ? 'Disattivo' : 'Attivo'].filter(Boolean).join(' · ')}</p>
          </div>
        </div>
        <button type="button" onClick={() => navigate('/settings')} className="border border-gray-300 rounded px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">Modifica pilastro</button>
      </header>
      <div className="flex gap-1 border-b overflow-x-auto">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-4 py-2 font-medium text-sm whitespace-nowrap transition-colors ${activeTab === tab.id ? 'border-b-2 text-primary' : 'text-gray-500 hover:text-gray-700'}`} style={activeTab === tab.id ? { borderColor: color, color } : {}}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'mp_info' && pillar.mp_info_enabled && <MpInfoPanel pillar={pillar} />}
      {activeTab === 'anagrafica' && <AnagraficaTab key={pillar._id} pillar={pillar} color={color} onSaved={loadAll} />}
      {activeTab === 'kpi' && pillar.kpi_management_enabled !== false && <KpiManagementTab pillar={pillar} color={color} onSaved={loadAll} />}
      {activeTab === 'masterplan' && <MasterPlanTab pillar={pillar} color={color} onSaved={loadAll} />}
      {activeTab === 'kaizen' && <KaizenList kaizens={kaizens} pillar={pillar} />}
      {activeTab === 'action_plan' && <ActionPlanTab actionPlans={actionPlans} pillar={pillar} color={color} onReload={loadAll} />}
      {activeTab === 'skill_matrix' && <SkillMatrixTab pillar={pillar} color={color} />}
      {activeTab === 'maturity' && <MaturityPlaceholder color={color} />}
    </div>
  )
}

function ActionPlanTab({ actionPlans, pillar, color, onReload }) {
  const [showForm, setShowForm] = useState(false)
  const [editingAP, setEditingAP] = useState(null)
  const [filterStato, setFilterStato] = useState('')
  const [selectedAP, setSelectedAP] = useState(null)

  const { configs } = useAllConfigurations()
  const statiConfig = configs.stato_ap || []

  const prefilledPillar = {
    parent_type: 'pillar',
    parent_id: pillar._id,
    parent_label: pillar.sigla,
    pillar_id: pillar._id,
  }

  function handleSaved() {
    setShowForm(false)
    setEditingAP(null)
    onReload()
  }

  async function changeStato(ap, nuovoStato) {
    try {
      await api.patch(`/action-plans/${ap._id}/stato`, { stato: nuovoStato })
      onReload()
    } catch (err) {
      alert('Errore: ' + (err.response?.data?.detail || err.message))
    }
  }

  async function unlinkAP(ap) {
    if (!confirm(`Scollegare ${ap.numero} dal Pillar ${pillar.sigla}?\nL'AP rimane nel sistema ma non sarà più collegato a questo Pillar.`)) return
    try {
      await api.put(`/action-plans/${ap._id}`, {
        parent_type: 'standalone',
        parent_id: null,
        parent_label: null,
        pillar_id: null,
      })
      onReload()
    } catch (err) {
      alert('Errore: ' + (err.response?.data?.detail || err.message))
    }
  }

  async function deleteAP(ap) {
    if (!confirm(`ELIMINA ${ap.numero}?\n\nQuesto rimuove l'Action Plan in modo permanente.`)) return
    try {
      await api.delete(`/action-plans/${ap._id}`)
      onReload()
    } catch (err) {
      alert('Errore: ' + (err.response?.data?.detail || err.message))
    }
  }

  async function cancelAP(plan) {
    const reason = prompt(
      `Annullare l'Action Plan "${plan.numero} - ${plan.titolo}"?\n\nInserisci il motivo (obbligatorio):`
    )
    if (!reason || !reason.trim()) return
    try {
      await api.post(`/action-plans/${plan._id}/cancel`, {
        reason: reason.trim(),
        user: 'Default User',
      })
      onReload()
    } catch (err) {
      alert('Errore annullamento: ' + (err.response?.data?.detail || err.message))
    }
  }

  async function restoreAP(plan) {
    if (!confirm(`Ripristinare l'Action Plan "${plan.numero}"?`)) return
    try {
      await api.post(`/action-plans/${plan._id}/restore`)
      onReload()
    } catch (err) {
      alert('Errore ripristino: ' + (err.response?.data?.detail || err.message))
    }
  }

  const counts = {
    totale: actionPlans.length,
    da_valutare: actionPlans.filter(a => a.stato === 'Da Valutare').length,
    in_corso: actionPlans.filter(a => a.stato === 'In Corso').length,
    done: actionPlans.filter(a => a.stato === 'Done').length,
    overdue: actionPlans.filter(a => a.stato_visuale === 'In Ritardo').length,
  }

  const actionPlansFiltrati = actionPlans.filter(ap => {
    if (filterStato && ap.stato !== filterStato) return false
    return true
  })

  return (
    <div className="space-y-4">
      {/* Header con counts + filtri + bottone */}
      <div className="bg-white rounded-xl shadow p-4">
        <div className="flex justify-between items-center mb-3">
          <div>
            <h3 className="font-bold text-lg flex items-center gap-2">
              <ClipboardList size={20} style={{ color }} />
              Action Plan collegati a {pillar.sigla}
            </h3>
            <div className="flex gap-4 text-xs text-gray-500 mt-1">
              <span>Totale: <strong className="text-gray-700">{counts.totale}</strong></span>
              <span>Da valutare: <strong className="text-gray-700">{counts.da_valutare}</strong></span>
              <span>In corso: <strong className="text-blue-600">{counts.in_corso}</strong></span>
              <span>Done: <strong className="text-green-600">{counts.done}</strong></span>
              {counts.overdue > 0 && (
                <span>Scaduti: <strong className="text-red-600">{counts.overdue}</strong></span>
              )}
            </div>
          </div>
          <button
            onClick={() => { setEditingAP(null); setShowForm(true) }}
            className="text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow"
            style={{ backgroundColor: color }}
          >
            <Plus size={16} /> Nuovo Action Plan
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap mt-2 pt-3 border-t">
          <span className="text-xs font-medium text-gray-600">Filtri:</span>
          <select
            value={filterStato}
            onChange={(e) => setFilterStato(e.target.value)}
            className="text-xs border rounded px-2 py-1"
          >
            <option value="">Tutti gli stati</option>
            {statiConfig.map(s => (
              <option key={s._id} value={s.label}>{s.label}</option>
            ))}
          </select>
          {filterStato && (
            <button
              onClick={() => setFilterStato('')}
              className="text-xs px-2 py-1 border rounded text-gray-600 hover:bg-gray-100"
            >
              Reset
            </button>
          )}
          <span className="text-xs text-gray-500 ml-auto">
            {actionPlansFiltrati.length} azion{actionPlansFiltrati.length === 1 ? 'e' : 'i'} visualizzate
          </span>
        </div>
      </div>

      {/* ActionPlanViews riusabile */}
      <ActionPlanViews
        plans={actionPlansFiltrati}
        statiConfig={statiConfig}
        onSelectAP={setSelectedAP}
        onEditAP={(p) => { setEditingAP(p); setShowForm(true) }}
        onDeleteAP={deleteAP}
        onUnlinkAP={unlinkAP}
        onChangeStato={changeStato}
        unlinkLabel="Scollega dal Pillar"
        showCollegato={false}
        showStepGant={false}
        showKanban={true}
        showCalendar={true}
        defaultView="list"
        emptyMessage={
          actionPlans.length === 0
            ? 'Nessun Action Plan collegato a questo pillar'
            : 'Nessun risultato per i filtri impostati'
        }
        emptyAction={
          actionPlans.length === 0
            ? { label: '+ Crea il primo Action Plan', onClick: () => { setEditingAP(null); setShowForm(true) } }
            : null
        }
      />

      {/* Modal form */}
      {showForm && (
        <ActionPlanFormShared
          plan={editingAP}
          prefilledKaizen={null}
          prefilledParent={editingAP ? null : prefilledPillar}
          onClose={() => { setShowForm(false); setEditingAP(null) }}
          onSaved={handleSaved}
        />
      )}

      {/* Pannello dettaglio */}
      {selectedAP && (
        <ActionPlanDetailPanel
          plan={selectedAP}
          onClose={() => setSelectedAP(null)}
          onUpdated={onReload}
          onEdit={(p) => { setSelectedAP(null); setEditingAP(p); setShowForm(true) }}
          onCancel={async (p) => { await cancelAP(p); setSelectedAP(null) }}
          onRestore={async (p) => { await restoreAP(p); setSelectedAP(null) }}
          onDelete={async (apId) => { await deleteAP({ _id: apId, numero: selectedAP.numero }); setSelectedAP(null) }}
        />
      )}
    </div>
  )
}

function StatBlock({ label, value, color = 'gray' }) {
  const colors = { gray: 'text-gray-700', indigo: 'text-indigo-700', green: 'text-emerald-700', blue: 'text-blue-700', purple: 'text-purple-700', orange: 'text-orange-700' }
  return (
    <div className="text-center">
      <div className={`text-2xl font-bold ${colors[color]}`}>{value ?? '—'}</div>
      <div className="text-xs text-gray-500 uppercase">{label}</div>
    </div>
  )
}

function InfoRow({ label, value, mono = false }) {
  return (
    <div className="flex justify-between items-baseline">
      <span className="text-gray-500 text-xs uppercase">{label}</span>
      <span className={`font-medium ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  )
}

function AnagraficaTab({ pillar, color, onSaved }) {
  const [savingPresenze, setSavingPresenze] = useState(false)
  const [presenzeConfig, setPresenzeConfig] = useState(pillar.presenze_config || {})

  // Sincronizza quando il pillar cambia (dopo reload del parent)
  useEffect(() => {
    setPresenzeConfig(pillar.presenze_config || {})
  }, [pillar.presenze_config])

  async function handlePresenzeChange(newConfig) {
    setPresenzeConfig(newConfig)  // ottimistico: mantieni in UI
    setSavingPresenze(true)
    try {
      const res = await api.put(`/pillars/${pillar._id}`, {
        presenze_config: newConfig,
      })
      console.log('Salvato presenze_config:', res.data?.presenze_config)
    } catch (err) {
      console.error('Errore salvataggio presenze:', err)
      alert('Errore salvataggio: ' + (err.response?.data?.detail || err.message))
    } finally {
      setSavingPresenze(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Riga 1: Info + Team */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="font-bold text-lg mb-4">Informazioni Pillar</h3>
          <div className="space-y-3 text-sm">
            <InfoRow label="Sigla" value={pillar.sigla} mono />
            <InfoRow label="Nome completo" value={pillar.label} />
            <InfoRow label="Anno di riferimento" value={pillar.anno || '—'} />
            <InfoRow label="Codice colore" value={pillar.color || '—'} mono />
            <InfoRow label="Stato" value={pillar.attivo ? 'Attivo' : 'Disattivo'} />
            {pillar.descrizione && (
              <div>
                <div className="text-gray-500 text-xs uppercase mb-1">Descrizione</div>
                <div className="bg-gray-50 p-3 rounded text-sm">{pillar.descrizione}</div>
              </div>
            )}
          </div>
        </div>
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="font-bold text-lg mb-4">Team del Pillar</h3>
          <div className="space-y-3">
            {pillar.leader && (
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded">
                <div className="text-xs text-yellow-700 font-bold uppercase mb-1">Pillar Leader</div>
                <div className="font-semibold text-gray-800">{pillar.leader}</div>
              </div>
            )}
            {pillar.members?.length > 0 ? (
              <div>
                <div className="text-xs text-gray-500 uppercase font-medium mb-2">Membri del Team ({pillar.members.length})</div>
                <div className="space-y-1">
                  {pillar.members.map((m, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 bg-gray-50 rounded text-sm">
                      <User size={14} className="text-gray-400" />{m}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-400 italic text-center py-4">Nessun membro nel team</div>
            )}
          </div>
        </div>
      </div>

      {/* Note (se presente, full width) */}
      {pillar.note && (
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="font-bold text-lg mb-3">Note</h3>
          <div className="bg-gray-50 p-4 rounded text-sm whitespace-pre-wrap">{pillar.note}</div>
        </div>
      )}

      <details className="border-t pt-4" open>
        <summary className="font-semibold cursor-pointer mb-3">Masterplan del pilastro</summary>
        <MasterPlanTab pillar={pillar} color={color} onSaved={onSaved} />
      </details>
      {/* Calendario Presenze (full width) */}
      <div className="bg-white rounded-xl shadow p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-lg">Calendario Presenze riunioni Pillar</h3>
          {savingPresenze && <span className="text-xs text-blue-600">Salvataggio...</span>}
        </div>
        <div style={{ minHeight: '300px' }}>
          <PresenzeWidget
            config={presenzeConfig}
            editMode={true}
            onChange={handlePresenzeChange}
          />
        </div>
      </div>
    </div>
  )
}

const UNITS = [
  { value: '%', label: '% (percentuale)' },
  { value: 'nr', label: 'nr (numero/pezzi)' },
  { value: '€', label: '€ (euro/saving)' },
  { value: 'min', label: 'min (minuti)' },
  { value: 'h', label: 'h (ore)' },
  { value: 'kg', label: 'kg (peso)' },
]

const KPI_STEPS = [
  { id: 'step1_kpi_definition', num: 1, title: 'KPI / KMI Definition', desc: 'Definisci il KPI principale del Pillar' },
  { id: 'step2_pareto_analysis', num: 2, title: 'Pareto Analysis & Loss Identification', desc: 'Identifica e prioritizza le perdite' },
  { id: 'step3_target_definition', num: 3, title: 'Project Planning & Assignment', desc: 'Pianifica progetti per chiudere il gap' },
  { id: 'step4_implementation', num: 4, title: 'Project Implementation', desc: 'Esegui e monitora i progetti' },
  { id: 'step5_close_the_loop', num: 5, title: 'Gap Analysis & Close the Loop', desc: 'Bridge chart target vs actual' },
]

const PROGETTO_STATUS = [
  { value: 'planned', label: 'Planned', color: 'bg-gray-100 text-gray-700 border-gray-300' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-yellow-100 text-yellow-700 border-yellow-400' },
  { value: 'done', label: 'Done', color: 'bg-green-100 text-green-700 border-green-400' },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-red-100 text-red-700 border-red-300' },
]

const ACTUAL_STATUS = [
  { value: 'not_started', label: 'Not started', color: 'bg-gray-100 text-gray-700 border-gray-300' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-yellow-100 text-yellow-700 border-yellow-400' },
  { value: 'done', label: 'Done', color: 'bg-green-100 text-green-700 border-green-400' },
  { value: 'blocked', label: 'Blocked', color: 'bg-orange-100 text-orange-700 border-orange-300' },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-red-100 text-red-700 border-red-300' },
]
function KpiManagementTab({ pillar, color, onSaved }) {
  const [analyses, setAnalyses] = useState([])
  const [activeAnalysisId, setActiveAnalysisId] = useState(null)
  const [stepsData, setStepsData] = useState({})
  const [expandedStep, setExpandedStep] = useState(KPI_STEPS[0].id)
  const [saving, setSaving] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [lastSaved, setLastSaved] = useState(null)
  const [loadingAnalyses, setLoadingAnalyses] = useState(true)

  // Modal states
  const [showNewModal, setShowNewModal] = useState(false)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [newLabel, setNewLabel] = useState('')

  const dataRef = useRef(stepsData)
  const activeIdRef = useRef(activeAnalysisId)

  useEffect(() => { dataRef.current = stepsData }, [stepsData])
  useEffect(() => { activeIdRef.current = activeAnalysisId }, [activeAnalysisId])

  // Carica analisi all'avvio
  useEffect(() => { loadAnalyses() }, [pillar._id])

  async function loadAnalyses() {
    setLoadingAnalyses(true)
    try {
      const res = await api.get(`/pillars/${pillar._id}/analyses`)
      const list = res.data || []
      setAnalyses(list)

      // Seleziona la prima attiva (o la prima in assoluto)
      const firstActive = list.find(a => a.status === 'active') || list[0]
      if (firstActive) {
        selectAnalysis(firstActive.id, list)
      } else {
        // Nessuna analisi: crea quella default
        const newRes = await api.post(`/pillars/${pillar._id}/analyses`, {
          label: `Analisi ${new Date().getFullYear()}`,
        })
        const created = newRes.data
        setAnalyses([created])
        selectAnalysis(created.id, [created])
      }
    } catch (err) {
      console.error('Errore caricamento analisi:', err)
      alert('Errore caricamento analisi')
    } finally {
      setLoadingAnalyses(false)
    }
  }

  function selectAnalysis(analysisId, list = analyses) {
    const a = list.find(x => x.id === analysisId)
    if (!a) return
    setActiveAnalysisId(analysisId)

    // Estrai i 5 step dall'analisi (con default vuoti)
    const initial = {}
    KPI_STEPS.forEach(s => {
      initial[s.id] = a[s.id] || { completato: false, note: '' }
    })
    setStepsData(initial)
    setHasUnsavedChanges(false)
    setLastSaved(null)
  }

  // Salva i 5 step nell'analisi corrente
  async function doSave(silent = false) {
    const aid = activeIdRef.current
    if (!aid) return
    if (!silent) setSaving(true)
    try {
      await api.put(`/pillars/${pillar._id}/analyses/${aid}`, dataRef.current)
      if (!silent) { setLastSaved(new Date()); setHasUnsavedChanges(false) }
    } catch (err) {
      console.error(err)
      if (!silent) alert('Errore salvataggio: ' + (err.response?.data?.detail || err.message))
    } finally {
      if (!silent) setSaving(false)
    }
  }

  // Autosave debounced
  useEffect(() => {
    if (!activeAnalysisId) return
    const original = analyses.find(a => a.id === activeAnalysisId)
    if (!original) return

    const originalSteps = {}
    KPI_STEPS.forEach(s => {
      originalSteps[s.id] = original[s.id] || { completato: false, note: '' }
    })

    if (JSON.stringify(stepsData) === JSON.stringify(originalSteps)) return

    setHasUnsavedChanges(true)
    const timer = setTimeout(() => doSave(false), 700)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepsData])

  function updateStep(stepId, updates) {
    setStepsData(prev => ({
      ...prev,
      [stepId]: { ...prev[stepId], ...updates },
    }))
  }

  // Nuova analisi
  async function createNewAnalysis() {
    const label = newLabel.trim() || `Analisi ${new Date().toISOString().slice(0, 10)}`
    try {
      const res = await api.post(`/pillars/${pillar._id}/analyses`, { label })
      const created = res.data
      const newList = [...analyses, created]
      setAnalyses(newList)
      setShowNewModal(false)
      setNewLabel('')
      selectAnalysis(created.id, newList)
    } catch (err) {
      alert('Errore creazione: ' + (err.response?.data?.detail || err.message))
    }
  }

  // Archivia
  async function archiveCurrent() {
    if (!activeAnalysisId) return
    const current = analyses.find(a => a.id === activeAnalysisId)
    if (!current) return
    if (!confirm(`Archiviare "${current.label}"?\nNon potrà più essere modificata, ma resta consultabile nello Storico.`)) return
    try {
      await api.post(`/pillars/${pillar._id}/analyses/${activeAnalysisId}/archive`)
      // Ricarica
      const res = await api.get(`/pillars/${pillar._id}/analyses`)
      const newList = res.data || []
      setAnalyses(newList)
      // Switch sulla prima attiva o crea nuova
      const firstActive = newList.find(a => a.status === 'active')
      if (firstActive) {
        selectAnalysis(firstActive.id, newList)
      } else {
        // Nessuna attiva: crea
        const cr = await api.post(`/pillars/${pillar._id}/analyses`, {
          label: `Analisi ${new Date().getFullYear()}`,
        })
        const updated = [...newList, cr.data]
        setAnalyses(updated)
        selectAnalysis(cr.data.id, updated)
      }
    } catch (err) {
      alert('Errore archivio: ' + (err.response?.data?.detail || err.message))
    }
  }

  // Ripristina (dalla modale storico)
  async function restoreAnalysis(id) {
    try {
      await api.post(`/pillars/${pillar._id}/analyses/${id}/restore`)
      const res = await api.get(`/pillars/${pillar._id}/analyses`)
      setAnalyses(res.data || [])
    } catch (err) {
      alert('Errore ripristino: ' + (err.response?.data?.detail || err.message))
    }
  }

  // Apri (dalla modale storico)
  function openFromHistory(id) {
    setShowHistoryModal(false)
    selectAnalysis(id)
  }

  // Elimina definitivamente
  async function deletePermanently(id) {
    if (!confirm('Eliminare definitivamente questa analisi? Non sarà più recuperabile.')) return
    try {
      await api.delete(`/pillars/${pillar._id}/analyses/${id}`)
      const res = await api.get(`/pillars/${pillar._id}/analyses`)
      const newList = res.data || []
      setAnalyses(newList)
      if (activeAnalysisId === id) {
        const firstActive = newList.find(a => a.status === 'active') || newList[0]
        if (firstActive) selectAnalysis(firstActive.id, newList)
      }
    } catch (err) {
      alert('Errore eliminazione: ' + (err.response?.data?.detail || err.message))
    }
  }

  if (loadingAnalyses) {
    return <div className="bg-white rounded-xl shadow p-12 text-center text-gray-400">Caricamento analisi...</div>
  }

  const currentAnalysis = analyses.find(a => a.id === activeAnalysisId)
  const isArchived = currentAnalysis?.status === 'archived'
  const activeAnalyses = analyses.filter(a => a.status === 'active')
  const archivedAnalyses = analyses.filter(a => a.status === 'archived')

  const completedCount = Object.values(stepsData).filter(s => s?.completato).length

  return (
    <div className="space-y-4">
      {/* Selettore Analisi */}
      <div className="bg-white rounded-xl shadow p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[280px]">
            <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Analisi attiva</label>
            <select
              value={activeAnalysisId || ''}
              onChange={(e) => selectAnalysis(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm font-medium"
            >
              <optgroup label="Attive">
                {activeAnalyses.map(a => (
                  <option key={a.id} value={a.id}>{a.label}</option>
                ))}
              </optgroup>
              {archivedAnalyses.length > 0 && (
                <optgroup label="Archiviate">
                  {archivedAnalyses.map(a => (
                    <option key={a.id} value={a.id}>{a.label} (archiviata)</option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => { setNewLabel(''); setShowNewModal(true) }}
              className="px-3 py-2 rounded-lg text-sm text-white shadow"
              style={{ backgroundColor: color }}
            >
              + Nuova analisi
            </button>
            {!isArchived && currentAnalysis && (
              <button
                onClick={archiveCurrent}
                className="px-3 py-2 rounded-lg text-sm border-2 hover:bg-gray-50"
                style={{ borderColor: color, color }}
              >
                Archivia
              </button>
            )}
            <button
              onClick={() => setShowHistoryModal(true)}
              className="px-3 py-2 rounded-lg text-sm border-2 border-gray-300 hover:bg-gray-50"
            >
              Storico ({analyses.length})
            </button>
          </div>
        </div>

        {/* Info analisi corrente */}
        {currentAnalysis && (
          <div className="mt-3 pt-3 border-t flex flex-wrap items-center gap-4 text-xs text-gray-500">
            <span>
              Creata: <strong className="text-gray-700">{new Date(currentAnalysis.created_at).toLocaleDateString('it-IT')}</strong>
            </span>
            {currentAnalysis.archived_at && (
              <span>
                Archiviata: <strong className="text-gray-700">{new Date(currentAnalysis.archived_at).toLocaleDateString('it-IT')}</strong>
              </span>
            )}
            <span>
              Step completati: <strong className="text-gray-700">{completedCount}/5</strong>
            </span>
            <span className="ml-auto">
              {saving ? <span className="text-blue-600">Salvataggio...</span> :
               hasUnsavedChanges ? <span className="text-orange-600">Non salvato</span> :
               lastSaved ? <span className="text-green-600">Salvato {lastSaved.toLocaleTimeString('it-IT')}</span> :
               <span className="text-gray-400">Pronto</span>}
            </span>
          </div>
        )}
      </div>

      {/* Banner read-only se archiviata */}
      {isArchived && (
        <div className="bg-gray-100 border-l-4 border-gray-500 rounded-r-lg p-3 flex items-center justify-between">
          <div className="text-sm text-gray-700">
            <strong>Analisi archiviata.</strong> Modalità sola lettura. Per modificare, ripristinala dallo Storico.
          </div>
          <button
            onClick={() => restoreAnalysis(activeAnalysisId).then(() => loadAnalyses())}
            className="px-3 py-1 text-sm border-2 border-gray-500 text-gray-700 rounded hover:bg-white"
          >
            Ripristina
          </button>
        </div>
      )}

      {/* Steps con fieldset disabled se archived */}
      <fieldset disabled={isArchived} className={isArchived ? 'opacity-75 pointer-events-none' : ''}>
        <div className="bg-white rounded-xl shadow p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-xl font-bold mb-1">5 Step KPI Management</h3>
              <p className="text-sm text-gray-500">
                {currentAnalysis?.label || 'Nessuna analisi'} — Pillar <strong>{pillar.sigla}</strong>
              </p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold" style={{ color }}>{completedCount}/5</div>
              <div className="text-xs text-gray-500 uppercase">Step Completati</div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {KPI_STEPS.map((step, idx) => {
              const isCompleted = stepsData[step.id]?.completato
              const isExpanded = expandedStep === step.id
              return (
                <div key={step.id} className="flex-1 flex items-center">
                  <button
                    onClick={() => setExpandedStep(isExpanded ? null : step.id)}
                    className={`flex flex-col items-center flex-shrink-0 transition-all ${isExpanded ? 'scale-110' : ''}`}
                  >
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold shadow ${isCompleted ? 'text-white' : 'bg-white border-2 text-gray-400'}`}
                      style={isCompleted ? { backgroundColor: color } : { borderColor: color }}
                    >
                      {isCompleted ? '✓' : step.num}
                    </div>
                    <div className={`text-xs mt-1 font-medium ${isExpanded ? '' : 'text-gray-500'}`} style={isExpanded ? { color } : {}}>
                      Step {step.num}
                    </div>
                  </button>
                  {idx < KPI_STEPS.length - 1 && (
                    <div className="flex-1 h-1 mx-1 rounded" style={{ backgroundColor: isCompleted ? color : '#e5e7eb' }} />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {KPI_STEPS.map(step => {
          const data = stepsData[step.id] || { completato: false, note: '' }
          const isExpanded = expandedStep === step.id
          const isCompleted = data?.completato
          return (
            <div
              key={step.id}
              className="bg-white rounded-xl shadow overflow-hidden transition-all"
              style={{ borderLeft: `4px solid ${isCompleted ? color : '#e5e7eb'}` }}
            >
              <button
                onClick={() => setExpandedStep(isExpanded ? null : step.id)}
                className="w-full px-5 py-4 flex items-center gap-3 hover:bg-gray-50 transition-colors"
                type="button"
              >
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold flex-shrink-0 ${isCompleted ? 'text-white' : 'bg-gray-100 text-gray-500'}`}
                  style={isCompleted ? { backgroundColor: color } : {}}
                >
                  {isCompleted ? '✓' : step.num}
                </div>
                <div className="flex-1 text-left">
                  <div className="font-semibold flex items-center gap-2">
                    STEP {step.num} — {step.title}
                    {isCompleted && <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">Completato</span>}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">{step.desc}</div>
                </div>
                <div className="text-gray-400">{isExpanded ? '▲' : '▼'}</div>
              </button>
              {isExpanded && (
                <div className="px-5 pb-5 pt-2 border-t bg-gray-50">
                  <StepContent
                    step={step}
                    data={data}
                    color={color}
                    onUpdate={(updates) => updateStep(step.id, updates)}
                    allStepsData={stepsData}
                    pillar={pillar}
                  />
                  <div className="mt-4 pt-4 border-t space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 uppercase mb-1">Note dello step</label>
                      <textarea
                        value={data.note || ''}
                        onChange={(e) => updateStep(step.id, { note: e.target.value })}
                        rows={3}
                        className="w-full border rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                    <label className="flex items-center gap-3 p-3 bg-white border-2 rounded-lg cursor-pointer hover:bg-gray-50" style={{ borderColor: isCompleted ? color : '#e5e7eb' }}>
                      <input
                        type="checkbox"
                        checked={isCompleted}
                        onChange={(e) => updateStep(step.id, { completato: e.target.checked })}
                        className="w-5 h-5"
                        style={{ accentColor: color }}
                      />
                      <div className="flex-1">
                        <div className="font-medium text-sm">{isCompleted ? 'Step Completato' : 'Marca come completato'}</div>
                        <div className="text-xs text-gray-500">{isCompleted ? 'Lo step è considerato concluso.' : 'Spunta quando hai finito le attività di questo step.'}</div>
                      </div>
                    </label>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </fieldset>

      {/* Modal Nuova Analisi */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-5 py-3 border-b flex justify-between items-center" style={{ backgroundColor: color, color: 'white' }}>
              <h3 className="font-bold">Nuova Analisi</h3>
              <button onClick={() => setShowNewModal(false)} className="text-white hover:bg-white hover:bg-opacity-20 p-1 rounded">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-600 mb-1">
                  Nome analisi
                </label>
                <input
                  type="text"
                  autoFocus
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && createNewAnalysis()}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  placeholder="Es: Bindler 11 - Anno 2026"
                />
                <div className="text-xs text-gray-500 mt-1">
                  L'analisi viene creata vuota, da compilare da zero.
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  onClick={() => setShowNewModal(false)}
                  className="px-4 py-2 border rounded-lg text-sm"
                >
                  Annulla
                </button>
                <button
                  onClick={createNewAnalysis}
                  className="px-4 py-2 text-white rounded-lg text-sm"
                  style={{ backgroundColor: color }}
                >
                  Crea analisi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Storico con cartelle */}
      {showHistoryModal && (
        <StoricoAnalisiModal
          pillar={pillar}
          color={color}
          analyses={analyses}
          onClose={() => setShowHistoryModal(false)}
          onOpen={openFromHistory}
          onRestore={restoreAnalysis}
          onDelete={deletePermanently}
          onReloadAnalyses={async () => {
            const res = await api.get(`/pillars/${pillar._id}/analyses`)
            setAnalyses(res.data || [])
          }}
        />
      )}
    </div>
  )
}

function StepContent({ step, data, color, onUpdate, allStepsData, pillar }) {
  if (step.id === 'step1_kpi_definition') return <Step1Content data={data} color={color} onUpdate={onUpdate} pillar={pillar} />
  if (step.id === 'step2_pareto_analysis') return <Step2Content data={data} color={color} onUpdate={onUpdate} pillar={pillar} />
  if (step.id === 'step3_target_definition') return <Step3Content data={data} color={color} onUpdate={onUpdate} lossesStep2={allStepsData?.step2_pareto_analysis?.losses || []} pillar={pillar} allStepsData={allStepsData} />
  if (step.id === 'step4_implementation') return <Step4Content data={data} color={color} onUpdate={onUpdate} allStepsData={allStepsData} pillar={pillar} />
  if (step.id === 'step5_close_the_loop') return <Step5Content data={data} color={color} onUpdate={onUpdate} allStepsData={allStepsData} pillar={pillar} />
  return null
}

function Step1Content({ data, color, onUpdate }) {
  const kpiPrincipale = data.kpi_principale || { label: '', baseline: '', target: '', unit: '%', descrizione: '' }

  function updateKpiPrincipale(field, value) {
    const newKpi = { ...kpiPrincipale }
    newKpi[field] = value
    onUpdate({ kpi_principale: newKpi })
  }

  return (
    <div className="space-y-4 mt-3">
      <div className="bg-blue-50 border-l-4 border-blue-400 rounded-r-lg p-3 text-sm text-blue-800">
        <strong>Cosa fare:</strong> Definisci il KPI che vuoi migliorare. Inserisci dove sei oggi e dove vuoi arrivare.
      </div>

      <div className="bg-white p-4 rounded-lg border-2" style={{ borderColor: color }}>
        <h4 className="font-bold text-sm uppercase mb-1" style={{ color }}>KPI Principale</h4>
        <p className="text-xs text-gray-500 mb-3">Esempio: OEE, MTBF, % Scarti, Tempo Setup</p>

        <div className="grid grid-cols-12 gap-2 mb-2">
          <div className="col-span-5">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Nome KPI <span className="text-red-500">*</span>
            </label>
            <input
              className="w-full border rounded px-3 py-2 text-sm font-bold"
              value={kpiPrincipale.label}
              onChange={(e) => updateKpiPrincipale('label', e.target.value)}
              placeholder="Es: OEE"
            />
          </div>
          <div className="col-span-3">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Valore attuale (oggi)
            </label>
            <input
              type="number"
              step="0.1"
              className="w-full border rounded px-3 py-2 text-sm"
              value={kpiPrincipale.baseline}
              onChange={(e) => updateKpiPrincipale('baseline', e.target.value)}
              placeholder="Es: 90"
            />
          </div>
          <div className="col-span-3">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Obiettivo (target)
            </label>
            <input
              type="number"
              step="0.1"
              className="w-full border rounded px-3 py-2 text-sm"
              value={kpiPrincipale.target}
              onChange={(e) => updateKpiPrincipale('target', e.target.value)}
              placeholder="Es: 92"
            />
          </div>
          <div className="col-span-1">
            <label className="block text-xs font-medium text-gray-600 mb-1">Unità</label>
            <input
              className="w-full border rounded px-3 py-2 text-sm"
              value={kpiPrincipale.unit}
              onChange={(e) => updateKpiPrincipale('unit', e.target.value)}
              placeholder="%"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Descrizione (opzionale)</label>
          <input
            className="w-full border rounded px-3 py-2 text-sm"
            value={kpiPrincipale.descrizione}
            onChange={(e) => updateKpiPrincipale('descrizione', e.target.value)}
            placeholder="Come misuriamo questo KPI?"
          />
        </div>

        {kpiPrincipale.baseline && kpiPrincipale.target && (
          <div className="mt-3 pt-3 border-t flex items-center gap-3 text-sm">
            <span className="text-gray-500">Da migliorare:</span>
            <span className="font-mono text-lg font-bold" style={{ color }}>
              {kpiPrincipale.baseline} → {kpiPrincipale.target} {kpiPrincipale.unit}
            </span>
            <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-bold">
              Δ {(parseFloat(kpiPrincipale.target) - parseFloat(kpiPrincipale.baseline)).toFixed(1)} {kpiPrincipale.unit}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

function Step2Content({ data, color, onUpdate, pillar }) {
  const losses = data.losses || []
  const unit = data.unit || '%'
  const { configs } = useAllConfigurations()
  const clustersConfig = configs.cluster_perdita || []

  function addLoss() {
    onUpdate({
      losses: [...losses, {
        id: Date.now().toString(),
        label: '',
        value: '',
        cluster_id: '',
      }]
    })
  }
  function updateLoss(id, updates) {
    onUpdate({ losses: losses.map(l => l.id === id ? { ...l, ...updates } : l) })
  }
  function removeLoss(id) {
    onUpdate({ losses: losses.filter(l => l.id !== id) })
  }
  function updateUnit(newUnit) { onUpdate({ unit: newUnit }) }

  // Trova il colore del cluster automaticamente
  function getClusterColor(clusterId) {
    const cluster = clustersConfig.find(c => c._id === clusterId)
    return cluster?.color || '#9CA3AF'  // grigio default
  }

  function getClusterLabel(clusterId) {
    const cluster = clustersConfig.find(c => c._id === clusterId)
    return cluster?.label || ''
  }

  // Sort decrescente
  const sortedLosses = [...losses].sort((a, b) =>
    (parseFloat(b.value) || 0) - (parseFloat(a.value) || 0)
  )

  // Dati per Pareto chart con colore dal cluster
  const lossesForChart = sortedLosses.map(l => ({
    id: l.id,
    label: l.label || getClusterLabel(l.cluster_id) || 'Senza nome',
    value: parseFloat(l.value) || 0,
    color: getClusterColor(l.cluster_id),
  }))

  return (
    <div className="space-y-3 mt-3">
      {/* Spiegazione */}
      <div className="bg-blue-50 border-l-4 border-blue-400 rounded-r-lg p-3 text-sm text-blue-800">
        <strong>Cosa fare:</strong> Elenca le perdite che impattano il KPI. Associa ogni perdita a un <strong>cluster</strong> (es. Colatrice, Temperatrice). Il grafico Pareto si colora automaticamente dal cluster.
      </div>

      {/* Alert se nessun cluster configurato */}
      {clustersConfig.length === 0 && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 rounded-r-lg p-3 text-sm text-yellow-800">
          ⚠️ <strong>Nessun cluster configurato.</strong> Vai in <strong>Settings → Cluster di Perdita</strong> per crearli (es. "Colatrice", "Temperatrice", "ORM"). Solo dopo potrai associare le perdite.
        </div>
      )}

      {/* Config unità di misura */}
      <div className="bg-gray-50 p-3 rounded-lg">
        <label className="block text-xs font-medium text-gray-600 uppercase mb-1">Unità di misura</label>
        <select
          value={unit}
          onChange={(e) => updateUnit(e.target.value)}
          className="w-full md:w-1/2 border rounded-lg px-3 py-1.5 text-sm bg-white"
        >
          {UNITS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
        </select>
      </div>

      <div className="flex justify-between items-center">
        <h4 className="font-semibold text-sm uppercase text-gray-700">Top Losses</h4>
        <button
          onClick={addLoss}
          className="text-xs px-3 py-1 text-white rounded shadow"
          style={{ backgroundColor: color }}
        >
          + Aggiungi Loss
        </button>
      </div>

      {sortedLosses.length === 0 ? (
        <div className="bg-white p-6 rounded-lg text-center text-sm text-gray-400 italic">
          Nessuna perdita identificata.
        </div>
      ) : (
        <div className="space-y-2">
          {sortedLosses.map((loss, idx) => {
            const valueNumber = parseFloat(loss.value) || 0
            const clusterColor = getClusterColor(loss.cluster_id)
            return (
              <div key={loss.id} className="bg-white p-3 rounded-lg border">
                <div className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-1 text-center font-bold text-gray-400">#{idx + 1}</div>

                  {/* Nome perdita */}
                  <input
                    className="col-span-4 border rounded px-2 py-1 text-sm font-medium"
                    value={loss.label}
                    onChange={(e) => updateLoss(loss.id, { label: e.target.value })}
                    placeholder="Nome perdita"
                  />

                  {/* Valore */}
                  <input
                    type="number"
                    step="0.1"
                    className="col-span-2 border rounded px-2 py-1 text-sm"
                    value={loss.value || ''}
                    onChange={(e) => updateLoss(loss.id, { value: e.target.value })}
                    placeholder={`Valore (${unit})`}
                  />

                  {/* Cluster dropdown */}
                  <div className="col-span-4 flex items-center gap-2">
                    {/* Indicatore colore cluster */}
                    <div
                      className="w-6 h-6 rounded border-2 flex-shrink-0"
                      style={{ backgroundColor: clusterColor, borderColor: clusterColor }}
                      title={getClusterLabel(loss.cluster_id) || 'Nessun cluster'}
                    />
                    <select
                      className="flex-1 border rounded px-2 py-1 text-sm"
                      value={loss.cluster_id || ''}
                      onChange={(e) => updateLoss(loss.id, { cluster_id: e.target.value })}
                    >
                      <option value="">— Cluster —</option>
                      {clustersConfig.filter(c => c.attivo !== false).map(c => (
                        <option key={c._id} value={c._id}>
                          {c.icon ? `${c.icon} ` : ''}{c.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Bottone rimuovi */}
                  <button
                    onClick={() => removeLoss(loss.id)}
                    className="col-span-1 text-red-500 hover:bg-red-50 p-1 rounded"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* Barra progress (colore del cluster) */}
                {valueNumber > 0 && (
                  <div className="mt-2 bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full"
                      style={{
                        width: `${Math.min(100, valueNumber)}%`,
                        backgroundColor: clusterColor,
                      }}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* PARETO CHART */}
      {lossesForChart.length > 0 && (
        <div className="mt-6">
          <ParetoChart
            losses={lossesForChart}
            title={`${pillar?.sigla || 'Pillar'} Losses Deployment`}
            subtitle={pillar?.label || ''}
            targetPercent={80}
            unit={unit}
          />
        </div>
      )}
    </div>
  )
}

function Step3Content({ data, color, onUpdate, lossesStep2 = [], pillar, allStepsData }) {
  const progetti = data.progetti || []

  // Eredita Baseline/Target/Unit dallo Step 1
  const step1Data = allStepsData?.step1_kpi_definition || {}
  const kpi1 = step1Data.kpi_principale || {}
  const baselineFromStep1 = kpi1.baseline || ''
  const targetFromStep1 = kpi1.target || ''
  const unitFromStep1 = kpi1.unit || '%'
  const kpiLabel = kpi1.label || 'KPI'

  // Cluster configurati (per colore)
  const { configs } = useAllConfigurations()
  const clustersConfig = configs.cluster_perdita || []

  function getClusterColor(clusterId) {
    const cluster = clustersConfig.find(c => c._id === clusterId)
    return cluster?.color || '#9CA3AF'
  }
  function getClusterLabel(clusterId) {
    const cluster = clustersConfig.find(c => c._id === clusterId)
    return cluster?.label || ''
  }

  // Lista Kaizen + Action Plan dal DB
  const [kaizens, setKaizens] = useState([])
  const [actionPlans, setActionPlans] = useState([])
  useEffect(() => {
    api.get('/kaizens').then(res => setKaizens(res.data || [])).catch(() => setKaizens([]))
    api.get('/action-plans/').then(res => setActionPlans(res.data || [])).catch(() => setActionPlans([]))
  }, [])

  function addProject() {
    onUpdate({
      progetti: [...progetti, {
        id: Date.now().toString(),
        loss_target_id: '',
        loss_target_label: '',
        // 🆕 Tipo improvement: 'kaizen' | 'action_plan' | 'text'
        type: 'kaizen',
        // Kaizen
        kaizen_id: '',
        kaizen_numero: '',
        kaizen_titolo: '',
        // Action Plan
        ap_id: '',
        ap_numero: '',
        ap_titolo: '',
        // Testo libero
        text_label: '',
        // Comune
        gain_value: '',
        deadline: '',
        status: 'planned',
      }]
    })
  }

  function updateProject(id, updates) {
    onUpdate({ progetti: progetti.map(p => p.id === id ? { ...p, ...updates } : p) })
  }

  function removeProject(id) {
    onUpdate({ progetti: progetti.filter(p => p.id !== id) })
  }

  function handleLossChange(projectId, lossId) {
    const loss = lossesStep2.find(l => l.id === lossId)
    updateProject(projectId, {
      loss_target_id: lossId,
      loss_target_label: loss?.label || '',
    })
  }

  function handleKaizenChange(projectId, kaizenId) {
    const kaizen = kaizens.find(k => k._id === kaizenId)
    updateProject(projectId, {
      kaizen_id: kaizenId,
      kaizen_numero: kaizen?.numero || '',
      kaizen_titolo: kaizen?.titolo || '',
    })
  }

  function handleAPChange(projectId, apId) {
    const ap = actionPlans.find(a => a._id === apId)
    updateProject(projectId, {
      ap_id: apId,
      ap_numero: ap?.numero || '',
      ap_titolo: ap?.titolo || '',
    })
  }

  function changeType(projectId, newType) {
    // Reset campi degli altri tipi quando cambio tipo
    const updates = { type: newType }
    if (newType !== 'kaizen') { updates.kaizen_id = ''; updates.kaizen_numero = ''; updates.kaizen_titolo = '' }
    if (newType !== 'action_plan') { updates.ap_id = ''; updates.ap_numero = ''; updates.ap_titolo = '' }
    if (newType !== 'text') { updates.text_label = '' }
    updateProject(projectId, updates)
  }

  // Auto-calcolo Forecast
  const baselineNum = parseFloat(baselineFromStep1) || 0
  const totalGain = progetti.reduce((sum, p) => sum + (parseFloat(p.gain_value) || 0), 0)
  const autoForecast = baselineNum + totalGain

  // Helper: label leggibile del progetto
  function getProjectLabel(p) {
    if (p.type === 'kaizen') return p.kaizen_numero || p.kaizen_titolo || '(Kaizen non selezionato)'
    if (p.type === 'action_plan') return p.ap_numero || p.ap_titolo || '(AP non selezionato)'
    if (p.type === 'text') return p.text_label || '(senza titolo)'
    return 'Progetto'
  }

  // Dati per Bridge Chart (colore = cluster della loss)
  const improvementsForChart = progetti
    .filter(p => parseFloat(p.gain_value))
    .map(p => {
      const loss = lossesStep2.find(l => l.id === p.loss_target_id)
      const clusterColor = getClusterColor(loss?.cluster_id)
      return {
        id: p.id,
        label: getProjectLabel(p),
        value: parseFloat(p.gain_value) || 0,
        color: clusterColor,
      }
    })

  const step1Incomplete = !baselineFromStep1 || !targetFromStep1

  // Icone e label per tipo
  const TYPES = [
    { value: 'kaizen', label: 'Kaizen', icon: '⚡', color: 'bg-blue-100 text-blue-700 border-blue-300' },
    { value: 'action_plan', label: 'Action Plan', icon: '📋', color: 'bg-green-100 text-green-700 border-green-300' },
    { value: 'text', label: 'Testo libero', icon: '📝', color: 'bg-gray-100 text-gray-700 border-gray-300' },
  ]

  return (
    <div className="space-y-3 mt-3">
      {/* Spiegazione */}
      <div className="bg-blue-50 border-l-4 border-blue-400 rounded-r-lg p-3 text-sm text-blue-800">
        <strong>Cosa fare:</strong> Per ogni perdita identificata nello <strong>Step 2</strong>, collega un improvement.
        Puoi usare un <strong>Kaizen</strong>, un <strong>Action Plan</strong> o solo un <strong>testo</strong> (per idee veloci).
      </div>

      {/* Alert Step 1 */}
      {step1Incomplete && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 rounded-r-lg p-3 text-sm text-yellow-800">
          ⚠️ <strong>Compila prima lo Step 1</strong> con Valore attuale e Obiettivo del KPI.
        </div>
      )}

      {/* Alert Step 2 */}
      {lossesStep2.length === 0 && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 rounded-r-lg p-3 text-sm text-yellow-800">
          ⚠️ <strong>Compila prima lo Step 2</strong> con le perdite.
        </div>
      )}

      {/* Box riepilogo: Baseline / Forecast / Target */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gray-50 border-2 border-gray-300 rounded-lg p-3">
          <label className="block text-xs font-bold uppercase text-gray-600 mb-1">
            Punto di partenza
            <span className="text-[10px] font-normal ml-1 text-gray-500">(da Step 1)</span>
          </label>
          <div className="text-xs text-gray-600 mb-2 truncate">{kpiLabel || 'KPI'}</div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-gray-700">{baselineFromStep1 || '—'}</span>
            <span className="text-sm text-gray-500">{unitFromStep1}</span>
          </div>
          <div className="text-[10px] text-gray-400 mt-1 italic">Modifica in Step 1</div>
        </div>

        <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-3">
          <label className="block text-xs font-bold uppercase text-yellow-700 mb-1">
            Forecast
            <span className="text-[10px] font-normal ml-1 text-yellow-600">(auto)</span>
          </label>
          <div className="text-xs text-yellow-700 mb-2">Baseline + Σ Gain</div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-yellow-700">{autoForecast.toFixed(2)}</span>
            <span className="text-sm text-yellow-600">{unitFromStep1}</span>
          </div>
          <div className="text-[10px] text-yellow-700 mt-1">
            = {baselineNum} + {totalGain.toFixed(1)} ({progetti.length} progetti)
          </div>
        </div>

        <div className="bg-orange-50 border-2 border-orange-400 rounded-lg p-3">
          <label className="block text-xs font-bold uppercase text-orange-700 mb-1">
            Obiettivo
            <span className="text-[10px] font-normal ml-1 text-orange-600">(da Step 1)</span>
          </label>
          <div className="text-xs text-orange-700 mb-2 truncate">{kpiLabel || 'KPI'} Target</div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-orange-700">{targetFromStep1 || '—'}</span>
            <span className="text-sm text-orange-600">{unitFromStep1}</span>
          </div>
          <div className="text-[10px] text-orange-700 mt-1 italic">Modifica in Step 1</div>
        </div>
      </div>

      {/* Gap Forecast vs Target */}
      {targetFromStep1 && autoForecast > 0 && (
        <div className="bg-white p-3 rounded-lg border-2 border-dashed flex items-center justify-center gap-3">
          <span className="text-sm text-gray-600">Forecast vs Target:</span>
          {(() => {
            const targetNum = parseFloat(targetFromStep1) || 0
            const gap = autoForecast - targetNum
            const isPositive = gap >= 0
            return (
              <span className={`text-lg font-bold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                {isPositive ? '+' : ''}{gap.toFixed(2)} {unitFromStep1}
                <span className="text-xs ml-2">
                  {isPositive ? '(target raggiungibile)' : '(serve più gain)'}
                </span>
              </span>
            )
          })()}
        </div>
      )}

      {/* Lista progetti */}
      <div className="flex justify-between items-center mt-4">
        <h4 className="font-semibold text-sm uppercase text-gray-700">
          Improvements collegati alle perdite ({progetti.length})
        </h4>
        <button
          onClick={addProject}
          className="text-xs px-3 py-1 text-white rounded shadow"
          style={{ backgroundColor: color }}
          disabled={lossesStep2.length === 0}
          title={lossesStep2.length === 0 ? 'Compila prima Step 2' : ''}
        >
          + Aggiungi Improvement
        </button>
      </div>

      {progetti.length === 0 ? (
        <div className="bg-white p-6 rounded-lg text-center text-sm text-gray-400 italic">
          Nessun improvement. Clicca "+ Aggiungi Improvement" per iniziare.
        </div>
      ) : (
        <div className="space-y-2">
          {progetti.map((p, idx) => {
            const loss = lossesStep2.find(l => l.id === p.loss_target_id)
            const clusterColor = getClusterColor(loss?.cluster_id)
            const clusterLabel = getClusterLabel(loss?.cluster_id)
            const type = p.type || 'kaizen'

            return (
              <div
                key={p.id}
                className="bg-white p-3 rounded-lg border-l-4 border"
                style={{ borderLeftColor: clusterColor }}
              >
                {/* Riga 1: tipo + numero #idx */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-bold text-gray-400 text-sm">#{idx + 1}</span>
                  {/* 🆕 Selettore tipo (3 bottoni) */}
                  <div className="flex gap-1">
                    {TYPES.map(t => (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => changeType(p.id, t.value)}
                        className={`px-2 py-1 rounded text-xs font-medium border-2 transition-all ${
                          type === t.value ? t.color + ' shadow' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-400'
                        }`}
                      >
                        {t.icon} {t.label}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => removeProject(p.id)}
                    className="ml-auto text-red-500 hover:bg-red-50 p-1 rounded"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* Riga 2: campi del progetto */}
                <div className="grid grid-cols-12 gap-2 items-end">
                  {/* Loss target */}
                  <div className="col-span-3">
                    <label className="block text-[10px] font-medium text-gray-500 uppercase mb-0.5">
                      Loss target (Step 2)
                    </label>
                    <div className="flex items-center gap-1">
                      <div
                        className="w-4 h-4 rounded flex-shrink-0"
                        style={{ backgroundColor: clusterColor }}
                        title={clusterLabel}
                      />
                      <select
                        className="flex-1 border rounded px-2 py-1 text-sm"
                        value={p.loss_target_id || ''}
                        onChange={(e) => handleLossChange(p.id, e.target.value)}
                      >
                        <option value="">— Seleziona —</option>
                        {lossesStep2.map(l => (
                          <option key={l.id} value={l.id}>{l.label || 'Senza nome'}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Campo dinamico in base al tipo */}
                  <div className="col-span-4">
                    <label className="block text-[10px] font-medium text-gray-500 uppercase mb-0.5">
                      {type === 'kaizen' ? 'Kaizen' : type === 'action_plan' ? 'Action Plan' : 'Descrizione'}
                    </label>

                    {type === 'kaizen' && (
                      <>
                        <select
                          className="w-full border rounded px-2 py-1 text-sm"
                          value={p.kaizen_id || ''}
                          onChange={(e) => handleKaizenChange(p.id, e.target.value)}
                        >
                          <option value="">— Seleziona Kaizen —</option>
                          {kaizens.map(k => (
                            <option key={k._id} value={k._id}>
                              {k.numero} — {k.titolo}
                            </option>
                          ))}
                        </select>
                        {p.kaizen_id && (
                          <Link
                            to={`/kaizen/${p.kaizen_id}`}
                            target="_blank"
                            className="text-[10px] text-blue-600 hover:underline mt-0.5 inline-block"
                          >
                            → Apri Kaizen
                          </Link>
                        )}
                      </>
                    )}

                    {type === 'action_plan' && (
                      <>
                        <select
                          className="w-full border rounded px-2 py-1 text-sm"
                          value={p.ap_id || ''}
                          onChange={(e) => handleAPChange(p.id, e.target.value)}
                        >
                          <option value="">— Seleziona AP —</option>
                          {actionPlans.map(a => (
                            <option key={a._id} value={a._id}>
                              {a.numero} — {a.titolo}
                            </option>
                          ))}
                        </select>
                        {p.ap_id && (
                          <Link
                            to={`/action-plan`}
                            target="_blank"
                            className="text-[10px] text-blue-600 hover:underline mt-0.5 inline-block"
                          >
                            → Apri AP
                          </Link>
                        )}
                      </>
                    )}

                    {type === 'text' && (
                      <input
                        type="text"
                        className="w-full border rounded px-2 py-1 text-sm"
                        value={p.text_label || ''}
                        onChange={(e) => updateProject(p.id, { text_label: e.target.value })}
                        placeholder="Es: Sostituire valvola pneumatica"
                      />
                    )}
                  </div>

                  {/* Gain */}
                  <div className="col-span-2">
                    <label className="block text-[10px] font-medium text-gray-500 uppercase mb-0.5">
                      Gain ({unitFromStep1})
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      className="w-full border rounded px-2 py-1 text-sm font-bold"
                      value={p.gain_value || ''}
                      onChange={(e) => updateProject(p.id, { gain_value: e.target.value })}
                      placeholder={`+/- ${unitFromStep1}`}
                    />
                  </div>

                  {/* Deadline */}
                  <div className="col-span-3">
                    <label className="block text-[10px] font-medium text-gray-500 uppercase mb-0.5">Deadline</label>
                    <input
                      type="date"
                      className="w-full border rounded px-2 py-1 text-sm"
                      value={p.deadline || ''}
                      onChange={(e) => updateProject(p.id, { deadline: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* BRIDGE CHART */}
      {(baselineNum > 0 || improvementsForChart.length > 0) && (
        <div className="mt-6">
          {/* Zoom asse Y */}
          <div className="bg-white border rounded-lg p-3 mb-2 flex items-center gap-3 text-xs">
            <span className="font-medium text-gray-600">Zoom asse Y:</span>
            <label className="flex items-center gap-1">
              Da:
              <input
                type="number"
                step="0.1"
                value={data.chart_y_min ?? ''}
                onChange={(e) => onUpdate({ chart_y_min: e.target.value === '' ? null : parseFloat(e.target.value) })}
                className="w-20 border rounded px-2 py-1"
                placeholder="auto"
              />
            </label>
            <label className="flex items-center gap-1">
              A:
              <input
                type="number"
                step="0.1"
                value={data.chart_y_max ?? ''}
                onChange={(e) => onUpdate({ chart_y_max: e.target.value === '' ? null : parseFloat(e.target.value) })}
                className="w-20 border rounded px-2 py-1"
                placeholder="auto"
              />
            </label>
            <span className="text-gray-400 italic">(lascia vuoto per scala automatica)</span>
          </div>

          <BridgeChart
            baseline={{ label: kpiLabel || 'Punto di partenza', value: baselineFromStep1 }}
            improvements={improvementsForChart}
            forecast={{ label: 'Forecast', value: autoForecast }}
            target={targetFromStep1 ? { label: `${kpiLabel} Target`, value: targetFromStep1 } : null}
            unit={unitFromStep1}
            title={`${pillar?.sigla || 'Pillar'} Bridge Chart`}
            subtitle={pillar?.label || ''}
            yAxisMin={data.chart_y_min ?? null}
            yAxisMax={data.chart_y_max ?? null}
          />
        </div>
      )}
    </div>
  )
}

function Step4Content({ data, color, onUpdate, allStepsData, pillar }) {
  const step3Progetti = allStepsData?.step3_target_definition?.progetti || []
  const progettiActual = data.progetti_actual || []

  // Eredita unità da Step 1
  const step1Data = allStepsData?.step1_kpi_definition || {}
  const unitFromStep1 = step1Data.kpi_principale?.unit || '%'

  // Sync automatico: per ogni progetto Step 3, creo voce in Step 4 (se non c'è già)
  useEffect(() => {
    const existingStep3Ids = new Set(progettiActual.map(p => p.step3_project_id))
    const newOnes = step3Progetti
      .filter(p => p.status !== 'cancelled' && !existingStep3Ids.has(p.id))
      .map(p => ({
        id: `s4_${p.id}_${Date.now()}`,
        step3_project_id: p.id,
        actual_status: 'not_started',
        actual_gain_value: '',
        actual_completion_date: '',
        notes: '',
      }))
    if (newOnes.length > 0) {
      onUpdate({ progetti_actual: [...progettiActual, ...newOnes] })
    }
  }, [step3Progetti.length])

  // Rimuovo orfani (se elimino un progetto in Step 3, lo elimino anche da Step 4)
  useEffect(() => {
    const step3Ids = new Set(step3Progetti.map(p => p.id))
    const cleaned = progettiActual.filter(p => step3Ids.has(p.step3_project_id))
    if (cleaned.length !== progettiActual.length) {
      onUpdate({ progetti_actual: cleaned })
    }
  }, [step3Progetti.length])

  function updateActual(id, updates) {
    onUpdate({ progetti_actual: progettiActual.map(p => p.id === id ? { ...p, ...updates } : p) })
  }

  // Recupera dati pianificati da Step 3 per un progetto Step 4
  function getPlannedData(actualProject) {
    return step3Progetti.find(s => s.id === actualProject.step3_project_id) || null
  }

  // Label leggibile del progetto (in base al tipo)
  function getProjectLabel(planned) {
    if (!planned) return '(progetto rimosso)'
    if (planned.type === 'kaizen') return planned.kaizen_numero || planned.kaizen_titolo || '(Kaizen non selezionato)'
    if (planned.type === 'action_plan') return planned.ap_numero || planned.ap_titolo || '(AP non selezionato)'
    if (planned.type === 'text') return planned.text_label || '(senza titolo)'
    return 'Progetto'
  }

  // Tipo icona
  function getTypeIcon(planned) {
    if (!planned) return '❓'
    if (planned.type === 'kaizen') return '⚡'
    if (planned.type === 'action_plan') return '📋'
    if (planned.type === 'text') return '📝'
    return '•'
  }

  // Status options
  const ACTUAL_STATUS = [
    { value: 'not_started', label: 'Da iniziare', color: 'bg-gray-100 text-gray-700 border-gray-300' },
    { value: 'in_progress', label: 'In Corso', color: 'bg-yellow-100 text-yellow-700 border-yellow-400' },
    { value: 'done', label: 'Completato', color: 'bg-green-100 text-green-700 border-green-400' },
    { value: 'blocked', label: 'Bloccato', color: 'bg-orange-100 text-orange-700 border-orange-300' },
    { value: 'cancelled', label: 'Annullato', color: 'bg-red-100 text-red-700 border-red-300' },
  ]

  // Summary
  const summary = {
    totale: progettiActual.length,
    da_iniziare: progettiActual.filter(p => (p.actual_status || 'not_started') === 'not_started').length,
    in_corso: progettiActual.filter(p => p.actual_status === 'in_progress').length,
    completati: progettiActual.filter(p => p.actual_status === 'done').length,
    bloccati: progettiActual.filter(p => p.actual_status === 'blocked').length,
    annullati: progettiActual.filter(p => p.actual_status === 'cancelled').length,
  }

  // Gain totale: pianificato vs reale
  const totalGainPlanned = progettiActual.reduce((sum, p) => {
    const planned = getPlannedData(p)
    return sum + (parseFloat(planned?.gain_value) || 0)
  }, 0)
  const totalGainActual = progettiActual.reduce((sum, p) =>
    sum + (parseFloat(p.actual_gain_value) || 0), 0)
  const gainGap = totalGainActual - totalGainPlanned

  return (
    <div className="space-y-3 mt-3">
      {/* Spiegazione */}
      <div className="bg-blue-50 border-l-4 border-blue-400 rounded-r-lg p-3 text-sm text-blue-800">
        <strong>Cosa fare:</strong> Monitora l'avanzamento reale dei progetti pianificati nello Step 3.
        Indica lo <strong>stato</strong> e il <strong>Gain effettivo</strong> ({unitFromStep1}) per ognuno.
      </div>

      {/* Alert se Step 3 vuoto */}
      {step3Progetti.length === 0 && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 rounded-r-lg p-3 text-sm text-yellow-800">
          ⚠️ <strong>Compila prima lo Step 3</strong> con i progetti da realizzare.
        </div>
      )}

      {/* Riepilogo */}
      {progettiActual.length > 0 && (
        <div className="bg-white rounded-lg border-2 p-4" style={{ borderColor: color }}>
          {/* Counters per status */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3">
            <SummaryBlock label="Da iniziare" value={summary.da_iniziare} color="gray" />
            <SummaryBlock label="In corso" value={summary.in_corso} color="yellow" />
            <SummaryBlock label="Completati" value={summary.completati} color="green" />
            <SummaryBlock label="Bloccati" value={summary.bloccati} color="orange" />
            <SummaryBlock label="Annullati" value={summary.annullati} color="red" />
          </div>

          {/* Gain totale */}
          <div className="grid grid-cols-3 gap-3 pt-3 border-t">
            <div className="text-center">
              <div className="text-xs text-gray-500 uppercase">Gain Pianificato</div>
              <div className="text-xl font-bold text-gray-700">
                +{totalGainPlanned.toFixed(2)} <span className="text-sm">{unitFromStep1}</span>
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-500 uppercase">Gain Reale</div>
              <div className="text-xl font-bold" style={{ color }}>
                +{totalGainActual.toFixed(2)} <span className="text-sm">{unitFromStep1}</span>
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-500 uppercase">Δ Gap</div>
              <div className={`text-xl font-bold ${gainGap >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {gainGap >= 0 ? '+' : ''}{gainGap.toFixed(2)} <span className="text-sm">{unitFromStep1}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lista progetti */}
      <h4 className="font-semibold text-sm uppercase text-gray-700 mt-4">
        Tracking ({progettiActual.length})
      </h4>

      {progettiActual.length === 0 ? (
        <div className="bg-white p-6 rounded-lg text-center text-sm text-gray-400 italic">
          Nessun progetto da monitorare. Aggiungi progetti nello Step 3.
        </div>
      ) : (
        <div className="space-y-2">
          {progettiActual.map((p, idx) => {
            const planned = getPlannedData(p)
            const projectLabel = getProjectLabel(planned)
            const typeIcon = getTypeIcon(planned)
            const status = p.actual_status || 'not_started'
            const statusInfo = ACTUAL_STATUS.find(s => s.value === status) || ACTUAL_STATUS[0]
            const gainPlanned = parseFloat(planned?.gain_value) || 0
            const gainActual = parseFloat(p.actual_gain_value) || 0
            const gap = gainActual - gainPlanned
            const isOrphan = !planned

            return (
              <div
                key={p.id}
                className={`bg-white p-3 rounded-lg border-l-4 border ${isOrphan ? 'opacity-50' : ''}`}
                style={{ borderLeftColor: isOrphan ? '#ef4444' : color }}
              >
                {/* Riga 1: descrizione + status */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-bold text-gray-400 text-sm">#{idx + 1}</span>
                  <span className="text-xl">{typeIcon}</span>
                  <div className="flex-1 px-2 py-1 text-sm font-medium text-gray-700">
                    {projectLabel}
                    {planned?.loss_target_label && (
                      <span className="ml-2 text-xs text-gray-500 font-normal">
                        → {planned.loss_target_label}
                      </span>
                    )}
                  </div>
                  {isOrphan && (
                    <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-bold">
                      Step 3 rimosso
                    </span>
                  )}
                  <span className={`px-2 py-1 rounded text-xs font-bold border ${statusInfo.color}`}>
                    {statusInfo.label}
                  </span>
                </div>

                {/* Riga 2: campi tracking */}
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-3">
                    <label className="block text-[10px] font-medium text-gray-500 uppercase mb-0.5">
                      Stato
                    </label>
                    <select
                      className="w-full border rounded px-2 py-1 text-xs"
                      value={status}
                      onChange={(e) => updateActual(p.id, { actual_status: e.target.value })}
                    >
                      {ACTUAL_STATUS.map(s => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-2">
                    <label className="block text-[10px] font-medium text-gray-500 uppercase mb-0.5">
                      Pianificato
                    </label>
                    <div className="w-full border rounded px-2 py-1 text-xs font-mono bg-gray-50 text-gray-700">
                      +{gainPlanned.toFixed(1)} {unitFromStep1}
                    </div>
                  </div>

                  <div className="col-span-2">
                    <label className="block text-[10px] font-medium text-gray-500 uppercase mb-0.5">
                      Reale ({unitFromStep1})
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      className="w-full border rounded px-2 py-1 text-xs font-bold"
                      value={p.actual_gain_value || ''}
                      onChange={(e) => updateActual(p.id, { actual_gain_value: e.target.value })}
                      placeholder={`es +${gainPlanned}`}
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-[10px] font-medium text-gray-500 uppercase mb-0.5">
                      Δ Gap
                    </label>
                    <div
                      className={`w-full border rounded px-2 py-1 text-xs font-bold text-center ${
                        gap >= 0
                          ? 'bg-green-50 border-green-300 text-green-700'
                          : 'bg-red-50 border-red-300 text-red-700'
                      }`}
                    >
                      {gap >= 0 ? '+' : ''}{gap.toFixed(1)} {unitFromStep1}
                    </div>
                  </div>

                  <div className="col-span-3">
                    <label className="block text-[10px] font-medium text-gray-500 uppercase mb-0.5">
                      Data fine
                    </label>
                    <input
                      type="date"
                      className="w-full border rounded px-2 py-1 text-xs"
                      value={p.actual_completion_date || ''}
                      onChange={(e) => updateActual(p.id, { actual_completion_date: e.target.value })}
                    />
                  </div>
                </div>

                {/* Riga 3: note breve (opzionale, NO "lezioni apprese") */}
                <div className="mt-2">
                  <input
                    type="text"
                    className="w-full border rounded px-2 py-1 text-xs"
                    value={p.notes || ''}
                    onChange={(e) => updateActual(p.id, { notes: e.target.value })}
                    placeholder="Note brevi (opzionale)"
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
function SummaryBlock({ label, value, color = 'gray' }) {
  const colors = { gray: 'text-gray-700 bg-gray-50', indigo: 'text-indigo-700 bg-indigo-50', purple: 'text-purple-700 bg-purple-50', yellow: 'text-yellow-700 bg-yellow-50', green: 'text-green-700 bg-green-50', orange: 'text-orange-700 bg-orange-50' }
  return (
    <div className={`text-center rounded-lg py-2 ${colors[color]}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-[10px] uppercase font-medium">{label}</div>
    </div>
  )
}

function Step5Content({ data, color, onUpdate, allStepsData, pillar }) {
  const step1Data = allStepsData?.step1_kpi_definition || {}
  const step3Data = allStepsData?.step3_target_definition || {}
  const step4Data = allStepsData?.step4_implementation || {}

  // Eredita tutto da Step 1
  const kpi1 = step1Data.kpi_principale || {}
  const baselineFromStep1 = kpi1.baseline || ''
  const targetFromStep1 = kpi1.target || ''
  const unitFromStep1 = kpi1.unit || '%'
  const kpiLabel = kpi1.label || 'KPI'

  // Cluster per colori
  const { configs } = useAllConfigurations()
  const clustersConfig = configs.cluster_perdita || []
  function getClusterColor(clusterId) {
    const cluster = clustersConfig.find(c => c._id === clusterId)
    return cluster?.color || '#9CA3AF'
  }

  // Loss da Step 2
  const lossesStep2 = allStepsData?.step2_pareto_analysis?.losses || []

  // Improvements PLANNED dallo Step 3 (per riferimento)
  const progettiStep3 = step3Data.progetti || []
  const improvementsPlanned = progettiStep3
    .filter(p => parseFloat(p.gain_value))
    .map(p => {
      const loss = lossesStep2.find(l => l.id === p.loss_target_id)
      const clusterColor = getClusterColor(loss?.cluster_id)
      const label =
        p.type === 'kaizen' ? (p.kaizen_numero || 'Kaizen') :
        p.type === 'action_plan' ? (p.ap_numero || 'AP') :
        (p.text_label || 'Idea')
      return {
        id: p.id,
        label,
        value: parseFloat(p.gain_value) || 0,
        color: clusterColor,
      }
    })

  // Improvements REAL (Actual) dallo Step 4 — solo quelli con actual_gain_value
  const progettiStep4 = step4Data.progetti_actual || []
  const improvementsActual = progettiStep4
    .filter(p => parseFloat(p.actual_gain_value))
    .map(p => {
      const step3p = progettiStep3.find(s => s.id === p.step3_project_id)
      const loss = lossesStep2.find(l => l.id === step3p?.loss_target_id)
      const clusterColor = getClusterColor(loss?.cluster_id)
      const label =
        step3p?.type === 'kaizen' ? (step3p?.kaizen_numero || 'Kaizen') :
        step3p?.type === 'action_plan' ? (step3p?.ap_numero || 'AP') :
        (step3p?.text_label || 'Idea')
      return {
        id: p.id,
        label,
        value: parseFloat(p.actual_gain_value) || 0,
        color: clusterColor,
      }
    })

  // Calcoli auto
  const baselineNum = parseFloat(baselineFromStep1) || 0
  const targetNum = parseFloat(targetFromStep1) || 0
  const totalGainPlanned = improvementsPlanned.reduce((s, i) => s + i.value, 0)
  const forecastPlannedValue = baselineNum + totalGainPlanned

  // Actual: somma di tutti i actual_gain_value (anche se non "done", basta che ci sia valore)
  const totalGainActual = improvementsActual.reduce((sum, i) => sum + i.value, 0)
  const actualValue = baselineNum + totalGainActual

  // Gap
  const gapActualVsPlanned = actualValue - forecastPlannedValue
  const gapActualVsTarget = actualValue - targetNum

  // Status performance
  let perfStatus = { label: 'In corso', color: 'bg-gray-100 text-gray-700', emoji: '⏳' }
  if (totalGainActual > 0) {
    if (gapActualVsTarget >= 0) {
      perfStatus = { label: 'Target superato', color: 'bg-green-500 text-white', emoji: '🏆' }
    } else if (Math.abs(gapActualVsTarget) / targetNum < 0.05) {
      perfStatus = { label: 'Target quasi raggiunto', color: 'bg-yellow-500 text-white', emoji: '⚠️' }
    } else {
      perfStatus = { label: 'Sotto target', color: 'bg-red-500 text-white', emoji: '❌' }
    }
  }

  const step1Incomplete = !baselineFromStep1 || !targetFromStep1
  const step3Empty = improvementsPlanned.length === 0
  const step4Empty = totalGainActual === 0

  return (
    <div className="space-y-3 mt-3">
      {/* Spiegazione */}
      <div className="bg-blue-50 border-l-4 border-blue-400 rounded-r-lg p-3 text-sm text-blue-800">
        <strong>Cosa fare:</strong> Confronto finale tra pianificato (Step 3) e reale (Step 4).
        Il sistema calcola tutto automaticamente.
      </div>

      {/* Alert */}
      {step1Incomplete && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 rounded-r-lg p-3 text-sm text-yellow-800">
          ⚠️ Compila prima <strong>Step 1</strong> (KPI).
        </div>
      )}
      {step3Empty && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 rounded-r-lg p-3 text-sm text-yellow-800">
          ⚠️ Compila <strong>Step 3</strong> con i progetti pianificati.
        </div>
      )}
      {step4Empty && !step3Empty && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 rounded-r-lg p-3 text-sm text-yellow-800">
          ⚠️ <strong>Step 4</strong>: marca almeno un progetto come "Completato" con Gain Reale.
        </div>
      )}

      {/* Riepilogo cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-gray-50 border-2 border-gray-300 rounded-lg p-3 text-center">
          <div className="text-[10px] uppercase font-bold text-gray-500 mb-1">Punto di partenza</div>
          <div className="text-2xl font-bold text-gray-700">{baselineNum.toFixed(2)}</div>
          <div className="text-xs text-gray-500">{unitFromStep1}</div>
        </div>

        <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-3 text-center">
          <div className="text-[10px] uppercase font-bold text-yellow-700 mb-1">Pianificato</div>
          <div className="text-2xl font-bold text-yellow-700">{forecastPlannedValue.toFixed(2)}</div>
          <div className="text-xs text-yellow-600">{unitFromStep1}</div>
        </div>

        <div className="bg-orange-50 border-2 border-orange-400 rounded-lg p-3 text-center ring-2 ring-orange-300 shadow-md">
          <div className="text-[10px] uppercase font-bold text-orange-700 mb-1">Reale (Actual)</div>
          <div className="text-2xl font-bold text-orange-700">{actualValue.toFixed(2)}</div>
          <div className="text-xs text-orange-600">{unitFromStep1}</div>
        </div>

        <div className="bg-emerald-50 border-2 border-emerald-400 rounded-lg p-3 text-center">
          <div className="text-[10px] uppercase font-bold text-emerald-700 mb-1">Target</div>
          <div className="text-2xl font-bold text-emerald-700">{targetNum.toFixed(2)}</div>
          <div className="text-xs text-emerald-600">{unitFromStep1}</div>
        </div>
      </div>

      {/* Status + gap */}
      {/* Status + Gap (centrato, full width) */}
      <div className="bg-white p-4 rounded-lg border-2 border-dashed">
        <div className="flex flex-wrap items-center justify-center gap-6">
          <div className={`px-4 py-2 rounded-lg text-sm font-bold ${perfStatus.color} shadow-sm`}>
            {perfStatus.emoji} {perfStatus.label}
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-600">Δ Reale vs Pianificato:</span>
            <span className={`font-bold ${gapActualVsPlanned >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {gapActualVsPlanned >= 0 ? '+' : ''}{gapActualVsPlanned.toFixed(2)} {unitFromStep1}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-600">Δ Reale vs Target:</span>
            <span className={`font-bold ${gapActualVsTarget >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {gapActualVsTarget >= 0 ? '+' : ''}{gapActualVsTarget.toFixed(2)} {unitFromStep1}
            </span>
          </div>
        </div>
      </div>

      {/* GRAFICO */}
      {baselineNum > 0 && (
        <div className="mt-4">
          {/* Zoom asse Y */}
          <div className="bg-white border rounded-lg p-3 mb-2 flex items-center justify-center gap-3 text-xs">
            <span className="font-medium text-gray-600">Zoom asse Y:</span>
            <label className="flex items-center gap-1">
              Da:
              <input
                type="number"
                step="0.1"
                value={data.chart_y_min ?? ''}
                onChange={(e) => onUpdate({ chart_y_min: e.target.value === '' ? null : parseFloat(e.target.value) })}
                className="w-20 border rounded px-2 py-1"
                placeholder="auto"
              />
            </label>
            <label className="flex items-center gap-1">
              A:
              <input
                type="number"
                step="0.1"
                value={data.chart_y_max ?? ''}
                onChange={(e) => onUpdate({ chart_y_max: e.target.value === '' ? null : parseFloat(e.target.value) })}
                className="w-20 border rounded px-2 py-1"
                placeholder="auto"
              />
            </label>
            <span className="text-gray-400 italic">(lascia vuoto per scala automatica)</span>
          </div>

          <div className="w-full">
            <BridgeChart
              baseline={{ label: kpiLabel || 'Punto di partenza', value: baselineNum }}
              improvements={improvementsPlanned}
              improvementsActual={improvementsActual}
              forecast={{ label: 'Pianificato (Forecast)', value: forecastPlannedValue }}
              actual={totalGainActual !== 0 ? { label: 'Reale (Actual)', value: actualValue } : null}
              target={targetNum > 0 ? { label: `Target (${kpiLabel})`, value: targetNum } : null}
              unit={unitFromStep1}
              title={`${pillar?.sigla || 'Pillar'} Close the Loop`}
              subtitle={pillar?.label || ''}
              yAxisMin={data.chart_y_min ?? null}
              yAxisMax={data.chart_y_max ?? null}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function BridgeCell({ label, value, autoValue, isOverridden, onChange, onReset, colSpan = 'col-span-3', suffix = '' }) {
  return (
    <div className={colSpan}>
      <div className="flex items-center justify-between mb-0.5">
        <label className="block text-[10px] font-medium text-gray-500 uppercase">{label}</label>
        {isOverridden && <button onClick={onReset} className="text-[10px] text-blue-600 hover:underline" title="Ripristina automatico">↺ auto</button>}
      </div>
      <div className="relative">
        <input type="number" className={`w-full border rounded px-2 py-1 text-xs ${isOverridden ? 'bg-yellow-50 border-yellow-400 font-bold' : 'bg-gray-50'}`} value={value} onChange={(e) => onChange(e.target.value)} placeholder={autoValue ? String(autoValue) : '0'} />
        {suffix && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 pointer-events-none">{suffix}</span>}
      </div>
      {!isOverridden && autoValue !== '' && autoValue !== 0 && <div className="text-[9px] text-gray-400 mt-0.5">auto: {Number(autoValue).toLocaleString('it-IT')}</div>}
    </div>
  )
}
function KaizenList({ kaizens, pillar }) {
  if (kaizens.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow p-12 text-center">
        <h3 className="font-semibold mb-1">Nessun Kaizen collegato</h3>
        <p className="text-sm text-gray-500 mb-3">Crea un Kaizen e collegalo al Pillar <strong>{pillar.sigla}</strong></p>
        <Link to="/kaizen" className="text-primary hover:underline text-sm">Vai a Kaizen</Link>
      </div>
    )
  }
  return (
    <div className="bg-white rounded-xl shadow overflow-hidden">
      <div className="px-4 py-3 border-b bg-gray-50">
        <h3 className="font-bold">Kaizen collegati al Pillar {pillar.sigla} <span className="text-xs font-normal text-gray-500">({kaizens.length})</span></h3>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b text-xs uppercase text-gray-500">
          <tr>
            <th className="px-4 py-2 text-left w-24">Numero</th>
            <th className="px-4 py-2 text-left">Titolo</th>
            <th className="px-4 py-2 text-left w-32">Livello</th>
            <th className="px-4 py-2 text-left w-28">Stato</th>
            <th className="px-4 py-2 text-left w-32">Reparto</th>
            <th className="px-4 py-2 text-right w-24">Azioni</th>
          </tr>
        </thead>
        <tbody>
          {kaizens.map(k => {
            const livello = k.livello || (k.tipo?.includes('Major') ? 'Major' : k.tipo?.includes('Standard') ? 'Standard' : 'Quick')
            const livelloColor = livello === 'Major' ? 'bg-purple-100 text-purple-700' : livello === 'Standard' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
            return (
              <tr key={k._id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-2 font-mono text-xs text-primary font-bold">{k.numero}</td>
                <td className="px-4 py-2">{k.titolo}</td>
                <td className="px-4 py-2"><span className={`px-2 py-0.5 rounded-full text-xs ${livelloColor}`}>{livello}</span></td>
                <td className="px-4 py-2"><span className={`px-2 py-0.5 rounded-full text-xs ${k.stato === 'Aperto' ? 'bg-blue-100 text-blue-700' : k.stato === 'In Corso' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>{k.stato}</span></td>
                <td className="px-4 py-2 text-xs text-gray-600">{k.reparto || '—'}</td>
                <td className="px-4 py-2 text-right"><Link to={`/kaizen/${k._id}`} className="text-primary hover:underline text-xs">Apri →</Link></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function MaturityPlaceholder({ color }) {
  return (
    <div className="bg-white rounded-xl shadow p-8 text-center">
      <h2 className="text-2xl font-bold mb-1">Maturity Grid</h2>
      <p className="text-sm text-gray-500 mb-4">Audit JIPM World-Class Manufacturing</p>
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-l-4 border-blue-400 p-4 rounded-r-lg max-w-lg mx-auto">
        <div className="font-bold text-blue-900 mb-1">In sviluppo futuro</div>
      </div>
    </div>
  )
}

const CELL_STATES = [
  { value: 0, label: 'Vuoto', color: '' },
  { value: 1, label: 'Pianificato', color: '#10b981' },
  { value: 2, label: 'Completato', color: '#2563eb' },
]

function getDefaultMasterplan() {
  const currentYear = new Date().getFullYear()
  return {
    steps: [
      { id: 's1', num: 1, label: 'Define Target & Vision on Volume & Productivity' },
      { id: 's2', num: 2, label: 'Deploy and Attack Machine Productivity losses' },
      { id: 's3', num: 3, label: 'Deploy and Attack Labour Organizational losses' },
      { id: 's4', num: 4, label: 'Improve Resource Saturation at Macro Level' },
      { id: 's5', num: 5, label: 'Improve Resource Saturation at Micro Level' },
      { id: 's6', num: 6, label: 'Develop the daily control system to hold the gains' },
    ],
    cells: {}, start_year: currentYear - 1, end_year: currentYear + 5,
  }
}

function MasterPlanTab({ pillar, color, onSaved }) {
  const savedMasterplan = pillar.gantt_items?.find(i => i?.type === 'masterplan')?.data
  const [data, setData] = useState(savedMasterplan || getDefaultMasterplan())
  const [editingStepId, setEditingStepId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [lastSaved, setLastSaved] = useState(null)
  const dataRef = useRef(data)

  useEffect(() => { dataRef.current = data }, [data])

  async function doSave(silent = false) {
    if (!silent) setSaving(true)
    try {
      await api.put(`/pillars/${pillar._id}`, { gantt_items: [...(pillar.gantt_items || []).filter(item => item?.type !== 'masterplan'), { type: 'masterplan', data: dataRef.current }] })
      if (!silent) { setLastSaved(new Date()); setHasUnsavedChanges(false) }
    } catch (err) {
      console.error(err)
      if (!silent) alert('Errore salvataggio: ' + (err.response?.data?.detail || err.message))
    } finally { if (!silent) setSaving(false) }
  }

  useEffect(() => {
    if (JSON.stringify(data) === JSON.stringify(savedMasterplan || getDefaultMasterplan())) return
    setHasUnsavedChanges(true)
    const timer = setTimeout(() => doSave(false), 700)
    return () => clearTimeout(timer)
  }, [data])

  function getCellValue(stepId, year, quarter) { return data.cells[`${stepId}_${year}_${quarter}`] || 0 }
  function cycleCell(stepId, year, quarter) {
    const key = `${stepId}_${year}_${quarter}`
    const current = data.cells[key] || 0
    const next = (current + 1) % CELL_STATES.length
    setData(prev => { const newCells = { ...prev.cells }; newCells[key] = next; return { ...prev, cells: newCells } })
  }
  function clearRow(stepId) {
    if (!confirm('Pulire tutte le celle di questa riga?')) return
    setData(prev => { const newCells = { ...prev.cells }; Object.keys(newCells).forEach(k => { if (k.startsWith(`${stepId}_`)) delete newCells[k] }); return { ...prev, cells: newCells } })
  }
  function updateStepLabel(stepId, newLabel) { setData(prev => ({ ...prev, steps: prev.steps.map(s => s.id === stepId ? { ...s, label: newLabel } : s) })) }
  function addStep() {
    const newId = `s${Date.now()}`
    const newNum = data.steps.length + 1
    setData(prev => ({ ...prev, steps: [...prev.steps, { id: newId, num: newNum, label: `Step ${newNum} — Nuovo` }] }))
  }
  function removeStep(stepId) {
    if (!confirm('Eliminare questo step e tutte le sue celle?')) return
    setData(prev => {
      const newCells = { ...prev.cells }
      Object.keys(newCells).forEach(k => { if (k.startsWith(`${stepId}_`)) delete newCells[k] })
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
      const tmp = newSteps[idx]; newSteps[idx] = newSteps[newIdx]; newSteps[newIdx] = tmp
      const renumbered = newSteps.map((s, i) => ({ ...s, num: i + 1 }))
      return { ...prev, steps: renumbered }
    })
  }
  function updateYearRange(field, value) {
    const v = parseInt(value) || 0
    if (v < 2000 || v > 2100) return
    setData(prev => ({ ...prev, [field]: v }))
  }

  const years = []
  for (let y = data.start_year; y <= data.end_year; y++) years.push(y)
  const quarters = ['Q1', 'Q2', 'Q3', 'Q4']

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow p-4">
        <div className="flex justify-between items-start mb-3">
          <div>
            <h3 className="font-bold text-lg">Pillar Master Plan</h3>
            <p className="text-xs text-gray-500">Pianificazione multi-anno per trimestri — Pillar <strong>{pillar.sigla}</strong></p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            {saving ? <span className="text-blue-600">Salvataggio...</span> : hasUnsavedChanges ? <span className="text-orange-600 font-medium">Non salvato</span> : lastSaved ? <span className="text-green-600">Salvato {lastSaved.toLocaleTimeString('it-IT')}</span> : <span className="text-gray-400">Pronto</span>}
            <button onClick={() => doSave(false)} disabled={saving} className="text-white px-3 py-1 rounded text-xs shadow" style={{ backgroundColor: color }}>Salva ora</button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end pt-3 border-t">
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Anno inizio</label><input type="number" min="2000" max="2100" value={data.start_year} onChange={(e) => updateYearRange('start_year', e.target.value)} className="w-full border rounded px-2 py-1 text-sm" /></div>
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Anno fine</label><input type="number" min="2000" max="2100" value={data.end_year} onChange={(e) => updateYearRange('end_year', e.target.value)} className="w-full border rounded px-2 py-1 text-sm" /></div>
          <button onClick={addStep} className="text-white px-3 py-1.5 rounded text-sm font-medium flex items-center justify-center gap-1 shadow" style={{ backgroundColor: color }}><Plus size={14} /> Aggiungi Step</button>
        </div>
        <div className="flex gap-3 mt-3 pt-3 border-t text-xs items-center flex-wrap">
          <span className="font-medium text-gray-600">Stati cella:</span>
          {CELL_STATES.map(s => (
            <div key={s.value} className="flex items-center gap-1"><div className="w-4 h-4 border rounded" style={{ backgroundColor: s.color || 'white' }} /><span>{s.label}</span></div>
          ))}
          <span className="ml-auto text-gray-500 italic">Click su cella per cambiare stato</span>
        </div>
      </div>
      <div className="bg-white rounded-xl shadow overflow-x-auto">
        <div style={{ minWidth: years.length * 80 + 412 }}>
          <div className="flex border-b bg-gray-100 sticky top-0 z-10">
            <div className="w-12 px-2 py-2 text-xs font-bold text-center border-r"></div>
            <div className="w-80 px-3 py-2 text-xs font-bold border-r">PILLAR Steps</div>
            <div className="w-20 px-1 py-2 text-xs font-bold text-center border-r">Azioni</div>
            {years.map(year => (
              <div key={year} className="flex-1 min-w-[80px] border-r last:border-r-0">
                <div className="text-center font-bold text-xs py-1 border-b" style={{ backgroundColor: `${color}15`, color }}>{year}</div>
                <div className="flex">{quarters.map(q => <div key={q} className="flex-1 text-center text-[10px] font-medium text-gray-500 py-0.5 border-r last:border-r-0">{q}</div>)}</div>
              </div>
            ))}
          </div>
          {data.steps.map((step, idx) => (
            <div key={step.id} className="flex border-b hover:bg-gray-50">
              <div className="w-12 px-2 py-2 text-sm font-bold text-center border-r flex items-center justify-center" style={{ backgroundColor: `${color}25`, color }}>{step.num}</div>
              <div className="w-80 px-2 py-1 border-r flex items-center">
                {editingStepId === step.id ? (
                  <input autoFocus value={step.label} onChange={(e) => updateStepLabel(step.id, e.target.value)} onBlur={() => setEditingStepId(null)} onKeyDown={(e) => e.key === 'Enter' && setEditingStepId(null)} className="w-full border rounded px-2 py-1 text-xs" />
                ) : (
                  <div onClick={() => setEditingStepId(step.id)} className="text-xs cursor-pointer hover:bg-yellow-50 px-2 py-1 rounded w-full" title="Click per modificare">{step.label}</div>
                )}
              </div>
              <div className="w-20 px-1 border-r flex items-center justify-center gap-0.5">
                <button onClick={() => moveStep(step.id, 'up')} disabled={idx === 0} className="text-xs px-1 hover:bg-gray-200 rounded disabled:opacity-30" title="Sposta su">▲</button>
                <button onClick={() => moveStep(step.id, 'down')} disabled={idx === data.steps.length - 1} className="text-xs px-1 hover:bg-gray-200 rounded disabled:opacity-30" title="Sposta giù">▼</button>
                <button onClick={() => clearRow(step.id)} className="text-xs px-1 hover:bg-yellow-100 rounded text-yellow-600" title="Pulisci riga">⌫</button>
                <button onClick={() => removeStep(step.id)} className="p-0.5 hover:bg-red-100 rounded text-red-600" title="Elimina step"><Trash2 size={11} /></button>
              </div>
              {years.map(year => (
                <div key={year} className="flex-1 min-w-[80px] border-r last:border-r-0 flex">
                  {quarters.map((q, qIdx) => {
                    const val = getCellValue(step.id, year, qIdx + 1)
                    const state = CELL_STATES[val]
                    return (
                      <button key={q} onClick={() => cycleCell(step.id, year, qIdx + 1)} className="flex-1 border-r last:border-r-0 hover:opacity-75 transition-opacity" style={{ backgroundColor: state.color || 'transparent', minHeight: '32px' }} title={`${year} ${q}: ${state.label}`} />
                    )
                  })}
                </div>
              ))}
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
  )
}
