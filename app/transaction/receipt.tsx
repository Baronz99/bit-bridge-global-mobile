import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, ActivityIndicator, ScrollView, Share, Text, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import moneyFormat from '@/utils/moneyFormat'
import CompletionPanel from '@/components/finance/CompletionPanel'
import FinancialSummaryCard from '@/components/finance/FinancialSummaryCard'
import type { FinanceSummaryRow, ReceiptDTO, TransactionStatusTone } from '@/components/finance/types'
import client from '@/api/client'
import { isValidReceiptReference } from '../../src/navigation/receiptNav'
import PerfTrace from '@/utils/perfTrace'
import ReceiptDocument from '@/components/finance/ReceiptDocument'
import { resolveReceiptSemantics } from '@/utils/receiptSemantics'

type ReceiptParams = { reference?: string; timelineId?: string }
type ReceiptCacheEntry = { data: ReceiptDTO; cachedAt: number }
type ReceiptSemantics = {
  headerTitle: string
  panelTitle: string
  primaryLabel: string
}
type ReceiptFieldSources = Array<Record<string, unknown> | undefined>

const RECEIPT_CACHE_TTL_MS = 60_000
const SAFE_SEPARATOR = ' | '
const receiptCache = new Map<string, ReceiptCacheEntry>()

const asRecord = (value: unknown): Record<string, unknown> | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

const cleanText = (value?: unknown) => {
  const text = String(value ?? '').trim()
  if (!text) return ''
  const lower = text.toLowerCase()
  if (lower === 'undefined' || lower === 'null') return ''
  return text
}

const normalizeReceiptReference = (value?: string) => String(value ?? '').trim()

const readReceiptCache = (reference: string): ReceiptDTO | null => {
  const entry = receiptCache.get(reference)
  if (!entry) return null
  if (Date.now() - entry.cachedAt >= RECEIPT_CACHE_TTL_MS) {
    receiptCache.delete(reference)
    return null
  }
  return entry.data
}

const writeReceiptCache = (reference: string, data: ReceiptDTO) => {
  receiptCache.set(reference, { data, cachedAt: Date.now() })
}

const formatReceiptTimestamp = (value?: string, allowRawFallback = true) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return allowRawFallback ? cleanText(value) : ''

  try {
    const dateLabel = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Africa/Lagos',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(date)

    const timeLabel = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Africa/Lagos',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
      .format(date)
      .replace(/\s+/g, ' ')
      .trim()

    return `${dateLabel}${SAFE_SEPARATOR}${timeLabel} WAT`
  } catch {
    return cleanText(value)
  }
}

const formatStatusLabel = (value?: string) => {
  const raw = String(value || 'pending').trim().toLowerCase()
  if (/success|complete|approved|paid/.test(raw)) return 'Completed'
  if (/fail|declin|error|revers/.test(raw)) return 'Failed'
  if (/pending|initialized|processing/.test(raw)) return 'Pending'
  return raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : 'Pending'
}

const getField = (receipt: ReceiptDTO | null, keys: string[]) => {
  if (!receipt) return ''
  const beneficiary = asRecord((receipt as unknown as Record<string, unknown>).beneficiary)
  const details = asRecord((receipt as unknown as Record<string, unknown>).details)
  const serviceDetails = asRecord((receipt as unknown as Record<string, unknown>).service_details)
  const breakdown = asRecord((receipt as unknown as Record<string, unknown>).breakdown)

  for (const key of keys) {
    const beneficiaryValue = cleanText(beneficiary?.[key])
    if (beneficiaryValue) return beneficiaryValue
    const detailsValue = cleanText(details?.[key])
    if (detailsValue) return detailsValue
    const serviceDetailsValue = cleanText(serviceDetails?.[key])
    if (serviceDetailsValue) return serviceDetailsValue
    const breakdownValue = cleanText(breakdown?.[key])
    if (breakdownValue) return breakdownValue
    const partyValue = cleanText((receipt.parties as Record<string, unknown> | undefined)?.[key])
    if (partyValue) return partyValue
    const metaValue = cleanText((receipt.meta as Record<string, unknown> | undefined)?.[key])
    if (metaValue) return metaValue
    const providerValue = cleanText((receipt.provider as Record<string, unknown> | undefined)?.[key])
    if (providerValue) return providerValue
    const financialValue = cleanText((receipt.financials as Record<string, unknown> | undefined)?.[key])
    if (financialValue) return financialValue
    const legacyValue = cleanText((receipt.legacy as Record<string, unknown> | undefined)?.[key])
    if (legacyValue) return legacyValue
  }
  return ''
}

