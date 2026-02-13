import client from '@/api/client'
import { createBillPaymentIntent, executeBillPaymentIntent } from '@/api/billOrder'

jest.mock('@/api/client', () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
  },
}))

const mockedPost = client.post as jest.Mock

describe('bill payment intent API contract', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('creates a bill payment intent with bill_order_id payload', async () => {
    mockedPost.mockResolvedValueOnce({ data: { data: { id: 'intent_1' } } })

    const response = await createBillPaymentIntent('order_123')

    expect(mockedPost).toHaveBeenCalledWith('/bill_payment_intents', { bill_order_id: 'order_123' })
    expect(response).toEqual(expect.objectContaining({ id: 'intent_1' }))
  })

  it('executes a bill payment intent via execute endpoint', async () => {
    mockedPost.mockResolvedValueOnce({ status: 200, data: { success: true } })

    const response = await executeBillPaymentIntent('intent_123', { use_commission: true })

    expect(mockedPost).toHaveBeenCalledWith('/bill_payment_intents/intent_123/execute', { use_commission: true })
    expect(response).toEqual(expect.objectContaining({ success: true, http_status: 200 }))
  })
})
