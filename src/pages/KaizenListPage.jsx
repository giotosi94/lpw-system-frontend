import { useState, useEffect, useMemo } from 'react'
import { Plus, Search, Filter, ChevronDown, Archive, Trash2, RotateCcw } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import api from '../services/api'
import { useAllConfigurations } from '../hooks/useConfigurations'
import { usePillars } from '../hooks/usePillars'
import { useAuth } from '../context/AuthContext'
import UserPicker from '../components/UserPicker'

const TIPOLOGIE_KAIZEN = [
  { value: 'Quick', label: 'Quick Kaizen', desc: 'Risoluzione rapida (1-3 giorni)' },
  { value: 'Standard', label: 'Standard Kaizen', desc: 'Progetto strutturato (1-4 settimane)' },
  { value: 'Major', label: 'Major Kaizen', desc: 'Iniziativa Pillar (1-3 mesi)' },
]

const INITIAL_KAIZEN = {
  titolo: '',
  tipo: 'Quick',
  route_id: '',
  reparto: '',
  linea: '',
  macchina: '',
  tipo_perdita: '',
  pillar_id: '',
  dashboard_id: '',
  dashboard_nome: '',
  team_leader_id: null,
  team_leader_nome: '',
  team_members_ids: [],
  team_members_nomi: [],
  team_members_data: [],
}

const INITIAL_FILTERS = {
  search: '',
  tipo: [],
  stato: [],
  pillar_id: [],
  categoria_perdita: [],
  reparto: [],
  linea: [],
  macchina: [],
  dashboard_id: [],
  creatore_id: null,
  creatore_nome: '',
  team_leader_id: null,
  team_leader_nome: '',
  view: 'all',  // 'all' | 'mine' | 'old30'
}

function giorniDaApertura(dataApertura) {
  if (!dataApertura) return null
  const apertura = new Date(dataApertura)
  const oggi = new Date()
  return Math.floor((oggi - apertura) / (1000 * 60 * 60 * 24))
}

function GiorniBadge({ giorni, stato }) {
  if (giorni === null) return <span className="text-gray-400">—</span>
  if (stato === 'Chiuso') return <span className="text-xs text-gray-500">Chiuso</span>
  let colorClass = 'text-green-700 bg-green-50'
  if (giorni > 30) colorClass = 'text-red-700 bg-red-50'
  else if (giorni > 7) colorClass = 'text-yellow-700 bg-yellow-50'
  const label = giorni === 0 ? 'oggi' : `${giorni} giorni`
  return <span className={`text-xs px-2 py-0.5 rounded ${colorClass}`}>{label}</span>
}

function CreatorAvatar({ name }) {
  if (!name) return <span className="text-xs text-gray-400">—</span>
  const initials = name.split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase()
  const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-yellow-500', 'bg-orange-500']
  const color = colors[name.charCodeAt(0) % colors.length]
  return (
    <div className="flex items-center gap-2">
      <div
        className={`${color} text-white rounded-full flex items-center justify-center font-bold flex-shrink-0`}
        style={{ width: 28, height: 28, fontSize: 11 }}
        title={name}
      >
        {initials}
      </div>
      <span className="text-xs text-gray-700 truncate">{name}</span>
    </div>
  )
}

