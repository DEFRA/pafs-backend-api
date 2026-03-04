import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  resolveLegacyBenefitAreaFile,
  isLegacyFileResolvable,
  buildLegacyS3Key
} from './legacy-file-resolver.js'
import { config } from '../../../config.js'

vi.mock('./benefit-area-file-helper.js', () => ({
  updateBenefitAreaFile: vi.fn().mockResolvedValue({})
}))

const { updateBenefitAreaFile } = await import('./benefit-area-file-helper.js')

describe('legacy-file-resolver', () => {
  let mockPrisma
  let mockLogger

  beforeEach(() => {
    mockPrisma = {}
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn()
    }
    vi.clearAllMocks()
  })

  describe('buildLegacyS3Key', () => {
    it('should build correct S3 key from slug, version and filename', () => {
      const result = buildLegacyS3Key('ACE1234-01-001A', 1, 'shapefile.zip')
      expect(result).toBe('legacy/ACE1234-01-001A/1/shapefile.zip')
    })

    it('should handle string version number', () => {
      const result = buildLegacyS3Key('XYZ9999-02-005B', '2', 'area.zip')
      expect(result).toBe('legacy/XYZ9999-02-005B/2/area.zip')
    })
  })

  describe('isLegacyFileResolvable', () => {
    it('should return true for legacy project with filename but no S3 data', () => {
      const project = {
        is_legacy: true,
        benefit_area_file_name: 'shapefile.zip',
        benefit_area_file_s3_bucket: null,
        benefit_area_file_s3_key: null
      }
      expect(isLegacyFileResolvable(project)).toBe(true)
    })

    it('should return false for non-legacy project', () => {
      const project = {
        is_legacy: false,
        benefit_area_file_name: 'shapefile.zip',
        benefit_area_file_s3_bucket: null,
        benefit_area_file_s3_key: null
      }
      expect(isLegacyFileResolvable(project)).toBe(false)
    })

    it('should return false when is_legacy is null', () => {
      const project = {
        is_legacy: null,
        benefit_area_file_name: 'shapefile.zip',
        benefit_area_file_s3_bucket: null,
        benefit_area_file_s3_key: null
      }
      expect(isLegacyFileResolvable(project)).toBe(false)
    })

    it('should return false when benefit_area_file_name is null', () => {
      const project = {
        is_legacy: true,
        benefit_area_file_name: null,
        benefit_area_file_s3_bucket: null,
        benefit_area_file_s3_key: null
      }
      expect(isLegacyFileResolvable(project)).toBe(false)
    })

    it('should return false when benefit_area_file_name is empty string', () => {
      const project = {
        is_legacy: true,
        benefit_area_file_name: '',
        benefit_area_file_s3_bucket: null,
        benefit_area_file_s3_key: null
      }
      expect(isLegacyFileResolvable(project)).toBe(false)
    })

    it('should return false when benefit_area_file_name is whitespace only', () => {
      const project = {
        is_legacy: true,
        benefit_area_file_name: '   ',
        benefit_area_file_s3_bucket: null,
        benefit_area_file_s3_key: null
      }
      expect(isLegacyFileResolvable(project)).toBe(false)
    })

    it('should return false when S3 data is already present', () => {
      const project = {
        is_legacy: true,
        benefit_area_file_name: 'shapefile.zip',
        benefit_area_file_s3_bucket: 'pafs-uploads',
        benefit_area_file_s3_key: 'legacy/slug/1/shapefile.zip'
      }
      expect(isLegacyFileResolvable(project)).toBe(false)
    })

    it('should return true when s3_bucket is empty string', () => {
      const project = {
        is_legacy: true,
        benefit_area_file_name: 'shapefile.zip',
        benefit_area_file_s3_bucket: '',
        benefit_area_file_s3_key: null
      }
      expect(isLegacyFileResolvable(project)).toBe(true)
    })

    it('should return true when s3_key is whitespace only', () => {
      const project = {
        is_legacy: true,
        benefit_area_file_name: 'shapefile.zip',
        benefit_area_file_s3_bucket: null,
        benefit_area_file_s3_key: '   '
      }
      expect(isLegacyFileResolvable(project)).toBe(true)
    })
  })

  describe('resolveLegacyBenefitAreaFile', () => {
    const legacyProject = {
      reference_number: 'ACE/1234/001A',
      slug: 'ACE1234-01-001A',
      version: 1,
      is_legacy: true,
      benefit_area_file_name: 'shapefile.zip',
      benefit_area_file_size: 1024,
      benefit_area_content_type: 'application/zip',
      benefit_area_file_s3_bucket: null,
      benefit_area_file_s3_key: null
    }

    it('should resolve S3 metadata for a legacy project', async () => {
      const result = await resolveLegacyBenefitAreaFile(
        legacyProject,
        mockPrisma,
        mockLogger
      )

      const expectedBucket = config.get('cdpUploader.s3Bucket')
      const expectedKey = 'legacy/ACE1234-01-001A/1/shapefile.zip'

      expect(result).toEqual({
        ...legacyProject,
        benefit_area_file_s3_bucket: expectedBucket,
        benefit_area_file_s3_key: expectedKey
      })
    })

    it('should persist resolved S3 metadata to database', async () => {
      await resolveLegacyBenefitAreaFile(legacyProject, mockPrisma, mockLogger)

      const expectedBucket = config.get('cdpUploader.s3Bucket')

      expect(updateBenefitAreaFile).toHaveBeenCalledWith(
        mockPrisma,
        'ACE/1234/001A',
        {
          filename: 'shapefile.zip',
          fileSize: 1024,
          contentType: 'application/zip',
          s3Bucket: expectedBucket,
          s3Key: 'legacy/ACE1234-01-001A/1/shapefile.zip',
          downloadUrl: null,
          downloadExpiry: null
        }
      )
    })

    it('should log the resolution', async () => {
      await resolveLegacyBenefitAreaFile(legacyProject, mockPrisma, mockLogger)

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          referenceNumber: 'ACE/1234/001A',
          s3Bucket: config.get('cdpUploader.s3Bucket'),
          s3Key: 'legacy/ACE1234-01-001A/1/shapefile.zip'
        }),
        'Resolving legacy benefit area file S3 location'
      )
    })

    it('should return null for non-legacy project', async () => {
      const nonLegacyProject = {
        ...legacyProject,
        is_legacy: false
      }

      const result = await resolveLegacyBenefitAreaFile(
        nonLegacyProject,
        mockPrisma,
        mockLogger
      )

      expect(result).toBeNull()
      expect(updateBenefitAreaFile).not.toHaveBeenCalled()
    })

    it('should return null when no benefit_area_file_name', async () => {
      const noFileProject = {
        ...legacyProject,
        benefit_area_file_name: null
      }

      const result = await resolveLegacyBenefitAreaFile(
        noFileProject,
        mockPrisma,
        mockLogger
      )

      expect(result).toBeNull()
      expect(updateBenefitAreaFile).not.toHaveBeenCalled()
    })

    it('should return null when S3 data already exists', async () => {
      const alreadyResolvedProject = {
        ...legacyProject,
        benefit_area_file_s3_bucket: 'pafs-uploads',
        benefit_area_file_s3_key: 'legacy/slug/1/file.zip'
      }

      const result = await resolveLegacyBenefitAreaFile(
        alreadyResolvedProject,
        mockPrisma,
        mockLogger
      )

      expect(result).toBeNull()
      expect(updateBenefitAreaFile).not.toHaveBeenCalled()
    })

    it('should handle null fileSize and contentType gracefully', async () => {
      const minimalProject = {
        ...legacyProject,
        benefit_area_file_size: null,
        benefit_area_content_type: null
      }

      const result = await resolveLegacyBenefitAreaFile(
        minimalProject,
        mockPrisma,
        mockLogger
      )

      expect(result).not.toBeNull()
      expect(updateBenefitAreaFile).toHaveBeenCalledWith(
        mockPrisma,
        'ACE/1234/001A',
        expect.objectContaining({
          fileSize: null,
          contentType: null
        })
      )
    })
  })
})
