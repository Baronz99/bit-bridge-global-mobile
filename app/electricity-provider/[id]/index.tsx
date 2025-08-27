import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import React, { useEffect, useState } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import useFetch from '@/services/useFetch'
import { getProvision } from '@/api/products'
import { images } from '@/constants/images'
import FormInput from '@/components/FormInput'
import { useAuth } from '@/services/useAuth'
import { splitString } from '@/utils'
import KeyboardAvoidWrapper from '@/components/keyboardAvoidWrapper/KeyboardAvoidWrapper'
import { createPurchaseOrder, getPriceList } from '@/api/billOrder'
import FormSelect from '@/components/FormSelect'

// import powerDistribution from "../../data/powerDistributions.json"
import powerDistribution from '../../../data/powerDistributions.json'
import Loader from '@/components/Loader'

const ProvideDertails = () => {
  const { id } = useLocalSearchParams()
  const router = useRouter()
  const {
    authState: { token },
    userProfileData,
  } = useAuth()
  const [error, setError] = useState<string | null>(null)
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
        orderData: {
          ...formValue,
          email: userProfileData.email,
          service_type: 'ELECTRICITY',
          biller: data?.biller,
        },

        token,
      })

      setLoader(false)

      if (response) router.push(`/electricity-provider/${id}/confirm/${response?.data.id}`)
    } catch (error: any) {
      setLoader(false)
    }
  }

  return (
    <View className="flex-1 bg-primary px-4 ">
      <ScrollView
        contentContainerStyle={{
          paddingBottom: 80,
        }}
        showsVerticalScrollIndicator={false}
        className="flex-1"
      >
        <View className="py-6">
          <Image
            source={images[`${data.image}`]}
            resizeMode="stretch"
            className="w-full h-40 rounded-lg"
          />

          <KeyboardAvoidWrapper>
            <View className=" mt-4 w-full">
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
                label="Phone Number "
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
                className="border rounded-md mt-4 border-alt py-5 "
              >
                <Text className="text-alt text-center">Proceed</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidWrapper>
        </View>
      </ScrollView>
      <Loader open={loader} />
    </View>
  )
}

export default ProvideDertails
