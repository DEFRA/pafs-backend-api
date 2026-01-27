import Joi from 'joi'
import { AREA_VALIDATION_CODES } from '../constants/area.js'
import { AREA_TYPE_MAP, SIZE } from '../constants/common.js'

export const areaIdSchema = Joi.string().required().label('Area ID').messages({
  'any.required': AREA_VALIDATION_CODES.ID_REQUIRED,
  'string.empty': AREA_VALIDATION_CODES.ID_REQUIRED
})

export const areaTypeSchema = Joi.string()
  .trim()
  .valid(AREA_TYPE_MAP.AUTHORITY, AREA_TYPE_MAP.PSO, AREA_TYPE_MAP.RMA)
  .required()
  .label('Area Type')
  .messages({
    'any.required': AREA_VALIDATION_CODES.TYPE_REQUIRED,
    'string.empty': AREA_VALIDATION_CODES.TYPE_REQUIRED,
    'any.only': AREA_VALIDATION_CODES.TYPE_INVALID
  })

export const areaNameSchema = Joi.string()
  .trim()
  .min(1)
  .max(SIZE.LENGTH_255)
  .required()
  .label('Name')
  .messages({
    'any.required': AREA_VALIDATION_CODES.NAME_REQUIRED,
    'string.empty': AREA_VALIDATION_CODES.NAME_REQUIRED,
    'string.min': AREA_VALIDATION_CODES.NAME_TOO_SHORT,
    'string.max': AREA_VALIDATION_CODES.NAME_TOO_LONG
  })

export const identifierSchema = Joi.string()
  .trim()
  .max(SIZE.LENGTH_100)
  .when('areaType', {
    is: Joi.string().valid(AREA_TYPE_MAP.AUTHORITY, AREA_TYPE_MAP.RMA),
    then: Joi.required(),
    otherwise: Joi.allow(null).optional()
  })
  .label('Identifier')
  .messages({
    'any.required': AREA_VALIDATION_CODES.IDENTIFIER_REQUIRED,
    'string.empty': AREA_VALIDATION_CODES.IDENTIFIER_REQUIRED
  })

export const parentIdSchema = Joi.string()
  .when('areaType', {
    is: AREA_TYPE_MAP.PSO,
    then: Joi.required(),
    otherwise: Joi.when('areaType', {
      is: AREA_TYPE_MAP.RMA,
      then: Joi.required(),
      otherwise: Joi.allow(null).optional()
    })
  })
  .label('Parent ID')
  .messages({
    'any.required': AREA_VALIDATION_CODES.PARENT_ID_REQUIRED,
    'string.empty': AREA_VALIDATION_CODES.PARENT_ID_REQUIRED
  })

export const subTypeSchema = Joi.string()
  .trim()
  .max(SIZE.LENGTH_50)
  .when('areaType', {
    is: AREA_TYPE_MAP.PSO,
    then: Joi.required(),
    otherwise: Joi.when('areaType', {
      is: AREA_TYPE_MAP.RMA,
      then: Joi.required(),
      otherwise: Joi.allow(null).optional()
    })
  })
  .label('Sub Type')
  .messages({
    'any.required': AREA_VALIDATION_CODES.SUBTYPE_REQUIRED,
    'string.empty': AREA_VALIDATION_CODES.SUBTYPE_REQUIRED
  })

export const endDateSchema = Joi.date()
  .iso()
  .allow(null)
  .optional()
  .label('End Date')
  .messages({
    'date.format': AREA_VALIDATION_CODES.DATE_INVALID
  })
