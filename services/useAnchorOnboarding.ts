import { useCallback, useEffect, useMemo, useState } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { getAccounts, getAnchorOnboardingState, getUserAnchorAccountDetail } from '@/api/account'
import { log } from '@/utils/log'

export type AnchorKycState = 'unknown' | 'not_started' | 'pending' | 'verified'
export type AnchorNextStep = 'CREATE_ANCHOR' | 'DO_KYC' | 'GENERATE_NUMBER' | 'DONE'
export type AnchorFlowState =
  | 'not_started'
  | 'blocked_profile_incomplete'
  | 'blocked_kyc'
  | 'pending_kyc_review'
  | 'blocked_phone_exists'
  | 'customer_created_no_deposit_account'
  | 'temporary_provider_failure'
  | 'provisioned'
  | 'unknown'

export type NormalizedAnchorOnboarding = {
  isHydrated: boolean
  hasAnchorAccount: boolean
  kycState: AnchorKycState
  hasAccountNumber: boolean
  accountNumber: string | null
  rawAccountNumber: string | null
  displayAccountNumber: string | null
  accountName: string | null
  bankName: string | null
  depositReady: boolean
  nextStep: AnchorNextStep
  backendFlowState: AnchorFlowState
  backendNextAction: string | null
  blockingReason?: string
  capabilities?: Record<string, boolean> | null
  requirements?: Record<string, unknown> | null
}

type AnchorOnboardingStoreState = {
  onboardingResponse: any | null | undefined
  detailResponse: any | null | undefined
  userAccountsResponse: any | null | undefined
  loading: boolean
  error: any | null
  lastFetchedAt: number | null
}

type Listener = (state: AnchorOnboardingStoreState) => void

type RefreshResponse = {
  onboardingResponse: any | null
  detailResponse: any | null
  userAccountsResponse: any | null | undefined
}

const store: AnchorOnboardingStoreState = {
  onboardingResponse: undefined,
  detailResponse: undefined,
  userAccountsResponse: undefined,
  loading: false,
  error: null,
  lastFetchedAt: null,
}

const listeners = new Set<Listener>()
let inFlight: Promise<RefreshResponse> | null = null

const STALE_MS = 10_000

const isStale = (lastFetchedAt: number | null) => {
  if (!lastFetchedAt) return true
  return Date.now() - lastFetchedAt > STALE_MS
}

const extractErrorSnapshot = (error: any) => ({
  message: error?.message,
  status: error?.response?.status,
  code: error?.response?.data?.error_code || error?.error_code || error?.error,
})

const setStore = (partial: Partial<AnchorOnboardingStoreState>) => {
  Object.assign(store, partial)
  listeners.forEach((listener) => listener(store))
}

const asObj = (value: unknown): Record<string, any> =>
  value && typeof value === 'object' ? (value as Record<string, any>) : {}

const asArray = (value: unknown): any[] => (Array.isArray(value) ? value : [])

const pickString = (...values: unknown[]) => {
  for (const value of values) {
    const str = String(value ?? '').trim()
    if (str) return str
  }
  return ''
}

const extractAccountsList = (raw: unknown): any[] => {
  const root = asObj(raw)
  const payload = root?.data ?? root

  if (Array.isArray(payload)) return payload

  const p = asObj(payload)
  const candidates = [p.accounts, p.items, p.results, p.data, p.user_accounts]
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate
  }

  const nested = asObj(p.data)
  const nestedCandidates = [nested.items, nested.accounts, nested.results]
  for (const candidate of nestedCandidates) {
    if (Array.isArray(candidate)) return candidate
  }

  return []
}

