import React from 'react'
import { TextInput, TouchableOpacity } from 'react-native'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import BankPickerSheet from '@/components/bankTransfer/BankPickerSheet'

jest.mock('@/components/modal/Modal', () => {
  return function MockModal({ open, children }: { open: boolean; children?: React.ReactNode }) {
    if (!open) return null
    return children
  }
})

const options = [
  { label: 'Access Bank', value: '044' },
  { label: 'GTBank', value: '058' },
]

describe('BankPickerSheet', () => {
  it('shows loading copy instead of a false empty state while banks are loading', async () => {
    let tree: ReactTestRenderer | null = null

    await act(async () => {
      tree = create(
        <BankPickerSheet
          selectedValue=""
          options={[]}
          loading
          onSelect={jest.fn()}
        />
      )
    })

    await act(async () => {
      tree.root.findAllByType(TouchableOpacity)[0].props.onPress()
    })

    const text = JSON.stringify(tree.toJSON())
    expect(text).toContain('Loading banks...')
    expect(text).not.toContain('No banks found for this search.')
  })

  it('shows the no-results state only after loading completes and the query has no matches', async () => {
    let tree: ReactTestRenderer | null = null

    await act(async () => {
      tree = create(
        <BankPickerSheet
          selectedValue=""
          options={options}
          loading={false}
          onSelect={jest.fn()}
        />
      )
    })

    await act(async () => {
      tree.root.findAllByType(TouchableOpacity)[0].props.onPress()
    })

    await act(async () => {
      tree.root.findByType(TextInput).props.onChangeText('zzz-bank')
    })

    const text = JSON.stringify(tree.toJSON())
    expect(text).toContain('No banks found for this search.')
  })

  it('shows a retryable error state when bank loading fails', async () => {
    const onRetry = jest.fn()
    let tree: ReactTestRenderer | null = null

    await act(async () => {
      tree = create(
        <BankPickerSheet
          selectedValue=""
          options={[]}
          loading={false}
          errorLabel="Unable to load bank list right now."
          onRetry={onRetry}
          onSelect={jest.fn()}
        />
      )
    })

    await act(async () => {
      tree.root.findAllByType(TouchableOpacity)[0].props.onPress()
    })

    const retryButton = tree.root.findAllByType(TouchableOpacity)[1]
    await act(async () => {
      retryButton.props.onPress()
    })

    const text = JSON.stringify(tree.toJSON())
    expect(text).toContain('Unable to load bank list right now.')
    expect(text).not.toContain('No banks found for this search.')
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})
