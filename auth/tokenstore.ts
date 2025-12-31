import * as SecureStore from 'expo-secure-store'

export const TOKEN_KEY = 'bitglobal'
export const REFRESH_TOKEN_KEY = 'refresh-token'

const normalizeToken = (raw?: string | null) => {
  if (!raw) return null
  const str = String(raw).trim()
  if (/^Bearer\s+/i.test(str)) return str.replace(/^Bearer\s+/i, '').trim()
  return str.replace(/^"+|"+$/g, '').trim()
}

export const getAccessToken = async () => {
  const raw = await SecureStore.getItemAsync(TOKEN_KEY)
  return normalizeToken(raw)
}

export const setAccessToken = async (token: string) => {
  const clean = normalizeToken(token)
  if (!clean) return
  await SecureStore.setItemAsync(TOKEN_KEY, clean)
}

export const clearAccessToken = async () => {
  await SecureStore.deleteItemAsync(TOKEN_KEY)
}

export const getRefreshToken = async () => {
  const raw = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY)
  return normalizeToken(raw)
}

export const setRefreshToken = async (token: string) => {
  const clean = normalizeToken(token)
  if (!clean) return
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, clean)
}

export const clearRefreshToken = async () => {
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY)
}

export const clearAuthStorage = async () => {
  await Promise.all([clearAccessToken(), clearRefreshToken()])
}
