/**
 * ProjectFundingContributorsService
 *
 * Handles funding contributors persistence and cleanup.
 * Extracted from ProjectFundingSourcesService to keep file sizes within SonarQube limits.
 */

import { ProjectFundingContributorsSyncService } from './project-funding-contributors-sync-service.js'

export class ProjectFundingContributorsService {
  constructor(prisma, logger) {
    this.prisma = prisma
    this.logger = logger
    this._syncService = new ProjectFundingContributorsSyncService(
      prisma,
      logger
    )
  }

  /**
   * Resolve project ID from reference number
   * @private
   */
  async _getProjectIdByReference(referenceNumber) {
    const project = await this.prisma.pafs_core_projects.findFirst({
      where: { reference_number: referenceNumber },
      select: { id: true }
    })

    if (!project) {
      throw new Error(
        `Project not found with reference number: ${referenceNumber}`
      )
    }

    return Number(project.id)
  }

  /**
   * Upsert funding contributor record
   * @param {Object} data - Funding contributor data
   * @param {string} data.referenceNumber - Project reference number
   * @param {number} data.financialYear - Financial year to which this contributor applies
   * @param {string} data.contributorType - Type of contributor (e.g., 'partner_funding', 'recovery_fund')
   * @param {string} data.name - Name of contributor
   * @param {string|number} data.amount - Amount contributed
   * @returns {Promise<Object>} Created or updated contributor record
   */
  async upsertFundingContributor({
    referenceNumber,
    financialYear,
    contributorType,
    name,
    amount
  }) {
    try {
      const projectId = await this._getProjectIdByReference(referenceNumber)

      // Get the funding value for this financial year
      const fundingValue = await this.prisma.pafs_core_funding_values.findFirst(
        {
          where: {
            project_id: projectId,
            financial_year: financialYear
          },
          select: { id: true }
        }
      )

      if (!fundingValue) {
        throw new Error(
          `Funding value not found for project ${referenceNumber} in financial year ${financialYear}`
        )
      }

      const existingContributor =
        await this.prisma.pafs_core_funding_contributors.findFirst({
          where: {
            funding_value_id: fundingValue.id,
            contributor_type: contributorType,
            name
          }
        })

      let contributor
      if (existingContributor) {
        contributor = await this.prisma.pafs_core_funding_contributors.update({
          where: { id: existingContributor.id },
          data: {
            amount: BigInt(amount),
            updated_at: new Date()
          }
        })
      } else {
        contributor = await this.prisma.pafs_core_funding_contributors.create({
          data: {
            funding_value_id: fundingValue.id,
            contributor_type: contributorType,
            name,
            amount: BigInt(amount),
            created_at: new Date(),
            updated_at: new Date()
          }
        })
      }

      this.logger.info(
        { projectId, financialYear, contributorType, name, referenceNumber },
        'Funding contributor upserted successfully'
      )

      return contributor
    } catch (error) {
      this.logger.error(
        {
          error: error.message,
          referenceNumber,
          financialYear,
          contributorType,
          name
        },
        'Error upserting funding contributor'
      )
      throw error
    }
  }

