import { describe, test, expect, vi, beforeEach } from 'vitest'
import { enrichProjectResponse } from './project-enricher.js'

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('./benefit-area-file-helper.js', () => ({
  generateDownloadUrl: vi.fn(),
  updateBenefitAreaDownloadUrl: vi.fn()
}))

vi.mock('./legacy-file-resolver.js', () => ({
  buildLegacyS3Key: vi.fn()
}))

vi.mock('../../../config.js', () => ({
  config: { get: vi.fn() }
}))

vi.mock('./area-hierarchy.js', () => ({
  resolveAreaHierarchy: vi.fn()
}))

vi.mock('./project-formatter.js', () => ({
  resolveStatus: vi.fn()
}))

vi.mock('../../../common/constants/project.js', () => ({
  URGENCY_REASONS: {
    NOT_URGENT: 'not_urgent',
    STATUTORY_NEED: 'statutory_need',
    LEGAL_NEED: 'legal_need',
    HEALTH_AND_SAFETY: 'health_and_safety',
    EMERGENCY_WORKS: 'emergency_works',
    TIME_LIMITED: 'time_limited'
  },
  URGENCY_CODES: {
    statutory_need: 'BS',
    legal_need: 'BL',
    health_and_safety: 'HS',
    emergency_works: 'EM',
    time_limited: 'TL'
  }
}))

import { resolveAreaHierarchy } from './area-hierarchy.js'
import { resolveStatus } from './project-formatter.js'
import {
  generateDownloadUrl,
  updateBenefitAreaDownloadUrl
} from './benefit-area-file-helper.js'
import { buildLegacyS3Key } from './legacy-file-resolver.js'
import { config } from '../../../config.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const buildPrisma = () => ({ pafs_core_areas: { findFirst: vi.fn() } })

const buildRawProject = (overrides = {}) => ({
  id: 1,
  reference_number: 'ANC501E/000A/001A',
  rma_name: 'Test RMA',
  pafs_core_area_projects: { area_id: 10 },
  ...overrides
})

