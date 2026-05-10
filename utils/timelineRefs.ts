export type TimelineLike = {
  id?: string
  uuid?: string
  reference?: string
  meta?: Record<string, any>
  show_in_primary_feed?: boolean
}

const RECEIPT_PREFIXES = ['bbg-', 'fbg-', 'trx-', 'txn-', 'bill-', 'trf-', 'wallet-tx-', 'card-evt-', 'circle-treasury-payout-']

const clean = (value: unknown) => String(value ?? '').trim()

export const isWalletTimelineId = (value: string) => clean(value).toLowerCase().startsWith('wallet-tx-')

export const isPrimaryTransaction = (item: TimelineLike | null | undefined) =>
  item?.show_in_primary_feed !== false

export const getTimelineId = (item: TimelineLike | null | undefined) => {
  return clean(item?.id || item?.uuid || '')
}

export const isReceiptReference = (
  reference: string,
  opts: { allowWalletTx?: boolean } = { allowWalletTx: true }
) => {
  const ref = clean(reference).toLowerCase()
  if (!ref) return false

  if (!opts.allowWalletTx && ref.startsWith('wallet-tx-')) return false

  return RECEIPT_PREFIXES.some((prefix) => ref.startsWith(prefix))
}

/**
 * Returns the best receipt-capable reference from a timeline-like item.
 * Priority:
 * 1) meta.transaction_record_reference (canonical)
 * 2) meta.reference / item.reference / common provider references
 * 3) wallet-tx-* (only if allowWalletTx is true)
 */
export const extractReceiptReference = (
  item: TimelineLike | null | undefined,
  opts: { allowWalletTx?: boolean } = { allowWalletTx: true }
) => {
  if (!item) return ''
  const meta = (item.meta as Record<string, any>) || {}

  const candidates = [
    meta.transaction_record_reference,
    meta.transactionRecordReference,
    meta.reference,
    item.reference,
    meta.transaction_reference,
    meta.payment_reference,
    meta.provider_reference,
    meta.transfer_reference,
    meta.session_id,
    meta.unique_transaction_id,
    // fallbacks: timeline id values (wallet/card event ids are receipt-capable)
    item.id,
    item.uuid,
  ]

  for (const raw of candidates) {
    const ref = clean(raw)
    if (isReceiptReference(ref, opts)) return ref
  }

  return ''
}

export type HomeNavDecision =
  | { type: 'receipt'; reference: string }
  | { type: 'timeline-detail'; id: string }
  | { type: 'timeline-tab' }

/**
 * Home routing guardrail:
 * - wallet-tx-* goes to receipt (never timeline detail)
 * - social items (circle/card events) can go to timeline detail
 * - fallback: timeline tab
 */
export const decideHomeNavigation = (item: TimelineLike): HomeNavDecision => {
  const receipt = extractReceiptReference(item, { allowWalletTx: true })
  if (receipt) return { type: 'receipt', reference: receipt }

  const id = getTimelineId(item)
  if (id && !isWalletTimelineId(id)) return { type: 'timeline-detail', id }

  return { type: 'timeline-tab' }
}
