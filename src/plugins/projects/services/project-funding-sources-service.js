import { ProjectFundingContributorsService } from './project-funding-contributors-service.js'

/**
 * ProjectFundingSourcesService
 *
 * Handles funding sources (values) persistence.
 * Extends ProjectFundingContributorsService for contributor operations.
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

export class ProjectFundingSourcesService extends ProjectFundingContributorsService {
  constructor(prisma, logger) {
    super(prisma, logger)
    this.prisma = prisma
    this.logger = logger
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