const normalizeKycState = (
  raw: unknown,
  hasAnchorAccount: boolean,
  detailResponse?: any,
  hasAccountNumber?: boolean,
  anchorAccount?: any
): AnchorKycState => {
  const value = String(raw ?? '').trim().toLowerCase()
  if (!hasAnchorAccount) return 'unknown'
  const accountStatus = String(anchorAccount?.status ?? '').trim().toLowerCase()
  if (['completed', 'verified', 'approved', 'active'].some((v) => accountStatus.includes(v))) {
    return 'verified'
  }
  if (accountStatus === 'verifying') {
    return 'pending'
  }
  if (value === 'active') return 'verified'
  if (!value) return 'not_started'
  if (
    ['completed', 'verified', 'approved', 'success', 'successful'].some((v) =>
      value.includes(v)
    )
  ) {
    return 'verified'
  }
  const responseMessage = String(
    detailResponse?.message ?? detailResponse?.data?.message ?? detailResponse?.error ?? ''
  )
    .trim()
    .toLowerCase()
  if (responseMessage.includes('kyc already completed')) {
    return 'verified'
  }
  if (
    ['pending', 'processing', 'verifying', 'in_review', 'review', 'submitted'].some((v) =>
      value.includes(v)
    )
  ) {
    return 'pending'
  }
  if (['unverified', 'not_verified', 'not verified'].some((v) => value.includes(v))) {
    return 'not_started'
  }
  return 'unknown'
}

const detectAnchorAccount = (accounts: any[]) => {
  return accounts.find((account) => String(account?.vendor || '').toLowerCase() === 'anchor') || null
}

const extractDetailData = (detailResponse: any) => {
  if (detailResponse == null) return null
  if (Object.prototype.hasOwnProperty.call(detailResponse, 'data')) {
    const payload = detailResponse?.data
    if (!payload || Array.isArray(payload)) return null
    if (typeof payload !== 'object') return null
    return payload as Record<string, any>
  }
  const payload = detailResponse
  if (!payload || Array.isArray(payload)) return null
  if (typeof payload !== 'object') return null
  return payload as Record<string, any>
}

const parseBackendFlow = (
  onboardingResponse: any,
  detailResponse: any
): { state: AnchorFlowState; nextAction: string | null } => {
  const flow =
    onboardingResponse?.flow ||
    onboardingResponse?.data?.flow ||
    detailResponse?.flow ||
    detailResponse?.data?.flow
  const state = String(flow?.state || '').trim().toLowerCase()
  const nextAction = String(flow?.next_action || '').trim() || null

  const valid: AnchorFlowState[] = [
    'not_started',
    'blocked_profile_incomplete',
    'blocked_kyc',
    'pending_kyc_review',
    'blocked_phone_exists',
    'customer_created_no_deposit_account',
    'temporary_provider_failure',
    'provisioned',
  ]
  if (valid.includes(state as AnchorFlowState)) {
    return { state: state as AnchorFlowState, nextAction }
  }
  return { state: 'unknown', nextAction }
}

const extractAccountNumberFromDetail = (detailData: Record<string, any> | null) => {
  if (!detailData) return ''
  const attrs = asObj(detailData.attributes)
  return pickString(
    detailData.account_number,
    detailData.accountNumber,
    attrs.account_number,
    attrs.accountNumber,
    attrs?.bank?.accountNumber
  )
}

const extractAccountNameFromDetail = (detailData: Record<string, any> | null) => {
  if (!detailData) return ''
  const attrs = asObj(detailData.attributes)
  const bank = asObj(attrs.bank)
  const account = asObj(detailData.account)
  return pickString(
    detailData.account_name,
    detailData.accountName,
    detailData.name,
    account.account_name,
    account.accountName,
    account.name,
    attrs.account_name,
    attrs.accountName,
    attrs.name,
    bank.accountName,
    bank.account_name
  )
}

const extractBankNameFromDetail = (detailData: Record<string, any> | null) => {
  if (!detailData) return ''
  const attrs = asObj(detailData.attributes)
  const bank = asObj(attrs.bank)
  const account = asObj(detailData.account)
  return pickString(
    detailData.bank_name,
    detailData.bankName,
    detailData.bank,
    account.bank_name,
    account.bankName,
    account.bank,
    attrs.bank_name,
    attrs.bankName,
    bank.name
  )
}

