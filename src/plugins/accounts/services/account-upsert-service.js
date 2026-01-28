import { SIZE } from '../../../common/constants/common.js'
import { ACCOUNT_STATUS } from '../../../common/constants/accounts.js'
import { config } from '../../../config.js'
import { BadRequestError } from '../../../common/errors/http-errors.js'
import { EmailValidationService } from '../../../common/services/email/email-validation-service.js'
import { AccountEmailService } from './account-email-service.js'
import { AccountAreaValidator } from './account-area-validator.js'
import { AccountInvitationService } from './account-invitation-service.js'

export class AccountUpsertService {
  constructor(prisma, logger, emailService, areaService) {
    this.prisma = prisma
    this.logger = logger
    this.emailValidationService = new EmailValidationService(
      prisma,
      config,
      logger
    )
    this.emailService = new AccountEmailService(
      emailService,
      areaService,
      logger
    )
    this.areaValidator = new AccountAreaValidator(areaService, logger)
    this.invitationService = new AccountInvitationService(
      prisma,
      logger,
      this.emailService
    )
  }

  /**
   * Upsert account (create or update)
   * @param {Object} data - Account data
   * @param {Object} context - Request context
   * @returns {Promise<Object>} Upsert result
   */
  async upsertAccount(data, context = {}) {
    const { authenticatedUser } = context

    await this._validateAccountData(data)
    const dbData = this.convertToDbFields(data)
    const uniqueWhere = this._determineUniqueWhere(data)
    const { invitationDetails, invitationToken, hashedToken } =
      this._prepareInvitationData(data.email, authenticatedUser)

    const user = await this._performUpsert(
      dbData,
      uniqueWhere,
      invitationDetails,
      hashedToken
    )

    const isNewAccount = !data.id
    await this.manageUserAreas(user.id, data.areas)
    await this._handlePostUpsert(user, {
      isNewAccount,
      authenticatedUser,
      dbData,
      invitationToken,
      areas: data.areas || []
    })

    return this._buildUpsertResponse(user, isNewAccount)
  }

  /**
   * Approve a pending account (delegates to invitation service)
   */
  async approveAccount(userId, authenticatedUser) {
    return this.invitationService.approveAccount(userId, authenticatedUser)
  }

  /**
   * Resend invitation (delegates to invitation service)
   */
  async resendInvitation(userId) {
    return this.invitationService.resendInvitation(userId)
  }

  /**
   * Validate account data
   * @param {Object} data - Account data
   * @private
   */
  async _validateAccountData(data) {
    await this.validateEmail(data.email, data.id)

    if (!data.admin && data.areas && data.areas.length > 0) {
      await this.areaValidator.validateAreaResponsibilityTypes(
        data.areas,
        data.responsibility
      )
    }
  }

  /**
   * Perform upsert operation
   * @private
   */
  async _performUpsert(dbData, uniqueWhere, invitationDetails, hashedToken) {
    const commonFields = this._prepareCommonFields(dbData)
    const createOnlyFields = this._prepareCreateFields(
      commonFields,
      invitationDetails,
      hashedToken
    )

    return this.prisma.pafs_core_users.upsert({
      where: uniqueWhere,
      update: commonFields,
      create: createOnlyFields
    })
  }

  /**
   * Handle post-upsert actions
   * @private
   */
  async _handlePostUpsert(
    user,
    { isNewAccount, authenticatedUser, dbData, invitationToken, areas }
  ) {
    if (isNewAccount && user.status === ACCOUNT_STATUS.APPROVED) {
      await this.emailService.sendInvitationEmail(user, invitationToken)
    }

    if (isNewAccount && !authenticatedUser) {
      await this.emailService.sendAdminNotification(
        { ...user, responsibility: dbData.responsibility },
        areas
      )
    }

    this.logger.info(
      { userId: user.id, email: user.email, isNewAccount, status: user.status },
      `Account ${isNewAccount ? 'created' : 'updated'}`
    )
  }

  /**
   * Build upsert response
   * @private
   */
  _buildUpsertResponse(user, isNewAccount) {
    return {
      message: `Account ${isNewAccount ? 'created' : 'updated'} successfully`,
      email: user.email,
      status: user.status,
      userId: Number(user.id)
    }
  }

  /**
   * Determine unique where clause
   * @private
   */
  _determineUniqueWhere(data) {
    return data.id ? { id: BigInt(data.id) } : { email: data.email }
  }

