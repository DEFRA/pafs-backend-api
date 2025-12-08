export class AreaService {
  constructor(prisma, logger) {
    this.prisma = prisma
    this.logger = logger
  }

  async getAllAreas() {
    this.logger.info('Fetching all areas from pafs_core_areas table')
    try {
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
        id: area.id.toString()
      }))

      return { success: true, areas: serializedAreas }
    } catch (error) {
      this.logger.error({ error }, 'Failed to fetch areas from the database')
      return { success: false, error: error.message }
    }
  }

  // Fetch areas by a list of IDs (accepts BigInt | string | number)
  async getAreasByIds(areaIds) {
    // Normalize to BigInt array for Prisma
    const normalizedIds = (areaIds || []).map((id) => {
      if (typeof id === 'bigint') {
        return id
      }
      if (typeof id === 'number') {
        return BigInt(id)
      }
      if (typeof id === 'string') {
        return BigInt(id)
      }
      throw new TypeError('Invalid area id type')
    })

    this.logger.info({ count: normalizedIds.length }, 'Fetching areas by IDs')
    try {
      const areas = await this.prisma.pafs_core_areas.findMany({
        where: { id: { in: normalizedIds } },
        select: {
          id: true,
          name: true,
          area_type: true,
          parent_id: true,
          sub_type: true,
          identifier: true,
          end_date: true
        }
      })

      // Convert BigInt id to string for serialization
      return areas.map((area) => ({
        ...area,
        id: area.id.toString()
      }))
    } catch (error) {
      this.logger.error({ error }, 'Failed to fetch areas by IDs')
      throw error
    }
  }
}
