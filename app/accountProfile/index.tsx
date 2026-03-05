import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native'
import React, { useEffect, useRef, useState } from 'react'
import { userProfileUpdate } from '@/api/auth'
import { useAuth } from '@/services/useAuth'
import KeyboardAvoidWrapper from '@/components/keyboardAvoidWrapper/KeyboardAvoidWrapper'
import FormInput from '@/components/FormInput'
import { icons } from '@/constants/icons'
import Loader from '@/components/Loader'
import AppAlert from '@/components/app-notification/AppAlert'
import DateTimePicker from '@react-native-community/datetimepicker'
import FormSelect from '@/components/FormSelect'

const countryOptions = [
  'Nigeria',
  'United States',
  'United Kingdom',
  'Canada',
  'South Africa',
  'Ghana',
  'Kenya',
  'United Arab Emirates',
  'Egypt',
  'India',
  'Germany',
  'France',
  'Netherlands',
  'Australia',
  'Singapore',
  'Malaysia',
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
  { label: 'FCT (Abuja)', value: 'FCT' },
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
]

/*
  GET /users/user_profile -> {
    email,
    user_profile: { first_name, last_name, phone_number, gender, date_of_birth, country, address_line1, city, state, postal_code }
  }

  PATCH /users/user_update expects {
    user: { email, user_profile_attributes: { id, first_name, last_name, phone_number, gender, date_of_birth, country, address_line1, city, state, postal_code } }
  }
*/

type ProfileFormValues = {
  email: string
  first_name: string
  last_name: string
  phone: string
  address_line1: string
  city: string
  state: string
  postal_code: string
  user_profile_id: string
  gender?: string
  country?: string
  date_of_birth: string
}

const TIER_LABELS: Record<string, string> = {
  tier_0: 'Tier 0',
  tier_1: 'Tier 1',
  tier_2: 'Tier 2',
  tier_3: 'Tier 3',
  tier_4: 'Tier 4',
  tier0: 'Tier 0',
  tier1: 'Tier 1',
  tier2: 'Tier 2',
  tier3: 'Tier 3',
  tier4: 'Tier 4',
}

const defaultProfileFormValues: ProfileFormValues = {
  email: '',
  first_name: '',
  last_name: '',
  phone: '',
  address_line1: '',
  city: '',
  state: '',
  postal_code: '',
  user_profile_id: '',
  gender: undefined,
  country: undefined,
  date_of_birth: '',
}

const normalizeDateString = (value?: string | Date | null) => {
  if (!value) return ''
  if (value instanceof Date) return value.toISOString().split('T')[0]
  const cleaned = String(value).trim()
  if (!cleaned) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned
  const parsed = Date.parse(cleaned)
  if (Number.isNaN(parsed)) return ''
  return new Date(parsed).toISOString().split('T')[0]
}

const normalizeOptionalString = (value?: string | null) => {
  const trimmed = value?.trim()
  return trimmed && trimmed.length ? trimmed : undefined
}

const normalizeGender = (value?: string | null) => {
  const normalized = String(value || '').trim().toLowerCase()
  return normalized === 'male' || normalized === 'female' ? normalized : undefined
}

const formatTierLabel = (rawTier?: string) => {
  const key = String(rawTier || 'tier_0').trim().toLowerCase()
  if (TIER_LABELS[key]) return TIER_LABELS[key]
  return key.replace(/[_-]/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase())
}

const capitalizeWord = (value?: string) => {
  const text = String(value || '').trim().toLowerCase()
  if (!text) return ''
  return text.charAt(0).toUpperCase() + text.slice(1)
}

const fromApiProfileToForm = (payload: any): ProfileFormValues => {
  const userProfile = payload?.user_profile ?? payload?.profile ?? {}
  const name = userProfile?.name
  return {
    email: payload?.email ?? '',
    first_name: userProfile?.first_name ?? name?.split?.(' ')?.[0] ?? '',
    last_name: userProfile?.last_name ?? name?.split?.(' ')?.[1] ?? '',
    phone: userProfile?.phone_number ?? '',
    address_line1: userProfile?.address_line1 ?? '',
    city: userProfile?.city ?? '',
    state: userProfile?.state ?? '',
    postal_code: userProfile?.postal_code ?? '',
    user_profile_id: userProfile?.id ? String(userProfile.id) : '',
    gender: normalizeGender(userProfile?.gender ?? userProfile?.sex),
    country: normalizeOptionalString(userProfile?.country ?? userProfile?.nationality),
    date_of_birth: normalizeDateString(userProfile?.date_of_birth ?? userProfile?.dob ?? ''),
  }
}

