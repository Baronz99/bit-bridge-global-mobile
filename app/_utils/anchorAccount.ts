export const extractAccountNumber = (res: any): string => {
  if (!res) return ''
  const data = res.data ?? res
  return (
    data?.account_number ||
    data?.accountNumber ||
    data?.data?.account_number ||
    data?.data?.accountNumber ||
    ''
  )
}

export const hasDepositAccountNumber = (statusOrData: any): boolean => {
  if (!statusOrData) return false
  const data = statusOrData?.data ?? statusOrData
  const number = extractAccountNumber({ data })
  return Boolean(String(number || '').trim())
}

export const isKycAlreadyCompleted = (error: any): boolean => {
  const status = error?.response?.status ?? error?.status
  const message =
    error?.response?.data?.message ||
    error?.message ||
    ''
  return (
    status === 422 &&
    String(message).toLowerCase().includes('kyc already completed')
  )
}

export const getVirtualAccountPendingMessage = (
  hasAnchorAccount: boolean,
  hasAnchorKyc: boolean,
  accountNumber?: string
): string | null => {
  const number = String(accountNumber ?? '').trim()
  if (hasAnchorAccount && hasAnchorKyc && !number) {
    return 'Your virtual account is being set up. This may take a moment.'
  }
  return null
}

export const hasPersistedAccountNumber = (createResponse: any, refreshedResponse: any): boolean => {
  const created = extractAccountNumber(createResponse)
  const refreshed = extractAccountNumber(refreshedResponse)
  return Boolean(created && refreshed)
}

export const extractPrimaryError = (err: any): string | null => {
  const data = err?.response?.data || err?.data || err
  const errors = data?.errors
  if (Array.isArray(errors) && errors.length) return String(errors[0])
  return data?.message || err?.message || null
}
