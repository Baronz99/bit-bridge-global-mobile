import { StyleSheet, Text, TouchableOpacity, View , Modal, Pressable, TouchableWithoutFeedback} from 'react-native'
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
            <Pressable
            onPress={onclose}
            className='flex-1 bg-primary/50 justify-center items-center'>
            <Pressable 
            // onPress={()=> {}}
            >
            {children}
    
            </Pressable>
            </Pressable>

        
          </Modal>
  )
}

export default AppModal