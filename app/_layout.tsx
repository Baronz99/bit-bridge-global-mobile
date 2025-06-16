import { Stack } from "expo-router";
import "./globals.css"
import { StatusBar } from "react-native";
import AuthProvider from "@/services/useAuth";

export default function RootLayout() {
  return  <>
  <AuthProvider>
    
      <StatusBar hidden={false}
        barStyle={"light-content"}
        backgroundColor={"black"}
        />

      <Stack 
      screenOptions={{        
        // headerShown: false,
        headerTitleStyle: {
          color: "orange"

        },
        headerStyle: {
          backgroundColor: "#030014"

        },
        headerTintColor: "white"
        
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
                headerTitle: "Withdraw Fund"

              }}
            />
            <Stack.Screen
              name="transaction/confirm"
              options={{
                headerTitle: "Status"

              }}
            />
            
            <Stack.Screen
              name="mobileProviders/[id]/confirm/[orderId]"
              options={{
                headerTitle: "Confirm Payment"

              }}
            />
            <Stack.Screen
              name="cableProviders/[id]/index"
              options={{
                headerTitle: "Subscribe TV"

              }}
            />

            <Stack.Screen
              name="powerProviders/[id]/index"
              options={{
                headerTitle: "Pay Electric Bills"

              }}
            />

              <Stack.Screen
              name="electric-provider/[id]/index"
              options={{
                headerTitle: "Electricity"

              }}
            />


             <Stack.Screen
              name="electricity-provider/[id]/index"
              options={{
                headerTitle: "Electric Bills"

              }}
            />

                 <Stack.Screen
              name="electricity-provider/[id]/confirm/[orderId]"
              options={{
                headerTitle: "Confirm Electric Bills "

              }}
            />
            
            <Stack.Screen
              name="cableProviders/[id]/confirm/[orderId]"
              options={{
                headerTitle: "Confirm Payment"

              }}
            />
            
            
         
            <Stack.Screen
              name="cableProviders/index"
              options={{
                headerTitle: "Cable TV List"

              }}
            />
            
            <Stack.Screen
              name="orderDetails/[id]"
              options={{
                headerTitle: "Details"

              }}
            />
            <Stack.Screen
              name="powerProviders/index"
              options={{
                headerTitle: "Electric Bills"

              }}
            />
            
            <Stack.Screen
              name="powerProviders/[id]/confirm/[orderId]"
              options={{
                headerTitle: "Confirm Utility Bills"

              }}
            />
            
            
            <Stack.Screen
              name="login"
              options={{
                headerShown: false,
              }}
            />

            <Stack.Screen
              name="sign-up"
              options={{
                headerTitle: "Register"
              }}
            />
  
           
                <Stack.Screen
              name="history/index"
              options={{
                headerTitle: "History"

              }}
            />

             <Stack.Screen
              name="airtime-top-up/index"
              options={{
                headerTitle: "Airtime"              }}
            />

                    <Stack.Screen
              name="airtime-top-up/confirm/[orderId]"
              options={{
                headerTitle: "Confirm Airtime" 
               }}
            />
                     <Stack.Screen
              name="data-subscription/confirm/[orderId]"
              options={{
                headerTitle: "Cornfirm Data" 
               }}
            />
              <Stack.Screen
              name="data-subscription/index"
              options={{
                headerTitle: "Data" 
               }}
            />
            <Stack.Screen
              name="electricity-provider/index"
              options={{
                headerTitle: "Electricty" 
              }}
            />

            <Stack.Screen
            name="cable-tv-provider/index"
            options={{
              headerTitle: "Cable Tv" 
            }}
          />

              <Stack.Screen
                name="delete-deactivate/index"
                options={{
                  headerShown: true,
                  headerTitle: "Delete Account" 
                }}
              />

              <Stack.Screen
                name="change-password/index"
                options={{
                  headerShown: true,
                  headerTitle: "Change Password" 
                }}
              />
              
              <Stack.Screen
                name="legal/index"
                options={{
                  headerShown: true,
                  headerTitle: "Legal" 
                }}
              />     
              <Stack.Screen
                name="cable-tv-provider/confirm/[orderId]"
                options={{
                  headerShown: true,
                  headerTitle: "TV Subsription" 
                }}
              />
              <Stack.Screen
                name="accountProfile/index"
                options={{
                  headerShown: true,
                  headerTitle: "Update Profile" 
                }}
              />


        </Stack>

    
  </AuthProvider>
    </>;
}
 