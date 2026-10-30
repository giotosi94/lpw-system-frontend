import ProblemDefinition from '../components/kaizen/ProblemDefinition'
import { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom'
import api from '../services/api'
import {
  Save, ChevronDown, X, History, RefreshCw, Lock, RotateCcw, ArrowLeft,
  Zap, BarChart3, Trophy, FileText, Activity, User, Target,
  Factory, MapPin, Cog, Building2, CalendarDays, Check, AlertTriangle, Info,
} from 'lucide-react'
import ActionPlanFormShared from '../components/ActionPlanFormShared'
import IshikawaDiagram from '../components/kaizen/IshikawaDiagram'
import FiveWhysFlowChart from '../components/kaizen/FiveWhysFlowChart'
import RiskPrioritizationChart from '../components/kaizen/RiskPrioritizationChart'
import KaizenGantMasterPlan from '../components/kaizen/KaizenGantMasterPlan'
import KaizenAzioniList from '../components/kaizen/KaizenAzioniList'
import ConsolidatedActionPlans from '../components/kaizen/ConsolidatedActionPlans'
import UserPicker from '../components/UserPicker'
import ImageUpload from '../components/ImageUpload'
import DocumentUpload from '../components/DocumentUpload'
import { useAllConfigurations } from '../hooks/useConfigurations'
import { usePillars } from '../hooks/usePillars'
import useUnsavedChangesGuard from '../hooks/useUnsavedChangesGuard'
import { useAuth } from '../context/AuthContext'
import ParetoChart from '../components/pillar/ParetoChart'

const LIVELLI = ['Quick', 'Standard', 'Major']

const livelloConfig = {
  Quick: { Icon: Zap, color: '#10b981', label: 'Quick Kaizen', desc: 'Risoluzione rapida' },
  Standard: { Icon: BarChart3, color: '#3b82f6', label: 'Standard Kaizen', desc: 'Progetto strutturato' },
  Major: { Icon: Trophy, color: '#8b5cf6', label: 'Major Kaizen', desc: 'Iniziativa Pillar' },
}

function getLivelloFromKaizen(kaizen) {
  if (!kaizen) return 'Quick'
  if (kaizen.livello && LIVELLI.includes(kaizen.livello)) return kaizen.livello
  if (kaizen.tipo?.includes('Quick')) return 'Quick'
  if (kaizen.tipo?.includes('Standard')) return 'Standard'
  if (kaizen.tipo?.includes('Major')) return 'Major'
  return 'Quick'
}

function buildTabsForLivello(livello, isAdmin) {
  if (livello === 'Quick') {
    const quickTabs = [
      { id: 'quickkaizen', label: 'Problem Solving' },
    ]

    if (isAdmin) {
      quickTabs.push(
        { id: 'stdelements', label: '8 Standard Elements' },
        { id: 'cmladder', label: 'Countermeasure Ladder' }
      )
    }

    quickTabs.push(
      { id: 'lavagna', label: 'Lavagna & Allegati' },
      { id: 'feed', label: 'Storico' }
    )

    return quickTabs
  }

  const projectTabs = [
    { id: 'setup', label: 'Ambito & Team' },
    { id: 'loss', label: 'Loss Deployment' },
    { id: 'gemba', label: 'Gemba & Obiettivi' },
    { id: 'masterplan', label: 'Master Plan' },
    { id: 'figli', label: 'Quick Kaizen' },
    { id: 'actionplans', label: 'Action Plan' },
    { id: 'audit', label: 'Team Audit' },
  ]

  if (livello === 'Major') {
    projectTabs.push(
      { id: 'costbenefit', label: 'Cost & Benefit' }
    )
  }

  projectTabs.push(
    { id: 'lavagna', label: 'Lavagna & Allegati' },
    { id: 'feed', label: 'Storico' }
  )

  return projectTabs
}

export default function KaizenDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const fromDashboard = searchParams.get('from_dashboard')
  const { isAdmin } = useAuth()
  const [kaizen, setKaizen] = useState(null)
  const [activeTab, setActiveTab] = useState('quickkaizen')
  const [saving, setSaving] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [showTransformModal, setShowTransformModal] = useState(false)
  const [targetLivello, setTargetLivello] = useState(null)
  const [motivoTrasforma, setMotivoTrasforma] = useState('')
  const [showStoria, setShowStoria] = useState(false)
  const [transforming, setTransforming] = useState(false)
  const [savedSnapshot, setSavedSnapshot] = useState(null)
  const [parentKaizen, setParentKaizen] = useState(null)

  const { configs } = useAllConfigurations()
  const { pillars, loading: loadingPillars } = usePillars()
  const [reparti, setReparti] = useState([])
  useEffect(() => {
    api.get('/reparti/').then(res => setReparti(res.data || [])).catch(() => setReparti([]))
  }, [])

  const lineeDisponibili = useMemo(() => {
    if (!kaizen?.reparto) return []
    const rep = reparti.find(r => r.nome === kaizen.reparto)
    return rep?.linee?.filter(l => l.attivo !== false) || []
  }, [kaizen?.reparto, reparti])

  const macchineDisponibili = useMemo(() => {
    if (!kaizen?.linea) return []
    const linea = lineeDisponibili.find(l => l.nome === kaizen.linea)
    return linea?.macchine?.filter(m => m.attivo !== false) || []
  }, [kaizen?.linea, lineeDisponibili])

  const handleRepartoChange = (v) => setKaizen(prev => ({ ...prev, reparto: v, linea: '', macchina: '' }))
  const handleLineaChange = (v) => setKaizen(prev => ({ ...prev, linea: v, macchina: '' }))
    const getPillarLabel = (pillar) => {
    return pillar?.nome || pillar?.label || pillar?.titolo || ''
  }

  const handlePillarOwnerChange = (pillarId) => {
    const pillar = pillars.find(item => item._id === pillarId)

    setKaizen(prev => ({
      ...prev,
      pillar_id: pillar?._id || null,
      pillar_sigla: pillar?.sigla || '',
      pillar_label: getPillarLabel(pillar),
    }))
  }

  const togglePillarCoinvolto = (pillar) => {
    setKaizen(prev => {
      const currentIds = prev.pillar_ids || []
      const isSelected = currentIds.includes(pillar._id)

      if (isSelected) {
        const nextPillars = currentIds
          .map((pillarId, index) => ({
            id: pillarId,
            nome: prev.pillar_nomi?.[index] || '',
            sigla: prev.pillar_sigle?.[index] || '',
          }))
          .filter(item => item.id !== pillar._id)

        return {
          ...prev,
          pillar_ids: nextPillars.map(item => item.id),
          pillar_nomi: nextPillars.map(item => item.nome),
          pillar_sigle: nextPillars.map(item => item.sigla),
        }
      }

      return {
        ...prev,
        pillar_ids: [...currentIds, pillar._id],
        pillar_nomi: [...(prev.pillar_nomi || []), getPillarLabel(pillar)],
        pillar_sigle: [...(prev.pillar_sigle || []), pillar.sigla || ''],
      }
    })
  }

  // Flusso Ishikawa -> Crea Action Plan da Root Cause
  const [showAPFormFromRootCause, setShowAPFormFromRootCause] = useState(false)
  const [rootCausePrefill, setRootCausePrefill] = useState(null)

  async function handleCreateAPFromRootCause(rootCauseNode, problema) {
    if (hasUnsavedChanges) {
      const ok = await saveKaizen(false)
      if (!ok) {
        alert('Salva prima le modifiche al Kaizen, poi crea l’Action Plan.')
        return
      }
    }

    const rpn =
      (parseInt(rootCauseNode?.severity) || 0) *
      (parseInt(rootCauseNode?.occurrence) || 0) *
      (parseInt(rootCauseNode?.detection) || 0)

    const descRpn = rpn > 0 ? `\n\nRPN: ${rpn}` : ''

    const desc = `Problema: ${problema}\n\nRoot cause identificata: ${rootCauseNode.label}${descRpn}`

    setRootCausePrefill({
      titolo: `Azione per: ${(rootCauseNode.label || 'Root Cause').slice(0, 60)}`,
      descrizione: desc,
    })
    setShowAPFormFromRootCause(true)
  }

  useEffect(() => { loadKaizen() }, [id])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.transform-dropdown')) {
        setShowDropdown(false)
      }
    }
    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showDropdown])

  const livelloAttuale = getLivelloFromKaizen(kaizen)
  const indiceLivello = LIVELLI.indexOf(livelloAttuale)
  const tabs = buildTabsForLivello(livelloAttuale, isAdmin)

  const isLocked = kaizen?.stato === 'Chiuso' || kaizen?.stato === 'Cancelled'

  useEffect(() => {
    if (kaizen && !tabs.find(t => t.id === activeTab)) {
      setActiveTab(tabs[0]?.id || 'quickkaizen')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [livelloAttuale])

  const hasUnsavedChanges = useMemo(() => {
    if (!kaizen || !savedSnapshot || isLocked) return false

    return JSON.stringify(kaizen) !== savedSnapshot
  }, [kaizen, savedSnapshot, isLocked])

  const {
    showPrompt: showUnsavedPrompt,
    saving: savingBeforeNavigation,
    saveAndContinue,
    discardAndContinue,
    stay: stayOnPage,
  } = useUnsavedChangesGuard({
    when: hasUnsavedChanges,
    onSave: () => saveKaizen(false),
  })

  const loadKaizen = async () => {
    try {
      const res = await api.get(`/kaizens/${id}`)
      setKaizen(res.data)
      setSavedSnapshot(JSON.stringify(res.data))

      if (res.data.parent_kaizen_id) {
        try {
          const parentRes = await api.get(`/kaizens/${res.data.parent_kaizen_id}`)
          setParentKaizen(parentRes.data)
        } catch {
          setParentKaizen(null)
        }
      } else {
        setParentKaizen(null)
      }
    } catch (err) {
      console.error(err)
    }
  }

  const saveKaizen = async (showSuccessMessage = true) => {
    if (!kaizen || saving) return false

    setSaving(true)

    try {
      const dataToSave = JSON.parse(JSON.stringify(kaizen))

      await api.put(`/kaizens/${id}`, dataToSave)

      setSavedSnapshot(JSON.stringify(dataToSave))

      if (showSuccessMessage) {
        alert('Kaizen salvato correttamente.')
      }

      return true
    } catch (err) {
      console.error(err)

      alert(
        'Errore durante il salvataggio: ' +
        (err.response?.data?.detail || err.message)
      )

      return false
    } finally {
      setSaving(false)
    }
  }

  const riapriKaizen = async () => {
    if (!confirm(`Riaprire il Kaizen "${kaizen.numero}"?\n\nLo stato tornerà a "Aperto" e sarà nuovamente modificabile.`)) return
    try {
      await api.put(`/kaizens/${id}`, { stato: 'Aperto' })
      await loadKaizen()
      alert('Kaizen riaperto.')
    } catch (err) {
      console.error(err)
      alert('Errore durante la riapertura: ' + (err.response?.data?.detail || err.message))
    }
  }

  const chiudiKaizen = async () => {
    if (!confirm(`Chiudere il Kaizen "${kaizen.numero}"?\n\nDiventerà in sola lettura e tutti i campi saranno bloccati.\nPotrai riaprirlo in seguito se necessario.`)) return
    try {
      await api.put(`/kaizens/${id}`, { stato: 'Chiuso' })
      await loadKaizen()
      alert('Kaizen chiuso.')
    } catch (err) {
      console.error(err)
      alert('Errore durante la chiusura: ' + (err.response?.data?.detail || err.message))
    }
  }

  const updateField = (section, field, value) => {
    setKaizen(prev => ({
      ...prev,
      [section]: { ...prev[section], [field]: value }
    }))
  }

  const openTransformModal = (livello) => {
    setTargetLivello(livello)
    setMotivoTrasforma('')
    setShowDropdown(false)
    setShowTransformModal(true)
  }

  const confirmTransform = async () => {
    if (!targetLivello) return
    setTransforming(true)
    try {
      await api.patch(`/kaizens/${id}/change-methodology`, {
        nuovo_livello: targetLivello,
        motivo: motivoTrasforma || `Trasformato in ${targetLivello}`,
      })
      await loadKaizen()
      setShowTransformModal(false)
      setTargetLivello(null)
      setMotivoTrasforma('')
      alert(`Kaizen trasformato in ${targetLivello}.`)
    } catch (err) {
      console.error(err)
      alert('Errore durante la trasformazione: ' + (err.response?.data?.detail || err.message))
    } finally {
      setTransforming(false)
    }
  }

  if (!kaizen) return <div className="text-center py-8">Caricamento...</div>

  const miglioramentoPct = (kaizen.obiettivi?.start && kaizen.obiettivi?.target)
    ? Math.abs(((parseFloat(kaizen.obiettivi.target) - parseFloat(kaizen.obiettivi.start)) / parseFloat(kaizen.obiettivi.start)) * 100)
    : null

  const costo = parseFloat(kaizen.risultati?.costo) || 0
  const risparmio = parseFloat(kaizen.risultati?.risparmio) || 0

  const storicoOrdinato = [...(kaizen.feed || [])].sort((a, b) => {
    const dataA = new Date(a.timestamp || 0).getTime()
    const dataB = new Date(b.timestamp || 0).getTime()
    return dataB - dataA
  })

  const formatStoricoDate = (value) => {
    if (!value) return 'Data non disponibile'

    const date = new Date(value)

    if (Number.isNaN(date.getTime())) {
      return value
    }

    return date.toLocaleString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div>
      <div className="bg-primary text-white rounded-xl p-6 mb-6">
        <button
          onClick={() => navigate(fromDashboard ? `/dashboard/${fromDashboard}` : '/kaizen')}
          className="flex items-center gap-2 text-white text-opacity-90 hover:text-opacity-100 mb-4 text-sm"
        >
          <ArrowLeft size={18} />
          {fromDashboard ? 'Torna al Meeting' : 'Torna ai Kaizen'}
        </button>
        <div className="flex justify-between items-start mb-5">
          <div>
            <h1 className="text-2xl font-bold">{kaizen.titolo || 'Kaizen'}</h1>
            <div className="flex gap-4 mt-2 text-sm text-gray-200 flex-wrap items-center">
              <span className="flex items-center gap-1"><FileText size={14} /> {kaizen.numero}</span>
              <span className="flex items-center gap-1"><Activity size={14} /> {kaizen.stato}</span>
              {kaizen.creatore_nome && <span className="flex items-center gap-1"><User size={14} /> Creatore: {kaizen.creatore_nome}</span>}
              {kaizen.team_leader_nome && <span className="flex items-center gap-1"><Target size={14} /> Leader: {kaizen.team_leader_nome}</span>}
              {kaizen.reparto && <span className="flex items-center gap-1"><Factory size={14} /> {kaizen.reparto}</span>}
              {kaizen.linea && <span className="flex items-center gap-1"><MapPin size={14} /> {kaizen.linea}</span>}
              {kaizen.macchina && <span className="flex items-center gap-1"><Cog size={14} /> {kaizen.macchina}</span>}
              {kaizen.pillar_sigla && (
                <Link
                  to={`/pillars/${kaizen.pillar_id}`}
                  className="flex items-center gap-1 bg-white bg-opacity-20 hover:bg-opacity-30 px-2 py-0.5 rounded-full font-mono font-bold transition-colors"
                  title={`Pillar Owner: ${kaizen.pillar_sigla}`}
                >
                  <Building2 size={14} />
                  {kaizen.pillar_sigla} · Owner
                </Link>
              )}

              {(kaizen.pillar_ids || [])
                .filter(pillarId => pillarId !== kaizen.pillar_id)
                .map((pillarId, index) => (
                  <Link
                    key={pillarId}
                    to={`/pillars/${pillarId}`}
                    className="flex items-center gap-1 bg-white bg-opacity-10 hover:bg-opacity-20 px-2 py-0.5 rounded-full font-mono text-xs transition-colors"
                  >
                    <Building2 size={12} />
                    {kaizen.pillar_sigle?.[index] || 'Pillar'}
                  </Link>
                ))}
              {kaizen.dashboard_id && kaizen.dashboard_nome && (
                <Link
                  to={`/dashboard/${kaizen.dashboard_id}`}
                  className="flex items-center gap-1 bg-purple-500 bg-opacity-30 hover:bg-opacity-50 px-2 py-0.5 rounded-full font-bold transition-colors"
                  title={`Apri Meeting ${kaizen.dashboard_nome}`}
                >
                  <CalendarDays size={14} /> {kaizen.dashboard_nome}
                </Link>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {isLocked ? (
              <button
                onClick={riapriKaizen}
                className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium"
              >
                <RotateCcw size={18} /> Riapri Kaizen
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => saveKaizen(true)}
                  disabled={saving}
                  className={`px-4 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50 ${
                    hasUnsavedChanges
                      ? 'bg-gold text-white hover:bg-gold-dark'
                      : 'bg-white text-primary hover:bg-gray-100'
                  }`}
                >
                  <Save size={18} />
                  {saving
                    ? 'Salvataggio...'
                    : hasUnsavedChanges
                      ? 'Salva modifiche'
                      : 'Salvato'}
                </button>
                <button
                  onClick={chiudiKaizen}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
                >
                  <Lock size={18} /> Chiudi Kaizen
                </button>
              </>
            )}
          </div>
        </div>

        <div className="bg-white bg-opacity-10 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-200 uppercase tracking-wider">Livello Kaizen</span>
            <span className="text-xs text-gray-200">{indiceLivello + 1}/3</span>
          </div>

          <div className="flex items-center gap-2">
            {LIVELLI.map((lvl, idx) => {
              const isActive = idx === indiceLivello
              const isCompleted = idx < indiceLivello
              const isFuture = idx > indiceLivello
              const cfg = livelloConfig[lvl]
              const StepIcon = cfg.Icon
              return (
                <div key={lvl} className="flex-1 flex items-center">
                  <div className="flex flex-col items-center flex-shrink-0">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                        isActive ? 'bg-white shadow-lg scale-110 ring-4 ring-white ring-opacity-30' :
                        isCompleted ? 'bg-white bg-opacity-90' :
                        'bg-white bg-opacity-20'
                      }`}
                    >
                      <StepIcon size={22} color={isActive || isCompleted ? cfg.color : '#ffffff'} />
                    </div>
                    <div className={`text-xs mt-1 font-medium ${isActive ? 'text-white' : 'text-gray-300'}`}>
                      {cfg.label}
                    </div>
                    {isActive && (<div className="text-xs text-yellow-300 font-bold mt-0.5">ATTUALE</div>)}
                    {isFuture && (<div className="text-xs text-gray-400 mt-0.5 flex items-center gap-1"><Lock size={10} /> Bloccato</div>)}
                  </div>
                  {idx < LIVELLI.length - 1 && (
                    <div className={`flex-1 h-1 mx-2 rounded ${idx < indiceLivello ? 'bg-white bg-opacity-90' : 'bg-white bg-opacity-20'}`} />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Banner Kaizen chiuso */}
      {isLocked && (
        <div className="bg-yellow-50 border-l-4 border-yellow-500 rounded-r-lg p-4 mb-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Lock size={24} className="text-yellow-600 flex-shrink-0" />
            <div>
              <div className="font-bold text-yellow-900">Kaizen chiuso — Modalità sola lettura</div>
              <div className="text-sm text-yellow-700">
                Tutti i campi sono bloccati. Per modificare, riapri il Kaizen.
                {kaizen.data_chiusura && ` Chiuso il ${new Date(kaizen.data_chiusura).toLocaleDateString('it-IT')}.`}
              </div>
            </div>
          </div>
          <button
            onClick={riapriKaizen}
            className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap flex items-center gap-2"
          >
            <RotateCcw size={16} /> Riapri
          </button>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div className="relative transform-dropdown">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="bg-white border-2 border-primary text-primary px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-primary hover:text-white transition-colors shadow-sm"
          >
            <RefreshCw size={16} />
            <span className="font-medium">Trasforma in...</span>
            <ChevronDown size={16} className={`transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
          </button>

          {showDropdown && (
            <div className="absolute top-full left-0 mt-2 bg-white border rounded-lg shadow-xl z-50 min-w-[260px] overflow-hidden">
              {LIVELLI.filter(lvl => lvl !== 'Major').map(lvl => {
                const cfg = livelloConfig[lvl]
                const DropIcon = cfg.Icon
                const isCurrent = lvl === livelloAttuale
                return (
                  <button
                    key={lvl}
                    onClick={() => !isCurrent && openTransformModal(lvl)}
                    disabled={isCurrent}
                    className={`w-full text-left px-4 py-3 flex items-center gap-3 ${
                      isCurrent ? 'bg-gray-50 cursor-not-allowed' : 'hover:bg-blue-50 cursor-pointer'
                    } transition-colors border-b last:border-b-0`}
                  >
                    <DropIcon size={22} color={cfg.color} />
                    <div className="flex-1">
                      <div className={`font-semibold ${isCurrent ? 'text-gray-400' : 'text-gray-800'}`}>{cfg.label}</div>
                      <div className={`text-xs ${isCurrent ? 'text-gray-400' : 'text-gray-500'}`}>{cfg.desc}</div>
                    </div>
                    {isCurrent && (
                      <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded font-medium">ATTUALE</span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {kaizen.livello_storia && kaizen.livello_storia.length > 0 && (
          <button onClick={() => setShowStoria(!showStoria)} className="flex items-center gap-1 text-sm text-gray-600 hover:text-primary transition-colors">
            <History size={16} />
            <span>Storia metodologie ({kaizen.livello_storia.length})</span>
            <ChevronDown size={14} className={`transition-transform ${showStoria ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>

      {showStoria && kaizen.livello_storia && (
        <div className="bg-white rounded-xl shadow p-4 mb-6 border-l-4 border-primary">
          <h3 className="font-bold mb-3 flex items-center gap-2"><History size={16} /> Storia metodologie</h3>
          <div className="space-y-2">
            {[...kaizen.livello_storia].reverse().map((entry, i) => {
              const cfg = livelloConfig[entry.livello]
              const EntryIcon = cfg?.Icon || FileText
              return (
                <div key={i} className="flex items-start gap-3 py-2 border-b last:border-0">
                  <div className="flex-shrink-0 mt-0.5"><EntryIcon size={20} color={cfg?.color || '#64748b'} /></div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm">
                      <strong>{entry.livello}</strong>
                      {entry.livello_precedente && (<span className="text-gray-500"> (da {entry.livello_precedente})</span>)}
                    </div>
                    {entry.motivo && (<div className="text-xs text-gray-600 italic mt-0.5">"{entry.motivo}"</div>)}
                    <div className="text-xs text-gray-400 mt-0.5">{new Date(entry.quando).toLocaleString('it-IT')} · {entry.utente}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {showTransformModal && targetLivello && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md shadow-2xl">
            <div className="text-white px-6 py-4 rounded-t-xl flex justify-between items-center" style={{ backgroundColor: livelloConfig[targetLivello]?.color || '#3b82f6' }}>
              <h2 className="text-lg font-bold flex items-center gap-2"><RefreshCw size={20} /> Trasforma in {targetLivello}</h2>
              <button onClick={() => setShowTransformModal(false)} className="hover:bg-white hover:bg-opacity-20 p-1 rounded"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-center gap-3 bg-gray-50 p-4 rounded-lg">
                <div className="text-center">
                  {(() => { const I = livelloConfig[livelloAttuale]?.Icon; return I ? <I size={30} color={livelloConfig[livelloAttuale]?.color} /> : null })()}
                  <div className="text-xs text-gray-600 mt-1">{livelloAttuale}</div>
                </div>
                <div className="text-2xl text-gray-400">&rarr;</div>
                <div className="text-center">
                  {(() => { const I = livelloConfig[targetLivello]?.Icon; return I ? <I size={30} color={livelloConfig[targetLivello]?.color} /> : null })()}
                  <div className="text-xs font-bold mt-1" style={{ color: livelloConfig[targetLivello]?.color }}>{targetLivello}</div>
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                <strong className="text-blue-700">{livelloConfig[targetLivello]?.label}</strong>
                <p className="text-blue-600 text-xs mt-1">{livelloConfig[targetLivello]?.desc}</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Motivo della trasformazione <span className="text-gray-400 font-normal ml-1">(opzionale ma consigliato)</span></label>
                <textarea value={motivoTrasforma} onChange={(e) => setMotivoTrasforma(e.target.value)} rows={3} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Es: Problema più complesso del previsto, richiede team inter-funzionale" autoFocus />
              </div>
              <div className="flex gap-2 justify-end pt-3 border-t">
                <button onClick={() => setShowTransformModal(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-50" disabled={transforming}>Annulla</button>
                <button onClick={confirmTransform} disabled={transforming} className="px-6 py-2 text-white rounded-lg shadow-sm disabled:opacity-50 flex items-center gap-2" style={{ backgroundColor: livelloConfig[targetLivello]?.color || '#3b82f6' }}>
                  {transforming ? 'Trasformazione...' : 'Conferma trasformazione'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Banner Pillar per Major Kaizen */}
      {livelloAttuale === 'Major' && kaizen.pillar_id && (
        <div className="bg-purple-50 border-l-4 border-purple-400 rounded-r-lg p-3 mb-4 text-sm flex items-center gap-3">
          <Building2 size={24} className="text-purple-600 flex-shrink-0" />
          <div className="flex-1">
            <div className="font-semibold text-purple-900">
              Questo Major Kaizen fa parte del Pillar <strong>{kaizen.pillar_sigla}</strong>
              {kaizen.pillar_label && ` — ${kaizen.pillar_label}`}
            </div>
            <div className="text-xs text-purple-700">
              Per gestire i 5 Step KPI Management e il Master Plan annuale, vai al Pillar.
            </div>
          </div>
          <Link
            to={`/pillars/${kaizen.pillar_id}`}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 flex items-center gap-2 shadow-sm"
          >
            Apri Pillar
          </Link>
        </div>
      )}
      {livelloAttuale === 'Major' && !kaizen.pillar_id && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 rounded-r-lg p-3 mb-4 text-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle size={20} className="text-yellow-600 flex-shrink-0" />
            <div className="flex-1">
              <strong>Questo Major Kaizen non è collegato a nessun Pillar</strong>
              <div className="text-xs text-yellow-700 mt-0.5">
                Vai su <strong>Kaizen &gt; Modifica</strong> per assegnarlo a un Pillar e gestire i 5 Step KPI.
              </div>
            </div>
          </div>
        </div>
      )}

      {parentKaizen && (
        <div className="bg-blue-50 border-l-4 border-blue-400 rounded-r-lg p-3 mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <BarChart3 size={22} className="text-blue-600 flex-shrink-0" />
            <div>
              <div className="text-sm font-semibold text-blue-900">
                Questo Quick Kaizen fa parte del progetto {parentKaizen.numero}
              </div>
              <div className="text-xs text-blue-700">
                {parentKaizen.titolo || 'Progetto Standard'}
              </div>
            </div>
          </div>

          <Link
            to={`/kaizen/${parentKaizen._id}`}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 whitespace-nowrap flex items-center gap-2"
          >
            <RotateCcw size={16} />
            Torna al progetto
          </Link>
        </div>
      )}

      <div className="flex gap-1 mb-6 border-b overflow-x-auto">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 font-medium text-sm whitespace-nowrap ${activeTab === tab.id ? 'border-b-2 border-primary text-primary' : 'text-gray-500'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Wrapper che disabilita tutti i campi quando isLocked */}
      <fieldset disabled={isLocked} className={isLocked ? 'opacity-90 pointer-events-none' : ''}>

      {activeTab === 'setup' && (
        <div className="space-y-6">

          <div className="bg-white rounded-xl shadow p-6">
            <h3 className="bg-primary text-white text-center py-2 rounded-lg font-bold mb-4">AMBITO DEL PROGETTO</h3>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Reparto</label>
                <select value={kaizen.reparto || ''} onChange={(e) => handleRepartoChange(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="">Seleziona</option>
                  {reparti.filter(r => r.attivo !== false).map(r => (
                    <option key={r._id} value={r.nome}>{r.nome}{r.codice ? ` [${r.codice}]` : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Linea</label>
                <select value={kaizen.linea || ''} onChange={(e) => handleLineaChange(e.target.value)} disabled={!kaizen.reparto} className="w-full border rounded-lg px-3 py-2 text-sm disabled:bg-gray-100">
                  <option value="">{!kaizen.reparto ? 'Prima il reparto' : 'Seleziona'}</option>
                  {lineeDisponibili.map(l => (
                    <option key={l.id} value={l.nome}>{l.nome}{l.codice ? ` [${l.codice}]` : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Macchina</label>
                <select value={kaizen.macchina || ''} onChange={(e) => setKaizen(prev => ({ ...prev, macchina: e.target.value }))} disabled={!kaizen.linea} className="w-full border rounded-lg px-3 py-2 text-sm disabled:bg-gray-100">
                  <option value="">{!kaizen.linea ? 'Prima la linea' : 'Seleziona'}</option>
                  {macchineDisponibili.map(m => (
                    <option key={m.id} value={m.nome}>{m.nome}{m.codice ? ` [${m.codice}]` : ''}</option>
                  ))}
                </select>
              </div>
            </div>
                        <div className="mt-4">
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                Categoria Perdita (TPM)
              </label>

              <select
                value={kaizen.tipo_perdita || ''}
                onChange={(e) => setKaizen(prev => ({
                  ...prev,
                  tipo_perdita: e.target.value,
                }))}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Nessuna</option>

                {(configs.categorie_perdita || []).map(p => (
                  <option key={p._id} value={p.label}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-6 pt-5 border-t">
              <h4 className="font-bold text-sm text-gray-700 mb-4">
                Pillar del progetto
              </h4>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                    Pillar Owner
                  </label>

                  <select
                    value={kaizen.pillar_id || ''}
                    onChange={(e) => handlePillarOwnerChange(e.target.value)}
                    disabled={loadingPillars}
                    className="w-full border rounded-lg px-3 py-2 text-sm disabled:bg-gray-100"
                  >
                    <option value="">
                      {loadingPillars ? 'Caricamento...' : 'Seleziona Pillar Owner'}
                    </option>

                    {pillars.map(pillar => (
                      <option key={pillar._id} value={pillar._id}>
                        {pillar.sigla ? `${pillar.sigla} - ` : ''}
                        {getPillarLabel(pillar)}
                      </option>
                    ))}
                  </select>

                  <p className="text-xs text-gray-500 mt-1">
                    Pillar responsabile del coordinamento del progetto.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-2">
                    Pillar coinvolti
                  </label>

                  <div className="flex flex-wrap gap-2">
                    {pillars.map(pillar => {
                      const selected = (kaizen.pillar_ids || []).includes(pillar._id)
                      const isOwner = kaizen.pillar_id === pillar._id

                      return (
                        <button
                          key={pillar._id}
                          type="button"
                          onClick={() => togglePillarCoinvolto(pillar)}
                          disabled={isOwner}
                          className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                            selected || isOwner
                              ? 'bg-primary text-white border-primary'
                              : 'bg-white text-gray-600 border-gray-300 hover:border-primary hover:text-primary'
                          } disabled:opacity-80`}
                        >
                          {pillar.sigla || getPillarLabel(pillar)}
                          {isOwner ? ' · Owner' : ''}
                        </button>
                      )
                    })}
                  </div>

                  <p className="text-xs text-gray-500 mt-2">
                    Seleziona gli altri Pillar che contribuiscono al progetto.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow p-6">
            <h3 className="bg-primary text-white text-center py-2 rounded-lg font-bold mb-4">TEAM KAIZEN</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Team Leader</label>
                <UserPicker
                  value={kaizen.team_leader_id ? { id: kaizen.team_leader_id, name: kaizen.team_leader_nome } : null}
                  onChange={(sel) => {
                    if (sel) setKaizen(prev => ({ ...prev, team_leader_id: sel.id, team_leader_nome: sel.name }))
                    else setKaizen(prev => ({ ...prev, team_leader_id: null, team_leader_nome: '' }))
                  }}
                  mode="single"
                  placeholder="Cerca team leader..."
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Team Members ({kaizen.team_members_ids?.length || 0})</label>
                <UserPicker
                  value={(kaizen.team_members_ids || []).map((id, i) => ({ id, name: kaizen.team_members_nomi?.[i] || '' }))}
                  onChange={(sel) => setKaizen(prev => ({ ...prev, team_members_ids: sel.map(s => s.id), team_members_nomi: sel.map(s => s.name) }))}
                  mode="multi"
                  placeholder="Aggiungi membri al team..."
                />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-3">Ricorda di premere Salva in alto per confermare setup e team.</p>
          </div>

        </div>
      )}

      {activeTab === 'loss' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow p-6">
            <h3 className="bg-primary text-white text-center py-2 rounded-lg font-bold mb-2">LOSS DEPLOYMENT - PARETO DELLE PERDITE</h3>
            <p className="text-xs text-gray-500 text-center mb-4">Step 2 - Stratifica le perdite e identifica il 20% di cause che genera l'80% dell'impatto</p>
            <LossPareto
              value={kaizen.loss_pareto?.items || []}
              onChange={(items) => setKaizen(prev => ({ ...prev, loss_pareto: { ...prev.loss_pareto, items } }))}
            />
          </div>
        </div>
      )}

      {activeTab === 'gemba' && (
        <GembaObiettiviTab kaizen={kaizen} setKaizen={setKaizen} updateField={updateField} />
      )}

            {activeTab === 'masterplan' && (
        <div className="w-full max-w-full min-w-0 bg-white rounded-xl shadow p-6 overflow-hidden">
          <div className="mb-5">
            <h2 className="text-xl font-bold text-gray-800">
              Master Plan
            </h2>

            <p className="text-sm text-gray-500 mt-1">
              Pianificazione generale, milestone e avanzamento del progetto Standard Kaizen.
            </p>
          </div>

          <div className="w-full max-w-full min-w-0 overflow-hidden">
            <KaizenGantMasterPlan
              kaizen={kaizen}
              onSaved={loadKaizen}
            />
          </div>
        </div>
      )}

      {activeTab === 'quickkaizen' && (
        <div className="space-y-6">


          {/* PASSO 1 — Definizione del problema */}
                      <ProblemDefinition value={kaizen.passo1_definizione || {}} onChange={value => setKaizen(current => ({ ...current, passo1_definizione: value }))} />
{/* PASSO 2 - Ishikawa */}
          <div className="bg-white rounded-xl shadow p-6">
            <h3 className="bg-primary text-white text-center py-2 rounded-lg font-bold mb-4">
              PASSO 2 - CAUSE PROBABILI (Ishikawa)
            </h3>
            <IshikawaDiagram
              effetto={kaizen.passo2_cause_probabili?.effetto || ''}
              rami={kaizen.passo2_cause_probabili?.rami || {}}
              onChange={(data) => {
                setKaizen(prev => ({
                  ...prev,
                  passo2_cause_probabili: {
                    ...prev.passo2_cause_probabili,
                    effetto: data.effetto,
                    rami: data.rami,
                  },
                }))
              }}
            />
          </div>

          {/* PASSO 3 — Catene 5 Perché */}
          <div className="bg-white rounded-xl shadow p-6">
            <h3 className="bg-primary text-white text-center py-2 rounded-lg font-bold mb-4">
              PASSO 3 - 5 PERCHÉ (Catene Root Cause)
            </h3>
            <FiveWhysFlowChart
              effetto={kaizen.passo2_cause_probabili?.effetto || ''}
              rami={kaizen.passo2_cause_probabili?.rami || {}}
              onCreateActionPlan={handleCreateAPFromRootCause}
              onValidateRootCause={(nodeId, stato) => {
                setKaizen(prev => ({
                  ...prev,
                  passo2_cause_probabili: {
                    ...prev.passo2_cause_probabili,
                    rami: updateRootCauseStatus(
                      prev.passo2_cause_probabili?.rami || {},
                      nodeId,
                      stato
                    ),
                  },
                }))
              }}
            />
          </div>

          <div className="bg-white rounded-xl shadow p-6">
            <h3 className="bg-primary text-white text-center py-2 rounded-lg font-bold mb-4">
              PRIORITÀ RISCHIO (FMEA)
            </h3>
            <RiskPrioritizationChart
              effetto={kaizen.passo2_cause_probabili?.effetto || ''}
              rami={kaizen.passo2_cause_probabili?.rami || {}}
              onCreateActionPlan={handleCreateAPFromRootCause}
            />
          </div>

          <div className="w-full max-w-full min-w-0 bg-white rounded-xl shadow p-6 overflow-hidden">
            <h3 className="bg-primary text-white text-center py-2 rounded-lg font-bold mb-4">PASSO 5 - PIANO AZIONI</h3>

            <KaizenAzioniList
              kaizen={kaizen}
              kaizenId={id}
              kaizenNumero={kaizen.numero}
              onUpdate={loadKaizen}
            />
          </div>

          {/* FASE 6 + FASE 7 affiancate */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* FASE 6 — Risultati e Benefici */}
            <div className="bg-white rounded-xl shadow p-6">
              <h3 className="bg-primary text-white text-center py-2 rounded-lg font-bold mb-4">FASE 6 - RISULTATI E BENEFICI</h3>
              {livelloAttuale !== 'Quick' && (
                <div className="mb-4 space-y-3">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-gray-50 rounded-lg p-2">
                      <div className="text-xs text-gray-500 uppercase">Start</div>
                      <div className="text-lg font-bold text-gray-700">{kaizen.obiettivi?.start ?? '—'}</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2">
                      <div className="text-xs text-gray-500 uppercase">Target</div>
                      <div className="text-lg font-bold text-blue-600">{kaizen.obiettivi?.target ?? '—'}</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2">
                      <div className="text-xs text-gray-500 uppercase">Attuale</div>
                      <input type="number" value={kaizen.risultati?.attuale ?? ''} onChange={(e) => updateField('risultati', 'attuale', e.target.value)} className="w-full border rounded px-2 py-1 text-center text-lg font-bold text-green-600" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Costo progetto (EUR)</label>
                      <input type="number" value={kaizen.risultati?.costo ?? ''} onChange={(e) => updateField('risultati', 'costo', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Risparmio (EUR/anno)</label>
                      <input type="number" value={kaizen.risultati?.risparmio ?? ''} onChange={(e) => updateField('risultati', 'risparmio', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
                    </div>
                  </div>
                  {costo > 0 && risparmio > 0 && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-2 text-sm text-green-800 text-center">
                      ROI: <strong>{(risparmio / costo).toFixed(1)}x</strong> · Payback: <strong>{(costo / risparmio * 12).toFixed(1)} mesi</strong>
                    </div>
                  )}
                </div>
              )}
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Valutazione efficacia</label>
              <textarea value={kaizen.fase5_valutazione_efficacia?.osservazioni || ''}
                onChange={(e) => updateField('fase5_valutazione_efficacia', 'osservazioni', e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm" rows={5} />
            </div>

            {/* FASE 7 — Standardizzazione e Replica */}
            <div className="bg-white rounded-xl shadow p-6">
              <h3 className="bg-primary text-white text-center py-2 rounded-lg font-bold mb-4">FASE 7 - STANDARDIZZAZIONE E REPLICA</h3>
              {livelloAttuale !== 'Quick' && (
                <div className="mb-4 space-y-2">
                  {[
                    { key: 'sop', label: 'SOP / OPL creata o aggiornata' },
                    { key: 'dms', label: 'Documento caricato nel Document Management' },
                    { key: 'training', label: 'Persone coinvolte formate' },
                    { key: 'audit', label: 'Sistema di audit / check attivo' },
                  ].map(item => (
                    <label key={item.key} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={!!kaizen.standardizzazione?.[item.key]} onChange={(e) => updateField('standardizzazione', item.key, e.target.checked)} className="w-4 h-4" />
                      {item.label}
                    </label>
                  ))}
                </div>
              )}
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Note e piano di replica</label>
              <textarea value={kaizen.fase6_standardizzazione?.osservazioni || ''}
                onChange={(e) => updateField('fase6_standardizzazione', 'osservazioni', e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm" rows={5} />
            </div>
          </div>

        </div>
      )}

      {activeTab === 'figli' && (
        <FigliTab
          kaizenId={id}
          kaizenNumero={kaizen.numero}
          kaizenLivello={livelloAttuale}
          kaizenReparto={kaizen.reparto}
          kaizenLinea={kaizen.linea}
          onUpdate={loadKaizen}
        />
      )}

      {activeTab === 'actionplans' && (
        <ConsolidatedActionPlans
          kaizen={kaizen}
          kaizenId={id}
          kaizenNumero={kaizen.numero}
          onUpdate={loadKaizen}
        />
      )}

      {activeTab === 'stdelements' && isAdmin && (
        <StandardElementsTab
          kaizen={kaizen}
          onSaved={loadKaizen}
        />
      )}

      {activeTab === 'cmladder' && isAdmin && (
        <CountermeasureLadderTab
          kaizen={kaizen}
          onSaved={loadKaizen}
        />
      )}

      {activeTab === 'costbenefit' && (
        <PlaceholderTab title="Cost & Benefit" subtitle="Business case e calcolo ROI automatico"
          features={[
            'Calcolo costo totale (investimento + manodopera + materiali)',
            'Saving annuo stimato vs reale',
            'ROI e Payback period automatici',
            'Grafico proiezione 5 anni',
            'VAN (Valore Attuale Netto)',
            'Confronto stimato vs reale post-progetto',
            'Import template Excel Lindt',
          ]} phase="Futura" />
      )}

      {activeTab === 'audit' && (
        <TeamAuditTab kaizen={kaizen} setKaizen={setKaizen} />
      )}

{activeTab === 'lavagna' && (
  <div className="space-y-6">
    <div className="bg-white rounded-xl shadow p-6">
      <h3 className="font-bold text-lg text-gray-800 mb-3">
        Lavagna di progetto
      </h3>

      <textarea
        value={kaizen.lavagna || ''}
        onChange={(e) => setKaizen(prev => ({
          ...prev,
          lavagna: e.target.value,
        }))}
        className="w-full border rounded-lg px-4 py-3 min-h-[240px]"
        placeholder="Note, decisioni, punti aperti e informazioni utili al progetto..."
      />
    </div>

    <div className="bg-white rounded-xl shadow p-6">
      <ImageUpload
        images={kaizen.lavagna_immagini || []}
        onChange={(lavagna_immagini) => setKaizen(prev => ({
          ...prev,
          lavagna_immagini,
        }))}
        label="Fotografie e immagini"
        maxImages={20}
      />
    </div>

    <div className="bg-white rounded-xl shadow p-6">
      <DocumentUpload
        documents={kaizen.lavagna_documenti || []}
        onChange={(lavagna_documenti) => setKaizen(prev => ({
          ...prev,
          lavagna_documenti,
        }))}
      />
    </div>
  </div>
)}

      {activeTab === 'feed' && (
        <div className="bg-white rounded-xl shadow p-6">
          <div className="flex items-center justify-between gap-4 mb-5">
            <div>
              <h3 className="font-bold text-lg text-gray-800">
                Storico del Kaizen
              </h3>

              <p className="text-xs text-gray-500 mt-1">
                Eventi e modifiche registrati durante il ciclo di vita del Kaizen.
              </p>
            </div>

            <span className="text-xs bg-gray-100 text-gray-600 px-3 py-1 rounded-full">
              {storicoOrdinato.length} eventi
            </span>
          </div>

          {storicoOrdinato.length === 0 ? (
            <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center">
              <History size={24} className="mx-auto text-gray-300 mb-2" />

              <p className="text-sm text-gray-400">
                Nessun evento ancora registrato.
              </p>
            </div>
          ) : (
            <div>
              {storicoOrdinato.map((entry, index) => (
                <div
                  key={`${entry.timestamp || 'evento'}_${index}`}
                  className="relative flex gap-4 pb-5 last:pb-0"
                >
                  {index < storicoOrdinato.length - 1 && (
                    <div className="absolute left-[5px] top-4 bottom-0 w-px bg-gray-200" />
                  )}

                  <div className="relative z-10 mt-1.5 w-3 h-3 rounded-full bg-primary border-2 border-white shadow flex-shrink-0" />

                  <div className="flex-1 min-w-0 border-b border-gray-100 pb-4 last:border-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-sm text-gray-800">
                          <strong>
                            {entry.utente || 'Utente non disponibile'}
                          </strong>

                          <span className="text-gray-400 mx-2">
                            ·
                          </span>

                          <span>
                            {entry.azione || 'Attività registrata'}
                          </span>
                        </div>

                        {entry.dettaglio && (
                          <p className="text-xs text-gray-600 mt-1">
                            {entry.dettaglio}
                          </p>
                        )}
                      </div>

                      <time className="text-xs text-gray-400 whitespace-nowrap">
                        {formatStoricoDate(entry.timestamp)}
                      </time>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      </fieldset>

            {showUnsavedPrompt && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-60 p-4">
          <div className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="bg-primary px-5 py-4 text-white">
              <div className="flex items-center gap-3">
                <AlertTriangle size={22} />

                <div>
                  <h2 className="font-bold">
                    Modifiche non salvate
                  </h2>

                  <p className="mt-0.5 text-xs text-white text-opacity-80">
                    Hai modificato il Kaizen ma non hai ancora salvato.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4 p-5">
              <p className="text-sm text-gray-700">
                Vuoi salvare le modifiche prima di uscire da questa pagina?
              </p>

              <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-xs text-yellow-800">
                Uscendo senza salvare perderai tutte le modifiche effettuate dopo l’ultimo salvataggio.
              </div>

              <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={stayOnPage}
                  disabled={savingBeforeNavigation}
                  className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
                >
                  Resta nel Kaizen
                </button>

                <button
                  type="button"
                  onClick={discardAndContinue}
                  disabled={savingBeforeNavigation}
                  className="rounded-lg bg-gray-600 px-4 py-2 text-sm text-white hover:bg-gray-700 disabled:opacity-50"
                >
                  Esci senza salvare
                </button>

                <button
                  type="button"
                  onClick={saveAndContinue}
                  disabled={savingBeforeNavigation}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-light disabled:opacity-50"
                >
                  {savingBeforeNavigation
                    ? 'Salvataggio...'
                    : 'Salva e continua'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Form AP creato da Root Cause dei 5 Perché */}
      {showAPFormFromRootCause && rootCausePrefill && (
        <ActionPlanFormShared
          plan={{
            titolo: rootCausePrefill.titolo,
            descrizione: rootCausePrefill.descrizione,
          }}
          prefilledKaizen={{ kaizen_id: id, kaizen_numero: kaizen.numero }}
          onClose={() => {
            setShowAPFormFromRootCause(false)
            setRootCausePrefill(null)
          }}
          onSaved={() => {
            setShowAPFormFromRootCause(false)
            setRootCausePrefill(null)
            loadKaizen()
            alert('Action Plan creato e collegato al Kaizen.')
          }}
        />
      )}
    </div>
  )
}

function updateRootCauseStatus(rami, nodeId, stato) {
  const walk = nodes => nodes.map(node => {
    if (node.id === nodeId) {
      return { ...node, root_cause_stato: stato }
    }
    if (node.children?.length) {
      return { ...node, children: walk(node.children) }
    }
    return node
  })

  const next = {}
  Object.entries(rami).forEach(([ramoId, cause]) => {
    next[ramoId] = Array.isArray(cause) ? walk(cause) : cause
  })
  return next
}

// ──────────────────────────────────────────────────────────
// COMPONENTE PLACEHOLDER
// ──────────────────────────────────────────────────────────
function PlaceholderTab({ title, subtitle, steps, features, phase, target }) {
  return (
    <div className="bg-white rounded-xl shadow p-8">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold mb-1">{title}</h2>
        <p className="text-sm text-gray-500">{subtitle}</p>
        {target && (<span className="inline-block mt-2 px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">{target}</span>)}
      </div>
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-l-4 border-blue-400 p-4 rounded-r-lg mb-6">
        <div className="font-bold text-blue-900 mb-1">In costruzione</div>
        <div className="text-sm text-blue-700">Questa sezione verrà sbloccata nella <strong>Fase {phase}</strong> della roadmap LPW.</div>
        <div className="text-xs text-blue-600 mt-1">Per ora la struttura è visibile come anteprima.</div>
      </div>
      {steps && (
        <div>
          <h3 className="font-bold text-gray-700 mb-3 text-sm uppercase tracking-wider">Struttura prevista</h3>
          <div className="space-y-2">
            {steps.map((step, i) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border-l-2 border-gray-300 hover:border-primary transition-colors">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-white border-2 border-primary text-primary flex items-center justify-center font-bold text-sm">{step.num}</div>
                <div className="flex-1">
                  <div className="font-semibold text-gray-800">{step.label}</div>
                  <div className="text-xs text-gray-600 mt-0.5">{step.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {features && (
        <div>
          <h3 className="font-bold text-gray-700 mb-3 text-sm uppercase tracking-wider">Funzionalità previste</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {features.map((feature, i) => (
              <div key={i} className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg"><span className="text-sm">{feature}</span></div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────
// FIGLI TAB — Quick Kaizen collegati al progetto Standard/Major
// ──────────────────────────────────────────────────────────
function FigliTab({ kaizenId, kaizenNumero, kaizenLivello, kaizenReparto, kaizenLinea, onUpdate }) {
  const [figli, setFigli] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [newTitolo, setNewTitolo] = useState('')
  const [creating, setCreating] = useState(false)
  const [linking, setLinking] = useState(false)
  const [quickDisponibili, setQuickDisponibili] = useState([])
  const [loadingQuick, setLoadingQuick] = useState(false)
  const [quickSearch, setQuickSearch] = useState('')
  const [apByChild, setApByChild] = useState({})

  useEffect(() => { loadFigli() }, [kaizenId])

  const loadFigli = async () => {
    setLoading(true)
    try {
      const res = await api.get(`/kaizens/${kaizenId}/children`)
      const children = res.data || []
      setFigli(children)
      loadActionPlans(children)
    } catch (err) {
      console.error(err)
    }
    setLoading(false)
  }

  const loadActionPlans = async (children) => {
    const result = {}

    await Promise.all(
      children.map(async (child) => {
        try {
          const res = await api.get(`/kaizens/${child._id}/action-plans`)
          result[child._id] = res.data || []
        } catch {
          result[child._id] = []
        }
      })
    )

    setApByChild(result)
  }

  const createFiglio = async () => {
    if (!newTitolo.trim()) return alert('Inserisci un titolo.')
    setCreating(true)
    try {
      const res = await api.post('/kaizens/', {
        titolo: newTitolo,
        livello: 'Quick',
        tipo: 'Quick Kaizen',
        reparto: kaizenReparto || '',
        linea: kaizenLinea || '',
        parent_kaizen_id: kaizenId,
      })
      setNewTitolo('')
      setShowCreateModal(false)
      loadFigli()
      onUpdate?.()
      alert(`Quick Kaizen ${res.data?.numero} creato e collegato a ${kaizenNumero}.`)
    } catch (err) {
      console.error(err)
      alert('Errore durante la creazione: ' + (err.response?.data?.detail || err.message))
    }
    setCreating(false)
  }

  const loadQuickDisponibili = async () => {
    setLoadingQuick(true)

    try {
      const res = await api.get('/kaizens/', {
        params: {
          livello: 'Quick',
          parent_kaizen_id: 'null',
        },
      })

      const currentChildIds = new Set(figli.map(child => child._id))

      setQuickDisponibili(
        (res.data || []).filter(quick => !currentChildIds.has(quick._id))
      )
    } catch (err) {
      console.error('Errore caricamento Quick Kaizen disponibili:', err)
      setQuickDisponibili([])
      alert(
        'Errore durante il caricamento dei Quick Kaizen: ' +
        (err.response?.data?.detail || err.message)
      )
    } finally {
      setLoadingQuick(false)
    }
  }

  const openLinkModal = async () => {
    setQuickSearch('')
    setShowLinkModal(true)
    await loadQuickDisponibili()
  }

  const collegaQuickEsistente = async quick => {
    setLinking(true)

    try {
      await api.post(`/kaizens/${kaizenId}/link-child`, {
        child_kaizen_id: quick._id,
      })

      setShowLinkModal(false)
      setQuickSearch('')
      await loadFigli()
      onUpdate?.()

      alert(`${quick.numero} collegato correttamente a ${kaizenNumero}.`)
    } catch (err) {
      console.error('Errore collegamento Quick Kaizen:', err)
      alert(
        'Errore durante il collegamento: ' +
        (err.response?.data?.detail || err.message)
      )
    } finally {
      setLinking(false)
    }
  }
  
  const scollegaFiglio = async (childId, childNumero) => {
    if (!confirm(`Scollegare ${childNumero} da ${kaizenNumero}?\n\nIl Quick Kaizen rimane in vita ma non sarà più collegato a questo progetto.`)) return
    try {
      await api.delete(`/kaizens/${kaizenId}/link-child/${childId}`)
      loadFigli()
    } catch (err) {
      alert('Errore: ' + (err.response?.data?.detail || err.message))
    }
  }

  const STATO_COLORS = {
    'Aperto': 'bg-blue-100 text-blue-700',
    'In Corso': 'bg-yellow-100 text-yellow-700',
    'Chiuso': 'bg-green-100 text-green-700',
    'Done': 'bg-green-100 text-green-700',
    'Cancelled': 'bg-gray-200 text-gray-600',
  }

  const getRootCause = (child) => {
    const rami = child.passo2_cause_probabili?.rami || {}
    let found = null

    const walk = (node) => {
      if (!node || found) return
      if (node.is_root_cause && node.label) {
        found = node.label
        return
      }
      ;(node.children || []).forEach(walk)
    }

    Object.values(rami).forEach(cause => {
      if (Array.isArray(cause)) cause.forEach(walk)
    })

    return found
  }

  const getApStats = (childId) => {
    const list = apByChild[childId] || []
    const total = list.length

    const late = list.filter(ap => {
      if (!ap.data_scadenza) return false
      if (ap.stato_visuale === 'In Ritardo') return true

      const scad = new Date(ap.data_scadenza)
      const oggi = new Date()
      const chiuso = ['Chiuso', 'Done', 'Completato'].includes(ap.stato)

      return !chiuso && scad < oggi
    }).length

    return { total, late }
  }

  const openChild = (childId) => {
    window.location.href = `/kaizen/${childId}`
  }

  const quickDisponibiliFiltrati = quickDisponibili.filter(quick => {
    const searchValue = quickSearch.trim().toLowerCase()

    if (!searchValue) return true

    return (
      (quick.numero || '').toLowerCase().includes(searchValue) ||
      (quick.titolo || '').toLowerCase().includes(searchValue) ||
      (quick.reparto || '').toLowerCase().includes(searchValue) ||
      (quick.linea || '').toLowerCase().includes(searchValue)
    )
  })

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow p-4">
        <div className="flex justify-between items-center gap-3">
          <div>
            <h3 className="font-bold text-lg">
              Quick Kaizen del progetto {kaizenNumero}
            </h3>
            <p className="text-xs text-gray-500">
              {figli.length === 0
                ? 'Nessun Quick Kaizen ancora collegato a questo progetto'
                : `${figli.length} Quick Kaizen ${figli.length === 1 ? 'collegato' : 'collegati'} a questo ${kaizenLivello}`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openLinkModal}
              className="border border-primary text-primary px-4 py-2 rounded-lg hover:bg-blue-50 text-sm font-medium whitespace-nowrap"
            >
              Collega Quick esistente
            </button>

            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-light text-sm font-medium whitespace-nowrap"
            >
              Crea Quick Kaizen
            </button>
          </div>
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md shadow-2xl">
            <div className="bg-green-600 text-white px-5 py-3 rounded-t-xl flex justify-between items-center">
              <h2 className="text-lg font-bold">Crea Quick Kaizen</h2>
              <button onClick={() => setShowCreateModal(false)} className="hover:bg-white hover:bg-opacity-20 p-1 rounded">
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                <strong className="text-blue-700">Verrà collegato a {kaizenNumero}</strong>
                <p className="text-blue-600 text-xs mt-1">Reparto e linea vengono ereditati dal progetto padre quando possibile.</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Titolo <span className="text-red-500">*</span>
                </label>
                <input
                  value={newTitolo}
                  onChange={(e) => setNewTitolo(e.target.value)}
                  placeholder="Es: Pulizia ugelli linea 3"
                  className="w-full border rounded-lg px-3 py-2"
                  autoFocus
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 border rounded-lg" disabled={creating}>
                  Annulla
                </button>
                <button onClick={createFiglio} disabled={creating} className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
                  {creating ? 'Creazione...' : 'Crea Quick Kaizen'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showLinkModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-3xl shadow-2xl overflow-hidden">
            <div className="bg-primary text-white px-5 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">
                  Collega Quick Kaizen esistente
                </h2>

                <p className="text-xs text-white text-opacity-80 mt-1">
                  Verranno mostrati soltanto i Quick Kaizen non collegati ad altri progetti.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowLinkModal(false)}
                disabled={linking}
                className="p-1 rounded hover:bg-white hover:bg-opacity-20 disabled:opacity-50"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5">
              <input
                type="text"
                value={quickSearch}
                onChange={(e) => setQuickSearch(e.target.value)}
                placeholder="Cerca per numero, titolo, reparto o linea..."
                className="w-full border rounded-lg px-4 py-2.5 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-primary"
                autoFocus
              />

              {loadingQuick ? (
                <div className="py-12 text-center text-sm text-gray-400">
                  Caricamento Quick Kaizen...
                </div>
              ) : quickDisponibiliFiltrati.length === 0 ? (
                <div className="border-2 border-dashed border-gray-200 rounded-lg py-12 text-center">
                  <Zap size={28} className="mx-auto text-gray-300 mb-2" />

                  <div className="text-sm font-medium text-gray-600">
                    Nessun Quick Kaizen disponibile
                  </div>

                  <div className="text-xs text-gray-400 mt-1">
                    I Quick esistenti potrebbero essere già collegati oppure non corrispondere alla ricerca.
                  </div>
                </div>
              ) : (
                <div className="max-h-[55vh] overflow-y-auto divide-y border rounded-lg">
                  {quickDisponibiliFiltrati.map(quick => {
                    const scopeDiverso =
                      (kaizenReparto &&
                        quick.reparto &&
                        kaizenReparto !== quick.reparto) ||
                      (kaizenLinea &&
                        quick.linea &&
                        kaizenLinea !== quick.linea)

                    return (
                      <div
                        key={quick._id}
                        className="p-4 flex items-center gap-4 hover:bg-gray-50"
                      >
                        <div className="w-10 h-10 rounded-full bg-green-100 text-green-700 flex items-center justify-center flex-shrink-0">
                          <Zap size={18} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-primary">
                              {quick.numero}
                            </span>

                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                              {quick.stato || 'Aperto'}
                            </span>
                          </div>

                          <div className="font-semibold text-sm text-gray-800 mt-1">
                            {quick.titolo || 'Senza titolo'}
                          </div>

                          <div className="text-xs text-gray-500 mt-1">
                            {[quick.reparto, quick.linea, quick.macchina]
                              .filter(Boolean)
                              .join(' · ') || 'Ambito non specificato'}
                          </div>

                          {scopeDiverso && (
                            <div className="text-xs text-orange-600 mt-1 flex items-center gap-1">
                              <AlertTriangle size={12} />
                              Reparto o linea differente dal progetto
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => collegaQuickEsistente(quick)}
                          disabled={linking}
                          className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-light disabled:opacity-50 whitespace-nowrap"
                        >
                          {linking ? 'Collegamento...' : 'Collega'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="bg-gray-50 border-t px-5 py-3 flex justify-end">
              <button
                type="button"
                onClick={() => setShowLinkModal(false)}
                disabled={linking}
                className="px-4 py-2 border rounded-lg text-sm hover:bg-white disabled:opacity-50"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}
      
      {loading ? (
        <div className="bg-white rounded-xl shadow p-8 text-center text-gray-400">Caricamento...</div>
      ) : figli.length === 0 ? (
        <div className="bg-white rounded-xl shadow p-12 text-center">
          <h3 className="text-lg font-semibold mb-1">Nessun Quick Kaizen ancora</h3>
          <p className="text-sm text-gray-500 mb-4">
            Un {kaizenLivello} Kaizen può includere Quick Kaizen più piccoli per gestire sotto-problemi specifici.
          </p>
          <button onClick={() => setShowCreateModal(true)} className="text-primary hover:underline">
            Crea il primo Quick Kaizen
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {figli.map(child => {
            const rootCause = getRootCause(child)
            const apStats = getApStats(child._id)
            const perdita = child.tipo_perdita || child.categoria || null
            const risultato = child.risultati?.attuale

            return (
              <div key={child._id} className="bg-white rounded-xl shadow border-l-4 border-green-500 hover:shadow-md transition-shadow">
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <Zap size={18} className="text-green-600" />
                      <span className="font-mono text-xs text-primary font-bold">{child.numero}</span>
                    </div>

                    {child.stato && (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATO_COLORS[child.stato] || 'bg-gray-100 text-gray-700'}`}>
                        {child.stato}
                      </span>
                    )}
                  </div>

                  <h4 className="font-semibold mb-3">{child.titolo || 'Senza titolo'}</h4>

                  <div className="space-y-1.5 text-xs text-gray-600">
                    {child.team_leader_nome && (
                      <div className="flex items-center gap-2">
                        <User size={13} className="text-gray-400" />
                        <span>Leader: <strong className="text-gray-700">{child.team_leader_nome}</strong></span>
                      </div>
                    )}

                    {perdita && (
                      <div className="flex items-center gap-2">
                        <Target size={13} className="text-gray-400" />
                        <span>Perdita: {perdita}</span>
                      </div>
                    )}

                    {(child.reparto || child.linea) && (
                      <div className="flex items-center gap-2">
                        <Factory size={13} className="text-gray-400" />
                        <span>{[child.reparto, child.linea].filter(Boolean).join(' · ')}</span>
                      </div>
                    )}

                    {rootCause && (
                      <div className="flex items-start gap-2">
                        <AlertTriangle size={13} className="text-red-500 mt-0.5 flex-shrink-0" />
                        <span>Root Cause: <strong className="text-red-700">{rootCause}</strong></span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 mt-3">
                    <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                      Action Plan: {apStats.total}
                    </span>

                    {apStats.late > 0 && (
                      <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded font-medium">
                        {apStats.late} in ritardo
                      </span>
                    )}

                    {risultato !== undefined && risultato !== '' && risultato !== null && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                        Attuale: {risultato}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 px-4 py-2 border-t bg-gray-50 rounded-b-xl">
                  <button
                    onClick={() => openChild(child._id)}
                    className="text-xs px-3 py-1.5 bg-blue-50 hover:bg-blue-100 rounded text-blue-700 flex-1 text-center font-medium"
                  >
                    Apri Quick Kaizen
                  </button>

                  <button
                    onClick={() => scollegaFiglio(child._id, child.numero)}
                    className="text-xs px-3 py-1.5 bg-red-50 hover:bg-red-100 rounded text-red-600"
                    title="Scollega dal progetto"
                  >
                    Scollega
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────
// 8 STANDARD ELEMENTS TAB — Lindt FI Pillar
// ──────────────────────────────────────────────────────────
const STD_ELEMENTS = [
  {
    area: 1,
    areaLabel: 'Problem Description',
    areaColor: 'bg-blue-50 border-blue-300',
    areaHeaderColor: 'bg-blue-100 text-blue-800',
    items: [
      { id: '1.1', label: 'Clear description of phenomenon', desc: 'Descrizione chiara del fenomeno (cosa, dove, quando, chi, quale, come)' },
      { id: '1.2', label: 'Impact quantified with KPI', desc: 'Impatto quantificato con KPI di loss (es: % scarti, tempo perso, costo)' },
    ],
  },
  {
    area: 2,
    areaLabel: 'Root Cause Analysis',
    areaColor: 'bg-purple-50 border-purple-300',
    areaHeaderColor: 'bg-purple-100 text-purple-800',
    items: [
      { id: '2.1', label: 'Stratification: clear & understanding', desc: 'Stratificazione del problema chiara e comprensibile' },
      { id: '2.2', label: 'Usage of 5 Whys method', desc: 'Utilizzo del metodo 5 Why per arrivare alla causa radice' },
      { id: '2.3', label: 'Only relevant causes verified', desc: 'Verificate solo cause realmente rilevanti (no analisi inutili)' },
    ],
  },
  {
    area: 3,
    areaLabel: 'Implementation',
    areaColor: 'bg-green-50 border-green-300',
    areaHeaderColor: 'bg-green-100 text-green-800',
    items: [
      { id: '3.1', label: 'Action log filled properly', desc: 'Log azioni completo con responsabile, data e azione chiara' },
      { id: '3.2', label: 'Horizontal/vertical expansion', desc: 'Espansione orizzontale (altre linee) o verticale (altri stabilimenti)' },
    ],
  },
  {
    area: 4,
    areaLabel: 'Standardization',
    areaColor: 'bg-orange-50 border-orange-300',
    areaHeaderColor: 'bg-orange-100 text-orange-800',
    items: [
      { id: '4.1', label: 'Loss eradication', desc: 'Eliminazione definitiva della perdita (verificata nel tempo)' },
    ],
  },
]

const SCORE_OPTIONS = [
  { value: 0, label: 'Non OK', color: 'bg-red-100 text-red-700 border-red-400' },
  { value: 0.5, label: 'Parziale', color: 'bg-yellow-100 text-yellow-700 border-yellow-400' },
  { value: 1, label: 'OK', color: 'bg-green-100 text-green-700 border-green-400' },
]

const MAX_SCORE = 8

function StandardElementsTab({ kaizen }) {
  const [scores, setScores] = useState(kaizen.standard_elements?.scores || {})
  const [notes, setNotes] = useState(kaizen.standard_elements?.notes || {})
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  const scoresRef = useRef(scores)
  const notesRef = useRef(notes)
  const kaizenIdRef = useRef(kaizen._id)

  useEffect(() => { scoresRef.current = scores }, [scores])
  useEffect(() => { notesRef.current = notes }, [notes])

  const totalScore = Object.values(scores).reduce((sum, v) => sum + (parseFloat(v) || 0), 0)
  const percent = (totalScore / MAX_SCORE) * 100
  const completedCount = Object.keys(scores).length
  const totalElements = STD_ELEMENTS.reduce((sum, area) => sum + area.items.length, 0)

  let passStatus = { label: 'Da Completare', color: 'bg-gray-100 text-gray-700' }
  if (completedCount === totalElements) {
    if (totalScore >= 8) passStatus = { label: 'PASS', color: 'bg-green-600 text-white' }
    else if (totalScore >= 5) passStatus = { label: 'PARTIAL PASS', color: 'bg-yellow-500 text-white' }
    else passStatus = { label: 'FAIL', color: 'bg-red-600 text-white' }
  }

  const doSave = async (silent = false) => {
    if (!silent) setSaving(true)
    try {
      const currentScores = scoresRef.current
      const currentNotes = notesRef.current
      const currentTotal = Object.values(currentScores).reduce((sum, v) => sum + (parseFloat(v) || 0), 0)
      const currentCount = Object.keys(currentScores).length

      let currentStatus = 'Da Completare'
      if (currentCount === totalElements) {
        if (currentTotal >= 8) currentStatus = 'PASS'
        else if (currentTotal >= 5) currentStatus = 'PARTIAL PASS'
        else currentStatus = 'FAIL'
      }

      await api.put(`/kaizens/${kaizenIdRef.current}`, {
        standard_elements: {
          scores: currentScores,
          notes: currentNotes,
          total_score: currentTotal,
          max_score: MAX_SCORE,
          percent: (currentTotal / MAX_SCORE) * 100,
          pass_status: currentStatus,
          last_evaluated_at: new Date().toISOString(),
        },
      })
      if (!silent) {
        setLastSaved(new Date())
        setHasUnsavedChanges(false)
      }
      return true
    } catch (err) {
      console.error('Errore salvataggio Standard Elements:', err)
      if (!silent) alert('Errore durante il salvataggio: ' + (err.response?.data?.detail || err.message))
      return false
    } finally {
      if (!silent) setSaving(false)
    }
  }

  useEffect(() => {
    if (Object.keys(scores).length === 0 && Object.keys(notes).length === 0) return
    setHasUnsavedChanges(true)
    const timer = setTimeout(() => doSave(false), 400)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scores, notes])

  useEffect(() => {
    return () => {
      if (Object.keys(scoresRef.current).length > 0 || Object.keys(notesRef.current).length > 0) {
        const currentScores = scoresRef.current
        const currentNotes = notesRef.current
        const currentTotal = Object.values(currentScores).reduce((sum, v) => sum + (parseFloat(v) || 0), 0)
        const currentCount = Object.keys(currentScores).length
        let currentStatus = 'Da Completare'
        if (currentCount === totalElements) {
          if (currentTotal >= 8) currentStatus = 'PASS'
          else if (currentTotal >= 5) currentStatus = 'PARTIAL PASS'
          else currentStatus = 'FAIL'
        }
        api.put(`/kaizens/${kaizenIdRef.current}`, {
          standard_elements: {
            scores: currentScores,
            notes: currentNotes,
            total_score: currentTotal,
            max_score: MAX_SCORE,
            percent: (currentTotal / MAX_SCORE) * 100,
            pass_status: currentStatus,
            last_evaluated_at: new Date().toISOString(),
          },
        }).catch(err => console.error('Errore save su unmount:', err))
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedChanges])

  const setScore = (itemId, value) => setScores(prev => ({ ...prev, [itemId]: value }))
  const setNote = (itemId, value) => setNotes(prev => ({ ...prev, [itemId]: value }))
  const manualSave = async () => { await doSave(false) }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold mb-1">8 Standard Elements</h3>
            <p className="text-sm text-gray-500">Valutazione qualità Quick Kaizen — Lindt FI Pillar</p>
          </div>
          <div className="text-right">
            <div className={`inline-block px-3 py-1.5 rounded-lg font-bold text-sm ${passStatus.color}`}>
              {passStatus.label}
            </div>
            <div className="text-xs mt-1 flex items-center justify-end gap-2">
              {saving ? <span className="text-blue-600">Salvataggio...</span> :
               hasUnsavedChanges ? <span className="text-orange-600 font-medium">Modifiche non salvate</span> :
               lastSaved ? <span className="text-green-600">Salvato alle {lastSaved.toLocaleTimeString('it-IT')}</span> :
               <span className="text-gray-400">In attesa</span>}
              <button onClick={manualSave} disabled={saving} className="bg-primary text-white px-3 py-1 rounded text-xs hover:bg-primary-light disabled:opacity-50">
                Salva ora
              </button>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">SCORE TOTALE</span>
            <span className="text-sm text-gray-500">Target Lindt: 8/8</span>
          </div>
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-4xl font-bold text-primary">{totalScore.toFixed(1)}</span>
            <span className="text-xl text-gray-400">/ {MAX_SCORE}</span>
            <span className="ml-auto text-lg font-semibold text-gray-600">{percent.toFixed(0)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                totalScore >= 8 ? 'bg-green-500' :
                totalScore >= 5 ? 'bg-yellow-500' :
                totalScore > 0 ? 'bg-orange-500' :
                'bg-gray-300'
              }`}
              style={{ width: `${percent}%` }}
            />
          </div>
          <div className="text-xs text-gray-500 mt-2">{completedCount}/{totalElements} elementi valutati</div>
        </div>
      </div>

      {STD_ELEMENTS.map(area => (
        <div key={area.area} className={`rounded-xl border-2 ${area.areaColor} overflow-hidden`}>
          <div className={`${area.areaHeaderColor} px-4 py-2.5 font-bold text-sm`}>
            AREA {area.area} — {area.areaLabel}
          </div>
          <div className="bg-white">
            {area.items.map((item, idx) => {
              const currentScore = scores[item.id]
              return (
                <div key={item.id} className={`p-4 ${idx < area.items.length - 1 ? 'border-b' : ''}`}>
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                          {item.id}
                        </span>
                        <span className="font-semibold text-sm">{item.label}</span>
                      </div>
                      <p className="text-xs text-gray-600 mb-2">{item.desc}</p>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      {SCORE_OPTIONS.map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => setScore(item.id, opt.value)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold border-2 transition-all ${
                            currentScore === opt.value
                              ? opt.color + ' shadow-md scale-105'
                              : 'bg-white text-gray-400 border-gray-200 hover:border-gray-400'
                          }`}
                          title={opt.label}
                        >
                          {opt.label} ({opt.value})
                        </button>
                      ))}
                    </div>
                  </div>
                  <textarea
                    value={notes[item.id] || ''}
                    onChange={(e) => setNote(item.id, e.target.value)}
                    placeholder="Note opzionali (giustificazione, evidenze, riferimenti)..."
                    rows={2}
                    className="w-full text-xs border rounded-lg px-3 py-2 mt-1 resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              )
            })}
          </div>
        </div>
      ))}

      <div className="bg-blue-50 border-l-4 border-blue-400 rounded-r-lg p-4 text-sm text-blue-700">
        <div className="font-semibold mb-1">Come compilare</div>
        <div className="text-xs space-y-1">
          <div><strong>OK (1)</strong> — Elemento pienamente soddisfatto</div>
          <div><strong>Parziale (0.5)</strong> — Soddisfatto ma migliorabile</div>
          <div><strong>Non OK (0)</strong> — Elemento mancante o non sufficiente</div>
          <div className="mt-2 pt-2 border-t border-blue-200">
            <strong>Soglie Lindt:</strong> PASS = 8 · PARTIAL = 5-7 · FAIL &lt; 5
          </div>
        </div>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────
// COUNTERMEASURE LADDER TAB — Lindt FI Pillar 6 livelli
// ──────────────────────────────────────────────────────────
const CM_LEVELS = [
  { level: 6, label: 'Innovation / Re-engineering', desc: 'Nuove tecnologie, redesign processo, investimenti strutturali', color: 'bg-emerald-50 border-emerald-400', headerColor: 'bg-emerald-100 text-emerald-900', badge: 'bg-emerald-600 text-white' },
  { level: 5, label: 'Technological / Process Improvement', desc: 'Meccanizzazione, automazione, modifica processo', color: 'bg-green-50 border-green-400', headerColor: 'bg-green-100 text-green-900', badge: 'bg-green-600 text-white' },
  { level: 4, label: 'Root Cause Elimination (Poka Yoke)', desc: 'Miglioramento parametri oltre lo standard originale (errore impossibile)', color: 'bg-lime-50 border-lime-400', headerColor: 'bg-lime-100 text-lime-900', badge: 'bg-lime-600 text-white' },
  { level: 3, label: 'Visual Control / Management', desc: 'Contromisure stabili che eliminano la causa tecnica (visual control)', color: 'bg-yellow-50 border-yellow-400', headerColor: 'bg-yellow-100 text-yellow-900', badge: 'bg-yellow-600 text-white' },
  { level: 2, label: 'Restoration of Process Standards', desc: 'Azioni che riportano il processo agli standard (cicli pulizia, ruoli chiari)', color: 'bg-orange-50 border-orange-400', headerColor: 'bg-orange-100 text-orange-900', badge: 'bg-orange-600 text-white' },
  { level: 1, label: 'Restoration of Basic Conditions', desc: 'Pulizia base, 5S, ricordare check agli operatori', color: 'bg-red-50 border-red-400', headerColor: 'bg-red-100 text-red-900', badge: 'bg-red-600 text-white' },
]

function CountermeasureLadderTab({ kaizen }) {
  const [countermeasures, setCountermeasures] = useState(kaizen.countermeasure_ladder?.items || {})
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [newInputs, setNewInputs] = useState({})

  const cmRef = useRef(countermeasures)
  const kaizenIdRef = useRef(kaizen._id)
  useEffect(() => { cmRef.current = countermeasures }, [countermeasures])

  const livelliPresenti = Object.keys(countermeasures)
    .filter(lvl => countermeasures[lvl]?.length > 0)
    .map(lvl => parseInt(lvl))

  const maxLevel = livelliPresenti.length > 0 ? Math.max(...livelliPresenti) : 0
  const totalCount = Object.values(countermeasures).reduce((sum, arr) => sum + (arr?.length || 0), 0)

  let robustness = { label: 'Da Compilare', color: 'bg-gray-100 text-gray-700' }
  if (maxLevel >= 4) robustness = { label: 'OTTIMO', color: 'bg-green-600 text-white' }
  else if (maxLevel >= 3) robustness = { label: 'BUONO', color: 'bg-yellow-500 text-white' }
  else if (maxLevel >= 1) robustness = { label: 'DEBOLE', color: 'bg-red-600 text-white' }

  const doSave = async (silent = false) => {
    if (!silent) setSaving(true)
    try {
      const currentCM = cmRef.current
      const currentLivelli = Object.keys(currentCM).filter(lvl => currentCM[lvl]?.length > 0).map(lvl => parseInt(lvl))
      const currentMax = currentLivelli.length > 0 ? Math.max(...currentLivelli) : 0
      const currentTotal = Object.values(currentCM).reduce((sum, arr) => sum + (arr?.length || 0), 0)
      let currentRobust = 'Da Compilare'
      if (currentMax >= 4) currentRobust = 'OTTIMO'
      else if (currentMax >= 3) currentRobust = 'BUONO'
      else if (currentMax >= 1) currentRobust = 'DEBOLE'

      await api.put(`/kaizens/${kaizenIdRef.current}`, {
        countermeasure_ladder: {
          items: currentCM,
          max_level: currentMax,
          total_count: currentTotal,
          robustness: currentRobust,
          last_evaluated_at: new Date().toISOString(),
        },
      })
      if (!silent) {
        setLastSaved(new Date())
        setHasUnsavedChanges(false)
      }
    } catch (err) {
      console.error('Errore salvataggio Countermeasure Ladder:', err)
      if (!silent) alert('Errore: ' + (err.response?.data?.detail || err.message))
    } finally {
      if (!silent) setSaving(false)
    }
  }

  useEffect(() => {
    if (Object.keys(countermeasures).length === 0) return
    setHasUnsavedChanges(true)
    const timer = setTimeout(() => doSave(false), 400)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countermeasures])

  useEffect(() => {
    return () => {
      if (Object.keys(cmRef.current).length > 0) {
        const currentCM = cmRef.current
        const currentLivelli = Object.keys(currentCM).filter(lvl => currentCM[lvl]?.length > 0).map(lvl => parseInt(lvl))
        const currentMax = currentLivelli.length > 0 ? Math.max(...currentLivelli) : 0
        const currentTotal = Object.values(currentCM).reduce((sum, arr) => sum + (arr?.length || 0), 0)
        let currentRobust = 'Da Compilare'
        if (currentMax >= 4) currentRobust = 'OTTIMO'
        else if (currentMax >= 3) currentRobust = 'BUONO'
        else if (currentMax >= 1) currentRobust = 'DEBOLE'

        api.put(`/kaizens/${kaizenIdRef.current}`, {
          countermeasure_ladder: {
            items: currentCM,
            max_level: currentMax,
            total_count: currentTotal,
            robustness: currentRobust,
            last_evaluated_at: new Date().toISOString(),
          },
        }).catch(err => console.error('Errore save unmount:', err))
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedChanges])

  const addCountermeasure = (level) => {
    const text = (newInputs[level] || '').trim()
    if (!text) return
    setCountermeasures(prev => ({
      ...prev,
      [level]: [...(prev[level] || []), {
        id: Date.now().toString(),
        text,
        added_at: new Date().toISOString(),
      }],
    }))
    setNewInputs(prev => ({ ...prev, [level]: '' }))
  }

  const removeCountermeasure = (level, itemId) => {
    setCountermeasures(prev => ({
      ...prev,
      [level]: (prev[level] || []).filter(item => item.id !== itemId),
    }))
  }

  const manualSave = async () => { await doSave(false) }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold mb-1">Countermeasure Ladder</h3>
            <p className="text-sm text-gray-500">Robustezza delle contromisure — Lindt FI Pillar</p>
          </div>
          <div className="text-right">
            <div className={`inline-block px-3 py-1.5 rounded-lg font-bold text-sm ${robustness.color}`}>
              {robustness.label}
            </div>
            <div className="text-xs mt-1 flex items-center justify-end gap-2">
              {saving ? <span className="text-blue-600">Salvataggio...</span> :
               hasUnsavedChanges ? <span className="text-orange-600 font-medium">Modifiche non salvate</span> :
               lastSaved ? <span className="text-green-600">Salvato alle {lastSaved.toLocaleTimeString('it-IT')}</span> :
               <span className="text-gray-400">In attesa</span>}
              <button onClick={manualSave} disabled={saving} className="bg-primary text-white px-3 py-1 rounded text-xs hover:bg-primary-light disabled:opacity-50">
                Salva ora
              </button>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">LIVELLO MASSIMO RAGGIUNTO</span>
            <span className="text-sm text-gray-500">Target: &ge; 4 (Poka Yoke)</span>
          </div>
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-4xl font-bold text-primary">{maxLevel}</span>
            <span className="text-xl text-gray-400">/ 6</span>
            <span className="ml-auto text-sm font-medium text-gray-600">
              {totalCount} contromisur{totalCount === 1 ? 'a' : 'e'}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                maxLevel >= 5 ? 'bg-emerald-500' :
                maxLevel >= 4 ? 'bg-green-500' :
                maxLevel >= 3 ? 'bg-yellow-500' :
                maxLevel >= 1 ? 'bg-orange-500' :
                'bg-gray-300'
              }`}
              style={{ width: `${(maxLevel / 6) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {CM_LEVELS.map(lvl => {
        const items = countermeasures[lvl.level] || []
        return (
          <div key={lvl.level} className={`rounded-xl border-2 ${lvl.color} overflow-hidden`}>
            <div className={`${lvl.headerColor} px-4 py-3 flex items-center gap-3`}>
              <span className={`${lvl.badge} px-2.5 py-1 rounded-lg font-bold text-sm`}>
                Liv. {lvl.level}
              </span>
              <div className="flex-1">
                <div className="font-bold text-sm">{lvl.label}</div>
                <div className="text-xs opacity-80 mt-0.5">{lvl.desc}</div>
              </div>
              {items.length > 0 && (
                <span className="text-xs font-bold bg-white px-2 py-1 rounded-full">
                  {items.length}
                </span>
              )}
            </div>

            <div className="bg-white p-4 space-y-2">
              {items.length > 0 ? (
                items.map(item => (
                  <div key={item.id} className="flex items-start justify-between gap-2 p-2 bg-gray-50 rounded-lg hover:bg-gray-100">
                    <div className="flex-1 text-sm">
                      <span className="text-gray-400 mr-2">•</span>
                      {item.text}
                    </div>
                    <button
                      onClick={() => removeCountermeasure(lvl.level, item.id)}
                      className="text-red-500 hover:bg-red-50 p-1 rounded transition-colors flex-shrink-0"
                      title="Rimuovi"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))
              ) : (
                <div className="text-xs text-gray-400 italic py-1">Nessuna contromisura a questo livello</div>
              )}

              <div className="flex gap-2 pt-2 border-t">
                <input
                  type="text"
                  value={newInputs[lvl.level] || ''}
                  onChange={(e) => setNewInputs(prev => ({ ...prev, [lvl.level]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addCountermeasure(lvl.level)
                    }
                  }}
                  placeholder={`Aggiungi contromisura livello ${lvl.level}...`}
                  className="flex-1 text-sm border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <button
                  onClick={() => addCountermeasure(lvl.level)}
                  disabled={!newInputs[lvl.level]?.trim()}
                  className={`${lvl.badge} px-3 py-1.5 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed transition-opacity`}
                >
                  Aggiungi
                </button>
              </div>
            </div>
          </div>
        )
      })}

      <div className="bg-blue-50 border-l-4 border-blue-400 rounded-r-lg p-4 text-sm text-blue-700">
        <div className="font-semibold mb-2">Come funziona</div>
        <div className="text-xs space-y-1">
          <div>Per ogni livello aggiungi le contromisure che hai implementato (premi <strong>Invio</strong> o click <strong>Aggiungi</strong>).</div>
          <div>Il <strong>livello più alto raggiunto</strong> determina la robustezza globale.</div>
          <div className="mt-2 pt-2 border-t border-blue-200">
            <strong>Soglie Lindt:</strong> OTTIMO &ge; Liv.4 (Poka Yoke) · BUONO = Liv.3 · DEBOLE &le; Liv.2
          </div>
          <div className="mt-1 text-blue-600 italic">
            Più alta la contromisura, più robusta nel tempo. Punta sempre al massimo livello possibile.
          </div>
        </div>
      </div>
    </div>
  )
}

// ----------------------------------------------------------
// LOSS PARETO - grafico delle perdite (Standard Kaizen step 2)
// ----------------------------------------------------------
function LossPareto({ value = [], onChange }) {
  const [label, setLabel] = useState('')
  const [val, setVal] = useState('')

  const add = () => {
    const n = parseFloat(val)
    if (!label.trim() || isNaN(n) || n <= 0) return
    onChange([...value, { id: Date.now().toString(), label: label.trim(), value: n }])
    setLabel('')
    setVal('')
  }

  const remove = (id) => onChange(value.filter(i => i.id !== id))

  const total = value.reduce((s, i) => s + (parseFloat(i.value) || 0), 0)
  const sorted = [...value].sort((a, b) => (parseFloat(b.value) || 0) - (parseFloat(a.value) || 0))

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input value={label} onChange={(e) => setLabel(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="Categoria perdita (es. Start-up, Cambio formato...)" className="flex-1 border rounded-lg px-3 py-2 text-sm" />
        <input type="number" value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="Valore" className="w-32 border rounded-lg px-3 py-2 text-sm" />
        <button onClick={add} className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-light">Aggiungi</button>
      </div>

      {value.length === 0 ? (
        <div className="bg-gray-50 rounded-lg p-8 text-center text-sm text-gray-400">Aggiungi le categorie di perdita per generare il Pareto</div>
      ) : (
        <>
          <ParetoChart
            losses={value}
            title="Pareto delle Perdite"
            subtitle="Loss Deployment - Standard Kaizen"
            targetPercent={80}
            unit=""
          />

          <div className="space-y-1">
            {sorted.map(item => (
              <div key={item.id} className="flex items-center justify-between text-sm bg-gray-50 rounded px-3 py-1.5">
                <span className="font-medium">{item.label}</span>
                <div className="flex items-center gap-3">
                  <span className="text-gray-500">{total > 0 ? ((parseFloat(item.value) / total) * 100).toFixed(1) : 0}%</span>
                  <span className="font-bold text-primary">{item.value}</span>
                  <button onClick={() => remove(item.id)} className="text-red-500 hover:bg-red-50 p-1 rounded"><X size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function GembaObiettiviTab({ kaizen, setKaizen, updateField }) {
  const gp = kaizen.gemba_plan || {}
  const perditeItems = kaizen.loss_pareto?.items || []

  const updateGemba = (field, value) => setKaizen(prev => ({ ...prev, gemba_plan: { ...prev.gemba_plan, [field]: value } }))

  const handlePerditaChange = (label) => {
    const found = perditeItems.find(i => i.label === label)
    setKaizen(prev => ({
      ...prev,
      obiettivi: {
        ...prev.obiettivi,
        perdita: label,
        start: found ? found.value : prev.obiettivi?.start,
      },
    }))
  }

  const start = parseFloat(kaizen.obiettivi?.start)
  const target = parseFloat(kaizen.obiettivi?.target)
  const miglioramentoPct = (!isNaN(start) && !isNaN(target) && start !== 0)
    ? Math.abs(((target - start) / start) * 100)
    : null

  const genSmart = () => {
    const o = kaizen.obiettivi || {}
    const perdita = o.perdita || 'la perdita'
    const scope = o.scope || kaizen.macchina || kaizen.linea || 'area target'
    const unit = o.unit ? ` ${o.unit}` : ''
    const scad = o.scadenza ? new Date(o.scadenza).toLocaleDateString('it-IT') : 'la scadenza'
    const frase = `Ridurre ${perdita} su ${scope} da ${o.start ?? '...'} a ${o.target ?? '...'}${unit} entro ${scad}`
    updateField('obiettivi', 'smart', frase)
  }

  const smartOk = kaizen.obiettivi?.kpi && kaizen.obiettivi?.start !== undefined && kaizen.obiettivi?.start !== '' && kaizen.obiettivi?.target !== undefined && kaizen.obiettivi?.target !== '' && kaizen.obiettivi?.scadenza

  const checklistItems = [
    { key: 'condizioni_base_rispettate', label: 'Le condizioni di base sono rispettate (5S, Pulizia e lubrificazione)?' },
    { key: 'conoscenza_macchina_processo', label: 'Le persone dimostrano conoscenza di macchina e processo?' },
    { key: 'standard_esistenti', label: 'Esistono standard legati al problema (OPL, SOP)?' },
    { key: 'standard_chiari', label: 'Gli standard sono chiari e comprensibili?' },
    { key: 'standard_applicati', label: 'Gli standard sono applicati correttamente?' },
    { key: 'persone_conoscono_standard', label: 'Le persone conoscono gli standard?' },
  ]

  return (
    <div className="space-y-6">

      <div className="bg-white rounded-xl shadow p-6">
        <h3 className="bg-primary text-white text-center py-2 rounded-lg font-bold mb-4">
  GEMBA WALK
</h3>

<div className="mb-4 border-l-4 border-blue-500 bg-blue-50 rounded-r-lg px-4 py-3">
  <h4 className="font-bold text-sm text-blue-900">
    1. Preparazione
  </h4>
  <p className="text-xs text-blue-700 mt-1">
    Definisci lo scopo, la data, il turno e i partecipanti al Gemba.
  </p>
</div>

        <div className="mb-4">
          <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Scopo del Gemba</label>
          <textarea value={gp.purpose || ''} onChange={(e) => updateGemba('purpose', e.target.value)} rows={2} placeholder="Cosa vado a osservare e perche (fenomeno, area, condizione)" className="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Data e turno</label>
            <div className="flex gap-2">
              <input type="date" value={gp.schedule_data || ''} onChange={(e) => updateGemba('schedule_data', e.target.value)} className="flex-1 border rounded-lg px-3 py-2 text-sm" />
              <input value={gp.schedule_turno || ''} onChange={(e) => updateGemba('schedule_turno', e.target.value)} placeholder="Turno" className="w-28 border rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Partecipanti</label>
            <UserPicker
              value={(gp.roles_ids || []).map((id, i) => ({ id, name: gp.roles_nomi?.[i] || '' }))}
              onChange={(sel) => setKaizen(prev => ({ ...prev, gemba_plan: { ...prev.gemba_plan, roles_ids: sel.map(s => s.id), roles_nomi: sel.map(s => s.name) } }))}
              mode="multi"
              placeholder="Chi partecipa al gemba..."
            />
          </div>
        </div>

        <div className="pt-5 border-t">
          <div className="mb-4 border-l-4 border-orange-500 bg-orange-50 rounded-r-lg px-4 py-3">
            <h4 className="font-bold text-sm text-orange-900">
              2. Esecuzione
            </h4>
            <p className="text-xs text-orange-700 mt-1">
              Verifica il processo sul campo e documenta le evidenze osservate.
            </p>
          </div>

          <label className="block text-xs font-bold text-gray-600 uppercase mb-3">
            Checklist Gemba - Verifica del processo
          </label>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-3">
            {checklistItems.map(item => (
              <div key={item.key} className="pb-3 border-b">
                <p className="text-sm font-medium mb-1">{item.label}</p>
                <div className="flex gap-2 mb-1">
                  {['Si', 'No', 'N/A'].map(v => (
                    <button key={v} onClick={() => updateField('verifica_processo', item.key, { ...kaizen.verifica_processo?.[item.key], valore: v })}
                      className={`px-3 py-1 rounded text-xs font-medium border ${
                        kaizen.verifica_processo?.[item.key]?.valore === v ? 'bg-primary text-white' : 'bg-white text-gray-600'
                      }`}>{v}</button>
                  ))}
                </div>
                <input placeholder="Osservazioni" value={kaizen.verifica_processo?.[item.key]?.osservazioni || ''}
                  onChange={(e) => updateField('verifica_processo', item.key, { ...kaizen.verifica_processo?.[item.key], osservazioni: e.target.value })}
                  className="w-full border rounded px-2 py-1 text-xs" />
              </div>
            ))}
          </div>
        </div>

        <div className="pt-5 border-t mt-5">
          <div className="mb-4 border-l-4 border-green-500 bg-green-50 rounded-r-lg px-4 py-3">
            <h4 className="font-bold text-sm text-green-900">
              3. Conclusioni
            </h4>
            <p className="text-xs text-green-700 mt-1">
              Riepiloga le osservazioni, le anomalie e le evidenze raccolte.
            </p>
          </div>

          <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
            Osservazioni e conclusioni del Gemba
          </label>

          <textarea
            value={kaizen.gemba?.osservazioni || ''}
            onChange={(e) => updateField('gemba', 'osservazioni', e.target.value)}
            rows={3}
            placeholder="Riepiloga ciò che è stato osservato, le anomalie rilevate e le conclusioni del team"
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
        </div>

        <div className="pt-4 border-t mt-4">
          <div className="mb-3">
            <div className="text-xs font-bold text-gray-600 uppercase">
              Evidenze dal campo
            </div>

            <div className="text-xs text-gray-500 mt-1">
              Scatta fotografie direttamente dal dispositivo oppure carica immagini già presenti.
            </div>
          </div>

          <ImageUpload
            images={kaizen.gemba?.immagini || []}
            onChange={(immagini) => {
              setKaizen(prev => ({
                ...prev,
                gemba: {
                  ...prev.gemba,
                  immagini,
                },
              }))
            }}
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-6">
        <h3 className="bg-primary text-white text-center py-2 rounded-lg font-bold mb-4">
  OBIETTIVI DEL PROGETTO
</h3>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Perdita da attaccare</label>
            <select value={kaizen.obiettivi?.perdita || ''} onChange={(e) => handlePerditaChange(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">{perditeItems.length === 0 ? 'Nessuna perdita nel Loss Deployment' : 'Seleziona dal Pareto'}</option>
              {perditeItems.map(i => (
                <option key={i.id} value={i.label}>{i.label} ({i.value})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Scope (macchina/linea)</label>
            <input value={kaizen.obiettivi?.scope || ''} onChange={(e) => updateField('obiettivi', 'scope', e.target.value)} placeholder="Es. Bindler 100" className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">KPI / OPI</label>
            <input value={kaizen.obiettivi?.kpi || ''} onChange={(e) => updateField('obiettivi', 'kpi', e.target.value)} placeholder="es. min, ppm, %" className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Start</label>
            <input type="number" value={kaizen.obiettivi?.start ?? ''} onChange={(e) => updateField('obiettivi', 'start', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Target</label>
            <input type="number" value={kaizen.obiettivi?.target ?? ''} onChange={(e) => updateField('obiettivi', 'target', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Unita</label>
            <input value={kaizen.obiettivi?.unit || ''} onChange={(e) => updateField('obiettivi', 'unit', e.target.value)} placeholder="min, %, kg" className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Scadenza</label>
            <input type="date" value={kaizen.obiettivi?.scadenza || ''} onChange={(e) => updateField('obiettivi', 'scadenza', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>

        {miglioramentoPct !== null && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800 mb-4">
            Miglioramento richiesto: <strong>{miglioramentoPct.toFixed(1)}%</strong> (da {kaizen.obiettivi.start} a {kaizen.obiettivi.target})
          </div>
        )}

        <div className="flex items-center justify-between mb-2">
          <label className="block text-xs font-bold text-gray-600 uppercase">Frase Obiettivo SMART</label>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${smartOk ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
              {smartOk ? 'SMART completo' : 'Campi mancanti'}
            </span>
            <button type="button" onClick={genSmart} className="bg-primary text-white px-3 py-1 rounded text-xs font-medium hover:bg-primary-light">Genera frase</button>
          </div>
        </div>
        <textarea value={kaizen.obiettivi?.smart || ''} onChange={(e) => updateField('obiettivi', 'smart', e.target.value)} rows={2} placeholder='Genera automaticamente o scrivi: "Ridurre setup Bindler 100 da 45 a 25 min entro 30/06"' className="w-full border rounded-lg px-3 py-2 text-sm" />
      </div>

    </div>
  )
}

const AUDIT_SECTIONS = [
  {
    key: "P", label: "Pianificazione", head: "bg-blue-100 text-blue-800", border: "border-blue-300", available: 15,
    items: [
      { id: "p1", cat: "Team", text: "I membri del team sono elencati? (se applicabile sulla lavagna)", score: 1 },
      { id: "p2", cat: "Team", text: "A tutti i membri sono stati assegnati ruoli chiari (Leader, Verbalizzante, Timekeeper, ecc.)?", score: 1 },
      { id: "p3", cat: "Collegamento al business", text: "E chiaro perche e stato scelto questo problema? C'e un chiaro collegamento a un KPI aziendale/di area? (Deployment dal Pillar)", score: 4 },
      { id: "p4", cat: "Indicatori di performance", text: "I dati storici (periodo/punto di partenza e valore attuale) sono chiaramente mostrati?", score: 2 },
      { id: "p5", cat: "Indicatori di performance", text: "Il target dell'indicatore (periodo e valore) e chiaramente mostrato?", score: 2 },
      { id: "p6", cat: "Route e Master Plan", text: "I documenti dello Standard Kaizen sono visibili e aggiornati?", score: 5 },
    ],
  },
  {
    key: "D", label: "Metodo", head: "bg-purple-100 text-purple-800", border: "border-purple-300", available: 36,
    items: [
      { id: "d1", cat: "Metodo", text: "Sono state usate analisi quantitative/root-cause per capire il problema? Sono ben documentate?", score: 5 },
      { id: "d2", cat: "Metodo", text: "Le cause sospette del problema sono state verificate e quantificate con dati?", score: 5 },
      { id: "d3", cat: "Metodo", text: "La raccolta dati e fatta in modo coerente da tutti i turni? Tutti i dettagli sono catturati?", score: 2 },
      { id: "d4", cat: "Metodo", text: "Il team ha usato i metodi/strumenti della route per attaccare i problemi?", score: 3 },
      { id: "d5", cat: "Metodo", text: "Il gruppo ha trovato contromisure logiche per le cause radice identificate con logica solida?", score: 4 },
      { id: "d6", cat: "Pianificazione ed esecuzione azioni", text: "Le azioni pianificate sono chiaramente visibili con date di completamento target?", score: 5 },
      { id: "d7", cat: "Pianificazione ed esecuzione azioni", text: "C'e un responsabile per ogni azione?", score: 2 },
      { id: "d8", cat: "Pianificazione ed esecuzione azioni", text: "Il piano d'azione e aggiornato?", score: 2 },
      { id: "d9", cat: "Pianificazione ed esecuzione azioni", text: "La maggior parte delle azioni e completata nei tempi?", score: 4 },
      { id: "d10", cat: "Pianificazione ed esecuzione azioni", text: "C'e evidenza delle azioni implementate (OPL, foto, standard, modifiche...)?", score: 4 },
    ],
  },
  {
    key: "C", label: "Risultati", head: "bg-green-100 text-green-800", border: "border-green-300", available: 18,
    items: [
      { id: "c1", cat: "Performance", text: "Il team ha raggiunto il suo obiettivo o fatto progressi sostanziali verso l'obiettivo?", score: 18 },
    ],
  },
  {
    key: "A", label: "Stabilizzazione", head: "bg-orange-100 text-orange-800", border: "border-orange-300", available: 19,
    items: [
      { id: "a1", cat: "Standard", text: "Ci sono procedure per mantenere i risultati ottenuti?", score: 5 },
      { id: "a2", cat: "Standard", text: "I sistemi di monitoraggio (checklist, moduli, audit...) per le azioni chiave sono in atto e visibili?", score: 4 },
      { id: "a3", cat: "Standard", text: "I dispositivi del sistema di monitoraggio sono usati e aggiornati?", score: 4 },
      { id: "a4", cat: "OPL", text: "Sono state create OPL/SOP per ogni miglioramento significativo?", score: 2 },
      { id: "a5", cat: "OPL", text: "C'e una training matrix per le OPL/SOP usate e un piano di formazione del personale coinvolto?", score: 2 },
      { id: "a6", cat: "OPL", text: "I miglioramenti nelle aree target della macchina sono evidenti?", score: 2 },
    ],
  },
  {
    key: "I", label: "Coinvolgimento", head: "bg-teal-100 text-teal-800", border: "border-teal-300", available: 12,
    items: [
      { id: "i1", cat: "Coinvolgimento", text: "La metodologia Kaizen da seguire e ben compresa da tutti i membri del team?", score: 5 },
      { id: "i2", cat: "Coinvolgimento", text: "Un membro del team scelto a caso sa spiegare le attivita (e la lavagna se applicabile)?", score: 3 },
      { id: "i3", cat: "Coinvolgimento", text: "I meeting sono organizzati e la partecipazione e ai livelli attesi?", score: 4 },
    ],
  },
]

function TeamAuditTab({ kaizen, setKaizen }) {
const scores = kaizen.team_audit?.scores || {}
const weekly = kaizen.team_audit?.weekly || []
const setScore = (id, raw, max) => {
let n = parseInt(raw)
if (isNaN(n)) n = 0
if (n < 0) n = 0
if (n > max) n = max
setKaizen(prev => ({
...prev,
team_audit: { ...prev.team_audit, scores: { ...(prev.team_audit?.scores || {}), [id]: n } },
}))
}
const valOf = (it) => Math.min(parseInt(scores[it.id]) || 0, it.score)
const allItems = AUDIT_SECTIONS.flatMap(s => s.items)
const totalAchieved = allItems.reduce((sum, it) => sum + valOf(it), 0)
const percent = totalAchieved
const sectionScore = (s) => s.items.reduce((sum, it) => sum + valOf(it), 0)
let status = { label: "Da valutare", color: "bg-gray-100 text-gray-700" }
if (percent >= 80) status = { label: "PASS", color: "bg-green-600 text-white" }
else if (percent >= 60) status = { label: "IN PROGRESS", color: "bg-yellow-500 text-white" }
else if (percent > 0) status = { label: "FAIL", color: "bg-red-600 text-white" }
const lightColor = (pct) => pct >= 80 ? "bg-green-500" : pct >= 60 ? "bg-yellow-500" : pct > 0 ? "bg-red-500" : "bg-gray-200"
const registraSettimana = (week) => {
const snap = { week, total: totalAchieved }
AUDIT_SECTIONS.forEach(s => { snap[s.key] = sectionScore(s) })
setKaizen(prev => {
const prevWeekly = prev.team_audit?.weekly || []
const filtered = prevWeekly.filter(w => w.week !== week)
return { ...prev, team_audit: { ...prev.team_audit, weekly: [...filtered, snap].sort((a, b) => a.week - b.week) } }
})
}
const rimuoviSettimana = (week) => {
setKaizen(prev => ({
...prev,
team_audit: { ...prev.team_audit, weekly: (prev.team_audit?.weekly || []).filter(w => w.week !== week) },
}))
}
const weekData = (w) => weekly.find(x => x.week === w)
return (
<div className="space-y-4">
<div className="bg-white rounded-xl shadow p-6">
<div className="flex items-start justify-between mb-4">
<div>
<h3 className="text-xl font-bold mb-1">Improvement Team Audit</h3>
<p className="text-sm text-gray-500">Valutazione PDCA del progetto Kaizen - Lindt LPW</p>
</div>
<div className={`px-3 py-1.5 rounded-lg font-bold text-sm ${status.color}`}>{status.label}</div>
</div>
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-4xl font-bold text-primary">{totalAchieved}</span>
            <span className="text-xl text-gray-400">/ 100</span>
            <span className="ml-auto text-lg font-semibold text-gray-600">{percent}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div className={`h-full transition-all duration-500 ${percent >= 80 ? "bg-green-500" : percent >= 60 ? "bg-yellow-500" : percent > 0 ? "bg-orange-500" : "bg-gray-300"}`} style={{ width: `${percent}%` }} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-4">
            {AUDIT_SECTIONS.map(s => (
              <div key={s.key} className="bg-white rounded-lg p-2 text-center border">
                <div className="text-xs text-gray-500 uppercase">{s.label}</div>
                <div className="text-sm font-bold text-primary">{sectionScore(s)} / {s.available}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-bold">Traffic Light settimanale</h3>
            <p className="text-xs text-gray-500">Registra il punteggio audit settimana per settimana (8 settimane)</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-xs uppercase text-gray-500">
                <th className="p-2 text-left">Settimana</th>
                {[1,2,3,4,5,6,7,8].map(w => <th key={w} className="p-2 text-center">{w}</th>)}
              </tr>
            </thead>
            <tbody>
              <tr className="border-t">
                <td className="p-2 font-medium text-gray-600">Semaforo</td>
                {[1,2,3,4,5,6,7,8].map(w => {
                  const d = weekData(w)
                  return (
                    <td key={w} className="p-2 text-center">
                      <div className={`w-6 h-6 rounded-full mx-auto ${lightColor(d ? d.total : -1)}`} title={d ? `${d.total}/100` : "Non registrata"} />
                    </td>
                  )
                })}
              </tr>
              <tr className="border-t">
                <td className="p-2 font-medium text-gray-600">Punteggio</td>
                {[1,2,3,4,5,6,7,8].map(w => {
                  const d = weekData(w)
                  return <td key={w} className="p-2 text-center font-bold text-primary">{d ? d.total : "-"}</td>
                })}
              </tr>
              <tr className="border-t">
                <td className="p-2 font-medium text-gray-600">Azione</td>
                {[1,2,3,4,5,6,7,8].map(w => {
                  const d = weekData(w)
                  return (
                    <td key={w} className="p-2 text-center">
                      {d ? (
                        <button onClick={() => rimuoviSettimana(w)} className="text-xs text-red-500 hover:underline">Rimuovi</button>
                      ) : (
                        <button onClick={() => registraSettimana(w)} className="text-xs text-primary hover:underline">Registra</button>
                      )}
                    </td>
                  )
                })}
              </tr>
            </tbody>
          </table>
        </div>
        <div className="text-xs text-gray-400 mt-2">Verde &ge; 80 - Giallo 60-79 - Rosso &lt; 60. "Registra" salva il punteggio attuale nella settimana scelta.</div>
      </div>

      {AUDIT_SECTIONS.map(s => (
        <div key={s.key} className={`rounded-xl border-2 ${s.border} overflow-hidden`}>
          <div className={`${s.head} px-4 py-2.5 font-bold text-sm flex items-center justify-between`}>
            <span>{s.key} - {s.label.toUpperCase()}</span>
            <span className="text-xs">{sectionScore(s)} / {s.available} punti</span>
          </div>
          <div className="bg-white">
            {s.items.map((it, idx) => {
              const v = valOf(it)
              const full = v >= it.score
              return (
                <div key={it.id} className={`p-3 flex items-start gap-3 ${idx < s.items.length - 1 ? "border-b" : ""}`}>
                  <div className="flex-1">
                    <div className="text-[10px] uppercase text-gray-400 font-semibold">{it.cat}</div>
                    <p className="text-sm">{it.text}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <input
                      type="number"
                      min="0"
                      max={it.score}
                      value={scores[it.id] ?? ""}
                      onChange={(e) => setScore(it.id, e.target.value, it.score)}
                      className={`w-16 border-2 rounded-lg px-2 py-1 text-sm text-center font-bold ${full ? "border-green-400 text-green-600" : v > 0 ? "border-yellow-400 text-yellow-700" : "border-gray-200 text-gray-400"}`}
                    />
                    <span className="text-xs text-gray-400 font-medium">/ {it.score}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      <div className="bg-blue-50 border-l-4 border-blue-400 rounded-r-lg p-4 text-xs text-blue-700">
        <div className="font-semibold mb-1">Come funziona</div>
        <div>Per ogni item scrivi il punteggio da 0 fino al massimo indicato a destra. Il totale su 100 e il semaforo si aggiornano da soli.</div>
        <div className="mt-2 pt-2 border-t border-blue-200"><strong>Soglie:</strong> PASS &ge; 80 - IN PROGRESS 60-79 - FAIL &lt; 60</div>
      </div>
    </div>
)
}
