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
  async function postGameResult(result) {
    const starDelta = result === 'win' ? STARS_WIN : STARS_LOSS;
    const ratingDelta = result === 'win' ? RATING_WIN : (result === 'loss' ? RATING_LOSS : 0);
    const u = uid();
    await dbTxn(`players/${u}/stars`, s => (s || 0) + starDelta);
    await dbTxn(`players/${u}/rating`, r => Math.max(0, (r || 0) + ratingDelta));
    await dbTxn(`players/${u}/${result === 'win' ? 'wins' : 'losses'}`, w => (w || 0) + 1);
    // awaited on purpose — fire-and-forget here can resurrect deleted rows (FAVOR lesson)
    await dbUpdate(`players/${u}`, { name: myName(), lastSeen: Date.now() });
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

  // ── spend/earn stars outside games (raid rewards M2, store M4)
  async function addStars(n) { await dbTxn(`players/${uid()}/stars`, s => (s || 0) + n); await readPlayer(); }
  async function spendStars(n) {
    const cur = (await dbGet(`players/${uid()}/stars`)) || 0;
    if (cur < n) return false;
    const res = await dbTxn(`players/${uid()}/stars`, s => {
      if (s === null || s === undefined) s = 0;
      if (s < n) return; // abort
      return s - n;
    });
    if (res.committed) await readPlayer();
    return res.committed;
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
  // Welcome pack: 3 fixed modal-free starters + 1 common + 1 uncommon + 1 juicy slot
  const STARTERS = [1, 2, 35]; // Kodako, Nikon, Larry — abilities auto-resolve, great first game
  function rollWelcomePack() {
    const ids = [...STARTERS];
    ids.push(rollSlot([['common', 1]], ids));
    ids.push(rollSlot([['uncommon', 1]], ids));
    ids.push(rollSlot(PACK_SLOTS[2], ids));
    return ids;
  }

  // ── champion messages (shown by shell at boot when they exist)
  async function drainMsgs(showFn) {
    const msgs = await dbGet(`players/${uid()}/msgQueue`);
    if (!msgs) return;
    for (const key of Object.keys(msgs)) {
      const m = msgs[key];
      if (m && m.type === 'daily_champion' && typeof showFn === 'function') await showFn(m);
      await dbSet(`players/${uid()}/msgQueue/${key}`, null);
    }
  }

  async function boot() {
    // M1: stay local. M3 will call connect() first.
    await readPlayer();
    await settleDue();
    return me;
  }

  window.BOO2M = {
    NS, uid, myName, rename, generateName,
    currentDateKey, podiumSort, settleDue, drainMsgs,
    connect, boot, readPlayer, snapshot, postGameResult, addStars, spendStars,
    ownedIds, ownsCard, addCards, team, setTeam,
    packCount, addPacks, takePack, rollPack, rollWelcomePack,
    mode: () => mode,
    STARS_WIN, STARS_LOSS, STAR_AWARDS,
  };
})();
