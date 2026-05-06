import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'expo-router'
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native'
import ScreenContainer from '@/components/ScreenContainer'
import {
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
      const [kybRes, docsRes, statusRes] = await Promise.all([
        getBusinessKyb(businessId),
        getBusinessKybDocuments(businessId),
        getBusinessKybStatus(businessId),
      ])

      const kybData = kybRes?.data?.data || {}
      const docsData = docsRes?.data?.data || {}
      const statusData = statusRes?.data?.data || {}

      setBusinessEntity(kybData.business_entity || statusData.business_entity || null)
      setDocuments(Array.isArray(docsData.documents) ? docsData.documents : Array.isArray(kybData.documents) ? kybData.documents : [])
      setReadiness(kybData.readiness || statusData.readiness || null)
      setJourney(kybData.journey || statusData.journey || null)
      setRequirements(kybData.requirements || docsData.requirements || statusData.requirements || null)
      setGate(kybData.gate || statusData.gate || null)
      setProvider(statusData.provider || docsData.provider || null)
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
  const readyFlags = useMemo(() => [
    { label: 'Business details complete', value: Boolean(readiness?.profile_ready) },
    { label: 'Required documents uploaded', value: Boolean(readiness?.documents_ready) },
    { label: 'Ready for review', value: Boolean(readiness?.ready_for_kyb_submission) },
    { label: 'Ready to activate', value: Boolean(gate?.approved_for_provisioning) },
  ], [gate?.approved_for_provisioning, readiness?.documents_ready, readiness?.profile_ready, readiness?.ready_for_kyb_submission])

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
      router.replace('/business' as any)
    } catch (error: any) {
      const message = buildApiErrorMessage({
        status: error?.response?.status,
        data: error?.response?.data,
        fallback: 'Unable to submit KYB right now.',
      })
      setErrorMessage(message)
    } finally {
      setSubmitting(false)
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
      const message = buildApiErrorMessage({
        status: error?.response?.status,
        data: error?.response?.data,
        fallback: 'Unable to refresh provider status right now.',
      })
      setErrorMessage(message)
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
          <Text className="text-emerald-50/90 text-xs mt-2">
            Return to the setup hub after this step to see the next required action.
          </Text>
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
                    Verification is complete. Return to the setup hub to activate the business account.
                  </Text>
                </View>
              ) : null}
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
            {canSubmit ? (
              <TouchableOpacity onPress={handleSubmit} disabled={submitting} className="rounded-2xl bg-[#FFB05A] px-4 py-4 items-center">
                {submitting ? <ActivityIndicator size="small" color="#111827" /> : <Text className="text-black text-sm font-semibold">Submit business for verification</Text>}
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity onPress={handleResync} disabled={resyncing} className="rounded-2xl border border-gray-700 px-4 py-4 items-center">
              {resyncing ? <ActivityIndicator size="small" color="#FFB05A" /> : <Text className="text-white text-sm font-semibold">Refresh verification status</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.replace('/business' as any)} className="rounded-2xl border border-gray-700 px-4 py-4 items-center">
              <Text className="text-white text-sm font-semibold">Back to business setup</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : null}
    </ScreenContainer>
  )
}

export default BusinessKybScreen
