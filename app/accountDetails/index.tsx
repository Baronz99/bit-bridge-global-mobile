import { useAuth } from '@/services/useAuth'
import { useBalancePrivacy } from '@/services/useBalancePrivacy'
import moneyFormat from '@/utils/moneyFormat'
import { Feather } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native'

const AccouuntDetails = () => {
  const {
    userProfileData,
  } = useAuth()
  const { balancesHidden, maskFormattedAmount } = useBalancePrivacy()
  const router = useRouter()
  const walletBalanceLabel = moneyFormat(userProfileData?.wallet?.balance)
  const walletBalanceDisplay = balancesHidden
    ? maskFormattedAmount(walletBalanceLabel)
    : walletBalanceLabel

  return (
    <View className="flex-1 bg-primary">
      <View className="flex-1">
        <View className="bg-purple-700 my-6 flex-row justify-between rounded-2xl h-28  px-6">
          {false ? (
            <ActivityIndicator />
          ) : (
            <>
              <View>
                <Text className="text-white text-base text-left font-bold mt-2">
                  Wallet Balance
                </Text>
                <Text className="text-white text-left text-4xl my-2  font-bold">
                  {walletBalanceDisplay}
                </Text>
              </View>

              <View className="flex-col my-2 items-center gap-2">
                <TouchableOpacity
                  onPress={() => router.push('/history')}
                  className="gap-3 font-semibold items-center rounded-2xl flex-row py-1 px-4"
                >
                  <Text className="text-white">History</Text>
                  <Feather name="arrow-right" size={14} color="white" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => router.push('/fundWallet')}
                  className="bg-purple-900 font-semibold rounded-2xl py-2 px-4"
                >
                  <Text className="text-white">Fund Wallet</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        <View className="bg-gray-900/60 p-4 rounded-xl">
          <View className="text-white">
            <Text className="text-xl font-bold mb-4 text-gray-200">Your Account Details</Text>
            <View className="space-y-3 text-gray-200">
              <View className="flex gap-1 my-4">
                <Text className="font-semibold text-gray-200">Account Name:</Text>
                <Text className="text-gray-200">
                  Bit Bridge Global - {userProfileData?.account?.account_name}
                </Text>
              </View>
              <View className="flex gap-1 my-4">
                <Text className="font-semibold text-gray-200">Email:</Text>
                <Text className="text-gray-200">{userProfileData.email}</Text>
              </View>
              <View className="flex gap-1 my-4">
                <Text className="font-semibold text-gray-200">Account Number:</Text>
                <Text className="text-gray-200">{userProfileData?.account?.account_number}</Text>
              </View>

              <View className="flex gap-2">
                <Text className="font-semibold text-gray-200">Status:</Text>
                <Text
                  className={` ${userProfileData?.active ? 'text-green-600' : 'text-red-600'} font-medium`}
                >
                  {userProfileData.active ? 'Active' : 'In-Active'}
                </Text>
              </View>
            </View>

            <View className="flex justify-center gap-10">
              {/* <ClassicBtn onclick={()=> setIsOpenAccount(false)}
             type="cancel">
                Close
            </ClassicBtn> */}
            </View>
          </View>
        </View>

        <View className="gap-4 mt-6 bg-gray-700  p-4 rounded-xl">
          <Text className="text-gray-100"> PLEASE NOTE:</Text>
          <Text className="block text-gray-100 ">
            - The account details above are for reference only.
          </Text>
          <Text className="block text-gray-100 ">
            - The account can only recieve funds in Nigerian Naira
          </Text>
        </View>
      </View>
    </View>
  )
}

export default AccouuntDetails
