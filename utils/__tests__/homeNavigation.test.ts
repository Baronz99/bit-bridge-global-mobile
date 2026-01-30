import { decideHomeNavigation } from '../timelineRefs'

describe('Home navigation invariants', () => {
  it('wallet-tx goes to receipt flow', () => {
    const decision = decideHomeNavigation({ id: 'wallet-tx-abc123' })
    expect(decision).toEqual({ type: 'receipt', reference: 'wallet-tx-abc123' })
  })

  it('non-wallet id falls back to timeline detail', () => {
    const decision = decideHomeNavigation({ id: 'circle-tx-1' })
    expect(decision).toEqual({ type: 'timeline-detail', id: 'circle-tx-1' })
  })
})
