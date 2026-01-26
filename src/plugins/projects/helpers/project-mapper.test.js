import { describe, it, expect } from 'vitest'
import { ProjectMapper } from './project-mapper.js'

describe('ProjectMapper', () => {
  describe('toDatabase', () => {
    it('should map API data to database format', () => {
      const apiData = {
        name: 'Test Project',
        projectType: 'Type A',
        rmaId: 123
      }

      const result = ProjectMapper.toDatabase(apiData)

      expect(result).toHaveProperty('name', 'Test Project')
      expect(result).toHaveProperty('project_type', 'Type A')
      expect(result).toHaveProperty('rma_name', 123)
    })

    it('should skip undefined values', () => {
      const apiData = {
        name: 'Test Project',
        projectType: undefined,
        rmaId: 123
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
        rmaId: 123
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
        rmaId: 5,
        projectType: 'DEF',
        projectInterventionTypes: ['NFM', 'SUDS'],
        mainInterventionType: 'NFM',
        financialStartYear: '2024',
        financialEndYear: '2026'
      }

      const result = ProjectMapper.toDatabase(apiData)

      expect(result).toEqual({
        name: 'Complete Project',
        rma_name: 5,
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
        rma_name: 123
      }

      const result = ProjectMapper.toApi(dbData)

      expect(result).toHaveProperty('name', 'Test Project')
      expect(result).toHaveProperty('projectType', 'Type A')
      expect(result).toHaveProperty('rmaId', 123)
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
        rma_name: 5,
        project_type: 'DEF',
        project_intervention_types: 'NFM,SUDS',
        main_intervention_type: 'NFM',
        earliest_start_year: 2024,
        project_end_financial_year: 2026
      }

      const result = ProjectMapper.toApi(dbData)

      expect(result).toEqual({
        name: 'Complete Project',
        rmaId: 5,
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
      expect(result).toHaveProperty('rmaId')
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
      expect(ProjectMapper.transformValue('rmaId', 123)).toBe(123)
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

    it('should pass through other values unchanged', () => {
      expect(ProjectMapper.reverseTransformValue('name', 'Test')).toBe('Test')
      expect(ProjectMapper.reverseTransformValue('rmaId', 123)).toBe(123)
      expect(
        ProjectMapper.reverseTransformValue('financialStartYear', 2024)
      ).toBe(2024)
    })
  })

  describe('round-trip transformations', () => {
    it('should maintain data integrity through database and back to API', () => {
      const originalApi = {
        name: 'Test Project',
        rmaId: 5,
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
})
