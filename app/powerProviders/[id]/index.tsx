import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import React, { useEffect, useState } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import useFetch from '@/services/useFetch'
import { getProvision } from '@/api/products'
import { images } from '@/constants/images'
import FormInput from '@/components/FormInput'
import { useAuth } from '@/services/useAuth'
import { splitString } from '@/utils'
import KeyboardAvoidWrapper from '@/components/keyboardAvoidWrapper/KeyboardAvoidWrapper'
import { createPurchaseOrder, getPriceList } from '@/api/billOrder'
import FormSelect from '@/components/FormSelect'

// import powerDistribution from "../../data/powerDistributions.json"
import powerDistribution from "../../../data/powerDistributions.json"

const ProvideDertails = () => {
    const {id} = useLocalSearchParams()
    const router = useRouter()
    const {authState: {token}, userProfileData  } = useAuth()
    const [error, setError] = useState<string | null>(null)


  const data = powerDistribution.find(item => String(item.id) === id)

    const [formValue, setFormValue] = useState({
      billersCode: "",
        amount: "",
        phone: "",
        description: null
        
    })


    const handleFormSubmit = async() => {

      try {
       const response =  await createPurchaseOrder({
          orderData: {...formValue, email: userProfileData.email, service_type: "ELECTRICITY", biller: data?.biller},
           token
        }
        )   
        console.log("response  data", response.data.id)


        if(response)  router.push(`/powerProviders/${id}/confirm/${response?.data.id}`)

      } catch (error: any) {

        // console.log(error.message)
        
      }
  }

 console.log("iamge name =>", splitString(data?.name))


  return (
    <View 
    className='flex-1 bg-primary px-4 '>
      <ScrollView
      contentContainerStyle={{
        paddingBottom: 80
      }}
      showsVerticalScrollIndicator={false}
      className='flex-1'>

        
        
        <View className='py-6'>
            <Image source={images[`${data.image}`]} resizeMode='stretch' className='w-full h-40 rounded-lg'/>
            
           

            <KeyboardAvoidWrapper>

              <View className=' mt-4 w-full'>
                <FormInput 
                name='billerCode'
                label='Meter Number'
                placeHolder='Enter Biller Code'
                
                onChangeText={(text: string) => setFormValue({...formValue, billersCode: text})}
                value={formValue.billersCode}    
                />
                
                
                <FormInput 
                name='phone'
                label='Phone Number '
                placeHolder='Phone Number'
                
                onChangeText={(text: string) => setFormValue({...formValue, phone: text})}
                value={formValue.phone}    
                />
         
                <FormInput 
                name='amount'
                label='Amount'
                placeHolder='Enter Amount'
                onChangeText={(text: string) => setFormValue({...formValue, amount: text})}
                value={formValue.amount}    
                />



                <TouchableOpacity onPress={handleFormSubmit} className='border rounded-md mt-4 border-alt py-5 '>
                    <Text className='text-alt text-center'>Proceed</Text>
                </TouchableOpacity>

            </View>


            </KeyboardAvoidWrapper>



        </View>


      </ScrollView>
    </View>
  )
}

export default ProvideDertails
