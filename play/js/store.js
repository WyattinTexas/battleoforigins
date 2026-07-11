/* ============================================================
   BOO2 store — The Pack Peddler. Spend ★ (earned in battles/raids)
   on booster packs and the daily featured spirit; real-money ★
   bundles live behind js/payments.js (StoreKit-shaped).
   Nation-style register gate: claim your name before trading.
   ============================================================ */
(function () {
  const PACK_PRICE = 100;
  const RARITY_PRICE = { 'common': 150, 'uncommon': 250, 'rare': 400, 'ghost-rare': 700, 'ghost rare': 700, 'legendary': 1200 };
  const RARITY_LABEL = { 'common': 'COMMON', 'uncommon': 'UNCOMMON', 'rare': 'RARE', 'ghost-rare': 'GHOST RARE', 'ghost rare': 'GHOST RARE', 'legendary': 'LEGENDARY' };

  function named() { return !!localStorage.getItem('boo2Named'); }

  /* deterministic featured spirit — same for every player all day */
  function dailySpirit() {
    const key = BOO2M.currentDateKey();
    let h = 0;
    for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
    const pool = getActiveGhosts();
    return pool[h % pool.length];
  }

  async function render() {
    const gate = !named();
    const g = dailySpirit();
    const owned = BOO2M.ownsCard(g.id);
    const price = RARITY_PRICE[g.rarity] || 400;
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

      <div class="store-item${gate ? ' gated' : ''}">
        <img class="si-art" src="art/booster-pack.webp" alt="">
        <div class="si-body">
          <div class="si-name creep">BOOSTER PACK</div>
          <div class="si-sub">4 spirits · two slots roll rare or better</div>
        </div>
        <button class="si-buy" id="buyPackBtn" onclick="BOO2ST2.buyPack(this)" ${gate ? 'disabled' : ''}>★ ${PACK_PRICE}</button>
      </div>

      <div class="store-item daily${gate ? ' gated' : ''}">
        <img class="si-art" src="${boo2Art(g.id)}" alt="${g.name}" onclick="BOO2C.openDetail(${g.id})">
        <div class="si-body">
          <div class="si-tag">TODAY'S SPIRIT</div>
          <div class="si-name creep">${g.name}</div>
          <div class="si-sub" style="color:${g.rarity === 'legendary' ? 'var(--r-legend)' : 'var(--text-dim)'}">${RARITY_LABEL[g.rarity] || g.rarity} · ♥ ${g.maxHp} HP</div>
        </div>
        ${owned
          ? '<span class="si-owned">OWNED</span>'
          : `<button class="si-buy" onclick="BOO2ST2.buyDaily(this)" ${gate ? 'disabled' : ''}>★ ${price}</button>`}
      </div>

      <div class="store-section">★ BUNDLES <span class="ss-note">· App Store</span></div>
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

  function buyDaily(btn) {
    const g = dailySpirit();
    const price = RARITY_PRICE[g.rarity] || 400;
    arm(btn, 'SURE?', async () => {
      const ok = await BOO2M.spendStars(price);
      if (!ok) { showToast(`Not enough ★ — you need ${price}`); render(); return; }
      BOO2M.addCards([g.id]);
      BOO2S.refreshChrome();
      showToast(`${g.name} joins your collection!`);
      render();
    });
  }

  async function buyProduct(id) {
    const res = await BOO2PAY.purchase(id);
    if (!res.ok) { showToast(res.message || 'Purchase unavailable'); return; }
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

  window.BOO2ST2 = { render, buyPack, buyDaily, buyProduct, restore };
})();