const getSources = (receipt: ReceiptDTO | null): ReceiptFieldSources => {
  if (!receipt) return []
  const legacy = asRecord(receipt.legacy)
  return [
    asRecord((receipt as unknown as Record<string, unknown>).beneficiary),
    asRecord((receipt as unknown as Record<string, unknown>).details),
    asRecord((receipt as unknown as Record<string, unknown>).service_details),
    asRecord((receipt as unknown as Record<string, unknown>).breakdown),
    receipt.parties as Record<string, unknown> | undefined,
    receipt.meta as Record<string, unknown> | undefined,
    receipt.provider as Record<string, unknown> | undefined,
    receipt.financials as Record<string, unknown> | undefined,
    legacy,
    asRecord(legacy?.raw_fields),
  ]
}

const getNumberField = (receipt: ReceiptDTO | null, keys: string[]) => {
  for (const source of getSources(receipt)) {
    if (!source) continue
    for (const key of keys) {
      const raw = source[key]
      const value = typeof raw === 'number' ? raw : Number(raw)
      if (Number.isFinite(value) && value > 0) return value
    }
  }
  return undefined
}

const maskAccountNumber = (value?: string) => {
  const text = cleanText(value)
  if (!text) return ''
  if (text.includes('*')) return text
  const digits = text.replace(/\D/g, '')
  if (!digits) return text
  if (digits.length <= 4) return digits
  return `****${digits.slice(-4)}`
}

const normalizeFeeLabel = (label?: string) => {
  const raw = cleanText(label).toLowerCase()
  if (!raw) return 'Fee'
  if (raw.includes('stamp')) return 'Stamp duty'
  if (raw.includes('transfer')) return 'Transfer fee'
  if (raw.includes('service')) return 'Service charge'
  return raw.replace(/_/g, ' ').replace(/\b\w/g, (match) => match.toUpperCase())
}

const normalizeTimelineLabel = (label?: string) => {
  const raw = cleanText(label).toLowerCase()
  if (!raw) return 'Progress'
  if (/success|complete|approved|paid/.test(raw)) return 'Completed'
  if (/pending|processing|provider/.test(raw)) return 'Processing'
  if (/init|create|start|record/.test(raw)) return 'Initiated'
  if (/fail|declin|error|revers/.test(raw)) return 'Failed'
  return raw.replace(/_/g, ' ').replace(/\b\w/g, (match) => match.toUpperCase())
}

const cleanTimelineDescription = (value?: string) => {
  const text = cleanText(value)
  if (!text) return ''
  return text.replace(/\s+/g, ' ').replace(/[|]+/g, '-').trim()
}

const splitFeeRows = (receipt: ReceiptDTO | null): FinanceSummaryRow[] => {
  if (!receipt) return []
  if (!Array.isArray(receipt.fees)) return []
  return receipt.fees
    .filter((fee) => {
      const amount = typeof fee.amount === 'number' ? fee.amount : Number(fee.amount)
      return Number.isFinite(amount) && amount > 0
    })
    .map((fee) => ({
      label: normalizeFeeLabel(fee.label),
      value: moneyFormat(Number(fee.amount) || 0, fee.currency || receipt.currency),
    }))
    .filter((row) => cleanText(row.value))
}

