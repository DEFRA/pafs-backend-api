import Joi from 'joi'
import {
  searchSchema,
  areaIdSchema,
  pageSchema,
  pageSizeSchema,
  accountStatusSchema
} from '../../common/schemas/index.js'

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
