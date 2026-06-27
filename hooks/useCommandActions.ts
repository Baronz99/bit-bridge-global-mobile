import { useMemo, useState } from 'react'

import { ActionWorkspace, CommandAction } from '@/api/actions'
import { useActionNavigation } from '@/hooks/useActionNavigation'
import { useActionSearch } from '@/hooks/useActionSearch'
import { useActionSuggestions } from '@/hooks/useActionSuggestions'
import { useRecentActions } from '@/hooks/useRecentActions'

const categoryOrder = ['suggested', 'payments', 'wallets', 'cards', 'global', 'circles', 'identity', 'transactions', 'help', 'settings', 'security']

const sortByCategory = (actions: CommandAction[]) => {
  return [...actions].sort((a, b) => {
    const left = categoryOrder.indexOf(a.category)
    const right = categoryOrder.indexOf(b.category)
    if (left === right) return a.title.localeCompare(b.title)
    if (left === -1) return 1
    if (right === -1) return -1
    return left - right
  })
}

export const useCommandActions = (workspace: ActionWorkspace, visible: boolean) => {
  const [query, setQuery] = useState('')
  const { suggestions, loading: suggestionsLoading } = useActionSuggestions(workspace, visible)
  const { results, loading: searchLoading, emptySearched } = useActionSearch(workspace, query, visible)
  const { recentActions, recordRecentAction, hydrated } = useRecentActions()
  const { navigateForAction } = useActionNavigation()

  const showingSearch = query.trim().length > 0

  const groupedResults = useMemo(() => {
    const groups = new Map<string, CommandAction[]>()
    for (const action of sortByCategory(results)) {
      const bucket = groups.get(action.category) || []
      bucket.push(action)
      groups.set(action.category, bucket)
    }
    return Array.from(groups.entries()).map(([category, items]) => ({ category, items }))
  }, [results])

  const handleActionPress = async (action: CommandAction) => {
    const navigated = await navigateForAction(action)
    if (navigated) {
      await recordRecentAction(action)
    }
    return navigated
  }

  return {
    query,
    setQuery,
    showingSearch,
    groupedResults,
    suggestions,
    suggestionsLoading,
    searchLoading,
    emptySearched,
    recentActions: hydrated ? recentActions : [],
    handleActionPress,
  }
}
