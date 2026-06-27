import { useCallback } from 'react'
import { Alert } from 'react-native'
import { Href, useRouter } from 'expo-router'

import { CommandAction } from '@/api/actions'
import { log } from '@/utils/logger'

export type ActionNavigationResolution =
  | { type: 'navigate'; route: string }
  | { type: 'remediate'; route: string; reason: string | null }
  | { type: 'blocked'; reason: string }

export const resolveCommandActionTarget = (action: CommandAction): ActionNavigationResolution => {
  if (action.enabled && action.route) {
    return { type: 'navigate', route: action.route }
  }

  const remediation = action.next_best_actions?.find((item) => item?.route)
  if (remediation?.route) {
    return {
      type: 'remediate',
      route: remediation.route,
      reason: action.disabled_reason,
    }
  }

  return {
    type: 'blocked',
    reason: action.disabled_reason || 'This action is not available right now.',
  }
}

export const useActionNavigation = () => {
  const router = useRouter()

  const navigateForAction = useCallback(async (action: CommandAction) => {
    const resolution = resolveCommandActionTarget(action)

    if (resolution.type === 'blocked') {
      log('command_action_blocked', { key: action.key, reason: resolution.reason })
      Alert.alert('Action unavailable', resolution.reason)
      return false
    }

    if (resolution.type === 'remediate' && resolution.reason) {
      Alert.alert('Complete this first', resolution.reason)
    }

    log('command_action_selected', {
      key: action.key,
      route: resolution.route,
      risk_level: action.risk_level,
      execute_mode: action.execute_mode,
    })
    router.push(resolution.route as Href)
    return true
  }, [router])

  return { navigateForAction }
}

