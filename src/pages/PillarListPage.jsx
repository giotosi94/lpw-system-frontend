import { Link } from 'react-router-dom'
import { usePillars } from '../hooks/usePillars'

const COLUMNS = [
  { key: 'AM', label: 'AM', name: 'AUTONOMOUS MAINTENANCE', color: '#c2570c', match: ['AM'] },
  { key: 'PM', label: 'PM', name: 'PLANNED MAINTENANCE', color: '#1d3f8f', match: ['PM'] },
  { key: 'FI', label: 'FI', name: 'FOCUSED IMPROVEMENT', color: '#23813f', match: ['FI'] },
  { key: 'TE', label: 'T&E', name: 'TRAINING & EDUCATION', color: '#7a4a21', match: ['TE', 'T&E'] },
  { key: 'QM', label: 'QM', name: 'QUALITY MAINTENANCE', color: '#6b2fa0', match: ['QM'] },
  { key: 'EEM', label: 'EEM', name: 'EARLY EQUIPMENT MANAGEMENT', color: '#56616d', match: ['EEM'] },
  { key: 'EPM', label: 'EPM', name: 'EARLY PRODUCT MANAGEMENT', color: '#56616d', match: ['EPM'] },
  { key: 'S', label: 'S', name: 'SAFETY', color: '#c42626', match: ['SAF', 'S'] },
  { key: 'TO', label: 'TO', name: 'TPM OFFICE', color: '#0f7f90', match: ['TO'] },
  { key: 'LF', label: 'LF', name: 'LOGISTIC', color: '#1f1f1f', match: ['L', 'LF'] },
  { key: 'E2E', label: 'E2E', name: 'E2E VALUE CHAIN', color: '#2f4bd6', match: ['E2E'] },
  { key: 'E', label: 'E', name: 'ENVIRONMENT', color: '#4f7d0e', match: ['ENV', 'E'] },
]
const COST = { key: 'COST', label: 'COST DEPLOYMENT', name: 'COST DEPLOYMENT', color: '#7a5a14', match: ['COST'] }

const normalize = value => String(value || '').trim().toUpperCase()

function findPillar(pillars, definition) {
  return pillars.find(item => item.attivo !== false && definition.match.includes(normalize(item.sigla)))
}

function Defs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="pt-stone" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fbf8f1" />
          <stop offset="1" stopColor="#e4dccb" />
        </linearGradient>
        <linearGradient id="pt-stone-h" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#d6cdb9" />
          <stop offset=".5" stopColor="#fffdf8" />
          <stop offset="1" stopColor="#d6cdb9" />
        </linearGradient>
        <linearGradient id="pt-tympanum" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f3ecdc" />
          <stop offset="1" stopColor="#e9dfc8" />
        </linearGradient>
        <linearGradient id="pt-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e9cf86" />
          <stop offset=".5" stopColor="#b8913a" />
          <stop offset="1" stopColor="#8a6a1f" />
        </linearGradient>
      </defs>
    </svg>
  )
}

function Roof() {
  return (
    <svg className="pt-roof" viewBox="0 0 1000 190" role="img" aria-label="Hoshin Kanri" preserveAspectRatio="xMidYMid meet">
      <polygon points="0,190 500,4 1000,190" fill="url(#pt-stone)" stroke="#b9ad92" strokeWidth="2" />
      <polygon points="64,178 500,34 936,178" fill="url(#pt-tympanum)" stroke="#cdbf9f" strokeWidth="2" />
      <polygon points="64,178 500,34 936,178" fill="none" stroke="#fff" strokeOpacity=".7" strokeWidth="1" transform="translate(0 3)" />
      <g transform="translate(500 92)">
        <circle r="28" fill="#fffdf8" stroke="url(#pt-gold)" strokeWidth="3" />
        <circle r="21" fill="none" stroke="#3b2a1c" strokeOpacity=".25" strokeWidth="1" strokeDasharray="2 3" />
        <path d="M0 -20 L5 -5 L20 0 L5 5 L0 20 L-5 5 L-20 0 L-5 -5 Z" fill="#3b2a1c" />
        <circle r="3" fill="url(#pt-gold)" />
      </g>
      <text x="500" y="158" textAnchor="middle" fontSize="27" fontWeight="800" fill="#3b2a1c" letterSpacing="7">HOSHIN KANRI</text>
    </svg>
  )
}

