export type TransferLifecycleState =
  | 'reserved'
  | 'pending_provider'
  | 'completed'
  | 'failed_refunded'
  | 'failed_reversal_pending'
  | 'failed_unrecovered'
  | 'released'
  | 'failed'
  | 'pending'
  | 'approved'
  | string

type LifecycleInput = {
  lifecycle_state?: unknown
  status?: unknown
  display_message?: unknown
}

type TransferLifecycleInfo = {
  state: TransferLifecycleState
  message: string
  shortLabel: string
  isSuccess: boolean
  isFailure: boolean
  isTerminal: boolean
}

const clean = (value?: unknown) => String(value ?? '').trim().toLowerCase()

const fallbackMessage = (state: string) => {
  switch (state) {
    case 'reserved':
      return 'Transfer initiated. Funds reserved.'
    case 'pending_provider':
      return 'Transfer submitted. Awaiting provider confirmation.'
    case 'completed':
      return 'Transfer completed.'
    case 'failed_refunded':
      return 'Transfer failed. Funds returned.'
    case 'failed_reversal_pending':
      return 'Transfer failed. Reversal in progress.'
    case 'failed_unrecovered':
      return 'Transfer failed. Reversal pending.'
    case 'released':
      return 'Transfer failed. Funds released.'
    case 'failed':
      return 'Transfer failed.'
    case 'timed_out':
    case 'timeout':
    case 'timedout':
      return 'Transfer timed out. Please check timeline or retry status.'
    default:
      return 'Transfer submitted. Awaiting confirmation.'
  }
}

const shortLabel = (state: string) => {
  switch (state) {
    case 'completed':
      return 'Successful'
    case 'reserved':
    case 'pending_provider':
    case 'pending':
      return 'Pending'
    case 'failed_refunded':
      return 'Failed (Refunded)'
    case 'failed_reversal_pending':
      return 'Failed (Reversal Pending)'
    case 'failed_unrecovered':
      return 'Failed (Action Needed)'
    case 'released':
      return 'Released'
    case 'failed':
      return 'Failed'
    case 'timed_out':
    case 'timeout':
    case 'timedout':
      return 'Timed out'
    default:
      return state || 'Pending'
  }
}

const normalizeState = (value: string): TransferLifecycleState => {
  if (!value) return 'pending'
  if (value === 'approved' || value === 'success' || value === 'successful' || value === 'paid') return 'completed'
  if (value === 'initialized' || value === 'processing' || value === 'in_progress' || value === 'queued') return 'pending_provider'
  if (value.includes('failed_refunded')) return 'failed_refunded'
  if (value.includes('failed_reversal_pending')) return 'failed_reversal_pending'
  if (value.includes('failed_unrecovered')) return 'failed_unrecovered'
  if (value.includes('pending_provider')) return 'pending_provider'
  if (value.includes('reserved')) return 'reserved'
  if (value.includes('released')) return 'released'
  if (value.includes('fail') || value.includes('declin') || value.includes('revers')) return 'failed'
  if (value.includes('complete')) return 'completed'
  if (value.includes('pending')) return 'pending'
  return value
}

export const resolveTransferLifecycle = (input: LifecycleInput): TransferLifecycleInfo => {
  const state = normalizeState(clean(input.lifecycle_state) || clean(input.status))
  const isSuccess = state === 'completed'
  const isFailure =
    state.startsWith('failed') ||
    state === 'released' ||
    state === 'timed_out' ||
    state === 'timeout' ||
    state === 'timedout'
  const isTerminal = isSuccess || isFailure
  const message = String(input.display_message || '').trim() || fallbackMessage(state)

  return {
    state,
    message,
    shortLabel: shortLabel(state),
    isSuccess,
    isFailure,
    isTerminal,
  }
}

