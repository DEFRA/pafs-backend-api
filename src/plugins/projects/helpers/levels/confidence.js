import {
  confidenceHomesBetterProtectedSchema,
  confidenceHomesByGatewayFourSchema,
  confidenceSecuredPartnershipFundingSchema
} from '../../../../common/schemas/project.js'
import { PROJECT_VALIDATION_LEVELS } from '../../../../common/constants/project.js'

export const confidenceLevels = (referenceNumber) => ({
  [PROJECT_VALIDATION_LEVELS.CONFIDENCE_HOMES_BETTER_PROTECTED]: {
    name: PROJECT_VALIDATION_LEVELS.CONFIDENCE_HOMES_BETTER_PROTECTED,
    fields: {
      referenceNumber,
      confidenceHomesBetterProtected: confidenceHomesBetterProtectedSchema
    }
  },

  [PROJECT_VALIDATION_LEVELS.CONFIDENCE_HOMES_BY_GATEWAY_FOUR]: {
    name: PROJECT_VALIDATION_LEVELS.CONFIDENCE_HOMES_BY_GATEWAY_FOUR,
    fields: {
      referenceNumber,
      confidenceHomesByGatewayFour: confidenceHomesByGatewayFourSchema
    }
  },

  [PROJECT_VALIDATION_LEVELS.CONFIDENCE_SECURED_PARTNERSHIP_FUNDING]: {
    name: PROJECT_VALIDATION_LEVELS.CONFIDENCE_SECURED_PARTNERSHIP_FUNDING,
    fields: {
      referenceNumber,
      confidenceSecuredPartnershipFunding:
        confidenceSecuredPartnershipFundingSchema
    }
  }
})
