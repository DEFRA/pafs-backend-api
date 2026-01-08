import {
  generateSecureToken,
  hashToken
} from '../../auth/helpers/secure-token.js'
import { ACCOUNT_STATUS } from '../../../common/constants/index.js'
import { config } from '../../../config.js'
import {
  ACCOUNT_INVITATION_BY,
  ACCOUNT_RESPONSIBILITY,
  ACCOUNT_ERROR_CODES
} from '../../../common/constants/accounts.js'
import {
  BadRequestError,
  NotFoundError
} from '../../../common/errors/http-errors.js'
import { EmailValidationService } from '../../../common/services/email/email-validation-service.js'
import { SIZE, STATIC_TEXT } from '../../../common/constants/common.js'

export class AccountUpsertService {
  constructor(prisma, logger, emailService, areaService) {
    this.prisma = prisma
    this.logger = logger
    this.emailService = emailService
    this.areaService = areaService
    this.emailValidationService = new EmailValidationService(
      prisma,
      config,
      logger
    )
  }

  async upsertAccount(data, context = {}) {
    const { authenticatedUser } = context

    const dbData = this.convertToDbFields(data)

    // Validate email before proceeding
    await this.validateEmail(data.email, data.id)

    // Validate area responsibility types match user responsibility
    if (!data.admin && data.areas && data.areas.length > 0) {
      await this.validateAreaResponsibilityTypes(
        data.areas,
        data.responsibility
      )
    }

    // Determine unique identifier
    const uniqueWhere = this._determineUniqueWhere(data)

    // Prepare invitation details & tokens
    const { invitationDetails, invitationToken, hashedToken } =
      this._prepareInvitationData(data.email, authenticatedUser)

    // Prepare fields and upsert user record
    const commonFields = this._prepareCommonFields(dbData)
    const createOnlyFields = this._prepareCreateFields(
      commonFields,
      invitationDetails,
      hashedToken
    )

    const user = await this._upsertUser(
      uniqueWhere,
      commonFields,
      createOnlyFields
    )

    // Determine if this was a new account (no id provided)
    const isNewAccount = !data.id

    // Manage user areas (always run)
    await this.manageUserAreas(user.id, data.areas)

    // Post-upsert notifications and logging
    await this._handlePostUpsert(user, {
      isNewAccount,
      authenticatedUser,
      dbData,
      invitationToken,
      areas: data.areas || []
    })

    return {
      message: `Account ${isNewAccount ? 'created' : 'updated'} successfully`,
      email: user.email,
      status: user.status,
      userId: Number(user.id)
    }
  }

  _determineUniqueWhere(data) {
    return data.id ? { id: BigInt(data.id) } : { email: data.email }
  }

  _prepareInvitationData(email, authenticatedUser) {
    const invitationDetails = this.determineInvitationDetails(
      email,
      authenticatedUser
    )
    let invitationToken = null
    let hashedToken = null
    if (invitationDetails.status === ACCOUNT_STATUS.APPROVED) {
      const tokenData = this.generateInvitationToken()
      invitationToken = tokenData.token
      hashedToken = tokenData.hashedToken
    }
    return { invitationDetails, invitationToken, hashedToken }
  }

  async _upsertUser(uniqueWhere, updateFields, createFields) {
    return this.prisma.pafs_core_users.upsert({
      where: uniqueWhere,
      update: updateFields,
      create: createFields
    })
  }

  async _handlePostUpsert(
    user,
    { isNewAccount, authenticatedUser, dbData, invitationToken, areas }
  ) {
    // Send emails only for approved accounts created now
    if (isNewAccount && user.status === ACCOUNT_STATUS.APPROVED) {
      await this.sendInvitationEmail(user, invitationToken)
    }

    // Send admin notification only for self-registration (not admin-created accounts)
    if (isNewAccount && !authenticatedUser) {
      await this.sendAdminNotification(
        { ...user, responsibility: dbData.responsibility },
        areas
      )
    }

    this.logger.info(
      { userId: user.id, email: user.email, isNewAccount, status: user.status },
      `Account ${isNewAccount ? 'created' : 'updated'}`
    )
  }

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

  generateInvitationToken() {
    const token = generateSecureToken()
    const hashedToken = hashToken(token)
    return { token, hashedToken }
  }

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

  async approveAccount(userId, authenticatedUser) {
    // Get existing user
    const existingUser = await this.prisma.pafs_core_users.findUnique({
      where: { id: BigInt(userId) }
    })

    if (!existingUser) {
      throw new NotFoundError('Account not found', 'NOT_FOUND', 'id')
    }

    if (existingUser.status !== ACCOUNT_STATUS.PENDING) {
      throw new BadRequestError(
        'Only pending accounts can be approved',
        'INVALID_STATUS',
        'status'
      )
    }

    // Update user to approved status
    await this.prisma.pafs_core_users.update({
      where: { id: BigInt(userId) },
      data: {
        status: ACCOUNT_STATUS.APPROVED,
        invited_by_type: ACCOUNT_INVITATION_BY.USER,
        invited_by_id: authenticatedUser?.id || null,
        updated_at: new Date()
      }
    })

    // Resend invitation with new token
    await this.resendInvitation(userId)

    this.logger.info(
      { userId, approvedBy: authenticatedUser?.id },
      'Account approved and invitation sent'
    )

    return {
      message: 'Account approved successfully',
      userId: Number(userId)
    }
  }

