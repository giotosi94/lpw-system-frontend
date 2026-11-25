import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../services/api'
import { AlertTriangle, Leaf, Plus, Eye, X, Send, Trash2, Save, CheckCircle2, Lock, Download, Edit2, ListChecks } from 'lucide-react'
import ActionPlanFormShared from '../components/ActionPlanFormShared'
import ImageUpload from '../components/ImageUpload'
import DocumentUpload from '../components/DocumentUpload'
import UserPicker from '../components/UserPicker'

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

const EVENT_FIELDS = [
  'data_evento', 'ora_evento', 'reparto', 'linea', 'macchina', 'descrizione',
  'persona_coinvolta', 'persone_presenti', 'azioni_immediate', 'azioni_suggerite', 'immagini', 'allegati',
]

const EXPORT_COLUMNS = [
  { key: 'codice', label: 'Codice' },
  { key: 'tipo', label: 'Tipo' },
  { key: 'stato', label: 'Stato' },
  { key: 'categoria', label: 'Categoria' },
  { key: 'gravita', label: 'Gravita' },
  { key: 'priorita', label: 'Priorita' },
  { key: 'parte_corpo', label: 'Parte del corpo' },
  { key: 'tipo_lesione', label: 'Tipo di lesione' },
  { key: 'reparto', label: 'Reparto' },
  { key: 'linea', label: 'Linea' },
  { key: 'macchina', label: 'Macchina' },
  { key: 'descrizione', label: 'Descrizione' },
  { key: 'segnalatore_nome', label: 'Segnalatore' },
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

const formatDate = value => {
  if (!value) return ''
  const d = new Date(`${value}T12:00:00`)
  return isNaN(d.getTime()) ? value : d.toLocaleDateString('it-IT')
}

export default function SegnalazioniPage() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState(null)
  const [riepilogoOpen, setRiepilogoOpen] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()

  const savedUser = (() => {
    try { return JSON.parse(localStorage.getItem('user') || '{}') } catch { return {} }
  })()
  const role = String(savedUser.role || savedUser.ruolo || '').toLowerCase()
  const isAdmin = ['admin', 'administrator', 'amministratore'].includes(role)
  const [managedTipi, setManagedTipi] = useState(isAdmin ? ['Sicurezza', 'Ambiente'] : [])

  useEffect(() => {
    api.get('/segnalazioni/responsabili/me')
      .then(res => setManagedTipi(res.data?.tipi || []))
      .catch(() => {})
  }, [])

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
        <div className="flex flex-wrap items-center gap-2">
        {managedTipi.length > 0 && (
          <button
            type="button"
            onClick={() => setRiepilogoOpen(true)}
            className="flex items-center gap-2 text-sm border border-primary text-primary bg-white px-3 py-2 rounded-lg font-medium hover:bg-gray-50"
          >
            <ListChecks size={16} /> Riepilogo giornaliero
          </button>
        )}
        <button
          type="button"
          onClick={() => exportSegnalazioniCsv(items)}
          disabled={loading || items.length === 0}
          className="flex items-center gap-2 text-sm bg-primary text-white px-3 py-2 rounded-lg font-medium hover:bg-primary-light disabled:opacity-50"
          title="Scarica le segnalazioni in un file per Excel"
        >
          <Download size={16} /> Scarica Excel
        </button>
        </div>
      </div>

      <div className="space-y-4">
        {TIPI.map(tipo => {
          const list = byTipo[tipo.id] || []
          const Icon = tipo.Icon
          return (
            <div key={tipo.id} className="bg-white rounded-xl shadow overflow-hidden">
              <div className="bg-primary text-white px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold tracking-wide">
                  <Icon size={18} /> {tipo.label}
                </div>
                <button
                  type="button"
                  onClick={() => createNew(tipo.id)}
                  className="bg-white text-primary px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1 hover:bg-gray-100"
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
                        className="text-primary hover:bg-gray-100 px-3 py-1.5 rounded-lg text-sm flex items-center gap-1"
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

      {riepilogoOpen && (
        <RiepilogoModal
          onClose={() => setRiepilogoOpen(false)}
          onOpen={item => { setRiepilogoOpen(false); setDetail(item) }}
        />
      )}

      {detail && (
        <SegnalazioneDetail
          segnalazione={detail}
          isAdmin={isAdmin || managedTipi.includes(detail.tipo)}
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
  const [editMode, setEditMode] = useState(false)
  const [snapshot, setSnapshot] = useState(null)
  const [chiusuraOpen, setChiusuraOpen] = useState(false)
  const [apList, setApList] = useState([])
  const [apOpen, setApOpen] = useState(0)
  const [showApForm, setShowApForm] = useState(false)
  const [editingAp, setEditingAp] = useState(null)
  const [categorieOptions, setCategorieOptions] = useState([])
  const [partiCorpoOptions, setPartiCorpoOptions] = useState([])
  const [lesioniOptions, setLesioniOptions] = useState([])
  const [gestioneDirty, setGestioneDirty] = useState(false)
  const [feedback, setFeedback] = useState('')

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

  useEffect(() => {
    if (!isAdmin || form.tipo !== 'Sicurezza') return
    api.get('/configurazioni/?tipo=parte_corpo_segnalazione&attivo=true')
      .then(res => setPartiCorpoOptions(res.data || []))
      .catch(() => setPartiCorpoOptions([]))
    api.get('/configurazioni/?tipo=tipo_lesione_segnalazione&attivo=true')
      .then(res => setLesioniOptions(res.data || []))
      .catch(() => setLesioniOptions([]))
  }, [isAdmin, form.tipo])

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

  const isBozza = form.stato === 'Bozza'
  const isChiuso = form.stato === 'Chiuso'
  const canEdit = isBozza || (isAdmin && editMode && !isChiuso)
  const canDelete = Boolean(form._id) && (isBozza || isAdmin)

  const lineeAvailable = (reparti.find(r => r.nome === form.reparto)?.linee || [])
  const lineaSel = lineeAvailable.find(l => l.nome === form.linea)
  const macchineAvailable = [
    ...(lineaSel?.macchine || []),
    ...(lineaSel?.aree || []).filter(a => a.attivo !== false).flatMap(a => a.macchine || []),
  ].filter(m => m.attivo !== false)

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
    if (!isBozza && !form.descrizione?.trim()) {
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
      const res = await api.put(`/segnalazioni/${id}`, buildPayload())
      setForm(res.data)
      setEditMode(false)
      setSnapshot(null)
      onSaved()
      if (isBozza) alert('Salvato')
    } catch (err) {
      alert('Errore: ' + (err.response?.data?.detail || err.message))
    } finally {
      setSaving(false)
    }
  }

  const startEdit = () => {
    const copy = {}
    EVENT_FIELDS.forEach(key => { copy[key] = form[key] })
    setSnapshot(copy)
    setEditMode(true)
  }

  const cancelEdit = () => {
    if (snapshot) setForm(f => ({ ...f, ...snapshot }))
    setSnapshot(null)
    setEditMode(false)
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

  const classifica = (field, value) => {
    setForm(f => ({ ...f, [field]: value }))
    setGestioneDirty(true)
  }

  const gestionePayload = () => ({
    categoria: form.categoria || '',
    gravita: form.gravita || '',
    priorita: form.priorita || '',
    note_gestione: form.note_gestione || '',
    parte_corpo: form.parte_corpo || '',
    tipo_lesione: form.tipo_lesione || '',
  })

  const saveGestione = async () => {
    if (saving) return
    setSaving(true)
    try {
      const res = await api.patch(`/segnalazioni/${form._id}/classificazione`, gestionePayload())
      setForm(f => ({ ...f, ...res.data }))
      setGestioneDirty(false)
      onSaved()
    } catch (err) {
      alert('Errore: ' + (err.response?.data?.detail || err.message))
    } finally {
      setSaving(false)
    }
  }

  const approva = async () => {
    if (saving) return
    if (!form.categoria || !form.gravita) {
      alert('Indica categoria e gravità prima di approvare')
      return
    }
    if (!confirm('Approvare la segnalazione? Verrà inserita nel riepilogo giornaliero.')) return
    setSaving(true)
    try {
      const res = await api.patch(`/segnalazioni/${form._id}/approva`, gestionePayload())
      setForm(f => ({ ...f, ...res.data }))
      setGestioneDirty(false)
      onSaved()
    } catch (err) {
      alert('Errore: ' + (err.response?.data?.detail || err.message))
    } finally {
      setSaving(false)
    }
  }

  const sendFeedback = async () => {
    if (saving || !feedback.trim()) return
    setSaving(true)
    try {
      const res = await api.post(`/segnalazioni/${form._id}/feedback`, { testo: feedback })
      setForm(f => ({ ...f, feedback: res.data.feedback || [] }))
      setFeedback('')
      onSaved()
    } catch (err) {
      alert('Errore: ' + (err.response?.data?.detail || err.message))
    } finally {
      setSaving(false)
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

  const closeDetail = () => {
    if ((editMode || gestioneDirty) && !confirm('Uscire senza salvare le modifiche?')) return
    onClose(form)
  }

  const inputClass = 'w-full border rounded-lg px-3 py-2 text-sm'

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-4xl h-[92vh] flex flex-col overflow-hidden shadow-2xl">
        <div className="bg-primary text-white px-6 py-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-white/70">Segnalazione di {form.tipo}</div>
            <h2 className="text-lg font-bold">{form.codice ? `Codice ${form.codice}` : 'Nuova segnalazione'}</h2>
          </div>
          <div className="flex items-center gap-2">
            {isBozza && (
              <>
                <button type="button" onClick={save} disabled={saving} className="border border-white/50 text-white px-3 py-1.5 rounded text-sm flex items-center gap-1 hover:bg-white/10 disabled:opacity-50">
                  <Save size={15} /> Salva bozza
                </button>
                <button type="button" onClick={termina} disabled={saving} className="bg-white text-primary font-medium px-3 py-1.5 rounded text-sm flex items-center gap-1 hover:bg-gray-100 disabled:opacity-50">
                  <Send size={15} /> Termina inserimento
                </button>
              </>
            )}
            <button type="button" onClick={closeDetail} className="p-1.5 rounded hover:bg-white/10"><X size={20} /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-gray-50">
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
                <button type="button" onClick={riapri} className="text-sm border border-green-600 text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-100">Riapri</button>
              )}
            </div>
          )}

          <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
            <div className="bg-primary text-white px-4 py-2.5 flex items-center justify-between gap-3">
              <span className="font-bold text-sm">SEGNALAZIONE</span>
              {!isBozza && isAdmin && !isChiuso && (
                editMode ? (
                  <div className="flex gap-2">
                    <button type="button" onClick={cancelEdit} disabled={saving} className="px-3 py-1 rounded text-sm border border-white/50 hover:bg-white/10">Annulla</button>
                    <button type="button" onClick={save} disabled={saving} className="px-3 py-1 rounded text-sm bg-white text-primary font-medium flex items-center gap-1 hover:bg-gray-100 disabled:opacity-50">
                      <Save size={14} /> {saving ? 'Salvataggio...' : 'Salva'}
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={startEdit} className="px-3 py-1 rounded text-sm border border-white/50 flex items-center gap-1 hover:bg-white/10">
                    <Edit2 size={14} /> Modifica
                  </button>
                )
              )}
            </div>
            <div className="divide-y divide-gray-200">
              <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                <ReadField label="Segnalatore" value={form.segnalatore_nome} />
                <ReadField label="Inviata il" value={form.created_at ? new Date(form.created_at).toLocaleString('it-IT') : ''} />
                <div>
                  <FieldLabel>Stato</FieldLabel>
                  <span className={`inline-block px-3 py-1.5 rounded text-sm font-medium ${STATO_BADGE[form.stato] || 'bg-gray-100'}`}>{form.stato}</span>
                </div>
                <ReadField label="Data chiusura" value={form.data_chiusura ? new Date(form.data_chiusura).toLocaleString('it-IT') : ''} />
              </div>
              <SubBlock title="Dettaglio dell'evento">
            {canEdit ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Data *">
                    <input type="date" value={form.data_evento || ''} onChange={e => set('data_evento', e.target.value)} className={inputClass} />
                  </Field>
                  <Field label="Ora *">
                    <input type="time" value={form.ora_evento || ''} onChange={e => set('ora_evento', e.target.value)} className={inputClass} />
                  </Field>
                  <Field label="Reparto *">
                    <select value={form.reparto || ''} onChange={e => setForm(f => ({ ...f, reparto: e.target.value, linea: '', macchina: '' }))} className={inputClass}>
                      <option value="">Seleziona</option>
                      {reparti.map(r => <option key={r._id} value={r.nome}>{r.nome}</option>)}
                    </select>
                  </Field>
                  <Field label="Linea">
                    <select disabled={!form.reparto} value={form.linea || ''} onChange={e => setForm(f => ({ ...f, linea: e.target.value, macchina: '' }))} className={`${inputClass} disabled:bg-gray-100`}>
                      <option value="">Seleziona</option>
                      {lineeAvailable.map(l => <option key={l.id || l.nome} value={l.nome}>{l.nome}</option>)}
                    </select>
                  </Field>
                  <Field label="Macchina">
                    <select disabled={!form.linea} value={form.macchina || ''} onChange={e => set('macchina', e.target.value)} className={`${inputClass} disabled:bg-gray-100`}>
                      <option value="">Seleziona</option>
                      {form.macchina && !macchineAvailable.some(m => m.nome === form.macchina) && <option value={form.macchina}>{form.macchina}</option>}
                      {macchineAvailable.map(m => <option key={m.id || m.nome} value={m.nome}>{m.nome}</option>)}
                    </select>
                  </Field>
                </div>
                <Field label="Descrizione dell'evento o della condizione o del comportamento *">
                  <textarea value={form.descrizione || ''} onChange={e => set('descrizione', e.target.value)} rows={3} className={inputClass} />
                </Field>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Persona coinvolta">
                    <textarea value={form.persona_coinvolta || ''} onChange={e => set('persona_coinvolta', e.target.value)} rows={2} className={inputClass} />
                  </Field>
                  <Field label="Persone presenti">
                    <textarea value={form.persone_presenti || ''} onChange={e => set('persone_presenti', e.target.value)} rows={2} className={inputClass} />
                  </Field>
                  <Field label="Azioni immediate intraprese">
                    <textarea value={form.azioni_immediate || ''} onChange={e => set('azioni_immediate', e.target.value)} rows={2} className={inputClass} />
                  </Field>
                  <Field label="Azioni suggerite">
                    <textarea value={form.azioni_suggerite || ''} onChange={e => set('azioni_suggerite', e.target.value)} rows={2} className={inputClass} />
                  </Field>
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <ReadField label="Data" value={formatDate(form.data_evento)} />
                  <ReadField label="Ora" value={form.ora_evento} />
                  <ReadField label="Reparto" value={form.reparto} />
                  <ReadField label="Linea" value={[form.linea, form.macchina].filter(Boolean).join(' · ')} />
                </div>
                <ReadText label="Descrizione" value={form.descrizione} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <ReadText label="Persona coinvolta" value={form.persona_coinvolta} />
                  <ReadText label="Persone presenti" value={form.persone_presenti} />
                  <ReadText label="Azioni immediate intraprese" value={form.azioni_immediate} />
                  <ReadText label="Azioni suggerite" value={form.azioni_suggerite} />
                </div>
              </>
            )}
              </SubBlock>
              <SubBlock title="Foto e allegati">
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
                      <a key={i} href={doc.url} target="_blank" rel="noreferrer" className="block text-sm text-primary hover:underline">
                        {doc.filename || `Documento ${i + 1}`}
                      </a>
                    ))}
                  </>
                )}
              </div>
            )}
              </SubBlock>
              {!isBozza && form.modificato_da && (
                <div className="px-4 py-2 text-xs text-gray-500 bg-gray-50">
                  Modificato da {form.modificato_da}{form.modificato_il ? ` il ${new Date(form.modificato_il).toLocaleString('it-IT')}` : ''}
                </div>
              )}
            </div>
          </div>

          {isAdmin && form._id && !isBozza && (
            <Section title="GESTIONE">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label="Categoria">
                  <select value={form.categoria || ''} onChange={e => classifica('categoria', e.target.value)} className={inputClass}>
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
                  <select value={form.gravita || ''} onChange={e => classifica('gravita', e.target.value)} className={inputClass}>
                    <option value="">—</option>
                    {['Bassa', 'Media', 'Alta', 'Critica'].map(v => <option key={v}>{v}</option>)}
                  </select>
                </Field>
                <Field label="Priorita">
                  <select value={form.priorita || ''} onChange={e => classifica('priorita', e.target.value)} className={inputClass}>
                    <option value="">—</option>
                    {['Bassa', 'Media', 'Alta'].map(v => <option key={v}>{v}</option>)}
                  </select>
                </Field>
              </div>
              {form.tipo === 'Sicurezza' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Parte del corpo">
                    <ConfigSelect value={form.parte_corpo} options={partiCorpoOptions} onChange={value => classifica('parte_corpo', value)} />
                  </Field>
                  <Field label="Tipo di lesione">
                    <ConfigSelect value={form.tipo_lesione} options={lesioniOptions} onChange={value => classifica('tipo_lesione', value)} />
                  </Field>
                </div>
              )}
              <Field label="Note di gestione">
                <textarea value={form.note_gestione || ''} onChange={e => classifica('note_gestione', e.target.value)} rows={2} className={inputClass} />
              </Field>
              {form.approvata && (
                <div className="text-xs text-green-700 flex items-center gap-1">
                  <CheckCircle2 size={14} /> Approvata da {form.approvata_da}{form.approvata_il ? ` il ${new Date(form.approvata_il).toLocaleString('it-IT')}` : ''}
                </div>
              )}
            </Section>
          )}

          {!isBozza && form._id && ((isAdmin && form.approvata) || (form.feedback || []).length > 0) && (
            <Section title="FEEDBACK AL SEGNALATORE">
              {(form.feedback || []).length > 0 && (
                <div className="space-y-2">
                  {(form.feedback || []).map((item, i) => (
                    <div key={i} className="border-l-2 border-primary pl-3">
                      <div className="text-sm text-gray-800 whitespace-pre-wrap">{item.testo}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{item.autore}{item.data ? ` · ${new Date(item.data).toLocaleString('it-IT')}` : ''}</div>
                    </div>
                  ))}
                </div>
              )}
              {isAdmin && form.approvata && (
                <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                  <textarea
                    value={feedback}
                    onChange={e => setFeedback(e.target.value)}
                    rows={2}
                    placeholder={`Messaggio per ${form.segnalatore_nome || 'il segnalatore'}`}
                    className={`${inputClass} flex-1`}
                  />
                  <button
                    type="button"
                    onClick={sendFeedback}
                    disabled={saving || !feedback.trim()}
                    className="px-4 py-2 bg-primary text-white rounded-lg text-sm flex items-center justify-center gap-2 hover:bg-primary-light disabled:opacity-50"
                  >
                    <Send size={15} /> Invia
                  </button>
                </div>
              )}
            </Section>
          )}


          {isAdmin && form._id && !isBozza && (
            <Section title="ACTION PLAN COLLEGATI">
              {apList.length === 0 ? (
                <div className="text-sm text-gray-400">Nessun Action Plan collegato.</div>
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
                            {ap.tipo && <span>Perdita: {ap.tipo}</span>}
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
              {!isChiuso && (
                <button
                  type="button"
                  onClick={() => setShowApForm(true)}
                  className="mt-1 px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary-light flex items-center gap-2"
                >
                  <Plus size={16} /> Crea Action Plan
                </button>
              )}
            </Section>
          )}

          {isAdmin && !isChiuso && form._id && !isBozza && (
            <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-50 border rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="text-sm text-gray-600">
                  {apOpen > 0
                    ? `${apOpen} Action Plan ancora apert${apOpen === 1 ? 'o' : 'i'}`
                    : apList.length > 0
                      ? 'Tutti gli Action Plan sono chiusi'
                      : 'Nessun Action Plan collegato'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setChiusuraOpen(true)}
                disabled={apOpen > 0 || editMode}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                title={apOpen > 0 ? 'Chiudi prima tutti gli Action Plan collegati' : editMode ? 'Salva o annulla le modifiche' : ''}
              >
                <Lock size={15} /> Chiudi segnalazione
              </button>
            </div>
          )}

          {(canDelete || (isAdmin && form._id && !isBozza && !isChiuso)) && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              {canDelete ? (
                <button type="button" onClick={elimina} className="text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg text-sm flex items-center gap-2">
                  <Trash2 size={15} /> Elimina
                </button>
              ) : <span />}
              {isAdmin && form._id && !isBozza && !isChiuso && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={saveGestione}
                    disabled={saving || !gestioneDirty || editMode}
                    className="px-4 py-2 border border-primary text-primary bg-white rounded-lg text-sm flex items-center gap-2 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <Save size={15} /> Salva
                  </button>
                  {!form.approvata && (
                    <button
                      type="button"
                      onClick={approva}
                      disabled={saving || editMode}
                      className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-primary-light disabled:opacity-50"
                    >
                      <CheckCircle2 size={15} /> Approva segnalazione
                    </button>
                  )}
                </div>
              )}
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

function todayIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function RiepilogoModal({ onClose, onOpen }) {
  const [data, setData] = useState(todayIso())
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [destinatari, setDestinatari] = useState([])
  const [destDirty, setDestDirty] = useState(false)
  const [savingDest, setSavingDest] = useState(false)

  useEffect(() => {
    api.get('/segnalazioni/riepilogo/destinatari')
      .then(res => setDestinatari(res.data?.utenti || []))
      .catch(() => setDestinatari([]))
  }, [])

  useEffect(() => {
    setLoading(true)
    api.get('/segnalazioni/riepilogo/giorno', { params: { data } })
      .then(res => setItems(res.data?.items || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [data])

  const requestClose = () => {
    if (destDirty && !confirm('Destinatari non salvati. Uscire comunque?')) return
    onClose()
  }

  useEffect(() => {
    const onKey = event => { if (event.key === 'Escape') requestClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const saveDestinatari = async () => {
    setSavingDest(true)
    try {
      const res = await api.put('/segnalazioni/riepilogo/destinatari', { utenti: destinatari.map(item => item.id) })
      setDestinatari(res.data?.utenti || [])
      setDestDirty(false)
    } catch (err) {
      alert('Errore: ' + (err.response?.data?.detail || err.message))
    } finally {
      setSavingDest(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-start sm:items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-gray-50 rounded-xl w-full max-w-4xl flex flex-col shadow-2xl my-auto">
        <div className="bg-primary text-white px-6 py-4 flex items-center justify-between gap-3 rounded-t-xl">
          <h2 className="text-lg font-bold">Riepilogo giornaliero</h2>
          <div className="flex items-center gap-2">
            <input type="date" value={data} max={todayIso()} onChange={e => e.target.value && setData(e.target.value)} className="rounded px-2 py-1 text-sm text-gray-800" />
            <button type="button" onClick={requestClose} className="p-1.5 rounded hover:bg-white/10"><X size={20} /></button>
          </div>
        </div>
        <div className="p-4 sm:p-6 space-y-5 rounded-b-xl">
          <Section title={`SEGNALAZIONI APPROVATE (${items.length})`}>
            {loading ? (
              <div className="text-sm text-gray-400">Caricamento...</div>
            ) : items.length === 0 ? (
              <div className="text-sm text-gray-400">Nessuna segnalazione approvata in questa data.</div>
            ) : (
              <div className="divide-y max-h-[40vh] overflow-y-auto">
                {items.map(item => (
                  <button
                    type="button"
                    key={item._id}
                    onClick={() => onOpen(item)}
                    className="w-full text-left py-2.5 flex flex-wrap sm:flex-nowrap items-center gap-x-3 gap-y-1 hover:bg-gray-50"
                  >
                    <span className="font-mono text-sm font-bold text-primary w-16 shrink-0">{item.codice}</span>
                    <span className="text-xs text-gray-600 w-20 shrink-0">{item.tipo}</span>
                    <span className="flex-1 min-w-0 text-sm text-gray-800 truncate" title={item.descrizione}>{item.descrizione}</span>
                    <span className="text-xs text-gray-500 truncate max-w-[10rem]">{[item.categoria, item.gravita].filter(Boolean).join(' · ')}</span>
                    <span className="text-xs text-gray-500 truncate max-w-[10rem]">{[item.reparto, item.linea].filter(Boolean).join(' · ')}</span>
                  </button>
                ))}
              </div>
            )}
          </Section>
          <div className="border border-gray-200 rounded-lg bg-white">
            <div className="bg-primary text-white px-4 py-2.5 font-bold text-sm rounded-t-lg">DESTINATARI ({destinatari.length})</div>
            <div className="p-4 space-y-4">
            <UserPicker
              value={destinatari}
              onChange={selected => { setDestinatari(Array.isArray(selected) ? selected : []); setDestDirty(true) }}
              mode="multi"
              placeholder="Aggiungi destinatari..."
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={saveDestinatari}
                disabled={savingDest || !destDirty}
                className="px-4 py-2 bg-primary text-white rounded-lg text-sm flex items-center gap-2 hover:bg-primary-light disabled:opacity-50"
              >
                <Save size={15} /> {savingDest ? 'Salvataggio...' : 'Salva destinatari'}
              </button>
            </div>
            </div>
          </div>
        </div>
      </div>
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
          <div>
            <label className="block text-sm font-medium mb-1">Nota di verifica efficacia <span className="text-red-500">*</span></label>
            <textarea value={nota} onChange={e => setNota(e.target.value)} rows={4} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Come è stata verificata l'eliminazione del rischio" autoFocus />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg text-sm">Annulla</button>
            <button type="button" onClick={chiudi} disabled={busy || !nota.trim()} className="px-5 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
              {busy ? 'Chiusura...' : 'Conferma chiusura'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ConfigSelect({ value, options, onChange }) {
  return (
    <select value={value || ''} onChange={e => onChange(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
      <option value="">— Seleziona —</option>
      {options.map(o => <option key={o._id} value={o.label}>{o.label}</option>)}
      {value && !options.some(o => o.label === value) && <option value={value}>{value}</option>}
    </select>
  )
}

function SubBlock({ title, children }) {
  return (
    <div className="p-4 space-y-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-primary">{title}</div>
      {children}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
      <div className="bg-primary text-white px-4 py-2.5 font-bold text-sm">{title}</div>
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
    <div className="min-w-0">
      <FieldLabel>{label}</FieldLabel>
      <div className="bg-gray-50 border rounded-lg px-3 py-2 text-sm text-gray-700 truncate" title={value || ''}>{value || '—'}</div>
    </div>
  )
}

function ReadText({ label, value }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="bg-gray-50 border rounded-lg px-3 py-2 text-sm text-gray-700 whitespace-pre-wrap break-words min-h-[38px]">{value || '—'}</div>
    </div>
  )
}
