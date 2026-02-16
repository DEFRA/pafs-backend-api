import {
  approachSchema,
  urgencyReasonSchema,
  urgencyDetailsSchema
} from '../../../../common/schemas/project.js'
import { PROJECT_VALIDATION_LEVELS } from '../../../../common/constants/project.js'

export const approachLevels = (referenceNumber) => ({
  [PROJECT_VALIDATION_LEVELS.APPROACH]: {
    name: PROJECT_VALIDATION_LEVELS.APPROACH,
    fields: {
      referenceNumber,
      approach: approachSchema
    }
  },

  [PROJECT_VALIDATION_LEVELS.URGENCY_REASON]: {
    name: PROJECT_VALIDATION_LEVELS.URGENCY_REASON,
    fields: {
      referenceNumber,
      urgencyReason: urgencyReasonSchema
    }
  },

  [PROJECT_VALIDATION_LEVELS.URGENCY_DETAILS]: {
    name: PROJECT_VALIDATION_LEVELS.URGENCY_DETAILS,
    fields: {
      referenceNumber,
      urgencyReason: urgencyReasonSchema,
      urgencyDetails: urgencyDetailsSchema
    }
  }
})
