import { PASSWORD, SIZE } from '../../../common/constants/common.js'
import {
  PROJECT_STATUS,
  PROPOSAL_VALIDATION_MESSAGES
} from '../../../common/constants/project.js'
import { ProjectMapper } from '../helpers/project-mapper.js'

const COUNTER_SUFFIX = 'A'
const REFERENCE_NUMBER_TEMPLATE = 'C501E'

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
  async checkDuplicateProjectName(payload) {
    this.logger.info(
      { projectName: payload.name },
      'Checking if project name exists'
    )

    const where = {
      name: {
        equals: payload.name,
        mode: 'insensitive' // Case-insensitive comparison
      }
    }

    if (payload.referenceNumber) {
      where.reference_number = { not: payload.referenceNumber }
    }

    try {
      const existingProject = await this.prisma.pafs_core_projects.findFirst({
        where,
        select: {
          id: true
        }
      })

      if (existingProject) {
        this.logger.warn(
          { projectName: payload.name },
          'Duplicate project name found'
        )
        return {
          isValid: false,
          errors: {
            errorCode: PROPOSAL_VALIDATION_MESSAGES.NAME_DUPLICATE,
            message: 'A project with this name already exists'
          }
        }
      }

      return { isValid: true }
    } catch (error) {
      this.logger.error(
        { projectName: payload.name, error: error.message },
        'Error checking duplicate project name'
      )
      // On error, fail closed (reject the project name)
      return {
        isValid: false,
        errors: {
          errorCode: PROPOSAL_VALIDATION_MESSAGES.NAME_DUPLICATE,
          message: 'Unable to verify project name uniqueness'
        }
      }
    }
  }

  /**
   * Increment counter for RFCC code using Prisma upsert
   * Uses upsert with atomic increment operations in a transaction
   * @param {string} rfccCode - RFCC code
   * @returns {Promise<Object>} Updated counter
   * @private
   */
  async _incrementCounter(rfccCode) {
    return this.prisma.$transaction(async (tx) => {
      // Fetch current counter to check for rollover
      const current = await tx.pafs_core_reference_counters.findUnique({
        where: { rfcc_code: rfccCode },
        select: { low_counter: true, high_counter: true }
      })

      const shouldRollover = current && current.low_counter >= SIZE.LENGTH_999

      // Upsert with appropriate increment logic
      return tx.pafs_core_reference_counters.upsert({
        where: { rfcc_code: rfccCode },
        update: {
          high_counter: shouldRollover ? { increment: 1 } : undefined,
          low_counter: shouldRollover ? 1 : { increment: 1 },
          updated_at: new Date()
        },
        create: {
          rfcc_code: rfccCode,
          high_counter: 0,
          low_counter: 1,
          created_at: new Date(),
          updated_at: new Date()
        }
      })
    })
  }

  /**
   * Format counter values for reference number
   * @param {number} highCounter - High counter value
   * @param {number} lowCounter - Low counter value
   * @returns {string} Formatted reference number suffix
   * @private
   */
  _formatCounterParts(highCounter, lowCounter) {
    const highPart =
      String(highCounter).padStart(SIZE.LENGTH_3, '0') + COUNTER_SUFFIX
    const lowPart =
      String(lowCounter).padStart(SIZE.LENGTH_3, '0') + COUNTER_SUFFIX
    return `${highPart}/${lowPart}`
  }

  /**
   * Generate a unique reference number for a project
   * Format: {RFCC_CODE}C501E/{high_counter:03d}A/{low_counter:03d}A
   * e.g., ANC501E/000A/001A, AEC501E/000A/001A
   *
   * RFCC Code Source:
   * - RFCC codes come from the area hierarchy stored in pafs_core_areas table
   * - Area hierarchy: EA (top) → PSO (has RFCC in sub_type) → RMA (inherits from parent PSO)
   * - Frontend extracts RFCC code from selected area and passes it to this service
   *
   * @param {string} rfccCode - RFCC code extracted from area hierarchy (e.g., 'AN', 'AE')
   * @returns {Promise<string>} Generated reference number
   */
  async generateReferenceNumber(rfccCode = 'AN') {
    this.logger.info({ rfccCode }, 'Generating reference number')

    try {
      // Increment counter atomically with transaction
      const counter = await this._incrementCounter(rfccCode)

      // Format: {RFCC_CODE}C501E/{high_counter:03d}A/{low_counter:03d}A
      const counterParts = this._formatCounterParts(
        counter.high_counter,
        counter.low_counter
      )
      const referenceNumber = `${rfccCode}${REFERENCE_NUMBER_TEMPLATE}/${counterParts}`

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

  async upsertProject(proposalPayload, userId, rfccCode = 'AN') {
    try {
      const dbData = ProjectMapper.toDatabase(proposalPayload)
      dbData.updated_at = new Date()
      dbData.updated_by_id = BigInt(userId)
      dbData.updated_by_type = PASSWORD.ARCHIVABLE_TYPE.USER
      const isCreateOperation = !proposalPayload.referenceNumber

      // Generate reference number for creation if not provided
      let referenceNumber = proposalPayload.referenceNumber
      if (!referenceNumber && rfccCode) {
        referenceNumber = await this.generateReferenceNumber(rfccCode)
      }

      // Generate slug from reference number (replace / with -)
      const slug = referenceNumber
        ? referenceNumber.toLowerCase().replaceAll('/', '-')
        : ''

      const result = await this.prisma.pafs_core_projects.upsert({
        where: {
          reference_number_version: {
            reference_number: referenceNumber,
            version: 1
          }
        },
        update: dbData,
        create: {
          ...dbData,
          reference_number: referenceNumber,
          slug,
          version: 1,
          is_legacy: false,
          creator_id: userId,
          created_at: new Date()
        }
      })

      if (isCreateOperation) {
        await this.upsertProjectState(result.id, PROJECT_STATUS.DRAFT)
        await this.upsertProjectArea(result.id, proposalPayload.rmaId)
      }

      return result
    } catch (error) {
      this.logger.error(
        { error: error.message, proposalPayload },
        'Error upserting project proposal'
      )

      throw error
    }
  }

  /**
   * Get Project Overview data using reference number
   */
  async getProjectOverviewByReferenceNumber(referenceNumber) {
    if (!referenceNumber || referenceNumber.length === 0) {
      return []
    }

    try {
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

      if (!projectProposal) {
        return null
      }

      return this._mappedProposalDetailsData(projectProposal)
    } catch (error) {
      this.logger.error(
        { error: error.message, referenceNumber },
        'Error fetching project details by reference number'
      )
      throw error
    }
  }

  _mappedProposalDetailsData(proposalData) {
    return {
      referenceNumber: proposalData.reference_number,
      projectName: proposalData.name,
      rmaArea: proposalData.rma_name,
      projectType: proposalData.project_type,
      interventionTypes: proposalData.project_intervention_types
        ? proposalData.project_intervention_types.split(',')
        : [],
      mainInterventionType: proposalData.main_intervention_type,
      startYear: Number(proposalData.earliest_start_year),
      endYear: Number(proposalData.project_end_financial_year),
      lastUpdated: proposalData.updated_at
    }
  }

  async upsertProjectState(projectId, newState) {
    try {
      const commonFields = {
        state: newState,
        updated_at: new Date()
      }
      const stateRecord = await this.prisma.pafs_core_states.upsert({
        where: { project_id: Number(projectId) },
        update: commonFields,
        create: {
          project_id: Number(projectId),
          ...commonFields,
          created_at: new Date()
        }
      })
      return stateRecord
    } catch (error) {
      this.logger.error(
        { error: error.message, projectId, newState },
        'Error upserting project state'
      )
      throw error
    }
  }

  async upsertProjectArea(projectId, areaId) {
    try {
      const commonFields = {
        area_id: Number(areaId),
        updated_at: new Date()
      }
      const areaRecord = await this.prisma.pafs_core_area_projects.upsert({
        where: { project_id: Number(projectId) },
        update: {
          ...commonFields,
          owner: false
        },
        create: {
          project_id: Number(projectId),
          created_at: new Date(),
          owner: true,
          ...commonFields
        }
      })
      return areaRecord
    } catch (error) {
      this.logger.error(
        { error: error.message, projectId, areaId },
        'Error upserting project area'
      )
      throw error
    }
  }
}
