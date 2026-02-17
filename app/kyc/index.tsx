import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { Link } from 'expo-router'
import { useAuth } from '@/services/useAuth'
import { getKycStatus, KycStatusResponse } from '@/api/kyc'
import { FEATURE_BVN, FEATURE_KYC_CENTER, FEATURE_OTP } from '@/constants/featureFlags'

type KycStatus = NonNullable<KycStatusResponse['data']>

const isKycStatusResponse = (payload: unknown): payload is KycStatusResponse => {
  return Boolean(payload && typeof payload === 'object' && 'data' in (payload as Record<string, unknown>))
}

const extractProfile = (payload?: unknown): KycStatus | null => {
  if (!payload) return null
  if (isKycStatusResponse(payload)) return payload.data ?? null
  return payload as KycStatus
}

const StatusPill = ({ label, ok }: { label: string; ok: boolean }) => (
  <View className={`px-3 py-1 rounded-full ${ok ? 'bg-green-700' : 'bg-yellow-700'}`}>
    <Text className="text-white text-xs font-semibold">{label}</Text>
  </View>
)

const USE_CASE_LABELS: Record<string, string> = {
  send_receive: 'Send & receive money',
  virtual_cards: 'Virtual cards',
  utilities: 'Bills & utilities',
  taxes: 'Tax & statutory payments',
  students: 'Student life',
}

const USE_CASE_REQUIREMENTS: Record<string, { tier: string; label: string }> = {
  send_receive: { tier: 'tier_2', label: 'Tier 2 required for transfers' },
  virtual_cards: { tier: 'tier_2', label: 'Tier 2 required for virtual cards' },
  taxes: { tier: 'tier_2', label: 'Tier 2 required for tax payments' },
  utilities: { tier: 'tier_1', label: 'Light KYC for utilities' },
  students: { tier: 'tier_1', label: 'Light KYC for student spend' },
}

const TIER_CONFIG = {
  tier_0: {
    title: 'Tier 0 - Basic',
    description: 'Email confirmed. Best for light bill payments and trying things out.',
  },
  tier_1: {
    title: 'Tier 1 - Essentials',
    description: 'Phone verified + basic profile. Unlocks core wallet usage.',
  },
  tier_2: {
    title: 'Tier 2 - Full access',
    description: 'BVN verified + ID upload + address. Unlocks cards, tunnel, transfers.',
  },
  tier_3: {
    title: 'Tier 3 - Advanced verification',
    description: 'Liveness + advanced checks. Includes all Tier 2 capabilities.',
  },
}

const tierOrder = ['tier_0', 'tier_1', 'tier_2', 'tier_3'] as const

const normalizeTierKey = (raw: string | undefined) => {
  const key = (raw || 'tier_0').toString().toLowerCase()
  if (key === 'nil' || key === '') return 'tier_0'
  if (key === 'tier2') return 'tier_2'
  if (key === 'tier3') return 'tier_3'
  return (tierOrder.includes(key as typeof tierOrder[number]) ? key : 'tier_0') as typeof tierOrder[number]
}

const getTierState = (currentTier: string, tier: string) => {
  const currentIndex = tierOrder.indexOf(currentTier as typeof tierOrder[number])
  const tierIndex = tierOrder.indexOf(tier as typeof tierOrder[number])
  if (tierIndex < currentIndex) return 'completed'
  if (tierIndex === currentIndex) return 'current'
  return 'locked'
}

const StepRow = ({
  title,
  description,
  done,
  cta,
  href,
  disabled,
}: {
  title: string
  description: string
  done: boolean
  cta: string
  href?: string
  disabled?: boolean
}) => (
  <View className="flex-row items-start gap-3 rounded-2xl border border-gray-800 bg-gray-900/70 p-4">
    <View
      className={`h-10 w-10 items-center justify-center rounded-full border ${
        done ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-gray-700 bg-gray-950'
      }`}
    >
      <Text className={`text-xs font-semibold ${done ? 'text-emerald-300' : 'text-gray-300'}`}>
        {done ? '✓' : '•'}
      </Text>
    </View>
    <View className="flex-1">
      <View className="flex-row items-center justify-between">
        <Text className="text-white font-semibold">{title}</Text>
        <StatusPill label={done ? 'Done' : 'Pending'} ok={done} />
      </View>
      <Text className="text-gray-400 text-xs mt-1">{description}</Text>
      {!done && href ? (
        <Link href={href} asChild>
          <TouchableOpacity
            className={`border border-gray-800 py-2 rounded-xl items-center mt-3 ${
              disabled ? 'bg-gray-800' : 'bg-gray-950'
            }`}
            disabled={disabled}
          >
            <Text className={`text-xs font-semibold ${disabled ? 'text-gray-400' : 'text-white'}`}>
              {cta}
            </Text>
          </TouchableOpacity>
        </Link>
      ) : !done && !href ? (
        <View className="border border-gray-800 py-2 rounded-xl items-center mt-3 bg-gray-800">
          <Text className="text-gray-400 text-xs font-semibold">{cta}</Text>
        </View>
      ) : null}
    </View>
  </View>
)