const getServiceDetailRows = (receipt: ReceiptDTO | null): FinanceSummaryRow[] => {
  if (!receipt) return []

  const token = getField(receipt, ['token', 'electricity_token', 'token_code'])
  const meterNumber = getField(receipt, ['meter_number', 'meterNo'])
  const phoneNumber = getField(receipt, ['phone_number', 'phone'])
  const customerName = getField(receipt, ['customer_name', 'customerName', 'name'])
  const address = getField(receipt, ['service_address', 'serviceAddress', 'address'])
  const provider = getField(receipt, ['biller', 'provider_name', 'provider'])
  const service = getField(receipt, ['service_type', 'service'])
  const units = getField(receipt, ['units'])
  const network = getField(receipt, ['network', 'network_name'])
  const planName = getField(receipt, ['plan_name', 'plan', 'bundle_name'])
  const bundleSize = getField(receipt, ['bundle_size', 'bundle'])
  const validity = getField(receipt, ['validity'])
  const airtimeValue = getNumberField(receipt, ['airtime_value'])
  const paymentMethod = getField(receipt, ['payment_method', 'payment_type'])
  const email = getField(receipt, ['email'])
  const serviceCharge = getNumberField(receipt, ['service_charge'])

  return [
    token ? { label: 'Token', value: token, wrap: true, mono: true, emphasis: true } : null,
    meterNumber ? { label: 'Meter number', value: meterNumber, mono: true } : null,
    phoneNumber ? { label: 'Phone number', value: phoneNumber, mono: true } : null,
    customerName ? { label: 'Customer name', value: customerName } : null,
    address ? { label: 'Address', value: address, wrap: true } : null,
    provider ? { label: 'Provider', value: provider } : null,
    network ? { label: 'Network', value: network } : null,
    planName ? { label: 'Plan', value: planName, wrap: true } : null,
    bundleSize ? { label: 'Bundle', value: bundleSize } : null,
    validity ? { label: 'Validity', value: validity } : null,
    service ? { label: 'Service', value: service } : null,
    units ? { label: 'Units', value: units } : null,
    typeof airtimeValue === 'number' ? { label: 'Airtime value', value: moneyFormat(airtimeValue, receipt.currency) } : null,
    typeof serviceCharge === 'number' ? { label: 'Service charge', value: moneyFormat(serviceCharge, receipt.currency) } : null,
    paymentMethod ? { label: 'Payment method', value: paymentMethod } : null,
    email ? { label: 'Email', value: email } : null,
  ].filter(Boolean) as FinanceSummaryRow[]
}

const getTransferBreakdownRows = (receipt: ReceiptDTO | null): FinanceSummaryRow[] => {
  if (!receipt) return []

  const feeRows = splitFeeRows(receipt)
  const transferFee = getNumberField(receipt, ['transfer_fee', 'platform_fee'])
  const stampDuty = getNumberField(receipt, ['stamp_duty', 'stamp_duty_fee'])
  const { amountSent, totalDebited } = getTransferDisplayAmounts(receipt)
  const rows: FinanceSummaryRow[] = [
    {
      label: 'Amount sent',
      value: moneyFormat(amountSent ?? receipt.amount, receipt.currency),
      emphasis: true,
    },
  ]

  if (transferFee && !feeRows.some((row) => row.label === 'Transfer fee')) {
    rows.push({ label: 'Transfer fee', value: moneyFormat(transferFee, receipt.currency) })
  }
  if (stampDuty && !feeRows.some((row) => row.label === 'Stamp duty')) {
    rows.push({ label: 'Stamp duty', value: moneyFormat(stampDuty, receipt.currency) })
  }
  rows.push(...feeRows)

  if (typeof totalDebited === 'number' && totalDebited !== amountSent) {
    rows.push({ label: 'Total debited', value: moneyFormat(totalDebited, receipt.currency) })
  }
  if (typeof receipt.net_amount === 'number' && receipt.net_amount !== (amountSent ?? receipt.amount)) {
    rows.push({ label: 'Net amount', value: moneyFormat(receipt.net_amount, receipt.currency) })
  }
  return rows
}

