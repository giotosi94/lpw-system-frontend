import { useEffect, useMemo, useState } from 'react'
import { Plus, Send, Trash2, X } from 'lucide-react'
import api from '../../services/api'

export default function OplPublishModal({ documento, onClose, onPublished }) {
  const [reparti, setReparti] = useState([])
  const [repartiSelezionati, setRepartiSelezionati] = useState([])
  const [lineeSelezionate, setLineeSelezionate] = useState([])
  const [scadenza, setScadenza] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState([])
  const [persone, setPersone] = useState([])
  const [cercaPersona, setCercaPersona] = useState('')
  const [domande, setDomande] = useState([])
  const [soglia, setSoglia] = useState(80)

  useEffect(() => {
    api.get('/users/')
      .then(response => setUsers((response.data || []).filter(user => user.is_active !== false && user.attivo !== false)))
      .catch(() => setUsers([]))
    api.get(`/opl-letture/${documento._id}/quiz/completo`)
      .then(response => {
        setDomande((response.data?.domande || []).map(domanda => ({ ...domanda, risposte: [...domanda.risposte, '', '', ''].slice(0, Math.max(3, domanda.risposte.length)) })))
        setSoglia(response.data?.soglia || 80)
      })
      .catch(() => setDomande([]))
  }, [documento._id])

  const userId = user => String(user._id || user.id)
  const userName = user => user.full_name || user.name || user.username || user.email
  const risultatiPersone = cercaPersona.trim().length < 2 ? [] : users
    .filter(user => !persone.some(item => item.id === userId(user)))
    .filter(user => `${userName(user)} ${user.email || ''} ${user.reparto || ''}`.toLowerCase().includes(cercaPersona.trim().toLowerCase()))
    .slice(0, 8)

  const aggiornaDomanda = (index, patch) => setDomande(current => current.map((domanda, i) => (i === index ? { ...domanda, ...patch } : domanda)))
  const aggiornaRisposta = (index, choice, value) => setDomande(current => current.map((domanda, i) => (
    i === index ? { ...domanda, risposte: domanda.risposte.map((risposta, c) => (c === choice ? value : risposta)) } : domanda
  )))

  useEffect(() => {
    api
      .get('/reparti/')
      .then(response => setReparti((response.data || []).filter(reparto => reparto.attivo !== false)))
      .catch(error => {
        console.error(error)
        setReparti([])
      })
      .finally(() => setLoading(false))
  }, [])

  const lineeDisponibili = useMemo(() => {
    return reparti
      .filter(reparto => repartiSelezionati.includes(reparto.nome))
      .flatMap(reparto =>
        (reparto.linee || [])
          .filter(linea => linea.attivo !== false)
          .map(linea => ({
            id: `${reparto.nome}::${linea.nome}`,
            reparto: reparto.nome,
            nome: linea.nome,
          }))
      )
  }, [reparti, repartiSelezionati])

  const toggleReparto = repartoNome => {
    setRepartiSelezionati(current => {
      const selected = current.includes(repartoNome)
      const next = selected
        ? current.filter(nome => nome !== repartoNome)
        : [...current, repartoNome]

      if (selected) {
        const lineeDelReparto = new Set(
          lineeDisponibili
            .filter(linea => linea.reparto === repartoNome)
            .map(linea => linea.nome)
        )
        setLineeSelezionate(currentLinee =>
          currentLinee.filter(nome => !lineeDelReparto.has(nome))
        )
      }

      return next
    })
  }

  const toggleLinea = lineaNome => {
    setLineeSelezionate(current =>
      current.includes(lineaNome)
        ? current.filter(nome => nome !== lineaNome)
        : [...current, lineaNome]
    )
  }

  const pubblica = async () => {
    if (repartiSelezionati.length === 0 && persone.length === 0) {
      alert('Seleziona almeno un reparto o una persona')
      return
    }

    if (!scadenza) {
      alert('Inserisci la scadenza di lettura')
      return
    }

    setPublishing(true)

    try {
      await api.put(`/opl-letture/${documento._id}/quiz`, {
        soglia: Number(soglia) || 80,
        domande: domande.map(domanda => {
          const risposte = domanda.risposte.map(risposta => risposta.trim())
          const piene = risposte.filter(Boolean)
          return { testo: domanda.testo, risposte: piene, corretta: piene.indexOf(risposte[domanda.corretta]) }
        }),
      })
      const repartiConLinee = new Set(lineeDisponibili.filter(linea => lineeSelezionate.includes(linea.nome)).map(linea => linea.reparto))
      const response = await api.post(`/opl-letture/${documento._id}/pubblica`, {
        user_ids: persone.map(item => item.id),
        reparti: repartiSelezionati.filter(nome => !repartiConLinee.has(nome)),
        linee: lineeSelezionate,
        macchine: [],
        ruoli: [],
        scadenza: new Date(`${scadenza}T23:59:59`).toISOString(),
      })

      alert(
        `${documento.tipo || 'OPL'} pubblicata. Assegnazioni create: ${response.data?.assegnazioni_create || 0}`
      )
      onPublished?.()
      onClose()
    } catch (error) {
      alert(
        'Errore pubblicazione: ' +
        (error.response?.data?.detail || error.message)
      )
    } finally {
      setPublishing(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden">
        <div className="bg-primary text-white px-5 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">Pubblica e assegna</h2>
            <p className="text-xs text-white text-opacity-80 mt-1">
              {documento.numero} · {documento.titolo} · v{documento.versione || 1}
            </p>
          </div>

          <button type="button" onClick={onClose} disabled={publishing}>
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-gray-700">
                Reparti
              </label>
              <span className="text-xs text-gray-500">
                {repartiSelezionati.length} selezionati
              </span>
            </div>

            {loading ? (
              <div className="text-sm text-gray-400 py-4">Caricamento reparti...</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {reparti.map(reparto => (
                  <label
                    key={reparto._id || reparto.nome}
                    className={`flex items-center gap-3 border rounded-lg px-3 py-2.5 cursor-pointer ${
                      repartiSelezionati.includes(reparto.nome)
                        ? 'border-primary bg-blue-50'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={repartiSelezionati.includes(reparto.nome)}
                      onChange={() => toggleReparto(reparto.nome)}
                    />
                    <span className="text-sm font-medium">{reparto.nome}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {repartiSelezionati.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <label className="text-sm font-semibold text-gray-700">
                    Linee
                  </label>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Opzionale. Se scegli una linea, il documento va solo a quella linea e non a tutto il reparto.
                  </p>
                </div>
                <span className="text-xs text-gray-500">
                  {lineeSelezionate.length} selezionate
                </span>
              </div>

              <div className="space-y-3">
                {repartiSelezionati.map(repartoNome => {
                  const lineeReparto = lineeDisponibili.filter(
                    linea => linea.reparto === repartoNome
                  )

                  if (lineeReparto.length === 0) return null

                  return (
                    <div key={repartoNome} className="border rounded-lg p-3">
                      <div className="text-xs font-bold text-gray-600 uppercase mb-2">
                        {repartoNome}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {lineeReparto.map(linea => (
                          <label
                            key={linea.id}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border cursor-pointer text-xs ${
                              lineeSelezionate.includes(linea.nome)
                                ? 'bg-primary text-white border-primary'
                                : 'bg-white text-gray-600 border-gray-200'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={lineeSelezionate.includes(linea.nome)}
                              onChange={() => toggleLinea(linea.nome)}
                              className="hidden"
                            />
                            {linea.nome}
                          </label>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-gray-700">Singole persone</label>
              <span className="text-xs text-gray-500">{persone.length} selezionate</span>
            </div>
            {persone.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {persone.map(persona => (
                  <span key={persona.id} className="inline-flex items-center gap-1 bg-gray-100 border rounded px-2 py-1 text-xs">
                    {persona.nome}
                    <button type="button" aria-label={`Rimuovi ${persona.nome}`} onClick={() => setPersone(current => current.filter(item => item.id !== persona.id))} className="text-gray-500 hover:text-red-600"><X size={12} /></button>
                  </span>
                ))}
              </div>
            )}
            <div className="relative">
              <input
                value={cercaPersona}
                onChange={event => setCercaPersona(event.target.value)}
                placeholder="Cerca nome o email"
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
              {risultatiPersone.length > 0 && (
                <ul className="absolute z-10 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border bg-white shadow-lg">
                  {risultatiPersone.map(user => (
                    <li key={userId(user)}>
                      <button
                        type="button"
                        onClick={() => { setPersone(current => [...current, { id: userId(user), nome: userName(user) }]); setCercaPersona('') }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                      >
                        {userName(user)} <span className="text-xs text-gray-500">{user.reparto || ''}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <label className="text-sm font-semibold text-gray-700">Test di comprensione</label>
                <p className="text-xs text-gray-500 mt-0.5">Facoltativo. Se presente, la lettura è confermata solo superando il test.</p>
              </div>
              {domande.length > 0 && (
                <label className="text-xs text-gray-600 flex items-center gap-1">
                  Soglia
                  <input type="number" min="1" max="100" value={soglia} onChange={event => setSoglia(event.target.value)} className="w-16 border rounded px-2 py-1" />%
                </label>
              )}
            </div>
            <div className="space-y-3">
              {domande.map((domanda, index) => (
                <div key={index} className="border rounded-lg p-3 space-y-2">
                  <div className="flex gap-2">
                    <input
                      value={domanda.testo}
                      onChange={event => aggiornaDomanda(index, { testo: event.target.value })}
                      placeholder={`Domanda ${index + 1}`}
                      className="flex-1 border rounded px-2 py-1.5 text-sm"
                    />
                    <button type="button" aria-label="Elimina domanda" onClick={() => setDomande(current => current.filter((_, i) => i !== index))} className="p-1.5 text-red-600 hover:bg-red-50 rounded"><Trash2 size={15} /></button>
                  </div>
                  {domanda.risposte.map((risposta, choice) => (
                    <label key={choice} className="flex items-center gap-2 text-sm">
                      <input type="radio" name={`corretta-${index}`} checked={domanda.corretta === choice} onChange={() => aggiornaDomanda(index, { corretta: choice })} title="Risposta corretta" />
                      <input
                        value={risposta}
                        onChange={event => aggiornaRisposta(index, choice, event.target.value)}
                        placeholder={`Risposta ${choice + 1}`}
                        className="flex-1 border rounded px-2 py-1 text-sm"
                      />
                    </label>
                  ))}
                  {domanda.risposte.length < 4 && (
                    <button type="button" onClick={() => aggiornaDomanda(index, { risposte: [...domanda.risposte, ''] })} className="text-xs text-primary hover:underline">+ risposta</button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => setDomande(current => [...current, { testo: '', risposte: ['', '', ''], corretta: 0 }])}
                className="inline-flex items-center gap-1 rounded-lg border border-primary px-3 py-1.5 text-sm font-semibold text-primary hover:bg-gray-50"
              >
                <Plus size={14} /> Aggiungi domanda
              </button>
              <p className="text-xs text-gray-500">Seleziona il pallino accanto alla risposta corretta.</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Scadenza lettura *
            </label>
            <input
              type="date"
              value={scadenza}
              onChange={event => setScadenza(event.target.value)}
              min={new Date().toISOString().slice(0, 10)}
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>
        </div>

        <div className="bg-gray-50 border-t px-5 py-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={publishing}
            className="px-4 py-2 border rounded-lg text-sm"
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={pubblica}
            disabled={publishing || loading}
            className="px-5 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-light disabled:opacity-50 flex items-center gap-2"
          >
            <Send size={16} />
            {publishing ? 'Pubblicazione...' : 'Pubblica e assegna'}
          </button>
        </div>
      </div>
    </div>
  )
}
