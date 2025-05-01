import { Stack } from "expo-router";
import "./globals.css"
import { StatusBar } from "react-native";
import AuthProvider from "@/services/useAuth";

export default function RootLayout() {
  return  <>
  <AuthProvider>
    
      <StatusBar hidden={true} />

   <Stack 
   screenOptions={{
    
      // headerShown: false,
      headerTitleStyle: {
        color: "orange"

      },
      headerStyle: {
        backgroundColor: "#030014"

      }
    
   }}
   >
    <Stack.Screen
    name="(tabs)"
    options={{
      headerShown: false,
      headerTitle: "Home",
      headerTitleStyle: {
        color: "orange"

      },
      // headerTintColor: "red"
    }} 
    />

    <Stack.Screen
        name="mobileProviders/index"
        options={{
          headerTitle: "Mobile Top Up"

        }}
        />
        <Stack.Screen
        name="fundWallet/index"
        options={{
          headerTitle: "Fund Wallet"

        }}
        />
        
      <Stack.Screen
        name="mobileProviders/[id]/index"
        options={{
          headerTitle: "Mobile Top Up"

        }}
        />

        <Stack.Screen
          name="withdrawFund/index"
          options={{
            headerTitle: "WithdrawFund"

          }}
        />

    </Stack>

    
  </AuthProvider>
    </>;
}
 