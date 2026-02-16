import React, { useEffect, useMemo, useRef } from 'react'
import { Animated, Easing, Image, View, StyleSheet } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'

type BootScreenProps = {
  visible: boolean
}

const AnimatedLinear = Animated.createAnimatedComponent(LinearGradient)

export default function BootScreen({ visible }: BootScreenProps) {
  const ringScale = useRef(new Animated.Value(1)).current
  const ringOpacity = useRef(new Animated.Value(0.35)).current
  const logoScale = useRef(new Animated.Value(1)).current
  const shimmerX = useRef(new Animated.Value(-1)).current

  useEffect(() => {
    if (!visible) return

    const ring = Animated.loop(
      Animated.parallel([
        Animated.timing(ringScale, {
          toValue: 1.18,
          duration: 1700,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(ringOpacity, {
          toValue: 0,
          duration: 1700,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    )

    const logo = Animated.loop(
      Animated.sequence([
        Animated.timing(logoScale, {
          toValue: 1.02,
          duration: 1200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(logoScale, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    )

    const shimmer = Animated.loop(
      Animated.timing(shimmerX, {
        toValue: 1,
        duration: 1900,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    )

    ring.start()
    logo.start()
    shimmer.start()

    return () => {
      ring.stop()
      logo.stop()
      shimmer.stop()
      ringScale.setValue(1)
      ringOpacity.setValue(0.35)
      logoScale.setValue(1)
      shimmerX.setValue(-1)
    }
  }, [visible, logoScale, ringOpacity, ringScale, shimmerX])

  const shimmerTranslateX = useMemo(
    () =>
      shimmerX.interpolate({
        inputRange: [-1, 1],
        outputRange: [-180, 180],
      }),
    [shimmerX]
  )

  if (!visible) return null

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="auto"
      accessibilityLabel="Loading your account"
      accessibilityRole="progressbar"
      accessible
    >
      <LinearGradient
        colors={['#05070D', '#090C14', '#0C111C']}
        locations={[0, 0.56, 1]}
        style={styles.background}
      >
        <View style={styles.centerWrap}>
          <View style={styles.logoWrap}>
            <Animated.View
              style={[
                styles.ring,
                {
                  opacity: ringOpacity,
                  transform: [{ scale: ringScale }],
                },
              ]}
            />
            <Animated.View style={{ transform: [{ scale: logoScale }] }}>
              <Image
                source={require('../../assets/logos/bitbridge-logo-clear.png')}
                style={styles.logo}
                resizeMode="contain"
                accessibilityIgnoresInvertColors
              />
            </Animated.View>
          </View>
        </View>

        <View style={styles.progressTrack}>
          <AnimatedLinear
            colors={['transparent', 'rgba(130,183,255,0.00)', 'rgba(130,183,255,0.38)', 'rgba(130,183,255,0.00)', 'transparent']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={[
              styles.progressShimmer,
              {
                transform: [{ translateX: shimmerTranslateX }],
              },
            ]}
          />
        </View>
      </LinearGradient>
    </View>
  )
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrap: {
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: 132,
    height: 132,
    borderRadius: 66,
    borderWidth: 1.5,
    borderColor: 'rgba(161,198,255,0.45)',
  },
  logo: {
    width: 126,
    height: 126,
  },
  progressTrack: {
    position: 'absolute',
    bottom: 42,
    width: 140,
    height: 2,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  progressShimmer: {
    width: 92,
    height: 2,
  },
})

