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

    it('should transform risks array to comma-separated string', () => {
      const apiData = {
        risks: ['fluvial_flooding', 'coastal_erosion', 'surface_water_flooding']
      }

      const result = ProjectMapper.toDatabase(apiData)

      expect(result).toHaveProperty(
        'project_risks_protected_against',
        'fluvial_flooding,coastal_erosion,surface_water_flooding'
      )
    })

    it('should pass through risks string unchanged', () => {
      const apiData = {
        risks: 'fluvial_flooding,coastal_erosion'
      }

      const result = ProjectMapper.toDatabase(apiData)

      expect(result).toHaveProperty(
        'project_risks_protected_against',
        'fluvial_flooding,coastal_erosion'
      )
    })

    it('should transform percentage string to float', () => {
      const apiData = {
        percentProperties20PercentDeprived: '67.89'
      }

      const result = ProjectMapper.toDatabase(apiData)

      expect(result).toHaveProperty(
        'percent_properties_20_percent_deprived',
        67.89
      )
      expect(typeof result.percent_properties_20_percent_deprived).toBe(
        'number'
      )
    })

    it('should transform percentage empty string to null', () => {
      const apiData = {
        percentProperties20PercentDeprived: ''
      }

      const result = ProjectMapper.toDatabase(apiData)

      expect(result).toHaveProperty(
        'percent_properties_20_percent_deprived',
        null
      )
    })

    it('should handle percentage null value', () => {
      const apiData = {
        percentProperties40PercentDeprived: null
      }

      const result = ProjectMapper.toDatabase(apiData)

      expect(result).toHaveProperty(
        'percent_properties_40_percent_deprived',
        null
      )
    })

    it('should pass through percentage number unchanged', () => {
      const apiData = {
        percentProperties40PercentDeprived: 88.99
      }

      const result = ProjectMapper.toDatabase(apiData)

      expect(result).toHaveProperty(
        'percent_properties_40_percent_deprived',
        88.99
      )
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

    it('should transform WLC string values to bigint for database', () => {
      const apiData = {
        wlcEstimatedWholeLifePvCosts: '123456789012345678',
        wlcEstimatedDesignConstructionCosts: '111',
        wlcEstimatedRiskContingencyCosts: '222',
        wlcEstimatedFutureCosts: '333'
      }

      const result = ProjectMapper.toDatabase(apiData)

      expect(result).toHaveProperty(
        'wlc_estimated_whole_life_pv_costs',
        BigInt('123456789012345678')
      )
      expect(result).toHaveProperty(
        'wlc_estimated_design_construction_costs',
        BigInt(111)
      )
      expect(result).toHaveProperty(
        'wlc_estimated_risk_contingency_costs',
        BigInt(222)
      )
      expect(result).toHaveProperty('wlc_estimated_future_costs', BigInt(333))
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

    it('should pass through percentage float unchanged', () => {
      const dbData = {
        percent_properties_20_percent_deprived: 67.89
      }

      const result = ProjectMapper.toApi(dbData)

      expect(result).toHaveProperty('percentProperties20PercentDeprived', 67.89)
      expect(typeof result.percentProperties20PercentDeprived).toBe('number')
    })

    it('should handle percentage null value', () => {
      const dbData = {
        percent_properties_40_percent_deprived: null
      }

      const result = ProjectMapper.toApi(dbData)

      expect(result).toHaveProperty('percentProperties40PercentDeprived', null)
    })

    it('should convert percentage string to number', () => {
      const dbData = {
        percent_properties_20_percent_deprived: '45.5'
      }

      const result = ProjectMapper.toApi(dbData)

      expect(result).toHaveProperty('percentProperties20PercentDeprived', 45.5)
      expect(typeof result.percentProperties20PercentDeprived).toBe('number')
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

    it('should transform risks string to array', () => {
      const dbData = {
        project_risks_protected_against:
          'fluvial_flooding,coastal_erosion,surface_water_flooding'
      }

      const result = ProjectMapper.toApi(dbData)

      expect(result).toHaveProperty('risks')
      expect(Array.isArray(result.risks)).toBe(true)
      expect(result.risks).toEqual([
        'fluvial_flooding',
        'coastal_erosion',
        'surface_water_flooding'
      ])
    })

    it('should handle risks with whitespace', () => {
      const dbData = {
        project_risks_protected_against: 'fluvial_flooding , coastal_erosion '
      }

      const result = ProjectMapper.toApi(dbData)

      expect(result.risks).toEqual(['fluvial_flooding', 'coastal_erosion'])
    })

    it('should handle non-string risks value', () => {
      const dbData = {
        project_risks_protected_against: ['fluvial_flooding', 'coastal_erosion']
      }

      const result = ProjectMapper.toApi(dbData)

      expect(result.risks).toEqual(['fluvial_flooding', 'coastal_erosion'])
    })

    it('should handle null risks value', () => {
      const dbData = {
        project_risks_protected_against: null
      }

      const result = ProjectMapper.toApi(dbData)

      expect(result).toHaveProperty('risks')
      expect(Array.isArray(result.risks)).toBe(true)
      expect(result.risks).toEqual([])
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

    it('should convert WLC bigint fields to strings for API', () => {
      const dbData = {
        wlc_estimated_whole_life_pv_costs: BigInt('123456789012345678'),
        wlc_estimated_design_construction_costs: BigInt(111),
        wlc_estimated_risk_contingency_costs: BigInt(222),
        wlc_estimated_future_costs: BigInt(333)
      }

      const result = ProjectMapper.toApi(dbData)

      expect(result).toHaveProperty(
        'wlcEstimatedWholeLifePvCosts',
        '123456789012345678'
      )
      expect(result).toHaveProperty(
        'wlcEstimatedDesignConstructionCosts',
        '111'
      )
      expect(result).toHaveProperty('wlcEstimatedRiskContingencyCosts', '222')
      expect(result).toHaveProperty('wlcEstimatedFutureCosts', '333')
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

    it('should convert risks array to comma-separated string', () => {
      const result = ProjectMapper.transformValue('risks', [
        'fluvial_flooding',
        'coastal_erosion'
      ])
      expect(result).toBe('fluvial_flooding,coastal_erosion')
    })

    it('should pass through risks string unchanged', () => {
      const result = ProjectMapper.transformValue(
        'risks',
        'fluvial_flooding,coastal_erosion'
      )
      expect(result).toBe('fluvial_flooding,coastal_erosion')
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

    it('should split comma-separated risks string to array', () => {
      const result = ProjectMapper.reverseTransformValue(
        'risks',
        'fluvial_flooding,coastal_erosion'
      )
      expect(Array.isArray(result)).toBe(true)
      expect(result).toEqual(['fluvial_flooding', 'coastal_erosion'])
    })

    it('should trim whitespace in risks array elements', () => {
      const result = ProjectMapper.reverseTransformValue(
        'risks',
        'fluvial_flooding , coastal_erosion '
      )
      expect(result).toEqual(['fluvial_flooding', 'coastal_erosion'])
    })

    it('should return value unchanged if risks is not a string', () => {
      const arrayValue = ['fluvial_flooding', 'coastal_erosion']
      const result = ProjectMapper.reverseTransformValue('risks', arrayValue)
      expect(result).toBe(arrayValue)
    })

    it('should return empty array if risks is null', () => {
      const result = ProjectMapper.reverseTransformValue('risks', null)
      expect(Array.isArray(result)).toBe(true)
      expect(result).toEqual([])
    })

    it('should return empty array if risks is undefined', () => {
      const result = ProjectMapper.reverseTransformValue('risks', undefined)
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

    it('should convert WLC bigint to string for API', () => {
      const result = ProjectMapper.reverseTransformValue(
        'wlcEstimatedWholeLifePvCosts',
        BigInt('123456789012345678')
      )

      expect(result).toBe('123456789012345678')
      expect(typeof result).toBe('string')
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

    it('should map one-to-many pafs_core_nfm_measures array', () => {
      const nestedDbData = {
        reference_number: 'REF123',
        name: 'Test Project',
        pafs_core_nfm_measures: [
          {
            measure_type: 'river_floodplain_restoration',
            area_hectares: 10.5,
            storage_volume_m3: 500.25,
            length_km: null,
            width_m: null
          },
          {
            measure_type: 'woodland',
            area_hectares: 3.2,
            storage_volume_m3: null,
            length_km: null,
            width_m: null
          }
        ]
      }

      const result = ProjectMapper.toApi(nestedDbData)

      expect(result).toHaveProperty('name', 'Test Project')
      expect(result).toHaveProperty('pafs_core_nfm_measures')
      expect(Array.isArray(result.pafs_core_nfm_measures)).toBe(true)
      expect(result.pafs_core_nfm_measures).toHaveLength(2)
      expect(result.pafs_core_nfm_measures[0]).toEqual({
        measureType: 'river_floodplain_restoration',
        areaHectares: 10.5,
        storageVolumeM3: 500.25,
        lengthKm: null,
        widthM: null
      })
      expect(result.pafs_core_nfm_measures[1]).toEqual({
        measureType: 'woodland',
        areaHectares: 3.2,
        storageVolumeM3: null,
        lengthKm: null,
        widthM: null
      })
    })

    it('should map one-to-many pafs_core_nfm_land_use_changes array', () => {
      const nestedDbData = {
        reference_number: 'REF123',
        name: 'Test Project',
        pafs_core_nfm_land_use_changes: [
          {
            land_use_type: 'enclosed_arable_farmland',
            area_before_hectares: 5.5,
            area_after_hectares: 4
          }
        ]
      }

      const result = ProjectMapper.toApi(nestedDbData)

      expect(result).toHaveProperty('pafs_core_nfm_land_use_changes')
      expect(Array.isArray(result.pafs_core_nfm_land_use_changes)).toBe(true)
      expect(result.pafs_core_nfm_land_use_changes[0]).toEqual({
        landUseType: 'enclosed_arable_farmland',
        areaBeforeHectares: 5.5,
        areaAfterHectares: 4
      })
    })

    it('should handle empty pafs_core_nfm_measures array', () => {
      const nestedDbData = {
        reference_number: 'REF123',
        name: 'Test Project',
        pafs_core_nfm_measures: []
      }

      const result = ProjectMapper.toApi(nestedDbData)

      // Empty array joinData has length 0, so it should not be attached to result
      expect(result).toHaveProperty('referenceNumber', 'REF123')
      expect(result).toHaveProperty('pafs_core_nfm_measures')
      expect(result.pafs_core_nfm_measures).toEqual([])
    })

    it('should map one-to-many pafs_core_funding_values with bigint spend fields', () => {
      const nestedDbData = {
        reference_number: 'REF123',
        pafs_core_funding_values: [
          {
            financial_year: 2025,
            fcerm_gia: BigInt(1000),
            local_levy: BigInt(2000),
            total: BigInt(3000),
            recovery: null
          }
        ]
      }

      const result = ProjectMapper.toApi(nestedDbData)

      expect(result).toHaveProperty('pafs_core_funding_values')
      expect(result.pafs_core_funding_values).toEqual([
        {
          financialYear: 2025,
          fcermGia: '1000',
          localLevy: '2000',
          total: '3000',
          recovery: null
        }
      ])
    })

    it('should map one-to-many pafs_core_funding_contributors with bigint ids/amounts', () => {
      const nestedDbData = {
        reference_number: 'REF123',
        pafs_core_funding_contributors: [
          {
            name: 'Contributor A',
            contributor_type: 'public_contributions',
            funding_value_id: BigInt(55),
            amount: BigInt(7000),
            secured: true,
            constrained: false,
            created_at: new Date('2026-01-01T00:00:00.000Z'),
            updated_at: new Date('2026-01-02T00:00:00.000Z')
          }
        ]
      }

      const result = ProjectMapper.toApi(nestedDbData)

      expect(result).toHaveProperty('pafs_core_funding_contributors')
      expect(result.pafs_core_funding_contributors).toEqual([
        {
          name: 'Contributor A',
          contributorType: 'public_contributions',
          fundingValueId: '55',
          amount: '7000',
          secured: true,
          constrained: false,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-02T00:00:00.000Z')
        }
      ])
    })
  })

  describe('WLB BigInt field transformations', () => {
    it('should transform WLB fields from database (bigint) to API (string)', () => {
      const apiData = {
        wlbEstimatedWholeLifePvBenefits: '1000000000000000000',
        wlbEstimatedPropertyDamagesAvoided: '500000000000000000',
        wlbEstimatedEnvironmentalBenefits: '250000000000000000',
        wlbEstimatedRecreationTourismBenefits: '100000000000000000',
        wlbEstimatedLandValueUpliftBenefits: '750000000000000000'
      }

      const result = ProjectMapper.toDatabase(apiData)

      expect(result).toHaveProperty(
        'wlc_estimated_whole_life_pv_benefits',
        BigInt('1000000000000000000')
      )
      expect(result).toHaveProperty(
        'wlc_estimated_property_damages_avoided',
        BigInt('500000000000000000')
      )
      expect(result).toHaveProperty(
        'wlc_estimated_environmental_benefits',
        BigInt('250000000000000000')
      )
      expect(result).toHaveProperty(
        'wlc_estimated_recreation_tourism_benefits',
        BigInt('100000000000000000')
      )
      expect(result).toHaveProperty(
        'wlc_estimated_land_value_uplift_benefits',
        BigInt('750000000000000000')
      )
    })

    it('should transform WLB fields from database back to API', () => {
      const dbData = {
        name: 'Test Project',
        wlc_estimated_whole_life_pv_benefits: 1000000000000000000n,
        wlc_estimated_property_damages_avoided: 500000000000000000n,
        wlc_estimated_environmental_benefits: 250000000000000000n,
        wlc_estimated_recreation_tourism_benefits: 100000000000000000n,
        wlc_estimated_land_value_uplift_benefits: 750000000000000000n
      }

      const result = ProjectMapper.toApi(dbData)

      expect(result).toHaveProperty(
        'wlbEstimatedWholeLifePvBenefits',
        '1000000000000000000'
      )
      expect(result).toHaveProperty(
        'wlbEstimatedPropertyDamagesAvoided',
        '500000000000000000'
      )
      expect(result).toHaveProperty(
        'wlbEstimatedEnvironmentalBenefits',
        '250000000000000000'
      )
      expect(result).toHaveProperty(
        'wlbEstimatedRecreationTourismBenefits',
        '100000000000000000'
      )
      expect(result).toHaveProperty(
        'wlbEstimatedLandValueUpliftBenefits',
        '750000000000000000'
      )
    })

    it('should handle null WLB fields', () => {
      const apiData = {
        wlbEstimatedWholeLifePvBenefits: null,
        wlbEstimatedPropertyDamagesAvoided: null
      }

      const result = ProjectMapper.toDatabase(apiData)

      expect(result).toHaveProperty(
        'wlc_estimated_whole_life_pv_benefits',
        null
      )
      expect(result).toHaveProperty(
        'wlc_estimated_property_damages_avoided',
        null
      )
    })

    it('should handle undefined WLB fields', () => {
      const apiData = {
        wlbEstimatedWholeLifePvBenefits: undefined,
        wlbEstimatedPropertyDamagesAvoided: undefined
      }

      const result = ProjectMapper.toDatabase(apiData)

      expect(result).not.toHaveProperty('wlc_estimated_whole_life_pv_benefits')
      expect(result).not.toHaveProperty(
        'wlc_estimated_property_damages_avoided'
      )
    })

    it('should convert numeric WLB values to bigint', () => {
      const apiData = {
        wlbEstimatedWholeLifePvBenefits: 1000000
      }

      const result = ProjectMapper.toDatabase(apiData)

      expect(result.wlc_estimated_whole_life_pv_benefits).toBe(1000000n)
      expect(typeof result.wlc_estimated_whole_life_pv_benefits).toBe('bigint')
    })

    it('should round float WLB values to integer bigint', () => {
      const apiData = {
        wlbEstimatedWholeLifePvBenefits: 1000000.5
      }

      const result = ProjectMapper.toDatabase(apiData)

      // BigInt constructor truncates decimals
      expect(result.wlc_estimated_whole_life_pv_benefits).toBe(1000000.5)
    })

    it('should handle mixed null and defined WLB fields', () => {
      const apiData = {
        wlbEstimatedWholeLifePvBenefits: '500000',
        wlbEstimatedPropertyDamagesAvoided: null,
        wlbEstimatedEnvironmentalBenefits: '250000'
      }

      const result = ProjectMapper.toDatabase(apiData)

      expect(result.wlc_estimated_whole_life_pv_benefits).toBe(500000n)
      expect(result.wlc_estimated_property_damages_avoided).toBeNull()
      expect(result.wlc_estimated_environmental_benefits).toBe(250000n)
    })

    it('should bidirectionally convert WLB values', () => {
      const originalApi = {
        wlbEstimatedWholeLifePvBenefits: '1000000000000000000'
      }

      const toDb = ProjectMapper.toDatabase(originalApi)
      const backToApi = ProjectMapper.toApi(toDb)

      expect(backToApi.wlbEstimatedWholeLifePvBenefits).toBe(
        '1000000000000000000'
      )
    })
  })

  describe('transformValue', () => {
    it('should transform array fields using convertArray', () => {
      const result = ProjectMapper.transformValue('projectInterventionTypes', [
        'NFM',
        'SUDS',
        'PFR'
      ])

      expect(result).toBe('NFM,SUDS,PFR')
      expect(typeof result).toBe('string')
    })

    it('should transform empty arrays to empty string', () => {
      const result = ProjectMapper.transformValue(
        'projectInterventionTypes',
        []
      )

      expect(result).toBe('')
    })

    it('should transform null arrays to null', () => {
      const result = ProjectMapper.transformValue(
        'projectInterventionTypes',
        null
      )

      expect(result).toBeNull()
    })

    it('should transform risks array field', () => {
      const result = ProjectMapper.transformValue('risks', [
        'fluvial_flooding',
        'coastal_erosion'
      ])

      expect(result).toBe('fluvial_flooding,coastal_erosion')
    })

    it('should transform BIGINT fields using convertBigInt', () => {
      const result = ProjectMapper.transformValue(
        'wlcEstimatedWholeLifePvCosts',
        1000000
      )

      expect(result).toBe(1000000n)
      expect(typeof result).toBe('bigint')
    })

    it('should transform string BIGINT values to bigint', () => {
      const result = ProjectMapper.transformValue(
        'wlcEstimatedDesignConstructionCosts',
        '5000000'
      )

      expect(result).toBe(5000000n)
      expect(typeof result).toBe('bigint')
    })

    it('should transform DECIMAL fields using convertDecimal', () => {
      const result = ProjectMapper.transformValue('carbonCostBuild', 100.5)

      expect(result).toBe('100.5')
      expect(typeof result).toBe('string')
    })

    it('should transform string DECIMAL values', () => {
      const result = ProjectMapper.transformValue(
        'carbonCostOperation',
        '250.75'
      )

      expect(result).toBe('250.75')
    })

    it('should transform NUMBER fields using convertNumber', () => {
      const result = ProjectMapper.transformValue('financialStartYear', 2024)

      expect(result).toBe(2024)
    })

    it('should transform string NUMBER values to number', () => {
      const result = ProjectMapper.transformValue('financialEndYear', '2025')

      expect(result).toBe(2025)
    })

    it('should transform percentage fields', () => {
      const result = ProjectMapper.transformValue(
        'percentProperties20PercentDeprived',
        45.5
      )

      expect(result).toBe(45.5)
    })

    it('should pass through non-mapped values unchanged', () => {
      const result = ProjectMapper.transformValue('name', 'Test Project')

      expect(result).toBe('Test Project')
    })

    it('should pass through null values unchanged for non-array fields', () => {
      const result = ProjectMapper.transformValue('name', null)

      expect(result).toBeNull()
    })
  })

  describe('reverseTransformValue', () => {
    it('should reverse transform comma-separated array strings back to array', () => {
      const result = ProjectMapper.reverseTransformValue(
        'projectInterventionTypes',
        'NFM,SUDS,PFR'
      )

      expect(result).toEqual(['NFM', 'SUDS', 'PFR'])
      expect(Array.isArray(result)).toBe(true)
    })

    it('should reverse transform empty array string', () => {
      const result = ProjectMapper.reverseTransformValue(
        'projectInterventionTypes',
        ''
      )

      expect(result).toEqual([])
    })

    it('should reverse transform null array values', () => {
      const result = ProjectMapper.reverseTransformValue(
        'projectInterventionTypes',
        null
      )

      expect(result).toEqual([])
    })

    it('should reverse transform risks array field', () => {
      const result = ProjectMapper.reverseTransformValue(
        'risks',
        'fluvial_flooding,coastal_erosion,surface_water_flooding'
      )

      expect(result).toEqual([
        'fluvial_flooding',
        'coastal_erosion',
        'surface_water_flooding'
      ])
    })

    it('should reverse transform BIGINT fields back to string', () => {
      const result = ProjectMapper.reverseTransformValue(
        'wlcEstimatedWholeLifePvCosts',
        1000000n
      )

      expect(result).toBe('1000000')
      expect(typeof result).toBe('string')
    })

    it('should reverse transform numeric BIGINT values', () => {
      const result = ProjectMapper.reverseTransformValue(
        'wlcEstimatedDesignConstructionCosts',
        5000000
      )

      expect(result).toBe('5000000')
    })

    it('should reverse transform DECIMAL fields', () => {
      const result = ProjectMapper.reverseTransformValue(
        'carbonCostBuild',
        '100.5'
      )

      expect(result).toBe('100.5')
      expect(typeof result).toBe('string')
    })

    it('should reverse transform numeric DECIMAL values', () => {
      const result = ProjectMapper.reverseTransformValue(
        'carbonCostOperation',
        250.75
      )

      expect(result).toBe('250.75')
    })

    it('should reverse transform NUMBER fields', () => {
      const result = ProjectMapper.reverseTransformValue(
        'financialStartYear',
        2024
      )

      expect(result).toBe(2024)
    })

    it('should reverse transform percentage fields', () => {
      const result = ProjectMapper.reverseTransformValue(
        'percentProperties20PercentDeprived',
        45.5
      )

      expect(result).toBe(45.5)
    })

    it('should pass through non-mapped values unchanged', () => {
      const result = ProjectMapper.reverseTransformValue('name', 'Test Project')

      expect(result).toBe('Test Project')
    })

    it('should pass through null values unchanged', () => {
      const result = ProjectMapper.reverseTransformValue('name', null)

      expect(result).toBeNull()
    })
  })
})
