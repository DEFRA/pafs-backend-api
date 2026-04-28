import { describe, test, expect, beforeEach, vi } from 'vitest'

const mockConsumer = {
  on: vi.fn(),
  start: vi.fn(),
  stop: vi.fn()
}

vi.mock('sqs-consumer', () => ({
  Consumer: {
    create: vi.fn(() => mockConsumer)
  }
}))

vi.mock('@aws-sdk/client-sqs', () => ({
  // Must use a regular function (not arrow) so it can be called with `new`
  DeleteMessageCommand: vi.fn(function DeleteMessageCommand(input) {
    this.input = input
  })
}))

vi.mock('../../config.js', () => ({
  config: {
    get: vi.fn((key) => {
      if (key === 'sqsProgrammeGeneration.queueUrl') {
        return 'http://localhost:4566/000000000000/pafs_programme_generation'
      }
      if (key === 'sqsProgrammeGeneration.waitTimeSeconds') return 20
      if (key === 'sqsProgrammeGeneration.visibilityTimeout') return 900
      return null
    })
  }
}))

vi.mock('../downloads/programme/programme-service.js', () => ({
  runUserGeneration: vi.fn().mockResolvedValue(undefined),
  runAdminGeneration: vi.fn().mockResolvedValue(undefined)
}))

const { Consumer } = await import('sqs-consumer')
const { runUserGeneration, runAdminGeneration } =
  await import('../downloads/programme/programme-service.js')
const { sqsProgrammeConsumerPlugin } = await import('./index.js')

function makeServer() {
  const extensions = {}
  const listeners = {}
  return {
    sqs: { send: vi.fn().mockResolvedValue({}) },
    logger: { info: vi.fn(), error: vi.fn() },
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

describe('sqsProgrammeConsumerPlugin', () => {
  beforeEach(() => vi.clearAllMocks())

  test('has correct name and version', () => {
    expect(sqsProgrammeConsumerPlugin.name).toBe('sqsProgrammeConsumer')
    expect(sqsProgrammeConsumerPlugin.version).toBe('1.0.0')
  })

  test('creates consumer with correct queue options', async () => {
    const server = makeServer()
    await sqsProgrammeConsumerPlugin.register(server)
    expect(Consumer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        queueUrl:
          'http://localhost:4566/000000000000/pafs_programme_generation',
        waitTimeSeconds: 20,
        visibilityTimeout: 900,
        shouldDeleteMessages: false,
        batchSize: 1,
        sqs: server.sqs
      })
    )
  })

  test('starts consumer on onPostStart event', async () => {
    const server = makeServer()
    await sqsProgrammeConsumerPlugin.register(server)
    server._extensions['onPostStart']()
    expect(mockConsumer.start).toHaveBeenCalled()
  })

  test('stops consumer on closing event', async () => {
    const server = makeServer()
    await sqsProgrammeConsumerPlugin.register(server)
    server._listeners['closing']()
    expect(mockConsumer.stop).toHaveBeenCalled()
  })

  test('registers error, processing_error and timeout_error handlers', async () => {
    const server = makeServer()
    await sqsProgrammeConsumerPlugin.register(server)
    const registeredEvents = mockConsumer.on.mock.calls.map((c) => c[0])
    expect(registeredEvents).toContain('error')
    expect(registeredEvents).toContain('processing_error')
    expect(registeredEvents).toContain('timeout_error')
  })

  test('dispatches admin message to runAdminGeneration', async () => {
    const server = makeServer()
    await sqsProgrammeConsumerPlugin.register(server)
    const { handleMessage } = Consumer.create.mock.calls[0][0]
    const message = {
      Body: JSON.stringify({
        type: 'admin',
        downloadId: '10',
        s3Bucket: 'bucket',
        requestingUserId: 99
      }),
      ReceiptHandle: 'rh-admin'
    }
    await handleMessage(message)
    expect(runAdminGeneration).toHaveBeenCalledWith(
      expect.objectContaining({
        downloadId: BigInt(10),
        s3Bucket: 'bucket',
        requestingUserId: 99,
        prisma: server.prisma,
        logger: server.logger
      })
    )
    expect(server.sqs.send).toHaveBeenCalled()
  })

  test('dispatches user message to runUserGeneration', async () => {
    const server = makeServer()
    await sqsProgrammeConsumerPlugin.register(server)
    const { handleMessage } = Consumer.create.mock.calls[0][0]
    const message = {
      Body: JSON.stringify({
        type: 'user',
        downloadId: '5',
        userId: 42,
        s3Bucket: 'bucket'
      }),
      ReceiptHandle: 'rh-user'
    }
    await handleMessage(message)
    expect(runUserGeneration).toHaveBeenCalledWith(
      expect.objectContaining({
        downloadId: BigInt(5),
        userId: 42,
        s3Bucket: 'bucket',
        prisma: server.prisma,
        logger: server.logger
      })
    )
    expect(server.sqs.send).toHaveBeenCalled()
  })

  test('logs error events via error handler', async () => {
    const server = makeServer()
    await sqsProgrammeConsumerPlugin.register(server)
    const errorHandler = mockConsumer.on.mock.calls.find(
      (c) => c[0] === 'error'
    )[1]
    const err = new Error('SQS failure')
    errorHandler(err)
    expect(server.logger.error).toHaveBeenCalledWith(
      { err },
      'SQS consumer error'
    )
  })

  test('logs processing_error events via processing_error handler', async () => {
    const server = makeServer()
    await sqsProgrammeConsumerPlugin.register(server)
    const handler = mockConsumer.on.mock.calls.find(
      (c) => c[0] === 'processing_error'
    )[1]
    const err = new Error('processing failure')
    handler(err)
    expect(server.logger.error).toHaveBeenCalledWith(
      { err },
      'SQS consumer processing error'
    )
  })

  test('logs timeout_error events via timeout_error handler', async () => {
    const server = makeServer()
    await sqsProgrammeConsumerPlugin.register(server)
    const handler = mockConsumer.on.mock.calls.find(
      (c) => c[0] === 'timeout_error'
    )[1]
    const err = new Error('timeout')
    handler(err)
    expect(server.logger.error).toHaveBeenCalledWith(
      { err },
      'SQS consumer timeout error'
    )
  })

  test('sends DeleteMessageCommand after successful message handling', async () => {
    const server = makeServer()
    await sqsProgrammeConsumerPlugin.register(server)
    const { handleMessage } = Consumer.create.mock.calls[0][0]
    const message = {
      Body: JSON.stringify({
        type: 'user',
        downloadId: '1',
        userId: 1,
        s3Bucket: 'bucket'
      }),
      ReceiptHandle: 'receipt-handle-123'
    }
    await handleMessage(message)
    const deleteCalls = server.sqs.send.mock.calls
    expect(deleteCalls.length).toBeGreaterThan(0)
    const deleteArg = deleteCalls[deleteCalls.length - 1][0]
    expect(deleteArg.input).toMatchObject({
      QueueUrl: 'http://localhost:4566/000000000000/pafs_programme_generation',
      ReceiptHandle: 'receipt-handle-123'
    })
  })
})
