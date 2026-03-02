const flagEnabled = (value: string | undefined) => {
  const normalized = String(value ?? '').trim().toLowerCase()
  return normalized === '1' || normalized === 'true'
}

// Keep the app feature-rich by default when EXPO_PUBLIC_* vars are missing in local/dev-client runs.
// Explicit env values still override these defaults.
export const FEATURE_OTP = flagEnabled(process.env.EXPO_PUBLIC_FEATURE_OTP ?? '1')
export const FEATURE_BVN = flagEnabled(process.env.EXPO_PUBLIC_FEATURE_BVN ?? '1')
export const FEATURE_KYC_CENTER = flagEnabled(process.env.EXPO_PUBLIC_FEATURE_KYC_CENTER ?? '1')
export const FEATURE_CIRCLES = flagEnabled(process.env.EXPO_PUBLIC_FEATURE_CIRCLES ?? '1')
export const FEATURE_TIMELINE = flagEnabled(process.env.EXPO_PUBLIC_FEATURE_TIMELINE ?? '1')
export const FEATURE_NEW_DASHBOARD = flagEnabled(process.env.EXPO_PUBLIC_FEATURE_NEW_DASHBOARD ?? '1')
export const FEATURE_ONBOARDING = flagEnabled(process.env.EXPO_PUBLIC_FEATURE_ONBOARDING ?? '1')
export const FEATURE_TRANSACTION_PIN = flagEnabled(process.env.EXPO_PUBLIC_FEATURE_TRANSACTION_PIN ?? '1')
export const FEATURE_ORDERS = flagEnabled(process.env.EXPO_PUBLIC_FEATURE_ORDERS ?? '1')
export const FEATURE_DISPUTES = flagEnabled(process.env.EXPO_PUBLIC_FEATURE_DISPUTES ?? '0')
export const FEATURE_REWARDS = flagEnabled(process.env.EXPO_PUBLIC_FEATURE_REWARDS ?? '1')
export const FEATURE_STATS = flagEnabled(process.env.EXPO_PUBLIC_FEATURE_STATS ?? '0')
export const FEATURE_CARD_TOKENS = flagEnabled(process.env.EXPO_PUBLIC_FEATURE_CARD_TOKENS ?? '1')
export const FEATURE_PAYMENT_TOOLS = flagEnabled(process.env.EXPO_PUBLIC_FEATURE_PAYMENT_TOOLS ?? '1')
export const FEATURE_LEGACY_HOME = flagEnabled(process.env.EXPO_PUBLIC_FEATURE_LEGACY_HOME ?? '0')
