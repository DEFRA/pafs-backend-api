import { config } from '../../../config.js'
import {
  generateSecureToken,
  hashToken
} from '../../auth/helpers/secure-token.js'

// ASCII code for ESC (escape) character used in ANSI escape sequences
const ESCAPE_CHAR_CODE = 27

// Default error message for account request failures
const DEFAULT_ERROR_MESSAGE = 'Failed to create account request'

export class AccountRequestService {
  /**
   * Service constructor.
   * @param {object} prisma - Prisma client instance.
   * @param {object} logger - Logger instance for structured logs.
   * @param {object} emailService - Email service for sending notifications.
   * @param {object} areaService - Area service for area lookups.
   */
  constructor(prisma, logger, emailService, areaService) {
    this.prisma = prisma
    this.logger = logger
    this.emailService = emailService
    this.areaService = areaService

    if (
      !this.areaService ||
      typeof this.areaService.getAreasByIds !== 'function'
    ) {
      this.logger.warn('AreaService not provided or missing getAreasByIds')
    }
  }

  /**
   * Creates an account request and sends appropriate notification emails.
   * - Auto-approves and sends set-password email for gov.uk users.
   * - Sends admin verification email for non-gov.uk users.
   * @param {object} userData - Incoming user data.
   * @param {Array} areas - Selected areas with primary flag.
   * @returns {Promise<{success:boolean,user:object,areas:Array}|{success:false,error:string}>}
   */
  async createAccountRequest(userData, areas) {
    this.logger.info('Creating account request')
    try {
      // Determine gov.uk domain flag (case-insensitive)
      const email = (userData.emailAddress || '').toLowerCase()
      const govUkUser = email.includes('yopmail.com')

      const result = await this._executeAccountRequestTransaction(
        userData,
        areas,
        govUkUser
      )
      const serialized = this._serializeAccountRequestResult(result)

      this.logger.info(
        { userId: serialized.user.id },
        'Account request created successfully'
      )

      // Send emails based on gov.uk flag
      if (govUkUser) {
        await this._sendSetPasswordEmail(serialized.user)
        // New: notify admin of approved account using same area data logic
        await this._sendAccountApprovedAdminEmail(
          userData,
          serialized.userAreas
        )
      } else {
        await this._sendAccountVerificationEmail(userData, serialized.userAreas)
      }

      return {
        success: true,
        user: serialized.user,
        areas: serialized.userAreas
      }
    } catch (error) {
      return this._handleAccountRequestError(error)
    }
  }

  /**
   * Executes the account creation transaction (user + areas).
   * @param {object} userData - User input data.
   * @param {Array} areas - Areas to attach to the user.
   * @param {boolean} govUkUser - Flag indicating auto-approval path.
   * @returns {Promise<{user:object,userAreas:Array}>}
   */
  async _executeAccountRequestTransaction(userData, areas, govUkUser) {
    const now = new Date()

    return this.prisma.$transaction(async (tx) => {
      const user = await this._createUserInTransaction(
        tx,
        userData,
        now,
        govUkUser
      )
      const userAreas = await this._createUserAreasInTransaction(
        tx,
        user.id,
        areas,
        now
      )

      return { user, userAreas }
    })
  }

  /**
   * Creates the user record inside the transaction.
   * Sets status to 'approved' for gov.uk users, otherwise 'pending'.
   * @param {object} tx - Prisma transaction client.
   * @param {object} userData - Source user data.
   * @param {Date} now - Timestamp for created/updated fields.
   * @param {boolean} govUkUser - Auto-approval flag.
   * @returns {Promise<object>} - Created user.
   */
  async _createUserInTransaction(tx, userData, now, govUkUser) {
    return tx.pafs_core_users.create({
      data: {
        first_name: userData.firstName,
        last_name: userData.lastName,
        email: userData.emailAddress,
        telephone_number: userData.telephoneNumber || null,
        organisation: userData.organisation || '',
        job_title: userData.jobTitle || null,
        status: govUkUser ? 'approved' : 'pending',
        encrypted_password: '', // Empty password for pending/approved accounts until set
        created_at: now,
        updated_at: now
      }
    })
  }

