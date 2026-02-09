type ResolveBillOrderIdInput = {
  routeOrderId?: string | null
  data?: unknown
}

const asObject = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

const asString = (value: unknown): string => String(value ?? '').trim()

const findByKey = (
  value: unknown,
  keys: Set<string>,
  depth = 0,
  maxDepth = 6
): string | null => {
  if (depth > maxDepth) return null
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findByKey(item, keys, depth + 1, maxDepth)
      if (found) return found
    }
    return null
  }

  const obj = asObject(value)
  if (!obj) return null

  for (const [key, raw] of Object.entries(obj)) {
    if (keys.has(key)) {
      const candidate = asString(raw)
      if (candidate) return candidate
    }
  }

  for (const raw of Object.values(obj)) {
    const found = findByKey(raw, keys, depth + 1, maxDepth)
    if (found) return found
  }

  return null
}

const ORDER_ID_KEYS = new Set([
  'bill_order_id',
  'billOrderId',
  'order_id',
  'orderId',
  'id',
])

export default async function resolveBillOrderId({
  routeOrderId,
  data,
}: ResolveBillOrderIdInput): Promise<string> {
  const fromData = findByKey(data, ORDER_ID_KEYS)
  if (fromData) return fromData

  const fromRoute = asString(routeOrderId)
  if (fromRoute) return fromRoute

  throw new Error('Missing bill_order_id for confirm')
}
