import { config } from '../../config.js'

/**
 * Builds pagination metadata for API responses
 * @param {number} page - Current page number (1-indexed)
 * @param {number} pageSize - Records per page
 * @param {number} total - Total number of records
 * @returns {Object} Pagination metadata
 */
export function buildPaginationMeta(page, pageSize, total) {
  const totalPages = Math.ceil(total / pageSize) || 1
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)

  return {
    page,
    pageSize,
    total,
    totalPages,
    start,
    end,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1
  }
}

/**
 * Normalizes and validates pagination parameters
 * @param {number|string} page - Requested page
 * @param {number|string} pageSize - Requested page size
 * @returns {Object} Validated pagination parameters
 */
export function normalizePaginationParams(page, pageSize) {
  const defaultSize = config.get('pagination.defaultPageSize')
  const maxSize = config.get('pagination.maxPageSize')

  let normalizedPage = Number.parseInt(page, 10)
  let normalizedSize = Number.parseInt(pageSize, 10)

  if (Number.isNaN(normalizedPage) || normalizedPage < 1) {
    normalizedPage = 1
  }

  if (Number.isNaN(normalizedSize) || normalizedSize < 1) {
    normalizedSize = defaultSize
  }

  if (normalizedSize > maxSize) {
    normalizedSize = maxSize
  }

  return {
    page: normalizedPage,
    pageSize: normalizedSize,
    skip: (normalizedPage - 1) * normalizedSize,
    take: normalizedSize
  }
}
