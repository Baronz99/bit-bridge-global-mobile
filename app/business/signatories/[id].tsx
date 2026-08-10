import React, { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import ScreenContainer from '@/components/ScreenContainer'
import BusinessPersonForm from '@/components/business/BusinessPersonForm'
import { getBusinessOnboarding, updateBusinessSignatory } from '@/api/business'
import { useActiveAccount } from '@/services/useActiveAccount'

export default function EditBusinessPersonScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ id?: string; return_to?: string; mode?: string; field?: string; error_code?: string }>()
  const { activeAccount } = useActiveAccount()
  const businessId = activeAccount.type === 'business' ? activeAccount.businessId : null
  const [person, setPerson] = useState<any>(null)
  const [issues, setIssues] = useState<string[]>([])
  const [revision, setRevision] = useState<string | undefined>()
  const [saving, setSaving] = useState(false)
  const representativesRoute =
    params.return_to === 'setup'
      ? '/business/onboarding?section=signatory&return_to=setup'
      : '/business/onboarding?section=signatory'

  const load = useCallback(async () => {
    if (!businessId || !params.id) return
    const response = await getBusinessOnboarding(businessId)
    const data = response?.data?.data || {}
    setPerson((data.signatories || []).find((item: any) => String(item.id) === String(params.id)) || null)
    setRevision(data.onboarding_revision)
    setIssues(
      (data.readiness?.signatory_issues || []).find(
        (item: any) => String(item.signatory_id) === String(params.id)
      )?.missing_fields || []
    )
  }, [businessId, params.id])

  useEffect(() => {
    void load()
  }, [load])

  const returnToRepresentatives = () => router.dismissTo(representativesRoute as any)

  const save = async (next: any) => {
    if (!businessId || !params.id) return

    setSaving(true)
    try {
      await updateBusinessSignatory(businessId, params.id, next, revision)
      if (params.return_to === 'kyb') router.replace('/business/kyb' as any)
      else returnToRepresentatives()
    } catch (error: any) {
      if (error?.response?.status === 409) {
        await load()
        Alert.alert(
          'Details refreshed',
          'This business was updated elsewhere. We\'ve refreshed the latest details.'
        )
      } else {
        Alert.alert('Unable to save representative', 'Please review the details and try again.')
      }
    } finally {
      setSaving(false)
    }
  }

  if (!person) {
    return (
      <ScreenContainer topPadding={20}>
        <View className="items-center pt-10">
          <ActivityIndicator color="#FFB05A" />
          <Text className="mt-3 text-gray-400">Loading representative...</Text>
        </View>
      </ScreenContainer>
    )
  }

  return (
    <ScreenContainer scroll={false} includeTabBarPadding={false} topPadding={20}>
      <BusinessPersonForm
        key={`${params.id}:${revision || ''}`}
        initial={person}
        issues={issues}
        saving={saving}
        correction={params.mode === 'fix' && params.return_to === 'kyb' ? { active: true, field: params.field, errorCode: params.error_code } : undefined}
        onSave={save}
      />
    </ScreenContainer>
  )
}
