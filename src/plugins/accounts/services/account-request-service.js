import { config } from '../../../config.js'

// ASCII code for ESC (escape) character used in ANSI escape sequences
const ESCAPE_CHAR_CODE = 27

// Default error message for account request failures
const DEFAULT_ERROR_MESSAGE = 'Failed to create account request'

export class AccountRequestService {
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

  async createAccountRequest(userData, areas) {
    this.logger.info('Creating account request')
    try {
      const result = await this._executeAccountRequestTransaction(
        userData,
        areas
      )
      const serialized = this._serializeAccountRequestResult(result)

      this.logger.info(
        { userId: serialized.user.id },
        'Account request created successfully'
      )

      const areaIds = serialized.userAreas.map((ua) => ua.area_id) // already stringified
      // Always use AreaService for area lookups (no Prisma transaction for areas)
      if (
        !this.areaService ||
        typeof this.areaService.getAreasByIds !== 'function'
      ) {
        throw new Error('AreaService unavailable or improperly constructed')
      }
      const areaDetails = await this.areaService.getAreasByIds(areaIds)
      const areaMap = new Map(areaDetails.map((ad) => [ad.id, ad.name]))

      let mainAreaName = ''
      const optionalAreaNames = []

      for (const userArea of serialized.userAreas) {
        const areaName = areaMap.get(userArea.area_id)
        if (areaName) {
          if (userArea.primary) {
            mainAreaName = areaName
          } else {
            optionalAreaNames.push(areaName)
          }
        }
      }

      const templateId = config.get('notify.templateAccountVerification')
      const AdminEmail = config.get('notify.adminEmail')
      await this.emailService.send(
        templateId,
        AdminEmail,
        {
          first_name: userData.firstName,
          last_name: userData.lastName,
          email_address: userData.emailAddress,
          telephone: userData.telephoneNumber,
          organisation: userData.organisation,
          job_title: userData.jobTitle,
          responsibility_area: userData.responsibility,
          main_area: mainAreaName,
          optional_areas: optionalAreaNames.join(', ')
        },
        'account-verification'
      )

      return {
        success: true,
        user: serialized.user,
        areas: serialized.userAreas
      }
    } catch (error) {
      return this._handleAccountRequestError(error)
    }
  }

  async _executeAccountRequestTransaction(userData, areas) {
    const now = new Date()

    return this.prisma.$transaction(async (tx) => {
      const user = await this._createUserInTransaction(tx, userData, now)
      const userAreas = await this._createUserAreasInTransaction(
        tx,
        user.id,
        areas,
        now
      )

      return { user, userAreas }
    })
  }

  async _createUserInTransaction(tx, userData, now) {
    return tx.pafs_core_users.create({
      data: {
        first_name: userData.firstName,
        last_name: userData.lastName,
        email: userData.emailAddress,
        telephone_number: userData.telephoneNumber || null,
        organisation: userData.organisation || '',
        job_title: userData.jobTitle || null,
        status: 'pending',
        encrypted_password: '', // Empty password for pending accounts
        created_at: now,
        updated_at: now
      }
    })
  }

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

  _cleanErrorMessage(errorMessage = DEFAULT_ERROR_MESSAGE) {
    // Remove ANSI escape sequences (pattern: ESC[ followed by numbers/semicolons and 'm')
    const esc = String.fromCodePoint(ESCAPE_CHAR_CODE)
    const ansiPattern = String.raw`${esc}\[[0-9;]*m`
    const message = errorMessage || DEFAULT_ERROR_MESSAGE
    return message.replaceAll(new RegExp(ansiPattern, 'g'), '').trim()
  }
}
