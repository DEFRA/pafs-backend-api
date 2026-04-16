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

export const fundingSourceLevels = (referenceNumber) => ({
  /**
   * Main funding source selection
   */
  [PROJECT_VALIDATION_LEVELS.FUNDING_SOURCES_SELECTED]: {
    name: PROJECT_VALIDATION_LEVELS.FUNDING_SOURCES_SELECTED,
    fields: {
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
    }
  },

  /**
   * Additional FCRM Grant-in-Aid sub-option selection
   */
  [PROJECT_VALIDATION_LEVELS.ADDITIONAL_FUNDING_SOURCES_GIA_SELECTED]: {
    name: PROJECT_VALIDATION_LEVELS.ADDITIONAL_FUNDING_SOURCES_GIA_SELECTED,
    fields: {
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
      [FUNDING_SOURCE_OPTIONS.RECOVERY]:
        additionalFcrmGiaSelectedSchema.extract(
          FUNDING_SOURCE_OPTIONS.RECOVERY
        ),
      [FUNDING_SOURCE_OPTIONS.SUMMER_ECONOMIC_FUND]:
        additionalFcrmGiaSelectedSchema.extract(
          FUNDING_SOURCE_OPTIONS.SUMMER_ECONOMIC_FUND
        )
    }
  },

  /**
   * Public sector contributor names
   */
  [PROJECT_VALIDATION_LEVELS.PUBLIC_SECTOR_CONTRIBUTORS]: {
    name: PROJECT_VALIDATION_LEVELS.PUBLIC_SECTOR_CONTRIBUTORS,
    fields: {
      referenceNumber,
      publicContributorNames: publicContributorNamesSchema
    }
  },

  /**
   * Private sector contributor names
   */
  [PROJECT_VALIDATION_LEVELS.PRIVATE_SECTOR_CONTRIBUTORS]: {
    name: PROJECT_VALIDATION_LEVELS.PRIVATE_SECTOR_CONTRIBUTORS,
    fields: {
      referenceNumber,
      privateContributorNames: privateContributorNamesSchema
    }
  },

  /**
   * Other Environment Agency contributor names
   */
  [PROJECT_VALIDATION_LEVELS.OTHER_ENVIRONMENT_AGENCY_CONTRIBUTORS]: {
    name: PROJECT_VALIDATION_LEVELS.OTHER_ENVIRONMENT_AGENCY_CONTRIBUTORS,
    fields: {
      referenceNumber,
      otherEaContributorNames: otherEaContributorNamesSchema
    }
  },

  /**
   * Funding source estimated spend per financial year.
   */
  [PROJECT_VALIDATION_LEVELS.FUNDING_SOURCES_ESTIMATED_SPEND]: {
    name: PROJECT_VALIDATION_LEVELS.FUNDING_SOURCES_ESTIMATED_SPEND,
    fields: {
      referenceNumber,
      fundingValues: createFundingValuesSchema()
    }
  }
})
