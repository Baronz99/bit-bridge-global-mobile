import { Image, KeyboardAvoidingView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
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
        password: ""
    })

    const {onLogin} = useAuth()



    const handleLogin = async () => {
        try {
          const result = await onLogin(formInput);

          
        } catch (error) {
          // Handle errors during the login process
          console.error("Login error:", error.message);
        }
      };
  return (
    <View className='flex-1  bg-primary'>
        <KeyboardAvoidWrapper>

<View>
<Image source={icons.appLogo} className="w-full h-96 0 mt-20 mb-5 mx-auto"/>
<Link href={"/sign-up"} asChild>        
<TouchableOpacity className='w-24 m-auto py-3' >
  <Text className='text-white text-center'>Log In</Text>
</TouchableOpacity>
</Link>
  
<View>
<FormInput 
  placeholder='Enter Email Address' 
  onChangeText={(value) => setFormInput({...formInput, email: value })}
  className='border-gray-600 border-b  my-0 py-4 border-b-1 text-base font-semibold px-3 '
  />
   <FormInput  placeholder='Enter Password' 

    onChangeText={(value) => setFormInput({...formInput, email: value })}
    className='border-gray-600 border-b py-4 my-0  border-b-1 text-base font-semibold px-3 '
    />
    <TouchableOpacity className='py-3  flex-row items-center flex justify-center mt-10  bg-app-primary rounded-lg'
      onPress={handleLogin}
      >
          {/* <Image source={icons.arrow} className='size-5 mr-1 mt-0.5 rotate-180' tintColor={"red"} /> */}
          <Text className=' font-semibold text-base text-gray-100'>Register</Text>

    </TouchableOpacity> 

</View>



</View>
</KeyboardAvoidWrapper>
 
    </View>
  )
}

export default Login

const styles = StyleSheet.create({})