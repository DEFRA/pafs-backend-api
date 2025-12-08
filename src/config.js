import convict from 'convict'
import convictFormatWithValidator from 'convict-format-with-validator'

convict.addFormats(convictFormatWithValidator)

const isProduction = process.env.NODE_ENV === 'production'
const isTest = process.env.NODE_ENV === 'test'

const config = convict({
  serviceVersion: {
    doc: 'The service version, this variable is injected into your docker container in CDP environments',
    format: String,
    nullable: true,
    default: null,
    env: 'SERVICE_VERSION'
  },
  host: {
    doc: 'The IP address to bind',
    format: 'ipaddress',
    default: '0.0.0.0',
    env: 'HOST'
  },
  port: {
    doc: 'The port to bind',
    format: 'port',
    default: 3001,
    env: 'PORT'
  },
  serviceName: {
    doc: 'Api Service Name',
    format: String,
    default: 'pafs-backend-api'
  },
  cdpEnvironment: {
    doc: 'The CDP environment the app is running in. With the addition of "local" for local development',
    format: [
      'local',
      'infra-dev',
      'management',
      'dev',
      'test',
      'perf-test',
      'ext-test',
      'prod'
    ],
    default: 'local',
    env: 'ENVIRONMENT'
  },
  awsRegion: {
    doc: 'AWS region for RDS and other AWS services',
    format: String,
    default: 'eu-west-2',
    env: 'AWS_REGION'
  },
  log: {
    isEnabled: {
      doc: 'Is logging enabled',
      format: Boolean,
      default: !isTest,
      env: 'LOG_ENABLED'
    },
    level: {
      doc: 'Logging level',
      format: ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'],
      default: 'info',
      env: 'LOG_LEVEL'
    },
    format: {
      doc: 'Format to output logs in',
      format: ['ecs', 'pino-pretty'],
      default: isProduction ? 'ecs' : 'pino-pretty',
      env: 'LOG_FORMAT'
    },
    redact: {
      doc: 'Log paths to redact',
      format: Array,
      default: isProduction
        ? ['req.headers.authorization', 'req.headers.cookie', 'res.headers']
        : ['req', 'res', 'responseTime']
    }
  },
  postgres: {
    host: {
      doc: 'PostgreSQL database host',
      format: String,
      default: '127.0.0.1',
      env: 'DB_HOST'
    },
    port: {
      doc: 'PostgreSQL database port',
      format: 'port',
      default: 5432,
      env: 'DB_PORT'
    },
    database: {
      doc: 'PostgreSQL database name',
      format: String,
      default: 'pafs',
      env: 'DB_DATABASE'
    },
    username: {
      doc: 'PostgreSQL username',
      format: String,
      default: 'postgres',
      env: 'DB_USERNAME'
    },
    password: {
      doc: 'PostgreSQL password (only used for local development, not with IAM auth)',
      format: String,
      default: 'postgres',
      sensitive: true,
      env: 'DB_PASSWORD'
    },
    useIamAuth: {
      doc: 'Use AWS IAM authentication with short-lived tokens (auto-enabled in production)',
      format: Boolean,
      default: isProduction,
      env: 'DB_USE_IAM_AUTHENTICATION'
    },
    pool: {
      max: {
        doc: 'Maximum number of connections in pool',
        format: 'nat',
        default: 10,
        env: 'POSTGRES_POOL_MAX'
      },
      maxLifetimeSeconds: {
        doc: 'Maximum lifetime of a connection in seconds (important for IAM token refresh)',
        format: 'nat',
        default: 10 * 60,
        env: 'POSTGRES_POOL_MAX_LIFETIME'
      }
    }
  },
  auth: {
    jwt: {
      accessSecret: {
        doc: 'JWT access token secret key',
        format: String,
        default: 'changeme-access-secret-key-for-development',
        sensitive: true,
        env: 'JWT_ACCESS_SECRET'
      },
      refreshSecret: {
        doc: 'JWT refresh token secret key',
        format: String,
        default: 'changeme-refresh-secret-key-for-development',
        sensitive: true,
        env: 'JWT_REFRESH_SECRET'
      },
      accessExpiresIn: {
        doc: 'Access token expiration time',
        format: String,
        default: '15m',
        env: 'JWT_ACCESS_EXPIRES_IN'
      },
      refreshExpiresIn: {
        doc: 'Refresh token expiration time',
        format: String,
        default: '7d',
        env: 'JWT_REFRESH_EXPIRES_IN'
      },
      issuer: {
        doc: 'JWT token issuer',
        format: String,
        default: '',
        env: 'JWT_ISSUER'
      },
      audience: {
        doc: 'JWT token audience',
        format: String,
        default: '',
        env: 'JWT_AUDIENCE'
      }
    },
    accountLocking: {
      enabled: {
        doc: 'Enable account locking after failed attempts',
        format: Boolean,
        default: true,
        env: 'AUTH_ACCOUNT_LOCKING_ENABLED'
      },
      maxAttempts: {
        doc: 'Maximum failed login attempts before locking',
        format: 'nat',
        default: 5,
        env: 'AUTH_MAX_ATTEMPTS'
      },
      lockDuration: {
        doc: 'Account lock duration in minutes',
        format: 'nat',
        default: 30,
        env: 'AUTH_LOCK_DURATION'
      }
    },
    accountDisabling: {
      enabled: {
        doc: 'Enable automatic account disabling after inactivity',
        format: Boolean,
        default: true,
        env: 'AUTH_ACCOUNT_DISABLING_ENABLED'
      },
      inactivityDays: {
        doc: 'Days of inactivity before account is disabled',
        format: 'nat',
        default: 90,
        env: 'AUTH_INACTIVITY_DAYS'
      }
    },
    passwordReset: {
      tokenExpiryHours: {
        doc: 'Password reset token expiry time in hours',
        format: 'nat',
        default: 6,
        env: 'AUTH_PASSWORD_RESET_EXPIRY_HOURS'
      }
    },
    invitation: {
      tokenExpiryHours: {
        doc: 'Invitation token expiry time in hours',
        format: 'nat',
        default: 720,
        env: 'AUTH_INVITATION_EXPIRY_HOURS'
      }
    },
    passwordHistory: {
      enabled: {
        doc: 'Enable password history check to prevent reuse of recent passwords',
        format: Boolean,
        default: true,
        env: 'AUTH_PASSWORD_HISTORY_ENABLED'
      },
      limit: {
        doc: 'Number of previous passwords to check against',
        format: 'nat',
        default: 5,
        env: 'AUTH_PASSWORD_HISTORY_LIMIT'
      }
    }
  },
  frontendUrl: {
    doc: 'Frontend application URL for password reset links',
    format: 'url',
    default: 'http://localhost:3000',
    env: 'FRONTEND_URL'
  },
  notify: {
    enabled: {
      doc: 'Enable the GOV.UK Notify',
      format: Boolean,
      default: true,
      env: 'NOTIFY_ENABLED'
    },
    apiKey: {
      doc: 'GOV.UK Notify API key',
      format: String,
      default: 'test-api-key',
      sensitive: true,
      env: 'NOTIFY_API_KEY'
    },
    templatePasswordReset: {
      doc: 'GOV.UK Notify template ID for password reset emails',
      format: String,
      default: 'password-reset-template-id',
      env: 'NOTIFY_TEMPLATE_PASSWORD_RESET'
    },
    templateAccountVerification: {
      doc: 'GOV.UK Notify template ID for account verification emails',
      format: String,
      default: 'account-verification-template-id',
      env: 'NOTIFY_TEMPLATE_ACCOUNT_VERIFICATION'
    },
    templateAccountApprovedSetPassword: {
      doc: 'GOV.UK Notify template ID for auto-approved accounts',
      format: String,
      default: 'auto-approved-template-id',
      env: 'NOTIFY_TEMPLATE_ACCOUNT_APPROVED_SET_PASSWORD'
    },
    templateAccountApprovedToAdmin: {
      doc: 'GOV.UK Notify template ID for account approval emails',
      format: String,
      default: 'account-approved-template-id',
      env: 'NOTIFY_TEMPLATE_AUTO_APPROVED_TO_ADMIN'
    },
    adminEmail: {
      doc: 'GOV.UK Notify admin email address',
      format: String,
      default: '',
      env: 'NOTIFY_ADMIN_EMAIL'
    }
  },
  httpProxy: {
    doc: 'HTTP Proxy URL',
    format: String,
    nullable: true,
    default: null,
    env: 'HTTP_PROXY'
  },
  isMetricsEnabled: {
    doc: 'Enable metrics reporting',
    format: Boolean,
    default: isProduction,
    env: 'ENABLE_METRICS'
  },
  tracing: {
    header: {
      doc: 'CDP tracing header name',
      format: String,
      default: 'x-cdp-request-id',
      env: 'TRACING_HEADER'
    }
  },
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
      default: 100,
      env: 'PAGINATION_MAX_PAGE_SIZE'
    }
  }
})

config.validate({ allowed: 'strict' })

export { config }
