import { describe, test, expect, beforeEach, vi } from 'vitest'
import {
  requiresLegacyMigration,
  executeLegacyProjectTypeMigration
} from './legacy-migration-service.js'

describe('Legacy Migration Service', () => {
  let mockPrisma
  let mockLogger

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    }

    mockPrisma = {
      pafs_core_flood_protection_outcomes: {
        findMany: vi.fn().mockResolvedValue([])
      },
      pafs_core_projects: {
        update: vi.fn().mockResolvedValue({})
      }
    }
  })

  describe('requiresLegacyMigration', () => {
    test('returns true for legacy project with old type CM', () => {
      const project = { is_legacy: true, project_type: 'CM' }
      expect(requiresLegacyMigration(project)).toBe(true)
    })

    test('returns true for legacy project with old type DEF', () => {
      const project = { is_legacy: true, project_type: 'DEF' }
      expect(requiresLegacyMigration(project)).toBe(true)
    })

    test('returns true for legacy project with old type PLP', () => {
      const project = { is_legacy: true, project_type: 'PLP' }
      expect(requiresLegacyMigration(project)).toBe(true)
    })

    test('returns true for legacy project with old type ENV', () => {
      const project = { is_legacy: true, project_type: 'ENV' }
      expect(requiresLegacyMigration(project)).toBe(true)
    })

    test('returns true for legacy project with old type ENN', () => {
      const project = { is_legacy: true, project_type: 'ENN' }
      expect(requiresLegacyMigration(project)).toBe(true)
    })

    test('returns true for legacy project with old type STR', () => {
      const project = { is_legacy: true, project_type: 'STR' }
      expect(requiresLegacyMigration(project)).toBe(true)
    })

    test('returns false when is_legacy is false', () => {
      const project = { is_legacy: false, project_type: 'CM' }
      expect(requiresLegacyMigration(project)).toBe(false)
    })

    test('returns false when project_type is already a new type', () => {
      const project = { is_legacy: true, project_type: 'ELO' }
      expect(requiresLegacyMigration(project)).toBe(false)
    })

    test('returns false when project_type is null', () => {
      const project = { is_legacy: true, project_type: null }
      expect(requiresLegacyMigration(project)).toBe(false)
    })

    test('returns false for legacy DEF project when intervention types already set (migration ran, user values must be preserved)', () => {
      const project = {
        is_legacy: true,
        project_type: 'DEF',
        project_intervention_types: 'NFM,Other'
      }
      expect(requiresLegacyMigration(project)).toBe(false)
    })

    test('returns false for legacy DEF project when user has edited intervention types', () => {
      const project = {
        is_legacy: true,
        project_type: 'DEF',
        project_intervention_types: 'NFM,SUDS'
      }
      expect(requiresLegacyMigration(project)).toBe(false)
    })

    test('returns true for legacy DEF project when intervention types are null (first migration run)', () => {
      const project = {
        is_legacy: true,
        project_type: 'DEF',
        project_intervention_types: null
      }
      expect(requiresLegacyMigration(project)).toBe(true)
    })

    test('returns true for legacy DEF project when intervention types are empty string (migration not yet run)', () => {
      const project = {
        is_legacy: true,
        project_type: 'DEF',
        project_intervention_types: ''
      }
      expect(requiresLegacyMigration(project)).toBe(true)
    })
  })

  describe('executeLegacyMigration', () => {
    describe('CM project type', () => {
      test('CM with NFM=false, PLP=false → type=null, interventions=null', async () => {
        const project = {
          id: 1n,
          reference_number: 'SEED_CM/001/TEST',
          project_type: 'CM',
          is_legacy: true,
          natural_flood_risk_measures_included: false
        }

        mockPrisma.pafs_core_flood_protection_outcomes.findMany.mockResolvedValue(
          [{ households_protected_through_plp_measures: 0 }]
        )

        const result = await executeLegacyProjectTypeMigration(
          mockPrisma,
          project,
          mockLogger
        )

        expect(result.project_type).toBeNull()
        expect(result.project_intervention_types).toBeNull()
        expect(result.main_intervention_type).toBeNull()
        expect(mockPrisma.pafs_core_projects.update).toHaveBeenCalled()
      })

      test('CM with NFM=true, PLP=false → type=null, interventions=null', async () => {
        const project = {
          id: 2n,
          reference_number: 'SEED_CM/002/TEST',
          project_type: 'CM',
          is_legacy: true,
          natural_flood_risk_measures_included: true
        }

        mockPrisma.pafs_core_flood_protection_outcomes.findMany.mockResolvedValue(
          [{ households_protected_through_plp_measures: 0 }]
        )

        const result = await executeLegacyProjectTypeMigration(
          mockPrisma,
          project,
          mockLogger
        )

        expect(result.project_type).toBeNull()
        expect(result.project_intervention_types).toBeNull()
        expect(result.main_intervention_type).toBeNull()
      })

      test('CM with NFM=false, PLP=true → type=null, interventions=null', async () => {
        const project = {
          id: 3n,
          reference_number: 'SEED_CM/003/TEST',
          project_type: 'CM',
          is_legacy: true,
          natural_flood_risk_measures_included: false
        }

        mockPrisma.pafs_core_flood_protection_outcomes.findMany.mockResolvedValue(
          [
            { households_protected_through_plp_measures: 5 },
            { households_protected_through_plp_measures: 10 }
          ]
        )

        const result = await executeLegacyProjectTypeMigration(
          mockPrisma,
          project,
          mockLogger
        )

        expect(result.project_type).toBeNull()
        expect(result.project_intervention_types).toBeNull()
        expect(result.main_intervention_type).toBeNull()
      })

      test('CM with NFM=true, PLP=true → type=null, interventions=null', async () => {
        const project = {
          id: 4n,
          reference_number: 'SEED_CM/004/TEST',
          project_type: 'CM',
          is_legacy: true,
          natural_flood_risk_measures_included: true
        }

        mockPrisma.pafs_core_flood_protection_outcomes.findMany.mockResolvedValue(
          [
            { households_protected_through_plp_measures: 3 },
            { households_protected_through_plp_measures: 7 }
          ]
        )

        const result = await executeLegacyProjectTypeMigration(
          mockPrisma,
          project,
          mockLogger
        )

        expect(result.project_type).toBeNull()
        expect(result.project_intervention_types).toBeNull()
        expect(result.main_intervention_type).toBeNull()
      })
    })

    describe('DEF project type', () => {
      test('DEF with NFM=false, PLP=false → type=DEF, interventions=Other', async () => {
        const project = {
          id: 5n,
          reference_number: 'SEED_DEF/005/TEST',
          project_type: 'DEF',
          is_legacy: true,
          natural_flood_risk_measures_included: false
        }

        mockPrisma.pafs_core_flood_protection_outcomes.findMany.mockResolvedValue(
          [{ households_protected_through_plp_measures: 0 }]
        )

        const result = await executeLegacyProjectTypeMigration(
          mockPrisma,
          project,
          mockLogger
        )

        expect(result.project_type).toBe('DEF')
        expect(result.project_intervention_types).toBe('Other')
        expect(result.main_intervention_type).toBe('Other')
      })

      test('DEF with NFM=true, PLP=false → type=DEF, interventions=NFM,Other', async () => {
        const project = {
          id: 6n,
          reference_number: 'SEED_DEF/006/TEST',
          project_type: 'DEF',
          is_legacy: true,
          natural_flood_risk_measures_included: true
        }

        mockPrisma.pafs_core_flood_protection_outcomes.findMany.mockResolvedValue(
          [{ households_protected_through_plp_measures: 0 }]
        )

        const result = await executeLegacyProjectTypeMigration(
          mockPrisma,
          project,
          mockLogger
        )

        expect(result.project_type).toBe('DEF')
        expect(result.project_intervention_types).toBe('NFM,Other')
        expect(result.main_intervention_type).toBe('Other')
      })

      test('DEF with NFM=false, PLP=true → type=DEF, interventions=PFR,Other', async () => {
        const project = {
          id: 7n,
          reference_number: 'SEED_DEF/007/TEST',
          project_type: 'DEF',
          is_legacy: true,
          natural_flood_risk_measures_included: false
        }

        mockPrisma.pafs_core_flood_protection_outcomes.findMany.mockResolvedValue(
          [{ households_protected_through_plp_measures: 3 }]
        )

        const result = await executeLegacyProjectTypeMigration(
          mockPrisma,
          project,
          mockLogger
        )

        expect(result.project_type).toBe('DEF')
        expect(result.project_intervention_types).toBe('PFR,Other')
        expect(result.main_intervention_type).toBe('Other')
      })

      test('DEF with NFM=true, PLP=true → type=DEF, interventions=NFM,PFR,Other', async () => {
        const project = {
          id: 8n,
          reference_number: 'SEED_DEF/008/TEST',
          project_type: 'DEF',
          is_legacy: true,
          natural_flood_risk_measures_included: true
        }

        mockPrisma.pafs_core_flood_protection_outcomes.findMany.mockResolvedValue(
          [
            { households_protected_through_plp_measures: 8 },
            { households_protected_through_plp_measures: 4 }
          ]
        )

        const result = await executeLegacyProjectTypeMigration(
          mockPrisma,
          project,
          mockLogger
        )

        expect(result.project_type).toBe('DEF')
        expect(result.project_intervention_types).toBe('NFM,PFR,Other')
        expect(result.main_intervention_type).toBe('Other')
      })
    })

    describe('PLP project type', () => {
      test('PLP with NFM=false → type=DEF, interventions=PFR, main=PFR', async () => {
        const project = {
          id: 9n,
          reference_number: 'SEED_PLP/009/TEST',
          project_type: 'PLP',
          is_legacy: true,
          natural_flood_risk_measures_included: false
        }

        const result = await executeLegacyProjectTypeMigration(
          mockPrisma,
          project,
          mockLogger
        )

        expect(result.project_type).toBe('DEF')
        expect(result.project_intervention_types).toBe('PFR')
        expect(result.main_intervention_type).toBe('PFR')
      })

      test('PLP with NFM=true → type=DEF, interventions=NFM,PFR, main=PFR', async () => {
        const project = {
          id: 10n,
          reference_number: 'SEED_PLP/010/TEST',
          project_type: 'PLP',
          is_legacy: true,
          natural_flood_risk_measures_included: true
        }

        const result = await executeLegacyProjectTypeMigration(
          mockPrisma,
          project,
          mockLogger
        )

        expect(result.project_type).toBe('DEF')
        expect(result.project_intervention_types).toBe('NFM,PFR')
        expect(result.main_intervention_type).toBe('PFR')
      })

      test('PLP with NFM=null defaults to false (validation rule 2)', async () => {
        const project = {
          id: 11n,
          reference_number: 'SEED_PLP/011/TEST',
          project_type: 'PLP',
          is_legacy: true,
          natural_flood_risk_measures_included: null
        }

        const result = await executeLegacyProjectTypeMigration(
          mockPrisma,
          project,
          mockLogger
        )

        expect(result.project_type).toBe('DEF')
        expect(result.project_intervention_types).toBe('PFR')
        expect(result.main_intervention_type).toBe('PFR')
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.objectContaining({ referenceNumber: 'SEED_PLP/011/TEST' }),
          expect.stringContaining('NFM field is null')
        )
      })
    })

    describe('ENV project type', () => {
      test('ENV → type=ELO, interventions=null', async () => {
        const project = {
          id: 12n,
          reference_number: 'SEED_ENV/012/TEST',
          project_type: 'ENV',
          is_legacy: true,
          natural_flood_risk_measures_included: null
        }

        const result = await executeLegacyProjectTypeMigration(
          mockPrisma,
          project,
          mockLogger
        )

        expect(result.project_type).toBe('ELO')
        expect(result.project_intervention_types).toBeNull()
        expect(result.main_intervention_type).toBeNull()
      })
    })

    describe('ENN project type', () => {
      test('ENN → type=ELO, interventions=null', async () => {
        const project = {
          id: 13n,
          reference_number: 'SEED_ENN/013/TEST',
          project_type: 'ENN',
          is_legacy: true,
          natural_flood_risk_measures_included: null
        }

        const result = await executeLegacyProjectTypeMigration(
          mockPrisma,
          project,
          mockLogger
        )

        expect(result.project_type).toBe('ELO')
        expect(result.project_intervention_types).toBeNull()
        expect(result.main_intervention_type).toBeNull()
      })
    })

    describe('STR project type', () => {
      test('STR → type=STR, interventions=null', async () => {
        const project = {
          id: 14n,
          reference_number: 'SEED_STR/014/TEST',
          project_type: 'STR',
          is_legacy: true,
          natural_flood_risk_measures_included: null
        }

        const result = await executeLegacyProjectTypeMigration(
          mockPrisma,
          project,
          mockLogger
        )

        expect(result.project_type).toBe('STR')
        expect(result.project_intervention_types).toBeNull()
        expect(result.main_intervention_type).toBeNull()
      })
    })

    describe('Validation rules', () => {
      test('Rule 1: Unknown project type returns null (flagged for manual review)', async () => {
        const project = {
          id: 100n,
          reference_number: 'TEST/100/UNKNOWN',
          project_type: 'XYZ',
          is_legacy: true,
          natural_flood_risk_measures_included: false
        }

        const result = await executeLegacyProjectTypeMigration(
          mockPrisma,
          project,
          mockLogger
        )

        expect(result).toBeNull()
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.objectContaining({ oldProjectType: 'XYZ' }),
          expect.stringContaining('Unknown old project type')
        )
        expect(mockPrisma.pafs_core_projects.update).not.toHaveBeenCalled()
      })

      test('Rule 2: Null NFM defaults to false and logs warning', async () => {
        const project = {
          id: 15n,
          reference_number: 'SEED_DEF/015/TEST',
          project_type: 'DEF',
          is_legacy: true,
          natural_flood_risk_measures_included: null
        }

        mockPrisma.pafs_core_flood_protection_outcomes.findMany.mockResolvedValue(
          [{ households_protected_through_plp_measures: 0 }]
        )

        const result = await executeLegacyProjectTypeMigration(
          mockPrisma,
          project,
          mockLogger
        )

        expect(result.project_intervention_types).toBe('Other')
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.objectContaining({ referenceNumber: 'SEED_DEF/015/TEST' }),
          expect.stringContaining('NFM field is null')
        )
      })

      test('Rule 3: No flood protection outcomes defaults PLP to false', async () => {
        const project = {
          id: 16n,
          reference_number: 'TEST/016/DEF',
          project_type: 'DEF',
          is_legacy: true,
          natural_flood_risk_measures_included: true
        }

        mockPrisma.pafs_core_flood_protection_outcomes.findMany.mockResolvedValue(
          []
        )

        const result = await executeLegacyProjectTypeMigration(
          mockPrisma,
          project,
          mockLogger
        )

        // NFM=true, PLP=false → NFM,Other
        expect(result.project_intervention_types).toBe('NFM,Other')
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.objectContaining({ referenceNumber: 'TEST/016/DEF' }),
          expect.stringContaining('No flood protection outcomes found')
        )
      })

      test('Rule 3: Null PLP values treated as 0', async () => {
        const project = {
          id: 17n,
          reference_number: 'TEST/017/DEF',
          project_type: 'DEF',
          is_legacy: true,
          natural_flood_risk_measures_included: false
        }

        mockPrisma.pafs_core_flood_protection_outcomes.findMany.mockResolvedValue(
          [
            { households_protected_through_plp_measures: null },
            { households_protected_through_plp_measures: null }
          ]
        )

        const result = await executeLegacyProjectTypeMigration(
          mockPrisma,
          project,
          mockLogger
        )

        // NFM=false, PLP=false → Other
        expect(result.project_intervention_types).toBe('Other')
        expect(result.main_intervention_type).toBe('Other')
      })
    })

    describe('Persistence', () => {
      test('saves transformed values to database', async () => {
        const project = {
          id: 20n,
          reference_number: 'TEST/020/DEF',
          project_type: 'DEF',
          is_legacy: true,
          natural_flood_risk_measures_included: true
        }

        mockPrisma.pafs_core_flood_protection_outcomes.findMany.mockResolvedValue(
          [{ households_protected_through_plp_measures: 5 }]
        )

        await executeLegacyProjectTypeMigration(mockPrisma, project, mockLogger)

        expect(mockPrisma.pafs_core_projects.update).toHaveBeenCalledWith({
          where: { id: 20n },
          data: expect.objectContaining({
            project_type: 'DEF',
            project_intervention_types: 'NFM,PFR,Other',
            main_intervention_type: 'Other',
            updated_at: expect.any(Date)
          })
        })
      })
    })
  })
})
