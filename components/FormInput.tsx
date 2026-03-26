import { Text, TextInput, TouchableOpacity, View, type TextInputProps, type StyleProp, type TextStyle } from 'react-native'
import React from 'react'
import { Ionicons, Octicons } from '@expo/vector-icons'

type FormInputProps = TextInputProps & {
  label?: string
  icon?: React.ComponentProps<typeof Octicons>['name']
  placeHolder?: string
  isPassword?: boolean
  hidePassword?: boolean
  setHidePassword?: React.Dispatch<React.SetStateAction<boolean>>
  style?: StyleProp<TextStyle>
}

const FormInput = ({
  label,
  icon,
  value,
  placeHolder,
  placeholder,
  isPassword,
  onChangeText,
  hidePassword,
  setHidePassword,
  style,
  ...props
}: FormInputProps) => {
  const resolvedPlaceholder = placeholder ?? placeHolder

  return (
    <View className="" style={{ marginBottom: 15 }}>
      {icon ? (
        <View className="absolute left-4 ">
          <Octicons name={icon} size={20} color={'gray'} />
        </View>
      ) : null}
      {label && <Text className="text-white my-3">{label}</Text>}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholderTextColor={'#9CA3AF'}
        placeholder={resolvedPlaceholder}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardAppearance="dark"
        selectionColor="#38BDF8"
        className="p-4 pr-20 border-alt border text-white rounded overflow-hidden"
        style={[
          {
            color: '#FFFFFF',
            backgroundColor: '#0F172A',
          },
          style,
        ]}
        {...props}
      />
      {isPassword && setHidePassword ? (
        <TouchableOpacity
          onPress={() => setHidePassword(!hidePassword)}
          className="absolute right-3.5 top-2 z-10"
        >
          <Ionicons name={hidePassword ? 'eye-off' : 'eye'} size={26} color={'#9ca3af'} />
        </TouchableOpacity>
      ) : null}
    </View>
  )
}

export default FormInput
