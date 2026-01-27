import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AccountEmailService } from './account-email-service.js'
import { ACCOUNT_STATUS } from '../../../common/constants/accounts.js'
import { STATIC_TEXT } from '../../../common/constants/common.js'

vi.mock('../../../config.js', () => ({
  config: {
    get: vi.fn((key) => {
      const configValues = {
        frontendUrl: 'https://test-frontend.com',
        'notify.templateAccountApprovedSetPassword':
          'template-set-password-123',
        'notify.templateAccountApprovedToAdmin': 'template-admin-approved-456',
        'notify.templateAccountVerification': 'template-verification-789',
        'notify.adminEmail': 'admin@test.com'
      }
      return configValues[key]
    })
  }
}))

describe('AccountEmailService', () => {
  let emailService
  let mockEmailServiceSend
  let mockAreaService
  let mockLogger

  beforeEach(() => {
    mockEmailServiceSend = {
      send: vi.fn().mockResolvedValue(true)
    }

    mockAreaService = {
      getAreaDetailsByIds: vi.fn()
    }

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    }

    emailService = new AccountEmailService(
      mockEmailServiceSend,
      mockAreaService,
      mockLogger
    )

    vi.clearAllMocks()
  })

  describe('sendInvitationEmail', () => {
    it('sends invitation email with correct parameters', async () => {
      const user = {
        id: BigInt(123),
        email: 'user@example.com',
        first_name: 'John',
        status: ACCOUNT_STATUS.APPROVED
      }
      const token = 'secure-token-abc123'

      await emailService.sendInvitationEmail(user, token)

      expect(mockEmailServiceSend.send).toHaveBeenCalledWith(
        'template-set-password-123',
        'user@example.com',
        {
          user_name: 'John',
          email_address: 'user@example.com',
          set_password_link:
            'https://test-frontend.com/set-password?token=secure-token-abc123'
        },
        'account-invitation'
      )

      expect(mockLogger.info).toHaveBeenCalledWith(
        { userId: BigInt(123), status: ACCOUNT_STATUS.APPROVED },
        'Invitation email sent'
      )
    })

    it('handles different user names', async () => {
      const user = {
        id: BigInt(456),
        email: 'jane@example.com',
        first_name: 'Jane',
        status: ACCOUNT_STATUS.APPROVED
      }
      const token = 'another-token-xyz789'

      await emailService.sendInvitationEmail(user, token)

      expect(mockEmailServiceSend.send).toHaveBeenCalledWith(
        'template-set-password-123',
        'jane@example.com',
        expect.objectContaining({
          user_name: 'Jane',
          email_address: 'jane@example.com'
        }),
        'account-invitation'
      )
    })

    it('constructs invitation link with token', async () => {
      const user = {
        id: BigInt(789),
        email: 'test@example.com',
        first_name: 'Test',
        status: ACCOUNT_STATUS.APPROVED
      }
      const token = 'token-with-special-chars'

      await emailService.sendInvitationEmail(user, token)

      const callArgs = mockEmailServiceSend.send.mock.calls[0]
      expect(callArgs[2].set_password_link).toBe(
        'https://test-frontend.com/set-password?token=token-with-special-chars'
      )
    })

    it('logs correct information after sending', async () => {
      const user = {
        id: BigInt(999),
        email: 'logger@example.com',
        first_name: 'Logger',
        status: ACCOUNT_STATUS.PENDING
      }

      await emailService.sendInvitationEmail(user, 'token')

      expect(mockLogger.info).toHaveBeenCalledWith(
        { userId: BigInt(999), status: ACCOUNT_STATUS.PENDING },
        'Invitation email sent'
      )
    })
  })

  describe('sendAdminNotification', () => {
    it('sends admin notification for approved account with areas', async () => {
      const user = {
        id: BigInt(123),
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
        telephone_number: '07123456789',
        organisation: 'Test Org',
        job_title: 'Manager',
        responsibility: 'EA',
        status: ACCOUNT_STATUS.APPROVED
      }

      const areas = [
        { areaId: 1, primary: true },
        { areaId: 2, primary: false },
        { areaId: 3, primary: false }
      ]

      mockAreaService.getAreaDetailsByIds.mockResolvedValue([
        { id: 1, name: 'Thames' },
        { id: 2, name: 'Anglian' },
        { id: 3, name: 'Southern' }
      ])

      await emailService.sendAdminNotification(user, areas)

      expect(mockEmailServiceSend.send).toHaveBeenCalledWith(
        'template-admin-approved-456',
        'admin@test.com',
        {
          first_name: 'John',
          last_name: 'Doe',
          email_address: 'john@example.com',
          telephone: '07123456789',
          organisation: 'Test Org',
          job_title: 'Manager',
          responsibility_area: expect.any(String),
          main_area: 'Thames',
          optional_areas: 'Anglian, Southern'
        },
        'admin-notification'
      )

      expect(mockLogger.info).toHaveBeenCalledWith(
        { userId: BigInt(123) },
        'Admin notification sent'
      )
    })

    it('sends admin notification for pending account', async () => {
      const user = {
        id: BigInt(456),
        first_name: 'Jane',
        last_name: 'Smith',
        email: 'jane@example.com',
        telephone_number: '07987654321',
        organisation: 'Another Org',
        job_title: 'Developer',
        responsibility: 'PSO',
        status: ACCOUNT_STATUS.PENDING
      }

      const areas = [{ areaId: 5, primary: true }]

      mockAreaService.getAreaDetailsByIds.mockResolvedValue([
        { id: 5, name: 'PSO Region' }
      ])

      await emailService.sendAdminNotification(user, areas)

      expect(mockEmailServiceSend.send).toHaveBeenCalledWith(
        'template-verification-789',
        'admin@test.com',
        expect.objectContaining({
          first_name: 'Jane',
          last_name: 'Smith',
          responsibility_area: expect.any(String)
        }),
        'admin-notification'
      )
    })

    it('handles user with no optional fields', async () => {
      const user = {
        id: BigInt(789),
        first_name: 'Bob',
        last_name: 'Test',
        email: 'bob@example.com',
        telephone_number: null,
        organisation: null,
        job_title: null,
        responsibility: 'RMA',
        status: ACCOUNT_STATUS.APPROVED
      }

      const areas = [{ areaId: 10, primary: true }]

      mockAreaService.getAreaDetailsByIds.mockResolvedValue([
        { id: 10, name: 'Local RMA' }
      ])

      await emailService.sendAdminNotification(user, areas)

      expect(mockEmailServiceSend.send).toHaveBeenCalledWith(
        'template-admin-approved-456',
        'admin@test.com',
        expect.objectContaining({
          telephone: STATIC_TEXT.not_specified,
          organisation: STATIC_TEXT.not_specified,
          job_title: STATIC_TEXT.not_specified,
          responsibility_area: expect.any(String)
        }),
        'admin-notification'
      )
    })

    it('handles empty areas array', async () => {
      const user = {
        id: BigInt(111),
        first_name: 'No',
        last_name: 'Areas',
        email: 'noareas@example.com',
        telephone_number: '01234567890',
        organisation: 'Org',
        job_title: 'Title',
        responsibility: 'EA',
        status: ACCOUNT_STATUS.APPROVED
      }

      await emailService.sendAdminNotification(user, [])

      expect(mockEmailServiceSend.send).toHaveBeenCalledWith(
        'template-admin-approved-456',
        'admin@test.com',
        expect.objectContaining({
          main_area: STATIC_TEXT.not_specified,
          optional_areas: 'None'
        }),
        'admin-notification'
      )

      expect(mockAreaService.getAreaDetailsByIds).not.toHaveBeenCalled()
    })

    it('handles undefined areas parameter', async () => {
      const user = {
        id: BigInt(222),
        first_name: 'Undefined',
        last_name: 'Areas',
        email: 'undefined@example.com',
        telephone_number: '01234567890',
        organisation: 'Org',
        job_title: 'Title',
        responsibility: 'EA',
        status: ACCOUNT_STATUS.APPROVED
      }

      await emailService.sendAdminNotification(user)

      expect(mockEmailServiceSend.send).toHaveBeenCalledWith(
        'template-admin-approved-456',
        'admin@test.com',
        expect.objectContaining({
          main_area: STATIC_TEXT.not_specified,
          optional_areas: 'None'
        }),
        'admin-notification'
      )
    })

    it('handles no primary area', async () => {
      const user = {
        id: BigInt(333),
        first_name: 'No',
        last_name: 'Primary',
        email: 'noprimary@example.com',
        telephone_number: '01234567890',
        organisation: 'Org',
        job_title: 'Title',
        responsibility: 'EA',
        status: ACCOUNT_STATUS.APPROVED
      }

      const areas = [
        { areaId: 1, primary: false },
        { areaId: 2, primary: false }
      ]

      mockAreaService.getAreaDetailsByIds.mockResolvedValue([
        { id: 1, name: 'Area 1' },
        { id: 2, name: 'Area 2' }
      ])

      await emailService.sendAdminNotification(user, areas)

      expect(mockEmailServiceSend.send).toHaveBeenCalledWith(
        'template-admin-approved-456',
        'admin@test.com',
        expect.objectContaining({
          main_area: STATIC_TEXT.not_specified,
          optional_areas: 'Area 1, Area 2'
        }),
        'admin-notification'
      )
    })

    it('handles unknown primary area ID', async () => {
      const user = {
        id: BigInt(444),
        first_name: 'Unknown',
        last_name: 'Primary',
        email: 'unknown@example.com',
        telephone_number: '01234567890',
        organisation: 'Org',
        job_title: 'Title',
        responsibility: 'EA',
        status: ACCOUNT_STATUS.APPROVED
      }

      const areas = [{ areaId: 999, primary: true }]

      mockAreaService.getAreaDetailsByIds.mockResolvedValue([])

      await emailService.sendAdminNotification(user, areas)

      expect(mockEmailServiceSend.send).toHaveBeenCalledWith(
        'template-admin-approved-456',
        'admin@test.com',
        expect.objectContaining({
          main_area: 'Unknown',
          optional_areas: 'None'
        }),
        'admin-notification'
      )
    })

    it('sends notification with configured admin email', async () => {
      const user = {
        id: BigInt(555),
        first_name: 'No',
        last_name: 'Admin',
        email: 'noadmin@example.com',
        telephone_number: '01234567890',
        organisation: 'Org',
        job_title: 'Title',
        status: ACCOUNT_STATUS.APPROVED,
        responsibility: 'EA'
      }

      await emailService.sendAdminNotification(user, [])

      expect(mockEmailServiceSend.send).toHaveBeenCalledWith(
        'template-admin-approved-456',
        'admin@test.com',
        expect.objectContaining({
          first_name: 'No',
          last_name: 'Admin',
          email_address: 'noadmin@example.com',
          main_area: STATIC_TEXT.not_specified,
          optional_areas: 'None'
        }),
        'admin-notification'
      )
    })

    it('filters out unknown optional areas', async () => {
      const user = {
        id: BigInt(666),
        first_name: 'Mixed',
        last_name: 'Areas',
        email: 'mixed@example.com',
        telephone_number: '01234567890',
        organisation: 'Org',
        job_title: 'Title',
        responsibility: 'EA',
        status: ACCOUNT_STATUS.APPROVED
      }

      const areas = [
        { areaId: 1, primary: true },
        { areaId: 2, primary: false },
        { areaId: 999, primary: false }
      ]

      mockAreaService.getAreaDetailsByIds.mockResolvedValue([
        { id: 1, name: 'Primary Area' },
        { id: 2, name: 'Secondary Area' }
      ])

      await emailService.sendAdminNotification(user, areas)

      expect(mockEmailServiceSend.send).toHaveBeenCalledWith(
        'template-admin-approved-456',
        'admin@test.com',
        expect.objectContaining({
          main_area: 'Primary Area',
          optional_areas: 'Secondary Area'
        }),
        'admin-notification'
      )
    })

    it('handles only primary area with no optional areas', async () => {
      const user = {
        id: BigInt(777),
        first_name: 'Only',
        last_name: 'Primary',
        email: 'onlyprimary@example.com',
        telephone_number: '01234567890',
        organisation: 'Org',
        job_title: 'Title',
        responsibility: 'EA',
        status: ACCOUNT_STATUS.APPROVED
      }

      const areas = [{ areaId: 1, primary: true }]

      mockAreaService.getAreaDetailsByIds.mockResolvedValue([
        { id: 1, name: 'Only Area' }
      ])

      await emailService.sendAdminNotification(user, areas)

      expect(mockEmailServiceSend.send).toHaveBeenCalledWith(
        'template-admin-approved-456',
        'admin@test.com',
        expect.objectContaining({
          main_area: 'Only Area',
          optional_areas: 'None'
        }),
        'admin-notification'
      )
    })

    it('handles all responsibility types correctly', async () => {
      const responsibilities = ['EA', 'PSO', 'RMA']

      for (let i = 0; i < responsibilities.length; i++) {
        vi.clearAllMocks()

        const user = {
          id: BigInt(i),
          first_name: 'Test',
          last_name: 'User',
          email: 'test@example.com',
          responsibility: responsibilities[i],
          status: ACCOUNT_STATUS.APPROVED
        }

        await emailService.sendAdminNotification(user, [])

        expect(mockEmailServiceSend.send).toHaveBeenCalledWith(
          expect.any(String),
          'admin@test.com',
          expect.objectContaining({
            responsibility_area: expect.any(String)
          }),
          'admin-notification'
        )
      }
    })
  })

  describe('_buildAreaStrings', () => {
    it('returns not specified for no areas', async () => {
      const result = await emailService._buildAreaStrings([])

      expect(result).toEqual({
        mainArea: STATIC_TEXT.not_specified,
        optionalAreas: 'None'
      })
    })

    it('returns not specified for undefined areas', async () => {
      const result = await emailService._buildAreaStrings(undefined)

      expect(result).toEqual({
        mainArea: STATIC_TEXT.not_specified,
        optionalAreas: 'None'
      })
    })

    it('returns not specified for null areas', async () => {
      const result = await emailService._buildAreaStrings(null)

      expect(result).toEqual({
        mainArea: STATIC_TEXT.not_specified,
        optionalAreas: 'None'
      })
    })

    it('builds area strings correctly', async () => {
      const areas = [
        { areaId: 1, primary: true },
        { areaId: 2, primary: false },
        { areaId: 3, primary: false }
      ]

      mockAreaService.getAreaDetailsByIds.mockResolvedValue([
        { id: 1, name: 'Main Area' },
        { id: 2, name: 'Optional 1' },
        { id: 3, name: 'Optional 2' }
      ])

      const result = await emailService._buildAreaStrings(areas)

      expect(result).toEqual({
        mainArea: 'Main Area',
        optionalAreas: 'Optional 1, Optional 2'
      })

      expect(mockAreaService.getAreaDetailsByIds).toHaveBeenCalledWith([
        1, 2, 3
      ])
    })
  })
})
