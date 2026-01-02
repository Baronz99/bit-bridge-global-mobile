import React, { useEffect, useMemo, useState } from 'react'
import { Text, TouchableOpacity, View } from 'react-native'
import { useRouter } from 'expo-router'
import FormInput from '@/components/FormInput'
import FormSelect from '@/components/FormSelect'
import KeyboardAvoidWrapper from '@/components/keyboardAvoidWrapper/KeyboardAvoidWrapper'
import Loader from '@/components/Loader'
import NotificationAlert from '@/components/notification'
import TransactionPinModal from '@/components/TransactionPinModal'
import { getBanks, getBeneficiaries, initiateFundTransfer } from '@/api/account'
import { useAuth } from '@/services/useAuth'
import { buildApiErrorMessage } from '@/utils/apiErrorMessage'

type NoticeState = { message: string | null; error: boolean; data: any | null }

const BankTransferScreen = () => {
  const router = useRouter()
  const { onLogout } = useAuth()
  const [loading, setLoading] = useState(false)
  const [banks, setBanks] = useState<any[]>([])
  const [beneficiaries, setBeneficiaries] = useState<any[]>([])
  const [pinModalOpen, setPinModalOpen] = useState(false)
  const [pinError, setPinError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    bank_code: '',
    account_number: '',
    amount: '',
    beneficiary_id: '',
  })
  const [notice, setNotice] = useState<NoticeState>({
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
        const message = buildApiErrorMessage({
          status,
          data: error?.response?.data,
          fallback: error?.message || 'Something went wrong',
        })
        setNotice({ message, error: true, data: null })
      } finally {
        setLoading(false)
      }
    }

    const fetchBeneficiaries = async () => {
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
      }
    }

    fetchBanks()
    fetchBeneficiaries()
  }, [onLogout, router])

  const bankOptions = useMemo(
    () =>
      banks.map((bank) => ({
        label: bank?.name || bank?.bank_name || bank?.label || 'Unknown bank',
        value: bank?.code || bank?.bank_code || bank?.value || bank?.id || bank?.name,
      })),
    [banks]
  )

  const beneficiaryOptions = useMemo(() => {
    const list = beneficiaries.map((item) => ({
      label: `${item?.account_name || item?.name || item?.beneficiary_name || 'Beneficiary'} - ${
        item?.bank_name || item?.bank || 'Bank'
      }`,
      value: item?.id || item?.beneficiary_id || item?.counter_party_id,
      data: item,
    }))
    return [{ label: 'Select Beneficiary (optional)', value: '' }, ...list]
  }, [beneficiaries])

  const handleOpenPin = () => {
    const amountValue = Number(formData.amount)
    if (!formData.bank_code || !formData.account_number.trim() || !amountValue) {
      setNotice({
        message: 'Amount, bank, and account number are required.',
        error: true,
        data: null,
      })
      return
    }

    setPinError(null)
    setPinModalOpen(true)
  }

  const handleSubmit = async (pin: string) => {
    const amountValue = Number(formData.amount)
    if (!formData.bank_code || !formData.account_number.trim() || !amountValue) {
      setNotice({
        message: 'Amount, bank, and account number are required.',
        error: true,
        data: null,
      })
      return
    }

    setLoading(true)
    setNotice({ message: null, error: false, data: null })
    try {
      const response = await initiateFundTransfer({
        account: {
          account_number: formData.account_number.trim(),
          bank_code: formData.bank_code,
          amount: amountValue,
          inter_bank: true,
          counter_party_id: formData.beneficiary_id || undefined,
          pin,
        },
      })

      setPinModalOpen(false)
      setFormData({ bank_code: '', account_number: '', amount: '', beneficiary_id: '' })
      setNotice({
        message: response?.message || 'Transfer initiated.',
        error: false,
        data: response?.data || null,
      })

      const transferId =
        response?.data?.transfer_id ||
        response?.data?.id ||
        response?.transfer_id ||
        response?.id
      if (transferId) {
        router.push({ pathname: '/transfer-status', params: { transfer_id: String(transferId) } })
      }
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
        fallback: error?.message || 'Something went wrong',
      })
      setPinError(message)
      setNotice({ message, error: true, data: null })
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className="flex-1 bg-primary px-4">
      <KeyboardAvoidWrapper>
        <View className="flex-1 pt-10">
          <Text className="text-white text-2xl mb-2">Bank Transfer</Text>
          <Text className="text-gray-300 mb-6">Send money to a bank account.</Text>

          <NotificationAlert message={notice.message} data={notice.data} error={notice.error} />

          <FormSelect
            label="Bank"
            selectedValue={formData.bank_code}
            onValueChange={(value: string) => setFormData({ ...formData, bank_code: value })}
            options={bankOptions}
          />

          <FormInput
            label="Account Number"
            value={formData.account_number}
            name="account_number"
            keyboardType="numeric"
            onChangeText={(text: string) => setFormData({ ...formData, account_number: text })}
          />

          <FormInput
            label="Amount"
            value={formData.amount}
            name="amount"
            keyboardType="numeric"
            onChangeText={(text: string) => setFormData({ ...formData, amount: text })}
          />

          <FormSelect
            label="Beneficiary (optional)"
            selectedValue={formData.beneficiary_id}
            onValueChange={(value: string) => setFormData({ ...formData, beneficiary_id: value })}
            options={beneficiaryOptions}
          />

          <TouchableOpacity
            onPress={handleOpenPin}
            className="bg-theme-primary py-6 mt-6 rounded-xl"
          >
            <Text className="text-alt font-medium text-center">Continue</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidWrapper>

      <TransactionPinModal
        open={pinModalOpen}
        onClose={() => setPinModalOpen(false)}
        onSubmit={handleSubmit}
        loading={loading}
        errorMessage={pinError}
        title="Enter PIN to Transfer"
      />

      <Loader open={loading} />
    </View>
  )
}

export default BankTransferScreen