export default function KycCenter() {
  const { userProfileData } = useAuth()
  const [status, setStatus] = useState<KycStatus | null>(() => extractProfile(userProfileData))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchStatus = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getKycStatus()
      setStatus(extractProfile(res))
    } catch (err: any) {
      setError(err?.message || 'Failed to load KYC status')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setStatus(extractProfile(userProfileData))
  }, [userProfileData])

  useEffect(() => {
    void fetchStatus()
  }, [fetchStatus])

  const phoneVerified = !!status?.phone_verified
  const bvnStatus = status?.user_kyc?.bvn_status
  const bvnVerified = bvnStatus === 'verified'

  const tierLabel = useMemo(() => status?.kyc_level || 'tier_0', [status?.kyc_level])
  const normalizedTier = normalizeTierKey(tierLabel as string)
  const rawTier = String(status?.kyc_level || 'tier_0').toLowerCase()
  const profile = status?.user_profile || {}
  const idType = status?.id_type || profile?.id_type || ''
  const hasAddress = Boolean(
    profile?.address_line1 && profile?.city && profile?.state && profile?.country
  )
  const proofType = profile?.proof_of_address_type
  const idDocUrl = profile?.id_document_url
  const proofUrl = profile?.proof_of_address_url
  const isNinFlow = String(idType || '').toLowerCase() === 'nin'
  const docsComplete = Boolean(
    idType && hasAddress && proofType && proofUrl && (isNinFlow || idDocUrl)
  )
  const useCase = String(status?.primary_use_case || status?.user_profile?.primary_use_case || '')
    .trim()
    .toLowerCase()
  const useCaseLabel = USE_CASE_LABELS[useCase] || 'Choose a use case'
  const useCaseRequirement = USE_CASE_REQUIREMENTS[useCase]
  const hasBasicProfile = Boolean(
    profile?.first_name && profile?.last_name && profile?.phone_number && profile?.date_of_birth
  )
  const phoneVerifiedAt = profile?.phone_verified_at || status?.phone_verified_at
  const tier1Complete = hasBasicProfile && (phoneVerified || !!phoneVerifiedAt)
  const tier3Verified = rawTier === 'tier_3'
  const tier2Complete =
    normalizedTier === 'tier_2' || normalizedTier === 'tier_3' || (tier1Complete && bvnVerified && docsComplete)
  const tier3Enabled = FEATURE_KYC_CENTER
  const tier3Status = status?.user_kyc?.tier3_status || ''
  const tier3Pending = ['pending', 'processing'].includes(tier3Status)
  const tier3Error = status?.user_kyc?.tier3_error

  if (!FEATURE_KYC_CENTER) {
    return (
      <View className="flex-1 bg-primary px-5 py-8">
        <Text className="text-white text-xl font-semibold mb-2">KYC Center</Text>
        <Text className="text-gray-400">KYC Center is currently disabled.</Text>
      </View>
    )
  }

  return (
    <ScrollView className="flex-1 bg-primary px-5" contentContainerStyle={{ paddingBottom: 40 }}>
      <View className="py-6">
        <Text className="text-white text-2xl font-semibold">KYC Center</Text>
        <Text className="text-gray-400 mt-1">
          Complete verification to unlock cards, tunnel, and higher limits.
        </Text>
      </View>

      <View className="rounded-3xl border border-gray-800 bg-gray-900/80 p-5 mb-4">
        <Text className="text-gray-400 text-xs uppercase tracking-widest">KYC overview</Text>
        <Text className="text-white text-xl font-semibold mt-2">{tierLabel}</Text>
        <Text className="text-gray-400 text-xs mt-2">
          {TIER_CONFIG[normalizedTier]?.description || TIER_CONFIG.tier_0.description}
        </Text>
      </View>

      <View className="rounded-3xl border border-app-primary/40 bg-app-primary/10 p-5 mb-4">
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-white font-semibold">Primary use case</Text>
          <StatusPill label={useCase ? 'Selected' : 'Required'} ok={!!useCase} />
        </View>
        <Text className="text-white text-lg font-semibold mt-1">{useCaseLabel}</Text>
        {useCaseRequirement ? (
          <Text className="text-gray-200 text-xs mt-2">{useCaseRequirement.label}</Text>
        ) : (
          <Text className="text-gray-200 text-xs mt-2">
            Select how you plan to use BitBridge to personalize your KYC steps.
          </Text>
        )}
        <Link href="/onboarding/use-case" asChild>
          <TouchableOpacity className="bg-black/40 border border-app-primary/40 py-3 rounded-xl items-center mt-4">
            <Text className="text-white font-semibold">
              {useCase ? 'Update use case' : 'Select use case'}
            </Text>
          </TouchableOpacity>
        </Link>
      </View>

      <View className="mb-4">
        <Text className="text-white text-base font-semibold mb-3">Verification steps</Text>
        <View className="gap-3">
          <StepRow
            title="Basic profile"
            description="Name, phone number, and date of birth."
            done={hasBasicProfile}
            cta={hasBasicProfile ? 'Edit profile' : 'Complete profile'}
            href="/onboarding/basic-profile"
          />
          {FEATURE_OTP ? (
            <StepRow
              title="Phone verification"
              description={phoneVerified ? 'Your phone number is verified.' : 'Verify your phone number via OTP.'}
              done={phoneVerified}
              cta={phoneVerified ? 'View OTP' : 'Start OTP'}
              href="/kyc/otp"
            />
          ) : null}
          {FEATURE_BVN ? (
            <StepRow
              title="BVN verification"
              description={bvnVerified ? 'Your BVN is verified.' : 'Verify your BVN to reach Tier 2.'}
              done={bvnVerified}
              cta={bvnVerified ? 'View BVN' : 'Start BVN'}
              href="/kyc/bvn"
            />
          ) : null}
          <StepRow
            title="Documents & address"
            description={
              docsComplete
                ? 'ID type, address, and proof documents are on file.'
                : 'Upload your ID document and proof of address.'
            }
            done={docsComplete}
            cta={docsComplete ? 'View documents' : 'Upload documents'}
            href="/kyc/documents"
          />
          {tier3Enabled && tier2Complete ? (
            <StepRow
              title="Tier 3 live selfie"
              description={
                tier3Verified
                  ? 'Your liveness check is verified.'
                  : tier3Pending
                  ? 'Liveness submitted. Awaiting result.'
                  : tier3Error
                  ? tier3Error
                  : 'Capture a live selfie to complete Tier 3 verification.'
              }
              done={tier3Verified}
              cta={
                tier3Verified
                  ? 'Verified'
                : tier3Pending
                ? 'Verifying'
                : 'Retry verification'
              }
              href={tier3Verified ? undefined : tier3Pending ? undefined : '/kyc/tier3-capture'}
              disabled={tier3Pending || tier3Verified}
            />
          ) : null}
        </View>
      </View>

      {loading ? (
        <View className="py-4">
          <ActivityIndicator />
        </View>
      ) : null}

      {error ? (
        <View className="bg-red-500/20 border border-red-500/30 rounded-xl p-3 mb-4">
          <Text className="text-white font-semibold">Error</Text>
          <Text className="text-white/80">{error}</Text>
          <TouchableOpacity onPress={fetchStatus} className="mt-3 bg-red-600 py-2 rounded-lg">
            <Text className="text-white text-center">Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View className="bg-gray-900 rounded-2xl p-4 mb-4">
        <Text className="text-white font-semibold mb-2">BVN details</Text>
        <Text className="text-gray-400 text-xs">
          {bvnVerified ? 'Verified' : bvnStatus || 'Pending'}
        </Text>
        {status?.user_kyc?.bvn_last4 ? (
          <Text className="text-gray-500 text-xs mt-2">BVN ending •••• {status.user_kyc.bvn_last4}</Text>
        ) : null}
      </View>

    </ScrollView>
  )
}
