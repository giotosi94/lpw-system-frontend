import React, { useEffect, useRef, useState } from 'react'
import { Upload, X, Pencil, ArrowUp, ArrowDown, Trash2 } from 'lucide-react'
import api from '../../services/api'
import { OPL_SYMBOLS } from './oplSymbols'
import OplImageEditor from './OplImageEditor'

const AREE_OPL = ['Produzione', 'Sicurezza', 'Ambiente', 'Qualità'].map(label => ({ _id: label, label }))
const TIPI_OPL = ['Conoscenza di Base', 'Problema', 'Miglioramento'].map(label => ({ _id: label, label }))

const LAYOUTS = [
  { id: 'single', label: 'Singola immagine', desc: 'Una o piu immagini in colonna' },
  { id: 'before_after', label: 'Prima - Dopo', desc: 'Due immagini affiancate' },
  { id: 'text', label: 'Solo testo', desc: 'Nessuna immagine' },
]

function newImage(slot = 'main') {
  return {
    id: `img_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    slot,
    base64: '',
    didascalia: '',
    annotations: [],
  }
}

async function compressImage(file, maxSize = 1280, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        let w = img.width
        let h = img.height
        if (w > h && w > maxSize) {
          h = h * (maxSize / w)
          w = maxSize
        } else if (h > maxSize) {
          w = w * (maxSize / h)
          h = maxSize
        }
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.onerror = reject
      img.src = e.target.result
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function OplNativaModal({ onClose, onSaved }) {
  const [saving, setSaving] = useState(false)
  const [step, setStep] = useState(1)
  const areaOptions = AREE_OPL
  const tipoOptions = TIPI_OPL
  const [reparti, setReparti] = useState([])

  const [form, setForm] = useState({
    titolo: '',
    area_opl_id: '',
    area_opl_label: '',
    tipo_opl_id: '',
    tipo_opl_label: '',
    reparto: '',
    linea: '',
    macchina: '',
    autore: '',
    layout: 'single',
    problema: '',
    causa: '',
    miglioramento: '',
    verifica_1: '',
    verifica_2: '',
    verifica_3: '',
    immagini: [],
  })

  useEffect(() => {
    api.get('/reparti/').then(res => setReparti(res.data || [])).catch(() => {})
    try {
      const userStr = localStorage.getItem('user')
      if (userStr) {
        const user = JSON.parse(userStr)
        setForm(f => ({ ...f, autore: user.full_name || user.name || user.email || '' }))
      }
    } catch (e) { /* ignore */ }
  }, [])

  const lineeAvailable = (reparti.find(r => r.nome === form.reparto)?.linee || [])
  const macchineAvailable = (lineeAvailable.find(l => l.nome === form.linea)?.macchine || [])

  function handleAreaChange(id) {
    const a = areaOptions.find(x => x._id === id)
    setForm({ ...form, area_opl_id: id, area_opl_label: a?.label || '' })
  }
  function handleTipoChange(id) {
    const t = tipoOptions.find(x => x._id === id)
    setForm({ ...form, tipo_opl_id: id, tipo_opl_label: t?.label || '' })
  }

  function setLayout(layout) {
    setForm(f => {
      if (layout === 'before_after') {
        const before = f.immagini.find(i => i.slot === 'before') || newImage('before')
        const after = f.immagini.find(i => i.slot === 'after') || newImage('after')
        return { ...f, layout, immagini: [before, after] }
      }
      if (layout === 'text') {
        return { ...f, layout, immagini: [] }
      }
      const kept = f.immagini.filter(i => i.slot === 'main')
      return { ...f, layout, immagini: kept }
    })
  }

  async function pickImage(file) {
    if (!file) return null
    if (!file.type.startsWith('image/')) {
      alert('Seleziona un file immagine valido')
      return null
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('Immagine troppo grande (max 5 MB)')
      return null
    }
    return compressImage(file, 1280, 0.8)
  }

  async function addMainImage(file) {
    const base64 = await pickImage(file)
    if (!base64) return
    const image = newImage('main')
    image.base64 = base64
    setForm(f => ({ ...f, immagini: [...f.immagini, image] }))
  }

  async function setSlotImage(slot, file) {
    const base64 = await pickImage(file)
    if (!base64) return
    setForm(f => ({
      ...f,
      immagini: f.immagini.map(i => i.slot === slot ? { ...i, base64 } : i),
    }))
  }

  function updateImage(id, updates) {
    setForm(f => ({ ...f, immagini: f.immagini.map(i => i.id === id ? { ...i, ...updates } : i) }))
  }
  function removeImage(id) {
    setForm(f => ({ ...f, immagini: f.immagini.filter(i => i.id !== id) }))
  }
  function moveImage(index, dir) {
    setForm(f => {
      const list = [...f.immagini]
      const target = index + dir
      if (target < 0 || target >= list.length) return f
      const tmp = list[index]
      list[index] = list[target]
      list[target] = tmp
      return { ...f, immagini: list }
    })
  }

  async function handleSubmit() {
    if (!form.titolo.trim()) {
      alert('Titolo obbligatorio')
      setStep(1)
      return
    }
    setSaving(true)
    try {
      const payload = {
        titolo: form.titolo,
        area_opl_id: form.area_opl_id || null,
        area_opl_label: form.area_opl_label || null,
        tipo_opl_id: form.tipo_opl_id || null,
        tipo_opl_label: form.tipo_opl_label || null,
        reparto: form.reparto || null,
        linea: form.linea || null,
        macchina: form.macchina || null,
        autore: form.autore || null,
        layout: form.layout,
        problema: form.problema,
        causa: form.causa,
        miglioramento: form.miglioramento,
        verifica_1: form.verifica_1,
        verifica_2: form.verifica_2,
        verifica_3: form.verifica_3,
        immagini: form.immagini.map(i => ({
          id: i.id,
          slot: i.slot,
          base64: i.base64 || null,
          didascalia: i.didascalia || '',
          annotations: i.annotations || [],
        })),
      }
      const res = await api.post('/documenti/opl-nativa', payload)
      alert(`OPL Nativa ${res.data.numero} creata con successo`)
      onSaved()
      onClose()
    } catch (err) {
      alert('Errore creazione OPL: ' + (err.response?.data?.detail || err.message))
    } finally {
      setSaving(false)
    }
  }

  const canGoNext = form.titolo.trim().length > 0

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-3xl max-h-[95vh] overflow-y-auto shadow-2xl">
        <div className="bg-yellow-500 text-white p-4 rounded-t-xl flex justify-between items-center sticky top-0 z-10">
          <div>
            <h2 className="text-lg font-bold">Nuova OPL Nativa</h2>
            <div className="text-xs opacity-90">Step {step} di 4</div>
          </div>
          <button onClick={onClose}><X size={20} /></button>
        </div>

        <div className="flex border-b bg-gray-50">
          {[
            { n: 1, label: 'Anagrafica' },
            { n: 2, label: 'Layout' },
            { n: 3, label: 'Contenuto' },
            { n: 4, label: 'Verifica' },
          ].map(s => (
            <button
              key={s.n}
              onClick={() => setStep(s.n)}
              className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                step === s.n ? 'border-yellow-500 text-yellow-700 bg-white' : 'border-transparent text-gray-500 hover:bg-gray-100'
              }`}
            >
              <span className="font-mono mr-1">{s.n}.</span> {s.label}
            </button>
          ))}
        </div>

        {step === 1 && (
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Titolo <span className="text-red-500">*</span></label>
              <input autoFocus value={form.titolo} onChange={e => setForm({ ...form, titolo: e.target.value })} className="w-full border rounded-lg px-3 py-2" placeholder="Es: Pulizia filtro Bindler 11" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Area OPL</label>
                <select value={form.area_opl_id} onChange={e => handleAreaChange(e.target.value)} className="w-full border rounded-lg px-3 py-2">
                  <option value="">— Seleziona —</option>
                  {areaOptions.map(a => <option key={a._id} value={a._id}>{a.icon ? `${a.icon} ` : ''}{a.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Tipo OPL</label>
                <select value={form.tipo_opl_id} onChange={e => handleTipoChange(e.target.value)} className="w-full border rounded-lg px-3 py-2">
                  <option value="">— Seleziona —</option>
                  {tipoOptions.map(t => <option key={t._id} value={t._id}>{t.icon ? `${t.icon} ` : ''}{t.label}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Reparto</label>
                <select value={form.reparto} onChange={e => setForm({ ...form, reparto: e.target.value, linea: '', macchina: '' })} className="w-full border rounded-lg px-3 py-2">
                  <option value="">— Seleziona —</option>
                  {reparti.map(r => <option key={r._id} value={r.nome}>{r.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Linea</label>
                <select value={form.linea} onChange={e => setForm({ ...form, linea: e.target.value, macchina: '' })} disabled={!form.reparto} className="w-full border rounded-lg px-3 py-2 disabled:bg-gray-100">
                  <option value="">— Seleziona —</option>
                  {lineeAvailable.map(l => <option key={l.id} value={l.nome}>{l.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Macchina</label>
                <select value={form.macchina} onChange={e => setForm({ ...form, macchina: e.target.value })} disabled={!form.linea} className="w-full border rounded-lg px-3 py-2 disabled:bg-gray-100">
                  <option value="">— Seleziona —</option>
                  {macchineAvailable.map(m => <option key={m.id} value={m.nome}>{m.nome}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Autore</label>
              <input value={form.autore} onChange={e => setForm({ ...form, autore: e.target.value })} className="w-full border rounded-lg px-3 py-2" />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {LAYOUTS.map(l => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setLayout(l.id)}
                  className={`border-2 rounded-lg p-4 text-left transition-all ${
                    form.layout === l.id ? 'border-yellow-500 bg-yellow-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-semibold text-gray-800">{l.label}</div>
                  <div className="text-xs text-gray-500 mt-1">{l.desc}</div>
                </button>
              ))}
            </div>

            {form.layout === 'single' && (
              <div className="space-y-3">
                {form.immagini.map((image, index) => (
                  <div key={image.id} className="border rounded-lg p-3 flex gap-3 items-start">
                    <img src={image.base64} alt="" className="w-28 h-28 object-cover rounded border bg-gray-50" />
                    <div className="flex-1 space-y-2">
                      <input
                        value={image.didascalia}
                        onChange={e => updateImage(image.id, { didascalia: e.target.value })}
                        placeholder="Didascalia (opzionale)"
                        className="w-full border rounded-lg px-3 py-2 text-sm"
                      />
                      <div className="flex gap-2">
                        <button type="button" onClick={() => moveImage(index, -1)} className="p-1.5 border rounded hover:bg-gray-50"><ArrowUp size={15} /></button>
                        <button type="button" onClick={() => moveImage(index, 1)} className="p-1.5 border rounded hover:bg-gray-50"><ArrowDown size={15} /></button>
                        <button type="button" onClick={() => removeImage(image.id)} className="p-1.5 border rounded text-red-600 hover:bg-red-50"><Trash2 size={15} /></button>
                      </div>
                    </div>
                  </div>
                ))}
                <label className="block border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-yellow-400 hover:bg-yellow-50">
                  <input type="file" accept="image/*" onChange={e => { addMainImage(e.target.files?.[0]); e.target.value = '' }} className="hidden" />
                  <Upload className="mx-auto mb-2 text-gray-400" size={28} />
                  <p className="text-sm text-gray-500">Aggiungi immagine (max 5 MB)</p>
                </label>
              </div>
            )}

            {form.layout === 'before_after' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {['before', 'after'].map(slot => {
                  const image = form.immagini.find(i => i.slot === slot) || newImage(slot)
                  const title = slot === 'before' ? 'PRIMA' : 'DOPO'
                  const color = slot === 'before' ? 'text-red-600' : 'text-green-600'
                  return (
                    <div key={slot} className="border rounded-lg p-3">
                      <div className={`font-bold text-center mb-2 ${color}`}>{title}</div>
                      {image.base64 ? (
                        <img src={image.base64} alt="" className="w-full h-40 object-contain border rounded bg-gray-50" />
                      ) : (
                        <label className="block border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-yellow-400 hover:bg-yellow-50">
                          <input type="file" accept="image/*" onChange={e => { setSlotImage(slot, e.target.files?.[0]); e.target.value = '' }} className="hidden" />
                          <Upload className="mx-auto mb-1 text-gray-400" size={24} />
                          <p className="text-xs text-gray-500">Carica immagine</p>
                        </label>
                      )}
                      <input
                        value={image.didascalia}
                        onChange={e => updateImage(image.id, { didascalia: e.target.value })}
                        placeholder="Didascalia"
                        className="w-full border rounded-lg px-3 py-2 text-sm mt-2"
                      />
                    </div>
                  )
                })}
              </div>
            )}

            {form.layout === 'text' && (
              <div className="bg-gray-50 border rounded-lg p-4 text-sm text-gray-500">
                Layout solo testo: nessuna immagine, verranno mostrati solo Problema, Causa e Miglioramento.
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Problema (situazione riscontrata)</label>
              <textarea value={form.problema} onChange={e => setForm({ ...form, problema: e.target.value })} rows={3} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Causa</label>
              <textarea value={form.causa} onChange={e => setForm({ ...form, causa: e.target.value })} rows={3} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Miglioramento / Contenuto</label>
              <textarea value={form.miglioramento} onChange={e => setForm({ ...form, miglioramento: e.target.value })} rows={4} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="p-6 space-y-4">
            <div className="bg-blue-50 border-l-4 border-blue-400 rounded-r-lg p-3 text-sm text-blue-800">
              Le domande di verifica non compaiono nella prima pagina dell'OPL. Sono visibili solo nel tab Verifica.
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Domanda 1</label>
              <input value={form.verifica_1} onChange={e => setForm({ ...form, verifica_1: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Es: Ogni quanto va effettuato il controllo?" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Domanda 2</label>
              <input value={form.verifica_2} onChange={e => setForm({ ...form, verifica_2: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Domanda 3</label>
              <input value={form.verifica_3} onChange={e => setForm({ ...form, verifica_3: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
        )}

        <div className="border-t bg-gray-50 px-6 py-3 flex justify-between items-center sticky bottom-0">
          <button onClick={onClose} className="px-4 py-2 border rounded-lg text-sm">Annulla</button>
          <div className="flex gap-2">
            {step > 1 && <button onClick={() => setStep(step - 1)} className="px-4 py-2 border rounded-lg text-sm">← Indietro</button>}
            {step < 4 ? (
              <button onClick={() => setStep(step + 1)} disabled={!canGoNext} className="px-4 py-2 bg-yellow-500 text-white rounded-lg text-sm hover:bg-yellow-600 disabled:opacity-50">Avanti →</button>
            ) : (
              <button onClick={handleSubmit} disabled={saving || !canGoNext} className="px-6 py-2 bg-yellow-500 text-white rounded-lg text-sm hover:bg-yellow-600 disabled:opacity-50 font-medium">
                {saving ? 'Creazione...' : 'Crea OPL'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export function OplNativaPreview({ doc, imageBlobUrl }) {
  const [tab, setTab] = useState('opl')
  const [editorTarget, setEditorTarget] = useState(null)
  const [currentDoc, setCurrentDoc] = useState(doc)

  useEffect(() => { setCurrentDoc(doc) }, [doc])

  const data = currentDoc.opl_data || {}
  const layout = data.layout || 'single'
  const areaLabel = data.area_opl_label || '—'
  const tipoLabel = data.tipo_opl_label || '—'
  const immagini = Array.isArray(data.immagini) ? data.immagini : []
  const legacyAnnotations = data.annotations || []
  const hasVerifica = data.verifica_1 || data.verifica_2 || data.verifica_3

  async function reloadDoc() {
    try {
      const res = await api.get(`/documenti/${currentDoc._id}`)
      setCurrentDoc(res.data)
    } catch (err) { /* ignore */ }
  }

  async function saveImageAnnotations(imageId, annotations) {
    const nextImmagini = immagini.map(i => i.id === imageId ? { ...i, annotations } : i)
    try {
      await api.patch(`/documenti/${currentDoc._id}/opl-annotations`, {
        annotations: legacyAnnotations,
        immagini: nextImmagini,
      })
      await reloadDoc()
    } catch (err) {
      alert('Errore salvataggio annotazioni: ' + (err.response?.data?.detail || err.message))
    }
  }

  const beforeImg = immagini.find(i => i.slot === 'before')
  const afterImg = immagini.find(i => i.slot === 'after')

  return (
    <div className="w-full h-full overflow-auto bg-gray-100 p-6">
      <div className="max-w-4xl mx-auto bg-white shadow-lg rounded-lg overflow-hidden border-4 border-yellow-400">
        <div className="bg-yellow-400 px-6 py-4 border-b-4 border-yellow-500">
          <div className="flex justify-between items-start gap-4">
            <div className="flex-1">
              <div className="text-xs font-bold uppercase tracking-wider text-yellow-900 mb-1">One Point Lesson</div>
              <h1 className="text-2xl font-bold text-gray-900 leading-tight">{currentDoc.titolo}</h1>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="bg-white rounded px-3 py-1 shadow-sm">
                <div className="text-[10px] uppercase text-gray-500 font-semibold">Numero</div>
                <div className="font-mono font-bold text-lg text-gray-900">{currentDoc.numero}</div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3 text-xs">
            <MetaBadge label="Area" value={areaLabel} />
            <MetaBadge label="Tipo" value={tipoLabel} />
            <MetaBadge label="Reparto" value={currentDoc.reparto || '—'} />
            <MetaBadge label="Linea" value={currentDoc.linea || '—'} />
          </div>
        </div>

        <div className="flex border-b bg-gray-50">
          <button onClick={() => setTab('opl')} className={`px-5 py-2.5 text-sm font-medium border-b-2 ${tab === 'opl' ? 'border-yellow-500 text-yellow-700 bg-white' : 'border-transparent text-gray-500'}`}>OPL</button>
          {hasVerifica && (
            <button onClick={() => setTab('verifica')} className={`px-5 py-2.5 text-sm font-medium border-b-2 ${tab === 'verifica' ? 'border-yellow-500 text-yellow-700 bg-white' : 'border-transparent text-gray-500'}`}>Verifica apprendimento</button>
          )}
        </div>

        {tab === 'opl' ? (
          <div className="p-6 space-y-5">
            {layout === 'before_after' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <BeforeAfterCard title="PRIMA" color="text-red-600" image={beforeImg} />
                <BeforeAfterCard title="DOPO" color="text-green-600" image={afterImg} />
              </div>
            ) : layout === 'single' && immagini.length > 0 ? (
              <div className="space-y-4">
                {immagini.map(image => (
                  <div key={image.id} className="relative bg-gray-50 border-2 border-gray-200 rounded-lg p-4">
                    <button
                      onClick={() => setEditorTarget(image)}
                      className="absolute top-2 right-2 z-10 bg-yellow-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-yellow-600 shadow flex items-center gap-1"
                    >
                      <Pencil size={12} /> Modifica annotazioni
                    </button>
                    <AnnotatedImage imageUrl={image.base64} annotations={image.annotations || []} />
                    {image.didascalia && <div className="text-center text-sm text-gray-600 mt-2">{image.didascalia}</div>}
                  </div>
                ))}
              </div>
            ) : layout === 'single' && imageBlobUrl ? (
              <div className="relative bg-gray-50 border-2 border-gray-200 rounded-lg p-4">
                <AnnotatedImage imageUrl={imageBlobUrl} annotations={legacyAnnotations} />
              </div>
            ) : null}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <OplBox title="Problema" content={data.problema} bgColor="bg-red-50" borderColor="border-red-300" textColor="text-red-800" icon="⚠️" />
              <OplBox title="Causa" content={data.causa} bgColor="bg-orange-50" borderColor="border-orange-300" textColor="text-orange-800" icon="🔍" />
              <OplBox title="Miglioramento" content={data.miglioramento} bgColor="bg-green-50" borderColor="border-green-300" textColor="text-green-800" icon="✅" />
            </div>
          </div>
        ) : (
          <div className="p-6">
            <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4">
              <h3 className="font-bold text-blue-900 mb-3 flex items-center gap-2"><span>📝</span> Verifica apprendimento</h3>
              <ol className="space-y-2 list-decimal list-inside text-sm text-blue-900">
                {data.verifica_1 && <li>{data.verifica_1}</li>}
                {data.verifica_2 && <li>{data.verifica_2}</li>}
                {data.verifica_3 && <li>{data.verifica_3}</li>}
              </ol>
            </div>
          </div>
        )}

        <div className="bg-gray-50 border-t px-6 py-3 flex justify-between text-xs text-gray-600">
          <div><strong>Autore:</strong> {currentDoc.autore || '—'}</div>
          <div><strong>Versione:</strong> v{currentDoc.versione || 1} · <strong>Stato:</strong> {currentDoc.stato}</div>
          <div>{currentDoc.created_at && new Date(currentDoc.created_at).toLocaleDateString('it-IT')}</div>
        </div>
      </div>

      {editorTarget && (
        <OplImageEditor
          documento={{ ...currentDoc, opl_data: { ...data, annotations: editorTarget.annotations || [] } }}
          imageBlobUrl={editorTarget.base64}
          onClose={() => setEditorTarget(null)}
          onSaveAnnotations={async (savedAnnotations) => {
            await saveImageAnnotations(editorTarget.id, savedAnnotations)
          }}
          onSaved={() => setEditorTarget(null)}
        />
      )}
    </div>
  )
}

function BeforeAfterCard({ title, color, image }) {
  return (
    <div className="border rounded-lg p-3">
      <div className={`font-bold text-center mb-2 ${color}`}>{title}</div>
      {image?.base64 ? (
        <AnnotatedImage imageUrl={image.base64} annotations={image.annotations || []} />
      ) : (
        <div className="h-40 flex items-center justify-center text-gray-300 border-2 border-dashed rounded">Nessuna immagine</div>
      )}
      {image?.didascalia && <div className="text-center text-sm text-gray-600 mt-2">{image.didascalia}</div>}
    </div>
  )
}

function AnnotatedImage({ imageUrl, annotations }) {
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 })
  const imgRef = useRef(null)

  function onImgLoad(e) {
    setImgSize({ w: e.target.naturalWidth, h: e.target.naturalHeight })
  }

  return (
    <div className="relative inline-block max-w-full">
      {React.createElement('img', {
        ref: imgRef,
        src: imageUrl,
        alt: 'OPL',
        onLoad: onImgLoad,
        className: 'max-w-full max-h-96 object-contain block',
      })}
      {imgSize.w > 0 && (annotations || []).length > 0 && (
        <svg viewBox={`0 0 ${imgSize.w} ${imgSize.h}`} className="absolute top-0 left-0 w-full h-full pointer-events-none" preserveAspectRatio="xMidYMid meet">
          {annotations.map(ann => <AnnotationSvg key={ann.id} annotation={ann} />)}
        </svg>
      )}
    </div>
  )
}

function AnnotationSvg({ annotation }) {
  const { x, y, width, height, rotation = 0 } = annotation
  const cx = x + width / 2
  const cy = y + height / 2
  const transform = rotation ? `rotate(${rotation} ${cx} ${cy})` : undefined
  const r = Math.min(width, height) / 2

  if (annotation.symbolId === '__custom_image__' && annotation.imageData) {
    return React.createElement('image', {
      href: annotation.imageData, x, y, width, height, transform, preserveAspectRatio: 'none',
    })
  }

  const symbol = OPL_SYMBOLS.find(s => s.id === annotation.symbolId)
  if (!symbol) return null

  if (symbol.type === 'text') {
    return (
      <text x={cx} y={cy} fill={symbol.color} fontSize={symbol.fontSize} fontWeight={symbol.fontStyle === 'bold' ? 'bold' : 'normal'} textAnchor="middle" dominantBaseline="middle" transform={transform}>
        {annotation.text || symbol.text}
      </text>
    )
  }
  if (symbol.render === 'ko_circle') {
    return (
      <g transform={transform}>
        <circle cx={cx} cy={cy} r={r} fill="#DC2626" stroke="#7F1D1D" strokeWidth="3" />
        <text x={cx} y={cy} fill="white" fontSize={height * 0.6} fontWeight="bold" textAnchor="middle" dominantBaseline="central">✕</text>
      </g>
    )
  }
  if (symbol.render === 'ok_circle') {
    return (
      <g transform={transform}>
        <circle cx={cx} cy={cy} r={r} fill="#16A34A" stroke="#14532D" strokeWidth="3" />
        <text x={cx} y={cy} fill="white" fontSize={height * 0.6} fontWeight="bold" textAnchor="middle" dominantBaseline="central">✓</text>
      </g>
    )
  }
  if (symbol.render === 'warning') {
    const points = [[cx, y], [x + width, y + height], [x, y + height]].map(p => p.join(',')).join(' ')
    return (
      <g transform={transform}>
        <polygon points={points} fill="#FBBF24" stroke="#000" strokeWidth="3" />
        <text x={cx} y={cy + height * 0.15} fill="black" fontSize={height * 0.5} fontWeight="bold" textAnchor="middle" dominantBaseline="middle">!</text>
      </g>
    )
  }
  if (symbol.render === 'info') {
    return (
      <g transform={transform}>
        <circle cx={cx} cy={cy} r={r} fill="#2563EB" stroke="#1E3A8A" strokeWidth="3" />
        <text x={cx} y={cy} fill="white" fontSize={height * 0.6} fontWeight="bold" fontStyle="italic" textAnchor="middle" dominantBaseline="central">i</text>
      </g>
    )
  }
  if (symbol.render === 'arrow') {
    const c = symbol.color || '#DC2626'
    const bodyH = height * 0.5
    const headW = width * 0.4
    const points = [
      [x + headW, y + (height - bodyH) / 2],
      [x + width, y + (height - bodyH) / 2],
      [x + width, y + (height + bodyH) / 2],
      [x + headW, y + (height + bodyH) / 2],
      [x + headW, y + height],
      [x, y + height / 2],
      [x + headW, y],
      [x + headW, y + (height - bodyH) / 2],
    ].map(p => p.join(',')).join(' ')
    return <g transform={transform}><polygon points={points} fill={c} stroke="#000" strokeWidth="2" /></g>
  }
  if (symbol.render === 'rect') {
    return <rect x={x} y={y} width={width} height={height} fill="none" stroke={symbol.color} strokeWidth="5" rx="4" transform={transform} />
  }
  if (symbol.render === 'circle') {
    return <circle cx={cx} cy={cy} r={r} fill="none" stroke={symbol.color} strokeWidth="5" transform={transform} />
  }
  if (symbol.type === 'icon') {
    const isHazard = symbol.category === 'hazard'
    if (isHazard) {
      const points = [[cx, y], [x + width, y + height], [x, y + height]].map(p => p.join(',')).join(' ')
      return (
        <g transform={transform}>
          <polygon points={points} fill={symbol.color} stroke="#000" strokeWidth="3" />
          <text x={cx} y={cy + height * 0.15} fontSize={height * 0.5} textAnchor="middle" dominantBaseline="middle">{symbol.preview}</text>
        </g>
      )
    }
    return (
      <g transform={transform}>
        <circle cx={cx} cy={cy} r={r} fill={symbol.color} stroke="#000" strokeWidth="3" />
        <text x={cx} y={cy} fontSize={height * 0.5} textAnchor="middle" dominantBaseline="central">{symbol.preview}</text>
      </g>
    )
  }
  return null
}

function MetaBadge({ label, value }) {
  return (
    <div className="bg-white bg-opacity-70 rounded px-2 py-1">
      <div className="text-[9px] uppercase font-bold text-yellow-900">{label}</div>
      <div className="text-sm font-medium text-gray-800 truncate">{value}</div>
    </div>
  )
}

function OplBox({ title, content, bgColor, borderColor, textColor, icon }) {
  return (
    <div className={`${bgColor} border-2 ${borderColor} rounded-lg p-4`}>
      <div className={`font-bold ${textColor} mb-2 flex items-center gap-1 text-sm uppercase`}>
        <span>{icon}</span> {title}
      </div>
      <div className={`text-sm ${textColor} whitespace-pre-wrap min-h-[60px]`}>
        {content || <span className="italic opacity-50">Non compilato</span>}
      </div>
    </div>
  )
}
