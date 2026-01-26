import React, { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native'
import * as DocumentPicker from 'expo-document-picker'
import { useRouter } from 'expo-router'
import ScreenContainer from '@/components/ScreenContainer'
import FormInput from '@/components/FormInput'
import FormSelect from '@/components/FormSelect'
import { updateKycDocuments } from '@/api/kycDocuments'
import { useAuth } from '@/services/useAuth'

const ID_TYPE_OPTIONS = [
  { label: 'Select ID type', value: '' },
  { label: 'NIN', value: 'nin' },
  { label: "Driver's licence", value: 'drivers_license' },
  { label: 'International passport', value: 'intl_passport' },
  { label: "Voter's card", value: 'voters_card' },
]

const PROOF_OPTIONS = [
  { label: 'Select proof type', value: '' },
  { label: 'Utility bill', value: 'utility_bill' },
  { label: 'Bank statement', value: 'bank_statement' },
  { label: 'Rent receipt', value: 'rent_receipt' },
  { label: 'Other', value: 'other' },
]

const STATE_OPTIONS = [
  { label: 'Select state', value: '' },
  { label: 'Abia', value: 'Abia' },
  { label: 'Adamawa', value: 'Adamawa' },
  { label: 'Akwa Ibom', value: 'Akwa Ibom' },
  { label: 'Anambra', value: 'Anambra' },
  { label: 'Bauchi', value: 'Bauchi' },
  { label: 'Bayelsa', value: 'Bayelsa' },
  { label: 'Benue', value: 'Benue' },
  { label: 'Borno', value: 'Borno' },
  { label: 'Cross River', value: 'Cross River' },
  { label: 'Delta', value: 'Delta' },
  { label: 'Ebonyi', value: 'Ebonyi' },
  { label: 'Edo', value: 'Edo' },
  { label: 'Ekiti', value: 'Ekiti' },
  { label: 'Enugu', value: 'Enugu' },
  { label: 'FCT', value: 'FCT (Abuja)' },
  { label: 'Gombe', value: 'Gombe' },
  { label: 'Imo', value: 'Imo' },
  { label: 'Jigawa', value: 'Jigawa' },
  { label: 'Kaduna', value: 'Kaduna' },
  { label: 'Kano', value: 'Kano' },
  { label: 'Katsina', value: 'Katsina' },
  { label: 'Kebbi', value: 'Kebbi' },
  { label: 'Kogi', value: 'Kogi' },
  { label: 'Kwara', value: 'Kwara' },
  { label: 'Lagos', value: 'Lagos' },
  { label: 'Nasarawa', value: 'Nasarawa' },
  { label: 'Niger', value: 'Niger' },
  { label: 'Ogun', value: 'Ogun' },
  { label: 'Ondo', value: 'Ondo' },
  { label: 'Osun', value: 'Osun' },
  { label: 'Oyo', value: 'Oyo' },
  { label: 'Plateau', value: 'Plateau' },
  { label: 'Rivers', value: 'Rivers' },
  { label: 'Sokoto', value: 'Sokoto' },
  { label: 'Taraba', value: 'Taraba' },
  { label: 'Yobe', value: 'Yobe' },
  { label: 'Zamfara', value: 'Zamfara' },
  { label: 'Other', value: 'Other' },
]

const COUNTRY_OPTIONS = [
  { label: 'Select country', value: '' },
  { label: 'Nigeria', value: 'Nigeria' },
  { label: 'Ghana', value: 'Ghana' },
  { label: 'United Kingdom', value: 'United Kingdom' },
  { label: 'United States', value: 'United States' },
  { label: 'Other', value: 'Other' },
]

const KycDocumentsScreen = () => {
  const router = useRouter()
  const { userProfileData, loadProfile } = useAuth()
  const profile = userProfileData?.user_profile || {}

  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const [form, setForm] = useState({
    id_type: '',
    nin: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    country: '',
    postal_code: '',
    proof_of_address_type: '',
  })

  const [idDocument, setIdDocument] = useState<{
    uri: string
    name?: string
    type?: string
  } | null>(null)
  const [proofDocument, setProofDocument] = useState<{
    uri: string
    name?: string
    type?: string
  } | null>(null)

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      id_type: userProfileData?.id_type || '',
      address_line1: profile?.address_line1 || '',
      address_line2: profile?.address_line2 || '',
      city: profile?.city || '',
      state: profile?.state || '',
      country: profile?.country || '',
      postal_code: profile?.postal_code || '',
      proof_of_address_type: profile?.proof_of_address_type || '',
    }))
  }, [userProfileData, profile])

  const needsIdUpload = useMemo(() => form.id_type && form.id_type !== 'nin', [form.id_type])
  const hasIdDocOnFile = Boolean(profile?.id_document_url)
  const hasProofOnFile = Boolean(profile?.proof_of_address_url)

  const pickDocument = async (setter: typeof setIdDocument) => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['image/*', 'application/pdf'],
      copyToCacheDirectory: true,
      multiple: false,
    })
    if (result.canceled) return
    const asset = result.assets?.[0]
    if (!asset?.uri) return
    setter({ uri: asset.uri, name: asset.name, type: asset.mimeType || 'application/octet-stream' })
  }

  const validate = () => {
    if (!form.id_type) return 'Select an ID type to continue.'
    if (!form.address_line1 || !form.city || !form.state || !form.postal_code) {
      return 'Address line 1, city, state, and postal code are required.'
    }
    if (!form.proof_of_address_type) return 'Select a proof of address type.'
    if (needsIdUpload && !idDocument && !hasIdDocOnFile) {
      return 'Upload your ID document to continue.'
    }
    if (!proofDocument && !hasProofOnFile) {
      return 'Upload proof of address to continue.'
    }
    return null
  }

  const handleSave = async () => {
    const error = validate()
    if (error) {
      setNotice(error)
      return
    }

    setSaving(true)
    setNotice(null)
    try {
      await updateKycDocuments({
        user_profile_id: profile?.id,
        id_type: form.id_type,
        address_line1: form.address_line1,
        address_line2: form.address_line2,
        city: form.city,
        state: form.state,
        country: form.country,
        postal_code: form.postal_code,
        proof_of_address_type: form.proof_of_address_type,
        id_document: idDocument,
        proof_of_address: proofDocument,
      })
      await loadProfile({ force: true })
      setNotice('Documents updated successfully.')
    } catch (error: any) {
      setNotice(error?.message || 'Unable to save documents.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ScreenContainer>
      <View className="rounded-3xl border border-gray-800 bg-gray-900/80 p-5">
        <Text className="text-white text-xl font-semibold">Documents & Address</Text>
        <Text className="text-gray-400 text-xs mt-2">
          Upload identity and proof of address documents to complete Tier 2 verification.
        </Text>
      </View>

      <View className="mt-5 rounded-2xl border border-gray-800 bg-gray-900/70 p-4">
        <Text className="text-white text-base font-semibold mb-3">Identity</Text>
        <FormSelect
          label="ID type"
          selectedValue={form.id_type}
          onValueChange={(value: string) => setForm({ ...form, id_type: value })}
          options={ID_TYPE_OPTIONS}
        />

        {needsIdUpload ? (
          <View className="mt-4">
            <Text className="text-gray-300 text-xs mb-2">Upload ID document (image or PDF)</Text>
            <TouchableOpacity
              onPress={() => pickDocument(setIdDocument)}
              className="bg-gray-950 border border-gray-800 py-3 rounded-xl items-center"
            >
              <Text className="text-white text-sm font-semibold">
                {idDocument?.name || (hasIdDocOnFile ? 'Document on file' : 'Choose file')}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      <View className="mt-5 rounded-2xl border border-gray-800 bg-gray-900/70 p-4">
        <Text className="text-white text-base font-semibold mb-3">Address</Text>
        <FormInput
          label="Address line 1"
          value={form.address_line1}
          onChangeText={(value: string) => setForm({ ...form, address_line1: value })}
        />
        <FormInput
          label="Address line 2 (optional)"
          value={form.address_line2}
          onChangeText={(value: string) => setForm({ ...form, address_line2: value })}
        />
        <FormInput
          label="City"
          value={form.city}
          onChangeText={(value: string) => setForm({ ...form, city: value })}
        />
        <FormSelect
          label="State"
          selectedValue={form.state}
          onValueChange={(value: string) => setForm({ ...form, state: value })}
          options={STATE_OPTIONS}
        />
        <FormSelect
          label="Country"
          selectedValue={form.country}
          onValueChange={(value: string) => setForm({ ...form, country: value })}
          options={COUNTRY_OPTIONS}
        />
        <FormInput
          label="Postal code"
          value={form.postal_code}
          onChangeText={(value: string) => setForm({ ...form, postal_code: value })}
        />
      </View>

      <View className="mt-5 rounded-2xl border border-gray-800 bg-gray-900/70 p-4">
        <Text className="text-white text-base font-semibold mb-3">Proof of address</Text>
        <FormSelect
          label="Proof type"
          selectedValue={form.proof_of_address_type}
          onValueChange={(value: string) => setForm({ ...form, proof_of_address_type: value })}
          options={PROOF_OPTIONS}
        />

        <View className="mt-4">
          <Text className="text-gray-300 text-xs mb-2">Upload proof of address (image or PDF)</Text>
          <TouchableOpacity
            onPress={() => pickDocument(setProofDocument)}
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
          <Text className="text-black text-center font-semibold">Save documents</Text>
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

export default KycDocumentsScreen
