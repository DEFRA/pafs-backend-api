/**
 * ProjectNfmService
 *
 * Handles NFM (Natural Flood Management) measure and land use change persistence.
 * Extracted from ProjectService to keep file sizes within SonarQube limits.
 * ProjectService extends this class and inherits all its methods.
 */
export class ProjectNfmService {
  constructor(prisma, logger) {
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
   * Upsert NFM measure data to pafs_core_nfm_measures table
   * @param {Object} data - NFM measure data
   * @param {string} data.referenceNumber - Project reference number
   * @param {string} data.measureType - Type of NFM measure (e.g., 'river_floodplain_restoration')
   * @param {number} data.areaHectares - Area in hectares
   * @param {number|null} data.storageVolumeM3 - Storage volume in cubic meters (optional)
   * @param {number|null} data.lengthKm - Length in kilometres (optional)
   * @param {number|null} data.widthM - Width in metres (optional)
   * @returns {Promise<Object>} Created or updated NFM measure record
   */
  async upsertNfmMeasure({
    referenceNumber,
    measureType,
    areaHectares,
    storageVolumeM3,
    lengthKm,
    widthM
  }) {
    try {
      const projectId = await this._getProjectIdByReference(referenceNumber)

      const existingMeasure =
        await this.prisma.pafs_core_nfm_measures.findFirst({
          where: {
            project_id: projectId,
            measure_type: measureType
          }
        })

      let nfmMeasure
      if (existingMeasure) {
        nfmMeasure = await this.prisma.pafs_core_nfm_measures.update({
          where: { id: existingMeasure.id },
          data: {
            area_hectares: areaHectares,
            storage_volume_m3: storageVolumeM3,
            length_km: lengthKm,
            width_m: widthM,
            updated_at: new Date()
          }
        })
      } else {
        nfmMeasure = await this.prisma.pafs_core_nfm_measures.create({
          data: {
            project_id: projectId,
            measure_type: measureType,
            area_hectares: areaHectares,
            storage_volume_m3: storageVolumeM3,
            length_km: lengthKm,
            width_m: widthM,
            created_at: new Date(),
            updated_at: new Date()
          }
        })
      }

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
   * Delete NFM measure data from pafs_core_nfm_measures table
   * @param {Object} data - NFM measure identification data
   * @param {string} data.referenceNumber - Project reference number
   * @param {string} data.measureType - Type of NFM measure to delete
   * @returns {Promise<Object>} Deleted NFM measure record or null if not found
   */
  async deleteNfmMeasure({ referenceNumber, measureType }) {
    try {
      const projectId = await this._getProjectIdByReference(referenceNumber)

      const existingMeasure =
        await this.prisma.pafs_core_nfm_measures.findFirst({
          where: {
            project_id: projectId,
            measure_type: measureType
          }
        })

      if (existingMeasure) {
        const deletedMeasure = await this.prisma.pafs_core_nfm_measures.delete({
          where: { id: existingMeasure.id }
        })

        this.logger.info(
          { projectId, measureType, referenceNumber },
          'NFM measure deleted successfully'
        )

        return deletedMeasure
      }

      this.logger.info(
        { projectId, measureType, referenceNumber },
        'NFM measure not found, nothing to delete'
      )

      return null
    } catch (error) {
      this.logger.error(
        { error: error.message, referenceNumber, measureType },
        'Error deleting NFM measure'
      )
      throw error
    }
  }

  /**
   * Upsert NFM land use change detail record
   * @param {Object} data - Land use change data
   * @param {string} data.referenceNumber - Project reference number
   * @param {string} data.landUseType - Type of land use change
   * @param {number} data.areaBeforeHectares - Area before change in hectares
   * @param {number} data.areaAfterHectares - Area after change in hectares
   * @returns {Promise<Object>} Created or updated land use change record
   */
  async upsertNfmLandUseChange({
    referenceNumber,
    landUseType,
    areaBeforeHectares,
    areaAfterHectares
  }) {
    try {
      const projectId = await this._getProjectIdByReference(referenceNumber)

      const existingRecord =
        await this.prisma.pafs_core_nfm_land_use_changes.findFirst({
          where: {
            project_id: projectId,
            land_use_type: landUseType
          }
        })

      if (existingRecord) {
        return await this.prisma.pafs_core_nfm_land_use_changes.update({
          where: { id: existingRecord.id },
          data: {
            area_before_hectares: areaBeforeHectares,
            area_after_hectares: areaAfterHectares,
            updated_at: new Date()
          }
        })
      }

      return await this.prisma.pafs_core_nfm_land_use_changes.create({
        data: {
          project_id: projectId,
          land_use_type: landUseType,
          area_before_hectares: areaBeforeHectares,
          area_after_hectares: areaAfterHectares,
          created_at: new Date(),
          updated_at: new Date()
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
   * Delete NFM land use change detail record
   * @param {Object} data - Land use change identification data
   * @param {string} data.referenceNumber - Project reference number
   * @param {string} data.landUseType - Type of land use change to delete
   * @returns {Promise<Object>} Deleted record or null if not found
   */
  async deleteNfmLandUseChange({ referenceNumber, landUseType }) {
    try {
      const projectId = await this._getProjectIdByReference(referenceNumber)

      const existingRecord =
        await this.prisma.pafs_core_nfm_land_use_changes.findFirst({
          where: {
            project_id: projectId,
            land_use_type: landUseType
          }
        })

      if (!existingRecord) {
        return null
      }

      return await this.prisma.pafs_core_nfm_land_use_changes.delete({
        where: { id: existingRecord.id }
      })
    } catch (error) {
      this.logger.error(
        { error: error.message, referenceNumber, landUseType },
        'Error deleting NFM land use change'
      )
      throw error
    }
  }

  /**
   * Delete all NFM child records (land use changes + measures) for a project (bulk delete)
   * Used when clearing NFM data after an intervention type change away from NFM/SUDS
   * @param {string} referenceNumber - Project reference number
   * @returns {Promise<{landUseChangesDeleted: number, measuresDeleted: number}>}
   */
  async deleteAllNfmChildRecords(referenceNumber) {
    try {
      const projectId = await this._getProjectIdByReference(referenceNumber)

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
