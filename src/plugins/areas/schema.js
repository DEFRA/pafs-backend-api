import Joi from 'joi'
import {
  searchSchema,
  pageSchema,
  pageSizeSchema
} from '../../common/schemas/index.js'
import {
  areaIdSchema,
  areaNameSchema,
  areaTypeSchema,
  endDateSchema,
  identifierSchema,
  parentIdSchema,
  subTypeSchema
} from '../../common/schemas/area.js'
import { SIZE } from '../../common/constants/common.js'

/**
 * Query schema for listing areas with filters
 */
export const getAreasListQuerySchema = Joi.object({
  search: searchSchema,
  type: Joi.string()
    .trim()
    .max(SIZE.LENGTH_50)
    .allow('')
    .optional()
    .label('Area Type'),
  page: pageSchema,
  pageSize: pageSizeSchema()
})

/**
 * Params schema for getting area by ID
 */
export const getAreaByIdSchema = Joi.object({
  id: areaIdSchema
})

/**
 * Payload schema for upserting area (create or update)
 * Handles three area types: Authority, PSO Area, and RMA
 * Each type has specific required fields and validation rules
 */
export const upsertAreaSchema = Joi.object({
  id: areaIdSchema.optional(),
  areaType: areaTypeSchema,
  name: areaNameSchema,
  // Authority Code (for Authority) or Identifier Code (for RMA)
  identifier: identifierSchema,
  // EA Area (for PSO) or PSO (for RMA)
  parentId: parentIdSchema,
  // RFCC Code (for PSO) or Authority Code (for RMA)
  subType: subTypeSchema,
  // End Date - optional for all types, stored as YYYY-MM-DD
  endDate: endDateSchema
})
