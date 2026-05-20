// =================================================================
// RAID BATTLE BRIDGE
// Connects the raid turn system to battle-engine.js
// Replaces raid-battle-inline.js (960 lines) and raid-battle-ui.js (2037 lines)
// with ~250 lines of glue code
// =================================================================

// Tracked state for cleanup
var _registeredRaidGhostIds = [];
var _originalGhostData = {};
// _currentRaidRole is declared in raid-engine.js: 'fighter' | 'spectator' | null

/**
 * Update the spectator's arena from a Firebase battleState snapshot.
 * Called when the battleState listener fires on Player 2's client.
 * Updates the local B state and re-renders so Player 2 sees live dice/HP changes.
 */
function updateSpectatorFromSnapshot(snapshot) {
  // Only update if we are spectating and B exists with valid teams
  if (_currentRaidRole !== 'spectator' || _raidRoleTransitioning || !B || !B.red || !B.blue) return;
  if (!snapshot) return;

  // ── Sync ALL ghost HP, KO status, and activeIdx ──────────────
  // This is the key fix: update every ghost in the team, not just
  // the active one. Handles KO swaps, sideline damage, etc.
  if (snapshot.allPlayerGhosts && B.red) {
    snapshot.allPlayerGhosts.forEach((sg, i) => {
      if (B.red.ghosts[i]) {
        B.red.ghosts[i].hp = sg.hp;
        B.red.ghosts[i].maxHp = sg.maxHp;
        B.red.ghosts[i].ko = !!sg.ko;
        // Sync full identity so spectator sees transforms + correct ability text
        if (sg.id) B.red.ghosts[i].id = sg.id;
        if (sg.name) B.red.ghosts[i].name = sg.name;
        if (sg.art) B.red.ghosts[i].art = sg.art;
        if (sg.ability) B.red.ghosts[i].ability = sg.ability;
        if (sg.abilityDesc) B.red.ghosts[i].abilityDesc = sg.abilityDesc;
        if (sg.rarity) B.red.ghosts[i].rarity = sg.rarity;
      }
    });
    // Sync activeIdx — this is what tracks ghost swaps
    if (snapshot.playerActiveIdx != null) {
      B.red.activeIdx = snapshot.playerActiveIdx;
    }
  } else if (snapshot.playerGhost && B.red) {
    // Fallback for old snapshots without allPlayerGhosts
    const rf = active(B.red);
    if (rf) {
      rf.hp = snapshot.playerGhost.hp;
      rf.maxHp = snapshot.playerGhost.maxHp;
      if (snapshot.playerGhost.ko) rf.ko = true;
    }
  }

  if (snapshot.allBossGhosts && B.blue) {
    snapshot.allBossGhosts.forEach((sg, i) => {
      if (B.blue.ghosts[i]) {
        B.blue.ghosts[i].hp = sg.hp;
        B.blue.ghosts[i].maxHp = sg.maxHp;
        B.blue.ghosts[i].ko = !!sg.ko;
        if (sg.id) B.blue.ghosts[i].id = sg.id;
        if (sg.name) B.blue.ghosts[i].name = sg.name;
        if (sg.art) B.blue.ghosts[i].art = sg.art;
        if (sg.ability) B.blue.ghosts[i].ability = sg.ability;
        if (sg.abilityDesc) B.blue.ghosts[i].abilityDesc = sg.abilityDesc;
        if (sg.rarity) B.blue.ghosts[i].rarity = sg.rarity;
      }
    });
    if (snapshot.bossActiveIdx != null) {
      B.blue.activeIdx = snapshot.bossActiveIdx;
    }
  } else if (snapshot.bossGhost && B.blue) {
    const bf = active(B.blue);
    if (bf) {
      bf.hp = snapshot.bossGhost.hp;
      bf.maxHp = snapshot.bossGhost.maxHp;
      if (snapshot.bossGhost.ko) bf.ko = true;
    }
  }

  // Update round
  if (snapshot.round) B.round = snapshot.round;

  // Show dice from the last roll
  if (snapshot.lastRoll) {
    const redDiceEl = document.getElementById('red-dice');
    const blueDiceEl = document.getElementById('blue-dice');
    if (redDiceEl && snapshot.lastRoll.player) {
      redDiceEl.innerHTML = snapshot.lastRoll.player.map(v =>
        `<div class="die die-red">${v}</div>`
      ).join('');
    }
    if (blueDiceEl && snapshot.lastRoll.boss) {
      blueDiceEl.innerHTML = snapshot.lastRoll.boss.map(v =>
        `<div class="die die-blue">${v}</div>`
      ).join('');
    }
  }

  // Update boss HP pool bar
  if (snapshot.bossPoolHp != null) {
    renderBossHpPool(snapshot.bossPoolHp, snapshot.bossMaxHp || 1);
  }

  // Sync the active fighter's resources so spectator sees their specials, not their own
  if (snapshot.playerResources && B.red) {
    B.red.resources = { ...snapshot.playerResources };
  }

  // Re-render the battle UI with updated state
  if (typeof renderBattle === 'function') renderBattle();
}

