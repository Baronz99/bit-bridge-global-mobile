const DEBUG_PERF_FLAG = String(process.env.EXPO_PUBLIC_DEBUG_PERF || '').toLowerCase() === 'true'
const PERF_ENABLED = __DEV__ || DEBUG_PERF_FLAG

const now = () =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now()

const startedAt = new Map<string, number>()

const start = (label: string, meta?: Record<string, unknown>) => {
  if (!PERF_ENABLED) return
  startedAt.set(label, now())
  try {
    console.time(label)
  } catch {
    // no-op
  }
  if (meta) console.log('[PERF] start', { label, ...meta })
}

const end = (label: string, meta?: Record<string, unknown>) => {
  if (!PERF_ENABLED) return
  const startAt = startedAt.get(label)
  const durationMs = startAt ? now() - startAt : undefined
  try {
    console.timeEnd(label)
  } catch {
    // no-op
  }
  console.log('[PERF] end', {
    label,
    duration_ms: typeof durationMs === 'number' ? Number(durationMs.toFixed(1)) : undefined,
    ...meta,
  })
  startedAt.delete(label)
}

const mark = (label: string, meta?: Record<string, unknown>) => {
  if (!PERF_ENABLED) return
  console.log('[PERF] mark', { label, ...meta })
}

const enabled = () => PERF_ENABLED

const PerfTrace = { start, end, mark, enabled }

export default PerfTrace

