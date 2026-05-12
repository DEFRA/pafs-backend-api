import { describe, test, expect, beforeEach, vi } from 'vitest'

const mockSend = vi.fn()
const mockDestroy = vi.fn()

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn(function () {
    this.send = mockSend
    this.destroy = mockDestroy
  }),
  HeadBucketCommand: vi.fn(function (params) {
    this.input = params
  })
}))

vi.mock('../../../config.js', () => ({
  config: {
    get: vi.fn()
  }
}))

const { config } = await import('../../../config.js')
const { checkS3Health } = await import('./s3-health.js')

const baseConfig = {
  'cdpUploader.enabled': true,
  'cdpUploader.s3Bucket': 'pafs-uploads',
  awsRegion: 'eu-west-2',
  'cdpUploader.s3Endpoint': null
}

describe('checkS3Health', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    config.get.mockImplementation((key) => baseConfig[key])
  })

  test('Should return disabled when cdpUploader is not enabled', async () => {
    config.get.mockImplementation((key) =>
      key === 'cdpUploader.enabled' ? false : baseConfig[key]
    )

    const result = await checkS3Health()

    expect(result.healthy).toBe(true)
    expect(result.status).toBe('disabled')
    expect(mockSend).not.toHaveBeenCalled()
  })

  test('Should return connected when HeadBucket succeeds', async () => {
    mockSend.mockResolvedValue({})

    const result = await checkS3Health()

    expect(result.healthy).toBe(true)
    expect(result.status).toBe('connected')
    expect(result.responseTime).toBeTypeOf('number')
  })

  test('Should return error when HeadBucket fails', async () => {
    mockSend.mockRejectedValue(new Error('Access denied'))

    const result = await checkS3Health()

    expect(result.healthy).toBe(false)
    expect(result.status).toBe('error')
    expect(result.error).toBe('Access denied')
  })

  test('Should always destroy the client', async () => {
    mockSend.mockResolvedValue({})
    await checkS3Health()
    expect(mockDestroy).toHaveBeenCalledTimes(1)
  })

  test('Should destroy the client even on error', async () => {
    mockSend.mockRejectedValue(new Error('timeout'))
    await checkS3Health()
    expect(mockDestroy).toHaveBeenCalledTimes(1)
  })

  test('Should set forcePathStyle and endpoint when s3Endpoint is configured', async () => {
    const { S3Client } = await import('@aws-sdk/client-s3')
    config.get.mockImplementation(
      (key) =>
        ({
          ...baseConfig,
          'cdpUploader.s3Endpoint': 'http://localhost:4566'
        })[key]
    )
    mockSend.mockResolvedValue({})

    await checkS3Health()

    expect(S3Client).toHaveBeenCalledWith(
      expect.objectContaining({
        forcePathStyle: true,
        endpoint: 'http://localhost:4566'
      })
    )
  })
})
