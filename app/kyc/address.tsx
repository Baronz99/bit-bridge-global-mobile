import React, { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native'
import * as DocumentPicker from 'expo-document-picker'
import { useRouter } from 'expo-router'
import ScreenContainer from '@/components/ScreenContainer'
import FormSelect from '@/components/FormSelect'
import { KycDocumentsPayload, updateKycDocuments } from '@/api/kycDocuments'
import { useAuth } from '@/services/useAuth'

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
  const [notice, setNotice] = useState<string | null>(null)
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

  const pickProof = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['image/*', 'application/pdf'],
      copyToCacheDirectory: true,
      multiple: false,
    })
    if (result.canceled) return
    const asset = result.assets?.[0]
    if (!asset?.uri) return
    setProofDocument({ uri: asset.uri, name: asset.name, type: asset.mimeType || 'application/octet-stream' })
  }

  const handleSave = async () => {
    if (!tier3Eligible) {
      setNotice('Complete Tier 3 live selfie verification before submitting address verification.')
      return
    }
    if (!proofType) {
      setNotice('Select a proof of address type.')
      return
    }
    if (!proofDocument && !hasProofOnFile) {
      setNotice('Upload a proof of address document to continue.')
      return
    }

    setSaving(true)
    setNotice(null)
    try {
      const payload: KycDocumentsPayload = {
        user_profile_id: profile?.id,
        proof_of_address_type: proofType,
      }
      if (proofDocument) payload.proof_of_address = proofDocument
      await updateKycDocuments(payload)
      await loadProfile({ force: true })
      setNotice('Address verification details saved successfully.')
    } catch (error: unknown) {
      const e = error as { response?: { data?: { message?: string; error?: string } }; message?: string }
      setNotice(e?.response?.data?.message || e?.response?.data?.error || e?.message || 'Unable to save address verification.')
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
              {proofDocument?.name || (hasProofOnFile ? 'Document on file' : 'Choose file')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {notice ? <Text className="text-yellow-400 text-xs mt-4">{notice}</Text> : null}

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
        onPress={() => router.back()}
        className="border border-gray-800 py-3 rounded-xl mt-3"
      >
        <Text className="text-white text-center">Back</Text>
      </TouchableOpacity>
    </ScreenContainer>
  )
}

export default AddressVerificationScreen
