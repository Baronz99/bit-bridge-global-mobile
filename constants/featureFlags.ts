const flagEnabled = (value: string | undefined) => value === '1'

export const FEATURE_OTP = flagEnabled(process.env.EXPO_PUBLIC_FEATURE_OTP ?? '0')
export const FEATURE_BVN = flagEnabled(process.env.EXPO_PUBLIC_FEATURE_BVN ?? '0')
export const FEATURE_KYC_CENTER = flagEnabled(process.env.EXPO_PUBLIC_FEATURE_KYC_CENTER ?? '0')
