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
    }),
    PutObjectCommand: vi.fn(function (params) {
      this.input = params
      return this
    }),
    CopyObjectCommand: vi.fn(function (params) {
      this.input = params
      return this
    })
  }
})

const mockGetSignedUrl = vi.fn()
vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: mockGetSignedUrl
}))

const mockUploadDone = vi.fn()
vi.mock('@aws-sdk/lib-storage', () => ({
  // Must be a regular function (not arrow) — production code calls it with `new`.
  Upload: vi.fn(function UploadMock() {
    this.done = mockUploadDone
  })
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

    it('should set responseChecksumValidation to WHEN_REQUIRED on the S3 client', () => {
      const service = new S3Service(mockLogger)

      expect(service.s3Client.config).toMatchObject({
        responseChecksumValidation: 'WHEN_REQUIRED'
      })
    })

    it('should set forcePathStyle to true when an endpoint is configured', () => {
      const service = new S3Service(mockLogger)

      expect(service.s3Client.config.forcePathStyle).toBe(true)
    })

    it('should set forcePathStyle to false when no endpoint is configured', () => {
      vi.mocked(config.get).mockImplementation((key) => {
        const configValues = {
          awsRegion: 'eu-west-2',
          'cdpUploader.s3Endpoint': undefined
        }
        return configValues[key]
      })

      const service = new S3Service(mockLogger)

      expect(service.s3Client.config.forcePathStyle).toBe(false)
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

    it('should generate presigned URL with Content-Disposition header when filename provided', async () => {
      const service = new S3Service(mockLogger)
      const mockUrl = 'https://s3.example.com/presigned-url'
      const filename = 'my-document.zip'

      mockGetSignedUrl.mockResolvedValue(mockUrl)

      const url = await service.getPresignedDownloadUrl(
        'test-bucket',
        'test-key',
        900,
        filename
      )

      expect(url).toBe(mockUrl)
      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        service.s3Client,
        expect.objectContaining({
          input: {
            Bucket: 'test-bucket',
            Key: 'test-key',
            ResponseContentDisposition: `attachment; filename="${filename}"; filename*=UTF-8''my-document.zip`
          }
        }),
        { expiresIn: 900 }
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

  describe('getObject', () => {
    it('should successfully retrieve an object from S3', async () => {
      const service = new S3Service(mockLogger)
      const bucket = 'test-bucket'
      const key = 'test-folder/test-file.pdf'
      const mockBuffer = Buffer.from('test file content')

      // Mock S3 response with readable stream
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield mockBuffer
        }
      }

      service.s3Client.send.mockResolvedValue({
        Body: mockStream
      })

      const result = await service.getObject(bucket, key)

      // Verify GetObjectCommand was called with correct params
      const { GetObjectCommand } = await import('@aws-sdk/client-s3')
      expect(GetObjectCommand).toHaveBeenCalledWith({
        Bucket: bucket,
        Key: key
      })

      // Verify S3 client send was called
      expect(service.s3Client.send).toHaveBeenCalledTimes(1)

      // Verify result is a Buffer with correct content
      expect(Buffer.isBuffer(result)).toBe(true)
      expect(result.toString()).toBe('test file content')

      // Verify success logging
      expect(mockLogger.info).toHaveBeenCalledWith(
        {
          bucket,
          key,
          size: mockBuffer.length
        },
        'Successfully retrieved S3 object'
      )
    })

    it('should handle multiple chunks from S3 stream', async () => {
      const service = new S3Service(mockLogger)
      const bucket = 'test-bucket'
      const key = 'large-file.pdf'

      const chunk1 = Buffer.from('chunk1')
      const chunk2 = Buffer.from('chunk2')
      const chunk3 = Buffer.from('chunk3')

      // Mock S3 response with multiple chunks
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield chunk1
          yield chunk2
          yield chunk3
        }
      }

      service.s3Client.send.mockResolvedValue({
        Body: mockStream
      })

      const result = await service.getObject(bucket, key)

      expect(Buffer.isBuffer(result)).toBe(true)
      expect(result.toString()).toBe('chunk1chunk2chunk3')
      expect(result.length).toBe(chunk1.length + chunk2.length + chunk3.length)
    })

    it('should handle S3 retrieval errors', async () => {
      const service = new S3Service(mockLogger)
      const bucket = 'test-bucket'
      const key = 'non-existent-file.pdf'
      const error = new Error('NoSuchKey: The specified key does not exist')

      service.s3Client.send.mockRejectedValue(error)

      await expect(service.getObject(bucket, key)).rejects.toThrow(
        'NoSuchKey: The specified key does not exist'
      )

      expect(mockLogger.error).toHaveBeenCalledWith(
        {
          err: error,
          bucket,
          key
        },
        'Failed to retrieve S3 object'
      )
    })

    it('should handle access denied errors', async () => {
      const service = new S3Service(mockLogger)
      const bucket = 'private-bucket'
      const key = 'secure-file.pdf'
      const error = new Error('Access Denied')
      error.name = 'AccessDenied'

      service.s3Client.send.mockRejectedValue(error)

      await expect(service.getObject(bucket, key)).rejects.toThrow(
        'Access Denied'
      )

      expect(mockLogger.error).toHaveBeenCalled()
    })

    it('should handle empty file', async () => {
      const service = new S3Service(mockLogger)
      const bucket = 'test-bucket'
      const key = 'empty-file.txt'

      const mockStream = {
        async *[Symbol.asyncIterator]() {
          // No chunks yielded
        }
      }

      service.s3Client.send.mockResolvedValue({
        Body: mockStream
      })

      const result = await service.getObject(bucket, key)

      expect(Buffer.isBuffer(result)).toBe(true)
      expect(result.length).toBe(0)
    })

    it('should handle network timeout during retrieval', async () => {
      const service = new S3Service(mockLogger)
      const bucket = 'test-bucket'
      const key = 'file.pdf'
      const error = new Error('Request timeout')
      error.name = 'TimeoutError'

      service.s3Client.send.mockRejectedValue(error)

      await expect(service.getObject(bucket, key)).rejects.toThrow(
        'Request timeout'
      )

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          err: error,
          bucket,
          key
        }),
        'Failed to retrieve S3 object'
      )
    })
  })

  describe('putObject', () => {
    it('should upload a buffer to S3 successfully', async () => {
      const service = new S3Service(mockLogger)
      const bucket = 'test-bucket'
      const key = 'uploads/report.xlsx'
      const body = Buffer.from('file contents')
      const contentType =
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

      service.s3Client.send.mockResolvedValue({})

      await service.putObject(bucket, key, body, contentType)

      const { PutObjectCommand } = await import('@aws-sdk/client-s3')
      expect(PutObjectCommand).toHaveBeenCalledWith({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType
      })
      expect(service.s3Client.send).toHaveBeenCalledTimes(1)
      expect(mockLogger.info).toHaveBeenCalledWith(
        { bucket, key, size: body.length },
        'Uploaded object to S3'
      )
    })

    it('should upload an empty buffer without error', async () => {
      const service = new S3Service(mockLogger)
      const body = Buffer.alloc(0)

      service.s3Client.send.mockResolvedValue({})

      await service.putObject('bucket', 'empty.txt', body, 'text/plain')

      expect(mockLogger.info).toHaveBeenCalledWith(
        { bucket: 'bucket', key: 'empty.txt', size: 0 },
        'Uploaded object to S3'
      )
    })

    it('should throw and log when S3 put fails', async () => {
      const service = new S3Service(mockLogger)
      const error = new Error('S3 put failed')

      service.s3Client.send.mockRejectedValue(error)

      await expect(
        service.putObject('bucket', 'key', Buffer.from('x'), 'text/plain')
      ).rejects.toThrow('S3 put failed')

      expect(mockLogger.error).toHaveBeenCalledWith(
        { err: error, bucket: 'bucket', key: 'key' },
        'Failed to upload object to S3'
      )
    })

    it('should throw and log on access-denied error', async () => {
      const service = new S3Service(mockLogger)
      const error = new Error('Access Denied')
      error.name = 'AccessDenied'

      service.s3Client.send.mockRejectedValue(error)

      await expect(
        service.putObject('bucket', 'key', Buffer.from('data'), 'text/plain')
      ).rejects.toThrow('Access Denied')

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ err: error, bucket: 'bucket', key: 'key' }),
        'Failed to upload object to S3'
      )
    })
  })

  describe('putObjectStream', () => {
    it('should construct an Upload with the correct params and call done()', async () => {
      const service = new S3Service(mockLogger)
      const stream = { pipe: vi.fn() }

      mockUploadDone.mockResolvedValue({})

      await service.putObjectStream(
        'test-bucket',
        'reports/out.zip',
        stream,
        'application/zip'
      )

      const { Upload } = await import('@aws-sdk/lib-storage')
      expect(Upload).toHaveBeenCalledWith({
        client: service.s3Client,
        params: {
          Bucket: 'test-bucket',
          Key: 'reports/out.zip',
          Body: stream,
          ContentType: 'application/zip'
        }
      })
      expect(mockUploadDone).toHaveBeenCalledTimes(1)
      expect(mockLogger.info).toHaveBeenCalledWith(
        { bucket: 'test-bucket', key: 'reports/out.zip' },
        'Streamed object to S3 via multipart upload'
      )
    })

    it('should propagate errors thrown by Upload.done()', async () => {
      const service = new S3Service(mockLogger)
      const error = new Error('Multipart upload failed')

      mockUploadDone.mockRejectedValue(error)

      await expect(
        service.putObjectStream('bucket', 'key', {}, 'application/zip')
      ).rejects.toThrow('Multipart upload failed')
    })
  })

  describe('getObjectStream', () => {
    it('should return the S3 response body stream directly', async () => {
      const service = new S3Service(mockLogger)
      const mockBody = {
        async *[Symbol.asyncIterator]() {
          yield Buffer.from('streamed data')
        }
      }

      service.s3Client.send.mockResolvedValue({ Body: mockBody })

      const result = await service.getObjectStream('test-bucket', 'stream-key')

      const { GetObjectCommand } = await import('@aws-sdk/client-s3')
      expect(GetObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'stream-key'
      })
      expect(result).toBe(mockBody)
    })

    it('should propagate errors thrown by s3Client.send', async () => {
      const service = new S3Service(mockLogger)
      service.s3Client.send.mockRejectedValue(new Error('NoSuchKey'))

      await expect(
        service.getObjectStream('test-bucket', 'missing-key')
      ).rejects.toThrow('NoSuchKey')
    })
  })

  describe('getObjectRange', () => {
    it('should fetch a byte range and return a Buffer when chunks are already Buffers', async () => {
      const service = new S3Service(mockLogger)
      const chunk1 = Buffer.from('hello')
      const chunk2 = Buffer.from(' world')

      service.s3Client.send.mockResolvedValue({
        Body: {
          async *[Symbol.asyncIterator]() {
            yield chunk1
            yield chunk2
          }
        }
      })

      const result = await service.getObjectRange(
        'test-bucket',
        'test-key',
        'bytes=-65536'
      )

      const { GetObjectCommand } = await import('@aws-sdk/client-s3')
      expect(GetObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'test-key',
        Range: 'bytes=-65536'
      })
      expect(Buffer.isBuffer(result)).toBe(true)
      expect(result.toString()).toBe('hello world')
    })

    it('should convert non-Buffer chunks to Buffers via Buffer.from', async () => {
      const service = new S3Service(mockLogger)
      // Uint8Array is the non-Buffer path that exercises the Buffer.from(chunk) branch
      const uint8Chunk = new Uint8Array([72, 101, 108, 108, 111]) // 'Hello'

      service.s3Client.send.mockResolvedValue({
        Body: {
          async *[Symbol.asyncIterator]() {
            yield uint8Chunk
          }
        }
      })

      const result = await service.getObjectRange(
        'test-bucket',
        'test-key',
        'bytes=0-4'
      )

      expect(Buffer.isBuffer(result)).toBe(true)
      expect(result.toString()).toBe('Hello')
    })

    it('should return an empty Buffer when the stream yields no chunks', async () => {
      const service = new S3Service(mockLogger)

      service.s3Client.send.mockResolvedValue({
        Body: {
          async *[Symbol.asyncIterator]() {}
        }
      })

      const result = await service.getObjectRange(
        'test-bucket',
        'test-key',
        'bytes=0-0'
      )

      expect(Buffer.isBuffer(result)).toBe(true)
      expect(result.length).toBe(0)
    })

    it('should propagate errors thrown by s3Client.send', async () => {
      const service = new S3Service(mockLogger)
      const error = new Error('S3 range request failed')

      service.s3Client.send.mockRejectedValue(error)

      await expect(
        service.getObjectRange('test-bucket', 'test-key', 'bytes=0-1023')
      ).rejects.toThrow('S3 range request failed')
    })
  })

  describe('copyObject', () => {
    it('should successfully copy an object in S3', async () => {
      const service = new S3Service(mockLogger)
      const sourceBucket = 'src-bucket'
      const sourceKey = 'src/key.zip'
      const destBucket = 'dst-bucket'
      const destKey = 'dst/key.zip'

      service.s3Client.send.mockResolvedValue({})

      await service.copyObject(sourceBucket, sourceKey, destBucket, destKey)

      const { CopyObjectCommand } = await import('@aws-sdk/client-s3')
      expect(CopyObjectCommand).toHaveBeenCalledWith({
        CopySource: 'src-bucket/src/key.zip',
        Bucket: destBucket,
        Key: destKey
      })

      expect(service.s3Client.send).toHaveBeenCalledTimes(1)

      expect(mockLogger.info).toHaveBeenCalledWith(
        { sourceBucket, sourceKey, destBucket, destKey },
        'Successfully copied S3 object'
      )
    })

    it('should handle S3 copy errors', async () => {
      const service = new S3Service(mockLogger)
      const error = new Error('S3 copy failed')

      service.s3Client.send.mockRejectedValue(error)

      await expect(
        service.copyObject(
          'src-bucket',
          'src/key.zip',
          'dst-bucket',
          'dst/key.zip'
        )
      ).rejects.toThrow('S3 copy failed')

      expect(mockLogger.error).toHaveBeenCalledWith(
        {
          err: error,
          sourceBucket: 'src-bucket',
          sourceKey: 'src/key.zip',
          destBucket: 'dst-bucket',
          destKey: 'dst/key.zip'
        },
        'Failed to copy S3 object'
      )
    })

    it('should copy object between different buckets', async () => {
      const service = new S3Service(mockLogger)

      service.s3Client.send.mockResolvedValue({})

      await service.copyObject(
        'source-bucket',
        'project/v1/file.zip',
        'destination-bucket',
        'archive/v1/file.zip'
      )

      const { CopyObjectCommand } = await import('@aws-sdk/client-s3')
      expect(CopyObjectCommand).toHaveBeenCalledWith({
        CopySource: 'source-bucket/project/v1/file.zip',
        Bucket: 'destination-bucket',
        Key: 'archive/v1/file.zip'
      })

      expect(service.s3Client.send).toHaveBeenCalledTimes(1)
    })
  })
})