const buildApiData = (overrides = {}) => ({
  slug: 'ANC501E-000A-001A',
  rmaName: 'Test RMA',
  urgencyReason: 'not_urgent',
  projectState: 'draft',
  isLegacy: false,
  isRevised: false,
  ...overrides
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('enrichProjectResponse', () => {
  let prisma

  beforeEach(() => {
    vi.clearAllMocks()
    prisma = buildPrisma()

    // Default mock behaviour for area hierarchy
    resolveAreaHierarchy.mockResolvedValue({
      rmaName: 'Resolved RMA',
      psoName: 'Yorkshire RFCC',
      rfccName: 'Yorkshire RFCC',
      eaAreaName: 'North East'
    })

    // Default mock for resolveStatus (identity pass-through)
    resolveStatus.mockImplementation((state) => state)

    // Default mocks for benefit area / funding calculator URL enrichment
    generateDownloadUrl.mockResolvedValue({
      downloadUrl: 'https://mock-signed.example.com/file.zip',
      downloadExpiry: new Date('2099-01-01T00:00:00.000Z')
    })
    updateBenefitAreaDownloadUrl.mockResolvedValue(undefined)
    buildLegacyS3Key.mockReturnValue('legacy/SLUG/1/calc.xlsx')
    config.get.mockReturnValue('mock-s3-bucket')
  })

  // ---------------------------------------------------------------------------
  // enrichAreaHierarchy step
  // ---------------------------------------------------------------------------

  describe('enrichAreaHierarchy', () => {
    test('Should attach area hierarchy fields to apiData', async () => {
      const raw = buildRawProject()
      const api = buildApiData({ rmaName: null })

      await enrichProjectResponse(prisma, raw, api)

      expect(api.psoName).toBe('Yorkshire RFCC')
      expect(api.rfccName).toBe('Yorkshire RFCC')
      expect(api.eaAreaName).toBe('North East')
    })

    test('Should call resolveAreaHierarchy with area_id from pafs_core_area_projects', async () => {
      const raw = buildRawProject({ pafs_core_area_projects: { area_id: 99 } })
      const api = buildApiData()

      await enrichProjectResponse(prisma, raw, api)

      expect(resolveAreaHierarchy).toHaveBeenCalledWith(prisma, 99)
    })

    test('Should call resolveAreaHierarchy with null when pafs_core_area_projects is absent', async () => {
      const raw = buildRawProject({ pafs_core_area_projects: undefined })
      const api = buildApiData()

      await enrichProjectResponse(prisma, raw, api)

      expect(resolveAreaHierarchy).toHaveBeenCalledWith(prisma, null)
    })

    test('Should use hierarchy rmaName as fallback when apiData.rmaName is falsy', async () => {
      resolveAreaHierarchy.mockResolvedValue({
        rmaName: 'Hierarchy RMA',
        psoName: null,
        rfccName: null,
        eaAreaName: null
      })

      const raw = buildRawProject({ rma_name: null })
      const api = buildApiData({ rmaName: null })

      await enrichProjectResponse(prisma, raw, api)

      expect(api.rmaName).toBe('Hierarchy RMA')
    })

    test('Should keep existing apiData.rmaName when already set', async () => {
      resolveAreaHierarchy.mockResolvedValue({
        rmaName: 'Hierarchy RMA',
        psoName: null,
        rfccName: null,
        eaAreaName: null
      })

      const raw = buildRawProject({ rma_name: 'Original RMA' })
      const api = buildApiData({ rmaName: 'Original RMA' })

      await enrichProjectResponse(prisma, raw, api)

      expect(api.rmaName).toBe('Original RMA')
    })

    test('Should backfill rma_name on rawProject when rma_name is empty and hierarchy provides it', async () => {
      resolveAreaHierarchy.mockResolvedValue({
        rmaName: 'From Hierarchy',
        psoName: null,
        rfccName: null,
        eaAreaName: null
      })

      const raw = buildRawProject({ rma_name: null })
      const api = buildApiData({ rmaName: null })

      await enrichProjectResponse(prisma, raw, api)

      expect(raw.rma_name).toBe('From Hierarchy')
    })

    test('Should set null area fields when hierarchy returns all nulls', async () => {
      resolveAreaHierarchy.mockResolvedValue({
        rmaName: null,
        psoName: null,
        rfccName: null,
        eaAreaName: null
      })

      const raw = buildRawProject()
      const api = buildApiData({ rmaName: null })

      await enrichProjectResponse(prisma, raw, api)

      expect(api.psoName).toBeNull()
      expect(api.rfccName).toBeNull()
      expect(api.eaAreaName).toBeNull()
    })
  })

  // ---------------------------------------------------------------------------
  // enrichModerationFilename step
  // ---------------------------------------------------------------------------

  describe('enrichModerationFilename', () => {
    test('Should set moderationFilename to null for not_urgent projects', async () => {
      const raw = buildRawProject()
      const api = buildApiData({ urgencyReason: 'not_urgent' })

      await enrichProjectResponse(prisma, raw, api)

      expect(api.moderationFilename).toBeNull()
    })

    test('Should set moderationFilename to null when urgencyReason is absent', async () => {
      const raw = buildRawProject()
      const api = buildApiData({ urgencyReason: undefined })

      await enrichProjectResponse(prisma, raw, api)

      expect(api.moderationFilename).toBeNull()
    })

    test('Should build filename with BS code for statutory_need', async () => {
      const raw = buildRawProject()
      const api = buildApiData({
        slug: 'ANC501E-000A-001A',
        urgencyReason: 'statutory_need'
      })

      await enrichProjectResponse(prisma, raw, api)

      expect(api.moderationFilename).toBe('ANC501E-000A-001A_moderation_BS.txt')
    })

    test('Should build filename with BL code for legal_need', async () => {
      const raw = buildRawProject()
      const api = buildApiData({
        slug: 'TEST-REF',
        urgencyReason: 'legal_need'
      })

      await enrichProjectResponse(prisma, raw, api)

      expect(api.moderationFilename).toBe('TEST-REF_moderation_BL.txt')
    })

    test('Should build filename with HS code for health_and_safety', async () => {
      const raw = buildRawProject()
      const api = buildApiData({
        slug: 'MY-SLUG',
        urgencyReason: 'health_and_safety'
      })

      await enrichProjectResponse(prisma, raw, api)

      expect(api.moderationFilename).toBe('MY-SLUG_moderation_HS.txt')
    })

    test('Should build filename with EM code for emergency_works', async () => {
      const raw = buildRawProject()
      const api = buildApiData({ slug: 'S1', urgencyReason: 'emergency_works' })

      await enrichProjectResponse(prisma, raw, api)

      expect(api.moderationFilename).toBe('S1_moderation_EM.txt')
    })

    test('Should build filename with TL code for time_limited', async () => {
      const raw = buildRawProject()
      const api = buildApiData({
        slug: 'TLP-001',
        urgencyReason: 'time_limited'
      })

      await enrichProjectResponse(prisma, raw, api)

      expect(api.moderationFilename).toBe('TLP-001_moderation_TL.txt')
    })

    test('Should use UNK code for an unknown urgency reason', async () => {
      const raw = buildRawProject()
      const api = buildApiData({ slug: 'X', urgencyReason: 'unknown_reason' })

      await enrichProjectResponse(prisma, raw, api)

      expect(api.moderationFilename).toBe('X_moderation_UNK.txt')
    })

    test('Should uppercase the slug in the filename', async () => {
      const raw = buildRawProject()
      const api = buildApiData({
        slug: 'anc501e-000a-001a',
        urgencyReason: 'statutory_need'
      })

      await enrichProjectResponse(prisma, raw, api)

      expect(api.moderationFilename).toBe('ANC501E-000A-001A_moderation_BS.txt')
    })

    test('Should handle null slug gracefully (empty prefix)', async () => {
      const raw = buildRawProject()
      const api = buildApiData({ slug: null, urgencyReason: 'statutory_need' })

      await enrichProjectResponse(prisma, raw, api)

      expect(api.moderationFilename).toBe('_moderation_BS.txt')
    })
  })

  // ---------------------------------------------------------------------------
  // enrichProjectStatus step
  // ---------------------------------------------------------------------------

  describe('enrichProjectStatus', () => {
    test('Should call resolveStatus with projectState, isLegacy, and isRevised', async () => {
      resolveStatus.mockReturnValue('resolved-state')

      const raw = buildRawProject()
      const api = buildApiData({
        projectState: 'draft',
        isLegacy: true,
        isRevised: false
      })

      await enrichProjectResponse(prisma, raw, api)

      expect(resolveStatus).toHaveBeenCalledWith('draft', true, false)
      expect(api.projectState).toBe('resolved-state')
    })

    test('Should default isLegacy and isRevised to false when undefined', async () => {
      resolveStatus.mockReturnValue('draft')

      const raw = buildRawProject()
      const api = buildApiData({
        projectState: 'draft',
        isLegacy: undefined,
        isRevised: undefined
      })

      await enrichProjectResponse(prisma, raw, api)

      expect(resolveStatus).toHaveBeenCalledWith('draft', false, false)
    })
  })

  // ---------------------------------------------------------------------------
  // Pipeline ordering
  // ---------------------------------------------------------------------------

  describe('ENRICHMENT_STEPS pipeline', () => {
    test('Should run all enrichment steps when called', async () => {
      resolveAreaHierarchy.mockResolvedValue({
        rmaName: 'Area',
        psoName: 'RFCC',
        rfccName: 'RFCC',
        eaAreaName: 'EA'
      })
      resolveStatus.mockReturnValue('submitted')

      const raw = buildRawProject()
      const api = buildApiData({
        urgencyReason: 'statutory_need',
        slug: 'MY-SLUG',
        projectState: 'submitted',
        isLegacy: false,
        isRevised: false,
        rmaName: null
      })

      await enrichProjectResponse(prisma, raw, api)

      // Area hierarchy step ran
      expect(api.eaAreaName).toBe('EA')
      // Moderation filename step ran
      expect(api.moderationFilename).toBe('MY-SLUG_moderation_BS.txt')
      // Status step ran
      expect(resolveStatus).toHaveBeenCalled()
    })

    test('Should mutate apiData in place and not return a value', async () => {
      const raw = buildRawProject()
      const api = buildApiData()

      const returnValue = await enrichProjectResponse(prisma, raw, api)

      expect(returnValue).toBeUndefined()
    })
  })

  // ---------------------------------------------------------------------------
  // enrichBenefitAreaDownloadUrl step
  // ---------------------------------------------------------------------------

  describe('enrichBenefitAreaDownloadUrl', () => {
    test('Should skip entirely when benefit_area_file_name is absent', async () => {
      const raw = buildRawProject({ benefit_area_file_name: null })
      const api = buildApiData()

      await enrichProjectResponse(prisma, raw, api)

      expect(generateDownloadUrl).not.toHaveBeenCalled()
      expect(api.benefitAreaFileDownloadUrl).toBeUndefined()
    })

    test('Should use cached URL when unexpired and not call S3', async () => {
      const futureExpiry = new Date(Date.now() + 60 * 60 * 1000) // 1 hour from now
      const raw = buildRawProject({
        benefit_area_file_name: 'map.zip',
        benefit_area_file_download_url: 'https://cached.example.com/map.zip',
        benefit_area_file_download_expiry: futureExpiry
      })
      const api = buildApiData()

      await enrichProjectResponse(prisma, raw, api)

      expect(generateDownloadUrl).not.toHaveBeenCalled()
      expect(updateBenefitAreaDownloadUrl).not.toHaveBeenCalled()
      expect(api.benefitAreaFileDownloadUrl).toBe(
        'https://cached.example.com/map.zip'
      )
      expect(api.benefitAreaFileDownloadExpiry).toBe(futureExpiry)
    })

    test('Should regenerate URL when cached URL has expired', async () => {
      const pastExpiry = new Date(Date.now() - 1000) // 1 second ago
      const raw = buildRawProject({
        reference_number: 'ANC501E/000A/001A',
        benefit_area_file_name: 'map.zip',
        benefit_area_file_s3_bucket: 'my-bucket',
        benefit_area_file_s3_key: 'uploads/map.zip',
        benefit_area_file_download_url: 'https://stale.example.com/map.zip',
        benefit_area_file_download_expiry: pastExpiry
      })
      const api = buildApiData()

      await enrichProjectResponse(prisma, raw, api)

      expect(generateDownloadUrl).toHaveBeenCalledWith(
        'my-bucket',
        'uploads/map.zip',
        undefined, // logger — not passed in these tests
        'map.zip'
      )
      expect(updateBenefitAreaDownloadUrl).toHaveBeenCalledWith(
        prisma,
        'ANC501E/000A/001A',
        {
          downloadUrl: 'https://mock-signed.example.com/file.zip',
          downloadExpiry: expect.any(Date)
        }
      )
      expect(api.benefitAreaFileDownloadUrl).toBe(
        'https://mock-signed.example.com/file.zip'
      )
    })

    test('Should regenerate URL when no cached URL exists', async () => {
      const raw = buildRawProject({
        reference_number: 'ANC501E/000A/001A',
        benefit_area_file_name: 'map.zip',
        benefit_area_file_s3_bucket: 'my-bucket',
        benefit_area_file_s3_key: 'uploads/map.zip',
        benefit_area_file_download_url: null,
        benefit_area_file_download_expiry: null
      })
      const api = buildApiData()

      await enrichProjectResponse(prisma, raw, api)

      expect(generateDownloadUrl).toHaveBeenCalledOnce()
      expect(api.benefitAreaFileDownloadUrl).toBe(
        'https://mock-signed.example.com/file.zip'
      )
    })

    test('Should attach downloadExpiry to apiData after regeneration', async () => {
      const freshExpiry = new Date('2099-01-01T00:00:00.000Z')
      generateDownloadUrl.mockResolvedValue({
        downloadUrl: 'https://new.example.com/file.zip',
        downloadExpiry: freshExpiry
      })
      const raw = buildRawProject({
        benefit_area_file_name: 'map.zip',
        benefit_area_file_s3_bucket: 'bucket',
        benefit_area_file_s3_key: 'key',
        benefit_area_file_download_url: null,
        benefit_area_file_download_expiry: null
      })
      const api = buildApiData()

      await enrichProjectResponse(prisma, raw, api)

      expect(api.benefitAreaFileDownloadExpiry).toBe(freshExpiry)
    })
  })

  // ---------------------------------------------------------------------------
  // enrichFundingCalculatorDownloadUrl step
  // ---------------------------------------------------------------------------

  describe('enrichFundingCalculatorDownloadUrl', () => {
    test('Should skip for non-legacy projects', async () => {
      const raw = buildRawProject({
        is_legacy: false,
        funding_calculator_file_name: 'calc.xlsx'
      })
      const api = buildApiData()

      await enrichProjectResponse(prisma, raw, api)

      expect(generateDownloadUrl).not.toHaveBeenCalled()
      expect(api.fundingCalculatorDownloadUrl).toBeUndefined()
    })

    test('Should skip when legacy project has no funding calculator file', async () => {
      const raw = buildRawProject({
        is_legacy: true,
        funding_calculator_file_name: null
      })
      const api = buildApiData()

      await enrichProjectResponse(prisma, raw, api)

      expect(generateDownloadUrl).not.toHaveBeenCalled()
      expect(api.fundingCalculatorDownloadUrl).toBeUndefined()
    })

    test('Should generate presigned URL for legacy project with funding calculator', async () => {
      config.get.mockReturnValue('test-bucket')
      buildLegacyS3Key.mockReturnValue('legacy/SLUG/1/calc.xlsx')
      generateDownloadUrl.mockResolvedValue({
        downloadUrl: 'https://mock-signed.example.com/calc.xlsx',
        downloadExpiry: new Date('2099-01-01T00:00:00.000Z')
      })

      const raw = buildRawProject({
        is_legacy: true,
        slug: 'ANC501E-000A-001A',
        version: 1,
        funding_calculator_file_name: 'calc.xlsx'
      })
      const api = buildApiData()

      await enrichProjectResponse(prisma, raw, api)

      expect(config.get).toHaveBeenCalledWith('cdpUploader.s3Bucket')
      expect(buildLegacyS3Key).toHaveBeenCalledWith(
        'ANC501E-000A-001A',
        1,
        'calc.xlsx'
      )
      expect(generateDownloadUrl).toHaveBeenCalledWith(
        'test-bucket',
        'legacy/SLUG/1/calc.xlsx',
        undefined, // logger — not passed in these tests
        'calc.xlsx'
      )
      expect(api.fundingCalculatorDownloadUrl).toBe(
        'https://mock-signed.example.com/calc.xlsx'
      )
    })

    test('Should NOT write the URL to DB (no updateBenefitAreaDownloadUrl call)', async () => {
      const raw = buildRawProject({
        is_legacy: true,
        slug: 'ANC501E-000A-001A',
        version: 1,
        funding_calculator_file_name: 'calc.xlsx'
      })
      const api = buildApiData()

      await enrichProjectResponse(prisma, raw, api)

      expect(updateBenefitAreaDownloadUrl).not.toHaveBeenCalled()
    })
  })
})
