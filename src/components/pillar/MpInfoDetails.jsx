import { Link } from 'react-router-dom'
const base = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/api\/?$/, '')
const fileUrl = value => {
  if (!value) return ''
  try {
    const parsed = new URL(value, 'https://local.invalid')
    if (!['http:', 'https:'].includes(parsed.protocol) || !/^\/(api\/)?uploads\//.test(parsed.pathname) || parsed.pathname.includes('..')) return ''
    return `${base}${parsed.pathname}${parsed.search}`
  } catch { return '' }
}
const date = value => value ? new Date(value).toLocaleString('it-IT') : '—'
export default function MpInfoDetails({ item, onClose, children }) {
  return <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"><div role="dialog" aria-modal="true" aria-label="Dettaglio MP Info" className="bg-white rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-5 space-y-4">
    <div className="flex justify-between gap-3"><h3 className="font-bold text-lg">{item.title}</h3><button type="button" aria-label="Chiudi dettaglio" onClick={onClose} className="border rounded px-3 py-1 self-start">Chiudi</button></div>
    <p className="text-sm"><strong>{item.status}</strong> · {item.pillar_label}</p>
    <Link to={`/major-kaizen/${item.major_id}`} className="text-sm text-primary underline">{item.major_label || 'Apri progetto di origine'}</Link>
    <p className="text-sm text-gray-600">{[item.department, item.line, item.machine].filter(Boolean).join(' / ')}</p>
    <div className="text-sm"><strong>Soluzione applicata</strong><p className="whitespace-pre-wrap">{item.solution}</p></div>
    <div className="text-sm"><strong>Apprendimento per le future macchine</strong><p className="whitespace-pre-wrap">{item.learning}</p></div>
    {(item.documents || []).length > 0 && <div className="text-sm"><strong>Standard collegati all’invio</strong>{item.documents.map((doc, index) => <p key={doc.id || index}>{doc.label || doc.id}</p>)}<p className="text-xs text-gray-500">Apri il progetto per consultare i documenti e le revisioni correnti.</p></div>}
    {(item.attachments || []).length > 0 && <div className="space-y-1 text-sm"><strong>Allegati</strong>{item.attachments.map((file, index) => fileUrl(file.url) ? <a key={index} className="block text-primary underline" href={fileUrl(file.url)} target="_blank" rel="noreferrer">{file.filename || 'Allegato'}</a> : <p key={index}>Collegamento allegato non valido</p>)}</div>}
    {item.review_note && <div className="text-sm"><strong>Ultima valutazione</strong><p className="whitespace-pre-wrap">{item.review_note}</p></div>}
    {children}
    <details className="border-t pt-3 text-xs"><summary className="cursor-pointer">Storico ({(item.history || []).length})</summary>{(item.history || []).map((entry, index) => <div key={index} className="border-t py-2 mt-2"><strong>{entry.status}</strong> · {entry.actor?.name} · {date(entry.at)}<p className="whitespace-pre-wrap">{entry.note}</p></div>)}</details>
  </div></div>
}
