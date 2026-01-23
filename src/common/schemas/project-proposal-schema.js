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
  rmaName: Joi.string().trim().required().allow(null, ''),
  projectInterventionTypes: Joi.when('projectType', {
    is: Joi.alternatives().try('DEF', 'REP', 'REF'),
    then: Joi.array()
      .items(Joi.string().valid('nfm', 'pfr', 'sds', 'other'))
      .min(1)
      .required()
      .messages({
        'array.min': 'At least one intervention type is required',
        'any.required': 'Intervention types are required for this project type'
      }),
    otherwise: Joi.any().forbidden().messages({
      'any.unknown': 'Intervention types are not allowed for this project type'
    })
  }),
  mainInterventionType: Joi.string()
    .valid('nfm', 'pfr', 'sds', 'other')
    .allow(null)
    .when('projectType', {
      is: Joi.alternatives().try('DEF', 'REP', 'REF'),
      then: Joi.string()
        .valid('nfm', 'pfr', 'sds', 'other')
        .required()
        .messages({
          'any.required':
            'Main intervention type is required for this project type'
        }),
      otherwise: Joi.any().forbidden().messages({
        'any.unknown':
          'Main intervention type is not allowed for this project type'
      })
    }),
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
