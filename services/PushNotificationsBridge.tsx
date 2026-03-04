import { useEffect, useRef } from 'react'
import { Platform } from 'react-native'
import Constants from 'expo-constants'

import { registerNotificationDevice, unregisterNotificationDevice } from '@/api/notifications'
import { useAuth } from '@/services/useAuth'
import { log } from '@/utils/logger'

type ExpoNotificationsModule = {
  AndroidImportance?: { MAX: number }
  setNotificationHandler?: (handler: {
    handleNotification: () => Promise<{
      shouldShowAlert: boolean
      shouldPlaySound: boolean
      shouldSetBadge: boolean
      shouldShowBanner?: boolean
      shouldShowList?: boolean
    }>
  }) => void
  setNotificationChannelAsync?: (channelId: string, config: Record<string, unknown>) => Promise<void>
  getPermissionsAsync: () => Promise<{ status?: string; granted?: boolean }>
  requestPermissionsAsync: () => Promise<{ status?: string; granted?: boolean }>
  getExpoPushTokenAsync: (args: { projectId?: string }) => Promise<{ data?: string }>
  addNotificationReceivedListener: (listener: (notification: unknown) => void) => { remove: () => void }
  addNotificationResponseReceivedListener: (listener: (response: unknown) => void) => { remove: () => void }
}

const safeLoadNotifications = (): ExpoNotificationsModule | null => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-notifications') as ExpoNotificationsModule
  } catch {
    return null
  }
}

const Notifications = safeLoadNotifications()
let handlerInitialized = false

const getProjectId = () => {
  const easProjectId = (Constants as any)?.expoConfig?.extra?.eas?.projectId
  const nativeProjectId = (Constants as any)?.easConfig?.projectId
  return String(easProjectId || nativeProjectId || '').trim() || null
}

const getExpoPushToken = async (): Promise<string | null> => {
  if (!Notifications) return null
  if (Platform.OS === 'web') return null

  const current = await Notifications.getPermissionsAsync()
  let granted = current?.granted === true || current?.status === 'granted'

  if (!granted) {
    const requested = await Notifications.requestPermissionsAsync()
    granted = requested?.granted === true || requested?.status === 'granted'
  }

  if (!granted) return null

  const projectId = getProjectId()
  if (!projectId) return null

  const tokenResult = await Notifications.getExpoPushTokenAsync({ projectId })
  const token = String(tokenResult?.data || '').trim()
  return token || null
}

export default function PushNotificationsBridge() {
  const { authenticated, token: accessToken, user } = useAuth()
  const registeredTokenRef = useRef<string | null>(null)

  useEffect(() => {
    if (!Notifications || handlerInitialized) return
    handlerInitialized = true

    Notifications.setNotificationHandler?.({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    })

    if (Platform.OS === 'android') {
      void Notifications.setNotificationChannelAsync?.('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance?.MAX,
      })
    }
  }, [])

  useEffect(() => {
    if (!Notifications) return

    const received = Notifications.addNotificationReceivedListener((notification) => {
      log('[PUSH] received_foreground', { notification })
    })

    const response = Notifications.addNotificationResponseReceivedListener((notificationResponse) => {
      log('[PUSH] tapped', { notificationResponse })
    })

    return () => {
      received.remove()
      response.remove()
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const syncDevice = async () => {
      if (!authenticated || !accessToken) {
        const existing = registeredTokenRef.current
        if (existing) {
          await unregisterNotificationDevice(existing).catch(() => null)
          registeredTokenRef.current = null
        }
        return
      }

      if (!Notifications) {
        log('[PUSH] expo-notifications package not installed; skipping registration')
        return
      }

      const expoToken = await getExpoPushToken().catch((error) => {
        log('[PUSH] token_fetch_failed', { message: (error as any)?.message || String(error) })
        return null
      })

      if (!expoToken || cancelled) return
      if (registeredTokenRef.current === expoToken) return

      await registerNotificationDevice({
        token: expoToken,
        provider: 'expo',
        platform: Platform.OS,
        app_version: String((Constants as any)?.expoConfig?.version || ''),
        metadata: {
          appOwnership: (Constants as any)?.appOwnership || null,
          sdkVersion: (Constants as any)?.expoConfig?.sdkVersion || null,
          userId: user?.id || null,
        },
      }).catch((error) => {
        log('[PUSH] register_failed', { message: (error as any)?.message || String(error) })
      })

      if (!cancelled) {
        registeredTokenRef.current = expoToken
      }
    }

    void syncDevice()

    return () => {
      cancelled = true
    }
  }, [authenticated, accessToken, user?.id])

  return null
}

