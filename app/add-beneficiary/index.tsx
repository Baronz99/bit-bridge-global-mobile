import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Text, TouchableOpacity, View } from 'react-native'
import FormInput from '@/components/FormInput'
import BankPickerSheet from '@/components/bankTransfer/BankPickerSheet'
import KeyboardAvoidWrapper from '@/components/keyboardAvoidWrapper/KeyboardAvoidWrapper'
import Loader from '@/components/Loader'
import NotificationAlert from '@/components/notification'
import { createCounterParty, getBanks } from '@/api/account'
import { useAuth } from '@/services/useAuth'

const AddBeneficiaryScreen = () => {
  const { onLogout } = useAuth()
  const [banksLoading, setBanksLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [banks, setBanks] = useState<any[]>([])
  const [bankError, setBankError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    bank_code: '',
    bank_name: '',
    account_number: '',
    account_name: '' })
  const [notice, setNotice] = useState<{ message: string | null; error: boolean; data: any }>({
    message: null,
    error: false,
    data: null })

  const fetchBanks = useCallback(async () => {
    setBanksLoading(true)
    setBankError(null)
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
        return
      }
      setBanks([])
      setBankError(error?.response?.data?.message || error?.message || 'Unable to load bank list right now.')
    } finally {
      setBanksLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchBanks()
  }, [fetchBanks, onLogout])

  const options = useMemo(
    () =>
      banks.map((bank) => ({
        label: bank?.name || bank?.bank_name || bank?.label || 'Unknown bank',
        value: String(bank?.code || bank?.bank_code || bank?.value || bank?.id || bank?.name || ''),
        data: bank })),
    [banks]
  )

  const handleSubmit = async () => {
    if (!formData.bank_code || !formData.account_number.trim()) {
      setNotice({ message: 'Bank and account number are required.', error: true, data: null })
      return
    }

    setSubmitting(true)
    setNotice({ message: null, error: false, data: null })
    try {
      const response = await createCounterParty({
        account: {
          bank_code: formData.bank_code,
          account_number: formData.account_number.trim(),
          account_name: formData.account_name.trim() || undefined } })

      setNotice({
        message: response?.message || 'Beneficiary added.',
        error: false,
        data: response?.data || null })
      setFormData({ bank_code: '', bank_name: '', account_number: '', account_name: '' })
    } catch (error: any) {
      const status = error?.response?.status
      if (status === 401) {
        return
      }
      setNotice({
        message: error?.response?.data?.message || error?.message || 'Something went wrong',
        error: true,
        data: null })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View className="flex-1 bg-primary px-4">
      <KeyboardAvoidWrapper>
        <View className="flex-1 pt-10">
          <Text className="text-white text-2xl mb-2">Add Beneficiary</Text>
          <Text className="text-gray-300 mb-6">Save a new beneficiary account.</Text>

          <NotificationAlert message={notice.message} data={notice.data} error={notice.error} />

          <BankPickerSheet
            selectedValue={formData.bank_code}
            options={options}
            loading={banksLoading}
            errorLabel={bankError}
            onRetry={() => {
              void fetchBanks()
            }}
            onSelect={(option) => setFormData({ ...formData, bank_code: option.value, bank_name: option.label })}
          />
          {banksLoading ? <Text className="text-gray-500 text-[11px] mt-2">Loading bank list...</Text> : null}
          {!banksLoading && bankError ? (
            <View className="mt-2 flex-row items-center justify-between">
              <Text className="text-yellow-300 text-[11px] flex-1 pr-3">{bankError}</Text>
              <TouchableOpacity onPress={() => {
                void fetchBanks()
              }}>
                <Text className="text-app-primary text-[11px]">Retry</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <FormInput
            label="Account Number"
            value={formData.account_number}
            name="account_number"
            keyboardType="numeric"
            onChangeText={(text: string) => setFormData({ ...formData, account_number: text })}
          />

          <FormInput
            label="Account Name (optional)"
            value={formData.account_name}
            name="account_name"
            onChangeText={(text: string) => setFormData({ ...formData, account_name: text })}
          />

          <TouchableOpacity
            onPress={handleSubmit}
            className="bg-theme-primary py-6 mt-6 rounded-xl"
          >
            <Text className="text-alt font-medium text-center">Add Beneficiary</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidWrapper>

      <Loader open={submitting} />
    </View>
  )
}

export default AddBeneficiaryScreen



