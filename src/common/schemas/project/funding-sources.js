import Joi from 'joi'
import {
  PROJECT_VALIDATION_MESSAGES,
  FUNDING_SOURCE_OPTIONS
} from '../../constants/project.js'

const MAX_DIGITS = 18
const DIGITS_ONLY_REGEX = /^\d+$/

/**
 * Main funding source checkbox fields
 *
 * 'additionalFcrmGia' is a virtual field with no direct DB column; it signals
 * that the user ticked "Additional FCRM Grant in Aid" on the UI, which routes
 * them to the additional sub-options page
 */
export const MAIN_FUNDING_SOURCE_FIELDS = [
  FUNDING_SOURCE_OPTIONS.FCERM_GIA,
  FUNDING_SOURCE_OPTIONS.LOCAL_LEVY,
  FUNDING_SOURCE_OPTIONS.ADDITIONAL_FCERM_GIA,
  FUNDING_SOURCE_OPTIONS.PUBLIC_CONTRIBUTIONS,
  FUNDING_SOURCE_OPTIONS.PRIVATE_CONTRIBUTIONS,
  FUNDING_SOURCE_OPTIONS.OTHER_EA_CONTRIBUTIONS,
  FUNDING_SOURCE_OPTIONS.NOT_YET_IDENTIFIED
]

/**
 * Additional FCRM Grant-in-Aid sub-option fields
 */
export const ADDITIONAL_GIA_FUNDING_SOURCE_FIELDS = [
  FUNDING_SOURCE_OPTIONS.ASSET_REPLACEMENT_ALLOWANCE,
  FUNDING_SOURCE_OPTIONS.ENVIRONMENT_STATUTORY_FUNDING,
  FUNDING_SOURCE_OPTIONS.FREQUENTLY_FLOODED_COMMUNITIES,
  FUNDING_SOURCE_OPTIONS.OTHER_ADDITIONAL_GRANT_IN_AID,
  FUNDING_SOURCE_OPTIONS.OTHER_GOVERNMENT_DEPARTMENT,
  FUNDING_SOURCE_OPTIONS.RECOVERY,
  FUNDING_SOURCE_OPTIONS.SUMMER_ECONOMIC_FUND
]

/**
 * All funding source spend fields used in estimated spend per
 * financial year. Combines the 6 DB-backed main sources (excludes the virtual
 * additionalFcrmGia) and the 7 additional GIA sub-sources
 */
export const SPENDING_FUNDING_SOURCE_FIELDS = [
  FUNDING_SOURCE_OPTIONS.FCERM_GIA,
  FUNDING_SOURCE_OPTIONS.LOCAL_LEVY,
  FUNDING_SOURCE_OPTIONS.PUBLIC_CONTRIBUTIONS,
  FUNDING_SOURCE_OPTIONS.PRIVATE_CONTRIBUTIONS,
  FUNDING_SOURCE_OPTIONS.OTHER_EA_CONTRIBUTIONS,
  FUNDING_SOURCE_OPTIONS.NOT_YET_IDENTIFIED,
  ...ADDITIONAL_GIA_FUNDING_SOURCE_FIELDS
]

/**
 * Validates a spend value: must be digits-only and at most MAX_DIGITS chars.
 */
const validateSpendString = (value, helpers) => {
  if (!DIGITS_ONLY_REGEX.test(value)) {
    return helpers.error('string.pattern.base')
  }
  if (value.length > MAX_DIGITS) {
    return helpers.error('string.max')
  }
  return value
}

/**
 * Creates a strictly-typed required boolean schema for a funding source checkbox
 */
const createFundingSourceBoolSchema = (invalidMessage) =>
  Joi.boolean().strict().required().messages({
    'boolean.base': invalidMessage,
    'any.required': invalidMessage
  })

/**
 * Creates an optional spend value schema.
 * Accepts a digits-only string of up to MAX_DIGITS characters, or null / ''.
 */
const createOptionalSpendSchema = (label) =>
  Joi.string()
    .trim()
    .allow(null, '')
    .optional()
    .custom((value, helpers) => validateSpendString(value, helpers))
    .label(label)
    .messages({
      'string.base':
        PROJECT_VALIDATION_MESSAGES.FUNDING_SOURCES_ESTIMATED_SPEND_INVALID,
      'string.pattern.base':
        PROJECT_VALIDATION_MESSAGES.FUNDING_SOURCES_ESTIMATED_SPEND_INVALID,
      'string.max':
        PROJECT_VALIDATION_MESSAGES.FUNDING_SOURCES_ESTIMATED_SPEND_MAX_DIGITS
    })

