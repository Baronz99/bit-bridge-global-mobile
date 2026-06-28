import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import ScreenContainer from '@/components/ScreenContainer'
import { getBusinessPayoutRun } from '@/api/business'
import { useActiveAccount } from '@/services/useActiveAccount'
import { buildApiErrorMessage } from '@/utils/apiErrorMessage'
import { backOrFallback } from '@/utils/navigationRecovery'

const formatNgn = (value: any) =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
  }).format(Number(value || 0))

const statusTone = (status: string) => {
  switch (String(status || '').toLowerCase()) {
    case 'approved':
    case 'completed':
    case 'successful':
      return 'text-emerald-200 border-emerald-500/30 bg-emerald-500/10'
    case 'pending_approval':
    case 'processing':
    case 'pending':
    case 'review_ready':
      return 'text-amber-100 border-amber-500/30 bg-amber-500/10'
    case 'failed':
    case 'rejected':
      return 'text-red-100 border-red-500/30 bg-red-500/10'
    default:
      return 'text-slate-200 border-slate-700 bg-slate-950/45'
  }
}

const formatDateTime = (value: any) => {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleString()
}

const BusinessPayrollRunDetailScreen = () => {
  const router = useRouter()
  const params = useLocalSearchParams<{ id?: string }>()
  const { activeAccount } = useActiveAccount()
  const businessId = activeAccount.type === 'business' ? activeAccount.businessId : null
  const payoutRunId = String(params?.id || '').trim()

  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [run, setRun] = useState<Record<string, any> | null>(null)

  const loadRun = useCallback(async () => {
    if (!businessId || !payoutRunId) {
      setLoading(false)
      return
    }

    setLoading(true)
    setErrorMessage(null)
    try {
      const response = await getBusinessPayoutRun(businessId, payoutRunId)
      setRun(response?.data?.data || response?.data || null)
    } catch (error: any) {
      const message = buildApiErrorMessage({
        status: error?.response?.status,
        data: error?.response?.data,
        fallback: 'Unable to load this payroll run right now.',
      })
      setErrorMessage(message)
    } finally {
      setLoading(false)
    }
  }, [businessId, payoutRunId])

  useEffect(() => {
    void loadRun()
  }, [loadRun])

  const items = useMemo(() => (Array.isArray(run?.items) ? run.items : []), [run?.items])
  const preview = run?.preview || {}

  return (
    <ScreenContainer topPadding={20}>
      <View className="rounded-[28px] border border-[#FF7A18]/40 bg-[#151A22] p-5">
        <Text className="text-[#FFB05A] text-[11px] uppercase tracking-[2px]">Payroll run</Text>
        <Text className="text-white text-2xl font-semibold mt-3">{String(run?.title || 'Payroll run')}</Text>
        <Text className="text-gray-300 text-sm mt-2">
          {run?.period_label ? String(run.period_label) : 'Review this payroll cycle and each payment entry.'}
        </Text>
        <TouchableOpacity
          onPress={() => backOrFallback(router, '/business/payouts')}
          className="self-start mt-4 rounded-2xl border border-gray-700 px-4 py-3"
        >
          <Text className="text-white text-sm font-semibold">Back to payroll</Text>
        </TouchableOpacity>
      </View>

      {errorMessage ? (
        <View className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-4">
          <Text className="text-red-100 text-sm">{errorMessage}</Text>
        </View>
      ) : null}

      {loading ? (
        <View className="py-10 items-center justify-center">
          <ActivityIndicator size="small" color="#FFB05A" />
          <Text className="text-white mt-3">Loading payroll run...</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
          <View className="mt-4 rounded-2xl border border-gray-800 bg-gray-900/80 p-4">
            <View className="flex-row items-start justify-between gap-3">
              <View className="flex-1">
                <Text className="text-white text-base font-semibold">{String(run?.reference || 'Pending reference')}</Text>
                {run?.cycle_key ? <Text className="text-gray-400 text-xs mt-1">Cycle {String(run.cycle_key)}</Text> : null}
              </View>
              <View className={`rounded-full border px-3 py-1 ${statusTone(String(run?.status || 'draft'))}`}>
                <Text className="text-[11px] font-semibold uppercase">{String(run?.status || 'draft').replace(/_/g, ' ')}</Text>
              </View>
            </View>

            <Text className="text-white text-xl font-semibold mt-4">{formatNgn(run?.total_amount || 0)}</Text>
            <Text className="text-gray-400 text-xs mt-1">
              {Number(run?.total_items || 0)} entries
              {run?.review_ready ? ' � Review locked' : ''}
              {run?.approval_status ? ` � Approval ${String(run.approval_status).replace(/_/g, ' ')}` : ''}
            </Text>

            <View className="flex-row flex-wrap gap-2 mt-4">
              <View className="rounded-2xl border border-gray-800 bg-gray-950/45 px-3 py-2">
                <Text className="text-gray-400 text-[11px] uppercase">Successful</Text>
                <Text className="text-white text-sm font-semibold mt-1">{Number(run?.successful_items_count || 0)}</Text>
              </View>
              <View className="rounded-2xl border border-gray-800 bg-gray-950/45 px-3 py-2">
                <Text className="text-gray-400 text-[11px] uppercase">Pending</Text>
                <Text className="text-white text-sm font-semibold mt-1">{Number(run?.pending_items_count || 0)}</Text>
              </View>
              <View className="rounded-2xl border border-gray-800 bg-gray-950/45 px-3 py-2">
                <Text className="text-gray-400 text-[11px] uppercase">Failed</Text>
                <Text className="text-white text-sm font-semibold mt-1">{Number(run?.failed_items_count || 0)}</Text>
              </View>
            </View>
          </View>

          <View className="mt-4 rounded-2xl border border-gray-800 bg-gray-900/80 p-4">
            <Text className="text-white text-base font-semibold">Payroll control</Text>
            <View className="mt-3 gap-2">
              {run?.period_starts_on || run?.period_ends_on ? (
                <Text className="text-gray-300 text-sm">
                  Period {String(run?.period_starts_on || '-')} to {String(run?.period_ends_on || '-')}
                </Text>
              ) : null}
              {formatDateTime(run?.reviewed_at) ? (
                <Text className="text-gray-300 text-sm">Reviewed {String(formatDateTime(run?.reviewed_at))}</Text>
              ) : null}
              {formatDateTime(run?.submitted_at) ? (
                <Text className="text-gray-300 text-sm">Submitted {String(formatDateTime(run?.submitted_at))}</Text>
              ) : null}
              {formatDateTime(run?.executed_at) ? (
                <Text className="text-gray-300 text-sm">Executed {String(formatDateTime(run?.executed_at))}</Text>
              ) : null}
              {preview?.approval?.required ? (
                <Text className="text-gray-300 text-sm">
                  Approval required{preview?.approval?.mode ? ` � ${String(preview.approval.mode).replace(/_/g, ' ')}` : ''}
                </Text>
              ) : (
                <Text className="text-gray-300 text-sm">Approval not required for this payroll total.</Text>
              )}
            </View>
          </View>

          <View className="mt-4 rounded-2xl border border-gray-800 bg-gray-900/80 p-4">
            <Text className="text-white text-base font-semibold">Payment entries</Text>
            <View className="mt-4 gap-3">
              {items.length ? items.map((item) => (
                <View key={String(item?.id)} className="rounded-2xl border border-gray-800 bg-gray-950/45 px-4 py-4">
                  <View className="flex-row items-start justify-between gap-3">
                    <View className="flex-1">
                      <Text className="text-white text-sm font-semibold">{String(item?.payee_name || item?.account_name || 'Payroll entry')}</Text>
                      <Text className="text-gray-400 text-xs mt-1">
                        {String(item?.bank_name || item?.bank_code || 'Bank')} � {String(item?.account_number || '')}
                      </Text>
                      {item?.employee_code ? <Text className="text-gray-500 text-xs mt-1">Employee code {String(item.employee_code)}</Text> : null}
                    </View>
                    <View className={`rounded-full border px-3 py-1 ${statusTone(String(item?.status || 'pending'))}`}>
                      <Text className="text-[11px] font-semibold uppercase">{String(item?.status || 'pending').replace(/_/g, ' ')}</Text>
                    </View>
                  </View>

                  <Text className="text-white text-sm font-semibold mt-3">{formatNgn(item?.amount || 0)}</Text>
                  {item?.receipt_reference ? <Text className="text-gray-400 text-xs mt-1">Receipt {String(item.receipt_reference)}</Text> : null}
                  {item?.transfer_reference ? <Text className="text-gray-500 text-xs mt-1">Transfer {String(item.transfer_reference)}</Text> : null}
                  {item?.provider_status ? <Text className="text-gray-500 text-xs mt-1">Processing {String(item.provider_status).replace(/_/g, ' ')}</Text> : null}
                </View>
              )) : (
                <Text className="text-gray-400 text-sm">No payment entries on this payroll run.</Text>
              )}
            </View>
          </View>
        </ScrollView>
      )}
    </ScreenContainer>
  )
}

export default BusinessPayrollRunDetailScreen
