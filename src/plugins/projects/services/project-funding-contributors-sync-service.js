/**
 * ProjectFundingContributorsSyncService
 *
 * Handles contributor syncing and ensuring funding rows exist.
 * Extracted from ProjectFundingContributorsService to keep file sizes within SonarQube limits.
 */

export class ProjectFundingContributorsSyncService {
  constructor(prisma, logger) {
    this.prisma = prisma
    this.logger = logger
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
   * Upsert all desired contributor entries for a year.
   * @private
   */
  async _upsertDesiredContributors(
    desiredEntries,
    referenceNumber,
    financialYear,
    upsertFn
  ) {
    for (const contributor of desiredEntries) {
      await upsertFn({
        referenceNumber,
        financialYear,
        contributorType: contributor.contributorType,
        name: contributor.name,
        amount: contributor.amount
      })
    }
  }

  /**
   * Delete stale contributor rows that are no longer in the desired set.
   * @private
   * @returns {Promise<number>} Number of deleted rows
   */
  async _deleteStaleContributors(desiredEntries, fundingValueId) {
    const desiredKeys = new Set(
      desiredEntries.map((c) => `${c.contributorType}::${c.name}`)
    )

    const existingContributors =
      await this.prisma.pafs_core_funding_contributors.findMany({
        where: { funding_value_id: fundingValueId },
        select: {
          id: true,
          contributor_type: true,
          name: true
        }
      })

    const staleIds = existingContributors
      .filter((c) => !desiredKeys.has(`${c.contributor_type}::${c.name}`))
      .map((c) => c.id)

    if (staleIds.length > 0) {
      await this.prisma.pafs_core_funding_contributors.deleteMany({
        where: {
          funding_value_id: fundingValueId,
          id: { in: staleIds }
        }
      })
    }

    return staleIds.length
  }

  /**
   * Sync contributor rows for a single financial year without resetting
   * legacy secured/constrained values.
   *
   * Behaviour:
   * - Existing matching rows (same type + name) are updated for amount only
   * - Missing rows are created (secured/constrained left to DB defaults)
   * - Stale rows not present in contributorEntries are deleted
   *
   * @param {Object} data
   * @param {string} data.referenceNumber
   * @param {number} data.financialYear
   * @param {Array<{name:string, contributorType:string, amount:string|number}>} data.contributorEntries
   * @param {Function} upsertFn - The upsertFundingContributor method reference
   */
  async syncFundingContributorsForYear({
    referenceNumber,
    financialYear,
    contributorEntries,
    upsertFn
  }) {
    try {
      const projectId = await this._getProjectIdByReference(referenceNumber)

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
          'Funding value not found, cannot sync contributors'
        )
        return
      }

      const desiredEntries = Array.isArray(contributorEntries)
        ? contributorEntries.filter(
            (c) =>
              c?.name &&
              c?.contributorType &&
              c?.amount !== null &&
              c?.amount !== undefined &&
              c?.amount !== ''
          )
        : []

      await this._upsertDesiredContributors(
        desiredEntries,
        referenceNumber,
        financialYear,
        upsertFn
      )

      const deletedCount = await this._deleteStaleContributors(
        desiredEntries,
        fundingValue.id
      )

      this.logger.info(
        {
          projectId,
          financialYear,
          referenceNumber,
          desiredCount: desiredEntries.length,
          deletedCount
        },
        'Funding contributors synced successfully for year'
      )
    } catch (error) {
      this.logger.error(
        {
          error: error.message,
          referenceNumber,
          financialYear
        },
        'Error syncing funding contributors for year'
      )
      throw error
    }
  }

  /**
   * Ensure a funding_value row exists for the given project and year.
   * @private
   */
  async _ensureFundingValueRow(projectId, year) {
    const existing = await this.prisma.pafs_core_funding_values.findFirst({
      where: { project_id: projectId, financial_year: year },
      select: { id: true }
    })

    if (existing) {
      return existing
    }

    return this.prisma.pafs_core_funding_values.create({
      data: {
        project_id: projectId,
        financial_year: year,
        total: 0n
      }
    })
  }

  /**
   * Create a contributor row if one does not already exist for the given
   * funding value, name and type.
   * @private
   */
  async _createContributorIfMissing(fundingValueId, name, contributorType) {
    const existing = await this.prisma.pafs_core_funding_contributors.findFirst(
      {
        where: {
          funding_value_id: fundingValueId,
          name,
          contributor_type: contributorType
        },
        select: { id: true }
      }
    )

    if (existing) {
      return
    }

    await this.prisma.pafs_core_funding_contributors.create({
      data: {
        funding_value_id: fundingValueId,
        name,
        contributor_type: contributorType,
        amount: null,
        created_at: new Date(),
        updated_at: new Date()
      }
    })
  }

  /**
   * Ensures funding_value rows exist for each financial year of the project and
   * upserts contributor rows (with null amounts) for new contributor names.
   * Existing contributors with amounts are preserved (rename-in-place is handled
   * by cleanupContributorsByName).
   *
   * @param {Object} data
   * @param {string} data.referenceNumber - Project reference number
   * @param {string} data.contributorType - e.g. 'public_contributions'
   * @param {string[]} data.contributorNames - Array of contributor names
   */
  async ensureContributorFundingRows({
    referenceNumber,
    contributorType,
    contributorNames
  }) {
    try {
      const projectId = await this._getProjectIdByReference(referenceNumber)

      // Get the project's financial year range
      const project = await this.prisma.pafs_core_projects.findFirst({
        where: { id: projectId },
        select: {
          earliest_start_year: true,
          project_end_financial_year: true
        }
      })

      if (
        !project?.earliest_start_year ||
        !project?.project_end_financial_year
      ) {
        this.logger.info(
          { referenceNumber },
          'Project has no financial year range, skipping contributor funding rows'
        )
        return
      }

      const startYear = project.earliest_start_year
      const endYear = project.project_end_financial_year

      for (let year = startYear; year <= endYear; year++) {
        const fundingValue = await this._ensureFundingValueRow(projectId, year)

        for (const name of contributorNames) {
          await this._createContributorIfMissing(
            fundingValue.id,
            name,
            contributorType
          )
        }
      }

      this.logger.info(
        {
          referenceNumber,
          contributorType,
          nameCount: contributorNames.length
        },
        'Contributor funding rows ensured successfully'
      )
    } catch (error) {
      this.logger.error(
        { error: error.message, referenceNumber, contributorType },
        'Error ensuring contributor funding rows'
      )
      throw error
    }
  }
}
