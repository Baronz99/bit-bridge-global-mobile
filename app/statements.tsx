import DateTimePicker from '@react-native-community/datetimepicker'
import * as FileSystem from 'expo-file-system/legacy'
import { Stack } from 'expo-router'
import React, { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Platform,
  Pressable,
  Share,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'

import {
  AccountStatementRecord,
  createAccountStatement,
  listAccountStatements,
} from '@/api/accountStatements'
import ScreenContainer from '@/components/ScreenContainer'
import { buildApiErrorMessage } from '@/utils/apiErrorMessage'

type PickerField = 'date_from' | 'date_to' | null

type ApiErrorLike = {
  message?: string
  response?: {
    status?: number
    data?: unknown
  }
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'border-amber-400/30 bg-amber-400/10 text-amber-100',
  ready: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100',
  failed: 'border-rose-400/30 bg-rose-400/10 text-rose-100',
}

const READY_SEPARATOR = ' - '

const toDateOnly = (date: Date) => date.toISOString().slice(0, 10)

const formatDate = (value?: string | null) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('en-NG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date)
}

const formatDateTime = (value?: string | null) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('en-NG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

const formatMoneyFromCents = (value?: number | null) => {
  const amount = Number(value || 0) / 100
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

const dayDifference = (from: string, to: string) => {
  const fromDate = new Date(from)
  const toDate = new Date(to)
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) return Number.NaN
  return Math.floor((toDate.getTime() - fromDate.getTime()) / 86_400_000)
}

const safeFilenameBase = (value: string) =>
  String(value || 'statement')
    .trim()
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '') || 'statement'

const statementFilename = (statement: AccountStatementRecord) => {
  const from = safeFilenameBase(statement?.date_from || '')
  const to = safeFilenameBase(statement?.date_to || '')

  if (from && to) {
    return `bitbridge-global-statement-${from}-to-${to}.pdf`
  }

  const reference = safeFilenameBase(statement?.reference || 'bitbridge-global-account-statement')
  return `${reference}.pdf`
}

const shareDownloadedStatement = async (uri: string, filename: string) => {
  await Share.share({
    title: filename,
    message: `PDF saved to ${uri}`,
    url: uri,
  })
}

const SummaryTile = ({ label, value }: { label: string; value: string }) => (
  <View className="min-w-[47%] flex-1 rounded-2xl border border-white/10 bg-[#0D1526] px-4 py-4">
    <Text className="text-[11px] font-semibold uppercase tracking-[1.2px] text-[#7C8AA5]">{label}</Text>
    <Text className="mt-2 text-base font-semibold text-white">{value}</Text>
  </View>
)

export default function StatementsScreen() {
  const [statements, setStatements] = useState<AccountStatementRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [requestNotice, setRequestNotice] = useState<{ message: string | null; error: boolean }>({
    message: null,
    error: false,
  })
  const [activityNotice, setActivityNotice] = useState<{ message: string | null; error: boolean }>({
    message: null,
    error: false,
  })
  const [pickerField, setPickerField] = useState<PickerField>(null)
  const [dateFrom, setDateFrom] = useState(() => {
    const today = new Date()
    return toDateOnly(new Date(today.getFullYear(), today.getMonth(), 1))
  })
  const [dateTo, setDateTo] = useState(() => toDateOnly(new Date()))

  const hasPendingStatements = useMemo(
    () => statements.some((statement) => String(statement?.status || '').toLowerCase() === 'pending'),
    [statements]
  )

  const loadStatements = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true)
    setActivityNotice((current) => ({
      ...current,
      message: silent ? current.message : null,
      error: silent ? current.error : false,
    }))

    try {
      const data = await listAccountStatements()
      setStatements(data)
    } catch (error) {
      const err = error as ApiErrorLike
      const message = buildApiErrorMessage({
        status: err?.response?.status,
        data: err?.response?.data,
        fallback: err?.message || 'Unable to load statements right now.',
      })
      setActivityNotice({ message, error: true })
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    void loadStatements()
  }, [])

  useEffect(() => {
    if (!hasPendingStatements) return undefined

    const timeoutId = setTimeout(() => {
      void loadStatements({ silent: true })
    }, 15000)

    return () => clearTimeout(timeoutId)
  }, [hasPendingStatements, statements])

  const validateRange = () => {
    if (!dateFrom || !dateTo) {
      setRequestNotice({ message: 'Select a valid statement period.', error: true })
      return false
    }
    if (dateTo < dateFrom) {
      setRequestNotice({ message: 'End date must be on or after the start date.', error: true })
      return false
    }
    if (dayDifference(dateFrom, dateTo) > 90) {
      setRequestNotice({ message: 'Statement range must be within 90 days.', error: true })
      return false
    }
    return true
  }

  const handleRequestStatement = async () => {
    if (submitting) return
    if (!validateRange()) return

    setSubmitting(true)
    setRequestNotice({ message: null, error: false })
    try {
      const statement = await createAccountStatement({
        date_from: dateFrom,
        date_to: dateTo,
      })
      if (statement?.id) {
        setStatements((current) => [statement, ...current.filter((item) => item.id !== statement.id)])
      }
      setRequestNotice({
        message: 'Statement request submitted. Your request is now being prepared and has been added below as pending.',
        error: false,
      })
    } catch (error) {
      const err = error as ApiErrorLike
      const message = buildApiErrorMessage({
        status: err?.response?.status,
        data: err?.response?.data,
        fallback: err?.message || 'Unable to request a statement right now.',
      })
      setRequestNotice({ message, error: true })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDownloadStatement = async (statement: AccountStatementRecord) => {
    if (!statement?.download_url) return

    setActivityNotice({ message: 'Preparing your statement download...', error: false })

    try {
      const localBaseDir = FileSystem.cacheDirectory || FileSystem.documentDirectory
      if (!localBaseDir) throw new Error('No local directory available for downloads')

      const filename = statementFilename(statement)
      const localUri = localBaseDir + filename
      const downloaded = await FileSystem.downloadAsync(String(statement.download_url), localUri)
      if (downloaded.status !== 200) {
        throw new Error(`Unable to download statement (${downloaded.status}).`)
      }

      await shareDownloadedStatement(downloaded.uri, filename)
      setActivityNotice({ message: 'Statement ready. Choose where you want to open or save the file.', error: false })
    } catch (error) {
      const err = error as ApiErrorLike
      setActivityNotice({
        message: err?.message || 'Unable to prepare the statement file on this device right now. Please try again.',
        error: true,
      })
    }
  }

  const onDateChange = (_event: unknown, value?: Date) => {
    if (Platform.OS !== 'ios') setPickerField(null)
    if (!value || !pickerField) return
    const next = toDateOnly(value)
    if (pickerField === 'date_from') setDateFrom(next)
    else setDateTo(next)
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Statements' }} />
      <ScreenContainer topPadding={18} className="flex-1 bg-[#07111F]">
        <View className="rounded-3xl border border-white/10 bg-[#121B2D] px-5 py-5">
          <Text className="text-xs font-semibold uppercase tracking-[1.2px] text-[#7C8AA5]">Profile</Text>
          <Text className="mt-2 text-[24px] font-semibold text-white">Statement of account</Text>
          <Text className="mt-2 text-sm leading-6 text-[#94A3B8]">
            Request a PDF statement for your personal NGN wallet and download it when it is ready.
          </Text>
        </View>

        <View className="mt-4 rounded-3xl border border-white/10 bg-[#121B2D] px-5 py-5">
          <Text className="text-lg font-semibold text-white">Request a statement</Text>
          <Text className="mt-2 text-sm leading-6 text-[#94A3B8]">
            Statements include opening balance, closing balance, credits, debits, fees, and posted transactions for the selected period.
          </Text>

          <View className="mt-4 gap-3">
            <Pressable
              onPress={() => setPickerField('date_from')}
              className="rounded-2xl border border-white/10 bg-[#0D1526] px-4 py-4"
            >
              <Text className="text-[11px] font-semibold uppercase tracking-[1.2px] text-[#7C8AA5]">Start date</Text>
              <Text className="mt-2 text-base font-medium text-white">{formatDate(dateFrom)}</Text>
            </Pressable>

            <Pressable
              onPress={() => setPickerField('date_to')}
              className="rounded-2xl border border-white/10 bg-[#0D1526] px-4 py-4"
            >
              <Text className="text-[11px] font-semibold uppercase tracking-[1.2px] text-[#7C8AA5]">End date</Text>
              <Text className="mt-2 text-base font-medium text-white">{formatDate(dateTo)}</Text>
            </Pressable>
          </View>

          {pickerField ? (
            <View className="mt-4 rounded-2xl border border-white/10 bg-[#0D1526] px-2 py-2">
              <DateTimePicker
                value={new Date(pickerField === 'date_from' ? dateFrom : dateTo)}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={onDateChange}
                maximumDate={new Date()}
              />
              {Platform.OS === 'ios' ? (
                <View className="flex-row justify-end gap-3 px-3 pb-2 pt-1">
                  <TouchableOpacity onPress={() => setPickerField(null)} className="rounded-xl border border-white/10 px-4 py-2">
                    <Text className="text-sm font-semibold text-white">Done</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          ) : null}

          <View className="mt-4 rounded-2xl border border-white/10 bg-[#0D1526] px-4 py-4">
            <Text className="text-sm leading-6 text-[#94A3B8]">
              Up to 90 days per request. Statements are prepared on demand and become downloadable when ready.
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => void handleRequestStatement()}
            disabled={submitting}
            className="mt-4 rounded-2xl bg-[#2563EB] px-4 py-4"
            style={submitting ? { opacity: 0.65 } : undefined}
          >
            <Text className="text-center text-base font-semibold text-white">
              {submitting ? 'Requesting...' : 'Request statement'}
            </Text>
          </TouchableOpacity>

          {requestNotice.message ? (
            <View
              className={`mt-4 rounded-2xl border px-4 py-4 ${requestNotice.error ? 'border-rose-400/20 bg-rose-400/10' : 'border-emerald-400/20 bg-emerald-400/10'}`}
            >
              <Text className={`text-sm ${requestNotice.error ? 'text-rose-100' : 'text-emerald-100'}`}>
                {requestNotice.message}
              </Text>
            </View>
          ) : null}
        </View>

        <View className="mt-4 rounded-3xl border border-white/10 bg-[#121B2D] px-5 py-5">
          <View className="flex-row items-center justify-between gap-3">
            <View className="flex-1 pr-2">
              <Text className="text-lg font-semibold text-white">Recent statements</Text>
              <Text className="mt-2 text-sm leading-6 text-[#94A3B8]">
                Download ready statements or monitor requests that are still being prepared.
              </Text>
            </View>
            <TouchableOpacity onPress={() => void loadStatements()} className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
              <Text className="text-sm font-semibold text-white">Refresh</Text>
            </TouchableOpacity>
          </View>

          {activityNotice.message ? (
            <View className={`mt-4 rounded-2xl border px-4 py-4 ${activityNotice.error ? 'border-rose-400/20 bg-rose-400/10' : 'border-emerald-400/20 bg-emerald-400/10'}`}>
              <Text className={`text-sm ${activityNotice.error ? 'text-rose-100' : 'text-emerald-100'}`}>
                {activityNotice.message}
              </Text>
            </View>
          ) : null}

          {loading ? (
            <View className="mt-6 items-center justify-center rounded-2xl border border-white/10 bg-[#0D1526] px-4 py-8">
              <ActivityIndicator color="#D7E3FF" />
              <Text className="mt-3 text-sm text-[#94A3B8]">Loading statements...</Text>
            </View>
          ) : statements.length === 0 ? (
            <View className="mt-6 rounded-2xl border border-white/10 bg-[#0D1526] px-4 py-4">
              <Text className="text-sm text-[#94A3B8]">No statements yet. Request one above when you need a full account record.</Text>
            </View>
          ) : (
            <View className="mt-6 gap-3">
              {statements.map((statement) => {
                const statusClass = STATUS_STYLES[String(statement.status || '').toLowerCase()] || 'border-white/10 bg-white/5 text-slate-100'

                return (
                  <View key={statement.id} className="rounded-2xl border border-white/10 bg-[#0D1526] px-4 py-4">
                    <View className="flex-row items-start justify-between gap-3">
                      <View className="flex-1 pr-2">
                        <View className="flex-row flex-wrap items-center gap-2">
                          <Text className="text-sm font-semibold text-white">{statement.reference || 'Account statement'}</Text>
                          <View className={`rounded-full border px-2.5 py-1 ${statusClass}`}>
                            <Text className="text-[10px] font-semibold uppercase tracking-[1px]">{statement.status || 'pending'}</Text>
                          </View>
                        </View>
                        <Text className="mt-2 text-sm text-[#CBD5E1]">
                          {formatDate(statement.date_from)} to {formatDate(statement.date_to)}
                        </Text>
                        <Text className="mt-1 text-xs text-[#7C8AA5]">
                          Requested {formatDateTime(statement.created_at)}
                          {statement.generated_at ? `${READY_SEPARATOR}Ready ${formatDateTime(statement.generated_at)}` : ''}
                        </Text>
                      </View>
                      {statement.download_url ? (
                        <TouchableOpacity onPress={() => void handleDownloadStatement(statement)} className="rounded-xl bg-emerald-600 px-3 py-2">
                          <Text className="text-sm font-semibold text-white">Download PDF</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>

                    {String(statement.status || '').toLowerCase() === 'failed' && statement.failure_reason ? (
                      <View className="mt-4 rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-3">
                        <Text className="text-sm text-rose-100">{statement.failure_reason}</Text>
                      </View>
                    ) : null}

                    {String(statement.status || '').toLowerCase() === 'ready' ? (
                      <View className="mt-4 flex-row flex-wrap gap-3">
                        <SummaryTile label="Opening" value={formatMoneyFromCents(statement.opening_balance_cents)} />
                        <SummaryTile label="Closing" value={formatMoneyFromCents(statement.closing_balance_cents)} />
                        <SummaryTile label="Credits" value={formatMoneyFromCents(statement.total_credits_cents)} />
                        <SummaryTile label="Records" value={String(statement.transaction_count || 0)} />
                      </View>
                    ) : null}
                  </View>
                )
              })}
            </View>
          )}
        </View>
      </ScreenContainer>
    </>
  )
}
