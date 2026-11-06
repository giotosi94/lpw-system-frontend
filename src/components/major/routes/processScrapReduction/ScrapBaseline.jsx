import ProblemDefinition from '../../../kaizen/ProblemDefinition'
import { useEffect, useMemo, useRef, useState } from 'react'
import api from '../../../../services/api'
import * as XLSX from 'xlsx'
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell } from 'recharts'

const SCRAP_GUIDES = {
  che_cosa: {
    titolo: 'CHE COSA?',
    domanda: 'Quale scarto o rework osservi?',
    guida: [
      'Tipo di difetto e prodotto coinvolto.',
      'Cosa dovrebbe risultare invece: la specifica attesa.',
      'Descrivi i fatti, non la causa.',
    ],
  },
  dove: {
    titolo: 'DOVE?',
    domanda: 'Dove si genera e dove si rileva lo scarto?',
    guida: [
      'In quale operazione o fase macchina viene generato.',
      'Dove viene rilevato: spesso non coincide con il punto in cui nasce.',
      'Componente o zona della macchina coinvolti.',
    ],
  },
  quando: {
    titolo: 'QUANDO?',
    domanda: 'Quando compare lo scarto?',
    guida: [
      'Da quando succede: è nuovo o storico?',
      'All\'avvio, al cambio formato, dopo un fermo o a regime?',
      'È continuo o a picchi? In quali turni?',
    ],
  },
  chi: {
    titolo: 'CHI?',
    domanda: 'Quali prodotti e chi sono coinvolti?',
    guida: [
      'Quali prodotti, formati o ricette sono interessati.',
      'Chi rileva lo scarto.',
      'Non chi ha sbagliato.',
    ],
  },
  quale: {
    titolo: 'QUALE?',
    domanda: 'Quanto pesa lo scarto?',
    guida: [
      'Quantità in kg o pezzi.',
      'Percentuale sulla produzione e tendenza nel periodo.',
      'Usa i dati STAIN quando disponibili.',
    ],
  },
  come: {
    titolo: 'COME?',
    domanda: 'Come si manifesta e come viene rilevato?',
    guida: [
      'Come si presenta il difetto.',
      'Come viene rilevato: a vista, a peso, con scarto automatico della macchina.',
      'Dove finisce: scarto (sacco verde) o rework (sacco blu e lilla).',
    ],
  },
}

function filterStainByProduct(snapshot, products = []) {
  const selected = new Set(products)
  const useFilter = products.length > 0 && Boolean(snapshot?.dettaglio)
  const productionDays = new Map()
  ;(snapshot?.produzione || []).forEach(row => {
    if (useFilter && !selected.has(row.prodotto)) return
    productionDays.set(row.data, (productionDays.get(row.data) || 0) + row.kg)
  })
  const productionTotal = [...productionDays.values()].reduce((sum, value) => sum + value, 0)
  const production = productionTotal > 0 ? productionTotal : null
  const withProduction = andamento => {
    const days = new Map(andamento.map(row => [row.data, row.kg]))
    productionDays.forEach((value, day) => { if (!days.has(day)) days.set(day, 0) })
    return [...days].sort((a, b) => a[0].localeCompare(b[0])).map(([data, kg]) => ({ data, kg, produzione: productionDays.get(data) || 0 }))
  }
  if (!useFilter) {
    return { pareto: snapshot?.pareto || [], andamento: withProduction(snapshot?.andamento || []), total: snapshot?.totale_kg || 0, production }
  }
  const groups = new Map()
  const days = new Map()
  let total = 0
  snapshot.dettaglio.forEach(row => {
    if (!selected.has(row.prodotto)) return
    const key = `${row.codice}|${row.causale}`
    const item = groups.get(key) || { codice: row.codice, causale: row.causale, tipo: row.tipo, kg: 0 }
    item.kg += row.kg
    groups.set(key, item)
    days.set(row.data, (days.get(row.data) || 0) + row.kg)
    total += row.kg
  })
  return {
    pareto: [...groups.values()].sort((a, b) => b.kg - a.kg),
    andamento: withProduction([...days].map(([data, kg]) => ({ data, kg }))),
    total,
    production,
  }
}

function stainProducts(snapshot) {
  const totals = new Map()
  ;(snapshot?.dettaglio || []).forEach(row => totals.set(row.prodotto, (totals.get(row.prodotto) || 0) + row.kg))
  return [...totals].sort((a, b) => b[1] - a[1]).map(([nome, kg]) => ({ nome, kg }))
}

const HEADERS = ['Data', 'Prodotto', 'Formato', 'Operazione / fase macchina', 'Scarto / Rework', 'Quantità', 'Note']
const KEYS = ['periodo', 'prodotto', 'formato', 'operazione', 'tipo', 'quantita', 'note']
const uid = () => globalThis.crypto?.randomUUID?.() || `r_${Date.now()}_${Math.random().toString(16).slice(2)}`
const number = value => value === '' || value == null ? null : Number(String(value).replace(',', '.'))
const valid = value => number(value) !== null && Number.isFinite(number(value)) && number(value) >= 0
const fmt = value => value == null || !Number.isFinite(value) ? 'Non disponibile' : new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 }).format(value)
const blank = () => ({ id: uid(), periodo: '', categoria: '', prodotto: '', formato: '', operazione: '', componente: '', tipo: 'Scarto', quantita: '', produzione: '', note: '' })
const button = 'border border-gray-300 rounded px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50'
const input = 'w-full min-w-0 border border-gray-300 rounded px-2 py-2 text-sm bg-white'

