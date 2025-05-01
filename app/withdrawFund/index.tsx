import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import React, { useState } from 'react'
import FormInput from '@/components/FormInput'
import { useAuth } from '@/services/useAuth'
import { createTransaction } from '@/api/transactions'
import Loader from '@/components/Loader'
import NotificationAlert from '@/components/notification'
import FormSelect from '@/components/FormSelect'
import banks from "@/data/banks.json"
import KeyboardAvoidWrapper from '@/components/keyboardAvoidWrapper/KeyboardAvoidWrapper'
const index = () => {
    const {authState: {token}} = useAuth()
    const [loading, setLoading] = useState(false)
    const [modalVisible, setModalVisible] = useState(false);

    const [formData, setFormData] = useState({
        amount: 0,
        bank: "",
        address: ""
    })

    const [notice, setNotice] = useState({
        message: null,
        error: false,
        data: null
    })



    const handleSubmit = async() => {
        if(formData.amount || !formData.bank.trim() || !formData.address.trim() || formData.amount > 10 ){
            throw new Error("Invalid Input")
        }

        setLoading(true)

        try {
            const response = await createTransaction({
                data: {
                    ...formData,
                    status: "pending",
                    transaction_type: "withdrawal"
                },            
                token
            })

            setLoading(false)
            setNotice({
                error: false,
                message: response.message,
                data: response.data
            })


            
        } catch (error: any ) {
            setLoading(false)

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
        <ScrollView
        showsVerticalScrollIndicator={false}
        >
            
        <KeyboardAvoidWrapper>

            <View className=' flex-1 pt-10'>
                <FormInput label="Amount" value={formData.amount} name="amount"
                onChangeText={(text: number) => setFormData({...formData, amount: text})}/>
                <FormSelect options={banks} label="Bank" placeHolder={"Select Bank"} name="Select Bank" selectedValue={formData.bank} 
                onValueChange={(text: string) => setFormData({...formData, bank: text})}
                />
                <FormInput label="Account Number" name="address" value={formData.address} 
                onChangeText={(text: string) => setFormData({...formData, address: text})}
                />

                <NotificationAlert message={notice.message} data={notice.data} error={notice.error}/>

                <TouchableOpacity onPress={() => {
                  console.log(!formData.bank.trim().length > 1)
                if(!(formData.bank.trim().length > 1) || !(formData.address.trim().length > 1 )|| !(formData.amount > 10) ){
                    console.log("error occured")
                }else{
                    // console.log("first")
                    setModalVisible(true)
                    
                }

                }
                } className='bg-theme-primary py-6 mt-auto mb-10 rounded-xl'>
                    <Text className='text-alt font-medium text-center'> Request  Withdrawal</Text>
                </TouchableOpacity>
            </View>
      </KeyboardAvoidWrapper>

      { loading && <Loader/>}


      
      </ScrollView>

      <Modal
      visible={modalVisible}
      transparent={true}
      animationType='fade'
      onRequestClose={()=> setModalVisible(false)}

      >
        <View className='flex-1 bg-black/50 justify-center items-center'>
            <View className='bg-primary w-full rounded-xl py-8'>


                <Text className='text-center text-white text-2xl'>Confirm Withrawal</Text>
                <View className='w-full p-4 bg-primary rounded-lg'>
                    <TouchableOpacity className='py-2 px-2 bg-primary' onPress={() => handleSubmit() }><Text className='text-center text-alt text-lg'>Confirm Payment</Text></TouchableOpacity>
                    <TouchableOpacity className='py-2 px-2' onPress={() => {
                        
                    setModalVisible(false)

                    }
                    }
                    ><Text className=' text-center text-red-700 text-lg'>Cancel</Text></TouchableOpacity>
                </View>
            </View>

        </View>
      </Modal>

    </View>
  )
}

export default index