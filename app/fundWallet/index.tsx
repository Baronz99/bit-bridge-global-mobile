import { Linking, Text, TouchableOpacity, View } from 'react-native'
import React, { useState } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import FormInput from '@/components/FormInput'
import { useAuth } from '@/services/useAuth'
import { initiateMonnifyTransaction } from '@/api/transactions'
import Loader from '@/components/Loader'
import NotificationAlert from '@/components/notification'
import KeyboardAvoidWrapper from '@/components/keyboardAvoidWrapper/KeyboardAvoidWrapper'
import { log } from '@/utils/log'

const index = () => {
  const router = useRouter()
  const { returnTo, orderId, id, intentId } = useLocalSearchParams()
  const {
    userProfileData,
    loadProfile,
  } = useAuth()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    amount: 0,
    coupon_code: '',
  })

  const [notice, setNotice] = useState({
    message: null,
    error: false,
    data: null,
  })

  const handleSubmit = async () => {
    setLoading(true)
    log('[FundWallet] submit', { amount: formData.amount, hasCoupon: Boolean(formData.coupon_code) })
    try {
      const response = await initiateMonnifyTransaction({
        data: {
          ...formData,
          status: 'initialized',
          email: userProfileData.email,
          transaction_type: 'deposit',
          customer_name: userProfileData.email,
          description: 'fund wallet',
        },
      })

      setLoading(false)
      loadProfile({ force: true })

      // setNotice({
      //     error: false,
      //     message: response.message,
      //     data: response.data
      // })

      Linking.openURL(response.responseBody.checkoutUrl)
    } catch (error: any) {
      setLoading(false)
      log('[FundWallet] submit failed', error?.message || error)

      setNotice({
        error: true,
        message: error.message,
        data: null,
      })
    }
  }

  return (
    <View className="flex-1 bg-primary px-4">
      <KeyboardAvoidWrapper>
        <View className=" flex-1 pt-10 h-full">
          <FormInput
            label="Amount"
            value={formData.amount}
            name="amount"
            keyboardType="numeric"
            onChangeText={(text: number) => setFormData({ ...formData, amount: text })}
          />

          <FormInput
            label="Coupon (optional)"
            name="coupon_code"
            value={formData.coupon_code}
            onChangeText={(text: string) => setFormData({ ...formData, coupon_code: text })}
          />

          <NotificationAlert message={notice.message} data={notice.data} error={notice.error} />
          <TouchableOpacity
            onPress={handleSubmit}
            className="bg-theme-primary py-6 mt-10 mb-10 rounded-xl"
          >
            <Text className="text-alt font-medium text-center"> Pay With Bank?</Text>
          </TouchableOpacity>

          {String(returnTo || '').trim() ? (
            <TouchableOpacity
              onPress={() =>
                router.replace({
                  pathname: String(returnTo) as any,
                  params: {
                    id: String(id || ''),
                    orderId: String(orderId || ''),
                    intentId: String(intentId || ''),
                    resume: '1'
                  }
                })
              }
              className="border border-gray-700 py-4 rounded-xl"
            >
              <Text className="text-gray-300 font-medium text-center">I have funded wallet, continue</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </KeyboardAvoidWrapper>
      <Loader open={loading} />
    </View>
  )
}

export default index
