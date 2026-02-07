import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Image, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useIsFocused } from '@react-navigation/native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { startTier3, getTier3Status } from '@/api/kyc'
import { useAuth } from '@/services/useAuth'

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
type CaptureStep = 'guidance' | 'camera' | 'review'

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
  const isFocused = useIsFocused()
  const { loadProfile } = useAuth()
  const [permission, requestPermission] = useCameraPermissions()
  const cameraRef = useRef<CameraView | null>(null)

  const [status, setStatus] = useState<Tier3State>('idle')
  const [step, setStep] = useState<CaptureStep>('guidance')
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [capturing, setCapturing] = useState(false)
  const [tookTooLong, setTookTooLong] = useState(false)
  const [selfiePreviewUri, setSelfiePreviewUri] = useState<string | null>(null)
  const [hasReadGuidance, setHasReadGuidance] = useState(false)

  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pollStartRef = useRef<number | null>(null)
  const submitStartedAtRef = useRef<number | null>(null)
  const statusRef = useRef<Tier3State>('idle')
  const imageBase64Ref = useRef<string | null>(null)

  const fetchStatus = async () => {
    const res = await getTier3Status().catch(() => null)
    const current = res?.tier3_status?.toLowerCase()
    if (current === 'verified') {
      submitStartedAtRef.current = null
      setStatus('verified')
    } else if (current === 'processing' || current === 'pending') {
      setStatus('processing')
    }
    else if (current === 'failed' || current === 'rejected') {
      submitStartedAtRef.current = null
      setStatus('failed')
      if (res?.tier3_error) setMessage(prettyTier3Error(res.tier3_error))
    } else {
      const withinSubmitGraceWindow =
        submitStartedAtRef.current !== null && Date.now() - submitStartedAtRef.current < 45_000
      if (withinSubmitGraceWindow) {
        setStatus('processing')
        setMessage((prev) => prev || 'Selfie submitted. Verification in progress.')
      } else {
        setStatus('idle')
      }
    }
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

  const canOpenCamera = useMemo(
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
    submitStartedAtRef.current = Date.now()

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

  const openCamera = async () => {
    setMessage(null)
    const granted = permission?.granted
    if (!granted) {
      const req = await requestPermission()
      if (!req.granted) {
        setMessage('Camera permission is required to capture your selfie.')
        return
      }
    }
    setStep('camera')
  }

  const takeSelfie = async () => {
    if (!cameraRef.current || capturing) return
    setCapturing(true)
    setMessage(null)

    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.35,
      })

      if (!photo?.base64) {
        setMessage('Unable to read image. Please try again.')
        return
      }

      if (photo.base64.length > MAX_BASE64_LEN) {
        setMessage('Selfie is too large. Retake closer with less background to reduce size.')
        return
      }

      const dataUrl = `data:image/jpeg;base64,${photo.base64}`
      imageBase64Ref.current = dataUrl
      setSelfiePreviewUri(photo.uri || null)
      setStep('review')
    } catch {
      setMessage('Unable to capture image. Please try again.')
    } finally {
      setCapturing(false)
    }
  }

  const resetCapture = () => {
    imageBase64Ref.current = null
    setSelfiePreviewUri(null)
    setStep('camera')
    setMessage(null)
  }

  const showCaptureFlow = status !== 'processing' && status !== 'verified'

  return (
    <ScrollView className="flex-1 bg-primary px-5" contentContainerStyle={{ paddingVertical: 32 }}>
      <Text className="text-white text-2xl font-semibold mb-2">Tier 3 Liveness</Text>
      <Text className="text-gray-300 text-sm mb-4">
        Complete a live selfie check to finish Tier 3 verification.
      </Text>

      <View className="rounded-2xl border border-gray-800 bg-gray-900/70 p-4 mb-4">
        <Text className="text-white font-semibold mb-1">Current Status</Text>
        <Text className="text-gray-300 text-sm capitalize">{status}</Text>
        {message ? <Text className="text-red-400 text-xs mt-2">{message}</Text> : null}
      </View>

      {showCaptureFlow && step === 'guidance' ? (
        <View className="rounded-2xl border border-gray-800 bg-gray-900/70 p-4 mb-4">
          <Text className="text-white font-semibold mb-2">Before You Capture</Text>
          <Text className="text-gray-300 text-xs mb-1">- Use bright lighting and avoid heavy shadows.</Text>
          <Text className="text-gray-300 text-xs mb-1">- Keep your full face centered in the oval frame.</Text>
          <Text className="text-gray-300 text-xs mb-1">- Remove cap, mask, or dark glasses.</Text>
          <Text className="text-gray-300 text-xs mb-3">- Hold still to avoid blur.</Text>

          <TouchableOpacity
            disabled={status === 'processing' || status === 'verified'}
            onPress={() => setHasReadGuidance((v) => !v)}
            className={`rounded-xl py-2 items-center mb-3 ${
              hasReadGuidance ? 'bg-emerald-600/80' : 'bg-gray-800'
            }`}
          >
            <Text className="text-white text-xs font-semibold">
              {hasReadGuidance ? 'Guidance Confirmed' : 'I Understand The Guidance'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            disabled={!canOpenCamera}
            onPress={openCamera}
            className={`rounded-xl py-3 items-center ${canOpenCamera ? 'bg-app-primary' : 'bg-gray-800'}`}
          >
            <Text className="text-white font-semibold">Open Camera</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {showCaptureFlow && step === 'camera' ? (
        <View className="rounded-2xl border border-gray-800 bg-gray-900/70 p-3 mb-4">
          <Text className="text-white font-semibold mb-2">Align Your Face</Text>
          <View className="relative overflow-hidden rounded-2xl" style={{ height: 460 }}>
            <CameraView
              ref={cameraRef}
              facing="front"
              style={{ flex: 1 }}
              active={isFocused && step === 'camera'}
            />

            <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '18%', backgroundColor: 'rgba(0,0,0,0.45)' }} />
              <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '18%', backgroundColor: 'rgba(0,0,0,0.45)' }} />
              <View style={{ position: 'absolute', top: '18%', bottom: '18%', left: 0, width: '12%', backgroundColor: 'rgba(0,0,0,0.45)' }} />
              <View style={{ position: 'absolute', top: '18%', bottom: '18%', right: 0, width: '12%', backgroundColor: 'rgba(0,0,0,0.45)' }} />

              <View
                style={{
                  position: 'absolute',
                  top: '18%',
                  bottom: '18%',
                  left: '12%',
                  right: '12%',
                  borderWidth: 3,
                  borderColor: '#10b981',
                  borderRadius: 999,
                }}
              />
            </View>
          </View>

          <Text className="text-gray-300 text-xs text-center mt-3">
            Center your face in the oval, keep eyes open, then capture.
          </Text>

          <View className="flex-row gap-2 mt-3">
            <TouchableOpacity
              onPress={() => setStep('guidance')}
              className="flex-1 border border-gray-700 rounded-xl py-3 items-center"
            >
              <Text className="text-white">Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              disabled={capturing}
              onPress={takeSelfie}
              className={`flex-1 rounded-xl py-3 items-center ${capturing ? 'bg-gray-700' : 'bg-app-primary'}`}
            >
              <Text className="text-white font-semibold">{capturing ? 'Capturing...' : 'Capture'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {showCaptureFlow && step === 'review' ? (
        <View className="rounded-2xl border border-gray-800 bg-gray-900/70 p-4 mb-4">
          <Text className="text-white font-semibold mb-2">Review Selfie</Text>
          {selfiePreviewUri ? (
            <Image
              source={{ uri: selfiePreviewUri }}
              style={{ width: '100%', height: 300, borderRadius: 12 }}
              resizeMode="cover"
            />
          ) : null}
          <Text className="text-gray-300 text-xs text-center mt-3">
            Ensure your face is clear, centered, and fully visible before submitting.
          </Text>

          <View className="flex-row gap-2 mt-3">
            <TouchableOpacity
              onPress={resetCapture}
              className="flex-1 border border-gray-700 rounded-xl py-3 items-center"
            >
              <Text className="text-white">Retake</Text>
            </TouchableOpacity>
            <TouchableOpacity
              disabled={loading || !imageBase64Ref.current}
              onPress={handleCaptureSubmit}
              className={`flex-1 rounded-xl py-3 items-center ${
                loading || !imageBase64Ref.current ? 'bg-gray-700' : 'bg-emerald-600'
              }`}
            >
              <Text className="text-white font-semibold">Submit</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {(status === 'processing' || loading) ? (
        <View className="rounded-2xl border border-gray-800 bg-gray-900/70 p-4 mb-4 items-center">
          <ActivityIndicator />
          <Text className="text-gray-300 text-xs text-center mt-2">
            Verifying your liveness. This may take a moment.
          </Text>
          {tookTooLong ? (
            <Text className="text-gray-300 text-xs text-center mt-2">
              Verification is taking longer than usual. You can leave this screen; we will update your status shortly.
            </Text>
          ) : null}
        </View>
      ) : null}

      {status === 'verified' ? (
        <View className="rounded-2xl border border-emerald-700 bg-emerald-900/30 p-4 mb-4">
          <Text className="text-emerald-300 text-center text-sm">Verified! Redirecting...</Text>
        </View>
      ) : null}

      <TouchableOpacity
        onPress={() => router.back()}
        className="border border-gray-800 py-3 rounded-xl mt-2 items-center"
      >
        <Text className="text-white">Back to KYC</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

export default Tier3CaptureScreen
