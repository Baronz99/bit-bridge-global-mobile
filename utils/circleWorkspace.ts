import moneyFormat from '@/utils/moneyFormat'

export const asObject = (value: unknown): Record<string, any> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, any>) : {}

export const asArray = (value: unknown): any[] => (Array.isArray(value) ? value : [])

const pickFirstString = (...values: unknown[]) => {
  for (const value of values) {
    const text = String(value || '').trim()
    if (text) return text
  }
  return ''
}

export const canAccessManageCircle = (workspace: Record<string, any> | null | undefined) => {
  const root = asObject(workspace)
  const permissions = asObject(root.permissions)
  const currentRole = String(root.current_user_role || root.role || '').toLowerCase()

  return Boolean(
    currentRole === 'owner' ||
    currentRole === 'admin' ||
      permissions.can_manage_settings ||
      permissions.can_manage_due_plan ||
      permissions.can_manage_members ||
      permissions.can_manage_governance ||
      permissions.can_approve_withdrawals
  )
}

export const canViewSharedFundTab = (workspace: Record<string, any> | null | undefined) => {
  const root = asObject(workspace)
  const permissions = asObject(root.permissions)
  const currentRole = String(root.current_user_role || root.role || '').toLowerCase()

  if (currentRole === 'owner' || currentRole === 'admin' || currentRole === 'treasurer') {
    return true
  }

  return root.balance_visible === true || permissions.can_view_balance === true
}

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
    circle_os_enabled: root.circle_os_enabled === true,
    circle_os: asObject(root.circle_os),
  }
}

