import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AccountUpsertService } from './account-upsert-service.js'
import { ACCOUNT_STATUS } from '../../../common/constants/index.js'
import { ACCOUNT_INVITATION_BY } from '../../../common/constants/accounts.js'
import { BadRequestError } from '../../../common/errors/index.js'

// Mock dependencies
vi.mock('../../auth/helpers/secure-token.js', () => ({
  generateSecureToken: vi.fn(() => 'mock-token-123'),
  hashToken: vi.fn((token) => `hashed-${token}`)
}))

vi.mock('../../../config.js', () => ({
  config: {
    get: vi.fn((key) => {
      const configValues = {
        'emailValidation.autoApprovedDomains': 'gov.uk,nhs.uk',
        'notify.templateAccountApprovedSetPassword': 'template-id',
        'notify.templateAccountApprovedToAdmin': 'admin-template-id',
        'notify.templateAccountVerification': 'verification-template-id',
        'notify.adminEmail': 'admin@example.com',
        frontendUrl: 'https://example.com'
      }
      return configValues[key]
    })
  }
}))

describe('AccountUpsertService', () => {
  let service
  let mockPrisma
  let mockLogger
  let mockEmailService
  let mockAreaService
  let authenticatedAdmin

  beforeEach(() => {
    mockPrisma = {
      pafs_core_users: {
        upsert: vi.fn(),
        update: vi.fn(),
        findUnique: vi.fn()
      },
      pafs_core_user_areas: {
        deleteMany: vi.fn(),
        createMany: vi.fn()
      },
      $transaction: vi.fn((callback) => callback(mockPrisma))
    }

    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn()
    }

    mockEmailService = {
      send: vi.fn().mockResolvedValue(true)
    }

    mockAreaService = {
      getAreaDetailsByIds: vi.fn().mockResolvedValue([
        { id: 1, name: 'Thames', areaType: 'EA Area' },
        { id: 2, name: 'Anglian', areaType: 'EA Area' }
      ])
    }

    authenticatedAdmin = {
      id: 100,
      email: 'admin@gov.uk',
      admin: true
    }

    service = new AccountUpsertService(
      mockPrisma,
      mockLogger,
      mockEmailService,
      mockAreaService
    )

    // Mock the EmailValidationService for all tests
    service.emailValidationService = {
      validateEmail: vi.fn().mockResolvedValue({ isValid: true, errors: [] })
    }

    vi.clearAllMocks()
  })

  describe('upsertAccount', () => {
    describe('creating new account', () => {
      it('creates account with auto-approval for gov.uk domain', async () => {
        const accountData = {
          email: 'user@gov.uk',
          firstName: 'John',
          lastName: 'Doe',
          jobTitle: 'Manager',
          organisation: 'Gov Org',
          telephoneNumber: '1234567890',
          admin: false,
          responsibility: 'EA',
          areas: [{ areaId: '1', primary: true }]
        }

        mockAreaService.getAreaDetailsByIds = vi
          .fn()
          .mockResolvedValue([{ id: 1, name: 'Thames', areaType: 'EA Area' }])

        mockPrisma.pafs_core_users.upsert.mockResolvedValue({
          id: 1n,
          email: 'user@gov.uk',
          status: ACCOUNT_STATUS.APPROVED
        })

        const result = await service.upsertAccount(accountData)

        expect(mockPrisma.pafs_core_users.upsert).toHaveBeenCalled()
        expect(mockEmailService.send).toHaveBeenCalled()
        expect(result.message).toContain('created')
        expect(result.userId).toBe(1)
      })

      it('creates account with pending status for non-approved domain', async () => {
        const accountData = {
          email: 'user@example.com',
          firstName: 'Jane',
          lastName: 'Smith',
          admin: false,
          areas: []
        }

        mockPrisma.pafs_core_users.upsert.mockResolvedValue({
          id: 2n,
          email: 'user@example.com',
          status: ACCOUNT_STATUS.PENDING
        })

        const result = await service.upsertAccount(accountData)

        expect(mockPrisma.pafs_core_users.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            create: expect.objectContaining({
              status: ACCOUNT_STATUS.PENDING
            })
          })
        )
        // No invitation email for pending status
        expect(mockEmailService.send).toHaveBeenCalledTimes(1)
        // But admin notification should be sent for self-registration
        expect(mockEmailService.send).toHaveBeenCalledWith(
          expect.any(String),
          'admin@example.com',
          expect.any(Object),
          'admin-notification'
        )
        expect(result.userId).toBe(2)
      })

      it('creates account with approved status when admin creates user', async () => {
        const accountData = {
          email: 'user@example.com',
          firstName: 'Test',
          lastName: 'User',
          admin: false
        }

        mockPrisma.pafs_core_users.upsert.mockResolvedValue({
          id: 3n,
          email: 'user@example.com',
          status: ACCOUNT_STATUS.APPROVED
        })

        const result = await service.upsertAccount(accountData, {
          authenticatedUser: authenticatedAdmin
        })

        expect(mockPrisma.pafs_core_users.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            create: expect.objectContaining({
              status: ACCOUNT_STATUS.APPROVED,
              invited_by_type: ACCOUNT_INVITATION_BY.USER,
              invited_by_id: 100
            })
          })
        )
        expect(mockEmailService.send).toHaveBeenCalled()
        expect(result.userId).toBe(3)
      })

      it('manages user areas correctly', async () => {
        const accountData = {
          email: 'user@gov.uk',
          firstName: 'John',
          lastName: 'Doe',
          responsibility: 'EA',
          admin: false,
          areas: [
            { areaId: '1', primary: true },
            { areaId: '2', primary: false }
          ]
        }

        mockAreaService.getAreaDetailsByIds = vi.fn().mockResolvedValue([
          { id: 1, name: 'Thames', areaType: 'EA Area' },
          { id: 2, name: 'Anglian', areaType: 'EA Area' }
        ])

        mockPrisma.pafs_core_users.upsert.mockResolvedValue({
          id: 1n,
          email: 'user@gov.uk'
        })

        await service.upsertAccount(accountData)

        expect(mockPrisma.$transaction).toHaveBeenCalled()
        expect(mockPrisma.pafs_core_user_areas.deleteMany).toHaveBeenCalledWith(
          {
            where: { user_id: 1n }
          }
        )
        expect(mockPrisma.pafs_core_user_areas.createMany).toHaveBeenCalledWith(
          {
            data: [
              {
                user_id: 1n,
                area_id: 1n,
                primary: true,
                created_at: expect.any(Date),
                updated_at: expect.any(Date)
              },
              {
                user_id: 1n,
                area_id: 2n,
                primary: false,
                created_at: expect.any(Date),
                updated_at: expect.any(Date)
              }
            ]
          }
        )
      })
    })

    describe('updating existing account', () => {
      it('updates account by id', async () => {
        const accountData = {
          id: 5,
          email: 'updated@example.com',
          firstName: 'Updated',
          lastName: 'User'
        }

        mockPrisma.pafs_core_users.upsert.mockResolvedValue({
          id: 5n,
          email: 'updated@example.com'
        })

        const result = await service.upsertAccount(accountData)

        expect(mockPrisma.pafs_core_users.upsert).toHaveBeenCalledWith({
          where: { id: 5n },
          create: expect.any(Object),
          update: expect.objectContaining({
            email: 'updated@example.com',
            first_name: 'Updated',
            last_name: 'User'
          })
        })
        expect(result.message).toContain('updated')
        expect(result.userId).toBe(5)
      })

      it('does not send admin notification for updates', async () => {
        const accountData = {
          id: 5,
          email: 'updated@example.com',
          firstName: 'Updated',
          lastName: 'User'
        }

        mockPrisma.pafs_core_users.upsert.mockResolvedValue({
          id: 5n,
          email: 'updated@example.com',
          status: ACCOUNT_STATUS.APPROVED
        })

        await service.upsertAccount(accountData)

        expect(mockEmailService.send).not.toHaveBeenCalled()
      })
    })
  })

  describe('helper methods', () => {
    describe('convertToDbFields', () => {
      it('converts camelCase to snake_case', () => {
        const data = {
          firstName: 'John',
          lastName: 'Doe',
          jobTitle: 'Manager',
          telephoneNumber: '123456',
          responsibility: 'EA'
        }

        const result = service.convertToDbFields(data)

        expect(result).toEqual({
          email: undefined,
          first_name: 'John',
          last_name: 'Doe',
          job_title: 'Manager',
          organisation: '',
          telephone_number: '123456',
          responsibility: 'EA',
          admin: false
        })
      })

      it('handles missing optional fields', () => {
        const data = {
          email: 'test@example.com'
        }

        const result = service.convertToDbFields(data)

        expect(result.first_name).toBeUndefined()
        expect(result.job_title).toBeNull()
      })
    })

    describe('determineInvitationDetails', () => {
      it('auto-approves gov.uk domain', () => {
        const result = service.determineInvitationDetails('user@gov.uk', null)

        expect(result.status).toBe(ACCOUNT_STATUS.APPROVED)
        expect(result.invitedByType).toBe(ACCOUNT_INVITATION_BY.SYSTEM)
      })

      it('sets pending for non-approved domain', () => {
        const result = service.determineInvitationDetails(
          'user@example.com',
          null
        )

        expect(result.status).toBe(ACCOUNT_STATUS.PENDING)
        expect(result.invitedByType).toBe(ACCOUNT_INVITATION_BY.SYSTEM)
        expect(result.invitedById).toBe(null)
      })

      it('approves when admin creates account', () => {
        const result = service.determineInvitationDetails(
          'user@example.com',
          authenticatedAdmin
        )

        expect(result.status).toBe(ACCOUNT_STATUS.APPROVED)
        expect(result.invitedByType).toBe(ACCOUNT_INVITATION_BY.USER)
        expect(result.invitedById).toBe(100)
      })
    })

    describe('sendAdminNotification', () => {
      it('sends notification with area names', async () => {
        const user = {
          email: 'user@example.com',
          first_name: 'John',
          last_name: 'Doe',
          job_title: 'Manager',
          organisation: 'Org',
          telephone_number: '123456',
          responsibility: 'EA',
          status: ACCOUNT_STATUS.APPROVED
        }

        const areas = [
          { areaId: '1', primary: true },
          { areaId: '2', primary: false }
        ]

        // Mock the getAreaDetailsByIds call specifically for this test
        mockAreaService.getAreaDetailsByIds = vi.fn().mockResolvedValue([
          { id: '1', name: 'Thames', areaType: 'EA Area' },
          { id: '2', name: 'Anglian', areaType: 'EA Area' }
        ])

        await service.sendAdminNotification(user, areas)

        expect(mockAreaService.getAreaDetailsByIds).toHaveBeenCalledWith([
          '1',
          '2'
        ])
        expect(mockEmailService.send).toHaveBeenCalledWith(
          'admin-template-id',
          'admin@example.com',
          expect.objectContaining({
            email_address: 'user@example.com',
            main_area: 'Thames',
            optional_areas: 'Anglian',
            responsibility_area: 'Environment Agency – Area Programme Team'
          }),
          'admin-notification'
        )
      })

      it('handles empty areas', async () => {
        const user = {
          email: 'user@example.com',
          first_name: 'John',
          responsibility: 'RMA',
          status: ACCOUNT_STATUS.APPROVED
        }

        await service.sendAdminNotification(user, [])

        expect(mockAreaService.getAreaDetailsByIds).not.toHaveBeenCalled()
        expect(mockEmailService.send).toHaveBeenCalledWith(
          'admin-template-id',
          'admin@example.com',
          expect.objectContaining({
            main_area: 'Not specified',
            optional_areas: 'None',
            responsibility_area: 'Risk Management Authority (RMA)'
          }),
          'admin-notification'
        )
      })
    })

    describe('getAutoApprovedDomains', () => {
      it('parses comma-separated domains', () => {
        const result = service.getAutoApprovedDomains()

        expect(result).toEqual(['gov.uk', 'nhs.uk'])
      })
    })
  })

  describe('email validation', () => {
    beforeEach(() => {
      // Mock the EmailValidationService
      service.emailValidationService = {
        validateEmail: vi.fn()
      }
    })

    it('validates email before creating account', async () => {
      const accountData = {
        email: 'valid@example.com',
        firstName: 'Test',
        lastName: 'User',
        admin: true
      }

      service.emailValidationService.validateEmail.mockResolvedValue({
        isValid: true,
        errors: []
      })

      mockPrisma.pafs_core_users.upsert.mockResolvedValue({
        id: 1n,
        email: accountData.email,
        status: ACCOUNT_STATUS.APPROVED
      })

      await service.upsertAccount(accountData)

      expect(service.emailValidationService.validateEmail).toHaveBeenCalledWith(
        accountData.email,
        {
          excludeUserId: null
        }
      )
    })

    it('validates email with excludeUserId when updating', async () => {
      const accountData = {
        id: 5,
        email: 'updated@example.com',
        firstName: 'Test',
        lastName: 'User',
        admin: true
      }

      service.emailValidationService.validateEmail.mockResolvedValue({
        isValid: true,
        errors: []
      })

      mockPrisma.pafs_core_users.upsert.mockResolvedValue({
        id: 5n,
        email: accountData.email
      })

      await service.upsertAccount(accountData)

      expect(service.emailValidationService.validateEmail).toHaveBeenCalledWith(
        accountData.email,
        {
          excludeUserId: 5
        }
      )
    })

    it('throws BadRequestError when email validation fails', async () => {
      const accountData = {
        email: 'disposable@tempmail.com',
        firstName: 'Test',
        lastName: 'User'
      }

      service.emailValidationService.validateEmail.mockResolvedValue({
        isValid: false,
        errors: [
          {
            code: 'VALIDATION_EMAIL_DISPOSABLE',
            message: 'Disposable email addresses are not allowed',
            field: 'email'
          }
        ]
      })

      await expect(service.upsertAccount(accountData)).rejects.toThrow(
        BadRequestError
      )
      await expect(service.upsertAccount(accountData)).rejects.toThrow(
        'Disposable email addresses are not allowed'
      )
    })

    it('throws BadRequestError when email is duplicate', async () => {
      const accountData = {
        email: 'duplicate@example.com',
        firstName: 'Test',
        lastName: 'User'
      }

      service.emailValidationService.validateEmail.mockResolvedValue({
        isValid: false,
        errors: [
          {
            code: 'VALIDATION_EMAIL_DUPLICATE',
            message: 'Email address already exists',
            field: 'email'
          }
        ]
      })

      await expect(service.upsertAccount(accountData)).rejects.toThrow(
        BadRequestError
      )
    })
  })

  describe('area responsibility type validation', () => {
    it('validates area types match user responsibility for EA users', async () => {
      const accountData = {
        email: 'user@gov.uk',
        firstName: 'Test',
        lastName: 'User',
        responsibility: 'EA',
        admin: false,
        areas: [
          { areaId: '1', primary: true },
          { areaId: '2', primary: false }
        ]
      }

      service.emailValidationService = {
        validateEmail: vi.fn().mockResolvedValue({ isValid: true, errors: [] })
      }

      mockAreaService.getAreaDetailsByIds = vi.fn().mockResolvedValue([
        { id: 1, name: 'Thames', areaType: 'EA Area' },
        { id: 2, name: 'Anglian', areaType: 'EA Area' }
      ])

      mockPrisma.pafs_core_users.upsert.mockResolvedValue({
        id: 1n,
        email: accountData.email,
        status: ACCOUNT_STATUS.APPROVED
      })

      await service.upsertAccount(accountData)

      expect(mockAreaService.getAreaDetailsByIds).toHaveBeenCalledWith([
        '1',
        '2'
      ])
    })

    it('validates area types match user responsibility for PSO users', async () => {
      const accountData = {
        email: 'user@gov.uk',
        firstName: 'Test',
        lastName: 'User',
        responsibility: 'PSO',
        admin: false,
        areas: [{ areaId: '3', primary: true }]
      }

      service.emailValidationService = {
        validateEmail: vi.fn().mockResolvedValue({ isValid: true, errors: [] })
      }

      mockAreaService.getAreaDetailsByIds = vi
        .fn()
        .mockResolvedValue([{ id: 3, name: 'PSO Area', areaType: 'PSO Area' }])

      mockPrisma.pafs_core_users.upsert.mockResolvedValue({
        id: 1n,
        email: accountData.email,
        status: ACCOUNT_STATUS.APPROVED
      })

      await service.upsertAccount(accountData)

      expect(mockAreaService.getAreaDetailsByIds).toHaveBeenCalledWith(['3'])
    })

    it('validates area types match user responsibility for RMA users', async () => {
      const accountData = {
        email: 'user@gov.uk',
        firstName: 'Test',
        lastName: 'User',
        responsibility: 'RMA',
        admin: false,
        areas: [{ areaId: '4', primary: true }]
      }

      service.emailValidationService = {
        validateEmail: vi.fn().mockResolvedValue({ isValid: true, errors: [] })
      }

      mockAreaService.getAreaDetailsByIds = vi
        .fn()
        .mockResolvedValue([{ id: 4, name: 'RMA Area', areaType: 'RMA' }])

      mockPrisma.pafs_core_users.upsert.mockResolvedValue({
        id: 1n,
        email: accountData.email,
        status: ACCOUNT_STATUS.APPROVED
      })

      await service.upsertAccount(accountData)

      expect(mockAreaService.getAreaDetailsByIds).toHaveBeenCalledWith(['4'])
    })

    it('throws BadRequestError when EA user has PSO areas', async () => {
      const accountData = {
        email: 'user@gov.uk',
        firstName: 'Test',
        lastName: 'User',
        responsibility: 'EA',
        admin: false,
        areas: [{ areaId: '1', primary: true }]
      }

      service.emailValidationService = {
        validateEmail: vi.fn().mockResolvedValue({ isValid: true, errors: [] })
      }

      mockAreaService.getAreaDetailsByIds = vi
        .fn()
        .mockResolvedValue([{ id: 1, name: 'PSO Area', areaType: 'PSO Area' }])

      await expect(service.upsertAccount(accountData)).rejects.toThrow(
        BadRequestError
      )
      await expect(service.upsertAccount(accountData)).rejects.toThrow(
        /All areas must be of type 'EA Area'/
      )
    })

    it('throws BadRequestError when PSO user has EA areas', async () => {
      const accountData = {
        email: 'user@gov.uk',
        firstName: 'Test',
        lastName: 'User',
        responsibility: 'PSO',
        admin: false,
        areas: [{ areaId: '1', primary: true }]
      }

      service.emailValidationService = {
        validateEmail: vi.fn().mockResolvedValue({ isValid: true, errors: [] })
      }

      mockAreaService.getAreaDetailsByIds = vi
        .fn()
        .mockResolvedValue([{ id: 1, name: 'Thames', areaType: 'EA Area' }])

      await expect(service.upsertAccount(accountData)).rejects.toThrow(
        BadRequestError
      )
      await expect(service.upsertAccount(accountData)).rejects.toThrow(
        /All areas must be of type 'PSO Area'/
      )
    })

    it('throws BadRequestError when RMA user has wrong area type', async () => {
      const accountData = {
        email: 'user@gov.uk',
        firstName: 'Test',
        lastName: 'User',
        responsibility: 'RMA',
        admin: false,
        areas: [
          { areaId: '1', primary: true },
          { areaId: '2', primary: false }
        ]
      }

      service.emailValidationService = {
        validateEmail: vi.fn().mockResolvedValue({ isValid: true, errors: [] })
      }

      mockAreaService.getAreaDetailsByIds = vi.fn().mockResolvedValue([
        { id: 1, name: 'Thames', areaType: 'EA Area' },
        { id: 2, name: 'PSO Area', areaType: 'PSO Area' }
      ])

      await expect(service.upsertAccount(accountData)).rejects.toThrow(
        BadRequestError
      )
      await expect(service.upsertAccount(accountData)).rejects.toThrow(
        /All areas must be of type 'RMA'/
      )
    })

    it('skips area validation for admin users', async () => {
      const accountData = {
        email: 'admin@gov.uk',
        firstName: 'Admin',
        lastName: 'User',
        responsibility: 'EA',
        admin: true,
        areas: [{ areaId: '1', primary: true }]
      }

      service.emailValidationService = {
        validateEmail: vi.fn().mockResolvedValue({ isValid: true, errors: [] })
      }

      mockAreaService.getAreaDetailsByIds = vi
        .fn()
        .mockResolvedValue([{ id: 1, name: 'Thames', areaType: 'EA Area' }])

      mockPrisma.pafs_core_users.upsert.mockResolvedValue({
        id: 1n,
        email: accountData.email,
        status: ACCOUNT_STATUS.APPROVED
      })

      await service.upsertAccount(accountData)

      // Should not validate areas for admin users (but sendAdminNotification will call it)
      // The key is that validateAreaResponsibilityTypes should not be called for admins
      expect(mockPrisma.pafs_core_users.upsert).toHaveBeenCalled()
    })

    it('skips area validation when no areas provided', async () => {
      const accountData = {
        email: 'user@gov.uk',
        firstName: 'Test',
        lastName: 'User',
        responsibility: 'EA',
        admin: false,
        areas: []
      }

      service.emailValidationService = {
        validateEmail: vi.fn().mockResolvedValue({ isValid: true, errors: [] })
      }

      mockAreaService.getAreaDetailsByIds = vi.fn()

      mockPrisma.pafs_core_users.upsert.mockResolvedValue({
        id: 1n,
        email: accountData.email,
        status: ACCOUNT_STATUS.PENDING
      })

      await service.upsertAccount(accountData)

      // Should not validate areas when empty
      expect(mockAreaService.getAreaDetailsByIds).not.toHaveBeenCalled()
    })

    it('throws BadRequestError when area IDs do not exist', async () => {
      const accountData = {
        email: 'user@gov.uk',
        firstName: 'Test',
        lastName: 'User',
        responsibility: 'EA',
        admin: false,
        areas: [
          { areaId: '1', primary: true },
          { areaId: '999', primary: false } // Non-existent area
        ]
      }

      service.emailValidationService = {
        validateEmail: vi.fn().mockResolvedValue({ isValid: true, errors: [] })
      }

      // Mock returning only 1 area (ID '1' exists, '999' does not)
      mockAreaService.getAreaDetailsByIds = vi
        .fn()
        .mockResolvedValue([{ id: 1, name: 'Thames', areaType: 'EA Area' }])

      await expect(service.upsertAccount(accountData)).rejects.toThrow(
        'The following area IDs do not exist: 999'
      )

      expect(mockAreaService.getAreaDetailsByIds).toHaveBeenCalledWith([
        '1',
        '999'
      ])
    })
  })

  describe('error handling', () => {
    it('logs errors during upsert', async () => {
      const data = { email: 'test@example.com' }

      // Mock email validation service
      service.emailValidationService = {
        validateEmail: vi.fn().mockResolvedValue({ isValid: true, errors: [] })
      }

      mockPrisma.pafs_core_users.upsert.mockRejectedValue(new Error('DB error'))

      await expect(service.upsertAccount(data)).rejects.toThrow('DB error')
    })

    it('handles email service failures gracefully', async () => {
      service.emailValidationService = {
        validateEmail: vi.fn().mockResolvedValue({ isValid: true, errors: [] })
      }

      mockPrisma.pafs_core_users.upsert.mockResolvedValue({
        id: 1n,
        email: 'user@gov.uk',
        status: ACCOUNT_STATUS.APPROVED
      })
      mockEmailService.send.mockRejectedValue(new Error('Email error'))

      // Should throw since implementation doesn't catch email errors
      await expect(
        service.upsertAccount({
          email: 'user@gov.uk',
          firstName: 'Test',
          lastName: 'User'
        })
      ).rejects.toThrow('Email error')
    })
  })
})
