// DateOnly (YYYY-MM-DD) display formatter. Parses the string by component — it
// never builds a Date from the string (Build Conventions: no timezone math on
// DateOnly; `new Date('2026-06-20')` parses as UTC midnight and can render the
// prior day in negative-offset zones). The single render boundary for a
// calendar date, mirroring utils/money.ts for cents.
const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const

export function formatDateOnly(date: string): string {
  const m = date.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return date
  const month = MONTHS[Number(m[2]) - 1]
  if (!month) return date
  return `${month} ${Number(m[3])}, ${m[1]}`
}
