import { Linking } from 'react-native'

import { isValidSupportWhatsAppNumber, SUPPORT_EMAIL, SUPPORT_WHATSAPP_NUMBER } from '@/constants/support'

export type SupportCategoryKey = 'transfers_wallet' | 'cards' | 'bills_utilities' | 'verification' | 'circles' | 'account_access' | 'fraud_security' | 'general'
export type SupportCategory = { key: SupportCategoryKey; label: string; description: string }

export const SUPPORT_CATEGORIES: SupportCategory[] = [
  { key: 'transfers_wallet', label: 'Transfers and wallet', description: 'Sending money, deposits, or wallet activity.' },
  { key: 'cards', label: 'Cards', description: 'Virtual card access, funding, or card activity.' },
  { key: 'bills_utilities', label: 'Bills and utilities', description: 'Airtime, data, electricity, or cable payments.' },
  { key: 'verification', label: 'Verification', description: 'Identity checks or account verification.' },
  { key: 'circles', label: 'Circles', description: 'Circle membership, payments, or treasury access.' },
  { key: 'account_access', label: 'Account access', description: 'Signing in, passwords, or account recovery.' },
  { key: 'fraud_security', label: 'Fraud or security concern', description: 'A concern about your account or card security.' },
  { key: 'general', label: 'Something else', description: 'Any other BitBridge question.' },
]

const categoryFor = (key: SupportCategoryKey) => SUPPORT_CATEGORIES.find((category) => category.key === key) || SUPPORT_CATEGORIES[SUPPORT_CATEGORIES.length - 1]

export const buildWhatsAppMessage = (key: SupportCategoryKey) => {
  if (key === 'fraud_security') return ['Hello BitBridge Support.', 'I need help with a fraud or security concern.'].join('\n\n')
  return ['Hello BitBridge Support.', `I need help with: ${categoryFor(key).label}.`, 'Please let me know what information you need.'].join('\n\n')
}

export const buildSupportEmail = (key: SupportCategoryKey) => {
  const category = key === 'fraud_security' ? 'Fraud or security concern' : categoryFor(key).label
  const subject = `BitBridge Support — ${category}`
  const body = ['Hello BitBridge Support,', '', `I need help with: ${category}.`, '', 'Please let me know what information you require.'].join('\n')
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

export const buildWhatsAppUrl = (key: SupportCategoryKey, number = SUPPORT_WHATSAPP_NUMBER) => `https://wa.me/${number}?text=${encodeURIComponent(buildWhatsAppMessage(key))}`
export type SupportLinking = Pick<typeof Linking, 'canOpenURL' | 'openURL'>
export type SupportLaunchResult = 'launched' | 'disabled' | 'invalid_configuration' | 'unavailable' | 'failed'

export const launchWhatsAppSupport = async ({ category, enabled, number = SUPPORT_WHATSAPP_NUMBER, linking = Linking }: { category: SupportCategoryKey; enabled: boolean; number?: string; linking?: SupportLinking }): Promise<SupportLaunchResult> => {
  if (!enabled) return 'disabled'
  if (!isValidSupportWhatsAppNumber(number)) return 'invalid_configuration'
  try {
    const url = buildWhatsAppUrl(category, number)
    if (!(await linking.canOpenURL(url))) return 'unavailable'
    await linking.openURL(url)
    return 'launched'
  } catch { return 'failed' }
}

export const launchSupportEmail = async ({ category, linking = Linking }: { category: SupportCategoryKey; linking?: Pick<typeof Linking, 'openURL'> }) => {
  try { await linking.openURL(buildSupportEmail(category)); return true } catch { return false }
}
