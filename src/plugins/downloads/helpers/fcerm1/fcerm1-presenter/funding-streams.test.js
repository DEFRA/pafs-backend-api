import { describe, test, expect } from 'vitest'
import { fundingStreamsMixin } from './funding-streams.js'

// ── Minimal presenter stub ────────────────────────────────────────────────────
// The mixin methods only access this._p.pafs_core_funding_values and
// this._contributors, so a lightweight stub is sufficient.

function makePresenter(fundingValues = [], contributors = []) {
  return Object.assign(Object.create(fundingStreamsMixin), {
    _p: { pafs_core_funding_values: fundingValues },
    _contributors: contributors
  })
}

function fv(year, fields = {}) {
  return {
    id: year,
    financial_year: year,
    fcerm_gia: 0,
    asset_replacement_allowance: 0,
    environment_statutory_funding: 0,
    frequently_flooded_communities: 0,
    other_additional_grant_in_aid: 0,
    other_government_department: 0,
    recovery: 0,
    summer_economic_fund: 0,
    local_levy: 0,
    internal_drainage_boards: 0,
    not_yet_identified: 0,
    ...fields
  }
}

function contributor(fvId, type, amount) {
  return { funding_value_id: fvId, contributor_type: type, amount }
}

// ── Funding stream methods ────────────────────────────────────────────────────

describe('fcermGia', () => {
  test('returns the value for the matching year', () => {
    const p = makePresenter([fv(2027, { fcerm_gia: 5000 })])
    expect(p.fcermGia(2027)).toBe(5000)
  })

  test('returns 0 when year does not match', () => {
    const p = makePresenter([fv(2027, { fcerm_gia: 5000 })])
    expect(p.fcermGia(2028)).toBe(0)
  })

  test('sums multiple rows for the same year', () => {
    const p = makePresenter([
      fv(2027, { fcerm_gia: 1000 }),
      fv(2027, { fcerm_gia: 2000 })
    ])
    expect(p.fcermGia(2027)).toBe(3000)
  })

  test('returns 0 when pafs_core_funding_values is empty', () => {
    expect(makePresenter([]).fcermGia(2027)).toBe(0)
  })

  test('returns 0 when pafs_core_funding_values is null', () => {
    const p = Object.assign(Object.create(fundingStreamsMixin), {
      _p: { pafs_core_funding_values: null },
      _contributors: []
    })
    expect(p.fcermGia(2027)).toBe(0)
  })
})

describe('assetReplacementAllowance', () => {
  test('returns value for the matching year', () => {
    const p = makePresenter([fv(2028, { asset_replacement_allowance: 7500 })])
    expect(p.assetReplacementAllowance(2028)).toBe(7500)
  })

  test('returns 0 for a non-matching year', () => {
    const p = makePresenter([fv(2028, { asset_replacement_allowance: 7500 })])
    expect(p.assetReplacementAllowance(2029)).toBe(0)
  })
})

describe('environmentStatutoryFunding', () => {
  test('returns value for the matching year', () => {
    const p = makePresenter([fv(2029, { environment_statutory_funding: 3000 })])
    expect(p.environmentStatutoryFunding(2029)).toBe(3000)
  })

  test('returns 0 for non-matching year', () => {
    const p = makePresenter([fv(2029, { environment_statutory_funding: 3000 })])
    expect(p.environmentStatutoryFunding(2030)).toBe(0)
  })
})

describe('frequentlyFloodedCommunities', () => {
  test('returns value for the matching year', () => {
    const p = makePresenter([
      fv(2030, { frequently_flooded_communities: 1200 })
    ])
    expect(p.frequentlyFloodedCommunities(2030)).toBe(1200)
  })

  test('returns 0 for non-matching year', () => {
    const p = makePresenter([
      fv(2030, { frequently_flooded_communities: 1200 })
    ])
    expect(p.frequentlyFloodedCommunities(2031)).toBe(0)
  })
})

describe('otherAdditionalGrantInAid', () => {
  test('returns value for the matching year', () => {
    const p = makePresenter([fv(2031, { other_additional_grant_in_aid: 800 })])
    expect(p.otherAdditionalGrantInAid(2031)).toBe(800)
  })

  test('returns 0 for non-matching year', () => {
    const p = makePresenter([fv(2031, { other_additional_grant_in_aid: 800 })])
    expect(p.otherAdditionalGrantInAid(2032)).toBe(0)
  })
})

describe('otherGovernmentDepartment', () => {
  test('returns value for the matching year', () => {
    const p = makePresenter([fv(2032, { other_government_department: 2200 })])
    expect(p.otherGovernmentDepartment(2032)).toBe(2200)
  })

  test('returns 0 for non-matching year', () => {
    const p = makePresenter([fv(2032, { other_government_department: 2200 })])
    expect(p.otherGovernmentDepartment(2033)).toBe(0)
  })
})

