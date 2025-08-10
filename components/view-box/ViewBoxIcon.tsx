import { Link, RelativePathString } from "expo-router"
import { Image, ImageProps, Text, TouchableOpacity, View } from "react-native"

  const ViewBox = ({
    icon,
    label,
    link
  }: {
    icon: ImageProps,
    label: string,
    link: RelativePathString
  }) => {

    return(
      <Link href={link} asChild>      
        <TouchableOpacity className=' w-1/4 justify-center items-center'>
          <View className='w-14 h-14 bg-white/20 rounded-full justify-center items-center'>
            <Image source={icon}  className='w-6 h-6 rounded-full p-4' />
          </View>
            <Text className='text-white'>{label}</Text>

      </TouchableOpacity>
    </Link>
    )

  }

  export default ViewBox