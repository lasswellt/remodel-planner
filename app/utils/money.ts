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

// Inverse boundary: user-typed dollars become integer cents via digit string
// math — parseFloat("0.07") * 100 style float arithmetic never touches money.
// Accepts "$1,234.56", "1234", "1234.5"; returns null for anything else.
export function parseMoney(input: string): number | null {
  const m = input.trim().match(/^\$?\s*(\d{1,3}(?:,\d{3})*|\d+)(?:\.(\d{1,2}))?$/)
  if (!m) return null
  const dollars = Number.parseInt(m[1]!.replaceAll(',', ''), 10)
  const cents = Number.parseInt((m[2] ?? '').padEnd(2, '0') || '0', 10)
  return dollars * 100 + cents
}
