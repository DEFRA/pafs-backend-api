import Joi from 'joi'
import { SIZE } from '../constants/common.js'
import { AUTH_VALIDATION_CODES } from '../constants/auth.js'
import {
  ACCOUNT_STATUS,
  ACCOUNT_VALIDATION_CODES
} from '../constants/accounts.js'

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
  .trim()
  .required()
  .messages({
    'string.empty': AUTH_VALIDATION_CODES.TOKEN_REQUIRED,
    'any.required': AUTH_VALIDATION_CODES.TOKEN_REQUIRED
  })

/**
 * Account status schema - validates account status (pending/active)
 */
export const accountStatusSchema = Joi.string()
  .valid(ACCOUNT_STATUS.PENDING, ACCOUNT_STATUS.ACTIVE, ACCOUNT_STATUS.APPROVED)
  .required()
  .messages({
    'any.required': ACCOUNT_VALIDATION_CODES.STATUS_REQUIRED,
    'any.only': ACCOUNT_VALIDATION_CODES.STATUS_INVALID
  })

/**
 * User ID schema - for updates
 */
export const userIdSchema = Joi.number()
  .integer()
  .positive()
  .label('User ID')
  .required()
  .messages({
    'number.base': ACCOUNT_VALIDATION_CODES.USER_ID_INVALID,
    'number.positive': ACCOUNT_VALIDATION_CODES.USER_ID_INVALID,
    'any.required': ACCOUNT_VALIDATION_CODES.USER_ID_REQUIRED
  })

/**
 * First name schema
 */
export const firstNameSchema = Joi.string()
  .max(SIZE.LENGTH_255)
  .trim()
  .required()
  .label('First Name')
  .messages({
    'string.empty': ACCOUNT_VALIDATION_CODES.FIRST_NAME_REQUIRED,
    'any.required': ACCOUNT_VALIDATION_CODES.FIRST_NAME_REQUIRED,
    'string.max': ACCOUNT_VALIDATION_CODES.FIRST_NAME_TOO_LONG
  })

/**
 * Last name schema
 */
export const lastNameSchema = Joi.string()
  .max(SIZE.LENGTH_255)
  .trim()
  .required()
  .label('Last Name')
  .messages({
    'string.empty': ACCOUNT_VALIDATION_CODES.LAST_NAME_REQUIRED,
    'any.required': ACCOUNT_VALIDATION_CODES.LAST_NAME_REQUIRED,
    'string.max': ACCOUNT_VALIDATION_CODES.LAST_NAME_TOO_LONG
  })

/**
 * Job title schema - conditionally required based on admin flag
 */
export const jobTitleSchema = Joi.string()
  .max(SIZE.LENGTH_255)
  .trim()
  .allow(null, '')
  .label('Job Title')
  .messages({
    'string.max': ACCOUNT_VALIDATION_CODES.JOB_TITLE_TOO_LONG
  })

/**
 * Organisation schema - conditionally required based on admin flag
 */
export const organisationSchema = Joi.string()
  .max(SIZE.LENGTH_255)
  .trim()
  .allow('')
  .label('Organisation')
  .messages({
    'string.max': ACCOUNT_VALIDATION_CODES.ORGANISATION_TOO_LONG
  })

/**
 * Telephone number schema - conditionally required based on admin flag
 */
export const telephoneNumberSchema = Joi.string()
  .max(SIZE.LENGTH_255)
  .trim()
  .pattern(/^[\d\s\-+()]+$/)
  .allow(null, '')
  .label('Telephone Number')
  .messages({
    'string.pattern.base': ACCOUNT_VALIDATION_CODES.TELEPHONE_INVALID_FORMAT,
    'string.max': ACCOUNT_VALIDATION_CODES.TELEPHONE_TOO_LONG
  })

/**
 * Responsibility schema
 */
export const responsibilitySchema = Joi.string()
  .valid('EA', 'RMA', 'PSO')
  .required()
  .label('Responsibility')
  .messages({
    'any.required': ACCOUNT_VALIDATION_CODES.RESPONSIBILITY_REQUIRED,
    'any.only': ACCOUNT_VALIDATION_CODES.RESPONSIBILITY_INVALID
  })

/**
 * Admin flag schema
 */
export const adminFlagSchema = Joi.boolean()
  .default(false)
  .label('Admin Flag')
  .messages({
    'boolean.base': ACCOUNT_VALIDATION_CODES.ADMIN_FLAG_INVALID
  })
