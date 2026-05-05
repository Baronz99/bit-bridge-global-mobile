import React, { useCallback, useMemo, useState } from 'react'
import { ActivityIndicator, Modal, Platform, Pressable, RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useFocusEffect } from '@react-navigation/native'
import DateTimePicker from '@react-native-community/datetimepicker'
import {
  approveCircleApprovalRequest,
  createCircleActivity,
  getCircleDuePlan,
  listCircleDueObligations,
  getCirclePaymentItems,
  getCircleSettings,
  getCircleWorkspace,
  inviteCircleMember,
  rejectCircleApprovalRequest,
  updateCircleActivity,
  updateCircleDuePlan,
  updateCircleSettings,
  upsertCircleDuePlan,
} from '@/api/circles'
import {
  CircleShell,
  circleBucketLabel,
  circleTitle,
  normalizePaymentItems,
  paymentItemAmount,
} from '@/components/circles/rebuild'
import FormSelect from '@/components/FormSelect'
import { getCircleRoleLabel } from '@/utils/circleRoleLabel'
import { buildMemberDuesLookup } from '@/utils/circleDues'
import { replaceCircleWorkspaceSection } from '@/utils/circleWorkspaceNav'
import moneyFormat from '@/utils/moneyFormat'

const PAYMENT_TEMPLATES_BY_BUCKET: Record<string, Array<Record<string, any>>> = {
  clubs_teams: [
    { key: 'monthly_dues', title: 'Monthly Dues', setup_type: 'recurring', cadence: 'monthly' },
    { key: 'match_fee', title: 'Match Fee', setup_type: 'activity', contribution_frequency: 'one_time' },
    { key: 'jersey', title: 'Jersey', setup_type: 'activity', contribution_frequency: 'one_time' },
    { key: 'general_support', title: 'General Support', setup_type: 'activity', contribution_frequency: 'one_time' },
  ],
  estates_communities: [
    { key: 'security_levy', title: 'Security Levy', setup_type: 'recurring', cadence: 'monthly' },
    { key: 'utility_bill', title: 'Utility Bill', setup_type: 'activity', contribution_frequency: 'monthly' },
    { key: 'maintenance_levy', title: 'Maintenance Levy', setup_type: 'activity', contribution_frequency: 'one_time' },
    { key: 'emergency_support', title: 'Emergency Support', setup_type: 'activity', contribution_frequency: 'one_time' },
  ],
  families: [
    { key: 'welfare_support', title: 'Welfare Support', setup_type: 'activity', contribution_frequency: 'monthly' },
    { key: 'event_fund', title: 'Event Fund', setup_type: 'activity', contribution_frequency: 'one_time' },
    { key: 'emergency_contribution', title: 'Emergency Contribution', setup_type: 'activity', contribution_frequency: 'one_time' },
  ],
  associations: [
    { key: 'membership_dues', title: 'Membership Dues', setup_type: 'recurring', cadence: 'monthly' },
    { key: 'event_contribution', title: 'Event Contribution', setup_type: 'activity', contribution_frequency: 'one_time' },
    { key: 'penalty_fee', title: 'Penalty Fee', setup_type: 'fine', disabled: true },
  ],
  cooperatives: [
    { key: 'savings_contribution', title: 'Savings Contribution', setup_type: 'recurring', cadence: 'monthly' },
    { key: 'special_contribution', title: 'Special Contribution', setup_type: 'activity', contribution_frequency: 'one_time' },
  ],
}

const DUE_SCOPE_OPTIONS = [
  { value: 'everyone', label: 'Everyone in this Circle' },
  { value: 'members_only', label: 'Members only' },
  { value: 'members_admins', label: 'Members + Admins' },
  { value: 'custom_roles', label: 'Choose specific roles' },
]

const DUE_ROLE_OPTIONS = [
  { value: 'member', label: 'Members' },
  { value: 'treasurer', label: 'Treasurers' },
  { value: 'admin', label: 'Admins' },
]

const CADENCE_OPTIONS = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
]

const WEEKDAY_OPTIONS = [
  { value: '0', label: 'Sunday' },
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
  { value: '6', label: 'Saturday' },
]

const MONTH_DAY_OPTIONS = Array.from({ length: 31 }, (_, index) => {
  const value = String(index + 1)
  return { value, label: value }
})

const YEAR_MONTH_OPTIONS = [
  { value: '1', label: 'January' },
  { value: '2', label: 'February' },
  { value: '3', label: 'March' },
  { value: '4', label: 'April' },
  { value: '5', label: 'May' },
  { value: '6', label: 'June' },
  { value: '7', label: 'July' },
  { value: '8', label: 'August' },
  { value: '9', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
]

const GRACE_PERIOD_OPTIONS = [0, 1, 2, 3, 5, 7, 14].map((value) => ({
  value: String(value),
  label: value === 1 ? '1 day' : `${value} days`,
}))

const CONTRIBUTION_FREQUENCY_OPTIONS = [
  { value: 'one_time', label: 'Available any time' },
  { value: 'weekly', label: 'Weekly availability' },
  { value: 'monthly', label: 'Monthly availability' },
]

const VISIBILITY_OPTIONS = [
  { value: 'private', label: 'Private' },
  { value: 'official_featured', label: 'Official featured' },
]

const rolesForDueScope = (scope: string) => {
  switch (scope) {
    case 'members_only':
      return ['member']
    case 'members_admins':
      return ['member', 'admin']
    case 'custom_roles':
      return []
    case 'everyone':
    default:
      return ['member', 'admin', 'treasurer']
  }
}

const dueScopeFromRoles = (roles: string[]) => {
  const normalized = Array.isArray(roles) ? [...new Set(roles.map(String))].sort() : []
  const joined = normalized.join('|')
  if (joined === ['admin', 'member', 'treasurer'].sort().join('|')) return 'everyone'
  if (joined === 'member') return 'members_only'
  if (joined === ['admin', 'member'].sort().join('|')) return 'members_admins'
  return 'custom_roles'
}

const toMajor = (value: any) => {
  if (value === null || value === undefined || value === '') return ''
  const amount = Number(value)
  return Number.isFinite(amount) ? String(amount / 100) : ''
}

const toMinor = (value: any) => {
  const normalized = String(value || '').replace(/,/g, '').trim()
  if (!normalized) return null
  const amount = Number(normalized)
  return Number.isFinite(amount) ? Math.round(amount * 100) : null
}

const pillClass = (active: boolean) =>
  `rounded-full border px-3 py-2 ${active ? 'border-cyan-400 bg-cyan-500/15' : 'border-gray-700 bg-gray-900'}`

const inputClass = 'rounded-2xl border border-gray-800 bg-gray-950 px-4 py-4 text-sm text-white'

type PickerTarget = 'due_start' | 'due_end' | 'activity_deadline' | null

const activitySetupTone = (template?: Record<string, any> | null) => {
  switch (template?.key) {
    case 'general_support':
    case 'emergency_support':
    case 'emergency_contribution':
    case 'welfare_support':
      return 'Open support item'
    case 'match_fee':
    case 'utility_bill':
    case 'maintenance_levy':
    case 'event_fund':
    case 'event_contribution':
    case 'special_contribution':
      return 'Fixed collection item'
    case 'jersey':
      return 'Quantity item'
    default:
      return 'Payment item'
  }
}

const activityAmountLabel = (kind?: string | null) =>
  String(kind || '').toLowerCase() === 'quantity'
    ? 'Unit price (NGN)'
    : String(kind || '').toLowerCase() === 'open'
      ? 'Suggested amount (NGN)'
      : 'Amount members pay (NGN)'

const activityKindForTemplate = (template?: Record<string, any> | null) => {
  switch (template?.key) {
    case 'general_support':
    case 'emergency_support':
    case 'emergency_contribution':
    case 'welfare_support':
      return 'open'
    case 'jersey':
      return 'quantity'
    default:
      return 'fixed'
  }
}

const activityAvailabilityLabel = (frequency: string) => {
  switch (frequency) {
    case 'weekly':
      return 'Weekly availability'
    case 'monthly':
      return 'Monthly availability'
    default:
      return 'Available any time'
  }
}

const parseStoredDate = (value: string) => {
  if (!value) return null
  const normalized = String(value).slice(0, 10)
  const [year, month, day] = normalized.split('-').map((item) => Number(item))
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day)
}

