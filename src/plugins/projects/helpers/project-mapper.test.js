import { describe, it, expect } from 'vitest'
import { ProjectMapper } from './project-mapper.js'

describe('ProjectMapper', () => {
  describe('toDatabase', () => {
    it('should map API data to database format', () => {
      const apiData = {
        name: 'Test Project',
        projectType: 'Type A',
        rmaName: '123'
      }

      const result = ProjectMapper.toDatabase(apiData)

      expect(result).toHaveProperty('name', 'Test Project')
      expect(result).toHaveProperty('project_type', 'Type A')
      expect(result).toHaveProperty('rma_name', '123')
    })

    it('should skip undefined values', () => {
      const apiData = {
        name: 'Test Project',
        projectType: undefined,
        rmaName: 123
      }

      const result = ProjectMapper.toDatabase(apiData)

      expect(result).toHaveProperty('name')
      expect(result).not.toHaveProperty('project_type')
      expect(result).toHaveProperty('rma_name')
    })

    it('should skip unmapped fields', () => {
      const apiData = {
        name: 'Test Project',
        unmappedField: 'value',
        rmaName: 123
      }

      const result = ProjectMapper.toDatabase(apiData)

      expect(result).toHaveProperty('name')
      expect(result).not.toHaveProperty('unmappedField')
      expect(result).toHaveProperty('rma_name')
    })

    it('should transform projectInterventionTypes array to comma-separated string', () => {
      const apiData = {
        projectInterventionTypes: ['NFM', 'PFR', 'SUDS']
      }

      const result = ProjectMapper.toDatabase(apiData)

      expect(result).toHaveProperty(
        'project_intervention_types',
        'NFM,PFR,SUDS'
      )
    })

    it('should transform empty projectInterventionTypes array to empty string', () => {
      const apiData = {
        projectInterventionTypes: []
      }

      const result = ProjectMapper.toDatabase(apiData)

      expect(result).toHaveProperty('project_intervention_types', '')
    })

    it('should transform financialStartYear to integer', () => {
      const apiData = {
        financialStartYear: '2024'
      }

      const result = ProjectMapper.toDatabase(apiData)

      expect(result).toHaveProperty('earliest_start_year', 2024)
      expect(typeof result.earliest_start_year).toBe('number')
    })

    it('should transform financialEndYear to integer', () => {
      const apiData = {
        financialEndYear: '2025'
      }

      const result = ProjectMapper.toDatabase(apiData)

      expect(result).toHaveProperty('project_end_financial_year', 2025)
      expect(typeof result.project_end_financial_year).toBe('number')
    })

    it('should handle complete project data', () => {
      const apiData = {
        name: 'Complete Project',
        rmaName: '5',
        projectType: 'DEF',
        projectInterventionTypes: ['NFM', 'SUDS'],
        mainInterventionType: 'NFM',
        financialStartYear: '2024',
        financialEndYear: '2026'
      }

      const result = ProjectMapper.toDatabase(apiData)

      expect(result).toEqual({
        name: 'Complete Project',
        rma_name: '5',
        project_type: 'DEF',
        project_intervention_types: 'NFM,SUDS',
        main_intervention_type: 'NFM',
        earliest_start_year: 2024,
        project_end_financial_year: 2026
      })
    })
  })

  describe('toApi', () => {
    it('should map database data to API format', () => {
      const dbData = {
        name: 'Test Project',
        project_type: 'Type A',
        rma_name: '123'
      }

      const result = ProjectMapper.toApi(dbData)

      expect(result).toHaveProperty('name', 'Test Project')
      expect(result).toHaveProperty('projectType', 'Type A')
      expect(result).toHaveProperty('rmaName', '123')
    })

    it('should transform projectInterventionTypes string to array', () => {
      const dbData = {
        project_intervention_types: 'NFM,PFR,SUDS'
      }

      const result = ProjectMapper.toApi(dbData)

      expect(result).toHaveProperty('projectInterventionTypes')
      expect(Array.isArray(result.projectInterventionTypes)).toBe(true)
      expect(result.projectInterventionTypes).toEqual(['NFM', 'PFR', 'SUDS'])
    })

    it('should transform empty projectInterventionTypes string to empty array', () => {
      const dbData = {
        project_intervention_types: ''
      }

      const result = ProjectMapper.toApi(dbData)

      expect(result).toHaveProperty('projectInterventionTypes')
      expect(result.projectInterventionTypes).toEqual([])
    })

    it('should preserve numeric values for financial years', () => {
      const dbData = {
        earliest_start_year: 2024,
        project_end_financial_year: 2025
      }

      const result = ProjectMapper.toApi(dbData)

      expect(result).toHaveProperty('financialStartYear', 2024)
      expect(result).toHaveProperty('financialEndYear', 2025)
    })

    it('should handle complete project data', () => {
      const dbData = {
        name: 'Complete Project',
        rma_name: '5',
        project_type: 'DEF',
        project_intervention_types: 'NFM,SUDS',
        main_intervention_type: 'NFM',
        earliest_start_year: 2024,
        project_end_financial_year: 2026
      }

      const result = ProjectMapper.toApi(dbData)

      expect(result).toEqual({
        name: 'Complete Project',
        rmaName: '5',
        projectType: 'DEF',
        projectInterventionTypes: ['NFM', 'SUDS'],
        mainInterventionType: 'NFM',
        financialStartYear: 2024,
        financialEndYear: 2026
      })
    })

    it('should skip unmapped database fields', () => {
      const dbData = {
        name: 'Test Project',
        unmapped_db_field: 'value',
        rma_name: 123
      }

      const result = ProjectMapper.toApi(dbData)

      expect(result).toHaveProperty('name')
      expect(result).not.toHaveProperty('unmapped_db_field')
      expect(result).toHaveProperty('rmaName')
    })

    it('should map select-only fields from database', () => {
      const dbData = {
        id: BigInt(12345),
        reference_number: 'REF123',
        name: 'Test Project',
        updated_at: '2024-01-15T10:30:00Z'
      }

      const result = ProjectMapper.toApi(dbData)

      expect(result).toHaveProperty('id', 12345)
      expect(typeof result.id).toBe('number')
      expect(result).toHaveProperty('referenceNumber', 'REF123')
      expect(result).toHaveProperty('name', 'Test Project')
      expect(result).toHaveProperty('updatedAt', '2024-01-15T10:30:00Z')
    })

    it('should map joined fields from pafs_core_states', () => {
      const dbData = {
        name: 'Test Project',
        pafs_core_states: {
          state: 'draft'
        }
      }

      const result = ProjectMapper.toApi(dbData)

      expect(result).toHaveProperty('name', 'Test Project')
      expect(result).toHaveProperty('projectState', 'draft')
    })

    it('should map joined fields from pafs_core_area_projects', () => {
      const dbData = {
        name: 'Test Project',
        pafs_core_area_projects: {
          area_id: 42,
          owner: true
        }
      }

      const result = ProjectMapper.toApi(dbData)

      expect(result).toHaveProperty('name', 'Test Project')
      expect(result).toHaveProperty('areaId', 42)
      expect(result).toHaveProperty('isOwner', true)
    })

    it('should map complete data with all joined fields', () => {
      const dbData = {
        reference_number: 'REF123',
        name: 'Complete Project',
        rma_name: '5',
        project_type: 'DEF',
        project_intervention_types: 'NFM,SUDS',
        main_intervention_type: 'NFM',
        earliest_start_year: 2024,
        project_end_financial_year: 2026,
        updated_at: '2024-01-15T10:30:00Z',
        pafs_core_states: {
          state: 'submitted'
        },
        pafs_core_area_projects: {
          area_id: 10,
          owner: false
        }
      }

      const result = ProjectMapper.toApi(dbData)

      expect(result).toEqual({
        referenceNumber: 'REF123',
        name: 'Complete Project',
        rmaName: '5',
        projectType: 'DEF',
        projectInterventionTypes: ['NFM', 'SUDS'],
        mainInterventionType: 'NFM',
        financialStartYear: 2024,
        financialEndYear: 2026,
        updatedAt: '2024-01-15T10:30:00Z',
        projectState: 'submitted',
        areaId: 10,
        isOwner: false
      })
    })
  })

  describe('transformValue', () => {
    it('should join arrays for projectInterventionTypes', () => {
      const result = ProjectMapper.transformValue('projectInterventionTypes', [
        'NFM',
        'PFR'
      ])
      expect(result).toBe('NFM,PFR')
    })

    it('should parse financialStartYear as integer', () => {
      const result = ProjectMapper.transformValue('financialStartYear', '2024')
      expect(result).toBe(2024)
      expect(typeof result).toBe('number')
    })

    it('should parse financialEndYear as integer', () => {
      const result = ProjectMapper.transformValue('financialEndYear', '2025')
      expect(result).toBe(2025)
      expect(typeof result).toBe('number')
    })

    it('should pass through other values unchanged', () => {
      expect(ProjectMapper.transformValue('name', 'Test')).toBe('Test')
      expect(ProjectMapper.transformValue('rmaName', '123')).toBe('123')
      expect(ProjectMapper.transformValue('projectType', 'DEF')).toBe('DEF')
    })
  })

  describe('reverseTransformValue', () => {
    it('should split strings for projectInterventionTypes', () => {
      const result = ProjectMapper.reverseTransformValue(
        'projectInterventionTypes',
        'NFM,PFR,SUDS'
      )
      expect(Array.isArray(result)).toBe(true)
      expect(result).toEqual(['NFM', 'PFR', 'SUDS'])
    })

    it('should return empty array for empty projectInterventionTypes string', () => {
      const result = ProjectMapper.reverseTransformValue(
        'projectInterventionTypes',
        ''
      )
      expect(Array.isArray(result)).toBe(true)
      expect(result).toEqual([])
    })

    it('should return empty array for null projectInterventionTypes', () => {
      const result = ProjectMapper.reverseTransformValue(
        'projectInterventionTypes',
        null
      )
      expect(Array.isArray(result)).toBe(true)
      expect(result).toEqual([])
    })

    it('should return empty array for undefined projectInterventionTypes', () => {
      const result = ProjectMapper.reverseTransformValue(
        'projectInterventionTypes',
        undefined
      )
      expect(Array.isArray(result)).toBe(true)
      expect(result).toEqual([])
    })

    it('should convert string years to numbers for financialStartYear', () => {
      const result = ProjectMapper.reverseTransformValue(
        'financialStartYear',
        '2024'
      )
      expect(result).toBe(2024)
      expect(typeof result).toBe('number')
    })

    it('should convert string years to numbers for financialEndYear', () => {
      const result = ProjectMapper.reverseTransformValue(
        'financialEndYear',
        '2025'
      )
      expect(result).toBe(2025)
      expect(typeof result).toBe('number')
    })

    it('should preserve numeric years for financialStartYear', () => {
      const result = ProjectMapper.reverseTransformValue(
        'financialStartYear',
        2024
      )
      expect(result).toBe(2024)
      expect(typeof result).toBe('number')
    })

    it('should convert bigint id to integer for API', () => {
      const result = ProjectMapper.reverseTransformValue('id', BigInt(123))
      expect(result).toBe(123)
      expect(typeof result).toBe('number')
    })

    it('should preserve numeric id values', () => {
      const result = ProjectMapper.reverseTransformValue('id', 456)
      expect(result).toBe(456)
      expect(typeof result).toBe('number')
    })

    it('should convert string id to integer', () => {
      const result = ProjectMapper.reverseTransformValue('id', '789')
      expect(result).toBe(789)
      expect(typeof result).toBe('number')
    })

    it('should pass through other values unchanged', () => {
      expect(ProjectMapper.reverseTransformValue('name', 'Test')).toBe('Test')
      expect(ProjectMapper.reverseTransformValue('rmaName', '123')).toBe('123')
      expect(
        ProjectMapper.reverseTransformValue('financialStartYear', 2024)
      ).toBe(2024)
    })
  })

  describe('round-trip transformations', () => {
    it('should maintain data integrity through database and back to API', () => {
      const originalApi = {
        name: 'Test Project',
        rmaName: '5',
        projectType: 'DEF',
        projectInterventionTypes: ['NFM', 'SUDS'],
        mainInterventionType: 'NFM',
        financialStartYear: 2024,
        financialEndYear: 2026
      }

      const dbData = ProjectMapper.toDatabase(originalApi)
      const resultApi = ProjectMapper.toApi(dbData)

      expect(resultApi).toEqual(originalApi)
    })
  })

  describe('toApi with nested Prisma data', () => {
    it('should flatten and map nested pafs_core_states data', () => {
      const nestedDbData = {
        reference_number: 'REF123',
        name: 'Test Project',
        rma_name: '5',
        pafs_core_states: {
          state: 'draft'
        }
      }

      const result = ProjectMapper.toApi(nestedDbData)

      expect(result).toEqual({
        referenceNumber: 'REF123',
        name: 'Test Project',
        rmaName: '5',
        projectState: 'draft'
      })
    })

    it('should flatten and map nested pafs_core_area_projects object', () => {
      const nestedDbData = {
        reference_number: 'REF123',
        name: 'Test Project',
        pafs_core_area_projects: {
          area_id: 42,
          owner: true
        }
      }

      const result = ProjectMapper.toApi(nestedDbData)

      expect(result).toEqual({
        referenceNumber: 'REF123',
        name: 'Test Project',
        areaId: 42,
        isOwner: true
      })
    })

    it('should flatten and map nested pafs_core_area_projects array', () => {
      const nestedDbData = {
        reference_number: 'REF123',
        name: 'Test Project',
        pafs_core_area_projects: [
          {
            area_id: 42,
            owner: true
          },
          {
            area_id: 43,
            owner: false
          }
        ]
      }

      const result = ProjectMapper.toApi(nestedDbData)

      // Should use first element
      expect(result).toEqual({
        referenceNumber: 'REF123',
        name: 'Test Project',
        areaId: 42,
        isOwner: true
      })
    })

    it('should handle empty pafs_core_area_projects array', () => {
      const nestedDbData = {
        reference_number: 'REF123',
        name: 'Test Project',
        pafs_core_area_projects: []
      }

      const result = ProjectMapper.toApi(nestedDbData)

      expect(result).toEqual({
        referenceNumber: 'REF123',
        name: 'Test Project'
      })
    })

    it('should handle all nested data together', () => {
      const nestedDbData = {
        reference_number: 'REF123',
        name: 'Complete Project',
        rma_name: '5',
        project_type: 'DEF',
        project_intervention_types: 'NFM,SUDS',
        main_intervention_type: 'NFM',
        earliest_start_year: 2024,
        project_end_financial_year: 2026,
        updated_at: '2024-01-15T10:30:00Z',
        pafs_core_states: {
          state: 'submitted'
        },
        pafs_core_area_projects: {
          area_id: 10,
          owner: false
        }
      }

      const result = ProjectMapper.toApi(nestedDbData)

      expect(result).toEqual({
        referenceNumber: 'REF123',
        name: 'Complete Project',
        rmaName: '5',
        projectType: 'DEF',
        projectInterventionTypes: ['NFM', 'SUDS'],
        mainInterventionType: 'NFM',
        financialStartYear: 2024,
        financialEndYear: 2026,
        updatedAt: '2024-01-15T10:30:00Z',
        projectState: 'submitted',
        areaId: 10,
        isOwner: false
      })
    })

    it('should handle missing nested data gracefully', () => {
      const nestedDbData = {
        reference_number: 'REF123',
        name: 'Test Project'
      }

      const result = ProjectMapper.toApi(nestedDbData)

      expect(result).toEqual({
        referenceNumber: 'REF123',
        name: 'Test Project'
      })
    })
  })
})
