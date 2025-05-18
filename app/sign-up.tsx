import { ActivityIndicator, Image, KeyboardAvoidingView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import React, { useState } from 'react'
import { icons } from '@/constants/icons'
import { Link, router } from 'expo-router'
import { Formik } from 'formik';
import { useAuth } from '@/services/useAuth';
import FormInput from '@/components/FormInput';
import KeyboardAvoidWrapper from '@/components/keyboardAvoidWrapper/KeyboardAvoidWrapper';

const Login = () => {
         const [formInput, setFormInput] = useState({
             email: "",
             first_name: "",
             last_name: "",
             phone: "",
             password: ""
         })
       const [loading, setLoading] = useState(false)
   
       const [hidePassword, setHidePassword] = useState(true)
   
       const {onRegister} = useAuth()

    const handleLogin = async () => {
        setLoading(true)
        try {

          const result = await onRegister(formInput);

          setLoading(false)          
        } catch (error) {
          // Handle errors during the login process
          console.error("Login error:", error.message);
          setLoading(false)

        }
      };
  return (
    <View className='flex-1  bg-gray-950'>
        <KeyboardAvoidWrapper>
          <View>
            <Image source={icons.appLogo} className="w-full h-48 0 mt-20 mb-5 mx-auto"/>
           
            <View className=''>
             <FormInput 
              placeholder='First Name' 
              onChangeText={(value) => setFormInput({...formInput, first_name: value })}
              className='border-gray-800 border-b text-white  my-0 py-4 border-b-1 text-base font-semibold px-3 '
              />
              <FormInput 
              placeholder='Last Name' 
              onChangeText={(value) => setFormInput({...formInput, last_name: value })}
              className='border-gray-600 border-b text-white  my-0 py-4 border-b-1 text-base font-semibold px-3 '
              />
                <FormInput 
              placeholder='Email Address' 
              onChangeText={(value) => setFormInput({...formInput, email: value })}
              className='border-gray-600 border-b text-white  my-0 py-4 border-b-1 text-base font-semibold px-3 '
              />
              <FormInput  placeholder='Enter Password' 
              isPassword={true}
              secureTextEntry={hidePassword}
              hidePassword={hidePassword}
              setHidePassword={setHidePassword}
            onChangeText={(value) => setFormInput({...formInput, password: value })}
            className='border-gray-600 text-white border-b py-4 my-0  border-b-1 text-base font-semibold px-3 '
            />
             <FormInput  placeholder='Confirm Password' 
              isPassword={true}
              secureTextEntry={hidePassword}
              hidePassword={hidePassword}
              setHidePassword={setHidePassword}
            onChangeText={(value) => setFormInput({...formInput, password: value })}
            className='border-gray-600 text-white border-b py-4 my-0  border-b-1 text-base font-semibold px-3 '
            />
            <TouchableOpacity className='py-3  flex-row items-center flex justify-center mt-10  bg-app-primary rounded-lg'
              onPress={handleLogin}
              >
                {loading ? <ActivityIndicator/> :
                  <Text className=' font-semibold text-base text-gray-100'>Register</Text>
                }
            </TouchableOpacity> 

        </View>



        </View>
        </KeyboardAvoidWrapper>
 
    </View>
  )
}

export default Login

const styles = StyleSheet.create({})