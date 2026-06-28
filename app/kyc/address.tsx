import React, { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native'
import { useRouter } from 'expo-router'
import ScreenContainer from '@/components/ScreenContainer'
import FormSelect from '@/components/FormSelect'
import { KycDocumentsPayload, updateKycDocuments } from '@/api/kycDocuments'
import { useAuth } from '@/services/useAuth'
import { pickKycUpload } from '@/utils/kycUploadPicker'
import { backOrFallback } from '@/utils/navigationRecovery'

const PROOF_OPTIONS = [
  { label: 'Select proof type', value: '' },
  { label: 'Utility bill', value: 'utility_bill' },
  { label: 'Bank statement', value: 'bank_statement' },
  { label: 'Rent receipt', value: 'rent_receipt' },
  { label: 'Other', value: 'other' },
]

const AddressVerificationScreen = () => {
  const router = useRouter()
  const { userProfileData, loadProfile } = useAuth()
  const userRoot = userProfileData?.data ?? userProfileData ?? {}
  const profile = userRoot?.user_profile || {}
  const kyc = userRoot?.user_kyc || {}

  const [saving, setSaving] = useState(false)
  const [errorNotice, setErrorNotice] = useState<string | null>(null)
  const [successNotice, setSuccessNotice] = useState<string | null>(null)
  const [proofType, setProofType] = useState('')
  const [proofDocument, setProofDocument] = useState<{
    uri: string
    name?: string
    type?: string
  } | null>(null)

  useEffect(() => {
    setProofType(String(profile?.proof_of_address_type || ''))
  }, [profile?.proof_of_address_type])

  const hasProofOnFile = Boolean(profile?.proof_of_address_url)
  const tier = String(userRoot?.kyc_level || '').toLowerCase()
  const tier3Status = String(kyc?.tier3_status || '').toLowerCase()
  const tier3Eligible = useMemo(
    () => tier === 'tier_3' || tier === 'tier_4' || tier3Status === 'verified',
    [tier, tier3Status]
  )

  const parseErrorMessage = (error: unknown) => {
    const e = error as { response?: { data?: { message?: string; error?: string } }; message?: string }
    return e?.response?.data?.message || e?.response?.data?.error || e?.message || 'Unable to save address verification.'
  }

  const pickProof = async () => {
    setErrorNotice(null)
    setSuccessNotice(null)
    try {
      const document = await pickKycUpload({ title: 'Upload proof of address' })
      if (!document) return
      setProofDocument(document)
    } catch (error: unknown) {
      setErrorNotice(parseErrorMessage(error))
    }
  }

  const handleSave = async () => {
    if (!tier3Eligible) {
      setErrorNotice('Complete Tier 3 live selfie verification before submitting address verification.')
      return
    }
    if (!proofType) {
      setErrorNotice('Select a proof of address type.')
      return
    }
    if (!proofDocument && !hasProofOnFile) {
      setErrorNotice('Upload a proof of address document to continue.')
      return
    }

    setSaving(true)
    setErrorNotice(null)
    setSuccessNotice(null)
    try {
      const payload: KycDocumentsPayload = {
        user_profile_id: profile?.id,
        proof_of_address_type: proofType,
      }
      if (proofDocument) payload.proof_of_address = proofDocument
      await updateKycDocuments(payload)
      await loadProfile({ force: true })
      setSuccessNotice('Address verification submitted successfully.')
      setProofDocument(null)
    } catch (error: unknown) {
      setErrorNotice(parseErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <ScreenContainer>
      <View className="rounded-3xl border border-gray-800 bg-gray-900/80 p-5">
        <Text className="text-white text-xl font-semibold">Address Verification (Tier 4)</Text>
        <Text className="text-gray-400 text-xs mt-2">
          Tier 4 requires Tier 3 verification plus proof of address.
        </Text>
      </View>

      {!tier3Eligible ? (
        <View className="mt-5 rounded-2xl border border-yellow-700/40 bg-yellow-900/20 p-4">
          <Text className="text-yellow-200 text-xs">
            Tier 3 is not verified yet. Complete live selfie first, then return here.
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/kyc/tier3-capture')}
            className="border border-yellow-500/50 py-3 rounded-xl mt-3"
          >
            <Text className="text-yellow-100 text-center">Complete Tier 3</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View className="mt-5 rounded-2xl border border-gray-800 bg-gray-900/70 p-4">
        <Text className="text-white text-base font-semibold mb-3">Proof of address</Text>
        <FormSelect
          label="Proof type"
          selectedValue={proofType}
          onValueChange={(value: string) => setProofType(value)}
          options={PROOF_OPTIONS}
        />

        <View className="mt-4">
          <Text className="text-gray-300 text-xs mb-2">Upload proof of address (image or PDF)</Text>
          <TouchableOpacity
            onPress={pickProof}
            className="bg-gray-950 border border-gray-800 py-3 rounded-xl items-center"
          >
            <Text className="text-white text-sm font-semibold">
              {proofDocument?.name || (hasProofOnFile ? 'Document on file' : 'Take photo, choose from gallery, or choose file')}
            </Text>
          </TouchableOpacity>
          <Text className="text-gray-500 text-[11px] mt-2">
            Use camera, gallery, or files. JPG, PNG, and PDF are supported right now.
          </Text>
          {proofDocument ? (
            <Text className="text-sky-300 text-[11px] mt-2">
              Selected locally: {proofDocument.name || 'Proof document'}.
            </Text>
          ) : null}
          {hasProofOnFile ? (
            <Text className="text-emerald-300 text-[11px] mt-2">
              A proof of address document is already saved on your account.
            </Text>
          ) : null}
        </View>
      </View>

      {saving ? (
        <View className="mt-4 rounded-2xl border border-sky-700/40 bg-sky-900/20 p-4">
          <Text className="text-sky-100 text-xs font-semibold">Uploading proof of address...</Text>
          <Text className="text-sky-200 text-[11px] mt-1">
            Keep this screen open until your address verification is saved.
          </Text>
        </View>
      ) : null}

      {errorNotice ? (
        <View className="mt-4 rounded-2xl border border-yellow-700/40 bg-yellow-900/20 p-4">
          <Text className="text-yellow-100 text-xs font-semibold">Address verification was not saved</Text>
          <Text className="text-yellow-200 text-[11px] mt-1">{errorNotice}</Text>
        </View>
      ) : null}

      {successNotice ? (
        <View className="mt-4 rounded-2xl border border-emerald-700/40 bg-emerald-900/20 p-4">
          <Text className="text-emerald-100 text-xs font-semibold">Address verification saved</Text>
          <Text className="text-emerald-200 text-[11px] mt-1">{successNotice}</Text>
        </View>
      ) : null}

      <TouchableOpacity
        onPress={handleSave}
        className="bg-app-primary py-4 rounded-xl mt-6"
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator />
        ) : (
          <Text className="text-black text-center font-semibold">Save address verification</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => backOrFallback(router, '/kyc')}
        className="border border-gray-800 py-3 rounded-xl mt-3"
        disabled={saving}
      >
        <Text className="text-white text-center">Back</Text>
      </TouchableOpacity>
    </ScreenContainer>
  )
}

export default AddressVerificationScreen

