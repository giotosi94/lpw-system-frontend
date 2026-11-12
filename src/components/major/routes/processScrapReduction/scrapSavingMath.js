export function numeric(value) {
  if (value === '' || value == null) return null
  const result = Number(String(value).replace(',', '.'))
  return Number.isFinite(result) && result >= 0 ? result : null
}

export function calculateSaving(rows, costs, annualProduction) {
  const issues = []
  if (!rows.length) issues.push('Inserisci almeno una riga di confronto.')
  const keys = new Set()
  const result = rows.map((row, index) => {
    const values = ['beforeProduction', 'beforeLoss', 'afterProduction', 'afterLoss', 'driver'].map(key => numeric(row[key]))
    const [bp, bl, ap, al, driver] = values
    const key = `${row.product.trim()}|${row.type}`
    if (!row.product.trim() || !['scarto', 'rework'].includes(row.type)) issues.push(`Riga ${index + 1}: prodotto e tipo obbligatori.`)
    if (keys.has(key)) issues.push(`Riga ${index + 1}: prodotto e tipo duplicati.`)
    keys.add(key)
    if (values.some(value => value === null) || !(bp > 0) || !(ap > 0) || bl > bp || al > ap) {
      issues.push(`Riga ${index + 1}: quantità non valide; produzione positiva e perdita non superiore alla produzione.`)
      return { ...row, valid: false }
    }
    if (!row.driverYear || !/^\d{4}$/.test(String(row.driverYear)) || !row.driverRef?.trim()) issues.push(`Riga ${index + 1}: indica anno e riferimento del driver.`)
    const expected = ap * bl / bp
    const avoided = expected - al
    return { ...row, valid: true, beforeRate: bl / bp, afterRate: al / ap, expected, avoided, gross: avoided * driver }
  })
  const investment = numeric(costs)
  if (investment === null) issues.push('Indica i costi di implementazione, anche zero.')
  const gross = result.reduce((sum, row) => sum + (row.gross || 0), 0)
  const avoided = result.reduce((sum, row) => sum + (row.avoided || 0), 0)
  const production = new Map()
  rows.forEach(row => {
    const value = numeric(row.afterProduction)
    if (production.has(row.product) && production.get(row.product) !== value) issues.push(`Produzione dopo incoerente per ${row.product}.`)
    production.set(row.product, value)
  })
  const totalProduction = [...production.values()].reduce((sum, value) => sum + (value || 0), 0)
  const annual = numeric(annualProduction)
  return { rows: result, issues: [...new Set(issues)], gross, avoided, net: gross - (investment || 0), annualGross: annual !== null && totalProduction > 0 ? gross / totalProduction * annual : null }
}

export function baselineScope(data) {
  if ((data.baseline_fonte || data.origine) !== 'stain') throw new Error('Baseline manuale: usa il confronto manuale in kg e documenta la fonte.')
  const snapshot = data.stain_snapshot
  if (!snapshot || !Array.isArray(snapshot.dettaglio) || !Array.isArray(snapshot.produzione)) throw new Error('Ricarica e salva la baseline STAIN nella Fase 1: servono dettaglio e produzione.')
  const types = [...(data.stain_tipi || snapshot.tipi || [])].sort()
  if (snapshot.linea !== data.stain_linea || snapshot.dal !== data.periodo_da || snapshot.al !== data.periodo_a || JSON.stringify([...(snapshot.tipi || [])].sort()) !== JSON.stringify(types)) throw new Error('Baseline STAIN non aggiornata: ricarica e salva la Fase 1.')
  const selectedPriorities = data.priorita_stain || data.priorita || []
  const priorities = data.perimetro_kpi === 'priorita' || selectedPriorities.length ? selectedPriorities : []
  if (data.perimetro_kpi === 'priorita' && !priorities.length) throw new Error('Seleziona le categorie prioritarie nella Fase 1.')
  return { line: snapshot.linea, from: snapshot.dal, to: snapshot.al, products: [...(data.stain_prodotti || [])], types, priorities, captured: new Date().toISOString() }
}

