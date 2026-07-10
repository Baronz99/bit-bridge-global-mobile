import React from 'react'
import type { ReactNode } from 'react'
import type { ReactTestRenderer } from 'react-test-renderer'
import { act, create } from 'react-test-renderer'

const mockUseLocalSearchParams = jest.fn()
const mockCanGoBack = jest.fn()
const mockBack = jest.fn()
const mockReplace = jest.fn()
const mockPush = jest.fn()
const mockGetCircleAuditSummary = jest.fn()
const mockListCircleStatements = jest.fn()
const mockGetCircle = jest.fn()
const mockGetCirclePaymentItems = jest.fn()
const mockQuoteCircleDuePlan = jest.fn()
const mockListCircleCollections = jest.fn()

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockUseLocalSearchParams(),
  useRouter: () => ({
    back: mockBack,
    replace: mockReplace,
    push: mockPush,
    canGoBack: mockCanGoBack,
  }),
}))

jest.mock('@/api/circles', () => ({
  getCircleAuditSummary: (...args: unknown[]) => mockGetCircleAuditSummary(...args),
  listCircleStatements: (...args: unknown[]) => mockListCircleStatements(...args),
  exportCircleCsv: jest.fn(),
  createCircleStatement: jest.fn(),
  getCircle: (...args: unknown[]) => mockGetCircle(...args),
  getCirclePaymentItems: (...args: unknown[]) => mockGetCirclePaymentItems(...args),
  quoteCircleDuePlan: (...args: unknown[]) => mockQuoteCircleDuePlan(...args),
  fundCircle: jest.fn(),
  withdrawCircle: jest.fn(),
  listCircleCollections: (...args: unknown[]) => mockListCircleCollections(...args),
  createCircleActivity: jest.fn(),
}))

jest.mock('@/api/transactionPin', () => ({
  getTransactionPinStatus: jest.fn(),
}))

jest.mock('@/api/client', () => ({
  getStoredAccessToken: jest.fn(),
}))

jest.mock('@/services/useAuth', () => ({
  useAuth: () => ({
    userProfileData: {},
  }),
}))

jest.mock('@/services/useTransactionBiometrics', () => ({
  resolveTransactionBiometricUserId: () => 'user-1',
  useTransactionBiometrics: () => ({
    biometricLoading: false,
    biometricAvailable: false,
    biometricEnabled: false,
    maybeEnrollAfterPinSuccess: jest.fn(),
    getApprovalToken: jest.fn(),
  }),
}))

jest.mock('@/components/FormInput', () => {
  return function FormInput() {
    return null
  }
})

jest.mock('@/components/FormSelect', () => {
  return function FormSelect() {
    return null
  }
})

jest.mock('@/components/keyboardAvoidWrapper/KeyboardAvoidWrapper', () => {
  return function KeyboardAvoidWrapper({ children }: { children?: ReactNode }) {
    return children
  }
})

jest.mock('@/components/Loader', () => {
  return function Loader() {
    return null
  }
})

jest.mock('@/components/notification', () => {
  return function NotificationAlert() {
    return null
  }
})

jest.mock('@/components/TransactionPinModal', () => {
  return function TransactionPinModal() {
    return null
  }
})

jest.mock('@/components/finance/CompletionPanel', () => {
  return function CompletionPanel() {
    return null
  }
})

jest.mock('@/components/finance/FinancialSummaryCard', () => {
  return function FinancialSummaryCard() {
    return null
  }
})

jest.mock('@/components/circles/rebuild', () => ({
  paymentItemIdentityLabel: () => '',
}))

jest.mock('@/utils/circleTypeConfig', () => ({
  getCircleTypeConfig: () => ({
    createDescription: 'desc',
    starterTemplates: [],
    emptyActivityLabel: 'No collections yet.',
  }),
}))

jest.mock('@react-native-community/datetimepicker', () => 'date-time-picker')

import AuditSummaryScreen from '@/app/circles/[id]/audit'
import CircleWithdrawScreen from '@/app/circles/[id]/withdraw'
import CircleFundScreen from '@/app/circles/[id]/fund'
import ActivitiesScreen from '@/app/circles/[id]/activities'
import { normalizeRouteParam } from '@/utils/navigationRecovery'

