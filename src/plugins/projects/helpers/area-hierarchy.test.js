import { describe, test, expect, vi } from 'vitest'
import { resolveAreaHierarchy } from './area-hierarchy.js'

/**
 * Unit tests for resolveAreaHierarchy.
 *
 * The function traverses pafs_core_areas three levels deep:
 *   RMA (project's area) → PSO (RFCC name) → EA Area
 *
 * Each step is mocked via a `prisma.pafs_core_areas.findFirst` vi.fn().
 */

const buildMockPrisma = (calls = []) => {
  const findFirst = vi.fn()
  calls.forEach((returnValue, index) => {
    findFirst.mockResolvedValueOnce(returnValue)
  })

  return {
    pafs_core_areas: { findFirst }
  }
}

describe('resolveAreaHierarchy', () => {
  describe('null / missing areaId', () => {
    test('Should return empty hierarchy when areaId is null', async () => {
      const prisma = buildMockPrisma()

      const result = await resolveAreaHierarchy(prisma, null)

      expect(result).toEqual({
        rmaName: null,
        psoName: null,
        rfccName: null,
        eaAreaName: null
      })
      expect(prisma.pafs_core_areas.findFirst).not.toHaveBeenCalled()
    })

    test('Should return empty hierarchy when areaId is undefined', async () => {
      const prisma = buildMockPrisma()

      const result = await resolveAreaHierarchy(prisma, undefined)

      expect(result).toEqual({
        rmaName: null,
        psoName: null,
        rfccName: null,
        eaAreaName: null
      })
      expect(prisma.pafs_core_areas.findFirst).not.toHaveBeenCalled()
    })

    test('Should return empty hierarchy when areaId is 0', async () => {
      const prisma = buildMockPrisma()

      const result = await resolveAreaHierarchy(prisma, 0)

      expect(result).toEqual({
        rmaName: null,
        psoName: null,
        rfccName: null,
        eaAreaName: null
      })
      expect(prisma.pafs_core_areas.findFirst).not.toHaveBeenCalled()
    })
  })

  describe('RMA not found in database', () => {
    test('Should return empty hierarchy when RMA area is not found', async () => {
      const prisma = buildMockPrisma([null])

      const result = await resolveAreaHierarchy(prisma, 42)

      expect(result).toEqual({
        rmaName: null,
        psoName: null,
        rfccName: null,
        eaAreaName: null
      })
      expect(prisma.pafs_core_areas.findFirst).toHaveBeenCalledOnce()
      expect(prisma.pafs_core_areas.findFirst).toHaveBeenCalledWith({
        where: { id: BigInt(42) },
        select: { name: true, parent_id: true }
      })
    })
  })

  describe('Partial hierarchy', () => {
    test('Should return only rmaName when RMA has no parent_id', async () => {
      const prisma = buildMockPrisma([
        { name: 'South Yorkshire', parent_id: null } // RMA — no PSO parent
      ])

      const result = await resolveAreaHierarchy(prisma, 10)

      expect(result).toEqual({
        rmaName: 'South Yorkshire',
        psoName: null,
        rfccName: null,
        eaAreaName: null
      })
      // Only one findFirst call (for RMA); no PSO or EA query needed
      expect(prisma.pafs_core_areas.findFirst).toHaveBeenCalledOnce()
    })

    test('Should return rmaName and psoName/rfccName when PSO has no parent_id', async () => {
      const prisma = buildMockPrisma([
        { name: 'South Yorkshire', parent_id: 20 }, // RMA
        { name: 'Yorkshire RFCC', parent_id: null } // PSO — no EA parent
      ])

      const result = await resolveAreaHierarchy(prisma, 10)

      expect(result).toEqual({
        rmaName: 'South Yorkshire',
        psoName: 'Yorkshire RFCC',
        rfccName: 'Yorkshire RFCC', // same as psoName
        eaAreaName: null
      })
      expect(prisma.pafs_core_areas.findFirst).toHaveBeenCalledTimes(2)
    })

    test('Should return null rmaName when RMA name is null', async () => {
      const prisma = buildMockPrisma([
        { name: null, parent_id: null } // RMA with null name
      ])

      const result = await resolveAreaHierarchy(prisma, 10)

      expect(result.rmaName).toBeNull()
    })

    test('Should return null psoName when PSO is not found in DB', async () => {
      const prisma = buildMockPrisma([
        { name: 'South Yorkshire', parent_id: 99 }, // RMA points to PSO 99
        null // PSO 99 not found
      ])

      const result = await resolveAreaHierarchy(prisma, 10)

      expect(result.rmaName).toBe('South Yorkshire')
      expect(result.psoName).toBeNull()
      expect(result.rfccName).toBeNull()
      expect(result.eaAreaName).toBeNull()
    })
  })

  describe('Full three-level hierarchy', () => {
    test('Should resolve full RMA → PSO → EA hierarchy', async () => {
      const prisma = buildMockPrisma([
        { name: 'South Yorkshire', parent_id: 20 }, // RMA
        { name: 'Yorkshire RFCC', parent_id: 30 }, // PSO
        { name: 'North East' } // EA Area
      ])

      const result = await resolveAreaHierarchy(prisma, 10)

      expect(result).toEqual({
        rmaName: 'South Yorkshire',
        psoName: 'Yorkshire RFCC',
        rfccName: 'Yorkshire RFCC',
        eaAreaName: 'North East'
      })
      expect(prisma.pafs_core_areas.findFirst).toHaveBeenCalledTimes(3)
    })

    test('Should query each level with the correct parent_id as BigInt', async () => {
      const prisma = buildMockPrisma([
        { name: 'Doncaster MBC', parent_id: 50 },
        { name: 'Yorkshire RFCC', parent_id: 51 },
        { name: 'North East' }
      ])

      await resolveAreaHierarchy(prisma, 100)

      const calls = prisma.pafs_core_areas.findFirst.mock.calls
      expect(calls[0][0]).toEqual({
        where: { id: BigInt(100) },
        select: { name: true, parent_id: true }
      })
      expect(calls[1][0]).toEqual({
        where: { id: BigInt(50) },
        select: { name: true, parent_id: true }
      })
      expect(calls[2][0]).toEqual({
        where: { id: BigInt(51) },
        select: { name: true }
      })
    })

    test('Should treat psoName and rfccName as identical values', async () => {
      const prisma = buildMockPrisma([
        { name: 'Hull City Council', parent_id: 20 },
        { name: 'Humber RFCC', parent_id: 30 },
        { name: 'North East' }
      ])

      const result = await resolveAreaHierarchy(prisma, 5)

      expect(result.psoName).toBe('Humber RFCC')
      expect(result.rfccName).toBe('Humber RFCC')
    })
  })

  describe('BigInt conversion', () => {
    test('Should accept numeric areaId and convert to BigInt for DB query', async () => {
      const prisma = buildMockPrisma([null])

      await resolveAreaHierarchy(prisma, 999)

      expect(prisma.pafs_core_areas.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: BigInt(999) } })
      )
    })

    test('Should accept string areaId and convert to BigInt for DB query', async () => {
      const prisma = buildMockPrisma([null])

      await resolveAreaHierarchy(prisma, '42')

      expect(prisma.pafs_core_areas.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: BigInt(42) } })
      )
    })
  })

  describe('Return value is always a new object', () => {
    test('Should return a fresh object for null areaId (not shared reference)', async () => {
      const prisma = buildMockPrisma()

      const r1 = await resolveAreaHierarchy(prisma, null)
      const r2 = await resolveAreaHierarchy(prisma, null)

      expect(r1).not.toBe(r2)
    })
  })
})