const formatLocalDate = (value: Date) => {
  const year = value.getFullYear()
  const month = `${value.getMonth() + 1}`.padStart(2, '0')
  const day = `${value.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

const formatDisplayDate = (value: string) => {
  const parsed = parseStoredDate(value)
  if (!parsed) return ''
  return parsed.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

const CircleManageScreen = () => {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>()
  const circleId = Array.isArray(id) ? id[0] : id
  const router = useRouter()
  const [workspace, setWorkspace] = useState<Record<string, any> | null>(null)
  const [paymentItems, setPaymentItems] = useState<any[]>([])
  const [members, setMembers] = useState<any[]>([])
  const [dueObligations, setDueObligations] = useState<Record<string, any>[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [section, setSection] = useState<'payment_items' | 'members' | 'governance' | 'settings'>('payment_items')
  const [saving, setSaving] = useState(false)
  const [processingApprovalId, setProcessingApprovalId] = useState('')
  const [activityTemplate, setActivityTemplate] = useState<Record<string, any> | null>(null)
  const [editingActivityId, setEditingActivityId] = useState('')
  const [pickerTarget, setPickerTarget] = useState<PickerTarget>(null)
  const [pickerDraftDate, setPickerDraftDate] = useState<Date>(new Date())

  const [inviteEmail, setInviteEmail] = useState('')
  const [settingsForm, setSettingsForm] = useState({
    name: '',
    purpose: '',
    description: '',
    badge_label: '',
    visibility: 'private',
    withdrawal_approval_threshold: '',
    governance_setup_completed: false,
  })
  const [duePlan, setDuePlan] = useState<Record<string, any> | null>(null)
  const [duePlanForm, setDuePlanForm] = useState({
    amount_ngn: '',
    cadence: 'monthly',
    due_day_of_month: '1',
    due_weekday: '1',
    due_month_of_year: '1',
    grace_period_days: '0',
    starts_on: '',
    ends_on: '',
    due_scope: 'everyone',
    enrolled_roles: rolesForDueScope('everyone'),
  })
  const [activityForm, setActivityForm] = useState({
    name: '',
    amount_ngn: '',
    deadline_at: '',
    contribution_frequency: 'one_time',
    payment_item_kind: 'fixed',
  })

  const loadManage = useCallback(async (isRefresh = false) => {
    if (!circleId) return
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError('')
    try {
      const [workspaceResponse, paymentItemsResponse, settingsResponse, duePlanResponse, obligationsResponse] = await Promise.all([
        getCircleWorkspace(circleId),
        getCirclePaymentItems(circleId),
        getCircleSettings(circleId).catch(() => null),
        getCircleDuePlan(circleId).catch(() => null),
        listCircleDueObligations(circleId).catch(() => null),
      ])

      const ws = workspaceResponse || {}
      const settingsRoot = settingsResponse?.data || settingsResponse || {}
      const identity = settingsRoot.identity || {}
      const governance = settingsRoot.governance || {}
      const dueRoot = duePlanResponse?.data || duePlanResponse || null

      setWorkspace(ws)
      setMembers(Array.isArray(ws?.members) ? ws.members : [])
      setDueObligations(Array.isArray(obligationsResponse?.data) ? obligationsResponse.data : [])
      setPaymentItems(normalizePaymentItems(paymentItemsResponse))
      setSettingsForm({
        name: identity.name || ws?.name || '',
        purpose: identity.purpose || '',
        description: identity.description || ws?.description || '',
        badge_label: identity.badge_label || '',
        visibility: settingsRoot?.privacy?.visibility || 'private',
        withdrawal_approval_threshold: String(governance.configured_withdrawal_approval_threshold ?? ''),
        governance_setup_completed: Boolean(governance.governance_setup_completed),
      })
      setDuePlan(dueRoot)
      if (dueRoot) {
        const enrolledRoles = Array.isArray(dueRoot.enrolled_roles) && dueRoot.enrolled_roles.length
          ? dueRoot.enrolled_roles
          : rolesForDueScope('everyone')
        setDuePlanForm({
          amount_ngn: toMajor(dueRoot.amount_cents),
          cadence: dueRoot.cadence || 'monthly',
          due_day_of_month: String(dueRoot.due_day_of_month || '1'),
          due_weekday: String(dueRoot.due_weekday ?? '1'),
          due_month_of_year: String(dueRoot.due_month_of_year || '1'),
          grace_period_days: String(dueRoot.grace_period_days || '0'),
          starts_on: dueRoot.starts_on || '',
          ends_on: dueRoot.ends_on || '',
          due_scope: dueScopeFromRoles(enrolledRoles),
          enrolled_roles: enrolledRoles,
        })
      }
    } catch {
      setError('Unable to load this circle right now.')
    } finally {
      if (isRefresh) setRefreshing(false)
      else setLoading(false)
    }
  }, [circleId])

  useFocusEffect(
    useCallback(() => {
      loadManage(false)
    }, [loadManage])
  )

  const bucketKey = String(workspace?.product_bucket_key || '').trim()
  const templates = PAYMENT_TEMPLATES_BY_BUCKET[bucketKey] || []
  const activeItems = useMemo(() => paymentItems.filter((item) => !item?.support_fallback), [paymentItems])
  const permissions = workspace?.permissions || {}
  const approvals = workspace?.approvals || {}
  const approvalItems = Array.isArray(approvals?.items) ? approvals.items : []
  const memberDuesLookup = useMemo(() => buildMemberDuesLookup(members, dueObligations, duePlan), [members, dueObligations, duePlan])
  const maxWithdrawalThreshold = Math.max(Number(workspace?.governance_summary?.max_withdrawal_approval_threshold || 0), 0)
  const withdrawalThresholdOptions = useMemo(() => {
    const options = [{ value: '', label: 'Use recommended setting' }]
    for (let value = 1; value <= maxWithdrawalThreshold; value += 1) {
      options.push({
        value: String(value),
        label: value === 1 ? '1 approval' : `${value} approvals`,
      })
    }
    return options
  }, [maxWithdrawalThreshold])
  const canManage = Boolean(
    permissions.can_manage_settings ||
      permissions.can_manage_due_plan ||
      permissions.can_manage_members ||
      permissions.can_manage_governance
  )

  const handleTemplate = (template: Record<string, any>) => {
    if (template.disabled) return
    setNotice('')
    if (template.setup_type === 'recurring') {
      setSection('payment_items')
      setDuePlanForm((prev) => ({ ...prev, cadence: template.cadence || prev.cadence }))
      return
    }
    setActivityTemplate(template)
    setEditingActivityId('')
    setActivityForm({
      name: template.title,
      amount_ngn: '',
      deadline_at: '',
      contribution_frequency: template.contribution_frequency || 'one_time',
      payment_item_kind: activityKindForTemplate(template),
    })
  }

  const beginEditActivityItem = (item: Record<string, any>) => {
    setNotice('')
    setError('')
    setActivityTemplate(null)
    setEditingActivityId(String(item?.linked_reference_id || item?.activity_id || item?.id || ''))
    setActivityForm({
      name: item?.title || '',
      amount_ngn: toMajor(item?.amount_cents || item?.suggested_amount_cents || item?.target_amount_cents),
      deadline_at: item?.due_on ? String(item.due_on).slice(0, 10) : '',
      contribution_frequency: item?.contribution_frequency || 'one_time',
      payment_item_kind: item?.payment_item_kind || item?.item_type || 'fixed',
    })
  }

  const resetActivityForm = () => {
    setEditingActivityId('')
    setActivityTemplate(null)
    setActivityForm({ name: '', amount_ngn: '', deadline_at: '', contribution_frequency: 'one_time', payment_item_kind: 'fixed' })
  }

  const pickerTitle =
    pickerTarget === 'due_start'
      ? 'Dues start date'
      : pickerTarget === 'due_end'
        ? 'Dues end date'
        : 'Payment item deadline'

  const openDatePicker = useCallback((target: PickerTarget) => {
    if (!target) return
    const currentValue =
      target === 'due_start'
        ? duePlanForm.starts_on
        : target === 'due_end'
          ? duePlanForm.ends_on
          : activityForm.deadline_at
    setPickerDraftDate(parseStoredDate(String(currentValue || '')) || new Date())
    setPickerTarget(target)
  }, [activityForm.deadline_at, duePlanForm.ends_on, duePlanForm.starts_on])

  const closePicker = useCallback(() => setPickerTarget(null), [])

  const applyPickerDate = useCallback((selected: Date) => {
    const formatted = formatLocalDate(selected)
    if (pickerTarget === 'due_start') {
      setDuePlanForm((prev) => ({ ...prev, starts_on: formatted }))
    } else if (pickerTarget === 'due_end') {
      setDuePlanForm((prev) => ({ ...prev, ends_on: formatted }))
    } else if (pickerTarget === 'activity_deadline') {
      setActivityForm((prev) => ({ ...prev, deadline_at: formatted }))
    }
    setPickerTarget(null)
  }, [pickerTarget])

  const saveDuePlan = async () => {
    if (!circleId) return
    const amountCents = toMinor(duePlanForm.amount_ngn)
    if (!amountCents || amountCents <= 0) return setError('Enter a valid due amount.')
    const enrolledRoles =
      duePlanForm.due_scope === 'custom_roles'
        ? duePlanForm.enrolled_roles
        : rolesForDueScope(duePlanForm.due_scope)

    const payload: Record<string, any> = {
      amount_cents: amountCents,
      cadence: duePlanForm.cadence,
      grace_period_days: Number(duePlanForm.grace_period_days || 0),
      starts_on: duePlanForm.starts_on || null,
      ends_on: duePlanForm.ends_on || null,
      enrolled_roles: enrolledRoles,
    }
    if (duePlanForm.cadence === 'weekly') payload.due_weekday = Number(duePlanForm.due_weekday || 1)
    if (duePlanForm.cadence === 'monthly' || duePlanForm.cadence === 'yearly') payload.due_day_of_month = Number(duePlanForm.due_day_of_month || 1)
    if (duePlanForm.cadence === 'yearly') payload.due_month_of_year = Number(duePlanForm.due_month_of_year || 1)

    try {
      setSaving(true)
      setError('')
      const response = duePlan ? await updateCircleDuePlan(circleId, payload) : await upsertCircleDuePlan(circleId, payload)
      const root = response?.data || response
      setDuePlan(root)
      setNotice('Dues plan saved.')
    } catch (requestError: any) {
      setError(requestError?.response?.data?.errors?.join(', ') || requestError?.response?.data?.error || requestError?.message || 'Unable to save dues.')
    } finally {
      setSaving(false)
    }
  }

  const saveActivityItem = async () => {
    if (!circleId) return
    const amountCents = toMinor(activityForm.amount_ngn)
    if (!activityForm.name.trim()) return setError('Payment item name is required.')
    if (!amountCents || amountCents <= 0) return setError('Enter a valid amount or target.')

    try {
      setSaving(true)
      setError('')
      const payload: Record<string, any> = {
        name: activityForm.name.trim(),
        target_amount_cents: amountCents,
        contribution_frequency: activityForm.contribution_frequency,
        payment_item_kind: activityForm.payment_item_kind,
      }
      if (activityForm.deadline_at) payload.deadline_at = new Date(activityForm.deadline_at).toISOString()
      if (editingActivityId) {
        await updateCircleActivity(circleId, editingActivityId, payload)
      } else {
        await createCircleActivity(circleId, payload)
      }
      const refreshed = await getCirclePaymentItems(circleId)
      setPaymentItems(normalizePaymentItems(refreshed))
      setNotice(
        editingActivityId
          ? `${activityForm.name.trim()} updated.`
          : `${activityForm.name.trim()} added to other payment items.`
      )
      resetActivityForm()
    } catch (requestError: any) {
      setError(requestError?.response?.data?.errors?.join(', ') || requestError?.response?.data?.error || requestError?.message || 'Unable to save this payment item.')
    } finally {
      setSaving(false)
    }
  }

  const sendInvite = async () => {
    if (!circleId || !inviteEmail.trim()) return
    try {
      setSaving(true)
      setError('')
      await inviteCircleMember(circleId, { email: inviteEmail.trim(), role: 'member' })
      setNotice('Member invited.')
      setInviteEmail('')
    } catch (requestError: any) {
      setError(requestError?.response?.data?.errors?.join(', ') || requestError?.response?.data?.error || requestError?.message || 'Unable to invite member.')
    } finally {
      setSaving(false)
    }
  }

  const saveSettings = async () => {
    if (!circleId) return
    try {
      setSaving(true)
      setError('')
      await updateCircleSettings(circleId, {
        identity: {
          name: settingsForm.name,
          purpose: settingsForm.purpose,
          description: settingsForm.description,
          badge_label: settingsForm.badge_label,
        },
        governance: {
          governance_setup_completed: Boolean(settingsForm.governance_setup_completed),
          withdrawal_approval_threshold:
            settingsForm.withdrawal_approval_threshold === '' ? null : Number(settingsForm.withdrawal_approval_threshold),
        },
        privacy: {
          visibility: settingsForm.visibility,
        },
      })
      setNotice('Circle settings updated.')
    } catch (requestError: any) {
      setError(requestError?.response?.data?.errors?.join(', ') || requestError?.response?.data?.error || requestError?.message || 'Unable to update settings.')
    } finally {
      setSaving(false)
    }
  }

  const handleApprovalDecision = async (
    approvalRequestId: string | number,
    decision: 'approve' | 'reject'
  ) => {
    if (!circleId || !approvalRequestId) return
    try {
      setProcessingApprovalId(String(approvalRequestId))
      setError('')
      setNotice('')
      if (decision === 'approve') {
        await approveCircleApprovalRequest(circleId, approvalRequestId)
        setNotice('Withdrawal approved. Funds will be credited to the requester wallet.')
      } else {
        await rejectCircleApprovalRequest(circleId, approvalRequestId)
        setNotice('Withdrawal rejected.')
      }
      await loadManage(false)
    } catch (requestError: any) {
      setError(
        requestError?.response?.data?.message ||
          requestError?.response?.data?.error ||
          requestError?.message ||
          'Unable to update this withdrawal request.'
      )
    } finally {
      setProcessingApprovalId('')
    }
  }

  if (!circleId) {
    return <View className="flex-1 items-center justify-center bg-[#020712]"><Text className="text-sm text-red-300">Missing circle.</Text></View>
  }

  if (loading) {
    return <View className="flex-1 items-center justify-center bg-[#020712]"><ActivityIndicator color="#22d3ee" /></View>
  }

  if (error && !workspace) {
    return <View className="flex-1 items-center justify-center bg-[#020712] px-6"><Text className="text-center text-sm text-red-300">{error}</Text></View>
  }

  if (!workspace || !canManage) {
    return <View className="flex-1 items-center justify-center bg-[#020712] px-6"><Text className="text-center text-sm text-red-300">You do not have permission to manage this circle.</Text></View>
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <CircleShell
        circleId={String(circleId)}
        title={circleTitle(workspace)}
        roleLabel={getCircleRoleLabel(workspace)}
        bucketLabel={circleBucketLabel(workspace)}
        active="manage"
        onHome={() => replaceCircleWorkspaceSection(router, String(circleId), 'home')}
        onPay={() => replaceCircleWorkspaceSection(router, String(circleId), 'pay')}
        onManage={() => replaceCircleWorkspaceSection(router, String(circleId), 'manage')}
        onTimeline={() => replaceCircleWorkspaceSection(router, String(circleId), 'timeline')}
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 32, gap: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadManage(true)} />}
        >
          <View className="rounded-[28px] border border-gray-900 bg-[#050b1b] px-5 py-5">
            <Text className="text-[11px] uppercase tracking-[2px] text-gray-500">Manage</Text>
            <Text className="mt-2 text-xl font-semibold text-white">Configure what this group collects and who can operate it.</Text>
            <View className="mt-5 flex-row flex-wrap gap-3">
              <TouchableOpacity onPress={() => setSection('payment_items')} className={pillClass(section === 'payment_items')}><Text className="text-sm font-medium text-white">Payment Items</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => setSection('members')} className={pillClass(section === 'members')}><Text className="text-sm font-medium text-white">Members</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => setSection('governance')} className={pillClass(section === 'governance')}><Text className="text-sm font-medium text-white">Governance</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => setSection('settings')} className={pillClass(section === 'settings')}><Text className="text-sm font-medium text-white">Settings</Text></TouchableOpacity>
            </View>
          </View>

          {!!notice && <View className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-4"><Text className="text-sm text-emerald-200">{notice}</Text></View>}
          {!!error && <View className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-4"><Text className="text-sm text-rose-200">{error}</Text></View>}

          {section === 'payment_items' ? (
            <>
              <View className="rounded-[28px] border border-gray-900 bg-[#050b1b] px-5 py-5">
                <Text className="text-[11px] uppercase tracking-[2px] text-gray-500">Suggested Templates</Text>
                <Text className="mt-2 text-lg font-semibold text-white">Suggested for {circleBucketLabel(workspace) || 'this circle'}</Text>
                <View className="mt-4 gap-3">
                  {templates.map((template) => (
                    <View key={template.key} className="rounded-2xl border border-gray-900 bg-gray-950 px-4 py-4">
                      <View className="flex-row items-center justify-between gap-3">
                        <View className="flex-1">
                          <Text className="text-sm font-semibold text-white">{template.title}</Text>
                          <Text className="mt-1 text-xs text-gray-400">
                            {template.setup_type === 'recurring' ? 'Recurring payment item' : template.setup_type === 'fine' ? 'Assigned charge' : 'Collection payment item'}
                          </Text>
                        </View>
                        <TouchableOpacity
                          disabled={template.disabled}
                          onPress={() => handleTemplate(template)}
                          className={`rounded-xl border px-3 py-2 ${template.disabled ? 'border-gray-800' : 'border-gray-700'}`}
                        >
                          <Text className={`text-xs font-semibold ${template.disabled ? 'text-gray-500' : 'text-white'}`}>
                            {template.disabled ? 'Later' : template.setup_type === 'recurring' ? 'Configure' : 'Add item'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              </View>

              <View className="rounded-[28px] border border-gray-900 bg-[#050b1b] px-5 py-5">
                <Text className="text-[11px] uppercase tracking-[2px] text-gray-500">Active Payment Items</Text>
                <View className="mt-4 gap-3">
                  {activeItems.length === 0 ? (
                    <View className="rounded-2xl border border-dashed border-gray-800 px-4 py-4"><Text className="text-sm text-gray-400">No active payment items yet.</Text></View>
                  ) : (
                    activeItems.map((item) => (
                      <View key={String(item?.key || item?.id)} className="rounded-2xl border border-gray-900 bg-gray-950 px-4 py-4">
                        <View className="flex-row items-center justify-between gap-3">
                          <View className="flex-1">
                            <Text className="text-sm font-semibold text-white">{item?.title}</Text>
                            <Text className="mt-1 text-xs text-gray-400">{item?.linked_reference_type === 'CircleDuePlan' ? 'Dues plan' : item?.type === 'treasury_topup' ? 'Treasury top-up' : 'Other payment item'}</Text>
                          </View>
                          <View className="items-end">
                            <Text className="text-sm font-medium text-gray-200">{paymentItemAmount(item)}</Text>
                            {item?.linked_reference_type === 'CircleActivity' ? (
                              <TouchableOpacity onPress={() => beginEditActivityItem(item)} className="mt-2">
                                <Text className="text-xs font-semibold text-cyan-200">Edit item</Text>
                              </TouchableOpacity>
                            ) : null}
                          </View>
                        </View>
                      </View>
                    ))
                  )}
                </View>
              </View>

              <View className="rounded-[28px] border border-gray-900 bg-[#050b1b] px-5 py-5">
                <Text className="text-[11px] uppercase tracking-[2px] text-gray-500">Dues Plan</Text>
                <Text className="mt-2 text-lg font-semibold text-white">{duePlan ? 'Edit recurring dues' : 'Set up recurring dues'}</Text>
                {activityTemplate ? (
                  <View className="mt-4 rounded-2xl border border-gray-900 bg-gray-950 px-4 py-4">
                    <View className="flex-row items-center justify-between gap-3">
                      <View className="flex-1">
                        <Text className="text-sm font-semibold text-white">{activityTemplate.title}</Text>
                        <Text className="mt-1 text-xs text-gray-400">{activitySetupTone(activityTemplate)}</Text>
                      </View>
                      <View className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1">
                        <Text className="text-[11px] font-semibold uppercase tracking-[1.5px] text-cyan-200">Template</Text>
                      </View>
                    </View>
                  </View>
                ) : null}
                {editingActivityId ? (
                  <View className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-4">
                    <View className="flex-row items-center justify-between gap-3">
                      <View className="flex-1">
                        <Text className="text-sm font-semibold text-white">Editing active payment item</Text>
                        <Text className="mt-1 text-xs text-amber-100/80">Changes will update the live item members see in Circle payments.</Text>
                      </View>
                      <View className="rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1">
                        <Text className="text-[11px] font-semibold uppercase tracking-[1.5px] text-amber-200">Live</Text>
                      </View>
                    </View>
                  </View>
                ) : null}
                <View className="mt-4 gap-4">
                  <TextInput value={duePlanForm.amount_ngn} onChangeText={(value) => setDuePlanForm((prev) => ({ ...prev, amount_ngn: value }))} placeholder="Amount (NGN)" placeholderTextColor="#64748b" className={inputClass} keyboardType="numeric" />
                  <FormSelect
                    label="Frequency"
                    selectedValue={duePlanForm.cadence}
                    onValueChange={(value: string) => setDuePlanForm((prev) => ({ ...prev, cadence: String(value || 'monthly') }))}
                    options={CADENCE_OPTIONS}
                    placeholder="Select frequency"
                  />
                  <View className="rounded-2xl border border-gray-900 bg-gray-950 px-4 py-4">
                    <Text className="text-sm font-medium text-white">Members can pay multiple periods</Text>
                    <Text className="mt-1 text-xs text-gray-400">
                      Checkout supports paying one or more periods at a time. Set one clear frequency and due date here.
                    </Text>
                  </View>
                  <View className="flex-row flex-wrap gap-2">
                    {DUE_SCOPE_OPTIONS.map((option) => (
                      <TouchableOpacity
                        key={option.value}
                        onPress={() => setDuePlanForm((prev) => ({
                          ...prev,
                          due_scope: option.value,
                          enrolled_roles: option.value === 'custom_roles' ? prev.enrolled_roles : rolesForDueScope(option.value),
                        }))}
                        className={pillClass(duePlanForm.due_scope === option.value)}
                      >
                        <Text className="text-xs font-semibold text-white">{option.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <View className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 px-4 py-4">
                    <Text className="text-sm font-medium text-white">Everyone pays by default</Text>
                    <Text className="mt-1 text-xs text-gray-300">
                      New dues plans include the creator, admins, treasurers, and members unless you choose a narrower scope.
                    </Text>
                    <Text className="mt-1 text-xs text-gray-400">
                      New members start owing from when they join the Circle. They are not back-billed for periods before they joined.
                    </Text>
                  </View>
                  {duePlanForm.due_scope === 'custom_roles' ? (
                    <View className="flex-row flex-wrap gap-2">
                      {DUE_ROLE_OPTIONS.map((role) => {
                        const active = duePlanForm.enrolled_roles.includes(role.value)
                        return (
                          <TouchableOpacity
                            key={role.value}
                            onPress={() =>
                              setDuePlanForm((prev) => ({
                                ...prev,
                                enrolled_roles: active
                                  ? prev.enrolled_roles.filter((value) => value !== role.value)
                                  : [...prev.enrolled_roles, role.value],
                              }))
                            }
                            className={pillClass(active)}
                          >
                            <Text className="text-xs font-semibold text-white">{role.label}</Text>
                          </TouchableOpacity>
                        )
                      })}
                    </View>
                  ) : null}
                  <FormSelect
                    label={duePlanForm.cadence === 'weekly' ? 'Due weekday' : 'Due day'}
                    selectedValue={duePlanForm.cadence === 'weekly' ? duePlanForm.due_weekday : duePlanForm.due_day_of_month}
                    onValueChange={(value: string) =>
                      setDuePlanForm((prev) => ({
                        ...prev,
                        ...(prev.cadence === 'weekly'
                          ? { due_weekday: String(value || '1') }
                          : { due_day_of_month: String(value || '1') }),
                      }))
                    }
                    options={duePlanForm.cadence === 'weekly' ? WEEKDAY_OPTIONS : MONTH_DAY_OPTIONS}
                    placeholder={duePlanForm.cadence === 'weekly' ? 'Select due weekday' : 'Select due day'}
                  />
                  {duePlanForm.cadence === 'yearly' ? (
                    <FormSelect
                      label="Due month"
                      selectedValue={duePlanForm.due_month_of_year}
                      onValueChange={(value: string) => setDuePlanForm((prev) => ({ ...prev, due_month_of_year: String(value || '1') }))}
                      options={YEAR_MONTH_OPTIONS}
                      placeholder="Select due month"
                    />
                  ) : null}
                  <FormSelect
                    label="Grace period"
                    selectedValue={duePlanForm.grace_period_days}
                    onValueChange={(value: string) => setDuePlanForm((prev) => ({ ...prev, grace_period_days: String(value || '0') }))}
                    options={GRACE_PERIOD_OPTIONS}
                    placeholder="Select grace period"
                  />
                  <TouchableOpacity onPress={() => openDatePicker('due_start')} className={inputClass}>
                    <Text className="mb-2 text-sm text-white">Start date</Text>
                    <Text className={duePlanForm.starts_on ? 'text-sm text-white' : 'text-sm text-gray-400'}>
                      {formatDisplayDate(duePlanForm.starts_on) || 'Select dues start date'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => openDatePicker('due_end')} className={inputClass}>
                    <Text className="mb-2 text-sm text-white">End date</Text>
                    <Text className={duePlanForm.ends_on ? 'text-sm text-white' : 'text-sm text-gray-400'}>
                      {formatDisplayDate(duePlanForm.ends_on) || 'Select dues end date'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={saveDuePlan} disabled={saving} className="rounded-2xl bg-cyan-400 px-4 py-4">
                    <Text className="text-center text-sm font-semibold text-slate-950">{saving ? 'Saving…' : duePlan ? 'Update dues plan' : 'Save dues plan'}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View className="rounded-[28px] border border-gray-900 bg-[#050b1b] px-5 py-5">
                <Text className="text-[11px] uppercase tracking-[2px] text-gray-500">Other Payment Items</Text>
                <Text className="mt-2 text-lg font-semibold text-white">{editingActivityId ? `Edit ${activityForm.name || 'payment item'}` : activityTemplate ? `Configure ${activityTemplate.title}` : 'Create other payment item'}</Text>
                  <View className="mt-4 gap-4">
                    <TextInput value={activityForm.name} onChangeText={(value) => setActivityForm((prev) => ({ ...prev, name: value }))} placeholder="Payment item name" placeholderTextColor="#64748b" className={inputClass} />
                  <View>
                    <Text className="mb-2 text-sm text-gray-300">Item type</Text>
                    <View className="flex-row flex-wrap gap-2">
                      {[
                        { value: 'fixed', label: 'Fixed' },
                        { value: 'open', label: 'Open' },
                        { value: 'quantity', label: 'Quantity' },
                      ].map((option) => {
                        const active = activityForm.payment_item_kind === option.value
                        return (
                          <TouchableOpacity
                            key={option.value}
                            onPress={() => setActivityForm((prev) => ({ ...prev, payment_item_kind: option.value }))}
                            className={pillClass(active)}
                          >
                            <Text className="text-xs font-semibold text-white">{option.label}</Text>
                          </TouchableOpacity>
                        )
                      })}
                    </View>
                  </View>
                  <TextInput value={activityForm.amount_ngn} onChangeText={(value) => setActivityForm((prev) => ({ ...prev, amount_ngn: value }))} placeholder={activityAmountLabel(activityForm.payment_item_kind)} placeholderTextColor="#64748b" className={inputClass} keyboardType="numeric" />
                  <FormSelect
                    label="Availability"
                    selectedValue={activityForm.contribution_frequency}
                    onValueChange={(value: string) => setActivityForm((prev) => ({ ...prev, contribution_frequency: String(value || 'one_time') }))}
                    options={CONTRIBUTION_FREQUENCY_OPTIONS}
                    placeholder="Select availability"
                  />
                  <TouchableOpacity onPress={() => openDatePicker('activity_deadline')} className={inputClass}>
                    <Text className="mb-2 text-sm text-white">Due / close date</Text>
                    <Text className={activityForm.deadline_at ? 'text-sm text-white' : 'text-sm text-gray-400'}>
                      {formatDisplayDate(activityForm.deadline_at) || 'Select due or close date'}
                    </Text>
                  </TouchableOpacity>
                  <Text className="text-xs text-gray-500">Leave the date blank to keep this item available until you close it.</Text>
                  <View className="rounded-2xl border border-gray-900 bg-gray-950 px-4 py-4">
                    <View className="flex-row items-center justify-between gap-3">
                      <Text className="text-[11px] uppercase tracking-[1.5px] text-gray-500">How members will see it</Text>
                      <View className="rounded-full border border-gray-800 px-3 py-1">
                        <Text className="text-[11px] font-semibold uppercase tracking-[1.5px] text-gray-300">{activityAvailabilityLabel(activityForm.contribution_frequency)}</Text>
                      </View>
                    </View>
                    <Text className="mt-3 text-sm text-gray-300">Members will see this in Circle payments after you save it.</Text>
                  </View>
                  <TouchableOpacity onPress={saveActivityItem} disabled={saving} className="rounded-2xl bg-cyan-400 px-4 py-4">
                    <Text className="text-center text-sm font-semibold text-slate-950">{saving ? 'Saving…' : editingActivityId ? 'Update payment item' : 'Save payment item'}</Text>
                  </TouchableOpacity>
                  {activityTemplate || editingActivityId ? (
                    <TouchableOpacity onPress={resetActivityForm} className="rounded-2xl border border-gray-800 px-4 py-4">
                      <Text className="text-center text-sm font-semibold text-white">Cancel</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            </>
          ) : null}

          {section === 'members' ? (
            <>
              <View className="rounded-[28px] border border-gray-900 bg-[#050b1b] px-5 py-5">
                <Text className="text-[11px] uppercase tracking-[2px] text-gray-500">Invite Member</Text>
                <View className="mt-4 gap-4">
                  <TextInput value={inviteEmail} onChangeText={setInviteEmail} placeholder="Email" placeholderTextColor="#64748b" className={inputClass} autoCapitalize="none" />
                  <TouchableOpacity onPress={sendInvite} disabled={saving} className="rounded-2xl bg-cyan-400 px-4 py-4">
                    <Text className="text-center text-sm font-semibold text-slate-950">{saving ? 'Sending…' : 'Invite member'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <View className="rounded-[28px] border border-gray-900 bg-[#050b1b] px-5 py-5">
                <Text className="text-[11px] uppercase tracking-[2px] text-gray-500">Members</Text>
                <View className="mt-4 gap-3">
                  {members.length === 0 ? (
                    <View className="rounded-2xl border border-dashed border-gray-800 px-4 py-4"><Text className="text-sm text-gray-400">No member data available yet.</Text></View>
                  ) : (
                    members.map((member, index) => {
                      const dues = memberDuesLookup[String(member?.id || member?.user?.id || '')]
                      return (
                        <View key={String(member?.id || index)} className="rounded-2xl border border-gray-900 bg-gray-950 px-4 py-4">
                          <View className="flex-row items-start justify-between gap-3">
                            <View className="flex-1">
                              <Text className="text-sm font-semibold text-white">{member?.display_name || member?.user?.display_name || member?.user?.email || 'Member'}</Text>
                              <Text className="mt-1 text-xs text-gray-400">{String(member?.role || member?.membership_role || 'member').replace(/_/g, ' ')}</Text>
                              {dues ? (
                                <Text className="mt-2 text-xs text-gray-500">{dues.periodsPaidLabel} - {moneyFormat(Number(dues.outstandingAmountCents || 0) / 100)} outstanding</Text>
                              ) : duePlan ? (
                                <Text className="mt-2 text-xs text-gray-500">No dues status for this cycle.</Text>
                              ) : null}
                            </View>
                            {dues ? (
                              <View className={`rounded-full px-3 py-1 ${dues.statusKey === 'paid' ? 'border border-emerald-400/20 bg-emerald-400/10' : 'border border-amber-400/20 bg-amber-400/10'}`}>
                                <Text className={`text-[10px] font-semibold uppercase tracking-[1.5px] ${dues.statusKey === 'paid' ? 'text-emerald-100' : 'text-amber-100'}`}>
                                  {dues.statusLabel}
                                </Text>
                              </View>
                            ) : null}
                          </View>
                        </View>
                      )
                    })
                  )}
                </View>
              </View>
            </>
          ) : null}

          {section === 'governance' ? (
            <>
              <View className="rounded-[28px] border border-gray-900 bg-[#050b1b] px-5 py-5">
                <Text className="text-[11px] uppercase tracking-[2px] text-gray-500">Governance</Text>
                <View className="mt-4 gap-3">
                  <View className="rounded-2xl border border-gray-900 bg-gray-950 px-4 py-4">
                    <Text className="text-sm text-gray-400">Withdrawal approval threshold</Text>
                    <Text className="mt-1 text-sm font-semibold text-white">{settingsForm.withdrawal_approval_threshold || 'Not set'}</Text>
                  </View>
                  <View className="rounded-2xl border border-gray-900 bg-gray-950 px-4 py-4">
                    <Text className="text-sm text-gray-400">Governance setup</Text>
                    <Text className="mt-1 text-sm font-semibold text-white">{settingsForm.governance_setup_completed ? 'Completed' : 'Pending'}</Text>
                  </View>
                </View>
              </View>
              <View className="rounded-[28px] border border-gray-900 bg-[#050b1b] px-5 py-5">
                <Text className="text-[11px] uppercase tracking-[2px] text-gray-500">Withdrawal Queue</Text>
                <Text className="mt-3 text-sm text-gray-400">
                  Approved withdrawals land in the requester wallet, then the requester can use their personal bank transfer flow.
                </Text>
                <View className="mt-4 gap-3">
                  {approvalItems.length === 0 ? (
                    <View className="rounded-2xl border border-dashed border-gray-800 px-4 py-4">
                      <Text className="text-sm text-gray-400">No pending withdrawal approvals right now.</Text>
                    </View>
                  ) : (
                    approvalItems.map((item: Record<string, any>) => {
                      const availableActions = item?.available_actions || {}
                      const acting = processingApprovalId === String(item?.id || '')
                      const amountNgn = Number(item?.amount_cents || 0) / 100
                      return (
                        <View key={String(item?.id)} className="rounded-2xl border border-gray-900 bg-gray-950 px-4 py-4">
                          <View className="flex-row items-start justify-between gap-3">
                            <View className="flex-1">
                              <Text className="text-sm font-semibold text-white">
                                {item?.initiated_by?.display_name || 'Requester'} requested NGN {amountNgn.toLocaleString()}
                              </Text>
                              <Text className="mt-1 text-xs text-gray-400">
                                {item?.remaining_approvals || 0} approval{Number(item?.remaining_approvals || 0) === 1 ? '' : 's'} remaining
                              </Text>
                              {item?.note ? (
                                <Text className="mt-2 text-sm text-gray-300">{String(item.note)}</Text>
                              ) : null}
                              <Text className="mt-2 text-xs text-cyan-200">{String(item?.settlement_message || '')}</Text>
                              {item?.created_at ? (
                                <Text className="mt-2 text-[11px] text-gray-500">
                                  {new Date(String(item.created_at)).toLocaleString()}
                                </Text>
                              ) : null}
                            </View>
                            <View className="rounded-full border border-gray-800 px-3 py-1">
                              <Text className="text-[11px] font-semibold uppercase tracking-[1.5px] text-gray-300">
                                {String(item?.lifecycle_state || 'pending_approval')}
                              </Text>
                            </View>
                          </View>
                          {availableActions?.can_approve || availableActions?.can_reject ? (
                            <View className="mt-4 flex-row gap-3">
                              <TouchableOpacity
                                disabled={acting || !availableActions?.can_approve}
                                onPress={() => handleApprovalDecision(item.id, 'approve')}
                                className={`flex-1 rounded-2xl px-4 py-4 ${acting || !availableActions?.can_approve ? 'bg-gray-800' : 'bg-cyan-400'}`}
                              >
                                <Text className={`text-center text-sm font-semibold ${acting || !availableActions?.can_approve ? 'text-gray-500' : 'text-slate-950'}`}>
                                  {acting ? 'Updating…' : 'Approve'}
                                </Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                disabled={acting || !availableActions?.can_reject}
                                onPress={() => handleApprovalDecision(item.id, 'reject')}
                                className="flex-1 rounded-2xl border border-gray-800 px-4 py-4"
                              >
                                <Text className={`text-center text-sm font-semibold ${acting || !availableActions?.can_reject ? 'text-gray-500' : 'text-white'}`}>
                                  Reject
                                </Text>
                              </TouchableOpacity>
                            </View>
                          ) : (
                            <View className="mt-4 rounded-2xl border border-gray-900 bg-[#08101f] px-4 py-4">
                              <Text className="text-xs text-gray-400">
                                {availableActions?.self_action_blocked
                                  ? 'You cannot approve your own withdrawal request.'
                                  : 'This request is read-only for your role right now.'}
                              </Text>
                            </View>
                          )}
                        </View>
                      )
                    })
                  )}
                </View>
              </View>
              <TouchableOpacity onPress={() => router.push(`/circles/${circleId}/legacy` as any)} className="rounded-2xl border border-gray-800 px-4 py-4">
                <Text className="text-center text-sm font-medium text-gray-300">Open legacy governance</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push(`/circles/${circleId}/treasury` as any)} className="rounded-2xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-4">
                <Text className="text-center text-sm font-semibold text-cyan-100">Open Circle Treasury</Text>
              </TouchableOpacity>
            </>
          ) : null}

          {section === 'settings' ? (
            <View className="rounded-[28px] border border-gray-900 bg-[#050b1b] px-5 py-5">
              <Text className="text-[11px] uppercase tracking-[2px] text-gray-500">Settings</Text>
              <View className="mt-4 gap-4">
                <TextInput value={settingsForm.name} onChangeText={(value) => setSettingsForm((prev) => ({ ...prev, name: value }))} placeholder="Circle name" placeholderTextColor="#64748b" className={inputClass} />
                <TextInput value={settingsForm.badge_label} onChangeText={(value) => setSettingsForm((prev) => ({ ...prev, badge_label: value }))} placeholder="Badge label" placeholderTextColor="#64748b" className={inputClass} />
                <TextInput value={settingsForm.purpose} onChangeText={(value) => setSettingsForm((prev) => ({ ...prev, purpose: value }))} placeholder="Purpose" placeholderTextColor="#64748b" className={inputClass} />
                <TextInput value={settingsForm.description} onChangeText={(value) => setSettingsForm((prev) => ({ ...prev, description: value }))} placeholder="Description" placeholderTextColor="#64748b" className={inputClass} multiline />
                <FormSelect
                  label="Visibility"
                  selectedValue={settingsForm.visibility}
                  onValueChange={(value: string) => setSettingsForm((prev) => ({ ...prev, visibility: String(value || 'private') }))}
                  options={VISIBILITY_OPTIONS}
                  placeholder="Select visibility"
                />
                {maxWithdrawalThreshold > 0 ? (
                  <FormSelect
                    label="Withdrawal approval threshold"
                    selectedValue={settingsForm.withdrawal_approval_threshold}
                    onValueChange={(value: string) => setSettingsForm((prev) => ({ ...prev, withdrawal_approval_threshold: String(value || '') }))}
                    options={withdrawalThresholdOptions}
                    placeholder="Select threshold"
                  />
                ) : (
                  <View className="rounded-2xl border border-gray-900 bg-gray-950 px-4 py-4">
                    <Text className="text-sm text-gray-400">
                      Add more than one manager before setting a withdrawal approval threshold.
                    </Text>
                  </View>
                )}
                <TouchableOpacity
                  onPress={() => setSettingsForm((prev) => ({ ...prev, governance_setup_completed: !prev.governance_setup_completed }))}
                  className={pillClass(Boolean(settingsForm.governance_setup_completed))}
                >
                  <Text className="text-center text-sm font-medium text-white">
                    {settingsForm.governance_setup_completed ? 'Governance setup completed' : 'Mark governance as completed'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={saveSettings} disabled={saving} className="rounded-2xl bg-cyan-400 px-4 py-4">
                  <Text className="text-center text-sm font-semibold text-slate-950">{saving ? 'Saving…' : 'Save settings'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
        </ScrollView>
        {pickerTarget && Platform.OS === 'ios' ? (
          <Modal visible transparent animationType="slide" onRequestClose={closePicker}>
            <Pressable onPress={closePicker} className="flex-1 justify-end bg-black/50">
              <Pressable onPress={() => {}} className="rounded-t-[28px] border border-white/8 bg-[#0f172a] px-4 pt-4 pb-6">
                <Text className="text-center text-base font-semibold text-white">{pickerTitle}</Text>
                <Text className="mt-2 text-center text-xs text-slate-400">Choose the date, then confirm.</Text>
                <View className="mt-4 rounded-2xl border border-gray-800 bg-gray-950/50 px-3 py-2">
                  <DateTimePicker
                    value={pickerDraftDate}
                    mode="date"
                    display="spinner"
                    onChange={(_, selected) => {
                      if (selected) setPickerDraftDate(selected)
                    }}
                  />
                </View>
                <View className="mt-4 flex-row gap-3">
                  <TouchableOpacity onPress={closePicker} className="flex-1 items-center rounded-2xl border border-gray-700 px-4 py-4">
                    <Text className="text-sm font-semibold text-white">Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => applyPickerDate(pickerDraftDate)} className="flex-1 items-center rounded-2xl bg-[#22d3ee] px-4 py-4">
                    <Text className="text-sm font-semibold text-slate-950">Use date</Text>
                  </TouchableOpacity>
                </View>
              </Pressable>
            </Pressable>
          </Modal>
        ) : null}
        {pickerTarget && Platform.OS === 'android' ? (
          <DateTimePicker
            value={pickerDraftDate}
            mode="date"
            display="default"
            onChange={(_, selected) => {
              if (selected) applyPickerDate(selected)
              else closePicker()
            }}
          />
        ) : null}
      </CircleShell>
    </>
  )
}

export default CircleManageScreen
