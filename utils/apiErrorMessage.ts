type ApiErrorMessageParams = {
  status?: number
  data?: Record<string, unknown> | null
  fallback?: string
}

export const apiErrorMessage = ({ status, data, fallback }: ApiErrorMessageParams) => {
  const message = String((data?.message as string) || fallback || 'Something went wrong')
  const normalizedMessage = String(message || '').toLowerCase()

  const cardholderPending =
    normalizedMessage.includes('cardholder verification is pending verification') ||
    normalizedMessage.includes('cardholder verification is manual review') ||
    normalizedMessage.includes('verification in progress')

  const cardholderFailed =
    normalizedMessage.includes('cardholder verification is failed') ||
    normalizedMessage.includes('verification failed')

  if (status === 403) return message

  if (status === 422) {
    if (cardholderPending) {
      return 'Cardholder verification is still in progress. Refresh status and retry once verified.'
    }
    if (cardholderFailed) {
      return 'Cardholder verification failed. Re-submit cardholder details to continue.'
    }
    const attempts = data?.attempts_remaining
    if (attempts !== undefined && attempts !== null) {
      return `${message} Attempts remaining: ${attempts}.`
    }
    return message
  }

  if (status === 429) {
    const retryAfter = data?.retry_after_seconds
    if (retryAfter !== undefined && retryAfter !== null) {
      return `${message} Try again in ${retryAfter}s.`
    }
    return message
  }

  return message
}

export const buildApiErrorMessage = apiErrorMessage