  /**
   * Delete funding contributor record
   * @param {Object} data - Funding contributor identification data
   * @param {string} data.referenceNumber - Project reference number
   * @param {number} data.financialYear - Financial year
   * @param {string} data.contributorType - Type of contributor to delete
   * @param {string} data.name - Name of contributor to delete
   * @returns {Promise<Object>} Deleted contributor record or null if not found
   */
  async deleteFundingContributor({
    referenceNumber,
    financialYear,
    contributorType,
    name
  }) {
    try {
      const projectId = await this._getProjectIdByReference(referenceNumber)

      // Get the funding value for this financial year
      const fundingValue = await this.prisma.pafs_core_funding_values.findFirst(
        {
          where: {
            project_id: projectId,
            financial_year: financialYear
          },
          select: { id: true }
        }
      )

      if (!fundingValue) {
        this.logger.info(
          { projectId, financialYear, referenceNumber },
          'Funding value not found, cannot delete contributor'
        )
        return null
      }

      const existingContributor =
        await this.prisma.pafs_core_funding_contributors.findFirst({
          where: {
            funding_value_id: fundingValue.id,
            contributor_type: contributorType,
            name
          }
        })

      if (existingContributor) {
        const deletedContributor =
          await this.prisma.pafs_core_funding_contributors.delete({
            where: { id: existingContributor.id }
          })

        this.logger.info(
          {
            projectId,
            financialYear,
            contributorType,
            name,
            referenceNumber
          },
          'Funding contributor deleted successfully'
        )

        return deletedContributor
      }

      this.logger.info(
        {
          projectId,
          financialYear,
          contributorType,
          name,
          referenceNumber
        },
        'Funding contributor not found, nothing to delete'
      )

      return null
    } catch (error) {
      this.logger.error(
        {
          error: error.message,
          referenceNumber,
          financialYear,
          contributorType,
          name
        },
        'Error deleting funding contributor'
      )
      throw error
    }
  }

  /**
   * Delete all funding contributors for a funding value (bulk delete)
   * @param {Object} data - Identification data
   * @param {string} data.referenceNumber - Project reference number
   * @param {number} data.financialYear - Financial year
   * @returns {Promise<number>} Number of contributors deleted
   */
  async deleteAllFundingContributors({ referenceNumber, financialYear }) {
    try {
      const projectId = await this._getProjectIdByReference(referenceNumber)

      // Get the funding value for this financial year
      const fundingValue = await this.prisma.pafs_core_funding_values.findFirst(
        {
          where: {
            project_id: projectId,
            financial_year: financialYear
          },
          select: { id: true }
        }
      )

      if (!fundingValue) {
        this.logger.info(
          { projectId, financialYear, referenceNumber },
          'Funding value not found, no contributors to delete'
        )
        return 0
      }

      const result =
        await this.prisma.pafs_core_funding_contributors.deleteMany({
          where: { funding_value_id: fundingValue.id }
        })

      this.logger.info(
        { projectId, financialYear, referenceNumber, count: result.count },
        'All funding contributors deleted successfully'
      )

      return result.count
    } catch (error) {
      this.logger.error(
        { error: error.message, referenceNumber, financialYear },
        'Error deleting all funding contributors'
      )
      throw error
    }
  }

  /**
   * Delete contributor rows of a specific type whose name is no longer in the
   * provided list, then recalculate the matching amount column and overall
   * total in pafs_core_funding_values for each affected year.
   *
   * Called when the user edits the contributor names list on the
   * public / private / other-EA contributors page.
   *
   * @param {Object} data
   * @param {string} data.referenceNumber - Project reference number
   * @param {string} data.contributorType - e.g. 'public_contributions'
   * @param {string[]} data.currentNames - Names that are still present
   * @returns {Promise<void>}
   */
  /**
   * Apply rename-or-delete for each stale contributor name.
   * Pairs each removed name with an added name (rename in-place) to preserve
   * the stored amount so the estimated-spend page pre-populates correctly.
   * Unpaired removals are true deletions.
   * @private
   */
  async _applyContributorNameChanges({
    fundingValueIds,
    contributorType,
    removed,
    added
  }) {
    for (let i = 0; i < removed.length; i++) {
      const where = {
        funding_value_id: { in: fundingValueIds },
        contributor_type: contributorType,
        name: removed[i]
      }
      if (i < added.length) {
        await this.prisma.pafs_core_funding_contributors.updateMany({
          where,
          data: { name: added[i] }
        })
      } else {
        await this.prisma.pafs_core_funding_contributors.deleteMany({ where })
      }
    }
  }

