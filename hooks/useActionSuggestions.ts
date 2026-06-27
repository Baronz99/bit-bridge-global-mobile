import { useEffect, useState } from 'react'

import { ActionSuggestionsPayload, ActionWorkspace, getActionSuggestions } from '@/api/actions'

const EMPTY_SUGGESTIONS: ActionSuggestionsPayload = {
  need_attention: [],
  suggested: [],
  recent: [],
}

export const useActionSuggestions = (workspace: ActionWorkspace, enabled: boolean) => {
  const [data, setData] = useState<ActionSuggestionsPayload>(EMPTY_SUGGESTIONS)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled) return
    let active = true

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const payload = await getActionSuggestions(workspace)
        if (active) setData(payload)
      } catch (err: unknown) {
        if (active) {
          setData(EMPTY_SUGGESTIONS)
          const message = err && typeof err === 'object' && 'message' in err ? String((err as { message?: unknown }).message || 'Unable to load actions.') : 'Unable to load actions.'
          setError(message)
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    void load()
    return () => {
      active = false
    }
  }, [enabled, workspace])

  return { suggestions: data, loading, error }
}

