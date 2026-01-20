import { describe, it, expect } from 'vitest'
import {
  ACCOUNT_SELECT_FIELDS,
  ACCOUNT_DETAIL_SELECT_FIELDS,
  formatArea,
  formatAccount
} from './account-formatter.js'

describe('Account Formatter', () => {
  describe('ACCOUNT_SELECT_FIELDS', () => {
    it('includes all required fields', () => {
      expect(ACCOUNT_SELECT_FIELDS).toHaveProperty('id', true)
      expect(ACCOUNT_SELECT_FIELDS).toHaveProperty('email', true)
      expect(ACCOUNT_SELECT_FIELDS).toHaveProperty('first_name', true)
      expect(ACCOUNT_SELECT_FIELDS).toHaveProperty('last_name', true)
      expect(ACCOUNT_SELECT_FIELDS).toHaveProperty('job_title', true)
      expect(ACCOUNT_SELECT_FIELDS).toHaveProperty('organisation', true)
      expect(ACCOUNT_SELECT_FIELDS).toHaveProperty('telephone_number', true)
      expect(ACCOUNT_SELECT_FIELDS).toHaveProperty('status', true)
      expect(ACCOUNT_SELECT_FIELDS).toHaveProperty('admin', true)
      expect(ACCOUNT_SELECT_FIELDS).toHaveProperty('disabled', true)
      expect(ACCOUNT_SELECT_FIELDS).toHaveProperty('created_at', true)
      expect(ACCOUNT_SELECT_FIELDS).toHaveProperty('updated_at', true)
      expect(ACCOUNT_SELECT_FIELDS).toHaveProperty('last_sign_in_at', true)
    })

    it('includes user areas with nested selection', () => {
      expect(ACCOUNT_SELECT_FIELDS).toHaveProperty('pafs_core_user_areas')
      expect(ACCOUNT_SELECT_FIELDS.pafs_core_user_areas.select).toHaveProperty(
        'primary',
        true
      )
      expect(
        ACCOUNT_SELECT_FIELDS.pafs_core_user_areas.select.pafs_core_areas.select
      ).toHaveProperty('id', true)
      expect(
        ACCOUNT_SELECT_FIELDS.pafs_core_user_areas.select.pafs_core_areas.select
      ).toHaveProperty('name', true)
      expect(
        ACCOUNT_SELECT_FIELDS.pafs_core_user_areas.select.pafs_core_areas.select
      ).toHaveProperty('area_type', true)
      expect(
        ACCOUNT_SELECT_FIELDS.pafs_core_user_areas.select.pafs_core_areas.select
      ).toHaveProperty('parent_id', true)
    })
  })

  describe('ACCOUNT_DETAIL_SELECT_FIELDS', () => {
    it('includes all base fields', () => {
      expect(ACCOUNT_DETAIL_SELECT_FIELDS).toHaveProperty('id', true)
      expect(ACCOUNT_DETAIL_SELECT_FIELDS).toHaveProperty('email', true)
      expect(ACCOUNT_DETAIL_SELECT_FIELDS).toHaveProperty('status', true)
    })

    it('includes invitation fields', () => {
      expect(ACCOUNT_DETAIL_SELECT_FIELDS).toHaveProperty(
        'invitation_sent_at',
        true
      )
      expect(ACCOUNT_DETAIL_SELECT_FIELDS).toHaveProperty(
        'invitation_accepted_at',
        true
      )
    })
  })

  describe('formatArea', () => {
    it('formats area with all fields', () => {
      const userArea = {
        primary: true,
        pafs_core_areas: {
          id: BigInt(123),
          name: 'Test Area',
          area_type: 'EA',
          parent_id: BigInt(456)
        }
      }

      const result = formatArea(userArea)

      expect(result).toEqual({
        id: 123,
        areaId: '123',
        name: 'Test Area',
        type: 'EA',
        parentId: 456,
        primary: true
      })
    })

    it('formats area with null parent_id', () => {
      const userArea = {
        primary: false,
        pafs_core_areas: {
          id: BigInt(789),
          name: 'Top Level Area',
          area_type: 'PSO',
          parent_id: null
        }
      }

      const result = formatArea(userArea)

      expect(result).toEqual({
        id: 789,
        areaId: '789',
        name: 'Top Level Area',
        type: 'PSO',
        parentId: null,
        primary: false
      })
    })

    it('converts BigInt IDs to numbers', () => {
      const userArea = {
        primary: true,
        pafs_core_areas: {
          id: BigInt(9007199254740991),
          name: 'Large ID Area',
          area_type: 'RMA',
          parent_id: BigInt(9007199254740990)
        }
      }

      const result = formatArea(userArea)

      expect(result.id).toBe(9007199254740991)
      expect(result.areaId).toBe('9007199254740991')
      expect(result.parentId).toBe(9007199254740990)
      expect(typeof result.id).toBe('number')
      expect(typeof result.parentId).toBe('number')
    })
  })

  describe('formatAccount', () => {
    const mockAccount = {
      id: BigInt(123),
      email: 'test@example.com',
      first_name: 'Test',
      last_name: 'User',
      job_title: 'Developer',
      organisation: 'Test Org',
      telephone_number: '01234567890',
      status: 'active',
      admin: false,
      disabled: false,
      created_at: new Date('2024-01-01'),
      updated_at: new Date('2024-01-02'),
      last_sign_in_at: new Date('2024-01-03'),
      invitation_sent_at: new Date('2024-01-01T12:00:00Z'),
      invitation_accepted_at: new Date('2024-01-02T12:00:00Z'),
      pafs_core_user_areas: [
        {
          primary: true,
          pafs_core_areas: {
            id: BigInt(1),
            name: 'Test Area',
            area_type: 'EA',
            parent_id: null
          }
        }
      ]
    }

    it('formats account without invitation fields by default', () => {
      const result = formatAccount(mockAccount)

      expect(result).toEqual({
        id: 123,
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        jobTitle: 'Developer',
        organisation: 'Test Org',
        telephoneNumber: '01234567890',
        status: 'active',
        admin: false,
        disabled: false,
        areas: [
          {
            id: 1,
            areaId: '1',
            name: 'Test Area',
            type: 'EA',
            parentId: null,
            primary: true
          }
        ],
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
        lastSignIn: new Date('2024-01-03')
      })

      expect(result).not.toHaveProperty('invitationSentAt')
      expect(result).not.toHaveProperty('invitationAcceptedAt')
    })

    it('includes invitation fields when requested', () => {
      const result = formatAccount(mockAccount, {
        includeInvitationFields: true
      })

      expect(result).toHaveProperty(
        'invitationSentAt',
        new Date('2024-01-01T12:00:00Z')
      )
      expect(result).toHaveProperty(
        'invitationAcceptedAt',
        new Date('2024-01-02T12:00:00Z')
      )
    })

    it('formats account with multiple areas', () => {
      const accountWithMultipleAreas = {
        ...mockAccount,
        pafs_core_user_areas: [
          {
            primary: true,
            pafs_core_areas: {
              id: BigInt(1),
              name: 'Primary Area',
              area_type: 'RMA',
              parent_id: BigInt(10)
            }
          },
          {
            primary: false,
            pafs_core_areas: {
              id: BigInt(2),
              name: 'Secondary Area',
              area_type: 'RMA',
              parent_id: BigInt(10)
            }
          }
        ]
      }

      const result = formatAccount(accountWithMultipleAreas)

      expect(result.areas).toHaveLength(2)
      expect(result.areas[0]).toEqual({
        id: 1,
        areaId: '1',
        name: 'Primary Area',
        type: 'RMA',
        parentId: 10,
        primary: true
      })
      expect(result.areas[1]).toEqual({
        id: 2,
        areaId: '2',
        name: 'Secondary Area',
        type: 'RMA',
        parentId: 10,
        primary: false
      })
    })

    it('formats admin account with no areas', () => {
      const adminAccount = {
        ...mockAccount,
        admin: true,
        job_title: null,
        organisation: null,
        telephone_number: null,
        pafs_core_user_areas: []
      }

      const result = formatAccount(adminAccount)

      expect(result.admin).toBe(true)
      expect(result.areas).toEqual([])
      expect(result.jobTitle).toBeNull()
      expect(result.organisation).toBeNull()
      expect(result.telephoneNumber).toBeNull()
    })

    it('handles null optional fields', () => {
      const accountWithNulls = {
        ...mockAccount,
        job_title: null,
        organisation: null,
        telephone_number: null,
        last_sign_in_at: null,
        invitation_sent_at: null,
        invitation_accepted_at: null
      }

      const result = formatAccount(accountWithNulls, {
        includeInvitationFields: true
      })

      expect(result.jobTitle).toBeNull()
      expect(result.organisation).toBeNull()
      expect(result.telephoneNumber).toBeNull()
      expect(result.lastSignIn).toBeNull()
      expect(result.invitationSentAt).toBeNull()
      expect(result.invitationAcceptedAt).toBeNull()
    })

    it('converts BigInt ID to number', () => {
      const result = formatAccount(mockAccount)

      expect(result.id).toBe(123)
      expect(typeof result.id).toBe('number')
    })

    it('handles disabled account', () => {
      const disabledAccount = {
        ...mockAccount,
        disabled: true
      }

      const result = formatAccount(disabledAccount)

      expect(result.disabled).toBe(true)
    })

    it('handles pending status', () => {
      const pendingAccount = {
        ...mockAccount,
        status: 'pending',
        last_sign_in_at: null
      }

      const result = formatAccount(pendingAccount)

      expect(result.status).toBe('pending')
      expect(result.lastSignIn).toBeNull()
    })

    it('preserves date objects', () => {
      const result = formatAccount(mockAccount)

      expect(result.createdAt).toBeInstanceOf(Date)
      expect(result.updatedAt).toBeInstanceOf(Date)
      expect(result.lastSignIn).toBeInstanceOf(Date)
    })

    it('handles empty options object', () => {
      const result = formatAccount(mockAccount, {})

      expect(result).not.toHaveProperty('invitationSentAt')
      expect(result).not.toHaveProperty('invitationAcceptedAt')
    })
  })
})
