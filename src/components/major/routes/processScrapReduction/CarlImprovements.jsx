import { useEffect, useRef, useState } from 'react'
import api from '../../../../services/api'

const field = 'w-full border rounded px-3 py-2 text-sm bg-white'

function roots(analysis) {
  const result = []
  const walk = node => {
    if (node.is_root_cause && node.root_cause_stato === 'confermata') result.push(node)
    ;(node.children || []).forEach(walk)
  }
  Object.values(analysis?.rami || {}).forEach(branch => {
    if (Array.isArray(branch)) branch.forEach(walk)
  })
  return result
}

export default function CarlImprovements({ items, anomalies, analyses, major, onChange, onPersist }) {
  const [draft, setDraft] = useState({ anomaly: '', cause: '', proposta: '', origine: 'sug', priorita: 'media' })
  const [showForm, setShowForm] = useState(false)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [states, setStates] = useState({})
  const [detail, setDetail] = useState(null)
  const lock = useRef(false)
  const latest = useRef(items)
  latest.current = items
  const ids = items.map(item => item.carl?.id).filter(Boolean).join('|')

  const refresh = async () => {
    if (!ids) return
    try {
      const response = await api.post('/carl/stati', { ids: ids.split('|') })
      setStates(response.data?.items || {})
    } catch {
      setError('Aggiornamento CARL non riuscito: gli stati mostrati possono non essere aggiornati.')
    }
  }

  useEffect(() => { refresh() }, [ids])

  const add = () => {
    const anomaly = anomalies.find(item => item.id === draft.anomaly)
    const cause = roots(analyses[draft.anomaly]).find(item => item.id === draft.cause)
    if (!anomaly || !cause || !draft.proposta.trim()) return
    onChange([...items, {
      id: crypto.randomUUID(),
      anomaly_id: anomaly.id,
      anomalia: anomaly.descrizione,
      cause_id: cause.id,
      causa: cause.label,
      proposta: draft.proposta.trim(),
      origine: draft.origine,
      priorita: draft.priorita,
      carl: null,
    }])
    setDraft(current => ({ ...current, proposta: '' }))
    setShowForm(false)
  }

  const send = async item => {
    if (lock.current || item.carl || item.invii_bloccati) return
    if (!window.confirm('Creare una richiesta reale in CARL, destinata a GTOSI? Le foto non saranno inviate.')) return
    lock.current = true
    setBusy(item.id)
    setError('')
    let attempted = false
    let created = null
    try {
      const blocked = latest.current.map(row => row.id === item.id ? { ...row, invii_bloccati: true } : row)
      await onPersist(blocked)
      attempted = true
      const response = await api.post('/carl/cartellini', {
        titolo: item.proposta.slice(0, 300),
        descrizione: `Anomalia: ${item.anomalia}\nCausa verificata: ${item.causa}`,
        proposta: item.proposta,
        origine: item.origine,
        priorita: item.priorita,
        riferimento: `${major?.numero || major?._id || ''} - Fase 4 - ${item.id}`,
      })
      created = response.data
      if (!created?.id) throw new Error('Risposta CARL senza identificativo')
      const next = blocked.map(row => row.id === item.id ? { ...row, carl: created } : row)
      onChange(next)
      await onPersist(next)
    } catch (err) {
      const message = created?.id
        ? `Richiesta creata: ${created.codice || created.id}. Salvataggio LPW da verificare. Non reinviare.`
        : attempted
          ? 'Esito invio da verificare in CARL prima di riprovare. Il reinvio automatico è bloccato per evitare doppioni.'
          : 'Salvataggio LPW non riuscito: nessuna richiesta inviata a CARL.'
      setError(message + ' ' + (err.response?.data?.detail || err.message || ''))
    } finally {
      lock.current = false
      setBusy('')
    }
  }

  const open = async item => {
    try {
      const response = await api.get(`/carl/cartellini/${item.carl.id}`)
      setDetail(response.data)
    } catch {
      setError('Impossibile leggere lo storico CARL.')
    }
  }

  const causes = roots(analyses[draft.anomaly])
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 md:p-5 space-y-3">
      <h3 className="bg-primary text-white text-center py-2 rounded-lg font-bold">MIGLIORAMENTI CARL</h3>
      <p className="text-sm text-gray-600">Inserisci il miglioramento e invialo a CARL. Lo stato si aggiorna da CARL.</p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" disabled={Boolean(busy)} onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">+ Aggiungi miglioramento</button>
        {ids && <button type="button" disabled={Boolean(busy)} onClick={refresh} className="rounded border border-gray-300 px-3 py-1.5 text-xs hover:bg-gray-50">Aggiorna stati</button>}
      </div>
      <details className="text-xs text-gray-500"><summary className="cursor-pointer">Limiti del test CARL</summary><p className="mt-1">Destinatario GTOSI. Foto conservate in LPW, non inviate. Linea e macchina non collegate automaticamente da questa sezione.</p></details>
      {showForm && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onKeyDown={event => { if (event.key === 'Escape') setShowForm(false) }}>
        <div role="dialog" aria-modal="true" aria-label="Aggiungi miglioramento CARL" className="w-full max-w-2xl rounded-xl bg-white shadow-xl">
          <div className="flex items-center justify-between rounded-t-xl bg-primary px-5 py-3 text-white"><h2 className="font-semibold">Aggiungi miglioramento CARL</h2><button type="button" aria-label="Chiudi" onClick={() => setShowForm(false)} className="rounded px-2 py-1 hover:bg-white/10">×</button></div>
          <div className="max-h-[75vh] overflow-y-auto p-5 space-y-3">
      <div className="grid gap-2 md:grid-cols-2">
        <label className="text-sm">Anomalia
          <select className={field} value={draft.anomaly} onChange={event => setDraft({ ...draft, anomaly: event.target.value, cause: '' })}>
            <option value="">Seleziona anomalia</option>
            {anomalies.map(item => <option key={item.id} value={item.id}>{item.descrizione}</option>)}
          </select>
        </label>
        <label className="text-sm">Causa verificata
          <select className={field} value={draft.cause} onChange={event => setDraft({ ...draft, cause: event.target.value })}>
            <option value="">Seleziona causa confermata</option>
            {causes.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
        <label className="text-sm">Origine CARL
          <select className={field} value={draft.origine} onChange={event => setDraft({ ...draft, origine: event.target.value })}>
            <option value="sug">SUG</option><option value="sug_minipillar">SUG - Minipillar</option>
          </select>
        </label>
        <label className="text-sm">Priorità
          <select className={field} value={draft.priorita} onChange={event => setDraft({ ...draft, priorita: event.target.value })}>
            <option value="bassa">Bassa</option><option value="media">Media</option><option value="alta">Alta</option><option value="urgente">Urgente</option>
          </select>
        </label>
      </div>
      <label className="block text-sm">Miglioramento proposto
        <textarea className={field} rows={3} maxLength={4000} value={draft.proposta} onChange={event => setDraft({ ...draft, proposta: event.target.value })} />
      </label>
      {!causes.length && draft.anomaly && <p className="text-xs text-amber-800">Conferma una causa nei 5 Perché per aggiungere il miglioramento.</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setShowForm(false)} className="rounded border border-gray-300 px-3 py-2 text-sm">Annulla</button>
        <button type="button" disabled={Boolean(busy) || !draft.cause || !draft.proposta.trim()} onClick={add} className="bg-primary text-white rounded px-4 py-2 text-sm disabled:opacity-50">Salva miglioramento</button>
      </div>
      <p className="text-xs text-gray-500">Il salvataggio crea una bozza LPW. L’invio a CARL si conferma dal riepilogo.</p>
          </div>
        </div>
      </div>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {items.length === 0 ? <p className="p-4 text-center text-sm text-gray-400">Nessun miglioramento inserito.</p> : <div className="overflow-x-auto">
        <table className="w-full min-w-[850px] text-sm">
          <thead><tr className="text-left text-gray-600 border-b">
            <th className="p-2 font-medium">Miglioramento</th>
            <th className="p-2 font-medium">Anomalia / causa</th>
            <th className="p-2 font-medium">Origine / priorità</th>
            <th className="p-2 font-medium">Cartellino CARL</th>
            <th className="p-2 font-medium">Stato</th>
          </tr></thead>
          <tbody>{items.map(item => {
            const current = states[item.carl?.id] || item.carl
            const badge = { REQUEST: 'bg-amber-100 text-amber-800', AWAITINGREAL: 'bg-blue-100 text-blue-800', FINISHED: 'bg-green-100 text-green-800', CLOSED: 'bg-gray-200 text-gray-700', DENIED: 'bg-red-100 text-red-700' }
            return <tr key={item.id} className="border-b align-top">
              <td className="p-2 font-medium text-gray-800 whitespace-pre-wrap break-words">{item.proposta}</td>
              <td className="p-2 text-xs"><div>{item.anomalia}</div><div className="mt-1 text-gray-500">Causa: {item.causa}</div></td>
              <td className="p-2 text-xs"><div>{item.origine === 'sug' ? 'SUG' : 'SUG - Minipillar'}</div><div className="mt-1 text-gray-500 capitalize">{item.priorita}</div></td>
              <td className="p-2">{current ? <button type="button" onClick={() => open(item)} className="font-mono text-xs font-semibold text-primary hover:underline">{current.codice || item.carl?.codice || 'Apri cartellino'}</button> : item.invii_bloccati ? <span className="text-xs text-amber-800">Verifica esito in CARL. Non reinviare.</span> : <div className="flex flex-wrap gap-2">
                <button type="button" disabled={Boolean(busy)} onClick={() => send(item)} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">{busy === item.id ? 'Invio...' : 'Invia a CARL · GTOSI'}</button>
                <button type="button" disabled={Boolean(busy)} onClick={() => onChange(items.filter(row => row.id !== item.id))} className="rounded border border-gray-300 px-3 py-1.5 text-xs hover:bg-gray-50">Rimuovi bozza</button>
              </div>}</td>
              <td className="p-2">{current ? <span className={`inline-block rounded px-1.5 py-0.5 text-xs ${badge[current.stato] || 'bg-gray-100 text-gray-700'}`}>{current.stato_label || item.carl?.stato_label || 'Stato non disponibile'}</span> : <span className="text-xs text-amber-700">{item.invii_bloccati ? 'Esito da verificare' : 'Da inviare'}</span>}</td>
            </tr>
          })}</tbody>
        </table>
      </div>}
      {detail && (
        <section aria-label="Storico CARL" className="border rounded p-3 space-y-2">
          <div className="flex justify-between"><strong>{detail.codice} · {detail.stato_label}</strong><button type="button" onClick={() => setDetail(null)}>Chiudi</button></div>
          <p className="text-sm">{detail.testo}</p>
          {(detail.storico || []).map((row, index) => <p key={index} className="text-xs">{row.data ? new Date(row.data).toLocaleString('it-IT') : ''} · {row.stato_label} {row.commento}</p>)}
        </section>
      )}
    </div>
  )
}
