import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'expo-router'
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native'
import ScreenContainer from '@/components/ScreenContainer'
import {
  createBusinessProvisioning,
  getBusinessOnboarding,
  getBusinessKyb,
  getBusinessKybDocuments,
  getBusinessKybStatus,
  resyncBusinessKyb,
  submitBusinessKyb,
  uploadBusinessKybDocument,
} from '@/api/business'
import { buildApiErrorMessage } from '@/utils/apiErrorMessage'
import { useActiveAccount } from '@/services/useActiveAccount'
import { pickKycUpload } from '@/utils/kycUploadPicker'
import { isNigeriaCountry, normalizeNigeriaState } from '@/utils/businessStateValidation'
import {
  BusinessKybValidationRoute,
  resolveBusinessKybValidationRoute,
} from '@/utils/businessKybValidationRouting'

const REQUIRED_DOCUMENT_KINDS = ['registration_certificate', 'proof_of_address']

const formatDate = (value?: string | null) => {
  if (!value) return 'Not available'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not available'
  return date.toLocaleString()
}

const formatLabel = (value: any) =>
  String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase())

const summarizeItem = (label: string, value: any) => ({
  label,
  value: String(value || '').trim() || 'Not provided yet',
})

const addressSummary = (...parts: unknown[]) =>
  parts.map((item) => String(item || '').trim()).filter(Boolean).join(', ')

const hasInvalidNigeriaState = (state: unknown, country: unknown) => {
  const value = String(state || '').trim()
  return Boolean(value && isNigeriaCountry(country) && !normalizeNigeriaState(value))
}

const statusTone = (value: any) => {
  const status = String(value || '').toLowerCase()
  if (['approved', 'verified', 'active', 'successful'].includes(status)) return 'text-emerald-300'
  if (['rejected', 'failed', 'restricted', 'expired'].includes(status)) return 'text-red-300'
  return 'text-amber-300'
}

