describe('#startServer', () => {
  let startServerImport
  let createServerImport
  let mockServer

  beforeAll(async () => {
    vi.stubEnv('PORT', '3098')

    // Mock server instance
    mockServer = {
      start: vi.fn().mockResolvedValue(undefined),
      listener: {
        requestTimeout: 120000,
        headersTimeout: 60000,
        keepAliveTimeout: 5000
      },
      logger: {
        info: vi.fn()
      }
    }

    createServerImport = await import('../../server.js')
    startServerImport = await import('./start-server.js')
  })

  afterAll(() => {
    vi.resetAllMocks()
  })

  describe('When server starts', () => {
    test('Should start up server as expected', async () => {
      const createServerSpy = vi
        .spyOn(createServerImport, 'createServer')
        .mockResolvedValue(mockServer)

      const server = await startServerImport.startServer()

      expect(createServerSpy).toHaveBeenCalled()
      expect(mockServer.start).toHaveBeenCalled()
      expect(mockServer.listener.requestTimeout).toBe(0)
      expect(mockServer.listener.headersTimeout).toBe(0)
      expect(mockServer.listener.keepAliveTimeout).toBe(0)
      expect(server).toBe(mockServer)

      createServerSpy.mockRestore()
    })
  })

  describe('When server start fails', () => {
    test('Should log failed startup message', async () => {
      const createServerSpy = vi
        .spyOn(createServerImport, 'createServer')
        .mockRejectedValue(new Error('Server failed to start'))

      await expect(startServerImport.startServer()).rejects.toThrow(
        'Server failed to start'
      )

      createServerSpy.mockRestore()
    })
  })
})
