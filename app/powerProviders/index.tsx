import React from 'react'
import { Redirect, useLocalSearchParams } from 'expo-router'

export default function PowerProvidersRedirect() {
  const params = useLocalSearchParams()

  return <Redirect href={{ pathname: '/electricity-provider', params }} />
}
