const normalizeDateInput = (value: string | number | Date | null | undefined): Date | null => {
  if (value === null || value === undefined) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null
    const ms = value > 1_000_000_000_000 ? value : value > 1_000_000_000 ? value * 1000 : value
    const parsed = new Date(ms)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  const trimmed = String(value).trim()
  if (!trimmed) return null

  const asNumber = Number(trimmed)
  if (!Number.isNaN(asNumber)) {
    const ms = asNumber > 1_000_000_000_000 ? asNumber : asNumber > 1_000_000_000 ? asNumber * 1000 : asNumber
    const parsedFromNumber = new Date(ms)
    if (!Number.isNaN(parsedFromNumber.getTime())) return parsedFromNumber
  }

  const parsed = new Date(trimmed)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export const dateFormat = (date: string | number | Date | null | undefined, fallback = '--') => {
  const parsed = normalizeDateInput(date)
  if (!parsed) return fallback
  return parsed.toLocaleString()
}
