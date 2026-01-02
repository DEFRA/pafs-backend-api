import {
  buildPaginationMeta,
  normalizePaginationParams
} from '../../../common/helpers/pagination.js'
import { ACCOUNT_STATUS } from '../../../common/constants/index.js'

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
        select: {
          id: true,
          email: true,
          first_name: true,
          last_name: true,
          job_title: true,
          organisation: true,
          telephone_number: true,
          status: true,
          admin: true,
          disabled: true,
          created_at: true,
          updated_at: true,
          last_sign_in_at: true,
          pafs_core_user_areas: {
            select: {
              primary: true,
              pafs_core_areas: {
                select: {
                  id: true,
                  name: true,
                  area_type: true
                }
              }
            }
          }
        },
        orderBy: [{ created_at: 'desc' }, { updated_at: 'desc' }],
        skip: pagination.skip,
        take: pagination.take
      }),
      this.prisma.pafs_core_users.count({ where })
    ])

    const formattedAccounts = accounts.map((account) =>
      this.formatAccount(account)
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
          area_id: BigInt(areaId)
        }
      }
    }

    return where
  }

  /**
   * Format account for API response
   */
  formatAccount(account) {
    const areas = account.pafs_core_user_areas.map((ua) => ({
      id: Number(ua.pafs_core_areas.id),
      name: ua.pafs_core_areas.name,
      type: ua.pafs_core_areas.area_type,
      primary: ua.primary
    }))

    return {
      id: Number(account.id),
      email: account.email,
      firstName: account.first_name,
      lastName: account.last_name,
      jobTitle: account.job_title,
      organisation: account.organisation,
      telephoneNumber: account.telephone_number,
      status: account.status,
      admin: account.admin,
      disabled: account.disabled,
      areas,
      createdAt: account.created_at,
      updatedAt: account.updated_at,
      lastSignIn: account.last_sign_in_at
    }
  }
}
