import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native'
import { Link, useLocalSearchParams, useRouter } from 'expo-router'

import { confirmEmailToken } from '@/api/auth'
import { useAuth } from '@/services/useAuth'

const normalizeParam = (value: string | string[] | undefined) => {
  if (Array.isArray(value)) return value[0]
  return value
}

const Confirmation = () => {
  const router = useRouter()
  const { establishSessionFromTokens } = useAuth()
  const params = useLocalSearchParams<{ confirmation_token?: string | string[] }>()
  const token = useMemo(() => normalizeParam(params.confirmation_token)?.trim() || '', [params])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const hasRunRef = useRef(false)

  useEffect(() => {
    if (hasRunRef.current) return
    hasRunRef.current = true

    if (!token) {
      setError('Invalid or missing confirmation token.')
      setLoading(false)
      return
    }

    const run = async () => {
      try {
        setLoading(true)
        setError(null)

        const payload = await confirmEmailToken(token)
        const accessToken = String(payload?.access_token || payload?.token || '').trim()
        const refreshToken = String(payload?.refresh_token || '').trim() || null

        if (!accessToken) {
          throw new Error('Confirmation succeeded but no login token was returned.')
        }

        await establishSessionFromTokens(accessToken, refreshToken)
        router.replace('/')
      } catch (e: any) {
        setError(e?.message || 'Email confirmation failed. Please request a new confirmation email.')
      } finally {
        setLoading(false)
      }
    }

    void run()
  }, [token, establishSessionFromTokens, router])

  return (
    <View className="flex-1 bg-primary px-5 justify-center">
      <Text className="text-white text-2xl font-semibold text-center mb-4">Email Confirmation</Text>

      {loading ? (
        <View className="items-center gap-3">
          <ActivityIndicator />
          <Text className="text-gray-300 text-center">Confirming your email...</Text>
        </View>
      ) : error ? (
        <View className="gap-4">
          <Text className="text-red-400 text-center">{error}</Text>
          <TouchableOpacity
            className="py-3 bg-app-primary rounded-lg"
            onPress={() => router.replace('/login')}
          >
            <Text className="text-white text-center font-semibold">Go to Login</Text>
          </TouchableOpacity>
          <Link href="/confirmEmail" asChild>
            <TouchableOpacity className="py-3 border border-gray-700 rounded-lg">
              <Text className="text-gray-200 text-center font-semibold">Resend Confirmation Email</Text>
            </TouchableOpacity>
          </Link>
        </View>
      ) : (
        <Text className="text-gray-200 text-center">Redirecting...</Text>
      )}
    </View>
  )
}

export default Confirmation

