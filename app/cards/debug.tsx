import React, { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native'
import ScreenContainer from '@/components/ScreenContainer'
import useFetch from '@/services/useFetch'
import { useAuth } from '@/services/useAuth'
import { getCardDetails, getUserCards } from '@/api/cards'
import { getApiClientDebugSnapshot } from '@/api/client'
import { pickCardDetailsIdentifier } from '@/utils/cardIdentifier'
import {
  FEATURE_CARD_TOKENS,
  FEATURE_NEW_DASHBOARD,
  FEATURE_TIMELINE,
} from '@/constants/featureFlags'

const DEBUG_CARDS =
  String(process.env.EXPO_PUBLIC_DEBUG_CARDS || '').toLowerCase() === 'true' || __DEV__ === true

const tokenFingerprint = (token?: string | null) => {
  const raw = String(token || '').trim()
  if (!raw) return '--'
  return `${raw.slice(0, 10)}... (len=${raw.length})`
}

const stringifyPreview = (value: any) => {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value ?? '')
  }
}

const CardsDebugScreen = () => {
  const api = getApiClientDebugSnapshot()
  const { userProfileData, token } = useAuth()
  const [selectedRouteId, setSelectedRouteId] = useState<string>('')

  const list = useFetch(() => getUserCards())

  const cards = useMemo(() => {
    const payload = (list.data as any)?.data ?? list.data
    if (Array.isArray(payload)) return payload
    if (Array.isArray(payload?.cards)) return payload.cards
    if (Array.isArray(payload?.data)) return payload.data
    if (Array.isArray(payload?.data?.cards)) return payload.data.cards
    if (payload?.card) return [payload.card]
    if (payload?.card_id) return [payload]
    return []
  }, [list.data])

  useEffect(() => {
    if (!selectedRouteId && cards.length > 0) {
      setSelectedRouteId(String(pickCardDetailsIdentifier(cards[0]) || ''))
    }
  }, [cards, selectedRouteId])

  const selectedCard = useMemo(
    () =>
      cards.find((card: any) => String(pickCardDetailsIdentifier(card)) === String(selectedRouteId)) || null,
    [cards, selectedRouteId]
  )

  const details = useFetch(
    () => (selectedRouteId ? getCardDetails(selectedRouteId) : Promise.resolve({ data: {} } as any))
  )

  useEffect(() => {
    if (!DEBUG_CARDS) return
    console.log('[CARDS_DEBUG][list]', {
      endpoint: '/cards/user_card',
      baseURL: api.baseURL,
      fullUrl: `${String(api.baseURL || '').replace(/\/+$/, '')}/cards/user_card`,
      cardsCount: cards.length,
    })
  }, [cards, api.baseURL])

  useEffect(() => {
    if (!DEBUG_CARDS || !selectedRouteId) return
    console.log('[CARDS_DEBUG][details_request]', {
      endpoint: `/cards/${selectedRouteId}/details`,
      selectedRouteId,
      selectedCardKeys: Object.keys(selectedCard || {}),
      selectedCard,
    })
  }, [selectedRouteId, selectedCard])

  const userRoot = (userProfileData as any)?.data ?? userProfileData ?? {}
  const userProfile = userRoot?.user_profile ?? userRoot?.profile ?? {}
  const userId = userRoot?.id ?? userProfile?.user_id ?? userProfile?.id ?? '--'
  const userEmail = userRoot?.email ?? '--'

  const identifierCandidates = {
    id: selectedCard?.id,
    card_id: selectedCard?.card_id,
    provider_id: selectedCard?.provider_id,
    bridgecard_id: selectedCard?.bridgecard_id,
    bridge_card_id: selectedCard?.bridge_card_id,
    last4: selectedCard?.last4 ?? selectedCard?.last_4,
    reference: selectedCard?.reference ?? selectedCard?.transaction_reference,
  }

  if (!DEBUG_CARDS) {
    return (
      <ScreenContainer>
        <View className="bg-gray-900 border border-gray-800 rounded-2xl p-4 mt-6">
          <Text className="text-white font-semibold">Cards Debug Panel Disabled</Text>
          <Text className="text-gray-400 text-xs mt-2">
            Set `EXPO_PUBLIC_DEBUG_CARDS=true` and reload to enable this panel.
          </Text>
        </View>
      </ScreenContainer>
    )
  }

  return (
    <ScreenContainer>
      <View className="pt-2">
        <Text className="text-white text-2xl font-semibold">Cards Debug Panel</Text>
        <Text className="text-gray-400 text-xs mt-1">
          Temporary diagnostics for list/details identifier and API environment drift.
        </Text>
      </View>

      <View className="bg-gray-900 border border-gray-800 rounded-2xl p-4 mt-4">
        <Text className="text-white font-semibold">Runtime</Text>
        <Text className="text-gray-300 text-xs mt-2">API base URL: {api.baseURL || '--'}</Text>
        <Text className="text-gray-300 text-xs mt-1">API root URL: {api.rootURL || '--'}</Text>
        <Text className="text-gray-300 text-xs mt-1">Env: {String(api.env || '--')}</Text>
        <Text className="text-gray-300 text-xs mt-1">
          Mocks enabled: {String(String(process.env.EXPO_PUBLIC_USE_MOCKS || '').toLowerCase() === 'true')}
        </Text>
        <Text className="text-gray-300 text-xs mt-1">
          Feature flags: timeline={String(FEATURE_TIMELINE)}, dashboard={String(FEATURE_NEW_DASHBOARD)}, card_tokens={String(FEATURE_CARD_TOKENS)}
        </Text>
      </View>

      <View className="bg-gray-900 border border-gray-800 rounded-2xl p-4 mt-4">
        <Text className="text-white font-semibold">Auth</Text>
        <Text className="text-gray-300 text-xs mt-2">User ID: {String(userId)}</Text>
        <Text className="text-gray-300 text-xs mt-1">Email: {String(userEmail)}</Text>
        <Text className="text-gray-300 text-xs mt-1">Token fingerprint: {tokenFingerprint(token)}</Text>
      </View>

      <View className="bg-gray-900 border border-gray-800 rounded-2xl p-4 mt-4">
        <Text className="text-white font-semibold">Cards List Endpoint</Text>
        <Text className="text-gray-300 text-xs mt-2">Endpoint: `/cards/user_card`</Text>
        {list.loading ? (
          <View className="py-3">
            <ActivityIndicator />
          </View>
        ) : null}
        {list.error ? (
          <Text className="text-red-300 text-xs mt-2">
            List error: {(list.error as any)?.message || 'Failed to load cards'}
          </Text>
        ) : null}
        <Text className="text-gray-300 text-xs mt-2">Cards count: {cards.length}</Text>

        <View className="mt-3 gap-2">
          {cards.map((card: any, idx: number) => {
            const rid = String(pickCardDetailsIdentifier(card) || '')
            const active = String(selectedRouteId) === rid
            return (
              <TouchableOpacity
                key={`${rid || 'no-id'}-${idx}`}
                className={`rounded-lg border px-3 py-2 ${active ? 'border-yellow-500 bg-yellow-500/10' : 'border-gray-700 bg-gray-950'}`}
                onPress={() => setSelectedRouteId(rid)}
              >
                <Text className="text-gray-200 text-xs">
                  #{idx + 1} routeId={rid || '--'} id={String(card?.id ?? '--')} card_id={String(card?.card_id ?? '--')}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>
      </View>

      <View className="bg-gray-900 border border-gray-800 rounded-2xl p-4 mt-4">
        <Text className="text-white font-semibold">Selected Card Identifiers</Text>
        <Text className="text-gray-300 text-xs mt-2">Selected route id: {selectedRouteId || '--'}</Text>
        <Text className="text-gray-300 text-xs mt-1">Keys: {Object.keys(selectedCard || {}).join(', ') || '--'}</Text>
        <Text className="text-gray-300 text-xs mt-2">id: {String(identifierCandidates.id ?? '--')}</Text>
        <Text className="text-gray-300 text-xs mt-1">card_id: {String(identifierCandidates.card_id ?? '--')}</Text>
        <Text className="text-gray-300 text-xs mt-1">provider_id: {String(identifierCandidates.provider_id ?? '--')}</Text>
        <Text className="text-gray-300 text-xs mt-1">bridgecard_id: {String(identifierCandidates.bridgecard_id ?? '--')}</Text>
        <Text className="text-gray-300 text-xs mt-1">bridge_card_id: {String(identifierCandidates.bridge_card_id ?? '--')}</Text>
        <Text className="text-gray-300 text-xs mt-1">last4: {String(identifierCandidates.last4 ?? '--')}</Text>
        <Text className="text-gray-300 text-xs mt-1">reference: {String(identifierCandidates.reference ?? '--')}</Text>
      </View>

      <View className="bg-gray-900 border border-gray-800 rounded-2xl p-4 mt-4 mb-6">
        <Text className="text-white font-semibold">Details Request</Text>
        <Text className="text-gray-300 text-xs mt-2">
          Request path: `/cards/{selectedRouteId || '--'}/details`
        </Text>
        <Text className="text-gray-300 text-xs mt-1">ID passed: {selectedRouteId || '--'}</Text>
        <Text className="text-gray-300 text-xs mt-1">
          HTTP status: {String((details.error as any)?.status ?? (details.error as any)?.response?.status ?? (details.data as any)?.status ?? (details.loading ? 'loading' : 'unknown'))}
        </Text>
        <Text className="text-gray-300 text-xs mt-1">
          Error message: {String((details.error as any)?.message ?? '--')}
        </Text>
        <Text className="text-gray-300 text-xs mt-2">Error body:</Text>
        <Text className="text-gray-500 text-[10px] mt-1">
          {stringifyPreview((details.error as any)?.response?.data ?? null).slice(0, 800)}
        </Text>
      </View>
    </ScreenContainer>
  )
}

export default CardsDebugScreen
