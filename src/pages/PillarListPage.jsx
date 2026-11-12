import { useState } from 'react'
import { Link } from 'react-router-dom'
import { usePillars } from '../hooks/usePillars'

export default function PillarListPage() {
  const { pillars, loading } = usePillars(true)
  const [search, setSearch] = useState('')
  const items = Array.isArray(pillars) ? pillars : []
  const query = search.trim().toLowerCase()
  const filtered = items.filter(item => !query || [item.sigla, item.label].some(value => String(value || '').toLowerCase().includes(query)))
  return (
    <div className="space-y-5" data-layout="pillars-clean-list">
      <h1 className="text-2xl font-bold text-gray-900">Pillars TPM</h1>
      <label className="block text-sm text-gray-600">
        Cerca pilastro
        <input type="search" value={search} onChange={event => setSearch(event.target.value)} className="mt-1 w-full max-w-xl border border-gray-300 rounded px-3 py-2 bg-white" placeholder="Sigla o nome" />
      </label>
      {loading ? <p role="status" className="text-sm text-gray-500">Caricamento...</p> : !filtered.length ? <p className="text-sm text-gray-500">Nessun pilastro trovato.</p> : (
        <ul className="divide-y divide-gray-300">
          {filtered.map(item => (
            <li key={item._id} className="flex items-center gap-4 py-5">
              {item.icon_image && <img src={item.icon_image} alt="" className="h-12 w-12 shrink-0 object-contain" onError={event => { event.currentTarget.style.display = 'none' }} />}
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold text-gray-900 break-words">{item.sigla}</h2>
                <p className="text-sm text-gray-600 break-words">{item.label}</p>
              </div>
              <Link to={`/pillars/${item._id}`} aria-label={`Apri Pillar ${item.sigla || ''}`} className="shrink-0 text-sm text-gray-800 underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">Apri Pillar</Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