/**
 * Initialize and launch a raid battle in-page using battle-engine.js.
 * Called by launchRaidBattle() instead of redirecting to the testroom.
 *
 * @param {object} raidData   — live raid instance data from Firebase
 * @param {Array}  enemyGhosts — boss/minion ghost objects (with id, name, maxHp, art, ability, etc.)
 * @param {Array}  playerTeam  — array of 3 ghost IDs the player chose
 * @param {boolean} isWave     — true if this is a minion wave, false for the boss fight
 */
function initRaidBattleInPage(raidData, enemyGhosts, playerTeam, isWave) {
  // ── 1. Show the raid screen and battle view ──────────────────
  const raidScreen = document.getElementById('raid-screen');
  if (raidScreen) {
    raidScreen.style.display = 'block';
  }
  const battleView = document.getElementById('battle-view');
  if (battleView) {
    battleView.style.display = 'block';
  }

  // ── 2. Register/override boss ghosts so getGhost() returns boss versions ─
  // Boss ghosts often share IDs with regular ghosts (e.g. Dark Fang 202) but
  // have different maxHp. We need makeTeam() to use the BOSS version.
  // Strategy: temporarily override the ghost in the GHOSTS array.
  _registeredRaidGhostIds = [];
  _originalGhostData = {};
  enemyGhosts.forEach(g => {
    if (typeof GHOSTS !== 'undefined') {
      const idx = GHOSTS.findIndex(gh => gh.id === g.id);
      if (idx >= 0) {
        // Save original and override with boss version
        _originalGhostData[g.id] = { ...GHOSTS[idx] };
        GHOSTS[idx] = { ...GHOSTS[idx], maxHp: g.maxHp, art: g.art || GHOSTS[idx].art };
        _registeredRaidGhostIds.push(g.id);
      } else {
        // Ghost doesn't exist at all — add it
        GHOSTS.push({
          id: g.id,
          name: g.name,
          rarity: g.rarity || 'legendary',
          maxHp: g.maxHp,
          art: g.art || '',
          ability: g.ability || '',
          abilityDesc: g.abilityDesc || '',
          _raidBridgeRegistered: true
        });
        _registeredRaidGhostIds.push(g.id);
      }
    }
  });

  // ── 3. Set picks on the shared app state ─────────────────────
  S.redPicks = playerTeam;                       // array of 3 IDs
  S.bluePicks = enemyGhosts.map(g => g.id);      // boss + minions

  // ── 4. Set boss mode flags ───────────────────────────────────
  window.BOSS_MODE = true;
  window.RAID_MODE = true;
  window.IS_WAVE_FIGHT = !!isWave;
  // MP_MODE must be true for the blue AI to respond to red's roll
  if (typeof MP_MODE !== 'undefined') MP_MODE = true;

  // ── 5. Build BOSS_RAID_DATA from the live raidBattleState ────
  // raidBattleState is maintained by raid-engine.js (startMyRaidFight).
  // We just alias it so battle-engine.js can read it.
  if (typeof raidBattleState !== 'undefined' && raidBattleState) {
    window.BOSS_RAID_DATA = raidBattleState;
  } else {
    // Fallback: build a minimal data blob
    const bossConfig = typeof RAID_BOSSES !== 'undefined'
      ? RAID_BOSSES[raidData.raidId] : null;
    window.BOSS_RAID_DATA = {
      raidData: raidData,
      bossConfig: bossConfig,
      currentBossHp: raidData.bossCurrentHp || 0,
      maxBossHp: raidData.bossMaxHp || 1,
      totalDamageDealt: 0,
      ghostsLost: 0,
      bossPhase: getBossPhase(raidData.bossCurrentHp, raidData.bossMaxHp),
      enrageLevel: raidData.enrageLevel || 0,
      currentSlot: raidData.currentFighterIdx || 0,
      bossTeam: null,
      personality: bossConfig ? bossConfig.personality : 'tyrant'
    };
  }

  // ── 6. Start the battle via battle-engine.js ─────────────────
  // ── 6a. Read saved player state from raidData (already in currentRaid from listener)
  // IMPORTANT: Only restore saved state for the FIGHTER, not the spectator.
  // Spectators get live updates via snapshot sync — restoring their own state
  // here would overwrite the fighter's team with the spectator's KO'd ghosts.
  const user = firebase.auth().currentUser;
  const isFighter = _currentRaidRole === 'fighter';
  const savedState = (isFighter && raidData.playerGhostState && user) ? raidData.playerGhostState[user.uid] : null;

  // ── 6b. Skip the VS splash in raids — just start fighting ────
  const vsSplash = document.getElementById('vsSplash');
  if (vsSplash) vsSplash.style.display = 'none';

  // ── 6c. Skip entry abilities if resuming a saved turn ──────────
  // When a player resumes after spectating, startBattle() would re-fire
  // entry abilities on ghosts that already entered. Also suppress for
  // spectators (they're watching, not entering). Only allow entries on
  // a player's genuine first fight (no saved state).
  if (savedState || !isFighter) {
    window._raidSkipEntry = true;
  }

  startBattle();

  // Restore splash element (hidden by display:none, won't show because active class is cleared)
  if (vsSplash) setTimeout(() => { vsSplash.style.display = ''; }, 3000);

  // Clear the skip-entry flag ONLY after entries have actually been suppressed.
  // startBattle fires entries via setTimeout(spd(2200)) on the splash path.
  // We clear at 8s to cover worst case (boss intro delay + splash + Jenkins modals).
  if (window._raidSkipEntry) {
    setTimeout(() => { window._raidSkipEntry = false; }, 8000);
  }

  // ── 7. Post-init tweaks on the B battle state ────────────────
  if (B) {
    B.duelPhaseMode = false;   // boss fights skip duel phase

    // ── 7a. Carry over boss ghost state from Firebase (don't reset to full) ──
    // The previous player saved the exact HP/KO/activeIdx of every boss ghost.
    // Restore that so damage persists across player turns.
    const savedBoss = raidData.bossGhostState;
    if (savedBoss && savedBoss.ghosts && B.blue) {
      savedBoss.ghosts.forEach((gs, i) => {
        if (B.blue.ghosts[i]) {
          B.blue.ghosts[i].hp = gs.hp;
          B.blue.ghosts[i].ko = !!gs.ko;
          if (gs.ko) B.blue.ghosts[i].hp = 0;
          // Restore identity (boss transforms, if any)
          if (gs.id != null) {
            B.blue.ghosts[i].id = gs.id;
            B.blue.ghosts[i].name = gs.name;
            B.blue.ghosts[i].art = gs.art;
            B.blue.ghosts[i].maxHp = gs.maxHp;
            B.blue.ghosts[i].ability = gs.ability;
            B.blue.ghosts[i].abilityDesc = gs.abilityDesc;
            B.blue.ghosts[i].rarity = gs.rarity;
          }
        }
      });
      if (savedBoss.activeIdx != null) {
        B.blue.activeIdx = savedBoss.activeIdx;
      }
    } else {
      // Fallback: no saved boss ghost state (legacy), use pool ratio
      const bossCurHp = raidData.bossCurrentHp;
      const bossMaxHp = raidData.bossMaxHp;
      if (bossCurHp != null && B.blue) {
        const bossGhost = B.blue.ghosts[B.blue.activeIdx];
        if (bossGhost) {
          const ratio = bossMaxHp > 0 ? bossCurHp / bossMaxHp : 1;
          bossGhost.hp = Math.max(1, Math.round(bossGhost.maxHp * ratio));
          if (bossCurHp <= 0) bossGhost.hp = 0;
        }
      }
    }

    // ── 7b. Restore player ghost HP, identity, + resources from saved state ──
    // savedState was read from raidData (already in memory from listener)
    // so this is SYNCHRONOUS — no race condition
    if (savedState && savedState.ghosts) {
      savedState.ghosts.forEach((gs, i) => {
        if (B.red.ghosts[i]) {
          B.red.ghosts[i].hp = gs.hp;
          B.red.ghosts[i].ko = !!gs.ko;
          if (gs.ko) B.red.ghosts[i].hp = 0;
          // Restore identity (keeps transforms intact across swaps)
          if (gs.id != null) {
            B.red.ghosts[i].id = gs.id;
            B.red.ghosts[i].name = gs.name;
            B.red.ghosts[i].art = gs.art;
            B.red.ghosts[i].maxHp = gs.maxHp;
            B.red.ghosts[i].ability = gs.ability;
            B.red.ghosts[i].abilityDesc = gs.abilityDesc;
            B.red.ghosts[i].rarity = gs.rarity;
          }
          // Restore original* fields so reverse-transform still works
          if (gs.originalId != null) {
            B.red.ghosts[i].originalId = gs.originalId;
            B.red.ghosts[i].originalName = gs.originalName;
            B.red.ghosts[i].originalArt = gs.originalArt;
            B.red.ghosts[i].originalMaxHp = gs.originalMaxHp;
            B.red.ghosts[i].originalAbility = gs.originalAbility;
            B.red.ghosts[i].originalAbilityDesc = gs.originalAbilityDesc;
            B.red.ghosts[i].originalRarity = gs.originalRarity;
          }
        }
      });
      // Restore active ghost index (in case a ghost was KO'd and swapped)
      if (savedState.activeIdx != null) {
        B.red.activeIdx = savedState.activeIdx;
      }
      // Restore resources (firefly, lucky stone, etc.)
      if (savedState.resources) {
        B.red.resources = { ...B.red.resources, ...savedState.resources };
      }
    }

    // ── 7c. Clear dice from previous player's turn ──────────────
    B.redDice = null;
    B.blueDice = null;
    const redDiceEl = document.getElementById('red-dice');
    const blueDiceEl = document.getElementById('blue-dice');
    if (redDiceEl) redDiceEl.innerHTML = '';
    if (blueDiceEl) blueDiceEl.innerHTML = '';
    // Also clear any 3D physics dice lingering on the board
    document.querySelectorAll('.die-physics').forEach(el => el.remove());

    // Re-render with correct HP (dice won't show because B.redDice/blueDice are null)
    renderBattle();
  }

  // ── 8. Hide blue roll button (boss auto-rolls via AI) ───────
  const blueBtn = document.getElementById('rollBlueBtn');
  if (blueBtn) {
    blueBtn.style.display = 'none';
  }

  // ── 9. Start blue AI + snapshot sync — FIGHTER ONLY ──────────
  // Spectators must never write snapshots or run boss AI. Previously
  // both started here and were stopped ~50ms later in setupSpectatorView,
  // leaving a window for corrupt writes.
  if (_currentRaidRole === 'fighter') {
    // Force-stop first to clear any stale AI_ACTIVE flag from a previous raid
    if (typeof stopBlueAI === 'function') stopBlueAI();
    if (typeof startBlueAI === 'function') startBlueAI();
    startSnapshotSync();
  }

  // ── 9b. Ensure red roll button is visible ONLY for the fighter ─
  setTimeout(() => {
    if (_currentRaidRole !== 'fighter') return; // spectators don't get a roll button
    const redBtn = document.getElementById('rollRedBtn');
    if (redBtn && B && B.phase === 'ready') {
      redBtn.style.display = '';
      redBtn.disabled = false;
      redBtn.textContent = 'ROLL';
    }
  }, 300);

  // ── 10. Render the boss HP pool bar ──────────────────────────
  const bossHp    = raidData.bossCurrentHp || 0;
  const bossMaxHp = raidData.bossMaxHp || 1;
  _ensureBossHpPoolBar();
  renderBossHpPool(bossHp, bossMaxHp);
}

