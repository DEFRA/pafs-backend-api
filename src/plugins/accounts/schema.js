import Joi from 'joi'
import {
  searchSchema,
  areaIdSchema,
  pageSchema,
  pageSizeSchema,
  accountStatusSchema,
  emailSchema,
  userIdSchema,
  firstNameSchema,
  lastNameSchema,
  jobTitleSchema,
  organisationSchema,
  telephoneNumberSchema,
  responsibilitySchema,
  adminFlagSchema
} from '../../common/schemas/index.js'
import { ACCOUNT_VALIDATION_CODES } from '../../common/constants/accounts.js'
import { VALIDATION_ERROR_CODES } from '../../common/constants/common.js'

/**
 * Query schema for listing accounts
 * Combines status filter with common filter and pagination schemas
 */
export const getAccountsQuerySchema = Joi.object({
  status: accountStatusSchema,
  search: searchSchema,
  areaId: areaIdSchema,
  page: pageSchema,
  pageSize: pageSizeSchema()
})

/**
 * Base account data schema - fields common to both insert and update
 * Uses camelCase field names for API
 */
const baseAccountDataSchema = {
  id: userIdSchema.optional(),
  firstName: firstNameSchema,
  lastName: lastNameSchema,
  email: emailSchema,
  responsibility: responsibilitySchema,
  isAdminContext: Joi.boolean().default(false).label('Admin Context'),
  admin: adminFlagSchema
}

/**
 * Area schema - for user area assignments
 * Uses camelCase field names for API
 */
const areaItemSchema = Joi.object({
  areaId: Joi.number()
    .integer()
    .positive()
    .required()
    .label('Area ID')
    .messages({
      'number.base': ACCOUNT_VALIDATION_CODES.AREA_ID_INVALID,
      'number.positive': ACCOUNT_VALIDATION_CODES.AREA_ID_INVALID,
      'any.required': ACCOUNT_VALIDATION_CODES.AREA_ID_REQUIRED
    }),
  primary: Joi.boolean().default(false).label('Primary Area').messages({
    'boolean.base': ACCOUNT_VALIDATION_CODES.PRIMARY_FLAG_INVALID
  })
})

/**
 * Conditional fields - required when admin=false, optional when admin=true
 * Uses camelCase field names for API
 */
const conditionalAccountFields = {
  jobTitle: Joi.when('isAdminContext', {
    is: true,
    then: jobTitleSchema.optional(),
    otherwise: Joi.when('admin', {
      is: false,
      then: jobTitleSchema.required().disallow('', null).messages({
        'any.required': ACCOUNT_VALIDATION_CODES.JOB_TITLE_REQUIRED,
        'string.empty': ACCOUNT_VALIDATION_CODES.JOB_TITLE_REQUIRED,
        'any.invalid': ACCOUNT_VALIDATION_CODES.JOB_TITLE_REQUIRED
      }),
      otherwise: jobTitleSchema.optional()
    })
  }),
  organisation: Joi.when('isAdminContext', {
    is: true,
    then: organisationSchema.optional(),
    otherwise: Joi.when('admin', {
      is: false,
      then: organisationSchema.required().disallow('', null).messages({
        'any.required': ACCOUNT_VALIDATION_CODES.ORGANISATION_REQUIRED,
        'string.empty': ACCOUNT_VALIDATION_CODES.ORGANISATION_REQUIRED,
        'any.invalid': ACCOUNT_VALIDATION_CODES.ORGANISATION_REQUIRED
      }),
      otherwise: organisationSchema.optional()
    })
  }),
  telephoneNumber: Joi.when('isAdminContext', {
    is: true,
    then: telephoneNumberSchema.optional(),
    otherwise: Joi.when('admin', {
      is: false,
      then: telephoneNumberSchema.required().disallow('', null).messages({
        'any.required': ACCOUNT_VALIDATION_CODES.TELEPHONE_REQUIRED,
        'string.empty': ACCOUNT_VALIDATION_CODES.TELEPHONE_REQUIRED,
        'any.invalid': ACCOUNT_VALIDATION_CODES.TELEPHONE_REQUIRED
      }),
      otherwise: telephoneNumberSchema.optional()
    })
  }),
  areas: Joi.when('admin', {
    is: false,
    then: Joi.array()
      .items(areaItemSchema)
      .min(1)
      .required()
      .label('Areas')
      .messages({
        'any.required': ACCOUNT_VALIDATION_CODES.AREAS_REQUIRED,
        'array.min': ACCOUNT_VALIDATION_CODES.AREAS_REQUIRED
      }),
    otherwise: Joi.array().items(areaItemSchema).optional().label('Areas')
  })
}

/**
 * Account upsert schema - handles both create (POST) and update (PATCH)
 * If ID is present, performs update; otherwise, creates new account
 * Uses camelCase field names for API
 */
export const upsertAccountSchema = Joi.object({
  ...baseAccountDataSchema,
  ...conditionalAccountFields
})
  .options({ abortEarly: false })
  .label('Account')
  .messages({
    'object.base': VALIDATION_ERROR_CODES.VALIDATION_INVALID_OBJECT
  })
