import { Stack } from "expo-router";
import "./globals.css"
import { StatusBar } from "react-native";
import AuthProvider from "@/services/useAuth";

export default function RootLayout() {
  return  <>
  <AuthProvider>
    
      <StatusBar hidden={true} />

   <Stack >
    <Stack.Screen
    name="(tabs)"
    options={{
      headerShown: false
    }} />

<Stack.Screen
    name="mobile/[service]"
    options={{
      headerShown: false
    }} />

<Stack.Screen
    name="mobileProviders/[id]"
    options={{
      headerShown: false
    }} />

    </Stack>

    
  </AuthProvider>
    </>;
}
 