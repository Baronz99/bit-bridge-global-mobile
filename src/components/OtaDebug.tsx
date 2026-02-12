import React from 'react'
import { Text, TouchableOpacity, View } from 'react-native'
import Constants from 'expo-constants'
import * as Updates from 'expo-updates'

type OtaDebugProps = {
  onForceCheck: () => void
  busy?: boolean
  status?: string | null
}

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

const OtaDebug = ({ onForceCheck, busy = false, status = null }: OtaDebugProps) => {
  const channel = String((Updates as any)?.channel || (Constants as any)?.easConfig?.channel || 'unknown')
  const updateId = String((Updates as any)?.updateId || 'embedded')
  const createdAtRaw = (Updates as any)?.createdAt || (Updates as any)?.manifest?.createdAt
  const createdAt = createdAtRaw ? String(createdAtRaw) : 'unknown'
  const isEmbeddedLaunch = String(Boolean((Updates as any)?.isEmbeddedLaunch))
  const runtimeVersion = stringifyRuntime()

  return (
    <View className="mt-4 rounded-2xl border border-amber-500/40 bg-amber-900/20 p-4">
      <Text className="text-amber-200 text-xs uppercase tracking-widest">OTA Debug</Text>
      <Text className="text-gray-200 text-xs mt-2">Channel: {channel}</Text>
      <Text className="text-gray-200 text-xs mt-1">Update ID: {updateId}</Text>
      <Text className="text-gray-200 text-xs mt-1">Created At: {createdAt}</Text>
      <Text className="text-gray-200 text-xs mt-1">Embedded Launch: {isEmbeddedLaunch}</Text>
      <Text className="text-gray-200 text-xs mt-1">Runtime: {runtimeVersion}</Text>

      <View className="mt-3">
        <Text className="text-amber-100 text-xs">
          {status || 'Use "Force OTA check" to fetch latest preview update.'}
        </Text>
      </View>

      <TouchableOpacity
        onPress={onForceCheck}
        disabled={busy}
        className={`mt-3 rounded-lg border px-3 py-2 ${busy ? 'border-gray-700 bg-gray-900/60' : 'border-amber-400/40 bg-amber-900/30'}`}
      >
        <Text className={`text-xs font-semibold ${busy ? 'text-gray-500' : 'text-amber-300'}`}>
          {busy ? 'Checking for update...' : 'Force OTA check'}
        </Text>
      </TouchableOpacity>
    </View>
  )
}

export default OtaDebug
