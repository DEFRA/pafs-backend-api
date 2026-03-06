import { describe, test, expect } from 'vitest'
import {
  AREA_FIELDS,
  AREA_FIELDS_WITH_TIMESTAMPS,
  INSENSITIVE_MODE,
  serializeArea,
  isAreaType,
  isPsoArea,
  buildAreasListWhereClause,
  prepareAreaData
} from './area-utils.js'
import { AREA_TYPE_MAP } from '../../../common/constants/common.js'

describe('area-utils', () => {
  describe('constants', () => {
    test('AREA_FIELDS should contain core area fields', () => {
      expect(AREA_FIELDS).toEqual({
        id: true,
        name: true,
        parent_id: true,
        area_type: true,
        sub_type: true,
        identifier: true,
        end_date: true
      })
    })

    test('AREA_FIELDS_WITH_TIMESTAMPS should extend AREA_FIELDS', () => {
      expect(AREA_FIELDS_WITH_TIMESTAMPS).toEqual({
        ...AREA_FIELDS,
        created_at: true,
        updated_at: true
      })
    })

    test('INSENSITIVE_MODE should be "insensitive"', () => {
      expect(INSENSITIVE_MODE).toBe('insensitive')
    })
  })

  describe('isAreaType', () => {
    test('should match exact area types', () => {
      expect(isAreaType('RMA', 'RMA')).toBe(true)
      expect(isAreaType('EA Area', 'EA Area')).toBe(true)
    })

    test('should be case-insensitive', () => {
      expect(isAreaType('rma', 'RMA')).toBe(true)
      expect(isAreaType('PSO Area', 'pso area')).toBe(true)
    })

    test('should return false for non-matching types', () => {
      expect(isAreaType('RMA', 'EA Area')).toBe(false)
    })

    test('should handle null values', () => {
      expect(isAreaType(null, 'RMA')).toBe(false)
      expect(isAreaType('RMA', null)).toBe(false)
      // Both null → both toUpperCase() return undefined, so they match
      expect(isAreaType(null, null)).toBe(true)
    })

    test('should handle undefined values', () => {
      expect(isAreaType(undefined, 'RMA')).toBe(false)
    })
  })

  describe('isPsoArea', () => {
    test('should match PSO Area type', () => {
      expect(isPsoArea('PSO Area')).toBe(true)
      expect(isPsoArea(AREA_TYPE_MAP.PSO)).toBe(true)
    })

    test('should match legacy PSO label', () => {
      expect(isPsoArea('PSO')).toBe(true)
    })

    test('should be case-insensitive', () => {
      expect(isPsoArea('pso area')).toBe(true)
      expect(isPsoArea('pso')).toBe(true)
    })

    test('should return false for non-PSO types', () => {
      expect(isPsoArea('RMA')).toBe(false)
      expect(isPsoArea('EA Area')).toBe(false)
    })

    test('should handle null and undefined', () => {
      expect(isPsoArea(null)).toBe(false)
      expect(isPsoArea(undefined)).toBe(false)
    })
  })

  describe('serializeArea', () => {
    const mockArea = {
      id: BigInt(42),
      name: 'Test Area',
      parent_id: BigInt(10),
      area_type: 'RMA',
      sub_type: 'AUTH001',
      identifier: 'RMA001',
      end_date: null
    }

    test('should convert BigInt id to string', () => {
      const result = serializeArea(mockArea)
      expect(result.id).toBe('42')
      expect(result.parent_id).toBe('10')
    })

    test('should handle null parent_id', () => {
      const area = { ...mockArea, parent_id: null }
      const result = serializeArea(area)
      expect(result.parent_id).toBeNull()
    })

    test('should convert timestamps to ISO strings by default', () => {
      const area = {
        ...mockArea,
        created_at: new Date('2024-01-01T10:00:00Z'),
        updated_at: new Date('2024-01-02T15:30:00Z')
      }
      const result = serializeArea(area)
      expect(result.created_at).toBe('2024-01-01T10:00:00.000Z')
      expect(result.updated_at).toBe('2024-01-02T15:30:00.000Z')
    })

    test('should skip timestamps if not present in area', () => {
      const result = serializeArea(mockArea)
      expect(result).not.toHaveProperty('created_at')
      expect(result).not.toHaveProperty('updated_at')
    })

    test('should keep timestamps as Date objects with rawTimestamps option', () => {
      const created = new Date('2024-01-01T10:00:00Z')
      const updated = new Date('2024-01-02T15:30:00Z')
      const area = { ...mockArea, created_at: created, updated_at: updated }

      const result = serializeArea(area, { rawTimestamps: true })

      expect(result.created_at).toBe(created)
      expect(result.updated_at).toBe(updated)
      expect(result.created_at).toBeInstanceOf(Date)
    })

    test('should include all standard fields', () => {
      const result = serializeArea(mockArea)
      expect(result).toEqual({
        id: '42',
        name: 'Test Area',
        parent_id: '10',
        area_type: 'RMA',
        sub_type: 'AUTH001',
        identifier: 'RMA001',
        end_date: null
      })
    })
  })

  describe('buildAreasListWhereClause', () => {
    test('should always exclude EA Area type', () => {
      const where = buildAreasListWhereClause('', '')
      expect(where.area_type).toEqual({ not: 'EA Area' })
    })

    test('should add search filter when provided', () => {
      const where = buildAreasListWhereClause('Flood', '')
      expect(where.name).toEqual({
        contains: 'Flood',
        mode: 'insensitive'
      })
    })

    test('should trim search term', () => {
      const where = buildAreasListWhereClause('  Flood  ', '')
      expect(where.name.contains).toBe('Flood')
    })

    test('should not add search filter for empty/whitespace-only search', () => {
      expect(buildAreasListWhereClause('', '')).not.toHaveProperty('name')
      expect(buildAreasListWhereClause('   ', '')).not.toHaveProperty('name')
      expect(buildAreasListWhereClause(null, '')).not.toHaveProperty('name')
    })

    test('should add type filter when provided', () => {
      const where = buildAreasListWhereClause('', 'RMA')
      expect(where.AND).toEqual([
        {
          area_type: {
            equals: 'RMA',
            mode: 'insensitive'
          }
        }
      ])
    })

    test('should combine search and type filters', () => {
      const where = buildAreasListWhereClause('Test', 'RMA')
      expect(where.name).toBeDefined()
      expect(where.AND).toBeDefined()
    })
  })

  describe('prepareAreaData', () => {
    test('should prepare basic area data', () => {
      const result = prepareAreaData({
        name: 'Test',
        areaType: 'RMA',
        parentId: '10',
        subType: 'AUTH001',
        identifier: 'RMA001',
        endDate: '2025-12-31'
      })

      expect(result.name).toBe('Test')
      expect(result.area_type).toBe('RMA')
      expect(result.parent_id).toBe(10)
      expect(result.sub_type).toBe('AUTH001')
      expect(result.identifier).toBe('RMA001')
      expect(result.end_date).toBeInstanceOf(Date)
      expect(result.updated_at).toBeInstanceOf(Date)
    })

    test('should handle null/missing optional fields', () => {
      const result = prepareAreaData({
        name: 'Test',
        areaType: 'Authority'
      })

      expect(result.parent_id).toBeNull()
      expect(result.sub_type).toBeNull()
      expect(result.identifier).toBeNull()
      expect(result.end_date).toBeNull()
    })

    test('should parse parentId as integer', () => {
      const result = prepareAreaData({
        name: 'Test',
        areaType: 'RMA',
        parentId: '42'
      })

      expect(result.parent_id).toBe(42)
      expect(typeof result.parent_id).toBe('number')
    })
  })
})
