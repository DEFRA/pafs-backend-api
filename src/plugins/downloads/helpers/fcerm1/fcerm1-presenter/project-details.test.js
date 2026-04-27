import { describe, test, expect } from 'vitest'
import { FcermPresenter } from '../fcerm1-presenter.js'

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makePresenter(projectOverrides = {}) {
  return new FcermPresenter(
    { pafs_core_funding_values: [], ...projectOverrides },
    {},
    []
  )
}

// ── moderationCode ────────────────────────────────────────────────────────────

describe('moderationCode', () => {
  test('returns "Not Urgent" for not_urgent', () => {
    const p = makePresenter({ urgency_reason: 'not_urgent' })
    expect(p.moderationCode()).toBe('Not Urgent')
  })

  test('returns "Statutory Requirement" for statutory_need', () => {
    const p = makePresenter({ urgency_reason: 'statutory_need' })
    expect(p.moderationCode()).toBe('Statutory Requirement')
  })

  test('returns "Legal Agreement" for legal_need', () => {
    const p = makePresenter({ urgency_reason: 'legal_need' })
    expect(p.moderationCode()).toBe('Legal Agreement')
  })

  test('returns "Health and Safety" for health_and_safety', () => {
    const p = makePresenter({ urgency_reason: 'health_and_safety' })
    expect(p.moderationCode()).toBe('Health and Safety')
  })

  test('returns "Emergency" for emergency_works', () => {
    const p = makePresenter({ urgency_reason: 'emergency_works' })
    expect(p.moderationCode()).toBe('Emergency')
  })

  test('returns "Time Constrained Contribution" for time_limited', () => {
    const p = makePresenter({ urgency_reason: 'time_limited' })
    expect(p.moderationCode()).toBe('Time Constrained Contribution')
  })

  test('defaults to "Not Urgent" when urgency_reason is absent', () => {
    const p = makePresenter()
    expect(p.moderationCode()).toBe('Not Urgent')
  })

  test('defaults to "Not Urgent" when urgency_reason is unknown', () => {
    const p = makePresenter({ urgency_reason: 'something_else' })
    expect(p.moderationCode()).toBe('Not Urgent')
  })
})

// ── consented ─────────────────────────────────────────────────────────────────

describe('consented', () => {
  test('returns "Y" when consented is true', () => {
    expect(makePresenter({ consented: true }).consented()).toBe('Y')
  })

  test('returns "N" when consented is false', () => {
    expect(makePresenter({ consented: false }).consented()).toBe('N')
  })

  test('returns "N" when consented is absent', () => {
    expect(makePresenter().consented()).toBe('N')
  })
})

// ── gridReference ─────────────────────────────────────────────────────────────

describe('gridReference', () => {
  test('returns grid_reference', () => {
    expect(makePresenter({ grid_reference: 'TQ123456' }).gridReference()).toBe(
      'TQ123456'
    )
  })

  test('returns null when absent', () => {
    expect(makePresenter().gridReference()).toBeNull()
  })
})

// ── county ────────────────────────────────────────────────────────────────────

describe('county', () => {
  test('returns county', () => {
    expect(makePresenter({ county: 'Cambridgeshire' }).county()).toBe(
      'Cambridgeshire'
    )
  })

  test('returns null when absent', () => {
    expect(makePresenter().county()).toBeNull()
  })
})

// ── parliamentaryConstituency ─────────────────────────────────────────────────

describe('parliamentaryConstituency', () => {
  test('returns parliamentary_constituency', () => {
    expect(
      makePresenter({
        parliamentary_constituency: 'South East'
      }).parliamentaryConstituency()
    ).toBe('South East')
  })

  test('returns null when absent', () => {
    expect(makePresenter().parliamentaryConstituency()).toBeNull()
  })
})

// ── approach ──────────────────────────────────────────────────────────────────

describe('approach', () => {
  test('returns approach', () => {
    expect(makePresenter({ approach: 'Slowing the Flow' }).approach()).toBe(
      'Slowing the Flow'
    )
  })

  test('returns null when absent', () => {
    expect(makePresenter().approach()).toBeNull()
  })
})

// ── floodProtectionBefore ─────────────────────────────────────────────────────

describe('floodProtectionBefore', () => {
  // FLOOD_RISK_SYMBOLS = ['very_significant', 'significant', 'moderate', 'low']
  const CASES = [
    [0, '5% or greater'],
    [1, '1.33% to 4.99%'],
    [2, '0.51% to 1.32%'],
    [3, '0.5% or lower']
  ]

  for (const [index, label] of CASES) {
    test(`returns "${label}" for index ${index}`, () => {
      const p = makePresenter({ flood_protection_before: index })
      expect(p.floodProtectionBefore()).toBe(label)
    })
  }

  test('returns null when absent', () => {
    expect(makePresenter().floodProtectionBefore()).toBeNull()
  })

  test('returns null for out-of-range index', () => {
    expect(
      makePresenter({ flood_protection_before: 99 }).floodProtectionBefore()
    ).toBeNull()
  })
})

