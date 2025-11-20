import Joi from 'joi'
import { EMAIL } from '../../constants'

const emailSchema = Joi.string()
  .email({ tlds: { allow: false } })
  .max(EMAIL.MAX_LENGTH)
  .trim()
  .lowercase()
  .required()

const passwordSchema = Joi.string().required()

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

export function validatePassword(password) {
  const { error, value } = passwordSchema.validate(password)

  if (error) {
    const errorType = error.details[0]?.type

    if (errorType === 'any.required' || errorType === 'string.empty') {
      return { valid: false, error: 'validation.password.required' }
    }

    return { valid: false, error: 'validation.password.invalid' }
  }

  return { valid: true, value }
}
