import { useState, useEffect, useRef } from 'react'
import { Plus, X, ChevronRight, ChevronDown, Target } from 'lucide-react'

const RAMI = [
  { id: 'people',      label: 'People' },
  { id: 'machine',     label: 'Machine' },
  { id: 'methods',     label: 'Methods' },
  { id: 'materials',   label: 'Materials' },
  { id: 'measurement', label: 'Measurement' },
  { id: 'environment', label: 'Environment' },
]

const NEUTRAL_COLOR = '#475569'
const PRIMARY_COLOR = '#1e3a8a'

export default function IshikawaDiagram({ effetto = '', rami = {}, onChange }) {
  const [localEffetto, setLocalEffetto] = useState(effetto)
  const [localRami, setLocalRami] = useState(() => {
    const init = {}
    RAMI.forEach(r => { init[r.id] = rami[r.id] || [] })
    return init
  })
  const [expandedNodes, setExpandedNodes] = useState(new Set())
  
  const isFirstRender = useRef(true)
  
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    onChange?.({ effetto: localEffetto, rami: localRami })
  }, [localEffetto, localRami])
  
  function addCausa(ramoId) {
    const newCausa = createNewNode()
    setLocalRami(prev => ({
      ...prev,
      [ramoId]: [...(prev[ramoId] || []), newCausa],
    }))
  }
  
  function updateNode(ramoId, nodeId, updates) {
    setLocalRami(prev => ({
      ...prev,
      [ramoId]: updateNodoRecursive(prev[ramoId], nodeId, updates),
    }))
  }
  
  function addChild(ramoId, parentId) {
    const newChild = createNewNode()
    setLocalRami(prev => ({
      ...prev,
      [ramoId]: addChildRecursive(prev[ramoId], parentId, newChild),
    }))
    setExpandedNodes(prev => new Set(prev).add(parentId))
  }
  
  function removeNode(ramoId, nodeId) {
    if (!confirm('Rimuovere questo nodo e tutti i suoi figli?')) return
    setLocalRami(prev => ({
      ...prev,
      [ramoId]: removeNodoRecursive(prev[ramoId], nodeId),
    }))
  }
  
  function toggleRootCause(ramoId, nodeId) {
    setLocalRami(prev => ({
      ...prev,
      [ramoId]: setRootCauseRecursive(prev[ramoId], nodeId),
    }))
  }
  
  function toggleExpand(nodeId) {
    setExpandedNodes(prev => {
      const next = new Set(prev)
      if (next.has(nodeId)) next.delete(nodeId)
      else next.add(nodeId)
      return next
    })
  }
  
  // Conta nodi totali ricorsivamente
  function countNodes(nodes) {
    return nodes.reduce((sum, n) => sum + 1 + countNodes(n.children || []), 0)
  }
  const totalCauses = Object.values(localRami).reduce((sum, arr) => sum + arr.length, 0)
  const totalNodes = Object.values(localRami).reduce((sum, arr) => sum + countNodes(arr), 0)
  
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow p-4 border-l-4 border-primary">
        <label className="block text-xs font-bold uppercase text-gray-600 mb-1">
          Effetto / Problema da analizzare
        </label>
        <input
          value={localEffetto}
          onChange={(e) => setLocalEffetto(e.target.value)}
          className="w-full text-lg font-bold border-2 border-gray-200 rounded-lg px-3 py-2 focus:border-primary focus:outline-none"
        />
        <div className="flex gap-3 mt-2 text-xs text-gray-500">
          <span>{totalCauses} cause</span>
          <span>·</span>
          <span>{totalNodes - totalCauses} perché</span>
        </div>
      </div>
      
      <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {RAMI.map(ramo => (
              <RamoCard
                key={ramo.id}
                ramo={ramo}
                cause={localRami[ramo.id] || []}
                expandedNodes={expandedNodes}
                onAddCausa={() => addCausa(ramo.id)}
                onUpdate={(nodeId, updates) => updateNode(ramo.id, nodeId, updates)}
                onAddChild={(parentId) => addChild(ramo.id, parentId)}
                onRemove={(nodeId) => removeNode(ramo.id, nodeId)}
                onToggleRootCause={(nodeId) => toggleRootCause(ramo.id, nodeId)}
                onToggleExpand={toggleExpand}
              />
            ))}
          </div>

          <div className="bg-white rounded-xl shadow p-4">
            <div className="text-xs font-bold uppercase text-gray-600 mb-2">
              Diagramma a spina di pesce
            </div>
            <FishboneSVG effetto={localEffetto} rami={RAMI} causeMap={localRami} />
          </div>
        </div>
    </div>
  )
}

