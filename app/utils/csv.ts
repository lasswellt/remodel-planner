// Minimal RFC-4180 CSV builder. A field is quoted when it contains a comma,
// quote, or newline; embedded quotes are doubled. Pure string → testable; the
// download helper is the only browser-touching part.

export function csvField(value: string | number | null | undefined): string {
  const s = value == null ? '' : String(value)
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const lines = [headers.map(csvField).join(',')]
  for (const row of rows) {
    lines.push(row.map(csvField).join(','))
  }
  // CRLF line endings — what Excel expects.
  return lines.join('\r\n')
}

export function downloadCsv(filename: string, content: string): void {
  // Prepend a UTF-8 BOM so Excel reads non-ASCII correctly.
  const blob = new Blob(['﻿', content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
