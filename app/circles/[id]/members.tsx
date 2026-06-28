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
  createCirclePerson,
  getCircle,
  getCircleDuePlan,
  listCirclePeople,
  listCircleDueObligations,
  removeCircleMembership,
  updateCirclePerson,
  updateCircleMembership,
} from '@/api/circles'
import { buildApiErrorMessage } from '@/utils/apiErrorMessage'
import { buildRosterDuesLookup } from '@/utils/circleDues'
import { formatCircleRoleLabel } from '@/utils/circleRoleLabel'
import {
  DEFAULT_CIRCLE_SCREEN_CACHE_TTL_MS,
  isCircleScreenCacheFresh,
  readCircleScreenCache,
  writeCircleScreenCache,
} from '@/utils/circleScreenCache'
import { useEffect } from 'react'
import moneyFormat from '@/utils/moneyFormat'

type MemberRecord = Record<string, unknown>
type NotificationData = {
  token?: string | number | null
  reference?: string | number | null
  transfer_reference?: string | number | null
} | null
type NoticeState = { message: string | null; error: boolean; data: NotificationData }
type SortKey = 'circle_name' | 'role' | 'recent'
type PendingAction =
  | { type: 'role'; membershipId: string; role: string; memberName: string }
  | { type: 'remove'; membershipId: string; memberName: string; canRemove: boolean }
  | null
type PersonRecord = Record<string, unknown>
type RoleSelectionState = {
  membershipId: string
  memberName: string
  roles: string[]
} | null
type RosterFilter = 'all' | 'connected' | 'offline' | 'admins'
type RosterEntry = {
  key: string
  kind: 'member' | 'person'
  displayName: string
  secondary: string
  detail?: string
  isConnected: boolean
  role: string
  roleLabel: string
  searchIndex: string
  sortTimestamp: number
  record: MemberRecord | PersonRecord
}
type CircleMembersCache = {
  payload: Record<string, unknown> | null
  peoplePayload: Record<string, unknown> | null
  duePlanPayload: Record<string, unknown> | null
  dueObligationsPayload: Record<string, unknown>[]
}

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
  { key: 'circle_name', label: 'Name' },
  { key: 'role', label: 'Role' },
]
const SORT_LABELS: Record<SortKey, string> = {
  recent: 'Recently joined',
  circle_name: 'Name',
  role: 'Role',
}

const ROSTER_FILTERS: Array<{ key: RosterFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'connected', label: 'Connected' },
  { key: 'offline', label: 'Registry only' },
  { key: 'admins', label: 'Admins' },
]

const getArray = (value: unknown) => (Array.isArray(value) ? value : [])
const asRecord = (value: unknown) => ((value && typeof value === 'object' ? value : {}) as MemberRecord)
const asPersonRecord = (value: unknown) => ((value && typeof value === 'object' ? value : {}) as PersonRecord)

const formatRole = (value: string) => formatCircleRoleLabel(value)

const getInitials = (value: string) =>
  String(value || 'M')
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'M'

const getRoleOrder = (value: string) => {
  if (value === 'owner') return 0
  if (value === 'admin') return 1
  if (value === 'treasurer') return 2
  return 3
}

const getCircleMemberUserId = (member: MemberRecord) => {
  const user = asRecord(member.user)
  return String(user.id || member.user_id || member.linked_user_id || '').trim()
}

const getCircleMemberLabel = (member: MemberRecord) => {
  const user = asRecord(member.user)
  return String(member.display_name || user.display_name || user.email || 'Member')
}

const getPersonLinkedUserId = (person: PersonRecord) => {
  const linkedUser = asRecord(person.linked_user)
  const linkedMembership = asRecord(person.linked_membership)
  const linkedMembershipUser = asRecord(linkedMembership.user)

  return String(
    person.linked_user_id ||
      linkedUser.id ||
      linkedMembership.user_id ||
      linkedMembershipUser.id ||
      linkedMembershipUser.user_id ||
      ''
  ).trim()
}

const isPersonLinked = (person: PersonRecord) => {
  const linkedValue = person.linked ?? person.is_linked
  if (typeof linkedValue === 'boolean') return linkedValue
  if (typeof linkedValue === 'number') return linkedValue !== 0
  if (typeof linkedValue === 'string') {
    const normalized = linkedValue.trim().toLowerCase()
    if (normalized) return !['0', 'false', 'no', 'off', 'null', 'undefined'].includes(normalized)
  }
  return Boolean(getPersonLinkedUserId(person))
}

const getPersonLinkedMemberLabel = (person: PersonRecord, memberLabelByUserId: Map<string, string>) =>
  String(
    memberLabelByUserId.get(getPersonLinkedUserId(person)) ||
      asRecord(person.linked_user).display_name ||
      asRecord(asRecord(person.linked_membership).user).display_name ||
      ''
  )

const getPersonLinkedMembershipRole = (person: PersonRecord) => {
  const linkedMembership = asRecord(person.linked_membership)
  return String(person.role || linkedMembership.role || '').toLowerCase()
}

const getSortTimestamp = (...values: unknown[]) => {
  for (const value of values) {
    const raw = String(value || '').trim()
    if (!raw) continue
    const date = new Date(raw)
    const timestamp = date.getTime()
    if (!Number.isNaN(timestamp)) return timestamp
  }
  return 0
}

