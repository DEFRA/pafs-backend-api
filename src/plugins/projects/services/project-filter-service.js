import {
  buildPaginationMeta,
  normalizePaginationParams
} from '../../../common/helpers/pagination.js'
import {
  PROJECT_SELECT_FIELDS,
  formatProject
} from '../helpers/project-formatter.js'

export class ProjectFilterService {
  constructor(prisma, logger) {
    this.prisma = prisma
    this.logger = logger
  }

  /**
   * Get projects with filters and pagination
   * @param {Object} params - Query parameters
   * @param {string} [params.search] - Search term for project number/name
   * @param {number[]} [params.areaIds] - Filter by area IDs (RMA area IDs)
   * @param {string} [params.status] - Filter by status (draft, submitted, archived)
   * @param {number} [params.page] - Page number
   * @param {number} [params.pageSize] - Records per page
   * @returns {Promise<Object>} Paginated projects with metadata
   */
  async getProjects({ search, areaIds, status, page, pageSize }) {
    const pagination = normalizePaginationParams(page, pageSize)
    const where = await this._buildWhereClause(search, areaIds, status)

    const [projects, total] = await Promise.all([
      this.prisma.pafs_core_projects.findMany({
        where,
        select: PROJECT_SELECT_FIELDS,
        orderBy: { updated_at: 'desc' },
        skip: pagination.skip,
        take: pagination.take
      }),
      this.prisma.pafs_core_projects.count({ where })
    ])

    if (projects.length === 0) {
      return {
        data: [],
        pagination: buildPaginationMeta(
          pagination.page,
          pagination.pageSize,
          total
        )
      }
    }

    const projectIds = projects.map((p) => Number(p.id))
    const states = await this.prisma.pafs_core_states.findMany({
      where: { project_id: { in: projectIds } },
      select: { project_id: true, state: true }
    })

    const statesMap = new Map(
      states.map((s) => [Number(s.project_id), s.state])
    )

    const formattedProjects = projects.map((project) =>
      formatProject(project, statesMap.get(Number(project.id)))
    )

    this.logger.info({ total, page: pagination.page }, 'Projects retrieved')

    return {
      data: formattedProjects,
      pagination: buildPaginationMeta(
        pagination.page,
        pagination.pageSize,
        total
      )
    }
  }

  /**
   * Build Prisma where clause from filters
   * Pre-queries related tables for areaIds/status since no Prisma relations are defined
   * @param {string} [search] - Search term
   * @param {number[]} [areaIds] - Area ID filters
   * @param {string} [status] - Status filter
   * @returns {Promise<Object>} Prisma where clause
   * @private
   */
  async _buildWhereClause(search, areaIds, status) {
    const where = {}

    if (search?.trim()) {
      const searchTerm = search.trim()
      where.OR = [
        { reference_number: { contains: searchTerm, mode: 'insensitive' } },
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { slug: { contains: searchTerm, mode: 'insensitive' } }
      ]
    }

    // Pre-query related tables to get matching project IDs
    const idFilters = await this._getRelatedProjectIds(areaIds, status)
    if (idFilters) {
      where.id = { in: idFilters }
    }

    return where
  }

  /**
   * Get project IDs matching area and/or status filters
   * @param {number[]} [areaIds] - Area ID filters
   * @param {string} [status] - Status filter
   * @returns {Promise<BigInt[]|null>} Array of matching project IDs or null if no filters
   * @private
   */
  async _getRelatedProjectIds(areaIds, status) {
    const hasAreaFilter = areaIds?.length > 0

    if (!hasAreaFilter && !status) {
      return null
    }

    const queries = []

    if (hasAreaFilter) {
      queries.push(
        this.prisma.pafs_core_area_projects
          .findMany({
            where: { area_id: { in: areaIds.map(Number) } },
            select: { project_id: true }
          })
          .then((rows) => new Set(rows.map((r) => BigInt(r.project_id))))
      )
    }

    if (status) {
      queries.push(
        this.prisma.pafs_core_states
          .findMany({
            where: { state: status },
            select: { project_id: true }
          })
          .then((rows) => new Set(rows.map((r) => BigInt(r.project_id))))
      )
    }

    const results = await Promise.all(queries)

    // Intersect all ID sets
    if (results.length === 1) {
      return [...results[0]]
    }

    const intersection = [...results[0]].filter((id) => results[1].has(id))
    return intersection
  }
}
