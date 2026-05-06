import React, { useMemo } from 'react'
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
  const step = normalized.nextStep
  const hasPhone = Boolean(String(prefilledPhone || '').trim())
  const hasValidPhone = isValidNgPhone(prefilledPhone)
  const accountNumber = normalized.displayAccountNumber || normalized.rawAccountNumber || '----'
  const copyValue = normalized.rawAccountNumber || normalized.displayAccountNumber || ''

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
    if (!platformTier2) return 'Complete Tier 2 verification before creating a deposit account.'
    if (normalized.backendFlowState === 'blocked_profile_incomplete') return 'Your profile is incomplete. Update your profile to continue.'
    if (normalized.backendFlowState === 'blocked_phone_exists') return 'Phone number conflict at provider. Update your phone number and retry.'
    if (normalized.backendFlowState === 'pending_kyc_review') return 'Anchor is reviewing your KYC. Refresh status in a moment.'
    if (normalized.backendFlowState === 'blocked_kyc') return 'Your account needs KYC eligibility before Anchor onboarding.'
    if (normalized.kycState === 'pending') return 'Anchor is currently reviewing your KYC submission.'
    if (normalized.depositReady) return 'Your deposit account is ready to receive funds.'
    return 'Complete the steps below to generate your business account number.'
  }, [normalized, platformTier2])

  const stepTitle = useMemo(() => {
    if (step === 'DONE') return 'Setup complete'
    return 'Generate account number'
  }, [step])

  const inactiveNumberMessage =
    normalized.hasAnchorAccount && normalized.hasAccountNumber && normalized.kycState !== 'verified'
      ? 'Account number created. Deposits activate after KYC is verified.'
      : null

  const primaryAction = useMemo(() => {
    if (!platformTier2) return null
    if (
      (actionBlockReason ||
        !hasPhone ||
        !hasValidPhone ||
        normalized.backendFlowState === 'blocked_profile_incomplete' ||
        normalized.backendFlowState === 'blocked_phone_exists') &&
      onGoToProfile
    ) {
      return { label: 'Update Profile', onPress: async () => onGoToProfile() }
    }
    if (
      normalized.capabilities?.can_create_anchor_profile === false &&
      normalized.capabilities?.can_submit_anchor_kyc === false &&
      normalized.capabilities?.can_provision_account_number === false
    ) {
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

  const copyAccountNumber = async () => {
    if (!copyValue) {
      Alert.alert('Unavailable', 'Full account number is not available yet.')
      return
    }
    try {
      const Clipboard = await import('expo-clipboard')
      await Clipboard.setStringAsync(String(copyValue))
      Alert.alert('Copied', 'Account number copied.')
    } catch {
      Alert.alert('Account number', String(copyValue))
    }
  }

  if (step === 'DONE') {
    return (
      <View className="mt-6 rounded-3xl border border-white/8 bg-[#0F1420] p-4">
        <Text className="text-white text-base font-semibold">Deposit Account</Text>
        {normalized.displayAccountNumber ? (
          <View className="mt-3 rounded-2xl border border-white/6 bg-white/4 px-4 py-4">
            <Text className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Account number</Text>
            <Text className="mt-2 text-xl font-semibold text-white" numberOfLines={1}>
              {accountNumber}
            </Text>
          </View>
        ) : null}
        <View className="mt-3 rounded-2xl border border-white/6 bg-white/4 px-4 py-3">
          {normalized.accountName ? (
            <Text className="text-sm text-slate-200" numberOfLines={1}>
              Account Name: {normalized.accountName}
            </Text>
          ) : null}
          {normalized.bankName ? (
            <Text className="mt-1 text-xs text-slate-500" numberOfLines={1}>
              Bank: {normalized.bankName}
            </Text>
          ) : null}
        </View>
        <View className="mt-3 flex-row gap-3">
          <TouchableOpacity
            onPress={copyAccountNumber}
            className="flex-1 rounded-2xl border border-white/8 bg-white/5 px-4 py-3"
          >
            <Text className="text-center text-sm font-semibold text-white">Copy account number</Text>
          </TouchableOpacity>
        </View>
        <Text className="mt-3 text-xs text-slate-400">Use this account to fund your wallet.</Text>
      </View>
    )
  }

  return (
    <View className="mt-4 rounded-3xl border border-white/8 bg-[#0F1420] p-4 gap-3">
      <Text className="text-white text-base font-semibold">Onboarding progress</Text>
      <View className="flex-row items-center gap-2">
        <View className={`h-1 flex-1 rounded-full ${normalized.hasAnchorAccount ? 'bg-emerald-400' : 'bg-gray-700'}`} />
        <View className={`h-1 flex-1 rounded-full ${normalized.kycState === 'verified' ? 'bg-emerald-400' : 'bg-gray-700'}`} />
        <View className={`h-1 flex-1 rounded-full ${normalized.hasAccountNumber ? 'bg-emerald-400' : 'bg-gray-700'}`} />
      </View>

      <View className="rounded-2xl border border-white/6 bg-white/4 p-3">
        <Text className="text-white text-sm font-semibold">{stepTitle}</Text>
        <Text className="mt-1 text-xs leading-5 text-slate-200">{explanation}</Text>
        <Text className="mt-2 text-xs text-slate-400">KYC Status: {statusLabel}</Text>
      </View>

      {inactiveNumberMessage ? (
        <View className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3">
          <Text className="text-xs text-amber-100">{inactiveNumberMessage}</Text>
        </View>
      ) : null}

      {!platformTier2 ? (
        <View className="mt-1">
          <Text className="text-xs text-slate-400">Complete Tier 2 verification in your profile to enable deposit accounts.</Text>
          {onGoToKyc ? (
            <TouchableOpacity onPress={onGoToKyc} className="mt-3 rounded-2xl border border-white/8 bg-white/5 px-4 py-3">
              <Text className="text-center text-xs font-semibold text-white">Complete Tier 2</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {actionBlockReason ? (
        <View className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3">
          <Text className="text-xs text-amber-100">{actionBlockReason}</Text>
        </View>
      ) : null}

      {primaryAction ? (
        <TouchableOpacity
          onPress={primaryAction.onPress}
          className="mt-1 rounded-2xl bg-app-primary px-4 py-3"
          disabled={loading}
        >
          <Text className="text-center font-medium text-white">{primaryAction.label}</Text>
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity
        onPress={onRefresh}
        className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3"
        disabled={loading}
      >
        <Text className="text-center text-xs font-semibold text-white">Refresh status</Text>
      </TouchableOpacity>
    </View>
  )
}

export default DepositAccountSection
