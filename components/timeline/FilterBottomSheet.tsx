import React from 'react'
import { Modal, Text, TextInput, TouchableOpacity, View } from 'react-native'

export type TimelineFilterState = {
  startDate: string
  endDate: string
  status: string
  type: string
  minAmount: string
  maxAmount: string
  source: string
  showAlerts: boolean
}

type FilterBottomSheetProps = {
  open: boolean
  onClose: () => void
  filters: TimelineFilterState
  onChange: (next: TimelineFilterState) => void
}

const TYPE_OPTIONS = ['all', 'wallet', 'cards', 'bills', 'circles', 'alerts']
const STATUS_OPTIONS = ['all', 'successful', 'pending', 'failed', 'reversed']
const SOURCE_OPTIONS = ['all', 'Main Wallet', 'Card', 'Circle']

const FilterBottomSheet = ({ open, onClose, filters, onChange }: FilterBottomSheetProps) => {
  const renderChips = (options: string[], value: string, key: keyof TimelineFilterState) => (
    <View className="flex-row flex-wrap gap-2">
      {options.map((option) => {
        const active = value === option
        return (
          <TouchableOpacity
            key={option}
            onPress={() => onChange({ ...filters, [key]: option })}
            className={`px-3 py-2 rounded-full border ${
              active ? 'bg-orange-600 border-orange-500' : 'bg-gray-950 border-gray-800'
            }`}
          >
            <Text className={active ? 'text-white text-xs' : 'text-gray-300 text-xs'}>
              {option === 'all' ? 'All' : option}
            </Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-black/40 justify-end">
        <TouchableOpacity className="flex-1" onPress={onClose} activeOpacity={1} />
        <View className="bg-gray-900 p-6 rounded-t-3xl border border-gray-800">
          <Text className="text-white text-lg font-semibold text-center mb-2">Filters</Text>
          <Text className="text-gray-400 text-center text-xs mb-4">
            Refine your activity by date, type, status, and source.
          </Text>

        <Text className="text-gray-300 text-xs font-semibold mb-2">Date range</Text>
        <View className="flex-row gap-2">
          <TextInput
            value={filters.startDate}
            onChangeText={(value) => onChange({ ...filters, startDate: value })}
            placeholder="Start YYYY-MM-DD"
            placeholderTextColor="#9CA3AF"
            className="flex-1 bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-white"
          />
          <TextInput
            value={filters.endDate}
            onChangeText={(value) => onChange({ ...filters, endDate: value })}
            placeholder="End YYYY-MM-DD"
            placeholderTextColor="#9CA3AF"
            className="flex-1 bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-white"
          />
        </View>

        <Text className="text-gray-300 text-xs font-semibold mt-4 mb-2">Type</Text>
        {renderChips(TYPE_OPTIONS, filters.type, 'type')}

        <Text className="text-gray-300 text-xs font-semibold mt-4 mb-2">Status</Text>
        {renderChips(STATUS_OPTIONS, filters.status, 'status')}

        <Text className="text-gray-300 text-xs font-semibold mt-4 mb-2">Amount range</Text>
        <View className="flex-row gap-2">
          <TextInput
            value={filters.minAmount}
            onChangeText={(value) => onChange({ ...filters, minAmount: value })}
            placeholder="Min"
            placeholderTextColor="#9CA3AF"
            keyboardType="numeric"
            className="flex-1 bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-white"
          />
          <TextInput
            value={filters.maxAmount}
            onChangeText={(value) => onChange({ ...filters, maxAmount: value })}
            placeholder="Max"
            placeholderTextColor="#9CA3AF"
            keyboardType="numeric"
            className="flex-1 bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-white"
          />
        </View>

        <Text className="text-gray-300 text-xs font-semibold mt-4 mb-2">Source</Text>
        {renderChips(SOURCE_OPTIONS, filters.source, 'source')}

        <TouchableOpacity
          onPress={() => onChange({ ...filters, showAlerts: !filters.showAlerts })}
          className="flex-row items-center justify-between bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 mt-4"
        >
          <Text className="text-white text-sm">Show alerts/updates</Text>
          <View className={`w-10 h-6 rounded-full ${filters.showAlerts ? 'bg-orange-500' : 'bg-gray-700'}`}>
            <View
              className={`w-5 h-5 rounded-full bg-white mt-0.5 ${
                filters.showAlerts ? 'ml-5' : 'ml-0.5'
              }`}
            />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onClose}
          className="bg-app-primary py-3 rounded-xl items-center mt-5"
        >
          <Text className="text-black text-sm font-semibold">Apply filters</Text>
        </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

export default FilterBottomSheet
