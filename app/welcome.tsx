import { useEffect, useRef } from 'react'
import { Animated, Image, Text, TouchableOpacity, View } from 'react-native'
import { Stack, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

const Welcome = () => {
  const router = useRouter()
  const fade = useRef(new Animated.Value(0)).current
  const translate = useRef(new Animated.Value(12)).current
  const float = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 550, useNativeDriver: true }),
      Animated.timing(translate, { toValue: 0, duration: 550, useNativeDriver: true }),
    ]).start()

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: -3, duration: 2300, useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 2300, useNativeDriver: true }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [fade, translate, float])

  return (
    <SafeAreaView className="flex-1 bg-[#0c1224]">
      <Stack.Screen options={{ headerShown: false }} />

      <View className="absolute inset-0">
        <View className="absolute -top-12 -left-16 h-56 w-56 rounded-full bg-[#1b2540] opacity-25" />
        <View className="absolute bottom-[-40] right-[-80] h-72 w-72 rounded-full bg-[#111827] opacity-30" />
      </View>

      <View className="flex-1 px-6 justify-center">
        <Animated.View style={{ opacity: fade, transform: [{ translateY: translate }] }}>
          <Animated.View style={{ alignItems: 'center', transform: [{ translateY: float }] }}>
            <Image
              source={require('../assets/logos/bitbridge-logo-clear.png')}
              className="w-40 h-12 mb-4"
              resizeMode="contain"
            />
          </Animated.View>

          <Text className="text-white text-2xl font-semibold text-center">Bit Bridge Global</Text>
          <Text className="text-slate-400 text-sm text-center mt-2">
            Modern banking for real life. Payments, savings, and shared money in one secure app.
          </Text>
        </Animated.View>
      </View>

      <Animated.View
        className="px-6 pb-10"
        style={{ opacity: fade, transform: [{ translateY: translate }] }}
      >
        <TouchableOpacity
          className="w-full py-3.5 flex-row items-center justify-center bg-app-primary rounded-xl mb-3"
          onPress={() => router.push('/sign-in')}
        >
          <Text className="font-semibold text-base text-gray-100">Sign in</Text>
        </TouchableOpacity>

        <TouchableOpacity
          className="w-full py-3.5 flex-row items-center justify-center border border-slate-700 rounded-xl"
          onPress={() => router.push('/sign-up')}
        >
          <Text className="font-semibold text-base text-gray-100">Create account</Text>
        </TouchableOpacity>

        <Text className="text-slate-500 text-xs text-center mt-6">
          Secure • Encrypted • Built on regulated banking rails
        </Text>
      </Animated.View>
    </SafeAreaView>
  )
}

export default Welcome
