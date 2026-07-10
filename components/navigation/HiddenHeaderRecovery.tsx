import React, { useCallback, useMemo, useState } from 'react'
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native'
import { useRouter } from 'expo-router'

type HiddenHeaderRecoveryProps = {
  title: string
  message: string
  fallbackRoute: string
  fallbackLabel?: string
  backLabel?: string
  onRetry?: () => Promise<unknown> | unknown
  retryLabel?: string
  retryBusyLabel?: string
}

export default function HiddenHeaderRecovery({
  title,
  message,
  fallbackRoute,
  fallbackLabel = 'Go back',
  backLabel = 'Back',
  onRetry,
  retryLabel = 'Retry',
  retryBusyLabel = 'Retrying...',
}: HiddenHeaderRecoveryProps) {
  const router = useRouter()
  const [retrying, setRetrying] = useState(false)
  const canGoBack = typeof router.canGoBack === 'function' && router.canGoBack()

  const navigationLabel = useMemo(
    () => (canGoBack ? backLabel : fallbackLabel),
    [backLabel, canGoBack, fallbackLabel]
  )

  const handleBack = useCallback(() => {
    if (canGoBack) {
      router.back()
      return
    }

    router.replace(fallbackRoute as never)
  }, [canGoBack, fallbackRoute, router])

  const handleRetry = useCallback(async () => {
    if (!onRetry || retrying) return

    try {
      setRetrying(true)
      await onRetry()
    } finally {
      setRetrying(false)
    }
  }, [onRetry, retrying])

  return (
    <View className="flex-1 items-center justify-center bg-[#020712] px-6">
      <View className="w-full max-w-[420px] rounded-[28px] border border-gray-900 bg-[#050b1b] px-6 py-6">
        <Text className="text-2xl font-semibold text-white">{title}</Text>
        <Text className="mt-3 text-sm leading-6 text-gray-300">{message}</Text>

        {onRetry ? (
          <TouchableOpacity
            accessibilityLabel={retrying ? retryBusyLabel : retryLabel}
            accessibilityRole="button"
            disabled={retrying}
            onPress={() => {
              void handleRetry()
            }}
            className={`mt-6 flex-row items-center justify-center rounded-2xl px-4 py-4 ${retrying ? 'bg-gray-800' : 'bg-cyan-400'}`}
          >
            {retrying ? <ActivityIndicator color="#020712" /> : null}
            <Text className={`text-center text-sm font-semibold ${retrying ? 'ml-2 text-slate-950' : 'text-slate-950'}`}>
              {retrying ? retryBusyLabel : retryLabel}
            </Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          accessibilityLabel={canGoBack ? 'Go back to the previous screen' : fallbackLabel}
          accessibilityRole="button"
          onPress={handleBack}
          className="mt-3 rounded-2xl border border-gray-800 bg-gray-950 px-4 py-4"
        >
          <Text className="text-center text-sm font-semibold text-white">{navigationLabel}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}
