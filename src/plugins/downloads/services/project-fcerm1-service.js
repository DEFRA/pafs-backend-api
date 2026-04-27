export class ProjectFcerm1Service {
  constructor(prisma, logger) {
    this.prisma = prisma
    this.logger = logger
  }

  // Run all child-table lookups in parallel — none depend on each other
  async _fetchRelatedData(projectId, projectIdInt) {
    const [
      fundingValues,
      floodProtectionOutcomes,
      flood2040Outcomes,
      coastalOutcomes,
      nfmMeasures,
      nfmLandUseChanges,
      stateRow,
      areaProject
    ] = await Promise.all([
      this.prisma.pafs_core_funding_values.findMany({
        where: { project_id: projectId }
      }),
      this.prisma.pafs_core_flood_protection_outcomes.findMany({
        where: { project_id: projectId }
      }),
      this.prisma.pafs_core_flood_protection2040_outcomes.findMany({
        where: { project_id: projectId }
      }),
      this.prisma.pafs_core_coastal_erosion_protection_outcomes.findMany({
        where: { project_id: projectId }
      }),
      this.prisma.pafs_core_nfm_measures.findMany({
        where: { project_id: projectId }
      }),
      this.prisma.pafs_core_nfm_land_use_changes.findMany({
        where: { project_id: projectId }
      }),
      this.prisma.pafs_core_states.findFirst({
        where: { project_id: projectIdInt },
        select: { state: true }
      }),
      this.prisma.pafs_core_area_projects.findFirst({
        where: { project_id: projectIdInt },
        select: { area_id: true }
      })
    ])
    return {
      fundingValues,
      floodProtectionOutcomes,
      flood2040Outcomes,
      coastalOutcomes,
      nfmMeasures,
      nfmLandUseChanges,
      stateRow,
      areaProject
    }
  }

  /**
   * Load everything needed to build an FCERM1 row for one project.
   *
   * @param {string} referenceNumber  e.g. 'AC/2021/00001/000' (slashes, not hyphens)
   * @returns {Promise<{project, contributors, areaId} | null>}
   */
  async getProjectForFcerm1(referenceNumber) {
    const project = await this.prisma.pafs_core_projects.findFirst({
      where: { reference_number: referenceNumber }
    })

    if (!project) {
      return null
    }

    const projectId = project.id // BigInt — used for child tables that store BigInt
    const projectIdInt = Number(projectId) // Int   — used for states + area_projects tables

    const {
      fundingValues,
      floodProtectionOutcomes,
      flood2040Outcomes,
      coastalOutcomes,
      nfmMeasures,
      nfmLandUseChanges,
      stateRow,
      areaProject
    } = await this._fetchRelatedData(projectId, projectIdInt)

    // Load contributors keyed on funding value ids — depends on fundingValues result above
    const fundingValueIds = fundingValues.map((fv) => fv.id)
    const contributors =
      fundingValueIds.length > 0
        ? await this.prisma.pafs_core_funding_contributors.findMany({
            where: { funding_value_id: { in: fundingValueIds } }
          })
        : []

    // Resolve the name of the person who last updated the project
    const updatedByUser = project.updated_by_id
      ? await this.prisma.pafs_core_users.findFirst({
          where: { id: project.updated_by_id },
          select: { first_name: true, last_name: true, email: true }
        })
      : null

    // Assemble the enriched project object — the presenter expects child rows attached
    const projectData = {
      ...project,
      pafs_core_funding_values: fundingValues,
      pafs_core_flood_protection_outcomes: floodProtectionOutcomes,
      pafs_core_flood_protection2040_outcomes: flood2040Outcomes,
      pafs_core_coastal_erosion_protection_outcomes: coastalOutcomes,
      pafs_core_nfm_measures: nfmMeasures,
      pafs_core_nfm_land_use_changes: nfmLandUseChanges,
      _state: stateRow?.state ?? null,
      _updatedByName: updatedByUser
        ? `${updatedByUser.first_name} ${updatedByUser.last_name}`.trim()
        : null,
      _updatedByEmail: updatedByUser?.email ?? null
    }

    return {
      project: projectData,
      contributors,
      areaId: areaProject?.area_id ?? null
    }
  }
}
