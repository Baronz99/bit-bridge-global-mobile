import React, { useEffect, useRef, useState } from 'react'
import { Alert, Text, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Redirect } from 'expo-router'

import ScreenContainer from '@/components/ScreenContainer'
import AppModal from '@/components/modal/Modal'
import { SUPPORT_AVAILABILITY_TEXT, isValidSupportWhatsAppNumber } from '@/constants/support'
import { FEATURE_WHATSAPP_SUPPORT } from '@/constants/featureFlags'
import { launchSupportEmail, launchWhatsAppSupport, SUPPORT_CATEGORIES, SupportCategory } from '@/services/support/SupportLauncher'
import { trackSupportEvent } from '@/services/support/supportAnalytics'
import { useAuth } from '@/services/useAuth'

const WHATSAPP_FAILURE_MESSAGE = 'WhatsApp could not be opened. You can contact BitBridge Support by email instead.'

export default function HelpSupportScreen() {
  const { authHydrated, authState } = useAuth()
  const [selectedCategory, setSelectedCategory] = useState<SupportCategory | null>(null)
  const [launching, setLaunching] = useState(false)
  const externalLaunchLockRef = useRef(false)
  const whatsappAvailable = FEATURE_WHATSAPP_SUPPORT && isValidSupportWhatsAppNumber()

  useEffect(() => {
    if (authHydrated && authState?.authenticated) trackSupportEvent('support_opened')
  }, [authHydrated, authState?.authenticated])

  if (!authHydrated) return null
  if (!authState?.authenticated) return <Redirect href="/login" />

  const closeConfirmation = () => {
    if (!launching) setSelectedCategory(null)
  }

  const selectCategory = (category: SupportCategory) => {
    trackSupportEvent('support_issue_category_selected', { category: category.key })
    setSelectedCategory(category)
  }

  const openWhatsApp = async () => {
    if (!selectedCategory || launching || externalLaunchLockRef.current) return
    externalLaunchLockRef.current = true
    setLaunching(true)
    let result: Awaited<ReturnType<typeof launchWhatsAppSupport>>
    try {
      trackSupportEvent('support_channel_selected', { category: selectedCategory.key })
      result = await launchWhatsAppSupport({ category: selectedCategory.key, enabled: whatsappAvailable })
    } finally {
      externalLaunchLockRef.current = false
      setLaunching(false)
    }
    if (result === 'launched') {
      trackSupportEvent('whatsapp_support_launched', { category: selectedCategory.key })
      setSelectedCategory(null)
      return
    }
    trackSupportEvent('support_launch_failed', { category: selectedCategory.key, reason: result })
    Alert.alert('Unable to open WhatsApp', WHATSAPP_FAILURE_MESSAGE)
  }

  const openEmail = async () => {
    if (!selectedCategory || launching || externalLaunchLockRef.current) return
    externalLaunchLockRef.current = true
    setLaunching(true)
    let opened: boolean
    try {
      trackSupportEvent('support_channel_selected', { category: selectedCategory.key })
      opened = await launchSupportEmail({ category: selectedCategory.key })
    } finally {
      externalLaunchLockRef.current = false
      setLaunching(false)
    }
    if (opened) {
      setSelectedCategory(null)
      return
    }
    trackSupportEvent('support_launch_failed', { category: selectedCategory.key, reason: 'email_failed' })
    Alert.alert('Unable to open email', 'Email could not be opened on this device. Please try again later.')
  }

  return (
    <>
      <ScreenContainer includeTabBarPadding={false} topPadding={16} bottomPadding={28}>
        <View className="rounded-[28px] border border-gray-800 bg-gray-900/85 p-5">
          <Text accessibilityRole="header" className="text-[28px] font-semibold text-white">Help &amp; Support</Text>
          <Text className="mt-3 text-lg font-semibold text-white">How can we help?</Text>
          <Text className="mt-2 text-sm leading-6 text-gray-400">Choose the area you need help with.</Text>
          <Text className="mt-3 text-xs leading-5 text-gray-500">{SUPPORT_AVAILABILITY_TEXT}</Text>
        </View>

        <View className="mt-5 gap-3">
          {SUPPORT_CATEGORIES.map((category) => (
            <TouchableOpacity
              key={category.key}
              accessibilityRole="button"
              accessibilityLabel={`Get help with ${category.label}`}
              activeOpacity={0.85}
              onPress={() => selectCategory(category)}
              className="min-h-[72px] flex-row items-center gap-3 rounded-2xl border border-gray-800 bg-gray-900/70 px-4 py-3"
            >
              <View className="h-10 w-10 items-center justify-center rounded-2xl border border-gray-800 bg-gray-950">
                <Ionicons name={category.key === 'fraud_security' ? 'shield-checkmark-outline' : 'help-circle-outline'} size={20} color="white" />
              </View>
              <View className="flex-1">
                <Text className="text-base font-semibold text-white">{category.label}</Text>
                <Text className="mt-1 text-xs leading-5 text-gray-400">{category.description}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
            </TouchableOpacity>
          ))}
        </View>
      </ScreenContainer>

      <AppModal open={!!selectedCategory} onclose={closeConfirmation}>
        <View className="w-full rounded-[24px] border border-gray-800 bg-gray-900 px-5 py-6">
          <Text accessibilityRole="header" className="text-center text-xl font-semibold text-white">Continue to WhatsApp?</Text>
          <Text className="mt-3 text-center text-sm leading-6 text-gray-300">You’ll leave BitBridge and continue the conversation with BitBridge Support on WhatsApp.</Text>
          <View className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
            <Text className="text-center text-xs font-semibold leading-5 text-amber-100">Never share your PIN, OTP, password, CVV, BVN, NIN, or authentication codes.</Text>
          </View>
          {selectedCategory?.key === 'fraud_security' ? (
            <View className="mt-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3">
              <Text className="text-center text-xs leading-5 text-red-100">If a card may be affected, freeze it first where available. WhatsApp is not an emergency service.</Text>
            </View>
          ) : null}
          {whatsappAvailable ? (
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Open WhatsApp to chat with BitBridge Support" disabled={launching} onPress={() => void openWhatsApp()} className={`mt-6 rounded-2xl px-4 py-4 ${launching ? 'bg-gray-700' : 'bg-app-primary'}`}>
              <Text className="text-center font-semibold text-white">{launching ? 'Opening WhatsApp...' : 'Open WhatsApp'}</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Send BitBridge Support an email" disabled={launching} onPress={() => void openEmail()} className="mt-3 rounded-2xl border border-gray-700 bg-gray-950 px-4 py-4">
            <Text className="text-center font-semibold text-white">Send us an email</Text>
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Cancel support request" disabled={launching} onPress={closeConfirmation} className="mt-3 px-4 py-3">
            <Text className="text-center font-semibold text-gray-300">Cancel</Text>
          </TouchableOpacity>
        </View>
      </AppModal>
    </>
  )
}
