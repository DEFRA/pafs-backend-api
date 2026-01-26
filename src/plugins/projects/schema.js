import Joi from 'joi'
import {
  projectNameSchema,
  projectReferenceNumberSchema
} from '../../common/schemas/project.js'
import { PROPOSAL_VALIDATION_MESSAGES } from '../../common/constants/project.js'
import {
  generateSchemaForLevel,
  VALIDATION_LEVELS
} from './helpers/project-level.js'
import { VALIDATION_ERROR_CODES } from '../../common/constants/common.js'

export const validateProjectName = Joi.object({
  name: projectNameSchema,
  referenceNumber: projectReferenceNumberSchema
})

export const upsertProjectSchema = Joi.object({
  level: Joi.string()
    .valid(...Object.keys(VALIDATION_LEVELS))
    .required()
    .label('Validation Level')
    .messages({
      'any.only': PROPOSAL_VALIDATION_MESSAGES.INVALID_DATA,
      'string.empty': PROPOSAL_VALIDATION_MESSAGES.INVALID_DATA,
      'any.required': PROPOSAL_VALIDATION_MESSAGES.INVALID_DATA
    }),

  payload: Joi.when('level', {
    switch: Object.keys(VALIDATION_LEVELS).map((levelKey) => ({
      is: levelKey,
      then: generateSchemaForLevel(levelKey)
    })),
    otherwise: Joi.object()
  })
    .required()
    .label('Payload')
    .messages({
      'any.required': PROPOSAL_VALIDATION_MESSAGES.INVALID_DATA,
      'alternatives.match':
        'Payload does not match the required schema for the specified level'
    })
})
  .required()
  .label('Project Upsert Payload')
  .messages({
    'object.base': VALIDATION_ERROR_CODES.VALIDATION_INVALID_OBJECT
  })
