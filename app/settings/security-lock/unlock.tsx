import React, { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { router } from 'expo-router'

import ScreenContainer from '@/components/ScreenContainer'
import NotificationAlert from '@/components/notification'
import { getSecurityLock, startSecurityLockUnlock, verifySecurityLockUnlock } from '@/api/securityLock'
import { useAuth } from '@/services/useAuth'
import {
  getSecurityLockSnapshot,
  normalizeUnlockStartError,
  normalizeUnlockVerifyError,
} from '@/utils/securityLock'
import { error as logError } from '@/utils/logger'

export default function SecurityLockUnlockScreen() {
  const { userProfileData, loadProfile, setSecurityLockState } = useAuth()
  const [snapshot, setSnapshot] = useState(getSecurityLockSnapshot(userProfileData))
  const [currentPassword, setCurrentPassword] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [started, setStarted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState<{ message: string; error: boolean } | null>(null)

  useEffect(() => {
    setSnapshot(getSecurityLockSnapshot(userProfileData))
  }, [userProfileData])

  const refreshState = useCallback(async () => {
    try {
      const next = await getSecurityLock()
      setSnapshot(next)
      setSecurityLockState(next)
    } catch {
      // keep local state fallback
    }
  }, [setSecurityLockState])

  useEffect(() => {
    void refreshState()
  }, [refreshState])

  const active = snapshot?.active === true || snapshot?.security_locked === true
  const maskedPhone = snapshot?.unlock_contact?.masked_phone || 'your verified phone number'

  const onStart = useCallback(async () => {
    if (!currentPassword.trim()) {
      setNotice({ message: 'Enter your current password to continue.', error: true })
      return
    }
    setLoading(true)
    setNotice(null)
    try {
      await startSecurityLockUnlock({ current_password: currentPassword.trim() })
      setStarted(true)
      setNotice({ message: `Verification code sent to ${maskedPhone}.`, error: false })
    } catch (error: any) {
      logError('[SECURITY_LOCK][UNLOCK_START_FAILED]', error)
      const nextNotice = normalizeUnlockStartError(error)
      setNotice({ message: `${nextNotice.title}. ${nextNotice.message}`, error: true })
    } finally {
      setLoading(false)
    }
  }, [currentPassword, maskedPhone])

  const onVerify = useCallback(async () => {
    if (otpCode.trim().length < 6) {
      setNotice({ message: 'Enter the 6-digit code sent to your phone.', error: true })
      return
    }
    setLoading(true)
    setNotice(null)
    try {
      const next = await verifySecurityLockUnlock({ otp_code: otpCode.trim() })
      setSnapshot(next)
      setSecurityLockState(next)
      await loadProfile({ force: true }).catch(() => {})
      setNotice({ message: 'Security Lock was removed.', error: false })
      router.replace('/settings/security-lock' as any)
    } catch (error: any) {
      logError('[SECURITY_LOCK][UNLOCK_VERIFY_FAILED]', error)
      const nextNotice = normalizeUnlockVerifyError(error)
      setNotice({ message: `${nextNotice.title}. ${nextNotice.message}`, error: true })
    } finally {
      setLoading(false)
    }
  }, [loadProfile, otpCode, setSecurityLockState])

  if (!active) {
    return (
      <ScreenContainer>
        <View className="rounded-[28px] border border-gray-800 bg-gray-900/85 p-5">
          <Text className="text-white text-[28px] font-semibold">Security Lock</Text>
          <Text className="text-gray-300 mt-3 text-sm leading-6">
            Security Lock is not active right now.
          </Text>
          <TouchableOpacity onPress={() => router.replace('/settings/security-lock' as any)} className="mt-6 rounded-2xl bg-app-primary px-4 py-4">
            <Text className="text-white text-center font-semibold">Back to Security Lock</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    )
  }

  return (
    <ScreenContainer>
      <View className="rounded-[28px] border border-gray-800 bg-gray-900/85 p-5">
        <Text className="text-white text-[28px] font-semibold">Unlock Security Lock</Text>
        <Text className="text-gray-400 mt-2 text-sm leading-6">
          Confirm your password, then verify the code sent to {maskedPhone}. Outgoing transactions will resume after verification.
        </Text>

        {notice?.message ? (
          <View className="mt-4">
            <NotificationAlert message={notice.message} error={notice.error} data={null} onPress={() => setNotice(null)} />
          </View>
        ) : null}

        <View className="mt-5 rounded-[24px] border border-gray-800 bg-gray-950/70 p-4">
          <Text className="text-gray-400 text-[11px] uppercase tracking-[0.18em]">Step 1</Text>
          <Text className="text-white text-sm font-semibold mt-3">Current password</Text>
          <TextInput
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry
            autoCapitalize="none"
            placeholder="Enter current password"
            placeholderTextColor="#6b7280"
            className="mt-3 rounded-2xl border border-gray-800 bg-gray-900 px-4 py-4 text-white"
          />
          <TouchableOpacity onPress={onStart} disabled={loading} className="mt-4 rounded-2xl bg-app-primary px-4 py-4">
            <Text className="text-white text-center font-semibold">Send verification code</Text>
          </TouchableOpacity>
        </View>

        <View className="mt-4 rounded-[24px] border border-gray-800 bg-gray-950/70 p-4">
          <Text className="text-gray-400 text-[11px] uppercase tracking-[0.18em]">Step 2</Text>
          <Text className="text-white text-sm font-semibold mt-3">Phone verification code</Text>
          <TextInput
            value={otpCode}
            onChangeText={(value) => setOtpCode(value.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            maxLength={6}
            placeholder="123456"
            placeholderTextColor="#6b7280"
            className="mt-3 rounded-2xl border border-gray-800 bg-gray-900 px-4 py-4 text-white tracking-[0.3em]"
          />
          <TouchableOpacity onPress={onVerify} disabled={loading || !started} className={`mt-4 rounded-2xl px-4 py-4 ${started ? 'bg-app-primary' : 'bg-gray-800'}`}>
            <Text className="text-white text-center font-semibold">Verify and unlock</Text>
          </TouchableOpacity>
          {!started ? (
            <Text className="text-gray-500 text-xs mt-3">Send the verification code first before entering the OTP.</Text>
          ) : null}
        </View>

        {loading ? (
          <View className="py-6"><ActivityIndicator color="#f97316" /></View>
        ) : null}
      </View>
    </ScreenContainer>
  )
}
