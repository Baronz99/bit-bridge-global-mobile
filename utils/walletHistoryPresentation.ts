type WalletHistoryInput = Record<string, unknown> | null | undefined

type WalletHistoryPresentation = {
  title: string
  subtitle: string
}

const safe = (value: unknown) => String(value ?? '').trim()
const lower = (value: unknown) => safe(value).toLowerCase()

const pick = (item: WalletHistoryInput, keys: string[]) => {
  if (!item) return ''
  for (const key of keys) {
    const value = safe((item as Record<string, unknown>)[key])
    if (value) return value
  }
  return ''
}

const compactReference = (reference: string) => {
  const value = safe(reference)
  if (!value) return ''
  if (value.length <= 12) return value
  return `${value.slice(0, 4)}...${value.slice(-4)}`
}

const maskAccount = (account: string) => {
  const digits = safe(account).replace(/\D/g, '')
  if (digits.length < 4) return ''
  return `****${digits.slice(-4)}`
}

const normalizeTxType = (item: WalletHistoryInput) => {
  const raw = lower(pick(item, ['transaction_type', 'type']))
  if (raw === 'withdraw') return 'withdrawal'
  return raw
}

const hasAny = (value: string, needles: string[]) => needles.some((needle) => value.includes(needle))

const pickTitle = (item: WalletHistoryInput) => {
  const txType = normalizeTxType(item)
  const lifecycle = lower(pick(item, ['lifecycle_state', 'status']))
  const description = lower(
    [pick(item, ['description']), pick(item, ['address']), pick(item, ['display_message'])].join(' ')
  )

  if (hasAny(description, ['reversal', 'reversed']) || hasAny(lifecycle, ['released', 'failed_refunded'])) {
    return 'Transfer reversal'
  }
  if (hasAny(description, ['tunnel conversion', 'convert ngn', 'convert usd', 'currency conversion'])) {
    return txType === 'withdrawal' ? 'Currency conversion out' : 'Currency conversion in'
  }
  if (hasAny(description, ['virtual card funding', 'card funding'])) return 'Card funding'
  if (hasAny(description, ['virtual card withdrawal', 'card withdrawal'])) return 'Card withdrawal'
  if (hasAny(description, ['airtime', 'data bundle', 'cable', 'electricity', 'bill payment'])) {
    return 'Bill payment'
  }
  if (description.includes('refund')) return 'Refund'
  if (hasAny(description, ['bank transfer', 'inter bank', 'transfer'])) {
    if (txType === 'deposit') return 'Bank transfer in'
    if (txType === 'withdrawal') return 'Bank transfer out'
    return 'Bank transfer'
  }
  if (hasAny(description, ['fund wallet', 'wallet funding'])) return 'Wallet funding'

  if (txType === 'deposit') return 'Wallet credit'
  if (txType === 'withdrawal') return 'Wallet debit'
  return 'Wallet transaction'
}

const pickCounterparty = (item: WalletHistoryInput) => {
  const name = pick(item, [
    'beneficiary_name',
    'account_name',
    'recipient_name',
    'counter_party_name',
    'counterparty_name',
    'name',
  ])
  const bank = pick(item, ['bank_name', 'bank'])
  const account = maskAccount(pick(item, ['account_number', 'account']))
  const chunks = [name, bank, account].filter(Boolean)
  return chunks.join(' • ')
}

const pickDetail = (item: WalletHistoryInput, title: string) => {
  const message = pick(item, ['display_message', 'description', 'address'])
  if (!message) return ''

  const messageLower = lower(message)
  const titleLower = lower(title)
  if (messageLower === titleLower) return ''
  if (['transaction', 'successful', 'failed', 'pending'].includes(messageLower)) return ''

  return message.length > 56 ? `${message.slice(0, 56).trimEnd()}...` : message
}

export const formatWalletHistoryPresentation = (item: WalletHistoryInput): WalletHistoryPresentation => {
  const title = pickTitle(item)
  const txType = normalizeTxType(item)
  const detail = pickCounterparty(item) || pickDetail(item, title)
  const reference = pick(item, ['reference', 'transfer_reference', 'id'])
  const refText = compactReference(reference)

  if (detail && refText) {
    const prefix = txType === 'deposit' ? 'From' : txType === 'withdrawal' ? 'To' : 'Party'
    return { title, subtitle: `${prefix} ${detail} • Ref ${refText}` }
  }
  if (detail) return { title, subtitle: detail }
  if (refText) return { title, subtitle: `Ref ${refText}` }
  return { title, subtitle: 'Reference pending' }
}