const getMemberSortTimestamp = (member: MemberRecord) =>
  getSortTimestamp(member.joined_at, member.created_at, asRecord(member.user).created_at)

const getPersonSortTimestamp = (person: PersonRecord) => getSortTimestamp(person.joined_at, person.created_at)

const getMemberActionState = (member: MemberRecord) => {
  const controls = asRecord(member.role_controls)
  const currentRole = String(member.role || 'member')
  const assignableRoles = getArray(controls.assignable_roles)
    .map((value) => String(value))
    .filter((role) => role && role !== currentRole)

  return {
    assignableRoles,
    canChangeRole: controls.can_change_role === true && assignableRoles.length > 0,
    canRemove: controls.can_remove === true,
  }
}

const formatContributionStatus = (member: MemberRecord) => {
  const raw =
    member.contribution_status ??
    member.contribution_state ??
    member.dues_status ??
    member.payment_status ??
    member.current_due_status ??
    member.due_status ??
    ''
  const value = String(raw || '').trim()
  if (!value) return 'Not available'
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase())
}

const SearchBar = ({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) => (
  <View className="mt-3 rounded-[18px] border border-white/10 bg-[#0b1220] px-3.5 py-3 flex-row items-center gap-3">
    <View className="h-9 w-9 rounded-full border border-white/10 bg-white/[0.04] items-center justify-center">
      <Ionicons name="search-outline" size={17} color="#CBD5E1" />
    </View>
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder="Search people"
      placeholderTextColor="#64748B"
      className="flex-1 text-white text-[15px]"
      autoCapitalize="none"
      autoCorrect={false}
      returnKeyType="search"
    />
    {value ? (
      <TouchableOpacity
        onPress={() => onChange('')}
        className="h-8 w-8 rounded-full bg-white/[0.05] items-center justify-center"
      >
        <Ionicons name="close" size={16} color="#CBD5E1" />
      </TouchableOpacity>
    ) : null}
  </View>
)

const FilterMenu = ({
  active,
  counts,
  onChange,
}: {
  active: RosterFilter
  counts: Record<RosterFilter, number>
  onChange: (value: RosterFilter) => void
}) => (
  <View className="mt-3 flex-row flex-wrap gap-2">
    {ROSTER_FILTERS.map((option) => {
      const selected = option.key === active
      const count = counts[option.key] ?? 0
      return (
        <TouchableOpacity
          key={option.key}
          onPress={() => onChange(option.key)}
          className={`rounded-full px-3.5 py-2.5 border ${
            selected
              ? 'border-cyan-300/40 bg-cyan-300/14'
              : 'border-white/10 bg-white/[0.03]'
          }`}
        >
          <Text className={`text-xs font-medium ${selected ? 'text-cyan-50' : 'text-slate-300'}`}>
            {option.label}{count > 0 ? ` ${count}` : ''}
          </Text>
        </TouchableOpacity>
      )
    })}
  </View>
)

const SortPickerModal = ({
  active,
  visible,
  onClose,
  onChange,
}: {
  active: SortKey
  visible: boolean
  onClose: () => void
  onChange: (value: SortKey) => void
}) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <View className="flex-1 bg-black/70 justify-end px-5 pb-6">
      <View className="rounded-[26px] border border-white/10 bg-[#0f172a] px-5 py-5">
        <View className="self-center h-1.5 w-12 rounded-full bg-white/10 mb-4" />
        <Text className="text-white text-lg font-semibold">Sort people</Text>
        <Text className="text-slate-400 text-sm mt-2">Choose how the roster is ordered.</Text>
        <View className="mt-5 gap-2">
          {SORT_OPTIONS.map((option) => {
            const selected = option.key === active
            return (
              <TouchableOpacity
                key={option.key}
                onPress={() => {
                  onChange(option.key)
                  onClose()
                }}
                className={`rounded-2xl border px-4 py-3 flex-row items-center justify-between ${
                  selected ? 'border-sky-300/30 bg-sky-300/10' : 'border-white/10 bg-white/[0.04]'
                }`}
              >
                <Text className={`text-sm font-medium ${selected ? 'text-sky-50' : 'text-white'}`}>
                  {option.label}
                </Text>
                {selected ? <Ionicons name="checkmark" size={18} color="#E0F2FE" /> : null}
              </TouchableOpacity>
            )
          })}
        </View>
        <TouchableOpacity
          onPress={onClose}
          className="rounded-2xl border border-white/10 bg-white/[0.03] py-3 items-center mt-5"
        >
          <Text className="text-white text-sm font-medium">Close</Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
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

const RosterRow = ({
  item,
  actionable,
  onPress,
}: {
  item: RosterEntry
  actionable: boolean
  onPress?: () => void
}) => {
  const titleTone = item.kind === 'member' ? 'text-white' : item.isConnected ? 'text-cyan-100' : 'text-white'
  const secondaryTone = item.kind === 'member' ? 'text-slate-300' : item.isConnected ? 'text-cyan-100/90' : 'text-slate-300'
  const detailTone = item.kind === 'member' ? 'text-slate-500' : item.isConnected ? 'text-cyan-200/70' : 'text-slate-500'
  const shellTone =
    item.kind === 'person'
      ? item.isConnected
        ? 'border-cyan-400/16 bg-[#0e1828]'
        : 'border-white/8 bg-[#111827]'
      : 'border-white/8 bg-[#101725]'
  const avatarTone =
    item.kind === 'member'
      ? 'border-sky-400/15 bg-[#152033]'
      : item.isConnected
        ? 'border-cyan-400/20 bg-[#112334]'
        : 'border-white/10 bg-[#152033]'
  const innerAvatarTone =
    item.kind === 'member' ? 'bg-sky-400/12' : item.isConnected ? 'bg-cyan-400/12' : 'bg-white/[0.04]'

  const content = (
    <View className={`rounded-[22px] border px-4 py-3.5 ${shellTone}`}>
      <View className="flex-row items-center gap-3">
        <View className={`h-11 w-11 rounded-full border ${avatarTone} items-center justify-center`}>
          <View
            className={`h-9 w-9 rounded-full ${innerAvatarTone} items-center justify-center`}
          >
            <Text className={`text-sm font-semibold ${item.kind === 'member' ? 'text-sky-100' : item.isConnected ? 'text-cyan-100' : 'text-slate-200'}`}>
              {getInitials(item.displayName)}
            </Text>
          </View>
        </View>
        <View className="flex-1 min-w-0">
          <View className="flex-row items-start justify-between gap-3">
            <Text className={`flex-1 min-w-0 text-[15px] font-semibold ${titleTone}`} numberOfLines={1}>
              {item.displayName}
            </Text>
          </View>
          <Text className={`mt-1 text-[13px] ${secondaryTone}`} numberOfLines={1}>
            {item.secondary}
          </Text>
          {item.detail ? (
            <Text className={`mt-1 text-[11px] ${detailTone}`} numberOfLines={1}>
              {item.detail}
            </Text>
          ) : null}
        </View>
        {actionable ? <Ionicons name="chevron-forward" size={16} color="#94A3B8" /> : null}
      </View>
    </View>
  )

  if (!actionable || !onPress) return content

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
      {content}
    </TouchableOpacity>
  )
}

