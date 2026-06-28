export type RouterWithFallback = {
  back: () => void
  replace: (href: any) => void
  canGoBack?: () => boolean
}

export const backOrFallback = (router: RouterWithFallback, fallbackRoute: string) => {
  const canGoBack = typeof router.canGoBack === 'function' ? router.canGoBack() : false
  if (canGoBack) {
    router.back()
    return
  }
  router.replace(fallbackRoute as any)
}

const SAFE_ROUTE_PATTERNS = [
  /^\/\(tabs\)(?:\/.*)?$/i,
  /^\/welcome$/i,
  /^\/login$/i,
  /^\/sign-up$/i,
  /^\/forgot-password$/i,
  /^\/reset-password$/i,
  /^\/confirmEmail$/i,
  /^\/recover-unconfirmed$/i,
  /^\/kyc(?:\/.*)?$/i,
  /^\/bank-transfer(?:\/.*)?$/i,
  /^\/send-money(?:\/.*)?$/i,
  /^\/fundWallet(?:\/.*)?$/i,
  /^\/cards(?:\/.*)?$/i,
  /^\/transaction(?:\/.*)?$/i,
  /^\/orders(?:\/.*)?$/i,
  /^\/business(?:\/.*)?$/i,
  /^\/circles(?:\/.*)?$/i,
  /^\/anchor-account(?:\/.*)?$/i,
  /^\/accountProfile(?:\/.*)?$/i,
  /^\/settings(?:\/.*)?$/i,
  /^\/history(?:\/.*)?$/i,
  /^\/fx(?:\/.*)?$/i,
  /^\/convert-ngn-to-usd(?:\/.*)?$/i,
  /^\/convert-usd-to-ngn(?:\/.*)?$/i,
  /^\/tunnel-activation(?:\/.*)?$/i,
  /^\/mobileProviders(?:\/.*)?$/i,
  /^\/powerProviders(?:\/.*)?$/i,
  /^\/electricity-provider(?:\/.*)?$/i,
  /^\/cableProviders(?:\/.*)?$/i,
  /^\/cable-tv-provider(?:\/.*)?$/i,
]

const PUBLIC_AUTH_ROUTES = new Set([
  '/welcome',
  '/login',
  '/sign-up',
  '/forgot-password',
  '/reset-password',
  '/recover-unconfirmed',
  '/confirmEmail',
])

export const isPublicAuthRoute = (route: string) => PUBLIC_AUTH_ROUTES.has(route)

export const sanitizeInternalRoute = (value: unknown) => {
  const route = String(value || '').trim()
  if (!route || !route.startsWith('/')) return null
  if (route.startsWith('//')) return null
  if (/^https?:/i.test(route)) return null
  if (/\s/.test(route)) return null
  return SAFE_ROUTE_PATTERNS.some((pattern) => pattern.test(route)) ? route : null
}

export const resolveSafeNotificationRoute = ({
  route,
  authenticated,
  activeAccountType,
}: {
  route: unknown
  authenticated: boolean
  activeAccountType?: 'personal' | 'business' | 'circle'
}) => {
  const safeRoute = sanitizeInternalRoute(route)
  if (!safeRoute) {
    return authenticated ? '/(tabs)' : '/welcome'
  }

  if (!authenticated) {
    return isPublicAuthRoute(safeRoute) ? safeRoute : '/welcome'
  }

  if (isPublicAuthRoute(safeRoute)) return '/(tabs)'
  if (/^\/business(\/|$)/i.test(safeRoute) && activeAccountType !== 'business') return '/business'
  if (/^\/circles\/[^/]+/i.test(safeRoute) && activeAccountType !== 'circle') return '/circles'
  if (/^\/bank-transfer\/(review|success|locked)$/i.test(safeRoute)) return '/bank-transfer'
  if (/^\/transaction\/(timeline-receipt|card-receipt)$/i.test(safeRoute)) return '/(tabs)/timeline'
  return safeRoute
}
