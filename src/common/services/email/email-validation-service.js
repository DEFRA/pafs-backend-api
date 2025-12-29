import MailChecker from 'mailchecker'
import { promises as dns } from 'dns'
import {
  ACCOUNT_VALIDATION_CODES,
  AUTH_VALIDATION_CODES
} from '../../constants/index.js'

/**
 * Email validation service
 * Provides reusable email validation checks:
 * - Disposable email detection
 * - DNS MX record verification
 * - Duplicate email checking
 */
export class EmailValidationService {
  constructor(prisma, config, logger) {
    this.prisma = prisma
    this.config = config
    this.logger = logger
  }

  /**
   * Comprehensive email validation
   * @param {string} email - Email address to validate
   * @param {Object} options - Validation options
   * @param {boolean} options.checkDisposable - Check if email is disposable
   * @param {boolean} options.checkDnsMx - Check DNS MX records
   * @param {boolean} options.checkDuplicate - Check if email already exists
   * @param {number} options.excludeUserId - User ID to exclude from duplicate check (for updates)
   * @returns {Promise<Object>} Validation result with isValid flag and errors array
   */
  async validateEmail(email, options = {}) {
    const {
      checkDisposable = this.config.get('emailValidation.checkDisposable'),
      checkDnsMx = this.config.get('emailValidation.checkDnsMx'),
      checkDuplicate = this.config.get('emailValidation.checkDuplicate'),
      excludeUserId = null
    } = options

    const errors = []
    const warnings = []

    // Check 1: Disposable email detection
    if (checkDisposable) {
      const disposableCheck = this.checkDisposableEmail(email)
      if (!disposableCheck.isValid) {
        errors.push({
          errorCode: disposableCheck.errorCode,
          message: disposableCheck.message,
          field: 'email'
        })
      }
    }

    // Check 2: DNS MX record validation
    if (checkDnsMx && errors.length === 0) {
      const dnsMxCheck = await this.checkDnsMxRecords(email)
      if (!dnsMxCheck.isValid) {
        errors.push({
          errorCode: dnsMxCheck.errorCode,
          message: dnsMxCheck.message,
          field: 'email'
        })
      }
    }

    // Check 3: Duplicate email check
    if (checkDuplicate && errors.length === 0) {
      const duplicateCheck = await this.checkDuplicateEmail(
        email,
        excludeUserId
      )
      if (!duplicateCheck.isValid) {
        errors.push({
          errorCode: duplicateCheck.errorCode,
          message: duplicateCheck.message,
          field: 'email'
        })
      }
    }

    const isValid = errors.length === 0

    this.logger.info(
      { email: this.maskEmail(email), isValid, errorCount: errors.length },
      'Email validation completed'
    )

    return {
      isValid,
      email,
      errors,
      warnings,
      checks: {
        disposable: checkDisposable,
        dnsMx: checkDnsMx,
        duplicate: checkDuplicate
      }
    }
  }

  /**
   * Check if email is from a disposable email service
   * @param {string} email - Email address to check
   * @returns {Object} Validation result
   */
  checkDisposableEmail(email) {
    try {
      const isValid = MailChecker.isValid(email)

      if (!isValid) {
        this.logger.warn(
          { email: this.maskEmail(email) },
          'Disposable email detected'
        )
        return {
          isValid: false,
          errorCode: ACCOUNT_VALIDATION_CODES.EMAIL_DISPOSABLE,
          message: 'Disposable email addresses are not allowed'
        }
      }

      return { isValid: true }
    } catch (error) {
      this.logger.error(
        { error, email: this.maskEmail(email) },
        'Error checking disposable email'
      )
      // On error, allow the email through (fail open)
      return { isValid: true }
    }
  }

  /**
   * Verify domain has valid MX records
   * @param {string} email - Email address to check
   * @returns {Promise<Object>} Validation result
   */
  async checkDnsMxRecords(email) {
    try {
      const domain = email.split('@')[1]

      if (!domain) {
        return {
          isValid: false,
          errorCode: AUTH_VALIDATION_CODES.EMAIL_INVALID_FORMAT,
          message: 'Invalid email format'
        }
      }

      const mxRecords = await dns.resolveMx(domain)

      if (!mxRecords || mxRecords.length === 0) {
        this.logger.warn({ domain }, 'No MX records found for domain')
        return {
          isValid: false,
          errorCode: ACCOUNT_VALIDATION_CODES.EMAIL_DOMAIN_INVALID,
          message: 'Email domain does not have valid mail servers'
        }
      }

      return { isValid: true, mxRecords }
    } catch (error) {
      this.logger.warn(
        { error: error.message, email: this.maskEmail(email) },
        'DNS MX lookup failed'
      )
      return {
        isValid: false,
        errorCode: ACCOUNT_VALIDATION_CODES.EMAIL_DOMAIN_INVALID,
        message: 'Email domain does not exist or cannot receive emails'
      }
    }
  }

  /**
   * Check if email already exists in database
   * @param {string} email - Email address to check
   * @param {number} excludeUserId - User ID to exclude from check (for updates)
   * @returns {Promise<Object>} Validation result
   */
  async checkDuplicateEmail(email, excludeUserId = null) {
    try {
      const where = {
        email: email.toLowerCase().trim()
      }

      // Exclude specific user ID (useful for updates)
      if (excludeUserId) {
        where.id = { not: BigInt(excludeUserId) }
      }

      const existingUser = await this.prisma.pafs_core_users.findFirst({
        where,
        select: { id: true, email: true }
      })

      if (existingUser) {
        this.logger.warn(
          { email: this.maskEmail(email), excludeUserId },
          'Duplicate email found'
        )
        return {
          isValid: false,
          errorCode: ACCOUNT_VALIDATION_CODES.EMAIL_DUPLICATE,
          message: 'An account with this email address already exists'
        }
      }

      return { isValid: true }
    } catch (error) {
      this.logger.error(
        { error, email: this.maskEmail(email) },
        'Error checking duplicate email'
      )
      // On error, fail closed (reject the email)
      return {
        isValid: false,
        errorCode: ACCOUNT_VALIDATION_CODES.EMAIL_DUPLICATE,
        message: 'Unable to verify email uniqueness'
      }
    }
  }

  /**
   * Mask email for logging (privacy)
   * @param {string} email - Email to mask
   * @returns {string} Masked email
   */
  maskEmail(email) {
    if (!email || !email.includes('@')) return '***'
    const [localPart, domain] = email.split('@')
    const maskedLocal =
      localPart.length > 2
        ? `${localPart[0]}***${localPart[localPart.length - 1]}`
        : '***'
    return `${maskedLocal}@${domain}`
  }
}
