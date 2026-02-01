const encodeQuery = (entries: Array<[string, string]>): string => {
  if (!entries.length) return ''
  return entries
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&')
}

export const buildReturnTo = (
  pathname?: string,
  params?: Record<string, any>
): string => {
  const base = pathname && String(pathname).trim() ? String(pathname) : '/'
  const entries: Array<[string, string]> = []

  Object.entries(params || {}).forEach(([key, value]) => {
    if (key === 'returnTo') return
    if (value === undefined || value === null || value === '') return
    if (Array.isArray(value)) {
      value.forEach((v) => {
        if (v === undefined || v === null || v === '') return
        entries.push([key, String(v)])
      })
      return
    }
    entries.push([key, String(value)])
  })

  const query = encodeQuery(entries)
  return query ? `${base}?${query}` : base
}

export const isSafeReturnTo = (value?: string | null) => {
  if (!value) return false
  const v = String(value).trim()
  if (!v) return false
  if (!v.startsWith('/')) return false
  if (v.startsWith('//')) return false
  if (v.includes('..')) return false
  if (v.includes('http')) return false
  if (v.includes(':')) return false
  return true
}
