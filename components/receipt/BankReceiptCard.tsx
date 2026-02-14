import React, { useMemo, useState } from 'react'
import { Image, Text, TouchableOpacity, View } from 'react-native'
import moneyFormat from '@/utils/moneyFormat'
import { icons } from '@/constants/icons'
import { BRAND_NAME } from '@/constants/brand'

type ReceiptStatus = 'successful' | 'pending' | 'failed' | 'timed_out'

type ReceiptMeta = {
  channel?: string
  beneficiary?: string
  bankName?: string
  accountNumber?: string
  providerReference?: string
  sessionId?: string
  narration?: string
  remark?: string
  [key: string]: any
}

type FeeDetail = {
  label?: string
  amount: number
  currency?: string
}

type BankReceiptCardProps = {
  title: string
  createdAt: string
  status: ReceiptStatus | string
  amount: number
  currency: string
  reference: string
  fees?: number | FeeDetail[]
  netAmount?: number
  meta?: ReceiptMeta
  parties?: Record<string, any>
  provider?: Record<string, any>
  event?: string
  kind?: string
  subtitle?: string
  valueAmount?: number
  walletAmount?: number
  rewardAmount?: number
  reason?: string
  timeline?: {
    step_key?: string
    label?: string
    description?: string
    state?: string
    occurred_at?: string
    source?: string
    sequence?: number
  }[]
}

const normalizeStatus = (statusRaw: string) => {
  const s = String(statusRaw || 'pending').toLowerCase()
  if (s.includes('success') || s.includes('complete') || s.includes('approved') || s.includes('paid'))
    return 'successful'
  if (s.includes('timedout') || s.includes('timed_out') || s.includes('timeout'))
    return 'timed_out'
  if (s.includes('fail') || s.includes('declin') || s.includes('revers') || s.includes('error'))
    return 'failed'
  return 'pending'
}

const statusPill = (statusRaw: string) => {
  const status = normalizeStatus(statusRaw)
  if (status === 'successful') {
    return { label: 'Success', bg: 'bg-emerald-500/15', border: 'border-emerald-500/30', text: 'text-emerald-300' }
  }
  if (status === 'failed') {
    return { label: 'Failed', bg: 'bg-red-500/15', border: 'border-red-500/30', text: 'text-red-300' }
  }
  if (status === 'timed_out') {
    return { label: 'Timed out', bg: 'bg-orange-500/15', border: 'border-orange-500/30', text: 'text-orange-300' }
  }
  return { label: 'Pending', bg: 'bg-amber-500/15', border: 'border-amber-500/30', text: 'text-amber-300' }
}

const clean = (value?: any) => {
  const v = String(value ?? '').trim()
  if (!v) return ''
  const low = v.toLowerCase()
  if (low === 'undefined' || low === 'null') return ''
  return v
}

const maskAccountNumber = (value?: string) => {
  const s = String(value || '').replace(/\s+/g, '')
  if (!s) return ''
  if (s.length <= 4) return `****${s}`
  return `${'*'.repeat(Math.max(0, s.length - 4))}${s.slice(-4)}`
}

const maskEmail = (value?: string) => {
  const email = String(value || '').trim()
  if (!email) return ''
  const parts = email.split('@')
  if (parts.length !== 2) return email
  const [local, domain] = parts
  const visible = local.slice(0, Math.min(local.length, 6))
  return `${visible}${local.length > visible.length ? '***' : ''}@${domain}`
}

