import React, { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../services/api'
import { CheckCircle2, FileText, Eye, X } from 'lucide-react'

export default function OplReadPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.get('/opl-letture/da-leggere')
      setItems(res.data?.items || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    const oplId = searchParams.get('opl')
    if (!oplId) return

    const openOpl = async () => {
      try {
        const res = await api.get(`/documenti/${oplId}`)
        setSelected(res.data)
      } catch (err) {
        console.error(err)
      }
    }

    openOpl()
  }, [searchParams])

  const closePanel = () => {
    setSelected(null)
    if (searchParams.get('opl')) {
      setSearchParams({}, { replace: true })
    }
  }

  const openDocumento = async documentoId => {
    try {
      const res = await api.get(`/documenti/${documentoId}`)
      setSelected(res.data)
    } catch (err) {
      alert('Errore apertura documento: ' + (err.response?.data?.detail || err.message))
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">
          OPL da leggere
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Documenti assegnati che richiedono la tua conferma di lettura.
        </p>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl shadow p-12 text-center text-gray-400">
          Caricamento...
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-xl shadow p-12 text-center">
          <CheckCircle2 size={40} className="mx-auto text-green-500 mb-3" />
          <div className="text-lg font-semibold text-gray-700">
            Nessuna OPL da leggere
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Hai confermato tutte le letture assegnate.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map(item => (
            <div
              key={item._id}
              className="bg-white rounded-xl shadow border-l-4 border-yellow-500 p-5"
            >
              <div className="flex items-center gap-2 mb-2">
                <FileText size={18} className="text-yellow-600" />
                <span className="font-mono text-xs font-bold text-primary">
                  {item.document_number}
                </span>
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                  v{item.version}
                </span>
              </div>

              <h3 className="font-semibold text-gray-800 mb-3">
                {item.document_title}
              </h3>

              {item.scadenza && (
                <div className="text-xs text-gray-500 mb-3">
                  Scadenza: {new Date(item.scadenza).toLocaleDateString('it-IT')}
                </div>
              )}

              <button
                type="button"
                onClick={() => openDocumento(item.document_id)}
                className="w-full bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-light flex items-center justify-center gap-2"
              >
                <Eye size={16} />
                Apri e conferma
              </button>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <OplConfirmModal
          documento={selected}
          onClose={closePanel}
          onConfirmed={() => {
            closePanel()
            load()
          }}
        />
      )}
    </div>
  )
}

