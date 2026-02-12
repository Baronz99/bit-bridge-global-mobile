import React, { useMemo, useState } from 'react'
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native'
import AppModal from '@/components/modal/Modal'

type PickerOption = {
  label: string
  value: string
  data?: any
}

type SearchablePickerProps = {
  label: string
  selectedValue: string
  options: PickerOption[]
  placeholder: string
  onSelect: (option: PickerOption) => void
}

const SearchablePicker = ({
  label,
  selectedValue,
  options,
  placeholder,
  onSelect,
}: SearchablePickerProps) => {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const selectedLabel = useMemo(() => {
    const selected = options.find((item) => String(item.value) === String(selectedValue))
    return selected?.label || placeholder
  }, [options, placeholder, selectedValue])

  const filteredOptions = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return options
    return options.filter((item) => item.label.toLowerCase().includes(query))
  }, [options, search])

  return (
    <View>
      <Text className="text-white mb-2">{label}</Text>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        className="flex-row items-center justify-between bg-gray-950 border border-gray-800 rounded-xl px-4 py-4"
      >
        <Text className={selectedValue ? 'text-white text-sm' : 'text-gray-400 text-sm'}>
          {selectedLabel}
        </Text>
        <Text className="text-gray-500 text-base">v</Text>
      </TouchableOpacity>

      <AppModal
        open={open}
        onclose={() => {
          setOpen(false)
          setSearch('')
        }}
      >
        <View className="bg-gray-900 p-4 rounded-2xl w-full max-w-md self-center">
          <Text className="text-white text-base font-semibold mb-3">{label}</Text>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search..."
            placeholderTextColor="gray"
            className="border border-gray-700 rounded-xl px-4 py-3 text-white bg-gray-950 mb-3"
            autoCapitalize="none"
          />

          {filteredOptions.length === 0 ? (
            <Text className="text-gray-400 text-sm text-center py-6">No results found.</Text>
          ) : (
            <ScrollView style={{ maxHeight: 320 }}>
              {filteredOptions.map((option, index) => (
                <TouchableOpacity
                  key={`${option.value}-${index}`}
                  onPress={() => {
                    onSelect(option)
                    setOpen(false)
                    setSearch('')
                  }}
                  className="py-3 border-b border-white/5"
                >
                  <Text
                    className={
                      String(option.value) === String(selectedValue) ? 'text-white text-sm' : 'text-gray-300 text-sm'
                    }
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      </AppModal>
    </View>
  )
}

export default SearchablePicker
