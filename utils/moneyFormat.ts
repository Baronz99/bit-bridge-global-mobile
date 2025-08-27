const moneyFormat = (amount: number, currency = 'NGN') => {
  try {
    const currrencyFormat = new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: currency,
      currencyDisplay: 'narrowSymbol',
    })
    return currrencyFormat.format(amount)
  } catch (error) {
    return amount.toString() ?? '0.00'
  }
}

export default moneyFormat
