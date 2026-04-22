import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PROJECT_VALIDATION_LEVELS } from '../../../common/constants/project.js'
import {
  sanitizeFundingSourceFields,
  normalizeFundingSourceFields,
  handleFundingSourcesData,
  clearDeselectedAdditionalGiaData,
  clearDeselectedContributorData,
  cleanupRemovedContributors
} from './funding-sources-normalizers.js'

describe('funding-sources-normalizers', () => {
  describe('sanitizeFundingSourceFields', () => {
    it('trims contributor names at PUBLIC_SECTOR_CONTRIBUTORS level', () => {
      const payload = { publicContributorNames: '  Partner A, Partner B  ' }

      sanitizeFundingSourceFields(
        payload,
        PROJECT_VALIDATION_LEVELS.PUBLIC_SECTOR_CONTRIBUTORS
      )

      expect(payload.publicContributorNames).toBe('Partner A, Partner B')
    })

    it('sanitizes numeric funding values including internalDrainageBoards', () => {
      const payload = {
        fundingValues: [
          {
            financialYear: 2026,
            fcermGia: ' 1,000 ',
            internalDrainageBoards: ' 2,500 ',
            total: ' 3,500 '
          }
        ]
      }

      sanitizeFundingSourceFields(
        payload,
        PROJECT_VALIDATION_LEVELS.FUNDING_SOURCES_ESTIMATED_SPEND
      )

      expect(payload.fundingValues[0].fcermGia).toBe('1000')
      expect(payload.fundingValues[0].internalDrainageBoards).toBe('2500')
      expect(payload.fundingValues[0].total).toBe('3500')
    })

    it('trims private contributor names at PRIVATE_SECTOR_CONTRIBUTORS level', () => {
      const payload = { privateContributorNames: '  Corp A, Corp B  ' }

      sanitizeFundingSourceFields(
        payload,
        PROJECT_VALIDATION_LEVELS.PRIVATE_SECTOR_CONTRIBUTORS
      )

      expect(payload.privateContributorNames).toBe('Corp A, Corp B')
    })

    it('does not modify private contributor names when not a string', () => {
      const payload = { privateContributorNames: null }

      sanitizeFundingSourceFields(
        payload,
        PROJECT_VALIDATION_LEVELS.PRIVATE_SECTOR_CONTRIBUTORS
      )

      expect(payload.privateContributorNames).toBeNull()
    })

    it('trims other EA contributor names at OTHER_ENVIRONMENT_AGENCY_CONTRIBUTORS level', () => {
      const payload = { otherEaContributorNames: '  EA Partner X  ' }

      sanitizeFundingSourceFields(
        payload,
        PROJECT_VALIDATION_LEVELS.OTHER_ENVIRONMENT_AGENCY_CONTRIBUTORS
      )

      expect(payload.otherEaContributorNames).toBe('EA Partner X')
    })

    it('does not modify other EA contributor names when not a string', () => {
      const payload = { otherEaContributorNames: 123 }

      sanitizeFundingSourceFields(
        payload,
        PROJECT_VALIDATION_LEVELS.OTHER_ENVIRONMENT_AGENCY_CONTRIBUTORS
      )

      expect(payload.otherEaContributorNames).toBe(123)
    })

    it('returns early for unrecognized validation level', () => {
      const payload = { publicContributorNames: '  name  ' }

      sanitizeFundingSourceFields(payload, 'SOME_OTHER_LEVEL')

      expect(payload.publicContributorNames).toBe('  name  ')
    })

    it('returns early when fundingValues is not an array at estimated spend level', () => {
      const payload = { fundingValues: 'not-an-array' }

      sanitizeFundingSourceFields(
        payload,
        PROJECT_VALIDATION_LEVELS.FUNDING_SOURCES_ESTIMATED_SPEND
      )

      expect(payload.fundingValues).toBe('not-an-array')
    })

    it('skips non-object rows in fundingValues', () => {
      const payload = {
        fundingValues: [null, undefined, 'string-row']
      }

      sanitizeFundingSourceFields(
        payload,
        PROJECT_VALIDATION_LEVELS.FUNDING_SOURCES_ESTIMATED_SPEND
      )

      expect(payload.fundingValues).toEqual([null, undefined, 'string-row'])
    })

    it('sanitizes contributor fields within funding value rows', () => {
      const payload = {
        fundingValues: [
          {
            financialYear: 2026,
            publicContributors: [
              { name: '  Alice  ', amount: ' 1,000 ' },
              null,
              { name: null, amount: null }
            ]
          }
        ]
      }

      sanitizeFundingSourceFields(
        payload,
        PROJECT_VALIDATION_LEVELS.FUNDING_SOURCES_ESTIMATED_SPEND
      )

      expect(payload.fundingValues[0].publicContributors[0].name).toBe('Alice')
      expect(payload.fundingValues[0].publicContributors[0].amount).toBe('1000')
    })

    it('skips non-array contributor fields in rows', () => {
      const payload = {
        fundingValues: [
          {
            financialYear: 2026,
            publicContributors: 'not-an-array'
          }
        ]
      }

      sanitizeFundingSourceFields(
        payload,
        PROJECT_VALIDATION_LEVELS.FUNDING_SOURCES_ESTIMATED_SPEND
      )

      expect(payload.fundingValues[0].publicContributors).toBe('not-an-array')
    })
  })

  describe('normalizeFundingSourceFields', () => {
    it('converts empty strings to null for funding spend row fields', () => {
      const payload = {
        fundingValues: [
          {
            financialYear: 2026,
            fcermGia: '',
            internalDrainageBoards: '',
            total: ''
          }
        ]
      }

      normalizeFundingSourceFields(
        payload,
        PROJECT_VALIDATION_LEVELS.FUNDING_SOURCES_ESTIMATED_SPEND
      )

      expect(payload.fundingValues[0].fcermGia).toBeNull()
      expect(payload.fundingValues[0].internalDrainageBoards).toBeNull()
      expect(payload.fundingValues[0].total).toBeNull()
    })

    it('returns early for non-estimated-spend validation level', () => {
      const payload = { fundingValues: [{ fcermGia: '' }] }

      normalizeFundingSourceFields(
        payload,
        PROJECT_VALIDATION_LEVELS.PUBLIC_SECTOR_CONTRIBUTORS
      )

      expect(payload.fundingValues[0].fcermGia).toBe('')
    })

    it('returns early when fundingValues is not an array', () => {
      const payload = { fundingValues: 'not-array' }

      normalizeFundingSourceFields(
        payload,
        PROJECT_VALIDATION_LEVELS.FUNDING_SOURCES_ESTIMATED_SPEND
      )

      expect(payload.fundingValues).toBe('not-array')
    })

    it('skips non-object rows', () => {
      const payload = { fundingValues: [null, undefined] }

      normalizeFundingSourceFields(
        payload,
        PROJECT_VALIDATION_LEVELS.FUNDING_SOURCES_ESTIMATED_SPEND
      )

      expect(payload.fundingValues).toEqual([null, undefined])
    })

    it('normalizes contributor empty amount to null within rows', () => {
      const payload = {
        fundingValues: [
          {
            financialYear: 2026,
            publicContributors: [{ name: 'Alice', amount: '' }]
          }
        ]
      }

      normalizeFundingSourceFields(
        payload,
        PROJECT_VALIDATION_LEVELS.FUNDING_SOURCES_ESTIMATED_SPEND
      )

      expect(payload.fundingValues[0].publicContributors[0].name).toBe('Alice')
      expect(payload.fundingValues[0].publicContributors[0].amount).toBeNull()
    })

    it('skips non-array contributor fields during normalization', () => {
      const payload = {
        fundingValues: [
          {
            financialYear: 2026,
            publicContributors: 'not-array'
          }
        ]
      }

      normalizeFundingSourceFields(
        payload,
        PROJECT_VALIDATION_LEVELS.FUNDING_SOURCES_ESTIMATED_SPEND
      )

      expect(payload.fundingValues[0].publicContributors).toBe('not-array')
    })

    it('skips null contributors in contributor array', () => {
      const payload = {
        fundingValues: [
          {
            financialYear: 2026,
            publicContributors: [null, undefined]
          }
        ]
      }

      normalizeFundingSourceFields(
        payload,
        PROJECT_VALIDATION_LEVELS.FUNDING_SOURCES_ESTIMATED_SPEND
      )

      expect(payload.fundingValues[0].publicContributors).toEqual([
        null,
        undefined
      ])
    })
  })

  describe('handleFundingSourcesData', () => {
    let projectService

    beforeEach(() => {
      projectService = {
        upsertFundingValue: vi.fn().mockResolvedValue({}),
        upsertFundingContributor: vi.fn().mockResolvedValue({}),
        syncFundingContributorsForYear: vi.fn().mockResolvedValue(undefined),
        deleteFundingValue: vi.fn().mockResolvedValue(null),
        deleteAllFundingContributors: vi.fn().mockResolvedValue(0)
      }
    })

    it('upserts a funding value when row has amount data', async () => {
      const payload = {
        referenceNumber: 'ANC501E/000A/001A',
        fundingValues: [
          {
            financialYear: 2026,
            fcermGia: '1000',
            internalDrainageBoards: null
          }
        ]
      }

      await handleFundingSourcesData(
        payload,
        PROJECT_VALIDATION_LEVELS.FUNDING_SOURCES_ESTIMATED_SPEND,
        projectService
      )

      expect(projectService.upsertFundingValue).toHaveBeenCalledWith({
        referenceNumber: 'ANC501E/000A/001A',
        financialYear: 2026,
        amounts: expect.objectContaining({
          fcermGia: '1000',
          internalDrainageBoards: null,
          total: '1000'
        })
      })
      expect(projectService.upsertFundingContributor).not.toHaveBeenCalled()
      expect(projectService.deleteFundingValue).not.toHaveBeenCalled()
      expect(payload.fundingValues).toBeUndefined()
    })

    it('upserts contributor rows and derives public/private totals from contributor data', async () => {
      const payload = {
        referenceNumber: 'ANC501E/000A/001A',
        fundingValues: [
          {
            financialYear: 2026,
            fcermGia: '1000',
            publicContributions: null,
            privateContributions: null,
            publicContributors: [
              {
                name: ' Public Org ',
                contributorType: 'public_contributions',
                amount: '2,000'
              }
            ],
            privateContributors: [
              {
                name: 'Private Org',
                contributorType: 'private_contributions',
                amount: '3000'
              }
            ]
          }
        ]
      }

      sanitizeFundingSourceFields(
        payload,
        PROJECT_VALIDATION_LEVELS.FUNDING_SOURCES_ESTIMATED_SPEND
      )
      normalizeFundingSourceFields(
        payload,
        PROJECT_VALIDATION_LEVELS.FUNDING_SOURCES_ESTIMATED_SPEND
      )

      await handleFundingSourcesData(
        payload,
        PROJECT_VALIDATION_LEVELS.FUNDING_SOURCES_ESTIMATED_SPEND,
        projectService
      )

      expect(projectService.upsertFundingValue).toHaveBeenCalledWith({
        referenceNumber: 'ANC501E/000A/001A',
        financialYear: 2026,
        amounts: expect.objectContaining({
          fcermGia: '1000',
          publicContributions: '2000',
          privateContributions: '3000',
          total: '6000'
        })
      })

      expect(
        projectService.syncFundingContributorsForYear
      ).toHaveBeenCalledWith({
        referenceNumber: 'ANC501E/000A/001A',
        financialYear: 2026,
        contributorEntries: [
          {
            contributorType: 'public_contributions',
            name: 'Public Org',
            amount: '2000'
          },
          {
            contributorType: 'private_contributions',
            name: 'Private Org',
            amount: '3000'
          }
        ]
      })
    })

    it('deletes funding value and contributors when all row amounts are null', async () => {
      const payload = {
        referenceNumber: 'ANC501E/000A/001A',
        fundingValues: [
          {
            financialYear: 2027,
            fcermGia: null,
            localLevy: null,
            internalDrainageBoards: null,
            publicContributions: null,
            privateContributions: null,
            otherEaContributions: null,
            notYetIdentified: null,
            assetReplacementAllowance: null,
            environmentStatutoryFunding: null,
            frequentlyFloodedCommunities: null,
            otherAdditionalGrantInAid: null,
            otherGovernmentDepartment: null,
            recovery: null,
            summerEconomicFund: null
          }
        ]
      }

      await handleFundingSourcesData(
        payload,
        PROJECT_VALIDATION_LEVELS.FUNDING_SOURCES_ESTIMATED_SPEND,
        projectService
      )

      expect(projectService.deleteAllFundingContributors).toHaveBeenCalledWith({
        referenceNumber: 'ANC501E/000A/001A',
        financialYear: 2027
      })
      expect(projectService.deleteFundingValue).toHaveBeenCalledWith({
        referenceNumber: 'ANC501E/000A/001A',
        financialYear: 2027
      })
      expect(projectService.upsertFundingValue).not.toHaveBeenCalled()
      expect(payload.fundingValues).toBeUndefined()
    })

    it('does nothing at non-funding validation levels', async () => {
      const payload = {
        referenceNumber: 'ANC501E/000A/001A',
        fundingValues: [{ financialYear: 2026, fcermGia: '1000' }]
      }

      await handleFundingSourcesData(
        payload,
        PROJECT_VALIDATION_LEVELS.APPROACH,
        projectService
      )

      expect(projectService.upsertFundingValue).not.toHaveBeenCalled()
      expect(payload.fundingValues).toBeDefined()
    })

    it('handles non-array fundingValues without throwing', async () => {
      const payload = {
        referenceNumber: 'ANC501E/000A/001A',
        fundingValues: 'not-array'
      }

      await handleFundingSourcesData(
        payload,
        PROJECT_VALIDATION_LEVELS.FUNDING_SOURCES_ESTIMATED_SPEND,
        projectService
      )

      expect(projectService.upsertFundingValue).not.toHaveBeenCalled()
    })

    it('skips null entries in fundingValues', async () => {
      const payload = {
        referenceNumber: 'ANC501E/000A/001A',
        fundingValues: [null, { financialYear: 2026, fcermGia: '500' }]
      }

      await handleFundingSourcesData(
        payload,
        PROJECT_VALIDATION_LEVELS.FUNDING_SOURCES_ESTIMATED_SPEND,
        projectService
      )

      expect(projectService.upsertFundingValue).toHaveBeenCalledTimes(1)
    })

    it('skips rows with null financialYear', async () => {
      const payload = {
        referenceNumber: 'ANC501E/000A/001A',
        fundingValues: [{ financialYear: null, fcermGia: '500' }]
      }

      await handleFundingSourcesData(
        payload,
        PROJECT_VALIDATION_LEVELS.FUNDING_SOURCES_ESTIMATED_SPEND,
        projectService
      )

      expect(projectService.upsertFundingValue).not.toHaveBeenCalled()
    })

    it('skips rows with undefined financialYear', async () => {
      const payload = {
        referenceNumber: 'ANC501E/000A/001A',
        fundingValues: [{ fcermGia: '500' }]
      }

      await handleFundingSourcesData(
        payload,
        PROJECT_VALIDATION_LEVELS.FUNDING_SOURCES_ESTIMATED_SPEND,
        projectService
      )

      expect(projectService.upsertFundingValue).not.toHaveBeenCalled()
    })
  })

  describe('sanitizeFundingSourceFields – additional edge cases', () => {
    it('does nothing at unrelated validation levels', () => {
      const payload = {
        publicContributorNames: '  Alice  ',
        fundingValues: [{ financialYear: 2026, fcermGia: '1,000' }]
      }

      sanitizeFundingSourceFields(payload, PROJECT_VALIDATION_LEVELS.APPROACH)

      expect(payload.publicContributorNames).toBe('  Alice  ')
      expect(payload.fundingValues[0].fcermGia).toBe('1,000')
    })

    it('handles non-array fundingValues at ESTIMATED_SPEND level without throwing', () => {
      const payload = { fundingValues: null }

      expect(() =>
        sanitizeFundingSourceFields(
          payload,
          PROJECT_VALIDATION_LEVELS.FUNDING_SOURCES_ESTIMATED_SPEND
        )
      ).not.toThrow()
    })

    it('trims contributor name and amount in fundingValues rows', () => {
      const payload = {
        fundingValues: [
          {
            financialYear: 2026,
            publicContributors: [{ name: '  EA North  ', amount: ' 2,500 ' }]
          }
        ]
      }

      sanitizeFundingSourceFields(
        payload,
        PROJECT_VALIDATION_LEVELS.FUNDING_SOURCES_ESTIMATED_SPEND
      )

      expect(payload.fundingValues[0].publicContributors[0].name).toBe(
        'EA North'
      )
      expect(payload.fundingValues[0].publicContributors[0].amount).toBe('2500')
    })

    it('skips null entries in fundingValues rows without throwing', () => {
      const payload = {
        fundingValues: [null, { financialYear: 2026, fcermGia: ' 1,000 ' }]
      }

      expect(() =>
        sanitizeFundingSourceFields(
          payload,
          PROJECT_VALIDATION_LEVELS.FUNDING_SOURCES_ESTIMATED_SPEND
        )
      ).not.toThrow()

      expect(payload.fundingValues[1].fcermGia).toBe('1000')
    })

    it('skips null contributor entries without throwing', () => {
      const payload = {
        fundingValues: [
          {
            financialYear: 2026,
            publicContributors: [null, { name: '  EA  ', amount: ' 100 ' }]
          }
        ]
      }

      expect(() =>
        sanitizeFundingSourceFields(
          payload,
          PROJECT_VALIDATION_LEVELS.FUNDING_SOURCES_ESTIMATED_SPEND
        )
      ).not.toThrow()
    })
  })

  describe('normalizeFundingSourceFields – additional edge cases', () => {
    it('handles non-array fundingValues at ESTIMATED_SPEND level without throwing', () => {
      const payload = { fundingValues: 'not-array' }

      expect(() =>
        normalizeFundingSourceFields(
          payload,
          PROJECT_VALIDATION_LEVELS.FUNDING_SOURCES_ESTIMATED_SPEND
        )
      ).not.toThrow()
    })

    it('converts empty contributor amount string to null', () => {
      const payload = {
        fundingValues: [
          {
            financialYear: 2026,
            publicContributors: [{ name: 'Alice', amount: '' }]
          }
        ]
      }

      normalizeFundingSourceFields(
        payload,
        PROJECT_VALIDATION_LEVELS.FUNDING_SOURCES_ESTIMATED_SPEND
      )

      expect(payload.fundingValues[0].publicContributors[0].amount).toBeNull()
    })

    it('leaves non-empty contributor amount unchanged', () => {
      const payload = {
        fundingValues: [
          {
            financialYear: 2026,
            publicContributors: [{ name: 'Alice', amount: '1000' }]
          }
        ]
      }

      normalizeFundingSourceFields(
        payload,
        PROJECT_VALIDATION_LEVELS.FUNDING_SOURCES_ESTIMATED_SPEND
      )

      expect(payload.fundingValues[0].publicContributors[0].amount).toBe('1000')
    })

    it('skips null entries in fundingValues without throwing', () => {
      const payload = { fundingValues: [null] }

      expect(() =>
        normalizeFundingSourceFields(
          payload,
          PROJECT_VALIDATION_LEVELS.FUNDING_SOURCES_ESTIMATED_SPEND
        )
      ).not.toThrow()
    })

    it('skips null contributor entries without throwing', () => {
      const payload = {
        fundingValues: [
          { financialYear: 2026, publicContributors: [null, { amount: '' }] }
        ]
      }

      expect(() =>
        normalizeFundingSourceFields(
          payload,
          PROJECT_VALIDATION_LEVELS.FUNDING_SOURCES_ESTIMATED_SPEND
        )
      ).not.toThrow()
    })
  })

  describe('clearDeselectedAdditionalGiaData', () => {
    let projectService

    beforeEach(() => {
      projectService = {
        nullAdditionalGiaColumns: vi.fn().mockResolvedValue(undefined)
      }
    })

    it('does nothing at non-FUNDING_SOURCES_SELECTED levels', async () => {
      const payload = { additionalFcermGia: false, referenceNumber: 'REF' }

      await clearDeselectedAdditionalGiaData(
        payload,
        PROJECT_VALIDATION_LEVELS.APPROACH,
        projectService
      )

      expect(projectService.nullAdditionalGiaColumns).not.toHaveBeenCalled()
    })

    it('does nothing when additionalFcermGia is not false', async () => {
      const payload = { additionalFcermGia: true, referenceNumber: 'REF' }

      await clearDeselectedAdditionalGiaData(
        payload,
        PROJECT_VALIDATION_LEVELS.FUNDING_SOURCES_SELECTED,
        projectService
      )

      expect(projectService.nullAdditionalGiaColumns).not.toHaveBeenCalled()
    })

    it('does nothing when additionalFcermGia is null', async () => {
      const payload = { additionalFcermGia: null, referenceNumber: 'REF' }

      await clearDeselectedAdditionalGiaData(
        payload,
        PROJECT_VALIDATION_LEVELS.FUNDING_SOURCES_SELECTED,
        projectService
      )

      expect(projectService.nullAdditionalGiaColumns).not.toHaveBeenCalled()
    })

    it('nulls all additional GIA fields and calls service when additionalFcermGia is false', async () => {
      const payload = {
        additionalFcermGia: false,
        referenceNumber: 'ANC501E/000A/001A',
        assetReplacementAllowance: true,
        environmentStatutoryFunding: true,
        frequentlyFloodedCommunities: true,
        otherAdditionalGrantInAid: true,
        otherGovernmentDepartment: true,
        recovery: true,
        summerEconomicFund: true
      }

      await clearDeselectedAdditionalGiaData(
        payload,
        PROJECT_VALIDATION_LEVELS.FUNDING_SOURCES_SELECTED,
        projectService
      )

      expect(payload.assetReplacementAllowance).toBeNull()
      expect(payload.environmentStatutoryFunding).toBeNull()
      expect(payload.frequentlyFloodedCommunities).toBeNull()
      expect(payload.otherAdditionalGrantInAid).toBeNull()
      expect(payload.otherGovernmentDepartment).toBeNull()
      expect(payload.recovery).toBeNull()
      expect(payload.summerEconomicFund).toBeNull()
      expect(projectService.nullAdditionalGiaColumns).toHaveBeenCalledWith(
        'ANC501E/000A/001A'
      )
    })
  })

  describe('clearDeselectedContributorData', () => {
    let projectService

    beforeEach(() => {
      projectService = {
        deleteContributorsByType: vi.fn().mockResolvedValue(undefined)
      }
    })

    it('does nothing at non-FUNDING_SOURCES_SELECTED levels', async () => {
      const payload = {
        publicContributions: false,
        referenceNumber: 'REF'
      }

      await clearDeselectedContributorData(
        payload,
        PROJECT_VALIDATION_LEVELS.APPROACH,
        projectService
      )

      expect(projectService.deleteContributorsByType).not.toHaveBeenCalled()
    })

    it('does nothing when all contributor flags are true', async () => {
      const payload = {
        referenceNumber: 'REF',
        publicContributions: true,
        privateContributions: true,
        otherEaContributions: true
      }

      await clearDeselectedContributorData(
        payload,
        PROJECT_VALIDATION_LEVELS.FUNDING_SOURCES_SELECTED,
        projectService
      )

      expect(projectService.deleteContributorsByType).not.toHaveBeenCalled()
    })

    it('clears public contributor names and deletes rows when publicContributions is false', async () => {
      const payload = {
        referenceNumber: 'ANC501E/000A/001A',
        publicContributions: false,
        publicContributorNames: 'Alice, Bob',
        privateContributions: true,
        otherEaContributions: true
      }

      await clearDeselectedContributorData(
        payload,
        PROJECT_VALIDATION_LEVELS.FUNDING_SOURCES_SELECTED,
        projectService
      )

      expect(payload.publicContributorNames).toBeNull()
      expect(projectService.deleteContributorsByType).toHaveBeenCalledWith({
        referenceNumber: 'ANC501E/000A/001A',
        contributorType: 'public_contributions'
      })
      expect(projectService.deleteContributorsByType).toHaveBeenCalledTimes(1)
    })

    it('clears private contributor names when privateContributions is false', async () => {
      const payload = {
        referenceNumber: 'ANC501E/000A/001A',
        publicContributions: true,
        privateContributions: false,
        privateContributorNames: 'Private Corp',
        otherEaContributions: true
      }

      await clearDeselectedContributorData(
        payload,
        PROJECT_VALIDATION_LEVELS.FUNDING_SOURCES_SELECTED,
        projectService
      )

      expect(payload.privateContributorNames).toBeNull()
      expect(projectService.deleteContributorsByType).toHaveBeenCalledWith({
        referenceNumber: 'ANC501E/000A/001A',
        contributorType: 'private_contributions'
      })
    })

    it('clears other EA contributor names when otherEaContributions is false', async () => {
      const payload = {
        referenceNumber: 'ANC501E/000A/001A',
        publicContributions: true,
        privateContributions: true,
        otherEaContributions: false,
        otherEaContributorNames: 'EA Dept'
      }

      await clearDeselectedContributorData(
        payload,
        PROJECT_VALIDATION_LEVELS.FUNDING_SOURCES_SELECTED,
        projectService
      )

      expect(payload.otherEaContributorNames).toBeNull()
      expect(projectService.deleteContributorsByType).toHaveBeenCalledWith({
        referenceNumber: 'ANC501E/000A/001A',
        contributorType: 'other_ea_contributions'
      })
    })

    it('clears all three contributor types when all are deselected', async () => {
      const payload = {
        referenceNumber: 'ANC501E/000A/001A',
        publicContributions: false,
        publicContributorNames: 'Alice',
        privateContributions: false,
        privateContributorNames: 'Bob',
        otherEaContributions: false,
        otherEaContributorNames: 'Charlie'
      }

      await clearDeselectedContributorData(
        payload,
        PROJECT_VALIDATION_LEVELS.FUNDING_SOURCES_SELECTED,
        projectService
      )

      expect(payload.publicContributorNames).toBeNull()
      expect(payload.privateContributorNames).toBeNull()
      expect(payload.otherEaContributorNames).toBeNull()
      expect(projectService.deleteContributorsByType).toHaveBeenCalledTimes(3)
    })
  })

  describe('cleanupRemovedContributors', () => {
    let projectService

    beforeEach(() => {
      projectService = {
        cleanupContributorsByName: vi.fn().mockResolvedValue(undefined)
      }
    })

    it('does nothing at non-contributor validation levels', async () => {
      const payload = {
        publicContributorNames: 'Alice',
        referenceNumber: 'ANC501E/000A/001A'
      }

      await cleanupRemovedContributors(
        payload,
        PROJECT_VALIDATION_LEVELS.APPROACH,
        projectService
      )

      expect(projectService.cleanupContributorsByName).not.toHaveBeenCalled()
    })

    it('calls service with public contributors when at PUBLIC_SECTOR_CONTRIBUTORS level', async () => {
      const payload = {
        publicContributorNames: 'Alice, Bob',
        referenceNumber: 'ANC501E/000A/001A'
      }

      await cleanupRemovedContributors(
        payload,
        PROJECT_VALIDATION_LEVELS.PUBLIC_SECTOR_CONTRIBUTORS,
        projectService
      )

      expect(projectService.cleanupContributorsByName).toHaveBeenCalledWith({
        referenceNumber: 'ANC501E/000A/001A',
        contributorType: 'public_contributions',
        currentNames: ['Alice', 'Bob']
      })
    })

    it('parses comma-separated names and trims whitespace', async () => {
      const payload = {
        publicContributorNames: '  Alice  ,  Bob  ,  Charlie  ',
        referenceNumber: 'ANC501E/000A/001A'
      }

      await cleanupRemovedContributors(
        payload,
        PROJECT_VALIDATION_LEVELS.PUBLIC_SECTOR_CONTRIBUTORS,
        projectService
      )

      expect(projectService.cleanupContributorsByName).toHaveBeenCalledWith({
        referenceNumber: 'ANC501E/000A/001A',
        contributorType: 'public_contributions',
        currentNames: ['Alice', 'Bob', 'Charlie']
      })
    })

    it('handles empty names string as empty array', async () => {
      const payload = {
        publicContributorNames: '',
        referenceNumber: 'ANC501E/000A/001A'
      }

      await cleanupRemovedContributors(
        payload,
        PROJECT_VALIDATION_LEVELS.PUBLIC_SECTOR_CONTRIBUTORS,
        projectService
      )

      expect(projectService.cleanupContributorsByName).toHaveBeenCalledWith({
        referenceNumber: 'ANC501E/000A/001A',
        contributorType: 'public_contributions',
        currentNames: []
      })
    })

    it('handles null names field as empty array', async () => {
      const payload = {
        publicContributorNames: null,
        referenceNumber: 'ANC501E/000A/001A'
      }

      await cleanupRemovedContributors(
        payload,
        PROJECT_VALIDATION_LEVELS.PUBLIC_SECTOR_CONTRIBUTORS,
        projectService
      )

      expect(projectService.cleanupContributorsByName).toHaveBeenCalledWith({
        referenceNumber: 'ANC501E/000A/001A',
        contributorType: 'public_contributions',
        currentNames: []
      })
    })
  })
})
