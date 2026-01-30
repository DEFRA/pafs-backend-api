import { BadRequestError } from '../../../common/errors/http-errors.js'
import {
  ACCOUNT_ERROR_CODES,
  ACCOUNT_RESPONSIBILITY
} from '../../../common/constants/accounts.js'

export class AccountAreaValidator {
  constructor(areaService, logger) {
    this.areaService = areaService
    this.logger = logger
  }

  /**
   * Validate area responsibility types match user responsibility
   * @param {Array} areas - User areas
   * @param {string} userResponsibility - User responsibility type
   */
  async validateAreaResponsibilityTypes(areas, userResponsibility) {
    this.logger.info(
      { areaCount: areas.length, userResponsibility },
      'Validating area responsibility types'
    )

    const areaIds = areas.map((a) => a.areaId)
    const areaDetails = await this.areaService.getAreaDetailsByIds(areaIds)

    this._ensureAllAreasExist(areaIds, areaDetails)

    const expectedAreaType =
      this._mapResponsibilityToAreaType(userResponsibility)
    this._ensureAreasMatchResponsibility(
      areaDetails,
      expectedAreaType,
      userResponsibility
    )

    this.logger.info(
      { areaCount: areaDetails.length, areaType: expectedAreaType },
      'Area responsibility validation passed'
    )
  }

  /**
   * Ensure all requested area IDs exist
   * @param {Array} areaIds - Requested area IDs
   * @param {Array} areaDetails - Found area details
   * @throws {BadRequestError} If some areas don't exist
   * @private
   */
  _ensureAllAreasExist(areaIds, areaDetails) {
    if (areaDetails.length === areaIds.length) {
      return
    }

    const foundAreaIds = new Set(areaDetails.map((a) => String(a.id)))
    const missingAreaIds = areaIds.filter((id) => !foundAreaIds.has(String(id)))

    this.logger.warn(
      {
        requestedCount: areaIds.length,
        foundCount: areaDetails.length,
        missingAreaIds
      },
      'Some area IDs do not exist'
    )

    throw new BadRequestError(
      `The following area IDs do not exist: ${missingAreaIds.join(', ')}`,
      ACCOUNT_ERROR_CODES.INVALID_AREA_IDS,
      'areas'
    )
  }

  /**
   * Map user responsibility to expected area type
   * @param {string} userResponsibility - User responsibility
   * @returns {string} Expected area type
   * @private
   */
  _mapResponsibilityToAreaType(userResponsibility) {
    const responsibilityToAreaTypeMap = {
      EA: 'EA Area',
      PSO: 'PSO Area',
      RMA: 'RMA'
    }

    return responsibilityToAreaTypeMap[userResponsibility]
  }

  /**
   * Ensure areas match user responsibility
   * @param {Array} areaDetails - Area details
   * @param {string} expectedAreaType - Expected area type
   * @param {string} userResponsibility - User responsibility
   * @throws {BadRequestError} If areas don't match responsibility
   * @private
   */
  _ensureAreasMatchResponsibility(
    areaDetails,
    expectedAreaType,
    userResponsibility
  ) {
    if (!expectedAreaType) {
      return
    }

    const invalidAreas = areaDetails.filter(
      (area) => area.areaType !== expectedAreaType
    )

    if (invalidAreas.length === 0) {
      return
    }

    const invalidAreaNames = invalidAreas
      .map((a) => `${a.name} (${a.areaType})`)
      .join(', ')

    this.logger.warn(
      {
        userResponsibility,
        expectedAreaType,
        invalidAreas: invalidAreaNames
      },
      'Area responsibility type mismatch'
    )

    throw new BadRequestError(
      `All areas must be of type '${expectedAreaType}' for ${ACCOUNT_RESPONSIBILITY[userResponsibility]} users. Invalid areas: ${invalidAreaNames}`,
      ACCOUNT_ERROR_CODES.AREA_RESPONSIBILITY_MISMATCH,
      'areas'
    )
  }
}
