// All money in this app is stored as integer cents; dollars exist only at the
// render boundary. This shared formatter is the single place cents become a
// display string — no floating-point currency arithmetic anywhere else.
export function formatMoney(cents: number, currency = 'USD'): string {
  if (!Number.isInteger(cents)) {
    throw new Error(`formatMoney expects integer cents, got ${cents}`)
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(cents / 100)
}
