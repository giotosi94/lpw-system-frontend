import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../services/api'
import { AlertTriangle, Leaf, Plus, Eye, X, Send, Trash2, Save, CheckCircle2, Lock, Download } from 'lucide-react'
import ActionPlanFormShared from '../components/ActionPlanFormShared'
import ImageUpload from '../components/ImageUpload'
import DocumentUpload from '../components/DocumentUpload'

const TIPI = [
  { id: 'Sicurezza', label: 'SICUREZZA', Icon: AlertTriangle },
  { id: 'Ambiente', label: 'AMBIENTE', Icon: Leaf },
]

const STATO_BADGE = {
  Bozza: 'bg-gray-100 text-gray-700',
  Aperto: 'bg-blue-100 text-blue-700',
  'In gestione': 'bg-yellow-100 text-yellow-700',
  Chiuso: 'bg-green-100 text-green-700',
}

const STATI_CHIUSI = ['Chiuso', 'Done', 'Completato']

const EXPORT_COLUMNS = [
  { key: 'codice', label: 'Codice' },
  { key: 'tipo', label: 'Tipo' },
  { key: 'stato', label: 'Stato' },
  { key: 'categoria', label: 'Categoria' },
  { key: 'gravita', label: 'Gravita' },
  { key: 'priorita', label: 'Priorita' },
  { key: 'reparto', label: 'Reparto' },
  { key: 'linea', label: 'Linea' },
  { key: 'macchina', label: 'Macchina' },
  { key: 'descrizione', label: 'Descrizione' },
  { key: 'segnalatore_nome', label: 'Segnalatore' },
  { key: 'responsabile_nome', label: 'Responsabile' },
  { key: 'data_evento', label: 'Data evento' },
  { key: 'ora_evento', label: 'Ora evento' },
  { key: 'created_at', label: 'Data creazione' },
  { key: 'data_chiusura', label: 'Data chiusura' },
  { key: 'note_gestione', label: 'Note gestione' },
  { key: 'nota_verifica_efficacia', label: 'Verifica efficacia' },
]

const formatCell = (value, key) => {
  if (value === null || value === undefined) return ''
  if ((key === 'created_at' || key === 'data_chiusura') && value) {
    const d = new Date(value)
    if (!isNaN(d.getTime())) return d.toLocaleString('it-IT')
  }
  return String(value)
}

