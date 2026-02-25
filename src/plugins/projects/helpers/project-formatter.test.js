import { describe, test, expect, vi } from 'vitest'
import {
  formatProject,
  resolveAreaNames,
  PROJECT_SELECT_FIELDS
} from './project-formatter.js'

describe('project-formatter', () => {
  describe('PROJECT_SELECT_FIELDS', () => {
    test('Should have all required fields for project selection', () => {
      expect(PROJECT_SELECT_FIELDS).toEqual({
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
      })
    })
  })

  describe('formatProject', () => {
    test('Should format project with all fields and default state', () => {
      const mockProject = {
        id: BigInt(1),
        reference_number: 'RMS12345',
        slug: 'RMS12345/ABC001',
        name: 'Test Project',
        rma_name: 'Environment Agency',
        is_legacy: false,
        is_revised: false,
        created_at: new Date('2024-01-01T10:00:00Z'),
        updated_at: new Date('2024-01-02T15:30:00Z'),
        submitted_at: new Date('2024-01-03T12:00:00Z')
      }

      const result = formatProject(mockProject)

      expect(result).toEqual({
        id: 1,
        referenceNumber: 'RMS12345',
        referenceNumberFormatted: 'RMS12345/ABC001',
        name: 'Test Project',
        rmaName: 'Environment Agency',
        isLegacy: false,
        isRevised: false,
        status: 'draft',
        createdAt: new Date('2024-01-01T10:00:00Z'),
        updatedAt: new Date('2024-01-02T15:30:00Z'),
        submittedAt: new Date('2024-01-03T12:00:00Z')
      })
    })

    test('Should format project with custom state', () => {
      const mockProject = {
        id: BigInt(2),
        reference_number: 'RMS67890',
        slug: 'RMS67890/XYZ002',
        name: 'Submitted Project',
        rma_name: 'Natural England',
        is_legacy: false,
        is_revised: false,
        created_at: new Date('2024-02-01T10:00:00Z'),
        updated_at: new Date('2024-02-02T15:30:00Z'),
        submitted_at: new Date('2024-02-03T12:00:00Z')
      }

      const result = formatProject(mockProject, 'submitted')

      expect(result).toEqual({
        id: 2,
        referenceNumber: 'RMS67890',
        referenceNumberFormatted: 'RMS67890/XYZ002',
        name: 'Submitted Project',
        rmaName: 'Natural England',
        isLegacy: false,
        isRevised: false,
        status: 'submitted',
        createdAt: new Date('2024-02-01T10:00:00Z'),
        updatedAt: new Date('2024-02-02T15:30:00Z'),
        submittedAt: new Date('2024-02-03T12:00:00Z')
      })
    })

    test('Should format project with archived state', () => {
      const mockProject = {
        id: BigInt(3),
        reference_number: 'RMS11111',
        slug: 'RMS11111/OLD003',
        name: 'Archived Project',
        rma_name: 'Historic England',
        is_legacy: false,
        is_revised: false,
        created_at: new Date('2023-01-01T10:00:00Z'),
        updated_at: new Date('2023-12-31T15:30:00Z'),
        submitted_at: null
      }

      const result = formatProject(mockProject, 'archived')

      expect(result).toEqual({
        id: 3,
        referenceNumber: 'RMS11111',
        referenceNumberFormatted: 'RMS11111/OLD003',
        name: 'Archived Project',
        rmaName: 'Historic England',
        isLegacy: false,
        isRevised: false,
        status: 'archived',
        createdAt: new Date('2023-01-01T10:00:00Z'),
        updatedAt: new Date('2023-12-31T15:30:00Z'),
        submittedAt: null
      })
    })

    test('Should handle null submitted_at date', () => {
      const mockProject = {
        id: BigInt(4),
        reference_number: 'RMS99999',
        slug: 'RMS99999/DRAFT004',
        name: 'Draft Project',
        rma_name: 'Environment Agency',
        is_legacy: false,
        is_revised: false,
        created_at: new Date('2024-03-01T10:00:00Z'),
        updated_at: new Date('2024-03-02T15:30:00Z'),
        submitted_at: null
      }

      const result = formatProject(mockProject)

      expect(result.submittedAt).toBeNull()
      expect(result.status).toBe('draft')
    })

    test('Should convert BigInt id to Number', () => {
      const mockProject = {
        id: BigInt(999999999999),
        reference_number: 'RMS00001',
        slug: 'RMS00001/BIG005',
        name: 'Big ID Project',
        rma_name: 'Test Authority',
        is_legacy: false,
        is_revised: false,
        created_at: new Date('2024-04-01T10:00:00Z'),
        updated_at: new Date('2024-04-02T15:30:00Z'),
        submitted_at: null
      }

      const result = formatProject(mockProject)

      expect(typeof result.id).toBe('number')
      expect(result.id).toBe(999999999999)
    })

    test('Should handle regular number id', () => {
      const mockProject = {
        id: 123,
        reference_number: 'RMS00002',
        slug: 'RMS00002/NUM006',
        name: 'Number ID Project',
        rma_name: 'Test Authority',
        is_legacy: false,
        is_revised: false,
        created_at: new Date('2024-05-01T10:00:00Z'),
        updated_at: new Date('2024-05-02T15:30:00Z'),
        submitted_at: null
      }

      const result = formatProject(mockProject)

      expect(typeof result.id).toBe('number')
      expect(result.id).toBe(123)
    })

    test('Should handle string id by converting to number', () => {
      const mockProject = {
        id: '456',
        reference_number: 'RMS00003',
        slug: 'RMS00003/STR007',
        name: 'String ID Project',
        rma_name: 'Test Authority',
        is_legacy: false,
        is_revised: false,
        created_at: new Date('2024-06-01T10:00:00Z'),
        updated_at: new Date('2024-06-02T15:30:00Z'),
        submitted_at: null
      }

      const result = formatProject(mockProject)

      expect(typeof result.id).toBe('number')
      expect(result.id).toBe(456)
    })

    test('Should handle state being null', () => {
      const mockProject = {
        id: BigInt(5),
        reference_number: 'RMS00004',
        slug: 'RMS00004/NULL008',
        name: 'Null State Project',
        rma_name: 'Test Authority',
        is_legacy: false,
        is_revised: false,
        created_at: new Date('2024-07-01T10:00:00Z'),
        updated_at: new Date('2024-07-02T15:30:00Z'),
        submitted_at: null
      }

      const result = formatProject(mockProject, null)

      expect(result.status).toBe('draft')
    })

    test('Should preserve camelCase formatting for output fields', () => {
      const mockProject = {
        id: BigInt(6),
        reference_number: 'RMS00005',
        slug: 'RMS00005/CASE009',
        name: 'CamelCase Test',
        rma_name: 'Test Authority',
        is_legacy: false,
        is_revised: false,
        created_at: new Date('2024-08-01T10:00:00Z'),
        updated_at: new Date('2024-08-02T15:30:00Z'),
        submitted_at: new Date('2024-08-03T12:00:00Z')
      }

      const result = formatProject(mockProject, 'submitted')

      expect(result).toHaveProperty('referenceNumber')
      expect(result).toHaveProperty('referenceNumberFormatted')
      expect(result).toHaveProperty('rmaName')
      expect(result).toHaveProperty('isLegacy')
      expect(result).toHaveProperty('isRevised')
      expect(result).toHaveProperty('createdAt')
      expect(result).toHaveProperty('updatedAt')
      expect(result).toHaveProperty('submittedAt')
      expect(result).not.toHaveProperty('reference_number')
      expect(result).not.toHaveProperty('rma_name')
      expect(result).not.toHaveProperty('is_legacy')
      expect(result).not.toHaveProperty('is_revised')
      expect(result).not.toHaveProperty('created_at')
    })

    test('Should return status revise when draft, legacy, and not migrated', () => {
      const mockProject = {
        id: BigInt(10),
        reference_number: 'RMS10001',
        slug: 'RMS10001/LEG010',
        name: 'Legacy Draft Project',
        rma_name: 'Test Authority',
        is_legacy: true,
        is_revised: false,
        created_at: new Date('2024-09-01T10:00:00Z'),
        updated_at: new Date('2024-09-02T15:30:00Z'),
        submitted_at: null
      }

      const result = formatProject(mockProject)

      expect(result.status).toBe('revise')
      expect(result.isLegacy).toBe(true)
      expect(result.isRevised).toBe(false)
    })

    test('Should return status revise when state is draft, legacy, and not migrated', () => {
      const mockProject = {
        id: BigInt(11),
        reference_number: 'RMS10002',
        slug: 'RMS10002/LEG011',
        name: 'Legacy Draft With State',
        rma_name: 'Test Authority',
        is_legacy: true,
        is_revised: false,
        created_at: new Date('2024-09-01T10:00:00Z'),
        updated_at: new Date('2024-09-02T15:30:00Z'),
        submitted_at: null
      }

      const result = formatProject(mockProject, 'draft')

      expect(result.status).toBe('revise')
    })

    test('Should return status draft when legacy and migrated', () => {
      const mockProject = {
        id: BigInt(12),
        reference_number: 'RMS10003',
        slug: 'RMS10003/MIG012',
        name: 'Migrated Legacy Project',
        rma_name: 'Test Authority',
        is_legacy: true,
        is_revised: true,
        created_at: new Date('2024-09-01T10:00:00Z'),
        updated_at: new Date('2024-09-02T15:30:00Z'),
        submitted_at: null
      }

      const result = formatProject(mockProject)

      expect(result.status).toBe('draft')
      expect(result.isLegacy).toBe(true)
      expect(result.isRevised).toBe(true)
    })

    test('Should return submitted status even when legacy and not migrated', () => {
      const mockProject = {
        id: BigInt(13),
        reference_number: 'RMS10004',
        slug: 'RMS10004/SUB013',
        name: 'Legacy Submitted Project',
        rma_name: 'Test Authority',
        is_legacy: true,
        is_revised: false,
        created_at: new Date('2024-09-01T10:00:00Z'),
        updated_at: new Date('2024-09-02T15:30:00Z'),
        submitted_at: new Date('2024-09-03T12:00:00Z')
      }

      const result = formatProject(mockProject, 'submitted')

      expect(result.status).toBe('submitted')
    })

    test('Should default is_legacy and is_revised to false when null', () => {
      const mockProject = {
        id: BigInt(14),
        reference_number: 'RMS10005',
        slug: 'RMS10005/NUL014',
        name: 'Null Flags Project',
        rma_name: 'Test Authority',
        is_legacy: null,
        is_revised: null,
        created_at: new Date('2024-09-01T10:00:00Z'),
        updated_at: new Date('2024-09-02T15:30:00Z'),
        submitted_at: null
      }

      const result = formatProject(mockProject)

      expect(result.isLegacy).toBe(false)
      expect(result.isRevised).toBe(false)
      expect(result.status).toBe('draft')
    })

    test('Should default is_legacy and is_revised to false when undefined', () => {
      const mockProject = {
        id: BigInt(15),
        reference_number: 'RMS10006',
        slug: 'RMS10006/UND015',
        name: 'Undefined Flags Project',
        rma_name: 'Test Authority',
        created_at: new Date('2024-09-01T10:00:00Z'),
        updated_at: new Date('2024-09-02T15:30:00Z'),
        submitted_at: null
      }

      const result = formatProject(mockProject)

      expect(result.isLegacy).toBe(false)
      expect(result.isRevised).toBe(false)
      expect(result.status).toBe('draft')
    })

    test('Should use areaName as fallback when rma_name is empty', () => {
      const mockProject = {
        id: BigInt(16),
        reference_number: 'RMS10007',
        slug: 'RMS10007/AREA016',
        name: 'No RMA Name Project',
        rma_name: null,
        is_legacy: false,
        is_revised: false,
        created_at: new Date('2024-09-01T10:00:00Z'),
        updated_at: new Date('2024-09-02T15:30:00Z'),
        submitted_at: null
      }

      const result = formatProject(mockProject, null, 'Area From Lookup')

      expect(result.rmaName).toBe('Area From Lookup')
    })

    test('Should prefer rma_name over areaName when both present', () => {
      const mockProject = {
        id: BigInt(17),
        reference_number: 'RMS10008',
        slug: 'RMS10008/BOTH017',
        name: 'Both Names Project',
        rma_name: 'Original RMA',
        is_legacy: false,
        is_revised: false,
        created_at: new Date('2024-09-01T10:00:00Z'),
        updated_at: new Date('2024-09-02T15:30:00Z'),
        submitted_at: null
      }

      const result = formatProject(mockProject, null, 'Area From Lookup')

      expect(result.rmaName).toBe('Original RMA')
    })

    test('Should return null rmaName when both rma_name and areaName are null', () => {
      const mockProject = {
        id: BigInt(18),
        reference_number: 'RMS10009',
        slug: 'RMS10009/NONE018',
        name: 'No Name Project',
        rma_name: null,
        is_legacy: false,
        is_revised: false,
        created_at: new Date('2024-09-01T10:00:00Z'),
        updated_at: new Date('2024-09-02T15:30:00Z'),
        submitted_at: null
      }

      const result = formatProject(mockProject)

      expect(result.rmaName).toBeNull()
    })
  })

  describe('resolveAreaNames', () => {
    test('Should return empty map when no project IDs provided', async () => {
      const mockPrisma = {}
      const result = await resolveAreaNames(mockPrisma, [])
      expect(result).toEqual(new Map())
    })

    test('Should return empty map when projectIds is null', async () => {
      const mockPrisma = {}
      const result = await resolveAreaNames(mockPrisma, null)
      expect(result).toEqual(new Map())
    })

    test('Should return empty map when no area_projects found', async () => {
      const mockPrisma = {
        pafs_core_area_projects: {
          findMany: vi.fn().mockResolvedValue([])
        }
      }
      const result = await resolveAreaNames(mockPrisma, [1, 2])
      expect(result).toEqual(new Map())
    })

    test('Should resolve area names for project IDs', async () => {
      const mockPrisma = {
        pafs_core_area_projects: {
          findMany: vi.fn().mockResolvedValue([
            { project_id: 1, area_id: 10 },
            { project_id: 2, area_id: 20 }
          ])
        },
        pafs_core_areas: {
          findMany: vi.fn().mockResolvedValue([
            { id: BigInt(10), name: 'Environment Agency' },
            { id: BigInt(20), name: 'Natural England' }
          ])
        }
      }

      const result = await resolveAreaNames(mockPrisma, [1, 2])

      expect(result.get(1)).toBe('Environment Agency')
      expect(result.get(2)).toBe('Natural England')
      expect(mockPrisma.pafs_core_area_projects.findMany).toHaveBeenCalledWith({
        where: { project_id: { in: [1, 2] } },
        select: { project_id: true, area_id: true }
      })
      expect(mockPrisma.pafs_core_areas.findMany).toHaveBeenCalledWith({
        where: { id: { in: [BigInt(10), BigInt(20)] } },
        select: { id: true, name: true }
      })
    })

    test('Should handle multiple projects sharing the same area', async () => {
      const mockPrisma = {
        pafs_core_area_projects: {
          findMany: vi.fn().mockResolvedValue([
            { project_id: 1, area_id: 10 },
            { project_id: 2, area_id: 10 }
          ])
        },
        pafs_core_areas: {
          findMany: vi
            .fn()
            .mockResolvedValue([{ id: BigInt(10), name: 'Shared Area' }])
        }
      }

      const result = await resolveAreaNames(mockPrisma, [1, 2])

      expect(result.get(1)).toBe('Shared Area')
      expect(result.get(2)).toBe('Shared Area')
      // Should deduplicate area IDs
      expect(mockPrisma.pafs_core_areas.findMany).toHaveBeenCalledWith({
        where: { id: { in: [BigInt(10)] } },
        select: { id: true, name: true }
      })
    })
  })
})
