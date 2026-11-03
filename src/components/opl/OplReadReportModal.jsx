import { useEffect, useMemo, useState } from 'react'
import { Download, RefreshCw, X } from 'lucide-react'
import api from '../../services/api'
import QuizEditor from './QuizEditor'

export default function OplReadReportModal({ documento, onClose }) {
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filterReparto, setFilterReparto] = useState('')
  const [filterStato, setFilterStato] = useState('')
  const [quizOpen, setQuizOpen] = useState(false)

  const loadReport = async () => {
    setLoading(true)
    setError('')

    try {
      const response = await api.get(`/opl-letture/${documento._id}/report`)
      setReport(response.data)
    } catch (loadError) {
      setError(loadError.response?.data?.detail || loadError.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadReport()
  }, [documento._id])

  const reparti = useMemo(() => {
    return [...new Set((report?.righe || []).map(riga => riga.reparto).filter(Boolean))].sort()
  }, [report])

  const righeFiltrate = useMemo(() => {
    return (report?.righe || []).filter(riga => {
      if (filterReparto && riga.reparto !== filterReparto) return false
      if (filterStato && riga.status !== filterStato) return false
      return true
    })
  }, [report, filterReparto, filterStato])

  const formatDate = value => {
    if (!value) return '-'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return '-'
    return date.toLocaleString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const exportExcel = () => {
    const rows = righeFiltrate.map(riga => ({
      Utente: riga.user_name || '',
      Reparto: riga.reparto || '',
      Ruolo: riga.role || '',
      Stato: riga.status || '',
      Assegnata: formatDate(riga.assigned_at),
      Confermata: formatDate(riga.confirmed_at),
      Test: riga.test_punteggio == null ? '' : `${riga.test_punteggio}%`,
      'Verifica in campo': riga.verifica_esito == null ? '' : riga.verifica_esito ? 'Esegue correttamente' : 'Non ancora',
      'Verificato da': riga.verifica_da || '',
    }))

    const headers = Object.keys(rows[0] || {
      Utente: '',
      Reparto: '',
      Ruolo: '',
      Stato: '',
      Assegnata: '',
      Confermata: '',
      Test: '',
      'Verifica in campo': '',
      'Verificato da': '',
    })

    const escapeCsv = value => `"${String(value ?? '').replaceAll('"', '""')}"`
    const csv = [
      headers.map(escapeCsv).join(';'),
      ...rows.map(row => headers.map(header => escapeCsv(row[header])).join(';')),
    ].join('\n')

    const blob = new Blob([`\ufeff${csv}`], {
      type: 'text/csv;charset=utf-8;',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${documento.numero || documento.tipo || 'OPL'}_report_letture.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const riepilogo = report?.riepilogo || {}

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="bg-primary text-white px-6 py-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-bold">Report letture {documento.tipo || 'OPL'}</h2>
            <p className="text-xs text-white text-opacity-80 truncate mt-1">
              {documento.numero} · {documento.titolo} · v{documento.versione || 1}
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded hover:bg-primary-light">
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 p-12 text-center text-gray-400">Caricamento report...</div>
        ) : error ? (
          <div className="flex-1 p-12 text-center">
            <p className="text-red-600 mb-4">{error}</p>
            <button type="button" onClick={loadReport} className="px-4 py-2 bg-primary text-white rounded-lg inline-flex items-center gap-2">
              <RefreshCw size={16} />
              Riprova
            </button>
          </div>
        ) : (
          <>
            <div className="p-5 border-b bg-gray-50">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <SummaryCard label="Destinatari" value={riepilogo.destinatari || 0} color="gray" />
                <SummaryCard label="Confermati" value={riepilogo.confermati || 0} color="green" />
                <SummaryCard label="Da leggere" value={riepilogo.da_leggere || 0} color="yellow" />
                <SummaryCard label="In ritardo" value={riepilogo.in_ritardo || 0} color="red" />
                <SummaryCard label="Completamento" value={`${riepilogo.completamento || 0}%`} color="blue" />
              </div>

              <div className="mt-4 h-2.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all"
                  style={{ width: `${Math.min(100, Math.max(0, riepilogo.completamento || 0))}%` }}
                />
              </div>
            </div>

            <div className="px-5 py-4 border-b flex flex-wrap items-center gap-3">
              <select value={filterReparto} onChange={event => setFilterReparto(event.target.value)} className="border rounded-lg px-3 py-2 text-sm">
                <option value="">Tutti i reparti</option>
                {reparti.map(reparto => <option key={reparto}>{reparto}</option>)}
              </select>

              <select value={filterStato} onChange={event => setFilterStato(event.target.value)} className="border rounded-lg px-3 py-2 text-sm">
                <option value="">Tutti gli stati</option>
                <option value="Confermata">Confermata</option>
                <option value="Da leggere">Da leggere</option>
                <option value="In ritardo">In ritardo</option>
              </select>

              <div className="text-xs text-gray-500 flex-1">
                {righeFiltrate.length} righe visualizzate
              </div>

              <button type="button" onClick={loadReport} className="px-3 py-2 border rounded-lg text-sm flex items-center gap-2 hover:bg-gray-50">
                <RefreshCw size={15} />
                Aggiorna
              </button>

              <button type="button" onClick={() => setQuizOpen(open => !open)} aria-expanded={quizOpen} className="px-3 py-2 border rounded-lg text-sm hover:bg-gray-50">
                {quizOpen ? 'Chiudi test' : 'Modifica test'}
              </button>
              <button type="button" onClick={exportExcel} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm flex items-center gap-2 hover:bg-green-700">
                <Download size={15} />
                Esporta Excel
              </button>
            </div>

            {quizOpen && (
              <div className="px-5 py-4 border-b bg-gray-50">
                <QuizEditor documentoId={documento._id} onSaved={() => { setQuizOpen(false); loadReport() }} />
              </div>
            )}
            <div className="flex-1 overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr className="text-left text-gray-500">
                    <th className="p-3">Utente</th>
                    <th className="p-3">Reparto</th>
                    <th className="p-3">Ruolo</th>
                    <th className="p-3">Assegnata</th>
                    <th className="p-3">Confermata</th>
                    <th className="p-3">Test</th>
                    <th className="p-3">Verifica</th>
                    <th className="p-3">Stato</th>
                  </tr>
                </thead>
                <tbody>
                  {righeFiltrate.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="p-8 text-center text-gray-400">Nessun destinatario trovato.</td>
                    </tr>
                  ) : (
                    righeFiltrate.map((riga, index) => (
                      <tr key={`${riga.user_name || 'utente'}-${index}`} className="border-t hover:bg-gray-50">
                        <td className="p-3 font-medium text-gray-800">{riga.user_name || '-'}</td>
                        <td className="p-3">{riga.reparto || '-'}</td>
                        <td className="p-3 capitalize">{riga.role || '-'}</td>
                        <td className="p-3 text-xs">{formatDate(riga.assigned_at)}</td>
                        <td className="p-3 text-xs">{formatDate(riga.confirmed_at)}</td>
                        <td className="p-3 text-xs">{riga.test_punteggio == null ? '-' : `${riga.test_punteggio}%`}</td>
                        <td className="p-3 text-xs">{riga.verifica_esito == null ? '-' : riga.verifica_esito ? 'Esegue correttamente' : 'Non ancora'}</td>
                        <td className="p-3"><StatusBadge status={riga.status} /></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function SummaryCard({ label, value, color }) {
  const colors = {
    gray: 'bg-white border-gray-200 text-gray-800',
    green: 'bg-green-50 border-green-200 text-green-700',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
    red: 'bg-red-50 border-red-200 text-red-700',
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
  }

  return (
    <div className={`border rounded-lg p-3 ${colors[color] || colors.gray}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs mt-1">{label}</div>
    </div>
  )
}

function StatusBadge({ status }) {
  const colors = {
    Confermata: 'bg-green-100 text-green-700',
    'Da leggere': 'bg-yellow-100 text-yellow-700',
    'In ritardo': 'bg-red-100 text-red-700',
  }

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-700'}`}>
      {status || '-'}
    </span>
  )
}
