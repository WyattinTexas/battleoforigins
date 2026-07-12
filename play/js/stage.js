/* ============================================================
   BOO2 STAGE — "characters on screen."
   A play-side presentation layer that puts the two ACTIVE
   spirits on a box-art stage behind the engine's card arena,
   which css/stage.css compresses into a bottom strip.

   Engine files untouched (enginefix.js precedent): we wrap the
   engine's global functions on window —
     startBattle   → mount the stage (covers quick battle, raid
                     intro, boss fights AND rematch, which calls
                     startBattle internally)
     renderBattle  → sync sprites/plates after every re-render
                     (catches KO swaps, forced swaps, heals, all
                     ability paths — anything that redraws cards)
     hitDamage     → hit flash + jitter on the struck side
     showGameOver  → victory pose for the winner
   State reads use the engine's top-level `let B` (visible to all
   classic scripts; NOT window.B) with typeof guards, and LIVE_PVP
   the same way — live friend battles keep the classic full-screen
   arena for v1, so the stage never mounts there.

   ⚠ The engine patches document.getElementById to return a hidden
   _battle_dummy div for ANY missing id — an existence check via
   getElementById is always truthy, and writes land on the dummy.
   This file therefore keeps direct element references and never
   looks anything up by id.

   Sprites: sprites/{id}-front.webp (opponent, facing you) and
   sprites/{id}-back.webp (yours, seen from behind), listed in
   sprites/manifest.json {ids:[...]}. Any id not in the manifest
   falls back to a framed card-art token, so the stage works for
   all 200 spirits before the Phase-B batch exists. Raid bosses
   (id 9201+) map to their baseId player card for art.
   ============================================================ */
(function () {
  let manifest = new Set();
  let mounted = false;
  let stage = null;
  const refs = { red: null, blue: null };
  const swapTimers = { red: 0, blue: 0 };

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
  function ensureDom() {
    if (stage && document.body.contains(stage)) return;
    stage = document.createElement('div');
    stage.id = 'boo2-stage';
    stage.setAttribute('aria-hidden', 'true');
    stage.innerHTML = `
      <div class="stage-sky"></div>
      <div class="stage-aurora"></div>
      <div class="stage-stars"></div>
      <div class="stage-ridge"></div>
      <div class="stage-floor"></div>
      <div class="stage-wisps"><i></i><i></i><i></i><i></i></div>
      <div class="stage-actor opp">
        <div class="actor-entry"><div class="actor-bob">
          <div class="actor-shadow"></div>
          <img class="actor-img" alt="" draggable="false">
          <div class="actor-flash"></div>
        </div></div>
      </div>
      <div class="stage-actor me">
        <div class="actor-entry"><div class="actor-bob">
          <div class="actor-shadow"></div>
          <img class="actor-img" alt="" draggable="false">
          <div class="actor-flash"></div>
        </div></div>
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
      </div>`;
    document.body.appendChild(stage);
    [['red', '.stage-actor.me', '.stage-plate.red'], ['blue', '.stage-actor.opp', '.stage-plate.blue']].forEach(([side, aSel, pSel]) => {
      const actor = stage.querySelector(aSel);
      const plate = stage.querySelector(pSel);
      refs[side] = {
        actor,
        entry: actor.querySelector('.actor-entry'),
        bob: actor.querySelector('.actor-bob'),
        img: actor.querySelector('.actor-img'),
        key: '',
        plate,
        name: plate.querySelector('.plate-name'),
        bar: plate.querySelector('.plate-bar i'),
        hp: plate.querySelector('.plate-hp'),
        chip: plate.querySelector('.plate-chip'),
      };
    });
  }

  function resetActors() {
    ['red', 'blue'].forEach(side => {
      const r = refs[side];
      if (!r) return;
      r.key = '';
      r.actor.classList.remove('is-ko', 'victory', 'leaving');
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
    sync();
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

  /* ─────────── sync: sprites + plates ← engine state ─────────── */
  function sync() {
    if (!mounted || !refs.red || !document.body.classList.contains('boo2-stage')) return;
    const b = battleState();
    if (!b) return;
    ['red', 'blue'].forEach(side => {
      const t = b[side];
      const g = t.ghosts[t.activeIdx];
      if (!g) return;
      updateActor(side, g);
      updatePlate(side, g);
    });
  }

  function updateActor(side, g) {
    const r = refs[side];
    const id = spriteIdOf(g);
    const hasSprite = manifest.has(id);
    const src = hasSprite ? (side === 'red' ? BACK(id) : FRONT(id)) : tokenArt(id);
    if (r.key !== src) {
      const fresh = !r.key;
      r.key = src;
      r.actor.classList.toggle('token-mode', !hasSprite);
      r.actor.classList.remove('is-ko', 'victory');
      clearTimeout(swapTimers[side]);
      if (fresh) {
        r.img.src = src;
        replay(r.entry, 'entering');
      } else {
        r.actor.classList.add('leaving');
        swapTimers[side] = setTimeout(() => {
          r.actor.classList.remove('leaving');
          r.img.src = src;
          replay(r.entry, 'entering');
        }, 230);
      }
    }
    r.actor.classList.toggle('is-ko', !!g.ko);
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
    const r = refs[side];
    if (!r || !mounted) return;
    replay(r.bob, 'hit');
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
          if (mounted && refs[winner]) {
            const a = refs[winner].actor;
            if (!a.classList.contains('is-ko')) a.classList.add('victory');
          }
        } catch (e) {}
        return r;
      };
    }
  }

  installHooks();
  window.BOO2STAGE = { sync, mount };
})();
