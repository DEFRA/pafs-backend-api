/**
 * Pure utility functions and data-building helpers for the proposal payload.
 *
 * These have no side effects beyond the S3 fetch in fetchShapefileBase64, and
 * can therefore be unit-tested in isolation from the sub-builder assembly.
 */

import { RFCC_CODE_NAMES } from '../../downloads/helpers/fcerm1/fcerm1-labels.js'
import { getS3Service } from '../../../common/services/file-upload/s3-service.js'
import {
  NFM_MEASURE_FIELD_MAP,
  NFM_LAND_USE_FIELD_MAP
} from './proposal-payload-constants.js'

// ---------------------------------------------------------------------------
// Primitive converters
// ---------------------------------------------------------------------------

/**
 * Convert a BigInt or Decimal-like value to a plain number (or null).
 * Prisma returns BigInt for some fields and Decimal objects for others.
 * @param {BigInt|import('@prisma/client').Decimal|number|null|undefined} value
 * @returns {number|null}
 */
export function toNumber(value) {
  if (value === null || value === undefined) {
    return null
  }
  if (typeof value === 'bigint') {
    return Number(value)
  }
  if (typeof value === 'object' && typeof value.toNumber === 'function') {
    return value.toNumber()
  }
  return Number(value) || null
}

/**
 * Look up a label from a map, falling back to the raw value.
 * @param {Object} map
 * @param {string|null|undefined} value
 * @returns {string|null}
 */
export function label(map, value) {
  if (value == null) {
    return null
  }
  return map[value] ?? value
}

/**
 * Assign a field when the value is not null/undefined.
 * Extracted to keep buildNfmMeasures below complexity threshold.
 * @param {Object} result
 * @param {string|undefined} key
 * @param {*} rawValue
 */
export function assignIfPresent(result, key, rawValue) {
  if (key && rawValue != null) {
    result[key] = toNumber(rawValue)
  }
}

// ---------------------------------------------------------------------------
// Date / region helpers
// ---------------------------------------------------------------------------

/**
 * Format a month/year pair as "MM/YYYY" — returns null when either is absent.
 * @param {number|null|undefined} month
 * @param {number|null|undefined} year
 * @returns {string|null}
 */
export function formatDate(month, year) {
  if (!month || !year) {
    return null
  }
  return `${String(month).padStart(2, '0')}/${year}`
}

/**
 * Derive the RFCC region name from the project reference number prefix.
 * Reference numbers take the form "AC501E/000A/001A" — the first two chars
 * are the RFCC code.
 * @param {string|null|undefined} referenceNumber
 * @returns {string|null}
 */
export function deriveRfccRegion(referenceNumber) {
  if (!referenceNumber) {
    return null
  }
  const code = referenceNumber.substring(0, 2).toUpperCase()
  return RFCC_CODE_NAMES[code] ?? null
}

// ---------------------------------------------------------------------------
// Risk / intervention type parsers
// ---------------------------------------------------------------------------

/**
 * Parse a comma-separated string into a Set of trimmed tokens.
 * @param {string|null|undefined} str
 * @returns {Set<string>}
 */
