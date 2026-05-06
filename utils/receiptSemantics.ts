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

const getCanonicalKind = (receipt: ReceiptDTO | null | undefined) => clean(receipt?.receipt_kind)
const getCanonicalType = (receipt: ReceiptDTO | null | undefined) => clean(receipt?.transaction_type || receipt?.event)

export const resolveReceiptSemantics = (receipt: ReceiptDTO | null | undefined): ReceiptSemantics => {
  const kind = getCanonicalKind(receipt)
  const txType = getCanonicalType(receipt)

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
