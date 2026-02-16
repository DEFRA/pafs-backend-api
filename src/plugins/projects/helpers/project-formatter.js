// Useful for Prisma select fields but RAW Query has been used instead
export const PROJECT_SELECT_FIELDS = {
  id: true,
  reference_number: true,
  name: true,
  rma_name: true,
  created_at: true,
  updated_at: true,
  submitted_at: true
}

export function formatProject(project, state = null) {
  const formatted = {
    id: Number(project.id),
    referenceNumber: project.reference_number,
    referenceNumberFormatted: project.slug,
    name: project.name,
    rmaName: project.rma_name,
    status: state || 'draft',
    createdAt: project.created_at,
    updatedAt: project.updated_at,
    submittedAt: project.submitted_at
  }

  return formatted
}