const fromFormToApiPayload = (values: ProfileFormValues): ProfileFormValues => ({
  email: values.email.trim(),
  first_name: values.first_name.trim(),
  last_name: values.last_name.trim(),
  phone: values.phone.trim(),
  address_line1: values.address_line1.trim(),
  city: values.city.trim(),
  state: values.state.trim(),
  postal_code: values.postal_code.trim(),
  user_profile_id: values.user_profile_id,
  gender: normalizeGender(values.gender),
  country: normalizeOptionalString(values.country),
  date_of_birth: normalizeDateString(values.date_of_birth),
})

const Field = ({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string
  value: string
  placeholder?: string
  onChange: (value: string) => void
}) => (
  <View className="space-y-2">
    <Text className="text-gray-400 text-xs" style={{ lineHeight: 18 }}>
      {label}
    </Text>
    <FormInput
      value={value}
      placeholder={placeholder}
      onChangeText={(text: string) => onChange(text)}
      className="bg-[#1a1f2e] border border-[rgba(255,255,255,0.08)] rounded-2xl px-4 py-2.5 text-base font-semibold text-white"
    />
  </View>
)

const ReadOnlyField = ({ label, value, icon }: { label: string; value?: string; icon?: any }) => (
  <View className="space-y-2">
    <Text className="text-gray-400 text-xs" style={{ lineHeight: 18 }}>
      {label}
    </Text>
    <View className="flex-row items-center bg-[#111827] border border-[rgba(255,255,255,0.12)] rounded-2xl px-4 py-2.5 opacity-90">
      {icon ? <Image source={icon} className="w-5 h-5 mr-3" resizeMode="contain" /> : null}
      <Text className="text-gray-400 flex-1" style={{ lineHeight: 20 }}>
        {value || 'Not set'}
      </Text>
      <Image source={icons.lock} className="w-4 h-4" resizeMode="contain" />
    </View>
  </View>
)

const SectionCard = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <View className="mt-7">
    <View className="flex-row items-center justify-between mb-2">
      <Text className="text-gray-300 text-sm font-medium" style={{ lineHeight: 20 }}>
        {title}
      </Text>
      <View className="flex-1 ml-3 h-px bg-[rgba(255,255,255,0.08)]" />
    </View>
    <View className="space-y-4">{children}</View>
  </View>
)

