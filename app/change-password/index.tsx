import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import React, { useEffect, useState } from 'react'
import { userPasswordUpdate, userProfileUpdate } from '@/api/auth'
import { useAuth } from '@/services/useAuth'
import KeyboardAvoidWrapper from '@/components/keyboardAvoidWrapper/KeyboardAvoidWrapper'
import FormInput from '@/components/FormInput'
import { icons } from '@/constants/icons'
import { images } from '@/constants/images'
import Loader from '@/components/Loader'

const index = () => {
     const [errorMessage, setErrorMessage] = useState(null)
     const {authState: {token}, userProfileData, loadProfile } = useAuth()

     const [toggleModal, setToggleModal] = useState(false)
     const [error, setError] = useState(null)
      
      
             const [formInput, setFormInput] = useState({
                 password: "",
                 confirm_password: "",
                 old_password: ""
             })
           const [loading, setLoading] = useState(false)
       
           const [hidePassword, setHidePassword] = useState(true)
       
             
        const handleUpdate = async () => {
            setLoading(true)
            try {
    
              const result = await userPasswordUpdate({
                token: token,
                formData: formInput,
                 
              });
    
              setLoading(false)          
            } catch (error: any) {
              // Handle errors during the login process
              setErrorMessage(error.message)
              setLoading(false)
    
            }
          };

          const handleHidePassword = () => {
            setHidePassword(!hidePassword)
          }

  return (
    <>
    
 <View className='flex-1  bg-gray-950'>
  
        <KeyboardAvoidWrapper>
          <View>
            <Image source={images?.user} className="w-20 h-20 0 mt-20 mb-5 mx-auto"/>
           
            <View className=''>
             <FormInput 
              placeholder='Old Password'
              secureTextEntry={hidePassword} 
              value={formInput.old_password}
              onChangeText={(value) => setFormInput({...formInput, old_password: value })}
              className='border-gray-800 border-b text-white  my-0 py-4 border-b-1 text-base font-semibold px-3 '
              />
            
            <FormInput 
            value={formInput?.confirm_password}
              placeholder='New Password ' 
              onChangeText={(value) => setFormInput({...formInput, password: value })}
              className='border-gray-600 border-b text-white  my-0 py-4 border-b-1 text-base font-semibold px-3 '
              />  
              <FormInput 
            value={formInput?.confirm_password}
              placeholder='Confirm Password' 
              onChangeText={(value) => setFormInput({...formInput, confirm_password: value })}
              className='border-gray-600 border-b text-white  my-0 py-4 border-b-1 text-base font-semibold px-3 '
              />
              
            <Text className='text-red-600'>{errorMessage} </Text>
            
            <TouchableOpacity className='py-3  flex-row items-center flex justify-center mt-10  bg-app-primary rounded-lg'
              onPress={handleUpdate}
              >
                {loading ? <ActivityIndicator/> :
                  <Text className=' font-semibold text-base text-gray-100'>Save Password</Text>
                }
            </TouchableOpacity> 

        </View>



        </View>
        </KeyboardAvoidWrapper>
 
    </View>

    <Loader open={loading}/>

    </>
  )
}

export default index

const styles = StyleSheet.create({})