import { useState, useEffect, useMemo } from 'react'
import api from '../services/api'
import {
  Users, Plus, Edit2, Trash2, Search, X, Save,
  Briefcase, Factory, MapPin, Mail, RefreshCw
} from 'lucide-react'

const RUOLI = [
  { value: 'admin', label: 'Amministratore', color: 'bg-red-100 text-red-700' },
  { value: 'manager', label: 'Manager', color: 'bg-purple-100 text-purple-700' },
  { value: 'office', label: 'Ufficio', color: 'bg-blue-100 text-blue-700' },
  { value: 'operator', label: 'Operatore', color: 'bg-green-100 text-green-700' },
]

export default function UsersPage() {
  const [users, setUsers] = useState([])
  const [pillars, setPillars] = useState([])
  const [reparti, setReparti] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [search, setSearch] = useState('')
  const [filterRuolo, setFilterRuolo] = useState('')
  const [showInactive, setShowInactive] = useState(false)

  useEffect(() => {
    load()
  }, [showInactive])

  async function load() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (showInactive) params.append('include_inactive', 'true')
      const [usersRes, pillarsRes, repartiRes] = await Promise.all([
        api.get(`/users/?${params.toString()}`),
        api.get('/pillars/').catch(() => ({ data: [] })),
        api.get('/reparti/').catch(() => ({ data: [] })),
      ])
      setUsers(usersRes.data || [])
      setPillars(pillarsRes.data || [])
      setReparti(repartiRes.data || [])
    } catch (err) {
      console.error(err)
      alert('Errore caricamento utenti')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(user) {
    if (!confirm(`Disattivare "${user.full_name}"?\n\nL'utente non verrà eliminato ma sarà disattivato.`)) return
    try {
      await api.delete(`/users/${user.id}`)
      load()
    } catch (err) {
      alert('Errore: ' + (err.response?.data?.detail || err.message))
    }
  }

  async function handleReactivate(user) {
    try {
      await api.put(`/users/${user.id}`, { is_active: true })
      load()
    } catch (err) {
      alert('Errore: ' + (err.response?.data?.detail || err.message))
    }
  }

  const filtered = useMemo(() => {
    return users.filter(u => {
      if (filterRuolo && u.role !== filterRuolo) return false
      if (!search) return true
      const s = search.toLowerCase()
      return (
        u.full_name?.toLowerCase().includes(s) ||
        u.username?.toLowerCase().includes(s) ||
        u.email?.toLowerCase().includes(s) ||
        u.upn?.toLowerCase().includes(s) ||
        u.reparto?.toLowerCase().includes(s) ||
        u.job_title?.toLowerCase().includes(s)
      )
    })
  }, [users, search, filterRuolo])

  const counts = useMemo(() => ({
    totale: users.length,
    admin: users.filter(u => u.role === 'admin').length,
    manager: users.filter(u => u.role === 'manager').length,
    office: users.filter(u => u.role === 'office').length,
    operator: users.filter(u => u.role === 'operator').length,
  }), [users])

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users size={28} /> Gestione Utenti
          </h1>
          <p className="text-gray-500 text-sm">
            Configura ruoli, reparti, linee e associazioni Pillar per ogni utente
          </p>
        </div>
        <button
          onClick={() => { setEditingUser(null); setShowForm(true) }}
          className="bg-primary text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-primary-light shadow-sm"
        >
          <Plus size={20} /> Nuovo Utente
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatBlock label="Totale" value={counts.totale} color="gray" />
        <StatBlock label="Admin" value={counts.admin} color="red" />
        <StatBlock label="Manager" value={counts.manager} color="purple" />
        <StatBlock label="Ufficio" value={counts.office} color="blue" />
        <StatBlock label="Operatori" value={counts.operator} color="green" />
      </div>

      <div className="bg-white p-3 rounded-lg shadow-sm flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cerca per nome, email, reparto..."
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm"
          />
        </div>
        <select
          value={filterRuolo}
          onChange={(e) => setFilterRuolo(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm"
        >
          <option value="">Tutti i ruoli</option>
          {RUOLI.map(r => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="w-4 h-4"
          />
          Mostra disattivati
        </label>
        <span className="text-sm text-gray-500 ml-auto">
          {filtered.length} utenti
        </span>
      </div>

      {loading ? (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center text-gray-400">
          Caricamento utenti...
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
          <Users size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 mb-3">Nessun utente trovato</p>
          <button
            onClick={() => { setEditingUser(null); setShowForm(true) }}
            className="text-primary hover:underline"
          >
            + Crea il primo utente
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b text-xs uppercase text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left">Utente</th>
                <th className="px-3 py-2 text-left w-32">Ruolo</th>
                <th className="px-3 py-2 text-left">Reparto / Linee</th>
                <th className="px-3 py-2 text-left">Pillar</th>
                <th className="px-3 py-2 text-left w-24">Stato</th>
                <th className="px-3 py-2 text-center w-24">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => {
                const ruoloInfo = RUOLI.find(r => r.value === u.role) || RUOLI[2]
                const userPillars = pillars.filter(p =>
                  p.members_ids?.includes(u.id) ||
                  p.leader_id === u.id ||
                  p.members?.includes(u.full_name) ||
                  p.leader === u.full_name
                )
                return (
                  <tr key={u.id} className={`border-b hover:bg-gray-50 ${!u.is_active ? 'opacity-60' : ''}`}>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <UserAvatar name={u.full_name} />
                        <div>
                          <div className="font-medium">{u.full_name || u.username}</div>
                          <div className="text-xs text-gray-500">
                            <Mail size={10} className="inline mr-1" />{u.upn || u.email}
                          </div>
                          {u.job_title && (
                            <div className="text-xs text-gray-500 mt-0.5">
                              <Briefcase size={10} className="inline mr-1" />{u.job_title}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${ruoloInfo.color}`}>
                        {ruoloInfo.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {u.reparto && (
                        <div className="flex items-center gap-1 text-gray-700">
                          <Factory size={12} />{u.reparto}
                        </div>
                      )}
                      {u.linee?.length > 0 && (
                        <div className="flex items-center gap-1 text-gray-500 mt-0.5">
                          <MapPin size={12} />{u.linee.join(', ')}
                        </div>
                      )}
                      {u.team && (
                        <div className="text-xs text-gray-500 mt-0.5">Team: {u.team}</div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {userPillars.length === 0 ? (
                        <span className="text-gray-400">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {userPillars.slice(0, 3).map(p => {
                            const isLeader = p.leader_id === u.id || p.leader === u.full_name
                            return (
                              <span
                                key={p._id}
                                className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold"
                                style={{
                                  backgroundColor: (p.color || '#6366f1') + '20',
                                  color: p.color || '#6366f1'
                                }}
                                title={`${p.sigla} - ${p.label}${isLeader ? ' (Leader)' : ''}`}
                              >
                                {p.sigla}{isLeader && '★'}
                              </span>
                            )
                          })}
                          {userPillars.length > 3 && (
                            <span className="text-[10px] text-gray-400">+{userPillars.length - 3}</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-1 rounded-full text-xs ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
                        {u.is_active ? 'Attivo' : 'Disattivo'}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-center gap-1">
                        <button
                          onClick={() => { setEditingUser(u); setShowForm(true) }}
                          className="p-1 hover:bg-yellow-100 rounded text-yellow-600"
                          title="Modifica"
                        >
                          <Edit2 size={14} />
                        </button>
                        {u.is_active ? (
                          <button
                            onClick={() => handleDelete(u)}
                            className="p-1 hover:bg-red-100 rounded text-red-600"
                            title="Disattiva"
                          >
                            <Trash2 size={14} />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleReactivate(u)}
                            className="p-1 hover:bg-green-100 rounded text-green-600"
                            title="Riattiva"
                          >
                            <RefreshCw size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <UserForm
          user={editingUser}
          pillars={pillars}
          reparti={reparti}
          onClose={() => { setShowForm(false); setEditingUser(null) }}
          onSaved={() => { setShowForm(false); setEditingUser(null); load() }}
        />
      )}
    </div>
  )
}

function UserForm({ user, reparti, onClose, onSaved }) {
  const [form, setForm] = useState({
    upn: user?.upn || user?.email || '',
    full_name: user?.full_name || '',
    role: user?.role || 'operator',
    job_title: user?.job_title || '',
    telefono: user?.telefono || '',
    reparto: user?.reparto || '',
    linee: user?.linee || [],
    team: user?.team || '',
    macchine: user?.macchine || [],
  })
  const [saving, setSaving] = useState(false)

  const lineeDisponibili = useMemo(() => {
    if (!form.reparto) return []
    const rep = reparti.find(r => r.nome === form.reparto)
    return rep?.linee?.filter(l => l.attivo !== false) || []
  }, [form.reparto, reparti])

  const macchineDisponibili = useMemo(() => {
    const allMacchine = []
    form.linee.forEach(lineaName => {
      const linea = lineeDisponibili.find(l => l.nome === lineaName)
      if (linea?.macchine) {
        linea.macchine.filter(m => m.attivo !== false).forEach(m => allMacchine.push(m.nome))
      }
    })
    return allMacchine
  }, [form.linee, lineeDisponibili])

  function toggleLinea(nome) {
    setForm(f => ({
      ...f,
      linee: f.linee.includes(nome)
        ? f.linee.filter(l => l !== nome)
        : [...f.linee, nome]
    }))
  }

  function toggleMacchina(nome) {
    setForm(f => ({
      ...f,
      macchine: f.macchine.includes(nome)
        ? f.macchine.filter(m => m !== nome)
        : [...f.macchine, nome]
    }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const upn = form.upn.trim().toLowerCase()
    if (!form.full_name.trim() || !upn.includes('@')) {
      alert('Nome completo e utente aziendale (nome.cognome@lindt.com) sono obbligatori')
      return
    }
    setSaving(true)
    try {
      if (user?.id) {
        const { upn: _upn, ...payload } = form
        await api.put(`/users/${user.id}`, payload)
      } else {
        await api.post('/auth/preregister', { ...form, upn })
      }
      onSaved()
    } catch (err) {
      alert('Errore: ' + (err.response?.data?.detail || err.message))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[95vh] overflow-y-auto">
        <div className="bg-primary text-white px-6 py-3 flex justify-between items-center sticky top-0 z-10">
          <h2 className="text-lg font-semibold">
            {user ? `Modifica ${user.full_name}` : 'Nuovo Utente'}
          </h2>
          <button onClick={onClose} className="hover:bg-primary-light p-1 rounded">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <Section title="Anagrafica">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nome completo *">
                <input
                  required
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </Field>
              <Field label="Utente aziendale *">
                <input
                  required
                  disabled={!!user}
                  value={form.upn}
                  onChange={(e) => setForm({ ...form, upn: e.target.value.toLowerCase() })}
                  className="w-full border rounded-lg px-3 py-2 disabled:bg-gray-100 disabled:text-gray-500"
                  placeholder="nome.cognome@lindt.com"
                  autoCapitalize="none"
                  spellCheck={false}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Job Title (ruolo aziendale)">
                <input
                  value={form.job_title}
                  onChange={(e) => setForm({ ...form, job_title: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="es: TPM Development Engineer"
                />
              </Field>
              <Field label="Telefono">
                <input
                  value={form.telefono}
                  onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </Field>
            </div>
          </Section>

          <Section title="Ruolo e Permessi">
            <Field label="Ruolo *">
              <div className="grid grid-cols-4 gap-2">
                {RUOLI.map(r => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setForm({ ...form, role: r.value })}
                    className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                      form.role === r.value
                        ? r.color + ' border-current shadow'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              <div className="text-xs text-gray-500 mt-2">
                <strong>Operator:</strong> vede solo AP del suo reparto/linee.{' '}
                <strong>Office:</strong> vede tutto.{' '}
                <strong>Manager:</strong> dashboard executive.{' '}
                <strong>Admin:</strong> gestisce utenti.
              </div>
            </Field>
          </Section>

          <Section title="Assegnazione produzione (per operatori)">
            <Field label="Reparto">
              <select
                value={form.reparto}
                onChange={(e) => setForm({ ...form, reparto: e.target.value, linee: [], macchine: [] })}
                className="w-full border rounded-lg px-3 py-2"
              >
                <option value="">— Nessuno —</option>
                {reparti.filter(r => r.attivo !== false).map(r => (
                  <option key={r._id} value={r.nome}>{r.nome}</option>
                ))}
              </select>
            </Field>

            {lineeDisponibili.length > 0 && (
              <Field label={`Linee assegnate (${form.linee.length})`}>
                <div className="border rounded-lg p-2 max-h-32 overflow-y-auto">
                  {lineeDisponibili.map(linea => (
                    <label key={linea.id} className="flex items-center gap-2 p-1.5 hover:bg-gray-50 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.linee.includes(linea.nome)}
                        onChange={() => toggleLinea(linea.nome)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">{linea.nome}</span>
                      {linea.codice && <span className="text-xs text-gray-500 font-mono">[{linea.codice}]</span>}
                    </label>
                  ))}
                </div>
              </Field>
            )}

            {macchineDisponibili.length > 0 && (
              <Field label={`Macchine specifiche (${form.macchine.length})`}>
                <div className="border rounded-lg p-2 max-h-32 overflow-y-auto">
                  {macchineDisponibili.map(macchina => (
                    <label key={macchina} className="flex items-center gap-2 p-1.5 hover:bg-gray-50 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.macchine.includes(macchina)}
                        onChange={() => toggleMacchina(macchina)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">{macchina}</span>
                    </label>
                  ))}
                </div>
              </Field>
            )}

            <Field label="Team / Squadra (libero)">
              <input
                value={form.team}
                onChange={(e) => setForm({ ...form, team: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
                placeholder="es: Turno A, Manutenzione, TPM"
              />
            </Field>
          </Section>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg">
              Annulla
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-light disabled:opacity-50 flex items-center gap-2"
            >
              <Save size={16} />
              {saving ? 'Salvataggio...' : (user ? 'Salva modifiche' : 'Crea Utente')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function StatBlock({ label, value, color }) {
  const colors = {
    gray: 'text-gray-700 bg-gray-50',
    red: 'text-red-700 bg-red-50',
    purple: 'text-purple-700 bg-purple-50',
    blue: 'text-blue-700 bg-blue-50',
    green: 'text-green-700 bg-green-50',
  }
  return (
    <div className={`rounded-lg p-3 text-center ${colors[color] || colors.gray}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs uppercase font-medium">{label}</div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="space-y-3">
      <h3 className="font-bold text-sm uppercase text-gray-700 border-b pb-1">{title}</h3>
      {children}
    </div>
  )
}

function UserAvatar({ name, size = 36 }) {
  if (!name) return null
  const initials = name.split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase()
  const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-yellow-500', 'bg-orange-500']
  const color = colors[name.charCodeAt(0) % colors.length]
  return (
    <div
      className={`${color} text-white rounded-full flex items-center justify-center font-bold flex-shrink-0`}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initials}
    </div>
  )
}
