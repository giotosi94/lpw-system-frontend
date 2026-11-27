import { useEffect, useState } from 'react'

export default function TextBlock({ config = {}, onSave, disabled = false }) {
  const { titolo, contenuto } = config
  const text = contenuto ?? ''
  const [draft, setDraft] = useState(text)
  const [error, setError] = useState(false)
  const [pending, setPending] = useState(false)

  useEffect(() => { setDraft(text); setError(false) }, [text])

  async function submit(event) {
    event.preventDefault()
    if (!onSave || disabled || pending || draft === text) return
    setPending(true)
    setError(false)
    try { setError(!(await onSave({ contenuto: draft }))) }
    catch { setError(true) }
    finally { setPending(false) }
  }

  return (
    <div className="flex h-full flex-col overflow-auto rounded-xl bg-white p-4 shadow">
      {titolo && <h3 className="mb-2 border-b pb-2 font-bold">{titolo}</h3>}
      {onSave ? (
        <form className="widget-action-btn flex min-h-0 flex-1 flex-col gap-2" onSubmit={submit}>
          <textarea aria-label={titolo || 'Memo'} value={draft} onChange={event => setDraft(event.target.value)} readOnly={pending} placeholder="Scrivi una nota..." className="min-h-[3rem] flex-1 resize-none rounded-md border px-2 py-1.5 text-sm text-gray-700" />
          <div className="flex flex-wrap items-center justify-end gap-2">
            {error && <span role="alert" className="mr-auto text-xs text-red-700">Memo non salvato. Riprova.</span>}
            <button type="submit" disabled={disabled || pending || draft === text} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">{pending ? 'Salvataggio...' : 'Salva'}</button>
          </div>
        </form>
      ) : <div className="whitespace-pre-wrap text-sm text-gray-700">{text}</div>}
    </div>
  )
}
