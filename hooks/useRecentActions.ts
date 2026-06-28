import { useCallback, useEffect, useState } from 'react'
import * as SecureStore from 'expo-secure-store'

import { CommandAction } from '@/api/actions'

const RECENT_ACTIONS_KEY = 'bitbridge_recent_actions_v2'
const MAX_RECENT_ACTIONS = 8

const sanitizeRecentActions = (value: unknown): CommandAction[] => {
  if (!Array.isArray(value)) return []
  return value.filter((item) => {
    if (!item || typeof item !== 'object') return false
    const action = item as CommandAction
    return typeof action.key === 'string' && action.enabled === true && typeof action.route === 'string' && action.route.length > 0
  }) as CommandAction[]
}

export const useRecentActions = () => {
  const [recentActions, setRecentActions] = useState<CommandAction[]>([])
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    let mounted = true

    const load = async () => {
      try {
        const raw = await SecureStore.getItemAsync(RECENT_ACTIONS_KEY)
        if (!mounted) return
        if (!raw) {
          setRecentActions([])
          return
        }

        const parsed = JSON.parse(raw)
        setRecentActions(sanitizeRecentActions(parsed))
      } catch {
        if (mounted) setRecentActions([])
      } finally {
        if (mounted) setHydrated(true)
      }
    }

    void load()
    return () => {
      mounted = false
    }
  }, [])

  const recordRecentAction = useCallback(async (action: CommandAction) => {
    if (!action.enabled || !action.route) return

    setRecentActions((current) => {
      const deduped = current.filter((item) => item.key !== action.key)
      const next = [action, ...deduped].slice(0, MAX_RECENT_ACTIONS)
      void SecureStore.setItemAsync(RECENT_ACTIONS_KEY, JSON.stringify(next)).catch(() => {})
      return next
    })
  }, [])

  return { recentActions, recordRecentAction, hydrated }
}