function objectiveRows(data) {
  if (Array.isArray(data.obiettivi) && data.obiettivi.length) return data.obiettivi.map(row => ({ ...row, id: row.id || uid() }))
  return [{ id: uid(), fonte: data.baseline_fonte || data.origine || 'stain', kpi: data.stain_kpi || 'kg', perimetro: data.perimetro_kpi || 'totale', riduzione: data.riduzione_pct ?? '', target_precedente: data.target ?? '' }]
}
function evaluateObjective(row, form, stainAnalysis, manualAnalysis) {
  const source = row.fonte === 'manuale' ? manualAnalysis : stainAnalysis
  const priorities = row.fonte === 'manuale' ? form.priorita_manuali : form.priorita_stain
  const unit = row.fonte === 'manuale' ? form.unita_manuale : row.kpi === 'percentuale' ? '%' : 'kg'
  const errors = [...(source.issues || [])]
  let categories = []
  if (row.perimetro === 'priorita') categories = priorities
  else if (row.perimetro !== 'totale') categories = [row.perimetro]
  if (row.perimetro !== 'totale' && !categories.length) errors.push('Seleziona prima le priorita nel Pareto della fonte scelta.')
  if (categories.some(category => !priorities.includes(category))) errors.push('Questa perdita non e piu tra le priorita selezionate. Scegli nuovamente il perimetro.')
  if (categories.some(category => !source.pareto.some(item => item.categoria === category))) errors.push('Perdita non presente nei dati correnti.')
  const quantity = row.perimetro === 'totale' ? source.total : source.pareto.filter(item => categories.includes(item.categoria)).reduce((sum, item) => sum + item.quantita, 0)
  if (row.fonte === 'stain' && !form.stain_snapshot) errors.push('Carica prima i dati STAIN.')
  if (row.fonte === 'manuale' && !source.pareto.length) errors.push('Inserisci prima i dati della raccolta manuale.')
  if (row.fonte === 'manuale' && unit === '%') errors.push('La raccolta manuale in percentuale non dispone di una produzione verificabile per questo calcolo.')
  if (unit === '%' && !source.production) errors.push('Produzione mancante: il KPI percentuale non e disponibile.')
  const baseline = errors.length ? null : unit === '%' ? quantity / source.production * 100 : quantity
  const reduction = row.riduzione === '' || row.riduzione == null ? baseline > 0 && valid(row.target_precedente) ? (baseline - number(row.target_precedente)) / baseline * 100 : null : number(row.riduzione)
  if (reduction !== null && (!Number.isFinite(reduction) || reduction < 0 || reduction > 100)) errors.push('La riduzione deve essere tra 0 e 100%.')
  const target = baseline !== null && reduction !== null && !errors.length ? baseline * (1 - reduction / 100) : null
  return { baseline, target, reduction, unit, categories, errors: [...new Set(errors)], avoided: target === null ? null : baseline - target, kg: target !== null && unit === '%' ? (baseline - target) / 100 * source.production : target !== null && unit === 'kg' ? baseline - target : null }
}

function initial(data, major) {
  return {
    ...data,
    stain_tipi: data.stain_tipi || data.stain_snapshot?.tipi || ['rework', 'scarto', 'non_classificato'],
    definizione: data.definizione || { che_cosa: data.problema || '', dove: data.dove || data.perimetro || '', quando: data.quando || '', chi: data.coinvolti || '', quale: '', come: data.manifestazione || '' },
    manuale_da: data.manuale_da || '',
    manuale_a: data.manuale_a || '',
    unita_manuale: data.unita_manuale || (data.origine === 'manuale' ? data.unita_misura : 'kg') || 'kg',
    priorita_manuali: data.priorita_manuali || (data.origine === 'manuale' ? data.priorita : []) || [],
    priorita_stain: data.priorita_stain || (data.origine === 'stain' ? data.priorita : []) || [],
    baseline_fonte: data.baseline_fonte || data.origine || 'stain',

    origine: data.origine || 'manuale',
    stain_linea: data.stain_linea || '',
    stain_snapshot: data.stain_snapshot || null,
    stain_prodotti: Array.isArray(data.stain_prodotti) ? data.stain_prodotti : [],
    raggruppamento: data.raggruppamento || 'prodotto',
    problema: data.problema || major?.descrizione || '',
    dove: data.dove || data.perimetro || '',
    quando: data.quando || '',
    coinvolti: data.coinvolti || '',
    manifestazione: data.manifestazione || '',
    impatto: data.impatto || '',
    fonte_dati: data.fonte_dati || '',
    periodo_da: data.periodo_da || '',
    periodo_a: data.periodo_a || '',
    unita_misura: data.unita_misura || 'kg',
    frequenza_rilevazione: data.frequenza_rilevazione || '',
    responsabile_misura: data.responsabile_misura || '',
    categorie_scarto: (data.categorie_scarto || []).map(row => ({ ...blank(), ...row, prodotto: row.prodotto || row.categoria || '', formato: row.formato || '', tipo: row.tipo === 'Rilavorazione' ? 'Rework' : row.tipo || 'Scarto', id: row.id || uid() })),
    priorita: data.priorita || (data.categoria_prioritaria ? [data.categoria_prioritaria] : []),
    metrica: data.metrica || (data.unita_misura === '%' ? 'percentuale' : 'quantita'),
    perimetro_kpi: data.perimetro_kpi || 'totale',
    stain_kpi: data.stain_kpi || 'kg',
    target: data.target ?? '',
    riduzione_pct: data.riduzione_pct ?? '',
    obiettivi: objectiveRows(data),
    scadenza: data.scadenza || major?.data_target || '',
  }
}

