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
    const where = this.buildWhereClause(status, search, areaId)

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

    const formattedAccounts = accounts.map((account) =>
      formatAccount(account, { includeInvitationFields: true })
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
   * Build Prisma where clause from filters
   */
  buildWhereClause(status, search, areaId) {
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

    if (areaId) {
      where.pafs_core_user_areas = {
        some: {
          area_id: BigInt(areaId),
          primary: true
        }
      }
    }

    return where
  }
}
