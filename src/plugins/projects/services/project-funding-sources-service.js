/**
 * ProjectFundingSourcesService
 *
 * Handles funding sources (values and contributors) persistence.
 * Extracted from ProjectService to keep file sizes within SonarQube limits.
 * ProjectService extends this class and inherits all its methods.
 */
const FUNDING_VALUE_AMOUNT_FIELD_MAP = [
  ['fcermGia', 'fcerm_gia'],
  ['localLevy', 'local_levy'],
  ['internalDrainageBoards', 'internal_drainage_boards'],
  ['publicContributions', 'public_contributions'],
  ['privateContributions', 'private_contributions'],
  ['otherEaContributions', 'other_ea_contributions'],
  ['notYetIdentified', 'not_yet_identified'],
  ['assetReplacementAllowance', 'asset_replacement_allowance'],
  ['environmentStatutoryFunding', 'environment_statutory_funding'],
  ['frequentlyFloodedCommunities', 'frequently_flooded_communities'],
  ['otherAdditionalGrantInAid', 'other_additional_grant_in_aid'],
  ['otherGovernmentDepartment', 'other_government_department'],
  ['recovery', 'recovery'],
  ['summerEconomicFund', 'summer_economic_fund']
]

export class ProjectFundingSourcesService {
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

  _toNullableBigInt(value) {
    return value ? BigInt(value) : null
  }

  _toTotalBigInt(value) {
    return value ? BigInt(value) : 0n
  }

  _buildFundingValueUpdateData(amounts) {
    const updateData = {}

    for (const [sourceField, dbField] of FUNDING_VALUE_AMOUNT_FIELD_MAP) {
      updateData[dbField] = this._toNullableBigInt(amounts[sourceField])
    }

    updateData.total = this._toTotalBigInt(amounts.total)

    return updateData
  }

  async _findExistingFundingValue(projectId, financialYear) {
    return this.prisma.pafs_core_funding_values.findFirst({
      where: {
        project_id: projectId,
        financial_year: financialYear
      }
    })
  }

  async _saveFundingValue({
    projectId,
    financialYear,
    existingValue,
    updateData
  }) {
    if (existingValue) {
      return this.prisma.pafs_core_funding_values.update({
        where: { id: existingValue.id },
        data: updateData
      })
    }

    return this.prisma.pafs_core_funding_values.create({
      data: {
        project_id: projectId,
        financial_year: financialYear,
        total: 0n,
        ...updateData
      }
    })
  }

  /**
   * Upsert funding value (annual spend) record
   * @param {Object} data - Funding value data
   * @param {string} data.referenceNumber - Project reference number
   * @param {number} data.financialYear - Financial year for this spend record
   * @param {Object} data.amounts - Amounts object with fund source keys (fcermGia, localLevy, etc.)
   * @returns {Promise<Object>} Created or updated funding value record
   */
  async upsertFundingValue({ referenceNumber, financialYear, amounts }) {
    try {
      const projectId = await this._getProjectIdByReference(referenceNumber)

      const existingValue = await this._findExistingFundingValue(
        projectId,
        financialYear
      )
      const updateData = this._buildFundingValueUpdateData(amounts)
      const fundingValue = await this._saveFundingValue({
        projectId,
        financialYear,
        existingValue,
        updateData
      })

      this.logger.info(
        { projectId, financialYear, referenceNumber },
        'Funding value upserted successfully'
      )

      return fundingValue
    } catch (error) {
      this.logger.error(
        { error: error.message, referenceNumber, financialYear },
        'Error upserting funding value'
      )
      throw error
    }
  }

  /**
   * Delete funding value record for a specific financial year
   * @param {Object} data - Funding value identification data
   * @param {string} data.referenceNumber - Project reference number
   * @param {number} data.financialYear - Financial year to delete
   * @returns {Promise<Object>} Deleted funding value record or null if not found
   */
  async deleteFundingValue({ referenceNumber, financialYear }) {
    try {
      const projectId = await this._getProjectIdByReference(referenceNumber)

      const existingValue =
        await this.prisma.pafs_core_funding_values.findFirst({
          where: {
            project_id: projectId,
            financial_year: financialYear
          }
        })

      if (existingValue) {
        const deletedValue = await this.prisma.pafs_core_funding_values.delete({
          where: { id: existingValue.id }
        })

        this.logger.info(
          { projectId, financialYear, referenceNumber },
          'Funding value deleted successfully'
        )

        return deletedValue
      }

      this.logger.info(
        { projectId, financialYear, referenceNumber },
        'Funding value not found, nothing to delete'
      )

      return null
    } catch (error) {
      this.logger.error(
        { error: error.message, referenceNumber, financialYear },
        'Error deleting funding value'
      )
      throw error
    }
  }

