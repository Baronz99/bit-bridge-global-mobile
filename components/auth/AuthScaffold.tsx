import React from 'react'
import {
  ActivityIndicator,
  Image,
  SafeAreaView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import KeyboardAvoidWrapper from '@/components/keyboardAvoidWrapper/KeyboardAvoidWrapper'
import { icons } from '@/constants/icons'

export const AUTH_COLORS = {
  background: '#070B14',
  surface: '#0E1627',
  surfaceBorder: 'rgba(148, 163, 184, 0.18)',
  chromeBorder: 'rgba(148, 163, 184, 0.10)',
  primaryText: '#F8FAFC',
  secondaryText: '#94A3B8',
  tertiaryText: '#64748B',
  accent: '#2563EB',
  accentPressed: '#1D4ED8',
  accentText: '#60A5FA',
  errorBg: 'rgba(239, 68, 68, 0.10)',
  errorBorder: 'rgba(248, 113, 113, 0.20)',
  errorText: '#FCA5A5',
  successBg: 'rgba(16, 185, 129, 0.12)',
  successBorder: 'rgba(52, 211, 153, 0.18)',
  successText: '#A7F3D0',
} as const

export const authFieldInputStyle = {
  backgroundColor: AUTH_COLORS.surface,
  color: AUTH_COLORS.primaryText,
  borderRadius: 16,
  borderWidth: 1,
  borderColor: AUTH_COLORS.surfaceBorder,
  marginBottom: 0,
  paddingVertical: 13,
} as const

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: AUTH_COLORS.background }}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidWrapper>
        <View className="flex-1 px-5 pt-3 pb-8">
          <View style={{ width: '100%', maxWidth: 420, alignSelf: 'center' }}>{children}</View>
        </View>
      </KeyboardAvoidWrapper>
    </SafeAreaView>
  )
}