export default function ScrapBaseline({ stepData, onChange, major }) {
  const [form, setForm] = useState(() => initial(stepData?.dati || {}, major))
  const [status, setStatus] = useState('')
  const [saving, setSaving] = useState(false)
  const [pending, setPending] = useState(null)
  const [errors, setErrors] = useState([])
  const [stainLines, setStainLines] = useState([])
  const [stainBusy, setStainBusy] = useState(false)
  const [stainError, setStainError] = useState('')
  const file = useRef(null)
  const revision = useRef(0)
  const dirty = useRef(false)
  const printArea = useRef(null)

  useEffect(() => {
    if (!dirty.current && !saving) setForm(initial(stepData?.dati || {}, major))
  }, [stepData?.dati])

  useEffect(() => {
    const guard = event => { if (dirty.current) { event.preventDefault(); event.returnValue = '' } }
    window.addEventListener('beforeunload', guard)
    return () => window.removeEventListener('beforeunload', guard)
  }, [])

  const change = update => {
    dirty.current = true
    revision.current += 1
    setStatus('Modifiche da salvare')
    setForm(current => typeof update === 'function' ? update(current) : { ...current, ...update })
  }
  const updateRow = (id, key, value) => change(current => ({ ...current, categorie_scarto: current.categorie_scarto.map(row => row.id === id ? { ...row, [key]: value } : row) }))

  useEffect(() => {
    let cancelled = false
    api.get('/stain/linee').then(res => {
      if (!cancelled) { setStainLines(res.data || []); setStainError('') }
    }).catch(error => { if (!cancelled) setStainError(error.response?.data?.detail || 'Impossibile caricare le linee STAIN') })
    return () => { cancelled = true }
  }, [])

  const loadStain = async () => {
    if (!form.stain_tipi.length) { setStainError('Seleziona almeno un tipo di perdita'); return }
    if (!form.periodo_da || !form.periodo_a || !form.stain_linea) { setStainError('Seleziona periodo e linea STAIN'); return }
    if (form.periodo_da > form.periodo_a) { setStainError('Periodo non valido'); return }
    setStainBusy(true)
    setStainError('')
    try {
      const res = await api.get('/stain/scarti', { params: { dal: form.periodo_da, al: form.periodo_a, linea: form.stain_linea, tipi: [...form.stain_tipi].sort().join(',') }, timeout: 180000 })
      change({ stain_snapshot: res.data, priorita_stain: [], stain_prodotti: [] })
    } catch (error) { setStainError(error.response?.data?.detail || (error.code === 'ECONNABORTED' ? 'Tempo scaduto: riduci il periodo e riprova' : 'Caricamento STAIN non riuscito')) }
    finally { setStainBusy(false) }
  }
  const staleStain = form.stain_snapshot && (form.stain_snapshot.dal !== form.periodo_da || form.stain_snapshot.al !== form.periodo_a || form.stain_snapshot.linea !== form.stain_linea || JSON.stringify([...(form.stain_snapshot.tipi || ['rework', 'scarto', 'non_classificato'])].sort()) !== JSON.stringify([...form.stain_tipi].sort()))

function calculate(form, staleStain) {
    if (form.origine === 'stain') {
      const snapshot = form.stain_snapshot
      const filtered = filterStainByProduct(snapshot, form.stain_prodotti)
      const production = filtered.production
      const pareto = filtered.pareto.map(row => ({ ...row, categoria: `${row.codice} - ${row.causale}`, quantita: row.kg, quantita_calcolata: row.kg, perc_produzione: production ? row.kg / production * 100 : null }))
      const selected = pareto.filter(row => form.priorita.includes(row.categoria)).reduce((sum, row) => sum + row.quantita, 0)
      const issues = [...(snapshot?.warnings || [])]
      if (staleStain) issues.push('Periodo, linea o filtro modificati: clicca Carica da STAIN per aggiornare i risultati.')
      const numerator = form.perimetro_kpi === 'priorita' ? selected : filtered.total
      const blocked = !snapshot || issues.length || (form.perimetro_kpi === 'priorita' && !form.priorita.length)
      const baseline = blocked ? null : form.stain_kpi === 'percentuale' ? production ? numerator / production * 100 : null : numerator
      const productionByDay = new Map(filtered.andamento.map(row => [row.data, row.produzione]))
      const productSet = new Set(form.stain_prodotti)
      const byCategory = new Map()
      ;(snapshot?.dettaglio || []).forEach(row => {
        if (productSet.size && !productSet.has(row.prodotto)) return
        const key = `${row.codice} - ${row.causale}`
        const days = byCategory.get(key) || new Map()
        days.set(row.data, (days.get(row.data) || 0) + row.kg)
        byCategory.set(key, days)
      })
      const categoryTimelines = Object.fromEntries([...byCategory].map(([key, days]) => [key,
        [...new Set([...productionByDay.keys(), ...days.keys()])].sort().map(day => ({ periodo: day, totale: days.get(day) || 0, produzione: productionByDay.get(day) || 0 }))]))
      return { pareto, total: filtered.total, selected, numerator, categoryTimelines, timeline: filtered.andamento.map(row => ({ periodo: row.data, totale: row.kg, produzione: row.produzione })), baseline, issues, production, productionMachines: snapshot?.produzione_macchine || [], productionWarning: snapshot && !('produzione' in snapshot) ? 'Per calcolare la % sui kg prodotti ricarica i dati da STAIN.' : snapshot?.produzione_warning || null }
    }
    const groups = new Map()
    const periods = new Map()
    const categoryDays = new Map()
    const issues = []
    form.categorie_scarto.forEach((original, index) => {
      const row = { ...original, categoria: original[form.raggruppamento] || '', produzione: '' }
      if (!row.categoria.trim() && row.quantita === '') return
      if (!row.categoria.trim() || !valid(row.quantita)) { issues.push(`Riga ${index + 1}: indica scarto e quantità non negativa.`); return }
      const quantity = number(row.quantita)
      const category = `${row.categoria.trim()} · ${row.tipo === 'Rework' ? 'Rework' : 'Scarto'}`
      groups.set(category, (groups.get(category) || 0) + quantity)
      const period = row.periodo.trim()
      if (period) {
        const days = categoryDays.get(category) || new Map()
        days.set(period, (days.get(period) || 0) + quantity)
        categoryDays.set(category, days)
        const item = periods.get(period) || { periodo: period, totale: 0, selezionato: 0, produzione: null }
        item.totale += quantity
        if (form.priorita.includes(category)) item.selezionato += quantity
        if (row.produzione !== '') {
          if (!valid(row.produzione)) issues.push(`Riga ${index + 1}: produzione non valida.`)
          else if (item.produzione !== null && item.produzione !== number(row.produzione)) issues.push(`Periodo ${period}: produzioni diverse. Usa periodi distinti per lotti o turni differenti.`)
          else item.produzione = number(row.produzione)
        }
        periods.set(period, item)
      }
    })
    const total = [...groups.values()].reduce((a, b) => a + b, 0)
    let cumulative = 0
    const pareto = [...groups].sort((a, b) => b[1] - a[1]).map(([categoria, quantita]) => {
      cumulative += quantita
      return { categoria, quantita, quantita_calcolata: quantita, percentuale: total ? quantita / total * 100 : 0, cumulata: total ? cumulative / total * 100 : 0 }
    })
    const selected = pareto.filter(row => form.priorita.includes(row.categoria)).reduce((sum, row) => sum + row.quantita, 0)
    const timeline = [...periods.values()].sort((a, b) => a.periodo.localeCompare(b.periodo))
    const missingPeriods = form.categorie_scarto.some(row => valid(row.quantita) && row.categoria.trim() && !row.periodo.trim())
    const denominatorValid = timeline.length > 0 && !missingPeriods && timeline.every(row => row.produzione > 0 && row.totale <= row.produzione)
    const production = denominatorValid ? timeline.reduce((sum, row) => sum + row.produzione, 0) : null
    const numerator = form.perimetro_kpi === 'priorita' ? selected : total
    const baseline = form.unita_misura === '%' ? null : issues.length || (form.perimetro_kpi === 'priorita' && !form.priorita.length) ? null : form.metrica === 'percentuale' ? production ? numerator / production * 100 : null : pareto.length ? numerator : null
    const allPeriods = timeline.map(row => row.periodo)
    const categoryTimelines = Object.fromEntries([...categoryDays].map(([key, days]) => [key, allPeriods.map(periodo => ({ periodo, totale: days.get(periodo) || 0 }))]))
    return { pareto, total, selected, timeline, categoryTimelines, baseline, issues, production }
  }


  const stainAnalysis = useMemo(() => calculate({ ...form, origine: 'stain', priorita: form.priorita_stain }, staleStain), [form, staleStain])
  const manualAnalysis = useMemo(() => calculate({ ...form, origine: 'manuale', unita_misura: form.unita_manuale, priorita: form.priorita_manuali, metrica: 'quantita' }, false), [form])
  const analysis = form.baseline_fonte === 'stain' ? stainAnalysis : manualAnalysis
  const baselineUnit = form.baseline_fonte === 'stain' ? (form.stain_kpi === 'percentuale' ? '%' : 'kg') : form.unita_manuale
  const baselinePriorities = form.baseline_fonte === 'stain' ? form.priorita_stain : form.priorita_manuali
  const evaluatedObjectives = form.obiettivi.map(row => ({ ...row, ...evaluateObjective(row, form, stainAnalysis, manualAnalysis) }))
  const updateObjective = (id, patch) => change(current => ({ ...current, obiettivi: current.obiettivi.map(row => row.id === id ? { ...row, ...patch, target_precedente: '' } : row) }))

  const save = async () => {

    if (form.manuale_da && form.manuale_a && form.manuale_da > form.manuale_a) { setStatus('Periodo della raccolta manuale non valido'); return }
    if (form.periodo_da && form.periodo_a && form.periodo_da > form.periodo_a) { setStatus('Il periodo finale precede quello iniziale'); return }
    const currentRevision = revision.current
    setSaving(true)
    setStatus('Salvataggio...')
    try {
      const result = await onChange({ dati: { ...form, obiettivi: evaluatedObjectives, origine: form.baseline_fonte, unita_misura: baselineUnit, priorita: baselinePriorities, problema: form.definizione.che_cosa || '', dove: form.definizione.dove || '', baseline: analysis.baseline ?? '', perimetro: form.definizione.dove, quantita_totale: analysis.total, pareto: analysis.pareto, categoria_prioritaria: baselinePriorities[0] || '' }, output_compilati: { problema: !!form.definizione.che_cosa?.trim(), perimetro: !!form.definizione.dove?.trim(), fonte_dati: !!form.fonte_dati.trim(), periodo: !!(form.periodo_da && form.periodo_a), pareto: analysis.pareto.length > 0, categoria_prioritaria: baselinePriorities.length > 0, baseline: analysis.baseline !== null, target: evaluatedObjectives.length > 0 && evaluatedObjectives.every(row => row.target !== null && !row.errors.length) } })
      if (result === false) throw new Error('Salvataggio non riuscito')
      dirty.current = revision.current !== currentRevision
      setStatus(dirty.current ? 'Nuove modifiche da salvare' : 'Salvato')
    } catch (error) { setStatus('Errore di salvataggio. I dati restano nella pagina: riprova.') }
    finally { setSaving(false) }
  }

  const exportExcel = (template = false) => {
    const workbook = XLSX.utils.book_new()
    const rows = template ? [] : form.categorie_scarto.map(row => KEYS.map(key => row[key]))
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([HEADERS, ...rows]), 'Scarti')
    if (!template && form.stain_snapshot) XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(form.stain_snapshot.pareto), 'STAIN Pareto')
    XLSX.writeFile(workbook, template ? 'Modello_scarti.xlsx' : 'Dati_scarti.xlsx')
  }
  const importExcel = async event => {
    const selected = event.target.files?.[0]
    event.target.value = ''
    if (!selected) return
    if (selected.size > 10 * 1024 * 1024) { setErrors(['File troppo grande: massimo 10 MB']); return }
    try {
      const workbook = XLSX.read(await selected.arrayBuffer(), { type: 'array', cellDates: false })
      const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1, defval: '', raw: false })
      if (!HEADERS.every((header, index) => String(matrix[0]?.[index] || '').trim() === header)) throw new Error('Intestazioni diverse dal modello. Scarica il modello e mantieni le colonne.')
      if (matrix.length > 5001) throw new Error('Massimo 5000 righe per importazione')
      const rows = matrix.slice(1).filter(row => row.some(value => String(value).trim())).map(row => Object.fromEntries([['id', uid()], ...KEYS.map((key, index) => [key, String(row[index] ?? '').trim()])]))
      const problems = rows.flatMap((row, index) => !row.prodotto || !/^\d{4}-\d{2}-\d{2}$/.test(row.periodo) || !valid(row.quantita) || (form.unita_manuale === '%' && number(row.quantita) > 100) || !['Scarto', 'Rework'].includes(row.tipo) ? [`Riga ${index + 2}: controlla data (AAAA-MM-GG), prodotto, quantità e tipo (Scarto/Rework).`] : [])
      setErrors(problems)
      setPending(problems.length ? null : rows)
    } catch (error) { setPending(null); setErrors([error.message || 'File non leggibile']) }
  }
  const print = () => {
    const popup = window.open('', '_blank')
    if (!popup) { setStatus('Consenti le finestre popup per stampare'); return }
    const title = popup.document.createElement('h1')
    title.textContent = `${major?.titolo || 'Major Kaizen'} - Definire`
    popup.document.body.appendChild(title)
    const summary = popup.document.createElement('p')
    summary.textContent = `${form.definizione.che_cosa || ''}\nRaccolta manuale: ${form.manuale_da} / ${form.manuale_a}. Unità: ${form.unita_manuale}. Baseline (${form.baseline_fonte}): ${fmt(analysis.baseline)} ${baselineUnit}. Target: ${form.target}`
    popup.document.body.appendChild(summary)
    const table = popup.document.createElement('table')
    table.style.borderCollapse = 'collapse'
    ;[HEADERS, ...form.categorie_scarto.map(row => KEYS.map(key => row[key]))].forEach((values, index) => {
      const tr = popup.document.createElement('tr')
      values.forEach(value => { const cell = popup.document.createElement(index ? 'td' : 'th'); cell.textContent = String(value); cell.style.cssText = 'border:1px solid #aaa;padding:6px;font:12px sans-serif'; tr.appendChild(cell) })
      table.appendChild(tr)
    })
    popup.document.body.appendChild(table)
    popup.document.close()
    popup.focus()
    popup.print()
  }
  const field = (label, key, type = 'text') => <label className="block text-sm">{label}<input className={`${input} mt-1`} type={type} value={form[key]} onChange={event => change({ [key]: event.target.value })} /></label>
  const round = value => Math.round(value * 100) / 100
  const targetReduction = analysis.baseline > 0 && valid(form.target) ? (analysis.baseline - number(form.target)) / analysis.baseline * 100 : null
  const setReduction = value => {
    if (value === '' || !(analysis.baseline > 0) || !valid(value)) { change({ riduzione_pct: '', target: '' }); return }
    const pct = Math.min(100, Math.max(0, number(value)))
    change({ riduzione_pct: String(pct), target: String(Number((analysis.baseline * (1 - pct / 100)).toFixed(6))) })
  }
  const reductionAmount = analysis.baseline > 0 && valid(form.target) ? analysis.baseline - number(form.target) : null
  const reductionKg = form.baseline_fonte === 'stain' && form.stain_kpi === 'percentuale' && reductionAmount !== null && analysis.production ? reductionAmount / 100 * analysis.production : null

  return (
    <div ref={printArea} className="space-y-7">
      <ProblemDefinition value={form.definizione} onChange={value => change({ definizione: value })} guides={SCRAP_GUIDES} />
      <section className="bg-white border border-gray-300 rounded-lg p-4 md:p-5">
        <h3 className="bg-primary text-white text-center py-2 rounded-lg font-bold mb-4">PASSO 2 - ANALISI DEI DATI STAIN</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          {field('Periodo da', 'periodo_da', 'date')}{field('Periodo a', 'periodo_a', 'date')}
          <label className="text-sm">Linea STAIN<select className={`${input} mt-1`} value={form.stain_linea} onChange={event => change({ stain_linea: event.target.value })}><option value="">Seleziona linea macchina</option>{stainLines.map(row => <option key={`${row.reparto}-${row.valore}`} value={row.valore}>{row.nome} / {row.reparto}</option>)}</select></label>
        </div>
          <fieldset className="flex flex-wrap items-center gap-x-5 gap-y-2 mb-3" disabled={stainBusy}>
            <legend className="text-sm font-medium mb-2">Tipo di perdita</legend>
            {[['rework', 'Rework · Sacco blu e lilla'], ['scarto', 'Scarto · Sacco verde'], ['non_classificato', 'Altre causali']].map(([value, label]) => <label key={value} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.stain_tipi.includes(value)} onChange={event => change({ stain_tipi: event.target.checked ? [...form.stain_tipi, value] : form.stain_tipi.filter(item => item !== value) })} />{label}</label>)}
          </fieldset>
        <button type="button" className={button} disabled={stainBusy} onClick={loadStain}>{stainBusy ? 'Caricamento...' : 'Carica da STAIN'}</button>
        {stainError && <p role="alert" className="mt-2 text-sm text-red-700">{stainError}</p>}
        {form.stain_snapshot && <p className="mt-3 text-sm text-gray-600">{form.stain_snapshot.linea.trim()} · {form.stain_snapshot.dal} / {form.stain_snapshot.al} · {fmt(form.stain_snapshot.totale_kg)} kg · Caricato {new Date(form.stain_snapshot.caricato_il).toLocaleString('it-IT')}</p>}
        {form.stain_snapshot && (form.stain_snapshot.dettaglio ? (
          <fieldset className="mt-4 border-t border-gray-200 pt-3">
            <legend className="text-sm font-medium">Prodotto</legend>
            <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2 max-h-40 overflow-y-auto">
              <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={!form.stain_prodotti.length} onChange={() => change({ stain_prodotti: [], priorita_stain: [] })} />Tutti i prodotti</label>
              {stainProducts(form.stain_snapshot).map(item => <label key={item.nome} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.stain_prodotti.includes(item.nome)} onChange={event => change({ stain_prodotti: event.target.checked ? [...form.stain_prodotti, item.nome] : form.stain_prodotti.filter(value => value !== item.nome), priorita_stain: [] })} />{item.nome} <span className="text-gray-500">({fmt(item.kg)} kg)</span></label>)}
            </div>
          </fieldset>
        ) : <p className="mt-3 text-sm text-gray-500">Per filtrare per prodotto ricarica i dati da STAIN.</p>)}
        <AnalysisPanel analysis={stainAnalysis} unit="kg" priorities={form.priorita_stain} onPriorities={value => change({ priorita_stain: value })} />
      </section>
      <section className="bg-white border-2 border-primary rounded-lg p-4 md:p-5">
        <h3 className="bg-primary text-white text-center py-2 rounded-lg font-bold mb-4">PASSO 3 - RACCOLTA MANUALE</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          {field('Periodo raccolta da', 'manuale_da', 'date')}{field('Periodo raccolta a', 'manuale_a', 'date')}
          <label className="text-sm">Unità raccolta manuale<select className={`${input} mt-1`} value={form.unita_manuale} onChange={event => change({ unita_manuale: event.target.value })}><option value="kg">kg</option><option value="pezzi">pezzi</option><option value="%">%</option></select></label>
        </div>

        <div className="flex flex-wrap gap-2 mb-3">
          <button type="button" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" onClick={() => change(current => ({ ...current, categorie_scarto: [...current.categorie_scarto, blank()] }))}>Aggiungi riga</button>
          <button type="button" className={button} onClick={() => file.current?.click()}>Importa Excel</button>
          <a className="inline-flex items-center rounded-lg border-2 border-primary bg-white px-4 py-2 text-sm font-semibold text-primary hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" href="/modelli/Raccolta_manuale_A4.xlsx" download="Raccolta_manuale_A4.xlsx">Scheda da stampare</a>
          <input ref={file} type="file" accept=".xlsx,.xls,.csv" onChange={importExcel} className="hidden" />
        </div>
        {errors.length > 0 && <div role="alert" className="text-sm text-red-700 mb-3">{errors.slice(0, 20).map((error, index) => <p key={index}>{error}</p>)}{errors.length > 20 && <p>Altri {errors.length - 20} errori. Nessuna riga importata.</p>}</div>}
        {pending && <div className="border p-3 mb-3 text-sm"><p>{pending.length} righe valide. Prime righe: {pending.slice(0, 3).map(row => `${row.prodotto}: ${row.quantita}`).join('; ')}</p><div className="flex gap-2 mt-2"><button type="button" className={button} onClick={() => { change(current => ({ ...current, categorie_scarto: [...current.categorie_scarto, ...pending] })); setPending(null) }}>Aggiungi ai dati</button><button type="button" className={button} onClick={() => { if (confirm('Sostituire tutte le righe attuali?')) { change({ categorie_scarto: pending }); setPending(null) } }}>Sostituisci dati</button><button type="button" className={button} onClick={() => setPending(null)}>Annulla</button></div></div>}
        <div className="overflow-x-auto"><table className="w-full text-sm min-w-[1100px]"><thead><tr>{HEADERS.map(header => <th key={header} className="text-left p-2 border-b font-medium">{header === 'Quantità' ? `Quantità (${form.unita_manuale})` : header}</th>)}<th className="p-2 border-b">Azioni</th></tr></thead><tbody>{form.categorie_scarto.map(row => <tr key={row.id}>{KEYS.map(key => <td key={key} className="p-1 border-b">{key === 'tipo' ? <select className={input} value={row.tipo} onChange={event => updateRow(row.id, key, event.target.value)}><option>Scarto</option><option>Rework</option></select> : <input aria-label={HEADERS[KEYS.indexOf(key)]} className={input} value={row[key]} type={key === 'periodo' ? 'date' : key === 'quantita' ? 'number' : 'text'} min="0" step="any" onChange={event => updateRow(row.id, key, event.target.value)} />}</td>)}<td className="p-2"><button type="button" className="text-red-700 text-xs" onClick={() => change(current => ({ ...current, categorie_scarto: current.categorie_scarto.filter(item => item.id !== row.id) }))}>Elimina</button></td></tr>)}</tbody></table></div>
        <label className="block text-sm mt-4">Raggruppa raccolta manuale per<select className={`${input} mt-1 max-w-sm`} value={form.raggruppamento} onChange={event => change({ raggruppamento: event.target.value, priorita_manuali: [] })}><option value="prodotto">Prodotto</option><option value="formato">Formato</option><option value="operazione">Operazione / fase macchina</option></select></label>
        <AnalysisPanel analysis={manualAnalysis} unit={form.unita_manuale} priorities={form.priorita_manuali} onPriorities={value => change({ priorita_manuali: value })} />
      </section>
      <section>
        <h3 className="bg-primary text-white text-center py-2 rounded-lg font-bold mb-4">PASSO 4 - PRIORITÀ E OBIETTIVO</h3>
        <div className="flex flex-wrap justify-between items-center gap-3 mb-3">
          <p className="text-sm text-gray-600">Un obiettivo per ogni perdita, con fonte e riduzione indipendenti. I perimetri sovrapposti non vengono sommati.</p>
          <button type="button" className="bg-primary text-white rounded-lg px-4 py-2 font-semibold text-sm" onClick={() => change(current => ({ ...current, obiettivi: [...current.obiettivi, { id: uid(), fonte: 'stain', kpi: 'kg', perimetro: 'totale', riduzione: '', target_precedente: '' }] }))}>+ Obiettivo</button>
        </div>
        <div className="space-y-4">{form.obiettivi.map((row, index) => {
          const result = evaluatedObjectives[index]
          const priorities = row.fonte === 'manuale' ? form.priorita_manuali : form.priorita_stain
          const options = ['totale', 'priorita', ...priorities]
          return <article key={row.id} className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
            <div className="flex justify-between items-center"><h4 className="font-bold text-primary">Obiettivo {index + 1}</h4>{form.obiettivi.length > 1 && <button type="button" className="text-sm border rounded px-3 py-1.5" onClick={() => { if (window.confirm('Rimuovere questo obiettivo?')) change(current => ({ ...current, obiettivi: current.obiettivi.filter(item => item.id !== row.id) })) }}>Rimuovi</button>}</div>
            <div className="grid md:grid-cols-3 gap-3">
              <label className="text-sm">Fonte baseline<select className={`${input} mt-1`} value={row.fonte} onChange={event => updateObjective(row.id, { fonte: event.target.value, perimetro: 'totale', riduzione: '' })}><option value="stain">STAIN</option><option value="manuale">Raccolta manuale</option></select></label>
              <label className="text-sm">KPI{row.fonte === 'stain' ? <select className={`${input} mt-1`} value={row.kpi} onChange={event => updateObjective(row.id, { kpi: event.target.value, riduzione: '' })}><option value="kg">kg di perdita</option><option value="percentuale" disabled={!stainAnalysis.production}>% sui kg prodotti</option></select> : <output className={`${input} mt-1 block bg-gray-50`}>{form.unita_manuale} · raccolta manuale</output>}</label>
              <label className="text-sm">Perimetro<select className={`${input} mt-1`} value={row.perimetro} onChange={event => updateObjective(row.id, { perimetro: event.target.value, riduzione: '' })}><option value="totale">Tutte le perdite della fonte</option><option value="priorita" disabled={!priorities.length}>Tutte le priorita selezionate</option>{!options.includes(row.perimetro) && <option value={row.perimetro}>{row.perimetro} (non piu selezionata)</option>}{priorities.map(category => <option key={category} value={category}>{category}</option>)}</select></label>
            </div>
            <label className="block text-sm font-bold text-primary">Di quanto vuoi ridurre questa perdita? (%)<input className={`${input} mt-2 max-w-xs text-lg font-bold border-primary`} type="number" min="0" max="100" step="any" value={row.riduzione !== '' && row.riduzione != null ? row.riduzione : result.reduction === null ? '' : Number(result.reduction.toFixed(2))} disabled={result.baseline === null} onChange={event => updateObjective(row.id, { riduzione: event.target.value })} /></label>
            {result.errors.map(error => <p key={error} role="alert" className="text-sm text-amber-800">{error}</p>)}
            <div className="grid md:grid-cols-3 gap-3">
              <div className="bg-gray-50 rounded-lg p-3"><p className="text-xs">Situazione attuale</p><strong>{result.baseline === null ? 'Dati da completare' : `${fmt(result.baseline)} ${result.unit}`}</strong></div>
              <div className="bg-emerald-50 rounded-lg p-3"><p className="text-xs">Obiettivo da raggiungere</p><strong>{result.target === null ? 'Inserisci la riduzione' : `${fmt(result.target)} ${result.unit}`}</strong></div>
              <div className="bg-gray-50 rounded-lg p-3"><p className="text-xs">{result.unit === '%' ? 'Differenza in punti percentuali' : `Perdita da evitare (${result.unit})`}</p><strong>{result.avoided === null ? '—' : fmt(result.avoided)}</strong></div>
            </div>
            {result.target !== null && <p className="text-sm font-semibold">Da {fmt(result.baseline)} {result.unit} a {fmt(result.target)} {result.unit}: riduzione del {fmt(result.reduction)}%.</p>}
            {result.kg !== null && <p className="text-xs text-gray-600">{fmt(result.kg)} kg da evitare a parita di produzione del periodo baseline. Obiettivo, non saving gia realizzato.</p>}
          </article>
        })}</div>
        <p className="text-xs text-gray-500 mt-3">Le voci manuali usano la raccolta del Passo 2. Le voci STAIN usano linea, periodo e prodotti gia caricati. Salva fase per conservare tutti gli obiettivi. La Fase 5 mantiene il proprio confronto e non somma automaticamente questi target.</p>
      </section>
      <div className="flex flex-wrap justify-end items-center gap-3 border-t pt-4"><span role="status" className="text-sm">{status}</span><button type="button" className="bg-primary text-white px-4 py-2 rounded disabled:opacity-50" disabled={saving} onClick={save}>{saving ? 'Salvataggio...' : 'Salva fase'}</button></div>
    </div>
  )
}

