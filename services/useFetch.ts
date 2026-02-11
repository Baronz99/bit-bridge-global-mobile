import { useCallback, useEffect, useRef, useState } from 'react'

type AnyFn<T> = () => Promise<T>

const useFetch = <T>(fetchFunction: AnyFn<T>, autoFetch = true) => {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState<boolean>(autoFetch)
  const [error, setError] = useState<any>(null)

  // Prevent state updates after unmount
  const mountedRef = useRef(true)

  // Prevent request spam
  const inFlightRef = useRef(false)
  const queuedRefetchRef = useRef(false)
  const runFetchRef = useRef<null | (() => Promise<void>)>(null)

  // Ensure autoFetch runs once per mount (but can be refetched manually)
  const didAutoFetchRef = useRef(false)

  // Track current fetchFunction ref to avoid stale closures
  const fetchFnRef = useRef(fetchFunction)
  useEffect(() => {
    fetchFnRef.current = fetchFunction
    // if fetch function identity changes (token changed), allow autoFetch again
    didAutoFetchRef.current = false
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

      console.log('[FETCH ERROR]', {
        message,
        status,
        url,
        data: respData,
      })

      if (mountedRef.current) {
        // keep the original error object (axios) so we don't lose url/status
        err.message = message
        setError(err)
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
    if (!autoFetch) return
    if (didAutoFetchRef.current) return
    didAutoFetchRef.current = true
    fetchData()
  }, [autoFetch, fetchData])

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
