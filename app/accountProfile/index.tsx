import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import React, { useEffect, useState } from 'react'
import { userProfileUpdate } from '@/api/auth'
import { useAuth } from '@/services/useAuth'
import KeyboardAvoidWrapper from '@/components/keyboardAvoidWrapper/KeyboardAvoidWrapper'
import FormInput from '@/components/FormInput'
import { icons } from '@/constants/icons'
import { images } from '@/constants/images'
import Loader from '@/components/Loader'
import AppAlert from '@/components/app-notification/AppAlert'

const index = () => {
     const [errorMessage, setErrorMessage] = useState({
      error: false,
      message: null,
      data: null
     })
     const {authState: {token}, userProfileData, loadProfile } = useAuth()

      
      const [formInput, setFormInput] = useState({
          email: "",
          first_name: "",
          last_name: "",
          phone: "",
          user_profile_id: "" 
      })
           const [loading, setLoading] = useState(false)
       
           const [hidePassword, setHidePassword] = useState(true)
       
             
        const handleUpdate = async () => {
            setLoading(true)
            try {
    
              const result = await userProfileUpdate({
                token: token,
                formData: {
                  ...formInput,
                  user_profile_id: userProfileData?.user_profile?.id
                }
              });
    
              setLoading(false)  
              loadProfile()
              setErrorMessage({
                error: false,
                data: result?.data,
                message: result?.message
              })

            } catch (error: any) {
              // Handle errors during the login process

              setErrorMessage({
                error: true,
                data: null,
                message: error.message})
              setLoading(false)
    
            }
          };

    useEffect(()=> {
      if(userProfileData){
      setFormInput({
        ...formInput,
        first_name: userProfileData?.user_profile?.first_name,   
        last_name: userProfileData?.user_profile?.last_name,   
        phone: userProfileData?.user_profile?.phone_number,   
        email: userProfileData?.email
        
      })
    }
    },[userProfileData])

   


  return (
    <>
    
 <View className='flex-1  bg-gray-950'>
  
        <KeyboardAvoidWrapper>
          <View>
            <Image source={images?.user} className="w-20 h-20 0 mt-20 mb-5 mx-auto"/>
           
            <View className=''>
             <FormInput 
              placeholder='First Name' 
              value={formInput.first_name}
              onChangeText={(value) => setFormInput({...formInput, first_name: value })}
              className='border-gray-800 border-b text-white  my-0 py-4 border-b-1 text-base font-semibold px-3 '
              />
              <FormInput 
              value={formInput.last_name}
              placeholder='Last Name' 
              onChangeText={(value) => setFormInput({...formInput, last_name: value })}
              className='border-gray-600 border-b text-white  my-0 py-4 border-b-1 text-base font-semibold px-3 '
              />
            <FormInput 
            value={formInput?.email}
              placeholder='Email Address' 
              onChangeText={(value) => setFormInput({...formInput, email: value })}
              className='border-gray-600 border-b text-white  my-0 py-4 border-b-1 text-base font-semibold px-3 '
              />  
              <FormInput 
            value={formInput?.phone}
              placeholder='Phone Number' 
              onChangeText={(value) => setFormInput({...formInput, phone: value })}
              className='border-gray-600 border-b text-white  my-0 py-4 border-b-1 text-base font-semibold px-3 '
              />
              
            <Text className='text-red-600'>{errorMessage.message} </Text>
            
            <TouchableOpacity className='py-3  flex-row items-center flex justify-center mt-10  bg-app-primary rounded-lg'
              onPress={() => handleUpdate()}
              >
                {loading ? <ActivityIndicator/> :
                  <Text className=' font-semibold text-base text-gray-100'>Update Profile</Text>
                }
            </TouchableOpacity> 

        </View>



        </View>
        </KeyboardAvoidWrapper>
 
    </View>

    <Loader open={loading}/>

    <AppAlert 
     message={errorMessage.message} error={errorMessage.error} data={errorMessage.data}onPress={() => setErrorMessage({error: false, message: null, data: null})}

     />
   

    </>
  )
}

export default index

const styles = StyleSheet.create({})