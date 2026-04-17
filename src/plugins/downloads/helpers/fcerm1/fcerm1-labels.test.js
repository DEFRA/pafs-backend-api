import { describe, test, expect } from 'vitest'
import {
  RFCC_CODE_NAMES,
  RISK_LABELS,
  MODERATION_LABELS,
  FLOOD_RISK_SYMBOLS,
  COASTAL_BEFORE_SYMBOLS,
  COASTAL_AFTER_SYMBOLS,
  SOP_LABELS,
  CONFIDENCE_LABELS,
  CONTRIBUTOR_TYPE_SHORT_LABELS,
  PSO_TO_COASTAL_GROUP_MAP,
  lookupSopLabel
} from './fcerm1-labels.js'

describe('lookupSopLabel', () => {
  test('returns the correct label for each flood risk index (0–3)', () => {
    expect(lookupSopLabel(0, FLOOD_RISK_SYMBOLS)).toBe('5% or greater')
    expect(lookupSopLabel(1, FLOOD_RISK_SYMBOLS)).toBe('1.33% to 4.99%')
    expect(lookupSopLabel(2, FLOOD_RISK_SYMBOLS)).toBe('0.51% to 1.32%')
    expect(lookupSopLabel(3, FLOOD_RISK_SYMBOLS)).toBe('0.5% or lower')
  })

  test('returns the correct label for each coastal before index (0–3)', () => {
    expect(lookupSopLabel(0, COASTAL_BEFORE_SYMBOLS)).toBe('Less than 1 year')
    expect(lookupSopLabel(1, COASTAL_BEFORE_SYMBOLS)).toBe('1 to 4 years')
    expect(lookupSopLabel(2, COASTAL_BEFORE_SYMBOLS)).toBe('5 to 9 years')
    expect(lookupSopLabel(3, COASTAL_BEFORE_SYMBOLS)).toBe('10 years or more')
  })

  test('returns the correct label for each coastal after index (0–3)', () => {
    expect(lookupSopLabel(0, COASTAL_AFTER_SYMBOLS)).toBe('Less than 10 years')
    expect(lookupSopLabel(1, COASTAL_AFTER_SYMBOLS)).toBe('10 to 19 years')
    expect(lookupSopLabel(2, COASTAL_AFTER_SYMBOLS)).toBe('20 to 49 years')
    expect(lookupSopLabel(3, COASTAL_AFTER_SYMBOLS)).toBe('50 years or more')
  })

  test('returns null when intValue is null', () => {
    expect(lookupSopLabel(null, FLOOD_RISK_SYMBOLS)).toBeNull()
  })

  test('returns null when intValue is undefined', () => {
    expect(lookupSopLabel(undefined, FLOOD_RISK_SYMBOLS)).toBeNull()
  })

  test('returns null for an out-of-bounds index with no matching SOP_LABELS entry', () => {
    expect(lookupSopLabel(99, FLOOD_RISK_SYMBOLS)).toBeNull()
  })
})

describe('RFCC_CODE_NAMES', () => {
  test('has 13 entries', () => {
    expect(Object.keys(RFCC_CODE_NAMES)).toHaveLength(13)
  })

  test('maps AC to Anglian (Great Ouse)', () => {
    expect(RFCC_CODE_NAMES.AC).toBe('Anglian (Great Ouse)')
  })

  test('maps TH to Thames', () => {
    expect(RFCC_CODE_NAMES.TH).toBe('Thames')
  })

  test('maps TS to Test', () => {
    expect(RFCC_CODE_NAMES.TS).toBe('Test')
  })
})

describe('RISK_LABELS', () => {
  test('has 7 entries', () => {
    expect(Object.keys(RISK_LABELS)).toHaveLength(7)
  })

  test('maps fluvial_flooding to River Flooding', () => {
    expect(RISK_LABELS.fluvial_flooding).toBe('River Flooding')
  })

  test('maps coastal_erosion to Coastal Erosion', () => {
    expect(RISK_LABELS.coastal_erosion).toBe('Coastal Erosion')
  })
})

describe('MODERATION_LABELS', () => {
  test('maps not_urgent to Not Urgent', () => {
    expect(MODERATION_LABELS.not_urgent).toBe('Not Urgent')
  })

  test('maps health_and_safety to Health and Safety', () => {
    expect(MODERATION_LABELS.health_and_safety).toBe('Health and Safety')
  })

  test('maps time_limited to Time Constrained Contribution', () => {
    expect(MODERATION_LABELS.time_limited).toBe('Time Constrained Contribution')
  })
})

describe('SOP_LABELS', () => {
  test('has entries for all FLOOD_RISK_SYMBOLS', () => {
    for (const symbol of FLOOD_RISK_SYMBOLS) {
      expect(SOP_LABELS[symbol]).toBeDefined()
    }
  })

  test('has entries for all COASTAL_BEFORE_SYMBOLS', () => {
    for (const symbol of COASTAL_BEFORE_SYMBOLS) {
      expect(SOP_LABELS[symbol]).toBeDefined()
    }
  })

  test('has entries for all COASTAL_AFTER_SYMBOLS', () => {
    for (const symbol of COASTAL_AFTER_SYMBOLS) {
      expect(SOP_LABELS[symbol]).toBeDefined()
    }
  })
})

describe('CONFIDENCE_LABELS', () => {
  test('maps high to "4. High"', () => {
    expect(CONFIDENCE_LABELS.high).toBe('4. High')
  })

  test('maps not_applicable to "N/A"', () => {
    expect(CONFIDENCE_LABELS.not_applicable).toBe('N/A')
  })
})

describe('CONTRIBUTOR_TYPE_SHORT_LABELS', () => {
  test('has 8 entries', () => {
    expect(Object.keys(CONTRIBUTOR_TYPE_SHORT_LABELS)).toHaveLength(8)
  })

  test('maps fcerm_gia to Grant in aid', () => {
    expect(CONTRIBUTOR_TYPE_SHORT_LABELS.fcerm_gia).toBe('Grant in aid')
  })

  test('maps local_levy to Local levy', () => {
    expect(CONTRIBUTOR_TYPE_SHORT_LABELS.local_levy).toBe('Local levy')
  })

  test('maps not_yet_identified to Other funding sources', () => {
    expect(CONTRIBUTOR_TYPE_SHORT_LABELS.not_yet_identified).toBe(
      'Other funding sources'
    )
  })
})

describe('PSO_TO_COASTAL_GROUP_MAP', () => {
  test('maps PSO Durham & Tees Valley to North East Coastal Group', () => {
    expect(PSO_TO_COASTAL_GROUP_MAP['PSO Durham & Tees Valley']).toBe(
      'North East Coastal Group'
    )
  })

  test('maps PSO East Devon & Cornwall to South West Coastal Group', () => {
    expect(PSO_TO_COASTAL_GROUP_MAP['PSO East Devon & Cornwall']).toBe(
      'South West Coastal Group'
    )
  })

  test('maps PSO East Kent to South East Coastal Group', () => {
    expect(PSO_TO_COASTAL_GROUP_MAP['PSO East Kent']).toBe(
      'South East Coastal Group'
    )
  })

  test('maps PSO Somerset to Severn Estuary Coastal Group', () => {
    expect(PSO_TO_COASTAL_GROUP_MAP['PSO Somerset']).toBe(
      'Severn Estuary Coastal Group'
    )
  })
})
