import { describe, it, expect, vi, beforeEach } from 'vitest'
import { validateProposalPayload } from './proposal-payload-validator.js'

// ---------------------------------------------------------------------------
// Minimal valid payload — all required fields present with acceptable values.
// Optional fields are omitted; nullable required fields are set to null.
// ---------------------------------------------------------------------------
const minimalValidPayload = {
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
  funding_sources: {
    values: []
  }
}

// ---------------------------------------------------------------------------
// Logger stub
// ---------------------------------------------------------------------------
const makeLogger = () => ({
  info: vi.fn(),
  warn: vi.fn()
})

describe('validateProposalPayload', () => {
  let logger

  beforeEach(() => {
    logger = makeLogger()
  })

  describe('valid payload', () => {
    it('returns { valid: true, errors: null }', () => {
      const result = validateProposalPayload(
        minimalValidPayload,
        'PAC-2025-001',
        logger
      )
      expect(result).toEqual({ valid: true, errors: null })
    })

    it('calls logger.info with the reference number', () => {
      validateProposalPayload(minimalValidPayload, 'PAC-2025-001', logger)

      expect(logger.info).toHaveBeenCalledOnce()
      expect(logger.info).toHaveBeenCalledWith(
        { referenceNumber: 'PAC-2025-001' },
        'Proposal payload passed schema validation'
      )
    })

    it('does not call logger.warn', () => {
      validateProposalPayload(minimalValidPayload, 'PAC-2025-001', logger)

      expect(logger.warn).not.toHaveBeenCalled()
    })

    it('accepts a populated funding_sources.values entry', () => {
      const payload = {
        ...minimalValidPayload,
        funding_sources: {
          values: [{ financial_year: 2025, fcerm_gia: 50000 }]
        }
      }

      const result = validateProposalPayload(payload, 'PAC-2025-001', logger)

      expect(result.valid).toBe(true)
    })

    it('accepts all confidence enum values', () => {
      for (const val of [
        'high',
        'medium_high',
        'medium_low',
        'low',
        'not_applicable',
        null
      ]) {
        const payload = {
          ...minimalValidPayload,
          confidence: {
            homes_better_protected: val,
            homes_by_gateway_four: val,
            secured_partnership_funding: val
          }
        }
        const result = validateProposalPayload(payload, 'PAC-2025-001', logger)
        expect(result.valid, `confidence value "${val}" should be valid`).toBe(
          true
        )
      }
    })

    it('accepts integer carbon_operational_cost_forecast', () => {
      const payload = {
        ...minimalValidPayload,
        carbon_operational_cost_forecast: 1200
      }
      const result = validateProposalPayload(payload, 'PAC-2025-001', logger)
      expect(result.valid).toBe(true)
    })

    it('accepts integer carbon_net_economic_benefit', () => {
      const payload = {
        ...minimalValidPayload,
        carbon_net_economic_benefit: 5000
      }
      const result = validateProposalPayload(payload, 'PAC-2025-001', logger)
      expect(result.valid).toBe(true)
    })

    it('accepts decimal capital_carbon', () => {
      const payload = { ...minimalValidPayload, capital_carbon: 123.45 }
      const result = validateProposalPayload(payload, 'PAC-2025-001', logger)
      expect(result.valid).toBe(true)
    })
  })

  describe('invalid payload — missing required fields', () => {
    it('returns { valid: false } when name is missing', () => {
      const { name: _name, ...payloadWithoutName } = minimalValidPayload

      const result = validateProposalPayload(
        payloadWithoutName,
        'PAC-2025-001',
        logger
      )

      expect(result.valid).toBe(false)
      expect(result.errors).not.toBeNull()
    })

    it('returns { valid: false } when funding_sources is missing', () => {
      const { funding_sources: _fs, ...payloadWithoutFs } = minimalValidPayload

      const result = validateProposalPayload(
        payloadWithoutFs,
        'PAC-2025-001',
        logger
      )

      expect(result.valid).toBe(false)
    })

    it('returns { valid: false } when outcome_measures is missing', () => {
      const { outcome_measures: _om, ...payloadWithoutOm } = minimalValidPayload

      const result = validateProposalPayload(
        payloadWithoutOm,
        'PAC-2025-001',
        logger
      )

      expect(result.valid).toBe(false)
    })
  })

  describe('invalid payload — wrong types', () => {
    it('returns { valid: false } when name is not a string', () => {
      const payload = { ...minimalValidPayload, name: 123 }

      const result = validateProposalPayload(payload, 'PAC-2025-001', logger)

      expect(result.valid).toBe(false)
    })

    it('returns { valid: false } when funding_sources.values entry is missing financial_year', () => {
      const payload = {
        ...minimalValidPayload,
        funding_sources: {
          values: [{ fcerm_gia: 50000 }]
        }
      }

      const result = validateProposalPayload(payload, 'PAC-2025-001', logger)

      expect(result.valid).toBe(false)
    })

    it('returns { valid: false } when carbon_operational_cost_forecast is a decimal', () => {
      const payload = {
        ...minimalValidPayload,
        carbon_operational_cost_forecast: 12.5
      }

      const result = validateProposalPayload(payload, 'PAC-2025-001', logger)

      expect(result.valid).toBe(false)
    })

    it('returns { valid: false } when carbon_net_economic_benefit is a decimal', () => {
      const payload = {
        ...minimalValidPayload,
        carbon_net_economic_benefit: 99.9
      }

      const result = validateProposalPayload(payload, 'PAC-2025-001', logger)

      expect(result.valid).toBe(false)
    })

    it('returns { valid: false } when confidence contains an invalid enum value', () => {
      const payload = {
        ...minimalValidPayload,
        confidence: {
          homes_better_protected: 'very_high',
          homes_by_gateway_four: null,
          secured_partnership_funding: null
        }
      }

      const result = validateProposalPayload(payload, 'PAC-2025-001', logger)

      expect(result.valid).toBe(false)
    })
  })

  describe('invalid payload — logger.warn behaviour', () => {
    it('calls logger.warn with referenceNumber and schemaErrors', () => {
      const payload = { ...minimalValidPayload, name: 999 }

      validateProposalPayload(payload, 'PAC-2025-002', logger)

      expect(logger.warn).toHaveBeenCalledOnce()
      const [meta, message] = logger.warn.mock.calls[0]
      expect(meta.referenceNumber).toBe('PAC-2025-002')
      expect(Array.isArray(meta.schemaErrors)).toBe(true)
      expect(message).toContain('failed schema validation')
    })

    it('schema errors contain field, message, and params properties', () => {
      const payload = { ...minimalValidPayload, name: 999 }

      validateProposalPayload(payload, 'PAC-2025-002', logger)

      const [{ schemaErrors }] = logger.warn.mock.calls[0]
      expect(schemaErrors.length).toBeGreaterThan(0)
      schemaErrors.forEach((err) => {
        expect(err).toHaveProperty('field')
        expect(err).toHaveProperty('message')
        expect(err).toHaveProperty('params')
      })
    })

    it('does not call logger.info on failure', () => {
      const payload = { ...minimalValidPayload, name: 999 }

      validateProposalPayload(payload, 'PAC-2025-002', logger)

      expect(logger.info).not.toHaveBeenCalled()
    })
  })
})
