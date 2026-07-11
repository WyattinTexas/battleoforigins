/* ============================================================
   BOO2 shell — screen router, boot, arena injection, profile
   chrome, welcome flow. Menu is the hub (five doors), Favor-style.
   ============================================================ */
(function () {
  let arenaReady = false;

  /* real toast (engine's bare showToast() calls land here too) */
  window.showToast = function (msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = String(msg || '');
    t.classList.add('show');
    clearTimeout(t._h);
    t._h = setTimeout(() => t.classList.remove('show'), 2400);
  };

  function showScreen(id) {
    document.querySelectorAll('#shell .screen').forEach(s => s.classList.remove('active'));
    const el = document.getElementById('screen-' + id);
    if (el) el.classList.add('active');
    if (id === 'collection') BOO2C.render();
    if (id === 'play') BOO2B.renderStrip();
    if (id === 'raids' && window.BOO2R) BOO2R.renderMap();
    if (id === 'standings' && window.BOO2ST) BOO2ST.render();
    if (id === 'menu') renderMenu();
  }

  function findByName(name) {
    return getActiveGhosts().find(g => g.name === name) || getActiveGhosts()[0];
  }

  function renderMenu() {
    refreshChrome();
    // hero fan: your team once you have one, iconic trio before that
    const t = BOO2M.team();
    const fanIds = (t.length === 3) ? t : [findByName('The Mountain King').id, findByName('Kodako').id, findByName('Powder').id];
    const fan = document.getElementById('menuFan');
    fan.innerHTML = `
      <img class="fan-card f1" src="${boo2Art(fanIds[1])}" alt="">
      <img class="fan-card f2" src="${boo2Art(fanIds[0])}" alt="">
      <img class="fan-card f3" src="${boo2Art(fanIds[2])}" alt="">`;
    // door art
    setDoorArt('doorArtPlay', t[0] != null ? t[0] : findByName('Kodako').id);
    setDoorArt('doorArtRaids', findByName('Valkin the Grand').id);
    setDoorArt('doorArtStandings', findByName('The Mountain King').id);
    setDoorArt('doorArtCollection', findByName('Puff').id);
    setDoorArt('doorArtStandingsPoster', findByName('The Mountain King').id);
    const owned = BOO2M.ownedIds().length;
    document.getElementById('doorCollCount').textContent = `${owned} / ${getActiveGhosts().length} spirits`;
    if (window.BOO2R) {
      const badge = document.getElementById('doorRaidsBadge');
      if (badge) badge.textContent = `${BOO2R.clearedCount()}/${BOO2R.total}`;
    }
  }
  function setDoorArt(elId, spiritId) {
    const el = document.getElementById(elId);
    if (el) el.src = boo2Art(spiritId);
  }

  function refreshChrome() {
    const s = BOO2M.snapshot();
    document.querySelectorAll('.pc-name-text').forEach(el => el.textContent = BOO2M.myName());
    document.querySelectorAll('.pc-record').forEach(el => el.textContent = `${s.wins}W · ${s.losses}L · ${s.rating} RTG`);
    document.querySelectorAll('.star-chip b').forEach(el => el.textContent = s.stars);
  }

  /* rename sheet (no prompt() — blocking dialogs are banned here) */
  function openRename() {
    document.getElementById('renameInput').value = BOO2M.myName();
    document.getElementById('renameSheet').classList.add('active');
  }
  function saveRename() {
    const v = document.getElementById('renameInput').value;
    if (BOO2M.rename(v)) {
      document.getElementById('renameSheet').classList.remove('active');
      refreshChrome();
      showToast('The spirits know your name.');
    } else {
      showToast('Name must be at least 3 letters');
    }
  }
  function closeRename() { document.getElementById('renameSheet').classList.remove('active'); }

  /* arena fragment: engine DOM + audio, injected at boot so
     resync-beta.sh updates flow without touching index.html.
     The raw HTML is cached: cleanupRaidBattle() guts #gameOver and
     leaves inline display:none on #raid-screen/#battle-view, so every
     battle boot calls ensureArenaFresh() to restore a pristine arena. */
  let _arenaHtml = window._BOO2_ARENA_HTML || null;
  async function injectArena() {
    if (_arenaHtml) { // already injected synchronously pre-engine (livepvp boot needs it)
      arenaReady = true;
      document.getElementById('battleBtn').classList.remove('loading');
      return;
    }
    try {
      const res = await fetch('engine/raid-arena-template.html?v=' + (window.BOO2_VERSION || 'dev'));
      _arenaHtml = await res.text();
      document.getElementById('raid-screen').innerHTML = _arenaHtml;
      arenaReady = true;
      document.getElementById('battleBtn').classList.remove('loading');
    } catch (e) {
      console.error('[BOO2] arena inject failed', e);
      showToast('Could not load the arena — check connection & refresh');
    }
  }
  function ensureArenaFresh() {
    const rs = document.getElementById('raid-screen');
    if (!rs) return;
    // gutted overlay or first boot → full re-inject from cache
    const go = rs.querySelector('#gameOver');
    if (_arenaHtml && (!go || !go.querySelector('#goTitle'))) rs.innerHTML = _arenaHtml;
    rs.style.display = '';
    const bv = rs.querySelector('#battle-view');
    if (bv) bv.style.display = 'block';
    const goEl = rs.querySelector('#gameOver');
    if (goEl) { goEl.style.display = ''; goEl.classList.remove('active'); }
  }

  function tryBattle() {
    if (!arenaReady) { showToast('Summoning the arena… one sec'); return; }
    BOO2B.quickBattle();
  }

  /* first launch: name reveal → welcome pack ceremony → menu */
  function runWelcome() {
    document.getElementById('welcomeName').textContent = BOO2M.myName();
    document.getElementById('welcomeOverlay').classList.add('active');
  }
  function acceptWelcome() {
    document.getElementById('welcomeOverlay').classList.remove('active');
    BOO2C.openCeremony(BOO2M.rollWelcomePack(), 'WELCOME PACK', () => {
      localStorage.setItem('boo2Welcome', '1');
      BOO2B.renderStrip();
      renderMenu();
      BOO2ST.checkChallengeParam(); // friend arrived via a challenge link → straight to the duel
      showToast('Your first three spirits await — GO PLAY!');
    });
  }

  async function boot() {
    BOO2B.boot(); // install engine hooks FIRST — a livepvp match is already running
    injectArena();
    const isLive = (typeof LIVE_PVP !== 'undefined' && LIVE_PVP); // engine `let`, NOT window.*
    if (isLive) {
      // engine's ?livepvp= IIFE booted the match at script parse; just show it
      document.body.classList.add('in-battle');
      await BOO2M.boot();
      return;
    }
    await BOO2M.boot();
    showScreen('menu');
    if (!localStorage.getItem('boo2Welcome')) {
      runWelcome(); // challenge param (if any) is re-checked after the ceremony
    } else {
      await BOO2ST.checkChallengeParam();
      BOO2ST.drainChampMsgs();
    }
  }

  window.BOO2S = { showScreen, refreshChrome, openRename, saveRename, closeRename, tryBattle, acceptWelcome, ensureArenaFresh };
  document.addEventListener('DOMContentLoaded', boot);
})();