// ── floodProtectionAfter ──────────────────────────────────────────────────────

describe('floodProtectionAfter', () => {
  const CASES = [
    [0, '5% or greater'],
    [1, '1.33% to 4.99%'],
    [2, '0.51% to 1.32%'],
    [3, '0.5% or lower']
  ]

  for (const [index, label] of CASES) {
    test(`returns "${label}" for index ${index}`, () => {
      const p = makePresenter({ flood_protection_after: index })
      expect(p.floodProtectionAfter()).toBe(label)
    })
  }

  test('returns null when absent', () => {
    expect(makePresenter().floodProtectionAfter()).toBeNull()
  })
})

// ── coastalProtectionBefore ───────────────────────────────────────────────────

describe('coastalProtectionBefore', () => {
  // COASTAL_BEFORE_SYMBOLS = ['less_than_one_year', 'one_to_four_years', 'five_to_nine_years', 'ten_years_or_more']
  const CASES = [
    [0, 'Less than 1 year'],
    [1, '1 to 4 years'],
    [2, '5 to 9 years'],
    [3, '10 years or more']
  ]

  for (const [index, label] of CASES) {
    test(`returns "${label}" for index ${index}`, () => {
      const p = makePresenter({ coastal_protection_before: index })
      expect(p.coastalProtectionBefore()).toBe(label)
    })
  }

  test('returns null when absent', () => {
    expect(makePresenter().coastalProtectionBefore()).toBeNull()
  })
})

// ── coastalProtectionAfter ────────────────────────────────────────────────────

describe('coastalProtectionAfter', () => {
  // COASTAL_AFTER_SYMBOLS = ['less_than_ten_years', 'ten_to_nineteen_years', 'twenty_to_fortynine_years', 'fifty_years_or_more']
  const CASES = [
    [0, 'Less than 10 years'],
    [1, '10 to 19 years'],
    [2, '20 to 49 years'],
    [3, '50 years or more']
  ]

  for (const [index, label] of CASES) {
    test(`returns "${label}" for index ${index}`, () => {
      const p = makePresenter({ coastal_protection_after: index })
      expect(p.coastalProtectionAfter()).toBe(label)
    })
  }

  test('returns null when absent', () => {
    expect(makePresenter().coastalProtectionAfter()).toBeNull()
  })
})

// ── strategicApproach ─────────────────────────────────────────────────────────

describe('strategicApproach', () => {
  test('returns "Y" when strategic_approach is true', () => {
    expect(
      makePresenter({ strategic_approach: true }).strategicApproach()
    ).toBe('Y')
  })

  test('returns "N" when strategic_approach is false', () => {
    expect(
      makePresenter({ strategic_approach: false }).strategicApproach()
    ).toBe('N')
  })

  test('returns "N" when absent', () => {
    expect(makePresenter().strategicApproach()).toBe('N')
  })
})

// ── rawPartnershipFundingScore ────────────────────────────────────────────────

describe('rawPartnershipFundingScore', () => {
  test('returns raw_partnership_funding_score', () => {
    expect(
      makePresenter({
        raw_partnership_funding_score: 42.5
      }).rawPartnershipFundingScore()
    ).toBe(42.5)
  })

  test('returns null when absent', () => {
    expect(makePresenter().rawPartnershipFundingScore()).toBeNull()
  })
})

// ── adjustedPartnershipFundingScore ───────────────────────────────────────────

describe('adjustedPartnershipFundingScore', () => {
  test('returns adjusted_partnership_funding_score', () => {
    expect(
      makePresenter({
        adjusted_partnership_funding_score: 38
      }).adjustedPartnershipFundingScore()
    ).toBe(38)
  })

  test('returns null when absent', () => {
    expect(makePresenter().adjustedPartnershipFundingScore()).toBeNull()
  })
})

// ── pvWholeLifeCosts ──────────────────────────────────────────────────────────

describe('pvWholeLifeCosts', () => {
  test('returns pv_whole_life_costs', () => {
    expect(
      makePresenter({ pv_whole_life_costs: 500000 }).pvWholeLifeCosts()
    ).toBe(500000)
  })

  test('returns null when absent', () => {
    expect(makePresenter().pvWholeLifeCosts()).toBeNull()
  })
})

// ── pvWholeLifeBenefits ───────────────────────────────────────────────────────