  /**
   * Creates user-area links inside the transaction.
   * @param {object} tx - Prisma transaction client.
   * @param {string|number|bigint} userId - ID of the created user.
   * @param {Array} areas - Area selection for the user.
   * @param {Date} now - Timestamp for created/updated fields.
   * @returns {Promise<Array>} - Created userAreas records.
   */
  async _createUserAreasInTransaction(tx, userId, areas, now) {
    return Promise.all(
      areas.map((area) =>
        tx.pafs_core_user_areas.create({
          data: {
            user_id: userId,
            area_id: BigInt(area.area_id),
            primary: area.primary || false,
            created_at: now,
            updated_at: now
          }
        })
      )
    )
  }

  /**
   * Builds email personalisation using AreaService lookups.
   * Resolves main area name/type and optional area names.
   * @param {object} userData - User personal details for email.
   * @param {Array} serializedUserAreas - User areas with string IDs.
   * @returns {Promise<object>} - Personalisation payload for Notify templates.
   */
  async _buildAreaEmailPersonalisation(userData, serializedUserAreas) {
    if (
      !this.areaService ||
      typeof this.areaService.getAreasByIds !== 'function'
    ) {
      throw new Error('AreaService unavailable or improperly constructed')
    }

    const areaIds = serializedUserAreas.map((ua) => ua.area_id) // already stringified
    const areaDetails = await this.areaService.getAreasByIds(areaIds)
    // Map includes both name and area_type; normalize key to string to match serialized ids
    const areaMap = new Map(
      areaDetails.map((ad) => [
        String(ad.id),
        { name: ad.name, area_type: ad.area_type }
      ])
    )

    let mainAreaName = ''
    let mainAreaType = ''
    const optionalAreaNames = []

    for (const userArea of serializedUserAreas) {
      const areaInfo = areaMap.get(userArea.area_id)
      if (areaInfo) {
        if (userArea.primary) {
          mainAreaName = areaInfo.name
          mainAreaType = areaInfo.area_type
        } else {
          optionalAreaNames.push(areaInfo.name)
        }
      }
    }

    return {
      first_name: userData.firstName,
      last_name: userData.lastName,
      email_address: userData.emailAddress,
      telephone: userData.telephoneNumber,
      organisation: userData.organisation,
      job_title: userData.jobTitle,
      responsibility_area: mainAreaType,
      main_area: mainAreaName,
      optional_areas: optionalAreaNames.join(', ')
    }
  }

  /**
   * Sends account verification email to admin for non-gov.uk users.
   * Uses area-based personalisation.
   * @param {object} userData - User details for personalisation.
   * @param {Array} serializedUserAreas - Areas linked to the user.
   * @returns {Promise<void>}
   */
  async _sendAccountVerificationEmail(userData, serializedUserAreas) {
    const accountVerificationTemplateId = config.get(
      'notify.templateAccountVerification'
    )
    const AdminEmail = config.get('notify.adminEmail')

    const personalisation = await this._buildAreaEmailPersonalisation(
      userData,
      serializedUserAreas
    )

    await this.emailService.send(
      accountVerificationTemplateId,
      AdminEmail,
      personalisation,
      'account-verification'
    )
  }

  /**
   * Sends admin notification for approved (gov.uk) users.
   * Reuses area personalisation and templateAccountApprovedToAdmin.
   * @param {object} userData - User details for personalisation.
   * @param {Array} serializedUserAreas - Areas linked to the user.
   * @returns {Promise<void>}
   */
  async _sendAccountApprovedAdminEmail(userData, serializedUserAreas) {
    const accountApprovedTemplateId = config.get(
      'notify.templateAccountApprovedToAdmin'
    )
    const AdminEmail = config.get('notify.adminEmail')

    const personalisation = await this._buildAreaEmailPersonalisation(
      userData,
      serializedUserAreas
    )

    await this.emailService.send(
      accountApprovedTemplateId,
      AdminEmail,
      personalisation,
      'account-approved'
    )
  }