const extractStatusFromDetail = (detailData: Record<string, any> | null) => {
  if (!detailData) return ''
  const attrs = asObj(detailData.attributes)
  return pickString(
    attrs.status,
    detailData.status,
    detailData.kyc_status,
    detailData.kycStatus,
    detailData.verification_status,
    detailData.verificationStatus,
    attrs.kyc_status,
    attrs.kycStatus,
    attrs.verification_status,
    attrs.verificationStatus
  )
}

const detectAccountNumberPaths = (detailResponse: any, userAccountsResponse?: any) => {
  const paths: string[] = []
  const detailData = extractDetailData(detailResponse)
  const attrs = asObj(detailData?.attributes)
  if (detailData?.account_number) paths.push('data.account_number')
  if (detailData?.accountNumber) paths.push('data.accountNumber')
  if (attrs?.account_number) paths.push('data.attributes.account_number')
  if (attrs?.accountNumber) paths.push('data.attributes.accountNumber')
  if (attrs?.bank?.accountNumber) paths.push('data.attributes.bank.accountNumber')

  const accounts = extractAccountsList(userAccountsResponse)
  if (accounts.some((item) => item?.account_number)) paths.push('user_accounts[].account_number')
  if (accounts.some((item) => item?.accountNumber)) paths.push('user_accounts[].accountNumber')

  return paths
}

export const normalizeAnchorOnboarding = (
  detailResponse: any,
  userAccountsResponse?: any,
  onboardingResponse?: any
): NormalizedAnchorOnboarding => {
  const backendFlow = parseBackendFlow(onboardingResponse, detailResponse)
  const isHydrated =
    onboardingResponse !== undefined || detailResponse !== undefined || userAccountsResponse !== undefined
  const detailData = extractDetailData(detailResponse)
  const accounts = extractAccountsList(userAccountsResponse)
  const anchorAccount = detectAnchorAccount(accounts)
  const onboardingData = asObj(onboardingResponse?.data)
  const onboardingCapabilities = asObj(onboardingResponse?.capabilities)
  const onboardingRequirements = asObj(onboardingResponse?.requirements)

  const hasAnchorAccount =
    onboardingResponse?.has_anchor_account === true ||
    onboardingData?.has_anchor_account === true ||
    detailResponse?.has_anchor_account === true ||
    Boolean(anchorAccount) ||
    Boolean(detailData && Object.keys(detailData).length > 0)

  const accountNumber = pickString(
    anchorAccount?.account_number,
    anchorAccount?.accountNumber,
    extractAccountNumberFromDetail(detailData)
  )
  const rawAccountNumber = accountNumber && accountNumber.includes('*') ? '' : accountNumber
  const displayAccountNumber = accountNumber || null

  const accountName = pickString(
    anchorAccount?.account_name,
    anchorAccount?.accountName,
    extractAccountNameFromDetail(detailData)
  )

  const bankName = pickString(
    anchorAccount?.bank_name,
    anchorAccount?.bankName,
    anchorAccount?.bank,
    extractBankNameFromDetail(detailData)
  )

  const kycState = normalizeKycState(
    extractStatusFromDetail(detailData),
    hasAnchorAccount,
    detailResponse,
    Boolean(accountNumber),
    anchorAccount
  )
  const hasAccountNumber =
    onboardingResponse?.has_deposit_account === true ||
    onboardingData?.has_deposit_account === true ||
    Boolean(accountNumber)
  const depositReady =
    backendFlow.state === 'provisioned' ||
    onboardingCapabilities?.can_fund_wallet === true ||
    (kycState === 'verified' && hasAccountNumber)

  const nextStep: AnchorNextStep =
    backendFlow.state === 'not_started'
      ? 'CREATE_ANCHOR'
      : backendFlow.state === 'blocked_profile_incomplete'
        ? 'CREATE_ANCHOR'
        : backendFlow.state === 'blocked_phone_exists'
          ? 'CREATE_ANCHOR'
        : backendFlow.state === 'blocked_kyc'
          ? 'DO_KYC'
          : backendFlow.state === 'pending_kyc_review'
            ? 'DO_KYC'
          : backendFlow.state === 'customer_created_no_deposit_account'
              ? 'GENERATE_NUMBER'
              : backendFlow.state === 'temporary_provider_failure'
                ? hasAnchorAccount
                  ? 'GENERATE_NUMBER'
                  : 'CREATE_ANCHOR'
                : backendFlow.state === 'provisioned'
                  ? 'DONE'
                  : !hasAnchorAccount
                    ? 'CREATE_ANCHOR'
                    : kycState !== 'verified'
                      ? 'DO_KYC'
                      : !hasAccountNumber
                        ? 'GENERATE_NUMBER'
                        : 'DONE'

  const blockingReason =
    backendFlow.state === 'blocked_profile_incomplete'
      ? 'profile_incomplete'
      : backendFlow.state === 'blocked_kyc'
        ? 'kyc_required'
        : backendFlow.state === 'blocked_phone_exists'
          ? 'phone_exists'
          : undefined

  return {
    isHydrated,
    hasAnchorAccount,
    kycState,
    hasAccountNumber,
    accountNumber: accountNumber || null,
    rawAccountNumber: rawAccountNumber || null,
    displayAccountNumber,
    accountName: accountName || null,
    bankName: bankName || null,
    depositReady,
    nextStep,
    backendFlowState: backendFlow.state,
    backendNextAction: backendFlow.nextAction,
    blockingReason,
    capabilities: Object.keys(onboardingCapabilities).length ? onboardingCapabilities : null,
    requirements: Object.keys(onboardingRequirements).length ? onboardingRequirements : null,
  }
}

