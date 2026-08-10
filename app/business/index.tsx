import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { RefreshControl, Text, TouchableOpacity, View } from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { Ionicons } from '@expo/vector-icons'
import { Image } from 'react-native'
import { useRouter } from 'expo-router'
import { useFocusEffect } from '@react-navigation/native'
import ScreenContainer from '@/components/ScreenContainer'
import {
  createBusinessProvisioning,
  getBusinessAccount,
  getBusinessApprovalSummary,
  getBusinessEntities,
  getBusinessEntity,
  getBusinessMemberships,
  getBusinessOnboarding,
  getBusinessTransactions,
  getBusinessWallet,
} from '@/api/business'
import { listCircles } from '@/api/circles'
import { buildApiErrorMessage } from '@/utils/apiErrorMessage'
import { useActiveAccount } from '@/services/useActiveAccount'
import { log } from '@/utils/logger'
import WorkspaceSwitcherModal, { WorkspaceCircle } from '@/components/workspace/WorkspaceSwitcherModal'
import { icons } from '@/constants/icons'
import {
  BusinessControlsCard,
  BusinessDashboardSkeleton,
  BusinessHeroCard,
  BusinessRecentActivity,
  BusinessSetupBanner,
} from '@/components/business/BusinessDashboard'
import { resolveTransferLifecycle } from '@/utils/transferLifecycle'
/* eslint-disable @typescript-eslint/no-explicit-any */

type BusinessAccountItem = { id: string; name?: string; status?: string; current_user_role?: string }

type BusinessActivityRow = {
  id: string
  title: string
  subtitle?: string
  amountLabel?: string
  signedAmountLabel?: string
  statusLabel?: string
  timeLabel?: string
  tone?: 'success' | 'pending' | 'failed' | 'info'
  reference?: string
}

const formatNgn = (value: any) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 2 }).format(Number(value || 0))

const formatCompactAmount = (value: any) => {
  const amount = Number(value || 0)
  if (!Number.isFinite(amount)) return '0'
  return new Intl.NumberFormat('en-NG', { maximumFractionDigits: 0 }).format(Math.abs(Math.round(amount)))
}

const formatRole = (value: string, fallback = 'Member') =>
  String(value || fallback).replace(/_/g, ' ').replace(/\b\w/g, (match) => match.toUpperCase())

const formatRelativeTime = (value?: string) => {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  const diffMs = Date.now() - parsed.getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

const parseRows = (response: any) => {
  const payload = response?.data?.data ?? response?.data ?? response
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.results)) return payload.results
  if (Array.isArray(payload?.memberships)) return payload.memberships
  if (Array.isArray(payload?.transactions)) return payload.transactions
  return []
}

const extractTransactions = (response: any) => {
  const payload = response?.data?.data ?? response?.data ?? response
  const list = payload?.items ?? payload?.transactions ?? payload?.data ?? payload?.results ?? payload?.records ?? payload
  return Array.isArray(list) ? list : []
}

const normalizeDirection = (item: Record<string, any>) => {
  const explicit =
    String(
      item?.meta?.transaction_direction ||
      item?.meta?.direction ||
      item?.direction ||
      item?.transaction_type ||
      item?.meta?.transaction_type ||
      ''
    ).toLowerCase()
  if (['outbound', 'outflow', 'debit', 'withdrawal'].some((part) => explicit.includes(part))) return 'outflow'
  if (['inbound', 'inflow', 'credit', 'deposit'].some((part) => explicit.includes(part))) return 'inflow'

  const raw = String(item?.label || item?.kind || item?.status || '').toLowerCase()
  if (['in', 'inflow', 'credit', 'deposit', 'funding', 'received'].some((part) => raw.includes(part))) return 'inflow'
  if (['out', 'outflow', 'debit', 'withdraw', 'transfer', 'payout', 'payment', 'sent'].some((part) => raw.includes(part))) return 'outflow'
  return 'unknown'
}

const toAmount = (item: Record<string, any>) => {
  if (item?.amount_cents !== undefined && item?.amount_cents !== null) {
    const centsValue = Number(item.amount_cents)
    return Number.isFinite(centsValue) ? centsValue / 100 : 0
  }
  const raw =
    item?.display_total ??
    item?.display_amount ??
    item?.amount ??
    item?.value_amount ??
    item?.meta?.amount ??
    0
  const value = Number(raw)
  return Number.isFinite(value) ? value : 0
}

