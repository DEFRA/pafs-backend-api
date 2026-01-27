import { PROJECT_FIELDS_MAP } from './project-fields.js'

export class ProjectMapper {
  static FIELD_MAP = PROJECT_FIELDS_MAP

  /**
   * Maps API data to database format
   * @param {Object} apiData - The API data object
   * @returns {Object} - Mapped data with database format
   */
  static toDatabase(apiData) {
    const dbData = {}

    Object.keys(apiData).forEach((key) => {
      const dbColumn = this.FIELD_MAP[key]
      if (apiData[key] === undefined || !dbColumn) {
        return
      }
      dbData[dbColumn] = this.transformValue(key, apiData[key])
    })

    return dbData
  }

  /**
   * Maps database data to API format
   * @param {Object} dbData - The database data object
   * @returns {Object} - Mapped data with API format
   */
  static toApi(dbData) {
    const apiData = {}
    const reverseMap = Object.fromEntries(
      Object.entries(this.FIELD_MAP).map(([key, value]) => [value, key])
    )

    Object.keys(dbData).forEach((key) => {
      const apiField = reverseMap[key]
      if (apiField) {
        apiData[apiField] = this.reverseTransformValue(apiField, dbData[key])
      }
    })

    return apiData
  }

  /**
   * Transforms a value for a specific field
   * @param {string} field - The field name
   * @param {any} value - The value to transform
   * @returns {any} - The transformed value
   */
  static transformValue(field, value) {
    if (field === 'projectInterventionTypes' && Array.isArray(value)) {
      return value.join(',')
    }
    if (field === 'financialStartYear' || field === 'financialEndYear') {
      return parseInt(value)
    }
    return value
  }

  /**
   * Reverses the transformation of a value for a specific field
   * @param {string} field - The field name
   * @param {any} value - The value to reverse transform
   * @returns {any} - The reversed transformed value
   */
  static reverseTransformValue(field, value) {
    if (field === 'projectInterventionTypes' && typeof value === 'string') {
      return value ? value.split(',') : []
    }
    return value
  }
}
