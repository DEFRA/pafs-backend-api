import { describe, it, expect, beforeEach, vi } from 'vitest'
import { validateTimelineFinancialBoundaries } from './timeline-validation.js'
import { HTTP_STATUS } from '../../../../common/constants/index.js'
import {
  PROJECT_VALIDATION_MESSAGES,
  PROJECT_VALIDATION_LEVELS,
  TIMELINE_VALIDATION_LEVELS
} from '../../../../common/constants/project.js'

describe('timeline-validation', () => {
  let mockLogger
  let mockH

  beforeEach(() => {
    mockLogger = {
      warn: vi.fn()
    }

    mockH = {
      response: vi.fn().mockReturnThis(),
      code: vi.fn().mockReturnThis()
    }
  })

  describe('TIMELINE_VALIDATION_LEVELS export', () => {
    it('should export TIMELINE_VALIDATION_LEVELS array with all timeline validation levels', () => {
      expect(TIMELINE_VALIDATION_LEVELS).toEqual([
        PROJECT_VALIDATION_LEVELS.START_OUTLINE_BUSINESS_CASE,
        PROJECT_VALIDATION_LEVELS.COMPLETE_OUTLINE_BUSINESS_CASE,
        PROJECT_VALIDATION_LEVELS.AWARD_CONTRACT,
        PROJECT_VALIDATION_LEVELS.START_CONSTRUCTION,
        PROJECT_VALIDATION_LEVELS.READY_FOR_SERVICE,
        PROJECT_VALIDATION_LEVELS.EARLIEST_WITH_GIA
      ])
    })
  })

  describe('validateTimelineFinancialBoundaries', () => {
    const userId = 'test-user-123'
    const referenceNumber = 'TEST123'

    describe('when fieldConfig is not found', () => {
      it('should return null for invalid validation level', () => {
        const result = validateTimelineFinancialBoundaries(
          {},
          'INVALID_LEVEL',
          2025,
          2026,
          userId,
          referenceNumber,
          mockLogger,
          mockH
        )

        expect(result).toBeNull()
        expect(mockLogger.warn).not.toHaveBeenCalled()
      })
    })

    describe('when month or year is undefined', () => {
      it('should return null when month is undefined', () => {
        const payload = {
          startOutlineBusinessCaseYear: 2025
        }

        const result = validateTimelineFinancialBoundaries(
          payload,
          PROJECT_VALIDATION_LEVELS.START_OUTLINE_BUSINESS_CASE,
          2025,
          2026,
          userId,
          referenceNumber,
          mockLogger,
          mockH
        )

        expect(result).toBeNull()
        expect(mockLogger.warn).not.toHaveBeenCalled()
      })

      it('should return null when year is undefined', () => {
        const payload = {
          startOutlineBusinessCaseMonth: 5
        }

        const result = validateTimelineFinancialBoundaries(
          payload,
          PROJECT_VALIDATION_LEVELS.START_OUTLINE_BUSINESS_CASE,
          2025,
          2026,
          userId,
          referenceNumber,
          mockLogger,
          mockH
        )

        expect(result).toBeNull()
        expect(mockLogger.warn).not.toHaveBeenCalled()
      })
    })

    describe('EARLIEST_WITH_GIA validation', () => {
      describe('when date is before financial start', () => {
        it('should allow date before financial start year', () => {
          const payload = {
            earliestWithGiaMonth: 12,
            earliestWithGiaYear: 2024
          }

          const result = validateTimelineFinancialBoundaries(
            payload,
            PROJECT_VALIDATION_LEVELS.EARLIEST_WITH_GIA,
            2025,
            2026,
            userId,
            referenceNumber,
            mockLogger,
            mockH
          )

          expect(result).toBeNull()
        })

        it('should allow date in March of financial start year (before April boundary)', () => {
          const payload = {
            earliestWithGiaMonth: 3,
            earliestWithGiaYear: 2025
          }

          const result = validateTimelineFinancialBoundaries(
            payload,
            PROJECT_VALIDATION_LEVELS.EARLIEST_WITH_GIA,
            2025,
            2026,
            userId,
            referenceNumber,
            mockLogger,
            mockH
          )

          expect(result).toBeNull()
        })

        it('should allow date in January of financial start year', () => {
          const payload = {
            earliestWithGiaMonth: 1,
            earliestWithGiaYear: 2025
          }

          const result = validateTimelineFinancialBoundaries(
            payload,
            PROJECT_VALIDATION_LEVELS.EARLIEST_WITH_GIA,
            2025,
            2026,
            userId,
            referenceNumber,
            mockLogger,
            mockH
          )

          expect(result).toBeNull()
        })
      })

      describe('when date is on or after financial start', () => {
        it('should return error when date is in April of financial start year (boundary)', () => {
          const payload = {
            earliestWithGiaMonth: 4,
            earliestWithGiaYear: 2025
          }

          const result = validateTimelineFinancialBoundaries(
            payload,
            PROJECT_VALIDATION_LEVELS.EARLIEST_WITH_GIA,
            2025,
            2026,
            userId,
            referenceNumber,
            mockLogger,
            mockH
          )

          expect(result).toBe(mockH)
          expect(mockLogger.warn).toHaveBeenCalledWith(
            {
              userId,
              referenceNumber,
              field: 'Earliest With GIA',
              month: 4,
              year: 2025,
              financialStartYear: 2025
            },
            'Earliest With GIA date is after financial start year'
          )
          expect(mockH.response).toHaveBeenCalledWith({
            validationErrors: [
              {
                errorCode:
                  PROJECT_VALIDATION_MESSAGES.DATE_AFTER_FINANCIAL_START,
                field: 'earliestWithGiaMonth',
                message:
                  'Earliest With GIA must be before the financial start year (before April 2025)'
              }
            ]
          })
          expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.BAD_REQUEST)
        })

        it('should return error when date is after financial start year', () => {
          const payload = {
            earliestWithGiaMonth: 5,
            earliestWithGiaYear: 2026
          }

          const result = validateTimelineFinancialBoundaries(
            payload,
            PROJECT_VALIDATION_LEVELS.EARLIEST_WITH_GIA,
            2025,
            2026,
            userId,
            referenceNumber,
            mockLogger,
            mockH
          )

          expect(result).toBe(mockH)
          expect(mockLogger.warn).toHaveBeenCalledWith(
            {
              userId,
              referenceNumber,
              field: 'Earliest With GIA',
              month: 5,
              year: 2026,
              financialStartYear: 2025
            },
            'Earliest With GIA date is after financial start year'
          )
          expect(mockH.response).toHaveBeenCalledWith({
            validationErrors: [
              {
                errorCode:
                  PROJECT_VALIDATION_MESSAGES.DATE_AFTER_FINANCIAL_START,
                field: 'earliestWithGiaMonth',
                message:
                  'Earliest With GIA must be before the financial start year (before April 2025)'
              }
            ]
          })
          expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.BAD_REQUEST)
        })

        it('should return error when date is in May of financial start year', () => {
          const payload = {
            earliestWithGiaMonth: 5,
            earliestWithGiaYear: 2025
          }

          const result = validateTimelineFinancialBoundaries(
            payload,
            PROJECT_VALIDATION_LEVELS.EARLIEST_WITH_GIA,
            2025,
            2026,
            userId,
            referenceNumber,
            mockLogger,
            mockH
          )

          expect(result).toBe(mockH)
          expect(mockH.response).toHaveBeenCalled()
          expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.BAD_REQUEST)
        })
      })

      describe('when financialStartYear is not provided', () => {
        it('should return null and skip validation', () => {
          const payload = {
            earliestWithGiaMonth: 5,
            earliestWithGiaYear: 2026
          }

          const result = validateTimelineFinancialBoundaries(
            payload,
            PROJECT_VALIDATION_LEVELS.EARLIEST_WITH_GIA,
            null,
            2026,
            userId,
            referenceNumber,
            mockLogger,
            mockH
          )

          expect(result).toBeNull()
          expect(mockLogger.warn).not.toHaveBeenCalled()
        })
      })
    })

    describe('Other timeline fields validation', () => {
      describe('START_OUTLINE_BUSINESS_CASE', () => {
        describe('before financial start validation', () => {
          it('should return error when date is before financial start year', () => {
            const payload = {
              startOutlineBusinessCaseMonth: 12,
              startOutlineBusinessCaseYear: 2024
            }

            const result = validateTimelineFinancialBoundaries(
              payload,
              PROJECT_VALIDATION_LEVELS.START_OUTLINE_BUSINESS_CASE,
              2025,
              2026,
              userId,
              referenceNumber,
              mockLogger,
              mockH
            )

            expect(result).toBe(mockH)
            expect(mockLogger.warn).toHaveBeenCalledWith(
              {
                userId,
                referenceNumber,
                field: 'Start Outline Business Case',
                month: 12,
                year: 2024,
                financialStartYear: 2025
              },
              'Timeline date is before financial start year'
            )
            expect(mockH.response).toHaveBeenCalledWith({
              validationErrors: [
                {
                  errorCode:
                    PROJECT_VALIDATION_MESSAGES.DATE_BEFORE_FINANCIAL_START,
                  field: 'startOutlineBusinessCaseMonth',
                  message:
                    'Start Outline Business Case must be within the financial year range (starts April 2025)'
                }
              ]
            })
            expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.BAD_REQUEST)
          })

          it('should return error when date is in March of financial start year (before April)', () => {
            const payload = {
              startOutlineBusinessCaseMonth: 3,
              startOutlineBusinessCaseYear: 2025
            }

            const result = validateTimelineFinancialBoundaries(
              payload,
              PROJECT_VALIDATION_LEVELS.START_OUTLINE_BUSINESS_CASE,
              2025,
              2026,
              userId,
              referenceNumber,
              mockLogger,
              mockH
            )

            expect(result).toBe(mockH)
            expect(mockH.response).toHaveBeenCalled()
            expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.BAD_REQUEST)
          })

          it('should allow date in April of financial start year (boundary)', () => {
            const payload = {
              startOutlineBusinessCaseMonth: 4,
              startOutlineBusinessCaseYear: 2025
            }

            const result = validateTimelineFinancialBoundaries(
              payload,
              PROJECT_VALIDATION_LEVELS.START_OUTLINE_BUSINESS_CASE,
              2025,
              2026,
              userId,
              referenceNumber,
              mockLogger,
              mockH
            )

            expect(result).toBeNull()
          })
        })

        describe('after financial end validation', () => {
          it('should return error when date is in March after financial end year', () => {
            const payload = {
              startOutlineBusinessCaseMonth: 3,
              startOutlineBusinessCaseYear: 2027
            }

            const result = validateTimelineFinancialBoundaries(
              payload,
              PROJECT_VALIDATION_LEVELS.START_OUTLINE_BUSINESS_CASE,
              2025,
              2026,
              userId,
              referenceNumber,
              mockLogger,
              mockH
            )

            expect(result).toBe(mockH)
            expect(mockLogger.warn).toHaveBeenCalled()
          })

          it('should return error when date is in April after financial end year (boundary)', () => {
            const payload = {
              startOutlineBusinessCaseMonth: 4,
              startOutlineBusinessCaseYear: 2026
            }

            const result = validateTimelineFinancialBoundaries(
              payload,
              PROJECT_VALIDATION_LEVELS.START_OUTLINE_BUSINESS_CASE,
              2025,
              2026,
              userId,
              referenceNumber,
              mockLogger,
              mockH
            )

            expect(result).toBe(mockH)
            expect(mockLogger.warn).toHaveBeenCalledWith(
              {
                userId,
                referenceNumber,
                field: 'Start Outline Business Case',
                month: 4,
                year: 2026,
                financialEndYear: 2026
              },
              'Timeline date is after financial end year'
            )
            expect(mockH.response).toHaveBeenCalledWith({
              validationErrors: [
                {
                  errorCode:
                    PROJECT_VALIDATION_MESSAGES.DATE_AFTER_FINANCIAL_END,
                  field: 'startOutlineBusinessCaseMonth',
                  message:
                    'Start Outline Business Case must be within the financial year range (ends March 2027)'
                }
              ]
            })
            expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.BAD_REQUEST)
          })

          it('should return error when date is after financial end year', () => {
            const payload = {
              startOutlineBusinessCaseMonth: 5,
              startOutlineBusinessCaseYear: 2027
            }

            const result = validateTimelineFinancialBoundaries(
              payload,
              PROJECT_VALIDATION_LEVELS.START_OUTLINE_BUSINESS_CASE,
              2025,
              2026,
              userId,
              referenceNumber,
              mockLogger,
              mockH
            )

            expect(result).toBe(mockH)
            expect(mockH.response).toHaveBeenCalled()
            expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.BAD_REQUEST)
          })
        })

        describe('within financial boundaries', () => {
          it('should allow date within financial year range', () => {
            const payload = {
              startOutlineBusinessCaseMonth: 7,
              startOutlineBusinessCaseYear: 2025
            }

            const result = validateTimelineFinancialBoundaries(
              payload,
              PROJECT_VALIDATION_LEVELS.START_OUTLINE_BUSINESS_CASE,
              2025,
              2026,
              userId,
              referenceNumber,
              mockLogger,
              mockH
            )

            expect(result).toBeNull()
            expect(mockLogger.warn).not.toHaveBeenCalled()
          })
        })

        describe('when financial years are not provided', () => {
          it('should return null when financialStartYear is not provided', () => {
            const payload = {
              startOutlineBusinessCaseMonth: 3,
              startOutlineBusinessCaseYear: 2024
            }

            const result = validateTimelineFinancialBoundaries(
              payload,
              PROJECT_VALIDATION_LEVELS.START_OUTLINE_BUSINESS_CASE,
              null,
              2026,
              userId,
              referenceNumber,
              mockLogger,
              mockH
            )

            expect(result).toBeNull()
          })

          it('should return null when financialEndYear is not provided', () => {
            const payload = {
              startOutlineBusinessCaseMonth: 5,
              startOutlineBusinessCaseYear: 2027
            }

            const result = validateTimelineFinancialBoundaries(
              payload,
              PROJECT_VALIDATION_LEVELS.START_OUTLINE_BUSINESS_CASE,
              2025,
              null,
              userId,
              referenceNumber,
              mockLogger,
              mockH
            )

            expect(result).toBeNull()
          })
        })
      })

      describe('COMPLETE_OUTLINE_BUSINESS_CASE', () => {
        it('should validate with correct field names', () => {
          const payload = {
            completeOutlineBusinessCaseMonth: 12,
            completeOutlineBusinessCaseYear: 2024
          }

          const result = validateTimelineFinancialBoundaries(
            payload,
            PROJECT_VALIDATION_LEVELS.COMPLETE_OUTLINE_BUSINESS_CASE,
            2025,
            2026,
            userId,
            referenceNumber,
            mockLogger,
            mockH
          )

          expect(result).toBe(mockH)
          expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.objectContaining({
              field: 'Complete Outline Business Case'
            }),
            'Timeline date is before financial start year'
          )
        })

        it('should allow valid date within range', () => {
          const payload = {
            completeOutlineBusinessCaseMonth: 6,
            completeOutlineBusinessCaseYear: 2025
          }

          const result = validateTimelineFinancialBoundaries(
            payload,
            PROJECT_VALIDATION_LEVELS.COMPLETE_OUTLINE_BUSINESS_CASE,
            2025,
            2026,
            userId,
            referenceNumber,
            mockLogger,
            mockH
          )

          expect(result).toBeNull()
        })
      })

      describe('AWARD_CONTRACT', () => {
        it('should validate with correct field names', () => {
          const payload = {
            awardContractMonth: 2,
            awardContractYear: 2025
          }

          const result = validateTimelineFinancialBoundaries(
            payload,
            PROJECT_VALIDATION_LEVELS.AWARD_CONTRACT,
            2025,
            2026,
            userId,
            referenceNumber,
            mockLogger,
            mockH
          )

          expect(result).toBe(mockH)
          expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.objectContaining({
              field: 'Award Contract'
            }),
            'Timeline date is before financial start year'
          )
        })
      })

      describe('START_CONSTRUCTION', () => {
        it('should validate with correct field names', () => {
          const payload = {
            startConstructionMonth: 8,
            startConstructionYear: 2025
          }

          const result = validateTimelineFinancialBoundaries(
            payload,
            PROJECT_VALIDATION_LEVELS.START_CONSTRUCTION,
            2025,
            2026,
            userId,
            referenceNumber,
            mockLogger,
            mockH
          )

          expect(result).toBeNull()
        })
      })

      describe('READY_FOR_SERVICE', () => {
        it('should validate with correct field names', () => {
          const payload = {
            readyForServiceMonth: 5,
            readyForServiceYear: 2027
          }

          const result = validateTimelineFinancialBoundaries(
            payload,
            PROJECT_VALIDATION_LEVELS.READY_FOR_SERVICE,
            2025,
            2026,
            userId,
            referenceNumber,
            mockLogger,
            mockH
          )

          expect(result).toBe(mockH)
          expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.objectContaining({
              field: 'Ready for Service'
            }),
            'Timeline date is after financial end year'
          )
        })
      })
    })

    describe('edge cases', () => {
      it('should handle month value 1 (January) correctly', () => {
        const payload = {
          startOutlineBusinessCaseMonth: 1,
          startOutlineBusinessCaseYear: 2025
        }

        const result = validateTimelineFinancialBoundaries(
          payload,
          PROJECT_VALIDATION_LEVELS.START_OUTLINE_BUSINESS_CASE,
          2025,
          2026,
          userId,
          referenceNumber,
          mockLogger,
          mockH
        )

        expect(result).toBe(mockH) // Before April
      })

      it('should handle month value 12 (December) correctly', () => {
        const payload = {
          startOutlineBusinessCaseMonth: 12,
          startOutlineBusinessCaseYear: 2025
        }

        const result = validateTimelineFinancialBoundaries(
          payload,
          PROJECT_VALIDATION_LEVELS.START_OUTLINE_BUSINESS_CASE,
          2025,
          2026,
          userId,
          referenceNumber,
          mockLogger,
          mockH
        )

        expect(result).toBeNull() // Within range
      })

      it('should handle year boundaries correctly', () => {
        const payload = {
          startOutlineBusinessCaseMonth: 4,
          startOutlineBusinessCaseYear: 2025
        }

        const result = validateTimelineFinancialBoundaries(
          payload,
          PROJECT_VALIDATION_LEVELS.START_OUTLINE_BUSINESS_CASE,
          2025,
          2025,
          userId,
          referenceNumber,
          mockLogger,
          mockH
        )

        expect(result).toBe(mockH) // April 2025 is boundary - same as financial end, so invalid
      })
    })
  })
})
