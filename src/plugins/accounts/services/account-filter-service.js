import {
  buildPaginationMeta,
  normalizePaginationParams
} from '../../../common/helpers/pagination.js'
import { ACCOUNT_STATUS } from '../../../common/constants/index.js'
import {
  ACCOUNT_SELECT_FIELDS,
  formatAccount
} from '../helpers/account-formatter.js'

export class AccountFilterService {
  constructor(prisma, logger) {
    this.prisma = prisma
    this.logger = logger
  }

  /**
   * Get accounts with filters and pagination
   * @param {Object} params - Query parameters
   * @param {string} params.status - Account status filter (pending/active)
   * @param {string} [params.search] - Search term for name/email
   * @param {number} [params.areaId] - Filter by area ID
   * @param {number} [params.page] - Page number
   * @param {number} [params.pageSize] - Records per page
   * @returns {Promise<Object>} Paginated accounts with metadata
   */
  async getAccounts({ status, search, areaId, page, pageSize }) {
    const pagination = normalizePaginationParams(page, pageSize)
    const where = this.buildWhereClause(status, search)

    // Area filter: pre-query user_areas (no Prisma relation on pafs_core_users)
    if (areaId) {
      const matchingUserAreas = await this.prisma.pafs_core_user_areas.findMany(
        {
          where: { area_id: BigInt(areaId), primary: true },
          select: { user_id: true }
        }
      )
      where.id = { in: matchingUserAreas.map((ua) => ua.user_id) }
    }

    const [accounts, total] = await Promise.all([
      this.prisma.pafs_core_users.findMany({
        where,
        select: ACCOUNT_SELECT_FIELDS,
        orderBy: { updated_at: 'desc' },
        skip: pagination.skip,
        take: pagination.take
      }),
      this.prisma.pafs_core_users.count({ where })
    ])

    const areasMap = await this._fetchAreasForUsers(accounts.map((a) => a.id))

    const formattedAccounts = accounts.map((account) =>
      formatAccount(account, areasMap.get(account.id.toString()) || [])
    )

    this.logger.info(
      { status, total, page: pagination.page },
      'Accounts retrieved'
    )

    return {
      data: formattedAccounts,
      pagination: buildPaginationMeta(
        pagination.page,
        pagination.pageSize,
        total
      )
    }
  }

  /**
   * Batch-fetch and group area details for a list of user IDs.
   * @param {BigInt[]} userIds
   * @returns {Promise<Map<string, Array>>} userId string → array of raw area rows
   * @private
   */
  async _fetchAreasForUsers(userIds) {
    if (!userIds.length) {
      return new Map()
    }

    const userAreas = await this.prisma.pafs_core_user_areas.findMany({
      where: { user_id: { in: userIds } },
      select: { user_id: true, area_id: true, primary: true }
    })

    if (!userAreas.length) {
      return new Map()
    }

    const uniqueAreaIds = [
      ...new Map(
        userAreas.map((ua) => [ua.area_id.toString(), ua.area_id])
      ).values()
    ]

    const areas = await this.prisma.pafs_core_areas.findMany({
      where: { id: { in: uniqueAreaIds } },
      select: { id: true, name: true, area_type: true, parent_id: true }
    })

    const areasById = new Map(areas.map((a) => [a.id.toString(), a]))
    const result = new Map()

    for (const ua of userAreas) {
      const area = areasById.get(ua.area_id.toString())
      if (!area) {
        continue
      }
      const key = ua.user_id.toString()
      if (!result.has(key)) {
        result.set(key, [])
      }
      result.get(key).push({ ...area, primary: ua.primary })
    }

    return result
  }

  /**
   * Build Prisma where clause from filters
   */
  buildWhereClause(status, search) {
    const where = {}

    if (status === ACCOUNT_STATUS.PENDING) {
      where.status = ACCOUNT_STATUS.PENDING
    } else if (status === ACCOUNT_STATUS.ACTIVE) {
      where.status = {
        in: [ACCOUNT_STATUS.ACTIVE, ACCOUNT_STATUS.APPROVED]
      }
    } else {
      where.status = ACCOUNT_STATUS.PENDING
    }

    if (search?.trim()) {
      const searchTerm = search.trim()
      where.OR = [
        { first_name: { contains: searchTerm, mode: 'insensitive' } },
        { last_name: { contains: searchTerm, mode: 'insensitive' } },
        { email: { contains: searchTerm, mode: 'insensitive' } }
      ]
    }

    return where
  }
}