// (_registeredRaidGhostIds declared at top of file)

// ─── BOSS HP POOL BAR ──────────────────────────────────────────

/**
 * Ensure the boss HP pool bar DOM exists inside #raid-screen.
 * Uses the existing .rib-boss-pool CSS classes from index.html.
 */
function _ensureBossHpPoolBar() {
  if (document.getElementById('raid-boss-pool')) return;

  const raidScreen = document.getElementById('raid-screen');
  const battleView = document.getElementById('battle-view');
  const target = raidScreen || battleView;
  if (!target) return;

  const bar = document.createElement('div');
  bar.className = 'rib-boss-pool';
  bar.id = 'raid-boss-pool';
  bar.innerHTML = `
    <div class="rib-boss-pool-fill" id="raid-boss-fill"
         style="height:100%; border-radius:10px; transition:width 0.6s ease, background 0.4s; width:100%; background:#2ecc71;">
    </div>
    <div class="rib-boss-pool-text" id="raid-boss-text"
         style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
                font-weight:900; font-size:0.85rem; color:#fff; text-shadow:0 1px 4px rgba(0,0,0,0.6); letter-spacing:1px;">
      BOSS HP
    </div>
  `;

  // Insert at the top of the target container
  target.insertBefore(bar, target.firstChild);
}

