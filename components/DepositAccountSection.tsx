import React, { useEffect, useMemo, useState } from 'react'
import { Alert, Text, TouchableOpacity, View } from 'react-native'
import FormInput from '@/components/FormInput'
import FormSelect from '@/components/FormSelect'
import { normalizeAnchorOnboarding } from '@/services/useAnchorOnboarding'
import { isValidNgPhone } from '@/utils/phone'

export type DepositAccountSectionProps = {
  normalized: ReturnType<typeof normalizeAnchorOnboarding>
  loading: boolean
  onCreateAnchor: () => Promise<void>
  onVerifyKyc: () => Promise<void>
  onGenerateAccount: () => Promise<void>
  onRefresh: () => Promise<void>
  anchorForm: {
    address: string
    city: string
    state: string
    postal_code: string
    bvn: string
    dob: string
    gender: string
  }
  setAnchorForm: (next: {
    address: string
    city: string
    state: string
    postal_code: string
    bvn: string
    dob: string
    gender: string
  }) => void
  prefilledDob?: string
  prefilledGender?: string
  prefilledAddress?: string
  prefilledCity?: string
  prefilledState?: string
  prefilledPostal?: string
  platformTier2?: boolean
  onGoToKyc?: () => void
  prefilledPhone?: string
  onGoToProfile?: () => void
  actionBlockReason?: string | null
}

