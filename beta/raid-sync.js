// =================================================================
// RAID SYNC — Firebase sync layer for raids
// Replaces: snapshot polling (500ms setInterval), scattered Firebase writes
// Event-driven writes at meaningful moments, not polling.
// Depends on: raid-state-machine.js (RaidState), Firebase (db)
// =================================================================

const RaidSync = {
  _instanceRef: null,
  _listeners: {},
  _lastSnapshotHash: '',

  // ── Connect to a raid instance ──────────────────────────────────
  connect(instanceId) {
    this.disconnect();
    this._instanceRef = db.ref(`mp/raids/instances/${instanceId}`);
    this._lastSnapshotHash = '';

    // Single listener on the full instance — no more races between
    // status/fighterIdx/battleState like the old 3-listener system
    this._listeners.instance = this._instanceRef.on('value', (snap) => {
      const data = snap.val();
      if (!data) return;
      RaidState._emit('firebase-update', { instanceId, data });
    });

    console.log('[RaidSync] Connected to instance:', instanceId);
  },

  // ── Disconnect all listeners ───────────────────────────────────
  disconnect() {
    if (this._instanceRef) {
      if (this._listeners.instance) {
        this._instanceRef.off('value', this._listeners.instance);
      }
      this._instanceRef = null;
    }
    this._listeners = {};
    this._lastSnapshotHash = '';
    console.log('[RaidSync] Disconnected');
  },

  // ── Write battle snapshot (fighter only, event-driven) ──────────
  // Called at meaningful moments: after resolveRound, after KO swap,
  // after resource commits. NOT on a timer.
  writeBattleSnapshot(B) {
    if (!RaidState.amFighter() || !B || !this._instanceRef) return;

    const hash = this._computeHash(B);
    if (hash === this._lastSnapshotHash) return;
    this._lastSnapshotHash = hash;

    const snapshot = this._serializeSnapshot(B);
    this._instanceRef.child('battleState').set(snapshot)
      .catch(e => console.warn('[RaidSync] Snapshot write error:', e));
  },

  // ── Atomic turn handoff ─────────────────────────────────────────
  // Writes player ghost state + boss state + advances fighter index
  // in a single Firebase update (no race conditions)
  async advanceTurn(B, currentIdx, nextIdx, playerCount) {
    if (!this._instanceRef) return;

    const user = firebase.auth().currentUser;
    const savedPlayerState = this._serializePlayerState(B);
    const savedBossState = this._serializeBossState(B);

    const poolNow = Math.max(0, RaidState.bossCurrentHp || 0);

    const prevTurnCounter = RaidState.turnCounter || 0;

    const update = {
      currentFighterIdx: nextIdx,
      currentFighterUid: RaidState.players[nextIdx]?.uid || null,
      fightPhase: 'fighting',
      bossCurrentHp: poolNow,
      bossGhostState: savedBossState,
      turnCounter: prevTurnCounter + 1
    };

    if (user && savedPlayerState.ghosts.length > 0) {
      update[`playerGhostState/${user.uid}`] = savedPlayerState;
    }

    try {
      await this._instanceRef.update(update);
      console.log('[RaidSync] Turn advanced to player', nextIdx, '| Boss pool HP:', poolNow, '/', RaidState.bossMaxHp);
    } catch (e) {
      console.error('[RaidSync] Turn handoff write FAILED:', e);
    }
  },

  // ── Atomic game-over write ──────────────────────────────────────
  async writeGameOver(B, winner, currentIdx, playerCount) {
    if (!this._instanceRef) return;

    const user = firebase.auth().currentUser;
    const savedPlayerState = this._serializePlayerState(B);
    const savedBossState = this._serializeBossState(B);

    const poolNow = Math.max(0, RaidState.bossCurrentHp || 0);

    const ghostsLost = B ? B.red.ghosts.filter(g => g.ko).length : 0;
    let totalDamage = 0;
    if (B && B.blue) {
      B.blue.ghosts.forEach(g => {
        if (g) totalDamage += Math.max(0, g.maxHp - (g.ko ? 0 : g.hp));
      });
    }

    // Find next ALIVE player (wrapping around), skipping done/disconnected
    let nextIdx = -1;
    for (let i = 1; i < playerCount; i++) {
      const candidate = (currentIdx + i) % playerCount;
      const p = RaidState.players[candidate];
      if (p && p.status !== 'done' && p.status !== 'disconnected') {
        nextIdx = candidate;
        break;
      }
    }

    const update = {
      bossCurrentHp: poolNow,
      bossGhostState: savedBossState,
      [`players/${currentIdx}/status`]: 'done',
      [`players/${currentIdx}/damageDealt`]: totalDamage,
      [`players/${currentIdx}/ghostsLost`]: ghostsLost
    };

    if (user) {
      update[`playerGhostState/${user.uid}`] = savedPlayerState;
    }

    const raidComplete = poolNow <= 0 || nextIdx === -1;

    if (raidComplete) {
      update.status = 'complete';
      update.completedAt = firebase.database.ServerValue.TIMESTAMP;
      update.bossDefeatedBy = poolNow <= 0 ? (user?.uid || null) : null;
      update.fightPhase = 'done';
    } else {
      update.currentFighterIdx = nextIdx;
      update.currentFighterUid = RaidState.players[nextIdx]?.uid || null;
      update.fightPhase = 'fighting';
      update.enrageLevel = firebase.database.ServerValue.increment(1);
    }

    try {
      await this._instanceRef.update(update);
      console.log('[RaidSync] Game over processed. Winner:', winner, '| Pool HP:', poolNow, '| Complete:', raidComplete);

      if (raidComplete) {
        try {
          if (typeof distributeRaidRewards === 'function') {
            await distributeRaidRewards(RaidState.instanceId, poolNow <= 0, poolNow <= 0 ? user?.uid : null);
          }
        } catch (rewardErr) {
          console.error('[RaidSync] Reward distribution failed (non-fatal):', rewardErr);
        }
      }
    } catch (e) {
      console.error('[RaidSync] Game-over write error:', e);
    }
  },

  // ── Update player status in Firebase ────────────────────────────
  async setPlayerStatus(slotIdx, status) {
    if (!this._instanceRef) return;
    await this._instanceRef.child(`players/${slotIdx}/status`).set(status);
  },

  // ── Start the raid (transition from countdown to active) ────────
  async startRaid() {
    if (!this._instanceRef) return;
    await this._instanceRef.update({
      status: 'active',
      startedAt: firebase.database.ServerValue.TIMESTAMP,
      fightPhase: 'fighting'
    });
  },

  // ── Heartbeat ───────────────────────────────────────────────────
  _heartbeatTimer: null,

  startHeartbeat(slotIdx) {
    this.stopHeartbeat();
    this._heartbeatTimer = setInterval(() => {
      if (this._instanceRef) {
        this._instanceRef.child(`players/${slotIdx}/lastHeartbeat`)
          .set(firebase.database.ServerValue.TIMESTAMP);
      }
    }, 5000);
  },

  stopHeartbeat() {
    if (this._heartbeatTimer) {
      clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = null;
    }
  },

  // ── Queue operations ────────────────────────────────────────────
  _queueListeners: {},

  async joinQueue(raidId, team) {
    const user = firebase.auth().currentUser;
    if (!user) return { error: 'Not signed in' };
    if (!team || team.length !== 3) return { error: 'Must select 3 ghosts' };

    const bossConfig = RAID_BOSSES[raidId];
    if (!bossConfig) return { error: 'Unknown raid' };

    // Badge check
    if (bossConfig.requiredBadge) {
      const snap = await db.ref(`mp/users/${user.uid}/raidBadges`).once('value');
      const badges = snap.val() || [];
      if (!badges.includes(bossConfig.requiredBadge)) {
        return { error: 'Missing required badge: ' + (RAID_BADGES[bossConfig.requiredBadge]?.name || bossConfig.requiredBadge) };
      }
    }

    await db.ref(`mp/raids/queue/${raidId}/${user.uid}`).set({
      displayName: user.displayName || 'Raider',
      team: team,
      joinedAt: firebase.database.ServerValue.TIMESTAMP
    });

    this.startQueueListener(raidId);
    return { success: true };
  },

  async leaveQueue(raidId) {
    const user = firebase.auth().currentUser;
    if (!user) return;
    await db.ref(`mp/raids/queue/${raidId}/${user.uid}`).remove();
    this.stopQueueListener(raidId);
  },

  startQueueListener(raidId) {
    if (this._queueListeners[raidId]) return;

    const queueRef = db.ref(`mp/raids/queue/${raidId}`);
    this._queueListeners[raidId] = queueRef.on('value', async (snap) => {
      const queue = snap.val();
      if (!queue) {
        if (typeof updateRaidQueueUI === 'function') updateRaidQueueUI(raidId, []);
        // Failsafe: check if we got assigned to a raid
        const user = firebase.auth().currentUser;
        if (user && RaidState.phase === 'idle') {
          const activeSnap = await db.ref(`mp/users/${user.uid}/activeRaid`).once('value');
          const activeId = activeSnap.val();
          if (activeId) {
            const instSnap = await db.ref(`mp/raids/instances/${activeId}`).once('value');
            const inst = instSnap.val();
            if (inst && inst.status !== 'complete' && inst.status !== 'abandoned') {
              console.log('[RaidSync] Queue cleared — entering raid:', activeId);
              RaidState._emit('raid-assigned', { instanceId: activeId, data: inst });
            }
          }
        }
        return;
      }

      const entries = Object.entries(queue)
        .map(([uid, data]) => ({ uid, ...data }))
        .sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));

      if (typeof updateRaidQueueUI === 'function') {
        updateRaidQueueUI(raidId, entries);
      }
    });
  },

  stopQueueListener(raidId) {
    if (this._queueListeners[raidId]) {
      db.ref(`mp/raids/queue/${raidId}`).off('value', this._queueListeners[raidId]);
      delete this._queueListeners[raidId];
    }
  },

  stopAllQueueListeners() {
    for (const raidId of Object.keys(this._queueListeners)) {
      this.stopQueueListener(raidId);
    }
  },

  // ── Instance creation ───────────────────────────────────────────
  async startRaidManually(raidId) {
    const queueSnap = await db.ref(`mp/raids/queue/${raidId}`).once('value');
    const queue = queueSnap.val();
    if (!queue) return { error: 'Queue is empty' };

    const entries = Object.entries(queue)
      .map(([uid, data]) => ({ uid, ...data }))
      .sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));

    const bossConfig = RAID_BOSSES[raidId];
    const minPlayers = bossConfig?.minPlayers || 1;
    const maxPlayers = bossConfig?.requiredPlayers || 10;

    if (entries.length < minPlayers) {
      return { error: `Need at least ${minPlayers} players to start` };
    }

    await this._createInstance(raidId, entries.slice(0, maxPlayers));
    return { success: true };
  },

  async _createInstance(raidId, players) {
    const user = firebase.auth().currentUser;
    if (!user) return;

    const bossConfig = RAID_BOSSES[raidId];
    const queueRef = db.ref(`mp/raids/queue/${raidId}`);

    // Transaction: clear queue atomically
    const result = await queueRef.transaction((currentQueue) => {
      if (!currentQueue) return currentQueue;
      const entries = Object.entries(currentQueue)
        .map(([uid, data]) => ({ uid, ...data }));
      if (entries.length < (bossConfig?.minPlayers || 1)) return;
      return null; // clear the queue
    });

    if (!result.committed) return;

    const playerCount = players.length;
    // HP SCALING DISABLED 2026-06-02 (Wyatt) — see matching note in
    // raid-engine.js tryCreateRaidInstance. Boss pool = base ghost maxHp, flat
    // per player count, so the damage tracker is 1:1 with real damage. This is
    // the SECOND creation path; both must stay in sync.
    const scaledHp = bossConfig.bossGhost.maxHp;

    const instanceRef = db.ref('mp/raids/instances').push();
    const instanceId = instanceRef.key;

    const playerSlots = {};
    players.forEach((p, idx) => {
      playerSlots[idx] = {
        uid: p.uid,
        displayName: p.displayName,
        team: p.team,
        status: 'registered',
        damageDealt: 0,
        ghostsLost: 0,
        joinedAt: p.joinedAt,
        lastHeartbeat: firebase.database.ServerValue.TIMESTAMP
      };
    });

    await instanceRef.set({
      raidId: raidId,
      bossId: bossConfig.bossGhost.id,
      bossName: bossConfig.name,
      bossPersonality: bossConfig.personality,
      bossMaxHp: scaledHp,
      bossCurrentHp: scaledHp,
      tier: bossConfig.tier,
      status: 'countdown',
      created: firebase.database.ServerValue.TIMESTAMP,
      startedAt: null,
      completedAt: null,
      currentFighterIdx: 0,
      currentFighterUid: players[0].uid,
      fightPhase: 'countdown',
      bossDefeatedBy: null,
      totalDamageDealt: 0,
      enrageLevel: 0,
      turnCounter: 0,
      players: playerSlots,
      battleState: null
    });

    // Set activeRaid flag for all players
    const updates = {};
    players.forEach(p => {
      updates[`mp/users/${p.uid}/activeRaid`] = instanceId;
    });
    await db.ref().update(updates);
  },

  // ── Active raid listener (auto-load into raids) ─────────────────
  _activeRaidListener: null,

  startActiveRaidListener() {
    const user = firebase.auth().currentUser;
    if (!user) return;

    // Don't auto-enter if returning from a raid
    const params = new URLSearchParams(window.location.search);
    if (params.get('raidResult') || window._raidResultPending) return;

    let justCompleted = sessionStorage.getItem('raidJustCompleted');
    sessionStorage.removeItem('raidJustCompleted');

    console.log('[RaidSync] activeRaid listener registered for', user.uid);
    this._activeRaidListener = db.ref(`mp/users/${user.uid}/activeRaid`).on('value', async (snap) => {
      const instanceId = snap.val();
      console.log('[RaidSync] activeRaid changed:', instanceId);

      if (!instanceId) {
        if (RaidState.isActive()) {
          RaidState._emit('raid-cleared', {});
        }
        return;
      }

      // One-time gate for stale sessions
      if (justCompleted) {
        justCompleted = null;
        await db.ref(`mp/users/${user.uid}/activeRaid`).remove();
        return;
      }

      // Load instance data
      const instSnap = await db.ref(`mp/raids/instances/${instanceId}`).once('value');
      const instance = instSnap.val();
      if (!instance || instance.status === 'complete' || instance.status === 'abandoned') {
        await db.ref(`mp/users/${user.uid}/activeRaid`).remove();
        return;
      }

      RaidState._emit('raid-assigned', { instanceId, data: instance });
    });
  },

  stopActiveRaidListener() {
    const user = firebase.auth().currentUser;
    if (user && this._activeRaidListener) {
      db.ref(`mp/users/${user.uid}/activeRaid`).off('value', this._activeRaidListener);
      this._activeRaidListener = null;
    }
  },

  // ── Stale cleanup ───────────────────────────────────────────────
  async cleanupStaleRaids() {
    const now = Date.now();
    const serverOffset = window._serverTimeOffset || 0;
    const serverNow = now + serverOffset;
    const STALE_INSTANCE_MS = 60 * 60 * 1000;
    const STALE_QUEUE_MS = 30 * 60 * 1000;

    // Clean stale instances
    const instSnap = await db.ref('mp/raids/instances').orderByChild('status').equalTo('active').once('value');
    const instances = instSnap.val() || {};
    for (const [id, inst] of Object.entries(instances)) {
      if (inst.startedAt && (serverNow - inst.startedAt) > STALE_INSTANCE_MS) {
        await db.ref(`mp/raids/instances/${id}/status`).set('abandoned');
        if (inst.players) {
          const updates = {};
          Object.values(inst.players).forEach(p => {
            updates[`mp/users/${p.uid}/activeRaid`] = null;
          });
          await db.ref().update(updates);
        }
      }
    }

    // Clean stale queue entries
    if (typeof RAID_BOSSES !== 'undefined') {
      for (const raidId of Object.keys(RAID_BOSSES)) {
        const qSnap = await db.ref(`mp/raids/queue/${raidId}`).once('value');
        const queue = qSnap.val() || {};
        for (const [uid, entry] of Object.entries(queue)) {
          if (entry.joinedAt && (serverNow - entry.joinedAt) > STALE_QUEUE_MS) {
            await db.ref(`mp/raids/queue/${raidId}/${uid}`).remove();
          }
        }
      }
    }
  },

  // ── Clear active raid flag ──────────────────────────────────────
  async clearActiveRaid() {
    const user = firebase.auth().currentUser;
    if (user) {
      await db.ref(`mp/users/${user.uid}/activeRaid`).remove();
    }
  },

  // ── Init (called once at app startup) ───────────────────────────
  async init() {
    if (window._raidResultPending) return;

    // Clear stale activeRaid before starting listeners
    const user = firebase.auth().currentUser;
    if (user) {
      const arSnap = await db.ref(`mp/users/${user.uid}/activeRaid`).once('value');
      const activeId = arSnap.val();
      if (activeId) {
        const instSnap = await db.ref(`mp/raids/instances/${activeId}/status`).once('value');
        const status = instSnap.val();
        if (!status || status === 'complete' || status === 'abandoned') {
          await db.ref(`mp/users/${user.uid}/activeRaid`).remove();
          console.log('[RaidSync] Cleared stale activeRaid:', activeId);
        }
      }
    }

    this.startActiveRaidListener();
    this.cleanupStaleRaids();
  },

  // ══════════════════════════════════════════════════════════════════
  // SERIALIZATION HELPERS
  // ══════════════════════════════════════════════════════════════════

  // Hash B state to detect changes (only write when something changed)
  _computeHash(B) {
    if (!B) return '';
    const rf = typeof active === 'function' ? active(B.red) : null;
    const bf = typeof active === 'function' ? active(B.blue) : null;
    return [
      rf?.hp, rf?.name, rf?.ko,
      bf?.hp, bf?.name, bf?.ko,
      B.red?.activeIdx, B.blue?.activeIdx,
      B.round, B.phase,
      (B.redDice || []).join(','),
      (B.blueDice || []).join(','),
      B.red?.ghosts?.map(g => g.hp + '/' + (g.ko ? 'K' : '')).join(','),
      B.blue?.ghosts?.map(g => g.hp + '/' + (g.ko ? 'K' : '')).join(',')
    ].join('|');
  },

  // Serialize full snapshot for spectators
  _serializeSnapshot(B) {
    const rf = typeof active === 'function' ? active(B.red) : null;
    const bf = typeof active === 'function' ? active(B.blue) : null;

    const redDice = (B.redDice || []).map(d => d || 0);
    const blueDice = (B.blueDice || []).map(d => d || 0);

    const allPlayerGhosts = B.red ? B.red.ghosts.map(g => ({
      name: g.name || '???', hp: g.hp || 0, maxHp: g.maxHp || 1,
      ko: !!g.ko, art: g.art || '', id: g.id || 0,
      ability: g.ability || '', abilityDesc: g.abilityDesc || '', rarity: g.rarity || 'common'
    })) : [];

    const allBossGhosts = B.blue ? B.blue.ghosts.map(g => ({
      name: g.name || '???', hp: g.hp || 0, maxHp: g.maxHp || 1,
      ko: !!g.ko, art: g.art || '', id: g.id || 0,
      ability: g.ability || '', abilityDesc: g.abilityDesc || '', rarity: g.rarity || 'common'
    })) : [];

    // Scrub undefined values (Firebase rejects them)
    const rawRes = B.red ? (B.red.resources || {}) : {};
    const playerResources = {};
    for (const k of Object.keys(rawRes)) {
      if (rawRes[k] !== undefined) playerResources[k] = rawRes[k];
    }

    return {
      playerName: firebase.auth().currentUser?.displayName || 'Raider',
      playerGhost: {
        name: rf?.name || '???', hp: rf?.hp || 0, maxHp: rf?.maxHp || 1,
        art: rf?.art || '', ko: rf?.ko || false
      },
      bossGhost: {
        name: bf?.name || '???', hp: bf?.hp || 0, maxHp: bf?.maxHp || 1,
        art: bf?.art || '', isBoss: true, ko: bf?.ko || false
      },
      allPlayerGhosts,
      allBossGhosts,
      playerActiveIdx: B.red ? B.red.activeIdx : 0,
      bossActiveIdx: B.blue ? B.blue.activeIdx : 0,
      playerSideline: B.red ? B.red.ghosts.filter((g, i) => i !== B.red.activeIdx).map(g => ({
        name: g.name || '???', hp: g.hp || 0, maxHp: g.maxHp || 1, ko: !!g.ko, art: g.art || ''
      })) : [],
      bossSideline: B.blue ? B.blue.ghosts.filter((g, i) => i !== B.blue.activeIdx).map(g => ({
        name: g.name || '???', hp: g.hp || 0, maxHp: g.maxHp || 1, ko: !!g.ko, art: g.art || ''
      })) : [],
      lastRoll: redDice.length > 0 ? { player: redDice, boss: blueDice } : null,
      bossPoolHp: RaidState.bossCurrentHp || 0,
      bossMaxHp: RaidState.bossMaxHp || 1,
      playerResources,
      round: B.round || 1,
      isWave: RaidState._isWaveFight || false,
      updatedAt: firebase.database.ServerValue.TIMESTAMP
    };
  },

  // Serialize player ghost state for turn continuity
  _serializePlayerState(B) {
    const state = { ghosts: [], resources: {}, activeIdx: 0 };
    if (!B || !B.red) return state;

    state.activeIdx = B.red.activeIdx || 0;

    // Scrub undefined from resources
    const rawRes = B.red.resources || {};
    for (const k of Object.keys(rawRes)) {
      if (rawRes[k] !== undefined) state.resources[k] = rawRes[k];
    }

    // Persist willowLostLast so Joy of Painting carries across raid turns
    if (B.willowLostLast) state.willowLostLast = !!B.willowLostLast.red;

    B.red.ghosts.forEach(g => {
      const gs = {
        hp: g.hp || 0, maxHp: g.maxHp || 1, ko: !!g.ko,
        id: g.id || 0, name: g.name || '???', art: g.art || '',
        ability: g.ability || '', abilityDesc: g.abilityDesc || '', rarity: g.rarity || 'common'
      };
      // Preserve original identity for reverse-transforms
      if (g.originalId != null) {
        gs.originalId = g.originalId || 0;
        gs.originalName = g.originalName || '';
        gs.originalArt = g.originalArt || '';
        gs.originalMaxHp = g.originalMaxHp || 1;
        gs.originalAbility = g.originalAbility || '';
        gs.originalAbilityDesc = g.originalAbilityDesc || '';
        gs.originalRarity = g.originalRarity || 'common';
      }
      state.ghosts.push(gs);
    });

    return state;
  },

  // Serialize boss ghost state for turn continuity
  _serializeBossState(B) {
    const state = { ghosts: [], activeIdx: 0 };
    if (!B || !B.blue) return state;

    state.activeIdx = B.blue.activeIdx || 0;

    B.blue.ghosts.forEach(g => {
      state.ghosts.push({
        hp: g.hp || 0, maxHp: g.maxHp || 1, ko: !!g.ko,
        id: g.id || 0, name: g.name || '???', art: g.art || '',
        ability: g.ability || '', abilityDesc: g.abilityDesc || '', rarity: g.rarity || 'common'
      });
    });

    return state;
  },

  // Get boss ghost current HP (always index 0, not activeIdx)
  _getBossGhostHp(B) {
    if (!B || !B.blue) return 0;
    let total = 0;
    B.blue.ghosts.forEach(g => { if (g && !g.ko) total += (g.hp || 0); });
    return total;
  },

  _getBossGhostMaxHp(B) {
    if (!B || !B.blue) return 9;
    let total = 0;
    B.blue.ghosts.forEach(g => { if (g) total += (g.maxHp || 0); });
    return total || 9;
  }
};