/**
 * Render / update the boss HP pool bar.
 * Color shifts by phase: green >75%, yellow >50%, red >25%, purple <=25%.
 *
 * @param {number} bossHp    — current shared boss HP
 * @param {number} bossMaxHp — maximum boss HP
 */
function renderBossHpPool(bossHp, bossMaxHp) {
  const fill = document.getElementById('raid-boss-fill');
  const text = document.getElementById('raid-boss-text');
  if (!fill || !text) return;

  const hp  = Math.max(0, bossHp);
  const max = Math.max(1, bossMaxHp);
  const pct = (hp / max) * 100;

  fill.style.width = pct + '%';

  // Phase color
  if (pct > 75)      fill.style.background = '#2ecc71';  // green
  else if (pct > 50) fill.style.background = '#f1c40f';  // yellow
  else if (pct > 25) fill.style.background = '#e74c3c';  // red
  else               fill.style.background = '#9b59b6';  // purple

  text.textContent = 'BOSS HP: ' + hp + ' / ' + max;
}

// ─── CLEANUP ───────────────────────────────────────────────────

/**
 * Clean up after a raid battle ends or the player leaves.
 * Resets flags, hides the raid screen, removes injected ghosts.
 */
function cleanupRaidBattle() {
  // ── Stop AI + snapshot sync ──────────────────────────────────
  if (typeof stopBlueAI === 'function') stopBlueAI();
  stopSnapshotSync();

  // ── Reset global flags ────────────────────────────────────────
  window.BOSS_MODE = false;
  window.RAID_MODE = false;
  window.BOSS_RAID_DATA = null;
  window.IS_WAVE_FIGHT = false;
  window._raidSkipEntry = false;

  // ── Hide raid screen ──────────────────────────────────────────
  const raidScreen = document.getElementById('raid-screen');
  if (raidScreen) {
    raidScreen.style.display = 'none';
  }

  // ── Hide battle view ──────────────────────────────────────────
  const battleView = document.getElementById('battle-view');
  if (battleView) {
    battleView.style.display = 'none';
  }

  // ── Clean up raid-engine state (currentRaid, listeners, activeRaid) ─
  if (typeof cleanupRaid === 'function') cleanupRaid();
  // Clear activeRaid from Firebase so we don't re-enter the old raid
  const user = firebase.auth().currentUser;
  if (user) {
    db.ref(`mp/users/${user.uid}/activeRaid`).remove();
  }

  // ── Show main content ──────────────────────────────────────────
  if (typeof hideRaidScreen === 'function') {
    hideRaidScreen(); // properly restores #main-content visibility
  } else {
    const mc = document.getElementById('main-content');
    if (mc) mc.style.display = '';
  }

  // ── Restore blue roll button visibility ───────────────────────
  const blueBtn = document.getElementById('rollBlueBtn');
  if (blueBtn) {
    blueBtn.style.display = '';
  }

  // ── Remove boss HP pool bar ───────────────────────────────────
  const poolBar = document.getElementById('raid-boss-pool');
  if (poolBar) {
    poolBar.remove();
  }

  // ── Restore original ghost data (undo boss HP overrides) ──────
  if (_originalGhostData && typeof GHOSTS !== 'undefined') {
    Object.entries(_originalGhostData).forEach(([id, original]) => {
      const idx = GHOSTS.findIndex(g => g.id === parseInt(id));
      if (idx >= 0) GHOSTS[idx] = original;
    });
    _originalGhostData = {};
  }
  // Remove any ghosts that were injected (not overridden)
  if (typeof GHOSTS !== 'undefined') {
    for (let i = GHOSTS.length - 1; i >= 0; i--) {
      if (GHOSTS[i]._raidBridgeRegistered) GHOSTS.splice(i, 1);
    }
  }
  _registeredRaidGhostIds = [];

  // ── Hide and reset game-over overlay ──────────────────────────
  const gameOverEl = document.getElementById('gameOver');
  if (gameOverEl) {
    gameOverEl.style.display = 'none';
    gameOverEl.classList.remove('active');
    gameOverEl.innerHTML = '';
  }

  // ── Stop blue AI ─────────────────────────────────────────────
  if (typeof stopBlueAI === 'function') stopBlueAI();

  // ── Clear battle state ────────────────────────────────────────
  B = null;
  S.redPicks = [];
  S.bluePicks = [];
}

