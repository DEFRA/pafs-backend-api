import Joi from 'joi'
import { SIZE } from '../../common/constants/common.js'

const areaSchema = Joi.object({
  area_id: Joi.number().integer().positive().required(),
  primary: Joi.boolean().default(false)
})

const userSchema = Joi.object({
  firstName: Joi.string()
    .max(SIZE.LENGTH_255)
    .trim()
    .required()
    .label('First Name'),
  lastName: Joi.string()
    .max(SIZE.LENGTH_255)
    .trim()
    .required()
    .label('Last Name'),
  emailAddress: Joi.string()
    .email({ tlds: { allow: false } })
    .max(SIZE.LENGTH_254)
    .trim()
    .lowercase()
    .required()
    .label('Email Address'),
  telephoneNumber: Joi.string()
    .max(SIZE.LENGTH_255)
    .trim()
    .pattern(/^[\d\s\-+()]+$/)
    .allow(null, '')
    .optional()
    .messages({
      'string.pattern.base':
        'Telephone number must contain only digits, spaces, dashes, plus signs, and parentheses'
    })
    .label('Telephone Number'),
  organisation: Joi.string()
    .max(SIZE.LENGTH_255)
    .trim()
    .allow('')
    .optional()
    .label('Organisation'),
  jobTitle: Joi.string()
    .max(SIZE.LENGTH_255)
    .trim()
    .allow(null, '')
    .optional()
    .label('Job Title'),
  responsibility: Joi.string()
    .valid('EA', 'RMA')
    .optional()
    .label('Responsibility')
})

export const accountRequestSchema = Joi.object({
  user: userSchema.required(),
  areas: Joi.array().items(areaSchema).min(1).required().label('Areas')
})
  .options({
    abortEarly: false
  })
  .label('Account Request')
