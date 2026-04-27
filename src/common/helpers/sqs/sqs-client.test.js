import { describe, test, expect, beforeEach, vi } from 'vitest'

// vi.hoisted ensures these are available during mock factory hoisting
const mockDestroy = vi.hoisted(() => vi.fn())
const mockClient = vi.hoisted(() => ({ destroy: mockDestroy }))

vi.mock('@aws-sdk/client-sqs', () => ({
  // Must use a regular function (not arrow) so it can be called with `new`
  SQSClient: vi.fn(function SQSClientMock() {
    return mockClient
  })
}))

vi.mock('../../../config.js', () => ({
  config: {
    get: vi.fn((key) => {
      if (key === 'sqsEndpoint') return null
      if (key === 'awsRegion') return 'eu-west-2'
      return null
    })
  }
}))

const { SQSClient } = await import('@aws-sdk/client-sqs')
const { config } = await import('../../../config.js')
const { sqsClientPlugin } = await import('./sqs-client.js')

function makeServer() {
  const decorations = {}
  const listeners = {}
  return {
    decorate: vi.fn((type, name, value) => {
      decorations[name] = value
    }),
    events: {
      on: vi.fn((event, fn) => {
        listeners[event] = fn
      })
    },
    logger: { info: vi.fn() },
    _decorations: decorations,
    _listeners: listeners
  }
}

describe('sqsClientPlugin', () => {
  beforeEach(() => vi.clearAllMocks())

  test('has correct name and version', () => {
    expect(sqsClientPlugin.name).toBe('sqsClient')
    expect(sqsClientPlugin.version).toBe('1.0.0')
  })

  test('creates SQSClient with region from config', () => {
    const server = makeServer()
    sqsClientPlugin.register(server)
    expect(SQSClient).toHaveBeenCalledWith(
      expect.objectContaining({ region: 'eu-west-2' })
    )
  })

  test('decorates server with sqs client', () => {
    const server = makeServer()
    sqsClientPlugin.register(server)
    expect(server.decorate).toHaveBeenCalledWith('server', 'sqs', mockClient)
  })

  test('does not set endpoint when sqsEndpoint config is null', () => {
    const server = makeServer()
    sqsClientPlugin.register(server)
    const [callConfig] = SQSClient.mock.calls[0]
    expect(callConfig.endpoint).toBeUndefined()
  })

  test('sets endpoint when sqsEndpoint config is provided', () => {
    config.get.mockImplementation((key) => {
      if (key === 'sqsEndpoint') return 'http://localhost:4566'
      if (key === 'awsRegion') return 'eu-west-2'
      return null
    })
    const server = makeServer()
    sqsClientPlugin.register(server)
    expect(SQSClient).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: 'http://localhost:4566' })
    )
  })

  test('destroys client on server stop event', () => {
    const server = makeServer()
    sqsClientPlugin.register(server)
    server._listeners['stop']()
    expect(mockDestroy).toHaveBeenCalled()
  })

  test('logs info when stopping', () => {
    const server = makeServer()
    sqsClientPlugin.register(server)
    server._listeners['stop']()
    expect(server.logger.info).toHaveBeenCalledWith('Closing SQS client')
  })
})
