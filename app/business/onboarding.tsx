import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native'
import DateTimePicker from '@react-native-community/datetimepicker'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import ScreenContainer from '@/components/ScreenContainer'
import FormSelect from '@/components/FormSelect'
import { getBusinessOnboarding, updateBusinessOnboarding } from '@/api/business'
import { buildApiErrorMessage } from '@/utils/apiErrorMessage'
import { useActiveAccount } from '@/services/useActiveAccount'

const emptySignatory = () => ({
  full_name: '',
  first_name: '',
  middle_name: '',
  last_name: '',
  email: '',
  phone: '',
  title: '',
  date_of_birth: '',
  nationality: 'NG',
  address_line_1: '',
  city: '',
  state: '',
  postal_code: '',
  country: 'NG',
  bvn: '',
  identification_type: '',
  id_document_number: '',
  ownership_percentage: '',
  authorized_signatory: true,
  director: true,
  status: 'active',
})

const SECTION_ORDER = ['business', 'contact', 'signatory'] as const

type SectionKey = (typeof SECTION_ORDER)[number]
type PickerTarget =
  | { kind: 'registration' }
  | { kind: 'signatory'; index: number }
  | null

const SECTION_META: Record<SectionKey, {
  title: string
  eyebrow: string
  description: string
}> = {
  business: {
    title: 'Business details',
    eyebrow: 'Section 1',
    description: 'Add the registered company information used to identify this business.',
  },
  contact: {
    title: 'Contact and address details',
    eyebrow: 'Section 2',
    description: 'Add the operating and registered addresses the provider will use during verification.',
  },
  signatory: {
    title: 'Authorized signatory',
    eyebrow: 'Section 3',
    description: 'Add the person who will represent the business during verification and account control.',
  },
}

const BUSINESS_SECTION_FIELDS = [
  'legal_name',
  'business_type',
  'registration_number',
  'business_bvn',
  'date_of_registration',
  'website',
  'tax_identifier',
  'category',
  'anchor_industry',
  'business_description',
]
const CONTACT_SECTION_FIELDS = [
  'contact_email',
  'support_email',
  'dispute_email',
  'contact_phone',
  'address_line_1',
  'address_line_2',
  'city',
  'state',
  'postal_code',
  'country',
  'operating_region',
  'registered_address_line_1',
  'registered_address_line_2',
  'registered_city',
  'registered_state',
  'registered_postal_code',
  'registered_country',
]

const SECTION_FIELD_MAP: Record<SectionKey, string[]> = {
  business: BUSINESS_SECTION_FIELDS,
  contact: CONTACT_SECTION_FIELDS,
  signatory: [
    'full_name',
    'first_name',
    'last_name',
    'email',
    'phone',
    'title',
    'date_of_birth',
    'nationality',
    'address_line_1',
    'city',
    'state',
    'country',
    'bvn',
    'identification_type',
    'id_document_number',
    'ownership_percentage',
  ],
}

const FALLBACK_BUSINESS_TYPE_OPTIONS = [
  { label: 'Limited company', value: 'limited_company' },
  { label: 'Business name', value: 'business_name' },
  { label: 'Sole proprietorship', value: 'sole_proprietorship' },
  { label: 'Incorporated trustees', value: 'incorporated_trustees' },
  { label: 'Cooperative', value: 'cooperative' },
  { label: 'Public incorporated', value: 'public_incorporated' },
  { label: 'Government', value: 'government' },
  { label: 'Private incorporated government entity', value: 'private_incorporated_gov' },
  { label: 'Free zone entity', value: 'free_zone' },
]

const FALLBACK_BUSINESS_CATEGORY_OPTIONS = [
  { label: 'Technology - Software development', value: 'Technology-SoftwareDevelopment' },
  { label: 'Technology - Fintech', value: 'Technology-Fintech' },
  { label: 'Retail - Ecommerce', value: 'Retail-Ecommerce' },
  { label: 'Retail - General commerce', value: 'Retail-GeneralCommerce' },
  { label: 'Professional services - Consulting', value: 'ProfessionalServices-Consulting' },
  { label: 'Professional services - Legal', value: 'ProfessionalServices-Legal' },
  { label: 'Manufacturing - General', value: 'Manufacturing-General' },
  { label: 'Logistics - Transportation', value: 'Logistics-Transportation' },
  { label: 'Construction / Real estate', value: 'Construction-RealEstate' },
  { label: 'Healthcare - Medical services', value: 'Healthcare-MedicalServices' },
  { label: 'Education - Training', value: 'Education-Training' },
  { label: 'Hospitality - Food and beverage', value: 'Hospitality-FoodAndBeverage' },
  { label: 'Agriculture - Agribusiness', value: 'Agriculture-Agribusiness' },
  { label: 'Energy / Utilities', value: 'Energy-Utilities' },
  { label: 'Media / Entertainment', value: 'Media-Entertainment' },
  { label: 'Non-profit / NGO', value: 'NonProfit-NGO' },
]

const COUNTRY_OPTIONS = [
  { label: 'Nigeria', value: 'NG' },
  { label: 'Ghana', value: 'GH' },
  { label: 'Kenya', value: 'KE' },
  { label: 'South Africa', value: 'ZA' },
  { label: 'Uganda', value: 'UG' },
  { label: 'Rwanda', value: 'RW' },
  { label: 'United Arab Emirates', value: 'AE' },
  { label: 'United Kingdom', value: 'GB' },
  { label: 'United States', value: 'US' },
  { label: 'Canada', value: 'CA' },
]

