import { Link, RelativePathString } from "expo-router"
import { Image, ImageProps, Text, TouchableOpacity, View } from "react-native"

  const SelectBoxIcon = ({
    icon,
    label,
    onSelect  }: {
    icon: ImageProps,
    onSelect: () => void
    label: string
  }) => {

    return(
         
        <TouchableOpacity
        onPress={onSelect}
        
        className=' w-1/4 justify-center items-center'>
          <View className='w-14 h-14 bg-white/20 rounded-full p-2 justify-center items-center'>
            <Image source={icon}  className='w-full h-full rounded-full'  resizeMode='stretch' />
            </View>
            <Text className='text-white'>{label.toUpperCase()}</Text>

      </TouchableOpacity>
    )

  }

  export default SelectBoxIcon