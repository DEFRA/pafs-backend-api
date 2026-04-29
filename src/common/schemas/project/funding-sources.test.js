import { describe, it, expect } from 'vitest'
import { PROJECT_VALIDATION_MESSAGES } from '../../constants/project.js'
import {
  MAIN_FUNDING_SOURCE_FIELDS,
  ADDITIONAL_GIA_FUNDING_SOURCE_FIELDS,
  SPENDING_FUNDING_SOURCE_FIELDS,
  fundingSourcesSelectedSchema,
  additionalFcrmGiaSelectedSchema,
  publicContributorNamesSchema,
  privateContributorNamesSchema,
  otherEaContributorNamesSchema,
  fundingValueRowSchema,
  createFundingValuesSchema
} from './funding-sources.js'

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Returns an object with all MAIN_FUNDING_SOURCE_FIELDS set to false. */
const allMainFalse = () =>
  Object.fromEntries(MAIN_FUNDING_SOURCE_FIELDS.map((f) => [f, false]))

/** Returns an object with all MAIN_FUNDING_SOURCE_FIELDS set to true. */
const allMainTrue = () =>
  Object.fromEntries(MAIN_FUNDING_SOURCE_FIELDS.map((f) => [f, true]))

/** Returns an object with all ADDITIONAL_GIA_FUNDING_SOURCE_FIELDS set to false. */
const allGiaFalse = () =>
  Object.fromEntries(
    ADDITIONAL_GIA_FUNDING_SOURCE_FIELDS.map((f) => [f, false])
  )

/** Returns an object with all ADDITIONAL_GIA_FUNDING_SOURCE_FIELDS set to true. */
const allGiaTrue = () =>
  Object.fromEntries(ADDITIONAL_GIA_FUNDING_SOURCE_FIELDS.map((f) => [f, true]))

/** Minimal valid funding value row (only financialYear required). */
const validRow = (overrides = {}) => ({
  financialYear: 2025,
  ...overrides
})

// ─── Exported field-name arrays ───────────────────────────────────────────────

describe('exported field-name arrays', () => {
  it('MAIN_FUNDING_SOURCE_FIELDS has 7 entries', () => {
    expect(MAIN_FUNDING_SOURCE_FIELDS).toHaveLength(7)
  })

  it('MAIN_FUNDING_SOURCE_FIELDS contains the expected fields', () => {
    expect(MAIN_FUNDING_SOURCE_FIELDS).toEqual([
      'fcermGia',
      'localLevy',
      'additionalFcermGia',
      'publicContributions',
      'privateContributions',
      'otherEaContributions',
      'notYetIdentified'
    ])
  })

  it('ADDITIONAL_GIA_FUNDING_SOURCE_FIELDS has 7 entries', () => {
    expect(ADDITIONAL_GIA_FUNDING_SOURCE_FIELDS).toHaveLength(7)
  })

  it('ADDITIONAL_GIA_FUNDING_SOURCE_FIELDS contains the expected fields', () => {
    expect(ADDITIONAL_GIA_FUNDING_SOURCE_FIELDS).toEqual([
      'assetReplacementAllowance',
      'environmentStatutoryFunding',
      'frequentlyFloodedCommunities',
      'otherAdditionalGrantInAid',
      'otherGovernmentDepartment',
      'recovery',
      'summerEconomicFund'
    ])
  })

  it('SPENDING_FUNDING_SOURCE_FIELDS contains 13 entries (6 main + 7 GIA, no virtual additionalFcrmGia)', () => {
    expect(SPENDING_FUNDING_SOURCE_FIELDS).toHaveLength(13)
    expect(SPENDING_FUNDING_SOURCE_FIELDS).not.toContain('additionalFcrmGia')
    expect(SPENDING_FUNDING_SOURCE_FIELDS).toContain('fcermGia')
    expect(SPENDING_FUNDING_SOURCE_FIELDS).toContain(
      'assetReplacementAllowance'
    )
  })
})

// ─── Scenario 1: fundingSourcesSelectedSchema ────────────────────────────────

