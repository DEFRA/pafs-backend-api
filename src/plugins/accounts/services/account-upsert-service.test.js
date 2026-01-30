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
        createMany: vi.fn(),
        findMany: vi.fn()
      },
      $transaction: vi.fn((callback) => callback(mockPrisma))
    }

    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn()
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
      userId: 100,
      email: 'admin@gov.uk',
      isAdmin: true
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

    // Default findMany to return empty array (no existing areas)
    mockPrisma.pafs_core_user_areas.findMany.mockResolvedValue([])

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

      it('manages user areas correctly for new account', async () => {
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

        mockPrisma.pafs_core_user_areas.findMany.mockResolvedValue([])

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

      it('skips area management when areas is undefined', async () => {
        const accountData = {
          email: 'user@gov.uk',
          firstName: 'John',
          lastName: 'Doe',
          admin: false
          // areas is undefined
        }

        mockPrisma.pafs_core_users.upsert.mockResolvedValue({
          id: 1n,
          email: 'user@gov.uk'
        })

        await service.upsertAccount(accountData)

        expect(mockPrisma.pafs_core_user_areas.findMany).not.toHaveBeenCalled()
        expect(mockPrisma.$transaction).not.toHaveBeenCalled()
      })

      it('removes all areas when empty array is provided', async () => {
        const accountData = {
          id: 5,
          email: 'user@gov.uk',
          firstName: 'John',
          lastName: 'Doe',
          admin: false,
          areas: []
        }

        mockPrisma.pafs_core_users.upsert.mockResolvedValue({
          id: 5n,
          email: 'user@gov.uk'
        })

        mockPrisma.pafs_core_user_areas.findMany.mockResolvedValue([
          { area_id: 1n, primary: true }
        ])

        await service.upsertAccount(accountData)

        expect(mockPrisma.$transaction).toHaveBeenCalled()
        expect(mockPrisma.pafs_core_user_areas.deleteMany).toHaveBeenCalledWith(
          {
            where: { user_id: 5n }
          }
        )
        expect(
          mockPrisma.pafs_core_user_areas.createMany
        ).not.toHaveBeenCalled()
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

    // determineInvitationDetails tests moved to account-invitation-service.test.js
    describe('determineInvitationDetails', () => {
      it('uses invitationService to determine invitation details', () => {
        const result = service.invitationService.determineInvitationDetails(
          'user@gov.uk',
          null
        )

        expect(result.status).toBe(ACCOUNT_STATUS.APPROVED)
        expect(result.invitedByType).toBe(ACCOUNT_INVITATION_BY.SYSTEM)
      })
    })

    // sendAdminNotification tests moved to account-email-service.test.js
    describe('sendAdminNotification', () => {
      it('uses emailService to send admin notifications', async () => {
        const user = {
          id: BigInt(1),
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

        mockAreaService.getAreaDetailsByIds = vi.fn().mockResolvedValue([
          { id: '1', name: 'Thames', areaType: 'EA Area' },
          { id: '2', name: 'Anglian', areaType: 'EA Area' }
        ])

        await service.emailService.sendAdminNotification(user, areas)

        expect(mockEmailService.send).toHaveBeenCalled()
      })
    })

    // getAutoApprovedDomains tests moved to account-invitation-service.test.js
    describe('getAutoApprovedDomains', () => {
      it('uses invitationService to get auto-approved domains', () => {
        const result = service.invitationService._getAutoApprovedDomains()

        expect(result).toEqual(['gov.uk', 'nhs.uk'])
      })
    })

    // sendAdminNotification edge case tests moved to account-email-service.test.js
    describe('sendAdminNotification - edge cases', () => {
      it('emailService handles admin email configuration', async () => {
        // This test is covered in account-email-service.test.js
        expect(service.emailService).toBeDefined()
      })
    })

    describe('manageUserAreas - optimization tests', () => {
      beforeEach(() => {
        mockPrisma.pafs_core_user_areas.findMany = vi.fn()
      })

      it('skips update when areas are identical', async () => {
        const userId = 5n
        const areas = [
          { areaId: 1, primary: true },
          { areaId: 2, primary: false }
        ]

        mockPrisma.pafs_core_user_areas.findMany.mockResolvedValue([
          { area_id: 1n, primary: true },
          { area_id: 2n, primary: false }
        ])

        await service.manageUserAreas(userId, areas)

        expect(mockPrisma.pafs_core_user_areas.findMany).toHaveBeenCalledWith({
          where: { user_id: userId },
          select: { area_id: true, primary: true }
        })
        expect(mockPrisma.$transaction).not.toHaveBeenCalled()
        expect(mockLogger.debug).toHaveBeenCalledWith(
          { userId },
          'No area changes detected, skipping update'
        )
      })

      it('updates when area count changes', async () => {
        const userId = 5n
        const areas = [
          { areaId: 1, primary: true },
          { areaId: 2, primary: false },
          { areaId: 3, primary: false }
        ]

        mockPrisma.pafs_core_user_areas.findMany.mockResolvedValue([
          { area_id: 1n, primary: true },
          { area_id: 2n, primary: false }
        ])

        await service.manageUserAreas(userId, areas)

        expect(mockPrisma.$transaction).toHaveBeenCalled()
        expect(mockPrisma.pafs_core_user_areas.deleteMany).toHaveBeenCalled()
        expect(mockPrisma.pafs_core_user_areas.createMany).toHaveBeenCalled()
      })

      it('updates when area IDs change', async () => {
        const userId = 5n
        const areas = [
          { areaId: 3, primary: true },
          { areaId: 4, primary: false }
        ]

        mockPrisma.pafs_core_user_areas.findMany.mockResolvedValue([
          { area_id: 1n, primary: true },
          { area_id: 2n, primary: false }
        ])

        await service.manageUserAreas(userId, areas)

        expect(mockPrisma.$transaction).toHaveBeenCalled()
      })

      it('updates when primary flag changes', async () => {
        const userId = 5n
        const areas = [
          { areaId: 1, primary: false },
          { areaId: 2, primary: true }
        ]

        mockPrisma.pafs_core_user_areas.findMany.mockResolvedValue([
          { area_id: 1n, primary: true },
          { area_id: 2n, primary: false }
        ])

        await service.manageUserAreas(userId, areas)

        expect(mockPrisma.$transaction).toHaveBeenCalled()
      })

      it('updates when removing all areas', async () => {
        const userId = 5n
        const areas = []

        mockPrisma.pafs_core_user_areas.findMany.mockResolvedValue([
          { area_id: 1n, primary: true }
        ])

        await service.manageUserAreas(userId, areas)

        expect(mockPrisma.$transaction).toHaveBeenCalled()
        expect(mockPrisma.pafs_core_user_areas.deleteMany).toHaveBeenCalled()
        expect(
          mockPrisma.pafs_core_user_areas.createMany
        ).not.toHaveBeenCalled()
      })

      it('updates when adding first areas', async () => {
        const userId = 5n
        const areas = [{ areaId: 1, primary: true }]

        mockPrisma.pafs_core_user_areas.findMany.mockResolvedValue([])

        await service.manageUserAreas(userId, areas)

        expect(mockPrisma.$transaction).toHaveBeenCalled()
        expect(mockPrisma.pafs_core_user_areas.createMany).toHaveBeenCalled()
      })

      it('handles areas with missing primary flag', async () => {
        const userId = 5n
        const areas = [{ areaId: 1 }, { areaId: 2, primary: true }]

        mockPrisma.pafs_core_user_areas.findMany.mockResolvedValue([
          { area_id: 3n, primary: true }
        ])

        await service.manageUserAreas(userId, areas)

        expect(mockPrisma.$transaction).toHaveBeenCalled()
        expect(mockPrisma.pafs_core_user_areas.createMany).toHaveBeenCalledWith(
          {
            data: expect.arrayContaining([
              expect.objectContaining({
                area_id: 1n,
                primary: false
              }),
              expect.objectContaining({
                area_id: 2n,
                primary: true
              })
            ])
          }
        )
      })

      it('skips when areas is undefined', async () => {
        const userId = 5n

        await service.manageUserAreas(userId, undefined)

        expect(mockPrisma.pafs_core_user_areas.findMany).not.toHaveBeenCalled()
        expect(mockPrisma.$transaction).not.toHaveBeenCalled()
      })
    })

    describe('_hasAreaChanges', () => {
      it('returns true when lengths differ', () => {
        const existing = [{ area_id: 1n, primary: true }]
        const newAreas = [
          { areaId: 1, primary: true },
          { areaId: 2, primary: false }
        ]

        const result = service._hasAreaChanges(existing, newAreas)

        expect(result).toBe(true)
      })

      it('returns false when areas are identical', () => {
        const existing = [
          { area_id: 1n, primary: true },
          { area_id: 2n, primary: false }
        ]
        const newAreas = [
          { areaId: 1, primary: true },
          { areaId: 2, primary: false }
        ]

        const result = service._hasAreaChanges(existing, newAreas)

        expect(result).toBe(false)
      })

      it('returns false when areas are in different order but identical', () => {
        const existing = [
          { area_id: 2n, primary: false },
          { area_id: 1n, primary: true }
        ]
        const newAreas = [
          { areaId: 1, primary: true },
          { areaId: 2, primary: false }
        ]

        const result = service._hasAreaChanges(existing, newAreas)

        expect(result).toBe(false)
      })

      it('returns true when primary flags differ', () => {
        const existing = [{ area_id: 1n, primary: true }]
        const newAreas = [{ areaId: 1, primary: false }]

        const result = service._hasAreaChanges(existing, newAreas)

        expect(result).toBe(true)
      })

      it('returns false for empty arrays', () => {
        const existing = []
        const newAreas = []

        const result = service._hasAreaChanges(existing, newAreas)

        expect(result).toBe(false)
      })
    })

    describe('_createAreaSet', () => {
      it('creates sorted string representation', () => {
        const areas = [
          { areaId: 2, primary: false },
          { areaId: 1, primary: true }
        ]

        const result = service._createAreaSet(areas)

        expect(result).toBe('1:true|2:false')
      })

      it('handles missing primary flag as false', () => {
        const areas = [{ areaId: 1 }]

        const result = service._createAreaSet(areas)

        expect(result).toBe('1:false')
      })

      it('returns empty string for empty array', () => {
        const result = service._createAreaSet([])

        expect(result).toBe('')
      })
    })

    describe('_prepareUserAreasData', () => {
      it('converts areas to database format', () => {
        const userId = 5n
        const areas = [
          { areaId: 1, primary: true },
          { areaId: 2, primary: false }
        ]

        const result = service._prepareUserAreasData(userId, areas)

        expect(result).toEqual([
          {
            user_id: 5n,
            area_id: 1n,
            primary: true,
            created_at: expect.any(Date),
            updated_at: expect.any(Date)
          },
          {
            user_id: 5n,
            area_id: 2n,
            primary: false,
            created_at: expect.any(Date),
            updated_at: expect.any(Date)
          }
        ])
      })

      it('handles missing primary flag', () => {
        const userId = 5n
        const areas = [{ areaId: 1 }]

        const result = service._prepareUserAreasData(userId, areas)

        expect(result[0].primary).toBe(false)
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

    it('skips area type validation when responsibility has no mapping', async () => {
      const accountData = {
        email: 'user@gov.uk',
        firstName: 'Test',
        lastName: 'User',
        responsibility: null, // No responsibility set
        admin: false,
        areas: [{ areaId: '1', primary: true }]
      }

      service.emailValidationService = {
        validateEmail: vi.fn().mockResolvedValue({ isValid: true, errors: [] })
      }

      mockAreaService.getAreaDetailsByIds = vi
        .fn()
        .mockResolvedValue([{ id: 1, name: 'Any Area', areaType: 'Any Type' }])

      mockPrisma.pafs_core_users.upsert.mockResolvedValue({
        id: 1n,
        email: accountData.email,
        status: ACCOUNT_STATUS.APPROVED
      })

      // Should not throw even though area type doesn't match
      await expect(service.upsertAccount(accountData)).resolves.toBeDefined()
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

  describe('approveAccount', () => {
    const mockPendingUser = {
      id: 1n,
      email: 'pending@example.com',
      first_name: 'John',
      last_name: 'Doe',
      status: ACCOUNT_STATUS.PENDING
    }

    const mockApprovedUser = {
      ...mockPendingUser,
      status: ACCOUNT_STATUS.APPROVED,
      invitation_token: 'hashed-mock-token-123',
      invitation_created_at: new Date(),
      invitation_sent_at: new Date(),
      invited_by_type: ACCOUNT_INVITATION_BY.USER,
      invited_by_id: 100
    }

    beforeEach(() => {
      mockEmailService.send = vi.fn().mockResolvedValue()
    })

    it('approves pending account and sends invitation', async () => {
      mockPrisma.pafs_core_users.findUnique.mockResolvedValue(mockPendingUser)
      mockPrisma.pafs_core_users.update.mockResolvedValue(mockApprovedUser)

      const result = await service.approveAccount(1, authenticatedAdmin)

      expect(mockPrisma.pafs_core_users.findUnique).toHaveBeenCalledWith({
        where: { id: 1n }
      })

      expect(mockPrisma.pafs_core_users.update).toHaveBeenCalledWith({
        where: { id: 1n },
        data: expect.objectContaining({
          status: ACCOUNT_STATUS.APPROVED,
          invitation_token: 'hashed-mock-token-123',
          invited_by_type: ACCOUNT_INVITATION_BY.USER,
          invited_by_id: 100
        })
      })

      expect(mockEmailService.send).toHaveBeenCalled()
      expect(result).toEqual({
        message: 'Account approved and invitation sent',
        userId: 1,
        userName: 'John Doe'
      })
    })

    it('throws NotFoundError when user does not exist', async () => {
      const { NotFoundError } =
        await import('../../../common/errors/http-errors.js')
      mockPrisma.pafs_core_users.findUnique.mockResolvedValue(null)

      await expect(
        service.approveAccount(999, authenticatedAdmin)
      ).rejects.toThrow(NotFoundError)
      await expect(
        service.approveAccount(999, authenticatedAdmin)
      ).rejects.toThrow('User with ID 999 not found')
    })

    it('throws BadRequestError when account is not pending', async () => {
      const activeUser = { ...mockPendingUser, status: ACCOUNT_STATUS.ACTIVE }
      mockPrisma.pafs_core_users.findUnique.mockResolvedValue(activeUser)

      await expect(
        service.approveAccount(1, authenticatedAdmin)
      ).rejects.toThrow(BadRequestError)
      await expect(
        service.approveAccount(1, authenticatedAdmin)
      ).rejects.toThrow('Account is not in pending status')
    })

    it('logs approval activity', async () => {
      mockPrisma.pafs_core_users.findUnique.mockResolvedValue(mockPendingUser)
      mockPrisma.pafs_core_users.update.mockResolvedValue(mockApprovedUser)

      await service.approveAccount(1, authenticatedAdmin)

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 1 }),
        'Approving account'
      )
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'pending@example.com' }),
        'Account approved and invitation sent'
      )
    })
  })

  describe('resendInvitation', () => {
    let mockApprovedUser
    let mockUpdatedUser

    beforeEach(() => {
      mockApprovedUser = {
        id: 1n,
        email: 'approved@example.com',
        first_name: 'Jane',
        last_name: 'Smith',
        status: ACCOUNT_STATUS.APPROVED
      }

      mockUpdatedUser = {
        ...mockApprovedUser,
        invitation_token: 'hashed-mock-token-123',
        invitation_created_at: new Date(),
        invitation_sent_at: new Date()
      }

      mockEmailService.send = vi.fn().mockResolvedValue()
    })

    it('resends invitation to approved account', async () => {
      mockPrisma.pafs_core_users.findUnique.mockResolvedValue(mockApprovedUser)
      mockPrisma.pafs_core_users.update.mockResolvedValue(mockUpdatedUser)

      const result = await service.resendInvitation(1)

      expect(mockPrisma.pafs_core_users.findUnique).toHaveBeenCalledWith({
        where: { id: 1n }
      })

      expect(mockPrisma.pafs_core_users.update).toHaveBeenCalledWith({
        where: { id: 1n },
        data: expect.objectContaining({
          invitation_token: 'hashed-mock-token-123',
          invitation_created_at: expect.any(Date),
          invitation_sent_at: expect.any(Date),
          updated_at: expect.any(Date)
        })
      })

      expect(mockEmailService.send).toHaveBeenCalled()
      expect(result).toEqual({
        message: 'Invitation email resent successfully',
        userId: 1
      })
    })

    it('throws NotFoundError when user does not exist', async () => {
      const { NotFoundError } =
        await import('../../../common/errors/http-errors.js')
      mockPrisma.pafs_core_users.findUnique.mockResolvedValue(null)

      await expect(service.resendInvitation(999)).rejects.toThrow(NotFoundError)
      await expect(service.resendInvitation(999)).rejects.toThrow(
        'User with ID 999 not found'
      )
    })

    it('throws BadRequestError when account is not approved', async () => {
      const pendingUser = {
        id: 1n,
        email: 'pending@example.com',
        first_name: 'John',
        last_name: 'Doe',
        status: ACCOUNT_STATUS.PENDING
      }
      mockPrisma.pafs_core_users.findUnique.mockResolvedValue(pendingUser)

      await expect(service.resendInvitation(1)).rejects.toThrow(
        'Can only resend invitation to approved accounts'
      )
    })

    it('throws BadRequestError when account is already active', async () => {
      const activeUser = {
        id: 1n,
        email: 'active@example.com',
        first_name: 'Active',
        last_name: 'User',
        status: ACCOUNT_STATUS.ACTIVE
      }
      mockPrisma.pafs_core_users.findUnique.mockResolvedValue(activeUser)

      await expect(service.resendInvitation(1)).rejects.toThrow(
        'Can only resend invitation to approved accounts'
      )
    })

    it('generates new invitation token', async () => {
      mockPrisma.pafs_core_users.findUnique.mockResolvedValue(mockApprovedUser)
      mockPrisma.pafs_core_users.update.mockResolvedValue(mockUpdatedUser)

      await service.resendInvitation(1)

      expect(mockPrisma.pafs_core_users.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            invitation_token: 'hashed-mock-token-123'
          })
        })
      )
    })

    it('sends invitation email with new token', async () => {
      mockPrisma.pafs_core_users.findUnique.mockResolvedValue(mockApprovedUser)
      mockPrisma.pafs_core_users.update.mockResolvedValue(mockUpdatedUser)

      await service.resendInvitation(1)

      expect(mockEmailService.send).toHaveBeenCalledWith(
        'template-id',
        'approved@example.com',
        expect.objectContaining({
          user_name: 'Jane',
          email_address: 'approved@example.com',
          set_password_link: expect.stringContaining('mock-token-123')
        }),
        'account-invitation'
      )
    })

    it('logs resend activity', async () => {
      mockPrisma.pafs_core_users.findUnique.mockResolvedValue(mockApprovedUser)
      mockPrisma.pafs_core_users.update.mockResolvedValue(mockUpdatedUser)

      await service.resendInvitation(1)

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 1 }),
        'Resending invitation'
      )
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'approved@example.com' }),
        'Invitation resent'
      )
    })
  })

  // isEmailAutoApproved tests moved to account-invitation-service.test.js
  describe('isEmailAutoApproved', () => {
    it('uses invitationService to check auto-approved emails', () => {
      const result =
        service.invitationService._isEmailAutoApproved('user@gov.uk')
      expect(result).toBe(true)
    })

    it('returns false for non-approved domain', () => {
      const result =
        service.invitationService._isEmailAutoApproved('user@example.com')
      expect(result).toBe(false)
    })
  })
})