describe('pvWholeLifeBenefits', () => {
  test('returns pv_whole_life_benefits', () => {
    expect(
      makePresenter({ pv_whole_life_benefits: 1500000 }).pvWholeLifeBenefits()
    ).toBe(1500000)
  })

  test('returns null when absent', () => {
    expect(makePresenter().pvWholeLifeBenefits()).toBeNull()
  })
})

// ── durationOfBenefits ────────────────────────────────────────────────────────

describe('durationOfBenefits', () => {
  test('returns duration_of_benefits', () => {
    expect(
      makePresenter({ duration_of_benefits: 100 }).durationOfBenefits()
    ).toBe(100)
  })

  test('returns null when absent', () => {
    expect(makePresenter().durationOfBenefits()).toBeNull()
  })
})

// ── benefitCostRatio ──────────────────────────────────────────────────────────

describe('benefitCostRatio', () => {
  test('returns ratio rounded to 1 decimal place', () => {
    const p = makePresenter({
      pv_whole_life_benefits: 1500000,
      pv_whole_life_costs: 500000
    })
    expect(p.benefitCostRatio()).toBe(3)
  })

  test('rounds correctly to 1 decimal place', () => {
    const p = makePresenter({
      pv_whole_life_benefits: 1000000,
      pv_whole_life_costs: 300000
    })
    expect(p.benefitCostRatio()).toBe(3.3)
  })

  test('returns null when pv_whole_life_benefits is null', () => {
    const p = makePresenter({
      pv_whole_life_benefits: null,
      pv_whole_life_costs: 500000
    })
    expect(p.benefitCostRatio()).toBeNull()
  })

  test('returns null when pv_whole_life_costs is null', () => {
    const p = makePresenter({
      pv_whole_life_benefits: 1500000,
      pv_whole_life_costs: null
    })
    expect(p.benefitCostRatio()).toBeNull()
  })

  test('returns null when pv_whole_life_costs is zero (avoid divide-by-zero)', () => {
    const p = makePresenter({
      pv_whole_life_benefits: 1500000,
      pv_whole_life_costs: 0
    })
    expect(p.benefitCostRatio()).toBeNull()
  })

  test('returns null when both fields are absent', () => {
    expect(makePresenter().benefitCostRatio()).toBeNull()
  })
})

// ── publicContributors ────────────────────────────────────────────────────────

describe('publicContributors', () => {
  test('returns public_contributor_names when public_contributions is true', () => {
    const p = makePresenter({
      public_contributions: true,
      public_contributor_names: 'EA, Council'
    })
    expect(p.publicContributors()).toBe('EA, Council')
  })

  test('returns null when public_contributions is false', () => {
    const p = makePresenter({
      public_contributions: false,
      public_contributor_names: 'EA, Council'
    })
    expect(p.publicContributors()).toBeNull()
  })

  test('returns null when public_contributions is true but names is absent', () => {
    const p = makePresenter({ public_contributions: true })
    expect(p.publicContributors()).toBeNull()
  })

  test('returns null when both fields are absent', () => {
    expect(makePresenter().publicContributors()).toBeNull()
  })
})

// ── privateContributors ───────────────────────────────────────────────────────

describe('privateContributors', () => {
  test('returns private_contributor_names when private_contributions is true', () => {
    const p = makePresenter({
      private_contributions: true,
      private_contributor_names: 'Landowner Ltd'
    })
    expect(p.privateContributors()).toBe('Landowner Ltd')
  })

  test('returns null when private_contributions is false', () => {
    const p = makePresenter({
      private_contributions: false,
      private_contributor_names: 'Landowner Ltd'
    })
    expect(p.privateContributors()).toBeNull()
  })

  test('returns null when private_contributions is true but names is absent', () => {
    const p = makePresenter({ private_contributions: true })
    expect(p.privateContributors()).toBeNull()
  })
})

// ── otherEaContributors ───────────────────────────────────────────────────────

describe('otherEaContributors', () => {
  test('returns other_ea_contributor_names when other_ea_contributions is true', () => {
    const p = makePresenter({
      other_ea_contributions: true,
      other_ea_contributor_names: 'Flood Risk Team'
    })
    expect(p.otherEaContributors()).toBe('Flood Risk Team')
  })

  test('returns null when other_ea_contributions is false', () => {
    const p = makePresenter({
      other_ea_contributions: false,
      other_ea_contributor_names: 'Flood Risk Team'
    })
    expect(p.otherEaContributors()).toBeNull()
  })

  test('returns null when other_ea_contributions is true but names is absent', () => {
    const p = makePresenter({ other_ea_contributions: true })
    expect(p.otherEaContributors()).toBeNull()
  })
})
