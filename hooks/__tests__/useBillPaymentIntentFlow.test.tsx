import React from 'react'
import TestRenderer, { act } from 'react-test-renderer'
import useBillPaymentIntentFlow from '@/hooks/useBillPaymentIntentFlow'
import {
  createBillPaymentIntent,
  executeBillPaymentIntent,
  getBillPaymentIntent,
} from '@/api/billOrder'

jest.mock('@/api/billOrder', () => ({
  createBillPaymentIntent: jest.fn(),
  executeBillPaymentIntent: jest.fn(),
  getBillPaymentIntent: jest.fn(),
}))

const mockedCreateIntent = createBillPaymentIntent as jest.Mock
const mockedExecuteIntent = executeBillPaymentIntent as jest.Mock
const mockedGetIntent = getBillPaymentIntent as jest.Mock

describe('useBillPaymentIntentFlow', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('handles pending execute then polls to completed', async () => {
    mockedCreateIntent.mockResolvedValue({ id: 'intent_1' })
    mockedExecuteIntent.mockResolvedValue({
      pending: true,
      status: 'pending',
      http_status: 202,
      message: 'processing',
    })
    mockedGetIntent
      .mockResolvedValueOnce({ id: 'intent_1', status: 'processing', bill_order_id: 'order_1' })
      .mockResolvedValueOnce({ id: 'intent_1', status: 'completed', bill_order_id: 'order_1' })

    const onCompleted = jest.fn()
    let hookState: any = null

    const Harness = () => {
      hookState = useBillPaymentIntentFlow({
        billOrderId: 'order_1',
        initialIntentId: null,
        resumeFlag: false,
        onCompleted,
      })
      return null
    }

    let renderer: TestRenderer.ReactTestRenderer
    await act(async () => {
      renderer = TestRenderer.create(<Harness />)
      await Promise.resolve()
    })

    await act(async () => {
      await hookState.execute({ billTotal: 500, walletBalance: 5000 })
    })
    expect(hookState.uiState).toBe('processing')
    expect(mockedExecuteIntent).toHaveBeenCalledWith('intent_1', { use_commission: false })

    await act(async () => {
      jest.advanceTimersByTime(4500)
      await Promise.resolve()
    })

    expect(hookState.uiState).toBe('completed')
    expect(onCompleted).toHaveBeenCalledWith('order_1')
    expect(onCompleted).toHaveBeenCalledTimes(1)

    await act(async () => {
      renderer!.unmount()
    })
  })
})

