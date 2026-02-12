import React from 'react'
import { act, create } from 'react-test-renderer'
import TierGateCard from '@/components/bankTransfer/TierGateCard'
import { BANK_TRANSFER_TIER_REQUIREMENT_COPY } from '@/utils/bankTransfer'

describe('TierGateCard', () => {
  it('renders tier requirement copy', async () => {
    let tree: any = null
    await act(async () => {
      tree = create(<TierGateCard onUpgrade={() => {}} />)
    })
    expect(JSON.stringify(tree.toJSON())).toContain(BANK_TRANSFER_TIER_REQUIREMENT_COPY)
  })
})