const escapeCsv = value => {
  const v = formatCell(value.raw, value.key).replace(/\r?\n/g, ' ')
  if (/[";]/.test(v)) return `"${v.replace(/"/g, '""')}"`
  return v
}

const exportSegnalazioniCsv = rows => {
  const header = EXPORT_COLUMNS.map(c => c.label).join(';')
  const body = rows.map(item =>
    EXPORT_COLUMNS.map(c => escapeCsv({ raw: item[c.key], key: c.key })).join(';')
  )
  const csv = '\uFEFF' + [header, ...body].join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const today = new Date().toISOString().slice(0, 10)
  link.href = url
  link.download = `segnalazioni_${today}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export default function SegnalazioniPage() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState(null)
  const [searchParams, setSearchParams] = useSearchParams()

  const savedUser = (() => {
    try { return JSON.parse(localStorage.getItem('user') || '{}') } catch { return {} }
  })()
  const role = String(savedUser.role || savedUser.ruolo || '').toLowerCase()
  const isAdmin = ['admin', 'administrator', 'amministratore'].includes(role)

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.get('/segnalazioni/')
      setItems(res.data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    const newType = searchParams.get('nuova')
    if (['Sicurezza', 'Ambiente'].includes(newType)) {
      setDetail({ _id: null, tipo: newType, stato: 'Bozza', codice: '', segnalatore_nome: '', descrizione: '' })
      setSearchParams({}, { replace: true })
      return
    }
    const openId = searchParams.get('open')
    if (!openId) return
    api.get(`/segnalazioni/${openId}`)
      .then(res => setDetail(res.data))
      .catch(err => console.error('Errore apertura segnalazione da notifica:', err))
      .finally(() => setSearchParams({}, { replace: true }))
  }, [searchParams, setSearchParams])

  const createNew = tipo => {
    setDetail({
      _id: null,
      tipo,
      stato: 'Bozza',
      codice: '',
      segnalatore_nome: '',
      descrizione: '',
    })
  }

  const handleClose = async current => {
    if (current && current._id && current.stato === 'Bozza' && !current.descrizione?.trim()) {
      try {
        await api.delete(`/segnalazioni/${current._id}`)
      } catch (err) {
        console.error('Bozza vuota non eliminata:', err)
      }
    }
    setDetail(null)
    load()
  }

  const byTipo = useMemo(() => {
    const map = { Sicurezza: [], Ambiente: [] }
    items.forEach(item => {
      if (!map[item.tipo]) map[item.tipo] = []
      map[item.tipo].push(item)
    })
    return map
  }, [items])

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Segnalazioni</h1>
          <p className="text-sm text-gray-500">Segnalazioni di sicurezza e ambiente</p>
        </div>
        <button
          type="button"
          onClick={() => exportSegnalazioniCsv(items)}
          disabled={loading || items.length === 0}
          className="flex items-center gap-2 text-sm bg-gray-700 text-white px-3 py-2 rounded-lg font-medium hover:bg-gray-800 disabled:opacity-50"
          title="Scarica le segnalazioni in un file per Excel"
        >
          <Download size={16} /> Scarica Excel
        </button>
      </div>

      <div className="space-y-4">
        {TIPI.map(tipo => {
          const list = byTipo[tipo.id] || []
          const Icon = tipo.Icon
          return (
            <div key={tipo.id} className="bg-white rounded-xl shadow overflow-hidden">
              <div className="bg-gray-700 text-white px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold tracking-wide">
                  <Icon size={18} /> {tipo.label}
                </div>
                <button
                  type="button"
                  onClick={() => createNew(tipo.id)}
                  className="bg-white text-gray-800 px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1 hover:bg-gray-100"
                >
                  <Plus size={16} /> Nuovo
                </button>
              </div>

              <div className="divide-y">
                {loading ? (
                  <div className="p-6 text-center text-gray-400 text-sm">Caricamento...</div>
                ) : list.length === 0 ? (
                  <div className="p-6 text-center text-gray-400 text-sm">Nessuna segnalazione</div>
                ) : (
                  list.map(item => (
                    <div key={item._id} className="px-5 py-3 flex items-center gap-4 hover:bg-gray-50">
                      <span className="font-mono text-sm font-bold text-primary w-20">{item.codice}</span>
                      <span className="flex-1 text-sm text-gray-700 truncate">
                        {item.descrizione || 'Senza descrizione'}
                      </span>
                      {item.reparto && <span className="text-xs text-gray-500 hidden md:block">{item.reparto}</span>}
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATO_BADGE[item.stato] || 'bg-gray-100 text-gray-700'}`}>
                        {item.stato}
                      </span>
                      <button
                        type="button"
                        onClick={() => setDetail(item)}
                        className="text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg text-sm flex items-center gap-1"
                      >
                        <Eye size={15} /> Consulta
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>

      {detail && (
        <SegnalazioneDetail
          segnalazione={detail}
          isAdmin={isAdmin}
          onClose={handleClose}
          onSaved={() => { load() }}
        />
      )}
    </div>
  )
}

function SegnalazioneDetail({ segnalazione, isAdmin, onClose, onSaved }) {
  const [form, setForm] = useState(segnalazione)
  const [reparti, setReparti] = useState([])
  const [saving, setSaving] = useState(false)
  const [chiusuraOpen, setChiusuraOpen] = useState(false)
  const [apList, setApList] = useState([])
  const [apOpen, setApOpen] = useState(0)
  const [showApForm, setShowApForm] = useState(false)
  const [editingAp, setEditingAp] = useState(null)
  const [categorieOptions, setCategorieOptions] = useState([])

  useEffect(() => {
    api.get('/reparti/').then(res => setReparti(res.data || [])).catch(() => {})
  }, [])

  useEffect(() => {
    const tipoConfig = form.tipo === 'Ambiente'
      ? 'categoria_segnalazione_ambiente'
      : 'categoria_segnalazione_sicurezza'
    api.get(`/configurazioni/?tipo=${tipoConfig}&attivo=true`)
      .then(res => setCategorieOptions(res.data || []))
      .catch(() => setCategorieOptions([]))
  }, [form.tipo])

  const loadActionPlans = async () => {
    try {
      const res = await api.get(`/segnalazioni/${form._id}/action-plans`)
      setApList(res.data.items || [])
      setApOpen(res.data.aperti || 0)
    } catch (err) {
      console.error(err)
    }
  }

  const openAp = async apId => {
    try {
      const res = await api.get(`/action-plans/${apId}`)
      setEditingAp(res.data)
    } catch (err) {
      alert('Errore apertura Action Plan: ' + (err.response?.data?.detail || err.message))
    }
  }

  useEffect(() => {
    if (isAdmin && form._id && form.stato !== 'Bozza') loadActionPlans()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form._id, form.stato])

  const isChiuso = form.stato === 'Chiuso'
  const canEdit = !isChiuso || isAdmin

  const lineeAvailable = (reparti.find(r => r.nome === form.reparto)?.linee || [])
  const macchineAvailable = (lineeAvailable.find(l => l.nome === form.linea)?.macchine || [])

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }))

  const buildPayload = () => ({
    tipo: form.tipo,
    data_evento: form.data_evento,
    ora_evento: form.ora_evento,
    reparto: form.reparto,
    linea: form.linea,
    macchina: form.macchina,
    descrizione: form.descrizione,
    persona_coinvolta: form.persona_coinvolta,
    persone_presenti: form.persone_presenti,
    azioni_immediate: form.azioni_immediate,
    azioni_suggerite: form.azioni_suggerite,
    immagini: form.immagini || [],
    allegati: form.allegati || [],
  })

  const save = async () => {
    if (saving) return
    if (!form._id && !form.descrizione?.trim()) {
      alert('Inserisci almeno la descrizione dell evento prima di salvare')
      return
    }
    setSaving(true)
    try {
      let id = form._id
      if (!id) {
        const created = await api.post('/segnalazioni/', { tipo: form.tipo })
        id = created.data._id
      }
      const res = await api.put(`/segnalazioni/${id}`, buildPayload())
      setForm(res.data)
      onSaved()
      alert('Salvato')
    } catch (err) {
      alert('Errore: ' + (err.response?.data?.detail || err.message))
    } finally {
      setSaving(false)
    }
  }

  const termina = async () => {
    if (saving) return
    if (!form.descrizione?.trim()) {
      alert('La descrizione dell evento e obbligatoria')
      return
    }
    setSaving(true)
    try {
      let id = form._id
      if (!id) {
        const created = await api.post('/segnalazioni/', { tipo: form.tipo })
        id = created.data._id
      }
      await api.put(`/segnalazioni/${id}`, buildPayload())
      const res = await api.post(`/segnalazioni/${id}/termina`)
      setForm(res.data)
      onSaved()
      alert('Segnalazione inviata')
    } catch (err) {
      alert('Errore: ' + (err.response?.data?.detail || err.message))
    } finally {
      setSaving(false)
    }
  }

  const classifica = async (field, value) => {
    const next = { ...form, [field]: value }
    setForm(next)
    if (!form._id) return
    try {
      await api.patch(`/segnalazioni/${form._id}/classificazione`, {
        categoria: next.categoria,
        gravita: next.gravita,
        priorita: next.priorita,
        note_gestione: next.note_gestione,
      })
      onSaved()
    } catch (err) {
      console.error(err)
    }
  }

  const setInGestione = async () => {
    try {
      const res = await api.patch(`/segnalazioni/${form._id}/in-gestione`)
      setForm(res.data)
      onSaved()
    } catch (err) {
      alert('Errore: ' + (err.response?.data?.detail || err.message))
    }
  }

  const riapri = async () => {
    try {
      const res = await api.patch(`/segnalazioni/${form._id}/riapri`)
      setForm(res.data)
      onSaved()
    } catch (err) {
      alert('Errore: ' + (err.response?.data?.detail || err.message))
    }
  }

  const elimina = async () => {
    if (!form._id) {
      onClose(null)
      return
    }
    if (!confirm('Eliminare questa segnalazione?')) return
    try {
      await api.delete(`/segnalazioni/${form._id}`)
      onSaved()
      onClose(null)
    } catch (err) {
      alert('Errore: ' + (err.response?.data?.detail || err.message))
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-4xl h-[92vh] flex flex-col overflow-hidden shadow-2xl">
        <div className="bg-gray-700 text-white px-6 py-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-gray-300">Segnalazione di {form.tipo}</div>
            <h2 className="text-lg font-bold">{form.codice ? `Codice ${form.codice}` : 'Nuova segnalazione'}</h2>
          </div>
          <div className="flex items-center gap-2">
            {canEdit && form.stato === 'Bozza' && (
              <>
                <button onClick={save} disabled={saving} className="bg-white text-gray-800 px-3 py-1.5 rounded text-sm flex items-center gap-1 hover:bg-gray-100 disabled:opacity-50">
                  <Save size={15} /> Salva bozza
                </button>
                <button onClick={termina} disabled={saving} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm flex items-center gap-1 hover:bg-blue-700 disabled:opacity-50">
                  <Send size={15} /> Termina inserimento
                </button>
              </>
            )}
            {canEdit && form.stato !== 'Bozza' && (
              <button onClick={save} disabled={saving} className="bg-white text-gray-800 px-3 py-1.5 rounded text-sm flex items-center gap-1 hover:bg-gray-100 disabled:opacity-50">
                <Save size={15} /> Salva
              </button>
            )}
            <button onClick={() => onClose(form)} className="p-1.5 rounded hover:bg-gray-600"><X size={20} /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isChiuso && (
            <div className="bg-green-50 border-l-4 border-green-500 rounded-r-lg p-3 flex items-center gap-3">
              <Lock size={20} className="text-green-600" />
              <div className="flex-1 text-sm">
                <div className="font-bold text-green-900">Segnalazione chiusa</div>
                {form.nota_verifica_efficacia && (
                  <div className="text-green-800 mt-0.5">Verifica efficacia: {form.nota_verifica_efficacia}</div>
                )}
              </div>
              {isAdmin && (
                <button onClick={riapri} className="text-sm border border-green-600 text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-100">Riapri</button>
              )}
            </div>
          )}

          <Section title="DATI RIEPILOGATIVI">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ReadField label="Codice" value={form.codice} />
              <ReadField label="Responsabile segnalazione" value={form.responsabile_nome || '—'} />
              <ReadField label="Segnalazione" value={`Segnalazione di ${form.tipo}`} />
              <ReadField label="Segnalatore" value={form.segnalatore_nome} />
              <ReadField label="Data" value={form.created_at ? new Date(form.created_at).toLocaleString('it-IT') : '—'} />
              <div>
                <FieldLabel>Stato</FieldLabel>
                <span className={`inline-block px-3 py-1.5 rounded text-sm font-medium ${STATO_BADGE[form.stato] || 'bg-gray-100'}`}>{form.stato}</span>
              </div>
              <ReadField label="Data chiusura" value={form.data_chiusura ? new Date(form.data_chiusura).toLocaleString('it-IT') : '—'} />
            </div>
          </Section>

          <Section title="DETTAGLIO DELL'EVENTO">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Data *">
                <input type="date" disabled={!canEdit} value={form.data_evento || ''} onChange={e => set('data_evento', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm disabled:bg-gray-100" />
              </Field>
              <Field label="Ora *">
                <input type="time" disabled={!canEdit} value={form.ora_evento || ''} onChange={e => set('ora_evento', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm disabled:bg-gray-100" />
              </Field>
              <Field label="Reparto *">
                <select disabled={!canEdit} value={form.reparto || ''} onChange={e => setForm(f => ({ ...f, reparto: e.target.value, linea: '', macchina: '' }))} className="w-full border rounded-lg px-3 py-2 text-sm disabled:bg-gray-100">
                  <option value="">Seleziona</option>
                  {reparti.map(r => <option key={r._id} value={r.nome}>{r.nome}</option>)}
                </select>
              </Field>
              <Field label="Linea">
                <select disabled={!canEdit || !form.reparto} value={form.linea || ''} onChange={e => setForm(f => ({ ...f, linea: e.target.value, macchina: '' }))} className="w-full border rounded-lg px-3 py-2 text-sm disabled:bg-gray-100">
                  <option value="">Seleziona</option>
                  {lineeAvailable.map(l => <option key={l.id} value={l.nome}>{l.nome}</option>)}
                </select>
              </Field>
              <Field label="Macchina">
                <select disabled={!canEdit || !form.linea} value={form.macchina || ''} onChange={e => set('macchina', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm disabled:bg-gray-100">
                  <option value="">Seleziona</option>
                  {macchineAvailable.map(m => <option key={m.id} value={m.nome}>{m.nome}</option>)}
                </select>
              </Field>
            </div>

            <Field label="Descrizione dell'evento o della condizione o del comportamento *">
              <textarea disabled={!canEdit} value={form.descrizione || ''} onChange={e => set('descrizione', e.target.value)} rows={3} className="w-full border rounded-lg px-3 py-2 text-sm disabled:bg-gray-100" />
            </Field>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Persona coinvolta">
                <textarea disabled={!canEdit} value={form.persona_coinvolta || ''} onChange={e => set('persona_coinvolta', e.target.value)} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm disabled:bg-gray-100" />
              </Field>
              <Field label="Persone presenti">
                <textarea disabled={!canEdit} value={form.persone_presenti || ''} onChange={e => set('persone_presenti', e.target.value)} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm disabled:bg-gray-100" />
              </Field>
              <Field label="Azioni immediate intraprese">
                <textarea disabled={!canEdit} value={form.azioni_immediate || ''} onChange={e => set('azioni_immediate', e.target.value)} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm disabled:bg-gray-100" />
              </Field>
              <Field label="Azioni suggerite">
                <textarea disabled={!canEdit} value={form.azioni_suggerite || ''} onChange={e => set('azioni_suggerite', e.target.value)} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm disabled:bg-gray-100" />
              </Field>
            </div>
          </Section>

          <Section title="FOTO E ALLEGATI">
            {canEdit ? (
              <>
                <ImageUpload
                  images={form.immagini || []}
                  onChange={immagini => set('immagini', immagini)}
                  label="Foto ed evidenze"
                  maxImages={10}
                />
                <div className="pt-4 border-t">
                  <DocumentUpload
                    documents={form.allegati || []}
                    onChange={allegati => set('allegati', allegati)}
                  />
                </div>
                <p className="text-xs text-gray-400">
                  Dopo aver caricato foto o documenti, premi Salva per confermarli sulla segnalazione.
                </p>
              </>
            ) : (
              <div className="space-y-3">
                {(form.immagini || []).length === 0 && (form.allegati || []).length === 0 ? (
                  <div className="text-sm text-gray-400">Nessuna foto o allegato.</div>
                ) : (
                  <>
                    {(form.immagini || []).length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {(form.immagini || []).map((url, i) => (
                          <a key={i} href={url} target="_blank" rel="noreferrer" className="block rounded-lg border overflow-hidden">
                            <img src={url} alt={`Foto ${i + 1}`} className="w-full h-28 object-cover" />
                          </a>
                        ))}
                      </div>
                    )}
                    {(form.allegati || []).map((doc, i) => (
                      <a key={i} href={doc.url} target="_blank" rel="noreferrer" className="block text-sm text-blue-600 hover:underline">
                        {doc.filename || `Documento ${i + 1}`}
                      </a>
                    ))}
                  </>
                )}
              </div>
            )}
          </Section>

          {isAdmin && form._id && (
            <Section title="GESTIONE (ADMIN)">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label="Categoria">
                  <select value={form.categoria || ''} onChange={e => classifica('categoria', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                    <option value="">— Seleziona —</option>
                    {categorieOptions.map(c => (
                      <option key={c._id} value={c.label}>{c.icon ? `${c.icon} ` : ''}{c.label}</option>
                    ))}
                    {form.categoria && !categorieOptions.some(c => c.label === form.categoria) && (
                      <option value={form.categoria}>{form.categoria}</option>
                    )}
                  </select>
                </Field>
                <Field label="Gravita">
                  <select value={form.gravita || ''} onChange={e => classifica('gravita', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                    <option value="">—</option>
                    {['Bassa', 'Media', 'Alta', 'Critica'].map(v => <option key={v}>{v}</option>)}
                  </select>
                </Field>
                <Field label="Priorita">
                  <select value={form.priorita || ''} onChange={e => classifica('priorita', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                    <option value="">—</option>
                    {['Bassa', 'Media', 'Alta'].map(v => <option key={v}>{v}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Note di gestione">
                <textarea value={form.note_gestione || ''} onChange={e => classifica('note_gestione', e.target.value)} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </Field>
            </Section>
          )}

          {isAdmin && form._id && form.stato !== 'Bozza' && (
            <Section title="ACTION PLAN COLLEGATI">
              {apList.length === 0 ? (
                <div className="text-sm text-gray-400">Nessun Action Plan collegato a questa segnalazione.</div>
              ) : (
                <div className="space-y-2">
                  {apList.map(ap => {
                    const chiuso = STATI_CHIUSI.includes(ap.stato) || ap.is_cancelled
                    return (
                      <button
                        type="button"
                        key={ap._id}
                        onClick={() => openAp(ap._id)}
                        className="w-full text-left border rounded-lg p-3 flex items-center gap-3 hover:border-primary hover:bg-gray-50 transition-colors"
                      >
                        <span className="font-mono text-xs font-bold text-primary bg-gray-100 px-2 py-1 rounded">{ap.numero}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{ap.titolo}</div>
                          <div className="text-xs text-gray-500 mt-0.5 flex gap-3 flex-wrap">
                            {ap.tipo && <span>Tipo: {ap.tipo}</span>}
                            {ap.responsabile && <span>Resp: {ap.responsabile}</span>}
                            {ap.data_scadenza && <span>Scad: {String(ap.data_scadenza).slice(0, 10)}</span>}
                          </div>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${chiuso ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                          {ap.is_cancelled ? 'Annullato' : ap.stato}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowApForm(true)}
                className="mt-1 px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary-light flex items-center gap-2"
              >
                <Plus size={16} /> Crea Action Plan
              </button>
              <p className="text-xs text-gray-400 mt-2">
                Le azioni sono gestite come Action Plan (Tipo {form.tipo}, collegati a questa segnalazione). Le trovi anche nella pagina Action Plan.
              </p>
            </Section>
          )}

          {isAdmin && !isChiuso && form._id && form.stato !== 'Bozza' && (
            <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-50 border rounded-lg p-4">
              <div className="flex items-center gap-3">
                {form.stato !== 'In gestione' && (
                  <button onClick={setInGestione} className="px-3 py-1.5 border rounded-lg text-sm hover:bg-white">Metti in gestione</button>
                )}
                <div className="text-sm text-gray-600">
                  {apOpen > 0
                    ? `${apOpen} Action Plan ancora apert${apOpen === 1 ? 'o' : 'i'}`
                    : apList.length > 0
                      ? 'Tutti gli Action Plan sono chiusi'
                      : 'Nessun Action Plan collegato'}
                </div>
              </div>
              <button
                onClick={() => setChiusuraOpen(true)}
                disabled={apOpen > 0}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                title={apOpen > 0 ? 'Chiudi prima tutti gli Action Plan collegati' : ''}
              >
                <Lock size={15} /> Chiudi segnalazione
              </button>
            </div>
          )}

          {canEdit && form._id && (
            <div className="flex justify-end">
              <button onClick={elimina} className="text-red-600 hover:bg-red-50 px-4 py-2 rounded-lg text-sm flex items-center gap-2">
                <Trash2 size={15} /> Elimina segnalazione
              </button>
            </div>
          )}
        </div>
      </div>

      {showApForm && (
        <ActionPlanFormShared
          prefilledParent={{
            parent_type: 'segnalazione',
            parent_id: form._id,
            parent_label: form.codice,
            tipo: form.tipo,
            reparto: form.reparto || '',
            linea: form.linea || '',
            macchina: form.macchina || '',
          }}
          onClose={() => setShowApForm(false)}
          onSaved={() => {
            setShowApForm(false)
            loadActionPlans()
          }}
        />
      )}

      {editingAp && (
        <ActionPlanFormShared
          plan={editingAp}
          onClose={() => setEditingAp(null)}
          onSaved={() => {
            setEditingAp(null)
            loadActionPlans()
          }}
        />
      )}

      {chiusuraOpen && (
        <ChiusuraModal
          segnalazioneId={form._id}
          onClose={() => setChiusuraOpen(false)}
          onClosed={updated => { setForm(updated); onSaved(); setChiusuraOpen(false) }}
        />
      )}
    </div>
  )
}

function ChiusuraModal({ segnalazioneId, onClose, onClosed }) {
  const [nota, setNota] = useState('')
  const [busy, setBusy] = useState(false)

  const chiudi = async () => {
    if (!nota.trim()) {
      alert('La nota di verifica efficacia e obbligatoria')
      return
    }
    setBusy(true)
    try {
      const res = await api.patch(`/segnalazioni/${segnalazioneId}/chiudi`, { nota_verifica_efficacia: nota })
      onClosed(res.data)
    } catch (err) {
      alert('Errore: ' + (err.response?.data?.detail || err.message))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="bg-green-600 text-white px-5 py-4 flex items-center gap-2">
          <CheckCircle2 size={20} />
          <h3 className="font-bold">Chiudi segnalazione</h3>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-800">
            La verifica di efficacia conferma che il rischio e stato realmente eliminato, non solo che le azioni sono completate.
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Nota di verifica efficacia <span className="text-red-500">*</span></label>
            <textarea value={nota} onChange={e => setNota(e.target.value)} rows={4} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Descrivi come e stata verificata l'efficacia delle azioni e l'eliminazione del rischio." autoFocus />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <button onClick={onClose} className="px-4 py-2 border rounded-lg text-sm">Annulla</button>
            <button onClick={chiudi} disabled={busy || !nota.trim()} className="px-5 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
              {busy ? 'Chiusura...' : 'Conferma chiusura'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="bg-gray-600 text-white px-4 py-2.5 font-bold text-sm">{title}</div>
      <div className="p-4 space-y-4">{children}</div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label className="block">
      <FieldLabel>{label}</FieldLabel>
      {children}
    </label>
  )
}

function FieldLabel({ children }) {
  return <span className="block text-sm font-medium text-gray-600 mb-1">{children}</span>
}

function ReadField({ label, value }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="bg-gray-50 border rounded-lg px-3 py-2 text-sm text-gray-700">{value || '—'}</div>
    </div>
  )
}
