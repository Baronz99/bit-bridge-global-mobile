import { useLocalSearchParams, usePathname } from 'expo-router'
import { buildReturnTo } from '@/auth/redirect'

export const useAuthReturnTo = () => {
  const pathname = usePathname()
  const params = useLocalSearchParams()

  return buildReturnTo(pathname, params as Record<string, any>)
}
