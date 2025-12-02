export class AccountRequestService {
  constructor(prisma, logger) {
    this.prisma = prisma
    this.logger = logger
  }

  async createAccountRequest(userData, areas) {
    this.logger.info('Creating account request')
    try {
      const now = new Date()

      // Use Prisma transaction to ensure atomicity
      const result = await this.prisma.$transaction(async (tx) => {
        // Create user with status 'pending'
        const user = await tx.pafs_core_users.create({
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

        // Create user areas
        const userAreas = await Promise.all(
          areas.map((area) =>
            tx.pafs_core_user_areas.create({
              data: {
                user_id: user.id,
                area_id: BigInt(area.area_id),
                primary: area.primary || false,
                created_at: now,
                updated_at: now
              }
            })
          )
        )

        return { user, userAreas }
      })

      // Convert BigInt to string for JSON serialization
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

      this.logger.info(
        { userId: serializedUser.id },
        'Account request created successfully'
      )

      return {
        success: true,
        user: serializedUser,
        areas: serializedUserAreas
      }
    } catch (error) {
      this.logger.error({ error }, 'Failed to create account request')

      // Handle unique constraint violation (duplicate email)
      // Prisma error code P2002 indicates unique constraint violation
      if (
        error.code === 'P2002' ||
        (error.message && error.message.includes('Unique constraint failed'))
      ) {
        // Check if it's an email constraint
        const isEmailError =
          error.meta?.target?.includes('email') ||
          error.message?.includes('(`email`)')

        if (isEmailError) {
          return {
            success: false,
            error: 'account.email_already_exists'
          }
        }
      }

      // Return a clean error message without Prisma formatting
      // Remove ANSI color codes using a safer approach
      let cleanErrorMessage =
        error.message || 'Failed to create account request'
      if (cleanErrorMessage) {
        // Remove ANSI escape sequences (pattern: ESC[ followed by numbers/semicolons and 'm')
        const esc = String.fromCharCode(27) // ESC character
        cleanErrorMessage = cleanErrorMessage
          .replace(new RegExp(`${esc}\\[[0-9;]*m`, 'g'), '')
          .trim()
      }

      return {
        success: false,
        error: cleanErrorMessage
      }
    }
  }
}
