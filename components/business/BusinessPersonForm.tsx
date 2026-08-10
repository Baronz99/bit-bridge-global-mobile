import React, { useEffect, useRef, useState } from 'react'
import { KeyboardAvoidingView, LayoutChangeEvent, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import DateTimePicker from '@react-native-community/datetimepicker'
import FormSelect from '@/components/FormSelect'
import { BUSINESS_NIGERIA_STATE_OPTIONS, isNigeriaCountry, sanitizeBusinessStateValue } from '@/utils/businessStateValidation'

export type BusinessPerson = Record<string, any>

export const emptyBusinessPerson = (): BusinessPerson => ({
  full_name: '', email: '', phone: '', title: '', date_of_birth: '', nationality: 'NG',
  address_line_1: '', address_line_2: '', city: '', state: '', postal_code: '', country: 'NG',
  bvn: '', identification_type: '', id_document_number: '', ownership_percentage: '',
  authorized_signatory: false, director: false, status: 'active',
})

const countries = [{ label: 'Nigeria', value: 'NG' }, { label: 'Ghana', value: 'GH' }, { label: 'Kenya', value: 'KE' }, { label: 'United Kingdom', value: 'GB' }, { label: 'United States', value: 'US' }]
const titles = ['CEO', 'DIRECTOR', 'MANAGING_DIRECTOR', 'FOUNDER', 'PROPRIETOR', 'TRUSTEE', 'CHAIRPERSON'].map((value) => ({ value, label: value.replaceAll('_', ' ') }))
const friendly: Record<string, string> = { full_name: 'Full name', date_of_birth: 'Date of birth', nationality: 'Nationality', address_line_1: 'Residential address', city: 'City', state: 'State', country: 'Country', bvn: 'BVN', title: 'Title', phone: 'Phone', ownership_percentage: 'Ownership percentage' }
const correctionFields = ['phone', 'state', 'title', 'ownership_percentage'] as const
type CorrectionField = typeof correctionFields[number]
const renderedIssueFields = ['full_name', 'title', 'date_of_birth', 'nationality', 'address_line_1', 'city', 'state', 'country', 'phone', 'bvn', 'ownership_percentage'] as const

const phoneGuidance = (country?: string) =>
  isNigeriaCountry(country) ? 'Enter a valid Nigerian phone number, e.g. 08012345678.' : 'Enter a valid phone number.'

const safeCorrectionMessage = (field?: CorrectionField, errorCode?: string, country?: string) => {
  if (errorCode === 'anchor_officer_phone_invalid') return phoneGuidance(country)
  if (errorCode === 'anchor_signatory_title_invalid') return 'Choose a valid title.'
  if (errorCode === 'anchor_state_mapping_missing') return 'Select a valid state.'
  if (errorCode === 'anchor_owner_percentage_missing') return 'Enter a valid ownership percentage.'
  return field ? 'Check this information and try again.' : ''
}

export default function BusinessPersonForm({ initial, issues = [], saving, onSave, correction }: { initial?: BusinessPerson; issues?: string[]; saving?: boolean; onSave: (person: BusinessPerson) => void; correction?: { active?: boolean; field?: string; errorCode?: string } }) {
  const insets = useSafeAreaInsets()
  const scrollRef = useRef<ScrollView>(null)
  const fieldOffsets = useRef<Record<string, number>>({})
  const inputRefs = useRef<Record<string, TextInput | null>>({})
  const [person, setPerson] = useState<BusinessPerson>({ ...emptyBusinessPerson(), ...(initial || {}) })
  // Only customer-editable optional fields determine disclosure. Hidden legacy
  // values remain in `person` and are included unchanged on a full item PATCH.
  const [showOptional, setShowOptional] = useState(Boolean(initial?.email || initial?.postal_code))
  const [showDate, setShowDate] = useState(false)
  const [error, setError] = useState('')
  // Owner is a deliberate role choice. A positive percentage is still the only
  // value sent to the API that makes this person an Owner.
  const correctionField = correctionFields.includes(correction?.field as CorrectionField) ? correction?.field as CorrectionField : undefined
  const readinessIssueFields = issues.filter((field): field is typeof renderedIssueFields[number] => renderedIssueFields.includes(field as typeof renderedIssueFields[number]))
  const unrenderedIssues = issues.filter((field) => !renderedIssueFields.includes(field as typeof renderedIssueFields[number]))
  const correctionMessage = correction?.active ? safeCorrectionMessage(correctionField, correction?.errorCode, person.country) : ''
  const [ownerSelected, setOwnerSelected] = useState(Number(initial?.ownership_percentage || 0) > 0 || correctionField === 'ownership_percentage')
  const owner = ownerSelected
  const usesNigeriaStatePicker = isNigeriaCountry(person.country)
  const set = (key: string, value: any) => setPerson((current) => ({ ...current, [key]: value }))
  const registerField = (key: string) => ({ onLayout: (event: LayoutChangeEvent) => { fieldOffsets.current[key] = event.nativeEvent.layout.y } })
  const fieldIssueMessage = (key: string) => {
    if (correction?.active && correctionField === key) return correctionMessage
    if (readinessIssueFields.includes(key as typeof renderedIssueFields[number])) {
      return key === 'phone' ? phoneGuidance(person.country) : 'Check this information and try again.'
    }
    return ''
  }
  useEffect(() => {
    const focusField = correction?.active ? correctionField : readinessIssueFields[0]
    if (!focusField) return
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, (fieldOffsets.current[focusField] || 0) - 20), animated: true })
      inputRefs.current[focusField]?.focus?.()
    }, 150)
    return () => clearTimeout(timer)
  }, [correction?.active, correctionField, readinessIssueFields.join('|')])
  const toggleOwner = () => {
    setOwnerSelected((selected) => !selected)
    if (owner) set('ownership_percentage', '')
  }
  const save = () => {
    const required = ['full_name', 'title', 'date_of_birth', 'nationality', 'address_line_1', 'city', 'state', 'country', 'phone', 'bvn']
    const missing = required.filter((key) => !String(person[key] || '').trim())
    if (owner && !(Number(person.ownership_percentage) > 0 && Number(person.ownership_percentage) <= 100)) missing.push('ownership_percentage')
    if (missing.length) return setError(`${missing.map((key) => key === 'ownership_percentage' ? 'Ownership percentage' : friendly[key]).join(', ')} ${missing.length === 1 ? 'is' : 'are'} required.`)
    setError('')
    onSave({ ...person, ownership_percentage: owner ? Number(person.ownership_percentage) : null })
  }
  const field = (key: string, label: string, extra: any = {}) => {
    const message = fieldIssueMessage(key)
    return <View className="mt-4" key={key} {...registerField(key)}><Text className="text-gray-400 text-xs">{label}</Text><TextInput ref={(node) => { inputRefs.current[key] = node }} value={String(person[key] || '')} onChangeText={(value) => set(key, value)} placeholder={label} placeholderTextColor="#6B7280" className={`mt-2 rounded-2xl border bg-gray-900/70 px-4 py-4 text-white ${message ? 'border-red-400' : 'border-gray-700'}`} {...extra} />{message ? <Text className="mt-2 text-red-300 text-xs">{message}</Text> : null}</View>
  }
  return <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + 32 }} className="flex-1 px-5">
    {correction?.active && correctionField ? <View className="mt-1 rounded-2xl border border-sky-500/25 bg-sky-500/10 px-4 py-3"><Text className="text-sky-50 text-sm font-semibold">Action required</Text><Text className="mt-1 text-sky-100 text-xs">Update the highlighted information, then save to return to business verification.</Text></View> : null}
    <Text className="text-white text-xl font-semibold">Personal details</Text>
    {field('full_name', 'Full name', { autoCapitalize: 'words' })}
    <Text className="mt-7 text-slate-400 text-[11px] uppercase tracking-[1.4px]">Roles</Text>
    <View className="mt-3 gap-3">
      {[['owner', 'Owner'], ['director', 'Director'], ['authorized_signatory', 'Authorised signatory']].map(([key, label]) => { const selected = key === 'owner' ? owner : Boolean(person[key]); return <TouchableOpacity key={key} onPress={() => key === 'owner' ? toggleOwner() : set(key, !selected)} className={`rounded-2xl border px-4 py-4 ${selected ? 'border-[#FFB05A] bg-[#FFB05A]/12' : 'border-gray-700 bg-gray-900/50'}`}><Text className="text-white font-semibold">{selected ? '✓ ' : ''}{label}</Text></TouchableOpacity> })}
    </View>
    {owner ? field('ownership_percentage', 'Ownership percentage', { keyboardType: 'decimal-pad', placeholder: '0 - 100' }) : null}
    <Text className="mt-7 text-slate-400 text-[11px] uppercase tracking-[1.4px]">Required details</Text>
    <View className="mt-4" {...registerField('title')}><FormSelect label="Title" selectedValue={String(person.title || '')} onValueChange={(value: string) => set('title', value)} options={titles} placeholder="Select title" errorMessage={fieldIssueMessage('title') || undefined} /></View>
    <View className="mt-4" {...registerField('date_of_birth')}><Text className="text-gray-400 text-xs">Date of birth</Text><TouchableOpacity onPress={() => setShowDate(true)} className={`mt-2 rounded-2xl border bg-gray-900/70 px-4 py-4 ${fieldIssueMessage('date_of_birth') ? 'border-red-400' : 'border-gray-700'}`}><Text className={person.date_of_birth ? 'text-white' : 'text-gray-400'}>{person.date_of_birth || 'Select date of birth'}</Text></TouchableOpacity>{fieldIssueMessage('date_of_birth') ? <Text className="mt-2 text-red-300 text-xs">{fieldIssueMessage('date_of_birth')}</Text> : null}</View>
    {showDate ? <DateTimePicker value={person.date_of_birth ? new Date(person.date_of_birth) : new Date(1990, 0, 1)} mode="date" maximumDate={new Date()} onChange={(_, date) => { setShowDate(false); if (date) set('date_of_birth', date.toISOString().slice(0, 10)) }} /> : null}
    <View className="mt-4" {...registerField('nationality')}><FormSelect label="Nationality" selectedValue={String(person.nationality || 'NG')} onValueChange={(value: string) => set('nationality', value)} options={countries} placeholder="Select nationality" errorMessage={fieldIssueMessage('nationality') || undefined} /></View>
    {field('address_line_1', 'Residential address')}{field('city', 'City')}
    <View className="mt-4" {...registerField('country')}><FormSelect label="Country" selectedValue={String(person.country || 'NG')} onValueChange={(value: string) => set('country', value)} options={countries} placeholder="Select country" errorMessage={fieldIssueMessage('country') || undefined} /></View>
    {usesNigeriaStatePicker ? <View className="mt-4" {...registerField('state')}><FormSelect label="State" selectedValue={sanitizeBusinessStateValue(person.state, person.country)} onValueChange={(value: string) => set('state', value)} options={BUSINESS_NIGERIA_STATE_OPTIONS} placeholder="Select state" errorMessage={fieldIssueMessage('state') || undefined} /></View> : field('state', 'State / region')}
    {field('phone', 'Phone number', { keyboardType: 'phone-pad' })}{field('bvn', 'BVN', { keyboardType: 'number-pad', maxLength: 11, placeholder: '11-digit BVN' })}
    <TouchableOpacity onPress={() => setShowOptional(!showOptional)} className="mt-7 flex-row justify-between rounded-2xl border border-gray-800 bg-gray-900/50 px-4 py-4"><View><Text className="text-white font-semibold">Additional details</Text><Text className="text-gray-400 text-xs mt-1">Optional for now. We may request more information during verification.</Text></View><Text className="text-white">{showOptional ? '−' : '+'}</Text></TouchableOpacity>
    {showOptional ? <View>{field('email', 'Email', { keyboardType: 'email-address', autoCapitalize: 'none' })}{field('postal_code', 'Postal code')}</View> : null}
    {unrenderedIssues.length ? <Text className="mt-4 text-amber-200 text-sm">Some information needs attention. Review the details above.</Text> : null}
    {error ? <Text className="mt-4 text-red-300 text-sm">{error}</Text> : null}
    <TouchableOpacity onPress={save} disabled={saving} className="mt-7 rounded-2xl bg-[#FFB05A] px-4 py-4 items-center"><Text className="text-black font-semibold">{saving ? 'Saving...' : 'Save representative'}</Text></TouchableOpacity>
  </ScrollView></KeyboardAvoidingView>
}
