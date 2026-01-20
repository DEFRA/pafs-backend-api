import { describe, it, expect } from 'vitest'
import {
  extractDomain,
  domainMatches,
  isApprovedDomain
} from './email-auto-approved.js'

describe('extractDomain', () => {
  it('should extract domain from email address', () => {
    expect(extractDomain('user@example.com')).toBe('example.com')
  })

  it('should extract domain and convert to lowercase', () => {
    expect(extractDomain('user@EXAMPLE.COM')).toBe('example.com')
  })

  it('should handle email with mixed case', () => {
    expect(extractDomain('User@Example.Com')).toBe('example.com')
  })

  it('should return domain if domain is provided directly', () => {
    expect(extractDomain('example.com')).toBe('example.com')
  })

  it('should trim whitespace from input', () => {
    expect(extractDomain('  user@example.com  ')).toBe('example.com')
  })

  it('should handle multiple @ symbols and use the last one', () => {
    expect(extractDomain('user+tag@email@example.com')).toBe('example.com')
  })

  it('should handle no @ symbol', () => {
    expect(extractDomain('example.com')).toBe('example.com')
  })

  it('should convert non-string input to string', () => {
    expect(extractDomain(123)).toBe('123')
  })

  it('should handle empty string', () => {
    expect(extractDomain('')).toBe('')
  })

  it('should handle subdomain', () => {
    expect(extractDomain('user@mail.example.com')).toBe('mail.example.com')
  })

  it('should handle subdomain with multiple levels', () => {
    expect(extractDomain('user@mail.corp.example.com')).toBe('mail.corp.example.com')
  })

  it('should handle email with numbers and hyphens', () => {
    expect(extractDomain('user-123@mail-server.example-domain.com')).toBe(
      'mail-server.example-domain.com'
    )
  })
})

describe('domainMatches', () => {
  it('should match exact domain names', () => {
    expect(domainMatches('example.com', 'example.com')).toBe(true)
  })

  it('should match exact domain names with different cases', () => {
    expect(domainMatches('EXAMPLE.COM', 'example.com')).toBe(true)
  })

  it('should match mixed case domains', () => {
    expect(domainMatches('Example.Com', 'EXAMPLE.COM')).toBe(true)
  })

  it('should match subdomain to parent domain', () => {
    expect(domainMatches('mail.example.com', 'example.com')).toBe(true)
  })

  it('should match multiple level subdomain to parent domain', () => {
    expect(domainMatches('mail.corp.example.com', 'example.com')).toBe(true)
  })

  it('should not match partial domain names', () => {
    expect(domainMatches('notexample.com', 'example.com')).toBe(false)
  })

  it('should not match when subdomain does not end with parent domain', () => {
    expect(domainMatches('example2.com', 'example.com')).toBe(false)
  })

  it('should not match when needle is parent of approved', () => {
    expect(domainMatches('example.com', 'mail.example.com')).toBe(false)
  })

  it('should handle domains with numbers', () => {
    expect(domainMatches('test123.example.com', 'example.com')).toBe(true)
  })

  it('should handle domains with hyphens', () => {
    expect(domainMatches('test-server.example-domain.com', 'example-domain.com')).toBe(true)
  })

  it('should not match similar domain names', () => {
    expect(domainMatches('example.com', 'examplexxx.com')).toBe(false)
  })

  it('should not match if not a subdomain', () => {
    expect(domainMatches('different.com', 'example.com')).toBe(false)
  })
})

describe('isApprovedDomain', () => {
  it('should return true if email domain is in approved domains list', () => {
    const approvedDomains = ['example.com', 'test.com']
    expect(isApprovedDomain('user@example.com', approvedDomains)).toBe(true)
  })

  it('should return true for any approved domain in the list', () => {
    const approvedDomains = ['example.com', 'test.com', 'company.com']
    expect(isApprovedDomain('user@test.com', approvedDomains)).toBe(true)
  })

  it('should return true if subdomain matches approved domain', () => {
    const approvedDomains = ['example.com']
    expect(isApprovedDomain('user@mail.example.com', approvedDomains)).toBe(true)
  })

  it('should return true if multiple level subdomain matches', () => {
    const approvedDomains = ['example.com']
    expect(isApprovedDomain('user@internal.mail.example.com', approvedDomains)).toBe(true)
  })

  it('should return false if domain is not in approved list', () => {
    const approvedDomains = ['example.com', 'test.com']
    expect(isApprovedDomain('user@notapproved.com', approvedDomains)).toBe(false)
  })

  it('should return false for empty approved domains list', () => {
    expect(isApprovedDomain('user@example.com', [])).toBe(false)
  })

  it('should handle domain passed directly instead of email', () => {
    const approvedDomains = ['example.com']
    expect(isApprovedDomain('example.com', approvedDomains)).toBe(true)
  })

  it('should handle subdomain passed directly', () => {
    const approvedDomains = ['example.com']
    expect(isApprovedDomain('mail.example.com', approvedDomains)).toBe(true)
  })

  it('should handle case insensitivity', () => {
    const approvedDomains = ['EXAMPLE.COM']
    expect(isApprovedDomain('user@example.com', approvedDomains)).toBe(true)
  })

  it('should handle mixed case in both email and approved domains', () => {
    const approvedDomains = ['Example.Com', 'Test.Com']
    expect(isApprovedDomain('User@EXAMPLE.COM', approvedDomains)).toBe(true)
  })

  it('should work with multiple approved domains', () => {
    const approvedDomains = ['example.com', 'test.com', 'company.org']
    expect(isApprovedDomain('user@company.org', approvedDomains)).toBe(true)
  })

  it('should return true for multiple level subdomains', () => {
    const approvedDomains = ['example.com']
    expect(isApprovedDomain('user@a.b.c.example.com', approvedDomains)).toBe(true)
  })

  it('should not match partial domains', () => {
    const approvedDomains = ['example.com']
    expect(isApprovedDomain('user@notexample.com', approvedDomains)).toBe(false)
  })

  it('should not match parent domain when subdomain is approved', () => {
    const approvedDomains = ['mail.example.com']
    expect(isApprovedDomain('user@example.com', approvedDomains)).toBe(false)
  })

  it('should handle whitespace in email', () => {
    const approvedDomains = ['example.com']
    expect(isApprovedDomain('  user@example.com  ', approvedDomains)).toBe(true)
  })

  it('should handle numbers in approved domains', () => {
    const approvedDomains = ['example123.com']
    expect(isApprovedDomain('user@example123.com', approvedDomains)).toBe(true)
  })

  it('should handle hyphens in approved domains', () => {
    const approvedDomains = ['example-domain.com']
    expect(isApprovedDomain('user@sub.example-domain.com', approvedDomains)).toBe(true)
  })
})
