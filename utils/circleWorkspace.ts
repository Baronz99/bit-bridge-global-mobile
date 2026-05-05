export const asObject = (value: unknown): Record<string, any> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, any>) : {}

export const asArray = (value: unknown): any[] => (Array.isArray(value) ? value : [])

export const extractCirclePayload = (payload: unknown): Record<string, any> => {
  const root = asObject(payload)
  return asObject(root.data && typeof root.data === 'object' && !Array.isArray(root.data) ? root.data : root)
}

export const extractCircleContextPayload = (payload: unknown) => {
  const root = extractCirclePayload(payload)
  return {
    circle: asObject(root.circle),
    balance: asObject(root.balance),
    permissions: asObject(root.permissions),
    dues_summary: asObject(root.dues_summary),
    approvals: asObject(root.approvals),
    recent_activity: asObject(root.recent_activity),
  }
}

export const extractCircleRecentActivity = (payload: unknown): any[] => {
  const root = extractCirclePayload(payload)
  const context = extractCircleContextPayload(root)

  return asArray(context.recent_activity.items).length
    ? asArray(context.recent_activity.items)
    : asArray(root.recent_transactions).length
      ? asArray(root.recent_transactions)
      : asArray(root.transactions).length
        ? asArray(root.transactions)
    : asArray(root.timeline)
}

export const normalizeTreasuryAccount = (payload: unknown): Record<string, any> => {
  const root = extractCirclePayload(payload)
  if (root?.treasury_account && typeof root.treasury_account === 'object' && !Array.isArray(root.treasury_account)) {
    return asObject(root.treasury_account)
  }
  if (root?.account && typeof root.account === 'object' && !Array.isArray(root.account)) {
    return asObject(root.account)
  }
  if (
    root &&
    typeof root === 'object' &&
    !Array.isArray(root) &&
    ('account_number' in root || 'bank_name' in root || 'bank_code' in root)
  ) {
    return root
  }
  return {}
}

const normalizeLegacyDuesSummary = (circle: Record<string, any>) => {
  const plan = asObject(circle.monthly_due_plan)
  if (!Object.keys(plan).length) return { enabled: false }

  return {
    enabled: true,
    ...plan,
  }
}

export const normalizeCircleWorkspace = ({
  circlePayload,
  contextPayload,
  treasuryPayload,
}: {
  circlePayload?: unknown
  contextPayload?: unknown
  treasuryPayload?: unknown
}) => {
  const circle = extractCirclePayload(circlePayload)
  const context = extractCircleContextPayload(contextPayload)
  const treasuryAccount = normalizeTreasuryAccount(treasuryPayload)
  const balance = asObject(context.balance)
  const permissions = asObject(context.permissions)
  const approvals = asObject(context.approvals)
  const duesSummary = Object.keys(asObject(context.dues_summary)).length
    ? context.dues_summary
    : normalizeLegacyDuesSummary(circle)
  const recentItems = extractCircleRecentActivity(contextPayload || circlePayload)
  const treasuryBalanceCents =
    Number.isFinite(Number(treasuryAccount.balance_cents)) ? Number(treasuryAccount.balance_cents || 0) : null
  const contextBalanceCents =
    balance.balance_cents != null ? Number(balance.balance_cents || 0) : null
  const circleBalanceCents =
    circle.balance_cents != null ? Number(circle.balance_cents || 0) : 0
  const resolvedBalanceCents =
    treasuryBalanceCents != null
      ? treasuryBalanceCents
      : contextBalanceCents != null
        ? contextBalanceCents
        : circleBalanceCents

  return {
    ...circle,
    ...context.circle,
    current_user_role:
      context.circle.role ||
      circle.current_user_role ||
      circle.membership_role ||
      circle.role ||
      'member',
    role:
      context.circle.role ||
      circle.role ||
      circle.current_user_role ||
      circle.membership_role ||
      'member',
    member_count:
      Number(context.circle.member_count || circle.member_count || circle.members_count || 0) || 0,
    balance_cents: resolvedBalanceCents,
    treasury_balance_cents: treasuryBalanceCents,
    circle_balance_cents: circleBalanceCents,
    balance_visible: balance.visible != null ? Boolean(balance.visible) : circle.balance_visible !== false,
    withdrawal_requires_approval: Boolean(
      context.circle.withdrawal_requires_approval ?? circle.withdrawal_requires_approval
    ),
    permissions: {
      can_contribute: permissions.can_contribute !== false,
      can_pay_dues: Boolean(permissions.can_pay_dues),
      can_manage_due_plan: Boolean(permissions.can_manage_due_plan),
      can_withdraw: Boolean(permissions.can_withdraw ?? circle.can_withdraw),
      can_approve_withdrawals: Boolean(permissions.can_approve_withdrawals),
      can_invite_members: Boolean(permissions.can_invite_members ?? circle.can_invite),
      can_manage_members: Boolean(permissions.can_manage_members ?? circle.can_invite),
      can_assign_admin: Boolean(permissions.can_assign_admin ?? circle.can_assign_admin),
      can_manage_settings: Boolean(permissions.can_manage_settings ?? circle.can_assign_admin),
      can_manage_governance: Boolean(permissions.can_manage_governance ?? circle.can_assign_admin),
      can_view_reports: Boolean(permissions.can_view_reports),
      can_view_balance: balance.visible != null ? Boolean(balance.visible) : circle.balance_visible !== false,
    },
    dues_summary: duesSummary,
    monthly_due_plan: duesSummary.enabled ? duesSummary : circle.monthly_due_plan || null,
    approvals,
    recent_activity: {
      ...context.recent_activity,
      items: recentItems,
    },
    recent_transactions: recentItems,
  }
}
