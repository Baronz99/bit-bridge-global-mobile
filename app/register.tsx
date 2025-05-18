import { Image, Text, TextInput, TouchableOpacity, View } from 'react-native'
import React, { useState } from 'react'
import { icons } from '@/constants/icons'
import { router } from 'expo-router'
import { Formik } from 'formik';
import { useAuth } from '@/services/useAuth';
import FormInput from '@/components/FormInput';

const Register = () => {
    const [formInput, setFormInput] = useState({
        email: "",
        first_name: "",
        last_name: "",
        phone: "",
        password: ""
    })

    const {onRegister} = useAuth()




    const handleLogin = async () => {
        try {
          const result = await onRegister(formInput);

          
        } catch (error) {
          // Handle errors during the login process
          console.error("Login error:", error.message);
        }
      };
  return (
    <View className='flex-1 px-4 -12 items-center justify-center bg-gray-950'>
        <Image source={icons.appLogo} className="w-full h-96 0 mt-0 mb-5 mx-auto"/>
          <View className='bg- w-full'>
            {/* <Text className='text-left'>Email:</Text> */}

            {/* <Formik
            onSubmit={(values, {setSubmitting})=> {
                if(values.email == "" || values.password == ""){
                    // setSubmitting(false)
                }else{
                    handleLogin(values, setSubmitting)    
            }

            }}

            initialValues={{
                email: "",
                password: ""
            }}
            
            >
              {  ({handleChange, handleBlur, handleSubmit, values, isSubmitting}) => ( */}
              <View>

                  



                 
                         <TextInput  placeholder='Email' 

                        onChangeText={(value) => setFormInput({...formInput, email: value })}
                        className='border-gray-600 border-b mb-4 py-4  border-b-1 text-base font-semibold px-3 '
                        />
                         <TextInput  placeholder='Email' 

                        onChangeText={(value) => setFormInput({...formInput, email: value })}
                        className='border-gray-600 border-b mb-4 py-4 border-b-1 text-base font-semibold px-3 '
                        />
                         <TextInput  placeholder='Email' 

                        onChangeText={(value) => setFormInput({...formInput, email: value })}
                        className='border-gray-600 border-b mb-4 py-4 bg-gray-200 border-b-1 text-base font-semibold px-3 '
                        />
                         <TextInput  placeholder='Email' 

                        onChangeText={(value) => setFormInput({...formInput, email: value })}
                        className='border-gray-600 border-b mb-4 py-4 bg-gray-200 border-b-1 text-base font-semibold px-3 '
                        />
                        <TextInput 
                               onChangeText={(value) => setFormInput({...formInput, password: value })}
                               secureTextEntry placeholder='Password' 
                               className='border-gray-600 border-b mb-4 py-4 bg-gray-200 border-b-1 text-base font-semibold px-3'
                               />

                               <Text>
                                Dont have an account Sign Up
                               </Text>

                            <TouchableOpacity className='py-3  flex-row items-center flex justify-center mt-4  bg-app-primary rounded-lg'
                            onPress={handleLogin}
                            >
                                {/* <Image source={icons.arrow} className='size-5 mr-1 mt-0.5 rotate-180' tintColor={"red"} /> */}
                                <Text className=' font-semibold text-base text-gray-100'>Sign UP</Text>
    
                            </TouchableOpacity> 
                </View>
    
                {/* )} */}
            
{/* </Formik> */}
                   
          </View>
 
    </View>
  )
}

export default Register