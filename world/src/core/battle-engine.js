// ══════════════════════════════════════════════════════════
//  BATTLE ENGINE — Unified battle factory + turn phases
//  Ported from testroom2 (drbango.com/testroom2/)
//  ONE factory for ALL battle types. No more 12 copies.
// ══════════════════════════════════════════════════════════

// Get the active ghost on a team
function active(t) { return t.ghosts[t.activeIdx]; }

// Get the opposing team
function oppTeam(teamName) {
  if (teamName === 'red') return 'blue';
  if (teamName === 'blue') return 'red';
  if (teamName === 'player') return 'enemy';
  return 'player';
}

// Build a team from ghost IDs + willpower deck config
// ids = [cardId, cardId, cardId]
// wpConfig = { [willpowerCardId]: count } or null for default
function makeTeam(ids, wpConfig) {
  const teamDeck = typeof buildTeamWillpowerDeck === 'function'
    ? buildTeamWillpowerDeck(wpConfig || (typeof getDefaultWpDeckConfig === 'function' ? getDefaultWpDeckConfig() : {}))
    : [];

  const team = {
    ghosts: ids.map(id => {
      const g = typeof ghostData === 'function' ? ghostData(id)
        : (typeof ALL_CARDS !== 'undefined' ? ALL_CARDS.find(c => c.id === id) : null);
      if (!g) return { id, name: 'Unknown', hp: 3, maxHp: 3, ko: false, willpower: [], rarity: 'common' };
      return {
        id,
        name: g.name,
        hp: g.maxHp,
        maxHp: g.maxHp,
        ko: false,
        ability: g.ability || '',
        abilityDesc: g.abilityDesc || g.desc || '',
        rarity: g.rarity || 'common',
        // Willpower hand (populated by wpDrawFromTeam)
        willpower: [],
        wpPending: true,
        willpowerUsedThisTurn: false,
        willpowerTopLocked: false,
        shellActive: false,
        // Per-ghost ability flags
        hankFirstRoll: false,
        maximoFirstRoll: false,
        usedMagicTouch: false,
        usedOncePerGame: false,
        entryFired: false,
        killedBy: -1,
      };
    }),
    activeIdx: 0,
    wpDeck: teamDeck,
    wpDiscard: [],
    resources: typeof makeDefaultResources === 'function' ? makeDefaultResources() : {
      ice: 0, fire: 0, surge: 0, moonstone: 0, luckyStone: 0,
      healingSeed: 0, burn: 0, firefly: 0, frostbite: 0,
    },
    moonstoneSickness: 0,
    moonstoneSicknessCount: 0,
    moonstoneSicknessPending: 0,
  };

  // Draw willpower for the starting active ghost
  if (typeof wpDrawFromTeam === 'function') {
    wpDrawFromTeam(team, team.ghosts[0]);
  }

  return team;
}

