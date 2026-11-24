import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export default function MajorHeader({ major, onOpenData, children }) {
  const navigate = useNavigate()
  return (
    <header className="mb-4 rounded-lg border border-gray-200 bg-white p-3 sm:p-4">
      <button type="button" onClick={() => navigate('/kaizen')} className="mb-2 flex items-center gap-2 text-sm text-gray-600 hover:text-primary">
        <ArrowLeft size={16} /> Kaizen
      </button>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-gray-500">{major.numero} · Major · {major.stato}</p>
          <h1 className="mt-1 text-xl font-semibold text-gray-900 break-words">{major.titolo}</h1>
        </div>
        <button type="button" onClick={onOpenData} className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">Dati progetto</button>
      </div>
      {children && <div className="mt-3 border-t border-gray-100 pt-3">{children}</div>}
    </header>
  )
}