describe('fundingSourcesSelectedSchema', () => {
  describe('valid payloads', () => {
    it('accepts all true', () => {
      const { error } = fundingSourcesSelectedSchema.validate(allMainTrue())
      expect(error).toBeUndefined()
    })

    it('accepts mix of true/false as long as at least one is true', () => {
      const payload = {
        ...allMainFalse(),
        fcermGia: true
      }
      const { error } = fundingSourcesSelectedSchema.validate(payload)
      expect(error).toBeUndefined()
    })

    it('accepts only additionalFcermGia as true', () => {
      const payload = {
        ...allMainFalse(),
        additionalFcermGia: true
      }
      const { error } = fundingSourcesSelectedSchema.validate(payload)
      expect(error).toBeUndefined()
    })

    it('accepts only notYetIdentified as true', () => {
      const payload = {
        ...allMainFalse(),
        notYetIdentified: true
      }
      const { error } = fundingSourcesSelectedSchema.validate(payload)
      expect(error).toBeUndefined()
    })

    it('allows unknown fields (referenceNumber etc.)', () => {
      const payload = {
        ...allMainFalse(),
        fcermGia: true,
        referenceNumber: 'AC-001'
      }
      const { error } = fundingSourcesSelectedSchema.validate(payload)
      expect(error).toBeUndefined()
    })
  })

  describe('at-least-one-true requirement', () => {
    it('fails when all fields are false', () => {
      const { error } = fundingSourcesSelectedSchema.validate(allMainFalse())
      expect(error).toBeDefined()
      expect(error.details[0].message).toBe(
        PROJECT_VALIDATION_MESSAGES.FUNDING_SOURCES_SELECTED_REQUIRED
      )
    })
  })

  describe('boolean type enforcement', () => {
    it('rejects string "true" (strict mode)', () => {
      const payload = { ...allMainFalse(), fcermGia: 'true' }
      const { error } = fundingSourcesSelectedSchema.validate(payload)
      expect(error).toBeDefined()
      expect(error.details[0].message).toBe(
        PROJECT_VALIDATION_MESSAGES.FUNDING_SOURCES_SELECTED_INVALID
      )
    })

    it('rejects numeric 1 (strict mode)', () => {
      const payload = { ...allMainFalse(), fcermGia: 1 }
      const { error } = fundingSourcesSelectedSchema.validate(payload)
      expect(error).toBeDefined()
      expect(error.details[0].message).toBe(
        PROJECT_VALIDATION_MESSAGES.FUNDING_SOURCES_SELECTED_INVALID
      )
    })

    it('rejects null', () => {
      const payload = { ...allMainFalse(), fcermGia: null }
      const { error } = fundingSourcesSelectedSchema.validate(payload)
      expect(error).toBeDefined()
      expect(error.details[0].message).toBe(
        PROJECT_VALIDATION_MESSAGES.FUNDING_SOURCES_SELECTED_INVALID
      )
    })
  })

  describe('missing fields', () => {
    it('fails when a field is missing', () => {
      const { fcermGia: _omitted, ...payload } = allMainFalse()
      payload.localLevy = true
      const { error } = fundingSourcesSelectedSchema.validate(payload)
      expect(error).toBeDefined()
      expect(error.details[0].message).toBe(
        PROJECT_VALIDATION_MESSAGES.FUNDING_SOURCES_SELECTED_INVALID
      )
    })

    it('fails when all fields are missing', () => {
      const { error } = fundingSourcesSelectedSchema.validate({})
      expect(error).toBeDefined()
    })
  })

  describe('all 7 individual fields accepted', () => {
    it.each(MAIN_FUNDING_SOURCE_FIELDS)(
      'accepts %s as the sole true field',
      (field) => {
        const payload = { ...allMainFalse(), [field]: true }
        const { error } = fundingSourcesSelectedSchema.validate(payload)
        expect(error).toBeUndefined()
      }
    )
  })
})

// ─── Scenario 2: additionalFcrmGiaSelectedSchema ─────────────────────────────