function lossColor(row) {
  const label = String(row.causale || row.categoria || '').toUpperCase()
  if (label.endsWith(' · REWORK')) return '#2563eb'
  if (label.endsWith(' · SCARTO')) return '#16a34a'
  if (row.tipo === 'rework' || /SACCO\s+(BLU|LILLA)/.test(label)) return '#2563eb'
  if (row.tipo === 'scarto' || /SACCO\s+VERDE/.test(label)) return '#16a34a'
  return '#76513b'
}

function AnalysisPanel({ analysis, unit, priorities, onPriorities }) {
  const [focus, setFocus] = useState('')
  const focused = focus && analysis.categoryTimelines?.[focus] ? focus : ''
  const toggleFocus = categoria => setFocus(current => (current === categoria || !analysis.categoryTimelines?.[categoria] ? '' : categoria))
    const labelHeight = Math.max(170, Math.min(620, Math.max(0, ...analysis.pareto.map(row => String(row.categoria).length)) * 6 + 20))
    const chartHeight = 280 + labelHeight
    const chartMinWidth = Math.max(600, analysis.pareto.length * 70 + 130)
  const stainPct = 'productionWarning' in analysis
  return <div className="mt-4 space-y-3">
    {analysis.issues.length > 0 && <p role="alert" className="text-sm text-amber-800">{analysis.issues.join(' ')}</p>}
    {stainPct && analysis.production && <p className="text-sm text-gray-700">Scarto <strong>{fmt(analysis.total)} kg</strong> su <strong>{fmt(analysis.production)} kg</strong> prodotti · <strong>{fmt(analysis.total / analysis.production * 100)}%</strong>{analysis.productionMachines?.length > 1 && <span className="text-gray-500"> · produzione {analysis.productionMachines.join(' + ')}</span>}</p>}
    {stainPct && !analysis.production && analysis.productionWarning && <p className="text-sm text-gray-500">{analysis.productionWarning}</p>}
    {unit === '%' ? <p className="text-sm text-gray-600">Le percentuali restano singole rilevazioni: non vengono sommate. Per la baseline complessiva servono i denominatori di produzione.</p> : analysis.pareto.length ? <>
        <div className="overflow-x-auto"><div style={{ height: chartHeight, minWidth: chartMinWidth }}><ResponsiveContainer width="100%" height="100%"><ComposedChart data={analysis.pareto} margin={{ top: 10, right: 15, bottom: 15, left: 5 }}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="categoria" interval={0} height={labelHeight} tick={<VerticalCategoryTick />} /><YAxis yAxisId="quantity" /><Tooltip formatter={(value, name, item) => [item?.payload?.perc_produzione != null ? `${fmt(value)} ${unit} · ${fmt(item.payload.perc_produzione)}% sul prodotto` : `${fmt(value)} ${unit}`, 'Quantità']} /><Legend /><Bar yAxisId="quantity" dataKey="quantita" name={`Quantità (${unit})`} fill="#64748b" cursor="pointer" onClick={entry => toggleFocus(entry?.payload?.categoria ?? entry?.categoria)}>{analysis.pareto.map(row => <Cell key={row.categoria} fill={lossColor(row)} fillOpacity={focused && focused !== row.categoria ? 0.3 : 1} />)}</Bar></ComposedChart></ResponsiveContainer></div></div>
      <p className="text-xs text-gray-500">Clicca una colonna per vederne l'andamento qui sotto.</p>
      <TrendChart timeline={focused ? analysis.categoryTimelines[focused] : analysis.timeline} unit={unit} withProduction={Boolean(analysis.production)} focus={focused} onClearFocus={() => setFocus('')} />
      <p className="rounded-lg border-l-4 border-primary bg-amber-50 px-4 py-3 text-base font-bold text-primary">Seleziona solamente le priorità che vuoi attaccare</p>
      <div className="flex flex-wrap gap-x-5 gap-y-2">{analysis.pareto.map(row => <label key={row.categoria} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={priorities.includes(row.categoria)} onChange={event => onPriorities(event.target.checked ? [...priorities, row.categoria] : priorities.filter(value => value !== row.categoria))} />{row.categoria}</label>)}</div>
    </> : <p className="text-sm text-gray-500">Nessun dato disponibile per il Pareto.</p>}
    {unit !== '%' && !analysis.pareto.length && <TrendChart timeline={focused ? analysis.categoryTimelines[focused] : analysis.timeline} unit={unit} withProduction={Boolean(analysis.production)} focus={focused} onClearFocus={() => setFocus('')} />}
  </div>
}

