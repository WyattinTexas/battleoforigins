// =================================================================
// RAID STATE MACHINE — Single source of truth for raid lifecycle
// Replaces: window.BOSS_MODE, RAID_MODE, BOSS_RAID_DATA, IS_WAVE_FIGHT,
//   _raidSkipEntry, _currentRaidRole, _currentFighterIdx, _lastTurnCounter,
//   _raidRoleTransitioning, raidBattleState, currentRaid, MP_MODE
// =================================================================

const VALID_TRANSITIONS = {
  'idle':         ['lobby'],
  'lobby':        ['countdown', 'idle'],
  'countdown':    ['fighting', 'spectating', 'abandoned', 'idle'],
  'fighting':     ['spectating', 'turn-handoff', 'complete', 'idle'],
  'spectating':   ['fighting', 'turn-handoff', 'complete', 'idle'],
  'turn-handoff': ['fighting', 'spectating', 'complete', 'idle'],
  'complete':     ['idle']
};

const RaidState = {
  // ── Identity ──
  instanceId: null,
  raidId: null,

  // ── Lifecycle phase ──
  // 'idle' | 'lobby' | 'countdown' | 'fighting' | 'spectating' |
  // 'turn-handoff' | 'complete' | 'abandoned'
  phase: 'idle',

  // ── My identity ──
  myUid: null,
  mySlot: -1,

  // ── Turn state ──
  currentFighterIdx: 0,
  currentFighterUid: null,
  turnCounter: 0,

  // ── Boss state ──
  bossConfig: null,
  bossCurrentHp: 0,
  bossMaxHp: 0,
  bossPhase: 1,
  enrageLevel: 0,

  // ── Players ──
  // [{uid, displayName, team, status, damageDealt, ghostsLost, joinedAt, lastHeartbeat}]
  players: [],

  // ── Saved ghost state (turn continuity) ──
  playerGhostState: {},   // {[uid]: {ghosts:[], resources:{}, activeIdx}}
  bossGhostState: null,   // {ghosts:[], activeIdx}

  // ── Fight-specific state ──
  _isWaveFight: false,
  totalDamageDealt: 0,
  ghostsLost: 0,

  // ── Boss team (built for current fight) ──
  bossTeam: null,

  // ── Personality shortcut ──
  get personality() { return this.bossConfig?.personality || 'tyrant'; },

  // ── Role queries ──
  isMyTurn() {
    return this.phase === 'fighting' && this.mySlot === this.currentFighterIdx;
  },
  amFighter() {
    return this.phase === 'fighting' && this.isMyTurn();
  },
  amSpectator() {
    return this.phase === 'spectating' ||
           (this.phase === 'fighting' && !this.isMyTurn());
  },
  isActive() {
    return this.phase !== 'idle';
  },

  // ── State transition with validation ──
  transition(newPhase, data) {
    const valid = VALID_TRANSITIONS[this.phase];
    if (!valid || !valid.includes(newPhase)) {
      console.error(`[RaidState] Invalid transition: ${this.phase} -> ${newPhase}`);
      return false;
    }
    const oldPhase = this.phase;
    this.phase = newPhase;
    if (data) {
      // Only assign known properties, don't pollute the state
      const assignable = [
        'instanceId', 'raidId', 'myUid', 'mySlot',
        'currentFighterIdx', 'currentFighterUid', 'turnCounter',
        'bossConfig', 'bossCurrentHp', 'bossMaxHp', 'bossPhase', 'enrageLevel',
        'players', 'playerGhostState', 'bossGhostState',
        '_isWaveFight', 'totalDamageDealt', 'ghostsLost', 'bossTeam'
      ];
      assignable.forEach(key => {
        if (key in data) this[key] = data[key];
      });
    }
    console.log(`[RaidState] ${oldPhase} -> ${newPhase}`, data || '');
    this._emit('transition', { from: oldPhase, to: newPhase, data });
    return true;
  },

  // ── Reset to idle ──
  reset() {
    this.instanceId = null;
    this.raidId = null;
    this.phase = 'idle';
    this.myUid = null;
    this.mySlot = -1;
    this.currentFighterIdx = 0;
    this.currentFighterUid = null;
    this.turnCounter = 0;
    this.bossConfig = null;
    this.bossCurrentHp = 0;
    this.bossMaxHp = 0;
    this.bossPhase = 1;
    this.enrageLevel = 0;
    this.players = [];
    this.playerGhostState = {};
    this.bossGhostState = null;
    this._isWaveFight = false;
    this.totalDamageDealt = 0;
    this.ghostsLost = 0;
    this.bossTeam = null;
    this._emit('reset', {});
    console.log('[RaidState] Reset to idle');
  },

  // ── Load from Firebase instance data ──
  loadFromFirebase(instanceId, data, myUid) {
    this.instanceId = instanceId;
    this.raidId = data.raidId;
    this.myUid = myUid;
    this.currentFighterIdx = data.currentFighterIdx || 0;
    this.currentFighterUid = data.currentFighterUid || null;
    this.turnCounter = data.turnCounter || 0;
    this.bossCurrentHp = data.bossCurrentHp || 0;
    this.bossMaxHp = data.bossMaxHp || 0;
    this.bossPhase = 1; // phases disabled in current code
    this.enrageLevel = data.enrageLevel || 0;
    this.playerGhostState = data.playerGhostState || {};
    this.bossGhostState = data.bossGhostState || null;
    this.totalDamageDealt = data.totalDamageDealt || 0;

    // Resolve bossConfig from RAID_BOSSES
    if (typeof RAID_BOSSES !== 'undefined' && data.raidId) {
      this.bossConfig = RAID_BOSSES[data.raidId] || null;
    }

    // Build players array and find my slot
    const playerEntries = data.players || {};
    this.players = [];
    this.mySlot = -1;
    for (const [slot, p] of Object.entries(playerEntries)) {
      const idx = parseInt(slot);
      this.players[idx] = p;
      if (p.uid === myUid) this.mySlot = idx;
    }
  },

  // ── Simple event bus ──
  _listeners: {},

  on(event, fn) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(fn);
  },

  off(event, fn) {
    if (!this._listeners[event]) return;
    this._listeners[event] = this._listeners[event].filter(f => f !== fn);
  },

  _emit(event, data) {
    const handlers = this._listeners[event];
    if (!handlers) return;
    handlers.forEach(fn => {
      try { fn(data); } catch (e) { console.error('[RaidState] Event handler error:', e); }
    });
  }
};

