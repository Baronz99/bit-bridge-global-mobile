import React from 'react'
import { act, create } from 'react-test-renderer'
import RecipientVerificationState from '@/components/bankTransfer/RecipientVerificationState'

describe('RecipientVerificationState', () => {
  it('renders verifying state', async () => {
    let tree: any = null
    await act(async () => {
      tree = create(<RecipientVerificationState status="loading" />)
    })
    const text = JSON.stringify(tree.toJSON())
    expect(text).toContain('Verifying recipient')
  })

  it('renders verified state', async () => {
    let tree: any = null
    await act(async () => {
      tree = create(
        <RecipientVerificationState
          status="success"
          accountName="Jane Doe"
          bankName="GT Bank"
          accountNumber="1234567890"
        />
      )
    })
    const text = JSON.stringify(tree.toJSON())
    expect(text).toContain('Verified Recipient')
    expect(text).toContain('GT Bank')
  })

  it('renders failed state', async () => {
    let tree: any = null
    await act(async () => {
      tree = create(<RecipientVerificationState status="error" error="Account not found." />)
    })
    expect(JSON.stringify(tree.toJSON())).toContain('Account not found.')
  })
})
