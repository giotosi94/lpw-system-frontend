import { createPortal } from 'react-dom'
import { useState, useEffect } from 'react'
import api from '../../services/api'
import { Plus } from 'lucide-react'
import { useAllConfigurations } from '../../hooks/useConfigurations'
import ActionPlanFormShared from '../ActionPlanFormShared'
import ActionPlanDetailPanel from '../ActionPlanDetailPanel'
import ActionPlanViews from '../ActionPlanViews'

export default function ActionPlanWidget({ filterReparto, filterStato, dashboardId, dashboardName, title = "Action Plan" }) {
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingAP, setEditingAP] = useState(null)
  const [selectedAP, setSelectedAP] = useState(null)

  const { configs } = useAllConfigurations()
  const statiConfig = configs.stato_ap || []

  useEffect(() => { load() }, [filterReparto, filterStato, dashboardId])

  const load = async () => {
    setLoading(true)
    try {
      // Filtro per dashboard_id se presente, così il widget mostra solo gli AP della sua dashboard
      const params = new URLSearchParams()
      if (dashboardId) params.append('dashboard_id', dashboardId)
      if (filterReparto) params.append('reparto', filterReparto)
      if (filterStato) params.append('stato', filterStato)

      const res = await api.get(`/action-plans/?${params.toString()}`)
      setPlans(res.data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function changeStato(ap, nuovoStato) {
    try {
      await api.patch(`/action-plans/${ap._id}/stato`, { stato: nuovoStato })
      load()
    } catch (err) {
      alert('Errore: ' + (err.response?.data?.detail || err.message))
    }
  }

  async function deleteAP(ap) {
    if (!confirm(`Eliminare ${ap.numero}?\nQuesto rimuove l'Action Plan definitivamente.`)) return
    try {
      await api.delete(`/action-plans/${ap._id}`)
      load()
    } catch (err) {
      alert('Errore: ' + (err.response?.data?.detail || err.message))
    }
  }

  async function cancelAP(plan) {
    const reason = prompt(`Annullare ${plan.numero} - ${plan.titolo}?\nInserisci il motivo:`)
    if (!reason || !reason.trim()) return
    try {
      await api.post(`/action-plans/${plan._id}/cancel`, {
        reason: reason.trim(),
        user: 'Default User',
      })
      load()
    } catch (err) {
      alert('Errore: ' + (err.response?.data?.detail || err.message))
    }
  }

  async function restoreAP(plan) {
    if (!confirm(`Ripristinare ${plan.numero}?`)) return
    try {
      await api.post(`/action-plans/${plan._id}/restore`)
      load()
    } catch (err) {
      alert('Errore: ' + (err.response?.data?.detail || err.message))
    }
  }

  // Prefilled parent per il form (dashboard / meeting)
  const prefilledParent = dashboardId ? {
    parent_type: 'dashboard',
    parent_id: dashboardId,
    parent_label: dashboardName,
    dashboard_id: dashboardId,
  } : null

  // Statistiche
  const counts = {
    totale: plans.length,
    overdue: plans.filter(p => p.stato_visuale === 'In Ritardo').length,
  }

  return (
    <div className="bg-white rounded-xl shadow p-3 h-full flex flex-col overflow-hidden">
      {/* Header compatto */}
      <div className="flex justify-between items-center mb-2 border-b pb-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <h3 className="font-bold text-gray-800 text-sm truncate">{title}</h3>
          <span className="text-xs text-gray-500">({counts.totale})</span>
          {counts.overdue > 0 && (
            <span className="text-xs bg-red-100 text-red-700 px-1.5 rounded font-bold">
              {counts.overdue} in ritardo
            </span>
          )}
        </div>
        <button
          onClick={() => { setEditingAP(null); setShowForm(true) }}
          className="text-primary hover:bg-blue-50 p-1 rounded widget-action-btn"
          title="Aggiungi action plan"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Body */}
      <div className="overflow-y-auto flex-1">
        {loading ? (
          <div className="text-center text-gray-400 py-4 text-xs">Caricamento...</div>
        ) : (
          <ActionPlanViews
            plans={plans}
            statiConfig={statiConfig}
            onSelectAP={setSelectedAP}
            onEditAP={(p) => { setEditingAP(p); setShowForm(true) }}
            onDeleteAP={deleteAP}
            onChangeStato={changeStato}
            showCollegato={false}
            showStepGant={false}
            showKanban={true}
            showCalendar={true}
            defaultView="list"
            compact={true}
            emptyMessage="Nessun action plan in questo meeting"
            emptyAction={{
              label: '+ Crea il primo',
              onClick: () => { setEditingAP(null); setShowForm(true) }
            }}
          />
        )}
      </div>

      {(showForm || selectedAP) && createPortal(
        <div className="fixed inset-0 z-[1000]" onClick={event => event.stopPropagation()}>
          {showForm && (
            <ActionPlanFormShared
              plan={editingAP}
              prefilledKaizen={null}
              prefilledParent={editingAP ? null : prefilledParent}
              onClose={() => { setShowForm(false); setEditingAP(null) }}
              onSaved={() => { setShowForm(false); setEditingAP(null); load() }}
            />
          )}
    
          {selectedAP && (
            <ActionPlanDetailPanel
              plan={selectedAP}
              onClose={() => setSelectedAP(null)}
              onUpdated={load}
              onEdit={(p) => { setSelectedAP(null); setEditingAP(p); setShowForm(true) }}
              onCancel={async (p) => { await cancelAP(p); setSelectedAP(null) }}
              onRestore={async (p) => { await restoreAP(p); setSelectedAP(null) }}
              onDelete={async (apId) => { await deleteAP({ _id: apId, numero: selectedAP.numero }); setSelectedAP(null) }}
            />
          )}
        </div>, document.body
      )}
    </div>
  )
}
