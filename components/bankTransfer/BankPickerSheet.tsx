import React, { useMemo, useState } from 'react'
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native'
import AppModal from '@/components/modal/Modal'

type BankOption = {
  label: string
  value: string
  data?: unknown
}

type BankPickerSheetProps = {
  selectedValue: string
  options: BankOption[]
  recentValues?: string[]
  disabled?: boolean
  loading?: boolean
  loadingLabel?: string
  emptyLabel?: string
  errorLabel?: string | null
  retryLabel?: string
  onRetry?: () => void
  onSelect: (option: BankOption) => void
}

const BankPill = ({ label }: { label: string }) => (
  <View className="h-8 w-8 rounded-full bg-gray-800 border border-gray-700 items-center justify-center mr-3">
    <Text className="text-gray-100 text-xs font-semibold">{String(label || '?').slice(0, 1).toUpperCase()}</Text>
  </View>
)

const BankPickerSheet = ({
  selectedValue,
  options,
  recentValues = [],
  disabled = false,
  loading = false,
  loadingLabel = 'Loading banks...',
  emptyLabel = 'No banks found for this search.',
  errorLabel = null,
  retryLabel = 'Retry',
  onRetry,
  onSelect,
}: BankPickerSheetProps) => {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const selectedLabel = useMemo(
    () => options.find((item) => item.value === selectedValue)?.label || 'Select bank',
    [options, selectedValue]
  )

  const recentOptions = useMemo(() => {
    const seen = new Set<string>()
    const mapped: BankOption[] = []
    for (const value of recentValues) {
      if (seen.has(value)) continue
      const found = options.find((item) => item.value === value)
      if (found) {
        mapped.push(found)
        seen.add(value)
      }
      if (mapped.length >= 4) break
    }
    return mapped
  }, [options, recentValues])

  const filteredOptions = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return options
    return options.filter((item) => item.label.toLowerCase().includes(term))
  }, [options, query])

  const queryPresent = query.trim().length > 0
  const showErrorState = !loading && Boolean(errorLabel)
  const showLoadingState = loading
  const showEmptyState = !loading && queryPresent && filteredOptions.length === 0 && !showErrorState
  const showList = !showLoadingState && !showErrorState && filteredOptions.length > 0

  return (
    <View>
      <Text className="text-white mb-2">Bank</Text>
      <TouchableOpacity
        onPress={() => !disabled && setOpen(true)}
        disabled={disabled}
        className={`${disabled ? 'bg-gray-900' : 'bg-gray-950'} border border-gray-800 rounded-xl px-4 py-4`}
      >
        <Text className={selectedValue ? 'text-white text-sm' : 'text-gray-400 text-sm'}>
          {selectedLabel}
        </Text>
      </TouchableOpacity>

      <AppModal
        open={open}
        onclose={() => {
          setOpen(false)
          setQuery('')
        }}
      >
        <View className="bg-gray-950 border border-gray-800 rounded-t-3xl w-full max-w-md self-center p-4 min-h-[72%]">
          <Text className="text-white text-lg font-semibold text-center">Select bank</Text>
          <Text className="text-gray-400 text-xs text-center mt-1">Search your recipient bank</Text>

          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search bank name"
            placeholderTextColor="gray"
            className="border border-gray-700 rounded-xl px-4 py-3 text-white bg-gray-900 mt-4"
            editable={!loading}
          />

          {recentOptions.length > 0 ? (
            <View className="mt-4">
              <Text className="text-gray-300 text-xs mb-2">Recent banks</Text>
              <View className="flex-row flex-wrap gap-2">
                {recentOptions.map((bank) => (
                  <TouchableOpacity
                    key={`recent-${bank.value}`}
                    onPress={() => {
                      onSelect(bank)
                      setOpen(false)
                      setQuery('')
                    }}
                    className="bg-gray-900 border border-gray-700 rounded-full px-3 py-2"
                  >
                    <Text className="text-white text-xs">{bank.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : null}

          <View className="mt-4 flex-1">
            {showLoadingState ? (
              <View className="border border-gray-800 rounded-xl p-4 bg-gray-900">
                <Text className="text-gray-300 text-sm text-center">{loadingLabel}</Text>
              </View>
            ) : null}

            {showErrorState ? (
              <View className="border border-red-900/40 rounded-xl p-4 bg-red-950/20">
                <Text className="text-red-200 text-sm text-center">{errorLabel}</Text>
                {onRetry ? (
                  <TouchableOpacity onPress={onRetry} className="mt-3 self-center bg-gray-900 border border-gray-700 rounded-full px-4 py-2">
                    <Text className="text-white text-xs">{retryLabel}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}

            {showEmptyState ? (
              <View className="border border-gray-800 rounded-xl p-4 bg-gray-900">
                <Text className="text-gray-300 text-sm text-center">{emptyLabel}</Text>
              </View>
            ) : null}

            {showList ? (
              <ScrollView style={{ maxHeight: 420 }}>
                {filteredOptions.map((bank) => (
                  <TouchableOpacity
                    key={bank.value}
                    onPress={() => {
                      onSelect(bank)
                      setOpen(false)
                      setQuery('')
                    }}
                    className="flex-row items-center py-3 border-b border-gray-900"
                  >
                    <BankPill label={bank.label} />
                    <Text className="text-white text-sm flex-1">{bank.label}</Text>
                    {selectedValue === bank.value ? <Text className="text-app-primary text-xs">Selected</Text> : null}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : null}
          </View>
        </View>
      </AppModal>
    </View>
  )
}

export default BankPickerSheet
