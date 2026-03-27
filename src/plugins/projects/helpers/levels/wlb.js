import Joi from 'joi'
import {
  wlbEstimatedWholeLifePvBenefitsRequiredSchema,
  wlbEstimatedWholeLifePvBenefitsOptionalSchema,
  wlbEstimatedPropertyDamagesAvoidedOptionalSchema,
  wlbEstimatedEnvironmentalBenefitsOptionalSchema,
  wlbEstimatedRecreationTourismBenefitsOptionalSchema,
  wlbEstimatedLandValueUpliftBenefitsOptionalSchema
} from '../../../../common/schemas/project.js'
import {
  PROJECT_TYPES,
  PROJECT_VALIDATION_LEVELS
} from '../../../../common/constants/project.js'

/**
 * WHOLE_LIFE_BENEFITS validation by project type:
 * - DEF/REF/REP: first field required, remaining optional
 * - ELO/HCR: all optional
 */
export const wlbLevels = (referenceNumber) => ({
  [PROJECT_VALIDATION_LEVELS.WHOLE_LIFE_BENEFITS]: {
    name: PROJECT_VALIDATION_LEVELS.WHOLE_LIFE_BENEFITS,
    fields: {
      referenceNumber,
      projectType: Joi.string()
        .valid(...Object.values(PROJECT_TYPES))
        .optional(),
      wlbEstimatedWholeLifePvBenefits: Joi.alternatives().conditional(
        'projectType',
        {
          is: Joi.valid(
            PROJECT_TYPES.DEF,
            PROJECT_TYPES.REF,
            PROJECT_TYPES.REP
          ),
          then: wlbEstimatedWholeLifePvBenefitsRequiredSchema,
          otherwise: wlbEstimatedWholeLifePvBenefitsOptionalSchema
        }
      ),
      wlbEstimatedPropertyDamagesAvoided:
        wlbEstimatedPropertyDamagesAvoidedOptionalSchema,
      wlbEstimatedEnvironmentalBenefits:
        wlbEstimatedEnvironmentalBenefitsOptionalSchema,
      wlbEstimatedRecreationTourismBenefits:
        wlbEstimatedRecreationTourismBenefitsOptionalSchema,
      wlbEstimatedLandValueUpliftBenefits:
        wlbEstimatedLandValueUpliftBenefitsOptionalSchema
    }
  }
})