  /**
   * Prepare invitation data
   * @private
   */
  _prepareInvitationData(email, authenticatedUser) {
    const invitationDetails = this.invitationService.determineInvitationDetails(
      email,
      authenticatedUser
    )
    let invitationToken = null
    let hashedToken = null

    if (invitationDetails.status === ACCOUNT_STATUS.APPROVED) {
      const tokenData = this.invitationService.generateInvitationToken()
      invitationToken = tokenData.token
      hashedToken = tokenData.hashedToken
    }

    return { invitationDetails, invitationToken, hashedToken }
  }

  /**
   * Convert request data to database fields
   * @param {Object} data - Request data
   * @returns {Object} Database fields
   */
  convertToDbFields(data) {
    return {
      email: data.email,
      first_name: data.firstName,
      last_name: data.lastName,
      job_title: data.jobTitle || null,
      organisation: data.organisation || '',
      telephone_number: data.telephoneNumber || null,
      responsibility: data.responsibility || null,
      admin: data.admin || false
    }
  }

  /**
   * Prepare common fields for update
   * @private
   */
  _prepareCommonFields(dbData) {
    return {
      email: dbData.email,
      first_name: dbData.first_name,
      last_name: dbData.last_name,
      job_title: dbData.job_title,
      organisation: dbData.organisation,
      telephone_number: dbData.telephone_number,
      admin: dbData.admin,
      updated_at: new Date()
    }
  }

  /**
   * Prepare create-only fields
   * @private
   */
  _prepareCreateFields(commonFields, invitationDetails, hashedToken) {
    return {
      ...commonFields,
      status: invitationDetails.status,
      invited_by_type: hashedToken ? invitationDetails.invitedByType : null,
      invited_by_id: hashedToken ? invitationDetails.invitedById : null,
      invitation_token: hashedToken,
      invitation_created_at: hashedToken ? new Date() : null,
      invitation_sent_at: hashedToken ? new Date() : null,
      created_at: new Date()
    }
  }

  /**
   * Manage user areas
   * @param {BigInt} userId - User ID
   * @param {Array} areas - Areas to assign
   */
  async manageUserAreas(userId, areas) {
    if (areas === undefined) {
      return
    }

    const existingAreas = await this._fetchExistingUserAreas(userId)
    const hasChanges = this._hasAreaChanges(existingAreas, areas)

    if (!hasChanges) {
      this.logger.debug({ userId }, 'No area changes detected, skipping update')
      return
    }

    await this._replaceUserAreas(userId, areas)
  }

  /**
   * Fetch existing user areas
   * @private
   */
  async _fetchExistingUserAreas(userId) {
    return this.prisma.pafs_core_user_areas.findMany({
      where: { user_id: userId },
      select: { area_id: true, primary: true }
    })
  }

  /**
   * Check if areas have changed
   * @private
   */
  _hasAreaChanges(existingAreas, newAreas) {
    if (existingAreas.length !== newAreas.length) {
      return true
    }

    const existingSet = this._createAreaSet(
      existingAreas.map((a) => ({
        areaId: Number(a.area_id),
        primary: a.primary
      }))
    )
    const newSet = this._createAreaSet(newAreas)

    return existingSet !== newSet
  }

  /**
   * Create area set for comparison
   * @private
   */
  _createAreaSet(areas) {
    return areas
      .map((a) => `${a.areaId}:${a.primary || false}`)
      .sort()
      .join('|')
  }

  /**
   * Replace user areas
   * @private
   */
  async _replaceUserAreas(userId, areas) {
    await this.prisma.$transaction(async (tx) => {
      await tx.pafs_core_user_areas.deleteMany({
        where: { user_id: userId }
      })

      if (areas.length > 0) {
        const userAreas = this._prepareUserAreasData(userId, areas)
        await tx.pafs_core_user_areas.createMany({ data: userAreas })
      }
    })
  }

  /**
   * Prepare user areas data
   * @private
   */
  _prepareUserAreasData(userId, areas) {
    return areas.map((area) => ({
      user_id: userId,
      area_id: BigInt(area.areaId),
      primary: area.primary || false,
      created_at: new Date(),
      updated_at: new Date()
    }))
  }

  /**
   * Validate email
   * @param {string} email - Email to validate
   * @param {number} excludeUserId - User ID to exclude
   */
  async validateEmail(email, excludeUserId = null) {
    this.logger.info(
      { email: email?.substring(0, SIZE.LENGTH_3) + '***', excludeUserId },
      'Validating email'
    )

    const validationResult = await this.emailValidationService.validateEmail(
      email,
      { excludeUserId }
    )

    if (!validationResult.isValid) {
      const primaryError = validationResult.errors[0]
      this.logger.warn(
        { email, errorCode: primaryError.code },
        'Email validation failed'
      )
      throw new BadRequestError(
        primaryError.message,
        primaryError.code,
        'email'
      )
    }

    this.logger.info({ email }, 'Email validation passed')
  }
}
