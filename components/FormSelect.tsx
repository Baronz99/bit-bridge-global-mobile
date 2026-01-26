import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import React, { useMemo, useState } from 'react'
import AppModal from '@/components/modal/Modal'

const FormSelect = ({ label, selectedValue, onValueChange, options, placeholder, placeHolder }: any) => {
  const [open, setOpen] = useState(false)
  const items = Array.isArray(options) ? options : []

  const selected = useMemo(
    () => items.find((option: any) => String(option?.value ?? '') === String(selectedValue ?? '')),
    [items, selectedValue]
  )

  const hasValue =
    selectedValue !== undefined && selectedValue !== null && String(selectedValue).length > 0

  const fallbackLabel = placeholder || placeHolder || 'Select option'
  const displayLabel = selected?.label || fallbackLabel

  // DEV-only duplicate diagnostics (safe to remove later)
  if (__DEV__) {
    const values = items.map((o: any) => String(o?.value ?? ''))
    const labels = items.map((o: any) => String(o?.label ?? ''))

    const dupValues = values.filter((v, i) => v && values.indexOf(v) !== i)
    const dupLabels = labels.filter((v, i) => v && labels.indexOf(v) !== i)

    if (dupValues.length) console.log('FormSelect duplicate VALUES:', dupValues)
    if (dupLabels.length) console.log('FormSelect duplicate LABELS:', dupLabels)
  }

  return (
    <View>
      <Text className="text-white mb-4">{label}</Text>

      <TouchableOpacity
        onPress={() => setOpen(true)}
        className="flex-row items-center justify-between bg-gray-950 border border-gray-800 rounded-xl px-4 py-4"
      >
        <Text className={hasValue ? 'text-white text-sm' : 'text-gray-400 text-sm'}>
          {displayLabel}
        </Text>
        <Text className="text-gray-500 text-base">▾</Text>
      </TouchableOpacity>

      <AppModal open={open} onclose={() => setOpen(false)}>
        <View className="bg-gray-900 p-4 rounded-2xl w-full max-w-md self-center">
          <Text className="text-white text-base font-semibold mb-3">{label}</Text>

          {items.length === 0 ? (
            <Text className="text-gray-400 text-sm text-center py-6">
              No options available.
            </Text>
          ) : (
            <ScrollView style={{ maxHeight: 320 }}>
              {items.map((option: any, idx: number) => {
                const isSelected =
                  String(option?.value ?? '') === String(selectedValue ?? '')

                // Guaranteed unique key
                const key = `${String(option?.value ?? option?.label ?? 'opt')}-${idx}`

                return (
                  <TouchableOpacity
                    key={key}
                    onPress={() => {
                      onValueChange(option?.value)
                      setOpen(false)
                    }}
                    className="py-3 border-b border-white/5"
                  >
                    <Text className={isSelected ? 'text-white text-sm' : 'text-gray-300 text-sm'}>
                      {option?.label}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
          )}
        </View>
      </AppModal>
    </View>
  )
}

export default FormSelect

const styles = StyleSheet.create({})
