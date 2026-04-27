import { NotifyClient } from 'notifications-node-client'
import { config } from '../../../config.js'

const proxyPort = 3128
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

      const proxyUrl = config.get('httpProxy')
      if (proxyUrl) {
        const parsed = new URL(proxyUrl)
        const proxyConfig = {
          host: parsed.hostname,
          port: Number(parsed.port) || proxyPort,
          protocol: parsed.protocol.replace(/:$/, '')
        }
        if (parsed.username) {
          proxyConfig.auth = {
            username: parsed.username,
            password: parsed.password
          }
        }
        this.client.setProxy(proxyConfig)
        this.logger.info(
          {
            proxyHost: parsed.hostname,
            proxyPort: proxyConfig.port,
            proxyProtocol: proxyConfig.protocol,
            proxyAuth: !!parsed.username
          },
          'GOV.UK Notify: outbound proxy configured'
        )
      } else {
        this.logger.warn(
          'GOV.UK Notify: no HTTP_PROXY configured — outbound will be direct'
        )
      }

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
      this.logger.info(
        { email, template: reference, templateId },
        'Email send attempt'
      )
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
          template: reference,
          statusCode: error?.response?.data?.status_code,
          errorCode: error?.code,
          errorMessage: error?.message
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
