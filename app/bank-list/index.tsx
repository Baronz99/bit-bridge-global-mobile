import React, { useEffect, useMemo, useState } from 'react'
import { ScrollView, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import FormSelect from '@/components/FormSelect'
import Loader from '@/components/Loader'
import NotificationAlert from '@/components/notification'
import { getBanks } from '@/api/account'
import { useAuth } from '@/services/useAuth'

const BankListScreen = () => {
  const router = useRouter()
  const { onLogout } = useAuth()
  const [loading, setLoading] = useState(false)
  const [banks, setBanks] = useState<any[]>([])
  const [selectedBank, setSelectedBank] = useState<string>('')
  const [notice, setNotice] = useState({
    message: null,
    error: false,
    data: null,
  })

  useEffect(() => {
    const fetchBanks = async () => {
      setLoading(true)
      setNotice({ message: null, error: false, data: null })
      try {
        const response = await getBanks()
        const raw =
          response?.data?.banks ||
          response?.data?.data ||
          response?.data ||
          response?.banks ||
          response
        const list = Array.isArray(raw) ? raw : []
        setBanks(list)
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

    fetchBanks()
  }, [onLogout, router])

  const options = useMemo(
    () =>
      banks.map((bank) => ({
        label: bank?.name || bank?.bank_name || bank?.label || 'Unknown bank',
        value: bank?.code || bank?.bank_code || bank?.value || bank?.id || bank?.name,
      })),
    [banks]
  )

  const selected = banks.find((bank) => {
    const value = bank?.code || bank?.bank_code || bank?.value || bank?.id || bank?.name
    return value === selectedBank
  })

  return (
    <View className="flex-1 bg-primary px-4">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="pt-10">
          <Text className="text-white text-2xl mb-2">Bank List</Text>
          <Text className="text-gray-300 mb-6">Select a bank from the list.</Text>

          <NotificationAlert message={notice.message} data={notice.data} error={notice.error} />

          <FormSelect
            label="Banks"
            selectedValue={selectedBank}
            onValueChange={(value: string) => setSelectedBank(value)}
            options={options}
          />

          {selected && (
            <View className="bg-gray-900 rounded-xl p-4 mt-4">
              <Text className="text-white">Selected Bank</Text>
              <Text className="text-gray-300 mt-1">
                {selected?.name || selected?.bank_name || selected?.label}
              </Text>
              {(selected?.code || selected?.bank_code) && (
                <Text className="text-gray-400 mt-1">
                  Code: {selected?.code || selected?.bank_code}
                </Text>
              )}
            </View>
          )}
        </View>
      </ScrollView>
      <Loader open={loading} />
    </View>
  )
}

export default BankListScreen
