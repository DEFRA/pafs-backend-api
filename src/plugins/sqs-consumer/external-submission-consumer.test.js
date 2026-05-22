import { describe, test, expect, beforeEach, vi } from 'vitest'

// ─── Hoisted mock instances (must be initialised before vi.mock factories) ───

const mockConsumer = vi.hoisted(() => ({
  on: vi.fn(),
  start: vi.fn(),
  stop: vi.fn()
}))

const mockProjectServiceInstance = vi.hoisted(() => ({
  getProjectForSubmission: vi.fn()
}))

const mockExternalServiceInstance = vi.hoisted(() => ({
  send: vi.fn()
}))

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('sqs-consumer', () => ({
  Consumer: { create: vi.fn(() => mockConsumer) }
}))

vi.mock('@aws-sdk/client-sqs', () => ({
  DeleteMessageCommand: vi.fn(function DeleteMessageCommand(input) {
    this.input = input
  })
}))

vi.mock('../../config.js', () => ({
  config: {
    get: vi.fn((key) => {
      if (key === 'sqsExternalSubmission.queueUrl') {
        return 'http://localhost:4566/000000000000/pafs_external_submission'
      }
      if (key === 'sqsExternalSubmission.waitTimeSeconds') return 20
      if (key === 'sqsExternalSubmission.visibilityTimeout') return 120
      return null
    })
  }
}))

vi.mock('../projects/services/project-service.js', () => ({
  ProjectService: vi.fn(function ProjectService() {
    return mockProjectServiceInstance
  })
}))

vi.mock('../projects/helpers/lookup-creator-email.js', () => ({
  lookupCreatorEmail: vi.fn().mockResolvedValue('creator@example.com')
}))

vi.mock('../projects/helpers/proposal-payload-builder.js', () => ({
  fetchShapefileBase64: vi.fn().mockResolvedValue('base64shape=='),
  buildProposalPayload: vi
    .fn()
    .mockReturnValue({ national_project_number: 'LCR/123/456' })
}))

vi.mock('../projects/helpers/proposal-payload-validator.js', () => ({
  validateProposalPayload: vi.fn()
}))

vi.mock(
  '../../common/services/external-submission/external-submission-service.js',
  () => ({
    ExternalSubmissionService: vi.fn(function ExternalSubmissionService() {
      return mockExternalServiceInstance
    })
  })
)

// ─── Lazy imports (after mocks) ───────────────────────────────────────────────

const { Consumer } = await import('sqs-consumer')
const { lookupCreatorEmail } =
  await import('../projects/helpers/lookup-creator-email.js')
const { fetchShapefileBase64, buildProposalPayload } =
  await import('../projects/helpers/proposal-payload-builder.js')
const { validateProposalPayload } =
  await import('../projects/helpers/proposal-payload-validator.js')
const { sqsExternalSubmissionConsumerPlugin } =
  await import('./external-submission-consumer.js')

// ─── Helpers ─────────────────────────────────────────────────────────────────

const REFERENCE = 'LCR/123/456'
const PROJECT_ID = BigInt(99)

const MOCK_PROJECT = {
  referenceNumber: REFERENCE,
  id: PROJECT_ID,
  benefitAreaFileName: 'shapefile.zip',
  benefitAreaFileBase64: null
}

