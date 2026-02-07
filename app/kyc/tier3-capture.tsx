import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Image, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { useRouter } from 'expo-router'
import { startTier3, getTier3Status } from '@/api/kyc'
import { useAuth } from '@/services/useAuth'
import * as ImagePicker from 'expo-image-picker'

const prettyTier3Error = (value?: string) => {
  const msg = (value || '').toLowerCase()
  if (!msg) return 'Liveness failed. Please try again in good lighting.'
  if (msg.includes('payload too large')) return 'Image is too large. Try a smaller photo.'
  if (msg.includes('temporarily unavailable')) return 'Service is temporarily unavailable. Try again later.'
  if (msg.includes('confidence')) return 'Face not clear enough. Retake with better lighting.'
  if (msg.includes('bvn must be verified')) return 'BVN must be verified before Tier 3.'
  return 'Liveness failed. Please retry with a clear selfie.'
}

// 2MB backend limit; base64 is ~4/3 of binary. Guard at ~1.8MB base64 length.
const MAX_BASE64_LEN = Math.floor(1.8 * 1024 * 1024 * (4 / 3))

type Tier3State = 'idle' | 'pending' | 'processing' | 'verified' | 'failed' | 'error'

const extractApiErrorMessage = (error: any) =>
  error?.response?.data?.error ||
  error?.response?.data?.message ||
  error?.message ||
  'Unable to continue. Please retry.'

const normalizeTier3State = (res: any): Tier3State => {
  const topStatus = res?.status
  if (typeof topStatus === 'string') {
    const s = topStatus.toLowerCase()
    if (s === 'verified' || s === 'success' || s === 'successful') return 'verified'
    if (s === 'pending' || s === 'processing') return 'processing'
    if (s === 'failed' || s === 'rejected' || s === 'error') return 'failed'
  }
  if (topStatus === true) return 'verified'
  if (topStatus === false) return 'failed'

  const verificationStatus = String(res?.verification?.status || '').toLowerCase()
  if (['verified', 'passed', 'success', 'successful'].includes(verificationStatus)) return 'verified'
  if (['pending', 'processing', 'queued'].includes(verificationStatus)) return 'processing'
  if (['failed', 'rejected', 'error'].includes(verificationStatus)) return 'failed'

  const dataStatus = String(res?.data?.status || '').toLowerCase()
  if (['verified', 'passed', 'success', 'successful'].includes(dataStatus)) return 'verified'
  if (['pending', 'processing', 'queued'].includes(dataStatus)) return 'processing'
  if (['failed', 'rejected', 'error'].includes(dataStatus)) return 'failed'

  return 'failed'
}

