import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  getCachedProjectScalar,
  setCachedProjectScalar,
  invalidateCachedProjectScalar,
  clearProjectScalarCache
} from './project-scalar-cache.js'

const REF = 'ANC501E/000A/001A'
const PROJECT = { id: 1, name: 'Test Project', areaId: 10 }

describe('project-scalar-cache', () => {
  beforeEach(() => {
    clearProjectScalarCache()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('getCachedProjectScalar', () => {
    test('returns null when no entry exists', () => {
      expect(getCachedProjectScalar(REF)).toBeNull()
    })

    test('returns cached value when entry is fresh', () => {
      setCachedProjectScalar(REF, PROJECT)
      expect(getCachedProjectScalar(REF)).toBe(PROJECT)
    })

    test('returns null after TTL of 60 seconds has elapsed', () => {
      setCachedProjectScalar(REF, PROJECT)
      vi.advanceTimersByTime(60_001)
      expect(getCachedProjectScalar(REF)).toBeNull()
    })

    test('returns value when exactly at TTL boundary (not yet expired)', () => {
      setCachedProjectScalar(REF, PROJECT)
      vi.advanceTimersByTime(59_999)
      expect(getCachedProjectScalar(REF)).toBe(PROJECT)
    })

    test('evicts expired entry from cache on read', () => {
      setCachedProjectScalar(REF, PROJECT)
      vi.advanceTimersByTime(60_001)
      getCachedProjectScalar(REF) // triggers eviction
      // A subsequent read should also return null (not re-read stale data)
      expect(getCachedProjectScalar(REF)).toBeNull()
    })

    test('returns null for a different reference number', () => {
      setCachedProjectScalar(REF, PROJECT)
      expect(getCachedProjectScalar('OTHER/REF')).toBeNull()
    })

    test('returns independent values for different reference numbers', () => {
      const projectA = { id: 1 }
      const projectB = { id: 2 }
      setCachedProjectScalar('REF/A', projectA)
      setCachedProjectScalar('REF/B', projectB)
      expect(getCachedProjectScalar('REF/A')).toBe(projectA)
      expect(getCachedProjectScalar('REF/B')).toBe(projectB)
    })
  })

  describe('setCachedProjectScalar', () => {
    test('overwrites an existing entry for the same reference number', () => {
      const first = { id: 1, name: 'First' }
      const second = { id: 1, name: 'Updated' }
      setCachedProjectScalar(REF, first)
      setCachedProjectScalar(REF, second)
      expect(getCachedProjectScalar(REF)).toBe(second)
    })

    test('resets the TTL when overwriting an existing entry', () => {
      setCachedProjectScalar(REF, PROJECT)
      vi.advanceTimersByTime(50_000)
      const updated = { id: 1, name: 'Updated' }
      setCachedProjectScalar(REF, updated) // resets TTL
      vi.advanceTimersByTime(50_000) // only 50s since the reset
      expect(getCachedProjectScalar(REF)).toBe(updated)
    })
  })

  describe('invalidateCachedProjectScalar', () => {
    test('removes the entry so subsequent get returns null', () => {
      setCachedProjectScalar(REF, PROJECT)
      invalidateCachedProjectScalar(REF)
      expect(getCachedProjectScalar(REF)).toBeNull()
    })

    test('is a no-op when reference number is not cached', () => {
      expect(() => invalidateCachedProjectScalar('NON/EXISTENT')).not.toThrow()
    })

    test('only removes the targeted entry, not others', () => {
      setCachedProjectScalar('REF/A', { id: 1 })
      setCachedProjectScalar('REF/B', { id: 2 })
      invalidateCachedProjectScalar('REF/A')
      expect(getCachedProjectScalar('REF/A')).toBeNull()
      expect(getCachedProjectScalar('REF/B')).toEqual({ id: 2 })
    })
  })

  describe('clearProjectScalarCache', () => {
    test('removes all entries', () => {
      setCachedProjectScalar('REF/A', { id: 1 })
      setCachedProjectScalar('REF/B', { id: 2 })
      clearProjectScalarCache()
      expect(getCachedProjectScalar('REF/A')).toBeNull()
      expect(getCachedProjectScalar('REF/B')).toBeNull()
    })

    test('is a no-op when cache is already empty', () => {
      expect(() => clearProjectScalarCache()).not.toThrow()
    })
  })
})