const getTransferDisplayAmounts = (receipt: ReceiptDTO | null) => {
  if (!receipt) return { amountSent: undefined, totalDebited: undefined, primaryAmount: undefined, primaryLabel: 'Amount sent' }

  const financials = asRecord(receipt.financials)
  const breakdown = asRecord((receipt as unknown as Record<string, unknown>).breakdown)

  const amountSentCandidate =
    (typeof receipt.value_amount === 'number' && Number.isFinite(receipt.value_amount) && receipt.value_amount > 0
      ? receipt.value_amount
      : undefined) ??
    (() => {
      const raw = financials?.value_amount ?? breakdown?.value_amount
      const value = typeof raw === 'number' ? raw : Number(raw)
      return Number.isFinite(value) && value > 0 ? value : undefined
    })()

  const totalDebitedCandidate =
    (typeof receipt.total_display === 'number' && Number.isFinite(receipt.total_display) && receipt.total_display > 0
      ? receipt.total_display
      : undefined) ??
    (() => {
      const raw = financials?.total_debit ?? financials?.expected_total_debit ?? breakdown?.total_debit
      const value = typeof raw === 'number' ? raw : Number(raw)
      return Number.isFinite(value) && value > 0 ? value : undefined
    })()

  const amountSent = amountSentCandidate ?? receipt.amount
  const totalDebited = totalDebitedCandidate ?? receipt.amount
  const hasFeesApplied = totalDebited > amountSent

  return {
    amountSent,
    totalDebited,
    primaryAmount: hasFeesApplied ? totalDebited : amountSent,
    primaryLabel: hasFeesApplied ? 'Total debited' : 'Amount sent',
  }
}

const getReceiptSemantics = (receipt: ReceiptDTO | null): ReceiptSemantics => {
  const semantic = resolveReceiptSemantics(receipt)
  return {
    headerTitle: semantic.headerTitle,
    panelTitle: semantic.panelTitle,
    primaryLabel: semantic.primaryLabel,
  }
}

