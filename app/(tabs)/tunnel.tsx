import React, { useMemo } from 'react'
import type { ImageSourcePropType, ViewStyle, TextStyle, ImageStyle } from 'react-native'
import { ActivityIndicator, Image, RefreshControl, Text, TouchableOpacity, View } from 'react-native'
import { type Href, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'

import ScreenContainer from '@/components/ScreenContainer'
import useFetch from '@/services/useFetch'
import { getCards } from '@/api/cards'
import { getWallet } from '@/api/wallet'
import { icons } from '@/constants/icons'
import moneyFormat from '@/utils/moneyFormat'
import { useActiveAccount } from '@/services/useActiveAccount'

type HubItem = {
  id: string
  label: string
  link: Href
  image: ImageSourcePropType
}

const styles = {
  hero: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingVertical: 24,
    borderWidth: 1,
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  } as ViewStyle,
  glowLarge: {
    position: 'absolute',
    right: -28,
    top: -36,
    width: 132,
    height: 132,
    borderRadius: 999,
  } as ViewStyle,
  glowSmall: {
    position: 'absolute',
    right: 38,
    top: 38,
    width: 74,
    height: 74,
    borderRadius: 999,
  } as ViewStyle,
  heroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    columnGap: 12,
  } as ViewStyle,
  heroTitle: {
    fontSize: 28,
    fontWeight: '600',
  } as TextStyle,
  heroBody: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
  } as TextStyle,
  heroStatus: {
    marginTop: 18,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  } as TextStyle,
  heroValue: {
    marginTop: 6,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '600',
  } as TextStyle,
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  } as ViewStyle,
  sectionStack: {
    marginTop: 28,
    rowGap: 20,
  } as ViewStyle,
  primarySection: {
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderWidth: 1,
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  } as ViewStyle,
  secondarySection: {
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderWidth: 1,
  } as ViewStyle,
  compactSection: {
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
  } as ViewStyle,
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  } as ViewStyle,
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  } as TextStyle,
  sectionBody: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
  } as TextStyle,
  actionRow: {
    flexDirection: 'row',
    columnGap: 12,
    marginTop: 16,
  } as ViewStyle,
  actionCard: {
    flex: 1,
    borderRadius: 22,
    paddingHorizontal: 12,
    paddingVertical: 16,
    borderWidth: 1,
  } as ViewStyle,
  convertIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  } as ViewStyle,
  convertIcon: {
    width: 21,
    height: 21,
  } as ImageStyle,
  actionButton: {
    flex: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
  } as ViewStyle,
  buttonTitle: {
    fontSize: 14,
    fontWeight: '600',
  } as TextStyle,
  buttonBody: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
  } as TextStyle,
  singleCard: {
    marginTop: 14,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
  } as ViewStyle,
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  } as ViewStyle,
} as const

