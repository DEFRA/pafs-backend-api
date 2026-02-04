import { PROJECT_TYPES } from '../../../common/constants/project.js'

/**
 * Conversion directions and types for data transformations
 */
export const CONVERSION_DIRECTIONS = {
  TO_DATABASE: 'toDatabase',
  TO_API: 'toApi'
}

/**
 * Keys of the joined project tables
 */
export const PROJECT_JOIN_TABLES = {
  pafs_core_states: {
    tableName: 'pafs_core_states',
    joinField: 'project_id',
    fields: {
      projectState: 'state'
    }
  },
  pafs_core_area_projects: {
    tableName: 'pafs_core_area_projects',
    joinField: 'project_id',
    fields: {
      areaId: 'area_id',
      isOwner: 'owner'
    }
  }
}

/**
 * Common fields used for both create/update and read operations
 * Maps API field names to database column names in pafs_core_projects table
 * Note: rmaName is the area name string stored in DB, areaId comes from joined table
 */
export const PROJECT_FIELDS_MAP = {
  name: 'name',
  rmaName: 'rma_name', // This stores the area NAME (string), not ID
  projectType: 'project_type',
  projectInterventionTypes: 'project_intervention_types',
  mainInterventionType: 'main_intervention_type',
  financialStartYear: 'earliest_start_year',
  financialEndYear: 'project_end_financial_year',
  startOutlineBusinessCaseMonth: 'start_outline_business_case_month',
  startOutlineBusinessCaseYear: 'start_outline_business_case_year',
  completeOutlineBusinessCaseMonth: 'complete_outline_business_case_month',
  completeOutlineBusinessCaseYear: 'complete_outline_business_case_year',
  awardContractMonth: 'award_contract_month',
  awardContractYear: 'award_contract_year',
  startConstructionMonth: 'start_construction_month',
  startConstructionYear: 'start_construction_year',
  readyForServiceMonth: 'ready_for_service_month',
  readyForServiceYear: 'ready_for_service_year',
  couldStartEarly: 'could_start_early',
  earliestWithGiaMonth: 'earliest_with_gia_month',
  earliestWithGiaYear: 'earliest_with_gia_year'
}

/**
 * Read-only fields for SELECT queries (not used in create/update)
 * These fields are always fetched when reading project data
 */
export const PROJECT_SELECT_FIELDS_MAP = {
  ...PROJECT_FIELDS_MAP,
  id: 'id',
  referenceNumber: 'reference_number',
  slug: 'slug',
  isLegacy: 'is_legacy',
  updatedAt: 'updated_at',
  createdAt: 'created_at'
}

/**
 * Returns Prisma select object for main project fields
 * Used in queries to specify which fields to fetch
 */
export const getProjectSelectFields = () => {
  const selectFields = {}

  Object.values(PROJECT_SELECT_FIELDS_MAP).forEach((field) => {
    selectFields[field] = true
  })

  return selectFields
}

/**
 * Returns configuration for joined tables
 * Used for manual joins without foreign keys
 */
export const getJoinedTableConfig = () => {
  return structuredClone(PROJECT_JOIN_TABLES)
}

export const requiredInterventionTypesForProjectType = (projectType) => {
  const skipInterventionTypes = [
    PROJECT_TYPES.HCR,
    PROJECT_TYPES.STR,
    PROJECT_TYPES.STU,
    PROJECT_TYPES.ELO
  ]
  if (skipInterventionTypes.includes(projectType)) {
    return false
  }
  return true
}

/**
 * Returns Prisma select object for joined tables
 * Used in queries with include/joins
 */
export const getJoinedSelectFields = () => {
  return {
    ...Object.fromEntries(
      Object.entries(PROJECT_JOIN_TABLES).map(([tableKey, config]) => [
        tableKey,
        {
          select: Object.fromEntries(
            Object.values(config.fields).map((field) => [field, true])
          )
        }
      ])
    )
  }
}
