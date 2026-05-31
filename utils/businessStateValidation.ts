export type BusinessStateOption = {
  label: string
  value: string
}

export const BUSINESS_NIGERIA_STATE_OPTIONS: BusinessStateOption[] = [
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

const normalizeKey = (value: unknown) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, ' ')

const stateAliasEntries: Array<[string, string]> = BUSINESS_NIGERIA_STATE_OPTIONS.flatMap((option): Array<[string, string]> => [
  [normalizeKey(option.value), option.value],
  [normalizeKey(option.label), option.value],
  [`${normalizeKey(option.value)} state`, option.value],
])

const STATE_ALIASES = new Map<string, string>([
  ...stateAliasEntries,
  ['abuja', 'FCT'],
  ['federal capital territory', 'FCT'],
  ['federal capital territory fct', 'FCT'],
  ['fct abuja', 'FCT'],
])

export const normalizeNigeriaState = (value: unknown) => {
  const raw = String(value || '').trim()
  if (!raw) return ''

  const key = normalizeKey(raw)
  if (key === 'ng' || key === 'nga' || key === 'nigeria') return ''

  return STATE_ALIASES.get(key) || ''
}

export const isNigeriaCountry = (country: unknown) => {
  const key = normalizeKey(country)
  return !key || key === 'ng' || key === 'nga' || key === 'nigeria'
}

export const sanitizeBusinessStateValue = (state: unknown, country: unknown = 'NG') => {
  if (!isNigeriaCountry(country)) return String(state || '').trim()
  return normalizeNigeriaState(state)
}
