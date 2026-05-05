import React, { useCallback, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Modal,
  RefreshControl,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { Stack, type Href, useLocalSearchParams, useRouter } from 'expo-router'
import { useFocusEffect } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import NotificationAlert from '@/components/notification'
import {
  getCircle,
  removeCircleMembership,
  updateCircleMembership,
} from '@/api/circles'
import { buildApiErrorMessage } from '@/utils/apiErrorMessage'
import { formatCircleRoleLabel } from '@/utils/circleRoleLabel'

type MemberRecord = Record<string, unknown>
type NoticeState = { message: string | null; error: boolean; data: unknown | null }
type SortKey = 'circle_name' | 'role' | 'recent'
type PendingAction =
  | { type: 'role'; membershipId: string; role: string; memberName: string }
  | { type: 'remove'; membershipId: string; memberName: string }
  | null
type RoleSelectionState = {
  membershipId: string
  memberName: string
  roles: string[]
} | null

const ROW_HEIGHT = 132

const ROLE_STYLES: Record<string, { badge: string; text: string; dot: string }> = {
  owner: {
    badge: 'border-amber-400/30 bg-amber-400/12',
    text: 'text-amber-100',
    dot: 'bg-amber-300',
  },
  admin: {
    badge: 'border-fuchsia-400/30 bg-fuchsia-400/12',
    text: 'text-fuchsia-100',
    dot: 'bg-fuchsia-300',
  },
  treasurer: {
    badge: 'border-emerald-400/30 bg-emerald-400/12',
    text: 'text-emerald-100',
    dot: 'bg-emerald-300',
  },
  member: {
    badge: 'border-slate-400/20 bg-slate-400/10',
    text: 'text-slate-100',
    dot: 'bg-slate-300',
  },
}

const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: 'recent', label: 'Recently joined' },
  { key: 'circle_name', label: 'Circle Name' },
  { key: 'role', label: 'Role' },
]

const getArray = (value: unknown) => (Array.isArray(value) ? value : [])
const asRecord = (value: unknown) => ((value && typeof value === 'object' ? value : {}) as MemberRecord)

const formatRole = (value: string) => formatCircleRoleLabel(value)

const getInitials = (value: string) =>
  String(value || 'M')
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'M'

const formatJoined = (value: unknown) => {
  const raw = String(value || '')
  if (!raw) return ''
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return ''
  return `Joined ${date.toLocaleDateString('en-NG', { month: 'short', day: 'numeric', year: 'numeric' })}`
}

const getRoleOrder = (value: string) => {
  if (value === 'owner') return 0
  if (value === 'admin') return 1
  if (value === 'treasurer') return 2
  return 3
}

