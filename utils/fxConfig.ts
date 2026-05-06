export type Direction = 'ngn_to_usd' | 'usd_to_ngn'

export type WalletShape = {
  data?: {
    bridge?: { balance?: number | string; amount?: number | string } | null
    tunnel?: { balance?: number | string; amount?: number | string } | null
    data?: {
      bridge?: { balance?: number | string; amount?: number | string } | null
      tunnel?: { balance?: number | string; amount?: number | string } | null
    }
  }
}

export const fxCardClass = 'rounded-[30px] border border-[#5C3913] bg-[#130B05]'
export const fxPanelClass = 'rounded-[24px] bg-[#181008]'
export const fxSoftPanelClass = 'rounded-[22px] bg-[#1D130A]'

export const resolveDirection = (value: unknown): Direction => {
  const raw = String(value || '').trim().toLowerCase()
  if (raw === 'usd-to-ngn' || raw === 'usd_to_ngn') return 'usd_to_ngn'
  return 'ngn_to_usd'
}

export const directionConfig = {
  ngn_to_usd: {
    title: 'Convert NGN to USD',
    summary: 'Bridge to Tunnel',
    body: 'Convert NGN to USD instantly.',
    sourceRail: 'Bridge',
    destinationRail: 'Tunnel',
    sourceCurrencyLabel: 'NGN',
    destinationCurrencyLabel: 'USD',
    inputLabel: 'Enter NGN amount',
    inputName: 'amount_ngn',
    placeholder: '0.00',
    sourceCurrency: 'NGN' as const,
    destinationCurrency: 'USD' as const,
    sourceBalanceLabel: 'Bridge balance',
    destinationBalanceLabel: 'Tunnel balance',
    activationTitle: 'Open your USD rail first',
    activationBody: 'Activate Tunnel to receive USD, hold a live balance, and convert without leaving this flow.',
    activationLead: 'Tunnel activation required',
    convertButton: 'Review conversion',
    pinTitle: 'Enter PIN to Convert',
    receiveHelp: 'Settles into Tunnel.',
    emptyHelp: 'Live rate. Final amount confirmed before execution.',
    loadingHelp: 'Refreshing your live quote.',
    successBalanceLabel: 'Tunnel balance',
    successCurrency: 'USD' as const,
    rateLabel: '1 USD',
    destinationLead: 'You receive',
    sourceLead: 'You pay',
  },
  usd_to_ngn: {
    title: 'Convert USD to NGN',
    summary: 'Tunnel to Bridge',
    body: 'Convert USD back into NGN instantly.',
    sourceRail: 'Tunnel',
    destinationRail: 'Bridge',
    sourceCurrencyLabel: 'USD',
    destinationCurrencyLabel: 'NGN',
    inputLabel: 'Enter USD amount',
    inputName: 'amount_usd',
    placeholder: '0.00',
    sourceCurrency: 'USD' as const,
    destinationCurrency: 'NGN' as const,
    sourceBalanceLabel: 'Tunnel balance',
    destinationBalanceLabel: 'Bridge balance',
    activationTitle: 'Activate Tunnel before moving USD out',
    activationBody: 'Tunnel holds your USD balance. Activate it first to fund, view, and convert back into Bridge.',
    activationLead: 'Tunnel activation required',
    convertButton: 'Review conversion',
    pinTitle: 'Enter PIN to Convert',
    receiveHelp: 'Settles into Bridge.',
    emptyHelp: 'Live rate. Final amount confirmed before execution.',
    loadingHelp: 'Refreshing your live quote.',
    successBalanceLabel: 'Bridge balance',
    successCurrency: 'NGN' as const,
    rateLabel: '1 USD',
    destinationLead: 'You receive',
    sourceLead: 'You pay',
  },
} as const

export type DirectionCopy = (typeof directionConfig)[Direction]
