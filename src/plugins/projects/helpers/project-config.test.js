import { describe, it, expect } from 'vitest'
import {
  PROJECT_FIELDS_MAP,
  PROJECT_SELECT_FIELDS_MAP,
  PROJECT_JOIN_TABLES,
  CONVERSION_DIRECTIONS,
  getProjectSelectFields,
  getJoinedTableConfig,
  getJoinedSelectFields,
  requiredInterventionTypesForProjectType
} from './project-config.js'
import { PROJECT_TYPES } from '../../../common/constants/project.js'

describe('project-config', () => {
  describe('CONVERSION_DIRECTIONS', () => {
    it('should have TO_DATABASE direction', () => {
      expect(CONVERSION_DIRECTIONS).toHaveProperty('TO_DATABASE', 'toDatabase')
    })

    it('should have TO_API direction', () => {
      expect(CONVERSION_DIRECTIONS).toHaveProperty('TO_API', 'toApi')
    })

    it('should have exactly 2 conversion directions', () => {
      expect(Object.keys(CONVERSION_DIRECTIONS)).toHaveLength(2)
    })
  })

  describe('PROJECT_FIELDS_MAP', () => {
    it('should have correct field mappings', () => {
      expect(PROJECT_FIELDS_MAP).toEqual({
        name: 'name',
        rmaName: 'rma_name',
        projectType: 'project_type',
        projectInterventionTypes: 'project_intervention_types',
        mainInterventionType: 'main_intervention_type',
        financialStartYear: 'earliest_start_year',
        financialEndYear: 'project_end_financial_year',
        startOutlineBusinessCaseMonth: 'start_outline_business_case_month',
        startOutlineBusinessCaseYear: 'start_outline_business_case_year',
        completeOutlineBusinessCaseMonth:
          'complete_outline_business_case_month',
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
      })
    })

    it('should have all required fields', () => {
      expect(PROJECT_FIELDS_MAP).toHaveProperty('name')
      expect(PROJECT_FIELDS_MAP).toHaveProperty('rmaName')
      expect(PROJECT_FIELDS_MAP).toHaveProperty('projectType')
      expect(PROJECT_FIELDS_MAP).toHaveProperty('projectInterventionTypes')
      expect(PROJECT_FIELDS_MAP).toHaveProperty('mainInterventionType')
      expect(PROJECT_FIELDS_MAP).toHaveProperty('financialStartYear')
      expect(PROJECT_FIELDS_MAP).toHaveProperty('financialEndYear')
    })

    it('should have snake_case database column names', () => {
      const values = Object.values(PROJECT_FIELDS_MAP)
      values.forEach((value) => {
        if (value !== 'name') {
          // 'name' is same in both
          expect(value).toMatch(/^[a-z_]+$/)
        }
      })
    })
  })

  describe('PROJECT_SELECT_FIELDS_MAP', () => {
    it('should include all PROJECT_FIELDS_MAP fields', () => {
      Object.entries(PROJECT_FIELDS_MAP).forEach(([key, value]) => {
        expect(PROJECT_SELECT_FIELDS_MAP).toHaveProperty(key, value)
      })
    })

    it('should have additional read-only fields', () => {
      expect(PROJECT_SELECT_FIELDS_MAP).toHaveProperty(
        'referenceNumber',
        'reference_number'
      )
      expect(PROJECT_SELECT_FIELDS_MAP).toHaveProperty(
        'updatedAt',
        'updated_at'
      )
      expect(PROJECT_SELECT_FIELDS_MAP).toHaveProperty(
        'createdAt',
        'created_at'
      )
    })

    it('should have 25 total fields (20 common + 5 read-only)', () => {
      expect(Object.keys(PROJECT_SELECT_FIELDS_MAP)).toHaveLength(25)
    })
  })

  describe('PROJECT_JOIN_TABLES', () => {
    it('should have pafs_core_states table mapping', () => {
      expect(PROJECT_JOIN_TABLES).toHaveProperty('pafs_core_states')
      expect(PROJECT_JOIN_TABLES.pafs_core_states).toEqual({
        tableName: 'pafs_core_states',
        joinField: 'project_id',
        fields: {
          projectState: 'state'
        }
      })
    })

    it('should have pafs_core_area_projects table mapping', () => {
      expect(PROJECT_JOIN_TABLES).toHaveProperty('pafs_core_area_projects')
      expect(PROJECT_JOIN_TABLES.pafs_core_area_projects).toEqual({
        tableName: 'pafs_core_area_projects',
        joinField: 'project_id',
        fields: {
          areaId: 'area_id',
          isOwner: 'owner'
        }
      })
    })

    it('should have exactly 2 joined tables', () => {
      expect(Object.keys(PROJECT_JOIN_TABLES)).toHaveLength(2)
    })
  })

  describe('getProjectSelectFields', () => {
    it('should return all fields with true values', () => {
      const result = getProjectSelectFields()

      expect(result.name).toBe(true)
      expect(result.rma_name).toBe(true)
      expect(result.project_type).toBe(true)
      expect(result.project_intervention_types).toBe(true)
      expect(result.main_intervention_type).toBe(true)
      expect(result.earliest_start_year).toBe(true)
      expect(result.project_end_financial_year).toBe(true)
      expect(result.reference_number).toBe(true)
      expect(result.is_legacy).toBe(true)
      expect(result.updated_at).toBe(true)
      expect(result.created_at).toBe(true)
      expect(result.slug).toBe(true)
    })

    it('should return an object with 25 fields', () => {
      const result = getProjectSelectFields()
      expect(Object.keys(result)).toHaveLength(25)
    })

    it('should return a new object each time', () => {
      const result1 = getProjectSelectFields()
      const result2 = getProjectSelectFields()
      expect(result1).not.toBe(result2)
      expect(result1).toEqual(result2)
    })

    it('should have all values as true for Prisma select', () => {
      const result = getProjectSelectFields()
      Object.values(result).forEach((value) => {
        expect(value).toBe(true)
      })
    })
  })

  describe('getJoinedTableConfig', () => {
    it('should return pafs_core_states with correct structure', () => {
      const result = getJoinedTableConfig()

      expect(result).toHaveProperty('pafs_core_states')
      expect(result.pafs_core_states).toHaveProperty(
        'tableName',
        'pafs_core_states'
      )
      expect(result.pafs_core_states).toHaveProperty('joinField', 'project_id')
      expect(result.pafs_core_states).toHaveProperty('fields')
      expect(result.pafs_core_states.fields).toEqual({
        projectState: 'state'
      })
    })

    it('should return pafs_core_area_projects with correct structure', () => {
      const result = getJoinedTableConfig()

      expect(result).toHaveProperty('pafs_core_area_projects')
      expect(result.pafs_core_area_projects).toHaveProperty(
        'tableName',
        'pafs_core_area_projects'
      )
      expect(result.pafs_core_area_projects).toHaveProperty(
        'joinField',
        'project_id'
      )
      expect(result.pafs_core_area_projects).toHaveProperty('fields')
      expect(result.pafs_core_area_projects.fields).toEqual({
        areaId: 'area_id',
        isOwner: 'owner'
      })
    })

    it('should return exactly 2 joined tables', () => {
      const result = getJoinedTableConfig()
      expect(Object.keys(result)).toHaveLength(2)
    })

    it('should have valid table configuration structure', () => {
      const result = getJoinedTableConfig()

      Object.values(result).forEach((tableConfig) => {
        expect(tableConfig).toHaveProperty('tableName')
        expect(tableConfig).toHaveProperty('joinField')
        expect(tableConfig).toHaveProperty('fields')
        expect(typeof tableConfig.tableName).toBe('string')
        expect(typeof tableConfig.joinField).toBe('string')
        expect(typeof tableConfig.fields).toBe('object')
      })
    })

    it('should return a new object each time', () => {
      const result1 = getJoinedTableConfig()
      const result2 = getJoinedTableConfig()
      expect(result1).not.toBe(result2)
      expect(result1).toEqual(result2)
    })
  })

  describe('getJoinedSelectFields', () => {
    it('should return Prisma select object for joined tables', () => {
      const result = getJoinedSelectFields()

      expect(result).toHaveProperty('pafs_core_states')
      expect(result).toHaveProperty('pafs_core_area_projects')
    })

    it('should have correct structure for pafs_core_states', () => {
      const result = getJoinedSelectFields()

      expect(result.pafs_core_states).toHaveProperty('select')
      expect(result.pafs_core_states.select).toEqual({
        state: true
      })
    })

    it('should have correct structure for pafs_core_area_projects', () => {
      const result = getJoinedSelectFields()

      expect(result.pafs_core_area_projects).toHaveProperty('select')
      expect(result.pafs_core_area_projects.select).toEqual({
        area_id: true,
        owner: true
      })
    })

    it('should return exactly 2 joined tables', () => {
      const result = getJoinedSelectFields()
      expect(Object.keys(result)).toHaveLength(2)
    })

    it('should have all select values as true', () => {
      const result = getJoinedSelectFields()

      Object.values(result).forEach((tableConfig) => {
        expect(tableConfig).toHaveProperty('select')
        Object.values(tableConfig.select).forEach((value) => {
          expect(value).toBe(true)
        })
      })
    })

    it('should match structure expected by Prisma', () => {
      const result = getJoinedSelectFields()

      Object.entries(result).forEach(([tableKey, config]) => {
        expect(typeof tableKey).toBe('string')
        expect(config).toHaveProperty('select')
        expect(typeof config.select).toBe('object')
      })
    })

    it('should return a new object each time', () => {
      const result1 = getJoinedSelectFields()
      const result2 = getJoinedSelectFields()
      expect(result1).not.toBe(result2)
      expect(result1).toEqual(result2)
    })

    it('should create select fields from PROJECT_JOIN_TABLES config', () => {
      const result = getJoinedSelectFields()

      // Verify it uses the fields from PROJECT_JOIN_TABLES
      Object.entries(PROJECT_JOIN_TABLES).forEach(([tableKey, config]) => {
        expect(result[tableKey]).toBeDefined()
        Object.values(config.fields).forEach((dbField) => {
          expect(result[tableKey].select[dbField]).toBe(true)
        })
      })
    })
  })

  describe('requiredInterventionTypesForProjectType', () => {
    it('should return false for HCR project type', () => {
      expect(requiredInterventionTypesForProjectType(PROJECT_TYPES.HCR)).toBe(
        false
      )
    })

    it('should return false for STR project type', () => {
      expect(requiredInterventionTypesForProjectType(PROJECT_TYPES.STR)).toBe(
        false
      )
    })

    it('should return false for STU project type', () => {
      expect(requiredInterventionTypesForProjectType(PROJECT_TYPES.STU)).toBe(
        false
      )
    })

    it('should return false for ELO project type', () => {
      expect(requiredInterventionTypesForProjectType(PROJECT_TYPES.ELO)).toBe(
        false
      )
    })

    it('should return true for DEF project type', () => {
      expect(requiredInterventionTypesForProjectType(PROJECT_TYPES.DEF)).toBe(
        true
      )
    })

    it('should return true for REP project type', () => {
      expect(requiredInterventionTypesForProjectType(PROJECT_TYPES.REP)).toBe(
        true
      )
    })

    it('should return true for REF project type', () => {
      expect(requiredInterventionTypesForProjectType(PROJECT_TYPES.REF)).toBe(
        true
      )
    })

    it('should return true for unknown project types', () => {
      expect(requiredInterventionTypesForProjectType('UNKNOWN')).toBe(true)
    })
  })

  describe('field consistency', () => {
    it('should have unique database column names across all maps', () => {
      const allDbColumns = [
        ...Object.values(PROJECT_FIELDS_MAP),
        ...Object.values(PROJECT_SELECT_FIELDS_MAP).filter(
          (col) => !Object.values(PROJECT_FIELDS_MAP).includes(col)
        )
      ]

      const uniqueColumns = new Set(allDbColumns)
      expect(uniqueColumns.size).toBe(allDbColumns.length)
    })

    it('should have camelCase API field names', () => {
      const allApiFields = [
        ...Object.keys(PROJECT_FIELDS_MAP),
        ...Object.keys(PROJECT_SELECT_FIELDS_MAP)
      ]

      allApiFields.forEach((field) => {
        expect(field).toMatch(/^[a-z][a-zA-Z0-9]*$/)
      })
    })

    it('should have snake_case database column names in joined tables', () => {
      Object.values(PROJECT_JOIN_TABLES).forEach((tableConfig) => {
        // Check tableName is snake_case
        expect(tableConfig.tableName).toMatch(/^[a-z_]+$/)
        // Check joinField is snake_case
        expect(tableConfig.joinField).toMatch(/^[a-z_]+$/)
        // Check field values (db columns) are snake_case
        Object.values(tableConfig.fields).forEach((dbColumn) => {
          expect(dbColumn).toMatch(/^[a-z_]+$/)
        })
      })
    })
  })
})
