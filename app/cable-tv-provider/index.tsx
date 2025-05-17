import { FlatList, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import React, { useEffect, useState } from 'react'
import useFetch from '@/services/useFetch'
import { getProducts } from '@/api/products'
import { useAuth } from '@/services/useAuth'
import { Link, useRouter } from 'expo-router'
import { images } from '@/constants/images'
import { splitString } from '@/utils'
import SelectBoxIcon from '@/components/select-box/SelectBoxIcon'
import FormSelect from '@/components/FormSelect'
import { createPurchaseOrder, getPriceList } from '@/api/billOrder'
import KeyboardAvoidWrapper from '@/components/keyboardAvoidWrapper/KeyboardAvoidWrapper'
import FormInput from '@/components/FormInput'
import Loader from '@/components/Loader'

const index = () => {
  const {authState: {token},userProfileData } = useAuth()  
  const router = useRouter()  
  
  const [loader, setLoader] = useState(false)
    
    const [selectProvider, setSelectedProvider] = useState(null)
    const [selectProvision, setSelectedProvision] = useState(null)
    const [formValue, setFormValue] = useState({
    billersCode: "",
        amount: "",
        tariff_class: "",
        description: null
        
    })
    
        const {data} = useFetch(() => getProducts({
            token,
            params: {
                category: "utility"
            }

        }))

      const {data: priceList, refetch} = useFetch(()=> getPriceList({
        provider: selectProvider?.provider,
        service_type: selectProvision?.service_type,
        token: token
    }),  false )

    
    
      const handleFormSubmit = async() => {
        setLoader(true)
    
        try {
          const response =  await createPurchaseOrder({
            orderData: {...formValue, email: userProfileData?.email, service_type: selectProvision?.service_type, biller: selectProvider?.provider.toUpperCase(), skip: true},
              token
          }
          )   
    
          setLoader(false)        
    
          router.push(`/cable-tv-provider/confirm/${response?.data.id}`)
    
        } catch (error: any) {
          console.log("error=",error.message)
          setLoader(false)
    
          
        }
      }



    useEffect(() => {
        if(data) {
        const tvProvider =  data.find((provider: any) => provider.provider.toLowerCase() === "dstv")
        setSelectedProvider(tvProvider)
        }
    }, [])

    useEffect(()=> {
      if(selectProvision){
        refetch()
      }
    }, [selectProvision])

        useEffect(()=> {   
          if(selectProvider){            
          const provision = selectProvider?.provisions?.find((item : any) => item.service_type.toLowerCase() === "tv")    
          setSelectedProvision(provision)
          }
    
        },[selectProvider])


   const cableProviders = data?.map((item: any) => {
        if(item.category === "utility"){
          return item
        }
      })
      
  return (
    <View className='flex-1 bg-primary px-4'>
        <View className='bg-gray-900/60 p-4 rounded-xl'>
          <View
           className='py-4 flex-wrap gap-y-4 flex-row'>
            {cableProviders && cableProviders?.map((item: any) => (
              <>
              <SelectBoxIcon key={item.id} onSelect={() => setSelectedProvider(item)} icon={images[`${splitString(item?.provider)}`]} 
                label={splitString(item?.provider)}
              />
            </>


            ))}          
          </View> 
        </View>

        <ScrollView
        contentContainerStyle={{
            paddingBottom: 80
        }}
        showsVerticalScrollIndicator={false}
        //   className='flex-1'
        >     
        <View  className='flex-1 bg-primary px-4 '>            
        <View className='py-6'>
            <Image source={images[`${splitString(selectProvider?.provider)}`]} className='w-full h-40 rounded-lg'/>
            <KeyboardAvoidWrapper>
                <View>
                    <FormInput 
                    name='billerCode'
                    label='IUC number'
                    placeHolder='Enter 10 digit IUC Number'
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

                
                    <FormSelect 
                    options={priceList ?? []}
                    selectedValue={formValue.tariff_class}
                    name='tarrif_class'
                    label='Data Plan'
                    placeHolder='Data Plan'
                    onValueChange={(value: string) => {
                    const newAmountdata = priceList.find((price: any) => price.value === value)
                    
                    setFormValue({...formValue,
                        amount: newAmountdata.amount,
                        description: newAmountdata.label,
                        tariff_class: value})}}

                        />

                    <TouchableOpacity onPress={handleFormSubmit} className='border rounded-md mt-4 border-alt py-5 '>
                        <Text className='text-alt text-center'>Proceed</Text>
                    </TouchableOpacity>

                </View>
            </KeyboardAvoidWrapper>
        </View>



        <Loader open={loader}/>

        </View>
        </ScrollView>

    </View>
  )
}

export default index

const styles = StyleSheet.create({})