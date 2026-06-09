/**
 * ProjectNfmService
 *
 * Handles NFM (Natural Flood Management) measure and land use change persistence.
 * Extracted from ProjectService to keep file sizes within SonarQube limits.
 * ProjectService extends this class and inherits all its methods.
 */
import { ProjectFundingSourcesService } from './project-funding-sources-service.js'

export class ProjectNfmService extends ProjectFundingSourcesService {
  constructor(prisma, logger) {
    super(prisma, logger)
    this.prisma = prisma
    this.logger = logger
  }

  /**
   * Resolve project ID from reference number
   * @private
   */
  async _getProjectIdByReference(referenceNumber) {
    const project = await this.prisma.pafs_core_projects.findFirst({
      where: { reference_number: referenceNumber },
      select: { id: true }
    })

    if (!project) {
      throw new Error(
        `Project not found with reference number: ${referenceNumber}`
      )
    }

    return Number(project.id)
  }

  /**
   * Upsert NFM measure data using Prisma upsert.
   * @@unique([project_id, measure_type]) added via migration 5-003 enables
   * a single round-trip — replaces the old findFirst + update/create pattern.
   * Accepts optional projectId to avoid a redundant _getProjectIdByReference
   * when the caller (handleMeasureUpsert) already has the value.
   */
  async upsertNfmMeasure({
    referenceNumber,
    measureType,
    areaHectares,
    storageVolumeM3,
    lengthKm,
    widthM,
    projectId: providedProjectId
  }) {
    try {
      const projectId =
        providedProjectId ??
        (await this._getProjectIdByReference(referenceNumber))

      const now = new Date()

      const nfmMeasure = await this.prisma.pafs_core_nfm_measures.upsert({
        where: {
          project_id_measure_type: {
            project_id: projectId,
            measure_type: measureType
          }
        },
        update: {
          area_hectares: areaHectares,
          storage_volume_m3: storageVolumeM3,
          length_km: lengthKm,
          width_m: widthM,
          updated_at: now
        },
        create: {
          project_id: projectId,
          measure_type: measureType,
          area_hectares: areaHectares,
          storage_volume_m3: storageVolumeM3,
          length_km: lengthKm,
          width_m: widthM,
          created_at: now,
          updated_at: now
        }
      })

      this.logger.info(
        { projectId, measureType, referenceNumber },
        'NFM measure upserted successfully'
      )

      return nfmMeasure
    } catch (error) {
      this.logger.error(
        { error: error.message, referenceNumber, measureType },
        'Error upserting NFM measure'
      )
      throw error
    }
  }

  /**
   * Upsert NFM land use change detail record.
   * @@unique([project_id, land_use_type]) already existed — Prisma upsert was
   * already in use here. Accepts optional projectId to skip _getProjectIdByReference
   * when the caller (handleLandUseUpsert) already has the value.
   */
  async upsertNfmLandUseChange({
    referenceNumber,
    landUseType,
    areaBeforeHectares,
    areaAfterHectares,
    projectId: providedProjectId
  }) {
    try {
      const projectId =
        providedProjectId ??
        (await this._getProjectIdByReference(referenceNumber))

      const now = new Date()

      return await this.prisma.pafs_core_nfm_land_use_changes.upsert({
        where: {
          project_id_land_use_type: {
            project_id: projectId,
            land_use_type: landUseType
          }
        },
        update: {
          area_before_hectares: areaBeforeHectares,
          area_after_hectares: areaAfterHectares,
          updated_at: now
        },
        create: {
          project_id: projectId,
          land_use_type: landUseType,
          area_before_hectares: areaBeforeHectares,
          area_after_hectares: areaAfterHectares,
          created_at: now,
          updated_at: now
        }
      })
    } catch (error) {
      this.logger.error(
        { error: error.message, referenceNumber, landUseType },
        'Error upserting NFM land use change'
      )
      throw error
    }
  }

  /**
   * Delete multiple NFM measures in a single query.
   * Accepts optional projectId to avoid a redundant _getProjectIdByReference
   * when the caller (handleSelectedMeasureCleanup) already has the value.
   */
  async batchDeleteNfmMeasures({
    referenceNumber,
    measureTypes,
    projectId: providedProjectId
  }) {
    if (!measureTypes || measureTypes.length === 0) {
      return
    }
    try {
      const projectId =
        providedProjectId ??
        (await this._getProjectIdByReference(referenceNumber))

      await this.prisma.pafs_core_nfm_measures.deleteMany({
        where: {
          project_id: projectId,
          measure_type: { in: measureTypes }
        }
      })
      this.logger.info(
        { projectId, referenceNumber, measureTypes },
        'NFM measures batch deleted'
      )
    } catch (error) {
      this.logger.error(
        { error: error.message, referenceNumber, measureTypes },
        'Error batch deleting NFM measures'
      )
      throw error
    }
  }

  /**
   * Delete multiple NFM land use change records in a single query.
   * Accepts optional projectId to avoid a redundant _getProjectIdByReference
   * when the caller (handleLandUseCleanup) already has the value.
   */
  async batchDeleteNfmLandUseChanges({
    referenceNumber,
    landUseTypes,
    projectId: providedProjectId
  }) {
    if (!landUseTypes || landUseTypes.length === 0) {
      return
    }
    try {
      const projectId =
        providedProjectId ??
        (await this._getProjectIdByReference(referenceNumber))

      await this.prisma.pafs_core_nfm_land_use_changes.deleteMany({
        where: {
          project_id: projectId,
          land_use_type: { in: landUseTypes }
        }
      })
      this.logger.info(
        { projectId, referenceNumber, landUseTypes },
        'NFM land use changes batch deleted'
      )
    } catch (error) {
      this.logger.error(
        { error: error.message, referenceNumber, landUseTypes },
        'Error batch deleting NFM land use changes'
      )
      throw error
    }
  }

  /**
   * Delete all NFM child records (land use changes + measures) for a project.
   * Accepts optional projectId to avoid a redundant _getProjectIdByReference.
   */
  async deleteAllNfmChildRecords(referenceNumber, providedProjectId) {
    try {
      const projectId =
        providedProjectId ??
        (await this._getProjectIdByReference(referenceNumber))

      const landUseResult =
        await this.prisma.pafs_core_nfm_land_use_changes.deleteMany({
          where: { project_id: projectId }
        })

      const measuresResult =
        await this.prisma.pafs_core_nfm_measures.deleteMany({
          where: { project_id: projectId }
        })

      const result = {
        landUseChangesDeleted: landUseResult.count,
        measuresDeleted: measuresResult.count
      }

      this.logger.info(
        { projectId, referenceNumber, ...result },
        'All NFM land use changes and measures deleted successfully'
      )

      return result
    } catch (error) {
      this.logger.error(
        { error: error.message, referenceNumber },
        'Error deleting all NFM land use changes and measures'
      )
      throw error
    }
  }
}
