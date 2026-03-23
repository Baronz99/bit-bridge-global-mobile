import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Linking, Text, TouchableOpacity, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import Loader from '@/components/Loader'
import NotificationAlert from '@/components/notification'
import { exportCircleCsv, getCircleAuditSummary } from '@/api/circles'
import { buildApiErrorMessage } from '@/utils/apiErrorMessage'
import moneyFormat from '@/utils/moneyFormat'

type NoticeState = { message: string | null; error: boolean; data: any | null }

type AuditSummaryRecord = {
  circle_id?: string
  balance_cents?: number
  total_in_cents?: number
  total_out_cents?: number
  tx_count?: number
  last_tx_at?: string
}

const formatTimestamp = (value?: string | null) => {
  if (!value) return 'No activity yet'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString('en-NG', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const AuditMetric = ({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'good' | 'warn' }) => {
  const toneClass = tone === 'good' ? 'text-emerald-300' : tone === 'warn' ? 'text-amber-200' : 'text-white'
  return (
    <View className="rounded-2xl border border-gray-800 bg-gray-950 px-4 py-4 w-[48%]">
      <Text className="text-gray-400 text-[10px] uppercase tracking-widest">{label}</Text>
      <Text className={`mt-2 text-base font-semibold ${toneClass}`}>{value}</Text>
    </View>
  )
}

const AuditSummaryScreen = () => {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>()
  const circleId = Array.isArray(id) ? id[0] : id

  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [summary, setSummary] = useState<AuditSummaryRecord | null>(null)
  const [notice, setNotice] = useState<NoticeState>({
    message: null,
    error: false,
    data: null,
  })
  const [forbidden, setForbidden] = useState(false)

  const loadSummary = useCallback(async () => {
    if (!circleId) return
    setLoading(true)
    setForbidden(false)
    setNotice({ message: null, error: false, data: null })
    try {
      const response = await getCircleAuditSummary(circleId)
      const payload: any = response
      setSummary((payload?.data ?? payload) as AuditSummaryRecord)
    } catch (error: any) {
      const status = error?.response?.status
      if (status === 401) {
        return
      }
      if (status === 403) {
        setForbidden(true)
        setSummary(null)
        setNotice({
          message: 'Campaign audit data is visible to founders-circle managers only.',
          error: true,
          data: null,
        })
        return
      }
      const message = buildApiErrorMessage({
        status,
        data: error?.response?.data,
        fallback: error?.message || 'Unable to load audit summary',
      })
      setNotice({ message, error: true, data: null })
    } finally {
      setLoading(false)
    }
  }, [circleId])

  useEffect(() => {
    loadSummary()
  }, [loadSummary])

  const handleExport = async () => {
    if (!circleId || forbidden) return
    setExporting(true)
    setNotice({ message: null, error: false, data: null })
    try {
      const response = await exportCircleCsv(circleId)
      const payloadAny: any = response
      const payload = payloadAny?.data ?? payloadAny
      const url =
        payload?.url ||
        payload?.link ||
        payload?.download_url ||
        payload?.downloadUrl ||
        null
      if (url) {
        await Linking.openURL(String(url))
      } else {
        setNotice({
          message: 'Export requested. Check your email or dashboard for the file.',
          error: false,
          data: payload || null,
        })
      }
    } catch (error: any) {
      const status = error?.response?.status
      if (status === 401) {
        return
      }
      if (status === 403) {
        setForbidden(true)
        setNotice({
          message: 'Campaign audit exports are visible to founders-circle managers only.',
          error: true,
          data: null,
        })
        return
      }
      const message = buildApiErrorMessage({
        status,
        data: error?.response?.data,
        fallback: error?.message || 'Unable to export CSV',
      })
      setNotice({ message, error: true, data: null })
    } finally {
      setExporting(false)
    }
  }

  const metrics = useMemo(() => {
    if (!summary) return null
    return {
      raised: moneyFormat(Number(summary.total_in_cents || 0) / 100),
      paidOut: moneyFormat(Number(summary.total_out_cents || 0) / 100),
      balance: moneyFormat(Number(summary.balance_cents || 0) / 100),
      txCount: String(summary.tx_count || 0),
      lastActivity: formatTimestamp(summary.last_tx_at),
    }
  }, [summary])

  return (
    <View className="flex-1 bg-primary px-4">
      <View className="pt-10">
        <Text className="text-white text-2xl mb-2">Campaign audit</Text>
        <Text className="text-gray-300 mb-6">
          Review campaign totals, payout movement, and export the ledger when needed.
        </Text>

        <NotificationAlert message={notice.message} data={notice.data} error={notice.error} />

        {forbidden ? (
          <View className="bg-gray-900 p-5 rounded-2xl border border-amber-500/30">
            <Text className="text-white font-semibold">Manager access only</Text>
            <Text className="text-gray-300 text-sm mt-2">
              Founders-circle audit data is hidden from members to keep supporter records private.
            </Text>
          </View>
        ) : summary && metrics ? (
          <>
            <View className="bg-gray-900 p-5 rounded-2xl border border-gray-800">
              <Text className="text-white font-semibold text-base">Summary</Text>
              <Text className="text-gray-400 text-xs mt-1">
                Snapshot of campaign cash flow and ledger activity.
              </Text>

              <View className="flex-row flex-wrap justify-between mt-4 gap-y-3">
                <AuditMetric label="Total raised" value={metrics.raised} tone="good" />
                <AuditMetric label="Total paid out" value={metrics.paidOut} tone="warn" />
                <AuditMetric label="Current balance" value={metrics.balance} />
                <AuditMetric label="Ledger entries" value={metrics.txCount} />
              </View>
            </View>

            <View className="bg-gray-900 p-5 rounded-2xl border border-gray-800 mt-4">
              <Text className="text-white font-semibold text-base">Recent activity</Text>
              <Text className="text-gray-300 text-sm mt-2">Last ledger update: {metrics.lastActivity}</Text>
              {summary.circle_id ? (
                <Text className="text-gray-500 text-xs mt-2">Circle ID: {summary.circle_id}</Text>
              ) : null}
            </View>
          </>
        ) : (
          <View className="bg-gray-900 p-4 rounded-xl border border-gray-800">
            <Text className="text-gray-300 text-center">No audit summary available.</Text>
          </View>
        )}

        <TouchableOpacity
          onPress={loadSummary}
          className="bg-gray-900 py-4 mt-4 rounded-xl border border-gray-800"
        >
          <Text className="text-white text-center">Refresh Summary</Text>
        </TouchableOpacity>

        {!forbidden ? (
          <TouchableOpacity
            onPress={handleExport}
            className={`${exporting ? 'bg-gray-700' : 'bg-theme-primary'} py-5 mt-4 rounded-xl`}
            disabled={exporting}
          >
            <Text className="text-alt font-medium text-center">Export CSV</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <Loader open={loading || exporting} />
    </View>
  )
}

export default AuditSummaryScreen
