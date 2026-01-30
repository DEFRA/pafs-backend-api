import { config } from '../../../config.js'
import { STATIC_TEXT } from '../../../common/constants/common.js'
import {
  ACCOUNT_STATUS,
  ACCOUNT_RESPONSIBILITY
} from '../../../common/constants/accounts.js'

export class AccountEmailService {
  constructor(emailService, areaService, logger) {
    this.emailService = emailService
    this.areaService = areaService
    this.logger = logger
  }

  /**
   * Send invitation email to user
   * @param {Object} user - User object
   * @param {string} token - Invitation token
   */
  async sendInvitationEmail(user, token) {
    const frontendUrl = config.get('frontendUrl')
    const invitationLink = `${frontendUrl}/set-password?token=${token}`
    const templateId = config.get('notify.templateAccountApprovedSetPassword')

    await this.emailService.send(
      templateId,
      user.email,
      {
        user_name: user.first_name,
        email_address: user.email,
        set_password_link: invitationLink
      },
      'account-invitation'
    )

    this.logger.info(
      { userId: user.id, status: user.status },
      'Invitation email sent'
    )
  }

  /**
   * Send admin notification email
   * @param {Object} user - User object
   * @param {Array} areas - User areas
   */
  async sendAdminNotification(user, areas = []) {
    const adminEmail = config.get('notify.adminEmail')
    if (!adminEmail) {
      this.logger.warn('Admin email not configured, skipping notification')
      return
    }

    const { mainArea, optionalAreas } = await this._buildAreaStrings(areas)

    const templateId =
      user.status === ACCOUNT_STATUS.APPROVED
        ? config.get('notify.templateAccountApprovedToAdmin')
        : config.get('notify.templateAccountVerification')

    const responsibilityLabel = ACCOUNT_RESPONSIBILITY[user.responsibility]

    await this.emailService.send(
      templateId,
      adminEmail,
      {
        first_name: user.first_name,
        last_name: user.last_name,
        email_address: user.email,
        telephone: user.telephone_number || STATIC_TEXT.not_specified,
        organisation: user.organisation || STATIC_TEXT.not_specified,
        job_title: user.job_title || STATIC_TEXT.not_specified,
        responsibility_area: responsibilityLabel,
        main_area: mainArea,
        optional_areas: optionalAreas
      },
      'admin-notification'
    )

    this.logger.info({ userId: user.id }, 'Admin notification sent')
  }

  /**
   * Build area strings for email templates
   * @param {Array} areas - User areas
   * @returns {Promise<Object>} Area strings
   * @private
   */
  async _buildAreaStrings(areas) {
    let mainArea = STATIC_TEXT.not_specified
    let optionalAreas = 'None'

    if (!areas || areas.length === 0) {
      return { mainArea, optionalAreas }
    }

    const areaIds = areas.map((a) => a.areaId)
    const areaDetails = await this.areaService.getAreaDetailsByIds(areaIds)
    const areaMap = new Map(areaDetails.map((a) => [a.id, a.name]))

    const primaryArea = areas.find((a) => a.primary)
    if (primaryArea) {
      mainArea = areaMap.get(primaryArea.areaId) || 'Unknown'
    }

    const optionalAreasList = areas
      .filter((a) => !a.primary)
      .map((a) => areaMap.get(a.areaId))
      .filter(Boolean)

    if (optionalAreasList.length > 0) {
      optionalAreas = optionalAreasList.join(', ')
    }

    return { mainArea, optionalAreas }
  }
}
