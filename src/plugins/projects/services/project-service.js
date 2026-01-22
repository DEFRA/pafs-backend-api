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

  /**
   * Get Project Overview data
   */
  async getProjectOverviewByReferenceNumber(referenceNumber) {
    if (!referenceNumber || referenceNumber.length === 0) {
      return []
    }

    this.logger.info(
      { referenceNumber },
      'Fetching project details by reference number'
    )

    const projectProposal = await this.prisma.pafs_core_projects.findFirst({
      where: {
        reference_number: referenceNumber
      },
      select: {
        reference_number: true,
        name: true,
        rma_name: true,
        project_type: true,
        project_intervention_types: true,
        main_intervention_type: true,
        earliest_start_year: true,
        project_end_financial_year: true,
        updated_at: true
      }
    })

    const proposalData = {
      referenceNumber: projectProposal.reference_number,
      projectName: projectProposal.name,
      rmaArea: projectProposal.rma_name,
      projectType: projectProposal.project_type,
      interventionTypes: projectProposal.project_intervention_types.split(','),
      mainInterventionType: projectProposal.main_intervention_type,
      startYear: Number(projectProposal.earliest_start_year),
      endYear: Number(projectProposal.project_end_financial_year),
      lastUpdated: projectProposal.updated_at
    }

    return proposalData
  }
}
