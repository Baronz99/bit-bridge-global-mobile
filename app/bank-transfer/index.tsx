import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Text, TouchableOpacity, View } from 'react-native'
import { useRouter } from 'expo-router'
import FormInput from '@/components/FormInput'
import FormSelect from '@/components/FormSelect'
import KeyboardAvoidWrapper from '@/components/keyboardAvoidWrapper/KeyboardAvoidWrapper'
import Loader from '@/components/Loader'
import NotificationAlert from '@/components/notification'
import TransactionPinModal from '@/components/TransactionPinModal'
import {
  getBanks,
  getBeneficiaries,
  getUserAnchorAccountDetail,
  initiateFundTransfer,
  resolveAccountName,
} from '@/api/account'
import { getTransactionPinStatus } from '@/api/transactionPin'
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
  const [anchorData, setAnchorData] = useState<any | null>(null)
  const [hasAnchorAccount, setHasAnchorAccount] = useState<boolean>(false)
  const [showAnchorCta, setShowAnchorCta] = useState(false)
  const [formData, setFormData] = useState({
    bank_code: '',
    account_number: '',
    account_name: '',
    amount: '',
    beneficiary_id: '',
  })
  const [accountLookupStatus, setAccountLookupStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [accountLookupError, setAccountLookupError] = useState<string | null>(null)
  const lastLookupKeyRef = useRef('')
  const [transferReference, setTransferReference] = useState('')
  const [notice, setNotice] = useState<NoticeState>({
    message: null,
    error: false,
    data: null,
  })
  const hasAnchor = hasAnchorAccount === true
  const canResolve =
    String(formData.account_number || '').trim().length === 10 && !!formData.bank_code

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

    const fetchAnchor = async () => {
      try {
        const response = await getUserAnchorAccountDetail()
        const anchorStatus = response || {}
        const hasAnchorValue = anchorStatus?.has_anchor_account === true
        const anchorAccount = anchorStatus?.data ?? null
        setAnchorData(anchorAccount)
        setHasAnchorAccount(hasAnchorValue)
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
    fetchAnchor()
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
    return list
  }, [beneficiaries])

  const generateTransferReference = () => {
    const cryptoObj = (globalThis as any)?.crypto
    if (cryptoObj?.randomUUID) return cryptoObj.randomUUID()
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
      const rand = (Math.random() * 16) | 0
      const val = ch === 'x' ? rand : (rand & 0x3) | 0x8
      return val.toString(16)
    })
  }

  const fetchAccountName = async (force = false) => {
    if (!canResolve) return
    try {
      const payload = {
        account: {
          account_number: String(formData.account_number || '').trim(),
          bank_code: formData.bank_code,
        },
      }
      const lookupKey = `${payload.account.bank_code}:${payload.account.account_number}`
      if (!force && accountLookupStatus === 'success' && lastLookupKeyRef.current === lookupKey) {
        return
      }
      setAccountLookupStatus('loading')
      setAccountLookupError(null)
      const res = await resolveAccountName(payload)
      setFormData((prev) => ({
        ...prev,
        account_name: res?.account_name || prev.account_name,
      }))
      setAccountLookupStatus('success')
      lastLookupKeyRef.current = lookupKey
    } catch (_err) {
      setAccountLookupStatus('error')
      setAccountLookupError('Account not found. Check details.')
    }
  }

  useEffect(() => {
    if (!canResolve) {
      setAccountLookupStatus('idle')
      setAccountLookupError(null)
      return
    }
    const lookupKey = `${formData.bank_code}:${formData.account_number}`
    if (accountLookupStatus === 'success' && lastLookupKeyRef.current === lookupKey) return
    const timer = setTimeout(() => {
      fetchAccountName()
    }, 500)
    return () => clearTimeout(timer)
  }, [formData.bank_code, formData.account_number, canResolve, accountLookupStatus])

  const handleOpenPin = async () => {
    if (!hasAnchor) {
      setShowAnchorCta(true)
      setNotice({
        message: 'Create an Anchor account to continue.',
        error: true,
        data: null,
      })
      return
    }
    const amountValue = Number(formData.amount)
    if (!formData.bank_code || !formData.account_number.trim() || !amountValue) {
      setNotice({
        message: 'Amount, bank, and account number are required.',
        error: true,
        data: null,
      })
      return
    }
    if (accountLookupStatus !== 'success') {
      setNotice({
        message: 'Please verify the account details.',
        error: true,
        data: null,
      })
      return
    }

    try {
      const status = await getTransactionPinStatus()
      const payload = status?.data ?? status
      const hasPin =
        payload?.has_pin === true ||
        payload?.status === 'set' ||
        payload?.pin_set === true
      if (!hasPin) {
        setNotice({
          message: 'Set your transaction PIN to continue.',
          error: true,
          data: null,
        })
        router.push('/settings/pin/set')
        return
      }
    } catch (error: any) {
      const status = error?.response?.status
      if (status === 401) {
        await onLogout()
        router.replace('/login')
        return
      }
    }

    if (!transferReference) {
      setTransferReference(generateTransferReference())
    }
    setPinError(null)
    setPinModalOpen(true)
  }

  const handleSubmit = async (transactionPin: string) => {
    if (!hasAnchor) {
      setShowAnchorCta(true)
      setNotice({
        message: 'Create an Anchor account to continue.',
        error: true,
        data: null,
      })
      return
    }
    const amountValue = Number(formData.amount)
    if (!formData.bank_code || !formData.account_number.trim() || !amountValue) {
      setNotice({
        message: 'Amount, bank, and account number are required.',
        error: true,
        data: null,
      })
      return
    }
    if (accountLookupStatus !== 'success') {
      setNotice({
        message: 'Please verify the account details.',
        error: true,
        data: null,
      })
      return
    }

    setLoading(true)
    setNotice({ message: null, error: false, data: null })
    try {
      console.log('[BankTransfer] initiate start')
      const response = await initiateFundTransfer({
        account: {
          account_number: formData.account_number.trim(),
          bank_code: formData.bank_code,
          amount: amountValue,
          inter_bank: true,
          counter_party_id: formData.beneficiary_id || undefined,
          pin: transactionPin,
          transfer_reference: transferReference || generateTransferReference(),
        },
      })

      setPinModalOpen(false)
      console.log('[BankTransfer] initiate success', {
        status: response?.status,
        message: response?.message,
      })
      setFormData({
        bank_code: '',
        account_number: '',
        account_name: '',
        amount: '',
        beneficiary_id: '',
      })
      setAccountLookupStatus('idle')
      setAccountLookupError(null)
      lastLookupKeyRef.current = ''
      setTransferReference('')
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
      if (message.toLowerCase().includes('no anchor account')) {
        setShowAnchorCta(true)
      }
      console.log('[BankTransfer] initiate failed', {
        status,
        message,
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
          {!hasAnchor ? (
            <View className="bg-gray-900 rounded-xl p-3 mb-4">
              <Text className="text-gray-300 text-center mb-3">
                No Anchor account found. Create one to continue.
              </Text>
              <TouchableOpacity
                onPress={() => router.push('/anchor-account')}
                className="bg-theme-primary py-3 rounded-xl"
              >
                <Text className="text-alt text-center font-medium">Create Anchor Account</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <FormSelect
            label="Bank"
            selectedValue={formData.bank_code}
            onValueChange={(value: string) => {
              setFormData((prev) => ({
                ...prev,
                bank_code: value,
                account_name: '',
              }))
              setAccountLookupStatus('idle')
              setAccountLookupError(null)
              lastLookupKeyRef.current = ''
              setTransferReference('')
            }}
            options={bankOptions}
            placeholder="Select bank"
          />
          <TouchableOpacity
            onPress={() => router.push('/bank-list')}
            className="bg-gray-900 py-3 rounded-xl mt-2"
          >
            <Text className="text-white text-center text-xs">View bank list</Text>
          </TouchableOpacity>

          <FormInput
            label="Account Number"
            value={formData.account_number}
            name="account_number"
            keyboardType="numeric"
            onChangeText={(text: string) => {
              setFormData((prev) => ({
                ...prev,
                account_number: text,
                account_name: '',
              }))
              setAccountLookupStatus('idle')
              setAccountLookupError(null)
              lastLookupKeyRef.current = ''
              setTransferReference('')
            }}
          />
          {accountLookupStatus === 'loading' && (
            <View className="bg-blue-900/40 border border-blue-700 px-3 py-2 rounded-full mt-2">
              <Text className="text-blue-100 text-xs">Fetching account name...</Text>
            </View>
          )}
          {accountLookupStatus === 'success' && formData.account_name ? (
            <View className="bg-green-900/30 border border-green-700 px-3 py-2 rounded-full mt-2">
              <Text className="text-green-100 text-xs">Account name: {formData.account_name}</Text>
            </View>
          ) : null}
          {accountLookupStatus === 'error' ? (
            <View className="bg-red-900/30 border border-red-700 px-3 py-2 rounded-full mt-2">
              <Text className="text-red-100 text-xs">{accountLookupError || 'Account not found.'}</Text>
            </View>
          ) : null}

          <FormInput
            label="Amount"
            value={formData.amount}
            name="amount"
            keyboardType="numeric"
            onChangeText={(text: string) => {
              setFormData((prev) => ({ ...prev, amount: text }))
              setTransferReference('')
            }}
          />

          <FormSelect
            label="Beneficiary (optional)"
            selectedValue={formData.beneficiary_id}
            onValueChange={(value: string) => {
              const selected = beneficiaryOptions.find((item) => String(item.value) === String(value))
              if (selected?.data) {
                setFormData((prev) => ({
                  ...prev,
                  beneficiary_id: value,
                  account_number: selected.data.account_number || prev.account_number,
                  bank_code: selected.data.bank_code || prev.bank_code,
                  account_name: selected.data.account_name || prev.account_name,
                }))
                setAccountLookupStatus('success')
                setAccountLookupError(null)
                lastLookupKeyRef.current = `${selected.data.bank_code || ''}:${
                  selected.data.account_number || ''
                }`
              } else {
                setFormData((prev) => ({ ...prev, beneficiary_id: value }))
                setAccountLookupStatus('idle')
                setAccountLookupError(null)
                lastLookupKeyRef.current = ''
              }
              setTransferReference('')
            }}
            options={beneficiaryOptions}
            placeholder="Select beneficiary (optional)"
          />

          <TouchableOpacity
            onPress={handleOpenPin}
            className={`${hasAnchor ? 'bg-theme-primary' : 'bg-gray-700'} py-6 mt-6 rounded-xl`}
            disabled={!hasAnchor}
          >
            <Text className="text-alt font-medium text-center">Continue</Text>
          </TouchableOpacity>
          {showAnchorCta && hasAnchor ? (
            <TouchableOpacity
              onPress={() => router.push('/anchor-account')}
              className="bg-gray-900 py-4 mt-4 rounded-xl"
            >
              <Text className="text-white text-center">View Anchor Account</Text>
            </TouchableOpacity>
          ) : null}
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
