import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('/opt/homebrew/lib/node_modules/puppeteer-core');
const BASE = process.env.BASE || 'http://localhost:8787/play/';
const OUT = process.env.OUT || './shots';
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new', args: ['--mute-audio', '--headless=new', '--disable-gpu'],
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
page.on('pageerror', e => console.log('PAGEERROR:', String(e).slice(0, 200)));
await page.evaluateOnNewDocument(() => {
  localStorage.setItem('boo2Welcome', '1'); localStorage.setItem('boo2Named', '1');
  localStorage.setItem('boo2Owned', JSON.stringify([1, 2, 35]));
  localStorage.setItem('boo2Team', JSON.stringify([1, 2, 35]));
});
await page.goto(BASE, { waitUntil: 'networkidle2' });
await page.waitForFunction(() => document.querySelector('.pc-name-text')?.textContent !== '…', { timeout: 15000 });
await page.evaluate(() => BOO2S.showScreen('standings'));
await new Promise(r => setTimeout(r, 2200));
const info = await page.evaluate(() => ({
  rows: document.querySelectorAll('.stand-row').length,
  avatars: document.querySelectorAll('.stand-row img.st-av').length,
  titles: [...document.querySelectorAll('.st-title')].map(e => e.textContent),
  insights: document.getElementById('standInsights')?.textContent.slice(0, 90),
  chipRecord: document.querySelector('.pc-record')?.textContent,
  lossesAnywhere: /\d+\s*L\b/.test(document.getElementById('screen-standings').innerText),
}));
console.log(JSON.stringify(info, null, 1));
await page.screenshot({ path: `${OUT}/standings.png` });
// today tab
await page.evaluate(() => BOO2ST.showTab('daily'));
await new Promise(r => setTimeout(r, 1500));
await page.screenshot({ path: `${OUT}/standings-daily.png` });
await browser.close();
