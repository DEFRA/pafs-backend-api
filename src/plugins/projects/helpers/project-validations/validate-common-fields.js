import { validateProjectName } from './validate-project-name.js'
import { validateFinancialYears } from './validate-financial-years.js'

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

  // Validate project name uniqueness (always for create, only when name present for update)
  if (isCreate || name) {
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
