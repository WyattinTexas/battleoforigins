/* ============================================================
   BOO2 raids — the campaign. March through the five realms:
   Set 1 intro fights → 4 boss regions (13 beta raid bosses by
   tier) → Valkin finale. Solo fights on the untouched engine:

   Boss boot recipe (see engine/SNAPSHOT.md + boo-v2-shell-plan):
     _currentRaidRole = 'fighter'   // arms blue AI in the bridge
     currentRaid stays null         // every raid Firebase write
                                    // is guarded on it → inert solo
     initRaidBattleInPage(fakeRaidData, enemies, teamIds, false)
   Enemies padded to 3 by repeating the boss (beta's own pattern),
   then the copies are KO'd + isPadded like checkRaidParams does.
   ============================================================ */
(function () {
  const REGIONS = [
    {
      key: 'Set 1', name: 'THE FIRST STEPS', color: '#d4a040',
      nodes: [
        // Gentle ramp, NO sustain abilities (Villager/Jeffery heals turn a
        // tutorial fight into a stalemate vs a starter team — found in test)
        { id: 's1-1', type: 'intro', name: 'Meadow Wisps', team: [9, 8, 12], line: 'Three gentle spirits drift out to test you.', stars: 15 },
        { id: 's1-2', type: 'intro', name: 'Shrine Guards', team: [10, 16, 5], line: 'The shrine does not open for strangers.', stars: 15 },
        { id: 's1-3', type: 'intro', name: 'The Menace', team: [34, 37, 39], line: 'Something growls beyond the treeline…', stars: 15, packs: 1 },
      ],
    },
    {
      key: 'Rolling Hills', name: 'ROLLING HILLS', color: '#86efac',
      nodes: [
        { id: 'rh-1', type: 'boss', key: 'raid_dark_fang', stars: 25, packs: 1 },
        { id: 'rh-2', type: 'boss', key: 'raid_jasper', stars: 25, packs: 1 },
        { id: 'rh-3', type: 'boss', key: 'raid_timber', stars: 25, packs: 1 },
      ],
    },
    {
      key: 'Frost Valley', name: 'FROST VALLEY', color: '#7dd3fc',
      nodes: [
        { id: 'fv-1', type: 'boss', key: 'raid_king_jay', stars: 25, packs: 1 },
        { id: 'fv-2', type: 'boss', key: 'raid_romy', stars: 25, packs: 1 },
        { id: 'fv-3', type: 'boss', key: 'raid_mountain_king', stars: 25, packs: 1 },
      ],
    },
    {
      key: 'Volcanic Isles', name: 'VOLCANIC ISLES', color: '#fb923c',
      nodes: [
        { id: 'vi-1', type: 'boss', key: 'raid_pip', stars: 25, packs: 1 },
        { id: 'vi-2', type: 'boss', key: 'raid_humar', stars: 25, packs: 1 },
        { id: 'vi-3', type: 'boss', key: 'raid_nerina', stars: 25, packs: 1 },
      ],
    },
    {
      key: 'Dark Castle', name: 'DARK CASTLE', color: '#c084fc',
      nodes: [
        { id: 'dc-1', type: 'boss', key: 'raid_lucy', stars: 25, packs: 1 },
        { id: 'dc-2', type: 'boss', key: 'raid_shade', stars: 25, packs: 1 },
        { id: 'dc-3', type: 'boss', key: 'raid_bigsby', stars: 25, packs: 1 },
      ],
    },
    {
      key: 'Dark Spire', name: 'THE DARK SPIRE', color: '#f0c060',
      nodes: [
        { id: 'ds-1', type: 'boss', key: 'raid_valkin', stars: 100, packs: 3, finale: true },
      ],
    },
  ];
  const ALL_NODES = REGIONS.flatMap(r => r.nodes);
  const REPEAT_WIN_STARS = 10, LOSS_STARS = 2;

  let activeNode = null;   // node object while one of its fights is live
  let pendingSheetNode = null;

  /* ── progress ── */
  function progress() { try { return JSON.parse(localStorage.getItem('boo2Raids') || '{}'); } catch (e) { return {}; } }
  function saveProgress(p) { localStorage.setItem('boo2Raids', JSON.stringify(p)); }
  function isCleared(id) { return !!(progress().cleared || {})[id]; }
  function markCleared(id) { const p = progress(); p.cleared = p.cleared || {}; p.cleared[id] = Date.now(); saveProgress(p); }
  function clearedCount() { return ALL_NODES.filter(n => isCleared(n.id)).length; }
  function currentNodeId() { const n = ALL_NODES.find(n => !isCleared(n.id)); return n ? n.id : null; }
  function isUnlocked(id) {
    const idx = ALL_NODES.findIndex(n => n.id === id);
    return idx === 0 || isCleared(id) || ALL_NODES.slice(0, idx).every(n => isCleared(n.id));
  }

  function bossCfg(node) { return (typeof RAID_BOSSES !== 'undefined') ? RAID_BOSSES[node.key] : null; }
  function nodeArtId(node) {
    if (node.type === 'intro') return node.team[0];
    const cfg = bossCfg(node);
    return cfg && cfg.bossGhost.baseId ? cfg.bossGhost.baseId : 1;
  }
  function nodeTitle(node) {
    if (node.type === 'intro') return node.name;
    const cfg = bossCfg(node);
    return cfg ? cfg.name : node.key;
  }
  function nodeSub(node) {
    if (node.type === 'intro') return 'SKIRMISH';
    const cfg = bossCfg(node);
    return cfg ? (cfg.title || 'RAID BOSS').toUpperCase() : 'RAID BOSS';
  }

  /* ── map ── */
  function renderMap() {
    const cur = currentNodeId();
    const wrap = document.getElementById('raidMap');
    wrap.innerHTML = REGIONS.map(region => {
      const nodes = region.nodes.map(n => {
        const cleared = isCleared(n.id);
        const unlocked = isUnlocked(n.id);
        const state = cleared ? 'cleared' : (unlocked ? (n.id === cur ? 'current' : 'open') : 'locked');
        return `<button class="raid-node ${state}${n.finale ? ' finale' : ''}" ${unlocked ? `onclick="BOO2R.openNode('${n.id}')"` : ''}>
          <span class="rn-medal"><img src="${boo2Art(nodeArtId(n))}" alt="" loading="lazy"></span>
          <span class="rn-name">${nodeTitle(n)}</span>
          <span class="rn-sub">${cleared ? '✓ CLEARED' : (unlocked ? nodeSub(n) : '🔒')}</span>
        </button>`;
      }).join('<span class="raid-path"></span>');
      return `<section class="raid-region" style="--rg:${region.color}">
        <h3 class="rr-title">${region.name}</h3>
        <div class="rr-nodes">${nodes}</div>
      </section>`;
    }).join('');
    document.getElementById('raidProgress').innerHTML = `<b>${clearedCount()}</b> / ${ALL_NODES.length} cleared`;
  }

  /* ── node intro sheet ── */
  function openNode(id) {
    const node = ALL_NODES.find(n => n.id === id);
    if (!node || !isUnlocked(id)) return;
    pendingSheetNode = node;
    const cleared = isCleared(id);
    const cfg = node.type === 'boss' ? bossCfg(node) : null;
    const line = node.type === 'boss'
      ? ((cfg && cfg.dialogue && cfg.dialogue.intro) || 'The air goes cold…')
      : node.line;
    const rewardLine = cleared
      ? `REMATCH — ★${REPEAT_WIN_STARS} per win`
      : `FIRST CLEAR — ★${node.stars}${node.packs ? ` + ${node.packs} PACK${node.packs > 1 ? 'S' : ''}` : ''}`;
    document.getElementById('raidSheetBody').innerHTML = `
      <img class="rs-art" src="${boo2Art(nodeArtId(node))}" alt="">
      <div class="rs-name creep">${nodeTitle(node)}</div>
      <div class="rs-sub">${nodeSub(node)}${cfg ? ` · ${cfg.bossGhost.maxHp} HP` : ''}</div>
      <div class="rs-line">“${line}”</div>
      <div class="rs-reward">${rewardLine}</div>
      <button class="btn-ember" onclick="BOO2R.fightNode()">FIGHT</button>`;
    document.getElementById('raidSheet').classList.add('active');
  }
  function closeSheet() { document.getElementById('raidSheet').classList.remove('active'); pendingSheetNode = null; }

  /* ── fight launchers ── */
  function fightNode() {
    const node = pendingSheetNode;
    if (!node) return;
    closeSheet();
    const team = BOO2M.team();
    if (team.length < 3) { showToast('Pick 3 spirits on the PLAY screen first'); BOO2S.showScreen('play'); return; }
    activeNode = node;
    if (node.type === 'intro') {
      BOO2B.startVsTeam(node.team.slice(), nodeTitle(node));
      armRaidExitButton(); // retreat must clear activeNode, not fall through to quick-battle exit
      return;
    }
    launchBossFight(node, team);
  }

  function launchBossFight(node, team) {
    const cfg = bossCfg(node);
    if (!cfg || typeof initRaidBattleInPage !== 'function' || typeof buildBossTeam !== 'function') {
      activeNode = null;
      showToast('The raid gates are jammed — refresh and try again');
      return;
    }
    const bt = buildBossTeam(cfg, 1, 0); // phase 1, no enrage (solo)
    const enemies = [bt.boss, ...bt.minions];
    const realCount = enemies.length;
    while (enemies.length < 3) enemies.push(bt.boss); // beta's pad pattern
    const fakeRaidData = {
      raidId: node.key, instanceId: 'solo',
      bossCurrentHp: cfg.bossGhost.maxHp, bossMaxHp: cfg.bossGhost.maxHp,
      enrageLevel: 0, currentFighterIdx: 0, players: {},
    };
    BOO2S.ensureArenaFresh(); // prior cleanupRaidBattle gutted #gameOver + hid the arena
    document.body.classList.add('in-battle');
    _currentRaidRole = 'fighter';           // raid-engine global — arms blue AI
    if (typeof currentRaid !== 'undefined') currentRaid = null; // keep ALL raid Firebase paths inert
    initRaidBattleInPage(fakeRaidData, enemies, team.slice(), false);
    // KO the padded copies exactly like beta's checkRaidParams does
    if (B && B.blue && realCount < 3) {
      for (let i = realCount; i < B.blue.ghosts.length; i++) {
        B.blue.ghosts[i].hp = 0;
        B.blue.ghosts[i].ko = true;
        B.blue.ghosts[i].isPadded = true;
      }
      renderBattle();
    }
    // solo fights: hide the multiplayer boss-pool bar; the boss's own HP bar is the fight
    const pool = document.getElementById('raid-boss-pool');
    if (pool) pool.style.display = 'none';
    // arena chrome
    const rt = document.querySelector('.roster-title.red');
    const bt2 = document.querySelector('.roster-title.blue');
    if (rt) rt.textContent = 'YOU';
    if (bt2) bt2.textContent = (cfg.name || 'BOSS').toUpperCase();
    armRaidExitButton();
  }

  function armRaidExitButton() {
    const btn = document.getElementById('leaveRaidBtn');
    if (!btn) return;
    btn.textContent = 'RETREAT';
    btn.dataset.armed = '';
    btn.onclick = () => {
      if (btn.dataset.armed === '1') { exitToMap(); return; }
      btn.dataset.armed = '1';
      btn.textContent = 'RETREAT?';
      setTimeout(() => { btn.dataset.armed = ''; btn.textContent = 'RETREAT'; }, 2200);
    };
  }

  /* ── game over (called by battle.js's showGameOver wrapper) ── */
  function isActive() { return !!activeNode; }

  async function onGameOver(winner) {
    const node = activeNode;
    if (!node) return;
    const won = winner === 'red';
    const cfg = node.type === 'boss' ? bossCfg(node) : null;
    const firstClear = won && !isCleared(node.id);

    // rewards
    let starGain = 0, packGain = 0;
    if (won) {
      if (firstClear) { starGain = node.stars; packGain = node.packs || 0; markCleared(node.id); }
      else starGain = REPEAT_WIN_STARS;
    } else starGain = LOSS_STARS;
    await BOO2M.addStars(starGain);
    if (packGain) BOO2M.addPacks(packGain);

    // rewrite the game-over overlay for the campaign
    const title = document.getElementById('goTitle');
    if (title) title.textContent = won ? 'VICTORY!' : 'DEFEATED…';
    const line = cfg && cfg.dialogue ? (won ? cfg.dialogue.defeat : cfg.dialogue.victory) : null;
    const rounds = document.getElementById('goRounds');
    if (rounds) {
      document.querySelectorAll('.go-star-award, .go-boss-line').forEach(el => el.remove());
      if (line) rounds.insertAdjacentHTML('afterend', `<div class="go-boss-line" style="text-align:center;font-style:italic;color:#9aa0b4;margin:8px 14px;">“${line}”</div>`);
      const rewardHtml = won && firstClear
        ? `+${starGain} ★${packGain ? ` &nbsp;·&nbsp; +${packGain} PACK${packGain > 1 ? 'S' : ''} 🎁` : ''}`
        : `+${starGain} ★`;
      rounds.insertAdjacentHTML('afterend', `<div class="go-star-award">${rewardHtml}</div>`);
    }
    const goButtons = document.querySelector('#gameOver .go-buttons');
    if (goButtons) {
      goButtons.innerHTML = won
        ? `<button class="go-btn-rematch" onclick="BOO2R.claimAndExit(${packGain})">${packGain ? 'CLAIM & OPEN PACK' : 'CONTINUE'}</button>`
        : `<button class="go-btn-rematch" onclick="BOO2R.retryNode()">TRY AGAIN</button>
           <button class="go-btn-newgame" onclick="BOO2R.exitToMap()">RETREAT</button>`;
    }
  }

  function cleanupFight() {
    const node = activeNode;
    activeNode = null;
    if (node && node.type === 'boss') {
      try { if (typeof cleanupRaidBattle === 'function') cleanupRaidBattle(); } catch (e) {}
      window.BOSS_MODE = false;
      window.IS_WAVE_FIGHT = false;
    }
    try { stopBlueAI(); } catch (e) {}
    try { resetBattle(); } catch (e) {}
    if (typeof RAID_MODE !== 'undefined') RAID_MODE = false;
    if (typeof MP_MODE !== 'undefined') MP_MODE = false;
    window.RAID_MODE = false;
  }

  function exitToMap() {
    cleanupFight();
    document.body.classList.remove('in-battle');
    BOO2S.showScreen('raids');
    BOO2S.refreshChrome();
  }

  function claimAndExit(packs) {
    exitToMap();
    if (packs > 0 && BOO2M.takePack()) {
      BOO2C.openCeremony(BOO2M.rollPack(), 'BOSS PACK', () => {
        BOO2S.showScreen('raids');
        renderMap();
      });
    }
  }

  function retryNode() {
    const node = activeNode;
    cleanupFight();
    if (node) { pendingSheetNode = node; fightNode(); }
  }

  window.BOO2R = { renderMap, openNode, closeSheet, fightNode, isActive, onGameOver, exitToMap, claimAndExit, retryNode, clearedCount, total: ALL_NODES.length };
})();
