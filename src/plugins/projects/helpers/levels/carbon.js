import {
  carbonCostBuildOptionalSchema,
  carbonCostOperationOptionalSchema,
  carbonCostSequesteredOptionalSchema,
  carbonCostAvoidedOptionalSchema,
  carbonSavingsNetEconomicBenefitOptionalSchema,
  carbonOperationalCostForecastOptionalSchema,
  carbonValuesHexdigestOptionalSchema
} from '../../../../common/schemas/project.js'
import { PROJECT_VALIDATION_LEVELS } from '../../../../common/constants/project.js'

const OPTIONAL_CARBON_FIELDS = {
  carbonCostBuild: carbonCostBuildOptionalSchema,
  carbonCostOperation: carbonCostOperationOptionalSchema,
  carbonCostSequestered: carbonCostSequesteredOptionalSchema,
  carbonCostAvoided: carbonCostAvoidedOptionalSchema,
  carbonSavingsNetEconomicBenefit:
    carbonSavingsNetEconomicBenefitOptionalSchema,
  carbonOperationalCostForecast: carbonOperationalCostForecastOptionalSchema
}

/**
 * Carbon impact validation levels.
 *
 * CARBON_IMPACT: All six carbon fields are submitted together (legacy/batch save).
 *              All fields are optional on the backend; frontend enforces required where needed.
 *
 * CARBON_COST_BUILD: Single-step save for the capital carbon build field only.
 *                   Used by the carbon impact wizard pages for per-step saving.
 *
 * CARBON_COST_OPERATION: Single-step save for operational carbon field only.
 *                       Used by the carbon impact wizard pages for per-step saving.
 *
 * CARBON_COST_SEQUESTERED: Single-step save for sequestered carbon field only.
 *                         Used by the carbon impact wizard pages for per-step saving.
 *
 * CARBON_COST_AVOIDED: Single-step save for avoided carbon field only.
 *                     Used by the carbon impact wizard pages for per-step saving.
 *
 * CARBON_SAVINGS_NET_ECONOMIC_BENEFIT: Single-step save for net economic
 *                                      carbon benefit field only.
 *                                      Used by the carbon impact wizard pages for per-step saving.
 *
 * CARBON_OPERATIONAL_COST_FORECAST: Single-step save for operational
 *                                   cost forecast field only.
 *                                   Used by the carbon impact wizard pages for per-step saving.
 */
export const carbonLevels = (referenceNumber) => ({
  [PROJECT_VALIDATION_LEVELS.CARBON_IMPACT]: {
    name: PROJECT_VALIDATION_LEVELS.CARBON_IMPACT,
    fields: {
      referenceNumber,
      ...OPTIONAL_CARBON_FIELDS
    }
  },
  [PROJECT_VALIDATION_LEVELS.CARBON_COST_BUILD]: {
    name: PROJECT_VALIDATION_LEVELS.CARBON_COST_BUILD,
    fields: {
      referenceNumber,
      carbonCostBuild: carbonCostBuildOptionalSchema
    }
  },
  [PROJECT_VALIDATION_LEVELS.CARBON_COST_OPERATION]: {
    name: PROJECT_VALIDATION_LEVELS.CARBON_COST_OPERATION,
    fields: {
      referenceNumber,
      carbonCostOperation: carbonCostOperationOptionalSchema
    }
  },
  [PROJECT_VALIDATION_LEVELS.CARBON_COST_SEQUESTERED]: {
    name: PROJECT_VALIDATION_LEVELS.CARBON_COST_SEQUESTERED,
    fields: {
      referenceNumber,
      carbonCostSequestered: carbonCostSequesteredOptionalSchema
    }
  },
  [PROJECT_VALIDATION_LEVELS.CARBON_COST_AVOIDED]: {
    name: PROJECT_VALIDATION_LEVELS.CARBON_COST_AVOIDED,
    fields: {
      referenceNumber,
      carbonCostAvoided: carbonCostAvoidedOptionalSchema
    }
  },
  [PROJECT_VALIDATION_LEVELS.CARBON_SAVINGS_NET_ECONOMIC_BENEFIT]: {
    name: PROJECT_VALIDATION_LEVELS.CARBON_SAVINGS_NET_ECONOMIC_BENEFIT,
    fields: {
      referenceNumber,
      carbonSavingsNetEconomicBenefit:
        carbonSavingsNetEconomicBenefitOptionalSchema
    }
  },
  [PROJECT_VALIDATION_LEVELS.CARBON_OPERATIONAL_COST_FORECAST]: {
    name: PROJECT_VALIDATION_LEVELS.CARBON_OPERATIONAL_COST_FORECAST,
    fields: {
      referenceNumber,
      carbonOperationalCostForecast: carbonOperationalCostForecastOptionalSchema
    }
  },
  [PROJECT_VALIDATION_LEVELS.CARBON_VALUES_HEXDIGEST]: {
    name: PROJECT_VALIDATION_LEVELS.CARBON_VALUES_HEXDIGEST,
    fields: {
      referenceNumber,
      carbonValuesHexdigest: carbonValuesHexdigestOptionalSchema
    }
  }
})

export { OPTIONAL_CARBON_FIELDS }
