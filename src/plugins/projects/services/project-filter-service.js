import {
  buildPaginationMeta,
  normalizePaginationParams
} from '../../../common/helpers/pagination.js'
import {
  PROJECT_SELECT_FIELDS,
  formatProject,
  resolveAreaNames
} from '../helpers/project-formatter.js'
import { PROJECT_STATUS } from '../../../common/constants/project.js'

/**
 * Extract project IDs as BigInt Set from query results
 * @param {Object[]} rows - Query result rows with project_id
 * @returns {Set<BigInt>} Set of project IDs
 */
const toProjectIdSet = (rows) => new Set(rows.map((r) => BigInt(r.project_id)))

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

    const paginationMeta = buildPaginationMeta(
      pagination.page,
      pagination.pageSize,
      total
    )

    if (projects.length === 0) {
      return { data: [], pagination: paginationMeta }
    }

    const projectIds = projects.map((p) => Number(p.id))
    const [states, areaNames] = await Promise.all([
      this.prisma.pafs_core_states.findMany({
        where: { project_id: { in: projectIds } },
        select: { project_id: true, state: true }
      }),
      resolveAreaNames(this.prisma, projectIds)
    ])

    const statesMap = new Map(
      states.map((s) => [Number(s.project_id), s.state])
    )

    const formattedProjects = projects.map((project) => {
      const projectId = Number(project.id)
      return formatProject(
        project,
        statesMap.get(projectId),
        areaNames.get(projectId)
      )
    })

    this.logger.info({ total, page: pagination.page }, 'Projects retrieved')

    return { data: formattedProjects, pagination: paginationMeta }
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

    // Pre-query related tables to build the id filter (inclusion + exclusion)
    const idFilter = await this._buildIdFilter(areaIds, status)
    if (idFilter) {
      where.id = idFilter
    }

    // Failed submissions: submitted but never sent to PoL
    if (status === PROJECT_STATUS.SUBMITTED) {
      where.submitted_to_pol = null
    }

    return where
  }

  /**
   * Build the id filter clause combining area, status inclusion, and archived exclusion.
   * All needed queries run in parallel for performance.
   * @param {number[]} [areaIds] - Area ID filters
   * @param {string} [status] - Status filter (when absent, archived projects are excluded)
   * @returns {Promise<Object|null>} Prisma id filter clause ({ in, notIn }) or null
   * @private
   */
  async _buildIdFilter(areaIds, status) {
    const hasAreaFilter = areaIds?.length > 0
    const queries = []
    const queryKeys = []

    if (hasAreaFilter) {
      queryKeys.push('area')
      queries.push(
        this.prisma.pafs_core_area_projects
          .findMany({
            where: { area_id: { in: areaIds.map(Number) } },
            select: { project_id: true }
          })
          .then(toProjectIdSet)
      )
    }

    if (status) {
      // Include only projects matching the requested status
      queryKeys.push('status')
      queries.push(
        this.prisma.pafs_core_states
          .findMany({
            where: { state: status },
            select: { project_id: true }
          })
          .then(toProjectIdSet)
      )
    } else {
      // No status filter: exclude archived projects
      queryKeys.push('archived')
      queries.push(
        this.prisma.pafs_core_states
          .findMany({
            where: { state: PROJECT_STATUS.ARCHIVED },
            select: { project_id: true }
          })
          .then(toProjectIdSet)
      )
    }

    const results = await Promise.all(queries)
    const resultMap = Object.fromEntries(
      queryKeys.map((key, i) => [key, results[i]])
    )

    const idFilter = {}

    // Build inclusion set by intersecting area and status filters
    const inclusionSets = [resultMap.area, resultMap.status].filter(Boolean)
    if (inclusionSets.length === 1) {
      idFilter.in = [...inclusionSets[0]]
    } else if (inclusionSets.length === 2) {
      idFilter.in = [...inclusionSets[0]].filter((id) =>
        inclusionSets[1].has(id)
      )
    }

    // Exclude archived projects
    if (resultMap.archived?.size > 0) {
      idFilter.notIn = [...resultMap.archived]
    }

    return Object.keys(idFilter).length > 0 ? idFilter : null
  }
}
