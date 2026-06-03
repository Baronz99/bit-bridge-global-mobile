import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'expo-router'
import { ActivityIndicator, LayoutChangeEvent, ScrollView, Text, TouchableOpacity, View } from 'react-native'
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
const DIRECTOR_IDENTIFICATION_KIND = 'director_identification'
const DIRECTOR_IDENTIFICATION_SYNC_STATUS = 'local_pending_provider_route'
const CONTACT_BLOCKER_FIELDS = [
  'contact_email',
  'contact_phone',
  'address_line_1',
  'city',
  'state',
  'country',
  'registered_address_line_1',
  'registered_city',
  'registered_state',
  'registered_country',
]

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

const neutralizeProviderCopy = (value: unknown) =>
  String(value || '')
    .replace(/\bAnchor requested additional business documents\./gi, 'Additional business documents are required.')
    .replace(/\bAnchor requested additional business documents\b/gi, 'Additional business documents are required')
    .replace(/\bAnchor\b/g, 'BitBridge')
    .replace(/\bprovider-requested documents\b/gi, 'additional requested documents')
    .replace(/\bprovider-requested\b/gi, 'additional')
    .replace(/\bProvider documents required\b/g, 'Additional documents required')
    .replace(/\bprovider review\b/gi, 'verification review')
    .replace(/\bverification provider\b/gi, 'verification process')
    .replace(/\bprovider submission\b/gi, 'verification submission')
    .replace(/\bprovider status\b/gi, 'verification status')
    .replace(/\bprovider\b/gi, 'verification')

const UPLOADED_PROVIDER_STATUSES = ['submitted', 'uploaded', 'pending', 'approved', 'verified']

const providerDocumentType = (item: any) =>
  String(item?.provider_type || item?.provider_document_type || item?.type || item?.metadata?.provider_type || '').trim().toUpperCase()

const providerDocumentId = (item: any) =>
  String(item?.provider_document_id || item?.provider_id || item?.id || '').trim()

const providerDocumentKey = (item: any, index: number) =>
  providerDocumentId(item) || providerDocumentType(item) || String(item?.kind || item?.document_kind || `provider-doc-${index}`)

const isUploadedProviderDocument = (document: any, item?: any) => {
  const status = String(document?.provider_status || document?.status || item?.provider_status || item?.status || '').toLowerCase()
  return UPLOADED_PROVIDER_STATUSES.includes(status)
}

const providerRequirementInputType = (item: any) =>
  String(item?.input_type || item?.metadata?.input_type || 'file').trim().toLowerCase()

const providerRequirementDocumentKind = (item: any) =>
  String(item?.document_kind || item?.kind || '').trim()

const providerRequirementProfileField = (item: any) =>
  String(item?.profile_field || item?.metadata?.profile_field || '').trim()

const providerRequirementActionLabel = (item: any) =>
  String(item?.action_label || '').trim()

const isProviderRequirementValuePresent = (item: any) =>
  item?.current_value_present === true || item?.current_value_present === 'true'

const canAutoSubmitProviderRequirement = (item: any) =>
  item?.can_auto_submit === true || item?.can_auto_submit === 'true'

const routeForProfileField = (field: string) => {
  if (!field) return { section: 'business', field: undefined }
  if (['registration_number', 'tax_identifier', 'business_bvn'].includes(field)) return { section: 'business', field }
  if (field.includes('state') || field.includes('country') || field.includes('address')) return { section: 'contact', field }
  return { section: 'business', field }
}

const statusSummaryForRequirement = (row: ProviderDocumentRow) => {
  if (row.uploaded) return row.document?.provider_synced_at ? `Synced ${formatDate(row.document.provider_synced_at)}` : 'Submitted for review'
  if (row.inputType === 'file') return 'Upload required'
  if (row.currentValuePresent) return 'Saved value ready to submit'
  if (row.profileField === 'tax_identifier') return 'Enter TIN in business details'
  if (row.profileField === 'registration_number') return 'Registration number is required'
  return 'Information required'
}

const uploadNoticeTitle = (notice: UploadNotice) => {
  if (notice.phase === 'success') return `${notice.label} uploaded`
  if (notice.phase === 'error') return `${notice.label} upload needs attention`
  if (notice.phase === 'refreshing') return `Confirming ${notice.label}`
  if (notice.phase === 'selecting') return `Select ${notice.label}`
  return `Uploading ${notice.label}`
}

const uploadNoticeBody = (notice: UploadNotice) => {
  if (notice.message) return notice.message
  if (notice.phase === 'success') return 'Document uploaded successfully. Verification status may take a few moments to update.'
  if (notice.phase === 'error') return 'Upload failed. Check your connection and retry.'
  if (notice.phase === 'refreshing') return 'Upload received. Refreshing verification status now.'
  if (notice.phase === 'selecting') return 'Choose a JPG, PNG, or PDF document.'
  return 'Please keep this screen open while the document uploads.'
}

const uploadNoticeTone = (phase: UploadPhase) => {
  if (phase === 'success') return 'border-emerald-500/30 bg-emerald-500/10'
  if (phase === 'error') return 'border-red-500/30 bg-red-500/10'
  return 'border-amber-500/30 bg-amber-500/10'
}

