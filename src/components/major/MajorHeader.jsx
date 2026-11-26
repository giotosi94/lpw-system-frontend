import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export default function MajorHeader({ major, onOpenData, children }) {
  const navigate = useNavigate()
  return (
    <header className="mb-4 overflow-hidden rounded-lg bg-primary text-white shadow-sm">
      <div className="p-3 sm:p-4">
        <button type="button" onClick={() => navigate('/kaizen')} className="mb-2 flex items-center gap-2 text-sm text-white/80 hover:text-white">
          <ArrowLeft size={16} /> Kaizen
        </button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-white/70">{major.numero} · Major · {major.stato}</p>
            <h1 className="mt-1 break-words text-xl font-semibold text-white">{major.titolo}</h1>
          </div>
          <button type="button" onClick={onOpenData} className="rounded-lg border border-white/30 bg-white px-4 py-2 text-sm text-primary hover:bg-gray-100">Dati progetto</button>
        </div>
      </div>
      {children && <div className="border-t border-white/15 px-3 py-3 sm:px-4">{children}</div>}
    </header>
  )
}
