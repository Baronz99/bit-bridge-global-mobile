// src/api/cards.ts (MOBILE) — aligned with Web + Backend PCI reveal endpoint
import client from '@/api/client'

type Id = string | number

const pickMsg = (data: any) => {
  if (!data) return null
  return (
    data?.message ||
    data?.error ||
    data?.status?.message ||
    data?.status?.error ||
    data?.errors?.[0] ||
    null
  )
}

const errMsg = (err: any, fallback = 'Something went wrong') => {
  const data = err?.response?.data
  return pickMsg(data) || err?.message || fallback
}

/**
 * Cards list (your existing route)
 */
export const getUserCards = async () => {
  try {
    const res = await client.get('/cards/user_card')
    return res.data
  } catch (err: any) {
    throw new Error(errMsg(err, 'Failed to fetch cards'))
  }
}

/**
 * Card detail / balance / history (your existing routes)
 */
export const getCardDetails = async (id: Id) => {
  try {
    const res = await client.get(`/cards/${id}/details`)
    return res.data
  } catch (err: any) {
    throw new Error(errMsg(err, 'Failed to fetch card details'))
  }
}

export const getCardBalance = async (id: Id) => {
  try {
    const res = await client.get(`/cards/${id}/balance`)
    return res.data
  } catch (err: any) {
    throw new Error(errMsg(err, 'Failed to fetch card balance'))
  }
}

export const getCardHistory = async (id: Id) => {
  try {
    const res = await client.get(`/cards/${id}/history`)
    return res.data
  } catch (err: any) {
    throw new Error(errMsg(err, 'Failed to fetch card history'))
  }
}

/**
 * ✅ PCI Reveal (NEW)
 * Backend controller: POST /api/v1/pci/cards/:id/reveal
 * Requires: card.transaction_pin (or card.pin) in body
 *
 * IMPORTANT: do not persist response anywhere (PAN/CVV).
 */
export const revealCard = async (id: string | number, transaction_pin: string) => {
  try {
    const res = await client.post(`/pci/cards/${id}/reveal`, {
      card: { transaction_pin },
    })
    return res.data
  } catch (err: any) {
    throw new Error(errMsg(err, 'Failed to reveal card'))
  }
}


/**
 * Freeze / Unfreeze (your existing routes)
 */
export const freezeCard = async (id: Id) => {
  try {
    const res = await client.patch(`/cards/${id}/freeze`)
    return res.data
  } catch (err: any) {
    throw new Error(errMsg(err, 'Failed to freeze card'))
  }
}

export const unfreezeCard = async (id: Id) => {
  try {
    const res = await client.patch(`/cards/${id}/unfreeze`)
    return res.data
  } catch (err: any) {
    throw new Error(errMsg(err, 'Failed to unfreeze card'))
  }
}

/**
 * ✅ Fund / Unload wallet (aligned to web style payload)
 * Web uses: { card: { card_id, amount, currency:'USD', wallet_type:'usd', transaction_pin } }
 * If your backend accepts currency/wallet_type optionally, this still works.
 */
export const fundCard = async (payload: {
  card_id: Id
  amount: number
  transaction_pin: string
  currency?: string
  wallet_type?: string
}) => {
  try {
    const res = await client.post('/cards/fund_wallet', {
      card: {
        card_id: payload.card_id,
        amount: payload.amount,
        currency: payload.currency || 'USD',
        wallet_type: payload.wallet_type || 'usd',
        transaction_pin: payload.transaction_pin,
      },
    })
    return res.data
  } catch (err: any) {
    throw new Error(errMsg(err, 'Failed to fund card'))
  }
}

export const unloadCard = async (payload: {
  card_id: Id
  amount: number
  transaction_pin: string
  currency?: string
  wallet_type?: string
}) => {
  try {
    const res = await client.post('/cards/unload_wallet', {
      card: {
        card_id: payload.card_id,
        amount: payload.amount,
        currency: payload.currency || 'USD',
        wallet_type: payload.wallet_type || 'usd',
        transaction_pin: payload.transaction_pin,
      },
    })
    return res.data
  } catch (err: any) {
    throw new Error(errMsg(err, 'Failed to unload card'))
  }
}

/**
 * Cardholder + Create card (keep as-is unless backend expects {card: {...}})
 * If your backend expects envelope, tell me and I’ll align these too.
 */
export const registerCardholder = async (payload: {
  first_name: string
  last_name: string
  email: string
  phone_number: string
  address_line1?: string
  city?: string
  state?: string
  postal_code?: string
  country?: string
  registration_mode?: 'async' | 'sync'
  id_type?: string
  bvn?: string
  selfie_image?: string
  id_no?: string
  id_image?: string
}) => {
  try {
    const res = await client.post('/cards/register_cardholder', { card: payload })
    return res.data
  } catch (err: any) {
    throw new Error(errMsg(err, 'Failed to register cardholder'))
  }
}

export const createCard = async (payload: {
  cardholder_id?: Id
  currency?: string
  wallet_type?: string
  card_limit?: string
  transaction_pin?: string
  card_pin?: string
}) => {
  try {
    const res = await client.post('/cards/create_card', { card: payload })
    return res.data
  } catch (err: any) {
    throw new Error(errMsg(err, 'Failed to create card'))
  }
}
