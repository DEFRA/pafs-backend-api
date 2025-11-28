import Joi from 'joi'
import { SIZE } from '../constants/common.js'
import { AUTH_VALIDATION_CODES } from '../constants/auth.js'

/**
 * Email schema - validates email format, max length, trims and lowercases
 */
export const emailSchema = Joi.string()
  .email({ tlds: { allow: false } })
  .label('Email')
  .max(SIZE.LENGTH_254)
  .trim()
  .lowercase()
  .required()
  .messages({
    'string.empty': AUTH_VALIDATION_CODES.EMAIL_REQUIRED,
    'any.required': AUTH_VALIDATION_CODES.EMAIL_REQUIRED,
    'string.email': AUTH_VALIDATION_CODES.EMAIL_INVALID_FORMAT,
    'string.max': AUTH_VALIDATION_CODES.EMAIL_TOO_LONG
  })

/**
 * Basic password schema - only checks presence
 */
export const passwordSchema = Joi.string()
  .label('Password')
  .required()
  .messages({
    'string.empty': AUTH_VALIDATION_CODES.PASSWORD_REQUIRED,
    'any.required': AUTH_VALIDATION_CODES.PASSWORD_REQUIRED
  })

/**
 * Strong password schema - enforces strength requirements
 */
export const passwordStrengthSchema = Joi.string()
  .min(SIZE.LENGTH_8)
  .max(SIZE.LENGTH_128)
  .label('Password')
  .pattern(/[A-Z]/, 'UPPERCASE')
  .pattern(/[a-z]/, 'LOWERCASE')
  .pattern(/\d/, 'NUMBER')
  .pattern(/[!@#$%^&*()_.+\-=[\]]/, 'SPECIAL')
  .required()
  .messages({
    'string.empty': AUTH_VALIDATION_CODES.PASSWORD_REQUIRED,
    'any.required': AUTH_VALIDATION_CODES.PASSWORD_REQUIRED,
    'string.min': AUTH_VALIDATION_CODES.PASSWORD_MIN_LENGTH,
    'string.max': AUTH_VALIDATION_CODES.PASSWORD_MAX_LENGTH,
    'string.pattern.name': 'PASSWORD_STRENGTH_{#name}'
  })

/**
 * Token schema - validates token format, max length, trim
 */
export const tokenSchema = Joi.string()
  .label('Token')
  .max(SIZE.LENGTH_32)
  .trim()
  .required()
  .messages({
    'string.empty': AUTH_VALIDATION_CODES.TOKEN_REQUIRED,
    'any.required': AUTH_VALIDATION_CODES.TOKEN_REQUIRED,
    'string.max': AUTH_VALIDATION_CODES.TOKEN_INVALID
  })
