import React, { useMemo } from 'react'
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native'
import { Link } from 'expo-router'
import useFetch from '@/services/useFetch'
import { getUserCards } from '@/api/cards'
import { useAuth } from '@/services/useAuth'
import { resolveUserProfile } from '@/services/auth/resolveUserProfile'
import ScreenContainer from '@/components/ScreenContainer'
import moneyFormat from '@/utils/moneyFormat'

const normalizeLast4 = (value: any) => {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (!digits) return null
  return digits.slice(-4).padStart(4, '0')
}

const CardsScreen = () => {
  const { data, loading, error, refetch } = useFetch(() => getUserCards())
  const {
    userProfileData,
    authHydrated,
    authenticated,
    profileError,
    profileErrorStatus,
    loadProfile,
    profileLoading,
  } = useAuth()

  const cards = useMemo(() => {
    const payload = data?.data ?? data
    if (Array.isArray(payload)) return payload
    if (Array.isArray(payload?.cards)) return payload.cards
    if (Array.isArray(payload?.data)) return payload.data
    if (Array.isArray(payload?.data?.cards)) return payload.data.cards
    if (Array.isArray(payload?.results)) return payload.results
    if (payload?.card) return [payload.card]
    if (payload?.card_id) return [payload]
    return []
  }, [data])

  const profileResolution = useMemo(() => {
    try {
      if (typeof resolveUserProfile !== 'function') {
        if (__DEV__) {
          console.warn('[Cards] resolveUserProfile export missing; falling back to empty profile')
        }
        return { profileRoot: {}, failed: true }
      }
      return { profileRoot: resolveUserProfile(userProfileData), failed: false }
    } catch (err) {
      if (__DEV__) {
        console.warn('[Cards] resolveUserProfile failed', (err as any)?.message || err)
      }
      return { profileRoot: {}, failed: true }
    }
  }, [userProfileData])

  const hasKycAccess = useMemo(() => {
    const profileRoot = profileResolution.profileRoot
    const kycLevel = profileRoot?.kyc_level || profileRoot?.user_kyc?.kyc_level
    const phoneVerified = profileRoot?.phone_verified === true || profileRoot?.phone_verified_at
    if (!kycLevel && !phoneVerified) return false
    if (kycLevel && String(kycLevel).toLowerCase() === 'tier_0') return false
    return true
  }, [profileResolution.profileRoot])

  const cardsCount = cards.length

  if (!authHydrated) {
    return (
      <ScreenContainer>
        <View className="py-6">
          <ActivityIndicator />
        </View>
      </ScreenContainer>
    )
  }

  if (!authenticated) {
    return (
      <ScreenContainer>
        <View className="bg-gray-900 border border-gray-800 rounded-2xl p-4 mt-6">
          <Text className="text-white text-base font-semibold">Session required</Text>
          <Text className="text-gray-400 text-xs mt-2">Please log in again to access virtual cards.</Text>
          <Link href="/login" asChild>
            <TouchableOpacity className="bg-app-primary py-3 rounded-xl mt-4">
              <Text className="text-white text-center font-medium">Go to Login</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScreenContainer>
    )
  }

  const hasProfileFailure = Boolean(profileError) || profileResolution.failed
  const sessionExpired = profileErrorStatus === 401 || profileErrorStatus === 403

  if (hasProfileFailure && !profileLoading) {
    return (
      <ScreenContainer>
        <View className="bg-red-500/20 border border-red-500/30 rounded-xl p-3 mt-4">
          <Text className="text-white font-semibold">Unable to load profile</Text>
          <Text className="text-white/80 mt-1">
            {profileError || 'Profile data is not ready. Please retry.'}
          </Text>
          <TouchableOpacity
            onPress={() => loadProfile({ force: true })}
            className="mt-3 bg-red-600 py-2 rounded-lg"
          >
            <Text className="text-white text-center">Retry</Text>
          </TouchableOpacity>
          {sessionExpired ? (
            <Link href="/login" asChild>
              <TouchableOpacity className="mt-3 border border-red-300/40 py-2 rounded-lg">
                <Text className="text-white text-center">Go to Login</Text>
              </TouchableOpacity>
            </Link>
          ) : null}
        </View>
      </ScreenContainer>
    )
  }

  return (
    <ScreenContainer>
      <View className="flex-row items-center justify-between">
        <View>
          <Text className="text-white text-2xl font-semibold">Cards</Text>
          <Text className="text-gray-400 text-xs mt-1">Virtual cards for USD spend.</Text>
        </View>
        <Link href={hasKycAccess ? '/cards/create' : '/kyc'} asChild>
          <TouchableOpacity className="bg-app-primary px-4 py-2 rounded-full">
            <Text className="text-white text-xs">
              {hasKycAccess ? 'Create card' : 'Complete KYC'}
            </Text>
          </TouchableOpacity>
        </Link>
      </View>

      <View className="bg-gray-900/80 border border-gray-800 rounded-3xl px-5 py-6 mt-6">
        <Text className="text-white/70 text-xs tracking-widest uppercase">Tunnel (USD)</Text>
        <Text className="text-white text-2xl font-semibold mt-2">Virtual Cards</Text>
        <Text className="text-gray-300 mt-2 text-sm">
          Cards are funded from your USD Tunnel wallet.
        </Text>
        <View className="flex-row gap-2 mt-4">
          <View className="bg-gray-950 border border-gray-800 rounded-full px-3 py-1">
            <Text className="text-xs text-gray-300">Cards: {cardsCount}</Text>
          </View>
          <View className="bg-gray-950 border border-gray-800 rounded-full px-3 py-1">
            <Text className="text-xs text-gray-300">
              KYC: {hasKycAccess ? 'Verified' : 'Required'}
            </Text>
          </View>
        </View>
      </View>

      {loading ? (
        <View className="py-6">
          <ActivityIndicator />
        </View>
      ) : null}

      {error ? (
        <View className="bg-red-500/20 border border-red-500/30 rounded-xl p-3 mt-4">
          <Text className="text-white font-semibold">Error</Text>
          <Text className="text-white/80">{error?.message || 'Failed to load cards'}</Text>
          <TouchableOpacity onPress={refetch} className="mt-3 bg-red-600 py-2 rounded-lg">
            <Text className="text-white text-center">Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View className="mt-6">
        <Text className="text-white text-lg font-semibold">Your cards</Text>
        <Text className="text-gray-400 text-xs mt-1">
          Manage your virtual cards and spending controls.
        </Text>
      </View>

      <View className="mt-4 gap-3">
        {cards.length === 0 && !loading ? (
          <View className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <Text className="text-gray-300 text-center">
              {hasKycAccess
                ? 'Create a virtual card to get started.'
                : 'Complete KYC to create a virtual card.'}
            </Text>
            <Link href={hasKycAccess ? '/cards/create' : '/kyc'} asChild>
              <TouchableOpacity className="bg-app-primary py-3 rounded-xl mt-4">
                <Text className="text-white text-center font-medium">
                  {hasKycAccess ? 'Create Card' : 'Go to KYC'}
                </Text>
              </TouchableOpacity>
            </Link>
          </View>
        ) : null}

        {cards.map((card: any, index: number) => {
          const routeId = card?.id ?? card?.card_id ?? null
          const last4 = normalizeLast4(
            card?.last4 || card?.last_4 || card?.card_last4 || card?.lastFour
          )
          const status = card?.status || card?.card_status || 'active'
          const cardholder =
            [card?.first_name, card?.last_name].filter(Boolean).join(' ') ||
            [userProfileData?.user_profile?.first_name, userProfileData?.user_profile?.last_name]
              .filter(Boolean)
              .join(' ') ||
            userProfileData?.user_profile?.full_name ||
            userProfileData?.full_name ||
            '--'
          const normalizeUsdLimit = (value: any) => {
            if (value === null || value === undefined || value === '') return null
            const amount = Number(value)
            if (!Number.isFinite(amount)) return null
            return amount > 100000 ? amount / 100 : amount
          }
          const rawLimit =
            card?.card_limit_usd ??
            card?.card_limit ??
            card?.limit
          const limitValue = normalizeUsdLimit(rawLimit)
          const limit =
            limitValue !== null
              ? moneyFormat(limitValue, String(card?.card_currency || 'USD'))
              : '--'
          const statusTone =
            String(status).toLowerCase() === 'active'
              ? 'bg-emerald-500/15 text-emerald-300'
              : String(status).toLowerCase() === 'frozen'
                ? 'bg-amber-500/15 text-amber-300'
                : 'bg-red-500/15 text-red-300'

          return (
            <Link
              key={String(routeId || `card-${index}`)}
              href={
                routeId
                  ? { pathname: '/cards/[id]', params: { id: String(routeId) } }
                  : ({ pathname: '/cards' } as any)
              }
              asChild
            >
              <TouchableOpacity className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
                <View className="flex-row justify-between items-start">
                  <View>
                    <Text className="text-white text-base font-semibold">
                      {card?.card_brand || card?.brand || 'Virtual Card'}
                    </Text>
                    <Text className="text-gray-400 text-xs mt-1">Virtual • USD</Text>
                  </View>
                  <View className={`px-2 py-1 rounded-full ${statusTone}`}>
                    <Text className="text-[10px] uppercase">{status}</Text>
                  </View>
                </View>
                <View className="mt-4">
                  <Text className="text-gray-300 text-xs">Card number</Text>
                  <Text className="text-white text-sm mt-1 tracking-widest">
                    **** **** **** {last4 || '----'}
                  </Text>
                </View>
                <View className="flex-row justify-between mt-4">
                  <View>
                    <Text className="text-gray-400 text-xs">Cardholder</Text>
                    <Text className="text-white text-xs mt-1">{cardholder}</Text>
                  </View>
                  <View>
                    <Text className="text-gray-400 text-xs text-right">Limit</Text>
                    <Text className="text-white text-xs mt-1 text-right">{limit}</Text>
                  </View>
                </View>
                <Text className="text-gray-400 text-xs mt-3">
                  {routeId ? 'Tap to view details' : 'Card details will be available shortly'}
                </Text>
              </TouchableOpacity>
            </Link>
          )
        })}
      </View>
    </ScreenContainer>
  )
}

export default CardsScreen
