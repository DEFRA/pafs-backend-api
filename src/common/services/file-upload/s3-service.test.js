import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock AWS SDK
vi.mock('@aws-sdk/client-s3', () => {
  return {
    S3Client: vi.fn(function (config) {
      this.config = config
      this.send = vi.fn()
      return this
    }),
    GetObjectCommand: vi.fn(function (params) {
      this.input = params
      return this
    }),
    DeleteObjectCommand: vi.fn(function (params) {
      this.input = params
      return this
    })
  }
})

const mockGetSignedUrl = vi.fn()
vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: mockGetSignedUrl
}))

// Mock config module - use factory function to avoid hoisting issues
vi.mock('../../../config.js', () => ({
  config: {
    get: vi.fn()
  }
}))

// Import after mocks are set up
const { S3Service, getS3Service, resetS3Service } =
  await import('./s3-service.js')
const { config } = await import('../../../config.js')

describe('S3Service', () => {
  let mockLogger

  beforeEach(() => {
    resetS3Service()
    vi.clearAllMocks()

    // Reset config mock to default values
    vi.mocked(config.get).mockImplementation((key) => {
      const configValues = {
        awsRegion: 'eu-west-2',
        'cdpUploader.s3Endpoint': 'http://localhost:4566'
      }
      return configValues[key]
    })

    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn()
    }
  })

  describe('constructor', () => {
    it('should initialize with localstack configuration', () => {
      const service = new S3Service(mockLogger)

      expect(service.region).toBe('eu-west-2')
      expect(service.endpoint).toBe('http://localhost:4566')
      expect(service.s3Client).toBeDefined()

      expect(mockLogger.info).toHaveBeenCalledWith(
        {
          region: 'eu-west-2',
          endpoint: 'http://localhost:4566'
        },
        'S3 Service initialized'
      )
    })

    it('should initialize with AWS configuration when not using localstack', () => {
      vi.mocked(config.get).mockImplementation((key) => {
        const configValues = {
          awsRegion: 'eu-west-1',
          'cdpUploader.s3Endpoint': undefined
        }
        return configValues[key]
      })

      const service = new S3Service(mockLogger)

      expect(service.region).toBe('eu-west-1')
      expect(service.endpoint).toBeUndefined()

      expect(mockLogger.info).toHaveBeenCalledWith(
        {
          region: 'eu-west-1',
          endpoint: undefined
        },
        'S3 Service initialized'
      )
    })
  })

  describe('getPresignedDownloadUrl', () => {
    it('should generate presigned URL with default expiration', async () => {
      const service = new S3Service(mockLogger)
      const mockUrl = 'https://s3.example.com/presigned-url'

      mockGetSignedUrl.mockResolvedValue(mockUrl)

      const url = await service.getPresignedDownloadUrl(
        'test-bucket',
        'test-key'
      )

      expect(url).toBe(mockUrl)
      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        service.s3Client,
        expect.objectContaining({
          input: {
            Bucket: 'test-bucket',
            Key: 'test-key'
          }
        }),
        { expiresIn: 900 }
      )

      expect(mockLogger.info).toHaveBeenCalledWith(
        {
          bucket: 'test-bucket',
          key: 'test-key',
          expiresIn: 900
        },
        'Generated presigned download URL'
      )
    })

    it('should generate presigned URL with custom expiration', async () => {
      const service = new S3Service(mockLogger)
      const mockUrl = 'https://s3.example.com/presigned-url'

      mockGetSignedUrl.mockResolvedValue(mockUrl)

      const url = await service.getPresignedDownloadUrl(
        'test-bucket',
        'test-key',
        3600
      )

      expect(url).toBe(mockUrl)
      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        service.s3Client,
        expect.anything(),
        { expiresIn: 3600 }
      )

      expect(mockLogger.info).toHaveBeenCalledWith(
        {
          bucket: 'test-bucket',
          key: 'test-key',
          expiresIn: 3600
        },
        'Generated presigned download URL'
      )
    })

    it('should handle errors when generating presigned URL', async () => {
      const service = new S3Service(mockLogger)
      const error = new Error('S3 error')

      mockGetSignedUrl.mockRejectedValue(error)

      await expect(
        service.getPresignedDownloadUrl('test-bucket', 'test-key')
      ).rejects.toThrow('S3 error')

      expect(mockLogger.error).toHaveBeenCalledWith(
        {
          err: error,
          bucket: 'test-bucket',
          key: 'test-key'
        },
        'Failed to generate presigned download URL'
      )
    })

    it('should handle network timeout errors', async () => {
      const service = new S3Service(mockLogger)
      const error = new Error('Network timeout')
      error.name = 'TimeoutError'

      mockGetSignedUrl.mockRejectedValue(error)

      await expect(
        service.getPresignedDownloadUrl('test-bucket', 'test-key')
      ).rejects.toThrow('Network timeout')

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          bucket: 'test-bucket',
          key: 'test-key'
        }),
        'Failed to generate presigned download URL'
      )
    })

    it('should handle S3 access denied errors', async () => {
      const service = new S3Service(mockLogger)
      const error = new Error('Access Denied')
      error.name = 'AccessDenied'

      mockGetSignedUrl.mockRejectedValue(error)

      await expect(
        service.getPresignedDownloadUrl('test-bucket', 'test-key')
      ).rejects.toThrow('Access Denied')

      expect(mockLogger.error).toHaveBeenCalled()
    })
  })

  describe('getServiceStatus', () => {
    it('should return service configuration for localstack', () => {
      const service = new S3Service(mockLogger)
      const status = service.getServiceStatus()

      expect(status).toEqual({
        region: 'eu-west-2',
        endpoint: 'http://localhost:4566'
      })
    })

    it('should return service configuration for AWS', () => {
      vi.mocked(config.get).mockImplementation((key) => {
        const configValues = {
          awsRegion: 'us-east-1',
          'cdpUploader.s3Endpoint': undefined
        }
        return configValues[key]
      })

      const service = new S3Service(mockLogger)
      const status = service.getServiceStatus()

      expect(status).toEqual({
        region: 'us-east-1',
        endpoint: undefined
      })
    })
  })

  describe('singleton pattern', () => {
    it('should return the same instance on subsequent calls', () => {
      const instance1 = getS3Service(mockLogger)
      const instance2 = getS3Service(mockLogger)

      expect(instance1).toBe(instance2)
    })

    it('should create new instance after reset', () => {
      const instance1 = getS3Service(mockLogger)
      resetS3Service()
      const instance2 = getS3Service(mockLogger)

      expect(instance1).not.toBe(instance2)
    })

    it('should use different logger when reset', () => {
      const logger1 = { ...mockLogger, name: 'logger1' }
      const logger2 = { ...mockLogger, name: 'logger2' }

      const instance1 = getS3Service(logger1)
      expect(instance1.logger).toBe(logger1)

      resetS3Service()

      const instance2 = getS3Service(logger2)
      expect(instance2.logger).toBe(logger2)
      expect(instance1).not.toBe(instance2)
    })
  })

  describe('deleteObject', () => {
    it('should successfully delete an object from S3', async () => {
      const service = new S3Service(mockLogger)
      const bucket = 'test-bucket'
      const key = 'test-folder/test-file.pdf'

      // Mock successful deletion
      service.s3Client.send.mockResolvedValue({})

      await service.deleteObject(bucket, key)

      // Verify DeleteObjectCommand was called with correct params
      const { DeleteObjectCommand } = await import('@aws-sdk/client-s3')
      expect(DeleteObjectCommand).toHaveBeenCalledWith({
        Bucket: bucket,
        Key: key
      })

      // Verify S3 client send was called
      expect(service.s3Client.send).toHaveBeenCalledTimes(1)

      // Verify success logging
      expect(mockLogger.info).toHaveBeenCalledWith(
        { bucket, key },
        'Successfully deleted S3 object'
      )
    })

    it('should handle S3 deletion errors', async () => {
      const service = new S3Service(mockLogger)
      const bucket = 'test-bucket'
      const key = 'test-folder/test-file.pdf'
      const error = new Error('S3 access denied')

      // Mock S3 error
      service.s3Client.send.mockRejectedValue(error)

      await expect(service.deleteObject(bucket, key)).rejects.toThrow(
        'S3 access denied'
      )

      // Verify error logging
      expect(mockLogger.error).toHaveBeenCalledWith(
        {
          err: error,
          bucket,
          key
        },
        'Failed to delete S3 object'
      )
    })

    it('should handle missing bucket error', async () => {
      const service = new S3Service(mockLogger)
      const bucket = 'non-existent-bucket'
      const key = 'test-file.pdf'
      const error = new Error('The specified bucket does not exist')

      service.s3Client.send.mockRejectedValue(error)

      await expect(service.deleteObject(bucket, key)).rejects.toThrow(
        'The specified bucket does not exist'
      )

      expect(mockLogger.error).toHaveBeenCalled()
    })

    it('should handle network errors during deletion', async () => {
      const service = new S3Service(mockLogger)
      const bucket = 'test-bucket'
      const key = 'test-file.pdf'
      const error = new Error('Network timeout')

      service.s3Client.send.mockRejectedValue(error)

      await expect(service.deleteObject(bucket, key)).rejects.toThrow(
        'Network timeout'
      )

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          err: error,
          bucket,
          key
        }),
        'Failed to delete S3 object'
      )
    })

    it('should delete object with special characters in key', async () => {
      const service = new S3Service(mockLogger)
      const bucket = 'test-bucket'
      const key = 'folder/file with spaces & special!@#.pdf'

      service.s3Client.send.mockResolvedValue({})

      await service.deleteObject(bucket, key)

      const { DeleteObjectCommand } = await import('@aws-sdk/client-s3')
      expect(DeleteObjectCommand).toHaveBeenCalledWith({
        Bucket: bucket,
        Key: key
      })

      expect(mockLogger.info).toHaveBeenCalled()
    })

    it('should delete object from nested path', async () => {
      const service = new S3Service(mockLogger)
      const bucket = 'test-bucket'
      const key = 'uploads/2024/01/15/user-123/document.pdf'

      service.s3Client.send.mockResolvedValue({})

      await service.deleteObject(bucket, key)

      const { DeleteObjectCommand } = await import('@aws-sdk/client-s3')
      expect(DeleteObjectCommand).toHaveBeenCalledWith({
        Bucket: bucket,
        Key: key
      })

      expect(service.s3Client.send).toHaveBeenCalledTimes(1)
    })
  })
})
