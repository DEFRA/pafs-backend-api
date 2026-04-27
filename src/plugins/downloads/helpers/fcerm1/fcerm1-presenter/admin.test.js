import { describe, test, expect } from 'vitest'
import { FcermPresenter } from '../fcerm1-presenter.js'

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makePresenter(projectOverrides = {}, areaOverrides = {}) {
  return new FcermPresenter(
    { pafs_core_funding_values: [], ...projectOverrides },
    { psoName: 'PSO Durham', ...areaOverrides },
    []
  )
}

// ── projectStatus ─────────────────────────────────────────────────────────────

describe('projectStatus', () => {
  test('returns Title Case for a lower-case state', () => {
    const p = makePresenter({ _state: 'draft' })
    expect(p.projectStatus()).toBe('Draft')
  })

  test('returns Title Case for submitted', () => {
    const p = makePresenter({ _state: 'submitted' })
    expect(p.projectStatus()).toBe('Submitted')
  })

  test('returns Title Case for archived', () => {
    const p = makePresenter({ _state: 'archived' })
    expect(p.projectStatus()).toBe('Archived')
  })

  test('preserves subsequent characters as-is', () => {
    const p = makePresenter({ _state: 'in_progress' })
    expect(p.projectStatus()).toBe('In_progress')
  })

  test('returns null when state is null', () => {
    const p = makePresenter({ _state: null })
    expect(p.projectStatus()).toBeNull()
  })

  test('returns null when state is undefined', () => {
    const p = makePresenter({})
    expect(p.projectStatus()).toBeNull()
  })

  test('returns null when state is an empty string', () => {
    const p = makePresenter({ _state: '' })
    expect(p.projectStatus()).toBeNull()
  })

  test('returns Revise when project is legacy and not yet revised', () => {
    const p = makePresenter({
      _state: 'draft',
      is_legacy: true,
      is_revised: false
    })
    expect(p.projectStatus()).toBe('Revise')
  })

  test('returns Revise when is_revised is null (legacy project)', () => {
    const p = makePresenter({
      _state: 'draft',
      is_legacy: true,
      is_revised: null
    })
    expect(p.projectStatus()).toBe('Revise')
  })

  test('returns capitalized state when legacy project has already been revised', () => {
    const p = makePresenter({
      _state: 'draft',
      is_legacy: true,
      is_revised: true
    })
    expect(p.projectStatus()).toBe('Draft')
  })

  test('returns capitalized state when project is not legacy', () => {
    const p = makePresenter({
      _state: 'draft',
      is_legacy: false,
      is_revised: false
    })
    expect(p.projectStatus()).toBe('Draft')
  })
})

// ── carbonCostBuild ───────────────────────────────────────────────────────────

describe('carbonCostBuild', () => {
  test('returns numeric value', () => {
    const p = makePresenter({ carbon_cost_build: 42 })
    expect(p.carbonCostBuild()).toBe(42)
  })

  test('coerces string to number', () => {
    const p = makePresenter({ carbon_cost_build: '99.5' })
    expect(p.carbonCostBuild()).toBe(99.5)
  })

  test('returns null when field is absent', () => {
    const p = makePresenter({})
    expect(p.carbonCostBuild()).toBeNull()
  })

  test('returns null when field is null', () => {
    const p = makePresenter({ carbon_cost_build: null })
    expect(p.carbonCostBuild()).toBeNull()
  })

  test('returns 0 when field is 0', () => {
    const p = makePresenter({ carbon_cost_build: 0 })
    expect(p.carbonCostBuild()).toBe(0)
  })
})

// ── carbonCostOperation ───────────────────────────────────────────────────────

describe('carbonCostOperation', () => {
  test('returns numeric value', () => {
    const p = makePresenter({ carbon_cost_operation: 10 })
    expect(p.carbonCostOperation()).toBe(10)
  })

  test('returns null when field is absent', () => {
    const p = makePresenter({})
    expect(p.carbonCostOperation()).toBeNull()
  })

  test('returns null when field is null', () => {
    const p = makePresenter({ carbon_cost_operation: null })
    expect(p.carbonCostOperation()).toBeNull()
  })
})

// ── carbonCostSequestered ─────────────────────────────────────────────────────

describe('carbonCostSequestered', () => {
  test('returns numeric value', () => {
    const p = makePresenter({ carbon_cost_sequestered: 7 })
    expect(p.carbonCostSequestered()).toBe(7)
  })

  test('returns null when field is absent', () => {
    const p = makePresenter({})
    expect(p.carbonCostSequestered()).toBeNull()
  })

  test('returns null when field is null', () => {
    const p = makePresenter({ carbon_cost_sequestered: null })
    expect(p.carbonCostSequestered()).toBeNull()
  })
})

// ── carbonCostAvoided ─────────────────────────────────────────────────────────

