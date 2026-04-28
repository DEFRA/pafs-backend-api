/**
 * Presenter mixin for NFM measures and land-use change fields
 * used only by the new FCERM1 template (2026/27 onwards).
 *
 * Data comes from two related tables loaded by the service:
 *   pafs_core_nfm_measures      – measure_type, area/volume/length/width
 *   pafs_core_nfm_land_use_changes – land_use_type, before/after area
 */

// ── NFM measure type keys ─────────────────────────────────────────────────────

const NFM_RIVER_FLOODPLAIN = 'river_floodplain_restoration'
const NFM_LEAKY_BARRIERS = 'leaky_barriers_in_channel_storage'
const NFM_OFFLINE_STORAGE = 'offline_storage_areas'
const NFM_WOODLAND = 'woodland'
const NFM_HEADWATER_DRAINAGE = 'headwater_drainage_management'
const NFM_RUNOFF_ATTENUATION = 'runoff_attenuation'
const NFM_SALTMARSH = 'saltmarsh_mudflat_management'
const NFM_SAND_DUNE = 'sand_dune_management'

// ── Land-use type keys ────────────────────────────────────────────────────────

const LU_ENCLOSED_ARABLE = 'enclosed_arable_farmland'
const LU_ENCLOSED_LIVESTOCK = 'enclosed_livestock_farmland'
const LU_ENCLOSED_DAIRYING = 'enclosed_dairying_farmland'
const LU_SEMI_NATURAL_GRASSLAND = 'semi_natural_grassland'
const LU_WOODLAND = 'woodland'
const LU_MOUNTAIN_MOORS_HEATH = 'mountain_moors_heath'
const LU_PEATLAND = 'peatland_restoration'
const LU_RIVERS_WETLANDS = 'rivers_wetlands_freshwater'
const LU_COASTAL_MARGINS = 'coastal_margins'

// ── Lookup helpers ────────────────────────────────────────────────────────────

function findMeasure(measures, type) {
  return (measures ?? []).find((m) => m.measure_type === type) ?? null
}

function findLandUse(landUseChanges, type) {
  return (landUseChanges ?? []).find((lu) => lu.land_use_type === type) ?? null
}

function measureField(measures, type, field) {
  const row = findMeasure(measures, type)
  return row ? (row[field] ?? null) : null
}

function landUseBefore(landUseChanges, type) {
  const row = findLandUse(landUseChanges, type)
  return row ? (row.area_before_hectares ?? null) : null
}

function landUseAfter(landUseChanges, type) {
  const row = findLandUse(landUseChanges, type)
  return row ? (row.area_after_hectares ?? null) : null
}

// ── Mixin ─────────────────────────────────────────────────────────────────────

