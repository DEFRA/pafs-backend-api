import { describe, test, expect, vi, beforeEach } from 'vitest'
import {
  resolveAreaHierarchy,
  preWarmAreaHierarchyCache,
  clearAreaHierarchyCache
} from './area-hierarchy.js'

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
  calls.forEach((returnValue) => {
    findFirst.mockResolvedValueOnce(returnValue)
  })

  return {
    pafs_core_areas: { findFirst }
  }
}

describe('resolveAreaHierarchy', () => {
  beforeEach(() => {
    clearAreaHierarchyCache()
  })

  describe('null / missing areaId', () => {
    test('Should return empty hierarchy when areaId is null', async () => {
      const prisma = buildMockPrisma()

      const result = await resolveAreaHierarchy(prisma, null)

      expect(result).toEqual({
        rmaName: null,
        rmaSubType: null,
        psoAreaId: null,
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
        rmaSubType: null,
        psoAreaId: null,
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
        rmaSubType: null,
        psoAreaId: null,
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
        rmaSubType: null,
        psoAreaId: null,
        psoName: null,
        rfccName: null,
        eaAreaName: null
      })
      expect(prisma.pafs_core_areas.findFirst).toHaveBeenCalledOnce()
      expect(prisma.pafs_core_areas.findFirst).toHaveBeenCalledWith({
        where: { id: BigInt(42) },
        select: { name: true, sub_type: true, parent_id: true }
      })
    })
  })

  describe('Partial hierarchy', () => {
    test('Should return only rmaName when RMA has no parent_id', async () => {
      const prisma = buildMockPrisma([
        { name: 'South Yorkshire', sub_type: null, parent_id: null } // RMA — no PSO parent
      ])

      const result = await resolveAreaHierarchy(prisma, 10)

      expect(result).toEqual({
        rmaName: 'South Yorkshire',
        rmaSubType: null,
        psoAreaId: null,
        psoName: null,
        rfccName: null,
        eaAreaName: null
      })
      // Only one findFirst call (for RMA); no PSO or EA query needed
      expect(prisma.pafs_core_areas.findFirst).toHaveBeenCalledOnce()
    })

    test('Should return rmaName and psoName/rfccName when PSO has no parent_id', async () => {
      const prisma = buildMockPrisma([
        { name: 'South Yorkshire', sub_type: null, parent_id: 20 }, // RMA
        { id: 20n, name: 'Yorkshire RFCC', parent_id: null } // PSO — no EA parent
      ])

      const result = await resolveAreaHierarchy(prisma, 10)

      expect(result).toEqual({
        rmaName: 'South Yorkshire',
        rmaSubType: null,
        psoAreaId: 20,
        psoName: 'Yorkshire RFCC',
        rfccName: 'Yorkshire RFCC', // same as psoName
        eaAreaName: null
      })
      expect(prisma.pafs_core_areas.findFirst).toHaveBeenCalledTimes(2)
    })

    test('Should return null rmaName when RMA name is null', async () => {
      const prisma = buildMockPrisma([
        { name: null, sub_type: null, parent_id: null } // RMA with null name
      ])

      const result = await resolveAreaHierarchy(prisma, 10)

      expect(result.rmaName).toBeNull()
    })

    test('Should return null psoName when PSO is not found in DB', async () => {
      const prisma = buildMockPrisma([
        { name: 'South Yorkshire', sub_type: null, parent_id: 99 }, // RMA points to PSO 99
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
        { name: 'South Yorkshire', sub_type: 'LA', parent_id: 20 }, // RMA
        { id: 20n, name: 'Yorkshire RFCC', parent_id: 30 }, // PSO
        { name: 'North East' } // EA Area
      ])

      const result = await resolveAreaHierarchy(prisma, 10)

      expect(result).toEqual({
        rmaName: 'South Yorkshire',
        rmaSubType: 'LA',
        psoAreaId: 20,
        psoName: 'Yorkshire RFCC',
        rfccName: 'Yorkshire RFCC',
        eaAreaName: 'North East'
      })
      expect(prisma.pafs_core_areas.findFirst).toHaveBeenCalledTimes(3)
    })

    test('Should query each level with the correct parent_id as BigInt', async () => {
      const prisma = buildMockPrisma([
        { name: 'Doncaster MBC', sub_type: 'LA', parent_id: 50 },
        { id: 50n, name: 'Yorkshire RFCC', parent_id: 51 },
        { name: 'North East' }
      ])

      await resolveAreaHierarchy(prisma, 100)

      const calls = prisma.pafs_core_areas.findFirst.mock.calls
      expect(calls[0][0]).toEqual({
        where: { id: BigInt(100) },
        select: { name: true, sub_type: true, parent_id: true }
      })
      expect(calls[1][0]).toEqual({
        where: { id: BigInt(50) },
        select: { id: true, name: true, parent_id: true }
      })
      expect(calls[2][0]).toEqual({
        where: { id: BigInt(51) },
        select: { name: true }
      })
    })

    test('Should treat psoName and rfccName as identical values', async () => {
      const prisma = buildMockPrisma([
        { name: 'Hull City Council', sub_type: null, parent_id: 20 },
        { id: 20n, name: 'Humber RFCC', parent_id: 30 },
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

  describe('In-process cache', () => {
    test('Should return cached result on second call for same areaId — no extra DB queries', async () => {
      const prisma = buildMockPrisma([
        { name: 'South Yorkshire', sub_type: 'LA', parent_id: 20 },
        { id: 20n, name: 'Yorkshire RFCC', parent_id: 30 },
        { name: 'North East' }
      ])

      const first = await resolveAreaHierarchy(prisma, 10)
      const second = await resolveAreaHierarchy(prisma, 10)

      // DB should only be hit once across both calls
      expect(prisma.pafs_core_areas.findFirst).toHaveBeenCalledTimes(3)
      expect(first).toEqual(second)
    })

    test('Should cache the same object reference on repeated calls', async () => {
      const prisma = buildMockPrisma([
        { name: 'Hull City Council', sub_type: null, parent_id: 20 },
        { id: 20n, name: 'Humber RFCC', parent_id: 30 },
        { name: 'North East' }
      ])

      const first = await resolveAreaHierarchy(prisma, 5)
      const second = await resolveAreaHierarchy(prisma, 5)

      expect(second).toBe(first)
    })

    test('Should not cache null-areaId calls (falsy guard skips cache)', async () => {
      const prisma = buildMockPrisma()

      const r1 = await resolveAreaHierarchy(prisma, null)
      const r2 = await resolveAreaHierarchy(prisma, null)

      expect(r1).not.toBe(r2)
      expect(prisma.pafs_core_areas.findFirst).not.toHaveBeenCalled()
    })

    test('Should re-query DB after the cache TTL expires', async () => {
      const prisma = buildMockPrisma([
        // First call — RMA only, no parent
        { name: 'First Load', sub_type: null, parent_id: null },
        // Second call (after TTL) — RMA only, no parent
        { name: 'Second Load', sub_type: null, parent_id: null }
      ])

      // Populate the cache
      await resolveAreaHierarchy(prisma, 77)
      expect(prisma.pafs_core_areas.findFirst).toHaveBeenCalledTimes(1)

      // Advance time past the 1-hour TTL
      const realNow = Date.now
      Date.now = () => realNow() + 61 * 60 * 1000
      try {
        const result = await resolveAreaHierarchy(prisma, 77)
        // DB should have been queried again
        expect(prisma.pafs_core_areas.findFirst).toHaveBeenCalledTimes(2)
        expect(result.rmaName).toBe('Second Load')
      } finally {
        Date.now = realNow
      }
    })

    test('Cached result from pre-warm is returned without hitting DB', async () => {
      const prisma = buildMockPrisma()

      // Pre-warm with three areas: RMA → PSO → EA
      const mockPrismaForWarm = {
        pafs_core_areas: {
          findMany: vi.fn().mockResolvedValue([
            { id: 10n, name: 'South Yorkshire', sub_type: 'LA', parent_id: 20 },
            { id: 20n, name: 'Yorkshire RFCC', sub_type: null, parent_id: 30 },
            { id: 30n, name: 'North East', sub_type: null, parent_id: null }
          ])
        }
      }
      await preWarmAreaHierarchyCache(mockPrismaForWarm)

      // resolveAreaHierarchy should hit the cache — not the per-request prisma mock
      const result = await resolveAreaHierarchy(prisma, 10)

      expect(prisma.pafs_core_areas.findFirst).not.toHaveBeenCalled()
      expect(result.rmaName).toBe('South Yorkshire')
      expect(result.psoName).toBe('Yorkshire RFCC')
      expect(result.eaAreaName).toBe('North East')
    })

    test('Should use separate cache entries for different areaIds', async () => {
      const prisma = buildMockPrisma([
        { name: 'Area A', sub_type: null, parent_id: null },
        { name: 'Area B', sub_type: null, parent_id: null }
      ])

      const resultA = await resolveAreaHierarchy(prisma, 11)
      const resultB = await resolveAreaHierarchy(prisma, 12)

      expect(resultA.rmaName).toBe('Area A')
      expect(resultB.rmaName).toBe('Area B')
      expect(prisma.pafs_core_areas.findFirst).toHaveBeenCalledTimes(2)
    })
  })
})

describe('preWarmAreaHierarchyCache', () => {
  beforeEach(() => {
    clearAreaHierarchyCache()
  })

  function buildWarmPrisma(areas) {
    return {
      pafs_core_areas: {
        findMany: vi.fn().mockResolvedValue(areas)
      }
    }
  }

  test('fetches all areas in a single query', async () => {
    const prisma = buildWarmPrisma([
      { id: 1n, name: 'Test RMA', sub_type: null, parent_id: null }
    ])

    await preWarmAreaHierarchyCache(prisma)

    expect(prisma.pafs_core_areas.findMany).toHaveBeenCalledOnce()
    expect(prisma.pafs_core_areas.findMany).toHaveBeenCalledWith({
      select: { id: true, name: true, sub_type: true, parent_id: true }
    })
  })

  test('populates cache for every area so subsequent resolveAreaHierarchy calls skip DB', async () => {
    const warmPrisma = buildWarmPrisma([
      { id: 5n, name: 'RMA Five', sub_type: 'LA', parent_id: 6 },
      { id: 6n, name: 'PSO Six', sub_type: null, parent_id: null }
    ])
    await preWarmAreaHierarchyCache(warmPrisma)

    const requestPrisma = buildMockPrisma() // no mock returns — should not be called
    const result = await resolveAreaHierarchy(requestPrisma, 5)

    expect(requestPrisma.pafs_core_areas.findFirst).not.toHaveBeenCalled()
    expect(result.rmaName).toBe('RMA Five')
    expect(result.psoName).toBe('PSO Six')
  })

  test('resolves full three-level hierarchy in memory without extra queries', async () => {
    const warmPrisma = buildWarmPrisma([
      { id: 10n, name: 'South Yorkshire', sub_type: 'LA', parent_id: 20 },
      { id: 20n, name: 'Yorkshire RFCC', sub_type: null, parent_id: 30 },
      { id: 30n, name: 'North East', sub_type: null, parent_id: null }
    ])
    await preWarmAreaHierarchyCache(warmPrisma)

    const requestPrisma = buildMockPrisma()
    const result = await resolveAreaHierarchy(requestPrisma, 10)

    expect(result).toEqual({
      rmaName: 'South Yorkshire',
      rmaSubType: 'LA',
      psoAreaId: 20,
      psoName: 'Yorkshire RFCC',
      rfccName: 'Yorkshire RFCC',
      eaAreaName: 'North East'
    })
    expect(requestPrisma.pafs_core_areas.findFirst).not.toHaveBeenCalled()
  })

  test('does nothing when area table is empty', async () => {
    const prisma = buildWarmPrisma([])
    await preWarmAreaHierarchyCache(prisma)

    // Cache still empty — lazy load should work normally
    const requestPrisma = buildMockPrisma([null])
    await resolveAreaHierarchy(requestPrisma, 99)
    expect(requestPrisma.pafs_core_areas.findFirst).toHaveBeenCalledOnce()
  })

  test('logs count on success when logger is provided', async () => {
    const prisma = buildWarmPrisma([
      { id: 1n, name: 'Area', sub_type: null, parent_id: null }
    ])
    const logger = { info: vi.fn() }

    await preWarmAreaHierarchyCache(prisma, logger)

    expect(logger.info).toHaveBeenCalledWith(
      { count: 1 },
      'Area hierarchy cache pre-warmed'
    )
  })
})
