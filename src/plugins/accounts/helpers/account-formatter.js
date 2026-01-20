export const ACCOUNT_SELECT_FIELDS = {
  id: true,
  email: true,
  first_name: true,
  last_name: true,
  job_title: true,
  organisation: true,
  telephone_number: true,
  status: true,
  admin: true,
  disabled: true,
  created_at: true,
  updated_at: true,
  last_sign_in_at: true,
  invitation_sent_at: true,
  invitation_accepted_at: true,
  pafs_core_user_areas: {
    select: {
      primary: true,
      pafs_core_areas: {
        select: {
          id: true,
          name: true,
          area_type: true,
          parent_id: true
        }
      }
    }
  }
}

export const ACCOUNT_DETAIL_SELECT_FIELDS = {
  ...ACCOUNT_SELECT_FIELDS,
  invitation_sent_at: true,
  invitation_accepted_at: true
}

export function formatArea(userArea) {
  return {
    id: Number(userArea.pafs_core_areas.id),
    areaId: String(userArea.pafs_core_areas.id),
    name: userArea.pafs_core_areas.name,
    type: userArea.pafs_core_areas.area_type,
    parentId: userArea.pafs_core_areas.parent_id
      ? Number(userArea.pafs_core_areas.parent_id)
      : null,
    primary: userArea.primary
  }
}

export function formatAccount(account, options = {}) {
  const { includeInvitationFields = false } = options

  const areas = account.pafs_core_user_areas.map(formatArea)

  const formatted = {
    id: Number(account.id),
    email: account.email,
    firstName: account.first_name,
    lastName: account.last_name,
    jobTitle: account.job_title,
    organisation: account.organisation,
    telephoneNumber: account.telephone_number,
    status: account.status,
    admin: account.admin,
    disabled: account.disabled,
    areas,
    createdAt: account.created_at,
    updatedAt: account.updated_at,
    lastSignIn: account.last_sign_in_at
  }

  // Add invitation fields if requested (for detail view)
  if (includeInvitationFields) {
    formatted.invitationSentAt = account.invitation_sent_at
    formatted.invitationAcceptedAt = account.invitation_accepted_at
  }

  return formatted
}
