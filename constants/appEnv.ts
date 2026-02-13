const normalizeEnv = (value: string) => {
  const env = String(value || '').trim().toLowerCase()
  if (env === 'production' || env === 'preview' || env === 'development') return env
  return 'development'
}

export const APP_ENV = normalizeEnv(String(process.env.EXPO_PUBLIC_APP_ENV || 'development'))
export const INTERNAL_DIAGNOSTICS_ENABLED =
  APP_ENV !== 'production' && String(process.env.EXPO_PUBLIC_ENABLE_INTERNAL_DEBUG || '').toLowerCase() === 'true'

