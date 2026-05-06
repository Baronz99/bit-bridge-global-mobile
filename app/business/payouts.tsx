import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'expo-router'
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import ScreenContainer from '@/components/ScreenContainer'
import { getBusinessPayoutRuns, getBusinessScheduledPayoutRuns } from '@/api/business'
import { buildApiErrorMessage } from '@/utils/apiErrorMessage'
import { useActiveAccount } from '@/services/useActiveAccount'
import { log } from '@/utils/logger'

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

const BusinessPayoutsScreen = () => {
  const router = useRouter()
  const { activeAccount } = useActiveAccount()
  const businessId = activeAccount.type === 'business' ? activeAccount.businessId : null
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [runs, setRuns] = useState<Record<string, any>[]>([])
  const [scheduledRuns, setScheduledRuns] = useState<Record<string, any>[]>([])
  const firstPayrollTrackedRef = useRef(false)

  const emitPayrollEvent = (event: string, extra: Record<string, unknown> = {}) => {
    log('[BUSINESS_FLOW]', {
      event,
      businessId,
      ...extra,
    })
  }

  const loadPayouts = useCallback(async () => {
    if (!businessId) {
      setLoading(false)
      return
    }

    setLoading(true)
    setErrorMessage(null)
    try {
      const [runsRes, scheduledRes] = await Promise.all([
        getBusinessPayoutRuns(businessId, { scheduled: false }),
        getBusinessScheduledPayoutRuns(businessId),
      ])
      setRuns(Array.isArray(runsRes?.data?.data) ? runsRes.data.data : [])
      setScheduledRuns(Array.isArray(scheduledRes?.data?.data) ? scheduledRes.data.data : [])
    } catch (error: any) {
      const message = buildApiErrorMessage({
        status: error?.response?.status,
        data: error?.response?.data,
        fallback: 'Unable to load business payroll right now.',
      })
      setErrorMessage(message)
    } finally {
      setLoading(false)
    }
  }, [businessId])

  useEffect(() => {
    void loadPayouts()
  }, [loadPayouts])

  useEffect(() => {
    if (!businessId) return
    const firstRun = runs[0]
    if (!firstRun || firstPayrollTrackedRef.current) return
    firstPayrollTrackedRef.current = true
    emitPayrollEvent('business_first_payroll_visible', {
      runId: firstRun.id,
      status: firstRun.status,
      totalItems: firstRun.total_items,
    })
  }, [businessId, runs])

  const formatDateTime = (value: any) => {
    if (!value) return null
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return null
    return date.toLocaleString()
  }

  return (
    <ScreenContainer topPadding={20}>
      <View className="rounded-[28px] border border-[#FF7A18]/40 bg-[#151A22] p-5">
        <Text className="text-[#FFB05A] text-[11px] uppercase tracking-[2px]">Payroll</Text>
        <Text className="text-white text-2xl font-semibold mt-3">Business account</Text>
        <Text className="text-gray-300 text-sm mt-2">
          Review recurring payroll templates and the payroll runs they produce.
        </Text>
      </View>

      <View className="mt-4 rounded-2xl border border-[#FFB05A]/20 bg-[#FFB05A]/10 px-4 py-4">
        <Text className="text-[#FFD7A6] text-sm font-semibold">First payroll flow</Text>
        <Text className="text-slate-200 text-xs mt-2">
          After funding the business account, add the people who should operate the account, then review payroll history and recurring payroll here.
        </Text>
      </View>

      {errorMessage ? (
        <View className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-4">
          <Text className="text-red-100 text-sm">{errorMessage}</Text>
        </View>
      ) : null}

      {loading ? (
        <View className="py-10 items-center justify-center">
          <ActivityIndicator size="small" color="#FFB05A" />
          <Text className="text-white mt-3">Loading payroll...</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
          <View className="mt-4 rounded-2xl border border-gray-800 bg-gray-900/80 p-4">
            <Text className="text-white text-base font-semibold">Recurring payroll</Text>
            <View className="mt-4 gap-3">
              {scheduledRuns.length ? scheduledRuns.map((run) => (
                <View key={String(run.id)} className="rounded-2xl border border-gray-800 bg-gray-950/45 px-4 py-4">
                  <View className="flex-row items-start justify-between gap-3">
                    <View className="flex-1">
                      <Text className="text-white text-sm font-semibold">{run.title || 'Recurring payroll'}</Text>
                      {run.cycle_key ? <Text className="text-gray-500 text-xs mt-1">Cycle {String(run.cycle_key)}</Text> : null}
                      <Text className="text-gray-400 text-xs mt-1">
                        Monthly on day {run.schedule_day_of_month || '-'} {'\u2022'} Next payroll {formatDateTime(run.next_run_at) || 'Not set'}
                      </Text>
                    </View>
                    <View className={`rounded-full border px-3 py-1 ${statusTone(String(run.status || 'draft'))}`}>
                      <Text className="text-[11px] font-semibold uppercase">{String(run.status || 'draft').replace(/_/g, ' ')}</Text>
                    </View>
                  </View>
                  <Text className="text-white text-sm font-semibold mt-3">{formatNgn(run.total_amount || 0)}</Text>
                  <Text className="text-gray-400 text-xs mt-1">
                    {Number(run.total_items || 0)} entries{run.generated_runs_count ? ` \u2022 ${run.generated_runs_count} generated run(s)` : ''}
                  </Text>
                </View>
              )) : (
                <Text className="text-gray-400 text-sm">No recurring payroll yet.</Text>
              )}
            </View>
          </View>

          <View className="mt-4 rounded-2xl border border-gray-800 bg-gray-900/80 p-4">
            <Text className="text-white text-base font-semibold">Payroll history</Text>
            <View className="mt-4 gap-3">
              {runs.length ? runs.map((run) => (
                <TouchableOpacity
                  key={String(run.id)}
                  activeOpacity={0.85}
                  onPress={() => {
                    emitPayrollEvent('business_first_payroll_opened', {
                      runId: run.id,
                      status: run.status,
                    })
                    router.push(`/business/payroll-run/${String(run.id)}` as any)
                  }}
                  className="rounded-2xl border border-gray-800 bg-gray-950/45 px-4 py-4"
                >
                  <View className="flex-row items-start justify-between gap-3">
                    <View className="flex-1">
                      <Text className="text-white text-sm font-semibold">{run.title || 'Payroll run'}</Text>
                      {run.period_label ? <Text className="text-gray-500 text-xs mt-1">{String(run.period_label)}</Text> : null}
                      {run.cycle_key ? <Text className="text-gray-500 text-xs mt-1">Cycle {String(run.cycle_key)}</Text> : null}
                      <Text className="text-gray-400 text-xs mt-1">{run.reference || 'Pending reference'}</Text>
                      <Text className="text-gray-500 text-xs mt-1">
                        {Number(run.total_items || 0)} entries
                        {run.review_ready ? ' \u2022 Review locked' : ''}
                        {run.approval_status ? ` \u2022 Approval ${String(run.approval_status).replace(/_/g, ' ')}` : ''}
                      </Text>
                      {run.period_starts_on || run.period_ends_on ? (
                        <Text className="text-gray-500 text-xs mt-1">
                          Period {String(run.period_starts_on || '-')} to {String(run.period_ends_on || '-')}
                        </Text>
                      ) : null}
                    </View>
                    <View className={`rounded-full border px-3 py-1 ${statusTone(String(run.status || 'draft'))}`}>
                      <Text className="text-[11px] font-semibold uppercase">{String(run.status || 'draft').replace(/_/g, ' ')}</Text>
                    </View>
                  </View>
                  <Text className="text-white text-sm font-semibold mt-3">{formatNgn(run.total_amount || 0)}</Text>
                  <Text className="text-gray-400 text-xs mt-1">
                    Successful {Number(run.successful_items_count || 0)} {'\u2022'} Pending {Number(run.pending_items_count || 0)} {'\u2022'} Failed {Number(run.failed_items_count || 0)}
                  </Text>
                  <Text className="text-[#FFB05A] text-xs font-medium mt-3">View payroll run</Text>
                </TouchableOpacity>
              )) : (
                <Text className="text-gray-400 text-sm">No payroll runs yet.</Text>
              )}
            </View>
          </View>
        </ScrollView>
      )}
    </ScreenContainer>
  )
}

export default BusinessPayoutsScreen
