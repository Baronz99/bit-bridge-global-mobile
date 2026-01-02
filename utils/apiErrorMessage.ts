type ApiErrorMessageParams = {
  status?: number
  data?: any
  fallback?: string
}

export const apiErrorMessage = ({ status, data, fallback }: ApiErrorMessageParams) => {
  const message = data?.message || fallback || 'Something went wrong'

  if (status === 403) return message

  if (status === 422) {
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
