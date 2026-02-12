import React, { useCallback, useMemo, useState } from 'react'
import { Text, TouchableOpacity, View } from 'react-native'
import Constants from 'expo-constants'
import * as Updates from 'expo-updates'

const stringifyRuntime = () => {
  const runtimeFromUpdates = (Updates as any)?.runtimeVersion
  if (runtimeFromUpdates) return String(runtimeFromUpdates)

  const runtimeFromManifest2 = (Constants as any)?.manifest2?.runtimeVersion
  if (runtimeFromManifest2) return String(runtimeFromManifest2)

  const runtimeFromConfig = (Constants.expoConfig as any)?.runtimeVersion
  if (typeof runtimeFromConfig === 'string') return runtimeFromConfig
  if (runtimeFromConfig?.policy) return `policy:${String(runtimeFromConfig.policy)}`
  return 'unknown'
}

const OtaDebug = () => {
  const channel = String((Updates as any)?.channel || (Constants as any)?.easConfig?.channel || 'unknown')
  const buildProfile = String(
    (Constants.expoConfig as any)?.extra?.eas?.buildProfile || (Constants as any)?.easConfig?.buildProfile || ''
  )
  const updateId = String((Updates as any)?.updateId || 'embedded')
  const createdAtRaw = (Updates as any)?.createdAt || (Updates as any)?.manifest?.createdAt
  const createdAt = createdAtRaw ? String(createdAtRaw) : 'unknown'
  const isEmbeddedLaunch = String(Boolean((Updates as any)?.isEmbeddedLaunch))
  const runtimeVersion = stringifyRuntime()
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string>('Tap "Check & Apply Update" to test OTA.')

  const shouldRender = useMemo(() => __DEV__ || channel === 'preview' || buildProfile === 'preview', [channel, buildProfile])
  const previewChannel = channel === 'preview' ? channel : `non-preview (${channel})`

  const handleCheckAndApply = useCallback(async () => {
    if (busy) return
    setBusy(true)
    setStatus('Checking for update...')
    try {
      const update = await Updates.checkForUpdateAsync()
      if (!update.isAvailable) {
        setStatus('No update available for this runtime/channel.')
        return
      }
      setStatus('Update available. Fetching...')
      await Updates.fetchUpdateAsync()
      setStatus('Update fetched. Reloading app...')
      await Updates.reloadAsync()
    } catch (error: any) {
      setStatus(`Update failed: ${String(error?.message || 'Unknown error')}`)
    } finally {
      setBusy(false)
    }
  }, [busy])

  if (!shouldRender) return null

  return (
    <View className="mt-4 rounded-2xl border border-amber-500/40 bg-amber-900/20 p-4">
      <Text className="text-amber-200 text-xs uppercase tracking-widest">OTA Debug</Text>
      <Text className="text-gray-200 text-xs mt-2">Preview channel: {previewChannel}</Text>
      <Text className="text-gray-200 text-xs mt-1">Channel: {channel}</Text>
      <Text className="text-gray-200 text-xs mt-1">Update ID: {updateId}</Text>
      <Text className="text-gray-200 text-xs mt-1">Created At: {createdAt}</Text>
      <Text className="text-gray-200 text-xs mt-1">Embedded Launch: {isEmbeddedLaunch}</Text>
      <Text className="text-gray-200 text-xs mt-1">Runtime: {runtimeVersion}</Text>

      <View className="mt-3">
        <Text className="text-amber-100 text-xs">{status}</Text>
      </View>

      <TouchableOpacity
        onPress={handleCheckAndApply}
        disabled={busy}
        className={`mt-3 rounded-lg border px-3 py-2 ${busy ? 'border-gray-700 bg-gray-900/60' : 'border-amber-400/40 bg-amber-900/30'}`}
      >
        <Text className={`text-xs font-semibold ${busy ? 'text-gray-500' : 'text-amber-300'}`}>
          {busy ? 'Checking for update...' : 'Check & Apply Update'}
        </Text>
      </TouchableOpacity>
    </View>
  )
}

export default OtaDebug
