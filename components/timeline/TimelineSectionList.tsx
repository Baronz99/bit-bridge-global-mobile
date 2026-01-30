import React from 'react'
import { SectionList, Text, View } from 'react-native'
import TimelineCard from '@/components/timeline/TimelineCard'

type TimelineSection = {
  title: string
  data: Record<string, any>[]
}

type TimelineSectionListProps = {
  sections: TimelineSection[]
  onPressItem: (item: Record<string, any>) => void
  onEndReached?: () => void
  refreshing?: boolean
  onRefresh?: () => void
  ListFooterComponent?: React.ReactElement | null
}

const TimelineSectionList = ({
  sections,
  onPressItem,
  onEndReached,
  refreshing,
  onRefresh,
  ListFooterComponent,
}: TimelineSectionListProps) => {
  return (
    <SectionList
      sections={sections}
      keyExtractor={(item, index) => String(item.id ?? item.uuid ?? item.slug ?? item.reference ?? index)}
      renderSectionHeader={({ section }) => (
        <View className="mt-6 mb-2">
          <Text className="text-gray-300 text-xs font-semibold tracking-widest uppercase">
            {section.title}
          </Text>
        </View>
      )}
      renderItem={({ item }) => <TimelineCard item={item} onPress={() => onPressItem(item)} />}
      contentContainerStyle={{ paddingBottom: 24 }}
      onEndReachedThreshold={0.35}
      onEndReached={onEndReached}
      refreshing={refreshing}
      onRefresh={onRefresh}
      ListFooterComponent={ListFooterComponent}
      showsVerticalScrollIndicator={false}
    />
  )
}

export default TimelineSectionList