export const getAnchorNextStep = (state: {
  hasAnchorAccount: boolean
  kycState: AnchorKycState
  hasAccountNumber: boolean
}): AnchorNextStep => {
  if (!state.hasAnchorAccount) return 'CREATE_ANCHOR'
  if (state.kycState !== 'verified') return 'DO_KYC'
  if (!state.hasAccountNumber) return 'GENERATE_NUMBER'
  return 'DONE'
}

let didLogShapes = false

const shouldLogDev = () => {
  const isJest = typeof process !== 'undefined' && !!process.env?.JEST_WORKER_ID
  return __DEV__ && !isJest
}

const findKeyPaths = (
  value: unknown,
  matcher: (key: string) => boolean,
  maxDepth = 4
): string[] => {
  const paths: string[] = []
  const visited = new WeakSet<object>()
  const queue: Array<{ node: any; path: string; depth: number }> = [
    { node: value, path: '$', depth: 0 },
  ]

  while (queue.length) {
    const current = queue.shift()
    if (!current) continue
    const { node, path, depth } = current
    if (!node || typeof node !== 'object') continue
    if (visited.has(node)) continue
    visited.add(node)
    if (depth > maxDepth) continue

    if (Array.isArray(node)) {
      node.forEach((child, index) => {
        const nextPath = `${path}[${index}]`
        if (child && typeof child === 'object') {
          queue.push({ node: child, path: nextPath, depth: depth + 1 })
        }
      })
      continue
    }

    for (const key of Object.keys(node)) {
      const nextPath = `${path}.${key}`
      if (matcher(key)) paths.push(nextPath)
      const child = (node as Record<string, unknown>)[key]
      if (child && typeof child === 'object') {
        queue.push({ node: child, path: nextPath, depth: depth + 1 })
      }
    }
  }

  return paths
}

const looksLikeAccountNumber = (value: unknown) => {
  if (value === null || value === undefined) return false
  if (typeof value === 'number') {
    const str = String(value)
    return /^\d{10,12}$/.test(str)
  }
  if (typeof value === 'string') {
    const digits = value.trim()
    if (!/^\d+$/.test(digits)) return false
    return digits.length === 10 || digits.length === 11 || digits.length === 12
  }
  return false
}

