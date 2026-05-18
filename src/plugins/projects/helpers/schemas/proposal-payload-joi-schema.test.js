import { describe, it, expect } from 'vitest'
import { proposalPayloadSchema } from './proposal-payload-joi-schema.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Validate a partial object against the full schema (abortEarly: false).
 * Returns the Joi error or undefined.
 */
const validate = (payload) => proposalPayloadSchema.validate(payload).error

/**
 * Build the minimal required skeleton to isolate a single field under test.
 * Most optional sub-fields are omitted; required nullable fields are null.
 */
const base = () => ({
  name: 'Test Project',
  type: 'DEF',
  national_project_number: null,
  pafs_region_and_coastal_commitee: null,
  pafs_ea_area: null,
  lrma_name: null,
  lrma_type: null,
  shapefile: null,
  aspirational_gateway_1: null,
  aspirational_gateway_2: null,
  aspirational_gateway_3: null,
  aspirational_gateway_4: null,
  aspirational_start_of_construction: null,
  earliest_start_date_with_gia_available: null,
  earliest_start_date: null,
  secondary_risk_sources: {
    fluvial_flooding: false,
    tidal_flooding: false,
    groundwater_flooding: false,
    surface_water_flooding: false,
    sea_flooding: false,
    reservoir_flooding: false,
    coastal_erosion: false
  },
  risk_source: null,
  problem_and_proposed_solution: null,
  moderation_code: null,
  outcome_measures: {
    om2: {},
    om3: {},
    om4a: {
      om4a_hectares_intertidal: null,
      om4a_hectares_woodland: null,
      om4a_hectares_wet_woodland: null,
      om4a_hectares_wetland_or_wet_grassland: null,
      om4a_hectares_grassland: null,
      om4a_hectares_heathland: null,
      om4a_hectares_ponds_lakes: null,
      om4a_hectares_arable_land: null
    },
    om4b: {
      om4b_kilometres_of_watercourse_comprehensive: null,
      om4b_kilometres_of_watercourse_partial: null,
      om4b_kilometres_of_watercourse_single: null
    }
  },
  confidence: {
    homes_better_protected: null,
    homes_by_gateway_four: null,
    secured_partnership_funding: null
  },
  capital_carbon: null,
  carbon_operational_cost_forecast: null,
  funding_sources: { values: [] }
})

// ---------------------------------------------------------------------------
// monthYear pattern
// ---------------------------------------------------------------------------

