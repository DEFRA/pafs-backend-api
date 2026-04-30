import { PROJECT_VALIDATION_LEVELS } from '../../../common/constants/project.js'

/**
 * Syncs the growthFunding boolean flag with the virtual additionalFcermGia field.
 * When additionalFcermGia is true → growthFunding = true.
 * When additionalFcermGia is false → growthFunding = false.
 *
 * Runs for FUNDING_SOURCES_SELECTED level only.
 */
export const syncGrowthFundingFlag = (enrichedPayload, validationLevel) => {
  if (validationLevel !== PROJECT_VALIDATION_LEVELS.FUNDING_SOURCES_SELECTED) {
    return
  }

  if (enrichedPayload.additionalFcermGia === true) {
    enrichedPayload.growthFunding = true
  } else if (enrichedPayload.additionalFcermGia === false) {
    enrichedPayload.growthFunding = false
  } else {
    // additionalFcermGia is undefined/null – leave growthFunding unchanged
  }
}

/**
 * Clears all additional FCRM GIA boolean flags in the payload and nulls their
 * spend columns in pafs_core_funding_values when additionalFcermGia is deselected.
 *
 * Runs for FUNDING_SOURCES_SELECTED level only.
 */
export const clearDeselectedAdditionalGiaData = async (
  enrichedPayload,
  validationLevel,
  projectService
) => {
  if (validationLevel !== PROJECT_VALIDATION_LEVELS.FUNDING_SOURCES_SELECTED) {
    return
  }

  if (enrichedPayload.additionalFcermGia !== false) {
    return
  }

  const ADDITIONAL_GIA_FIELDS = [
    'assetReplacementAllowance',
    'environmentStatutoryFunding',
    'frequentlyFloodedCommunities',
    'otherAdditionalGrantInAid',
    'otherGovernmentDepartment',
    'recovery',
    'summerEconomicFund'
  ]

  // Null out the boolean flags in pafs_core_projects
  for (const field of ADDITIONAL_GIA_FIELDS) {
    enrichedPayload[field] = null
  }

  // Null out the spend columns in pafs_core_funding_values
  await projectService.nullAdditionalGiaColumns(enrichedPayload.referenceNumber)
}

/**
 * Clears contributor names and deletes all related pafs_core_funding_contributors
 * rows when a contributor type is deselected on the funding sources selection page.
 *
 * Runs for FUNDING_SOURCES_SELECTED level only.
 * For each contributor group (public / private / other EA), if its boolean flag
 * is now false the function:
 *   1. Nulls the corresponding contributor names field in the payload so it is
 *      persisted as NULL in pafs_core_projects.
 *   2. Deletes all pafs_core_funding_contributors rows of that type across every
 *      financial year for this project.
 */
export const clearDeselectedContributorData = async (
  enrichedPayload,
  validationLevel,
  projectService
) => {
  if (validationLevel !== PROJECT_VALIDATION_LEVELS.FUNDING_SOURCES_SELECTED) {
    return
  }

  const { referenceNumber } = enrichedPayload

  const DESELECT_CONFIG = [
    {
      flagField: 'publicContributions',
      namesField: 'publicContributorNames',
      contributorType: 'public_contributions'
    },
    {
      flagField: 'privateContributions',
      namesField: 'privateContributorNames',
      contributorType: 'private_contributions'
    },
    {
      flagField: 'otherEaContributions',
      namesField: 'otherEaContributorNames',
      contributorType: 'other_ea_contributions'
    }
  ]

  for (const { flagField, namesField, contributorType } of DESELECT_CONFIG) {
    if (enrichedPayload[flagField] === false) {
      // Clear the names string in the main projects table
      enrichedPayload[namesField] = null

      // Delete all contributor rows of this type across every financial year
      await projectService.deleteContributorsByType({
        referenceNumber,
        contributorType
      })
    }
  }
}

const CONTRIBUTOR_CLEANUP_CONFIG = [
  {
    level: 'PUBLIC_SECTOR_CONTRIBUTORS',
    namesField: 'publicContributorNames',
    contributorType: 'public_contributions'
  },
  {
    level: 'PRIVATE_SECTOR_CONTRIBUTORS',
    namesField: 'privateContributorNames',
    contributorType: 'private_contributions'
  },
  {
    level: 'OTHER_ENVIRONMENT_AGENCY_CONTRIBUTORS',
    namesField: 'otherEaContributorNames',
    contributorType: 'other_ea_contributions'
  }
]

/**
 * Cleans up contributor rows that have been removed when a user edits the
 * contributor names list on the public / private / other-EA contributors page.
 *
 * Runs only at the PUBLIC_SECTOR_CONTRIBUTORS, PRIVATE_SECTOR_CONTRIBUTORS and
 * OTHER_ENVIRONMENT_AGENCY_CONTRIBUTORS validation levels.
 */
export const cleanupRemovedContributors = async (
  enrichedPayload,
  validationLevel,
  projectService
) => {
  const config = CONTRIBUTOR_CLEANUP_CONFIG.find(
    (c) => c.level === validationLevel
  )

  if (!config) {
    return
  }

  const { referenceNumber } = enrichedPayload
  const namesValue = enrichedPayload[config.namesField]
  const currentNames =
    namesValue && typeof namesValue === 'string' && namesValue.trim()
      ? namesValue
          .split('|||')
          .map((n) => n.trim())
          .filter(Boolean)
      : []

  await projectService.cleanupContributorsByName({
    referenceNumber,
    contributorType: config.contributorType,
    currentNames
  })
}

/**
 * Ensures funding_value rows exist for each financial year of the project and
 * upserts funding_contributor rows (with null amounts) for each contributor name
 * when saving contributor names.
 *
 * Runs only at PUBLIC_SECTOR_CONTRIBUTORS, PRIVATE_SECTOR_CONTRIBUTORS,
 * OTHER_ENVIRONMENT_AGENCY_CONTRIBUTORS validation levels.
 */
export const ensureContributorFundingRows = async (
  enrichedPayload,
  validationLevel,
  projectService
) => {
  const config = CONTRIBUTOR_CLEANUP_CONFIG.find(
    (c) => c.level === validationLevel
  )

  if (!config) {
    return
  }

  const { referenceNumber } = enrichedPayload
  const namesValue = enrichedPayload[config.namesField]
  const currentNames =
    namesValue && typeof namesValue === 'string' && namesValue.trim()
      ? namesValue
          .split('|||')
          .map((n) => n.trim())
          .filter(Boolean)
      : []

  if (!currentNames.length) {
    return
  }

  await projectService.ensureContributorFundingRows({
    referenceNumber,
    contributorType: config.contributorType,
    contributorNames: currentNames
  })
}
