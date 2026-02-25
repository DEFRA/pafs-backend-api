import { PROJECT_STATUS } from '../../../common/constants/project.js'

// Project select fields for Prisma queries
export const PROJECT_SELECT_FIELDS = {
  id: true,
  reference_number: true,
  slug: true,
  name: true,
  rma_name: true,
  is_legacy: true,
  is_revised: true,
  created_at: true,
  updated_at: true,
  submitted_at: true
}

export function formatProject(project, state = null) {
  const isLegacy = project.is_legacy ?? false
  const isRevised = project.is_revised ?? false
  const resolvedStatus = _resolveStatus(state, isLegacy, isRevised)

  return {
    id: Number(project.id),
    referenceNumber: project.reference_number,
    referenceNumberFormatted: project.slug,
    name: project.name,
    rmaName: project.rma_name,
    isLegacy,
    isRevised,
    status: resolvedStatus,
    createdAt: project.created_at,
    updatedAt: project.updated_at,
    submittedAt: project.submitted_at
  }
}

/**
 * Resolve the display status for a project.
 * Legacy projects that have not been migrated and are in draft state
 * should show as 'revise' instead of 'draft'.
 * @param {string|null} state - Current state from pafs_core_states
 * @param {boolean} isLegacy - Whether the project is legacy
 * @param {boolean} isRevised - Whether the project has been migrated
 * @returns {string} Resolved display status
 * @private
 */
function _resolveStatus(state, isLegacy, isRevised) {
  const status = state || PROJECT_STATUS.DRAFT

  if (status === PROJECT_STATUS.DRAFT && isLegacy && !isRevised) {
    return PROJECT_STATUS.REVISE
  }

  return status
}
