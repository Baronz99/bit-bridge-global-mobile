import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, FlatList, Text, TouchableOpacity, View } from 'react-native'
import { Link, useRouter } from 'expo-router'
import { createCircle, listCircles } from '@/api/circles'
import AppModal from '@/components/modal/Modal'
import FormInput from '@/components/FormInput'
import { useAuth } from '@/services/useAuth'
import { useActiveAccount } from '@/services/useActiveAccount'
import { FEATURE_CIRCLES } from '@/constants/featureFlags'
import moneyFormat from '@/utils/moneyFormat'
import MemberAvatars from '@/components/circles/MemberAvatars'
import { CIRCLE_TYPE_CONFIG, LAUNCH_CIRCLE_TYPES, getCircleTypeConfig } from '@/utils/circleTypeConfig'

const getArray = (value: unknown) => (Array.isArray(value) ? value : [])

const extractCircles = (payload: unknown) => {
  if (Array.isArray(payload)) return payload
  if (payload && typeof payload === 'object') {
    const container = payload as Record<string, unknown>
    const data = container.data ?? container.circles ?? container.items ?? container.results
    return getArray(data)
  }
  return []
}

const getCircleTitle = (circle: Record<string, unknown>) => {
  return (circle.name as string) || (circle.title as string) || 'Untitled Circle'
}

const getCircleDescription = (circle: Record<string, unknown>) => {
  return (circle.description as string) || (circle.summary as string) || ''
}

