import Joi from 'joi'
import { emailSchema } from '../../common/schemas/index.js'
import { VALIDATION_ERROR_CODES } from '../../common/constants/common.js'

/**
 * Schema for email validation request
 */
export const validateEmailPayloadSchema = Joi.object({
  email: emailSchema,
  checkDisposable: Joi.boolean().default(true).optional(),
  checkDnsMx: Joi.boolean().default(true).optional(),
  checkDuplicate: Joi.boolean().default(true).optional(),
  excludeUserId: Joi.number().integer().positive().optional()
})
  .options({ abortEarly: false })
  .label('Validate Email Payload')
  .messages({
    'object.base': VALIDATION_ERROR_CODES.VALIDATION_INVALID_OBJECT
  })
