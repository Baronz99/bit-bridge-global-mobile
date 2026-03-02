import { Modal, Pressable } from 'react-native'
import React from 'react'

type AppModalProps = {
  open: boolean
  onclose?: () => void
  children: React.ReactNode
}

const AppModal = ({ open, onclose, children }: AppModalProps) => {
  return (
    <Modal visible={open} transparent={true} animationType="fade" onRequestClose={onclose}>
      <Pressable onPress={onclose} className="flex-1 bg-primary/50 justify-center items-center">
        <Pressable
          className="px-4 w-full"
          onPress={(event) => event.stopPropagation()}
        >
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  )
}

export default AppModal
