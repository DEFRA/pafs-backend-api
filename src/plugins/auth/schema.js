import Joi from 'joi'
import {
  emailSchema,
  passwordSchema,
  passwordStrengthSchema
} from '../../common/schemas/index.js'
import { VALIDATION_ERROR_CODES } from '../../common/constants/common.js'
import {
  AUTH_VALIDATION_CODES,
  TOKEN_TYPES
} from '../../common/constants/auth.js'
import { tokenSchema } from '../../common/schemas/account.js'

/**
 * Login form schema - combines email and password
 */
export const loginSchema = Joi.object({
  email: emailSchema,
  password: passwordSchema
})
  .options({
    abortEarly: false
  })
  .label('Login')
  .messages({
    'object.base': VALIDATION_ERROR_CODES.VALIDATION_INVALID_OBJECT
  })

/**
 * Forgot password form schema
 */
export const forgotPasswordSchema = Joi.object({
  email: emailSchema
})
  .options({
    abortEarly: false
  })
  .label('Forgot Password')
  .messages({
    'object.base': VALIDATION_ERROR_CODES.VALIDATION_INVALID_OBJECT
  })

/**
 * Reset password form schema
 */
export const resetPasswordSchema = Joi.object({
  token: tokenSchema,
  password: passwordStrengthSchema,
  confirmPassword: Joi.string().valid(Joi.ref('password')).required().messages({
    'any.only': AUTH_VALIDATION_CODES.PASSWORD_MISMATCH,
    'any.required': AUTH_VALIDATION_CODES.PASSWORD_MISMATCH
  })
})
  .options({
    abortEarly: false
  })
  .label('Reset Password')
  .messages({
    'object.base': VALIDATION_ERROR_CODES.VALIDATION_INVALID_OBJECT
  })

/**
 * Token schema - validates token format, max length, trim and type
 */
export const validateTokenSchema = Joi.object({
  token: tokenSchema,
  type: Joi.string()
    .valid(TOKEN_TYPES.RESET, TOKEN_TYPES.INVITATION)
    .required()
    .messages({
      'any.required': AUTH_VALIDATION_CODES.TOKEN_TYPE_REQUIRED,
      'any.only': AUTH_VALIDATION_CODES.TOKEN_TYPE_INVALID
    })
})