function Capital() {
  return (
    <svg className="pt-capital" viewBox="0 0 100 34" preserveAspectRatio="xMidYMax meet" aria-hidden="true" focusable="false">
      <rect x="1" y="0" width="98" height="7" rx="1.5" fill="url(#pt-stone)" stroke="#b9ad92" strokeWidth=".8" />
      <path d="M9 7 H91 L85 20 H15 Z" fill="url(#pt-stone-h)" stroke="#b9ad92" strokeWidth=".8" />
      <rect x="15" y="17" width="70" height="9" fill="url(#pt-stone-h)" stroke="#b9ad92" strokeWidth=".8" />
      <circle cx="13" cy="19" r="9" fill="url(#pt-stone)" stroke="#b9ad92" strokeWidth=".8" />
      <circle cx="13" cy="19" r="5.2" fill="none" stroke="#b9ad92" strokeWidth=".8" />
      <circle cx="13" cy="19" r="2" fill="#b9ad92" />
      <circle cx="87" cy="19" r="9" fill="url(#pt-stone)" stroke="#b9ad92" strokeWidth=".8" />
      <circle cx="87" cy="19" r="5.2" fill="none" stroke="#b9ad92" strokeWidth=".8" />
      <circle cx="87" cy="19" r="2" fill="#b9ad92" />
      <rect x="18" y="26" width="64" height="8" fill="url(#pt-stone-h)" stroke="#b9ad92" strokeWidth=".8" />
    </svg>
  )
}

function Base() {
  return (
    <svg className="pt-basecol" viewBox="0 0 100 26" preserveAspectRatio="xMidYMin meet" aria-hidden="true" focusable="false">
      <rect x="14" y="0" width="72" height="6" fill="url(#pt-stone-h)" stroke="#b9ad92" strokeWidth=".8" />
      <rect x="8" y="6" width="84" height="8" rx="3" fill="url(#pt-stone-h)" stroke="#b9ad92" strokeWidth=".8" />
      <rect x="2" y="14" width="96" height="10" rx="1.5" fill="url(#pt-stone)" stroke="#b9ad92" strokeWidth=".8" />
    </svg>
  )
}

function Column({ definition, pillar }) {
  const active = Boolean(pillar)
  const body = (
    <>
      <Capital />
      <span className="pt-shaft">
        <span className="pillar-sigla">{definition.label}</span>
        {pillar?.icon_image
          ? <img src={pillar.icon_image} alt="" className="pillar-icon" onError={event => { event.currentTarget.style.visibility = 'hidden' }} />
          : <span className="pillar-icon-space" aria-hidden="true" />}
        <span className="pillar-name">{definition.name}</span>
      </span>
      <Base />
    </>
  )
  const style = { '--accent': definition.color }
  if (active) {
    return (
      <Link to={`/pillars/${pillar._id}`} aria-label={`Apri Pillar ${pillar.sigla} · ${pillar.label}`} className="pillar-col pillar-on" style={style}>
        {body}
      </Link>
    )
  }
  return (
    <span className="pillar-col pillar-off" role="img" aria-label={`${definition.name}: non configurato`} title="Non configurato" style={style}>
      {body}
    </span>
  )
}

function Beam({ pillar }) {
  const active = Boolean(pillar)
  const body = (
    <>
      <span className="pt-coin" aria-hidden="true" />
      <span className="pt-beam-text">COST DEPLOYMENT</span>
    </>
  )
  return active
    ? <Link to={`/pillars/${pillar._id}`} aria-label={`Apri Pillar ${pillar.sigla} · ${pillar.label}`} className="pillar-beam pillar-on">{body}</Link>
    : <span className="pillar-beam pillar-off" title="Non configurato">{body}</span>
}

