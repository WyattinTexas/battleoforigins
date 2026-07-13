import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('/opt/homebrew/lib/node_modules/puppeteer-core');

const OUT = './shots';
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new', args: ['--mute-audio', '--headless=new', '--disable-gpu'],
});
const page = await browser.newPage();
await page.setViewport({ width: 844, height: 390, deviceScaleFactor: 2 });
page.on('pageerror', e => console.log('PAGEERROR:', String(e).slice(0, 200)));
await page.evaluateOnNewDocument(() => {
  localStorage.setItem('boo2Welcome', '1');
  localStorage.setItem('boo2Named', '1');
  localStorage.setItem('boo2Owned', JSON.stringify([1, 2, 35]));
  localStorage.setItem('boo2Team', JSON.stringify([1, 2, 35]));
  localStorage.setItem('boo2Raids', JSON.stringify({ cleared: { 's1-1': 1, 's1-2': 1, 's1-3': 1 } }));
});
await page.goto('http://localhost:8787/play/', { waitUntil: 'networkidle2' });
const probe = () => page.evaluate(() => ({
  red: document.querySelector('#boo2-stage .stage-actor.me .actor-img')?.getAttribute('src'),
  blue: document.querySelector('#boo2-stage .stage-actor.opp .actor-img')?.getAttribute('src'),
  redCls: document.querySelector('#boo2-stage .stage-actor.me')?.className,
  blueCls: document.querySelector('#boo2-stage .stage-actor.opp')?.className,
  plateRed: document.querySelector('#boo2-stage .stage-plate.red .plate-hp')?.textContent,
  plateBlue: document.querySelector('#boo2-stage .stage-plate.blue .plate-hp')?.textContent,
  inBattle: document.body.classList.contains('in-battle'),
}));

// ── 1. intro fight, real click on the roll button
await page.evaluate(() => BOO2B.startVsTeam([9, 8, 12], 'Meadow Wisps'));
await new Promise(r => setTimeout(r, 1500));
await page.click('#rollRedBtn');
await new Promise(r => setTimeout(r, 4000));
console.log('1 ROLL-CLICK:', JSON.stringify(await probe()));

// ── 2. forced KO swap: kill red active, pick Nikon (id 2) from sideline
await page.evaluate(() => {
  B.red.ghosts[B.red.activeIdx].hp = 0;
  B.red.ghosts[B.red.activeIdx].ko = true;
  B.phase = 'ko-swap';
  B.koSwapQueue = ['red'];
  renderBattle();
});
await new Promise(r => setTimeout(r, 900)); // KO dissolve plays
console.log('2 KO-STATE:', JSON.stringify(await probe()));
await page.click('#red-team-column .ko-swap-pick');
await new Promise(r => setTimeout(r, 1200));
console.log('2 AFTER-SWAP:', JSON.stringify(await probe()));
await page.screenshot({ path: `${OUT}/x-after-koswap.png` });

// ── 3. game over (red wins) → victory pose → rematch resets
await page.evaluate(() => showGameOver('red'));
await new Promise(r => setTimeout(r, 700));
const go = await page.evaluate(() => ({
  overlay: document.querySelector('#raid-screen .game-over')?.classList.contains('active'),
  victory: document.querySelector('#boo2-stage .stage-actor.me')?.classList.contains('victory'),
  title: document.querySelector('#raid-screen #goTitle')?.textContent,
}));
console.log('3 GAMEOVER:', JSON.stringify(go));
await page.click('#raid-screen .go-btn-rematch');
await new Promise(r => setTimeout(r, 1600));
console.log('3 AFTER-REMATCH:', JSON.stringify(await probe()));

// ── 4. two-tap EXIT back to shell
await page.click('#leaveRaidBtn');
await new Promise(r => setTimeout(r, 300));
await page.click('#leaveRaidBtn');
await new Promise(r => setTimeout(r, 800));
const exited = await page.evaluate(() => ({
  inBattle: document.body.classList.contains('in-battle'),
  playVisible: document.querySelector('#screen-play')?.classList.contains('active'),
}));
console.log('4 EXIT:', JSON.stringify(exited));

// ── 5. rival battle → token fallback for non-manifest ids
await page.evaluate(() => BOO2B.startVsTeam(getCuratedTeam([1, 2, 35]), 'Countess Cobweb'));
await new Promise(r => setTimeout(r, 2600));
console.log('5 RIVAL-TOKENS:', JSON.stringify(await probe()));
await page.screenshot({ path: `${OUT}/x-rival-token.png` });
await page.click('#leaveRaidBtn'); await new Promise(r => setTimeout(r, 250));
await page.click('#leaveRaidBtn'); await new Promise(r => setTimeout(r, 800));

// ── 6. raid BOSS fight (initRaidBattleInPage path, baseId art)
await page.evaluate(() => BOO2S.showScreen('raids'));
await new Promise(r => setTimeout(r, 500));
await page.evaluate(() => BOO2R.openNode('rh-1'));
await new Promise(r => setTimeout(r, 500));
await page.click('#raidSheet .btn-ember');
await new Promise(r => setTimeout(r, 3000));
const boss = await probe();
console.log('6 BOSS:', JSON.stringify(boss));
const bossState = await page.evaluate(() => ({
  blueActive: B.blue.ghosts[B.blue.activeIdx].id,
  blueBase: B.blue.ghosts[B.blue.activeIdx].baseId,
  padded: B.blue.ghosts.filter(g => g.isPadded).length,
}));
console.log('6 BOSS-STATE:', JSON.stringify(bossState));
await page.screenshot({ path: `${OUT}/x-boss.png` });

await browser.close();
console.log('INTERACT DONE');
