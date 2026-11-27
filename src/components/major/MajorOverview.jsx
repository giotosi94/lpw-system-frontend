import { useEffect, useMemo, useState } from 'react'
import api from '../../services/api'
import UserPicker from '../UserPicker'
import { Save } from 'lucide-react'
import LinkedKaizens from './LinkedKaizens'

function macchineDiLinea(linea) {
  const trovate = []
  const viste = new Set()
  const aggiungi = macchina => {
    if (!macchina || macchina.attivo === false || !macchina.nome || viste.has(macchina.nome)) return
    viste.add(macchina.nome)
    trovate.push(macchina)
  }
  ;(linea?.macchine || []).forEach(aggiungi)
  ;(linea?.aree || []).filter(area => area.attivo !== false).forEach(area => (area.macchine || []).forEach(aggiungi))
  return trovate
}

export default function MajorOverview({ major, onSave }) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [reparti, setReparti] = useState([])
  const [pillars, setPillars] = useState([])
  const [form, setForm] = useState(() => buildForm(major))

  useEffect(() => {
    setForm(buildForm(major))
  }, [major])

  useEffect(() => {
    api.get('/reparti/').then(res => setReparti(res.data || [])).catch(() => setReparti([]))
    api.get('/pillars/').then(res => setPillars(res.data || [])).catch(() => setPillars([]))
  }, [])

  const snapshot = major.route_snapshot || {}
  const steps = snapshot.steps || []
  const stepsData = major.steps_data || {}

  const linee = useMemo(() => {
    if (!form.reparto) return []
    return reparti.find(item => item.nome === form.reparto)?.linee?.filter(item => item.attivo !== false) || []
  }, [form.reparto, reparti])

  const macchine = useMemo(() => {
    if (!form.linea) return []
    return macchineDiLinea(linee.find(item => item.nome === form.linea))
  }, [form.linea, linee])

  const save = async () => {
    setSaving(true)
    const selectedPillar = pillars.find(item => item._id === form.pillar_id)
    const payload = {
      titolo: form.titolo,
      descrizione: form.descrizione,
      motivo_strategico: form.motivo_strategico,
      reparto: form.reparto || null,
      linea: form.linea || null,
      macchina: form.macchina || null,
      pillar_id: selectedPillar?._id || null,
      pillar_sigla: selectedPillar?.sigla || null,
      pillar_label: selectedPillar?.label || selectedPillar?.nome || selectedPillar?.titolo || null,
      data_inizio: form.data_inizio || null,
      data_target: form.data_target || null,
      project_leader: form.project_leader,
      team_members: form.team_members,
      kpi: {
        nome_kpi: form.nome_kpi || null,
        unita: form.unita || null,
        baseline: toNumberOrNull(form.baseline),
        target: toNumberOrNull(form.target),
        actual: toNumberOrNull(form.actual),
        valore_finale: toNumberOrNull(form.valore_finale),
        saving_previsto: toNumberOrNull(form.saving_previsto),
        saving_verificato: toNumberOrNull(form.saving_verificato),
      },
    }
    const ok = await onSave(payload)
    setSaving(false)
    if (ok) setEditing(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {editing ? (
          <div className="flex gap-2">
            <button type="button" onClick={() => { setForm(buildForm(major)); setEditing(false) }} className="px-4 py-2 border rounded-lg text-sm">
              Annulla
            </button>
            <button type="button" onClick={save} disabled={saving || !form.titolo.trim()} className="px-4 py-2 bg-primary text-white rounded-lg text-sm flex items-center gap-2 disabled:opacity-50">
              <Save size={16} /> {saving ? 'Salvataggio...' : 'Salva Overview'}
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setEditing(true)} className="px-4 py-2 bg-primary text-white rounded-lg text-sm">
            Modifica Overview
          </button>
        )}
      </div>

      <Section title="Informazioni generali">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Titolo" editing={editing} value={form.titolo} onChange={value => setForm({ ...form, titolo: value })} />
          <DisplayField label="Route" value={`${major.route_nome || '—'}${major.route_versione ? ` · v${major.route_versione}` : ''}`} />
          <TextArea label="Descrizione" editing={editing} value={form.descrizione} onChange={value => setForm({ ...form, descrizione: value })} />
          <TextArea label="Motivo strategico" editing={editing} value={form.motivo_strategico} onChange={value => setForm({ ...form, motivo_strategico: value })} />
        </div>
      </Section>

      <Section title="Struttura e pianificazione">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <SelectField label="Reparto" editing={editing} value={form.reparto} options={reparti.filter(item => item.attivo !== false).map(item => ({ value: item.nome, label: item.nome }))} onChange={value => setForm({ ...form, reparto: value, linea: '', macchina: '' })} />
          <SelectField label="Linea" editing={editing} value={form.linea} disabled={!form.reparto} options={linee.map(item => ({ value: item.nome, label: item.nome }))} onChange={value => setForm({ ...form, linea: value, macchina: '' })} />
          <SelectField label="Macchina" editing={editing} value={form.macchina} disabled={!form.linea} options={macchine.map(item => ({ value: item.nome, label: item.nome }))} onChange={value => setForm({ ...form, macchina: value })} />
          <SelectField label="Pillar" editing={editing} value={form.pillar_id} options={pillars.map(item => ({ value: item._id, label: `${item.sigla || ''}${item.sigla ? ' · ' : ''}${item.label || item.nome || item.titolo || 'Pillar'}` }))} onChange={value => setForm({ ...form, pillar_id: value })} />
          <Field label="Data inizio" editing={editing} type="date" value={form.data_inizio} onChange={value => setForm({ ...form, data_inizio: value })} />
          <Field label="Data target" editing={editing} type="date" value={form.data_target} onChange={value => setForm({ ...form, data_target: value })} />
        </div>
      </Section>

      <Section title="Team di progetto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Project Leader</Label>
            {editing ? (
              <UserPicker
                value={form.project_leader?.id ? { id: form.project_leader.id, name: form.project_leader.nome } : null}
                onChange={selected => setForm({ ...form, project_leader: selected ? { id: selected.id, nome: selected.name } : null })}
                mode="single"
                placeholder="Seleziona Project Leader..."
              />
            ) : (
              <Value>{form.project_leader?.nome || '—'}</Value>
            )}
          </div>
          <div>
            <Label>Team Members</Label>
            {editing ? (
              <UserPicker
                value={form.team_members.map(item => ({ id: item.id, name: item.nome }))}
                onChange={selected => setForm({ ...form, team_members: selected.map(item => ({ id: item.id, nome: item.name })) })}
                mode="multi"
                placeholder="Aggiungi membri al team..."
              />
            ) : (
              <Value>{form.team_members.map(item => item.nome).filter(Boolean).join(', ') || '—'}</Value>
            )}
          </div>
        </div>
      </Section>

      <Section title="KPI e saving">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Field label="KPI" editing={editing} value={form.nome_kpi} onChange={value => setForm({ ...form, nome_kpi: value })} />
          <Field label="Unità" editing={editing} value={form.unita} onChange={value => setForm({ ...form, unita: value })} />
          <Field label="Baseline" editing={editing} type="number" value={form.baseline} onChange={value => setForm({ ...form, baseline: value })} />
          <Field label="Target" editing={editing} type="number" value={form.target} onChange={value => setForm({ ...form, target: value })} />
          <Field label="Actual" editing={editing} type="number" value={form.actual} onChange={value => setForm({ ...form, actual: value })} />
          <Field label="Valore finale" editing={editing} type="number" value={form.valore_finale} onChange={value => setForm({ ...form, valore_finale: value })} />
          <Field label="Saving previsto" editing={editing} type="number" value={form.saving_previsto} onChange={value => setForm({ ...form, saving_previsto: value })} />
          <Field label="Saving verificato" editing={editing} type="number" value={form.saving_verificato} onChange={value => setForm({ ...form, saving_verificato: value })} />
        </div>
      </Section>

      <LinkedKaizens majorId={major._id} />
      
      <Section title="Stato degli step">
        <div className="space-y-2">
          {steps.map(step => {
            const stato = stepsData[step.step_id]?.stato || 'non_iniziato'
            return (
              <div key={step.step_id} className="flex items-center gap-3 text-sm">
                <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold">{step.ordine}</span>
                <span className="flex-1">{step.titolo}</span>
                <span className={`text-xs px-2 py-0.5 rounded ${stato === 'completato' ? 'bg-green-100 text-green-700' : stato === 'in_corso' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'}`}>
                  {stato === 'completato' ? 'Completato' : stato === 'in_corso' ? 'In corso' : 'Non iniziato'}
                </span>
              </div>
            )
          })}
        </div>
      </Section>
    </div>
  )
}

