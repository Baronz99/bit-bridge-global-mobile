export const dateFormat = (date: string | number | Date) => {
  const t = new Date(date)
  return t.toLocaleString()
}