function makeServer() {
  const extensions = {}
  const listeners = {}
  return {
    sqs: { send: vi.fn().mockResolvedValue({}) },
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
    prisma: {},
    ext: vi.fn((event, fn) => {
      extensions[event] = fn
    }),
    events: {
      on: vi.fn((event, fn) => {
        listeners[event] = fn
      })
    },
    _extensions: extensions,
    _listeners: listeners
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('sqsExternalSubmissionConsumerPlugin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset hoisted mock instances to default happy-path behaviours
    mockProjectServiceInstance.getProjectForSubmission.mockResolvedValue(
      MOCK_PROJECT
    )
    mockExternalServiceInstance.send.mockResolvedValue({
      success: true,
      httpStatus: 200
    })
  })

  // ─── Plugin shape ────────────────────────────────────────────────────────

  test('has correct name', () => {
    expect(sqsExternalSubmissionConsumerPlugin.name).toBe(
      'sqsExternalSubmissionConsumer'
    )
  })

  test('has version 1.0.0', () => {
    expect(sqsExternalSubmissionConsumerPlugin.version).toBe('1.0.0')
  })

  // ─── Consumer creation ───────────────────────────────────────────────────

  test('creates consumer with correct queue options', async () => {
    const server = makeServer()
    await sqsExternalSubmissionConsumerPlugin.register(server)
    expect(Consumer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        queueUrl: 'http://localhost:4566/000000000000/pafs_external_submission',
        waitTimeSeconds: 20,
        visibilityTimeout: 120,
        batchSize: 1,
        shouldDeleteMessages: false
      })
    )
  })

  test('attaches error event listeners', async () => {
    const server = makeServer()
    await sqsExternalSubmissionConsumerPlugin.register(server)
    expect(mockConsumer.on).toHaveBeenCalledWith('error', expect.any(Function))
    expect(mockConsumer.on).toHaveBeenCalledWith(
      'processing_error',
      expect.any(Function)
    )
    expect(mockConsumer.on).toHaveBeenCalledWith(
      'timeout_error',
      expect.any(Function)
    )
  })

  test('starts consumer on onPostStart', async () => {
    const server = makeServer()
    await sqsExternalSubmissionConsumerPlugin.register(server)
    server._extensions.onPostStart()
    expect(mockConsumer.start).toHaveBeenCalled()
  })

  test('stops consumer on closing', async () => {
    const server = makeServer()
    await sqsExternalSubmissionConsumerPlugin.register(server)
    server._listeners.closing()
    expect(mockConsumer.stop).toHaveBeenCalled()
  })

  // ─── Message handling ────────────────────────────────────────────────────

  test('handleMessage calls getProjectForSubmission with parsed referenceNumber', async () => {
    const server = makeServer()
    await sqsExternalSubmissionConsumerPlugin.register(server)

    const { handleMessage } = Consumer.create.mock.calls[0][0]
    const message = {
      Body: JSON.stringify({
        referenceNumber: REFERENCE,
        projectId: PROJECT_ID.toString()
      }),
      ReceiptHandle: 'rh-001'
    }
    await handleMessage(message)

    expect(
      mockProjectServiceInstance.getProjectForSubmission
    ).toHaveBeenCalledWith(REFERENCE)
  })

  test('handleMessage calls lookupCreatorEmail', async () => {
    const server = makeServer()
    await sqsExternalSubmissionConsumerPlugin.register(server)

    const { handleMessage } = Consumer.create.mock.calls[0][0]
    await handleMessage({
      Body: JSON.stringify({ referenceNumber: REFERENCE, projectId: '99' }),
      ReceiptHandle: 'rh-002'
    })

    expect(lookupCreatorEmail).toHaveBeenCalledWith(
      server.prisma,
      REFERENCE,
      server.logger
    )
  })

  test('handleMessage fetches shapefile and builds payload', async () => {
    const server = makeServer()
    await sqsExternalSubmissionConsumerPlugin.register(server)

    const { handleMessage } = Consumer.create.mock.calls[0][0]
    await handleMessage({
      Body: JSON.stringify({ referenceNumber: REFERENCE, projectId: '99' }),
      ReceiptHandle: 'rh-003'
    })

    expect(fetchShapefileBase64).toHaveBeenCalledWith(
      MOCK_PROJECT,
      server.logger
    )
    expect(buildProposalPayload).toHaveBeenCalledWith(
      MOCK_PROJECT,
      'creator@example.com',
      'base64shape=='
    )
  })

  test('handleMessage validates payload and sends to external system', async () => {
    const server = makeServer()
    await sqsExternalSubmissionConsumerPlugin.register(server)

    const { handleMessage } = Consumer.create.mock.calls[0][0]
    await handleMessage({
      Body: JSON.stringify({ referenceNumber: REFERENCE, projectId: '99' }),
      ReceiptHandle: 'rh-004'
    })

    expect(validateProposalPayload).toHaveBeenCalled()
    expect(mockExternalServiceInstance.send).toHaveBeenCalled()
  })

  test('handleMessage logs warning when external submission fails', async () => {
    const server = makeServer()
    mockExternalServiceInstance.send.mockResolvedValue({
      success: false,
      error: 'Timeout',
      httpStatus: 503
    })
    await sqsExternalSubmissionConsumerPlugin.register(server)

    const { handleMessage } = Consumer.create.mock.calls[0][0]
    await handleMessage({
      Body: JSON.stringify({ referenceNumber: REFERENCE, projectId: '99' }),
      ReceiptHandle: 'rh-005'
    })

    expect(server.logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ referenceNumber: REFERENCE }),
      expect.any(String)
    )
  })

  test('handleMessage logs error and skips when project not found', async () => {
    const server = makeServer()
    mockProjectServiceInstance.getProjectForSubmission.mockResolvedValue(null)
    await sqsExternalSubmissionConsumerPlugin.register(server)

    const { handleMessage } = Consumer.create.mock.calls[0][0]
    await handleMessage({
      Body: JSON.stringify({ referenceNumber: REFERENCE, projectId: '99' }),
      ReceiptHandle: 'rh-006'
    })

    expect(server.logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ referenceNumber: REFERENCE }),
      expect.any(String)
    )
    expect(mockExternalServiceInstance.send).not.toHaveBeenCalled()
  })

  test('handleMessage deletes the SQS message after successful processing', async () => {
    const server = makeServer()
    await sqsExternalSubmissionConsumerPlugin.register(server)

    const { handleMessage } = Consumer.create.mock.calls[0][0]
    await handleMessage({
      Body: JSON.stringify({ referenceNumber: REFERENCE, projectId: '99' }),
      ReceiptHandle: 'rh-delete'
    })

    expect(server.sqs.send).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({ ReceiptHandle: 'rh-delete' })
      })
    )
  })
})
