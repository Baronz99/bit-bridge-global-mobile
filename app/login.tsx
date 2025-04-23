import { Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import React, { useState } from 'react'
import { icons } from '@/constants/icons'
import { router } from 'expo-router'
import { Formik } from 'formik';
import { useAuth } from '@/services/useAuth';

const Login = () => {
    const [formInput, setFormInput] = useState({
        email: "",
        password: ""
    })

    const {onLogin} = useAuth()

    console.log(formInput)




    const handleLogin = async () => {
        try {
          const result = await onLogin(formInput);

          
        } catch (error) {
          // Handle errors during the login process
          console.error("Login error:", error.message);
        }
      };
  return (
    <View className='flex-1 px-12 items-center justify-center bg-blue-'>
        <Image source={icons.appLogo} className="w-full h-96 0 mt-20 mb-5 mx-auto"/>
        <Text className='font-semibold text-2xl text-gray-600'> Login </Text>
                <View className='bg- w-full'>
            {/* <Text className='text-left'>Email:</Text> */}

            <Formik
            onSubmit={(values, {setSubmitting})=> {
                if(values.email == "" || values.password == ""){
                    console.log("first")
                    // setSubmitting(false)
                }else{
                    handleLogin   (values, setSubmitting)    
            }

            }}

            initialValues={{
                email: "",
                password: ""
            }}
            
            >
              {  ({handleChange, handleBlur, handleSubmit, values, isSubmitting}) => (
                        <View>

                        <TextInput  placeholder='Email' 

                        onChangeText={(value) => setFormInput({...formInput, email: value })}
                        className='border-gray-600 border-b py-4 bg-gray-200 border-b-1 text-base font-semibold px-3 '
                        />
                            <TextInput 
                               onChangeText={(value) => setFormInput({...formInput, password: value })}
                               secureTextEntry placeholder='Password' 
                               className='border-gray-600 border-b mt-4 py-4 bg-gray-200 border-b-1 text-base font-semibold px-3'/>
                            <TouchableOpacity className='py-3  flex-row items-center flex justify-center mt-4  bg-app-primary rounded-lg'
                            onPress={handleLogin}
                            >
                                {/* <Image source={icons.arrow} className='size-5 mr-1 mt-0.5 rotate-180' tintColor={"red"} /> */}
                                <Text className=' font-semibold text-base text-gray-100'>Login</Text>
    
                            </TouchableOpacity> 
                </View>
    
                )}
            
</Formik>
                   
          </View>
 
    </View>
  )
}

export default Login

const styles = StyleSheet.create({})