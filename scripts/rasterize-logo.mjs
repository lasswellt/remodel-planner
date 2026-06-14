import { readFileSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { chromium } from '@playwright/test'

const svg = readFileSync(new URL('../public/logo.svg', import.meta.url)).toString()
const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`

// Prefer Playwright's managed browser; if the installed shell version doesn't
// match this @playwright/test, fall back to any installed chrome-headless-shell.
function findHeadlessShell() {
  try {
    const base = join(homedir(), '.cache/ms-playwright')
    const dir = readdirSync(base).filter(d => d.startsWith('chromium_headless_shell-')).sort().pop()
    if (dir) return join(base, dir, 'chrome-headless-shell-linux64/chrome-headless-shell')
  }
  catch { /* fall through to default launch */ }
  return undefined
}

let browser
try {
  browser = await chromium.launch()
}
catch {
  browser = await chromium.launch({ executablePath: findHeadlessShell() })
}
try {
  for (const size of [192, 512]) {
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 })
    await page.setContent(
      `<html><body style="margin:0;padding:0;background:#E8902B"><img src="${dataUrl}" width="${size}" height="${size}" style="display:block"></body></html>`,
    )
    await page.waitForLoadState('networkidle')
    await page.screenshot({
      path: `/home/tom/development/home-improvement/public/pwa-${size}x${size}.png`,
      clip: { x: 0, y: 0, width: size, height: size },
    })
    await page.close()
    console.log(`wrote pwa-${size}x${size}.png`)
  }
}
finally {
  await browser.close()
}
