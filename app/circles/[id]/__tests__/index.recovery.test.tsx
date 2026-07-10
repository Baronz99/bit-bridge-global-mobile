import fs from 'fs'
import path from 'path'
import React from 'react'
import type { ReactTestRenderer } from 'react-test-renderer'
import { act, create } from 'react-test-renderer'

const mockUseLocalSearchParams = jest.fn()
const mockCanGoBack = jest.fn()
const mockPush = jest.fn()
const mockReplace = jest.fn()
const mockBack = jest.fn()
const mockGetCircleWorkspace = jest.fn()
const mockGetCirclePaymentItems = jest.fn()
const mockGetCircleDuePlanSummary = jest.fn()
let mockFocusTriggered = false

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useLocalSearchParams: () => mockUseLocalSearchParams(),
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: mockBack,
    canGoBack: mockCanGoBack,
  }),
}))

jest.mock('@react-navigation/native', () => {
  const ReactLocal = jest.requireActual<typeof import('react')>('react')
  return {
    useFocusEffect: (callback: () => void) => {
      ReactLocal.useEffect(() => {
        if (!mockFocusTriggered) {
          mockFocusTriggered = true
          callback()
        }
      }, [])
    },
  }
})

jest.mock('@/api/circles', () => ({
  getCircleWorkspace: (...args: unknown[]) => mockGetCircleWorkspace(...args),
  getCirclePaymentItems: (...args: unknown[]) => mockGetCirclePaymentItems(...args),
  getCircleDuePlanSummary: (...args: unknown[]) => mockGetCircleDuePlanSummary(...args),
}))

jest.mock('@/components/circles/rebuild', () => {
  const ReactLocal = jest.requireActual<typeof import('react')>('react')
  return {
    CircleShell: ({ children }: { children?: React.ReactNode }) => ReactLocal.createElement('circle-shell', null, children),
    RecentRecords: () => null,
    circleBucketLabel: () => 'Associations',
    circleTitle: () => 'Circle title',
    normalizePaymentItems: () => [],
  }
})

jest.mock('@/components/navigation/HiddenHeaderRecovery', () => {
  const ReactLocal = jest.requireActual<typeof import('react')>('react')
  return function HiddenHeaderRecoveryMock(props: Record<string, unknown>) {
    return ReactLocal.createElement('hidden-header-recovery', props)
  }
})

jest.mock('@/utils/circleWorkspace', () => ({
  describeCurrentUserDues: () => ({ amountLabel: 'Current', summaryLabel: 'Current', helper: 'Current', state: 'paid' }),
  extractCircleDuesActivity: () => [],
  extractCircleRecentActivity: () => [],
  canAccessManageCircle: () => false,
  canViewSharedFundTab: () => false,
}))

jest.mock('@/utils/timelineRefs', () => ({
  decideHomeNavigation: () => ({ type: 'timeline' }),
}))

jest.mock('@/utils/circleRoleLabel', () => ({
  getCircleRoleLabel: () => 'Member',
}))

jest.mock('@/utils/circleWorkspaceNav', () => ({
  replaceCircleWorkspaceSection: jest.fn(),
}))

const mockReadCircleScreenCache = jest.fn()

jest.mock('@/constants/featureFlags', () => ({
  FEATURE_CIRCLE_OS: false,
}))

jest.mock('@/utils/circleScreenCache', () => ({
  DEFAULT_CIRCLE_SCREEN_CACHE_TTL_MS: 300000,
  isCircleScreenCacheFresh: () => false,
  readCircleScreenCache: (...args: unknown[]) => mockReadCircleScreenCache(...args),
  writeCircleScreenCache: jest.fn(),
}))

import CircleHomeScreen from '@/app/circles/[id]/index'

describe('CircleHomeScreen recovery states', () => {
  beforeEach(() => {
    mockFocusTriggered = false
    mockUseLocalSearchParams.mockReturnValue({ id: 'circle-1' })
    mockCanGoBack.mockReturnValue(false)
    mockPush.mockReset()
    mockReplace.mockReset()
    mockBack.mockReset()
    mockGetCirclePaymentItems.mockResolvedValue([])
    mockGetCircleDuePlanSummary.mockResolvedValue({ data: {} })
    mockReadCircleScreenCache.mockReturnValue(null)
  })

  it('renders recovery with /circles fallback and retry when the workspace request fails', async () => {
    mockGetCircleWorkspace.mockRejectedValue(new Error('boom'))

    let tree: ReactTestRenderer | null = null
    await act(async () => {
      tree = create(<CircleHomeScreen />)
    })

    const recovery = tree!.root.findAll((node) => String(node.type) === 'hidden-header-recovery')[0]
    expect(recovery.props.title).toBe('Circle unavailable')
    expect(recovery.props.fallbackRoute).toBe('/circles')
    expect(recovery.props.fallbackLabel).toBe('Back to Circles')
    expect(typeof recovery.props.onRetry).toBe('function')
  })

  it('mounts CircleShell without duplicate recovery controls when cached workspace data exists', async () => {
    mockReadCircleScreenCache.mockReturnValue({
      data: {
        workspace: { id: 'circle-1', name: 'Circle title', members: [] },
        circleLogoUrl: '',
        paymentItems: [],
        dueSummary: {},
      },
    })
    mockGetCircleWorkspace.mockResolvedValue({ id: 'circle-1', name: 'Circle title', members: [] })

    let tree: ReactTestRenderer | null = null
    await act(async () => {
      tree = create(<CircleHomeScreen />)
    })

    expect(tree!.root.findAll((node) => String(node.type) === 'hidden-header-recovery')).toHaveLength(0)
    expect(tree!.root.findAll((node) => String(node.type) === 'circle-shell')).toHaveLength(1)
  })

  it.each([
    'app/circles/[id]/index.tsx',
    'app/circles/[id]/pay.tsx',
    'app/circles/[id]/timeline.tsx',
    'app/circles/[id]/treasury.tsx',
    'app/circles/[id]/manage.tsx',
    'app/circles/[id]/timeline/[eventId].tsx',
    'app/circles/[id]/treasury/inflows.tsx',
    'app/circles/[id]/treasury/payouts.tsx',
    'app/circles/[id]/treasury/inflows/[inflowId].tsx',
  ])('uses HiddenHeaderRecovery with /circles fallback in %s', (relativePath) => {
    const absolutePath = path.join(process.cwd(), relativePath)
    const source = fs.readFileSync(absolutePath, 'utf8')

    expect(source).toContain("@/components/navigation/HiddenHeaderRecovery")
    expect(source).toContain("@/components/navigation/recoveryDefaults")
    expect(source).toContain('fallbackRoute={CIRCLES_FALLBACK_ROUTE}')
    expect(source).toContain('fallbackLabel={CIRCLES_FALLBACK_LABEL}')
  })
})