const uploadNoticeTextTone = (phase: UploadPhase) => {
  if (phase === 'success') return 'text-emerald-100'
  if (phase === 'error') return 'text-red-100'
  return 'text-amber-100'
}

const uploadPhaseLabel = (phase?: UploadPhase) => {
  if (phase === 'selecting') return 'Selecting file...'
  if (phase === 'uploading') return 'Uploading...'
  if (phase === 'refreshing') return 'Refreshing status...'
  if (phase === 'success') return 'Uploaded successfully'
  if (phase === 'error') return 'Upload failed'
  return null
}

const hasDirectorIdentificationEvidence = (document: any) =>
  Boolean(
    document &&
      String(document.document_kind || '') === DIRECTOR_IDENTIFICATION_KIND &&
      ['submitted', 'approved', 'verified'].includes(String(document.status || '').toLowerCase())
  )

const hasOfficerIdMetadata = (signatory: any) =>
  Boolean(
    String(signatory?.identification_type || '').trim() &&
      String(signatory?.id_document_number || '').trim()
  )

const isDirectorOrBeneficialOwner = (signatory: any) => {
  const ownership = Number(signatory?.ownership_percentage || 0)
  return signatory?.director !== false || ownership >= 70
}

type ProviderDocumentRow = {
  key: string
  item: any
  document: any
  uploaded: boolean
  label: string
  status: string
  inputType: string
  documentKind: string
  profileField: string
  providerDocumentId: string
  actionLabel: string
  currentValuePresent: boolean
  canAutoSubmit: boolean
}

type UploadPhase = 'selecting' | 'uploading' | 'refreshing' | 'success' | 'error'

type UploadNotice = {
  key: string
  label: string
  phase: UploadPhase
  fileName?: string
  message?: string
}

type SubmissionBlocker = {
  key: string
  title: string
  body: string
  actionLabel: string
  onPress: () => void
}

