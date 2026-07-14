/* ============================================================
   BOO2 STAGE — "the whole party on the field." (v2.1, model_a)
   A play-side presentation layer that puts BOTH FULL TEAMS on
   the ice-castle stage behind the engine's card arena, which
   css/stage.css compresses into a bottom strip.

   Layout mirrors Wyatt's model_a mock (drbango.com/model_a/):
     · your 3 spirits stand on the steps — active center-forward
       and larger, the two sideline spirits smaller flanking behind
     · the enemy ACTIVE stands on the upper gate platform, their
       bench as small dimmed silhouettes flanking it
     · mock-style name/HP plates: enemy top-right, yours lower-left
     · the blue spellbook (specials) with a count badge sits at the
       left of the card strip — clicking it spotlights the engine's
       own ability buttons (presentation only, no engine logic)

   Engine files untouched (enginefix.js precedent): we wrap the
   engine's global functions on window —
     startBattle   → mount the stage (covers quick battle, raid
                     intro, boss fights AND rematch, which calls
                     startBattle internally)
     renderBattle  → sync sprites/plates/slots after every re-render
                     (KO swaps, forced swaps, heals, all ability
                     paths — anything that redraws cards). Slot
                     reassignment animates via CSS transform
                     transitions = the KO walk-forward.
     hitDamage     → hit flash + jitter on the struck ACTIVE; bench
                     hits are caught by per-ghost hp deltas in sync
                     (the engine exposes no bench-hit event)
     showGameOver  → victory pose for the winner's active
   State reads use the engine's top-level `let B` (visible to all
   classic scripts; NOT window.B) with typeof guards, and LIVE_PVP
   the same way — live friend battles keep the classic full-screen
   arena for v1, so the stage never mounts there.

   ⚠ The engine patches document.getElementById to return a hidden
   _battle_dummy div for ANY missing id — an existence check via
   getElementById is always truthy, and writes land on the dummy.
   This file therefore keeps direct element references and only
   uses querySelector for engine DOM.

   Sprites: sprites/{id}-front.webp (opponent, facing you) and
   sprites/{id}-back.webp (yours, seen from behind), listed in
   sprites/manifest.json {ids:[...]}. Any id not in the manifest
   falls back to a framed card-art token, so the stage works for
   all 200 spirits before clean art exists. Raid bosses (id 9201+)
   map to their baseId player card for art.
   ============================================================ */
