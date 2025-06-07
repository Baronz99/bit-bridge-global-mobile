import { FlatList, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import React, { useEffect, useState } from 'react'
import useFetch from '@/services/useFetch'
import { getProducts } from '@/api/products'
import { useAuth } from '@/services/useAuth'

import MobileProviderView from '@/components/mobileProviderView/mobileProviderView'
import { useRouter } from 'expo-router'
import { createPurchaseOrder, getPriceList } from '@/api/billOrder'
import Loader from '@/components/Loader'
import KeyboardAvoidWrapper from '@/components/keyboardAvoidWrapper/KeyboardAvoidWrapper'
import FormInput from '@/components/FormInput'
import SelectBoxIcon from '@/components/select-box/SelectBoxIcon'
import { splitString } from '@/utils'
import FormSelect from '@/components/FormSelect'
import { images } from '@/constants/images'

const index = () => {
  const router = useRouter()  
  const [loader, setLoader] = useState(false)

  const [selectProvider, setSelectedProvider] = useState(null)
  const [selectProvision, setSelectedProvision] = useState(null)

  const {authState: {token},userProfileData } = useAuth()  

  const [formValue, setFormValue] = useState({
    billersCode: "",
      amount: "",
      tariff_class: "",
      description: null
      
  })

      const {data} = useFetch(() => getProducts({
        token,
        params: {
            category: "mobile provider"
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
      
  
        router.push(`/data-subscription/confirm/${response?.data.id}`)
  
      } catch (error: any) {
        console.log(error.message)
        setLoader(false)
  
        
      }
    }
   
        useEffect(() => {
    
          if(data){  
          const airtimeProvider = data.find((provider: any) => provider.provider.toLowerCase() === "mtn")
    
          setSelectedProvider(airtimeProvider)
          }
          
        
        },[data])
    
        useEffect(()=> {
    
          if(selectProvider){
    
          
          const provision = selectProvider?.provisions?.find((item : any) => item.service_type === "DATA")
    
          setSelectedProvision(provision)
          }
    
        },[selectProvider])


        useEffect(()=>{
          if(selectProvision?.service_type === "DATA"){
            refetch()
          }
          
        }, [selectProvision, selectProvider])

        useEffect(() => {
          if(priceList){
            setFormValue(
            {
              ...formValue,
              tariff_class: priceList[0].value,
               amount: priceList[0].amount,
               description: priceList[0].label
            }
          )
          console.log(formValue, priceList[0])

          }
           
        }, [priceList])

      const airtimeBillers_ = data?.filter((item: any) => item.category === "mobile provider");

        
  return (
     <>
    
    <View className='flex-1 bg-primary px-4'>
       <View className='bg-gray-900/60 p-4 rounded-xl'>
          <View
           className='py-4 flex-wrap gap-y-4 flex-row'>
            {airtimeBillers_ && airtimeBillers_?.map((item: any) => (
              <>
              <SelectBoxIcon key={item.id} selectedLabel={selectProvider?.provider} onSelect={() => setSelectedProvider(item)} icon={images[`${splitString(item?.provider)}`]} 
                label={item?.provider}
              />
            </>


            ))}          
          </View>
        </View>

        <View className='py-6'>

         <ScrollView>
          
            <KeyboardAvoidWrapper>

              <View>
                <FormInput 
                name='billerCode'
                label='Phone Number'
                placeHolder='Enter 11 digits Number'
                onChangeText={(text: string) => setFormValue({...formValue, billersCode: text})}
                value={formValue.billersCode}    
                />
                {/* {selectProvision?.service_type === "VTU" && (
                <FormInput 
                name='amount'
                label='Amount'
                placeHolder='Enter Amount'
                onChangeText={(text: string) => setFormValue({...formValue, amount: text})}
                value={formValue.amount}    
                />
                )} */}

                {selectProvision?.service_type === "DATA" && (
                <FormSelect 
                  options={priceList ?? []}
                  selectedValue={formValue.tariff_class}
                  name='tarrif_class'
                  label='Data Plan'
                  placeHolder='Data Plan'
                  onValueChange={(value: string) => {

                  const newAmountdata = priceList.find((price: any) => price.value === value)
                  
                  setFormValue({
                    ...formValue,
                    amount: newAmountdata.amount,
                    description: newAmountdata.label,
                    tariff_class: value}
                    )}}

                     />
                )}


                <TouchableOpacity onPress={handleFormSubmit} className='border rounded-md mt-4 border-alt py-5 '>
                   <Text className='text-alt text-center'>Proceed</Text>
                </TouchableOpacity>

            </View>


            </KeyboardAvoidWrapper>



         </ScrollView>
        </View>
    </View>
    <Loader open={loader} />
    </>
  )
}

export default index
