import client from '@/api/client'

export type ActionWorkspace = 'personal' | 'business' | 'circle'
export type ActionRiskLevel = 'low' | 'medium' | 'high'
export type ActionExecuteMode = 'navigate_only' | 'prefill_then_review' | 'guarded_flow'

export type CommandActionLink = {
  key: string
  title: string
  route: string | null
}

export type CommandActionBadge =
  | string
  | {
      kind?: string | null
      value?: string | null
    }

export type CommandAction = {
  key: string
  title: string
  subtitle: string
  category: string
  domain: string
  workspace_scope: string[]
  aliases: string[]
  keywords: string[]
  route: string | null
  icon: string | null
  risk_level: ActionRiskLevel
  execute_mode: ActionExecuteMode
  confirmation_required: boolean
  required_kyc_tier: string | null
  telemetry_key: string | null
  enabled: boolean
  availability: string
  disabled_reason: string | null
  missing_requirements: string[]
  badge: CommandActionBadge | null
  urgency: string | null
  next_best_actions: CommandActionLink[]
}

export type ActionSuggestionsPayload = {
  need_attention: CommandAction[]
  suggested: CommandAction[]
  recent: CommandAction[]
}

const normalizeWorkspace = (workspace?: string): ActionWorkspace => {
  if (workspace === 'business' || workspace === 'circle') return workspace
  return 'personal'
}

export const getActions = async (workspace: ActionWorkspace = 'personal'): Promise<CommandAction[]> => {
  const res = await client.get('/actions', { params: { workspace: normalizeWorkspace(workspace) } })
  return Array.isArray(res?.data?.data) ? res.data.data : []
}

export const getActionSuggestions = async (
  workspace: ActionWorkspace = 'personal'
): Promise<ActionSuggestionsPayload> => {
  const res = await client.get('/actions/suggestions', { params: { workspace: normalizeWorkspace(workspace) } })
  const data = res?.data?.data || {}
  return {
    need_attention: Array.isArray(data.need_attention) ? data.need_attention : [],
    suggested: Array.isArray(data.suggested) ? data.suggested : [],
    recent: Array.isArray(data.recent) ? data.recent : [],
  }
}

export const searchActions = async ({
  query,
  workspace = 'personal',
  limit = 12,
  includeDisabled = true,
}: {
  query: string
  workspace?: ActionWorkspace
  limit?: number
  includeDisabled?: boolean
}): Promise<CommandAction[]> => {
  const res = await client.post('/actions/search', {
    query,
    workspace: normalizeWorkspace(workspace),
    limit,
    include_disabled: includeDisabled,
  })

  const data = res?.data?.data || {}
  return Array.isArray(data.results) ? data.results : []
}
