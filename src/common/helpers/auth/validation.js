import Joi from 'joi'
import { EMAIL, PASSWORD } from '../../constants.js'

const emailSchema = Joi.string()
  .email({ tlds: { allow: false } })
  .max(EMAIL.MAX_LENGTH)
  .trim()
  .lowercase()
  .required()

const basicPasswordSchema = Joi.string().required()

const strongPasswordSchema = Joi.string()
  .min(PASSWORD.MIN_LENGTH)
  .max(PASSWORD.MAX_LENGTH)
  .pattern(/[A-Z]/, 'uppercase')
  .pattern(/[a-z]/, 'lowercase')
  .pattern(/\d/, 'number')
  .pattern(/[!@#$%^&*()_.+\-=[\]]/, 'special')
  .required()
  .messages({
    'string.pattern.name': 'validation.password.strength.{#name}',
    'string.min': 'validation.password.min_length',
    'string.max': 'validation.password.max_length'
  })

export function validateEmail(email) {
  const { error, value } = emailSchema.validate(email)

  if (error) {
    if (
      error.details[0]?.type === 'any.required' ||
      error.details[0]?.type === 'string.empty'
    ) {
      return { valid: false, error: 'validation.email.required' }
    }
    return { valid: false, error: 'validation.email.invalid_format' }
  }

  return { valid: true, value }
}

export function validatePassword(password, enforceStrength = false) {
  const schema = enforceStrength ? strongPasswordSchema : basicPasswordSchema
  const { error, value } = schema.validate(password)

  if (error) {
    const errorType = error.details[0]?.type
    const errorContext = error.details[0]?.context

    if (errorType === 'any.required' || errorType === 'string.empty') {
      return { valid: false, error: 'validation.password.required' }
    }

    if (errorType === 'string.min') {
      return {
        valid: false,
        error: 'validation.password.min_length',
        details: { minLength: PASSWORD.MIN_LENGTH }
      }
    }

    if (errorType === 'string.max') {
      return {
        valid: false,
        error: 'validation.password.max_length',
        details: { maxLength: PASSWORD.MAX_LENGTH }
      }
    }

    if (errorType === 'string.pattern.name') {
      return {
        valid: false,
        error: 'validation.password.strength',
        details: { missing: errorContext?.name }
      }
    }

    return { valid: false, error: 'validation.password.invalid' }
  }

  return { valid: true, value }
}
