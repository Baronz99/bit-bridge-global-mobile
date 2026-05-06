import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native'
import { router } from 'expo-router'

import ScreenContainer from '@/components/ScreenContainer'
import TransactionPinModal from '@/components/TransactionPinModal'
import { activateSecurityLock, getSecurityLock } from '@/api/securityLock'
import { useAuth } from '@/services/useAuth'
import {
  getSecurityLockSnapshot,
  getSecurityLockActivationErrorNotice,
  getSecurityLockRefreshErrorNotice,
} from '@/utils/securityLock'
import {
  getTransferBiometricFailureMessage,
  resolveTransactionBiometricUserId,
  useTransactionBiometrics,
} from '@/services/useTransactionBiometrics'
import { error as logError } from '@/utils/logger'

export default function SecurityLockScreen() {
  const { userProfileData, loadProfile, setSecurityLockState } = useAuth()
  const [snapshot, setSnapshot] = useState(getSecurityLockSnapshot(userProfileData))
  const [loading, setLoading] = useState(false)
  const [pinModalOpen, setPinModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [pinError, setPinError] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ title: string; message: string } | null>(null)

  const biometrics = useTransactionBiometrics(resolveTransactionBiometricUserId(userProfileData))
  const active = snapshot?.active === true || snapshot?.security_locked === true

  useEffect(() => {
    setSnapshot(getSecurityLockSnapshot(userProfileData))
  }, [userProfileData])

  const refreshState = useCallback(async () => {
    setLoading(true)
    try {
      const next = await getSecurityLock()
      setSnapshot(next)
      setSecurityLockState(next)
      setNotice(null)
    } catch (error: any) {
      logError('[SECURITY_LOCK][REFRESH_FAILED]', error)
      setNotice(getSecurityLockRefreshErrorNotice())
    } finally {
      setLoading(false)
    }
  }, [setSecurityLockState])

  useEffect(() => {
    void refreshState()
  }, [refreshState])

  const applyActivatedState = useCallback(async (next: any) => {
    setSnapshot(next)
    setSecurityLockState(next)
    await loadProfile({ force: true }).catch(() => {})
    setNotice(null)
    setPinModalOpen(false)
    setPinError(null)
  }, [loadProfile, setSecurityLockState])

  const submitActivation = useCallback(async (credential: { pin?: string; biometric_approval_token?: string }) => {
    setSubmitting(true)
    setPinError(null)
    try {
      const next = await activateSecurityLock({
        reason: 'User activated Security Lock',
        ...(credential.pin ? { pin: credential.pin } : {}),
        ...(credential.biometric_approval_token ? { biometric_approval_token: credential.biometric_approval_token } : {}),
      })
      await applyActivatedState(next)
    } catch (error: any) {
      logError('[SECURITY_LOCK][ACTIVATION_FAILED]', error)
      const nextNotice = getSecurityLockActivationErrorNotice()
      setPinError(`${nextNotice.title}\n${nextNotice.message}`)
    } finally {
      setSubmitting(false)
    }
  }, [applyActivatedState])

  const onBiometricSubmit = useCallback(async () => {
    try {
      const approvalToken = await biometrics.getApprovalToken()
      await submitActivation({ biometric_approval_token: approvalToken })
    } catch (error: any) {
      setPinError(getTransferBiometricFailureMessage(error?.code, error?.message))
    }
  }, [biometrics, submitActivation])

  const statusTone = useMemo(() => {
    if (active) {
      return {
        label: 'Active',
        heading: 'Security Lock is active',
        body: 'Outgoing transactions are paused while your account is protected.',
      }
    }

    return {
      label: 'Ready',
      heading: 'Ready to activate',
      body: 'Outgoing transfers, payments, cards, and withdrawals will pause.',
    }
  }, [active])

  return (
    <ScreenContainer>
      <View className="px-1">
        <Text className="text-white text-[28px] font-semibold">Security Lock</Text>
        <Text className="text-gray-400 mt-2 text-sm leading-6">
          Pause outgoing transactions while keeping your account visible.
        </Text>

        <View className="mt-5 rounded-[28px] border border-gray-800 bg-gray-900/85 p-5">
          <View className="flex-row items-center justify-between">
            <View className={`rounded-full px-3 py-1 ${active ? 'bg-amber-500/15 border border-amber-500/25' : 'bg-emerald-500/15 border border-emerald-500/25'}`}>
              <Text className={`text-xs font-semibold ${active ? 'text-amber-200' : 'text-emerald-200'}`}>{statusTone.label}</Text>
            </View>
            {loading ? <ActivityIndicator color="#f97316" /> : null}
          </View>
          <Text className="text-white text-lg font-semibold mt-4">
            {statusTone.heading}
          </Text>
          <Text className="text-gray-300 text-sm leading-6 mt-2">{statusTone.body}</Text>
          {notice ? (
            <View className="mt-4 rounded-[20px] border border-red-500/20 bg-red-500/10 px-4 py-4">
              <Text className="text-red-100 text-sm font-semibold">{notice.title}</Text>
              <Text className="text-red-100/80 text-sm leading-6 mt-1">{notice.message}</Text>
            </View>
          ) : null}

          <View className="mt-6 gap-3">
            {active ? (
              <TouchableOpacity
                onPress={() => router.push('/settings/security-lock/unlock' as any)}
                className="rounded-2xl bg-app-primary px-4 py-4"
              >
                <Text className="text-white text-center font-semibold">Unlock Security Lock</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={() => {
                  setPinError(null)
                  setPinModalOpen(true)
                }}
                className="rounded-2xl bg-app-primary px-4 py-4"
              >
                <Text className="text-white text-center font-semibold">Activate Security Lock</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity onPress={() => void refreshState()} className="rounded-2xl border border-gray-800 bg-gray-950/70 px-4 py-4">
              <Text className="text-white text-center font-semibold">Refresh status</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text className="text-gray-400 text-sm leading-6 mt-4">
          You can still receive money and view your account.
        </Text>
      </View>

      <TransactionPinModal
        open={pinModalOpen}
        onClose={() => {
          if (submitting) return
          setPinModalOpen(false)
          setPinError(null)
        }}
        onSubmit={(pin) => submitActivation({ pin })}
        onBiometricSubmit={biometrics.biometricEnabled ? onBiometricSubmit : undefined}
        loading={submitting}
        biometricLoading={biometrics.biometricLoading}
        biometricAvailable={biometrics.biometricAvailable}
        biometricEnabled={biometrics.biometricEnabled}
        title="Activate Security Lock"
        errorMessage={pinError}
      />
    </ScreenContainer>
  )
}
