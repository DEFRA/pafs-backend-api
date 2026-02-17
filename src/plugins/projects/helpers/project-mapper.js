import {
  PROJECT_FIELDS_MAP,
  PROJECT_SELECT_FIELDS_MAP,
  PROJECT_JOIN_TABLES,
  CONVERSION_DIRECTIONS
} from './project-config.js'
import { convertArray, convertNumber } from './conversions.js'

export class ProjectMapper {
  /**
   * Maps API data to database format (for create/upsert operations)
   * Only uses PROJECT_FIELDS_MAP for fields that can be written
   *
   * @param {Object} apiData - The API data object
   * @returns {Object} - Mapped data with database column names
   */
  static toDatabase(apiData) {
    const dbData = {}

    for (const [apiField, dbColumn] of Object.entries(PROJECT_FIELDS_MAP)) {
      if (apiData[apiField] !== undefined) {
        dbData[dbColumn] = this.transformValue(apiField, apiData[apiField])
      }
    }

    return dbData
  }

  /**
   * Maps database data to API format (for read operations)
   * Handles both flat objects and nested Prisma results with joined tables
   *
   * @param {Object} dbData - Database data (flat or nested with joined tables)
   * @returns {Object} - Flat mapped data with API field names
   */
  static toApi(dbData) {
    const apiData = {}

    // Map main project fields
    this._mapFields(dbData, apiData, PROJECT_SELECT_FIELDS_MAP)

    // Map joined fields from manually fetched tables
    Object.entries(PROJECT_JOIN_TABLES).forEach(([tableName, config]) => {
      if (dbData[tableName]) {
        // Handle both object (from manual fetch) and array (from Prisma relations)
        const tableData = Array.isArray(dbData[tableName])
          ? dbData[tableName][0]
          : dbData[tableName]

        if (tableData) {
          this._mapFields(tableData, apiData, config.fields)
        }
      }
    })

    return apiData
  }

  /**
   * Maps fields from database to API format
   *
   * @param {Object} dbData - Source database data
   * @param {Object} apiData - Target API data object
   * @param {Object} fieldMap - Field mapping configuration
   * @private
   */
  static _mapFields(dbData, apiData, fieldMap) {
    for (const [apiField, dbColumn] of Object.entries(fieldMap)) {
      if (dbData[dbColumn] !== undefined) {
        apiData[apiField] = this.reverseTransformValue(
          apiField,
          dbData[dbColumn]
        )
      }
    }
  }

  /**
   * Transforms a value for database storage
   * Only applied to fields in PROJECT_FIELDS_MAP
   *
   * @param {string} field - The API field name
   * @param {any} value - The value to transform
   * @returns {any} - The transformed value
   */
  static transformValue(field, value) {
    if (field === 'projectInterventionTypes') {
      return convertArray(value, CONVERSION_DIRECTIONS.TO_DATABASE)
    }

    if (field === 'risks') {
      return this._transformRisksToDatabase(value)
    }

    if (field === 'financialStartYear' || field === 'financialEndYear') {
      return convertNumber(value, CONVERSION_DIRECTIONS.TO_DATABASE)
    }

    if (
      field === 'percentProperties20PercentDeprived' ||
      field === 'percentProperties40PercentDeprived'
    ) {
      return this._transformPercentageToDatabase(value)
    }

    return value
  }

  /**
   * Transforms risks array to database format
   * @private
   */
  static _transformRisksToDatabase(value) {
    return Array.isArray(value) ? value.join(',') : value
  }

  /**
   * Transforms percentage string to database format
   * @private
   */
  static _transformPercentageToDatabase(value) {
    if (value === '' || value === null || value === undefined) {
      return null
    }
    return typeof value === 'string' ? Number.parseFloat(value) : value
  }

  /**
   * Reverses the transformation when reading from database
   * Only applied to fields in PROJECT_FIELDS_MAP
   *
   * @param {string} field - The API field name
   * @param {any} value - The value to reverse transform
   * @returns {any} - The reversed transformed value
   */
  static reverseTransformValue(field, value) {
    if (field === 'projectInterventionTypes') {
      return convertArray(value, CONVERSION_DIRECTIONS.TO_API)
    }

    if (field === 'risks') {
      return this._transformRisksToApi(value)
    }

    if (
      field === 'financialStartYear' ||
      field === 'financialEndYear' ||
      field === 'id'
    ) {
      return convertNumber(value, CONVERSION_DIRECTIONS.TO_API)
    }

    if (
      field === 'percentProperties20PercentDeprived' ||
      field === 'percentProperties40PercentDeprived'
    ) {
      return this._transformPercentageToApi(value)
    }

    return value
  }

  /**
   * Transforms risks string to API format
   * @private
   */
  static _transformRisksToApi(value) {
    return value && typeof value === 'string'
      ? value.split(',').map((r) => r.trim())
      : value
  }

  /**
   * Transforms percentage float to API format
   * @private
   */
  static _transformPercentageToApi(value) {
    if (value === null || value === undefined) {
      return null
    }
    return typeof value === 'number' ? value.toString() : value
  }
}
