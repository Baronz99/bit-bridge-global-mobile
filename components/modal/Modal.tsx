import { StyleSheet, Text, TouchableOpacity, View , Modal} from 'react-native'
import React from 'react'

const AppModal = ({
    open,
    onclose,
    children
}: any) => {
  return (
    
          <Modal
          visible={open}
          transparent={true}
          animationType='fade'
          onRequestClose={()=> onclose}
    
          >
            <View className='flex-1 bg-white/50 justify-center items-center'>
                {children}
    
            </View>
          </Modal>
  )
}

export default AppModal