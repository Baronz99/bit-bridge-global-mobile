import React from 'react'
import { Feather } from '@expo/vector-icons'
import { Text, TouchableOpacity, View } from 'react-native'

type EmailVerificationCardProps = {
  verified: boolean
  hasEmail: boolean
  loading?: boolean
  message?: string | null
  onSend?: () => void
  dismissible?: boolean
  onDismiss?: () => void
  compact?: boolean
}

export default function EmailVerificationCard({
  verified,
  hasEmail,
  loading = false,
  message,
  onSend,
  dismissible = false,
  onDismiss,
  compact = false,
}: EmailVerificationCardProps) {
  return (
    <View
      className={`rounded-2xl border ${
        verified
          ? 'border-emerald-500/25 bg-emerald-500/10'
          : 'border-amber-500/25 bg-amber-500/10'
      } ${compact ? 'p-4' : 'p-5'}`}
    >
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text className="text-white text-base font-semibold">Verify your email</Text>
          <Text className="mt-1 text-xs leading-5 text-gray-300">
            {verified
              ? 'Email verified'
              : hasEmail
              ? 'Receive receipts, security alerts, and recover your account.'
              : 'Add an email address to enable verification.'}
          </Text>
        </View>

        {dismissible && !verified && hasEmail && onDismiss ? (
          <TouchableOpacity
            onPress={onDismiss}
            className="h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/20"
          >
            <Feather name="x" size={16} color="#E5E7EB" />
          </TouchableOpacity>
        ) : null}
      </View>

      {message ? (
        <View className="mt-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
          <Text className="text-xs text-gray-100">{message}</Text>
        </View>
      ) : null}

      {verified ? (
        <View className="mt-4 self-start rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5">
          <Text className="text-xs font-semibold text-emerald-200">Email verified</Text>
        </View>
      ) : hasEmail && onSend ? (
        <TouchableOpacity
          onPress={onSend}
          disabled={loading}
          className="mt-4 rounded-xl bg-app-primary px-4 py-3"
        >
          <Text className="text-center text-sm font-semibold text-black">
            {loading ? 'Sending...' : 'Send verification email'}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  )
}
