import { describe, test, expect } from 'vitest'
import { PROJECT_VALIDATION_MESSAGES } from '../../../../../common/constants/project.js'
import { ENVIRONMENTAL_BENEFITS_FIELDS } from '../../../../../common/schemas/project/environment-benefits.js'
import { validateEnvironmentalBenefits } from './validate-environmental-benefits.js'

const { SUBMISSION_ENVIRONMENTAL_BENEFITS_INCOMPLETE } =
  PROJECT_VALIDATION_MESSAGES

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Project with env benefits answered 'no' — the simplest passing state.
 * No sub-gate or quantity fields are required when the master gate is false.
 */
const noEnvProject = (overrides = {}) => ({
  environmentalBenefits: false,
  ...overrides
})

/**
 * Project with env benefits = true, all 11 sub-gates answered false.
 * All sub-gates answered no → no quantity fields required → section complete.
 */
const allGatesFalseProject = (overrides = {}) => ({
  environmentalBenefits: true,
  ...Object.fromEntries(
    ENVIRONMENTAL_BENEFITS_FIELDS.map(({ gate }) => [gate, false])
  ),
  ...overrides
})

/**
 * Project with env benefits = true, all sub-gates = true, all quantities present.
 * Every possible path is complete.
 */
const allGatesTrueProject = (overrides = {}) => ({
  environmentalBenefits: true,
  ...Object.fromEntries(
    ENVIRONMENTAL_BENEFITS_FIELDS.map(({ gate }) => [gate, true])
  ),
  ...Object.fromEntries(
    ENVIRONMENTAL_BENEFITS_FIELDS.map(({ quantity }) => [quantity, 1.0])
  ),
  ...overrides
})

// Shorthand for the first gate/quantity pair — used for per-gate tests
const FIRST_GATE = ENVIRONMENTAL_BENEFITS_FIELDS[0].gate
const FIRST_QUANTITY = ENVIRONMENTAL_BENEFITS_FIELDS[0].quantity

// ─── ENVIRONMENTAL_BENEFITS_FIELDS ────────────────────────────────────────────

describe('ENVIRONMENTAL_BENEFITS_FIELDS', () => {
  test('contains 11 entries', () => {
    expect(ENVIRONMENTAL_BENEFITS_FIELDS).toHaveLength(11)
  })

  test('each entry has gate and quantity fields', () => {
    for (const entry of ENVIRONMENTAL_BENEFITS_FIELDS) {
      expect(entry).toHaveProperty('gate')
      expect(entry).toHaveProperty('quantity')
      expect(typeof entry.gate).toBe('string')
      expect(typeof entry.quantity).toBe('string')
    }
  })
})

// ─── Master gate (environmentalBenefits) ──────────────────────────────────────

describe('master gate — environmentalBenefits', () => {
  test('returns INCOMPLETE when environmentalBenefits is null', () => {
    expect(
      validateEnvironmentalBenefits(
        noEnvProject({ environmentalBenefits: null })
      )
    ).toBe(SUBMISSION_ENVIRONMENTAL_BENEFITS_INCOMPLETE)
  })

  test('returns INCOMPLETE when environmentalBenefits is undefined', () => {
    expect(
      validateEnvironmentalBenefits(
        noEnvProject({ environmentalBenefits: undefined })
      )
    ).toBe(SUBMISSION_ENVIRONMENTAL_BENEFITS_INCOMPLETE)
  })

  test('returns null when environmentalBenefits is false', () => {
    expect(
      validateEnvironmentalBenefits(
        noEnvProject({ environmentalBenefits: false })
      )
    ).toBeNull()
  })

  test('returns null when environmentalBenefits is "no"', () => {
    expect(
      validateEnvironmentalBenefits(
        noEnvProject({ environmentalBenefits: 'no' })
      )
    ).toBeNull()
  })

  test('returns null when environmentalBenefits is "false"', () => {
    expect(
      validateEnvironmentalBenefits(
        noEnvProject({ environmentalBenefits: 'false' })
      )
    ).toBeNull()
  })

  test('returns null when environmentalBenefits is true and all gates answered false', () => {
    expect(validateEnvironmentalBenefits(allGatesFalseProject())).toBeNull()
  })

  test('returns null when environmentalBenefits is "yes" and all gates answered false', () => {
    expect(
      validateEnvironmentalBenefits(
        allGatesFalseProject({ environmentalBenefits: 'yes' })
      )
    ).toBeNull()
  })

  test('returns null when environmentalBenefits is "true" and all gates answered false', () => {
    expect(
      validateEnvironmentalBenefits(
        allGatesFalseProject({ environmentalBenefits: 'true' })
      )
    ).toBeNull()
  })
})

// ─── Sub-gate validation (when master gate is true) ───────────────────────────

describe('sub-gate validation (when environmentalBenefits is true)', () => {
  test('returns null when all 11 sub-gates are answered false', () => {
    expect(validateEnvironmentalBenefits(allGatesFalseProject())).toBeNull()
  })

  test('returns INCOMPLETE when the first sub-gate is null', () => {
    expect(
      validateEnvironmentalBenefits(
        allGatesFalseProject({ [FIRST_GATE]: null })
      )
    ).toBe(SUBMISSION_ENVIRONMENTAL_BENEFITS_INCOMPLETE)
  })

  test('returns INCOMPLETE when the first sub-gate is undefined', () => {
    const project = allGatesFalseProject()
    delete project[FIRST_GATE]
    expect(validateEnvironmentalBenefits(project)).toBe(
      SUBMISSION_ENVIRONMENTAL_BENEFITS_INCOMPLETE
    )
  })

  test('stops at the first unanswered sub-gate and returns INCOMPLETE', () => {
    // Second gate unanswered while first is valid
    const secondGate = ENVIRONMENTAL_BENEFITS_FIELDS[1].gate
    expect(
      validateEnvironmentalBenefits(
        allGatesFalseProject({ [secondGate]: null })
      )
    ).toBe(SUBMISSION_ENVIRONMENTAL_BENEFITS_INCOMPLETE)
  })

  test('does not return error when sub-gate is answered false (no quantity needed)', () => {
    expect(
      validateEnvironmentalBenefits(
        allGatesFalseProject({ [FIRST_GATE]: false })
      )
    ).toBeNull()
  })

  test('accepts "false" string as a valid negative answer for a sub-gate', () => {
    expect(
      validateEnvironmentalBenefits(
        allGatesFalseProject({ [FIRST_GATE]: 'false' })
      )
    ).toBeNull()
  })
})

