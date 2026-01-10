// app/kyc/tier3-capture.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  ActivityIndicator,
  AppState,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { Stack, router } from 'expo-router'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { useFocusEffect } from '@react-navigation/native'
import { useAuth } from '@/services/useAuth'
import {
  getTier3Status,
  submitTier3,
  Tier3StatusResponse,
} from '@/api/kyc'

const TIER3_POLL_INTERVAL_MS = 2000
const TIER3_POLL_TIMEOUT_MS = 30000
const TIER3_UI_STATUS = {
  idle: 'idle',
  submitting: 'submitting',
  processing: 'processing',
  verified: 'verified',
  failed: 'failed',
} as const

type Tier3UiStatus = (typeof TIER3_UI_STATUS)[keyof typeof TIER3_UI_STATUS]

const normalizeTier3Status = (raw?: string) => {
  const status = (raw || '').toString().trim().toLowerCase()
  if (status === 'verified') return TIER3_UI_STATUS.verified
  if (status === 'failed' || status === 'rejected') return TIER3_UI_STATUS.failed
  if (status === 'pending' || status === 'processing') return TIER3_UI_STATUS.processing
  return ''
}

export default function Tier3Capture() {
  const cameraRef = useRef<React.ElementRef<typeof CameraView> | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollUntilRef = useRef(0)

  const [permission, requestPermission] = useCameraPermissions()
  const { userProfileData, loadProfile } = useAuth()

  const status = useMemo(() => {
    const s = (userProfileData as any)?.data ?? userProfileData
    return s || null
  }, [userProfileData])

  const bvnVerified = useMemo(() => {
    const bvnStatus = status?.user_kyc?.bvn_status
    return bvnStatus === 'verified'
  }, [status])

  const last4 = useMemo(() => status?.user_kyc?.bvn_last4 || '', [status])

  const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null)
  const [uiStatus, setUiStatus] = useState<Tier3UiStatus>(TIER3_UI_STATUS.idle)
  const [submittedAt, setSubmittedAt] = useState<number | null>(null)
  const [tier3Error, setTier3Error] = useState('')
  const [tier3StatusSnapshot, setTier3StatusSnapshot] = useState<Tier3StatusResponse | null>(null)
  const [pollExpired, setPollExpired] = useState(false)

  const isSubmitting = uiStatus === TIER3_UI_STATUS.submitting
  const isProcessing = uiStatus === TIER3_UI_STATUS.processing
  const isVerified = uiStatus === TIER3_UI_STATUS.verified
  const isFailed = uiStatus === TIER3_UI_STATUS.failed

  const ensurePermission = useCallback(async () => {
    if (permission?.granted) return true
    const res = await requestPermission()
    return !!res.granted
  }, [permission?.granted, requestPermission])

  const openCamera = useCallback(async () => {
    const ok = await ensurePermission()
    if (!ok) {
      Alert.alert(
        'Camera permission needed',
        'Please allow camera access to continue Tier 3 verification.'
      )
    }
  }, [ensurePermission])

  const takePhoto = useCallback(async () => {
    try {
      const cam = cameraRef.current
      if (!cam) return

      const photo = await cam.takePictureAsync({
        quality: 0.7,
        base64: true,
        exif: false,
        skipProcessing: true,
      })

      if (!photo?.base64) {
        Alert.alert('Capture failed', 'No image data returned. Please try again.')
        return
      }

      const dataUrl = `data:image/jpeg;base64,${photo.base64}`
      if (__DEV__) {
        console.log(`[Tier3] selfie image_len=${dataUrl.length}`)
      }

      setCapturedDataUrl(dataUrl)
    } catch (e: any) {
      Alert.alert('Camera error', e?.message || 'Unable to capture photo.')
    }
  }, [])

  const retake = useCallback(() => {
    setCapturedDataUrl(null)
    setTier3Error('')
  }, [])

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  const resolveUiStatus = useCallback((snapshot: Tier3StatusResponse | null, submitted: number | null) => {
    const normalized = normalizeTier3Status(snapshot?.tier3_status)
    if (normalized) return normalized as Tier3UiStatus

    if (submitted && Date.now() - submitted <= TIER3_POLL_TIMEOUT_MS) {
      return TIER3_UI_STATUS.processing
    }

    return TIER3_UI_STATUS.idle
  }, [])

  const fetchTier3Status = useCallback(async () => {
    try {
      const data = await getTier3Status()
      setTier3StatusSnapshot(data)
      const nextStatus = resolveUiStatus(data, submittedAt)
      setUiStatus((prev) => (prev === TIER3_UI_STATUS.submitting ? prev : nextStatus))

      if (nextStatus === TIER3_UI_STATUS.verified || nextStatus === TIER3_UI_STATUS.failed) {
        stopPolling()
        if (nextStatus === TIER3_UI_STATUS.verified) {
          await loadProfile()
        }
      }

      return data
    } catch (_) {
      return null
    }
  }, [loadProfile, resolveUiStatus, stopPolling, submittedAt])

  const startPolling = useCallback(() => {
    stopPolling()
    setPollExpired(false)
    pollUntilRef.current = Date.now() + TIER3_POLL_TIMEOUT_MS

    const pollOnce = async () => {
      if (Date.now() > pollUntilRef.current) {
        stopPolling()
        setPollExpired(true)
        return
      }

      const data = await fetchTier3Status()
      const nextStatus = resolveUiStatus(data, submittedAt)
      if (nextStatus === TIER3_UI_STATUS.verified || nextStatus === TIER3_UI_STATUS.failed) {
        stopPolling()
      }
    }

    void pollOnce()
    pollRef.current = setInterval(pollOnce, TIER3_POLL_INTERVAL_MS)
  }, [fetchTier3Status, resolveUiStatus, stopPolling, submittedAt])

  const onSubmit = useCallback(async () => {
    if (!bvnVerified) {
      Alert.alert('BVN required', 'Verify BVN before submitting Tier 3 verification.')
      return
    }

    if (!capturedDataUrl) {
      Alert.alert('Missing selfie', 'Please capture a live selfie to continue.')
      return
    }

    setUiStatus(TIER3_UI_STATUS.submitting)
    setTier3Error('')
    setSubmittedAt(Date.now())
    setPollExpired(false)

    try {
      await submitTier3({ image: capturedDataUrl })
      setUiStatus(TIER3_UI_STATUS.processing)
      startPolling()
      await loadProfile()
    } catch (e: any) {
      setTier3Error(e?.message || 'Unable to submit Tier 3 verification.')
      setUiStatus(TIER3_UI_STATUS.failed)
    }
  }, [bvnVerified, capturedDataUrl, loadProfile, startPolling])

  useEffect(() => {
    void openCamera()
  }, [openCamera])

  useFocusEffect(
    useCallback(() => {
      void fetchTier3Status()
      if (uiStatus === TIER3_UI_STATUS.processing) {
        startPolling()
      }

      return () => stopPolling()
    }, [fetchTier3Status, startPolling, stopPolling, uiStatus])
  )

  useEffect(() => {
    if (uiStatus === TIER3_UI_STATUS.processing && AppState.currentState === 'active') {
      startPolling()
    }
  }, [startPolling, uiStatus])

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') {
        stopPolling()
        return
      }

      if (uiStatus === TIER3_UI_STATUS.processing) {
        startPolling()
      }
    })

    return () => sub.remove()
  }, [startPolling, stopPolling, uiStatus])

  useEffect(() => {
    return () => stopPolling()
  }, [stopPolling])

  const showCamera = permission?.granted && !capturedDataUrl && !isVerified
  const statusError = tier3Error || tier3StatusSnapshot?.tier3_error || ''

  return (
    <View className="flex-1 bg-primary px-5">
      <Stack.Screen
        options={{
          title: 'Tier 3 Verification',
          headerBackTitle: 'Back',
        }}
      />

      <View className="py-5">
        <Text className="text-white text-xl font-semibold">Tier 3 - Biometric Verification</Text>
        <Text className="text-gray-400 mt-2">
          Capture a live selfie. We will run a liveness check and match your face against your BVN.
        </Text>
      </View>

      <View className="rounded-2xl border border-gray-800 bg-gray-900/70 p-4 mb-4">
        <Text className="text-white font-semibold">BVN status</Text>
        {bvnVerified ? (
          <>
            <Text className="text-emerald-300 text-xs mt-1">
              Verified {last4 ? `(**** ${last4})` : ''}
            </Text>
            <Text className="text-gray-400 text-xs mt-2">
              We will reuse your verified BVN evidence on file.
            </Text>
          </>
        ) : (
          <Text className="text-gray-400 text-xs mt-1">
            Verify BVN before attempting Tier 3 biometric verification.
          </Text>
        )}
      </View>

      <View className="rounded-2xl border border-gray-800 bg-gray-900/70 overflow-hidden">
        {permission?.granted ? (
          showCamera ? (
            <View style={{ height: 360 }}>
              <CameraView ref={cameraRef} style={{ flex: 1 }} facing="front" />
            </View>
          ) : (
            <View className="p-4">
              <Text className="text-white font-semibold">Selfie captured</Text>
              <Text className="text-gray-400 text-xs mt-1">
                Looks good? Submit. Otherwise retake.
              </Text>
            </View>
          )
        ) : (
          <View className="p-4">
            <Text className="text-white font-semibold">Camera permission needed</Text>
            <Text className="text-gray-400 text-xs mt-2">
              Please allow camera access in your device settings.
            </Text>
            <TouchableOpacity
              onPress={requestPermission}
              className="mt-3 bg-black/40 border border-gray-800 py-3 rounded-xl items-center"
            >
              <Text className="text-white font-semibold">Allow camera</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {isProcessing ? (
        <View className="mt-4 rounded-2xl border border-gray-800 bg-gray-900/70 p-4">
          <Text className="text-white font-semibold">Verification in progress</Text>
          <Text className="text-gray-400 text-xs mt-1">
            This usually takes a few seconds. We will update once processing is complete.
          </Text>
          {pollExpired ? (
            <Text className="text-gray-500 text-xs mt-2">
              Check back soon. Tap refresh to check status.
            </Text>
          ) : null}
        </View>
      ) : null}

      {isVerified ? (
        <View className="mt-4 rounded-2xl border border-emerald-700/40 bg-emerald-900/20 p-4">
          <Text className="text-emerald-200 font-semibold">Tier 3 Verified</Text>
          <Text className="text-emerald-200 text-xs mt-1">
            Your biometric verification is complete.
          </Text>
        </View>
      ) : null}

      {isFailed && statusError ? (
        <View className="mt-4 rounded-2xl border border-red-700/40 bg-red-900/20 p-4">
          <Text className="text-red-200 font-semibold">Verification failed</Text>
          <Text className="text-red-200 text-xs mt-1">{statusError}</Text>
        </View>
      ) : null}

      <View className="mt-4 gap-3">
        {permission?.granted && !isVerified ? (
          capturedDataUrl ? (
            <>
              <TouchableOpacity
                disabled={isSubmitting || isProcessing}
                onPress={retake}
                className="bg-black/40 border border-gray-800 py-3 rounded-xl items-center"
              >
                <Text className="text-white font-semibold">Retake</Text>
              </TouchableOpacity>

              {isProcessing ? (
                <TouchableOpacity
                  disabled
                  className="bg-gray-900 border border-gray-800 py-3 rounded-xl items-center"
                >
                  <Text className="text-gray-300 font-semibold">Verification in progress</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  disabled={isSubmitting || !bvnVerified}
                  onPress={onSubmit}
                  className="bg-app-primary py-3 rounded-xl items-center"
                >
                  {isSubmitting ? (
                    <ActivityIndicator />
                  ) : (
                    <Text className="text-white font-semibold">
                      {isFailed ? 'Retry verification' : 'Submit Tier 3'}
                    </Text>
                  )}
                </TouchableOpacity>
              )}

              {isProcessing ? (
                <TouchableOpacity
                  onPress={fetchTier3Status}
                  className="bg-gray-900 border border-gray-800 py-3 rounded-xl items-center"
                >
                  <Text className="text-white font-semibold">Refresh status</Text>
                </TouchableOpacity>
              ) : null}
            </>
          ) : (
            <TouchableOpacity
              disabled={isSubmitting || isProcessing}
              onPress={takePhoto}
              className="bg-app-primary py-3 rounded-xl items-center"
            >
              <Text className="text-white font-semibold">Capture selfie</Text>
            </TouchableOpacity>
          )
        ) : null}

        <TouchableOpacity
          disabled={isSubmitting}
          onPress={() => router.back()}
          className="bg-gray-900 border border-gray-800 py-3 rounded-xl items-center"
        >
          <Text className="text-white font-semibold">Cancel</Text>
        </TouchableOpacity>
      </View>

      <View className="py-4">
        <Text className="text-gray-500 text-xs">
          Note: No gallery uploads allowed. Selfie must be captured live.
        </Text>
        {Platform.OS !== 'web' ? null : (
          <Text className="text-gray-500 text-xs mt-1">
            On web, camera permission depends on browser settings.
          </Text>
        )}
      </View>
    </View>
  )
}
