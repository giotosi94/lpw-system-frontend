import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import GridLayout from 'react-grid-layout'
import api from '../services/api'
import { Save, ArrowLeft, Plus, Trash2, Settings, Edit2, X, Check } from 'lucide-react'
import ActionPlanWidget from '../components/widgets/ActionPlanWidget'
import KaizenWidget from '../components/widgets/KaizenWidget'
import KPICard from '../components/widgets/KPICard'
import TextBlock from '../components/widgets/TextBlock'
import BIEmbed from '../components/widgets/BIEmbed'
import TableWidget from '../components/widgets/TableWidget'
import ExcelLink from '../components/widgets/ExcelLink'
import PresenzeWidget from '../components/widgets/PresenzeWidget'
import GanttWidget from '../components/widgets/GanttWidget'
import TableEditor from '../components/TableEditor'
import 'react-grid-layout/css/styles.css'

const WIDGET_TYPES = [
  { id: 'action_plan', label: 'Action Plan', icon: 'AP', defaultSize: { w: 6, h: 6 } },
  { id: 'kaizen', label: 'Kaizen collegati', icon: 'KZ', defaultSize: { w: 6, h: 6 } },
  { id: 'presenze', label: 'Presenze', icon: 'PR', defaultSize: { w: 8, h: 6 } },
  { id: 'kpi_card', label: 'KPI Card', icon: 'KPI', defaultSize: { w: 3, h: 3 } },
  { id: 'text_block', label: 'Blocco Testo', icon: 'TXT', defaultSize: { w: 4, h: 4 } },
  { id: 'bi_embed', label: 'Embed BI', icon: 'BI', defaultSize: { w: 6, h: 6 } },
  { id: 'table', label: 'Tabella', icon: 'TAB', defaultSize: { w: 6, h: 5 } },
  { id: 'excel_link', label: 'Link Excel', icon: 'XLS', defaultSize: { w: 4, h: 4 } },
  { id: 'gantt', label: 'Gantt', icon: 'GNT', defaultSize: { w: 12, h: 8 } },
]

function genTabId() {
  return `tab_${Date.now()}_${Math.floor(Math.random() * 1000)}`
}

function normalizeTabs(data) {
  if (data.tabs && data.tabs.length > 0) {
    return data.tabs
      .map((t, i) => ({
        id: t.id || genTabId(),
        titolo: t.titolo || `Pagina ${i + 1}`,
        ordine: t.ordine ?? i,
        layout: t.layout || [],
      }))
      .sort((a, b) => a.ordine - b.ordine)
  }
  return [{
    id: genTabId(),
    titolo: 'Panoramica',
    ordine: 0,
    layout: data.layout || [],
  }]
}

