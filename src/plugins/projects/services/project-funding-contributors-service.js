/**
 * ProjectFundingContributorsService
 *
 * Handles funding contributors persistence and cleanup.
 * Extracted from ProjectFundingSourcesService to keep file sizes within SonarQube limits.
 */

import { Prisma } from '@prisma/client'
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

  async getProjectIdByReference(referenceNumber) {
    return this._getProjectIdByReference(referenceNumber)
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
    // Each removed[i] targets a different name — operations are independent, run in parallel
    await Promise.all(
      removed.map((removedName, i) => {
        const where = {
          funding_value_id: { in: fundingValueIds },
          contributor_type: contributorType,
          name: removedName
        }
        return i < added.length
          ? this.prisma.pafs_core_funding_contributors.updateMany({
              where,
              data: { name: added[i] }
            })
          : this.prisma.pafs_core_funding_contributors.deleteMany({ where })
      })
    )
  }

  async cleanupContributorsByName({
    referenceNumber,
    contributorType,
    currentNames,
    projectId: providedProjectId
  }) {
    try {
      const projectId =
        providedProjectId ??
        (await this._getProjectIdByReference(referenceNumber))

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
  async deleteContributorsByType({
    referenceNumber,
    contributorType,
    projectId: providedProjectId
  }) {
    try {
      const projectId =
        providedProjectId ??
        (await this._getProjectIdByReference(referenceNumber))

      // Single DELETE with subquery — avoids the findMany fv_id pre-fetch.
      const count = await this.prisma.$executeRaw(
        Prisma.sql`DELETE FROM pafs_core_funding_contributors
          WHERE contributor_type = ${contributorType}
          AND funding_value_id IN (
            SELECT id FROM pafs_core_funding_values WHERE project_id = ${projectId}
          )`
      )

      this.logger.info(
        { projectId, referenceNumber, contributorType, count },
        'Funding contributors deleted by type'
      )

      return count
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
    contributorEntries,
    projectId,
    fundingValueId
  }) {
    return this._syncService.syncFundingContributorsForYear({
      referenceNumber,
      financialYear,
      contributorEntries,
      upsertFn: this.upsertFundingContributor.bind(this),
      projectId,
      fundingValueId
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
    contributorNames,
    projectId,
    financialStartYear,
    financialEndYear
  }) {
    return this._syncService.ensureContributorFundingRows({
      referenceNumber,
      contributorType,
      contributorNames,
      projectId,
      financialStartYear,
      financialEndYear
    })
  }
}