  /**
   * Generates a reset token, persists it, and sends the set-password email to the user.
   * Used for auto-approved (gov.uk) users.
   * @param {object} user - Serialized user (id as string, includes email and first_name).
   * @returns {Promise<void>}
   */
  async _sendSetPasswordEmail(user) {
    const token = generateSecureToken()
    const hashedToken = hashToken(token)

    await this.prisma.pafs_core_users.update({
      where: { id: user.id },
      data: {
        reset_password_token: hashedToken,
        reset_password_sent_at: new Date(),
        updated_at: new Date()
      }
    })

    const frontendUrl = config.get('frontendUrl')
    const setPasswordLink = `${frontendUrl}/set-password?token=${token}`
    const passwordSetTemplateId = config.get(
      'notify.templateAccountApprovedSetPassword'
    )

    await this.emailService.send(
      passwordSetTemplateId,
      user.email,
      {
        user_name: user.first_name,
        email_address: user.email,
        set_password_link: setPasswordLink
      },
      'set-password'
    )
  }

  /**
   * Serializes transaction result to ensure IDs are strings for API responses.
   * @param {object} result - Transaction result with raw user and userAreas.
   * @returns {{user:object,userAreas:Array}} - Serialized entities.
   */
  _serializeAccountRequestResult(result) {
    const serializedUser = {
      ...result.user,
      id: result.user.id.toString()
    }

    const serializedUserAreas = result.userAreas.map((ua) => ({
      ...ua,
      id: ua.id.toString(),
      user_id: ua.user_id.toString(),
      area_id: ua.area_id.toString()
    }))

    return { user: serializedUser, userAreas: serializedUserAreas }
  }

  /**
   * Handles errors in account request flow and returns user-friendly messages.
   * Detects duplicate email errors and strips ANSI codes from messages.
   * @param {Error} error - Thrown error instance.
   * @returns {{success:false,error:string}} - Error payload for API.
   */
  _handleAccountRequestError(error) {
    this.logger.error({ error }, DEFAULT_ERROR_MESSAGE)

    // Handle unique constraint violation (duplicate email)
    if (this._isDuplicateEmailError(error)) {
      return {
        success: false,
        error: 'account.email_already_exists'
      }
    }

    // Return a clean error message without Prisma formatting
    const cleanErrorMessage = this._cleanErrorMessage(error.message)

    return {
      success: false,
      error: cleanErrorMessage
    }
  }

  /**
   * Checks whether an error represents a unique constraint violation on email.
   * @param {Error & {code?:string,meta?:object,message?:string}} error
   * @returns {boolean}
   */
  _isDuplicateEmailError(error) {
    // Prisma error code P2002 indicates unique constraint violation
    const isUniqueConstraintError =
      error.code === 'P2002' ||
      error.message?.includes('Unique constraint failed')

    if (!isUniqueConstraintError) {
      return false
    }

    // Check if it's an email constraint
    return (
      error.meta?.target?.includes('email') ||
      error.message?.includes('(`email`)')
    )
  }

  /**
   * Removes ANSI escape codes from an error message to keep logs clean.
   * @param {string} [errorMessage] - Raw error message.
   * @returns {string} - Cleaned message.
   */
  _cleanErrorMessage(errorMessage = DEFAULT_ERROR_MESSAGE) {
    // Remove ANSI escape sequences (pattern: ESC[ followed by numbers/semicolons and 'm')
    const esc = String.fromCodePoint(ESCAPE_CHAR_CODE)
    const ansiPattern = String.raw`${esc}\[[0-9;]*m`
    const message = errorMessage || DEFAULT_ERROR_MESSAGE
    return message.replaceAll(new RegExp(ansiPattern, 'g'), '').trim()
  }
}
