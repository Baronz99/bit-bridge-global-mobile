import React, { useCallback, useEffect, useState } from 'react'
import { Linking, Text, TouchableOpacity, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import Loader from '@/components/Loader'
import NotificationAlert from '@/components/notification'
import { exportCircleCsv, getCircleAuditSummary } from '@/api/circles'
import { useAuth } from '@/services/useAuth'
import { buildApiErrorMessage } from '@/utils/apiErrorMessage'

type NoticeState = { message: string | null; error: boolean; data: any | null }

const AuditSummaryScreen = () => {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>()
  const circleId = Array.isArray(id) ? id[0] : id

  const { onLogout } = useAuth()
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [summary, setSummary] = useState<any | null>(null)
  const [notice, setNotice] = useState<NoticeState>({
    message: null,
    error: false,
    data: null })

  const loadSummary = useCallback(async () => {
    if (!circleId) return
    setLoading(true)
    setNotice({ message: null, error: false, data: null })
    try {
      const response = await getCircleAuditSummary(circleId)
      const payload: any = response
      setSummary(payload?.data ?? payload)
    } catch (error: any) {
      const status = error?.response?.status
      if (status === 401) {
        return
      }
      const message = buildApiErrorMessage({
        status,
        data: error?.response?.data,
        fallback: error?.message || 'Unable to load audit summary' })
      setNotice({ message, error: true, data: null })
    } finally {
      setLoading(false)
    }
  }, [circleId, onLogout])

  useEffect(() => {
    loadSummary()
  }, [loadSummary])

  const handleExport = async () => {
    if (!circleId) return
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
          data: payload || null })
      }
    } catch (error: any) {
      const status = error?.response?.status
      if (status === 401) {
        return
      }
      const message = buildApiErrorMessage({
        status,
        data: error?.response?.data,
        fallback: error?.message || 'Unable to export CSV' })
      setNotice({ message, error: true, data: null })
    } finally {
      setExporting(false)
    }
  }

  return (
    <View className="flex-1 bg-primary px-4">
      <View className="pt-10">
        <Text className="text-white text-2xl mb-2">Audit Summary</Text>
        <Text className="text-gray-300 mb-6">Review circle activity and export.</Text>

        <NotificationAlert message={notice.message} data={notice.data} error={notice.error} />

        {summary ? (
          <View className="bg-gray-900 p-4 rounded-xl">
            <Text className="text-white font-semibold mb-2">Summary</Text>
            {Object.entries(summary).map(([key, value]) => (
              <View key={key} className="flex-row justify-between py-1">
                <Text className="text-gray-400 text-xs">{key}</Text>
                <Text className="text-gray-200 text-xs">
                  {typeof value === 'string' || typeof value === 'number'
                    ? String(value)
                    : JSON.stringify(value)}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <View className="bg-gray-900 p-4 rounded-xl">
            <Text className="text-gray-300 text-center">No audit summary available.</Text>
          </View>
        )}

        <TouchableOpacity
          onPress={loadSummary}
          className="bg-gray-900 py-4 mt-4 rounded-xl"
        >
          <Text className="text-white text-center">Refresh Summary</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleExport}
          className={`${exporting ? 'bg-gray-700' : 'bg-theme-primary'} py-5 mt-4 rounded-xl`}
          disabled={exporting}
        >
          <Text className="text-alt font-medium text-center">Export CSV</Text>
        </TouchableOpacity>
      </View>

      <Loader open={loading || exporting} />
    </View>
  )
}

export default AuditSummaryScreen