describe('additionalFcrmGiaSelectedSchema', () => {
  describe('valid payloads', () => {
    it('accepts all true', () => {
      const { error } = additionalFcrmGiaSelectedSchema.validate(allGiaTrue())
      expect(error).toBeUndefined()
    })

    it('accepts mix of true/false as long as at least one is true', () => {
      const payload = {
        ...allGiaFalse(),
        assetReplacementAllowance: true
      }
      const { error } = additionalFcrmGiaSelectedSchema.validate(payload)
      expect(error).toBeUndefined()
    })

    it('allows unknown fields', () => {
      const payload = {
        ...allGiaFalse(),
        recovery: true,
        referenceNumber: 'AC-001'
      }
      const { error } = additionalFcrmGiaSelectedSchema.validate(payload)
      expect(error).toBeUndefined()
    })
  })

  describe('at-least-one-true requirement', () => {
    it('fails when all sub-options are false', () => {
      const { error } = additionalFcrmGiaSelectedSchema.validate(allGiaFalse())
      expect(error).toBeDefined()
      expect(error.details[0].message).toBe(
        PROJECT_VALIDATION_MESSAGES.ADDITIONAL_FUNDING_SOURCES_GIA_SELECTED_REQUIRED
      )
    })
  })

  describe('boolean type enforcement', () => {
    it('rejects string "false" (strict mode)', () => {
      const payload = { ...allGiaTrue(), recovery: 'false' }
      const { error } = additionalFcrmGiaSelectedSchema.validate(payload)
      expect(error).toBeDefined()
      expect(error.details[0].message).toBe(
        PROJECT_VALIDATION_MESSAGES.ADDITIONAL_FUNDING_SOURCES_GIA_SELECTED_INVALID
      )
    })

    it('rejects null', () => {
      const payload = { ...allGiaTrue(), summerEconomicFund: null }
      const { error } = additionalFcrmGiaSelectedSchema.validate(payload)
      expect(error).toBeDefined()
      expect(error.details[0].message).toBe(
        PROJECT_VALIDATION_MESSAGES.ADDITIONAL_FUNDING_SOURCES_GIA_SELECTED_INVALID
      )
    })
  })

  describe('missing fields', () => {
    it('fails when a field is missing', () => {
      const { recovery: _omitted, ...payload } = allGiaFalse()
      payload.assetReplacementAllowance = true
      const { error } = additionalFcrmGiaSelectedSchema.validate(payload)
      expect(error).toBeDefined()
      expect(error.details[0].message).toBe(
        PROJECT_VALIDATION_MESSAGES.ADDITIONAL_FUNDING_SOURCES_GIA_SELECTED_INVALID
      )
    })
  })

  describe('all 7 individual sub-option fields accepted', () => {
    it.each(ADDITIONAL_GIA_FUNDING_SOURCE_FIELDS)(
      'accepts %s as the sole true sub-option',
      (field) => {
        const payload = { ...allGiaFalse(), [field]: true }
        const { error } = additionalFcrmGiaSelectedSchema.validate(payload)
        expect(error).toBeUndefined()
      }
    )
  })
})

// ─── Scenario 3: Contributor name schemas ────────────────────────────────────

const contributorNameCases = [
  {
    label: 'publicContributorNamesSchema',
    schema: publicContributorNamesSchema,
    requiredMsg:
      PROJECT_VALIDATION_MESSAGES.PUBLIC_SECTOR_CONTRIBUTORS_REQUIRED,
    invalidMsg: PROJECT_VALIDATION_MESSAGES.PUBLIC_SECTOR_CONTRIBUTORS_INVALID
  },
  {
    label: 'privateContributorNamesSchema',
    schema: privateContributorNamesSchema,
    requiredMsg:
      PROJECT_VALIDATION_MESSAGES.PRIVATE_SECTOR_CONTRIBUTORS_REQUIRED,
    invalidMsg: PROJECT_VALIDATION_MESSAGES.PRIVATE_SECTOR_CONTRIBUTORS_INVALID
  },
  {
    label: 'otherEaContributorNamesSchema',
    schema: otherEaContributorNamesSchema,
    requiredMsg:
      PROJECT_VALIDATION_MESSAGES.OTHER_ENVIRONMENT_AGENCY_CONTRIBUTORS_REQUIRED,
    invalidMsg:
      PROJECT_VALIDATION_MESSAGES.OTHER_ENVIRONMENT_AGENCY_CONTRIBUTORS_INVALID
  }
]

