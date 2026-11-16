import { Link } from 'react-router-dom'
import { usePillars } from '../hooks/usePillars'

const COLUMNS = [
  { key: 'AM', label: 'AM', name: 'AUTONOMOUS MAINTENANCE', color: '#f08a1c', match: ['AM'] },
  { key: 'PM', label: 'PM', name: 'PLANNED MAINTENANCE', color: '#1d3f8f', match: ['PM'] },
  { key: 'FI', label: 'FI', name: 'FOCUSED IMPROVEMENT', color: '#2e9e4f', match: ['FI'] },
  { key: 'TE', label: 'T&E', name: 'TRAINING & EDUCATION', color: '#8a5a2b', match: ['TE', 'T&E'] },
  { key: 'QM', label: 'QM', name: 'QUALITY MAINTENANCE', color: '#6b2fa0', match: ['QM'] },
  { key: 'EEM', label: 'EEM', name: 'EARLY EQUIPMENT MANAGEMENT', color: '#7b8590', match: ['EEM'] },
  { key: 'EPM', label: 'EPM', name: 'EARLY PRODUCT MANAGEMENT', color: '#7b8590', match: ['EPM'] },
  { key: 'S', label: 'S', name: 'SAFETY', color: '#d62d2d', match: ['SAF', 'S'] },
  { key: 'TO', label: 'TO', name: 'TPM OFFICE', color: '#1aa5b8', match: ['TO'] },
  { key: 'LF', label: 'LF', name: 'LOGISTIC', color: '#1f1f1f', match: ['L', 'LF'] },
  { key: 'E2E', label: 'E2E', name: 'E2E VALUE CHAIN', color: '#2f4bd6', match: ['E2E'] },
  { key: 'E', label: 'E', name: 'ENVIRONMENT', color: '#7ab51d', match: ['ENV', 'E'] },
]
const COST = { key: 'COST', label: 'COST DEPLOYMENT', color: '#a98a3a', match: ['COST'] }

const normalize = value => String(value || '').trim().toUpperCase()

function findPillar(pillars, definition) {
  return pillars.find(item => item.attivo !== false && definition.match.includes(normalize(item.sigla)))
}

function PillarIcon({ src }) {
  if (!src) return <span className="pillar-icon-space" aria-hidden="true" />
  return <img src={src} alt="" className="pillar-icon" onError={event => { event.currentTarget.style.visibility = 'hidden' }} />
}

function Column({ definition, pillar }) {
  const active = Boolean(pillar)
  const content = (
    <>
      <span className="pillar-cap" aria-hidden="true" />
      <span className="pillar-sigla" style={{ color: active ? definition.color : undefined }}>{definition.label}</span>
      <PillarIcon src={pillar?.icon_image} />
      <span className="pillar-name">{definition.name}</span>
      <span className="pillar-base" aria-hidden="true" />
    </>
  )
  if (active) {
    return (
      <Link to={`/pillars/${pillar._id}`} aria-label={`Apri Pillar ${pillar.sigla} · ${pillar.label}`} className="pillar-col pillar-on">
        {content}
      </Link>
    )
  }
  return (
    <span className="pillar-col pillar-off" role="img" aria-label={`${definition.name}: non configurato`} title="Non configurato">
      {content}
    </span>
  )
}

function Beam({ definition, pillar, className = '' }) {
  const active = Boolean(pillar)
  const body = <span style={{ color: active ? definition.color : undefined }}>{definition.label}</span>
  return active
    ? <Link to={`/pillars/${pillar._id}`} aria-label={`Apri Pillar ${pillar.sigla} · ${pillar.label}`} className={`pillar-beam pillar-on ${className}`}>{body}</Link>
    : <span className={`pillar-beam pillar-off ${className}`} title="Non configurato">{body}</span>
}

