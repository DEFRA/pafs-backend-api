import { describe, test, expect, vi, beforeEach } from 'vitest'
import { checkPostgresHealth } from './postgres-health.js'

describe('checkPostgresHealth', () => {
  let mockRequest
  let mockWriterQueryRaw
  let mockReaderQueryRaw

  beforeEach(() => {
    mockWriterQueryRaw = vi.fn().mockResolvedValue([{ health: 1 }])
    mockReaderQueryRaw = vi.fn().mockResolvedValue([{ health: 1 }])

    mockRequest = {
      server: {
        prisma: {
          $primary: vi.fn().mockReturnValue({ $queryRaw: mockWriterQueryRaw }),
          $replica: vi.fn().mockReturnValue({ $queryRaw: mockReaderQueryRaw })
        },
        logger: {
          error: vi.fn()
        }
      }
    }
  })

  describe('both endpoints healthy', () => {
    test('returns connected and healthy when both succeed', async () => {
      const result = await checkPostgresHealth(mockRequest)

      expect(result.status).toBe('connected')
      expect(result.healthy).toBe(true)
    })

    test('writer result contains healthy flag and responseTime', async () => {
      const result = await checkPostgresHealth(mockRequest)

      expect(result.writer.healthy).toBe(true)
      expect(typeof result.writer.responseTime).toBe('number')
      expect(result.writer.responseTime).toBeGreaterThanOrEqual(0)
    })

    test('reader result contains healthy flag and responseTime', async () => {
      const result = await checkPostgresHealth(mockRequest)

      expect(result.reader.healthy).toBe(true)
      expect(typeof result.reader.responseTime).toBe('number')
      expect(result.reader.responseTime).toBeGreaterThanOrEqual(0)
    })

    test('pings writer via $primary()', async () => {
      await checkPostgresHealth(mockRequest)

      expect(mockRequest.server.prisma.$primary).toHaveBeenCalledTimes(1)
      expect(mockWriterQueryRaw).toHaveBeenCalledTimes(1)
    })

    test('pings reader via $replica()', async () => {
      await checkPostgresHealth(mockRequest)

      expect(mockRequest.server.prisma.$replica).toHaveBeenCalledTimes(1)
      expect(mockReaderQueryRaw).toHaveBeenCalledTimes(1)
    })

    test('does not log error when both endpoints succeed', async () => {
      await checkPostgresHealth(mockRequest)

      expect(mockRequest.server.logger.error).not.toHaveBeenCalled()
    })
  })

  describe('writer failure', () => {
    test('returns unhealthy when writer fails', async () => {
      mockWriterQueryRaw.mockRejectedValue(new Error('writer down'))

      const result = await checkPostgresHealth(mockRequest)

      expect(result.healthy).toBe(false)
      expect(result.status).toBe('error')
    })

    test('writer result reports the error', async () => {
      mockWriterQueryRaw.mockRejectedValue(new Error('ECONNREFUSED'))

      const result = await checkPostgresHealth(mockRequest)

      expect(result.writer.healthy).toBe(false)
      expect(result.writer.error).toBe('ECONNREFUSED')
    })

    test('reader result is still healthy when only writer fails', async () => {
      mockWriterQueryRaw.mockRejectedValue(new Error('writer down'))

      const result = await checkPostgresHealth(mockRequest)

      expect(result.reader.healthy).toBe(true)
    })

    test('logs error including writer failure details', async () => {
      mockWriterQueryRaw.mockRejectedValue(new Error('connection timeout'))

      await checkPostgresHealth(mockRequest)

      expect(mockRequest.server.logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          writer: expect.objectContaining({ healthy: false })
        }),
        'PostgreSQL health check failed'
      )
    })
  })

  describe('reader failure', () => {
    test('returns unhealthy when reader fails', async () => {
      mockReaderQueryRaw.mockRejectedValue(new Error('reader down'))

      const result = await checkPostgresHealth(mockRequest)

      expect(result.healthy).toBe(false)
      expect(result.status).toBe('error')
    })

    test('reader result reports the error', async () => {
      mockReaderQueryRaw.mockRejectedValue(new Error('replica lag timeout'))

      const result = await checkPostgresHealth(mockRequest)

      expect(result.reader.healthy).toBe(false)
      expect(result.reader.error).toBe('replica lag timeout')
    })

    test('writer result is still healthy when only reader fails', async () => {
      mockReaderQueryRaw.mockRejectedValue(new Error('reader down'))

      const result = await checkPostgresHealth(mockRequest)

      expect(result.writer.healthy).toBe(true)
    })

    test('logs error including reader failure details', async () => {
      mockReaderQueryRaw.mockRejectedValue(
        new Error('password authentication failed')
      )

      await checkPostgresHealth(mockRequest)

      expect(mockRequest.server.logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          reader: expect.objectContaining({ healthy: false })
        }),
        'PostgreSQL health check failed'
      )
    })
  })

  describe('both endpoints fail', () => {
    test('returns unhealthy when both fail', async () => {
      mockWriterQueryRaw.mockRejectedValue(new Error('writer down'))
      mockReaderQueryRaw.mockRejectedValue(new Error('reader down'))

      const result = await checkPostgresHealth(mockRequest)

      expect(result.healthy).toBe(false)
      expect(result.status).toBe('error')
      expect(result.writer.healthy).toBe(false)
      expect(result.reader.healthy).toBe(false)
    })

    test('logs error exactly once when both fail', async () => {
      mockWriterQueryRaw.mockRejectedValue(new Error('network down'))
      mockReaderQueryRaw.mockRejectedValue(new Error('network down'))

      await checkPostgresHealth(mockRequest)

      expect(mockRequest.server.logger.error).toHaveBeenCalledTimes(1)
    })

    test('captures distinct error messages from both endpoints', async () => {
      mockWriterQueryRaw.mockRejectedValue(new Error('writer ECONNREFUSED'))
      mockReaderQueryRaw.mockRejectedValue(new Error('reader ECONNREFUSED'))

      const result = await checkPostgresHealth(mockRequest)

      expect(result.writer.error).toBe('writer ECONNREFUSED')
      expect(result.reader.error).toBe('reader ECONNREFUSED')
    })
  })
})
