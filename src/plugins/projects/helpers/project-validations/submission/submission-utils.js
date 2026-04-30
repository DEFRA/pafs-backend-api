import {
  PROJECT_TYPES,
  PROJECT_INTERVENTION_TYPES
} from '../../../../../common/constants/project.js'

/**
 * Returns true when a value is non-null, non-undefined, and non-empty-string.
 * Shared across all submission validator modules.
 */
export const hasValue = (v) => v !== null && v !== undefined && v !== ''

/**
 * Project types that require the full WL submission checklist
 * (DEF/REF/REP — intervention types, dates, WLC, WLB, confidence, NFM).
 */
export const MANDATORY_WL_TYPES = new Set([
  PROJECT_TYPES.DEF,
  PROJECT_TYPES.REF,
  PROJECT_TYPES.REP
])

/**
 * Intervention types that trigger the NFM section requirement.
 */
export const NFM_INTERVENTION_TYPES = new Set([
  PROJECT_INTERVENTION_TYPES.NFM,
  PROJECT_INTERVENTION_TYPES.SUDS
])
