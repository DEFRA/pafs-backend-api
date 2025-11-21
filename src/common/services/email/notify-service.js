import { NotifyClient } from 'notifications-node-client'
import { config } from '../../../config.js'

export class EmailService {
  constructor(logger) {
    this.logger = logger
    this.enabled = config.get('notify.enabled')

    if (this.enabled) {
      const apiKey = config.get('notify.apiKey')
      if (!apiKey) {
        throw new Error('NOTIFY_API_KEY is required when NOTIFY_ENABLED=true')
      }
      this.client = new NotifyClient(apiKey)
      this.logger.info('GOV.UK Notify initialized')
    } else {
      this.logger.warn('Email disabled - will log only')
    }
  }

  async send(templateId, email, personalisation, reference) {
    if (!this.enabled) {
      this.logger.info(
        { email, template: reference },
        'Email disabled - would have sent'
      )
      return { success: true, reference: `mock-${Date.now()}` }
    }

    if (!templateId) {
      throw new Error(`Template ID not configured for ${reference}`)
    }

    try {
      const response = await this.client.sendEmail(templateId, email, {
        personalisation,
        reference: `${reference}-${Date.now()}`
      })

      this.logger.info(
        { email, notificationId: response?.body?.id },
        'Email sent'
      )

      return {
        success: true,
        notificationId: response?.body?.id,
        reference: response?.body?.reference
      }
    } catch (error) {
      this.logger.error(
        {
          err: error,
          email,
          statusCode: error?.response?.data?.status_code
        },
        'Email send failed'
      )
      throw error
    }
  }

  getStatus() {
    return {
      enabled: this.enabled,
      configured: this.enabled && !!config.get('notify.apiKey')
    }
  }
}

// Create singleton instance
let emailServiceInstance = null

export function getEmailService(logger) {
  if (!emailServiceInstance) {
    emailServiceInstance = new EmailService(logger)
  }
  return emailServiceInstance
}

export function resetEmailService() {
  emailServiceInstance = null
}
