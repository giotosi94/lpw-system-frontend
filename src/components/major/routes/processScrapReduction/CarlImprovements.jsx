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
    <div className="border rounded-lg p-4 space-y-3 bg-white">
      <h4 className="font-semibold text-sm">Suggerimenti manutenzione CARL</h4>
      <p className="text-xs text-gray-600">Test in produzione: destinatario GTOSI. Foto conservate in LPW, non inviate. Linea e macchina non sono ancora collegate automaticamente da questa sezione.</p>
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
      <button type="button" disabled={Boolean(busy) || !draft.cause || !draft.proposta.trim()} onClick={add} className="border rounded px-3 py-2 text-sm disabled:opacity-50">Aggiungi miglioramento</button>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <ul className="divide-y">
        {items.map(item => {
          const current = states[item.carl?.id] || item.carl
          return (
            <li key={item.id} className="py-3 space-y-1">
              <div className="text-xs text-gray-500">{item.origine === 'sug' ? 'SUG' : 'SUG - Minipillar'} · {item.anomalia}</div>
              <div className="text-xs">Causa: {item.causa}</div>
              <div className="text-sm whitespace-pre-wrap">{item.proposta}</div>
              {current ? (
                <button type="button" onClick={() => open(item)} className="text-sm text-primary underline">{current.codice} · {current.stato_label}</button>
              ) : item.invii_bloccati ? (
                <p className="text-xs text-amber-800">Invio avviato: verificare esito in CARL. Non reinviare.</p>
              ) : (
                <div className="flex gap-2">
                  <button type="button" disabled={Boolean(busy)} onClick={() => send(item)} className="bg-primary text-white rounded px-3 py-1.5 text-sm disabled:opacity-50">{busy === item.id ? 'Invio...' : 'Invia a CARL · GTOSI'}</button>
                  <button type="button" disabled={Boolean(busy)} onClick={() => onChange(items.filter(row => row.id !== item.id))} className="border rounded px-3 py-1.5 text-sm">Rimuovi bozza</button>
                </div>
              )}
            </li>
          )
        })}
      </ul>
      {ids && <button type="button" onClick={refresh} className="border rounded px-3 py-1.5 text-sm">Aggiorna stati</button>}
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
