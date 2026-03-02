import { Image, Text, View } from 'react-native'
import React from 'react'
import { AntDesign } from '@expo/vector-icons'
import { images } from '@/constants/images'

const NotificationAlert = ({
  message,
  error,
  data,
  onPress,
}: {
  message?: string | null
  error: boolean
  data?: any
  onPress?: () => void
}) => {
  const detailCandidates = [
    data?.reference,
    data?.ref,
    data?.transaction_reference,
    data?.receipt_reference,
    data?.session_id,
    data?.token,
  ]

  const detailValue = detailCandidates.find((value) => {
    const normalized = String(value ?? '').trim()
    return normalized.length > 0 && normalized.toLowerCase() !== 'n/a'
  })

  return (
    <View className="bg-[#0f1522] border border-[rgba(255,255,255,0.08)] rounded-2xl w-full p-5">
      {message && (
        <View className="items-center">
          <View className="w-full items-end">
            <AntDesign onPress={onPress} name="close" size={22} color="#9CA3AF" />
          </View>

          {error ? (
            <View className="items-center mt-1">
              <Image source={images.sorry} className="w-32 h-32" />
              <Text className="text-white text-center">{message}</Text>
            </View>
          ) : (
            <View className="items-center mt-1">
              <Image source={images.success} className="w-28 h-28" />
              <Text className="text-white text-center mt-3">{message}</Text>
              {detailValue ? (
                <View>
                  <Text className="text-alt text-center font-medium text-base mt-2">
                    {String(detailValue)}
                  </Text>
                </View>
              ) : null}
            </View>
          )}
        </View>
      )}
    </View>
  )
}

export default NotificationAlert
