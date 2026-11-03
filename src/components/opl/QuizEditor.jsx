import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import api from '../../services/api'

export default function QuizEditor({ documentoId, onSaved }) {
  const [domande, setDomande] = useState([])
  const [soglia, setSoglia] = useState(80)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    api.get(`/opl-letture/${documentoId}/quiz/completo`)
      .then(response => {
        if (cancelled) return
        setDomande((response.data?.domande || []).map(domanda => ({
          ...domanda,
          risposte: [...domanda.risposte, '', '', ''].slice(0, Math.max(3, domanda.risposte.length)),
        })))
        setSoglia(response.data?.soglia || 80)
      })
      .catch(() => { if (!cancelled) setDomande([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [documentoId])

  const aggiorna = (index, patch) => setDomande(current => current.map((domanda, i) => (i === index ? { ...domanda, ...patch } : domanda)))
  const aggiornaRisposta = (index, choice, value) => setDomande(current => current.map((domanda, i) => (
    i === index ? { ...domanda, risposte: domanda.risposte.map((risposta, c) => (c === choice ? value : risposta)) } : domanda
  )))

  const salva = async () => {
    setSaving(true)
    try {
      await api.put(`/opl-letture/${documentoId}/quiz`, {
        soglia: Number(soglia) || 80,
        domande: domande.map(domanda => {
          const risposte = domanda.risposte.map(risposta => risposta.trim())
          const piene = risposte.filter(Boolean)
          return { testo: domanda.testo, risposte: piene, corretta: piene.indexOf(risposte[domanda.corretta]) }
        }),
      })
      onSaved?.()
    } catch (err) {
      alert('Errore salvataggio test: ' + (err.response?.data?.detail || err.message))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-sm text-gray-400">Caricamento test...</p>

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">Il test vale per le prossime letture: chi ha già confermato non deve ripeterlo.</p>
        <label className="text-xs text-gray-600 flex items-center gap-1">
          Soglia
          <input type="number" min="1" max="100" value={soglia} onChange={event => setSoglia(event.target.value)} className="w-16 border rounded px-2 py-1" />%
        </label>
      </div>
      {domande.map((domanda, index) => (
        <div key={index} className="border rounded-lg p-3 space-y-2 bg-white">
          <div className="flex gap-2">
            <input
              value={domanda.testo}
              onChange={event => aggiorna(index, { testo: event.target.value })}
              placeholder={`Domanda ${index + 1}`}
              className="flex-1 border rounded px-2 py-1.5 text-sm"
            />
            <button type="button" aria-label="Elimina domanda" onClick={() => setDomande(current => current.filter((_, i) => i !== index))} className="p-1.5 text-red-600 hover:bg-red-50 rounded"><Trash2 size={15} /></button>
          </div>
          {domanda.risposte.map((risposta, choice) => (
            <label key={choice} className="flex items-center gap-2 text-sm">
              <input type="radio" name={`quiz-${documentoId}-${index}`} checked={domanda.corretta === choice} onChange={() => aggiorna(index, { corretta: choice })} title="Risposta corretta" />
              <input
                value={risposta}
                onChange={event => aggiornaRisposta(index, choice, event.target.value)}
                placeholder={`Risposta ${choice + 1}`}
                className="flex-1 border rounded px-2 py-1 text-sm"
              />
            </label>
          ))}
          {domanda.risposte.length < 4 && (
            <button type="button" onClick={() => aggiorna(index, { risposte: [...domanda.risposte, ''] })} className="text-xs text-primary hover:underline">+ risposta</button>
          )}
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setDomande(current => [...current, { testo: '', risposte: ['', '', ''], corretta: 0 }])}
          className="inline-flex items-center gap-1 rounded-lg border border-primary px-3 py-1.5 text-sm font-semibold text-primary hover:bg-gray-50"
        >
          <Plus size={14} /> Aggiungi domanda
        </button>
        <button type="button" onClick={salva} disabled={saving} className="rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
          {saving ? 'Salvataggio...' : 'Salva test'}
        </button>
      </div>
    </div>
  )
}
