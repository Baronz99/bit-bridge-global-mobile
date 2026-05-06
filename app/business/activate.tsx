import React, { useMemo, useState } from 'react'
import { Text, TextInput, TouchableOpacity, View } from 'react-native'
import { useRouter } from 'expo-router'
import ScreenContainer from '@/components/ScreenContainer'
import NotificationAlert from '@/components/notification'
import { createBusinessEntity, getBusinessEntities } from '@/api/business'
import { buildApiErrorMessage } from '@/utils/apiErrorMessage'
import { useActiveAccount } from '@/services/useActiveAccount'

const BusinessActivateScreen = () => {
  const router = useRouter()
  const { selectBusinessAccount, selectPersonalAccount } = useActiveAccount()
  const [submitting, setSubmitting] = useState(false)
  const [businessAccounts, setBusinessAccounts] = useState<Array<{ id: string; name?: string; status?: string; current_user_role?: string }>>([])
  const [name, setName] = useState('')
  const [notice, setNotice] = useState<{ message: string | null; error: boolean; data: any | null }>({
    message: null,
    error: false,
    data: null,
  })

  const existingBusiness = useMemo(() => businessAccounts[0] || null, [businessAccounts])

  React.useEffect(() => {
    let mounted = true
    const loadBusinesses = async () => {
      try {
        const response = await getBusinessEntities()
        const entities = Array.isArray(response?.data?.data)
          ? response.data.data
          : Array.isArray(response?.data)
            ? response.data
            : []
        if (!mounted) return
        setBusinessAccounts(
          entities.map((item: any) => ({
            id: String(item?.id),
            name: String(item?.name || 'Business account'),
            status: String(item?.status || ''),
            current_user_role: String(item?.current_user_role || item?.role || ''),
          }))
        )
      } catch {
        if (mounted) setBusinessAccounts([])
      }
    }

    void loadBusinesses()
    return () => {
      mounted = false
    }
  }, [])

  const handleCreate = async () => {
    const businessName = String(name || '').trim()
    if (!businessName) {
      setNotice({ message: 'Business name is required.', error: true, data: null })
      return
    }

    setSubmitting(true)
    setNotice({ message: null, error: false, data: null })
    try {
      const response = await createBusinessEntity({
        business_entity: {
          name: businessName,
        },
      })
      const created = response?.data?.data || response?.data || null
      const listResponse = await getBusinessEntities().catch(() => null)
      const entities = Array.isArray(listResponse?.data?.data)
        ? listResponse.data.data
        : created
          ? [created]
          : []
      const normalized = entities.map((item: any) => ({
        id: String(item?.id),
        name: String(item?.name || 'Business account'),
        status: String(item?.status || ''),
        current_user_role: String(item?.current_user_role || item?.role || ''),
      }))
      setBusinessAccounts(normalized)
      const next = normalized.find((item) => item.id === String(created?.id || '')) || normalized[0]
      if (next?.id) await selectBusinessAccount(next.id)
      setNotice({
        message: response?.data?.message || response?.message || 'Business profile created. Complete company details and verification next.',
        error: false,
        data: null,
      })
      router.replace('/business' as any)
    } catch (error: any) {
      const message = buildApiErrorMessage({
        status: error?.response?.status,
        data: error?.response?.data,
        fallback: 'Unable to create the business profile right now.',
      })
      setNotice({ message, error: true, data: null })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ScreenContainer topPadding={20}>
      <View className="rounded-[28px] border border-[#FF7A18]/40 bg-[#151A22] p-5">
        <Text className="text-[#FFB05A] text-[11px] uppercase tracking-[2px]">Business banking</Text>
        <Text className="text-white text-2xl font-semibold mt-3">Create a business profile</Text>
        <Text className="text-gray-300 text-sm mt-2">
          Start with the registered company name. Company details, verification, and current-account activation come after this.
        </Text>
      </View>

      <View className="mt-4">
        <NotificationAlert message={notice.message} data={notice.data} error={notice.error} />
      </View>

      <View className="mt-4 rounded-2xl border border-gray-800 bg-gray-900/80 p-4">
        <Text className="text-white text-base font-semibold">Business name</Text>
        <Text className="text-gray-400 text-sm mt-2">Use the registered name from your incorporation documents.</Text>

        <View className="mt-4">
          <Text className="text-gray-300 text-xs mb-2">Registered business name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="BitBridge Foods Ltd"
            placeholderTextColor="#6B7280"
            className="rounded-2xl border border-gray-700 bg-gray-950/60 px-4 py-4 text-white"
          />
        </View>

        <View className="mt-4 flex-row flex-wrap gap-2">
          {['Company details', 'Verification', 'Current account activation'].map((item) => (
            <View key={item} className="rounded-full border border-gray-700 bg-gray-950/50 px-3 py-2">
              <Text className="text-slate-300 text-[11px] font-medium">{item}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity onPress={handleCreate} disabled={submitting} className="mt-5 rounded-2xl bg-[#FFB05A] px-4 py-4 items-center">
          <Text className="text-black text-sm font-semibold">{submitting ? 'Creating business profile...' : 'Create business profile'}</Text>
        </TouchableOpacity>

        <Text className="text-gray-500 text-xs mt-3">
          This step creates the business account only. You will complete company details and verification next.
        </Text>
      </View>

      <View className="mt-4 rounded-2xl border border-gray-800 bg-gray-900/80 p-4">
        <Text className="text-white text-base font-semibold">What happens next</Text>
        <Text className="text-gray-400 text-sm mt-2">
          Complete company details, upload documents, submit for verification, then activate the business current account.
        </Text>
      </View>

      <View className="mt-4 flex-row gap-3">
        <TouchableOpacity onPress={() => { void selectPersonalAccount() }} className="flex-1 rounded-2xl border border-gray-700 px-4 py-4 items-center">
          <Text className="text-white text-sm font-semibold">Back to personal</Text>
        </TouchableOpacity>
        {existingBusiness ? (
          <TouchableOpacity onPress={() => router.replace('/business' as any)} className="flex-1 rounded-2xl border border-gray-700 px-4 py-4 items-center">
            <Text className="text-white text-sm font-semibold">Open business setup</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </ScreenContainer>
  )
}

export default BusinessActivateScreen
