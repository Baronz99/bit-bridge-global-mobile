const DEFAULT_CADENCE = 'monthly'
const CLEARED_STATUSES = new Set(['paid', 'waived'])

type CircleRecord = Record<string, unknown>
type DuesLookupEntry = {
  statusKey: 'paid' | 'owing'
  statusLabel: 'Paid' | 'Owing'
  periodsPaidCount: number
  periodsPaidLabel: string
  outstandingAmountCents: number
}

const cadenceUnit = (cadence?: string | null) => {
  switch (String(cadence || DEFAULT_CADENCE).toLowerCase()) {
    case 'weekly':
      return 'week'
    case 'yearly':
      return 'year'
    default:
      return 'month'
  }
}

export const formatPeriodCountLabel = (count: number, cadence?: string | null) => {
  const total = Math.max(Number(count || 0), 0)
  const unit = cadenceUnit(cadence)
  return `${total} ${unit}${total === 1 ? '' : 's'}`
}

export const buildMemberDuesLookup = (
  members: CircleRecord[],
  obligations: CircleRecord[],
  duePlan?: CircleRecord | null
): Record<string, DuesLookupEntry> => {
  const cadence = String(duePlan?.cadence || DEFAULT_CADENCE)
  const obligationsByUser = new Map<string, CircleRecord>()

  ;(Array.isArray(obligations) ? obligations : []).forEach((item) => {
    const userId = String(item?.user_id || '').trim()
    if (!userId) return
    obligationsByUser.set(userId, item)
  })

  return (Array.isArray(members) ? members : []).reduce<Record<string, DuesLookupEntry>>((accumulator, member) => {
    const user = member?.user as CircleRecord | undefined
    const userId = String(user?.id || member?.user_id || '').trim()
    const membershipId = String(member?.id || userId).trim()
    const obligation = obligationsByUser.get(userId)
    if (!membershipId || !obligation) return accumulator

    const status = String(obligation?.status || '').toLowerCase()
    const isCleared = CLEARED_STATUSES.has(status)
    const outstandingAmountCents = Math.max(Number(isCleared ? 0 : obligation?.amount_cents || 0), 0)
    const periodsPaidCount = isCleared ? 1 : 0

    accumulator[membershipId] = {
      statusKey: isCleared ? 'paid' : 'owing',
      statusLabel: isCleared ? 'Paid' : 'Owing',
      periodsPaidCount,
      periodsPaidLabel: `${formatPeriodCountLabel(periodsPaidCount, cadence)} paid`,
      outstandingAmountCents,
    }
    return accumulator
  }, {})
}

export const normalizeDueSummary = (payload: unknown): CircleRecord => {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) return payload as CircleRecord
  return {}
}

export const getCurrentUserDueSummary = (payload: unknown): CircleRecord => {
  const summary = normalizeDueSummary(payload)
  const currentUserSummary = summary?.current_user_summary
  return currentUserSummary && typeof currentUserSummary === 'object' && !Array.isArray(currentUserSummary)
    ? (currentUserSummary as CircleRecord)
    : {}
}

export const getContributionStatusMeta = ({
  status,
  duePlanConfigured,
}: {
  status?: string | null
  duePlanConfigured?: boolean
}) => {
  const normalized = String(status || '').toLowerCase()
  if (!duePlanConfigured) return { label: 'No dues configured', tone: 'neutral' as const }
  if (normalized === 'paid' || normalized === 'waived' || normalized === 'current') {
    return { label: 'Paid', tone: 'paid' as const }
  }
  if (normalized === 'pending' || normalized === 'overdue') {
    return { label: 'Owing', tone: 'owing' as const }
  }
  if (normalized === 'not_due') {
    return { label: 'No current dues', tone: 'neutral' as const }
  }

  return { label: 'No current dues', tone: 'neutral' as const }
}

export const contributionStatusLabel = (status?: string | null, duePlanConfigured = true) =>
  getContributionStatusMeta({ status, duePlanConfigured }).label

export const contributionStatusTone = (status?: string | null, duePlanConfigured = true) =>
  getContributionStatusMeta({ status, duePlanConfigured }).tone