const CSS = `
.pillar-temple{max-width:1180px;margin:0;color:#1f2937}
.pillar-temple *{box-sizing:border-box}
.pillar-roof{display:block;width:100%;height:auto}
.pillar-layer{display:flex;align-items:center;justify-content:center;gap:10px;border:1px solid #cfd3d8;background:#eceef1;color:#1f2937;font-weight:700;letter-spacing:.04em;text-align:center;padding:10px 14px;margin-top:8px;text-decoration:none;font-size:15px}
.pillar-layer.pillar-off{opacity:.45}
.pillar-beam{display:flex;align-items:center;justify-content:center;margin-top:8px;padding:10px 14px;border:1px solid #cfd3d8;background:#eceef1;font-weight:800;letter-spacing:.05em;text-decoration:none;color:#1f2937;font-size:15px}
.pillar-beam.pillar-on:hover{background:#f6f7f8;border-color:#8b929c}
.pillar-beam.pillar-off{opacity:.45;cursor:not-allowed}
.pillar-row{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:8px;margin-top:8px}
.pillar-col{display:flex;flex-direction:column;align-items:center;gap:8px;padding:0 0 8px;min-height:340px;border:1px solid #cfd3d8;border-radius:4px;background:#f1f2f4;text-decoration:none;color:#1f2937;transition:transform .12s,box-shadow .12s,border-color .12s}
.pillar-cap{display:block;width:calc(100% + 2px);height:12px;margin:-1px -1px 0;background:#d7dae0;border:1px solid #bfc4cc;border-radius:5px 5px 0 0}
.pillar-sigla{font-weight:800;font-size:18px;letter-spacing:.02em;line-height:1.1;margin-top:4px;color:#9aa0a8}
.pillar-icon{width:38px;height:38px;object-fit:contain;flex-shrink:0;border-radius:999px}
.pillar-icon-space{display:block;width:38px;height:38px;flex-shrink:0}
.pillar-name{writing-mode:vertical-rl;transform:rotate(180deg);font-weight:700;font-size:13px;letter-spacing:.07em;line-height:1.2;text-align:center;flex:1;display:flex;align-items:center;justify-content:center;color:#2b3340;max-height:230px}
.pillar-base{display:block;width:calc(100% + 2px);height:10px;margin:0 -1px -9px;background:#d7dae0;border:1px solid #bfc4cc;border-radius:0 0 4px 4px}
.pillar-on{background:#fff;border-color:#b7bcc4}
.pillar-on:hover,.pillar-on:focus-visible{transform:translateY(-2px);box-shadow:0 6px 14px rgba(31,41,55,.14);border-color:#6b7280;outline:none}
.pillar-on:focus-visible{outline:2px solid #6b7280;outline-offset:2px}
.pillar-off{opacity:.42;filter:grayscale(1);cursor:not-allowed}
.pillar-off .pillar-name{color:#6b7280}
.pillar-foot{display:block;margin-top:8px;padding:10px 14px;border:1px solid #cfd3d8;background:#e2e5e9;font-weight:700;text-align:center;letter-spacing:.04em;color:#1f2937;font-size:14px}
.pillar-foot-5s{background:#eceef1;font-size:16px}
.pillar-list{display:none}
@media(max-width:820px){
  .pillar-roof,.pillar-row,.pillar-layer,.pillar-beam,.pillar-foot{display:none}
  .pillar-list{display:block}
}
.pillar-item{display:flex;align-items:center;gap:12px;padding:12px 14px;border:1px solid #cfd3d8;border-radius:8px;background:#fff;margin-top:8px;text-decoration:none;color:#1f2937;min-height:56px}
.pillar-item .pillar-icon{width:32px;height:32px}
.pillar-item .item-sigla{font-weight:800;font-size:16px;min-width:46px}
.pillar-item .item-name{font-size:13px;color:#4b5563;overflow-wrap:anywhere}
.pillar-item.pillar-off{opacity:.42;filter:grayscale(1);cursor:not-allowed}
.pillar-item.pillar-on:hover,.pillar-item.pillar-on:focus-visible{border-color:#6b7280;outline:none}
@media(prefers-reduced-motion:reduce){.pillar-col{transition:none}.pillar-on:hover,.pillar-on:focus-visible{transform:none}}
`

function Roof() {
  return (
    <svg className="pillar-roof" viewBox="0 0 1000 150" role="img" aria-label="Hoshin Kanri" preserveAspectRatio="xMidYMid meet">
      <polygon points="6,146 500,8 994,146" fill="#eceef1" stroke="#cfd3d8" strokeWidth="2" />
      <circle cx="500" cy="54" r="22" fill="#fff" stroke="#1f2937" strokeWidth="3" />
      <path d="M500 38 L510 54 L500 70 L490 54 Z" fill="#1f2937" />
      <text x="500" y="112" textAnchor="middle" fontSize="30" fontWeight="800" fill="#1f2937" letterSpacing="2">HOSHIN KANRI</text>
    </svg>
  )
}

export default function PillarListPage() {
  const { pillars, loading } = usePillars(true)
  const items = Array.isArray(pillars) ? pillars : []
  const costPillar = findPillar(items, COST)
  const matched = new Set()
  COLUMNS.forEach(column => { const found = findPillar(items, column); if (found) matched.add(found._id) })
  if (costPillar) matched.add(costPillar._id)
  const others = items.filter(item => item.attivo !== false && !matched.has(item._id))

  return (
    <div className="pillar-temple" data-layout="pillar-temple-v1">
      <style>{CSS}</style>
      <h1 className="text-2xl font-bold text-gray-900 mb-4" style={{ maxWidth: 1180 }}>Pillars TPM</h1>
      {loading ? (
        <p role="status" className="text-sm text-gray-500">Caricamento pilastri...</p>
      ) : (
        <>
          <Roof />
          <Beam definition={COST} pillar={costPillar} className="pillar-cost" />
          <span className="pillar-layer pillar-off" style={{ opacity: 1, cursor: 'default' }}>DIGITAL OPERATIONS</span>
          <div className="pillar-row" role="list">
            {COLUMNS.map(column => (
              <div role="listitem" key={column.key} style={{ display: 'contents' }}>
                <Column definition={column} pillar={findPillar(items, column)} />
              </div>
            ))}
          </div>
          <span className="pillar-foot pillar-foot-5s">5S</span>
          <span className="pillar-foot">PCS – Performance Control System</span>

          <div className="pillar-list" role="list">
            {[...COLUMNS, COST].map(definition => {
              const pillar = findPillar(items, definition)
              const body = (
                <>
                  {pillar?.icon_image && <PillarIcon src={pillar.icon_image} />}
                  <span className="item-sigla" style={{ color: pillar ? definition.color : undefined }}>{definition.label}</span>
                  <span className="item-name">{definition.name || 'COST DEPLOYMENT'}</span>
                </>
              )
              return pillar
                ? <Link key={definition.key} role="listitem" to={`/pillars/${pillar._id}`} className="pillar-item pillar-on">{body}</Link>
                : <span key={definition.key} role="listitem" className="pillar-item pillar-off" title="Non configurato">{body}</span>
            })}
          </div>

          {others.length > 0 && (
            <div className="mt-6">
              <h2 className="text-sm font-semibold text-gray-600 mb-2">Altri pilastri</h2>
              {others.map(item => (
                <Link key={item._id} to={`/pillars/${item._id}`} className="pillar-item pillar-on">
                  {item.icon_image && <img src={item.icon_image} alt="" className="pillar-icon" onError={event => { event.currentTarget.style.display = 'none' }} />}
                  <span className="item-sigla">{item.sigla}</span>
                  <span className="item-name">{item.label}</span>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