function RamoCard({
  ramo, cause, expandedNodes,
  onAddCausa, onUpdate, onAddChild, onRemove, onToggleRootCause, onToggleExpand,
}) {
  return (
    <div className="bg-white rounded-lg shadow border-l-4 border-gray-300">
      <div className="px-4 py-2 flex items-center justify-between rounded-t-lg bg-gray-50">
        <div className="flex items-center gap-2">
          <span className="font-bold text-gray-700">{ramo.label}</span>
          {cause.length > 0 && (
            <span className="text-xs bg-white border px-2 py-0.5 rounded-full font-medium text-gray-600">
              {cause.length}
            </span>
          )}
        </div>
        <button
          onClick={onAddCausa}
          className="text-xs flex items-center gap-1 px-2 py-1 rounded bg-primary text-white hover:bg-primary-light"
        >
          <Plus size={12} /> Aggiungi causa
        </button>
      </div>
      
      <div className="p-3 space-y-2">
        {cause.length === 0 ? (
          <div className="text-xs text-gray-400 italic text-center py-2">
            Nessuna causa
          </div>
        ) : (
          cause.map(causa => (
            <NodoView
              key={causa.id}
              nodo={causa}
              depth={0}
              isCausa={true}
              expandedNodes={expandedNodes}
              onUpdate={onUpdate}
              onAddChild={onAddChild}
              onRemove={onRemove}
              onToggleRootCause={onToggleRootCause}
              onToggleExpand={onToggleExpand}
            />
          ))
        )}
      </div>
    </div>
  )
}