export const nfmMixin = {
  // ── NHM confidence fields (KE–KG) ─────────────────────────────────────────

  nfmLandownerConsent() {
    return this._p.nfm_landowner_consent ?? null
  },
  nfmExperienceLevel() {
    return this._p.nfm_experience_level ?? null
  },
  nfmProjectReadiness() {
    return this._p.nfm_project_readiness ?? null
  },

  // ── River and Floodplain Restoration (IG–IJ) ───────────────────────────────

  riverFloodplainArea() {
    return measureField(
      this._p.pafs_core_nfm_measures,
      NFM_RIVER_FLOODPLAIN,
      'area_hectares'
    )
  },
  riverFloodplainVolume() {
    return measureField(
      this._p.pafs_core_nfm_measures,
      NFM_RIVER_FLOODPLAIN,
      'storage_volume_m3'
    )
  },
  riverFloodplainLength() {
    return measureField(
      this._p.pafs_core_nfm_measures,
      NFM_RIVER_FLOODPLAIN,
      'length_km'
    )
  },
  riverFloodplainWidth() {
    return measureField(
      this._p.pafs_core_nfm_measures,
      NFM_RIVER_FLOODPLAIN,
      'width_m'
    )
  },

  // ── Leaky Barriers and In-Channel Storage (IK–IN) ─────────────────────────

  leakyBarriersArea() {
    return measureField(
      this._p.pafs_core_nfm_measures,
      NFM_LEAKY_BARRIERS,
      'area_hectares'
    )
  },
  leakyBarriersVolume() {
    return measureField(
      this._p.pafs_core_nfm_measures,
      NFM_LEAKY_BARRIERS,
      'storage_volume_m3'
    )
  },
  leakyBarriersLength() {
    return measureField(
      this._p.pafs_core_nfm_measures,
      NFM_LEAKY_BARRIERS,
      'length_km'
    )
  },
  leakyBarriersWidth() {
    return measureField(
      this._p.pafs_core_nfm_measures,
      NFM_LEAKY_BARRIERS,
      'width_m'
    )
  },

  // ── Offline Storage Areas (IO–IR) ─────────────────────────────────────────

  offlineStorageArea() {
    return measureField(
      this._p.pafs_core_nfm_measures,
      NFM_OFFLINE_STORAGE,
      'area_hectares'
    )
  },
  offlineStorageVolume() {
    return measureField(
      this._p.pafs_core_nfm_measures,
      NFM_OFFLINE_STORAGE,
      'storage_volume_m3'
    )
  },
  offlineStorageLength() {
    return measureField(
      this._p.pafs_core_nfm_measures,
      NFM_OFFLINE_STORAGE,
      'length_km'
    )
  },
  offlineStorageWidth() {
    return measureField(
      this._p.pafs_core_nfm_measures,
      NFM_OFFLINE_STORAGE,
      'width_m'
    )
  },

  // ── Woodland (IS–IV) ──────────────────────────────────────────────────────

  woodlandNfmArea() {
    return measureField(
      this._p.pafs_core_nfm_measures,
      NFM_WOODLAND,
      'area_hectares'
    )
  },
  woodlandNfmVolume() {
    return measureField(
      this._p.pafs_core_nfm_measures,
      NFM_WOODLAND,
      'storage_volume_m3'
    )
  },
  woodlandNfmLength() {
    return measureField(
      this._p.pafs_core_nfm_measures,
      NFM_WOODLAND,
      'length_km'
    )
  },
  woodlandNfmWidth() {
    return measureField(this._p.pafs_core_nfm_measures, NFM_WOODLAND, 'width_m')
  },

  // ── Headwater Drainage Management (IW–IZ) ─────────────────────────────────

  headwaterDrainageArea() {
    return measureField(
      this._p.pafs_core_nfm_measures,
      NFM_HEADWATER_DRAINAGE,
      'area_hectares'
    )
  },
  headwaterDrainageVolume() {
    return measureField(
      this._p.pafs_core_nfm_measures,
      NFM_HEADWATER_DRAINAGE,
      'storage_volume_m3'
    )
  },
  headwaterDrainageLength() {
    return measureField(
      this._p.pafs_core_nfm_measures,
      NFM_HEADWATER_DRAINAGE,
      'length_km'
    )
  },
  headwaterDrainageWidth() {
    return measureField(
      this._p.pafs_core_nfm_measures,
      NFM_HEADWATER_DRAINAGE,
      'width_m'
    )
  },

  // ── Runoff Attenuation or Management (JA–JD) ──────────────────────────────

  runoffAttenuationArea() {
    return measureField(
      this._p.pafs_core_nfm_measures,
      NFM_RUNOFF_ATTENUATION,
      'area_hectares'
    )
  },
  runoffAttenuationVolume() {
    return measureField(
      this._p.pafs_core_nfm_measures,
      NFM_RUNOFF_ATTENUATION,
      'storage_volume_m3'
    )
  },
  runoffAttenuationLength() {
    return measureField(
      this._p.pafs_core_nfm_measures,
      NFM_RUNOFF_ATTENUATION,
      'length_km'
    )
  },
  runoffAttenuationWidth() {
    return measureField(
      this._p.pafs_core_nfm_measures,
      NFM_RUNOFF_ATTENUATION,
      'width_m'
    )
  },

  // ── Saltmarsh or Mudflat Management (JE–JH) ───────────────────────────────

  saltmarshArea() {
    return measureField(
      this._p.pafs_core_nfm_measures,
      NFM_SALTMARSH,
      'area_hectares'
    )
  },
  saltmarshVolume() {
    return measureField(
      this._p.pafs_core_nfm_measures,
      NFM_SALTMARSH,
      'storage_volume_m3'
    )
  },
  saltmarshLength() {
    return measureField(
      this._p.pafs_core_nfm_measures,
      NFM_SALTMARSH,
      'length_km'
    )
  },
  saltmarshWidth() {
    return measureField(
      this._p.pafs_core_nfm_measures,
      NFM_SALTMARSH,
      'width_m'
    )
  },

  // ── Sand and Dune Management (JI–JL) ──────────────────────────────────────

  sandDuneArea() {
    return measureField(
      this._p.pafs_core_nfm_measures,
      NFM_SAND_DUNE,
      'area_hectares'
    )
  },
  sandDuneVolume() {
    return measureField(
      this._p.pafs_core_nfm_measures,
      NFM_SAND_DUNE,
      'storage_volume_m3'
    )
  },
  sandDuneLength() {
    return measureField(
      this._p.pafs_core_nfm_measures,
      NFM_SAND_DUNE,
      'length_km'
    )
  },
  sandDuneWidth() {
    return measureField(
      this._p.pafs_core_nfm_measures,
      NFM_SAND_DUNE,
      'width_m'
    )
  },

  // ── Land-use changes (JM–KD) ──────────────────────────────────────────────

  enclosedArableBefore() {
    return landUseBefore(
      this._p.pafs_core_nfm_land_use_changes,
      LU_ENCLOSED_ARABLE
    )
  },
  enclosedArableAfter() {
    return landUseAfter(
      this._p.pafs_core_nfm_land_use_changes,
      LU_ENCLOSED_ARABLE
    )
  },
  enclosedLivestockBefore() {
    return landUseBefore(
      this._p.pafs_core_nfm_land_use_changes,
      LU_ENCLOSED_LIVESTOCK
    )
  },
  enclosedLivestockAfter() {
    return landUseAfter(
      this._p.pafs_core_nfm_land_use_changes,
      LU_ENCLOSED_LIVESTOCK
    )
  },
  enclosedDairyingBefore() {
    return landUseBefore(
      this._p.pafs_core_nfm_land_use_changes,
      LU_ENCLOSED_DAIRYING
    )
  },
  enclosedDairyingAfter() {
    return landUseAfter(
      this._p.pafs_core_nfm_land_use_changes,
      LU_ENCLOSED_DAIRYING
    )
  },
  semiNaturalGrasslandBefore() {
    return landUseBefore(
      this._p.pafs_core_nfm_land_use_changes,
      LU_SEMI_NATURAL_GRASSLAND
    )
  },
  semiNaturalGrasslandAfter() {
    return landUseAfter(
      this._p.pafs_core_nfm_land_use_changes,
      LU_SEMI_NATURAL_GRASSLAND
    )
  },
  woodlandLandUseBefore() {
    return landUseBefore(this._p.pafs_core_nfm_land_use_changes, LU_WOODLAND)
  },
  woodlandLandUseAfter() {
    return landUseAfter(this._p.pafs_core_nfm_land_use_changes, LU_WOODLAND)
  },
  mountainMoorsHeathBefore() {
    return landUseBefore(
      this._p.pafs_core_nfm_land_use_changes,
      LU_MOUNTAIN_MOORS_HEATH
    )
  },
  mountainMoorsHeathAfter() {
    return landUseAfter(
      this._p.pafs_core_nfm_land_use_changes,
      LU_MOUNTAIN_MOORS_HEATH
    )
  },
  peatlandRestorationBefore() {
    return landUseBefore(this._p.pafs_core_nfm_land_use_changes, LU_PEATLAND)
  },
  peatlandRestorationAfter() {
    return landUseAfter(this._p.pafs_core_nfm_land_use_changes, LU_PEATLAND)
  },
  riversWetlandsBefore() {
    return landUseBefore(
      this._p.pafs_core_nfm_land_use_changes,
      LU_RIVERS_WETLANDS
    )
  },
  riversWetlandsAfter() {
    return landUseAfter(
      this._p.pafs_core_nfm_land_use_changes,
      LU_RIVERS_WETLANDS
    )
  },
  coastalMarginsBefore() {
    return landUseBefore(
      this._p.pafs_core_nfm_land_use_changes,
      LU_COASTAL_MARGINS
    )
  },
  coastalMarginsAfter() {
    return landUseAfter(
      this._p.pafs_core_nfm_land_use_changes,
      LU_COASTAL_MARGINS
    )
  }
}
