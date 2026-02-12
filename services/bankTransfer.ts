import { listTimeline, type TimelineQuery } from '@/api/timeline'

const TODAY_LIMIT = 50
const MAX_PAGES = 5

const toNumber = (value: unknown) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

const toLower = (value: unknown) => String(value ?? '').trim().toLowerCase()

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
  const label = toLower(record?.label || record?.title || record?.text || record?.message)
  const description = toLower(
    meta?.description ||
      meta?.address ||
      record?.description ||
      record?.display_message
  )
  const transferRef = toLower(
    meta?.transfer_reference ||
      record?.transfer_reference ||
      meta?.reference ||
      record?.reference
  )

  const hasBankMarkers =
    Boolean(meta?.bank_code || meta?.account_number || meta?.counter_party_id) ||
    description.includes('bank transfer') ||
    description.includes('inter bank') ||
    description.includes('inter-bank') ||
    description.includes('nip transfer') ||
    label.includes('bank transfer') ||
    label.includes('inter bank') ||
    transferRef.startsWith('trf-')

  const isTransferLike =
    kind.includes('transfer') ||
    txType.includes('transfer') ||
    label.includes('transfer') ||
    description.includes('transfer') ||
    (hasBankMarkers && (txType === 'withdraw' || txType === 'withdrawal' || txType === 'debit'))

  const isDebitLike =
    txType === 'withdraw' ||
    txType === 'withdrawal' ||
    txType === 'debit' ||
    txType === 'transfer_out' ||
    toLower(record?.direction) === 'debit' ||
    toLower(meta?.direction) === 'debit'

  return hasBankMarkers && isTransferLike && isDebitLike
}

export const sumTodayTransferSpentFromTimeline = (
  records: Record<string, any>[],
  day: Date = new Date()
) => {
  return records.reduce((sum, record) => {
    const occurredAt =
      record?.occurred_at || record?.created_at || record?.createdAt || record?.timestamp
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

export const getTodayTransferSpent = async (): Promise<number> => {
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

export const estimateTransferFee = (amount: number): number => {
  const safeAmount = toNumber(amount)
  if (safeAmount <= 0) return 0
  // Backend fee rule is not exposed on mobile today; keep estimate conservative.
  return 0
}
