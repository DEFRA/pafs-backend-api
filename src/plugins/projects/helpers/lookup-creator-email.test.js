import { describe, test, expect, vi, beforeEach } from 'vitest'
import { lookupCreatorEmail } from './lookup-creator-email.js'

const REFERENCE_NUMBER = 'AC/123/456'

const buildMockPrisma = (overrides = {}) => ({
  pafs_core_projects: {
    findFirst: vi.fn().mockResolvedValue({ creator_id: BigInt(42) }),
    ...overrides.pafs_core_projects
  },
  pafs_core_users: {
    findFirst: vi.fn().mockResolvedValue({ email: 'creator@example.com' }),
    ...overrides.pafs_core_users
  }
})

const buildMockLogger = () => ({ warn: vi.fn() })

describe('lookupCreatorEmail', () => {
  let prisma
  let logger

  beforeEach(() => {
    vi.clearAllMocks()
    prisma = buildMockPrisma()
    logger = buildMockLogger()
  })

  test('returns the creator email when project and user are found', async () => {
    const result = await lookupCreatorEmail(prisma, REFERENCE_NUMBER, logger)
    expect(result).toBe('creator@example.com')
  })

  test('queries pafs_core_projects by reference_number', async () => {
    await lookupCreatorEmail(prisma, REFERENCE_NUMBER, logger)
    expect(prisma.pafs_core_projects.findFirst).toHaveBeenCalledWith({
      where: { reference_number: REFERENCE_NUMBER },
      select: { creator_id: true }
    })
  })

  test('queries pafs_core_users with BigInt creator_id', async () => {
    await lookupCreatorEmail(prisma, REFERENCE_NUMBER, logger)
    expect(prisma.pafs_core_users.findFirst).toHaveBeenCalledWith({
      where: { id: BigInt(42) },
      select: { email: true }
    })
  })

  test('returns null when project row is not found', async () => {
    prisma.pafs_core_projects.findFirst.mockResolvedValue(null)
    const result = await lookupCreatorEmail(prisma, REFERENCE_NUMBER, logger)
    expect(result).toBeNull()
    expect(prisma.pafs_core_users.findFirst).not.toHaveBeenCalled()
  })

  test('returns null when project row has no creator_id', async () => {
    prisma.pafs_core_projects.findFirst.mockResolvedValue({ creator_id: null })
    const result = await lookupCreatorEmail(prisma, REFERENCE_NUMBER, logger)
    expect(result).toBeNull()
    expect(prisma.pafs_core_users.findFirst).not.toHaveBeenCalled()
  })

  test('returns null when user record is not found', async () => {
    prisma.pafs_core_users.findFirst.mockResolvedValue(null)
    const result = await lookupCreatorEmail(prisma, REFERENCE_NUMBER, logger)
    expect(result).toBeNull()
  })

  test('returns null and logs warning when project query throws', async () => {
    prisma.pafs_core_projects.findFirst.mockRejectedValue(
      new Error('DB connection lost')
    )
    const result = await lookupCreatorEmail(prisma, REFERENCE_NUMBER, logger)
    expect(result).toBeNull()
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ referenceNumber: REFERENCE_NUMBER }),
      'Could not look up creator email'
    )
  })

  test('returns null and logs warning when user query throws', async () => {
    prisma.pafs_core_users.findFirst.mockRejectedValue(new Error('Timeout'))
    const result = await lookupCreatorEmail(prisma, REFERENCE_NUMBER, logger)
    expect(result).toBeNull()
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Timeout' }),
      'Could not look up creator email'
    )
  })
})
