import {
  PROJECT_INTERVENTION_TYPES,
  PROJECT_TYPES,
  LEGACY_PROJECT_TYPES
} from '../../../common/constants/project.js'

/**
 * Old PAFS project type codes that require migration.
 */
const OLD_PROJECT_TYPES = new Set(Object.values(LEGACY_PROJECT_TYPES))

/**
 * Types that require Decision 2 (NFM) and Decision 3 (PLP) evaluation.
 */
const TYPES_REQUIRING_NFM_AND_PLP = new Set([LEGACY_PROJECT_TYPES.DEF])

/**
 * Types that require only Decision 2 (NFM) evaluation.
 */
const TYPES_REQUIRING_NFM_ONLY = new Set([LEGACY_PROJECT_TYPES.PLP])

/**
 * Types that have no intervention types (ENV, ENN, STR).
 */
const TYPES_WITHOUT_INTERVENTIONS = new Set([
  LEGACY_PROJECT_TYPES.ENV,
  LEGACY_PROJECT_TYPES.ENN,
  LEGACY_PROJECT_TYPES.STR
])

/**
 * Map old project type → new project type.
 */
const PROJECT_TYPE_MAP = {
  [LEGACY_PROJECT_TYPES.CM]: null,
  [LEGACY_PROJECT_TYPES.DEF]: PROJECT_TYPES.DEF,
  [LEGACY_PROJECT_TYPES.PLP]: PROJECT_TYPES.DEF,
  [LEGACY_PROJECT_TYPES.ENV]: PROJECT_TYPES.ELO,
  [LEGACY_PROJECT_TYPES.ENN]: PROJECT_TYPES.ELO,
  [LEGACY_PROJECT_TYPES.STR]: PROJECT_TYPES.STR
}

/**
 * Determine if the project needs legacy migration.
 * Only applies to projects where is_legacy=true and the project_type
 * is one of the old codes AND intervention types have not yet been set.
 *
 * For types where project_type code stays the same after migration (DEF→DEF,
 * STR→STR), a populated project_intervention_types field is the sentinel that
 * migration has already run. This prevents the migration from re-firing on
 * every overview load and overwriting user-edited intervention type values.
 *
 * @param {object} project - Raw project record from DB
 * @returns {boolean}
 */
export function requiresLegacyMigration(project) {
  if (!project.is_legacy) {
    return false
  }

  const projectType = project.project_type
  if (!OLD_PROJECT_TYPES.has(projectType)) {
    return false
  }

  // Intervention types being set is the sentinel that migration has already run.
  // DEF and PLP→DEF always produce non-null intervention types, so once the field
  // is populated the on-the-fly migration must not overwrite user-edited values.
  const interventionTypes = project.project_intervention_types
  if (
    interventionTypes !== null &&
    interventionTypes !== undefined &&
    interventionTypes !== ''
  ) {
    return false
  }

  return true
}

/**
 * Determine Decision 2: Does the project include Natural Flood Measures?
 * Checks the `natural_flood_risk_measures_included` field on pafs_core_projects.
 *
 * Validation rule 2: If null for CM/DEF/PLP types, default to false and log warning.
 *
 * @param {object} project - Raw project record
 * @param {object} logger - Logger instance
 * @returns {boolean}
 */
function resolveNfmDecision(project, logger) {
  const nfm = project.natural_flood_risk_measures_included

  if (nfm === null || nfm === undefined) {
    logger.warn(
      {
        referenceNumber: project.reference_number,
        projectType: project.project_type
      },
      'Legacy migration: NFM field is null — defaulting to false (validation rule 2)'
    )
    return false
  }

  return Boolean(nfm)
}

/**
 * Determine Decision 3: Are there any PLP households protected?
 * Checks `households_protected_through_plp_measures` on pafs_core_flood_protection_outcomes.
 *
 * Validation rule 3: If values are missing/non-numeric, default to 0 and log warning.
 *
 * @param {object} prisma - Prisma client
 * @param {bigint|number} projectId - Project ID
 * @param {string} referenceNumber - For logging
 * @param {object} logger - Logger instance
 * @returns {Promise<boolean>}
 */
async function resolvePlpDecision(prisma, projectId, referenceNumber, logger) {
  const outcomes = await prisma.pafs_core_flood_protection_outcomes.findMany({
    where: { project_id: Number(projectId) },
    select: { households_protected_through_plp_measures: true }
  })

  if (!outcomes || outcomes.length === 0) {
    logger.warn(
      { referenceNumber },
      'Legacy migration: No flood protection outcomes found — defaulting PLP to false (validation rule 3)'
    )
    return false
  }

  return outcomes.some((outcome) => {
    const value = outcome.households_protected_through_plp_measures
    if (value === null || value === undefined) {
      return false
    }
    return Number(value) > 0
  })
}

/**
 * Compute intervention types for DEF projects (CM maps to null, but DEF is the
 * only type that reaches this path). Evaluates all four NFM × PLP combinations.
 *
 * @param {boolean} nfmIncluded - Decision 2 result
 * @param {boolean} plpPresent - Decision 3 result
 * @returns {{ interventionTypes: string, mainInterventionType: string }}
 */