const findValuePaths = (value: unknown, maxDepth = 4) => {
  const accountNumberPaths: string[] = []
  const statusPaths: string[] = []
  const adjacentNamePaths: string[] = []
  const visited = new WeakSet<object>()
  const queue: Array<{ node: any; path: string; depth: number }> = [
    { node: value, path: '$', depth: 0 },
  ]

  while (queue.length) {
    const current = queue.shift()
    if (!current) continue
    const { node, path, depth } = current
    if (!node || typeof node !== 'object') continue
    if (visited.has(node)) continue
    visited.add(node)
    if (depth > maxDepth) continue

    if (Array.isArray(node)) {
      node.forEach((child, index) => {
        const nextPath = `${path}[${index}]`
        if (child && typeof child === 'object') {
          queue.push({ node: child, path: nextPath, depth: depth + 1 })
        } else {
          if (looksLikeAccountNumber(child)) {
            accountNumberPaths.push(nextPath)
          }
          const statusValue = String(child ?? '').toLowerCase()
          if (statusValue && /pending|verified|completed/.test(statusValue)) {
            statusPaths.push(nextPath)
          }
        }
      })
      continue
    }

    const entries = Object.entries(node as Record<string, unknown>)
    for (const [key, child] of entries) {
      const nextPath = `${path}.${key}`
      if (child && typeof child === 'object') {
        queue.push({ node: child, path: nextPath, depth: depth + 1 })
        continue
      }
      if (looksLikeAccountNumber(child)) {
        accountNumberPaths.push(nextPath)
        const siblingAccountName = (node as any)?.account_name ?? (node as any)?.accountName
        const siblingBankName =
          (node as any)?.bank_name ?? (node as any)?.bankName ?? (node as any)?.bank
        if ((node as any)?.account_name) adjacentNamePaths.push(`${path}.account_name`)
        if ((node as any)?.accountName) adjacentNamePaths.push(`${path}.accountName`)
        if ((node as any)?.bank_name) adjacentNamePaths.push(`${path}.bank_name`)
        if ((node as any)?.bankName) adjacentNamePaths.push(`${path}.bankName`)
        if ((node as any)?.bank) adjacentNamePaths.push(`${path}.bank`)
      }
      const statusValue = String(child ?? '').toLowerCase()
      if (statusValue && /pending|verified|completed/.test(statusValue)) {
        statusPaths.push(nextPath)
      }
    }
  }

  return {
    accountNumberPaths,
    statusPaths,
    adjacentNamePaths,
  }
}

const logNestedKeyGroups = (
  label: string,
  detailData: Record<string, any> | null,
  candidates: string[]
) => {
  if (!detailData) return
  for (const key of candidates) {
    const value = detailData[key]
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        log(`[Anchor Onboarding] detail.${label}.${key} keys`, Object.keys(value))
    }
  }
}

