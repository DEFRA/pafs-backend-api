// Constants for reference counter logic
const LOW_COUNTER_MAX = 999
const COUNTER_PAD_LENGTH = 3
const COUNTER_SUFFIX = 'A'
const RFCC_CODES = [
  'AC',
  'AE',
  'AN',
  'NO',
  'NW',
  'SN',
  'SO',
  'SW',
  'TH',
  'TR',
  'TS',
  'WX',
  'YO'
]

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
   * Validate RFCC code
   * @param {string} rfccCode - RFCC code to validate
   * @throws {Error} If RFCC code is invalid
   */
  validateRfccCode(rfccCode) {
    if (!RFCC_CODES.includes(rfccCode)) {
      throw new Error(`Invalid RFCC code: ${rfccCode}`)
    }
  }

  /**
   * Increment counter for RFCC code
   * @param {Object} tx - Prisma transaction
   * @param {string} rfccCode - RFCC code
   * @returns {Promise<Object>} Updated counter
   */
  async incrementCounter(tx, rfccCode) {
    let existingCounter = await tx.pafs_core_reference_counters.findUnique({
      where: {
        rfcc_code: rfccCode
      }
    })

    if (existingCounter) {
      if (existingCounter.low_counter === LOW_COUNTER_MAX) {
        // Increment high_counter and reset low_counter to 1
        existingCounter = await tx.pafs_core_reference_counters.update({
          where: {
            rfcc_code: rfccCode
          },
          data: {
            high_counter: {
              increment: 1
            },
            low_counter: 1,
            updated_at: new Date()
          }
        })
      } else {
        // Increment only low_counter
        existingCounter = await tx.pafs_core_reference_counters.update({
          where: {
            rfcc_code: rfccCode
          },
          data: {
            low_counter: {
              increment: 1
            },
            updated_at: new Date()
          }
        })
      }
    } else {
      // Create a new counter if it doesn't exist
      existingCounter = await tx.pafs_core_reference_counters.create({
        data: {
          rfcc_code: rfccCode,
          high_counter: 0,
          low_counter: 1,
          created_at: new Date(),
          updated_at: new Date()
        }
      })
    }

    return existingCounter
  }

  /**
   * Format counter values for reference number
   * @param {number} highCounter - High counter value
   * @param {number} lowCounter - Low counter value
   * @returns {string} Formatted reference number suffix
   */
  formatCounterParts(highCounter, lowCounter) {
    const highPart =
      String(highCounter).padStart(COUNTER_PAD_LENGTH, '0') + COUNTER_SUFFIX
    const lowPart =
      String(lowCounter).padStart(COUNTER_PAD_LENGTH, '0') + COUNTER_SUFFIX
    return `${highPart}/${lowPart}`
  }

  /**
   * Generate a unique reference number for a project
   * Format: {RFCC_CODE}C501E/{high_counter:03d}A/{low_counter:03d}A
   * e.g., ANC501E/000A/001A, AEC501E/000A/001A
   * Matches the logic from pafs_core Ruby implementation
   *
   * RFCC Code Source:
   * - RFCC codes come from the area hierarchy stored in pafs_core_areas table
   * - Area hierarchy: EA (top) → PSO (has RFCC in sub_type) → RMA (inherits from parent PSO)
   * - Frontend extracts RFCC code from selected area and passes it to this service
   *
   * @param {string} rfccCode - RFCC code extracted from area hierarchy (e.g., 'AN', 'AE')
   * @returns {Promise<string>}
   */
  async generateReferenceNumber(rfccCode = 'AN') {
    this.logger.info({ rfccCode }, 'Generating reference number')

    this.validateRfccCode(rfccCode)

    try {
      // Get or create the counter for this RFCC code with transaction for thread safety
      const counter = await this.prisma.$transaction((tx) =>
        this.incrementCounter(tx, rfccCode)
      )

      // Format counters as 000A/001A
      const counterParts = this.formatCounterParts(
        counter.high_counter,
        counter.low_counter
      )

      // Format: {RFCC_CODE}C501E/{high_counter:03d}A/{low_counter:03d}A
      const referenceNumber = `${rfccCode}C501E/${counterParts}`

      this.logger.info(
        {
          referenceNumber,
          rfccCode,
          highCounter: counter.high_counter,
          lowCounter: counter.low_counter
        },
        'Reference number generated successfully'
      )

      return referenceNumber
    } catch (error) {
      this.logger.error(
        { error: error.message, rfccCode },
        'Error generating reference number'
      )

      throw error
    }
  }

  /**
   * Create a new project proposal
   * @param {Object} proposalData - Project proposal data
   * @param {number} userId - User ID creating the project
   * @param {string} rfccCode - RFCC code for reference number generation (optional, defaults to 'AN')
   * @returns {Promise<Object>}
   */
  async createProjectProposal(proposalData, userId, rfccCode = 'AN') {
    this.logger.info(
      { projectName: proposalData.name, userId, rfccCode },
      'Creating project proposal'
    )

    try {
      // Generate reference number with the specified RFCC code
      const referenceNumber = await this.generateReferenceNumber(rfccCode)

      // Create the project (map camelCase to snake_case for database)
      const project = await this.prisma.pafs_core_projects.create({
        data: {
          reference_number: referenceNumber,
          version: 0,
          slug: referenceNumber.toLowerCase(),
          name: proposalData.name,
          rma_name: proposalData.rmaName || null,
          project_type: proposalData.projectType,
          earliest_start_year: proposalData.projectStartFinancialYear
            ? Number.parseInt(proposalData.projectStartFinancialYear, 10)
            : null,
          project_end_financial_year: proposalData.projectEndFinancialYear
            ? Number.parseInt(proposalData.projectEndFinancialYear, 10)
            : null,
          project_intervention_types: proposalData.projectIntervesionTypes
            ? proposalData.projectIntervesionTypes.join(',')
            : '',
          main_intervention_type: proposalData.mainIntervensionType || null,
          created_at: new Date(),
          updated_at: new Date()
        }
      })
      // Create initial state
      await this.prisma.pafs_core_states.create({
        data: {
          project_id: Number(project.id),
          state: 'draft',
          created_at: new Date(),
          updated_at: new Date()
        }
      })

      this.logger.info(
        { projectId: project.id, referenceNumber },
        'Project proposal created successfully'
      )

      return {
        id: project.id.toString(),
        reference_number: project.reference_number,
        name: project.name,
        project_type: project.project_type,
        earliest_start_year: project.earliest_start_year,
        project_end_financial_year: project.project_end_financial_year,
        project_intervention_types: project.project_intervention_types,
        main_intervention_type: project.main_intervention_type,
        version: project.version,
        created_at: project.created_at
      }
    } catch (error) {
      this.logger.error(
        { error: error.message, projectName: proposalData.name },
        'Error creating project proposal'
      )

      throw error
    }
  }
}