describe('carbonCostAvoided', () => {
  test('returns numeric value', () => {
    const p = makePresenter({ carbon_cost_avoided: 5 })
    expect(p.carbonCostAvoided()).toBe(5)
  })

  test('returns null when field is absent', () => {
    const p = makePresenter({})
    expect(p.carbonCostAvoided()).toBeNull()
  })

  test('returns null when field is null', () => {
    const p = makePresenter({ carbon_cost_avoided: null })
    expect(p.carbonCostAvoided()).toBeNull()
  })
})

// ── carbonSavingsNetEconomicBenefit ───────────────────────────────────────────

describe('carbonSavingsNetEconomicBenefit', () => {
  test('returns numeric value', () => {
    const p = makePresenter({ carbon_savings_net_economic_benefit: 1234 })
    expect(p.carbonSavingsNetEconomicBenefit()).toBe(1234)
  })

  test('returns null when field is absent', () => {
    const p = makePresenter({})
    expect(p.carbonSavingsNetEconomicBenefit()).toBeNull()
  })

  test('returns null when field is null', () => {
    const p = makePresenter({ carbon_savings_net_economic_benefit: null })
    expect(p.carbonSavingsNetEconomicBenefit()).toBeNull()
  })
})

// ── carbonOperationalCostForecast ─────────────────────────────────────────────

describe('carbonOperationalCostForecast', () => {
  test('returns numeric value', () => {
    const p = makePresenter({ carbon_operational_cost_forecast: 88 })
    expect(p.carbonOperationalCostForecast()).toBe(88)
  })

  test('returns null when field is absent', () => {
    const p = makePresenter({})
    expect(p.carbonOperationalCostForecast()).toBeNull()
  })

  test('returns null when field is null', () => {
    const p = makePresenter({ carbon_operational_cost_forecast: null })
    expect(p.carbonOperationalCostForecast()).toBeNull()
  })
})

// ── lastUpdated ───────────────────────────────────────────────────────────────

describe('lastUpdated', () => {
  test('returns ISO string from a Date object', () => {
    const date = new Date('2024-06-15T10:00:00.000Z')
    const p = makePresenter({ updated_at: date })
    expect(p.lastUpdated()).toBe('2024-06-15T10:00:00.000Z')
  })

  test('returns null when updated_at is null', () => {
    const p = makePresenter({ updated_at: null })
    expect(p.lastUpdated()).toBeNull()
  })

  test('returns null when updated_at is undefined', () => {
    const p = makePresenter({})
    expect(p.lastUpdated()).toBeNull()
  })
})

// ── lastUpdatedBy ─────────────────────────────────────────────────────────────

describe('lastUpdatedBy', () => {
  test('returns the _updatedByName', () => {
    const p = makePresenter({ _updatedByName: 'Jane Smith' })
    expect(p.lastUpdatedBy()).toBe('Jane Smith')
  })

  test('returns null when _updatedByName is null', () => {
    const p = makePresenter({ _updatedByName: null })
    expect(p.lastUpdatedBy()).toBeNull()
  })

  test('returns null when _updatedByName is undefined', () => {
    const p = makePresenter({})
    expect(p.lastUpdatedBy()).toBeNull()
  })
})

// ── lastUpdatedByEmail ────────────────────────────────────────────────────────

describe('lastUpdatedByEmail', () => {
  test('returns the _updatedByEmail', () => {
    const p = makePresenter({ _updatedByEmail: 'jane.smith@example.gov.uk' })
    expect(p.lastUpdatedByEmail()).toBe('jane.smith@example.gov.uk')
  })

  test('returns null when _updatedByEmail is null', () => {
    const p = makePresenter({ _updatedByEmail: null })
    expect(p.lastUpdatedByEmail()).toBeNull()
  })

  test('returns null when _updatedByEmail is undefined', () => {
    const p = makePresenter({})
    expect(p.lastUpdatedByEmail()).toBeNull()
  })
})

// ── psoName ───────────────────────────────────────────────────────────────────

describe('psoName', () => {
  test('returns psoName from areaHierarchy', () => {
    const p = makePresenter({}, { psoName: 'PSO Yorkshire' })
    expect(p.psoName()).toBe('PSO Yorkshire')
  })

  test('returns null when psoName is null', () => {
    const p = makePresenter({}, { psoName: null })
    expect(p.psoName()).toBeNull()
  })

  test('returns null when psoName is undefined', () => {
    const p = makePresenter({}, { psoName: undefined })
    expect(p.psoName()).toBeNull()
  })

  test('returns null when areaHierarchy is empty', () => {
    const presenter = new FcermPresenter(
      { pafs_core_funding_values: [] },
      {},
      []
    )
    expect(presenter.psoName()).toBeNull()
  })
})
