type Listener = (value: string | null) => void

let lastFatalError: string | null = null
const listeners = new Set<Listener>()

export const setLastFatalError = (value: string | null) => {
  lastFatalError = value
  for (const listener of listeners) listener(lastFatalError)
}

export const getLastFatalError = () => lastFatalError

export const subscribeLastFatalError = (listener: Listener) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

