import React, { useMemo, useState } from 'react'
import { Text, TextInput, TouchableOpacity, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import FormInput from '@/components/FormInput'
import { backOrFallback } from '@/utils/navigationRecovery'
import {
  AUTH_COLORS,
  AuthHeader,
  AuthShell,
  FlowMarker,
  HelperText,
  InlineNotice,
  InputLabel,
  PrimaryButton,
  ProductHero,
  TaskHeading,
  authFieldInputStyle,
} from '@/components/auth/AuthScaffold'
import {
  confirmUnconfirmedEmailRecovery,
  requestUnconfirmedEmailRecovery,
} from '@/api/auth'
import { setConfirmationFlow, setEmailForVerification } from '@/auth/tokenstore'

type Stage = 'request' | 'verify'

const RecoverUnconfirmed = () => {
  const router = useRouter()
  const params = useLocalSearchParams<{ email?: string }>()
  const [stage, setStage] = useState<Stage>('request')
  const [loading, setLoading] = useState(false)
  const [hidePassword, setHidePassword] = useState(true)
  const [phoneFocused, setPhoneFocused] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [debugOtp, setDebugOtp] = useState('')
  const [form, setForm] = useState({
    phone_number: '',
    current_password: '',
    new_email: String(params.email || '').trim(),
    phone_otp_code: '',
  })

  const stepLabel = useMemo(() => (stage === 'request' ? 'Recover access' : 'Verify phone'), [stage])

  const handleRequest = async () => {
    if (!form.phone_number.trim() || !form.current_password.trim() || !form.new_email.trim()) {
      setErrorMessage('Enter your phone number, password and new email address.')
      return
    }

    setLoading(true)
    setErrorMessage(null)

    try {
      const response = await requestUnconfirmedEmailRecovery({
        phone_number: form.phone_number.trim(),
        current_password: form.current_password,
        new_email: form.new_email.trim(),
      })
      setDebugOtp(String(response?.debug_otp || ''))
      setStage('verify')
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to verify this account')
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = async () => {
    if (!form.phone_otp_code.trim()) {
      setErrorMessage('Enter the verification code sent to your phone.')
      return
    }

    setLoading(true)
    setErrorMessage(null)

    try {
      await confirmUnconfirmedEmailRecovery({
        phone_number: form.phone_number.trim(),
        current_password: form.current_password,
        new_email: form.new_email.trim(),
        phone_otp_code: form.phone_otp_code.trim(),
      })
      await setEmailForVerification(form.new_email.trim())
      await setConfirmationFlow('signup')
      router.replace({ pathname: '/confirmEmail', params: { flow: 'signup', email: form.new_email.trim() } })
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to update unconfirmed email')
    } finally {
      setLoading(false)
    }
  }

  const handleBack = () => {
    if (stage === 'verify') {
      setStage('request')
      setErrorMessage(null)
      return
    }
    backOrFallback(router, '/login')
  }

  return (
    <AuthShell>
      <AuthHeader showBack onBack={handleBack} rightLabel="Sign in" onRightPress={() => router.replace('/login')} />
      <ProductHero />
      <FlowMarker eyebrow="Account recovery" label={stepLabel} progress={stage === 'request' ? 0.5 : 1} />
      <TaskHeading
        title={stage === 'request' ? 'Update your sign-in email' : 'Enter phone verification code'}
        subtitle={
          stage === 'request'
            ? 'For unconfirmed accounts only. Verify your phone and password first, then we will send confirmation to your corrected email.'
            : 'Enter the 6-digit code sent to your verified phone. We will then send a confirmation link to your new email address.'
        }
      />

      <View className="mt-8">
        {stage === 'request' ? (
          <>
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
                  value={form.phone_number}
                  autoComplete="tel"
                  keyboardType="phone-pad"
                  textContentType="telephoneNumber"
                  onChangeText={(value: string) => setForm((prev) => ({ ...prev, phone_number: value }))}
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
            <HelperText>Use the verified phone number linked to the unconfirmed account.</HelperText>

            <InputLabel>Current password</InputLabel>
            <FormInput
              accessibilityLabel="Current password"
              placeholder="Enter your password"
              value={form.current_password}
              isPassword
              secureTextEntry={hidePassword}
              hidePassword={hidePassword}
              setHidePassword={setHidePassword}
              textContentType="password"
              autoComplete="password"
              onChangeText={(value: string) => setForm((prev) => ({ ...prev, current_password: value }))}
              style={authFieldInputStyle}
              className="text-white py-3.5 my-0 text-base font-semibold px-4"
            />

            <InputLabel>New email address</InputLabel>
            <FormInput
              accessibilityLabel="New email address"
              placeholder="you@example.com"
              value={form.new_email}
              autoComplete="email"
              textContentType="emailAddress"
              keyboardType="email-address"
              onChangeText={(value: string) => setForm((prev) => ({ ...prev, new_email: value }))}
              style={authFieldInputStyle}
              className="text-white my-0 py-3.5 text-base font-semibold px-4"
            />
            <HelperText>This email will become your sign-in and password reset address after confirmation.</HelperText>

            {errorMessage ? <InlineNotice message={errorMessage} /> : null}
            <PrimaryButton label="Send verification code →" onPress={handleRequest} loading={loading} />
          </>
        ) : (
          <>
            <InputLabel>Phone verification code</InputLabel>
            <FormInput
              accessibilityLabel="Phone verification code"
              placeholder="123456"
              value={form.phone_otp_code}
              autoComplete="one-time-code"
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              onChangeText={(value: string) => setForm((prev) => ({ ...prev, phone_otp_code: value.replace(/[^0-9]/g, '') }))}
              style={{ ...authFieldInputStyle, borderColor: 'rgba(59, 130, 246, 0.34)' }}
              className="text-white my-0 py-3.5 text-[22px] font-semibold tracking-[0.22em] text-center"
            />
            <HelperText>After verification, we will send a confirmation link to {form.new_email.trim() || 'your new email'}.</HelperText>
            {debugOtp && __DEV__ ? <HelperText tone="success">Dev OTP: {debugOtp}</HelperText> : null}
            {errorMessage ? <InlineNotice message={errorMessage} /> : null}
            <PrimaryButton label="Update email →" onPress={handleConfirm} loading={loading} />

            <TouchableOpacity onPress={handleRequest} disabled={loading} className="mt-4">
              <Text style={{ color: loading ? AUTH_COLORS.tertiaryText : AUTH_COLORS.accentText, fontSize: 13, fontWeight: '600', textAlign: 'center' }}>
                Resend code
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </AuthShell>
  )
}

export default RecoverUnconfirmed
