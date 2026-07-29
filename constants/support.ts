const configuredWhatsAppNumber = String(process.env.EXPO_PUBLIC_SUPPORT_WHATSAPP_NUMBER ?? '').trim()

export const SUPPORT_EMAIL = 'support@bitbridgeglobal.com'
export const SUPPORT_WHATSAPP_NUMBER = configuredWhatsAppNumber
export const SUPPORT_AVAILABILITY_TEXT = String(process.env.EXPO_PUBLIC_SUPPORT_AVAILABILITY_TEXT || '').trim() || 'Support availability may vary. We’ll respond as soon as possible.'

export const isValidSupportWhatsAppNumber = (value = SUPPORT_WHATSAPP_NUMBER) => /^\d{8,15}$/.test(value)
