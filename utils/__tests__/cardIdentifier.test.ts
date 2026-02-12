import {
  extractRouteCardId,
  getCardsApiId,
  isCardNotFoundError,
  matchCardByIdentifier,
  pickCardDetailsIdentifier,
  pickCardRouteId,
  resolveCardDetailsIdentifier,
  shouldShowInvalidCardBanner,
} from '../cardIdentifier'

describe('cardIdentifier helpers', () => {
  it('extracts route param from expo-router dynamic segment values', () => {
    expect(extractRouteCardId(['381'])).toBe('381')
    expect(extractRouteCardId('bridge_123')).toBe('bridge_123')
    expect(extractRouteCardId(undefined)).toBe('')
  })

  it('getCardsApiId matches web behavior: prefer local card.id for /cards/:id/*', () => {
    const listItemWithBoth = {
      id: '25e421c1-b8a0-49b1-a096-2ea72527ce2e',
      card_id: '30efa0ad5e814280950367ac0a631432',
      status: 'active',
    }
    const listItemWithMetaLocal = {
      card_id: '30efa0ad5e814280950367ac0a631432',
      meta_data: { local_card_id: '25e421c1-b8a0-49b1-a096-2ea72527ce2e' },
    }
    const listItemProviderOnly = { card_id: 'bridge_999', status: 'active' }

    expect(getCardsApiId(listItemWithBoth)).toBe('25e421c1-b8a0-49b1-a096-2ea72527ce2e')
    expect(getCardsApiId(listItemWithMetaLocal)).toBe('25e421c1-b8a0-49b1-a096-2ea72527ce2e')
    expect(getCardsApiId(listItemProviderOnly)).toBe('bridge_999')
  })

  it('pickCardRouteId delegates to getCardsApiId', () => {
    const listItemWithDbId = { id: 'd2f5b3e4-7c29-4d8c-96f7-01d54a67a9d1', card_id: 'bridge_123' }
    expect(pickCardRouteId(listItemWithDbId)).toBe('d2f5b3e4-7c29-4d8c-96f7-01d54a67a9d1')
    expect(pickCardRouteId({})).toBe('')
  })

  it('pickCardDetailsIdentifier prefers local id and falls back safely', () => {
    const realShape = {
      id: '7ed59635-6fba-4f3f-bf16-0ac9bb6a7349',
      card_id: '3f5f64b8-8f5f-4b6d-8d10-provider',
      status: 'active',
    }
    expect(pickCardDetailsIdentifier(realShape)).toBe('7ed59635-6fba-4f3f-bf16-0ac9bb6a7349')
    expect(pickCardDetailsIdentifier({ id: 'local-only-id' })).toBe('local-only-id')
  })

  it('resolveCardDetailsIdentifier uses card local id when available', () => {
    expect(
      resolveCardDetailsIdentifier({
        routeParam: 'local-route-id',
        card: { id: 'local-route-id', card_id: 'provider-card-id' },
      })
    ).toBe('local-route-id')
    expect(resolveCardDetailsIdentifier({ routeParam: 'route-only-id', card: null })).toBe('route-only-id')
  })

  it('matches cards by id or card_id for local fallback rendering', () => {
    const cards = [
      { id: 381, card_id: 'bridge_123', status: 'active' },
      { id: 382, card_id: 'bridge_124', status: 'frozen' },
    ]
    expect(matchCardByIdentifier(cards, '381')).toEqual(cards[0])
    expect(matchCardByIdentifier(cards, 'bridge_124')).toEqual(cards[1])
    expect(matchCardByIdentifier(cards, 'missing')).toBeNull()
  })

  it('treats 404 and card-not-found messages as invalid-card errors', () => {
    expect(isCardNotFoundError({ response: { status: 404 }, message: 'Not Found' })).toBe(true)
    expect(isCardNotFoundError({ message: 'No card with this ID' })).toBe(true)
    expect(isCardNotFoundError({ message: 'network timeout' })).toBe(false)
  })

  it('does not show invalid-card banner when a usable card object exists', () => {
    expect(
      shouldShowInvalidCardBanner({
        routeCardId: '381',
        hasUsableCard: true,
        error: { response: { status: 404 }, message: 'No card with this ID' },
      })
    ).toBe(false)
  })
})
