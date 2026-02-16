import Joi from 'joi'
import { projectReferenceNumberSchema } from '../../../common/schemas/project.js'
import { PROJECT_VALIDATION_MESSAGES } from '../../../common/constants/project.js'
import { initialLevels } from './levels/initial.js'
import { timelineLevels } from './levels/timeline.js'
import { approachLevels } from './levels/approach.js'
import { confidenceLevels } from './levels/confidence.js'
import { environmentalBenefitsLevels } from './levels/environmental-benefits.js'
import { risksLevels } from './levels/risks.js'

const referenceNumber = projectReferenceNumberSchema.required().messages({
  'any.required': PROJECT_VALIDATION_MESSAGES.REFERENCE_NUMBER_REQUIRED
})

export const VALIDATION_LEVELS = {
  ...initialLevels(referenceNumber),
  ...timelineLevels(referenceNumber),
  ...approachLevels(referenceNumber),
  ...confidenceLevels(referenceNumber),
  ...environmentalBenefitsLevels(referenceNumber),
  ...risksLevels(referenceNumber)
  // Add more levels as needed
}

/**
 * Generate dynamic schema based on validation level(s)
 * @param {string|string[]} levels - Single level or array of levels to validate
 * @returns {Joi.ObjectSchema} - Combined Joi schema for the specified level(s)
 */
export const generateSchemaForLevel = (levels) => {
  // Convert single level to array
  const levelArray = Array.isArray(levels) ? levels : [levels]

  // Collect all fields from specified levels
  const combinedFields = {}

  levelArray.forEach((level) => {
    const levelConfig = VALIDATION_LEVELS[level]
    if (!levelConfig) {
      throw new Error(`Invalid validation level: ${level}`)
    }

    // Merge fields from this level
    Object.assign(combinedFields, levelConfig.fields)
  })

  return Joi.object(combinedFields)
}