describe.each(contributorNameCases)(
  '$label',
  ({ schema, requiredMsg, invalidMsg }) => {
    it('accepts a single contributor name', () => {
      const { error, value } = schema.validate('Environment Agency North')
      expect(error).toBeUndefined()
      expect(value).toBe('Environment Agency North')
    })

    it('accepts multiple comma-separated contributors', () => {
      const { error } = schema.validate('Org A, Org B, Org C')
      expect(error).toBeUndefined()
    })

    it('trims leading and trailing whitespace', () => {
      const { error, value } = schema.validate('  EA North  ')
      expect(error).toBeUndefined()
      expect(value).toBe('EA North')
    })

    it('fails for an empty string', () => {
      const { error } = schema.validate('')
      expect(error).toBeDefined()
      expect(error.details[0].message).toBe(requiredMsg)
    })

    it('fails for a whitespace-only string (trimmed to empty)', () => {
      const { error } = schema.validate('   ')
      expect(error).toBeDefined()
      expect(error.details[0].message).toBe(requiredMsg)
    })

    it('fails for undefined / missing value', () => {
      const { error } = schema.validate(undefined)
      expect(error).toBeDefined()
      expect(error.details[0].message).toBe(requiredMsg)
    })

    it('fails for null', () => {
      const { error } = schema.validate(null)
      expect(error).toBeDefined()
      expect(error.details[0].message).toBe(invalidMsg)
    })

    it('fails for a non-string value (number)', () => {
      const { error } = schema.validate(12345)
      expect(error).toBeDefined()
      expect(error.details[0].message).toBe(invalidMsg)
    })

    it('fails for duplicate contributor names (case-insensitive)', () => {
      const { error } = schema.validate('Alice, alice')
      expect(error).toBeDefined()
    })

    it('fails for duplicate names with different casing and extra spaces', () => {
      const { error } = schema.validate('Local Authority, local authority')
      expect(error).toBeDefined()
    })
  }
)

// ─── Scenario 4: fundingValueRowSchema ───────────────────────────────────────

