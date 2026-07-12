/* ============================================================
   BOO2 store — The Pack Peddler, v2 (KICKOFF Phase D).
   A shop that changes every day: 4 seeded daily spirits with
   rarity-tiered ★ prices + rotation countdown, the booster pack,
   and THE REAPER'S VAULT — a rating-gated exclusive shelf whose
   locked door is the aspiration. Real money buys ★ only
   (js/payments.js seam); cards are ALWAYS ★ (App Store parity).
   Rotation clock = the 10PM-ET dateKey — the same daily heartbeat
   as Daily Champions, so the whole game flips at once.
   ============================================================ */
(function () {
  const PACK_PRICE = 100;
  // commons are impulse buys (under a pack), legendaries hurt a little
  const RARITY_PRICE = { 'common': 60, 'uncommon': 150, 'rare': 350, 'ghost-rare': 650, 'ghost rare': 650, 'legendary': 1200 };
  const RARITY_LABEL = { 'common': 'COMMON', 'uncommon': 'UNCOMMON', 'rare': 'RARE', 'ghost-rare': 'GHOST RARE', 'ghost rare': 'GHOST RARE', 'legendary': 'LEGENDARY' };
  const RARITY_CLASS = { 'common': 'common', 'uncommon': 'uncommon', 'rare': 'rare', 'ghost-rare': 'ghostrare', 'ghost rare': 'ghostrare', 'legendary': 'legendary' };
  const VAULT_RTG = 150; // live bands 7/12: fresh players 0–15, personas 15–460 — a real climb, not a wall
  let _countdown = null;

  function named() { return !!localStorage.getItem('boo2Named'); }
  function priceOf(g) { return RARITY_PRICE[g.rarity] || 350; }

  /* ── deterministic daily picks: same shop for every player all day ── */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function dayHash() {
    const key = BOO2M.currentDateKey();
    let h = 0;
    for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
    return h;
  }
  function pickFrom(pool, rnd, taken) {
    const open = pool.filter(g => !taken.has(g.id));
    if (!open.length) return null;
    const g = open[Math.floor(rnd() * open.length)];
    taken.add(g.id);
    return g;
  }
  function byRarity(r) {
    if (r === 'ghost-rare') return getActiveGhosts().filter(g => g.rarity === 'ghost-rare' || g.rarity === 'ghost rare');
    return getActiveGhosts().filter(g => g.rarity === r);
  }

  /* 4 slots, common → spicy; most days top out at rare,
     legendaries are events (~1 day in 12) */
  function dailySpirits() {
    const rnd = mulberry32(dayHash());
    const taken = new Set();
    const slot = odds => {
      const r = rnd();
      let acc = 0;
      for (const [rarity, p] of odds) {
        acc += p;
        if (r < acc) { const g = pickFrom(byRarity(rarity), rnd, taken); if (g) return g; }
      }
      return pickFrom(byRarity('common'), rnd, taken);
    };
    return [
      slot([['common', 1]]),
      slot([['common', 0.55], ['uncommon', 0.45]]),
      slot([['uncommon', 0.62], ['rare', 0.38]]),
      slot([['rare', 0.70], ['ghost-rare', 0.22], ['legendary', 0.08]]),
    ].filter(Boolean);
  }

  /* the Vault: 2 exclusive slots — a guaranteed legendary + a ghost-rare,
     rotating on the same dateKey but seeded apart from the daily row */
  function vaultSpirits() {
    const rnd = mulberry32((dayHash() ^ 0x9E3779B9) >>> 0);
    const taken = new Set(dailySpirits().map(g => g.id));
    return [
      pickFrom(byRarity('legendary'), rnd, taken),
      pickFrom(byRarity('ghost-rare'), rnd, taken),
    ].filter(Boolean);
  }

  function fmtCountdown() {
    const ms = BOO2M.msUntilSettle();
    const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
    return `${h}h ${String(m).padStart(2, '0')}m`;
  }

  function slotHtml(g, kind, i, gate) {
    const owned = BOO2M.ownsCard(g.id);
    const cls = RARITY_CLASS[g.rarity] || 'rare';
    return `
      <div class="ds-slot r-${cls}${owned ? ' owned' : ''}" ${owned ? '' : `data-flip="${kind}-${i}"`}>
        <div class="ds-card" onclick="BOO2C.openDetail(${g.id})">
          <img src="${boo2Art(g.id)}" alt="${g.name}" loading="lazy">
          <div class="ds-rarity">${RARITY_LABEL[g.rarity] || g.rarity}</div>
        </div>
        <div class="ds-name">${g.name}</div>
        ${owned
          ? '<span class="ds-owned">✓ OWNED</span>'
          : `<button class="ds-buy" onclick="BOO2ST2.buySlot('${kind}', ${i}, this)" ${gate ? 'disabled' : ''}>★ ${priceOf(g)}</button>`}
      </div>`;
  }

  async function render() {
    const gate = !named();
    const daily = dailySpirits();
    const vault = vaultSpirits();
    const rating = BOO2M.snapshot().rating;
    const vaultOpen = rating >= VAULT_RTG;
    const stars = BOO2M.snapshot().stars;
    const products = await BOO2PAY.listProducts();
    const el = document.getElementById('storeBody');

    el.innerHTML = `
      ${gate ? `
      <button class="store-gate" onclick="BOO2S.openRename()">
        <span class="sg-icon">🕯️</span>
        <span><b>Claim your name</b> to trade with the Peddler.<br>
        <small>He doesn't deal with nameless spirits. Tap to choose.</small></span>
      </button>` : ''}

      <div class="store-section">TODAY'S SPIRITS <span class="ss-note" id="dailyCountdown">· new spirits in ${fmtCountdown()}</span></div>
      <div class="daily-row${gate ? ' gated' : ''}">
        ${daily.map((g, i) => slotHtml(g, 'daily', i, gate)).join('')}
      </div>

      <div class="store-item${gate ? ' gated' : ''}">
        <img class="si-art" src="art/booster-pack.webp" alt="">
        <div class="si-body">
          <div class="si-name creep">BOOSTER PACK</div>
          <div class="si-sub">4 spirits · two slots roll rare or better</div>
        </div>
        <button class="si-buy" id="buyPackBtn" onclick="BOO2ST2.buyPack(this)" ${gate ? 'disabled' : ''}>★ ${PACK_PRICE}</button>
      </div>

      <div class="vault${vaultOpen ? ' open' : ' locked'}">
        <div class="vault-head">
          <img class="vault-art" src="art/vault-reaper.webp" alt="">
          <div class="vault-title">
            <div class="vt-name creep">THE REAPER'S VAULT</div>
            <div class="vt-sub">${vaultOpen
              ? `The Reaper deals with champions. Today's hoard:`
              : `He only trades with the proven.`}</div>
          </div>
          ${vaultOpen
            ? '<span class="vault-badge open">OPEN</span>'
            : `<span class="vault-badge">🔒 ${VAULT_RTG} RTG</span>`}
        </div>
        ${vaultOpen ? `
        <div class="daily-row vault-row${gate ? ' gated' : ''}">
          ${vault.map((g, i) => slotHtml(g, 'vault', i, gate)).join('')}
        </div>` : `
        <div class="vault-lock">
          <div class="vl-bar"><i style="width:${Math.min(100, Math.round(rating / VAULT_RTG * 100))}%"></i></div>
          <div class="vl-text">Your legend: <b>${rating} RTG</b> — reach <b>${VAULT_RTG}</b> to open the door.
          A guaranteed <b>LEGENDARY</b> waits inside, every day.</div>
        </div>`}
      </div>

      <div class="store-section">★ BUNDLES <span class="ss-note">· PayPal</span></div>
      <div class="bundle-row">
        ${products.filter(p => p.kind === 'stars').map(p => `
          <button class="bundle" onclick="BOO2ST2.buyProduct('${p.id}')">
            ${p.badge ? `<span class="bd-badge">${p.badge}</span>` : ''}
            <span class="bd-stars">${p.label}</span>
            <span class="bd-price">${p.price}</span>
          </button>`).join('')}
      </div>
      ${products.filter(p => p.kind === 'cosmetic').map(p => `
        <button class="store-item cosmetic" onclick="BOO2ST2.buyProduct('${p.id}')">
          <span class="si-art" style="display:flex;align-items:center;justify-content:center;font-size:34px">🏮</span>
          <span class="si-body">
            <span class="si-name creep" style="font-size:19px">${p.label}</span>
            <span class="si-sub">${p.desc}</span>
          </span>
          <span class="si-buy">${p.price}</span>
        </button>`).join('')}
      <button class="restore-btn" onclick="BOO2ST2.restore()">Restore Purchases</button>
      <div class="store-foot">You have ★ ${stars}. Every battle pays ★ — raids pay more.</div>`;

    clearInterval(_countdown);
    _countdown = setInterval(() => {
      const c = document.getElementById('dailyCountdown');
      if (!c) { clearInterval(_countdown); return; }
      c.textContent = `· new spirits in ${fmtCountdown()}`;
    }, 30000);
  }

  /* two-tap confirm on the button itself (no blocking dialogs) */
  function arm(btn, label, fn) {
    if (btn.dataset.armed === '1') { btn.dataset.armed = ''; fn(); return; }
    btn.dataset.armed = '1';
    const orig = btn.textContent;
    btn.textContent = label;
    setTimeout(() => { if (btn.dataset.armed === '1') { btn.dataset.armed = ''; btn.textContent = orig; } }, 2200);
  }

  function buyPack(btn) {
    arm(btn, 'SURE?', async () => {
      const ok = await BOO2M.spendStars(PACK_PRICE);
      if (!ok) { showToast(`Not enough ★ — you need ${PACK_PRICE}`); render(); return; }
      BOO2S.refreshChrome();
      BOO2C.openCeremony(BOO2M.rollPack(), 'BOOSTER PACK', () => { BOO2S.showScreen('store'); });
    });
  }

  /* daily/vault slot purchase → pay → flip → ceremony reveal (rays on rare+) */
  function buySlot(kind, i, btn) {
    const g = (kind === 'vault' ? vaultSpirits() : dailySpirits())[i];
    if (!g) return;
    if (kind === 'vault' && BOO2M.snapshot().rating < VAULT_RTG) { showToast('The Reaper ignores you. For now.'); return; }
    const price = priceOf(g);
    arm(btn, 'SURE?', async () => {
      const ok = await BOO2M.spendStars(price);
      if (!ok) { showToast(`Not enough ★ — you need ${price}`); render(); return; }
      BOO2M.addCards([g.id]);
      BOO2S.refreshChrome();
      const slotEl = document.querySelector(`[data-flip="${kind}-${i}"]`);
      if (slotEl) slotEl.classList.add('flipping');
      setTimeout(() => {
        BOO2C.openCeremony([g.id], kind === 'vault' ? "THE REAPER'S CUT" : 'DAILY SPIRIT', () => {
          BOO2S.showScreen('store');
        });
      }, 420);
    });
  }

  async function buyProduct(id) {
    const res = await BOO2PAY.purchase(id);
    if (!res.ok) { showToast(res.message || 'Purchase unavailable'); return; }
    // WEB (PayPal): the tab is open, the box will credit the account —
    // the watcher + msgQueue celebration take it from here. Never grant
    // client-side for web purchases.
    if (res.pending) { showToast(res.message || 'Finish in the PayPal tab — ★ arrive automatically'); return; }
    // StoreKit provider path (iOS wrap): grant what was bought
    const p = (await BOO2PAY.listProducts()).find(x => x.id === id);
    if (p && p.kind === 'stars') { await BOO2M.addStars(p.stars); BOO2S.refreshChrome(); }
    if (p && p.kind === 'cosmetic') { localStorage.setItem('boo2Founders', '1'); }
    render();
  }

  async function restore() {
    const res = await BOO2PAY.restore();
    showToast(res.message || 'Restore complete');
  }

  window.BOO2ST2 = { render, buyPack, buySlot, buyProduct, restore,
    _daily: dailySpirits, _vault: vaultSpirits, VAULT_RTG };
})();
