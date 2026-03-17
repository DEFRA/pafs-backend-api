import { AREA_TYPE_MAP } from '../../../common/constants/common.js'
import { ConflictError } from '../../../common/errors/index.js'
import {
  buildPaginationMeta,
  normalizePaginationParams
} from '../../../common/helpers/pagination.js'
import {
  AREA_FIELDS,
  AREA_FIELDS_WITH_TIMESTAMPS,
  serializeArea,
  isAreaType,
  isPsoArea,
  buildAreasListWhereClause,
  prepareAreaData
} from '../helpers/area-utils.js'

export class AreaService {
  constructor(prisma, logger) {
    this.prisma = prisma
    this.logger = logger
  }

  async getAllAreasGroupedByType() {
    this.logger.info('Fetching all areas from pafs_core_areas table')

    const areas = await this.prisma.pafs_core_areas.findMany({
      select: AREA_FIELDS,
      orderBy: {
        name: 'asc'
      }
    })

    const serializedAreas = areas.map((area) => serializeArea(area))

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
    const where = buildAreasListWhereClause(search, type)

    // Execute queries in parallel
    const [areas, total] = await Promise.all([
      this.prisma.pafs_core_areas.findMany({
        where,
        select: AREA_FIELDS,
        orderBy: { updated_at: 'desc' },
        skip: pagination.skip,
        take: pagination.take
      }),
      this.prisma.pafs_core_areas.count({ where })
    ])

    // Serialize areas
    const serializedAreas = areas.map((area) => serializeArea(area))

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

      return serializeArea(area)
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
    const preparedData = prepareAreaData(areaData)

    try {
      const area = await this._performAreaUpsert(areaData.id, preparedData)
      this.logger.info(
        { areaId: area.id, isUpdate: !!areaData.id },
        `Area ${areaData.id ? 'updated' : 'created'} successfully`
      )
      return serializeArea(area)
    } catch (error) {
      this.logger.error({ error, areaData }, 'Error upserting area')
      throw error
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
        select: AREA_FIELDS_WITH_TIMESTAMPS
      })
    }

    return this.prisma.pafs_core_areas.create({
      data: {
        ...data,
        created_at: new Date()
      },
      select: AREA_FIELDS_WITH_TIMESTAMPS
    })
  }

  /**
   * Validate parent area reference matches expected type
   * @param {string} parentId - Parent area ID
   * @param {string} expectedType - Expected area_type from AREA_TYPE_MAP
   * @param {string} childTypeName - Name of the child type for error messages
   * @throws {Error} If parent not found or type mismatch
   * @private
   */
  async _validateParentType(parentId, expectedType, childTypeName) {
    const parent = await this._findAreaByIdWithConditions(
      parentId,
      {},
      { id: true, area_type: true }
    )

    if (!parent) {
      throw new Error(
        `Parent area with ID ${parentId} not found for ${childTypeName}`
      )
    }

    if (parent.area_type !== expectedType) {
      throw new Error(
        `Parent area must be of type '${expectedType}' for ${childTypeName}, but found '${parent.area_type}'`
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

    await this._validateUniqueNameWithinType(areaData)
    await this._validateUniqueIdentifierWithinType(areaData)

    if (areaType === AREA_TYPE_MAP.PSO && parentId) {
      await this._validateParentType(parentId, AREA_TYPE_MAP.EA, 'PSO Area')
    }

    if (areaType === AREA_TYPE_MAP.RMA && parentId) {
      await this._validateParentType(parentId, AREA_TYPE_MAP.PSO, 'RMA')
    }

    if (areaType === AREA_TYPE_MAP.RMA && subType) {
      await this._validateRmaAuthorityCode(subType)
    }
  }

  /**
   * Validate that the area name is unique across all organization records.
   * On create: no other area with the same name should exist.
   * On update: no other area (excluding the one being updated) with the same name should exist.
   * @param {Object} areaData - Area data containing name and optionally id
   * @throws {ConflictError} If a duplicate name exists
   * @private
   */
  async _validateUniqueNameWithinType(areaData) {
    const { id, name } = areaData
    const normalizedName = name.trim().split(/\s+/).join(' ')

    const where = {
      name: {
        equals: normalizedName,
        mode: 'insensitive'
      }
    }

    // When updating, exclude the current record
    if (id) {
      where.id = { not: BigInt(id) }
    }

    const existing = await this.prisma.pafs_core_areas.findFirst({
      where,
      select: { id: true }
    })

    if (existing) {
      throw new ConflictError(
        `An area with the name '${name}' already exists`,
        'DUPLICATE_AREA_NAME',
        'name'
      )
    }
  }

  /**
   * Validate that the area identifier is unique across Authority and RMA types.
   * Only applies to Authority and RMA types which have identifiers.
   * On create: no other Authority or RMA area with the same identifier should exist.
   * On update: no other Authority or RMA area (excluding the one being updated) with the same identifier should exist.
   * @param {Object} areaData - Area data containing identifier, areaType, and optionally id
   * @throws {ConflictError} If a duplicate identifier exists across Authority and RMA types
   * @private
   */
  async _validateUniqueIdentifierWithinType(areaData) {
    const { id, identifier, areaType } = areaData

    // Only Authority and RMA have identifiers
    if (
      !identifier ||
      (areaType !== AREA_TYPE_MAP.AUTHORITY && areaType !== AREA_TYPE_MAP.RMA)
    ) {
      return
    }

    const where = {
      identifier,
      area_type: {
        in: [AREA_TYPE_MAP.AUTHORITY, AREA_TYPE_MAP.RMA]
      }
    }

    // When updating, exclude the current record
    if (id) {
      where.id = { not: BigInt(id) }
    }

    const existing = await this.prisma.pafs_core_areas.findFirst({
      where,
      select: { id: true }
    })

    if (existing) {
      throw new ConflictError(
        `An area with the identifier '${identifier}' already exists`,
        'DUPLICATE_AREA_IDENTIFIER',
        'identifier'
      )
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
      select: select || AREA_FIELDS
    })
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

    if (isPsoArea(area.area_type)) {
      return area.sub_type || null
    }

    if (isAreaType(area.area_type, AREA_TYPE_MAP.RMA) && area.parent_id) {
      const parentArea = await this.prisma.pafs_core_areas.findFirst({
        where: { id: area.parent_id },
        select: { area_type: true, sub_type: true }
      })

      if (parentArea && isPsoArea(parentArea.area_type)) {
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
   * Fetches the area and iteratively walks up the parent hierarchy
   * @param {string|number|BigInt} areaId - The area ID
   * @returns {Promise<Object|null>} Area with EA and PSO parent relationships
   */
  async getAreaByIdWithParents(areaId) {
    if (!areaId) {
      return null
    }

    this.logger.info({ areaId }, 'Fetching area by ID with parent hierarchy')

    const area = await this._findAreaByIdWithConditions(
      areaId,
      {},
      AREA_FIELDS_WITH_TIMESTAMPS
    )

    if (!area) {
      this.logger.warn({ areaId }, 'Area not found')
      return null
    }

    const response = {
      ...serializeArea(area, { rawTimestamps: true }),
      PSO: null,
      EA: null
    }

    if (area.parent_id) {
      const parents = await this._fetchParentChain(area.parent_id)

      for (const parent of parents) {
        const parentData = serializeArea(parent)

        if (isAreaType(parent.area_type, AREA_TYPE_MAP.PSO)) {
          response.PSO = parentData
        }

        if (isAreaType(parent.area_type, AREA_TYPE_MAP.EA)) {
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
   * Fetch parent chain by iteratively walking up parent_id links.
   * Hierarchy is at most 3 levels deep (RMA → PSO → EA).
   * @param {number|BigInt} parentId - The parent ID to start from
   * @returns {Promise<Array>} Array of parent areas in ascending order
   * @private
   */
  async _fetchParentChain(parentId) {
    const parents = []
    let currentId = parentId
    const maxDepth = 3

    for (let i = 0; i < maxDepth && currentId; i++) {
      const parent = await this._findAreaByIdWithConditions(
        currentId,
        {},
        AREA_FIELDS
      )

      if (!parent) {
        break
      }

      parents.push(parent)
      currentId = parent.parent_id
    }

    return parents
  }

  /**
   * Get all descendant RMA area IDs for given parent area IDs.
   *
   * Area hierarchy: EA Area → PSO Area → RMA
   * - For PSO area IDs: returns RMA areas whose parent_id matches
   * - For EA area IDs: returns RMA areas whose grandparent (via PSO) matches
   *
   * @param {number[]} parentAreaIds - Array of parent area IDs (PSO or EA)
   * @param {string} parentType - Area type of the parents ('PSO Area' or 'EA Area')
   * @returns {Promise<number[]>} Array of descendant RMA area IDs
   */
  async getDescendantRmaAreaIds(parentAreaIds, parentType) {
    if (!parentAreaIds?.length) {
      return []
    }

    if (isPsoArea(parentType)) {
      const rmaAreas = await this.prisma.pafs_core_areas.findMany({
        where: {
          parent_id: { in: parentAreaIds.map(Number) },
          area_type: AREA_TYPE_MAP.RMA
        },
        select: { id: true }
      })
      return rmaAreas.map((a) => Number(a.id))
    }

    if (isAreaType(parentType, AREA_TYPE_MAP.EA)) {
      const psoAreas = await this.prisma.pafs_core_areas.findMany({
        where: {
          parent_id: { in: parentAreaIds.map(Number) },
          area_type: AREA_TYPE_MAP.PSO
        },
        select: { id: true }
      })

      if (psoAreas.length === 0) {
        return []
      }

      const psoIds = psoAreas.map((a) => Number(a.id))
      const rmaAreas = await this.prisma.pafs_core_areas.findMany({
        where: {
          parent_id: { in: psoIds },
          area_type: AREA_TYPE_MAP.RMA
        },
        select: { id: true }
      })
      return rmaAreas.map((a) => Number(a.id))
    }

    this.logger.warn(
      { parentType, parentAreaIds },
      'Unsupported parent type for descendant RMA lookup'
    )
    return []
  }
}
