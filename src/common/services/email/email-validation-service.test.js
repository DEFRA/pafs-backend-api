import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EmailValidationService } from './email-validation-service.js'
import {
  ACCOUNT_VALIDATION_CODES,
  AUTH_VALIDATION_CODES
} from '../../constants/index.js'
import MailChecker from 'mailchecker'
import { promises as dns } from 'dns'

// Mock mailchecker
vi.mock('mailchecker', () => ({
  default: {
    isValid: vi.fn()
  }
}))

// Mock dns
vi.mock('dns', () => ({
  promises: {
    resolveMx: vi.fn()
  }
}))

describe('EmailValidationService', () => {
  let service
  let mockPrisma
  let mockConfig
  let mockLogger

  beforeEach(() => {
    mockPrisma = {
      pafs_core_users: {
        findFirst: vi.fn()
      }
    }

    mockConfig = {
      get: vi.fn((key) => {
        const config = {
          'emailValidation.checkDisposable': true,
          'emailValidation.checkDnsMx': true,
          'emailValidation.checkDuplicate': true
        }
        return config[key]
      })
    }

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    }

    service = new EmailValidationService(mockPrisma, mockConfig, mockLogger)

    // Reset mocks
    vi.clearAllMocks()
  })

  describe('validateEmail', () => {
    it('validates email successfully when all checks pass', async () => {
      MailChecker.isValid.mockReturnValue(true)
      dns.resolveMx.mockResolvedValue([{ exchange: 'mail.example.com' }])
      mockPrisma.pafs_core_users.findFirst.mockResolvedValue(null)

      const result = await service.validateEmail('test@example.com')

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
      expect(result.email).toBe('test@example.com')
      expect(mockLogger.info).toHaveBeenCalled()
    })

    it('fails validation when disposable email detected', async () => {
      MailChecker.isValid.mockReturnValue(false)

      const result = await service.validateEmail('test@tempmail.com')

      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toEqual({
        errorCode: ACCOUNT_VALIDATION_CODES.EMAIL_DISPOSABLE,
        message: 'Disposable email addresses are not allowed',
        field: 'email'
      })
      expect(mockLogger.warn).toHaveBeenCalled()
    })

    it('fails validation when DNS MX check fails', async () => {
      MailChecker.isValid.mockReturnValue(true)
      dns.resolveMx.mockRejectedValue(new Error('ENOTFOUND'))

      const result = await service.validateEmail('test@nonexistent.com')

      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].errorCode).toBe(
        ACCOUNT_VALIDATION_CODES.EMAIL_DOMAIN_INVALID
      )
    })

    it('fails validation when duplicate email found', async () => {
      MailChecker.isValid.mockReturnValue(true)
      dns.resolveMx.mockResolvedValue([{ exchange: 'mail.example.com' }])
      mockPrisma.pafs_core_users.findFirst.mockResolvedValue({
        id: 1n,
        email: 'test@example.com'
      })

      const result = await service.validateEmail('test@example.com')

      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].errorCode).toBe(
        ACCOUNT_VALIDATION_CODES.EMAIL_DUPLICATE
      )
    })

    it('skips checks based on options', async () => {
      MailChecker.isValid.mockReturnValue(false)

      const result = await service.validateEmail('test@tempmail.com', {
        checkDisposable: false,
        checkDnsMx: false,
        checkDuplicate: false
      })

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
      expect(MailChecker.isValid).not.toHaveBeenCalled()
      expect(dns.resolveMx).not.toHaveBeenCalled()
      expect(mockPrisma.pafs_core_users.findFirst).not.toHaveBeenCalled()
    })

    it('skips subsequent checks after first failure', async () => {
      MailChecker.isValid.mockReturnValue(false)

      const result = await service.validateEmail('test@tempmail.com')

      expect(result.isValid).toBe(false)
      expect(dns.resolveMx).not.toHaveBeenCalled()
      expect(mockPrisma.pafs_core_users.findFirst).not.toHaveBeenCalled()
    })

    it('excludes user ID from duplicate check', async () => {
      MailChecker.isValid.mockReturnValue(true)
      dns.resolveMx.mockResolvedValue([{ exchange: 'mail.example.com' }])
      mockPrisma.pafs_core_users.findFirst.mockResolvedValue(null)

      await service.validateEmail('test@example.com', {
        excludeUserId: 123
      })

      expect(mockPrisma.pafs_core_users.findFirst).toHaveBeenCalledWith({
        where: {
          email: 'test@example.com',
          id: { not: 123n }
        },
        select: { id: true, email: true }
      })
    })

    it('returns check configuration', async () => {
      MailChecker.isValid.mockReturnValue(true)
      dns.resolveMx.mockResolvedValue([{ exchange: 'mail.example.com' }])
      mockPrisma.pafs_core_users.findFirst.mockResolvedValue(null)

      const result = await service.validateEmail('test@example.com', {
        checkDisposable: true,
        checkDnsMx: false,
        checkDuplicate: true
      })

      expect(result.checks).toEqual({
        disposable: true,
        dnsMx: false,
        duplicate: true
      })
    })
  })

  describe('checkDisposableEmail', () => {
    it('returns valid for legitimate email', () => {
      MailChecker.isValid.mockReturnValue(true)

      const result = service.checkDisposableEmail('test@gmail.com')

      expect(result.isValid).toBe(true)
      expect(result).not.toHaveProperty('errorCode')
    })

    it('returns invalid for disposable email', () => {
      MailChecker.isValid.mockReturnValue(false)

      const result = service.checkDisposableEmail('test@tempmail.com')

      expect(result.isValid).toBe(false)
      expect(result.errorCode).toBe(ACCOUNT_VALIDATION_CODES.EMAIL_DISPOSABLE)
      expect(result.message).toBe('Disposable email addresses are not allowed')
      expect(mockLogger.warn).toHaveBeenCalled()
    })

    it('fails open on error', () => {
      MailChecker.isValid.mockImplementation(() => {
        throw new Error('MailChecker error')
      })

      const result = service.checkDisposableEmail('test@example.com')

      expect(result.isValid).toBe(true)
      expect(mockLogger.error).toHaveBeenCalled()
    })
  })

  describe('checkDnsMxRecords', () => {
    it('returns valid when MX records exist', async () => {
      dns.resolveMx.mockResolvedValue([
        { exchange: 'mail1.example.com', priority: 10 },
        { exchange: 'mail2.example.com', priority: 20 }
      ])

      const result = await service.checkDnsMxRecords('test@example.com')

      expect(result.isValid).toBe(true)
      expect(result.mxRecords).toHaveLength(2)
    })

    it('returns invalid when no MX records found', async () => {
      dns.resolveMx.mockResolvedValue([])

      const result = await service.checkDnsMxRecords('test@example.com')

      expect(result.isValid).toBe(false)
      expect(result.errorCode).toBe(
        ACCOUNT_VALIDATION_CODES.EMAIL_DOMAIN_INVALID
      )
      expect(result.message).toBe(
        'Email domain does not have valid mail servers'
      )
      expect(mockLogger.warn).toHaveBeenCalled()
    })

    it('returns invalid for malformed email', async () => {
      const result = await service.checkDnsMxRecords('notanemail')

      expect(result.isValid).toBe(false)
      expect(result.errorCode).toBe(AUTH_VALIDATION_CODES.EMAIL_INVALID_FORMAT)
      expect(result.message).toBe('Invalid email format')
    })

    it('handles DNS resolution errors', async () => {
      dns.resolveMx.mockRejectedValue(new Error('ENOTFOUND'))

      const result = await service.checkDnsMxRecords('test@nonexistent.com')

      expect(result.isValid).toBe(false)
      expect(result.errorCode).toBe(
        ACCOUNT_VALIDATION_CODES.EMAIL_DOMAIN_INVALID
      )
      expect(mockLogger.warn).toHaveBeenCalled()
    })

    it('handles ENODATA error', async () => {
      const error = new Error('queryMx ENODATA')
      dns.resolveMx.mockRejectedValue(error)

      const result = await service.checkDnsMxRecords('test@example.com')

      expect(result.isValid).toBe(false)
    })
  })

  describe('checkDuplicateEmail', () => {
    it('returns valid when email not found', async () => {
      mockPrisma.pafs_core_users.findFirst.mockResolvedValue(null)

      const result = await service.checkDuplicateEmail('test@example.com')

      expect(result.isValid).toBe(true)
    })

    it('returns invalid when email exists', async () => {
      mockPrisma.pafs_core_users.findFirst.mockResolvedValue({
        id: 1n,
        email: 'test@example.com'
      })

      const result = await service.checkDuplicateEmail('test@example.com')

      expect(result.isValid).toBe(false)
      expect(result.errorCode).toBe(ACCOUNT_VALIDATION_CODES.EMAIL_DUPLICATE)
      expect(result.message).toBe(
        'An account with this email address already exists'
      )
      expect(mockLogger.warn).toHaveBeenCalled()
    })

    it('excludes user ID from check', async () => {
      mockPrisma.pafs_core_users.findFirst.mockResolvedValue(null)

      await service.checkDuplicateEmail('test@example.com', 123)

      expect(mockPrisma.pafs_core_users.findFirst).toHaveBeenCalledWith({
        where: {
          email: 'test@example.com',
          id: { not: 123n }
        },
        select: { id: true, email: true }
      })
    })

    it('normalizes email (lowercase and trim)', async () => {
      mockPrisma.pafs_core_users.findFirst.mockResolvedValue(null)

      await service.checkDuplicateEmail('  Test@Example.COM  ')

      expect(mockPrisma.pafs_core_users.findFirst).toHaveBeenCalledWith({
        where: {
          email: 'test@example.com'
        },
        select: { id: true, email: true }
      })
    })

    it('fails closed on database error', async () => {
      mockPrisma.pafs_core_users.findFirst.mockRejectedValue(
        new Error('Database error')
      )

      const result = await service.checkDuplicateEmail('test@example.com')

      expect(result.isValid).toBe(false)
      expect(result.errorCode).toBe(ACCOUNT_VALIDATION_CODES.EMAIL_DUPLICATE)
      expect(result.message).toBe('Unable to verify email uniqueness')
      expect(mockLogger.error).toHaveBeenCalled()
    })
  })

  describe('maskEmail', () => {
    it('masks short emails', () => {
      expect(service.maskEmail('ab@example.com')).toBe('***@example.com')
    })

    it('masks normal emails', () => {
      expect(service.maskEmail('john@example.com')).toBe('j***n@example.com')
      expect(service.maskEmail('test@example.com')).toBe('t***t@example.com')
    })

    it('masks long emails', () => {
      expect(service.maskEmail('verylongemail@example.com')).toBe(
        'v***l@example.com'
      )
    })

    it('handles invalid emails', () => {
      expect(service.maskEmail('notanemail')).toBe('***')
      expect(service.maskEmail('')).toBe('***')
      expect(service.maskEmail(null)).toBe('***')
      expect(service.maskEmail(undefined)).toBe('***')
    })

    it('preserves domain', () => {
      expect(service.maskEmail('user@subdomain.example.com')).toBe(
        'u***r@subdomain.example.com'
      )
    })
  })

  describe('Error handling', () => {
    it('logs errors with masked email', async () => {
      mockPrisma.pafs_core_users.findFirst.mockRejectedValue(
        new Error('DB error')
      )

      await service.checkDuplicateEmail('test@example.com')

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 't***t@example.com'
        }),
        expect.any(String)
      )
    })

    it('logs warnings with masked email', () => {
      MailChecker.isValid.mockReturnValue(false)

      service.checkDisposableEmail('disposable@tempmail.com')

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'd***e@tempmail.com'
        }),
        expect.any(String)
      )
    })
  })

  describe('Integration scenarios', () => {
    it('validates email for registration', async () => {
      MailChecker.isValid.mockReturnValue(true)
      dns.resolveMx.mockResolvedValue([{ exchange: 'mail.example.com' }])
      mockPrisma.pafs_core_users.findFirst.mockResolvedValue(null)

      const result = await service.validateEmail('newuser@example.com', {
        checkDisposable: true,
        checkDnsMx: true,
        checkDuplicate: true
      })

      expect(result.isValid).toBe(true)
      expect(MailChecker.isValid).toHaveBeenCalled()
      expect(dns.resolveMx).toHaveBeenCalled()
      expect(mockPrisma.pafs_core_users.findFirst).toHaveBeenCalled()
    })

    it('validates email for update (same user)', async () => {
      MailChecker.isValid.mockReturnValue(true)
      dns.resolveMx.mockResolvedValue([{ exchange: 'mail.example.com' }])
      mockPrisma.pafs_core_users.findFirst.mockResolvedValue(null)

      const result = await service.validateEmail('user@example.com', {
        checkDisposable: true,
        checkDnsMx: true,
        checkDuplicate: true,
        excludeUserId: 123
      })

      expect(result.isValid).toBe(true)
      expect(mockPrisma.pafs_core_users.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { not: 123n }
          })
        })
      )
    })
  })
})