function computeDefInterventionTypes(nfmIncluded, plpPresent) {
  if (nfmIncluded && plpPresent) {
    return {
      interventionTypes: [
        PROJECT_INTERVENTION_TYPES.NFM,
        PROJECT_INTERVENTION_TYPES.PFR,
        PROJECT_INTERVENTION_TYPES.OTHER
      ].join(','),
      mainInterventionType: PROJECT_INTERVENTION_TYPES.OTHER
    }
  }

  if (nfmIncluded) {
    return {
      interventionTypes: [
        PROJECT_INTERVENTION_TYPES.NFM,
        PROJECT_INTERVENTION_TYPES.OTHER
      ].join(','),
      mainInterventionType: PROJECT_INTERVENTION_TYPES.OTHER
    }
  }

  if (plpPresent) {
    return {
      interventionTypes: [
        PROJECT_INTERVENTION_TYPES.PFR,
        PROJECT_INTERVENTION_TYPES.OTHER
      ].join(','),
      mainInterventionType: PROJECT_INTERVENTION_TYPES.OTHER
    }
  }

  return {
    interventionTypes: PROJECT_INTERVENTION_TYPES.OTHER,
    mainInterventionType: PROJECT_INTERVENTION_TYPES.OTHER
  }
}

/**
 * Compute the new intervention types and main intervention type based on
 * the old project type and decision criteria.
 *
 * @param {string} oldProjectType - Old PAFS project type code
 * @param {boolean} nfmIncluded - Decision 2 result
 * @param {boolean} plpPresent - Decision 3 result
 * @returns {{ interventionTypes: string|null, mainInterventionType: string|null }}
 */
function computeInterventionTypes(oldProjectType, nfmIncluded, plpPresent) {
  // CM, ENV, ENN, STR → no intervention types
  if (
    oldProjectType === LEGACY_PROJECT_TYPES.CM ||
    TYPES_WITHOUT_INTERVENTIONS.has(oldProjectType)
  ) {
    return { interventionTypes: null, mainInterventionType: null }
  }

  // PLP → always PFR as main, Decision 3 not applicable
  if (oldProjectType === LEGACY_PROJECT_TYPES.PLP) {
    const types = nfmIncluded
      ? [PROJECT_INTERVENTION_TYPES.NFM, PROJECT_INTERVENTION_TYPES.PFR]
      : [PROJECT_INTERVENTION_TYPES.PFR]

    return {
      interventionTypes: types.join(','),
      mainInterventionType: PROJECT_INTERVENTION_TYPES.PFR
    }
  }

  // DEF → evaluate both NFM and PLP decisions
  return computeDefInterventionTypes(nfmIncluded, plpPresent)
}

/**
 * Execute the legacy project type migration for a single project.
 * This is triggered when a user opens a legacy proposal overview page.
 *
 * Steps:
 * 1. Validate old project type (rule 1)
 * 2. Resolve NFM decision (rule 2) from pafs_core_projects.natural_flood_risk_measures_included
 * 3. Resolve PLP decision (rule 3) from pafs_core_flood_protection_outcomes.households_protected_through_plp_measures
 * 4. Compute new project_type, intervention_types, main_intervention_type
 * 5. Persist the transformed values
 *
 * @param {object} prisma - Prisma client
 * @param {object} project - Raw project record from DB
 * @param {object} logger - Logger instance
 * @returns {Promise<object>} Updated project record fields
 */
export async function executeLegacyProjectTypeMigration(
  prisma,
  project,
  logger
) {
  const oldProjectType = project.project_type
  const referenceNumber = project.reference_number

  logger.info(
    { referenceNumber, oldProjectType },
    'Legacy migration: Starting project type transformation'
  )

  // Validation rule 1: project type must be one of the old codes
  if (!OLD_PROJECT_TYPES.has(oldProjectType)) {
    logger.error(
      { referenceNumber, oldProjectType },
      'Legacy migration: Unknown old project type — flagged for manual review'
    )
    return null
  }

  // Step 1: Map project type
  const newProjectType = PROJECT_TYPE_MAP[oldProjectType]

  // Step 2: Resolve NFM decision (only for CM, DEF, PLP)
  let nfmIncluded = false
  if (
    TYPES_REQUIRING_NFM_AND_PLP.has(oldProjectType) ||
    TYPES_REQUIRING_NFM_ONLY.has(oldProjectType)
  ) {
    nfmIncluded = resolveNfmDecision(project, logger)
  }

  // Step 3: Resolve PLP decision (only for CM, DEF)
  let plpPresent = false
  if (TYPES_REQUIRING_NFM_AND_PLP.has(oldProjectType)) {
    plpPresent = await resolvePlpDecision(
      prisma,
      project.id,
      referenceNumber,
      logger
    )
  }

  // Step 4: Compute intervention types
  const { interventionTypes, mainInterventionType } = computeInterventionTypes(
    oldProjectType,
    nfmIncluded,
    plpPresent
  )

  // Step 5: Persist the transformation
  const updateData = {
    project_type: newProjectType,
    project_intervention_types: interventionTypes,
    main_intervention_type: mainInterventionType,
    updated_at: new Date()
  }

  await prisma.pafs_core_projects.update({
    where: { id: project.id },
    data: updateData
  })

  logger.info(
    {
      referenceNumber,
      oldProjectType,
      newProjectType,
      interventionTypes,
      mainInterventionType
    },
    'Legacy migration: Project type transformation completed and saved'
  )

  // Return the updated fields so caller can apply them to the in-memory project
  return updateData
}
