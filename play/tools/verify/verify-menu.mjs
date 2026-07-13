import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('/opt/homebrew/lib/node_modules/puppeteer-core');
const BASE = process.env.BASE || 'http://localhost:8787/play/';
const OUT = process.env.OUT || './shots';
const VIEWPORTS = [
  { name: 'menu-portrait', width: 390, height: 844, dpr: 2 },
  { name: 'menu-landscape', width: 844, height: 390, dpr: 2 },
  { name: 'menu-desktop', width: 1440, height: 900, dpr: 1 },
];
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new', args: ['--mute-audio', '--headless=new', '--disable-gpu'],
});
for (const vp of VIEWPORTS) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: vp.dpr });
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('boo2Welcome', '1'); localStorage.setItem('boo2Named', '1');
    localStorage.setItem('boo2Owned', JSON.stringify([1, 2, 35]));
    localStorage.setItem('boo2Team', JSON.stringify([1, 2, 35]));
  });
  await page.goto(BASE, { waitUntil: 'networkidle2' });
  await page.evaluate(() => document.fonts.ready);
  await new Promise(r => setTimeout(r, 1200));
  await page.screenshot({ path: `${OUT}/${vp.name}.png` });
  await ctx.close();
}
await browser.close();
console.log('MENU SHOTS DONE');
