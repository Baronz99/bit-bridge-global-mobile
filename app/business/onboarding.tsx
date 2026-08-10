import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useFocusEffect } from '@react-navigation/native'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import DateTimePicker from '@react-native-community/datetimepicker'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import ScreenContainer from '@/components/ScreenContainer'
import FormSelect from '@/components/FormSelect'
import { deleteBusinessSignatory, getBusinessOnboarding, updateBusinessOnboarding } from '@/api/business'
import { buildApiErrorMessage } from '@/utils/apiErrorMessage'
import { useActiveAccount } from '@/services/useActiveAccount'
import { useAuth } from '@/services/useAuth'
import {
  BUSINESS_NIGERIA_STATE_OPTIONS,
  sanitizeBusinessStateValue,
} from '@/utils/businessStateValidation'

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
type PickerTarget = { kind: 'registration' } | { kind: 'signatory'; index: number } | null

const SECTION_META: Record<
  SectionKey,
  {
    title: string
    eyebrow: string
    description: string
  }
> = {
  business: {
    title: 'Business details',
    eyebrow: 'Step 1',
    description: 'Enter the registered details for your business.',
  },
  contact: {
    title: 'Contact and address',
    eyebrow: 'Step 2',
    description: 'Add the contact and operating address for your business.',
  },
  signatory: {
    title: 'Business representatives',
    eyebrow: 'Step 3',
    description: 'Add the owners, directors or authorised signatories associated with this business.',
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

const CUSTOMER_FIELD_LABELS: Record<string, string> = {
  legal_name: 'Legal business name',
  business_type: 'Business type',
  registration_number: 'Registration number',
  business_bvn: 'BVN for business verification',
  date_of_registration: 'Date of registration',
  category: 'Business category',
  anchor_industry: 'Industry subcategory',
  website: 'Website',
  tax_identifier: 'Tax identifier',
  business_description: 'Business description',
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

const STATE_OPTIONS = BUSINESS_NIGERIA_STATE_OPTIONS

const optionValues = (options: Array<{ value?: string }>) =>
  new Set(options.map((option) => String(option?.value ?? '')).filter(Boolean))

const hasOptionValue = (options: Array<{ value?: string }>, value: unknown) => {
  const normalized = String(value || '').trim()
  return Boolean(normalized && optionValues(options).has(normalized))
}

const sanitizePickerStateValue = (value: unknown, country: unknown) => {
  const normalized = sanitizeBusinessStateValue(value, country)
  return hasOptionValue(STATE_OPTIONS, normalized) ? normalized : ''
}

const registeredAddressMatchesOperating = (form: Record<string, unknown>) => {
  const fields = [
    ['registered_address_line_1', 'address_line_1'],
    ['registered_address_line_2', 'address_line_2'],
    ['registered_city', 'city'],
    ['registered_state', 'state'],
    ['registered_postal_code', 'postal_code'],
    ['registered_country', 'country'],
  ]
  return fields.every(
    ([registered, operating]) =>
      String(form[registered] || '').trim() === String(form[operating] || '').trim()
  )
}

const profileHasDistinctRegisteredAddress = (
  profile: Record<string, unknown>,
  form: Record<string, unknown>
) => {
  const registeredDetailExists = [
    profile.registered_address_line_1,
    profile.registered_address_line_2,
    profile.registered_city,
    profile.registered_state,
    profile.registered_postal_code,
  ].some((value) => String(value || '').trim().length > 0)
  const registeredCountryDiffers =
    String(profile.registered_country || '').trim() &&
    String(profile.registered_country || '').trim() !== String(profile.country || '').trim()

  return (
    Boolean(registeredDetailExists || registeredCountryDiffers) &&
    !registeredAddressMatchesOperating(form)
  )
}

const contactPhoneFromUser = (
  user:
    | {
        phone_number?: unknown
        phone?: unknown
        user_profile?: { phone_number?: unknown }
        profile?: { phone_number?: unknown }
      }
    | null
    | undefined
) =>
  String(
    user?.phone_number ||
      user?.user_profile?.phone_number ||
      user?.profile?.phone_number ||
      user?.phone ||
      ''
  ).trim()

const signatoryTitleOptionsFromRequirements = (
  requirementsValue: Record<string, any> | null | undefined
) => {
  const fields = requirementsValue?.fields || {}
  const options = fields.signatory_title?.options || fields.title?.options
  return Array.isArray(options) ? options : []
}

const sanitizeOptionValue = (value: unknown, options: Array<{ value?: string }>) => {
  const normalized = String(value || '').trim()
  if (!normalized) return ''
  return hasOptionValue(options, normalized) ? normalized : ''
}

const formatLabel = (value: string) =>
  String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase())

const normalizeCountryValue = (value: string, fallback = 'NG') => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
  if (!normalized) return fallback
  return String(countryNameToCode[normalized] || '')
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

const routeParamString = (value: string | string[] | undefined) => {
  if (Array.isArray(value)) return String(value[0] || '')
  return String(value || '')
}

const BusinessOnboardingScreen = () => {
  const router = useRouter()
  const params = useLocalSearchParams<{
    section?: string
    field?: string
    field_error?: string
    route_error?: string
    mode?: string
    return_to?: string
  }>()
  const { activeAccount } = useActiveAccount()
  const { user } = useAuth()
  const accountEmail = String(user?.email || '').trim()
  const accountPhone = contactPhoneFromUser(user)
  const insets = useSafeAreaInsets()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [, setTouchedFields] = useState<Record<string, boolean>>({})
  const [, setTouchedSignatories] = useState<Record<number, Record<string, boolean>>>({})
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [readiness, setReadiness] = useState<Record<string, any> | null>(null)
  const [requirements, setRequirements] = useState<Record<string, any> | null>(null)
  const [pickerTarget, setPickerTarget] = useState<PickerTarget>(null)
  const [pickerDraftDate, setPickerDraftDate] = useState<Date>(new Date(2020, 0, 1))
  const [businessName, setBusinessName] = useState('')
  const [showAdditionalBusinessDetails, setShowAdditionalBusinessDetails] = useState(false)
  const [sameAsOperatingAddress, setSameAsOperatingAddress] = useState(true)
  const [showOptionalAddressFields, setShowOptionalAddressFields] = useState(false)
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
  const [onboardingRevision, setOnboardingRevision] = useState<string | undefined>()
  const scrollRef = useRef<ScrollView | null>(null)
  const inputRefs = useRef<Record<string, TextInput | null>>({})
  const fieldOffsets = useRef<Record<string, number>>({})
  const businessId = activeAccount.type === 'business' ? activeAccount.businessId : null
  const section: SectionKey = SECTION_ORDER.includes(String(params?.section || '') as SectionKey)
    ? (String(params?.section) as SectionKey)
    : 'business'
  const sectionIndex = SECTION_ORDER.indexOf(section) + 1
  const sectionMeta = SECTION_META[section]
  const progressLabel = `${sectionIndex} of ${SECTION_ORDER.length}`
  const nextSection = sectionIndex < SECTION_ORDER.length ? SECTION_ORDER[sectionIndex] : null
  const sectionIntroduction =
    section === 'business'
      ? 'Enter the registered details for your business.'
      : sectionMeta.description
  const routeField = routeParamString(params?.field)
  const routeFieldError = routeParamString(params?.field_error)
  const routedBannerMessage = routeParamString(params?.route_error)
  const correctionMode =
    routeParamString(params?.mode) === 'fix' || routeParamString(params?.return_to) === 'kyb'
  const returnToSetup = routeParamString(params?.return_to) === 'setup'
  const normalizedRouteField = routeField === 'signatory_title' ? 'title' : routeField
  const routedFieldMessage = routeFieldError || 'Update this field and save again.'

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
      setOnboardingRevision(data.onboarding_revision)
      const incomingRequirements = data.requirements || null
      const incomingTitleOptions = signatoryTitleOptionsFromRequirements(incomingRequirements)
      const incomingSignatories =
        Array.isArray(data.signatories) && data.signatories.length
          ? data.signatories
          : [emptySignatory()]
      const profileCountry = normalizeCountryValue(String(profile.country || 'NG'))
      const registeredCountry = normalizeCountryValue(String(profile.registered_country || 'NG'))

      setReadiness(data.readiness || null)
      setRequirements(incomingRequirements)
      const loadedForm = {
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
        contact_email: String(profile.contact_email || accountEmail),
        support_email: String(profile.support_email || ''),
        dispute_email: String(profile.dispute_email || ''),
        contact_phone: String(profile.contact_phone || accountPhone),
        address_line_1: String(profile.address_line_1 || ''),
        address_line_2: String(profile.address_line_2 || ''),
        city: String(profile.city || ''),
        state: sanitizePickerStateValue(profile.state, profileCountry),
        postal_code: String(profile.postal_code || ''),
        country: profileCountry,
        operating_region: String(profile.operating_region || ''),
        registered_address_line_1: String(profile.registered_address_line_1 || ''),
        registered_address_line_2: String(profile.registered_address_line_2 || ''),
        registered_city: String(profile.registered_city || ''),
        registered_state: sanitizePickerStateValue(profile.registered_state, registeredCountry),
        registered_postal_code: String(profile.registered_postal_code || ''),
        registered_country: registeredCountry,
      }
      setBusinessName(String(entity.name || profile.legal_name || ''))
      setForm(loadedForm)
      setSameAsOperatingAddress(!profileHasDistinctRegisteredAddress(profile, loadedForm))
      setShowAdditionalBusinessDetails(
        Boolean(loadedForm.website || loadedForm.tax_identifier || loadedForm.business_description)
      )
      setShowOptionalAddressFields(
        Boolean(
          loadedForm.address_line_2 ||
          loadedForm.postal_code ||
          loadedForm.operating_region ||
          loadedForm.registered_address_line_2 ||
          loadedForm.registered_postal_code
        )
      )
      setSignatories(
        incomingSignatories.map((item: Record<string, any>) => {
          const signatoryCountry = normalizeCountryValue(String(item?.country || 'NG'))
          return {
            ...emptySignatory(),
            ...item,
            id: item?.id,
            full_name: String(item?.full_name || ''),
            first_name: String(item?.first_name || ''),
            middle_name: String(item?.middle_name || ''),
            last_name: String(item?.last_name || ''),
            email: String(item?.email || ''),
            phone: String(item?.phone || ''),
            title: incomingTitleOptions.length
              ? sanitizeOptionValue(item?.title, incomingTitleOptions)
              : String(item?.title || ''),
            date_of_birth: String(item?.date_of_birth || ''),
            nationality: normalizeCountryValue(String(item?.nationality || 'NG')),
            address_line_1: String(item?.address_line_1 || ''),
            city: String(item?.city || ''),
            state: sanitizePickerStateValue(item?.state, signatoryCountry),
            postal_code: String(item?.postal_code || ''),
            country: signatoryCountry,
            bvn: String(item?.bvn || ''),
            identification_type: String(item?.identification_type || ''),
            id_document_number: String(item?.id_document_number || ''),
            ownership_percentage:
              item?.ownership_percentage === null || item?.ownership_percentage === undefined
                ? ''
                : String(item.ownership_percentage),
            status: String(item?.status || 'active'),
            authorized_signatory: item?.authorized_signatory !== false,
            director: item?.director !== false,
          }
        })
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
  }, [accountEmail, accountPhone, businessId])

  useFocusEffect(
    useCallback(() => {
      void loadOnboarding()
    }, [loadOnboarding])
  )

  useEffect(() => {
    setErrorMessage(null)
    setSuccessMessage(null)
    setFieldErrors({})
  }, [section])

  useEffect(() => {
    if (!normalizedRouteField) return
    if (section === 'signatory') {
      setTouchedSignatories((current) => ({
        ...current,
        0: { ...(current[0] || {}), [normalizedRouteField]: true },
      }))
      return
    }
    setTouchedFields((current) => ({ ...current, [normalizedRouteField]: true }))
  }, [normalizedRouteField, section])

  const contactFieldError = useCallback(
    (field: string) => {
      if (section !== 'contact' || normalizedRouteField !== field) return ''
      return routedFieldMessage
    },
    [normalizedRouteField, routedFieldMessage, section]
  )

  const businessFieldError = useCallback(
    (field: string) => {
      if (section !== 'business') return ''
      if (fieldErrors[field]) return fieldErrors[field]
      if (normalizedRouteField === field) return routedFieldMessage
      return ''
    },
    [fieldErrors, normalizedRouteField, routedFieldMessage, section]
  )

  const signatoryFieldError = useCallback(
    (field: string) => {
      if (section !== 'signatory' || normalizedRouteField !== field) return ''
      return routedFieldMessage
    },
    [normalizedRouteField, routedFieldMessage, section]
  )

  const handleChange = (field: string, value: string) => {
    setTouchedFields((current) => ({ ...current, [field]: true }))
    setFieldErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
    setForm((current) => ({
      ...current,
      [field]:
        field === 'state'
          ? sanitizePickerStateValue(value, current.country)
          : field === 'registered_state'
            ? sanitizePickerStateValue(value, current.registered_country)
            : field === 'country' || field === 'registered_country'
              ? normalizeCountryValue(value)
              : value,
      ...(field === 'country'
        ? { state: sanitizePickerStateValue(current.state, normalizeCountryValue(value)) }
        : {}),
      ...(field === 'registered_country'
        ? {
            registered_state: sanitizePickerStateValue(
              current.registered_state,
              normalizeCountryValue(value)
            ),
          }
        : {}),
      ...(field === 'category' && value !== current.category ? { anchor_industry: '' } : {}),
    }))
  }

  const handleSignatoryChange = (index: number, field: string, value: string | boolean) => {
    setTouchedSignatories((current) => ({
      ...current,
      [index]: { ...(current[index] || {}), [field]: true },
    }))
    setSignatories((current) =>
      current.map((item, itemIndex) => {
        if (itemIndex !== index) return item
        if (field === 'country') {
          const country = normalizeCountryValue(String(value || 'NG'))
          return {
            ...item,
            country,
            state: sanitizePickerStateValue(item.state, country),
          }
        }
        if (field === 'state') {
          return {
            ...item,
            state: sanitizePickerStateValue(value, item.country),
          }
        }
        if (field === 'nationality') {
          return {
            ...item,
            nationality: normalizeCountryValue(String(value || 'NG')),
          }
        }
        if (field === 'title') {
          const titleOptions = signatoryTitleOptionsFromRequirements(requirements)
          return {
            ...item,
            title: titleOptions.length
              ? sanitizeOptionValue(value, titleOptions)
              : String(value || ''),
          }
        }
        return { ...item, [field]: value }
      })
    )
  }

  const addSignatory = () => {
    setSignatories((current) => [...current, emptySignatory()])
  }

  const removeSignatory = (index: number) => {
    setSignatories((current) =>
      current.length > 1 ? current.filter((_, itemIndex) => itemIndex !== index) : current
    )
  }

  const removeSavedSignatory = (signatory: Record<string, any>) => {
    if (!businessId || !signatory?.id) return
    Alert.alert('Remove this person?', 'This will remove them from this business verification.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove person', style: 'destructive', onPress: async () => {
          try {
            await deleteBusinessSignatory(businessId, signatory.id, onboardingRevision)
            await loadOnboarding()
          } catch (error: any) {
            if (error?.response?.status === 409) {
              await loadOnboarding()
              Alert.alert('Details refreshed', 'This business was updated elsewhere. We’ve refreshed the latest details.')
            } else Alert.alert('Unable to remove person', 'Please try again.')
          }
        },
      },
    ])
  }

  const missingProfileFields = useMemo(
    () =>
      Array.isArray(readiness?.missing_profile_fields) ? readiness.missing_profile_fields : [],
    [readiness?.missing_profile_fields]
  )
  const missingSignatoryRequirements = useMemo(
    () =>
      Array.isArray(readiness?.missing_signatory_requirements)
        ? readiness.missing_signatory_requirements
        : [],
    [readiness?.missing_signatory_requirements]
  )

  const currentSectionMissing = useMemo(() => {
    if (section === 'business') {
      const grouped = requirements?.groups?.company_details?.missing_fields
      if (Array.isArray(grouped)) return grouped
      return missingProfileFields.filter((field: string) =>
        BUSINESS_SECTION_FIELDS.includes(String(field))
      )
    }
    if (section === 'contact') {
      const grouped = requirements?.groups?.contact_details?.missing_fields
      if (Array.isArray(grouped)) return grouped
      return missingProfileFields.filter((field: string) =>
        CONTACT_SECTION_FIELDS.includes(String(field))
      )
    }
    return missingSignatoryRequirements
  }, [section, requirements?.groups, missingProfileFields, missingSignatoryRequirements])

  const customerFieldLabel = useCallback(
    (field: string) => CUSTOMER_FIELD_LABELS[field] || 'This field',
    []
  )

  const registerFieldPosition = useCallback((field: string, y: number) => {
    fieldOffsets.current[field] = y
  }, [])

  const focusField = useCallback((field: string) => {
    const y = fieldOffsets.current[field]
    if (typeof y === 'number') {
      scrollRef.current?.scrollTo({ y: Math.max(y - 20, 0), animated: true })
    }

    const input = inputRefs.current[field]
    if (input) {
      setTimeout(() => input.focus(), 250)
    }
  }, [])

  const businessTypeOptions = useMemo(
    () =>
      Array.isArray(requirements?.fields?.business_type?.options) &&
      requirements.fields.business_type.options.length
        ? requirements.fields.business_type.options
        : FALLBACK_BUSINESS_TYPE_OPTIONS,
    [requirements?.fields?.business_type?.options]
  )
  const businessCategoryOptions = useMemo(
    () =>
      Array.isArray(requirements?.fields?.category?.options) &&
      requirements.fields.category.options.length
        ? requirements.fields.category.options
        : FALLBACK_BUSINESS_CATEGORY_OPTIONS,
    [requirements?.fields?.category?.options]
  )
  const anchorIndustryOptions = useMemo(
    () =>
      Array.isArray(requirements?.fields?.anchor_industry?.options) &&
      requirements.fields.anchor_industry.options.length
        ? requirements.fields.anchor_industry.options
        : [],
    [requirements?.fields?.anchor_industry?.options]
  )
  const showAnchorIndustryField = requirements?.fields?.anchor_industry?.visible === true
  const selectedBusinessRequiresBvn =
    normalizeCountryValue(form.country) === 'NG' && form.business_type === 'limited_company'
  const showBusinessBvnField =
    requirements?.fields?.business_bvn?.visible === true || selectedBusinessRequiresBvn
  const identificationTypeOptions = useMemo(
    () =>
      Array.isArray(requirements?.fields?.identification_type?.options) &&
      requirements.fields.identification_type.options.length
        ? requirements.fields.identification_type.options
        : IDENTIFICATION_TYPE_OPTIONS,
    [requirements?.fields?.identification_type?.options]
  )
  const signatoryTitleOptions = useMemo(
    () => signatoryTitleOptionsFromRequirements(requirements),
    [requirements]
  )
  const showSignatoryTitlePicker = signatoryTitleOptions.length > 0
  const pickerTitle =
    pickerTarget?.kind === 'registration' ? 'Registration date' : 'Signatory date of birth'

  const openRegistrationDatePicker = () => {
    setPickerDraftDate(parseStoredDate(form.date_of_registration) || new Date(2020, 0, 1))
    setPickerTarget({ kind: 'registration' })
  }

  const openSignatoryDatePicker = (index: number) => {
    setPickerDraftDate(
      parseStoredDate(String(signatories[index]?.date_of_birth || '')) || new Date(1990, 0, 1)
    )
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

  const validateCurrentSection = () => {
    const requiredMissing = (field: string, value: unknown) =>
      currentSectionMissing.includes(field) && !String(value || '').trim()

    if (section === 'business') {
      const missingFields = currentSectionMissing.filter(
        (field) => !String((form as Record<string, unknown>)[field] || '').trim()
      )

      if (missingFields.length) {
        const nextErrors = Object.fromEntries(
          missingFields.map((field) => [field, `${customerFieldLabel(field)} is required.`])
        )
        setFieldErrors(nextErrors)
        setTouchedFields((current) => ({
          ...current,
          ...Object.fromEntries(missingFields.map((field) => [field, true])),
        }))
        focusField(missingFields[0])
        return 'Complete the highlighted required field to continue.'
      }
    }

    if (section === 'contact') {
      const contactForm = sameAsOperatingAddress
        ? {
            ...form,
            registered_address_line_1: form.address_line_1,
            registered_address_line_2: form.address_line_2,
            registered_city: form.city,
            registered_state: form.state,
            registered_postal_code: form.postal_code,
            registered_country: form.country,
          }
        : form
      const invalidFields = [
        !hasOptionValue(COUNTRY_OPTIONS, contactForm.country) ? 'country' : '',
        !hasOptionValue(COUNTRY_OPTIONS, contactForm.registered_country)
          ? 'registered_country'
          : '',
        (contactForm.state || requiredMissing('state', contactForm.state)) &&
        !hasOptionValue(STATE_OPTIONS, contactForm.state)
          ? 'state'
          : '',
        (contactForm.registered_state ||
          requiredMissing('registered_state', contactForm.registered_state)) &&
        !hasOptionValue(STATE_OPTIONS, contactForm.registered_state)
          ? 'registered_state'
          : '',
      ].filter(Boolean)

      if (invalidFields.length) {
        setTouchedFields((current) => ({
          ...current,
          ...Object.fromEntries(invalidFields.map((field) => [field, true])),
        }))
        return `Select valid values for: ${invalidFields.map(formatLabel).join(', ')}.`
      }
    }

    if (section === 'signatory') {
      const invalidByIndex: Record<number, string[]> = {}
      signatories.forEach((signatory, index) => {
        const fields = [
          !hasOptionValue(COUNTRY_OPTIONS, signatory.country) ? 'country' : '',
          !hasOptionValue(COUNTRY_OPTIONS, signatory.nationality) ? 'nationality' : '',
          (signatory.state || requiredMissing('state', signatory.state)) &&
          !hasOptionValue(STATE_OPTIONS, signatory.state)
            ? 'state'
            : '',
          showSignatoryTitlePicker &&
          (signatory.title || requiredMissing('title', signatory.title)) &&
          !hasOptionValue(signatoryTitleOptions, signatory.title)
            ? 'title'
            : '',
        ].filter(Boolean)
        if (fields.length) invalidByIndex[index] = fields
      })

      const invalidEntries = Object.entries(invalidByIndex)
      if (invalidEntries.length) {
        setTouchedSignatories((current) => {
          const next = { ...current }
          invalidEntries.forEach(([index, fields]) => {
            next[Number(index)] = {
              ...(next[Number(index)] || {}),
              ...Object.fromEntries(fields.map((field) => [field, true])),
            }
          })
          return next
        })
        const uniqueFields = [...new Set(invalidEntries.flatMap(([, fields]) => fields))]
        return `Select valid signatory values for: ${uniqueFields.map(formatLabel).join(', ')}.`
      }
    }

    return null
  }

  const handleSave = async () => {
    if (!businessId) return
    const localValidationMessage = validateCurrentSection()
    if (localValidationMessage) {
      setErrorMessage(localValidationMessage)
      setSuccessMessage(null)
      return
    }
    setSaving(true)
    setErrorMessage(null)
    setSuccessMessage(null)
    try {
      const submittedForm = sameAsOperatingAddress
        ? {
            ...form,
            registered_address_line_1: form.address_line_1,
            registered_address_line_2: form.address_line_2,
            registered_city: form.city,
            registered_state: form.state,
            registered_postal_code: form.postal_code,
            registered_country: form.country,
          }
        : form
      const payload = {
        onboarding: {
          name: businessName || form.legal_name,
          ...submittedForm,
          country: normalizeCountryValue(submittedForm.country),
          state: sanitizePickerStateValue(submittedForm.state, submittedForm.country),
          registered_country: normalizeCountryValue(submittedForm.registered_country),
          registered_state: sanitizePickerStateValue(
            submittedForm.registered_state,
            submittedForm.registered_country
          ),
          signatories: signatories
            .filter((item) =>
              String(item.full_name || item.first_name || item.last_name || '').trim()
            )
            .map((item) => ({
              id: item.id,
              full_name: item.full_name,
              first_name: item.first_name,
              middle_name: item.middle_name,
              last_name: item.last_name,
              email: item.email,
              phone: item.phone,
              title: showSignatoryTitlePicker
                ? sanitizeOptionValue(item.title, signatoryTitleOptions)
                : item.title,
              date_of_birth: item.date_of_birth,
              nationality: normalizeCountryValue(item.nationality),
              address_line_1: item.address_line_1,
              city: item.city,
              state: sanitizePickerStateValue(item.state, item.country),
              postal_code: item.postal_code,
              country: normalizeCountryValue(item.country),
              bvn: item.bvn,
              identification_type: item.identification_type,
              id_document_number: item.id_document_number,
              ownership_percentage:
                String(item.ownership_percentage || '').trim() === ''
                  ? ''
                  : Number(item.ownership_percentage),
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
      setSuccessMessage(correctionMode ? 'Correction saved.' : 'Business profile saved.')

      if (correctionMode) {
        router.replace('/business/kyb' as any)
        return
      }

      if (returnToSetup) {
        router.replace('/business/setup' as any)
        return
      }

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

  const handlePeopleContinue = () => {
    if (Array.isArray(readiness?.role_requirements?.missing_roles) && readiness.role_requirements.missing_roles.length) {
      setErrorMessage('Complete the required roles before continuing.')
      return
    }
    if (Array.isArray(readiness?.signatory_issues) && readiness.signatory_issues.some((item: any) => item.submission_ready === false)) {
      setErrorMessage('Complete the required person details before continuing.')
      return
    }
    if (Array.isArray(readiness?.missing_signatory_requirements) && readiness.missing_signatory_requirements.length) {
      setErrorMessage('Complete the required representative details before continuing.')
      return
    }
    router.replace('/business/kyb' as any)
  }

  const savedSignatories = signatories.filter((item) => item.id)
  const missingRoles = Array.isArray(readiness?.role_requirements?.missing_roles)
    ? readiness.role_requirements.missing_roles
    : []
  const showRoleGuidance = savedSignatories.length > 0 && missingRoles.length > 0

  return (
    <ScreenContainer
      scroll={false}
      includeTabBarPadding={false}
      topPadding={16}
      horizontalPadding={14}
    >
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        >
          <View className="pt-1">
            <Text className="text-white text-[24px] font-semibold">{sectionMeta.title}</Text>
            <Text className="mt-2 text-slate-300 text-sm font-medium">{`Step ${progressLabel}`}</Text>
            <Text className="mt-3 text-slate-300 text-sm">{sectionIntroduction}</Text>
          </View>

          {errorMessage || routedBannerMessage ? (
            <View className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-4">
              <Text className="text-red-100 text-sm">{errorMessage || routedBannerMessage}</Text>
            </View>
          ) : null}
          {successMessage ? (
            <View className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-4">
              <Text className="text-emerald-100 text-sm">{successMessage}</Text>
            </View>
          ) : null}

          {loading ? (
            <View className="min-h-[320px] items-center justify-center">
              <ActivityIndicator size="small" color="#FFB05A" />
              <Text className="text-white mt-3">Loading business profile...</Text>
            </View>
          ) : (
            <>
              {section === 'business' ? (
                <>
                  <View className="mt-5 rounded-2xl border border-white/8 bg-gray-900/80 p-4">
                    <Text className="text-white text-base font-semibold">Registration details</Text>

                    <View
                      className="mt-4"
                      onLayout={(event) =>
                        registerFieldPosition('legal_name', event.nativeEvent.layout.y)
                      }
                    >
                      <Text className="text-gray-400 text-xs">Legal business name</Text>
                      <TextInput
                        ref={(input) => {
                          inputRefs.current.legal_name = input
                        }}
                        value={form.legal_name}
                        onChangeText={(value) => handleChange('legal_name', value)}
                        placeholder="Exact registered company name"
                        placeholderTextColor="#6B7280"
                        className="mt-2 rounded-2xl border border-gray-700 bg-gray-950/45 px-4 py-4 text-white"
                      />
                      {businessFieldError('legal_name') ? (
                        <Text className="text-red-300 text-xs mt-2">
                          {businessFieldError('legal_name')}
                        </Text>
                      ) : null}
                    </View>

                    <View
                      className="mt-4"
                      onLayout={(event) =>
                        registerFieldPosition('business_type', event.nativeEvent.layout.y)
                      }
                    >
                      <FormSelect
                        label="Business type"
                        selectedValue={form.business_type}
                        onValueChange={(value: string) => handleChange('business_type', value)}
                        options={businessTypeOptions}
                        placeholder="Select business type"
                      />
                      {businessFieldError('business_type') ? (
                        <Text className="text-red-300 text-xs mt-2">
                          {businessFieldError('business_type')}
                        </Text>
                      ) : null}
                    </View>

                    <View
                      className="mt-6 border-t border-white/6 pt-6"
                      onLayout={(event) =>
                        registerFieldPosition('registration_number', event.nativeEvent.layout.y)
                      }
                    >
                      <Text className="text-gray-400 text-xs">Registration number</Text>
                      <TextInput
                        ref={(input) => {
                          inputRefs.current.registration_number = input
                        }}
                        value={form.registration_number}
                        onChangeText={(value) => handleChange('registration_number', value)}
                        autoCapitalize="characters"
                        placeholder="Enter registration number"
                        placeholderTextColor="#6B7280"
                        className="mt-2 rounded-2xl border border-gray-700 bg-gray-950/45 px-4 py-4 text-white"
                      />
                      {businessFieldError('registration_number') ? (
                        <Text className="text-red-300 text-xs mt-2">
                          {businessFieldError('registration_number')}
                        </Text>
                      ) : null}
                    </View>

                    {showBusinessBvnField ? (
                      <View
                        className="mt-4"
                        onLayout={(event) =>
                          registerFieldPosition('business_bvn', event.nativeEvent.layout.y)
                        }
                      >
                        <Text className="text-gray-400 text-xs">BVN for business verification</Text>
                        <TextInput
                          ref={(input) => {
                            inputRefs.current.business_bvn = input
                          }}
                          value={form.business_bvn}
                          onChangeText={(value) =>
                            handleChange('business_bvn', value.replace(/\D/g, '').slice(0, 11))
                          }
                          keyboardType="number-pad"
                          placeholder="11-digit BVN"
                          placeholderTextColor="#6B7280"
                          className="mt-2 rounded-2xl border border-gray-700 bg-gray-950/45 px-4 py-4 text-white"
                        />
                        <Text className="text-gray-500 text-[11px] mt-2">
                          This is required to complete verification for this business.
                        </Text>
                        {businessFieldError('business_bvn') ? (
                          <Text className="text-red-300 text-xs mt-2">
                            {businessFieldError('business_bvn')}
                          </Text>
                        ) : null}
                      </View>
                    ) : null}

                    <View
                      className="mt-4"
                      onLayout={(event) =>
                        registerFieldPosition('date_of_registration', event.nativeEvent.layout.y)
                      }
                    >
                      <Text className="text-gray-400 text-xs">Date of registration</Text>
                      <TouchableOpacity
                        onPress={openRegistrationDatePicker}
                        className="mt-2 rounded-2xl border border-gray-700 bg-gray-950/45 px-4 py-4"
                      >
                        <Text
                          className={form.date_of_registration ? 'text-white' : 'text-gray-400'}
                        >
                          {form.date_of_registration
                            ? formatDisplayDate(form.date_of_registration)
                            : 'Select registration date'}
                        </Text>
                      </TouchableOpacity>
                      {businessFieldError('date_of_registration') ? (
                        <Text className="text-red-300 text-xs mt-2">
                          {businessFieldError('date_of_registration')}
                        </Text>
                      ) : null}
                    </View>

                    <View
                      className="mt-6 border-t border-white/6 pt-6"
                      onLayout={(event) =>
                        registerFieldPosition('category', event.nativeEvent.layout.y)
                      }
                    >
                      <FormSelect
                        label="Business category"
                        selectedValue={form.category}
                        onValueChange={(value: string) => handleChange('category', value)}
                        options={businessCategoryOptions}
                        placeholder="Select business category"
                      />
                      {businessFieldError('category') ? (
                        <Text className="text-red-300 text-xs mt-2">
                          {businessFieldError('category')}
                        </Text>
                      ) : null}
                    </View>

                    {showAnchorIndustryField ? (
                      <View
                        className="mt-4"
                        onLayout={(event) =>
                          registerFieldPosition('anchor_industry', event.nativeEvent.layout.y)
                        }
                      >
                        <FormSelect
                          label={String(
                            requirements?.fields?.anchor_industry?.label || 'Industry subcategory'
                          ).replace(/\bAnchor\b/g, 'BitBridge')}
                          selectedValue={form.anchor_industry}
                          onValueChange={(value: string) => handleChange('anchor_industry', value)}
                          options={anchorIndustryOptions}
                          placeholder="Select industry subcategory"
                        />
                        {businessFieldError('anchor_industry') ? (
                          <Text className="text-red-300 text-xs mt-2">
                            {businessFieldError('anchor_industry')}
                          </Text>
                        ) : null}
                      </View>
                    ) : null}

                    <View
                      className="mt-6 border-t border-white/6 pt-6"
                      onLayout={(event) =>
                        registerFieldPosition('website', event.nativeEvent.layout.y)
                      }
                    >
                      <Pressable
                        onPress={() => setShowAdditionalBusinessDetails((current) => !current)}
                        accessibilityRole="button"
                        accessibilityState={{ expanded: showAdditionalBusinessDetails }}
                        className="flex-row items-center justify-between py-1"
                      >
                        <View>
                          <Text className="text-white text-base font-semibold">
                            Additional business details
                          </Text>
                          <Text className="text-slate-400 text-xs mt-1">Optional</Text>
                        </View>
                        <Text className="text-slate-300 text-lg">
                          {showAdditionalBusinessDetails ? '⌃' : '⌄'}
                        </Text>
                      </Pressable>
                      {showAdditionalBusinessDetails ? (
                        <>
                          <View className="mt-4">
                            <Text className="text-gray-400 text-xs">Display name (optional)</Text>
                            <TextInput
                              value={businessName}
                              onChangeText={setBusinessName}
                              placeholder="Name shown in BitBridge"
                              placeholderTextColor="#6B7280"
                              className="mt-2 rounded-2xl border border-gray-700 bg-gray-950/45 px-4 py-4 text-white"
                            />
                            <Text className="text-gray-500 text-[11px] mt-2">
                              The name shown for this business in BitBridge.
                            </Text>
                          </View>
                          <Text className="text-gray-400 text-xs">Website</Text>
                          <TextInput
                            ref={(input) => {
                              inputRefs.current.website = input
                            }}
                            value={form.website}
                            onChangeText={(value) => handleChange('website', value)}
                            autoCapitalize="none"
                            placeholder="https://example.com"
                            placeholderTextColor="#6B7280"
                            className="mt-2 rounded-2xl border border-gray-700 bg-gray-950/45 px-4 py-4 text-white"
                          />
                          {businessFieldError('website') ? (
                            <Text className="text-red-300 text-xs mt-2">
                              {businessFieldError('website')}
                            </Text>
                          ) : null}

                          <View
                            className="mt-4"
                            onLayout={(event) =>
                              registerFieldPosition('tax_identifier', event.nativeEvent.layout.y)
                            }
                          >
                            <Text className="text-gray-400 text-xs">Tax identifier</Text>
                            <TextInput
                              ref={(input) => {
                                inputRefs.current.tax_identifier = input
                              }}
                              value={form.tax_identifier}
                              onChangeText={(value) => handleChange('tax_identifier', value)}
                              autoCapitalize="characters"
                              placeholder="Tax identification number"
                              placeholderTextColor="#6B7280"
                              className="mt-2 rounded-2xl border border-gray-700 bg-gray-950/45 px-4 py-4 text-white"
                            />
                            {businessFieldError('tax_identifier') ? (
                              <Text className="text-red-300 text-xs mt-2">
                                {businessFieldError('tax_identifier')}
                              </Text>
                            ) : null}
                          </View>

                          <View
                            className="mt-4"
                            onLayout={(event) =>
                              registerFieldPosition(
                                'business_description',
                                event.nativeEvent.layout.y
                              )
                            }
                          >
                            <Text className="text-gray-400 text-xs">Business description</Text>
                            <TextInput
                              ref={(input) => {
                                inputRefs.current.business_description = input
                              }}
                              value={form.business_description}
                              onChangeText={(value) => handleChange('business_description', value)}
                              placeholder="Short description of what the business does"
                              placeholderTextColor="#6B7280"
                              multiline
                              className="mt-2 min-h-[104px] rounded-2xl border border-gray-700 bg-gray-950/45 px-4 py-4 text-white"
                              textAlignVertical="top"
                            />
                            {businessFieldError('business_description') ? (
                              <Text className="text-red-300 text-xs mt-2">
                                {businessFieldError('business_description')}
                              </Text>
                            ) : null}
                          </View>
                        </>
                      ) : null}
                    </View>
                  </View>
                </>
              ) : null}

              {section === 'contact' ? (
                <View className="mt-5 rounded-2xl border border-white/8 bg-gray-900/80 p-4">
                  <Text className="text-white text-base font-semibold">Business contact</Text>
                  {[
                    ['contact_email', 'Contact email'],
                    ['contact_phone', 'Contact phone'],
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
                    <Text className="text-white text-base font-semibold">Operating address</Text>
                    <View className="mt-4">
                      <Text className="text-gray-400 text-xs">Address line 1</Text>
                      <TextInput
                        value={form.address_line_1}
                        onChangeText={(value) => handleChange('address_line_1', value)}
                        autoCapitalize="words"
                        placeholder="Address line 1"
                        placeholderTextColor="#6B7280"
                        className="mt-2 rounded-2xl border border-gray-700 bg-gray-950/45 px-4 py-4 text-white"
                      />
                    </View>
                    <View className="mt-4">
                      <Text className="text-gray-400 text-xs">City</Text>
                      <TextInput
                        value={form.city}
                        onChangeText={(value) => handleChange('city', value)}
                        autoCapitalize="words"
                        placeholder="City"
                        placeholderTextColor="#6B7280"
                        className="mt-2 rounded-2xl border border-gray-700 bg-gray-950/45 px-4 py-4 text-white"
                      />
                    </View>
                    <View className="mt-4">
                      <FormSelect
                        label="State"
                        selectedValue={form.state}
                        onValueChange={(value: string) => handleChange('state', value)}
                        options={STATE_OPTIONS}
                        placeholder="Select state"
                      />
                      {contactFieldError('state') ? (
                        <Text className="text-red-300 text-xs mt-2">
                          {contactFieldError('state')}
                        </Text>
                      ) : null}
                    </View>

                    <View className="mt-4">
                      <FormSelect
                        label="Country"
                        selectedValue={form.country}
                        onValueChange={(value: string) => handleChange('country', value)}
                        options={COUNTRY_OPTIONS}
                        placeholder="Select country"
                      />
                      {contactFieldError('country') ? (
                        <Text className="text-red-300 text-xs mt-2">
                          {contactFieldError('country')}
                        </Text>
                      ) : null}
                    </View>
                  </View>

                  <Pressable
                    onPress={() => setShowOptionalAddressFields((current) => !current)}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: showOptionalAddressFields }}
                    className="mt-5 flex-row items-center justify-between"
                  >
                    <Text className="text-slate-300 text-sm">Optional address details</Text>
                    <Text className="text-slate-300 text-base">
                      {showOptionalAddressFields ? '⌃' : '⌄'}
                    </Text>
                  </Pressable>

                  {showOptionalAddressFields ? (
                    <>
                      {[
                        ['address_line_2', 'Address line 2'],
                        ['postal_code', 'Postal code'],
                        ['operating_region', 'Operating region'],
                      ].map(([field, label]) => (
                        <View key={field} className="mt-4">
                          <Text className="text-gray-400 text-xs">{label}</Text>
                          <TextInput
                            value={(form as any)[field]}
                            onChangeText={(value) => handleChange(field, value)}
                            autoCapitalize="words"
                            placeholder={label}
                            placeholderTextColor="#6B7280"
                            className="mt-2 rounded-2xl border border-gray-700 bg-gray-950/45 px-4 py-4 text-white"
                          />
                        </View>
                      ))}
                    </>
                  ) : null}

                  <Pressable
                    onPress={() => setSameAsOperatingAddress((current) => !current)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: sameAsOperatingAddress }}
                    className="mt-6 flex-row items-center rounded-xl border border-white/10 px-3 py-3"
                  >
                    <View
                      className={`mr-3 h-5 w-5 items-center justify-center rounded border ${
                        sameAsOperatingAddress
                          ? 'border-amber-400 bg-amber-400'
                          : 'border-gray-500 bg-transparent'
                      }`}
                    >
                      {sameAsOperatingAddress ? (
                        <Text className="text-gray-950 text-xs font-bold">✓</Text>
                      ) : null}
                    </View>
                    <Text className="flex-1 text-slate-200 text-sm">
                      Registered address is the same as operating address
                    </Text>
                  </Pressable>

                  {!sameAsOperatingAddress ? (
                    <>
                      <View className="mt-6 border-t border-white/6 pt-6">
                        <Text className="text-white text-base font-semibold">
                          Registered address
                        </Text>
                        <Text className="text-gray-400 text-xs mt-4">Address line 1</Text>
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
                        {contactFieldError('registered_state') ? (
                          <Text className="text-red-300 text-xs mt-2">
                            {contactFieldError('registered_state')}
                          </Text>
                        ) : null}
                      </View>

                      <View className="mt-4">
                        <FormSelect
                          label="Registered country"
                          selectedValue={form.registered_country}
                          onValueChange={(value: string) =>
                            handleChange('registered_country', value)
                          }
                          options={COUNTRY_OPTIONS}
                          placeholder="Select registered country"
                        />
                        {contactFieldError('registered_country') ? (
                          <Text className="text-red-300 text-xs mt-2">
                            {contactFieldError('registered_country')}
                          </Text>
                        ) : null}
                      </View>
                    </>
                  ) : null}
                </View>
              ) : null}

              {section === 'signatory' ? (
                <View className="mt-5">
                  <View className="mt-5 gap-3">
                    {savedSignatories.map((person) => {
                      const issue = Array.isArray(readiness?.signatory_issues)
                        ? readiness.signatory_issues.find((entry: any) => String(entry.signatory_id) === String(person.id))
                        : null
                      const ownership = Number(person.ownership_percentage || 0)
                      const roles = [ownership > 0 ? `Owner · ${ownership}%` : '', person.director ? 'Director' : '', person.authorized_signatory ? 'Authorised signatory' : ''].filter(Boolean)
                      return <View key={String(person.id)} className="rounded-2xl border border-gray-800 bg-gray-900/70 p-4">
                        <Text className="text-white text-base font-semibold">{person.full_name || 'Person'}</Text>
                        {roles.map((role) => <Text key={role} className="text-slate-300 text-sm mt-1">{role}</Text>)}
                        {issue?.submission_ready === false ? <Text className="mt-3 text-amber-200 text-sm">Needs attention</Text> : null}
                        <View className="mt-4 flex-row gap-3"><TouchableOpacity onPress={() => router.push(`/business/signatories/${person.id}?return_to=${correctionMode ? 'kyb' : returnToSetup ? 'setup' : ''}` as any)} className="flex-1 rounded-2xl border border-gray-700 px-4 py-3 items-center"><Text className="text-white text-sm font-semibold">Edit</Text></TouchableOpacity><TouchableOpacity onPress={() => removeSavedSignatory(person)} className="rounded-2xl border border-red-400/40 px-4 py-3 items-center"><Text className="text-red-300 text-sm font-semibold">Remove</Text></TouchableOpacity></View>
                      </View>
                    })}
                    {!savedSignatories.length ? <View className="rounded-2xl border border-gray-800 bg-gray-900/50 p-4"><Text className="text-white font-semibold">No representatives added yet</Text><Text className="mt-1 text-gray-400 text-sm">Add a representative and select their role in the business.</Text></View> : null}
                  </View>
                  {showRoleGuidance ? <View className="mt-4 rounded-2xl border border-sky-400/25 bg-sky-500/10 p-4"><Text className="text-sky-100 font-semibold">More information needed</Text>{missingRoles.map((role: string) => <Text key={role} className="text-sky-100 text-sm mt-2">{role === 'owner' ? 'Add an Owner' : role === 'director' ? 'Add a Director' : 'Mark at least one representative as an authorised signatory'}</Text>)}</View> : null}
                  <TouchableOpacity onPress={() => router.push(`/business/signatories/new?revision=${encodeURIComponent(onboardingRevision || '')}${correctionMode ? '&return_to=kyb' : returnToSetup ? '&return_to=setup' : ''}` as any)} className={`mt-5 rounded-2xl px-4 py-4 items-center ${savedSignatories.length ? 'border border-gray-700' : 'bg-[#FFB05A]'}`}><Text className={`font-semibold ${savedSignatories.length ? 'text-white' : 'text-black'}`}>{savedSignatories.length ? 'Add another representative' : 'Add representative'}</Text></TouchableOpacity>
                </View>
              ) : null}

              {false ? (
                <View className="mt-5 rounded-2xl border border-white/8 bg-gray-900/80 p-4">
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1 pr-3">
                      <Text className="text-white text-base font-semibold">
                        Authorised signatory
                      </Text>
                      <Text className="text-gray-400 text-xs mt-1">
                        Add a representative and select their role in the business.
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={addSignatory}
                      className="rounded-2xl border border-gray-700 px-3 py-2"
                    >
                      <Text className="text-white text-xs font-semibold">Add representative</Text>
                    </TouchableOpacity>
                  </View>

                  <View className="mt-5 gap-4">
                    {signatories.map((signatory, index) => (
                      <View
                        key={String(signatory.id || index)}
                        className="rounded-2xl border border-gray-800 bg-gray-950/45 p-4"
                      >
                        <View className="flex-row items-center justify-between">
                          <Text className="text-white text-sm font-semibold">
                            Signatory {index + 1}
                          </Text>
                          {signatories.length > 1 ? (
                            <TouchableOpacity onPress={() => removeSignatory(index)}>
                              <Text className="text-red-300 text-xs font-semibold">Remove</Text>
                            </TouchableOpacity>
                          ) : null}
                        </View>

                        <View className="mt-4">
                          <Text className="text-[11px] uppercase tracking-[1.4px] text-slate-500">
                            Identity
                          </Text>
                        </View>
                        {[
                          ['full_name', 'Full name'],
                          ['first_name', 'First name'],
                          ['middle_name', 'Middle name'],
                          ['last_name', 'Last name'],
                          ['email', 'Email'],
                          ['phone', 'Phone'],
                          ['address_line_1', 'Residential address'],
                          ['city', 'City'],
                          ['postal_code', 'Postal code'],
                          ['bvn', 'BVN'],
                        ].map(([field, label]) => {
                          const inlineError = signatoryFieldError(field)
                          return (
                            <View key={field} className="mt-4">
                              <Text className="text-gray-400 text-xs">{label}</Text>
                              <TextInput
                                value={String(signatory[field] || '')}
                                onChangeText={(value) => handleSignatoryChange(index, field, value)}
                                autoCapitalize={
                                  field.includes('email') || field === 'bvn' ? 'none' : 'words'
                                }
                                placeholder={label}
                                placeholderTextColor="#6B7280"
                                className="mt-2 rounded-2xl border border-gray-700 bg-gray-900/70 px-4 py-4 text-white"
                              />
                              {inlineError ? (
                                <Text className="text-red-300 text-xs mt-2">{inlineError}</Text>
                              ) : null}
                            </View>
                          )
                        })}

                        <View className="mt-4">
                          {showSignatoryTitlePicker ? (
                            <FormSelect
                              label="Title"
                              selectedValue={String(signatory.title || '')}
                              onValueChange={(value: string) =>
                                handleSignatoryChange(index, 'title', value)
                              }
                              options={signatoryTitleOptions}
                              placeholder="Select title"
                            />
                          ) : (
                            <>
                              <Text className="text-gray-400 text-xs">Title</Text>
                              <TextInput
                                value={String(signatory.title || '')}
                                onChangeText={(value) =>
                                  handleSignatoryChange(index, 'title', value)
                                }
                                autoCapitalize="words"
                                placeholder="Title"
                                placeholderTextColor="#6B7280"
                                className="mt-2 rounded-2xl border border-gray-700 bg-gray-900/70 px-4 py-4 text-white"
                              />
                            </>
                          )}
                          {signatoryFieldError('title') ? (
                            <Text className="text-red-300 text-xs mt-2">
                              {signatoryFieldError('title')}
                            </Text>
                          ) : null}
                        </View>

                        <View className="mt-6 border-t border-white/6 pt-6">
                          <Text className="text-[11px] uppercase tracking-[1.4px] text-slate-500">
                            Birth and residency
                          </Text>
                        </View>
                        <View className="mt-4">
                          <Text className="text-gray-400 text-xs">Date of birth</Text>
                          <TouchableOpacity
                            onPress={() => openSignatoryDatePicker(index)}
                            className="mt-2 rounded-2xl border border-gray-700 bg-gray-900/70 px-4 py-4"
                          >
                            <Text
                              className={
                                String(signatory.date_of_birth || '').trim()
                                  ? 'text-white'
                                  : 'text-gray-400'
                              }
                            >
                              {String(signatory.date_of_birth || '').trim()
                                ? formatDisplayDate(String(signatory.date_of_birth))
                                : 'Select date of birth'}
                            </Text>
                          </TouchableOpacity>
                          <Text className="text-gray-500 text-[11px] mt-2">
                            Use the officer&apos;s official date of birth exactly as it appears on
                            their identity record.
                          </Text>
                        </View>

                        <View className="mt-4">
                          <FormSelect
                            label="Identification type"
                            selectedValue={String(signatory.identification_type || '')}
                            onValueChange={(value: string) =>
                              handleSignatoryChange(index, 'identification_type', value)
                            }
                            options={identificationTypeOptions}
                            placeholder="Select identification type"
                          />
                        </View>

                        <View className="mt-4">
                          <Text className="text-gray-400 text-xs">ID document number</Text>
                          <TextInput
                            value={String(signatory.id_document_number || '')}
                            onChangeText={(value) =>
                              handleSignatoryChange(index, 'id_document_number', value)
                            }
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
                            onChangeText={(value) =>
                              handleSignatoryChange(
                                index,
                                'ownership_percentage',
                                value.replace(/[^0-9.]/g, '')
                              )
                            }
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
                            onValueChange={(value: string) =>
                              handleSignatoryChange(index, 'nationality', value)
                            }
                            options={COUNTRY_OPTIONS}
                            placeholder="Select nationality"
                          />
                        </View>

                        <View className="mt-4">
                          <FormSelect
                            label="State"
                            selectedValue={String(signatory.state || '')}
                            onValueChange={(value: string) =>
                              handleSignatoryChange(index, 'state', value)
                            }
                            options={STATE_OPTIONS}
                            placeholder="Select state"
                          />
                          {signatoryFieldError('state') ? (
                            <Text className="text-red-300 text-xs mt-2">
                              {signatoryFieldError('state')}
                            </Text>
                          ) : null}
                        </View>

                        <View className="mt-4">
                          <FormSelect
                            label="Country"
                            selectedValue={String(signatory.country || 'NG')}
                            onValueChange={(value: string) =>
                              handleSignatoryChange(index, 'country', value)
                            }
                            options={COUNTRY_OPTIONS}
                            placeholder="Select country"
                          />
                          {signatoryFieldError('country') ? (
                            <Text className="text-red-300 text-xs mt-2">
                              {signatoryFieldError('country')}
                            </Text>
                          ) : null}
                        </View>

                        <View className="mt-6 border-t border-white/6 pt-6">
                          <Text className="text-[11px] uppercase tracking-[1.4px] text-slate-500">
                            Role
                          </Text>
                        </View>
                        <View
                          className={`mt-4 rounded-2xl border p-3 ${signatoryFieldError('authorized_signatory') ? 'border-red-300/45 bg-red-500/10' : 'border-transparent bg-transparent'}`}
                        >
                          <Text className="text-slate-400 text-xs">
                            At least one signatory must be marked authorized before verification can
                            be submitted.
                          </Text>
                          {signatoryFieldError('authorized_signatory') ? (
                            <Text className="text-red-300 text-xs mt-2">
                              {signatoryFieldError('authorized_signatory')}
                            </Text>
                          ) : null}
                        </View>
                        <View className="mt-3 flex-row gap-3">
                          <TouchableOpacity
                            onPress={() =>
                              handleSignatoryChange(
                                index,
                                'authorized_signatory',
                                !signatory.authorized_signatory
                              )
                            }
                            className={`flex-1 rounded-2xl border px-4 py-3 ${signatory.authorized_signatory ? 'border-[#FFB05A] bg-[#FFB05A]/12' : signatoryFieldError('authorized_signatory') ? 'border-red-300/55 bg-red-500/10' : 'border-gray-700 bg-transparent'}`}
                          >
                            <Text className="text-white text-xs font-semibold text-center">
                              Authorised signatory
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() =>
                              handleSignatoryChange(index, 'director', !signatory.director)
                            }
                            className={`flex-1 rounded-2xl border px-4 py-3 ${signatory.director ? 'border-[#FFB05A] bg-[#FFB05A]/12' : 'border-gray-700 bg-transparent'}`}
                          >
                            <Text className="text-white text-xs font-semibold text-center">
                              Director
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
            </>
          )}

          {!loading && (section !== 'signatory' || savedSignatories.length > 0) ? (
            <View className="mt-8">
              {correctionMode ? (
                <View className="mb-3 rounded-2xl border border-sky-500/25 bg-sky-500/10 px-4 py-3">
                  <Text className="text-sky-50 text-sm">
                    {section === 'signatory' && !normalizedRouteField
                      ? 'Review the business representative information below and update any details that need attention.'
                      : 'Fix the highlighted field, then save to return to verification review.'}
                  </Text>
                </View>
              ) : null}
              <TouchableOpacity
                onPress={section === 'signatory' ? handlePeopleContinue : handleSave}
                disabled={saving}
                className="rounded-2xl bg-[#FFB05A] px-4 py-4 items-center"
              >
                {saving ? (
                  correctionMode ? (
                    <Text className="text-black text-sm font-semibold">Saving correction...</Text>
                  ) : (
                    <ActivityIndicator size="small" color="#111827" />
                  )
                ) : (
                  <Text className="text-black text-sm font-semibold">
                    {correctionMode ? 'Save correction and return to review' : section === 'signatory' ? 'Continue to business verification' : 'Continue'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      {pickerTarget && Platform.OS === 'ios' ? (
        <Modal visible transparent animationType="slide" onRequestClose={closePicker}>
          <Pressable onPress={closePicker} className="flex-1 bg-black/50 justify-end">
            <Pressable
              onPress={() => {}}
              className="rounded-t-[28px] border border-white/8 bg-[#0f172a] px-4 pt-4"
              style={{ paddingBottom: Math.max(insets.bottom, 16) }}
            >
              <Text className="text-white text-base font-semibold text-center">{pickerTitle}</Text>
              <Text className="text-slate-400 text-xs text-center mt-2">
                Choose the date, then confirm.
              </Text>
              <View className="mt-4 rounded-2xl border border-slate-600 bg-[#111827] px-3 py-2">
                <DateTimePicker
                  value={pickerDraftDate}
                  mode="date"
                  display="spinner"
                  maximumDate={new Date()}
                  themeVariant="dark"
                  textColor="#F8FAFC"
                  onChange={(_, selected) => {
                    if (selected) setPickerDraftDate(selected)
                  }}
                />
              </View>
              <View className="mt-4 flex-row gap-3">
                <TouchableOpacity
                  onPress={closePicker}
                  className="flex-1 rounded-2xl border border-gray-700 px-4 py-4 items-center"
                >
                  <Text className="text-white text-sm font-semibold">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => applyPickerDate(pickerDraftDate)}
                  className="flex-1 rounded-2xl bg-[#FFB05A] px-4 py-4 items-center"
                >
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
    </ScreenContainer>
  )
}

export default BusinessOnboardingScreen
