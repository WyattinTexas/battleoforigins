// =================================================================
// RAID BATTLE ADAPTER — Clean adapter between RaidState and BattleEngine
// Replaces: raid-battle-bridge.js (930 lines of monkey-patches)
// Uses: hook system (onGameOver, onResetRollButtons, onPostResolve)
// Depends on: raid-state-machine.js, raid-sync.js, battle-engine.js, raid-engine.js
// =================================================================

const RaidBattleAdapter = {
  // Boss ghost lookup (scoped, not global GHOSTS mutation)
  _bossGhostLookup: {},

  // ── Initialize: register hooks once at load time ──────────────
  init() {
    // ── Turn rotation hook ────────────────────────────────────────
    // Replaces the 125-line resetRollButtons monkey-patch in the old bridge
    BattleEngine.onResetRollButtons(() => {
      if (!RaidState.isActive() || !RaidState.amFighter()) return false;

      const B = BattleEngine.getState();
      if (!B || B.round <= 1) return false;
      if (B.phase === 'over') return false;

      this._handleTurnHandoff();
      return true;
    });

    // ── Game over hook ────────────────────────────────────────────
    // Replaces the 130-line showGameOver monkey-patch in the old bridge
    BattleEngine.onGameOver((winner) => {
      if (!RaidState.isActive()) return false; // not in raid — let default UI run
      this._handleRaidGameOver(winner);
      return true; // consumed — skip default showGameOver UI (prevents 5s auto-redirect)
    });

    // ── Post-resolve hook (event-driven snapshot) ─────────────────
    // Replaces the 500ms setInterval snapshot polling
    BattleEngine.onPostResolve((B) => {
      if (!RaidState.amFighter() || !B) return;
      RaidSync.writeBattleSnapshot(B);
    });

    // ── React to state machine transitions ────────────────────────
    RaidState.on('transition', ({ from, to, data }) => {
      if (to === 'fighting' && RaidState.isMyTurn()) {
        this._startMyFight();
      }
      if (to === 'spectating') {
        this._startSpectating();
      }
      if (to === 'complete') {
        this._showResults();
      }
      if (to === 'idle') {
        this._cleanup();
      }
    });

    // ── React to Firebase updates ─────────────────────────────────
    RaidState.on('firebase-update', ({ instanceId, data }) => {
      this._handleFirebaseUpdate(instanceId, data);
    });

    // ── React to raid assignment ──────────────────────────────────
    RaidState.on('raid-assigned', ({ instanceId, data }) => {
      this._enterRaid(instanceId, data);
    });

    // ── React to raid cleared ─────────────────────────────────────
    RaidState.on('raid-cleared', () => {
      if (RaidState.isActive()) {
        this._cleanup();
        RaidState.reset();
      }
    });

    console.log('[RaidAdapter] Initialized — hooks registered');
  },

  // ══════════════════════════════════════════════════════════════════
  // RAID ENTRY
  // ══════════════════════════════════════════════════════════════════

  _enterRaid(instanceId, data) {
    const user = firebase.auth().currentUser;
    if (!user) return;

    // Load state from Firebase
    RaidState.loadFromFirebase(instanceId, data, user.uid);

    // Connect sync layer
    RaidSync.connect(instanceId);

    // Determine initial phase
    switch (data.status) {
      case 'countdown':
        RaidState.transition('lobby');
        if (typeof showRaidWaitingRoom === 'function') {
          showRaidWaitingRoom(instanceId, data);
        }
        // Auto-start fallback (first player starts after 20s)
        if (RaidState.mySlot === 0) {
          setTimeout(async () => {
            if (RaidState.phase !== 'lobby') return;
            RaidSync.startRaid();
          }, 20000);
        }
        break;

      case 'active':
        if (RaidState.isMyTurn()) {
          RaidState.transition('lobby'); // temp state for valid transition
          RaidState.transition('countdown');
          RaidState.transition('fighting');
        } else {
          RaidState.transition('lobby');
          RaidState.transition('countdown');
          RaidState.transition('spectating');
        }
        break;

      case 'complete':
        RaidState.transition('lobby');
        RaidState.transition('countdown');
        RaidState.transition('complete');
        break;
    }

    if (typeof showRaidScreen === 'function') showRaidScreen(instanceId);
  },

  // ══════════════════════════════════════════════════════════════════
  // FIREBASE UPDATE HANDLER
  // ══════════════════════════════════════════════════════════════════

  _handleFirebaseUpdate(instanceId, data) {
    const user = firebase.auth().currentUser;
    if (!user) return;

    // Update RaidState from Firebase data
    RaidState.currentFighterIdx = data.currentFighterIdx || 0;
    RaidState.currentFighterUid = data.currentFighterUid || null;
    RaidState.turnCounter = data.turnCounter || 0;
    RaidState.bossCurrentHp = data.bossCurrentHp != null ? data.bossCurrentHp : (RaidState.bossMaxHp || data.bossMaxHp || 15);
    RaidState.enrageLevel = data.enrageLevel || 0;
    RaidState.bossGhostState = data.bossGhostState || null;
    RaidState.playerGhostState = data.playerGhostState || {};

    // Update players
    if (data.players) {
      for (const [slot, p] of Object.entries(data.players)) {
        RaidState.players[parseInt(slot)] = p;
      }
    }

    switch (data.status) {
      case 'countdown':
        if (RaidState.phase === 'idle') {
          this._enterRaid(instanceId, data);
        }
        if (typeof showRaidWaitingRoom === 'function') {
          showRaidWaitingRoom(instanceId, data);
        }
        break;

      case 'active':
        if (typeof hideRaidWaitingRoom === 'function') hideRaidWaitingRoom();
        this._handleActiveFight(data);
        break;

      case 'complete':
        if (RaidState.phase !== 'complete') {
          // Need valid transition path
          if (RaidState.phase === 'idle') {
            RaidState.transition('lobby');
            RaidState.transition('countdown');
          }
          if (RaidState.phase === 'lobby') {
            RaidState.transition('countdown');
          }
          if (['countdown', 'fighting', 'spectating', 'turn-handoff'].includes(RaidState.phase)) {
            RaidState.transition('complete');
          }
        }
        break;
    }
  },

  // Handle active fight — decide fighter vs spectator
  _lastProcessedTurn: -1,
  _lastProcessedCounter: -1,

  _handleActiveFight(data) {
    const currentIdx = data.currentFighterIdx || 0;
    const turnCounter = data.turnCounter || 0;

    // Only process each turn once
    if (currentIdx === this._lastProcessedTurn && turnCounter === this._lastProcessedCounter) {
      // Still same turn — just update spectator if watching
      if (RaidState.amSpectator() && data.battleState) {
        this._updateSpectatorView(data.battleState);
      }
      return;
    }
    this._lastProcessedTurn = currentIdx;
    this._lastProcessedCounter = turnCounter;

    const isMyTurn = RaidState.isMyTurn() &&
      RaidState.players[RaidState.mySlot]?.status !== 'done' &&
      RaidState.players[RaidState.mySlot]?.status !== 'disconnected';

    if (isMyTurn) {
      // Clean up spectator overlay
      if (typeof hideRaidSpectatorOverlay === 'function') hideRaidSpectatorOverlay();
      const gameOverEl = document.getElementById('gameOver');
      if (gameOverEl) { gameOverEl.style.display = 'none'; gameOverEl.innerHTML = ''; }
      BattleEngine.stopBlueAI();

      // Valid transition path to fighting
      if (RaidState.phase === 'spectating') {
        RaidState.transition('fighting');
      } else if (RaidState.phase === 'turn-handoff') {
        RaidState.transition('fighting');
      } else if (['lobby', 'countdown'].includes(RaidState.phase)) {
        if (RaidState.phase === 'lobby') RaidState.transition('countdown');
        RaidState.transition('fighting');
      }
    } else {
      // Valid transition path to spectating
      if (RaidState.phase === 'fighting') {
        RaidState.transition('spectating');
      } else if (RaidState.phase === 'turn-handoff') {
        RaidState.transition('spectating');
      } else if (['lobby', 'countdown'].includes(RaidState.phase)) {
        if (RaidState.phase === 'lobby') RaidState.transition('countdown');
        RaidState.transition('spectating');
      }
      // Don't apply the stale battleState from the previous fighter's turn —
      // _startSpectating() just built the correct team via startBattle().
      // Fresh snapshots from the new fighter will arrive on subsequent Firebase events.
    }
  },

  // ══════════════════════════════════════════════════════════════════
  // FIGHTER: START MY FIGHT
  // ══════════════════════════════════════════════════════════════════

  _startMyFight() {
    const { bossConfig, players, currentFighterIdx, bossGhostState, playerGhostState } = RaidState;
    const playerData = players[currentFighterIdx];
    if (!playerData || !bossConfig) return;

    // Show raid screen and battle view
    const raidScreen = document.getElementById('raid-screen');
    if (raidScreen) raidScreen.style.display = 'block';
    const battleView = document.getElementById('battle-view');
    if (battleView) battleView.style.display = 'block';

    // Build boss team
    const phase = 1; // phases disabled
    const bossTeam = buildBossTeam(bossConfig, phase, RaidState.enrageLevel);
    RaidState.bossTeam = bossTeam;
    const blueGhosts = [bossTeam.boss, ...bossTeam.minions].slice(0, 3);

    // Register boss ghosts in a LOCAL lookup (no GHOSTS array mutation!)
    this._bossGhostLookup = {};
    blueGhosts.forEach(g => { this._bossGhostLookup[g.id] = g; });

    // Set picks on shared app state
    const S = BattleEngine.getS();
    S.redPicks = playerData.team;
    S.bluePicks = blueGhosts.map(g => g.id);

    // Scoped getGhost patch — only during synchronous startBattle()->makeTeam() call
    const _origGetGhost = window.getGhost;
    const lookup = this._bossGhostLookup;
    window.getGhost = (id) => lookup[id] || _origGetGhost(id);

    // Suppress entry abilities if resuming a saved turn
    const user = firebase.auth().currentUser;
    const savedState = playerGhostState?.[user?.uid];
    if (savedState) {
      window._raidSkipEntry = true;
    }

    // Skip VS splash in raids
    const vsSplash = document.getElementById('vsSplash');
    if (vsSplash) vsSplash.style.display = 'none';

    // Set MP_MODE so blue AI responds to red's roll
    MP_MODE = true;

    BattleEngine.startBattle();

    // Restore getGhost immediately (makeTeam already ran synchronously)
    window.getGhost = _origGetGhost;

    // Restore splash element
    if (vsSplash) setTimeout(() => { vsSplash.style.display = ''; }, 3000);

    // Clear skip-entry flag after entries have been suppressed
    if (window._raidSkipEntry) {
      setTimeout(() => { window._raidSkipEntry = false; }, 8000);
    }

    const B = BattleEngine.getState();
    if (B) {
      B.duelPhaseMode = false; // boss fights skip duel phase

      // Restore boss ghost state from previous player's turn
      if (bossGhostState && bossGhostState.ghosts && B.blue) {
        bossGhostState.ghosts.forEach((gs, i) => {
          if (B.blue.ghosts[i]) {
            B.blue.ghosts[i].hp = gs.hp;
            B.blue.ghosts[i].ko = !!gs.ko;
            if (gs.ko) B.blue.ghosts[i].hp = 0;
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
        if (bossGhostState.activeIdx != null) {
          B.blue.activeIdx = bossGhostState.activeIdx;
        }
      }

      // Restore player ghost state (HP, resources, transforms)
      if (savedState && savedState.ghosts) {
        savedState.ghosts.forEach((gs, i) => {
          if (B.red.ghosts[i]) {
            B.red.ghosts[i].hp = gs.hp;
            B.red.ghosts[i].ko = !!gs.ko;
            if (gs.ko) B.red.ghosts[i].hp = 0;
            if (gs.id != null) {
              B.red.ghosts[i].id = gs.id;
              B.red.ghosts[i].name = gs.name;
              B.red.ghosts[i].art = gs.art;
              B.red.ghosts[i].maxHp = gs.maxHp;
              B.red.ghosts[i].ability = gs.ability;
              B.red.ghosts[i].abilityDesc = gs.abilityDesc;
              B.red.ghosts[i].rarity = gs.rarity;
            }
            // Restore original* fields for reverse-transform
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
        if (savedState.activeIdx != null) B.red.activeIdx = savedState.activeIdx;
        if (savedState.resources) B.red.resources = { ...B.red.resources, ...savedState.resources };
        // Restore willowLostLast so Joy of Painting carries across raid turns
        if (savedState.willowLostLast != null) {
          B.willowLostLast = B.willowLostLast || { red: false, blue: false };
          B.willowLostLast.red = !!savedState.willowLostLast;
        }
      }

      // Clear dice from previous player's turn
      B.redDice = null;
      B.blueDice = null;
      const redDiceEl = document.getElementById('red-dice');
      const blueDiceEl = document.getElementById('blue-dice');
      if (redDiceEl) redDiceEl.innerHTML = '';
      if (blueDiceEl) blueDiceEl.innerHTML = '';
      document.querySelectorAll('.die-physics').forEach(el => el.remove());

      BattleEngine.renderBattle();
    }

    // Hide blue roll button (boss auto-rolls via AI)
    const blueBtn = document.getElementById('rollBlueBtn');
    if (blueBtn) blueBtn.style.display = 'none';

    // Start blue AI + heartbeat (fighter only)
    BattleEngine.startBlueAI();
    RaidSync.startHeartbeat(RaidState.mySlot);

    // Update player status
    RaidSync.setPlayerStatus(RaidState.mySlot, 'fighting');

    // Ensure red roll button is visible and unlocked
    // The 'locked' class may persist from a previous turn because the raid hook
    // consumes resetRollButtons (skipping the default classList.remove('locked')).
    setTimeout(() => {
      if (!RaidState.amFighter()) return;
      const redBtn = document.getElementById('rollRedBtn');
      const B2 = BattleEngine.getState();
      if (redBtn && B2 && B2.phase === 'ready') {
        redBtn.style.display = '';
        redBtn.disabled = false;
        redBtn.classList.remove('locked');
        redBtn.textContent = 'ROLL';
      }
    }, 300);

    // Render boss HP pool bar
    this._ensureBossHpPoolBar();
    renderBossHpPool(RaidState.bossCurrentHp, RaidState.bossMaxHp);

    // Show boss intro on first turn only
    const isFirstTurn = (RaidState.turnCounter || 0) === 0;
    if (isFirstTurn && typeof showBossIntro === 'function') {
      showBossIntro(bossConfig, phase, () => {});
    }
  },

  // ══════════════════════════════════════════════════════════════════
  // SPECTATOR
  // ══════════════════════════════════════════════════════════════════

  _startSpectating() {
    const data = RaidState;
    const currentIdx = data.currentFighterIdx;
    const currentPlayer = data.players[currentIdx];
    if (!currentPlayer || !currentPlayer.team) return;

    const bossConfig = data.bossConfig;
    if (!bossConfig) return;

    // Show raid screen
    const raidScreen = document.getElementById('raid-screen');
    if (raidScreen) raidScreen.style.display = 'block';

    // Build boss team for arena visuals
    const bossTeam = buildBossTeam(bossConfig, 1, data.enrageLevel || 0);
    const blueGhosts = [bossTeam.boss, ...bossTeam.minions].slice(0, 3);

    // Suppress entry abilities for spectator
    window._raidSkipEntry = true;

    // Register boss ghosts in lookup (for getGhost during startBattle)
    this._bossGhostLookup = {};
    blueGhosts.forEach(g => { this._bossGhostLookup[g.id] = g; });

    const S = BattleEngine.getS();
    S.redPicks = currentPlayer.team;
    S.bluePicks = blueGhosts.map(g => g.id);

    // Scoped getGhost patch
    const _origGetGhost = window.getGhost;
    const lookup = this._bossGhostLookup;
    window.getGhost = (id) => lookup[id] || _origGetGhost(id);

    MP_MODE = true;

    BattleEngine.startBattle();

    window.getGhost = _origGetGhost;

    // Stop AI and snapshot sync — spectator is read-only
    BattleEngine.stopBlueAI();

    // Clear skip-entry flag after async entries suppressed
    setTimeout(() => { window._raidSkipEntry = false; }, 6000);

    // Hide roll buttons
    const rollBtn = document.getElementById('rollRedBtn');
    if (rollBtn) rollBtn.style.display = 'none';
    const blueBtn = document.getElementById('rollBlueBtn');
    if (blueBtn) blueBtn.style.display = 'none';

    // Show watching banner
    const narrator = document.getElementById('narrator');
    if (narrator) {
      const name = currentPlayer.displayName || 'Player ' + (currentIdx + 1);
      narrator.innerHTML = `Watching <b class="red-text">${name}</b> fight...`;
    }

    // Boss HP pool bar
    this._ensureBossHpPoolBar();
    renderBossHpPool(data.bossCurrentHp || 0, data.bossMaxHp || 1);
  },

  // ── Spectator view update (from Firebase snapshot) ──────────────
  _updateSpectatorView(snapshot) {
    if (!RaidState.amSpectator()) return;
    const B = BattleEngine.getState();
    if (!B || !B.red || !B.blue) return;
    if (!snapshot) return;

    // Sync ALL ghost HP, KO status, and activeIdx
    if (snapshot.allPlayerGhosts && B.red) {
      snapshot.allPlayerGhosts.forEach((sg, i) => {
        if (B.red.ghosts[i]) {
          B.red.ghosts[i].hp = sg.hp;
          B.red.ghosts[i].maxHp = sg.maxHp;
          B.red.ghosts[i].ko = !!sg.ko;
          if (sg.id) B.red.ghosts[i].id = sg.id;
          if (sg.name) B.red.ghosts[i].name = sg.name;
          if (sg.art) B.red.ghosts[i].art = sg.art;
          if (sg.ability) B.red.ghosts[i].ability = sg.ability;
          if (sg.abilityDesc) B.red.ghosts[i].abilityDesc = sg.abilityDesc;
          if (sg.rarity) B.red.ghosts[i].rarity = sg.rarity;
        }
      });
      if (snapshot.playerActiveIdx != null) B.red.activeIdx = snapshot.playerActiveIdx;
    } else if (snapshot.playerGhost && B.red) {
      const rf = BattleEngine.active(B.red);
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
      if (snapshot.bossActiveIdx != null) B.blue.activeIdx = snapshot.bossActiveIdx;
    } else if (snapshot.bossGhost && B.blue) {
      const bf = BattleEngine.active(B.blue);
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

    // Sync resources
    if (snapshot.playerResources && B.red) {
      B.red.resources = { ...snapshot.playerResources };
    }

    BattleEngine.renderBattle();
  },

  // ══════════════════════════════════════════════════════════════════
  // TURN HANDOFF
  // ══════════════════════════════════════════════════════════════════

  _handleTurnHandoff() {
    BattleEngine.stopBlueAI();
    RaidSync.stopHeartbeat();

    // Force one last snapshot write
    RaidSync._lastSnapshotHash = '';
    const B = BattleEngine.getState();
    if (B) RaidSync.writeBattleSnapshot(B);

    // Hide roll button, show handoff message
    const rollBtn = document.getElementById('rollRedBtn');
    if (rollBtn) rollBtn.style.display = 'none';
    const redDice = document.getElementById('red-dice');
    const blueDice = document.getElementById('blue-dice');
    if (redDice) redDice.innerHTML = '';
    if (blueDice) blueDice.innerHTML = '';
    const narrator = document.getElementById('narrator');
    if (narrator) narrator.innerHTML = 'Passing to the next raider...';

    RaidState.transition('turn-handoff');

    // Advance to next fighter after brief delay (cinematic feel)
    const currentIdx = RaidState.mySlot;
    const nextIdx = (currentIdx + 1) % RaidState.players.length;

    setTimeout(() => {
      RaidSync.advanceTurn(B, currentIdx, nextIdx, RaidState.players.length);
    }, 1500);
  },

  // ══════════════════════════════════════════════════════════════════
  // GAME OVER
  // ══════════════════════════════════════════════════════════════════

  _handleRaidGameOver(winner) {
    BattleEngine.stopBlueAI();
    RaidSync.stopHeartbeat();

    const B = BattleEngine.getState();
    const currentIdx = RaidState.mySlot;
    const playerCount = RaidState.players.length;

    const gameOverEl = document.getElementById('gameOver');
    if (gameOverEl) { gameOverEl.style.display = 'none'; gameOverEl.innerHTML = ''; }

    // ── CASE 1: Player eliminated ────────────────────────────────
    if (winner === 'blue') {
      const otherPlayersAlive = RaidState.players.some((p, i) =>
        i !== currentIdx && p && p.status !== 'done' && p.status !== 'disconnected'
      );
      if (otherPlayersAlive) {
        setTimeout(() => { RaidSync.writeGameOver(B, winner, currentIdx, playerCount); }, 1500);
        const narrator = document.getElementById('narrator');
        if (narrator) narrator.innerHTML = 'Your team is out! Watching the raid continue...';
        return;
      }
    }

    // ── CASE 2: Raid truly over ──────────────────────────────────
    setTimeout(() => { RaidSync.writeGameOver(B, winner, currentIdx, playerCount); }, 1500);
    setTimeout(() => {
      if (RaidState.phase !== 'complete') {
        if (['fighting', 'spectating', 'turn-handoff'].includes(RaidState.phase)) {
          RaidState.transition('complete');
        }
      }
    }, 6500);
  },

  // ══════════════════════════════════════════════════════════════════
  // RESULTS
  // ══════════════════════════════════════════════════════════════════

  _showResults() {
    if (typeof hideRaidSpectatorOverlay === 'function') hideRaidSpectatorOverlay();
    if (typeof hideRaidWaitingRoom === 'function') hideRaidWaitingRoom();

    // Hide battle overlays that could block the result screen
    const gameOverEl = document.getElementById('gameOver');
    if (gameOverEl) { gameOverEl.style.display = 'none'; gameOverEl.innerHTML = ''; }
    const battleView = document.getElementById('battle-view');
    if (battleView) battleView.style.display = 'none';

    // Make sure raid screen is visible (result renders inside it)
    const raidScreenCheck = document.getElementById('raid-screen');
    if (raidScreenCheck) raidScreenCheck.style.display = 'block';

    // Show result screen if we have the UI function
    if (typeof showRaidResult === 'function') {
      showRaidResult({
        ...RaidState,
        bossDefeatedBy: null, // will be in Firebase data
        players: RaidState.players
      });
    } else {
      // Simple result overlay for spectators
      const raidScreen = document.getElementById('raid-screen');
      if (!raidScreen || raidScreen.style.display === 'none') return;
      const existing = document.getElementById('gameOver');
      if (existing && existing.style.display !== 'none' && existing.innerHTML) return;

      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.85);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;';
      overlay.innerHTML = `
        <h1 style="font-family:Creepster,cursive;font-size:2.5rem;color:#2ecc71;letter-spacing:4px;">RAID COMPLETE</h1>
        <p style="color:var(--text2);font-size:1.1rem;">The raid has ended.</p>
        <button style="background:linear-gradient(135deg,#9b59b6,#8e44ad);color:#fff;border:1px solid #c084fc;padding:12px 32px;font-size:1rem;font-weight:700;border-radius:8px;cursor:pointer;letter-spacing:1px;text-transform:uppercase;"
          onclick="this.parentElement.remove(); RaidBattleAdapter._returnToLobby();">
          RETURN TO LOBBY
        </button>`;
      document.body.appendChild(overlay);
    }
  },

  // ══════════════════════════════════════════════════════════════════
  // CLEANUP
  // ══════════════════════════════════════════════════════════════════

  _cleanup() {
    BattleEngine.stopBlueAI();
    RaidSync.stopHeartbeat();
    RaidSync.disconnect();

    // Reset process tracking
    this._lastProcessedTurn = -1;
    this._lastProcessedCounter = -1;
    this._bossGhostLookup = {};

    // Hide raid screen
    const raidScreen = document.getElementById('raid-screen');
    if (raidScreen) raidScreen.style.display = 'none';
    const battleView = document.getElementById('battle-view');
    if (battleView) battleView.style.display = 'none';

    // Remove boss HP pool bar
    const poolBar = document.getElementById('raid-boss-pool');
    if (poolBar) poolBar.remove();

    // Restore blue roll button
    const blueBtn = document.getElementById('rollBlueBtn');
    if (blueBtn) blueBtn.style.display = '';

    // Hide game-over overlay
    const gameOverEl = document.getElementById('gameOver');
    if (gameOverEl) {
      gameOverEl.style.display = 'none';
      gameOverEl.classList.remove('active');
      gameOverEl.innerHTML = '';
    }

    // Clear battle state
    const S = BattleEngine.getS();
    S.redPicks = [];
    S.bluePicks = [];
    BattleEngine.setState(null);

    // Show main content
    if (typeof hideRaidScreen === 'function') {
      hideRaidScreen();
    } else {
      const mc = document.getElementById('main-content');
      if (mc) mc.style.display = '';
    }

    window._raidSkipEntry = false;
    MP_MODE = false;
  },

  _returnToLobby() {
    this._cleanup();
    RaidSync.clearActiveRaid();
    RaidState.reset();
    if (typeof showRaidLobby === 'function') showRaidLobby();
    if (typeof closeRaidResult === 'function') closeRaidResult();
  },

  // ══════════════════════════════════════════════════════════════════
  // BOSS HP POOL BAR (extracted from bridge)
  // ══════════════════════════════════════════════════════════════════

  _ensureBossHpPoolBar() {
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
    target.insertBefore(bar, target.firstChild);
  }
};

// ── renderBossHpPool (global, used by adapter and raid-ui) ────────
function renderBossHpPool(bossHp, bossMaxHp) {
  const fill = document.getElementById('raid-boss-fill');
  const text = document.getElementById('raid-boss-text');
  if (!fill || !text) return;

  const hp  = Math.max(0, bossHp);
  const max = Math.max(1, bossMaxHp);
  const pct = (hp / max) * 100;

  fill.style.width = pct + '%';

  if (pct > 75)      fill.style.background = '#2ecc71';
  else if (pct > 50) fill.style.background = '#f1c40f';
  else if (pct > 25) fill.style.background = '#e74c3c';
  else               fill.style.background = '#9b59b6';

  text.textContent = 'BOSS HP: ' + hp + ' / ' + max;
}

// ── Backward-compat aliases (called from index.html) ──────────────
function cleanupRaidBattle() { RaidBattleAdapter._returnToLobby(); }
function cleanupRaid() { RaidBattleAdapter._cleanup(); RaidState.reset(); }
