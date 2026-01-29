import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  CdpUploaderService,
  getCdpUploaderService,
  resetCdpUploaderService
} from './cdp-uploader-service.js'

// Mock config module
vi.mock('../../../config.js')

// Mock node-fetch
vi.mock('node-fetch', () => ({
  default: vi.fn()
}))

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn()
}

describe('CdpUploaderService', () => {
  let mockConfig
  let mockFetch

  beforeEach(async () => {
    vi.clearAllMocks()
    resetCdpUploaderService()

    // Import and setup mock config
    const configModule = await import('../../../config.js')
    mockConfig = {
      'cdpUploader.enabled': true,
      'cdpUploader.baseUrl': 'https://cdp-uploader.test.cdp-int.defra.cloud',
      'cdpUploader.s3Bucket': 'test-bucket',
      'cdpUploader.s3Path': 'uploads/',
      'cdpUploader.maxFileSize': 20000000,
      'cdpUploader.allowedMimeTypes': 'application/pdf,image/jpeg,image/png',
      'cdpUploader.timeout': 30000,
      'awsRegion': 'eu-west-2'
    }
    configModule.config.get = vi.fn((key) => mockConfig[key])

    // Import and setup mock fetch
    const fetchModule = await import('node-fetch')
    mockFetch = fetchModule.default
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('constructor', () => {
    test('should initialize with config values', () => {
      const service = new CdpUploaderService(mockLogger)

      expect(service.enabled).toBe(true)
      expect(service.baseUrl).toBe(
        'https://cdp-uploader.test.cdp-int.defra.cloud'
      )
      expect(service.s3Bucket).toBe('test-bucket')
      expect(service.s3Path).toBe('uploads/')
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          baseUrl: 'https://cdp-uploader.test.cdp-int.defra.cloud',
          s3Bucket: 'test-bucket'
        }),
        'CDP Uploader service initialized'
      )
    })

    test('should warn when disabled', async () => {
      mockConfig['cdpUploader.enabled'] = false

      const service = new CdpUploaderService(mockLogger)

      expect(service.enabled).toBe(false)
      expect(mockLogger.warn).toHaveBeenCalledWith('CDP Uploader disabled')
    })
  })

  describe('initiate', () => {
    test('should initiate upload with correct payload', async () => {
      const service = new CdpUploaderService(mockLogger)
      const mockResponse = {
        uploadId: 'test-upload-id',
        uploadUrl: '/upload-and-scan/test-upload-id',
        statusUrl:
          'https://cdp-uploader.test.cdp-int.defra.cloud/status/test-upload-id'
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      })

      const result = await service.initiate({
        redirect: '/upload-success',
        callback: 'https://api.test.com/callback',
        metadata: { reference: 'test-ref' }
      })

      expect(mockFetch).toHaveBeenCalledWith(
        'https://cdp-uploader.test.cdp-int.defra.cloud/initiate',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        })
      )

      // Check body contains all expected fields
      const fetchCall = mockFetch.mock.calls[0]
      const body = JSON.parse(fetchCall[1].body)
      expect(body).toMatchObject({
        redirect: '/upload-success',
        callback: 'https://api.test.com/callback',
        s3Bucket: 'test-bucket',
        s3Path: 'uploads/',
        metadata: { reference: 'test-ref' },
        mimeTypes: ['application/pdf', 'image/jpeg', 'image/png'],
        maxFileSize: 20000000
      })

      expect(result).toEqual(mockResponse)
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          uploadId: 'test-upload-id'
        }),
        'Upload session initiated'
      )
    })

    test('should include downloadUrls when provided', async () => {
      const service = new CdpUploaderService(mockLogger)
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ uploadId: 'test-id' })
      })

      await service.initiate({
        redirect: '/success',
        callback: 'https://api.test.com/callback',
        metadata: {},
        downloadUrls: ['https://example.com/file.pdf']
      })

      const callArgs = mockFetch.mock.calls[0][1]
      const body = JSON.parse(callArgs.body)

      expect(body.downloadUrls).toEqual(['https://example.com/file.pdf'])
    })

    test('should handle API errors', async () => {
      const service = new CdpUploaderService(mockLogger)
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error'
      })

      await expect(
        service.initiate({
          redirect: '/success',
          callback: 'https://api.test.com/callback'
        })
      ).rejects.toThrow('CDP Uploader initiate failed: 500')

      expect(mockLogger.error).toHaveBeenCalled()
    })

    test('should return mock response when disabled', async () => {
      mockConfig['cdpUploader.enabled'] = false

      const service = new CdpUploaderService(mockLogger)
      const result = await service.initiate({
        redirect: '/success',
        callback: 'https://api.test.com/callback',
        metadata: { test: 'data' }
      })

      expect(result).toHaveProperty('uploadId')
      expect(result.uploadId).toBeTruthy()
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'CDP Uploader disabled - returning mock response'
      )
    })

    test('should not include s3Path when not configured', async () => {
      mockConfig['cdpUploader.s3Path'] = null

      const service = new CdpUploaderService(mockLogger)
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ uploadId: 'test-id' })
      })

      await service.initiate({
        redirect: '/success',
        callback: 'https://api.test.com/callback',
        metadata: {}
      })

      const callArgs = mockFetch.mock.calls[0][1]
      const body = JSON.parse(callArgs.body)

      expect(body.s3Path).toBeUndefined()
    })

    test('should not include downloadUrls when empty array', async () => {
      const service = new CdpUploaderService(mockLogger)
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ uploadId: 'test-id' })
      })

      await service.initiate({
        redirect: '/success',
        callback: 'https://api.test.com/callback',
        metadata: {},
        downloadUrls: []
      })

      const callArgs = mockFetch.mock.calls[0][1]
      const body = JSON.parse(callArgs.body)

      expect(body.downloadUrls).toBeUndefined()
    })

    test('should handle timeout', async () => {
      const service = new CdpUploaderService(mockLogger)

      // Mock fetch to reject with abort error
      mockFetch.mockRejectedValue(new Error('The operation was aborted'))

      await expect(
        service.initiate({
          redirect: '/success',
          callback: 'https://api.test.com/callback'
        })
      ).rejects.toThrow()

      expect(mockLogger.error).toHaveBeenCalled()
    })

    test('should handle metadata as null', async () => {
      const service = new CdpUploaderService(mockLogger)
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ uploadId: 'test-id' })
      })

      await service.initiate({
        redirect: '/success',
        callback: 'https://api.test.com/callback',
        metadata: null
      })

      const callArgs = mockFetch.mock.calls[0][1]
      const body = JSON.parse(callArgs.body)

      expect(body.metadata).toEqual({})
    })
  })

  describe('getUploadStatus', () => {
    test('should fetch upload status', async () => {
      const service = new CdpUploaderService(mockLogger)
      const mockStatus = {
        uploadStatus: 'ready',
        metadata: { reference: 'test-ref' },
        form: {
          file: {
            fileId: 'file-123',
            filename: 'test.pdf',
            fileStatus: 'complete'
          }
        }
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockStatus
      })

      const result = await service.getUploadStatus('test-upload-id')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://cdp-uploader.test.cdp-int.defra.cloud/status/test-upload-id',
        expect.objectContaining({
          method: 'GET'
        })
      )

      expect(result).toEqual(mockStatus)
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          uploadId: 'test-upload-id',
          uploadStatus: 'ready'
        }),
        'Upload status retrieved'
      )
    })

    test('should handle status check errors', async () => {
      const service = new CdpUploaderService(mockLogger)
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        text: async () => 'Not Found'
      })

      await expect(service.getUploadStatus('invalid-id')).rejects.toThrow(
        'CDP Uploader status check failed: 404'
      )

      expect(mockLogger.error).toHaveBeenCalled()
    })

    test('should return mock status when disabled', async () => {
      const { config } = await import('../../../config.js')
      config.get.mockImplementation((key) => {
        if (key === 'cdpUploader.enabled') return false
        if (key === 'cdpUploader.baseUrl') {
          return 'https://cdp-uploader.test.cdp-int.defra.cloud'
        }
        if (key === 'cdpUploader.s3Bucket') return 'test-bucket'
        if (key === 'cdpUploader.s3Path') return 'uploads/'
        if (key === 'cdpUploader.maxFileSize') return 20000000
        if (key === 'cdpUploader.allowedMimeTypes') {
          return 'application/pdf,image/jpeg,image/png'
        }
        if (key === 'awsRegion') return 'eu-west-2'
        return 30000
      })

      const service = new CdpUploaderService(mockLogger)
      const result = await service.getUploadStatus('test-id')

      expect(result).toHaveProperty('uploadStatus', 'ready')
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'CDP Uploader disabled - returning mock status'
      )
    })

    test('should handle timeout in status check', async () => {
      const service = new CdpUploaderService(mockLogger)

      // Mock fetch to reject with abort error
      mockFetch.mockRejectedValue(new Error('The operation was aborted'))

      await expect(service.getUploadStatus('test-id')).rejects.toThrow()

      expect(mockLogger.error).toHaveBeenCalled()
    })
  })

  describe('buildUploadUrl', () => {
    test('should combine base URL with relative path', () => {
      const service = new CdpUploaderService(mockLogger)
      const result = service.buildUploadUrl(
        '/upload-and-scan/123',
        'https://frontend.com'
      )

      expect(result).toBe('https://frontend.com/upload-and-scan/123')
    })

    test('should handle base URL with trailing slash', () => {
      const service = new CdpUploaderService(mockLogger)
      const result = service.buildUploadUrl(
        '/upload-and-scan/123',
        'https://frontend.com/'
      )

      expect(result).toBe('https://frontend.com/upload-and-scan/123')
    })

    test('should handle path without leading slash', () => {
      const service = new CdpUploaderService(mockLogger)
      const result = service.buildUploadUrl(
        'upload-and-scan/123',
        'https://frontend.com'
      )

      expect(result).toBe('https://frontend.com/upload-and-scan/123')
    })
  })

  describe('getServiceStatus', () => {
    test('should return status when enabled and configured', () => {
      const service = new CdpUploaderService(mockLogger)
      const status = service.getServiceStatus()

      expect(status).toEqual({
        enabled: true,
        baseUrl: 'https://cdp-uploader.test.cdp-int.defra.cloud',
        s3Bucket: 'test-bucket',
        s3Path: 'uploads/'
      })
    })
  })

  describe('singleton pattern', () => {
    test('should return same instance', () => {
      const service1 = getCdpUploaderService(mockLogger)
      const service2 = getCdpUploaderService(mockLogger)

      expect(service1).toBe(service2)
    })

    test('should reset instance', () => {
      const service1 = getCdpUploaderService(mockLogger)
      resetCdpUploaderService()
      const service2 = getCdpUploaderService(mockLogger)

      expect(service1).not.toBe(service2)
    })
  })
})
