const authSchema = {
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
      inactivityWarningDays: {
        doc: 'Days of inactivity before sending warning email (335 days)',
        format: 'nat',
        default: 335,
        env: 'AUTH_ACCOUNT_DISABLING_WARNING_DAYS'
      },
      inactivityDays: {
        doc: 'Days of inactivity before account is disabled (365 days = 335 + 30)',
        format: 'nat',
        default: 365,
        env: 'AUTH_ACCOUNT_DISABLING_INACTIVITY_DAYS'
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
  }
}

export { authSchema }