  async resendInvitation(userId) {
    // Get user
    const user = await this.prisma.pafs_core_users.findUnique({
      where: { id: BigInt(userId) }
    })

    if (!user) {
      throw new NotFoundError('Account not found', 'NOT_FOUND', 'id')
    }

    // Generate new invitation token
    const { token: invitationToken, hashedToken } =
      this.generateInvitationToken()

    // Update invitation token and timestamp
    const updatedUser = await this.prisma.pafs_core_users.update({
      where: { id: BigInt(userId) },
      data: {
        invitation_token: hashedToken,
        invitation_created_at: new Date(),
        invitation_sent_at: new Date(),
        updated_at: new Date()
      }
    })

    // Send invitation email
    await this.sendInvitationEmail(updatedUser, invitationToken)

    this.logger.info({ userId }, 'Invitation resent')
  }

  async manageUserAreas(userId, areas) {
    if (areas === undefined) {
      return
    }

    // Use transaction to avoid constraint issues
    await this.prisma.$transaction(async (tx) => {
      // Delete existing areas
      await tx.pafs_core_user_areas.deleteMany({
        where: { user_id: userId }
      })

      // Create new areas if provided
      if (areas.length > 0) {
        const userAreas = areas.map((area) => ({
          user_id: userId,
          area_id: BigInt(area.areaId),
          primary: area.primary || false,
          created_at: new Date(),
          updated_at: new Date()
        }))

        await tx.pafs_core_user_areas.createMany({
          data: userAreas
        })
      }
    })
  }

  determineInvitationDetails(email, authenticatedUser) {
    const invitedByType = authenticatedUser
      ? ACCOUNT_INVITATION_BY.USER
      : ACCOUNT_INVITATION_BY.SYSTEM
    const invitedById = authenticatedUser?.id || null

    const isAutoApproved =
      authenticatedUser?.admin || this.isEmailAutoApproved(email)

    return {
      status: isAutoApproved ? ACCOUNT_STATUS.APPROVED : ACCOUNT_STATUS.PENDING,
      invitedByType,
      invitedById,
      isAutoApproved
    }
  }

  isEmailAutoApproved(email) {
    const autoApprovedDomains = this.getAutoApprovedDomains()
    const emailDomain = email.split('@')[1]?.toLowerCase()
    return autoApprovedDomains.includes(emailDomain)
  }

  getAutoApprovedDomains() {
    const domainsString = config.get('emailValidation.autoApprovedDomains')
    if (!domainsString) {
      return []
    }

    return domainsString
      .split(',')
      .map((d) => d.trim().toLowerCase())
      .filter((d) => d.length > 0)
  }

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

    // Get responsibility label from constant
    const responsibilityLabel = user.admin
      ? 'Admin'
      : ACCOUNT_RESPONSIBILITY[user.responsibility]

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

  async validateEmail(email, excludeUserId = null) {
    this.logger.info(
      { email: email?.substring(0, SIZE.LENGTH_3) + '***', excludeUserId },
      'Validating email'
    )

    const validationResult = await this.emailValidationService.validateEmail(
      email,
      {
        excludeUserId
      }
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

  async validateAreaResponsibilityTypes(areas, userResponsibility) {
    this.logger.info(
      { areaCount: areas.length, userResponsibility },
      'Validating area responsibility types'
    )
    const areaIds = areas.map((a) => a.areaId)
    const areaDetails = await this._fetchAreaDetails(areaIds)

    this._ensureAllAreasExist(areaIds, areaDetails)

    const expectedAreaType =
      this._mapResponsibilityToAreaType(userResponsibility)
    this._ensureAreasMatchResponsibility(
      areaDetails,
      expectedAreaType,
      userResponsibility
    )

    this.logger.info(
      { areaCount: areaDetails.length, areaType: expectedAreaType },
      'Area responsibility validation passed'
    )
  }

  async _fetchAreaDetails(areaIds) {
    return this.areaService.getAreaDetailsByIds(areaIds)
  }

  _ensureAllAreasExist(areaIds, areaDetails) {
    if (areaDetails.length === areaIds.length) {
      return
    }

    const foundAreaIds = new Set(areaDetails.map((a) => String(a.id)))
    const missingAreaIds = areaIds.filter((id) => !foundAreaIds.has(String(id)))

    this.logger.warn(
      {
        requestedCount: areaIds.length,
        foundCount: areaDetails.length,
        missingAreaIds
      },
      'Some area IDs do not exist'
    )

    throw new BadRequestError(
      `The following area IDs do not exist: ${missingAreaIds.join(', ')}`,
      ACCOUNT_ERROR_CODES.INVALID_AREA_IDS,
      'areas'
    )
  }

  _mapResponsibilityToAreaType(userResponsibility) {
    const responsibilityToAreaTypeMap = {
      EA: 'EA Area',
      PSO: 'PSO Area',
      RMA: 'RMA'
    }

    return responsibilityToAreaTypeMap[userResponsibility]
  }

  _ensureAreasMatchResponsibility(
    areaDetails,
    expectedAreaType,
    userResponsibility
  ) {
    if (!expectedAreaType) {
      return
    }
    const invalidAreas = areaDetails.filter(
      (area) => area.areaType !== expectedAreaType
    )
    if (invalidAreas.length === 0) {
      return
    }

    const invalidAreaNames = invalidAreas
      .map((a) => `${a.name} (${a.areaType})`)
      .join(', ')

    this.logger.warn(
      {
        userResponsibility,
        expectedAreaType,
        invalidAreas: invalidAreaNames
      },
      'Area responsibility type mismatch'
    )

    throw new BadRequestError(
      `All areas must be of type '${expectedAreaType}' for ${ACCOUNT_RESPONSIBILITY[userResponsibility]} users. Invalid areas: ${invalidAreaNames}`,
      ACCOUNT_ERROR_CODES.AREA_RESPONSIBILITY_MISMATCH,
      'areas'
    )
  }
}
