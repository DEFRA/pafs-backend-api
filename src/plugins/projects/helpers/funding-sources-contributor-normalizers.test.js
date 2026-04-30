import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PROJECT_VALIDATION_LEVELS } from '../../../common/constants/project.js'
import {
  syncGrowthFundingFlag,
  clearDeselectedAdditionalGiaData,
  clearDeselectedContributorData,
  cleanupRemovedContributors,
  ensureContributorFundingRows
} from './funding-sources-contributor-normalizers.js'

describe('funding-sources-contributor-normalizers', () => {
  describe('syncGrowthFundingFlag', () => {
    const level = PROJECT_VALIDATION_LEVELS.FUNDING_SOURCES_SELECTED

    it('sets growthFunding to true when additionalFcermGia is true', () => {
      const payload = { additionalFcermGia: true }
      syncGrowthFundingFlag(payload, level)
      expect(payload.growthFunding).toBe(true)
    })

    it('sets growthFunding to false when additionalFcermGia is false', () => {
      const payload = { additionalFcermGia: false, growthFunding: true }
      syncGrowthFundingFlag(payload, level)
      expect(payload.growthFunding).toBe(false)
    })

    it('leaves growthFunding unchanged when additionalFcermGia is undefined', () => {
      const payload = { growthFunding: true }
      syncGrowthFundingFlag(payload, level)
      expect(payload.growthFunding).toBe(true)
    })

    it('leaves growthFunding unchanged when additionalFcermGia is null', () => {
      const payload = { additionalFcermGia: null, growthFunding: false }
      syncGrowthFundingFlag(payload, level)
      expect(payload.growthFunding).toBe(false)
    })

    it('skips for non-FUNDING_SOURCES_SELECTED levels', () => {
      const payload = { additionalFcermGia: true }
      syncGrowthFundingFlag(
        payload,
        PROJECT_VALIDATION_LEVELS.FUNDING_SOURCES_ESTIMATED_SPEND
      )
      expect(payload.growthFunding).toBeUndefined()
    })
  })

  describe('clearDeselectedAdditionalGiaData', () => {
    let projectService

    beforeEach(() => {
      projectService = {
        nullAdditionalGiaColumns: vi.fn().mockResolvedValue()
      }
    })

    it('skips for non-FUNDING_SOURCES_SELECTED levels', async () => {
      const payload = { additionalFcermGia: false, referenceNumber: 'REF-001' }
      await clearDeselectedAdditionalGiaData(
        payload,
        PROJECT_VALIDATION_LEVELS.FUNDING_SOURCES_ESTIMATED_SPEND,
        projectService
      )
      expect(projectService.nullAdditionalGiaColumns).not.toHaveBeenCalled()
    })

    it('skips when additionalFcermGia is not false', async () => {
      const payload = { additionalFcermGia: true, referenceNumber: 'REF-001' }
      await clearDeselectedAdditionalGiaData(
        payload,
        PROJECT_VALIDATION_LEVELS.FUNDING_SOURCES_SELECTED,
        projectService
      )
      expect(projectService.nullAdditionalGiaColumns).not.toHaveBeenCalled()
    })

    it('nulls all GIA fields and calls nullAdditionalGiaColumns when deselected', async () => {
      const payload = { additionalFcermGia: false, referenceNumber: 'REF-001' }
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
        'REF-001'
      )
    })
  })

  describe('clearDeselectedContributorData', () => {
    let projectService

    beforeEach(() => {
      projectService = {
        deleteContributorsByType: vi.fn().mockResolvedValue()
      }
    })

    it('skips for non-FUNDING_SOURCES_SELECTED levels', async () => {
      const payload = { publicContributions: false, referenceNumber: 'REF-001' }
      await clearDeselectedContributorData(
        payload,
        PROJECT_VALIDATION_LEVELS.FUNDING_SOURCES_ESTIMATED_SPEND,
        projectService
      )
      expect(projectService.deleteContributorsByType).not.toHaveBeenCalled()
    })

    it('clears contributor names and deletes rows when type is deselected', async () => {
      const payload = {
        publicContributions: false,
        privateContributions: true,
        otherEaContributions: false,
        referenceNumber: 'REF-001'
      }
      await clearDeselectedContributorData(
        payload,
        PROJECT_VALIDATION_LEVELS.FUNDING_SOURCES_SELECTED,
        projectService
      )

      expect(payload.publicContributorNames).toBeNull()
      expect(payload.otherEaContributorNames).toBeNull()
      expect(projectService.deleteContributorsByType).toHaveBeenCalledWith({
        referenceNumber: 'REF-001',
        contributorType: 'public_contributions'
      })
      expect(projectService.deleteContributorsByType).toHaveBeenCalledWith({
        referenceNumber: 'REF-001',
        contributorType: 'other_ea_contributions'
      })
      expect(projectService.deleteContributorsByType).toHaveBeenCalledTimes(2)
    })

    it('does nothing when no contributor types are deselected', async () => {
      const payload = {
        publicContributions: true,
        privateContributions: true,
        otherEaContributions: true,
        referenceNumber: 'REF-001'
      }
      await clearDeselectedContributorData(
        payload,
        PROJECT_VALIDATION_LEVELS.FUNDING_SOURCES_SELECTED,
        projectService
      )
      expect(projectService.deleteContributorsByType).not.toHaveBeenCalled()
    })
  })

  describe('cleanupRemovedContributors', () => {
    let projectService

    beforeEach(() => {
      projectService = {
        cleanupContributorsByName: vi.fn().mockResolvedValue()
      }
    })

    it('skips for non-contributor validation levels', async () => {
      const payload = {
        referenceNumber: 'REF-001',
        publicContributorNames: 'Alice|||Bob'
      }
      await cleanupRemovedContributors(
        payload,
        PROJECT_VALIDATION_LEVELS.FUNDING_SOURCES_SELECTED,
        projectService
      )
      expect(projectService.cleanupContributorsByName).not.toHaveBeenCalled()
    })

    it('calls cleanupContributorsByName with parsed names for PUBLIC_SECTOR_CONTRIBUTORS', async () => {
      const payload = {
        referenceNumber: 'REF-001',
        publicContributorNames: 'Alice|||Bob'
      }
      await cleanupRemovedContributors(
        payload,
        PROJECT_VALIDATION_LEVELS.PUBLIC_SECTOR_CONTRIBUTORS,
        projectService
      )
      expect(projectService.cleanupContributorsByName).toHaveBeenCalledWith({
        referenceNumber: 'REF-001',
        contributorType: 'public_contributions',
        currentNames: ['Alice', 'Bob']
      })
    })

    it('sends empty currentNames when namesField is empty', async () => {
      const payload = { referenceNumber: 'REF-001', publicContributorNames: '' }
      await cleanupRemovedContributors(
        payload,
        PROJECT_VALIDATION_LEVELS.PUBLIC_SECTOR_CONTRIBUTORS,
        projectService
      )
      expect(projectService.cleanupContributorsByName).toHaveBeenCalledWith({
        referenceNumber: 'REF-001',
        contributorType: 'public_contributions',
        currentNames: []
      })
    })

    it('sends empty currentNames when namesField is undefined', async () => {
      const payload = { referenceNumber: 'REF-001' }
      await cleanupRemovedContributors(
        payload,
        PROJECT_VALIDATION_LEVELS.PUBLIC_SECTOR_CONTRIBUTORS,
        projectService
      )
      expect(projectService.cleanupContributorsByName).toHaveBeenCalledWith({
        referenceNumber: 'REF-001',
        contributorType: 'public_contributions',
        currentNames: []
      })
    })

    it('works for PRIVATE_SECTOR_CONTRIBUTORS level', async () => {
      const payload = {
        referenceNumber: 'REF-001',
        privateContributorNames: 'Corp A'
      }
      await cleanupRemovedContributors(
        payload,
        PROJECT_VALIDATION_LEVELS.PRIVATE_SECTOR_CONTRIBUTORS,
        projectService
      )
      expect(projectService.cleanupContributorsByName).toHaveBeenCalledWith({
        referenceNumber: 'REF-001',
        contributorType: 'private_contributions',
        currentNames: ['Corp A']
      })
    })

    it('works for OTHER_ENVIRONMENT_AGENCY_CONTRIBUTORS level', async () => {
      const payload = {
        referenceNumber: 'REF-001',
        otherEaContributorNames: 'EA North'
      }
      await cleanupRemovedContributors(
        payload,
        PROJECT_VALIDATION_LEVELS.OTHER_ENVIRONMENT_AGENCY_CONTRIBUTORS,
        projectService
      )
      expect(projectService.cleanupContributorsByName).toHaveBeenCalledWith({
        referenceNumber: 'REF-001',
        contributorType: 'other_ea_contributions',
        currentNames: ['EA North']
      })
    })
  })

  describe('ensureContributorFundingRows', () => {
    let projectService

    beforeEach(() => {
      projectService = {
        ensureContributorFundingRows: vi.fn().mockResolvedValue()
      }
    })

    it('skips for non-contributor validation levels', async () => {
      const payload = {
        referenceNumber: 'REF-001',
        publicContributorNames: 'Alice'
      }
      await ensureContributorFundingRows(
        payload,
        PROJECT_VALIDATION_LEVELS.FUNDING_SOURCES_SELECTED,
        projectService
      )
      expect(projectService.ensureContributorFundingRows).not.toHaveBeenCalled()
    })

    it('skips when currentNames is empty', async () => {
      const payload = { referenceNumber: 'REF-001', publicContributorNames: '' }
      await ensureContributorFundingRows(
        payload,
        PROJECT_VALIDATION_LEVELS.PUBLIC_SECTOR_CONTRIBUTORS,
        projectService
      )
      expect(projectService.ensureContributorFundingRows).not.toHaveBeenCalled()
    })

    it('calls ensureContributorFundingRows with parsed names', async () => {
      const payload = {
        referenceNumber: 'REF-001',
        publicContributorNames: 'Alice|||Bob'
      }
      await ensureContributorFundingRows(
        payload,
        PROJECT_VALIDATION_LEVELS.PUBLIC_SECTOR_CONTRIBUTORS,
        projectService
      )
      expect(projectService.ensureContributorFundingRows).toHaveBeenCalledWith({
        referenceNumber: 'REF-001',
        contributorType: 'public_contributions',
        contributorNames: ['Alice', 'Bob']
      })
    })

    it('works for PRIVATE_SECTOR_CONTRIBUTORS level', async () => {
      const payload = {
        referenceNumber: 'REF-001',
        privateContributorNames: 'Corp A|||Corp B'
      }
      await ensureContributorFundingRows(
        payload,
        PROJECT_VALIDATION_LEVELS.PRIVATE_SECTOR_CONTRIBUTORS,
        projectService
      )
      expect(projectService.ensureContributorFundingRows).toHaveBeenCalledWith({
        referenceNumber: 'REF-001',
        contributorType: 'private_contributions',
        contributorNames: ['Corp A', 'Corp B']
      })
    })

    it('works for OTHER_ENVIRONMENT_AGENCY_CONTRIBUTORS level', async () => {
      const payload = {
        referenceNumber: 'REF-001',
        otherEaContributorNames: 'EA North'
      }
      await ensureContributorFundingRows(
        payload,
        PROJECT_VALIDATION_LEVELS.OTHER_ENVIRONMENT_AGENCY_CONTRIBUTORS,
        projectService
      )
      expect(projectService.ensureContributorFundingRows).toHaveBeenCalledWith({
        referenceNumber: 'REF-001',
        contributorType: 'other_ea_contributions',
        contributorNames: ['EA North']
      })
    })
  })
})
