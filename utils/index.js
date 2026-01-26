const splitString = (provider) => {
  const value = String(provider || '').trim().toLowerCase()
  if (!value) return value

  const compact = value.replace(/\s+/g, '')
  if (compact.includes('9mobile') || compact.includes('etisalat')) return '9-mobile'
  if (compact.includes('startimes')) return 'startimes'
  if (compact.includes('ntel')) return 'ntel'

  const firstWord = value.split(' ')[0]
  const firstHyphen = value.split('-')[0]
  return firstWord || firstHyphen || value
}

export { splitString }
