import type { ReceiptDTO } from '@/components/finance/types'

export type ReceiptSemantics = {
  kind: string
  headerTitle: string
  panelTitle: string
  primaryLabel: string
  showBeneficiary: boolean
  showServiceDetails: boolean
}

const clean = (value: unknown) => String(value ?? '').trim().toLowerCase()

const getCanonicalKind = (receipt: ReceiptDTO | null | undefined) =>
  clean(receipt?.receipt_kind || receipt?.receipt_category || receipt?.meta?.receipt_category)
const getCanonicalType = (receipt: ReceiptDTO | null | undefined) => clean(receipt?.transaction_type || receipt?.event)
const getCanonicalDestinationType = (receipt: ReceiptDTO | null | undefined) =>
  clean(
    receipt?.destination_type ||
      receipt?.meta?.destination_type ||
      receipt?.details?.destination_type ||
      receipt?.beneficiary?.destination_type ||
      receipt?.parties?.destination_type
  )

export const resolveReceiptSemantics = (receipt: ReceiptDTO | null | undefined): ReceiptSemantics => {
  const kind = getCanonicalKind(receipt)
  const txType = getCanonicalType(receipt)
  const destinationType = getCanonicalDestinationType(receipt)

  if (kind === 'treasury_payout') {
    return {
      kind,
      headerTitle: 'Treasury payout receipt',
      panelTitle: 'Treasury payout',
      primaryLabel: 'Total debited',
      showBeneficiary: true,
      showServiceDetails: false,
    }
  }

  if (kind === 'bank_payout' || (destinationType === 'bank_account' && txType === 'withdrawal')) {
    return {
      kind: kind || 'bank_payout',
      headerTitle: 'Bank payout receipt',
      panelTitle: 'Bank payout',
      primaryLabel: 'Total debited',
      showBeneficiary: true,
      showServiceDetails: false,
    }
  }

  if (kind === 'member_refund') {
    return {
      kind,
      headerTitle: 'Member refund receipt',
      panelTitle: 'Member refund',
      primaryLabel: 'Total debited',
      showBeneficiary: true,
      showServiceDetails: false,
    }
  }

  if (kind === 'internal_wallet_withdrawal' || (kind === 'wallet' && txType === 'withdrawal' && destinationType === 'internal_wallet')) {
    return {
      kind: kind || 'internal_wallet_withdrawal',
      headerTitle: 'Wallet withdrawal receipt',
      panelTitle: 'Wallet withdrawal',
      primaryLabel: 'Amount withdrawn',
      showBeneficiary: false,
      showServiceDetails: false,
    }
  }

  if (kind === 'transfer_outbound' || kind === 'transfer') {
    return {
      kind: kind || 'transfer_outbound',
      headerTitle: 'Transfer receipt',
      panelTitle: 'Transfer details',
      primaryLabel: 'Total debited',
      showBeneficiary: true,
      showServiceDetails: false,
    }
  }

  if (kind === 'transfer_inbound') {
    return {
      kind,
      headerTitle: 'Incoming transfer receipt',
      panelTitle: 'Funding details',
      primaryLabel: 'Amount credited',
      showBeneficiary: false,
      showServiceDetails: false,
    }
  }
  if (kind === 'electricity') {
    return {
      kind,
      headerTitle: 'Electricity receipt',
      panelTitle: 'Electricity payment',
      primaryLabel: 'Amount paid',
      showBeneficiary: false,
      showServiceDetails: true,
    }
  }

  if (kind === 'data') {
    return {
      kind,
      headerTitle: 'Data receipt',
      panelTitle: 'Data purchase',
      primaryLabel: 'Amount paid',
      showBeneficiary: false,
      showServiceDetails: true,
    }
  }

  if (kind === 'airtime') {
    return {
      kind,
      headerTitle: 'Airtime receipt',
      panelTitle: 'Airtime purchase',
      primaryLabel: 'Amount paid',
      showBeneficiary: false,
      showServiceDetails: true,
    }
  }

  if (kind === 'bill') {
    return {
      kind,
      headerTitle: 'Bill payment receipt',
      panelTitle: 'Bill payment',
      primaryLabel: 'Amount paid',
      showBeneficiary: false,
      showServiceDetails: true,
    }
  }

  if (kind === 'wallet') {
    if (txType === 'deposit') {
      return {
        kind,
        headerTitle: 'Wallet funding receipt',
        panelTitle: 'Funding details',
        primaryLabel: 'Amount funded',
        showBeneficiary: false,
        showServiceDetails: false,
      }
    }

    if (txType === 'withdrawal') {
      return {
        kind,
        headerTitle: 'Withdrawal receipt',
        panelTitle: 'Withdrawal details',
        primaryLabel: 'Amount withdrawn',
        showBeneficiary: false,
        showServiceDetails: false,
      }
    }
  }

  if (kind === 'card') {
    return {
      kind,
      headerTitle: 'Card receipt',
      panelTitle: 'Card transaction',
      primaryLabel: 'Amount',
      showBeneficiary: false,
      showServiceDetails: false,
    }
  }

  if (kind === 'circle') {
    return {
      kind,
      headerTitle: 'Circle receipt',
      panelTitle: 'Circle activity',
      primaryLabel: 'Amount',
      showBeneficiary: false,
      showServiceDetails: false,
    }
  }

  return {
    kind: kind || 'transaction',
    headerTitle: 'Transaction receipt',
    panelTitle: 'Transaction details',
    primaryLabel: 'Amount',
    showBeneficiary: false,
    showServiceDetails: false,
  }
}
