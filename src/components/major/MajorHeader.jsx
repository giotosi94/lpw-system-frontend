import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export default function MajorHeader({ major, onOpenData }) {
  const navigate = useNavigate()
  const location = [major.reparto, major.linea, major.macchina].filter(Boolean).join(' / ')
  return (
    <header className="mb-5 border-b border-gray-200 pb-4">
      <button type="button" onClick={() => navigate('/kaizen')} className="mb-3 flex items-center gap-2 text-sm text-gray-600 hover:text-primary">
        <ArrowLeft size={16} /> Kaizen
      </button>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-gray-500">{major.numero} · Major · {major.stato}</p>
          <h1 className="mt-1 text-xl font-semibold text-gray-900 break-words">{major.titolo}</h1>
          {location && <p className="mt-1 text-sm text-gray-600">{location}</p>}
        </div>
        <button type="button" onClick={onOpenData} className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">Dati progetto</button>
      </div>
    </header>
  )
}