const CSS = `
.pillar-temple{max-width:1180px;margin:0;color:#1f2937}
.pillar-temple *{box-sizing:border-box}
.pt-stage{position:relative;padding:8px 26px 18px;border-radius:18px;background:radial-gradient(120% 90% at 50% 0%,#fffaf0 0%,#f6efe0 55%,#eee4cf 100%);border:1px solid #e3d8bf;box-shadow:0 18px 40px -22px rgba(59,42,28,.45),inset 0 1px 0 #fff}
.pt-roof{display:block;width:100%;height:auto;filter:drop-shadow(0 6px 6px rgba(59,42,28,.18))}
.pillar-beam{display:flex;align-items:center;justify-content:center;gap:12px;margin:-2px -6px 0;padding:11px 18px;border:1px solid #b9ad92;border-radius:3px;background:linear-gradient(180deg,#fffdf8,#e8dfcb);text-decoration:none;color:#3b2a1c;position:relative;box-shadow:0 8px 12px -8px rgba(59,42,28,.45);font-weight:800;letter-spacing:.14em;font-size:15px}
.pillar-beam::before{content:"";position:absolute;left:0;right:0;top:0;height:5px;background:repeating-linear-gradient(90deg,#cbbd9c 0 6px,transparent 6px 12px);opacity:.7}
.pt-coin{width:22px;height:22px;border-radius:999px;background:radial-gradient(circle at 35% 30%,#f4dc97,#b8913a 60%,#7d5f17);box-shadow:0 1px 2px rgba(0,0,0,.3),inset 0 0 0 2px rgba(255,255,255,.35)}
.pt-beam-text{background:linear-gradient(180deg,#a67c1c,#6f5012);-webkit-background-clip:text;background-clip:text;color:transparent}
.pillar-beam.pillar-on:hover,.pillar-beam.pillar-on:focus-visible{background:linear-gradient(180deg,#fff,#f1e6cc);outline:none;box-shadow:0 10px 16px -8px rgba(122,90,20,.55)}
.pillar-beam.pillar-off{opacity:.42;filter:grayscale(1);cursor:not-allowed}
.pillar-row{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:9px;margin-top:12px;align-items:stretch}
.pillar-col{--accent:#56616d;display:flex;flex-direction:column;min-height:410px;text-decoration:none;color:#2b3340;position:relative;transition:transform .16s ease,filter .16s ease}
.pt-capital{display:block;width:calc(100% + 6px);margin:0 -3px;height:auto;flex-shrink:0}
.pt-basecol{display:block;width:calc(100% + 6px);margin:0 -3px;height:auto;flex-shrink:0}
.pt-shaft{position:relative;flex:1;display:flex;flex-direction:column;align-items:center;gap:10px;margin:-1px 4px;padding:14px 2px 14px;border-left:1px solid #c4b898;border-right:1px solid #c4b898;background:linear-gradient(90deg,#cdc3ac 0%,#f6f1e4 20%,#fffdf8 50%,#ece5d2 80%,#c8bda5 100%)}
.pt-shaft::before{content:"";position:absolute;inset:0;background:repeating-linear-gradient(90deg,rgba(90,70,40,.07) 0 1px,transparent 1px 9px);pointer-events:none}
.pt-shaft::after{content:"";position:absolute;left:-1px;right:-1px;top:0;height:4px;background:var(--accent)}
.pillar-sigla{position:relative;z-index:1;margin-top:4px;padding:3px 9px;border-radius:999px;background:var(--accent);color:#fff;font-weight:800;font-size:clamp(11px,1.15vw,15px);letter-spacing:.03em;line-height:1.3;box-shadow:0 3px 6px -2px rgba(0,0,0,.4)}
.pillar-icon{position:relative;z-index:1;width:clamp(30px,3.3vw,42px);height:clamp(30px,3.3vw,42px);object-fit:contain;flex-shrink:0;border-radius:999px;background:#fff;box-shadow:0 0 0 2px #fff,0 0 0 3px var(--accent)}
.pillar-icon-space{display:block;height:6px;flex-shrink:0}
.pillar-name{position:relative;z-index:1;writing-mode:vertical-rl;transform:rotate(180deg);flex:1;display:flex;align-items:center;justify-content:center;max-height:250px;text-align:center;font-weight:800;font-size:clamp(11px,1.05vw,14px);letter-spacing:.09em;line-height:1.25;color:#2b3340}
.pillar-on:hover,.pillar-on:focus-visible{transform:translateY(-5px);filter:drop-shadow(0 14px 10px rgba(59,42,28,.28));outline:none}
.pillar-on:focus-visible .pt-shaft{box-shadow:0 0 0 3px var(--accent)}
.pillar-off{opacity:.4;filter:grayscale(1);cursor:not-allowed}
.pt-steps{margin-top:6px}
.pt-step{display:block;height:13px;border:1px solid #b9ad92;border-radius:2px;background:linear-gradient(180deg,#fffdf8,#e2d9c4);box-shadow:0 2px 3px rgba(59,42,28,.15)}
.pt-step:nth-child(1){margin:0 -4px}
.pt-step:nth-child(2){margin:2px -11px 0}
.pt-step:nth-child(3){margin:2px -18px 0;height:16px}
.pillar-list{display:none}
@media(max-width:900px){
  .pt-stage{display:none}
  .pillar-list{display:block}
}
.pillar-item{--accent:#56616d;display:flex;align-items:center;gap:12px;padding:12px 14px;border:1px solid #d8cdb4;border-left:5px solid var(--accent);border-radius:8px;background:#fffdf8;margin-top:8px;text-decoration:none;color:#1f2937;min-height:56px}
.pillar-item .pillar-icon{width:32px;height:32px;box-shadow:0 0 0 1px var(--accent)}
.pillar-item .item-sigla{font-weight:800;font-size:16px;min-width:46px;color:var(--accent)}
.pillar-item .item-name{font-size:13px;color:#4b5563;overflow-wrap:anywhere}
.pillar-item.pillar-off{opacity:.42;filter:grayscale(1);cursor:not-allowed}
.pillar-item.pillar-on:hover,.pillar-item.pillar-on:focus-visible{border-color:var(--accent);outline:none;background:#fff}
@media(prefers-reduced-motion:reduce){.pillar-col{transition:none}.pillar-on:hover,.pillar-on:focus-visible{transform:none}}
`

