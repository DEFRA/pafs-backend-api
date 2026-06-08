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
   * Lean contributor upsert when the funding_value_id is already known.
   * Uses Prisma upsert via @@unique([funding_value_id, contributor_type, name])
   * (added via migration 5-004) — a single round-trip instead of findFirst + update/create.
   * The update clause only touches amount and updated_at, preserving the
   * secured/constrained fields on existing rows.
   * @private
   */
  async _upsertContributorDirect(
    fundingValueId,
    { contributorType, name, amount }
  ) {
    return this.prisma.pafs_core_funding_contributors.upsert({
      where: {
        funding_value_id_contributor_type_name: {
          funding_value_id: fundingValueId,
          contributor_type: contributorType,
          name
        }
      },
      update: { amount: BigInt(amount), updated_at: new Date() },
      create: {
        funding_value_id: fundingValueId,
        contributor_type: contributorType,
        name,
        amount: BigInt(amount),
        created_at: new Date(),
        updated_at: new Date()
      }
    })
  }

  /**
   * Upsert all desired contributor entries for a year.
   * When fundingValueId is provided (common path from processFundingValueRow),
   * uses _upsertContributorDirect to avoid redundant project + fv lookups.
   * Falls back to upsertFn for standalone callers that supply referenceNumber only.
   * @private
   */
  async _upsertDesiredContributors(
    desiredEntries,
    referenceNumber,
    financialYear,
    upsertFn,
    fundingValueId
  ) {
    if (fundingValueId) {
      await Promise.all(
        desiredEntries.map((contributor) =>
          this._upsertContributorDirect(fundingValueId, contributor)
        )
      )
    } else {
      await Promise.all(
        desiredEntries.map((contributor) =>
          upsertFn({
            referenceNumber,
            financialYear,
            contributorType: contributor.contributorType,
            name: contributor.name,
            amount: contributor.amount
          })
        )
      )
    }
  }

  /**
   * Delete stale contributor rows that are no longer in the desired set.
   * @private
   */
  async _deleteStaleContributors(desiredEntries, fundingValueId) {
    const where =
      desiredEntries.length === 0
        ? { funding_value_id: fundingValueId }
        : {
            funding_value_id: fundingValueId,
            NOT: desiredEntries.map((c) => ({
              contributor_type: c.contributorType,
              name: c.name
            }))
          }

    const { count } =
      await this.prisma.pafs_core_funding_contributors.deleteMany({ where })
    return count
  }

  /**
   * Resolve the funding_value id for a project+year, using the supplied id
   * directly when the caller already knows it (avoids a redundant round-trip).
   * Returns null and logs when no funding_value row exists.
   * @private
   */
  async _resolveFundingValueId(
    providedFvId,
    projectId,
    financialYear,
    referenceNumber
  ) {
    if (providedFvId) {
      return providedFvId
    }
    const fundingValue = await this.prisma.pafs_core_funding_values.findFirst({
      where: { project_id: projectId, financial_year: financialYear },
      select: { id: true }
    })
    if (fundingValue) {
      return fundingValue.id
    }
    this.logger.info(
      { projectId, financialYear, referenceNumber },
      'Funding value not found, cannot sync contributors'
    )
    return null
  }

  /**
   * Filter raw contributor entries down to those with a name, type and amount.
   * @private
   */
  _filterValidContributors(contributorEntries) {
    if (!Array.isArray(contributorEntries)) {
      return []
    }
    return contributorEntries.filter(
      (c) =>
        c?.name &&
        c?.contributorType &&
        c?.amount !== null &&
        c?.amount !== undefined &&
        c?.amount !== ''
    )
  }

  /**
   * Sync contributor rows for a single financial year without resetting
   * legacy secured/constrained values.
   *
   * @param {Object} data
   * @param {string} data.referenceNumber
   * @param {number} data.financialYear
   * @param {Array} data.contributorEntries
   * @param {Function} upsertFn - upsertFundingContributor method reference
   * @param {number} [data.projectId] - optional, avoids _getProjectIdByReference
   * @param {bigint} [data.fundingValueId] - optional; when supplied skips fv re-fetch
   *   and uses the lean _upsertContributorDirect path
   */
  async syncFundingContributorsForYear({
    referenceNumber,
    financialYear,
    contributorEntries,
    upsertFn,
    projectId: providedProjectId,
    fundingValueId: providedFundingValueId
  }) {
    try {
      const projectId =
        providedProjectId ??
        (await this._getProjectIdByReference(referenceNumber))

      const fvId = await this._resolveFundingValueId(
        providedFundingValueId,
        projectId,
        financialYear,
        referenceNumber
      )
      if (fvId === null) {
        return
      }

      const desiredEntries = this._filterValidContributors(contributorEntries)

      await this._upsertDesiredContributors(
        desiredEntries,
        referenceNumber,
        financialYear,
        upsertFn,
        providedFundingValueId ? fvId : null
      )

      const deletedCount = await this._deleteStaleContributors(
        desiredEntries,
        fvId
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
        { err: error, referenceNumber, financialYear },
        'Error syncing funding contributors for year'
      )
      throw error
    }
  }

  /**
   * Ensure a funding_value row exists for the given project and year.
   * Uses Prisma upsert via @@unique([project_id, financial_year]).
   * @private
   */
  async _ensureFundingValueRow(projectId, year) {
    return this.prisma.pafs_core_funding_values.upsert({
      where: {
        project_id_financial_year: {
          project_id: projectId,
          financial_year: year
        }
      },
      update: {},
      create: { project_id: projectId, financial_year: year, total: 0n }
    })
  }

  /**
   * Ensure a contributor placeholder row exists for the given funding value,
   * name and type. Uses Prisma upsert via the unique constraint — a single
   * round-trip. The update clause is empty so existing rows (including their
   * amount, secured and constrained values) are left completely unchanged.
   * @private
   */
  async _createContributorIfMissing(fundingValueId, name, contributorType) {
    await this.prisma.pafs_core_funding_contributors.upsert({
      where: {
        funding_value_id_contributor_type_name: {
          funding_value_id: fundingValueId,
          contributor_type: contributorType,
          name
        }
      },
      update: {},
      create: {
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
   * Resolve the financial year range for a project, falling back to a DB
   * lookup when the caller did not supply both years.
   * Returns { startYear, endYear } or null when the project has no range.
   * @private
   */
  async _resolveFinancialYears(
    projectId,
    referenceNumber,
    financialStartYear,
    financialEndYear
  ) {
    if (financialStartYear != null && financialEndYear != null) {
      return { startYear: financialStartYear, endYear: financialEndYear }
    }
    const project = await this.prisma.pafs_core_projects.findFirst({
      where: { id: projectId },
      select: {
        earliest_start_year: true,
        project_end_financial_year: true
      }
    })
    if (!project?.earliest_start_year || !project?.project_end_financial_year) {
      this.logger.info(
        { referenceNumber },
        'Project has no financial year range, skipping contributor funding rows'
      )
      return null
    }
    return {
      startYear: project.earliest_start_year,
      endYear: project.project_end_financial_year
    }
  }

  /**
   * Bulk-create funding_value and funding_contributor placeholder rows.
   * Uses skipDuplicates so this is safe to call repeatedly.
   * @private
   */
  async _persistContributorRows(
    projectId,
    years,
    contributorType,
    contributorNames
  ) {
    await this.prisma.pafs_core_funding_values.createMany({
      data: years.map((year) => ({
        project_id: projectId,
        financial_year: year,
        total: 0n
      })),
      skipDuplicates: true
    })

    const fundingValues = await this.prisma.pafs_core_funding_values.findMany({
      where: { project_id: projectId, financial_year: { in: years } },
      select: { id: true }
    })

    await this.prisma.pafs_core_funding_contributors.createMany({
      data: fundingValues.flatMap((fv) =>
        contributorNames.map((name) => ({
          funding_value_id: fv.id,
          contributor_type: contributorType,
          name,
          amount: null,
          created_at: new Date(),
          updated_at: new Date()
        }))
      ),
      skipDuplicates: true
    })
  }

  /**
   * Ensures funding_value rows exist for each financial year of the project and
   * upserts contributor rows (with null amounts) for new contributor names.
   *
   * @param {Object} data
   * @param {string} data.referenceNumber
   * @param {string} data.contributorType
   * @param {string[]} data.contributorNames
   * @param {number} [data.projectId] - optional; avoids _getProjectIdByReference when supplied
   */
  async ensureContributorFundingRows({
    referenceNumber,
    contributorType,
    contributorNames,
    projectId: providedProjectId,
    financialStartYear,
    financialEndYear
  }) {
    try {
      const projectId =
        providedProjectId ??
        (await this._getProjectIdByReference(referenceNumber))

      const yearRange = await this._resolveFinancialYears(
        projectId,
        referenceNumber,
        financialStartYear,
        financialEndYear
      )
      if (yearRange === null) {
        return
      }

      const { startYear, endYear } = yearRange
      const years = Array.from(
        { length: endYear - startYear + 1 },
        (_, i) => startYear + i
      )

      await this._persistContributorRows(
        projectId,
        years,
        contributorType,
        contributorNames
      )

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
        { err: error, referenceNumber, contributorType },
        'Error ensuring contributor funding rows'
      )
      throw error
    }
  }
}