// ── Backward-compatibility shims ──────────────────────────────────
// Existing ability code in battle-engine.js checks window.BOSS_MODE,
// window.RAID_MODE, etc. These read-only getters bridge to RaidState
// so ALL 184 card abilities work without any changes.

Object.defineProperty(window, 'BOSS_MODE', {
  get() { return RaidState.isActive() && RaidState.phase !== 'lobby'; },
  set(v) { /* ignored — state machine owns this */ },
  configurable: true
});

Object.defineProperty(window, 'RAID_MODE', {
  get() { return RaidState.isActive(); },
  set(v) { /* ignored */ },
  configurable: true
});

Object.defineProperty(window, 'BOSS_RAID_DATA', {
  get() { return RaidState.isActive() ? RaidState : null; },
  set(v) { /* ignored */ },
  configurable: true
});

Object.defineProperty(window, 'IS_WAVE_FIGHT', {
  get() { return RaidState._isWaveFight; },
  set(v) { RaidState._isWaveFight = !!v; },
  configurable: true
});

// MP_MODE needs to be writable for PvP (non-raid) multiplayer
// Only define the shim if not already set by PvP code
if (typeof MP_MODE === 'undefined') {
  window.MP_MODE = false;
}

// ── Legacy global aliases ─────────────────────────────────────────
// raid-ui.js and other code references `currentRaid` and `raidBattleState`.
// Route them to RaidState.
Object.defineProperty(window, 'currentRaid', {
  get() {
    if (!RaidState.isActive()) return null;
    return {
      instanceId: RaidState.instanceId,
      raidId: RaidState.raidId,
      bossMaxHp: RaidState.bossMaxHp,
      bossCurrentHp: RaidState.bossCurrentHp,
      players: RaidState.players,
      turnCounter: RaidState.turnCounter,
      currentFighterIdx: RaidState.currentFighterIdx
    };
  },
  set(v) { /* ignored — state machine owns this */ },
  configurable: true
});

Object.defineProperty(window, 'raidBattleState', {
  get() {
    if (!RaidState.isActive()) return null;
    return {
      phase: RaidState.phase === 'fighting' ? 'fighting' : RaidState.phase,
      currentBossHp: RaidState.bossCurrentHp,
      maxBossHp: RaidState.bossMaxHp,
      bossConfig: RaidState.bossConfig,
      bossTeam: RaidState.bossTeam,
      totalDamageDealt: RaidState.totalDamageDealt,
      ghostsLost: RaidState.ghostsLost,
      currentSlot: RaidState.mySlot,
      enrageLevel: RaidState.enrageLevel,
      personality: RaidState.personality
    };
  },
  set(v) { /* ignored */ },
  configurable: true
});
