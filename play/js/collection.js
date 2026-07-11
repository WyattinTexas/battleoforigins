/* ============================================================
   BOO2 collection — 200-spirit grid (owned vs locked), card
   detail, and the pack-opening ceremony (pack opening = CHRISTMAS:
   glow, slow flips, screen shake on legendary).
   Data: engine/cards.js (gameplay truth) + js/data.js (num/lore/art).
   ============================================================ */
(function () {
  const RARITY_COLOR = {
    'common': 'var(--r-common)', 'uncommon': 'var(--r-uncommon)', 'rare': 'var(--r-rare)',
    'ghost-rare': 'var(--r-ghost)', 'ghost rare': 'var(--r-ghost)', 'legendary': 'var(--r-legend)',
  };
  const RARITY_LABEL = {
    'common': 'COMMON', 'uncommon': 'UNCOMMON', 'rare': 'RARE',
    'ghost-rare': 'GHOST RARE', 'ghost rare': 'GHOST RARE', 'legendary': 'LEGENDARY',
  };
  let activeSet = 'Set 1';

  const bySetCache = {};
  function spiritsOfSet(setKey) {
    if (!bySetCache[setKey]) {
      bySetCache[setKey] = getActiveGhosts()
        .filter(g => g.set === setKey)
        .sort((a, b) => boo2Num(a.id) - boo2Num(b.id));
    }
    return bySetCache[setKey];
  }

  function render() {
    const owned = new Set(BOO2M.ownedIds());
    document.getElementById('collCount').innerHTML = `<b>${owned.size}</b> / ${getActiveGhosts().length}`;
    // tabs
    const tabs = document.getElementById('setTabs');
    tabs.innerHTML = BOO2_SETS.map(s => {
      const n = spiritsOfSet(s.key).filter(g => owned.has(g.id)).length;
      const tot = spiritsOfSet(s.key).length;
      return `<button class="set-tab${s.key === activeSet ? ' active' : ''}" style="--set-c:${s.color}"
        onclick="BOO2C.showSet('${s.key.replace(/'/g, "\\'")}')">${s.short} ${n}/${tot}</button>`;
    }).join('');
    // grid
    const grid = document.getElementById('collGrid');
    grid.innerHTML = spiritsOfSet(activeSet).map(g => tileHtml(g, owned.has(g.id))).join('');
  }

  function tileHtml(g, isOwned) {
    const num = String(boo2Num(g.id)).padStart(3, '0');
    if (!isOwned) {
      return `<div class="card-tile locked" data-num="#${num}" onclick="BOO2C.teaseLocked(this)">
        <img src="${boo2Art(g.id)}" alt="" loading="lazy">
        <div class="ct-name">???</div>
      </div>`;
    }
    return `<div class="card-tile" onclick="BOO2C.openDetail(${g.id})">
      <img src="${boo2Art(g.id)}" alt="${g.name}" loading="lazy">
      <span class="ct-rar" style="color:${RARITY_COLOR[g.rarity]};background:${RARITY_COLOR[g.rarity]}"></span>
      <div class="ct-name">${g.name}</div>
    </div>`;
  }

  function showSet(key) { activeSet = key; render(); }

  function teaseLocked(el) {
    el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
    showToast('Locked — find this spirit in packs & raids');
  }

  function openDetail(id) {
    const g = getGhost(id);
    if (!g) return;
    const meta = BOO2_META[id] || {};
    const rc = RARITY_COLOR[g.rarity] || 'var(--gold)';
    const box = document.getElementById('detailCard');
    box.style.setProperty('--rc', rc);
    box.innerHTML = `
      <img class="dc-art" src="${boo2Art(id)}" alt="${g.name}">
      <div class="dc-body">
        <div class="dc-toprow">
          <div class="dc-name">${g.name}</div>
          <div class="dc-num">#${String(meta.num || 0).padStart(3, '0')}</div>
        </div>
        <div class="dc-meta">
          <span class="dc-chip" style="color:${rc}">${RARITY_LABEL[g.rarity] || g.rarity}</span>
          <span class="dc-chip" style="color:var(--text-dim)">${g.set.toUpperCase()}</span>
          <span class="dc-chip dc-hp">♥ ${g.maxHp} HP</span>
        </div>
        <div class="dc-ability">
          <div class="da-name">${g.ability}</div>
          <div class="da-desc">${g.abilityDesc}</div>
        </div>
        ${meta.lore ? `<div class="dc-lore">${meta.lore}</div>` : ''}
      </div>`;
    document.getElementById('cardDetail').classList.add('active');
  }
  function closeDetail() { document.getElementById('cardDetail').classList.remove('active'); }

  /* ─────────── PACK CEREMONY ───────────
     openCeremony(ids, title, onDone): pack pulses → tap → cards dealt
     face-down → tap each to flip (rarity glow; legendary = rays + shake).
     Continue appears once all are flipped. */
  let cerIds = null, cerFlipped = 0, cerDone = null;

  function openCeremony(ids, title, onDone) {
    cerIds = ids; cerFlipped = 0; cerDone = onDone || null;
    const ov = document.getElementById('packCeremony');
    ov.classList.remove('legendary');
    document.getElementById('cerTitle').textContent = title || 'BOOSTER PACK';
    document.getElementById('cerStage').innerHTML = `
      <div class="pack-wrap" onclick="BOO2C.burstPack()">
        <img class="pack-img" src="art/booster-pack.webp" alt="pack">
      </div>
      <div class="pack-hint">TAP TO OPEN</div>`;
    ov.classList.add('active');
  }

  function burstPack() {
    playPackSfx('sfxShatter', 0.5);
    const owned = new Set(BOO2M.ownedIds());
    const fresh = BOO2M.addCards(cerIds); // grant NOW (refresh-proof), remember which were new
    const newSet = new Set(fresh);
    document.getElementById('cerStage').innerHTML = `
      <div class="reveal-row">
        ${cerIds.map((id, i) => {
          const g = getGhost(id);
          const rc = RARITY_COLOR[g.rarity] || 'var(--gold)';
          const glow = g.rarity === 'legendary' ? 'glow-legend' : (g.rarity || '').startsWith('ghost') ? 'glow-ghost' : g.rarity === 'rare' ? 'glow-rare' : '';
          return `<div class="reveal-card" id="rc${i}" data-glow="${glow}" data-rarity="${g.rarity}" style="--rc:${rc}" onclick="BOO2C.flipCard(${i},${id})">
            <div class="reveal-inner">
              <div class="reveal-face reveal-back creep">?</div>
              <div class="reveal-face reveal-front">
                <img src="${boo2Art(id)}" alt="${g.name}">
                ${newSet.has(id) ? '<span class="rf-new">NEW</span>' : ''}
                <div class="rf-name">${g.name}</div>
              </div>
            </div>
          </div>`;
        }).join('')}
      </div>
      <button class="btn-ember ceremony-done" id="cerContinue" style="visibility:hidden" onclick="BOO2C.finishCeremony()">CONTINUE</button>`;
  }

  function flipCard(i, id) {
    const el = document.getElementById('rc' + i);
    if (!el || el.classList.contains('flipped')) return;
    el.classList.add('flipped');
    if (el.dataset.glow) el.classList.add(el.dataset.glow);
    cerFlipped++;
    const g = getGhost(id);
    if (g.rarity === 'legendary') {
      document.getElementById('packCeremony').classList.add('legendary');
      document.body.classList.remove('shake'); void document.body.offsetWidth;
      document.body.classList.add('shake');
      playPackSfx('sfxVictory', 0.55);
    } else if ((g.rarity || '').startsWith('ghost') || g.rarity === 'rare') {
      playPackSfx('sfxSpecial', 0.4);
    } else {
      playPackSfx('sfxDiceRoll', 0.3);
    }
    if (cerFlipped >= cerIds.length) {
      const btn = document.getElementById('cerContinue');
      if (btn) btn.style.visibility = 'visible';
    }
  }

  function finishCeremony() {
    document.getElementById('packCeremony').classList.remove('active');
    document.body.classList.remove('shake');
    const done = cerDone; cerIds = null; cerDone = null;
    render();
    if (typeof BOO2S !== 'undefined') BOO2S.refreshChrome();
    if (done) done();
  }

  // engine audio elements arrive with the injected arena fragment
  function playPackSfx(id, vol) {
    const a = document.getElementById(id);
    if (a && a.play) { try { a.volume = vol; a.currentTime = 0; a.play().catch(() => {}); } catch (e) {} }
  }

  window.BOO2C = { render, showSet, teaseLocked, openDetail, closeDetail, openCeremony, burstPack, flipCard, finishCeremony };
})();
