import { describe, test, expect, beforeEach, vi } from 'vitest'
import { validateConfidenceFields } from './validate-confidence-fields.js'
import {
  PROJECT_TYPES,
  PROJECT_VALIDATION_LEVELS
} from '../../../../common/constants/project.js'

describe('validateConfidenceFields', () => {
  let mockH

  beforeEach(() => {
    mockH = {
      response: vi.fn().mockReturnThis(),
      code: vi.fn().mockReturnThis()
    }
  })

  describe('when validating confidence field levels', () => {
    test('should return error for ELO project type with CONFIDENCE_HOMES_BETTER_PROTECTED level', () => {
      const existingProject = { projectType: PROJECT_TYPES.ELO }
      const validationLevel =
        PROJECT_VALIDATION_LEVELS.CONFIDENCE_HOMES_BETTER_PROTECTED

      const result = validateConfidenceFields(
        validationLevel,
        existingProject,
        mockH
      )

      expect(result).not.toBeNull()
      expect(mockH.response).toHaveBeenCalledWith({
        validationErrors: [
          {
            field: 'projectType',
            message:
              'Confidence fields cannot be updated for project types: ELO, HCR, STR, STU',
            errorCode: expect.any(String)
          }
        ]
      })
      expect(mockH.code).toHaveBeenCalledWith(400)
    })

    test('should return error for HCR project type with CONFIDENCE_HOMES_BY_GATEWAY_FOUR level', () => {
      const existingProject = { projectType: PROJECT_TYPES.HCR }
      const validationLevel =
        PROJECT_VALIDATION_LEVELS.CONFIDENCE_HOMES_BY_GATEWAY_FOUR

      const result = validateConfidenceFields(
        validationLevel,
        existingProject,
        mockH
      )

      expect(result).not.toBeNull()
      expect(mockH.response).toHaveBeenCalled()
    })

    test('should return error for STR project type with CONFIDENCE_SECURED_PARTNERSHIP_FUNDING level', () => {
      const existingProject = { projectType: PROJECT_TYPES.STR }
      const validationLevel =
        PROJECT_VALIDATION_LEVELS.CONFIDENCE_SECURED_PARTNERSHIP_FUNDING

      const result = validateConfidenceFields(
        validationLevel,
        existingProject,
        mockH
      )

      expect(result).not.toBeNull()
      expect(mockH.response).toHaveBeenCalled()
    })

    test('should return error for STU project type with CONFIDENCE_HOMES_BETTER_PROTECTED level', () => {
      const existingProject = { projectType: PROJECT_TYPES.STU }
      const validationLevel =
        PROJECT_VALIDATION_LEVELS.CONFIDENCE_HOMES_BETTER_PROTECTED

      const result = validateConfidenceFields(
        validationLevel,
        existingProject,
        mockH
      )

      expect(result).not.toBeNull()
      expect(mockH.response).toHaveBeenCalled()
    })

    test('should return null for DEF project type with confidence level', () => {
      const existingProject = { projectType: PROJECT_TYPES.DEF }
      const validationLevel =
        PROJECT_VALIDATION_LEVELS.CONFIDENCE_HOMES_BETTER_PROTECTED

      const result = validateConfidenceFields(
        validationLevel,
        existingProject,
        mockH
      )

      expect(result).toBeNull()
      expect(mockH.response).not.toHaveBeenCalled()
    })

    test('should return null for REP project type with confidence level', () => {
      const existingProject = { projectType: PROJECT_TYPES.REP }
      const validationLevel =
        PROJECT_VALIDATION_LEVELS.CONFIDENCE_HOMES_BY_GATEWAY_FOUR

      const result = validateConfidenceFields(
        validationLevel,
        existingProject,
        mockH
      )

      expect(result).toBeNull()
      expect(mockH.response).not.toHaveBeenCalled()
    })

    test('should return null for REF project type with confidence level', () => {
      const existingProject = { projectType: PROJECT_TYPES.REF }
      const validationLevel =
        PROJECT_VALIDATION_LEVELS.CONFIDENCE_SECURED_PARTNERSHIP_FUNDING

      const result = validateConfidenceFields(
        validationLevel,
        existingProject,
        mockH
      )

      expect(result).toBeNull()
      expect(mockH.response).not.toHaveBeenCalled()
    })
  })

  describe('when validating non-confidence levels', () => {
    test('should return null for PROJECT_TYPE level even with restricted project type', () => {
      const existingProject = { projectType: PROJECT_TYPES.ELO }
      const validationLevel = PROJECT_VALIDATION_LEVELS.PROJECT_TYPE

      const result = validateConfidenceFields(
        validationLevel,
        existingProject,
        mockH
      )

      expect(result).toBeNull()
      expect(mockH.response).not.toHaveBeenCalled()
    })

    test('should return null for PROJECT_NAME level', () => {
      const existingProject = { projectType: PROJECT_TYPES.HCR }
      const validationLevel = PROJECT_VALIDATION_LEVELS.PROJECT_NAME

      const result = validateConfidenceFields(
        validationLevel,
        existingProject,
        mockH
      )

      expect(result).toBeNull()
      expect(mockH.response).not.toHaveBeenCalled()
    })

    test('should return null for RISK level', () => {
      const existingProject = { projectType: PROJECT_TYPES.STR }
      const validationLevel = PROJECT_VALIDATION_LEVELS.RISK

      const result = validateConfidenceFields(
        validationLevel,
        existingProject,
        mockH
      )

      expect(result).toBeNull()
      expect(mockH.response).not.toHaveBeenCalled()
    })
  })

  describe('when creating new project', () => {
    test('should return null when existingProject is null', () => {
      const existingProject = null
      const validationLevel =
        PROJECT_VALIDATION_LEVELS.CONFIDENCE_HOMES_BETTER_PROTECTED

      const result = validateConfidenceFields(
        validationLevel,
        existingProject,
        mockH
      )

      expect(result).toBeNull()
      expect(mockH.response).not.toHaveBeenCalled()
    })

    test('should return null when existingProject is undefined', () => {
      const existingProject = undefined
      const validationLevel =
        PROJECT_VALIDATION_LEVELS.CONFIDENCE_HOMES_BY_GATEWAY_FOUR

      const result = validateConfidenceFields(
        validationLevel,
        existingProject,
        mockH
      )

      expect(result).toBeNull()
      expect(mockH.response).not.toHaveBeenCalled()
    })
  })
})
