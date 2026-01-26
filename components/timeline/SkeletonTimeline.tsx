import React, { useEffect, useRef } from 'react'
import { Animated, View } from 'react-native'

const SkeletonCard = ({ shimmer }: { shimmer: Animated.Value }) => (
  <Animated.View
    style={{ opacity: shimmer }}
    className="bg-gray-900/60 border border-white/5 rounded-2xl p-4 my-2"
  >
    <View className="flex-row items-center justify-between">
      <View className="flex-row items-center flex-1">
        <View className="w-12 h-12 rounded-full bg-gray-800" />
        <View className="ml-3 flex-1">
          <View className="h-3 bg-gray-800 rounded-full w-3/4" />
          <View className="h-2 bg-gray-800 rounded-full w-1/2 mt-2" />
        </View>
      </View>
      <View className="h-3 bg-gray-800 rounded-full w-16" />
    </View>
    <View className="flex-row justify-between mt-4">
      <View className="h-2 bg-gray-800 rounded-full w-24" />
      <View className="h-2 bg-gray-800 rounded-full w-12" />
      <View className="h-2 bg-gray-800 rounded-full w-16" />
    </View>
  </Animated.View>
)

const SkeletonTimeline = () => {
  const shimmer = useRef(new Animated.Value(0.4)).current

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(shimmer, {
          toValue: 0.4,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start()
  }, [shimmer])

  return (
    <View className="pt-2">
      {[...Array(7)].map((_, index) => (
        <SkeletonCard key={`sk-${index}`} shimmer={shimmer} />
      ))}
    </View>
  )
}

export default SkeletonTimeline
