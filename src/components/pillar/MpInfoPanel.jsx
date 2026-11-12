import { useEffect, useRef, useState } from 'react'
import api from '../../services/api'
import MpInfoDetails from './MpInfoDetails'
const states = ['Da esaminare', 'In valutazione', 'Accolta', 'Non accolta']
export default function MpInfoPanel({ pillar }) {
  const [items, setItems] = useState([])
  const [allowed, setAllowed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('')
  const [selected, setSelected] = useState(null)
  const [status, setStatus] = useState('Da esaminare')
  const [note, setNote] = useState('')
  const request = useRef(0)
  const lock = useRef(false)
  const load = async () => {
    const version = ++request.current
    setLoading(true)
    try {
      const response = await api.get('/mp-info/', { params: { pillar_id: pillar._id } })
      if (version !== request.current) return
      setItems(response.data.items || [])
      setAllowed(Boolean(response.data.can_review))
      setError('')
    } catch (failure) { if (version === request.current) setError(typeof failure.response?.data?.detail === 'string' ? failure.response.data.detail : 'MP Info non disponibili: riprova.') }
    finally { if (version === request.current) setLoading(false) }
  }
  useEffect(() => { setSelected(null); load(); return () => { request.current += 1 } }, [pillar._id])
  const open = item => { setSelected(item); setStatus(item.status); setNote(item.review_note || ''); setError('') }
  const save = async event => {
    event.preventDefault()
    if (lock.current) return
    lock.current = true
    setBusy(true)
    try {
      const response = await api.patch(`/mp-info/${selected._id}/review`, { status, note: note.trim(), revision: selected.revision })
      setItems(current => current.map(item => item._id === response.data._id ? response.data : item))
      setSelected(null)
      setError('')
    } catch (failure) { setError(typeof failure.response?.data?.detail === 'string' ? failure.response.data.detail : 'Valutazione non salvata: riprova.') }
    finally { lock.current = false; setBusy(false) }
  }
  const visible = items.filter(item => !filter || item.status === filter)
  return <section className="bg-white rounded-xl border p-4 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold">MP Info</h3><p className="text-sm text-gray-500">Apprendimenti dai progetti da considerare sulle future macchine.</p></div><button type="button" disabled={loading} onClick={load} className="border rounded px-3 py-2 text-sm">Aggiorna</button></div>
    {!pillar.mp_info_enabled && <p className="text-sm text-amber-800">Nuovi invii disabilitati nei Settings. Lo storico rimane consultabile.</p>}
    <label className="block text-sm">Stato<select className="border rounded px-3 py-2 ml-2" value={filter} onChange={event => setFilter(event.target.value)}><option value="">Tutti</option>{states.map(value => <option key={value}>{value}</option>)}</select></label>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {loading ? <p role="status" className="text-sm text-gray-500">Caricamento...</p> : !visible.length ? <p className="text-sm text-gray-500 py-6 text-center">Nessuna MP Info da mostrare.</p> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-2">Proposta</th><th className="p-2">Origine</th><th className="p-2">Stato</th><th className="p-2">Data</th><th className="p-2">Dettaglio</th></tr></thead><tbody>{visible.map(item => <tr key={item._id} className="border-b"><td className="p-2 font-medium">{item.title}</td><td className="p-2">{item.major_label}<span className="block text-xs text-gray-500">{[item.line, item.machine].filter(Boolean).join(' / ')}</span></td><td className="p-2">{item.status}</td><td className="p-2">{new Date(item.created_at).toLocaleDateString('it-IT')}</td><td className="p-2"><button type="button" onClick={() => open(item)} className="text-primary underline">Apri</button></td></tr>)}</tbody></table></div>}
    {selected && <MpInfoDetails item={selected} onClose={() => { if (!busy) setSelected(null) }}>{allowed ? <form onSubmit={save} className="border-t pt-3 space-y-3"><fieldset disabled={busy} className="space-y-3"><label className="block text-sm">Valutazione<select className="w-full border rounded p-2" value={status} onChange={event => setStatus(event.target.value)}>{states.map(value => <option key={value}>{value}</option>)}</select></label><label className="block text-sm">Nota<textarea className="w-full border rounded p-2" rows={3} maxLength={5000} required={['Accolta', 'Non accolta'].includes(status)} value={note} onChange={event => setNote(event.target.value)} /></label>{error && <p role="alert" className="text-sm text-red-700">{error}</p>}<button type="submit" disabled={['Accolta', 'Non accolta'].includes(status) && !note.trim()} className="bg-primary text-white rounded px-4 py-2 text-sm disabled:opacity-50">{busy ? 'Salvataggio...' : 'Salva valutazione'}</button></fieldset></form> : <p className="text-xs text-gray-500">Valutazione riservata al leader, ai membri del pilastro e agli amministratori.</p>}</MpInfoDetails>}
  </section>
}