// ─── GAME-OVER HOOK ────────────────────────────────────────────
// battle-engine.js showGameOver() already checks RAID_MODE and calls
// endMyRaidFight() (global from raid-engine.js). We just need a
// "Return to Lobby" button on the game-over overlay.

/**
 * Inject a "Return to Lobby" button into the game-over overlay when
 * in raid mode. Call this after showGameOver() has rendered.
 * battle-engine.js fires showGameOver -> endMyRaidFight after 3s,
 * so we hook in slightly earlier to add the button.
 */
function injectRaidReturnButton() {
  // Look for the game-over overlay that battle-engine.js renders
  const overlay = document.getElementById('game-over-overlay')
    || document.getElementById('gameOverOverlay')
    || document.querySelector('.game-over-overlay');
  if (!overlay) return;

  // Don't double-add
  if (overlay.querySelector('.raid-return-btn')) return;

  const btn = document.createElement('button');
  btn.className = 'raid-return-btn';
  btn.textContent = 'RETURN TO LOBBY';
  btn.style.cssText = `
    margin-top: 16px; padding: 12px 32px; font-size: 1rem; font-weight: 700;
    background: linear-gradient(135deg, #9b59b6, #8e44ad); color: #fff;
    border: none; border-radius: 8px; cursor: pointer; letter-spacing: 1px;
    text-transform: uppercase; box-shadow: 0 4px 12px rgba(0,0,0,0.4);
  `;
  btn.onclick = function () {
    cleanupRaidBattle();
    // If raid-engine has a lobby return function, call it
    if (typeof showRaidLobby === 'function') {
      showRaidLobby();
    }
  };
  overlay.appendChild(btn);
}

