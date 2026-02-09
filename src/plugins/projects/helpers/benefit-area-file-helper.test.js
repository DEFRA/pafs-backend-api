import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  generateDownloadUrl,
  updateBenefitAreaFile,
  clearBenefitAreaFile,
  deleteFromS3
} from './benefit-area-file-helper.js'

// Mock dependencies
vi.mock('../../../common/services/file-upload/s3-service.js', () => ({
  getS3Service: vi.fn()
}))

vi.mock('../../../common/constants/index.js', () => ({
  DOWNLOAD_URL_EXPIRES_IN: 604800
}))

describe('benefit-area-file-helper', () => {
  let mockPrisma
  let mockLogger
  let mockS3Service

  beforeEach(() => {
    mockPrisma = {
      pafs_core_projects: {
        findFirst: vi.fn(),
        update: vi.fn()
      }
    }

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    }

    mockS3Service = {
      getPresignedDownloadUrl: vi.fn(),
      deleteObject: vi.fn()
    }

    vi.clearAllMocks()
  })

  describe('generateDownloadUrl', () => {
    beforeEach(async () => {
      const { getS3Service } =
        await import('../../../common/services/file-upload/s3-service.js')
      getS3Service.mockReturnValue(mockS3Service)
    })

    it('should generate presigned URL with correct expiry', async () => {
      const mockUrl = 'https://s3.amazonaws.com/bucket/key?signature=abc123'
      mockS3Service.getPresignedDownloadUrl.mockResolvedValue(mockUrl)

      const result = await generateDownloadUrl(
        'test-bucket',
        'test-key',
        mockLogger
      )

      expect(result.downloadUrl).toBe(mockUrl)
      expect(result.downloadExpiry).toBeInstanceOf(Date)
      expect(mockS3Service.getPresignedDownloadUrl).toHaveBeenCalledWith(
        'test-bucket',
        'test-key',
        604800,
        null
      )
    })

    it('should calculate correct expiry timestamp', async () => {
      const mockUrl = 'https://s3.amazonaws.com/bucket/key'
      mockS3Service.getPresignedDownloadUrl.mockResolvedValue(mockUrl)

      const beforeTime = Date.now()
      const result = await generateDownloadUrl(
        'test-bucket',
        'test-key',
        mockLogger
      )
      const afterTime = Date.now()

      const expiryTime = result.downloadExpiry.getTime()
      const expectedMin = beforeTime + 604800 * 1000
      const expectedMax = afterTime + 604800 * 1000

      expect(expiryTime).toBeGreaterThanOrEqual(expectedMin)
      expect(expiryTime).toBeLessThanOrEqual(expectedMax)
    })

    it('should handle S3 service errors', async () => {
      const s3Error = new Error('S3 connection failed')
      mockS3Service.getPresignedDownloadUrl.mockRejectedValue(s3Error)

      await expect(
        generateDownloadUrl('test-bucket', 'test-key', mockLogger)
      ).rejects.toThrow('S3 connection failed')
    })
  })

  describe('updateBenefitAreaFile', () => {
    it('should update project with all file metadata', async () => {
      const referenceNumber = 'TEST/001/001'
      const fileMetadata = {
        filename: 'test-file.zip',
        fileSize: 1024,
        contentType: 'application/zip',
        s3Bucket: 'test-bucket',
        s3Key: 'test-key',
        downloadUrl: 'https://s3.amazonaws.com/test',
        downloadExpiry: new Date('2026-02-12T00:00:00Z')
      }

      mockPrisma.pafs_core_projects.update.mockResolvedValue({
        id: 1n,
        reference_number: referenceNumber
      })

      await updateBenefitAreaFile(mockPrisma, referenceNumber, fileMetadata)

      expect(mockPrisma.pafs_core_projects.update).toHaveBeenCalledWith({
        where: {
          reference_number_version: {
            reference_number: referenceNumber,
            version: 1
          }
        },
        data: expect.objectContaining({
          benefit_area_file_name: 'test-file.zip',
          benefit_area_file_size: 1024,
          benefit_area_content_type: 'application/zip',
          benefit_area_file_s3_bucket: 'test-bucket',
          benefit_area_file_s3_key: 'test-key',
          benefit_area_file_download_url: 'https://s3.amazonaws.com/test',
          benefit_area_file_download_expiry: fileMetadata.downloadExpiry,
          benefit_area_file_updated_at: expect.any(Date),
          updated_at: expect.any(Date)
        })
      })
    })

    it('should handle null file size', async () => {
      const fileMetadata = {
        filename: 'test.zip',
        fileSize: null,
        contentType: 'application/zip',
        s3Bucket: 'bucket',
        s3Key: 'key',
        downloadUrl: 'url',
        downloadExpiry: new Date()
      }

      mockPrisma.pafs_core_projects.update.mockResolvedValue({})

      await updateBenefitAreaFile(mockPrisma, 'TEST/001/001', fileMetadata)

      expect(mockPrisma.pafs_core_projects.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            benefit_area_file_size: null
          })
        })
      )
    })

    it('should handle database update errors', async () => {
      const dbError = new Error('Update failed')
      mockPrisma.pafs_core_projects.update.mockRejectedValue(dbError)

      await expect(
        updateBenefitAreaFile(mockPrisma, 'TEST/001/001', {
          filename: 'test.zip',
          fileSize: 1024,
          contentType: 'application/zip',
          s3Bucket: 'bucket',
          s3Key: 'key',
          downloadUrl: 'url',
          downloadExpiry: new Date()
        })
      ).rejects.toThrow('Update failed')
    })
  })

  describe('clearBenefitAreaFile', () => {
    it('should clear all benefit area file fields', async () => {
      const referenceNumber = 'TEST/001/001'

      mockPrisma.pafs_core_projects.update.mockResolvedValue({
        id: 1n,
        reference_number: referenceNumber
      })

      await clearBenefitAreaFile(mockPrisma, referenceNumber)

      expect(mockPrisma.pafs_core_projects.update).toHaveBeenCalledWith({
        where: {
          reference_number_version: {
            reference_number: referenceNumber,
            version: 1
          }
        },
        data: {
          benefit_area_file_name: null,
          benefit_area_file_size: null,
          benefit_area_content_type: null,
          benefit_area_file_s3_bucket: null,
          benefit_area_file_s3_key: null,
          benefit_area_file_download_url: null,
          benefit_area_file_download_expiry: null,
          benefit_area_file_updated_at: null,
          updated_at: expect.any(Date)
        }
      })
    })

    it('should handle database errors when clearing', async () => {
      const dbError = new Error('Clear failed')
      mockPrisma.pafs_core_projects.update.mockRejectedValue(dbError)

      await expect(
        clearBenefitAreaFile(mockPrisma, 'TEST/001/001')
      ).rejects.toThrow('Clear failed')
    })

    it('should update the updated_at timestamp', async () => {
      const beforeTime = Date.now()
      mockPrisma.pafs_core_projects.update.mockResolvedValue({})

      await clearBenefitAreaFile(mockPrisma, 'TEST/001/001')

      const updateCall = mockPrisma.pafs_core_projects.update.mock.calls[0][0]
      const updatedAt = updateCall.data.updated_at

      expect(updatedAt).toBeInstanceOf(Date)
      expect(updatedAt.getTime()).toBeGreaterThanOrEqual(beforeTime)
    })
  })

  describe('deleteFromS3', () => {
    beforeEach(async () => {
      const { getS3Service } =
        await import('../../../common/services/file-upload/s3-service.js')
      getS3Service.mockReturnValue(mockS3Service)
    })

    it('should delete file from S3', async () => {
      mockS3Service.deleteObject.mockResolvedValue(undefined)

      await deleteFromS3('test-bucket', 'test-key', mockLogger)

      expect(mockS3Service.deleteObject).toHaveBeenCalledWith(
        'test-bucket',
        'test-key'
      )
    })

    it('should handle S3 deletion errors', async () => {
      const s3Error = new Error('S3 delete failed')
      mockS3Service.deleteObject.mockRejectedValue(s3Error)

      await expect(
        deleteFromS3('test-bucket', 'test-key', mockLogger)
      ).rejects.toThrow('S3 delete failed')
    })

    it('should handle missing bucket parameter', async () => {
      mockS3Service.deleteObject.mockRejectedValue(
        new Error('Bucket is required')
      )

      await expect(deleteFromS3(null, 'test-key', mockLogger)).rejects.toThrow(
        'Bucket is required'
      )
    })

    it('should handle missing key parameter', async () => {
      mockS3Service.deleteObject.mockRejectedValue(new Error('Key is required'))

      await expect(
        deleteFromS3('test-bucket', null, mockLogger)
      ).rejects.toThrow('Key is required')
    })
  })
})