// ── UNIFIED BATTLE FACTORY ─────────────────────────────
// Creates the B (battle state) object for ANY battle type.
// opts = { type: 'wild'|'trainer'|'worldboss'|'valkin'|'arena'|'raid',
//          trainerName, worldBoss, raidId, ... }
function initBattle(redIds, blueIds, opts) {
  opts = opts || {};
  const wpConfig = G && G.wpDeckConfig ? G.wpDeckConfig : null;

  const red = makeTeam(redIds, wpConfig);
  const blue = makeTeam(blueIds, wpConfig);

  B = {
    red: red,
    blue: blue,
    round: 1,
    log: [],
    phase: 'ready',

    // Battle metadata
    battleType: opts.type || 'wild',
    trainerName: opts.trainerName || null,
    worldBoss: opts.worldBoss || false,
    raidId: opts.raidId || null,
    isValkinEvent: opts.isValkinEvent || false,
    isArena: opts.isArena || false,
    isHostileNPC: opts.isHostileNPC || null,

    // Willpower combat flags (reset each round)
    wpBonanza: { red: 0, blue: 0 },
    wpPow: { red: false, blue: false },
    wpPepo: { red: false, blue: false },
    wpUsedThisTurn: { red: false, blue: false },

    // Resource commitment buckets
    committed: {
      red: typeof makeDefaultCommitted === 'function' ? makeDefaultCommitted() : { ice: 0, fire: 0, surge: 0, auntSusan: 0, auntSusanHeal: 0, harrison: 0, zainBlade: 0 },
      blue: typeof makeDefaultCommitted === 'function' ? makeDefaultCommitted() : { ice: 0, fire: 0, surge: 0, auntSusan: 0, auntSusanHeal: 0, harrison: 0, zainBlade: 0 },
    },

    // Burn & frostbite state (sideline DOT)
    burn: { red: {}, blue: {} },
    burnSource: { red: {}, blue: {} },
    frostbite: { red: {}, blue: {} },
    frostbiteSource: { red: {}, blue: {} },
    frostbiteDicePenalty: { red: 0, blue: 0 },

    // Per-round ability flags (all reset at round end)
    retributionDice: { red: 0, blue: 0 },
    cameronBonusDice: { red: 0, blue: 0 },
    pressureUsed: { red: false, blue: false },
    splinterActivated: { red: false, blue: false },
    guardianFairyStandby: { red: false, blue: false },
    letsDanceBonus: { red: 0, blue: 0 },
    tommyRegulatorBonus: { red: 0, blue: 0 },
    eloiseUsedThisRound: { red: false, blue: false },
    outlawStolenDie: { red: 0, blue: 0 },
    bogeyUsed: { red: false, blue: false },
    marcusGlacialBonus: { red: 0, blue: 0 },
    hugoWreckage: { red: 0, blue: 0 },
    logeyLockout: { red: 0, blue: 0 },
    dreamCatBonus: { red: 0, blue: 0 },
    alucardUsed: { red: false, blue: false },
    jacksonUsedThisRound: { red: false, blue: false },
    sonyaUsedThisRound: { red: false, blue: false },
    darkWingUsedThisGame: { red: false, blue: false },
    haywireBonus: { red: 0, blue: 0 },
    haywireDamageBonus: { red: 0, blue: 0 },
    haywireUsed: { red: false, blue: false },
    willowLostLast: { red: false, blue: false },
    scallywagsFrenzyBonus: { red: 0, blue: 0 },
    floopMuck: { red: 0, blue: 0 },
    tylerDecidedThisRound: { red: false, blue: false },
    tylerHeatUpDieBonus: { red: 0, blue: 0 },
    booTeamworkDecidedThisRound: { red: false, blue: false },
    booTeamworkDieDebt: { red: 0, blue: 0 },
    pipToastedUsed: { red: false, blue: false },
    pipDieRemoval: { red: 0, blue: 0 },
    luckyStoneSpentThisTurn: { red: 0, blue: 0 },
    twylaLuckyDmg: { red: 0, blue: 0 },
    preRollAbilitiesFiredThisTurn: { red: false, blue: false },
    activeBurn: { red: 0, blue: 0 },
    lastRollDiceCount: { red: 3, blue: 3 },
    jeffSnicker: { red: 0, blue: 0 },
    pendingLucyDmg: { red: 0, blue: 0 },
    fangUndercoverArmed: { red: false, blue: false },
    winstonDiceBonus: { red: 0, blue: 0 },
    catchyTuneUnlocked: { red: false, blue: false },
    catchyTuneLockedDie: { red: null, blue: null },
    catchyTuneDieBonus: { red: 0, blue: 0 },
    tysonDisabled: { red: [], blue: [] },
    gordokDieBonus: { red: 0, blue: 0 },
    hexDieRemoval: { red: 0, blue: 0 },
    carpenterHammer: { red: false, blue: false },
    welderTorch: { red: false, blue: false },
    foremanDieBonus: { red: 0, blue: 0 },
    carpenterDiceTrade: { red: 0, blue: 0 },
    sophiaMask: { red: null, blue: null },
    sophiaMaskActive: { red: false, blue: false },
    iceBladeForgedPermanent: { red: false, blue: false },
    flameBlade: { red: false, blue: false },
    flameBladeSwing: { red: false, blue: false },
    iceBladeSwing: { red: false, blue: false },
    lucasKindlingBonus: { red: 0, blue: 0 },
    raditzHuntReady: { red: false, blue: false },
    dougCautionUsed: { red: false, blue: false },
    dougCautionDieBonus: { red: false, blue: false },
    mallowDecided: { red: false, blue: false },
    jeanieUsed: { red: false, blue: false },
    chowDecided: { red: false, blue: false },
    zorkDecided: { red: false, blue: false },
    zorkExtraDie: { red: 0, blue: 0 },
    bonzaiDecided: { red: false, blue: false },
    cultivateDecided: { red: false, blue: false },
    romyPrediction: { red: null, blue: null },
    pureHeartDeclared: { red: null, blue: null },
    pureHeartScheduledKO: { red: false, blue: false },
    blackoutNum: {},
    blackoutCallouts: [],

    // Duel Phase (lower HP goes first)
    duelPhaseMode: true,
    duelPriority: null,
    duelActiveTeam: null,
    duelLastLoser: null,

    // Hand Limit mode
    handLimitMode: false,
    HAND_LIMIT: 3,

    // Pending resolution state
    pendingResolve: null,
    pendingMoonstone: null,
    pendingSteal: null,
    sylviaPendingResult: null,
    sylviaResuming: false,
    flickResuming: false,
    slipstreamResuming: false,
    bogeyReflectResuming: false,
    bogeyReflectChoice: null,
    bogeyReflectPending: null,

    // Battle started flag
    battleStarted: false,
  };

  // Apply equipment effects if available (World integration)
  if (typeof applyAccessoryBattleEffects === 'function') applyAccessoryBattleEffects();

  return B;
}

