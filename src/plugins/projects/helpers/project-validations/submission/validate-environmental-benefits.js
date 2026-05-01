import { PROJECT_VALIDATION_MESSAGES } from '../../../../../common/constants/project.js'
import { ENVIRONMENTAL_BENEFITS_FIELDS } from '../../../../../common/schemas/project/environment-benefits.js'
import { hasValue } from './submission-utils.js'

/**
 * Returns true when the field has been answered with any boolean-equivalent
 * value. Handles actual booleans (Prisma), string variants ('true'/'false'),
 * and form-submitted variants ('yes'/'no'). Excludes null/undefined only.
 */
const isAnswered = (v) =>
  v === true ||
  v === false ||
  v === 'true' ||
  v === 'false' ||
  v === 'yes' ||
  v === 'no'

/**
 * Returns true when the value represents a positive (yes) answer.
 */
const isTrue = (v) => v === true || v === 'true' || v === 'yes'

const INCOMPLETE =
  PROJECT_VALIDATION_MESSAGES.SUBMISSION_ENVIRONMENTAL_BENEFITS_INCOMPLETE

/**
 * Validates the environmental benefits section for submission.
 *
 * - The master gate (environmentalBenefits) must be answered.
 * - When answered yes, each sub-gate must also be answered.
 * - When a sub-gate is answered yes, its paired quantity field must have a value.
 *
 * Returns SUBMISSION_ENVIRONMENTAL_BENEFITS_INCOMPLETE on the first violation,
 * or null when the section is complete.
 */
export const validateEnvironmentalBenefits = (p) => {
  if (!isAnswered(p.environmentalBenefits)) {
    return INCOMPLETE
  }

  if (!isTrue(p.environmentalBenefits)) {
    return null
  }

  for (const { gate, quantity } of ENVIRONMENTAL_BENEFITS_FIELDS) {
    if (!isAnswered(p[gate])) {
      return INCOMPLETE
    }
    if (isTrue(p[gate]) && !hasValue(p[quantity])) {
      return INCOMPLETE
    }
  }

  return null
}
