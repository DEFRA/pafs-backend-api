import { isTest } from './environment.js'

const schedulerSchema = {
  pagination: {
    defaultPageSize: {
      doc: 'Default number of records per page',
      format: 'nat',
      default: 20,
      env: 'PAGINATION_DEFAULT_PAGE_SIZE'
    },
    maxPageSize: {
      doc: 'Maximum allowed records per page',
      format: 'nat',
      default: 10000,
      env: 'PAGINATION_MAX_PAGE_SIZE'
    }
  },
  emailValidation: {
    autoApprovedDomains: {
      doc: 'Auto Approved email Domain',
      format: String,
      default: 'auto-approved-email-domains',
      env: 'AUTO_APPROVED_EMAIL_DOMAINS'
    },
    checkDisposable: {
      doc: 'Enable disposable email domain blocking',
      format: Boolean,
      default: true,
      env: 'EMAIL_VALIDATION_CHECK_DISPOSABLE'
    },
    checkDnsMx: {
      doc: 'Enable DNS MX record verification',
      format: Boolean,
      default: true,
      env: 'EMAIL_VALIDATION_CHECK_DNS_MX'
    },
    checkDuplicate: {
      doc: 'Enable duplicate email checking',
      format: Boolean,
      default: true,
      env: 'EMAIL_VALIDATION_CHECK_DUPLICATE'
    }
  },
  scheduler: {
    enabled: {
      doc: 'Enable scheduled tasks',
      format: Boolean,
      default: !isTest,
      env: 'SCHEDULER_ENABLED'
    },
    lockTimeout: {
      doc: 'Distributed lock timeout in milliseconds',
      format: 'nat',
      default: 300000, // 5 minutes
      env: 'SCHEDULER_LOCK_TIMEOUT'
    },
    lockRefreshInterval: {
      doc: 'How often to refresh the lock in milliseconds',
      format: 'nat',
      default: 60000, // 1 minute
      env: 'SCHEDULER_LOCK_REFRESH_INTERVAL'
    },
    timezone: {
      doc: 'Timezone for scheduled tasks',
      format: String,
      default: 'Europe/London',
      env: 'SCHEDULER_TIMEZONE'
    }
  }
}

export { schedulerSchema }
