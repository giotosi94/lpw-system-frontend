import { useState } from 'react'
import { Link } from 'react-router-dom'
import { usePillars } from '../hooks/usePillars'

function PillarLogo({ src }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) return null
  return <img src={src} alt="" onError={() => setFailed(true)} style={{ width: 64, height: 64, maxWidth: 64, maxHeight: 64, objectFit: 'contain', flexShrink: 0, display: 'block' }} />
}

export default function PillarListPage() {
  const { pillars, loading } = usePillars(true)
  const [search, setSearch] = useState('')
  const items = Array.isArray(pillars) ? pillars : []
  const query = search.trim().toLocaleLowerCase('it-IT')
  const filtered = items.filter(item => !query || [item.sigla, item.label].some(value => String(value || '').toLocaleLowerCase('it-IT').includes(query)))

  return (
    <div className="space-y-5" data-layout="pillars-compact-tiles-v1">
      <h1 className="text-2xl font-bold text-gray-900">Pillars TPM</h1>
      <label className="block text-sm text-gray-600" style={{ display: 'block', maxWidth: 560 }}>
        Cerca pilastro
        <input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Sigla o nome" className="mt-1 w-full border border-gray-300 rounded px-3 py-2 bg-white" style={{ display: 'block', width: '100%', boxSizing: 'border-box' }} />
      </label>
      {loading ? <p role="status" className="text-sm text-gray-500">Caricamento pilastri...</p> : !filtered.length ? <p className="text-sm text-gray-500">Nessun pilastro trovato.</p> : (
        <ul style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 250px), 1fr))', gap: 16, padding: 0, margin: 0, listStyle: 'none' }}>
          {filtered.map(item => (
            <li key={item._id} style={{ minWidth: 0 }}>
              <Link to={`/pillars/${item._id}`} aria-label={`Apri Pillar ${item.sigla || item.label || ''}`} className="hover:border-gray-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-600" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 20, minHeight: 112, height: '100%', boxSizing: 'border-box', border: '1px solid #d1d5db', borderRadius: 10, backgroundColor: '#ffffff', color: '#111827', textDecoration: 'none' }}>
                <PillarLogo key={item.icon_image || 'no-logo'} src={item.icon_image} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <h2 style={{ margin: '0 0 5px', fontSize: 18, fontWeight: 700, overflowWrap: 'anywhere' }}>{item.sigla}</h2>
                  <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: '#4b5563', overflowWrap: 'anywhere' }}>{item.label}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
