import React, { useState } from 'react'
import { Text, View } from 'react-native'
import { Link, useRouter } from 'expo-router'
import { useAuth } from '@/services/useAuth'
import { setConfirmationFlow, setEmailForVerification } from '@/auth/tokenstore'
import FormInput from '@/components/FormInput'
import {
  AUTH_COLORS,
  AuthHeader,
  AuthShell,
  BottomMeta,
  FlowMarker,
  InlineNotice,
  InputLabel,
  PrimaryButton,
  ProductHero,
  TaskHeading,
  authFieldInputStyle,
} from '@/components/auth/AuthScaffold'
import { error as logError } from '@/utils/log'

const Login = () => {
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const router = useRouter()
  const [formInput, setFormInput] = useState({ email: '', password: '' })
  const [hidePassword, setHidePassword] = useState(true)
  const [loading, setLoading] = useState(false)
  const { onLogin, authState } = useAuth()

  const handleLogin = async () => {
    const email = formInput.email.trim()
    const password = formInput.password.trim()

    try {
      setErrorMessage(null)

      if (!email || !password) {
        throw new Error('Enter login details.')
      }

      setLoading(true)
      await onLogin({ email, password })
      router.replace('/')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed'
      const code = err && typeof err === 'object' && 'code' in err ? String((err as { code?: string | null }).code || '') : ''

      if (code === 'email_not_confirmed') {
        await setEmailForVerification(email)
        await setConfirmationFlow('login-unconfirmed')
        router.push({ pathname: '/confirmEmail', params: { flow: 'login-unconfirmed', email } })
        return
      }

      setErrorMessage(message)
      logError('Login error:', message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell>
      <AuthHeader rightLabel="Sign up" onRightPress={() => router.replace('/sign-up')} />
      <ProductHero />
      <FlowMarker eyebrow="Sign in" label="Secure access" progress={0.34} />
      <TaskHeading title="Welcome back" subtitle="Sign in with the email address linked to your BitBridge Global account." />

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
          placeholder="Enter your password"
          value={formInput.password}
          isPassword
          secureTextEntry={hidePassword}
          hidePassword={hidePassword}
          setHidePassword={setHidePassword}
          textContentType="password"
          autoComplete="password"
          onChangeText={(value: string) => setFormInput({ ...formInput, password: value })}
          style={authFieldInputStyle}
          className="text-white py-3.5 my-0 text-base font-semibold px-4"
        />

        <Link href="/forgot-password" style={{ color: AUTH_COLORS.secondaryText, fontSize: 13, fontWeight: '600', alignSelf: 'flex-end', marginTop: 6 }}>
          Forgot password?
        </Link>

        {errorMessage ? <InlineNotice message={errorMessage} /> : null}

        <PrimaryButton label="Sign in" onPress={handleLogin} loading={loading} />

        {__DEV__ ? (
          <Text style={{ color: AUTH_COLORS.tertiaryText, marginTop: 10, fontSize: 11, textAlign: 'center' }}>
            Authenticated: {String(authState?.authenticated)}
          </Text>
        ) : null}

        <BottomMeta
          trustCopy="Protected by bank-grade security"
          prefixText="New to BitBridge Global?"
          linkText="Create an account"
          linkAction={() => router.replace('/sign-up')}
        />
      </View>
    </AuthShell>
  )
}

export default Login




