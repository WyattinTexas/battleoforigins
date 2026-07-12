/* ============================================================
   BOO2 battle host — wraps the untouched engine snapshot.
   Boot contract (from beta): set S.redPicks/S.bluePicks (3 ids),
   startBattle(), startBlueAI(). Exit via engine resetBattle()
   (its #team-select / renderPicks references degrade to no-ops
   in /play/ by design). All engine patches happen HERE at runtime;
   engine files are never edited.
   ============================================================ */
(function () {
  let oppName = null;
  let picker = { slot: -1 };

  /* ─────────── team strip ─────────── */
  function ensureTeam() {
    let t = BOO2M.team();
    if (t.length < 3) {
      const owned = BOO2M.ownedIds();
      for (const id of owned) { if (t.length >= 3) break; if (!t.includes(id)) t.push(id); }
      BOO2M.setTeam(t);
    }
    return t;
  }

  function renderStrip() {
    const t = ensureTeam();
    const strip = document.getElementById('teamStrip');
    strip.innerHTML = [0, 1, 2].map(i => {
      const id = t[i];
      if (id == null) return `<div class="team-slot empty" data-slot="${i}"></div>`;
      const g = getGhost(id);
      return `<div class="team-slot" data-slot="${i}" data-id="${id}">
        <img src="${boo2Art(id)}" alt="${g.name}" draggable="false">
        ${i === 0 ? '<span class="slot-lead">LEAD</span>' : ''}
        <div class="slot-name">${g.name}</div>
      </div>`;
    }).join('');
    strip.querySelectorAll('.team-slot').forEach(bindSlot);
    document.getElementById('battleBtn').disabled = t.length < 3;
  }

  /* pointer-based drag to reorder (touch-friendly); a plain tap opens the picker */
  function bindSlot(el) {
    let startX = 0, startY = 0, dragging = false, pid = null;
    el.addEventListener('pointerdown', e => {
      pid = e.pointerId; startX = e.clientX; startY = e.clientY; dragging = false;
      try { el.setPointerCapture(pid); } catch (err) {}
    });
    el.addEventListener('pointermove', e => {
      if (pid === null) return;
      if (!dragging && Math.hypot(e.clientX - startX, e.clientY - startY) > 14) {
        dragging = true; el.classList.add('dragging');
      }
      if (dragging) {
        el.style.transform = `translate(${e.clientX - startX}px, ${e.clientY - startY}px) scale(1.07)`;
        hoverSlot(e, el);
      }
    });
    el.addEventListener('pointerup', e => {
      if (pid === null) return;
      try { el.releasePointerCapture(pid); } catch (err) {}
      pid = null;
      if (dragging) {
        const target = slotAt(e, el);
        el.classList.remove('dragging'); el.style.transform = '';
        clearHints();
        if (target) swapSlots(+el.dataset.slot, +target.dataset.slot);
      } else {
        openPicker(+el.dataset.slot);
      }
    });
    el.addEventListener('pointercancel', () => {
      pid = null; el.classList.remove('dragging'); el.style.transform = ''; clearHints();
    });
  }
  function slotAt(e, self) {
    const under = document.elementFromPoint(e.clientX, e.clientY);
    const slot = under && under.closest('.team-slot');
    return slot && slot !== self ? slot : null;
  }
  function hoverSlot(e, self) {
    clearHints();
    const t = slotAt(e, self);
    if (t) t.classList.add('drop-hint');
  }
  function clearHints() { document.querySelectorAll('.team-slot.drop-hint').forEach(s => s.classList.remove('drop-hint')); }
  function swapSlots(a, b) {
    const t = ensureTeam();
    [t[a], t[b]] = [t[b], t[a]];
    BOO2M.setTeam(t);
    renderStrip();
  }

  function openPicker(slot) {
    picker.slot = slot;
    const t = ensureTeam();
    const others = t.filter((_, i) => i !== slot);
    const owned = BOO2M.ownedIds().filter(id => !others.includes(id))
      .sort((a, b) => boo2Num(a) - boo2Num(b));
    document.getElementById('pickerGrid').innerHTML = owned.map(id => {
      const g = getGhost(id);
      return `<div class="card-tile" onclick="BOO2B.pickSpirit(${id})">
        <img src="${boo2Art(id)}" alt="${g.name}" loading="lazy">
        <div class="ct-name">${g.name}</div>
      </div>`;
    }).join('');
    document.getElementById('pickerSheet').classList.add('active');
  }
  function pickSpirit(id) {
    const t = ensureTeam();
    t[picker.slot] = id;
    BOO2M.setTeam(t);
    closePicker();
    renderStrip();
  }
  function closePicker() { document.getElementById('pickerSheet').classList.remove('active'); }

  /* ─────────── THE RIVALS — permanent personas, Nation-style ───────────
     Eight named regulars who live in boo2/players/ like anyone else:
     their ratings drift as real players beat them (or lose to them),
     they show up on the all-time board, and you learn their names.
     ⚠ rival_* player rows are PERMANENT — never delete them.
     Daily Champions stays human: rivals never post daily scores. */
  const RIVALS = [
    { key: 'rival_lantern',  name: 'Grim Little Lantern', base: 15,  lead: 9,   taunts: ['Boo. Scared yet?', 'I am small but I flicker with menace.'] },
    { key: 'rival_pip',      name: 'Pip the Unlucky',     base: 45,  lead: 12,  taunts: ['Today my luck turns. I can feel it.', 'The dice owe me. BIG.'] },
    { key: 'rival_bones',    name: 'Bones McGraw',        base: 90,  lead: 37,  taunts: ['Rattle rattle, little ghost.', 'I count my wins in knuckles.'] },
    { key: 'rival_cobweb',   name: 'Countess Cobweb',     base: 140, lead: 108, taunts: ['Your spirits look… delicious.', 'Do come into my parlor.'] },
    { key: 'rival_shriek',   name: 'Sister Shriek',       base: 200, lead: 53,  taunts: ['I have haunted far scarier teams than yours.', 'Sing with me. SCREAM with me.'] },
    { key: 'rival_marrow',   name: 'Old Man Marrow',      base: 270, lead: 110, taunts: ['My grandmother rolls better than you. She is a tombstone.', 'Back in my day, ghosts had MANNERS.'] },
    { key: 'rival_marmint',  name: 'Madame Marrowmint',   base: 350, lead: 114, taunts: ['The dice whisper my name. They scream yours.', 'Fresh ectoplasm. Finally.'] },
    { key: 'rival_yawning',  name: 'The Yawning King',    base: 460, lead: 432, taunts: ['I never lose. Well. Rarely. Sometimes.', '*yawns* Wake me if you survive round three.'] },
  ];
  let rival = null;

  /* create-if-missing, then return the LIVE row (rating drifts globally) */
  async function rivalRow(r) {
    try {
      const res = await BOO2M.txnPlayer(r.key, p => {
        if (p) return; // exists — abort, keep live values
        return { name: r.name, rating: r.base, wins: 0, losses: 0, bot: true };
      });
      const live = res && res.value;
      return (live && live.name) ? live : { name: r.name, rating: r.base, wins: 0, losses: 0 };
    } catch (e) {
      return { name: r.name, rating: r.base, wins: 0, losses: 0 };
    }
  }

  async function pickRival(myTeam) {
    const mine = BOO2M.snapshot().rating || 0;
    // fight someone near you — nearest three by base band, weighted random
    const sorted = [...RIVALS].sort((a, b) => Math.abs(a.base - mine) - Math.abs(b.base - mine));
    const pool = sorted.slice(0, 3);
    const r = pool[Math.floor(Math.random() * pool.length)];
    const live = await rivalRow(r);
    return {
      key: r.key,
      name: live.name || r.name,
      rating: live.rating || 0,
      wins: live.wins || 0,
      losses: live.losses || 0,
      lead: r.lead,
      team: getCuratedTeam(myTeam),
      taunt: r.taunts[Math.floor(Math.random() * r.taunts.length)],
    };
  }

  async function quickBattle() {
    const t = ensureTeam();
    if (t.length < 3) { showToast('Pick 3 spirits first'); return; }
    rival = await pickRival(t);
    const me = BOO2M.snapshot();
    document.getElementById('rivalBody').innerHTML = `
      <div class="vs-row">
        <div class="vs-side">
          <img src="${boo2Art(t[0])}" alt="">
          <div class="vs-name">${BOO2M.myName()}</div>
          <div class="vs-rtg">${me.rating} RTG · ${me.wins}W</div>
        </div>
        <div class="vs-mark creep">VS</div>
        <div class="vs-side">
          <img src="${boo2Art(rival.lead)}" alt="">
          <div class="vs-name">${rival.name}</div>
          <div class="vs-rtg">${rival.rating} RTG · ${rival.wins}W ${rival.losses}L</div>
        </div>
      </div>
      <div class="vs-taunt">“${rival.taunt}”</div>
      <div class="vs-stakes">WIN +15 RTG &nbsp;·&nbsp; LOSE −10 RTG</div>
      <button class="btn-ember" onclick="BOO2B.engageRival()">FIGHT</button>`;
    document.getElementById('rivalOverlay').classList.add('active');
  }

  function engageRival() {
    document.getElementById('rivalOverlay').classList.remove('active');
    if (!rival) return;
    startVsTeam(rival.team.slice(), rival.name);
  }
  function dismissRival() { document.getElementById('rivalOverlay').classList.remove('active'); rival = null; }

  /* the rival's row drifts too — beat them and they FEEL it */
  async function updateRivalAfter(result) {
    if (!rival || !rival.key) return;
    const won = result === 'win'; // player's result
    try {
      await BOO2M.txnPlayer(rival.key, p => {
        if (!p) return { name: rival.name, rating: rival.base || 0, wins: 0, losses: 0, bot: true };
        const next = Object.assign({}, p);
        next.rating = Math.max(0, (p.rating || 0) + (won ? -10 : 15));
        if (won) next.losses = (p.losses || 0) + 1; else next.wins = (p.wins || 0) + 1;
        next.lastSeen = Date.now();
        return next;
      });
    } catch (e) {}
  }

  function startVsTeam(blueIds, name) {
    const t = ensureTeam();
    if (t.length < 3) { showToast('Pick 3 spirits first'); return; }
    oppName = name || BOO2M.generateName();
    BOO2S.ensureArenaFresh(); // cleanupRaidBattle/resetBattle leave inline hides + a gutted #gameOver
    S.redPicks = t.slice();
    S.bluePicks = blueIds.slice();
    document.body.classList.add('in-battle');
    // roster titles: the arena's team labels become YOU vs the rival
    const rt = document.querySelector('.roster-title.red');
    const bt = document.querySelector('.roster-title.blue');
    if (rt) rt.textContent = 'YOU';
    if (bt) bt.textContent = oppName.toUpperCase();
    armExitButton();
    startBattle();
    // Same config the engine ships everywhere it plays vs AI (raid bridge,
    // live PvP): Duel Phase off. With it on, an AI-side modal primer (e.g.
    // Romy 114) locks the Done button and doTeamRoll's !B.preRoll guard
    // returns before the unlock — permanent stall. Engine bug to fix in
    // beta before this flag can flip.
    B.duelPhaseMode = false;
    startBlueAI();
    // you only ever roll for yourself — the rival rolls their own dice
    const bb = document.getElementById('rollBlueBtn');
    if (bb) bb.style.display = 'none';
  }

  /* Leave button: two-tap arm instead of a blocking confirm() dialog */
  function armExitButton() {
    const btn = document.getElementById('leaveRaidBtn');
    if (!btn) return;
    btn.textContent = 'EXIT';
    btn.dataset.armed = '';
    btn.onclick = () => {
      if (btn.dataset.armed === '1') { exitBattle(); return; }
      btn.dataset.armed = '1';
      btn.textContent = 'EXIT?';
      setTimeout(() => { btn.dataset.armed = ''; btn.textContent = 'EXIT'; }, 2200);
    };
  }

  function exitBattle() {
    try { stopBlueAI(); } catch (e) {}
    try { resetBattle(); } catch (e) {}
    document.body.classList.remove('in-battle');
    BOO2S.showScreen('play');
    BOO2S.refreshChrome();
  }

  /* ─────────── engine hooks (installed once, after engine load) ─────────── */
  function installHooks() {
    // 1. Rematch must re-arm the AI (engine's AI self-stops at game over).
    const _rematch = window.rematchBattle;
    window.rematchBattle = function () {
      _rematch();
      if (!(typeof LIVE_PVP !== 'undefined' && LIVE_PVP)) {
        if (typeof B !== 'undefined' && B) B.duelPhaseMode = false; // see quickBattle note
        startBlueAI();
      }
    };
    // 2. Game over: campaign fights go to BOO2R; plain quick battles get
    //    ★ + retitle + button rewire here. Installed AFTER the raid bridge's
    //    own wrapper, so this runs last and owns the final overlay state.
    const _sgo = window.showGameOver;
    window.showGameOver = function (winner) {
      _sgo(winner);
      if (!B || B._boo2Awarded) return;
      if (window.BOO2R && BOO2R.isActive()) {
        B._boo2Awarded = true;
        BOO2R.onGameOver(winner);
        return;
      }
      if (typeof LIVE_PVP !== 'undefined' && LIVE_PVP) { // engine `let`, NOT window.*
        B._boo2Awarded = true;
        onLivePvPOver(winner);
        return;
      }
      if (window.RAID_MODE || window.MP_MODE) return;
      B._boo2Awarded = true;
      onQuickBattleOver(winner);
    };
  }

  async function onQuickBattleOver(winner) {
    const result = winner === 'red' ? 'win' : (winner === 'blue' ? 'loss' : 'draw');
    const title = document.getElementById('goTitle');
    if (title) {
      title.textContent = result === 'win' ? 'YOU WIN!' : (result === 'loss' ? `${oppName || 'THE RIVAL'} WINS` : 'DRAW!');
    }
    const { starDelta, ratingDelta } = await BOO2M.postGameResult(result);
    updateRivalAfter(result); // persona's rating/record drifts globally
    const go = document.getElementById('gameOver');
    const rounds = document.getElementById('goRounds');
    if (go && rounds) {
      go.querySelectorAll('.go-star-award').forEach(c => c.remove()); // overlay persists across rematches
      const chip = document.createElement('div');
      chip.className = 'go-star-award';
      const rtg = ratingDelta === 0 ? '' : ` &nbsp;·&nbsp; ${ratingDelta > 0 ? '+' : ''}${ratingDelta} RTG`;
      chip.innerHTML = `+${starDelta} ★${rtg} &nbsp;·&nbsp; now ${BOO2M.snapshot().rating} RTG`;
      rounds.insertAdjacentElement('afterend', chip);
    }
    // New Game returns to /play/'s team screen, not the engine's picker
    const goButtons = go && go.querySelector('.go-buttons');
    const newGameBtn = goButtons && goButtons.querySelector('.go-btn-newgame');
    if (newGameBtn) {
      newGameBtn.textContent = 'Back to Menu';
      newGameBtn.onclick = () => exitBattle();
    }
  }

  /* live friend battles: engine handles the whole match; we award ★ and
     replace the engine's '../multiplayer/' return button with a clean exit */
  async function onLivePvPOver(winner) {
    const side = (typeof PVP_SIDE !== 'undefined' && PVP_SIDE) || window.PVP_SIDE;
    const result = winner === side ? 'win' : (winner === 'draw' ? 'draw' : 'loss');
    const { starDelta } = await BOO2M.postGameResult(result);
    const go = document.getElementById('gameOver');
    const rounds = document.getElementById('goRounds');
    if (go && rounds) {
      go.querySelectorAll('.go-star-award').forEach(c => c.remove());
      const chip = document.createElement('div');
      chip.className = 'go-star-award';
      chip.innerHTML = `+${starDelta} ★ &nbsp;·&nbsp; ${BOO2M.snapshot().stars} ★ total`;
      rounds.insertAdjacentElement('afterend', chip);
    }
    const goButtons = go && go.querySelector('.go-buttons');
    if (goButtons) {
      goButtons.innerHTML = `<button class="go-btn-rematch" onclick="location.href=location.pathname">BACK TO MENU</button>`;
    }
  }

  function boot() {
    installHooks();
    renderStrip();
  }

  window.BOO2B = { boot, renderStrip, quickBattle, engageRival, dismissRival, startVsTeam, pickSpirit, closePicker, exitBattle };
})();