describe('Circle navigation exits', () => {
  beforeEach(() => {
    mockUseLocalSearchParams.mockReset()
    mockCanGoBack.mockReset()
    mockBack.mockReset()
    mockReplace.mockReset()
    mockPush.mockReset()
    mockGetCircleAuditSummary.mockReset()
    mockListCircleStatements.mockReset()
    mockGetCircle.mockReset()
    mockGetCirclePaymentItems.mockReset()
    mockQuoteCircleDuePlan.mockReset()
    mockListCircleCollections.mockReset()

    mockCanGoBack.mockReturnValue(false)
    mockGetCircleAuditSummary.mockResolvedValue({})
    mockListCircleStatements.mockResolvedValue([])
    mockGetCircle.mockResolvedValue({})
    mockGetCirclePaymentItems.mockResolvedValue([])
    mockQuoteCircleDuePlan.mockResolvedValue({ data: { total_amount: 0, total_amount_cents: 0, obligation_ids: [] } })
    mockListCircleCollections.mockResolvedValue([])
  })

  it('renders a deterministic audit exit and does not navigate on render', async () => {
    mockUseLocalSearchParams.mockReturnValue({ id: 'circle-1' })

    let tree: ReactTestRenderer | null = null
    await act(async () => {
      tree = create(<AuditSummaryScreen />)
    })

    expect(mockBack).not.toHaveBeenCalled()
    expect(mockReplace).not.toHaveBeenCalled()
    expect(tree!.root.findByProps({ accessibilityLabel: 'Back to Circles' })).toBeTruthy()
  })

  it('uses /circles as the audit fallback when there is no history', async () => {
    mockUseLocalSearchParams.mockReturnValue({ id: 'circle-1' })

    let tree: ReactTestRenderer | null = null
    await act(async () => {
      tree = create(<AuditSummaryScreen />)
    })

    const button = tree!.root.findByProps({ accessibilityLabel: 'Back to Circles' })
    await act(async () => {
      button.props.onPress()
    })

    expect(mockBack).not.toHaveBeenCalled()
    expect(mockReplace).toHaveBeenCalledWith('/circles')
  })

  it('renders a withdraw exit in the normal form state', async () => {
    mockUseLocalSearchParams.mockReturnValue({ id: 'circle-1' })

    let tree: ReactTestRenderer | null = null
    await act(async () => {
      tree = create(<CircleWithdrawScreen />)
    })

    expect(tree!.root.findByProps({ accessibilityLabel: 'Back to Treasury' })).toBeTruthy()
    expect(mockBack).not.toHaveBeenCalled()
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('uses the Circle Treasury fallback for withdraw when the id is valid', async () => {
    mockUseLocalSearchParams.mockReturnValue({ id: 'circle-1' })

    let tree: ReactTestRenderer | null = null
    await act(async () => {
      tree = create(<CircleWithdrawScreen />)
    })

    const button = tree!.root.findByProps({ accessibilityLabel: 'Back to Treasury' })
    await act(async () => {
      button.props.onPress()
    })

    expect(mockReplace).toHaveBeenCalledWith('/circles/circle-1/treasury')
  })

  it('uses /circles as the withdraw fallback when the id is missing', async () => {
    mockUseLocalSearchParams.mockReturnValue({ id: undefined })

    let tree: ReactTestRenderer | null = null
    await act(async () => {
      tree = create(<CircleWithdrawScreen />)
    })

    const button = tree!.root.findByProps({ accessibilityLabel: 'Back to Circles' })
    await act(async () => {
      button.props.onPress()
    })

    expect(mockReplace).toHaveBeenCalledWith('/circles')
  })

  it('normalizes string array route params safely for withdraw', async () => {
    mockUseLocalSearchParams.mockReturnValue({ id: ['circle-2'] })

    let tree: ReactTestRenderer | null = null
    await act(async () => {
      tree = create(<CircleWithdrawScreen />)
    })

    const button = tree!.root.findByProps({ accessibilityLabel: 'Back to Treasury' })
    await act(async () => {
      button.props.onPress()
    })

    expect(mockReplace).toHaveBeenCalledWith('/circles/circle-2/treasury')
  })

  it('uses a safe payment fallback for fund and never constructs an undefined route', async () => {
    mockUseLocalSearchParams.mockReturnValue({ id: undefined })

    let tree: ReactTestRenderer | null = null
    await act(async () => {
      tree = create(<CircleFundScreen />)
    })

    const button = tree!.root.findByProps({ accessibilityLabel: 'Back to Payments' })
    await act(async () => {
      button.props.onPress()
    })

    expect(mockReplace).toHaveBeenCalledWith('/circles')
    expect(mockReplace).not.toHaveBeenCalledWith('/circles/undefined/pay')
  })

  it('uses a safe payment fallback for activities and never constructs an undefined route', async () => {
    mockUseLocalSearchParams.mockReturnValue({ id: undefined })

    let tree: ReactTestRenderer | null = null
    await act(async () => {
      tree = create(<ActivitiesScreen />)
    })

    const button = tree!.root.findByProps({ accessibilityLabel: 'Back to Payments' })
    await act(async () => {
      button.props.onPress()
    })

    expect(mockReplace).toHaveBeenCalledWith('/circles')
    expect(mockReplace).not.toHaveBeenCalledWith('/circles/undefined/pay')
  })

  it('normalizes string array route params safely for fund and activities', async () => {
    mockUseLocalSearchParams.mockReturnValue({ id: ['circle-9'] })

    let fundTree: ReactTestRenderer | null = null
    await act(async () => {
      fundTree = create(<CircleFundScreen />)
    })
    const fundButton = fundTree!.root.findByProps({ accessibilityLabel: 'Back to Payments' })
    await act(async () => {
      fundButton.props.onPress()
    })
    expect(mockReplace).toHaveBeenCalledWith('/circles/circle-9/pay')

    mockReplace.mockReset()
    let activitiesTree: ReactTestRenderer | null = null
    await act(async () => {
      activitiesTree = create(<ActivitiesScreen />)
    })
    const activitiesButton = activitiesTree!.root.findByProps({ accessibilityLabel: 'Back to Payments' })
    await act(async () => {
      activitiesButton.props.onPress()
    })
    expect(mockReplace).toHaveBeenCalledWith('/circles/circle-9/pay')
  })

  it('normalizes undefined, strings, arrays, empty arrays, and whitespace-only values safely', () => {
    expect(normalizeRouteParam(undefined)).toBe('')
    expect(normalizeRouteParam('circle-4')).toBe('circle-4')
    expect(normalizeRouteParam(['circle-5', 'circle-6'])).toBe('circle-5')
    expect(normalizeRouteParam(['circle-5', 'circle-6'])).not.toBe('circle-5,circle-6')
    expect(normalizeRouteParam([])).toBe('')
    expect(normalizeRouteParam('   ')).toBe('')
    expect(normalizeRouteParam(['   ', 'circle-7'])).toBe('')
  })

  it('uses /circles when route params normalize to empty values', async () => {
    mockUseLocalSearchParams.mockReturnValue({ id: [] })

    let withdrawTree: ReactTestRenderer | null = null
    await act(async () => {
      withdrawTree = create(<CircleWithdrawScreen />)
    })

    const withdrawButton = withdrawTree!.root.findByProps({ accessibilityLabel: 'Back to Circles' })
    await act(async () => {
      withdrawButton.props.onPress()
    })
    expect(mockReplace).toHaveBeenCalledWith('/circles')

    mockReplace.mockReset()
    mockUseLocalSearchParams.mockReturnValue({ id: '   ' })

    let fundTree: ReactTestRenderer | null = null
    await act(async () => {
      fundTree = create(<CircleFundScreen />)
    })

    const fundButton = fundTree!.root.findByProps({ accessibilityLabel: 'Back to Payments' })
    await act(async () => {
      fundButton.props.onPress()
    })
    expect(mockReplace).toHaveBeenCalledWith('/circles')
    expect(mockReplace).not.toHaveBeenCalledWith('/circles//pay')
  })

  it('uses history instead of fallback when back navigation exists', async () => {
    mockUseLocalSearchParams.mockReturnValue({ id: 'circle-1' })
    mockCanGoBack.mockReturnValue(true)

    let tree: ReactTestRenderer | null = null
    await act(async () => {
      tree = create(<AuditSummaryScreen />)
    })

    const button = tree!.root.findByProps({ accessibilityLabel: 'Back to Circles' })
    await act(async () => {
      button.props.onPress()
    })

    expect(mockBack).toHaveBeenCalledTimes(1)
    expect(mockReplace).not.toHaveBeenCalled()
  })
})