// ─── Quantity validation (when a sub-gate is true) ────────────────────────────

describe('quantity validation (when a sub-gate is true)', () => {
  test('returns null when gate is true and quantity has a positive value', () => {
    expect(
      validateEnvironmentalBenefits(
        allGatesFalseProject({
          [FIRST_GATE]: true,
          [FIRST_QUANTITY]: 5.25
        })
      )
    ).toBeNull()
  })

  test('returns INCOMPLETE when gate is true but quantity is null', () => {
    expect(
      validateEnvironmentalBenefits(
        allGatesFalseProject({
          [FIRST_GATE]: true,
          [FIRST_QUANTITY]: null
        })
      )
    ).toBe(SUBMISSION_ENVIRONMENTAL_BENEFITS_INCOMPLETE)
  })

  test('returns INCOMPLETE when gate is true but quantity is undefined', () => {
    expect(
      validateEnvironmentalBenefits(
        allGatesFalseProject({ [FIRST_GATE]: true })
      )
    ).toBe(SUBMISSION_ENVIRONMENTAL_BENEFITS_INCOMPLETE)
  })

  test('returns INCOMPLETE when gate is true but quantity is empty string', () => {
    expect(
      validateEnvironmentalBenefits(
        allGatesFalseProject({
          [FIRST_GATE]: true,
          [FIRST_QUANTITY]: ''
        })
      )
    ).toBe(SUBMISSION_ENVIRONMENTAL_BENEFITS_INCOMPLETE)
  })

  test('returns null when gate is true and quantity is 0', () => {
    // Zero is a valid (present) value — the Joi schema handles minimum checks
    expect(
      validateEnvironmentalBenefits(
        allGatesFalseProject({
          [FIRST_GATE]: true,
          [FIRST_QUANTITY]: 0
        })
      )
    ).toBeNull()
  })

  test('does not check quantity when gate is false', () => {
    // Gate false + no quantity → no error (quantity not required)
    expect(
      validateEnvironmentalBenefits(
        allGatesFalseProject({
          [FIRST_GATE]: false,
          [FIRST_QUANTITY]: null
        })
      )
    ).toBeNull()
  })

  test('accepts "true" string as a positive gate answer and requires quantity', () => {
    expect(
      validateEnvironmentalBenefits(
        allGatesFalseProject({
          [FIRST_GATE]: 'true',
          [FIRST_QUANTITY]: null
        })
      )
    ).toBe(SUBMISSION_ENVIRONMENTAL_BENEFITS_INCOMPLETE)
  })

  test('accepts "true" string as positive gate and passes when quantity is present', () => {
    expect(
      validateEnvironmentalBenefits(
        allGatesFalseProject({
          [FIRST_GATE]: 'true',
          [FIRST_QUANTITY]: 10.0
        })
      )
    ).toBeNull()
  })
})

// ─── Interaction between multiple sub-gates ───────────────────────────────────

describe('multiple sub-gates', () => {
  test('returns null when all 11 sub-gates are true with all quantities present', () => {
    expect(validateEnvironmentalBenefits(allGatesTrueProject())).toBeNull()
  })

  test('returns INCOMPLETE for a gate in the middle missing its quantity', () => {
    const midField = ENVIRONMENTAL_BENEFITS_FIELDS[5]
    expect(
      validateEnvironmentalBenefits(
        allGatesTrueProject({ [midField.quantity]: null })
      )
    ).toBe(SUBMISSION_ENVIRONMENTAL_BENEFITS_INCOMPLETE)
  })

  test('returns INCOMPLETE for the last sub-gate missing its quantity', () => {
    const last = ENVIRONMENTAL_BENEFITS_FIELDS.at(-1)
    expect(
      validateEnvironmentalBenefits(
        allGatesTrueProject({ [last.quantity]: null })
      )
    ).toBe(SUBMISSION_ENVIRONMENTAL_BENEFITS_INCOMPLETE)
  })

  test('returns INCOMPLETE for the last sub-gate unanswered', () => {
    const last = ENVIRONMENTAL_BENEFITS_FIELDS.at(-1)
    expect(
      validateEnvironmentalBenefits(allGatesTrueProject({ [last.gate]: null }))
    ).toBe(SUBMISSION_ENVIRONMENTAL_BENEFITS_INCOMPLETE)
  })

  test('stops at the first failing gate without checking subsequent gates', () => {
    // Third gate missing; fourth gate also has no quantity — only one error returned
    const third = ENVIRONMENTAL_BENEFITS_FIELDS[2]
    const fourth = ENVIRONMENTAL_BENEFITS_FIELDS[3]
    const project = allGatesTrueProject({
      [third.gate]: null,
      [fourth.quantity]: null
    })
    expect(validateEnvironmentalBenefits(project)).toBe(
      SUBMISSION_ENVIRONMENTAL_BENEFITS_INCOMPLETE
    )
  })
})