const GROUPINGS = [['giorno', 'Giorno'], ['settimana', 'Settimana'], ['mese', 'Mese']]

function periodKey(value, grouping) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || grouping === 'giorno') return value
  if (grouping === 'mese') return value.slice(0, 7)
  const date = new Date(`${value}T00:00:00Z`)
  const day = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((date - yearStart) / 86400000 + 1) / 7)
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

function periodLabel(key) {
  const week = key.match(/^(\d{4})-W(\d{2})$/)
  if (week) return `Sett. ${Number(week[2])} ${week[1]}`
  const month = key.match(/^(\d{4})-(\d{2})$/)
  if (month) return new Date(Number(month[1]), Number(month[2]) - 1, 1).toLocaleDateString('it-IT', { month: 'short', year: 'numeric' })
  const day = key.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (day) return `${day[3]}/${day[2]}`
  return key
}

function groupTimeline(timeline, grouping) {
  const totals = new Map()
  timeline.forEach(row => {
    const key = periodKey(row.periodo, grouping)
    const item = totals.get(key) || { totale: 0, produzione: 0 }
    item.totale += row.totale
    item.produzione += row.produzione || 0
    totals.set(key, item)
  })
  return [...totals].sort((a, b) => a[0].localeCompare(b[0])).map(([key, item]) => ({
    periodo: periodLabel(key),
    totale: item.totale,
    percentuale: item.produzione > 0 ? item.totale / item.produzione * 100 : null,
  }))
}

