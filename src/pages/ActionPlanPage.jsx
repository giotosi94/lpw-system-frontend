import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, Filter, X, ChevronDown } from 'lucide-react'
import api from '../services/api'
import { useAllConfigurations } from '../hooks/useConfigurations'
import ActionPlanFormShared from '../components/ActionPlanFormShared'
import ActionPlanDetailPanel from '../components/ActionPlanDetailPanel'
import ActionPlanViews from '../components/ActionPlanViews'

export default function ActionPlanPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingPlan, setEditingPlan] = useState(null)
  const [selectedPlan, setSelectedPlan] = useState(null)
  const [viewMode] = useState('list')
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState({
    search: '', stato: [], tipo: [], priorita: [], parent_type: [],
    categoria_perdita: [], quinta_m: [],
    responsabile: [], reparto: [], linea: [], macchina: [],
    pillar_id: [], dashboard_id: [],
    tag: '', overdue: false,
    include_cancelled: false,
    only_cancelled: false,
  })
  const [reparti, setReparti] = useState([])
  const [pillars, setPillars] = useState([])
  const [dashboards, setDashboards] = useState([])

  const { configs } = useAllConfigurations()
  const statiConfig = configs.stato_ap || []
  const prioritaConfig = configs.priorita_ap || []
  const tipiConfig = configs.tipi_action_plan || []

  useEffect(() => {
    loadData()
  }, [filters])

  useEffect(() => {
    const actionPlanId = searchParams.get('open')

    if (!actionPlanId) return

    const loadSelectedActionPlan = async () => {
      try {
        const response = await api.get(`/action-plans/${actionPlanId}`)
        setSelectedPlan(response.data)
      } catch (error) {
        console.error('Errore apertura Action Plan da notifica:', error)

        alert(
          'Impossibile aprire l’Action Plan: ' +
          (error.response?.data?.detail || error.message)
        )

        setSearchParams({}, { replace: true })
      }
    }

    loadSelectedActionPlan()
  }, [searchParams, setSearchParams])

  useEffect(() => {
    Promise.all([
      api.get('/reparti/').then(r => r.data).catch(() => []),
      api.get('/pillars/').then(r => r.data).catch(() => []),
      api.get('/dashboards/').then(r => r.data).catch(() => []),
    ]).then(([rep, pil, dsh]) => {
      setReparti(rep || [])
      setPillars(pil || [])
      setDashboards(dsh || [])
    })
  }, [])

  const activeFiltersCount = Object.entries(filters).reduce((count, [key, value]) => {
    if (key === 'search') return count
    if (Array.isArray(value)) return count + value.length
    if (typeof value === 'boolean') return count + (value ? 1 : 0)
    return count + (value !== '' && value !== null && value !== undefined ? 1 : 0)
  }, 0)

  const repartiAttivi = reparti.filter(item => item.attivo !== false)
  const lineeDisponibili = repartiAttivi
    .filter(item => filters.reparto.length === 0 || filters.reparto.includes(item.nome))
    .flatMap(item => item.linee || [])
    .filter((item, index, array) => item.attivo !== false && array.findIndex(other => other.nome === item.nome) === index)
  const macchineDisponibili = lineeDisponibili
    .filter(item => filters.linea.length === 0 || filters.linea.includes(item.nome))
    .flatMap(item => item.macchine || [])
    .filter((item, index, array) => item.attivo !== false && array.findIndex(other => other.nome === item.nome) === index)
  const responsabiliUnici = [...new Set(plans.map(item => item.responsabile).filter(Boolean))].sort()

  function resetFilters() {
    setFilters({
      search: filters.search,
      stato: [], tipo: [], priorita: [], parent_type: [],
      categoria_perdita: [], quinta_m: [],
      responsabile: [], reparto: [], linea: [], macchina: [],
      pillar_id: [], dashboard_id: [],
      tag: '', overdue: false,
      include_cancelled: false,
      only_cancelled: false,
    })
  }

  async function loadData() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      Object.entries(filters).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          value.forEach(item => params.append(key, item))
        } else if (value === true) {
          params.append(key, 'true')
        } else if (value) {
          params.append(key, value)
        }
      })
      const plansRes = await api.get(`/action-plans/?${params.toString()}`)
      setPlans(Array.isArray(plansRes.data) ? plansRes.data : [])
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  async function handleDelete(id) {
    if (!confirm('Eliminare definitivamente questo Action Plan?\n\n(Sparisce dalla UI ma resta in DB per audit)')) return
    await api.delete(`/action-plans/${id}`)
    loadData()
  }

  async function handleCancel(plan) {
    const reason = prompt(
      `Annullare l'Action Plan "${plan.numero} - ${plan.titolo}"?\n\n` +
      `Inserisci il motivo (obbligatorio):`
    )
    if (!reason || !reason.trim()) return
    try {
      await api.post(`/action-plans/${plan._id}/cancel`, {
        reason: reason.trim(),
        user: 'Default User',
      })
      loadData()
    } catch (err) {
      alert('Errore annullamento: ' + (err.response?.data?.detail || err.message))
    }
  }

  async function handleRestore(plan) {
    if (!confirm(`Ripristinare l'Action Plan "${plan.numero}"?\n\nTornerà tra gli attivi.`)) return
    try {
      await api.post(`/action-plans/${plan._id}/restore`)
      loadData()
    } catch (err) {
      alert('Errore ripristino: ' + (err.response?.data?.detail || err.message))
    }
  }

  async function quickStateChange(planId, newStato) {
    await api.patch(`/action-plans/${planId}/stato`, { stato: newStato })
    loadData()
  }

  return (
    <div className="space-y-4">
      
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">Action Plan Management</h1>
          <p className="text-gray-500 text-sm">Gestione piani d'azione trasversali</p>
        </div>

      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm space-y-4">
        <div className="flex gap-3 items-center">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
            <input
              type="text"
              placeholder="Cerca titolo, numero, tag, descrizione..."
              value={filters.search}
              onChange={event => setFilters({ ...filters, search: event.target.value })}
              className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowFilters(value => !value)}
            className={`px-3 py-2 rounded-lg text-sm border flex items-center gap-2 ${showFilters || activeFiltersCount > 0 ? 'border-primary text-primary bg-primary/5' : 'border-gray-300 text-gray-600 hover:bg-gray-100'}`}
          >
            <Filter size={16} />
            Filtri
            {activeFiltersCount > 0 && (
              <span className="bg-primary text-white rounded-full px-2 py-0.5 text-xs">{activeFiltersCount}</span>
            )}
            <ChevronDown size={15} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
          {activeFiltersCount > 0 && (
            <button
              type="button"
              onClick={resetFilters}
              className="px-3 py-2 rounded-lg text-sm border border-gray-300 text-gray-600 hover:bg-gray-100 flex items-center gap-1"
            >
              <X size={15} /> Azzera filtri
            </button>
          )}
        </div>

        {showFilters && (
          <div className="space-y-4 border-t pt-1">
        <FilterSection title="Vista">
          <FilterChip
            active={!filters.only_cancelled && !filters.include_cancelled && !filters.overdue}
            onClick={() => setFilters({ ...filters, only_cancelled: false, include_cancelled: false, overdue: false })}
            label="Attivi"
          />
          <FilterChip
            active={filters.overdue}
            onClick={() => setFilters({ ...filters, overdue: !filters.overdue, only_cancelled: false })}
            label="Scaduti"
          />
          <FilterChip
            active={filters.include_cancelled && !filters.only_cancelled}
            onClick={() => setFilters({ ...filters, include_cancelled: !filters.include_cancelled, only_cancelled: false })}
            label="Anche annullati"
          />
          <FilterChip
            active={filters.only_cancelled}
            onClick={() => setFilters({ ...filters, only_cancelled: !filters.only_cancelled, include_cancelled: false })}
            label="Solo annullati"
            variant="danger"
          />
        </FilterSection>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <SearchableMultiSelect
            title="Origine"
            field="parent_type"
            options={[

              { value: 'segnalazione', label: 'Segnalazione' },
              { value: 'dashboard', label: 'Meeting' },
              { value: 'kaizen', label: 'Kaizen' },
              { value: 'pillar', label: 'Pillar' },
            ]}
            filters={filters}
            setFilters={setFilters}
          />
          <SearchableMultiSelect
            title="Stato"
            field="stato"
            options={statiConfig.map(item => ({ value: item.label, label: item.label }))}
            filters={filters}
            setFilters={setFilters}
          />
          <SearchableMultiSelect
            title="Tipo"
            field="tipo"
            options={tipiConfig.map(item => ({ value: item.label, label: item.label }))}
            filters={filters}
            setFilters={setFilters}
          />
          <SearchableMultiSelect
            title="Priorità"
            field="priorita"
            options={prioritaConfig.map(item => ({ value: item.label, label: item.label }))}
            filters={filters}
            setFilters={setFilters}
          />
        </div>

        <div className="border-t pt-4">
          <div className="text-xs font-semibold text-gray-600 uppercase mb-2">Struttura e contesto</div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            <SearchableMultiSelect title="Reparto" field="reparto" options={repartiAttivi.map(item => ({ value: item.nome, label: item.nome }))} filters={filters} setFilters={setFilters} />
            <SearchableMultiSelect title="Linea" field="linea" options={lineeDisponibili.map(item => ({ value: item.nome, label: item.nome }))} filters={filters} setFilters={setFilters} disabled={repartiAttivi.length > 0 && filters.reparto.length === 0} disabledText="Seleziona prima un reparto" />
            <SearchableMultiSelect title="Macchina" field="macchina" options={macchineDisponibili.map(item => ({ value: item.nome, label: item.nome }))} filters={filters} setFilters={setFilters} disabled={lineeDisponibili.length > 0 && filters.linea.length === 0} disabledText="Seleziona prima una linea" />
            <SearchableMultiSelect title="5M" field="quinta_m" options={[
              { value: 'Machine', label: 'Machine' },
              { value: 'Manodopera', label: 'Manodopera' },
              { value: 'Metodo', label: 'Metodo' },
              { value: 'Materiale', label: 'Materiale' },
              { value: 'Misurazione', label: 'Misurazione' },
            ]} filters={filters} setFilters={setFilters} />
            <SearchableMultiSelect title="Categoria perdita" field="categoria_perdita" options={(configs.categorie_perdita || []).map(item => ({ value: item.label, label: item.label }))} filters={filters} setFilters={setFilters} />
            <SearchableMultiSelect title="Pillar" field="pillar_id" options={pillars.filter(item => item.attivo !== false).map(item => ({ value: item._id, label: `${item.sigla} - ${item.label}` }))} filters={filters} setFilters={setFilters} />
            <SearchableMultiSelect title="Meeting" field="dashboard_id" options={dashboards.map(item => ({ value: item._id, label: item.nome || item.label || item.titolo || 'Meeting' }))} filters={filters} setFilters={setFilters} />
            <SearchableMultiSelect title="Responsabile" field="responsabile" options={responsabiliUnici.map(item => ({ value: item, label: item }))} filters={filters} setFilters={setFilters} />
          </div>
        </div>
          </div>
        )}
      </div>
      
      {loading ? (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center text-gray-400">Caricamento...</div>
      ) : plans.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center text-gray-400">
          <p>Nessun Action Plan trovato</p>

        </div>
      ) : (
        <ActionPlanViews
          plans={plans}
          statiConfig={statiConfig}
          onSelectAP={setSelectedPlan}
          onEditAP={(p) => { setEditingPlan(p); setShowForm(true) }}
          onDeleteAP={(p) => handleDelete(p._id)}
          onChangeStato={(ap, nuovoStato) => quickStateChange(ap._id, nuovoStato)}
          showCollegato={true}
          showKanban={true}
          showCalendar={true}
          defaultView={viewMode}
          emptyMessage="Nessun Action Plan trovato"

        />
      )}

      {showForm && editingPlan && (
        <ActionPlanFormShared
          plan={editingPlan}
          onClose={() => { setShowForm(false); setEditingPlan(null) }}
          onSaved={(saved) => { setShowForm(false); setEditingPlan(null); loadData(); if (saved) setSelectedPlan(saved) }}
        />
      )}
      {selectedPlan && (
        <ActionPlanDetailPanel
  plan={selectedPlan}
  onClose={() => {
    setSelectedPlan(null)

    if (searchParams.get('open')) {
      setSearchParams({}, { replace: true })
    }
  }}
          onUpdated={() => loadData()}
          onEdit={(p) => { setSelectedPlan(null); setEditingPlan(p); setShowForm(true) }}
          onCancel={async (p) => { await handleCancel(p); setSelectedPlan(null) }}
          onRestore={async (p) => { await handleRestore(p); setSelectedPlan(null) }}
          onDelete={async (id) => { await handleDelete(id); setSelectedPlan(null) }}
        />
      )}
    </div>
  )
}
function toggleMultiValue(values, value) {
  return values.includes(value)
    ? values.filter(item => item !== value)
    : [...values, value]
}

