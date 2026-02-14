import React, { useEffect, useState } from 'react'
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { verifyTransactionPin } from '@/api/transactionPin'
import { useAppLock } from '../services/useAppLock'
import { useAuth } from '@/services/useAuth'

type LocalAuthResult = {
  success: boolean
  error?: string
}

type LocalAuthModule = {
  hasHardwareAsync: () => Promise<boolean>
  isEnrolledAsync: () => Promise<boolean>
  authenticateAsync: (options: {
    promptMessage: string
    cancelLabel?: string
    fallbackLabel?: string
    disableDeviceFallback?: boolean
  }) => Promise<LocalAuthResult>
}

const loadLocalAuthentication = async (): Promise<LocalAuthModule | null> => {
  try {
    const mod = await import('expo-local-authentication')
    const api = (mod?.default ?? mod) as LocalAuthModule
    if (
      api &&
      typeof api.hasHardwareAsync === 'function' &&
      typeof api.isEnrolledAsync === 'function' &&
      typeof api.authenticateAsync === 'function'
    ) {
      return api
    }
    return null
  } catch {
    return null
  }
}

export default function LockScreen() {
  const router = useRouter()
  const { unlock, locked } = useAppLock()
  const { onLogout, authenticated } = useAuth()

  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null)
  const [retryAfterSeconds, setRetryAfterSeconds] = useState<number | null>(null)
  const [biometricAvailable, setBiometricAvailable] = useState(false)
  const [biometricLoading, setBiometricLoading] = useState(false)

  useEffect(() => {
    if (authenticated && !locked) {
      router.replace('/(tabs)' as any)
    }
    if (!authenticated) {
      router.replace('/welcome' as any)
    }
  }, [authenticated, locked, router])

  useEffect(() => {
    let mounted = true
    const checkBiometric = async () => {
      const localAuth = await loadLocalAuthentication()
      if (!localAuth) {
        if (mounted) setBiometricAvailable(false)
        return
      }

      try {
        const hasHardware = await localAuth.hasHardwareAsync()
        const isEnrolled = await localAuth.isEnrolledAsync()
        if (mounted) setBiometricAvailable(Boolean(hasHardware && isEnrolled))
      } catch {
        if (mounted) setBiometricAvailable(false)
      }
    }
    void checkBiometric()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (!retryAfterSeconds || retryAfterSeconds <= 0) return
    const timer = setInterval(() => {
      setRetryAfterSeconds((prev) => {
        if (!prev || prev <= 1) return null
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [retryAfterSeconds])

  const handleSubmit = async () => {
    const trimmed = pin.trim()
    if (!trimmed) {
      setError('Enter your transaction PIN to continue.')
      return
    }
    if (retryAfterSeconds && retryAfterSeconds > 0) {
      setError(`Too many attempts. Try again in ${retryAfterSeconds}s.`)
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      await verifyTransactionPin(trimmed)
      setAttemptsRemaining(null)
      setRetryAfterSeconds(null)
      await unlock()
      router.replace('/(tabs)' as any)
    } catch (err: any) {
      const status = err?.response?.status
      const payload = err?.response?.data || {}

      if (status === 401) {
        await onLogout()
        router.replace('/welcome' as any)
        return
      }

      const backendMsg = payload?.message || payload?.error
      const retryAfter = Number(payload?.retry_after_seconds ?? payload?.retryAfterSeconds ?? 0)
      const remaining = Number(payload?.attempts_remaining)

      if (Number.isFinite(remaining) && remaining >= 0) {
        setAttemptsRemaining(remaining)
      } else {
        setAttemptsRemaining(null)
      }

      if (status === 429 && retryAfter > 0) {
        setRetryAfterSeconds(retryAfter)
      } else {
        setRetryAfterSeconds(null)
      }

      const msg =
        status === 404
          ? backendMsg || 'PIN verification unavailable on this environment.'
          : backendMsg || 'Incorrect PIN. Try again.'
      setError(String(msg))
    } finally {
      setSubmitting(false)
    }
  }

  const handleBiometricUnlock = async () => {
    setBiometricLoading(true)
    setError(null)
    try {
      const localAuth = await loadLocalAuthentication()
      if (!localAuth) {
        setError('Biometric unlock unavailable. Use your transaction PIN.')
        return
      }

      const result = await localAuth.authenticateAsync({
        promptMessage: 'Unlock BitBridge',
        cancelLabel: 'Cancel',
        fallbackLabel: 'Use transaction PIN',
        disableDeviceFallback: false,
      })

      if (!result.success) {
        if (result.error !== 'user_cancel') {
          setError('Biometric unlock failed. Use your transaction PIN.')
        }
        return
      }

      await unlock()
      router.replace('/(tabs)' as any)
    } catch {
      setError('Biometric unlock unavailable. Use your transaction PIN.')
    } finally {
      setBiometricLoading(false)
    }
  }

  const handleForgotPin = () => {
    router.push('/settings/pin/reset' as any)
  }

  const handleLogout = async () => {
    await onLogout()
    router.replace('/welcome' as any)
  }

  return (
    <SafeAreaView className="flex-1 bg-[#0b1120]">
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: 24,
            paddingBottom: 32,
            justifyContent: 'center',
          }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="items-center mb-10">
            <Image
              source={require('../assets/logos/bitbridge-logo-clear.png')}
              className="w-36 h-12 mb-3"
              resizeMode="contain"
            />
            <Text className="text-white text-xl font-semibold">Bit Bridge Global</Text>
            <Text className="text-slate-400 text-sm mt-2 text-center">
              For your security, unlock with your transaction PIN.
            </Text>
          </View>

          <View className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5">
            <Text className="text-slate-300 text-sm mb-2">Transaction PIN</Text>
            <TextInput
              value={pin}
              onChangeText={(v) => setPin(v.replace(/[^0-9]/g, '').slice(0, 4))}
              secureTextEntry
              keyboardType="number-pad"
              maxLength={4}
              placeholder="PIN"
              placeholderTextColor="#4b5563"
              className="bg-slate-800 text-white rounded-xl px-4 py-3 text-center text-lg"
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />

            {attemptsRemaining !== null && attemptsRemaining >= 0 ? (
              <Text className="text-slate-400 text-xs mt-2 text-center">
                Attempts remaining: {attemptsRemaining}
              </Text>
            ) : null}

            {retryAfterSeconds && retryAfterSeconds > 0 ? (
              <Text className="text-yellow-300 text-xs mt-2 text-center">
                Retry in {retryAfterSeconds}s
              </Text>
            ) : null}

            {error ? <Text className="text-red-400 text-xs mt-3 text-center">{error}</Text> : null}

            <TouchableOpacity
              className="mt-5 bg-app-primary rounded-xl py-3 items-center"
              onPress={handleSubmit}
              disabled={submitting || (retryAfterSeconds !== null && retryAfterSeconds > 0)}
            >
              <Text className="text-gray-900 font-semibold text-base">
                {submitting ? 'Verifying...' : 'Unlock'}
              </Text>
            </TouchableOpacity>

            {biometricAvailable ? (
              <TouchableOpacity
                className="mt-3 border border-slate-700 rounded-xl py-3 items-center"
                onPress={handleBiometricUnlock}
                disabled={biometricLoading}
              >
                <Text className="text-white font-medium text-sm">
                  {biometricLoading ? 'Checking biometric...' : 'Unlock with Face ID / Fingerprint'}
                </Text>
              </TouchableOpacity>
            ) : null}

            <View className="mt-4 flex-row items-center justify-between">
              <TouchableOpacity onPress={handleForgotPin}>
                <Text className="text-blue-300 text-sm">Forgot PIN?</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleLogout}>
                <Text className="text-gray-300 text-sm">Log out</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
