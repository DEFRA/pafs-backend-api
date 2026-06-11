import { validateProjectName } from './validate-project-name.js'
import { validateFinancialYears } from './validate-financial-years.js'

/**
 * Returns true when the submitted name is unchanged from the stored name.
 * Mirrors the normalisation in ProjectService._buildNameWhereClause so that
 * leading/trailing whitespace and runs of internal spaces are treated as
 * equivalent, and the comparison is case-insensitive.
 *
 * When the name is unchanged the duplicate-name DB query will always return
 * zero rows (the only matching record is the current project, which the query
 * already excludes via `reference_number != $ref`). Skipping it saves one
 * DB round-trip per update step and reduces connection pool pressure under load.
 */
function isNameUnchanged(name, existingProject) {
  if (!existingProject?.name || !name) {
    return false
  }
  const normalize = (s) => s.trim().replaceAll(/\s+/g, ' ').toLowerCase()
  return normalize(name) === normalize(existingProject.name)
}

/**
 * Validates common fields for both create and update operations
 */
export const validateCommonFields = async (
  projectService,
  proposalPayload,
  existingProject,
  userId,
  logger,
  h
) => {
  const { referenceNumber, name, financialStartYear, financialEndYear } =
    proposalPayload
  const isCreate = !referenceNumber

  // Validate project name uniqueness — always for create; for updates only when
  // the name has actually changed (skipping saves a DB query when the user is
  // editing a later step and the name is carried along unchanged).
  if ((isCreate || name) && !isNameUnchanged(name, existingProject)) {
    const nameError = await validateProjectName(
      projectService,
      name,
      referenceNumber,
      userId,
      logger,
      h
    )
    if (nameError) {
      return { error: nameError }
    }
  }

  // Validate financial years
  const financialYearsError = validateFinancialYears(
    financialStartYear,
    financialEndYear,
    existingProject,
    userId,
    logger,
    h
  )
  if (financialYearsError) {
    return { error: financialYearsError }
  }

  return { valid: true }
}
