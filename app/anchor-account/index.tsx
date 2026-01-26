import React, { useEffect, useState } from 'react'
import { ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { useRouter } from 'expo-router'
import Loader from '@/components/Loader'
import NotificationAlert from '@/components/notification'
import { createAnchorAccount, getUserAnchorAccountDetail } from '@/api/account'
import { useAuth } from '@/services/useAuth'
import { buildApiErrorMessage } from '@/utils/apiErrorMessage'

type NoticeState = { message: string | null; error: boolean; data: any | null }

const AnchorAccountScreen = () => {
  const router = useRouter()
  const { onLogout } = useAuth()
  const [loading, setLoading] = useState(false)
  const [anchorData, setAnchorData] = useState<any | null>(null)
  const [hasAnchorAccount, setHasAnchorAccount] = useState<boolean>(false)
  const [missingFields, setMissingFields] = useState<string[]>([])
  const [sandboxPhoneIssue, setSandboxPhoneIssue] = useState(false)
  const [notice, setNotice] = useState<NoticeState>({ message: null, error: false, data: null })

  const fetchAnchor = async () => {
    setLoading(true)
    setNotice({ message: null, error: false, data: null })
    try {
      const response = await getUserAnchorAccountDetail()
      const anchorStatus = response || {}
      const hasAnchor = anchorStatus?.has_anchor_account === true
      const anchorAccount = anchorStatus?.data ?? null
      setHasAnchorAccount(hasAnchor)
      setAnchorData(anchorAccount)
      setSandboxPhoneIssue(false)
      if (anchorAccount) {
        setMissingFields([])
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
      setNotice({ message, error: true, data: null })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAnchor()
  }, [])

  const handleCreate = async () => {
    setLoading(true)
    setNotice({ message: null, error: false, data: null })
    try {
      const response = await createAnchorAccount()
      setNotice({
        message: response?.message || 'Anchor account created.',
        error: false,
        data: response?.data || null,
      })
      setSandboxPhoneIssue(false)
      setMissingFields([])
      await fetchAnchor()
    } catch (error: any) {
      const status = error?.response?.status ?? error?.status
      const data = error?.response?.data ?? error
      const errorCode = data?.error_code
      if (process.env.NODE_ENV !== 'production') {
        console.log('[anchor-account create] error', {
          status,
          error_code: errorCode,
          message: data?.message ?? error?.message,
          missing_fields: data?.missing_fields,
        })
      }
      if (status === 409 && errorCode === 'ANCHOR_PHONE_EXISTS') {
        setSandboxPhoneIssue(true)
        setNotice({
          message:
            'This phone number already has a sandbox Anchor account. Try a different test phone number.',
          error: true,
          data: null,
        })
        return
      }
      if (status === 401) {
        await onLogout()
        router.replace('/login')
        return
      }
      if (status === 422 && errorCode === 'ANCHOR_ONBOARDING_INCOMPLETE') {
        const fields = Array.isArray(data?.missing_fields) ? data.missing_fields : []
        setMissingFields(fields)
        setNotice({
          message: `Complete your profile: ${fields.join(', ')}`,
          error: true,
          data: null,
        })
        return
      }
      const message = buildApiErrorMessage({
        status,
        data,
        fallback: 'Something went wrong',
      })
      setNotice({ message, error: true, data: null })
    } finally {
      setLoading(false)
    }
  }

  const accountNumber = anchorData?.account_number ?? anchorData?.accountNumber
  const accountName = anchorData?.account_name ?? anchorData?.accountName ?? anchorData?.name
  const bankName = anchorData?.bank_name ?? anchorData?.bankName ?? anchorData?.bank
  const useableId = anchorData?.useable_id ?? anchorData?.usable_id ?? anchorData?.reference
  const anchorStatus = String(anchorData?.status || '').trim().toLowerCase()
  const needsAnchorKyc = hasAnchorAccount && anchorStatus !== 'completed'
  const statusLabel = anchorStatus ? anchorStatus.replace('_', ' ') : 'unverified'

  if (sandboxPhoneIssue) {
    return (
      <View className="flex-1 bg-primary px-4">
        <ScrollView showsVerticalScrollIndicator={false}>
          <View className="pt-10">
            <Text className="text-white text-2xl mb-2">Anchor Account</Text>
            <Text className="text-gray-300 mb-6">View or create your Anchor account.</Text>

            <View className="bg-gray-900 rounded-xl p-4">
              <Text className="text-white text-base mb-2">
                Anchor sandbox account already exists
              </Text>
              <Text className="text-gray-300">
                This phone number is already linked to an Anchor sandbox customer.
              </Text>
              <Text className="text-gray-400 mt-2">
                Use a different test phone number or update your profile phone number.
              </Text>
              <TouchableOpacity
                onPress={() => router.push('/accountProfile')}
                className="bg-theme-primary py-3 rounded-xl mt-3"
              >
                <Text className="text-alt text-center font-medium">Update Profile</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={fetchAnchor}
                className="bg-gray-800 py-3 rounded-xl mt-3"
              >
                <Text className="text-white text-center font-medium">Refresh Account</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
        <Loader open={loading} />
      </View>
    )
  }

  if (missingFields.length > 0) {
    return (
      <View className="flex-1 bg-primary px-4">
        <ScrollView showsVerticalScrollIndicator={false}>
          <View className="pt-10">
            <Text className="text-white text-2xl mb-2">Anchor Account</Text>
            <Text className="text-gray-300 mb-6">View or create your Anchor account.</Text>

            <View className="bg-gray-900 rounded-xl p-4">
              <Text className="text-white text-base mb-2">Complete your profile</Text>
              {missingFields.map((field) => (
                <Text key={field} className="text-gray-300">
                  - {field}
                </Text>
              ))}
              <TouchableOpacity
                onPress={() => router.push('/accountProfile')}
                className="bg-theme-primary py-3 rounded-xl mt-3"
              >
                <Text className="text-alt text-center font-medium">Update Profile</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
        <Loader open={loading} />
      </View>
    )
  }

  if (hasAnchorAccount) {
    return (
      <View className="flex-1 bg-primary px-4">
        <ScrollView showsVerticalScrollIndicator={false}>
          <View className="pt-10">
            <Text className="text-white text-2xl mb-2">Anchor Account</Text>
            <Text className="text-gray-300 mb-6">View or create your Anchor account.</Text>

            {notice.message ? (
              <NotificationAlert message={notice.message} data={notice.data} error={notice.error} />
            ) : null}

            {needsAnchorKyc ? (
              <View className="bg-gray-900 rounded-xl p-4 mb-4 border border-amber-500/30">
                <Text className="text-white text-base mb-2">Verify Anchor KYC</Text>
                <Text className="text-gray-300 text-xs mb-3">
                  Complete Anchor verification to activate your virtual account.
                </Text>
                <Text className="text-gray-400 text-xs mb-3">Status: {statusLabel}</Text>
                <TouchableOpacity
                  onPress={() => router.push('/kyc/anchor-verify')}
                  className="bg-app-primary py-3 rounded-xl"
                >
                  <Text className="text-white text-center font-medium">Verify Anchor KYC</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            <View className="bg-gray-900 rounded-xl p-4">
              <Text className="text-white text-lg mb-2">Account Details</Text>
              {accountNumber ? (
                <Text className="text-gray-300">Account Number: {accountNumber}</Text>
              ) : null}
              {accountName ? (
                <Text className="text-gray-300">Account Name: {accountName}</Text>
              ) : null}
              {bankName ? (
                <Text className="text-gray-300">Bank: {bankName}</Text>
              ) : null}
              {useableId ? (
                <Text className="text-gray-400">Useable ID: {useableId}</Text>
              ) : null}
            </View>
          </View>
        </ScrollView>
        <Loader open={loading} />
      </View>
    )
  }

  return (
    <View className="flex-1 bg-primary px-4">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="pt-10">
          <Text className="text-white text-2xl mb-2">Anchor Account</Text>
          <Text className="text-gray-300 mb-6">View or create your Anchor account.</Text>

          {notice.message ? (
            <NotificationAlert message={notice.message} data={notice.data} error={notice.error} />
          ) : null}

          <View className="bg-gray-900 rounded-xl p-4">
            <Text className="text-gray-300 text-center mb-4">No Anchor account yet.</Text>
            <TouchableOpacity
              onPress={handleCreate}
              className="bg-theme-primary py-4 rounded-xl"
            >
              <Text className="text-alt text-center font-medium">Create Anchor Account</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
      <Loader open={loading} />
    </View>
  )
}

export default AnchorAccountScreen
