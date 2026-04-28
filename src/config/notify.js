const notifySchema = {
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
    templateAccountInactivityWarning: {
      doc: 'GOV.UK Notify template ID for account inactivity warning (335 days)',
      format: String,
      default: 'account-inactivity-warning-template-id',
      env: 'NOTIFY_TEMPLATE_ACCOUNT_INACTIVITY_WARNING'
    },
    templateAccountReactivated: {
      doc: 'GOV.UK Notify template ID for account reactivation notification',
      format: String,
      default: 'account-reactivated-template-id',
      env: 'NOTIFY_TEMPLATE_ACCOUNT_REACTIVATED'
    },
    adminEmail: {
      doc: 'GOV.UK Notify admin email address',
      format: String,
      default: '',
      env: 'NOTIFY_ADMIN_EMAIL'
    },
    templateProgrammeDownloadComplete: {
      doc: 'GOV.UK Notify template ID for area programme download completion notification',
      format: String,
      default: 'programme-download-complete-template-id',
      env: 'NOTIFY_TEMPLATE_PROGRAMME_DOWNLOAD_COMPLETE'
    },
    templateProgrammeDownloadFailed: {
      doc: 'GOV.UK Notify template ID for area programme download failure notification',
      format: String,
      default: 'programme-download-failed-template-id',
      env: 'NOTIFY_TEMPLATE_PROGRAMME_DOWNLOAD_FAILED'
    }
  }
}

export { notifySchema }
