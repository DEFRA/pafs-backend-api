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
