import React from 'react'
import { Text, View } from 'react-native'

import { CommandAction } from '@/api/actions'
import CommandResultItem from '@/components/actions/CommandResultItem'

const titleize = (value: string) =>
  value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())

export default function CommandResultList({
  title,
  actions,
  onPressAction,
}: {
  title: string
  actions: CommandAction[]
  onPressAction: (action: CommandAction) => void
}) {
  if (!actions.length) return null

  return (
    <View className="mt-6">
      <Text className="mb-3 text-xs font-semibold uppercase tracking-[1px] text-[#7C8AA5]">{titleize(title)}</Text>
      <View className="gap-3">
        {actions.map((action) => (
          <CommandResultItem key={action.key} action={action} onPress={() => onPressAction(action)} />
        ))}
      </View>
    </View>
  )
}
