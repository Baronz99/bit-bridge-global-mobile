import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import React, { useState } from 'react'
import FormInput from '@/components/FormInput'
import { useAuth } from '@/services/useAuth'
import { createTransaction, initiateMonnifyTransaction } from '@/api/transactions'
import Loader from '@/components/Loader'
import NotificationAlert from '@/components/notification'
import KeyboardAvoidWrapper from '@/components/keyboardAvoidWrapper/KeyboardAvoidWrapper'

const index = () => {
    const {authState: {token}, userProfileData} = useAuth()
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState({
        amount: 0,
        coupon_code: ""
    })

    const [notice, setNotice] = useState({
        message: null,
        error: false,
        data: null
    })



    const handleSubmit = async() => {

        setLoading(true)
        // console.log(formData)

        try {
            const response = await initiateMonnifyTransaction({
                data: {
                    ...formData,
                    status: "initialized",
                    email: userProfileData.email,
                    transaction_type: "deposit",
                    customer_name: userProfileData.email,
                    description: "fund wallet",
                    redirect_url: "https://bitbridgeglobal.com/app-redirect"
                },
                token
            })


            console.log("transaction respose: ====> ", response.responseBody.checkoutUrl)
            setLoading(false)


            response
            // setNotice({
            //     error: false,
            //     message: response.message,
            //     data: response.data
            // })


            Linking.openURL(response.responseBody.checkoutUrl)
        } catch (error: any ) {
            setLoading(false)

            console.log("first error ====>", error)

            setNotice({
                error: true,
                message: error.message,
                data: null
            })

            
        }
    }
    console.log(formData)
  return (
    <View className='flex-1 bg-primary px-4'>

        <KeyboardAvoidWrapper>
        <View className=' flex-1 pt-10 h-full'>
                

            
        <FormInput label="Amount" value={formData.amount} name="amount"
         keyboardType="numeric" 
         onChangeText={(text: number) => setFormData({...formData, amount: text})}/>

        <FormInput label="Coupon" name="coupon_code" value={formData.coupon_code} 
         onChangeText={(text: string) => setFormData({...formData, coupon_code: text})}
       />



        <NotificationAlert message={notice.message} data={notice.data} error={notice.error}/>
        <TouchableOpacity onPress={handleSubmit} className='bg-theme-primary py-6 mt-auto mb-10 rounded-xl'>
            <Text className='text-alt font-medium text-center'> Pay With Bank</Text>
        </TouchableOpacity>

        </View>
        </KeyboardAvoidWrapper>
      { loading && <Loader/>}



    </View>
  )
}

export default index