const logResponseShapes = (detailResponse: any, userAccountsResponse: any) => {
  if (!shouldLogDev() || didLogShapes) return
  didLogShapes = true

  const detailKeys = Object.keys(detailResponse || {})
  const detailData = extractDetailData(detailResponse)
  const detailDataKeys = Object.keys(detailData || {})
  const detailAttrKeys = Object.keys(detailData?.attributes || {})
  const detailRelKeys = Object.keys(detailData?.relationships || {})
  const accounts = extractAccountsList(userAccountsResponse)
  const accountSampleKeys = accounts[0] ? Object.keys(accounts[0]) : []
  const userAccountsKeys = Object.keys(userAccountsResponse || {})
  const userAccountsDataKeys = Object.keys((userAccountsResponse || {})?.data || {})
  const statusKeys = detailAttrKeys.filter((key) => key.toLowerCase().includes('status'))
  const accountNumberPaths = detectAccountNumberPaths(detailResponse, userAccountsResponse)
  const detailAccountNumberPaths = findKeyPaths(
    detailData,
    (key) => key.toLowerCase().includes('account_number') || key.includes('accountNumber')
  )
  const detailStatusPaths = findKeyPaths(detailData, (key) => key.toLowerCase().includes('status'))
  const detailHasAnchorPaths = findKeyPaths(
    detailResponse,
    (key) =>
      key.toLowerCase().includes('has_anchor_account') ||
      key.toLowerCase().includes('hasanchoraccount') ||
      key.toLowerCase().includes('anchor_account')
  )
  const detailValuePaths = findValuePaths(detailData)
  const detailStatusValuePaths = detailValuePaths.statusPaths
  const detailAccountNumberValuePaths = detailValuePaths.accountNumberPaths
  const detailAdjacentNamePaths = detailValuePaths.adjacentNamePaths
  const detailStatusValue = String(detailData?.attributes?.status ?? '').trim().toLowerCase()
  const detailAccountNumber = extractAccountNumberFromDetail(detailData)
  const detailAccountLast4 = detailAccountNumber ? String(detailAccountNumber).slice(-4) : ''
  const detailAccountMasked = detailAccountLast4 ? `****${detailAccountLast4}` : ''
  const hasAnchorAccountValue =
    detailResponse?.has_anchor_account ??
    detailResponse?.data?.has_anchor_account ??
    detailData?.has_anchor_account ??
    null
  const relationships = asObj(detailData?.relationships)
  const accountNumbersRel = asObj(relationships?.accountNumbers)
  const virtualNubansRel = asObj(relationships?.virtualNubans)
  const accountNumbersCount = Array.isArray(accountNumbersRel?.data)
    ? accountNumbersRel.data.length
    : null
  const virtualNubansCount = Array.isArray(virtualNubansRel?.data)
    ? virtualNubansRel.data.length
    : null
  const userAccountsValuePaths = findValuePaths(accounts)
  const userAccountsNumberKeyPaths = findKeyPaths(
    accounts,
    (key) => key.toLowerCase().includes('account_number') || key.includes('accountNumber')
  )

  log('[Anchor Onboarding] get_user_account_detail keys', detailKeys)
  log('[Anchor Onboarding] detail.data keys', detailDataKeys)
  log('[Anchor Onboarding] user_accounts keys', userAccountsKeys)
  log('[Anchor Onboarding] user_accounts.data keys', userAccountsDataKeys)
  log('[Anchor Onboarding] detail has_anchor_account key paths', detailHasAnchorPaths)
  log('[Anchor Onboarding] detail has_anchor_account value', hasAnchorAccountValue)
  log('[Anchor Onboarding] detail.attributes.status value', detailStatusValue)
  log(
    '[Anchor Onboarding] detail account number present/last4',
    Boolean(detailAccountNumber),
    detailAccountMasked
  )
  if (accountNumbersCount !== null) {
    log('[Anchor Onboarding] detail.relationships.accountNumbers count', accountNumbersCount)
  }
  if (virtualNubansCount !== null) {
    log('[Anchor Onboarding] detail.relationships.virtualNubans count', virtualNubansCount)
  }
  log('[Anchor Onboarding] detail.data.attributes keys', detailAttrKeys)
  log('[Anchor Onboarding] detail.data.relationships keys', detailRelKeys)
  log('[Anchor Onboarding] detail status-like keys', statusKeys)
  logNestedKeyGroups('data', detailData, [
    'account',
    'account_detail',
    'anchor',
    'kyc',
    'customer',
    'profile',
    'user',
    'verification',
  ])
  log('[Anchor Onboarding] user_accounts[0] keys', accountSampleKeys)
  log('[Anchor Onboarding] account number paths', accountNumberPaths)
  log('[Anchor Onboarding] detail account number key paths', detailAccountNumberPaths)
  log('[Anchor Onboarding] detail account number value paths', detailAccountNumberValuePaths)
  log('[Anchor Onboarding] detail status key paths', detailStatusPaths)
  log('[Anchor Onboarding] detail status value paths', detailStatusValuePaths)
  log('[Anchor Onboarding] detail adjacent name paths', detailAdjacentNamePaths)
  log('[Anchor Onboarding] user_accounts account number key paths', userAccountsNumberKeyPaths)
  log('[Anchor Onboarding] user_accounts account number value paths', userAccountsValuePaths.accountNumberPaths)
}

const logDerivedState = (state: NormalizedAnchorOnboarding) => {
  if (!shouldLogDev()) return
    log('[Anchor Onboarding] derived state', {
      hasAnchorAccount: state.hasAnchorAccount,
      kycState: state.kycState,
      hasAccountNumber: state.hasAccountNumber,
    depositReady: state.depositReady,
    step: state.nextStep,
  })
}

