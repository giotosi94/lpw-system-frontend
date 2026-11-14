import React, { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import ActionPlanDetailPanel from '../components/ActionPlanDetailPanel'
import ActionPlanFormShared from '../components/ActionPlanFormShared'
import ActionPlanViews, { getActionPlanOrigin, isAPLocked, isActionPlanOverdue } from '../components/ActionPlanViews'
import { useAllConfigurations } from '../hooks/useConfigurations'
import { Star } from 'lucide-react'

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
  const [origins, setOrigins] = useState([])
  const [configuringMeetings, setConfiguringMeetings] = useState(false)
  const [editingAP, setEditingAP] = useState(null)
  const { configs } = useAllConfigurations()
  const statiConfig = configs.stato_ap || []

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

  const targetActionPlans = baseActionPlans.filter(ap => {
    if (isAPLocked(ap, statiConfig) || ['chiuso', 'closed', 'completed', 'annullato', 'cancelled', 'canceled', 'done'].includes(String(ap.stato || '').trim().toLowerCase())) return false
    return !origins.length || origins.includes(getActionPlanOrigin(ap))
  }).sort((a, b) => (Date.parse(a.data_scadenza) || Number.MAX_SAFE_INTEGER) - (Date.parse(b.data_scadenza) || Number.MAX_SAFE_INTEGER))
  const overduePlans = targetActionPlans.filter(ap => isActionPlanOverdue(ap, statiConfig))
  const upcomingPlans = targetActionPlans.filter(ap => !isActionPlanOverdue(ap, statiConfig) && Number.isFinite(Date.parse(ap.data_scadenza)))
  const undatedPlans = targetActionPlans.filter(ap => !Number.isFinite(Date.parse(ap.data_scadenza)))
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
  return <div className="lpw-home" data-layout="home-professional-v2">
    <style>{`
.lpw-home{--home-ink:#29251f;--home-muted:#6e706f;--home-line:#e6e4df;--home-accent:#715328;color:var(--home-ink);width:100%;min-width:0;font-size:14px;line-height:1.5}
.lpw-home .home-heading{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:12px;padding:4px 0 22px;border-bottom:1px solid #dedbd4;margin-bottom:22px}
.lpw-home .home-heading h1{font-size:26px;letter-spacing:-.6px;line-height:1.25;color:#30271e;margin:0;font-weight:650}
.lpw-home .home-heading p{color:var(--home-muted);font-size:12px;margin-top:6px}
.lpw-home .home-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px;align-items:start}
.lpw-home .home-panel{background:#fff;border:1px solid var(--home-line);border-radius:10px;padding:20px;min-width:0;box-shadow:0 2px 4px #30271e03}
.lpw-home .home-panel-heading{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:18px}
.lpw-home .home-panel-title{font-size:15px;line-height:1.4;font-weight:650;letter-spacing:-.15px;margin:0}
.lpw-home .home-panel-link{font-size:11px;font-weight:500;color:var(--home-muted);text-decoration:none;white-space:nowrap}
.lpw-home .home-panel-link:hover{color:var(--home-accent);text-decoration:underline}
.lpw-home .home-panel-opl,.lpw-home .home-panel-new,.lpw-home .home-panel-reports{min-height:184px}
.lpw-home .home-tabs{display:flex;gap:20px;border-bottom:1px solid var(--home-line);margin-bottom:12px}
.lpw-home .home-tab{background:none;border:0;border-bottom:2px solid transparent;padding:0 0 9px;color:var(--home-muted);font-size:12px;min-height:34px}
.lpw-home .home-tab-active{color:#3c2b1d;border-bottom-color:#896c3f;font-weight:600}
.lpw-home .home-report-buttons{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.lpw-home .home-report-buttons a{background:#f8f7f4;border:1px solid #e5e2db;border-radius:7px;min-height:64px;display:flex;align-items:center;justify-content:center;padding:12px;font-size:13px;color:#43382a;font-weight:550}
.lpw-home .home-report-buttons a:hover{background:#f0ede7;border-color:#b8a78d}
.lpw-home .home-panel-actions{grid-column:1 / -1;grid-row:2}
.lpw-home .home-panel-kaizen{grid-column:1;grid-row:3}
.lpw-home .home-panel-pillars{grid-column:2;grid-row:3}
.lpw-home .home-panel-meetings{grid-column:3;grid-row:3}
.lpw-home .home-action-list{display:flex;flex-direction:column;gap:18px;margin-top:18px}
.lpw-home .home-ap-heading{font-size:11px;font-weight:650;text-transform:uppercase;letter-spacing:.65px;color:#74716c;border-bottom:1px solid var(--home-line);padding-bottom:8px;margin:0 0 3px}
.lpw-home .home-ap-red .home-ap-heading{color:#ad3833}
.lpw-home .home-ap-orange .home-ap-heading{color:#9a631f}
.lpw-home .home-ap-group .py-2{padding-top:12px;padding-bottom:12px}
.lpw-home .home-ap-group button span:last-child{font-size:13px;line-height:1.6;color:#363631}
.lpw-home .home-panel-actions .rounded-full{border-radius:5px;font-size:11px;padding:5px 8px}
.lpw-home .home-panel-actions .flex.flex-wrap.gap-2{gap:5px}
.lpw-home .home-panel .text-gray-500,.lpw-home .home-panel .text-gray-600{color:#71736f}
.lpw-home .home-panel a,.lpw-home .home-panel button{overflow-wrap:anywhere}
.lpw-home button:focus-visible,.lpw-home a:focus-visible{outline:2px solid #947748;outline-offset:3px}
.lpw-home .ap-home-readonly{box-shadow:none;border:1px solid var(--home-line)}.lpw-home .ap-home-readonly table{table-layout:fixed}.lpw-home .ap-home-readonly th,.lpw-home .ap-home-readonly td{overflow-wrap:anywhere}.lpw-home .ap-home-readonly th:nth-child(2){width:26%}.lpw-home .ap-home-readonly th:last-child{width:17%}@media(max-width:1100px){.lpw-home .ap-home-readonly table,.lpw-home .ap-home-readonly tbody{display:block;width:100%}.lpw-home .ap-home-readonly thead{display:none}.lpw-home .ap-home-readonly tr{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));padding:12px;gap:8px}.lpw-home .ap-home-readonly td{display:block;width:auto;padding:0;min-width:0}.lpw-home .ap-home-readonly td:before{content:attr(data-label);display:block;font-size:10px;color:#71736f;margin-bottom:3px}.lpw-home .ap-home-readonly td:nth-child(2),.lpw-home .ap-home-readonly td:last-child{grid-column:1 / -1}.lpw-home .ap-home-readonly td:nth-child(2){grid-row:2}}
@media(max-width:1199px){.lpw-home .home-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.lpw-home .home-panel{grid-column:auto;grid-row:auto}.lpw-home .home-panel-actions{grid-column:1 / -1}.lpw-home .home-panel-opl,.lpw-home .home-panel-new,.lpw-home .home-panel-reports{min-height:0}}
@media(max-width:639px){.lpw-home .home-grid{grid-template-columns:minmax(0,1fr);gap:12px}.lpw-home .home-panel{grid-column:auto;padding:16px}.lpw-home .home-heading{padding-bottom:16px;margin-bottom:16px}.lpw-home .home-heading h1{font-size:23px}.lpw-home .home-panel-heading{margin-bottom:14px}.lpw-home .home-tabs{gap:14px}.lpw-home .home-panel-actions .flex.flex-wrap.gap-2 button{min-height:32px}}
.lpw-home .home-panel{border:1px solid #c9bbaa;box-shadow:0 2px 6px rgba(63,43,25,.06)}.lpw-home .home-panel-heading{border-bottom:1px solid #e5dcd1;padding-bottom:13px}.lpw-home .home-origin-flags{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-bottom:20px}.lpw-home .home-origin-flags label{display:inline-flex;align-items:center;gap:8px;min-height:38px;padding:8px 12px;border:1px solid #d7cbbb;border-radius:8px;background:#fff;font-size:13px;cursor:pointer}.lpw-home .home-origin-flags label.is-selected{border-color:#806342;background:#f6f0e7;color:#3e2b1a}.lpw-home .home-origin-flags input{width:16px;height:16px;accent-color:#765735}.lpw-home .home-ap-group{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid #e5dcd1}.lpw-home .home-ap-group span{font-size:11px;padding:2px 7px;border-radius:12px;background:#f2eee8}.lpw-home .home-ap-overdue{color:#b42318}.lpw-home .home-ap-overdue span{background:#fef0ee}
.lpw-home .home-ap-columns{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:22px;align-items:start}.lpw-home .home-ap-columns>section{min-width:0}.lpw-home .home-ap-undated{grid-column:1 / -1}.lpw-home .home-ap-columns .ap-home-readonly{container-type:inline-size}@media(max-width:767px){.lpw-home .home-ap-columns{grid-template-columns:minmax(0,1fr)}.lpw-home .home-panel-meetings .home-panel-heading{flex-wrap:wrap;gap:10px}}
.lpw-home .home-ap-columns .ap-home-readonly{overflow-x:auto;container-type:normal}.lpw-home .home-ap-columns .ap-home-readonly table{display:table;width:100%;min-width:500px;table-layout:fixed}.lpw-home .home-ap-columns .ap-home-readonly thead{display:table-header-group}.lpw-home .home-ap-columns .ap-home-readonly tbody{display:table-row-group}.lpw-home .home-ap-columns .ap-home-readonly tr{display:table-row;padding:0}.lpw-home .home-ap-columns .ap-home-readonly th,.lpw-home .home-ap-columns .ap-home-readonly td{display:table-cell;padding:10px 8px;vertical-align:middle;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:12px}.lpw-home .home-ap-columns .ap-home-readonly td:before{display:none;content:none}.lpw-home .home-ap-columns .ap-home-readonly th:nth-child(3),.lpw-home .home-ap-columns .ap-home-readonly td:nth-child(3),.lpw-home .home-ap-columns .ap-home-readonly th:nth-child(4),.lpw-home .home-ap-columns .ap-home-readonly td:nth-child(4),.lpw-home .home-ap-columns .ap-home-readonly th:nth-child(5),.lpw-home .home-ap-columns .ap-home-readonly td:nth-child(5){display:none}.lpw-home .home-ap-columns .ap-home-readonly th:nth-child(1){width:76px}.lpw-home .home-ap-columns .ap-home-readonly th:nth-child(2){width:auto}.lpw-home .home-ap-columns .ap-home-readonly th:nth-child(6){width:86px}.lpw-home .home-ap-columns .ap-home-readonly th:nth-child(7){width:92px}.lpw-home .home-ap-columns .ap-home-readonly th:last-child{width:100px}.lpw-home .home-ap-columns .ap-home-readonly td:nth-child(2) button{display:block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lpw-home .home-ap-columns .ap-home-readonly td:last-child span{max-width:100%;overflow:hidden;text-overflow:ellipsis;vertical-align:middle}
`}</style>
    <header className="home-heading">
      <div className="min-w-0"><h1 className="text-2xl font-bold">Ciao {user.full_name?.split(' ')[0] || user.username}!</h1><p className="text-sm mt-1 break-words">{[...new Set(roles)].join(' · ')}</p></div>
      <p className="text-xs">{new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
    </header>
    <div className="home-grid">
      <HomeSection section="opl" title="OPL" to="/da-leggere" linkLabel="Vedi tutte">
        <div className="home-tabs" role="group" aria-label="Letture OPL">
          <button type="button" aria-pressed={oplTab === 'pending'} onClick={() => setOplTab('pending')} className={tabClass(oplTab === 'pending')}>Da leggere ({oplDaLeggere.length})</button>
          <button type="button" aria-pressed={oplTab === 'history'} onClick={() => setOplTab('history')} className={tabClass(oplTab === 'history')}>Storico letture</button>
        </div>
        {errors[oplTab === 'pending' ? 'opl' : 'history'] ? <LoadError onRetry={loadData} /> : !shownOpl.length ? <Empty>{oplTab === 'pending' ? 'Nessuna OPL da leggere.' : 'Nessuna lettura confermata.'}</Empty> : <div className="divide-y">{shownOpl.slice(0, 5).map(opl => <Link key={opl._id} to={`/da-leggere?opl=${encodeURIComponent(opl.document_id)}`} className="block py-2 hover:bg-gray-50 rounded">
          <div className="text-xs text-gray-500">{opl.document_number} · v{opl.version}</div><p className="text-sm font-medium break-words">{opl.document_title}</p>
          <p className="text-xs text-gray-500 mt-1">{oplTab === 'history' ? `Letta il ${formatDate(opl.confirmed_at)}` : opl.scadenza ? `Scadenza ${formatDate(opl.scadenza)}` : ''}</p>
        </Link>)}</div>}
      </HomeSection>
      <HomeSection section="new" title="Nuova segnalazione">
        <div className="home-report-buttons">
          <Link to="/segnalazioni?nuova=Sicurezza" className="border border-gray-300 rounded-lg px-4 py-4 text-center text-sm font-semibold hover:border-primary focus-visible:outline focus-visible:outline-2">Sicurezza</Link>
          <Link to="/segnalazioni?nuova=Ambiente" className="border border-gray-300 rounded-lg px-4 py-4 text-center text-sm font-semibold hover:border-primary focus-visible:outline focus-visible:outline-2">Ambiente</Link>
        </div>
      </HomeSection>
      <HomeSection section="reports" title="Storico segnalazioni" to="/segnalazioni" linkLabel="Vedi tutte">
        {errors.reports ? <LoadError onRetry={loadData} /> : !reportList.length ? <Empty>Nessuna segnalazione personale.</Empty> : <div className="divide-y">{reportList.map(item => <Link key={item._id} to={`/segnalazioni?open=${encodeURIComponent(item._id)}`} className="block py-2 hover:bg-gray-50 rounded"><div className="flex flex-wrap justify-between gap-2 text-xs"><span className="font-mono">{item.codice || 'Bozza'}</span><span className="text-gray-500">{item.tipo} · {item.stato}</span></div><p className="text-sm break-words mt-1 line-clamp-2">{item.descrizione || 'Senza descrizione'}</p></Link>)}</div>}
      </HomeSection>
      <HomeSection section="actions" title={isOperator ? 'Piani d’azione della mia area' : 'I miei piani d’azione'} to="/action-plan" linkLabel="Vedi tutti">
        <div className="home-origin-flags" role="group" aria-label="Filtra per origine">
          {ORIGINE_CHIPS.map(item => <label key={item.id} className={origins.includes(item.id) ? 'is-selected' : ''}><input type="checkbox" checked={origins.includes(item.id)} onChange={() => setOrigins(current => current.includes(item.id) ? current.filter(id => id !== item.id) : [...current, item.id])} />{item.label}</label>)}
          {origins.length > 0 && <button type="button" onClick={() => setOrigins([])} className="text-xs text-primary hover:underline">Tutte</button>}
        </div>
        {errors.ap ? <LoadError onRetry={loadData} /> : <div className="home-ap-columns">
          <section aria-labelledby="home-overdue-title"><h3 id="home-overdue-title" className="home-ap-group home-ap-overdue">Scaduti <span>{overduePlans.length}</span></h3><ActionPlanViews plans={overduePlans} statiConfig={statiConfig} onSelectAP={setSelectedAP} readOnly showKanban={false} showCalendar={false} showCollegato emptyMessage="Nessun piano d’azione scaduto." /></section>
          <section aria-labelledby="home-upcoming-title"><h3 id="home-upcoming-title" className="home-ap-group">In scadenza <span>{upcomingPlans.length}</span></h3><ActionPlanViews plans={upcomingPlans} statiConfig={statiConfig} onSelectAP={setSelectedAP} readOnly showKanban={false} showCalendar={false} showCollegato emptyMessage="Nessun piano d’azione in scadenza." /></section>
          {undatedPlans.length > 0 && <section className="home-ap-undated" aria-labelledby="home-undated-title"><h3 id="home-undated-title" className="home-ap-group">Senza scadenza <span>{undatedPlans.length}</span></h3><ActionPlanViews plans={undatedPlans} statiConfig={statiConfig} onSelectAP={setSelectedAP} readOnly showKanban={false} showCalendar={false} showCollegato /></section>}
        </div>}
      </HomeSection>
      <HomeSection section="kaizen" title={isOperator ? 'Kaizen della mia linea' : 'I miei Kaizen'} to="/kaizen" linkLabel="Vedi tutti">
        {errors.kaizen ? <LoadError onRetry={loadData} /> : !myKaizens.length ? <Empty>Nessun Kaizen attivo.</Empty> : <div className="divide-y">{myKaizens.slice(0, 5).map(k => <Link key={k._id} to={`/kaizen/${k._id}`} className="block py-2 hover:bg-gray-50 rounded"><span className="text-xs font-mono text-gray-500">{k.numero}</span><p className="text-sm font-medium break-words">{k.titolo}</p></Link>)}</div>}
      </HomeSection>
      {!isOperator && <HomeSection section="pillars" title="I miei pilastri" to="/pillars" linkLabel="Vedi tutti">
        {errors.pillar ? <LoadError onRetry={loadData} /> : !myPillars.length ? <Empty>Nessun pilastro assegnato.</Empty> : <div className="divide-y">{myPillars.slice(0, 5).map(p => <Link key={p._id} to={`/pillars/${p._id}`} className="flex items-center gap-3 py-2 hover:bg-gray-50 rounded">{p.icon_image && <img src={p.icon_image} alt="" style={{ width: 40, height: 40, objectFit: 'contain', flexShrink: 0 }} onError={event => { event.currentTarget.style.display = 'none' }} />}<div className="min-w-0"><p className="text-sm font-semibold">{p.sigla}</p><p className="text-xs text-gray-600 break-words">{p.label}</p></div></Link>)}</div>}
      </HomeSection>}
      <HomeSection section="meetings" title="Meeting preferiti" to="/dashboard" linkLabel="Vedi tutti" actions={<button type="button" aria-expanded={configuringMeetings} onClick={() => setConfiguringMeetings(value => !value)} className="home-panel-link">{configuringMeetings ? 'Fine' : 'Configura'}</button>}>
        {errors.meeting ? <LoadError onRetry={loadData} /> : <FavoriteMeetings key={`${user.plant_id || 'induno'}:${user.id || user._id || user.username}`} meetings={dashboards} configuring={configuringMeetings} storageKey={`lpw:meeting-favorites:${user.plant_id || 'induno'}:${user.id || user._id || user.username}`} />}
      </HomeSection>
    </div>
    {editingAP && <ActionPlanFormShared plan={editingAP} onClose={() => setEditingAP(null)} onSaved={saved => { setEditingAP(null); loadData(); if (saved) setSelectedAP(saved) }} />}
    {selectedAP && <ActionPlanDetailPanel plan={selectedAP} onClose={() => setSelectedAP(null)} onUpdated={loadData} onEdit={plan => { setEditingAP(plan || selectedAP); setSelectedAP(null) }} />}
  </div>
}
function HomeSection({ section, title, to, linkLabel, children, actions }) {
  return <section className={`home-panel home-panel-${section || 'other'}`}><div className="home-panel-heading"><h2 className="home-panel-title">{title}</h2><div className="flex items-center gap-4">{actions}{to && <Link to={to} className="home-panel-link">{linkLabel}</Link>}</div></div>{children}</section>
}
function Empty({ children }) { return <p className="text-sm text-gray-500 py-3">{children}</p> }
function LoadError({ onRetry }) { return <p role="alert" className="text-sm text-red-700">Dati non disponibili. <button type="button" onClick={onRetry} className="underline">Riprova</button></p> }
function formatDate(value) { const date = new Date(value); return value && !Number.isNaN(date.getTime()) ? date.toLocaleDateString('it-IT') : '—' }
function tabClass(active) { return `home-tab ${active ? 'home-tab-active' : ''}` }
const ORIGINE_CHIPS = [
  { id: 'segnalazione', label: 'Segnalazioni' },
  { id: 'dashboard', label: 'Meeting' },
  { id: 'kaizen', label: 'Kaizen' },
  { id: 'pillar', label: 'Pilastri' },
]
function FavoriteMeetings({ meetings, storageKey, configuring }) {
  const [favorites, setFavorites] = useState(() => {
    try { const saved = JSON.parse(localStorage.getItem(storageKey) || '[]'); return Array.isArray(saved) ? saved.filter(id => typeof id === 'string') : [] } catch { return [] }
  })
  const [query, setQuery] = useState('')
  const [saveError, setSaveError] = useState(false)
  function toggle(id) {
    const next = favorites.includes(id) ? favorites.filter(value => value !== id) : [...favorites, id]
    setFavorites(next)
    try { localStorage.setItem(storageKey, JSON.stringify(next)); setSaveError(false) } catch { setSaveError(true) }
  }
  const visible = meetings.filter(item => configuring ? String(item.nome || item.label || item.titolo || '').toLowerCase().includes(query.trim().toLowerCase()) : favorites.includes(String(item._id)))
  return <div>
    {configuring && <input type="search" aria-label="Cerca meeting" placeholder="Cerca meeting" value={query} onChange={event => setQuery(event.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm mb-2" />}
    {saveError && <p role="alert" className="text-xs text-red-700">Preferiti non salvati nel browser.</p>}
    {!visible.length ? <Empty>{configuring ? 'Nessun meeting trovato.' : 'Nessun meeting preferito.'}</Empty> : <div className="divide-y max-h-80 overflow-y-auto">{visible.map(item => {
      const id = String(item._id)
      const selected = favorites.includes(id)
      const name = item.nome || item.label || item.titolo || 'Meeting'
      return <div key={id} className="flex items-center gap-2 py-2"><Link to={`/dashboard/${encodeURIComponent(id)}`} className="min-w-0 flex-1 text-sm font-medium break-words hover:text-primary">{name}</Link><button type="button" aria-label={`${selected ? 'Rimuovi' : 'Aggiungi'} ${name} ${selected ? 'dai' : 'ai'} preferiti`} aria-pressed={selected} onClick={() => toggle(id)} className={`p-2 rounded hover:bg-gray-50 ${selected ? 'text-amber-700' : 'text-gray-400'}`}><Star size={17} fill={selected ? 'currentColor' : 'none'} /></button></div>
    })}</div>}
  </div>
}