const toDate = (value?: any) => {
  const parsed = new Date(String(value || ''))
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const isSameDay = (left?: Date | null, right?: Date | null) => {
  if (!left || !right) return false
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate()
}

const isSameMonth = (left?: Date | null, right?: Date | null) => {
  if (!left || !right) return false
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth()
}

const activityTone = (item: Record<string, any>) => {
  const lifecycle = resolveTransferLifecycle({ lifecycle_state: item?.lifecycle_state, status: item?.status, display_message: item?.display_message })
  if (lifecycle.isFailure) return 'failed'
  if (lifecycle.isSuccess) return 'success'
  const direction = normalizeDirection(item)
  if (direction === 'inflow') return 'success'
  return 'pending'
}

const activityTitle = (item: Record<string, any>) => {
  const amount = formatCompactAmount(toAmount(item))
  const direction = normalizeDirection(item)
  if (amount !== '0') {
    return direction === 'outflow' ? `${amount} sent` : `${amount} received`
  }
  const label = String(item?.label || item?.title || item?.text || item?.message || '').trim()
  if (label) return label
  if (direction === 'inflow') return 'Received funds'
  if (direction === 'outflow') return 'Sent funds'
  return 'Business activity'
}

const activitySubtitle = (item: Record<string, any>) => {
  if (normalizeDirection(item) === 'inflow') return 'Incoming bank transfer'
  if (normalizeDirection(item) === 'outflow') return 'Outgoing business payment'
  return 'Business activity'
}

const activityAmountLabel = (item: Record<string, any>) => {
  const amount = toAmount(item)
  if (!amount) return ''
  return `${normalizeDirection(item) === 'outflow' ? '-' : '+'}NGN ${formatCompactAmount(amount)}`
}

const activityStatusLabel = (item: Record<string, any>) => {
  const lifecycle = resolveTransferLifecycle({ lifecycle_state: item?.lifecycle_state, status: item?.status, display_message: item?.display_message })
  if (lifecycle.isFailure) return 'Failed'
  if (lifecycle.isSuccess) return 'Successful'
  if (String(item?.status || '').toLowerCase() === 'pending') return 'Pending'
  return 'Pending'
}

const buildActivityRows = (transactions: Record<string, any>[]) =>
  [...transactions]
    .sort((a, b) => new Date(String(b?.created_at || b?.updated_at || b?.occurred_at || 0)).getTime() - new Date(String(a?.created_at || a?.updated_at || a?.occurred_at || 0)).getTime())
    .slice(0, 5)
    .map((item) => {
      const reference = String(item?.meta?.transfer_reference || item?.reference || item?.id || '').trim()
      const amount = toAmount(item)
      const direction = normalizeDirection(item)
      const amountText = amount ? `${formatCompactAmount(amount)} ${direction === 'outflow' ? 'sent' : 'received'}` : activityTitle(item)
      const row: BusinessActivityRow = {
        id: String(item?.id || reference || Math.random().toString(36).slice(2)),
        title: amountText,
        subtitle: activitySubtitle(item),
        amountLabel: activityAmountLabel(item),
        statusLabel: activityStatusLabel(item),
        timeLabel: formatRelativeTime(item?.created_at || item?.updated_at || item?.occurred_at),
        tone: activityTone(item),
        reference,
      }
      return row
    })

const formatStatusLabel = (status: string, isLive: boolean, canActivate: boolean, journeyStage: string) => {
  if (isLive) return 'Live account'
  if (journeyStage === 'business_banking_provisioning') return 'Activating business banking'
  if (journeyStage === 'provisioning_reconciliation_required') return 'Account setup confirmation'
  if (canActivate) return 'Verified business'
  if (String(status || '').toLowerCase() === 'under_review') return 'Pending verification'
  return 'Action required'
}

const journeyTone = (stage: string) => {
  if (['business_banking_live', 'ready_for_activation'].includes(String(stage || ''))) return 'emerald'
  if (String(stage || '') === 'verification_in_progress') return 'sky'
  return 'amber'
}

const nextActionLabel = (action: string, fallback: string) => {
  switch (String(action || '')) {
    case 'activate_business_account':
      return 'Activate business banking'
    case 'refresh_activation_status':
      return 'Refresh activation status'
    case 'check_activation_status':
      return 'Check activation status'
    case 'track_verification':
      return 'View verification'
    case 'submit_for_verification':
      return 'Start verification'
    case 'upload_provider_documents':
      return 'Upload requested documents'
    case 'add_signatory':
      return 'Continue setup'
    case 'complete_contact_details':
      return 'Add contact details'
    case 'complete_business_details':
      return 'Complete business details'
    case 'fix_and_resubmit':
      return 'Review and correct'
    case 'review_restriction':
      return 'Review restriction'
    case 'operate_account':
      return 'Open business dashboard'
    default:
      return fallback || 'Continue business setup'
  }
}

const setupStageCopy = ({ isLive, canActivate, businessStatus, missingProfileFields, missingSignatoryRequirements, journey }: any) => {
  const stage = String(journey?.stage || '')
  if (stage) {
    switch (stage) {
      case 'ready_for_verification':
        return { stage: 'Business verification', nextTitle: 'Ready to begin', nextBody: 'Your business setup is complete. Start verification when you are ready.', tone: 'amber' as const }
      case 'verification_in_progress':
        return { stage: 'Business verification', nextTitle: 'Verification in review', nextBody: 'Your business has been submitted and is being reviewed.', tone: 'sky' as const }
      case 'provider_documents_required':
        return { stage: 'Business verification', nextTitle: 'Documents needed', nextBody: 'Upload the documents requested during verification.', tone: 'amber' as const }
      case 'verification_rejected':
        return { stage: 'Business verification', nextTitle: 'Action required', nextBody: 'Review the requested corrections and update the business information.', tone: 'amber' as const }
      case 'ready_for_activation':
        return { stage: 'Business verification', nextTitle: 'Business verified', nextBody: 'Verification is complete. Continue to activate business banking.', tone: 'emerald' as const }
      case 'business_banking_provisioning':
        return { stage: 'Business banking', nextTitle: 'Activating business banking', nextBody: 'Your business account is being set up.', tone: 'sky' as const }
      case 'provisioning_reconciliation_required':
        return { stage: 'Business banking', nextTitle: 'We’re confirming your account setup', nextBody: 'Your business account setup is being confirmed.', tone: 'sky' as const }
      case 'business_banking_live':
        return { stage: 'Business verification', nextTitle: 'Verified', nextBody: 'Business banking is live.', tone: 'emerald' as const }
      case 'business_restricted':
        return { stage: 'Business verification', nextTitle: 'Review required', nextBody: 'Review the verification status before continuing.', tone: 'amber' as const }
      default:
        return { stage: String(journey?.title || (isLive ? 'Business banking is live' : 'Business setup')), nextTitle: String(journey?.title || 'Business setup'), nextBody: String(journey?.body || 'Complete the current requirement and continue directly into the next step.'), tone: journeyTone(stage) }
    }
  }
  if (isLive) return { stage: 'Business banking is live', nextTitle: 'Start operating the account', nextBody: 'Fund the account, configure team access, and begin company payments.', tone: 'emerald' }
  if (canActivate) return { stage: 'Business verified', nextTitle: 'Activate business current account', nextBody: 'Verification is complete. Activate the business current account when you are ready.', tone: 'amber' }
  if (String(businessStatus || '').toLowerCase() === 'under_review') return { stage: 'Verification in progress', nextTitle: 'Track verification review', nextBody: 'Your business has already been submitted. Open the verification screen only when you need to refresh status or respond to a request.', tone: 'sky' }
  if (missingProfileFields.some((field: string) => ['legal_name', 'business_type', 'registration_number', 'date_of_registration', 'category', 'anchor_industry'].includes(String(field)))) return { stage: 'Business profile incomplete', nextTitle: 'Complete company details', nextBody: 'Add the registered company information required before verification can start.', tone: 'amber' }
  if (missingProfileFields.some((field: string) => ['contact_email', 'contact_phone', 'address_line_1', 'city', 'state', 'country', 'registered_address_line_1', 'registered_city', 'registered_state', 'registered_country'].includes(String(field)))) return { stage: 'Contact information incomplete', nextTitle: 'Add contact and registered address details', nextBody: 'Add the business contact and registered address used during verification.', tone: 'amber' }
  if (missingSignatoryRequirements.length > 0) return { stage: 'Business setup', nextTitle: 'Business representatives need attention', nextBody: 'Add the owners, directors or authorised signatories associated with this business.', tone: 'amber' }
  return { stage: 'Business verification', nextTitle: 'Open business verification', nextBody: 'Review the current verification status and next action.', tone: 'amber' }
}

const emitBusinessLifecycleEvent = (event: string, extra: Record<string, unknown> = {}) => {
  log('[BUSINESS_FLOW]', { event, ...extra })
}

const BusinessIndexScreen = () => {
  const {
    activeAccount,
    hydrated: accountHydrated,
    selectBusinessAccount,
    selectPersonalAccount,
    selectCircleAccount,
  } = useActiveAccount()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [activating, setActivating] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [businessAccounts, setBusinessAccounts] = useState<BusinessAccountItem[]>([])
  const [businessEntity, setBusinessEntity] = useState<Record<string, any> | null>(null)
  const [readiness, setReadiness] = useState<Record<string, any> | null>(null)
  const [journey, setJourney] = useState<Record<string, any> | null>(null)
  const [wallet, setWallet] = useState<Record<string, any> | null>(null)
  const [account, setAccount] = useState<Record<string, any> | null>(null)
  const [approvalSummary, setApprovalSummary] = useState<Record<string, any> | null>(null)
  const [memberships, setMemberships] = useState<Record<string, any>[]>([])
  const [transactions, setTransactions] = useState<Record<string, any>[]>([])
  const [switchAccountOpen, setSwitchAccountOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [circlesLoading, setCirclesLoading] = useState(false)
  const [circleAccounts, setCircleAccounts] = useState<WorkspaceCircle[]>([])
  const trackedBusinessEventsRef = useRef<Record<string, boolean>>({})
  const hasLoadedOnceRef = useRef(false)

  const activeBusinessId = activeAccount.type === 'business' ? activeAccount.businessId : null
  const selectedBusiness = useMemo(() => businessAccounts.find((item) => String(item?.id || '') === String(activeBusinessId || '')) || null, [businessAccounts, activeBusinessId])

  const loadCircleAccounts = useCallback(async () => {
    setCirclesLoading(true)
    try {
      const response = await listCircles()
      const payload = response?.data ?? response
      const items = Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload?.circles)
          ? payload.circles
          : Array.isArray(payload?.items)
            ? payload.items
            : Array.isArray(payload?.results)
              ? payload.results
              : Array.isArray(payload)
                ? payload
                : []

      setCircleAccounts(
        items
          .map((item: any) => ({
            id: String(item?.id || item?.circle_id || item?.uuid || '').trim(),
            name: String(item?.name || item?.title || 'Circle'),
            role: String(item?.current_user_role || item?.role || 'member'),
            circle_type: String(item?.circle_type || 'standard'),
            member_count: Number(item?.member_count ?? item?.members_count ?? 0),
          }))
          .filter((item: WorkspaceCircle) => item.id)
      )
    } catch {
      setCircleAccounts([])
    } finally {
      setCirclesLoading(false)
    }
  }, [])

  const loadBusinessState = useCallback(async (options?: { silent?: boolean }) => {
    if (!accountHydrated) return
    const silent = options?.silent === true
    if (!silent) setLoading(true)
    setErrorMessage(null)
    try {
      const listPromise = getBusinessEntities().catch(() => null)

      if (activeBusinessId) {
        const [listResponse, entityRes, onboardingRes, walletRes, accountRes] = await Promise.all([
          listPromise,
          getBusinessEntity(activeBusinessId).catch(() => null),
          getBusinessOnboarding(activeBusinessId).catch(() => null),
          getBusinessWallet(activeBusinessId).catch(() => null),
          getBusinessAccount(activeBusinessId).catch(() => null),
        ])

        const entities = parseRows(listResponse)
        const normalized = entities.map((item: any) => ({ id: String(item?.id), name: String(item?.name || 'Business account'), status: String(item?.status || ''), current_user_role: String(item?.current_user_role || item?.role || '') }))
        setBusinessAccounts(normalized)

        const activeBusiness =
          normalized.find((item: any) => String(item.id) === String(activeBusinessId)) ||
          { id: String(activeBusinessId), name: 'Business account', status: '', current_user_role: '' }

        setBusinessEntity(entityRes?.data?.data || entityRes?.data || null)
        setReadiness(onboardingRes?.data?.data?.readiness || null)
        setJourney(onboardingRes?.data?.data?.journey || null)
        setWallet(walletRes?.data?.data?.wallet || walletRes?.data?.wallet || walletRes?.data?.data || null)
        setAccount(accountRes?.data?.data?.account || accountRes?.data?.account || accountRes?.data?.data || null)

        void Promise.allSettled([
          getBusinessApprovalSummary(activeBusiness.id),
          getBusinessMemberships(activeBusiness.id),
          getBusinessTransactions(activeBusiness.id, { limit: 40 }),
        ]).then(([approvalRes, membershipsRes, transactionsRes]) => {
          if (approvalRes.status === 'fulfilled') {
            setApprovalSummary(approvalRes.value?.data?.data || approvalRes.value?.data || null)
          }
          if (membershipsRes.status === 'fulfilled') {
            setMemberships(parseRows(membershipsRes.value))
          }
          if (transactionsRes.status === 'fulfilled') {
            setTransactions(extractTransactions(transactionsRes.value))
          }
        })

        return
      }

      const listResponse = await listPromise
      const entities = parseRows(listResponse)
      const normalized = entities.map((item: any) => ({ id: String(item?.id), name: String(item?.name || 'Business account'), status: String(item?.status || ''), current_user_role: String(item?.current_user_role || item?.role || '') }))
      setBusinessAccounts(normalized)

      const activeBusiness = normalized[0] || null
      if (!activeBusiness) {
        setBusinessEntity(null); setReadiness(null); setJourney(null); setWallet(null); setAccount(null); setApprovalSummary(null); setMemberships([]); setTransactions([])
        return
      }

      const [entityRes, onboardingRes, walletRes, accountRes] = await Promise.all([
        getBusinessEntity(activeBusiness.id).catch(() => null),
        getBusinessOnboarding(activeBusiness.id).catch(() => null),
        getBusinessWallet(activeBusiness.id).catch(() => null),
        getBusinessAccount(activeBusiness.id).catch(() => null),
      ])

      setBusinessEntity(entityRes?.data?.data || entityRes?.data || null)
      setReadiness(onboardingRes?.data?.data?.readiness || null)
      setJourney(onboardingRes?.data?.data?.journey || null)
      setWallet(walletRes?.data?.data?.wallet || walletRes?.data?.wallet || walletRes?.data?.data || null)
      setAccount(accountRes?.data?.data?.account || accountRes?.data?.account || accountRes?.data?.data || null)

      void Promise.allSettled([
        getBusinessApprovalSummary(activeBusiness.id),
        getBusinessMemberships(activeBusiness.id),
        getBusinessTransactions(activeBusiness.id, { limit: 40 }),
      ]).then(([approvalRes, membershipsRes, transactionsRes]) => {
        if (approvalRes.status === 'fulfilled') {
          setApprovalSummary(approvalRes.value?.data?.data || approvalRes.value?.data || null)
        }
        if (membershipsRes.status === 'fulfilled') {
          setMemberships(parseRows(membershipsRes.value))
        }
        if (transactionsRes.status === 'fulfilled') {
          setTransactions(extractTransactions(transactionsRes.value))
        }
      })
    } catch (error: any) {
      const message = buildApiErrorMessage({ status: error?.response?.status, data: error?.response?.data, fallback: 'Unable to load the business dashboard right now.' })
      setErrorMessage(message)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [accountHydrated, activeBusinessId])

  useFocusEffect(
    useCallback(() => {
      void loadBusinessState(hasLoadedOnceRef.current ? { silent: true } : undefined)
      void loadCircleAccounts()
      hasLoadedOnceRef.current = true
    }, [loadBusinessState, loadCircleAccounts])
  )

  useEffect(() => {
    if (!loading && !errorMessage && businessAccounts.length === 0) router.replace('/business/activate' as any)
  }, [loading, errorMessage, businessAccounts.length, router])

  const businessStatus = String(businessEntity?.status || selectedBusiness?.status || '').toLowerCase()
  const journeyStage = String(journey?.stage || '')
  const accountNumber = String(account?.account_number || '').trim()
  const canActivate = Boolean(businessEntity?.provisioning_gate?.can_provision_business_account)
  const isLive = businessStatus === 'active' || journeyStage === 'business_banking_live'
  const currentRole = String(selectedBusiness?.current_user_role || businessEntity?.current_user_role || '').toLowerCase()
  const roleLabel = formatRole(currentRole || 'member')
  const statusLabel = formatStatusLabel(businessStatus, isLive, canActivate, journeyStage)
  const heroTone: 'live' | 'ready' | 'review' | 'setup' = isLive ? 'live' : ['business_banking_provisioning', 'provisioning_reconciliation_required'].includes(journeyStage) ? 'review' : canActivate ? 'ready' : businessStatus === 'under_review' ? 'review' : 'setup'
  const accountLine = accountNumber || null
  const bankLine = String(account?.bank_name || '').trim() || null
  const availableBalance = formatNgn(wallet?.balance ?? wallet?.amount ?? 0)
  const pendingApprovals = Number(approvalSummary?.total_pending || 0)
  const teamCount = memberships.length
  const incomingToday = useMemo(() => {
    const today = new Date()
    return transactions.filter((item) => normalizeDirection(item) === 'inflow' && isSameDay(toDate(item?.created_at || item?.updated_at || item?.occurred_at), today)).reduce((sum, item) => sum + toAmount(item), 0)
  }, [transactions])
  const outgoingThisMonth = useMemo(() => {
    const today = new Date()
    return transactions.filter((item) => normalizeDirection(item) === 'outflow' && isSameMonth(toDate(item?.created_at || item?.updated_at || item?.occurred_at), today)).reduce((sum, item) => sum + toAmount(item), 0)
  }, [transactions])
  const activityRows = useMemo(() => buildActivityRows(transactions), [transactions])
  const missingProfileFields = Array.isArray((journey as any)?.blocking_requirements?.missing_profile_fields)
    ? (journey as any).blocking_requirements.missing_profile_fields
    : Array.isArray(readiness?.missing_profile_fields)
      ? readiness.missing_profile_fields
      : []
  const missingSignatoryRequirements = Array.isArray((journey as any)?.blocking_requirements?.missing_signatory_requirements)
    ? (journey as any).blocking_requirements.missing_signatory_requirements
    : Array.isArray(readiness?.missing_signatory_requirements)
      ? readiness.missing_signatory_requirements
      : []
  const setupStage = useMemo(() => setupStageCopy({ isLive, canActivate, businessStatus, missingProfileFields, missingSignatoryRequirements, journey }), [isLive, canActivate, businessStatus, missingProfileFields, missingSignatoryRequirements, journey])
  const setupSteps = useMemo(() => {
    const hasMissing = (fields: string[]) => fields.some((field) => missingProfileFields.includes(field))
    return [
      { title: 'Business details', ready: !hasMissing(['legal_name', 'business_type', 'registration_number', 'date_of_registration', 'category', 'anchor_industry']) },
      { title: 'Contact details', ready: !hasMissing(['contact_email', 'contact_phone', 'address_line_1', 'city', 'state', 'country', 'registered_address_line_1', 'registered_city', 'registered_state', 'registered_country']) },
      { title: 'Business representatives', ready: missingSignatoryRequirements.length === 0 },
    ]
  }, [missingProfileFields, missingSignatoryRequirements.length])
  const completedSetupSections = setupSteps.filter((step) => step.ready).length
  const setupIncomplete = completedSetupSections < setupSteps.length
  const setupEditingAllowed = !['verification_in_progress', 'verification_rejected', 'provider_documents_required', 'ready_for_activation', 'business_banking_provisioning', 'provisioning_reconciliation_required', 'business_banking_live', 'business_restricted'].includes(journeyStage) && !isLive && !canActivate
  const dashboardSetupStage = setupEditingAllowed && setupIncomplete
    ? {
        stage: 'Business setup',
        nextTitle: 'Complete business setup',
        nextBody: !setupSteps[0]?.ready
          ? 'Business details need attention.'
          : !setupSteps[1]?.ready
            ? 'Contact details need attention.'
            : 'Business representatives need attention.',
        tone: 'amber' as const,
      }
    : setupStage
  const verificationProgressLabel = journeyStage === 'ready_for_verification'
    ? 'Verification: ready to begin'
    : journeyStage === 'verification_in_progress'
      ? 'Verification: in review'
      : journeyStage === 'provider_documents_required'
        ? 'Verification: documents needed'
        : journeyStage === 'verification_rejected'
          ? 'Verification: action required'
          : 'Verification: not started'

  const handleActivate = useCallback(async () => {
    if (!selectedBusiness?.id) return
    setActivating(true)
    setErrorMessage(null)
    setSuccessMessage(null)
    try {
      const response = await createBusinessProvisioning(selectedBusiness.id)
      setSuccessMessage(response?.data?.message || 'Business account activation started.')
      await loadBusinessState({ silent: true })
    } catch (error: any) {
      const message = buildApiErrorMessage({ status: error?.response?.status, data: error?.response?.data, fallback: 'Unable to activate the business account right now.' })
      setErrorMessage(message)
    } finally {
      setActivating(false)
    }
  }, [selectedBusiness?.id, loadBusinessState])

  const setupPrimaryAction = useMemo(() => {
    if (isLive || !selectedBusiness?.id) return null
    const nextAction = String(journey?.next_action || '')
    const nextRoute = String(journey?.next_route || '')
    if (nextAction === 'activate_business_account') return { label: activating ? 'Activating business banking...' : 'Activate business banking', action: handleActivate, loading: activating }
    if (setupEditingAllowed && setupIncomplete) return { label: 'Continue setup', action: () => router.push('/business/setup' as any), loading: false }
    if (nextRoute) return { label: nextActionLabel(nextAction, setupStage.nextTitle), action: () => router.push(nextRoute as any), loading: false }
    if (!journeyStage && canActivate) return { label: activating ? 'Activating business banking...' : 'Activate business banking', action: handleActivate, loading: activating }
    if (businessStatus === 'under_review') return { label: 'Review business verification', action: () => router.push('/business/kyb' as any), loading: false }
    if (missingProfileFields.some((field: any) => ['legal_name', 'business_type', 'registration_number', 'date_of_registration', 'category', 'anchor_industry'].includes(String(field)))) return { label: 'Complete business details', action: () => router.push('/business/onboarding?section=business' as any), loading: false }
    if (missingProfileFields.some((field: any) => ['contact_email', 'contact_phone', 'address_line_1', 'city', 'state', 'country', 'registered_address_line_1', 'registered_city', 'registered_state', 'registered_country'].includes(String(field)))) return { label: 'Add contact details', action: () => router.push('/business/onboarding?section=contact' as any), loading: false }
    if (missingSignatoryRequirements.length > 0) return { label: 'Continue setup', action: () => router.push('/business/setup' as any), loading: false }
    return { label: 'Open business verification', action: () => router.push('/business/kyb' as any), loading: false }
  }, [isLive, selectedBusiness?.id, journey, canActivate, activating, businessStatus, router, missingProfileFields, missingSignatoryRequirements, setupStage.nextTitle, handleActivate, setupEditingAllowed, setupIncomplete])

  const heroPrimaryActions = useMemo(() => {
    const unlocked = isLive
    return [
      { label: 'Transfer', icon: 'send-outline' as const, onPress: unlocked ? () => router.push('/business/transfers' as any) : undefined, disabled: !unlocked, comingSoon: !unlocked },
      { label: 'Fund', icon: 'add-circle-outline' as const, onPress: unlocked ? () => router.push('/fundWallet/index' as any) : undefined, disabled: !unlocked, comingSoon: !unlocked },
      { label: 'Payroll', icon: 'cash-outline' as const, onPress: unlocked ? () => router.push('/business/payouts' as any) : undefined, disabled: !unlocked, comingSoon: !unlocked },
    ]
  }, [isLive, router])

  const treasuryMetaChips = useMemo(() => ([
    { label: 'Incoming today', value: formatNgn(incomingToday), tone: 'emerald' as const },
    { label: 'Outgoing month', value: formatNgn(outgoingThisMonth), tone: 'slate' as const },
  ]), [incomingToday, outgoingThisMonth])

  const controlsActions = useMemo(() => ([
    { label: 'Invite', icon: 'person-add-outline' as const, onPress: () => router.push('/business/team' as any) },
    { label: 'Roles', icon: 'shield-checkmark-outline' as const, onPress: () => router.push('/business/team' as any), subtle: true, badge: roleLabel },
  ]), [router, roleLabel])

  const utilityActions = useMemo(() => {
    const actions = [
      { label: 'Approvals', icon: 'checkmark-done-outline' as const, onPress: () => router.push('/business/approvals' as any), badge: pendingApprovals ? String(pendingApprovals) : null },
      { label: 'Verification', icon: 'document-text-outline' as const, onPress: () => router.push('/business/kyb' as any), badge: isLive ? null : statusLabel },
      { label: 'People', icon: 'people-outline' as const, onPress: () => router.push('/business/onboarding?section=signatory' as any), badge: isLive ? null : 'Review' },
      { label: 'Statements', icon: 'receipt-outline' as const, badge: 'Soon' },
    ]
    return actions
  }, [router, pendingApprovals, isLive, statusLabel])

  const handleBackToPersonal = useCallback(async () => {
    await selectPersonalAccount()
    router.replace('/(tabs)' as any)
  }, [router, selectPersonalAccount])

  const openSwitcher = useCallback(() => {
    setSwitchAccountOpen(true)
    void loadBusinessState({ silent: true })
    void loadCircleAccounts()
  }, [loadBusinessState, loadCircleAccounts])

  const refreshBusinessState = useCallback(async () => {
    if (refreshing) return
    setRefreshing(true)
    try {
      await loadBusinessState({ silent: true })
    } finally {
      setRefreshing(false)
    }
  }, [loadBusinessState, refreshing])

  const copyAccountNumber = useCallback(async () => {
    if (!accountNumber) return
    await Clipboard.setStringAsync(accountNumber)
  }, [accountNumber])

  useEffect(() => {
    if (!selectedBusiness?.id) return
    const eventKey = `${selectedBusiness.id}:onboarding_complete`
    if (canActivate && !trackedBusinessEventsRef.current[eventKey]) {
      trackedBusinessEventsRef.current[eventKey] = true
      emitBusinessLifecycleEvent('onboarding_complete', { businessId: selectedBusiness.id, status: businessStatus })
    }
  }, [selectedBusiness?.id, canActivate, businessStatus])

  useEffect(() => {
    if (!selectedBusiness?.id || !isLive) return
    const eventKey = `${selectedBusiness.id}:activation_live`
    if (!trackedBusinessEventsRef.current[eventKey]) {
      trackedBusinessEventsRef.current[eventKey] = true
      emitBusinessLifecycleEvent('business_account_live', { businessId: selectedBusiness.id, status: businessStatus, accountNumberPresent: Boolean(accountNumber) })
    }
  }, [selectedBusiness?.id, isLive, businessStatus, accountNumber])

  useEffect(() => {
    if (!selectedBusiness?.id || !isLive) return
    const eventKey = `${selectedBusiness.id}:funding_state`
    if (trackedBusinessEventsRef.current[eventKey] && wallet?.balance === undefined) return
    trackedBusinessEventsRef.current[eventKey] = true
    emitBusinessLifecycleEvent('business_account_balance_loaded', { businessId: selectedBusiness.id, balance: Number(wallet?.balance ?? wallet?.amount ?? 0) })
  }, [selectedBusiness?.id, isLive, wallet?.balance, wallet?.amount])

  if (loading || !accountHydrated) {
    return (
      <ScreenContainer includeTopInset topPadding={6} horizontalPadding={0} className="flex-1 bg-[#05070D]" scrollProps={{ refreshControl: <RefreshControl refreshing={refreshing} onRefresh={() => void refreshBusinessState()} tintColor="#FFB05A" colors={['#FFB05A']} /> }}>
        <View className="px-3">
          <TouchableOpacity
            accessibilityLabel="Back to Personal"
            onPress={() => {
              void handleBackToPersonal()
            }}
            className="mb-4 self-start rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3"
          >
            <Text className="text-sm font-semibold text-white">Back to Personal</Text>
          </TouchableOpacity>
          <BusinessDashboardSkeleton />
        </View>
      </ScreenContainer>
    )
  }

  return (
    <>
      <ScreenContainer includeTopInset topPadding={6} horizontalPadding={0} className="flex-1 bg-[#05070D]" scrollProps={{ refreshControl: <RefreshControl refreshing={refreshing} onRefresh={() => void refreshBusinessState()} tintColor="#FFB05A" colors={['#FFB05A']} /> }}>
        <View className="px-3">
        <TouchableOpacity
          accessibilityLabel="Back to Personal"
          onPress={() => {
            void handleBackToPersonal()
          }}
          className="mb-4 self-start rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3"
        >
          <Text className="text-sm font-semibold text-white">Back to Personal</Text>
        </TouchableOpacity>
        <View className="mb-7 flex-row items-center gap-3">
          <View className="h-10 w-10 items-center justify-center rounded-full bg-[#111827]/52">
            <Image source={icons.appLogoClear} className="h-5 w-5" resizeMode="contain" />
          </View>

          <TouchableOpacity onPress={openSwitcher} activeOpacity={0.85} className="flex-1 rounded-full bg-[#111827]/72 px-3 py-2.5">
            <View className="flex-row items-center gap-3">
              <View className="flex-1">
                <Text className="text-white text-[15px] font-semibold" numberOfLines={1}>{selectedBusiness?.name || 'Switch business'}</Text>
                <View className="mt-0.5 flex-row items-center">
                  <View className="h-1.5 w-1.5 rounded-full bg-[#FFB05A]" />
                  <View className="w-2.5" />
                  <Text className="text-[11px] text-slate-400" numberOfLines={1}>{roleLabel} • {statusLabel}</Text>
                </View>
              </View>
              <Ionicons name="chevron-down" size={15} color="#94A3B8" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => void refreshBusinessState()} activeOpacity={0.85} className="h-11 w-11 items-center justify-center rounded-full bg-white/5">
            <Ionicons name="refresh-outline" size={18} color="#E2E8F0" />
          </TouchableOpacity>
        </View>

        {errorMessage ? (
          <View className="mb-5 rounded-[24px] border border-red-500/30 bg-red-500/10 px-4 py-4">
            <Text className="text-red-100 text-sm">{errorMessage}</Text>
            <TouchableOpacity onPress={() => loadBusinessState()} className="mt-3 self-start rounded-full border border-red-400/30 bg-red-500/10 px-3 py-2">
              <Text className="text-[11px] font-semibold text-red-50">Retry</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {successMessage ? (
          <View className="mb-5 rounded-[24px] border border-emerald-500/30 bg-emerald-500/10 px-4 py-4">
            <Text className="text-emerald-100 text-sm">{successMessage}</Text>
          </View>
        ) : null}

        {!selectedBusiness?.id && businessAccounts.length > 0 ? (
          <View className="rounded-[30px] border border-white/8 bg-[#0F1420] p-5">
            <Text className="text-white text-base font-semibold">Select a business account</Text>
            <Text className="mt-2 text-sm text-slate-400">Choose the business you want to manage before viewing balances, approvals, payroll, or transfers.</Text>
            <TouchableOpacity onPress={openSwitcher} className="mt-4 rounded-2xl bg-[#FFB05A] px-4 py-4 items-center">
              <Text className="text-black text-sm font-semibold">Switch account</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {selectedBusiness?.id ? (
          <View className="gap-10 pb-10">
            <BusinessHeroCard
              statusTone={heroTone}
              balanceLabel={availableBalance}
              balanceCaption="Available balance"
              bankLine={bankLine}
              accountLine={accountLine}
              onCopyAccount={accountLine ? copyAccountNumber : undefined}
              primaryActions={heroPrimaryActions}
              metaChips={treasuryMetaChips}
            />

            {!isLive ? (
              <BusinessSetupBanner
                stage={dashboardSetupStage.stage}
                title={dashboardSetupStage.nextTitle}
                body={dashboardSetupStage.nextBody}
                ctaLabel={setupPrimaryAction?.label || 'Continue setup'}
                onPress={() => { setupPrimaryAction?.action() }}
                progress={(completedSetupSections / setupSteps.length) * 100}
                progressLabel={setupIncomplete ? `${completedSetupSections}/3 sections complete` : verificationProgressLabel}
                tone={dashboardSetupStage.tone as 'amber' | 'sky' | 'emerald'}
                showProgressBar={false}
              />
            ) : null}

            <BusinessRecentActivity
              items={activityRows.map((item) => ({
                ...item,
                onPress: item.reference ? () => router.push(`/business/receipts/${encodeURIComponent(String(item.reference || ''))}` as any) : undefined,
              }))}
              onViewAll={() => router.push('/business/transfers' as any)}
              onEmptyAction={() => {
                if (isLive) router.push('/business/transfers' as any)
                else if (setupPrimaryAction) setupPrimaryAction.action()
                else router.push('/business/kyb' as any)
              }}
              emptyActionLabel={isLive ? 'Make first transfer' : 'Complete verification'}
              emptyTitle={isLive ? 'No business activity yet' : 'Business activity is locked'}
              emptySubtitle={isLive ? 'Fund this account or send your first business payment.' : 'Finish verification to unlock transfers, payroll, and company activity.'}
            />

            <BusinessControlsCard
              membersLabel={String(teamCount)}
              approvalsLabel={String(pendingApprovals)}
              controlsActions={controlsActions}
              utilityActions={utilityActions}
            />
          </View>
        ) : null}
        </View>

      </ScreenContainer>

      <WorkspaceSwitcherModal
        open={switchAccountOpen}
        onClose={() => setSwitchAccountOpen(false)}
        activeAccount={activeAccount}
        activeIdentityName={selectedBusiness?.name || 'Business account'}
        activeIdentityMeta={`${roleLabel} • ${statusLabel}`}
        activeIdentityBadge="Business"
        accountHydrated={accountHydrated}
        businessLoading={loading}
        circlesLoading={circlesLoading}
        businessAccounts={businessAccounts}
        circleAccounts={circleAccounts}
        selectedBusinessName={selectedBusiness?.name || null}
        selectedCircleName={null}
        onSelectPersonal={async () => {
          await selectPersonalAccount()
          router.replace('/(tabs)' as any)
        }}
        onSelectBusiness={async (businessId) => {
          await selectBusinessAccount(businessId)
          router.replace('/business' as any)
        }}
        onSelectCircle={async (circleId) => {
          const selectedCircle = circleAccounts.find((item) => String(item.id) === String(circleId))
          await selectCircleAccount(circleId)
          router.replace({
            pathname: `/circles/${circleId}` as any,
            params: {
              name: selectedCircle?.name || 'Circle',
              role: selectedCircle?.role || 'member',
              memberCount: String(selectedCircle?.member_count || 0),
              circleType: selectedCircle?.circle_type || 'standard',
            },
          } as any)
        }}
        onOpenBusinessCreate={() => {
          router.push('/business/activate' as any)
        }}
        onOpenCircles={() => {
          router.push('/circles' as any)
        }}
      />
    </>
  )
}

export default BusinessIndexScreen
