import { describe, test, expect, vi, beforeEach } from 'vitest'
import {
  formatCounterParts,
  incrementReferenceCounter,
  generateProjectReferenceNumber
} from './project-reference-service.js'

/**
 * Unit tests for project-reference-service.js
 *
 * These functions were extracted from ProjectService so they can be tested
 * in isolation without instantiating the full service class.
 *
 * Reference number format: {RFCC_CODE}C501E/{high:03d}A/{low:03d}A
 * Example: ANC501E/000A/001A
 */

// ---------------------------------------------------------------------------
// formatCounterParts — pure function, no mocks needed
// ---------------------------------------------------------------------------

describe('formatCounterParts', () => {
  test('Should format counters with three-digit zero-padding and A suffix', () => {
    expect(formatCounterParts(0, 1)).toBe('000A/001A')
  })

  test('Should format mid-range values correctly', () => {
    expect(formatCounterParts(12, 99)).toBe('012A/099A')
  })

  test('Should format large values (no padding needed)', () => {
    expect(formatCounterParts(999, 999)).toBe('999A/999A')
  })

  test('Should format the rollover boundary correctly', () => {
    expect(formatCounterParts(6, 1)).toBe('006A/001A')
  })

  test('Should handle zero high counter with high low counter', () => {
    expect(formatCounterParts(0, 998)).toBe('000A/998A')
  })
})

// ---------------------------------------------------------------------------
// incrementReferenceCounter — single atomic DB operation, no transaction
// ---------------------------------------------------------------------------

describe('incrementReferenceCounter', () => {
  let mockPrisma

  beforeEach(() => {
    vi.clearAllMocks()

    mockPrisma = {
      $queryRaw: vi.fn()
    }
  })

  test('Should create new counter and return high: 0, low: 1 on first use', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      { high_counter: 0, low_counter: 1 }
    ])

    const result = await incrementReferenceCounter(mockPrisma, 'AN')

    expect(result).toEqual({ high_counter: 0, low_counter: 1 })
  })

  test('Should return incremented low_counter when below 999', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      { high_counter: 0, low_counter: 6 }
    ])

    const result = await incrementReferenceCounter(mockPrisma, 'AN')

    expect(result.low_counter).toBe(6)
    expect(result.high_counter).toBe(0)
  })

  test('Should return rolled-over counters when low_counter was at 999', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      { high_counter: 6, low_counter: 1 }
    ])

    const result = await incrementReferenceCounter(mockPrisma, 'AN')

    expect(result).toEqual({ high_counter: 6, low_counter: 1 })
  })

  test('Should execute a single database operation per call', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      { high_counter: 0, low_counter: 1 }
    ])

    await incrementReferenceCounter(mockPrisma, 'AN')

    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1)
  })

  test('Should call $queryRaw for the provided rfccCode', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      { high_counter: 0, low_counter: 1 }
    ])

    await incrementReferenceCounter(mockPrisma, 'AE')

    expect(mockPrisma.$queryRaw).toHaveBeenCalledOnce()
  })

  test('Should propagate errors thrown by $queryRaw', async () => {
    const dbError = new Error('Counter update failed')
    mockPrisma.$queryRaw.mockRejectedValue(dbError)

    await expect(incrementReferenceCounter(mockPrisma, 'AN')).rejects.toThrow(
      'Counter update failed'
    )
  })
})

// ---------------------------------------------------------------------------
// generateProjectReferenceNumber — orchestration + logging
// ---------------------------------------------------------------------------

describe('generateProjectReferenceNumber', () => {
  let mockPrisma
  let mockLogger

  beforeEach(() => {
    vi.clearAllMocks()

    mockLogger = {
      info: vi.fn(),
      error: vi.fn()
    }

    mockPrisma = {
      $queryRaw: vi
        .fn()
        .mockResolvedValue([{ high_counter: 0, low_counter: 1 }])
    }
  })

  test('Should generate reference number with default RFCC code AN', async () => {
    const result = await generateProjectReferenceNumber(mockPrisma, mockLogger)

    expect(result).toBe('ANC501E/000A/001A')
  })

  test('Should use provided RFCC code as prefix', async () => {
    const result = await generateProjectReferenceNumber(
      mockPrisma,
      mockLogger,
      'AE'
    )

    expect(result).toBe('AEC501E/000A/001A')
  })

  test('Should build reference number from counter results', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      { high_counter: 12, low_counter: 100 }
    ])

    const result = await generateProjectReferenceNumber(mockPrisma, mockLogger)

    expect(result).toBe('ANC501E/012A/100A')
  })

  test('Should build reference number after rollover (high incremented, low reset to 1)', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      { high_counter: 6, low_counter: 1 }
    ])

    const result = await generateProjectReferenceNumber(mockPrisma, mockLogger)

    expect(result).toBe('ANC501E/006A/001A')
  })

  test('Should log info at the start with rfccCode', async () => {
    await generateProjectReferenceNumber(mockPrisma, mockLogger, 'AN')

    expect(mockLogger.info).toHaveBeenCalledWith(
      { rfccCode: 'AN' },
      'Generating reference number'
    )
  })

  test('Should log info on success with the generated reference number', async () => {
    await generateProjectReferenceNumber(mockPrisma, mockLogger, 'AN')

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        referenceNumber: 'ANC501E/000A/001A',
        rfccCode: 'AN',
        highCounter: 0,
        lowCounter: 1
      }),
      'Reference number generated successfully'
    )
  })

  test('Should log error and rethrow when counter operation fails', async () => {
    const dbError = new Error('Counter update failed')
    mockPrisma.$queryRaw.mockRejectedValue(dbError)

    await expect(
      generateProjectReferenceNumber(mockPrisma, mockLogger)
    ).rejects.toThrow('Counter update failed')

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ error: dbError.message }),
      'Error generating reference number'
    )
  })

  test('Should accept any RFCC code string as prefix', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      { high_counter: 0, low_counter: 3 }
    ])

    const result = await generateProjectReferenceNumber(
      mockPrisma,
      mockLogger,
      'NORTH'
    )

    expect(result).toBe('NORTHC501E/000A/003A')
  })
})
