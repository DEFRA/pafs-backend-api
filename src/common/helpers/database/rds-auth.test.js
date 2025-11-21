import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateRdsAuthToken } from './rds-auth.js'

vi.mock('@aws-sdk/rds-signer', () => ({
  Signer: vi.fn()
}))

vi.mock('@aws-sdk/credential-providers', () => ({
  fromNodeProviderChain: vi.fn()
}))

describe('generateRdsAuthToken', () => {
  let mockGetAuthToken
  let MockSigner

  beforeEach(async () => {
    vi.clearAllMocks()

    mockGetAuthToken = vi.fn().mockResolvedValue('mock-auth-token-12345')

    const { Signer } = await import('@aws-sdk/rds-signer')
    MockSigner = Signer
    MockSigner.mockImplementation(function (config) {
      this.config = config
      this.getAuthToken = mockGetAuthToken
    })
  })

  it('generates RDS IAM auth token', async () => {
    const config = {
      host: 'my-rds.amazonaws.com',
      port: 5432,
      username: 'dbuser',
      awsRegion: 'eu-west-2'
    }

    const token = await generateRdsAuthToken(config)

    expect(token).toBe('mock-auth-token-12345')
    expect(mockGetAuthToken).toHaveBeenCalledOnce()
  })

  it('creates Signer with correct configuration', async () => {
    const { fromNodeProviderChain } = await import(
      '@aws-sdk/credential-providers'
    )
    fromNodeProviderChain.mockReturnValue('mock-credentials')

    const config = {
      host: 'prod-db.rds.amazonaws.com',
      port: 5433,
      username: 'admin',
      awsRegion: 'us-east-1'
    }

    await generateRdsAuthToken(config)

    expect(MockSigner).toHaveBeenCalledWith({
      hostname: 'prod-db.rds.amazonaws.com',
      port: 5433,
      region: 'us-east-1',
      username: 'admin',
      credentials: 'mock-credentials'
    })
  })

  it('uses credential provider chain', async () => {
    const { fromNodeProviderChain } = await import(
      '@aws-sdk/credential-providers'
    )

    const config = {
      host: 'db.amazonaws.com',
      port: 5432,
      username: 'user',
      awsRegion: 'ap-south-1'
    }

    await generateRdsAuthToken(config)

    expect(fromNodeProviderChain).toHaveBeenCalled()
  })

  it('handles token generation errors', async () => {
    mockGetAuthToken.mockRejectedValueOnce(
      new Error('AWS credentials not found')
    )

    const config = {
      host: 'db.amazonaws.com',
      port: 5432,
      username: 'user',
      awsRegion: 'eu-west-1'
    }

    await expect(generateRdsAuthToken(config)).rejects.toThrow(
      'AWS credentials not found'
    )
  })

  it('generates different tokens for different configurations', async () => {
    mockGetAuthToken
      .mockResolvedValueOnce('token-for-db1')
      .mockResolvedValueOnce('token-for-db2')

    const config1 = {
      host: 'db1.amazonaws.com',
      port: 5432,
      username: 'user1',
      awsRegion: 'eu-west-1'
    }

    const config2 = {
      host: 'db2.amazonaws.com',
      port: 5432,
      username: 'user2',
      awsRegion: 'us-west-2'
    }

    const token1 = await generateRdsAuthToken(config1)
    const token2 = await generateRdsAuthToken(config2)

    expect(token1).toBe('token-for-db1')
    expect(token2).toBe('token-for-db2')
    expect(mockGetAuthToken).toHaveBeenCalledTimes(2)
  })
})