function buildForm(major) {
  const legacy = major.ruoli_progetto || {}
  const kpi = major.kpi || {}
  return {
    titolo: major.titolo || '',
    descrizione: major.descrizione || '',
    motivo_strategico: major.motivo_strategico || '',
    reparto: major.reparto || '',
    linea: major.linea || '',
    macchina: major.macchina || '',
    pillar_id: major.pillar_id || '',
    data_inizio: normalizeDate(major.data_inizio),
    data_target: normalizeDate(major.data_target),
    project_leader: major.project_leader || legacy.project_leader || null,
    team_members: major.team_members || legacy.team_members || [],
    nome_kpi: kpi.nome_kpi || '',
    unita: kpi.unita || '',
    baseline: valueOrEmpty(kpi.baseline),
    target: valueOrEmpty(kpi.target),
    actual: valueOrEmpty(kpi.actual),
    valore_finale: valueOrEmpty(kpi.valore_finale),
    saving_previsto: valueOrEmpty(kpi.saving_previsto),
    saving_verificato: valueOrEmpty(kpi.saving_verificato),
  }
}

function normalizeDate(value) {
  if (!value) return ''
  return String(value).slice(0, 10)
}

function valueOrEmpty(value) {
  return value === null || value === undefined ? '' : value
}

function toNumberOrNull(value) {
  if (value === '' || value === null || value === undefined) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function Section({ title, children }) {
  return <div className="bg-white rounded-xl shadow p-4"><h3 className="font-bold text-gray-800 mb-3">{title}</h3>{children}</div>
}

function Label({ children }) {
  return <div className="text-xs font-semibold text-gray-500 uppercase mb-1">{children}</div>
}

function Value({ children }) {
  return <div className="text-sm font-medium text-gray-800 min-h-10 flex items-center">{children}</div>
}

function DisplayField({ label, value }) {
  return <div><Label>{label}</Label><Value>{value || '—'}</Value></div>
}

function Field({ label, editing, value, onChange, type = 'text' }) {
  return <div><Label>{label}</Label>{editing ? <input type={type} value={value} onChange={event => onChange(event.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" /> : <Value>{value !== '' && value !== null && value !== undefined ? value : '—'}</Value>}</div>
}

function TextArea({ label, editing, value, onChange }) {
  return <div><Label>{label}</Label>{editing ? <textarea rows={4} value={value} onChange={event => onChange(event.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" /> : <Value>{value || '—'}</Value>}</div>
}

function SelectField({ label, editing, value, options, onChange, disabled = false }) {
  const selectedLabel = options.find(option => option.value === value)?.label || value || '—'
  return <div><Label>{label}</Label>{editing ? <select value={value} onChange={event => onChange(event.target.value)} disabled={disabled} className="w-full border rounded-lg px-3 py-2 text-sm disabled:bg-gray-100"><option value="">Seleziona</option>{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : <Value>{selectedLabel}</Value>}</div>
}
