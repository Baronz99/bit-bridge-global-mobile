export const formatCircleRoleLabel = (value: unknown) => {
  const normalized = String(value || 'member').trim().toLowerCase()
  if (normalized === 'owner') return 'Creator'
  if (normalized === 'admin') return 'Admin'
  if (normalized === 'treasurer') return 'Treasurer'
  if (normalized === 'member') return 'Member'

  return normalized
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase())
}

export const getCircleRoleLabel = (workspace: Record<string, unknown> | null | undefined) =>
  formatCircleRoleLabel(workspace?.current_user_role || workspace?.role || 'member')