// ─── PATCH: auto-inject return button when game ends in raid mode ─
// We monkey-patch by watching B.phase. A simpler approach: poll after
// showGameOver's 3s delay.
(function _hookGameOverForRaid() {
  const _origShowGameOver = window.showGameOver;
  if (typeof _origShowGameOver !== 'function') return;

  window.showGameOver = function (winner) {
    _origShowGameOver.call(this, winner);
    if (window.RAID_MODE && currentRaid) {
      try {
        // Sync boss ghost HP back to the shared pool in Firebase
        const instanceId = currentRaid.instanceId;
        let bossHpNow = 0;
        let bossMaxGhostHp = 9;
        if (B && B.blue) {
          const bossGhost = B.blue.ghosts[0];
          if (bossGhost) {
            bossHpNow = bossGhost.ko ? 0 : bossGhost.hp;
            bossMaxGhostHp = bossGhost.maxHp || 9;
          }
        }
        const poolMax = currentRaid.bossMaxHp || 15;
        const poolNow = Math.max(0, Math.round(poolMax * (bossHpNow / bossMaxGhostHp)));

        // Stop AI and snapshot sync
        if (typeof stopBlueAI === 'function') stopBlueAI();
        stopSnapshotSync();

        // Atomic write: pool HP + player ghost state + advance turn
        const user = firebase.auth().currentUser;
        const players = currentRaid.players || {};
        const playerCount = Object.keys(players).length;
        const currentIdx = raidBattleState?.currentSlot || 0;
        const nextIdx = currentIdx + 1;
        const ghostsLost = B ? B.red.ghosts.filter(g => g.ko).length : 0;
        let totalDamage = 0;
        if (B && B.blue) {
          B.blue.ghosts.forEach(g => {
            if (g) totalDamage += Math.max(0, g.maxHp - (g.ko ? 0 : g.hp));
          });
        }

        // Save player ghost state (with identity for transforms)
        // IMPORTANT: Firebase rejects undefined — coerce every field
        const savedPlayerState = { ghosts: [], resources: {}, activeIdx: 0 };
        if (B && B.red) {
          savedPlayerState.activeIdx = B.red.activeIdx || 0;
          const rawRes = B.red.resources || {};
          const cleanRes = {};
          for (const k of Object.keys(rawRes)) { if (rawRes[k] !== undefined) cleanRes[k] = rawRes[k]; }
          savedPlayerState.resources = cleanRes;
          B.red.ghosts.forEach(g => {
            const gs = { hp: g.hp || 0, maxHp: g.maxHp || 1, ko: !!g.ko,
                         id: g.id || 0, name: g.name || '???', art: g.art || '',
                         ability: g.ability || '', abilityDesc: g.abilityDesc || '', rarity: g.rarity || 'common' };
            if (g.originalId != null) {
              gs.originalId = g.originalId || 0; gs.originalName = g.originalName || '';
              gs.originalArt = g.originalArt || ''; gs.originalMaxHp = g.originalMaxHp || 1;
              gs.originalAbility = g.originalAbility || ''; gs.originalAbilityDesc = g.originalAbilityDesc || '';
              gs.originalRarity = g.originalRarity || 'common';
            }
            savedPlayerState.ghosts.push(gs);
          });
        }

        // Build atomic update
        const update = {
          bossCurrentHp: poolNow,
          [`players/${currentIdx}/status`]: 'done',
          [`players/${currentIdx}/damageDealt`]: totalDamage,
          [`players/${currentIdx}/ghostsLost`]: ghostsLost
        };
        if (user) {
          update[`playerGhostState/${user.uid}`] = savedPlayerState;
        }

        // Check if boss is dead or all players done
        if (poolNow <= 0) {
          update.status = 'complete';
          update.completedAt = firebase.database.ServerValue.TIMESTAMP;
          update.bossDefeatedBy = user?.uid || null;
          update.fightPhase = 'done';
        } else if (nextIdx >= playerCount) {
          // All players fought, boss survived
          update.status = 'complete';
          update.completedAt = firebase.database.ServerValue.TIMESTAMP;
          update.fightPhase = 'done';
        } else {
          // Advance to next fighter
          update.currentFighterIdx = nextIdx;
          update.currentFighterUid = players[nextIdx]?.uid || null;
          update.fightPhase = 'fighting';
          update.enrageLevel = firebase.database.ServerValue.increment(1);
        }

        setTimeout(() => {
          db.ref(`mp/raids/instances/${instanceId}`).update(update).then(() => {
            console.log('[RAID] Game over processed. Winner:', winner, '| Pool HP:', poolNow);
            if (poolNow <= 0 && typeof distributeRaidRewards === 'function') {
              distributeRaidRewards(instanceId, true, user?.uid);
            } else if (nextIdx >= playerCount && typeof distributeRaidRewards === 'function') {
              distributeRaidRewards(instanceId, false, null);
            }
          }).catch(e => console.warn('[RAID] game-over update error:', e));
        }, 1500);

      } catch (e) {
        console.error('[RAID] showGameOver hook error:', e);
      }

      // ALWAYS show return button — even if Firebase fails, player shouldn't be stuck
      setTimeout(() => {
        // Try .go-buttons first, fall back to injecting into gameOver overlay
        const goButtons = document.querySelector('.go-buttons');
        const gameOver = document.getElementById('gameOver');
        const target = goButtons || gameOver;
        if (target) {
          const btnHtml = `
            <button class="go-btn-rematch" style="background:linear-gradient(135deg,#9b59b6,#8e44ad);color:#fff;border:1px solid #c084fc;padding:12px 32px;font-size:1rem;font-weight:700;border-radius:8px;cursor:pointer;letter-spacing:1px;text-transform:uppercase;box-shadow:0 4px 12px rgba(0,0,0,0.4);margin-top:16px;"
              onclick="cleanupRaidBattle(); if(typeof showRaidLobby==='function') showRaidLobby(); if(typeof closeRaidResult==='function') closeRaidResult();">
              RETURN TO LOBBY
            </button>`;
          if (goButtons) {
            goButtons.innerHTML = btnHtml;
          } else {
            target.insertAdjacentHTML('beforeend', btnHtml);
          }
        }
      }, 3500);
    }
  };
})();