// Reset per-round flags (called at end of each round)
function resetRoundFlags() {
  if (!B) return;
  const sides = B.red ? ['red', 'blue'] : ['player', 'enemy'];
  sides.forEach(s => {
    if (B.wpUsedThisTurn) B.wpUsedThisTurn[s] = false;
    if (B.wpBonanza) B.wpBonanza[s] = 0;
    if (B.wpPow) B.wpPow[s] = false;
    if (B.wpPepo) B.wpPepo[s] = false;
    if (B.preRollAbilitiesFiredThisTurn) B.preRollAbilitiesFiredThisTurn[s] = false;
    if (B.pressureUsed) B.pressureUsed[s] = false;
    if (B.eloiseUsedThisRound) B.eloiseUsedThisRound[s] = false;
    if (B.jacksonUsedThisRound) B.jacksonUsedThisRound[s] = false;
    if (B.sonyaUsedThisRound) B.sonyaUsedThisRound[s] = false;
    if (B.tylerDecidedThisRound) B.tylerDecidedThisRound[s] = false;
    if (B.booTeamworkDecidedThisRound) B.booTeamworkDecidedThisRound[s] = false;
    if (B.pipToastedUsed) B.pipToastedUsed[s] = false;
    if (B.luckyStoneSpentThisTurn) B.luckyStoneSpentThisTurn[s] = 0;
    if (B.haywireUsed) B.haywireUsed[s] = false;
    if (B.dougCautionUsed) B.dougCautionUsed[s] = false;
    if (B.dougCautionDieBonus) B.dougCautionDieBonus[s] = false;
    if (B.mallowDecided) B.mallowDecided[s] = false;
    if (B.jeanieUsed) B.jeanieUsed[s] = false;
    if (B.chowDecided) B.chowDecided[s] = false;
    if (B.zorkDecided) B.zorkDecided[s] = false;
    if (B.bonzaiDecided) B.bonzaiDecided[s] = false;
    if (B.cultivateDecided) B.cultivateDecided[s] = false;
    if (B.bogeyUsed) B.bogeyUsed[s] = false;

    // Unlock willpower top card for next round
    const f = B[s] && B[s].ghosts ? B[s].ghosts[B[s].activeIdx] : null;
    if (f) {
      f.willpowerTopLocked = false;
      f.willpowerUsedThisTurn = false;
      f.shellActive = false;
    }
  });

  // Refund committed resources
  if (typeof refundCommitted === 'function') refundCommitted(sides);

  B.round++;
}

