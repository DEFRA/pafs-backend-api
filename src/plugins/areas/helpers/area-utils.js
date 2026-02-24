import { AREA_TYPE_MAP } from '../../../common/constants/common.js'

/**
 * Common field selections for area queries (no timestamps)
 */
export const AREA_FIELDS = {
  id: true,
  name: true,
  parent_id: true,
  area_type: true,
  sub_type: true,
  identifier: true,
  end_date: true
}

/**
 * Area fields including created_at and updated_at
 */
export const AREA_FIELDS_WITH_TIMESTAMPS = {
  ...AREA_FIELDS,
  created_at: true,
  updated_at: true
}

/**
 * Prisma case-insensitive mode string
 */
export const INSENSITIVE_MODE = 'insensitive'

/**
 * Check if an area type matches the expected type (case-insensitive)
 * @param {string} areaType - The area type to check
 * @param {string} expectedType - The expected type from AREA_TYPE_MAP
 * @returns {boolean} True if types match
 */
export function isAreaType(areaType, expectedType) {
  return areaType?.toUpperCase() === expectedType?.toUpperCase()
}

/**
 * Check if area type represents PSO, including legacy label 'PSO Area'
 * @param {string} areaType
 * @returns {boolean}
 */
export function isPsoArea(areaType) {
  const normalized = areaType?.toUpperCase()
  return normalized === 'PSO' || normalized === AREA_TYPE_MAP.PSO?.toUpperCase()
}

/**
 * Serialize area object, converting BigInt IDs to strings.
 * Auto-detects timestamps in the area object and converts to ISO strings
 * unless rawTimestamps is true.
 *
 * @param {Object} area - Area object from database
 * @param {Object} [options] - Serialization options
 * @param {boolean} [options.rawTimestamps=false] - Keep timestamps as Date objects
 * @returns {Object} Serialized area object
 */
export function serializeArea(area, { rawTimestamps = false } = {}) {
  const serialized = {
    id: area.id.toString(),
    name: area.name,
    parent_id: area.parent_id ? area.parent_id.toString() : null,
    area_type: area.area_type,
    sub_type: area.sub_type,
    identifier: area.identifier,
    end_date: area.end_date
  }

  if (rawTimestamps) {
    serialized.created_at = area.created_at
    serialized.updated_at = area.updated_at
  } else {
    if (area.created_at) {
      serialized.created_at = area.created_at.toISOString()
    }
    if (area.updated_at) {
      serialized.updated_at = area.updated_at.toISOString()
    }
  }

  return serialized
}

/**
 * Build where clause for areas list filtering.
 * Excludes EA Area type from results.
 * @param {string} search - Search term
 * @param {string} type - Area type filter
 * @returns {Object} Prisma where clause
 */
export function buildAreasListWhereClause(search, type) {
  const where = {
    area_type: {
      not: AREA_TYPE_MAP.EA
    }
  }

  if (search?.trim()) {
    where.name = {
      contains: search.trim(),
      mode: INSENSITIVE_MODE
    }
  }

  if (type?.trim()) {
    where.AND = [
      {
        area_type: {
          equals: type.trim(),
          mode: INSENSITIVE_MODE
        }
      }
    ]
  }

  return where
}

/**
 * Prepare area data for database upsert
 * @param {Object} areaData - Area data from request
 * @returns {Object} Prepared data for database
 */
export function prepareAreaData(areaData) {
  return {
    name: areaData.name,
    area_type: areaData.areaType,
    parent_id: areaData.parentId
      ? Number.parseInt(areaData.parentId, 10)
      : null,
    sub_type: areaData.subType || null,
    identifier: areaData.identifier || null,
    end_date: areaData.endDate ? new Date(areaData.endDate) : null,
    updated_at: new Date()
  }
}