export default function DashboardDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [dashboard, setDashboard] = useState(null)
  const [tabs, setTabs] = useState([])
  const [activeTabId, setActiveTabId] = useState(null)
  const [editMode, setEditMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savingMemo, setSavingMemo] = useState(false)
  const [memoError, setMemoError] = useState('')
  const [showAddWidget, setShowAddWidget] = useState(false)
  const [editingWidget, setEditingWidget] = useState(null)
  const [editingTitolo, setEditingTitolo] = useState(false)
  const [titoloDraft, setTitoloDraft] = useState('')
  const [renamingTabId, setRenamingTabId] = useState(null)
  const [tabNameDraft, setTabNameDraft] = useState('')

  useEffect(() => { loadDashboard() }, [id])

  const loadDashboard = async () => {
    try {
      const res = await api.get(`/dashboards/${id}`)
      setDashboard(res.data)
      const normalized = normalizeTabs(res.data)
      setTabs(normalized)
      setActiveTabId(normalized[0]?.id || null)
    } catch (err) { console.error(err) }
  }

  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0]

  const saveTitolo = async () => {
    const nuovoTitolo = titoloDraft.trim()
    if (!nuovoTitolo) {
      setEditingTitolo(false)
      return
    }
    try {
      await api.put(`/dashboards/${id}`, { titolo_pagina: nuovoTitolo })
      setDashboard({ ...dashboard, titolo_pagina: nuovoTitolo })
      setEditingTitolo(false)
    } catch (err) {
      console.error(err)
      alert('Errore salvataggio titolo')
    }
  }

  const saveDashboard = async () => {
    if (savingMemo) return
    setSaving(true)
    try {
      const tabsToSave = tabs.map((t, i) => ({ ...t, ordine: i }))
      await api.put(`/dashboards/${id}`, { tabs: tabsToSave, layout: tabsToSave[0]?.layout || [] })
      alert('Meeting salvato!')
      setEditMode(false)
    } catch (err) {
      console.error(err)
      alert('Errore salvataggio')
    }
    setSaving(false)
  }

  const updateActiveTabLayout = (updater) => {
    setTabs(prev => prev.map(t => {
      if (t.id !== activeTabId) return t
      const newLayout = typeof updater === 'function' ? updater(t.layout || []) : updater
      return { ...t, layout: newLayout }
    }))
  }

  const addTab = () => {
    const newTab = {
      id: genTabId(),
      titolo: `Pagina ${tabs.length + 1}`,
      ordine: tabs.length,
      layout: [],
    }
    setTabs([...tabs, newTab])
    setActiveTabId(newTab.id)
    setRenamingTabId(newTab.id)
    setTabNameDraft(newTab.titolo)
  }

  const confirmRenameTab = () => {
    const nome = tabNameDraft.trim()
    if (nome) {
      setTabs(prev => prev.map(t => t.id === renamingTabId ? { ...t, titolo: nome } : t))
    }
    setRenamingTabId(null)
    setTabNameDraft('')
  }

  const deleteTab = (tabId) => {
    if (tabs.length <= 1) {
      alert('Deve rimanere almeno un tab.')
      return
    }
    if (!confirm('Eliminare questo tab e tutti i suoi widget?')) return
    const remaining = tabs.filter(t => t.id !== tabId)
    setTabs(remaining)
    if (activeTabId === tabId) {
      setActiveTabId(remaining[0]?.id || null)
    }
  }

  const addWidget = (type) => {
    const widgetType = WIDGET_TYPES.find(w => w.id === type)
    const newWidget = {
      widget_id: `widget_${Date.now()}`,
      tipo: type,
      titolo: widgetType.label,
      posizione: { x: 0, y: 0, w: widgetType.defaultSize.w, h: widgetType.defaultSize.h },
      config: {},
    }
    updateActiveTabLayout(layout => [...layout, newWidget])
    setShowAddWidget(false)
  }

  const removeWidget = (widgetId) => {
    updateActiveTabLayout(layout => layout.filter(w => w.widget_id !== widgetId))
  }

  const updateWidgetConfig = (widgetId, newConfig) => {
    updateActiveTabLayout(layout => layout.map(w =>
      w.widget_id === widgetId ? { ...w, config: { ...w.config, ...newConfig } } : w
    ))
  }

  const onLayoutChange = (newLayout) => {
    if (!editMode) return
    updateActiveTabLayout(layout => layout.map(w => {
      const l = newLayout.find(item => item.i === w.widget_id)
      if (l) return { ...w, posizione: { x: l.x, y: l.y, w: l.w, h: l.h } }
      return w
    }))
  }

  const saveMemo = async (widgetId, config) => {
    if (saving || savingMemo || !activeTab?.layout?.some(widget => widget.widget_id === widgetId)) return false
    const applyMemo = source => source.map(tab => tab.id !== activeTab.id ? tab : {
      ...tab,
      layout: tab.layout.map(widget => widget.widget_id === widgetId
        ? { ...widget, config: { ...widget.config, ...config } }
        : widget),
    })
    setSavingMemo(true)
    setMemoError('')
    try {
      const next = applyMemo(tabs).map((tab, ordine) => ({ ...tab, ordine }))
      await api.put(`/dashboards/${id}`, { tabs: next, layout: next[0]?.layout || [] })
      setTabs(applyMemo)
      return true
    } catch (error) {
      console.error(error)
      setMemoError('Memo non salvato. Riprova.')
      return false
    } finally {
      setSavingMemo(false)
    }
  }

  const renderWidget = (widget) => {
    switch (widget.tipo) {
      case 'action_plan':
        return <ActionPlanWidget filterReparto={widget.config.filterReparto} filterStato={widget.config.filterStato} dashboardId={id} dashboardName={dashboard.nome} title={widget.config.titolo || 'Action Plan'} />
      case 'kaizen':
        return <KaizenWidget dashboardId={id} title={widget.config.titolo || 'Kaizen collegati'} />
      case 'kpi_card':
        return <KPICard config={widget.config} />
      case 'text_block':
        return <TextBlock config={widget.config} disabled={savingMemo || saving} onSave={!editMode ? config => saveMemo(widget.widget_id, config) : undefined} />
      case 'bi_embed':
        return <BIEmbed config={widget.config} />
      case 'table':
        return (
          <TableWidget
            config={widget.config}
            editMode={editMode}
            onChange={(newConfig) => updateWidgetConfig(widget.widget_id, newConfig)}
          />
        )
      case 'excel_link':
        return <ExcelLink config={widget.config} />
      case 'presenze':
        return (
          <PresenzeWidget
            config={widget.config}
            editMode={editMode}
            onChange={(newConfig) => updateWidgetConfig(widget.widget_id, newConfig)}
          />
        )
      case 'gantt':
        return (
          <GanttWidget
            config={widget.config}
            onChange={(newConfig) => updateWidgetConfig(widget.widget_id, newConfig)}
            title={widget.config.titolo || 'Gantt'}
          />
        )
      default:
        return <div className="bg-white p-4">Widget sconosciuto</div>
    }
  }

  if (!dashboard) return <div className="text-center py-8">Caricamento...</div>

  const currentLayout = activeTab?.layout || []
  const gridLayout = currentLayout.map(w => ({
    i: w.widget_id,
    x: w.posizione?.x || 0,
    y: w.posizione?.y || 0,
    w: w.posizione?.w || 4,
    h: w.posizione?.h || 4,
  }))

  return (
    <div>
      {/* Header */}
      <div className="bg-primary text-white rounded-xl p-4 mb-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/dashboard')} className="hover:bg-primary-light p-2 rounded">
            <ArrowLeft size={20} />
          </button>
          <div>
            {editingTitolo ? (
              <input
                value={titoloDraft}
                onChange={(e) => setTitoloDraft(e.target.value)}
                onBlur={saveTitolo}
                onKeyDown={(e) => { if (e.key === 'Enter') saveTitolo() }}
                className="text-xl font-bold text-gray-800 rounded px-2 py-1"
                autoFocus
              />
            ) : (
              <h1
                className="text-xl font-bold cursor-pointer hover:opacity-80"
                title="Clicca per modificare il titolo"
                onClick={() => {
                  setTitoloDraft(dashboard.titolo_pagina || dashboard.nome)
                  setEditingTitolo(true)
                }}
              >
                {dashboard.titolo_pagina || dashboard.nome}
              </h1>
            )}
            <p className="text-xs text-gray-300">{dashboard.tipo} &middot; {dashboard.visibilita}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {editMode ? (
            <>
              <button onClick={() => setShowAddWidget(true)} className="bg-white text-primary px-3 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-100">
                <Plus size={16} /> Widget
              </button>
              <button onClick={saveDashboard} disabled={saving || savingMemo} className="bg-green-500 text-white px-3 py-2 rounded-lg flex items-center gap-2 hover:bg-green-600">
                <Save size={16} /> {saving ? '...' : 'Salva'}
              </button>
            </>
          ) : (
            <button onClick={() => setEditMode(true)} className="bg-white text-primary px-3 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-100">
              <Edit2 size={16} /> Modifica
            </button>
          )}
        </div>
      </div>

      {/* Barra Tab */}
      <div className="flex items-center gap-1 mb-6 border-b overflow-x-auto">
        {tabs.map(tab => (
          <div key={tab.id} className="flex items-center flex-shrink-0">
            {renamingTabId === tab.id ? (
              <div className="flex items-center gap-1 px-2 py-1">
                <input
                  value={tabNameDraft}
                  onChange={(e) => setTabNameDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') confirmRenameTab() }}
                  className="border rounded px-2 py-1 text-sm w-32"
                  autoFocus
                />
                <button onClick={confirmRenameTab} className="text-green-600 hover:bg-green-50 p-1 rounded">
                  <Check size={15} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setActiveTabId(tab.id)}
                onDoubleClick={() => {
                  if (editMode) {
                    setRenamingTabId(tab.id)
                    setTabNameDraft(tab.titolo)
                  }
                }}
                className={`px-4 py-2 font-medium text-sm whitespace-nowrap flex items-center gap-2 ${
                  activeTabId === tab.id
                    ? 'border-b-2 border-primary text-primary'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.titolo}
                {editMode && activeTabId === tab.id && (
                  <span className="flex items-center gap-1">
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); setRenamingTabId(tab.id); setTabNameDraft(tab.titolo) }}
                      className="text-gray-400 hover:text-primary"
                      title="Rinomina"
                    >
                      <Edit2 size={13} />
                    </span>
                    {tabs.length > 1 && (
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => { e.stopPropagation(); deleteTab(tab.id) }}
                        className="text-gray-400 hover:text-red-500"
                        title="Elimina tab"
                      >
                        <X size={14} />
                      </span>
                    )}
                  </span>
                )}
              </button>
            )}
          </div>
        ))}
        {editMode && (
          <button
            onClick={addTab}
            className="px-3 py-2 text-sm text-primary hover:bg-blue-50 rounded flex items-center gap-1 flex-shrink-0"
            title="Aggiungi tab"
          >
            <Plus size={15} /> Tab
          </button>
        )}
      </div>

      {/* Grid del tab attivo */}
      {currentLayout.length === 0 ? (
        <div className="bg-white rounded-xl shadow p-12 text-center">
          <p className="text-gray-400 mb-4">Nessun widget in questo tab. Aggiungine uno per iniziare!</p>
          <button onClick={() => { setEditMode(true); setShowAddWidget(true) }} className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-light">
            Aggiungi primo widget
          </button>
        </div>
      ) : (
        <GridLayout
          key={activeTabId}
          className="layout"
          layout={gridLayout}
          cols={12}
          rowHeight={50}
          width={1200}
          onLayoutChange={onLayoutChange}
          isDraggable={editMode}
          isResizable={editMode}
          draggableCancel=".widget-action-btn"
        >
          {currentLayout.map(widget => (
            <div key={widget.widget_id} className="relative">
              {editMode && (
                <div className="absolute top-1 right-1 z-20 flex gap-1 widget-action-btn">
                  <button
                    type="button"
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); setMemoError(''); setEditingWidget(widget) }}
                    className="widget-action-btn bg-blue-500 text-white rounded p-1 hover:bg-blue-600 cursor-pointer shadow"
                  >
                    <Settings size={12} />
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); removeWidget(widget.widget_id) }}
                    className="widget-action-btn bg-red-500 text-white rounded p-1 hover:bg-red-600 cursor-pointer shadow"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              )}
              {renderWidget(widget)}
            </div>
          ))}
        </GridLayout>
      )}

      {/* Modal Add Widget */}
      {showAddWidget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">Aggiungi Widget</h2>
              <button onClick={() => setShowAddWidget(false)}><X size={20} /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {WIDGET_TYPES.map(w => (
                <button
                  key={w.id}
                  onClick={() => addWidget(w.id)}
                  className="border-2 border-gray-200 hover:border-primary rounded-lg p-4 text-center transition-colors"
                >
                  <div className="text-lg font-bold mb-2">{w.icon}</div>
                  <div className="text-sm font-medium">{w.label}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal Edit Widget */}
      {editingWidget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4 sticky top-0 bg-white">
              <h2 className="text-lg font-bold">Configura Widget</h2>
              <button type="button" disabled={savingMemo} aria-label="Chiudi configurazione" onClick={() => setEditingWidget(null)}><X size={20} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Titolo</label>
                <input
                  value={editingWidget.config.titolo || ''}
                  onChange={(e) => {
                    if (editingWidget.tipo !== 'text_block') updateWidgetConfig(editingWidget.widget_id, { titolo: e.target.value })
                    setEditingWidget({ ...editingWidget, config: { ...editingWidget.config, titolo: e.target.value } })
                  }}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              {editingWidget.tipo === 'kpi_card' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium mb-1">Valore</label>
                      <input
                        value={editingWidget.config.valore || ''}
                        onChange={(e) => {
                          updateWidgetConfig(editingWidget.widget_id, { valore: e.target.value })
                          setEditingWidget({ ...editingWidget, config: { ...editingWidget.config, valore: e.target.value } })
                        }}
                        className="w-full border rounded-lg px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Unita</label>
                      <input
                        value={editingWidget.config.unita || ''}
                        onChange={(e) => {
                          updateWidgetConfig(editingWidget.widget_id, { unita: e.target.value })
                          setEditingWidget({ ...editingWidget, config: { ...editingWidget.config, unita: e.target.value } })
                        }}
                        className="w-full border rounded-lg px-3 py-2"
                        placeholder="%, EUR, ..."
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Target</label>
                    <input
                      value={editingWidget.config.target || ''}
                      onChange={(e) => {
                        updateWidgetConfig(editingWidget.widget_id, { target: e.target.value })
                        setEditingWidget({ ...editingWidget, config: { ...editingWidget.config, target: e.target.value } })
                      }}
                      className="w-full border rounded-lg px-3 py-2"
                    />
                  </div>
                </>
              )}
              {editingWidget.tipo === 'text_block' && (
                <div>
                  <label className="block text-sm font-medium mb-1">Contenuto</label>
                  <textarea
                    rows={6}
                    value={editingWidget.config.contenuto || ''}
                    onChange={(e) => {
                      setEditingWidget({ ...editingWidget, config: { ...editingWidget.config, contenuto: e.target.value } })
                    }}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
              )}
              {editingWidget.tipo === 'bi_embed' && (
                <div>
                  <label className="block text-sm font-medium mb-1">URL Embed (Power BI / link)</label>
                  <input
                    value={editingWidget.config.url || ''}
                    onChange={(e) => {
                      updateWidgetConfig(editingWidget.widget_id, { url: e.target.value })
                      setEditingWidget({ ...editingWidget, config: { ...editingWidget.config, url: e.target.value } })
                    }}
                    className="w-full border rounded-lg px-3 py-2"
                    placeholder="https://app.powerbi.com/view?r=..."
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Da Power BI: File &rarr; Embed report &rarr; copia URL
                  </p>
                </div>
              )}
              {editingWidget.tipo === 'action_plan' && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">Filtra per Reparto</label>
                    <input
                      value={editingWidget.config.filterReparto || ''}
                      onChange={(e) => {
                        updateWidgetConfig(editingWidget.widget_id, { filterReparto: e.target.value })
                        setEditingWidget({ ...editingWidget, config: { ...editingWidget.config, filterReparto: e.target.value } })
                      }}
                      className="w-full border rounded-lg px-3 py-2"
                      placeholder="Lascia vuoto per tutti"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Filtra per Stato</label>
                    <select
                      value={editingWidget.config.filterStato || ''}
                      onChange={(e) => {
                        updateWidgetConfig(editingWidget.widget_id, { filterStato: e.target.value })
                        setEditingWidget({ ...editingWidget, config: { ...editingWidget.config, filterStato: e.target.value } })
                      }}
                      className="w-full border rounded-lg px-3 py-2"
                    >
                      <option value="">Tutti</option>
                      <option>Da Fare</option>
                      <option>In Corso</option>
                      <option>Completato</option>
                    </select>
                  </div>
                </>
              )}
              {editingWidget.tipo === 'table' && (
                <TableEditor
                  config={editingWidget.config}
                  onChange={(newConfig) => {
                    updateWidgetConfig(editingWidget.widget_id, newConfig)
                    setEditingWidget({ ...editingWidget, config: { ...editingWidget.config, ...newConfig } })
                  }}
                />
              )}
              {editingWidget.tipo === 'excel_link' && (
                <div>
                  <label className="block text-sm font-medium mb-1">Link (uno per riga: etichetta | URL)</label>
                  <textarea
                    rows={5}
                    value={(editingWidget.config.links || []).map(l => `${l.label || ''} | ${l.url || ''}`).join('\n')}
                    onChange={(e) => {
                      const links = e.target.value.split('\n').filter(l => l.trim()).map(l => {
                        const parts = l.split('|').map(s => s.trim())
                        return { label: parts[0], url: parts[1] || parts[0] }
                      })
                      updateWidgetConfig(editingWidget.widget_id, { links })
                      setEditingWidget({ ...editingWidget, config: { ...editingWidget.config, links } })
                    }}
                    className="w-full border rounded-lg px-3 py-2 font-mono text-sm"
                    placeholder={"Report Production | https://sharepoint.com/...\nOPL Linea 1 | \\\\server\\opl.xlsx"}
                  />
                </div>
              )}
              {editingWidget.tipo === 'text_block' ? (
                <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                  {memoError && <p role="alert" className="mr-auto text-sm text-red-700">{memoError}</p>}
                  <button type="button" disabled={savingMemo} onClick={() => setEditingWidget(null)} className="rounded-lg border px-4 py-2 text-sm">Annulla</button>
                  <button type="button" disabled={savingMemo || saving} onClick={async () => {
                    if (await saveMemo(editingWidget.widget_id, editingWidget.config)) setEditingWidget(null)
                  }} className="rounded-lg bg-primary px-4 py-2 text-sm text-white disabled:opacity-50">{savingMemo ? 'Salvataggio...' : 'Salva'}</button>
                </div>
              ) : (
                <button onClick={() => setEditingWidget(null)} className="mt-4 w-full rounded-lg bg-primary py-2 text-white">Chiudi</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
