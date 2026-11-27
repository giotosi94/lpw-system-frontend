import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Target } from 'lucide-react'
import api from '../services/api'

const YEAR = 2026
const latestValue = kpi => (kpi.values || []).slice().sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')))[0] || null
const status = kpi => {
  const latest = latestValue(kpi)
  if (!latest) return { label: 'Non rilevato', cls: 'bg-gray-100 text-gray-600' }
  const ok = kpi.direction === 'lower' ? latest.value <= kpi.target : latest.value >= kpi.target
  return ok ? { label: 'In target', cls: 'bg-green-100 text-green-700' } : { label: 'Fuori target', cls: 'bg-red-100 text-red-700' }
}

export default function HoshinPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [pillars, setPillars] = useState([])
  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [h, p] = await Promise.all([api.get(`/pillars/hoshin?year=${YEAR}`), api.get('/pillars/?attivo=true')])
      setItems(h.data || [])
      setPillars(p.data || [])
    } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])
  const groups = useMemo(() => Object.entries(items.reduce((acc, item) => {
    ;(acc[item.kmi] ||= []).push(item); return acc
  }, {})), [items])
  const pillarBySigla = sigla => pillars.find(p => String(p.sigla || '').toUpperCase() === String(sigla || '').toUpperCase())
  const seed = async () => {
    setSeeding(true)
    try { await api.post('/pillars/hoshin/seed-pilot'); await load() }
    catch (err) { alert(err.response?.data?.detail || err.message) }
    finally { setSeeding(false) }
  }

  return <div className="mx-auto max-w-6xl space-y-4">
    <button type="button" onClick={() => navigate('/pillars')} className="flex items-center gap-1 text-sm text-gray-600 hover:text-primary"><ArrowLeft size={16}/> Pillars</button>
    <header className="rounded-xl bg-primary px-5 py-4 text-white">
      <div className="text-xs text-white/70">Induno · {YEAR}</div>
      <h1 className="text-2xl font-bold">Hoshin Kanri</h1>
      <p className="mt-1 text-sm text-white/80">KMI → KPI → Pillar. Pilota con inserimento manuale dei valori.</p>
    </header>
    {loading ? <div className="rounded-xl bg-white p-10 text-center text-gray-400">Caricamento...</div> : items.length === 0 ? (
      <div className="rounded-xl border bg-white p-8 text-center">
        <Target className="mx-auto mb-2 text-primary" size={30}/><h2 className="font-semibold">Pilota non inizializzato</h2>
        <p className="mb-4 text-sm text-gray-500">Crea i due KPI E2E di OTIF Domestic per provare il flusso.</p>
        <button type="button" disabled={seeding} onClick={seed} className="rounded-lg bg-primary px-4 py-2 text-sm text-white disabled:opacity-50">{seeding ? 'Creazione...' : 'Inizializza pilota E2E'}</button>
      </div>
    ) : groups.map(([kmi, kpis]) => <section key={kmi} className="overflow-hidden rounded-xl border bg-white">
      <div className="border-b bg-gray-50 px-4 py-3"><div className="text-xs uppercase text-gray-500">KMI Operations</div><h2 className="font-semibold">{kmi}</h2></div>
      <div className="divide-y">{kpis.map(kpi => { const latest=latestValue(kpi), st=status(kpi), pillar=pillarBySigla(kpi.pillar_sigla); return <Link key={kpi._id} to={pillar ? `/pillars/${pillar._id}?tab=hoshin&kpi=${kpi._id}` : '#'} className="grid gap-2 px-4 py-3 hover:bg-gray-50 sm:grid-cols-[1.4fr_.5fr_.6fr_.6fr_.6fr] sm:items-center">
        <div><div className="font-medium text-gray-900">{kpi.name}</div><div className="text-xs text-gray-500">Owner: {kpi.owner || '—'}</div></div>
        <div className="text-sm font-semibold text-primary">{kpi.pillar_sigla}</div>
        <div className="text-sm"><span className="text-gray-500">Ultimo </span>{latest ? `${latest.value} ${kpi.unit}` : '—'}</div>
        <div className="text-sm"><span className="text-gray-500">Target </span>{kpi.target} {kpi.unit}</div>
        <div><span className={`rounded-full px-2 py-1 text-xs font-medium ${st.cls}`}>{st.label}</span></div>
      </Link>})}</div>
    </section>)}
  </div>
}