export default function TunnelHub() {
  const router = useRouter()
  const { activeAccount } = useActiveAccount()
  const isCircleAccount = activeAccount?.type === 'circle'
  const isBusinessAccount = activeAccount?.type === 'business'
  const { data: walletRaw, loading: walletLoading, refetch: refetchWallet } = useFetch(() => getWallet(activeAccount), {
    autoFetch: true,
    queryKey: ['wallet', activeAccount],
  })
  const { data: cardsRaw, loading: cardsLoading, refetch: refetchCards } = useFetch(() => getCards(activeAccount), {
    autoFetch: true,
    queryKey: ['cards', activeAccount],
  })

  const palette = {
    primary: '#FF8A1F',
    accent: '#FFB347',
    base: '#1A0F05',
    baseRaised: '#231206',
    baseSoft: '#140C07',
    heading: '#FFF7ED',
    body: 'rgba(255,244,230,0.85)',
    muted: 'rgba(255,214,170,0.75)',
  }

  const topCard = useMemo(
    () => ({
      id: 'wallet',
      label: 'USD wallet access',
      subtitle: 'Enter Tunnel, check your USD wallet, and keep activation close when needed.',
      primaryLink: '/(tabs)/wallet' as Href,
      secondaryLink: '/tunnel-activation' as Href,
    }),
    []
  )

  const convertActions = useMemo(
    () =>
      [
        { id: 'ngn-usd', label: 'NGN to USD', link: { pathname: '/fx', params: { direction: 'ngn-to-usd' } }, image: icons.transfer },
        { id: 'usd-ngn', label: 'USD to NGN', link: { pathname: '/fx', params: { direction: 'usd-to-ngn' } }, image: icons.withdrawal },
      ] as HubItem[],
    []
  )

  const tunnelWallet = useMemo(() => {
    const payload = walletRaw?.data ?? walletRaw
    return payload?.tunnel ?? payload?.data?.tunnel ?? null
  }, [walletRaw])

  const cards = useMemo(() => {
    const payload = cardsRaw?.data ?? cardsRaw
    if (Array.isArray(payload)) return payload
    if (Array.isArray(payload?.cards)) return payload.cards
    if (Array.isArray(payload?.data)) return payload.data
    if (Array.isArray(payload?.data?.cards)) return payload.data.cards
    if (Array.isArray(payload?.results)) return payload.results
    if (payload?.card) return [payload.card]
    if (payload?.card_id) return [payload]
    return []
  }, [cardsRaw])

  const tunnelBalanceValue = Number(tunnelWallet?.balance ?? tunnelWallet?.amount ?? 0)
  const tunnelActivated = Boolean(tunnelWallet)
  const hasUsableTunnelWallet = tunnelActivated && Number.isFinite(tunnelBalanceValue)
  const tunnelHasBalance = hasUsableTunnelWallet && tunnelBalanceValue > 0
  const tunnelState = !tunnelActivated ? 'not_activated' : tunnelHasBalance ? 'active_usable' : 'active_empty'
  const cardsCount = cards.length
  const activeCardsCount = useMemo(
    () =>
      cards.filter((card: any) => {
        const status = String(card?.status || card?.card_status || '').trim().toLowerCase()
        return !status || status === 'active'
      }).length,
    [cards]
  )

  const walletStatusTitle =
    tunnelState === 'not_activated'
      ? 'USD wallet not activated'
      : tunnelHasBalance
        ? 'USD wallet active'
        : 'USD wallet active'

  const cardsStatusTitle =
    cardsLoading
      ? 'Checking cards'
      : activeCardsCount === 0
        ? 'No cards issued yet'
        : `${activeCardsCount} active card${activeCardsCount === 1 ? '' : 's'}`

  const cardsStatusBody =
    cardsStateCopy({
      tunnelActivated,
      cardsLoading,
      activeCardsCount,
      cardsCount,
    })
  const heroStatusTitle =
    tunnelState === 'not_activated'
      ? 'USD wallet not activated'
      : tunnelHasBalance
        ? 'USD wallet active with balance'
        : 'USD wallet active'
  const formattedTunnelBalance = tunnelHasBalance ? moneyFormat(tunnelBalanceValue, 'USD') : null
  const refreshing = walletLoading || cardsLoading

  const handleRefresh = () => {
    refetchWallet?.()
    refetchCards?.()
  }

  const convertCard = (item: HubItem) => (
    <TouchableOpacity
      key={item.id}
      activeOpacity={0.9}
      onPress={() => router.push(item.link)}
      style={{
        ...styles.actionCard,
        borderColor: 'rgba(255, 179, 71, 0.38)',
        backgroundColor: 'rgba(255, 138, 31, 0.18)',
      }}
    >
      <View
        style={{
          ...styles.convertIconWrap,
          borderColor: 'rgba(255, 179, 71, 0.34)',
          backgroundColor: 'rgba(255, 179, 71, 0.18)',
        }}
      >
        <Image source={item.image} tintColor="#ffcc00" resizeMode="contain" style={styles.convertIcon} />
      </View>
      <Text style={[styles.buttonTitle, { color: palette.heading, marginTop: 16 }]}>
        {item.id === 'ngn-usd' ? 'Convert NGN to USD' : 'Convert USD to NGN'}
      </Text>
      <Text style={[styles.buttonBody, { color: palette.muted }]}>
        {item.id === 'ngn-usd' ? 'Move NGN into Tunnel' : 'Move USD back to Bridge'}
      </Text>
    </TouchableOpacity>
  )

  return (
    <ScreenContainer
      scrollProps={{
        refreshControl: (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={palette.accent}
          />
        ),
      }}
    >
      {isCircleAccount ? (
        <View
          style={{
            ...styles.secondarySection,
            marginTop: 16,
            borderWidth: 1,
            borderColor: 'rgba(16, 185, 129, 0.18)',
            backgroundColor: '#08130F',
          }}
        >
          <Text style={[styles.sectionTitle, { color: '#ECFDF5' }]}>Tunnel is not available in circle context</Text>
          <Text style={[styles.sectionBody, { color: 'rgba(209, 250, 229, 0.82)' }]}>
            Tunnel, USD conversion, and cards remain personal or business wallet features. Open the selected circle for contributions and activity instead.
          </Text>

          <View style={styles.actionRow}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => router.push(`/circles/${activeAccount.circleId}` as any)}
              style={{
                ...styles.actionButton,
                borderColor: 'rgba(16, 185, 129, 0.25)',
                backgroundColor: 'rgba(16, 185, 129, 0.12)',
              }}
            >
              <Text style={[styles.buttonTitle, { color: '#ECFDF5' }]}>Open circle</Text>
              <Text style={[styles.buttonBody, { color: 'rgba(209, 250, 229, 0.82)' }]}>
                Return to the circle account.
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => router.push(`/circles/${activeAccount.circleId}/pay` as any)}
              style={{
                ...styles.actionButton,
                borderColor: 'rgba(16, 185, 129, 0.25)',
                backgroundColor: 'rgba(16, 185, 129, 0.08)',
              }}
            >
              <Text style={[styles.buttonTitle, { color: '#ECFDF5' }]}>Contribute</Text>
              <Text style={[styles.buttonBody, { color: 'rgba(209, 250, 229, 0.82)' }]}>
                Add funds using the existing circle flow.
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {isBusinessAccount ? (
        <View
          style={{
            ...styles.secondarySection,
            marginTop: 16,
            borderWidth: 1,
            borderColor: 'rgba(59, 130, 246, 0.20)',
            backgroundColor: '#08101E',
          }}
        >
          <Text style={[styles.sectionTitle, { color: '#EFF6FF' }]}>Tunnel is currently available in personal context</Text>
          <Text style={[styles.sectionBody, { color: 'rgba(219, 234, 254, 0.82)' }]}>
            Your business account keeps Bridge, payroll, approvals, and payouts separate. Switch to your personal account to use Tunnel, USD conversion, and cards.
          </Text>
          <View style={styles.actionRow}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => router.push('/business')}
              style={{
                ...styles.actionButton,
                borderColor: 'rgba(59, 130, 246, 0.25)',
                backgroundColor: 'rgba(59, 130, 246, 0.12)',
              }}
            >
              <Text style={[styles.buttonTitle, { color: '#EFF6FF' }]}>Open business home</Text>
              <Text style={[styles.buttonBody, { color: 'rgba(219, 234, 254, 0.82)' }]}>
                Return to your business account.
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => router.push('/(tabs)/wallet')}
              style={{
                ...styles.actionButton,
                borderColor: 'rgba(59, 130, 246, 0.25)',
                backgroundColor: 'rgba(59, 130, 246, 0.08)',
              }}
            >
              <Text style={[styles.buttonTitle, { color: '#EFF6FF' }]}>Bridge wallet</Text>
              <Text style={[styles.buttonBody, { color: 'rgba(219, 234, 254, 0.82)' }]}>
                Keep using your business Bridge balance here.
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
      {!isCircleAccount && !isBusinessAccount ? (      <>
      <View
        style={{
          ...styles.hero,
          borderColor: 'rgba(255, 138, 31, 0.22)',
          backgroundColor: palette.base,
        }}
      >
        <View style={[styles.glowLarge, { backgroundColor: 'rgba(255, 138, 31, 0.16)' }]} />
        <View style={[styles.glowSmall, { backgroundColor: 'rgba(255, 179, 71, 0.10)' }]} />
        <View style={styles.heroRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.heroTitle, { color: palette.heading }]}>
              Tunnel
            </Text>
            <Text style={[styles.heroBody, { color: palette.body }]}>
              Global USD wallet and conversion
            </Text>
          </View>
          <View
            style={{
              ...styles.iconBadge,
              borderColor: 'rgba(255, 138, 31, 0.18)',
              backgroundColor: 'rgba(255, 138, 31, 0.10)',
            }}
          >
            <Ionicons name="globe-outline" size={20} color={palette.accent} />
          </View>
        </View>

        <Text style={[styles.heroBody, { color: palette.muted, marginTop: 20 }]}>
          {tunnelState === 'not_activated'
            ? 'Activate Tunnel to access your USD wallet and conversion rail.'
            : tunnelState === 'active_empty'
              ? 'Your USD wallet is active and ready for funding.'
              : 'Your USD wallet is active and available for conversion and spend.'}
        </Text>
        <Text style={[styles.heroStatus, { color: palette.accent }]}>
          {heroStatusTitle}
        </Text>
        {formattedTunnelBalance ? (
          <Text style={[styles.heroValue, { color: palette.heading }]}>
            {formattedTunnelBalance}
          </Text>
        ) : null}

        {tunnelState === 'not_activated' ? (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => router.push(topCard.secondaryLink)}
            style={{
              marginTop: 18,
              backgroundColor: 'rgba(255, 138, 31, 0.18)',
              borderWidth: 1,
              borderColor: 'rgba(255, 179, 71, 0.34)',
              borderRadius: 16,
              paddingHorizontal: 16,
              paddingVertical: 14,
            }}
          >
            <Text style={[styles.buttonTitle, { color: palette.heading }]}>
              Activate Tunnel
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.sectionStack}>
        {tunnelActivated ? (
          <View
            style={{
              ...styles.primarySection,
              borderWidth: 1,
              borderColor: 'rgba(255, 138, 31, 0.32)',
              backgroundColor: '#291606',
            }}
          >
            <View style={styles.sectionHeaderRow}>
              <View>
                <Text style={[styles.sectionTitle, { color: palette.heading }]}>
                  Convert
                </Text>
                <Text style={[styles.sectionBody, { color: 'rgba(255,214,170,0.82)' }]}>
                  Move between rails without leaving Tunnel.
                </Text>
              </View>
              <View
                style={{
                  ...styles.iconBadge,
                  borderColor: 'rgba(255, 179, 71, 0.24)',
                  backgroundColor: 'rgba(255, 179, 71, 0.10)',
                }}
              >
                <Ionicons name="swap-horizontal" size={19} color={palette.accent} />
              </View>
            </View>

            <View style={styles.actionRow}>{convertActions.map(convertCard)}</View>
          </View>
        ) : (
          <View
            style={{
              ...styles.compactSection,
              borderWidth: 1,
              borderColor: 'rgba(255, 138, 31, 0.12)',
              backgroundColor: palette.baseSoft,
            }}
          >
            <Text style={[styles.buttonTitle, { color: palette.heading }]}>
              Convert
            </Text>
            <Text style={[styles.buttonBody, { color: palette.muted }]}>
              Activate Tunnel to unlock USD conversion.
            </Text>
          </View>
        )}

        <View
          style={{
            ...styles.secondarySection,
            borderWidth: 1,
            borderColor: 'rgba(255, 138, 31, 0.12)',
            backgroundColor: palette.base,
          }}
        >
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={[styles.sectionTitle, { color: palette.heading }]}>
                {tunnelActivated ? 'USD wallet access' : 'Tunnel access'}
              </Text>
              <Text style={[styles.sectionBody, { color: palette.muted }]}>
                {tunnelActivated
                  ? tunnelHasBalance
                    ? 'Access your USD wallet and transactions.'
                    : 'Access your USD wallet and transactions.'
                  : 'Activate Tunnel to open your global USD rail.'}
              </Text>
            </View>
            <View
              style={{
                ...styles.iconBadge,
                borderColor: 'rgba(255, 138, 31, 0.12)',
                backgroundColor: 'rgba(255, 138, 31, 0.06)',
              }}
            >
              <Ionicons name="wallet-outline" size={20} color={palette.accent} />
            </View>
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => router.push(tunnelActivated ? topCard.primaryLink : topCard.secondaryLink)}
              style={{
                ...styles.actionButton,
                borderWidth: 1,
                borderColor: 'rgba(255, 138, 31, 0.12)',
                backgroundColor: 'rgba(255, 138, 31, 0.08)',
              }}
            >
              <Text style={[styles.buttonTitle, { color: palette.heading }]}>
                {tunnelActivated ? 'Open wallet' : 'Activate Tunnel'}
              </Text>
              <Text style={[styles.buttonBody, { color: 'rgba(255,214,170,0.78)' }]}>
                {walletStatusTitle}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => router.push(tunnelActivated ? topCard.primaryLink : topCard.secondaryLink)}
              style={{
                ...styles.actionButton,
                borderWidth: 1,
                borderColor: 'rgba(255, 138, 31, 0.12)',
                backgroundColor: 'rgba(255, 138, 31, 0.06)',
              }}
            >
              <Text style={[styles.buttonTitle, { color: palette.heading }]}>
                {tunnelActivated ? 'View transactions' : 'Activation'}
              </Text>
              <Text style={[styles.buttonBody, { color: 'rgba(255,214,170,0.78)' }]}>
                {tunnelActivated
                  ? 'Access your USD wallet and transactions'
                  : 'Activate Tunnel to access your USD wallet'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {tunnelActivated ? (
          <View
            style={{
              ...styles.compactSection,
              borderWidth: 1,
              borderColor: 'rgba(255, 138, 31, 0.10)',
              backgroundColor: '#140D07',
            }}
          >
            <Text style={[styles.sectionTitle, { color: palette.heading }]}>
              Cards
            </Text>
            <Text style={[styles.sectionBody, { color: palette.muted }]}>
              Manage your Tunnel cards without repeating wallet state.
            </Text>

            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => router.push('/cards')}
              style={{
                ...styles.singleCard,
                borderWidth: 1,
                borderColor: 'rgba(255, 138, 31, 0.12)',
                backgroundColor: 'rgba(255, 138, 31, 0.07)',
              }}
            >
              <View style={styles.rowBetween}>
                <View>
                  <Text style={[styles.buttonTitle, { color: palette.heading }]}>
                    {cardsCount > 0 ? 'Manage cards' : 'Create or manage cards'}
                  </Text>
                  <Text style={[styles.buttonBody, { color: 'rgba(255,214,170,0.78)' }]}>
                    {cardsStatusTitle}
                  </Text>
                </View>
                <View
                  style={{
                    ...styles.iconBadge,
                    width: 40,
                    height: 40,
                    borderColor: 'rgba(255, 138, 31, 0.12)',
                    backgroundColor: 'rgba(255, 138, 31, 0.06)',
                  }}
                >
                  <Ionicons name="card-outline" size={18} color={palette.accent} />
                </View>
              </View>
            </TouchableOpacity>
          </View>
        ) : null}

        {walletLoading && cardsLoading ? (
          <View style={{ alignItems: 'center', paddingVertical: 12 }}>
            <ActivityIndicator color={palette.accent} />
          </View>
        ) : null}
      </View>
      </>
      ) : null}
    </ScreenContainer>
  )
}

function cardsStateCopy({
  tunnelActivated,
  cardsLoading,
  activeCardsCount,
  cardsCount,
}: {
  tunnelActivated: boolean
  cardsLoading: boolean
  activeCardsCount: number
  cardsCount: number
}) {
  if (!tunnelActivated) return 'Activate Tunnel before issuing and managing cards.'
  if (cardsLoading) return 'Checking current card state.'
  if (cardsCount === 0) return 'No cards issued yet'
  if (activeCardsCount === 0) return 'No active cards'
  return `${activeCardsCount} active card${activeCardsCount === 1 ? '' : 's'}`
}
