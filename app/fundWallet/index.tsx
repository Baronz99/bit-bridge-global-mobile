import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import React, { useState } from 'react'
import FormInput from '@/components/FormInput'
import { useAuth } from '@/services/useAuth'
import { createTransaction, initiateMonnifyTransaction } from '@/api/transactions'
import Loader from '@/components/Loader'
import NotificationAlert from '@/components/notification'
import KeyboardAvoidWrapper from '@/components/keyboardAvoidWrapper/KeyboardAvoidWrapper'

const index = () => {
    const {authState: {token}, userProfileData, loadProfile} = useAuth()
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


            setLoading(false)
            loadProfile(token)


            // setNotice({
            //     error: false,
            //     message: response.message,
            //     data: response.data
            // })


            Linking.openURL(response.responseBody.checkoutUrl)
        } catch (error: any ) {
            setLoading(false)


            setNotice({
                error: true,
                message: error.message,
                data: null
            })

            
        }
    }

    return (
    <View className='flex-1 bg-primary px-4'>

        <KeyboardAvoidWrapper>
        <View className=' flex-1 pt-10 h-full'>
                

            
        <FormInput label="Amount" value={formData.amount} name="amount"
         keyboardType="numeric" 
         onChangeText={(text: number) => setFormData({...formData, amount: text})}/>

        <FormInput label="Coupon (optional)" name="coupon_code" value={formData.coupon_code} 
         onChangeText={(text: string) => setFormData({...formData, coupon_code: text})}
       />



        <NotificationAlert message={notice.message} data={notice.data} error={notice.error}/>
        <TouchableOpacity onPress={handleSubmit} className='bg-theme-primary py-6 mt-10 mb-10 rounded-xl'>
            <Text className='text-alt font-medium text-center'> Pay With Bank</Text>
        </TouchableOpacity>

        </View>
        </KeyboardAvoidWrapper>
      <Loader  open={loading}/>



    </View>
  )
}

export default index
