import React from 'react'
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer'
import { Text, TextInput, TouchableOpacity } from 'react-native'

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 0 }) }))
jest.mock('@react-native-community/datetimepicker', () => () => null)
jest.mock('@/components/FormSelect', () => {
  return function FormSelect({ label, errorMessage }: { label: string; errorMessage?: string }) {
    const ReactLocal = jest.requireActual<typeof import('react')>('react')
    return ReactLocal.createElement('form-select', { label, errorMessage })
  }
})

import BusinessPersonForm, { emptyBusinessPerson } from '@/components/business/BusinessPersonForm'

const findText = (tree: ReturnType<typeof create>, value: string) => tree.root.findAllByType(Text).some((node) => node.props.children === value)
const nodeHasText = (node: ReactTestInstance, value: string) => node.findAllByType(Text).some((child) => child.props.children === value)
const inputFor = (tree: ReturnType<typeof create>, placeholder: string) => tree.root.findAllByType(TextInput).find((node) => node.props.placeholder === placeholder)

describe('BusinessPersonForm additional details', () => {
  it('keeps routine additional details collapsed for a new person and only exposes email and postal code when opened', () => {
    let tree!: ReactTestRenderer
    act(() => { tree = create(<BusinessPersonForm initial={emptyBusinessPerson()} onSave={jest.fn()} />) })

    expect(findText(tree, 'Additional details')).toBe(true)
    expect(findText(tree, 'Optional for now. We may request more information during verification.')).toBe(true)
    expect(inputFor(tree, 'Email')).toBeUndefined()
    expect(inputFor(tree, 'Postal code')).toBeUndefined()
    expect(tree.root.findAllByProps({ label: 'State' }).length).toBeGreaterThan(0)
    expect(inputFor(tree, 'State')).toBeUndefined()
    expect(findText(tree, 'Identification type')).toBe(false)
    expect(inputFor(tree, 'ID document number')).toBeUndefined()
    expect(inputFor(tree, 'Address line 2')).toBeUndefined()

    act(() => tree.root.findAllByType(TouchableOpacity).find((node) => nodeHasText(node, 'Additional details'))?.props.onPress())

    expect(inputFor(tree, 'Email')).toBeDefined()
    expect(inputFor(tree, 'Postal code')).toBeDefined()
    expect(findText(tree, 'Identification type')).toBe(false)
    expect(inputFor(tree, 'ID document number')).toBeUndefined()
    expect(inputFor(tree, 'Address line 2')).toBeUndefined()
  })

  it('preserves hidden legacy values when another visible field is edited and saved', () => {
    const onSave = jest.fn()
    const initial = {
      ...emptyBusinessPerson(),
      full_name: 'Test Person', title: 'CEO', date_of_birth: '1990-01-01', address_line_1: '1 Test Street', city: 'Lagos', state: 'Lagos', phone: '08000000000', bvn: '12345678901',
      email: 'person@example.test', postal_code: '100001', address_line_2: 'Apartment 4', identification_type: 'NATIONAL_ID', id_document_number: 'legacy-id',
    }
    let tree!: ReactTestRenderer
    act(() => { tree = create(<BusinessPersonForm initial={initial} onSave={onSave} />) })
    act(() => inputFor(tree, 'Phone number')?.props.onChangeText('08000000001'))
    act(() => tree.root.findAllByType(TouchableOpacity).find((node) => nodeHasText(node, 'Save representative'))?.props.onPress())

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      phone: '08000000001', email: 'person@example.test', postal_code: '100001', address_line_2: 'Apartment 4', identification_type: 'NATIONAL_ID', id_document_number: 'legacy-id',
    }))
  })

  it('uses a State / region text field only for a non-Nigerian representative', () => {
    let tree!: ReactTestRenderer
    act(() => { tree = create(<BusinessPersonForm initial={{ ...emptyBusinessPerson(), country: 'GH' }} onSave={jest.fn()} />) })

    expect(inputFor(tree, 'State / region')).toBeDefined()
    expect(tree.root.findAllByProps({ label: 'State' })).toHaveLength(0)
  })

  it('shows a safe targeted phone correction without provider text', () => {
    let tree!: ReactTestRenderer
    act(() => { tree = create(<BusinessPersonForm initial={emptyBusinessPerson()} onSave={jest.fn()} correction={{ active: true, field: 'phone', errorCode: 'anchor_officer_phone_invalid' }} />) })

    const copy = JSON.stringify(tree.toJSON())
    expect(copy).toContain('Action required')
    expect(copy).toContain('Enter a valid Nigerian phone number, e.g. 08012345678.')
    expect(copy).not.toContain('officers[0].phoneNumber')
    expect(copy).not.toContain('anchor_officer_phone_invalid')
  })

  it('renders a readiness phone issue at the Phone number field instead of as a detached summary', () => {
    let tree!: ReactTestRenderer
    act(() => { tree = create(<BusinessPersonForm initial={emptyBusinessPerson()} issues={['phone']} onSave={jest.fn()} />) })

    const copy = JSON.stringify(tree.toJSON())
    expect(copy).toContain('Phone number')
    expect(copy).toContain('Enter a valid Nigerian phone number, e.g. 08012345678.')
    expect(copy).not.toContain('Needs attention: Phone.')
    expect(copy).not.toContain('anchor_officer_phone_invalid')
  })

  it('renders multiple known readiness issues inline without duplicating a footer summary', () => {
    let tree!: ReactTestRenderer
    act(() => { tree = create(<BusinessPersonForm initial={emptyBusinessPerson()} issues={['phone', 'title', 'state']} onSave={jest.fn()} />) })

    const copy = JSON.stringify(tree.toJSON())
    expect(copy).toContain('Enter a valid Nigerian phone number, e.g. 08012345678.')
    expect(tree.root.findByProps({ label: 'Title' }).props.errorMessage).toBe('Check this information and try again.')
    expect(tree.root.findByProps({ label: 'State' }).props.errorMessage).toBe('Check this information and try again.')
    expect(copy).not.toContain('Needs attention:')
  })

  it('uses a neutral summary only for an issue without a rendered field', () => {
    let tree!: ReactTestRenderer
    act(() => { tree = create(<BusinessPersonForm initial={emptyBusinessPerson()} issues={['unknown_legacy_field']} onSave={jest.fn()} />) })

    const copy = JSON.stringify(tree.toJSON())
    expect(copy).toContain('Some information needs attention. Review the details above.')
    expect(copy).not.toContain('unknown_legacy_field')
  })
})
