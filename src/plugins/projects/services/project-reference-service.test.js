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
// incrementReferenceCounter — requires Prisma $transaction mock
// ---------------------------------------------------------------------------

describe('incrementReferenceCounter', () => {
  let mockPrisma
  let mockTx

  beforeEach(() => {
    vi.clearAllMocks()

    mockTx = {
      pafs_core_reference_counters: {
        findUnique: vi.fn(),
        upsert: vi.fn()
      }
    }

    mockPrisma = {
      $transaction: vi.fn(async (callback) => callback(mockTx))
    }
  })

  test('Should create new counter record when none exists (first use)', async () => {
    mockTx.pafs_core_reference_counters.findUnique.mockResolvedValue(null)
    mockTx.pafs_core_reference_counters.upsert.mockResolvedValue({
      rfcc_code: 'AN',
      high_counter: 0,
      low_counter: 1
    })

    const result = await incrementReferenceCounter(mockPrisma, 'AN')

    expect(result).toEqual({ rfcc_code: 'AN', high_counter: 0, low_counter: 1 })
    expect(mockTx.pafs_core_reference_counters.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { rfcc_code: 'AN' },
        create: expect.objectContaining({
          rfcc_code: 'AN',
          high_counter: 0,
          low_counter: 1
        })
      })
    )
  })

  test('Should increment low_counter when it is below 999', async () => {
    mockTx.pafs_core_reference_counters.findUnique.mockResolvedValue({
      rfcc_code: 'AN',
      high_counter: 0,
      low_counter: 5
    })
    mockTx.pafs_core_reference_counters.upsert.mockResolvedValue({
      rfcc_code: 'AN',
      high_counter: 0,
      low_counter: 6
    })

    const result = await incrementReferenceCounter(mockPrisma, 'AN')

    expect(result.low_counter).toBe(6)
    expect(mockTx.pafs_core_reference_counters.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          low_counter: { increment: 1 }
        })
      })
    )
  })

  test('Should roll over low_counter to 1 and increment high_counter at 999', async () => {
    mockTx.pafs_core_reference_counters.findUnique.mockResolvedValue({
      rfcc_code: 'AN',
      high_counter: 5,
      low_counter: 999
    })
    mockTx.pafs_core_reference_counters.upsert.mockResolvedValue({
      rfcc_code: 'AN',
      high_counter: 6,
      low_counter: 1
    })

    const result = await incrementReferenceCounter(mockPrisma, 'AN')

    expect(result).toEqual({ rfcc_code: 'AN', high_counter: 6, low_counter: 1 })
    expect(mockTx.pafs_core_reference_counters.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          high_counter: { increment: 1 },
          low_counter: 1
        })
      })
    )
  })

  test('Should use the rfccCode as the where clause key', async () => {
    mockTx.pafs_core_reference_counters.findUnique.mockResolvedValue(null)
    mockTx.pafs_core_reference_counters.upsert.mockResolvedValue({
      rfcc_code: 'AE',
      high_counter: 0,
      low_counter: 1
    })

    await incrementReferenceCounter(mockPrisma, 'AE')

    expect(mockTx.pafs_core_reference_counters.findUnique).toHaveBeenCalledWith(
      {
        where: { rfcc_code: 'AE' },
        select: { low_counter: true, high_counter: true }
      }
    )
  })

  test('Should look up counter within a transaction', async () => {
    mockTx.pafs_core_reference_counters.findUnique.mockResolvedValue(null)
    mockTx.pafs_core_reference_counters.upsert.mockResolvedValue({
      rfcc_code: 'AN',
      high_counter: 0,
      low_counter: 1
    })

    await incrementReferenceCounter(mockPrisma, 'AN')

    expect(mockPrisma.$transaction).toHaveBeenCalledOnce()
  })

  test('Should set updated_at on upsert', async () => {
    mockTx.pafs_core_reference_counters.findUnique.mockResolvedValue(null)
    mockTx.pafs_core_reference_counters.upsert.mockResolvedValue({
      rfcc_code: 'AN',
      high_counter: 0,
      low_counter: 1
    })

    await incrementReferenceCounter(mockPrisma, 'AN')

    const upsertCall =
      mockTx.pafs_core_reference_counters.upsert.mock.calls[0][0]
    expect(upsertCall.update.updated_at).toBeInstanceOf(Date)
    expect(upsertCall.create.updated_at).toBeInstanceOf(Date)
  })

  test('Should propagate errors thrown inside the transaction', async () => {
    const dbError = new Error('Counter update failed')
    mockPrisma.$transaction.mockRejectedValue(dbError)

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
  let mockTx

  beforeEach(() => {
    vi.clearAllMocks()

    mockLogger = {
      info: vi.fn(),
      error: vi.fn()
    }

    mockTx = {
      pafs_core_reference_counters: {
        findUnique: vi.fn().mockResolvedValue(null),
        upsert: vi.fn()
      }
    }

    mockPrisma = {
      $transaction: vi.fn(async (callback) => callback(mockTx))
    }
  })

  test('Should generate reference number with default RFCC code AN', async () => {
    mockTx.pafs_core_reference_counters.upsert.mockResolvedValue({
      rfcc_code: 'AN',
      high_counter: 0,
      low_counter: 1
    })

    const result = await generateProjectReferenceNumber(mockPrisma, mockLogger)

    expect(result).toBe('ANC501E/000A/001A')
  })

  test('Should use provided RFCC code as prefix', async () => {
    mockTx.pafs_core_reference_counters.upsert.mockResolvedValue({
      rfcc_code: 'AE',
      high_counter: 0,
      low_counter: 1
    })

    const result = await generateProjectReferenceNumber(
      mockPrisma,
      mockLogger,
      'AE'
    )

    expect(result).toBe('AEC501E/000A/001A')
  })

  test('Should build reference number from counter results', async () => {
    mockTx.pafs_core_reference_counters.upsert.mockResolvedValue({
      rfcc_code: 'AN',
      high_counter: 12,
      low_counter: 100
    })

    const result = await generateProjectReferenceNumber(mockPrisma, mockLogger)

    expect(result).toBe('ANC501E/012A/100A')
  })

  test('Should build reference number after rollover (high incremented, low reset to 1)', async () => {
    mockTx.pafs_core_reference_counters.findUnique.mockResolvedValue({
      rfcc_code: 'AN',
      high_counter: 5,
      low_counter: 999
    })
    mockTx.pafs_core_reference_counters.upsert.mockResolvedValue({
      rfcc_code: 'AN',
      high_counter: 6,
      low_counter: 1
    })

    const result = await generateProjectReferenceNumber(mockPrisma, mockLogger)

    expect(result).toBe('ANC501E/006A/001A')
  })

  test('Should log info at the start with rfccCode', async () => {
    mockTx.pafs_core_reference_counters.upsert.mockResolvedValue({
      rfcc_code: 'AN',
      high_counter: 0,
      low_counter: 1
    })

    await generateProjectReferenceNumber(mockPrisma, mockLogger, 'AN')

    expect(mockLogger.info).toHaveBeenCalledWith(
      { rfccCode: 'AN' },
      'Generating reference number'
    )
  })

  test('Should log info on success with the generated reference number', async () => {
    mockTx.pafs_core_reference_counters.upsert.mockResolvedValue({
      rfcc_code: 'AN',
      high_counter: 0,
      low_counter: 1
    })

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

  test('Should log error and rethrow when counter transaction fails', async () => {
    const dbError = new Error('Counter update failed')
    mockPrisma.$transaction.mockRejectedValue(dbError)

    await expect(
      generateProjectReferenceNumber(mockPrisma, mockLogger)
    ).rejects.toThrow('Counter update failed')

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ error: dbError.message }),
      'Error generating reference number'
    )
  })

  test('Should accept any RFCC code string as prefix', async () => {
    mockTx.pafs_core_reference_counters.upsert.mockResolvedValue({
      rfcc_code: 'NORTH',
      high_counter: 0,
      low_counter: 3
    })

    const result = await generateProjectReferenceNumber(
      mockPrisma,
      mockLogger,
      'NORTH'
    )

    expect(result).toBe('NORTHC501E/000A/003A')
  })
})
