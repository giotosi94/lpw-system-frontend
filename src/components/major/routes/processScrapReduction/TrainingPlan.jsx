import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, RefreshCw, Send, Trash2 } from 'lucide-react'
import api from '../../../../services/api'
import OplPublishModal from '../../../opl/OplPublishModal'
import { PreviewModal } from '../../../../pages/DocumentiPage'

const panel = 'bg-white border border-gray-200 rounded-lg p-4 md:p-5'
const heading = 'bg-primary text-white text-center py-2 rounded-lg font-bold mb-4'
const smallButton = 'rounded border border-gray-300 px-3 py-1.5 text-xs hover:bg-gray-50 disabled:opacity-50'

const list = value => (Array.isArray(value) ? value : [])
const shortNumber = value => String(value || '').replace(/^(OPL|SOP)-/i, '')
const pct = (part, total) => (total ? Math.round(part / total * 100) : 0)

function linkedFromPhases(allStepsData) {
  const found = new Map()
  Object.values(allStepsData || {}).forEach(step => {
    list(step?.dati?.anomalie).forEach(anomaly => {
      const docs = list(anomaly.documenti).length
        ? anomaly.documenti
        : anomaly.documento_id ? [{ id: anomaly.documento_id, label: anomaly.documento_label }] : []
      docs.forEach(doc => {
        if (doc?.id && !found.has(doc.id)) found.set(doc.id, { id: doc.id, label: doc.label || '', origine: 'Fase 2' })
      })
    })
    const standards = step?.dati?.standardizzazione_v2
    if (standards?.blocks?.standards?.applicable === false) return
    list(standards?.standards).forEach(row => {
      list(row.documents).forEach(doc => {
        if (doc?.id && !found.has(doc.id)) found.set(doc.id, { id: doc.id, label: doc.label || '', origine: 'Fase 6' })
      })
    })
  })
  return found
}