function OplConfirmModal({ documento, onClose, onConfirmed }) {
  const [confirming, setConfirming] = useState(false)
  const [blobUrl, setBlobUrl] = useState(null)
  const [quiz, setQuiz] = useState(null)
  const [testOpen, setTestOpen] = useState(false)
  const [answers, setAnswers] = useState([])
  const [result, setResult] = useState(null)

  useEffect(() => {
    let cancelled = false
    api.get(`/opl-letture/${documento._id}/quiz`)
      .then(res => { if (!cancelled) setQuiz(res.data?.domande?.length ? res.data : null) })
      .catch(() => { if (!cancelled) setQuiz(null) })
    return () => { cancelled = true }
  }, [documento._id])

  useEffect(() => {
    let url = null
    let cancelled = false

    const loadFile = async () => {
      if (!documento.file_id) return
      try {
        const res = await api.get(`/documenti/${documento._id}/file`, {
          responseType: 'blob',
        })
        if (cancelled) return
        url = URL.createObjectURL(res.data)
        setBlobUrl(url)
      } catch (err) {
        console.error(err)
      }
    }

    loadFile()

    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [documento._id, documento.file_id])

  const conferma = async () => {
    if (quiz && answers.length !== quiz.domande.length) {
      alert('Rispondi a tutte le domande')
      return
    }
    setConfirming(true)
    try {
      const res = await api.post(`/opl-letture/${documento._id}/conferma`, {
        confirmation_text: 'Confermo di aver letto e compreso',
        risposte: quiz ? answers : [],
      })
      if (res.data?.confermata === false) {
        setResult(res.data.test)
        return
      }
      alert(res.data?.test ? `Test superato (${res.data.test.punteggio}%). Lettura confermata.` : 'Lettura confermata.')
      onConfirmed()
    } catch (err) {
      alert('Errore conferma: ' + (err.response?.data?.detail || err.message))
    } finally {
      setConfirming(false)
    }
  }

  const oplData = documento.opl_data || {}
  const isImage = documento.file_content_type?.startsWith('image/')
  const isPdf = documento.file_name?.toLowerCase().endsWith('.pdf')

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-4xl h-[92vh] flex flex-col shadow-2xl">
        <div className="bg-primary text-white px-6 py-3 rounded-t-xl flex justify-between items-center">
          <div className="min-w-0">
            <div className="font-semibold truncate">
              {documento.numero} - {documento.titolo}
            </div>
            <div className="text-xs opacity-80">
              Versione {documento.versione} · {documento.stato}
            </div>
          </div>
          <button onClick={onClose} className="hover:bg-primary-light p-1.5 rounded">
            <X size={20} />
          </button>
        </div>

        {testOpen && quiz ? (
          <div className="flex-1 overflow-auto bg-white p-6">
            <div className="max-w-2xl mx-auto space-y-5">
              <p className="text-sm text-gray-600">Rispondi alle domande. Serve almeno il {quiz.soglia}% di risposte corrette.</p>
              {quiz.domande.map((domanda, index) => (
                <fieldset key={index} className="border border-gray-200 rounded-lg p-4">
                  <legend className="px-1 text-sm font-semibold text-gray-800">{index + 1}. {domanda.testo}</legend>
                  <div className="mt-2 space-y-2">
                    {domanda.risposte.map((risposta, choice) => (
                      <label key={choice} className="flex items-start gap-2 text-sm cursor-pointer">
                        <input
                          type="radio"
                          name={`q${index}`}
                          checked={answers[index] === choice}
                          onChange={() => { setResult(null); setAnswers(current => { const next = [...current]; next[index] = choice; return next }) }}
                          className="mt-0.5"
                        />
                        {risposta}
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}
              {result && (
                <div role="alert" className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800">
                  Test non superato: {result.corrette} risposte corrette su {result.totale} ({result.punteggio}%). Rileggi il documento e riprova.
                </div>
              )}
            </div>
          </div>
        ) : (
        <div className="flex-1 overflow-auto bg-gray-100 p-6">
          {blobUrl && isPdf && React.createElement('iframe', {
            src: blobUrl,
            className: 'w-full h-full border-0 bg-white',
            title: documento.titolo,
          })}

          {blobUrl && isImage && (
            <div className="flex items-center justify-center">
              {React.createElement('img', {
                src: blobUrl,
                alt: documento.titolo,
                className: 'max-w-full max-h-[70vh] object-contain',
              })}
            </div>
          )}

          {(oplData.problema || oplData.causa || oplData.miglioramento) && (
            <div className="max-w-3xl mx-auto mt-4 space-y-3">
              {oplData.problema && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="font-bold text-red-800 text-sm mb-1">Problema</div>
                  <div className="text-sm text-red-900 whitespace-pre-wrap">{oplData.problema}</div>
                </div>
              )}
              {oplData.causa && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <div className="font-bold text-orange-800 text-sm mb-1">Causa</div>
                  <div className="text-sm text-orange-900 whitespace-pre-wrap">{oplData.causa}</div>
                </div>
              )}
              {oplData.miglioramento && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="font-bold text-green-800 text-sm mb-1">Miglioramento</div>
                  <div className="text-sm text-green-900 whitespace-pre-wrap">{oplData.miglioramento}</div>
                </div>
              )}
            </div>
          )}

          {!blobUrl && !oplData.problema && !oplData.causa && !oplData.miglioramento && (
            <div className="text-center text-gray-400 py-12">
              Nessuna anteprima disponibile. Conferma la lettura dopo aver consultato il documento.
            </div>
          )}
        </div>
        )}

        <div className="border-t bg-white px-6 py-4 flex items-center justify-between gap-4">
          <div className="text-xs text-gray-500">
            La conferma sarà registrata con utente, data, ora e versione.
          </div>

          {quiz && !testOpen ? (
            <button
              type="button"
              onClick={() => { setTestOpen(true); setResult(null) }}
              className="bg-primary text-white px-6 py-2.5 rounded-lg font-medium hover:bg-primary-light flex items-center gap-2 whitespace-nowrap"
            >
              Vai al test ({quiz.domande.length} domande)
            </button>
          ) : (
            <div className="flex gap-2">
              {testOpen && (
                <button type="button" onClick={() => setTestOpen(false)} className="px-4 py-2.5 border rounded-lg text-sm">
                  Rileggi il documento
                </button>
              )}
              <button
                type="button"
                onClick={conferma}
                disabled={confirming}
                className="bg-green-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
              >
                <CheckCircle2 size={18} />
                {confirming ? 'Registrazione...' : testOpen ? 'Invia test e conferma' : 'Confermo di aver letto e compreso'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
