import {
  projectFinancialEndYearSchema,
  projectFinancialStartYearSchema,
  projectInterventionTypeSchema,
  projectMainInterventionTypeSchema,
  projectNameSchema,
  projectAreaIdSchema,
  projectTypeSchema
} from '../../../../common/schemas/project.js'
import { PROJECT_VALIDATION_LEVELS } from '../../../../common/constants/project.js'

export const initialLevels = (referenceNumber) => ({
  [PROJECT_VALIDATION_LEVELS.INITIAL_SAVE]: {
    name: PROJECT_VALIDATION_LEVELS.INITIAL_SAVE,
    fields: {
      name: projectNameSchema,
      areaId: projectAreaIdSchema,
      projectType: projectTypeSchema,
      projectInterventionTypes: projectInterventionTypeSchema,
      mainInterventionType: projectMainInterventionTypeSchema,
      financialStartYear: projectFinancialStartYearSchema,
      financialEndYear: projectFinancialEndYearSchema
    }
  },

  [PROJECT_VALIDATION_LEVELS.PROJECT_NAME]: {
    name: PROJECT_VALIDATION_LEVELS.PROJECT_NAME,
    fields: {
      referenceNumber,
      name: projectNameSchema
    }
  },

  [PROJECT_VALIDATION_LEVELS.PROJECT_AREA]: {
    name: PROJECT_VALIDATION_LEVELS.PROJECT_AREA,
    fields: {
      referenceNumber,
      areaId: projectAreaIdSchema
    }
  },

  [PROJECT_VALIDATION_LEVELS.PROJECT_TYPE]: {
    name: PROJECT_VALIDATION_LEVELS.PROJECT_TYPE,
    fields: {
      referenceNumber,
      projectType: projectTypeSchema,
      projectInterventionTypes: projectInterventionTypeSchema,
      mainInterventionType: projectMainInterventionTypeSchema
    }
  },

  [PROJECT_VALIDATION_LEVELS.FINANCIAL_START_YEAR]: {
    name: PROJECT_VALIDATION_LEVELS.FINANCIAL_START_YEAR,
    fields: {
      referenceNumber,
      financialStartYear: projectFinancialStartYearSchema
    }
  },

  [PROJECT_VALIDATION_LEVELS.FINANCIAL_END_YEAR]: {
    name: PROJECT_VALIDATION_LEVELS.FINANCIAL_END_YEAR,
    fields: {
      referenceNumber,
      financialEndYear: projectFinancialEndYearSchema
    }
  }
})
