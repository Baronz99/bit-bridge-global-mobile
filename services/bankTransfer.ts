import { getTransferQuote } from '@/api/account'
import { listTimeline, type TimelineQuery } from '@/api/timeline'

const TODAY_LIMIT = 50
const MAX_PAGES = 5
const MIN_TRANSFER_AMOUNT = 150

const toNumber = (value: unknown) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

const toLower = (value: unknown) => String(value ?? '').trim().toLowerCase()

export const estimateTransferFeeBreakdown = (amount: number) => {
  const safeAmount = toNumber(amount)
  if (safeAmount <= 0) {
    return { platformFee: 0, stampDutyFee: 0, totalFee: 0 }
  }

  const platformFee = safeAmount >= 50000 ? 50 : 35
  const stampDutyFee = safeAmount >= 10000 ? 50 : 0
  const totalFee = platformFee + stampDutyFee

  return { platformFee, stampDutyFee, totalFee }
}

export const estimateTransferFee = (amount: number): number => {
  const fee = estimateTransferFeeBreakdown(amount).totalFee
  return Number(fee.toFixed(2))
}

export const isSameLocalDay = (value: unknown, day: Date = new Date()) => {
  const parsed = new Date(String(value || ''))
  if (Number.isNaN(parsed.getTime())) return false
  return (
    parsed.getFullYear() === day.getFullYear() &&
    parsed.getMonth() === day.getMonth() &&
    parsed.getDate() === day.getDate()
  )
}

export const parseTimelineAmount = (record: Record<string, any>) => {
  const meta = record?.meta || {}
  const amount = toNumber(record?.amount || meta?.amount || record?.display_amount)
  const feeFromMeta =
    toNumber(meta?.fee) ||
    toNumber(meta?.fees) ||
    toNumber(meta?.fee_amount) ||
    toNumber(record?.fee) ||
    toNumber(record?.fees)
  const displayTotal = toNumber(record?.display_total || record?.total_debit || meta?.total_debit)
  const totalDebit = displayTotal > 0 ? displayTotal : amount + feeFromMeta
  return { amount, fee: feeFromMeta, totalDebit }
}

export const isBankTransferDebitRecord = (record: Record<string, any>) => {
  const meta = record?.meta || {}
  const kind = toLower(record?.kind || record?.type || meta?.kind || meta?.source)
  const txType = toLower(meta?.transaction_type || record?.transaction_type || record?.type)
  const subtype = toLower(meta?.subtype)
  const provider = toLower(meta?.provider)

  const isAnchorTransferComponent =
    provider === 'anchor' && (subtype === 'principal' || subtype === 'fee')

  const description = toLower(meta?.description || meta?.address || record?.description || record?.display_message)
  const label = toLower(record?.label || record?.title || record?.text || record?.message)

  const hasBankMarkers =
    Boolean(meta?.bank_code || meta?.account_number || meta?.counter_party_id) ||
    description.includes('bank transfer') ||
    label.includes('bank transfer')

  const isTransferLike =
    isAnchorTransferComponent ||
    kind.includes('transfer') ||
    txType.includes('transfer') ||
    label.includes('transfer') ||
    description.includes('transfer')

  const isDebitLike =
    txType === 'withdraw' ||
    txType === 'withdrawal' ||
    txType === 'debit' ||
    txType === 'transfer_out' ||
    toLower(record?.direction) === 'debit' ||
    toLower(meta?.direction) === 'debit'

  return (isAnchorTransferComponent || hasBankMarkers) && isTransferLike && isDebitLike
}

export const sumTodayTransferSpentFromTimeline = (records: Record<string, any>[], day: Date = new Date()) => {
  return records.reduce((sum, record) => {
    const occurredAt = record?.occurred_at || record?.created_at || record?.createdAt || record?.timestamp
    if (!isSameLocalDay(occurredAt, day)) return sum
    if (!isBankTransferDebitRecord(record)) return sum

    const parsed = parseTimelineAmount(record)
    const delta = Math.max(0, parsed.totalDebit || parsed.amount + parsed.fee)
    return sum + delta
  }, 0)
}

const extractTimelineList = (payload: any): Record<string, any>[] => {
  const top = payload?.data ?? payload
  const list = top?.items ?? top?.timeline ?? top?.results ?? top?.data ?? top
  return Array.isArray(list) ? list : []
}

const extractNextCursor = (payload: any): string | null => {
  const top = payload?.data ?? payload
  const cursor = top?.next_cursor ?? top?.cursor ?? payload?.next_cursor
  return cursor ? String(cursor) : null
}

const getTodayTransferSpentFromTimelineFallback = async (): Promise<number> => {
  const now = new Date()
  const dateOnly = now.toISOString().slice(0, 10)
  const queryBase: TimelineQuery = {
    startDate: dateOnly,
    endDate: dateOnly,
    showAlerts: false,
    limit: TODAY_LIMIT,
  }

  let cursor: string | undefined
  let pages = 0
  let total = 0

  while (pages < MAX_PAGES) {
    const res = await listTimeline({ ...queryBase, ...(cursor ? { cursor } : {}) })
    const records = extractTimelineList(res)
    total += sumTodayTransferSpentFromTimeline(records, now)
    cursor = extractNextCursor(res) || undefined
    pages += 1
    if (!cursor || records.length === 0) break
  }

  return Number(total.toFixed(2))
}

export const getTransferQuoteSnapshot = async (amount: number) => {
  const safeAmount = Math.max(0, toNumber(amount))
  const quoteAmount = safeAmount > 0 ? safeAmount : MIN_TRANSFER_AMOUNT

  try {
    const raw = await getTransferQuote(quoteAmount)
    const payload = raw?.data ?? raw ?? {}
    return {
      source: 'quote' as const,
      amount: quoteAmount,
      fee: toNumber(payload?.fee),
      totalDebit: toNumber(payload?.total_debit),
      dailyLimit: toNumber(payload?.daily_limit),
      dailySpent: toNumber(payload?.daily_spent),
      dailyRemaining: toNumber(payload?.daily_remaining),
      feeIsEstimate: payload?.fee_is_estimate === true,
      feeBreakdown: payload?.fee_breakdown || null,
      businessTimezone: String(payload?.business_timezone || ''),
      minAmount: MIN_TRANSFER_AMOUNT,
    }
  } catch {
    const fallbackFee = estimateTransferFee(quoteAmount)
    const todaySpent = await getTodayTransferSpentFromTimelineFallback().catch(() => 0)
    return {
      source: 'fallback' as const,
      amount: quoteAmount,
      fee: fallbackFee,
      totalDebit: quoteAmount + fallbackFee,
      dailyLimit: 0,
      dailySpent: todaySpent,
      dailyRemaining: 0,
      feeIsEstimate: true,
      feeBreakdown: null,
      businessTimezone: '',
      minAmount: MIN_TRANSFER_AMOUNT,
    }
  }
}

export const getTodayTransferSpent = async (): Promise<number> => {
  const snapshot = await getTransferQuoteSnapshot(MIN_TRANSFER_AMOUNT)
  return Number(snapshot.dailySpent || 0)
}
