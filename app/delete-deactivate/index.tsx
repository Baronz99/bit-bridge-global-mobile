import {
  ActivityIndicator,
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import React, { useEffect, useState } from 'react'
import { Link, useRouter } from 'expo-router'
import useFetch from '@/services/useFetch'

import { getTransactions } from '@/api/transactions'
import { useAuth } from '@/services/useAuth'

import { getUserOrders } from '@/api/billOrder'
import { AntDesign, Feather, FontAwesome, Ionicons } from '@expo/vector-icons'
import AppModal from '@/components/modal/Modal'
import { userProfileDel } from '@/api/auth'

const index = () => {
  const { onLogout } = useAuth()

  const [toggleModal, setToggleModal] = useState(false)
  const [errorMessage, setErrorMessage] = useState(null)

  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    setLoading(true)
    try {
      const response = await userProfileDel()

      if (response) {
        setLoading(false)
        setToggleModal(false)
        onLogout()
      }
    } catch (error: any) {
      setLoading(false)
      setErrorMessage(error?.message || 'An error occurred')
    }
  }

  return (
    <>
      <View className="flex-1 bg-primary">
        <ScrollView
          contentContainerStyle={{
            paddingBottom: 50,
          }}
        >
          <View className="flex-1 border-b mx-4  border-gray-600 pb-2 mb-2 overflow-hidden ">
            <View className="bg-gray-900 my-4 gap-6 py-4 px-4 rounded-xl">
              <TouchableOpacity
                onPress={() => {
                  setToggleModal(true)
                }}
                className="flex-row gap-4 items-center "
              >
                <AntDesign name="delete" size={20} color="white" />
                <Text className="text-white flex-1 ">Delete Account</Text>
                <Feather name="arrow-right" size={20} color="white" />
              </TouchableOpacity>

              {/* <LinkView  icon={icons.legal} link={"/"} label={"Legal"}/>
            <LinkView  icon={icons.bin} link={"/"} label={"Deactivate"}/>
            <LinkView  icon={icons.login} link={"/"} label={"Log Out"} style={"danger"}/> */}
            </View>
          </View>
        </ScrollView>
      </View>

      <AppModal open={toggleModal} onclose={() => setToggleModal(false)}>
        <View className="bg-gray-900 rounded-xl px-4 mx-4">
          <Text className="text-white text-center text-2xl my-2">Deactivate Account</Text>
          <Text className="my-4 text-center  text-white">
            You are about to deactivate your account. This action cannot be undone. Are you sure you
            want to proceed
          </Text>
          <View className="flex-row gap-4 my-6 justify-between">
            <TouchableOpacity
              onPress={() => setToggleModal(false)}
              className="bg-black py-3 flex-1 rounded-xl"
            >
              <Text className="text-white text-center ">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleDelete}
              className="bg-orange-700 flex-1  py-3 rounded-xl"
            >
              <Text className="text-white text-center">Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      </AppModal>
    </>
  )
}

export default index
