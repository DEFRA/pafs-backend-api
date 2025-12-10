import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AccountRequestService } from './account-request-service.js'

import { config } from '../../../config.js'

// Mock config module with Vitest
vi.mock('../../../config.js', () => ({
  config: {
    get: vi.fn((key) => {
      if (key === 'notify.templateAccountVerification') {
        return 'tmpl-123'
      }
      if (key === 'notify.templateAccountApprovedToAdmin') {
        return 'tmpl-approved-admin'
      }
      if (key === 'notify.templateAccountApprovedSetPassword') {
        return 'tmpl-approved-setpw'
      }
      if (key === 'notify.adminEmail') {
        return 'admin@example.com'
      }
      if (key === 'frontendUrl') {
        return 'https://frontend.example.com'
      }
      // Ensure auto-approved domains are non-empty and do not include example.com
      if (key === 'notify.autoApprovedDomains') {
        return 'gov.uk,yopmail.com'
      }
      return ''
    })
  }
}))

const makeLogger = () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
})

const makePrisma = () => ({
  $transaction: vi.fn((fn) =>
    fn({
      pafs_core_users: { create: vi.fn() },
      pafs_core_user_areas: { create: vi.fn() }
    })
  ),
  pafs_core_users: { create: vi.fn(), update: vi.fn().mockResolvedValue({}) },
  pafs_core_user_areas: { create: vi.fn() }
})

const makeEmailService = () => ({
  send: vi.fn().mockResolvedValue(undefined)
})

const makeAreaService = (areas = []) => ({
  getAreasByIds: vi.fn().mockResolvedValue(areas)
})

const userData = {
  firstName: 'Jane',
  lastName: 'Doe',
  // Ensure userData.emailAddress does NOT include any auto approved domain
  emailAddress: 'user@example.com',
  telephoneNumber: '123',
  organisation: 'Org',
  jobTitle: 'Dev',
  responsibility: 'Resp'
}

const areasPayload = [
  { area_id: '10', primary: true },
  { area_id: '20', primary: false }
]