const ReceiptScreen = () => {
  const { reference, timelineId } = useLocalSearchParams<ReceiptParams>()
  const [loading, setLoading] = useState(true)
  const [raw, setRaw] = useState<ReceiptDTO | null>(null)
  const [invalidRef, setInvalidRef] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState(false)
  const uiAfterDataTraceRef = useRef<string | null>(null)

  const load = useCallback(async () => {
    const ref0 = normalizeReceiptReference(String(reference ?? timelineId ?? '').trim())
    const apiTraceLabel = `receipt:api:${ref0 || 'missing'}`

    if (!ref0 || !isValidReceiptReference(ref0)) {
      setRaw(null)
      setInvalidRef(true)
      setNotFound(false)
      setError(false)
      setLoading(false)
      PerfTrace.mark('receipt:invalid_reference', { reference: ref0 })
      return
    }

    const cached = readReceiptCache(ref0)
    if (cached) {
      setRaw(cached)
      setInvalidRef(false)
      setNotFound(false)
      setError(false)
      setLoading(false)
    } else {
      setLoading(true)
      setInvalidRef(false)
      setNotFound(false)
      setError(false)
      setRaw(null)
    }

    try {
      PerfTrace.start(apiTraceLabel, { reference: ref0 })
      const res = await client.get(`/receipts/${encodeURIComponent(ref0)}`)
      const resAny = res as { data?: { data?: ReceiptDTO } & ReceiptDTO; status?: number }
      const payload = resAny?.data?.data ?? resAny?.data ?? (res as unknown as ReceiptDTO)
      PerfTrace.end(apiTraceLabel, { status: resAny?.status ?? null })
      uiAfterDataTraceRef.current = `receipt:ui_after_data:${ref0}`
      PerfTrace.start(uiAfterDataTraceRef.current)
      setRaw(payload as ReceiptDTO)
      writeReceiptCache(ref0, payload as ReceiptDTO)
      setInvalidRef(false)
      setNotFound(false)
      setError(false)
    } catch (err: unknown) {
      const errorLike = err as { response?: { status?: number }; message?: string }
      PerfTrace.end(apiTraceLabel, {
        status: errorLike?.response?.status ?? null,
        message: errorLike?.message || 'request_failed',
      })
      if (!cached) {
        if (errorLike?.response?.status === 404) setNotFound(true)
        else setError(true)
        setRaw(null)
      }
    } finally {
      setLoading(false)
    }
  }, [reference, timelineId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!raw || !uiAfterDataTraceRef.current) return
    const label = uiAfterDataTraceRef.current
    const frame = requestAnimationFrame(() => {
      PerfTrace.end(label, { rendered: true })
      uiAfterDataTraceRef.current = null
    })
    return () => cancelAnimationFrame(frame)
  }, [raw])

  const receipt = useMemo<ReceiptDTO | null>(() => {
    PerfTrace.start('receipt:transform', { hasRaw: !!raw })
    if (!raw) {
      PerfTrace.end('receipt:transform', { hasReceipt: false })
      return null
    }

    const rewardAmount = Number(raw.reward_applied ?? raw.commission_used ?? 0)
    const baseAmount = Number(raw.amount ?? 0)
    const financials = raw.financials && typeof raw.financials === 'object' ? raw.financials : undefined
    const backendValueAmount = Number((financials as Record<string, unknown> | undefined)?.value_amount)
    const backendTotalDebit = Number(
      (financials as Record<string, unknown> | undefined)?.total_debit ??
        (financials as Record<string, unknown> | undefined)?.expected_total_debit
    )
    const backendWalletCharged = Number((financials as Record<string, unknown> | undefined)?.wallet_amount_charged)
    const explicitValueAmount = Number(raw.value_amount)
    const explicitTotalDisplay = Number(raw.total_display)
    const explicitTotalAmount = Number(raw.total_amount)
    const explicitWalletCharged = Number(raw.wallet_amount_charged)

    const computedValue = Number.isFinite(explicitValueAmount)
      ? explicitValueAmount
      : Number.isFinite(backendValueAmount)
        ? backendValueAmount
        : Number.isFinite(explicitTotalDisplay)
          ? explicitTotalDisplay
          : Number.isFinite(explicitTotalAmount)
            ? explicitTotalAmount
            : Number.isFinite(explicitWalletCharged)
              ? explicitWalletCharged + Math.max(0, rewardAmount)
              : rewardAmount > 0
                ? baseAmount + rewardAmount
                : baseAmount

    const walletAmount = Number.isFinite(explicitWalletCharged)
      ? explicitWalletCharged
      : Number.isFinite(backendWalletCharged)
        ? backendWalletCharged
        : Number.isFinite(explicitTotalAmount)
          ? Math.max(0, explicitTotalAmount - Math.max(0, rewardAmount))
          : Number.isFinite(explicitValueAmount)
            ? Math.max(0, explicitValueAmount - Math.max(0, rewardAmount))
            : baseAmount

    const feeArray = Array.isArray(raw.fees) ? raw.fees : []
    const serviceType = String(
      (raw.meta as Record<string, unknown> | undefined)?.service_type ||
        (raw.parties as Record<string, unknown> | undefined)?.service_type ||
        raw.event || ''
    )
      .trim()
      .toUpperCase()
    const serviceChargeFromMeta = Number((raw.meta as Record<string, unknown> | undefined)?.service_charge ?? 0)
    const derivedFees =
      feeArray.length > 0
        ? feeArray
        : serviceType === 'ELECTRICITY' && Number.isFinite(serviceChargeFromMeta) && serviceChargeFromMeta > 0
          ? [{ label: 'service charge', amount: serviceChargeFromMeta, currency: raw.currency || 'NGN' }]
          : []

    const rawLegacy = asRecord(raw.legacy)

    const normalized: ReceiptDTO = {
      reference: raw.reference || String(reference || timelineId || '--'),
      kind: raw.kind,
      receipt_kind: raw.receipt_kind,
      event: raw.event,
      transaction_type: raw.transaction_type,
      status: raw.status || 'pending',
      amount: Number(raw.amount || 0),
      fee: raw.fee,
      currency: raw.currency || 'NGN',
      fees: derivedFees,
      net_amount: raw.net_amount,
      occurred_at: raw.occurred_at,
      created_at: raw.created_at,
      recorded_at: raw.recorded_at,
      title: raw.title || raw.event || raw.kind || 'Transaction receipt',
      subtitle: raw.subtitle,
      description: raw.description,
      owner_type: raw.owner_type,
      owner_id: raw.owner_id,
      business_entity_id: raw.business_entity_id,
      circle_id: raw.circle_id,
      external_reference: raw.external_reference,
      session_id: raw.session_id,
      parties: raw.parties,
      provider: raw.provider,
      metadata: raw.metadata,
      meta: raw.meta,
      legacy: { ...(rawLegacy || {}), raw_fields: raw as unknown as Record<string, unknown> },
      value_amount: raw.value_amount ?? computedValue,
      wallet_amount_charged: raw.wallet_amount_charged ?? walletAmount,
      reward_applied: raw.reward_applied ?? rewardAmount,
      total_display: raw.total_display ?? (Number.isFinite(backendTotalDebit) ? backendTotalDebit : computedValue),
      total_amount: raw.total_amount,
      commission_used: raw.commission_used,
      financials,
      service_details: raw.service_details,
      beneficiary: raw.beneficiary,
      reason: cleanText((raw.meta as Record<string, unknown> | undefined)?.reason) ||
        cleanText((raw.meta as Record<string, unknown> | undefined)?.message) ||
        cleanText(raw.reason) ||
        cleanText(raw.message) ||
        cleanText(raw.error),
      message: raw.message,
      error: raw.error,
      timeline: Array.isArray(raw.timeline) ? raw.timeline : [],
    }
    PerfTrace.end('receipt:transform', {
      hasReceipt: true,
      timeline_count: normalized.timeline?.length ?? 0,
      fees_count: normalized.fees?.length ?? 0,
    })
    return normalized
  }, [raw, reference, timelineId])

  const semantics = useMemo(() => getReceiptSemantics(receipt), [receipt])
  const resolvedSemantics = useMemo(() => resolveReceiptSemantics(receipt), [receipt])
  const isOutboundTransferReceipt = resolvedSemantics.kind === 'transfer' || resolvedSemantics.kind === 'transfer_outbound'
  const isInboundTransferReceipt = resolvedSemantics.kind === 'transfer_inbound'
  const isTransferReceipt = isOutboundTransferReceipt
  const statusLabel = useMemo(() => formatStatusLabel(receipt?.status), [receipt?.status])
  const formattedTimestamp = useMemo(() => formatReceiptTimestamp(receipt?.occurred_at), [receipt?.occurred_at])
  const fullReference = useMemo(() => cleanText(receipt?.reference || String(reference || '--')), [receipt?.reference, reference])
  const beneficiaryName = useMemo(() => getField(receipt, ['beneficiary_name', 'name', 'account_name']), [receipt])
  const bankName = useMemo(() => getField(receipt, ['beneficiary_bank_name', 'bank_name', 'bankName', 'bank']), [receipt])
  const accountNumber = useMemo(() => maskAccountNumber(getField(receipt, ['beneficiary_account_number', 'account_number', 'accountNumber', 'account'])), [receipt])
  const transferReference = useMemo(() => getField(receipt, ['transfer_reference', 'provider_reference']), [receipt])
  const transferNarration = useMemo(() => cleanText(receipt?.description || getField(receipt, ['description'])), [receipt])
  const senderName = useMemo(() => getField(receipt, ['sender_name', 'name']), [receipt])
  const senderBankName = useMemo(() => getField(receipt, ['sender_bank_name', 'bank_name', 'bank']), [receipt])
  const senderAccountNumber = useMemo(() => maskAccountNumber(getField(receipt, ['sender_account_number', 'account_number', 'account'])), [receipt])
  const serviceRows = useMemo(() => getServiceDetailRows(receipt), [receipt])
  const transferDisplay = useMemo(() => getTransferDisplayAmounts(receipt), [receipt])
  const statusValue = String(receipt?.status || 'pending')
  const statusTone: TransactionStatusTone = /success|complete|approved|paid/i.test(statusValue)
    ? 'success'
    : /fail|declin|error|revers/i.test(statusValue)
      ? 'failed'
      : /pending|initialized|processing/i.test(statusValue)
        ? 'pending'
        : 'info'

  const detailRows: FinanceSummaryRow[] = receipt
    ? [
        { label: 'Status', value: statusLabel, emphasis: true },
        isOutboundTransferReceipt && beneficiaryName ? { label: 'Recipient', value: beneficiaryName, emphasis: true } : null,
        isInboundTransferReceipt && senderName ? { label: 'Sender', value: senderName, emphasis: true } : null,
        formattedTimestamp ? { label: 'Recorded at', value: formattedTimestamp } : null,
        isOutboundTransferReceipt && transferNarration ? { label: 'Narration', value: transferNarration, wrap: true } : null,
        (isOutboundTransferReceipt || isInboundTransferReceipt) && transferReference ? { label: 'Transfer reference', value: transferReference, mono: true, wrap: true } : null,
        fullReference ? { label: 'Transaction ID', value: fullReference, mono: true, wrap: true } : null,
      ].filter(Boolean) as FinanceSummaryRow[]
    : []

  const feeRows = splitFeeRows(receipt)
  const totalDebitedValue = typeof receipt?.total_display === 'number' ? receipt.total_display : undefined
  const breakdownRows: FinanceSummaryRow[] = receipt
    ? isTransferReceipt
      ? getTransferBreakdownRows(receipt)
      : [
          {
            label: semantics.primaryLabel,
            value: moneyFormat(receipt.amount, receipt.currency),
            emphasis: true,
          },
          ...feeRows,
          typeof totalDebitedValue === 'number' && totalDebitedValue !== receipt.amount
            ? { label: 'Total debited', value: moneyFormat(totalDebitedValue, receipt.currency) }
            : null,
          typeof receipt.net_amount === 'number' && receipt.net_amount !== receipt.amount
            ? { label: 'Net amount', value: moneyFormat(receipt.net_amount, receipt.currency) }
            : null,
        ].filter(Boolean) as FinanceSummaryRow[]
    : []

  const senderRows: FinanceSummaryRow[] = [
    senderName ? { label: 'Name', value: senderName, emphasis: true } : null,
    senderBankName ? { label: 'Bank', value: senderBankName } : null,
    senderAccountNumber ? { label: 'Account', value: senderAccountNumber, mono: true } : null,
  ].filter(Boolean) as FinanceSummaryRow[]

  const beneficiaryRows: FinanceSummaryRow[] = [
    beneficiaryName ? { label: 'Name', value: beneficiaryName, emphasis: true } : null,
    bankName ? { label: 'Bank', value: bankName } : null,
    accountNumber ? { label: 'Account', value: accountNumber, mono: true } : null,
  ].filter(Boolean) as FinanceSummaryRow[]
  const timelineRows: FinanceSummaryRow[] = receipt
    ? (Array.isArray(receipt.timeline) ? receipt.timeline : [])
        .map((item) => ({
          label: normalizeTimelineLabel(item.label),
          value: [cleanTimelineDescription(item.description), formatReceiptTimestamp(cleanText(item.occurred_at), false)]
            .filter(Boolean)
            .join(SAFE_SEPARATOR),
          wrap: true,
        }))
        .filter((row) => cleanText(row.value))
    : []

  const handleCopyReference = async () => {
    if (!receipt) return
    try {
      const Clipboard = await import('expo-clipboard')
      await Clipboard.setStringAsync(String(receipt.reference || ''))
      Alert.alert('Copied', 'Full transaction ID copied to clipboard.')
    } catch {
      Alert.alert('Transaction ID', String(receipt.reference || ''))
    }
  }

  const handleShare = async () => {
    if (!receipt) return
    try {
      await Share.share({
        message:
          `BitBridge Receipt\n` +
          `Title: ${semantics.headerTitle}\n` +
          `Amount: ${moneyFormat(receipt.amount, receipt.currency)}\n` +
          `Status: ${statusLabel}\n` +
          `Reference: ${receipt.reference}\n` +
          `Date: ${formattedTimestamp}`,
      })
    } catch {
      // no-op
    }
  }

  return (
    <View className="flex-1 bg-primary px-4">
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#f59e0b" />
        </View>
      ) : invalidRef ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-white text-base">Invalid receipt reference.</Text>
        </View>
      ) : notFound ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-white text-base">Receipt not found.</Text>
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-4">
          <Text className="text-white text-base text-center mb-3">Unable to load receipt. Please try again.</Text>
          <TouchableOpacity onPress={load} className="px-6 py-3 rounded-xl bg-theme-primary">
            <Text className="text-black font-semibold">Retry</Text>
          </TouchableOpacity>
        </View>
      ) : receipt ? (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          <View className="pt-6">
            <ReceiptDocument
              title={semantics.headerTitle}
              primaryActionLabel="Share receipt"
              onPrimaryAction={handleShare}
              secondaryActionLabel="Copy full transaction ID"
              onSecondaryAction={handleCopyReference}
            >
              <CompletionPanel
                title={semantics.panelTitle}
                supportingText={receipt.subtitle || receipt.message || 'Final amount confirmed and ready for verification below.'}
                primaryLabel={isTransferReceipt ? transferDisplay.primaryLabel : semantics.primaryLabel}
                primaryValue={moneyFormat((isTransferReceipt ? transferDisplay.primaryAmount : receipt.amount) ?? receipt.amount, receipt.currency)}
                statusLabel={statusLabel}
                statusTone={statusTone}
                summaryTitle="Details"
                summaryRows={detailRows}
                variant="document"
              />

              <View className="h-px bg-[#22324A] my-4" />

              <FinancialSummaryCard
                title="Breakdown"
                rows={breakdownRows}
                footer={isOutboundTransferReceipt ? 'Amount, fees, and total debited recorded against this transfer.' : 'Final amount and charges recorded against this transaction.'}
                variant="document"
              />

              {isInboundTransferReceipt && senderRows.length ? (
                <>
                  <View className="h-px bg-[#22324A] my-4" />
                  <FinancialSummaryCard title="Sender" rows={senderRows} variant="document" />
                </>
              ) : null}

              {resolvedSemantics.showBeneficiary && beneficiaryRows.length ? (
                <>
                  <View className="h-px bg-[#22324A] my-4" />
                  <FinancialSummaryCard title="Recipient" rows={beneficiaryRows} variant="document" />
                </>
              ) : null}

              {resolvedSemantics.showServiceDetails && serviceRows.length ? (
                <>
                  <View className="h-px bg-[#22324A] my-4" />
                  <FinancialSummaryCard title="Service details" rows={serviceRows} variant="document" />
                </>
              ) : null}

              {timelineRows.length ? (
                <>
                  <View className="h-px bg-[#22324A] my-4" />
                  <FinancialSummaryCard
                    title="Progress"
                    rows={timelineRows}
                    footer="Status updates are shown in settlement order."
                    variant="document"
                  />
                </>
              ) : null}
            </ReceiptDocument>
          </View>
        </ScrollView>
      ) : (
        <View className="flex-1 items-center justify-center">
          <Text className="text-white text-base">Receipt not available.</Text>
        </View>
      )}
    </View>
  )
}

export default ReceiptScreen
