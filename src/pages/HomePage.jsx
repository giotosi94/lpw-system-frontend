import React, { useState, useEffect, useLayoutEffect, useRef, useId } from 'react'
import { Link } from 'react-router-dom'
import { createPortal } from 'react-dom'
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
  const [showReadingHistory, setShowReadingHistory] = useState(false)
  const [listModal, setListModal] = useState(null)
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

  const myReparti = user.reparti?.length ? user.reparti : (user.reparto ? [user.reparto] : [])
  const myAreaActionPlans = actionPlans.filter(ap => {
    if (ap.is_cancelled) return false
    if (ap.reparto && myReparti.includes(ap.reparto)) return true
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
    if (isOperator && k.reparto && myReparti.includes(k.reparto)) return true
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
  const shownOpl = oplDaLeggere
  const ownReports = reports.filter(item => {
    const id = user.id || user._id
    return (id && [item.segnalatore_id, item.creatore_id, item.created_by_id].some(value => value && String(value) === String(id))) || (user.full_name && item.segnalatore_nome === user.full_name)
  }).sort((a, b) => (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0))
  const reportList = ownReports
  const renderOplRow = opl => <Link key={opl._id} to={`/da-leggere?opl=${encodeURIComponent(opl.document_id)}`} className="home-opl-row" title={opl.document_title}>
          <span className="home-opl-code">{opl.document_number} · v{opl.version}</span><span className="home-opl-title">{opl.document_title}</span>{getOplCategory(opl, configs.categorie_documento) && <span className="home-opl-type" title={getOplCategory(opl, configs.categorie_documento)}>{getOplCategory(opl, configs.categorie_documento)}</span>}
          {opl.scadenza && <span className="home-opl-due">{formatDate(opl.scadenza)}</span>}
</Link>
  const renderReportRow = item => <Link key={item._id} to={`/segnalazioni?open=${encodeURIComponent(item._id)}`} className="home-report-row block py-2 hover:bg-gray-50 rounded"><div className="flex flex-wrap justify-between gap-2 text-xs"><span className="font-mono">{item.codice || 'Bozza'}</span><span className="text-gray-500">{item.tipo} · {item.stato}</span></div><p className="text-sm break-words mt-1 line-clamp-2">{item.descrizione || 'Senza descrizione'}</p></Link>
  const renderKaizenRow = k => <Link key={k._id} to={`/kaizen/${k._id}`} className="flex items-center gap-3 min-w-0 py-2 hover:bg-gray-50 rounded" title={k.titolo}><span className="shrink-0 whitespace-nowrap text-xs font-mono text-gray-500">{k.numero}</span><span className="min-w-0 truncate text-sm font-medium">{k.titolo}</span></Link>
  const renderPillarRow = p => <Link key={p._id} to={`/pillars/${p._id}`} className="flex items-center gap-3 py-2 hover:bg-gray-50 rounded">{p.icon_image && <img src={p.icon_image} alt="" style={{ width: 40, height: 40, objectFit: 'contain', flexShrink: 0 }} onError={event => { event.currentTarget.style.display = 'none' }} />}<div className="min-w-0"><p className="text-sm font-semibold">{p.sigla}</p><p className="text-xs text-gray-600 break-words">{p.label}</p></div></Link>
  const selectFromModal = ap => { setListModal(null); setSelectedAP(ap) }
  return <div className="lpw-home" data-layout="home-professional-v2">
    <style>{`
.lpw-home{--home-ink:#29251f;--home-muted:#57524b;--home-line:#ebe7e0;--home-accent:#715328;color:var(--home-ink);width:100%;min-width:0;font-size:14px;line-height:1.5}
.lpw-home .home-heading{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:12px;padding:4px 0 22px;border-bottom:1px solid #dedbd4;margin-bottom:22px}
.lpw-home .home-heading h1{font-size:26px;letter-spacing:-.6px;line-height:1.25;color:#30271e;margin:0;font-weight:650}
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
.lpw-home .home-panel-actions>.home-panel-heading{justify-content:flex-start;gap:22px;flex-wrap:wrap}.lpw-home .home-panel-actions>.home-panel-heading>.home-panel-title{flex-shrink:0}.lpw-home .home-panel-actions>.home-panel-heading>.home-origin-flags{margin:0;gap:8px}.lpw-home .home-panel-actions>.home-panel-heading>.home-origin-flags label{min-height:32px;padding:5px 9px;font-size:12px}.lpw-home .home-panel-actions>.home-panel-heading>.flex{margin-left:auto;flex-shrink:0}@media(max-width:767px){.lpw-home .home-panel-actions>.home-panel-heading{gap:12px}.lpw-home .home-panel-actions>.home-panel-heading>.home-origin-flags{order:3;flex-basis:100%}}
.lpw-home .home-grid{grid-template-columns:repeat(6,minmax(0,1fr))}.lpw-home .home-panel-opl{grid-column:1 / span 3;grid-row:1;min-height:0}.lpw-home .home-panel-reports{grid-column:4 / span 3;grid-row:1;min-height:0}.lpw-home .home-panel-actions{grid-column:1 / -1;grid-row:2}.lpw-home .home-panel-kaizen{grid-column:1 / span 2;grid-row:3}.lpw-home .home-panel-pillars{grid-column:3 / span 2;grid-row:3}.lpw-home .home-panel-meetings{grid-column:5 / span 2;grid-row:3}.lpw-home .home-panel-opl>.home-panel-heading,.lpw-home .home-panel-reports>.home-panel-heading{justify-content:flex-start;gap:18px;flex-wrap:wrap}.lpw-home .home-panel-opl>.home-panel-heading>.flex,.lpw-home .home-panel-reports>.home-panel-heading>.flex{margin-left:auto}.lpw-home .home-panel-opl .home-tabs{margin:0;border:0;gap:16px}.lpw-home .home-panel-opl .home-tab{padding:4px 0;white-space:nowrap}.lpw-home .home-opl-row{display:flex;align-items:center;gap:12px;min-width:0;padding:10px 0;border-radius:4px}.lpw-home .home-opl-row:hover{background:#faf8f5}.lpw-home .home-opl-code{font-size:12px;color:#777;white-space:nowrap;flex-shrink:0}.lpw-home .home-opl-title{font-size:14px;font-weight:500;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}.lpw-home .home-opl-due{font-size:12px;color:#777;white-space:nowrap;flex-shrink:0}.lpw-home .home-report-inline{display:flex;align-items:center;gap:8px}.lpw-home .home-report-inline a{border:1px solid #c9bbaa;border-radius:7px;padding:6px 10px;font-size:12px;font-weight:600;white-space:nowrap}.lpw-home .home-report-inline a:hover{background:#f6f0e7}@media(max-width:1199px){.lpw-home .home-panel-kaizen,.lpw-home .home-panel-pillars,.lpw-home .home-panel-meetings{grid-column:span 2;grid-row:auto}}@media(max-width:767px){.lpw-home .home-grid{grid-template-columns:minmax(0,1fr)}.lpw-home .home-panel-opl,.lpw-home .home-panel-reports,.lpw-home .home-panel-actions,.lpw-home .home-panel-kaizen,.lpw-home .home-panel-pillars,.lpw-home .home-panel-meetings{grid-column:1;grid-row:auto}.lpw-home .home-panel-opl>.home-panel-heading,.lpw-home .home-panel-reports>.home-panel-heading{gap:10px}.lpw-home .home-opl-row{gap:8px}.lpw-home .home-opl-code,.lpw-home .home-opl-due{font-size:10px}}
.lpw-home .home-opl-row{background:#fffbeb;border-left:3px solid #eab308;padding:9px 10px;margin:5px 0}.lpw-home .home-opl-row:hover{background:#fef3c7}.lpw-home .home-opl-type{display:inline-block;flex-shrink:0;white-space:nowrap;border:1px solid #e5c76b;background:#fef3c7;color:#854d0e;border-radius:5px;padding:2px 6px;font-size:10px;font-weight:600}.lpw-home .home-panel-opl .home-opl-pending-tab{background:#fef3c7;color:#854d0e;border-radius:5px;padding:5px 8px;border-bottom-color:#ca8a04}
.lpw-home .home-opl-type{max-width:140px;overflow:hidden;text-overflow:ellipsis}@media(max-width:520px){.lpw-home .home-opl-type{max-width:80px}}
  .lpw-home .home-ap-scroll{box-sizing:border-box;overflow:auto;overscroll-behavior:contain;scrollbar-gutter:stable;scrollbar-width:thin;scrollbar-color:#b3a58c #f2eee8}.lpw-home .home-ap-columns .home-ap-scroll .ap-home-readonly{overflow:visible}.lpw-home .home-ap-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid #e5dcd1}.lpw-home .home-ap-columns .home-ap-head .home-ap-group{margin:0;padding:0;border:0}.lpw-home .home-ap-columns .home-ap-head .home-more{margin:0;padding:0;flex-shrink:0}.lpw-home .home-ap-scroll:focus-visible{outline:2px solid #947748;outline-offset:2px}.lpw-home .home-ap-scroll thead th{position:sticky;top:0;z-index:1;background:#f8f7f4}.lpw-home .home-more{display:inline-block;margin-top:10px;padding:6px 0;background:none;border:0;color:#715328;font-size:12px;font-weight:600;text-decoration:underline;text-underline-offset:3px;cursor:pointer}.lpw-home .home-more:hover{color:#3e2b1a}.lpw-home .home-panel-opl>.home-panel-heading>.home-more,.lpw-home .home-panel-reports>.home-panel-heading>.home-more{margin:0 0 0 auto;padding:0;flex-shrink:0}.lpw-home .home-panel-opl .home-ap-scroll,.lpw-home .home-panel-reports .home-ap-scroll{padding-right:2px}.lpw-home .home-panel-opl .home-opl-row:last-child,.lpw-home .home-panel-reports .home-report-row:last-child{margin-bottom:0}.lpw-home .home-ap-columns .home-more{margin-top:6px}

  .lpw-home{--home-secondary:#57524b;--home-faint:#ebe7e0}
  .lpw-home .home-panel{border-color:#e3ddd2;box-shadow:0 1px 2px rgba(63,43,25,.04)}
  .lpw-home .home-panel-heading{border-bottom-color:var(--home-faint)}
  .lpw-home .home-panel-title{color:#321a0d;font-weight:650}
  .lpw-home .home-ap-head{border-bottom-color:var(--home-faint)}
  .lpw-home .home-ap-group{border-bottom-color:var(--home-faint)}
  .lpw-home .text-gray-500,.lpw-home .text-gray-600,.lpw-reading-history .text-gray-500{color:var(--home-secondary)}
  .lpw-home .text-gray-400{color:#7b756c}
  .lpw-home .divide-y>:not([hidden])~:not([hidden]){border-color:var(--home-faint)}
  .lpw-home .home-tab{color:var(--home-secondary)}
  .lpw-home .home-tab-active{color:#321a0d}
  .lpw-home .home-opl-code,.lpw-home .home-opl-due{color:var(--home-secondary)}
  .lpw-home .ap-home-readonly,.lpw-home .home-ap-scroll .ap-home-readonly{border-color:var(--home-faint)}
  .lpw-home .ap-home-readonly thead th,.lpw-home .home-ap-scroll .ap-home-readonly thead th{background:#fff;color:var(--home-secondary);font-weight:600;font-size:12px;text-transform:none;letter-spacing:0;border-bottom:1px solid var(--home-faint)}
  .lpw-home .ap-home-readonly thead th:first-child{font-size:0}
  .lpw-home .ap-home-readonly thead th:first-child::after{content:"#";font-size:13px;font-weight:600;color:var(--home-secondary)}
  .lpw-home .ap-home-readonly tbody td{border-color:var(--home-faint)}
  .lpw-home .home-ap-columns .ap-home-readonly td{font-size:13px}
  .lpw-home .ap-home-readonly td:last-child span{background:#f4f2ee;color:#4a453e;border-radius:4px}
  .lpw-home .ap-home-readonly td:before{color:var(--home-secondary)}
  .lpw-home .ap-home-readonly tbody td:first-child,.lpw-home .ap-home-readonly tbody td:first-child *{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;font-weight:400;color:#615c54}
  .lpw-home .ap-home-readonly thead th:first-child::after{color:#615c54}
`}</style>
    <header className="home-heading">
      <h1 className="text-2xl font-bold">Ciao {user.full_name?.split(' ')[0] || user.username}!</h1>
    </header>
    <div className="home-grid">
      <HomeSection section="opl" title="OPL" more={!errors.opl && <MoreLink count={shownOpl.length} limit={LIST_PREVIEW} onClick={() => setListModal('opl')} />} headerContent={<div className="home-tabs" role="group" aria-label="Letture OPL">
          <button type="button" aria-pressed={true} className={`${tabClass(true)} ${oplDaLeggere.length ? 'home-opl-pending-tab' : ''}`}>Da leggere ({oplDaLeggere.length})</button>
          <button type="button" aria-haspopup="dialog" aria-expanded={showReadingHistory} onClick={() => setShowReadingHistory(true)} className={tabClass(false)}>Storico letture</button>
        </div>}>
        {errors.opl ? <LoadError onRetry={loadData} /> : !shownOpl.length ? <Empty>Nessuna OPL da leggere.</Empty> : <FiveRowScroll label="OPL da leggere" rows={LIST_PREVIEW} rowSelector=".home-opl-row"><div className="divide-y">{shownOpl.map(renderOplRow)}</div></FiveRowScroll>}
      </HomeSection>
      <HomeSection section="reports" title="Segnalazioni" more={!errors.reports && <MoreLink count={ownReports.length} limit={LIST_PREVIEW} onClick={() => setListModal('reports')} />} headerContent={<div className="home-report-inline"><Link to="/segnalazioni?nuova=Sicurezza">+ Sicurezza</Link><Link to="/segnalazioni?nuova=Ambiente">+ Ambiente</Link></div>}>
        {errors.reports ? <LoadError onRetry={loadData} /> : !reportList.length ? <Empty>Nessuna segnalazione personale.</Empty> : <FiveRowScroll label="Segnalazioni personali" rows={LIST_PREVIEW} rowSelector=".home-report-row"><div className="divide-y">{reportList.map(renderReportRow)}</div></FiveRowScroll>}
      </HomeSection>
      <HomeSection section="actions" title={isOperator ? 'Piani d’azione della mia area' : 'I miei piani d’azione'} headerContent={<div className="home-origin-flags" role="group" aria-label="Filtra per origine">
          {ORIGINE_CHIPS.map(item => <label key={item.id} className={origins.includes(item.id) ? 'is-selected' : ''}><input type="checkbox" checked={origins.includes(item.id)} onChange={() => setOrigins(current => current.includes(item.id) ? current.filter(id => id !== item.id) : [...current, item.id])} />{item.label}</label>)}
          {origins.length > 0 && <button type="button" onClick={() => setOrigins([])} className="text-xs text-primary hover:underline">Tutte</button>}
        </div>}>
        {errors.ap ? <LoadError onRetry={loadData} /> : <div className="home-ap-columns">
          <section aria-labelledby="home-overdue-title"><div className="home-ap-head"><h3 id="home-overdue-title" className="home-ap-group home-ap-overdue">Scaduti <span>{overduePlans.length}</span></h3><MoreLink count={overduePlans.length} onClick={() => setListModal('overdue')} /></div><FiveRowScroll label="Piani d’azione scaduti"><ActionPlanViews plans={overduePlans} statiConfig={statiConfig} onSelectAP={setSelectedAP} readOnly showKanban={false} showCalendar={false} showCollegato emptyMessage="Nessun piano d’azione scaduto." /></FiveRowScroll></section>
          <section aria-labelledby="home-upcoming-title"><div className="home-ap-head"><h3 id="home-upcoming-title" className="home-ap-group">In scadenza <span>{upcomingPlans.length}</span></h3><MoreLink count={upcomingPlans.length} onClick={() => setListModal('upcoming')} /></div><FiveRowScroll label="Piani d’azione in scadenza"><ActionPlanViews plans={upcomingPlans} statiConfig={statiConfig} onSelectAP={setSelectedAP} readOnly showKanban={false} showCalendar={false} showCollegato emptyMessage="Nessun piano d’azione in scadenza." /></FiveRowScroll></section>
          {undatedPlans.length > 0 && <section className="home-ap-undated" aria-labelledby="home-undated-title"><div className="home-ap-head"><h3 id="home-undated-title" className="home-ap-group">Senza scadenza <span>{undatedPlans.length}</span></h3><MoreLink count={undatedPlans.length} onClick={() => setListModal('undated')} /></div><FiveRowScroll label="Piani d’azione senza scadenza"><ActionPlanViews plans={undatedPlans} statiConfig={statiConfig} onSelectAP={setSelectedAP} readOnly showKanban={false} showCalendar={false} showCollegato /></FiveRowScroll></section>}
        </div>}
      </HomeSection>
      <HomeSection section="kaizen" title={isOperator ? 'Kaizen della mia linea' : 'I miei Kaizen'}>
        {errors.kaizen ? <LoadError onRetry={loadData} /> : !myKaizens.length ? <Empty>Nessun Kaizen attivo.</Empty> : <div className="divide-y">{myKaizens.slice(0, PREVIEW).map(renderKaizenRow)}</div>}
        {!errors.kaizen && <MoreLink count={myKaizens.length} onClick={() => setListModal('kaizen')} />}
      </HomeSection>
      {!isOperator && <HomeSection section="pillars" title="I miei pilastri">
        {errors.pillar ? <LoadError onRetry={loadData} /> : !myPillars.length ? <Empty>Nessun pilastro assegnato.</Empty> : <div className="divide-y">{myPillars.slice(0, PREVIEW).map(renderPillarRow)}</div>}
        {!errors.pillar && <MoreLink count={myPillars.length} onClick={() => setListModal('pillars')} />}
      </HomeSection>}
      <HomeSection section="meetings" title="Meeting preferiti" actions={<button type="button" aria-expanded={configuringMeetings} onClick={() => setConfiguringMeetings(value => !value)} className="home-panel-link">{configuringMeetings ? 'Fine' : 'Configura'}</button>}>
        {errors.meeting ? <LoadError onRetry={loadData} /> : <FavoriteMeetings key={`${user.plant_id || 'induno'}:${user.id || user._id || user.username}`} meetings={dashboards} configuring={configuringMeetings} storageKey={`lpw:meeting-favorites:${user.plant_id || 'induno'}:${user.id || user._id || user.username}`} />}
      </HomeSection>
    </div>
    {showReadingHistory && <ReadingHistoryModal readings={oplHistory} error={errors.history} onRetry={loadData} onClose={() => setShowReadingHistory(false)} />}
    {listModal === 'opl' && <HomeListModal title="OPL da leggere" items={shownOpl} getText={opl => [opl.document_number, opl.document_title]} renderItem={renderOplRow} emptyText="Nessuna OPL da leggere." onClose={() => setListModal(null)} />}
    {listModal === 'reports' && <HomeListModal title="Segnalazioni" items={ownReports} getText={item => [item.codice, item.tipo, item.stato, item.descrizione]} renderItem={renderReportRow} emptyText="Nessuna segnalazione personale." onClose={() => setListModal(null)} />}
    {listModal === 'kaizen' && <HomeListModal title={isOperator ? 'Kaizen della mia linea' : 'I miei Kaizen'} items={myKaizens} getText={k => [k.numero, k.titolo]} renderItem={renderKaizenRow} emptyText="Nessun Kaizen attivo." onClose={() => setListModal(null)} />}
    {listModal === 'pillars' && <HomeListModal title="I miei pilastri" items={myPillars} getText={p => [p.sigla, p.label]} renderItem={renderPillarRow} emptyText="Nessun pilastro assegnato." onClose={() => setListModal(null)} />}
    {listModal === 'overdue' && <ActionPlanListModal title="Scaduti" plans={overduePlans} statiConfig={statiConfig} onSelect={selectFromModal} onClose={() => setListModal(null)} />}
    {listModal === 'upcoming' && <ActionPlanListModal title="In scadenza" plans={upcomingPlans} statiConfig={statiConfig} onSelect={selectFromModal} onClose={() => setListModal(null)} />}
    {listModal === 'undated' && <ActionPlanListModal title="Senza scadenza" plans={undatedPlans} statiConfig={statiConfig} onSelect={selectFromModal} onClose={() => setListModal(null)} />}
    {editingAP && <ActionPlanFormShared plan={editingAP} onClose={() => setEditingAP(null)} onSaved={saved => { setEditingAP(null); loadData(); if (saved) setSelectedAP(saved) }} />}
    {selectedAP && <ActionPlanDetailPanel plan={selectedAP} onClose={() => setSelectedAP(null)} onUpdated={loadData} onEdit={plan => { setEditingAP(plan || selectedAP); setSelectedAP(null) }} />}
  </div>
}
function HomeSection({ section, title, children, actions, headerContent, more }) {
  return <section className={`home-panel home-panel-${section || 'other'}`}><div className="home-panel-heading"><h2 className="home-panel-title">{title}</h2>{headerContent}{more}{actions && <div className="flex items-center gap-4">{actions}</div>}</div>{children}</section>
}
const PREVIEW = 5
const LIST_PREVIEW = 3
function FiveRowScroll({ label, rows = PREVIEW, rowSelector = 'tbody tr', children }) {
  const boxRef = useRef(null)
  useLayoutEffect(() => {
    const box = boxRef.current
    if (!box) return undefined
    let frame = 0
    const measure = () => {
      frame = 0
      const items = box.querySelectorAll(rowSelector)
      if (items.length <= rows) { box.style.maxHeight = ''; return }
      const rect = box.getBoundingClientRect()
      const scale = box.offsetWidth ? rect.width / box.offsetWidth : 1
      const top = (items[rows].getBoundingClientRect().top - rect.top) / scale + box.scrollTop
      box.style.maxHeight = `${Math.floor(top) + (box.offsetHeight - box.clientHeight)}px`
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure) }
    measure()
    const resize = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null
    resize?.observe(box)
    const table = box.querySelector('table')
    if (table) resize?.observe(table)
    const mutation = typeof MutationObserver === 'function' ? new MutationObserver(schedule) : null
    mutation?.observe(box, { childList: true, subtree: true })
    window.addEventListener('resize', schedule)
    return () => {
      if (frame) cancelAnimationFrame(frame)
      resize?.disconnect()
      mutation?.disconnect()
      window.removeEventListener('resize', schedule)
    }
  }, [rows, rowSelector])
  return <div ref={boxRef} className="home-ap-scroll" tabIndex={0} role="region" aria-label={label}>{children}</div>
}
function MoreLink({ count, limit = PREVIEW, onClick }) {
  return count > limit ? <button type="button" aria-haspopup="dialog" onClick={onClick} className="home-more">Vedi tutti ({count})</button> : null
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
  const [showAll, setShowAll] = useState(false)
  const renderMeeting = item => {
        const id = String(item._id)
        const selected = favorites.includes(id)
        const name = item.nome || item.label || item.titolo || 'Meeting'
        return <div key={id} className="flex items-center gap-2 py-2"><Link to={`/dashboard/${encodeURIComponent(id)}`} className="min-w-0 flex-1 text-sm font-medium break-words hover:text-primary">{name}</Link><button type="button" aria-label={`${selected ? 'Rimuovi' : 'Aggiungi'} ${name} ${selected ? 'dai' : 'ai'} preferiti`} aria-pressed={selected} onClick={() => toggle(id)} className={`p-2 rounded hover:bg-gray-50 ${selected ? 'text-amber-700' : 'text-gray-400'}`}><Star size={17} fill={selected ? 'currentColor' : 'none'} /></button></div>
      }
  return <div>
    {configuring && <input type="search" aria-label="Cerca meeting" placeholder="Cerca meeting" value={query} onChange={event => setQuery(event.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm mb-2" />}
    {saveError && <p role="alert" className="text-xs text-red-700">Preferiti non salvati nel browser.</p>}
    {!visible.length ? <Empty>{configuring ? 'Nessun meeting trovato.' : 'Nessun meeting preferito.'}</Empty> : <div className={configuring ? 'divide-y max-h-80 overflow-y-auto' : 'divide-y'}>{(configuring ? visible : visible.slice(0, PREVIEW)).map(renderMeeting)}</div>}
    {!configuring && <MoreLink count={visible.length} onClick={() => setShowAll(true)} />}
    {showAll && <HomeListModal title="Meeting preferiti" items={visible} getText={item => [item.nome, item.label, item.titolo]} renderItem={renderMeeting} emptyText="Nessun meeting preferito." onClose={() => setShowAll(false)} />}
  </div>
}

function ListModal({ title, searchLabel, query, onQuery, onClose, wide, children }) {
  const dialogRef = useRef(null)
  const id = useId()
  useEffect(() => {
    const dialog = dialogRef.current
    const previousFocus = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.showModal()
    return () => {
      dialog.close()
      document.body.style.overflow = previousOverflow
      previousFocus?.focus?.()
    }
  }, [])
  return createPortal(<dialog ref={dialogRef} aria-labelledby={`${id}-title`} onCancel={event => { event.preventDefault(); onClose() }} onClick={event => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose() } }} className={`lpw-reading-history${wide ? ' is-wide' : ''}`}>
    <style>{`.lpw-reading-history{width:min(760px,calc(100% - 32px));max-height:85dvh;padding:0;border:1px solid #c9bbaa;border-radius:12px;background:#fff;color:#30271e;box-shadow:0 18px 60px #0003;overflow:hidden}.lpw-reading-history::backdrop{background:rgba(0,0,0,.45)}.lpw-reading-history .reading-shell{display:flex;flex-direction:column;max-height:85dvh}.lpw-reading-history .reading-header{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:20px 24px;border-bottom:1px solid #e5dcd1}.lpw-reading-history .reading-search{padding:16px 24px}.lpw-reading-history .reading-list{overflow-y:auto;padding:0 24px 20px;min-height:0}.lpw-reading-history .reading-row{display:flex;align-items:center;gap:16px;padding:14px 0;border-bottom:1px solid #eee7df;text-decoration:none;color:inherit}.lpw-reading-history .reading-row:hover{background:#faf8f5}.lpw-reading-history button:focus-visible,.lpw-reading-history a:focus-visible,.lpw-reading-history input:focus-visible{outline:2px solid #806342;outline-offset:3px}@media(max-width:520px){.lpw-reading-history .reading-row{align-items:flex-start;flex-direction:column;gap:5px}.lpw-reading-history .reading-header{padding:16px}.lpw-reading-history .reading-search{padding:12px 16px}.lpw-reading-history .reading-list{padding:0 16px 16px}}.lpw-reading-history.is-wide{width:min(1100px,calc(100% - 32px))}.lpw-reading-history .reading-list{overflow-x:auto}@media(max-width:520px){.lpw-reading-history,.lpw-reading-history.is-wide{width:100%;max-width:100%;height:100dvh;max-height:100dvh;margin:0;border:0;border-radius:0}.lpw-reading-history .reading-shell{height:100dvh;max-height:100dvh}}`}</style>
    <div className="reading-shell">
      <div className="reading-header"><h2 id={`${id}-title`} className="text-lg font-semibold">{title}</h2><button type="button" onClick={onClose} className="text-sm px-3 py-2 rounded border border-gray-300">Chiudi</button></div>
      {onQuery && <div className="reading-search"><label className="block text-xs text-gray-500 mb-1" htmlFor={`${id}-search`}>{searchLabel}</label><input autoFocus id={`${id}-search`} type="search" value={query} onChange={event => onQuery(event.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>}
      <div className="reading-list">{children}</div>
    </div>
  </dialog>, document.body)
}

function ReadingHistoryModal({ readings, error, onRetry, onClose }) {
  const [query, setQuery] = useState('')
  const visible = readings.filter(item => [item.document_number, item.document_title].filter(Boolean).join(' ').toLowerCase().includes(query.trim().toLowerCase())).sort((a, b) => (Date.parse(b.confirmed_at) || 0) - (Date.parse(a.confirmed_at) || 0))
  return <ListModal title="Storico letture" searchLabel="Cerca per codice o titolo" query={query} onQuery={setQuery} onClose={onClose}>
    {error ? <LoadError onRetry={onRetry} /> : !visible.length ? <Empty>{query.trim() ? 'Nessuna lettura trovata.' : 'Nessuna lettura confermata.'}</Empty> : visible.map((item, index) => <Link key={item._id || `${item.document_id}:${item.version}:${index}`} to={`/da-leggere?opl=${encodeURIComponent(item.document_id)}`} onClick={onClose} className="reading-row"><div className="min-w-0 flex-1"><div className="text-xs text-gray-500">{item.document_number} · v{item.version}</div><div className="text-sm font-medium break-words">{item.document_title}</div></div><span className="text-xs text-gray-500 whitespace-nowrap">Letta il {formatDate(item.confirmed_at)}</span></Link>)}
  </ListModal>
}

function HomeListModal({ title, items, getText, renderItem, emptyText, onClose }) {
  const [query, setQuery] = useState('')
  const text = query.trim().toLowerCase()
  const visible = items.filter(item => !text || getText(item).filter(Boolean).join(' ').toLowerCase().includes(text))
  return <ListModal title={title} searchLabel="Cerca" query={query} onQuery={setQuery} onClose={onClose}>
    <div className="lpw-home">{!visible.length ? <Empty>{text ? 'Nessun risultato.' : emptyText}</Empty> : <div className="divide-y">{visible.map(renderItem)}</div>}</div>
  </ListModal>
}

function ActionPlanListModal({ title, plans, statiConfig, onSelect, onClose }) {
  const [query, setQuery] = useState('')
  const text = query.trim().toLowerCase()
  const visible = plans.filter(ap => !text || [ap.numero, ap.titolo].filter(Boolean).join(' ').toLowerCase().includes(text))
  return <ListModal wide title={title} searchLabel="Cerca per numero o titolo" query={query} onQuery={setQuery} onClose={onClose}>
    <div className="lpw-home"><ActionPlanViews plans={visible} statiConfig={statiConfig} onSelectAP={onSelect} readOnly showKanban={false} showCalendar={false} showCollegato emptyMessage="Nessun piano d’azione." /></div>
  </ListModal>
}

function getOplCategory(document, categories = []) {
  const value = document.document_category
  if (typeof value !== 'string' || !value.trim()) return ''
  const key = value.trim()
  const category = categories.find(item => [item._id, item.id, item.codice, item.label].some(candidate => candidate != null && String(candidate).trim().toLowerCase() === key.toLowerCase()))
  return category?.label || key
}
