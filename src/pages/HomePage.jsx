import React, { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import ActionPlanDetailPanel from '../components/ActionPlanDetailPanel'

export default function HomePage() {
  const { user, isOperator } = useAuth()

  const [actionPlans, setActionPlans] = useState([])
  const [kaizens, setKaizens] = useState([])
  const [pillars, setPillars] = useState([])
  const [dashboards, setDashboards] = useState([])
  const [oplDaLeggere, setOplDaLeggere] = useState([])
  const [oplHistory, setOplHistory] = useState([])
  const [oplTab, setOplTab] = useState('pending')
  const [reports, setReports] = useState([])
  const [errors, setErrors] = useState({})
  const requestId = useRef(0)
  const [loading, setLoading] = useState(true)
  const [selectedAP, setSelectedAP] = useState(null)
  const [origineFilter, setOrigineFilter] = useState('tutte')

  useEffect(() => { loadData(); return () => { requestId.current += 1 } }, [user])
  async function loadData() {
    if (!user) return
    const version = ++requestId.current
    setLoading(true)
    const endpoints = ['/action-plans/', '/kaizens/', '/pillars/', '/dashboards/', '/opl-letture/da-leggere', '/opl-letture/storico-personale', '/segnalazioni/']
    const results = await Promise.allSettled(endpoints.map(path => api.get(path)))
    if (version !== requestId.current) return
    const failures = {}
    const read = (index, key, wrapped = false) => {
      if (results[index].status !== 'fulfilled') { failures[key] = true; return [] }
      const data = results[index].value.data
      return Array.isArray(wrapped ? data?.items : data) ? (wrapped ? data.items : data) : []
    }
    setActionPlans(read(0, 'ap'))
    setKaizens(read(1, 'kaizen'))
    setPillars(read(2, 'pillar'))
    setDashboards(read(3, 'meeting'))
    setOplDaLeggere(read(4, 'opl', true))
    setOplHistory(read(5, 'history', true))
    setReports(read(6, 'reports'))
    setErrors(failures)
    setLoading(false)
  }
  if (!user) return null
  if (loading) {
    return (
      <div className="text-center py-12 text-gray-400">Caricamento dashboard personale...</div>
    )
  }
  const myActionPlans = actionPlans.filter(ap => {
    if (ap.is_cancelled) return false
    if (ap.responsabile && ap.responsabile === user.full_name) return true
    if (ap.responsabile_id && ap.responsabile_id === user.id) return true
    if (ap.mentions?.includes(user.username)) return true
    return false
  })

  const myAreaActionPlans = actionPlans.filter(ap => {
    if (ap.is_cancelled) return false
    if (user.reparto && ap.reparto === user.reparto) return true
    if (user.linee?.length > 0 && user.linee.includes(ap.linea)) return true
    if (user.macchine?.length > 0 && user.macchine.includes(ap.macchina)) return true
    return false
  })

  const myPillars = pillars.filter(p => {
    if (p.leader_id === user.id) return true
    if (p.members_ids?.includes(user.id)) return true
    if (p.leader === user.full_name) return true
    if (p.members?.includes(user.full_name)) return true
    return false
  })

  const myKaizens = kaizens.filter(k => {
    if (k.stato === 'Chiuso' || k.stato === 'Cancelled') return false
    if (k.creatore_id === user.id) return true
    if (k.team_leader_id === user.id) return true
    if ((k.team_members_ids || []).includes(user.id)) return true
    if (k.creatore_nome === user.full_name) return true
    if (k.team_leader_nome === user.full_name) return true
    if ((k.team_members_nomi || []).includes(user.full_name)) return true
    if (k.leader === user.full_name) return true
    if ((k.team_members || []).includes(user.full_name)) return true
    if (isOperator && user.reparto && k.reparto === user.reparto) return true
    return false
  })

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  function classifyByDeadline(ap) {
    if (!ap.data_scadenza) return 'no-date'
    const scadenza = new Date(ap.data_scadenza)
    scadenza.setHours(0, 0, 0, 0)
    if (scadenza < today) return 'overdue'
    if (scadenza.getTime() === today.getTime()) return 'today'
    const inSevenDays = new Date(today)
    inSevenDays.setDate(inSevenDays.getDate() + 7)
    if (scadenza <= inSevenDays) return 'week'
    return 'future'
  }

  const baseActionPlans = isOperator ? myAreaActionPlans : myActionPlans

  const targetActionPlans = origineFilter === 'tutte'
    ? baseActionPlans
    : baseActionPlans.filter(ap => getOrigine(ap) === origineFilter)

  const apOverdue = targetActionPlans.filter(ap => classifyByDeadline(ap) === 'overdue')
  const apToday = targetActionPlans.filter(ap => classifyByDeadline(ap) === 'today')
  const apWeek = targetActionPlans.filter(ap => classifyByDeadline(ap) === 'week')
  const apFuture = targetActionPlans.filter(ap => classifyByDeadline(ap) === 'future' || classifyByDeadline(ap) === 'no-date')

  const roleLabels = {
    admin: 'Amministratore',
    manager: 'Manager',
    office: 'Ufficio',
    operator: 'Operatore'
  }
  const shownOpl = oplTab === 'pending' ? oplDaLeggere : oplHistory
  const ownReports = reports.filter(item => {
    const id = user.id || user._id
    return (id && [item.segnalatore_id, item.creatore_id, item.created_by_id].some(value => value && String(value) === String(id))) || (user.full_name && item.segnalatore_nome === user.full_name)
  }).sort((a, b) => (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0))
  const reportList = ownReports.slice(0, 4)
  const roles = [user.job_title || roleLabels[user.role], user.reparto, ...(user.linee || []), user.team].filter(Boolean)
  return <div className="space-y-4" data-layout="home-clean-v1">
    <header className="bg-gradient-to-r from-primary to-primary-light text-white rounded-xl p-4 sm:p-5 flex flex-wrap justify-between items-start gap-3">
      <div className="min-w-0"><h1 className="text-2xl font-bold">Ciao {user.full_name?.split(' ')[0] || user.username}!</h1><p className="text-sm mt-1 break-words">{[...new Set(roles)].join(' · ')}</p></div>
      <p className="text-xs">{new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
    </header>
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
      <HomeSection title="OPL" to="/da-leggere" linkLabel="Vedi tutte">
        <div className="flex flex-wrap gap-2 mb-3" role="group" aria-label="Letture OPL">
          <button type="button" aria-pressed={oplTab === 'pending'} onClick={() => setOplTab('pending')} className={tabClass(oplTab === 'pending')}>Da leggere ({oplDaLeggere.length})</button>
          <button type="button" aria-pressed={oplTab === 'history'} onClick={() => setOplTab('history')} className={tabClass(oplTab === 'history')}>Storico letture</button>
        </div>
        {errors[oplTab === 'pending' ? 'opl' : 'history'] ? <LoadError onRetry={loadData} /> : !shownOpl.length ? <Empty>{oplTab === 'pending' ? 'Nessuna OPL da leggere.' : 'Nessuna lettura confermata.'}</Empty> : <div className="divide-y">{shownOpl.slice(0, 5).map(opl => <Link key={opl._id} to={`/da-leggere?opl=${encodeURIComponent(opl.document_id)}`} className="block py-2 hover:bg-gray-50 rounded">
          <div className="text-xs text-gray-500">{opl.document_number} · v{opl.version}</div><p className="text-sm font-medium break-words">{opl.document_title}</p>
          <p className="text-xs text-gray-500 mt-1">{oplTab === 'history' ? `Letta il ${formatDate(opl.confirmed_at)}` : opl.scadenza ? `Scadenza ${formatDate(opl.scadenza)}` : ''}</p>
        </Link>)}</div>}
      </HomeSection>
      <HomeSection title="Nuova segnalazione">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link to="/segnalazioni?nuova=Sicurezza" className="border border-gray-300 rounded-lg px-4 py-4 text-center text-sm font-semibold hover:border-primary focus-visible:outline focus-visible:outline-2">Sicurezza</Link>
          <Link to="/segnalazioni?nuova=Ambiente" className="border border-gray-300 rounded-lg px-4 py-4 text-center text-sm font-semibold hover:border-primary focus-visible:outline focus-visible:outline-2">Ambiente</Link>
        </div>
      </HomeSection>
      <HomeSection title="Storico segnalazioni" to="/segnalazioni" linkLabel="Vedi tutte">
        {errors.reports ? <LoadError onRetry={loadData} /> : !reportList.length ? <Empty>Nessuna segnalazione personale.</Empty> : <div className="divide-y">{reportList.map(item => <Link key={item._id} to={`/segnalazioni?open=${encodeURIComponent(item._id)}`} className="block py-2 hover:bg-gray-50 rounded"><div className="flex flex-wrap justify-between gap-2 text-xs"><span className="font-mono">{item.codice || 'Bozza'}</span><span className="text-gray-500">{item.tipo} · {item.stato}</span></div><p className="text-sm break-words mt-1 line-clamp-2">{item.descrizione || 'Senza descrizione'}</p></Link>)}</div>}
      </HomeSection>
      <HomeSection title={isOperator ? 'Action Plan della mia area' : 'Le mie Action Plan'} to="/action-plan" linkLabel="Vedi tutte">
        <OrigineFilterBar plans={baseActionPlans} value={origineFilter} onChange={setOrigineFilter} />
        {errors.ap ? <LoadError onRetry={loadData} /> : !targetActionPlans.length ? <Empty>Nessuna Action Plan.</Empty> : <div className="space-y-3">
          {apOverdue.length > 0 && <APGroup title="Scaduti" color="red" aps={apOverdue.slice(0, 5)} onClick={setSelectedAP} />}
          {apToday.length > 0 && <APGroup title="Oggi" color="orange" aps={apToday.slice(0, 5)} onClick={setSelectedAP} />}
          {apWeek.length > 0 && <APGroup title="Questa settimana" color="yellow" aps={apWeek.slice(0, 5)} onClick={setSelectedAP} />}
          {apFuture.length > 0 && <APGroup title="Prossime" color="green" aps={apFuture.slice(0, 5)} onClick={setSelectedAP} />}
        </div>}
      </HomeSection>
      <HomeSection title={isOperator ? 'Kaizen della mia linea' : 'I miei Kaizen'} to="/kaizen" linkLabel="Vedi tutti">
        {errors.kaizen ? <LoadError onRetry={loadData} /> : !myKaizens.length ? <Empty>Nessun Kaizen attivo.</Empty> : <div className="divide-y">{myKaizens.slice(0, 5).map(k => <Link key={k._id} to={`/kaizen/${k._id}`} className="block py-2 hover:bg-gray-50 rounded"><span className="text-xs font-mono text-gray-500">{k.numero}</span><p className="text-sm font-medium break-words">{k.titolo}</p></Link>)}</div>}
      </HomeSection>
      {!isOperator && <HomeSection title="I miei pilastri" to="/pillars" linkLabel="Vedi tutti">
        {errors.pillar ? <LoadError onRetry={loadData} /> : !myPillars.length ? <Empty>Nessun pilastro assegnato.</Empty> : <div className="divide-y">{myPillars.slice(0, 5).map(p => <Link key={p._id} to={`/pillars/${p._id}`} className="flex items-center gap-3 py-2 hover:bg-gray-50 rounded">{p.icon_image && <img src={p.icon_image} alt="" style={{ width: 40, height: 40, objectFit: 'contain', flexShrink: 0 }} onError={event => { event.currentTarget.style.display = 'none' }} />}<div className="min-w-0"><p className="text-sm font-semibold">{p.sigla}</p><p className="text-xs text-gray-600 break-words">{p.label}</p></div></Link>)}</div>}
      </HomeSection>}
      <HomeSection title="I miei Meeting" to="/dashboard" linkLabel="Vedi tutti">
        {errors.meeting ? <LoadError onRetry={loadData} /> : !dashboards.length ? <Empty>Nessun meeting disponibile.</Empty> : <div className="divide-y">{dashboards.slice(0, 6).map(d => <Link key={d._id} to={`/dashboard/${d._id}`} className="block py-2 text-sm font-medium break-words hover:bg-gray-50 rounded">{d.nome || d.label || 'Meeting'}</Link>)}</div>}
      </HomeSection>
    </div>
    {selectedAP && <ActionPlanDetailPanel plan={selectedAP} onClose={() => setSelectedAP(null)} onUpdated={loadData} onEdit={() => setSelectedAP(null)} />}
  </div>
}
function HomeSection({ title, to, linkLabel, children }) {
  return <section className="bg-white border border-gray-200 rounded-xl p-4 min-w-0"><div className="flex flex-wrap justify-between items-center gap-2 mb-3"><h2 className="text-base font-semibold text-gray-900">{title}</h2>{to && <Link to={to} className="text-xs text-primary hover:underline shrink-0">{linkLabel}</Link>}</div>{children}</section>
}
function Empty({ children }) { return <p className="text-sm text-gray-500 py-3">{children}</p> }
function LoadError({ onRetry }) { return <p role="alert" className="text-sm text-red-700">Dati non disponibili. <button type="button" onClick={onRetry} className="underline">Riprova</button></p> }
function formatDate(value) { const date = new Date(value); return value && !Number.isNaN(date.getTime()) ? date.toLocaleDateString('it-IT') : '—' }
function tabClass(active) { return `px-3 py-1.5 rounded border text-xs ${active ? 'bg-primary text-white border-primary' : 'bg-white text-gray-600 border-gray-200'}` }
function APGroup({ title, color, aps, onClick }) {
  const colors = { red: 'text-red-700 bg-red-50 border-red-200', orange: 'text-orange-700 bg-orange-50 border-orange-200', yellow: 'text-yellow-800 bg-yellow-50 border-yellow-200', green: 'text-gray-700 bg-gray-50 border-gray-200' }
  return <div><h3 className={`mb-1 px-2 py-1 rounded border text-xs font-semibold ${colors[color]}`}>{title} ({aps.length})</h3><div className="divide-y">{aps.map(ap => <div key={ap._id} className="py-2 min-w-0"><button type="button" onClick={() => onClick(ap)} className="block w-full text-left hover:text-primary"><span className="font-mono text-xs font-semibold">{ap.numero}</span><span className="block text-sm break-words mt-0.5">{ap.titolo}</span></button><div className="flex flex-wrap justify-between gap-1 mt-1"><OriginePill ap={ap} />{ap.data_scadenza && <span className="text-xs text-gray-500">{formatDate(ap.data_scadenza)}</span>}</div></div>)}</div></div>
}
function getOrigine(ap) {
  if (!ap.parent_type || ap.parent_type === 'standalone') {
    return 'manuale'
  }

  return ap.parent_type
}

function getOrigineLabel(origine) {
  if (origine === 'segnalazione') return 'Segnalazione'
  if (origine === 'kaizen') return 'Kaizen'
  if (origine === 'dashboard') return 'Meeting'
  if (origine === 'pillar') return 'Pillar'
  return 'Manuale'
}

function getOrigineColor(origine) {
  if (origine === 'segnalazione') return 'bg-red-100 text-red-700'
  if (origine === 'kaizen') return 'bg-emerald-100 text-emerald-700'
  if (origine === 'dashboard') return 'bg-purple-100 text-purple-700'
  if (origine === 'pillar') return 'bg-indigo-100 text-indigo-700'
  return 'bg-gray-100 text-gray-600'
}

function getOrigineRoute(ap) {
  if (!ap.parent_id) return null

  if (ap.parent_type === 'segnalazione') {
    return `/segnalazioni?open=${ap.parent_id}`
  }

  if (ap.parent_type === 'kaizen') {
    return `/kaizen/${ap.parent_id}`
  }

  if (ap.parent_type === 'dashboard') {
    return `/dashboard/${ap.parent_id}`
  }

  if (ap.parent_type === 'pillar') {
    return `/pillars/${ap.parent_id}`
  }

  return null
}

function OriginePill({ ap }) {
  const origine = getOrigine(ap)
  const label = getOrigineLabel(origine)
  const color = getOrigineColor(origine)
  const route = getOrigineRoute(ap)

  const pill = (
    <span
      className={`px-2 py-0.5 rounded text-xs font-medium break-words ${color}`}
    >
      {label}
      {ap.parent_label ? ` · ${ap.parent_label}` : ''}
    </span>
  )

  if (!route) {
    return <span className="min-w-0">{pill}</span>
  }

  return (
    <Link
      to={route}
      onClick={event => event.stopPropagation()}
      className="min-w-0 hover:opacity-80"
      title={`Apri ${label}`}
    >
      {pill}
    </Link>
  )
}

const ORIGINE_CHIPS = [
  { id: 'tutte', label: 'Tutte' },
  { id: 'segnalazione', label: 'Segnalazioni' },
  { id: 'dashboard', label: 'Meeting' },
  { id: 'kaizen', label: 'Kaizen' },
  { id: 'pillar', label: 'Pillar' },
  { id: 'manuale', label: 'Manuale' },
]

function OrigineFilterBar({ plans, value, onChange }) {
  function getCount(origine) {
    if (origine === 'tutte') {
      return plans.length
    }

    return plans.filter(ap => getOrigine(ap) === origine).length
  }

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {ORIGINE_CHIPS.map(chip => {
        const active = value === chip.id
        const count = getCount(chip.id)
        const baseClass = 'px-2 py-1 rounded text-xs font-medium border'
        const activeClass = 'bg-primary text-white border-primary'
        const inactiveClass = 'bg-white text-gray-600 border-gray-200 hover:border-primary'

        return (
          <button
            key={chip.id}
            type="button"
            onClick={() => onChange(chip.id)}
            className={`${baseClass} ${active ? activeClass : inactiveClass}`}
          >
            {chip.label} ({count})
          </button>
        )
      })}
    </div>
  )
}