// Componente ricorsivo: rappresenta una causa o un perché
function NodoView({ nodo, depth, isCausa, expandedNodes, onUpdate, onAddChild, onRemove, onToggleRootCause, onToggleExpand }) {
  const hasChildren = nodo.children?.length > 0
  const expanded = expandedNodes.has(nodo.id)
  const tipoLabel = isCausa ? 'Causa' : `Perché`

  
  return (
    <div className="border rounded-lg overflow-hidden bg-gray-50">
      <div className="p-2 flex items-center gap-2">
        <button
          onClick={() => onToggleExpand(nodo.id)}
          className="text-gray-400 hover:text-gray-700 flex-shrink-0"
        >
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        
        {!isCausa && (
          <span className="text-[10px] font-bold uppercase text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded flex-shrink-0">
            {tipoLabel}
          </span>
        )}
        
        <input
          value={nodo.label || ''}
          onChange={(e) => onUpdate(nodo.id, { label: e.target.value })}
          placeholder={isCausa ? 'Causa' : 'Perché?'}
          className={`flex-1 text-sm border-0 bg-transparent focus:outline-none focus:bg-white focus:border focus:rounded px-2 py-1 ${
            nodo.is_root_cause ? 'font-bold text-gray-900' : ''
          }`}
        />
        
        <VotingPallini
          value={nodo.voti || 0}
          onChange={(v) => onUpdate(nodo.id, { voti: v })}
        />

        <button
          onClick={() => onToggleRootCause(nodo.id)}
                   className={`p-1 rounded ${
            nodo.is_root_cause
              ? nodo.root_cause_stato === 'confermata'
                ? 'bg-green-600 text-white'
                : nodo.root_cause_stato === 'scartata'
                  ? 'bg-gray-400 text-white'
                  : 'bg-yellow-500 text-white'
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          }`}
          title={nodo.is_root_cause ? 'Rimuovi proposta di causa radice' : 'Proponi come causa radice'}
        >
          <Target size={12} />
        </button>
        
        <button
          onClick={() => onAddChild(nodo.id)}
          className="p-1 rounded bg-primary text-white hover:bg-primary-light"
          title="Aggiungi un Perché figlio"
        >
          <Plus size={12} />
        </button>
        
        <button
          onClick={() => onRemove(nodo.id)}
          className="p-1 text-red-500 hover:bg-red-50 rounded"
        >
          <X size={14} />
        </button>
      </div>
      
      {(expanded || hasChildren) && hasChildren && (
        <div className="px-2 pb-2 pl-6 space-y-1">
          {nodo.children.map(child => (
            <NodoView
              key={child.id}
              nodo={child}
              depth={depth + 1}
              isCausa={false}
              expandedNodes={expandedNodes}
              onUpdate={onUpdate}
              onAddChild={onAddChild}
              onRemove={onRemove}
              onToggleRootCause={onToggleRootCause}
              onToggleExpand={onToggleExpand}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function VotingPallini({ value, onChange }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          onClick={() => onChange(value === n ? 0 : n)}
          className="w-2.5 h-2.5 rounded-full border transition-all"
          style={{
            backgroundColor: n <= value ? PRIMARY_COLOR : 'transparent',
            borderColor: n <= value ? PRIMARY_COLOR : '#d1d5db',
          }}
          title={`Voto ${n}/5`}
        />
      ))}
    </div>
  )
}
function wrapText(text, maxChars, maxLines) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean)
  if (!words.length) return []
  const lines = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (candidate.length <= maxChars) {
      current = candidate
      continue
    }
    if (current) lines.push(current)
    current = word.length > maxChars ? `${word.slice(0, maxChars - 1)}…` : word
    if (lines.length === maxLines) break
  }
  if (lines.length < maxLines && current) lines.push(current)
  if (lines.length > maxLines) lines.length = maxLines
  const used = lines.join(' ').length
  if (used < words.join(' ').length && lines.length) {
    const last = lines[lines.length - 1]
    lines[lines.length - 1] = last.length >= maxChars ? `${last.slice(0, maxChars - 1)}…` : `${last}…`
  }
  return lines
}

