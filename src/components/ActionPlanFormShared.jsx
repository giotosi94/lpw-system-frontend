import { useState, useEffect, useMemo } from 'react'
import { X } from 'lucide-react'
import api from '../services/api'
import { useAllConfigurations } from '../hooks/useConfigurations'
import UserPicker from './UserPicker'

// 5M hard-coded (Ishikawa) — non configurabile
const QUINTA_M = [
  { value: 'Machine', label: 'Machine' },
  { value: 'Manodopera', label: 'Manodopera' },
  { value: 'Metodo', label: 'Metodo' },
  { value: 'Materiale', label: 'Materiale' },
  { value: 'Misurazione', label: 'Misurazione' },
]

export default function ActionPlanFormShared({ plan, onClose, onSaved, prefilledKaizen = null, prefilledParent = null }) {
const [form, setForm] = useState({
  titolo: plan?.titolo || prefilledParent?.titolo || '',
  tipo: plan?.tipo || prefilledParent?.tipo || '',
  priorita: plan?.priorita || '',
  stato: plan?.stato || '',
  categoria_perdita: plan?.categoria_perdita || plan?.tipo_perdita || '',
  quinta_m: plan?.quinta_m || '',
  responsabile: plan?.responsabile || '',
  responsabile_id: plan?.responsabile_id || null,
  reparto: plan?.reparto || prefilledParent?.reparto || '',
  linea: plan?.linea || prefilledParent?.linea || '',
  macchina: plan?.macchina || prefilledParent?.macchina || '',
  data_scadenza: plan?.data_scadenza ? plan.data_scadenza.slice(0, 10) : '',
  parent_type: plan?.parent_type || prefilledParent?.parent_type || 'standalone',
  parent_id: plan?.parent_id || prefilledParent?.parent_id || null,
  parent_label: plan?.parent_label || prefilledParent?.parent_label || null,
  pillar_id: plan?.pillar_id || prefilledParent?.pillar_id || null,
  dashboard_id: plan?.dashboard_id || prefilledParent?.dashboard_id || null,
})
  const [saving, setSaving] = useState(false)
  const { configs } = useAllConfigurations()

  const [reparti, setReparti] = useState([])
  useEffect(() => {
    api.get('/reparti/').then(res => setReparti(res.data || [])).catch(() => setReparti([]))
  }, [])

  const lineeDisponibili = useMemo(() => {
    if (!form.reparto) return []
    const rep = reparti.find(r => r.nome === form.reparto)
    return rep?.linee?.filter(l => l.attivo !== false) || []
  }, [form.reparto, reparti])

  const macchineDisponibili = useMemo(() => {
    if (!form.linea) return []
    const linea = lineeDisponibili.find(l => l.nome === form.linea)
    return linea?.macchine?.filter(m => m.attivo !== false) || []
  }, [form.linea, lineeDisponibili])

  useEffect(() => {
  if (plan) return

  const stati = configs.stato_ap || []
  const priorita = configs.priorita_ap || []

  const statoAperto =
    stati.find(s => s.label?.toLowerCase() === 'aperto')?.label ||
    stati.find(s => s.label?.toLowerCase().includes('apert'))?.label ||
    'Aperto'

  const prioritaMedia =
    priorita.find(p => p.label?.toLowerCase().includes('medium'))?.label ||
    priorita.find(p => p.label?.toLowerCase().includes('media'))?.label ||
    priorita[0]?.label ||
    ''

  setForm(f => ({
    ...f,
    stato: statoAperto,
    priorita: f.priorita || prioritaMedia,
  }))
}, [configs.stato_ap, configs.priorita_ap, plan])

  function handleRepartoChange(nuovoReparto) {
    setForm(f => ({ ...f, reparto: nuovoReparto, linea: '', macchina: '' }))
  }

  function handleLineaChange(nuovaLinea) {
    setForm(f => ({ ...f, linea: nuovaLinea, macchina: '' }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.data_scadenza) {
      alert('La scadenza è obbligatoria')
      return
    }
    setSaving(true)
    try {
      const payload = {
        ...form,
        data_scadenza: form.data_scadenza
          ? new Date(form.data_scadenza).toISOString()
          : null,
      }

      Object.keys(payload).forEach(k => {
        if (payload[k] === '') delete payload[k]
      })

      let res
      if (plan?._id) {
        res = await api.put(`/action-plans/${plan._id}`, payload)
      } else {
        res = await api.post('/action-plans/', payload)

        if (prefilledKaizen?.kaizen_id && res.data?._id) {
          try {
            await api.post(`/action-plans/${res.data._id}/link-kaizen`, {
              kaizen_id: prefilledKaizen.kaizen_id,
              kaizen_numero: prefilledKaizen.kaizen_numero,
            })
          } catch (linkErr) {
            console.warn('Link kaizen fallito ma AP creato:', linkErr)
          }
        }
      }

      onSaved(res.data)
    } catch (err) {
      console.error(err)
      let msg = 'Errore sconosciuto'
      const detail = err.response?.data?.detail
      if (typeof detail === 'string') msg = detail
      else if (Array.isArray(detail)) {
        msg = detail.map(d => {
          const field = d.loc ? d.loc.slice(1).join('.') : 'campo'
          return `${field}: ${d.msg}`
        }).join('\n')
      } else if (err.message) msg = err.message
      alert('Errore salvataggio:\n\n' + msg)
    } finally {
      setSaving(false)
    }
  }

  const tipiConfig = configs.tipi_action_plan || []
  const prioritaConfig = configs.priorita_ap || []
  const statiConfig = configs.stato_ap || []
  const categoriePerditaConfig = configs.categorie_perdita || []

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[95vh] overflow-y-auto">
        <div className="bg-primary text-white px-6 py-3 flex justify-between items-center sticky top-0 z-10">
          <h2 className="text-lg font-semibold">
            {plan ? `Modifica ${plan.numero}` : 'Nuovo Action Plan'}
            {prefilledKaizen && !plan && (
              <span className="ml-2 text-sm font-normal opacity-90">
                · Collegato a {prefilledKaizen.kaizen_numero}
              </span>
            )}
            {prefilledParent && !plan && !prefilledKaizen && (
              <span className="ml-2 text-sm font-normal opacity-90">
                · Collegato a {prefilledParent.parent_type} {prefilledParent.parent_label || ''}
              </span>
            )}
          </h2>
          <button onClick={onClose} className="hover:bg-primary-light p-1 rounded">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <Field label="Titolo *">
            <input
              required
              autoFocus
              value={form.titolo}
              onChange={(e) => setForm({ ...form, titolo: e.target.value })}
              className="w-full border rounded-lg px-3 py-2"
            />
          </Field>

          <div className={`grid gap-3 ${plan ? 'grid-cols-3' : 'grid-cols-2'}`}>
            <Field label="Tipo">
              <DynamicSelect
                value={form.tipo}
                onChange={(v) => setForm({ ...form, tipo: v })}
                options={tipiConfig}
                placeholder="Seleziona"
                emptyHint="Settings → Tipo"
              />
            </Field>

            <Field label="Priorità">
              <DynamicSelect
                value={form.priorita}
                onChange={(v) => setForm({ ...form, priorita: v })}
                options={prioritaConfig}
                placeholder="Seleziona"
                emptyHint="Settings → Priorità"
              />
            </Field>

            {plan && (
              <Field label="Stato">
                <DynamicSelect
                  value={form.stato}
                  onChange={(v) => setForm({ ...form, stato: v })}
                  options={statiConfig}
                  placeholder="Seleziona"
                  emptyHint="Settings → Stato"
                />
              </Field>
            )}
          </div>

          {/* Categoria Perdita + 5M */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Categoria">
              <DynamicSelect
                value={form.categoria_perdita}
                onChange={(v) => setForm({ ...form, categoria_perdita: v })}
                options={categoriePerditaConfig}
                placeholder="Nessuna"
                emptyHint="Settings → Categoria Perdita"
              />
            </Field>
            <Field label="5M (Ishikawa)">
              <select
                value={form.quinta_m}
                onChange={(e) => setForm({ ...form, quinta_m: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
              >
                <option value="">Nessuna</option>
                {QUINTA_M.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </Field>
          </div>

          {/* Responsabile con UserPicker + fallback legacy */}
          <Field label="Responsabile">
            <UserPicker
              value={
                form.responsabile_id
                  ? { id: form.responsabile_id, name: form.responsabile }
                  : form.responsabile
                    ? { id: `legacy-${form.responsabile}`, name: form.responsabile }
                    : null
              }
              onChange={(selected) => {
                if (selected) {
                  setForm({ ...form, responsabile_id: selected.id, responsabile: selected.name })
                } else {
                  setForm({ ...form, responsabile_id: null, responsabile: '' })
                }
              }}
              mode="single"
              placeholder="Cerca utente per nome, email..."
            />
          </Field>

          {/* Reparto → Linea → Macchina */}
          <div className="grid grid-cols-3 gap-3">
            <Field label="Reparto">
              <select
                value={form.reparto}
                onChange={(e) => handleRepartoChange(e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
              >
                <option value="">Seleziona</option>
                {reparti.length === 0 ? (
                  <option disabled>Configura in Settings → Reparti</option>
                ) : (
                  reparti.filter(r => r.attivo !== false).map(r => (
                    <option key={r._id} value={r.nome}>
                      {r.nome}{r.codice ? ` [${r.codice}]` : ''}
                    </option>
                  ))
                )}
              </select>
            </Field>
            <Field label="Linea">
              <select
                value={form.linea}
                onChange={(e) => handleLineaChange(e.target.value)}
                disabled={!form.reparto}
                className="w-full border rounded-lg px-3 py-2 disabled:bg-gray-100"
              >
                <option value="">
                  {!form.reparto ? 'Prima il reparto' : 'Seleziona'}
                </option>
                {lineeDisponibili.map(l => (
                  <option key={l.id} value={l.nome}>
                    {l.nome}{l.codice ? ` [${l.codice}]` : ''}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Macchina">
              <select
                value={form.macchina}
                onChange={(e) => setForm({ ...form, macchina: e.target.value })}
                disabled={!form.linea}
                className="w-full border rounded-lg px-3 py-2 disabled:bg-gray-100"
              >
                <option value="">
                  {!form.linea ? 'Prima la linea' : 'Seleziona'}
                </option>
                {macchineDisponibili.map(m => (
                  <option key={m.id} value={m.nome}>
                    {m.nome}{m.codice ? ` [${m.codice}]` : ''}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Scadenza *">
            <input
              required
              type="date"
              value={form.data_scadenza}
              onChange={(e) => setForm({ ...form, data_scadenza: e.target.value })}
              className="w-full border rounded-lg px-3 py-2"
            />
          </Field>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg">
              Annulla
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-light disabled:opacity-50"
            >
              {saving ? 'Salvataggio...' : (plan ? 'Salva modifiche' : 'Crea Action Plan')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────
// Helper components
// ──────────────────────────────────────────────────────────
function Field({ label, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  )
}

function DynamicSelect({ value, onChange, options, placeholder, emptyHint }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full border rounded-lg px-3 py-2"
    >
      <option value="">{placeholder}</option>
      {options.length === 0 ? (
        <option disabled>Configura in {emptyHint}</option>
      ) : (
        options.map(o => (
          <option key={o._id} value={o.label}>
            {o.icon ? `${o.icon} ` : ''}{o.label}
          </option>
        ))
      )}
    </select>
  )
}
