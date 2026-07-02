import React, { useCallback, useEffect, useMemo, useState } from 'react'
import DateTimePicker from '@react-native-community/datetimepicker'
import * as FileSystem from 'expo-file-system/legacy'
import { Linking, Platform, ScrollView, Share, Text, TouchableOpacity, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import APP_CONFIG from '@/api/baseUrl'
import { getStoredAccessToken } from '@/api/client'
import Loader from '@/components/Loader'
import NotificationAlert from '@/components/notification'
import { createCircleStatement, exportCircleCsv, getCircleAuditSummary, listCircleStatements } from '@/api/circles'
import { buildApiErrorMessage } from '@/utils/apiErrorMessage'
import moneyFormat from '@/utils/moneyFormat'

type NoticeState = { message: string | null; error: boolean; data: unknown | null }

type AuditSummaryRecord = {
  circle_id?: string
  balance_cents?: number
  total_in_cents?: number
  total_out_cents?: number
  tx_count?: number
  last_tx_at?: string
}

type CircleStatementRecord = {
  id: string
  reference?: string
  range_key?: string
  range_label?: string
  date_from?: string
  date_to?: string
  resolved_date_from?: string
  resolved_date_to?: string
  status?: string
  output_format?: string
  created_at?: string
  generated_at?: string
  failure_reason?: string
  opening_balance_cents?: number
  closing_balance_cents?: number
  total_credits_cents?: number
  total_debits_cents?: number
  total_fees_cents?: number
  transaction_count?: number
  download_url?: string
}

type ApiErrorLike = {
  response?: {
    status?: number
    data?: unknown
  }
  message?: string
}

const RANGE_OPTIONS = [
  { key: 'this_month', label: 'This month' },
  { key: 'last_month', label: 'Last month' },
  { key: 'year_to_date', label: 'Year to date' },
  { key: 'last_12_months', label: '12 months' },
  { key: 'all_time', label: 'All time' },
  { key: 'custom', label: 'Custom' },
] as const

const STATUS_STYLES = {
  pending: 'border-amber-500/30 bg-amber-500/10 text-amber-100',
  ready: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100',
  failed: 'border-rose-500/30 bg-rose-500/10 text-rose-100',
} as const

const toDateOnly = (date: Date) => date.toISOString().slice(0, 10)

const formatTimestamp = (value?: string | null) => {
  if (!value) return 'No activity yet'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString('en-NG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const formatShortDate = (value?: string | null) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleDateString('en-NG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

const formatCents = (value?: number | null) => moneyFormat(Number(value || 0) / 100)

const dayDifference = (from: string, to: string) => {
  const fromDate = new Date(from)
  const toDate = new Date(to)
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) return Number.NaN
  return Math.floor((toDate.getTime() - fromDate.getTime()) / 86_400_000)
}


const sanitizeFilenamePart = (value?: string | null) =>
  String(value || 'circle-statement')
    .replace(/[^a-z0-9_-]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'circle-statement'

const statementDownloadFilename = (statement: CircleStatementRecord) => {
  const extension = String(statement?.output_format || 'pdf').toLowerCase() === 'csv' ? 'csv' : 'pdf'
  const reference = sanitizeFilenamePart(statement?.reference)
  return reference + '.' + extension
}

const safeFilenameBase = (value: string) =>
  value
    .trim()
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/\.+$/g, '')
    .trim()

const openDownloadedStatement = async (uri: string) => {
  if (Platform.OS === 'ios') {
    await Share.share({ url: uri, title: 'Circle statement' })
    return
  }

  if (Platform.OS === 'android') {
    const contentUri = await FileSystem.getContentUriAsync(uri)
    await Linking.openURL(contentUri)
    return
  }

  await Linking.openURL(uri)
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

const SummaryTile = ({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'good' | 'warn' }) => {
  const toneClass = tone === 'good' ? 'text-emerald-300' : tone === 'warn' ? 'text-rose-300' : 'text-white'
  return (
    <View className="rounded-2xl border border-gray-800 bg-gray-950 px-4 py-4 min-w-[47%] flex-1">
      <Text className="text-gray-400 text-[10px] uppercase tracking-widest">{label}</Text>
      <Text className={`mt-2 text-sm font-semibold ${toneClass}`}>{value}</Text>
    </View>
  )
}

const AuditSummaryScreen = () => {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>()
  const circleId = Array.isArray(id) ? id[0] : id
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportingDues, setExportingDues] = useState(false)
  const [summary, setSummary] = useState<AuditSummaryRecord | null>(null)
  const [notice, setNotice] = useState<NoticeState>({ message: null, error: false, data: null })
  const [forbidden, setForbidden] = useState(false)
  const [statements, setStatements] = useState<CircleStatementRecord[]>([])
  const [statementsLoading, setStatementsLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [rangeKey, setRangeKey] = useState<typeof RANGE_OPTIONS[number]['key']>('this_month')
  const [outputFormat, setOutputFormat] = useState<'pdf' | 'csv'>('pdf')
  const [dateFrom, setDateFrom] = useState(() => {
    const today = new Date()
    return toDateOnly(new Date(today.getFullYear(), today.getMonth(), 1))
  })
  const [dateTo, setDateTo] = useState(() => toDateOnly(new Date()))
  const [pickerField, setPickerField] = useState<'date_from' | 'date_to' | null>(null)

  const loadSummary = useCallback(async () => {
    if (!circleId) return
    setLoading(true)
    setForbidden(false)
    setNotice({ message: null, error: false, data: null })
    try {
      const payload = await getCircleAuditSummary(circleId) as { data?: AuditSummaryRecord } | AuditSummaryRecord
      setSummary((payload?.data ?? payload) as AuditSummaryRecord)
    } catch (error) {
      const err = error as ApiErrorLike
      const status = err?.response?.status
      if (status === 401) return
      if (status === 403) {
        setForbidden(true)
        setSummary(null)
        setNotice({
          message: 'Circle records are visible to owners, admins, and treasurers only.',
          error: true,
          data: null,
        })
        return
      }
      const message = buildApiErrorMessage({
        status,
        data: err?.response?.data,
        fallback: err?.message || 'Unable to load records summary',
      })
      setNotice({ message, error: true, data: null })
    } finally {
      setLoading(false)
    }
  }, [circleId])

  const loadStatements = useCallback(async (silent = false) => {
    if (!circleId || forbidden) return
    if (!silent) setStatementsLoading(true)
    try {
      const payload = await listCircleStatements(circleId) as { data?: CircleStatementRecord[] } | CircleStatementRecord[]
      setStatements(Array.isArray(payload?.data) ? payload.data : [])
    } catch (error) {
      const err = error as ApiErrorLike
      if (!silent) {
        const message = buildApiErrorMessage({
          status: err?.response?.status,
          data: err?.response?.data,
          fallback: err?.message || 'Unable to load statements',
        })
        setNotice({ message, error: true, data: null })
      }
    } finally {
      if (!silent) setStatementsLoading(false)
    }
  }, [circleId, forbidden])

  useEffect(() => {
    loadSummary()
  }, [loadSummary])

  useEffect(() => {
    loadStatements()
  }, [loadStatements])

  const hasPendingStatements = useMemo(
    () => statements.some((statement) => statement?.status === 'pending'),
    [statements]
  )

  useEffect(() => {
    if (!hasPendingStatements) return undefined
    const timeoutId = setTimeout(() => {
      loadStatements(true)
    }, 15000)
    return () => clearTimeout(timeoutId)
  }, [hasPendingStatements, loadStatements, statements])

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

  const handleExport = async () => {
    if (!circleId || forbidden) return
    setExporting(true)
    setNotice({ message: null, error: false, data: null })
    try {
      const payloadAny = await exportCircleCsv(circleId) as { data?: Record<string, unknown> } | Record<string, unknown>
      const payload = payloadAny?.data ?? payloadAny
      const url = payload?.url || payload?.link || payload?.download_url || payload?.downloadUrl || null
      if (url) {
        await Linking.openURL(String(url))
      } else {
        setNotice({
          message: 'Export requested. Check your email or dashboard for the file.',
          error: false,
          data: payload || null,
        })
      }
    } catch (error) {
      const err = error as ApiErrorLike
      const status = err?.response?.status
      if (status === 401) return
      if (status === 403) {
        setForbidden(true)
        setNotice({
          message: 'Circle record exports are visible to owners, admins, and treasurers only.',
          error: true,
          data: null,
        })
        return
      }
      const message = buildApiErrorMessage({
        status,
        data: err?.response?.data,
        fallback: err?.message || 'Unable to export CSV',
      })
      setNotice({ message, error: true, data: null })
    } finally {
      setExporting(false)
    }
  }

  const handleExportDuesStatement = async () => {
    if (!circleId || forbidden) return

    setExportingDues(true)
    setNotice({ message: null, error: false, data: null })

    try {
      const accessToken = await getStoredAccessToken()
      if (!accessToken) throw new Error('Your session expired. Please sign in again.')

      const localBaseDir = FileSystem.cacheDirectory || FileSystem.documentDirectory
      if (!localBaseDir) throw new Error('No local directory available for downloads')

      const filename = `${safeFilenameBase(`circle-${circleId}-dues-statement`) || `circle-${circleId}-dues-statement`}.pdf`
      const fileUri = localBaseDir + filename
      const downloadUrl = `${String(APP_CONFIG.api_base_url || '').replace(/\/+$/, '')}/circles/${circleId}/dues_statement_pdf`

      const downloaded = await FileSystem.downloadAsync(downloadUrl, fileUri, {
        headers: {
          Accept: 'application/pdf',
          Authorization: `Bearer ${accessToken}`,
        },
      })

      if (downloaded.status !== 200) {
        throw new Error(`Unable to download dues statement (${downloaded.status}).`)
      }

      await Share.share({
        title: filename,
        message: `PDF saved to ${downloaded.uri}`,
        url: downloaded.uri,
      })

      setNotice({
        message: 'Printable dues statement is ready to share or save.',
        error: false,
        data: null,
      })
    } catch (error) {
      const err = error as ApiErrorLike
      const message = buildApiErrorMessage({
        status: err?.response?.status,
        data: err?.response?.data,
        fallback: err?.message || 'Unable to export dues statement',
      })
      setNotice({ message, error: true, data: null })
    } finally {
      setExportingDues(false)
    }
  }

  const handleRequestStatement = async () => {
    if (!circleId || forbidden || submitting) return
    if (rangeKey === 'custom') {
      if (!dateFrom || !dateTo || dateTo < dateFrom || dayDifference(dateFrom, dateTo) > 366) {
        setNotice({
          message: 'Select a valid custom statement period within 366 days.',
          error: true,
          data: null,
        })
        return
      }
    }

    setSubmitting(true)
    setNotice({ message: null, error: false, data: null })
    try {
      const payload: Record<string, unknown> = {
        range_key: rangeKey,
        output_format: outputFormat,
      }
      if (rangeKey === 'custom') {
        payload.date_from = dateFrom
        payload.date_to = dateTo
      }
      const response = await createCircleStatement(circleId, payload) as { data?: CircleStatementRecord } | CircleStatementRecord
      const statement = (response?.data ?? response) as CircleStatementRecord
      setStatements((current) => [statement, ...current.filter((item) => item.id !== statement?.id)])
      setNotice({
        message: 'Statement request submitted. We will prepare it shortly.',
        error: false,
        data: null,
      })
    } catch (error) {
      const err = error as ApiErrorLike
      const message = buildApiErrorMessage({
        status: err?.response?.status,
        data: err?.response?.data,
        fallback: err?.message || 'Unable to request statement',
      })
      setNotice({ message, error: true, data: null })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDownloadStatement = async (statement: CircleStatementRecord) => {
    if (!statement?.download_url) return

    setNotice({ message: 'Preparing your statement download...', error: false, data: null })

    try {
      const downloadUrl = String(statement.download_url)
      const localBaseDir = FileSystem.cacheDirectory || FileSystem.documentDirectory
      if (!localBaseDir) throw new Error('No local directory available for downloads')

      const localUri = localBaseDir + statementDownloadFilename(statement)
      const downloaded = await FileSystem.downloadAsync(downloadUrl, localUri)
      await openDownloadedStatement(downloaded.uri)
      setNotice({
        message: Platform.OS === 'ios'
          ? 'Statement ready. Choose where you want to open or save the file.'
          : 'Statement ready. Your device should open the file now.',
        error: false,
        data: null,
      })
    } catch {
      try {
        await Linking.openURL(String(statement.download_url))
        setNotice({
          message: 'Your statement is ready. We opened the download in your browser because the device could not open the local file directly.',
          error: false,
          data: null,
        })
      } catch {
        setNotice({
          message: 'Unable to open the statement download right now. Please try again.',
          error: true,
          data: null,
        })
      }
    }
  }

  const handleDateChange = (_event: unknown, value?: Date) => {
    if (Platform.OS !== 'ios') setPickerField(null)
    if (!value || !pickerField) return
    const next = toDateOnly(value)
    if (pickerField === 'date_from') setDateFrom(next)
    else setDateTo(next)
  }

  return (
    <View className="flex-1 bg-primary">
      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingTop: 40, paddingBottom: 48, gap: 16 }}>
        <View>
          <Text className="text-white text-2xl mb-2">Records</Text>
          <Text className="text-gray-300">
            Review summary, generate formal treasury statements, and export the circle ledger when needed.
          </Text>
        </View>

        <NotificationAlert message={notice.message} data={notice.data} error={notice.error} />

        {forbidden ? (
          <View className="bg-gray-900 p-5 rounded-2xl border border-amber-500/30">
            <Text className="text-white font-semibold">Manager access only</Text>
            <Text className="text-gray-300 text-sm mt-2">
              Circle records are visible to owners, admins, and treasurers only.
            </Text>
          </View>
        ) : null}

        {summary && metrics ? (
          <>
            <View className="bg-gray-900 p-5 rounded-2xl border border-gray-800">
              <Text className="text-white font-semibold text-base">Summary</Text>
              <Text className="text-gray-400 text-xs mt-1">
                Snapshot of treasury movement and posted ledger activity.
              </Text>
              <View className="flex-row flex-wrap justify-between mt-4 gap-y-3">
                <AuditMetric label="Total in" value={metrics.raised} tone="good" />
                <AuditMetric label="Total out" value={metrics.paidOut} tone="warn" />
                <AuditMetric label="Balance" value={metrics.balance} />
                <AuditMetric label="Records" value={metrics.txCount} />
              </View>
            </View>

            <View className="bg-gray-900 p-5 rounded-2xl border border-gray-800">
              <Text className="text-white font-semibold text-base">Recent activity</Text>
              <Text className="text-gray-300 text-sm mt-2">Last ledger update: {metrics.lastActivity}</Text>
            </View>
          </>
        ) : !forbidden ? (
          <View className="bg-gray-900 p-4 rounded-xl border border-gray-800">
            <Text className="text-gray-300 text-center">No audit summary available.</Text>
          </View>
        ) : null}

        {!forbidden ? (
          <View className="bg-gray-900 p-5 rounded-2xl border border-gray-800">
            <Text className="text-white font-semibold text-base">Statements</Text>
            <Text className="text-gray-400 text-xs mt-1">
              Generate a formal treasury statement with balances, credits, debits, fees, and posted records.
            </Text>

            <View className="mt-4 flex-row flex-wrap gap-2">
              {RANGE_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.key}
                  onPress={() => setRangeKey(option.key)}
                  className={`rounded-full border px-3 py-2 ${
                    rangeKey === option.key
                      ? 'border-cyan-400/40 bg-cyan-400/10'
                      : 'border-gray-700 bg-gray-950'
                  }`}
                >
                  <Text className={`${rangeKey === option.key ? 'text-cyan-100' : 'text-gray-300'} text-[11px] font-semibold uppercase tracking-[1px]`}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View className="mt-4 flex-row gap-3">
              <TouchableOpacity
                onPress={() => setOutputFormat('pdf')}
                className={`flex-1 rounded-2xl border px-4 py-4 ${outputFormat === 'pdf' ? 'border-cyan-400/40 bg-cyan-400/10' : 'border-gray-800 bg-gray-950'}`}
              >
                <Text className={`text-center text-sm font-semibold ${outputFormat === 'pdf' ? 'text-cyan-100' : 'text-white'}`}>PDF</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setOutputFormat('csv')}
                className={`flex-1 rounded-2xl border px-4 py-4 ${outputFormat === 'csv' ? 'border-cyan-400/40 bg-cyan-400/10' : 'border-gray-800 bg-gray-950'}`}
              >
                <Text className={`text-center text-sm font-semibold ${outputFormat === 'csv' ? 'text-cyan-100' : 'text-white'}`}>CSV</Text>
              </TouchableOpacity>
            </View>

            {rangeKey === 'custom' ? (
              <View className="mt-4 gap-3">
                <TouchableOpacity onPress={() => setPickerField('date_from')} className="rounded-2xl border border-gray-800 bg-gray-950 px-4 py-4">
                  <Text className="text-[10px] uppercase tracking-widest text-gray-500">Start date</Text>
                  <Text className="mt-2 text-sm font-semibold text-white">{formatShortDate(dateFrom)}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setPickerField('date_to')} className="rounded-2xl border border-gray-800 bg-gray-950 px-4 py-4">
                  <Text className="text-[10px] uppercase tracking-widest text-gray-500">End date</Text>
                  <Text className="mt-2 text-sm font-semibold text-white">{formatShortDate(dateTo)}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View className="mt-4 rounded-2xl border border-gray-800 bg-gray-950 px-4 py-4">
                <Text className="text-[10px] uppercase tracking-widest text-gray-500">Selected period</Text>
                <Text className="mt-2 text-sm font-semibold text-white">
                  {RANGE_OPTIONS.find((item) => item.key === rangeKey)?.label || 'This month'}
                </Text>
                <Text className="mt-2 text-xs text-gray-400">
                  Large ranges like yearly or all-time statements may take longer to prepare.
                </Text>
              </View>
            )}

            {pickerField ? (
              <DateTimePicker
                value={new Date(pickerField === 'date_from' ? dateFrom : dateTo)}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleDateChange}
                maximumDate={new Date()}
              />
            ) : null}

            <TouchableOpacity
              onPress={handleRequestStatement}
              disabled={submitting}
              className={`rounded-2xl py-4 mt-4 ${submitting ? 'bg-gray-700' : 'bg-theme-primary'}`}
            >
              <Text className="text-alt font-medium text-center">
                {submitting ? 'Submitting...' : 'Generate statement'}
              </Text>
            </TouchableOpacity>

            <View className="mt-5">
              <View className="flex-row items-center justify-between">
                <Text className="text-white font-semibold text-base">Recent statements</Text>
                <TouchableOpacity onPress={() => loadStatements()} className="rounded-full border border-gray-700 bg-gray-950 px-3 py-2">
                  <Text className="text-[11px] font-semibold uppercase tracking-[1px] text-gray-300">Refresh</Text>
                </TouchableOpacity>
              </View>
              <Text className="text-gray-400 text-xs mt-1">Pending requests update automatically when they are ready.</Text>

              {statementsLoading ? (
                <View className="mt-4 rounded-2xl border border-gray-800 bg-gray-950 px-4 py-4">
                  <Text className="text-gray-300">Loading statements...</Text>
                </View>
              ) : statements.length === 0 ? (
                <View className="mt-4 rounded-2xl border border-gray-800 bg-gray-950 px-4 py-4">
                  <Text className="text-gray-300">No statements yet. Generate one when you need a formal treasury record.</Text>
                </View>
              ) : (
                <View className="mt-4 gap-3">
                  {statements.map((statement) => {
                    const statusClass = STATUS_STYLES[String(statement.status || '').toLowerCase() as keyof typeof STATUS_STYLES] || 'border-gray-700 bg-gray-950 text-gray-200'
                    return (
                      <View key={statement.id} className="rounded-2xl border border-gray-800 bg-gray-950 px-4 py-4">
                        <View className="flex-row items-start justify-between gap-3">
                          <View className="flex-1">
                            <View className="flex-row flex-wrap items-center gap-2">
                              <Text className="text-sm font-semibold text-white">{statement.reference || 'Circle statement'}</Text>
                              <View className={`rounded-full border px-2 py-1 ${statusClass}`}>
                                <Text className="text-[10px] font-semibold uppercase tracking-[1px]">{statement.status || 'pending'}</Text>
                              </View>
                            </View>
                            <Text className="mt-2 text-sm text-gray-300">
                              {statement.range_label || 'Custom range'} • {formatShortDate(statement.resolved_date_from || statement.date_from)} to {formatShortDate(statement.resolved_date_to || statement.date_to)}
                            </Text>
                            <Text className="mt-1 text-xs text-gray-500">
                              Requested {formatTimestamp(statement.created_at)}
                              {statement.generated_at ? ` • Ready ${formatTimestamp(statement.generated_at)}` : ''}
                            </Text>
                          </View>
                          {statement.download_url ? (
                            <TouchableOpacity onPress={() => handleDownloadStatement(statement)} className="rounded-xl bg-emerald-600 px-3 py-2">
                              <Text className="text-[11px] font-semibold uppercase tracking-[1px] text-white">
                                {String(statement.output_format || 'pdf').toUpperCase()}
                              </Text>
                            </TouchableOpacity>
                          ) : null}
                        </View>

                        {statement.failure_reason ? (
                          <View className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-3">
                            <Text className="text-sm text-rose-100">{statement.failure_reason}</Text>
                          </View>
                        ) : null}

                        {statement.status === 'ready' ? (
                          <View className="mt-4 flex-row flex-wrap gap-3">
                            <SummaryTile label="Opening" value={formatCents(statement.opening_balance_cents)} />
                            <SummaryTile label="Closing" value={formatCents(statement.closing_balance_cents)} />
                            <SummaryTile label="Credits" value={formatCents(statement.total_credits_cents)} tone="good" />
                            <SummaryTile label="Debits" value={formatCents(statement.total_debits_cents)} tone="warn" />
                            <SummaryTile label="Records" value={String(statement.transaction_count || 0)} />
                          </View>
                        ) : null}
                      </View>
                    )
                  })}
                </View>
              )}
            </View>
          </View>
        ) : null}

        {!forbidden ? (
          <TouchableOpacity
            onPress={handleExportDuesStatement}
            disabled={exporting || exportingDues || submitting}
            className={`${exportingDues ? 'bg-gray-700' : 'bg-theme-primary'} py-4 rounded-xl border border-transparent`}
          >
            <Text className="text-alt text-center font-medium">
              {exportingDues ? 'Preparing dues statement...' : 'Export dues statement'}
            </Text>
          </TouchableOpacity>
        ) : null}

        {!forbidden ? (
          <TouchableOpacity onPress={handleExport} className={`${exporting ? 'bg-gray-700' : 'bg-gray-900'} py-4 rounded-xl border border-gray-800`}>
            <Text className="text-white text-center font-medium">{exporting ? 'Exporting...' : 'Export CSV'}</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>

      <Loader open={loading || exporting || exportingDues || submitting} />
    </View>
  )
}

export default AuditSummaryScreen


