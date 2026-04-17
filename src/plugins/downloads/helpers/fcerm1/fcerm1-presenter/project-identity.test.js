import { describe, test, expect } from 'vitest'
import { FcermPresenter } from '../fcerm1-presenter.js'

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeProject(overrides = {}) {
  return {
    reference_number: 'AC/2023/00001/000',
    name: 'Test Flood Project',
    region: 'Anglian',
    rma_name: 'East Anglia IDB',
    project_type: 'DEF',
    main_risk: 'fluvial_flooding',
    main_source_of_risk: 'fluvial_flooding',
    project_risks_protected_against: 'fluvial_flooding',
    pafs_core_funding_values: [],
    ...overrides
  }
}

function makeArea(overrides = {}) {
  return {
    rmaName: 'Test IDB',
    eaAreaName: 'Anglian',
    psoName: 'PSO Durham & Tees Valley',
    ...overrides
  }
}

// ── referenceNumber ───────────────────────────────────────────────────────────

describe('referenceNumber', () => {
  test('returns reference_number', () => {
    const p = new FcermPresenter(makeProject())
    expect(p.referenceNumber()).toBe('AC/2023/00001/000')
  })

  test('returns null when reference_number is null', () => {
    const p = new FcermPresenter(makeProject({ reference_number: null }))
    expect(p.referenceNumber()).toBeNull()
  })
})

// ── name ─────────────────────────────────────────────────────────────────────

describe('name', () => {
  test('returns project name', () => {
    const p = new FcermPresenter(makeProject())
    expect(p.name()).toBe('Test Flood Project')
  })

  test('returns null when name is null', () => {
    const p = new FcermPresenter(makeProject({ name: null }))
    expect(p.name()).toBeNull()
  })
})

// ── region ────────────────────────────────────────────────────────────────────

describe('region', () => {
  test('returns project region', () => {
    const p = new FcermPresenter(makeProject())
    expect(p.region()).toBe('Anglian')
  })

  test('returns null when region is null', () => {
    const p = new FcermPresenter(makeProject({ region: null }))
    expect(p.region()).toBeNull()
  })
})

// ── rfcc ──────────────────────────────────────────────────────────────────────

describe('rfcc', () => {
  test('maps first two chars of reference_number to RFCC name', () => {
    const p = new FcermPresenter(makeProject())
    expect(p.rfcc()).toBe('Anglian (Great Ouse)')
  })

  test('returns null when reference_number is null', () => {
    const p = new FcermPresenter(makeProject({ reference_number: null }))
    expect(p.rfcc()).toBeNull()
  })

  test('returns null for an unrecognised RFCC code', () => {
    const p = new FcermPresenter(
      makeProject({ reference_number: 'ZZ/2023/00001' })
    )
    expect(p.rfcc()).toBeNull()
  })
})

// ── eaArea ────────────────────────────────────────────────────────────────────

describe('eaArea', () => {
  test('returns eaAreaName from areaHierarchy', () => {
    const p = new FcermPresenter(makeProject(), makeArea())
    expect(p.eaArea()).toBe('Anglian')
  })

  test('returns null when areaHierarchy is empty', () => {
    const p = new FcermPresenter(makeProject(), {})
    expect(p.eaArea()).toBeNull()
  })
})

// ── rmaName ───────────────────────────────────────────────────────────────────

describe('rmaName', () => {
  test('prefers areaHierarchy.rmaName', () => {
    const p = new FcermPresenter(
      makeProject(),
      makeArea({ rmaName: 'Area RMA' })
    )
    expect(p.rmaName()).toBe('Area RMA')
  })

  test('falls back to project.rma_name when areaHierarchy.rmaName is absent', () => {
    const p = new FcermPresenter(
      makeProject(),
      makeArea({ rmaName: undefined })
    )
    expect(p.rmaName()).toBe('East Anglia IDB')
  })

  test('returns null when both areaHierarchy.rmaName and project.rma_name are null', () => {
    const p = new FcermPresenter(
      makeProject({ rma_name: null }),
      makeArea({ rmaName: null })
    )
    expect(p.rmaName()).toBeNull()
  })
})

// ── rmaType ───────────────────────────────────────────────────────────────────

describe('rmaType', () => {
  test('returns rmaSubType from areaHierarchy', () => {
    const p = new FcermPresenter(makeProject(), makeArea({ rmaSubType: 'IDB' }))
    expect(p.rmaType()).toBe('IDB')
  })

  test('returns null when rmaSubType is not set', () => {
    const p = new FcermPresenter(makeProject(), makeArea())
    expect(p.rmaType()).toBeNull()
  })
})

// ── coastalGroup ──────────────────────────────────────────────────────────────

