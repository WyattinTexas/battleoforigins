import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('/opt/homebrew/lib/node_modules/puppeteer-core');
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new', args: ['--mute-audio', '--headless=new', '--disable-gpu'],
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
page.on('pageerror', e => console.log('PAGEERROR:', String(e).slice(0, 200)));
await page.evaluateOnNewDocument(() => {
  localStorage.setItem('boo2Welcome', '1'); localStorage.setItem('boo2Named', '1');
  localStorage.setItem('boo2Uid', 'u_storetest_vault');
  localStorage.setItem('boo2Name', 'Vault Tester');
  localStorage.setItem('boo2Owned', JSON.stringify([1, 2, 35]));
  localStorage.setItem('boo2Team', JSON.stringify([1, 2, 35]));
});
await page.goto('http://localhost:8787/play/', { waitUntil: 'networkidle2' });
await page.waitForFunction(() => document.querySelector('.pc-name-text')?.textContent !== '…', { timeout: 15000 });
await page.evaluate(() => BOO2S.showScreen('store'));
await new Promise(r => setTimeout(r, 900));

const starsBefore = await page.evaluate(() => BOO2M.snapshot().stars);
// buy daily slot 0 (two-tap)
await page.click('[data-flip="daily-0"] .ds-buy');
await new Promise(r => setTimeout(r, 250));
const armed = await page.evaluate(() => document.querySelector('[data-flip="daily-0"] .ds-buy')?.textContent);
await page.click('[data-flip="daily-0"] .ds-buy');
await new Promise(r => setTimeout(r, 1400));
const ceremony = await page.evaluate(() => ({
  overlay: document.getElementById('packCeremony')?.classList.contains('active'),
  title: document.getElementById('cerTitle')?.textContent,
}));
await page.screenshot({ path: 'shots/store-ceremony.png' });
// ceremony: reveal then CONTINUE
await page.click('#cerStage').catch(() => {});
await new Promise(r => setTimeout(r, 900));
await page.evaluate(() => { [...document.querySelectorAll('#packCeremony button')].find(b => /continue/i.test(b.textContent))?.click(); });
await new Promise(r => setTimeout(r, 900));
const after = await page.evaluate(() => ({
  stars: BOO2M.snapshot().stars,
  ownedCount: BOO2M.ownedIds().length,
  ownedTag: !!document.querySelector('.daily-row:not(.vault-row) .ds-slot.owned'),
  screen: document.querySelector('#shell .screen.active')?.id,
}));
console.log(JSON.stringify({ starsBefore, armed, ceremony, after }, null, 1));
await page.screenshot({ path: 'shots/store-after-buy.png' });
await browser.close();