export function aggregateSnapshot(snapshot, scope) {
  if (snapshot.warnings?.length || snapshot.produzione_warning) throw new Error([...(snapshot.warnings || []), snapshot.produzione_warning].filter(Boolean).join(' '))
  if (!Array.isArray(snapshot.dettaglio) || !Array.isArray(snapshot.produzione) || !snapshot.produzione.length) throw new Error('Dettaglio o produzione STAIN mancanti.')
  const selected = new Set(scope.products)
  const production = new Map()
  const losses = new Map()
  const allowed = product => !selected.size || selected.has(product)
  snapshot.produzione.forEach(row => {
    if (!allowed(row.prodotto)) return
    const kg = numeric(row.kg)
    if (kg === null) throw new Error('Produzione STAIN non valida.')
    production.set(row.prodotto, (production.get(row.prodotto) || 0) + kg)
  })
  snapshot.dettaglio.forEach(row => {
    if (!allowed(row.prodotto) || !scope.types.includes(row.tipo)) return
    if (scope.priorities.length && !scope.priorities.includes(`${row.codice} - ${row.causale}`)) return
    if (!['scarto', 'rework'].includes(row.tipo)) throw new Error('Perdita non classificata: definisci un perimetro con sole causali scarto/rework prima della valorizzazione.')
    const kg = numeric(row.kg)
    if (kg === null) throw new Error('Perdita STAIN non valida.')
    const key = JSON.stringify([row.prodotto, row.tipo])
    losses.set(key, (losses.get(key) || 0) + kg)
  })
  return { production, losses }
}

export function incomparableProducts(before, after, scope) {
  const b = aggregateSnapshot(before, scope)
  const a = aggregateSnapshot(after, scope)
  const products = new Map()
  const add = (side, losses) => losses.forEach((kg, key) => {
    const [product] = JSON.parse(key)
    const row = products.get(product) || { product, beforeLoss: 0, afterLoss: 0 }
    row[side] += kg
    products.set(product, row)
  })
  add('beforeLoss', b.losses)
  add('afterLoss', a.losses)
  return [...products.values()]
    .filter(row => !(b.production.get(row.product) > 0) || !(a.production.get(row.product) > 0))
    .map(row => ({ ...row, missing: !(b.production.get(row.product) > 0) && !(a.production.get(row.product) > 0) ? 'entrambi i periodi' : !(b.production.get(row.product) > 0) ? 'periodo prima' : 'periodo dopo' }))
    .sort((x, y) => x.product.localeCompare(y.product))
}

export function compareSnapshots(before, after, scope, previous = []) {
  const b = aggregateSnapshot(before, scope)
  const a = aggregateSnapshot(after, scope)
  const keys = new Set([...b.losses.keys(), ...a.losses.keys()])
  const rows = [...keys].sort().filter(key => {
    const [product] = JSON.parse(key)
    return b.production.get(product) > 0 && a.production.get(product) > 0
  }).map(key => {
    const [product, type] = JSON.parse(key)
    const old = previous.find(row => row.product === product && row.type === type)
    return { id: key, product, type, beforeProduction: b.production.get(product), beforeLoss: b.losses.get(key) || 0, afterProduction: a.production.get(product), afterLoss: a.losses.get(key) || 0, driver: old?.driver ?? '', driverYear: old?.driverYear || '', driverRef: old?.driverRef || '' }
  })
  if (!rows.length) throw new Error('Nessun prodotto con produzione in entrambi i periodi e perdite nel perimetro selezionato.')
  return rows
}

function objectiveText(value) {
  return String(value ?? '').trim()
}

function objectiveList(value) {
  return [...new Set(
    (Array.isArray(value) ? value : [])
      .map(objectiveText)
      .filter(Boolean)
  )].sort()
}

export function objectiveLabel(row, index = 0) {
  const source = row.fonte === 'manuale' ? 'Manuale' : 'STAIN'
  const product = row.prodotto || 'Tutti i prodotti'
  const perimeter = row.perimetro === 'priorita'
    ? 'Priorità selezionate'
    : row.perimetro || 'Perimetro da definire'

  return `Obiettivo ${index + 1} · ${source} · ${product} · ${perimeter}`
}

