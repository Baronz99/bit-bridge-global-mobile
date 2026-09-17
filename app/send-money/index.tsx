import { Redirect } from 'expo-router'

// Internal BitBridge-to-BitBridge transfers are temporarily unavailable.
// Keep the legacy path safe for old deep links while directing users to the
// supported external bank-transfer flow.
export default function SendMoneyRedirect() {
  return <Redirect href="/bank-transfer" />
}
