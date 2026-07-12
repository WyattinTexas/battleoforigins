/* ============================================================
   BOO2 meta layer — identity, ★ economy, rating, collection,
   packs, daily champions. Ported from FAVOR testrealm2/js/meta.js
   (proven pattern: lazy join, atomic txns, localStorage fallback,
   lazy idempotent daily settlement at 10PM ET).

   M1 ships in LOCAL mode (no Firebase SDK loaded). The db adapter,
   settlement, and leaderboard code are already here so M3 only has
   to load the SDK, fill FB_CONFIG usage, and stop forcing local.
   Namespace: EVERYTHING under boo2/* — never touch beta's mp/*.
   ============================================================ */
(function () {
  const NS = 'boo2';
  const FB_CONFIG = {
    apiKey: 'AIzaSyDzYoQqXoOu4uj2wzTwSn6d_gAlo6e8WSI',
    authDomain: 'testroom-75200.firebaseapp.com',
    databaseURL: 'https://testroom-75200-default-rtdb.firebaseio.com',
    projectId: 'testroom-75200',
  };

  // ── economy (1v1: every game pays; daily podium is the jackpot on top)
  const STARS_WIN = 10, STARS_LOSS = 4;
  const RATING_WIN = 15, RATING_LOSS = -10;
  const STAR_AWARDS = [50, 25, 10];
  const CHAMP_KEYS = ['gold', 'silver', 'bronze'];

  // ── identity: spooky-cute anon names
  const NAME_TITLES = ['Phantom', 'Spooky', 'Wisp', 'Shade', 'Ghostly', 'Misty', 'Moonlit', 'Twilight', 'Ember', 'Frosty', 'Hollow', 'Midnight', 'Rattly', 'Boo'];
  const NAME_NOUNS = ['Pumpkin', 'Marshmallow', 'Biscuit', 'Waffles', 'Toffee', 'Pudding', 'Mitten', 'Button', 'Clover', 'Sprout', 'Nugget', 'Pickle', 'Muffin', 'Cocoa', 'Doodle', 'Tumble', 'Whistle', 'Bramble', 'Custard', 'Snickers', 'Lantern', 'Fiddle'];

  let mode = 'local'; // M1: forced local. M3: connect() may set 'firebase'.
  let fdb = null;

  function uid() {
    let u = localStorage.getItem('boo2Uid');
    if (!u) { u = 'u' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36); localStorage.setItem('boo2Uid', u); }
    return u;
  }
  function generateName() {
    const t = NAME_TITLES[Math.floor(Math.random() * NAME_TITLES.length)];
    const n = NAME_NOUNS[Math.floor(Math.random() * NAME_NOUNS.length)];
    return `${t} ${n}`;
  }
  function myName() {
    let n = localStorage.getItem('boo2Name');
    if (!n) { n = generateName(); localStorage.setItem('boo2Name', n); }
    return n;
  }
  function rename(newName) {
    const n = String(newName || '').trim().slice(0, 24);
    if (n.length < 3) return false;
    localStorage.setItem('boo2Name', n);
    localStorage.setItem('boo2Named', '1'); // claimed a name — unlocks the store (Nation-style gate)
    dbUpdate(`players/${uid()}`, { name: n });
    return true;
  }

  // ── 10PM ET daily boundary (ported VERBATIM from FAVOR meta.js)
  function etParts(d = new Date()) {
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/New_York', hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit',
    });
    const p = {};
    fmt.formatToParts(d).forEach(x => { p[x.type] = x.value; });
    return { y: p.year, m: p.month, d: p.day, h: parseInt(p.hour, 10) % 24 };
  }
  function currentDateKey(now = new Date()) {
    const p = etParts(now);
    if (p.h >= 22) {
      const dt = new Date(Date.UTC(+p.y, +p.m - 1, +p.d));
      dt.setUTCDate(dt.getUTCDate() + 1);
      return dt.toISOString().slice(0, 10);
    }
    return `${p.y}-${p.m}-${p.d}`;
  }

  // ── db adapter: firebase or localStorage tree under boo2LB
  function localTree() { try { return JSON.parse(localStorage.getItem('boo2LB') || '{}'); } catch (e) { return {}; } }
  function saveTree(t) { localStorage.setItem('boo2LB', JSON.stringify(t)); }
  function walk(t, path) { return path.split('/').reduce((n, k) => (n == null ? undefined : n[k]), t); }
  function setWalk(t, path, val) {
    const ks = path.split('/');
    let n = t;
    for (let i = 0; i < ks.length - 1; i++) { if (typeof n[ks[i]] !== 'object' || n[ks[i]] == null) n[ks[i]] = {}; n = n[ks[i]]; }
    if (val === null || val === undefined) delete n[ks[ks.length - 1]]; else n[ks[ks.length - 1]] = val;
  }
  async function dbGet(path) {
    if (mode === 'firebase') return (await fdb.ref(`${NS}/${path}`).get()).val();
    return walk(localTree(), path) ?? null;
  }
  async function dbSet(path, val) {
    if (mode === 'firebase') return fdb.ref(`${NS}/${path}`).set(val);
    const t = localTree(); setWalk(t, path, val); saveTree(t);
  }
  async function dbUpdate(path, obj) {
    if (mode === 'firebase') return fdb.ref(`${NS}/${path}`).update(obj);
    const t = localTree();
    for (const k of Object.keys(obj)) setWalk(t, `${path}/${k}`, obj[k]);
    saveTree(t);
  }
  async function dbPush(path, val) {
    if (mode === 'firebase') return fdb.ref(`${NS}/${path}`).push(val);
    const t = localTree(); const key = 'k' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    setWalk(t, `${path}/${key}`, val); saveTree(t);
  }
  async function dbTxn(path, fn) {
    if (mode === 'firebase') {
      const res = await fdb.ref(`${NS}/${path}`).transaction(fn);
      return { committed: res.committed, value: res.snapshot ? res.snapshot.val() : null };
    }
    const t = localTree(); const cur = walk(t, path) ?? null;
    const next = fn(cur);
    if (next === undefined) return { committed: false, value: cur };
    setWalk(t, path, next); saveTree(t);
    return { committed: true, value: next };
  }

  // M3 flips this on. Proves the wire with a 6s-raced read before trusting it.
  async function connect() {
    if (!window.firebase || !firebase.database) { mode = 'local'; return mode; }
    try {
      if (!firebase.apps.length) firebase.initializeApp(FB_CONFIG);
      fdb = firebase.database();
      await Promise.race([
        fdb.ref(`${NS}/players/${uid()}/name`).get(),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 6000)),
      ]);
      mode = 'firebase';
    } catch (e) {
      console.warn('[BOO2 meta] offline, using local standings:', e.message);
      mode = 'local'; fdb = null;
    }
    return mode;
  }

  // ── player record (lazy join: row materializes on first result post)
  let me = { stars: 0, rating: 0, wins: 0, losses: 0, champs: {} };
  async function readPlayer() {
    const p = await dbGet(`players/${uid()}`);
    if (p) {
      me = Object.assign(me, p);
      if (p.name) localStorage.setItem('boo2Name', p.name); // remote name wins
    }
    return me;
  }
  function snapshot() { return { stars: me.stars || 0, rating: me.rating || 0, wins: me.wins || 0, losses: me.losses || 0 }; }

  // ── post a finished game. result: 'win' | 'loss' | 'draw'
  // ONE whole-row txn (FAVOR hardening): stars/rating/record/streak/sig
  // land together, spread preserves msgQueue/owned/champs against races.
  async function postGameResult(result) {
    const starDelta = result === 'win' ? STARS_WIN : STARS_LOSS;
    const ratingDelta = result === 'win' ? RATING_WIN : (result === 'loss' ? RATING_LOSS : 0);
    const u = uid();
    const sig = team()[0]; // signature spirit = current lead (standings avatar)
    await dbTxn(`players/${u}`, p => {
      const cur = p || {};
      const next = Object.assign({}, cur);
      next.stars = (cur.stars || 0) + starDelta;
      next.rating = Math.max(0, (cur.rating || 0) + ratingDelta);
      if (result === 'win') {
        next.wins = (cur.wins || 0) + 1;
        next.streak = (cur.streak || 0) + 1;
        next.bestStreak = Math.max(cur.bestStreak || 0, next.streak);
      } else {
        next.losses = (cur.losses || 0) + 1;
        next.streak = 0;
      }
      next.name = myName();
      if (sig != null) next.sig = sig;
      next.lastSeen = Date.now();
      return next;
    });
    if (result === 'win') {
      // daily board metric: wins today; `at` = when this count was reached (tiebreak: earliest)
      const key = currentDateKey();
      await dbTxn(`daily/${key}/scores/${u}`, cur => ({
        name: myName(),
        best: ((cur && cur.best) || 0) + 1,
        at: Date.now(),
      }));
    }
    await readPlayer();
    return { starDelta, ratingDelta };
  }

  // ── whole-record txn on ANY player row (rival personas drift through this)
  async function txnPlayer(playerUid, fn) {
    return dbTxn(`players/${playerUid}`, fn);
  }

  // ── spend/earn stars outside games (raid rewards M2, store M4)
  async function addStars(n) { await dbTxn(`players/${uid()}/stars`, s => (s || 0) + n); await readPlayer(); }
  async function spendStars(n) {
    // pre-read guard: can't-afford players never reach the txn (FAVOR pattern)
    const cur = (await dbGet(`players/${uid()}/stars`)) || 0;
    if (cur < n) return false;
    // Whole-record txn. CRITICAL: on Firebase's null first-guess return a
    // provisional stub — returning undefined there aborts BEFORE the server's
    // real record is consulted (FAVOR meta.js lesson, verified here too).
    let paid = false;
    const res = await dbTxn(`players/${uid()}`, p => {
      if (p === null || p === undefined) { paid = false; return { stars: 0 }; }
      const s = p.stars || 0;
      if (s < n) { paid = false; return; } // genuine insufficient funds
      paid = true;
      return Object.assign({}, p, { stars: s - n });
    });
    if (res.committed && paid) { await readPlayer(); return true; }
    return false;
  }

  // ── daily settlement (lazy, idempotent — txn claim on settled/{key})
  function podiumSort(scores) {
    return Object.entries(scores || {})
      .map(([u, s]) => ({ uid: u, name: s.name, best: s.best, at: s.at || 0 }))
      .sort((a, b) => (b.best - a.best) || (a.at - b.at));
  }
  async function settleDue() {
    try {
      const cur = currentDateKey();
      const days = await dbGet('daily');
      if (!days) return;
      for (const key of Object.keys(days).sort()) {
        if (key >= cur) continue;
        const claim = await dbTxn(`settled/${key}`, existing => {
          if (existing) return; // already settled — abort
          return { at: Date.now(), by: uid() };
        });
        if (!claim.committed || !claim.value || claim.value.by !== uid()) continue;
        const podium = podiumSort((days[key] || {}).scores).slice(0, 3);
        for (let i = 0; i < podium.length; i++) {
          const p = podium[i];
          await dbTxn(`players/${p.uid}/stars`, s => (s || 0) + STAR_AWARDS[i]);
          await dbTxn(`players/${p.uid}/champs/${CHAMP_KEYS[i]}`, c => (c || 0) + 1);
          await dbPush(`players/${p.uid}/msgQueue`, { type: 'daily_champion', dateKey: key, place: i + 1, stars: STAR_AWARDS[i] });
        }
        await dbUpdate(`settled/${key}`, {
          podium: podium.map((p, i) => ({ uid: p.uid, name: p.name, best: p.best, stars: STAR_AWARDS[i] })),
        });
      }
    } catch (e) { console.warn('[BOO2 meta] settle failed:', e.message); }
  }

  // ── collection & team (device-synchronous; mirrored like FAVOR's favorOwned)
  function ownedIds() { try { return JSON.parse(localStorage.getItem('boo2Owned') || '[]'); } catch (e) { return []; } }
  function ownsCard(id) { return ownedIds().includes(id); }
  function addCards(ids) {
    const cur = new Set(ownedIds());
    const fresh = [];
    ids.forEach(id => { if (!cur.has(id)) { cur.add(id); fresh.push(id); } });
    const arr = [...cur];
    localStorage.setItem('boo2Owned', JSON.stringify(arr));
    const owned = {}; arr.forEach(id => owned[id] = true);
    dbUpdate(`players/${uid()}`, { owned }); // cloud mirror (no-op harm in local mode)
    return fresh; // which of these were NEW
  }
  function team() {
    try {
      const t = JSON.parse(localStorage.getItem('boo2Team') || '[]');
      return Array.isArray(t) ? t.filter(id => ownsCard(id)).slice(0, 3) : [];
    } catch (e) { return []; }
  }
  function setTeam(ids) { localStorage.setItem('boo2Team', JSON.stringify(ids.slice(0, 3))); }

  // ── packs: counts + rarity rolls (odds from beta ARCHITECTURE.md)
  function packCount() { return parseInt(localStorage.getItem('boo2Packs') || '0', 10); }
  function addPacks(n) { localStorage.setItem('boo2Packs', String(packCount() + n)); }
  function takePack() {
    const c = packCount();
    if (c <= 0) return false;
    localStorage.setItem('boo2Packs', String(c - 1));
    return true;
  }
  function pickByRarity(rarity, excludeIds) {
    const pool = getActiveGhosts().filter(g => g.rarity === rarity && !excludeIds.includes(g.id));
    if (!pool.length) return null;
    return pool[Math.floor(Math.random() * pool.length)].id;
  }
  function rollSlot(odds, excludeIds) {
    let r = Math.random(), acc = 0;
    for (const [rarity, p] of odds) {
      acc += p;
      if (r < acc) {
        const id = pickByRarity(rarity, excludeIds);
        if (id != null) return id;
      }
    }
    return pickByRarity('common', excludeIds) || getActiveGhosts()[0].id;
  }
  const PACK_SLOTS = [
    [['common', 1]],
    [['common', 0.7], ['uncommon', 0.3]],
    [['uncommon', 0.4], ['rare', 0.35], ['ghost-rare', 0.2], ['legendary', 0.05]],
    [['uncommon', 0.5], ['rare', 0.3], ['ghost-rare', 0.15], ['legendary', 0.05]],
  ];
  function rollPack() {
    const ids = [];
    PACK_SLOTS.forEach(odds => ids.push(rollSlot(odds, ids)));
    return ids;
  }
  // Welcome pack: exactly the 3 starters — your first team IS the pack.
  // (Wyatt 7/11: starting with 6 dulls the collection pull; 3 brings you in.)
  const STARTERS = [1, 2, 35]; // Kodako, Nikon, Larry — abilities auto-resolve, great first game
  function rollWelcomePack() {
    return [...STARTERS];
  }

  // ── queued messages (champion crowns, star purchases) — shown at boot
  // and by the purchase watcher. Returns how many were shown.
  async function drainMsgs(showFn) {
    const msgs = await dbGet(`players/${uid()}/msgQueue`);
    if (!msgs) return 0;
    let shown = 0;
    for (const key of Object.keys(msgs)) {
      const m = msgs[key];
      if (m && m.type && typeof showFn === 'function') { await showFn(m); shown++; }
      await dbSet(`players/${uid()}/msgQueue/${key}`, null);
    }
    return shown;
  }

  // ── PayPal ★ watcher (FAVOR Royal Mint pattern) ──────────────────
  // payments.js opens the checkout tab; the box credits the balance
  // server-side. We just watch our own row until the ★ appear.
  let _starsWatch = null;
  function notePendingPurchase(packKey, stars) {
    localStorage.setItem('boo2PendingStars', JSON.stringify({ packKey, stars, at: Date.now() }));
  }
  function clearPendingPurchase() {
    localStorage.removeItem('boo2PendingStars');
    _starsWatch = null;
  }
  function watchForStars() {
    let pending = null;
    try { pending = JSON.parse(localStorage.getItem('boo2PendingStars')); } catch (e) {}
    if (!pending || Date.now() - pending.at > 30 * 60 * 1000) { clearPendingPurchase(); return; }
    if (_starsWatch) return;               // one watcher is plenty
    _starsWatch = { baseline: me.stars || 0 };
    const tick = async () => {
      if (!_starsWatch) return;
      try {
        const s = (await dbGet(`players/${uid()}/stars`)) || 0;
        if (s > _starsWatch.baseline) {
          const gained = s - _starsWatch.baseline;
          clearPendingPurchase();
          await readPlayer();
          BOO2S.refreshChrome();
          // the IPN also queued a congrats — prefer it (knows the pack);
          // fall back to our own count if the queue was empty
          const shown = await drainMsgs(m => window.BOO2ST && BOO2ST.showMsg(m));
          if (!shown && window.BOO2ST) await BOO2ST.showMsg({ type: 'star_purchase', stars: gained });
          return;
        }
      } catch (e) { /* wire hiccup — keep watching */ }
      _starsWatch.timer = setTimeout(tick, 5000);
    };
    tick();
  }

  async function boot() {
    await connect(); // firebase when reachable, local tree otherwise
    await readPlayer();
    await settleDue();
    return me;
  }

  // ── standings reads (mode-aware) ──
  async function fetchAllTime() {
    const players = await dbGet('players');
    return Object.entries(players || {})
      .map(([u, p]) => ({ uid: u, name: p.name, rating: p.rating || 0, wins: p.wins || 0, champs: p.champs || {}, sig: p.sig, streak: p.streak || 0, bot: !!p.bot }))
      .filter(p => p.name)
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 50);
  }
  async function fetchDaily() {
    const scores = await dbGet(`daily/${currentDateKey()}/scores`);
    const rows = podiumSort(scores).slice(0, 50);
    // borrow avatars/streaks by uid so today's board gets faces too
    try {
      const players = await dbGet('players');
      rows.forEach(r => {
        const p = players && players[r.uid];
        if (p) { r.sig = p.sig; r.streak = p.streak || 0; }
      });
    } catch (e) {}
    return rows;
  }
  // yesterday's crowned podium (insights strip)
  async function fetchLastPodium() {
    const settled = await dbGet('settled');
    if (!settled) return null;
    const keys = Object.keys(settled).filter(k => settled[k] && settled[k].podium).sort();
    if (!keys.length) return null;
    return { dateKey: keys[keys.length - 1], podium: settled[keys[keys.length - 1]].podium };
  }
  function msUntilSettle(now = new Date()) {
    // next 22:00 America/New_York, walked in 5-min steps (DST-proof).
    // Inside the 22:xx hour the board already flipped — count to tomorrow's.
    let t = now.getTime();
    let guard = 0;
    while (etParts(new Date(t)).h === 22 && guard++ < 20) t += 5 * 60 * 1000;
    for (let i = 0; i < 24 * 13; i++) {
      if (etParts(new Date(t)).h === 22) break;
      t += 5 * 60 * 1000;
    }
    return Math.max(0, t - now.getTime());
  }

  window.BOO2M = {
    NS, uid, myName, rename, generateName,
    currentDateKey, podiumSort, settleDue, drainMsgs,
    notePendingPurchase, clearPendingPurchase, watchForStars,
    connect, boot, readPlayer, snapshot, postGameResult, addStars, spendStars, txnPlayer,
    ownedIds, ownsCard, addCards, team, setTeam,
    packCount, addPacks, takePack, rollPack, rollWelcomePack,
    fetchAllTime, fetchDaily, fetchLastPodium, msUntilSettle,
    mode: () => mode,
    STARS_WIN, STARS_LOSS, STAR_AWARDS,
  };
})();