(function () {
  let manifest = new Set();
  let mounted = false;
  let stage = null;
  const refs = { red: null, blue: null };        // plates
  const teams = { red: [], blue: [] };            // 3 actor refs per side
  const lastHp = { red: [null, null, null], blue: [null, null, null] };
  const lastHitFlash = { red: 0, blue: 0 };       // hitDamage timestamps
  let book = null, bookBadge = null, bookObserver = null, spotTimer = 0;

  const FRONT = id => 'sprites/' + id + '-front.webp';
  const BACK = id => 'sprites/' + id + '-back.webp';

  fetch('sprites/manifest.json?v=' + (window.BOO2_VERSION || 'dev'))
    .then(r => (r.ok ? r.json() : null))
    .then(m => {
      if (m && Array.isArray(m.ids)) {
        manifest = new Set(m.ids);
        if (mounted) { resetActors(); sync(); }
      }
    })
    .catch(() => {});

  function battleState() {
    try { if (typeof B !== 'undefined' && B && B.red && B.blue) return B; } catch (e) {}
    return null;
  }
  function isLivePvp() {
    try { return typeof LIVE_PVP !== 'undefined' && !!LIVE_PVP; } catch (e) { return false; }
  }
  function spriteIdOf(ghost) { return ghost.baseId != null ? ghost.baseId : ghost.id; }
  function tokenArt(id) {
    // /play/ ships optimized art for all 200 active ids — prefer it over
    // the engine's ../testroom/ paths (boss baseIds map into the 200 too)
    if (window.BOO2_META && BOO2_META[id]) return 'cards/' + id + '.webp';
    try {
      if (typeof ghostData === 'function') { const g = ghostData(id); if (g && g.art) return g.art; }
    } catch (e) {}
    return 'cards/' + id + '.webp';
  }

  /* ─────────── DOM (body-level, OUTSIDE #raid-screen — the shell's
     ensureArenaFresh() re-injects raid-screen innerHTML and would
     destroy anything we parked in there) ─────────── */
  const ACTOR_HTML = `
      <div class="actor-entry"><div class="actor-bob">
        <div class="actor-shadow"></div>
        <img class="actor-img" alt="" draggable="false">
        <div class="actor-flash"></div>
      </div></div>`;

  function ensureDom() {
    if (stage && document.body.contains(stage)) return;
    stage = document.createElement('div');
    stage.id = 'boo2-stage';
    stage.setAttribute('aria-hidden', 'true');
    stage.innerHTML = `
      <div class="stage-scene"></div>
      <div class="stage-wisps"><i></i><i></i><i></i><i></i></div>
      <div class="stage-vs" aria-hidden="true">VS</div>
      <div class="stage-team blue">
        <div class="stage-actor" data-i="0">${ACTOR_HTML}</div>
        <div class="stage-actor" data-i="1">${ACTOR_HTML}</div>
        <div class="stage-actor" data-i="2">${ACTOR_HTML}</div>
      </div>
      <div class="stage-team red">
        <div class="stage-actor" data-i="0">${ACTOR_HTML}</div>
        <div class="stage-actor" data-i="1">${ACTOR_HTML}</div>
        <div class="stage-actor" data-i="2">${ACTOR_HTML}</div>
      </div>
      <div class="stage-plate blue">
        <div class="plate-body">
          <div class="plate-name">…</div>
          <div class="plate-bar"><i></i></div>
          <div class="plate-hp">–/–</div>
        </div>
        <img class="plate-chip" alt="">
      </div>
      <div class="stage-plate red">
        <img class="plate-chip" alt="">
        <div class="plate-body">
          <div class="plate-name">…</div>
          <div class="plate-bar"><i></i></div>
          <div class="plate-hp">–/–</div>
        </div>
      </div>
`;
    document.body.appendChild(stage);

    // the spellbook lives on <body>, NOT inside #boo2-stage — the stage
    // is a z-index:0 stacking context BEHIND #raid-screen, so anything
    // inside it would paint under the engine strip
    book = document.createElement('button');
    book.type = 'button';
    book.className = 'stage-book';
    book.setAttribute('aria-label', 'Specials');
    book.innerHTML = `<img src="art/spellbook.webp" alt="" draggable="false"><span class="book-badge">0</span>`;
    document.body.appendChild(book);

    ['red', 'blue'].forEach(side => {
      teams[side] = Array.from(stage.querySelectorAll('.stage-team.' + side + ' .stage-actor')).map(actor => ({
        actor,
        entry: actor.querySelector('.actor-entry'),
        bob: actor.querySelector('.actor-bob'),
        img: actor.querySelector('.actor-img'),
        key: '',
      }));
    });
    [['red', '.stage-plate.red'], ['blue', '.stage-plate.blue']].forEach(([side, pSel]) => {
      const plate = stage.querySelector(pSel);
      refs[side] = {
        plate,
        name: plate.querySelector('.plate-name'),
        bar: plate.querySelector('.plate-bar i'),
        hp: plate.querySelector('.plate-hp'),
        chip: plate.querySelector('.plate-chip'),
      };
    });
    bookBadge = book.querySelector('.book-badge');
    book.addEventListener('click', spotlightSpecials);
  }

  function resetActors() {
    ['red', 'blue'].forEach(side => {
      teams[side].forEach(r => {
        r.key = '';
        r.actor.classList.remove('is-ko', 'victory', 'token-mode', 'slot-active', 'slot-left', 'slot-right');
      });
      lastHp[side] = [null, null, null];
    });
  }

  /* ─────────── mount / unmount ─────────── */
  function mount() {
    if (isLivePvp()) { document.body.classList.remove('boo2-stage'); return; }
    ensureDom();
    resetActors();
    document.body.classList.add('boo2-stage');
    mounted = true;
    preload();
    // first paint takes its slot positions without the walk animation
    stage.classList.add('no-anim');
    sync();
    void stage.offsetWidth;
    requestAnimationFrame(() => stage.classList.remove('no-anim'));
    watchAbilityButtons();
  }

  function preload() {
    const b = battleState();
    if (!b) return;
    [b.red, b.blue].forEach((t, i) => {
      t.ghosts.forEach(g => {
        const id = spriteIdOf(g);
        const img = new Image();
        img.src = manifest.has(id) ? (i === 0 ? BACK(id) : FRONT(id)) : tokenArt(id);
      });
    });
  }

  /* ─────────── sync: slots + sprites + plates ← engine state ─────────── */
  function sync() {
    if (!mounted || !teams.red.length || !document.body.classList.contains('boo2-stage')) return;
    const b = battleState();
    if (!b) return;
    ['red', 'blue'].forEach(side => {
      const t = b[side];
      let benchSeen = 0;
      t.ghosts.forEach((g, i) => {
        if (i > 2 || !teams[side][i]) return;
        const slot = i === t.activeIdx ? 'slot-active' : (benchSeen++ === 0 ? 'slot-left' : 'slot-right');
        updateActor(side, i, g, slot);
      });
      const active = t.ghosts[t.activeIdx];
      if (active) updatePlate(side, active);
    });
    updateBook();
  }

  function updateActor(side, i, g, slot) {
    const r = teams[side][i];
    const id = spriteIdOf(g);
    const hasSprite = manifest.has(id);
    const src = hasSprite ? (side === 'red' ? BACK(id) : FRONT(id)) : tokenArt(id);

    if (!r.actor.classList.contains(slot)) {
      r.actor.classList.remove('slot-active', 'slot-left', 'slot-right');
      r.actor.classList.add(slot);
    }
    if (r.key !== src) {
      r.key = src;
      r.actor.classList.toggle('token-mode', !hasSprite);
      r.actor.classList.remove('is-ko', 'victory');
      r.img.src = src;
      replay(r.entry, 'entering');
      lastHp[side][i] = null;
    }

    const ko = !!g.ko || g.hp <= 0;
    r.actor.classList.toggle('is-ko', ko);

    // per-character hit feedback: the engine only events the ACTIVE
    // (hitDamage) — bench damage is caught here by hp deltas
    const prev = lastHp[side][i];
    if (prev != null && g.hp < prev && !ko) {
      const isActive = slot === 'slot-active';
      const recentlyFlashed = isActive && Date.now() - lastHitFlash[side] < 700;
      if (!recentlyFlashed) replay(r.bob, 'hit');
    }
    lastHp[side][i] = g.hp;
  }

  function replay(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth; // restart the CSS animation
    el.classList.add(cls);
  }

  function updatePlate(side, g) {
    const r = refs[side];
    r.name.textContent = g.name;
    const hp = Math.max(0, g.hp);
    const pct = Math.max(0, Math.min(100, (hp / g.maxHp) * 100));
    r.bar.style.width = pct + '%';
    r.plate.classList.toggle('hp-over', g.hp > g.maxHp);
    r.plate.classList.toggle('hp-low', g.hp <= g.maxHp && pct <= 50 && pct > 25);
    r.plate.classList.toggle('hp-critical', g.hp <= g.maxHp && pct <= 25);
    r.plate.classList.toggle('is-ko', !!g.ko);
    r.hp.textContent = hp + ' / ' + g.maxHp;
    const art = tokenArt(spriteIdOf(g));
    if (r.chip.getAttribute('src') !== art) r.chip.src = art;
  }

  function flash(side) {
    if (!mounted) return;
    const b = battleState();
    if (!b || !b[side]) return;
    const r = teams[side][b[side].activeIdx];
    if (!r) return;
    lastHitFlash[side] = Date.now();
    replay(r.bob, 'hit');
  }

  /* ─────────── the spellbook — presentation over the engine's
     existing specials UI (#red-ability-buttons / #red-resources) ─────────── */
  function updateBook() {
    if (!book) return;
    const btns = document.querySelectorAll('#red-ability-buttons .ability-btn:not([disabled])');
    const n = btns.length;
    bookBadge.textContent = n;
    book.classList.toggle('has-specials', n > 0);
  }

  function spotlightSpecials() {
    document.body.classList.add('boo2-book-spot');
    clearTimeout(spotTimer);
    spotTimer = setTimeout(() => document.body.classList.remove('boo2-book-spot'), 2600);
    const box = document.querySelector('#red-ability-buttons');
    if (box && box.firstElementChild) {
      try { box.firstElementChild.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch (e) {}
    }
  }

  function watchAbilityButtons() {
    if (bookObserver) { bookObserver.disconnect(); bookObserver = null; }
    const box = document.querySelector('#red-ability-buttons');
    if (!box || typeof MutationObserver === 'undefined') return;
    bookObserver = new MutationObserver(updateBook);
    bookObserver.observe(box, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'] });
    updateBook();
  }

  /* ─────────── engine hooks ─────────── */
  function installHooks() {
    if (typeof window.startBattle === 'function') {
      const _start = window.startBattle;
      window.startBattle = function () {
        const r = _start.apply(this, arguments);
        try { mount(); } catch (e) { console.warn('[BOO2 stage] mount failed', e); }
        return r;
      };
    }
    if (typeof window.renderBattle === 'function') {
      const _render = window.renderBattle;
      window.renderBattle = function () {
        const r = _render.apply(this, arguments);
        try { sync(); } catch (e) {}
        return r;
      };
    }
    if (typeof window.hitDamage === 'function') {
      const _hit = window.hitDamage;
      window.hitDamage = function (teamName) {
        const r = _hit.apply(this, arguments);
        try { flash(teamName); } catch (e) {}
        return r;
      };
    }
    if (typeof window.showGameOver === 'function') {
      const _sgo = window.showGameOver;
      window.showGameOver = function (winner) {
        const r = _sgo.apply(this, arguments);
        try {
          const b = battleState();
          if (mounted && b && b[winner] && teams[winner]) {
            const a = teams[winner][b[winner].activeIdx];
            if (a && !a.actor.classList.contains('is-ko')) a.actor.classList.add('victory');
          }
        } catch (e) {}
        return r;
      };
    }
  }

  installHooks();
  window.BOO2STAGE = { sync, mount };
})();
