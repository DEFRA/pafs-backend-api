import { AREA_TYPE_MAP } from '../../../common/constants/common.js'

export class AreaService {
  // Common field selections for area queries
  static AREA_FIELDS = {
    id: true,
    name: true,
    parent_id: true,
    area_type: true,
    sub_type: true,
    identifier: true,
    end_date: true
  }

  static AREA_FIELDS_WITH_TIMESTAMPS = {
    ...AreaService.AREA_FIELDS,
    created_at: true,
    updated_at: true
  }

  constructor(prisma, logger) {
    this.prisma = prisma
    this.logger = logger
  }

  async getAllAreasGroupedByType() {
    this.logger.info('Fetching all areas from pafs_core_areas table')

    const areas = await this.prisma.pafs_core_areas.findMany({
      select: {
        id: true,
        name: true,
        area_type: true,
        parent_id: true,
        sub_type: true,
        identifier: true,
        end_date: true
      },
      orderBy: {
        name: 'asc'
      }
    })

    // Convert BigInt values to strings for JSON serialization
    const serializedAreas = areas.map((area) => ({
      ...area,
      id: area.id.toString(),
      parent_id: area.parent_id ? area.parent_id.toString() : null
    }))

    // Group areas by area_type
    const groupedAreas = serializedAreas.reduce((acc, area) => {
      const areaType = area.area_type || 'unknown'
      if (!acc[areaType]) {
        acc[areaType] = []
      }
      acc[areaType].push(area)
      return acc
    }, {})

    this.logger.info(
      { types: Object.keys(groupedAreas) },
      'Areas grouped by type'
    )

    return groupedAreas
  }

  async getAreaDetailsByIds(areaIds) {
    if (!areaIds || areaIds.length === 0) {
      return []
    }

    this.logger.info(
      { areaCount: areaIds.length },
      'Fetching area details by IDs'
    )

    const areas = await this.prisma.pafs_core_areas.findMany({
      where: {
        id: {
          in: areaIds.map(BigInt)
        }
      },
      select: {
        id: true,
        name: true,
        area_type: true
      }
    })

    return areas.map((area) => ({
      id: Number(area.id),
      name: area.name,
      areaType: area.area_type
    }))
  }

  /**
   * Get RFCC code from area identifier
   * RFCC codes are stored in PSO's sub_type field
   * - For PSO areas: Use sub_type directly
   * - For RMA areas: Find parent PSO, then use parent's sub_type
   * @param {string} areaIdentifier - The area identifier/code
   * @returns {Promise<string|null>} RFCC code or null
   */
  async getRfccCodeFromAreaIdentifier(areaIdentifier) {
    if (!areaIdentifier) {
      return null
    }

    this.logger.info(
      { areaIdentifier },
      'Fetching RFCC code from area identifier'
    )

    // Find area by identifier
    const area = await this.prisma.pafs_core_areas.findFirst({
      where: {
        id: areaIdentifier
      },
      select: {
        id: true,
        identifier: true,
        area_type: true,
        sub_type: true,
        parent_id: true
      }
    })

    if (!area) {
      this.logger.warn({ areaIdentifier }, 'Area not found for identifier')
      return null
    }

    // If PSO area, return sub_type directly (contains RFCC code)
    if (area.area_type === 'PSO Area' || area.area_type === 'PSO') {
      return area.sub_type || null
    }

    // If RMA area, find parent PSO and return its sub_type
    if (area.area_type === 'RMA' && area.parent_id) {
      const parentArea = await this.prisma.pafs_core_areas.findFirst({
        where: {
          id: area.parent_id
        },
        select: {
          area_type: true,
          sub_type: true
        }
      })

      if (
        parentArea &&
        (parentArea.area_type === 'PSO Area' || parentArea.area_type === 'PSO')
      ) {
        return parentArea.sub_type || null
      }
    }

    this.logger.warn(
      { areaIdentifier, areaType: area.area_type },
      'Could not determine RFCC code for area'
    )
    return null
  }

  /**
   * Get area by ID with its parent and grandparent relationships
   * Performs a single optimized query to fetch the area and all its parent hierarchy
   * @param {string|number|BigInt} areaId - The area ID
   * @returns {Promise<Object|null>} Area with EA and PSO parent relationships
   */
  async getAreaByIdWithParents(areaId) {
    if (!areaId) {
      return null
    }

    this.logger.info({ areaId }, 'Fetching area by ID with parent hierarchy')

    // Convert to BigInt for query
    const id = typeof areaId === 'bigint' ? areaId : BigInt(areaId)

    // Fetch the area
    const area = await this.prisma.pafs_core_areas.findUnique({
      where: { id },
      select: AreaService.AREA_FIELDS_WITH_TIMESTAMPS
    })

    if (!area) {
      this.logger.warn({ areaId }, 'Area not found')
      return null
    }

    // Build response object with serialized area data
    const response = {
      ...this.#serializeArea(area, true),
      PSO: null,
      EA: null
    }

    // If area has a parent, fetch parent chain
    if (area.parent_id) {
      const parents = await this.#fetchParentChain(area.parent_id)

      // Organize parents by type
      for (const parent of parents) {
        const parentData = this.#serializeArea(parent)

        if (this.#isAreaType(parent.area_type, AREA_TYPE_MAP.PSO)) {
          response.PSO = parentData
        }

        if (this.#isAreaType(parent.area_type, AREA_TYPE_MAP.EA)) {
          response.EA = parentData
        }
      }
    }

    this.logger.info(
      { areaId, hasEA: !!response.EA, hasPSO: !!response.PSO },
      'Area fetched with parent hierarchy'
    )

    return response
  }

  /**
   * Private helper to fetch parent chain efficiently
   * Uses a recursive CTE-like approach with multiple queries to build the parent chain
   * @param {number} parentId - The parent ID to start from
   * @returns {Promise<Array>} Array of parent areas
   * @private
   */
  async #fetchParentChain(parentId) {
    const parents = []
    let currentParentId = parentId

    // Fetch up to 3 levels (should cover RMA -> PSO -> EA hierarchy)
    // This prevents infinite loops and is more than sufficient for the area hierarchy
    for (let i = 0; i < 3 && currentParentId; i++) {
      const parent = await this.prisma.pafs_core_areas.findUnique({
        where: { id: BigInt(currentParentId) },
        select: AreaService.AREA_FIELDS
      })

      if (!parent) {
        break
      }

      parents.push(parent)
      currentParentId = parent.parent_id
    }

    return parents
  }

  /**
   * Serialize area data for API response
   * Converts BigInt to string and structures the data
   * @param {Object} area - Raw area object from database
   * @param {boolean} includeTimestamps - Whether to include created_at and updated_at
   * @returns {Object} Serialized area object
   * @private
   */
  #serializeArea(area, includeTimestamps = false) {
    const serialized = {
      id: area.id.toString(),
      name: area.name,
      parent_id: area.parent_id ? area.parent_id.toString() : null,
      area_type: area.area_type,
      sub_type: area.sub_type,
      identifier: area.identifier,
      end_date: area.end_date
    }

    if (includeTimestamps && area.created_at && area.updated_at) {
      serialized.created_at = area.created_at
      serialized.updated_at = area.updated_at
    }

    return serialized
  }

  /**
   * Check if an area type matches the expected type (case-insensitive)
   * @param {string} areaType - The area type to check
   * @param {string} expectedType - The expected type from AREA_TYPE_MAP
   * @returns {boolean} True if types match
   * @private
   */
  #isAreaType(areaType, expectedType) {
    return areaType?.toUpperCase() === expectedType?.toUpperCase()
  }
}