const CONTRIBUTOR_TYPE_VALUES = [
  'public_contributions',
  'private_contributions',
  'other_ea_contributions'
]

const createContributorAmountSchema = () =>
  Joi.string()
    .trim()
    .required()
    .custom((value, helpers) => validateSpendString(value, helpers))
    .messages({
      'string.base':
        PROJECT_VALIDATION_MESSAGES.FUNDING_SOURCES_ESTIMATED_SPEND_INVALID,
      'string.empty':
        PROJECT_VALIDATION_MESSAGES.FUNDING_SOURCES_ESTIMATED_SPEND_REQUIRED,
      'any.required':
        PROJECT_VALIDATION_MESSAGES.FUNDING_SOURCES_ESTIMATED_SPEND_REQUIRED,
      'string.pattern.base':
        PROJECT_VALIDATION_MESSAGES.FUNDING_SOURCES_ESTIMATED_SPEND_INVALID,
      'string.max':
        PROJECT_VALIDATION_MESSAGES.FUNDING_SOURCES_ESTIMATED_SPEND_MAX_DIGITS
    })

const fundingContributorSchema = Joi.object({
  name: Joi.string().trim().min(1).required().messages({
    'string.base':
      PROJECT_VALIDATION_MESSAGES.FUNDING_SOURCES_ESTIMATED_SPEND_INVALID,
    'string.empty':
      PROJECT_VALIDATION_MESSAGES.FUNDING_SOURCES_ESTIMATED_SPEND_REQUIRED,
    'any.required':
      PROJECT_VALIDATION_MESSAGES.FUNDING_SOURCES_ESTIMATED_SPEND_REQUIRED
  }),
  contributorType: Joi.string()
    .valid(...CONTRIBUTOR_TYPE_VALUES)
    .required()
    .messages({
      'string.base':
        PROJECT_VALIDATION_MESSAGES.FUNDING_SOURCES_ESTIMATED_SPEND_INVALID,
      'any.only':
        PROJECT_VALIDATION_MESSAGES.FUNDING_SOURCES_ESTIMATED_SPEND_INVALID,
      'any.required':
        PROJECT_VALIDATION_MESSAGES.FUNDING_SOURCES_ESTIMATED_SPEND_REQUIRED
    }),
  amount: createContributorAmountSchema(),
  secured: Joi.boolean().optional(),
  constrained: Joi.boolean().optional()
}).options({ allowUnknown: false })

const createContributorsArraySchema = (contributorType) =>
  Joi.array()
    .items(
      fundingContributorSchema.keys({
        contributorType: Joi.string()
          .valid(contributorType)
          .required()
          .messages({
            'string.base':
              PROJECT_VALIDATION_MESSAGES.FUNDING_SOURCES_ESTIMATED_SPEND_INVALID,
            'any.only':
              PROJECT_VALIDATION_MESSAGES.FUNDING_SOURCES_ESTIMATED_SPEND_INVALID,
            'any.required':
              PROJECT_VALIDATION_MESSAGES.FUNDING_SOURCES_ESTIMATED_SPEND_REQUIRED
          })
      })
    )
    .optional()

/**
 * Creates a contributor names schema.
 * Accepts a non-empty trimmed string; multiple contributors may be
 * comma-separated (e.g. "Org A, Org B").
 * Rejects duplicate names (case-insensitive) within the same string.
 */
const createContributorNamesSchema = (
  label,
  requiredMessage,
  invalidMessage,
  duplicateMessage
) =>
  Joi.string()
    .trim()
    .min(1)
    .required()
    .label(label)
    .custom((value, helpers) => {
      const names = value
        .split(',')
        .map((n) => n.trim().toLowerCase())
        .filter(Boolean)
      const seen = new Set()
      for (const name of names) {
        if (seen.has(name)) {
          return helpers.error('string.duplicate')
        }
        seen.add(name)
      }
      return value
    })
    .messages({
      'string.base': invalidMessage,
      'string.empty': requiredMessage,
      'string.min': requiredMessage,
      'any.required': requiredMessage,
      'string.duplicate': duplicateMessage
    })

/**
 * Validates the 7 main funding source checkboxes.
 *
 * All fields are required and must be booleans. At least one must be true,
 * otherwise the submission is invalid (no funding source selected).
 *
 * 'additionalFcrmGia' has no DB column
 */
