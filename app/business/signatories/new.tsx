import React, { useState } from 'react'
import { Alert } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import ScreenContainer from '@/components/ScreenContainer'
import BusinessPersonForm, { emptyBusinessPerson } from '@/components/business/BusinessPersonForm'
import { createBusinessSignatory } from '@/api/business'
import { useActiveAccount } from '@/services/useActiveAccount'

export default function NewBusinessPersonScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ revision?: string; return_to?: string }>()
  const { activeAccount } = useActiveAccount()
  const businessId = activeAccount.type === 'business' ? activeAccount.businessId : null
  const [saving, setSaving] = useState(false)
  const representativesRoute =
    params.return_to === 'setup'
      ? '/business/onboarding?section=signatory&return_to=setup'
      : '/business/onboarding?section=signatory'

  const returnToRepresentatives = () => router.dismissTo(representativesRoute as any)

  const save = async (person: Record<string, any>) => {
    if (!businessId) return

    setSaving(true)
    try {
      await createBusinessSignatory(businessId, person, params.revision)
      if (params.return_to === 'kyb') router.replace('/business/kyb' as any)
      else returnToRepresentatives()
    } catch (error: any) {
      if (error?.response?.status === 409) {
        Alert.alert(
          'Details refreshed',
          'This business was updated elsewhere. We\'ve refreshed the latest details.'
        )
        returnToRepresentatives()
      } else {
        Alert.alert('Unable to save representative', 'Please review the details and try again.')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <ScreenContainer scroll={false} includeTabBarPadding={false} topPadding={20}>
      <BusinessPersonForm initial={emptyBusinessPerson()} saving={saving} onSave={save} />
    </ScreenContainer>
  )
}
