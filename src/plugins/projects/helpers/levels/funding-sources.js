import {
  fundingSourcesSelectedSchema,
  additionalFcrmGiaSelectedSchema,
  publicContributorNamesSchema,
  privateContributorNamesSchema,
  otherEaContributorNamesSchema,
  createFundingValuesSchema
} from '../../../../common/schemas/project.js'
import {
  PROJECT_VALIDATION_LEVELS,
  FUNDING_SOURCE_OPTIONS
} from '../../../../common/constants/project.js'

const buildMainFundingSourceFields = (referenceNumber) => ({
  referenceNumber,
  [FUNDING_SOURCE_OPTIONS.FCERM_GIA]: fundingSourcesSelectedSchema.extract(
    FUNDING_SOURCE_OPTIONS.FCERM_GIA
  ),
  [FUNDING_SOURCE_OPTIONS.LOCAL_LEVY]: fundingSourcesSelectedSchema.extract(
    FUNDING_SOURCE_OPTIONS.LOCAL_LEVY
  ),
  [FUNDING_SOURCE_OPTIONS.ADDITIONAL_FCERM_GIA]:
    fundingSourcesSelectedSchema.extract(
      FUNDING_SOURCE_OPTIONS.ADDITIONAL_FCERM_GIA
    ),
  [FUNDING_SOURCE_OPTIONS.PUBLIC_CONTRIBUTIONS]:
    fundingSourcesSelectedSchema.extract(
      FUNDING_SOURCE_OPTIONS.PUBLIC_CONTRIBUTIONS
    ),
  [FUNDING_SOURCE_OPTIONS.PRIVATE_CONTRIBUTIONS]:
    fundingSourcesSelectedSchema.extract(
      FUNDING_SOURCE_OPTIONS.PRIVATE_CONTRIBUTIONS
    ),
  [FUNDING_SOURCE_OPTIONS.OTHER_EA_CONTRIBUTIONS]:
    fundingSourcesSelectedSchema.extract(
      FUNDING_SOURCE_OPTIONS.OTHER_EA_CONTRIBUTIONS
    ),
  [FUNDING_SOURCE_OPTIONS.NOT_YET_IDENTIFIED]:
    fundingSourcesSelectedSchema.extract(
      FUNDING_SOURCE_OPTIONS.NOT_YET_IDENTIFIED
    )
})

const buildAdditionalGiaFields = (referenceNumber) => ({
  referenceNumber,
  [FUNDING_SOURCE_OPTIONS.ASSET_REPLACEMENT_ALLOWANCE]:
    additionalFcrmGiaSelectedSchema.extract(
      FUNDING_SOURCE_OPTIONS.ASSET_REPLACEMENT_ALLOWANCE
    ),
  [FUNDING_SOURCE_OPTIONS.ENVIRONMENT_STATUTORY_FUNDING]:
    additionalFcrmGiaSelectedSchema.extract(
      FUNDING_SOURCE_OPTIONS.ENVIRONMENT_STATUTORY_FUNDING
    ),
  [FUNDING_SOURCE_OPTIONS.FREQUENTLY_FLOODED_COMMUNITIES]:
    additionalFcrmGiaSelectedSchema.extract(
      FUNDING_SOURCE_OPTIONS.FREQUENTLY_FLOODED_COMMUNITIES
    ),
  [FUNDING_SOURCE_OPTIONS.OTHER_ADDITIONAL_GRANT_IN_AID]:
    additionalFcrmGiaSelectedSchema.extract(
      FUNDING_SOURCE_OPTIONS.OTHER_ADDITIONAL_GRANT_IN_AID
    ),
  [FUNDING_SOURCE_OPTIONS.OTHER_GOVERNMENT_DEPARTMENT]:
    additionalFcrmGiaSelectedSchema.extract(
      FUNDING_SOURCE_OPTIONS.OTHER_GOVERNMENT_DEPARTMENT
    ),
  [FUNDING_SOURCE_OPTIONS.RECOVERY]: additionalFcrmGiaSelectedSchema.extract(
    FUNDING_SOURCE_OPTIONS.RECOVERY
  ),
  [FUNDING_SOURCE_OPTIONS.SUMMER_ECONOMIC_FUND]:
    additionalFcrmGiaSelectedSchema.extract(
      FUNDING_SOURCE_OPTIONS.SUMMER_ECONOMIC_FUND
    )
})

const buildContributorFields = (
  referenceNumber,
  contributorField,
  contributorSchema
) => ({
  referenceNumber,
  [contributorField]: contributorSchema
})

const createLevel = (name, fields) => ({
  name,
  fields
})

export const fundingSourceLevels = (referenceNumber) => ({
  /**
   * Main funding source selection
   */
  [PROJECT_VALIDATION_LEVELS.FUNDING_SOURCES_SELECTED]: createLevel(
    PROJECT_VALIDATION_LEVELS.FUNDING_SOURCES_SELECTED,
    buildMainFundingSourceFields(referenceNumber)
  ),

  /**
   * Additional FCRM Grant-in-Aid sub-option selection
   */
  [PROJECT_VALIDATION_LEVELS.ADDITIONAL_FUNDING_SOURCES_GIA_SELECTED]:
    createLevel(
      PROJECT_VALIDATION_LEVELS.ADDITIONAL_FUNDING_SOURCES_GIA_SELECTED,
      buildAdditionalGiaFields(referenceNumber)
    ),

  /**
   * Public sector contributor names
   */
  [PROJECT_VALIDATION_LEVELS.PUBLIC_SECTOR_CONTRIBUTORS]: createLevel(
    PROJECT_VALIDATION_LEVELS.PUBLIC_SECTOR_CONTRIBUTORS,
    buildContributorFields(
      referenceNumber,
      'publicContributorNames',
      publicContributorNamesSchema
    )
  ),

  /**
   * Private sector contributor names
   */
  [PROJECT_VALIDATION_LEVELS.PRIVATE_SECTOR_CONTRIBUTORS]: createLevel(
    PROJECT_VALIDATION_LEVELS.PRIVATE_SECTOR_CONTRIBUTORS,
    buildContributorFields(
      referenceNumber,
      'privateContributorNames',
      privateContributorNamesSchema
    )
  ),

  /**
   * Other Environment Agency contributor names
   */
  [PROJECT_VALIDATION_LEVELS.OTHER_ENVIRONMENT_AGENCY_CONTRIBUTORS]:
    createLevel(
      PROJECT_VALIDATION_LEVELS.OTHER_ENVIRONMENT_AGENCY_CONTRIBUTORS,
      buildContributorFields(
        referenceNumber,
        'otherEaContributorNames',
        otherEaContributorNamesSchema
      )
    ),

  /**
   * Funding source estimated spend per financial year.
   */
  [PROJECT_VALIDATION_LEVELS.FUNDING_SOURCES_ESTIMATED_SPEND]: createLevel(
    PROJECT_VALIDATION_LEVELS.FUNDING_SOURCES_ESTIMATED_SPEND,
    {
      referenceNumber,
      fundingValues: createFundingValuesSchema()
    }
  )
})
