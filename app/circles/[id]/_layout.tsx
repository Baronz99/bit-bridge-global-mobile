import React from 'react'
import { Stack } from 'expo-router'

export default function CircleWorkspaceLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        headerStyle: { backgroundColor: '#030014' },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: { color: '#FFFFFF' },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false, animation: 'none' }} />
      <Stack.Screen name="pay" options={{ animation: 'none' }} />
      <Stack.Screen name="manage" options={{ animation: 'none' }} />
      <Stack.Screen name="timeline" options={{ animation: 'none' }} />
      <Stack.Screen name="treasury" options={{ animation: 'none' }} />
      <Stack.Screen name="treasury/inflows" options={{ animation: 'default' }} />
      <Stack.Screen name="treasury/inflows/[inflowId]" options={{ animation: 'default' }} />
      <Stack.Screen name="treasury/payouts" options={{ animation: 'default' }} />
      <Stack.Screen name="timeline/[eventId]" options={{ animation: 'default' }} />
      <Stack.Screen name="fund" options={{ animation: 'default' }} />
      <Stack.Screen name="withdraw" options={{ animation: 'default' }} />
      <Stack.Screen name="activities" options={{ animation: 'default' }} />
      <Stack.Screen name="audit" options={{ animation: 'default' }} />
      <Stack.Screen
        name="display-name"
        options={{ animation: 'default', headerShown: true, headerTitle: 'Your name in this circle' }}
      />
      <Stack.Screen
        name="governance"
        options={{ animation: 'default', headerShown: true, headerTitle: 'Decisions' }}
      />
      <Stack.Screen
        name="invite"
        options={{ animation: 'default', headerShown: true, headerTitle: 'Invite member' }}
      />
      <Stack.Screen
        name="members"
        options={{ animation: 'default', headerShown: true, headerTitle: 'People' }}
      />
    </Stack>
  )
}
