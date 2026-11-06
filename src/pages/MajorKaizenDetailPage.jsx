import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import MajorHeader from '../components/major/MajorHeader'
import MajorRouteNavigator from '../components/major/MajorRouteNavigator'
import MajorProjectData from '../components/major/MajorProjectData'
import MajorStepContainer from '../components/major/MajorStepContainer'
import KaizenGantMasterPlan from '../components/kaizen/KaizenGantMasterPlan'
import { useMajorPlanActivities } from '../components/kaizen/MajorPlanMilestones'

export default function MajorKaizenDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const [major, setMajor] = useState(null)
  const [activeKey, setActiveKey] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dataOpen, setDataOpen] = useState(false)
  const [ganttOpen, setGanttOpen] = useState(false)

  const activityData = useMajorPlanActivities(major, ganttOpen, activeKey)
  const toggleGantt = () => setGanttOpen(current => !current)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    setDataOpen(false)
    setGanttOpen(false)
    api.get(`/major-kaizen/${id}`).then(res => {
      if (cancelled) return
      setMajor(res.data)
      const ordered = [...(res.data.route_snapshot?.steps || [])].sort((a, b) => a.ordine - b.ordine)
      setActiveKey(ordered[0]?.step_id || null)
    }).catch(err => {
      if (!cancelled) setError(err.response?.data?.detail || 'Impossibile caricare il progetto')
    }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [id])

  const saveGantt = async gantt => {
    try {
      const res = await api.put(`/major-kaizen/${id}`, { gant_master_plan: gantt })
      setMajor(current => ({ ...current, gant_master_plan: res.data.gant_master_plan }))
    } catch (err) {
      throw err
    }
  }

  const saveMajor = async changes => {
    try {
      const res = await api.put(`/major-kaizen/${id}`, changes)
      setMajor(res.data)
      return true
    } catch (err) {
      alert('Errore salvataggio: ' + (err.response?.data?.detail || err.message))
      return false
    }
  }

  const steps = [...(major?.route_snapshot?.steps || [])].sort((a, b) => a.ordine - b.ordine).map(step =>
    step.componente === 'sustainment_plan' && step.titolo === 'Standardizzare e sostenere'
      ? { ...step, titolo: 'Standardizzare ed espandere' }
      : step
  )
  const stepsData = major?.steps_data || {}
  const activeStep = steps.find(step => step.step_id === activeKey)

  const saveStep = async changes => {
    try {
      const res = await api.patch(`/major-kaizen/${id}/step/${activeKey}`, changes)
      setMajor(res.data)
      return true
    } catch (err) {
      alert('Errore salvataggio fase: ' + (err.response?.data?.detail || err.message))
      throw err
    }
  }

  const approveGate = async () => {
    if (!confirm('Approvare e completare la fase?')) return
    try {
      const res = await api.patch(`/major-kaizen/${id}/step/${activeKey}/gate`, {
        approvato: true,
        approvato_da: user?.full_name || user?.username || 'Utente',
        note: '',
      })
      setMajor(res.data)
    } catch (err) {
      alert('Errore approvazione: ' + (err.response?.data?.detail || err.message))
    }
  }

  if (loading) return <p className="py-8 text-center">Caricamento...</p>
  if (error) return <p role="alert" className="py-8 text-red-700">{error}</p>
  if (!major) return <p className="py-8">Progetto non trovato</p>

  const ganttValue = major.gant_master_plan || {
    steps: steps.map(step => ({
      id: step.step_id,
      num: step.ordine,
      label: step.titolo,
      planned: { start: null, end: null },
      completed: { start: null, end: null },
    })),
    cells: {},
    start_date: String(major.data_inizio || major.created_at || new Date().toISOString()).slice(0, 10),
    duration_count: 12,
    granularity: 'month',
  }

  return (
    <div>
      <MajorHeader major={major} onOpenData={() => setDataOpen(true)} />
      <section className="mb-5 rounded-lg border border-gray-200 bg-white">
        <button
          type="button"
          onClick={toggleGantt}
          aria-expanded={ganttOpen}
          aria-controls="major-master-plan-panel"
          className="flex min-h-[56px] w-full items-center justify-between gap-3 bg-primary px-4 py-3 text-left text-white transition-colors hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-300"
        >
          <span className="flex items-center gap-3"><span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 4v16h16M8 7h8M11 12h9M7 17h7" /></svg></span><span className="text-sm font-bold tracking-wide">Master Plan</span></span>
          <span className="flex shrink-0 items-center gap-2 rounded-lg border border-white/30 bg-white/10 px-3 py-1.5 text-xs font-semibold"><span>{ganttOpen ? 'Nascondi' : 'Apri pianificazione'}</span><svg aria-hidden="true" viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" className={ganttOpen ? 'rotate-180' : ''}><path d="m5 7 5 5 5-5" /></svg></span>
        </button>
        {ganttOpen && (
          <div id="major-master-plan-panel" className="border-t border-gray-200 p-2">
            <KaizenGantMasterPlan key={major._id} value={ganttValue} onChange={saveGantt}
              activities={activityData.items} activitiesLoading={activityData.loading} activitiesError={activityData.error}
              onRefreshActivities={activityData.refresh} onOpenActivityPhase={setActiveKey} />
          </div>
        )}
      </section>
      <MajorRouteNavigator steps={steps} stepsData={stepsData} activeKey={activeKey} onSelect={setActiveKey} />
      {activeStep ? (
        <MajorStepContainer key={activeStep.step_id} step={activeStep} stepData={stepsData[activeStep.step_id]}
          allStepsData={stepsData} major={major} onSaveStep={saveStep} onApproveGate={approveGate} />
      ) : <p className="py-6 text-gray-600">Nessuna fase configurata per questa Route.</p>}
      {dataOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <section role="dialog" aria-modal="true" aria-labelledby="major-data-title" className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-xl bg-white p-5">
            <div className="mb-4 flex items-center justify-between border-b pb-3">
              <h2 id="major-data-title" className="text-lg font-semibold">Dati progetto</h2>
              <button type="button" onClick={() => setDataOpen(false)} className="rounded border px-3 py-1 text-sm">Chiudi</button>
            </div>
            <MajorProjectData major={major} onSave={saveMajor} />
          </section>
        </div>
      )}
    </div>
  )
}
