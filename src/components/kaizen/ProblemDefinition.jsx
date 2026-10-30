import { useEffect, useRef, useState, useId } from 'react'
import { Info } from 'lucide-react'

const CINQUE_W_UNA_H = {
  che_cosa: {
    titolo: 'CHE COSA?',
    domanda: 'Che cosa non funziona esattamente?',
    guida: [
      'Qual è l\'oggetto del problema: componente, macchina, materiale, prodotto?',
      'Che cosa è successo di anomalo: rottura, difetto, fermo, deviazione?',
      'Quali sono le caratteristiche del componente coinvolto (tipo, funzione, stato)?',
      'Descrivi il fenomeno con i fatti, senza indicare la causa.',
    ],
  },
  dove: {
    titolo: 'DOVE?',
    domanda: 'Dove si manifesta il problema?',
    guida: [
      'In quale reparto, linea, macchina, posizione precisa?',
      'In quale punto del componente compare il difetto?',
      'Riguarda un prodotto, un formato, un cliente o un fornitore specifico?',
      'Il problema è localizzato o diffuso su più punti?',
    ],
  },
  quando: {
    titolo: 'QUANDO?',
    domanda: 'Quando si verifica il problema?',
    guida: [
      'Sempre, a intermittenza, in modo stagionale?',
      'All\'avvio, a regime, dopo la pulizia, al cambio formato, dopo la manutenzione?',
      'Con quale frequenza: ogni turno, ogni lotto, ogni giorno?',
      'Da quando è comparso: è nuovo o storico?',
    ],
  },
  chi: {
    titolo: 'CHI?',
    domanda: 'Chi e coinvolto nel problema?',
    guida: [
      'Il problema cambia in base alla persona, al turno o alla squadra?',
      'Riguarda una specifica competenza o livello di formazione?',
      'Chi lo rileva e chi ne subisce l\'impatto (operatore, cliente, manutenzione)?',
    ],
  },
  quale: {
    titolo: 'QUALE?',
    domanda: 'Quale tendenza o ricorrenza si osserva?',
    guida: [
      'Quale prodotto, formato o processo e più colpito?',
      'Il problema aumenta in certe condizioni (velocità, temperature, materiali, etc.)?',
      'Esiste una relazione ricorrente o un pattern nel tempo?',
      'Quali dati confermano questa tendenza?',
    ],
  },
  come: {
    titolo: 'COME?',
    domanda: 'Come si presenta la deviazione rispetto allo standard?',
    guida: [
      'In cosa differisce dalla condizione ideale o dallo standard definito?',
      'Quanto è grande lo scostamento?',
      'Misuralo con un dato concreto: KPI, quantità, tempo, percentuale, pezzi.',
      'Questo valore è la baseline: ti servirà per confrontare prima e dopo il miglioramento.',
    ],
  },
}


function Help({ info }) {
  const [open, setOpen] = useState(false)
  const root = useRef(null)
  const id = useId()
  useEffect(() => {
    if (!open) return
    const close = event => { if (!root.current?.contains(event.target)) setOpen(false) }
    const escape = event => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', escape) }
  }, [open])
  return <span ref={root} className="relative inline-flex">
    <button type="button" aria-label={`Guida ${info.titolo}`} aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)} className="text-gray-400 hover:text-primary"><Info size={15} /></button>
    {open && <span id={id} className="absolute z-50 left-0 top-6 w-64 max-w-[75vw] bg-white border rounded-lg shadow-lg p-3 text-left normal-case font-normal"><strong className="block text-sm">{info.domanda}</strong><span className="block mt-2 space-y-1">{info.guida.map((text, index) => <span key={index} className="block text-xs text-gray-600">{text}</span>)}</span></span>}
  </span>
}

export default function ProblemDefinition({ value = {}, onChange, title = 'PASSO 1 - DEFINIZIONE DEL PROBLEMA' }) {
  const id = useId()
  return <section className="bg-white border border-gray-200 rounded-lg p-4 md:p-5">
    <h3 className="bg-primary text-white text-center py-2 rounded-lg font-bold mb-4">{title}</h3>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-3">
      {Object.entries(CINQUE_W_UNA_H).map(([key, info]) => <div key={key}>
        <div className="flex items-center gap-1.5 text-sm font-bold text-gray-600 uppercase mb-1"><label htmlFor={`${id}-${key}`}>{info.titolo}</label><Help info={info} /></div>
        <textarea id={`${id}-${key}`} value={value[key] || ''} onChange={event => onChange({ ...value, [key]: event.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" rows={2} />
      </div>)}
    </div>
  </section>
}
