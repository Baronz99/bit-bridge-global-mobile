import React, { useEffect, useMemo, useState } from 'react'
import { LayoutChangeEvent, Text, TouchableOpacity, View } from 'react-native'

type Tab = { key: string; label: string }

type PremiumTabsProps = {
  tabs: Tab[]
  activeKey: string
  onChange: (key: string) => void
}

const PremiumTabs = ({ tabs, activeKey, onChange }: PremiumTabsProps) => {
  const [layouts, setLayouts] = useState<Record<string, { x: number; width: number }>>({})
  const [indicatorX, setIndicatorX] = useState(0)
  const [indicatorWidth, setIndicatorWidth] = useState(0)

  const handleLayout = (key: string) => (event: LayoutChangeEvent) => {
    const { x, width } = event.nativeEvent.layout
    setLayouts((prev) => ({ ...prev, [key]: { x, width } }))
  }

  const activeLayout = useMemo(() => layouts[activeKey], [activeKey, layouts])

  useEffect(() => {
    if (!activeLayout) return
    setIndicatorX(activeLayout.x)
    setIndicatorWidth(activeLayout.width)
  }, [activeLayout])

  return (
    <View className="bg-gray-900/70 border border-gray-800 rounded-full p-1 overflow-hidden">
      <View
        style={{
          position: 'absolute',
          top: 4,
          left: 4,
          height: 34,
          borderRadius: 999,
          width: indicatorWidth,
          transform: [{ translateX: indicatorX }],
          backgroundColor: '#f59e0b',
        }}
      />
      <View className="flex-row items-center">
        {tabs.map((tab) => {
          const active = tab.key === activeKey
          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => onChange(tab.key)}
              onLayout={handleLayout(tab.key)}
              className="px-4 py-2"
              activeOpacity={0.85}
            >
              <Text className={`text-xs font-semibold ${active ? 'text-black' : 'text-gray-300'}`}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )
}

export default PremiumTabs