function TrendChart({ timeline, unit, withProduction = false, focus = '', onClearFocus }) {
  const [grouping, setGrouping] = useState('giorno')
  const [measure, setMeasure] = useState('kg')
  const showPercent = withProduction && measure === 'pct'
  const dataKey = showPercent ? 'percentuale' : 'totale'
  const valueUnit = showPercent ? '%' : unit
  const data = useMemo(() => groupTimeline(timeline, grouping), [timeline, grouping])
  if (!timeline.length) return null
  return <div className="border border-gray-200 rounded-lg p-3">
    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
      <div className="flex items-center gap-2 min-w-0">
        <h4 className="text-sm font-semibold text-gray-700 truncate">Andamento{focus ? ` · ${focus}` : ' · totale'}</h4>
        {focus && <button type="button" onClick={onClearFocus} className="shrink-0 rounded border border-gray-300 px-2 py-0.5 text-xs hover:bg-gray-50">Mostra totale</button>}
      </div>
      <div className="flex flex-wrap gap-2">
      {withProduction && <div role="group" aria-label="Misura andamento" className="flex bg-gray-100 rounded-lg p-1 gap-1">
        {[['kg', unit], ['pct', '% sul prodotto']].map(([value, label]) => <button key={value} type="button" aria-pressed={measure === value} onClick={() => setMeasure(value)} className={`px-3 py-1 text-xs rounded-md ${measure === value ? 'bg-white text-primary shadow-sm font-semibold' : 'text-gray-600 hover:bg-gray-200'}`}>{label}</button>)}
      </div>}
      <div role="group" aria-label="Raggruppa andamento" className="flex bg-gray-100 rounded-lg p-1 gap-1">
        {GROUPINGS.map(([value, label]) => <button key={value} type="button" aria-pressed={grouping === value} onClick={() => setGrouping(value)} className={`px-3 py-1 text-xs rounded-md ${grouping === value ? 'bg-white text-primary shadow-sm font-semibold' : 'text-gray-600 hover:bg-gray-200'}`}>{label}</button>)}
      </div>
      </div>
    </div>
    <div className="h-40"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={data} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="periodo" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} width={45} /><Tooltip formatter={value => [`${fmt(value)} ${valueUnit}`, showPercent ? 'Scarto sul prodotto' : 'Quantità']} />{data.length > 1 ? <Line dataKey={dataKey} name={`${showPercent ? 'Scarto' : 'Quantità'} (${valueUnit})`} stroke="#76513b" strokeWidth={2} dot={{ r: 3 }} connectNulls /> : <Bar dataKey={dataKey} name={`${showPercent ? 'Scarto' : 'Quantità'} (${valueUnit})`} fill="#76513b" barSize={40} />}</ComposedChart></ResponsiveContainer></div>
  </div>
}

function VerticalCategoryTick({ x, y, payload }) {
  return <g transform={`translate(${x},${y})`}><text transform="rotate(-90)" x={-10} y={0} textAnchor="end" dominantBaseline="central" fontSize={11} fill="#4b5563">{payload?.value}</text></g>
}