const RosterActionModal = ({
  member,
  busy,
  canChangeRole,
  canRemove,
  onClose,
  onChangeRole,
  onRemove,
}: {
  member: MemberRecord | null
  busy: boolean
  canChangeRole: boolean
  canRemove: boolean
  onClose: () => void
  onChangeRole: () => void
  onRemove: () => void
}) => {
  if (!member) return null

  const displayName = String(member.display_name || asRecord(member.user).display_name || 'Member')
  const role = String(member.role || 'member')
  const roleStyle = ROLE_STYLES[role] || ROLE_STYLES.member

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-black/70 justify-end px-5 pb-6">
        <View className="rounded-[28px] border border-white/10 bg-[#0f172a] px-5 py-5">
          <View className="self-center h-1.5 w-12 rounded-full bg-white/10 mb-4" />
          <View className="flex-row items-start gap-3">
            <View className={`h-12 w-12 rounded-full border ${roleStyle.badge} items-center justify-center`}>
              <Text className={`text-sm font-semibold ${roleStyle.text}`}>{getInitials(displayName)}</Text>
            </View>
            <View className="flex-1">
              <Text className="text-white text-lg font-semibold">{displayName}</Text>
              <Text className="mt-1 text-slate-400 text-sm">{formatRole(role)}</Text>
              <Text className="mt-3 text-[11px] uppercase tracking-[0.14em] text-slate-500">Member actions</Text>
            </View>
          </View>

          <View className="mt-5 gap-3">
            {canChangeRole ? (
              <TouchableOpacity
                disabled={busy}
                onPress={onChangeRole}
                className={`rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 ${busy ? 'opacity-60' : ''}`}
              >
                <Text className="text-center text-sm font-medium text-white">{busy ? 'Working...' : 'Change role'}</Text>
              </TouchableOpacity>
            ) : null}
            {canRemove ? (
              <TouchableOpacity
                disabled={busy}
                onPress={onRemove}
                className={`rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-4 ${busy ? 'opacity-60' : ''}`}
              >
                <Text className="text-center text-sm font-semibold text-rose-100">
                  {busy ? 'Working...' : 'Remove member'}
                </Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              disabled={busy}
              onPress={onClose}
              className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4"
            >
              <Text className="text-center text-sm font-medium text-white">Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const PersonDetailModal = ({
  person,
  members,
  linkedMemberLabel,
  busy,
  onClose,
  onSelectMember,
}: {
  person: PersonRecord | null
  members: MemberRecord[]
  linkedMemberLabel: string
  busy: boolean
  onClose: () => void
  onSelectMember: (member: MemberRecord) => void
}) => {
  if (!person) return null

  const displayName = String(person.display_name || person.name || 'Person')
  const personLinkedUserId = getPersonLinkedUserId(person)
  const isAlreadyLinked = isPersonLinked(person)
  const initial = getInitials(displayName)

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-black/70 justify-end px-5 pb-6">
        <View className="rounded-[28px] border border-white/10 bg-[#0f172a] px-5 py-5">
          <View className="self-center h-1.5 w-12 rounded-full bg-white/10 mb-4" />
          <View className="flex-row items-start gap-3">
            <View className="h-12 w-12 rounded-full border border-white/10 bg-white/[0.04] items-center justify-center">
              <Text className="text-sm font-semibold text-white">{initial}</Text>
            </View>
            <View className="flex-1">
              <Text className="text-white text-lg font-semibold">{displayName}</Text>
              <Text className="mt-1 text-slate-400 text-sm">
                {isAlreadyLinked ? `Connected as ${linkedMemberLabel || 'a circle member'}` : 'No app account connected yet'}
              </Text>
            </View>
          </View>

          <View className="mt-4 rounded-[24px] border border-cyan-400/10 bg-cyan-400/[0.05] px-4 py-3">
            <Text className="text-[11px] uppercase tracking-[0.14em] text-cyan-100/80">Connect app member</Text>
            <Text className="mt-2 text-sm text-slate-300">
              Pick an existing BitBridge app member in this circle.
            </Text>
          </View>

          <FlatList
            data={members}
            keyExtractor={(member) => String(member.id || getCircleMemberUserId(member) || getCircleMemberLabel(member))}
            style={{ maxHeight: 280 }}
            contentContainerStyle={{ paddingTop: 12, gap: 10 }}
            renderItem={({ item: member }) => {
              const memberName = getCircleMemberLabel(member)
              const role = String(member.role || 'member').toLowerCase()
              const memberUserId = getCircleMemberUserId(member)
              const active = Boolean(personLinkedUserId && memberUserId && personLinkedUserId === memberUserId)

              return (
                <TouchableOpacity
                  onPress={() => onSelectMember(member)}
                  disabled={busy}
                  className={`rounded-2xl border px-4 py-3 flex-row items-center gap-3 ${
                    active ? 'border-cyan-400/30 bg-cyan-400/10' : 'border-white/10 bg-white/[0.04]'
                  } ${busy ? 'opacity-60' : ''}`}
                >
                  <View className="h-10 w-10 rounded-full border border-white/10 bg-[#152033] items-center justify-center">
                    <Text className="text-xs font-semibold text-white">{getInitials(memberName)}</Text>
                  </View>
                  <View className="flex-1 min-w-0">
                    <Text className="text-sm font-medium text-white" numberOfLines={1}>
                      {memberName}
                    </Text>
                    <Text className="mt-1 text-xs text-slate-400" numberOfLines={1}>
                      {formatRole(role)}
                    </Text>
                  </View>
                  <View className={`rounded-full border px-2.5 py-1 ${active ? 'border-cyan-400/20 bg-cyan-400/12' : 'border-white/10 bg-white/[0.03]'}`}>
                    <Text className={`text-[10px] uppercase tracking-[0.12em] ${active ? 'text-cyan-100' : 'text-slate-300'}`}>
                      {active ? 'Connected' : 'Select'}
                    </Text>
                  </View>
                </TouchableOpacity>
              )
            }}
          />

          <TouchableOpacity
            onPress={onClose}
            disabled={busy}
            className={`rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 mt-5 ${busy ? 'opacity-60' : ''}`}
          >
            <Text className="text-center text-sm font-medium text-white">{busy ? 'Working...' : 'Close'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

const CircleMembersScreen = () => {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>()
  const circleId = Array.isArray(id) ? id[0] : id
  const router = useRouter()
  const cacheKey = circleId ? `circle-members:${circleId}` : ''
  const cachedMembers = circleId ? readCircleScreenCache<CircleMembersCache>(cacheKey)?.data ?? null : null
  const handleOverviewPress = useCallback(() => {
    if (!circleId) return
    router.replace(`/circles/${circleId}` as Href)
  }, [circleId, router])
  const stackScreenOptions = useMemo(
    () => ({
      headerTitle: 'People',
      headerBackVisible: false,
      headerLeft: () => (
        <TouchableOpacity onPress={handleOverviewPress} className="flex-row items-center">
          <Ionicons name="chevron-back" size={18} color="#FFFFFF" />
          <Text className="ml-1 text-sm font-medium text-white">Overview</Text>
        </TouchableOpacity>
      ),
    }),
    [handleOverviewPress]
  )

  const [loading, setLoading] = useState(() => !cachedMembers)
  const [refreshing, setRefreshing] = useState(false)
  const [payload, setPayload] = useState<Record<string, unknown> | null>(() => cachedMembers?.payload ?? null)
  const [notice, setNotice] = useState<NoticeState>({ message: null, error: false, data: null })
  const [busyMembershipId, setBusyMembershipId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('recent')
  const [rosterFilter, setRosterFilter] = useState<RosterFilter>('all')
  const [pendingAction, setPendingAction] = useState<PendingAction>(null)
  const [roleSelection, setRoleSelection] = useState<RoleSelectionState>(null)
  const [selectedMember, setSelectedMember] = useState<MemberRecord | null>(null)
  const [selectedPerson, setSelectedPerson] = useState<PersonRecord | null>(null)
  const [personLinkSaving, setPersonLinkSaving] = useState(false)
  const [sortPickerVisible, setSortPickerVisible] = useState(false)
  const [personName, setPersonName] = useState('')
  const [peoplePayload, setPeoplePayload] = useState<Record<string, unknown> | null>(() => cachedMembers?.peoplePayload ?? null)
  const [duePlanPayload, setDuePlanPayload] = useState<Record<string, unknown> | null>(() => cachedMembers?.duePlanPayload ?? null)
  const [dueObligationsPayload, setDueObligationsPayload] = useState<Record<string, unknown>[]>(() => cachedMembers?.dueObligationsPayload ?? [])
  const [peopleSaving, setPeopleSaving] = useState(false)
  const [addPersonVisible, setAddPersonVisible] = useState(false)

  const loadMembers = useCallback(
    async (
      mode: 'initial' | 'refresh' = 'initial',
      options?: { allowPeopleFailure?: boolean }
    ) => {
      if (!circleId) return
      const cached = readCircleScreenCache<CircleMembersCache>(cacheKey)
      const hasVisibleData = Boolean(payload || cached?.data.payload)
      if (mode === 'refresh') setRefreshing(true)
      else if (!hasVisibleData) setLoading(true)

      try {
        if (mode === 'initial' && cached?.data && isCircleScreenCacheFresh(cacheKey, DEFAULT_CIRCLE_SCREEN_CACHE_TTL_MS)) {
          if (!payload) {
            setPayload(cached.data.payload)
            setPeoplePayload(cached.data.peoplePayload)
            setDuePlanPayload(cached.data.duePlanPayload)
            setDueObligationsPayload(cached.data.dueObligationsPayload)
          }
          return
        }
        const allowPeopleFailure = options?.allowPeopleFailure ?? mode === 'initial'
        const [circleResponse, peopleResponse] = await Promise.all([
          getCircle(circleId),
          allowPeopleFailure ? listCirclePeople(circleId).catch(() => null) : listCirclePeople(circleId),
        ])
        const [duePlanResponse, dueObligationsResponse] = await Promise.all([
          getCircleDuePlan(circleId).catch(() => null),
          listCircleDueObligations(circleId).catch(() => null),
        ])
        const nextPayload: CircleMembersCache = {
          payload: asRecord(circleResponse?.data ?? circleResponse),
          peoplePayload: asRecord(peopleResponse?.data ?? peopleResponse),
          duePlanPayload: asRecord(duePlanResponse?.data ?? duePlanResponse),
          dueObligationsPayload: getArray(dueObligationsResponse?.data ?? dueObligationsResponse).map(asRecord),
        }
        setPayload(nextPayload.payload)
        setPeoplePayload(nextPayload.peoplePayload)
        setDuePlanPayload(nextPayload.duePlanPayload)
        setDueObligationsPayload(nextPayload.dueObligationsPayload)
        writeCircleScreenCache(cacheKey, nextPayload)
      } catch (error: unknown) {
        const apiError = error as { response?: { status?: number; data?: unknown }; message?: string }
        const apiData = apiError?.response?.data as Record<string, unknown> | undefined
        const message = buildApiErrorMessage({
          status: apiError?.response?.status,
          data: apiData ?? null,
          fallback: 'Unable to load members right now.',
        })
        setNotice({ message, error: true, data: null })
      } finally {
        if (mode === 'refresh') setRefreshing(false)
        else setLoading(false)
      }
    },
    [cacheKey, circleId, payload]
  )

  useEffect(() => {
    const nextCachedMembers = circleId ? readCircleScreenCache<CircleMembersCache>(cacheKey)?.data ?? null : null
    setPayload(nextCachedMembers?.payload ?? null)
    setPeoplePayload(nextCachedMembers?.peoplePayload ?? null)
    setDuePlanPayload(nextCachedMembers?.duePlanPayload ?? null)
    setDueObligationsPayload(nextCachedMembers?.dueObligationsPayload ?? [])
    setLoading(!nextCachedMembers)
    setRefreshing(false)
    setNotice({ message: null, error: false, data: null })
  }, [cacheKey, circleId])

  useFocusEffect(
    useCallback(() => {
      void loadMembers('initial')
    }, [loadMembers])
  )

  const title = String(payload?.name || payload?.title || 'People')
  const members = useMemo(() => getArray(payload?.members) as MemberRecord[], [payload])
  const people = useMemo(() => getArray(peoplePayload?.people).map(asPersonRecord), [peoplePayload])
  const memberLabelByUserId = useMemo(() => {
    const lookup = new Map<string, string>()
    members.forEach((member) => {
      const userId = getCircleMemberUserId(member)
      if (!userId) return
      lookup.set(userId, getCircleMemberLabel(member))
    })
    return lookup
  }, [members])
  const permissions = asRecord(payload?.permissions)
  const currentRole = String(payload?.current_user_role || '').toLowerCase()
  const canManageMembers = Boolean(
    permissions.can_manage_members ||
      permissions.can_invite_members ||
      currentRole === 'owner' ||
      currentRole === 'admin'
  )
  const canInvite = canManageMembers
  const canManagePeople = currentRole === 'owner' || currentRole === 'admin'
  const visiblePeople = useMemo(() => people, [people])
  const memberByUserId = useMemo(() => {
    const lookup = new Map<string, MemberRecord>()
    members.forEach((member) => {
      const userId = getCircleMemberUserId(member)
      if (!userId) return
      lookup.set(userId, member)
    })
    return lookup
  }, [members])
  const duesLookup = useMemo(
    () => buildRosterDuesLookup(members, people, dueObligationsPayload, duePlanPayload),
    [members, people, dueObligationsPayload, duePlanPayload]
  )
  const rosterEntries = useMemo(() => {
    const linkedMemberUserIds = new Set<string>()
    const fromPeople = visiblePeople.map<RosterEntry>((person) => {
      const displayName = String(person.display_name || person.name || 'Person')
      const linkedUserId = getPersonLinkedUserId(person)
      const linkedMember = linkedUserId ? memberByUserId.get(linkedUserId) : null
      const role = getPersonLinkedMembershipRole(person) || String(linkedMember?.role || '').toLowerCase()
      const isConnected = isPersonLinked(person)
      const dues = duesLookup[String(person.id || linkedUserId || displayName)]
      const linkedLabel =
        getPersonLinkedMemberLabel(person, memberLabelByUserId) ||
        (linkedMember ? getCircleMemberLabel(linkedMember) : '')
      const contribution = dues
        ? dues.statusLabel
        : linkedMember
          ? formatContributionStatus(linkedMember)
          : 'Not available'
      const secondary =
        isConnected
          ? `${role ? formatRole(role) : 'Member'} - Connected`
          : 'Active member'
      const detailParts: string[] = []
      if (linkedLabel) detailParts.push(`Linked app member: ${linkedLabel}`)
      if (contribution !== 'Not available') detailParts.push(`Dues: ${contribution}`)
      if (linkedUserId) linkedMemberUserIds.add(linkedUserId)

      return {
        key: `person:${String(person.id || person.person_id || displayName)}`,
        kind: 'person',
        displayName,
        secondary,
        detail: detailParts.join(' - ') || undefined,
        isConnected,
        role,
        roleLabel: role ? formatRole(role) : isConnected ? 'Linked' : 'Active member',
        searchIndex: [displayName, role, linkedLabel, contribution, isConnected ? 'connected' : 'active member']
          .join(' ')
          .toLowerCase(),
        sortTimestamp: Math.max(getPersonSortTimestamp(person), linkedMember ? getMemberSortTimestamp(linkedMember) : 0),
        record: person,
      }
    })

    const fromMembers = members
      .filter((member) => {
        const userId = getCircleMemberUserId(member)
        return !userId || !linkedMemberUserIds.has(userId)
      })
      .map<RosterEntry>((member) => {
        const userId = getCircleMemberUserId(member)
        const linkedPerson = people.find((person) => getPersonLinkedUserId(person) === userId)
        const displayName = String(linkedPerson?.display_name || getCircleMemberLabel(member))
        const role = String(member.role || 'member').toLowerCase()
        const dues = duesLookup[String(member.id || userId || linkedPerson?.id || displayName)]
        const contribution = dues ? dues.statusLabel : formatContributionStatus(member)
        const secondary = linkedPerson
          ? `${formatRole(role)} - Linked person`
          : `${formatRole(role)} - Connected`
        const detail = contribution !== 'Not available'
          ? `Dues: ${contribution}${dues?.outstandingAmountCents ? ` - ${moneyFormat(Number(dues.outstandingAmountCents || 0) / 100)} outstanding` : ''}`
          : undefined

        return {
          key: `member:${String(member.id || getCircleMemberUserId(member) || displayName)}`,
          kind: 'member',
          displayName,
          secondary,
          detail,
          isConnected: true,
          role,
          roleLabel: formatRole(role),
          searchIndex: [displayName, role, contribution, linkedPerson?.display_name || '', 'connected'].join(' ').toLowerCase(),
          sortTimestamp: getMemberSortTimestamp(member),
          record: member,
        }
      })

    return [...fromPeople, ...fromMembers].sort((left, right) => {
      const leftGroup = left.kind === 'person' ? 0 : 1
      const rightGroup = right.kind === 'person' ? 0 : 1
      if (leftGroup !== rightGroup) return leftGroup - rightGroup
      return left.displayName.localeCompare(right.displayName)
    })
  }, [memberByUserId, memberLabelByUserId, members, people, visiblePeople, duesLookup])
  const rosterCounts = useMemo(
    () => ({
      all: rosterEntries.length,
      connected: rosterEntries.filter((item) => item.isConnected).length,
      offline: rosterEntries.filter((item) => !item.isConnected).length,
      admins: rosterEntries.filter((item) => ['owner', 'admin', 'treasurer'].includes(item.role)).length,
    }),
    [rosterEntries]
  )
  const filteredRosterEntries = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    const filtered = rosterEntries.filter((item) => {
      if (rosterFilter === 'connected' && !item.isConnected) return false
      if (rosterFilter === 'offline' && item.isConnected) return false
      if (rosterFilter === 'admins' && !['owner', 'admin', 'treasurer'].includes(item.role)) return false
      if (query && !item.searchIndex.includes(query)) return false
      return true
    })
    return [...filtered].sort((left, right) => {
      if (sortKey === 'circle_name') return left.displayName.localeCompare(right.displayName)
      if (sortKey === 'role') {
        const roleCompare = getRoleOrder(left.role) - getRoleOrder(right.role)
        if (roleCompare !== 0) return roleCompare
        return left.displayName.localeCompare(right.displayName)
      }
      if (sortKey === 'recent') {
        const timestampCompare = right.sortTimestamp - left.sortTimestamp
        if (timestampCompare !== 0) return timestampCompare
      }
      return left.displayName.localeCompare(right.displayName)
    })
  }, [rosterEntries, rosterFilter, searchQuery, sortKey])

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
        if (!pendingAction.canRemove) {
          setNotice({ message: 'You cannot remove this member from the circle.', error: true, data: null })
          setPendingAction(null)
          return
        }
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
      const apiData = apiError?.response?.data as Record<string, unknown> | undefined
      const message = buildApiErrorMessage({
        status: apiError?.response?.status,
        data: apiData ?? null,
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
    const { assignableRoles, canChangeRole } = getMemberActionState(member)
    const memberName = String(member.display_name || asRecord(member.user).display_name || 'Member')

    if (!canChangeRole) return

    setRoleSelection({
      membershipId,
      memberName,
      roles: assignableRoles,
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
    const { canRemove } = getMemberActionState(member)
    if (!canRemove) {
      setNotice({ message: 'You cannot remove this member from the circle.', error: true, data: null })
      return
    }
    const membershipId = String(member.id || '')
    const memberName = String(member.display_name || asRecord(member.user).display_name || 'Member')
    setPendingAction({
      type: 'remove',
      membershipId,
      memberName,
      canRemove,
    })
  }, [])

  const handleOpenMemberActions = useCallback((member: MemberRecord) => {
    const { canChangeRole, canRemove } = getMemberActionState(member)
    if (!canChangeRole && !canRemove) return
    setSelectedMember(member)
  }, [])

  const handleOpenPersonDetails = useCallback((person: PersonRecord) => {
    setSelectedPerson(person)
  }, [])

  const handleLinkPersonToMember = useCallback(
    async (member: MemberRecord) => {
      if (!circleId || !selectedPerson || !canManagePeople || personLinkSaving) return

      const linkedUserId = getCircleMemberUserId(member)
      if (!linkedUserId) {
        setNotice({ message: 'Unable to link this member right now.', error: true, data: null })
        return
      }

      setPersonLinkSaving(true)
      setNotice({ message: null, error: false, data: null })

      try {
        await updateCirclePerson(circleId, String(selectedPerson.id || selectedPerson.person_id || ''), {
          linked_user_id: linkedUserId,
        })
        await loadMembers('refresh', { allowPeopleFailure: false })
        setSelectedPerson(null)
        setNotice({
          message: `${String(selectedPerson.display_name || selectedPerson.name || 'Person')} linked successfully.`,
          error: false,
          data: null,
        })
      } catch (error: unknown) {
        const apiError = error as { response?: { status?: number; data?: unknown }; message?: string }
        const apiData = apiError?.response?.data as Record<string, unknown> | undefined
        const message = buildApiErrorMessage({
          status: apiError?.response?.status,
          data: apiData ?? null,
          fallback: 'Unable to link this person right now.',
        })
        setNotice({ message, error: true, data: null })
      } finally {
        setPersonLinkSaving(false)
      }
    },
    [canManagePeople, circleId, loadMembers, personLinkSaving, selectedPerson]
  )

  const handleCreatePerson = useCallback(async () => {
    if (!circleId || !canManagePeople) return
    const displayName = personName.trim()
    if (!displayName) {
      setNotice({ message: 'Enter a display name to add a person.', error: true, data: null })
      return
    }

    setPeopleSaving(true)
    setNotice({ message: null, error: false, data: null })
    try {
      await createCirclePerson(circleId, { display_name: displayName })
      setPersonName('')
      setAddPersonVisible(false)
      await loadMembers('refresh')
      setNotice({ message: `${displayName} added to the roster.`, error: false, data: null })
    } catch (error: unknown) {
      const apiError = error as { response?: { status?: number; data?: unknown }; message?: string }
      const apiData = apiError?.response?.data as Record<string, unknown> | undefined
      const message = buildApiErrorMessage({
        status: apiError?.response?.status,
        data: apiData ?? null,
        fallback: 'Unable to add this person right now.',
      })
      setNotice({ message, error: true, data: null })
    } finally {
      setPeopleSaving(false)
    }
  }, [canManagePeople, circleId, loadMembers, personName])

  const header = (
    <View className="px-4 pt-1 pb-4">
      <View className="rounded-[24px] border border-white/8 bg-[#0f172a] px-4 py-4">
        <Text className="text-slate-400 text-sm mt-1">
          {rosterEntries.length} {rosterEntries.length === 1 ? 'person' : 'people'} in {title}
        </Text>

        <FilterMenu active={rosterFilter} counts={rosterCounts} onChange={setRosterFilter} />

        <View className="mt-3 flex-row items-center justify-between gap-3">
          <Text className="text-[12px] text-slate-400">Sorted by {SORT_LABELS[sortKey]}</Text>
          <TouchableOpacity onPress={() => setSortPickerVisible(true)}>
            <Text className="text-[12px] font-medium text-sky-100">Change sort</Text>
          </TouchableOpacity>
        </View>

        <SearchBar value={searchQuery} onChange={setSearchQuery} />

        <View className="flex-row flex-wrap items-center gap-x-4 gap-y-3 mt-4">
          {canManagePeople ? (
            <TouchableOpacity
              onPress={() => setAddPersonVisible(true)}
              className="rounded-full bg-app-primary px-4 py-3"
            >
              <Text className="text-black text-xs font-semibold">Add person</Text>
            </TouchableOpacity>
          ) : null}
          {canInvite ? (
            <TouchableOpacity
              onPress={() => router.push(`/circles/${circleId}/invite?role=member` as Href)}
              className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-3"
            >
              <Text className="text-white text-xs font-semibold">Invite to BitBridge</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity onPress={() => router.push(`/circles/${circleId}/display-name` as Href)}>
            <Text className="text-[12px] text-slate-300">Your name in this circle</Text>
          </TouchableOpacity>
          {canManageMembers ? (
            <TouchableOpacity onPress={() => router.push(`/circles/${circleId}/invite?role=admin` as Href)}>
              <Text className="text-[12px] text-sky-100">Invite admin</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <Modal
        visible={addPersonVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAddPersonVisible(false)}
      >
        <View className="flex-1 bg-black/70 justify-center px-5">
          <View className="rounded-[28px] border border-white/10 bg-[#0f172a] px-5 py-5">
            <Text className="text-white text-lg font-semibold">Add person</Text>
            <Text className="text-slate-400 text-sm mt-2 leading-6">
              Add a real-world person to the roster. This does not create a BitBridge account.
            </Text>
            <View className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
              <TextInput
                value={personName}
                onChangeText={setPersonName}
                placeholder="Display name"
                placeholderTextColor="#64748B"
                className="text-white text-sm"
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>
            <View className="flex-row gap-3 mt-6">
              <TouchableOpacity
                disabled={peopleSaving}
                onPress={() => setAddPersonVisible(false)}
                className="flex-1 rounded-2xl border border-white/10 bg-white/[0.03] py-3 items-center"
              >
                <Text className="text-white text-sm font-medium">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={peopleSaving}
                onPress={() => {
                  void handleCreatePerson()
                }}
                className="flex-1 rounded-2xl bg-app-primary py-3 items-center"
              >
                <Text className="text-black text-sm font-semibold">
                  {peopleSaving ? 'Working...' : 'Add person'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <View className="mt-4">
        <NotificationAlert message={notice.message} data={notice.data} error={notice.error} />
      </View>
    </View>
  )

  if (loading) {
    return (
      <View className="flex-1 bg-primary items-center justify-center">
        <Stack.Screen options={stackScreenOptions} />
        <ActivityIndicator size="small" color="#ffcc00" />
        <Text className="text-white mt-3">Loading people...</Text>
      </View>
    )
  }

  return (
    <View className="flex-1 bg-primary items-center">
      <Stack.Screen options={stackScreenOptions} />
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
      <SortPickerModal
        active={sortKey}
        visible={sortPickerVisible}
        onClose={() => setSortPickerVisible(false)}
        onChange={setSortKey}
      />
      <PersonDetailModal
        person={selectedPerson}
        members={members}
        linkedMemberLabel={
          selectedPerson ? getPersonLinkedMemberLabel(selectedPerson, memberLabelByUserId) : ''
        }
        busy={personLinkSaving}
        onClose={() => setSelectedPerson(null)}
        onSelectMember={(member) => {
          void handleLinkPersonToMember(member)
        }}
      />

      <View className="flex-1 w-full max-w-[460px]">
        <FlatList
          data={filteredRosterEntries}
          keyExtractor={(item) => item.key}
          renderItem={({ item }) => (
            <View className="px-4 pb-3">
              <RosterRow
                item={item}
                actionable={
                  (item.kind === 'member' &&
                    canManageMembers &&
                    (() => {
                      const member = asRecord(item.record)
                      const { canChangeRole, canRemove } = getMemberActionState(member)
                      return canChangeRole || canRemove
                    })()) ||
                  (item.kind === 'person' && canManagePeople)
                }
                onPress={
                  item.kind === 'member' && canManageMembers
                    ? () => handleOpenMemberActions(asRecord(item.record))
                    : item.kind === 'person' && canManagePeople
                      ? () => handleOpenPersonDetails(asPersonRecord(item.record))
                      : undefined
                }
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
                  {searchQuery ? 'No matching people' : 'No people yet'}
                </Text>
                <Text className="text-slate-400 text-xs mt-2 text-center leading-5">
                  {searchQuery
                    ? 'Try a different name or filter.'
                    : 'Add active members or invite members to build the roster.'}
                </Text>
                {canManagePeople ? (
                  <TouchableOpacity
                    onPress={() => setAddPersonVisible(true)}
                    className="rounded-full bg-app-primary px-4 py-3 mt-4"
                  >
                    <Text className="text-black text-xs font-semibold">Add person</Text>
                  </TouchableOpacity>
                ) : null}
                {canInvite ? (
                  <TouchableOpacity
                    onPress={() => router.push(`/circles/${circleId}/invite?role=member` as Href)}
                    className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-3 mt-3"
                  >
                    <Text className="text-white text-xs font-semibold">Invite to BitBridge</Text>
                  </TouchableOpacity>
                ) : null}
                {canManageMembers ? (
                  <TouchableOpacity
                    onPress={() => router.push(`/circles/${circleId}/invite?role=admin` as Href)}
                    className="mt-3"
                  >
                    <Text className="text-[12px] text-sky-100">Invite admin</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          }
          contentContainerStyle={{ paddingTop: 4, paddingBottom: 36 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadMembers('refresh')} />}
          initialNumToRender={14}
          maxToRenderPerBatch={12}
          windowSize={10}
          removeClippedSubviews
          keyboardShouldPersistTaps="handled"
        />
      </View>
      <RosterActionModal
        member={selectedMember}
        busy={busyMembershipId === String(selectedMember?.id || '')}
        canChangeRole={selectedMember ? getMemberActionState(selectedMember).canChangeRole : false}
        canRemove={selectedMember ? getMemberActionState(selectedMember).canRemove : false}
        onClose={() => setSelectedMember(null)}
        onChangeRole={() => {
          if (!selectedMember) return
          handleRoleChange(selectedMember)
          setSelectedMember(null)
        }}
        onRemove={() => {
          if (!selectedMember) return
          handleRemove(selectedMember)
          setSelectedMember(null)
        }}
      />
    </View>
  )
}

export default CircleMembersScreen
