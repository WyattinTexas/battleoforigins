import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('/opt/homebrew/lib/node_modules/puppeteer-core');

const BASE = process.env.BASE || 'http://localhost:8787/play/';
const OUT = process.env.OUT || './shots';
const VIEWPORTS = [
  { name: 'portrait-390x844', width: 390, height: 844, dpr: 2 },
  { name: 'landscape-844x390', width: 844, height: 390, dpr: 2 },
  { name: 'desktop-1440x900', width: 1440, height: 900, dpr: 1 },
];

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--mute-audio', '--headless=new', '--no-first-run', '--disable-gpu'],
});

for (const vp of VIEWPORTS) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: vp.dpr });
  page.on('pageerror', e => console.log(`[${vp.name}] pageerror:`, String(e).slice(0, 200)));
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('boo2Welcome', '1');
    localStorage.setItem('boo2Named', '1');
    localStorage.setItem('boo2Name', 'Stage Tester');
    localStorage.setItem('boo2Owned', JSON.stringify([1, 2, 35]));
    localStorage.setItem('boo2Team', JSON.stringify([1, 2, 35]));
    localStorage.setItem('boo2Uid', 'u_stagetest_local');
  });
  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 30000 });
  await page.evaluate(() => document.fonts.ready);
  await new Promise(r => setTimeout(r, 800));
  // straight into the Set-1 intro fight — all six ids have sprites
  await page.evaluate(() => { BOO2B.startVsTeam([9, 8, 12], 'Meadow Wisps'); });
  await new Promise(r => setTimeout(r, 3600));
  await page.screenshot({ path: `${OUT}/${vp.name}-1-open.png` });
  // one roll to light up dice/narrator/damage
  await page.evaluate(() => { try { rollReady('red'); } catch (e) {} });
  await new Promise(r => setTimeout(r, 4500));
  await page.screenshot({ path: `${OUT}/${vp.name}-2-roll.png` });
  const info = await page.evaluate(() => ({
    stage: !!document.querySelector('#boo2-stage'),
    bodyCls: document.body.className,
    redSrc: document.querySelector('#boo2-stage .stage-team.red .stage-actor.slot-active .actor-img')?.getAttribute('src'),
    blueSrc: document.querySelector('#boo2-stage .stage-team.blue .stage-actor.slot-active .actor-img')?.getAttribute('src'),
    plateRed: document.querySelector('#boo2-stage .stage-plate.red .plate-name')?.textContent,
    plateBlue: document.querySelector('#boo2-stage .stage-plate.blue .plate-name')?.textContent,
    hpRed: document.querySelector('#boo2-stage .stage-plate.red .plate-hp')?.textContent,
    hpBlue: document.querySelector('#boo2-stage .stage-plate.blue .plate-hp')?.textContent,
  }));
  console.log(`[${vp.name}]`, JSON.stringify(info));
  await ctx.close();
}
await browser.close();
console.log('DONE');
