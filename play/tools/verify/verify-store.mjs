import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('/opt/homebrew/lib/node_modules/puppeteer-core');
const BASE = process.env.BASE || 'http://localhost:8787/play/';
const OUT = process.env.OUT || './shots';
const RTG = +(process.env.RTG || 0);
const STARS = +(process.env.STARS || 500);
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new', args: ['--mute-audio', '--headless=new', '--disable-gpu'],
});
for (const vp of [{ n: 'store-portrait', w: 390, h: 844 }, { n: 'store-desktop', w: 1440, h: 900 }]) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: vp.w, height: vp.h, deviceScaleFactor: vp.w < 500 ? 2 : 1 });
  page.on('pageerror', e => console.log('PAGEERROR:', String(e).slice(0, 200)));
  await page.evaluateOnNewDocument((rtg, stars) => {
    localStorage.setItem('boo2Welcome', '1'); localStorage.setItem('boo2Named', '1');
    localStorage.setItem('boo2Name', 'Store Tester');
    localStorage.setItem('boo2Owned', JSON.stringify([1, 2, 35]));
    localStorage.setItem('boo2Team', JSON.stringify([1, 2, 35]));
    localStorage.setItem('boo2LB', JSON.stringify({ players: { local_uid: {} } }));
    // local mode boots from boo2LB tree keyed by uid — plant rating/stars
    const uid = localStorage.getItem('boo2Uid') || (() => { const u = 'u_storetest_vault'; localStorage.setItem('boo2Uid', u); return u; })();
    localStorage.setItem('boo2LB', JSON.stringify({ players: { [uid]: { name: 'Store Tester', rating: rtg, stars: stars, wins: 9 } } }));
  }, RTG, STARS);
  await page.goto(BASE, { waitUntil: 'networkidle2' });
  // boot() ends with showScreen('menu') — wait for it before switching screens
  await page.waitForFunction(() => document.querySelector('.pc-name-text')?.textContent !== '…', { timeout: 15000 });
  await new Promise(r => setTimeout(r, 400));
  await page.evaluate(() => BOO2S.showScreen('store'));
  await new Promise(r => setTimeout(r, 1100));
  const info = await page.evaluate(() => ({
    slots: [...document.querySelectorAll('.daily-row:not(.vault-row) .ds-slot .ds-name')].map(e => e.textContent),
    prices: [...document.querySelectorAll('.daily-row:not(.vault-row) .ds-buy')].map(e => e.textContent.trim()),
    vaultOpen: !!document.querySelector('.vault.open'),
    vaultBadge: document.querySelector('.vault-badge')?.textContent.trim(),
    vaultSlots: [...document.querySelectorAll('.vault-row .ds-name')].map(e => e.textContent),
    countdown: document.getElementById('dailyCountdown')?.textContent,
  }));
  console.log(`[${vp.n} rtg=${RTG}]`, JSON.stringify(info));
  await page.screenshot({ path: `${OUT}/${vp.n}-rtg${RTG}.png`, fullPage: vp.n.includes('portrait') });
  await ctx.close();
}
await browser.close();
console.log('STORE DONE');