const BusinessKybScreen = () => {
  const router = useRouter()
  const scrollRef = useRef<ScrollView | null>(null)
  const { activeAccount } = useActiveAccount()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [resyncing, setResyncing] = useState(false)
  const [uploadingKind, setUploadingKind] = useState<string | null>(null)
  const [uploadNotice, setUploadNotice] = useState<UploadNotice | null>(null)
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
  const [documentsSectionY, setDocumentsSectionY] = useState(0)
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
  const missingDocumentKinds = Array.isArray(readiness?.missing_document_kinds) ? readiness.missing_document_kinds : []
  const readyForSubmission = Boolean(readiness?.ready_for_kyb_submission)
  const readyFlags = useMemo(() => [
    { label: 'Business details complete', value: Boolean(readiness?.profile_ready) },
    { label: 'Required documents uploaded', value: Boolean(readiness?.documents_ready) },
    { label: 'Ready for review', value: readyForSubmission },
    { label: 'Ready to activate', value: canActivate },
  ], [canActivate, readiness?.documents_ready, readiness?.profile_ready, readyForSubmission])

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

  const providerDocumentRows = useMemo<ProviderDocumentRow[]>(() => {
    const requested = providerRequestedDocuments.length
      ? providerRequestedDocuments
      : documents.filter((entry) => String(entry?.provider_status || entry?.status || '').toLowerCase() === 'required')

    return requested.map((item: any, index: number) => {
      const requestedProviderId = providerDocumentId(item)
      const requestedProviderType = providerDocumentType(item)
      const requestedKind = providerRequirementDocumentKind(item)
      const document = documents.find((entry) => {
        const entryProviderId = providerDocumentId(entry)
        if (requestedProviderId && entryProviderId === requestedProviderId) return true
        if (requestedProviderType && providerDocumentType(entry) === requestedProviderType) return true
        return Boolean(requestedKind && String(entry?.document_kind || entry?.kind || '') === requestedKind && !entryProviderId)
      })
      const uploaded = isUploadedProviderDocument(document, item)
      const inputType = providerRequirementInputType(item)
      const profileField = providerRequirementProfileField(item)
      const actionLabel = providerRequirementActionLabel(item)

      return {
        key: providerDocumentKey(item, index),
        item,
        document,
        uploaded,
        label: String(item?.label || item?.name || formatLabel(requestedProviderType || requestedKind || 'Document')),
        status: String(document?.provider_status || document?.status || item?.provider_status || item?.status || 'required'),
        inputType,
        documentKind: requestedKind,
        profileField,
        providerDocumentId: requestedProviderId,
        actionLabel,
        currentValuePresent: isProviderRequirementValuePresent(item),
        canAutoSubmit: canAutoSubmitProviderRequirement(item),
      }
    })
  }, [documents, providerRequestedDocuments])

  const providerActionRequired = useMemo(
    () => String(provider?.anchor_kyb_status || '').toLowerCase() === 'awaiting_documents' || providerRequestedDocuments.length > 0,
    [provider?.anchor_kyb_status, providerRequestedDocuments.length]
  )
  const uploadedProviderRows = useMemo(() => providerDocumentRows.filter((row: ProviderDocumentRow) => row.uploaded), [providerDocumentRows])
  const missingProviderRows = useMemo(() => providerDocumentRows.filter((row: ProviderDocumentRow) => !row.uploaded), [providerDocumentRows])
  const directorIdentificationDocument = useMemo(
    () => documents.find((entry) => String(entry?.document_kind || '') === DIRECTOR_IDENTIFICATION_KIND),
    [documents]
  )
  const directorIdentificationCollected = useMemo(
    () => hasDirectorIdentificationEvidence(directorIdentificationDocument),
    [directorIdentificationDocument]
  )
  const directorIdentificationRequired = useMemo(
    () =>
      onboardingSignatories.some(
        (item) =>
          isDirectorOrBeneficialOwner(item) &&
          hasOfficerIdMetadata(item)
      ) && !directorIdentificationCollected,
    [directorIdentificationCollected, onboardingSignatories]
  )
  const directorIdentificationPendingProviderRoute =
    directorIdentificationCollected &&
    String(directorIdentificationDocument?.last_sync_status || '') === DIRECTOR_IDENTIFICATION_SYNC_STATUS
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

  const providerFailureRoute = useMemo<BusinessKybValidationRoute | null>(() => {
    const message = String(provider?.anchor_failure_reason || '').trim()
    if (!message) return null

    const metadata = provider?.anchor_last_sync_metadata || {}
    const structuredRoute = resolveBusinessKybValidationRoute(
      {
        message,
        error_code: metadata?.error_code,
        field_path: metadata?.field_path,
        section: metadata?.section,
        field_errors: metadata?.field_errors || metadata?.validation_errors,
        provider_status: provider?.anchor_kyb_status,
      },
      message
    )
    if (structuredRoute) return structuredRoute

    if (savedStateErrorRoute) {
      return {
        ...savedStateErrorRoute,
        fieldMessage: 'Update this field and save again.',
        providerStatus: String(provider?.anchor_kyb_status || ''),
        source: 'fallback',
      }
    }

    return resolveBusinessKybValidationRoute(message, message)
  }, [provider, savedStateErrorRoute])

  const providerFailureTitle = useMemo(() => {
    if (!providerFailureRoute) return 'Verification needs attention'
    if (providerFailureRoute.section === 'signatory') return 'Signatory information needs correction'
    if (providerFailureRoute.field?.includes('registered')) return 'Registered address needs correction'
    if (providerFailureRoute.field === 'state' || providerFailureRoute.field === 'country') return 'Address information needs correction'
    return 'Business information needs correction'
  }, [providerFailureRoute])

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
        mode: 'fix',
        return_to: 'kyb',
      },
    } as any)
    return true
  }, [router, savedStateErrorRoute])

  const handleFixProviderFailure = useCallback(() => {
    navigateToValidationRoute(providerFailureRoute, String(provider?.anchor_failure_reason || 'Update the highlighted field and resubmit verification.'))
  }, [navigateToValidationRoute, provider?.anchor_failure_reason, providerFailureRoute])

  const handleDocumentsSectionLayout = useCallback((event: LayoutChangeEvent) => {
    setDocumentsSectionY(event.nativeEvent.layout.y)
  }, [])

  const handleUploadMissingDocuments = useCallback(() => {
    if (documentsSectionY > 0) {
      scrollRef.current?.scrollTo({ y: Math.max(documentsSectionY - 16, 0), animated: true })
      return
    }
    router.push('/business/kyb' as any)
  }, [documentsSectionY, router])

  const navigateToProfileField = useCallback((field: string, message?: string) => {
    const route = routeForProfileField(field)
    router.replace({
      pathname: '/business/onboarding',
      params: {
        section: route.section,
        ...(route.field ? { field: route.field } : {}),
        ...(message ? { field_error: message } : {}),
        mode: 'fix',
        return_to: 'kyb',
      },
    } as any)
  }, [router])

  const navigateToSetupField = useCallback((section: string, field?: string, message?: string) => {
    router.replace({
      pathname: '/business/onboarding',
      params: {
        section,
        ...(field ? { field } : {}),
        ...(message ? { field_error: message } : {}),
        mode: 'fix',
        return_to: 'kyb',
      },
    } as any)
  }, [router])

  const submissionBlockers = useMemo<SubmissionBlocker[]>(() => {
    if (readyForSubmission) return []

    const blockers: SubmissionBlocker[] = []

    missingProfileFields.forEach((field: any) => {
      const key = String(field || '').trim()
      if (!key) return

      if (key === 'anchor_industry') {
        blockers.push({
          key: `profile-${key}`,
          title: 'Select industry subcategory',
          body: 'Choose the exact industry subcategory before verification can start.',
          actionLabel: 'Fix industry',
          onPress: () => navigateToSetupField('business', 'anchor_industry', 'Select the business industry subcategory before submitting.'),
        })
        return
      }

      const section = CONTACT_BLOCKER_FIELDS.includes(key) ? 'contact' : 'business'
      blockers.push({
        key: `profile-${key}`,
        title: `${formatLabel(key)} required`,
        body: 'Complete this saved business detail before submitting for verification.',
        actionLabel: section === 'contact' ? 'Fix contact details' : 'Fix business details',
        onPress: () => navigateToSetupField(section, key, `${formatLabel(key)} is required before submitting.`),
      })
    })

    missingSignatoryRequirements.forEach((field: any) => {
      const key = String(field || '').trim()
      if (!key) return

      if (key === 'authorized_signatory') {
        blockers.push({
          key: `signatory-${key}`,
          title: 'Mark an authorized signatory',
          body: 'At least one signatory must be marked authorized for verification and account control.',
          actionLabel: 'Fix signatory',
          onPress: () => navigateToSetupField('signatory', 'authorized_signatory', 'Mark at least one signatory as authorized before submitting.'),
        })
        return
      }

      blockers.push({
        key: `signatory-${key}`,
        title: `${formatLabel(key)} required`,
        body: 'Complete the authorized signatory information before submitting.',
        actionLabel: 'Fix signatory',
        onPress: () => navigateToSetupField('signatory', key, `${formatLabel(key)} is required before submitting.`),
      })
    })

    missingDocumentKinds.forEach((kind: any) => {
      const key = String(kind || '').trim()
      if (!key) return
      blockers.push({
        key: `document-${key}`,
        title: `Upload ${formatLabel(key)}`,
        body: 'Upload this business document before submitting for verification.',
        actionLabel: 'Upload document',
        onPress: handleUploadMissingDocuments,
      })
    })

    if (!readiness?.documents_ready && !missingDocumentKinds.length) {
      blockers.push({
        key: 'documents',
        title: 'Upload required documents',
        body: 'Upload the minimum pre-submission documents before sending this business for review.',
        actionLabel: 'Upload documents',
        onPress: handleUploadMissingDocuments,
      })
    }

    return blockers
  }, [
    handleUploadMissingDocuments,
    missingDocumentKinds,
    missingProfileFields,
    missingSignatoryRequirements,
    navigateToSetupField,
    readiness?.documents_ready,
    readyForSubmission,
  ])

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
        title: 'Operating and registered addresses',
        route: '/business/onboarding?section=contact',
        items: [
          summarizeItem('Contact email', onboardingProfile?.contact_email),
          summarizeItem('Contact phone', onboardingProfile?.contact_phone),
          summarizeItem('Operating address line 1', onboardingProfile?.address_line_1),
          summarizeItem('Operating address line 2', onboardingProfile?.address_line_2),
          summarizeItem('Operating city', onboardingProfile?.city),
          summarizeItem('Operating state', onboardingProfile?.state),
          summarizeItem('Operating country', onboardingProfile?.country),
          summarizeItem('Operating postal code', onboardingProfile?.postal_code),
          summarizeItem('Registered address line 1', onboardingProfile?.registered_address_line_1),
          summarizeItem('Registered address line 2', onboardingProfile?.registered_address_line_2),
          summarizeItem('Registered city', onboardingProfile?.registered_city),
          summarizeItem('Registered state', onboardingProfile?.registered_state),
          summarizeItem('Registered country', onboardingProfile?.registered_country),
          summarizeItem('Registered postal code', onboardingProfile?.registered_postal_code),
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
      {
        key: 'signatory_values',
        title: 'Signatory field values',
        route: '/business/onboarding?section=signatory',
        items:
          onboardingSignatories.length > 0
            ? onboardingSignatories.flatMap((item, index) => {
                const prefix = onboardingSignatories.length > 1 ? `Signatory ${index + 1}` : 'Primary signatory'
                return [
                  summarizeItem(`${prefix} full name`, item?.full_name || [item?.first_name, item?.last_name].filter(Boolean).join(' ')),
                  summarizeItem(`${prefix} title`, item?.title),
                  summarizeItem(`${prefix} email`, item?.email),
                  summarizeItem(`${prefix} phone`, item?.phone),
                  summarizeItem(`${prefix} date of birth`, item?.date_of_birth),
                  summarizeItem(`${prefix} nationality`, item?.nationality),
                  summarizeItem(`${prefix} address`, item?.address_line_1),
                  summarizeItem(`${prefix} city`, item?.city),
                  summarizeItem(`${prefix} state`, item?.state),
                  summarizeItem(`${prefix} country`, item?.country),
                  summarizeItem(`${prefix} ID type`, item?.identification_type),
                  summarizeItem(`${prefix} ID number`, item?.id_document_number),
                  summarizeItem(`${prefix} role flags`, `${item?.authorized_signatory === false ? 'Not authorized signatory' : 'Authorized signatory'} / ${item?.director === false ? 'Not director' : 'Director'}`),
                ]
              })
            : [summarizeItem('Primary signatory', '')],
      },
    ],
    [businessEntity?.name, onboardingProfile, onboardingSignatories]
  )
  const handleUpload = async (documentKind: string, providerDocumentIdValue?: string, label?: string, forceReplace = false) => {
    if (!businessId) return
    const uploadingKey = providerDocumentIdValue || documentKind
    const uploadLabel = label || formatLabel(documentKind)
    setUploadingKind(uploadingKey)
    setUploadNotice({
      key: uploadingKey,
      label: uploadLabel,
      phase: 'selecting',
      message: 'Choose a JPG, PNG, or PDF document.',
    })
    setErrorMessage(null)
    setSuccessMessage(null)
    try {
      const file = await pickKycUpload({ title: `Upload ${uploadLabel}` })
      if (!file) {
        setUploadNotice(null)
        return
      }
      setUploadNotice({
        key: uploadingKey,
        label: uploadLabel,
        phase: 'uploading',
        fileName: file.name,
        message: `${file.name || 'Document'} is uploading. Please keep this screen open.`,
      })
      const response = await uploadBusinessKybDocument(businessId, {
        document_kind: documentKind,
        provider_document_id: providerDocumentIdValue,
        file,
        force: forceReplace || Boolean(providerDocumentIdValue),
      })
      const success =
        documentKind === DIRECTOR_IDENTIFICATION_KIND && !providerDocumentIdValue
          ? 'ID collected. We will submit it to our banking partner if required.'
          : response?.data?.message || `${uploadLabel} uploaded successfully.`
      setSuccessMessage(
        documentKind === DIRECTOR_IDENTIFICATION_KIND && !providerDocumentIdValue
          ? success
          : `${success} Verification status may take a few moments to update.`
      )
      setUploadNotice({
        key: uploadingKey,
        label: uploadLabel,
        phase: 'refreshing',
        fileName: file.name,
        message: 'Upload received. Refreshing verification status now.',
      })
      try {
        await loadKybState({ silent: true })
        setUploadNotice({
          key: uploadingKey,
          label: uploadLabel,
          phase: 'success',
          fileName: file.name,
          message:
            documentKind === DIRECTOR_IDENTIFICATION_KIND && !providerDocumentIdValue
              ? 'ID collected. We will submit it to our banking partner if required.'
              : `${file.name || uploadLabel} uploaded successfully.`,
        })
      } catch {
        setUploadNotice({
          key: uploadingKey,
          label: uploadLabel,
          phase: 'success',
          fileName: file.name,
          message:
            documentKind === DIRECTOR_IDENTIFICATION_KIND && !providerDocumentIdValue
              ? 'ID collected. Pull down or tap Refresh verification status if the latest status is not visible yet.'
              : 'Document uploaded successfully. Pull down or tap Refresh verification status if the latest status is not visible yet.',
        })
      }
    } catch (error: any) {
      const message = buildApiErrorMessage({
        status: error?.response?.status,
        data: error?.response?.data,
        fallback: error?.message || 'Unable to upload the business document right now.',
      })
      setUploadNotice({
        key: uploadingKey,
        label: uploadLabel,
        phase: 'error',
        message,
      })
      setErrorMessage(message)
    } finally {
      setUploadingKind(null)
    }
  }

  const handleSubmitProviderRequirement = async (row: ProviderDocumentRow) => {
    if (!businessId) return
    if (!row.documentKind) {
      setErrorMessage('This requirement is missing a document type. Refresh verification status and try again.')
      return
    }

    const uploadingKey = row.providerDocumentId || row.key
    setUploadingKind(uploadingKey)
    setErrorMessage(null)
    setSuccessMessage(null)
    try {
      const response = await uploadBusinessKybDocument(businessId, {
        document_kind: row.documentKind,
        provider_document_id: row.providerDocumentId,
        force: true,
      })
      setSuccessMessage(response?.data?.message || `${row.label} submitted.`)
      await loadKybState({ silent: true })
    } catch (error: any) {
      const message = buildApiErrorMessage({
        status: error?.response?.status,
        data: error?.response?.data,
        fallback: error?.message || 'Unable to submit this requirement right now.',
      })
      setErrorMessage(message)
    } finally {
      setUploadingKind(null)
    }
  }

  const handleProviderRequirementAction = (row: ProviderDocumentRow) => {
    if (row.inputType === 'file') {
      void handleUpload(row.documentKind, row.providerDocumentId, row.label, true)
      return
    }
    if (row.canAutoSubmit || row.currentValuePresent) {
      void handleSubmitProviderRequirement(row)
      return
    }
    navigateToProfileField(row.profileField, `${row.label} is required before verification can continue.`)
  }

  const handleSubmit = async () => {
    if (!businessId) return
    if (!readyForSubmission) {
      setErrorMessage('Complete the required items above before submitting for verification.')
      return
    }
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
        fallback: 'Unable to refresh verification status right now.',
      })
      setErrorMessage(message)
      navigateToValidationRoute(resolveBusinessKybValidationRoute(data, message), message)
    } finally {
      setResyncing(false)
    }
  }

  return (
    <ScreenContainer topPadding={16} horizontalPadding={14} scrollProps={{ ref: scrollRef } as any}>
      <View className="rounded-[24px] border border-[#FF7A18]/40 bg-[#151A22] p-4">
        <Text className="text-[#FFB05A] text-[11px] uppercase tracking-[2px]">Business verification</Text>
        <Text className="text-white text-2xl font-semibold mt-3">{businessEntity?.name || 'Business account'}</Text>
        <Text className="text-gray-300 text-sm mt-2">
          {neutralizeProviderCopy(journey?.body || 'Submit this business for verification, upload any requested documents, and wait for approval before activating business banking.')}
        </Text>
        <View className="mt-4 gap-2">
          <View className="self-start rounded-full border border-gray-700 bg-gray-950/50 px-3 py-2">
            <Text className="text-slate-300 text-[11px] font-semibold uppercase">
              {neutralizeProviderCopy(journey?.title || 'Verification stage')}
            </Text>
          </View>
          <Text className="text-slate-400 text-xs">Verification review can continue after submission</Text>
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

      {uploadNotice ? (
        <View className={`mt-4 rounded-2xl px-4 py-4 border ${uploadNoticeTone(uploadNotice.phase)}`}>
          <View className="flex-row items-start gap-3">
            {['selecting', 'uploading', 'refreshing'].includes(uploadNotice.phase) ? (
              <ActivityIndicator size="small" color="#FFB05A" />
            ) : null}
            <View className="flex-1">
              <Text className={`text-sm font-semibold ${uploadNoticeTextTone(uploadNotice.phase)}`}>
                {uploadNoticeTitle(uploadNotice)}
              </Text>
              <Text className={`text-xs mt-2 ${uploadNoticeTextTone(uploadNotice.phase)}`}>
                {uploadNoticeBody(uploadNotice)}
              </Text>
              {uploadNotice.fileName ? (
                <Text className="text-slate-300 text-[11px] mt-2">File: {uploadNotice.fileName}</Text>
              ) : null}
            </View>
          </View>
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
            {providerActionRequired ? (
              <View className="mb-4 rounded-[24px] border border-amber-400/40 bg-amber-500/10 p-4">
                <Text className="text-amber-100 text-lg font-semibold">Action required</Text>
                <Text className="text-amber-50/90 text-sm mt-2">
                  Additional business documents are required before verification can continue.
                </Text>

                {providerDocumentRows.length ? (
                  <View className="mt-4 gap-3">
                    {missingProviderRows.length ? (
                      <View>
                        <Text className="text-amber-100 text-xs font-semibold uppercase tracking-[1px]">Missing documents</Text>
                        <View className="mt-2 gap-2">
                          {missingProviderRows.map((row: ProviderDocumentRow) => (
                            <View key={`missing-${row.key}`} className="rounded-2xl border border-amber-300/25 bg-black/20 px-3 py-3">
                              <Text className="text-white text-sm font-semibold">{row.label}</Text>
                              <Text className={`text-xs mt-1 capitalize ${statusTone(row.status)}`}>{row.status}</Text>
                              <Text className="text-amber-50/75 text-xs mt-1">{statusSummaryForRequirement(row)}</Text>
                              <Text className="text-amber-50/60 text-[11px] mt-1">
                                {row.inputType === 'file' ? 'Document upload' : row.currentValuePresent ? 'Saved business information' : 'Business information'}
                              </Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    ) : null}

                    {uploadedProviderRows.length ? (
                      <View>
                        <Text className="text-emerald-100 text-xs font-semibold uppercase tracking-[1px]">Already uploaded</Text>
                        <View className="mt-2 gap-2">
                          {uploadedProviderRows.map((row: ProviderDocumentRow) => (
                            <View key={`uploaded-${row.key}`} className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-3 py-3">
                              <Text className="text-white text-sm font-semibold">{row.label}</Text>
                              <Text className={`text-xs mt-1 capitalize ${statusTone(row.status)}`}>{row.status}</Text>
                              <Text className="text-emerald-50/80 text-xs mt-1">
                                {row.document?.provider_synced_at ? `Synced ${formatDate(row.document.provider_synced_at)}` : 'Uploaded locally'}
                              </Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    ) : null}
                  </View>
                ) : (
                  <Text className="text-amber-50/80 text-xs mt-4">
                    Refresh verification status if the requested document list has not loaded yet.
                  </Text>
                )}

                <TouchableOpacity onPress={handleUploadMissingDocuments} className="mt-4 rounded-2xl bg-[#FFB05A] px-4 py-4 items-center">
                  <Text className="text-black text-sm font-semibold">Complete required items</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {directorIdentificationRequired ? (
              <View className="mb-4 rounded-[24px] border border-amber-400/40 bg-amber-500/10 p-4">
                <Text className="text-amber-100 text-lg font-semibold">Upload director ID</Text>
                <Text className="text-amber-50/90 text-sm mt-2">
                  Upload a valid ID for the director or beneficial owner. Accepted documents include NIN slip, National ID, passport, or driver&apos;s license.
                </Text>
                <Text className="text-amber-50/75 text-xs mt-3">
                  This collects the ID securely. We will submit it to our banking partner if it is required during review.
                </Text>
                {canUpload ? (
                  <TouchableOpacity
                    onPress={() => handleUpload(DIRECTOR_IDENTIFICATION_KIND, undefined, 'Director ID', true)}
                    disabled={uploadingKind === DIRECTOR_IDENTIFICATION_KIND}
                    className="mt-4 rounded-2xl bg-[#FFB05A] px-4 py-4 items-center"
                  >
                    <Text className="text-black text-sm font-semibold">
                      {uploadingKind === DIRECTOR_IDENTIFICATION_KIND ? 'Uploading...' : 'Upload director ID'}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}

            {directorIdentificationPendingProviderRoute ? (
              <View className="mb-4 rounded-[24px] border border-sky-400/30 bg-sky-500/10 p-4">
                <Text className="text-sky-100 text-lg font-semibold">Director ID collected</Text>
                <Text className="text-sky-50/90 text-sm mt-2">
                  ID collected. We will submit it to our banking partner if required.
                </Text>
                <Text className="text-sky-50/70 text-xs mt-2">
                  File: {directorIdentificationDocument?.file_name || 'Uploaded ID document'}
                </Text>
                {canUpload ? (
                  <TouchableOpacity
                    onPress={() => handleUpload(DIRECTOR_IDENTIFICATION_KIND, undefined, 'Director ID', true)}
                    disabled={uploadingKind === DIRECTOR_IDENTIFICATION_KIND}
                    className="mt-4 rounded-2xl border border-sky-300/40 px-4 py-3 items-center"
                  >
                    <Text className="text-sky-50 text-sm font-semibold">
                      {uploadingKind === DIRECTOR_IDENTIFICATION_KIND ? 'Uploading...' : 'Replace director ID'}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}

            {!readyForSubmission && submissionBlockers.length ? (
              <View className="mb-4 rounded-[24px] border border-amber-400/35 bg-amber-500/10 p-4">
                <Text className="text-amber-100 text-lg font-semibold">Complete setup before submission</Text>
                <Text className="text-amber-50/90 text-sm mt-2">
                  Finish each required item below. Verification can only be submitted after all blockers are cleared.
                </Text>
                <View className="mt-4 gap-3">
                  {submissionBlockers.map((blocker) => (
                    <View key={blocker.key} className="rounded-2xl border border-amber-300/25 bg-black/20 px-3 py-3">
                      <Text className="text-white text-sm font-semibold">{blocker.title}</Text>
                      <Text className="text-amber-50/80 text-xs mt-1">{blocker.body}</Text>
                      <TouchableOpacity onPress={blocker.onPress} className="mt-3 rounded-2xl bg-[#FFB05A] px-4 py-3 items-center">
                        <Text className="text-black text-sm font-semibold">{blocker.actionLabel}</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            <View className="gap-3">
              <View>
                <Text className="text-white text-base font-semibold">Business profile completion</Text>
                <Text className="text-gray-400 text-sm mt-2">
                  These checks confirm the saved profile, documents, and signatory details are complete before verification review.
                </Text>
              </View>
              <View className="self-start rounded-full border border-gray-700 bg-gray-950/50 px-3 py-2">
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
            <Text className="text-white text-base font-semibold">Verification review</Text>
            <View className="mt-4 gap-3">
              <View>
                <Text className="text-gray-400 text-xs">Verification status</Text>
                <Text className={`text-base font-semibold mt-1 capitalize ${statusTone(provider?.anchor_kyb_status)}`}>{provider?.anchor_kyb_status || 'not_started'}</Text>
              </View>
              <View>
                <Text className="text-gray-400 text-xs">Onboarding stage</Text>
                <Text className={`text-base font-semibold mt-1 capitalize ${statusTone(businessEntity?.status)}`}>{businessEntity?.status || 'draft'}</Text>
              </View>
              {provider?.anchor_failure_reason ? (
                <View className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-4">
                  <Text className="text-red-100 text-sm font-semibold">{providerFailureTitle}</Text>
                  <Text className="text-red-50/90 text-sm mt-2">{neutralizeProviderCopy(provider.anchor_failure_reason)}</Text>
                  <Text className="text-red-50/80 text-xs mt-2">
                    This message came from the previous verification submission. Save the corrected field, then return here and submit verification again.
                  </Text>
                  {providerFailureRoute ? (
                    <TouchableOpacity onPress={handleFixProviderFailure} className="mt-3 rounded-2xl border border-red-200/40 px-4 py-3 items-center">
                      <Text className="text-red-50 text-sm font-semibold">Fix Now</Text>
                    </TouchableOpacity>
                  ) : null}
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
              {gate?.approved_for_provisioning ? (
                <View className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-4">
                  <Text className="text-emerald-100 text-sm font-semibold">Ready to activate</Text>
                  <Text className="text-emerald-50/90 text-xs mt-2">
                    Verification is complete. You can activate business banking directly from this screen.
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

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

          <View onLayout={handleDocumentsSectionLayout} className="mt-4 rounded-2xl border border-gray-800 bg-gray-900/80 p-4">
            <Text className="text-white text-base font-semibold">Documents</Text>
            <Text className="text-gray-400 text-xs mt-2">
              Upload the minimum documents required before submission first. Additional requested documents may appear later during verification.
            </Text>

            <View className="mt-4">
              <Text className="text-[#FFD7A6] text-sm font-semibold">Required before submission</Text>
              <View className="mt-3 gap-3">
                {preSubmissionDocuments.map((item: any) => {
                  const documentKind = String(item?.kind || '')
                  const document = documents.find((entry) => String(entry.document_kind) === documentKind)
                  const documentProviderId = providerDocumentId(document)
                  const uploading = uploadingKind === documentKind || Boolean(documentProviderId && uploadingKind === documentProviderId)
                  const uploadPhase = uploadNotice?.key === documentKind || (documentProviderId && uploadNotice?.key === documentProviderId)
                    ? uploadNotice.phase
                    : null
                  const phaseLabel = uploadPhaseLabel(uploadPhase || undefined)
                  return (
                    <View key={documentKind} className="rounded-2xl border border-gray-800 bg-gray-950/45 px-4 py-4">
                      <Text className="text-white text-sm font-semibold">{String(item?.label || formatLabel(documentKind))}</Text>
                      <Text className="text-gray-400 text-xs mt-1">{String(item?.description || 'Required before submission for verification.')}</Text>
                      <Text className={`text-xs mt-2 capitalize ${statusTone(document?.status || document?.provider_status || 'pending')}`}>
                        {document?.provider_status || document?.status || 'missing'}
                      </Text>
                      {phaseLabel ? (
                        <Text className={`text-xs mt-2 ${uploadPhase === 'error' ? 'text-red-200' : uploadPhase === 'success' ? 'text-emerald-200' : 'text-amber-200'}`}>
                          {phaseLabel}
                        </Text>
                      ) : null}
                      <Text className="text-gray-400 text-xs mt-2">
                        {document ? `Updated ${formatDate(document.provider_synced_at || document.updated_at || document.created_at)}` : 'No document uploaded yet'}
                      </Text>
                      {canUpload ? (
                        <TouchableOpacity onPress={() => handleUpload(documentKind, documentProviderId, String(item?.label || formatLabel(documentKind)), Boolean(documentProviderId))} disabled={uploading} className="mt-3 rounded-2xl border border-gray-700 px-4 py-3 items-center">
                          {uploading ? <Text className="text-[#FFB05A] text-sm font-semibold">{phaseLabel || 'Uploading...'}</Text> : <Text className="text-white text-sm font-semibold">{document ? 'Replace document' : 'Upload document'}</Text>}
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  )
                })}
              </View>
            </View>

            {providerRequestedDocuments.length ? (
              <View className="mt-5">
                <Text className="text-sky-100 text-sm font-semibold">Additional requested documents</Text>
                <Text className="text-slate-400 text-xs mt-2">
                  These appear only when extra compliance documents are required.
                </Text>
                <View className="mt-3 gap-3">
                  {providerDocumentRows.map((row: ProviderDocumentRow) => {
                    const documentKind = row.documentKind
                    const document = row.document
                    const uploading = uploadingKind === (row.providerDocumentId || row.key) || uploadingKind === documentKind
                    const uploadPhase = uploadNotice?.key === (row.providerDocumentId || row.key) || uploadNotice?.key === documentKind
                      ? uploadNotice.phase
                      : null
                    const phaseLabel = uploadPhaseLabel(uploadPhase || undefined)
                    const actionLabel =
                      row.uploaded
                        ? 'Submitted'
                        : row.actionLabel || (row.inputType === 'file' ? (document ? 'Replace document' : 'Upload document') : row.currentValuePresent ? 'Submit saved value' : 'Enter required value')
                    return (
                      <View key={`${row.key}-provider`} className="rounded-2xl border border-sky-500/20 bg-sky-500/10 px-4 py-4">
                        <Text className="text-white text-sm font-semibold">{row.label}</Text>
                        <Text className="text-sky-50/90 text-xs mt-1">{neutralizeProviderCopy(row.item?.description || 'Requested during verification review.')}</Text>
                        <Text className={`text-xs mt-2 capitalize ${statusTone(row.status)}`}>
                          {row.status}
                        </Text>
                        <Text className="text-slate-300 text-xs mt-2">
                          {statusSummaryForRequirement(row)}
                        </Text>
                        {phaseLabel ? (
                          <Text className={`text-xs mt-2 ${uploadPhase === 'error' ? 'text-red-200' : uploadPhase === 'success' ? 'text-emerald-200' : 'text-amber-200'}`}>
                            {phaseLabel}
                          </Text>
                        ) : null}
                        {row.profileField ? (
                          <Text className="text-slate-400 text-[11px] mt-1">
                            Linked field: {formatLabel(row.profileField)}
                          </Text>
                        ) : null}
                        {canUpload && (row.inputType === 'file' || !row.uploaded) ? (
                          <TouchableOpacity onPress={() => handleProviderRequirementAction(row)} disabled={uploading} className="mt-3 rounded-2xl border border-sky-400/30 px-4 py-3 items-center">
                            {uploading ? <Text className="text-[#FFB05A] text-sm font-semibold">{phaseLabel || 'Uploading...'}</Text> : <Text className="text-white text-sm font-semibold">{row.uploaded && row.inputType === 'file' ? 'Replace document' : actionLabel}</Text>}
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
            ) : canSubmit && readyForSubmission ? (
              <TouchableOpacity onPress={handleSubmit} disabled={submitting} className="rounded-2xl bg-[#FFB05A] px-4 py-4 items-center">
                {submitting ? <ActivityIndicator size="small" color="#111827" /> : <Text className="text-black text-sm font-semibold">Submit business for verification</Text>}
              </TouchableOpacity>
            ) : canSubmit ? (
              <View className="rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-4">
                <Text className="text-amber-100 text-sm font-semibold">Submission locked</Text>
                <Text className="text-amber-50/85 text-xs mt-2">Complete required items above before submission.</Text>
              </View>
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
