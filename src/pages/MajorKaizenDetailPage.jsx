import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import MajorHeader from '../components/major/MajorHeader'
import MajorRouteNavigator from '../components/major/MajorRouteNavigator'
import MajorProjectData from '../components/major/MajorProjectData'
import MajorStepContainer from '../components/major/MajorStepContainer'

export default function MajorKaizenDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const [major, setMajor] = useState(null)
  const [activeKey, setActiveKey] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dataOpen, setDataOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    setDataOpen(false)
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

  const steps = [...(major?.route_snapshot?.steps || [])].sort((a, b) => a.ordine - b.ordine)
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

  return (
    <div>
      <MajorHeader major={major} onOpenData={() => setDataOpen(true)} />
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
