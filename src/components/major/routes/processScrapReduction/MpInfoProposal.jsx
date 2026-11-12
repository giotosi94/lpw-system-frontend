import { useEffect, useRef, useState } from 'react'
import api from '../../../../services/api'
import MpInfoDetails from '../../../pillar/MpInfoDetails'

const field = 'w-full border border-gray-300 rounded px-3 py-2 text-sm bg-white'
const blank = () => ({ standard_id: '', pillar_id: '', title: '', learning: '', attachments: [] })
const message = error => typeof error.response?.data?.detail === 'string' ? error.response.data.detail : error.message || 'Operazione non riuscita'

export default function MpInfoProposal({ major, standards = [], beforeSend }) {
  const [recipients, setRecipients] = useState([])
  const [items, setItems] = useState([])
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(blank)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const uploadLock = useRef(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [selected, setSelected] = useState(null)
  const lock = useRef(false)
  const request = useRef(0)
  const load = async () => {
    if (!major?._id) return
    const version = ++request.current
    setLoading(true)
    try {
      const [targets, proposals] = await Promise.all([api.get('/mp-info/recipients'), api.get('/mp-info/', { params: { major_id: major._id } })])
      if (version !== request.current) return
      setRecipients(targets.data || [])
      setItems(proposals.data.items || [])
      setError('')
    } catch (failure) { if (version === request.current) setError(message(failure)) }
    finally { if (version === request.current) setLoading(false) }
  }
  useEffect(() => { load(); return () => { request.current += 1 } }, [major?._id])
  const solutions = standards.filter(row => String(row.improvement || row.change || '').trim())
  const choose = id => {
    const row = solutions.find(item => item.id === id)
    setDraft(current => ({ ...current, standard_id: id, title: String(row?.improvement || row?.change || '').slice(0, 180) }))
  }
  const start = () => {
    const row = solutions.length === 1 ? solutions[0] : null
    setDraft({ ...blank(), standard_id: row?.id || '', title: String(row?.improvement || row?.change || '').slice(0, 180), pillar_id: recipients.length === 1 ? recipients[0].id : '' })
    setError('')
    setNotice('')
    setOpen(true)
  }
  const upload = async event => {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    if (!files.length || uploadLock.current) return
    if (draft.attachments.length + files.length > 20 || files.some(file => file.size > 20 * 1024 * 1024)) {
      setError('Massimo 20 allegati, 20 MB per file.')
      return
    }
    uploadLock.current = true
    setUploading(true)
    setError('')
    try {
      for (const file of files) {
        const data = new FormData()
        data.append('file', file)
        const response = await api.post('/uploads/document', data, { headers: { 'Content-Type': 'multipart/form-data' } })
        const attachment = { filename: response.data.filename || file.name, url: response.data.url, content_type: response.data.content_type || file.type, size: response.data.size || file.size }
        setDraft(current => ({ ...current, attachments: [...current.attachments, attachment] }))
      }
    } catch (failure) { setError(message(failure)) }
    finally { uploadLock.current = false; setUploading(false) }
  }
  const send = async event => {
    event.preventDefault()
    if (lock.current || uploadLock.current) return
    lock.current = true
    setBusy(true)
    setError('')
    try {
      if (!solutions.some(row => row.id === draft.standard_id)) throw new Error('Seleziona una soluzione presente nella Fase 6.')
      await beforeSend()
      await api.post('/mp-info/', { ...draft, major_id: major._id, title: draft.title.trim(), learning: draft.learning.trim() })
      setOpen(false)
      setDraft(blank())
      setNotice('MP Info inviata al pilastro. Nessun Action Plan o saving aggiuntivo creato.')
      await load()
    } catch (failure) { setError(message(failure)) }
    finally { lock.current = false; setBusy(false) }
  }
  const duplicate = items.some(item => item.standard_id === draft.standard_id && item.pillar_id === draft.pillar_id)
  return <section className="rounded-lg border bg-white p-4 space-y-3">
    <h3 className="bg-primary text-white text-center py-2 rounded-lg font-bold">MP INFO · FACOLTATIVE</h3>
    <p className="text-sm text-gray-600">Trasmetti al pilastro un apprendimento da considerare sulle future macchine. Non blocca il Major.</p>
    <div className="flex flex-wrap gap-2 items-center">
      <button type="button" disabled={loading || !major?._id || !solutions.length || !recipients.length} onClick={start} className="bg-primary text-white rounded px-4 py-2 text-sm disabled:opacity-50">Proponi MP Info</button>
      <button type="button" disabled={loading || busy} onClick={load} className="border rounded px-3 py-2 text-sm">Aggiorna</button>
      {!loading && !recipients.length && <span className="text-xs text-amber-800">Abilita MP Info sul pilastro destinatario nei Settings.</span>}
      {!solutions.length && <span className="text-xs text-gray-500">Inserisci prima una soluzione in Standardizzare.</span>}
    </div>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {notice && <p role="status" className="text-sm text-green-800">{notice}</p>}
    {items.length > 0 && <div className="divide-y border rounded">{items.map(item => <button key={item._id} type="button" onClick={() => setSelected(item)} className="w-full text-left p-3 hover:bg-gray-50 flex flex-wrap justify-between gap-2"><span><strong className="text-sm">{item.title}</strong><span className="block text-xs text-gray-500">{item.pillar_label}</span></span><span className="text-xs rounded bg-gray-100 px-2 py-1 self-start">{item.status}</span></button>)}</div>}
    {open && <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"><div role="dialog" aria-modal="true" aria-label="Proponi MP Info" className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-5">
      <h3 className="font-bold mb-3">Proponi MP Info</h3>
      <form onSubmit={send} className="space-y-3"><fieldset disabled={busy || uploading} className="space-y-3">
        <p className="text-xs text-gray-500">{major?.numero} · {major?.titolo} · {[major?.linea, major?.macchina].filter(Boolean).join(' / ')}</p>
        <label className="block text-sm">Soluzione<select required className={field} value={draft.standard_id} onChange={event => choose(event.target.value)}><option value="">Seleziona soluzione</option>{solutions.map(row => <option key={row.id} value={row.id}>{row.improvement || row.change}</option>)}</select></label>
        <label className="block text-sm">Pilastro destinatario<select required className={field} value={draft.pillar_id} onChange={event => setDraft(current => ({ ...current, pillar_id: event.target.value }))}><option value="">Seleziona pilastro</option>{recipients.map(row => <option key={row.id} value={row.id}>{row.label}</option>)}</select></label>
        <label className="block text-sm">Titolo<input required maxLength={180} className={field} value={draft.title} onChange={event => setDraft(current => ({ ...current, title: event.target.value }))} /></label>
        <label className="block text-sm">Cosa prevedere sulle future macchine<textarea required maxLength={5000} rows={3} className={field} value={draft.learning} onChange={event => setDraft(current => ({ ...current, learning: event.target.value }))} /></label>
        <details><summary className="text-sm cursor-pointer">Allegati facoltativi</summary><div className="mt-2 space-y-2">
          <label className="block text-xs">PDF, Word o Excel · massimo 20 MB per file<input type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx" onChange={upload} className="block mt-1 w-full text-sm" /></label>
          {draft.attachments.map((file, index) => <div key={index} className="flex items-center justify-between gap-2 text-xs"><span>{file.filename}</span><button type="button" className="border rounded px-2 py-1" onClick={() => setDraft(current => ({ ...current, attachments: current.attachments.filter((_, position) => position !== index) }))}>Rimuovi</button></div>)}
        </div></details>
        {uploading && <p role="status" className="text-xs text-gray-500">Caricamento allegati...</p>}

        <p className="text-xs text-gray-500">Gli standard collegati alla soluzione vengono riportati nella proposta. Una proposta per soluzione e pilastro.</p>
        {duplicate && <p className="text-sm text-amber-800">Soluzione già proposta a questo pilastro: consulta il riepilogo.</p>}
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2"><button type="button" onClick={() => setOpen(false)} className="border rounded px-3 py-2 text-sm">Annulla</button><button type="submit" disabled={duplicate || !draft.title.trim() || !draft.learning.trim()} className="bg-primary text-white rounded px-4 py-2 text-sm disabled:opacity-50">{busy ? 'Invio...' : 'Invia al pilastro'}</button></div>
      </fieldset></form>
    </div></div>}
    {selected && <MpInfoDetails item={selected} onClose={() => setSelected(null)} />}
  </section>
}
