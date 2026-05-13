// ═══════════════════════════════════════════════════════════════
//  PVP & CO-OP BATTLE SYSTEM
//  Extends existing Firebase patterns (party invites, raid manager)
//  to enable real-time player-vs-player and co-op boss battles.
//
//  Firebase paths:
//    pvp_challenges/{targetId}/{challengeId}  — challenge requests
//    pvp_matches/{matchId}/state              — shared battle state
//    pvp_matches/{matchId}/actions            — turn log
//
//  Two modes:
//    1. PVP — Player vs Player, alternating turns
//    2. COOP — Party vs Boss, players alternate against same enemy
// ═══════════════════════════════════════════════════════════════

const PvPManager = (() => {
  'use strict';

  let _matchListener = null;
  let _challengeListener = null;
  let _currentMatch = null;

  // ── CHALLENGE FLOW ─────────────────────────────────────────

  /**
   * Send a PvP challenge to another player.
   * @param {string} targetId - The target player's ID
   * @param {string} targetName - Display name
   * @param {string} mode - 'pvp' or 'coop'
   */
  function sendChallenge(targetId, targetName, mode) {
    if (typeof db === 'undefined' || db._stub) return;
    if (!G.playerId) return;

    const challengeId = G.playerId + '_' + Date.now().toString(36);
    const challengeData = {
      from: G.name || 'Unknown',
      fromId: G.playerId,
      level: G.level,
      mode: mode || 'pvp',
      team: G.team.map(g => g.id),
      timestamp: firebase.database.ServerValue.TIMESTAMP,
    };

    db.ref(`pvp_challenges/${targetId}/${challengeId}`).set(challengeData);

    // Listen for acceptance
    db.ref(`pvp_matches/${challengeId}/state`).on('value', (snap) => {
      const state = snap.val();
      if (state && state.status === 'accepted') {
        // Both players ready — start the battle
        db.ref(`pvp_matches/${challengeId}/state`).off();
        _startMatchAsChallenger(challengeId, state, mode);
      }
    });

    return challengeId;
  }

  /**
   * Start listening for incoming PvP challenges.
   * Call once when WorldScene loads.
   */
  function listenForChallenges(scene) {
    if (typeof db === 'undefined' || db._stub) return;
    if (!G.playerId) return;

    // Clean up old listener
    if (_challengeListener) {
      db.ref(`pvp_challenges/${G.playerId}`).off('child_added', _challengeListener);
    }

    _challengeListener = db.ref(`pvp_challenges/${G.playerId}`).on('child_added', (snap) => {
      const challenge = snap.val();
      if (!challenge || !challenge.fromId) return;

      // Ignore stale challenges (>30s old)
      if (challenge.timestamp && Date.now() - challenge.timestamp > 30000) {
        snap.ref.remove();
        return;
      }

      _showChallengePopup(scene, snap.key, challenge);
    });
  }

  /**
   * Show incoming challenge popup on screen.
   */
  function _showChallengePopup(scene, challengeId, challenge) {
    const modeLabel = challenge.mode === 'coop' ? 'Co-op Battle' : 'PvP Challenge';
    const msg = `${challenge.from} (Lv${challenge.level}) wants a ${modeLabel}!`;

    // Use scene's panel system if available
    if (scene.panels && scene.panels.open) {
      scene.panels.open(`${modeLabel}!`, (container, w) => {
        let y = 10;

        container.add(scene.add.text(w / 2, y, msg, {
          fontSize: '13px', fontFamily: 'Georgia, serif', color: '#f4ecd8',
          wordWrap: { width: w - 30 },
        }).setOrigin(0.5).setScrollFactor(0));
        y += 40;

        // Accept button
        const accBg = scene.add.rectangle(w / 2 - 50, y, 80, 32, 0x228844, 0.9)
          .setStrokeStyle(1, 0x44cc66).setInteractive({ useHandCursor: true }).setScrollFactor(0);
        container.add(accBg);
        container.add(scene.add.text(w / 2 - 50, y, 'ACCEPT', {
          fontSize: '13px', fontFamily: 'Cinzel, serif', fontStyle: 'bold', color: '#88ff88',
        }).setOrigin(0.5).setScrollFactor(0));
        accBg.on('pointerdown', () => {
          scene.panels.close();
          _acceptChallenge(scene, challengeId, challenge);
        });

        // Decline button
        const decBg = scene.add.rectangle(w / 2 + 50, y, 80, 32, 0x882222, 0.9)
          .setStrokeStyle(1, 0xcc4444).setInteractive({ useHandCursor: true }).setScrollFactor(0);
        container.add(decBg);
        container.add(scene.add.text(w / 2 + 50, y, 'DECLINE', {
          fontSize: '13px', fontFamily: 'Cinzel, serif', fontStyle: 'bold', color: '#ff8888',
        }).setOrigin(0.5).setScrollFactor(0));
        decBg.on('pointerdown', () => {
          scene.panels.close();
          db.ref(`pvp_challenges/${G.playerId}/${challengeId}`).remove();
        });
      }, { width: 340, height: 100 });
    }

    // Auto-dismiss after 15s
    setTimeout(() => {
      db.ref(`pvp_challenges/${G.playerId}/${challengeId}`).remove();
    }, 15000);
  }

  // ── ACCEPT & MATCH CREATION ────────────────────────────────

  function _acceptChallenge(scene, challengeId, challenge) {
    // Clean up the challenge request
    db.ref(`pvp_challenges/${G.playerId}/${challengeId}`).remove();

    const mode = challenge.mode || 'pvp';
    const playerIds = G.team.map(g => g.id);

    // Create match state in Firebase
    const matchState = {
      status: 'accepted',
      mode: mode,
      red: {
        playerId: challenge.fromId,
        name: challenge.from,
        team: challenge.team,
      },
      blue: {
        playerId: G.playerId,
        name: G.name,
        team: playerIds,
      },
      turn: 'red', // Red (challenger) goes first
      round: 1,
      started: firebase.database.ServerValue.TIMESTAMP,
    };

    db.ref(`pvp_matches/${challengeId}/state`).set(matchState);

    // Start the battle as the acceptor (blue team)
    _startMatchAsAcceptor(scene, challengeId, matchState, mode);
  }

  // ── MATCH LIFECYCLE ────────────────────────────────────────

  function _startMatchAsChallenger(challengeId, matchState, mode) {
    _currentMatch = {
      id: challengeId,
      role: 'red', // Challenger is always red
      mode: mode,
      opponentName: matchState.blue.name,
    };

    // Init battle with challenger as red
    const playerIds = G.team.map(g => g.id);
    const enemyIds = matchState.blue.team;

    if (typeof initBattle === 'function') {
      initBattle(playerIds, enemyIds, {
        type: mode === 'coop' ? 'coop' : 'pvp',
        trainerName: matchState.blue.name,
        pvpMatchId: challengeId,
      });
    }

    G.inBattle = true;

    // Get the world scene and launch battle
    const worldScene = window.game?.scene?.getScene('WorldScene');
    if (worldScene) {
      worldScene.cameras.main.fadeOut(300, 0, 0, 0);
      worldScene.time.delayedCall(300, () => {
        worldScene.scene.launch('BattleScene', {
          trainerName: matchState.blue.name,
          pvpMatchId: challengeId,
          pvpRole: 'red',
          pvpMode: mode,
        });
        worldScene.scene.pause();
      });
    }

    // Listen for opponent's actions
    _listenForActions(challengeId);
  }

  function _startMatchAsAcceptor(scene, challengeId, matchState, mode) {
    _currentMatch = {
      id: challengeId,
      role: 'blue', // Acceptor is always blue
      mode: mode,
      opponentName: matchState.red.name,
    };

    // Init battle with acceptor as red (local player is always "red" locally)
    // but we track the PvP role separately
    const playerIds = G.team.map(g => g.id);
    const enemyIds = matchState.red.team;

    if (typeof initBattle === 'function') {
      initBattle(playerIds, enemyIds, {
        type: mode === 'coop' ? 'coop' : 'pvp',
        trainerName: matchState.red.name,
        pvpMatchId: challengeId,
      });
    }

    G.inBattle = true;

    scene.cameras.main.fadeOut(300, 0, 0, 0);
    scene.time.delayedCall(300, () => {
      scene.scene.launch('BattleScene', {
        trainerName: matchState.red.name,
        pvpMatchId: challengeId,
        pvpRole: 'blue',
        pvpMode: mode,
      });
      scene.scene.pause();
    });

    // Listen for opponent's actions
    _listenForActions(challengeId);
  }

  // ── TURN SYNC ──────────────────────────────────────────────

  /**
   * Report a completed turn action to Firebase.
   * Called by BattleScene after each round resolves.
   */
  function reportAction(action) {
    if (!_currentMatch) return;
    const matchId = _currentMatch.id;

    // Push action to the match feed
    const actionData = {
      role: _currentMatch.role,
      playerId: G.playerId,
      name: G.name,
      type: action.type, // 'roll', 'ko_swap', 'willpower', 'end'
      data: action.data || {},
      timestamp: firebase.database.ServerValue.TIMESTAMP,
    };

    db.ref(`pvp_matches/${matchId}/actions`).push(actionData);

    // Update turn state
    if (action.type === 'roll' || action.type === 'end') {
      const nextTurn = _currentMatch.role === 'red' ? 'blue' : 'red';
      db.ref(`pvp_matches/${matchId}/state/turn`).set(nextTurn);
    }
  }

  /**
   * Listen for opponent's actions via Firebase.
   */
  function _listenForActions(matchId) {
    if (_matchListener) {
      db.ref(`pvp_matches/${matchId}/actions`).off('child_added', _matchListener);
    }

    _matchListener = db.ref(`pvp_matches/${matchId}/actions`)
      .orderByChild('timestamp')
      .limitToLast(1)
      .on('child_added', (snap) => {
        const action = snap.val();
        if (!action) return;

        // Only process opponent's actions
        if (action.role === _currentMatch.role) return;

        // Notify the battle scene
        if (typeof window._onPvPAction === 'function') {
          window._onPvPAction(action);
        }
      });
  }

  // ── CO-OP TURN ALTERNATION ─────────────────────────────────
  // In co-op mode, both players fight the SAME boss.
  // Player 1 attacks → boss takes damage → Player 2 attacks → etc.
  // Uses raid-style atomic HP updates.

  /**
   * Report co-op damage to shared boss HP.
   * Uses Firebase transaction for atomicity (same as RaidManager).
   */
  function reportCoopDamage(matchId, damage, diceResult) {
    if (typeof db === 'undefined' || db._stub) return;

    // Atomic boss HP decrement
    db.ref(`pvp_matches/${matchId}/state/bossHp`).transaction((currentHp) => {
      if (currentHp === null) return currentHp;
      return Math.max(0, currentHp - damage);
    });

    // Log to feed
    db.ref(`pvp_matches/${matchId}/actions`).push({
      role: _currentMatch ? _currentMatch.role : 'unknown',
      playerId: G.playerId,
      name: G.name,
      type: 'coop_damage',
      data: { damage, dice: diceResult },
      timestamp: firebase.database.ServerValue.TIMESTAMP,
    });

    // Pass turn
    if (_currentMatch) {
      const nextTurn = _currentMatch.role === 'red' ? 'blue' : 'red';
      db.ref(`pvp_matches/${matchId}/state/turn`).set(nextTurn);
    }
  }

  // ── MATCH STATE QUERIES ────────────────────────────────────

  /** Check if it's the local player's turn */
  function isMyTurn(callback) {
    if (!_currentMatch) { callback(true); return; }
    db.ref(`pvp_matches/${_currentMatch.id}/state/turn`).once('value', (snap) => {
      callback(snap.val() === _currentMatch.role);
    });
  }

  /** Get current match info */
  function getCurrentMatch() {
    return _currentMatch;
  }

  /** Check if we're in a PvP/co-op match */
  function isInMatch() {
    return _currentMatch !== null;
  }

  // ── CLEANUP ────────────────────────────────────────────────

  function endMatch() {
    if (!_currentMatch) return;
    const matchId = _currentMatch.id;

    // Report match end
    db.ref(`pvp_matches/${matchId}/state/status`).set('finished');

    // Clean up listeners
    if (_matchListener) {
      db.ref(`pvp_matches/${matchId}/actions`).off('child_added', _matchListener);
      _matchListener = null;
    }

    _currentMatch = null;
  }

  function stopListening() {
    if (_challengeListener) {
      db.ref(`pvp_challenges/${G.playerId}`).off('child_added', _challengeListener);
      _challengeListener = null;
    }
    endMatch();
  }

  // ── PUBLIC API ─────────────────────────────────────────────
  return {
    sendChallenge,
    listenForChallenges,
    reportAction,
    reportCoopDamage,
    isMyTurn,
    getCurrentMatch,
    isInMatch,
    endMatch,
    stopListening,
  };
})();