describe('fundingValueRowSchema', () => {
  describe('valid rows', () => {
    it('accepts a row with only financialYear', () => {
      const { error } = fundingValueRowSchema.validate(validRow())
      expect(error).toBeUndefined()
    })

    it('accepts a row with all spend fields populated', () => {
      const { error } = fundingValueRowSchema.validate(
        validRow({
          fcermGia: '100000',
          localLevy: '50000',
          publicContributions: '25000',
          privateContributions: '30000',
          otherEaContributions: '10000',
          notYetIdentified: '0',
          assetReplacementAllowance: '5000',
          environmentStatutoryFunding: '0',
          frequentlyFloodedCommunities: '2000',
          otherAdditionalGrantInAid: '0',
          otherGovernmentDepartment: '0',
          recovery: '0',
          summerEconomicFund: '1000',
          total: '223000'
        })
      )
      expect(error).toBeUndefined()
    })

    it('accepts zero as a valid spend value', () => {
      const { error } = fundingValueRowSchema.validate(
        validRow({ fcermGia: '0' })
      )
      expect(error).toBeUndefined()
    })

    it('accepts null for spend fields (no spend entered)', () => {
      const { error } = fundingValueRowSchema.validate(
        validRow({ fcermGia: null, localLevy: null })
      )
      expect(error).toBeUndefined()
    })

    it('accepts empty string for spend fields', () => {
      const { error } = fundingValueRowSchema.validate(
        validRow({ fcermGia: '', localLevy: '' })
      )
      expect(error).toBeUndefined()
    })

    it('accepts exactly 18-digit spend value', () => {
      const { error } = fundingValueRowSchema.validate(
        validRow({ fcermGia: '9'.repeat(18) })
      )
      expect(error).toBeUndefined()
    })

    it('accepts contributor breakdown arrays for public/private/other EA contributors', () => {
      const { error } = fundingValueRowSchema.validate(
        validRow({
          publicContributors: [
            {
              name: 'Public Partner',
              contributorType: 'public_contributions',
              amount: '25000'
            }
          ],
          privateContributors: [
            {
              name: 'Private Partner',
              contributorType: 'private_contributions',
              amount: '12000'
            }
          ],
          otherEaContributors: [
            {
              name: 'EA Partner',
              contributorType: 'other_ea_contributions',
              amount: '3000'
            }
          ]
        })
      )
      expect(error).toBeUndefined()
    })

    it('trims whitespace from spend fields', () => {
      const { value, error } = fundingValueRowSchema.validate(
        validRow({ fcermGia: '  12345  ' })
      )
      expect(error).toBeUndefined()
      expect(value.fcermGia).toBe('12345')
    })
  })

  describe('financialYear validation', () => {
    it('fails when financialYear is missing', () => {
      const { error } = fundingValueRowSchema.validate({
        fcermGia: '100'
      })
      expect(error).toBeDefined()
      expect(error.details[0].message).toBe(
        PROJECT_VALIDATION_MESSAGES.FUNDING_SOURCES_ESTIMATED_SPEND_REQUIRED
      )
    })

    it('fails when financialYear is a non-integer number', () => {
      const { error } = fundingValueRowSchema.validate(
        validRow({ financialYear: 2025.5 })
      )
      expect(error).toBeDefined()
      expect(error.details[0].message).toBe(
        PROJECT_VALIDATION_MESSAGES.FUNDING_SOURCES_ESTIMATED_SPEND_INVALID
      )
    })

    it('coerces string financialYear to a valid integer', () => {
      // Joi.number() coerces numeric strings by default
      const { error, value } = fundingValueRowSchema.validate(
        validRow({ financialYear: '2025' })
      )
      expect(error).toBeUndefined()
      expect(value.financialYear).toBe(2025)
    })
  })

  describe('spend value validation', () => {
    it('fails when spend value contains non-digit characters', () => {
      const { error } = fundingValueRowSchema.validate(
        validRow({ fcermGia: '12,345' })
      )
      expect(error).toBeDefined()
      expect(error.details[0].message).toBe(
        PROJECT_VALIDATION_MESSAGES.FUNDING_SOURCES_ESTIMATED_SPEND_INVALID
      )
    })

    it('fails for decimal spend values', () => {
      const { error } = fundingValueRowSchema.validate(
        validRow({ localLevy: '12345.67' })
      )
      expect(error).toBeDefined()
      expect(error.details[0].message).toBe(
        PROJECT_VALIDATION_MESSAGES.FUNDING_SOURCES_ESTIMATED_SPEND_INVALID
      )
    })

    it('fails for negative spend values', () => {
      const { error } = fundingValueRowSchema.validate(
        validRow({ fcermGia: '-5000' })
      )
      expect(error).toBeDefined()
      expect(error.details[0].message).toBe(
        PROJECT_VALIDATION_MESSAGES.FUNDING_SOURCES_ESTIMATED_SPEND_INVALID
      )
    })

    it('fails when spend value exceeds 18 digits', () => {
      const { error } = fundingValueRowSchema.validate(
        validRow({ fcermGia: '9'.repeat(19) })
      )
      expect(error).toBeDefined()
      expect(error.details[0].message).toBe(
        PROJECT_VALIDATION_MESSAGES.FUNDING_SOURCES_ESTIMATED_SPEND_MAX_DIGITS
      )
    })

    it('fails when contributor amount contains non-digits', () => {
      const { error } = fundingValueRowSchema.validate(
        validRow({
          publicContributors: [
            {
              name: 'Public Partner',
              contributorType: 'public_contributions',
              amount: '10,000'
            }
          ]
        })
      )
      expect(error).toBeDefined()
      expect(error.details[0].message).toBe(
        PROJECT_VALIDATION_MESSAGES.FUNDING_SOURCES_ESTIMATED_SPEND_INVALID
      )
    })

    it('fails when contributor type does not match the array type', () => {
      const { error } = fundingValueRowSchema.validate(
        validRow({
          privateContributors: [
            {
              name: 'Private Partner',
              contributorType: 'public_contributions',
              amount: '10000'
            }
          ]
        })
      )
      expect(error).toBeDefined()
      expect(error.details[0].message).toBe(
        PROJECT_VALIDATION_MESSAGES.FUNDING_SOURCES_ESTIMATED_SPEND_INVALID
      )
    })

    it('fails for alphabetic spend values', () => {
      const { error } = fundingValueRowSchema.validate(
        validRow({ recovery: 'abc' })
      )
      expect(error).toBeDefined()
      expect(error.details[0].message).toBe(
        PROJECT_VALIDATION_MESSAGES.FUNDING_SOURCES_ESTIMATED_SPEND_INVALID
      )
    })
  })

  describe('unknown key rejection', () => {
    it('fails when an unknown key is present', () => {
      const { error } = fundingValueRowSchema.validate(
        validRow({ unknownField: '999' })
      )
      expect(error).toBeDefined()
    })
  })

  describe('all spend fields individually', () => {
    const spendFields = [
      'fcermGia',
      'localLevy',
      'publicContributions',
      'privateContributions',
      'otherEaContributions',
      'notYetIdentified',
      'assetReplacementAllowance',
      'environmentStatutoryFunding',
      'frequentlyFloodedCommunities',
      'otherAdditionalGrantInAid',
      'otherGovernmentDepartment',
      'recovery',
      'summerEconomicFund',
      'total'
    ]

    it.each(spendFields)('%s accepts a valid digit string', (field) => {
      const { error } = fundingValueRowSchema.validate(
        validRow({ [field]: '12345' })
      )
      expect(error).toBeUndefined()
    })

    it.each(spendFields)('%s accepts null', (field) => {
      const { error } = fundingValueRowSchema.validate(
        validRow({ [field]: null })
      )
      expect(error).toBeUndefined()
    })

    it.each(spendFields)('%s accepts empty string', (field) => {
      const { error } = fundingValueRowSchema.validate(
        validRow({ [field]: '' })
      )
      expect(error).toBeUndefined()
    })
  })
})