const fetchAnchorOnboarding = async (options?: { force?: boolean }): Promise<RefreshResponse> => {
  if (!options?.force && store.onboardingResponse !== undefined && !isStale(store.lastFetchedAt)) {
    return {
      onboardingResponse: store.onboardingResponse ?? null,
      detailResponse: store.detailResponse ?? null,
      userAccountsResponse: store.userAccountsResponse,
    }
  }
  if (inFlight) return inFlight

  setStore({ loading: true, error: null })
  inFlight = (async () => {
    try {
      const [onboardingResponse, detailResult, userAccountsResponse] = await Promise.all([
        getAnchorOnboardingState(),
        getUserAnchorAccountDetail().catch((error) => {
          if (shouldLogDev()) {
            log('[Anchor Onboarding] getUserAnchorAccountDetail fallback failed', extractErrorSnapshot(error))
          }
          return null
        }),
        getAccounts().catch((error) => {
          if (shouldLogDev()) {
            log('[Anchor Onboarding] getAccounts fallback failed', {
              message: (error as any)?.message,
              status: (error as any)?.response?.status,
            })
          }
          return undefined
        }),
      ])
      const detailResponse = detailResult ?? store.detailResponse ?? null

      if (options?.force) {
        didLogShapes = false
      }
      logResponseShapes(detailResponse, userAccountsResponse)

      setStore({
        onboardingResponse: onboardingResponse ?? null,
        detailResponse: detailResponse ?? null,
        userAccountsResponse: userAccountsResponse ?? store.userAccountsResponse,
        loading: false,
        error: null,
        lastFetchedAt: Date.now(),
      })

      logDerivedState(
        normalizeAnchorOnboarding(detailResponse ?? null, userAccountsResponse, onboardingResponse ?? null)
      )

      return {
        onboardingResponse: onboardingResponse ?? null,
        detailResponse: detailResponse ?? null,
        userAccountsResponse,
      }
    } catch (error) {
      setStore({
        loading: false,
        error,
        lastFetchedAt: Date.now(),
        onboardingResponse: store.onboardingResponse ?? null,
        detailResponse: store.detailResponse ?? null,
      })
      throw error
    } finally {
      inFlight = null
    }
  })()

  return inFlight
}

export const useAnchorOnboarding = (options?: {
  autoFetchOnFocus?: boolean
  autoFetchOnMount?: boolean
}) => {
  const [state, setState] = useState<AnchorOnboardingStoreState>({ ...store })

  useEffect(() => {
    const listener: Listener = (nextState) => setState({ ...nextState })
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }, [])

  const refresh = useCallback((opts?: { force?: boolean }) => fetchAnchorOnboarding(opts), [])

  useEffect(() => {
    if (options?.autoFetchOnMount === false) return
    if (state.onboardingResponse === undefined && !state.loading) {
      refresh().catch(() => {})
    }
  }, [options?.autoFetchOnMount, refresh, state.onboardingResponse, state.loading])

  useFocusEffect(
    useCallback(() => {
      if (options?.autoFetchOnFocus !== true) return
      if (state.onboardingResponse === undefined || isStale(state.lastFetchedAt)) {
        refresh().catch(() => {})
      }
    }, [options?.autoFetchOnFocus, refresh, state.onboardingResponse, state.lastFetchedAt])
  )

  const normalized = useMemo(
    () =>
      normalizeAnchorOnboarding(
        state.detailResponse,
        state.userAccountsResponse,
        state.onboardingResponse
      ),
    [state.onboardingResponse, state.detailResponse, state.userAccountsResponse]
  )

  return {
    ...state,
    ...normalized,
    refresh,
  }
}

export const __resetAnchorOnboardingStore = () => {
  if (!__DEV__) return
  store.onboardingResponse = undefined
  store.detailResponse = undefined
  store.userAccountsResponse = undefined
  store.loading = false
  store.error = null
  store.lastFetchedAt = null
  listeners.clear()
  inFlight = null
  didLogShapes = false
}
