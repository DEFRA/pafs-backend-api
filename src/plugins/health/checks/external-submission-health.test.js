import { describe, test, expect, beforeEach, vi } from 'vitest'

vi.mock('../../../config.js', () => ({
  config: {
    get: vi.fn()
  }
}))

const { config } = await import('../../../config.js')
const { checkExternalSubmissionHealth } =
  await import('./external-submission-health.js')

describe('checkExternalSubmissionHealth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('Should return disabled when external submission is not enabled', () => {
    config.get.mockImplementation((key) =>
      key === 'externalSubmission.enabled' ? false : null
    )

    const result = checkExternalSubmissionHealth()

    expect(result.healthy).toBe(true)
    expect(result.status).toBe('disabled')
  })

  test('Should return configured when enabled and all config is present', () => {
    config.get.mockImplementation(
      (key) =>
        ({
          'externalSubmission.enabled': true,
          'externalSubmission.baseUrl': 'https://aims.example.gov.uk',
          'externalSubmission.accessCode': 'secret-token'
        })[key]
    )

    const result = checkExternalSubmissionHealth()

    expect(result.healthy).toBe(true)
    expect(result.status).toBe('configured')
  })

  test('Should return misconfigured when enabled but baseUrl is missing', () => {
    config.get.mockImplementation(
      (key) =>
        ({
          'externalSubmission.enabled': true,
          'externalSubmission.baseUrl': null,
          'externalSubmission.accessCode': 'secret-token'
        })[key]
    )

    const result = checkExternalSubmissionHealth()

    expect(result.healthy).toBe(false)
    expect(result.status).toBe('misconfigured')
    expect(result.error).toMatch(/baseUrl or accessCode/)
  })

  test('Should return misconfigured when enabled but accessCode is missing', () => {
    config.get.mockImplementation(
      (key) =>
        ({
          'externalSubmission.enabled': true,
          'externalSubmission.baseUrl': 'https://aims.example.gov.uk',
          'externalSubmission.accessCode': ''
        })[key]
    )

    const result = checkExternalSubmissionHealth()

    expect(result.healthy).toBe(false)
    expect(result.status).toBe('misconfigured')
  })

  test('Should return misconfigured when both baseUrl and accessCode are missing', () => {
    config.get.mockImplementation(
      (key) =>
        ({
          'externalSubmission.enabled': true,
          'externalSubmission.baseUrl': null,
          'externalSubmission.accessCode': ''
        })[key]
    )

    const result = checkExternalSubmissionHealth()

    expect(result.healthy).toBe(false)
    expect(result.status).toBe('misconfigured')
  })

  test('Should be synchronous — returns a plain object not a Promise', () => {
    config.get.mockImplementation((key) =>
      key === 'externalSubmission.enabled' ? false : null
    )

    const result = checkExternalSubmissionHealth()

    expect(result).not.toBeInstanceOf(Promise)
    expect(result).toBeTypeOf('object')
  })
})
