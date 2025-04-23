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
const ProvideDertails = () => {
    const {id} = useLocalSearchParams()
    const router = useRouter()
    const {authState: {token}, } = useAuth()
    const [error, setError] = useState<string | null>(null)
    const {data} = useFetch(()=> getProvision({
      id: id as string,
      token: token
  }) )


  const {data: priceList, refetch} = useFetch(()=> getPriceList({
    id: id as string,
    provider: data?.product.provider,
    service_type: data?.service_type,
    token: token
}),  false )



useEffect(()=> {
  if(data && data?.service_type === "DATA"){
    refetch()
  }
}, [data])

    // const {}
    const [formValue, setFormValue] = useState({
      billersCode: "",
        amount: "",
        tariff_class: "",
        description: null
        
    })


    const handleFormSubmit = async() => {

      try {
       const response =  await createPurchaseOrder({
          orderData: {...formValue, email: "", service_type: data.service_type, biller: data.product.provider.toUpperCase(), skip: true},
           token
        }
        )   
        console.log("response  dtaa", response, response?.id)


        if(response)  router.push(`/mobileProviders/${id}/confirm/${response?.id}`)

      } catch (error: any) {

        console.log(error.message)
        
      }
  }




 
  return (
    <View 
    className='flex-1 bg-primary px-4 mt-4'>
      <ScrollView
      contentContainerStyle={{
        paddingBottom: 80
      }}
      showsVerticalScrollIndicator={false}
      className='flex-1'>

        
        
        <View className='py-6'>
            <Image source={images[`${splitString(data?.name)}`]} className='w-full h-40 rounded-lg'/>
            
           

            <KeyboardAvoidWrapper>

              <View>
                <FormInput 
                name='billerCode'
                label='Phone Number'
                placeHolder='Enter Biller Code'
                onChangeText={(text: string) => setFormValue({...formValue, billersCode: text})}
                value={formValue.billersCode}    
                />
                {data?.service_type === "VTU" && (
                <FormInput 
                name='amount'
                label='amount'
                placeHolder='Enter Amount'
                onChangeText={(text: string) => setFormValue({...formValue, amount: text})}
                value={formValue.amount}    
                />
                )}

                {data?.service_type === "DATA" && (
                <FormSelect 
                options={priceList ?? []}
                selectedValue={formValue.tariff_class}
                name='tarrif_class'
                label='Data Plan'
                placeHolder='Data Plan'
                onValueChange={(value: string) => {

                  console.log(value)
                  const newAmountdata = priceList.find((price: any) => price.value === value)
                  
                  setFormValue({...formValue,
                    amount: newAmountdata.amount,
                    description: newAmountdata.label,
                     tariff_class: value})}}

                     />
                )}


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
