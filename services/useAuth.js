import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import * as SecureStore from "expo-secure-store";
import APP_CONFIG from "@/api/baseUrl";
import axios from "axios";
import { Flag } from "react-native-appwrite";

// interface AuthState {
//   token: string | null;
//   authenticated: boolean | null;
// }

// interface AuthProps {
//   authState: AuthState;
//   onRegister: (email: string, password: string) => Promise<any>;
//   onLogin: (email: string, password: string) => Promise<any>;
//   onLogout: () => Promise<any>;
// }

// const APP_CONFIG = {
//   BASE_URL: process.env.EXPO_PUBLIC_BASE_URL_DEV,

// }

const token_key = "auth_token";
const {base_url, api_route} = APP_CONFIG

const AuthContext = createContext(null);

// Hook for consuming auth
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};


// Provider component
const AuthProvider = ({ children }) => {
  const [authState, setAuthState] = useState({
    token: null,
    authenticated: null,
  });

  const [loadingState, setLoadingState] = useState(true)
  const [errorMessage, setErrorMessage] = useState(null)

  const [authProfile, setAuthProfile] = useState(null);

  useEffect(() => {
    const loadToken = async () => {
      const token = await SecureStore.getItemAsync(token_key);
      if (token) {
        setAuthState({ token, authenticated: true });
       await userProfile(token)
      }

      setLoadingState(false)


    };
    loadToken();
  }, []);

  const register = async (formData) => {
    const user = {
      email,
      password,
      user_profile_attributes: {
        first_name: formData.first_name,
        last_name: formData.last_name,
        phone_number: formData.phone
      }
    }
    try {
      const response = await fetch(`${base_url}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(user),
      });
      const result = await response.json();

      if (!response.ok){ throw new Error( result?.message ?? "Failed to register");}



      const authheader = response.headers.get('Authorization')      
      const token = authheader.split(" ")[1];

      if(!token){
              throw new Error("No token returned")
            }
           

      await SecureStore.setItemAsync(token_key, token);
      setAuthState({ token: token, authenticated: true });

      return result;
    } catch (error) {
      if (error instanceof Error) {
              throw error;
            } else {
              throw new Error("Something went wrong");
            }        }
  };

  const login = async (data) => {

    try {
      const response = await fetch(`https://bitbridgeglobal-fa54ecb89f7d.herokuapp.com/login`, { 
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({user: data}),
      });

      if (!response.ok) {
        const result = await response.text();


        throw new Error(result);
      }


      const result = await response.json();

      const token = response.headers.get('Authorization').split(" ")[1]

      if(!token){
        throw new Error("No token returned")

      }
      
      await SecureStore.setItemAsync(token_key, token);
      setAuthState({ token: token, authenticated: true });

      return result;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      } else {
        throw new Error("Something went wrong");
      }    
    }
  };

  const logout = async () => {
    try {
      await SecureStore.deleteItemAsync(token_key);
      setAuthState({ token: null, authenticated: false });
    } catch (error) {
      console.error("Logout error:", error);
    }
  };


  const userProfile = async(token) => {

    try {
      
              const response = await axios.get(`${base_url + api_route}users/user_profile`, {  
                  headers: {
                "Authorization": `Bearer ${token}`
            }})
              const {data} =  response.data
              setAuthProfile(data)
              return data

          } catch (error) {
              if(error.response){
                await SecureStore.deleteItemAsync(token_key);
                setAuthState({token: null, authenticated: false })
                  return  error.response.data || "error occured"
              }
      
              return   "something went wrong"
      
          }
      
      }

  const value = {
    onRegister: register,
    onLogin: login,
    onLogout: logout,
    loading: loadingState,
    userProfileData: authProfile,
    loadProfile: userProfile,
    authState
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
