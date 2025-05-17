import { ActivityIndicator, Image, Modal, StyleSheet, Text, View } from 'react-native'
import React from 'react'
import { gifs } from '@/constants/gifs'

const Loader = ({
  open,
  onclose,
}: {
  open: boolean
  onclose?: () => void
}) => {
  return (
   
        <Modal
             visible={open}
             transparent={true}
             animationType='fade'
             onRequestClose={()=> onclose}
       
             >
               <View className='flex-1 bg-gray-900/50 justify-center items-center'>

               <ActivityIndicator    color={"#000ff"}  size={"large"} />
               {/* <Image source={gifs.loader} className='w-20 h-20 m-auto' /> */}
       
               </View>
             </Modal>
  )
}

export default Loader

const styles = StyleSheet.create({})