import { Prisma } from '@prisma/client'
import {
  buildPaginationMeta,
  normalizePaginationParams
} from '../../../common/helpers/pagination.js'
import { formatProject } from '../helpers/project-formatter.js'

export class ProjectFilterService {
  constructor(prisma, logger) {
    this.prisma = prisma
    this.logger = logger
  }

  /**
   * Get projects with filters and pagination
   * @param {Object} params - Query parameters
   * @param {string} [params.search] - Search term for project number/name
   * @param {number} [params.areaId] - Filter by area ID
   * @param {string} [params.status] - Filter by status (draft, submitted, archived)
   * @param {number} [params.page] - Page number
   * @param {number} [params.pageSize] - Records per page
   * @returns {Promise<Object>} Paginated projects with metadata
   */
  async getProjects({ search, areaId, status, page, pageSize }) {
    const pagination = normalizePaginationParams(page, pageSize)
    const whereClause = this.buildWhereClause(search, areaId, status)

    // Build the SELECT query with raw SQL
    const selectQuery = Prisma.sql`
      SELECT
        p.id,
        p.reference_number,
        p.slug,
        p.name,
        p.rma_name,
        p.created_at,
        p.updated_at,
        p.submitted_at
      FROM pafs_core_projects p
      ${whereClause}
      ORDER BY p.updated_at DESC
      LIMIT ${pagination.take}
      OFFSET ${pagination.skip}
    `

    // Build the COUNT query with raw SQL
    const countQuery = Prisma.sql`
      SELECT COUNT(*)::int as count
      FROM pafs_core_projects p
      ${whereClause}
    `

    const [projects, countResult] = await Promise.all([
      this.prisma.$queryRaw(selectQuery),
      this.prisma.$queryRaw(countQuery)
    ])

    const total = countResult[0]?.count || 0

    // Fetch states for all projects using raw SQL
    if (projects.length > 0) {
      const projectIds = projects.map((p) => Number(p.id))

      const states = await this.prisma.$queryRaw`
        SELECT project_id, state
        FROM pafs_core_states
        WHERE project_id = ANY(${projectIds}::int[])
      `

      // Create a map of project_id to state
      const statesMap = new Map(
        states.map((s) => [s.project_id.toString(), s.state])
      )

      // Merge states with projects
      const formattedProjects = projects.map((project) =>
        formatProject(project, statesMap.get(project.id.toString()))
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

    return {
      data: [],
      pagination: buildPaginationMeta(
        pagination.page,
        pagination.pageSize,
        total
      )
    }
  }

  /**
   * Build SQL WHERE clause from filters
   */
  buildWhereClause(search, areaId, status) {
    const conditions = []

    if (search?.trim()) {
      const searchTerm = `%${search.trim()}%`
      conditions.push(
        Prisma.sql`(p.reference_number ILIKE ${searchTerm} OR p.name ILIKE ${searchTerm} OR p.slug ILIKE ${searchTerm})`
      )
    }

    if (areaId) {
      conditions.push(
        Prisma.sql`EXISTS (
          SELECT 1
          FROM pafs_core_area_projects ap
          WHERE ap.project_id = p.id
          AND ap.area_id = ${BigInt(areaId)}
        )`
      )
    }

    if (status) {
      conditions.push(
        Prisma.sql`EXISTS (
          SELECT 1
          FROM pafs_core_states s
          WHERE s.project_id = p.id
          AND s.state = ${status}
        )`
      )
    }

    let whereClause = Prisma.empty
    if (conditions.length > 0) {
      whereClause = Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`
    }

    return whereClause
  }
}