const getInitials = (value: string) => {
  return value
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

const bucketKeyFromCircle = (circle: Record<string, unknown>) => {
  const profile = (circle.circle_type_profile as Record<string, unknown> | undefined) || {}
  const productBucketKey = String(profile.product_bucket_key || '').trim()
  if (productBucketKey) return productBucketKey

  const normalizedArchetype = String(
    profile.normalized_archetype || circle.circle_archetype || ''
  ).trim()

  switch (normalizedArchetype) {
    case 'sports_circle':
      return 'clubs_teams'
    case 'estate_circle':
      return 'estates_communities'
    case 'savings_circle':
      return 'cooperatives'
    case 'family_circle':
      return 'families'
    default:
      return 'associations'
  }
}

const featuredRank = (circle: Record<string, unknown>) => {
  if (circle.circle_type === 'official' && circle.visibility === 'official_featured') return 0
  if (circle.circle_type === 'official') return 1
  return 2
}

const CirclesScreen = () => {
  const router = useRouter()
  const { selectPersonalAccount } = useActiveAccount()
  const { userProfileData, loadProfile, authState, authHydrated } = useAuth()
  const didKickoffProfileRef = useRef(false)
  const [screenLoading, setScreenLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<unknown>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<
    'all' | 'clubs_teams' | 'estates_communities' | 'cooperatives' | 'families' | 'associations'
  >('all')
  const [form, setForm] = useState({
    name: '',
    purpose: '',
    description: '',
    circle_archetype: LAUNCH_CIRCLE_TYPES[0],
  })
  const profileRoot = useMemo(() => userProfileData?.data ?? userProfileData ?? {}, [userProfileData])

  const kycLevel = useMemo(() => {
    return String(profileRoot?.kyc_level || profileRoot?.user_kyc?.kyc_level || 'tier_0')
      .trim()
      .toLowerCase()
  }, [profileRoot])

  const tierRank = useMemo(() => {
    if (!kycLevel || kycLevel === 'nil') return 0
    const match = kycLevel.match(/tier[_\s-]?(\d+)/)
    return match ? Number(match[1]) : 0
  }, [kycLevel])

  const phoneVerified = Boolean(
    profileRoot?.phone_verified ||
    profileRoot?.phone_verified_at ||
    profileRoot?.user_profile?.phone_verified_at
  )
  const canAccessCircles = tierRank >= 2 || (tierRank >= 1 && phoneVerified)
  const canCreateCircle = tierRank >= 2

  const loadCircles = useCallback(async () => {
    if (!canAccessCircles) {
      setScreenLoading(false)
      setError(null)
      return
    }
    setScreenLoading(true)
    setError(null)
    try {
      const res = await listCircles()
      setData(res)
    } catch (err: any) {
      const status = err?.response?.status
      if (status === 401) {
        setError('Session expired. Please log in again.')
      } else if (status === 403) {
        setError('Verify your phone and complete Tier 1 to use circles.')
      } else {
        setError('Unable to load circles right now.')
      }
    } finally {
      setScreenLoading(false)
    }
  }, [canAccessCircles])

  useEffect(() => {
    if (!FEATURE_CIRCLES) return
    if (!authHydrated) return
    if (!authState?.authenticated) return
    if (didKickoffProfileRef.current) return
    didKickoffProfileRef.current = true
    loadProfile().catch(() => {})
  }, [authHydrated, authState?.authenticated, loadProfile])

  useEffect(() => {
    if (authState?.authenticated) return
    didKickoffProfileRef.current = false
  }, [authState?.authenticated])

  useEffect(() => {
    if (!FEATURE_CIRCLES) return
    loadCircles()
  }, [loadCircles, canAccessCircles])

  const handleCreate = async () => {
    if (!form.name.trim()) {
      setNotice('Enter a circle name to continue.')
      return
    }
    setCreating(true)
    setNotice(null)
    try {
      const response = await createCircle({
        name: form.name.trim(),
        purpose: form.purpose.trim(),
        description: form.description.trim(),
        circle_archetype: form.circle_archetype,
      })
      const created = response?.data ?? response
      setData((prev: unknown) => {
        const list = extractCircles(prev)
        return [created, ...list]
      })
      setForm({ name: '', purpose: '', description: '', circle_archetype: LAUNCH_CIRCLE_TYPES[0] })
      setCreateOpen(false)
      if (created?.id) {
        router.push({
          pathname: `/circles/${created.id}/governance`,
          params: { fromCreate: '1' },
        } as any)
      }
    } catch (err: any) {
      const message =
        err?.response?.data?.errors?.join(', ') ||
        err?.response?.data?.error ||
        err?.message ||
        'Unable to create circle.'
      setNotice(message)
    } finally {
      setCreating(false)
    }
  }

  const handleBackToHome = useCallback(async () => {
    await selectPersonalAccount()
    router.replace('/(tabs)' as any)
  }, [router, selectPersonalAccount])

  const circles = useMemo(() => extractCircles(data), [data])
  const createTypeChoices = useMemo(
    () => LAUNCH_CIRCLE_TYPES.map((key) => CIRCLE_TYPE_CONFIG[key]),
    []
  )

  const filteredCircles = useMemo(() => {
    const filtered =
      activeFilter === 'all'
        ? [...circles]
        : circles.filter((item) => {
            const record = (item ?? {}) as Record<string, unknown>
            return bucketKeyFromCircle(record) === activeFilter
          })

    return filtered.sort((left, right) => {
      const leftRecord = (left ?? {}) as Record<string, unknown>
      const rightRecord = (right ?? {}) as Record<string, unknown>
      return featuredRank(leftRecord) - featuredRank(rightRecord)
    })
  }, [circles, activeFilter])

  if (!FEATURE_CIRCLES) {
    return (
      <View className="flex-1 bg-primary justify-center items-center px-6">
        <Text className="text-white text-base">Circles are not available yet.</Text>
      </View>
    )
  }

  return (
    <View className="flex-1 bg-primary">
      <View className="px-4 pt-6 pb-4">
        <TouchableOpacity
          accessibilityLabel="Back to Home"
          onPress={() => {
            void handleBackToHome()
          }}
          className="mb-4 self-start rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3"
        >
          <Text className="text-sm font-semibold text-white">Back to Home</Text>
        </TouchableOpacity>
        <View className="rounded-3xl border border-gray-800 bg-gray-900/80 p-5">
          <Text className="text-white text-xs tracking-widest uppercase">BitBridge Circles</Text>
          <Text className="text-white text-2xl font-semibold mt-2">
            Run your group finances properly.
          </Text>
          <Text className="text-gray-400 text-xs mt-2">
            Collect dues, track payments, and stay accountable. Built for clubs, estates, cooperatives, families, and associations.
          </Text>

          <View className="flex-row flex-wrap gap-2 mt-4">
            <View className="bg-gray-950 border border-gray-800 rounded-full px-3 py-1">
              <Text className="text-xs text-gray-300">Clubs & Teams</Text>
            </View>
            <View className="bg-gray-950 border border-gray-800 rounded-full px-3 py-1">
              <Text className="text-xs text-gray-300">Estates & Communities</Text>
            </View>
            <View className="bg-gray-950 border border-gray-800 rounded-full px-3 py-1">
              <Text className="text-xs text-gray-300">Cooperatives</Text>
            </View>
            <View className="bg-gray-950 border border-gray-800 rounded-full px-3 py-1">
              <Text className="text-xs text-gray-300">Families</Text>
            </View>
            <View className="bg-gray-950 border border-gray-800 rounded-full px-3 py-1">
              <Text className="text-xs text-gray-300">Associations</Text>
            </View>
          </View>

          <View className="flex-row items-center justify-between mt-4">
            <Text className="text-gray-400 text-xs">
              {circles.length} active circle{circles.length === 1 ? '' : 's'}
            </Text>
            <TouchableOpacity
              onPress={() => setCreateOpen(true)}
              className="bg-app-primary px-4 py-2 rounded-full"
              disabled={!canCreateCircle}
            >
              <Text className="text-black text-xs font-semibold">Create circle</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {!canAccessCircles ? (
        <View className="mx-4 mt-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4">
          <Text className="text-white font-semibold">Verify your phone to join circles</Text>
          <Text className="text-gray-300 text-xs mt-1">
            Circles allow Tier 1 users with a verified phone. Tier 2 is still required to create a new circle.
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/kyc')}
            className="mt-3 bg-app-primary rounded-full py-2 items-center"
          >
            <Text className="text-black text-xs font-semibold">Go to KYC</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {canAccessCircles &&
        (screenLoading ? (
          <View className="flex-1 justify-center items-center">
            <ActivityIndicator size="small" color="#ffcc00" />
            <Text className="text-white mt-3">Loading circles...</Text>
          </View>
        ) : error ? (
          <View className="flex-1 justify-center items-center px-6">
            <Text className="text-white text-center mb-4">{error}</Text>
            <TouchableOpacity
              onPress={loadCircles}
              className="bg-orange-700 px-4 py-2 rounded-lg"
            >
              <Text className="text-white">Retry</Text>
            </TouchableOpacity>
          </View>
        ) : circles.length === 0 ? (
          <View className="flex-1 justify-center items-center px-6">
            <Text className="text-white text-center mb-2">No circles yet.</Text>
            <Text className="text-gray-400 text-center text-xs mb-4">
              Create a circle to start running collections, tracking payments, and managing your group treasury properly.
            </Text>
            <TouchableOpacity
              onPress={() => setCreateOpen(true)}
              className="bg-app-primary px-4 py-2 rounded-lg"
              disabled={!canCreateCircle}
            >
              <Text className="text-black text-xs font-semibold">Create circle</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={filteredCircles}
            keyExtractor={(item, index) => {
              const record = item as Record<string, unknown>
              const id = record.id ?? record.circle_id ?? record.uuid ?? record.slug
              return id ? String(id) : `circle-${index}`
            }}
            contentContainerStyle={{ paddingBottom: 40 }}
            ListHeaderComponent={
              <View className="px-4 pb-2">
                <View className="flex-row flex-wrap gap-2">
                  {([
                    { id: 'all', label: 'All' },
                    { id: 'clubs_teams', label: 'Clubs & Teams' },
                    { id: 'estates_communities', label: 'Estates & Communities' },
                    { id: 'cooperatives', label: 'Cooperatives' },
                    { id: 'families', label: 'Families' },
                    { id: 'associations', label: 'Associations' },
                  ] as const).map((chip) => {
                    const active = activeFilter === chip.id
                    return (
                      <TouchableOpacity
                        key={chip.id}
                        onPress={() => setActiveFilter(chip.id)}
                        className={`px-3 py-2 rounded-full border ${
                          active ? 'bg-app-primary border-app-primary' : 'bg-gray-950 border-gray-800'
                        }`}
                      >
                        <Text className={`text-xs ${active ? 'text-black' : 'text-white'}`}>
                          {chip.label}
                        </Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>
              </View>
            }
            renderItem={({ item }) => {
              const record = (item ?? {}) as Record<string, unknown>
              const id = record.id ?? record.circle_id ?? record.uuid ?? record.slug
              const title = getCircleTitle(record)
              const description = getCircleDescription(record)
              const purpose = (record.purpose as string) || ''
              const balanceCents = Number(
                record.treasury_balance_cents ?? record.balance_cents ?? record.balance ?? 0
              )
              const balanceVisible = record.balance_visible !== false
              const typeProfile =
                (record.circle_type_profile as Record<string, unknown> | undefined) || {}
              const productBucketLabel = String(typeProfile.product_bucket_label || '').trim()
              const profileSubtitle = String(typeProfile.subtitle || '').trim()
              const typeConfig = getCircleTypeConfig(typeProfile.normalized_archetype || record.circle_archetype)
              const owner = record.owner as Record<string, unknown> | undefined
              const ownerEmail = (owner?.email as string) || ''
              const initials = String(title || 'BB')
                .split(' ')
                .map((part) => part[0])
                .join('')
                .slice(0, 2)
                .toUpperCase()
              const members = getArray(record.members)
              const isOfficialCircle = record.circle_type === 'official'
              const isFeaturedOfficial =
                isOfficialCircle && record.visibility === 'official_featured'
              const badgeLabel =
                typeof record.badge_label === 'string' && record.badge_label.trim().length > 0
                  ? record.badge_label.trim()
                  : 'Official'
              const memberInitials = members
                .map((member) => {
                  const payload = (member ?? {}) as Record<string, unknown>
                  const user = payload.user as Record<string, unknown> | undefined
                  const displayName =
                    (user?.display_name as string) ||
                    (user?.email as string) ||
                    (user?.first_name as string) ||
                    'Member'
                  return getInitials(displayName)
                })
                .filter(Boolean)

              const content = (
                <TouchableOpacity
                  className="bg-gray-900 mx-4 my-2 p-4 rounded-2xl border border-gray-800"
                  disabled={!id}
                >
                  <View className="flex-row items-center gap-3">
                    <View className="h-10 w-10 rounded-full bg-gray-800 items-center justify-center border border-gray-700">
                      <Text className="text-white text-xs font-semibold">{initials}</Text>
                    </View>
                    <View className="flex-1">
                      <View className="flex-row items-center justify-between gap-3">
                        <Text className="text-white text-base font-semibold flex-1" numberOfLines={2}>
                          {title}
                        </Text>
                        {balanceVisible ? (
                          <Text className="text-gray-200 text-xs">
                            {moneyFormat(balanceCents / 100)}
                          </Text>
                        ) : (
                          <View className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-1">
                            <Text className="text-[10px] text-amber-100 uppercase">
                              Managed campaign
                            </Text>
                          </View>
                        )}
                      </View>
                      <View className="flex-row flex-wrap items-center gap-2 mt-1">
                        {isFeaturedOfficial ? (
                          <View className="bg-amber-500/10 border border-amber-400/40 rounded-full px-2 py-0.5">
                            <Text className="text-[10px] text-amber-200 uppercase">Featured</Text>
                          </View>
                        ) : null}
                        {isOfficialCircle ? (
                          <View className="bg-sky-500/10 border border-sky-400/40 rounded-full px-2 py-0.5">
                            <Text className="text-[10px] text-sky-200 uppercase">
                              {badgeLabel}
                            </Text>
                          </View>
                        ) : null}
                        <View className="bg-gray-950 border border-gray-800 rounded-full px-2 py-0.5">
                          <Text className="text-[10px] text-gray-300 uppercase">{productBucketLabel || typeConfig.label}</Text>
                        </View>
                        {purpose ? (
                          <View className="bg-gray-950 border border-gray-800 rounded-full px-2 py-0.5">
                            <Text className="text-[10px] text-gray-300 uppercase">{purpose}</Text>
                          </View>
                        ) : null}
                        <View className="bg-gray-950 border border-gray-800 rounded-full px-2 py-0.5">
                          <Text className="text-[10px] text-gray-300 uppercase">{typeConfig.shortLabel}</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                  {description ? (
                    <Text className="text-gray-300 text-xs mt-2">{description}</Text>
                  ) : profileSubtitle ? (
                    <Text className="text-gray-300 text-xs mt-2">{profileSubtitle}</Text>
                  ) : null}
                  {!balanceVisible ? (
                    <Text className="text-gray-400 text-[11px] mt-2">
                      Campaign balance is visible to circle managers only.
                    </Text>
                  ) : null}
                  <View className="flex-row items-center justify-between mt-3">
                    <MemberAvatars initials={memberInitials} size={26} />
                    {ownerEmail ? (
                      <Text className="text-gray-500 text-[10px]">Creator: {ownerEmail}</Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              )

              if (!id) return content

              return (
                <Link href={`/circles/${id}` as any} asChild>
                  {content}
                </Link>
              )
            }}
          />
        ))}

      <AppModal open={createOpen} onclose={() => setCreateOpen(false)}>
        <View className="bg-gray-900 p-6 rounded-2xl w-full max-w-md">
          <Text className="text-white text-xl font-semibold text-center mb-2">
            Create circle
          </Text>
          <Text className="text-gray-400 text-center text-xs mb-5">
            Select the product bucket that best matches how your group collects and manages money.
          </Text>

          {notice ? <Text className="text-yellow-400 text-xs mb-3">{notice}</Text> : null}

          <Text className="text-white text-xs uppercase tracking-[0.16em] mb-3">Circle Type</Text>
          <View className="gap-2 mb-4">
            {createTypeChoices.map((typeConfig) => {
              const active = form.circle_archetype === typeConfig.key
              return (
                <TouchableOpacity
                  key={typeConfig.key}
                  onPress={() => setForm({ ...form, circle_archetype: typeConfig.key })}
                  className={`rounded-2xl border px-4 py-4 ${active ? 'border-app-primary bg-app-primary/10' : 'border-gray-800 bg-gray-950'}`}
                >
                  <View className="flex-row items-start justify-between gap-3">
                    <View className="flex-1">
                      <Text className="text-white text-sm font-semibold">{typeConfig.label}</Text>
                      <Text className="text-gray-400 text-xs mt-1">{typeConfig.subtitle}</Text>
                      <Text className="text-gray-500 text-[11px] mt-2">{typeConfig.createDescription}</Text>
                    </View>
                    <View className={`h-5 w-5 rounded-full border items-center justify-center ${active ? 'border-app-primary bg-app-primary' : 'border-gray-700'}`}>
                      {active ? <Text className="text-black text-[9px] font-bold">OK</Text> : null}
                    </View>
                  </View>
                </TouchableOpacity>
              )
            })}
          </View>

          <FormInput
            label="Circle name"
            value={form.name}
            onChangeText={(value: string) => setForm({ ...form, name: value })}
          />
          <FormInput
            label="Purpose"
            value={form.purpose}
            onChangeText={(value: string) => setForm({ ...form, purpose: value })}
          />
          <FormInput
            label="Description (optional)"
            value={form.description}
            onChangeText={(value: string) => setForm({ ...form, description: value })}
          />
          <Text className="text-gray-500 text-[11px] mt-3">
            Dues setup is optional during creation. Create the circle first, then add members, assign a treasurer, and start collections properly.
          </Text>

          <TouchableOpacity
            onPress={handleCreate}
            className={`mt-4 py-3 rounded-xl items-center ${
              creating ? 'bg-gray-700' : 'bg-app-primary'
            }`}
            disabled={creating}
          >
            <Text className="text-black text-sm font-semibold">
              {creating ? 'Creating...' : 'Create circle'}
            </Text>
          </TouchableOpacity>
        </View>
      </AppModal>
    </View>
  )
}

export default CirclesScreen
