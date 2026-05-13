// ============================================================
// WATCHDOG — Freeze Detection & Auto-Recovery for Battle of Origins
// ============================================================
// Inject into the game page to monitor for freezes during
// autonomous overnight testing. Logs all events with [WATCHDOG]
// prefix so Claude can read them from the console.
//
// Usage: add <script src="watchdog.js"></script> after battle-engine.js
//        or inject via console / Chrome automation
// ============================================================

(function () {
  'use strict';

  // -- Config --
  const HEARTBEAT_INTERVAL  = 2000;   // check every 2s
  const PHASE_STALE_MS      = 15000;  // 15s stuck in same phase = suspicious
  const ROLLING_STALE_MS    = 10000;  // 10s stuck in 'rolling' = almost certainly frozen
  const RESOLVING_STALE_MS  = 20000;  // 20s stuck in 'resolving' = frozen (abilities take time)
  const READY_STALE_MS      = 30000;  // 30s stuck in 'ready' during autoPlay = frozen
  const MODAL_STALE_MS      = 12000;  // 12s with a visible modal during autoPlay = frozen
  const MAX_RECOVERY_ATTEMPTS = 3;    // per freeze event before giving up

  // -- State --
  let lastPhase       = null;
  let lastRound       = null;
  let lastPhaseTime   = Date.now();
  let lastRoundTime   = Date.now();
  let recoveryCount   = 0;
  let totalFreezes    = 0;
  let totalRecoveries = 0;
  let freezeLog       = [];
  let heartbeatId     = null;
  let enabled         = true;

  // -- Helpers --
  function now() { return Date.now(); }

  function ts() {
    return new Date().toLocaleTimeString('en-US', { hour12: false });
  }

  function wlog(msg, level) {
    const prefix = `[WATCHDOG ${ts()}]`;
    if (level === 'error') console.error(prefix, msg);
    else if (level === 'warn') console.warn(prefix, msg);
    else console.log(prefix, msg);
  }

  function getB() {
    return (typeof B !== 'undefined') ? B : null;
  }

  function isAutoPlay() {
    return (typeof autoPlayRunning !== 'undefined') && autoPlayRunning;
  }

  // Snapshot the current game state for diagnostics
  function snapshot() {
    const b = getB();
    if (!b) return { error: 'B not defined' };
    const red = b.red ? {
      activeIdx: b.red.activeIdx,
      active: b.red.ghosts?.[b.red.activeIdx]
        ? { name: b.red.ghosts[b.red.activeIdx].name, hp: b.red.ghosts[b.red.activeIdx].hp, ko: b.red.ghosts[b.red.activeIdx].ko }
        : null,
      aliveCount: b.red.ghosts?.filter(g => !g.ko).length,
      resources: b.red.resources ? { ...b.red.resources } : null
    } : null;
    const blue = b.blue ? {
      activeIdx: b.blue.activeIdx,
      active: b.blue.ghosts?.[b.blue.activeIdx]
        ? { name: b.blue.ghosts[b.blue.activeIdx].name, hp: b.blue.ghosts[b.blue.activeIdx].hp, ko: b.blue.ghosts[b.blue.activeIdx].ko }
        : null,
      aliveCount: b.blue.ghosts?.filter(g => !g.ko).length,
      resources: b.blue.resources ? { ...b.blue.resources } : null
    } : null;

    return {
      phase: b.phase,
      round: b.round,
      redDice: b.redDice,
      blueDice: b.blueDice,
      preRoll: b.preRoll ? {
        redDice: b.preRoll.red?.dice,
        blueDice: b.preRoll.blue?.dice
      } : null,
      abilityQueueLen: (typeof abilityQueue !== 'undefined') ? abilityQueue.length : -1,
      narrateQueueLen: (typeof narrateQueue !== 'undefined') ? narrateQueue.length : -1,
      red,
      blue,
      autoPlay: isAutoPlay(),
      visibleModals: getVisibleModals(),
      pendingFlags: getPendingFlags(b)
    };
  }

  // Check which modals/overlays are visible (these block autoPlay)
  function getVisibleModals() {
    const ids = [
      'swapOverlay', 'msPicker', 'stealOverlay', 'gameOver',
      'lsOverlay', 'duelOverlay', 'gordokModal', 'wiseAlModal',
      'bogeyReflectModal', 'tommyModal', 'sylviaModal'
    ];
    const visible = [];
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el && (el.classList.contains('active') || el.style.display === 'block' || el.style.display === 'flex')) {
        visible.push(id);
      }
    }
    return visible;
  }

  // Check B for dangling pending flags that might indicate stuck state
  function getPendingFlags(b) {
    const flags = [];
    if (b.pendingMoonstone) flags.push('pendingMoonstone');
    if (b.pendingSteal) flags.push('pendingSteal');
    if (b.winstonSchemePending) flags.push('winstonSchemePending');
    if (b.gordokPending) flags.push('gordokPending');
    if (b.wiseAlPending) flags.push('wiseAlPending');
    if (b.sylviaPendingResult) flags.push('sylviaPendingResult');
    if (b.bogeyReflectPending) flags.push('bogeyReflectPending');
    if (b.koSwapQueue && b.koSwapQueue.length > 0) flags.push(`koSwapQueue(${b.koSwapQueue.length})`);
    return flags;
  }

  // -- Freeze Detection --
  function checkHeartbeat() {
    if (!enabled) return;
    const b = getB();
    if (!b) return; // game not started yet

    const currentPhase = b.phase;
    const currentRound = b.round;
    const t = now();

    // Track phase changes
    if (currentPhase !== lastPhase) {
      lastPhase = currentPhase;
      lastPhaseTime = t;
      recoveryCount = 0; // reset per-freeze recovery counter
    }

    // Track round changes
    if (currentRound !== lastRound) {
      lastRound = currentRound;
      lastRoundTime = t;
    }

    // Game over is not a freeze
    if (currentPhase === 'over') return;

    // How long stuck in current phase?
    const phaseAge = t - lastPhaseTime;

    // Determine the appropriate stale threshold for this phase
    let staleMs = PHASE_STALE_MS;
    if (currentPhase === 'rolling') staleMs = ROLLING_STALE_MS;
    else if (currentPhase === 'resolving') staleMs = RESOLVING_STALE_MS;
    else if (currentPhase === 'ready' && isAutoPlay()) staleMs = READY_STALE_MS;
    else if (currentPhase === 'ready' && !isAutoPlay()) return; // human might just be thinking

    // Check for modal freeze during autoPlay
    if (isAutoPlay()) {
      const modals = getVisibleModals();
      if (modals.length > 0 && phaseAge > MODAL_STALE_MS) {
        onFreeze('modal-stuck', `Modal ${modals.join(', ')} visible for ${Math.round(phaseAge / 1000)}s during autoPlay`);
        return;
      }
    }

    // Phase stale check
    if (phaseAge > staleMs) {
      onFreeze('phase-stuck', `Phase '${currentPhase}' stuck for ${Math.round(phaseAge / 1000)}s (threshold: ${staleMs / 1000}s)`);
    }
  }

  // -- Freeze Handler --
  function onFreeze(type, reason) {
    totalFreezes++;
    const snap = snapshot();
    const entry = {
      time: ts(),
      type,
      reason,
      snapshot: snap,
      recovered: false
    };
    freezeLog.push(entry);

    wlog(`🚨 FREEZE DETECTED (#${totalFreezes}): ${reason}`, 'error');
    wlog(`Snapshot: ${JSON.stringify(snap, null, 2)}`, 'error');

    // Attempt recovery
    if (recoveryCount < MAX_RECOVERY_ATTEMPTS) {
      recoveryCount++;
      wlog(`Attempting recovery (attempt ${recoveryCount}/${MAX_RECOVERY_ATTEMPTS})...`, 'warn');
      const recovered = attemptRecovery(type, snap);
      if (recovered) {
        totalRecoveries++;
        entry.recovered = true;
        wlog(`✅ Recovery successful. Game should continue.`, 'warn');
        // Reset phase tracking so we don't immediately re-trigger
        lastPhase = null;
        lastPhaseTime = now();
      } else {
        wlog(`❌ Recovery failed.`, 'error');
      }
    } else {
      wlog(`❌ Max recovery attempts (${MAX_RECOVERY_ATTEMPTS}) reached for this freeze. Waiting for manual intervention.`, 'error');
    }
  }

  // -- Recovery --
  function attemptRecovery(type, snap) {
    const b = getB();
    if (!b) return false;

    try {
      // Dismiss any stuck modals
      const modalIds = ['swapOverlay', 'msPicker', 'stealOverlay',
        'lsOverlay', 'duelOverlay', 'gordokModal', 'wiseAlModal',
        'bogeyReflectModal', 'tommyModal', 'sylviaModal'];
      for (const id of modalIds) {
        const el = document.getElementById(id);
        if (el) {
          el.classList.remove('active');
          el.style.display = 'none';
        }
      }

      // Clear pending flags
      b.pendingMoonstone = null;
      b.pendingSteal = null;
      b.winstonSchemePending = null;
      b.gordokPending = null;
      b.wiseAlPending = null;
      b.sylviaPendingResult = null;
      b.sylviaResuming = false;
      b.bogeyReflectResuming = false;
      b.bogeyReflectChoice = null;
      b.bogeyReflectPending = null;

      // Clear queues
      if (typeof abilityQueue !== 'undefined') abilityQueue.length = 0;
      if (typeof abilityQueueMode !== 'undefined') abilityQueueMode = false;
      if (typeof narrateQueue !== 'undefined') narrateQueue.length = 0;

      // Force back to ready phase
      b.phase = 'ready';
      b.preRoll = null;
      b.pendingResolve = null;

      // Re-enable roll buttons
      if (typeof resetRollButtons === 'function') resetRollButtons();
      if (typeof renderBattle === 'function') renderBattle();

      wlog(`Recovery: phase=${b.phase}, round=${b.round}`, 'warn');
      return true;
    } catch (e) {
      wlog(`Recovery threw: ${e.message}`, 'error');
      return false;
    }
  }

  // -- Console API --
  // These functions are available from the console or from Claude's JS injection

  window.WATCHDOG = {
    // Get current status
    status() {
      const b = getB();
      return {
        enabled,
        gameActive: !!b,
        phase: b?.phase,
        round: b?.round,
        autoPlay: isAutoPlay(),
        totalFreezes,
        totalRecoveries,
        freezeLogCount: freezeLog.length,
        uptime: Math.round((now() - (heartbeatId ? lastRoundTime : now())) / 1000) + 's'
      };
    },

    // Get full freeze log
    freezeLog() {
      return freezeLog;
    },

    // Get latest freeze
    lastFreeze() {
      return freezeLog.length > 0 ? freezeLog[freezeLog.length - 1] : null;
    },

    // Take a snapshot right now
    snapshot,

    // Enable/disable
    enable()  { enabled = true;  wlog('Watchdog ENABLED'); },
    disable() { enabled = false; wlog('Watchdog DISABLED'); },

    // Force a recovery attempt
    recover() {
      const snap = snapshot();
      return attemptRecovery('manual', snap);
    },

    // Reset stats
    reset() {
      totalFreezes = 0;
      totalRecoveries = 0;
      freezeLog = [];
      recoveryCount = 0;
      lastPhase = null;
      lastRound = null;
      lastPhaseTime = now();
      lastRoundTime = now();
      wlog('Stats reset');
    },

    // Summary for overnight reports
    report() {
      const summary = {
        totalFreezes,
        totalRecoveries,
        unrecovered: totalFreezes - totalRecoveries,
        freezeTypes: {},
        freezePhases: {}
      };
      for (const f of freezeLog) {
        summary.freezeTypes[f.type] = (summary.freezeTypes[f.type] || 0) + 1;
        const phase = f.snapshot?.phase || 'unknown';
        summary.freezePhases[phase] = (summary.freezePhases[phase] || 0) + 1;
      }
      wlog(`📊 OVERNIGHT REPORT: ${JSON.stringify(summary, null, 2)}`);
      return summary;
    }
  };

  // -- Error Listener --
  // Catch unhandled errors and promise rejections
  window.addEventListener('error', (e) => {
    wlog(`Unhandled error: ${e.message} at ${e.filename}:${e.lineno}:${e.colno}`, 'error');
  });

  window.addEventListener('unhandledrejection', (e) => {
    wlog(`Unhandled rejection: ${e.reason}`, 'error');
  });

  // -- Console Error Interception --
  // Wrap console.error to catch game crash logs
  const _origConsoleError = console.error;
  console.error = function (...args) {
    _origConsoleError.apply(console, args);
    const msg = args.map(a => (typeof a === 'string') ? a : JSON.stringify(a)).join(' ');
    if (msg.includes('CRASH') || msg.includes('resolveRound') || msg.includes('drainAbilityQueue')) {
      wlog(`🔥 Game crash detected in console: ${msg.slice(0, 200)}`, 'error');
    }
  };

  // -- Start --
  heartbeatId = setInterval(checkHeartbeat, HEARTBEAT_INTERVAL);
  wlog('🐕 Watchdog started. Checking every ' + (HEARTBEAT_INTERVAL / 1000) + 's. Use WATCHDOG.status() for info.');

})();
