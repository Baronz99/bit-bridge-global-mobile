import { Image, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import React, { useState } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { images } from '@/constants/images'
import FormInput from '@/components/FormInput'
import { useAuth } from '@/services/useAuth'
import KeyboardAvoidWrapper from '@/components/keyboardAvoidWrapper/KeyboardAvoidWrapper'
import { createPurchaseOrder } from '@/api/billOrder'
import powerDistribution from '../../../data/powerDistributions.json'
import Loader from '@/components/Loader'
import useNotification from '@/hooks/useNotification'
import AppModal from '@/components/modal/Modal'
import NotificationAlert from '@/components/notification'

const getImageByKey = (key: string) => {
  const dict = images as Record<string, any>
  return dict[key] ?? images.fail ?? images.bg
}

const ProvideDertails = () => {
  const { id } = useLocalSearchParams()
  const router = useRouter()
  const { userProfileData } = useAuth()
  const { notification, setNotification } = useNotification()
  const [loader, setLoader] = useState(false)

  const data = powerDistribution.find((item) => String(item.id) === id)

  const [formValue, setFormValue] = useState({
    billersCode: '',
    amount: 0,
    phone: '',
    description: 'Electric Bills',
  })

  const handleFormSubmit = async () => {
    setLoader(true)

    try {
      const response = await createPurchaseOrder({
        ...formValue,
        email: userProfileData.email,
        service_type: 'ELECTRICITY',
        biller: data?.biller,
      })

      setLoader(false)

      if (response)
        router.push({
          pathname: `/transaction/details`,
          params: {
            orderId: response?.data?.id,
          },
        })
    } catch (error: any) {
      setLoader(false)
      setNotification({
        error: true,
        message: error.message || 'something went wrong',
        data: null,
      })
    }
  }

  return (
    <View className="flex-1 bg-primary px-4">
      <ScrollView
        contentContainerStyle={{
          paddingBottom: 80,
        }}
        showsVerticalScrollIndicator={false}
        className="flex-1"
      >
        <View className="mt-6 rounded-3xl border border-gray-800 bg-gray-900/80 p-5">
          <Text className="text-white/70 text-xs tracking-widest uppercase">Utilities</Text>
          <Text className="text-white text-2xl font-semibold mt-2">Electricity Payment</Text>
          <Text className="text-gray-400 mt-2 text-sm">
            {data?.biller || 'Disco'} power purchase.
          </Text>
        </View>

        <View className="mt-6 rounded-2xl border border-gray-800 bg-gray-900/70 p-4">
          <Text className="text-white text-sm font-semibold">Selected Disco</Text>
          <Image
            source={getImageByKey(String(data?.image ?? ''))}
            resizeMode="stretch"
            className="w-full h-40 rounded-2xl mt-4"
          />
        </View>

        <View className="mt-6 rounded-2xl border border-gray-800 bg-gray-900/70 p-4">
          <Text className="text-white text-sm font-semibold">Payment Details</Text>
          <KeyboardAvoidWrapper>
            <View className="mt-3 w-full">
              <FormInput
                name="billerCode"
                label="Meter Number"
                placeHolder="Enter Meter Number"
                onChangeText={(text: string) =>
                  setFormValue({ ...formValue, billersCode: text.trim() })
                }
                value={formValue.billersCode}
              />

              <FormInput
                name="phone"
                label="Phone Number"
                placeHolder="Phone Number"
                onChangeText={(text: string) => setFormValue({ ...formValue, phone: text.trim() })}
                value={formValue.phone}
              />

              <FormInput
                name="amount"
                label="Amount"
                placeHolder="Enter Amount"
                onChangeText={(text: string) =>
                  setFormValue({ ...formValue, amount: parseInt(text.trim()) })
                }
                value={formValue.amount}
              />

              <TouchableOpacity
                onPress={handleFormSubmit}
                className="bg-app-primary rounded-xl mt-4 py-4"
              >
                <Text className="text-white text-center font-semibold">Proceed</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidWrapper>
        </View>
      </ScrollView>
      <Loader open={loader} />
      <AppModal
        open={!!notification.message}
        onclose={() => setNotification({ message: null, error: false, data: null })}
      >
        <NotificationAlert
          onPress={() => setNotification({ message: null, error: false, data: null })}
          message={notification.message}
          error={notification.error}
          data={notification.data}
        />
      </AppModal>
    </View>
  )
}

export default ProvideDertails
