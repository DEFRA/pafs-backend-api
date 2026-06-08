import { Prisma } from '@prisma/client'
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

  /**
   * Upsert funding value (annual spend) record using Prisma upsert.
   * @@unique([project_id, financial_year]) added via migration 5-002 enables
   * a single round-trip — replaces the old findFirst + update/create pattern.
   */
  async upsertFundingValue({
    referenceNumber,
    financialYear,
    amounts,
    projectId: providedProjectId
  }) {
    try {
      const projectId =
        providedProjectId ??
        (await this._getProjectIdByReference(referenceNumber))

      const updateData = this._buildFundingValueUpdateData(amounts)

      const fundingValue = await this.prisma.pafs_core_funding_values.upsert({
        where: {
          project_id_financial_year: {
            project_id: projectId,
            financial_year: financialYear
          }
        },
        update: updateData,
        create: {
          project_id: projectId,
          financial_year: financialYear,
          total: 0n,
          ...updateData
        }
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
   * Delete contributors then the funding value row for one year in a single
   * method call (one findFirst, two deleteManyS).
   * Contributors must be removed first to avoid orphaned rows.
   * Called by processFundingValueRow when all amounts are zero/null.
   */
  async deleteFundingValueWithContributors({
    projectId,
    financialYear,
    referenceNumber
  }) {
    try {
      const fv = await this.prisma.pafs_core_funding_values.findFirst({
        where: { project_id: projectId, financial_year: financialYear },
        select: { id: true }
      })

      if (!fv) {
        return
      }

      await this.prisma.pafs_core_funding_contributors.deleteMany({
        where: { funding_value_id: fv.id }
      })

      await this.prisma.pafs_core_funding_values.deleteMany({
        where: { id: fv.id }
      })

      this.logger.info(
        { projectId, financialYear, referenceNumber },
        'Funding value and contributors deleted successfully'
      )
    } catch (error) {
      this.logger.error(
        { error: error.message, referenceNumber, financialYear },
        'Error deleting funding value with contributors'
      )
      throw error
    }
  }

  /**
   * Delete all funding values and their contributors for a project (bulk delete).
   */
  async deleteAllFundingData(referenceNumber) {
    try {
      const projectId = await this._getProjectIdByReference(referenceNumber)

      const fundingValues = await this.prisma.pafs_core_funding_values.findMany(
        {
          where: { project_id: projectId },
          select: { id: true }
        }
      )

      const fundingValueIds = fundingValues.map((fv) => fv.id)

      const contributorsResult =
        await this.prisma.pafs_core_funding_contributors.deleteMany({
          where: { funding_value_id: { in: fundingValueIds } }
        })

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
   * Clear spending amounts from funding values and contributors that fall
   * outside a financial year range. Rows are preserved (not deleted).
   */
  async clearOutOfRangeFundingData(referenceNumber, startYear, endYear) {
    try {
      const projectId = await this._getProjectIdByReference(referenceNumber)

      const outOfRangeValues =
        await this.prisma.pafs_core_funding_values.findMany({
          where: {
            project_id: projectId,
            OR: [
              { financial_year: { lt: startYear } },
              { financial_year: { gt: endYear } }
            ]
          },
          select: { id: true, financial_year: true }
        })

      if (!outOfRangeValues.length) {
        this.logger.info(
          { projectId, referenceNumber, startYear, endYear },
          'No out-of-range funding data found'
        )
        return { fundingValuesCleared: 0, contributorsCleared: 0 }
      }

      const outOfRangeIds = outOfRangeValues.map((fv) => fv.id)

      const nullAmounts = {}
      for (const [, dbCol] of FUNDING_VALUE_AMOUNT_FIELD_MAP) {
        nullAmounts[dbCol] = null
      }
      nullAmounts.total = 0n

      const { count: fundingValuesCleared } =
        await this.prisma.pafs_core_funding_values.updateMany({
          where: { id: { in: outOfRangeIds } },
          data: nullAmounts
        })

      const contributorsResult =
        await this.prisma.pafs_core_funding_contributors.updateMany({
          where: { funding_value_id: { in: outOfRangeIds } },
          data: { amount: null }
        })

      const result = {
        fundingValuesCleared,
        contributorsCleared: contributorsResult.count
      }

      this.logger.info(
        { projectId, referenceNumber, startYear, endYear, ...result },
        'Out-of-range funding data cleared successfully'
      )

      return result
    } catch (error) {
      this.logger.error(
        { error: error.message, referenceNumber, startYear, endYear },
        'Error clearing out-of-range funding data'
      )
      throw error
    }
  }

  /**
   * Null out specific funding source columns for every funding_value row of a
   * project and recompute each row's total — all in a single atomic UPDATE.
   *
   * Using a single SQL UPDATE rather than findMany + N individual updates:
   *  - eliminates the N-query loop
   *  - avoids the read-modify-write race (two concurrent requests overwriting
   *    each other's total) because the total is computed server-side in the DB
   *
   * Column names come from the hardcoded FUNDING_VALUE_AMOUNT_FIELD_MAP constant
   * so using Prisma.raw here is safe — no user-supplied SQL.
   */
  async nullSpecificFundingColumns(referenceNumber, fields, providedProjectId) {
    try {
      const projectId =
        providedProjectId ??
        (await this._getProjectIdByReference(referenceNumber))

      const fieldToDb = Object.fromEntries(FUNDING_VALUE_AMOUNT_FIELD_MAP)
      const nulledDbCols = new Set(
        fields.map((f) => fieldToDb[f]).filter(Boolean)
      )

      if (nulledDbCols.size === 0) return

      const nullAssignments = [...nulledDbCols].map((c) => `${c} = NULL`)
      const remainingCols = FUNDING_VALUE_AMOUNT_FIELD_MAP.map(
        ([, db]) => db
      ).filter((c) => !nulledDbCols.has(c))
      const totalExpr =
        remainingCols.length > 0
          ? remainingCols.map((c) => `COALESCE(${c}, 0)`).join(' + ')
          : '0'

      await this.prisma.$executeRaw(
        Prisma.sql`UPDATE pafs_core_funding_values SET ${Prisma.raw(
          [...nullAssignments, `total = ${totalExpr}`].join(', ')
        )} WHERE project_id = ${projectId}`
      )

      this.logger.info(
        { projectId, referenceNumber, fields },
        'Specific funding columns nulled successfully'
      )
    } catch (error) {
      this.logger.error(
        { error: error.message, referenceNumber, fields },
        'Error nulling specific funding columns'
      )
      throw error
    }
  }

  /**
   * Null out additional FCRM GIA columns for every funding_value row of a
   * project and recompute the total from the remaining base columns — all
   * in a single atomic UPDATE.
   */
  async nullAdditionalGiaColumns(referenceNumber, providedProjectId) {
    try {
      const projectId =
        providedProjectId ??
        (await this._getProjectIdByReference(referenceNumber))

      await this.prisma.$executeRaw(
        Prisma.sql`UPDATE pafs_core_funding_values SET
          asset_replacement_allowance = NULL,
          environment_statutory_funding = NULL,
          frequently_flooded_communities = NULL,
          other_additional_grant_in_aid = NULL,
          other_government_department = NULL,
          recovery = NULL,
          summer_economic_fund = NULL,
          total = COALESCE(fcerm_gia, 0) + COALESCE(local_levy, 0) +
                  COALESCE(internal_drainage_boards, 0) +
                  COALESCE(public_contributions, 0) +
                  COALESCE(private_contributions, 0) +
                  COALESCE(other_ea_contributions, 0) +
                  COALESCE(not_yet_identified, 0)
        WHERE project_id = ${projectId}`
      )

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