describe('coastalGroup', () => {
  test('returns null when project has no coastal risk', () => {
    const p = new FcermPresenter(
      makeProject({
        main_risk: 'fluvial_flooding',
        project_risks_protected_against: 'fluvial_flooding'
      }),
      makeArea()
    )
    expect(p.coastalGroup()).toBeNull()
  })

  test('returns mapped coastal group when project has coastal_erosion risk', () => {
    const p = new FcermPresenter(
      makeProject({
        main_risk: 'coastal_erosion',
        project_risks_protected_against: 'coastal_erosion'
      }),
      makeArea({ psoName: 'PSO Durham & Tees Valley' })
    )
    expect(p.coastalGroup()).toBe('North East Coastal Group')
  })

  test('returns mapped coastal group when project has sea_flooding risk', () => {
    const p = new FcermPresenter(
      makeProject({
        main_risk: 'sea_flooding',
        project_risks_protected_against: 'sea_flooding'
      }),
      makeArea({ psoName: 'PSO East Kent' })
    )
    expect(p.coastalGroup()).toBe('South East Coastal Group')
  })

  test('returns mapped coastal group when project has tidal_flooding risk', () => {
    const p = new FcermPresenter(
      makeProject({
        main_risk: 'tidal_flooding',
        project_risks_protected_against: 'tidal_flooding'
      }),
      makeArea({ psoName: 'PSO Cumbria' })
    )
    expect(p.coastalGroup()).toBe('North West Coastal Group')
  })

  test('returns null when PSO has coastal risk but no mapping in PSO_TO_COASTAL_GROUP_MAP', () => {
    const p = new FcermPresenter(
      makeProject({
        main_risk: 'sea_flooding',
        project_risks_protected_against: 'sea_flooding'
      }),
      makeArea({ psoName: 'PSO Unknown Area' })
    )
    expect(p.coastalGroup()).toBeNull()
  })
})

// ── projectType ───────────────────────────────────────────────────────────────

describe('projectType', () => {
  test('returns type as-is for standard types', () => {
    const p = new FcermPresenter(makeProject({ project_type: 'DEF' }))
    expect(p.projectType()).toBe('DEF')
  })

  test('maps ENV_WITH_HOUSEHOLDS to ENV', () => {
    const p = new FcermPresenter(
      makeProject({ project_type: 'ENV_WITH_HOUSEHOLDS' })
    )
    expect(p.projectType()).toBe('ENV')
  })

  test('maps ENV_WITHOUT_HOUSEHOLDS to ENN', () => {
    const p = new FcermPresenter(
      makeProject({ project_type: 'ENV_WITHOUT_HOUSEHOLDS' })
    )
    expect(p.projectType()).toBe('ENN')
  })

  test('returns null when project_type is null', () => {
    const p = new FcermPresenter(makeProject({ project_type: null }))
    expect(p.projectType()).toBeNull()
  })
})

// ── mainRisk ──────────────────────────────────────────────────────────────────

describe('mainRisk', () => {
  test('returns the RISK_LABELS display label for a known risk type', () => {
    const p = new FcermPresenter(makeProject({ main_risk: 'fluvial_flooding' }))
    expect(p.mainRisk()).toBe('River Flooding')
  })

  test('returns the raw risk key when not present in RISK_LABELS', () => {
    const p = new FcermPresenter(
      makeProject({ main_risk: 'unknown_risk_type' })
    )
    expect(p.mainRisk()).toBe('unknown_risk_type')
  })

  test('falls back to main_source_of_risk when main_risk is null', () => {
    const p = new FcermPresenter(
      makeProject({ main_risk: null, main_source_of_risk: 'sea_flooding' })
    )
    expect(p.mainRisk()).toBe('Sea Flooding')
  })

  test('returns null when both main_risk and main_source_of_risk are null', () => {
    const p = new FcermPresenter(
      makeProject({ main_risk: null, main_source_of_risk: null })
    )
    expect(p.mainRisk()).toBeNull()
  })
})

// ── secondaryRiskSources ──────────────────────────────────────────────────────

describe('secondaryRiskSources', () => {
  test('returns pipe-separated labels excluding the main risk', () => {
    const p = new FcermPresenter(
      makeProject({
        main_risk: 'fluvial_flooding',
        project_risks_protected_against: 'fluvial_flooding,coastal_erosion'
      })
    )
    expect(p.secondaryRiskSources()).toBe('Coastal Erosion')
  })

  test('returns empty string when project_risks_protected_against is null', () => {
    const p = new FcermPresenter(
      makeProject({ project_risks_protected_against: null })
    )
    expect(p.secondaryRiskSources()).toBe('')
  })

  test('uses main_source_of_risk for filtering when main_risk is null', () => {
    const p = new FcermPresenter(
      makeProject({
        main_risk: null,
        main_source_of_risk: 'fluvial_flooding',
        project_risks_protected_against: 'fluvial_flooding,sea_flooding'
      })
    )
    expect(p.secondaryRiskSources()).toBe('Sea Flooding')
  })

  test('passes through raw key for unknown risk type in the list', () => {
    const p = new FcermPresenter(
      makeProject({
        main_risk: 'fluvial_flooding',
        project_risks_protected_against: 'fluvial_flooding,unknown_risk_xyz'
      })
    )
    expect(p.secondaryRiskSources()).toBe('unknown_risk_xyz')
  })

  test('returns multiple labels separated by pipe', () => {
    const p = new FcermPresenter(
      makeProject({
        main_risk: 'fluvial_flooding',
        project_risks_protected_against:
          'fluvial_flooding,coastal_erosion,sea_flooding'
      })
    )
    expect(p.secondaryRiskSources()).toBe('Coastal Erosion | Sea Flooding')
  })
})