const DepositAccountSection = ({
  normalized,
  loading,
  onCreateAnchor,
  onVerifyKyc,
  onGenerateAccount,
  onRefresh,
  anchorForm,
  setAnchorForm,
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
    if (!platformTier2)
      return 'Complete Tier 2 verification before setting up a deposit account.'
    if (normalized.backendFlowState === 'blocked_profile_incomplete')
      return 'Your profile is incomplete. Update profile details before continuing.'
    if (normalized.backendFlowState === 'blocked_phone_exists')
      return 'Your phone number already exists at provider. Update phone in profile or contact support.'
    if (normalized.backendFlowState === 'blocked_kyc')
      return 'Complete KYC to unlock Anchor deposits.'
    if (!normalized.hasAnchorAccount) return 'Provide your details to create a deposit profile.'
    if (normalized.kycState != 'verified') return 'Finish Anchor verification to unlock deposits.'
    if (!normalized.hasAccountNumber) return 'Generate your account number to fund your wallet.'
    return 'You are ready to fund your wallet.'
  }, [normalized, platformTier2])
  const stepTitle = useMemo(() => {
    if (step === 'CREATE_ANCHOR') return 'Step 1 of 4: Create customer profile'
    if (step === 'DO_KYC') return 'Step 2 of 4: Complete KYC verification'
    if (step === 'GENERATE_NUMBER') return 'Step 3 of 4: Generate account number'
    return 'Step 4 of 4: Done'
  }, [step])
  const requiredNow = useMemo(() => {
    if (!platformTier2) return ['Tier 2 verification']
    if (step === 'CREATE_ANCHOR') return ['Phone on profile', 'Address', 'City', 'State', 'Postal code', 'BVN (11 digits)', 'Date of birth (YYYY-MM-DD)']
    if (step === 'DO_KYC') return ['BVN (11 digits)', 'Date of birth (YYYY-MM-DD)']
    if (step === 'GENERATE_NUMBER') return ['No extra input required']
    return ['Setup complete']
  }, [platformTier2, step])

  const inactiveNumberMessage =
    normalized.hasAnchorAccount && normalized.hasAccountNumber && normalized.kycState != 'verified'
      ? 'Account number created. Deposits will activate after verification.'
      : null

  const primaryAction = useMemo(() => {
    if (!platformTier2) return null
    if ((!hasPhone || !hasValidPhone) && onGoToProfile) {
      return { label: 'Update Profile', onPress: async () => onGoToProfile() }
    }
    if (
      (normalized.backendFlowState === 'blocked_profile_incomplete' ||
        normalized.backendFlowState === 'blocked_phone_exists') &&
      onGoToProfile
    ) {
      return { label: 'Update Profile', onPress: async () => onGoToProfile() }
    }
    switch (step) {
      case 'CREATE_ANCHOR':
        if (normalized.capabilities?.can_create_anchor_profile === false) return null
        return { label: 'Create deposit profile', onPress: onCreateAnchor }
      case 'DO_KYC':
        if (normalized.capabilities?.can_submit_anchor_kyc === false) return null
        if (normalized.kycState === 'pending') return null
        return { label: 'Verify identity', onPress: onVerifyKyc }
      case 'GENERATE_NUMBER':
        if (normalized.capabilities?.can_provision_account_number === false) return null
        return { label: 'Generate Account Number', onPress: onGenerateAccount }
      default:
        return null
    }
  }, [
    step,
    platformTier2,
    normalized.backendFlowState,
    normalized.kycState,
    normalized.capabilities,
    hasPhone,
    hasValidPhone,
    onCreateAnchor,
    onVerifyKyc,
    onGenerateAccount,
    onGoToProfile,
  ])

  if (step == 'DONE') {
    return (
      <View className="bg-gray-900 border border-gray-800 rounded-2xl p-4 mt-6">
        <Text className="text-white font-semibold">Deposit Account</Text>
        {normalized.displayAccountNumber ? (
          <View className="mt-3">
            <Text className="text-gray-400 text-xs">Account number</Text>
            <Text className="text-white text-lg font-semibold mt-1">
              {accountNumberToDisplay}
            </Text>
          </View>
        ) : null}
        {normalized.accountName ? (
          <Text className="text-gray-300 mt-2">Account Name: {normalized.accountName}</Text>
        ) : null}
        {normalized.bankName ? (
          <Text className="text-gray-300">Bank: {normalized.bankName}</Text>
        ) : null}
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
        <View
          className={`flex-1 h-1 rounded-full ${
            normalized.hasAnchorAccount ? 'bg-emerald-400' : 'bg-gray-700'
          }`}
        />
        <View
          className={`flex-1 h-1 rounded-full ${
            normalized.kycState === 'verified' ? 'bg-emerald-400' : 'bg-gray-700'
          }`}
        />
        <View
          className={`flex-1 h-1 rounded-full ${
            normalized.hasAccountNumber ? 'bg-emerald-400' : 'bg-gray-700'
          }`}
        />
      </View>
      <View className="flex-row justify-between">
        <Text className="text-gray-400 text-xs">Account</Text>
        <Text className="text-gray-400 text-xs">KYC</Text>
        <Text className="text-gray-400 text-xs">Account #</Text>
      </View>

      <View className="rounded-xl border border-gray-800 bg-gray-950/60 p-3">
        <Text className="text-white text-sm font-semibold">{stepTitle}</Text>
        <Text className="text-gray-200 text-xs">{explanation}</Text>
        <Text className="text-gray-400 text-xs mt-2">Required now:</Text>
        {requiredNow.map((item) => (
          <Text key={item} className="text-gray-300 text-xs mt-1">
            • {item}
          </Text>
        ))}
      </View>

      <View className="mt-1">
        <Text className="text-gray-200 text-sm">Step 1: Customer details</Text>
        <Text className="text-gray-400 text-xs">
          {normalized.hasAnchorAccount ? 'Account exists' : 'Not created yet'}
        </Text>
      </View>

      <View className="mt-3">
        <Text className="text-gray-200 text-sm">Step 2: Anchor KYC</Text>
        <Text className="text-gray-400 text-xs">Status: {statusLabel}</Text>
        <Text className="text-gray-500 text-xs mt-1">Verify once to unlock deposits.</Text>
      </View>

      <View className="mt-3">
        <Text className="text-gray-200 text-sm">Step 3: Virtual account number</Text>
        <Text className="text-gray-400 text-xs">
          {normalized.displayAccountNumber
            ? `Account Number: ${maskedAccountNumber}`
            : 'Not generated yet'}
        </Text>
      </View>

      {inactiveNumberMessage ? (
        <View className="mt-3 rounded-xl border border-amber-500/40 bg-amber-900/20 p-3">
          <View className="flex-row items-center justify-between">
            <Text className="text-amber-200 text-xs">Inactive until verified</Text>
            {maskedAccountNumber ? (
              <Text className="text-amber-100 text-xs font-semibold">{maskedAccountNumber}</Text>
            ) : null}
          </View>
          <Text className="text-amber-200 text-xs mt-1">{inactiveNumberMessage}</Text>
        </View>
      ) : null}

      {!platformTier2 ? (
        <View className="mt-4">
          <Text className="text-gray-200 text-sm mb-2">Tier 2 required</Text>
          <Text className="text-gray-500 text-xs">
            Complete Tier 2 verification in your profile to enable deposit accounts.
          </Text>
          {onGoToKyc ? (
            <TouchableOpacity
              onPress={onGoToKyc}
              className="bg-gray-950 border border-gray-800 py-3 rounded-xl mt-3"
            >
              <Text className="text-white text-center text-xs">Complete Tier 2</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : !normalized.hasAnchorAccount ? (
        <View className="mt-4">
          <Text className="text-gray-200 text-sm mb-2">Customer details</Text>
          <Text className="text-gray-500 text-xs mb-3">
            These details are required to create your deposit profile with Anchor.
          </Text>
          <FormInput
            label="Phone number"
            value={prefilledPhone || ''}
            editable={false}
          />
          {!hasPhone ? (
            <Text className="text-amber-300 text-xs mt-1">
              Phone is missing. Add phone number in profile before continuing.
            </Text>
          ) : null}
          {onGoToProfile ? (
            <TouchableOpacity onPress={onGoToProfile} className="mt-2 self-start">
              <Text className="text-alt text-xs">Edit phone in profile</Text>
            </TouchableOpacity>
          ) : null}
          <FormInput
            label="Address"
            value={anchorForm.address}
            onChangeText={(value: string) => setAnchorForm({ ...anchorForm, address: value })}
          />
          <FormInput
            label="City"
            value={anchorForm.city}
            onChangeText={(value: string) => setAnchorForm({ ...anchorForm, city: value })}
          />
          <FormInput
            label="State"
            value={anchorForm.state}
            onChangeText={(value: string) => setAnchorForm({ ...anchorForm, state: value })}
          />
          <FormInput
            label="Postal code"
            value={anchorForm.postal_code}
            onChangeText={(value: string) => setAnchorForm({ ...anchorForm, postal_code: value })}
          />
          <FormInput
            label="BVN"
            value={anchorForm.bvn}
            onChangeText={(value: string) => setAnchorForm({ ...anchorForm, bvn: value })}
            keyboardType="numeric"
          />
          <FormInput
            label="Date of Birth (YYYY-MM-DD)"
            value={anchorForm.dob}
            onChangeText={(value: string) => setAnchorForm({ ...anchorForm, dob: value })}
          />
          <FormSelect
            label="Gender (optional)"
            selectedValue={anchorForm.gender}
            onValueChange={(value: string) => setAnchorForm({ ...anchorForm, gender: value })}
            options={[
              { label: 'Select gender', value: '' },
              { label: 'Male', value: 'male' },
              { label: 'Female', value: 'female' },
            ]}
          />
        </View>
      ) : normalized.kycState === 'not_started' ? (
        <View className="mt-4">
          <Text className="text-gray-200 text-sm mb-2">Verify identity</Text>
          <Text className="text-gray-500 text-xs mb-3">
            Submit your Anchor KYC to unlock deposits.
          </Text>
          <FormInput
            label="Phone number"
            value={prefilledPhone || ''}
            editable={false}
          />
          {!hasPhone ? (
            <Text className="text-amber-300 text-xs mt-1">
              Phone is missing. Add phone number in profile before continuing.
            </Text>
          ) : null}
          {onGoToProfile ? (
            <TouchableOpacity onPress={onGoToProfile} className="mt-2 self-start">
              <Text className="text-alt text-xs">Edit phone in profile</Text>
            </TouchableOpacity>
          ) : null}
          <FormInput
            label="BVN"
            value={anchorForm.bvn}
            onChangeText={(value: string) => setAnchorForm({ ...anchorForm, bvn: value })}
            keyboardType="numeric"
          />
          <FormInput
            label="Date of Birth (YYYY-MM-DD)"
            value={anchorForm.dob}
            onChangeText={(value: string) => setAnchorForm({ ...anchorForm, dob: value })}
          />
          <FormSelect
            label="Gender (optional)"
            selectedValue={anchorForm.gender}
            onValueChange={(value: string) => setAnchorForm({ ...anchorForm, gender: value })}
            options={[
              { label: 'Select gender', value: '' },
              { label: 'Male', value: 'male' },
              { label: 'Female', value: 'female' },
            ]}
          />
        </View>
      ) : normalized.kycState === 'pending' ? (
        <View className="mt-4">
          <Text className="text-gray-200 text-sm mb-2">Verification in progress</Text>
          <Text className="text-gray-500 text-xs">
            Anchor is verifying your identity. Tap refresh to update the status.
          </Text>
        </View>
      ) : null}

      {actionBlockReason ? (
        <View className="mt-3 rounded-xl border border-amber-500/40 bg-amber-900/20 p-3">
          <Text className="text-amber-200 text-xs">{actionBlockReason}</Text>
        </View>
      ) : null}

      {primaryAction ? (
        <TouchableOpacity
          onPress={primaryAction.onPress}
          className="bg-app-primary py-3 rounded-xl mt-4"
          disabled={loading}
        >
          <Text className="text-white text-center font-medium">{primaryAction.label}</Text>
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity
        onPress={onRefresh}
        className="bg-gray-900 border border-gray-800 py-3 rounded-xl mt-3"
        disabled={loading}
      >
        <Text className="text-white text-center text-xs">Refresh status</Text>
      </TouchableOpacity>
    </View>
  )
}

export default DepositAccountSection
