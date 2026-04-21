import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  DOWNLOAD_STATUS,
  ADMIN_USER_ID,
  getUserDownloadRecord,
  getAdminDownloadRecord,
  getUserAreaIds,
  startUserDownload,
  startAdminDownload,
  updateDownloadRecord
} from './programme-records.js'

describe('programme-records', () => {
  let mockPrisma

  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma = {
      pafs_core_area_downloads: {
        findFirst: vi.fn(),
        deleteMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn()
      },
      pafs_core_user_areas: {
        findMany: vi.fn()
      }
    }
  })

  // ── Constants ────────────────────────────────────────────────────────────────

  describe('DOWNLOAD_STATUS', () => {
    it('has all four expected status values', () => {
      expect(DOWNLOAD_STATUS.EMPTY).toBe('empty')
      expect(DOWNLOAD_STATUS.GENERATING).toBe('generating')
      expect(DOWNLOAD_STATUS.READY).toBe('ready')
      expect(DOWNLOAD_STATUS.FAILED).toBe('failed')
    })
  })

  describe('ADMIN_USER_ID', () => {
    it('is null', () => {
      expect(ADMIN_USER_ID).toBeNull()
    })
  })

  // ── getUserDownloadRecord ─────────────────────────────────────────────────────

  describe('getUserDownloadRecord', () => {
    it('returns the most recent download record for a user', async () => {
      const mockRecord = { id: 1, user_id: 42, status: 'ready' }
      mockPrisma.pafs_core_area_downloads.findFirst.mockResolvedValue(
        mockRecord
      )

      const result = await getUserDownloadRecord(mockPrisma, 42)

      expect(result).toBe(mockRecord)
      expect(
        mockPrisma.pafs_core_area_downloads.findFirst
      ).toHaveBeenCalledWith({
        where: { user_id: 42, area_id: null },
        orderBy: { updated_at: 'desc' }
      })
    })

    it('returns null when no record exists for the user', async () => {
      mockPrisma.pafs_core_area_downloads.findFirst.mockResolvedValue(null)

      const result = await getUserDownloadRecord(mockPrisma, 99)

      expect(result).toBeNull()
    })

    it('queries by the correct user_id', async () => {
      mockPrisma.pafs_core_area_downloads.findFirst.mockResolvedValue(null)

      await getUserDownloadRecord(mockPrisma, 123)

      expect(
        mockPrisma.pafs_core_area_downloads.findFirst
      ).toHaveBeenCalledWith(
        expect.objectContaining({ where: { user_id: 123, area_id: null } })
      )
    })
  })

  // ── getAdminDownloadRecord ────────────────────────────────────────────────────

  describe('getAdminDownloadRecord', () => {
    it('returns the admin download record where user_id is null', async () => {
      const mockRecord = { id: 5, user_id: null, status: 'generating' }
      mockPrisma.pafs_core_area_downloads.findFirst.mockResolvedValue(
        mockRecord
      )

      const result = await getAdminDownloadRecord(mockPrisma)

      expect(result).toBe(mockRecord)
      expect(
        mockPrisma.pafs_core_area_downloads.findFirst
      ).toHaveBeenCalledWith({
        where: { user_id: null, area_id: null },
        orderBy: { updated_at: 'desc' }
      })
    })

    it('returns null when no admin record exists', async () => {
      mockPrisma.pafs_core_area_downloads.findFirst.mockResolvedValue(null)

      const result = await getAdminDownloadRecord(mockPrisma)

      expect(result).toBeNull()
    })
  })

  // ── getUserAreaIds ────────────────────────────────────────────────────────────

  describe('getUserAreaIds', () => {
    it('returns numeric area IDs for the user', async () => {
      mockPrisma.pafs_core_user_areas.findMany.mockResolvedValue([
        { area_id: BigInt(10) },
        { area_id: BigInt(20) }
      ])

      const result = await getUserAreaIds(mockPrisma, 42)

      expect(result).toEqual([10, 20])
    })

    it('queries using a BigInt userId', async () => {
      mockPrisma.pafs_core_user_areas.findMany.mockResolvedValue([])

      await getUserAreaIds(mockPrisma, 42)

      expect(mockPrisma.pafs_core_user_areas.findMany).toHaveBeenCalledWith({
        where: { user_id: BigInt(42) },
        select: { area_id: true }
      })
    })

    it('converts a string userId to BigInt', async () => {
      mockPrisma.pafs_core_user_areas.findMany.mockResolvedValue([])

      await getUserAreaIds(mockPrisma, '123')

      expect(mockPrisma.pafs_core_user_areas.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { user_id: BigInt(123) } })
      )
    })

    it('returns an empty array when the user has no areas', async () => {
      mockPrisma.pafs_core_user_areas.findMany.mockResolvedValue([])

      const result = await getUserAreaIds(mockPrisma, 42)

      expect(result).toEqual([])
    })

    it('converts BigInt area_ids to plain numbers', async () => {
      mockPrisma.pafs_core_user_areas.findMany.mockResolvedValue([
        { area_id: BigInt(999999999) }
      ])

      const result = await getUserAreaIds(mockPrisma, 1)

      expect(result[0]).toBe(999999999)
      expect(typeof result[0]).toBe('number')
    })
  })

  // ── startUserDownload ─────────────────────────────────────────────────────────

  describe('startUserDownload', () => {
    it('deletes previous records then creates a generating record', async () => {
      const mockRecord = { id: 1, status: 'generating' }
      mockPrisma.pafs_core_area_downloads.deleteMany.mockResolvedValue({
        count: 0
      })
      mockPrisma.pafs_core_area_downloads.create.mockResolvedValue(mockRecord)

      const result = await startUserDownload(mockPrisma, 42, 10)

      expect(result).toBe(mockRecord)
      expect(
        mockPrisma.pafs_core_area_downloads.deleteMany
      ).toHaveBeenCalledWith({
        where: { user_id: 42, area_id: null }
      })
      expect(mockPrisma.pafs_core_area_downloads.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            user_id: 42,
            area_id: null,
            status: DOWNLOAD_STATUS.GENERATING,
            number_of_proposals: 10,
            progress_current: 0,
            progress_total: 10,
            progress_message: 'Starting generation...'
          })
        })
      )
    })

    it('sets requested_on, created_at and updated_at to the same Date instance', async () => {
      mockPrisma.pafs_core_area_downloads.deleteMany.mockResolvedValue({})
      mockPrisma.pafs_core_area_downloads.create.mockResolvedValue({})

      await startUserDownload(mockPrisma, 42, 5)

      const { data } =
        mockPrisma.pafs_core_area_downloads.create.mock.calls[0][0]
      expect(data.requested_on).toBeInstanceOf(Date)
      expect(data.created_at).toBeInstanceOf(Date)
      expect(data.updated_at).toBeInstanceOf(Date)
      expect(data.requested_on.getTime()).toBe(data.created_at.getTime())
      expect(data.created_at.getTime()).toBe(data.updated_at.getTime())
    })

    it('initialises progress_current to 0 regardless of proposalCount', async () => {
      mockPrisma.pafs_core_area_downloads.deleteMany.mockResolvedValue({})
      mockPrisma.pafs_core_area_downloads.create.mockResolvedValue({})

      await startUserDownload(mockPrisma, 7, 250)

      const { data } =
        mockPrisma.pafs_core_area_downloads.create.mock.calls[0][0]
      expect(data.progress_current).toBe(0)
      expect(data.progress_total).toBe(250)
    })
  })

  // ── startAdminDownload ────────────────────────────────────────────────────────

  describe('startAdminDownload', () => {
    it('creates an admin generating record with null user_id', async () => {
      const mockRecord = { id: 99, user_id: null, status: 'generating' }
      mockPrisma.pafs_core_area_downloads.deleteMany.mockResolvedValue({})
      mockPrisma.pafs_core_area_downloads.create.mockResolvedValue(mockRecord)

      const result = await startAdminDownload(mockPrisma, 7, 100)

      expect(result).toBe(mockRecord)
      expect(mockPrisma.pafs_core_area_downloads.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            user_id: null,
            area_id: null,
            status: DOWNLOAD_STATUS.GENERATING,
            number_of_proposals: 100,
            number_of_proposals_with_moderation: 7,
            progress_current: 0,
            progress_total: 100,
            progress_message: 'Starting generation...'
          })
        })
      )
    })

    it('deletes previous admin record (user_id IS NULL) before creating', async () => {
      mockPrisma.pafs_core_area_downloads.deleteMany.mockResolvedValue({
        count: 1
      })
      mockPrisma.pafs_core_area_downloads.create.mockResolvedValue({})

      await startAdminDownload(mockPrisma, 5, 50)

      expect(
        mockPrisma.pafs_core_area_downloads.deleteMany
      ).toHaveBeenCalledWith({
        where: { user_id: null, area_id: null }
      })
      expect(
        mockPrisma.pafs_core_area_downloads.deleteMany
      ).toHaveBeenCalledTimes(1)
    })

    it('stores the requesting user ID in number_of_proposals_with_moderation', async () => {
      mockPrisma.pafs_core_area_downloads.deleteMany.mockResolvedValue({})
      mockPrisma.pafs_core_area_downloads.create.mockResolvedValue({})

      await startAdminDownload(mockPrisma, 42, 10)

      const { data } =
        mockPrisma.pafs_core_area_downloads.create.mock.calls[0][0]
      expect(data.number_of_proposals_with_moderation).toBe(42)
    })
  })

  // ── updateDownloadRecord ──────────────────────────────────────────────────────

  describe('updateDownloadRecord', () => {
    it('updates the record by id and sets updated_at', async () => {
      const mockRecord = { id: 1, status: 'ready' }
      mockPrisma.pafs_core_area_downloads.update.mockResolvedValue(mockRecord)

      const result = await updateDownloadRecord(mockPrisma, 1, {
        status: 'ready',
        s3_key: 'file.xlsx'
      })

      expect(result).toBe(mockRecord)
      expect(mockPrisma.pafs_core_area_downloads.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: expect.objectContaining({
            status: 'ready',
            s3_key: 'file.xlsx',
            updated_at: expect.any(Date)
          })
        })
      )
    })

    it('merges arbitrary update fields with the updated_at timestamp', async () => {
      mockPrisma.pafs_core_area_downloads.update.mockResolvedValue({})

      await updateDownloadRecord(mockPrisma, 5, {
        progress_current: 50,
        progress_total: 100,
        progress_message: 'Halfway there'
      })

      const { data } =
        mockPrisma.pafs_core_area_downloads.update.mock.calls[0][0]
      expect(data.progress_current).toBe(50)
      expect(data.progress_message).toBe('Halfway there')
      expect(data.updated_at).toBeInstanceOf(Date)
    })

    it('always writes a fresh updated_at Date on every call', async () => {
      mockPrisma.pafs_core_area_downloads.update.mockResolvedValue({})

      await updateDownloadRecord(mockPrisma, 1, { status: 'failed' })
      await updateDownloadRecord(mockPrisma, 1, { status: 'ready' })

      const firstCall =
        mockPrisma.pafs_core_area_downloads.update.mock.calls[0][0]
      const secondCall =
        mockPrisma.pafs_core_area_downloads.update.mock.calls[1][0]
      expect(firstCall.data.updated_at).toBeInstanceOf(Date)
      expect(secondCall.data.updated_at).toBeInstanceOf(Date)
    })
  })
})
