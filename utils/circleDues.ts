const DEFAULT_CADENCE = 'monthly'
const CLEARED_STATUSES = new Set(['paid', 'waived'])

type CircleRecord = Record<string, unknown>
type DuesLookupEntry = {
  statusKey: 'paid' | 'partially_paid' | 'owing'
  statusLabel: 'Paid' | 'Partially paid' | 'Owing'
  periodsPaidCount: number
  periodsPaidLabel: string
  outstandingAmountCents: number
}

type DuePlanRecord = CircleRecord & {
  enrolled_roles?: unknown
  due_scope?: unknown
  amount_cents?: unknown
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

const normalizeRole = (value: unknown) => String(value || '').trim().toLowerCase()

const rolesForDueScope = (scope?: unknown) => {
  switch (normalizeRole(scope)) {
    case 'members_only':
      return ['member']
    case 'members_admins':
      return ['member', 'admin']
    case 'everyone':
      return ['member', 'admin', 'treasurer']
    default:
      return []
  }
}

const duePlanRoles = (duePlan?: DuePlanRecord | null) => {
  const enrolledRoles = Array.isArray(duePlan?.enrolled_roles)
    ? duePlan?.enrolled_roles.map((role) => normalizeRole(role)).filter(Boolean)
    : []
  if (enrolledRoles.length > 0) return enrolledRoles
  const scopedRoles = rolesForDueScope(duePlan?.due_scope)
  if (scopedRoles.length > 0) return scopedRoles
  return ['member', 'admin', 'treasurer']
}

const duePlanAppliesToRole = (role: unknown, duePlan?: DuePlanRecord | null) => {
  if (!duePlan) return false
  const normalizedRole = normalizeRole(role) || 'member'
  const roles = duePlanRoles(duePlan)
  return roles.includes(normalizedRole)
}

const buildDefaultDuesLookupEntry = (
  duePlan: DuePlanRecord | null | undefined,
  cadence: string
): DuesLookupEntry | null => {
  if (!duePlan) return null

  const amountCents = Math.max(Number(duePlan.amount_cents || 0), 0)
  if (!amountCents) return null

  return {
    statusKey: 'owing',
    statusLabel: 'Owing',
    periodsPaidCount: 0,
    periodsPaidLabel: `${formatPeriodCountLabel(0, cadence)} paid`,
    outstandingAmountCents: amountCents,
  }
}

const buildDuesLookupEntry = (
  obligation: CircleRecord | undefined,
  cadence: string
): DuesLookupEntry | null => {
  if (!obligation) return null

  const status = String(obligation?.status || '').toLowerCase()
  const isCleared = CLEARED_STATUSES.has(status)
  const isPartial = status === 'partially_paid'
  const outstandingAmountCents = Math.max(Number(isCleared ? 0 : obligation?.amount_cents || 0), 0)
  const periodsPaidCount = isCleared ? 1 : 0

  return {
    statusKey: isCleared ? 'paid' : isPartial ? 'partially_paid' : 'owing',
    statusLabel: isCleared ? 'Paid' : isPartial ? 'Partially paid' : 'Owing',
    periodsPaidCount,
    periodsPaidLabel: isPartial
      ? `Partial payment for ${formatPeriodCountLabel(1, cadence)}`
      : `${formatPeriodCountLabel(periodsPaidCount, cadence)} paid`,
    outstandingAmountCents,
  }
}

export const buildRosterDuesLookup = (
  members: CircleRecord[],
  people: CircleRecord[],
  obligations: CircleRecord[],
  duePlan?: CircleRecord | null
): Record<string, DuesLookupEntry> => {
  const plan = duePlan as DuePlanRecord | null | undefined
  const cadence = String(plan?.cadence || DEFAULT_CADENCE)
  const lookup = new Map<string, DuesLookupEntry>()
  const obligationsByPersonId = new Map<string, CircleRecord>()
  const obligationsByUserId = new Map<string, CircleRecord>()
  const personByUserId = new Map<string, CircleRecord>()

  ;(Array.isArray(obligations) ? obligations : []).forEach((item) => {
    const personId = String(item?.circle_person_id || '').trim()
    const userId = String(item?.user_id || '').trim()
    if (personId) obligationsByPersonId.set(personId, item)
    if (userId) obligationsByUserId.set(userId, item)
  })

  ;(Array.isArray(people) ? people : []).forEach((person) => {
    const linkedUserId = String(person?.linked_user_id || person?.linked_user?.id || person?.linked_membership?.user_id || '').trim()
    if (linkedUserId) personByUserId.set(linkedUserId, person)
  })

  const assignLookup = (keys: Array<string | null | undefined>, obligation?: CircleRecord) => {
    const entry = buildDuesLookupEntry(obligation, cadence)
    if (!entry) return

    keys
      .map((key) => String(key || '').trim())
      .filter(Boolean)
      .forEach((key) => {
        lookup.set(key, entry)
      })
  }

  const assignDefaultLookup = (keys: Array<string | null | undefined>) => {
    const entry = buildDefaultDuesLookupEntry(plan, cadence)
    if (!entry) return

    keys
      .map((key) => String(key || '').trim())
      .filter(Boolean)
      .forEach((key) => {
        if (!lookup.has(key)) lookup.set(key, entry)
      })
  }

  ;(Array.isArray(people) ? people : []).forEach((person) => {
    const personId = String(person?.id || '').trim()
    const linkedUserId = String(person?.linked_user_id || person?.linked_user?.id || person?.linked_membership?.user_id || '').trim()
    const role = String(person?.role || person?.linked_membership?.role || person?.linked_user?.role || '').toLowerCase()
    const obligation =
      obligationsByPersonId.get(personId) ||
      (linkedUserId ? obligationsByUserId.get(linkedUserId) : undefined)

    if (obligation) {
      assignLookup([personId, linkedUserId], obligation)
      return
    }

    if (duePlanAppliesToRole(role, plan)) {
      assignDefaultLookup([personId, linkedUserId])
    }
  })

  ;(Array.isArray(members) ? members : []).forEach((member) => {
    const memberId = String(member?.id || '').trim()
    const userId = String(member?.user?.id || member?.user_id || member?.linked_user_id || '').trim()
    const role = String(member?.role || member?.membership_role || '').toLowerCase()
    const person = personByUserId.get(userId)
    const personId = String(person?.id || '').trim()
    const obligation =
      (personId ? obligationsByPersonId.get(personId) : undefined) ||
      obligationsByUserId.get(userId)

    if (obligation) {
      assignLookup([memberId, userId, personId], obligation)
      return
    }

    if (duePlanAppliesToRole(role, plan)) {
      assignDefaultLookup([memberId, userId, personId])
    }
  })

  return Object.fromEntries(lookup.entries())
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
