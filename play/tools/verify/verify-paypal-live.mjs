import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('/opt/homebrew/lib/node_modules/puppeteer-core');
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new', args: ['--mute-audio', '--headless=new', '--disable-gpu'],
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
await page.evaluateOnNewDocument(() => {
  localStorage.setItem('boo2Welcome', '1'); localStorage.setItem('boo2Named', '1');
  localStorage.setItem('boo2Owned', JSON.stringify([1, 2, 35]));
  localStorage.setItem('boo2Team', JSON.stringify([1, 2, 35]));
  window.open = (url) => { window.__openedUrl = url; return null; };
});
await page.goto('https://battleoforigins.com/play/', { waitUntil: 'networkidle2' });
await page.waitForFunction(() => document.querySelector('.pc-name-text')?.textContent !== '…', { timeout: 15000 });
await page.evaluate(() => BOO2S.showScreen('store'));
await new Promise(r => setTimeout(r, 900));
const res = await page.evaluate(async () => {
  await BOO2ST2.buyProduct('com.corkscrewgames.boo.stars.550');
  const u = new URL(window.__openedUrl);
  const q = Object.fromEntries(u.searchParams);
  return { host: u.host, amount: q.amount, item: q.item_number, invoice: q.invoice,
           notify: q.notify_url, ret: q.return, pending: !!localStorage.getItem('boo2PendingStars') };
});
console.log('LIVE CHECKOUT:', JSON.stringify(res, null, 1));
await page.screenshot({ path: 'shots-live/store-paypal.png' });
// ?paypal=return boot path lands on the store
await page.goto('https://battleoforigins.com/play/?paypal=return', { waitUntil: 'networkidle2' });
await page.waitForFunction(() => document.querySelector('.pc-name-text')?.textContent !== '…', { timeout: 15000 });
await new Promise(r => setTimeout(r, 800));
console.log('RETURN LANDS ON:', await page.evaluate(() => document.querySelector('#shell .screen.active')?.id));
await browser.close();
