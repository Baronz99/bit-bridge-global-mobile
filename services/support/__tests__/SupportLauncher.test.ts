import { isValidSupportWhatsAppNumber } from '@/constants/support'
import { buildSupportEmail, buildWhatsAppMessage, buildWhatsAppUrl, launchSupportEmail, launchWhatsAppSupport } from '@/services/support/SupportLauncher'

describe('support configuration', () => {
  it('accepts only the minimum-to-maximum digits-only range', () => {
    expect(isValidSupportWhatsAppNumber('2348012345678')).toBe(true)
    expect(isValidSupportWhatsAppNumber('12345678')).toBe(true)
    expect(isValidSupportWhatsAppNumber('123456789012345')).toBe(true)
    expect(isValidSupportWhatsAppNumber('1234567')).toBe(false)
    expect(isValidSupportWhatsAppNumber('1234567890123456')).toBe(false)
  })

  it('rejects malformed configured values instead of repairing them', () => {
    expect(isValidSupportWhatsAppNumber(' 2348012345678 ')).toBe(false)
    expect(isValidSupportWhatsAppNumber('+2348012345678')).toBe(false)
    expect(isValidSupportWhatsAppNumber('abc2348012345678')).toBe(false)
    expect(isValidSupportWhatsAppNumber('2348012345678abc')).toBe(false)
    expect(isValidSupportWhatsAppNumber('234-801-234-5678')).toBe(false)
    expect(isValidSupportWhatsAppNumber('(234)8012345678')).toBe(false)
    expect(isValidSupportWhatsAppNumber('234 8012345678')).toBe(false)
    expect(isValidSupportWhatsAppNumber('234.801.234.5678')).toBe(false)
    expect(isValidSupportWhatsAppNumber('')).toBe(false)
    expect(isValidSupportWhatsAppNumber(undefined)).toBe(false)
  })
})

describe('support templates', () => {
  it('uses category labels without adding sensitive-data warnings or user data', () => {
    const message = buildWhatsAppMessage('cards')
    expect(message).toContain('Cards')
    expect(message).toContain('Please let me know what information you need.')
    expect(message).not.toMatch(/PIN, OTP, password, CVV, BVN, NIN/i)
    expect(message).not.toMatch(/account number|transaction reference|wallet balance/i)
  })

  it('uses fraud-specific wording', () => {
    const message = buildWhatsAppMessage('fraud_security')
    expect(message).toContain('fraud or security concern')
    expect(message).not.toContain('Please let me know what information you need.')
  })

  it('encodes WhatsApp and email content safely', () => {
    expect(buildWhatsAppUrl('bills_utilities', '2348012345678')).toMatch(/^https:\/\/wa\.me\/2348012345678\?text=/)
    expect(buildWhatsAppUrl('bills_utilities', '2348012345678')).toContain('%0A')
    expect(buildSupportEmail('cards')).toContain('mailto:support@bitbridgeglobal.com?subject=')
  })
})

describe('support launchers', () => {
  it('does not attempt WhatsApp when disabled', async () => {
    const linking = { canOpenURL: jest.fn(), openURL: jest.fn() }
    await expect(launchWhatsAppSupport({ category: 'general', enabled: false, linking })).resolves.toBe('disabled')
    expect(linking.canOpenURL).not.toHaveBeenCalled()
  })

  it('returns invalid configuration before external navigation', async () => {
    const linking = { canOpenURL: jest.fn(), openURL: jest.fn() }
    await expect(launchWhatsAppSupport({ category: 'general', enabled: true, linking })).resolves.toBe('invalid_configuration')
    expect(linking.openURL).not.toHaveBeenCalled()
  })

  it('launches a public WhatsApp link when the device can open it', async () => {
    const linking = { canOpenURL: jest.fn().mockResolvedValue(true), openURL: jest.fn().mockResolvedValue(undefined) }
    await expect(launchWhatsAppSupport({ category: 'cards', enabled: true, number: '2348012345678', linking })).resolves.toBe('launched')
    expect(linking.openURL).toHaveBeenCalledWith(expect.stringContaining('https://wa.me/2348012345678?text='))
  })

  it('keeps the user in-app when WhatsApp cannot be opened', async () => {
    const linking = { canOpenURL: jest.fn().mockResolvedValue(false), openURL: jest.fn() }
    await expect(launchWhatsAppSupport({ category: 'cards', enabled: true, number: '2348012345678', linking })).resolves.toBe('unavailable')
    expect(linking.openURL).not.toHaveBeenCalled()
  })

  it('handles a WhatsApp open failure and permits a later retry', async () => {
    const linking = { canOpenURL: jest.fn().mockResolvedValue(true), openURL: jest.fn().mockRejectedValueOnce(new Error('unavailable')).mockResolvedValueOnce(undefined) }
    await expect(launchWhatsAppSupport({ category: 'cards', enabled: true, number: '2348012345678', linking })).resolves.toBe('failed')
    await expect(launchWhatsAppSupport({ category: 'cards', enabled: true, number: '2348012345678', linking })).resolves.toBe('launched')
    expect(linking.openURL).toHaveBeenCalledTimes(2)
  })

  it('launches email through its injected linking adapter', async () => {
    const linking = { openURL: jest.fn().mockResolvedValue(undefined) }
    await expect(launchSupportEmail({ category: 'account_access', linking })).resolves.toBe(true)
    expect(linking.openURL).toHaveBeenCalledWith(expect.stringContaining('mailto:support@bitbridgeglobal.com'))
  })

  it('handles email launch failures without throwing', async () => {
    const linking = { openURL: jest.fn().mockRejectedValue(new Error('unavailable')) }
    await expect(launchSupportEmail({ category: 'general', linking })).resolves.toBe(false)
  })
})