// ─── PATCH: Alternating turns — swap players after each round ───
// Intercepts resetRollButtons (called after a round fully resolves)
// to swap to the next player instead of enabling roll buttons again.
(function _hookAlternatingTurns() {
  const _origResetRollButtons = window.resetRollButtons;
  if (typeof _origResetRollButtons !== 'function') return;

  var _raidRoundsPlayed = 0;

  window.resetRollButtons = function () {
    // Only intercept in raid mode with multiple players
    if (!window.RAID_MODE || !currentRaid) {
      _raidRoundsPlayed = 0;
      return _origResetRollButtons.call(this);
    }
    const players = currentRaid.players || {};
    const playerCount = Object.keys(players).length;
    if (playerCount <= 1) {
      return _origResetRollButtons.call(this);
    }

    // First call is during startBattle init — let it through so the roll button appears
    // Only intercept AFTER at least one round has been played (B.round > 1)
    if (!B || B.round <= 1) {
      _raidRoundsPlayed = 0;
      return _origResetRollButtons.call(this);
    }

    // Force one last snapshot write so spectator sees the final state of this round
    _lastSnapshotHash = '';

    // Stop AI and snapshot sync for this player's turn
    if (typeof stopBlueAI === 'function') stopBlueAI();
    stopSnapshotSync();

    // Hide roll button, clear dice, show handoff message
    const rollBtn = document.getElementById('rollRedBtn');
    if (rollBtn) rollBtn.style.display = 'none';
    const redDice = document.getElementById('red-dice');
    const blueDice = document.getElementById('blue-dice');
    if (redDice) redDice.innerHTML = '';
    if (blueDice) blueDice.innerHTML = '';
    const narrator = document.getElementById('narrator');
    if (narrator) narrator.innerHTML = 'Passing to the next raider...';

    // Save boss ghost HP — always read index 0 (the boss), not activeIdx
    // (activeIdx could point to a minion if the boss retreated)
    let bossHpNow = 0;
    let bossMaxGhostHpForTurn = 9;
    if (B && B.blue) {
      const bossGhost = B.blue.ghosts[0];
      if (bossGhost) {
        bossHpNow = bossGhost.ko ? 0 : bossGhost.hp;
        bossMaxGhostHpForTurn = bossGhost.maxHp || 9;
      }
    }
    // Save red team ghost state + resources + activeIdx
    // Includes identity fields so transforms persist across player swaps
    // IMPORTANT: Firebase rejects undefined — coerce every field to a safe default
    const savedPlayerState = { ghosts: [], resources: {}, activeIdx: 0 };
    if (B && B.red) {
      savedPlayerState.activeIdx = B.red.activeIdx || 0;
      // Scrub undefined from resources (Firebase rejects it)
      const rawRes = B.red.resources || {};
      const cleanRes = {};
      for (const k of Object.keys(rawRes)) { if (rawRes[k] !== undefined) cleanRes[k] = rawRes[k]; }
      savedPlayerState.resources = cleanRes;
      B.red.ghosts.forEach(g => {
        const gs = { hp: g.hp || 0, maxHp: g.maxHp || 1, ko: !!g.ko,
                     id: g.id || 0, name: g.name || '???', art: g.art || '',
                     ability: g.ability || '', abilityDesc: g.abilityDesc || '', rarity: g.rarity || 'common' };
        // Preserve original identity so reverse-transform still works
        if (g.originalId != null) {
          gs.originalId = g.originalId || 0; gs.originalName = g.originalName || '';
          gs.originalArt = g.originalArt || ''; gs.originalMaxHp = g.originalMaxHp || 1;
          gs.originalAbility = g.originalAbility || ''; gs.originalAbilityDesc = g.originalAbilityDesc || '';
          gs.originalRarity = g.originalRarity || 'common';
        }
        savedPlayerState.ghosts.push(gs);
      });
    }
    // Save boss team ghost state (HP, KO, activeIdx + identity for every boss ghost)
    // so the next player inherits the exact boss state — not just pool HP
    const savedBossState = { ghosts: [], activeIdx: 0 };
    if (B && B.blue) {
      savedBossState.activeIdx = B.blue.activeIdx || 0;
      B.blue.ghosts.forEach(g => {
        savedBossState.ghosts.push({ hp: g.hp || 0, maxHp: g.maxHp || 1, ko: !!g.ko,
                                     id: g.id || 0, name: g.name || '???', art: g.art || '',
                                     ability: g.ability || '', abilityDesc: g.abilityDesc || '', rarity: g.rarity || 'common' });
      });
    }

    // Advance currentFighterIdx in Firebase after a brief delay
    setTimeout(() => {
      if (!currentRaid) return;
      const currentIdx = raidBattleState?.currentSlot || 0;
      const nextIdx = (currentIdx + 1) % playerCount;
      const instanceId = currentRaid.instanceId;
      const user = firebase.auth().currentUser;

      // Calculate new boss pool HP from the boss ghost's current HP
      const poolMax = currentRaid.bossMaxHp || 15;
      const poolNow = Math.max(0, Math.round(poolMax * (bossHpNow / bossMaxGhostHpForTurn)));

      // ATOMIC write: player ghost state + fighter advance in ONE update
      // Prevents race where listener fires on index change before ghost state is saved
      // turnCounter increments each swap so the listener can distinguish repeated same-index turns
      const prevTurnCounter = currentRaid.turnCounter || 0;
      const update = {
        currentFighterIdx: nextIdx,
        currentFighterUid: players[nextIdx]?.uid || null,
        fightPhase: 'fighting',
        bossCurrentHp: poolNow,
        bossGhostState: savedBossState,
        turnCounter: prevTurnCounter + 1
      };
      if (user && savedPlayerState.ghosts.length > 0) {
        update[`playerGhostState/${user.uid}`] = savedPlayerState;
      }

      db.ref(`mp/raids/instances/${instanceId}`).update(update).then(() => {
        console.log('[RAID] Turn passed to player', nextIdx, '| Boss pool HP:', poolNow, '/', poolMax);
        _currentRaidRole = 'spectator';
      }).catch(e => console.error('[RAID] Turn handoff Firebase write FAILED:', e));
    }, 1500);
  };
})();

