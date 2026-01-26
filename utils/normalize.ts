type AnyRecord = Record<string, unknown>

const getString = (value: unknown) => (typeof value === 'string' ? value : '')

const getNumber = (value: unknown) => {
  if (typeof value === 'number') return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

export type NormalizedBank = {
  id?: string
  name: string
  code?: string
  label: string
  raw: AnyRecord
}

export const normalizeBank = (input: unknown = {}): NormalizedBank => {
  if (typeof input === 'string') {
    const name = input.trim()
    return {
      id: name || undefined,
      name: name || 'Unknown bank',
      code: undefined,
      label: name || 'Unknown bank',
      raw: { name },
    }
  }

  const record = (input && typeof input === 'object' ? (input as AnyRecord) : {}) as AnyRecord
  const attrs = ((record.attributes ?? record.data) &&
    typeof (record.attributes ?? record.data) === 'object'
      ? (record.attributes ?? record.data)
      : {}) as AnyRecord
  const merged: AnyRecord = { ...record, ...attrs }

  const name =
    getString(attrs.name) ||
    getString(record.attributes && (record.attributes as AnyRecord).name) ||
    getString(merged.name) ||
    getString(merged.bank_name) ||
    getString(merged.bankName) ||
    getString(merged.institution_name) ||
    getString(merged.institutionName) ||
    getString(merged.institution) ||
    getString(merged.displayName) ||
    getString(merged.title) ||
    getString(merged.label)

  const nipCode = getString(attrs.nipCode) || getString(merged.nipCode)
  const cbnCode = getString(attrs.cbnCode) || getString(merged.cbnCode)
  const code =
    nipCode ||
    cbnCode ||
    getString(merged.code) ||
    getString(merged.bank_code) ||
    getString(merged.bankCode) ||
    getString(merged.institution_code) ||
    getString(merged.institutionCode) ||
    getString(merged.value)

  const label =
    name || (code ? `Bank (${code})` : 'Unknown bank')

  const id =
    getString(record.id) ||
    getString(merged.id) ||
    getString(merged.uuid) ||
    getString(merged.slug) ||
    code ||
    name ||
    label

  return {
    id: id || undefined,
    name: label,
    code: code || undefined,
    label,
    raw: merged,
  }
}

export type NormalizedBeneficiary = {
  id?: string
  name: string
  bankName?: string
  bankCode?: string
  accountNumber?: string
  raw: AnyRecord
}

export const normalizeBeneficiary = (input: AnyRecord = {}): NormalizedBeneficiary => {
  const name =
    getString(input.account_name) ||
    getString(input.name) ||
    getString(input.beneficiary_name) ||
    getString(input.label) ||
    getString(input.title)

  const bankName =
    getString(input.bank_name) ||
    getString(input.bank) ||
    getString(input.institution_name)

  const bankCode =
    getString(input.bank_code) ||
    getString(input.code) ||
    getString(input.institution_code)

  const accountNumber =
    getString(input.account_number) ||
    getString(input.account) ||
    getString(input.accountNo)

  const id =
    getString(input.id) ||
    getString(input.beneficiary_id) ||
    getString(input.counter_party_id) ||
    accountNumber ||
    name

  return {
    id: id || undefined,
    name: name || 'Beneficiary',
    bankName: bankName || undefined,
    bankCode: bankCode || undefined,
    accountNumber: accountNumber || undefined,
    raw: input,
  }
}

export type NormalizedQuote = {
  amountNgn?: number
  amountUsd?: number
  rate?: number
  fee?: number
  raw: AnyRecord
}

export const normalizeQuote = (input: AnyRecord = {}): NormalizedQuote => {
  const amountNgn =
    getNumber(input.amount_ngn) ??
    getNumber(input.ngn_amount) ??
    getNumber(input.amount)

  const amountUsd =
    getNumber(input.amount_usd) ??
    getNumber(input.usd_amount) ??
    getNumber(input.amount)

  const rate = getNumber(input.rate) ?? getNumber(input.exchange_rate)
  const fee = getNumber(input.fee) ?? getNumber(input.fees)

  return {
    amountNgn,
    amountUsd,
    rate,
    fee,
    raw: input,
  }
}

export type NormalizedTransfer = {
  id?: string
  transferId?: string
  status?: string
  message?: string
  raw: AnyRecord
}

export const normalizeTransfer = (input: AnyRecord = {}): NormalizedTransfer => {
  const transferId =
    getString(input.transfer_id) ||
    getString(input.transferId) ||
    getString(input.id)

  const status =
    getString(input.status) ||
    getString(input.state)

  const message =
    getString(input.message) ||
    getString(input.detail) ||
    getString(input.description)

  return {
    id: transferId || undefined,
    transferId: transferId || undefined,
    status: status || undefined,
    message: message || undefined,
    raw: input,
  }
}
