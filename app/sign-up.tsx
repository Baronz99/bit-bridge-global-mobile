import React, { useEffect, useMemo, useState } from 'react'
import { Text, TextInput, TouchableOpacity, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '@/services/useAuth'
import FormInput from '@/components/FormInput'
import {
  AUTH_COLORS,
  AuthHeader,
  AuthShell,
  BottomMeta,
  FlowMarker,
  HelperText,
  InlineNotice,
  InputLabel,
  PrimaryButton,
  ProductHero,
  TaskHeading,
  authFieldInputStyle,
} from '@/components/auth/AuthScaffold'
import { FEATURE_PHONE_FIRST_SIGNUP } from '@/constants/featureFlags'
import { clearConfirmationFlow, setConfirmationFlow } from '@/auth/tokenstore'
import {
  completeSignupIntent,
  requestSignupIntentOtp,
  verifySignupIntentOtp,
} from '@/api/signupIntents'

type LegacyFormState = {
  email: string
  password: string
  confirm_password: string
}

type SignupStage = 'phone' | 'verify' | 'complete'

type SignupIntentSession = {
  signup_intent_id: string | null
  phone_number: string
  phone_e164: string
  otp_expires_at: string
  expires_at: string
  debug_otp: string
  verified_at: string
}

type ApiErrorResponse = {
  response?: {
    status?: number
    data?: {
      message?: string
      error?: string
      status?: string
      reason?: string
      retry_after_seconds?: number
      resend_available_in_seconds?: number
    }
  }
  message?: string
}

type SignupIntentRequestResponse = {
  signup_intent_id?: string
  phone_e164?: string
  expires_at?: string
  otp_expires_at?: string
  resend_available_in_seconds?: number
  debug_otp?: string
}

type SignupIntentVerifyResponse = {
  verified_at?: string
}

type SignupIntentCompleteResponse = {
  access_token?: string
  token?: string
  refresh_token?: string
}

const defaultIntentSession: SignupIntentSession = {
  signup_intent_id: null,
  phone_number: '',
  phone_e164: '',
  otp_expires_at: '',
  expires_at: '',
  debug_otp: '',
  verified_at: '',
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const getApiErrorMessage = (error: unknown, fallback: string) => {
  const apiError = error as ApiErrorResponse
  const data = apiError.response?.data
  const message = data?.message || data?.error || apiError.message || fallback
  const status = apiError.response?.status
  const code = String(data?.status || data?.reason || '')
    .trim()
    .toLowerCase()

  if (status === 429 || code === 'throttled' || code === 'cooldown') {
    const seconds = data?.retry_after_seconds || data?.resend_available_in_seconds
    return seconds
      ? `Please wait ${seconds} seconds before requesting another code.`
      : 'Please wait before requesting another code.'
  }

  if (code === 'phone_in_use' || /already linked to an account|already in use/i.test(String(message))) {
    return 'This phone number is already linked to an account. Sign in or contact support.'
  }

  if (code === 'invalid' || /invalid code/i.test(String(message))) {
    return 'That code is not correct. Please check and try again.'
  }

  if (code === 'expired' || /expired/i.test(String(message))) {
    return 'This code has expired. Request a new code.'
  }

  if (code === 'sms_provider_unavailable' || /temporarily unavailable/i.test(String(message))) {
    return 'We could not send a code right now. Please try again shortly.'
  }

  if (/already been taken/i.test(String(message)) || /already exists/i.test(String(message))) {
    return 'This email is already linked to an account. Sign in instead.'
  }

  return String(message || fallback)
}

const normalizePhone = (value: string) => String(value || '').trim()

const formatCountdown = (seconds: number) => {
  const safe = Math.max(0, Math.floor(seconds))
  const mins = Math.floor(safe / 60)
  const secs = safe % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

function PhoneFirstSignup() {
  const router = useRouter()
  const { establishSessionFromTokens } = useAuth()
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [stage, setStage] = useState<SignupStage>('phone')
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null)
  const [now, setNow] = useState(Date.now())
  const [intentSession, setIntentSession] = useState<SignupIntentSession>(defaultIntentSession)
  const [requestForm, setRequestForm] = useState({ phone_number: '' })
  const [verifyCode, setVerifyCode] = useState('')
  const [completeForm, setCompleteForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    confirm_password: '',
  })
  const [hidePassword, setHidePassword] = useState(true)
  const [hideConfirmPassword, setHideConfirmPassword] = useState(true)
  const [phoneFocused, setPhoneFocused] = useState(false)

  const currentStep = useMemo(() => {
    if (stage === 'verify') return 2
    if (stage === 'complete') return 3
    return 1
  }, [stage])

  const countdown = useMemo(() => {
    if (!cooldownUntil) return 0
    return Math.max(0, Math.ceil((cooldownUntil - now) / 1000))
  }, [cooldownUntil, now])

  useEffect(() => {
    if (!cooldownUntil) return undefined
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [cooldownUntil])

  const resetAll = async () => {
    setStage('phone')
    setErrorMessage(null)
    setCooldownUntil(null)
    setIntentSession(defaultIntentSession)
    setVerifyCode('')
    setRequestForm({ phone_number: '' })
    setCompleteForm({
      first_name: '',
      last_name: '',
      email: '',
      password: '',
      confirm_password: '',
    })
    setHidePassword(true)
    setHideConfirmPassword(true)
    await clearConfirmationFlow().catch(() => {})
  }

  const handleRequestOtp = async () => {
    const phone_number = normalizePhone(requestForm.phone_number)
    if (!phone_number) {
      setErrorMessage('Enter your mobile number.')
      return
    }

    setLoading(true)
    setErrorMessage(null)

    try {
      const response = await requestSignupIntentOtp({ phone_number })
      const data = (isRecord(response) ? response : {}) as SignupIntentRequestResponse
      setIntentSession({
        signup_intent_id: data.signup_intent_id || null,
        phone_number,
        phone_e164: data.phone_e164 || '',
        otp_expires_at: data.otp_expires_at || data.expires_at || '',
        expires_at: data.expires_at || data.otp_expires_at || '',
        debug_otp: data.debug_otp || '',
        verified_at: '',
      })
      setCooldownUntil(Date.now() + Number(data.resend_available_in_seconds || 45) * 1000)
      setStage('verify')
      if (data.debug_otp && __DEV__) {
        setErrorMessage(`Dev OTP: ${data.debug_otp}`)
      }
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'Unable to send verification code.'))
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async () => {
    if (!intentSession.signup_intent_id) {
      setErrorMessage('Request a code first.')
      return
    }
    if (!verifyCode.trim()) {
      setErrorMessage('Enter the verification code.')
      return
    }

    setLoading(true)
    setErrorMessage(null)

    try {
      const response = await verifySignupIntentOtp({
        signup_intent_id: intentSession.signup_intent_id,
        phone_number: intentSession.phone_number,
        code: verifyCode.trim(),
      })
      const data = (isRecord(response) ? response : {}) as SignupIntentVerifyResponse
      setIntentSession((prev) => ({
        ...prev,
        verified_at: data.verified_at || '',
      }))
      setStage('complete')
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'Unable to verify the code.'))
    } finally {
      setLoading(false)
    }
  }

  const handleComplete = async () => {
    const { first_name, last_name, email, password, confirm_password } = completeForm

    if (!intentSession.signup_intent_id) {
      setErrorMessage('Verify your phone number first.')
      return
    }

    if (!first_name || !last_name || !email || !password || !confirm_password) {
      setErrorMessage('Fill in all account details.')
      return
    }

    if (password !== confirm_password) {
      setErrorMessage('Passwords do not match.')
      return
    }

    setLoading(true)
    setErrorMessage(null)

    try {
      const response = await completeSignupIntent({
        signup_intent_id: intentSession.signup_intent_id,
        email: email.trim(),
        password,
        password_confirmation: confirm_password,
        first_name: first_name.trim(),
        last_name: last_name.trim(),
      })
      const data = (isRecord(response) ? response : {}) as SignupIntentCompleteResponse

      const accessToken = data.access_token || data.token || null
      const refreshToken = data.refresh_token || null

      if (!accessToken) {
        throw new Error('Signup succeeded but no access token was returned.')
      }

      await establishSessionFromTokens(accessToken, refreshToken)
      await clearConfirmationFlow().catch(() => {})
      await resetAll()
      router.replace('/')
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'Unable to create your account.'))
    } finally {
      setLoading(false)
    }
  }

  const stepLabel = stage === 'phone' ? 'Phone number' : stage === 'verify' ? 'Verify' : 'Account'
  const taskTitle =
    stage === 'phone' ? 'Continue with your phone number' : stage === 'verify' ? 'Enter verification code' : 'Complete your account'
  const taskSubtitle =
    stage === 'phone'
      ? 'Use the mobile number you want linked to your BitBridge Global account.'
      : stage === 'verify'
        ? `Enter the 6-digit code sent to ${intentSession.phone_number || 'your mobile number'}.`
        : 'Add your details and choose the email and password you will use to sign in.'

  const handleTopBack = () => {
    if (stage === 'complete') {
      setStage('verify')
      setErrorMessage(null)
      return
    }
    if (stage === 'verify') {
      setStage('phone')
      setErrorMessage(null)
      return
    }
    router.replace('/login')
  }

  return (
    <AuthShell>
      <AuthHeader
        showBack={stage !== 'phone'}
        onBack={handleTopBack}
        rightLabel="Sign in"
        onRightPress={() => router.replace('/login')}
      />
      <ProductHero />
      <FlowMarker eyebrow={`Step ${currentStep} of 3`} label={stepLabel} progress={currentStep / 3} />
      <TaskHeading title={taskTitle} subtitle={taskSubtitle} />

      <View className="mt-8">
        {stage === 'phone' ? (
          <View>
            <InputLabel>Phone number</InputLabel>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                borderRadius: 16,
                borderWidth: 1,
                borderColor: phoneFocused ? 'rgba(59, 130, 246, 0.34)' : AUTH_COLORS.surfaceBorder,
                backgroundColor: AUTH_COLORS.surface,
                paddingHorizontal: 12,
              }}
            >
              <View className="flex-row items-center" style={{ marginRight: 10 }}>
                <Text style={{ color: AUTH_COLORS.primaryText, fontSize: 14, fontWeight: '600' }}>+234</Text>
                <View style={{ width: 1, height: 16, backgroundColor: 'rgba(148, 163, 184, 0.18)', marginLeft: 10 }} />
              </View>
              <View style={{ flex: 1 }}>
                <TextInput
                  accessibilityLabel="Phone number"
                  placeholder="080 1234 5678"
                  value={requestForm.phone_number}
                  autoComplete="tel"
                  keyboardType="phone-pad"
                  textContentType="telephoneNumber"
                  onChangeText={(value: string) => setRequestForm({ phone_number: value })}
                  onFocus={() => setPhoneFocused(true)}
                  onBlur={() => setPhoneFocused(false)}
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardAppearance="dark"
                  selectionColor={AUTH_COLORS.accentText}
                  style={{
                    color: AUTH_COLORS.primaryText,
                    paddingVertical: 13,
                    paddingHorizontal: 0,
                    fontSize: 16,
                    fontWeight: '600',
                  }}
                />
              </View>
            </View>
            <HelperText>We&apos;ll text you a secure verification code.</HelperText>
            {errorMessage ? <InlineNotice message={errorMessage} /> : null}
            <PrimaryButton label="Continue →" onPress={handleRequestOtp} loading={loading} />
            <BottomMeta
              trustCopy="Protected by bank-grade security"
              prefixText="Already using BitBridge Global?"
              linkText="Sign in"
              linkAction={() => router.replace('/login')}
            />
          </View>
        ) : null}

        {stage === 'verify' ? (
          <View>
            <InputLabel>Verification code</InputLabel>
            <FormInput
              accessibilityLabel="Verification code"
              placeholder="123456"
              value={verifyCode}
              autoComplete="one-time-code"
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              onChangeText={setVerifyCode}
              style={{ ...authFieldInputStyle, borderColor: 'rgba(59, 130, 246, 0.34)' }}
              className="text-white my-0 py-3.5 text-[22px] font-semibold tracking-[0.22em] text-center"
            />
            <HelperText>Enter the 6-digit code sent to your mobile number.</HelperText>
            {intentSession.debug_otp && __DEV__ ? <HelperText tone="success">Dev OTP: {intentSession.debug_otp}</HelperText> : null}
            {errorMessage ? <InlineNotice message={errorMessage} /> : null}
            <PrimaryButton label="Verify phone →" onPress={handleVerifyOtp} loading={loading} />
            <View className="mt-4 flex-row items-center justify-between">
              <TouchableOpacity
                onPress={() => {
                  setStage('phone')
                  setErrorMessage(null)
                }}
              >
                <Text style={{ color: AUTH_COLORS.secondaryText, fontSize: 13, fontWeight: '600' }}>Change number</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => {
                  if (!intentSession.phone_number) return
                  setLoading(true)
                  setErrorMessage(null)
                  try {
                    const response = await requestSignupIntentOtp({ phone_number: intentSession.phone_number })
                    setCooldownUntil(Date.now() + Number(response?.resend_available_in_seconds || 45) * 1000)
                    setIntentSession((prev) => ({
                      ...prev,
                      signup_intent_id: response?.signup_intent_id || prev.signup_intent_id,
                      phone_e164: response?.phone_e164 || prev.phone_e164,
                      otp_expires_at: response?.otp_expires_at || response?.expires_at || prev.otp_expires_at,
                      expires_at: response?.expires_at || response?.otp_expires_at || prev.expires_at,
                      debug_otp: response?.debug_otp || '',
                    }))
                    if (response?.debug_otp && __DEV__) {
                      setErrorMessage(`Dev OTP: ${response.debug_otp}`)
                    }
                  } catch (error) {
                    setErrorMessage(getApiErrorMessage(error, 'Unable to resend the code.'))
                  } finally {
                    setLoading(false)
                  }
                }}
                disabled={loading || countdown > 0}
              >
                <Text style={{ color: loading || countdown > 0 ? AUTH_COLORS.tertiaryText : AUTH_COLORS.accentText, fontSize: 13, fontWeight: '600' }}>
                  {countdown > 0 ? `Resend in ${formatCountdown(countdown)}` : 'Resend code'}
                </Text>
              </TouchableOpacity>
            </View>
            <BottomMeta
              trustCopy="Code delivery is protected and rate-limited for your security"
              prefixText="Already using BitBridge Global?"
              linkText="Sign in"
              linkAction={() => router.replace('/login')}
            />
          </View>
        ) : null}

        {stage === 'complete' ? (
          <View>
            <InlineNotice message={`Phone verified for ${intentSession.phone_number}.`} tone="success" />
            <View className="mt-5">
              <InputLabel>First name</InputLabel>
              <FormInput
                accessibilityLabel="First name"
                placeholder="John"
                value={completeForm.first_name}
                autoComplete="given-name"
                textContentType="givenName"
                onChangeText={(value: string) => setCompleteForm({ ...completeForm, first_name: value })}
                style={authFieldInputStyle}
                className="text-white my-0 py-3.5 text-base font-semibold px-4"
              />

              <InputLabel>Last name</InputLabel>
              <FormInput
                accessibilityLabel="Last name"
                placeholder="Doe"
                value={completeForm.last_name}
                autoComplete="family-name"
                textContentType="familyName"
                onChangeText={(value: string) => setCompleteForm({ ...completeForm, last_name: value })}
                style={authFieldInputStyle}
                className="text-white my-0 py-3.5 text-base font-semibold px-4"
              />

              <InputLabel>Email address</InputLabel>
              <FormInput
                accessibilityLabel="Email address"
                placeholder="you@example.com"
                value={completeForm.email}
                autoComplete="email"
                textContentType="emailAddress"
                keyboardType="email-address"
                onChangeText={(value: string) => setCompleteForm({ ...completeForm, email: value })}
                style={authFieldInputStyle}
                className="text-white my-0 py-3.5 text-base font-semibold px-4"
              />
              <HelperText>This email will be used to sign in and recover your account. Make sure you can access it.</HelperText>

              <InputLabel>Password</InputLabel>
              <FormInput
                accessibilityLabel="Password"
                placeholder="Create a password"
                value={completeForm.password}
                isPassword
                secureTextEntry={hidePassword}
                hidePassword={hidePassword}
                setHidePassword={setHidePassword}
                textContentType="newPassword"
                autoComplete="new-password"
                onChangeText={(value: string) => setCompleteForm({ ...completeForm, password: value })}
                style={authFieldInputStyle}
                className="text-white my-0 py-3.5 text-base font-semibold px-4"
              />

              <InputLabel>Confirm password</InputLabel>
              <FormInput
                accessibilityLabel="Confirm password"
                placeholder="Confirm password"
                value={completeForm.confirm_password}
                isPassword
                secureTextEntry={hideConfirmPassword}
                hidePassword={hideConfirmPassword}
                setHidePassword={setHideConfirmPassword}
                textContentType="newPassword"
                autoComplete="new-password"
                onChangeText={(value: string) => setCompleteForm({ ...completeForm, confirm_password: value })}
                style={authFieldInputStyle}
                className="text-white my-0 py-3.5 text-base font-semibold px-4"
              />
            </View>
            {errorMessage ? <InlineNotice message={errorMessage} /> : null}
            <PrimaryButton label="Create account →" onPress={handleComplete} loading={loading} />
            <BottomMeta
              trustCopy="By continuing, you agree to BitBridge Global's Terms and Privacy Policy"
              prefixText="Already using BitBridge Global?"
              linkText="Sign in"
              linkAction={() => router.replace('/login')}
            />
          </View>
        ) : null}
      </View>
    </AuthShell>
  )
}

