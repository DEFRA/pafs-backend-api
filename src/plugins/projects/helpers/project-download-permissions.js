import { AreaService } from '../../areas/services/area-service.js'
import { HTTP_STATUS } from '../../../common/constants/index.js'
import { PROJECT_VALIDATION_MESSAGES } from '../../../common/constants/project.js'
import { buildErrorResponse } from '../../../common/helpers/response-builder.js'
import { hasAccessToArea, hasAccessToParentPso } from './project-permissions.js'

/**
 * Look up the project's area_id from the junction table.
 * Single lightweight indexed query — called at most once per download request.
 * @param {Object} prisma
 * @param {number|BigInt} projectId
 * @returns {Promise<number|null>}
 */
export async function fetchProjectAreaId(prisma, projectId) {
  const row = await prisma.pafs_core_area_projects.findFirst({
    where: { project_id: Number(projectId) },
    select: { area_id: true }
  })
  return row?.area_id ?? null
}

/**
 * Validate that the authenticated user may access a project for download or delete.
 *
 * Permission rules mirror canUpdateProject:
 *   - Admin: always allowed (fast path, no DB)
 *   - RMA user with direct area match in JWT areas: allowed (fast path, no DB)
 *   - User with access to the PSO parent area: allowed (one cached DB query)
 *   - Otherwise: 403 Forbidden
 *
 * @param {Object} credentials    request.auth.credentials
 * @param {number|null} projectAreaId  area_id from pafs_core_area_projects
 * @param {Object} prisma
 * @param {Object} h
 * @param {Object} logger
 * @param {string} referenceNumber    for structured log context
 * @returns {Promise<null | HapiResponse>}  null if allowed; 403 response if denied
 */
export async function validateDownloadPermissions(
  credentials,
  projectAreaId,
  prisma,
  h,
  logger,
  referenceNumber
) {
  if (credentials.isAdmin) {
    return null
  }

  if (projectAreaId && hasAccessToArea(credentials.areas, projectAreaId)) {
    return null
  }

  if (projectAreaId) {
    const areaService = new AreaService(prisma, logger)
    const projectAreaDetails =
      await areaService.getAreaByIdWithParents(projectAreaId)

    if (hasAccessToParentPso(credentials.areas, projectAreaDetails)) {
      return null
    }
  }

  logger.warn(
    { userId: credentials.userId, referenceNumber, projectAreaId },
    'Download access denied: user lacks access to project area'
  )

  return buildErrorResponse(h, HTTP_STATUS.FORBIDDEN, [
    { errorCode: PROJECT_VALIDATION_MESSAGES.NOT_ALLOWED_TO_DOWNLOAD }
  ])
}
