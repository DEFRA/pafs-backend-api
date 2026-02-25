import { describe, test, expect } from 'vitest'
import { formatProject, PROJECT_SELECT_FIELDS } from './project-formatter.js'

describe('project-formatter', () => {
  describe('PROJECT_SELECT_FIELDS', () => {
    test('Should have all required fields for project selection', () => {
      expect(PROJECT_SELECT_FIELDS).toEqual({
        id: true,
        reference_number: true,
        name: true,
        rma_name: true,
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
        area_id: null,
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
        areaId: null,
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
        area_id: null,
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
        areaId: null,
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
        area_id: null,
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
        areaId: null,
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
        area_id: null,
        created_at: new Date('2024-03-01T10:00:00Z'),
        updated_at: new Date('2024-03-02T15:30:00Z'),
        submitted_at: null
      }

      const result = formatProject(mockProject)

      expect(result.submittedAt).toBeNull()
      expect(result.areaId).toBeNull()
      expect(result.status).toBe('draft')
    })

    test('Should convert BigInt id to Number', () => {
      const mockProject = {
        id: BigInt(999999999999),
        reference_number: 'RMS00001',
        slug: 'RMS00001/BIG005',
        name: 'Big ID Project',
        rma_name: 'Test Authority',
        area_id: null,
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
        area_id: null,
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
        area_id: null,
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
        area_id: null,
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
        area_id: null,
        created_at: new Date('2024-08-01T10:00:00Z'),
        updated_at: new Date('2024-08-02T15:30:00Z'),
        submitted_at: new Date('2024-08-03T12:00:00Z')
      }

      const result = formatProject(mockProject, 'submitted')

      expect(result).toHaveProperty('referenceNumber')
      expect(result).toHaveProperty('referenceNumberFormatted')
      expect(result).toHaveProperty('rmaName')
      expect(result).toHaveProperty('areaId')
      expect(result).toHaveProperty('createdAt')
      expect(result).toHaveProperty('updatedAt')
      expect(result).toHaveProperty('submittedAt')
      expect(result).not.toHaveProperty('reference_number')
      expect(result).not.toHaveProperty('rma_name')
      expect(result).not.toHaveProperty('area_id')
      expect(result).not.toHaveProperty('created_at')
    })

    test('Should format areaId from area_id field', () => {
      const mockProject = {
        id: BigInt(7),
        reference_number: 'RMS00006',
        slug: 'RMS00006/AREA010',
        name: 'Project with Area',
        rma_name: 'Test Authority',
        area_id: BigInt(5),
        created_at: new Date('2024-09-01T10:00:00Z'),
        updated_at: new Date('2024-09-02T15:30:00Z'),
        submitted_at: null
      }

      const result = formatProject(mockProject)

      expect(result.areaId).toBe(5)
      expect(typeof result.areaId).toBe('number')
    })

    test('Should handle null area_id', () => {
      const mockProject = {
        id: BigInt(8),
        reference_number: 'RMS00007',
        slug: 'RMS00007/NOAREA011',
        name: 'Project without Area',
        rma_name: 'Test Authority',
        area_id: null,
        created_at: new Date('2024-09-03T10:00:00Z'),
        updated_at: new Date('2024-09-04T15:30:00Z'),
        submitted_at: null
      }

      const result = formatProject(mockProject)

      expect(result.areaId).toBeNull()
    })

    test('Should handle undefined area_id', () => {
      const mockProject = {
        id: BigInt(9),
        reference_number: 'RMS00008',
        slug: 'RMS00008/UNDEF012',
        name: 'Project with undefined area',
        rma_name: 'Test Authority',
        created_at: new Date('2024-09-05T10:00:00Z'),
        updated_at: new Date('2024-09-06T15:30:00Z'),
        submitted_at: null
      }

      const result = formatProject(mockProject)

      expect(result.areaId).toBeNull()
    })

    test('Should convert BigInt area_id to Number', () => {
      const mockProject = {
        id: BigInt(10),
        reference_number: 'RMS00009',
        slug: 'RMS00009/BIGAREA013',
        name: 'Project with BigInt area',
        rma_name: 'Test Authority',
        area_id: BigInt(999999),
        created_at: new Date('2024-09-07T10:00:00Z'),
        updated_at: new Date('2024-09-08T15:30:00Z'),
        submitted_at: null
      }

      const result = formatProject(mockProject)

      expect(result.areaId).toBe(999999)
      expect(typeof result.areaId).toBe('number')
    })

    test('Should convert string area_id to Number', () => {
      const mockProject = {
        id: BigInt(11),
        reference_number: 'RMS00010',
        slug: 'RMS00010/STRAREA014',
        name: 'Project with string area',
        rma_name: 'Test Authority',
        area_id: '42',
        created_at: new Date('2024-09-09T10:00:00Z'),
        updated_at: new Date('2024-09-10T15:30:00Z'),
        submitted_at: null
      }

      const result = formatProject(mockProject)

      expect(result.areaId).toBe(42)
      expect(typeof result.areaId).toBe('number')
    })
  })
})
