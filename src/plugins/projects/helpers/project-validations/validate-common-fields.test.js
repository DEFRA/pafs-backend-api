import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./validate-project-name.js', () => ({
  validateProjectName: vi.fn().mockResolvedValue(null)
}))

vi.mock('./validate-financial-years.js', () => ({
  validateFinancialYears: vi.fn().mockReturnValue(null)
}))

const { validateCommonFields } = await import('./validate-common-fields.js')
const { validateProjectName } = await import('./validate-project-name.js')
const { validateFinancialYears } = await import('./validate-financial-years.js')

const makeService = () => ({
  checkDuplicateProjectName: vi.fn().mockResolvedValue({ isValid: true })
})
const makeH = () => ({
  response: vi.fn().mockReturnThis(),
  code: vi.fn().mockReturnThis()
})
const makeLogger = () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
})

describe('validateCommonFields', () => {
  let projectService
  let h
  let logger

  beforeEach(() => {
    vi.clearAllMocks()
    projectService = makeService()
    h = makeH()
    logger = makeLogger()
  })

  // ─── Create operations ───────────────────────────────────────────────────

  describe('create operations (no referenceNumber)', () => {
    it('always calls validateProjectName on create', async () => {
      await validateCommonFields(
        projectService,
        {
          name: 'New Project',
          financialStartYear: 2025,
          financialEndYear: 2030
        },
        null,
        1,
        logger,
        h
      )

      expect(validateProjectName).toHaveBeenCalledOnce()
      expect(validateProjectName).toHaveBeenCalledWith(
        projectService,
        'New Project',
        undefined,
        1,
        logger,
        h
      )
    })

    it('returns error when validateProjectName fails on create', async () => {
      const nameError = { output: { statusCode: 409 } }
      validateProjectName.mockResolvedValueOnce(nameError)

      const result = await validateCommonFields(
        projectService,
        { name: 'Duplicate Name' },
        null,
        1,
        logger,
        h
      )

      expect(result.error).toBe(nameError)
    })
  })

  // ─── Update — name unchanged ────────────────────────────────────────────

  describe('update operations — name unchanged (skip DB query)', () => {
    const existingProject = { name: 'My Project' }

    it('skips validateProjectName when name is identical', async () => {
      await validateCommonFields(
        projectService,
        { referenceNumber: 'ABC001A-001A-001A', name: 'My Project' },
        existingProject,
        1,
        logger,
        h
      )

      expect(validateProjectName).not.toHaveBeenCalled()
    })

    it('skips validateProjectName when name differs only in leading/trailing whitespace', async () => {
      await validateCommonFields(
        projectService,
        { referenceNumber: 'ABC001A-001A-001A', name: '  My Project  ' },
        existingProject,
        1,
        logger,
        h
      )

      expect(validateProjectName).not.toHaveBeenCalled()
    })

    it('skips validateProjectName when name differs only in internal whitespace', async () => {
      await validateCommonFields(
        projectService,
        { referenceNumber: 'ABC001A-001A-001A', name: 'My  Project' },
        existingProject,
        1,
        logger,
        h
      )

      expect(validateProjectName).not.toHaveBeenCalled()
    })

    it('skips validateProjectName when name differs only in case', async () => {
      await validateCommonFields(
        projectService,
        { referenceNumber: 'ABC001A-001A-001A', name: 'MY PROJECT' },
        existingProject,
        1,
        logger,
        h
      )

      expect(validateProjectName).not.toHaveBeenCalled()
    })

    it('skips validateProjectName when name differs only in case and whitespace together', async () => {
      await validateCommonFields(
        projectService,
        { referenceNumber: 'ABC001A-001A-001A', name: '  MY  PROJECT  ' },
        existingProject,
        1,
        logger,
        h
      )

      expect(validateProjectName).not.toHaveBeenCalled()
    })

    it('returns valid when name is unchanged and financial years pass', async () => {
      const result = await validateCommonFields(
        projectService,
        { referenceNumber: 'ABC001A-001A-001A', name: 'My Project' },
        existingProject,
        1,
        logger,
        h
      )

      expect(result).toEqual({ valid: true })
    })
  })

  // ─── Update — name changed ──────────────────────────────────────────────

  describe('update operations — name changed (run DB query)', () => {
    const existingProject = { name: 'Old Name' }

    it('calls validateProjectName when name has genuinely changed', async () => {
      await validateCommonFields(
        projectService,
        { referenceNumber: 'ABC001A-001A-001A', name: 'New Name' },
        existingProject,
        1,
        logger,
        h
      )

      expect(validateProjectName).toHaveBeenCalledOnce()
    })

    it('calls validateProjectName when name changes from something to something else', async () => {
      await validateCommonFields(
        projectService,
        {
          referenceNumber: 'ABC001A-001A-001A',
          name: 'A Completely Different Name'
        },
        existingProject,
        1,
        logger,
        h
      )

      expect(validateProjectName).toHaveBeenCalledOnce()
    })

    it('returns error when updated name is a duplicate', async () => {
      const nameError = { output: { statusCode: 409 } }
      validateProjectName.mockResolvedValueOnce(nameError)

      const result = await validateCommonFields(
        projectService,
        { referenceNumber: 'ABC001A-001A-001A', name: 'Taken Name' },
        existingProject,
        1,
        logger,
        h
      )

      expect(result.error).toBe(nameError)
    })
  })

  // ─── Update — no name in payload ────────────────────────────────────────

  describe('update operations — name absent from payload', () => {
    it('skips validateProjectName when name is undefined', async () => {
      await validateCommonFields(
        projectService,
        { referenceNumber: 'ABC001A-001A-001A' },
        { name: 'Existing' },
        1,
        logger,
        h
      )

      expect(validateProjectName).not.toHaveBeenCalled()
    })

    it('skips validateProjectName when name is null', async () => {
      await validateCommonFields(
        projectService,
        { referenceNumber: 'ABC001A-001A-001A', name: null },
        { name: 'Existing' },
        1,
        logger,
        h
      )

      expect(validateProjectName).not.toHaveBeenCalled()
    })
  })

  // ─── Financial years ────────────────────────────────────────────────────

  describe('financial year validation', () => {
    it('calls validateFinancialYears with correct args', async () => {
      await validateCommonFields(
        projectService,
        {
          referenceNumber: 'ABC001A-001A-001A',
          financialStartYear: 2025,
          financialEndYear: 2030
        },
        { name: 'X' },
        1,
        logger,
        h
      )

      expect(validateFinancialYears).toHaveBeenCalledWith(
        2025,
        2030,
        { name: 'X' },
        1,
        logger,
        h
      )
    })

    it('returns error when financial years fail', async () => {
      const yearError = { output: { statusCode: 422 } }
      validateFinancialYears.mockReturnValueOnce(yearError)

      const result = await validateCommonFields(
        projectService,
        { referenceNumber: 'ABC001A-001A-001A', name: 'X' },
        { name: 'X' },
        1,
        logger,
        h
      )

      expect(result.error).toBe(yearError)
    })

    it('returns valid when both checks pass', async () => {
      const result = await validateCommonFields(
        projectService,
        { referenceNumber: 'ABC001A-001A-001A', name: 'X' },
        { name: 'X' },
        1,
        logger,
        h
      )

      expect(result).toEqual({ valid: true })
    })
  })
})
