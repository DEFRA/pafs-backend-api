import { describe, test, expect, beforeEach, vi } from 'vitest'
import { ProjectNfmService } from './project-nfm-service.js'

describe('ProjectNfmService', () => {
  let service
  let mockPrisma
  let mockLogger

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn()
    }

    mockPrisma = {
      pafs_core_projects: {
        findFirst: vi.fn()
      },
      pafs_core_nfm_measures: {
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn()
      },
      pafs_core_nfm_land_use_changes: {
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn()
      }
    }

    service = new ProjectNfmService(mockPrisma, mockLogger)
  })

  // ─── _getProjectIdByReference ───────────────────────────────────────────────

  describe('_getProjectIdByReference', () => {
    test('should return numeric project ID when project is found', async () => {
      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue({ id: 42n })

      const result = await service._getProjectIdByReference('ANC501E/000A/001A')

      expect(result).toBe(42)
      expect(mockPrisma.pafs_core_projects.findFirst).toHaveBeenCalledWith({
        where: { reference_number: 'ANC501E/000A/001A' },
        select: { id: true }
      })
    })

    test('should throw when project is not found', async () => {
      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue(null)

      await expect(
        service._getProjectIdByReference('UNKNOWN/000A/001A')
      ).rejects.toThrow(
        'Project not found with reference number: UNKNOWN/000A/001A'
      )
    })
  })

  // ─── upsertNfmMeasure ───────────────────────────────────────────────────────

  describe('upsertNfmMeasure', () => {
    const referenceNumber = 'ANC501E/000A/001A'
    const measureType = 'river_floodplain_restoration'
    const payload = {
      referenceNumber,
      measureType,
      areaHectares: 10.5,
      storageVolumeM3: 500,
      lengthKm: 2.3,
      widthM: 15
    }

    beforeEach(() => {
      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue({ id: 1n })
    })

    test('should create a new NFM measure when none exists', async () => {
      mockPrisma.pafs_core_nfm_measures.findFirst.mockResolvedValue(null)
      const created = { id: 10, project_id: 1, measure_type: measureType }
      mockPrisma.pafs_core_nfm_measures.create.mockResolvedValue(created)

      const result = await service.upsertNfmMeasure(payload)

      expect(result).toBe(created)
      expect(mockPrisma.pafs_core_nfm_measures.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          project_id: 1,
          measure_type: measureType,
          area_hectares: 10.5,
          storage_volume_m3: 500,
          length_km: 2.3,
          width_m: 15
        })
      })
      expect(mockPrisma.pafs_core_nfm_measures.update).not.toHaveBeenCalled()
      expect(mockLogger.info).toHaveBeenCalledWith(
        { projectId: 1, measureType, referenceNumber },
        'NFM measure upserted successfully'
      )
    })

    test('should update an existing NFM measure', async () => {
      const existing = { id: 10, project_id: 1, measure_type: measureType }
      mockPrisma.pafs_core_nfm_measures.findFirst.mockResolvedValue(existing)
      const updated = { ...existing, area_hectares: 10.5 }
      mockPrisma.pafs_core_nfm_measures.update.mockResolvedValue(updated)

      const result = await service.upsertNfmMeasure(payload)

      expect(result).toBe(updated)
      expect(mockPrisma.pafs_core_nfm_measures.update).toHaveBeenCalledWith({
        where: { id: existing.id },
        data: expect.objectContaining({
          area_hectares: 10.5,
          storage_volume_m3: 500,
          length_km: 2.3,
          width_m: 15
        })
      })
      expect(mockPrisma.pafs_core_nfm_measures.create).not.toHaveBeenCalled()
    })

    test('should throw and log error when project lookup fails', async () => {
      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue(null)

      await expect(service.upsertNfmMeasure(payload)).rejects.toThrow(
        `Project not found with reference number: ${referenceNumber}`
      )
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ referenceNumber, measureType }),
        'Error upserting NFM measure'
      )
    })

    test('should throw and log error when DB write fails', async () => {
      mockPrisma.pafs_core_nfm_measures.findFirst.mockResolvedValue(null)
      mockPrisma.pafs_core_nfm_measures.create.mockRejectedValue(
        new Error('DB error')
      )

      await expect(service.upsertNfmMeasure(payload)).rejects.toThrow(
        'DB error'
      )
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ referenceNumber, measureType }),
        'Error upserting NFM measure'
      )
    })

    test('should handle null optional fields (storageVolumeM3, lengthKm, widthM)', async () => {
      mockPrisma.pafs_core_nfm_measures.findFirst.mockResolvedValue(null)
      mockPrisma.pafs_core_nfm_measures.create.mockResolvedValue({ id: 11 })

      await service.upsertNfmMeasure({
        referenceNumber,
        measureType,
        areaHectares: 5,
        storageVolumeM3: null,
        lengthKm: null,
        widthM: null
      })

      expect(mockPrisma.pafs_core_nfm_measures.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          storage_volume_m3: null,
          length_km: null,
          width_m: null
        })
      })
    })
  })

  // ─── deleteNfmMeasure ───────────────────────────────────────────────────────

  describe('deleteNfmMeasure', () => {
    const referenceNumber = 'ANC501E/000A/001A'
    const measureType = 'river_floodplain_restoration'

    beforeEach(() => {
      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue({ id: 1n })
    })

    test('should delete an existing NFM measure and return the deleted record', async () => {
      const existing = { id: 10, project_id: 1, measure_type: measureType }
      mockPrisma.pafs_core_nfm_measures.findFirst.mockResolvedValue(existing)
      mockPrisma.pafs_core_nfm_measures.delete.mockResolvedValue(existing)

      const result = await service.deleteNfmMeasure({
        referenceNumber,
        measureType
      })

      expect(result).toBe(existing)
      expect(mockPrisma.pafs_core_nfm_measures.delete).toHaveBeenCalledWith({
        where: { id: existing.id }
      })
      expect(mockLogger.info).toHaveBeenCalledWith(
        { projectId: 1, measureType, referenceNumber },
        'NFM measure deleted successfully'
      )
    })

    test('should return null and log when NFM measure does not exist', async () => {
      mockPrisma.pafs_core_nfm_measures.findFirst.mockResolvedValue(null)

      const result = await service.deleteNfmMeasure({
        referenceNumber,
        measureType
      })

      expect(result).toBeNull()
      expect(mockPrisma.pafs_core_nfm_measures.delete).not.toHaveBeenCalled()
      expect(mockLogger.info).toHaveBeenCalledWith(
        { projectId: 1, measureType, referenceNumber },
        'NFM measure not found, nothing to delete'
      )
    })

    test('should throw and log error when project lookup fails', async () => {
      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue(null)

      await expect(
        service.deleteNfmMeasure({ referenceNumber, measureType })
      ).rejects.toThrow(
        `Project not found with reference number: ${referenceNumber}`
      )
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ referenceNumber, measureType }),
        'Error deleting NFM measure'
      )
    })

    test('should throw and log error when DB delete fails', async () => {
      const existing = { id: 10 }
      mockPrisma.pafs_core_nfm_measures.findFirst.mockResolvedValue(existing)
      mockPrisma.pafs_core_nfm_measures.delete.mockRejectedValue(
        new Error('DB error')
      )

      await expect(
        service.deleteNfmMeasure({ referenceNumber, measureType })
      ).rejects.toThrow('DB error')
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ referenceNumber, measureType }),
        'Error deleting NFM measure'
      )
    })
  })

  // ─── upsertNfmLandUseChange ─────────────────────────────────────────────────

  describe('upsertNfmLandUseChange', () => {
    const referenceNumber = 'ANC501E/000A/001A'
    const landUseType = 'arable'
    const payload = {
      referenceNumber,
      landUseType,
      areaBeforeHectares: 20,
      areaAfterHectares: 15
    }

    beforeEach(() => {
      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue({ id: 1n })
    })

    test('should create a new land use change record when none exists', async () => {
      mockPrisma.pafs_core_nfm_land_use_changes.findFirst.mockResolvedValue(
        null
      )
      const created = { id: 20, project_id: 1, land_use_type: landUseType }
      mockPrisma.pafs_core_nfm_land_use_changes.create.mockResolvedValue(
        created
      )

      const result = await service.upsertNfmLandUseChange(payload)

      expect(result).toBe(created)
      expect(
        mockPrisma.pafs_core_nfm_land_use_changes.create
      ).toHaveBeenCalledWith({
        data: expect.objectContaining({
          project_id: 1,
          land_use_type: landUseType,
          area_before_hectares: 20,
          area_after_hectares: 15
        })
      })
      expect(
        mockPrisma.pafs_core_nfm_land_use_changes.update
      ).not.toHaveBeenCalled()
    })

    test('should update an existing land use change record', async () => {
      const existing = { id: 20, project_id: 1, land_use_type: landUseType }
      mockPrisma.pafs_core_nfm_land_use_changes.findFirst.mockResolvedValue(
        existing
      )
      const updated = { ...existing, area_before_hectares: 20 }
      mockPrisma.pafs_core_nfm_land_use_changes.update.mockResolvedValue(
        updated
      )

      const result = await service.upsertNfmLandUseChange(payload)

      expect(result).toBe(updated)
      expect(
        mockPrisma.pafs_core_nfm_land_use_changes.update
      ).toHaveBeenCalledWith({
        where: { id: existing.id },
        data: expect.objectContaining({
          area_before_hectares: 20,
          area_after_hectares: 15
        })
      })
      expect(
        mockPrisma.pafs_core_nfm_land_use_changes.create
      ).not.toHaveBeenCalled()
    })

    test('should throw and log error when project lookup fails', async () => {
      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue(null)

      await expect(service.upsertNfmLandUseChange(payload)).rejects.toThrow(
        `Project not found with reference number: ${referenceNumber}`
      )
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ referenceNumber, landUseType }),
        'Error upserting NFM land use change'
      )
    })

    test('should throw and log error when DB write fails', async () => {
      mockPrisma.pafs_core_nfm_land_use_changes.findFirst.mockResolvedValue(
        null
      )
      mockPrisma.pafs_core_nfm_land_use_changes.create.mockRejectedValue(
        new Error('DB write error')
      )

      await expect(service.upsertNfmLandUseChange(payload)).rejects.toThrow(
        'DB write error'
      )
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ referenceNumber, landUseType }),
        'Error upserting NFM land use change'
      )
    })
  })

  // ─── deleteNfmLandUseChange ─────────────────────────────────────────────────

  describe('deleteNfmLandUseChange', () => {
    const referenceNumber = 'ANC501E/000A/001A'
    const landUseType = 'arable'

    beforeEach(() => {
      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue({ id: 1n })
    })

    test('should delete an existing land use change record and return it', async () => {
      const existing = { id: 20, project_id: 1, land_use_type: landUseType }
      mockPrisma.pafs_core_nfm_land_use_changes.findFirst.mockResolvedValue(
        existing
      )
      mockPrisma.pafs_core_nfm_land_use_changes.delete.mockResolvedValue(
        existing
      )

      const result = await service.deleteNfmLandUseChange({
        referenceNumber,
        landUseType
      })

      expect(result).toBe(existing)
      expect(
        mockPrisma.pafs_core_nfm_land_use_changes.delete
      ).toHaveBeenCalledWith({
        where: { id: existing.id }
      })
    })

    test('should return null when land use change record does not exist', async () => {
      mockPrisma.pafs_core_nfm_land_use_changes.findFirst.mockResolvedValue(
        null
      )

      const result = await service.deleteNfmLandUseChange({
        referenceNumber,
        landUseType
      })

      expect(result).toBeNull()
      expect(
        mockPrisma.pafs_core_nfm_land_use_changes.delete
      ).not.toHaveBeenCalled()
    })

    test('should throw and log error when project lookup fails', async () => {
      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue(null)

      await expect(
        service.deleteNfmLandUseChange({ referenceNumber, landUseType })
      ).rejects.toThrow(
        `Project not found with reference number: ${referenceNumber}`
      )
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ referenceNumber, landUseType }),
        'Error deleting NFM land use change'
      )
    })

    test('should throw and log error when DB delete fails', async () => {
      const existing = { id: 20 }
      mockPrisma.pafs_core_nfm_land_use_changes.findFirst.mockResolvedValue(
        existing
      )
      mockPrisma.pafs_core_nfm_land_use_changes.delete.mockRejectedValue(
        new Error('DB delete error')
      )

      await expect(
        service.deleteNfmLandUseChange({ referenceNumber, landUseType })
      ).rejects.toThrow('DB delete error')
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ referenceNumber, landUseType }),
        'Error deleting NFM land use change'
      )
    })
  })
})
