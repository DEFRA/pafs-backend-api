import { describe, test, expect, beforeEach, vi } from 'vitest'

vi.mock('@aws-sdk/client-sqs', () => ({
  SendMessageCommand: vi.fn(function SendMessageCommand(input) {
    this.input = input
  })
}))

vi.mock('../../../config.js', () => ({
  config: {
    get: vi.fn((key) => {
      if (key === 'sqsExternalSubmission.queueUrl') {
        return 'http://localhost:4566/000000000000/pafs_external_submission'
      }
      return null
    })
  }
}))

const { SendMessageCommand } = await import('@aws-sdk/client-sqs')
const { sendExternalSubmissionMessage } =
  await import('./send-external-submission-message.js')

describe('sendExternalSubmissionMessage', () => {
  let mockSqsClient

  beforeEach(() => {
    vi.clearAllMocks()
    mockSqsClient = { send: vi.fn().mockResolvedValue({}) }
  })

  test('sends a SendMessageCommand to the configured queue URL', async () => {
    await sendExternalSubmissionMessage(
      mockSqsClient,
      'LCR/123/456',
      BigInt(99)
    )

    expect(mockSqsClient.send).toHaveBeenCalledOnce()
    expect(mockSqsClient.send).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          QueueUrl:
            'http://localhost:4566/000000000000/pafs_external_submission'
        })
      })
    )
  })

  test('message body contains referenceNumber and projectId as a string', async () => {
    await sendExternalSubmissionMessage(
      mockSqsClient,
      'LCR/123/456',
      BigInt(99)
    )

    const [command] = mockSqsClient.send.mock.calls[0]
    const body = JSON.parse(command.input.MessageBody)

    expect(body.referenceNumber).toBe('LCR/123/456')
    expect(body.projectId).toBe('99')
  })

  test('serialises BigInt projectId to string (not a number)', async () => {
    await sendExternalSubmissionMessage(
      mockSqsClient,
      'EA/999/AAA/2025',
      BigInt('9007199254740993') // exceeds Number.MAX_SAFE_INTEGER — must use string to preserve precision
    )

    const [command] = mockSqsClient.send.mock.calls[0]
    // Use the raw MessageBody string — JSON.parse would silently lose precision
    // for integers beyond MAX_SAFE_INTEGER
    expect(command.input.MessageBody).toContain(
      '"projectId":"9007199254740993"'
    )
  })

  test('constructs a SendMessageCommand with the correct shape', async () => {
    await sendExternalSubmissionMessage(
      mockSqsClient,
      'LCR/123/456',
      BigInt(42)
    )

    expect(SendMessageCommand).toHaveBeenCalledWith({
      QueueUrl: 'http://localhost:4566/000000000000/pafs_external_submission',
      MessageBody: JSON.stringify({
        referenceNumber: 'LCR/123/456',
        projectId: '42'
      })
    })
  })

  test('propagates errors thrown by sqsClient.send', async () => {
    const sqsError = new Error('SQS unavailable')
    mockSqsClient.send.mockRejectedValue(sqsError)

    await expect(
      sendExternalSubmissionMessage(mockSqsClient, 'LCR/123/456', BigInt(1))
    ).rejects.toThrow('SQS unavailable')
  })
})
