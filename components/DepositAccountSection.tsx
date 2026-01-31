import React, { useMemo } from 'react'
import { Alert, Text, TouchableOpacity, View } from 'react-native'
import FormInput from '@/components/FormInput'
import FormSelect from '@/components/FormSelect'
import { getAnchorNextStep, normalizeAnchorOnboarding } from '@/services/useAnchorOnboarding'

export type DepositAccountSectionProps = {
  normalized: ReturnType<typeof normalizeAnchorOnboarding>
  loading: boolean
  onCreateAnchor: () => Promise<void>
  onVerifyKyc: () => Promise<void>
  onGenerateAccount: () => Promise<void>
  onRefresh: () => Promise<void>
  kycForm: { bvn: string; dob: string; gender: string }
  setKycForm: (next: { bvn: string; dob: string; gender: string }) => void
  prefilledDob?: string
  prefilledGender?: string
}

const DepositAccountSection = ({
  normalized,
  loading,
  onCreateAnchor,
  onVerifyKyc,
  onGenerateAccount,
  onRefresh,
  kycForm,
  setKycForm,
  prefilledDob,
  prefilledGender,
}: DepositAccountSectionProps) => {
  const step = useMemo(() => getAnchorNextStep(normalized), [normalized])
  const maskedAccountNumber = normalized.displayAccountNumber || '----'

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
    if (!normalized.hasAnchorAccount) return 'Create your Anchor account to get started.'
    if (normalized.kycState !== 'verified') return 'Finish verification to unlock deposits.'
    if (!normalized.hasAccountNumber) return 'Generate your account number to fund your wallet.'
    return 'You are ready to fund your wallet.'
  }, [normalized])

  const inactiveNumberMessage =
    normalized.hasAnchorAccount && normalized.hasAccountNumber && normalized.kycState !== 'verified'
      ? 'Account number created. Deposits will activate after verification.'
      : null

  const primaryAction = useMemo(() => {
    switch (step) {
      case 'CREATE_ANCHOR':
        return { label: 'Create Anchor Account', onPress: onCreateAnchor }
      case 'DO_KYC':
        return { label: 'Verify Anchor KYC', onPress: onVerifyKyc }
      case 'GENERATE_NUMBER':
        return { label: 'Generate Account Number', onPress: onGenerateAccount }
      default:
        return null
    }
  }, [step, onCreateAnchor, onVerifyKyc, onGenerateAccount])

  if (step === 'DONE') {
    return (
      <View className="bg-gray-900 border border-gray-800 rounded-2xl p-4 mt-6">
        <Text className="text-white font-semibold">Deposit Account</Text>
        {normalized.displayAccountNumber ? (
          <View className="mt-3">
            <Text className="text-gray-400 text-xs">Account number</Text>
            <Text className="text-white text-lg font-semibold mt-1">
              {normalized.displayAccountNumber}
            </Text>
          </View>
        ) : null}
        {normalized.accountName ? (
          <Text className="text-gray-300 mt-2">Account Name: {normalized.accountName}</Text>
        ) : null}
        {normalized.bankName ? (
          <Text className="text-gray-300">Bank: {normalized.bankName}</Text>
        ) : null}
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
          className="bg-gray-950 border border-gray-800 px-3 py-2 rounded-full mt-3 self-start"
        >
          <Text className="text-white text-xs">Copy</Text>
        </TouchableOpacity>
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
        <Text className="text-gray-200 text-xs">{explanation}</Text>
      </View>

      <View className="mt-1">
        <Text className="text-gray-200 text-sm">Step 1: Anchor account</Text>
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

      {normalized.hasAnchorAccount && normalized.kycState !== 'verified' ? (
        <View className="mt-4">
          <Text className="text-gray-200 text-sm mb-2">Verify Anchor KYC</Text>
          <Text className="text-gray-500 text-xs mb-3">
            Why can’t I deposit yet? Verification is still pending.
          </Text>
          <FormInput
            label="BVN"
            value={kycForm.bvn}
            onChangeText={(value: string) => setKycForm({ ...kycForm, bvn: value })}
            keyboardType="numeric"
          />
          <FormInput
            label="Date of Birth (YYYY-MM-DD)"
            value={kycForm.dob}
            editable={!prefilledDob}
            onChangeText={(value: string) => setKycForm({ ...kycForm, dob: value })}
          />
          <FormSelect
            label="Gender (optional)"
            selectedValue={kycForm.gender}
            disabled={!!prefilledGender}
            onValueChange={(value: string) => setKycForm({ ...kycForm, gender: value })}
            options={[
              { label: 'Select gender', value: '' },
              { label: 'Male', value: 'male' },
              { label: 'Female', value: 'female' },
            ]}
          />
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
