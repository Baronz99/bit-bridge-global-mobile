type AnyRecord = Record<string, any>

const asRecord = (value: unknown): AnyRecord => {
  if (!value || typeof value !== 'object') return {}
  return value as AnyRecord
}

export const resolveUserProfile = (payload: unknown): AnyRecord => {
  const root = asRecord(payload)
  const unwrapped = asRecord(root.data)
  const merged = Object.keys(unwrapped).length ? unwrapped : root

  const nestedProfile = asRecord(merged.user_profile ?? merged.profile)
  return {
    ...merged,
    user_profile: nestedProfile,
  }
}

