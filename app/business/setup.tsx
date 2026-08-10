import React, { useCallback, useMemo, useState } from 'react'
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { useRouter } from 'expo-router'
import ScreenContainer from '@/components/ScreenContainer'
import { getBusinessOnboarding } from '@/api/business'
import { useActiveAccount } from '@/services/useActiveAccount'

type SetupSection = { key: 'business' | 'contact' | 'signatory'; title: string; ready: boolean }

type VerificationPresentation = { label: string; ctaLabel: string }

const businessFields = ['legal_name', 'business_type', 'registration_number', 'date_of_registration', 'category', 'anchor_industry']
const contactFields = ['contact_email', 'contact_phone', 'address_line_1', 'city', 'state', 'country', 'registered_address_line_1', 'registered_city', 'registered_state', 'registered_country']

const setupIsEditable = (data: Record<string, any>) => {
  const status = String(data.business_entity?.status || '').toLowerCase()
  const providerStatus = String(data.profile?.anchor_kyb_status || '').toLowerCase()
  return !['under_review', 'approved', 'active', 'restricted', 'rejected'].includes(status) &&
    !['submitted', 'under_review', 'awaiting_documents', 'approved', 'synced', 'rejected', 'failed', 'restricted'].includes(providerStatus)
}

const verificationPresentation = (journey: Record<string, any> | undefined): VerificationPresentation => {
  switch (String(journey?.stage || '')) {
    case 'ready_for_verification': return { label: 'Ready for verification', ctaLabel: 'Start verification' }
    case 'verification_in_progress': return { label: 'Verification in review', ctaLabel: 'View verification' }
    case 'provider_documents_required': return { label: 'Documents needed', ctaLabel: 'Upload requested documents' }
    case 'verification_rejected': return { label: 'Action required', ctaLabel: 'Review and correct' }
    case 'ready_for_activation': return { label: 'Business verified', ctaLabel: 'Continue' }
    case 'business_banking_live': return { label: 'Verified', ctaLabel: 'Open business dashboard' }
    case 'business_restricted': return { label: 'Review required', ctaLabel: 'Review status' }
    // Compatibility for an older Journey response. This is preparation guidance,
    // not a reconstruction of document or provider rules on the client.
    case 'documents_required': return { label: 'Documents to keep ready', ctaLabel: 'Open business verification' }
    default: return { label: 'Not started', ctaLabel: 'Open business verification' }
  }
}

export default function BusinessSetupScreen() {
  const router = useRouter()
  const { activeAccount } = useActiveAccount()
  const businessId = activeAccount.type === 'business' ? activeAccount.businessId : null
  const [data, setData] = useState<Record<string, any> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!businessId) { setLoading(false); return }
    setLoading(true); setError(null)
    try {
      const response = await getBusinessOnboarding(businessId)
      setData(response?.data?.data || {})
    } catch {
      setError('Unable to load business setup. Please try again.')
    } finally { setLoading(false) }
  }, [businessId])

  useFocusEffect(useCallback(() => { void load() }, [load]))

  const readiness = data?.readiness || {}
  const missingProfile = Array.isArray(readiness.missing_profile_fields) ? readiness.missing_profile_fields : []
  const missingPeople = Array.isArray(readiness.missing_signatory_requirements) ? readiness.missing_signatory_requirements : []
  const sections = useMemo<SetupSection[]>(() => [
    { key: 'business', title: 'Business details', ready: !businessFields.some((field) => missingProfile.includes(field)) },
    { key: 'contact', title: 'Contact & address', ready: !contactFields.some((field) => missingProfile.includes(field)) },
    { key: 'signatory', title: 'Business representatives', ready: missingPeople.length === 0 },
  ], [missingProfile, missingPeople.length])
  const completeSections = sections.filter((section) => section.ready).length
  const editable = setupIsEditable(data || {})
  const journeyRoute = String(data?.journey?.next_route || '')
  const verification = verificationPresentation(data?.journey)

  const openSection = (section: SetupSection['key']) => router.push({ pathname: '/business/onboarding', params: { section, return_to: 'setup' } } as any)
  const continueSetup = () => {
    if (!editable) { router.push('/business/kyb' as any); return }
    if (journeyRoute) { router.push(journeyRoute as any); return }
    const firstIncomplete = sections.find((section) => !section.ready)
    router.push((firstIncomplete ? `/business/onboarding?section=${firstIncomplete.key}` : '/business/kyb') as any)
  }

  if (loading) return <ScreenContainer topPadding={20}><View className="items-center pt-12"><ActivityIndicator color="#FFB05A" /><Text className="mt-3 text-gray-400">Loading business setup...</Text></View></ScreenContainer>
  if (error) return <ScreenContainer topPadding={20}><View className="rounded-2xl border border-red-400/25 bg-red-500/10 p-4"><Text className="text-red-100">{error}</Text><TouchableOpacity onPress={() => void load()} className="mt-4 rounded-2xl border border-red-300/30 px-4 py-3 items-center"><Text className="text-red-100 font-semibold">Try again</Text></TouchableOpacity></View></ScreenContainer>

  return <ScreenContainer topPadding={20} scroll><View className="pb-8"><Text className="text-white text-2xl font-semibold">Business setup</Text><Text className="mt-3 text-slate-300 text-sm leading-6">Finish setting up your business to continue with verification.</Text>
    <View className="mt-7 rounded-2xl border border-gray-800 bg-gray-900/70 px-4 py-4"><Text className="text-slate-400 text-xs">Business setup</Text><Text className="mt-1 text-white text-base font-semibold">{completeSections} of 3 sections complete</Text></View>
    <View className="mt-4 gap-3">{sections.map((section) => <TouchableOpacity key={section.key} disabled={!editable} onPress={() => openSection(section.key)} className={`rounded-2xl border p-4 ${editable ? 'border-gray-800 bg-gray-900/70' : 'border-gray-800 bg-gray-900/40'}`}><View className="flex-row items-center justify-between"><View><Text className="text-white font-semibold">{section.title}</Text><Text className={`mt-1 text-sm ${section.ready ? 'text-emerald-200' : 'text-amber-200'}`}>{section.ready ? (section.key === 'signatory' ? 'Requirements met' : 'Complete') : 'Needs attention'}</Text></View>{editable ? <Text className="text-[#FFD7A6] text-sm font-semibold">Edit</Text> : null}</View></TouchableOpacity>)}</View>
    <View className="mt-5 rounded-2xl border border-gray-800 bg-gray-900/50 p-4"><Text className="text-slate-400 text-xs">Verification</Text><Text className="mt-1 text-white font-semibold">{verification.label}</Text></View>
    <TouchableOpacity onPress={continueSetup} className="mt-7 rounded-2xl bg-[#FFB05A] px-4 py-4 items-center"><Text className="text-black font-semibold">{editable && completeSections < 3 ? 'Continue setup' : verification.ctaLabel}</Text></TouchableOpacity>
  </View></ScreenContainer>
}
