import { Image, StyleSheet, Text, View } from 'react-native'
import React from 'react'
import { AntDesign } from '@expo/vector-icons'
import { images } from '@/constants/images'
import AppModal from '../modal/Modal'

const AppAlert = ({
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
  return (
    <AppModal open={!!message} onClose={onPress}>
      <View className="bg-primary/90 w-full">
        {message && (
          <View className="bg-al h-60 fixed w-[100%]    top-0  m justify-center items-center  ">
            <AntDesign onPress={onPress} name="close" size={24} color="gray" className="ml-auto" />

            {error ? (
              <View>
                <Image source={images.sorry} className="w-40  h-40 m-auto" />
                <Text className="text-white text-center">{message}</Text>
              </View>
            ) : (
              <View>
                <Image source={images.success} className="w-32  h-32 m-auto" />
                <Text className="text-white text-center mt-3">{message}</Text>
                {data && (
                  <View>
                    <Text className="text-alt text-center font-medium text-xl">
                      {' '}
                      {data.token ?? 'N/A'}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        )}
      </View>
    </AppModal>
  )
}

export default AppAlert
