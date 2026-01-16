import Joi from 'joi'
import { PROJECT_PROPOSAL_VALIDATION_MESSAGES } from '../constants/project-proposal-messages.js'

export const projectNameSchema = Joi.object({
  name: Joi.string()
    .trim()
    .min(1)
    .pattern(/^[a-zA-Z0-9_-]+$/)
    .required()
    .messages({
      'string.empty': PROJECT_PROPOSAL_VALIDATION_MESSAGES.NAME_REQUIRED,
      'string.pattern.base':
        PROJECT_PROPOSAL_VALIDATION_MESSAGES.NAME_INVALID_FORMAT
    })
}).unknown(true)

export const createProjectProposalSchema = Joi.object({
  name: Joi.string().trim().min(1).required().messages({
    'string.empty': PROJECT_PROPOSAL_VALIDATION_MESSAGES.NAME_REQUIRED
  }),
  projectType: Joi.string()
    .valid('DEF', 'REP', 'REF', 'HCR', 'STR', 'STU', 'ELO')
    .required()
    .messages({
      'any.only': 'Project type must be DEF, REP, REF, HCR, STR, STU or ELO',
      'any.required': 'Project type is required'
    }),
  // RFCC code determined from area hierarchy:
  // Level 1: EA (Environment Agency) - Top level
  // Level 2: PSO (parent_id → EA) - Has RFCC code in sub_type
  // Level 3: RMA (parent_id → PSO) - Inherits RFCC from parent PSO's sub_type
  // Frontend extracts RFCC code from selected area and sends it here
  rfccCode: Joi.string()
    .valid(
      'AC',
      'AE',
      'AN',
      'NO',
      'NW',
      'SN',
      'SO',
      'SW',
      'TH',
      'TR',
      'TS',
      'WX',
      'YO'
    )
    .default('AN')
    .messages({
      'any.only': 'Invalid RFCC code'
    }),
  // RMA area name (extracted from selected area on frontend)
  rmaName: Joi.string().trim().required().allow(null, ''),
  projectIntervesionTypes: Joi.array()
    .items(Joi.string())
    .default([])
    .optional(),
  mainIntervensionType: Joi.string().allow(null).optional(),
  projectStartFinancialYear: Joi.string()
    .pattern(/^\d{4}$/)
    .required()
    .messages({
      'string.pattern.base': 'First financial year must be a 4-digit year',
      'any.required': 'First financial year is required'
    }),
  projectEndFinancialYear: Joi.string()
    .pattern(/^\d{4}$/)
    .required()
    .messages({
      'string.pattern.base': 'Last financial year must be a 4-digit year',
      'any.required': 'Last financial year is required'
    })
})
