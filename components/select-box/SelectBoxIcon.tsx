import { Image, ImageProps, Text, TouchableOpacity, View } from 'react-native'
import ServiceStatusPill from '@/components/service-availability/ServiceStatusPill'
import { ServiceAvailabilityState } from '@/api/serviceAvailability'

const SelectBoxIcon = ({
  icon,
  label,
  selectedLabel,
  onSelect,
  statusState,
}: {
  icon: ImageProps
  onSelect: () => void
  label: string
  selectedLabel: string
  statusState?: ServiceAvailabilityState
}) => {
  const isSelected = String(label || '').toLowerCase() === String(selectedLabel || '').toLowerCase()

  return (
    <TouchableOpacity onPress={onSelect} className="w-1/4 justify-center items-center">
      <View className={`${isSelected ? 'bg-alt' : 'bg-white/20'} w-14 h-14 rounded-full p-2 justify-center items-center`}>
        <Image source={icon} className="w-full h-full rounded-full" resizeMode="stretch" />
      </View>
      <Text className="text-white mt-1">{String(label || '').toUpperCase()}</Text>
      {statusState ? (
        <View className="mt-1">
          <ServiceStatusPill state={statusState} compact />
        </View>
      ) : null}
    </TouchableOpacity>
  )
}

export default SelectBoxIcon
