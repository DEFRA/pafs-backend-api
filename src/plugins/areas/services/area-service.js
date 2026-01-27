import { AREA_TYPE_MAP } from '../../../common/constants/common.js'
import {
  buildPaginationMeta,
  normalizePaginationParams
} from '../../../common/helpers/pagination.js'

export class AreaService {
  // Common field selections for area queries
  static MODE = 'insensitive'

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
   * Get areas list with filtering and pagination
   * @param {Object} params - Query parameters
   * @param {string} params.search - Search term for area name
   * @param {string} params.type - Filter by area type
   * @param {number} params.page - Page number (1-indexed)
   * @param {number} params.pageSize - Number of items per page
   * @returns {Promise<Object>} Paginated areas result
   */
  async getAreasList({ search = '', type = '', page, pageSize }) {
    const pagination = normalizePaginationParams(page, pageSize)

    this.logger.info(
      { search, type, page: pagination.page, pageSize: pagination.pageSize },
      'Fetching areas list with filters'
    )

    // Build where clause
    const where = this._buildAreasListWhereClause(search, type)

    // Execute queries in parallel
    const [areas, total] = await Promise.all([
      this.prisma.pafs_core_areas.findMany({
        where,
        select: AreaService.AREA_FIELDS,
        orderBy: { updated_at: 'desc' },
        skip: pagination.skip,
        take: pagination.take
      }),
      this.prisma.pafs_core_areas.count({ where })
    ])

    // Serialize areas
    const serializedAreas = areas.map((area) => this._serializeArea(area))

    return {
      areas: serializedAreas,
      pagination: buildPaginationMeta(
        pagination.page,
        pagination.pageSize,
        total
      )
    }
  }

  /**
   * Get single area by ID
   * @param {string} id - Area ID
   * @returns {Promise<Object|null>} Area object or null
   */
  async getAreaById(id) {
    if (!id) {
      return null
    }

    this.logger.info({ areaId: id }, 'Fetching area by ID')

    try {
      const area = await this._findAreaByIdWithConditions(id, {
        area_type: {
          notIn: [AREA_TYPE_MAP.COUNTRY, AREA_TYPE_MAP.EA]
        }
      })

      if (!area) {
        this.logger.warn({ areaId: id }, 'Area not found or type not allowed')
        return null
      }

      return this._serializeArea(area)
    } catch (error) {
      this.logger.error({ error, areaId: id }, 'Error fetching area by ID')
      return null
    }
  }

  /**
   * Create or update an area (Admin only)
   * Handles three area types with specific validation:
   * - Authority: requires identifier (Authority Code), name
   * - PSO Area: requires name, parent_id (EA Area), sub_type (RFCC Code)
   * - RMA: requires name, identifier (Identifier Code), parent_id (PSO), sub_type (Authority Code)
   *
   * @param {Object} areaData - Area data to upsert
   * @param {string} [areaData.id] - Area ID (for update)
   * @param {string} areaData.area_type - Area type (Authority, PSO Area, or RMA)
   * @param {string} areaData.name - Area name
   * @param {string} [areaData.identifier] - Authority Code (Authority) or Identifier Code (RMA)
   * @param {string} [areaData.parent_id] - EA Area ID (PSO) or PSO ID (RMA)
   * @param {string} [areaData.sub_type] - RFCC Code (PSO) or Authority Code (RMA)
   * @param {Date} [areaData.end_date] - End date (optional)
   * @returns {Promise<Object>} Created or updated area
   * @throws {Error} If validation fails or parent references are invalid
   */
  async upsertArea(areaData) {
    this.logger.info({ areaData }, 'Upserting area')

    await this._validateAreaReferences(areaData)
    const preparedData = this._prepareAreaData(areaData)

    try {
      const area = await this._performAreaUpsert(areaData.id, preparedData)
      this.logger.info(
        { areaId: area.id, isUpdate: !!areaData.id },
        `Area ${areaData.id ? 'updated' : 'created'} successfully`
      )
      return this._serializeArea(area)
    } catch (error) {
      this.logger.error({ error, areaData }, 'Error upserting area')
      throw error
    }
  }