const Tier3CaptureScreen = () => {
  const router = useRouter()
  const { loadProfile } = useAuth()
  const [status, setStatus] = useState<Tier3State>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [tookTooLong, setTookTooLong] = useState(false)
  const [selfiePreviewUri, setSelfiePreviewUri] = useState<string | null>(null)
  const [hasReadGuidance, setHasReadGuidance] = useState(false)
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pollStartRef = useRef<number | null>(null)
  const statusRef = useRef<Tier3State>('idle')
  const imageBase64Ref = useRef<string | null>(null)

  const fetchStatus = async () => {
    const res = await getTier3Status().catch(() => null)
    const current = res?.tier3_status?.toLowerCase()
    if (current === 'verified') setStatus('verified')
    else if (current === 'processing' || current === 'pending') setStatus('processing')
    else if (current === 'failed') setStatus('failed')
    else setStatus('idle')
  }

  useEffect(() => {
    const bootstrap = async () => {
      setLoading(true)
      try {
        await fetchStatus()
      } catch (err: any) {
        setMessage(extractApiErrorMessage(err))
      } finally {
        setLoading(false)
      }
    }
    void bootstrap()
  }, [])

  useEffect(() => {
    statusRef.current = status
  }, [status])

  const canCapture = useMemo(
    () => (status === 'idle' || status === 'failed') && hasReadGuidance,
    [hasReadGuidance, status]
  )

  const schedulePoll = () => {
    if (pollRef.current) clearTimeout(pollRef.current)
    if (pollStartRef.current === null) pollStartRef.current = Date.now()
    const elapsed = pollStartRef.current ? Date.now() - pollStartRef.current : 0
    if (elapsed > 60000) {
      setTookTooLong(true)
      return
    }
    pollRef.current = setTimeout(async () => {
      await loadProfile({ force: true })
      await fetchStatus()
      if (statusRef.current === 'processing') schedulePoll()
    }, 2300)
  }

  const handleCaptureSubmit = async () => {
    setLoading(true)
    setMessage(null)
    setTookTooLong(false)
    setStatus('processing')
    try {
      const payloadImage = imageBase64Ref.current || ''
      if (!payloadImage) {
        setStatus('idle')
        setMessage('Capture a selfie to continue.')
        setLoading(false)
        return
      }

      const res = await startTier3({ image: payloadImage })
      const next = normalizeTier3State(res)
      if (next === 'verified') {
        setStatus('verified')
        setSelfiePreviewUri(null)
      } else if (next === 'processing') {
        setStatus('processing')
        schedulePoll()
      } else {
        setStatus('failed')
        setMessage(prettyTier3Error(res?.error || res?.message || res?.detail))
      }
      await loadProfile({ force: true })
      await fetchStatus()
    } catch (err: any) {
      setStatus('failed')
      setMessage(prettyTier3Error(extractApiErrorMessage(err)))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (status === 'verified') {
      const t = setTimeout(() => router.replace('/kyc'), 1200)
      return () => clearTimeout(t)
    }
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current)
    }
  }, [status, router])

  useEffect(() => {
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current)
    }
  }, [])

  const requestCameraAndCapture = async () => {
    setMessage(null)
    const { status: perm } = await ImagePicker.requestCameraPermissionsAsync()
    if (perm !== 'granted') {
      setMessage('Camera permission is required to capture your selfie.')
      return null
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.35,
      base64: true,
    })

    if (result.canceled) return null

    const asset = result.assets?.[0]
    if (!asset?.base64) {
      setMessage('Unable to read image. Please try again.')
      return null
    }

    const dataUrl = `data:${asset.type || 'image/jpeg'};base64,${asset.base64}`
    if (asset.base64.length > MAX_BASE64_LEN) {
      setMessage('Selfie is too large. Retake closer with less background to reduce size.')
      return null
    }

    imageBase64Ref.current = dataUrl
    setSelfiePreviewUri(asset.uri || null)
    return dataUrl
  }

  return (
    <ScrollView className="flex-1 bg-primary px-5" contentContainerStyle={{ paddingVertical: 32 }}>
      <Text className="text-white text-2xl font-semibold mb-2">Tier 3 Liveness</Text>
      <Text className="text-gray-300 text-sm mb-4">
        Complete a live selfie check to finish Tier 3 verification.
      </Text>

      <View className="rounded-2xl border border-gray-800 bg-gray-900/70 p-4 mb-4">
        <Text className="text-white font-semibold mb-2">Before You Capture</Text>
        <Text className="text-gray-300 text-xs mb-1">- Use bright lighting and avoid heavy shadows.</Text>
        <Text className="text-gray-300 text-xs mb-1">- Keep your full face centered in frame.</Text>
        <Text className="text-gray-300 text-xs mb-1">- Remove cap, mask, or dark glasses.</Text>
        <Text className="text-gray-300 text-xs mb-3">- Hold still to avoid blur.</Text>

        <TouchableOpacity
          disabled={status === 'processing' || status === 'verified'}
          onPress={() => setHasReadGuidance((v) => !v)}
          className={`rounded-xl py-2 items-center ${
            hasReadGuidance ? 'bg-emerald-600/80' : 'bg-gray-800'
          }`}
        >
          <Text className="text-white text-xs font-semibold">
            {hasReadGuidance ? 'Guidance Confirmed' : 'I Understand The Guidance'}
          </Text>
        </TouchableOpacity>
      </View>

      <View className="rounded-2xl border border-gray-800 bg-gray-900/70 p-4 space-y-3">
        <Text className="text-white font-semibold">Status</Text>
        <Text className="text-gray-300 text-sm capitalize">{status}</Text>
        {message ? <Text className="text-red-400 text-xs">{message}</Text> : null}

        {selfiePreviewUri ? (
          <View className="mt-1">
            <Text className="text-gray-300 text-xs mb-2">Selfie preview</Text>
            <Image
              source={{ uri: selfiePreviewUri }}
              style={{ width: '100%', height: 220, borderRadius: 12 }}
              resizeMode="cover"
            />
          </View>
        ) : null}

        {loading ? (
          <ActivityIndicator />
        ) : (
          <View className="space-y-2">
            <TouchableOpacity
              disabled={!canCapture}
              onPress={async () => {
                await requestCameraAndCapture()
              }}
              className={`rounded-xl py-3 items-center ${
                canCapture ? 'bg-app-primary' : 'bg-gray-800'
              }`}
            >
              <Text className="text-white font-semibold">
                {status === 'failed' ? 'Retake Selfie' : 'Capture Selfie'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              disabled={!imageBase64Ref.current || status === 'processing'}
              onPress={async () => {
                await handleCaptureSubmit()
              }}
              className={`rounded-xl py-3 items-center ${
                imageBase64Ref.current && status !== 'processing' ? 'bg-emerald-600' : 'bg-gray-800'
              }`}
            >
              <Text className="text-white font-semibold">Submit For Verification</Text>
            </TouchableOpacity>

            {status === 'processing' ? (
              <Text className="text-gray-400 text-xs text-center">
                Verifying your liveness. This may take a moment.
              </Text>
            ) : null}

            {status === 'verified' ? (
              <Text className="text-emerald-400 text-xs text-center">Verified! Redirecting...</Text>
            ) : null}

            {tookTooLong && status === 'processing' ? (
              <View className="mt-2 space-y-2">
                <Text className="text-gray-300 text-xs text-center">
                  Verification is taking longer than usual. You can leave this screen; we will update your status shortly.
                </Text>
                <TouchableOpacity
                  onPress={() => router.replace('/kyc')}
                  className="bg-app-primary rounded-xl py-3 items-center"
                >
                  <Text className="text-white font-semibold">Back to KYC</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        )}
      </View>

      <TouchableOpacity
        onPress={() => router.back()}
        className="border border-gray-800 py-3 rounded-xl mt-6 items-center"
      >
        <Text className="text-white">Back to KYC</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

export default Tier3CaptureScreen