function LegacySignup() {
  const router = useRouter()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [formInput, setFormInput] = useState<LegacyFormState>({ email: '', password: '', confirm_password: '' })
  const [loading, setLoading] = useState(false)
  const [hidePassword, setHidePassword] = useState(true)
  const [hideConfirmPassword, setHideConfirmPassword] = useState(true)
  const { onRegister } = useAuth()

  const handleSignUp = async () => {
    setLoading(true)
    try {
      setErrorMessage(null)
      if (!formInput.email || !formInput.password || !formInput.confirm_password) {
        setErrorMessage('Please fill in all fields.')
        return
      }
      if (formInput.password !== formInput.confirm_password) {
        throw new Error('Passwords do not match.')
      }

      await onRegister(formInput)
      await setConfirmationFlow('signup')
      router.push('/confirmEmail')
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to register')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell>
      <AuthHeader rightLabel="Sign in" onRightPress={() => router.replace('/login')} />
      <ProductHero />
      <FlowMarker eyebrow="Step 1 of 1" label="Create account" progress={1} />
      <TaskHeading title="Create your account" subtitle="Use your email and a secure password to get started with BitBridge Global." />
      <View className="mt-8">
        <InputLabel>Email address</InputLabel>
        <FormInput
          accessibilityLabel="Email address"
          placeholder="you@example.com"
          value={formInput.email}
          autoComplete="email"
          textContentType="emailAddress"
          keyboardType="email-address"
          onChangeText={(value: string) => setFormInput({ ...formInput, email: value })}
          style={authFieldInputStyle}
          className="text-white my-0 py-3.5 text-base font-semibold px-4"
        />

        <InputLabel>Password</InputLabel>
        <FormInput
          accessibilityLabel="Password"
          placeholder="Create a password"
          value={formInput.password}
          isPassword
          secureTextEntry={hidePassword}
          hidePassword={hidePassword}
          setHidePassword={setHidePassword}
          textContentType="newPassword"
          autoComplete="new-password"
          onChangeText={(value: string) => setFormInput({ ...formInput, password: value })}
          style={authFieldInputStyle}
          className="text-white py-3.5 my-0 text-base font-semibold px-4"
        />

        <InputLabel>Confirm password</InputLabel>
        <FormInput
          accessibilityLabel="Confirm password"
          placeholder="Confirm password"
          value={formInput.confirm_password}
          isPassword
          secureTextEntry={hideConfirmPassword}
          hidePassword={hideConfirmPassword}
          setHidePassword={setHideConfirmPassword}
          textContentType="newPassword"
          autoComplete="new-password"
          onChangeText={(value: string) => setFormInput({ ...formInput, confirm_password: value })}
          style={authFieldInputStyle}
          className="text-white py-3.5 my-0 text-base font-semibold px-4"
        />

        {errorMessage ? <InlineNotice message={errorMessage} /> : null}
        <PrimaryButton label="Continue →" onPress={handleSignUp} loading={loading} />
        <BottomMeta
          trustCopy="Protected by bank-grade security"
          prefixText="Already using BitBridge Global?"
          linkText="Sign in"
          linkAction={() => router.replace('/login')}
        />
      </View>
    </AuthShell>
  )
}

const SignUp = () => {
  if (FEATURE_PHONE_FIRST_SIGNUP) {
    return <PhoneFirstSignup />
  }

  return <LegacySignup />
}

export default SignUp