describe('monthYear pattern (aspirational dates)', () => {
  it('accepts MM/YYYY format', () => {
    expect(
      validate({ ...base(), aspirational_gateway_1: '03/2026' })
    ).toBeUndefined()
  })

  it('accepts null', () => {
    expect(
      validate({ ...base(), aspirational_gateway_1: null })
    ).toBeUndefined()
  })

  it('rejects YYYY-MM-DD format', () => {
    expect(
      validate({ ...base(), aspirational_gateway_1: '2026-03-01' })
    ).toBeDefined()
  })

  it('rejects MM/YY (two-digit year)', () => {
    expect(
      validate({ ...base(), aspirational_gateway_1: '03/26' })
    ).toBeDefined()
  })

  it('rejects plain text', () => {
    expect(
      validate({ ...base(), aspirational_gateway_1: 'March 2026' })
    ).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// intervention_types sub-schema
// ---------------------------------------------------------------------------

describe('intervention_types sub-schema', () => {
  const validInterventionTypes = {
    natural_flood_management: true,
    property_flood_resilience: false,
    sustainable_drainage_systems: false,
    other: false
  }

  it('accepts all boolean values', () => {
    expect(
      validate({ ...base(), intervention_types: validInterventionTypes })
    ).toBeUndefined()
  })

  it('rejects a non-boolean value', () => {
    expect(
      validate({
        ...base(),
        intervention_types: {
          ...validInterventionTypes,
          natural_flood_management: 'yes'
        }
      })
    ).toBeDefined()
  })

  it('rejects a missing required field', () => {
    const { natural_flood_management: _nfm, ...rest } = validInterventionTypes
    expect(validate({ ...base(), intervention_types: rest })).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// secondary_risk_sources sub-schema
// ---------------------------------------------------------------------------

describe('secondary_risk_sources sub-schema', () => {
  it('rejects a non-boolean field', () => {
    expect(
      validate({
        ...base(),
        secondary_risk_sources: {
          ...base().secondary_risk_sources,
          fluvial_flooding: 1
        }
      })
    ).toBeDefined()
  })

  it('rejects a missing required field', () => {
    const { fluvial_flooding: _ff, ...rest } = base().secondary_risk_sources
    expect(validate({ ...base(), secondary_risk_sources: rest })).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// om2 / om3 decimal fields
// ---------------------------------------------------------------------------

describe('om2 / om3 property count fields (whole numbers only)', () => {
  it('om2 accepts whole number values', () => {
    expect(
      validate({
        ...base(),
        outcome_measures: {
          ...base().outcome_measures,
          om2: { 'om2.1': 12, 'om2.2': null, 'om2.3': 0, 'om2.4': 999 }
        }
      })
    ).toBeUndefined()
  })

  it('om2 rejects a decimal value', () => {
    expect(
      validate({
        ...base(),
        outcome_measures: {
          ...base().outcome_measures,
          om2: { 'om2.1': 12.5 }
        }
      })
    ).toBeDefined()
  })

  it('om2 rejects a string value', () => {
    expect(
      validate({
        ...base(),
        outcome_measures: {
          ...base().outcome_measures,
          om2: { 'om2.1': 'not a number' }
        }
      })
    ).toBeDefined()
  })

  it('om3 accepts whole number values', () => {
    expect(
      validate({
        ...base(),
        outcome_measures: {
          ...base().outcome_measures,
          om3: { 'om3.1': 100, 'om3.2': 200 }
        }
      })
    ).toBeUndefined()
  })

  it('om3 rejects a decimal value', () => {
    expect(
      validate({
        ...base(),
        outcome_measures: {
          ...base().outcome_measures,
          om3: { 'om3.1': 1.1 }
        }
      })
    ).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// om4a / om4b — required nullable decimal fields
// ---------------------------------------------------------------------------

describe('om4a / om4b required nullable fields', () => {
  it('om4a rejects missing required field', () => {
    const { om4a_hectares_intertidal: _f, ...rest } =
      base().outcome_measures.om4a
    expect(
      validate({
        ...base(),
        outcome_measures: { ...base().outcome_measures, om4a: rest }
      })
    ).toBeDefined()
  })

  it('om4a accepts decimals', () => {
    const om4a = Object.fromEntries(
      Object.keys(base().outcome_measures.om4a).map((k) => [k, 1.25])
    )
    expect(
      validate({
        ...base(),
        outcome_measures: { ...base().outcome_measures, om4a }
      })
    ).toBeUndefined()
  })

  it('om4b rejects missing required field', () => {
    const { om4b_kilometres_of_watercourse_comprehensive: _f, ...rest } =
      base().outcome_measures.om4b
    expect(
      validate({
        ...base(),
        outcome_measures: { ...base().outcome_measures, om4b: rest }
      })
    ).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// Funding year entries
// ---------------------------------------------------------------------------

describe('funding year entry', () => {
  it('accepts a fully-populated entry', () => {
    expect(
      validate({
        ...base(),
        funding_sources: {
          values: [
            {
              financial_year: 2025,
              fcerm_gia: 100000,
              local_levy: 50000,
              not_yet_identified: null,
              public_contributions: [{ name: 'ACME', amount: 5000 }],
              private_contributions: [],
              other_ea_contributions: []
            }
          ]
        }
      })
    ).toBeUndefined()
  })

  it('rejects a non-integer financial_year', () => {
    expect(
      validate({
        ...base(),
        funding_sources: {
          values: [{ financial_year: 2025.5, fcerm_gia: null }]
        }
      })
    ).toBeDefined()
  })

  it('rejects a non-numeric string financial_year', () => {
    expect(
      validate({
        ...base(),
        funding_sources: {
          values: [{ financial_year: 'twenty-twenty-five', fcerm_gia: null }]
        }
      })
    ).toBeDefined()
  })

  it('rejects a decimal funding amount (whole numbers only)', () => {
    expect(
      validate({
        ...base(),
        funding_sources: {
          values: [{ financial_year: 2025, fcerm_gia: 50000.5 }]
        }
      })
    ).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// Contributor entry sub-schema
// ---------------------------------------------------------------------------

describe('contributor entry sub-schema', () => {
  it('accepts a valid contributor entry', () => {
    expect(
      validate({
        ...base(),
        funding_sources: {
          values: [
            {
              financial_year: 2025,
              fcerm_gia: null,
              public_contributions: [{ name: 'Local Council', amount: 20000 }]
            }
          ]
        }
      })
    ).toBeUndefined()
  })

  it('accepts null name and amount', () => {
    expect(
      validate({
        ...base(),
        funding_sources: {
          values: [
            {
              financial_year: 2025,
              fcerm_gia: null,
              public_contributions: [{ name: null, amount: null }]
            }
          ]
        }
      })
    ).toBeUndefined()
  })

  it('rejects a non-numeric amount', () => {
    expect(
      validate({
        ...base(),
        funding_sources: {
          values: [
            {
              financial_year: 2025,
              fcerm_gia: null,
              public_contributions: [{ name: 'Council', amount: 'lots' }]
            }
          ]
        }
      })
    ).toBeDefined()
  })

  it('rejects a decimal contributor amount (whole numbers only)', () => {
    expect(
      validate({
        ...base(),
        funding_sources: {
          values: [
            {
              financial_year: 2025,
              fcerm_gia: null,
              public_contributions: [{ name: 'Council', amount: 1234.5 }]
            }
          ]
        }
      })
    ).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// Carbon — decimal vs integer enforcement
// ---------------------------------------------------------------------------

describe('carbon field types', () => {
  it('capital_carbon accepts a decimal', () => {
    expect(validate({ ...base(), capital_carbon: 123.456 })).toBeUndefined()
  })

  it('carbon_lifecycle accepts a decimal', () => {
    expect(validate({ ...base(), carbon_lifecycle: 0.001 })).toBeUndefined()
  })

  it('carbon_operational_cost_forecast accepts an integer', () => {
    expect(
      validate({ ...base(), carbon_operational_cost_forecast: 1500 })
    ).toBeUndefined()
  })

  it('carbon_operational_cost_forecast rejects a decimal', () => {
    expect(
      validate({ ...base(), carbon_operational_cost_forecast: 1500.5 })
    ).toBeDefined()
  })

  it('carbon_net_economic_benefit accepts an integer', () => {
    expect(
      validate({ ...base(), carbon_net_economic_benefit: 9000 })
    ).toBeUndefined()
  })

  it('carbon_net_economic_benefit rejects a decimal', () => {
    expect(
      validate({ ...base(), carbon_net_economic_benefit: 9000.1 })
    ).toBeDefined()
  })

  it('carbon_net_economic_benefit accepts null', () => {
    expect(
      validate({ ...base(), carbon_net_economic_benefit: null })
    ).toBeUndefined()
  })
})