const IDENTIFICATION_TYPE_OPTIONS = [
  { label: 'Drivers License', value: 'DRIVERS_LICENSE' },
  { label: 'Voters Card', value: 'VOTERS_CARD' },
  { label: 'Passport', value: 'PASSPORT' },
  { label: 'National Id', value: 'NATIONAL_ID' },
  { label: 'NIN Slip', value: 'NIN_SLIP' },
]

const countryNameToCode = Object.fromEntries(
  COUNTRY_OPTIONS.flatMap((option) => [
    [String(option.value || '').toLowerCase(), option.value],
    [String(option.label || '').toLowerCase(), option.value],
  ])
)

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

const formatLabel = (value: string) =>
  String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase())

const normalizeCountryValue = (value: string, fallback = 'NG') => {
  const normalized = String(value || '').trim().toLowerCase()
  if (!normalized) return fallback
  return String(countryNameToCode[normalized] || value || fallback)
}

const formatLocalDate = (value: Date) => {
  const year = value.getFullYear()
  const month = `${value.getMonth() + 1}`.padStart(2, '0')
  const day = `${value.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

const parseStoredDate = (value: string) => {
  if (!value) return null
  const normalized = String(value).slice(0, 10)
  const [year, month, day] = normalized.split('-').map((item) => Number(item))
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day)
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

const formatMissingItems = (items: string[]) =>
  items
    .map((item) => formatLabel(item))
    .filter(Boolean)
    .join(', ')

const BusinessOnboardingScreen = () => {
  const router = useRouter()
  const params = useLocalSearchParams<{ section?: string }>()
  const { activeAccount } = useActiveAccount()
  const insets = useSafeAreaInsets()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({})
  const [touchedSignatories, setTouchedSignatories] = useState<Record<number, Record<string, boolean>>>({})
  const [readiness, setReadiness] = useState<Record<string, any> | null>(null)
  const [requirements, setRequirements] = useState<Record<string, any> | null>(null)
  const [pickerTarget, setPickerTarget] = useState<PickerTarget>(null)
  const [pickerDraftDate, setPickerDraftDate] = useState<Date>(new Date(2020, 0, 1))
  const [businessName, setBusinessName] = useState('')
  const [form, setForm] = useState({
    legal_name: '',
    business_type: '',
    registration_number: '',
    business_bvn: '',
    date_of_registration: '',
    website: '',
    tax_identifier: '',
    category: '',
    anchor_industry: '',
    business_description: '',
    contact_email: '',
    support_email: '',
    dispute_email: '',
    contact_phone: '',
    address_line_1: '',
    address_line_2: '',
    city: '',
    state: '',
    postal_code: '',
    country: 'NG',
    operating_region: '',
    registered_address_line_1: '',
    registered_address_line_2: '',
    registered_city: '',
    registered_state: '',
    registered_postal_code: '',
    registered_country: 'NG',
  })
  const [signatories, setSignatories] = useState<Array<Record<string, any>>>([emptySignatory()])
  const businessId = activeAccount.type === 'business' ? activeAccount.businessId : null
  const section: SectionKey = SECTION_ORDER.includes(String(params?.section || '') as SectionKey)
    ? (String(params?.section) as SectionKey)
    : 'business'
  const sectionIndex = SECTION_ORDER.indexOf(section) + 1
  const sectionMeta = SECTION_META[section]
  const progressLabel = `${sectionIndex} of ${SECTION_ORDER.length}`
  const nextSection = sectionIndex < SECTION_ORDER.length ? SECTION_ORDER[sectionIndex] : null
  const previousSection = sectionIndex > 1 ? SECTION_ORDER[sectionIndex - 2] : null

  const loadOnboarding = useCallback(async () => {
    if (!businessId) {
      setLoading(false)
      return
    }

    setLoading(true)
    setErrorMessage(null)
    try {
      const response = await getBusinessOnboarding(businessId)
      const data = response?.data?.data || {}
      const profile = data.profile || {}
      const entity = data.business_entity || {}
      const incomingSignatories = Array.isArray(data.signatories) && data.signatories.length
        ? data.signatories
        : [emptySignatory()]

      setReadiness(data.readiness || null)
      setRequirements(data.requirements || null)
      setBusinessName(String(entity.name || ''))
      setForm({
        legal_name: String(profile.legal_name || ''),
        business_type: String(profile.business_type || ''),
        registration_number: String(profile.registration_number || ''),
        business_bvn: String(profile.business_bvn || ''),
        date_of_registration: String(profile.date_of_registration || ''),
        website: String(profile.website || ''),
        tax_identifier: String(profile.tax_identifier || ''),
        category: String(profile.category || ''),
        anchor_industry: String(profile.anchor_industry || ''),
        business_description: String(profile.business_description || ''),
        contact_email: String(profile.contact_email || ''),
        support_email: String(profile.support_email || ''),
        dispute_email: String(profile.dispute_email || ''),
        contact_phone: String(profile.contact_phone || ''),
        address_line_1: String(profile.address_line_1 || ''),
        address_line_2: String(profile.address_line_2 || ''),
        city: String(profile.city || ''),
        state: String(profile.state || ''),
        postal_code: String(profile.postal_code || ''),
        country: normalizeCountryValue(String(profile.country || 'NG')),
        operating_region: String(profile.operating_region || ''),
        registered_address_line_1: String(profile.registered_address_line_1 || ''),
        registered_address_line_2: String(profile.registered_address_line_2 || ''),
        registered_city: String(profile.registered_city || ''),
        registered_state: String(profile.registered_state || ''),
        registered_postal_code: String(profile.registered_postal_code || ''),
        registered_country: normalizeCountryValue(String(profile.registered_country || 'NG')),
      })
      setSignatories(
        incomingSignatories.map((item: Record<string, any>) => ({
          ...emptySignatory(),
          ...item,
          id: item?.id,
          full_name: String(item?.full_name || ''),
          first_name: String(item?.first_name || ''),
          middle_name: String(item?.middle_name || ''),
          last_name: String(item?.last_name || ''),
          email: String(item?.email || ''),
          phone: String(item?.phone || ''),
          title: String(item?.title || ''),
          date_of_birth: String(item?.date_of_birth || ''),
          nationality: normalizeCountryValue(String(item?.nationality || 'NG')),
          address_line_1: String(item?.address_line_1 || ''),
          city: String(item?.city || ''),
          state: String(item?.state || ''),
          postal_code: String(item?.postal_code || ''),
          country: normalizeCountryValue(String(item?.country || 'NG')),
          bvn: String(item?.bvn || ''),
          identification_type: String(item?.identification_type || ''),
          id_document_number: String(item?.id_document_number || ''),
          ownership_percentage:
            item?.ownership_percentage === null || item?.ownership_percentage === undefined ? '' : String(item.ownership_percentage),
          status: String(item?.status || 'active'),
          authorized_signatory: item?.authorized_signatory !== false,
          director: item?.director !== false,
        }))
      )
    } catch (error: any) {
      const message = buildApiErrorMessage({
        status: error?.response?.status,
        data: error?.response?.data,
        fallback: 'Unable to load business onboarding right now.',
      })
      setErrorMessage(message)
    } finally {
      setLoading(false)
    }
  }, [businessId])

  useEffect(() => {
    void loadOnboarding()
  }, [loadOnboarding])

  useEffect(() => {
    setSubmitAttempted(false)
    setErrorMessage(null)
    setSuccessMessage(null)
  }, [section])

  const handleChange = (field: string, value: string) => {
    setTouchedFields((current) => ({ ...current, [field]: true }))
    setForm((current) => ({
      ...current,
      [field]: value,
      ...(field === 'category' && value !== current.category ? { anchor_industry: '' } : {}),
    }))
  }

  const handleSignatoryChange = (index: number, field: string, value: string | boolean) => {
    setTouchedSignatories((current) => ({
      ...current,
      [index]: { ...(current[index] || {}), [field]: true },
    }))
    setSignatories((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item))
    )
  }

  const addSignatory = () => {
    setSignatories((current) => [...current, emptySignatory()])
  }

  const removeSignatory = (index: number) => {
    setSignatories((current) => (current.length > 1 ? current.filter((_, itemIndex) => itemIndex !== index) : current))
  }

  const missingProfileFields = useMemo(
    () => (Array.isArray(readiness?.missing_profile_fields) ? readiness.missing_profile_fields : []),
    [readiness?.missing_profile_fields]
  )
  const missingSignatoryRequirements = useMemo(
    () => (Array.isArray(readiness?.missing_signatory_requirements) ? readiness.missing_signatory_requirements : []),
    [readiness?.missing_signatory_requirements]
  )

  const currentSectionMissing = useMemo(() => {
    if (section === 'business') {
      const grouped = requirements?.groups?.company_details?.missing_fields
      if (Array.isArray(grouped)) return grouped
      return missingProfileFields.filter((field: string) => BUSINESS_SECTION_FIELDS.includes(String(field)))
    }
    if (section === 'contact') {
      const grouped = requirements?.groups?.contact_details?.missing_fields
      if (Array.isArray(grouped)) return grouped
      return missingProfileFields.filter((field: string) => CONTACT_SECTION_FIELDS.includes(String(field)))
    }
    return missingSignatoryRequirements
  }, [section, requirements?.groups, missingProfileFields, missingSignatoryRequirements])

  const shouldShowSectionFeedback = useMemo(() => {
    if (submitAttempted) return true

    if (section === 'signatory') {
      return signatories.some((_, index) => {
        const touched = touchedSignatories[index] || {}
        return SECTION_FIELD_MAP.signatory.some((field) => touched[field])
      })
    }

    return SECTION_FIELD_MAP[section].some((field) => touchedFields[field])
  }, [section, submitAttempted, signatories, touchedFields, touchedSignatories])

  const sectionFeedbackMessage = useMemo(() => {
    if (!shouldShowSectionFeedback || !currentSectionMissing.length) return null
    return `Still needed: ${currentSectionMissing.map(formatLabel).join(', ')}.`
  }, [shouldShowSectionFeedback, currentSectionMissing])
  const stepSummary = useMemo(() => {
    if (currentSectionMissing.length > 0) {
      return {
        title: 'Finish the remaining blockers in this step',
        body: `Still needed here: ${formatMissingItems(currentSectionMissing)}.`,
      }
    }

    if (nextSection) {
      return {
        title: `This step is complete`,
        body: `Continue to ${SECTION_META[nextSection].title.toLowerCase()} next.`,
      }
    }

    return {
      title: 'Profile details complete',
      body: 'The next screen will review your saved business details and handle document upload or submission.',
    }
  }, [currentSectionMissing, nextSection])

  const businessTypeOptions = useMemo(
    () => (Array.isArray(requirements?.fields?.business_type?.options) && requirements.fields.business_type.options.length
      ? requirements.fields.business_type.options
      : FALLBACK_BUSINESS_TYPE_OPTIONS),
    [requirements?.fields?.business_type?.options]
  )
  const businessCategoryOptions = useMemo(
    () => (Array.isArray(requirements?.fields?.category?.options) && requirements.fields.category.options.length
      ? requirements.fields.category.options
      : FALLBACK_BUSINESS_CATEGORY_OPTIONS),
    [requirements?.fields?.category?.options]
  )
  const anchorIndustryOptions = useMemo(
    () => (Array.isArray(requirements?.fields?.anchor_industry?.options) && requirements.fields.anchor_industry.options.length
      ? requirements.fields.anchor_industry.options
      : []),
    [requirements?.fields?.anchor_industry?.options]
  )
  const showAnchorIndustryField = requirements?.fields?.anchor_industry?.visible === true
  const identificationTypeOptions = useMemo(
    () => (Array.isArray(requirements?.fields?.identification_type?.options) && requirements.fields.identification_type.options.length
      ? requirements.fields.identification_type.options
      : IDENTIFICATION_TYPE_OPTIONS),
    [requirements?.fields?.identification_type?.options]
  )
  const preSubmissionDocuments = useMemo(
    () => (Array.isArray(requirements?.documents?.pre_submission) ? requirements.documents.pre_submission : []),
    [requirements?.documents?.pre_submission]
  )

  const pickerTitle = pickerTarget?.kind === 'registration' ? 'Registration date' : 'Signatory date of birth'

  const openRegistrationDatePicker = () => {
    setPickerDraftDate(parseStoredDate(form.date_of_registration) || new Date(2020, 0, 1))
    setPickerTarget({ kind: 'registration' })
  }

  const openSignatoryDatePicker = (index: number) => {
    setPickerDraftDate(parseStoredDate(String(signatories[index]?.date_of_birth || '')) || new Date(1990, 0, 1))
    setPickerTarget({ kind: 'signatory', index })
  }

  const closePicker = () => setPickerTarget(null)

  const applyPickerDate = (selected: Date) => {
    if (!pickerTarget) return
    const formatted = formatLocalDate(selected)
    if (pickerTarget.kind === 'registration') {
      setTouchedFields((current) => ({ ...current, date_of_registration: true }))
      handleChange('date_of_registration', formatted)
    } else {
      setTouchedSignatories((current) => ({
        ...current,
        [pickerTarget.index]: { ...(current[pickerTarget.index] || {}), date_of_birth: true },
      }))
      handleSignatoryChange(pickerTarget.index, 'date_of_birth', formatted)
    }
    closePicker()
  }

  const handleSave = async () => {
    if (!businessId) return
    setSubmitAttempted(true)
    setSaving(true)
    setErrorMessage(null)
    setSuccessMessage(null)
    try {
      const payload = {
        onboarding: {
          name: businessName,
          ...form,
          signatories: signatories
            .filter((item) => String(item.full_name || item.first_name || item.last_name || '').trim())
            .map((item) => ({
              id: item.id,
              full_name: item.full_name,
              first_name: item.first_name,
              middle_name: item.middle_name,
              last_name: item.last_name,
              email: item.email,
              phone: item.phone,
              title: item.title,
              date_of_birth: item.date_of_birth,
              nationality: item.nationality,
              address_line_1: item.address_line_1,
              city: item.city,
              state: item.state,
              postal_code: item.postal_code,
              country: item.country,
              bvn: item.bvn,
              identification_type: item.identification_type,
              id_document_number: item.id_document_number,
              ownership_percentage:
                String(item.ownership_percentage || '').trim() === '' ? '' : Number(item.ownership_percentage),
              authorized_signatory: item.authorized_signatory,
              director: item.director,
              status: item.status || 'active',
            })),
        },
      }

      const response = await updateBusinessOnboarding(businessId, payload)
      const data = response?.data?.data || {}
      const entity = data.business_entity || {}
      setReadiness(data.readiness || null)
      setRequirements(data.requirements || null)
      setBusinessName(String(entity.name || businessName || ''))
      setSuccessMessage('Business profile saved.')

      const isLastSection = sectionIndex >= SECTION_ORDER.length
      if (isLastSection) {
        router.replace('/business/kyb' as any)
        return
      }

      router.replace(`/business/onboarding?section=${nextSection}` as any)
    } catch (error: any) {
      const message = buildApiErrorMessage({
        status: error?.response?.status,
        data: error?.response?.data,
        fallback: 'Unable to save business onboarding right now.',
      })
      setErrorMessage(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <ScreenContainer scroll={false} includeTabBarPadding={false} topPadding={20}>
      <View className="flex-1">
      <View className="rounded-[28px] border border-white/8 bg-[#151A22] px-5 py-4">
        <View className="flex-row items-start justify-between gap-4">
          <View className="flex-1">
            <Text className="text-[#FFB05A] text-[11px] uppercase tracking-[2px]">{sectionMeta.eyebrow}</Text>
            <Text className="text-white text-[24px] font-semibold mt-2">{sectionMeta.title}</Text>
          </View>
          <Text className="text-slate-300 text-sm font-medium">{`Step ${progressLabel}`}</Text>
        </View>
        <View className="mt-4 h-1.5 rounded-full bg-gray-800 overflow-hidden">
          <View style={{ width: `${(sectionIndex / SECTION_ORDER.length) * 100}%` }} className="h-full rounded-full bg-[#FFB05A]" />
        </View>
        <View className="mt-4 flex-row gap-2">
          {SECTION_ORDER.map((item, index) => {
            const active = item === section
            const completed = SECTION_ORDER.indexOf(item) < sectionIndex - 1
            return (
              <TouchableOpacity
                key={item}
                onPress={() => router.replace(`/business/onboarding?section=${item}` as any)}
                className={`flex-1 rounded-full border px-3 py-2 ${active ? 'border-[#FFB05A]/55 bg-[#FFB05A]/12' : completed ? 'border-emerald-500/35 bg-emerald-500/10' : 'border-white/10 bg-gray-950/35'}`}
              >
                <Text className={`text-center text-[11px] font-semibold ${active ? 'text-white' : completed ? 'text-emerald-100' : 'text-slate-400'}`}>
                  {index + 1}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>
        <Text className="mt-4 text-slate-300 text-sm">{sectionMeta.description}</Text>
      </View>

      <View className="mt-4 rounded-2xl border border-[#FFB05A]/20 bg-[#FFB05A]/10 px-4 py-4">
        <Text className="text-[#FFD7A6] text-sm font-semibold">{stepSummary.title}</Text>
        <Text className="text-slate-200 text-xs mt-2">{stepSummary.body}</Text>
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
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="small" color="#FFB05A" />
          <Text className="text-white mt-3">Loading business profile...</Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 120 }}
        >
          {section === 'business' ? (
            <>
              <View className="mt-5">
                <Text className="text-gray-400 text-xs">Display name (optional)</Text>
                <TextInput
                  value={businessName}
                  onChangeText={setBusinessName}
                  placeholder="Short name shown inside BitBridge"
                  placeholderTextColor="#6B7280"
                  className="mt-2 rounded-2xl border border-gray-700 bg-gray-950/45 px-4 py-4 text-white"
                />
                <Text className="text-gray-500 text-[11px] mt-2">
                  This is the in-app name for your team. Your legal business name is captured separately below.
                </Text>
              </View>

              <View className="mt-6 rounded-2xl border border-white/8 bg-gray-900/80 p-4">
                <Text className="text-white text-base font-semibold">Company details</Text>
                <Text className="text-slate-400 text-xs mt-1">Use the exact details from the business registration record.</Text>

                <View className="mt-4">
                  <Text className="text-gray-400 text-xs">Legal business name</Text>
                  <TextInput
                    value={form.legal_name}
                    onChangeText={(value) => handleChange('legal_name', value)}
                    placeholder="Exact registered company name"
                    placeholderTextColor="#6B7280"
                    className="mt-2 rounded-2xl border border-gray-700 bg-gray-950/45 px-4 py-4 text-white"
                  />
                  <Text className="text-gray-500 text-[11px] mt-2">
                    {String(requirements?.fields?.legal_name?.helper || 'Use the exact registered company name from your incorporation documents.')}
                  </Text>
                </View>

                <View className="mt-4">
                  <FormSelect
                    label="Business type"
                    selectedValue={form.business_type}
                    onValueChange={(value: string) => handleChange('business_type', value)}
                    options={businessTypeOptions}
                    placeholder="Select business type"
                  />
                  <Text className="text-gray-500 text-[11px] mt-2">
                    {String(requirements?.fields?.business_type?.helper || 'Choose the registration type that matches the business records.')}
                  </Text>
                </View>

                <View className="mt-6 border-t border-white/6 pt-6">
                  <Text className="text-gray-400 text-xs">Registration number</Text>
                  <TextInput
                    value={form.registration_number}
                    onChangeText={(value) => handleChange('registration_number', value)}
                    autoCapitalize="characters"
                    placeholder="Official registration number"
                    placeholderTextColor="#6B7280"
                    className="mt-2 rounded-2xl border border-gray-700 bg-gray-950/45 px-4 py-4 text-white"
                  />
                </View>

                <View className="mt-4">
                  <Text className="text-gray-400 text-xs">Business BVN</Text>
                  <TextInput
                    value={form.business_bvn}
                    onChangeText={(value) => handleChange('business_bvn', value.replace(/\D/g, '').slice(0, 11))}
                    keyboardType="number-pad"
                    placeholder="11-digit business BVN"
                    placeholderTextColor="#6B7280"
                    className="mt-2 rounded-2xl border border-gray-700 bg-gray-950/45 px-4 py-4 text-white"
                  />
                  <Text className="text-gray-500 text-[11px] mt-2">
                    Use the business BVN exactly as registered for company verification.
                  </Text>
                </View>

                <View className="mt-4">
                  <Text className="text-gray-400 text-xs">Date of registration</Text>
                  <TouchableOpacity
                    onPress={openRegistrationDatePicker}
                    className="mt-2 rounded-2xl border border-gray-700 bg-gray-950/45 px-4 py-4"
                  >
                    <Text className={form.date_of_registration ? 'text-white' : 'text-gray-400'}>
                      {form.date_of_registration ? formatDisplayDate(form.date_of_registration) : 'Select registration date'}
                    </Text>
                  </TouchableOpacity>
                  <Text className="text-gray-500 text-[11px] mt-2">
                    Stored as {requirements?.fields?.date_of_registration?.format || 'YYYY-MM-DD'}.
                  </Text>
                </View>

                <View className="mt-6 border-t border-white/6 pt-6">
                  <Text className="text-gray-400 text-xs">Website</Text>
                  <TextInput
                    value={form.website}
                    onChangeText={(value) => handleChange('website', value)}
                    autoCapitalize="none"
                    placeholder="https://example.com"
                    placeholderTextColor="#6B7280"
                    className="mt-2 rounded-2xl border border-gray-700 bg-gray-950/45 px-4 py-4 text-white"
                  />
                </View>

                <View className="mt-4">
                  <Text className="text-gray-400 text-xs">Tax identifier</Text>
                  <TextInput
                    value={form.tax_identifier}
                    onChangeText={(value) => handleChange('tax_identifier', value)}
                    autoCapitalize="characters"
                    placeholder="Tax identification number"
                    placeholderTextColor="#6B7280"
                    className="mt-2 rounded-2xl border border-gray-700 bg-gray-950/45 px-4 py-4 text-white"
                  />
                </View>

                <View className="mt-6 border-t border-white/6 pt-6">
                  <FormSelect
                    label="Business category"
                    selectedValue={form.category}
                    onValueChange={(value: string) => handleChange('category', value)}
                    options={businessCategoryOptions}
                    placeholder="Select business category"
                  />
                  <Text className="text-gray-500 text-[11px] mt-2">
                    {String(requirements?.fields?.category?.helper || 'Choose the industry that best describes the business operations.')}
                  </Text>
                </View>

                {showAnchorIndustryField ? (
                  <View className="mt-4">
                    <FormSelect
                      label={String(requirements?.fields?.anchor_industry?.label || 'Anchor industry')}
                      selectedValue={form.anchor_industry}
                      onValueChange={(value: string) => handleChange('anchor_industry', value)}
                      options={anchorIndustryOptions}
                      placeholder="Select Anchor industry"
                    />
                    <Text className="text-gray-500 text-[11px] mt-2">
                      {String(requirements?.fields?.anchor_industry?.helper || 'Choose the exact Anchor subcategory before KYB submission.')}
                    </Text>
                  </View>
                ) : null}

                <View className="mt-4">
                  <Text className="text-gray-400 text-xs">Business description</Text>
                  <TextInput
                    value={form.business_description}
                    onChangeText={(value) => handleChange('business_description', value)}
                    placeholder="Short description of what the business does"
                    placeholderTextColor="#6B7280"
                    multiline
                    className="mt-2 min-h-[104px] rounded-2xl border border-gray-700 bg-gray-950/45 px-4 py-4 text-white"
                    textAlignVertical="top"
                  />
                </View>
              </View>

              {preSubmissionDocuments.length ? (
                <View className="mt-6 rounded-2xl border border-[#FFB05A]/20 bg-[#FFB05A]/10 p-4">
                  <Text className="text-[#FFD7A6] text-sm font-semibold">Required before submission</Text>
                  <Text className="text-slate-200 text-xs mt-2">
                    These are BitBridge pre-submission requirements. Provider-requested documents may appear later during verification.
                  </Text>
                  <View className="mt-3 gap-2">
                    {preSubmissionDocuments.map((document: any) => (
                      <View key={String(document?.kind)} className="rounded-2xl border border-gray-800 bg-gray-950/40 px-3 py-3">
                        <Text className="text-white text-xs font-semibold">{String(document?.label || document?.kind || 'Document')}</Text>
                        <Text className="text-slate-400 text-[11px] mt-1">{String(document?.description || '')}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
            </>
          ) : null}

          {section === 'contact' ? (
            <View className="mt-5 rounded-2xl border border-white/8 bg-gray-900/80 p-4">
              <Text className="text-white text-base font-semibold">Contact details</Text>
              <Text className="text-slate-400 text-xs mt-1">Add the address and contact records used during verification.</Text>
              {[
                ['contact_email', 'Contact email'],
                ['support_email', 'Support email'],
                ['dispute_email', 'Dispute email'],
                ['contact_phone', 'Contact phone'],
                ['address_line_1', 'Operating address'],
                ['address_line_2', 'Operating address line 2'],
                ['city', 'City'],
                ['postal_code', 'Postal code'],
                ['operating_region', 'Operating region'],
              ].map(([field, label]) => (
                <View key={field} className="mt-4">
                  <Text className="text-gray-400 text-xs">{label}</Text>
                  <TextInput
                    value={(form as any)[field]}
                    onChangeText={(value) => handleChange(field, value)}
                    autoCapitalize={field.includes('email') ? 'none' : 'words'}
                    placeholder={label}
                    placeholderTextColor="#6B7280"
                    className="mt-2 rounded-2xl border border-gray-700 bg-gray-950/45 px-4 py-4 text-white"
                  />
                </View>
              ))}

              <View className="mt-6 border-t border-white/6 pt-6">
                <FormSelect
                  label="State"
                  selectedValue={form.state}
                  onValueChange={(value: string) => handleChange('state', value)}
                  options={STATE_OPTIONS}
                  placeholder="Select state"
                />
              </View>

              <View className="mt-4">
                <FormSelect
                  label="Country"
                  selectedValue={form.country}
                  onValueChange={(value: string) => handleChange('country', value)}
                  options={COUNTRY_OPTIONS}
                  placeholder="Select country"
                />
              </View>

              <View className="mt-6 border-t border-white/6 pt-6">
                <Text className="text-gray-400 text-xs">Registered address</Text>
                <TextInput
                  value={form.registered_address_line_1}
                  onChangeText={(value) => handleChange('registered_address_line_1', value)}
                  autoCapitalize="words"
                  placeholder="Registered address"
                  placeholderTextColor="#6B7280"
                  className="mt-2 rounded-2xl border border-gray-700 bg-gray-950/45 px-4 py-4 text-white"
                />
              </View>

              <View className="mt-4">
                <Text className="text-gray-400 text-xs">Registered address line 2</Text>
                <TextInput
                  value={form.registered_address_line_2}
                  onChangeText={(value) => handleChange('registered_address_line_2', value)}
                  autoCapitalize="words"
                  placeholder="Registered address line 2"
                  placeholderTextColor="#6B7280"
                  className="mt-2 rounded-2xl border border-gray-700 bg-gray-950/45 px-4 py-4 text-white"
                />
              </View>

              <View className="mt-4">
                <Text className="text-gray-400 text-xs">Registered city</Text>
                <TextInput
                  value={form.registered_city}
                  onChangeText={(value) => handleChange('registered_city', value)}
                  autoCapitalize="words"
                  placeholder="Registered city"
                  placeholderTextColor="#6B7280"
                  className="mt-2 rounded-2xl border border-gray-700 bg-gray-950/45 px-4 py-4 text-white"
                />
              </View>

              <View className="mt-4">
                <Text className="text-gray-400 text-xs">Registered postal code</Text>
                <TextInput
                  value={form.registered_postal_code}
                  onChangeText={(value) => handleChange('registered_postal_code', value)}
                  autoCapitalize="characters"
                  placeholder="Registered postal code"
                  placeholderTextColor="#6B7280"
                  className="mt-2 rounded-2xl border border-gray-700 bg-gray-950/45 px-4 py-4 text-white"
                />
              </View>

              <View className="mt-4">
                <FormSelect
                  label="Registered state"
                  selectedValue={form.registered_state}
                  onValueChange={(value: string) => handleChange('registered_state', value)}
                  options={STATE_OPTIONS}
                  placeholder="Select registered state"
                />
              </View>

              <View className="mt-4">
                <FormSelect
                  label="Registered country"
                  selectedValue={form.registered_country}
                  onValueChange={(value: string) => handleChange('registered_country', value)}
                  options={COUNTRY_OPTIONS}
                  placeholder="Select registered country"
                />
              </View>
            </View>
          ) : null}

          {section === 'signatory' ? (
            <View className="mt-5 rounded-2xl border border-white/8 bg-gray-900/80 p-4">
              <View className="flex-row items-center justify-between">
                <View className="flex-1 pr-3">
                  <Text className="text-white text-base font-semibold">Authorized signatory</Text>
                  <Text className="text-gray-400 text-xs mt-1">Add the person responsible for business verification and account control.</Text>
                </View>
                <TouchableOpacity onPress={addSignatory} className="rounded-2xl border border-gray-700 px-3 py-2">
                  <Text className="text-white text-xs font-semibold">Add signatory</Text>
                </TouchableOpacity>
              </View>

              <View className="mt-5 gap-4">
                {signatories.map((signatory, index) => (
                  <View key={String(signatory.id || index)} className="rounded-2xl border border-gray-800 bg-gray-950/45 p-4">
                    <View className="flex-row items-center justify-between">
                      <Text className="text-white text-sm font-semibold">Signatory {index + 1}</Text>
                      {signatories.length > 1 ? (
                        <TouchableOpacity onPress={() => removeSignatory(index)}>
                          <Text className="text-red-300 text-xs font-semibold">Remove</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>

                    <View className="mt-4">
                      <Text className="text-[11px] uppercase tracking-[1.4px] text-slate-500">Identity</Text>
                    </View>
                    {[
                      ['full_name', 'Full name'],
                      ['first_name', 'First name'],
                      ['middle_name', 'Middle name'],
                      ['last_name', 'Last name'],
                      ['email', 'Email'],
                      ['phone', 'Phone'],
                      ['title', 'Title'],
                      ['address_line_1', 'Residential address'],
                      ['city', 'City'],
                      ['postal_code', 'Postal code'],
                      ['bvn', 'BVN'],
                    ].map(([field, label]) => (
                      <View key={field} className="mt-4">
                        <Text className="text-gray-400 text-xs">{label}</Text>
                        <TextInput
                          value={String(signatory[field] || '')}
                          onChangeText={(value) => handleSignatoryChange(index, field, value)}
                          autoCapitalize={field.includes('email') || field === 'bvn' ? 'none' : 'words'}
                          placeholder={label}
                          placeholderTextColor="#6B7280"
                          className="mt-2 rounded-2xl border border-gray-700 bg-gray-900/70 px-4 py-4 text-white"
                        />
                      </View>
                    ))}

                    <View className="mt-6 border-t border-white/6 pt-6">
                      <Text className="text-[11px] uppercase tracking-[1.4px] text-slate-500">Birth and residency</Text>
                    </View>
                    <View className="mt-4">
                      <Text className="text-gray-400 text-xs">Date of birth</Text>
                      <TouchableOpacity
                        onPress={() => openSignatoryDatePicker(index)}
                        className="mt-2 rounded-2xl border border-gray-700 bg-gray-900/70 px-4 py-4"
                      >
                        <Text className={String(signatory.date_of_birth || '').trim() ? 'text-white' : 'text-gray-400'}>
                          {String(signatory.date_of_birth || '').trim()
                            ? formatDisplayDate(String(signatory.date_of_birth))
                            : 'Select date of birth'}
                        </Text>
                      </TouchableOpacity>
                      <Text className="text-gray-500 text-[11px] mt-2">
                        Use the officer&apos;s official date of birth exactly as it appears on their identity record.
                      </Text>
                    </View>

                    <View className="mt-4">
                      <FormSelect
                        label="Identification type"
                        selectedValue={String(signatory.identification_type || '')}
                        onValueChange={(value: string) => handleSignatoryChange(index, 'identification_type', value)}
                        options={identificationTypeOptions}
                        placeholder="Select identification type"
                      />
                    </View>

                    <View className="mt-4">
                      <Text className="text-gray-400 text-xs">ID document number</Text>
                      <TextInput
                        value={String(signatory.id_document_number || '')}
                        onChangeText={(value) => handleSignatoryChange(index, 'id_document_number', value)}
                        autoCapitalize="characters"
                        placeholder="Document number"
                        placeholderTextColor="#6B7280"
                        className="mt-2 rounded-2xl border border-gray-700 bg-gray-900/70 px-4 py-4 text-white"
                      />
                    </View>

                    <View className="mt-4">
                      <Text className="text-gray-400 text-xs">Ownership percentage</Text>
                      <TextInput
                        value={String(signatory.ownership_percentage || '')}
                        onChangeText={(value) => handleSignatoryChange(index, 'ownership_percentage', value.replace(/[^0-9.]/g, ''))}
                        keyboardType="decimal-pad"
                        placeholder="0 - 100"
                        placeholderTextColor="#6B7280"
                        className="mt-2 rounded-2xl border border-gray-700 bg-gray-900/70 px-4 py-4 text-white"
                      />
                    </View>

                    <View className="mt-4">
                      <FormSelect
                        label="Nationality"
                        selectedValue={String(signatory.nationality || 'NG')}
                        onValueChange={(value: string) => handleSignatoryChange(index, 'nationality', value)}
                        options={COUNTRY_OPTIONS}
                        placeholder="Select nationality"
                      />
                    </View>

                    <View className="mt-4">
                      <FormSelect
                        label="State"
                        selectedValue={String(signatory.state || '')}
                        onValueChange={(value: string) => handleSignatoryChange(index, 'state', value)}
                        options={STATE_OPTIONS}
                        placeholder="Select state"
                      />
                    </View>

                    <View className="mt-4">
                      <FormSelect
                        label="Country"
                        selectedValue={String(signatory.country || 'NG')}
                        onValueChange={(value: string) => handleSignatoryChange(index, 'country', value)}
                        options={COUNTRY_OPTIONS}
                        placeholder="Select country"
                      />
                    </View>

                    <View className="mt-6 border-t border-white/6 pt-6">
                      <Text className="text-[11px] uppercase tracking-[1.4px] text-slate-500">Role</Text>
                    </View>
                    <View className="mt-4 flex-row gap-3">
                      <TouchableOpacity
                        onPress={() => handleSignatoryChange(index, 'authorized_signatory', !signatory.authorized_signatory)}
                        className={`flex-1 rounded-2xl border px-4 py-3 ${signatory.authorized_signatory ? 'border-[#FFB05A] bg-[#FFB05A]/12' : 'border-gray-700 bg-transparent'}`}
                      >
                        <Text className="text-white text-xs font-semibold text-center">Authorized signatory</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleSignatoryChange(index, 'director', !signatory.director)}
                        className={`flex-1 rounded-2xl border px-4 py-3 ${signatory.director ? 'border-[#FFB05A] bg-[#FFB05A]/12' : 'border-gray-700 bg-transparent'}`}
                      >
                        <Text className="text-white text-xs font-semibold text-center">Director</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

        </ScrollView>
      )}

      {!loading ? (
        <View
          className="border-t border-gray-800 bg-[#05070D] px-1 pt-4"
          style={{ paddingBottom: Math.max(insets.bottom, 12) }}
        >
          {sectionFeedbackMessage ? (
            <View className="mb-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3">
              <Text className="text-amber-50 text-sm">{sectionFeedbackMessage}</Text>
            </View>
          ) : null}
          <TouchableOpacity onPress={handleSave} disabled={saving} className="rounded-2xl bg-[#FFB05A] px-4 py-4 items-center">
            {saving ? (
              <ActivityIndicator size="small" color="#111827" />
            ) : (
              <Text className="text-black text-sm font-semibold">
                {nextSection ? `Continue to ${SECTION_META[nextSection].title}` : 'Continue to verification review'}
              </Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              if (previousSection) {
                router.replace(`/business/onboarding?section=${previousSection}` as any)
                return
              }
              router.replace('/business' as any)
            }}
            className="mt-3 rounded-2xl border border-gray-700 px-4 py-4 items-center"
          >
            <Text className="text-white text-sm font-semibold">
              {previousSection ? `Back to ${SECTION_META[previousSection].title}` : 'Back to business overview'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {pickerTarget && Platform.OS === 'ios' ? (
        <Modal visible transparent animationType="slide" onRequestClose={closePicker}>
          <Pressable onPress={closePicker} className="flex-1 bg-black/50 justify-end">
            <Pressable onPress={() => {}} className="rounded-t-[28px] border border-white/8 bg-[#0f172a] px-4 pt-4" style={{ paddingBottom: Math.max(insets.bottom, 16) }}>
              <Text className="text-white text-base font-semibold text-center">{pickerTitle}</Text>
              <Text className="text-slate-400 text-xs text-center mt-2">Choose the date, then confirm.</Text>
              <View className="mt-4 rounded-2xl border border-gray-800 bg-gray-950/50 px-3 py-2">
                <DateTimePicker
                  value={pickerDraftDate}
                  mode="date"
                  display="spinner"
                  maximumDate={new Date()}
                  onChange={(_, selected) => {
                    if (selected) setPickerDraftDate(selected)
                  }}
                />
              </View>
              <View className="mt-4 flex-row gap-3">
                <TouchableOpacity onPress={closePicker} className="flex-1 rounded-2xl border border-gray-700 px-4 py-4 items-center">
                  <Text className="text-white text-sm font-semibold">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => applyPickerDate(pickerDraftDate)} className="flex-1 rounded-2xl bg-[#FFB05A] px-4 py-4 items-center">
                  <Text className="text-black text-sm font-semibold">Use date</Text>
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
          maximumDate={new Date()}
          onChange={(_, selected) => {
            if (selected) applyPickerDate(selected)
            else closePicker()
          }}
        />
      ) : null}
      </View>
    </ScreenContainer>
  )
}

export default BusinessOnboardingScreen
