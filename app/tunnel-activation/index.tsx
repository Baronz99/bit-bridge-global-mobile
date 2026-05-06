import React, { useState } from 'react'
import { ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useActiveAccount } from '@/services/useActiveAccount'
import { activateTunnel } from '@/api/wallet'
import Loader from '@/components/Loader'
import NotificationAlert from '@/components/notification'
import { apiErrorMessage } from '@/utils/apiErrorMessage'

type NoticeState = {
  message: string | null
  error: boolean
  data: any | null
}

const TunnelActivationScreen = () => {
  const router = useRouter()
  const { activeAccount } = useActiveAccount()
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState<NoticeState>({
    message: null,
    error: false,
    data: null,
  })

  const handleError = async (error: any) => {
    const status = error?.response?.status
    if (status === 401) return

    const data = error?.response?.data
    const message = apiErrorMessage({
      status,
      data,
      fallback: error?.message || 'Something went wrong',
    })
    setNotice({ message, error: true, data: null })
  }

  const handleActivate = async () => {
    setLoading(true)
    setNotice({ message: null, error: false, data: null })
    try {
      const response = await activateTunnel()
      setNotice({
        message: response?.message || 'Tunnel activated successfully.',
        error: false,
        data: response?.data || null,
      })
    } catch (error: any) {
      await handleError(error)
    } finally {
      setLoading(false)
    }
  }

  const activated = Boolean(notice.message && !notice.error)
  const isBusinessAccount = activeAccount?.type === 'business'
  const isCircleAccount = activeAccount?.type === 'circle'
  if (isBusinessAccount || isCircleAccount) {
    const title = isBusinessAccount
      ? 'Tunnel activation belongs to personal context'
      : 'Tunnel is unavailable in circle context'
    const body = isBusinessAccount
      ? 'Your business account already has its own operating surface. Switch to Personal when you want Tunnel, USD conversion, and cards.'
      : 'Circle context supports contributions, dues, and shared activity. Tunnel activation stays in personal context.'
    return (
      <View className="flex-1 bg-[#070A12] px-4">
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
          <View className="pt-10">
            <View className="rounded-[28px] border border-[#6A4316] bg-[#1A0F05] px-5 pb-5 pt-6">
              <Text className="text-[11px] uppercase tracking-[2px] text-[#FFB347]/85">Tunnel FX</Text>
              <Text className="mt-2 text-[28px] font-semibold text-[#FFF7ED]">{title}</Text>
              <Text className="mt-2 text-[14px] leading-6 text-[#F6E7D2]">{body}</Text>
              <TouchableOpacity
                onPress={() => router.replace(isBusinessAccount ? '/business' : (`/circles/${activeAccount?.circleId}` as any))}
                className="mt-6 rounded-[18px] bg-[#FF8A1F] py-5"
              >
                <Text className="text-center text-[15px] font-semibold text-[#FFF7ED]">
                  {isBusinessAccount ? 'Open business home' : 'Open circle'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </View>
    )
  }
  return (    <View className="flex-1 bg-[#070A12] px-4">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        <View className="pt-10">
          <View className="rounded-[28px] border border-[#6A4316] bg-[#1A0F05] px-5 pb-5 pt-6">
            <Text className="text-[11px] uppercase tracking-[2px] text-[#FFB347]/85">Tunnel FX</Text>
            <Text className="mt-2 text-[28px] font-semibold text-[#FFF7ED]">Activate Tunnel</Text>
            <Text className="mt-2 text-[14px] leading-6 text-[#F6E7D2]">
              Tunnel gives you a USD rail for conversion, global balance visibility, and card funding. Activate it once, then move between Bridge and Tunnel with live quotes.
            </Text>

            <View className="mt-5 rounded-[18px] border border-[#4A3012] bg-[#120B04] px-4 py-4">
              <Text className="text-[12px] font-medium uppercase tracking-[1.5px] text-[#FFB347]/82">What you unlock</Text>
              <Text className="mt-3 text-[13px] text-[#FFF7ED]">? Convert NGN to USD with live quotes</Text>
              <Text className="mt-2 text-[13px] text-[#FFF7ED]">? Hold a visible USD balance in Tunnel</Text>
              <Text className="mt-2 text-[13px] text-[#FFF7ED]">? Fund Tunnel-linked card activity</Text>
            </View>

            <TouchableOpacity
              onPress={handleActivate}
              className="mt-6 rounded-[18px] bg-[#FF8A1F] py-5"
              disabled={loading}
            >
              <Text className="text-center text-[15px] font-semibold text-[#FFF7ED]">
                {loading ? 'Activating Tunnel...' : 'Activate Tunnel'}
              </Text>
            </TouchableOpacity>
          </View>

          {notice.message ? (
            <View className="mt-4">
              <NotificationAlert message={notice.message} data={notice.data} error={notice.error} />
            </View>
          ) : null}

          <View className="mt-5 rounded-[22px] border border-[#4A3012] bg-[#120B04] px-4 py-4">
            <Text className="text-[12px] font-medium uppercase tracking-[1.5px] text-[#FFB347]/82">Next step</Text>
            <Text className="mt-2 text-[13px] leading-6 text-[#E8D7C1]">
              {activated
                ? 'Tunnel is ready. Choose the direction you want to move money next.'
                : 'After activation, return here or jump straight into a conversion flow.'}
            </Text>

            <View className="mt-4 flex-row gap-3">
              <TouchableOpacity
                onPress={() => router.push({ pathname: '/fx', params: { direction: 'ngn-to-usd' } })}
                className="flex-1 rounded-[16px] border border-[#5B3A14] py-4"
              >
                <Text className="text-center text-[14px] font-semibold text-[#FFF7ED]">NGN to USD</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push({ pathname: '/fx', params: { direction: 'usd-to-ngn' } })}
                className="flex-1 rounded-[16px] border border-[#5B3A14] py-4"
              >
                <Text className="text-center text-[14px] font-semibold text-[#FFF7ED]">USD to NGN</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
      <Loader open={loading} />
    </View>
  )
}

export default TunnelActivationScreen
