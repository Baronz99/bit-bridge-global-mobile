import React, { useEffect, useMemo, useState } from 'react'
import { Alert, Text, TouchableOpacity, View } from 'react-native'
import { normalizeAnchorOnboarding } from '@/services/useAnchorOnboarding'
import { isValidNgPhone } from '@/utils/phone'

export type DepositAccountSectionProps = {
  normalized: ReturnType<typeof normalizeAnchorOnboarding>
  loading: boolean
  onGenerateAccount: () => Promise<void>
  onRefresh: () => Promise<void>
  platformTier2?: boolean
  onGoToKyc?: () => void
  prefilledPhone?: string
  onGoToProfile?: () => void
  actionBlockReason?: string | null
}

const DepositAccountSection = ({
  normalized,
  loading,
  onGenerateAccount,
  onRefresh,
  platformTier2 = false,
  onGoToKyc,
  prefilledPhone,
  onGoToProfile,
  actionBlockReason,
}: DepositAccountSectionProps) => {
  const [showRawAccountNumber, setShowRawAccountNumber] = useState(false)
  const step = normalized.nextStep
  const maskedAccountNumber = normalized.displayAccountNumber || '----'
  const hasRawAccountNumber = Boolean(normalized.rawAccountNumber)
  const hasPhone = Boolean(String(prefilledPhone || '').trim())
  const hasValidPhone = isValidNgPhone(prefilledPhone)
  const accountNumberToDisplay =
    showRawAccountNumber && hasRawAccountNumber
      ? String(normalized.rawAccountNumber)
      : maskedAccountNumber

  useEffect(() => {
    setShowRawAccountNumber(false)
  }, [normalized.rawAccountNumber, normalized.displayAccountNumber])

  const statusLabel = useMemo(() => {
    const map: Record<string, string> = {
      verified: 'Verified',
      pending: 'Pending',
      not_started: 'Not verified',
      unknown: 'Unknown',
    }
    return map[normalized.kycState] || 'Unknown'
  }, [normalized.kycState])

  const explanation = useMemo(() => {
    if (!platformTier2) return 'Complete Tier 2 verification before setting up a deposit account.'
    if (normalized.backendFlowState === 'blocked_profile_incomplete') return 'Your profile is incomplete. Update your profile to continue.'
    if (normalized.backendFlowState === 'blocked_phone_exists') return 'Phone number conflict at provider. Update your phone number and retry.'
    if (normalized.backendFlowState === 'blocked_kyc') return 'Your account needs KYC eligibility before Anchor onboarding.'
    if (normalized.kycState === 'pending') return 'Anchor is currently reviewing your KYC submission.'
    if (normalized.depositReady) return 'Your deposit account is ready to receive funds.'
    return 'Use one action to create profile, submit KYC, and generate account number.'
  }, [normalized, platformTier2])

  const stepTitle = useMemo(() => {
    if (step === 'DONE') return 'Setup complete'
    return 'Generate account number'
  }, [step])

  const inactiveNumberMessage =
    normalized.hasAnchorAccount && normalized.hasAccountNumber && normalized.kycState != 'verified'
      ? 'Account number created. Deposits activate after KYC is verified.'
      : null

  const primaryAction = useMemo(() => {
    if (!platformTier2) return null
    if ((actionBlockReason || !hasPhone || !hasValidPhone || normalized.backendFlowState === 'blocked_profile_incomplete' || normalized.backendFlowState === 'blocked_phone_exists') && onGoToProfile) {
      return { label: 'Update Profile', onPress: async () => onGoToProfile() }
    }
    if (normalized.capabilities?.can_create_anchor_profile === false &&
      normalized.capabilities?.can_submit_anchor_kyc === false &&
      normalized.capabilities?.can_provision_account_number === false) {
      return null
    }
    if (normalized.depositReady) return null
    if (normalized.kycState === 'pending') return null

    return { label: 'Generate Account Number', onPress: onGenerateAccount }
  }, [
    actionBlockReason,
    hasPhone,
    hasValidPhone,
    normalized.backendFlowState,
    normalized.capabilities,
    normalized.depositReady,
    normalized.kycState,
    onGenerateAccount,
    onGoToProfile,
    platformTier2,
  ])

  if (step == 'DONE') {
    return (
      <View className="bg-gray-900 border border-gray-800 rounded-2xl p-4 mt-6">
        <Text className="text-white font-semibold">Deposit Account</Text>
        {normalized.displayAccountNumber ? (
          <View className="mt-3">
            <Text className="text-gray-400 text-xs">Account number</Text>
            <Text className="text-white text-lg font-semibold mt-1">{accountNumberToDisplay}</Text>
          </View>
        ) : null}
        {normalized.accountName ? <Text className="text-gray-300 mt-2">Account Name: {normalized.accountName}</Text> : null}
        {normalized.bankName ? <Text className="text-gray-300">Bank: {normalized.bankName}</Text> : null}
        <View className="mt-3 flex-row items-center gap-2">
          <TouchableOpacity
            onPress={async () => {
              const raw = normalized.rawAccountNumber
              if (!raw) {
                Alert.alert('Account number hidden', 'Open the full account view to copy.')
                return
              }
              try {
                const Clipboard = await import('expo-clipboard')
                await Clipboard.setStringAsync(String(raw))
                Alert.alert('Copied', 'Account number copied.')
              } catch {
                Alert.alert('Account number', String(raw))
              }
            }}
            className="bg-gray-950 border border-gray-800 px-3 py-2 rounded-full"
          >
            <Text className="text-white text-xs">Copy</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              if (!hasRawAccountNumber) {
                Alert.alert('Unavailable', 'Full account number is not available yet.')
                return
              }
              setShowRawAccountNumber((prev) => !prev)
            }}
            className="bg-gray-950 border border-gray-800 px-3 py-2 rounded-full"
          >
            <Text className="text-white text-xs">{showRawAccountNumber ? 'Hide' : 'Show'}</Text>
          </TouchableOpacity>
        </View>
        <Text className="text-gray-400 text-xs mt-3">Use this account to fund your wallet.</Text>
      </View>
    )
  }

  return (
    <View className="bg-gray-900 rounded-xl p-4 gap-3 mt-4">
      <Text className="text-white text-base font-semibold">Onboarding progress</Text>
      <View className="flex-row items-center gap-2">
        <View className={`flex-1 h-1 rounded-full ${normalized.hasAnchorAccount ? 'bg-emerald-400' : 'bg-gray-700'}`} />
        <View className={`flex-1 h-1 rounded-full ${normalized.kycState === 'verified' ? 'bg-emerald-400' : 'bg-gray-700'}`} />
        <View className={`flex-1 h-1 rounded-full ${normalized.hasAccountNumber ? 'bg-emerald-400' : 'bg-gray-700'}`} />
      </View>

      <View className="rounded-xl border border-gray-800 bg-gray-950/60 p-3">
        <Text className="text-white text-sm font-semibold">{stepTitle}</Text>
        <Text className="text-gray-200 text-xs mt-1">{explanation}</Text>
        <Text className="text-gray-400 text-xs mt-2">KYC Status: {statusLabel}</Text>
      </View>

      {inactiveNumberMessage ? (
        <View className="mt-1 rounded-xl border border-amber-500/40 bg-amber-900/20 p-3">
          <Text className="text-amber-200 text-xs">{inactiveNumberMessage}</Text>
        </View>
      ) : null}

      {!platformTier2 ? (
        <View className="mt-2">
          <Text className="text-gray-500 text-xs">Complete Tier 2 verification in your profile to enable deposit accounts.</Text>
          {onGoToKyc ? (
            <TouchableOpacity onPress={onGoToKyc} className="bg-gray-950 border border-gray-800 py-3 rounded-xl mt-3">
              <Text className="text-white text-center text-xs">Complete Tier 2</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {actionBlockReason ? (
        <View className="mt-1 rounded-xl border border-amber-500/40 bg-amber-900/20 p-3">
          <Text className="text-amber-200 text-xs">{actionBlockReason}</Text>
        </View>
      ) : null}

      {primaryAction ? (
        <TouchableOpacity
          onPress={primaryAction.onPress}
          className="bg-app-primary py-3 rounded-xl mt-2"
          disabled={loading}
        >
          <Text className="text-white text-center font-medium">{primaryAction.label}</Text>
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity
        onPress={onRefresh}
        className="bg-gray-900 border border-gray-800 py-3 rounded-xl mt-1"
        disabled={loading}
      >
        <Text className="text-white text-center text-xs">Refresh status</Text>
      </TouchableOpacity>
    </View>
  )
}

export default DepositAccountSection
