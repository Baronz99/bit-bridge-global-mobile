import { useCallback, useEffect, useRef, useState } from 'react'
import { log } from '@/utils/logger'

type AnyFn<T> = () => Promise<T>
type QueryKey = unknown[]
type UseFetchOptions = {
  autoFetch?: boolean
  queryKey?: QueryKey
}

const querySubscriptions = new Map<string, Set<() => Promise<void>>>()

const normalizeQueryKey = (queryKey?: QueryKey) => {
  if (!Array.isArray(queryKey)) return []
  return queryKey
}

const serializeQueryKey = (queryKey?: QueryKey) => JSON.stringify(normalizeQueryKey(queryKey))

export const invalidateFetchQueries = async (
  predicate?: (queryKey: QueryKey) => boolean
) => {
  const tasks: Promise<void>[] = []

  for (const [key, subscribers] of querySubscriptions.entries()) {
    let parsed: QueryKey = []
    try {
      parsed = JSON.parse(key)
    } catch {
      parsed = []
    }
    if (predicate && !predicate(parsed)) continue
    subscribers.forEach((subscriber) => {
      tasks.push(subscriber().catch(() => undefined))
    })
  }

  await Promise.allSettled(tasks)
}

const useFetch = <T>(fetchFunction: AnyFn<T>, autoFetchOrOptions: boolean | UseFetchOptions = true) => {
  const autoFetch =
    typeof autoFetchOrOptions === 'boolean' ? autoFetchOrOptions : autoFetchOrOptions?.autoFetch ?? true
  const queryKey =
    typeof autoFetchOrOptions === 'boolean' ? [] : normalizeQueryKey(autoFetchOrOptions?.queryKey)
  const serializedQueryKey = serializeQueryKey(queryKey)
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState<boolean>(autoFetch)
  const [error, setError] = useState<any>(null)

  // Prevent state updates after unmount
  const mountedRef = useRef(true)

  // Prevent request spam
  const inFlightRef = useRef(false)
  const queuedRefetchRef = useRef(false)
  const runFetchRef = useRef<null | (() => Promise<void>)>(null)

  // Track current fetchFunction ref to avoid stale closures
  const fetchFnRef = useRef(fetchFunction)
  useEffect(() => {
    fetchFnRef.current = fetchFunction
  }, [fetchFunction])

  useEffect(() => {
    return () => {
      mountedRef.current = false
    }
  }, [])

  const fetchData = useCallback(async () => {
    if (inFlightRef.current) {
      queuedRefetchRef.current = true
      return
    }
    inFlightRef.current = true

    try {
      if (mountedRef.current) {
        setLoading(true)
        setError(null)
      }

      const result = await fetchFnRef.current()

      if (mountedRef.current) {
        setData(result)
      }
    } catch (err: any) {
      // Preserve axios metadata if present
      const message =
        err?.response?.data?.message ||
        err?.message ||
        'Something went wrong'

      const status = err?.response?.status
      const url = err?.config?.url
      const respData = err?.response?.data

      log('[FETCH ERROR]', {
        message,
        status,
        url,
        data: respData,
      })

      if (mountedRef.current) {
        // Keep axios metadata when available, but don't assume `err` is an object.
        const errorObject: any =
          err && typeof err === 'object'
            ? err
            : { raw: err }

        try {
          errorObject.message = message
        } catch {
          // ignore - extremely defensive; errorObject should always be mutable
        }

        setError(errorObject)
      }
    } finally {
      inFlightRef.current = false
      if (queuedRefetchRef.current && mountedRef.current) {
        queuedRefetchRef.current = false
        void runFetchRef.current?.()
      }
      if (mountedRef.current) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    runFetchRef.current = fetchData
  }, [fetchData])

  useEffect(() => {
    if (!serializedQueryKey || serializedQueryKey === '[]') return
    const subscribers = querySubscriptions.get(serializedQueryKey) || new Set<() => Promise<void>>()
    subscribers.add(fetchData)
    querySubscriptions.set(serializedQueryKey, subscribers)

    return () => {
      const existing = querySubscriptions.get(serializedQueryKey)
      if (!existing) return
      existing.delete(fetchData)
      if (existing.size === 0) querySubscriptions.delete(serializedQueryKey)
    }
  }, [fetchData, serializedQueryKey])

  useEffect(() => {
    if (!autoFetch) return
    void fetchData()
  }, [autoFetch, fetchData, serializedQueryKey])

  const reset = () => {
    setData(null)
    setLoading(false)
    setError(null)
  }

  return {
    data,
    loading,
    error,
    refetch: fetchData,
    reset,
  }
}

export default useFetch