export default function PillarListPage() {
  const { pillars, loading } = usePillars(true)
  const items = Array.isArray(pillars) ? pillars : []
  const costPillar = findPillar(items, COST)
  const matched = new Set()
  COLUMNS.forEach(column => { const found = findPillar(items, column); if (found) matched.add(found._id) })
  if (costPillar) matched.add(costPillar._id)
  const others = items.filter(item => item.attivo !== false && !matched.has(item._id))

  return (
    <div className="pillar-temple" data-layout="pillar-temple-v2">
      <style>{CSS}</style>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Pillars TPM</h1>
      {loading ? (
        <p role="status" className="text-sm text-gray-500">Caricamento pilastri...</p>
      ) : (
        <>
          <Defs />
          <div className="pt-stage">
            <Link to="/pillars/hoshin" className="block rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" aria-label="Apri Hoshin Kanri"><Roof /></Link>
            <Beam pillar={costPillar} />
            <div className="pillar-row" role="list">
              {COLUMNS.map(column => (
                <div role="listitem" key={column.key} style={{ display: 'contents' }}>
                  <Column definition={column} pillar={findPillar(items, column)} />
                </div>
              ))}
            </div>
            <div className="pt-steps" aria-hidden="true">
              <span className="pt-step" />
              <span className="pt-step" />
              <span className="pt-step" />
            </div>
          </div>

          <div className="pillar-list" role="list">
            {[...COLUMNS, COST].map(definition => {
              const pillar = findPillar(items, definition)
              const body = (
                <>
                  {pillar?.icon_image && <img src={pillar.icon_image} alt="" className="pillar-icon" onError={event => { event.currentTarget.style.visibility = 'hidden' }} />}
                  <span className="item-sigla">{definition.label === 'COST DEPLOYMENT' ? 'COST' : definition.label}</span>
                  <span className="item-name">{definition.name}</span>
                </>
              )
              const style = { '--accent': definition.color }
              return pillar
                ? <Link key={definition.key} role="listitem" to={`/pillars/${pillar._id}`} className="pillar-item pillar-on" style={style}>{body}</Link>
                : <span key={definition.key} role="listitem" className="pillar-item pillar-off" title="Non configurato" style={style}>{body}</span>
            })}
          </div>

          {others.length > 0 && (
            <div className="mt-6">
              <h2 className="text-sm font-semibold text-gray-600 mb-2">Altri pilastri</h2>
              {others.map(item => (
                <Link key={item._id} to={`/pillars/${item._id}`} className="pillar-item pillar-on">
                  {item.icon_image && <img src={item.icon_image} alt="" className="pillar-icon" onError={event => { event.currentTarget.style.visibility = 'hidden' }} />}
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
