export const isValidReceiptReference = (value: unknown): boolean => {
  const ref = String(value ?? '').trim()
  return ref.length > 0
}
