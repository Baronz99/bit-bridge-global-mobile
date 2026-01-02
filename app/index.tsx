import { useEffect } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '@/services/useAuth'

export default function Index() {
  const router = useRouter()
  const { loading, authenticated } = useAuth()

  useEffect(() => {
    if (loading) return

    if (authenticated) router.replace('/(tabs)')
    else router.replace('/login')
  }, [loading, authenticated, router])

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator />
    </View>
  )
}