export default function TrainingPlan({ stepData, onChange, allStepsData }) {
  const [extra, setExtra] = useState(() => list(stepData?.dati?.documenti_extra))
  const [documents, setDocuments] = useState([])
  const [reports, setReports] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [expanded, setExpanded] = useState('')
  const [publishing, setPublishing] = useState(null)
  const [previewDoc, setPreviewDoc] = useState(null)
  const [adding, setAdding] = useState('')
  const [saving, setSaving] = useState('')

  useEffect(() => {
    setExtra(list(stepData?.dati?.documenti_extra))
  }, [stepData?.dati?.documenti_extra])

  const rows = useMemo(() => {
    const found = linkedFromPhases(allStepsData)
    extra.forEach(doc => {
      if (doc?.id && !found.has(doc.id)) found.set(doc.id, { ...doc, origine: 'Aggiunto' })
    })
    return [...found.values()]
  }, [allStepsData, extra])

  const docById = useMemo(() => new Map(documents.map(doc => [doc._id, doc])), [documents])
  const rowKey = rows.map(row => row.id).join('|')

  const loadReport = useCallback(async id => {
    try {
      const response = await api.get(`/opl-letture/${id}/report`)
      setReports(current => ({ ...current, [id]: response.data }))
    } catch {
      setReports(current => ({ ...current, [id]: null }))
    }
  }, [])

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.get('/documenti')
      const loaded = (response.data || []).filter(doc => doc.tipo === 'OPL' || doc.tipo === 'SOP')
      setDocuments(loaded)
      const ids = rowKey ? rowKey.split('|') : []
      const published = ids.filter(id => loaded.find(doc => doc._id === id)?.pubblicata)
      await Promise.all(published.map(loadReport))
    } catch {
      setError('Impossibile caricare i documenti')
    } finally {
      setLoading(false)
    }
  }, [rowKey, loadReport])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const saveExtra = async next => {
    setExtra(next)
    setStatus('Salvataggio...')
    try {
      await onChange({
        dati: { ...(stepData?.dati || {}), documenti_extra: next },
        output_compilati: { documenti_formazione: rows.length > 0 || next.length > 0 },
      })
      setStatus('Salvato')
    } catch {
      setStatus('Errore di salvataggio')
    }
  }

  const addDocument = () => {
    const doc = docById.get(adding)
    if (!doc) return
    setAdding('')
    saveExtra([...extra, { id: doc._id, label: `${doc.tipo} ${shortNumber(doc.numero)} - ${doc.titolo || ''}` }])
  }

  const removeExtra = id => saveExtra(extra.filter(doc => doc.id !== id))

  const setVerifica = async (documentId, userId, esito) => {
    setSaving(`${documentId}|${userId}`)
    try {
      await api.post(`/opl-letture/${documentId}/verifica/${userId}`, { esito, note: '' })
      await loadReport(documentId)
    } catch (err) {
      alert('Errore verifica: ' + (err.response?.data?.detail || err.message))
    } finally {
      setSaving('')
    }
  }

  const totals = rows.reduce((acc, row) => {
    const summary = reports[row.id]?.riepilogo
    if (!summary) return acc
    acc.assegnati += summary.destinatari || 0
    acc.letti += summary.confermati || 0
    acc.verificati += summary.verificati || 0
    return acc
  }, { assegnati: 0, letti: 0, verificati: 0 })

  const labelFor = row => {
    const doc = docById.get(row.id)
    return doc ? `${doc.tipo} ${shortNumber(doc.numero)} - ${doc.titolo || ''}` : row.label || 'Documento non disponibile'
  }

  const available = documents.filter(doc => !rows.some(row => row.id === doc._id))

  return (
    <div className="space-y-6">
      <section className={panel}>
        <h3 className={heading}>FORMAZIONE OPERATORI</h3>
        <p className="text-sm text-gray-600 mb-4">
          Gli OPL e le SOP collegati alle anomalie (fase 2) e ai nuovi standard (fase 6) compaiono qui. Pubblicali, segui le letture e verifica in campo.
        </p>

        {totals.assegnati > 0 && (
          <p className="text-sm text-gray-700 mb-4">
            Assegnazioni <strong>{totals.assegnati}</strong> · Lette <strong>{pct(totals.letti, totals.assegnati)}%</strong> · Verificate in campo <strong>{pct(totals.verificati, totals.assegnati)}%</strong>
          </p>
        )}

        {error && <p role="alert" className="text-sm text-red-700 mb-3">{error}</p>}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="text-left text-gray-600 border-b">
                <th className="p-2 font-medium">Documento</th>
                <th className="p-2 font-medium">Origine</th>
                <th className="p-2 font-medium">Lette</th>
                <th className="p-2 font-medium">Test superato</th>
                <th className="p-2 font-medium">Verificate</th>
                <th className="p-2" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" className="p-6 text-center text-gray-400">Caricamento...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan="6" className="p-6 text-center text-gray-400">Nessun documento collegato nelle fasi 2 e 6.</td></tr>
              ) : rows.map(row => {
                const doc = docById.get(row.id)
                const report = reports[row.id]
                const summary = report?.riepilogo
                const open = expanded === row.id
                return (
                  <TrainingRow
                    key={row.id}
                    label={labelFor(row)}
                    origine={row.origine}
                    doc={doc}
                    summary={summary}
                    open={open}
                    onToggle={() => setExpanded(open ? '' : row.id)}
                    onOpen={() => doc && setPreviewDoc(doc)}
                    onPublish={() => doc && setPublishing(doc)}
                    onRemove={row.origine === 'Aggiunto' ? () => removeExtra(row.id) : null}
                    righe={list(report?.righe)}
                    saving={saving}
                    onVerifica={(userId, esito) => setVerifica(row.id, userId, esito)}
                  />
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <select aria-label="Aggiungi documento" value={adding} onChange={event => setAdding(event.target.value)} className="min-w-0 flex-1 max-w-md border border-gray-300 rounded px-2 py-2 text-sm bg-white">
            <option value="">Aggiungi un altro OPL o SOP</option>
            {available.map(doc => <option key={doc._id} value={doc._id}>{doc.tipo} {shortNumber(doc.numero)} - {doc.titolo}</option>)}
          </select>
          <button type="button" onClick={addDocument} disabled={!adding} className="inline-flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
            <Plus size={16} /> Aggiungi
          </button>
          <button type="button" onClick={loadAll} className={`${smallButton} inline-flex items-center gap-1 ml-auto`}>
            <RefreshCw size={13} /> Aggiorna
          </button>
          {status && <span role="status" className="text-xs text-gray-500">{status}</span>}
        </div>
      </section>

      {publishing && (
        <OplPublishModal
          documento={publishing}
          onClose={() => setPublishing(null)}
          onPublished={loadAll}
        />
      )}
      {previewDoc && <PreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />}
    </div>
  )
}

function TrainingRow({ label, origine, doc, summary, open, onToggle, onOpen, onPublish, onRemove, righe, saving, onVerifica }) {
  const published = Boolean(doc?.pubblicata)
  const total = summary?.destinatari || 0
  const cell = (value, show = true) => (published && show ? `${pct(value, total)}% (${value}/${total})` : '—')
  return (
    <>
      <tr className="border-b align-middle">
        <td className="p-2">
          <button type="button" onClick={onOpen} disabled={!doc} className="text-left font-medium text-primary hover:underline disabled:text-gray-500 disabled:no-underline">{label}</button>
        </td>
        <td className="p-2 text-xs text-gray-500">{origine}</td>
        <td className="p-2">{published ? cell(summary?.confermati || 0) : <span className="text-xs text-amber-700">Non pubblicato</span>}</td>
        <td className="p-2">{cell(summary?.test_superati || 0, summary?.test_presente)}</td>
        <td className="p-2">{cell(summary?.verificati || 0)}</td>
        <td className="p-2">
          <div className="flex justify-end gap-2">
            {doc && (
              <button type="button" onClick={onPublish} className={`${smallButton} inline-flex items-center gap-1`}>
                <Send size={12} /> {published ? 'Aggiungi destinatari' : 'Pubblica'}
              </button>
            )}
            {published && total > 0 && (
              <button type="button" onClick={onToggle} aria-expanded={open} className={smallButton}>{open ? 'Chiudi' : 'Persone'}</button>
            )}
            {onRemove && (
              <button type="button" aria-label="Rimuovi documento" onClick={onRemove} className="p-1.5 text-red-600 hover:bg-red-50 rounded"><Trash2 size={14} /></button>
            )}
          </div>
        </td>
      </tr>
      {open && (
        <tr className="border-b bg-gray-50">
          <td colSpan="6" className="p-3">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-gray-500">
                  <th className="p-1.5">Persona</th>
                  <th className="p-1.5">Reparto</th>
                  <th className="p-1.5">Lettura</th>
                  <th className="p-1.5">Test</th>
                  <th className="p-1.5">Verifica in campo</th>
                </tr>
              </thead>
              <tbody>
                {righe.map(riga => {
                  const busy = saving === `${doc?._id}|${riga.user_id}`
                  return (
                    <tr key={riga.user_id} className="border-t border-gray-200">
                      <td className="p-1.5 font-medium text-gray-800">{riga.user_name || '-'}</td>
                      <td className="p-1.5">{riga.reparto || '-'}</td>
                      <td className="p-1.5">{riga.status}</td>
                      <td className="p-1.5">{riga.test_punteggio == null ? '—' : `${riga.test_punteggio}%${riga.test_tentativi > 1 ? ` · ${riga.test_tentativi} tentativi` : ''}`}</td>
                      <td className="p-1.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button type="button" disabled={busy} aria-pressed={riga.verifica_esito === true} onClick={() => onVerifica(riga.user_id, true)} className={`rounded px-2 py-1 border ${riga.verifica_esito === true ? 'bg-green-600 border-green-600 text-white' : 'border-gray-300 hover:bg-white'}`}>Esegue correttamente</button>
                          <button type="button" disabled={busy} aria-pressed={riga.verifica_esito === false} onClick={() => onVerifica(riga.user_id, false)} className={`rounded px-2 py-1 border ${riga.verifica_esito === false ? 'bg-amber-600 border-amber-600 text-white' : 'border-gray-300 hover:bg-white'}`}>Non ancora</button>
                          {riga.verifica_da && <span className="text-gray-500">{riga.verifica_da}{riga.verifica_at ? ` · ${new Date(riga.verifica_at).toLocaleDateString('it-IT')}` : ''}</span>}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </td>
        </tr>
      )}
    </>
  )
}
