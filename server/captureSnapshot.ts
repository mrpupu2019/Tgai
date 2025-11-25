import chromium from '@sparticuz/chromium'
import puppeteerCore from 'puppeteer-core'
import puppeteer from 'puppeteer'

export async function captureSnapshot({ url, viewport = { width: 1200, height: 800 } }: { url: string; viewport?: { width: number; height: number } }) {
  let browser: any
  try {
    const executablePath = await chromium.executablePath
    browser = await puppeteerCore.launch({ args: [...chromium.args, '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'], defaultViewport: viewport, executablePath, headless: chromium.headless })
  } catch (e) {
    browser = await puppeteer.launch({ headless: true, defaultViewport: viewport, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] })
  }

  try {
    const page = await browser.newPage()
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36')
    await page.setBypassCSP(true)
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    await new Promise(resolve => setTimeout(resolve, 2500))
    const buffer = await page.screenshot({ type: 'png' })
    const dataUrl = `data:image/png;base64,${buffer.toString('base64')}`
    return { buffer, dataUrl }
  } finally {
    try {
      await browser.close()
    } catch {}
  }
}

export async function captureElementSnapshot({ url, selector = '#tradingview-widget-container', viewport = { width: 1280, height: 800 } }: { url: string; selector?: string; viewport?: { width: number; height: number } }) {
  let browser: any
  try {
    const executablePath = await chromium.executablePath
    browser = await puppeteerCore.launch({ args: [...chromium.args, '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'], defaultViewport: viewport, executablePath, headless: chromium.headless })
  } catch (e) {
    browser = await puppeteer.launch({ headless: true, defaultViewport: viewport, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] })
  }
  try {
    const page = await browser.newPage()
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36')
    await page.setBypassCSP(true)
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    await new Promise(resolve => setTimeout(resolve, 1800))
    await page.waitForSelector(selector, { timeout: 4000 })
    const el = await page.$(selector)
    if (!el) throw new Error('ELEMENT_NOT_FOUND')
    const buffer = await el.screenshot({ type: 'png' })
    const dataUrl = `data:image/png;base64,${buffer.toString('base64')}`
    return { buffer, dataUrl }
  } finally {
    try {
      await browser.close()
    } catch {}
  }
}