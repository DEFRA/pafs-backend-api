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
  last_sign_in_at: true
}

export const ACCOUNT_DETAIL_SELECT_FIELDS = {
  ...ACCOUNT_SELECT_FIELDS,
  invitation_sent_at: true,
  invitation_accepted_at: true
}

/**
 * Format a raw area row (joined from pafs_core_user_areas + pafs_core_areas) into
 * the shape expected by the accounts API response.
 * @param {{ id: BigInt, name: string, area_type: string, parent_id: BigInt|null, primary: boolean }} area
 */
export function formatArea({
  id,
  name,
  area_type: areaType,
  parent_id: parentIdRaw,
  primary
}) {
  const idNum = Number(id)
  return {
    id: idNum,
    areaId: String(idNum),
    name,
    type: areaType,
    parentId: parentIdRaw ? Number(parentIdRaw) : null,
    primary: Boolean(primary)
  }
}

export function formatAccount(account, areas = [], options = {}) {
  const { includeInvitationFields = false } = options

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
    areas: areas.map(formatArea),
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
