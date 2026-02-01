import { useState, useEffect } from 'react'
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

export default function LockScreen() {
  const router = useRouter()
  const { unlock, locked } = useAppLock()
  const { onLogout, authenticated } = useAuth()

  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (authenticated && !locked) {
      router.replace('/(tabs)' as any)
    }
    if (!authenticated) {
      router.replace('/welcome' as any)
    }
  }, [authenticated, locked, router])

  const handleSubmit = async () => {
    const trimmed = pin.trim()
    if (!trimmed) {
      setError('Enter your transaction PIN to continue.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await verifyTransactionPin(trimmed)
      await unlock()
      router.replace('/(tabs)' as any)
    } catch (err: any) {
      const status = err?.response?.status
      if (status === 401 || status === 403) {
        await onLogout()
        router.replace('/welcome' as any)
        return
      }
      const backendMsg = err?.response?.data?.message || err?.response?.data?.error
      const msg =
        status === 404
          ? backendMsg || 'PIN verification unavailable on this environment.'
          : backendMsg || 'Incorrect PIN. Try again.'
      if (__DEV__ && status === 404) console.log('[PIN_VERIFY] 404 raw', err?.response?.data)
      setError(String(msg))
    } finally {
      setSubmitting(false)
    }
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
              placeholder="••••"
              placeholderTextColor="#4b5563"
              className="bg-slate-800 text-white rounded-xl px-4 py-3 text-center text-lg"
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />
            {error ? <Text className="text-red-400 text-xs mt-3 text-center">{error}</Text> : null}

            <TouchableOpacity
              className="mt-5 bg-app-primary rounded-xl py-3 items-center"
              onPress={handleSubmit}
              disabled={submitting}
            >
              <Text className="text-gray-900 font-semibold text-base">
                {submitting ? 'Verifying…' : 'Unlock'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
