import React, { useMemo, useState } from 'react'
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native'
import { useRouter } from 'expo-router'
import FormInput from '@/components/FormInput'
import FormSelect from '@/components/FormSelect'
import KeyboardAvoidWrapper from '@/components/keyboardAvoidWrapper/KeyboardAvoidWrapper'
import NotificationAlert from '@/components/notification'
import { createUserTransaction } from '@/api/transactions'
import { buildApiErrorMessage } from '@/utils/apiErrorMessage'
import { useAuth } from '@/services/useAuth'

const CreateUserTransactionScreen = () => {
  const router = useRouter()
  const { userProfileData, onLogout } = useAuth()
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState<{ message: string | null; error: boolean }>({
    message: null,
    error: false,
  })
  const [form, setForm] = useState({
    amount: '',
    transaction_type: 'deposit',
    status: 'approved',
    wallet_type: 'ngn',
    description: '',
    email: '',
  })

  const isAdmin = useMemo(() => {
    const role = userProfileData?.role || userProfileData?.user_profile?.role
    return role === 'admin' || role === 'super_admin'
  }, [userProfileData])

  const handleSubmit = async () => {
    const amountValue = Number(form.amount)
    if (!amountValue) {
      setNotice({ message: 'Amount is required.', error: true })
      return
    }
    setLoading(true)
    setNotice({ message: null, error: false })
    try {
      const response = await createUserTransaction({
        data: {
          amount: amountValue,
          transaction_type: form.transaction_type,
          status: form.status,
          wallet_type: form.wallet_type,
          description: form.description.trim() || undefined,
          email: form.email.trim() || undefined,
        },
      })
      setNotice({
        message: response?.message || 'Transaction created.',
        error: false,
      })
      setForm({
        amount: '',
        transaction_type: 'deposit',
        status: 'approved',
        wallet_type: 'ngn',
        description: '',
        email: '',
      })
    } catch (error: any) {
      const status = error?.response?.status
      if (status === 401) {
        await onLogout()
        router.replace('/login')
        return
      }
      const message = buildApiErrorMessage({
        status,
        data: error?.response?.data,
        fallback: error?.message || 'Unable to create transaction',
      })
      setNotice({ message, error: true })
    } finally {
      setLoading(false)
    }
  }

  if (!isAdmin) {
    return (
      <View className="flex-1 bg-primary px-5 py-8">
        <Text className="text-white text-xl font-semibold mb-2">Create Transaction</Text>
        <Text className="text-gray-400">This tool is available to admins only.</Text>
      </View>
    )
  }

  return (
    <View className="flex-1 bg-primary px-4">
      <KeyboardAvoidWrapper>
        <View className="pt-8">
          <Text className="text-white text-2xl font-semibold">Create Transaction</Text>
          <Text className="text-gray-400 mt-1">Admin-only manual transaction creation.</Text>

          <View className="bg-gray-900 rounded-xl p-4 mt-4">
            <Text className="text-gray-300 text-sm">
              Use this tool to post manual deposits or withdrawals for a user.
            </Text>
          </View>

          <View className="mt-6">
            <FormInput
              label="Amount"
              value={form.amount}
              keyboardType="numeric"
              onChangeText={(value: string) => setForm({ ...form, amount: value })}
            />
            <FormSelect
              label="Transaction Type"
              selectedValue={form.transaction_type}
              onValueChange={(value: string) => setForm({ ...form, transaction_type: value })}
              options={[
                { label: 'Deposit', value: 'deposit' },
                { label: 'Withdrawal', value: 'withdrawal' },
              ]}
            />
            <FormSelect
              label="Status"
              selectedValue={form.status}
              onValueChange={(value: string) => setForm({ ...form, status: value })}
              options={[
                { label: 'Approved', value: 'approved' },
                { label: 'Initialized', value: 'initialized' },
                { label: 'Failed', value: 'failed' },
              ]}
            />
            <FormSelect
              label="Wallet Type"
              selectedValue={form.wallet_type}
              onValueChange={(value: string) => setForm({ ...form, wallet_type: value })}
              options={[
                { label: 'NGN', value: 'ngn' },
                { label: 'USD', value: 'usd' },
              ]}
            />
            <FormInput
              label="User Email (optional)"
              value={form.email}
              onChangeText={(value: string) => setForm({ ...form, email: value })}
            />
            <FormInput
              label="Description (optional)"
              value={form.description}
              onChangeText={(value: string) => setForm({ ...form, description: value })}
            />
          </View>

          {notice.message ? (
            <NotificationAlert message={notice.message} error={notice.error} data={null} />
          ) : null}

          <TouchableOpacity
            onPress={handleSubmit}
            className="bg-app-primary py-4 rounded-xl mt-6"
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator />
            ) : (
              <Text className="text-white text-center font-medium">Create Transaction</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidWrapper>
    </View>
  )
}

export default CreateUserTransactionScreen