const fundingSourceBoolSchema = createFundingSourceBoolSchema(
  PROJECT_VALIDATION_MESSAGES.FUNDING_SOURCES_SELECTED_INVALID
)

export const fundingSourcesSelectedSchema = Joi.object(
  Object.fromEntries(
    MAIN_FUNDING_SOURCE_FIELDS.map((field) => [field, fundingSourceBoolSchema])
  )
)
  .custom((value, helpers) => {
    const hasAnyTrue = MAIN_FUNDING_SOURCE_FIELDS.some(
      (field) => value[field] === true
    )
    if (!hasAnyTrue) {
      return helpers.error('object.atLeastOneRequired')
    }
    return value
  })
  .messages({
    'object.atLeastOneRequired':
      PROJECT_VALIDATION_MESSAGES.FUNDING_SOURCES_SELECTED_REQUIRED
  })
  .options({ allowUnknown: true })

/**
 * Validates the 7 Additional FCRM Grant-in-Aid sub-option checkboxes.
 *
 * All fields are required and must be booleans. At least one must be true,
 * Only applicable when 'additionalFcrmGia' was true
 */
const additionalGiaBoolSchema = createFundingSourceBoolSchema(
  PROJECT_VALIDATION_MESSAGES.ADDITIONAL_FUNDING_SOURCES_GIA_SELECTED_INVALID
)

export const additionalFcrmGiaSelectedSchema = Joi.object(
  Object.fromEntries(
    ADDITIONAL_GIA_FUNDING_SOURCE_FIELDS.map((field) => [
      field,
      additionalGiaBoolSchema
    ])
  )
)
  .custom((value, helpers) => {
    const hasAnyTrue = ADDITIONAL_GIA_FUNDING_SOURCE_FIELDS.some(
      (field) => value[field] === true
    )
    if (!hasAnyTrue) {
      return helpers.error('object.atLeastOneRequired')
    }
    return value
  })
  .messages({
    'object.atLeastOneRequired':
      PROJECT_VALIDATION_MESSAGES.ADDITIONAL_FUNDING_SOURCES_GIA_SELECTED_REQUIRED
  })
  .options({ allowUnknown: true })

/**
 * Validates the public sector contributor names
 * Multiple contributors must be comma-separated in a single string
 */
export const publicContributorNamesSchema = createContributorNamesSchema(
  FUNDING_SOURCE_OPTIONS.PUBLIC_CONTRIBUTIONS,
  PROJECT_VALIDATION_MESSAGES.PUBLIC_SECTOR_CONTRIBUTORS_REQUIRED,
  PROJECT_VALIDATION_MESSAGES.PUBLIC_SECTOR_CONTRIBUTORS_INVALID,
  PROJECT_VALIDATION_MESSAGES.PUBLIC_SECTOR_CONTRIBUTORS_DUPLICATE
)

/**
 * Validates the private sector contributor names
 */
export const privateContributorNamesSchema = createContributorNamesSchema(
  FUNDING_SOURCE_OPTIONS.PRIVATE_CONTRIBUTIONS,
  PROJECT_VALIDATION_MESSAGES.PRIVATE_SECTOR_CONTRIBUTORS_REQUIRED,
  PROJECT_VALIDATION_MESSAGES.PRIVATE_SECTOR_CONTRIBUTORS_INVALID,
  PROJECT_VALIDATION_MESSAGES.PRIVATE_SECTOR_CONTRIBUTORS_DUPLICATE
)

/**
 * Validates the other Environment Agency contributor names
 */
export const otherEaContributorNamesSchema = createContributorNamesSchema(
  FUNDING_SOURCE_OPTIONS.OTHER_EA_CONTRIBUTIONS,
  PROJECT_VALIDATION_MESSAGES.OTHER_ENVIRONMENT_AGENCY_CONTRIBUTORS_REQUIRED,
  PROJECT_VALIDATION_MESSAGES.OTHER_ENVIRONMENT_AGENCY_CONTRIBUTORS_INVALID,
  PROJECT_VALIDATION_MESSAGES.OTHER_ENVIRONMENT_AGENCY_CONTRIBUTORS_DUPLICATE
)

/**
 * Schema for a single financial year funding values row.
 *
 * - financialYear is required (integer).
 * - Every source spend field is optional (null / '' means no spend that year).
 * - Spend values must be digits-only strings of at most 18 characters; 0 is valid.
 * - Negative values are rejected (no minus sign allowed by the digits-only regex).
 * - Unknown keys are rejected to prevent silent data loss.
 */
