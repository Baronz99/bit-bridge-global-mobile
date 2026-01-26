import React, { useEffect, useState } from 'react'
import { ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { useRouter } from 'expo-router'
import Loader from '@/components/Loader'
import NotificationAlert from '@/components/notification'
import { getBeneficiaries } from '@/api/account'
import { useAuth } from '@/services/useAuth'

const BeneficiariesScreen = () => {
  const router = useRouter()
  const { onLogout } = useAuth()
  const [loading, setLoading] = useState(false)
  const [beneficiaries, setBeneficiaries] = useState<any[]>([])
  const [notice, setNotice] = useState({
    message: null,
    error: false,
    data: null,
  })

  useEffect(() => {
    const fetchBeneficiaries = async () => {
      setLoading(true)
      setNotice({ message: null, error: false, data: null })
      try {
        const response = await getBeneficiaries()
        const raw =
          response?.data?.beneficiaries ||
          response?.data?.data ||
          response?.data ||
          response?.beneficiaries ||
          response
        const list = Array.isArray(raw) ? raw : []
        setBeneficiaries(list)
      } catch (error: any) {
        const status = error?.response?.status
        if (status === 401) {
          await onLogout()
          router.replace('/login')
          return
        }
        setNotice({
          message: error?.response?.data?.message || error?.message || 'Something went wrong',
          error: true,
          data: null,
        })
      } finally {
        setLoading(false)
      }
    }

    fetchBeneficiaries()
  }, [onLogout, router])

  return (
    <View className="flex-1 bg-primary px-4">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="pt-10">
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-white text-2xl">Beneficiaries</Text>
            <TouchableOpacity
              onPress={() => router.push('/add-beneficiary')}
              className="bg-app-primary px-4 py-2 rounded-full"
            >
              <Text className="text-black text-xs font-semibold">Add beneficiary</Text>
            </TouchableOpacity>
          </View>
          <Text className="text-gray-300 mb-6">Your saved beneficiaries.</Text>

          <NotificationAlert message={notice.message} data={notice.data} error={notice.error} />

          {beneficiaries.length === 0 ? (
            <View className="bg-gray-900 rounded-xl p-4">
              <Text className="text-gray-300 text-center">No beneficiaries found.</Text>
            </View>
          ) : (
            beneficiaries.map((item, index) => (
              <View key={index} className="bg-gray-900 rounded-xl p-4 mb-3">
                <Text className="text-white">
                  {item?.account_name || item?.name || item?.beneficiary_name || 'Beneficiary'}
                </Text>
                <Text className="text-gray-300 mt-1">
                  {item?.bank_name || item?.bank || 'Bank'} |{' '}
                  {item?.account_number || item?.account || 'Account'}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
      <Loader open={loading} />
    </View>
  )
}

export default BeneficiariesScreen
