type RouteParam = string | string[] | undefined | null

export const extractRouteCardId = (param: RouteParam): string => {
  if (Array.isArray(param)) {
    return String(param[0] ?? '').trim()
  }
  return String(param ?? '').trim()
}

const pickFirstString = (...values: any[]): string => {
  for (const value of values) {
    const text = String(value ?? '').trim()
    if (text) return text
  }
  return ''
}

// Web canonical behavior uses local card.id for /cards/:id/* endpoints.
// Keep extraction defensive in case id is nested in metadata on some payload shapes.
export const getCardsApiId = (card: any): string => {
  const meta = card?.meta_data ?? card?.metaData ?? {}
  return pickFirstString(
    card?.id,
    card?.local_card_id,
    card?.localCardId,
    meta?.local_card_id,
    meta?.localCardId,
    // last-resort fallback so we still return something on malformed payloads
    card?.card_id
  )
}

export const pickCardRouteId = (card: any): string => getCardsApiId(card)

export const pickCardDetailsIdentifier = (card: any): string => getCardsApiId(card)

export const resolveCardDetailsIdentifier = ({
  routeParam,
  card,
}: {
  routeParam: RouteParam | string
  card?: any
}): string => {
  const preferredFromCard = getCardsApiId(card)
  if (preferredFromCard) return preferredFromCard
  return extractRouteCardId(routeParam as RouteParam)
}

export const matchCardByIdentifier = (cards: any[], routeCardId: string) => {
  const key = String(routeCardId || '').trim()
  if (!Array.isArray(cards) || !key) return null
  return (
    cards.find((item) => String(item?.id ?? '').trim() === key) ||
    cards.find((item) => String(item?.card_id ?? '').trim() === key) ||
    null
  )
}

export const isCardNotFoundError = (error: any): boolean => {
  const status = Number(error?.status ?? error?.response?.status)
  const message = String(error?.message ?? '').toLowerCase()
  if (status === 404) return true
  return (
    message.includes('card not found') ||
    message.includes('invalid card id') ||
    message.includes('no card with this id')
  )
}

export const shouldShowInvalidCardBanner = ({
  routeCardId,
  hasUsableCard,
  error,
}: {
  routeCardId: string
  hasUsableCard: boolean
  error: any
}): boolean => {
  if (!routeCardId) return true
  if (hasUsableCard) return false
  if (!error) return false
  return isCardNotFoundError(error)
}
