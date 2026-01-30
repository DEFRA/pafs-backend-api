import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AccountAreaValidator } from './account-area-validator.js'
import { BadRequestError } from '../../../common/errors/http-errors.js'
import { ACCOUNT_ERROR_CODES } from '../../../common/constants/accounts.js'

describe('AccountAreaValidator', () => {
  let validator
  let mockAreaService
  let mockLogger

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    }

    mockAreaService = {
      getAreaDetailsByIds: vi.fn()
    }

    validator = new AccountAreaValidator(mockAreaService, mockLogger)
  })

  describe('validateAreaResponsibilityTypes', () => {
    it('validates EA user areas successfully', async () => {
      const areas = [
        { areaId: 1, primary: true },
        { areaId: 2, primary: false }
      ]
      const areaDetails = [
        { id: 1, name: 'Thames', areaType: 'EA Area' },
        { id: 2, name: 'Anglian', areaType: 'EA Area' }
      ]

      mockAreaService.getAreaDetailsByIds.mockResolvedValue(areaDetails)

      await validator.validateAreaResponsibilityTypes(areas, 'EA')

      expect(mockAreaService.getAreaDetailsByIds).toHaveBeenCalledWith([1, 2])
      expect(mockLogger.info).toHaveBeenCalledWith(
        { areaCount: 2, userResponsibility: 'EA' },
        'Validating area responsibility types'
      )
      expect(mockLogger.info).toHaveBeenCalledWith(
        { areaCount: 2, areaType: 'EA Area' },
        'Area responsibility validation passed'
      )
    })

    it('validates PSO user areas successfully', async () => {
      const areas = [{ areaId: 5, primary: true }]
      const areaDetails = [{ id: 5, name: 'PSO Region', areaType: 'PSO Area' }]

      mockAreaService.getAreaDetailsByIds.mockResolvedValue(areaDetails)

      await validator.validateAreaResponsibilityTypes(areas, 'PSO')

      expect(mockAreaService.getAreaDetailsByIds).toHaveBeenCalledWith([5])
      expect(mockLogger.info).toHaveBeenCalledWith(
        { areaCount: 1, areaType: 'PSO Area' },
        'Area responsibility validation passed'
      )
    })

    it('validates RMA user areas successfully', async () => {
      const areas = [{ areaId: 10, primary: true }]
      const areaDetails = [{ id: 10, name: 'Local RMA', areaType: 'RMA' }]

      mockAreaService.getAreaDetailsByIds.mockResolvedValue(areaDetails)

      await validator.validateAreaResponsibilityTypes(areas, 'RMA')

      expect(mockAreaService.getAreaDetailsByIds).toHaveBeenCalledWith([10])
      expect(mockLogger.info).toHaveBeenCalledWith(
        { areaCount: 1, areaType: 'RMA' },
        'Area responsibility validation passed'
      )
    })

    it('throws BadRequestError when some areas do not exist', async () => {
      const areas = [
        { areaId: 1, primary: true },
        { areaId: 999, primary: false }
      ]
      const areaDetails = [{ id: 1, name: 'Thames', areaType: 'EA Area' }]

      mockAreaService.getAreaDetailsByIds.mockResolvedValue(areaDetails)

      await expect(
        validator.validateAreaResponsibilityTypes(areas, 'EA')
      ).rejects.toThrow(BadRequestError)

      await expect(
        validator.validateAreaResponsibilityTypes(areas, 'EA')
      ).rejects.toThrow('The following area IDs do not exist: 999')

      expect(mockLogger.warn).toHaveBeenCalledWith(
        {
          requestedCount: 2,
          foundCount: 1,
          missingAreaIds: [999]
        },
        'Some area IDs do not exist'
      )
    })

    it('throws BadRequestError when multiple areas do not exist', async () => {
      const areas = [
        { areaId: 1, primary: true },
        { areaId: 888, primary: false },
        { areaId: 999, primary: false }
      ]
      const areaDetails = [{ id: 1, name: 'Thames', areaType: 'EA Area' }]

      mockAreaService.getAreaDetailsByIds.mockResolvedValue(areaDetails)

      await expect(
        validator.validateAreaResponsibilityTypes(areas, 'EA')
      ).rejects.toThrow('The following area IDs do not exist: 888, 999')
    })

    it('throws BadRequestError when area type does not match EA responsibility', async () => {
      const areas = [
        { areaId: 1, primary: true },
        { areaId: 2, primary: false }
      ]
      const areaDetails = [
        { id: 1, name: 'Thames', areaType: 'EA Area' },
        { id: 2, name: 'Wrong Type', areaType: 'PSO Area' }
      ]

      mockAreaService.getAreaDetailsByIds.mockResolvedValue(areaDetails)

      await expect(
        validator.validateAreaResponsibilityTypes(areas, 'EA')
      ).rejects.toThrow(BadRequestError)

      await expect(
        validator.validateAreaResponsibilityTypes(areas, 'EA')
      ).rejects.toThrow("All areas must be of type 'EA Area'")

      expect(mockLogger.warn).toHaveBeenCalledWith(
        {
          userResponsibility: 'EA',
          expectedAreaType: 'EA Area',
          invalidAreas: 'Wrong Type (PSO Area)'
        },
        'Area responsibility type mismatch'
      )
    })

    it('throws BadRequestError when area type does not match PSO responsibility', async () => {
      const areas = [{ areaId: 5, primary: true }]
      const areaDetails = [{ id: 5, name: 'Wrong Area', areaType: 'EA Area' }]

      mockAreaService.getAreaDetailsByIds.mockResolvedValue(areaDetails)

      await expect(
        validator.validateAreaResponsibilityTypes(areas, 'PSO')
      ).rejects.toThrow("All areas must be of type 'PSO Area'")
    })

    it('throws BadRequestError when area type does not match RMA responsibility', async () => {
      const areas = [{ areaId: 10, primary: true }]
      const areaDetails = [{ id: 10, name: 'Wrong Area', areaType: 'EA Area' }]

      mockAreaService.getAreaDetailsByIds.mockResolvedValue(areaDetails)

      await expect(
        validator.validateAreaResponsibilityTypes(areas, 'RMA')
      ).rejects.toThrow("All areas must be of type 'RMA'")
    })

    it('throws BadRequestError with multiple invalid areas', async () => {
      const areas = [
        { areaId: 1, primary: true },
        { areaId: 2, primary: false },
        { areaId: 3, primary: false }
      ]
      const areaDetails = [
        { id: 1, name: 'Thames', areaType: 'EA Area' },
        { id: 2, name: 'Wrong 1', areaType: 'PSO Area' },
        { id: 3, name: 'Wrong 2', areaType: 'RMA' }
      ]

      mockAreaService.getAreaDetailsByIds.mockResolvedValue(areaDetails)

      await expect(
        validator.validateAreaResponsibilityTypes(areas, 'EA')
      ).rejects.toThrow('Wrong 1 (PSO Area), Wrong 2 (RMA)')
    })

    it('handles unknown responsibility type gracefully', async () => {
      const areas = [{ areaId: 1, primary: true }]
      const areaDetails = [{ id: 1, name: 'Any Area', areaType: 'Any Type' }]

      mockAreaService.getAreaDetailsByIds.mockResolvedValue(areaDetails)

      // Unknown responsibility type should not validate area types
      await validator.validateAreaResponsibilityTypes(areas, 'UNKNOWN')

      expect(mockLogger.info).toHaveBeenCalledWith(
        { areaCount: 1, areaType: undefined },
        'Area responsibility validation passed'
      )
    })

    it('handles string area IDs correctly', async () => {
      const areas = [{ areaId: '1', primary: true }]
      const areaDetails = [{ id: 1, name: 'Thames', areaType: 'EA Area' }]

      mockAreaService.getAreaDetailsByIds.mockResolvedValue(areaDetails)

      await validator.validateAreaResponsibilityTypes(areas, 'EA')

      expect(mockAreaService.getAreaDetailsByIds).toHaveBeenCalledWith(['1'])
    })

    it('throws correct error code for invalid area IDs', async () => {
      const areas = [{ areaId: 999, primary: true }]

      mockAreaService.getAreaDetailsByIds.mockResolvedValue([])

      try {
        await validator.validateAreaResponsibilityTypes(areas, 'EA')
        expect.fail('Should have thrown BadRequestError')
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestError)
        expect(error.code).toBe(ACCOUNT_ERROR_CODES.INVALID_AREA_IDS)
        expect(error.field).toBe('areas')
      }
    })

    it('throws correct error code for area responsibility mismatch', async () => {
      const areas = [{ areaId: 1, primary: true }]
      const areaDetails = [{ id: 1, name: 'Wrong', areaType: 'PSO Area' }]

      mockAreaService.getAreaDetailsByIds.mockResolvedValue(areaDetails)

      try {
        await validator.validateAreaResponsibilityTypes(areas, 'EA')
        expect.fail('Should have thrown BadRequestError')
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestError)
        expect(error.code).toBe(
          ACCOUNT_ERROR_CODES.AREA_RESPONSIBILITY_MISMATCH
        )
        expect(error.field).toBe('areas')
      }
    })

    it('handles empty areas array', async () => {
      const areas = []
      const areaDetails = []

      mockAreaService.getAreaDetailsByIds.mockResolvedValue(areaDetails)

      await validator.validateAreaResponsibilityTypes(areas, 'EA')

      expect(mockAreaService.getAreaDetailsByIds).toHaveBeenCalledWith([])
      expect(mockLogger.info).toHaveBeenCalledWith(
        { areaCount: 0, userResponsibility: 'EA' },
        'Validating area responsibility types'
      )
    })

    it('handles BigInt area IDs', async () => {
      const areas = [{ areaId: BigInt(1), primary: true }]
      const areaDetails = [
        { id: BigInt(1), name: 'Thames', areaType: 'EA Area' }
      ]

      mockAreaService.getAreaDetailsByIds.mockResolvedValue(areaDetails)

      await validator.validateAreaResponsibilityTypes(areas, 'EA')

      expect(mockAreaService.getAreaDetailsByIds).toHaveBeenCalled()
    })
  })

  describe('_ensureAllAreasExist', () => {
    it('does nothing when all areas exist', () => {
      const areaIds = [1, 2, 3]
      const areaDetails = [
        { id: 1, name: 'Area 1' },
        { id: 2, name: 'Area 2' },
        { id: 3, name: 'Area 3' }
      ]

      expect(() => {
        validator._ensureAllAreasExist(areaIds, areaDetails)
      }).not.toThrow()
    })
  })

  describe('_mapResponsibilityToAreaType', () => {
    it('maps EA to EA Area', () => {
      const result = validator._mapResponsibilityToAreaType('EA')
      expect(result).toBe('EA Area')
    })

    it('maps PSO to PSO Area', () => {
      const result = validator._mapResponsibilityToAreaType('PSO')
      expect(result).toBe('PSO Area')
    })

    it('maps RMA to RMA', () => {
      const result = validator._mapResponsibilityToAreaType('RMA')
      expect(result).toBe('RMA')
    })

    it('returns undefined for unknown responsibility', () => {
      const result = validator._mapResponsibilityToAreaType('UNKNOWN')
      expect(result).toBeUndefined()
    })
  })

  describe('_ensureAreasMatchResponsibility', () => {
    it('does nothing when all areas match', () => {
      const areaDetails = [
        { name: 'Area 1', areaType: 'EA Area' },
        { name: 'Area 2', areaType: 'EA Area' }
      ]

      expect(() => {
        validator._ensureAreasMatchResponsibility(areaDetails, 'EA Area', 'EA')
      }).not.toThrow()
    })

    it('does nothing when expectedAreaType is undefined', () => {
      const areaDetails = [{ name: 'Area 1', areaType: 'Any Type' }]

      expect(() => {
        validator._ensureAreasMatchResponsibility(
          areaDetails,
          undefined,
          'UNKNOWN'
        )
      }).not.toThrow()
    })
  })
})
