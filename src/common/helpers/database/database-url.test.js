import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { buildDatabaseUrl } from './database-url.js'

describe('buildDatabaseUrl', () => {
  let originalEnv

  beforeEach(() => {
    originalEnv = { ...process.env }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('builds URL from environment variables', () => {
    process.env.DB_HOST = 'db.example.com'
    process.env.DB_PORT = '5433'
    process.env.DB_DATABASE = 'test_db'
    process.env.DB_USERNAME = 'testuser'
    process.env.DB_PASSWORD = 'testpass'

    const url = buildDatabaseUrl()

    expect(url).toBe(
      'postgresql://testuser:testpass@db.example.com:5433/test_db?schema=public'
    )
  })

  it('uses default values when environment variables are not set', () => {
    delete process.env.DB_HOST
    delete process.env.DB_PORT
    delete process.env.DB_DATABASE
    delete process.env.DB_USERNAME
    delete process.env.DB_PASSWORD

    const url = buildDatabaseUrl()

    expect(url).toBe(
      'postgresql://postgres:pgadmin@127.0.0.1:5432/pafs_backend_api?schema=public'
    )
  })

  it('accepts options that override environment variables', () => {
    process.env.DB_HOST = 'env.example.com'
    process.env.DB_PORT = '5432'

    const url = buildDatabaseUrl({
      host: 'override.example.com',
      port: '5433',
      database: 'override_db',
      username: 'override_user',
      password: 'override_pass'
    })

    expect(url).toBe(
      'postgresql://override_user:override_pass@override.example.com:5433/override_db?schema=public'
    )
  })

  it('allows custom schema', () => {
    const url = buildDatabaseUrl({
      schema: 'custom_schema'
    })

    expect(url).toContain('?schema=custom_schema')
  })

  it('handles special characters in password', () => {
    const url = buildDatabaseUrl({
      password: 'p@ssw0rd!#$'
    })

    expect(url).toContain('p@ssw0rd!#$')
  })

  it('uses environment variables with partial options override', () => {
    process.env.DB_HOST = 'db.example.com'
    process.env.DB_PORT = '5432'
    process.env.DB_DATABASE = 'test_db'
    process.env.DB_USERNAME = 'testuser'
    process.env.DB_PASSWORD = 'testpass'

    const url = buildDatabaseUrl({
      database: 'override_db'
    })

    expect(url).toBe(
      'postgresql://testuser:testpass@db.example.com:5432/override_db?schema=public'
    )
  })
})