export function objectiveContext(data, objective) {
  if (!objective?.id) {
    throw new Error('Seleziona un obiettivo della Fase 1.')
  }

  if (objective.errors?.length) {
    throw new Error(objective.errors.join(' '))
  }

  const source = objective.fonte

  if (!['stain', 'manuale'].includes(source)) {
    throw new Error('Fonte obiettivo non valida.')
  }

  const priorities = objectiveList(
    source === 'manuale'
      ? data.priorita_manuali
      : data.priorita_stain
  )

  const categories = objective.perimetro === 'priorita'
    ? priorities
    : objectiveList([objective.perimetro])

  if (
    !categories.length ||
    categories.includes('totale') ||
    categories.some(item => !priorities.includes(item))
  ) {
    throw new Error(
      'Aggiorna le priorità e salva l’obiettivo nella Fase 1.'
    )
  }

  const product = objectiveText(objective.prodotto)

  const meta = {
    id: objective.id,
    source,
    product,
    categories,
    baseline: objective.baseline,
    target: objective.target,
    unit: objective.unit,
  }

  const from = source === 'stain'
    ? data.periodo_da
    : data.manuale_da

  const to = source === 'stain'
    ? data.periodo_a
    : data.manuale_a

  if (!from || !to || from > to) {
    throw new Error(
      'Completa il periodo della fonte nella Fase 1.'
    )
  }

  let scope = null
  let rows = []
  let evidence

  if (source === 'stain') {
    scope = baselineScope({
      ...data,
      baseline_fonte: 'stain',
      origine: 'stain',
    })

    if (
      product &&
      scope.products.length &&
      !scope.products.includes(product)
    ) {
      throw new Error(
        'Prodotto fuori dal perimetro della Fase 1.'
      )
    }

    scope = {
      ...scope,
      products: product ? [product] : scope.products,
      priorities: categories,
    }

    const available = new Set(
      (data.stain_snapshot.dettaglio || [])
        .map(row => `${row.codice} - ${row.causale}`)
    )

    if (categories.some(item => !available.has(item))) {
      throw new Error(
        'Perdita non presente nello snapshot STAIN.'
      )
    }

    aggregateSnapshot(data.stain_snapshot, scope)
    evidence = data.stain_snapshot
  } else {
    const unit = objectiveText(
      data.unita_manuale || data.unita_misura
    ).toLowerCase()

    if (unit !== 'kg') {
      throw new Error(
        'Il saving richiede una raccolta manuale in kg. Pezzi e percentuali non vengono convertiti automaticamente.'
      )
    }

    const grouping = data.raggruppamento || 'prodotto'
    const groups = new Map()

    evidence = (data.categorie_scarto || []).filter(row => {
      const type = objectiveText(row.tipo).toLowerCase()

      const label = type === 'rework' || type === 'rilavorazione'
        ? 'Rework'
        : type === 'scarto'
          ? 'Scarto'
          : ''

      const category = `${objectiveText(row[grouping])} · ${label}`

      return (
        (!product || objectiveText(row.prodotto) === product) &&
        categories.includes(category)
      )
    })

    if (!evidence.length) {
      throw new Error(
        'Nessuna rilevazione manuale per questo obiettivo.'
      )
    }

    evidence.forEach(row => {
      const name = objectiveText(row.prodotto)
      const rawType = objectiveText(row.tipo).toLowerCase()
      const type = rawType === 'rilavorazione'
        ? 'rework'
        : rawType

      const kg = numeric(row.quantita)

      if (
        !name ||
        !['scarto', 'rework'].includes(type) ||
        kg === null
      ) {
        throw new Error(
          'Completa prodotto, tipo e kg nella raccolta manuale.'
        )
      }

      const key = JSON.stringify([name, type])

      const item = groups.get(key) || {
        id: key,
        product: name,
        type,
        beforeProduction: '',
        beforeLoss: 0,
        afterProduction: '',
        afterLoss: '',
        driver: '',
        driverYear: '',
        driverRef: '',
      }

      item.beforeLoss += kg
      groups.set(key, item)
    })

    rows = [...groups.values()]
      .sort((a, b) => a.id.localeCompare(b.id))
  }

  const fingerprint = JSON.stringify({
    meta,
    from,
    to,
    scope: scope
      ? { ...scope, captured: undefined }
      : null,
    evidence,
  })

  return {
    meta,
    fingerprint,
    scope,
    rows,
    from,
    to,
  }
}

export function objectivePatch(context) {
  const manual = context.meta.source === 'manuale'

  return {
    objectiveId: context.meta.id,
    objectiveSnapshot: context.meta,
    objectiveFingerprint: context.fingerprint,
    mode: manual ? 'manuale' : 'stain',
    scope: context.scope,
    rows: context.rows || [],
    manualBeforeFrom: manual ? context.from : '',
    manualBeforeTo: manual ? context.to : '',
    source: manual
      ? `Fase 1 · ${context.meta.product || 'Tutti i prodotti'} · ${(context.meta.categories || []).join(', ')}`
      : '',
    before: null,
    after: null,
    afterFrom: '',
    afterTo: '',
    excluded: [],
    trendData: null,
    trendRestoration: '',
    trendImprovement: '',
    trendRestorationRef: '',
    trendImprovementRef: '',
    driverSnapshot: null,
    result: null,
    reviewed: false,
    reviewedBy: '',
    reviewedAt: '',
  }
}
