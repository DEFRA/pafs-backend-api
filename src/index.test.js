import { describe, test, expect, vi } from 'vitest'

vi.mock('./common/helpers/start-server.js', () => ({
  startServer: vi.fn().mockResolvedValue({
    info: { uri: 'http://localhost:5000' }
  })
}))

describe('index.js', () => {
  test('start the server and register the handlers', async () => {
    const processOnSpy = vi.spyOn(process, 'on')
    await import('./index.js')

    expect(processOnSpy).toHaveBeenCalledWith(
      'unhandledRejection',
      expect.any(Function)
    )

    processOnSpy.mockRestore()
  })

  test('unhandledRejection handler logs error and sets exit code', () => {
    const originalExitCode = process.exitCode
    const testError = new Error('test rejection')

    const listeners = process.listeners('unhandledRejection')
    expect(listeners.length).toBeGreaterThan(0)

    const handler = listeners[listeners.length - 1]
    handler(testError)

    expect(process.exitCode).toBe(1)

    process.exitCode = originalExitCode
  })
})