  /**
   * Prepare area data for database upsert
   * @param {Object} areaData - Area data from request
   * @returns {Object} Prepared data for database
   * @private
   */
  _prepareAreaData(areaData) {
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

  /**
   * Perform the actual upsert operation
   * @param {string} areaId - Area ID (if updating)
   * @param {Object} data - Prepared area data
   * @returns {Promise<Object>} Upserted area
   * @private
   */
  async _performAreaUpsert(areaId, data) {
    if (areaId) {
      return this.prisma.pafs_core_areas.upsert({
        where: { id: BigInt(areaId) },
        update: data,
        create: {
          ...data,
          created_at: new Date()
        },
        select: AreaService.AREA_FIELDS_WITH_TIMESTAMPS
      })
    }

    return this.prisma.pafs_core_areas.create({
      data: {
        ...data,
        created_at: new Date()
      },
      select: AreaService.AREA_FIELDS_WITH_TIMESTAMPS
    })
  }

  /**
   * Validate PSO Area parent reference (must be EA Area)
   * @param {string} parentId - Parent area ID
   * @throws {Error} If parent is not EA Area
   * @private
   */
  async _validatePsoParent(parentId) {
    const parent = await this._findAreaByIdWithConditions(
      parentId,
      {},
      { id: true, area_type: true }
    )

    if (!parent) {
      throw new Error(`Parent area with ID ${parentId} not found for PSO Area`)
    }

    if (parent.area_type !== AREA_TYPE_MAP.EA) {
      throw new Error(
        `Parent area must be of type 'EA Area' for PSO Area, but found '${parent.area_type}'`
      )
    }
  }

  /**
   * Validate RMA parent reference (must be PSO Area)
   * @param {string} parentId - Parent area ID
   * @throws {Error} If parent is not PSO Area
   * @private
   */
  async _validateRmaParent(parentId) {
    const parent = await this._findAreaByIdWithConditions(
      parentId,
      {},
      { id: true, area_type: true }
    )

    if (!parent) {
      throw new Error(`Parent area with ID ${parentId} not found for RMA`)
    }

    if (parent.area_type !== AREA_TYPE_MAP.PSO) {
      throw new Error(
        `Parent area must be of type 'PSO Area' for RMA, but found '${parent.area_type}'`
      )
    }
  }

  /**
   * Validate RMA Authority Code exists
   * @param {string} subType - Authority Code
   * @throws {Error} If Authority Code doesn't exist
   * @private
   */
  async _validateRmaAuthorityCode(subType) {
    const authority = await this.prisma.pafs_core_areas.findFirst({
      where: {
        area_type: AREA_TYPE_MAP.AUTHORITY,
        identifier: subType
      },
      select: { id: true, identifier: true }
    })

    if (!authority) {
      throw new Error(
        `Authority with code '${subType}' not found. Please ensure the Authority exists before creating RMA.`
      )
    }
  }

  /**
   * Validate area references based on area type
   * - PSO Area: parentId must reference an EA Area
   * - RMA: parentId must reference a PSO Area
   * - RMA: subType (Authority Code) must exist in an Authority area's identifier
   *
   * @param {Object} areaData - Area data to validate
   * @throws {Error} If validation fails
   * @private
   */
  async _validateAreaReferences(areaData) {
    const { areaType, parentId, subType } = areaData

    // PSO Area: validate parent is EA Area
    if (areaType === AREA_TYPE_MAP.PSO && parentId) {
      await this._validatePsoParent(parentId)
    }

    // RMA: validate parent is PSO Area
    if (areaType === AREA_TYPE_MAP.RMA && parentId) {
      await this._validateRmaParent(parentId)
    }

    // RMA: validate Authority Code exists
    if (areaType === AREA_TYPE_MAP.RMA && subType) {
      await this._validateRmaAuthorityCode(subType)
    }
  }

  /**
   * Generic helper to find area by ID with optional additional conditions
   * @param {string|number|BigInt} id - Area ID
   * @param {Object} additionalWhere - Additional where conditions
   * @param {Object} select - Fields to select (defaults to AREA_FIELDS)
   * @returns {Promise<Object|null>} Area object or null
   * @private
   */
  async _findAreaByIdWithConditions(id, additionalWhere = {}, select = null) {
    const where = {
      id: typeof id === 'bigint' ? id : BigInt(id),
      ...additionalWhere
    }

    return this.prisma.pafs_core_areas.findFirst({
      where,
      select: select || AreaService.AREA_FIELDS
    })
  }

  /**
   * Build where clause for areas list filtering
   * Excludes EA Area type from results
   * @param {string} search - Search term
   * @param {string} type - Area type filter
   * @returns {Object} Prisma where clause
   * @private
   */
  _buildAreasListWhereClause(search, type) {
    const where = {
      // Exclude EA Area type from results
      area_type: {
        not: AREA_TYPE_MAP.EA
      }
    }

    // Add search filter
    if (search?.trim()) {
      where.name = {
        contains: search.trim(),
        mode: AreaService.MODE
      }
    }

    // Add type filter (in addition to EA exclusion)
    if (type?.trim()) {
      where.AND = [
        {
          area_type: {
            equals: type.trim(),
            mode: AreaService.MODE
          }
        }
      ]
    }

    return where
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
    if (area.area_type === AREA_TYPE_MAP.PSO) {
      return area.sub_type || null
    }

    // If RMA area, find parent PSO and return its sub_type
    if (area.area_type === AREA_TYPE_MAP.RMA && area.parent_id) {
      const parentArea = await this.prisma.pafs_core_areas.findFirst({
        where: {
          id: area.parent_id
        },
        select: {
          area_type: true,
          sub_type: true
        }
      })

      if (parentArea?.area_type === AREA_TYPE_MAP.PSO) {
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

    // Fetch the area
    const area = await this._findAreaByIdWithConditions(
      areaId,
      {},
      AreaService.AREA_FIELDS_WITH_TIMESTAMPS
    )

    if (!area) {
      this.logger.warn({ areaId }, 'Area not found')
      return null
    }

    // Build response object with serialized area data
    const response = {
      ...this._serializeAreaWithTimestamps(area),
      PSO: null,
      EA: null
    }

    // If area has a parent, fetch parent chain
    if (area.parent_id) {
      const parents = await this._fetchParentChain(area.parent_id)

      // Organize parents by type
      for (const parent of parents) {
        const parentData = this._serializeArea(parent)

        if (this._isAreaType(parent.area_type, AREA_TYPE_MAP.PSO)) {
          response.PSO = parentData
        }

        if (this._isAreaType(parent.area_type, AREA_TYPE_MAP.EA)) {
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
   * Uses a single query with recursive logic to build the parent chain
   * @param {number} parentId - The parent ID to start from
   * @returns {Promise<Array>} Array of parent areas
   * @private
   */
  async _fetchParentChain(parentId) {
    // Use raw SQL with recursive CTE for optimal performance
    const parents = await this.prisma.$queryRaw`
      WITH RECURSIVE parent_chain AS (
        -- Base case: get the immediate parent
        SELECT id, name, parent_id, area_type, sub_type, identifier, end_date, 1 as level
        FROM pafs_core_areas
        WHERE id = ${BigInt(parentId)}
        
        UNION ALL
        
        -- Recursive case: get parent of parent
        SELECT a.id, a.name, a.parent_id, a.area_type, a.sub_type, a.identifier, a.end_date, pc.level + 1
        FROM pafs_core_areas a
        INNER JOIN parent_chain pc ON a.id = pc.parent_id
        WHERE pc.level < 3  -- Limit to 3 levels (RMA -> PSO -> EA)
      )
      SELECT id, name, parent_id, area_type, sub_type, identifier, end_date
      FROM parent_chain
      ORDER BY level ASC
    `

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
  /**
   * Serialize area object, converting BigInt to string
   * Includes timestamps if available in the area object
   * @param {Object} area - Area object from database
   * @param {boolean} includeTimestamps - Force include timestamps (deprecated, auto-detected)
   * @returns {Object} Serialized area object
   * @private
   */
  _serializeArea(area, _includeTimestamps = false) {
    const serialized = {
      id: area.id.toString(),
      name: area.name,
      parent_id: area.parent_id ? area.parent_id.toString() : null,
      area_type: area.area_type,
      sub_type: area.sub_type,
      identifier: area.identifier,
      end_date: area.end_date
    }

    // Include timestamps if they exist in the area object
    if (area.created_at) {
      serialized.created_at = area.created_at.toISOString()
    }
    if (area.updated_at) {
      serialized.updated_at = area.updated_at.toISOString()
    }

    return serialized
  }

  /**
   * Serialize area with timestamps as Date objects (for getAreaByIdWithParents)
   * @param {Object} area - Area object from database
   * @returns {Object} Serialized area object with Date timestamps
   * @private
   */
  _serializeAreaWithTimestamps(area) {
    return {
      id: area.id.toString(),
      name: area.name,
      parent_id: area.parent_id ? area.parent_id.toString() : null,
      area_type: area.area_type,
      sub_type: area.sub_type,
      identifier: area.identifier,
      end_date: area.end_date,
      created_at: area.created_at,
      updated_at: area.updated_at
    }
  }

  /**
   * Check if an area type matches the expected type (case-insensitive)
   * @param {string} areaType - The area type to check
   * @param {string} expectedType - The expected type from AREA_TYPE_MAP
   * @returns {boolean} True if types match
   * @private
   */
  _isAreaType(areaType, expectedType) {
    return areaType?.toUpperCase() === expectedType?.toUpperCase()
  }
}
