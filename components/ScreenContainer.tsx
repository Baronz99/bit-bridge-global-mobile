import React from 'react'
import { ScrollView, ScrollViewProps, StyleProp, View, ViewStyle } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

type ScreenContainerProps = {
  children: React.ReactNode
  scroll?: boolean
  includeTopInset?: boolean
  includeTabBarPadding?: boolean
  horizontalPadding?: number
  topPadding?: number
  bottomPadding?: number
  className?: string
  contentContainerStyle?: StyleProp<ViewStyle>
  style?: StyleProp<ViewStyle>
  scrollProps?: Omit<ScrollViewProps, 'contentContainerStyle'>
}

const TAB_BAR_HEIGHT = 60
const TAB_BAR_GAP = 16

const ScreenContainer = ({
  children,
  scroll = true,
  includeTopInset = false,
  includeTabBarPadding = true,
  horizontalPadding = 16,
  topPadding = 0,
  bottomPadding = 0,
  className = 'flex-1 bg-primary',
  contentContainerStyle,
  style,
  scrollProps,
}: ScreenContainerProps) => {
  const insets = useSafeAreaInsets()
  const topInset = includeTopInset ? insets.top : 0
  const bottomInset = includeTabBarPadding ? insets.bottom + TAB_BAR_HEIGHT + TAB_BAR_GAP : insets.bottom

  const baseStyle: ViewStyle = {
    paddingTop: topPadding + topInset,
    paddingHorizontal: horizontalPadding,
    paddingBottom: bottomPadding + bottomInset,
  }

  if (scroll) {
    return (
      <View className={className} style={style}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          {...scrollProps}
          contentContainerStyle={[baseStyle, contentContainerStyle]}
        >
          {children}
        </ScrollView>
      </View>
    )
  }

  return (
    <View className={className} style={[baseStyle, style]}>
      {children}
    </View>
  )
}

export default ScreenContainer