const formatReceiptDate = (value?: string) => {
  if (!value) return '--'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  const formatter = new Intl.DateTimeFormat(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
  const base = formatter.format(parsed)
  const zoneFormatter = new Intl.DateTimeFormat(undefined, { timeZoneName: 'short' })
  const zoneName = zoneFormatter
    .formatToParts(parsed)
    .find((part) => part.type === 'timeZoneName')
    ?.value?.replace(/^GMT\+?0?0?/, 'UTC')
  const tzLabel = zoneName && !/UTC/i.test(zoneName) ? zoneName : 'Local time'
  return `${base} (${tzLabel})`
}

const extractMetaValue = (meta: ReceiptMeta | undefined, keys: string[]) => {
  if (!meta) return ''
  for (const key of keys) {
    const raw = meta[key]
    if (raw === undefined || raw === null) continue
    const cleaned = clean(raw)
    if (cleaned) return cleaned
  }
  return ''
}

const includesMonnify = (value?: string) => clean(value).toLowerCase().includes('monnify')

const Divider = () => <View className="h-[1px] bg-gray-800 my-4" />

const Row = ({ label, value, mono }: { label: string; value?: string; mono?: boolean }) => {
  const v = clean(value)
  if (!v) return null
  return (
    <View className="flex-row justify-between items-start py-1.5">
      <Text className="text-gray-500 text-[12px]">{label}</Text>
      <Text className={`${mono ? 'font-mono' : ''} text-gray-200 text-[12px] max-w-[62%] text-right`}>
        {v}
      </Text>
    </View>
  )
}

const BankReceiptCard = ({
  title,
  createdAt,
  status,
  amount,
  currency,
  reference,
  fees,
  netAmount,
  meta,
  parties,
  provider,
  event,
  kind,
  subtitle,
  valueAmount,
  walletAmount,
  rewardAmount,
  reason,
  timeline,
}: BankReceiptCardProps) => {
  const [showAdvanced, setShowAdvanced] = useState(false)

  const pill = useMemo(() => statusPill(String(status)), [status])

  const safeCurrency = String(currency || 'NGN')
  const safeAmount = Number.isFinite(Number(amount)) ? Number(amount) : 0
  const safeValueAmount = Number.isFinite(Number(valueAmount)) ? Number(valueAmount) : undefined
  const safeWalletAmount = typeof walletAmount === 'number' ? walletAmount : safeAmount
  const safeRewardAmount = typeof rewardAmount === 'number' ? rewardAmount : 0

  const feeDetails = Array.isArray(fees) ? fees : undefined
  const totalFees =
    typeof fees === 'number'
      ? Number.isFinite(fees)
        ? Number(fees)
        : undefined
      : feeDetails && feeDetails.length
        ? feeDetails.reduce((sum, entry) => sum + (Number(entry?.amount) || 0), 0)
        : undefined
  const net = typeof totalFees === 'number' ? Math.max(0, safeAmount - totalFees) : undefined
  const computedNet = typeof netAmount === 'number' ? netAmount : net

  const beneficiary = clean(meta?.beneficiary)
  const bankName = clean(meta?.bankName)
  const accountNumberMasked = maskAccountNumber(clean(meta?.accountNumber))

  const narration = clean(meta?.narration) || clean(meta?.remark)

  const providerReference = extractMetaValue(meta, [
    'providerReference',
    'provider_reference',
    'transactionReference',
    'transaction_reference',
    'monnify_transaction_reference',
    'paymentReference',
    'payment_reference',
    'transaction_hash',
    'payment_hash',
  ])
  const channelValue = extractMetaValue(meta, ['channel', 'paymentMethod', 'payment_method'])
  const customerName = extractMetaValue(meta, ['customerName', 'customer_name', 'name'])
  const customerEmail = maskEmail(extractMetaValue(meta, ['customerEmail', 'customer_email', 'email']))
  const sessionId = clean(meta?.sessionId)
  const serviceType = String(
    meta?.service_type ||
      parties?.service_type ||
      event ||
      ''
  )
    .trim()
    .toUpperCase()
  const isElectricityReceipt = serviceType === 'ELECTRICITY'
  const electricityToken = clean(meta?.token)
  const electricityUnits = clean(meta?.units)
  const electricityCustomerName = clean(meta?.customerName) || clean(meta?.customer_name) || clean(meta?.name)
  const electricityAddress = clean(meta?.address)
  const electricityMeter = clean(meta?.meter_number) || clean(parties?.recipient)
  const electricityMeterType = clean(meta?.meter_type)
  const electricityBiller = clean(meta?.biller) || clean(parties?.biller) || clean(provider?.name)
  const electricityServiceCharge = Number(meta?.service_charge ?? 0)
  const conversionMeta = meta?.fx && typeof meta.fx === 'object' ? (meta.fx as Record<string, any>) : null
  const isConversionReceipt =
    Boolean(meta?.conversion) ||
    clean(event).toLowerCase().includes('conversion') ||
    clean(title).toLowerCase().includes('conversion') ||
    clean(meta?.conversion_direction).length > 0
  const conversionDirection = clean(meta?.conversion_direction || conversionMeta?.direction)
  const conversionDirectionLabel =
    conversionDirection === 'ngn_to_usd'
      ? 'NGN → USD'
      : conversionDirection === 'usd_to_ngn'
        ? 'USD → NGN'
        : clean(conversionMeta?.from) && clean(conversionMeta?.to)
          ? `${clean(conversionMeta?.from)} → ${clean(conversionMeta?.to)}`
          : ''
  const conversionFrom = clean(conversionMeta?.from)
  const conversionTo = clean(conversionMeta?.to)
  const conversionAmountIn = Number(conversionMeta?.amount_in)
  const conversionFeeAmount = Number(conversionMeta?.fee_amount)
  const conversionFeeCurrency = clean(conversionMeta?.fee_currency)
  const conversionAmountAfterFee = Number(conversionMeta?.amount_after_fee)
  const conversionAmountOut = Number(conversionMeta?.amount_out)
  const conversionRate = Number(conversionMeta?.execution_rate)
  const normalizedTimeline = Array.isArray(timeline)
    ? [...timeline].sort((a, b) => Number(b?.sequence || 0) - Number(a?.sequence || 0))
    : []

  const monnifyMetaKeys =
    meta && Object.keys(meta).some((key) => /monnify/i.test(key))
  const isMonnifyDeposit =
    reference?.toLowerCase().startsWith('fbg-') &&
    (includesMonnify(title) || includesMonnify(event) || includesMonnify(kind) || monnifyMetaKeys)

  const displayTitle = isMonnifyDeposit ? 'Wallet Funding' : clean(title) || 'Receipt'
  const displaySubtitle = isMonnifyDeposit ? 'via Monnify' : clean(subtitle)
  const displayTime = formatReceiptDate(createdAt)
  const receiptNo = clean(reference) || '--'

  const feesLabel =
    typeof totalFees === 'number'
      ? moneyFormat(totalFees, safeCurrency)
      : feeDetails && feeDetails.length
        ? feeDetails
            .map((entry) => {
              const label = clean(entry?.label || 'fee')
              return `${label} ${moneyFormat(Number(entry?.amount) || 0, entry?.currency || safeCurrency)}`
            })
            .join(', ')
        : undefined
  const normalizedFeeDetails = feeDetails && feeDetails.length
    ? feeDetails
    : typeof totalFees === 'number' && totalFees > 0
      ? [{ label: 'fee', amount: totalFees, currency: safeCurrency }]
      : []

  const referenceLabel = isMonnifyDeposit ? 'Monnify reference' : 'Provider reference'
  const identifierRows = [
    { label: referenceLabel, value: providerReference, mono: true },
    { label: 'Session ID', value: sessionId, mono: true },
    { label: 'Payment channel', value: channelValue },
    { label: 'Customer name', value: customerName },
    { label: 'Customer email', value: customerEmail },
    { label: 'Fees', value: feesLabel },
    { label: 'Net amount', value: typeof computedNet === 'number' ? moneyFormat(computedNet, safeCurrency) : undefined },
  ].filter((row) => Boolean(row.value))

  const normalizedStatus = normalizeStatus(String(status))
  const isSuccess = normalizedStatus === 'successful'
  const shouldShowBreakdown =
    isSuccess && safeValueAmount !== undefined && (safeWalletAmount > 0 || safeRewardAmount > 0)
  const displayAmount = safeValueAmount ?? safeAmount

  return (
    <View className="bg-gray-950 border border-[rgba(255,255,255,0.08)] rounded-2xl px-5 py-5 md:px-6 md:py-6 shadow-lg">
      <View className="rounded-2xl bg-[rgba(255,255,255,0.04)] border-b border-[rgba(255,255,255,0.12)] px-4 py-3 mb-4">
        <View className="flex-row items-center justify-between gap-3">
          <View className="flex-row items-center flex-1 min-w-0">
            <View className="bg-gray-900 border border-gray-800 rounded-full p-2 h-12 w-12 flex items-center justify-center">
              <Image source={icons.appLogoClear} resizeMode="contain" style={{ width: 52, height: 20 }} />
            </View>
            <View className="ml-3 leading-tight flex-1">
              <Text className="text-white text-[15px] font-semibold leading-snug" numberOfLines={1} ellipsizeMode="tail">
                {BRAND_NAME}
              </Text>
              <Text className="text-gray-400 text-[10px] uppercase tracking-[0.25em] mt-0.5 opacity-70">
                Generated by {BRAND_NAME}
              </Text>
            </View>
          </View>

          <View
            className={`px-3 py-1 rounded-full border ${pill.bg} ${pill.border}`}
            style={{ minWidth: 96, alignItems: 'center' }}
          >
            <Text className={`${pill.text} text-[10px] font-semibold uppercase`}>{pill.label}</Text>
          </View>
        </View>
      </View>

      <View className="mt-1">
        <Text className="text-white text-[18px] font-semibold">{displayTitle}</Text>
        <Text className="text-gray-400 text-[12px] mt-1">{displayTime}</Text>
        {displaySubtitle ? (
          <Text className="text-gray-500 text-[11px] mt-1 uppercase tracking-[0.3em]">{displaySubtitle}</Text>
        ) : null}
      </View>

      {/* Amount */}
      <View className="border-t border-[rgba(255,255,255,0.05)] mt-4 pt-4">
        <Text className="text-white text-3xl font-semibold">{moneyFormat(safeValueAmount ?? safeAmount, safeCurrency)}</Text>

        {shouldShowBreakdown ? (
          <View className="mt-3 space-y-1">
            <Row label="Value" value={moneyFormat(safeValueAmount ?? safeAmount, safeCurrency)} mono />
            <Row label="Paid from wallet" value={moneyFormat(safeWalletAmount, safeCurrency)} mono />
            {safeRewardAmount > 0 ? (
              <Row label="Paid from rewards" value={moneyFormat(safeRewardAmount, safeCurrency)} mono />
            ) : null}
          </View>
        ) : (
          !isSuccess && (
            <View className="mt-3 space-y-1">
              {reason ? <Row label="Reason" value={reason} /> : null}
              <Row label="Status" value="No debit was made" />
            </View>
          )
        )}

        {feesLabel ? (
          <Text className="text-gray-400 text-[12px] mt-1">
            Fees: {feesLabel}
            {typeof computedNet === 'number' ? `  •  Net: ${moneyFormat(computedNet, safeCurrency)}` : ''}
          </Text>
        ) : (
          <Text className="text-gray-500 text-[12px] mt-1">Fees may apply depending on channel.</Text>
        )}
      </View>

      <Divider />

      {/* Summary */}
      <Text className="text-gray-400 text-[11px] uppercase tracking-widest mb-2">Summary</Text>
      <Row label="Reference" value={receiptNo} mono />
      <Row label="Channel" value={channelValue} />
      <Row label="Narration" value={narration} />

      {isConversionReceipt && conversionMeta ? (
        <>
          <Divider />
          <Text className="text-gray-400 text-[11px] uppercase tracking-widest mb-2">Conversion details</Text>
          <Row label="Direction" value={conversionDirectionLabel} />
          {Number.isFinite(conversionAmountIn) && conversionFrom ? (
            <Row label="Amount in" value={moneyFormat(conversionAmountIn, conversionFrom)} />
          ) : null}
          {Number.isFinite(conversionFeeAmount) && conversionFeeCurrency ? (
            <Row label="Conversion fee" value={moneyFormat(conversionFeeAmount, conversionFeeCurrency)} />
          ) : null}
          {Number.isFinite(conversionAmountAfterFee) && conversionFrom ? (
            <Row label="Amount after fee" value={moneyFormat(conversionAmountAfterFee, conversionFrom)} />
          ) : null}
          {Number.isFinite(conversionRate) ? (
            <Row label="Execution rate" value={String(conversionRate)} />
          ) : null}
          {Number.isFinite(conversionAmountOut) && conversionTo ? (
            <Row label="Amount out" value={moneyFormat(conversionAmountOut, conversionTo)} />
          ) : null}
        </>
      ) : null}

      {isElectricityReceipt ? (
        <>
          <Divider />
          <Text className="text-gray-400 text-[11px] uppercase tracking-widest mb-2">Electricity details</Text>
          <Row label="Provider" value={electricityBiller} />
          <Row label="Customer Name" value={electricityCustomerName} />
          <Row label="Address" value={electricityAddress} />
          <Row label="Meter Number" value={electricityMeter} mono />
          <Row label="Meter Type" value={electricityMeterType} />
          <Row label="Units (kWh)" value={electricityUnits} />
          {electricityToken ? <Row label="Token" value={electricityToken} mono /> : null}
          {electricityServiceCharge > 0 ? (
            <Row label="Service Charge" value={moneyFormat(electricityServiceCharge, safeCurrency)} />
          ) : null}
        </>
      ) : null}

      {normalizedFeeDetails.length ? (
        <>
          <Divider />
          <Text className="text-gray-400 text-[11px] uppercase tracking-widest mb-2">Fee breakdown</Text>
          {normalizedFeeDetails.map((entry, index) => (
            <Row
              key={`${entry.label || 'fee'}-${index}`}
              label={clean(entry.label || 'fee')}
              value={moneyFormat(Number(entry.amount) || 0, entry.currency || safeCurrency)}
            />
          ))}
        </>
      ) : null}

      {(beneficiary || bankName || accountNumberMasked) ? (
        <>
          <Divider />
          <Text className="text-gray-400 text-[11px] uppercase tracking-widest mb-2">Beneficiary</Text>
          <Row label="Name" value={beneficiary} />
          <Row label="Bank" value={bankName} />
          <Row label="Account" value={accountNumberMasked} mono />
        </>
      ) : null}

      {identifierRows.length ? (
        <>
          <Divider />
          <TouchableOpacity
            onPress={() => setShowAdvanced((v) => !v)}
            className="bg-gray-900 border border-gray-800 px-4 py-3 rounded-xl"
            accessibilityRole="button"
          >
            <Text className="text-gray-200 text-sm font-semibold">{showAdvanced ? 'Hide details' : 'Show details'}</Text>
            <Text className="text-gray-500 text-[11px] mt-1">Provider references and internal identifiers.</Text>
          </TouchableOpacity>

          {showAdvanced ? (
            <View className="mt-3 bg-gray-900 border border-gray-800 rounded-xl p-4">
              <Text className="text-gray-400 text-[11px] uppercase tracking-widest mb-2">Identifiers</Text>
              {identifierRows.map((row) => (
                <Row key={row.label} label={row.label} value={row.value} mono={row.mono} />
              ))}
            </View>
          ) : null}
        </>
      ) : null}

      {normalizedTimeline.length ? (
        <>
          <Divider />
          <Text className="text-gray-400 text-[11px] uppercase tracking-widest mb-2">Timeline</Text>
          <View className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            {normalizedTimeline.map((item, index) => {
              const state = clean(item?.state).toLowerCase()
              const isDone = state === 'done' || state === 'completed'
              const isFailed = state === 'failed'
              const isCurrent = state === 'current'
              const dotClass = isDone
                ? 'bg-emerald-400'
                : isFailed
                  ? 'bg-red-400'
                : isCurrent
                  ? 'bg-amber-400'
                  : 'bg-gray-600'

              return (
                <View key={`${clean(item?.step_key) || 'step'}-${index}`} className="flex-row items-start">
                  <View className="items-center mr-3 mt-1">
                    <View className={`h-2.5 w-2.5 rounded-full ${dotClass}`} />
                    {index < normalizedTimeline.length - 1 ? (
                      <View className="w-[1px] flex-1 bg-gray-700 mt-1.5" />
                    ) : null}
                  </View>
                  <View className="flex-1 pb-4">
                    <Text className="text-gray-200 text-[13px] font-semibold">
                      {clean(item?.label) || 'Update'}
                    </Text>
                    {clean(item?.description) ? (
                      <Text className="text-gray-400 text-[12px] mt-0.5">{clean(item?.description)}</Text>
                    ) : null}
                    {clean(item?.occurred_at) ? (
                      <Text className="text-gray-500 text-[11px] mt-1">{formatReceiptDate(clean(item?.occurred_at))}</Text>
                    ) : null}
                  </View>
                </View>
              )
            })}
          </View>
        </>
      ) : null}

      <View className="mt-4 pt-4 border-t border-gray-800">
        <Text className="text-gray-500 text-[11px]">
          Keep this receipt for your records. For assistance, share your reference with support.
        </Text>
      </View>
    </View>
  )
}

export default BankReceiptCard

