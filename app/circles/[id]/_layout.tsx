import React from 'react'
import { Stack } from 'expo-router'

export default function CircleWorkspaceLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="pay" options={{ animation: 'none' }} />
      <Stack.Screen name="manage" options={{ animation: 'none' }} />
      <Stack.Screen name="timeline" options={{ animation: 'none' }} />
      <Stack.Screen name="treasury" options={{ animation: 'none' }} />
      <Stack.Screen name="treasury/payouts" options={{ animation: 'default' }} />
      <Stack.Screen name="timeline/[eventId]" options={{ animation: 'default' }} />
      <Stack.Screen name="fund" options={{ animation: 'default' }} />
      <Stack.Screen name="withdraw" options={{ animation: 'default' }} />
      <Stack.Screen name="activities" options={{ animation: 'default' }} />
      <Stack.Screen name="audit" options={{ animation: 'default' }} />
      <Stack.Screen name="display-name" options={{ animation: 'default' }} />
      <Stack.Screen name="governance" options={{ animation: 'default' }} />
      <Stack.Screen name="invite" options={{ animation: 'default' }} />
      <Stack.Screen name="members" options={{ animation: 'default' }} />
    </Stack>
  )
}