function FilterChip({ active, onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium border-2 transition-all ${
        active
          ? 'bg-primary text-white border-primary'
          : 'bg-white text-gray-700 border-gray-200 hover:border-primary'
      }`}
    >
      {label}
    </button>
  )
}

function toggleMultiValue(values, value) {
  return values.includes(value) ? values.filter(item => item !== value) : [...values, value]
}

function SearchableMultiSelect({ title, field, options, filters, setFilters, disabled = false, disabledText = '' }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const selected = filters[field] || []
  const filteredOptions = query.trim()
    ? options.filter(option => option.label.toLowerCase().includes(query.trim().toLowerCase()))
    : options
  const selectedLabels = options.filter(option => selected.includes(option.value)).map(option => option.label)

  function clearSelection(event) {
    event.stopPropagation()
    setFilters({ ...filters, [field]: [] })
  }

  return (
    <div className="relative">
      <div className="text-xs font-semibold text-gray-600 uppercase mb-1.5">{title}</div>
      <button type="button" disabled={disabled} onClick={() => setOpen(value => !value)} className="w-full min-h-10 px-3 py-2 border rounded-lg bg-white text-left text-sm flex items-center justify-between gap-2 disabled:bg-gray-100 disabled:text-gray-400">
        <span className="truncate">{disabled ? disabledText : selectedLabels.length === 0 ? `Tutti: ${title}` : selectedLabels.length <= 2 ? selectedLabels.join(', ') : `${selectedLabels.length} selezionati`}</span>
        <span className="flex items-center gap-1 flex-shrink-0">
          {selected.length > 0 && <span role="button" tabIndex={0} onClick={clearSelection} className="text-gray-400 hover:text-gray-700 px-1" title="Azzera selezione">×</span>}
          <ChevronDown size={15} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>
      {open && !disabled && (
        <div className="absolute z-40 mt-1 w-full min-w-64 bg-white border rounded-lg shadow-xl overflow-hidden">
          <div className="p-2 border-b relative"><Search size={14} className="absolute left-4 top-4 text-gray-400" /><input type="text" value={query} onChange={event => setQuery(event.target.value)} placeholder={`Cerca ${title.toLowerCase()}...`} className="w-full pl-8 pr-3 py-2 border rounded-md text-sm" autoFocus /></div>
          <div className="max-h-56 overflow-y-auto p-1">
            {filteredOptions.length === 0 ? <div className="px-3 py-3 text-sm text-gray-400">Nessun risultato</div> : filteredOptions.map(option => (
              <label key={option.value} className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-gray-50 cursor-pointer text-sm"><input type="checkbox" checked={selected.includes(option.value)} onChange={() => setFilters({ ...filters, [field]: toggleMultiValue(selected, option.value) })} className="rounded border-gray-300 text-primary focus:ring-primary" /><span className="truncate">{option.label}</span></label>
            ))}
          </div>
          {selected.length > 0 && <div className="border-t p-2 flex justify-between items-center text-xs"><span className="text-gray-500">{selected.length} selezionati</span><button type="button" onClick={clearSelection} className="text-primary hover:underline">Azzera</button></div>}
        </div>
      )}
    </div>
  )
}

export default function KaizenListPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [kaizens, setKaizens] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [newKaizen, setNewKaizen] = useState(INITIAL_KAIZEN)

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      const did = searchParams.get('dashboard_id') || ''
      const dnome = searchParams.get('dashboard_nome') || ''
      setNewKaizen({ ...INITIAL_KAIZEN, dashboard_id: did, dashboard_nome: dnome })
      setShowModal(true)
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams])
  const [filters, setFilters] = useState(INITIAL_FILTERS)
  const [showFilters, setShowFilters] = useState(false)
  const [dashboards, setDashboards] = useState([])
  const [routes, setRoutes] = useState([])
  const [routeError, setRouteError] = useState('')
  const [preparingRoute, setPreparingRoute] = useState(false)

  const { configs } = useAllConfigurations()
  const { pillars } = usePillars()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const [selected, setSelected] = useState(new Set())

  // Reparti per form e filtri
  const [reparti, setReparti] = useState([])
  useEffect(() => {
    api.get('/reparti/').then(res => setReparti(res.data || [])).catch(() => setReparti([]))
    api.get('/dashboards/').then(res => setDashboards(res.data || [])).catch(() => setDashboards([]))
    loadRoutes()
  }, [])

  const loadRoutes = async () => {
    try {
      const res = await api.get('/route-catalog/?stato=pubblicata')
      setRoutes(res.data || [])
      setRouteError('')
      return res.data || []
    } catch (error) {
      setRouteError('Impossibile caricare le Route. Riprova.')
      return null
    }
  }

  const prepareRoute = async () => {
    setPreparingRoute(true)
    try {
      const res = await api.post('/route-catalog/seed')
      const available = await loadRoutes()
      if (available?.some(route => route._id === res.data.route_id)) {
        setNewKaizen(current => ({ ...current, route_id: res.data.route_id }))
      } else {
        setRouteError('La Route esiste ma non risulta pubblicata. Verifica il catalogo nei Settings.')
      }
    } catch (error) {
      setRouteError('Preparazione Route non riuscita: ' + (error.response?.data?.detail || error.message))
    } finally {
      setPreparingRoute(false)
    }
  }

  // Linee/Macchine per FORM (in base al reparto del nuovo Kaizen)
  const lineeFormDisponibili = useMemo(() => {
    if (!newKaizen.reparto) return []
    const rep = reparti.find(r => r.nome === newKaizen.reparto)
    return rep?.linee?.filter(l => l.attivo !== false) || []
  }, [newKaizen.reparto, reparti])

  const macchineFormDisponibili = useMemo(() => {
    if (!newKaizen.linea) return []
    const linea = lineeFormDisponibili.find(l => l.nome === newKaizen.linea)
    return linea?.macchine?.filter(m => m.attivo !== false) || []
  }, [newKaizen.linea, lineeFormDisponibili])

  const repartiFilterDisponibili = useMemo(() => reparti.filter(r => r.attivo !== false), [reparti])
  const lineeFilterDisponibili = useMemo(() => {
    return repartiFilterDisponibili
      .filter(r => filters.reparto.length === 0 || filters.reparto.includes(r.nome))
      .flatMap(r => r.linee || [])
      .filter((linea, index, array) => linea.attivo !== false && array.findIndex(item => item.nome === linea.nome) === index)
  }, [filters.reparto, repartiFilterDisponibili])
  const macchineFilterDisponibili = useMemo(() => {
    return lineeFilterDisponibili
      .filter(l => filters.linea.length === 0 || filters.linea.includes(l.nome))
      .flatMap(l => l.macchine || [])
      .filter((macchina, index, array) => macchina.attivo !== false && array.findIndex(item => item.nome === macchina.nome) === index)
  }, [filters.linea, lineeFilterDisponibili])

  function handleRepartoChange(nuovoReparto) {
    setNewKaizen(k => ({ ...k, reparto: nuovoReparto, linea: '', macchina: '' }))
  }
  function handleLineaChange(nuovaLinea) {
    setNewKaizen(k => ({ ...k, linea: nuovaLinea, macchina: '' }))
  }

  useEffect(() => { loadKaizens() }, [])

const loadKaizens = async () => {
  const [kaizensResult, majorsResult] = await Promise.allSettled([
    api.get('/kaizens'),
    api.get('/major-kaizen/'),
  ])

  const kaizensClassici =
    kaizensResult.status === 'fulfilled'
      ? (kaizensResult.value.data || []).map(item => ({
          ...item,
          entity_type: 'kaizen',
        }))
      : []

const majorKaizens =
  majorsResult.status === 'fulfilled'
    ? (majorsResult.value.data || []).map(item => ({
        ...item,
        entity_type: 'major_kaizen',
        livello: 'Major',
        tipo: 'Major Kaizen',
        data_apertura: item.data_inizio || item.created_at,
        creatore_nome:
          item.creatore_nome ||
          item.ruoli_progetto?.project_leader?.nome ||
          item.ruoli_progetto?.sponsor?.nome ||
          '',
      }))
    : []

  if (kaizensResult.status === 'rejected') {
    console.error('Errore caricamento Quick e Standard:', kaizensResult.reason)
  }

  if (majorsResult.status === 'rejected') {
    console.error('Errore caricamento Major:', majorsResult.reason)
  }

  const tuttiKaizen = [...kaizensClassici, ...majorKaizens].sort((a, b) => {
    const dataA = new Date(a.created_at || a.data_apertura || 0).getTime()
    const dataB = new Date(b.created_at || b.data_apertura || 0).getTime()
    return dataB - dataA
  })

  setKaizens(tuttiKaizen)
}

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = (ids) => {
    setSelected(prev => {
      const allSelected = ids.length > 0 && ids.every(id => prev.has(id))
      return allSelected ? new Set() : new Set(ids)
    })
  }

  const archiviaSelezionati = async () => {
    if (selected.size === 0) return

    const contieneMajor = kaizens.some(
      item =>
        selected.has(item._id) &&
        item.entity_type === 'major_kaizen'
    )

    if (contieneMajor) {
      alert(
        'I Major Kaizen non possono ancora essere archiviati. Seleziona soltanto Quick e Standard oppure usa Elimina.'
      )
      return
    }

    if (!confirm(`Archiviare ${selected.size} kaizen?\n\nNon verranno eliminati: restano salvati e li ritrovi nella vista "Archiviati".`)) return
    try {
      await Promise.all([...selected].map(id => api.put(`/kaizens/${id}`, { archiviato: true })))
      setSelected(new Set())
      await loadKaizens()
    } catch (err) {
      alert('Errore archiviazione: ' + (err.response?.data?.detail || err.message))
    }
  }

  const ripristinaSelezionati = async () => {
    if (selected.size === 0) return
    try {
      await Promise.all([...selected].map(id => api.put(`/kaizens/${id}`, { archiviato: false })))
      setSelected(new Set())
      loadKaizens()
    } catch (err) {
      alert('Errore ripristino: ' + (err.response?.data?.detail || err.message))
    }
  }

  const eliminaSelezionati = async () => {
    if (selected.size === 0) return

    const elementiSelezionati = kaizens.filter(item =>
      selected.has(item._id)
    )

    const majorSelezionati = elementiSelezionati.filter(
      item => item.entity_type === 'major_kaizen'
    ).length

    const kaizenClassiciSelezionati =
      elementiSelezionati.length - majorSelezionati

    const dettaglio = [
      kaizenClassiciSelezionati > 0
        ? `${kaizenClassiciSelezionati} Quick/Standard`
        : null,
      majorSelezionati > 0
        ? `${majorSelezionati} Major`
        : null,
    ]
      .filter(Boolean)
      .join(' e ')

    if (
      !confirm(
        `ELIMINARE ${dettaglio}?\n\nQuesta azione non può essere annullata dalla Kaizen Sheet.`
      )
    ) {
      return
    }

    try {
      await Promise.all(
        elementiSelezionati.map(item => {
          if (item.entity_type === 'major_kaizen') {
            return api.delete(`/major-kaizen/${item._id}`)
          }

          return api.delete(`/kaizens/${item._id}`)
        })
      )

      setSelected(new Set())
      await loadKaizens()
    } catch (err) {
      console.error('Errore eliminazione Kaizen:', err)
      alert(
        'Errore eliminazione: ' +
          (err.response?.data?.detail || err.message)
      )
    }
  }

  const createKaizen = async () => {
    if (!newKaizen.titolo.trim()) return alert('Inserisci un titolo')
    if (!newKaizen.tipo) return alert('Seleziona una tipologia Kaizen')

    if (newKaizen.tipo === 'Major') {
  if (!newKaizen.route_id) return alert('Seleziona una tipologia di progetto (Route)')

  const selectedPillar = pillars.find(
    pillar => pillar._id === newKaizen.pillar_id
  )

  try {
    const payloadMajor = {
      titolo: newKaizen.titolo,
      route_id: newKaizen.route_id,
      creatore_id: user?.id || null,
      creatore_nome:
        user?.full_name ||
        user?.username ||
        'Default User',
      reparto: newKaizen.reparto || null,
      linea: newKaizen.linea || null,
      macchina: newKaizen.macchina || null,
      pillar_id: selectedPillar?._id || null,
      pillar_sigla: selectedPillar?.sigla || null,
      pillar_label:
        selectedPillar?.label ||
        selectedPillar?.nome ||
        selectedPillar?.titolo ||
        null,
      dashboard_id: newKaizen.dashboard_id || null,
      dashboard_nome: newKaizen.dashboard_nome || null,
      project_leader: newKaizen.team_leader_id ? { id: newKaizen.team_leader_id, nome: newKaizen.team_leader_nome } : null,
      team_members: (newKaizen.team_members_data || []).map(member => ({ id: member.id, nome: member.name })),
    }
        const resMajor = await api.post('/major-kaizen/', payloadMajor)
        setShowModal(false)
        setNewKaizen(INITIAL_KAIZEN)
        if (resMajor.data?._id) {
          navigate(`/major-kaizen/${resMajor.data._id}`)
        } else {
          loadKaizens()
        }
      } catch (err) {
        console.error(err)
        alert('Errore creazione Major: ' + (err.response?.data?.detail || err.message))
      }
      return
    }

    try {
      const { team_members_data, ...formClean } = newKaizen

      let team_leader_id = newKaizen.team_leader_id
      let team_leader_nome = newKaizen.team_leader_nome
      let team_members_ids = newKaizen.team_members_ids
      let team_members_nomi = newKaizen.team_members_nomi

      if (newKaizen.tipo === 'Quick') {
        if (!team_leader_id && user?.id) {
          team_leader_id = user.id
          team_leader_nome = user.full_name || user.username || ''
        }
        if ((!team_members_ids || team_members_ids.length === 0) && user?.id) {
          team_members_ids = [user.id]
          team_members_nomi = [user.full_name || user.username || '']
        }
      }

      const payload = {
        ...formClean,
        livello: newKaizen.tipo,
        tipo: `${newKaizen.tipo} Kaizen`,
        creatore_id: user?.id || null,
        creatore_nome: user?.full_name || user?.username || 'Default User',
        team_leader_id,
        team_leader_nome,
        team_members_ids,
        team_members_nomi,
      }

      const res = await api.post('/kaizens', payload)

      if (newKaizen.pillar_id && res.data?.id) {
        try {
          await api.post(`/pillars/${newKaizen.pillar_id}/link-kaizen`, {
            kaizen_id: res.data.id,
            kaizen_numero: res.data.numero,
            kaizen_titolo: newKaizen.titolo,
          })
        } catch (linkErr) {
          console.warn('Link pillar fallito (ma kaizen creato):', linkErr)
        }
      }

      const fromDashboard = newKaizen.dashboard_id
      setShowModal(false)
      setNewKaizen(INITIAL_KAIZEN)
      if (res.data?.id) {
        navigate(fromDashboard
          ? `/kaizen/${res.data.id}?from_dashboard=${fromDashboard}`
          : `/kaizen/${res.data.id}`)
      } else {
        loadKaizens()
      }
    } catch (err) {
      console.error(err)
      alert('Errore creazione: ' + (err.response?.data?.detail || err.message))
    }
  }

  // Conteggio filtri attivi (esclude search)
  const activeFiltersCount = useMemo(() => {
    return Object.entries(filters).filter(([k, v]) => {
      if (k === 'search') return false
      if (k === 'view') return v !== 'all'
      if (Array.isArray(v)) return v.length > 0
      if (typeof v === 'boolean') return v === true
      return v !== '' && v !== null && v !== undefined
    }).length
  }, [filters])

  function resetFilters() {
    setFilters({ ...INITIAL_FILTERS, search: filters.search })
  }

  // Filtraggio kaizen
  const filtered = useMemo(() => {
    return kaizens.filter(k => {
      // Search
      const matchSearch = !filters.search ||
        k.titolo?.toLowerCase().includes(filters.search.toLowerCase()) ||
        k.numero?.toLowerCase().includes(filters.search.toLowerCase())

      // Tipo
      const tipoNormalizzato =
  k.entity_type === 'major_kaizen'
    ? 'Major'
    : k.livello ||
      (k.tipo?.includes('Standard') ? 'Standard' : 'Quick')
      const matchTipo = filters.tipo.length === 0 || filters.tipo.includes(tipoNormalizzato)

      // Stato
      const matchStato = filters.stato.length === 0 || filters.stato.includes(k.stato)

      // Pillar
      const matchPillar = filters.pillar_id.length === 0 || filters.pillar_id.includes(k.pillar_id)

      // Categoria perdita
      const matchCategoria = filters.categoria_perdita.length === 0 ||
        filters.categoria_perdita.includes(k.tipo_perdita) ||
        filters.categoria_perdita.includes(k.categoria)

      // Reparto / Linea / Macchina
      const matchReparto = filters.reparto.length === 0 || filters.reparto.includes(k.reparto)
      const matchLinea = filters.linea.length === 0 || filters.linea.includes(k.linea)
      const matchMacchina = filters.macchina.length === 0 || filters.macchina.includes(k.macchina)

      // Dashboard (Meeting)
      const matchDashboard = filters.dashboard_id.length === 0 || filters.dashboard_id.includes(k.dashboard_id)

      // Creatore
      const matchCreatore = !filters.creatore_id || k.creatore_id === filters.creatore_id

      // Team Leader
      const matchLeader = !filters.team_leader_id || k.team_leader_id === filters.team_leader_id

      // View
      let matchView = true
      if (filters.view === 'mine') {
        matchView = k.creatore_id === user?.id ||
                    k.team_leader_id === user?.id ||
                    (k.team_members_ids || []).includes(user?.id)
      } else if (filters.view === 'old30') {
        const g = giorniDaApertura(k.data_apertura)
        matchView = g !== null && g > 30 && k.stato !== 'Chiuso'
      }

      const matchArchive = filters.view === 'archived' ? k.archiviato === true : k.archiviato !== true

      return matchSearch && matchTipo && matchStato && matchPillar && matchCategoria &&
             matchReparto && matchLinea && matchMacchina && matchDashboard &&
             matchCreatore && matchLeader && matchView && matchArchive
    })
  }, [kaizens, filters, user])

  const getTipoStyle = (tipo) => {
    const t = tipo || ''
    if (t.includes('Major')) return { bg: 'bg-purple-100', color: 'text-purple-700', label: 'Major' }
    if (t.includes('Standard')) return { bg: 'bg-blue-100', color: 'text-blue-700', label: 'Standard' }
    return { bg: 'bg-emerald-100', color: 'text-emerald-700', label: 'Quick' }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Kaizen Sheet</h1>
        <button
          onClick={() => setShowModal(true)}
          className="bg-primary text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-primary-light"
        >
          <Plus size={18} /> Nuovo Kaizen
        </button>
      </div>

      {/* SEARCH + FILTRI AVANZATI */}
      <div className="bg-white p-3 rounded-lg shadow-sm mb-4">
        <div className="flex gap-2 items-center">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
            <input
              type="text"
              placeholder="Cerca per titolo o numero..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-2 rounded-lg text-sm flex items-center gap-2 border-2 transition-all ${
              showFilters || activeFiltersCount > 0
                ? 'bg-primary text-white border-primary shadow-md'
                : 'bg-white border-gray-200 hover:border-primary text-gray-700'
            }`}
          >
            <Filter size={16} />
            Filtri avanzati
            {activeFiltersCount > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
                showFilters ? 'bg-white text-primary' : 'bg-primary text-white'
              }`}>
                {activeFiltersCount}
              </span>
            )}
            <ChevronDown size={14} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
          {activeFiltersCount > 0 && (
            <button
              onClick={resetFilters}
              className="px-3 py-2 rounded-lg text-sm border-2 border-gray-200 text-gray-600 hover:bg-gray-100"
              title="Reset filtri"
            >
              Reset
            </button>
          )}
          <span className="text-sm text-gray-500 ml-2">{filtered.length} kaizen</span>
        </div>

        {showFilters && (
          <div className="mt-3 pt-3 border-t space-y-3">
            {/* Vista rapida */}
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase mb-1 block">Vista rapida</label>
              <div className="flex flex-wrap gap-2">
                <FilterChip
                  active={filters.view === 'all'}
                  onClick={() => setFilters({ ...filters, view: 'all' })}
                  label="Tutti"
                />
                <FilterChip
                  active={filters.view === 'mine'}
                  onClick={() => setFilters({ ...filters, view: 'mine' })}
                  label="I miei Kaizen"
                />
                <FilterChip
                  active={filters.view === 'old30'}
                  onClick={() => setFilters({ ...filters, view: 'old30' })}
                  label="Vecchi 30+ giorni"
                />
                <FilterChip
                  active={filters.view === 'archived'}
                  onClick={() => { setFilters({ ...filters, view: 'archived' }); setSelected(new Set()) }}
                  label="Archiviati"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              <SearchableMultiSelect title="Tipologia" field="tipo" options={TIPOLOGIE_KAIZEN.map(item => ({ value: item.value, label: item.label }))} filters={filters} setFilters={setFilters} />
              <SearchableMultiSelect title="Stato" field="stato" options={[{ value: 'Aperto', label: 'Aperto' }, { value: 'In Corso', label: 'In Corso' }, { value: 'Chiuso', label: 'Chiuso' }]} filters={filters} setFilters={setFilters} />
              <SearchableMultiSelect title="Pillar" field="pillar_id" options={pillars.map(item => ({ value: item._id, label: `${item.sigla} - ${item.label}` }))} filters={filters} setFilters={setFilters} />
              <SearchableMultiSelect title="Categoria perdita" field="categoria_perdita" options={(configs.categorie_perdita || []).map(item => ({ value: item.label, label: item.label }))} filters={filters} setFilters={setFilters} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase mb-1 block">Struttura aziendale</label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <SearchableMultiSelect title="Reparto" field="reparto" options={repartiFilterDisponibili.map(item => ({ value: item.nome, label: item.nome }))} filters={filters} setFilters={setFilters} />
                <SearchableMultiSelect title="Linea" field="linea" options={lineeFilterDisponibili.map(item => ({ value: item.nome, label: item.nome }))} filters={filters} setFilters={setFilters} disabled={filters.reparto.length === 0} disabledText="Seleziona prima un reparto" />
                <SearchableMultiSelect title="Macchina" field="macchina" options={macchineFilterDisponibili.map(item => ({ value: item.nome, label: item.nome }))} filters={filters} setFilters={setFilters} disabled={filters.linea.length === 0} disabledText="Seleziona prima una linea" />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase mb-1 block">Contesto</label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <SearchableMultiSelect title="Meeting" field="dashboard_id" options={dashboards.map(item => ({ value: item._id, label: item.nome || item.label || item.titolo || 'Meeting' }))} filters={filters} setFilters={setFilters} />
                <div><div className="text-xs font-semibold text-gray-600 uppercase mb-1.5">Creatore</div><UserPicker value={filters.creatore_id ? { id: filters.creatore_id, name: filters.creatore_nome } : null} onChange={(selected) => selected ? setFilters({ ...filters, creatore_id: selected.id, creatore_nome: selected.name }) : setFilters({ ...filters, creatore_id: null, creatore_nome: '' })} mode="single" placeholder="Cerca creatore..." /></div>
                <div><div className="text-xs font-semibold text-gray-600 uppercase mb-1.5">Team leader</div><UserPicker value={filters.team_leader_id ? { id: filters.team_leader_id, name: filters.team_leader_nome } : null} onChange={(selected) => selected ? setFilters({ ...filters, team_leader_id: selected.id, team_leader_nome: selected.name }) : setFilters({ ...filters, team_leader_id: null, team_leader_nome: '' })} mode="single" placeholder="Cerca team leader..." /></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {selected.size > 0 && (
        <div className="bg-primary text-white rounded-lg px-4 py-2 mb-3 flex items-center gap-3">
          <span className="text-sm font-medium">{selected.size} selezionati</span>
          <div className="flex-1" />
          {filters.view === 'archived' ? (
            <button onClick={ripristinaSelezionati} className="flex items-center gap-1 bg-white text-primary px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-100">
              <RotateCcw size={16} /> Ripristina
            </button>
          ) : (
            <button onClick={archiviaSelezionati} className="flex items-center gap-1 bg-white text-primary px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-100">
              <Archive size={16} /> Archivia
            </button>
          )}
          {isAdmin && (
            <button onClick={eliminaSelezionati} className="flex items-center gap-1 bg-red-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-red-700">
              <Trash2 size={16} /> Elimina
            </button>
          )}
          <button onClick={() => setSelected(new Set())} className="text-white opacity-80 hover:opacity-100 text-sm">Annulla</button>
        </div>
      )}

      {/* TABELLA */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left text-gray-500">
              <th className="p-4 w-10">
                <input
                  type="checkbox"
                  checked={
                    filtered.length > 0 &&
                    filtered.every(k => selected.has(k._id))
                  }
                  onChange={() =>
                    toggleSelectAll(filtered.map(k => k._id))
                  }
                  className="w-4 h-4"
                />
              </th>
              <th className="p-4">Numero</th>
              <th className="p-4">Titolo</th>
              <th className="p-4">Tipo</th>
              <th className="p-4">Pillar</th>
              <th className="p-4">Stato</th>
              <th className="p-4">Reparto</th>
              <th className="p-4">Linea</th>
              <th className="p-4">Meeting</th>
              <th className="p-4">Aperto da</th>
              <th className="p-4">Creatore</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((k) => {
              const tipoStyle = getTipoStyle(k.livello || k.tipo)
              const giorni = giorniDaApertura(k.data_apertura)
              return (
                <tr key={k._id} className={`border-t hover:bg-gray-50 ${selected.has(k._id) ? 'bg-blue-50' : ''}`}>
                  <td className="p-4">
                    <input
                      type="checkbox"
                      checked={selected.has(k._id)}
                      onChange={() => toggleSelect(k._id)}
                      className="w-4 h-4"
                    />
                  </td>
                  <td className="p-4">
                    <Link
  to={
    k.entity_type === 'major_kaizen'
      ? `/major-kaizen/${k._id}`
      : `/kaizen/${k._id}`
  }
  className="text-primary font-mono hover:underline"
>
  {k.numero}
</Link>
                  </td>
                  <td className="p-4 font-medium">{k.titolo}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${tipoStyle.bg} ${tipoStyle.color}`}>
                      {tipoStyle.label}
                    </span>
                  </td>
                  <td className="p-4">
                    {k.pillar_sigla ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-mono font-bold bg-indigo-100 text-indigo-700">
                        {k.pillar_sigla}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      k.stato === 'Aperto' ? 'bg-blue-100 text-blue-700' :
                      k.stato === 'In Corso' ? 'bg-yellow-100 text-yellow-700' :
                      k.stato === 'Chiuso' ? 'bg-gray-200 text-gray-700' :
                      'bg-green-100 text-green-700'
                    }`}>{k.stato}</span>
                  </td>
                  <td className="p-4 text-xs">{k.reparto || '—'}</td>
                  <td className="p-4 text-xs">{k.linea || '—'}</td>
                  <td className="p-4 text-xs">
                    {k.dashboard_id && k.dashboard_nome ? (
                      <Link
                        to={`/dashboard/${k.dashboard_id}`}
                        className="px-2 py-0.5 rounded bg-purple-100 text-purple-700 hover:bg-purple-200 transition-colors"
                        title="Vai al meeting"
                      >
                        {k.dashboard_nome}
                      </Link>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="p-4">
                    <GiorniBadge giorni={giorni} stato={k.stato} />
                  </td>
                  <td className="p-4">
                    <CreatorAvatar name={k.creatore_nome} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center text-gray-400 py-12">
            <p>Nessun kaizen trovato</p>
            <button onClick={() => setShowModal(true)} className="text-primary hover:underline mt-2">
              Creane uno nuovo
            </button>
          </div>
        )}
      </div>

      {/* MODAL Nuovo Kaizen */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="bg-primary text-white px-5 py-3 rounded-t-xl flex justify-between items-center sticky top-0 z-10">
              <h2 className="text-lg font-bold">Nuovo Kaizen</h2>
              <button onClick={() => setShowModal(false)} className="hover:bg-primary-light p-1 rounded">✕</button>
            </div>

            <div className="p-5 space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Titolo <span className="text-red-500">*</span>
                </label>
                <input
                  value={newKaizen.titolo}
                  onChange={(e) => setNewKaizen({ ...newKaizen, titolo: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Tipologia Kaizen <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {TIPOLOGIE_KAIZEN.map(t => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setNewKaizen({ ...newKaizen, tipo: t.value })}
                      className={`border-2 rounded-lg p-3 text-center transition-all ${
                        newKaizen.tipo === t.value
                          ? 'border-primary bg-blue-50 shadow-sm'
                          : 'border-gray-200 hover:border-gray-400'
                      }`}
                    >
                      <div className={`font-bold text-sm ${
                        newKaizen.tipo === t.value ? 'text-primary' : 'text-gray-700'
                      }`}>
                        {t.value}
                      </div>
                      <div className="text-[10px] text-gray-500 mt-1">{t.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {newKaizen.tipo === 'Major' && (
              <div className="space-y-2">
                {routeError && <p className="text-sm text-red-700" role="alert">{routeError}</p>}
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={loadRoutes} className="text-sm underline">Aggiorna elenco</button>
                  {isAdmin && (
                    <button type="button" disabled={preparingRoute} onClick={prepareRoute} className="text-sm underline disabled:opacity-50">
                      {preparingRoute ? 'Preparazione...' : 'Prepara Route Riduzione Scarti v2.0'}
                    </button>
                  )}
                </div>
              </div>
            )}
            {newKaizen.tipo === 'Major' && (
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Tipologia di progetto (Route) <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={newKaizen.route_id}
                    onChange={(e) => setNewKaizen({ ...newKaizen, route_id: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    <option value="">Seleziona una Route</option>
                    {routes.map(r => (
                      <option key={r._id} value={r._id}>
                        {r.nome} (v{r.versione})
                      </option>
                    ))}
                  </select>
                  {routes.length === 0 && (
                    <div className="text-xs text-orange-600 mt-1">
  Nessuna Route pubblicata disponibile.
                    </div>
                  )}
                </div>
              )}

              {/* Reparto → Linea → Macchina */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-sm font-medium mb-1">Reparto</label>
                  <select
                    value={newKaizen.reparto}
                    onChange={(e) => handleRepartoChange(e.target.value)}
                    className="w-full border rounded-lg px-2 py-2 text-sm"
                  >
                    <option value="">Seleziona</option>
                    {reparti.filter(r => r.attivo !== false).map(r => (
                      <option key={r._id} value={r.nome}>
                        {r.nome}{r.codice ? ` [${r.codice}]` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Linea</label>
                  <select
                    value={newKaizen.linea}
                    onChange={(e) => handleLineaChange(e.target.value)}
                    disabled={!newKaizen.reparto}
                    className="w-full border rounded-lg px-2 py-2 text-sm disabled:bg-gray-100"
                  >
                    <option value="">{!newKaizen.reparto ? 'Prima il reparto' : 'Seleziona'}</option>
                    {lineeFormDisponibili.map(l => (
                      <option key={l.id} value={l.nome}>
                        {l.nome}{l.codice ? ` [${l.codice}]` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Macchina</label>
                  <select
                    value={newKaizen.macchina}
                    onChange={(e) => setNewKaizen({ ...newKaizen, macchina: e.target.value })}
                    disabled={!newKaizen.linea}
                    className="w-full border rounded-lg px-2 py-2 text-sm disabled:bg-gray-100"
                  >
                    <option value="">{!newKaizen.linea ? 'Prima la linea' : 'Seleziona'}</option>
                    {macchineFormDisponibili.map(m => (
                      <option key={m.id} value={m.nome}>
                        {m.nome}{m.codice ? ` [${m.codice}]` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Categoria Perdita (TPM)</label>
                <select
                  value={newKaizen.tipo_perdita}
                  onChange={(e) => setNewKaizen({ ...newKaizen, tipo_perdita: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="">Nessuna</option>
                  {(configs.categorie_perdita || []).map(p => (
                    <option key={p._id} value={p.label}>{p.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Pillar di appartenenza</label>
                <select
                  value={newKaizen.pillar_id}
                  onChange={(e) => setNewKaizen({ ...newKaizen, pillar_id: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="">Nessuno (kaizen autonomo)</option>
                  {pillars.map(p => (
                    <option key={p._id} value={p._id}>
                      {p.sigla} — {p.label}{p.leader ? ` (${p.leader})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* 🆕 Meeting di origine */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Meeting di origine
                  <span className="text-xs text-gray-500 font-normal ml-1">(opzionale — es. PCS Daily da cui nasce)</span>
                </label>
                <select
                  value={newKaizen.dashboard_id}
                  onChange={(e) => {
                    const selectedId = e.target.value
                    const selected = dashboards.find(d => d._id === selectedId)
                    setNewKaizen({
                      ...newKaizen,
                      dashboard_id: selectedId,
                      dashboard_nome: selected ? (selected.nome || selected.label || selected.titolo || 'Meeting') : '',
                    })
                  }}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="">Nessuno</option>
                  {dashboards.map(d => (
                    <option key={d._id} value={d._id}>
                      {d.nome || d.label || d.titolo || 'Meeting'}
                    </option>
                  ))}
                </select>
                {dashboards.length === 0 && (
                  <div className="text-xs text-orange-600 mt-1">
                    Nessun meeting configurato. Vai su <strong>Meetings</strong> per crearne uno.
                  </div>
                )}
              </div>

              {/* TEAM KAIZEN */}
              <div className="bg-blue-50 rounded-lg p-3 space-y-3 border border-blue-200">
                <div className="text-xs font-bold uppercase text-blue-800">Team Kaizen</div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Team Leader
                    {newKaizen.tipo === 'Quick' && (
                      <span className="text-xs text-gray-500 font-normal ml-1">
                        (di default: tu come creatore)
                      </span>
                    )}
                  </label>
                  <UserPicker
                    value={
                      newKaizen.team_leader_id
                        ? { id: newKaizen.team_leader_id, name: newKaizen.team_leader_nome }
                        : null
                    }
                    onChange={(selected) => {
                      if (selected) {
                        setNewKaizen({ ...newKaizen, team_leader_id: selected.id, team_leader_nome: selected.name })
                      } else {
                        setNewKaizen({ ...newKaizen, team_leader_id: null, team_leader_nome: '' })
                      }
                    }}
                    mode="single"
                    placeholder="Cerca team leader..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Team Members
                    <span className="text-xs text-gray-500 font-normal ml-1">
                      ({newKaizen.team_members_data?.length || 0})
                    </span>
                  </label>
                  <UserPicker
                    value={newKaizen.team_members_data || []}
                    onChange={(selected) => {
                      setNewKaizen({
                        ...newKaizen,
                        team_members_data: selected,
                        team_members_ids: selected.map(s => s.id),
                        team_members_nomi: selected.map(s => s.name),
                      })
                    }}
                    mode="multi"
                    placeholder="Aggiungi membri al team..."
                  />
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-3 border-t">
                <button onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-lg">
                  Annulla
                </button>
                <button onClick={createKaizen} className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-light">
                  Crea Kaizen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