export const fundingValueRowSchema = Joi.object({
  financialYear: Joi.number().integer().required().messages({
    'number.base':
      PROJECT_VALIDATION_MESSAGES.FUNDING_SOURCES_ESTIMATED_SPEND_INVALID,
    'number.integer':
      PROJECT_VALIDATION_MESSAGES.FUNDING_SOURCES_ESTIMATED_SPEND_INVALID,
    'any.required':
      PROJECT_VALIDATION_MESSAGES.FUNDING_SOURCES_ESTIMATED_SPEND_REQUIRED
  }),

  // Main sources
  fcermGia: createOptionalSpendSchema(FUNDING_SOURCE_OPTIONS.FCERM_GIA),
  localLevy: createOptionalSpendSchema(FUNDING_SOURCE_OPTIONS.LOCAL_LEVY),
  publicContributions: createOptionalSpendSchema(
    FUNDING_SOURCE_OPTIONS.PUBLIC_CONTRIBUTIONS
  ),
  privateContributions: createOptionalSpendSchema(
    FUNDING_SOURCE_OPTIONS.PRIVATE_CONTRIBUTIONS
  ),
  otherEaContributions: createOptionalSpendSchema(
    FUNDING_SOURCE_OPTIONS.OTHER_EA_CONTRIBUTIONS
  ),
  notYetIdentified: createOptionalSpendSchema(
    FUNDING_SOURCE_OPTIONS.NOT_YET_IDENTIFIED
  ),

  // Additional FCRM GIA sub-sources
  assetReplacementAllowance: createOptionalSpendSchema(
    FUNDING_SOURCE_OPTIONS.ASSET_REPLACEMENT_ALLOWANCE
  ),
  environmentStatutoryFunding: createOptionalSpendSchema(
    FUNDING_SOURCE_OPTIONS.ENVIRONMENT_STATUTORY_FUNDING
  ),
  frequentlyFloodedCommunities: createOptionalSpendSchema(
    FUNDING_SOURCE_OPTIONS.FREQUENTLY_FLOODED_COMMUNITIES
  ),
  otherAdditionalGrantInAid: createOptionalSpendSchema(
    FUNDING_SOURCE_OPTIONS.OTHER_ADDITIONAL_GRANT_IN_AID
  ),
  otherGovernmentDepartment: createOptionalSpendSchema(
    FUNDING_SOURCE_OPTIONS.OTHER_GOVERNMENT_DEPARTMENT
  ),
  recovery: createOptionalSpendSchema(FUNDING_SOURCE_OPTIONS.RECOVERY),
  summerEconomicFund: createOptionalSpendSchema(
    FUNDING_SOURCE_OPTIONS.SUMMER_ECONOMIC_FUND
  ),

  // Contributor-level breakdown for each financial year
  publicContributors: createContributorsArraySchema('public_contributions'),
  privateContributors: createContributorsArraySchema('private_contributions'),
  otherEaContributors: createContributorsArraySchema('other_ea_contributions'),

  // Financial year total (calculated by caller; validated as a spend string)
  total: createOptionalSpendSchema('fundingSourceSpendingTotal')
}).options({ allowUnknown: false })

/**
 * Creates a funding values array schema that validates per-source coverage.
 */
export const createFundingValuesSchema = (selectedSources = []) =>
  Joi.array()
    .items(fundingValueRowSchema)
    .min(1)
    .required()
    .custom((rows, helpers) => {
      for (const source of selectedSources) {
        const hasAtLeastOneEntry = rows.some(
          (row) =>
            row[source] !== null &&
            row[source] !== undefined &&
            row[source] !== ''
        )
        if (!hasAtLeastOneEntry) {
          return helpers.error('array.sourceRequiresValue', { source })
        }
      }
      return rows
    })
    .messages({
      'array.min':
        PROJECT_VALIDATION_MESSAGES.FUNDING_SOURCES_ESTIMATED_SPEND_REQUIRED,
      'array.base':
        PROJECT_VALIDATION_MESSAGES.FUNDING_SOURCES_ESTIMATED_SPEND_INVALID,
      'array.sourceRequiresValue':
        PROJECT_VALIDATION_MESSAGES.FUNDING_SOURCES_ESTIMATED_SPEND_REQUIRED
    })
