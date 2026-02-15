import { error as loggerError, log as loggerLog, warn as loggerWarn } from '@/utils/logger'

export const log = (...args: unknown[]) => {
  loggerLog(...args)
}

export const warn = (...args: unknown[]) => {
  loggerWarn(...args)
}

export const error = (...args: unknown[]) => {
  loggerError(...args)
}
