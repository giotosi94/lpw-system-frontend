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
      
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,9fr)_minmax(0,11fr)]">
        <div className="space-y-3">
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
        
        <div className="min-w-0 self-start rounded-xl bg-white p-3 shadow lg:sticky lg:top-4">
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

// Fishbone SVG (invariato dalla versione precedente, mostra solo le cause primarie)
function FishboneSVG({ effetto, rami, causeMap }) {
  const width = 600
  const height = 440
  const centerY = 220
  const spineEnd = 452
  const effectX = 478
  const effectWidth = 110
  const problem = String(effetto || '').trim() || 'Effetto'

  const renderRamo = (ramo, i, sopra) => {
    const x = 186 + i * 131
    const tipX = x - 65
    const tipY = sopra ? 44 : 396
    const labelY = sopra ? tipY - 26 : tipY
    const cause = causeMap[ramo.id] || []
    const shown = cause.slice(0, 4)
    return (
      <g key={ramo.id}>
        <line x1={x} y1={centerY} x2={tipX} y2={tipY} stroke={NEUTRAL_COLOR} strokeWidth="2" />
        <rect x={tipX - 54} y={labelY} width="108" height="26" rx="4" fill={NEUTRAL_COLOR} />
        <text x={tipX} y={labelY + 13} dominantBaseline="central" textAnchor="middle" fill="white" fontSize="14" fontWeight="600">{ramo.label}</text>
        {shown.map((causa, j) => {
          const fraction = (j + 1) / (shown.length + 1)
          const branchX = x - 65 * fraction
          const branchY = centerY + (tipY - centerY) * fraction
          const label = String(causa.label || '').trim() || '—'
          return (
            <g key={causa.id}>
              <title>{label}</title>
              <line x1={branchX - 18} y1={branchY} x2={branchX} y2={branchY} stroke={NEUTRAL_COLOR} strokeWidth="1" />
              <foreignObject x={branchX - 122} y={branchY - 16} width="100" height="32">
                <div className="flex h-full items-center justify-end text-right text-gray-700">
                  <span className={causa.is_root_cause ? 'font-semibold' : ''} style={{ display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden', overflowWrap: 'anywhere', fontSize: 13, lineHeight: '15px' }}>{label}</span>
                </div>
              </foreignObject>
            </g>
          )
        })}
        {cause.length > shown.length && (
          <text x={tipX + 58} y={labelY + 17} fill={NEUTRAL_COLOR} fontSize="12">+{cause.length - shown.length}</text>
        )}
      </g>
    )
  }

  return (
    <div className="max-w-full overflow-x-auto focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" role="region" aria-label="Diagramma a spina di pesce" tabIndex={0}>
      <svg viewBox={`0 0 ${width} ${height}`} className="block h-auto w-full min-w-[500px]" role="img" aria-label={`Diagramma a spina di pesce: ${problem}`}>
        <line x1="32" y1={centerY} x2={spineEnd} y2={centerY} stroke={NEUTRAL_COLOR} strokeWidth="3" />
        <polygon points={`${spineEnd},${centerY - 8} ${spineEnd + 20},${centerY} ${spineEnd},${centerY + 8}`} fill={NEUTRAL_COLOR} />
        {rami.slice(0, 3).map((ramo, i) => renderRamo(ramo, i, true))}
        {rami.slice(3, 6).map((ramo, i) => renderRamo(ramo, i, false))}
        <g>
          <title>{problem}</title>
          <rect x={effectX} y={centerY - 31} width={effectWidth} height="62" rx="5" fill={NEUTRAL_COLOR} className="fill-primary" />
          <foreignObject x={effectX + 6} y={centerY - 24} width={effectWidth - 12} height="48">
            <div className="flex h-full items-center justify-center text-center font-semibold text-white">
              <span style={{ display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 3, overflow: 'hidden', overflowWrap: 'anywhere', fontSize: 14, lineHeight: '16px' }}>{problem}</span>
            </div>
          </foreignObject>
        </g>
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