describe('AccountRequestService', () => {
  let mockPrisma
  let mockLogger
  let accountRequestService
  let prisma, logger, emailService, areaService, svc

  beforeEach(() => {
    vi.clearAllMocks()

    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn()
    }

    mockPrisma = {
      $transaction: vi.fn(),
      pafs_core_users: {
        create: vi.fn()
      },
      pafs_core_user_areas: {
        create: vi.fn()
      }
    }

    // Provide mocks so createAccountRequest can fetch areas and send email
    const mockEmailSvc = makeEmailService()
    const mockAreaSvc = makeAreaService([
      { id: '11', name: 'Area 11', area_type: 'Type A' },
      { id: '2', name: 'Area 2', area_type: 'Type B' }
    ])

    accountRequestService = new AccountRequestService(
      mockPrisma,
      mockLogger,
      mockEmailSvc,
      mockAreaSvc
    )

    prisma = makePrisma()
    // Ensure update exists on prisma used in tests
    prisma.pafs_core_users.update = vi.fn().mockResolvedValue({})
    logger = makeLogger()
    emailService = makeEmailService()
    areaService = makeAreaService([
      { id: '10', name: 'Area 10', area_type: 'Type X' },
      { id: '20', name: 'Area 20', area_type: 'Type Y' }
    ])
    svc = new AccountRequestService(prisma, logger, emailService, areaService)
  })

  describe('constructor', () => {
    it('should initialize with prisma and logger', () => {
      expect(accountRequestService.prisma).toBe(mockPrisma)
      expect(accountRequestService.logger).toBe(mockLogger)
    })
  })

  describe('createAccountRequest', () => {
    const userDataLocal = {
      firstName: 'John',
      lastName: 'Doe',
      emailAddress: 'john.doe@example.com',
      telephoneNumber: '1234567890',
      organisation: 'Test Org',
      jobTitle: 'Developer'
    }

    const areasLocal = [
      { area_id: 11, primary: true },
      { area_id: 2, primary: false }
    ]

    it('should create account request successfully with user and areas', async () => {
      const mockUser = {
        id: BigInt('1'),
        first_name: 'John',
        last_name: 'Doe',
        email: 'john.doe@example.com',
        telephone_number: '1234567890',
        organisation: 'Test Org',
        job_title: 'Developer',
        status: 'pending',
        created_at: new Date(),
        updated_at: new Date()
      }

      const mockUserAreas = [
        {
          id: BigInt('1'),
          user_id: BigInt('1'),
          area_id: BigInt('11'),
          primary: true,
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: BigInt('2'),
          user_id: BigInt('1'),
          area_id: BigInt('2'),
          primary: false,
          created_at: new Date(),
          updated_at: new Date()
        }
      ]

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          pafs_core_users: {
            create: vi.fn().mockResolvedValue(mockUser)
          },
          pafs_core_user_areas: {
            create: vi.fn()
          }
        }
        tx.pafs_core_user_areas.create
          .mockResolvedValueOnce(mockUserAreas[0])
          .mockResolvedValueOnce(mockUserAreas[1])
        return callback(tx)
      })

      const result = await accountRequestService.createAccountRequest(
        userDataLocal,
        areasLocal
      )

      expect(mockLogger.info).toHaveBeenCalledWith('Creating account request')
      expect(mockPrisma.$transaction).toHaveBeenCalled()
      expect(result.success).toBe(true)
      expect(result.user.id).toBe('1')
      expect(result.user.status).toBe('pending')
      expect(result.areas).toHaveLength(2)
      expect(result.areas[0].area_id).toBe('11')
      expect(result.areas[1].area_id).toBe('2')
    })

    it('should handle optional fields correctly', async () => {
      const userDataMinimal = {
        firstName: 'Jane',
        lastName: 'Smith',
        emailAddress: 'jane.smith@example.com'
      }

      const mockUser = {
        id: BigInt('2'),
        first_name: 'Jane',
        last_name: 'Smith',
        email: 'jane.smith@example.com',
        telephone_number: null,
        organisation: '',
        job_title: null,
        status: 'pending',
        created_at: new Date(),
        updated_at: new Date()
      }

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          pafs_core_users: {
            create: vi.fn().mockResolvedValue(mockUser)
          },
          pafs_core_user_areas: {
            create: vi.fn().mockResolvedValue({
              id: BigInt('3'),
              user_id: BigInt('2'),
              area_id: BigInt('1'),
              primary: false,
              created_at: new Date(),
              updated_at: new Date()
            })
          }
        }
        return callback(tx)
      })

      const result = await accountRequestService.createAccountRequest(
        userDataMinimal,
        [{ area_id: 1, primary: false }]
      )

      expect(result.success).toBe(true)
      expect(result.user.organisation).toBe('')
    })

    it('should handle duplicate email error with P2002 code', async () => {
      const duplicateError = new Error('Unique constraint violation')
      duplicateError.code = 'P2002'
      duplicateError.meta = { target: ['email'] }

      mockPrisma.$transaction.mockRejectedValue(duplicateError)

      const result = await accountRequestService.createAccountRequest(
        userDataLocal,
        areasLocal
      )

      expect(mockLogger.error).toHaveBeenCalledWith(
        { error: duplicateError },
        'Failed to create account request'
      )
      expect(result.success).toBe(false)
      expect(result.error).toBe('account.email_already_exists')
    })

    it('should handle duplicate email error with message check', async () => {
      const duplicateError = new Error(
        'Unique constraint failed on the fields: (`email`)'
      )

      mockPrisma.$transaction.mockRejectedValue(duplicateError)

      const result = await accountRequestService.createAccountRequest(
        userDataLocal,
        areasLocal
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('account.email_already_exists')
    })

    it('should handle database errors', async () => {
      const dbError = new Error('Database connection failed')
      mockPrisma.$transaction.mockRejectedValue(dbError)

      const result = await accountRequestService.createAccountRequest(
        userDataLocal,
        areasLocal
      )

      expect(mockLogger.error).toHaveBeenCalledWith(
        { error: dbError },
        'Failed to create account request'
      )
      expect(result.success).toBe(false)
      expect(result.error).toBe('Database connection failed')
    })

    it('should clean ANSI color codes from error messages', async () => {
      const errorWithAnsi = new Error(
        '\u001b[31mInvalid \u001b[1m`prisma.pafs_core_users.create()`\u001b[22m invocation:\u001b[39m\n\n\nUnique constraint failed on the fields: (`email`)'
      )
      errorWithAnsi.code = 'P2002'
      errorWithAnsi.meta = { target: ['email'] }

      mockPrisma.$transaction.mockRejectedValue(errorWithAnsi)

      const result = await accountRequestService.createAccountRequest(
        userDataLocal,
        areasLocal
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('account.email_already_exists')
    })

    it('should convert BigInt values to strings', async () => {
      const mockUser = {
        id: BigInt('100'),
        first_name: 'Test',
        last_name: 'User',
        email: 'test@example.com',
        status: 'pending',
        created_at: new Date(),
        updated_at: new Date()
      }

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          pafs_core_users: {
            create: vi.fn().mockResolvedValue(mockUser)
          },
          pafs_core_user_areas: {
            create: vi.fn().mockResolvedValue({
              id: BigInt('200'),
              user_id: BigInt('100'),
              area_id: BigInt('5'),
              primary: true,
              created_at: new Date(),
              updated_at: new Date()
            })
          }
        }
        return callback(tx)
      })

      const result = await accountRequestService.createAccountRequest(
        {
          firstName: 'Test',
          lastName: 'User',
          emailAddress: 'test@example.com'
        },
        [{ area_id: 5, primary: true }]
      )
      expect(result.success).toBe(true)
    })
  })

  it('creates account request, fetches areas via AreaService, and sends email', async () => {
    const createdUser = { id: 1n }
    const createdUserAreas = [
      { id: 100n, user_id: 1n, area_id: 10n, primary: true },
      { id: 101n, user_id: 1n, area_id: 20n, primary: false }
    ]

    prisma.$transaction.mockImplementation(async (fn) => {
      const tx = {
        pafs_core_users: { create: vi.fn().mockResolvedValue(createdUser) },
        pafs_core_user_areas: {
          create: vi
            .fn()
            .mockResolvedValueOnce(createdUserAreas[0])
            .mockResolvedValueOnce(createdUserAreas[1])
        }
      }
      return fn(tx)
    })

    const res = await svc.createAccountRequest(userData, areasPayload)
    expect(res.success).toBe(true)
    expect(areaService.getAreasByIds).toHaveBeenCalledWith(['10', '20'])
    expect(emailService.send).toHaveBeenCalledWith(
      config.get('notify.templateAccountVerification'),
      config.get('notify.adminEmail'),
      expect.objectContaining({
        first_name: 'Jane',
        responsibility_area: 'Type X',
        main_area: 'Area 10',
        optional_areas: 'Area 20'
      }),
      'account-verification'
    )
  })

  it('handles duplicate email error', async () => {
    const err = new Error('Unique constraint failed on the fields: (`email`)')
    err.code = 'P2002'
    err.meta = { target: ['email'] }

    prisma.$transaction.mockRejectedValue(err)

    const res = await svc.createAccountRequest(userData, areasPayload)
    expect(res.success).toBe(false)
    expect(res.error).toBe('account.email_already_exists')
  })

  it('handles generic error and cleans message', async () => {
    const err = new Error('\x1b[31mSomething went wrong\x1b[0m')
    prisma.$transaction.mockRejectedValue(err)

    const res = await svc.createAccountRequest(userData, areasPayload)
    expect(res.success).toBe(false)
    expect(res.error).toBe('Something went wrong')
    expect(logger.error).toHaveBeenCalled()
  })

  it('throws if AreaService missing getAreasByIds', async () => {
    const badSvc = new AccountRequestService(prisma, logger, emailService, {})
    prisma.$transaction.mockResolvedValue({
      user: { id: 1n },
      userAreas: []
    })
    const res = await badSvc.createAccountRequest(userData, [])
    expect(res.success).toBe(false)
    expect(res.error).toContain('AreaService')
  })

  // Full coverage for govUkUser path (auto-approve + emails)
  it('auto-approves gov.uk-like users and sends set-password and admin approved emails', async () => {
    const govUserData = {
      firstName: 'Gov',
      lastName: 'User',
      emailAddress: 'gov@yopmail.com', // triggers govUkUser flag in implementation
      telephoneNumber: '555',
      organisation: 'Gov Org',
      jobTitle: 'Analyst'
    }
    const createdUser = {
      id: 99n,
      first_name: 'Gov',
      last_name: 'User',
      email: 'gov@yopmail.com',
      status: 'approved',
      created_at: new Date(),
      updated_at: new Date()
    }
    const createdUserAreas = [
      { id: 300n, user_id: 99n, area_id: 10n, primary: true },
      { id: 301n, user_id: 99n, area_id: 20n, primary: false }
    ]

    // Mock transaction to create user + areas
    prisma.$transaction.mockImplementation(async (fn) => {
      const tx = {
        pafs_core_users: { create: vi.fn().mockResolvedValue(createdUser) },
        pafs_core_user_areas: {
          create: vi
            .fn()
            .mockResolvedValueOnce(createdUserAreas[0])
            .mockResolvedValueOnce(createdUserAreas[1])
        }
      }
      return fn(tx)
    })

    // Mock update for reset token persistence
    prisma.pafs_core_users.update = vi.fn().mockResolvedValue({})

    const res = await svc.createAccountRequest(govUserData, areasPayload)

    expect(res.success).toBe(true)
    expect(res.user.status).toBe('approved')

    // Check set-password email to user
    expect(emailService.send).toHaveBeenCalledWith(
      config.get('notify.templateAccountApprovedSetPassword'),
      'gov@yopmail.com',
      expect.objectContaining({
        user_name: 'Gov',
        email_address: 'gov@yopmail.com',
        set_password_link: expect.stringContaining(
          `${config.get('frontendUrl')}/set-password?token=`
        )
      }),
      'set-password'
    )

    // Check admin approved email using same area personalisation
    expect(emailService.send).toHaveBeenCalledWith(
      config.get('notify.templateAccountApprovedToAdmin'),
      config.get('notify.adminEmail'),
      expect.objectContaining({
        first_name: 'Gov',
        responsibility_area: 'Type X',
        main_area: 'Area 10',
        optional_areas: 'Area 20'
      }),
      'account-approved'
    )
  })
})
