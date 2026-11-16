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
      { id: 'dati', label: 'Dati progetto' },
      { id: 'quickkaizen', label: 'Problem Solving' },
    ]

    if (isAdmin) {
      quickTabs.push({ id: 'valutazione', label: 'Valutazione' })
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
  const [activeTab, setActiveTab] = useState('dati')
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
      setActiveTab(tabs[0]?.id || 'dati')
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

  const saveProjectData = async (payload) => {
    if (!kaizen) return false
    const next = { ...kaizen, ...payload }
    try {
      await api.put(`/kaizens/${id}`, JSON.parse(JSON.stringify(next)))
      setKaizen(next)
      setSavedSnapshot(JSON.stringify(next))
      return true
    } catch (err) {
      console.error(err)
      alert('Errore durante il salvataggio: ' + (err.response?.data?.detail || err.message))
      return false
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
        <div className="flex flex-wrap justify-between items-start gap-3">
          <div className="min-w-0 flex items-baseline gap-3">
            <span className="font-mono text-sm opacity-80 flex-shrink-0">{kaizen.numero}</span>
            <h1 className="text-2xl font-bold break-words">{kaizen.titolo || 'Kaizen'}</h1>
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
                Categoria Perdita
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

      {activeTab === 'dati' && (
        <div className="bg-white rounded-xl shadow p-6">
          <KaizenProjectData
            kaizen={kaizen}
            reparti={reparti}
            pillars={pillars}
            categorie={configs.categorie_perdita || []}
            locked={isLocked}
            onSave={saveProjectData}
          />
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
              <div className="mt-4">
                <ImageUpload
                  images={kaizen.fase5_valutazione_efficacia?.immagini || []}
                  onChange={(immagini) => updateField('fase5_valutazione_efficacia', 'immagini', immagini)}
                  label="Immagini dei risultati"
                  maxImages={10}
                />
              </div>
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
              <ReplicaLines
                rows={kaizen.fase6_standardizzazione?.repliche || []}
                reparti={reparti}
                onChange={(repliche) => updateField('fase6_standardizzazione', 'repliche', repliche)}
              />
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

      {activeTab === 'valutazione' && isAdmin && (
        <div className="space-y-6">
          <StandardElementsTab kaizen={kaizen} />
          <CountermeasureLadderTab kaizen={kaizen} />
        </div>
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

function KaizenProjectData({ kaizen, reparti, pillars, categorie, locked, onSave }) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dashboards, setDashboards] = useState([])
  const build = () => ({
    titolo: kaizen.titolo || '',
    reparto: kaizen.reparto || '',
    linea: kaizen.linea || '',
    macchina: kaizen.macchina || '',
    pillar_id: kaizen.pillar_id || '',
    dashboard_id: kaizen.dashboard_id || '',
    tipo_perdita: kaizen.tipo_perdita || '',
    team_leader: kaizen.team_leader_id ? { id: kaizen.team_leader_id, name: kaizen.team_leader_nome || '' } : null,
    team_members: (kaizen.team_members_ids || []).map((memberId, index) => ({ id: memberId, name: kaizen.team_members_nomi?.[index] || '' })),
  })
  const [form, setForm] = useState(build)

  useEffect(() => { if (!editing) setForm(build()) }, [kaizen])
  useEffect(() => { if (locked) setEditing(false) }, [locked])
  useEffect(() => {
    api.get('/dashboards/').then(res => setDashboards(res.data || [])).catch(() => setDashboards([]))
  }, [])

  const linee = useMemo(() => {
    if (!form.reparto) return []
    return reparti.find(item => item.nome === form.reparto)?.linee?.filter(item => item.attivo !== false) || []
  }, [form.reparto, reparti])
  const macchine = useMemo(() => {
    if (!form.linea) return []
    return linee.find(item => item.nome === form.linea)?.macchine?.filter(item => item.attivo !== false) || []
  }, [form.linea, linee])

  const pillarLabel = pillar => pillar ? `${pillar.sigla || ''}${pillar.sigla ? ' · ' : ''}${pillar.label || pillar.nome || pillar.titolo || ''}` : ''
  const dashboardLabel = dashboard => dashboard?.nome || dashboard?.label || dashboard?.titolo || 'Meeting'
  const formatDate = value => {
    if (!value) return '—'
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('it-IT')
  }

  const save = async () => {
    if (!form.titolo.trim() || saving) return
    setSaving(true)
    const pillar = pillars.find(item => item._id === form.pillar_id)
    const dashboard = dashboards.find(item => item._id === form.dashboard_id)
    const ok = await onSave({
      titolo: form.titolo.trim(),
      reparto: form.reparto,
      linea: form.linea,
      macchina: form.macchina,
      pillar_id: pillar?._id || null,
      pillar_sigla: pillar?.sigla || '',
      pillar_label: pillar?.label || pillar?.nome || pillar?.titolo || '',
      dashboard_id: dashboard?._id || (form.dashboard_id ? kaizen.dashboard_id : null),
      dashboard_nome: dashboard ? dashboardLabel(dashboard) : (form.dashboard_id ? kaizen.dashboard_nome : ''),
      tipo_perdita: form.tipo_perdita,
      team_leader_id: form.team_leader?.id || null,
      team_leader_nome: form.team_leader?.name || '',
      team_members_ids: form.team_members.map(item => item.id),
      team_members_nomi: form.team_members.map(item => item.name),
    })
    setSaving(false)
    if (ok) setEditing(false)
  }

  const currentPillar = pillars.find(item => item._id === kaizen.pillar_id)
  const repartoOptions = reparti.filter(item => item.attivo !== false).map(item => ({ value: item.nome, label: item.nome }))
  if (form.reparto && !repartoOptions.some(item => item.value === form.reparto)) repartoOptions.unshift({ value: form.reparto, label: form.reparto })
  const withCurrent = (options, value) => value && !options.some(item => item.value === value) ? [{ value, label: value }, ...options] : options

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {editing ? (
          <div className="flex gap-2">
            <button type="button" onClick={() => { setForm(build()); setEditing(false) }} disabled={saving} className="px-4 py-2 border rounded-lg text-sm">
              Annulla
            </button>
            <button type="button" onClick={save} disabled={saving || !form.titolo.trim()} className="px-4 py-2 bg-primary text-white rounded-lg text-sm flex items-center gap-2 disabled:opacity-50">
              <Save size={16} /> {saving ? 'Salvataggio...' : 'Salva'}
            </button>
          </div>
        ) : !locked && (
          <button type="button" onClick={() => setEditing(true)} className="px-4 py-2 bg-primary text-white rounded-lg text-sm">
            Modifica dati
          </button>
        )}
      </div>

      <PDSection title="Informazioni generali">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <PDField label="Titolo" editing={editing} value={form.titolo} onChange={value => setForm({ ...form, titolo: value })} />
          <PDDisplay label="Numero" value={kaizen.numero} />
          <PDDisplay label="Stato" value={kaizen.stato} />
          <PDDisplay label="Creatore" value={kaizen.creatore_nome} />
          <PDDisplay label="Data apertura" value={formatDate(kaizen.data_apertura || kaizen.created_at)} />
          <PDSelect label="Categoria perdita" editing={editing} value={form.tipo_perdita} options={withCurrent(categorie.map(item => ({ value: item.label, label: item.label })), form.tipo_perdita)} onChange={value => setForm({ ...form, tipo_perdita: value })} />
        </div>
      </PDSection>

      <PDSection title="Struttura">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <PDSelect label="Reparto" editing={editing} value={form.reparto} options={repartoOptions} onChange={value => setForm({ ...form, reparto: value, linea: '', macchina: '' })} />
          <PDSelect label="Linea" editing={editing} value={form.linea} disabled={!form.reparto} options={withCurrent(linee.map(item => ({ value: item.nome, label: item.nome })), form.linea)} onChange={value => setForm({ ...form, linea: value, macchina: '' })} />
          <PDSelect label="Macchina" editing={editing} value={form.macchina} disabled={!form.linea} options={withCurrent(macchine.map(item => ({ value: item.nome, label: item.nome })), form.macchina)} onChange={value => setForm({ ...form, macchina: value })} />
          <PDSelect label="Pillar" editing={editing} value={form.pillar_id} display={currentPillar ? pillarLabel(currentPillar) : kaizen.pillar_sigla} options={pillars.map(item => ({ value: item._id, label: pillarLabel(item) }))} onChange={value => setForm({ ...form, pillar_id: value })} />
          <PDSelect label="Meeting di origine" editing={editing} value={form.dashboard_id} display={kaizen.dashboard_nome} options={withCurrent(dashboards.map(item => ({ value: item._id, label: dashboardLabel(item) })), form.dashboard_id).map(item => item.value === kaizen.dashboard_id && item.label === kaizen.dashboard_id ? { ...item, label: kaizen.dashboard_nome || item.label } : item)} onChange={value => setForm({ ...form, dashboard_id: value })} />
        </div>
      </PDSection>

      <PDSection title="Team">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <PDLabel>Team Leader</PDLabel>
            {editing ? (
              <UserPicker value={form.team_leader} onChange={selected => setForm({ ...form, team_leader: selected ? { id: selected.id, name: selected.name } : null })} mode="single" placeholder="Seleziona team leader..." />
            ) : (
              <PDValue>{kaizen.team_leader_nome || '—'}</PDValue>
            )}
          </div>
          <div>
            <PDLabel>Team Members</PDLabel>
            {editing ? (
              <UserPicker value={form.team_members} onChange={selected => setForm({ ...form, team_members: selected.map(item => ({ id: item.id, name: item.name })) })} mode="multi" placeholder="Aggiungi membri al team..." />
            ) : (
              <PDValue>{(kaizen.team_members_nomi || []).filter(Boolean).join(', ') || '—'}</PDValue>
            )}
          </div>
        </div>
      </PDSection>
    </div>
  )
}

function PDSection({ title, children }) {
  return <div className="border-b border-gray-200 pb-4 last:border-0"><h3 className="font-bold text-gray-800 mb-3">{title}</h3>{children}</div>
}
function PDLabel({ children }) {
  return <div className="text-xs font-semibold text-gray-500 uppercase mb-1">{children}</div>
}
function PDValue({ children }) {
  return <div className="text-sm font-medium text-gray-800 min-h-10 flex items-center">{children}</div>
}
function PDDisplay({ label, value }) {
  return <div><PDLabel>{label}</PDLabel><PDValue>{value || '—'}</PDValue></div>
}
function PDField({ label, editing, value, onChange }) {
  return <div><PDLabel>{label}</PDLabel>{editing ? <input value={value} onChange={event => onChange(event.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" /> : <PDValue>{value || '—'}</PDValue>}</div>
}
function PDSelect({ label, editing, value, options, onChange, disabled = false, display }) {
  const selectedLabel = display || options.find(option => option.value === value)?.label || value || '—'
  return <div><PDLabel>{label}</PDLabel>{editing ? <select value={value} onChange={event => onChange(event.target.value)} disabled={disabled} className="w-full border rounded-lg px-3 py-2 text-sm disabled:bg-gray-100"><option value="">Seleziona</option>{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : <PDValue>{selectedLabel}</PDValue>}</div>
}

function ReplicaLines({ rows, reparti, onChange }) {
  const lineOptions = reparti
    .filter(reparto => reparto.attivo !== false)
    .map(reparto => ({
      reparto: reparto.nome,
      linee: (reparto.linee || []).filter(linea => linea.attivo !== false),
    }))
    .filter(group => group.linee.length > 0)
  const known = new Set(lineOptions.flatMap(group => group.linee.map(linea => `${group.reparto}||${linea.nome}`)))
  const update = (id, patch) => onChange(rows.map(row => row.id === id ? { ...row, ...patch } : row))
  const add = () => onChange([...rows, { id: `${Date.now()}_${Math.random().toString(16).slice(2)}`, reparto: '', linea: '', scadenza: '' }])
  const remove = id => onChange(rows.filter(row => row.id !== id))
  return (
    <div className="mt-4">
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="block text-xs font-bold text-gray-600 uppercase">Linee di replica</span>
        <button type="button" onClick={add} className="px-2.5 py-1 text-xs border border-gray-300 rounded-md text-gray-600 bg-white hover:border-primary hover:text-primary">+ Aggiungi linea</button>
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-gray-400">Nessuna linea di replica.</p>
      ) : (
        <div className="space-y-2">
          {rows.map(row => {
            const value = row.linea ? `${row.reparto || ''}||${row.linea}` : ''
            return (
              <div key={row.id} className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-2 items-center">
                <select
                  value={value}
                  aria-label="Linea di replica"
                  onChange={(e) => {
                    const [reparto, linea] = e.target.value.split('||')
                    update(row.id, { reparto: reparto || '', linea: linea || '' })
                  }}
                  className="w-full min-w-0 border rounded-lg px-2 py-2 text-sm"
                >
                  <option value="">Seleziona linea</option>
                  {value && !known.has(value) && <option value={value}>{row.linea}</option>}
                  {lineOptions.map(group => (
                    <optgroup key={group.reparto} label={group.reparto}>
                      {group.linee.map(linea => (
                        <option key={`${group.reparto}-${linea.id || linea.nome}`} value={`${group.reparto}||${linea.nome}`}>{linea.nome}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <input
                  type="date"
                  value={row.scadenza || ''}
                  aria-label="Scadenza replica"
                  onChange={(e) => update(row.id, { scadenza: e.target.value })}
                  className="border rounded-lg px-2 py-2 text-sm"
                />
                <button type="button" onClick={() => remove(row.id)} aria-label="Rimuovi linea" title="Rimuovi" className="p-2 text-red-500 hover:bg-red-50 rounded">
                  <X size={16} />
                </button>
              </div>
            )
          })}
        </div>
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
    areaColor: 'border-gray-200',
    areaHeaderColor: 'bg-gray-50 text-gray-800 border-b border-gray-200',
    items: [
      { id: '1.1', label: 'Clear description of phenomenon' },
      { id: '1.2', label: 'Impact quantified with KPI' },
    ],
  },
  {
    area: 2,
    areaLabel: 'Root Cause Analysis',
    areaColor: 'border-gray-200',
    areaHeaderColor: 'bg-gray-50 text-gray-800 border-b border-gray-200',
    items: [
      { id: '2.1', label: 'Stratification: clear & understanding' },
      { id: '2.2', label: 'Usage of 5 Whys method' },
      { id: '2.3', label: 'Only relevant causes verified' },
    ],
  },
  {
    area: 3,
    areaLabel: 'Implementation',
    areaColor: 'border-gray-200',
    areaHeaderColor: 'bg-gray-50 text-gray-800 border-b border-gray-200',
    items: [
      { id: '3.1', label: 'Action log filled properly' },
      { id: '3.2', label: 'Horizontal/vertical expansion' },
    ],
  },
  {
    area: 4,
    areaLabel: 'Standardization',
    areaColor: 'border-gray-200',
    areaHeaderColor: 'bg-gray-50 text-gray-800 border-b border-gray-200',
    items: [
      { id: '4.1', label: 'Loss eradication' },
    ],
  },
]

const SCORE_OPTIONS = [
  { value: 0, label: 'Not OK', color: 'bg-primary text-white border-primary' },
  { value: 0.5, label: 'Partial', color: 'bg-primary text-white border-primary' },
  { value: 1, label: 'OK', color: 'bg-primary text-white border-primary' },
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

  let passStatus = { label: 'To complete', color: 'bg-gray-100 text-gray-700' }
  if (completedCount === totalElements) {
    if (totalScore >= 8) passStatus = { label: 'PASS', color: 'bg-gray-100 text-gray-900' }
    else if (totalScore >= 5) passStatus = { label: 'PARTIAL PASS', color: 'bg-gray-100 text-gray-900' }
    else passStatus = { label: 'FAIL', color: 'bg-gray-100 text-gray-900' }
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
    <div className="bg-white rounded-xl shadow overflow-hidden">
      <div className="p-4 border-b space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-bold">8 Standard Elements</h3>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span role="status" aria-live="polite">
              {saving ? <span className="text-gray-500">Saving...</span> :
               hasUnsavedChanges ? <span className="text-orange-600 font-medium">Unsaved changes</span> :
               lastSaved ? <span className="text-gray-500">Saved at {lastSaved.toLocaleTimeString('en-GB')}</span> : null}
            </span>
            <span className={`px-2.5 py-1 rounded-md font-bold ${passStatus.color}`}>{passStatus.label}</span>
            <button type="button" onClick={manualSave} disabled={saving} className="bg-primary text-white px-3 py-1 rounded hover:bg-primary-light disabled:opacity-50">
              Save
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span><span className="text-2xl font-bold text-primary">{totalScore.toFixed(1)}</span><span className="text-gray-400"> / {MAX_SCORE}</span></span>
          <span className="font-semibold text-gray-600">{percent.toFixed(0)}%</span>
          <span className="text-xs text-gray-500">{completedCount}/{totalElements} evaluated · Target 8/8</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
          <div className="h-full bg-primary transition-all duration-500" style={{ width: `${percent}%` }} />
        </div>
      </div>

      {STD_ELEMENTS.map(area => (
        <section key={area.area} aria-labelledby={`se-area-${area.area}`}>
          <h4 id={`se-area-${area.area}`} className="bg-gray-50 border-b px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-gray-700">
            Area {area.area} — {area.areaLabel}
          </h4>
          {area.items.map(item => {
            const currentScore = scores[item.id]
            return (
              <div key={item.id} className="se-row grid gap-2 items-center px-4 py-2 border-b">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-xs font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded flex-shrink-0">{item.id}</span>
                  <span className="text-sm font-medium">{item.label}</span>
                </div>
                <input
                  type="text"
                  value={notes[item.id] || ''}
                  onChange={(e) => setNote(item.id, e.target.value)}
                  placeholder="Notes (optional)"
                  aria-label={`Notes ${item.id}`}
                  className="w-full min-w-0 text-xs border rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <div className="flex gap-1 flex-shrink-0" role="group" aria-label={`Score ${item.id}`}>
                  {SCORE_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      aria-pressed={currentScore === opt.value}
                      onClick={() => setScore(item.id, opt.value)}
                      className={`px-2.5 py-1.5 rounded-md text-xs font-bold border whitespace-nowrap transition-colors ${
                        currentScore === opt.value
                          ? opt.color
                          : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                      }`}
                    >
                      {opt.label} ({opt.value})
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </section>
      ))}

      <p className="px-4 py-2 text-xs text-gray-500">
        <strong>OK (1)</strong> fully met · <strong>Partial (0.5)</strong> met, can improve · <strong>Not OK (0)</strong> missing · Thresholds: PASS = 8 · PARTIAL = 5–7 · FAIL &lt; 5
      </p>
      <style>{`.se-row{grid-template-columns:minmax(0,1fr)}@media(min-width:900px){.se-row{grid-template-columns:minmax(220px,1fr) minmax(0,1.4fr) auto}}`}</style>
    </div>
  )
}

// ──────────────────────────────────────────────────────────
// SCALA DELLE CONTROMISURE — piramide (come Fase 6 Major)
// ──────────────────────────────────────────────────────────
const CM_LEVELS = [
  '1 - Ripristino delle condizioni di base',
  '2 - Ripristino degli standard di processo',
  '3 - Controllo e gestione visiva',
  '4 - Eliminazione della causa radice',
  '5 - Miglioramento tecnologico / di processo',
  '6 - Innovazione / riprogettazione',
]
const CM_EXAMPLES = [
  'Pulizia, ordine 5S, richiamo al controllo corretto.',
  'Ripristino delle procedure, cicli di pulizia e responsabilità.',
  'Controlli e gestione visiva.',
  'Poka yoke e interventi sulla causa radice.',
  'Meccanizzazione o automazione dell’operazione.',
  'Nuove tecnologie o riprogettazione del processo.',
]
const CM_COLORS = ['#ff6b6b', '#ffd0a0', '#fff59d', '#c8f7c5', '#9bd34d', '#79963d']

function cmRobustness(level) {
  if (level >= 4) return 'OTTIMO'
  if (level >= 3) return 'BUONO'
  if (level >= 1) return 'DEBOLE'
  return 'Da Compilare'
}

function CountermeasureLadderTab({ kaizen }) {
  const saved = kaizen.countermeasure_ladder || {}
  const [level, setLevel] = useState(() => {
    const value = parseInt(saved.level ?? saved.max_level, 10)
    return value >= 1 && value <= 6 ? value : 0
  })
  const [status, setStatus] = useState('')
  const requestRef = useRef(0)
  const baseRef = useRef(saved)

  const choose = async next => {
    const value = next === level ? 0 : next
    setLevel(value)
    const request = ++requestRef.current
    setStatus('Salvataggio...')
    try {
      await api.put(`/kaizens/${kaizen._id}`, {
        countermeasure_ladder: {
          ...baseRef.current,
          level: value,
          max_level: value,
          robustness: cmRobustness(value),
          last_evaluated_at: new Date().toISOString(),
        },
      })
      if (request === requestRef.current) setStatus('Salvato')
    } catch (err) {
      if (request === requestRef.current) setStatus('Errore di salvataggio: riprova')
    }
  }

  return (
    <div className="bg-white rounded-xl shadow p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-xl font-bold mb-1">Scala delle contromisure</h3>
          <p className="text-sm text-gray-500">Clicca il livello raggiunto: la X indica quello raggiunto.</p>
        </div>
        <span role="status" aria-live="polite" className={`text-xs ${status.startsWith('Errore') ? 'text-red-700' : 'text-gray-500'}`}>{status}</span>
      </div>
      <div className="space-y-1 max-w-3xl mx-auto" role="group" aria-label="Livello della contromisura">
        {[...CM_LEVELS].reverse().map(label => {
          const index = CM_LEVELS.indexOf(label)
          const selected = level === index + 1
          return (
            <button
              key={label}
              type="button"
              aria-pressed={selected}
              onClick={() => choose(index + 1)}
              title={CM_EXAMPLES[index]}
              className="block mx-auto border border-gray-700 rounded px-2 py-3 text-center text-xs md:text-sm text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ width: `${100 - index * 8}%`, backgroundColor: CM_COLORS[index], fontWeight: selected ? 700 : 500 }}
            >
              <span className="inline-block w-6 font-bold" aria-hidden="true">{selected ? 'X' : ''}</span>{label}
            </button>
          )
        })}
      </div>
      {level > 0 && <p className="text-xs text-gray-600 text-center">{CM_EXAMPLES[level - 1]}</p>}
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
