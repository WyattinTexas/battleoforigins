import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('/opt/homebrew/lib/node_modules/puppeteer-core');
const UID = 'u_ppwatchtest01';
const FB = 'https://testroom-75200-default-rtdb.firebaseio.com/boo2';
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new', args: ['--mute-audio', '--headless=new', '--disable-gpu'],
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
page.on('pageerror', e => console.log('PAGEERROR:', String(e).slice(0, 200)));
await page.evaluateOnNewDocument((uid) => {
  localStorage.setItem('boo2Welcome', '1'); localStorage.setItem('boo2Named', '1');
  localStorage.setItem('boo2Uid', uid);
  localStorage.setItem('boo2Name', 'Watcher Tester');
  localStorage.setItem('boo2Owned', JSON.stringify([1, 2, 35]));
  localStorage.setItem('boo2Team', JSON.stringify([1, 2, 35]));
  window.open = (url) => { window.__openedUrl = url; return null; }; // stub the PayPal tab
}, UID);
await page.goto('http://localhost:8787/play/', { waitUntil: 'networkidle2' });
await page.waitForFunction(() => document.querySelector('.pc-name-text')?.textContent !== '…', { timeout: 15000 });
await page.evaluate(() => BOO2S.showScreen('store'));
await new Promise(r => setTimeout(r, 900));

// 1. click the $0.99 bundle → checkout URL + pending marker
const buy = await page.evaluate(async () => {
  await BOO2ST2.buyProduct('com.corkscrewgames.boo.stars.100');
  return {
    url: window.__openedUrl,
    pending: localStorage.getItem('boo2PendingStars'),
    toast: document.getElementById('toast')?.textContent,
  };
});
const u = new URL(buy.url);
const q = Object.fromEntries(u.searchParams);
console.log('CHECKOUT:', JSON.stringify({
  host: u.host, cmd: q.cmd, business: q.business, amount: q.amount,
  invoice: q.invoice, notify: q.notify_url, ret: q.return, item: q.item_number,
  invoiceOk: new RegExp(`^${'u_ppwatchtest01'}\\.boo\\.stars100\\.\\d{14}$`).test(q.invoice),
  pending: buy.pending, toast: buy.toast,
}, null, 1));

// 2. simulate the box grant: +100 stars + star_purchase msgQueue row
const cur = await fetch(`${FB}/players/${UID}/stars.json`).then(r => r.json()) || 0;
await fetch(`${FB}/players/${UID}/stars.json`, { method: 'PUT', body: JSON.stringify(cur + 100) });
await fetch(`${FB}/players/${UID}/msgQueue.json`, { method: 'POST', body: JSON.stringify({ type: 'star_purchase', stars: 100, item: 'boo.stars100', txn: 'SIMTXN', at: Date.now() }) });
console.log('simulated grant: stars', cur, '→', cur + 100);

// 3. the 5s watcher should spot it → celebration overlay + chip + cleared marker
await page.waitForFunction(() => document.getElementById('champOverlay')?.classList.contains('active'), { timeout: 20000 });
const celebrate = await page.evaluate(() => ({
  title: document.querySelector('#champBody h1')?.textContent,
  amount: document.querySelector('#champBody .w-name')?.textContent,
  pendingCleared: localStorage.getItem('boo2PendingStars') === null,
}));
console.log('CELEBRATION:', JSON.stringify(celebrate));
await page.screenshot({ path: 'shots/paypal-celebration.png' });
await page.evaluate(() => document.getElementById('champOverlay').classList.remove('active'));
await new Promise(r => setTimeout(r, 600));
const chip = await page.evaluate(() => document.querySelector('.star-chip b')?.textContent);
console.log('CHIP:', chip);
await browser.close();
// scrub
await fetch(`${FB}/players/${UID}.json`, { method: 'DELETE' });
console.log('scrubbed', UID);
