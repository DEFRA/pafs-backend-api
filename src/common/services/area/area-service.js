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
          // Add other fields you need from the pafs_core_areas table
        },
        orderBy: {
          name: 'asc'
        }
      })

      // Convert BigInt values to strings for JSON serialization
      const serializedAreas = areas.map((area) => ({
        ...area,
        id: area.id.toString()
        // If 'parent_id' is also a BigInt, you might need to convert it too:
        // parent_id: area.parent_id !== null ? area.parent_id.toString() : null,
      }))

      return { success: true, areas: serializedAreas }
    } catch (error) {
      this.logger.error({ error }, 'Failed to fetch areas from the database')
      return { success: false, error: error.message }
    }
  }
}
