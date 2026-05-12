import { describe, test, expect, beforeEach, vi } from 'vitest'

const mockSqsSend = vi.fn()

vi.mock('@aws-sdk/client-sqs', () => ({
  GetQueueAttributesCommand: vi.fn(function (params) {
    this.input = params
  })
}))

vi.mock('../../../config.js', () => ({
  config: {
    get: vi.fn((key) =>
      key === 'sqsProgrammeGeneration.queueUrl'
        ? 'http://localhost:4566/000000000000/pafs_programme_generation'
        : null
    )
  }
}))

const { checkSqsHealth } = await import('./sqs-health.js')

function makeRequest() {
  return {
    server: {
      sqs: { send: mockSqsSend }
    }
  }
}

describe('checkSqsHealth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('Should return connected when GetQueueAttributes succeeds', async () => {
    mockSqsSend.mockResolvedValue({
      Attributes: {
        QueueArn: 'arn:aws:sqs:eu-west-2:000000000000:pafs_programme_generation'
      }
    })

    const result = await checkSqsHealth(makeRequest())

    expect(result.healthy).toBe(true)
    expect(result.status).toBe('connected')
    expect(result.responseTime).toBeTypeOf('number')
  })

  test('Should return error when GetQueueAttributes fails', async () => {
    mockSqsSend.mockRejectedValue(new Error('Queue does not exist'))

    const result = await checkSqsHealth(makeRequest())

    expect(result.healthy).toBe(false)
    expect(result.status).toBe('error')
    expect(result.error).toBe('Queue does not exist')
  })

  test('Should request only QueueArn attribute', async () => {
    const { GetQueueAttributesCommand } = await import('@aws-sdk/client-sqs')
    mockSqsSend.mockResolvedValue({})

    await checkSqsHealth(makeRequest())

    expect(GetQueueAttributesCommand).toHaveBeenCalledWith(
      expect.objectContaining({ AttributeNames: ['QueueArn'] })
    )
  })

  test('Should reuse the server-decorated SQS client', async () => {
    mockSqsSend.mockResolvedValue({})

    await checkSqsHealth(makeRequest())

    expect(mockSqsSend).toHaveBeenCalledTimes(1)
  })
})
