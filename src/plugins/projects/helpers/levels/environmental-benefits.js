import {
  environmentalBenefitsSchema,
  environmentalBenefitsGateSchema,
  environmentalBenefitsConditionalQuantitySchema,
  ENVIRONMENTAL_BENEFITS_FIELDS
} from '../../../../common/schemas/project.js'
import { PROJECT_VALIDATION_LEVELS } from '../../../../common/constants/project.js'

export const environmentalBenefitsLevels = (referenceNumber) => {
  const levels = {
    [PROJECT_VALIDATION_LEVELS.ENVIRONMENTAL_BENEFITS]: {
      name: PROJECT_VALIDATION_LEVELS.ENVIRONMENTAL_BENEFITS,
      fields: {
        referenceNumber,
        environmentalBenefits: environmentalBenefitsSchema
      }
    }
  }

  ENVIRONMENTAL_BENEFITS_FIELDS.forEach(
    ({ gate, gateLevel, quantity, quantityLevel }) => {
      levels[PROJECT_VALIDATION_LEVELS[gateLevel]] = {
        name: PROJECT_VALIDATION_LEVELS[gateLevel],
        fields: {
          referenceNumber,
          [gate]: environmentalBenefitsGateSchema(gate)
        }
      }

      levels[PROJECT_VALIDATION_LEVELS[quantityLevel]] = {
        name: PROJECT_VALIDATION_LEVELS[quantityLevel],
        fields: {
          referenceNumber,
          [gate]: environmentalBenefitsGateSchema(gate),
          [quantity]: environmentalBenefitsConditionalQuantitySchema(
            quantity,
            gate
          )
        }
      }
    }
  )

  return levels
}
