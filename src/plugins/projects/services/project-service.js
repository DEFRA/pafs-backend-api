export class ProjectService {
  constructor(prisma, logger) {
    this.prisma = prisma
    this.logger = logger
  }

  /**
   * Check if a project name already exists in the database
   * @param {string} name - Project name to check
   * @returns {Promise<{exists: boolean}>}
   */
  async checkDuplicateProjectName(name) {
    this.logger.info({ projectName: name }, 'Checking if project name exists')

    try {
      const project = await this.prisma.pafs_core_projects.findFirst({
        where: {
          name: {
            equals: name,
            mode: 'insensitive' // Case-insensitive comparison
          }
        },
        select: {
          id: true
        }
      })

      const exists = project !== null

      this.logger.info(
        { projectName: name, exists },
        'Project name existence check completed'
      )

      return { exists }
    } catch (error) {
      this.logger.error(
        { error: error.message, projectName: name },
        'Error checking project name existence'
      )

      throw error
    }
  }
}
