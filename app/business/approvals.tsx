import React, { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native'
import ScreenContainer from '@/components/ScreenContainer'
import TransactionPinModal from '@/components/TransactionPinModal'
import {
  approveBusinessApprovalRequest,
  getBusinessApprovalRequests,
  getBusinessApprovalSummary,
  rejectBusinessApprovalRequest,
} from '@/api/business'
import { getTransactionPinStatus } from '@/api/transactionPin'
import { useAuth } from '@/services/useAuth'
import { buildApiErrorMessage } from '@/utils/apiErrorMessage'
import { useActiveAccount } from '@/services/useActiveAccount'
import { useRouter } from 'expo-router'
import { resolveTransactionBiometricUserId, useTransactionBiometrics } from '@/services/useTransactionBiometrics'

const formatNgn = (value: any) => {
  const amount = Number(value || 0)
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
  }).format(amount)
}

const BusinessApprovalsScreen = () => {
  const router = useRouter()
  const { activeAccount } = useActiveAccount()
  const { userProfileData } = useAuth()
  const profilePayload = (userProfileData?.data ?? userProfileData) as any
  const transactionBiometrics = useTransactionBiometrics(resolveTransactionBiometricUserId(profilePayload))
  const [loading, setLoading] = useState(true)
  const [workingId, setWorkingId] = useState<string | null>(null)
  const [pinModalOpen, setPinModalOpen] = useState(false)
  const [pinError, setPinError] = useState<string | null>(null)
  const [pendingDecision, setPendingDecision] = useState<{ approvalRequestId: string; decision: 'approve' | 'reject' } | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [summary, setSummary] = useState<Record<string, any> | null>(null)
  const [requests, setRequests] = useState<Record<string, any>[]>([])
  const businessId = activeAccount.type === 'business' ? activeAccount.businessId : null

  const loadApprovals = useCallback(async (options?: { silent?: boolean }) => {
    if (!businessId) {
      setLoading(false)
      return
    }

    const silent = options?.silent === true
    if (!silent) setLoading(true)
    setErrorMessage(null)
    try {
      const [summaryRes, requestsRes] = await Promise.all([
        getBusinessApprovalSummary(businessId),
        getBusinessApprovalRequests(businessId, { status: 'pending' }),
      ])
      setSummary(summaryRes?.data?.data || null)
      setRequests(Array.isArray(requestsRes?.data?.data) ? requestsRes.data.data : [])
    } catch (error: any) {
      const message = buildApiErrorMessage({
        status: error?.response?.status,
        data: error?.response?.data,
        fallback: 'Unable to load business approvals right now.',
      })
      setErrorMessage(message)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [businessId])

  useEffect(() => {
    loadApprovals()
  }, [loadApprovals])

  const openDecisionConfirmation = async (approvalRequestId: string, decision: 'approve' | 'reject') => {
    if (!businessId) return
    try {
      const status = await getTransactionPinStatus()
      const payload = status?.data ?? status
      const hasPin =
        payload?.has_pin === true ||
        payload?.status === 'set' ||
        payload?.pin_set === true
      if (!hasPin) {
        setErrorMessage('Set your transaction PIN to continue.')
        router.push('/settings/pin/set' as any)
        return
      }
    } catch (error: any) {
      if (error?.response?.status === 401) return
    }

    setPinError(null)
    setPendingDecision({ approvalRequestId, decision })
    setPinModalOpen(true)
  }

  const submitDecision = async (credential: { transaction_pin?: string; biometric_approval_token?: string }) => {
    if (!businessId || !pendingDecision) return
    const { approvalRequestId, decision } = pendingDecision
    setWorkingId(approvalRequestId)
    setPinError(null)
    setErrorMessage(null)
    setSuccessMessage(null)
    try {
      const response = decision === 'approve'
        ? await approveBusinessApprovalRequest(businessId, approvalRequestId, {
            ...(credential.transaction_pin ? { pin: credential.transaction_pin } : {}),
            ...(credential.biometric_approval_token ? { biometric_approval_token: credential.biometric_approval_token } : {}),
          })
        : await rejectBusinessApprovalRequest(businessId, approvalRequestId, {
            ...(credential.transaction_pin ? { pin: credential.transaction_pin } : {}),
            ...(credential.biometric_approval_token ? { biometric_approval_token: credential.biometric_approval_token } : {}),
          })
      const payload = response?.data || response
      setSuccessMessage(response?.data?.message || (decision === 'approve' ? 'Approval recorded.' : 'Rejection recorded.'))
      setPinModalOpen(false)
      setPendingDecision(null)
      if (credential.transaction_pin) {
        await transactionBiometrics.maybeEnrollAfterPinSuccess(credential.transaction_pin).catch(() => null)
      }
      await loadApprovals({ silent: true })
      const transferReference = String(payload?.transfer?.reference || '').trim()
      if (transferReference) {
        router.push(`/business/transfer-status/${encodeURIComponent(transferReference)}` as any)
      }
    } catch (error: any) {
      const message = buildApiErrorMessage({
        status: error?.response?.status,
        data: error?.response?.data,
        fallback: decision === 'approve' ? 'Unable to record the approval right now.' : 'Unable to record the rejection right now.',
      })
      setPinError(message)
      setErrorMessage(message)
    } finally {
      setWorkingId(null)
    }
  }

  const handleSubmit = async (transactionPin: string) => submitDecision({ transaction_pin: transactionPin })

  const handleBiometricSubmit = async () => {
    try {
      const approvalToken = await transactionBiometrics.getApprovalToken()
      await submitDecision({ biometric_approval_token: approvalToken })
    } catch (error: any) {
      const message = error?.message || 'Biometric confirmation failed. Use your transaction PIN.'
      setPinError(message)
      setErrorMessage(message)
    }
  }

  return (
    <ScreenContainer topPadding={20}>
      <View className="rounded-[28px] border border-[#FF7A18]/40 bg-[#151A22] p-5">
        <Text className="text-[#FFB05A] text-[11px] uppercase tracking-[2px]">Approvals inbox</Text>
        <Text className="text-white text-2xl font-semibold mt-3">Business account</Text>
        <Text className="text-gray-300 text-sm mt-2">
          Review pending company approvals before business funds or controlled actions move forward.
        </Text>
      </View>

      {errorMessage ? (
        <View className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-4">
          <Text className="text-red-100 text-sm">{errorMessage}</Text>
        </View>
      ) : null}

      {successMessage ? (
        <View className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-4">
          <Text className="text-emerald-100 text-sm">{successMessage}</Text>
        </View>
      ) : null}

      {loading ? (
        <View className="py-10 items-center justify-center">
          <ActivityIndicator size="small" color="#FFB05A" />
          <Text className="text-white mt-3">Loading approvals...</Text>
        </View>
      ) : null}

      {!loading ? (
        <>
          <View className="mt-4 rounded-2xl border border-gray-800 bg-gray-900/80 p-4">
            <Text className="text-white text-base font-semibold">Approval summary</Text>
            <View className="mt-4 flex-row flex-wrap gap-3">
              <View className="flex-1 min-w-[140px] rounded-2xl border border-gray-800 bg-gray-950/45 px-4 py-3">
                <Text className="text-gray-400 text-xs">Pending</Text>
                <Text className="text-white text-lg font-semibold mt-1">{Number(summary?.total_pending || 0)}</Text>
              </View>
              <View className="flex-1 min-w-[140px] rounded-2xl border border-gray-800 bg-gray-950/45 px-4 py-3">
                <Text className="text-gray-400 text-xs">Approved</Text>
                <Text className="text-white text-lg font-semibold mt-1">{Number(summary?.total_approved || 0)}</Text>
              </View>
              <View className="flex-1 min-w-[140px] rounded-2xl border border-gray-800 bg-gray-950/45 px-4 py-3">
                <Text className="text-gray-400 text-xs">Rejected</Text>
                <Text className="text-white text-lg font-semibold mt-1">{Number(summary?.total_rejected || 0)}</Text>
              </View>
            </View>
          </View>

          <View className="mt-4 rounded-2xl border border-gray-800 bg-gray-900/80 p-4">
            <Text className="text-white text-base font-semibold">Pending decisions</Text>
            <View className="mt-4 gap-3">
              {requests.length ? requests.map((request) => {
                const working = workingId === String(request.id)
                return (
                  <View key={String(request.id)} className="rounded-2xl border border-gray-800 bg-gray-950/45 px-4 py-4">
                    <Text className="text-white text-sm font-semibold capitalize">{String(request.action_type || 'Approval request').replace(/_/g, ' ')}</Text>
                    <Text className="text-gray-300 text-sm mt-1">Amount: {formatNgn(request.amount || 0)}</Text>
                    <Text className="text-gray-400 text-xs mt-1">Reference: {request.reference || 'Pending reference'}</Text>
                    <Text className="text-gray-400 text-xs mt-1">Required approvals: {request.collected_approvals || 0} / {request.required_approvals || 0}</Text>
                    <Text className="text-gray-400 text-xs mt-1">Required roles: {Array.isArray(request.required_roles) ? request.required_roles.join(', ') : 'Not specified'}</Text>
                    <Text className="text-gray-400 text-xs mt-1">Initiator: {request?.initiator?.email || 'Unknown user'}</Text>

                    <View className="flex-row gap-3 mt-4">
                      <TouchableOpacity
                        onPress={() => openDecisionConfirmation(String(request.id), 'approve')}
                        disabled={working}
                        className="flex-1 rounded-2xl bg-[#FFB05A] px-4 py-3 items-center"
                      >
                        {working ? <ActivityIndicator size="small" color="#111827" /> : <Text className="text-black text-sm font-semibold">Approve</Text>}
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => openDecisionConfirmation(String(request.id), 'reject')}
                        disabled={working}
                        className="flex-1 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 items-center"
                      >
                        <Text className="text-red-100 text-sm font-semibold">Reject</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )
              }) : (
                <Text className="text-gray-400 text-sm">No pending approval requests for this business account.</Text>
              )}
            </View>
          </View>
        </>
      ) : null}

      <TransactionPinModal
        open={pinModalOpen}
        onClose={() => {
          setPinModalOpen(false)
          setPendingDecision(null)
        }}
        onSubmit={handleSubmit}
        onBiometricSubmit={handleBiometricSubmit}
        loading={Boolean(workingId)}
        biometricLoading={transactionBiometrics.biometricLoading}
        biometricAvailable={transactionBiometrics.biometricAvailable}
        biometricEnabled={transactionBiometrics.biometricEnabled}
        errorMessage={pinError}
        title={pendingDecision?.decision === 'reject' ? 'Confirm rejection' : 'Confirm approval'}
        helperActionLabel="Forgot PIN? Reset PIN"
        onHelperAction={() => {
          setPinModalOpen(false)
          setPendingDecision(null)
          router.push('/settings/pin/reset' as any)
        }}
      />
    </ScreenContainer>
  )
}

export default BusinessApprovalsScreen
