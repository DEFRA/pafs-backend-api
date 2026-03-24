import {
  wlcEstimatedWholeLifePvCostsRequiredSchema,
  wlcEstimatedDesignConstructionCostsRequiredSchema,
  wlcEstimatedRiskContingencyCostsRequiredSchema,
  wlcEstimatedFutureCostsRequiredSchema,
  wlcEstimatedWholeLifePvCostsOptionalSchema,
  wlcEstimatedDesignConstructionCostsOptionalSchema,
  wlcEstimatedRiskContingencyCostsOptionalSchema,
  wlcEstimatedFutureCostsOptionalSchema
} from '../../../../common/schemas/project.js'
import { PROJECT_VALIDATION_LEVELS } from '../../../../common/constants/project.js'

/**
 * All four required WLC fields (DEF / REF / REP).
 */
const REQUIRED_WLC_FIELDS = {
  wlcEstimatedWholeLifePvCosts: wlcEstimatedWholeLifePvCostsRequiredSchema,
  wlcEstimatedDesignConstructionCosts:
    wlcEstimatedDesignConstructionCostsRequiredSchema,
  wlcEstimatedRiskContingencyCosts:
    wlcEstimatedRiskContingencyCostsRequiredSchema,
  wlcEstimatedFutureCosts: wlcEstimatedFutureCostsRequiredSchema
}

/**
 * All four optional WLC fields (ELO / HCR).
 */
const OPTIONAL_WLC_FIELDS = {
  wlcEstimatedWholeLifePvCosts: wlcEstimatedWholeLifePvCostsOptionalSchema,
  wlcEstimatedDesignConstructionCosts:
    wlcEstimatedDesignConstructionCostsOptionalSchema,
  wlcEstimatedRiskContingencyCosts:
    wlcEstimatedRiskContingencyCostsOptionalSchema,
  wlcEstimatedFutureCosts: wlcEstimatedFutureCostsOptionalSchema
}

/**
 * The WHOLE_LIFE_COST level accepts both required and optional fields.
 * The frontend is responsible for enforcing which project types need mandatory fields;
 * the backend level permits both to support all project types in one level.
 */
export const wlcLevels = (referenceNumber) => ({
  [PROJECT_VALIDATION_LEVELS.WHOLE_LIFE_COST]: {
    name: PROJECT_VALIDATION_LEVELS.WHOLE_LIFE_COST,
    fields: {
      referenceNumber,
      ...OPTIONAL_WLC_FIELDS
    }
  }
})

export { REQUIRED_WLC_FIELDS, OPTIONAL_WLC_FIELDS }
