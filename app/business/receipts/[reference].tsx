import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, ScrollView, Share, Text, TouchableOpacity, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import ScreenContainer from '@/components/ScreenContainer'
import { getBusinessReceipt } from '@/api/business'
import { buildApiErrorMessage } from '@/utils/apiErrorMessage'
import { useActiveAccount } from '@/services/useActiveAccount'
import type { FinanceSummaryRow, ReceiptDTO, TransactionStatusTone } from '@/components/finance/types'
import ReceiptDocument from '@/components/finance/ReceiptDocument'
import CompletionPanel from '@/components/finance/CompletionPanel'
import FinancialSummaryCard from '@/components/finance/FinancialSummaryCard'
import moneyFormat from '@/utils/moneyFormat'
import { resolveReceiptSemantics } from '@/utils/receiptSemantics'

const SAFE_SEPARATOR = ' | '

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

const formatDate = (value?: string | null) => {
  if (!value) return 'Not available'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not available'

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
    return 'Not available'
  }
}

const formatStatusLabel = (value?: string) => {
  const raw = String(value || 'pending').trim().toLowerCase()
  if (/success|complete|approved|paid/.test(raw)) return 'Completed'
  if (/fail|declin|error|revers|reject/.test(raw)) return 'Failed'
  if (/pending|initialized|processing/.test(raw)) return 'Pending'
  return raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : 'Pending'
}

const getField = (receipt: ReceiptDTO | null, keys: string[]) => {
  if (!receipt) return ''
  const beneficiary = asRecord((receipt as unknown as Record<string, unknown>).beneficiary)
  const details = asRecord((receipt as unknown as Record<string, unknown>).details)
  const breakdown = asRecord((receipt as unknown as Record<string, unknown>).breakdown)

  for (const key of keys) {
    const beneficiaryValue = cleanText(beneficiary?.[key])
    if (beneficiaryValue) return beneficiaryValue
    const detailsValue = cleanText(details?.[key])
    if (detailsValue) return detailsValue
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
  }

  return ''
}

