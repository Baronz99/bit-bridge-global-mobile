import { View, Text, TouchableOpacity } from 'react-native'
import React, { useState } from 'react'

const confirm = () => {
              const [textInfo, setTextInfo] = useState("")
    
  return (
    <View>
        <TouchableOpacity className='py-3  flex-row items-center flex justify-center mt-10  bg-app-primary rounded-lg'
            onPress={() => setTextInfo("wallet")}
            >
            
                <Text className=' font-semibold text-base text-gray-100'>Button {textInfo}</Text>
            
        </TouchableOpacity>    
    </View>
  )
}

export default confirm