// ─── Scenario 4: createFundingValuesSchema ───────────────────────────────────

describe('createFundingValuesSchema', () => {
  describe('array-level validation', () => {
    it('fails for an empty array', () => {
      const schema = createFundingValuesSchema()
      const { error } = schema.validate([])
      expect(error).toBeDefined()
      expect(error.details[0].message).toBe(
        PROJECT_VALIDATION_MESSAGES.FUNDING_SOURCES_ESTIMATED_SPEND_REQUIRED
      )
    })

    it('fails for a non-array', () => {
      const schema = createFundingValuesSchema()
      const { error } = schema.validate('not-an-array')
      expect(error).toBeDefined()
      expect(error.details[0].message).toBe(
        PROJECT_VALIDATION_MESSAGES.FUNDING_SOURCES_ESTIMATED_SPEND_INVALID
      )
    })

    it('accepts an array with a single valid row when no sources selected', () => {
      const schema = createFundingValuesSchema([])
      const { error } = schema.validate([validRow()])
      expect(error).toBeUndefined()
    })

    it('accepts an array with multiple valid rows', () => {
      const schema = createFundingValuesSchema([])
      const { error } = schema.validate([
        validRow({ financialYear: 2025 }),
        validRow({ financialYear: 2026 }),
        validRow({ financialYear: 2027 })
      ])
      expect(error).toBeUndefined()
    })
  })

  describe('per-source coverage validation (selectedSources)', () => {
    it('passes when selected source has a non-zero value in at least one row', () => {
      const schema = createFundingValuesSchema(['fcermGia'])
      const { error } = schema.validate([
        validRow({ financialYear: 2025, fcermGia: '1000' }),
        validRow({ financialYear: 2026, fcermGia: '' })
      ])
      expect(error).toBeUndefined()
    })

    it('passes when selected source has non-zero value in only one of several rows', () => {
      const schema = createFundingValuesSchema(['localLevy'])
      const { error } = schema.validate([
        validRow({ financialYear: 2025, localLevy: '' }),
        validRow({ financialYear: 2026, localLevy: '' }),
        validRow({ financialYear: 2027, localLevy: '50000' })
      ])
      expect(error).toBeUndefined()
    })

    it('fails when selected source has no entry across all rows', () => {
      const schema = createFundingValuesSchema(['fcermGia'])
      const { error } = schema.validate([
        validRow({ financialYear: 2025, fcermGia: '' }),
        validRow({ financialYear: 2026, fcermGia: null })
      ])
      expect(error).toBeDefined()
      expect(error.details[0].message).toBe(
        PROJECT_VALIDATION_MESSAGES.FUNDING_SOURCES_ESTIMATED_SPEND_REQUIRED
      )
    })

    it('fails when selected source is absent (undefined) in all rows', () => {
      const schema = createFundingValuesSchema(['publicContributions'])
      const { error } = schema.validate([
        validRow({ financialYear: 2025 }),
        validRow({ financialYear: 2026 })
      ])
      expect(error).toBeDefined()
      expect(error.details[0].message).toBe(
        PROJECT_VALIDATION_MESSAGES.FUNDING_SOURCES_ESTIMATED_SPEND_REQUIRED
      )
    })

    it('fails for each source that has no entries (reports first failing source)', () => {
      const schema = createFundingValuesSchema(['fcermGia', 'localLevy'])
      const { error } = schema.validate([validRow({ financialYear: 2025 })])
      expect(error).toBeDefined()
      expect(error.details[0].message).toBe(
        PROJECT_VALIDATION_MESSAGES.FUNDING_SOURCES_ESTIMATED_SPEND_REQUIRED
      )
    })

    it('passes when multiple selected sources all have at least one non-zero entry', () => {
      const schema = createFundingValuesSchema([
        'fcermGia',
        'localLevy',
        'publicContributions'
      ])
      const { error } = schema.validate([
        validRow({
          financialYear: 2025,
          fcermGia: '100000',
          localLevy: '5000',
          publicContributions: '25000'
        })
      ])
      expect(error).toBeUndefined()
    })

    it('fails when all entries for a selected source are zero', () => {
      const schema = createFundingValuesSchema(['recovery'])
      const { error } = schema.validate([
        validRow({ recovery: '0' }),
        validRow({ financialYear: 2026, recovery: '0' })
      ])
      expect(error).toBeDefined()
      expect(error.details[0].message).toBe(
        PROJECT_VALIDATION_MESSAGES.FUNDING_SOURCES_ESTIMATED_SPEND_REQUIRED
      )
    })

    it('passes when at least one entry for a selected source is non-zero', () => {
      const schema = createFundingValuesSchema(['recovery'])
      const { error } = schema.validate([
        validRow({ recovery: '0' }),
        validRow({ financialYear: 2026, recovery: '1000' })
      ])
      expect(error).toBeUndefined()
    })

    it('does not enforce coverage for non-selected sources', () => {
      // localLevy not in selectedSources, so no entries needed
      const schema = createFundingValuesSchema(['fcermGia'])
      const { error } = schema.validate([
        validRow({ financialYear: 2025, fcermGia: '5000' })
      ])
      expect(error).toBeUndefined()
    })
  })

  describe('row-level validation within the array', () => {
    it('fails when a row has an invalid spend value', () => {
      const schema = createFundingValuesSchema([])
      const { error } = schema.validate([
        validRow({ fcermGia: 'not-a-number' })
      ])
      expect(error).toBeDefined()
      expect(error.details[0].message).toBe(
        PROJECT_VALIDATION_MESSAGES.FUNDING_SOURCES_ESTIMATED_SPEND_INVALID
      )
    })

    it('fails when a row has a spend value exceeding 18 digits', () => {
      const schema = createFundingValuesSchema([])
      const { error } = schema.validate([
        validRow({ localLevy: '1'.repeat(19) })
      ])
      expect(error).toBeDefined()
      expect(error.details[0].message).toBe(
        PROJECT_VALIDATION_MESSAGES.FUNDING_SOURCES_ESTIMATED_SPEND_MAX_DIGITS
      )
    })

    it('fails when a row has a missing financialYear', () => {
      const schema = createFundingValuesSchema([])
      const { error } = schema.validate([{ fcermGia: '100' }])
      expect(error).toBeDefined()
      expect(error.details[0].message).toBe(
        PROJECT_VALIDATION_MESSAGES.FUNDING_SOURCES_ESTIMATED_SPEND_REQUIRED
      )
    })
  })
})