export function AuthHeader({
  showBack,
  onBack,
  rightLabel,
  onRightPress,
}: {
  showBack?: boolean
  onBack?: () => void
  rightLabel: string
  onRightPress: () => void
}) {
  return (
    <View
      style={{
        minHeight: 60,
        justifyContent: 'center',
        position: 'relative',
      }}
    >
      {showBack ? (
        <TouchableOpacity
          accessibilityLabel="Go back"
          onPress={onBack}
          style={{
            position: 'absolute',
            left: 0,
            top: 8,
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(148, 163, 184, 0.07)',
            borderWidth: 1,
            borderColor: AUTH_COLORS.chromeBorder,
          }}
        >
          <Ionicons name="arrow-back" size={17} color={AUTH_COLORS.primaryText} />
        </TouchableOpacity>
      ) : null}

      <View
        style={{
          paddingLeft: showBack ? 50 : 0,
          paddingRight: 92,
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            backgroundColor: 'rgba(148, 163, 184, 0.07)',
            borderWidth: 1,
            borderColor: AUTH_COLORS.chromeBorder,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Image source={icons.appLogoClear} style={{ width: 28, height: 32 }} resizeMode="contain" />
        </View>
        <View style={{ marginLeft: 11 }}>
          <Text
            style={{
              color: AUTH_COLORS.primaryText,
              fontSize: 12,
              fontWeight: '700',
              letterSpacing: 2,
            }}
          >
            BIT BRIDGE GLOBAL
          </Text>
          <Text style={{ color: AUTH_COLORS.tertiaryText, fontSize: 11, marginTop: 3 }}>
            Secure account access
          </Text>
        </View>
      </View>

      <TouchableOpacity
        accessibilityRole="button"
        onPress={onRightPress}
        style={{
          position: 'absolute',
          right: 0,
          top: 9,
          minWidth: 72,
          minHeight: 36,
          alignItems: 'flex-end',
          justifyContent: 'center',
        }}
      >
        <Text numberOfLines={1} style={{ color: AUTH_COLORS.secondaryText, fontSize: 13, fontWeight: '600' }}>
          {rightLabel}
        </Text>
      </TouchableOpacity>
    </View>
  )
}

export function ProductHero() {
  return (
    <View className="mt-5">
      <Text style={{ color: AUTH_COLORS.primaryText, fontSize: 30, lineHeight: 35, fontWeight: '700', maxWidth: 320 }}>
        Money that works better together.
      </Text>
      <Text style={{ color: AUTH_COLORS.secondaryText, fontSize: 14, lineHeight: 22, marginTop: 10, maxWidth: 332 }}>
        Payments, cards, virtual accounts, and shared money in one secure platform.
      </Text>
    </View>
  )
}

export function FlowMarker({
  eyebrow,
  label,
  progress,
}: {
  eyebrow: string
  label?: string
  progress: number
}) {
  return (
    <View className="mt-7">
      <Text style={{ color: AUTH_COLORS.secondaryText, fontSize: 12, fontWeight: '600' }}>{eyebrow}</Text>
      {label ? (
        <Text style={{ color: AUTH_COLORS.primaryText, fontSize: 14, fontWeight: '600', marginTop: 6 }}>{label}</Text>
      ) : null}
      <View
        style={{
          marginTop: 10,
          width: '100%',
          height: 2,
          borderRadius: 999,
          backgroundColor: 'rgba(148, 163, 184, 0.12)',
          overflow: 'hidden',
        }}
      >
        <View style={{ width: `${Math.max(0, Math.min(progress, 1)) * 100}%`, height: '100%', backgroundColor: AUTH_COLORS.accent }} />
      </View>
    </View>
  )
}

export function TaskHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View className="mt-7">
      <Text style={{ color: AUTH_COLORS.primaryText, fontSize: 24, lineHeight: 30, fontWeight: '700' }}>{title}</Text>
      {subtitle ? (
        <Text style={{ color: AUTH_COLORS.secondaryText, fontSize: 13, lineHeight: 20, marginTop: 8, maxWidth: 360 }}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  )
}

export function InputLabel({ children }: { children: React.ReactNode }) {
  return <Text style={{ color: AUTH_COLORS.primaryText, fontSize: 13, fontWeight: '600', marginBottom: 8 }}>{children}</Text>
}

export function HelperText({ children, tone = 'muted' }: { children: React.ReactNode; tone?: 'muted' | 'success' }) {
  return (
    <Text
      style={{
        color: tone === 'success' ? AUTH_COLORS.successText : AUTH_COLORS.secondaryText,
        fontSize: 11,
        lineHeight: 16,
        marginTop: 8,
      }}
    >
      {children}
    </Text>
  )
}

export function InlineNotice({ message, tone = 'error' }: { message: string; tone?: 'error' | 'success' }) {
  return (
    <View
      style={{
        marginTop: 16,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: tone === 'success' ? AUTH_COLORS.successBorder : AUTH_COLORS.errorBorder,
        backgroundColor: tone === 'success' ? AUTH_COLORS.successBg : AUTH_COLORS.errorBg,
        paddingHorizontal: 14,
        paddingVertical: 11,
      }}
    >
      <Text
        style={{
          color: tone === 'success' ? AUTH_COLORS.successText : AUTH_COLORS.errorText,
          fontSize: 12,
          lineHeight: 18,
        }}
      >
        {message}
      </Text>
    </View>
  )
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
}: {
  label: string
  onPress: () => void
  disabled?: boolean
  loading?: boolean
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={{
        marginTop: 22,
        borderRadius: 16,
        backgroundColor: disabled || loading ? AUTH_COLORS.accentPressed : AUTH_COLORS.accent,
        opacity: disabled || loading ? 0.74 : 1,
        paddingVertical: 15,
        paddingHorizontal: 18,
      }}
    >
      {loading ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <Text style={{ color: '#FFFFFF', textAlign: 'center', fontSize: 15, fontWeight: '700' }}>{label}</Text>
      )}
    </TouchableOpacity>
  )
}

export function BottomMeta({
  trustCopy,
  prefixText,
  linkText,
  linkAction,
}: {
  trustCopy: string
  prefixText: string
  linkText: string
  linkAction: () => void
}) {
  return (
    <View className="mt-4 items-center">
      <Text style={{ color: AUTH_COLORS.tertiaryText, fontSize: 11, lineHeight: 16, textAlign: 'center' }}>
        {trustCopy}
      </Text>
      <View className="mt-4 flex-row items-center justify-center" style={{ flexWrap: 'nowrap' }}>
        <Text style={{ color: AUTH_COLORS.secondaryText, fontSize: 13 }}>{prefixText} </Text>
        <TouchableOpacity onPress={linkAction}>
          <Text style={{ color: AUTH_COLORS.accentText, fontSize: 13, fontWeight: '600' }}>{linkText}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}