export const normalizeCircleOs = (payload: unknown) => {
  const root = asObject(payload)
  const money = asObject(root.money)
  const decisions = asObject(root.decisions)
  const people = asObject(root.people)
  const activity = asObject(root.activity)
  const reconciliation = asObject(root.reconciliation)
  const ambiguity = asObject(root.ambiguity)

  return {
    circle: asObject(root.circle),
    money: {
      general_fund: asObject(money.general_fund),
      treasury_reserve: asObject(money.treasury_reserve),
      goals: asArray(money.goals).map(asObject),
      campaigns: asArray(money.campaigns).map(asObject),
      dues_collected: asObject(money.dues_collected),
    },
    decisions: {
      ...decisions,
      pending_approval_requests: asArray(decisions.pending_approval_requests).map(asObject),
      pending_treasury_payout_requests: asArray(decisions.pending_treasury_payout_requests).map(asObject),
    },
    people,
    activity,
    reconciliation,
    ambiguity,
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

const isDuesActivityRecord = (record: Record<string, any>) => {
  const activityType = String(record?.activity_type || record?.kind || '').toLowerCase()
  const receiptCategory = String(record?.meta?.receipt_category || record?.receipt_category || '').toLowerCase()
  const label = String(record?.label || record?.display_message || record?.description || record?.message || record?.title || '').toLowerCase()
  const purpose = String(
    record?.meta?.reconciliation_purpose_label ||
      record?.reconciliation_purpose_label ||
      record?.meta?.reconciliation_label ||
      record?.reconciliation_label ||
      record?.payment_item_title ||
      record?.payment_purpose_label ||
      ''
  ).toLowerCase()
  const narration = String(record?.meta?.narration || record?.narration || record?.note || '').toLowerCase()

  if (activityType === 'due_payment') return true
  if (label.includes('dues') || purpose.includes('dues') || narration.includes('dues')) return true
  if (receiptCategory === 'incoming_transfer' && (label.includes('dues') || purpose.includes('dues'))) return true
  return false
}

export const extractCircleDuesActivity = (payload: unknown): any[] => {
  return extractCircleRecentActivity(payload).filter((record) => isDuesActivityRecord(asObject(record)))
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

const treasuryEvidenceKeys = [
  'account_number',
  'account_name',
  'bank_name',
  'bank_code',
  'provider_account_id',
  'provider_account_number',
  'transfer_source_ready',
]

const hasMeaningfulTreasuryRecord = (value: unknown) => {
  const record = asObject(value)
  if (!Object.keys(record).length) return false
  return treasuryEvidenceKeys.some((key) => record[key] != null && String(record[key]).trim() !== '')
}

export const hasTreasuryEvidence = (workspace: Record<string, any> | null | undefined) => {
  const root = asObject(workspace)
  const treasuryAccount = asObject(root.treasury_account || root.treasury || {})
  const treasuryStatus = String(
    root.treasury_account?.status ||
      root.treasury_account_status ||
      root.treasury_status ||
      treasuryAccount.status ||
      treasuryAccount.treasury_status ||
      ''
  ).toLowerCase()
  const treasuryBalanceCents =
    root.treasury_balance_cents != null ? Number(root.treasury_balance_cents) : Number.NaN
  const recentSources = [
    asArray(root.recent_activity?.items),
    asArray(root.recent_transactions),
    asArray(root.transactions),
    asArray(root.timeline),
  ]
    .flat()
    .filter(Boolean)

  const hasTreasuryHistory = recentSources.some((record) => {
    const entry = asObject(record)
    const label = String(
      entry.label ||
        entry.display_message ||
        entry.description ||
        entry.message ||
        entry.title ||
        entry.payment_item_title ||
        entry.payment_purpose_label ||
        ''
    ).toLowerCase()
    const activityType = String(entry.activity_type || entry.kind || '').toLowerCase()
    const receiptCategory = String(entry.meta?.receipt_category || entry.receipt_category || '').toLowerCase()
    return (
      receiptCategory === 'treasury_payout' ||
      activityType === 'treasury_payout' ||
      activityType === 'treasury_inflow' ||
      activityType === 'contribution' ||
      activityType === 'withdrawal' ||
      label.includes('treasury') ||
      label.includes('payout') ||
      label.includes('inflow')
    )
  })

  return Boolean(
    hasMeaningfulTreasuryRecord(treasuryAccount) ||
      hasMeaningfulTreasuryRecord(root.treasury) ||
      ['active', 'pending_review', 'pending_assignment', 'rejected', 'suspended'].includes(treasuryStatus) ||
      Number.isFinite(treasuryBalanceCents) ||
      hasTreasuryHistory
  )
}

const formatDueCount = (count: number, noun = 'cycle') => `${count} ${noun}${count === 1 ? '' : 's'}`

const formatDueMoney = (cents: number) => moneyFormat(cents / 100)

export const extractCurrentUserDueSummary = (source: unknown) => {
  const root = asObject(source)
  return asObject(root.current_user_due_summary || root.current_user_summary || root)
}

export const describeCurrentUserDues = (source: unknown, options?: { compact?: boolean }) => {
  const summary = extractCurrentUserDueSummary(source)
  const compact = options?.compact === true
  const overduePeriodsCount = Number(summary.overdue_periods_count || summary.periods_owed_count || 0)
  const currentPeriodDueCount = Number(summary.current_period_due_count || 0)
  const futurePrepayablePeriodsCount = Number(
    summary.future_prepayable_periods_count || summary.payable_months_count || summary.payable_periods_count || 0
  )
  const payablePeriodsCount = Number(
    summary.payable_periods_count ||
      overduePeriodsCount + currentPeriodDueCount + futurePrepayablePeriodsCount
  )
  const totalOpenAmountCents = Number(
    summary.total_open_amount_cents ?? summary.total_outstanding_amount_cents ?? 0
  )
  const explanation = String(summary.explanation || '').trim()

  const hasOverdue = overduePeriodsCount > 0
  const hasCurrentDue = currentPeriodDueCount > 0
  const hasFuturePrepayable = futurePrepayablePeriodsCount > 0
  const hasOpenAmount = Number.isFinite(totalOpenAmountCents) && totalOpenAmountCents > 0

  if (hasOverdue) {
    return {
      state: 'overdue' as const,
      badge: 'In arrears',
      amountLabel: hasOpenAmount ? `${formatDueMoney(totalOpenAmountCents)} open` : 'Payment due',
      summaryLabel: compact
        ? `${formatDueCount(overduePeriodsCount, 'overdue cycle')}${hasCurrentDue ? ` + ${formatDueCount(currentPeriodDueCount, 'current cycle')} due` : ''}`
        : [
            formatDueCount(overduePeriodsCount, 'overdue cycle'),
            hasCurrentDue ? `${formatDueCount(currentPeriodDueCount, 'current cycle')} due` : null,
          ].filter(Boolean).join(' · '),
      helper:
        explanation ||
        [
          `${formatDueCount(overduePeriodsCount, 'overdue cycle')} carried forward`,
          hasCurrentDue ? `${formatDueCount(currentPeriodDueCount, 'current cycle')} due now` : null,
          hasFuturePrepayable ? `${formatDueCount(futurePrepayablePeriodsCount, 'future cycle')} available after arrears` : null,
        ].filter(Boolean).join(' · '),
    }
  }

  if (hasCurrentDue) {
    return {
      state: 'current_due' as const,
      badge: 'Current cycle due',
      amountLabel: hasOpenAmount ? `${formatDueMoney(totalOpenAmountCents)} due` : 'Payment due',
      summaryLabel: compact
        ? `${formatDueCount(currentPeriodDueCount, 'current cycle')} due`
        : `${formatDueCount(currentPeriodDueCount, 'current cycle')} due now`,
      helper:
        explanation ||
        [
          `${formatDueCount(currentPeriodDueCount, 'current cycle')} due now`,
          hasFuturePrepayable ? `${formatDueCount(futurePrepayablePeriodsCount, 'future cycle')} available for prepayment` : null,
        ].filter(Boolean).join(' · '),
    }
  }

  if (hasFuturePrepayable) {
    return {
      state: 'future_available' as const,
      badge: 'Current',
      amountLabel: hasOpenAmount ? `${formatDueMoney(totalOpenAmountCents)} available` : 'Future cycles available',
      summaryLabel: compact
        ? `${formatDueCount(futurePrepayablePeriodsCount, 'future cycle')} available`
        : `${formatDueCount(futurePrepayablePeriodsCount, 'future cycle')} available for prepayment`,
      helper:
        explanation ||
        `${formatDueCount(futurePrepayablePeriodsCount, 'future cycle')} can be prepaid within the active plan window.`,
    }
  }

  if (payablePeriodsCount > 0 || hasOpenAmount) {
    return {
      state: 'open_balance' as const,
      badge: 'Open dues',
      amountLabel: hasOpenAmount ? `${formatDueMoney(totalOpenAmountCents)} open` : 'Payment options available',
      summaryLabel: compact ? `${formatDueCount(payablePeriodsCount)} open` : `${formatDueCount(payablePeriodsCount)} open in this plan`,
      helper: explanation || 'Open dues exist in the current plan window.',
    }
  }

  return {
    state: 'paid_up' as const,
    badge: 'Paid up',
    amountLabel: 'Paid up',
    summaryLabel: compact ? 'No dues open' : 'No dues are currently open',
    helper: explanation || 'You are current on dues for this plan.',
  }
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
  settingsPayload,
}: {
  circlePayload?: unknown
  contextPayload?: unknown
  treasuryPayload?: unknown
  settingsPayload?: unknown
}) => {
  const circle = extractCirclePayload(circlePayload)
  const context = extractCircleContextPayload(contextPayload)
  const treasuryAccount = normalizeTreasuryAccount(treasuryPayload)
  const treasuryRoot = extractCirclePayload(treasuryPayload)
  const settings = extractCirclePayload(settingsPayload)
  const settingsIdentity = asObject(settings.identity)
  const balance = asObject(context.balance)
  const permissions = asObject(context.permissions)
  const approvals = asObject(context.approvals)
  const circleOsEnabled = context.circle_os_enabled === true && Object.keys(context.circle_os).length > 0
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
  const treasuryStatus = String(
    treasuryAccount.status ||
      treasuryAccount.treasury_status ||
      treasuryRoot.status ||
      treasuryRoot.treasury_status ||
      treasuryRoot.treasury_account_status ||
      ''
  ).toLowerCase()
  const resolvedBalanceCents =
    treasuryBalanceCents != null
      ? treasuryBalanceCents
      : contextBalanceCents != null
        ? contextBalanceCents
        : circleBalanceCents
  const circleIdentity = asObject(circle.identity)
  const contextCircleIdentity = asObject(context.circle.identity)
  const resolvedLogoUrl = pickFirstString(
    circle.logo_url,
    circleIdentity.logo_url,
    settings.logo_url,
    settingsIdentity.logo_url,
    context.circle.logo_url,
    contextCircleIdentity.logo_url
  )

  return {
    ...circle,
    ...context.circle,
    logo_url: resolvedLogoUrl,
    logo_attached:
      circle.logo_attached != null
        ? Boolean(circle.logo_attached)
        : context.circle.logo_attached != null
          ? Boolean(context.circle.logo_attached)
          : Boolean(resolvedLogoUrl),
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
    treasury_account: Object.keys(treasuryAccount).length ? treasuryAccount : null,
    treasury: Object.keys(treasuryRoot).length ? treasuryRoot : null,
    treasury_status: treasuryStatus,
    treasury_account_status: String(
      treasuryAccount.status ||
        treasuryAccount.treasury_status ||
        treasuryRoot.treasury_account_status ||
        treasuryRoot.treasury_status ||
        treasuryRoot.status ||
        ''
    ).toLowerCase(),
    treasury_has_evidence: hasTreasuryEvidence({
      ...circle,
      ...context.circle,
      treasury_account: treasuryAccount,
      treasury: treasuryRoot,
      treasury_balance_cents: treasuryBalanceCents,
      balance_cents: resolvedBalanceCents,
      recent_activity: {
        ...context.recent_activity,
        items: recentItems,
      },
      recent_transactions: recentItems,
    }),
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
    circle_os_enabled: circleOsEnabled,
    circle_os: circleOsEnabled ? normalizeCircleOs(context.circle_os) : null,
    recent_activity: {
      ...context.recent_activity,
      items: recentItems,
    },
    recent_transactions: recentItems,
  }
}

export const buildCircleActionRequired = ({
  workspace,
  dueSummary,
  duePlanConfigured,
  pendingApprovalCount,
  pendingPayoutCount,
  collectionCount,
  activityCount,
}: {
  workspace: Record<string, any> | null | undefined
  dueSummary: Record<string, any>
  duePlanConfigured: boolean
  pendingApprovalCount: number
  pendingPayoutCount: number
  collectionCount: number
  activityCount: number
}) => {
  const permissions = asObject(workspace?.permissions)
  const currentRole = String(workspace?.current_user_role || workspace?.role || 'member').toLowerCase()
  const canManageGovernance = Boolean(permissions.can_manage_governance || currentRole === 'owner' || currentRole === 'admin')
  const canRequestTreasury = Boolean(
    permissions.can_manage_settings ||
      permissions.can_manage_governance ||
      permissions.can_manage_due_plan ||
      currentRole === 'owner' ||
      currentRole === 'admin'
  )
  const canManageTreasury = Boolean(
    canRequestTreasury ||
      currentRole === 'treasurer'
  )
  const canPayDues = Boolean(permissions.can_pay_dues || permissions.can_contribute || currentRole)
  const canInviteMembers = Boolean(permissions.can_invite_members || permissions.can_manage_members || currentRole === 'owner' || currentRole === 'admin')
  const currentUserSummary = extractCurrentUserDueSummary(dueSummary)
  const duesPresentation = describeCurrentUserDues(currentUserSummary)
  const pendingTreasuryStatus = String(
    workspace?.treasury_account?.status ||
      workspace?.treasury_account_status ||
      workspace?.treasury_status ||
      workspace?.treasury?.status ||
      ''
  ).toLowerCase()
  const treasuryStatusKnown = Boolean(pendingTreasuryStatus)
  const treasuryHasEvidence = hasTreasuryEvidence(workspace)
  const governanceCompleted = Boolean(
    workspace?.governance?.governance_setup_completed ||
      workspace?.governance_setup_completed ||
      workspace?.settings?.governance_setup_completed
  )
  const memberCount = Number(workspace?.member_count || workspace?.members_count || (Array.isArray(workspace?.members) ? workspace.members.length : 0))

  if (duePlanConfigured && canPayDues && ['overdue', 'current_due', 'open_balance'].includes(duesPresentation.state)) {
    return {
      kind: 'pay_dues',
      title: 'Pay Dues',
      helper: duesPresentation.helper,
      actionLabel: 'Pay Dues',
      secondaryLabel: 'Open Contributions',
    }
  }

  if (pendingApprovalCount > 0) {
    return {
      kind: 'review_approval',
      title: 'Review Approval',
      helper: `${pendingApprovalCount} approval${pendingApprovalCount === 1 ? '' : 's'} need review.`,
      actionLabel: 'Review Approval',
      secondaryLabel: 'Open Activity',
    }
  }

  if (pendingPayoutCount > 0 && canManageTreasury) {
      return {
        kind: 'review_treasury_payouts',
        title: 'Review shared fund payouts',
        helper: `${pendingPayoutCount} shared fund payout${pendingPayoutCount === 1 ? '' : 's'} need review.`,
        actionLabel: 'Review payouts',
        secondaryLabel: 'Open Shared Fund',
      }
    }

  if (treasuryHasEvidence) {
    if (canManageTreasury && treasuryStatusKnown && pendingTreasuryStatus !== 'active') {
      return {
        kind: 'review_treasury',
        title: 'Review shared fund',
        helper: 'Shared fund details exist, but the current state needs review.',
        actionLabel: 'Review Shared Fund',
        secondaryLabel: 'Open Shared Fund',
      }
    }
  } else if (treasuryStatusKnown) {
    if (pendingTreasuryStatus === 'not_requested' && canRequestTreasury) {
      return {
        kind: 'request_treasury',
        title: 'Set up shared fund',
        helper: 'Shared fund access is not ready yet.',
        actionLabel: 'Set up Shared Fund',
        secondaryLabel: 'Open Shared Fund',
      }
    }
    if (canManageTreasury && pendingTreasuryStatus !== 'active') {
      return {
        kind: 'review_treasury',
        title: 'Review shared fund',
        helper: 'Shared fund status needs review.',
        actionLabel: 'Review Shared Fund',
        secondaryLabel: 'Open Shared Fund',
      }
    }
  }

  if (!governanceCompleted && canManageGovernance) {
    return {
      kind: 'governance_setup',
      title: 'Complete Governance',
      helper: 'This Circle still needs governance setup.',
      actionLabel: 'Complete Governance',
      secondaryLabel: 'Open Governance',
    }
  }

  if (memberCount <= 1 && canInviteMembers) {
      return {
        kind: 'invite_members',
        title: 'Invite people',
        helper: 'Bring more people into the Circle.',
        actionLabel: 'Invite people',
        secondaryLabel: 'Open People',
      }
    }

  if (activityCount > 0 || collectionCount > 0) {
      return {
        kind: 'review_activity',
        title: 'Review money activity',
        helper: 'Recent money activity is available.',
        actionLabel: 'Review Activity',
        secondaryLabel: 'Open Activity',
      }
  }

  return {
    kind: 'caught_up',
    title: 'All caught up',
    helper: 'Shared fund, dues, collections, and activity are up to date.',
    actionLabel: null,
    secondaryLabel: null,
  }
}
