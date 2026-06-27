import { useEffect, useState } from 'react'

import { ActionWorkspace, CommandAction, searchActions } from '@/api/actions'
import { log } from '@/utils/logger'

const DEBOUNCE_MS = 220

export const useActionSearch = (workspace: ActionWorkspace, query: string, enabled: boolean) => {
  const [results, setResults] = useState<CommandAction[]>([])
  const [loading, setLoading] = useState(false)
  const [emptySearched, setEmptySearched] = useState(false)

  useEffect(() => {
    if (!enabled) return
    const trimmed = query.trim()
    if (!trimmed) {
      setResults([])
      setLoading(false)
      setEmptySearched(false)
      return
    }

    let active = true
    setLoading(true)
    const timer = setTimeout(async () => {
      try {
        log('command_search_submitted', { query: trimmed, workspace })
        const payload = await searchActions({ query: trimmed, workspace })
        if (!active) return
        setResults(payload)
        setEmptySearched(true)
      } catch {
        if (!active) return
        setResults([])
        setEmptySearched(true)
      } finally {
        if (active) setLoading(false)
      }
    }, DEBOUNCE_MS)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [enabled, query, workspace])

  return { results, loading, emptySearched }
}
