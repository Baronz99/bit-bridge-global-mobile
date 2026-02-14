import { useCallback, useMemo } from 'react'
import useFetch from '@/services/useFetch'
import {
  availabilityMapFrom,
  getServiceAvailability,
  makeServiceAvailabilityKey,
  ServiceAvailabilityRow,
  unknownAvailability,
} from '@/api/serviceAvailability'

export const useServiceAvailability = () => {
  const fetcher = useCallback(() => getServiceAvailability(), [])
  const { data, loading, error, refetch } = useFetch(fetcher)

  const map = useMemo(() => availabilityMapFrom(data?.services), [data?.services])

  const getStatus = useCallback(
    ({ provider, biller, serviceType, label }: { provider?: any; biller?: any; serviceType?: any; label?: string }): ServiceAvailabilityRow => {
      const key = makeServiceAvailabilityKey({ provider, biller, serviceType })
      if (!key) return unknownAvailability(label || 'Status unavailable')
      return map.get(key.toUpperCase()) || unknownAvailability(label || key)
    },
    [map]
  )

  return {
    data,
    loading,
    error,
    refetch,
    getStatus,
  }
}

export default useServiceAvailability
