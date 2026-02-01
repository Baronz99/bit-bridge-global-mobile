import React, { useCallback, useEffect, useState } from 'react'
import { Text, TouchableOpacity, View } from 'react-native'
import Loader from '@/components/Loader'
import NotificationAlert from '@/components/notification'
import { getUserCardTokens, updateCardToken } from '@/api/cardTokens'
import { useAuth } from '@/services/useAuth'
import { buildApiErrorMessage } from '@/utils/apiErrorMessage'

type NoticeState = { message: string | null; error: boolean; data: any | null }

type TokenRecord = Record<string, any>

const extractTokens = (payload: unknown): TokenRecord[] => {
  if (payload && typeof payload === 'object') {
    const container = payload as Record<string, any>
    const list =
      container.data?.tokens ||
      container.data?.data ||
      container.data ||
      container.tokens ||
      container.items ||
      []
    return Array.isArray(list) ? list : []
  }
  return []
}

const getTokenStatus = (token: TokenRecord) => {
  const status = String(token?.status || token?.state || '').toLowerCase()
  if (status) return status
  if (token?.active === true) return 'active'
  if (token?.active === false) return 'inactive'
  return 'unknown'
}

const SavedCardTokensScreen = () => {
  const { onLogout } = useAuth()
  const [loading, setLoading] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | number | null>(null)
  const [tokens, setTokens] = useState<TokenRecord[]>([])
  const [notice, setNotice] = useState<NoticeState>({
    message: null,
    error: false,
    data: null })

  const loadTokens = useCallback(async () => {
    setLoading(true)
    setNotice({ message: null, error: false, data: null })
    try {
      const response = await getUserCardTokens()
      setTokens(extractTokens(response))
    } catch (error: any) {
      const status = error?.response?.status
      if (status === 401) {
        await onLogout().catch(() => {})
        return
      }
      const message = buildApiErrorMessage({
        status,
        data: error?.response?.data,
        fallback: error?.message || 'Unable to load card tokens' })
      setNotice({ message, error: true, data: null })
    } finally {
      setLoading(false)
    }
  }, [onLogout])

  useEffect(() => {
    loadTokens()
  }, [loadTokens])

  const handleToggle = async (token: TokenRecord) => {
    const tokenId = token?.id || token?.token_id || token?.uuid
    if (!tokenId) return
    const currentStatus = getTokenStatus(token)
    const nextActive = currentStatus !== 'active'
    setUpdatingId(tokenId)
    try {
      const response = await updateCardToken(tokenId, {
        active: nextActive,
        status: nextActive ? 'active' : 'inactive' })
      const payload: any = response
      const updated = payload?.data ?? payload
      setTokens((prev) =>
        prev.map((item) => (item === token ? { ...item, ...updated } : item))
      )
      setNotice({
        message: payload?.message || 'Token updated.',
        error: false,
        data: payload?.data || null })
    } catch (error: any) {
      const status = error?.response?.status
      if (status === 401) {
        await onLogout().catch(() => {})
        return
      }
      const message = buildApiErrorMessage({
        status,
        data: error?.response?.data,
        fallback: error?.message || 'Unable to update token' })
      setNotice({ message, error: true, data: null })
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <View className="flex-1 bg-primary px-4">
      <View className="pt-10">
        <Text className="text-white text-2xl mb-2">Saved Cards</Text>
        <Text className="text-gray-300 mb-6">Manage your saved card tokens.</Text>

        <NotificationAlert message={notice.message} data={notice.data} error={notice.error} />

        {tokens.length === 0 && !loading ? (
          <View className="bg-gray-900 p-4 rounded-xl">
            <Text className="text-gray-300 text-center">No saved cards found.</Text>
          </View>
        ) : (
          <View className="gap-3">
            {tokens.map((token, index) => {
              const key = String(token?.id ?? token?.token_id ?? `token-${index}`)
              const last4 = token?.last4 || token?.last_4 || token?.card_last4 || '****'
              const brand = token?.brand || token?.card_brand || token?.scheme || 'Card'
              const status = getTokenStatus(token)
              const isUpdating = updatingId === (token?.id || token?.token_id || token?.uuid)
              return (
                <View key={key} className="bg-gray-900 p-4 rounded-xl">
                  <View className="flex-row justify-between items-center">
                    <Text className="text-white font-semibold">{brand}</Text>
                    <Text className="text-gray-300 text-xs">{status}</Text>
                  </View>
                  <Text className="text-gray-400 text-xs mt-2">**** **** **** {last4}</Text>
                  <TouchableOpacity
                    onPress={() => handleToggle(token)}
                    disabled={isUpdating}
                    className={`mt-3 px-3 py-2 rounded-lg self-start ${
                      status === 'active' ? 'bg-gray-800' : 'bg-theme-primary'
                    }`}
                  >
                    <Text className="text-white text-xs">
                      {status === 'active' ? 'Deactivate' : 'Activate'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )
            })}
          </View>
        )}

        <TouchableOpacity
          onPress={loadTokens}
          className="bg-gray-900 py-4 mt-5 rounded-xl"
        >
          <Text className="text-white text-center">Refresh</Text>
        </TouchableOpacity>
      </View>

      <Loader open={loading} />
    </View>
  )
}

export default SavedCardTokensScreen