const BusinessKybScreen = () => {
  const router = useRouter()
  const { activeAccount } = useActiveAccount()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [resyncing, setResyncing] = useState(false)
  const [uploadingKind, setUploadingKind] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [businessEntity, setBusinessEntity] = useState<Record<string, any> | null>(null)
  const [documents, setDocuments] = useState<Record<string, any>[]>([])
  const [readiness, setReadiness] = useState<Record<string, any> | null>(null)
  const [journey, setJourney] = useState<Record<string, any> | null>(null)
  const [requirements, setRequirements] = useState<Record<string, any> | null>(null)
  const [gate, setGate] = useState<Record<string, any> | null>(null)
  const [provider, setProvider] = useState<Record<string, any> | null>(null)
  const [onboardingProfile, setOnboardingProfile] = useState<Record<string, any> | null>(null)
  const [onboardingSignatories, setOnboardingSignatories] = useState<Record<string, any>[]>([])
  const [activating, setActivating] = useState(false)
  const businessId = activeAccount.type === 'business' ? activeAccount.businessId : null
  const fallbackRole = activeAccount.type === 'business' ? String((activeAccount as Record<string, any>)?.current_user_role || '') : ''

  const loadKybState = useCallback(async (options?: { silent?: boolean }) => {
    if (!businessId) {
      setLoading(false)
      return
    }

    const silent = options?.silent === true
    if (!silent) setLoading(true)
    setErrorMessage(null)
    try {
      const [kybRes, docsRes, statusRes, onboardingRes] = await Promise.all([
        getBusinessKyb(businessId),
        getBusinessKybDocuments(businessId),
        getBusinessKybStatus(businessId),
        getBusinessOnboarding(businessId).catch(() => null),
      ])

      const kybData = kybRes?.data?.data || {}
      const docsData = docsRes?.data?.data || {}
      const statusData = statusRes?.data?.data || {}
      const onboardingData = onboardingRes?.data?.data || {}

      setBusinessEntity(kybData.business_entity || statusData.business_entity || null)
      setDocuments(Array.isArray(docsData.documents) ? docsData.documents : Array.isArray(kybData.documents) ? kybData.documents : [])
      setReadiness(kybData.readiness || statusData.readiness || null)
      setJourney(kybData.journey || statusData.journey || null)
      setRequirements(kybData.requirements || docsData.requirements || statusData.requirements || null)
      setGate(kybData.gate || statusData.gate || null)
      setProvider(statusData.provider || docsData.provider || null)
      setOnboardingProfile(onboardingData.profile || null)
      setOnboardingSignatories(Array.isArray(onboardingData.signatories) ? onboardingData.signatories : [])
    } catch (error: any) {
      const message = buildApiErrorMessage({
        status: error?.response?.status,
        data: error?.response?.data,
        fallback: 'Unable to load business KYB right now.',
      })
      setErrorMessage(message)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [businessId])

  useEffect(() => {
    loadKybState()
  }, [loadKybState])

  const currentRole = String(businessEntity?.current_user_role || fallbackRole || '').toLowerCase()
  const canSubmit = ['owner', 'admin'].includes(currentRole)
  const canUpload = ['owner', 'admin'].includes(currentRole)
  const canActivate = Boolean(gate?.approved_for_provisioning)
  const missingProfileFields = Array.isArray(readiness?.missing_profile_fields) ? readiness.missing_profile_fields : []
  const missingSignatoryRequirements = Array.isArray(readiness?.missing_signatory_requirements) ? readiness.missing_signatory_requirements : []
  const readyFlags = useMemo(() => [
    { label: 'Business details complete', value: Boolean(readiness?.profile_ready) },
    { label: 'Required documents uploaded', value: Boolean(readiness?.documents_ready) },
    { label: 'Ready for review', value: Boolean(readiness?.ready_for_kyb_submission) },
    { label: 'Ready to activate', value: canActivate },
  ], [canActivate, readiness?.documents_ready, readiness?.profile_ready, readiness?.ready_for_kyb_submission])

  const documentKinds = useMemo(() => {
    const existing = documents.map((item) => String(item.document_kind || '')).filter(Boolean)
    const missing = Array.isArray(readiness?.missing_document_kinds)
      ? readiness.missing_document_kinds.map((item: any) => String(item || '')).filter(Boolean)
      : []
    return [...new Set([...missing, ...existing, ...REQUIRED_DOCUMENT_KINDS])]
  }, [documents, readiness?.missing_document_kinds])

  const preSubmissionDocuments = useMemo(() => {
    if (Array.isArray(requirements?.documents?.pre_submission) && requirements.documents.pre_submission.length) {
      return requirements.documents.pre_submission
    }
    return REQUIRED_DOCUMENT_KINDS.map((kind) => ({
      kind,
      label: formatLabel(kind),
      description: 'Required before submission for verification.',
    }))
  }, [requirements?.documents?.pre_submission])

  const providerRequestedDocuments = useMemo(() => {
    if (Array.isArray(requirements?.documents?.provider_requested)) {
      return requirements.documents.provider_requested
    }
    return []
  }, [requirements?.documents?.provider_requested])
  const savedStateErrorRoute = useMemo<Pick<BusinessKybValidationRoute, 'section' | 'field'> | null>(() => {
    if (hasInvalidNigeriaState(onboardingProfile?.state, onboardingProfile?.country)) {
      return { section: 'contact', field: 'state' }
    }
    if (hasInvalidNigeriaState(onboardingProfile?.registered_state, onboardingProfile?.registered_country)) {
      return { section: 'contact', field: 'registered_state' }
    }
    const invalidSignatory = onboardingSignatories.find((item) => hasInvalidNigeriaState(item?.state, item?.country))
    if (invalidSignatory) return { section: 'signatory', field: 'state' }
    return null
  }, [onboardingProfile, onboardingSignatories])

  const navigateToValidationRoute = useCallback((route: BusinessKybValidationRoute | null, fallbackMessage?: string) => {
    if (!route) return false
    const resolved =
      route.source === 'fallback' && route.section === 'contact' && route.field === 'state' && savedStateErrorRoute
        ? { ...route, ...savedStateErrorRoute }
        : route

    router.replace({
      pathname: '/business/onboarding',
      params: {
        section: resolved.section,
        ...(resolved.field ? { field: resolved.field } : {}),
        ...(resolved.fieldMessage ? { field_error: resolved.fieldMessage } : {}),
        ...(!resolved.fieldMessage && fallbackMessage ? { route_error: fallbackMessage } : {}),
        ...(resolved.providerStatus ? { provider_status: resolved.providerStatus } : {}),
      },
    } as any)
    return true
  }, [router, savedStateErrorRoute])
  const reviewSections = useMemo(
    () => [
      {
        key: 'business',
        title: 'Business details',
        route: '/business/onboarding?section=business',
        items: [
          summarizeItem('Business name', onboardingProfile?.legal_name || businessEntity?.name),
          summarizeItem('Business type', formatLabel(onboardingProfile?.business_type)),
          summarizeItem('Registration number', onboardingProfile?.registration_number),
          summarizeItem('Business BVN', onboardingProfile?.business_bvn),
        ],
      },
      {
        key: 'contact',
        title: 'Contact and address',
        route: '/business/onboarding?section=contact',
        items: [
          summarizeItem('Contact email', onboardingProfile?.contact_email),
          summarizeItem('Contact phone', onboardingProfile?.contact_phone),
          summarizeItem('Operating address', onboardingProfile?.address_line_1),
          summarizeItem('Operating location', addressSummary(onboardingProfile?.city, onboardingProfile?.state, onboardingProfile?.country)),
          summarizeItem('Operating state/country', addressSummary(onboardingProfile?.state, onboardingProfile?.country)),
          summarizeItem('Registered address', onboardingProfile?.registered_address_line_1),
          summarizeItem('Registered location', addressSummary(onboardingProfile?.registered_city, onboardingProfile?.registered_state, onboardingProfile?.registered_country)),
          summarizeItem('Registered state/country', addressSummary(onboardingProfile?.registered_state, onboardingProfile?.registered_country)),
        ],
      },
      {
        key: 'signatory',
        title: 'Authorized signatory',
        route: '/business/onboarding?section=signatory',
        items:
          onboardingSignatories.length > 0
            ? onboardingSignatories.slice(0, 2).map((item, index) =>
                summarizeItem(
                  onboardingSignatories.length > 1 ? `Signatory ${index + 1}` : 'Primary signatory',
                  [
                    item?.full_name || [item?.first_name, item?.last_name].filter(Boolean).join(' '),
                    item?.director === false ? 'Owner' : 'Director',
                    item?.title,
                    item?.email,
                    item?.phone,
                    addressSummary(item?.city, item?.state, item?.country),
                  ]
                    .filter(Boolean)
                    .join(' • ')
                )
              )
            : [summarizeItem('Primary signatory', '')],
      },
    ],
    [businessEntity?.name, onboardingProfile, onboardingSignatories]
  )
  const nextRecoveryAction = useMemo(() => {
    if (missingProfileFields.some((field: any) => ['contact_email', 'contact_phone', 'address_line_1', 'city', 'state', 'country', 'registered_address_line_1', 'registered_city', 'registered_state', 'registered_country'].includes(String(field)))) {
      return {
        label: 'Finish contact details',
        route: '/business/onboarding?section=contact',
        body: `Still needed: ${missingProfileFields.map((field: any) => formatLabel(field)).join(', ')}.`,
      }
    }
    if (missingSignatoryRequirements.length > 0) {
      return {
        label: 'Finish signatory details',
        route: '/business/onboarding?section=signatory',
        body: `Still needed: ${missingSignatoryRequirements.map((field: any) => formatLabel(field)).join(', ')}.`,
      }
    }
    if (missingProfileFields.length > 0) {
      return {
        label: 'Finish business details',
        route: '/business/onboarding?section=business',
        body: `Still needed: ${missingProfileFields.map((field: any) => formatLabel(field)).join(', ')}.`,
      }
    }
    if (!readiness?.documents_ready || !readiness?.ready_for_kyb_submission) {
      return {
        label: 'Upload required documents',
        route: '/business/kyb',
        body: 'Upload the minimum pre-submission documents before sending this business for review.',
      }
    }
    return null
  }, [missingProfileFields, missingSignatoryRequirements, readiness?.documents_ready, readiness?.ready_for_kyb_submission])

  const handleUpload = async (documentKind: string) => {
    if (!businessId) return
    setUploadingKind(documentKind)
    setErrorMessage(null)
    setSuccessMessage(null)
    try {
      const file = await pickKycUpload({ title: `Upload ${formatLabel(documentKind)}` })
      if (!file) return
      const response = await uploadBusinessKybDocument(businessId, {
        document_kind: documentKind,
        file,
      })
      setSuccessMessage(response?.data?.message || `${formatLabel(documentKind)} uploaded.`)
      await loadKybState({ silent: true })
    } catch (error: any) {
      const message = buildApiErrorMessage({
        status: error?.response?.status,
        data: error?.response?.data,
        fallback: error?.message || 'Unable to upload the business document right now.',
      })
      setErrorMessage(message)
    } finally {
      setUploadingKind(null)
    }
  }

  const handleSubmit = async () => {
    if (!businessId) return
    setSubmitting(true)
    setErrorMessage(null)
    setSuccessMessage(null)
    try {
      const response = await submitBusinessKyb(businessId)
      setSuccessMessage(response?.data?.message || 'Business submitted for review.')
      await loadKybState({ silent: true })
    } catch (error: any) {
      const data = error?.response?.data
      const message = buildApiErrorMessage({
        status: error?.response?.status,
        data,
        fallback: 'Unable to submit KYB right now.',
      })
      setErrorMessage(message)
      navigateToValidationRoute(resolveBusinessKybValidationRoute(data, message), message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleActivate = async () => {
    if (!businessId) return
    setActivating(true)
    setErrorMessage(null)
    setSuccessMessage(null)
    try {
      const response = await createBusinessProvisioning(businessId)
      setSuccessMessage(response?.data?.message || 'Business account activation started.')
      await loadKybState({ silent: true })
      router.replace('/business' as any)
    } catch (error: any) {
      const message = buildApiErrorMessage({
        status: error?.response?.status,
        data: error?.response?.data,
        fallback: 'Unable to activate the business account right now.',
      })
      setErrorMessage(message)
    } finally {
      setActivating(false)
    }
  }

  const handleResync = async () => {
    if (!businessId) return
    setResyncing(true)
    setErrorMessage(null)
    setSuccessMessage(null)
    try {
      const response = await resyncBusinessKyb(businessId)
      setSuccessMessage(response?.data?.message || 'Review status refreshed.')
      await loadKybState({ silent: true })
    } catch (error: any) {
      const data = error?.response?.data
      const message = buildApiErrorMessage({
        status: error?.response?.status,
        data,
        fallback: 'Unable to refresh provider status right now.',
      })
      setErrorMessage(message)
      navigateToValidationRoute(resolveBusinessKybValidationRoute(data, message), message)
    } finally {
      setResyncing(false)
    }
  }

  return (
    <ScreenContainer topPadding={20}>
      <View className="rounded-[28px] border border-[#FF7A18]/40 bg-[#151A22] p-5">
        <Text className="text-[#FFB05A] text-[11px] uppercase tracking-[2px]">Business verification</Text>
        <Text className="text-white text-2xl font-semibold mt-3">{businessEntity?.name || 'Business account'}</Text>
        <Text className="text-gray-300 text-sm mt-2">
          {String(journey?.body || 'Submit this business for verification, upload any requested documents, and wait for approval before activating business banking.')}
        </Text>
        <View className="mt-4 flex-row items-center justify-between gap-3">
          <View className="rounded-full border border-gray-700 bg-gray-950/50 px-3 py-2">
            <Text className="text-slate-300 text-[11px] font-semibold uppercase">
              {String(journey?.title || 'Verification stage')}
            </Text>
          </View>
          <Text className="text-slate-400 text-xs flex-1 text-right">Provider review can continue after submission</Text>
        </View>
      </View>

      {errorMessage ? (
        <View className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-4">
          <Text className="text-red-100 text-sm">{errorMessage}</Text>
        </View>
      ) : null}

      {successMessage ? (
        <View className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-4">
          <Text className="text-emerald-100 text-sm">{successMessage}</Text>
        </View>
      ) : null}

      {loading ? (
        <View className="py-10 items-center justify-center">
          <ActivityIndicator size="small" color="#FFB05A" />
          <Text className="text-white mt-3">Loading KYB status...</Text>
        </View>
      ) : null}

          {!loading ? (
        <>
          <View className="mt-4 rounded-2xl border border-gray-800 bg-gray-900/80 p-4">
            <View className="flex-row items-start justify-between gap-3">
              <View className="flex-1">
                <Text className="text-white text-base font-semibold">Verification checklist</Text>
                <Text className="text-gray-400 text-sm mt-2">
                  Finish the remaining requirement, submit once, then return only when you need to upload more documents or check review status.
                </Text>
              </View>
              <View className="rounded-full border border-gray-700 bg-gray-950/50 px-3 py-2">
                <Text className="text-slate-300 text-[11px] font-semibold uppercase">
                  {readyFlags.filter((item) => item.value).length}/{readyFlags.length} ready
                </Text>
              </View>
            </View>
            <View className="mt-4 gap-3">
              {readyFlags.map((item) => (
                <View key={item.label} className="rounded-2xl border border-gray-800 bg-gray-950/45 px-4 py-3 flex-row items-center justify-between">
                  <Text className="text-white text-sm font-medium">{item.label}</Text>
                  <Text className={`text-sm font-semibold ${item.value ? 'text-emerald-300' : 'text-amber-300'}`}>
                    {item.value ? 'Ready' : 'Pending'}
                  </Text>
                </View>
              ))}
            </View>

            {Array.isArray(readiness?.missing_document_kinds) && readiness.missing_document_kinds.length ? (
              <View className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-4">
                <Text className="text-amber-100 text-sm font-semibold">Missing pre-submission documents</Text>
                <Text className="text-amber-50/90 text-sm mt-2">
                  {readiness.missing_document_kinds.map((item: any) => formatLabel(item)).join(', ')}
                </Text>
              </View>
            ) : null}
          </View>

          <View className="mt-4 rounded-2xl border border-gray-800 bg-gray-900/80 p-4">
            <Text className="text-white text-base font-semibold">Review status</Text>
            <View className="mt-4 gap-3">
              <View>
                <Text className="text-gray-400 text-xs">Current stage</Text>
                <Text className={`text-base font-semibold mt-1 capitalize ${statusTone(businessEntity?.status)}`}>{businessEntity?.status || 'draft'}</Text>
              </View>
              <View>
                <Text className="text-gray-400 text-xs">Verification status</Text>
                <Text className={`text-base font-semibold mt-1 capitalize ${statusTone(provider?.anchor_kyb_status)}`}>{provider?.anchor_kyb_status || 'not_started'}</Text>
              </View>
              {provider?.anchor_failure_reason ? (
                <View className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-4">
                  <Text className="text-red-100 text-sm font-semibold">Verification note</Text>
                  <Text className="text-red-50/90 text-sm mt-2">{String(provider.anchor_failure_reason)}</Text>
                  <Text className="text-red-50/80 text-xs mt-2">
                    Update the missing document or business information, then return here and submit again.
                  </Text>
                </View>
              ) : null}
              {String(businessEntity?.status || '').toLowerCase() === 'under_review' ? (
                <View className="rounded-2xl border border-sky-500/20 bg-sky-500/10 px-4 py-4">
                  <Text className="text-sky-100 text-sm font-semibold">Your business is being reviewed</Text>
                  <Text className="text-sky-50/90 text-xs mt-2">
                    You do not need to repeat earlier setup steps. We will surface the next action here once review is complete.
                  </Text>
                </View>
              ) : null}
              {Boolean(gate?.approved_for_provisioning) ? (
                <View className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-4">
                  <Text className="text-emerald-100 text-sm font-semibold">Ready to activate</Text>
                  <Text className="text-emerald-50/90 text-xs mt-2">
                    Verification is complete. You can activate business banking directly from this screen.
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          {!canActivate && nextRecoveryAction ? (
            <View className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
              <Text className="text-amber-100 text-sm font-semibold">Next required action</Text>
              <Text className="text-amber-50/90 text-xs mt-2">{nextRecoveryAction.body}</Text>
              <TouchableOpacity onPress={() => router.push(nextRecoveryAction.route as any)} className="mt-3 rounded-2xl border border-amber-300/30 px-4 py-3 items-center">
                <Text className="text-amber-50 text-sm font-semibold">{nextRecoveryAction.label}</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <View className="mt-4 rounded-2xl border border-gray-800 bg-gray-900/80 p-4">
            <Text className="text-white text-base font-semibold">Review saved details</Text>
            <Text className="text-gray-400 text-xs mt-2">
              Check the saved business profile here before submission. Edit only the section that still needs work.
            </Text>
            <View className="mt-4 gap-3">
              {reviewSections.map((section) => (
                <View key={section.key} className="rounded-2xl border border-gray-800 bg-gray-950/45 px-4 py-4">
                  <View className="flex-row items-center justify-between gap-3">
                    <Text className="text-white text-sm font-semibold">{section.title}</Text>
                    <TouchableOpacity onPress={() => router.push(section.route as any)}>
                      <Text className="text-[#FFD7A6] text-xs font-semibold">Edit</Text>
                    </TouchableOpacity>
                  </View>
                  <View className="mt-3 gap-2">
                    {section.items.map((item) => (
                      <Text key={`${section.key}-${item.label}`} className="text-slate-300 text-xs">
                        <Text className="text-slate-500">{item.label}: </Text>
                        {item.value}
                      </Text>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          </View>

          <View className="mt-4 rounded-2xl border border-gray-800 bg-gray-900/80 p-4">
            <Text className="text-white text-base font-semibold">Documents</Text>
            <Text className="text-gray-400 text-xs mt-2">
              Upload the minimum documents required before submission first. Additional provider-requested documents may appear later during verification.
            </Text>

            <View className="mt-4">
              <Text className="text-[#FFD7A6] text-sm font-semibold">Required before submission</Text>
              <View className="mt-3 gap-3">
                {preSubmissionDocuments.map((item: any) => {
                  const documentKind = String(item?.kind || '')
                  const document = documents.find((entry) => String(entry.document_kind) === documentKind)
                  const uploading = uploadingKind === documentKind
                  return (
                    <View key={documentKind} className="rounded-2xl border border-gray-800 bg-gray-950/45 px-4 py-4">
                      <Text className="text-white text-sm font-semibold">{String(item?.label || formatLabel(documentKind))}</Text>
                      <Text className="text-gray-400 text-xs mt-1">{String(item?.description || 'Required before submission for verification.')}</Text>
                      <Text className={`text-xs mt-2 capitalize ${statusTone(document?.status || document?.provider_status || 'pending')}`}>
                        {document?.provider_status || document?.status || 'missing'}
                      </Text>
                      <Text className="text-gray-400 text-xs mt-2">
                        {document ? `Updated ${formatDate(document.provider_synced_at || document.updated_at || document.created_at)}` : 'No document uploaded yet'}
                      </Text>
                      {canUpload ? (
                        <TouchableOpacity onPress={() => handleUpload(documentKind)} disabled={uploading} className="mt-3 rounded-2xl border border-gray-700 px-4 py-3 items-center">
                          {uploading ? <ActivityIndicator size="small" color="#FFB05A" /> : <Text className="text-white text-sm font-semibold">{document ? 'Replace document' : 'Upload document'}</Text>}
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  )
                })}
              </View>
            </View>

            {providerRequestedDocuments.length ? (
              <View className="mt-5">
                <Text className="text-sky-100 text-sm font-semibold">Provider-requested documents</Text>
                <Text className="text-slate-400 text-xs mt-2">
                  These appear only when the verification provider requests additional compliance documents.
                </Text>
                <View className="mt-3 gap-3">
                  {providerRequestedDocuments.map((item: any) => {
                    const documentKind = String(item?.kind || '')
                    const document = documents.find((entry) => String(entry.document_kind) === documentKind)
                    const uploading = uploadingKind === documentKind
                    return (
                      <View key={`${documentKind}-provider`} className="rounded-2xl border border-sky-500/20 bg-sky-500/10 px-4 py-4">
                        <Text className="text-white text-sm font-semibold">{String(item?.label || formatLabel(documentKind))}</Text>
                        <Text className="text-sky-50/90 text-xs mt-1">{String(item?.description || 'Requested during provider verification.')}</Text>
                        <Text className={`text-xs mt-2 capitalize ${statusTone(document?.status || item?.provider_status || document?.provider_status || 'pending')}`}>
                          {document?.provider_status || item?.provider_status || document?.status || 'required'}
                        </Text>
                        <Text className="text-slate-300 text-xs mt-2">
                          {document ? `Updated ${formatDate(document.provider_synced_at || document.updated_at || document.created_at)}` : 'Awaiting upload'}
                        </Text>
                        {canUpload ? (
                          <TouchableOpacity onPress={() => handleUpload(documentKind)} disabled={uploading} className="mt-3 rounded-2xl border border-sky-400/30 px-4 py-3 items-center">
                            {uploading ? <ActivityIndicator size="small" color="#FFB05A" /> : <Text className="text-white text-sm font-semibold">{document ? 'Replace document' : 'Upload document'}</Text>}
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    )
                  })}
                </View>
              </View>
            ) : null}
          </View>

          <View className="mt-4 gap-3">
            {canActivate ? (
              <TouchableOpacity onPress={handleActivate} disabled={activating} className="rounded-2xl bg-[#FFB05A] px-4 py-4 items-center">
                {activating ? <ActivityIndicator size="small" color="#111827" /> : <Text className="text-black text-sm font-semibold">Activate business banking</Text>}
              </TouchableOpacity>
            ) : canSubmit ? (
              <TouchableOpacity onPress={handleSubmit} disabled={submitting} className="rounded-2xl bg-[#FFB05A] px-4 py-4 items-center">
                {submitting ? <ActivityIndicator size="small" color="#111827" /> : <Text className="text-black text-sm font-semibold">Submit business for verification</Text>}
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity onPress={handleResync} disabled={resyncing} className="rounded-2xl border border-gray-700 px-4 py-4 items-center">
              {resyncing ? <ActivityIndicator size="small" color="#FFB05A" /> : <Text className="text-white text-sm font-semibold">Refresh verification status</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.replace('/business' as any)} className="rounded-2xl border border-gray-700 px-4 py-4 items-center">
              <Text className="text-white text-sm font-semibold">Back to business overview</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : null}
    </ScreenContainer>
  )
}

export default BusinessKybScreen
