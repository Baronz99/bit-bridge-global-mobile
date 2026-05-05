import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import NotificationAlert from '@/components/notification'
import {
  getCircleGovernance,
  updateCircleGovernance,
} from '@/api/circles'
import { buildApiErrorMessage } from '@/utils/apiErrorMessage'

type NoticeState = { message: string | null; error: boolean; data: any | null }

const CircleGovernanceScreen = () => {
  const { id, fromCreate } = useLocalSearchParams<{ id?: string | string[]; fromCreate?: string | string[] }>()
  const circleId = Array.isArray(id) ? id[0] : id
  const cameFromCreate = (Array.isArray(fromCreate) ? fromCreate[0] : fromCreate) === '1'
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [payload, setPayload] = useState<Record<string, any> | null>(null)
  const [threshold, setThreshold] = useState(1)
  const [notice, setNotice] = useState<NoticeState>({ message: null, error: false, data: null })

  const loadGovernance = useCallback(async () => {
    if (!circleId) return
    setLoading(true)
    try {
      const response = await getCircleGovernance(circleId)
      const data = (response?.data ?? response) as Record<string, any>
      setPayload(data)
      const governance = (data?.governance ?? {}) as Record<string, any>
      const initialThreshold = Number(
        governance?.configured_withdrawal_approval_threshold ||
          governance?.required_withdrawal_approvals ||
          governance?.recommended_withdrawal_approval_threshold ||
          1
      )
      setThreshold(initialThreshold > 0 ? initialThreshold : 1)
    } catch (error: any) {
      const message = buildApiErrorMessage({
        status: error?.response?.status,
        data: error?.response?.data,
        fallback: 'Unable to load circle governance right now.',
      })
      setNotice({ message, error: true, data: null })
    } finally {
      setLoading(false)
    }
  }, [circleId])

  useEffect(() => {
    loadGovernance()
  }, [loadGovernance])

  const governance = useMemo(() => (payload?.governance ?? {}) as Record<string, any>, [payload])
  const managers = useMemo(() => (Array.isArray(payload?.managers) ? payload?.managers : []), [payload])
  const canManage = payload?.can_manage_governance === true
  const managerCount = Number(governance?.manager_count || 0)
  const maxThreshold = Math.max(Number(governance?.max_withdrawal_approval_threshold || 0), 1)
  const hasAdditionalAdmins = governance?.has_additional_admins === true
  const setupCompleted = governance?.governance_setup_completed === true

  const handleSave = async () => {
    if (!circleId || !canManage) return
    setSaving(true)
    setNotice({ message: null, error: false, data: null })
    try {
      const response = await updateCircleGovernance(circleId, {
        withdrawal_approval_threshold: threshold,
        governance_setup_completed: true,
      })
      const data = (response?.data ?? response) as Record<string, any>
      setPayload(data)
      setNotice({
        message: response?.message || 'Governance setup updated.',
        error: false,
        data: null,
      })
      if (cameFromCreate) {
        router.replace(`/circles/${circleId}` as any)
      }
    } catch (error: any) {
      const message = buildApiErrorMessage({
        status: error?.response?.status,
        data: error?.response?.data,
        fallback: 'Unable to update governance right now.',
      })
      setNotice({ message, error: true, data: null })
    } finally {
      setSaving(false)
    }
  }

  const inviteAdmin = () => {
    if (!circleId) return
    router.push(`/circles/${circleId}/invite` as any)
  }

  return (
    <View className="flex-1 bg-primary">
      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="small" color="#ffcc00" />
          <Text className="text-white mt-3">Loading governance...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          <View className="px-4 pt-8">
            <Text className="text-white text-2xl font-semibold">Governance setup</Text>
            <Text className="text-gray-400 text-sm mt-2">
              Choose the people who can help run this circle and how many approvals a withdrawal needs.
            </Text>
          </View>

          <View className="px-4 mt-4">
            <NotificationAlert message={notice.message} data={notice.data} error={notice.error} />
          </View>

          <View className="px-4 mt-4">
            <View className="rounded-2xl border border-gray-800 bg-gray-900/80 p-4">
              <Text className="text-white text-base font-semibold">Current setup</Text>
              <Text className="text-gray-400 text-xs mt-2">
                Managers now: {managerCount} {managerCount === 1 ? 'person' : 'people'}
              </Text>
              <Text className="text-gray-400 text-xs mt-1">
                Governance status: {setupCompleted ? 'completed' : 'needs setup'}
              </Text>
              <View className="mt-4 gap-2">
                {managers.map((manager: any) => (
                  <View
                    key={String(manager.membership_id || manager.user_id)}
                    className="rounded-xl border border-gray-800 bg-gray-950 px-3 py-3"
                  >
                    <Text className="text-white text-sm font-semibold" numberOfLines={1}>
                      {String(manager.display_name || 'Manager')}
                    </Text>
                    {manager.admin_identity_name || manager.fallback_name ? (
                      <Text className="text-gray-500 text-xs mt-1" numberOfLines={1}>
                        {String(manager.admin_identity_name || manager.fallback_name)}
                      </Text>
                    ) : null}
                    <Text className="text-gray-400 text-xs mt-1 uppercase">{String(manager.role || 'admin')}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          <View className="px-4 mt-4">
            <View className="rounded-2xl border border-sky-500/25 bg-sky-500/10 p-4">
              <Text className="text-white text-base font-semibold">Add another admin</Text>
              <Text className="text-sky-100 text-xs mt-2">
                Shared control only starts once this circle has more than one manager.
              </Text>
              <TouchableOpacity onPress={inviteAdmin} className="bg-app-primary px-4 py-3 rounded-full mt-4 items-center">
                <Text className="text-black text-xs font-semibold">
                  {hasAdditionalAdmins ? 'Invite more admins' : 'Invite an admin'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View className="px-4 mt-4">
            <View className="rounded-2xl border border-gray-800 bg-gray-900/80 p-4">
              <Text className="text-white text-base font-semibold">Withdrawal approvals</Text>
              {!hasAdditionalAdmins ? (
                <Text className="text-gray-400 text-xs mt-2">
                  Invite at least one additional admin first. Then you can set how many approvals a withdrawal needs.
                </Text>
              ) : (
                <>
                  <Text className="text-gray-400 text-xs mt-2">
                    Pick how many distinct managers must approve a withdrawal before funds move.
                  </Text>
                  <View className="flex-row items-center justify-between mt-4">
                    <TouchableOpacity
                      onPress={() => setThreshold((current) => Math.max(1, current - 1))}
                      disabled={!canManage}
                      className="h-11 w-11 rounded-full border border-gray-700 bg-gray-950 items-center justify-center"
                    >
                      <Text className="text-white text-lg font-semibold">-</Text>
                    </TouchableOpacity>
                    <View className="items-center">
                      <Text className="text-white text-2xl font-semibold">{threshold}</Text>
                      <Text className="text-gray-400 text-xs mt-1">approval{threshold === 1 ? '' : 's'} required</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setThreshold((current) => Math.min(maxThreshold, current + 1))}
                      disabled={!canManage}
                      className="h-11 w-11 rounded-full border border-gray-700 bg-gray-950 items-center justify-center"
                    >
                      <Text className="text-white text-lg font-semibold">+</Text>
                    </TouchableOpacity>
                  </View>
                  <Text className="text-gray-500 text-[11px] mt-3">
                    Maximum allowed right now: {maxThreshold}. Initiators still cannot approve their own withdrawal.
                  </Text>
                </>
              )}
            </View>
          </View>

          <View className="px-4 mt-6">
            <TouchableOpacity
              onPress={handleSave}
              disabled={!canManage || !hasAdditionalAdmins || saving}
              className={`py-4 rounded-2xl items-center ${!canManage || !hasAdditionalAdmins || saving ? 'bg-gray-700' : 'bg-app-primary'}`}
            >
              <Text className="text-black text-sm font-semibold">
                {saving ? 'Saving...' : 'Finish governance setup'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.replace(`/circles/${circleId}` as any)}
              className="py-4 rounded-2xl items-center mt-3 border border-gray-800"
            >
              <Text className="text-white text-sm">Back to circle</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </View>
  )
}

export default CircleGovernanceScreen