// Check if a team is in pre-roll state (can commit resources / activate willpower)
function isPreRollActive(teamName) {
  if (!B) return false;
  return B.phase === 'ready';
}

// Check if battle is over (one team fully KO'd)
function isBattleOver() {
  if (!B) return null;
  const sides = B.red ? ['red', 'blue'] : ['player', 'enemy'];
  for (const s of sides) {
    const team = B[s];
    if (!team) continue;
    const allKO = team.ghosts.every(g => g.ko || g.hp <= 0);
    if (allKO) return oppTeam(s); // the other side wins
  }
  return null; // battle continues
}

// Score a ghost for KO replacement priority (higher = better pick)
function scoreSwapCandidate(ghost, team) {
  let score = ghost.hp * 10; // base: HP value
  // Bonus for ghosts with entry effects
  const entryGhosts = [201, 306, 34, 94, 98, 420, 437, 51]; // known entry effect IDs
  if (entryGhosts.includes(ghost.id)) score += 15;
  // Bonus for high-damage ghosts
  if (ghost.rarity === 'legendary' || ghost.rarity === 'ghost-rare') score += 10;
  if (ghost.rarity === 'rare') score += 5;
  return score;
}

// Pick the best swap candidate from sideline
function smartPickSwap(teamName) {
  if (!B) return -1;
  const team = B[teamName];
  if (!team) return -1;

  let bestIdx = -1, bestScore = -1;
  team.ghosts.forEach((g, idx) => {
    if (idx === team.activeIdx) return;
    if (g.ko || g.hp <= 0) return;
    const score = scoreSwapCandidate(g, team);
    if (score > bestScore) { bestScore = score; bestIdx = idx; }
  });
  return bestIdx;
}

// Perform a KO swap — bring in next fighter
function performKOSwap(teamName, newIdx, logFn) {
  if (!B) return;
  const team = B[teamName];
  if (!team || newIdx < 0 || newIdx >= team.ghosts.length) return;

  team.activeIdx = newIdx;
  const newGhost = team.ghosts[newIdx];

  // Draw fresh willpower hand
  if (typeof wpDrawFromTeam === 'function') {
    wpDrawFromTeam(team, newGhost, logFn);
  }

  if (logFn) logFn(`${newGhost.name} enters the battle!`);
}

// Dark Fang (202) — Pressure: blocks healing for the opponent
function deathHowlBlocksHealing(teamName) {
  if (!B) return false;
  const opp = oppTeam(teamName);
  const oppActive = B[opp] ? active(B[opp]) : null;
  return oppActive && oppActive.id === 202 && !oppActive.ko;
}

// Guarded heal: adds HP only if not blocked by Dark Fang
function guardedHeal(ghost, amount, teamName, logFn) {
  if (deathHowlBlocksHealing(teamName)) {
    if (logFn) logFn(`Dark Fang — Pressure! ${ghost.name}'s healing blocked!`);
    return false;
  }
  if (typeof wpHeal === 'function') wpHeal(ghost, amount);
  return true;
}

// Masked Hero (55) — immune to before-roll damage
function maskedHeroImmune(ghost) {
  return ghost && ghost.id === 55 && !ghost.ko;
}