  async cleanupContributorsByName({
    referenceNumber,
    contributorType,
    currentNames
  }) {
    try {
      const projectId = await this._getProjectIdByReference(referenceNumber)

      const fundingValues = await this.prisma.pafs_core_funding_values.findMany(
        {
          where: { project_id: projectId },
          select: { id: true }
        }
      )

      if (fundingValues.length === 0) {
        return
      }

      const fundingValueIds = fundingValues.map((fv) => fv.id)

      // Remove all contributors when the list has been cleared entirely
      if (currentNames.length === 0) {
        await this.prisma.pafs_core_funding_contributors.deleteMany({
          where: {
            funding_value_id: { in: fundingValueIds },
            contributor_type: contributorType
          }
        })

        this.logger.info(
          { projectId, referenceNumber, contributorType },
          'Cleaned up removed contributors'
        )
        return
      }

      // Determine which names have been added and which removed
      const existingRows =
        await this.prisma.pafs_core_funding_contributors.findMany({
          where: {
            funding_value_id: { in: fundingValueIds },
            contributor_type: contributorType
          },
          select: { name: true },
          distinct: ['name']
        })

      const existingNames = existingRows
        .map((r) => r.name)
        .sort((a, b) => a.localeCompare(b))
      const removed = existingNames
        .filter((n) => !currentNames.includes(n))
        .sort((a, b) => a.localeCompare(b))
      const added = currentNames
        .filter((n) => !existingNames.includes(n))
        .sort((a, b) => a.localeCompare(b))

      await this._applyContributorNameChanges({
        fundingValueIds,
        contributorType,
        removed,
        added
      })

      this.logger.info(
        { projectId, referenceNumber, contributorType, currentNames },
        'Cleaned up removed contributors'
      )
    } catch (error) {
      this.logger.error(
        { error: error.message, referenceNumber, contributorType },
        'Error cleaning up removed contributors'
      )
      throw error
    }
  }

  /**
   * Delete all funding contributors of a specific type across every financial
   * year for a project.  Called when a contributor category is deselected on
   * the funding sources selection page.
   * @param {Object} data
   * @param {string} data.referenceNumber - Project reference number
   * @param {string} data.contributorType - e.g. 'public_contributions'
   * @returns {Promise<number>} Number of rows deleted
   */
  async deleteContributorsByType({ referenceNumber, contributorType }) {
    try {
      const projectId = await this._getProjectIdByReference(referenceNumber)

      // Collect all funding value IDs for this project
      const fundingValues = await this.prisma.pafs_core_funding_values.findMany(
        {
          where: { project_id: projectId },
          select: { id: true }
        }
      )

      const fundingValueIds = fundingValues.map((fv) => fv.id)

      if (fundingValueIds.length === 0) {
        return 0
      }

      const result =
        await this.prisma.pafs_core_funding_contributors.deleteMany({
          where: {
            funding_value_id: { in: fundingValueIds },
            contributor_type: contributorType
          }
        })

      this.logger.info(
        { projectId, referenceNumber, contributorType, count: result.count },
        'Funding contributors deleted by type'
      )

      return result.count
    } catch (error) {
      this.logger.error(
        { error: error.message, referenceNumber, contributorType },
        'Error deleting funding contributors by type'
      )
      throw error
    }
  }

  /**
   * Sync contributor rows for a single financial year.
   * Delegates to ProjectFundingContributorsSyncService.
   */
  async syncFundingContributorsForYear({
    referenceNumber,
    financialYear,
    contributorEntries
  }) {
    return this._syncService.syncFundingContributorsForYear({
      referenceNumber,
      financialYear,
      contributorEntries,
      upsertFn: this.upsertFundingContributor.bind(this)
    })
  }

  /**
   * Ensures funding_value rows exist for each financial year of the project and
   * upserts contributor rows (with null amounts) for new contributor names.
   * Delegates to ProjectFundingContributorsSyncService.
   */
  async ensureContributorFundingRows({
    referenceNumber,
    contributorType,
    contributorNames
  }) {
    return this._syncService.ensureContributorFundingRows({
      referenceNumber,
      contributorType,
      contributorNames
    })
  }
}
