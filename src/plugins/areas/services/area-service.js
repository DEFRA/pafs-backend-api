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
          in: areaIds.map((id) => BigInt(id))
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
}
