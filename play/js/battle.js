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

  /* ─────────── battle boot (quick battle + campaign intro fights) ─────────── */
  function quickBattle() {
    const t = ensureTeam();
    if (t.length < 3) { showToast('Pick 3 spirits first'); return; }
    startVsTeam(getCuratedTeam(t), BOO2M.generateName());
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
    const { starDelta } = await BOO2M.postGameResult(result);
    const go = document.getElementById('gameOver');
    const rounds = document.getElementById('goRounds');
    if (go && rounds) {
      go.querySelectorAll('.go-star-award').forEach(c => c.remove()); // overlay persists across rematches
      const chip = document.createElement('div');
      chip.className = 'go-star-award';
      chip.innerHTML = `+${starDelta} ★ &nbsp;·&nbsp; ${BOO2M.snapshot().stars} ★ total`;
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

  window.BOO2B = { boot, renderStrip, quickBattle, startVsTeam, pickSpirit, closePicker, exitBattle };
})();
