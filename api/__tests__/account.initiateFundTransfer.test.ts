import client from '@/api/client'
import { initiateFundTransfer } from '@/api/account'

jest.mock('@/api/client', () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
  },
}))

const mockedPost = client.post as jest.Mock

describe('initiateFundTransfer payload contract', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('posts web-compatible payload shape with Accept header', async () => {
    mockedPost.mockResolvedValueOnce({ data: { status: 'ok' } })

    const payload = {
      account: {
        account_number: '1234567890',
        bank_code: '000',
        bank: 'Test Bank',
        account_name: 'Jane Doe',
        amount: 500,
        inter_bank: false,
        counter_party_id: 'cp_123',
        pin: '1234',
        transfer_reference: 'ref-abc-123',
        description: 'Fund Transfer',
      },
    }

    await initiateFundTransfer(payload)

    expect(mockedPost).toHaveBeenCalledWith(
      '/accounts/initiate_fund_transfer',
      payload,
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: 'application/json',
        }),
      })
    )
  })

  it('rejects invalid payload before network call', async () => {
    await expect(
      initiateFundTransfer({
        account: {
          account_number: '12345',
          bank_code: '',
          bank: '',
          account_name: '',
          amount: 0,
          inter_bank: false,
          pin: '12',
          transfer_reference: '',
          description: '',
        },
      } as any)
    ).rejects.toThrow('Account number must be exactly 10 digits.')

    expect(mockedPost).not.toHaveBeenCalled()
  })

  it('rejects inter-bank payload without counter_party_id before network call', async () => {
    await expect(
      initiateFundTransfer({
        account: {
          account_number: '1234567890',
          bank_code: '000',
          bank: 'Test Bank',
          account_name: 'Jane Doe',
          amount: 500,
          inter_bank: true,
          pin: '1234',
          transfer_reference: 'ref-abc-123',
          description: 'Fund Transfer',
        },
      } as any)
    ).rejects.toThrow('counter_party_id is required when inter_bank is true.')

    expect(mockedPost).not.toHaveBeenCalled()
  })

  it('posts inter-bank payload when counter_party_id is present', async () => {
    mockedPost.mockResolvedValueOnce({ data: { status: 'ok' } })

    const payload = {
      account: {
        account_number: '1234567890',
        bank_code: '000',
        bank: 'Test Bank',
        account_name: 'Jane Doe',
        amount: 500,
        inter_bank: true,
        counter_party_id: 'cp_456',
        pin: '1234',
        transfer_reference: 'ref-inter-bank-1',
        description: 'Inter bank transfer',
      },
    }

    await initiateFundTransfer(payload)

    expect(mockedPost).toHaveBeenCalledWith(
      '/accounts/initiate_fund_transfer',
      expect.objectContaining({
        account: expect.objectContaining({
          inter_bank: true,
          counter_party_id: 'cp_456',
        }),
      }),
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: 'application/json',
        }),
      })
    )
  })
})