const ProfileHeaderCard = ({
  firstName,
  lastName,
  subtitle,
  email,
  badges,
}: {
  firstName?: string
  lastName?: string
  subtitle?: string
  email?: string
  badges?: string[]
}) => {
  const initials =
    [firstName?.[0], lastName?.[0]].filter(Boolean).join('') || email?.[0]?.toUpperCase() || 'B'

  return (
    <View className="flex-row items-center space-x-4 bg-gray-900/80 border border-[rgba(255,255,255,0.06)] rounded-2xl px-4 py-3 mb-2">
      <View className="h-12 w-12 rounded-full border border-app-primary/30 bg-gray-950 items-center justify-center shadow-lg shadow-app-primary/10">
        <Text className="text-white text-lg font-semibold">{initials}</Text>
      </View>
      <View className="flex-1">
        <Text className="text-white text-lg font-semibold">
          {firstName || 'Bit Bridge'} {lastName || 'Member'}
        </Text>
        <Text className="text-gray-400 text-sm">{email || subtitle}</Text>
        {badges?.length ? (
          <View className="flex-row space-x-2 mt-2">
            {badges.map((badge) => (
              <View
                key={badge}
                className="px-3 py-1 rounded-full bg-app-primary/10 border border-app-primary/20"
              >
                <Text className="text-app-primary text-xs font-medium">{badge}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  )
}

const GenderSegment = ({
  label,
  value,
  onSelect,
}: {
  label: string
  value?: string
  onSelect: (value: string) => void
}) => {
  const options = ['male', 'female']
  return (
    <View className="space-y-2">
      <Text className="text-gray-400 text-xs" style={{ lineHeight: 18 }}>
        {label}
      </Text>
      <View className="flex-row space-x-2">
        {options.map((option) => (
          <TouchableOpacity
            key={option}
            onPress={() => onSelect(option)}
            className={`px-3 py-2 rounded-full border ${
              value === option ? 'border-app-primary bg-app-primary/15' : 'border-gray-700'
            }`}
          >
            <Text className="text-white capitalize text-sm">{option}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  )
}

const CountryPickerField = ({
  label,
  placeholder,
  value,
  onSelect,
}: {
  label: string
  placeholder?: string
  value?: string
  onSelect: (value: string) => void
}) => {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const filtered = countryOptions.filter((item) => item.toLowerCase().includes(search.toLowerCase()))

  return (
    <View className="space-y-2">
      <Text className="text-gray-400 text-xs" style={{ lineHeight: 18 }}>
        {label}
      </Text>

      <TouchableOpacity
        className="border border-[rgba(255,255,255,0.08)] rounded-2xl px-4 py-2.5 bg-[#1a1f2e]"
        onPress={() => setOpen(true)}
      >
        <Text className="text-white" style={{ lineHeight: 20 }}>
          {value || placeholder || 'Select country'}
        </Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <TouchableWithoutFeedback onPress={() => setOpen(false)}>
          <View className="flex-1 bg-black/50" />
        </TouchableWithoutFeedback>

        <View className="absolute bottom-0 left-0 right-0 bg-gray-950 rounded-t-3xl p-5 space-y-3 shadow-2xl">
          <View className="self-center h-1.5 w-12 rounded-full bg-gray-700" />
          <Text className="text-white text-base font-semibold">Select nationality</Text>

          <TextInput
            placeholder="Search country"
            placeholderTextColor="#9CA3AF"
            value={search}
            onChangeText={setSearch}
            className="bg-gray-900 text-white px-4 py-3 rounded-2xl border border-[rgba(255,255,255,0.08)]"
          />

          <ScrollView style={{ maxHeight: 320 }} className="mt-1">
            {filtered.map((item) => (
              <TouchableOpacity
                key={item}
                className="py-3 border-b border-[rgba(255,255,255,0.04)]"
                onPress={() => {
                  onSelect(item)
                  setOpen(false)
                  setSearch('')
                }}
              >
                <Text className="text-white text-base">{item}</Text>
              </TouchableOpacity>
            ))}
            {!filtered.length ? (
              <Text className="text-gray-500 text-center py-4">No matches</Text>
            ) : null}
          </ScrollView>

          <TouchableOpacity
            className="mt-2 py-3 items-center rounded-2xl bg-gray-800 border border-[rgba(255,255,255,0.08)]"
            onPress={() => setOpen(false)}
          >
            <Text className="text-white font-semibold">Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  )
}

const DateField = ({
  label,
  value,
  onOpen,
}: {
  label: string
  value?: string
  onOpen: () => void
}) => (
  <View className="space-y-2">
    <Text className="text-gray-400 text-xs" style={{ lineHeight: 18 }}>
      {label}
    </Text>
    <TouchableOpacity
      onPress={onOpen}
      className="border border-[rgba(255,255,255,0.08)] rounded-2xl px-4 py-2.5 bg-[#1a1f2e] flex-row items-center justify-between"
    >
      <Text className="text-white" style={{ lineHeight: 20 }}>
        {value
          ? new Date(value).toLocaleDateString(undefined, {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })
          : 'Add date of birth'}
      </Text>
      <Text className="text-gray-500 text-lg" style={{ lineHeight: 20 }}>
        ›
      </Text>
    </TouchableOpacity>
  </View>
)

const index = () => {
  const [alertState, setAlertState] = useState<{
    error: boolean
    message: string | null
  }>({
    error: false,
    message: null,
  })

  const { userProfileData, loadProfile } = useAuth()

  const userRoot = userProfileData?.data ?? userProfileData ?? {}
  const userProfile = userRoot?.user_profile ?? userRoot?.profile ?? {}
  const kycLevel = String(userRoot?.kyc_level || userRoot?.user_kyc?.kyc_level || 'tier_0')
    .trim()
    .toLowerCase()
  const phoneVerified = Boolean(userRoot?.phone_verified || userProfile?.phone_verified || userRoot?.phone_verified_at || userProfile?.phone_verified_at)
  const bvnStatus = String(userRoot?.user_kyc?.bvn_status || '')
  const bvnVerified = bvnStatus === 'verified'
  const requirements =
    userRoot?.kyc_requirements ?? userRoot?.requirements ?? userRoot?.user_kyc?.requirements
  const checks = requirements?.checks ?? {}
  const idType = String(userRoot?.id_type || userProfile?.id_type || '').trim()
  const tier2ByLevel =
    kycLevel === 'tier_2' ||
    kycLevel === 'tier2' ||
    kycLevel === 'tier_3' ||
    kycLevel === 'tier3' ||
    kycLevel === 'tier_4' ||
    kycLevel === 'tier4'
  const idUploaded = Boolean(userProfile?.id_document_uploaded || userProfile?.id_document_url)
  const ninVerified = String(userRoot?.user_kyc?.nin_status || '').trim().toLowerCase() === 'verified'
  const identityVerified = idUploaded || ninVerified
  const inferredMissing = [
    ...(bvnVerified ? [] : ['bvn']),
    ...(idType ? [] : ['id_type']),
    ...(identityVerified ? [] : ['identity']),
  ]
  const tier2Missing = Array.isArray(requirements?.missing) ? requirements.missing : inferredMissing
  const tier2Complete =
    typeof checks?.tier2_ready === 'boolean'
      ? checks.tier2_ready
      : tier2ByLevel || tier2Missing.length === 0
  const tier3Complete =
    typeof checks?.tier3_ready === 'boolean'
      ? checks.tier3_ready
      : kycLevel === 'tier_3' || kycLevel === 'tier_4' || kycLevel === 'tier3' || kycLevel === 'tier4'
  const tier4Complete =
    typeof checks?.tier4_ready === 'boolean'
      ? checks.tier4_ready
      : kycLevel === 'tier_4' || kycLevel === 'tier4'
  const tierLabel = formatTierLabel(kycLevel)

  const [formInput, setFormInput] = useState<ProfileFormValues>(defaultProfileFormValues)
  const [loading, setLoading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [dateValue, setDateValue] = useState<Date | null>(null)
  const initialSnapshotRef = useRef<string>('')

  const handleUpdate = async () => {
    const payload = fromFormToApiPayload(formInput)
    setLoading(true)
    try {
      const result = await userProfileUpdate({
        formData: payload,
      })

      await loadProfile({ force: true })
      setFormInput(payload)
      setDateValue(payload.date_of_birth ? new Date(payload.date_of_birth) : null)
      initialSnapshotRef.current = JSON.stringify(payload)
      setIsEditing(false)

      setAlertState({
        error: false,
        message: result?.message || 'Profile updated successfully',
      })
    } catch (error: any) {
      setAlertState({
        error: true,
        message: error?.message || 'Something went wrong. Please try again.',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (userProfileData) {
      const mapped = fromApiProfileToForm(userProfileData)
      setFormInput(mapped)
      setDateValue(mapped.date_of_birth ? new Date(mapped.date_of_birth) : null)
      initialSnapshotRef.current = JSON.stringify(mapped)
    }
  }, [userProfileData])

  const isDirty = JSON.stringify(formInput) !== initialSnapshotRef.current
  const badges: string[] = []
  if (phoneVerified) badges.push('Phone Verified')
  if (tierLabel) badges.push(tierLabel)

  const statusMessage = tier4Complete
    ? 'Full verification complete.'
    : tier3Complete
    ? 'Tier 3 verified. Add address and proof of address to complete Tier 4.'
    : tier2Complete
    ? 'Tier 2 complete. Finish live selfie to unlock Tier 3.'
    : 'Complete your profile and identity checks to progress your verification tier.'

  return (
    <>
      <View className="flex-1 bg-gray-950">
        <KeyboardAvoidWrapper scrollEnabled={false}>
          <View className="flex-1">
            <ScrollView
              contentContainerStyle={{ paddingBottom: 140, paddingHorizontal: 16, paddingTop: 24 }}
            >
              <View className="space-y-6">
                <Text className="text-white text-2xl font-semibold">Profile</Text>
                <Text className="text-gray-400 text-sm mb-1">
                  Manage the details linked to your Bit Bridge Global account.
                </Text>

                <View className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0f1522] px-4 py-4">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-white font-semibold">Profile status</Text>
                    <View className="px-3 py-1 rounded-full bg-app-primary/15 border border-app-primary/30">
                      <Text className="text-app-primary text-xs font-semibold">{tierLabel}</Text>
                    </View>
                  </View>
                  <View className="mt-3 space-y-2">
                    <Text className="text-gray-200 text-xs">Identity: {tier2Complete ? 'Verified' : 'Pending'}</Text>
                    <Text className="text-gray-200 text-xs">Biometric: {tier3Complete ? 'Verified' : 'Pending'}</Text>
                    <Text className="text-gray-200 text-xs">Address: {tier4Complete ? 'Verified' : 'Pending'}</Text>
                  </View>
                  {!tier2Complete && tier2Missing.length > 0 ? (
                    <Text className="text-gray-400 text-xs mt-3">
                      Missing for Tier 2:{' '}
                      {tier2Missing
                        .map((item: string) => {
                          if (item === 'bvn') return 'BVN'
                          if (item === 'id_type') return 'ID type'
                          if (item === 'identity') return 'ID or NIN verification'
                          return item
                        })
                        .join(', ')}
                    </Text>
                  ) : null}
                  <Text className={`${tier4Complete ? 'text-emerald-400' : 'text-gray-400'} text-xs mt-3`}>
                    {statusMessage}
                  </Text>
                </View>

                <ProfileHeaderCard
                  firstName={formInput.first_name}
                  lastName={formInput.last_name}
                  email={formInput.email}
                  subtitle="Bit Bridge Global"
                  badges={badges}
                />

                <View className="flex-row justify-end">
                  <TouchableOpacity
                    className={`px-4 py-2 rounded-xl border ${isEditing ? 'border-gray-700 bg-gray-900' : 'border-app-primary/40 bg-app-primary/10'}`}
                    onPress={() => {
                      if (isEditing) {
                        const initial = initialSnapshotRef.current
                        if (initial) {
                          const parsed = JSON.parse(initial) as ProfileFormValues
                          setFormInput(parsed)
                          setDateValue(parsed.date_of_birth ? new Date(parsed.date_of_birth) : null)
                        }
                        setIsEditing(false)
                      } else {
                        setIsEditing(true)
                      }
                    }}
                  >
                    <Text className={`${isEditing ? 'text-gray-200' : 'text-app-primary'} text-xs font-semibold`}>
                      {isEditing ? 'Cancel edit' : 'Edit profile'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <SectionCard title="Personal details">
                  {isEditing ? (
                    <Field
                      label="First Name"
                      value={formInput.first_name}
                      placeholder=""
                      onChange={(value) => setFormInput((prev) => ({ ...prev, first_name: value }))}
                    />
                  ) : (
                    <ReadOnlyField label="First Name" value={formInput.first_name} />
                  )}

                  {isEditing ? (
                    <Field
                      label="Last Name"
                      value={formInput.last_name}
                      placeholder=""
                      onChange={(value) => setFormInput((prev) => ({ ...prev, last_name: value }))}
                    />
                  ) : (
                    <ReadOnlyField label="Last Name" value={formInput.last_name} />
                  )}

                  {isEditing ? (
                    <GenderSegment
                      label="Gender"
                      value={formInput.gender}
                      onSelect={(value) => setFormInput((prev) => ({ ...prev, gender: value }))}
                    />
                  ) : (
                    <ReadOnlyField label="Gender" value={capitalizeWord(formInput.gender)} />
                  )}

                  {isEditing ? (
                    <DateField
                      label="Date of Birth"
                      value={formInput.date_of_birth}
                      onOpen={() => setShowDatePicker(true)}
                    />
                  ) : (
                    <ReadOnlyField
                      label="Date of Birth"
                      value={
                        formInput.date_of_birth
                          ? new Date(formInput.date_of_birth).toLocaleDateString(undefined, {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })
                          : ''
                      }
                    />
                  )}

                  <Text className="text-gray-500 text-xs">
                    Use the date on your ID. Future dates are not allowed.
                  </Text>

                  {isEditing ? (
                    <CountryPickerField
                      label="Nationality"
                      placeholder="Select nationality"
                      value={formInput.country}
                      onSelect={(value) => setFormInput((prev) => ({ ...prev, country: value }))}
                    />
                  ) : (
                    <ReadOnlyField label="Nationality" value={formInput.country} />
                  )}
                </SectionCard>

                <SectionCard title="Contact">
                  <ReadOnlyField label="Email" value={formInput.email} icon={icons.email} />

                  {isEditing ? (
                    <Field
                      label="Phone"
                      value={formInput.phone}
                      placeholder=""
                      onChange={(value) => setFormInput((prev) => ({ ...prev, phone: value }))}
                    />
                  ) : (
                    <ReadOnlyField label="Phone" value={formInput.phone} />
                  )}

                  <Text className="text-gray-500 text-xs">Used for security alerts and verification.</Text>
                  <Text className="text-gray-500 text-xs mt-1">Status: {phoneVerified ? 'Verified' : 'Not verified'}</Text>
                </SectionCard>

                <SectionCard title={tier2Complete ? 'Address (recommended)' : 'Address (required for account number)'}>
                  {isEditing ? (
                    <Field
                      label="Address Line 1"
                      value={formInput.address_line1}
                      placeholder="Street address"
                      onChange={(value) => setFormInput((prev) => ({ ...prev, address_line1: value }))}
                    />
                  ) : (
                    <ReadOnlyField label="Address Line 1" value={formInput.address_line1} />
                  )}

                  {isEditing ? (
                    <Field
                      label="City"
                      value={formInput.city}
                      placeholder="e.g., Lagos"
                      onChange={(value) => setFormInput((prev) => ({ ...prev, city: value }))}
                    />
                  ) : (
                    <ReadOnlyField label="City" value={formInput.city} />
                  )}

                  {isEditing ? (
                    <FormSelect
                      label="State"
                      selectedValue={formInput.state}
                      onValueChange={(value: string) => setFormInput((prev) => ({ ...prev, state: value }))}
                      options={STATE_OPTIONS}
                    />
                  ) : (
                    <ReadOnlyField label="State" value={formInput.state} />
                  )}

                  {isEditing ? (
                    <Field
                      label="Postal Code"
                      value={formInput.postal_code}
                      placeholder="e.g., 900001"
                      onChange={(value) => setFormInput((prev) => ({ ...prev, postal_code: value }))}
                    />
                  ) : (
                    <ReadOnlyField label="Postal Code" value={formInput.postal_code} />
                  )}
                </SectionCard>
              </View>
            </ScrollView>

            <View className="border-t border-[rgba(255,255,255,0.08)] bg-gray-950 px-4 pt-3 pb-5">
              {alertState.error && alertState.message ? (
                <Text className="text-red-500 text-sm text-center mb-2">{alertState.message}</Text>
              ) : null}

              {isEditing ? (
                <>
                  {!isDirty && !loading ? (
                    <Text className="text-gray-500 text-xs text-center mb-2">Make a change to enable save</Text>
                  ) : null}
                  <TouchableOpacity
                    className={`rounded-2xl px-4 py-3 items-center shadow-lg border ${
                      isDirty && !loading
                        ? 'bg-app-primary border-app-primary'
                        : 'bg-gray-800 border-gray-700'
                    }`}
                    onPress={handleUpdate}
                    disabled={!isDirty || loading}
                  >
                    {loading ? (
                      <ActivityIndicator color="white" />
                    ) : (
                      <Text className={`${isDirty ? 'text-black' : 'text-gray-300'} font-semibold`}>
                        Save changes
                      </Text>
                    )}
                  </TouchableOpacity>
                </>
              ) : (
                <View className="items-center py-2">
                  <Text className="text-gray-500 text-sm">Profile view mode</Text>
                </View>
              )}
            </View>
          </View>
        </KeyboardAvoidWrapper>

        {showDatePicker && (
          <DateTimePicker
            value={dateValue || new Date(1990, 0, 1)}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'calendar'}
            maximumDate={new Date()}
            onChange={(_, selected) => {
              setShowDatePicker(false)
              if (selected) {
                setDateValue(selected)
                const formatted = selected.toISOString().split('T')[0]
                setFormInput((prev) => ({ ...prev, date_of_birth: formatted }))
              }
            }}
          />
        )}
      </View>

      <Loader open={loading} />

      <AppAlert
        message={alertState.message}
        error={alertState.error}
        onPress={() => setAlertState({ error: false, message: null })}
      />
    </>
  )
}

export default index
