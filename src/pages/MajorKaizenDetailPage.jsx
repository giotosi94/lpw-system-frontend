import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import MajorHeader from '../components/major/MajorHeader'
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

  useEffect(() => {
    if (!dataOpen) return
    const onKey = event => { if (event.key === 'Escape') setDataOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dataOpen])

  const saveGantt = async gantt => {
    const res = await api.put(`/major-kaizen/${id}`, { gant_master_plan: gantt })
    setMajor(current => ({ ...current, gant_master_plan: res.data.gant_master_plan }))
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
      : {
          ...step,
          titolo: String(step.titolo || '')
            .replace(/^Ripristino delle condizioni/i, 'Ripristino condizioni')
            .replace(/^Risultati e saving economico$/i, 'Risultati e saving'),
        }
  )
  const stepsData = major?.steps_data || {}
  const activeStep = steps.find(step => step.step_id === activeKey)

  const selectStep = key => {
    setActiveKey(key)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

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
    <div className="mx-auto w-full max-w-6xl px-0 sm:px-2">
      <MajorHeader major={major} onOpenData={() => setDataOpen(true)}>
        <section className="mb-3">
          <button
            type="button"
            onClick={toggleGantt}
            aria-expanded={ganttOpen}
            aria-controls="major-master-plan-panel"
            aria-label={ganttOpen ? 'Nascondi il Master Plan' : 'Apri il Master Plan'}
            className="flex w-full items-center justify-between gap-3 rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-left text-white hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 sm:px-4"
          >
            <span className="flex items-center gap-2">
              <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 4v16h16M8 7h8M11 12h9M7 17h7" /></svg>
              <span className="text-sm font-semibold">Master Plan</span>
            </span>
            <span className="flex shrink-0 items-center gap-1 text-xs">
              <svg aria-hidden="true" viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" className={ganttOpen ? 'rotate-180' : ''}><path d="m5 7 5 5 5-5" /></svg>
            </span>
          </button>
          {ganttOpen && (
            <div id="major-master-plan-panel" className="mt-2 overflow-x-auto rounded-lg bg-white p-2 text-gray-900">
              <KaizenGantMasterPlan key={major._id} value={ganttValue} onChange={saveGantt}
                activities={activityData.items} activitiesLoading={activityData.loading} activitiesError={activityData.error}
                onRefreshActivities={activityData.refresh} onOpenActivityPhase={selectStep} />
            </div>
          )}
        </section>
        <nav aria-label="Fasi del progetto" className="flex flex-wrap gap-1.5">
          {steps.map(step => {
            const active = step.step_id === activeKey
            const done = stepsData[step.step_id]?.stato === 'completato'
            return (
              <button
                key={step.step_id}
                type="button"
                onClick={() => selectStep(step.step_id)}
                aria-current={active ? 'step' : undefined}
                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 ${active ? 'border-gold bg-gold text-white' : 'border-white/25 bg-white/10 text-white hover:bg-white/20'}`}
              >
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs ${active ? 'bg-white/20' : done ? 'bg-white text-green-700' : 'bg-white/15 text-white'}`}>{done ? '✓' : step.ordine}</span>
                <span className="whitespace-nowrap">{step.titolo}</span>
              </button>
            )
          })}
        </nav>
      </MajorHeader>
      <div className="rounded-lg border border-gray-200 bg-white p-3 sm:p-5">
        {activeStep ? (
          <MajorStepContainer key={activeStep.step_id} step={activeStep} stepData={stepsData[activeStep.step_id]}
            allStepsData={stepsData} major={major} onSaveStep={saveStep} onApproveGate={approveGate} />
        ) : <p className="py-6 text-gray-600">Nessuna fase configurata per questa Route.</p>}
      </div>
      {dataOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={event => { if (event.target === event.currentTarget) setDataOpen(false) }}>
          <section role="dialog" aria-modal="true" aria-labelledby="major-data-title" className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-t-xl bg-white p-4 sm:rounded-xl sm:p-5">
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
