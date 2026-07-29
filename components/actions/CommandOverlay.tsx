import React, { useEffect } from 'react'
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'

import { ActionWorkspace } from '@/api/actions'
import CommandResultList from '@/components/actions/CommandResultList'
import CommandSearchInput from '@/components/actions/CommandSearchInput'
import { useCommandActions } from '@/hooks/useCommandActions'
import { log } from '@/utils/logger'

export default function CommandOverlay({
  visible,
  workspace,
  onClose,
}: {
  visible: boolean
  workspace: ActionWorkspace
  onClose: () => void
}) {
  const insets = useSafeAreaInsets()
  const {
    query,
    setQuery,
    showingSearch,
    groupedResults,
    suggestions,
    suggestionsLoading,
    searchLoading,
    emptySearched,
    recentActions,
    handleActionPress,
  } = useCommandActions(workspace, visible)

  useEffect(() => {
    if (!visible) return
    log('command_opened', { workspace })
  }, [visible, workspace])

  return (
    <Modal animationType="slide" visible={visible} onRequestClose={onClose} presentationStyle="fullScreen">
      <SafeAreaView edges={['left', 'right']} className="flex-1 bg-[#07111F]">
        <View
          className="flex-1 px-4"
          style={{
            paddingTop: Math.max(insets.top, 16),
            paddingBottom: Math.max(insets.bottom, 18),
          }}
        >
          <View className="mb-4 flex-row items-start justify-between gap-3">
            <View className="flex-1 pr-3">
              <Text className="text-xs font-semibold uppercase tracking-[1.2px] text-[#7C8AA5]">BitBridge Actions</Text>
              <Text className="mt-2 text-[24px] font-semibold text-white">What would you like to do?</Text>
              <Text className="mt-2 text-sm leading-6 text-[#94A3B8]">Search actions, review what needs attention, and jump into the right flow.</Text>
            </View>

            <TouchableOpacity
              accessibilityLabel="Close actions"
              accessibilityRole="button"
              onPress={onClose}
              className="h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]"
            >
              <Feather name="chevron-left" size={20} color="#E2E8F0" />
            </TouchableOpacity>
          </View>

          <CommandSearchInput value={query} onChangeText={setQuery} onClose={onClose} />

          <ScrollView
            className="mt-4 flex-1"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 24, 36) }}
          >
            {suggestionsLoading && !showingSearch ? (
              <View className="mt-8 items-center">
                <ActivityIndicator color="#D7E3FF" />
              </View>
            ) : null}

            {showingSearch ? (
              <>
                {searchLoading ? (
                  <View className="mt-8 items-center">
                    <ActivityIndicator color="#D7E3FF" />
                  </View>
                ) : groupedResults.length ? (
                  groupedResults.map((group) => (
                    <CommandResultList
                      key={group.category}
                      title={group.category}
                      actions={group.items}
                      onPressAction={async (action) => {
                        const navigated = await handleActionPress(action)
                        if (navigated) onClose()
                      }}
                    />
                  ))
                ) : emptySearched ? (
                  <View className="mt-10 items-center rounded-[24px] border border-dashed border-white/10 bg-white/[0.03] px-6 py-8">
                    <View className="h-12 w-12 items-center justify-center rounded-full bg-white/6">
                      <Feather name="search" size={18} color="#D7E3FF" />
                    </View>
                    <Text className="mt-4 text-center text-base font-semibold text-white">We couldn’t find that.</Text>
                    <Text className="mt-2 text-center text-sm leading-6 text-[#94A3B8]">Try Send money, Buy airtime, Cards, or Statements.</Text>
                  </View>
                ) : null}
              </>
            ) : (
              <>
                <CommandResultList
                  title="Need Attention"
                  actions={suggestions.need_attention}
                  onPressAction={async (action) => {
                    const navigated = await handleActionPress(action)
                    if (navigated) onClose()
                  }}
                />
                <CommandResultList
                  title="Suggested"
                  actions={suggestions.suggested}
                  onPressAction={async (action) => {
                    const navigated = await handleActionPress(action)
                    if (navigated) onClose()
                  }}
                />
                <CommandResultList
                  title="Recent"
                  actions={recentActions.length ? recentActions : suggestions.recent}
                  onPressAction={async (action) => {
                    const navigated = await handleActionPress(action)
                    if (navigated) onClose()
                  }}
                />
              </>
            )}
          </ScrollView>

          <TouchableOpacity onPress={onClose} className="mt-4 items-center justify-center rounded-[18px] border border-white/10 bg-white/[0.04] py-4">
            <Text className="text-sm font-semibold text-white">Close</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  )
}
