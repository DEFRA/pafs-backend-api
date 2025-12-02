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
}
