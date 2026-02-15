const debugFlag = String(process.env.EXPO_PUBLIC_DEBUG || '').trim()

export const DEBUG_ENABLED = __DEV__ || debugFlag === '1'

export const log = (...args: unknown[]) => {
  if (!DEBUG_ENABLED) return
  console.log(...args)
}

export const warn = (...args: unknown[]) => {
  if (!DEBUG_ENABLED) return
  console.warn(...args)
}

export const error = (...args: unknown[]) => {
  if (!DEBUG_ENABLED) return
  console.error(...args)
}

