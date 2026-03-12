/**
 * Convert a price from one currency to another using USD-based rates.
 * rates = { USD: 1, EUR: 0.93, CLP: 970, ... }
 */
export function convertPrice(price, fromCurrency, toCurrency, rates) {
  if (!rates || !price || fromCurrency === toCurrency) return price
  const fromRate = rates[fromCurrency] ?? 1
  const toRate = rates[toCurrency] ?? 1
  return price * (toRate / fromRate)
}

/**
 * Format a price for display in a given currency.
 */
export function formatPrice(price, currency) {
  if (price == null) return '—'
  if (currency === 'CLP') {
    return Math.round(price).toLocaleString('es-CL')
  }
  return Math.round(price).toLocaleString('en-US')
}

export function displayPrice(price, fromCurrency, toCurrency, rates) {
  const converted = convertPrice(price, fromCurrency, toCurrency, rates)
  return `${toCurrency} ${formatPrice(converted, toCurrency)}`
}
