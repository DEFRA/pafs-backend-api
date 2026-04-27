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
        this._setupProxy(proxyUrl)
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

  /**
   * Configures outbound proxy for the Notify axios client.
   */
  _setupProxy(proxyUrl) {
    if (globalThis.GLOBAL_AGENT) {
      this.logger.info(
        {
          proxyUrl,
          globalAgentHttpProxy: globalThis.GLOBAL_AGENT.HTTP_PROXY,
          globalAgentHttpsProxy: globalThis.GLOBAL_AGENT.HTTPS_PROXY
        },
        'GOV.UK Notify: proxy routing via global-agent (setProxy skipped)'
      )
      return
    }

    // global-agent not active — wire proxy directly into the axios instance
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
      `GOV.UK Notify: outbound proxy configured — ${proxyConfig.protocol}://${parsed.hostname}:${proxyConfig.port} (auth:${!!parsed.username})`
    )
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
          errStack: error?.stack,
          email,
          template: reference,
          statusCode: error?.response?.data?.status_code,
          errorCode: error?.code,
          errorMessage: error?.message
        },
        `Email send failed — ${error?.message} (code:${error?.code ?? 'none'})`
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
