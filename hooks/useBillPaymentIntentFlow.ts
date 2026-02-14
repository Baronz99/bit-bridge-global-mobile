import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createBillPaymentIntent, executeBillPaymentIntent, getBillPaymentIntent } from '@/api/billOrder'

export type BillIntentUiState =
  | 'idle'
  | 'initializing'
  | 'ready'
  | 'awaiting_funds'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'timed_out'

type ExecuteArgs = {
  billTotal: number
  walletBalance: number
  useCommission?: boolean
}

type ExecuteResult =
  | { kind: 'awaiting_funds'; shortfall: number; warningCode?: string; warningMessage?: string }
  | { kind: 'processing' | 'completed' | 'failed' | 'timed_out'; billOrderId?: string | null; message?: string; errorCode?: string; warningCode?: string; warningMessage?: string }

type UseBillPaymentIntentFlowParams = {
  billOrderId?: string | null
  initialIntentId?: string | null
  resumeFlag?: boolean
  pollIntervalMs?: number
  pollTimeoutMs?: number
  onCompleted?: (billOrderId?: string | null) => void
}

const TERMINAL_FAILED = new Set(['failed', 'refunded', 'expired'])

const toSafeNumber = (value: unknown) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

export const useBillPaymentIntentFlow = ({
  billOrderId,
  initialIntentId,
  resumeFlag = false,
  pollIntervalMs = 2000,
  pollTimeoutMs = 45_000,
  onCompleted,
}: UseBillPaymentIntentFlowParams) => {
  const [intentId, setIntentId] = useState<string>(String(initialIntentId || '').trim())
  const [uiState, setUiState] = useState<BillIntentUiState>('idle')
  const [message, setMessage] = useState<string>('')
  const [shortfall, setShortfall] = useState<number>(0)
  const [isBusy, setIsBusy] = useState<boolean>(false)
  const [warning, setWarning] = useState<{ code?: string; message?: string } | null>(null)
  const [latestBillOrderId, setLatestBillOrderId] = useState<string | null>(null)
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollStartedAtRef = useRef<number | null>(null)
  const completionNotifiedRef = useRef<boolean>(false)

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }
    pollStartedAtRef.current = null
  }, [])

  const notifyCompleted = useCallback((resolvedBillOrderId?: string | null) => {
    if (completionNotifiedRef.current) return
    completionNotifiedRef.current = true
    onCompleted?.(resolvedBillOrderId)
  }, [onCompleted])

  const applyIntentStatus = useCallback((intentPayload: any) => {
    const status = String(intentPayload?.status || '').toLowerCase()
    const payloadBillOrderId = String(intentPayload?.bill_order_id || '').trim() || null
    if (payloadBillOrderId) setLatestBillOrderId(payloadBillOrderId)

    if (status === 'completed') {
      setUiState('completed')
      setMessage('Bill payment completed.')
      stopPolling()
      notifyCompleted(payloadBillOrderId)
      return
    }

    if (TERMINAL_FAILED.has(status)) {
      setUiState('failed')
      setMessage(`Bill payment ${status}.`)
      stopPolling()
      return
    }

    if (status === 'awaiting_funds') {
      setUiState('awaiting_funds')
      setMessage('Insufficient wallet balance. Fund wallet to continue.')
      return
    }

    if (status === 'processing' || status === 'ready' || status === 'draft') {
      setUiState('processing')
      setMessage('Bill payment processing. Checking status...')
      return
    }

    setUiState('ready')
    setMessage('')
  }, [notifyCompleted, stopPolling])

  const pollStatus = useCallback(async (overrideIntentId?: string | null) => {
    const resolvedIntentId = String(overrideIntentId || intentId || '').trim()
    if (!resolvedIntentId) return

    const payload = await getBillPaymentIntent(resolvedIntentId)
    applyIntentStatus(payload)
  }, [applyIntentStatus, intentId])

  const startPolling = useCallback((overrideIntentId?: string | null) => {
    const resolvedIntentId = String(overrideIntentId || intentId || '').trim()
    if (!resolvedIntentId) return

    stopPolling()
    setUiState('processing')
    setMessage('Bill payment processing. Checking status...')
    pollStartedAtRef.current = Date.now()

    pollTimerRef.current = setInterval(async () => {
      try {
        await pollStatus(resolvedIntentId)
      } catch {
        // continue polling until timeout
      }

      if (pollStartedAtRef.current && Date.now() - pollStartedAtRef.current >= pollTimeoutMs) {
        stopPolling()
        setUiState('timed_out')
        setMessage('Payment is still processing. Check status to continue.')
      }
    }, pollIntervalMs)
  }, [intentId, pollIntervalMs, pollStatus, pollTimeoutMs, stopPolling])

  const ensureIntent = useCallback(async () => {
    if (intentId) return intentId
    const resolvedBillOrderId = String(billOrderId || '').trim()
    if (!resolvedBillOrderId) throw new Error('Missing bill order id')

    setIsBusy(true)
    setUiState('initializing')
    try {
      const created = await createBillPaymentIntent(resolvedBillOrderId)
      const createdId = String(created?.id || '').trim()
      if (!createdId) throw new Error('Unable to initialize bill payment.')
      setIntentId(createdId)
      setLatestBillOrderId(resolvedBillOrderId)
      setUiState('ready')
      return createdId
    } finally {
      setIsBusy(false)
    }
  }, [billOrderId, intentId])

  const execute = useCallback(async ({ billTotal, walletBalance, useCommission = false }: ExecuteArgs): Promise<ExecuteResult> => {
    const total = toSafeNumber(billTotal)
    const balance = toSafeNumber(walletBalance)
    const requiredShortfall = Math.max(0, total - balance)
    if (requiredShortfall > 0) {
      setShortfall(requiredShortfall)
      setUiState('awaiting_funds')
      setMessage('Insufficient wallet balance. Fund wallet to continue.')
      return { kind: 'awaiting_funds', shortfall: requiredShortfall }
    }

    setShortfall(0)
    const resolvedIntentId = await ensureIntent()
    setIsBusy(true)
    try {
      const response = await executeBillPaymentIntent(resolvedIntentId, { use_commission: useCommission })
      const responseWarning = response?.warning
      setWarning(responseWarning?.code ? { code: responseWarning.code, message: responseWarning.message } : null)
      if (response?.pending || String(response?.status || '').toLowerCase() === 'pending' || response?.http_status === 202) {
        setUiState('processing')
        setMessage(response?.message || 'Bill payment processing. Checking status...')
        startPolling(resolvedIntentId)
        return {
          kind: 'processing',
          message: response?.message,
          warningCode: responseWarning?.code,
          warningMessage: responseWarning?.message,
        }
      }

      const status = String(response?.intent?.status || response?.status || '').toLowerCase()
      const responseBillOrderId = String(
        response?.bill_order_id || response?.intent?.bill_order_id || response?.data?.id || latestBillOrderId || ''
      ).trim() || null
      if (responseBillOrderId) setLatestBillOrderId(responseBillOrderId)

      if (status === 'completed' || response?.success === true) {
        setUiState('completed')
        setMessage(response?.message || 'Bill payment completed.')
        notifyCompleted(responseBillOrderId)
        return {
          kind: 'completed',
          billOrderId: responseBillOrderId,
          message: response?.message,
          warningCode: responseWarning?.code,
          warningMessage: responseWarning?.message,
        }
      }

      setUiState('failed')
      setMessage(response?.message || 'Bill payment failed.')
      return {
        kind: 'failed',
        billOrderId: responseBillOrderId,
        message: response?.message,
        errorCode: response?.error_code,
        warningCode: responseWarning?.code,
        warningMessage: responseWarning?.message,
      }
    } catch (error: any) {
      setUiState('failed')
      setMessage(error?.message || 'Bill payment failed.')
      const warningPayload = error?.warning
      setWarning(warningPayload?.code ? { code: warningPayload.code, message: warningPayload.message } : null)
      return {
        kind: 'failed',
        billOrderId: latestBillOrderId,
        message: error?.message,
        errorCode: error?.code,
        warningCode: warningPayload?.code,
        warningMessage: warningPayload?.message,
      }
    } finally {
      setIsBusy(false)
    }
  }, [ensureIntent, latestBillOrderId, notifyCompleted, startPolling])

  useEffect(() => {
    completionNotifiedRef.current = false
    stopPolling()
    setShortfall(0)
    setMessage('')
    setWarning(null)
    const seededIntentId = String(initialIntentId || '').trim()
    setIntentId(seededIntentId)
    setLatestBillOrderId(String(billOrderId || '').trim() || null)
    setUiState(billOrderId ? 'ready' : 'idle')
  }, [billOrderId, initialIntentId, stopPolling])

  useEffect(() => {
    if (!resumeFlag) return
    if (!intentId) return
    startPolling(intentId)
  }, [intentId, resumeFlag, startPolling])

  useEffect(() => () => stopPolling(), [stopPolling])

  const isActionDisabled = useMemo(() => {
    return isBusy || uiState === 'processing' || uiState === 'completed'
  }, [isBusy, uiState])

  return {
    intentId,
    uiState,
    message,
    warning,
    shortfall,
    latestBillOrderId,
    isBusy,
    isActionDisabled,
    ensureIntent,
    execute,
    pollStatus,
    startPolling,
    stopPolling,
  }
}

export default useBillPaymentIntentFlow
