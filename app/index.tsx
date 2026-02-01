import { useEffect } from 'react'
import { ActivityIndicator, View, Text } from 'react-native'
import { useRouter, useSegments } from 'expo-router'
import { useAuth } from '../services/useAuth'
import { useAppLock } from '../services/useAppLock'

export default function Index() {
  const router = useRouter()
  const segments = useSegments() as string[]
  const { loading, authenticated, authHydrated, profileLoading, userProfileData } = useAuth()
  const { locked } = useAppLock()

  useEffect(() => {
    if (!authHydrated) return
    if (loading) return
    if (__DEV__) {
      console.log('[AUTH_GATE] state', {
        authenticated,
        authHydrated,
        profileLoading,
        hasProfile: !!userProfileData,
      })
    }

    if (!authenticated) {
      if (__DEV__) console.log('[AUTH_GATE] unauth -> /welcome')
      const inWelcome = segments?.[0] === 'welcome'
      if (!inWelcome) router.replace('/welcome' as any)
      return
    }

    if (locked) {
      const inLock = segments?.[0] === 'lock'
      if (!inLock) router.replace('/lock' as any)
      return
    }

    if (profileLoading || !userProfileData) {
      if (__DEV__) console.log('[AUTH_GATE] waiting profile')
      return
    }

    if (__DEV__) console.log('[AUTH_GATE] tabs -> /(tabs)')
    const inTabs = segments?.[0] === '(tabs)'
    if (!inTabs) router.replace('/(tabs)' as any)
  }, [
    authHydrated,
    loading,
    authenticated,
    profileLoading,
    userProfileData,
    router,
    segments,
  ])

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#111' }}>
      <ActivityIndicator size="large" color="#FFCC00" />
      <View style={{ height: 12 }} />
      <Text style={{ color: 'white' }}>Booting</Text>
      <Text style={{ color: '#aaa', marginTop: 6, fontSize: 12 }}>
        env: {String(process.env.EXPO_PUBLIC_ENV || '')} | segments: {JSON.stringify(segments)}
      </Text>
      <Text style={{ color: '#aaa', marginTop: 6, fontSize: 12 }}>
        hydrated: {String(authHydrated)} | loading: {String(loading)} | authed: {String(authenticated)}
      </Text>
      <Text style={{ color: '#aaa', marginTop: 6, fontSize: 12 }}>
        profileLoading: {String(profileLoading)} | hasProfile: {String(!!userProfileData)}
      </Text>
    </View>
  )
}