const getSources = (receipt: ReceiptDTO | null) => {
  if (!receipt) return [] as Array<Record<string, unknown> | undefined>
  return [
    asRecord((receipt as unknown as Record<string, unknown>).beneficiary),
    asRecord((receipt as unknown as Record<string, unknown>).details),
    asRecord((receipt as unknown as Record<string, unknown>).breakdown),
    receipt.parties as Record<string, unknown> | undefined,
    receipt.meta as Record<string, unknown> | undefined,
    receipt.provider as Record<string, unknown> | undefined,
    receipt.financials as Record<string, unknown> | undefined,
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
  if (/init|create|start|record|approval/.test(raw)) return 'Initiated'
  if (/fail|declin|error|revers|reject/.test(raw)) return 'Failed'
  return raw.replace(/_/g, ' ').replace(/\b\w/g, (match) => match.toUpperCase())
}

const cleanTimelineDescription = (value?: string) => cleanText(value).replace(/\s+/g, ' ').replace(/[|]+/g, '-').trim()

const splitFeeRows = (receipt: ReceiptDTO | null): FinanceSummaryRow[] => {
  if (!receipt || !Array.isArray(receipt.fees)) return []
  return receipt.fees
    .filter((fee) => {
      const amount = typeof fee.amount === 'number' ? fee.amount : Number(fee.amount)
      return Number.isFinite(amount) && amount > 0
    })
    .map((fee) => ({
      label: normalizeFeeLabel(fee.label),
      value: moneyFormat(Number(fee.amount) || 0, fee.currency || receipt.currency),
    }))
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

  return rows
}

const BusinessReceiptScreen = () => {
  const params = useLocalSearchParams<{ reference?: string }>()
  const { activeAccount } = useActiveAccount()
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [receipt, setReceipt] = useState<ReceiptDTO | null>(null)
  const businessId = activeAccount.type === 'business' ? activeAccount.businessId : null

  const loadReceipt = useCallback(async () => {
    if (!businessId || !params.reference) {
      setLoading(false)
      return
    }
    setLoading(true)
    setErrorMessage(null)
    try {
      const response = await getBusinessReceipt(businessId, String(params.reference))
      setReceipt((response?.data?.data || null) as ReceiptDTO | null)
    } catch (error: unknown) {
      const errorResponse = error as { response?: { status?: number; data?: unknown } }
      const message = buildApiErrorMessage({
        status: errorResponse?.response?.status,
        data: errorResponse?.response?.data,
        fallback: 'Unable to load the business receipt right now.',
      })
      setErrorMessage(message)
    } finally {
      setLoading(false)
    }
  }, [businessId, params.reference])

  useEffect(() => {
    loadReceipt()
  }, [loadReceipt])

  const semantics = useMemo(() => resolveReceiptSemantics(receipt), [receipt])
  const statusLabel = useMemo(() => formatStatusLabel(receipt?.status), [receipt?.status])
  const statusValue = String(receipt?.status || 'pending')
  const statusTone: TransactionStatusTone = /success|complete|approved|paid/i.test(statusValue)
    ? 'success'
    : /fail|declin|error|revers|reject/i.test(statusValue)
      ? 'failed'
      : /pending|initialized|processing/i.test(statusValue)
        ? 'pending'
        : 'info'
  const formattedTimestamp = useMemo(() => formatDate(receipt?.occurred_at || receipt?.created_at), [receipt?.occurred_at, receipt?.created_at])
  const fullReference = cleanText(receipt?.reference || params.reference)
  const beneficiaryName = useMemo(() => getField(receipt, ['beneficiary_name', 'name', 'account_name']), [receipt])
  const bankName = useMemo(() => getField(receipt, ['beneficiary_bank_name', 'bank_name', 'bankName', 'bank']), [receipt])
  const accountNumber = useMemo(() => maskAccountNumber(getField(receipt, ['beneficiary_account_number', 'account_number', 'accountNumber', 'account'])), [receipt])
  const transferReference = useMemo(() => getField(receipt, ['transfer_reference', 'provider_reference']), [receipt])
  const transferNarration = useMemo(() => cleanText(receipt?.description || getField(receipt, ['description'])), [receipt])
  const transferDisplay = useMemo(() => getTransferDisplayAmounts(receipt), [receipt])

  const detailRows: FinanceSummaryRow[] = receipt
    ? [
        { label: 'Status', value: statusLabel, emphasis: true },
        beneficiaryName ? { label: 'Recipient', value: beneficiaryName, emphasis: true } : null,
        formattedTimestamp ? { label: 'Recorded at', value: formattedTimestamp } : null,
        transferNarration ? { label: 'Narration', value: transferNarration, wrap: true } : null,
        transferReference ? { label: 'Transfer reference', value: transferReference, mono: true, wrap: true } : null,
        fullReference ? { label: 'Transaction ID', value: fullReference, mono: true, wrap: true } : null,
      ].filter(Boolean) as FinanceSummaryRow[]
    : []

  const breakdownRows = useMemo(() => getTransferBreakdownRows(receipt), [receipt])

  const beneficiaryRows: FinanceSummaryRow[] = [
    beneficiaryName ? { label: 'Name', value: beneficiaryName, emphasis: true } : null,
    bankName ? { label: 'Bank', value: bankName } : null,
    accountNumber ? { label: 'Account', value: accountNumber, mono: true } : null,
  ].filter(Boolean) as FinanceSummaryRow[]

  const providerRows: FinanceSummaryRow[] = receipt
    ? [
        cleanText(receipt.provider?.name) ? { label: 'Provider', value: cleanText(receipt.provider?.name) } : null,
        cleanText(receipt.provider?.reference) ? { label: 'Provider ref', value: cleanText(receipt.provider?.reference), mono: true, wrap: true } : null,
        cleanText(receipt.provider?.status) ? { label: 'Provider status', value: cleanText(receipt.provider?.status) } : null,
      ].filter(Boolean) as FinanceSummaryRow[]
    : []

  const timelineRows: FinanceSummaryRow[] = receipt
    ? (Array.isArray(receipt.timeline) ? receipt.timeline : [])
        .map((item) => ({
          label: normalizeTimelineLabel(item.label),
          value: [cleanTimelineDescription(item.description), formatDate(cleanText(item.occurred_at))].filter(Boolean).join(SAFE_SEPARATOR),
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
    <ScreenContainer topPadding={20}>
      {loading ? (
        <View className="py-10 items-center justify-center">
          <ActivityIndicator size="small" color="#FFB05A" />
          <Text className="text-white mt-3">Loading business receipt...</Text>
        </View>
      ) : errorMessage ? (
        <View className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-4">
          <Text className="text-red-100 text-sm">{errorMessage}</Text>
        </View>
      ) : receipt ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
          <View className="pt-4">
            <ReceiptDocument
              title={semantics.headerTitle}
              subtitle="Official transaction confirmation for your business records."
              primaryActionLabel="Share receipt"
              onPrimaryAction={handleShare}
              secondaryActionLabel="Copy full transaction ID"
              onSecondaryAction={handleCopyReference}
            >
              <CompletionPanel
                title={semantics.panelTitle}
                supportingText={receipt.subtitle || 'Business transfer confirmation and approval trail are recorded below.'}
                primaryLabel={transferDisplay.primaryLabel}
                primaryValue={moneyFormat((transferDisplay.primaryAmount ?? receipt.amount) || 0, receipt.currency)}
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
                footer="Amount, fees, and total debited recorded against this business transfer."
                variant="document"
              />

              {beneficiaryRows.length ? (
                <>
                  <View className="h-px bg-[#22324A] my-4" />
                  <FinancialSummaryCard title="Recipient" rows={beneficiaryRows} variant="document" />
                </>
              ) : null}

              {providerRows.length ? (
                <>
                  <View className="h-px bg-[#22324A] my-4" />
                  <FinancialSummaryCard title="Provider" rows={providerRows} variant="document" />
                </>
              ) : null}

              {timelineRows.length ? (
                <>
                  <View className="h-px bg-[#22324A] my-4" />
                  <FinancialSummaryCard
                    title="Progress"
                    rows={timelineRows}
                    footer="Status updates are shown in approval and settlement order."
                    variant="document"
                  />
                </>
              ) : null}

              <View className="h-px bg-[#22324A] my-4" />

              <TouchableOpacity onPress={loadReceipt} className="rounded-[18px] bg-[#132235] border border-[#24364B] py-4 items-center">
                <Text className="text-white text-sm font-semibold">Refresh receipt</Text>
              </TouchableOpacity>
            </ReceiptDocument>
          </View>
        </ScrollView>
      ) : (
        <View className="py-10 items-center justify-center">
          <Text className="text-white">Receipt not available.</Text>
        </View>
      )}
    </ScreenContainer>
  )
}

export default BusinessReceiptScreen