  /**
   * Upsert funding contributor record
   * @param {Object} data - Funding contributor data
   * @param {string} data.referenceNumber - Project reference number
   * @param {number} data.financialYear - Financial year to which this contributor applies
   * @param {string} data.contributorType - Type of contributor (e.g., 'partner_funding', 'recovery_fund')
   * @param {string} data.name - Name of contributor
   * @param {string|number} data.amount - Amount contributed
   * @param {boolean} [data.secured=false] - Whether funding is secured
   * @param {boolean} [data.constrained=false] - Whether funding is constrained
   * @returns {Promise<Object>} Created or updated contributor record
   */
  async upsertFundingContributor({
    referenceNumber,
    financialYear,
    contributorType,
    name,
    amount,
    secured = false,
    constrained = false
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

      const updateData = {
        amount: BigInt(amount),
        secured,
        constrained,
        updated_at: new Date()
      }

      let contributor
      if (existingContributor) {
        contributor = await this.prisma.pafs_core_funding_contributors.update({
          where: { id: existingContributor.id },
          data: updateData
        })
      } else {
        contributor = await this.prisma.pafs_core_funding_contributors.create({
          data: {
            funding_value_id: fundingValue.id,
            contributor_type: contributorType,
            name,
            ...updateData,
            created_at: new Date()
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
  async cleanupContributorsByName({
    referenceNumber,
    contributorType,
    currentNames
  }) {
    try {
      const projectId = await this._getProjectIdByReference(referenceNumber)

      const fundingValues = await this.prisma.pafs_core_funding_values.findMany(
        {
          where: { project_id: projectId }
        }
      )

      if (fundingValues.length === 0) {
        return
      }

      const fundingValueIds = fundingValues.map((fv) => fv.id)

      // Remove stale contributor rows
      if (currentNames.length > 0) {
        await this.prisma.pafs_core_funding_contributors.deleteMany({
          where: {
            funding_value_id: { in: fundingValueIds },
            contributor_type: contributorType,
            NOT: { name: { in: currentNames } }
          }
        })
      } else {
        await this.prisma.pafs_core_funding_contributors.deleteMany({
          where: {
            funding_value_id: { in: fundingValueIds },
            contributor_type: contributorType
          }
        })
      }

      // Map contributorType to the pafs_core_funding_values column name
      const amountDbField = contributorType // e.g. 'public_contributions'

      // Recalculate per-year amount and total for each funding value row
      for (const fv of fundingValues) {
        const remaining =
          await this.prisma.pafs_core_funding_contributors.findMany({
            where: {
              funding_value_id: fv.id,
              contributor_type: contributorType
            },
            select: { amount: true }
          })

        const newAmount =
          remaining.length > 0
            ? remaining.reduce((sum, c) => sum + (c.amount ?? 0n), 0n)
            : null

        // Recalculate the overall row total: swap old amount for new amount
        const oldAmount = fv[amountDbField] ?? 0n
        const newAmountBigInt = newAmount ?? 0n
        const newTotal = (fv.total ?? 0n) - oldAmount + newAmountBigInt

        await this.prisma.pafs_core_funding_values.update({
          where: { id: fv.id },
          data: {
            [amountDbField]: newAmount,
            total: newTotal < 0n ? 0n : newTotal
          }
        })
      }

      this.logger.info(
        { projectId, referenceNumber, contributorType, currentNames },
        'Cleaned up removed contributors and recalculated totals'
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
   * Delete all funding values and their contributors for a project (bulk delete)
   * Used when clearing funding data after project deletion or reset
   * @param {string} referenceNumber - Project reference number
   * @returns {Promise<{fundingValuesDeleted: number, contributorsDeleted: number}>}
   */
  async deleteAllFundingData(referenceNumber) {
    try {
      const projectId = await this._getProjectIdByReference(referenceNumber)

      // First, get all funding value IDs for this project
      const fundingValues = await this.prisma.pafs_core_funding_values.findMany(
        {
          where: { project_id: projectId },
          select: { id: true }
        }
      )

      const fundingValueIds = fundingValues.map((fv) => fv.id)

      // Delete all contributors for these funding values
      const contributorsResult =
        await this.prisma.pafs_core_funding_contributors.deleteMany({
          where: { funding_value_id: { in: fundingValueIds } }
        })

      // Delete all funding values
      const valuesResult =
        await this.prisma.pafs_core_funding_values.deleteMany({
          where: { project_id: projectId }
        })

      const result = {
        fundingValuesDeleted: valuesResult.count,
        contributorsDeleted: contributorsResult.count
      }

      this.logger.info(
        { projectId, referenceNumber, ...result },
        'All funding values and contributors deleted successfully'
      )

      return result
    } catch (error) {
      this.logger.error(
        { error: error.message, referenceNumber },
        'Error deleting all funding data'
      )
      throw error
    }
  }

  /**
   * Null out additional FCRM GIA columns in all pafs_core_funding_values rows
   * for a project, and recalculate the total.
   * Called when additionalFcermGia is deselected.
   * @param {string} referenceNumber - Project reference number
   */
  async nullAdditionalGiaColumns(referenceNumber) {
    try {
      const projectId = await this._getProjectIdByReference(referenceNumber)

      const fundingValues = await this.prisma.pafs_core_funding_values.findMany(
        {
          where: { project_id: projectId }
        }
      )

      for (const fv of fundingValues) {
        // Recalculate total excluding the additional GIA fields
        const remaining = [
          fv.fcerm_gia,
          fv.local_levy,
          fv.internal_drainage_boards,
          fv.public_contributions,
          fv.private_contributions,
          fv.other_ea_contributions,
          fv.not_yet_identified
        ].reduce((sum, v) => sum + (v ?? 0n), 0n)

        await this.prisma.pafs_core_funding_values.update({
          where: { id: fv.id },
          data: {
            asset_replacement_allowance: null,
            environment_statutory_funding: null,
            frequently_flooded_communities: null,
            other_additional_grant_in_aid: null,
            other_government_department: null,
            recovery: null,
            summer_economic_fund: null,
            total: remaining
          }
        })
      }

      this.logger.info(
        { projectId, referenceNumber },
        'Additional GIA columns nulled successfully'
      )
    } catch (error) {
      this.logger.error(
        { error: error.message, referenceNumber },
        'Error nulling additional GIA columns'
      )
      throw error
    }
  }
}
