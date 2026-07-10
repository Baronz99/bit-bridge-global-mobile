import React from 'react'
import { Redirect, useLocalSearchParams } from 'expo-router'

export default function PowerProviderDetailRedirect() {
  const params = useLocalSearchParams()

  return <Redirect href={{ pathname: '/electricity-provider/[id]', params }} />
}
