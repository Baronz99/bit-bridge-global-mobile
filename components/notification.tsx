import React, { useEffect, useMemo, useRef } from 'react'
import { Animated, Text, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

const toneMap = {
  success: {
    icon: 'checkmark-circle' as const,
    iconColor: '#34D399',
    bg: 'rgba(16, 24, 20, 0.96)',
    badgeBg: 'rgba(52, 211, 153, 0.14)',
    title: '#F3FFF9',
    body: '#CDEEDD',
    accent: '#7CE2BA',
  },
  error: {
    icon: 'alert-circle' as const,
    iconColor: '#F87171',
    bg: 'rgba(28, 16, 16, 0.96)',
    badgeBg: 'rgba(248, 113, 113, 0.14)',
    title: '#FFF5F5',
    body: '#F7CDCD',
    accent: '#F3A6A6',
  },
}

type NotificationPayload = {
  token?: string | number | null
  reference?: string | number | null
  transfer_reference?: string | number | null
} | null | undefined

const NotificationAlert = ({
  message,
  error,
  data,
  onPress,
}: {
  message?: string | null
  error: boolean
  data?: NotificationPayload
  onPress?: () => void
}) => {
  const visible = Boolean(message)
  const motion = useRef(new Animated.Value(0)).current
  const tone = error ? toneMap.error : toneMap.success

  useEffect(() => {
    Animated.timing(motion, {
      toValue: visible ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start()
  }, [motion, visible])

  const tokenLabel = useMemo(() => {
    const token = data?.token ?? data?.reference ?? data?.transfer_reference ?? null
    return token ? String(token) : null
  }, [data])

  if (!message) return null

  return (
    <Animated.View
      style={{
        opacity: motion,
        transform: [
          {
            translateY: motion.interpolate({
              inputRange: [0, 1],
              outputRange: [-8, 0],
            }),
          },
        ],
      }}
    >
      <View
        style={{ backgroundColor: tone.bg }}
        className="w-full rounded-[20px] px-4 py-4"
      >
        <View className="flex-row items-start gap-3">
          <View
            style={{ backgroundColor: tone.badgeBg }}
            className="mt-0.5 h-10 w-10 items-center justify-center rounded-full"
          >
            <Ionicons name={tone.icon} size={18} color={tone.iconColor} />
          </View>

          <View className="flex-1">
            <Text style={{ color: tone.title }} className="text-[14px] font-semibold">
              {error ? 'Action needed' : 'Completed'}
            </Text>
            <Text style={{ color: tone.body }} className="mt-1 text-[13px] leading-5">
              {message}
            </Text>
            {tokenLabel ? (
              <Text style={{ color: tone.accent }} className="mt-2 text-[12px] font-medium">
                Ref: {tokenLabel}
              </Text>
            ) : null}
          </View>

          {onPress ? (
            <TouchableOpacity onPress={onPress} className="h-8 w-8 items-center justify-center rounded-full">
              <Ionicons name="close" size={16} color={tone.accent} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </Animated.View>
  )
}

export default NotificationAlert