function FilterSection({ title, children }) {
  return (
    <div className="border-t pt-3">
      <div className="text-xs font-semibold text-gray-600 uppercase mb-2">{title}</div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}

function MultiFilterChip({ filters, setFilters, field, value, label }) {
  const selected = filters[field] || []

  return (
    <FilterChip
      active={selected.includes(value)}
      onClick={() => setFilters({
        ...filters,
        [field]: toggleMultiValue(selected, value),
      })}
      label={label}
    />
  )
}

function SearchableMultiSelect({
  title,
  field,
  options,
  filters,
  setFilters,
  disabled = false,
  disabledText = '',
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const selected = filters[field] || []
  const normalizedQuery = query.trim().toLowerCase()
  const filteredOptions = normalizedQuery
    ? options.filter(option => option.label.toLowerCase().includes(normalizedQuery))
    : options

  function toggleOption(value) {
    setFilters({
      ...filters,
      [field]: toggleMultiValue(selected, value),
    })
  }

  function clearSelection(event) {
    event.stopPropagation()
    setFilters({ ...filters, [field]: [] })
  }

  const selectedLabels = options
    .filter(option => selected.includes(option.value))
    .map(option => option.label)

  return (
    <div className="relative">
      <div className="text-xs font-semibold text-gray-600 uppercase mb-1.5">{title}</div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(value => !value)}
        className="w-full min-h-10 px-3 py-2 border rounded-lg bg-white text-left text-sm flex items-center justify-between gap-2 disabled:bg-gray-100 disabled:text-gray-400"
      >
        <span className="truncate">
          {disabled
            ? disabledText
            : selectedLabels.length === 0
              ? `Tutti: ${title}`
              : selectedLabels.length <= 2
                ? selectedLabels.join(', ')
                : `${selectedLabels.length} selezionati`}
        </span>
        <span className="flex items-center gap-1 flex-shrink-0">
          {selected.length > 0 && (
            <span
              role="button"
              tabIndex={0}
              onClick={clearSelection}
              onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') clearSelection(event)
              }}
              className="text-gray-400 hover:text-gray-700 p-0.5"
              title="Azzera selezione"
            >
              <X size={14} />
            </span>
          )}
          <ChevronDown size={15} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {open && !disabled && (
        <div className="absolute z-40 mt-1 w-full min-w-64 bg-white border rounded-lg shadow-xl overflow-hidden">
          <div className="p-2 border-b">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
              <input
                type="text"
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder={`Cerca ${title.toLowerCase()}...`}
                className="w-full pl-8 pr-3 py-2 border rounded-md text-sm"
                autoFocus
              />
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto p-1">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-3 text-sm text-gray-400">Nessun risultato</div>
            ) : (
              filteredOptions.map(option => (
                <label key={option.value} className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-gray-50 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={selected.includes(option.value)}
                    onChange={() => toggleOption(option.value)}
                    className="rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <span className="truncate">{option.label}</span>
                </label>
              ))
            )}
          </div>
          {selected.length > 0 && (
            <div className="border-t p-2 flex justify-between items-center text-xs">
              <span className="text-gray-500">{selected.length} selezionati</span>
              <button type="button" onClick={clearSelection} className="text-primary hover:underline">Azzera</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function FilterChip({ active, onClick, label, variant = 'primary' }) {
  const styles = {
    primary: active ? 'bg-primary text-white border-primary' : 'bg-white text-gray-700 border-gray-200 hover:border-primary',
    danger: active ? 'bg-red-600 text-white border-red-600' : 'bg-white text-gray-700 border-gray-200 hover:border-red-400',
  }
  return (
    <button onClick={onClick} className={`px-3 py-1.5 rounded-full text-xs font-medium border-2 transition-all ${styles[variant]}`}>
      {label}
    </button>
  )
}

function Avatar({ name, size = 24 }) {
  if (!name) return null
  const initials = name.split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase()
  const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-yellow-500']
  const color = colors[name.charCodeAt(0) % colors.length]
  return (
    <div style={{ width: size, height: size, fontSize: size * 0.45 }}
      className={`${color} text-white rounded-full flex items-center justify-center font-bold flex-shrink-0`}
      title={name}>{initials}</div>
  )
}

function StatCard({ label, value, color, icon: Icon, onClick, active }) {
  const colors = {
    gray: 'border-gray-200 text-gray-700', blue: 'border-blue-200 text-blue-700',
    indigo: 'border-indigo-200 text-indigo-700', purple: 'border-purple-200 text-purple-700',
    green: 'border-green-200 text-green-700', red: 'border-red-200 text-red-700',
  }
  return (
    <button onClick={onClick}
      className={`p-3 rounded-lg border-2 bg-white hover:shadow-md transition-all text-left ${active ? `${colors[color]} shadow-md scale-105` : 'border-gray-100'}`}>
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs uppercase text-gray-500">{label}</span>
        <Icon size={16} className="opacity-50" />
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </button>
  )
}

function HealthBadge({ score }) {
  let color = 'bg-red-500'
  if (score >= 75) color = 'bg-green-500'
  else if (score >= 50) color = 'bg-yellow-500'
  else if (score >= 25) color = 'bg-orange-500'
  return (
    <div className="flex items-center gap-1" title={`Health: ${score}/100`}>
      <div className="w-12 bg-gray-200 rounded-full h-1.5 overflow-hidden">
        <div className={`${color} h-full transition-all`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs text-gray-600">{score}</span>
    </div>
  )
}

function Modal({ title, children, onClose, wide = false, noPadding = false }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={`bg-white rounded-lg shadow-xl ${wide ? 'max-w-6xl' : 'max-w-3xl'} w-full max-h-[95vh] overflow-hidden`}>
        {title && (
          <div className="bg-primary text-white px-6 py-3 flex justify-between items-center">
            <h2 className="text-lg font-semibold">{title}</h2>
            <button onClick={onClose} className="hover:bg-primary-light p-1 rounded"><X size={20} /></button>
          </div>
        )}
        <div className={noPadding ? '' : 'p-6'}>{children}</div>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div>
      <h3 className="text-sm font-bold mb-2">{title}</h3>
      {children}
    </div>
  )
}

function SidebarRow({ label, children }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-gray-600 text-xs uppercase">{label}</span>
      <div>{children}</div>
    </div>
  )
}

function renderWithMentionsTags(text) {
  if (!text) return null
  const parts = text.split(/(@[a-zA-Z0-9._-]+|#[a-zA-Z0-9_-]+)/g)
  return parts.map((p, i) => {
    if (p.startsWith('@')) return <span key={i} className="text-blue-600 font-medium">{p}</span>
    if (p.startsWith('#')) return <span key={i} className="text-purple-600 font-medium">{p}</span>
    return p
  })
}
      
