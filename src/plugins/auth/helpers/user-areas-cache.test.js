import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  getCachedUserAreas,
  setCachedUserAreas,
  invalidateCachedUserAreas,
  clearUserAreasCache
} from './user-areas-cache.js'

const TTL_MS = 5 * 60 * 1000 // 300000ms — must match SIZE.LENGTH_5 * 60 * 1000

describe('user-areas-cache', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    clearUserAreasCache()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('getCachedUserAreas', () => {
    it('returns null on a cache miss', () => {
      expect(getCachedUserAreas(1)).toBeNull()
    })

    it('returns the cached value on a hit', () => {
      const areas = [
        { areaId: 10, primary: true, name: 'RMA 1', areaType: 'RMA' }
      ]
      setCachedUserAreas(1, areas)

      expect(getCachedUserAreas(1)).toBe(areas)
    })

    it('returns null after TTL has expired', () => {
      const areas = [
        { areaId: 10, primary: true, name: 'RMA 1', areaType: 'RMA' }
      ]
      setCachedUserAreas(1, areas)

      vi.advanceTimersByTime(TTL_MS + 1)

      expect(getCachedUserAreas(1)).toBeNull()
    })

    it('returns value when TTL has not yet expired', () => {
      const areas = [
        { areaId: 10, primary: true, name: 'RMA 1', areaType: 'RMA' }
      ]
      setCachedUserAreas(1, areas)

      vi.advanceTimersByTime(TTL_MS - 1)

      expect(getCachedUserAreas(1)).toBe(areas)
    })

    it('evicts the expired entry from the map on read', () => {
      setCachedUserAreas(99, [])
      vi.advanceTimersByTime(TTL_MS + 1)

      getCachedUserAreas(99)

      // After eviction a second read should also miss
      expect(getCachedUserAreas(99)).toBeNull()
    })

    it('returns null for a different userId than stored', () => {
      setCachedUserAreas(1, [
        { areaId: 10, primary: true, name: 'A', areaType: 'RMA' }
      ])

      expect(getCachedUserAreas(2)).toBeNull()
    })

    it('treats numeric and string userId as the same key', () => {
      const areas = [{ areaId: 5, primary: true, name: 'B', areaType: 'PSO' }]
      setCachedUserAreas(42, areas)

      expect(getCachedUserAreas('42')).toBe(areas)
    })

    it('returns an empty array when cached value is an empty array', () => {
      setCachedUserAreas(7, [])

      expect(getCachedUserAreas(7)).toEqual([])
    })
  })

  describe('setCachedUserAreas', () => {
    it('stores multiple independent keys', () => {
      const areasA = [{ areaId: 1, primary: true, name: 'A', areaType: 'RMA' }]
      const areasB = [{ areaId: 2, primary: true, name: 'B', areaType: 'PSO' }]
      setCachedUserAreas(1, areasA)
      setCachedUserAreas(2, areasB)

      expect(getCachedUserAreas(1)).toBe(areasA)
      expect(getCachedUserAreas(2)).toBe(areasB)
    })

    it('overwrites an existing entry for the same userId', () => {
      const original = [
        { areaId: 1, primary: true, name: 'A', areaType: 'RMA' }
      ]
      const updated = [{ areaId: 2, primary: true, name: 'B', areaType: 'PSO' }]
      setCachedUserAreas(1, original)
      setCachedUserAreas(1, updated)

      expect(getCachedUserAreas(1)).toBe(updated)
    })

    it('resets the TTL when overwriting an existing entry', () => {
      const original = [
        { areaId: 1, primary: true, name: 'A', areaType: 'RMA' }
      ]
      const updated = [{ areaId: 2, primary: true, name: 'B', areaType: 'PSO' }]

      setCachedUserAreas(1, original)
      vi.advanceTimersByTime(TTL_MS - 1) // almost expired

      setCachedUserAreas(1, updated) // overwrite — TTL resets
      vi.advanceTimersByTime(TTL_MS - 1) // still within new TTL

      expect(getCachedUserAreas(1)).toBe(updated)
    })
  })

  describe('invalidateCachedUserAreas', () => {
    it('removes the entry so next read is a miss', () => {
      setCachedUserAreas(1, [
        { areaId: 10, primary: true, name: 'A', areaType: 'RMA' }
      ])
      invalidateCachedUserAreas(1)

      expect(getCachedUserAreas(1)).toBeNull()
    })

    it('does not throw when invalidating a key that does not exist', () => {
      expect(() => invalidateCachedUserAreas(999)).not.toThrow()
    })

    it('only removes the targeted userId, leaving others intact', () => {
      const areasA = [{ areaId: 1, primary: true, name: 'A', areaType: 'RMA' }]
      const areasB = [{ areaId: 2, primary: true, name: 'B', areaType: 'PSO' }]
      setCachedUserAreas(1, areasA)
      setCachedUserAreas(2, areasB)

      invalidateCachedUserAreas(1)

      expect(getCachedUserAreas(1)).toBeNull()
      expect(getCachedUserAreas(2)).toBe(areasB)
    })
  })

  describe('clearUserAreasCache', () => {
    it('removes all entries', () => {
      setCachedUserAreas(1, [
        { areaId: 1, primary: true, name: 'A', areaType: 'RMA' }
      ])
      setCachedUserAreas(2, [
        { areaId: 2, primary: false, name: 'B', areaType: 'PSO' }
      ])
      setCachedUserAreas(3, [
        { areaId: 3, primary: true, name: 'C', areaType: 'EA' }
      ])

      clearUserAreasCache()

      expect(getCachedUserAreas(1)).toBeNull()
      expect(getCachedUserAreas(2)).toBeNull()
      expect(getCachedUserAreas(3)).toBeNull()
    })

    it('allows new entries to be set after clear', () => {
      setCachedUserAreas(1, [])
      clearUserAreasCache()

      const fresh = [{ areaId: 5, primary: true, name: 'D', areaType: 'RMA' }]
      setCachedUserAreas(1, fresh)

      expect(getCachedUserAreas(1)).toBe(fresh)
    })
  })
})