describe('recovery', () => {
  test('returns value for the matching year', () => {
    const p = makePresenter([fv(2033, { recovery: 450 })])
    expect(p.recovery(2033)).toBe(450)
  })

  test('returns 0 for non-matching year', () => {
    const p = makePresenter([fv(2033, { recovery: 450 })])
    expect(p.recovery(2034)).toBe(0)
  })
})

describe('summerEconomicFund', () => {
  test('returns value for the matching year', () => {
    const p = makePresenter([fv(2034, { summer_economic_fund: 600 })])
    expect(p.summerEconomicFund(2034)).toBe(600)
  })

  test('returns 0 for non-matching year', () => {
    const p = makePresenter([fv(2034, { summer_economic_fund: 600 })])
    expect(p.summerEconomicFund(2035)).toBe(0)
  })
})

describe('localLevy', () => {
  test('returns value for the matching year', () => {
    const p = makePresenter([fv(2035, { local_levy: 9000 })])
    expect(p.localLevy(2035)).toBe(9000)
  })

  test('returns 0 for non-matching year', () => {
    const p = makePresenter([fv(2035, { local_levy: 9000 })])
    expect(p.localLevy(2036)).toBe(0)
  })
})

describe('internalDrainageBoards', () => {
  test('returns value for the matching year', () => {
    const p = makePresenter([fv(2036, { internal_drainage_boards: 4400 })])
    expect(p.internalDrainageBoards(2036)).toBe(4400)
  })

  test('returns 0 for non-matching year', () => {
    const p = makePresenter([fv(2036, { internal_drainage_boards: 4400 })])
    expect(p.internalDrainageBoards(2037)).toBe(0)
  })
})

describe('notYetIdentified', () => {
  test('returns value for the matching year', () => {
    const p = makePresenter([fv(2037, { not_yet_identified: 1100 })])
    expect(p.notYetIdentified(2037)).toBe(1100)
  })

  test('returns 0 for non-matching year', () => {
    const p = makePresenter([fv(2037, { not_yet_identified: 1100 })])
    expect(p.notYetIdentified(2038)).toBe(0)
  })

  test('treats null field value as 0', () => {
    const p = makePresenter([{ ...fv(2038), not_yet_identified: null }])
    expect(p.notYetIdentified(2038)).toBe(0)
  })
})

// ── Contributor methods ───────────────────────────────────────────────────────

describe('publicContributions', () => {
  test('sums public contributor amounts for the given year', () => {
    const fundingValues = [fv(2027)]
    const contributors = [
      contributor(2027, 'public_contributions', 5000),
      contributor(2027, 'public_contributions', 3000),
      contributor(2027, 'private_contributions', 999) // different type → excluded
    ]
    const p = makePresenter(fundingValues, contributors)
    expect(p.publicContributions(2027)).toBe(8000)
  })

  test('returns 0 when there are no matching contributors', () => {
    const p = makePresenter([fv(2027)], [])
    expect(p.publicContributions(2027)).toBe(0)
  })

  test('returns 0 when year does not match any funding value', () => {
    const fundingValues = [fv(2027)]
    const contributors = [contributor(2027, 'public_contributions', 5000)]
    const p = makePresenter(fundingValues, contributors)
    expect(p.publicContributions(2028)).toBe(0)
  })
})

describe('privateContributions', () => {
  test('sums private contributor amounts for the given year', () => {
    const fundingValues = [fv(2028)]
    const contributors = [
      contributor(2028, 'private_contributions', 12000),
      contributor(2028, 'public_contributions', 999) // different type → excluded
    ]
    const p = makePresenter(fundingValues, contributors)
    expect(p.privateContributions(2028)).toBe(12000)
  })

  test('returns 0 when contributors is empty', () => {
    expect(makePresenter([fv(2028)], []).privateContributions(2028)).toBe(0)
  })
})

describe('otherEaContributions', () => {
  test('sums other_ea_contributions amounts for the given year', () => {
    const fundingValues = [fv(2029)]
    const contributors = [contributor(2029, 'other_ea_contributions', 2500)]
    const p = makePresenter(fundingValues, contributors)
    expect(p.otherEaContributions(2029)).toBe(2500)
  })

  test('returns 0 for a year with no matching funding values', () => {
    const fundingValues = [fv(2029)]
    const contributors = [contributor(2029, 'other_ea_contributions', 2500)]
    const p = makePresenter(fundingValues, contributors)
    expect(p.otherEaContributions(2030)).toBe(0)
  })

  test('returns 0 when contributors list is null', () => {
    const p = Object.assign(Object.create(fundingStreamsMixin), {
      _p: { pafs_core_funding_values: [fv(2029)] },
      _contributors: null
    })
    expect(p.otherEaContributions(2029)).toBe(0)
  })
})
