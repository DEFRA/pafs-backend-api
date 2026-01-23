export class AreaService {
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
      this.logger.warn(
        { areaIdentifier },
        'Area not found for identifier'
      )
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
        (parentArea.area_type === 'PSO Area' ||
          parentArea.area_type === 'PSO')
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
}
