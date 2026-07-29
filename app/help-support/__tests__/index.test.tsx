import React from 'react'
import renderer, { act } from 'react-test-renderer'
import HelpSupportScreen from '../index'

let mockAuthenticated = true
let mockWhatsappEnabled = false
let mockValidNumber = false
const mockLaunchWhatsAppSupport = jest.fn()
const mockLaunchSupportEmail = jest.fn()

jest.mock('@/services/useAuth', () => ({ useAuth: () => ({ authHydrated: true, authState: { authenticated: mockAuthenticated } }) }))
jest.mock('@/constants/featureFlags', () => ({ get FEATURE_WHATSAPP_SUPPORT() { return mockWhatsappEnabled } }))
jest.mock('@/constants/support', () => ({ SUPPORT_AVAILABILITY_TEXT: 'Availability varies.', isValidSupportWhatsAppNumber: () => mockValidNumber }))
jest.mock('@/services/support/SupportLauncher', () => ({
  SUPPORT_CATEGORIES: [
    { key: 'cards', label: 'Cards', description: 'Card support.' },
    { key: 'fraud_security', label: 'Fraud or security concern', description: 'Security support.' },
  ],
  launchWhatsAppSupport: (...args: unknown[]) => mockLaunchWhatsAppSupport(...args),
  launchSupportEmail: (...args: unknown[]) => mockLaunchSupportEmail(...args),
}))
jest.mock('@/services/support/supportAnalytics', () => ({ trackSupportEvent: jest.fn() }))
jest.mock('@/components/ScreenContainer', () => {
  function MockScreenContainer({ children }: { children: React.ReactNode }) { return <>{children}</> }
  return MockScreenContainer
})
jest.mock('@/components/modal/Modal', () => {
  function MockModal({ open, children }: { open: boolean; children: React.ReactNode }) { return open ? <>{children}</> : null }
  return MockModal
})
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }))
jest.mock('expo-router', () => ({ Redirect: ({ href }: { href: string }) => <redirect href={href} /> }))

const button = (tree: renderer.ReactTestRenderer, label: string) => tree.root.findByProps({ accessibilityLabel: label })
const renderScreen = () => {
  let tree: renderer.ReactTestRenderer | null = null
  act(() => {
    tree = renderer.create(<HelpSupportScreen />)
  })
  return tree as renderer.ReactTestRenderer
}

describe('HelpSupportScreen', () => {
  beforeEach(() => {
    mockAuthenticated = true
    mockWhatsappEnabled = false
    mockValidNumber = false
    mockLaunchWhatsAppSupport.mockReset()
    mockLaunchSupportEmail.mockReset()
  })

  it('redirects unauthenticated users to login', () => {
    mockAuthenticated = false
    const tree = renderScreen()
    expect(tree.root.findByType('redirect').props.href).toBe('/login')
  })

  it('opens confirmation before launching WhatsApp and permits cancellation', () => {
    const tree = renderScreen()
    act(() => button(tree, 'Get help with Cards').props.onPress())
    expect(tree.root.findByProps({ accessibilityRole: 'header', children: 'Continue to WhatsApp?' })).toBeTruthy()
    expect(mockLaunchWhatsAppSupport).not.toHaveBeenCalled()
    act(() => button(tree, 'Cancel support request').props.onPress())
    expect(() => button(tree, 'Cancel support request')).toThrow()
  })

  it('hides WhatsApp when disabled or misconfigured, while retaining email', () => {
    const tree = renderScreen()
    act(() => button(tree, 'Get help with Cards').props.onPress())
    expect(() => button(tree, 'Open WhatsApp to chat with BitBridge Support')).toThrow()
    expect(button(tree, 'Send BitBridge Support an email')).toBeTruthy()
  })

  it('shows WhatsApp with valid enabled configuration and renders fraud guidance', () => {
    mockWhatsappEnabled = true
    mockValidNumber = true
    const tree = renderScreen()
    act(() => button(tree, 'Get help with Fraud or security concern').props.onPress())
    expect(button(tree, 'Open WhatsApp to chat with BitBridge Support')).toBeTruthy()
    expect(tree.root.findAllByType('Text').some((node) => String(node.props.children).includes('WhatsApp is not an emergency service.'))).toBe(true)
  })

  it('only launches once for immediate repeated taps and unlocks after failure', async () => {
    mockWhatsappEnabled = true
    mockValidNumber = true
    mockLaunchWhatsAppSupport.mockResolvedValueOnce('failed').mockResolvedValueOnce('launched')
    const tree = renderScreen()
    act(() => button(tree, 'Get help with Cards').props.onPress())
    const open = button(tree, 'Open WhatsApp to chat with BitBridge Support')
    await act(async () => {
      open.props.onPress()
      open.props.onPress()
      await Promise.resolve()
    })
    expect(mockLaunchWhatsAppSupport).toHaveBeenCalledTimes(1)
    await act(async () => {
      button(tree, 'Open WhatsApp to chat with BitBridge Support').props.onPress()
      await Promise.resolve()
    })
    expect(mockLaunchWhatsAppSupport).toHaveBeenCalledTimes(2)
  })
})