// ─── PATCH: Spectator detects game completion ──────────────────
// Player 2 needs to see a result screen when the raid completes.
// Listen for raid status changes even while spectating.
(function _hookSpectatorGameOver() {
  // Poll raid status while spectating
  setInterval(() => {
    if (_currentRaidRole !== 'spectator' || !currentRaid) return;
    db.ref(`mp/raids/instances/${currentRaid.instanceId}/status`).once('value').then(snap => {
      if (snap.val() === 'complete') {
        // Raid is over — show return to lobby
        const raidScreen = document.getElementById('raid-screen');
        if (!raidScreen || raidScreen.style.display === 'none') return;
        // Don't show if we already have a game-over overlay
        const existing = document.getElementById('gameOver');
        if (existing && existing.style.display !== 'none' && existing.innerHTML) return;

        // Show a simple result overlay
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.85);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;';
        overlay.innerHTML = `
          <h1 style="font-family:Creepster,cursive;font-size:2.5rem;color:#2ecc71;letter-spacing:4px;">RAID COMPLETE</h1>
          <p style="color:var(--text2);font-size:1.1rem;">The raid has ended.</p>
          <button style="background:linear-gradient(135deg,#9b59b6,#8e44ad);color:#fff;border:1px solid #c084fc;padding:12px 32px;font-size:1rem;font-weight:700;border-radius:8px;cursor:pointer;letter-spacing:1px;text-transform:uppercase;"
            onclick="this.parentElement.remove(); cleanupRaidBattle(); if(typeof showRaidLobby==='function') showRaidLobby();">
            RETURN TO LOBBY
          </button>`;
        document.body.appendChild(overlay);
      }
    }).catch(() => {});
  }, 2000);
})();

// ─── SNAPSHOT SYNC: Poll battle state and write to Firebase ─────
// Simple interval that writes B state to Firebase every 500ms while
// the active player is fighting. Player 2's battleState listener
// picks up changes and calls updateSpectatorFromSnapshot.
var _snapshotInterval = null;
var _lastSnapshotHash = '';

function startSnapshotSync() {
  stopSnapshotSync();
  _snapshotInterval = setInterval(() => {
    if (!window.RAID_MODE || _currentRaidRole !== 'fighter' || !B || !currentRaid) return;
    if (typeof writeBattleSnapshot !== 'function') return;

    // Build a hash to detect changes — includes activeIdx so swaps trigger writes
    const rf = active(B.red);
    const bf = active(B.blue);
    const hash = [
      rf?.hp, rf?.name, rf?.ko,
      bf?.hp, bf?.name, bf?.ko,
      B.red?.activeIdx, B.blue?.activeIdx,
      B.round, B.phase,
      (B.redDice || []).join(','),
      (B.blueDice || []).join(','),
      B.red?.ghosts?.map(g => g.hp + '/' + (g.ko ? 'K' : '')).join(','),
      B.blue?.ghosts?.map(g => g.hp + '/' + (g.ko ? 'K' : '')).join(',')
    ].join('|');

    if (hash === _lastSnapshotHash) return;
    _lastSnapshotHash = hash;

    try {
      const redDice = (B.redDice || []).map(d => d || 0);
      const blueDice = (B.blueDice || []).map(d => d || 0);

      // Send ALL ghosts with full state so spectator can track swaps and KOs
      const allPlayerGhosts = B.red ? B.red.ghosts.map(g => ({
        name: g.name || '???', hp: g.hp || 0, maxHp: g.maxHp || 1,
        ko: !!g.ko, art: g.art || '', id: g.id || 0,
        ability: g.ability || '', abilityDesc: g.abilityDesc || '', rarity: g.rarity || 'common'
      })) : [];
      // Scrub undefined values — Firebase rejects them and silently fails the write
      const _rawRes = B.red ? (B.red.resources || {}) : {};
      const playerResources = {};
      for (const k of Object.keys(_rawRes)) { if (_rawRes[k] !== undefined) playerResources[k] = _rawRes[k]; }
      const allBossGhosts = B.blue ? B.blue.ghosts.map(g => ({
        name: g.name || '???', hp: g.hp || 0, maxHp: g.maxHp || 1,
        ko: !!g.ko, art: g.art || '', id: g.id || 0,
        ability: g.ability || '', abilityDesc: g.abilityDesc || '', rarity: g.rarity || 'common'
      })) : [];

      writeBattleSnapshot({
        playerName: firebase.auth().currentUser?.displayName || 'Raider',
        playerGhost: rf || { name: '???', hp: 0, maxHp: 1, art: '' },
        bossGhost: bf || { name: '???', hp: 0, maxHp: 1, art: '' },
        // Full ghost arrays + activeIdx for spectator sync
        allPlayerGhosts: allPlayerGhosts,
        allBossGhosts: allBossGhosts,
        playerActiveIdx: B.red ? B.red.activeIdx : 0,
        bossActiveIdx: B.blue ? B.blue.activeIdx : 0,
        playerSideline: B.red ? B.red.ghosts.filter((g, i) => i !== B.red.activeIdx) : [],
        bossSideline: B.blue ? B.blue.ghosts.filter((g, i) => i !== B.blue.activeIdx) : [],
        lastRoll: redDice.length > 0 ? { player: redDice, boss: blueDice } : null,
        bossPoolHp: window.BOSS_RAID_DATA?.currentBossHp || 0,
        bossMaxHp: window.BOSS_RAID_DATA?.maxBossHp || 1,
        playerResources: playerResources,
        round: B.round || 1,
        isWave: window.IS_WAVE_FIGHT || false
      });
    } catch (e) { console.warn('[RAID SYNC] snapshot error:', e); }
  }, 500);
}

function stopSnapshotSync() {
  if (_snapshotInterval) {
    clearInterval(_snapshotInterval);
    _snapshotInterval = null;
  }
  _lastSnapshotHash = '';
}