function FishboneSVG({ effetto, rami, causeMap }) {
  const width = 1000
  const height = 560
  const centerY = height / 2
  const spineStart = 40
  const spineEnd = 760
  const effectX = 790
  const effectW = 190
  const effectH = 130
  const ramoXs = [250, 470, 690]
  const ramoDx = 130
  const topY = 70
  const bottomY = height - 70
  const maxCause = 4
  const effettoLines = wrapText(effetto || 'Effetto', 18, 5)

  const renderRamo = (ramo, i, sopra) => {
    const ramoX = ramoXs[i]
    const ramoXEnd = ramoX - ramoDx
    const ramoYEnd = sopra ? topY : bottomY
    const cause = causeMap[ramo.id] || []
    const extra = cause.length - maxCause
    return (
      <g key={ramo.id}>
        <line x1={ramoX} y1={centerY} x2={ramoXEnd} y2={ramoYEnd} stroke={NEUTRAL_COLOR} strokeWidth="2.5" />
        <rect x={ramoXEnd - 80} y={sopra ? ramoYEnd - 34 : ramoYEnd + 4} width="160" height="30" fill={NEUTRAL_COLOR} rx="6" />
        <text x={ramoXEnd} y={sopra ? ramoYEnd - 14 : ramoYEnd + 24} textAnchor="middle" fill="white" fontSize="15" fontWeight="bold">
          {ramo.label}{cause.length ? ` (${cause.length})` : ''}
        </text>
        {cause.slice(0, maxCause).map((causa, j) => {
          const t = (j + 1) / (maxCause + 1)
          const cx1 = ramoX - ramoDx * t
          const cy1 = centerY + (ramoYEnd - centerY) * t
          const cx2 = cx1 - 34
          const lines = wrapText(causa.label || '—', 16, 2)
          return (
            <g key={causa.id}>
              <line x1={cx1} y1={cy1} x2={cx2} y2={cy1} stroke={NEUTRAL_COLOR} strokeWidth="1.5" opacity="0.8" />
              <text x={cx2 - 6} y={cy1 + 4 - (lines.length - 1) * 7} textAnchor="end" fontSize="13" fill="#1f2937" fontWeight={causa.is_root_cause ? 'bold' : 'normal'}>
                {lines.map((line, k) => (
                  <tspan key={k} x={cx2 - 6} dy={k === 0 ? 0 : 15}>{line}</tspan>
                ))}
                <title>{causa.label || ''}</title>
              </text>
            </g>
          )
        })}
        {extra > 0 && (
          <text x={ramoX - ramoDx * 0.08 + 8} y={centerY + (sopra ? -26 : 34)} fontSize="12" fill="#6b7280">+{extra}</text>
        )}
      </g>
    )
  }

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[640px] h-auto" role="img" aria-label="Diagramma a spina di pesce">
        <line x1={spineStart} y1={centerY} x2={spineEnd} y2={centerY} stroke={NEUTRAL_COLOR} strokeWidth="4" />
        <polygon points={`${spineEnd},${centerY - 12} ${spineEnd + 26},${centerY} ${spineEnd},${centerY + 12}`} fill={NEUTRAL_COLOR} />
        <rect x={effectX} y={centerY - effectH / 2} width={effectW} height={effectH} fill={PRIMARY_COLOR} className="fill-primary" rx="10" />
        <text x={effectX + effectW / 2} y={centerY - (effettoLines.length - 1) * 10 + 6} textAnchor="middle" fill="white" fontSize="16" fontWeight="bold">
          {effettoLines.map((line, k) => (
            <tspan key={k} x={effectX + effectW / 2} dy={k === 0 ? 0 : 20}>{line}</tspan>
          ))}
          <title>{effetto || ''}</title>
        </text>
        {rami.slice(0, 3).map((ramo, i) => renderRamo(ramo, i, true))}
        {rami.slice(3, 6).map((ramo, i) => renderRamo(ramo, i, false))}
      </svg>
    </div>
  )
}

// ──────────────────────────────────────────────────────────
// HELPERS — manipolazione albero
// ──────────────────────────────────────────────────────────
function createNewNode() {
  return {
    id: `n_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    label: '',
    voti: 0,
    is_root_cause: false,
    root_cause_stato: 'da_valutare',
    children: [],
  }
}

function updateNodoRecursive(nodes, nodeId, updates) {
  return nodes.map(n => {
    if (n.id === nodeId) return { ...n, ...updates }
    if (n.children?.length) return { ...n, children: updateNodoRecursive(n.children, nodeId, updates) }
    return n
  })
}

function addChildRecursive(nodes, parentId, newChild) {
  return nodes.map(n => {
    if (n.id === parentId) return { ...n, children: [...(n.children || []), newChild] }
    if (n.children?.length) return { ...n, children: addChildRecursive(n.children, parentId, newChild) }
    return n
  })
}

function removeNodoRecursive(nodes, nodeId) {
  return nodes
    .filter(n => n.id !== nodeId)
    .map(n => n.children?.length ? { ...n, children: removeNodoRecursive(n.children, nodeId) } : n)
}

function setRootCauseRecursive(nodes, nodeId) {
  return nodes.map(n => {
    if (n.id === nodeId) {
      const next = !n.is_root_cause
      return {
        ...n,
        is_root_cause: next,
        root_cause_stato: next ? 'da_valutare' : null,
        children: n.children?.length ? setRootCauseRecursive(n.children, nodeId) : [],
      }
    }
    return {
      ...n,
      children: n.children?.length ? setRootCauseRecursive(n.children, nodeId) : n.children || [],
    }
  })
}