function parseCommaSeparated(str) {
  return new Set(
    (str || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  )
}

/**
 * Parse the comma-separated risks string stored in the DB into a boolean map.
 * @param {string|null|undefined} risksString - e.g. "fluvial_flooding,tidal_flooding"
 * @returns {Object}
 */
export function buildSecondaryRiskSources(risksString) {
  const allRisks = [
    'fluvial_flooding',
    'tidal_flooding',
    'groundwater_flooding',
    'surface_water_flooding',
    'sea_flooding',
    'reservoir_flooding',
    'coastal_erosion'
  ]
  const active = parseCommaSeparated(risksString)
  return Object.fromEntries(allRisks.map((r) => [r, active.has(r)]))
}

/**
 * Parse the comma-separated intervention types string into a boolean map.
 * @param {string|null|undefined} typesString - e.g. "nfm,pfr"
 * @returns {Object}
 */
export function buildInterventionTypes(typesString) {
  const allTypes = [
    'natural_flood_management',
    'property_flood_resilience',
    'sustainable_drainage_systems',
    'other'
  ]
  const typeKeyMap = {
    nfm: 'natural_flood_management',
    pfr: 'property_flood_resilience',
    suds: 'sustainable_drainage_systems',
    other: 'other',
    natural_flood_management: 'natural_flood_management',
    property_flood_resilience: 'property_flood_resilience',
    sustainable_drainage_systems: 'sustainable_drainage_systems'
  }
  const rawTokens = parseCommaSeparated(typesString)
  const active = new Set([...rawTokens].map((t) => typeKeyMap[t] ?? t))
  return Object.fromEntries(allTypes.map((t) => [t, active.has(t)]))
}

// ---------------------------------------------------------------------------
// NFM and funding builders
// ---------------------------------------------------------------------------

/**
 * Build the NFM measures sub-object from the nfmMeasures array.
 * @param {Array} measures
 * @returns {Object}
 */
export function buildNfmMeasures(measures) {
  const result = {}
  for (const measure of measures ?? []) {
    const fields = NFM_MEASURE_FIELD_MAP[measure.measureType]
    if (!fields) {
      continue
    }
    assignIfPresent(result, fields.area, measure.areaHectares)
    assignIfPresent(result, fields.volume, measure.storageVolumeM3)
    assignIfPresent(result, fields.length, measure.lengthKm)
    assignIfPresent(result, fields.width, measure.widthM)
  }
  return result
}

/**
 * Build the NFM land use sub-object from the nfmLandUseChanges array.
 * @param {Array} landUseChanges
 * @returns {Object}
 */
export function buildNfmLandUseChanges(landUseChanges) {
  const result = {}
  for (const change of landUseChanges ?? []) {
    const fields = NFM_LAND_USE_FIELD_MAP[change.landUseType]
    if (!fields) {
      continue
    }
    assignIfPresent(result, fields.before, change.areaBeforeHectares)
    assignIfPresent(result, fields.after, change.areaAfterHectares)
  }
  return result
}

/**
 * Build the funding_sources array from the funding values and contributors.
 * Each element represents one financial year's breakdown.
 * @param {Array} fundingValues
 * @param {Array} fundingContributors
 * @returns {Array}
 */
export function buildFundingSources(fundingValues, fundingContributors) {
  const contributorsByValueId = new Map()
  for (const c of fundingContributors ?? []) {
    const vid = Number(c.fundingValueId)
    if (!contributorsByValueId.has(vid)) {
      contributorsByValueId.set(vid, [])
    }
    contributorsByValueId.get(vid).push(c)
  }

  return (fundingValues ?? []).map((fv) => {
    const contributors = contributorsByValueId.get(Number(fv.id)) ?? []

    const filterContributors = (type) =>
      contributors
        .filter((c) => c.contributorType === type)
        .map((c) => ({ name: c.name ?? null, amount: toNumber(c.amount) }))

    return {
      financial_year: fv.financialYear,
      fcerm_gia: toNumber(fv.fcermGia),
      asset_replacement_allowance: toNumber(fv.assetReplacementAllowance),
      environment_statutory_funding: toNumber(fv.environmentStatutoryFunding),
      frequently_floodded_communities: toNumber(
        fv.frequentlyFloodedCommunities
      ),
      other_additional_grant_in_aid: toNumber(fv.otherAdditionalGrantInAid),
      other_government_department: toNumber(fv.otherGovernmentDepartment),
      recovery: toNumber(fv.recovery),
      summer_economic_fund: toNumber(fv.summerEconomicFund),
      local_levy: toNumber(fv.localLevy),
      internal_drainage_boards: toNumber(fv.internalDrainageBoards),
      public_contributions: filterContributors('public'),
      private_contributions: filterContributors('private'),
      other_ea_contributions: filterContributors('other_ea'),
      not_yet_identified: toNumber(fv.notYetIdentified)
    }
  })
}

// ---------------------------------------------------------------------------
// S3 shapefile helper
// ---------------------------------------------------------------------------

/**
 * Fetch the benefit area shapefile from S3 and return it as a base64 string.
 * Returns null if the project has no shapefile or the S3 coordinates are missing.
 *
 * @param {Object} project - Enriched project (must have benefitAreaFileName,
 *   benefitAreaFileS3Bucket, benefitAreaFileS3Key)
 * @param {Object} logger
 * @returns {Promise<string|null>}
 */
export async function fetchShapefileBase64(project, logger) {
  if (!project.benefitAreaFileName) {
    return null
  }
  if (!project.benefitAreaFileS3Bucket || !project.benefitAreaFileS3Key) {
    logger.warn(
      { referenceNumber: project.referenceNumber },
      'Shapefile filename present but S3 coordinates missing — skipping base64 encode'
    )
    return null
  }
  const s3Service = getS3Service(logger)
  const buffer = await s3Service.getObject(
    project.benefitAreaFileS3Bucket,
    project.benefitAreaFileS3Key
  )
  return buffer.toString('base64')
}
