import { useEffect, useMemo, useState } from 'react'
import api from '../../services/api'

const latestValue = kpi => (kpi.values || []).slice().sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')))[0] || null

export default function HoshinKpiTab({ pillar, focusId }) {
  const [items, setItems] = useState([])
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ period: '2026 YTD', value: '', note: '' })
  const [saving, setSaving] = useState(false)
  const load = () => api.get('/pillars/hoshin?year=2026').then(res => setItems((res.data || []).filter(k => String(k.pillar_sigla).toUpperCase() === String(pillar.sigla).toUpperCase())))
  useEffect(() => { load() }, [pillar.sigla])
  useEffect(() => { if (focusId && items.some(k => k._id === focusId)) setEditing(focusId) }, [focusId, items])
  const selected = useMemo(() => items.find(k => k._id === editing), [items, editing])
  const save = async () => {
    if (!selected || form.value === '') return
    setSaving(true)
    try { await api.post(`/pillars/hoshin/kpis/${selected._id}/values`, { ...form, value: Number(form.value) }); setForm({ period: '2026 YTD', value: '', note: '' }); await load() }
    catch (err) { alert(err.response?.data?.detail || err.message) }
    finally { setSaving(false) }
  }
  if (!items.length) return <div className="rounded-xl border bg-white p-8 text-center text-sm text-gray-500">Nessun KPI Hoshin collegato al Pillar {pillar.sigla}.</div>
  return <div className="space-y-4">
    <div className="overflow-hidden rounded-xl border bg-white"><table className="w-full text-sm"><thead className="border-b bg-gray-50 text-left text-xs text-gray-500"><tr><th className="px-4 py-2">KPI</th><th className="px-4 py-2">KMI</th><th className="px-4 py-2">Owner</th><th className="px-4 py-2">Ultimo valore</th><th className="px-4 py-2">Target</th><th className="px-4 py-2"></th></tr></thead><tbody>{items.map(kpi => { const latest=latestValue(kpi); return <tr key={kpi._id} className="border-b last:border-0"><td className="px-4 py-3 font-medium">{kpi.name}</td><td className="px-4 py-3 text-gray-600">{kpi.kmi}</td><td className="px-4 py-3 text-gray-600">{kpi.owner || '—'}</td><td className="px-4 py-3">{latest ? `${latest.value} ${kpi.unit}` : '—'}</td><td className="px-4 py-3">{kpi.target} {kpi.unit}</td><td className="px-4 py-3 text-right"><button type="button" onClick={() => setEditing(kpi._id)} className="text-primary hover:underline">Aggiorna</button></td></tr>})}</tbody></table></div>
    {selected && <section className="rounded-xl border bg-white p-4">
      <div className="mb-3 flex items-center justify-between"><div><div className="text-xs uppercase text-gray-500">Aggiorna valore</div><h3 className="font-semibold">{selected.name}</h3></div><button type="button" onClick={() => setEditing(null)} className="text-sm text-gray-500">Chiudi</button></div>
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_2fr_auto] sm:items-end"><label className="text-sm">Periodo<input value={form.period} onChange={e=>setForm({...form,period:e.target.value})} className="mt-1 w-full rounded-lg border px-3 py-2"/></label><label className="text-sm">Valore ({selected.unit})<input type="number" step="0.01" value={form.value} onChange={e=>setForm({...form,value:e.target.value})} className="mt-1 w-full rounded-lg border px-3 py-2"/></label><label className="text-sm">Nota<input value={form.note} onChange={e=>setForm({...form,note:e.target.value})} className="mt-1 w-full rounded-lg border px-3 py-2"/></label><button type="button" disabled={saving || form.value === ''} onClick={save} className="rounded-lg bg-primary px-4 py-2 text-sm text-white disabled:opacity-50">Salva</button></div>
      {(selected.values || []).length > 0 && <div className="mt-4 border-t pt-3"><div className="mb-2 text-xs font-semibold uppercase text-gray-500">Storico</div><div className="space-y-1">{selected.values.slice().reverse().map(v=><div key={v.id} className="grid grid-cols-[110px_90px_1fr] gap-3 text-sm"><span className="text-gray-500">{v.period}</span><strong>{v.value} {selected.unit}</strong><span className="text-gray-600">{v.note || '—'}</span></div>)}</div></div>}
    </section>}
  </div>
}