const SearchBar = ({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) => (
  <View className="mt-4 rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3 flex-row items-center gap-3">
    <Ionicons name="search-outline" size={18} color="#94A3B8" />
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder="Search Circle Names or identities"
      placeholderTextColor="#64748B"
      className="flex-1 text-white text-sm"
      autoCapitalize="none"
      autoCorrect={false}
      returnKeyType="search"
    />
    {value ? (
      <TouchableOpacity onPress={() => onChange('')}>
        <Ionicons name="close-circle" size={18} color="#94A3B8" />
      </TouchableOpacity>
    ) : null}
  </View>
)

const SortMenu = ({
  active,
  onChange,
}: {
  active: SortKey
  onChange: (value: SortKey) => void
}) => (
  <View className="mt-3 flex-row flex-wrap gap-2">
    {SORT_OPTIONS.map((option) => {
      const selected = option.key === active
      return (
        <TouchableOpacity
          key={option.key}
          onPress={() => onChange(option.key)}
          className={`rounded-full px-3.5 py-2 border ${selected ? 'border-sky-400/30 bg-sky-400/12' : 'border-white/10 bg-white/[0.03]'}`}
        >
          <Text className={`text-xs font-medium ${selected ? 'text-sky-100' : 'text-slate-300'}`}>
            {option.label}
          </Text>
        </TouchableOpacity>
      )
    })}
  </View>
)

const ConfirmationModal = ({
  pendingAction,
  busy,
  onCancel,
  onConfirm,
}: {
  pendingAction: PendingAction
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}) => {
  if (!pendingAction) return null

  const isRoleChange = pendingAction.type === 'role'
  const title = isRoleChange ? 'Confirm role change' : 'Confirm member removal'
  const body = isRoleChange
    ? `${pendingAction.memberName} will become ${formatRole(pendingAction.role)} in this circle.`
    : `${pendingAction.memberName} will be removed from this circle.`
  const confirmLabel = isRoleChange ? 'Change role' : 'Remove member'

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <View className="flex-1 bg-black/70 justify-center px-5">
        <View className="rounded-[28px] border border-white/10 bg-[#0f172a] px-5 py-5">
          <View className="h-11 w-11 rounded-full bg-white/[0.05] border border-white/10 items-center justify-center">
            <Ionicons
              name={isRoleChange ? 'swap-horizontal-outline' : 'person-remove-outline'}
              size={20}
              color={isRoleChange ? '#7DD3FC' : '#FCA5A5'}
            />
          </View>
          <Text className="text-white text-lg font-semibold mt-4">{title}</Text>
          <Text className="text-slate-400 text-sm mt-2 leading-6">{body}</Text>
          <View className="flex-row gap-3 mt-6">
            <TouchableOpacity
              disabled={busy}
              onPress={onCancel}
              className="flex-1 rounded-2xl border border-white/10 bg-white/[0.03] py-3 items-center"
            >
              <Text className="text-white text-sm font-medium">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              disabled={busy}
              onPress={onConfirm}
              className={`flex-1 rounded-2xl py-3 items-center ${isRoleChange ? 'bg-app-primary' : 'bg-rose-500/90'}`}
            >
              <Text className={`text-sm font-semibold ${isRoleChange ? 'text-black' : 'text-white'}`}>
                {busy ? 'Working...' : confirmLabel}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const RolePickerModal = ({
  selection,
  onClose,
  onSelect,
}: {
  selection: RoleSelectionState
  onClose: () => void
  onSelect: (role: string) => void
}) => {
  if (!selection) return null

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-black/70 justify-center px-5">
        <View className="rounded-[28px] border border-white/10 bg-[#0f172a] px-5 py-5">
          <Text className="text-white text-lg font-semibold">Change role</Text>
          <Text className="text-slate-400 text-sm mt-2 leading-6">
            Choose a new role for {selection.memberName}.
          </Text>
          <View className="mt-5 gap-2">
            {selection.roles.map((role) => {
              const roleStyle = ROLE_STYLES[role] || ROLE_STYLES.member
              return (
                <TouchableOpacity
                  key={role}
                  onPress={() => onSelect(role)}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 flex-row items-center justify-between"
                >
                  <View className="flex-row items-center gap-2">
                    <View className={`h-2 w-2 rounded-full ${roleStyle.dot}`} />
                    <Text className="text-white text-sm font-medium">{formatRole(role)}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
                </TouchableOpacity>
              )
            })}
          </View>
          <TouchableOpacity
            onPress={onClose}
            className="rounded-2xl border border-white/10 bg-white/[0.03] py-3 items-center mt-5"
          >
            <Text className="text-white text-sm font-medium">Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

const MemberRow = ({
  member,
  busy,
  onRequestRoleChange,
  onRequestRemove,
}: {
  member: MemberRecord
  busy: boolean
  onRequestRoleChange: (member: MemberRecord) => void
  onRequestRemove: (member: MemberRecord) => void
}) => {
  const user = asRecord(member.user)
  const primary = String(member.display_name || user.display_name || 'Member')
  const secondary = String(user.admin_identity_name || member.fallback_name || user.fallback_name || '').trim()
  const joinedLabel = formatJoined(member.joined_at)
  const controls = asRecord(member.role_controls)
  const canChangeRole = controls.can_change_role === true
  const canRemove = controls.can_remove === true
  const role = String(member.role || 'member')
  const roleStyle = ROLE_STYLES[role] || ROLE_STYLES.member

  return (
    <View className="rounded-[26px] border border-white/8 bg-[#111827] px-4 py-4">
      <View className="flex-row items-start gap-3">
        <View className="h-12 w-12 rounded-full border border-sky-400/15 bg-[#152033] items-center justify-center shadow-sm shadow-black/30">
          <View className="h-10 w-10 rounded-full bg-sky-400/12 items-center justify-center">
            <Text className="text-sky-100 text-sm font-semibold">{getInitials(primary)}</Text>
          </View>
        </View>
        <View className="flex-1 min-w-0">
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1 min-w-0">
              <Text className="text-white text-[15px] font-semibold" numberOfLines={1}>
                {primary}
              </Text>
              {secondary ? (
                <Text className="text-slate-400 text-xs mt-1" numberOfLines={1}>
                  {secondary}
                </Text>
              ) : null}
            </View>
            <View className={`rounded-full border px-2.5 py-1 flex-row items-center gap-1.5 ${roleStyle.badge}`}>
              <View className={`h-1.5 w-1.5 rounded-full ${roleStyle.dot}`} />
              <Text className={`text-[10px] uppercase tracking-[0.12em] ${roleStyle.text}`}>
                {formatRole(role)}
              </Text>
            </View>
          </View>

          {joinedLabel ? (
            <Text className="text-slate-500 text-[11px] mt-2">{joinedLabel}</Text>
          ) : null}

          {canChangeRole || canRemove ? (
            <View className="flex-row flex-wrap gap-2 mt-3">
              {canChangeRole ? (
                <TouchableOpacity
                  disabled={busy}
                  onPress={() => onRequestRoleChange(member)}
                  className={`rounded-full border px-3 py-2 ${busy ? 'border-white/5 bg-white/[0.03]' : 'border-white/10 bg-white/[0.04]'}`}
                >
                  <Text className="text-white text-xs font-medium">
                    {busy ? 'Working...' : 'Change role'}
                  </Text>
                </TouchableOpacity>
              ) : null}
              {canRemove ? (
                <TouchableOpacity
                  disabled={busy}
                  onPress={() => onRequestRemove(member)}
                  className={`rounded-full border px-3 py-2 ${busy ? 'border-rose-400/10 bg-rose-400/[0.03]' : 'border-rose-400/20 bg-rose-400/[0.08]'}`}
                >
                  <Text className="text-rose-200 text-xs font-medium">
                    {busy ? 'Working...' : 'Remove'}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>
    </View>
  )
}

const CircleMembersScreen = () => {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>()
  const circleId = Array.isArray(id) ? id[0] : id
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [payload, setPayload] = useState<Record<string, unknown> | null>(null)
  const [notice, setNotice] = useState<NoticeState>({ message: null, error: false, data: null })
  const [busyMembershipId, setBusyMembershipId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('recent')
  const [pendingAction, setPendingAction] = useState<PendingAction>(null)
  const [roleSelection, setRoleSelection] = useState<RoleSelectionState>(null)

  const loadMembers = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!circleId) return
      if (mode === 'refresh') setRefreshing(true)
      else setLoading(true)

      try {
        const response = await getCircle(circleId)
        setPayload(asRecord(response?.data ?? response))
      } catch (error: unknown) {
        const apiError = error as { response?: { status?: number; data?: unknown }; message?: string }
        const message = buildApiErrorMessage({
          status: apiError?.response?.status,
          data: apiError?.response?.data,
          fallback: 'Unable to load members right now.',
        })
        setNotice({ message, error: true, data: null })
      } finally {
        if (mode === 'refresh') setRefreshing(false)
        else setLoading(false)
      }
    },
    [circleId]
  )

  useFocusEffect(
    useCallback(() => {
      void loadMembers('initial')
    }, [loadMembers])
  )

  const title = String(payload?.name || payload?.title || 'Members')
  const members = useMemo(() => getArray(payload?.members) as MemberRecord[], [payload])
  const memberCount = members.length
  const canInvite = payload?.can_invite === true

  const filteredMembers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    const searched = query
      ? members.filter((member) => {
          const user = asRecord(member.user)
          const haystack = [
            member.display_name,
            member.fallback_name,
            user.display_name,
            user.fallback_name,
            user.admin_identity_name,
            user.email,
          ]
            .map((value) => String(value || '').toLowerCase())
            .join(' ')
          return haystack.includes(query)
        })
      : members

    const sorted = [...searched].sort((left, right) => {
      if (sortKey === 'circle_name') {
        return String(left.display_name || '').localeCompare(String(right.display_name || ''))
      }
      if (sortKey === 'role') {
        const roleCompare = getRoleOrder(String(left.role || 'member')) - getRoleOrder(String(right.role || 'member'))
        if (roleCompare !== 0) return roleCompare
        return String(left.display_name || '').localeCompare(String(right.display_name || ''))
      }

      const leftJoined = new Date(String(left.joined_at || 0)).getTime()
      const rightJoined = new Date(String(right.joined_at || 0)).getTime()
      return rightJoined - leftJoined
    })

    return sorted
  }, [members, searchQuery, sortKey])

  const performPendingAction = useCallback(async () => {
    if (!circleId || !pendingAction) return

    setBusyMembershipId(pendingAction.membershipId)
    setNotice({ message: null, error: false, data: null })

    try {
      if (pendingAction.type === 'role') {
        const response = await updateCircleMembership(circleId, pendingAction.membershipId, {
          role: pendingAction.role,
        })
        const updated = asRecord(response?.data ?? response)
        setPayload((current) => {
          if (!current) return current
          return {
            ...current,
            members: getArray(current.members).map((item) =>
              String(asRecord(item).id) === pendingAction.membershipId ? updated : item
            ),
          }
        })
        setNotice({
          message: `${pendingAction.memberName} is now ${formatRole(pendingAction.role)}.`,
          error: false,
          data: null,
        })
      } else {
        await removeCircleMembership(circleId, pendingAction.membershipId)
        setPayload((current) => {
          if (!current) return current
          return {
            ...current,
            members: getArray(current.members).filter(
              (item) => String(asRecord(item).id) !== pendingAction.membershipId
            ),
          }
        })
        setNotice({
          message: `${pendingAction.memberName} was removed from this circle.`,
          error: false,
          data: null,
        })
      }
      setPendingAction(null)
    } catch (error: unknown) {
      const apiError = error as { response?: { status?: number; data?: unknown }; message?: string }
      const message = buildApiErrorMessage({
        status: apiError?.response?.status,
        data: apiError?.response?.data,
        fallback:
          pendingAction.type === 'role'
            ? 'Unable to update this role right now.'
            : 'Unable to remove this member right now.',
      })
      setNotice({ message, error: true, data: null })
    } finally {
      setBusyMembershipId(null)
    }
  }, [circleId, pendingAction])

  const handleRoleChange = useCallback((member: MemberRecord) => {
    const membershipId = String(member.id || '')
    const controls = asRecord(member.role_controls)
    const assignableRoles = getArray(controls.assignable_roles).map((value) => String(value))
    const currentRole = String(member.role || 'member')
    const memberName = String(member.display_name || asRecord(member.user).display_name || 'Member')
    const roles = assignableRoles.filter((role) => role && role !== currentRole)

    if (roles.length === 0) return

    setRoleSelection({
      membershipId,
      memberName,
      roles,
    })
  }, [])

  const confirmRoleSelection = useCallback((role: string) => {
    if (!roleSelection) return

    setPendingAction({
      type: 'role',
      membershipId: roleSelection.membershipId,
      role,
      memberName: roleSelection.memberName,
    })
    setRoleSelection(null)
  }, [roleSelection])

  const handleRemove = useCallback((member: MemberRecord) => {
    const membershipId = String(member.id || '')
    const memberName = String(member.display_name || asRecord(member.user).display_name || 'Member')
    setPendingAction({
      type: 'remove',
      membershipId,
      memberName,
    })
  }, [])

  const header = (
    <View className="px-4 pt-6 pb-4">
      <View className="rounded-[28px] border border-white/8 bg-[#0f172a] px-5 py-5">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <Text className="text-white text-xl font-semibold">Member roster</Text>
            <Text className="text-slate-400 text-sm mt-2">
              {memberCount} {memberCount === 1 ? 'member' : 'members'} in {title}
            </Text>
          </View>
          <View className="rounded-full border border-white/8 bg-white/[0.04] px-3 py-1.5">
            <Text className="text-[11px] uppercase tracking-[0.14em] text-slate-300">Circle</Text>
          </View>
        </View>

        <Text className="text-slate-400 text-xs mt-4">
          Circle Name appears first. Real identity stays available underneath for clarity.
        </Text>

        <SearchBar value={searchQuery} onChange={setSearchQuery} />
        <SortMenu active={sortKey} onChange={setSortKey} />

        <View className="flex-row flex-wrap gap-2 mt-4">
          <TouchableOpacity
            onPress={() => router.push(`/circles/${circleId}/display-name` as Href)}
            className="rounded-full bg-app-primary px-4 py-3"
          >
            <Text className="text-black text-xs font-semibold">Edit My Circle Name</Text>
          </TouchableOpacity>
          {canInvite ? (
            <TouchableOpacity
              onPress={() => router.push(`/circles/${circleId}/invite` as Href)}
              className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-3"
            >
              <Text className="text-white text-xs font-semibold">Invite member</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <View className="mt-4">
        <NotificationAlert message={notice.message} data={notice.data} error={notice.error} />
      </View>
    </View>
  )

  if (loading) {
    return (
      <View className="flex-1 bg-primary justify-center items-center">
        <Stack.Screen options={{ headerTitle: 'Members' }} />
        <ActivityIndicator size="small" color="#ffcc00" />
        <Text className="text-white mt-3">Loading members...</Text>
      </View>
    )
  }

  return (
    <View className="flex-1 bg-primary">
      <Stack.Screen
        options={{
          headerTitle: 'Members',
          headerLargeTitle: false,
        }}
      />

      <ConfirmationModal
        pendingAction={pendingAction}
        busy={busyMembershipId === pendingAction?.membershipId}
        onCancel={() => {
          if (!busyMembershipId) setPendingAction(null)
        }}
        onConfirm={() => {
          void performPendingAction()
        }}
      />
      <RolePickerModal
        selection={roleSelection}
        onClose={() => setRoleSelection(null)}
        onSelect={confirmRoleSelection}
      />

      <FlatList
        data={filteredMembers}
        keyExtractor={(item) => String(asRecord(item).id)}
        renderItem={({ item }) => (
          <View className="px-4 pb-3">
            <MemberRow
              member={item}
              busy={busyMembershipId === String(item.id)}
              onRequestRoleChange={handleRoleChange}
              onRequestRemove={handleRemove}
            />
          </View>
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <View className="px-4">
            <View className="rounded-[26px] border border-white/8 bg-[#111827] px-5 py-6 items-center">
              <View className="h-12 w-12 rounded-full border border-white/10 bg-white/[0.04] items-center justify-center">
                <Ionicons name={searchQuery ? 'search-outline' : 'people-outline'} size={22} color="#94A3B8" />
              </View>
              <Text className="text-white text-sm font-semibold mt-3">
                {searchQuery ? 'No matching members' : 'No members yet'}
              </Text>
              <Text className="text-slate-400 text-xs mt-2 text-center leading-5">
                {searchQuery
                  ? 'Try a different Circle Name, email, or identity search.'
                  : 'Invite people into this circle to start building the roster.'}
              </Text>
              {canInvite ? (
                <TouchableOpacity
                  onPress={() => router.push(`/circles/${circleId}/invite` as Href)}
                  className="rounded-full bg-app-primary px-4 py-3 mt-4"
                >
                  <Text className="text-black text-xs font-semibold">Invite member</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 36 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadMembers('refresh')} />}
        initialNumToRender={14}
        maxToRenderPerBatch={12}
        windowSize={10}
        removeClippedSubviews
        keyboardShouldPersistTaps="handled"
        getItemLayout={(_, index) => ({
          length: ROW_HEIGHT,
          offset: ROW_HEIGHT * index,
          index,
        })}
      />
    </View>
  )
}

export default CircleMembersScreen
