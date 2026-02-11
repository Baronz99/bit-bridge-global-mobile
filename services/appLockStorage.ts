import * as SecureStore from 'expo-secure-store'

export const APP_LOCK_BG_AT_KEY = 'app-lock-bg-at'

export const saveAppLockBackgroundAt = async (value: number) => {
  await SecureStore.setItemAsync(APP_LOCK_BG_AT_KEY, String(value))
}

export const getAppLockBackgroundAt = async (): Promise<number | null> => {
  const raw = await SecureStore.getItemAsync(APP_LOCK_BG_AT_KEY)
  if (!raw) return null
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : null
}

export const clearAppLockPersisted = async () => {
  await SecureStore.deleteItemAsync(APP_LOCK_BG_AT_KEY)
}

