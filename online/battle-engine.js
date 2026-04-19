// =================================================================
// BATTLE ENGINE — Extracted from testroom for multiplayer use
// Depends on: cards.js (GHOSTS, getGhost, getActiveGhosts, SHELVED_IDS)
// =================================================================

// Alias: testroom uses ghostData, cards.js uses getGhost
function ghostData(id) { return getGhost(id); }

// Stubs for testroom-specific functions not needed in multiplayer
function recordWin(id) {}
function recordLoss(id) {}
function recordKO(id) {}
function recordKill(id) {}
function recordMvp(id) {}
function renderPicks() {}
function renderGallery() {}
let autoPlayRunning = false;
let autoPlayQueue = 0;
let autoPlayTotal = 0;

// Battle state (from testroom)
let S = { tab:'battle', redPicks:[], bluePicks:[], battle:null };


function initMatchStats() {
  B.matchStats = {
    red: {}, blue: {},
    finishingBlowGhostId: null,
    finishingBlowTeam: null,
    snapshot: null,
    // Per-round side-band: resource amounts that have been explicitly credited
    // to a specific ghost (via creditGhost). Subtracted from the delta in
    // creditRoundDelta so we don't double-count them to the active fighter.
    explicit: { red: { ls:0, ms:0, ice:0, fire:0, seed:0 }, blue: { ls:0, ms:0, ice:0, fire:0, seed:0 } }
  };
}

function ensureMatchStat(team, ghostId) {
  if (!B.matchStats[team][ghostId]) {
    B.matchStats[team][ghostId] = {
      rollsWon: 0,
      kosScored: 0,
      damageDealt: 0,
      ls: 0, ms: 0, ice: 0, fire: 0, seed: 0
    };
  }
  return B.matchStats[team][ghostId];
}

// Explicit per-ghost credit. Call this inside any sideline onShow callback
// that grants a resource, so the sideline ghost (not the active fighter)
// gets the MVP points. The amount is added to B.matchStats.explicit so
// creditRoundDelta's snapshot-diff doesn't also credit the active fighter
// for the same grant.
function creditGhost(team, ghostId, resource, amount) {
  if (!B || !B.matchStats || !ghostId || amount <= 0) return;
  if (team !== 'red' && team !== 'blue') return;
  if (!['ls','ms','ice','fire','seed'].includes(resource)) return;
  const stat = ensureMatchStat(team, ghostId);
  stat[resource] = (stat[resource] || 0) + amount;
  B.matchStats.explicit[team][resource] = (B.matchStats.explicit[team][resource] || 0) + amount;
}

function snapshotRound() {
  if (!B || !B.matchStats) return;
  // Reset the explicit side-band — credits accumulate per-round only
  B.matchStats.explicit = { red: { ls:0, ms:0, ice:0, fire:0, seed:0 }, blue: { ls:0, ms:0, ice:0, fire:0, seed:0 } };
  B.matchStats.snapshot = {
    red: {
      res: { ...B.red.resources },
      ghosts: B.red.ghosts.map(g => ({ id: g.id, hp: g.hp, ko: g.ko }))
    },
    blue: {
      res: { ...B.blue.resources },
      ghosts: B.blue.ghosts.map(g => ({ id: g.id, hp: g.hp, ko: g.ko }))
    }
  };
}

function creditRoundDelta(roundWinner) {
  if (!B || !B.matchStats || !B.matchStats.snapshot) return;
  const snap = B.matchStats.snapshot;
  ['red', 'blue'].forEach(team => {
    const t = B[team];
    const activeF = active(t);
    if (!activeF) return;
    const stat = ensureMatchStat(team, activeF.id);
    // Resource deltas — credit the currently-active ghost for the non-explicit leftover.
    // Sideline generators (Gary, Farmer Jeff, Granny, etc.) call creditGhost() directly
    // inside their onShow callbacks, populating B.matchStats.explicit[team]. We subtract
    // those amounts here so the active fighter only gets credit for resources they earned.
    const rNow = t.resources;
    const rBefore = snap[team].res;
    const explicit = B.matchStats.explicit[team] || { ls:0, ms:0, ice:0, fire:0, seed:0 };
    const clampPos = (a, b, sub) => Math.max(0, (a || 0) - (b || 0) - (sub || 0));
    stat.ls   += clampPos(rNow.luckyStone, rBefore.luckyStone, explicit.ls);
    stat.ms   += clampPos(rNow.moonstone, rBefore.moonstone, explicit.ms);
    stat.ice  += clampPos(rNow.ice, rBefore.ice, explicit.ice);
    stat.fire += clampPos(rNow.fire, rBefore.fire, explicit.fire);
    stat.seed += clampPos(rNow.healingSeed, rBefore.healingSeed, explicit.seed);
    // Damage dealt / KOs scored: enemy ghosts took damage credited to this active
    const enemyTeam = team === 'red' ? 'blue' : 'red';
    const enemyBefore = snap[enemyTeam].ghosts;
    const enemyNow = B[enemyTeam].ghosts;
    enemyNow.forEach((g, i) => {
      const before = enemyBefore[i];
      if (!before) return;
      const dmg = Math.max(0, (before.hp || 0) - (g.hp || 0));
      if (dmg > 0) stat.damageDealt += dmg;
      if (!before.ko && g.ko) {
        stat.kosScored++;
        // Track the LAST KO seen so the final-round KO gets the finishing-blow bonus
        B.matchStats.finishingBlowGhostId = activeF.id;
        B.matchStats.finishingBlowTeam = team;
      }
    });
  });
  // Roll won: credit the winning team's active
  if (roundWinner === 'red' || roundWinner === 'blue') {
    const wActive = active(B[roundWinner]);
    if (wActive) {
      const wStat = ensureMatchStat(roundWinner, wActive.id);
      wStat.rollsWon++;
    }
  }
}

function computeMvpScore(stat, isSurvivor, isFinishingBlow) {
  const ko = (stat.kosScored || 0) * 5;
  const rw = (stat.rollsWon || 0) * 1;
  const dmg = (stat.damageDealt || 0) * 0.5;
  const res = (stat.ls || 0) * 1 + (stat.ms || 0) * 3 + (stat.fire || 0) * 3 + (stat.ice || 0) * 1 + (stat.seed || 0) * 1;
  const surv = isSurvivor ? 3 : 0;
  const fb = isFinishingBlow ? 5 : 0;
  return ko + rw + dmg + res + surv + fb;
}

function pickMatchMvp(winnerTeamName) {
  if (!B || !B.matchStats || (winnerTeamName !== 'red' && winnerTeamName !== 'blue')) return null;
  const team = B[winnerTeamName];
  const stats = B.matchStats[winnerTeamName] || {};
  const fbId = B.matchStats.finishingBlowGhostId;
  const fbTeam = B.matchStats.finishingBlowTeam;
  let best = null;
  team.ghosts.forEach(g => {
    const s = stats[g.id] || { rollsWon:0, kosScored:0, damageDealt:0, ls:0, ms:0, ice:0, fire:0, seed:0 };
    const survived = !g.ko;
    const finishing = (g.id === fbId && fbTeam === winnerTeamName);
    const score = computeMvpScore(s, survived, finishing);
    const candidate = { id: g.id, name: g.name, score, kos: s.kosScored || 0, dmg: s.damageDealt || 0 };
    if (!best) { best = candidate; return; }
    if (candidate.score > best.score) { best = candidate; return; }
    if (candidate.score === best.score) {
      if (candidate.kos > best.kos) { best = candidate; return; }
      if (candidate.kos === best.kos) {
        if (candidate.dmg > best.dmg) { best = candidate; return; }
        if (candidate.dmg === best.dmg && candidate.name.localeCompare(best.name) < 0) { best = candidate; return; }
      }
    }
  });
  return best;
}

let standingsVisibleSets = new Set(['Volcanic Activity','Rolling Hills','Set 1','Dark Castle','Frost Valley']); // all on by default

const RARITY_ORDER = {common:0, uncommon:1, rare:2, 'ghost-rare':3, legendary:4};
const SET_ORDER = ['Set 1','Dark Castle','Frost Valley','Volcanic Activity','Rolling Hills'];
function getSetClass(s) {
  if (s === 'Rolling Hills') return 'set-rolling';
  if (s === 'Volcanic Activity') return 'set-volcanic';
  if (s === 'Set 1') return 'set-set1';
  if (s === 'Dark Castle') return 'set-darkcastle';
  if (s === 'Frost Valley') return 'set-frostvalley';
  return '';
}
function getSetColor(s) {
  if (s === 'Rolling Hills') return 'var(--uncommon)';
  if (s === 'Volcanic Activity') return 'var(--magma)';
  if (s === 'Set 1') return '#c084fc';
  if (s === 'Dark Castle') return '#f87171';
  if (s === 'Frost Valley') return '#67e8f9';
  return 'var(--text2)';
}
function sortBySetThenRarity(a, b) {
  const sa = SET_ORDER.indexOf(a.set);
  const sb = SET_ORDER.indexOf(b.set);
  if (sa !== sb) return sa - sb;
  return (RARITY_ORDER[a.rarity]||0) - (RARITY_ORDER[b.rarity]||0);
}
function sortByRarity(a, b) { return (RARITY_ORDER[a.rarity]||0) - (RARITY_ORDER[b.rarity]||0); }

const CURATED_TEAMS = [
  // ===================== HIGH TIER (15 teams) =====================

  // #1  Valkin's Grand Conquest — Valkin KOs for full resource suite, Bigsby evolves into Doom on Moonstone, Willow +1 die after losses
  [432, 424, 435],
  // #2  Blue Fire Burn Chain — Lucy wins for Sacred Fires, Rascals entry 3 Burn, Mable spends Burn to remove dice + gain Sacred Fire
  [108, 437, 446],
  // #3  Ice Blade Forge — Zain forges Ice Blade from wins, Sylvia free Ice Shards, Finn forges Flame Blade from seeds+fire
  [206, 313, 431],
  // #4  Resurrection Engine — Bo revives on KO + 3 Fireflies, Lucas buffs revived ghost +3HP/+1die, Granny gains resources on ally KO
  [109, 433, 310],
  // #5  Dice Destroyer — Pip triples remove opponent dice permanently, Haywire triples gain permanent die, Willow +1 die after losses
  [418, 78, 435],
  // #6  Resource Avalanche — Chester wins for seeds/fireflies, Twyla spends Lucky Stones for +dice/+seeds, Zippa converts seeds to stones
  [426, 417, 423],
  // #7  Mountain King Doubles — TMK 2X doubles damage, Tabitha +2 doubles damage from sideline, Admiral +2 even doubles from sideline
  [110, 95, 71],
  // #8  Shade Pressure — Shade deals 1 before every roll, Shade's Shadow deals 1 to <4HP from sideline, Princess Shade +1 to pre-roll damage
  [111, 205, 436],
  // #9  Nerina Blitz — Nerina entry 3 damage, Nicholas 2 damage on enemy entry from sideline, Grawr entry 1 damage
  [306, 51, 34],
  // #10 Timber Lockdown — Timber forces discard or -1 die, Dylan blocks enemy before-roll effects + gains Burn, Piper negates effects/-1 die
  [210, 301, 107],
  // #11 Humar Burn Assault — Humar wins for 2 pre-roll damage + Burn, Mable spends Burn to remove dice, Princess Shade +1 pre-roll damage
  [336, 446, 436],
  // #12 Red Hunter Aggro — Red Hunter +3 damage if enemy holds specials, Gordok steals 2 specials on win, Dark Jeff +1 all damage from sideline
  [345, 430, 74],
  // #13 Sacred Fire Engine — Lucy wins for Sacred Fire, Fed & Hayden Sacred Fires don't discard, Lucy's Shadow doubles Lucy's fire damage
  [108, 406, 439],
  // #14 Toby All-In — Toby declares final roll for KO, Guardian Fairy takes hits from sideline, Hector singles beat doubles
  [97, 99, 96],
  // #15 Frost Blade Master — Skylar Ice Shards deal +2, Pal Al wins for 4 Ice Shards, Spockles wins for 2 Ice Shards
  [104, 431, 81],

  // ===================== MID TIER (25 teams) =====================

  // #16 Dark Castle Control — Captain James triples for 2 Sacred Fires, Garrick -1 damage on loss + Sacred Fire on KO, Champ immune to specials
  [443, 427, 438],
  // #17 Rolling Hills Harvest — Farmer Jeff 6s gain Healing Seeds, Aunt Susan spends seeds for +2 damage/heal, Boopies seeds → stones
  [314, 309, 419],
  // #18 Frost Valley Blizzard — Romy predicts die for +3, Marcus 3+ damage taken → 4 extra dice, Pale Nimbus +2 if roll <7 from sideline
  [114, 57, 88],
  // #19 Tank & Spank — Bubble Boys 9HP wall, Bilbo +2 singles damage from sideline, Dark Jeff +1 all damage from sideline
  [44, 80, 74],
  // #20 Volcanic Disruption — Knight Terror enemy loses 2HP on ability trigger, Knight Light gains +1 die on enemy ability, Smudge names number to negate
  [401, 402, 403],
  // #21 Doubles Delight — Doc +5 doubles damage, Tabitha +2 doubles from sideline, Flora +2HP on doubles
  [42, 95, 75],
  // #22 Defensive Wall — Stone Cold 7HP + 3X double-1s, Puff -1 from enemy doubles/triples, Guard Thomas immune to singles below 6HP
  [73, 5, 41],
  // #23 Healing Seed Engine — Young Cap seeds give +1die/+1shard/+1surge, Chow spends seed for +2 dice, Kaplan gains seeds on enemy doubles
  [429, 414, 308],
  // #24 Frost Valley Thieves — Dallas steals 1 die for 2 rolls on entry, Suspicious Jeff steals 1 die on ally win, Outlaw doubles remove 1 die
  [60, 61, 43],
  // #25 Moonstone Madness — Benjamin free Moonstone use, Natalia even doubles → 2 Moonstones, Harvey wins → Moonstones per 5 rolled
  [203, 327, 448],
  // #26 Lucky Stone Payoff — Hank 4s gain Lucky Stones, Twyla spends stones for +dice/+seeds, Selene doubles → 2 seeds or 3 stones
  [305, 417, 207],
  // #27 Burn & Punish — Sable odd rolls gain Sacred Fire, The Ember Force 1 damage before rolling, Rook immune to fire + Surge damage bonus
  [304, 413, 416],
  // #28 Entry Damage Blitz — Grawr 1 damage on entry, Jenkins rolls 4 dice damage on entry, Nicholas 2 damage to enemy on entry
  [34, 94, 51],
  // #29 Simon's Fire Factory — Simon gains Sacred Fire when taking damage, Marcus 3+ damage → 4 extra dice, Mallow removes fire for 3HP from sideline
  [24, 57, 89],
  // #30 Surge Builder — Dart wins for 2 Surge, Boris spends Surge for +2HP, Chagrin loses for 1 Surge
  [209, 343, 404],
  // #31 Chow Kitchen — Chow spends seeds for +2 dice, Farmer Jeff 6s → seeds, Maximo gains seed + stone each round
  [414, 314, 302],
  // #32 Gordok Pirate — Gordok steals 2 specials on win + Moonstone, Nick & Knack steals 1 special + 3HP, Sandwiches mirrors enemy specials
  [430, 409, 33],
  // #33 Frost Valley Snipers — Night Master doubles+win → destroy <4HP sideline ghost, Pelter +2 doubles damage, Bogey reflects damage once
  [103, 86, 53],
  // #34 Redd Entrance — Redd entry +2 dice, Hugo enemy loses die on hit, Floop enemy loses die on doubles
  [98, 52, 20],
  // #35 Volcanic Activity Core — Rook immune to fire + Surge bonus, Sable odd rolls Sacred Fire, The Ember Force 1 pre-roll damage
  [416, 413, 304],
  // #36 HP Swap Gambit — Eloise spends Ice Shard to swap HP, Chad entry 2 Ice Shards, Sad Sal loses → Ice Shard
  [85, 56, 29],
  // #37 Wandering Sue Sniper — Sue destroys 12+ HP enemies, Villager +1HP on wins from sideline, Shoo +2HP when <4HP from sideline
  [84, 11, 13],
  // #38 Midrange Doubles — Prince Balatron counter die on survive loss, Kairan doubles → +1 die, Laura numeric order → +3 damage
  [113, 68, 79],
  // #39 Castle Guards Threes — Castle Guards 3s multiply damage by 2, Zach +3 doubles damage for Guard Thomas (but Guards benefit from 3s), Lou +1dmg/+1HP for Grawr from sideline
  [39, 87, 88],
  // #40 Jasper Glass Cannon — Jasper wins → bonus die damage + self-damage, Bilbo +2 singles from sideline, Dark Jeff +1 all damage
  [428, 80, 74],

  // ===================== FUN / MEME TIER (10 teams) =====================

  // #41 Glass Cannon Squad — all tiny HP, maximum chaos
  [8, 205, 410],   // Buttons 1HP triple-6 dream + Shade's Shadow <4HP poke + Mirror Matt reflects doubles
  // #42 Mirror Theft — Mirror Matt reflects doubles, Nick & Knack steals specials, Outlaw removes dice on doubles
  [410, 409, 43],
  // #43 Tie Party — Jimmy ties for 5 stones + firefly, Goobs ties for 2 fireflies each, Ancient One +3HP on ties from sideline
  [352, 444, 22],
  // #44 Tommy Salami Chain-6s — Tommy 6s chain extra dice, Rascals entry 3 Burn for fuel, Lars entry resources
  [30, 437, 420],
  // #45 All Legendary Showdown — Bo revives, Shade pre-roll damage, Selene doubles for resources
  [109, 111, 305],
  // #46 Buttons & Needle Dream — Buttons triple-6 for +15, Needle gives Buttons +1 die from sideline, Tabitha +2 doubles from sideline
  [8, 21, 95],
  // #47 Dupy Coin Flip — Dupy ties instant KO, Hermit entry HP per defeated ghosts, Little Boo turns enemy triples into 1-2-3
  [12, 47, 9],
  // #48 Fang Tag Team — Fang Outside swaps on win, Fang Undercover swaps on damage, Doug swaps once + gains die
  [6, 7, 63],
  // #49 Chaos Reroll — Jackson removes HP to reroll dice, Sonya changes die to 2, Dealer numeric order negates damage
  [50, 69, 37],
  // #50 Wanderer's Gambit — Wanderer 8HP reveals hidden cards, Cameron negated damage destroys enemy, Masked Hero punishes before-roll effects
  [4, 25, 55],
];

// --- Quick-fill helpers (Wyatt Directive 2026-04-11) ---
// Picks a curated 3-ghost composition. excludeIds prevents overlap with the other team.
function getCuratedTeam(excludeIds = []) {
  const validIds = new Set(GHOSTS.filter(g => !SHELVED_IDS.has(g.id)).map(g => g.id));
  const available = CURATED_TEAMS.filter(team =>
    team.every(id => validIds.has(id)) &&
    !team.some(id => excludeIds.includes(id))
  );
  if (available.length === 0) return getRandomTeamFallback(excludeIds);
  return [...available[Math.floor(Math.random() * available.length)]];
}

// Fallback: purely random team when no curated team fits (e.g. extreme overlap)
function getRandomTeamFallback(excludeIds = []) {
  const pool = GHOSTS.filter(g => !SHELVED_IDS.has(g.id) && !excludeIds.includes(g.id));
  const picks = [];
  let hasLegendary = false;
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  for (const g of shuffled) {
    if (picks.length >= 3) break;
    if (g.rarity === 'legendary') {
      if (hasLegendary) continue;
      hasLegendary = true;
    }
    picks.push(g.id);
  }
  return picks;
}

function pickRandomTeam(team) {
  const other = S[team === 'red' ? 'bluePicks' : 'redPicks'];
  S[`${team}Picks`] = getCuratedTeam(other);
  renderPicks();
}

// Fills both teams at once with two non-overlapping curated teams.
function pickRandomBoth() {
  S.redPicks = getCuratedTeam([]);
  S.bluePicks = getCuratedTeam(S.redPicks);
  renderPicks();
}

// ============================================================
// BATTLE ENGINE
// ============================================================
function ghostData(id) { return GHOSTS.find(g=>g.id===id); }

function makeTeam(ids) {
  return {
    ghosts: ids.map(id => {
      const g = ghostData(id);
      return { id, name:g.name, hp:g.maxHp, maxHp:g.maxHp, ko:false, ability:g.ability, abilityDesc:g.abilityDesc, rarity:g.rarity,
        hankFirstRoll:false, maximoFirstRoll:false, usedMagicTouch:false };
    }),
    activeIdx: 0,
    resources: { moonstone:0, ice:0, fire:0, surge:0, healingSeed:0, luckyStone:0, firefly:0 }
  };
}

function active(t) { return t.ghosts[t.activeIdx]; }
function opp(team) { return team===B.red ? B.blue : B.red; }
function teamName(team) { return team===B.red ? 'Red' : 'Blue'; }

let B = null; // battle state
let prevResources = { red: {}, blue: {} }; // for resource-gained flash

function log(html) { B.log.unshift(html); }

function startBattle() {
  prevResources = { red: {}, blue: {} };
  narrateQueue = []; narrateActive = false;
  B = {
    red: makeTeam(S.redPicks), blue: makeTeam(S.bluePicks),
    round:1, log:[], phase:'ready',
    pendingMoonstone:null, pendingSteal:null,
    // === DUEL PHASE ===
    // Lower-HP loser goes first in the pre-roll commit phase. Toggle off to revert to simultaneous.
    duelPhaseMode: true,
    duelPriority: null,     // 'red' | 'blue' | null — who goes first THIS round's Duel Phase (null = simultaneous)
    duelActiveTeam: null,   // who is currently acting during Duel Phase (gates clicks)
    duelLastLoser: null,    // team that lost the previous roll (null on tie or round 1)
    committed: { red: { ice:0, fire:0, surge:0, auntSusan:0, auntSusanHeal:0, harrison:0, zainBlade:0 }, blue: { ice:0, fire:0, surge:0, auntSusan:0, auntSusanHeal:0, harrison:0, zainBlade:0 } },
    retributionDice: { red: 0, blue: 0 },
    pressureUsed: { red: false, blue: false },
    romyPrediction: { red: null, blue: null },
    pureHeartDeclared: { red: null, blue: null },
    pureHeartScheduledKO: { red: false, blue: false },
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
    galeForcePending: { red: false, blue: false },
    galeForceDecided: { red: false, blue: false },
    alucardUsed: { red: false, blue: false },
    jacksonUsedThisRound: { red: false, blue: false },
    sonyaUsedThisRound: { red: false, blue: false },
    darkWingUsedThisGame: { red: false, blue: false },
    haywireBonus: { red: 0, blue: 0 },
    haywireDamageBonus: { red: 0, blue: 0 },
    chowDecided: { red: false, blue: false },
    cultivateDecided: { red: false, blue: false },
    willowLostLast: { red: false, blue: false },
    haywireUsed: { red: false, blue: false },
    mallowDecided: { red: false, blue: false },
    jeanieUsed: { red: false, blue: false },
    raditzHuntReady: { red: false, blue: false },
    dougCautionUsed: { red: false, blue: false },
    dougCautionDieBonus: { red: false, blue: false },
    jeffSnicker: { red: 0, blue: 0 },
    pendingLucyDmg: { red: 0, blue: 0 },
    fangUndercoverArmed: { red: false, blue: false },
    fangUndercoverSwapPending: null,
    winstonSchemePending: null,
    galeForcePicker: null,
    scallywagsFrenzyBonus: { red: 0, blue: 0 },
    floopMuck: { red: 0, blue: 0 },
    tylerDecidedThisRound: { red: false, blue: false },
    booTeamworkDecidedThisRound: { red: false, blue: false },
    tylerHeatUpDieBonus: { red: 0, blue: 0 },
    booTeamworkDieDebt: { red: 0, blue: 0 },
    pipToastedUsed: { red: false, blue: false },
    pipDieRemoval: { red: 0, blue: 0 },
    luckyStoneSpentThisTurn: { red: 0, blue: 0 },
    preRollAbilitiesFiredThisTurn: { red: false, blue: false },
    burn: { red: {}, blue: {} },
    lucasKindlingBonus: { red: 0, blue: 0 },
    iceBladeForgedPermanent: { red: false, blue: false },
    flameBlade: { red: false, blue: false },
    flameBladeSwing: { red: false, blue: false },
    iceBladeSwing: { red: false, blue: false },
    gordokDieBonus: { red: 0, blue: 0 },
    hexDieRemoval: { red: 0, blue: 0 },
  };
  S.battle = B;
  initMatchStats();
  if (document.getElementById('team-select')) document.getElementById('team-select').style.display = 'none';
  document.getElementById('battle-view').style.display = 'block';
  const appEl = document.querySelector('.app');
  if (appEl) appEl.classList.add('battle-active');
  startMusic();
  log('<span class="log-round">Battle begins!</span>');
  renderBattle();

  // Disable roll buttons until everything is done
  const rBtn = document.getElementById('rollRedBtn');
  const bBtn = document.getElementById('rollBlueBtn');
  if (rBtn) { rBtn.disabled = true; }
  if (bBtn) { bBtn.disabled = true; }

  // Show VS splash FIRST, then entry abilities cinematic sequence
  const splash = document.getElementById('vsSplash');
  if (splash) {
    document.getElementById('vsRedName').textContent = active(B.red).name;
    document.getElementById('vsBlueName').textContent = active(B.blue).name;
    const redBench = B.red.ghosts.filter((g,i) => i !== B.red.activeIdx).map(g => g.name);
    const blueBench = B.blue.ghosts.filter((g,i) => i !== B.blue.activeIdx).map(g => g.name);
    document.getElementById('vsRedRoster').textContent = redBench.join(' / ');
    document.getElementById('vsBlueRoster').textContent = blueBench.join(' / ');
    splash.classList.add('active');
    setTimeout(() => {
      splash.classList.remove('active');
      // VS splash done — now fire entry abilities cinematically.
      // Duel Phase v1: ENTRY EFFECT ORDER matches the Duel Phase priority.
      // Lower-HP ghost's entry fires first (the underdog strikes). If HP tied,
      // compute priority via the helper (which uses rarity and finally coin flip).
      // If fully symmetric (mirror match), fall back to Red-first as before.
      const _priority = computeDuelPriority();
      const firstTeam  = (_priority === 'blue') ? B.blue : B.red;
      const secondTeam = (_priority === 'blue') ? B.red  : B.blue;
      const firstEntryCount = triggerEntry(firstTeam);
      renderBattle();
      const firstEntryDelay = firstEntryCount > 0 ? firstEntryCount * 1500 : 300;
      setTimeout(() => {
        const secondEntryCount = triggerEntry(secondTeam);
        renderBattle();
        const secondEntryDelay = secondEntryCount > 0 ? secondEntryCount * 1500 : 300;
        setTimeout(() => {
          // All entry effects done — check for KOs, then enable rolling
          if (handleKOs()) return;
          // Duel Phase v1: check for priority before unlocking rolls
          startNextRound();
          narrate(`<b class="gold">Round 1</b> — <b class="red-text">${active(B.red).name}</b>&nbsp;vs&nbsp;<b class="blue-text">${active(B.blue).name}</b> — <b class="gold">Fight!</b>`);
        }, secondEntryDelay);
      }, firstEntryDelay);
    }, 2200);
  } else {
    // No splash — fire entries in Duel Phase priority order, then enable
    const _priority2 = computeDuelPriority();
    const firstTeam2  = (_priority2 === 'blue') ? B.blue : B.red;
    const secondTeam2 = (_priority2 === 'blue') ? B.red  : B.blue;
    triggerEntry(firstTeam2);
    triggerEntry(secondTeam2);
    renderBattle();
    if (handleKOs()) return;
    narrate(`<b class="gold">Round 1</b> — <b class="red-text">${active(B.red).name}</b>&nbsp;vs&nbsp;<b class="blue-text">${active(B.blue).name}</b> — <b class="gold">Fight!</b>`);
    if (rBtn) { rBtn.disabled = false; rBtn.classList.add('pulse'); }
    if (bBtn) { bBtn.disabled = false; bBtn.classList.add('pulse'); }
  }
}

function triggerEntry(team, skipEntryEffects) {
  const f = active(team);
  const enemy = opp(team);
  if (skipEntryEffects) return 0; // Tyson's Hop: no entry effects

  const entryTeamName = team === B.red ? 'red' : 'blue';
  narrate(`<b class="${entryTeamName}-text">${f.name}</b> enters the arena!`);

  // Castle Guide (420) — Burn: check if the entering ghost has burn on it
  // Mike (445) — Torrent: while Mike is on the team (sideline), entering ghosts are immune to Burn
  let burnEntryFired = false;
  if (B.burn && B.burn[entryTeamName]) {
    const activeIdx = team.activeIdx;
    const burnCount = B.burn[entryTeamName][activeIdx] || 0;
    // Mike (445) — Torrent: if Mike is on the sideline of this team, burn is consumed but deals 0
    const mikeProtects = hasSideline(team, 445);
    if (burnCount > 0 && !f.ko && mikeProtects) {
      // Mike's Torrent: sideline immune to Burn — consume burn, deal 0
      delete B.burn[entryTeamName][activeIdx];
      burnEntryFired = true;
      showAbilityCallout('TORRENT!', 'var(--rare)', `Mike — Torrent! Sideline immune to Burn! ${f.name} takes no damage.`, entryTeamName);
      log(`<span class="log-ability">Mike</span> — Torrent! <span class="log-heal">Sideline immune to Burn!</span> ${f.name} takes no damage.`);
    } else if (burnCount > 0 && !f.ko && f.id !== 416) {
      const burnPre = f.hp;
      f.hp = Math.max(0, f.hp - burnCount);
      if (f.hp <= 0) { f.ko = true; f.killedBy = -2; } // burn kill
      delete B.burn[entryTeamName][activeIdx];
      burnEntryFired = true;
      showAbilityCallout('BURN!', 'var(--accent)', `${f.name} takes ${burnCount} burn damage on entry! (${burnPre} → ${f.hp} HP)${f.ko ? ' KO!' : ''}`, entryTeamName);
      log(`<span class="log-dmg">${f.name}</span> — Burn! <span class="log-dmg">${burnCount} damage on entry!</span> (${burnPre} → ${f.hp} HP)${f.ko ? ' <span class="log-ko">KO!</span>' : ''}`);
    } else if (burnCount > 0 && f.id === 416) {
      // Rook (416) — Immune to Burn: consume burn but take no damage
      delete B.burn[entryTeamName][activeIdx];
      burnEntryFired = true;
      showAbilityCallout('BURN IMMUNE!', 'var(--rare)', `${f.name} — Immune to Burn! No damage taken.`, entryTeamName);
      log(`<span class="log-ability">${f.name}</span> — <span class="log-heal">Immune to Burn!</span> No damage taken.`);
    }
  }

  // Collect all entry callouts (entry ability + any Knight reactions) into a sequential array,
  // then fire them with 1500ms spacing. This prevents HEAVY AIR! / RETRIBUTION! from
  // instantly stomping the entry callout (same sequential-stomp pattern fixed in v90–v95
  // for Selene, Timber modal, Timber forced-auto, and Harrison Ascend).
  const entryCallouts = [];

  // Helper: collect Knight reactions into entryCallouts via temporary queue mode
  const collectKnightReactions = () => {
    const savedQ = abilityQueue;
    abilityQueue = [];
    abilityQueueMode = true;
    checkKnightEffects(entryTeamName, f.name);
    abilityQueue.forEach(item => entryCallouts.push([item.name, item.color, item.desc, item.team]));
    abilityQueue = savedQ;
    abilityQueueMode = false;
  };

  // Bouril (201) — Slumber: first roll is auto 1-2-3
  if (f.id === 201) {
    f.hankFirstRoll = true;
    entryCallouts.push(['SLUMBER!', 'var(--uncommon)', `${f.name} — first roll locked to 1-2-3!`, entryTeamName]);
    log(`<span class="log-ability">${f.name}</span> enters lazily — first roll will be 1-2-3.`);
    collectKnightReactions();
  }

  // Zain (206) — Ice Blade: opt-in pre-roll forge button (see useZainForge), no entry effect

  // Nerina (306) — Leviathan: deal 3 damage to enemy active
  if (f.id === 306) {
    const ef = active(enemy);
    if (!ef.ko) {
      ef.hp = Math.max(0, ef.hp - 3);
      if (ef.hp <= 0) { ef.ko = true; ef.killedBy = (f.originalId || f.id); }
      const enemyName = enemy === B.red ? 'red' : 'blue';
      entryCallouts.push(['LEVIATHAN!', 'var(--legendary)', `${f.name} — 3 entry damage to ${ef.name}!`, entryTeamName]);
      log(`<span class="log-ability">${f.name}</span> — Leviathan! <span class="log-dmg">3 entry damage to ${ef.name}!</span> ${ef.ko?'<span class="log-ko">KO!</span>':ef.hp+' HP left'}`);
      playDamageSfx(3);
      hitDamage(enemyName);
      collectKnightReactions();
    }
  }

  // Maximo (302) — Nap: first roll is 1 die
  if (f.id === 302) {
    f.maximoFirstRoll = true;
    entryCallouts.push(['NAP!', 'var(--common)', `${f.name} — first roll is 1 die only!`, entryTeamName]);
    log(`<span class="log-ability">${f.name}</span> is napping... first roll will be only 1 die.`);
    collectKnightReactions();
  }

  // Redd (98) — Notorious: first roll after entry gets +2 extra dice
  if (f.id === 98) {
    f.reddFirstRoll = true;
    entryCallouts.push(['NOTORIOUS!', 'var(--ghost-rare)', `${f.name} — +2 dice for this roll!`, entryTeamName]);
    log(`<span class="log-ability">${f.name}</span> — Notorious! Enters with +2 bonus dice for the first roll!`);
    collectKnightReactions();
  }

  // Jenkins (94) — Greeting: on entry, roll 4 dice and deal damage by roll TYPE (not sum).
  // Boo's dice combat uses singles=1, doubles=2, triples=3, quads=4, penta=5 — Jenkins is no
  // exception. The advantage of 4 dice is better odds of hitting doubles/triples/quads, not a
  // bigger damage number. Previously this summed the dice face values (bug: 4×6=24 possible).
  if (f.id === 94) {
    const ef = active(enemy);
    if (!ef.ko) {
      const jenkinsDice = rollDice(4);
      const jenkinsRoll = classify(jenkinsDice);
      const jenkinsDmg = jenkinsRoll.damage; // 1/2/3/4/5 by roll type
      ef.hp = Math.max(0, ef.hp - jenkinsDmg);
      if (ef.hp <= 0) { ef.ko = true; ef.killedBy = (f.originalId || f.id); }
      const enemyName = enemy === B.red ? 'red' : 'blue';
      const rollLabel = describeRoll(jenkinsRoll);
      entryCallouts.push(['GREETING!', 'var(--ghost-rare)',
        `${f.name} — rolled [${jenkinsDice.join(', ')}] — ${rollLabel} → ${jenkinsDmg} entry damage to ${ef.name}!`, entryTeamName]);
      log(`<span class="log-ability">${f.name}</span> — Greeting! Rolled [${jenkinsDice.join(', ')}] — ${rollLabel} → <span class="log-dmg">${jenkinsDmg} entry damage to ${ef.name}!</span> ${ef.ko ? '<span class="log-ko">KO!</span>' : ef.hp + ' HP left'}`);
      playDamageSfx(jenkinsDmg);
      hitDamage(enemyName);
      collectKnightReactions();
    }
  }

  // Timber (210) — Howl: no entry callout; the pre-roll Howl modal/callout handles it every round

  // Timpleton (312) — Big Target: v640 rework — moved from Entry strike to Win-roll damage multiplier.
  // New logic lives in _resolveRoundImpl near Red Hunter (345) (search: "Timpleton (312) — Big Target").

  // Grawr (34) — Menace: on entry, deal 1 damage to the enemy active ghost
  if (f.id === 34) {
    const ef = active(enemy);
    if (!ef.ko) {
      ef.hp = Math.max(0, ef.hp - 1);
      if (ef.hp <= 0) { ef.ko = true; ef.killedBy = (f.originalId || f.id); }
      const enemyName = enemy === B.red ? 'red' : 'blue';
      entryCallouts.push(['MENACE!', 'var(--uncommon)', `${f.name} — 1 entry damage to ${ef.name}!`, entryTeamName]);
      log(`<span class="log-ability">${f.name}</span> — Menace! <span class="log-dmg">1 entry damage to ${ef.name}!</span> ${ef.ko ? '<span class="log-ko">KO!</span>' : ef.hp + ' HP left'}`);
      playDamageSfx(1);
      hitDamage(enemyName);
      collectKnightReactions();
    }
  }

  // Hermit (47) — Solitude: on entry, gain +2 HP per ghost defeated on both teams
  if (f.id === 47) {
    const koCount = [...B.red.ghosts, ...B.blue.ghosts].filter(g => g.ko).length;
    if (koCount > 0) {
      const gain = koCount * 2;
      const before = f.hp;
      f.hp += gain; // allow overclock — late-game scaling tank
      entryCallouts.push(['SOLITUDE!', 'var(--uncommon)', `${f.name} — +${gain} HP from ${koCount} fallen ghost${koCount > 1 ? 's' : ''}! (${before}→${f.hp} HP)`, entryTeamName]);
      log(`<span class="log-ability">${f.name}</span> — Solitude! +${gain} HP from ${koCount} fallen ghosts. (${before}→${f.hp} HP)`);
    } else {
      entryCallouts.push(['SOLITUDE!', 'var(--uncommon)', `${f.name} — No fallen ghosts yet. Waiting...`, entryTeamName]);
      log(`<span class="log-ability">${f.name}</span> — Solitude! No fallen ghosts yet.`);
    }
  }

  // Chad (56) — Sploop!: on entry, gain 2 Ice Shards
  // Sandwiches (33) Dependable: opponent mirrors the Ice Shard gain.
  if (f.id === 56) {
    team.resources.ice += 2;
    entryCallouts.push(['SPLOOP!', 'var(--uncommon)', `${f.name} — +2 Ice Shards! (${team.resources.ice} total)`, entryTeamName]);
    log(`<span class="log-ability">${f.name}</span> — Sploop! Gained <span class="log-ice">2 Ice Shards</span>! (${team.resources.ice} total)`);
    collectKnightReactions();
    if (hasSideline(enemy, 33)) {
      enemy.resources.ice += 2;
      entryCallouts.push(['DEPENDABLE!', 'var(--common)', `Sandwiches — mirrors Sploop! +2 Ice Shards! (${enemy.resources.ice} total)`, entryTeamName === 'red' ? 'blue' : 'red']);
      log(`<span class="log-ability">Sandwiches</span> — Dependable! Mirrors Sploop: +<span class="log-ice">2 Ice Shards</span>! (${enemy.resources.ice} total)`);
    }
  }

  // Raditz (62) — Hunt: on entry, may force opponent to swap their active ghost (one-time)
  // Prime the Hunt flag so it fires before Raditz's first roll (handled in rollReady).
  if (f.id === 62 && !skipEntryEffects) {
    const teamName = team === B.red ? 'red' : 'blue';
    const enemySideline = enemy.ghosts.filter((g, i) => i !== enemy.activeIdx && !g.ko);
    if (enemySideline.length > 0) {
      if (!B.raditzHuntReady) B.raditzHuntReady = { red: false, blue: false };
      B.raditzHuntReady[teamName] = true;
      entryCallouts.push(['HUNT!', 'var(--rare)', `${f.name} — may force an opponent swap before rolling!`, entryTeamName]);
      log(`<span class="log-ability">${f.name}</span> — Hunt! Primed — choose to force an opponent swap before rolling.`);
    }
  }

  // Dallas (60) — Quick Draw: on entry from sideline, prime die theft for first 2 rolls
  if (f.id === 60) {
    f.dallasQuickDraw = 2;
    entryCallouts.push(['QUICK DRAW!', 'var(--uncommon)', `${f.name} — stealing 1 opponent die for the next 2 rolls!`, entryTeamName]);
    log(`<span class="log-ability">${f.name}</span> — Quick Draw! Steals 1 opponent die for the first 2 rolls.`);
    collectKnightReactions();
  }

  // Lars (420) — Light the Way: entry → +1 Surge, +1 Lucky Stone, +1 Burn (as resource — player clicks to place)
  if (f.id === 420) {
    team.resources.surge++;
    team.resources.luckyStone++;
    if (!team.resources.burn) team.resources.burn = 0;
    team.resources.burn++;
    entryCallouts.push(['LIGHT THE WAY!', 'var(--uncommon)', `${f.name} — Entry! +1 Surge, +1 Lucky Stone, +1 Burn!`, entryTeamName]);
    log(`<span class="log-ability">${f.name}</span> — Light the Way! <span class="log-ms">+1 Surge, +1 Lucky Stone, +1 Burn!</span>`);
    collectKnightReactions();
  }

  // Rascals (437) — Stampede: Entry → gain 3 Burn
  if (f.id === 437 && !f.ko) {
    if (!team.resources.burn) team.resources.burn = 0;
    team.resources.burn += 3;
    entryCallouts.push(['STAMPEDE!', 'var(--common)', `${f.name} — Entry! +3 Burn!`, entryTeamName]);
    log(`<span class="log-ability">${f.name}</span> — Stampede! Entry → <span class="log-dmg">+3 Burn!</span>`);
    collectKnightReactions();
  }

  // Nicholas (51) — Sneak Attack: while on the sideline, deal 2 damage to the entering ghost
  // Does NOT fire at battle start (round 1) — sideline hasn't "flipped" yet. Only fires on mid-battle swaps.
  if (hasSideline(enemy, 51) && !f.ko && B.round > 1) {
    const nicholasGhost = getSidelineGhost(enemy, 51);
    f.hp = Math.max(0, f.hp - 2);
    if (f.hp <= 0) { f.ko = true; f.killedBy = 51; }
    const enteringTeamName = team === B.red ? 'red' : 'blue';
    const nicholasTeamName = enteringTeamName === 'red' ? 'blue' : 'red';
    entryCallouts.push(['SNEAK ATTACK!', 'var(--uncommon)',
      `${nicholasGhost.name} — 2 damage to ${f.name} on entry!`, nicholasTeamName]);
    log(`<span class="log-ability">${nicholasGhost.name}</span> — Sneak Attack! <span class="log-dmg">2 damage to ${f.name} on entry!</span> ${f.ko ? '<span class="log-ko">KO!</span>' : f.hp + ' HP left'}`);
    playDamageSfx(2);
    hitDamage(enteringTeamName);
    // Knight reactions: Nicholas's ability belongs to the enemy team — the entering team may counter.
    // Use nicholasTeamName (not entryTeamName) so Knight Terror/Light on the ENTERING side
    // correctly punish/reward in response to the enemy ability (not double-punish the entering ghost).
    const savedQN = abilityQueue;
    abilityQueue = [];
    abilityQueueMode = true;
    checkKnightEffects(nicholasTeamName, nicholasGhost.name);
    abilityQueue.forEach(item => entryCallouts.push([item.name, item.color, item.desc, item.team]));
    abilityQueue = savedQN;
    abilityQueueMode = false;
  }

  // Fire all entry callouts sequentially — each 1500ms after the previous
  // c[3] = team string for card-glow spotlight; undefined = narrator-only fallback
  entryCallouts.forEach((c, i) => {
    setTimeout(() => showAbilityCallout(c[0], c[1], c[2], c[3]), i * 1500);
  });
  return entryCallouts.length;
}

function rollDice(n) {
  const d = [];
  for (let i=0;i<n;i++) d.push(Math.floor(Math.random()*6)+1);
  return d.sort((a,b)=>a-b);
}

// Weighted roll — cinematic luck system
// Subtle nudges that make tight moments more exciting:
// - 1 HP: 25% chance of forced doubles (3-6 value) — clutch comeback energy
// - 2 HP: 15% chance of forced doubles — still dangerous but not as desperate
// - 5+ dice: 10% penta nudge — reward the player for earning extra dice
// - General: low HP rolls get a slight quality boost (reroll lowest die if below average)
function weightedRoll(team, count) {
  const dice = [];
  for (let i = 0; i < count; i++) dice.push(Math.floor(Math.random()*6)+1);
  if (!B || !B[team]) return dice.sort((a,b)=>a-b);
  const f = active(B[team]);

  // Penta nudge: 5+ dice → 10% chance all dice match (huge cinematic moment)
  if (count >= 5 && Math.random() < 0.10) {
    const v = Math.ceil(Math.random()*4)+2; // 3–6 for exciting penta
    for (let i = 0; i < dice.length; i++) dice[i] = v;
    return dice.sort((a,b)=>a-b);
  }

  // Clutch doubles: low HP → chance of forced doubles
  if (f && f.hp === 1 && Math.random() < 0.25) {
    const v = Math.ceil(Math.random()*4)+2; // 3–6
    dice[0] = v;
    if (dice.length >= 2) dice[1] = v;
  } else if (f && f.hp === 2 && Math.random() < 0.15) {
    const v = Math.ceil(Math.random()*4)+2;
    dice[0] = v;
    if (dice.length >= 2) dice[1] = v;
  }

  // Low HP quality boost: if at 1-2 HP, reroll the lowest die if it's below 3
  // Subtle — just nudges the floor up slightly so you're less likely to get crushed
  if (f && f.hp <= 2 && f.hp > 0 && dice.length >= 2) {
    const minIdx = dice.indexOf(Math.min(...dice));
    if (dice[minIdx] <= 2 && Math.random() < 0.30) {
      dice[minIdx] = Math.ceil(Math.random()*3)+3; // reroll to 4-6
    }
  }

  return dice.sort((a,b)=>a-b);
}

// AFK timer — pulse roll buttons after 5s of inactivity (Feature 10)
let afkTimer = null;
function resetAfkTimer() {
  clearTimeout(afkTimer);
  document.querySelectorAll('#rollRedBtn, #rollBlueBtn').forEach(b => b.classList.remove('pulse'));
  afkTimer = setTimeout(() => {
    if (B && B.phase === 'ready') {
      document.querySelectorAll('#rollRedBtn, #rollBlueBtn').forEach(b => {
        if (!b.disabled && !b.classList.contains('locked')) b.classList.add('pulse');
      });
    }
  }, 5000);
}

function classify(dice) {
  if (!dice||!dice.length) return {type:'none',value:0,damage:0};
  if (dice.length === 1) return {type:'singles',value:dice[0],damage:1};
  const c = {};
  dice.forEach(d=>c[d]=(c[d]||0)+1);
  const mx = Math.max(...Object.values(c));
  const vals = Object.entries(c).filter(([,v])=>v===mx).map(([k])=>+k);
  const mv = Math.max(...vals);
  if (mx>=5) return {type:'penta',value:mv,damage:5};
  if (mx>=4) return {type:'quads',value:mv,damage:4};
  if (mx>=3) return {type:'triples',value:mv,damage:3};
  if (mx>=2) return {type:'doubles',value:mv,damage:2};
  return {type:'singles',value:Math.max(...dice),damage:1};
}

function describeRoll(r) {
  if (r.type==='penta') return `five ${r.value}'s!`;
  if (r.type==='quads') return `four ${r.value}'s!`;
  if (r.type==='triples') return `three ${r.value}'s`;
  if (r.type==='doubles') return `two ${r.value}'s`;
  return `${r.value} high`;
}

function isTripleOrBetter(type) { return ['triples','quads','penta'].includes(type); }

function typeLabel(type) {
  if (type==='penta') return 'PENTA!!';
  if (type==='quads') return 'QUADS!';
  if (type==='triples') return 'TRIPLES!';
  if (type==='doubles') return 'DOUBLES!';
  return '';
}

// Helper: check if a team has a ghost with given id on sideline (alive)
function hasSideline(team, id) {
  return team.ghosts.some((g,i) => i !== team.activeIdx && !g.ko && g.id === id);
}
function getSidelineGhost(team, id) {
  return team.ghosts.find((g,i) => i !== team.activeIdx && !g.ko && g.id === id);
}

// Pop a sideline card to foreground when its ability triggers
function popSidelineCard(teamObj, ghostId) {
  const teamName = teamObj === B.red ? 'red' : 'blue';
  const sl = teamObj.ghosts.filter((g,i) => i !== teamObj.activeIdx);
  const slIdx = sl.findIndex(g => g.id === ghostId);
  if (slIdx < 0) return;
  const elId = slIdx === 0 ? `${teamName}-sl-left` : `${teamName}-sl-right`;
  const el = document.getElementById(elId);
  if (!el) return;
  el.classList.add('sideline-pop');
  setTimeout(() => el.classList.remove('sideline-pop'), 1300);
}

// Helper: check if opponent has Dylan (301) on sideline to negate before-roll effects
function dylanNegates(enemyTeam) {
  // Dylan (301) sideline OR Piper (107) active — both negate enemy before-rolling effects
  const enemyActive = active(enemyTeam);
  return hasSideline(enemyTeam, 301) || (enemyActive && enemyActive.id === 107 && !enemyActive.ko);
}

// Helper: count occurrences of a value in dice array
function countVal(dice, val) { return dice.filter(d => d === val).length; }

// Helper: check if dice contain doubles (at least two of same value)
function hasDoubles(dice) {
  const c = {};
  dice.forEach(d => c[d] = (c[d]||0)+1);
  return Object.values(c).some(v => v >= 2);
}

// Helper: check if dice have even doubles (2s, 4s, or 6s)
function hasEvenDoubles(dice) {
  const c = {};
  dice.forEach(d => c[d] = (c[d]||0)+1);
  return (c[2] >= 2) || (c[4] >= 2) || (c[6] >= 2);
}

// Boris (343) — Fortify: when surge is spent, Boris gains 2 HP (overclocks past maxHp)
function triggerBorisHook(team) {
  team.ghosts.forEach(g => {
    if (g.id === 343 && !g.ko) {
      const before = g.hp;
      g.hp += 2; // overclocks — no cap
      log(`<span class="log-heal">${g.name}</span> — Fortify! Surge spent → +2 HP (${before}→${g.hp}/${g.maxHp}${g.hp > g.maxHp ? ' · overclocked!' : ''}).`);
    }
  });
}

// ========================================
// RESOURCE SPENDING
// ========================================
function cycleCommit(team, type) {
  if (!isPreRollActive(team)) return;
  const t = B[team];
  const c = B.committed[team];
  const f = active(t);
  const total = t.resources[type] + c[type];
  if (total <= 0) return;
  // Sylvia (313) — Free Ice Shards: commit without consuming, but cap at actual ice count
  if (type === 'ice' && f && f.id === 313) {
    const sylviaIceMax = t.resources.ice; // actual ice held (never decremented for Sylvia)
    if (c.ice < sylviaIceMax) {
      c.ice++;
      // Don't decrement t.resources.ice — ice is free for Sylvia
    } else {
      c.ice = 0; // cycle back to zero (uncommit)
    }
  } else {
    c[type]++;
    t.resources[type]--;
    if (c[type] > total) {
      t.resources[type] = total;
      c[type] = 0;
    }
  }
  // Narrate what just happened
  const teamLabel = team.charAt(0).toUpperCase() + team.slice(1);
  if (c[type] === 0) {
    narrate(`<b class="${team}-text">${teamLabel}</b> cleared ${type === 'ice' ? 'Ice Shards' : type === 'fire' ? 'Sacred Fires' : 'Surge'}.`);
  } else if (type === 'ice') {
    narrate(`<b class="${team}-text">${teamLabel}</b> committed <b>${c[type]} Ice Shard${c[type]>1?'s':''}</b> — <b class="gold">+${c[type]} damage</b> if you win!`);
  } else if (type === 'fire') {
    narrate(`<b class="${team}-text">${teamLabel}</b> committed <b>${c[type]} Sacred Fire${c[type]>1?'s':''}</b> — <b class="gold">+${c[type]*3} damage</b> if you win!`);
  } else if (type === 'surge') {
    narrate(`<b class="${team}-text">${teamLabel}</b> committed <b>${c[type]} Surge</b> — <b class="gold">+${c[type]} ${c[type]>1?'dice':'die'}</b> this roll!`);
  }
  playSfx('sfxSpecial', 0.3);
  renderBattle();
}

function refundCommitted() {
  ['red', 'blue'].forEach(team => {
    const t = B[team];
    const c = B.committed[team];
    const f = active(t);
    // Sylvia (313) — ice was never consumed, so don't refund it
    if (!(f && f.id === 313)) {
      t.resources.ice += c.ice;
    }
    t.resources.fire += c.fire;
    t.resources.surge += c.surge;
    t.resources.healingSeed += c.auntSusan + c.auntSusanHeal + c.harrison;
    B.committed[team] = { ice:0, fire:0, surge:0, auntSusan:0, auntSusanHeal:0, harrison:0, zainBlade:0 };
  });
}

function spendHealingSeed(team) {
  if (!isPreRollActive(team)) return;
  const t = B[team];
  const f = active(t);
  if (t.resources.healingSeed <= 0 || f.hp >= f.maxHp) return;
  t.resources.healingSeed--;
  f.hp = Math.min(f.maxHp, f.hp + 1);
  playSfx('sfxSpecial', 0.4);
  log(`<span class="log-heal">${f.name}</span> used a Healing Seed! Healed to ${f.hp} HP.`);

  // Young Cap (429) — Energize: when active uses a Healing Seed, +1 die this roll + 1 Ice Shard + 1 Surge
  if (f.id === 429 && !f.ko) {
    if (!f.youngCapDieBonus) f.youngCapDieBonus = 0;
    f.youngCapDieBonus++;
    t.resources.ice++;
    t.resources.surge++;
    showAbilityCallout('ENERGIZE!', 'var(--uncommon)', `${f.name} — Healing Seed used! +1 die, +1 Ice Shard, +1 Surge!`, team);
    log(`<span class="log-ability">${f.name}</span> — Energize! Healing Seed → +1 die this roll, <span class="log-ice">+1 Ice Shard</span>, <span class="log-ms">+1 Surge</span>.`);
  }

  // Boopies (419) — Boopie Magic: sideline — when active spends Healing Seed, gain 1 Lucky Stone
  if (hasSideline(t, 419)) {
    t.resources.luckyStone++;
    const boopiesG = getSidelineGhost(t, 419);
    const boopiesName = boopiesG ? boopiesG.name : 'Boopies';
    showAbilityCallout('BOOPIE MAGIC!', 'var(--common)', `${boopiesName} (sideline) — Healing Seed spent! +1 Lucky Stone!`, team);
    log(`<span class="log-ability">${boopiesName}</span> — Boopie Magic! Healing Seed spent → <span class="log-ms">+1 Lucky Stone!</span>`);
  }

  renderBattle();
}

function sacrificeHappyCrystal(team) {
  if (!isPreRollActive(team)) return;
  const t = B[team];
  const f = active(t);
  if (f.id !== 208 || f.ko) return;
  f.hp = 0; f.ko = true; f.killedBy = -1; // self-sacrifice
  t.resources.moonstone++;
  showAbilityCallout('SPARK STRIKE!', 'var(--moonstone)', `${f.name} sacrificed for 1 Moonstone!`, team);
  log(`<span class="log-ability">${f.name}</span> sacrifices itself! Gained <span class="log-ms">1 Moonstone</span>!`);
  if (!handleKOs()) renderBattle();
}

function toggleAuntSusan(team) {
  if (!isPreRollActive(team)) return;
  const tName = team;
  const t = B[team];
  const f = active(t);
  if (f.id !== 309 || f.ko) return;
  // Each click adds another seed to damage commit (click again to remove one)
  if (t.resources.healingSeed > 0) {
    B.committed[tName].auntSusan++;
    t.resources.healingSeed--;
  }
  renderBattle();
}

function uncommitAuntSusan(team) {
  if (!isPreRollActive(team)) return;
  const tName = team;
  const t = B[team];
  if (B.committed[tName].auntSusan > 0) {
    B.committed[tName].auntSusan--;
    t.resources.healingSeed++;
  }
  renderBattle();
}

function toggleAuntSusanHeal(team) {
  if (!isPreRollActive(team)) return;
  const tName = team;
  const t = B[team];
  const f = active(t);
  if (f.id !== 309 || f.ko) return;
  if (t.resources.healingSeed > 0) {
    B.committed[tName].auntSusanHeal++;
    t.resources.healingSeed--;
  }
  renderBattle();
}

function uncommitAuntSusanHeal(team) {
  if (!isPreRollActive(team)) return;
  const tName = team;
  const t = B[team];
  if (B.committed[tName].auntSusanHeal > 0) {
    B.committed[tName].auntSusanHeal--;
    t.resources.healingSeed++;
  }
  renderBattle();
}

// ============================================================
// HARRISON (315) — opt-in: spend 1 Healing Seed for +1 die
// ============================================================
function toggleHarrison(team) {
  if (!isPreRollActive(team)) return;
  const t = B[team];
  const f = active(t);
  if (f.id !== 315 || f.ko) return;
  // Click = add another seed, right-click to remove (handled separately)
  if (t.resources.healingSeed > 0) {
    B.committed[team].harrison++;
    t.resources.healingSeed--;
  }
  renderBattle();
}

function useFinnFlameBlade(team) {
  if (!isPreRollActive(team)) return;
  const t = B[team];
  // Finn must be on sideline or active (alive)
  const finnOnTeam = t.ghosts.some(g => g.id === 204 && !g.ko);
  if (!finnOnTeam) return;
  if (B.flameBlade && B.flameBlade[team]) return; // already forged
  if ((t.resources.healingSeed || 0) < 2 || (t.resources.fire || 0) < 1) return;
  t.resources.healingSeed -= 2;
  t.resources.fire -= 1;
  if (!B.flameBlade) B.flameBlade = { red: false, blue: false };
  B.flameBlade[team] = true;
  creditGhost(team, 204, 'ms', 1); // Finn earns MVP credit for forging
  log(`<span class="log-ability">Finn</span> — Forge! 2 Healing Seeds + 1 Sacred Fire → <span class="log-ms">Flame Blade!</span> (permanent item)`);
  showAbilityCallout('FLAME BLADE!', 'var(--rare)', 'Finn forges the Flame Blade!', team);
  playSfx('sfxSpecial', 0.5);
  renderBattle();
}

function toggleFlameBlade(team) {
  if (!isPreRollActive(team)) return;
  if (!B.flameBlade || !B.flameBlade[team]) return;
  if (!B.flameBladeSwing) B.flameBladeSwing = { red: false, blue: false };
  B.flameBladeSwing[team] = !B.flameBladeSwing[team];
  renderBattle();
}

function toggleIceBlade(team) {
  if (!isPreRollActive(team)) return;
  if (!B.iceBladeForgedPermanent || !B.iceBladeForgedPermanent[team]) return;
  if (!B.iceBladeSwing) B.iceBladeSwing = { red: false, blue: false };
  B.iceBladeSwing[team] = !B.iceBladeSwing[team];
  // Keep backward compat with committed.zainBlade toggle
  B.committed[team].zainBlade = B.iceBladeSwing[team] ? 1 : 0;
  renderBattle();
}

function useZainForge(team) {
  if (!isPreRollActive(team)) return;
  const t = B[team];
  // Zain can forge from sideline or active — find him wherever he is
  const zain = t.ghosts.find(g => g.id === 206 && !g.ko);
  if (!zain) return;
  if (zain.iceBladeForged) return; // already forged — permanent, can't re-forge
  if (B.iceBladeForgedPermanent[team]) return;
  if (t.resources.ice < 1 || t.resources.moonstone < 1) return;
  t.resources.ice -= 1;
  t.resources.moonstone -= 1;
  zain.iceBladeForged = true;
  B.iceBladeForgedPermanent[team] = true; // permanent +2 damage for the rest of the game
  log(`<span class="log-ability">${zain.name}</span> — Ice Blade forged! Spent <span class="log-ice">1 Ice Shard</span> + <span class="log-ms">1 Moonstone</span>. Permanent +2 damage on ALL winning rolls for the rest of the game!`);
  showAbilityCallout('ICE BLADE!', 'var(--ghost-rare)', `${zain.name} forges the Ice Blade — permanent +2 damage on ALL wins!`, team);
  playSfx('sfxSpecial', 0.5);
  renderBattle();
}

// Per-round commit toggle: Zain (forged) chooses whether to swing the blade this round
// Kept for backward compat — delegates to new toggleIceBlade
function toggleZainBlade(team) {
  toggleIceBlade(team);
}

function uncommitHarrison(team) {
  if (!isPreRollActive(team)) return;
  const t = B[team];
  if (B.committed[team].harrison > 0) {
    B.committed[team].harrison--;
    t.resources.healingSeed++;
  }
  renderBattle();
}

// ============================================================
// KNIGHT EFFECTS — Heavy Air (401) & Retribution (402)
// ============================================================
function checkKnightEffects(abilityTeamName, abilityGhostName, sidelineGhost) {
  // abilityTeamName = the team whose ability is triggering
  // sidelineGhost = optional: the sideline ghost using the ability (if not the active fighter)
  // The OPPONENT of that team might have Heavy Air or Retribution
  const oppTeamName = abilityTeamName === 'red' ? 'blue' : 'red';
  const oppTeam = B[oppTeamName];
  const oppActive = active(oppTeam);

  // Heavy Air (401) — after opponent ability resolves, enemy active ghost loses 2 HP
  if (oppActive.id === 401 && !oppActive.ko) {
    const abilityTeam = B[abilityTeamName];
    const target = active(abilityTeam);
    if (!target.ko) {
      target.hp = Math.max(0, target.hp - 2);
      if (target.hp <= 0) { target.ko = true; target.killedBy = 401; }
      const targetName = target.name;
      if (abilityQueueMode) {
        queueAbility('HEAVY AIR!', 'var(--rare)', `Knight Terror — ${targetName} loses 2 HP!`, null, oppTeamName);
      } else {
        showAbilityCallout('HEAVY AIR!', 'var(--rare)', `Knight Terror — ${targetName} loses 2 HP!`, oppTeamName);
      }
      log(`<span class="log-ability">Knight Terror</span> — Heavy Air! <span class="log-dmg">${targetName} loses 2 HP!</span> ${target.ko ? '<span class="log-ko">KO!</span>' : target.hp + ' HP left'}`);
    }
  }

  // Retribution (402) — gain +1 die next roll when opponent uses ability
  if (oppActive.id === 402 && !oppActive.ko) {
    if (!B.retributionDice) B.retributionDice = { red: 0, blue: 0 };
    B.retributionDice[oppTeamName]++;
    if (abilityQueueMode) {
      queueAbility('RETRIBUTION!', 'var(--rare)', `Knight Light — opponent used ability! +1 die next roll!`, null, oppTeamName);
    } else {
      showAbilityCallout('RETRIBUTION!', 'var(--rare)', `Knight Light — opponent used ability! +1 die next roll!`, oppTeamName);
    }
    log(`<span class="log-ability">Knight Light</span> — Retribution! <span class="log-ms">+1 die next roll!</span> (${B.retributionDice[oppTeamName]} stored)`);
  }
}

// ============================================================
// BLACKOUT — Smudge (403): name a number
// ============================================================
function setBlackout(team, num) {
  if (!isPreRollActive(team)) return; // Blackout is pre-roll only
  if (!B.blackoutNum) B.blackoutNum = {};
  if (B.blackoutNum[team] === num) {
    delete B.blackoutNum[team]; // toggle off
  } else {
    B.blackoutNum[team] = num;
  }
  renderBattle();
}

// ============================================================
// TYSON HOP — manual pre-roll swap (Tyson 365)
// ============================================================
function useTysonHop(team) {
  if (!isPreRollActive(team)) return;
  const t = B[team];
  const f = active(t);
  if (f.id !== 365 || f.ko) return;

  const enemy = opp(t);
  if (dylanNegates(enemy)) {
    showAbilityCallout('BLOCKED!', 'var(--text2)', `Dylan's Scarecrow shuts down Tyson's Hop!`, team === B.red ? 'blue' : 'red');
    log(`<span class="log-ability">Tyson</span> — Hop blocked by <span class="log-ability">Dylan's Scarecrow</span>!`);
    return;
  }
  const aliveSideline = t.ghosts.filter((g,i) => i !== t.activeIdx && !g.ko);
  if (aliveSideline.length === 0) return;

  log(`<span class="log-ability">${f.name}</span> — Hop! Swapping out, no entry effects for incoming ghost.`);
  // Queue HOP! + any Knight reactions sequentially before opening the swap modal
  abilityQueueMode = true;
  queueAbility('HOP!', 'var(--common)', `${f.name} hops to the bench — no entry triggers!`, null, team);
  checkKnightEffects(team, f.name);
  abilityQueueMode = false;
  // Open the standard swap modal only after all callouts finish playing
  drainAbilityQueue(() => openSwap(team));
}

// ============================================================
// PRESSURE — manual pre-roll ability (Death Howl 202)
// ============================================================
function usePressure(team) {
  if (!isPreRollActive(team)) return;
  const t = B[team];
  const f = active(t);
  const enemy = opp(t);
  const enemyTeamName = team === 'red' ? 'blue' : 'red';
  if (f.id !== 202 || f.ko || dylanNegates(enemy)) return;

  const aliveSideline = enemy.ghosts.filter((g,i) => i !== enemy.activeIdx && !g.ko);
  if (aliveSideline.length === 0) return;

  // If only one option, auto-pick
  if (aliveSideline.length === 1) {
    doPressureSwap(team, enemy.ghosts.indexOf(aliveSideline[0]));
    return;
  }

  // Open pressure picker for the OPPONENT to choose who comes in
  const enemyLabel = enemyTeamName.charAt(0).toUpperCase() + enemyTeamName.slice(1);
  // Update the "who picks" banner with the correct team color
  const whoBanner = document.getElementById('pressureWho');
  whoBanner.className = `pm-who-banner ${enemyTeamName}`;
  whoBanner.textContent = `🎯 ${enemyLabel.toUpperCase()} PICKS`;
  document.getElementById('pressureTitle').textContent = `Pressure! — Death Howl forces a swap`;
  document.getElementById('pressureSub').textContent = `${enemyLabel} team: choose which ghost enters the fight.`;
  document.getElementById('pressureOptions').innerHTML = aliveSideline.map(g => {
    const realIdx = enemy.ghosts.indexOf(g);
    const gd = ghostData(g.id);
    const hpRatio = g.hp / g.maxHp;
    const hpColor = hpRatio > 0.6 ? 'var(--hp-green)' : hpRatio > 0.3 ? 'var(--hp-yellow)' : 'var(--hp-red)';
    return `<div class="pressure-opt" onclick="doPressureSwap('${team}',${realIdx})">
      ${gd.art ? `<img src="${gd.art}" style="width:50px; height:50px; border-radius:6px; object-fit:cover; border:1px solid var(--${gd.rarity});">` : ''}
      <div>
        <div style="font-weight:700;">${g.name}</div>
        <div style="font-size:12px; color:var(--text2);"><span style="color:${hpColor}; font-weight:700;">&hearts; ${g.hp}/${g.maxHp}</span> &middot; <span style="color:var(--moonstone);">${gd.ability}</span></div>
      </div>
    </div>`;
  }).join('');
  // Lock out Roll buttons while the opponent picks — phase resets to 'ready' in doPressureSwap
  B.phase = 'pressure';
  document.getElementById('pressureOverlay').classList.add('active');
}

function doPressureSwap(attackerTeam, targetIdx) {
  document.getElementById('pressureOverlay').classList.remove('active');
  // Lock roll buttons for the full PRESSURE! + entry callout chain.
  // Previously: immediately restored B.phase='ready' (or left it 'ready' in the auto-pick
  // path), which meant both roll buttons were live during the 1500ms PRESSURE! splash and
  // any subsequent entry callouts (LEVIATHAN!, BIG TARGET!, SLUMBER!, etc.) — players could
  // click Roll mid-callout.  Now we park in 'ko-pause' and only restore 'ready' AFTER the
  // full chain finishes (same pattern used by doKoSwap, Timber, Selene, etc.).
  B.phase = 'ko-pause';
  // Mark Pressure as used for this round — prevents double-use when opponent has 2 sideline ghosts
  if (!B.pressureUsed) B.pressureUsed = { red: false, blue: false };
  B.pressureUsed[attackerTeam] = true;
  const t = B[attackerTeam];
  const f = active(t);
  const enemy = opp(t);
  const oldGhost = active(enemy);
  const oldName = oldGhost.name;
  // Pressure is a forced swap by Death Howl — NOT Tyson's voluntary Hop.
  // Entry effects always fire for the incoming ghost regardless of who was forced out.
  enemy.activeIdx = targetIdx;
  const newGhost = active(enemy);
  // Returning from sideline = full HP
  newGhost.hp = newGhost.maxHp;
  // Narrate the swap so there's textual context in the narrator div for BOTH the auto-pick path
  // (single sideline ghost — no modal, no prior narration) and the manual-pick path (modal closes
  // silently).  Without this, the player just sees the PRESSURE! splash with zero narrator context.
  const attackerCls = attackerTeam === 'red' ? 'red-text' : 'blue-text';
  narrate(`<b class="${attackerCls}">${f.name}</b> — Pressure! <b>${oldName}</b> forced to the sideline — <b>${newGhost.name}</b> enters at full HP!`);
  showAbilityCallout('PRESSURE!', 'var(--rare)', `${oldName} forced out — ${newGhost.name} enters!`, attackerTeam);
  log(`<span class="log-ability">${f.name}</span> — Pressure! Forced ${oldName} out, ${newGhost.name} enters at full HP!`);
  // Delay entry effects by 1500ms so PRESSURE! fully displays before the first entry callout
  // fires (triggerEntry's first setTimeout is at i=0 → ~0ms, which stomped PRESSURE! instantly).
  setTimeout(() => {
    const entryCalloutCount = triggerEntry(enemy, false);
    // Wait for all entry callouts to clear, then restore roll buttons.
    // If handleKOs() returns true (entry caused a KO), openKoSwap manages its own restoration.
    const afterEntry = entryCalloutCount > 0 ? entryCalloutCount * 1500 : 300;
    setTimeout(() => {
      if (!handleKOs()) { startNextRound(); }
    }, afterEntry);
  }, 1500);
}

// ============================================================
// SELENE — Heart of the Hills in-game choice modal
// ============================================================
function showSeleneModal() {
  const sp = B.selenePending;
  const f = active(sp.team);
  const tName = sp.tName;
  const teamLabel = tName.charAt(0).toUpperCase() + tName.slice(1);
  const bannerEl = document.getElementById('seleneBanner');
  if (bannerEl) {
    bannerEl.textContent = `⛰️ ${teamLabel.toUpperCase()} PICKS`;
    bannerEl.className = `selene-banner ${tName}`;
  }
  const titleEl = document.getElementById('seleneTitle');
  if (titleEl) titleEl.textContent = `${f.name} — Heart of the Hills!`;
  narrate(`<b class="${tName}-text">${f.name}</b>&nbsp;rolled <b class="gold">DOUBLES!</b>&nbsp;Choose your reward!`);
  document.getElementById('seleneOverlay').classList.add('active');
}

function doSeleneChoice(choice) {
  const sp = B.selenePending;
  if (!sp) return; // guard against double-click
  const cont = sp._continue;
  B.selenePending = null;
  document.getElementById('seleneOverlay').classList.remove('active');
  const f = active(sp.team);
  const _selTeam = sp.team;
  const _selName = f.name;
  const subtitle = choice === 'seed'
    ? `${f.name} — Doubles! Chose 🌱 2 Healing Seeds!`
    : `${f.name} — Doubles! Chose 🍀 3 Lucky Stones!`;
  // Queue mode: HEART OF THE HILLS first, then knight reactions, then drain sequentially.
  // Grant is deferred into onShow so the resource counter updates exactly when the callout
  // fires — same deferred-onShow pattern as Hank Tremor (v307), Natalia/Kaplan (v308).
  abilityQueueMode = true;
  queueAbility('HEART OF THE HILLS!', 'var(--legendary)', subtitle, () => {
    if (choice === 'seed') {
      _selTeam.resources.healingSeed += 2;
      log(`<span class="log-ability">${_selName}</span> — Heart of the Hills! Doubles → chose <span class="log-ms">2 Healing Seeds</span>!`);
    } else {
      _selTeam.resources.luckyStone += 3;
      log(`<span class="log-ability">${_selName}</span> — Heart of the Hills! Doubles → chose <span class="log-ms">3 Lucky Stones</span>!`);
    }
    renderBattle();
  }, sp.tName);
  checkKnightEffects(sp.tName, f.name); // queues HEAVY AIR! or RETRIBUTION! if applicable
  // Sandwiches (33) — Dependable: mirror the chosen resource to opponent if Sandwiches on sideline.
  // Capture totals at queue-build time (before any grant fires) so the preview subtitle is correct.
  if (hasSideline(opp(sp.team), 33)) {
    if (choice === 'seed') {
      const _sandSeedOpp = opp(sp.team);
      const _sandSeedTotal = _sandSeedOpp.resources.healingSeed + 2;
      queueAbility('DEPENDABLE!', 'var(--common)', `Sandwiches — mirrors Heart of the Hills! +2 Healing Seeds! (${_sandSeedTotal} total)`, () => { _sandSeedOpp.resources.healingSeed += 2; renderBattle(); }, sp.tName === 'red' ? 'blue' : 'red');
    } else {
      const _sandLSOpp = opp(sp.team);
      const _sandLSTotal = _sandLSOpp.resources.luckyStone + 3;
      queueAbility('DEPENDABLE!', 'var(--common)', `Sandwiches — mirrors Heart of the Hills! +3 Lucky Stones! (${_sandLSTotal} total)`, () => { _sandLSOpp.resources.luckyStone += 3; renderBattle(); }, sp.tName === 'red' ? 'blue' : 'red');
    }
  }
  abilityQueueMode = false;
  // drainAbilityQueue plays each splash 1300ms apart and calls cont() after all finish.
  drainAbilityQueue(() => { if (cont) cont(); });
}

// Pal Al (431) — Squall: show choice modal
function showWiseAlModal(resumeCallback) {
  const wp = B.wiseAlPending;
  if (!wp) { resumeCallback(); return; }
  wp.resume = resumeCallback;
  document.getElementById('wiseAlSub').textContent = `Deal ${wp.dmg} damage or gain 4 Ice Shards?`;
  document.getElementById('wiseAlDmgBtn').textContent = `⚔️ Deal ${wp.dmg} Damage`;
  document.getElementById('wiseAlOverlay').classList.add('active');
}

function doWiseAlChoice(choice) {
  const wp = B.wiseAlPending;
  if (!wp) return;
  B.wiseAlPending = null;
  document.getElementById('wiseAlOverlay').classList.remove('active');
  if (choice === 'ice') {
    wp.winTeam.resources.ice += 4;
    checkKnightEffects(wp.winTeamName, wp.wF.name);
    log(`<span class="log-ability">${wp.wF.name}</span> — Squall! <span class="log-ice">+4 Ice Shards</span> instead of dealing damage!`);
    queueAbility('SQUALL!', 'var(--rare)', `${wp.wF.name} — +4 Ice Shards instead of dealing damage!`, () => { renderBattle(); }, wp.winTeamName);
  } else {
    // Deal the stashed damage
    wp.lF.hp = Math.max(0, wp.lF.hp - wp.dmg);
    if (wp.lF.hp <= 0) { wp.lF.ko = true; wp.lF.killedBy = (wp.wF.originalId || wp.wF.id); }
    log(`<span class="log-dmg">${wp.wF.name} deals ${wp.dmg} to ${wp.lF.name}!</span> ${wp.lF.ko?'<span class="log-ko">KO!</span>':wp.lF.hp+' HP left'}`);
    renderBattle();
  }
  drainAbilityQueue(() => { if (wp.resume) wp.resume(); });
}

// Gordok (430) — River Terror: show choice modal
function showGordokModal(resumeCallback) {
  const gp = B.gordokPending;
  if (!gp) { resumeCallback(); return; }
  gp.resume = resumeCallback;
  document.getElementById('gordokSub').textContent = `Deal ${gp.dmg} damage or steal 2 resources?`;
  document.getElementById('gordokDmgBtn').textContent = `⚔️ Deal ${gp.dmg} Damage`;
  document.getElementById('gordokOverlay').classList.add('active');
}

function doGordokChoice(choice) {
  const gp = B.gordokPending;
  if (!gp) return;
  B.gordokPending = null;
  document.getElementById('gordokOverlay').classList.remove('active');
  if (choice === 'steal') {
    const gordokOppRes = gp.loseTeam.resources;
    const gordokResTypes = ['ice', 'fire', 'surge', 'luckyStone', 'moonstone', 'healingSeed'];
    let gordokStolen = 0;
    const gordokStolenList = [];
    for (let i = 0; i < 2 && gordokStolen < 2; i++) {
      const avail = gordokResTypes.filter(r => (gordokOppRes[r] || 0) > 0);
      if (avail.length === 0) break;
      const pick = avail[Math.floor(Math.random() * avail.length)];
      gordokOppRes[pick]--;
      gp.winTeam.resources[pick] = (gp.winTeam.resources[pick] || 0) + 1;
      gordokStolenList.push(pick);
      gordokStolen++;
    }
    if (!B.gordokDieBonus) B.gordokDieBonus = { red: 0, blue: 0 };
    B.gordokDieBonus[gp.winTeamName] = 1;
    gp.winTeam.resources.moonstone++;
    checkKnightEffects(gp.winTeamName, gp.wF.name);
    log(`<span class="log-ability">${gp.wF.name}</span> — River Terror! Stole ${gordokStolenList.join(', ')} instead of dealing damage! <span class="log-ice">+1 die next roll!</span> <span class="log-ms">+1 Moonstone!</span>`);
    queueAbility('RIVER TERROR!', 'var(--rare)', `${gp.wF.name} — stole resources instead of dealing damage! +1 Moonstone!`, () => { renderBattle(); }, gp.winTeamName);
  } else {
    // Deal the stashed damage
    gp.lF.hp = Math.max(0, gp.lF.hp - gp.dmg);
    if (gp.lF.hp <= 0) { gp.lF.ko = true; gp.lF.killedBy = (gp.wF.originalId || gp.wF.id); }
    log(`<span class="log-dmg">${gp.wF.name} deals ${gp.dmg} to ${gp.lF.name}!</span> ${gp.lF.ko?'<span class="log-ko">KO!</span>':gp.lF.hp+' HP left'}`);
    renderBattle();
  }
  drainAbilityQueue(() => { if (gp.resume) gp.resume(); });
}

// Timber (210) — Howl choice modal
function showTimberModal(tp, resumeCallback) {
  const oppLabel = tp.oppTeamName.charAt(0).toUpperCase() + tp.oppTeamName.slice(1);
  const bannerEl = document.getElementById('timberBanner');
  if (bannerEl) {
    bannerEl.textContent = `🐺 ${oppLabel.toUpperCase()} MUST CHOOSE`;
    bannerEl.className = `selene-banner ${tp.oppTeamName}`;
    bannerEl.style.background = 'linear-gradient(135deg,#4a2c0a,#7c4a1a)';
  }
  const titleEl = document.getElementById('timberTitle');
  if (titleEl) titleEl.textContent = `Timber — Howl!`;
  const subEl = document.getElementById('timberSub');
  if (subEl) subEl.textContent = `${oppLabel}: choose your fate!`;
  // Disable discard button if opponent has fewer than 2 specials — they must take the die penalty
  const discardBtn = document.getElementById('timberDiscardBtn');
  if (discardBtn) {
    const r = tp.team.resources;
    const totalSpecials = ['surge','ice','healingSeed','luckyStone','fire','moonstone']
      .reduce((sum, t) => sum + (r[t] || 0), 0);
    discardBtn.disabled = totalSpecials < 2;
  }
  narrate(`<b class="${tp.oppTeamName}-text">${oppLabel}</b>&nbsp;faces <b class="gold">TIMBER!</b>&nbsp;Discard 2 specials or lose a die!`);
  B.timberPending._resumeCallback = resumeCallback;
  document.getElementById('timberOverlay').classList.add('active');
}

function doTimberChoice(choice) {
  const tp = B.timberPending;
  if (!tp) return;
  const resume = tp._resumeCallback;
  const oppLabel = tp.oppTeamName.charAt(0).toUpperCase() + tp.oppTeamName.slice(1);
  const timberGhost = active(B[tp.timberTeam]);
  const timberName = timberGhost ? timberGhost.name : 'Timber';
  B.timberPending = null;
  document.getElementById('timberOverlay').classList.remove('active');
  let subtitle;
  if (choice === 'discard') {
    // Discard 2 specials from most abundant first
    const r = tp.team.resources;
    let toDiscard = 2;
    const types = ['surge','ice','healingSeed','luckyStone','fire','moonstone'];
    types.sort((a,b) => (r[b]||0) - (r[a]||0));
    for (const t of types) {
      while (toDiscard > 0 && (r[t]||0) > 0) {
        r[t]--;
        toDiscard--;
      }
    }
    subtitle = `${oppLabel} discards 2 specials to keep all dice!`;
    log(`<span class="log-ability">${oppLabel}</span> chose to discard 2 specials to avoid Timber's Howl!`);
  } else {
    // Lose 1 die
    if (tp.oppTeamName === 'red') B.preRoll.red.count = Math.max(1, B.preRoll.red.count - 1);
    else B.preRoll.blue.count = Math.max(1, B.preRoll.blue.count - 1);
    subtitle = `${oppLabel} rolls 1 fewer die!`;
    log(`<span class="log-ability">${oppLabel}</span> chose to roll 1 fewer die under Timber's Howl!`);
  }
  renderBattle();
  // Queue mode: HOWL! first, then any knight reactions (HEAVY AIR! / RETRIBUTION!),
  // then drain sequentially. Mirrors the doSeleneChoice pattern from v90.
  // _oppBtn unlocked and resume() called only after the full callout chain completes.
  abilityQueueMode = true;
  queueAbility('HOWL!', 'var(--legendary)', subtitle, null, tp.timberTeam);
  checkKnightEffects(tp.timberTeam, timberName); // queues HEAVY AIR! or RETRIBUTION! if applicable
  abilityQueueMode = false;
  drainAbilityQueue(() => {
    if (tp._oppBtn) { tp._oppBtn.classList.remove('locked'); tp._oppBtn.disabled = false; }
    if (resume) resume();
  });
}

// Sylvia (313) — Porpoise: when Sylvia loses a roll, player rolls 1 die.
// A 6 negates all damage. Player-driven dice reveal so there's real agency.
// Called from resolveRound right after winner determination, before any
// damage computation (which reads B.sylviaPendingResult at line ~8141).
function showSylviaModal(loseTeamName, resumeCallback) {
  const lF = active(B[loseTeamName]);
  B.phase = 'sylvia-roll';
  B.sylviaPendingResult = null; // cleared so Sylvia block at 8141 knows to wait for this modal
  B.sylviaResume = resumeCallback;
  B.sylviaTeamName = loseTeamName;

  const titleEl = document.getElementById('sylviaTitle');
  if (titleEl) titleEl.textContent = `${lF ? lF.name : 'Sylvia'} — Porpoise!`;
  const subEl = document.getElementById('sylviaSub');
  if (subEl) subEl.innerHTML = `Roll a <b>5 or 6</b> to dodge all damage!`;
  const dieEl = document.getElementById('sylviaDie');
  if (dieEl) {
    dieEl.textContent = '?';
    dieEl.style.transform = 'rotate(0deg)';
  }
  const btn = document.getElementById('sylviaRollBtn');
  if (btn) { btn.disabled = false; btn.textContent = '🌊 Roll the Die!'; }

  narrate(`<b class="${loseTeamName}-text">${lF ? lF.name : 'Sylvia'}</b>&nbsp;rolls for <b class="gold">PORPOISE!</b>&nbsp;5 or 6 dodges all damage!`);
  document.getElementById('sylviaOverlay').classList.add('active');
}

function doSylviaRoll() {
  const btn = document.getElementById('sylviaRollBtn');
  if (!btn || btn.disabled) return;
  btn.disabled = true;

  // Roll the actual die NOW (player click is the trigger)
  const finalValue = Math.floor(Math.random() * 6) + 1;
  const dieEl = document.getElementById('sylviaDie');
  if (!dieEl) { finishSylviaRoll(finalValue); return; }

  // Quick shuffle animation: flip through random values for ~800ms then reveal
  let ticks = 0;
  const totalTicks = 10;
  const tickMs = 70;
  const shuffle = setInterval(() => {
    ticks++;
    dieEl.textContent = String(Math.floor(Math.random() * 6) + 1);
    dieEl.style.transform = `rotate(${ticks * 36}deg)`;
    if (ticks >= totalTicks) {
      clearInterval(shuffle);
      dieEl.textContent = String(finalValue);
      dieEl.style.transform = 'rotate(0deg)';
      if (finalValue >= 5) { // 5 or 6 dodge
        dieEl.style.background = 'linear-gradient(135deg,#fde68a,#f59e0b)';
        dieEl.style.borderColor = '#f59e0b';
        dieEl.style.color = '#78350f';
      } else {
        dieEl.style.background = 'linear-gradient(135deg,#fecaca,#ef4444)';
        dieEl.style.borderColor = '#b91c1c';
        dieEl.style.color = '#7f1d1d';
      }
      setTimeout(() => finishSylviaRoll(finalValue), 850);
    }
  }, tickMs);
}

function finishSylviaRoll(value) {
  const dodged = (value >= 5); // 5 or 6 dodge
  B.sylviaPendingResult = { value, dodged };
  const resume = B.sylviaResume;
  B.sylviaResume = null;
  document.getElementById('sylviaOverlay').classList.remove('active');
  // Reset die visuals for next time
  const dieEl = document.getElementById('sylviaDie');
  if (dieEl) {
    dieEl.style.background = 'linear-gradient(135deg,#bae6fd,#e0f2fe)';
    dieEl.style.borderColor = '#0ea5e9';
    dieEl.style.color = '#0c4a6e';
  }
  if (resume) resume();
}

// ============================================================
// PRINCE BALATRON (113) — Party Time counter-die reveal
// ============================================================
// Counter-die value + post-counter HP are computed synchronously in
// _resolveRoundImpl so downstream KO-cascade logic sees the correct state.
// The modal is purely cinematic — it shuffles and lands on the pre-computed
// value, then applies the deferred wF.hp mutation so the bar drops the
// instant the reveal lands. B.balatronPending carries the precomputed data.
function showBalatronModal(resumeCallback) {
  const bp = B.balatronPending;
  if (!bp) { if (resumeCallback) resumeCallback(); return; }
  B.balatronResume = resumeCallback;

  const titleEl = document.getElementById('balatronTitle');
  if (titleEl) titleEl.textContent = `${bp.lFName} — Party Time!`;
  const subEl = document.getElementById('balatronSub');
  if (subEl) subEl.innerHTML = `${bp.lFName} lost the roll — but the party's not over.<br>Roll the counter die for damage to <b>${bp.wFName}</b>!`;
  const dieEl = document.getElementById('balatronDie');
  if (dieEl) {
    dieEl.textContent = '?';
    dieEl.style.transform = 'rotate(0deg)';
    dieEl.style.background = 'linear-gradient(135deg,#e9d5ff,#c4b5fd)';
    dieEl.style.borderColor = '#a855f7';
    dieEl.style.color = '#4c1d95';
  }
  const btn = document.getElementById('balatronRollBtn');
  if (btn) { btn.disabled = false; btn.textContent = '🎲 Roll the Counter Die!'; }

  narrate(`<b class="${bp.loseTeamName}-text">${bp.lFName}</b>&nbsp;retaliates — <b class="gold">PARTY TIME!</b>`);
  document.getElementById('balatronOverlay').classList.add('active');
}

function doBalatronRoll() {
  const btn = document.getElementById('balatronRollBtn');
  if (!btn || btn.disabled) return;
  btn.disabled = true;

  const bp = B.balatronPending;
  if (!bp) { finishBalatronRoll(); return; }
  const finalValue = bp.counterDie;

  const dieEl = document.getElementById('balatronDie');
  if (!dieEl) { finishBalatronRoll(); return; }

  // Shuffle animation — land on the pre-computed counter value
  let ticks = 0;
  const totalTicks = 10;
  const tickMs = 70;
  const shuffle = setInterval(() => {
    ticks++;
    dieEl.textContent = String(Math.floor(Math.random() * 6) + 1);
    dieEl.style.transform = `rotate(${ticks * 36}deg)`;
    if (ticks >= totalTicks) {
      clearInterval(shuffle);
      dieEl.textContent = String(finalValue);
      dieEl.style.transform = 'rotate(0deg)';
      // Color the die by hit size
      if (finalValue >= 5) {
        dieEl.style.background = 'linear-gradient(135deg,#fde68a,#f59e0b)';
        dieEl.style.borderColor = '#f59e0b';
        dieEl.style.color = '#78350f';
      } else if (finalValue >= 3) {
        dieEl.style.background = 'linear-gradient(135deg,#fbbf24,#d97706)';
        dieEl.style.borderColor = '#b45309';
        dieEl.style.color = '#78350f';
      } else {
        dieEl.style.background = 'linear-gradient(135deg,#fecaca,#ef4444)';
        dieEl.style.borderColor = '#b91c1c';
        dieEl.style.color = '#7f1d1d';
      }
      setTimeout(() => finishBalatronRoll(), 900);
    }
  }, tickMs);
}

function finishBalatronRoll() {
  const bp = B.balatronPending;
  const resume = B.balatronResume;
  B.balatronPending = null;
  B.balatronResume = null;
  document.getElementById('balatronOverlay').classList.remove('active');

  if (bp) {
    // Apply the deferred HP mutation + log so the bar drops exactly now.
    const wTeamName = bp.loseTeamName === 'red' ? 'blue' : 'red';
    const wTeamObj = B[wTeamName];
    const wF = wTeamObj ? active(wTeamObj) : null;
    if (wF && wF.name === bp.wFName) {
      wF.hp = bp.hpAfter;
    }
    log(`<span class="log-ability">${bp.lFName}</span> — Party Time! Counter die: <b>${bp.counterDie}</b> damage to ${bp.wFName}! ${bp.wasKo?'<span class="log-ko">KO!</span>':bp.hpAfter+' HP left'}`);
    renderBattle();
  }
  if (resume) resume();
}

// ============================================================
// ROMY (114) — Valley Guardian: pre-roll number prediction modal
// ============================================================
function doRomyPrediction(num) {
  document.getElementById('romyOverlay').classList.remove('active');
  const rp = B.romyPending;
  if (!rp) return;
  B.romyPending = null;
  if (B.romyPrediction) B.romyPrediction[rp.team] = num;
  narrate(`<b class="gold">${rp.ghostName} predicts... ${num}!</b> Valley Guardian ready!`);
  // Unlock this team's button and proceed to roll
  const myBtn = document.getElementById(rp.team === 'red' ? 'rollRedBtn' : 'rollBlueBtn');
  // Give the narration a beat to appear, then roll
  setTimeout(() => { doTeamRoll(rp.team, myBtn); }, 400);
}

// ============================================================
// TOBY (97) — Pure Heart: all-in declaration handler
// ============================================================
function doTobyPureHeart(declared) {
  document.getElementById('tobyOverlay').classList.remove('active');
  const tp = B.tobyPending;
  if (!tp) return;
  B.tobyPending = null;
  if (B.pureHeartDeclared) B.pureHeartDeclared[tp.team] = declared;
  const myBtn = document.getElementById(tp.team === 'red' ? 'rollRedBtn' : 'rollBlueBtn');
  if (declared) {
    narrate(`<b class="gold">PURE HEART!</b> Toby declares the final roll — a win ends it all! (Toby sacrifices next round)`);
  } else {
    narrate(`<b class="${tp.team}-text">Toby</b> stands down — not this round.`);
    if (B.pureHeartDeclared) B.pureHeartDeclared[tp.team] = false;
  }
  setTimeout(() => { doTeamRoll(tp.team, myBtn); }, 400);
}

// ============================================================
// TYLER (105) — Heating Up: opt-in 2 HP trade for +1 die
// ============================================================
function doTylerChoice(choice) {
  const tp = B.tylerPending;
  if (!tp) return;
  B.tylerPending = null;
  document.getElementById('tylerOverlay').classList.remove('active');
  const { team, btn } = tp;
  const f = active(B[team]);
  if (choice === 'yes' && f && !f.ko && f.hp >= 3) {
    const prevHp = f.hp;
    f.hp -= 2;
    // +1 die: bump the pre-roll count already stored by doPreRollSetup
    if (B.preRoll && B.preRoll[team]) {
      B.preRoll[team].count = Math.min(6, B.preRoll[team].count + 1);
    }
    showAbilityCallout('HEATING UP!', 'var(--ghost-rare)', `${f.name} — spends 2 HP for +1 die! (${prevHp} → ${f.hp} HP)`, team);
    log(`<span class="log-ability">${f.name}</span> — Heating Up! Spent 2 HP for +1 die (${prevHp} → ${f.hp} HP).`);
    renderBattle();
    // Short pause so the callout is visible before the dice roll
    setTimeout(() => { btn.disabled = false; btn.classList.remove('locked'); doTeamRoll(team, btn); }, 1500);
  } else {
    narrate(`<b class="${team}-text">Tyler</b> holds HP — rolling without the trade.`);
    setTimeout(() => { btn.disabled = false; btn.classList.remove('locked'); doTeamRoll(team, btn); }, 200);
  }
}

// ============================================================
// GUARDIAN FAIRY (99) — Wish: reactive damage swap handler
// ============================================================
function doGuardianFairyReactive(choice) {
  const gfp = B.guardianFairyReactivePending;
  if (!gfp) return;
  B.guardianFairyReactivePending = null;
  document.getElementById('guardianFairyOverlay').classList.remove('active');
  const { loseTeamName, gfGhost, dmg, lF, resume } = gfp;
  const loseTeam = B[loseTeamName];
  if (choice === 'yes') {
    // Guardian Fairy takes the damage instead — heal to full first (entering from sideline)
    const gfIdx = loseTeam.ghosts.indexOf(gfGhost);
    gfGhost.hp = gfGhost.maxHp; // heal to full on entry
    gfGhost.hp = Math.max(0, gfGhost.hp - dmg);
    if (gfGhost.hp <= 0) { gfGhost.ko = true; gfGhost.killedBy = -1; }
    // Swap GF to active, original ghost to sideline at current HP
    if (gfIdx !== -1) loseTeam.activeIdx = gfIdx;
    const gfName = gfGhost.name || 'Guardian Fairy';
    queueAbility('WISH!', 'var(--ghost-rare)', `${gfName} — leaps in to absorb ${dmg} damage for ${lF.name}!${gfGhost.ko ? ' GF falls!' : ' ' + gfGhost.hp + ' HP left'}`, null, loseTeamName);
    log(`<span class="log-ability">${gfName}</span> — Wish! Absorbed ${dmg} damage for ${lF.name}! ${gfGhost.ko ? '<span class="log-ko">GF falls!</span>' : gfGhost.hp + ' HP left'}`);
    renderBattle();
    if (resume) setTimeout(resume, 1500);
  } else {
    // Damage applies to the original ghost
    lF.hp = Math.max(0, lF.hp - dmg);
    if (lF.hp <= 0) { lF.ko = true; lF.killedBy = gfp.wFId; }
    log(`<span class="log-dmg">${gfp.wFName} deals ${dmg} to ${lF.name}!</span> ${lF.ko?'<span class="log-ko">KO!</span>':lF.hp+' HP left'}`);
    renderBattle();
    if (resume) setTimeout(resume, 200);
  }
}

// ============================================================
// CHOW (414) — Secret Ingredient: spend 1 Healing Seed for +2 dice
// ============================================================
function doChowChoice(choice) {
  const cp = B.chowPending;
  if (!cp) return;
  B.chowPending = null;
  document.getElementById('chowOverlay').classList.remove('active');
  const { team, btn } = cp;
  const f = active(B[team]);
  if (choice === 'yes' && f && f.id === 414 && !f.ko && B[team].resources.healingSeed >= 1) {
    B[team].resources.healingSeed--;
    B.chowExtraDie[team] = (B.chowExtraDie[team] || 0) + 2;
    // Boopies (419) — Boopie Magic: sideline Healing Seed spending = +1 Lucky Stone
    if (hasSideline(B[team], 419)) { B[team].resources.luckyStone = (B[team].resources.luckyStone || 0) + 1; }
    showAbilityCallout('SECRET INGREDIENT!', 'var(--uncommon)',
      `${f.name} — discarded 1 Healing Seed for +2 dice! (total +${B.chowExtraDie[team]})`, team);
    log(`<span class="log-ability">${f.name}</span> — Secret Ingredient! Discarded 1 Healing Seed → +${B.chowExtraDie[team]} dice total!`);
    renderBattle();
    // If more seeds available, allow another use (re-offer after callout clears)
    if (B[team].resources.healingSeed >= 1) {
      setTimeout(() => { btn.disabled = false; btn.classList.remove('locked'); doTeamRoll(team, btn); }, 1500);
    } else {
      B.chowDecided[team] = true;
      setTimeout(() => { btn.disabled = false; btn.classList.remove('locked'); doTeamRoll(team, btn); }, 1500);
    }
  } else {
    B.chowDecided[team] = true;
    setTimeout(() => { btn.disabled = false; btn.classList.remove('locked'); doTeamRoll(team, btn); }, 200);
  }
}

// ============================================================
// CASTLE GARDENER (442) — Cultivate: discard 1 Healing Seed for 1 Sacred Fire
// ============================================================
function doCultivateChoice(choice) {
  const cp = B.cultivatePending;
  if (!cp) return;
  B.cultivatePending = null;
  document.getElementById('cultivateOverlay').classList.remove('active');
  const { team, btn } = cp;
  const f = active(B[team]);
  if (choice === 'yes' && f && f.id === 442 && !f.ko && B[team].resources.healingSeed >= 1) {
    B[team].resources.healingSeed--;
    B[team].resources.fire = (B[team].resources.fire || 0) + 1;
    // Boopies (419) — Boopie Magic: sideline Healing Seed spending = +1 Lucky Stone
    if (hasSideline(B[team], 419)) { B[team].resources.luckyStone = (B[team].resources.luckyStone || 0) + 1; }
    showAbilityCallout('CULTIVATE!', 'var(--uncommon)',
      `${f.name} — discarded 1 Healing Seed → +1 Sacred Fire!`, team);
    log(`<span class="log-ability">${f.name}</span> — Cultivate! Discarded 1 Healing Seed → +1 Sacred Fire!`);
    renderBattle();
    // If more seeds available, re-offer (repeatable)
    if (B[team].resources.healingSeed >= 1) {
      setTimeout(() => { btn.disabled = false; btn.classList.remove('locked'); doTeamRoll(team, btn); }, 1500);
    } else {
      B.cultivateDecided[team] = true;
      setTimeout(() => { btn.disabled = false; btn.classList.remove('locked'); doTeamRoll(team, btn); }, 1500);
    }
  } else {
    B.cultivateDecided[team] = true;
    setTimeout(() => { btn.disabled = false; btn.classList.remove('locked'); doTeamRoll(team, btn); }, 200);
  }
}

// ============================================================
// FOREST SPIRIT (446) — Hex: spend 1 Burn to remove 1 enemy die (pre-roll button)
// ============================================================
function useHex(team) {
  const f = active(B[team]);
  if (!f || f.id !== 446 || f.ko) return;
  if ((B[team].resources.burn || 0) < 1) return;

  const oppTeamName = team === 'red' ? 'blue' : 'red';
  B[team].resources.burn--;
  B.hexDieRemoval[oppTeamName] = (B.hexDieRemoval[oppTeamName] || 0) + 1;
  B[team].resources.fire = (B[team].resources.fire || 0) + 1;

  showAbilityCallout('HEX!', 'var(--uncommon)', `${f.name} — -1 Burn → -1 enemy die + 1 Sacred Fire!`, team);
  log(`<span class="log-ability">${f.name}</span> — Hex! -1 Burn → opponent -1 die + <span class="log-ms">+1 Sacred Fire!</span>`);
  renderBattle(); // re-renders the button with updated burn count
}

// ============================================================
// NICK & KNACK (409) — Knick Knack: steal 1 resource from opponent
// ============================================================
function showNickKnackPicker(team, oppTeam) {
  const oppRes = B[oppTeam].resources;
  const resTypes = [
    { key: 'ice', label: 'Ice Shard', emoji: '❄️' },
    { key: 'fire', label: 'Sacred Fire', emoji: '🔥' },
    { key: 'surge', label: 'Surge', emoji: '⚡' },
    { key: 'luckyStone', label: 'Lucky Stone', emoji: '🍀' },
    { key: 'moonstone', label: 'Moonstone', emoji: '💎' },
    { key: 'healingSeed', label: 'Healing Seed', emoji: '🌱' }
  ];
  const available = resTypes.filter(r => (oppRes[r.key] || 0) > 0);
  const optionsEl = document.getElementById('nickKnackOptions');
  let html = '';
  available.forEach(r => {
    html += `<button class="selene-opt" onclick="doNickKnackSteal('${team}','${r.key}')" style="background:linear-gradient(135deg,#065f46,#059669);">${r.emoji} ${r.label} (${oppRes[r.key]})</button>`;
  });
  html += `<button class="selene-opt" onclick="doNickKnackSteal('${team}','skip')" style="background:linear-gradient(135deg,#374151,#1f2937);">✖ Skip</button>`;
  optionsEl.innerHTML = html;
  document.getElementById('nickKnackOverlay').classList.add('active');
}

function doNickKnackSteal(team, resKey) {
  const nnp = B.nickKnackPending;
  if (!nnp) return;
  B.nickKnackPending = null;
  document.getElementById('nickKnackOverlay').classList.remove('active');
  const { btn, oppTeam } = nnp;
  B.nickKnackDecided[team] = true;
  if (resKey !== 'skip') {
    B[oppTeam].resources[resKey]--;
    B[team].resources[resKey] = (B[team].resources[resKey] || 0) + 1;
    const resLabel = resKey === 'luckyStone' ? 'Lucky Stone' : resKey === 'moonstone' ? 'Moonstone' : resKey === 'healingSeed' ? 'Healing Seed' : resKey === 'ice' ? 'Ice Shard' : resKey === 'fire' ? 'Sacred Fire' : 'Surge';
    const f = active(B[team]);
    // Nick & Knack gains +3 HP on steal (overclocks past maxHp per game rules)
    f.hp += 3;
    showAbilityCallout('KNICK KNACK!', 'var(--uncommon)',
      `${f.name} — stole 1 ${resLabel} from the opponent! +3 HP! (${f.hp} HP)`, team);
    log(`<span class="log-ability">${f.name}</span> — Knick Knack! Stole 1 <span class="log-ms">${resLabel}</span> from opponent! <span class="log-heal">+3 HP</span> (${f.hp} HP)!`);
    renderBattle();
    setTimeout(() => { btn.disabled = false; btn.classList.remove('locked'); doTeamRoll(team, btn); }, 1500);
  } else {
    setTimeout(() => { btn.disabled = false; btn.classList.remove('locked'); doTeamRoll(team, btn); }, 200);
  }
}

// ============================================================
// BURN — Place burn resource on enemy sideline ghost (pre-roll)
// ============================================================
function showBurnPicker(team) {
  const t = B[team];
  const burnCount = t.resources.burn || 0;
  if (burnCount <= 0) return;

  const enemyTeamName = team === 'red' ? 'blue' : 'red';
  const enemyTeam = B[enemyTeamName];

  // Find non-KO'd sideline ghosts on enemy team
  const sidelineGhosts = enemyTeam.ghosts
    .map((g, i) => ({ ghost: g, index: i }))
    .filter(x => x.index !== enemyTeam.activeIdx && !x.ghost.ko);

  if (sidelineGhosts.length === 0) {
    log('<span class="log-ability">BURN</span> — No enemy sideline ghosts to burn!');
    return;
  }

  B.burnPickerTeam = team;

  const optionsEl = document.getElementById('burnPickerOptions');
  let html = '';
  sidelineGhosts.forEach(({ ghost, index }) => {
    const gd = ghostData(ghost.id);
    const existingBurn = (B.burn && B.burn[enemyTeamName] && B.burn[enemyTeamName][index]) || 0;
    const burnLabel = existingBurn > 0 ? ` (${existingBurn} Burn already)` : '';
    html += `<button class="selene-opt" onclick="doBurnPlace('${team}',${index})" style="background:linear-gradient(135deg,#7c1a1a,#c0392b);">🔥 ${ghost.name} — ${ghost.hp}/${ghost.maxHp} HP${burnLabel}</button>`;
  });
  html += `<button class="selene-opt" onclick="closeBurnPicker()" style="background:linear-gradient(135deg,#374151,#1f2937);">✖ Cancel</button>`;
  optionsEl.innerHTML = html;
  document.getElementById('burnPickerSub').innerHTML = `You have <b>${burnCount}</b> Burn to place. Each Burn deals 1 damage when the ghost enters battle.`;
  document.getElementById('burnOverlay').classList.add('active');
}

function doBurnPlace(team, ghostIndex) {
  const t = B[team];
  const enemyTeamName = team === 'red' ? 'blue' : 'red';

  if (!t.resources.burn || t.resources.burn <= 0) { closeBurnPicker(); return; }

  t.resources.burn--;
  if (!B.burn) B.burn = { red: {}, blue: {} };
  if (!B.burn[enemyTeamName]) B.burn[enemyTeamName] = {};
  B.burn[enemyTeamName][ghostIndex] = (B.burn[enemyTeamName][ghostIndex] || 0) + 1;

  const targetGhost = B[enemyTeamName].ghosts[ghostIndex];
  const totalBurn = B.burn[enemyTeamName][ghostIndex];
  log(`<span class="log-ability">BURN!</span> placed on <span class="log-dmg">${targetGhost.name}</span>! (${totalBurn} total)`);
  showAbilityCallout('BURN!', 'var(--rare)', `${targetGhost.name} has been marked! ${totalBurn} Burn on entry!`, team);

  renderBattle();

  // If still have burn to place, re-open picker after a brief delay
  if (t.resources.burn > 0) {
    setTimeout(() => showBurnPicker(team), 800);
  } else {
    closeBurnPicker();
  }
}

function closeBurnPicker() {
  document.getElementById('burnOverlay').classList.remove('active');
  B.burnPickerTeam = null;
}

// ============================================================
// MAGIC FIREFLIES — Convert wildcard firefly to any resource
// ============================================================
function showFireflyPicker(team) {
  const t = B[team];
  const ffCount = t.resources.firefly || 0;
  if (ffCount <= 0) return;

  B.fireflyPickerTeam = team;

  const resources = [
    { key: 'fire', label: 'Sacred Fire', emoji: '🔥' },
    { key: 'ice', label: 'Ice Shard', emoji: '❄️' },
    { key: 'luckyStone', label: 'Lucky Stone', emoji: '🍀' },
    { key: 'moonstone', label: 'Moonstone', emoji: '🌙' },
    { key: 'healingSeed', label: 'Healing Seed', emoji: '🌱' },
    { key: 'surge', label: 'Surge', emoji: '⚡' },
    { key: 'burn', label: 'Burn', emoji: '🔥' }
  ];

  const optionsEl = document.getElementById('fireflyOptions');
  let html = '';
  resources.forEach(r => {
    html += `<button class="selene-opt" onclick="doFireflyConvert('${team}','${r.key}')" style="background:linear-gradient(135deg,#8b6914,#daa520);">${r.emoji} ${r.label}</button>`;
  });
  html += `<button class="selene-opt" onclick="closeFireflyPicker()" style="background:linear-gradient(135deg,#374151,#1f2937);">✖ Cancel</button>`;
  optionsEl.innerHTML = html;
  document.getElementById('fireflySub').innerHTML = `You have <b>${ffCount}</b> Magic Firefl${ffCount === 1 ? 'y' : 'ies'}. Each converts to 1 resource of your choice.`;
  document.getElementById('fireflyOverlay').classList.add('active');
}

function doFireflyConvert(team, resourceKey) {
  const t = B[team];
  if (!t.resources.firefly || t.resources.firefly <= 0) { closeFireflyPicker(); return; }

  t.resources.firefly--;
  if (!t.resources[resourceKey]) t.resources[resourceKey] = 0;
  t.resources[resourceKey]++;

  const labelMap = { fire:'Sacred Fire', ice:'Ice Shard', luckyStone:'Lucky Stone', moonstone:'Moonstone', healingSeed:'Healing Seed', surge:'Surge', burn:'Burn' };
  const resLabel = labelMap[resourceKey] || resourceKey;
  log(`<span class="log-ability">MAGIC FIREFLIES!</span> Converted to <span class="log-ms">${resLabel}</span>!`);
  showAbilityCallout('MAGIC FIREFLIES!', '#ffd700', `Converted to ${resLabel}!`, team);

  renderBattle();

  // If still have fireflies, re-open picker after a brief delay
  if (t.resources.firefly > 0) {
    setTimeout(() => showFireflyPicker(team), 800);
  } else {
    closeFireflyPicker();
  }
}

function closeFireflyPicker() {
  document.getElementById('fireflyOverlay').classList.remove('active');
  B.fireflyPickerTeam = null;
}

// ============================================================
// JASPER (428) — Flame Dive: interactive bonus die reveal modal
// ============================================================
function showJasperModal(resumeCallback) {
  const jp = B.jasperPending;
  if (!jp) { if (resumeCallback) resumeCallback(); return; }
  B.jasperResume = resumeCallback;
  const titleEl = document.getElementById('jasperTitle');
  if (titleEl) titleEl.textContent = `${jp.wFName} — Flame Dive!`;
  const subEl = document.getElementById('jasperSub');
  if (subEl) subEl.innerHTML = `${jp.wFName} won — roll the bonus die for extra damage to <b>${jp.lFName}</b>!<br><i>Jasper takes 1 recoil damage.</i>`;
  const dieEl = document.getElementById('jasperDie');
  if (dieEl) { dieEl.textContent = '?'; dieEl.style.transform = 'rotate(0deg)'; }
  const btn = document.getElementById('jasperRollBtn');
  if (btn) { btn.disabled = false; btn.textContent = '🔥 Roll the Bonus Die!'; }
  narrate(`<b class="${jp.winTeamName}-text">${jp.wFName}</b>&nbsp;unleashes <b class="gold">FLAME DIVE!</b>`);
  document.getElementById('jasperOverlay').classList.add('active');
}

function doJasperRoll() {
  const btn = document.getElementById('jasperRollBtn');
  if (!btn || btn.disabled) return;
  btn.disabled = true;
  const jp = B.jasperPending;
  if (!jp) { finishJasperRoll(); return; }
  const finalValue = jp.bonusDie;
  const dieEl = document.getElementById('jasperDie');
  if (!dieEl) { finishJasperRoll(); return; }
  // Shuffle animation — same as Balatron
  let ticks = 0;
  const totalTicks = 10;
  const tickMs = 70;
  const shuffle = setInterval(() => {
    ticks++;
    dieEl.textContent = String(Math.floor(Math.random() * 6) + 1);
    dieEl.style.transform = `rotate(${ticks * 36}deg)`;
    if (ticks >= totalTicks) {
      clearInterval(shuffle);
      dieEl.textContent = String(finalValue);
      dieEl.style.transform = 'rotate(0deg)';
      if (finalValue >= 5) {
        dieEl.style.background = 'linear-gradient(135deg,#fde68a,#f59e0b)';
        dieEl.style.borderColor = '#f59e0b';
      } else if (finalValue >= 3) {
        dieEl.style.background = 'linear-gradient(135deg,#fbbf24,#d97706)';
        dieEl.style.borderColor = '#b45309';
      } else {
        dieEl.style.background = 'linear-gradient(135deg,#fecaca,#ef4444)';
        dieEl.style.borderColor = '#b91c1c';
      }
      setTimeout(() => finishJasperRoll(), 900);
    }
  }, tickMs);
}

function finishJasperRoll() {
  const jp = B.jasperPending;
  const resume = B.jasperResume;
  B.jasperPending = null;
  B.jasperResume = null;
  document.getElementById('jasperOverlay').classList.remove('active');
  if (jp) {
    const wTeamName = jp.winTeamName;
    const wTeamObj = B[wTeamName];
    const lTeamName = wTeamName === 'red' ? 'blue' : 'red';
    const lTeamObj = B[lTeamName];
    const wF = wTeamObj ? active(wTeamObj) : null;
    const lF = lTeamObj ? active(lTeamObj) : null;
    if (lF && lF.name === jp.lFName) {
      lF.hp = Math.max(0, lF.hp - jp.bonusDie);
      if (lF.hp <= 0 && !lF.ko) { lF.ko = true; lF.killedBy = 428; }
    }
    if (wF && wF.name === jp.wFName) {
      wF.hp = Math.max(0, wF.hp - 1);
      if (wF.hp <= 0) { wF.ko = true; wF.killedBy = -1; }
    }
    log(`<span class="log-ability">${jp.wFName}</span> — Flame Dive! Bonus die: <span class="log-dmg">${jp.bonusDie} extra damage</span> to ${jp.lFName}! Self-damage: <span class="log-dmg">1 HP</span>.`);
    renderBattle();
  }
  if (resume) setTimeout(resume, 300);
}

// ============================================================
// ELOISE (85) — Change of Heart: swap HP with enemy for 1 Ice Shard
// ============================================================
function doEloiseChoice(choice) {
  const ep = B.eloisePending;
  if (!ep) return;
  B.eloisePending = null;
  document.getElementById('eloiseOverlay').classList.remove('active');
  const { team, btn } = ep;
  const f = active(B[team]);
  const oppTeam = team === 'red' ? 'blue' : 'red';
  const oppF = active(B[oppTeam]);
  if (choice === 'yes' && f && !f.ko && oppF && !oppF.ko && B[team].resources.ice >= 1) {
    // Spend 1 Ice Shard
    B[team].resources.ice -= 1;
    B.eloiseUsedThisRound[team] = true;
    // Swap HP values
    const myOldHp = f.hp;
    const oppOldHp = oppF.hp;
    f.hp = oppOldHp;
    oppF.hp = myOldHp;
    showAbilityCallout('CHANGE OF HEART!', 'var(--rare)', `${f.name} — HP swap! (${myOldHp} → ${f.hp}) vs enemy (${oppOldHp} → ${oppF.hp})`, team);
    log(`<span class="log-ability">${f.name}</span> — Change of Heart! Spent 1 Ice Shard. Swapped HP: ${myOldHp} → ${f.hp}, enemy ${oppOldHp} → ${oppF.hp}.`);
    renderBattle();
    setTimeout(() => { btn.disabled = false; btn.classList.remove('locked'); doTeamRoll(team, btn); }, 1500);
  } else {
    B.eloiseUsedThisRound[team] = true; // mark used so we don't re-offer on re-render
    narrate(`<b class="${team}-text">Eloise</b> holds — no swap this round.`);
    setTimeout(() => { btn.disabled = false; btn.classList.remove('locked'); doTeamRoll(team, btn); }, 200);
  }
}

// ============================================================
// MALLOW (89) — Dozy Cozy: spend 1 Sacred Fire to heal active ghost +3 HP
// ============================================================
function doMallowChoice(choice) {
  const mp = B.mallowPending;
  if (!mp) return;
  B.mallowPending = null;
  document.getElementById('mallowOverlay').classList.remove('active');
  const { team, btn } = mp;
  const f = active(B[team]);
  B.mallowDecided[team] = true;
  if (choice === 'yes' && f && !f.ko && B[team].resources && B[team].resources.fire >= 2) {
    B[team].resources.fire -= 2;
    const hpBefore = f.hp;
    const mallowSideG = getSidelineGhost(B[team], 89);
    const mallowName = mallowSideG ? mallowSideG.name : 'Mallow';
    // Mr Filbert (59) — Mask Merchant: healing on enemy's active ghost is flipped to damage
    const enemyTeamObj = B[team === 'red' ? 'blue' : 'red'];
    const filbertCursesMallow = hasSideline(enemyTeamObj, 59);
    if (filbertCursesMallow) {
      f.hp = Math.max(0, f.hp - 3);
      if (f.hp <= 0) { f.hp = 0; f.ko = true; f.killedBy = 59; }
      showAbilityCallout('MASK MERCHANT!', 'var(--uncommon)',
        `Mr Filbert — Dozy Cozy cursed! ${f.name} takes 3 damage! (${hpBefore} → ${f.hp} HP)`, team === 'red' ? 'blue' : 'red');
      log(`<span class="log-ability">Mr Filbert</span> — Mask Merchant! Dozy Cozy flipped to damage. ${f.name} ${hpBefore} → ${f.hp} HP.`);
    } else {
      f.hp += 3;
      const overMallow = f.hp > f.maxHp;
      // Grant 2 Burn
      const enemyTeam = team === 'red' ? 'blue' : 'red';
      if (!B.burn[enemyTeam]) B.burn[enemyTeam] = {};
      const enemySideline = B[enemyTeam].ghosts.filter((g, i) => i !== B[enemyTeam].activeIdx && !g.ko);
      if (enemySideline.length > 0) {
        const burnTarget = enemySideline[0];
        B.burn[enemyTeam][burnTarget.id] = (B.burn[enemyTeam][burnTarget.id] || 0) + 2;
      }
      showAbilityCallout('DOZY COZY!', 'var(--rare)',
        `${mallowName} — spent 2 🔥! ${f.name} +3 HP (${hpBefore} → ${f.hp}${overMallow ? ' · overclocked!' : ''}) + 2 Burn!`, team);
      log(`<span class="log-ability">${mallowName}</span> — Dozy Cozy! Spent 2 Sacred Fire. ${f.name} +3 HP (${hpBefore} → ${f.hp}${overMallow ? ' · overclocked!' : ''}). +2 Burn!`);
    }
    renderBattle();
    if (f.ko) {
      // Ghost was KO'd by Filbert's Mask Merchant curse — trigger KO handling instead of rolling
      setTimeout(() => { if (!handleKOs()) renderBattle(); }, 1500);
    } else {
      setTimeout(() => { btn.disabled = false; btn.classList.remove('locked'); doTeamRoll(team, btn); }, 1500);
    }
  } else {
    log(`<span class="log-ability">Mallow</span> — holds the fire.`);
    setTimeout(() => { btn.disabled = false; btn.classList.remove('locked'); doTeamRoll(team, btn); }, 200);
  }
}

// ============================================================
// BOGEY (53) — Bogus: reactive reflect choice callback
// v430: Sylvia re-entry pattern. Called by bogeyOverlay buttons while
// resolveRound is paused at the damage-application decision point.
// ============================================================
function doBogeyReflectChoice(choice) {
  document.getElementById('bogeyOverlay').classList.remove('active');
  B.bogeyReflectChoice = choice;
  B.bogeyReflectResuming = true;
  resolveRound();
}

// ============================================================
// BOO BROTHERS (17) — Teamwork: trade 1 die for 1 HP before rolling
// ============================================================
function doBooChoice(choice) {
  const bp = B.booPending;
  if (!bp) return;
  B.booPending = null;
  document.getElementById('booOverlay').classList.remove('active');
  const { team, btn } = bp;
  const f = active(B[team]);
  if (choice === 'yes' && f && !f.ko && B.preRoll && B.preRoll[team] && B.preRoll[team].count >= 2) {
    const prevCount = B.preRoll[team].count;
    B.preRoll[team].count = Math.max(1, prevCount - 1);
    const prevHp = f.hp;
    // Mr Filbert (59) — Mask Merchant: healing on this ghost is flipped to damage
    const enemyTeamObj = B[team === 'red' ? 'blue' : 'red'];
    const filbertCursesTeamwork = hasSideline(enemyTeamObj, 59);
    if (filbertCursesTeamwork) {
      f.hp = Math.max(0, f.hp - 1);
      if (f.hp <= 0) { f.hp = 0; f.ko = true; f.killedBy = 59; }
      showAbilityCallout('MASK MERCHANT!', 'var(--uncommon)', `Mr Filbert — Teamwork cursed! ${f.name} takes 1 damage! (${prevHp} → ${f.hp} HP)`, team === 'red' ? 'blue' : 'red');
      log(`<span class="log-ability">Mr Filbert</span> — Mask Merchant! Teamwork flipped to damage. ${f.name} ${prevHp} → ${f.hp} HP.`);
    } else {
      f.hp += 1;
      const overTeam = f.hp > f.maxHp;
      showAbilityCallout('TEAMWORK!', 'var(--common)', `${f.name} — trade 1 die for +1 HP! (${prevCount} → ${B.preRoll[team].count} dice | ${prevHp} → ${f.hp} HP${overTeam ? ' · overclocked!' : ''})`, team);
      log(`<span class="log-ability">${f.name}</span> — Teamwork! Traded 1 die for +1 HP (${prevCount} → ${B.preRoll[team].count} dice, ${prevHp} → ${f.hp} HP${overTeam ? ' · overclocked!' : ''}).`);
    }
    renderBattle();
    if (f.ko) {
      // Ghost was KO'd by Filbert's Mask Merchant curse — trigger KO handling instead of rolling
      setTimeout(() => { if (!handleKOs()) renderBattle(); }, 1500);
    } else {
      setTimeout(() => { btn.disabled = false; btn.classList.remove('locked'); doTeamRoll(team, btn); }, 1500);
    }
  } else {
    narrate(`<b class="${team}-text">Boo Brothers</b> hold — keeping all dice.`);
    setTimeout(() => { btn.disabled = false; btn.classList.remove('locked'); doTeamRoll(team, btn); }, 200);
  }
}

// ============================================================
// GUS (31) — Gale Force: opt-in swap-on-win modal handler
// ============================================================
function doGusChoice(choice) {
  const gp = B.gusPending;
  if (!gp) return;
  B.gusPending = null;
  document.getElementById('gusOverlay').classList.remove('active');
  const { team, btn } = gp;
  const gusG = active(B[team]);
  B.galeForceDecided[team] = true; // don't re-offer this round regardless of choice
  if (choice === 'yes' && gusG && !gusG.ko) {
    B.galeForcePending[team] = true;
    showAbilityCallout('GALE FORCE!', 'var(--common)', `${gusG.name} — Gale Force primed! Win = force enemy swap!`, team);
    log(`<span class="log-ability">${gusG.name}</span> — Gale Force primed! Win this roll → force enemy ghost swap.`);
    setTimeout(() => { btn.disabled = false; btn.classList.remove('locked'); doTeamRoll(team, btn); }, 1500);
  } else {
    narrate(`<b class="${team}-text">Gus</b> holds — dealing damage if he wins.`);
    setTimeout(() => { btn.disabled = false; btn.classList.remove('locked'); doTeamRoll(team, btn); }, 200);
  }
}

// ============================================================
// RADITZ (62) — Hunt: entry forced-swap choice handlers
// ============================================================
function doRaditzHuntChoice(choice) {
  const rhp = B.raditzHuntPending;
  if (!rhp) return;
  B.raditzHuntPending = null;
  if (B.raditzHuntReady) B.raditzHuntReady[rhp.team] = false;
  document.getElementById('raditzHuntOverlay').classList.remove('active');
  const { team, btn, oppBtn } = rhp;

  if (choice === 'no') {
    narrate(`<b class="${team}-text">Raditz</b> — Hunt not used. Rolling as normal.`);
    // Unlock opponent's button so they can roll independently
    if (oppBtn) { oppBtn.disabled = false; oppBtn.classList.remove('locked'); }
    setTimeout(() => { btn.disabled = false; btn.classList.remove('locked'); doTeamRoll(team, btn); }, 200);
    return;
  }

  // YES — check for available sideline targets
  const enemyTeamName = team === 'red' ? 'blue' : 'red';
  const enemy = B[enemyTeamName];
  const aliveSideline = enemy.ghosts.filter((g, i) => i !== enemy.activeIdx && !g.ko);

  if (aliveSideline.length === 0) {
    // No valid swap targets (shouldn't happen, but guard it)
    narrate(`<b class="${team}-text">Raditz</b> — Hunt! No sideline ghosts to swap in.`);
    if (oppBtn) { oppBtn.disabled = false; oppBtn.classList.remove('locked'); }
    setTimeout(() => { btn.disabled = false; btn.classList.remove('locked'); doTeamRoll(team, btn); }, 200);
    return;
  }

  // Store continuation for doRaditzHuntSwap
  B.raditzHuntCont = { team, btn, oppBtn };

  if (aliveSideline.length === 1) {
    // Auto-swap to the only option
    doRaditzHuntSwap(team, enemy.ghosts.indexOf(aliveSideline[0]));
    return;
  }

  // Multiple options — show pressureOverlay for opponent to pick who comes in
  const enemyLabel = enemyTeamName.charAt(0).toUpperCase() + enemyTeamName.slice(1);
  const whoBanner = document.getElementById('pressureWho');
  if (whoBanner) { whoBanner.className = `pm-who-banner ${enemyTeamName}`; whoBanner.textContent = `🎯 ${enemyLabel.toUpperCase()} PICKS`; }
  const pTitle = document.getElementById('pressureTitle');
  if (pTitle) pTitle.textContent = `Hunt! — Raditz forces a swap`;
  const pSub = document.getElementById('pressureSub');
  if (pSub) pSub.textContent = `${enemyLabel}: choose which ghost enters the fight.`;
  document.getElementById('pressureOptions').innerHTML = aliveSideline.map(g => {
    const realIdx = enemy.ghosts.indexOf(g);
    const gd = ghostData(g.id);
    const hpRatio = g.hp / g.maxHp;
    const hpColor = hpRatio > 0.6 ? 'var(--hp-green)' : hpRatio > 0.3 ? 'var(--hp-yellow)' : 'var(--hp-red)';
    return `<div class="pressure-opt" onclick="doRaditzHuntSwap('${team}',${realIdx})">
      ${gd.art ? `<img src="${gd.art}" style="width:50px;height:50px;border-radius:6px;object-fit:cover;border:1px solid var(--${gd.rarity});">` : ''}
      <div><div style="font-weight:700;">${g.name}</div>
      <div style="font-size:12px;color:var(--text2);"><span style="color:${hpColor};font-weight:700;">♥ ${g.hp}/${g.maxHp}</span> · <span style="color:var(--moonstone);">${gd.ability}</span></div></div>
    </div>`;
  }).join('');
  // B.phase stays 'rolling'; both buttons are still locked — pressureOverlay blocks input
  document.getElementById('pressureOverlay').classList.add('active');
}

function doRaditzHuntSwap(attackerTeam, targetIdx) {
  document.getElementById('pressureOverlay').classList.remove('active');
  const cont = B.raditzHuntCont;
  B.raditzHuntCont = null;
  if (!cont) return;
  const { team, btn, oppBtn } = cont;

  const t = B[attackerTeam];
  const raditzG = active(t);
  const enemy = opp(t);
  const oldGhost = active(enemy);
  const oldName = oldGhost.name;

  // Perform the swap — incoming ghost returns at full HP
  enemy.activeIdx = targetIdx;
  const newGhost = active(enemy);
  newGhost.hp = newGhost.maxHp;
  renderBattle();

  const attackerCls = attackerTeam === 'red' ? 'red-text' : 'blue-text';
  narrate(`<b class="${attackerCls}">${raditzG.name}</b> — Hunt! <b>${oldName}</b> to the sideline — <b>${newGhost.name}</b> enters at full HP!`);
  showAbilityCallout('HUNT!', 'var(--rare)', `${oldName} forced out — ${newGhost.name} enters!`, attackerTeam);
  log(`<span class="log-ability">${raditzG.name}</span> — Hunt! ${oldName} sent to sideline, ${newGhost.name} enters at full HP.`);

  setTimeout(() => {
    const entryCalloutCount = triggerEntry(enemy, false);
    const afterEntry = entryCalloutCount > 0 ? entryCalloutCount * 1500 : 300;
    setTimeout(() => {
      if (handleKOs()) return; // entry effect caused a KO — KO flow takes over
      renderBattle();
      // Unlock opponent's button — they can now roll independently
      if (oppBtn) { oppBtn.disabled = false; oppBtn.classList.remove('locked'); }
      // Raditz's team rolls
      btn.disabled = false;
      btn.classList.remove('locked');
      doTeamRoll(team, btn);
    }, afterEntry);
  }, 1500);
}

// ============================================================
// DOUG (63) — Caution: once-per-game pre-roll swap for +1 die
// ============================================================
function doDougCautionChoice(choice) {
  const dp = B.dougCautionPending;
  if (!dp) return;
  B.dougCautionPending = null;
  document.getElementById('dougCautionOverlay').classList.remove('active');
  const { team, btn } = dp;

  if (choice === 'no') {
    // Mark as used so we don't re-offer (once-per-game skip counts as use)
    if (B.dougCautionUsed) B.dougCautionUsed[team] = true;
    narrate(`<b class="${team}-text">Doug</b> — Caution not used. Rolling as normal.`);
    setTimeout(() => { btn.disabled = false; btn.classList.remove('locked'); doTeamRoll(team, btn); }, 200);
    return;
  }
  // YES — show ghost picker (already rendered in the overlay)
  // doDougCautionSwap handles the actual swap
}

function doDougCautionSwap(targetIdx) {
  document.getElementById('dougCautionOverlay').classList.remove('active');
  const dp = B.dougCautionPending;
  B.dougCautionPending = null;
  if (!dp) return;
  const { team, btn } = dp;

  if (B.dougCautionUsed) B.dougCautionUsed[team] = true;

  const myTeam = B[team];
  const doug = active(myTeam); // Doug (currently active)
  const dougOldIdx = myTeam.activeIdx;
  const dougName = doug.name;

  // Swap Doug to sideline, bring in chosen ghost
  myTeam.activeIdx = targetIdx;
  const newGhost = active(myTeam);
  const newName = newGhost.name;

  renderBattle();

  const teamCls = `${team}-text`;
  narrate(`<b class="${teamCls}">${dougName}</b> — Caution! Swaps to sideline — <b>${newName}</b> enters (+1 die this roll)!`);
  showAbilityCallout('CAUTION!', 'var(--rare)', `${dougName} → sideline | ${newName} enters with +1 die!`, team);
  log(`<span class="log-ability">${dougName}</span> — Caution! Doug to sideline, ${newName} enters (+1 die this roll).`);

  setTimeout(() => {
    const entryCalloutCount = triggerEntry(myTeam, false);
    const afterEntry = entryCalloutCount > 0 ? entryCalloutCount * 1500 : 300;
    setTimeout(() => {
      if (handleKOs()) return;
      // Apply +1 die bonus to the incoming ghost's roll.
      // During Duel Phase, B.preRoll doesn't exist yet (it's built later in
      // doPreRollSetup), so stash a promise that doPreRollSetup picks up.
      if (B.preRoll && B.preRoll[team]) {
        B.preRoll[team].count = Math.min(6, B.preRoll[team].count + 1);
      } else if (B.dougCautionDieBonus) {
        B.dougCautionDieBonus[team] = true;
      }
      renderBattle();
      btn.disabled = false;
      btn.classList.remove('locked');
      doTeamRoll(team, btn);
    }, afterEntry);
  }, 1500);
}

// ============================================================
// JACKSON (50) — Regrow: post-roll spend 1 HP to reroll 1 die
// ============================================================
function checkJacksonRegrow(team, dice, continuation) {
  const f = active(B[team]);
  if (!f || f.id !== 50 || f.ko || f.hp < 2 || B.jacksonUsedThisRound[team]) {
    continuation();
    return;
  }
  B.jacksonPending = { team, dice: [...dice], continuation };
  document.getElementById('jacksonTitle').textContent = `Jackson — Regrow! (${f.hp} HP)`;
  document.getElementById('jacksonSub').textContent = `Spend 1 HP to reroll 1 die? (${f.hp} → ${f.hp - 1} HP)`;
  document.getElementById('jacksonDiePicker').style.display = 'none';
  document.getElementById('jacksonOverlay').classList.add('active');
}

function doJacksonChoice(choice) {
  const jp = B.jacksonPending;
  if (!jp) return;
  const { team, dice, continuation } = jp;
  const f = active(B[team]);
  if (choice === 'no' || !f || f.ko || f.hp < 2) {
    B.jacksonPending = null;
    document.getElementById('jacksonOverlay').classList.remove('active');
    narrate(`<b class="${team}-text">Jackson</b> holds HP — keeping dice as rolled.`);
    continuation();
    return;
  }
  // YES — show die picker with current dice values as buttons
  const diceButtons = document.getElementById('jacksonDiceButtons');
  diceButtons.innerHTML = dice.map((v, i) =>
    `<button onclick="pickJacksonDie(${i})" style="width:50px;height:50px;border-radius:10px;border:2px solid var(--uncommon);background:rgba(74,222,128,0.12);color:var(--uncommon);font-size:24px;font-weight:900;cursor:pointer;">${v}</button>`
  ).join('');
  document.getElementById('jacksonDiePicker').style.display = 'block';
}

function pickJacksonDie(idx) {
  const jp = B.jacksonPending;
  if (!jp) return;
  B.jacksonPending = null;
  const { team, continuation } = jp;
  const t = B[team];
  const f = active(t);
  document.getElementById('jacksonOverlay').classList.remove('active');
  if (!f || f.ko || f.hp < 2) { continuation(); return; }

  // Spend 1 HP
  const prevHp = f.hp;
  f.hp -= 1;
  B.jacksonUsedThisRound[team] = true;

  // Mutate the preRoll dice array IN-PLACE so postRollDone's closure sees the change.
  // (Same pattern as Sonya v284 / Jeanie v285 / Dark Wing v285)
  // Creating a new array via [...B.redDice] does NOT work: postRollDone() closes over
  // B.preRoll.*.dice by reference, so its B.pendingResolve = { redDice, blueDice }
  // would silently overwrite Jackson's rerolled die before resolveRound ever sees it.
  const preRollDice = team === 'red' ? B.preRoll.red.dice : B.preRoll.blue.dice;
  const oldVal = preRollDice[idx];
  const newVal = Math.floor(Math.random() * 6) + 1;
  preRollDice[idx] = newVal;
  preRollDice.sort((a, b) => a - b);

  // Keep B.redDice/B.blueDice and B.pendingResolve in sync (pendingResolve may not exist yet)
  if (team === 'red') { B.redDice = preRollDice; if (B.pendingResolve) B.pendingResolve.redDice = preRollDice; }
  else               { B.blueDice = preRollDice; if (B.pendingResolve) B.pendingResolve.blueDice = preRollDice; }
  renderDice(B.redDice, B.blueDice);
  renderBattle();

  showAbilityCallout('REGROW!', 'var(--uncommon)', `${f.name} — die rerolled: ${oldVal} → ${newVal}! (${prevHp} → ${f.hp} HP)`, team);
  log(`<span class="log-ability">${f.name}</span> — Regrow! Spent 1 HP, rerolled die: ${oldVal} → ${newVal} (${prevHp} → ${f.hp} HP). New dice: [${preRollDice.join(', ')}]`);

  // Short pause for callout, then continue to moonstone/lucky stones
  setTimeout(() => { continuation(); }, 1200);
}

// ============================================================
// Jeanie (90) — Hidden Treasure: force opponent reroll (once per game)
// Fires post-roll (after Jackson), when Jeanie is on the sideline
// ============================================================
function checkJeanieHiddenTreasure(team, continuation) {
  // Team is Jeanie's team — they can force the OPPONENT to reroll
  if (!hasSideline(B[team], 90) || !B.jeanieUsed || B.jeanieUsed[team]) {
    continuation();
    return;
  }
  const jF = getSidelineGhost(B[team], 90);
  if (!jF || jF.ko) { continuation(); return; }

  const oppTeam = team === 'red' ? 'blue' : 'red';
  const oppF = active(B[oppTeam]);
  const oppLabel = oppTeam.charAt(0).toUpperCase() + oppTeam.slice(1);
  const oppDice = team === 'red' ? B.blueDice : B.redDice;

  B.jeaniePending = { team, oppTeam, continuation };
  document.getElementById('jeanieTitle').textContent = `Jeanie — Hidden Treasure! (${team.charAt(0).toUpperCase()+team.slice(1)})`;
  document.getElementById('jeanieSub').textContent = `Force ${oppLabel} (${oppF ? oppF.name : 'opponent'}) to reroll all ${oppDice.length} dice? (Once per game)`;
  document.getElementById('jeanieOverlay').classList.add('active');
}

function doJeanieChoice(choice) {
  const jp = B.jeaniePending;
  if (!jp) return;
  B.jeaniePending = null;
  document.getElementById('jeanieOverlay').classList.remove('active');

  const { team, oppTeam, continuation } = jp;
  const teamLabel = team.charAt(0).toUpperCase() + team.slice(1);
  const oppLabel = oppTeam.charAt(0).toUpperCase() + oppTeam.slice(1);

  if (choice === 'no') {
    narrate(`<b class="${team}-text">Jeanie</b> holds the treasure for now...`);
    continuation();
    return;
  }

  // YES — consume the once-per-game use
  B.jeanieUsed[team] = true;

  // Reroll ALL of the opponent's dice
  // Mutate the preRoll dice array IN-PLACE so the doPostRollAndResolve closure captures
  // the change. Creating a new array and assigning to B.pendingResolve does NOT work:
  // postRollDone() creates B.pendingResolve = { redDice, blueDice } using the closure
  // variables (which are B.preRoll.red/blue.dice) AFTER Jeanie runs, silently
  // overwriting any assignment to B.pendingResolve made here. (Same bug fixed for Sonya
  // in v284 and Dark Wing earlier.)
  const oldDice = oppTeam === 'red' ? [...B.preRoll.red.dice] : [...B.preRoll.blue.dice];
  const numDice = oldDice.length;
  const newDice = Array.from({length: numDice}, () => Math.floor(Math.random() * 6) + 1).sort((a,b)=>a-b);

  // Splice into the preRoll array in-place so the closure sees the new values
  const preRollDice = oppTeam === 'red' ? B.preRoll.red.dice : B.preRoll.blue.dice;
  preRollDice.splice(0, preRollDice.length, ...newDice);
  if (oppTeam === 'red') { B.redDice = preRollDice; if (B.pendingResolve) B.pendingResolve.redDice = preRollDice; }
  else                   { B.blueDice = preRollDice; if (B.pendingResolve) B.pendingResolve.blueDice = preRollDice; }
  renderDice(B.redDice, B.blueDice);
  renderBattle();

  const jF = getSidelineGhost(B[team], 90);
  showAbilityCallout('HIDDEN TREASURE!', 'var(--rare)',
    `${jF ? jF.name : 'Jeanie'} forces ${oppLabel} to reroll! [${oldDice.join(', ')}] → [${newDice.join(', ')}]`, team);
  log(`<span class="log-ability">Jeanie</span> — Hidden Treasure! ${teamLabel} forces ${oppLabel} to reroll: [${oldDice.join(', ')}] → [${newDice.join(', ')}].`);

  // Pause for callout splash then continue
  setTimeout(() => { continuation(); }, 1500);
}

// ============================================================
// SONYA (69) — Mesmerize: post-roll change one die to 2 (once per round, free)
// ============================================================
function checkSonyaMesmerize(team, continuation) {
  const f = active(B[team]);
  if (!f || f.id !== 69 || f.ko || (B.sonyaUsedThisRound && B.sonyaUsedThisRound[team])) {
    continuation();
    return;
  }
  B.sonyaPending = { team, continuation };
  document.getElementById('sonyaTitle').textContent = `Sonya — Mesmerize! (${team.charAt(0).toUpperCase()+team.slice(1)})`;
  document.getElementById('sonyaSub').textContent = `Change one of your dice to a 2? (Free — once per roll)`;
  document.getElementById('sonyaDiePicker').style.display = 'none';
  document.getElementById('sonyaOverlay').classList.add('active');
}

function doSonyaChoice(choice) {
  const sp = B.sonyaPending;
  if (!sp) return;
  const { team, continuation } = sp;
  if (choice === 'no') {
    B.sonyaPending = null;
    document.getElementById('sonyaOverlay').classList.remove('active');
    narrate(`<b class="${team}-text">Sonya</b> holds steady — keeping dice as rolled.`);
    continuation();
    return;
  }
  // YES — show die picker with current dice as clickable buttons
  const dice = team === 'red' ? [...B.redDice] : [...B.blueDice];
  const diceButtons = document.getElementById('sonyaDiceButtons');
  diceButtons.innerHTML = dice.map((v, i) =>
    `<button onclick="pickSonyaDie(${i})" style="width:50px;height:50px;border-radius:10px;border:2px solid #8b2fc9;background:rgba(139,47,201,0.15);color:#c084fc;font-size:24px;font-weight:900;cursor:pointer;">${v}</button>`
  ).join('');
  document.getElementById('sonyaDiePicker').style.display = 'block';
}

function pickSonyaDie(idx) {
  const sp = B.sonyaPending;
  if (!sp) return;
  B.sonyaPending = null;
  const { team, continuation } = sp;
  const f = active(B[team]);
  document.getElementById('sonyaOverlay').classList.remove('active');
  if (!f || f.ko) { continuation(); return; }

  // Mutate the preRoll dice array IN-PLACE so the doPostRollAndResolve closure captures
  // the change. Creating a new array via [...B.redDice] does NOT work: postRollDone()
  // captures B.preRoll.red.dice by reference, so when it later runs
  //   B.pendingResolve = { redDice, blueDice, ... }
  // it uses the original unmodified closure variable, silently discarding Sonya's edit.
  // Dark Wing uses the same in-place splice pattern (see doDarkWingChoice ~line 4386).
  const preRollDice = team === 'red' ? B.preRoll.red.dice : B.preRoll.blue.dice;
  const oldVal = preRollDice[idx];

  preRollDice[idx] = 2;
  preRollDice.sort((a, b) => a - b);
  if (B.sonyaUsedThisRound) B.sonyaUsedThisRound[team] = true;

  // Keep B.redDice/B.blueDice and B.pendingResolve in sync (pendingResolve may not exist yet)
  if (team === 'red') { B.redDice = preRollDice; if (B.pendingResolve) B.pendingResolve.redDice = preRollDice; }
  else               { B.blueDice = preRollDice; if (B.pendingResolve) B.pendingResolve.blueDice = preRollDice; }
  renderDice(B.redDice, B.blueDice);
  renderBattle();

  if (oldVal === 2) {
    showAbilityCallout('MESMERIZE!', 'var(--rare)', `${f.name} — die already showing 2, no change!`, team);
    log(`<span class="log-ability">${f.name}</span> — Mesmerize! Die already a 2, no change.`);
  } else {
    showAbilityCallout('MESMERIZE!', 'var(--rare)', `${f.name} — changed die: ${oldVal} → 2! New dice: [${preRollDice.join(', ')}]`, team);
    log(`<span class="log-ability">${f.name}</span> — Mesmerize! Changed die ${oldVal} → 2. Dice: [${preRollDice.join(', ')}]`);
  }

  setTimeout(() => { continuation(); }, 1200);
}

// ============================================================
// Dark Wing (76) — Precision: post-roll reroll all dice if not doubles
// Fires after drainAbilityQueue, before Jackson in the post-roll chain
// ============================================================
function checkDarkWingPrecision(team, continuation) {
  const f = active(B[team]);
  if (!f || f.id !== 76 || f.ko) { continuation(); return; }
  if (B.darkWingUsedThisGame && B.darkWingUsedThisGame[team]) { continuation(); return; }
  const dice = team === 'red' ? B.redDice : B.blueDice;
  // Skip the reroll offer if we already got doubles OR BETTER (triples/quads/penta).
  // Rerolling a triple is strictly worse — damage can only drop.
  if (classify(dice).damage >= 2) { continuation(); return; }
  // Offer reroll
  B.darkWingPending = { team, continuation };
  const tLabel = team.charAt(0).toUpperCase() + team.slice(1);
  document.getElementById('darkWingTitle').textContent = `Dark Wing — Precision! (${tLabel})`;
  document.getElementById('darkWingSub').textContent = `Rolled [${dice.join(', ')}] — no doubles. Reroll all ${dice.length} dice?`;
  document.getElementById('darkWingOverlay').classList.add('active');
}

function doDarkWingChoice(choice) {
  const dp = B.darkWingPending;
  if (!dp) return;
  B.darkWingPending = null;
  document.getElementById('darkWingOverlay').classList.remove('active');
  const { team, continuation } = dp;
  const f = active(B[team]);
  if (B.darkWingUsedThisGame) B.darkWingUsedThisGame[team] = true;

  if (choice === 'no' || !f || f.ko) {
    narrate(`<b class="${team}-text">Dark Wing</b> holds — keeping dice as rolled.`);
    continuation();
    return;
  }

  // YES — reroll all dice for this team
  const count = team === 'red' ? B.preRoll.red.count : B.preRoll.blue.count;
  const newDice = Array.from({ length: count }, () => Math.floor(Math.random() * 6) + 1).sort((a, b) => a - b);

  // Mutate the preRoll dice array in-place so the postRollDone closure sees the new values
  const preRollDice = team === 'red' ? B.preRoll.red.dice : B.preRoll.blue.dice;
  preRollDice.splice(0, preRollDice.length, ...newDice);
  if (team === 'red') B.redDice = preRollDice;
  else B.blueDice = preRollDice;
  renderDice(B.redDice, B.blueDice);
  renderBattle();

  const rollType = classify(newDice).type;
  showAbilityCallout('PRECISION!', 'var(--rare)', `${f.name} — rerolled! [${newDice.join(', ')}]${rollType === 'doubles' ? ' 🎯 Doubles!' : ''}`, team);
  log(`<span class="log-ability">${f.name}</span> — Precision! Rerolled all dice → [${newDice.join(', ')}]`);

  setTimeout(() => { continuation(); }, 1200);
}

// ============================================================
// Drizzle (328) — Rain Dance: auto-reroll all 1s from both teams (free, no modal)
// Fires before Dark Wing in the post-roll chain.
// Uses in-place splice/mutation so the postRollDone closure captures the new values.
// ============================================================
// Tommy Salami (30) — Regulator: when Tommy rolls a 6, gain +1 bonus die rolled immediately.
// Chains as long as bonus dice keep rolling 6s. Fires BEFORE Drizzle in the post-roll chain.
// Interactive modal version: each 6 triggers a click-to-roll bonus die. Chains on 6s.
// B.tommyRegulatorBonus[team] stores total bonus dice added (used for callouts/log only).
function checkTommyRegulator(continuation) {
  const rF = active(B.red), bF = active(B.blue);
  const tommyTeamName = (rF && rF.id === 30 && !rF.ko) ? 'red' : (bF && bF.id === 30 && !bF.ko) ? 'blue' : null;
  // Reset bonus both teams each round regardless of whether Tommy is active
  if (B.tommyRegulatorBonus) { B.tommyRegulatorBonus.red = 0; B.tommyRegulatorBonus.blue = 0; }
  if (!tommyTeamName) { continuation(); return; }
  const tommyF = tommyTeamName === 'red' ? rF : bF;
  const tommyDice = B.preRoll[tommyTeamName].dice;
  if (!tommyDice || tommyDice.length === 0) { continuation(); return; }
  // Count 6s in Tommy's initial roll
  const initialSixes = tommyDice.filter(d => d === 6).length;
  if (initialSixes === 0) { continuation(); return; }

  // AutoPlay: silent auto-roll (AI doesn't need the modal)
  if (autoPlayRunning) {
    let newSixes = initialSixes;
    let totalBonus = 0;
    while (newSixes > 0) {
      const bonusDice = [];
      for (let i = 0; i < newSixes; i++) {
        bonusDice.push(Math.floor(Math.random() * 6) + 1);
      }
      tommyDice.push(...bonusDice);
      totalBonus += bonusDice.length;
      newSixes = bonusDice.filter(d => d === 6).length;
    }
    if (totalBonus > 0) {
      B.tommyRegulatorBonus[tommyTeamName] = totalBonus;
      tommyDice.sort((a, b) => a - b);
      if (tommyTeamName === 'red') { B.redDice = tommyDice; }
      else { B.blueDice = tommyDice; }
      renderDice(B.redDice, B.blueDice);
      renderBattle();
    }
    continuation();
    return;
  }

  // Interactive modal: chain one die at a time
  B.tommyChainPending = {
    team: tommyTeamName,
    dice: tommyDice,
    pendingSixes: initialSixes,
    totalBonus: 0,
    tommyF: tommyF,
    continuation: continuation
  };
  // Show modal
  const sub = document.getElementById('tommySub');
  sub.textContent = `You rolled ${initialSixes} six${initialSixes > 1 ? 'es' : ''}! Roll a bonus die!`;
  const dieEl = document.getElementById('tommyDieDisplay');
  dieEl.textContent = '🎲';
  const btn = document.getElementById('tommyRollBtn');
  btn.disabled = false;
  btn.textContent = '🎲 Roll the Bonus Die!';
  document.getElementById('tommyOverlay').classList.add('active');
}

function doTommyRoll() {
  const btn = document.getElementById('tommyRollBtn');
  if (!btn || btn.disabled) return;
  btn.disabled = true;

  const tp = B.tommyChainPending;
  if (!tp) return;

  const finalValue = Math.floor(Math.random() * 6) + 1;
  const dieEl = document.getElementById('tommyDieDisplay');

  // Shuffle animation: cycle through random values for ~600ms then land
  let ticks = 0;
  const totalTicks = 10;
  const tickMs = 60;
  const shuffle = setInterval(() => {
    ticks++;
    dieEl.textContent = String(Math.floor(Math.random() * 6) + 1);
    dieEl.style.transform = `rotate(${ticks * 36}deg)`;
    if (ticks >= totalTicks) {
      clearInterval(shuffle);
      dieEl.textContent = String(finalValue);
      dieEl.style.transform = 'rotate(0deg) scale(1.3)';
      setTimeout(() => { dieEl.style.transform = 'rotate(0deg) scale(1)'; }, 200);

      // Add die to Tommy's array
      tp.dice.push(finalValue);
      tp.totalBonus++;
      tp.pendingSixes--;

      if (finalValue === 6) {
        // Chain continues! This 6 adds another pending roll
        tp.pendingSixes++;
      }

      const sub = document.getElementById('tommySub');
      if (tp.pendingSixes > 0) {
        // More rolls to do
        if (finalValue === 6) {
          sub.innerHTML = `<b>ANOTHER 6!</b> +${tp.totalBonus} bonus dice so far! Keep rolling!`;
        } else {
          sub.innerHTML = `Rolled a ${finalValue}! +${tp.totalBonus} bonus dice so far! ${tp.pendingSixes} more to roll!`;
        }
        btn.disabled = false;
        btn.textContent = '🎲 Roll the Bonus Die!';
      } else {
        // Chain ends
        if (finalValue === 6) {
          sub.innerHTML = `<b>ANOTHER 6!</b> +${tp.totalBonus} bonus dice total! Chain complete!`;
        } else {
          sub.innerHTML = `Rolled a ${finalValue}! Chain ends! <b>+${tp.totalBonus} bonus dice total!</b>`;
        }
        // Close modal after delay and finalize
        setTimeout(() => { finishTommyChain(); }, 1000);
      }
    }
  }, tickMs);
}

function finishTommyChain() {
  const tp = B.tommyChainPending;
  if (!tp) return;
  B.tommyChainPending = null;
  document.getElementById('tommyOverlay').classList.remove('active');

  const { team, dice, totalBonus, tommyF, continuation } = tp;
  B.tommyRegulatorBonus[team] = totalBonus;
  dice.sort((a, b) => a - b);
  if (team === 'red') { B.redDice = dice; }
  else { B.blueDice = dice; }
  renderDice(B.redDice, B.blueDice);
  renderBattle();
  showAbilityCallout('REGULATOR!', 'var(--common)',
    `${tommyF.name} — Rolled 6s! +${totalBonus} bonus dice! Now rolling [${dice.join(', ')}]`, team);
  log(`<span class="log-ability">${tommyF.name}</span> — Regulator! Rolled 6s → +${totalBonus} bonus dice! [${dice.join(', ')}]`);
  setTimeout(() => { continuation(); }, 800);
}

// ============================================================
// Calvin & Anna (91) — Toboggan: post-KO voluntary swap
// ============================================================
function showTobogganModal(winTeamName, sidelineGhosts, continuation) {
  const teamColor = winTeamName === 'red' ? 'red-text' : 'blue-text';
  const banner = document.getElementById('tobogganBanner');
  if (banner) {
    banner.className = 'pm-who-banner ' + winTeamName;
    banner.textContent = '🛷 TOBOGGAN!';
  }

  // Build ghost portrait options (sideline ghosts to swap C&A with)
  const opts = document.getElementById('tobogganOptions');
  if (opts) {
    opts.innerHTML = sidelineGhosts.map(g => {
      const gd = ghostData(g.id);
      const realIdx = B[winTeamName].ghosts.indexOf(g);
      const hpRatio = g.hp / g.maxHp;
      const hpColor = hpRatio > 0.6 ? 'var(--hp-green)' : hpRatio > 0.3 ? 'var(--hp-yellow)' : 'var(--hp-red)';
      return `<div class="pressure-opt" onclick="doTobogganChoice(${realIdx})">
        ${gd.art ? `<img src="${gd.art}" style="width:50px;height:50px;border-radius:6px;object-fit:cover;border:1px solid var(--${gd.rarity});">` : ''}
        <div>
          <div style="font-weight:700;">${g.name}</div>
          <div style="font-size:12px;color:var(--text2);"><span style="color:${hpColor};font-weight:700;">&hearts; ${g.hp}/${g.maxHp}</span> &middot; <span style="color:var(--moonstone);">${gd.ability}</span></div>
        </div>
      </div>`;
    }).join('');
  }

  // Store continuation for doTobogganChoice
  B.tobogganPending = { winTeamName, continuation };
  B.phase = 'ko-pause'; // keep roll buttons locked during modal
  document.getElementById('tobogganOverlay').classList.add('active');
}

function doTobogganChoice(idx) {
  const tp = B.tobogganPending;
  if (!tp) return;
  B.tobogganPending = null;
  document.getElementById('tobogganOverlay').classList.remove('active');

  const { winTeamName, continuation } = tp;
  const winTeam = B[winTeamName];
  const caGhost = active(winTeam); // Calvin & Anna (currently active)

  if (idx === -1) {
    // No — C&A stays in
    narrate(`<b class="${winTeamName}-text">Calvin &amp; Anna</b> stays in the fight!`);
    log(`Calvin & Anna — Toboggan declined. Staying in.`);
    continuation();
    return;
  }

  // YES — swap C&A to sideline, bring chosen ghost in
  const oldName = caGhost.name;
  const newGhost = winTeam.ghosts[idx];

  winTeam.activeIdx = idx;
  // Incoming ghost heals to full HP when entering from sideline
  newGhost.hp = newGhost.maxHp;
  renderBattle();

  const teamColor = winTeamName === 'red' ? 'red-text' : 'blue-text';
  narrate(`<b class="${teamColor}">${oldName}</b> — Toboggan! Slides to sideline — <b>${newGhost.name}</b> enters the fight!`);
  showAbilityCallout('TOBOGGAN!', 'var(--rare)', `${oldName} slides out — ${newGhost.name} enters!`, winTeamName);
  log(`<span class="log-ability">Calvin & Anna</span> — Toboggan! ${oldName} slides to sideline, ${newGhost.name} enters.`);

  // Fire entry effects for the newly-active ghost, then continue
  setTimeout(() => {
    const entryCount = triggerEntry(winTeam, false);
    const entryDelay = entryCount > 0 ? entryCount * 1500 + 300 : 300;
    setTimeout(() => {
      continuation();
    }, entryDelay);
  }, 1500);
}

// ============================================================
// Fang Outside (6) — Skillful Coward: post-win voluntary swap
// ============================================================
function showFangOutsideModal(winTeamName, sidelineGhosts, continuation) {
  const banner = document.getElementById('fangOutsideBanner');
  if (banner) {
    banner.className = 'pm-who-banner ' + winTeamName;
    banner.textContent = '💨 SKILLFUL COWARD!';
  }

  // Build ghost portrait options (sideline ghosts to swap Fang with)
  const opts = document.getElementById('fangOutsideOptions');
  if (opts) {
    opts.innerHTML = sidelineGhosts.map(g => {
      const gd = ghostData(g.id);
      const realIdx = B[winTeamName].ghosts.indexOf(g);
      const hpRatio = g.hp / g.maxHp;
      const hpColor = hpRatio > 0.6 ? 'var(--hp-green)' : hpRatio > 0.3 ? 'var(--hp-yellow)' : 'var(--hp-red)';
      return `<div class="pressure-opt" onclick="doFangOutsideChoice(${realIdx})">
        ${gd.art ? `<img src="${gd.art}" style="width:50px;height:50px;border-radius:6px;object-fit:cover;border:1px solid var(--${gd.rarity});">` : ''}
        <div>
          <div style="font-weight:700;">${g.name}</div>
          <div style="font-size:12px;color:var(--text2);"><span style="color:${hpColor};font-weight:700;">&hearts; ${g.hp}/${g.maxHp}</span> &middot; <span style="color:var(--moonstone);">${gd.ability}</span></div>
        </div>
      </div>`;
    }).join('');
  }

  B.fangOutsidePending = { winTeamName, continuation };
  B.phase = 'ko-pause';
  document.getElementById('fangOutsideOverlay').classList.add('active');
}

function doFangOutsideChoice(idx) {
  const fp = B.fangOutsidePending;
  if (!fp) return;
  B.fangOutsidePending = null;
  document.getElementById('fangOutsideOverlay').classList.remove('active');

  const { winTeamName, continuation } = fp;
  const winTeam = B[winTeamName];
  const fangGhost = active(winTeam); // Fang Outside (currently active)

  if (idx === -1) {
    // No — Fang stays in
    narrate(`<b class="${winTeamName}-text">Fang Outside</b> holds their ground!`);
    log(`Fang Outside — Skillful Coward declined. Staying in.`);
    continuation();
    return;
  }

  // YES — swap Fang to sideline, bring chosen ghost in
  const oldName = fangGhost.name;
  const newGhost = winTeam.ghosts[idx];

  winTeam.activeIdx = idx;
  // Fang retains their HP on the sideline; incoming ghost retains their sideline HP
  renderBattle();

  const teamColor = winTeamName === 'red' ? 'red-text' : 'blue-text';
  narrate(`<b class="${teamColor}">${oldName}</b> — Skillful Coward! Slips to sideline — <b>${newGhost.name}</b> enters the fight!`);
  showAbilityCallout('SKILLFUL COWARD!', 'var(--common)', `${oldName} slips out — ${newGhost.name} enters!`, winTeamName);
  log(`<span class="log-ability">Fang Outside</span> — Skillful Coward! ${oldName} to sideline, ${newGhost.name} enters.`);

  // Fire entry effects for the newly-active ghost, then continue
  setTimeout(() => {
    const entryCount = triggerEntry(winTeam, false);
    const entryDelay = entryCount > 0 ? entryCount * 1500 + 300 : 300;
    setTimeout(() => {
      continuation();
    }, entryDelay);
  }, 1500);
}

// Fang Undercover (7) — Skilled Coward: arm choice handler
function doFangUndercoverArmChoice(choice) {
  const fp = B.fangUndercoverPending;
  if (!fp) return;
  B.fangUndercoverPending = null;
  document.getElementById('fangUndercoverArmOverlay').classList.remove('active');
  const { team, btn } = fp;
  if (choice === 'yes') {
    B.fangUndercoverArmed[team] = true;
    showAbilityCallout('SKILLED COWARD!', 'var(--common)', `Fang Undercover armed — dodge incoming damage this round!`, team);
    log(`<span class="log-ability">Fang Undercover</span> — Skilled Coward armed!`);
  } else {
    log(`Fang Undercover — Skilled Coward declined. Fighting straight.`);
  }
  btn.classList.remove('locked');
  btn.disabled = false;
  doTeamRoll(team);
}

// Fang Undercover (7) — Skilled Coward: ghost-picker modal after dodge triggers
function showFangUndercoverSwapModal(loseTeamName, sidelineGhosts, continuation) {
  const banner = document.getElementById('fangUndercoverSwapBanner');
  if (banner) {
    banner.className = `pm-who-banner ${loseTeamName}`;
    banner.textContent = '🥷 SKILLED COWARD!';
  }
  const opts = document.getElementById('fangUndercoverSwapOptions');
  const fuTeam = B[loseTeamName];
  opts.innerHTML = sidelineGhosts.map(g => {
    const realIdx = fuTeam.ghosts.indexOf(g);
    const gd = ghostData(g.id);
    const hpRatio = g.hp / g.maxHp;
    const hpColor = hpRatio > 0.6 ? 'var(--hp-green)' : hpRatio > 0.3 ? 'var(--hp-yellow)' : 'var(--hp-red)';
    return `<div class="pressure-opt" onclick="doFangUndercoverSwapChoice(${realIdx})">
      ${gd.art ? `<img src="${gd.art}" style="width:50px;height:50px;border-radius:6px;object-fit:cover;border:1px solid var(--common);">` : ''}
      <div><div style="font-weight:700;">${g.name}</div>
      <div style="font-size:12px;color:var(--text2);"><span style="color:${hpColor};font-weight:700;">♥ ${g.hp}/${g.maxHp}</span> · <span style="color:var(--common);">${gd.ability}</span></div></div>
    </div>`;
  }).join('');
  B.fangUndercoverSwapData = { loseTeamName, continuation };
  document.getElementById('fangUndercoverSwapOverlay').classList.add('active');
}

function doFangUndercoverSwapChoice(idx) {
  const sd = B.fangUndercoverSwapData;
  if (!sd) return;
  B.fangUndercoverSwapData = null;
  document.getElementById('fangUndercoverSwapOverlay').classList.remove('active');
  const { loseTeamName, continuation } = sd;
  const fuTeam = B[loseTeamName];
  const fangGhost = active(fuTeam); // Fang Undercover (currently active, going to sideline)
  const oldName = fangGhost.name;
  const newGhost = fuTeam.ghosts[idx];
  const teamColor = loseTeamName === 'red' ? 'red-text' : 'blue-text';

  fuTeam.activeIdx = idx; // swap Fang to sideline, new ghost becomes active
  renderBattle();

  narrate(`<b class="${teamColor}">${oldName}</b> — Skilled Coward! Slips to sideline — <b>${newGhost.name}</b> enters the fight!`);
  showAbilityCallout('SKILLED COWARD!', 'var(--common)', `${oldName} slips out — ${newGhost.name} enters!`, loseTeamName);
  log(`<span class="log-ability">Fang Undercover</span> — Skilled Coward! ${oldName} to sideline, ${newGhost.name} enters.`);

  // Fire entry effects for the newly-active ghost, then continue
  setTimeout(() => {
    const entryCount = triggerEntry(fuTeam, false);
    const entryDelay = entryCount > 0 ? entryCount * 1500 + 300 : 300;
    setTimeout(() => {
      continuation();
    }, entryDelay);
  }, 1500);
}

// ============================================================
// Winston (15) — Scheme: post-doubles-win force opponent ghost swap
// ============================================================
function showWinstonSchemeModal(winTeamName, loseTeamName, sidelineGhosts, continuation) {
  const banner = document.getElementById('winstonSchemeBanner');
  if (banner) {
    banner.className = `pm-who-banner ${winTeamName}`;
    banner.textContent = '♟️ SCHEME!';
  }

  const loseTeam = B[loseTeamName];
  const opts = document.getElementById('winstonSchemeOptions');
  if (opts) {
    opts.innerHTML = sidelineGhosts.map(g => {
      const gd = ghostData(g.id);
      const realIdx = loseTeam.ghosts.indexOf(g);
      const hpRatio = g.hp / g.maxHp;
      const hpColor = hpRatio > 0.6 ? 'var(--hp-green)' : hpRatio > 0.3 ? 'var(--hp-yellow)' : 'var(--hp-red)';
      return `<div class="pressure-opt" onclick="doWinstonSchemeChoice(${realIdx})">
        ${gd.art ? `<img src="${gd.art}" style="width:50px;height:50px;border-radius:6px;object-fit:cover;border:1px solid var(--${gd.rarity});">` : ''}
        <div>
          <div style="font-weight:700;">${g.name}</div>
          <div style="font-size:12px;color:var(--text2);"><span style="color:${hpColor};font-weight:700;">&hearts; ${g.hp}/${g.maxHp}</span> &middot; <span style="color:var(--${gd.rarity});">${gd.ability}</span></div>
        </div>
      </div>`;
    }).join('');
  }

  B.winstonSchemePending = { winTeamName, loseTeamName, continuation };
  B.phase = 'ko-pause';
  document.getElementById('winstonSchemeOverlay').classList.add('active');
}

function doWinstonSchemeChoice(idx) {
  const sp = B.winstonSchemePending;
  if (!sp) return;
  B.winstonSchemePending = null;
  document.getElementById('winstonSchemeOverlay').classList.remove('active');

  const { winTeamName, loseTeamName, continuation } = sp;
  const loseTeam = B[loseTeamName];
  const winTeamColor = winTeamName === 'red' ? 'red-text' : 'blue-text';
  const loseTeamColor = loseTeamName === 'red' ? 'red-text' : 'blue-text';

  if (idx === -1) {
    // Skip — keep current opponent ghost
    narrate(`<b class="${winTeamColor}">Winston</b> — Scheme skipped.`);
    log(`Winston — Scheme declined.`);
    continuation();
    return;
  }

  // Force opponent swap: active ghost goes to sideline, chosen sideline ghost enters
  const oldGhost = active(loseTeam);
  const oldName = oldGhost.name;
  const newGhost = loseTeam.ghosts[idx];

  loseTeam.activeIdx = idx; // old active goes to sideline, chosen ghost becomes active
  renderBattle();

  narrate(`<b class="${winTeamColor}">Winston</b> — Scheme! <b class="${loseTeamColor}">${oldName}</b> forced to sideline — <b class="${loseTeamColor}">${newGhost.name}</b> enters!`);
  showAbilityCallout('SCHEME!', 'var(--common)', `${oldName} forced out — ${newGhost.name} enters!`, winTeamName);
  log(`<span class="log-ability">Winston</span> — Scheme! Forced ${oldName} to sideline, ${newGhost.name} enters.`);

  // Fire entry effects for the newly-active enemy ghost, then continue
  setTimeout(() => {
    const entryCount = triggerEntry(loseTeam, false);
    const entryDelay = entryCount > 0 ? entryCount * 1500 + 300 : 300;
    setTimeout(() => {
      continuation();
    }, entryDelay);
  }, 1500);
}

// ============================================================
// Gus (31) — Gale Force Picker: losing player chooses which sideline ghost to swap in
// ============================================================
function showGaleForcePickerModal(winTeamName, loseTeamName, sidelineGhosts, continuation) {
  const banner = document.getElementById('galeForcePickerBanner');
  if (banner) {
    banner.className = `pm-who-banner ${loseTeamName}`;
    banner.textContent = '💨 GALE FORCE!';
  }
  const loseTeam = B[loseTeamName];
  const opts = document.getElementById('galeForcePickerOptions');
  if (opts) {
    opts.innerHTML = sidelineGhosts.map(g => {
      const gd = ghostData(g.id);
      const realIdx = loseTeam.ghosts.indexOf(g);
      const hpRatio = g.hp / g.maxHp;
      const hpColor = hpRatio > 0.6 ? 'var(--hp-green)' : hpRatio > 0.3 ? 'var(--hp-yellow)' : 'var(--hp-red)';
      return `<div class="pressure-opt" onclick="doGaleForcePickerChoice(${realIdx})">
        ${gd.art ? `<img src="${gd.art}" style="width:50px;height:50px;border-radius:6px;object-fit:cover;border:1px solid var(--${gd.rarity});">` : ''}
        <div>
          <div style="font-weight:700;">${g.name}</div>
          <div style="font-size:12px;color:var(--text2);"><span style="color:${hpColor};font-weight:700;">&hearts; ${g.hp}/${g.maxHp}</span> &middot; <span style="color:var(--${gd.rarity});">${gd.ability}</span></div>
        </div>
      </div>`;
    }).join('');
  }
  B.galeForcePicker = { winTeamName, loseTeamName, continuation };
  B.phase = 'ko-pause';
  document.getElementById('galeForcePickerOverlay').classList.add('active');
}

function doGaleForcePickerChoice(idx) {
  const gfp = B.galeForcePicker;
  if (!gfp) return;
  B.galeForcePicker = null;
  document.getElementById('galeForcePickerOverlay').classList.remove('active');

  const { winTeamName, loseTeamName, continuation } = gfp;
  const loseTeam = B[loseTeamName];
  const winTeamColor = winTeamName === 'red' ? 'red-text' : 'blue-text';
  const loseTeamColor = loseTeamName === 'red' ? 'red-text' : 'blue-text';

  const oldName = active(loseTeam).name;
  const newGhost = loseTeam.ghosts[idx];

  loseTeam.activeIdx = idx;
  renderBattle();

  narrate(`<b class="${winTeamColor}">Gus</b> — Gale Force! <b class="${loseTeamColor}">${newGhost.name}</b> blown in to replace <b class="${loseTeamColor}">${oldName}</b>!`);
  log(`<span class="log-ability">Gus</span> — Gale Force! ${oldName} forced to bench — ${newGhost.name} enters!`);

  // Fire entry effects for the newly-active ghost, then continue
  setTimeout(() => {
    const entryCount = triggerEntry(loseTeam, false);
    const entryDelay = entryCount > 0 ? entryCount * 1500 + 300 : 300;
    setTimeout(continuation, entryDelay);
  }, 1500);
}

// ============================================================
// TWO-BUTTON ROLL SYSTEM — each side rolls independently
// ============================================================
function rollReady(team) {
  if (!B) return;
  // Duel Phase locks rolls until both players click Done
  if (B.phase === 'duel-1' || B.phase === 'duel-2') return;
  if (B.phase !== 'ready' && B.phase !== 'rolling') return;
  const btn = document.getElementById(team === 'red' ? 'rollRedBtn' : 'rollBlueBtn');
  if (btn.classList.contains('locked')) return;

  // Remove pulse and reset AFK timer on click
  document.querySelectorAll('#rollRedBtn, #rollBlueBtn').forEach(b => b.classList.remove('pulse'));
  resetAfkTimer();

  // First click: do pre-roll setup (abilities, dice counts)
  // calloutCount is HOISTED here (let, not const) so the modal-delay checks AFTER
  // this if-block can read it on BOTH first-click (we set it from doPreRollSetup)
  // and second-click paths (we compute the remaining wait from preRollCalloutEndTime).
  // Without this hoist, second-team clicks throw ReferenceError when any of the
  // post-`if` modal checks (Bogey, Gus, Hunt, Doug, Fang Undercover, etc.) reference
  // calloutCount — exact same bug class as the v305 teamLabel freeze.
  let calloutCount = 0;
  let preRollDelay = 0;
  if (B.phase === 'ready') {
    calloutCount = doPreRollSetup();
    if (B.phase !== 'ready') return; // pre-roll interrupted — KO-swap, game-over, or other phase change
    B.phase = 'rolling';
    // Re-render immediately so consumed status tags (Retribution, etc.) clear from fighter cards
    renderBattle();
    // If pre-roll callouts were queued (via setTimeout), wait for all of them to fully play
    // before dice roll — last callout starts at (N-1)*1500 and lasts ~1400ms, so N*1500 is exact
    if (calloutCount > 0) {
      preRollDelay = calloutCount * 1500;
      // Store the absolute end-time so the second team's click can also wait for callouts to finish
      B.preRollCalloutEndTime = Date.now() + calloutCount * 1500;
    }

    // Timber choice modal — pause rolling until opponent picks
    if (B.timberPending) {
      const tp = B.timberPending;
      const timberDelay = (tp.preRollCalloutCount || 0) * 1500;
      // Lock BOTH roll buttons — the modal must be resolved before anyone rolls,
      // regardless of which team clicked first. If we only locked the clicking button
      // and the opponent-calculated button, they could be the same element (when the
      // opponent clicks first), leaving Timber's team free to roll during the modal.
      const rBtn = document.getElementById('rollRedBtn');
      const bBtn = document.getElementById('rollBlueBtn');
      if (rBtn) { rBtn.classList.add('locked'); rBtn.disabled = true; }
      if (bBtn) { bBtn.classList.add('locked'); bBtn.disabled = true; }
      // Stash the NON-clicking button so doTimberChoice can unlock it after the choice
      // (the clicking button stays locked — doTeamRoll fires immediately after the choice)
      const otherBtnId = team === 'red' ? 'rollBlueBtn' : 'rollRedBtn';
      tp._oppBtn = document.getElementById(otherBtnId); // stash for cleanup in doTimberChoice
      setTimeout(() => {
        showTimberModal(tp, () => {
          // Resume rolling after choice
          setTimeout(() => { doTeamRoll(team, btn); }, 0);
        });
      }, timberDelay);
      return;
    }

    // Piper (107) — Slick Coat: negate Romy's Valley Guardian prediction modal
    // If Romy is about to predict but the enemy has Piper active, suppress the modal
    // by setting romyPrediction to -1 (sentinel; no die value equals -1 → +3 bonus never fires).
    {
      const romyCheckG = active(B[team]);
      if (romyCheckG && romyCheckG.id === 114 && !romyCheckG.ko &&
          B.romyPrediction && B.romyPrediction[team] == null) {
        const piperOppName = team === 'red' ? 'blue' : 'red';
        const piperG = active(B[piperOppName]);
        if (piperG && piperG.id === 107 && !piperG.ko) {
          B.romyPrediction[team] = -1; // blocked — no die matches -1
          log(`<span class="log-ability">Piper</span> — Slick Coat! <span class="log-ability">${romyCheckG.name}'s</span> Valley Guardian prediction is negated!`);
          // Fall through — Romy modal block below sees romyPrediction != null and skips
        }
      }
    }

    // Romy (114) — Valley Guardian: show prediction modal before rolling
    // Only intercepts when Romy's OWN team clicks their roll button.
    const romyActive = active(B[team]);
    if (romyActive && romyActive.id === 114 && !romyActive.ko &&
        B.romyPrediction && B.romyPrediction[team] == null) {
      // Lock only Romy's button — opponent can still roll independently
      btn.classList.add('locked');
      btn.disabled = true;
      B.romyPending = { team, btn, ghostName: romyActive.name };
      const romyDelay = (calloutCount > 0) ? calloutCount * 1500 : 0;
      setTimeout(() => {
        document.getElementById('romyOverlay').classList.add('active');
      }, romyDelay);
      return;
    }

    // Toby (97) — Pure Heart: before rolling, may declare the all-in gamble.
    // Modal only shows when it hasn't been decided yet this round (null = undecided).
    // Skipped if pureHeartScheduledKO is already pending (doPreRollSetup handles that).
    const tobyActive = active(B[team]);
    if (tobyActive && tobyActive.id === 97 && !tobyActive.ko &&
        B.pureHeartDeclared && B.pureHeartDeclared[team] === null &&
        !(B.pureHeartScheduledKO && B.pureHeartScheduledKO[team])) {
      // Lock only Toby's button — opponent can still roll independently
      btn.classList.add('locked');
      btn.disabled = true;
      B.tobyPending = { team, btn };
      const tobyDelay = (calloutCount > 0) ? calloutCount * 1500 : 0;
      setTimeout(() => {
        document.getElementById('tobyOverlay').classList.add('active');
      }, tobyDelay);
      return;
    }

    // Tyler (105) — Heating Up: opt-in 2 HP trade for +1 die
    // Only offered when Tyler has ≥ 3 HP (prevents self-KO via trade)
    // v429: skip if already decided in Duel Phase (tylerDecidedThisRound flag, Raditz pattern)
    const tylerActiveG = active(B[team]);
    if (tylerActiveG && tylerActiveG.id === 105 && !tylerActiveG.ko && tylerActiveG.hp >= 3 &&
        !(B.tylerDecidedThisRound && B.tylerDecidedThisRound[team])) {
      btn.classList.add('locked');
      btn.disabled = true;
      B.tylerPending = { team, btn };
      const tylerDelay = (calloutCount > 0) ? calloutCount * 1500 : 0;
      setTimeout(() => {
        const tF = active(B[team]);
        document.getElementById('tylerSub').textContent = `Spend 2 HP for +1 die this roll? (${tF.hp} HP → ${tF.hp - 2} HP)`;
        document.getElementById('tylerOverlay').classList.add('active');
      }, tylerDelay);
      return;
    }

    // Chow (414) — Secret Ingredient: spend 1 Healing Seed for +2 dice (interactive button)
    {
      const chowG = active(B[team]);
      if (chowG && chowG.id === 414 && !chowG.ko && B.chowDecided && !B.chowDecided[team] &&
          B[team].resources && B[team].resources.healingSeed >= 1) {
        btn.classList.add('locked');
        btn.disabled = true;
        B.chowPending = { team, btn };
        const chowDelay = (calloutCount > 0) ? calloutCount * 1500 : 0;
        setTimeout(() => {
          const cF = active(B[team]);
          document.getElementById('chowSub').innerHTML =
            `Discard 1 🌱 Healing Seed for +2 dice this roll?<br>` +
            `(Seeds: ${B[team].resources.healingSeed} | Current bonus dice: +${B.chowExtraDie[team] || 0})`;
          document.getElementById('chowOverlay').classList.add('active');
        }, chowDelay);
        return;
      }
    }

    // Castle Gardener (442) — Cultivate: discard 1 Healing Seed for 1 Sacred Fire (interactive button)
    {
      const cultG = active(B[team]);
      if (cultG && cultG.id === 442 && !cultG.ko && B.cultivateDecided && !B.cultivateDecided[team] &&
          B[team].resources && B[team].resources.healingSeed >= 1) {
        btn.classList.add('locked');
        btn.disabled = true;
        B.cultivatePending = { team, btn };
        const cultDelay = (calloutCount > 0) ? calloutCount * 1500 : 0;
        setTimeout(() => {
          document.getElementById('cultivateSub').innerHTML =
            `Discard 1 🌱 Healing Seed for 1 🔥 Sacred Fire?<br>` +
            `(Seeds: ${B[team].resources.healingSeed} | Sacred Fires: ${B[team].resources.fire || 0})`;
          document.getElementById('cultivateOverlay').classList.add('active');
        }, cultDelay);
        return;
      }
    }

    // Forest Spirit (446) — Hex: now handled by pre-roll button (useHex)

    // Nick & Knack (409) — Knick Knack: steal 1 resource from opponent (interactive picker)
    {
      const nnG = active(B[team]);
      const oppTeamNN = team === 'red' ? 'blue' : 'red';
      if (nnG && nnG.id === 409 && !nnG.ko && B.nickKnackDecided && !B.nickKnackDecided[team]) {
        const oppRes = B[oppTeamNN].resources;
        const resTypes = ['ice', 'fire', 'surge', 'luckyStone', 'moonstone', 'healingSeed'];
        const available = resTypes.filter(r => (oppRes[r] || 0) > 0);
        if (available.length > 0) {
          btn.classList.add('locked');
          btn.disabled = true;
          B.nickKnackPending = { team, btn, oppTeam: oppTeamNN };
          const nnDelay = (calloutCount > 0) ? calloutCount * 1500 : 0;
          setTimeout(() => {
            showNickKnackPicker(team, oppTeamNN);
          }, nnDelay);
          return;
        } else {
          B.nickKnackDecided[team] = true;
        }
      }
    }

    // Guardian Fairy (99) — Wish: now reactive (post-damage modal), no pre-roll standby needed

    // Eloise (85) — Change of Heart: spend 1 Ice Shard to swap HP with enemy before rolling
    // Offered once per round when Eloise is active and team has ≥1 Ice Shard.
    {
      const eloiseG = active(B[team]);
      const oppTeam = team === 'red' ? 'blue' : 'red';
      const oppF = active(B[oppTeam]);
      if (eloiseG && eloiseG.id === 85 && !eloiseG.ko &&
          B.eloiseUsedThisRound && !B.eloiseUsedThisRound[team] &&
          B[team].resources && B[team].resources.ice >= 1 && oppF && !oppF.ko) {
        btn.classList.add('locked');
        btn.disabled = true;
        B.eloisePending = { team, btn };
        const eloiseDelay = (calloutCount > 0) ? calloutCount * 1500 : 0;
        setTimeout(() => {
          document.getElementById('eloiseSub').innerHTML =
            `Spend 1 ❄️ Ice Shard to swap HP?<br>` +
            `<b>Your HP:</b> ${eloiseG.hp} → <b>${oppF.hp}</b> &nbsp;|&nbsp; ` +
            `<b>Enemy HP:</b> ${oppF.hp} → <b>${eloiseG.hp}</b>`;
          document.getElementById('eloiseOverlay').classList.add('active');
        }, eloiseDelay);
        return;
      }
    }

    // Mallow (89) — Dozy Cozy: spend 1 Sacred Fire for +3 HP to active ghost (sideline)
    // Offered once per round when Mallow is on the sideline and team has ≥1 Sacred Fire.
    if (hasSideline(B[team], 89) && B.mallowDecided && !B.mallowDecided[team] &&
        B[team].resources && B[team].resources.fire >= 2) {
      btn.classList.add('locked');
      btn.disabled = true;
      B.mallowPending = { team, btn };
      const mallowDelay = (calloutCount > 0) ? calloutCount * 1500 : 0;
      setTimeout(() => {
        const mF = active(B[team]);
        const mallowHpAfter = mF ? mF.hp + 3 : '?';
        const mallowOver = mF && (mF.hp + 3 > mF.maxHp) ? ' <i>· overclocks!</i>' : '';
        document.getElementById('mallowSub').innerHTML =
          `Spend 1 🔥 Sacred Fire to give <b>${mF ? mF.name : 'your ghost'}</b> +3 HP?<br>` +
          `(${mF ? mF.hp : '?'} HP → ${mallowHpAfter} HP${mallowOver} &nbsp;|&nbsp; 🔥 ${B[team].resources.fire} → ${B[team].resources.fire - 1})`;
        document.getElementById('mallowOverlay').classList.add('active');
      }, mallowDelay);
      return;
    }

    // Boo Brothers (17) — Teamwork: trade 1 die for 1 HP before rolling
    // Offered each round when Boo Brothers is active and has ≥ 2 dice.
    // NOTE: NO hp < maxHp gate — trading at full HP overclocks (v294 Hard Rule #9).
    // Do NOT re-add a maxHp cap here. Overclock is intentional by design.
    // v429: skip if already decided in Duel Phase (booTeamworkDecidedThisRound, Raditz pattern)
    {
      const booG = active(B[team]);
      if (booG && booG.id === 17 && !booG.ko && B.preRoll && B.preRoll[team] &&
          B.preRoll[team].count >= 2 &&
          !(B.booTeamworkDecidedThisRound && B.booTeamworkDecidedThisRound[team])) {
        btn.classList.add('locked');
        btn.disabled = true;
        B.booPending = { team, btn };
        const booDelay = (calloutCount > 0) ? calloutCount * 1500 : 0;
        setTimeout(() => {
          const bF = active(B[team]);
          document.getElementById('booSub').innerHTML =
            `Remove 1 die to gain +1 HP?<br>` +
            `<b>${B.preRoll[team].count}</b> dice → <b>${B.preRoll[team].count - 1}</b> dice` +
            `&nbsp;|&nbsp;<b>${bF.hp}</b> HP → <b>${bF.hp + 1}</b> HP${bF.hp + 1 > bF.maxHp ? ' <i>· overclocks!</i>' : ''}`;
          document.getElementById('booOverlay').classList.add('active');
        }, booDelay);
        return;
      }
    }
  }

  // Second-click path: pre-roll setup already ran, but pre-roll callouts may still
  // be in-flight. Compute remaining callout count from B.preRollCalloutEndTime so
  // the modal delays below still wait for them to clear.
  if (B.preRollCalloutEndTime && Date.now() < B.preRollCalloutEndTime) {
    calloutCount = Math.max(0, Math.ceil((B.preRollCalloutEndTime - Date.now()) / 1500));
  }

  // Gus (31) — Gale Force: opt-in to force enemy ghost swap on win instead of dealing damage.
  // Offered each round when Gus is active and the opponent has ≥1 alive sideline ghost.
  // B.galeForceDecided prevents re-offering after the player has already chosen this round.
  {
    const gusG = active(B[team]);
    const gusOppTeamName = team === 'red' ? 'blue' : 'red';
    const gusOppTeam = B[gusOppTeamName];
    const gusOppHasSideline = gusOppTeam.ghosts.some((g, i) => i !== gusOppTeam.activeIdx && !g.ko);
    if (gusG && gusG.id === 31 && !gusG.ko && gusOppHasSideline &&
        B.galeForceDecided && !B.galeForceDecided[team]) {
      btn.classList.add('locked');
      btn.disabled = true;
      B.gusPending = { team, btn };
      const gusDelay = (calloutCount > 0) ? calloutCount * 1500 : 0;
      setTimeout(() => {
        const gusOppActive = active(gusOppTeam);
        document.getElementById('gusSub').innerHTML =
          `If you <b>WIN</b> this roll, ${gusOppActive ? '<b>' + gusOppActive.name + '</b>' : 'the opponent'} must swap for a sideline ghost — <i>no damage dealt</i>.`;
        document.getElementById('gusOverlay').classList.add('active');
      }, gusDelay);
      return;
    }

    // Raditz (62) — Hunt: one-time forced-swap on first roll after entry
    // Fires when Raditz's team clicks Roll for the first time after Raditz enters play.
    if (B.raditzHuntReady && B.raditzHuntReady[team]) {
      // Lock BOTH buttons — swap must complete before either team rolls
      const rBtn2 = document.getElementById('rollRedBtn');
      const bBtn2 = document.getElementById('rollBlueBtn');
      if (rBtn2) { rBtn2.classList.add('locked'); rBtn2.disabled = true; }
      if (bBtn2) { bBtn2.classList.add('locked'); bBtn2.disabled = true; }
      const oppBtn2 = team === 'red' ? bBtn2 : rBtn2;
      B.raditzHuntPending = { team, btn, oppBtn: oppBtn2 };
      const huntDelay = (calloutCount > 0) ? calloutCount * 1500 : 0;
      setTimeout(() => {
        const huntEnemyName = team === 'red' ? 'blue' : 'red';
        const huntActiveEnemy = active(B[huntEnemyName]);
        document.getElementById('raditzHuntSub').textContent =
          `Force ${huntActiveEnemy ? huntActiveEnemy.name : 'the opponent'} to the sideline and bring in a different ghost?`;
        document.getElementById('raditzHuntOverlay').classList.add('active');
      }, huntDelay);
      return;
    }
  }

    // Doug (63) — Caution: once-per-game pre-roll swap out for +1 die to incoming ghost
    {
      const dougG = active(B[team]);
      if (dougG && dougG.id === 63 && !dougG.ko &&
          B.dougCautionUsed && !B.dougCautionUsed[team]) {
        const mySideline = B[team].ghosts.filter((g, i) => i !== B[team].activeIdx && !g.ko);
        if (mySideline.length > 0) {
          btn.classList.add('locked');
          btn.disabled = true;
          B.dougCautionPending = { team, btn };
          const dougDelay = (calloutCount > 0) ? calloutCount * 1500 : 0;
          setTimeout(() => {
            const teamCls = team === 'red' ? 'red' : 'blue';
            document.getElementById('dougCautionBanner').className = `pm-who-banner ${teamCls}`;
            document.getElementById('dougCautionSub').textContent =
              `Switch Doug to the sideline and bring in a sideline ghost? They gain +1 die this roll. (Once per game)`;
            const dougOptions = document.getElementById('dougCautionOptions');
            dougOptions.innerHTML = mySideline.map(g => {
              const realIdx = B[team].ghosts.indexOf(g);
              const gd = ghostData(g.id);
              const hpRatio = g.hp / g.maxHp;
              const hpColor = hpRatio > 0.6 ? 'var(--hp-green)' : hpRatio > 0.3 ? 'var(--hp-yellow)' : 'var(--hp-red)';
              return `<div class="pressure-opt" onclick="doDougCautionSwap(${realIdx})">
                ${gd.art ? `<img src="${gd.art}" style="width:50px;height:50px;border-radius:6px;object-fit:cover;border:1px solid var(--rare);">` : ''}
                <div><div style="font-weight:700;">${g.name}</div>
                <div style="font-size:12px;color:var(--text2);"><span style="color:${hpColor};font-weight:700;">♥ ${g.hp}/${g.maxHp}</span> · <span style="color:var(--moonstone);">${gd.ability}</span></div></div>
              </div>`;
            }).join('');
            document.getElementById('dougCautionOverlay').classList.add('active');
          }, dougDelay);
          return;
        }
      }
    }

  // Fang Undercover (7) — Skilled Coward: arm dodge before rolling
  // Offered each round when Fang Undercover is active with alive sideline ghosts.
  {
    const fuG = active(B[team]);
    const fuHasSideline = B[team].ghosts.some((g, i) => i !== B[team].activeIdx && !g.ko);
    if (fuG && fuG.id === 7 && !fuG.ko && fuHasSideline &&
        B.fangUndercoverArmed && !B.fangUndercoverArmed[team]) {
      btn.classList.add('locked');
      btn.disabled = true;
      B.fangUndercoverPending = { team, btn };
      const fuDelay = (calloutCount > 0) ? calloutCount * 1500 : 0;
      setTimeout(() => {
        const teamCls = team === 'red' ? 'red' : 'blue';
        document.getElementById('fangUndercoverArmSub').textContent =
          `Arm the dodge? If Fang takes damage this round, they swap to the sideline and negate all damage.`;
        document.getElementById('fangUndercoverArmOverlay').classList.add('active');
      }, fuDelay);
      return;
    }
  }

  // Lock this button
  btn.classList.add('locked');
  btn.disabled = true;

  // Second-click guard: if the first click started pre-roll callouts that are still playing,
  // wait for whatever time is left so the second team's roll animation doesn't stomp them.
  // (First-click path already has the full delay computed above; this only matters when
  //  preRollDelay is still 0, i.e. when this is the second team's click.)
  if (preRollDelay === 0 && B.preRollCalloutEndTime) {
    preRollDelay = Math.max(0, B.preRollCalloutEndTime - Date.now());
  }

  // Delay roll if pre-roll ability just showed a callout
  setTimeout(() => { doTeamRoll(team, btn); }, preRollDelay);
}

function doTeamRoll(team, btn) {
  // Duel Phase intercept: if a modal primer resolved during Duel Phase, the
  // choice handler calls doTeamRoll() as its "proceed" signal. We catch that
  // here, re-enable the Ready button (so the player can commit resources),
  // and return without rolling. The player clicks Ready when they're done.
  if (B && (B.phase === 'duel-1' || B.phase === 'duel-2') && B.duelActiveTeam === team) {
    const doneId = team === 'red' ? 'duelDoneRedBtn' : 'duelDoneBlueBtn';
    const doneBtn = document.getElementById(doneId);
    if (doneBtn) { doneBtn.disabled = false; doneBtn.classList.remove('locked'); }
    return;
  }
  // Roll this team's dice (weighted for cinematic clutch moments)
  const diceCount = B.preRoll[team].count;
  const override = B.preRoll[team].override;
  const dice = override ? [1,2,3] : weightedRoll(team, diceCount);
  B.preRoll[team].dice = dice;
  if (team === 'red') { B.redDice = dice; } else { B.blueDice = dice; }

  if (override) log(`<span class="log-ability">Bouril</span> — Slumber! Auto-rolled [1,2,3]!`);

  // Animate: show rolling then reveal
  const f = active(B[team]);
  const cls = team === 'red' ? 'red-text' : 'blue-text';
  showRolling(team, diceCount);
  if (diceCount > 0) playSfx('sfxDiceRoll');
  if (diceCount === 0) {
    narrate(`<b class="${cls}">${f.name}</b> doesn't roll — <b class="gold">Stone Form!</b>`);
  } else {
    narrate(`<b class="${cls}">${f.name}</b> rolls...`);
  }

  setTimeout(() => {
    revealDice(team, dice);
    const roll = classify(dice);
    const tl = typeLabel(roll.type);
    narrate(`<b class="${cls}">${f.name}</b>&nbsp;rolled [${dice.join(', ')}]${tl ? '&nbsp;<b class="gold">'+tl+'</b>' : ''}`);
    if (isTripleOrBetter(roll.type)) showTriplesEffect(team, roll.type);

    // Check if both have rolled — guard against double-resolution
    if (B.preRoll && B.preRoll.red.dice && B.preRoll.blue.dice && !B.preRoll.resolved) {
      B.preRoll.resolved = true;
      // Use 1800ms if EITHER team rolled triples/quads/penta — the banner for the
      // first roller fires at T+700ms and lasts 1700ms (1200ms show + 500ms fade),
      // so resolution must not start until T+700+1800=T+2500ms regardless of which
      // team triggered the resolution check.
      const otherTeam = team === 'red' ? 'blue' : 'red';
      const otherRoll = classify(B.preRoll[otherTeam].dice);
      const eitherTripled = isTripleOrBetter(roll.type) || isTripleOrBetter(otherRoll.type);
      setTimeout(() => {
        doPostRollAndResolve(B.preRoll.red.dice, B.preRoll.blue.dice);
      }, eitherTripled ? 1800 : 1400);
    }
  }, 700);
}

// ============================================================
// DUEL PHASE — sequenced pre-roll commits
// "Loser of previous exchange goes first. Round 1 uses lower max HP (underdog)."
// Dice rolls remain simultaneous; only pre-roll DECISIONS are ordered.
// ============================================================
const _RARITY_RANK = { 'common':0, 'uncommon':1, 'rare':2, 'ghost-rare':3, 'legendary':4 };

// -----------------------------------------------------------------------
// hasAnyDecision(team) — returns true if the team has anything to do
// during their Duel Phase turn: a modal primer that needs input, or a
// committable resource tile. Used by computeDuelPriority (skip-if-both-
// empty) and enterDuelPhase/_runDuelTeamTurn (auto-advance single team).
// v429: Tyler (105) and Boo Brothers (17) now included — Approach B decouples
//       their gates from B.preRoll (uses ghostData base dice ?? 3 instead).
// -----------------------------------------------------------------------
function hasAnyDecision(team) {
  if (!B) return false;
  const f = active(B[team]);
  if (!f || f.ko) return false;
  const oppTeamName = team === 'red' ? 'blue' : 'red';
  const oppF = active(B[oppTeamName]);
  const r = B[team].resources;
  const c = B.committed && B.committed[team];

  // — Modal primers —
  // Romy (114) — Valley Guardian
  if (f.id === 114 && B.romyPrediction && B.romyPrediction[team] == null) return true;
  // Toby (97) — Pure Heart
  if (f.id === 97 && B.pureHeartDeclared && B.pureHeartDeclared[team] === null &&
      !(B.pureHeartScheduledKO && B.pureHeartScheduledKO[team])) return true;
  // Guardian Fairy (99) — Wish: now reactive (post-damage), no pre-roll check needed
  // Eloise (85) — Change of Heart
  if (f.id === 85 && B.eloiseUsedThisRound && !B.eloiseUsedThisRound[team] &&
      r && r.ice >= 1 && oppF && !oppF.ko) return true;
  // Mallow (89) — Dozy Cozy (sideline)
  if (hasSideline(B[team], 89) && B.mallowDecided && !B.mallowDecided[team] &&
      r && r.fire >= 2) return true;
  // Gus (31) — Gale Force
  if (f.id === 31 && B.galeForceDecided && !B.galeForceDecided[team]) {
    const gOpp = B[oppTeamName];
    if (gOpp && gOpp.ghosts.some((g, i) => i !== gOpp.activeIdx && !g.ko)) return true;
  }
  // Raditz (62) — Hunt
  if (B.raditzHuntReady && B.raditzHuntReady[team]) return true;
  // Doug (63) — Caution
  if (f.id === 63 && B.dougCautionUsed && !B.dougCautionUsed[team] &&
      B[team].ghosts.some((g, i) => i !== B[team].activeIdx && !g.ko)) return true;
  // Fang Undercover (7) — Skilled Coward
  if (f.id === 7 && B.fangUndercoverArmed && !B.fangUndercoverArmed[team] &&
      B[team].ghosts.some((g, i) => i !== B[team].activeIdx && !g.ko)) return true;
  // Tyler (105) — Heating Up: spend 2 HP for +1 die
  if (f.id === 105 && !f.ko && f.hp >= 3 &&
      !(B.tylerDecidedThisRound && B.tylerDecidedThisRound[team])) return true;
  // Boo Brothers (17) — Teamwork: trade 1 die for +1 HP (gate uses base dice, no preRoll dep)
  if (f.id === 17 && !f.ko && (ghostData(17)?.dice ?? 3) >= 2 &&
      !(B.booTeamworkDecidedThisRound && B.booTeamworkDecidedThisRound[team])) return true;

  // — Committable resource tiles (interactive during Duel Phase via isPreRollActive) —
  if (r && c) {
    if ((r.ice + c.ice) > 0) return true;
    if ((r.fire + c.fire) > 0) return true;
    if ((r.surge + c.surge) > 0) return true;
  }
  // Healing Seed (usable when HP below max)
  if (r && r.healingSeed > 0 && f.hp < f.maxHp) return true;
  // Happy Crystal (208) — sacrifice for Moonstone
  if (f.id === 208 && !f.ko) return true;
  // Aunt Susan (309) — commit seeds for damage or heal
  if (f.id === 309 && !f.ko && r &&
      (r.healingSeed > 0 || (c && (c.auntSusan > 0 || c.auntSusanHeal > 0)))) return true;

  return false;
}

// -----------------------------------------------------------------------
// _installDuelPhasePreRollWrapper — single-use doPreRollSetup wrapper that
// applies deferred die adjustments from Duel Phase Tyler/Boo Brothers choices.
// Tyler's +1 die and Boo Brothers' -1 die are captured via getter/setter
// interceptors on the pre-initialized B.preRoll[team] objects, then stored
// in B.tylerHeatUpDieBonus / B.booTeamworkDieDebt. This wrapper applies them
// AFTER doPreRollSetup initializes the real B.preRoll. Idempotent — safe to
// call from both Tyler and Boo Brothers sections in the same round.
// -----------------------------------------------------------------------
function _installDuelPhasePreRollWrapper() {
  if (window._duelDiePatchInstalled) return; // already installed this round
  window._duelDiePatchInstalled = true;
  const _origDPS = doPreRollSetup;
  window.doPreRollSetup = function() {
    window.doPreRollSetup = _origDPS;        // restore before calling (single-use)
    window._duelDiePatchInstalled = false;
    const result = _origDPS.apply(this, arguments);
    // Apply deferred die adjustments AFTER doPreRollSetup has initialized B.preRoll
    if (B && B.preRoll) {
      ['red', 'blue'].forEach(t => {
        if (!B.preRoll[t]) return;
        if (B.tylerHeatUpDieBonus && B.tylerHeatUpDieBonus[t] > 0) {
          B.preRoll[t].count = Math.min(6, B.preRoll[t].count + B.tylerHeatUpDieBonus[t]);
          B.tylerHeatUpDieBonus[t] = 0;
        }
        if (B.booTeamworkDieDebt && B.booTeamworkDieDebt[t] > 0) {
          B.preRoll[t].count = Math.max(1, B.preRoll[t].count - B.booTeamworkDieDebt[t]);
          B.booTeamworkDieDebt[t] = 0;
        }
      });
    }
    return result;
  };
}

// -----------------------------------------------------------------------
// openDuelPhasePrimers(team) — opens the first applicable modal primer
// for the team's active fighter during their Duel Phase turn. Disables
// the "✓ Ready" button until the player resolves the primer.
// Returns true if a primer was opened; false if nothing to open.
// The choice handlers call doTeamRoll() on resolution — the doTeamRoll
// Duel Phase intercept (below) catches that call and re-enables Ready
// so the player can commit resources before clicking Ready manually.
// -----------------------------------------------------------------------
function openDuelPhasePrimers(team) {
  if (!B) return false;
  const f = active(B[team]);
  if (!f || f.ko) return false;
  const oppTeamName = team === 'red' ? 'blue' : 'red';
  const doneId = team === 'red' ? 'duelDoneRedBtn' : 'duelDoneBlueBtn';
  const doneBtn = document.getElementById(doneId);
  const disableDone = () => { if (doneBtn) { doneBtn.disabled = true; doneBtn.classList.add('locked'); } };

  // — ROMY (114) — Valley Guardian: predict a die value before rolling
  if (f.id === 114 && B.romyPrediction && B.romyPrediction[team] == null) {
    // Check Piper (107) — Slick Coat suppresses the prediction
    const piperOppG = active(B[oppTeamName]);
    if (piperOppG && piperOppG.id === 107 && !piperOppG.ko) {
      B.romyPrediction[team] = -1; // sentinel: -1 never matches any die
      narrate(`<b class="${oppTeamName}-text">Piper</b> — Slick Coat! Romy's Valley Guardian is negated!`);
      log(`<span class="log-ability">Piper</span> — Slick Coat! Romy's Valley Guardian prediction negated in Duel Phase.`);
      // fall through to next primer check
    } else {
      disableDone();
      B.romyPending = { team, btn: doneBtn, ghostName: f.name };
      document.getElementById('romyOverlay').classList.add('active');
      return true;
    }
  }

  // — TOBY (97) — Pure Heart: declare all-in gamble
  if (f.id === 97 && B.pureHeartDeclared && B.pureHeartDeclared[team] === null &&
      !(B.pureHeartScheduledKO && B.pureHeartScheduledKO[team])) {
    disableDone();
    B.tobyPending = { team, btn: doneBtn };
    document.getElementById('tobyOverlay').classList.add('active');
    return true;
  }

  // — CHOW (414) — Secret Ingredient: spend 1 Healing Seed for +2 dice (Duel Phase)
  if (f.id === 414 && !f.ko && B.chowDecided && !B.chowDecided[team] &&
      B[team].resources && B[team].resources.healingSeed >= 1) {
    disableDone();
    B.chowPending = { team, btn: doneBtn };
    document.getElementById('chowSub').innerHTML =
      `Discard 1 🌱 Healing Seed for +2 dice this roll?<br>` +
      `(Seeds: ${B[team].resources.healingSeed} | Current bonus dice: +${B.chowExtraDie[team] || 0})`;
    document.getElementById('chowOverlay').classList.add('active');
    return true;
  }

  // — CASTLE GARDENER (442) — Cultivate: discard 1 Healing Seed for 1 Sacred Fire (Duel Phase)
  if (f.id === 442 && !f.ko && B.cultivateDecided && !B.cultivateDecided[team] &&
      B[team].resources && B[team].resources.healingSeed >= 1) {
    disableDone();
    B.cultivatePending = { team, btn: doneBtn };
    document.getElementById('cultivateSub').innerHTML =
      `Discard 1 🌱 Healing Seed for 1 🔥 Sacred Fire?<br>` +
      `(Seeds: ${B[team].resources.healingSeed} | Sacred Fires: ${B[team].resources.fire || 0})`;
    document.getElementById('cultivateOverlay').classList.add('active');
    return true;
  }

  // — FOREST SPIRIT (446) — Hex: now handled by pre-roll button (useHex)

  // — NICK & KNACK (409) — Knick Knack: steal 1 resource from opponent (Duel Phase)
  if (f.id === 409 && !f.ko && B.nickKnackDecided && !B.nickKnackDecided[team]) {
    const nnOppRes = B[oppTeamName].resources;
    const nnResTypes = ['ice', 'fire', 'surge', 'luckyStone', 'moonstone', 'healingSeed'];
    const nnAvailable = nnResTypes.filter(r => (nnOppRes[r] || 0) > 0);
    if (nnAvailable.length > 0) {
      disableDone();
      B.nickKnackPending = { team, btn: doneBtn, oppTeam: oppTeamName };
      showNickKnackPicker(team, oppTeamName);
      return true;
    } else {
      B.nickKnackDecided[team] = true;
    }
  }

  // Guardian Fairy (99) — Wish: now reactive (post-damage modal), no pre-roll standby

  // — ELOISE (85) — Change of Heart: spend 1 Ice Shard to swap HP
  {
    const oppF = active(B[oppTeamName]);
    if (f.id === 85 && B.eloiseUsedThisRound && !B.eloiseUsedThisRound[team] &&
        B[team].resources && B[team].resources.ice >= 1 && oppF && !oppF.ko) {
      disableDone();
      B.eloisePending = { team, btn: doneBtn };
      document.getElementById('eloiseSub').innerHTML =
        `Spend 1 ❄️ Ice Shard to swap HP?<br>` +
        `<b>Your HP:</b> ${f.hp} → <b>${oppF.hp}</b> &nbsp;|&nbsp; ` +
        `<b>Enemy HP:</b> ${oppF.hp} → <b>${f.hp}</b>`;
      document.getElementById('eloiseOverlay').classList.add('active');
      return true;
    }
  }

  // — MALLOW (89) — Dozy Cozy: spend 1 Sacred Fire for +3 HP (sideline)
  if (hasSideline(B[team], 89) && B.mallowDecided && !B.mallowDecided[team] &&
      B[team].resources && B[team].resources.fire >= 2) {
    disableDone();
    B.mallowPending = { team, btn: doneBtn };
    const mallowHpAfter = f.hp + 3;
    const mallowOver = (f.hp + 3 > f.maxHp) ? ' <i>· overclocks!</i>' : '';
    document.getElementById('mallowSub').innerHTML =
      `Spend 1 🔥 Sacred Fire to give <b>${f.name}</b> +3 HP?<br>` +
      `(${f.hp} HP → ${mallowHpAfter} HP${mallowOver} &nbsp;|&nbsp; 🔥 ${B[team].resources.fire} → ${B[team].resources.fire - 1})`;
    document.getElementById('mallowOverlay').classList.add('active');
    return true;
  }

  // — GUS (31) — Gale Force: opt-in force-swap on win
  if (f.id === 31 && B.galeForceDecided && !B.galeForceDecided[team]) {
    const gOpp = B[oppTeamName];
    const gOppHasSideline = gOpp && gOpp.ghosts.some((g, i) => i !== gOpp.activeIdx && !g.ko);
    if (gOppHasSideline) {
      disableDone();
      B.gusPending = { team, btn: doneBtn };
      const gOppActive = active(gOpp);
      document.getElementById('gusSub').innerHTML =
        `If you <b>WIN</b> this roll, ${gOppActive ? '<b>' + gOppActive.name + '</b>' : 'the opponent'} must swap for a sideline ghost — <i>no damage dealt</i>.`;
      document.getElementById('gusOverlay').classList.add('active');
      return true;
    }
  }

  // — RADITZ (62) — Hunt: force opponent's active ghost to the sideline (one-time on entry)
  if (B.raditzHuntReady && B.raditzHuntReady[team]) {
    B.raditzHuntReady[team] = false; // clear NOW so rollReady never double-fires this
    const enemy = B[oppTeamName];
    const huntTargetActive = active(enemy);
    const aliveSideline = enemy.ghosts.filter((g, i) => i !== enemy.activeIdx && !g.ko);

    // Auto-skip: opponent has no alive sideline ghosts
    if (aliveSideline.length === 0) {
      narrate(`<b class="${team}-text">Raditz</b> — Hunt primed, but the opponent has no sideline ghosts to swap in.`);
      log(`Raditz — Hunt skipped in Duel Phase: opponent has no alive sideline.`);
      return false; // auto-skipped, no primer opened
    }

    disableDone();
    B.raditzHuntPending = { team, btn: doneBtn, oppBtn: null };
    document.getElementById('raditzHuntSub').textContent =
      `Force ${huntTargetActive ? huntTargetActive.name : 'the opponent'} to the sideline and bring in a different ghost?`;
    document.getElementById('raditzHuntOverlay').classList.add('active');
    return true;
  }

  // — DOUG (63) — Caution: once-per-game pre-roll self-swap for +1 die to incoming ghost
  if (f.id === 63 && B.dougCautionUsed && !B.dougCautionUsed[team]) {
    const mySideline = B[team].ghosts.filter((g, i) => i !== B[team].activeIdx && !g.ko);
    if (mySideline.length > 0) {
      disableDone();
      B.dougCautionPending = { team, btn: doneBtn };
      const teamCls = team === 'red' ? 'red' : 'blue';
      document.getElementById('dougCautionBanner').className = `pm-who-banner ${teamCls}`;
      document.getElementById('dougCautionSub').textContent =
        `Switch Doug to the sideline and bring in a sideline ghost? They gain +1 die this roll. (Once per game)`;
      const dougOptions = document.getElementById('dougCautionOptions');
      dougOptions.innerHTML = mySideline.map(g => {
        const realIdx = B[team].ghosts.indexOf(g);
        const gd = ghostData(g.id);
        const hpRatio = g.hp / g.maxHp;
        const hpColor = hpRatio > 0.6 ? 'var(--hp-green)' : hpRatio > 0.3 ? 'var(--hp-yellow)' : 'var(--hp-red)';
        return `<div class="pressure-opt" onclick="doDougCautionSwap(${realIdx})">
          ${gd.art ? `<img src="${gd.art}" style="width:50px;height:50px;border-radius:6px;object-fit:cover;border:1px solid var(--${gd.rarity});">` : ''}
          <div><div style="font-weight:700;">${g.name}</div>
          <div style="font-size:12px;color:var(--text2);"><span style="color:${hpColor};font-weight:700;">♥ ${g.hp}/${g.maxHp}</span> · <span style="color:var(--moonstone);">${gd.ability}</span></div></div>
        </div>`;
      }).join('');
      document.getElementById('dougCautionOverlay').classList.add('active');
      return true;
    }
  }

  // — FANG UNDERCOVER (7) — Skilled Coward: arm dodge before rolling
  if (f.id === 7 && B.fangUndercoverArmed && !B.fangUndercoverArmed[team] &&
      B[team].ghosts.some((g, i) => i !== B[team].activeIdx && !g.ko)) {
    disableDone();
    B.fangUndercoverPending = { team, btn: doneBtn };
    document.getElementById('fangUndercoverArmSub').textContent =
      `Arm the dodge? If Fang takes damage this round, they swap to the sideline and negate all damage.`;
    document.getElementById('fangUndercoverArmOverlay').classList.add('active');
    return true;
  }

  // — TYLER (105) — Heating Up: spend 2 HP for +1 die (Approach B: gate uses hp, not preRoll)
  // Raditz pattern: set tylerDecidedThisRound BEFORE opening so rollReady skips after Duel Phase.
  // Pre-initialize B.preRoll[team] with a getter/setter interceptor so doTylerChoice's count
  // write is captured into B.tylerHeatUpDieBonus; the _installDuelPhasePreRollWrapper applies
  // it after doPreRollSetup initializes the real B.preRoll object.
  if (f.id === 105 && !f.ko && f.hp >= 3 &&
      !(B.tylerDecidedThisRound && B.tylerDecidedThisRound[team])) {
    if (B.tylerDecidedThisRound) B.tylerDecidedThisRound[team] = true; // clear — Raditz pattern
    if (!B.preRoll) B.preRoll = { red: null, blue: null };
    if (!B.preRoll[team]) {
      const _tylerTeam = team; // capture for setter closure
      const _baseDiceT = ghostData(f.id)?.dice ?? 3;
      B.preRoll[team] = {
        _count: _baseDiceT, override: false, dice: null,
        get count() { return this._count; },
        set count(v) {
          const delta = v - this._count;
          if (delta > 0 && B && B.tylerHeatUpDieBonus)
            B.tylerHeatUpDieBonus[_tylerTeam] = (B.tylerHeatUpDieBonus[_tylerTeam] || 0) + delta;
          this._count = v;
        }
      };
      _installDuelPhasePreRollWrapper();
    }
    disableDone();
    B.tylerPending = { team, btn: doneBtn };
    document.getElementById('tylerSub').textContent =
      `Spend 2 HP for +1 die this roll? (${f.hp} HP → ${f.hp - 2} HP)`;
    document.getElementById('tylerOverlay').classList.add('active');
    return true;
  }

  // — BOO BROTHERS (17) — Teamwork: trade 1 die for +1 HP (Approach B: gate uses base dice)
  // Auto-skip if the ghost's base dice count < 2 — can't trade a die they don't have.
  // Raditz pattern: set booTeamworkDecidedThisRound BEFORE opening so rollReady skips.
  // Pre-initialize B.preRoll[team] interceptor; doBooChoice's count write is captured
  // into B.booTeamworkDieDebt; the _installDuelPhasePreRollWrapper applies it post-setup.
  {
    const _baseDiceBoo = ghostData(17)?.dice ?? 3;
    if (f.id === 17 && !f.ko &&
        !(B.booTeamworkDecidedThisRound && B.booTeamworkDecidedThisRound[team])) {
      if (B.booTeamworkDecidedThisRound) B.booTeamworkDecidedThisRound[team] = true; // Raditz pattern
      if (_baseDiceBoo < 2) {
        // Auto-skip: no dice to trade
        narrate(`<b class="${team}-text">Boo Brothers</b> — Teamwork ready, but base dice (${_baseDiceBoo}) too low to trade.`);
        log(`Boo Brothers — Teamwork auto-skipped in Duel Phase: base dice ${_baseDiceBoo} < 2.`);
        return false;
      }
      if (!B.preRoll) B.preRoll = { red: null, blue: null };
      if (!B.preRoll[team]) {
        const _booTeam = team; // capture for setter closure
        B.preRoll[team] = {
          _count: _baseDiceBoo, override: false, dice: null,
          get count() { return this._count; },
          set count(v) {
            const delta = this._count - v;
            if (delta > 0 && B && B.booTeamworkDieDebt)
              B.booTeamworkDieDebt[_booTeam] = (B.booTeamworkDieDebt[_booTeam] || 0) + delta;
            this._count = v;
          }
        };
        _installDuelPhasePreRollWrapper();
      }
      disableDone();
      B.booPending = { team, btn: doneBtn };
      document.getElementById('booSub').innerHTML =
        `Remove 1 die to gain +1 HP?<br>` +
        `<b>${_baseDiceBoo}</b> dice → <b>${_baseDiceBoo - 1}</b> dice` +
        `&nbsp;|&nbsp;<b>${f.hp}</b> HP → <b>${f.hp + 1}</b> HP${f.hp + 1 > f.maxHp ? ' <i>· overclocks!</i>' : ''}`;
      document.getElementById('booOverlay').classList.add('active');
      return true;
    }
  }

  return false; // no primer matched
}

// -----------------------------------------------------------------------
// _runDuelTeamTurn(team) — called at the start of each team's Duel Phase
// slot (from enterDuelPhase and from the duel-1→duel-2 transition).
// 1. Opens any applicable primer modal (disables Ready until resolved).
// 2. If no primer AND no decisions at all → auto-advance after a short beat.
// -----------------------------------------------------------------------
function _runDuelTeamTurn(team) {
  if (!B) return;
  if (openDuelPhasePrimers(team)) return; // primer opened — Ready disabled, wait for player
  if (!hasAnyDecision(team)) {
    // Nothing to do — auto-fire Ready after a narrator beat
    const f = active(B[team]);
    const name = f ? f.name : team;
    setTimeout(() => {
      narrate(`<b class="${team}-text">${name}</b> has nothing to commit — rolling!`);
      setTimeout(() => { duelPhaseReady(team); }, 350);
    }, 250);
  }
  // else: team has resources to commit — leave Ready enabled, wait for manual click
}

function computeDuelPriority() {
  if (!B || B.duelPhaseMode === false) return null;
  // Skip Duel Phase entirely when neither team has any decisions to make —
  // saves ~3s per round and avoids pointless Ready clicks (Issue #2).
  if (!hasAnyDecision('red') && !hasAnyDecision('blue')) return null;
  // Unified rule: "previous round loser goes first."
  // Round 1 has no previous loser, so it uses lower max HP (the underdog strikes).
  // Ties of any kind (R1 HP tie, mirror match, R2+ tie round) fall through to
  // B.duelLastLoser — which is NULL in round 1 (→ simultaneous) but STICKY in R2+
  // (the previous NON-TIE loser carries forward through tie rounds).
  const rF = active(B.red);
  const bF = active(B.blue);
  if (!rF || !bF || rF.ko || bF.ko) return B.duelLastLoser || null;
  const isRoundOne = (B.round === 1);
  if (isRoundOne && rF.id !== bF.id && rF.maxHp !== bF.maxHp) {
    return rF.maxHp < bF.maxHp ? 'red' : 'blue';
  }
  return B.duelLastLoser || null;
}

function isPreRollActive(team) {
  if (!B) return false;
  if (B.phase === 'ready') return true;
  if (B.phase === 'duel-1' || B.phase === 'duel-2') {
    return B.duelActiveTeam === team;
  }
  return false;
}

function enterDuelPhase(priority) {
  if (!B) return;
  B.phase = 'duel-1';
  B.duelPriority = priority;
  B.duelActiveTeam = priority;
  // Lock both roll buttons — rolls don't unlock until both players click Done
  const r = document.getElementById('rollRedBtn');
  const b = document.getElementById('rollBlueBtn');
  if (r) { r.classList.add('locked'); r.classList.remove('pulse'); r.disabled = true; }
  if (b) { b.classList.add('locked'); b.classList.remove('pulse'); b.disabled = true; }
  const activeF = active(B[priority]);
  const activeName = activeF ? activeF.name : priority;
  const oppName = priority === 'red' ? 'blue' : 'red';
  // Narrator framing: R1 is "underdog", R2+ is "wounded"
  const isR1 = (B.round === 1);
  const msg = isR1
    ? `<b class="${priority}-text">${activeName}</b> stands as the underdog — first move!`
    : `<b class="${priority}-text">${activeName}</b> licks their wounds — first move this round!`;
  narrate(msg);
  log(`<span class="log-ability">DUEL PHASE</span> — ${activeName} (${priority}) moves first.`);
  renderBattle();
  renderDuelUI();
  _runDuelTeamTurn(priority);
}

function duelPhaseReady(team) {
  if (!B) return;
  if (B.phase !== 'duel-1' && B.phase !== 'duel-2') return;
  if (team !== B.duelActiveTeam) return;
  if (B.phase === 'duel-1') {
    // Advance to phase 2 — opponent's turn
    const nextTeam = team === 'red' ? 'blue' : 'red';
    B.phase = 'duel-2';
    B.duelActiveTeam = nextTeam;
    const nextActive = active(B[nextTeam]);
    const nextName = nextActive ? nextActive.name : nextTeam;
    narrate(`<b class="${nextTeam}-text">${nextName}</b> — your response!`);
    log(`<span class="log-ability">DUEL PHASE</span> — ${nextName} (${nextTeam}) responds.`);
    renderBattle();
    renderDuelUI();
    _runDuelTeamTurn(nextTeam);
  } else {
    // End Duel Phase — unlock rolls for simultaneous resolution
    endDuelPhase();
  }
}

function endDuelPhase() {
  if (!B) return;
  B.phase = 'ready';
  B.duelActiveTeam = null;
  narrate(`<b class="gold">Both ready!</b> Roll the dice!`);
  resetRollButtons();
  renderBattle();
  renderDuelUI();
}

function renderDuelUI() {
  // Show/hide Done buttons and apply .duel-locked class to the inactive team column
  const inDuel = (B && (B.phase === 'duel-1' || B.phase === 'duel-2'));
  const rDone = document.getElementById('duelDoneRedBtn');
  const bDone = document.getElementById('duelDoneBlueBtn');
  const rCol = document.getElementById('red-team-column');
  const bCol = document.getElementById('blue-team-column');
  if (rDone) rDone.style.display = (inDuel && B.duelActiveTeam === 'red') ? 'block' : 'none';
  if (bDone) bDone.style.display = (inDuel && B.duelActiveTeam === 'blue') ? 'block' : 'none';
  if (rCol) rCol.classList.toggle('duel-locked', inDuel && B.duelActiveTeam !== 'red');
  if (bCol) bCol.classList.toggle('duel-locked', inDuel && B.duelActiveTeam !== 'blue');
}

// startNextRound — called from every "round ends" site instead of the direct
// B.phase = 'ready'; resetRollButtons(); pattern. Checks for Duel Phase priority
// and either enters the Duel Phase or falls back to simultaneous ready.
function startNextRound() {
  if (!B) return;
  const priority = computeDuelPriority();
  if (priority) {
    enterDuelPhase(priority);
  } else {
    B.phase = 'ready';
    B.duelActiveTeam = null;
    B.duelPriority = null;
    resetRollButtons();
    renderBattle();
    renderDuelUI();
  }
}

function resetRollButtons() {
  const r = document.getElementById('rollRedBtn');
  const b = document.getElementById('rollBlueBtn');
  if (r) { r.classList.remove('locked', 'pulse'); r.disabled = false; r.textContent = 'Red Roll'; }
  if (b) { b.classList.remove('locked', 'pulse'); b.disabled = false; b.textContent = 'Blue Roll'; }
  // Clear dice display between rounds — no leftover numbers from last roll
  ['red', 'blue'].forEach(t => {
    const el = document.getElementById(t + '-dice');
    if (el) el.innerHTML = '';
  });
  // Start AFK pulse timer — if player doesn't roll within 5s, buttons start pulsing
  resetAfkTimer();
}

function disableRollButtons() {
  const r = document.getElementById('rollRedBtn');
  const b = document.getElementById('rollBlueBtn');
  if (r) r.disabled = true;
  if (b) b.disabled = true;
}

// Pre-roll setup — called once when the first player clicks Roll
function doPreRollSetup() {
  if (!B || B.phase !== 'ready') return;
  const rF = active(B.red), bF = active(B.blue);
  if (rF.ko || bF.ko) return;
  // MVP snapshot: capture team resources + ghost HPs so we can credit deltas at round end
  snapshotRound();

  // Collect pre-roll callouts — drained sequentially after setup so none stomp each other
  const preRollCallouts = [];

  // Snapshot Lucky Stones + Moonstones available BEFORE this round
  // (can't use resources gained during the same roll)
  B.lsAvailable = {
    red: B.red.resources.luckyStone,
    blue: B.blue.resources.luckyStone
  };
  B.msAvailable = {
    red: B.red.resources.moonstone,
    blue: B.blue.resources.moonstone
  };

  // Reset per-round flags
  [B.red, B.blue].forEach(team => {
    active(team).usedMagicTouch = false;
  });
  // v640 — Piper (107) Slick Coat reactive: flag true when an auto-fire before-roll ability
  // is negated this round. Only then does Piper apply the -1 enemy die penalty.
  // Prevents the old behavior where Slick Coat fired unconditionally every round.
  B.piperBlockedThisRound = { red: false, blue: false };

  // ========================================
  // PHASE 1: PRE-ROLL TRIGGERS
  // ========================================

  // v687: Pre-roll chip damage abilities fire ONCE per turn. If they KO a ghost and
  // a replacement swaps in, doPreRollSetup re-runs — but the replacement is NOT hit
  // again. The flag is set before the first ability fires and checked on re-entry.
  const preRollAlreadyFired = B.preRollAbilitiesFiredThisTurn.red && B.preRollAbilitiesFiredThisTurn.blue;
  if (!preRollAlreadyFired) {
  B.preRollAbilitiesFiredThisTurn.red = true;
  B.preRollAbilitiesFiredThisTurn.blue = true;

  // Ember Force (304) — deal 1 damage to enemy active (negated by Dylan)
  // Phase 4: Masked Hero (55) Underdog fires BEFORE pre-roll damage — if attacker KO'd, skip damage
  [B.red, B.blue].forEach(team => {
    const f = active(team);
    const enemy = opp(team);
    const tNamePre = team === B.red ? 'red' : 'blue';
    if (f.id === 304 && !f.ko && !dylanNegates(enemy)) {
      const ef = active(enemy);
      if (!ef.ko) {
        const enemyName = enemy === B.red ? 'red' : 'blue';
        // Masked Hero (55) — Underdog: counter 3 damage BEFORE the pre-roll effect fires
        if (ef.id === 55 && !ef.ko) {
          const undPre1 = f.hp;
          f.hp = Math.max(0, f.hp - 3);
          if (f.hp <= 0) { f.ko = true; f.killedBy = 55; }
          const undMsg1 = f.ko
            ? `${ef.name} counters! 3 damage to ${f.name}! (${undPre1} HP → KO!)`
            : `${ef.name} counters! 3 damage to ${f.name}! (${undPre1} → ${f.hp} HP)`;
          preRollCallouts.push(['UNDERDOG!', 'var(--uncommon)', undMsg1, enemyName]);
          log(`<span class="log-ability">${ef.name}</span> — Underdog! 3 counter-damage to ${f.name}!`);
          playDamageSfx(3);
          hitDamage(tNamePre);
          if (f.ko) return; // Attacker KO'd by Underdog — skip pre-roll damage entirely
        }
        ef.hp = Math.max(0, ef.hp - 1);
        if (ef.hp <= 0) { ef.ko = true; ef.killedBy = (f.originalId || f.id); }
        preRollCallouts.push(['SWARM!', 'var(--uncommon)', `${f.name} — 1 damage to ${ef.name}!`, tNamePre]);
        log(`<span class="log-ability">${f.name}</span> — Swarm! <span class="log-dmg">1 damage to ${ef.name}!</span> ${ef.ko?'<span class="log-ko">KO!</span>':ef.hp+' HP left'}`);
        playDamageSfx(1);
        hitDamage(enemyName);
        // Simon (24) — Brew Time: gain 1 Sacred Fire when taking ANY damage
        if (ef.id === 24 && !ef.ko) {
          B[enemyName].resources.fire++;
          preRollCallouts.push(['BREW TIME!', 'var(--uncommon)', `Simon — Took pre-roll damage → +1 Sacred Fire!`, enemyName]);
          log(`<span class="log-ability">Simon</span> — Brew Time! Took pre-roll damage → <span class="log-ms">+1 Sacred Fire!</span>`);
        }
        // Collect Knight reactions via temp queue mode so they splice AFTER SWARM! in preRollCallouts
        const _swarmSavedKQ = abilityQueue;
        abilityQueue = [];
        abilityQueueMode = true;
        checkKnightEffects(tNamePre, f.name);
        abilityQueueMode = false;
        abilityQueue.forEach(item => preRollCallouts.push([item.name, item.color, item.desc, item.team]));
        abilityQueue = _swarmSavedKQ;
        // Princess Shade (436) — Bounty: +1 additional damage on pre-roll chip (blocked by Cornelius)
        if (!ef.ko && hasSideline(B[tNamePre], 436) && !hasSideline(B[enemyName], 45)) {
          const psPreHp = ef.hp;
          ef.hp = Math.max(0, ef.hp - 1);
          if (ef.hp <= 0) { ef.ko = true; ef.killedBy = 436; }
          preRollCallouts.push(['BOUNTY!', 'var(--rare)', `Princess Shade — +1 additional damage to ${ef.name}!`, tNamePre]);
          log(`<span class="log-ability">Princess Shade</span> (sideline) — Bounty! <span class="log-dmg">+1 additional damage to ${ef.name}!</span> ${ef.ko?'<span class="log-ko">KO!</span>':ef.hp+' HP left'}`);
          playDamageSfx(1);
          hitDamage(enemyName);
          popSidelineCard(B[tNamePre], 436);
          if (ef.id === 24 && !ef.ko) {
            B[enemyName].resources.fire++;
            preRollCallouts.push(['BREW TIME!', 'var(--uncommon)', `Simon — Took pre-roll damage → +1 Sacred Fire!`, enemyName]);
            log(`<span class="log-ability">Simon</span> — Brew Time! Took pre-roll damage → <span class="log-ms">+1 Sacred Fire!</span>`);
          }
        } else if (!ef.ko && hasSideline(B[tNamePre], 436) && hasSideline(B[enemyName], 45)) {
          const cornGhostPS = getSidelineGhost(B[enemyName], 45);
          preRollCallouts.push(['ANTIDOTE!', 'var(--uncommon)', `${cornGhostPS ? cornGhostPS.name : 'Cornelius'} blocks Princess Shade's Bounty!`, enemyName]);
          log(`<span class="log-ability">Cornelius</span> (sideline) — Antidote! Princess Shade Bounty blocked!`);
        }
      }
    } else if (f.id === 304 && !f.ko && dylanNegates(enemy)) {
      log(`<span class="log-ability">${f.name}</span> — Swarm blocked by <span class="log-ability">Dylan's Scarecrow</span>!`);
      B.piperBlockedThisRound[tNamePre] = true; // v640: Slick Coat gate
    }
  });

  // Shade's Shadow (205) — sideline: deal 1 dmg before each roll IF enemy active < 4 HP (negated by Dylan or Cornelius)
  [B.red, B.blue].forEach(team => {
    const f = active(team);
    const enemy = opp(team);
    const tNameShade = team === B.red ? 'red' : 'blue';
    const corneliusBlocksShadow = hasSideline(enemy, 45);
    if (hasSideline(team, 205) && !dylanNegates(enemy) && !corneliusBlocksShadow) {
      const shadeGhost = getSidelineGhost(team, 205);
      const ef = active(enemy);
      if (!ef.ko && ef.hp < 4) {
        // Phase 4: Masked Hero (55) Underdog fires BEFORE Shade's Shadow damage
        if (ef.id === 55 && !ef.ko) {
          const undPreSS = f.hp;
          f.hp = Math.max(0, f.hp - 3);
          if (f.hp <= 0) { f.ko = true; f.killedBy = 55; }
          const enemyNameSS = enemy === B.red ? 'red' : 'blue';
          const undMsgSS = f.ko
            ? `${ef.name} counters! 3 damage to ${f.name}! (${undPreSS} HP → KO!)`
            : `${ef.name} counters! 3 damage to ${f.name}! (${undPreSS} → ${f.hp} HP)`;
          preRollCallouts.push(['UNDERDOG!', 'var(--uncommon)', undMsgSS, enemyNameSS]);
          log(`<span class="log-ability">${ef.name}</span> — Underdog! 3 counter-damage to ${f.name}!`);
          playDamageSfx(3);
          hitDamage(tNameShade);
          if (f.ko) return; // Attacker KO'd by Underdog — skip Shade's Shadow damage
        }
        const preHp = ef.hp;
        ef.hp = Math.max(0, ef.hp - 1);
        if (ef.hp <= 0) { ef.ko = true; ef.killedBy = 205; }
        const enemyName = enemy === B.red ? 'red' : 'blue';
        const meltMsg = ef.ko
          ? `Shade's Shadow finishes ${ef.name}! (${preHp} HP → KO!)`
          : `Shade's Shadow chips ${ef.name}! (${preHp} → ${ef.hp} HP)`;
        preRollCallouts.push(['MELTDOWN!', 'var(--rare)', meltMsg, tNameShade]);
        log(`<span class="log-ability">Shade's Shadow</span> (sideline) — Meltdown! Enemy below 4 HP — <span class="log-dmg">1 damage to ${ef.name}!</span> ${ef.ko?'<span class="log-ko">KO!</span>':ef.hp+' HP left'}`);
        playDamageSfx(1);
        hitDamage(enemyName);
        popSidelineCard(team, 205);
        // Simon (24) — Brew Time: gain 1 Sacred Fire when taking ANY damage
        if (ef.id === 24 && !ef.ko) {
          B[enemyName].resources.fire++;
          preRollCallouts.push(['BREW TIME!', 'var(--uncommon)', `Simon — Took pre-roll damage → +1 Sacred Fire!`, enemyName]);
          log(`<span class="log-ability">Simon</span> — Brew Time! Took pre-roll damage → <span class="log-ms">+1 Sacred Fire!</span>`);
        }
        // Collect Knight reactions via temp queue mode so they splice AFTER MELTDOWN! in preRollCallouts
        // (not in queue mode → checkKnightEffects fires showAbilityCallout directly, stomping MELTDOWN!)
        const _meltSavedKQ = abilityQueue;
        abilityQueue = [];
        abilityQueueMode = true;
        checkKnightEffects(tNameShade, "Shade's Shadow", shadeGhost);
        abilityQueueMode = false;
        abilityQueue.forEach(item => preRollCallouts.push([item.name, item.color, item.desc, item.team]));
        abilityQueue = _meltSavedKQ;
        // Princess Shade (436) — Bounty: +1 additional damage on pre-roll chip (blocked by Cornelius)
        if (!ef.ko && hasSideline(B[tNameShade], 436) && !hasSideline(enemy, 45)) {
          const psPreHp2 = ef.hp;
          ef.hp = Math.max(0, ef.hp - 1);
          if (ef.hp <= 0) { ef.ko = true; ef.killedBy = 436; }
          preRollCallouts.push(['BOUNTY!', 'var(--rare)', `Princess Shade — +1 additional damage to ${ef.name}!`, tNameShade]);
          log(`<span class="log-ability">Princess Shade</span> (sideline) — Bounty! <span class="log-dmg">+1 additional damage to ${ef.name}!</span> ${ef.ko?'<span class="log-ko">KO!</span>':ef.hp+' HP left'}`);
          playDamageSfx(1);
          hitDamage(enemyName);
          popSidelineCard(B[tNameShade], 436);
          // Simon (24) — Brew Time: gain 1 Sacred Fire when taking ANY damage
          if (ef.id === 24 && !ef.ko) {
            B[enemyName].resources.fire++;
            preRollCallouts.push(['BREW TIME!', 'var(--uncommon)', `Simon — Took pre-roll damage → +1 Sacred Fire!`, enemyName]);
            log(`<span class="log-ability">Simon</span> — Brew Time! Took pre-roll damage → <span class="log-ms">+1 Sacred Fire!</span>`);
          }
        } else if (!ef.ko && hasSideline(B[tNameShade], 436) && hasSideline(enemy, 45)) {
          const cornGhostPS2 = getSidelineGhost(enemy, 45);
          preRollCallouts.push(['ANTIDOTE!', 'var(--uncommon)', `${cornGhostPS2 ? cornGhostPS2.name : 'Cornelius'} blocks Princess Shade's Bounty!`, enemyName]);
          log(`<span class="log-ability">Cornelius</span> (sideline) — Antidote! Princess Shade Bounty blocked!`);
        }
      }
    } else if (hasSideline(team, 205) && dylanNegates(enemy)) {
      log(`<span class="log-ability">Shade's Shadow</span> — Meltdown blocked by <span class="log-ability">Dylan's Scarecrow</span>!`);
      B.piperBlockedThisRound[tNameShade] = true; // v640: Slick Coat gate
    } else if (hasSideline(team, 205) && corneliusBlocksShadow) {
      const cornGhostSS = getSidelineGhost(enemy, 45);
      const enemyNameSS = enemy === B.red ? 'red' : 'blue';
      preRollCallouts.push(['ANTIDOTE!', 'var(--uncommon)', `${cornGhostSS ? cornGhostSS.name : 'Cornelius'} blocks Shade's Shadow Meltdown!`, enemyNameSS]);
      log(`<span class="log-ability">Cornelius</span> (sideline) — Antidote! <span class="log-ability">Shade's Shadow</span> Meltdown blocked!`);
      B.piperBlockedThisRound[tNameShade] = true; // v640: Slick Coat gate
    }
  });

  // Shade (111) — active: deal 1 damage to enemy active before each roll INCLUDING round 1 (negated by Dylan)
  [B.red, B.blue].forEach(team => {
    const f = active(team);
    const enemy = opp(team);
    const tNameHaunt = team === B.red ? 'red' : 'blue';
    if (f.id === 111 && !f.ko && f._rolledOnce && !dylanNegates(enemy)) {
      const ef = active(enemy);
      if (!ef.ko) {
        // Piper (107) — Slick Coat: negates Haunt
        if (ef.id === 107 && !ef.ko) {
          log(`<span class="log-ability">Piper</span> — Slick Coat! Shade's Haunt is negated.`);
        } else {
          const enemyName = enemy === B.red ? 'red' : 'blue';
          // Phase 4: Masked Hero (55) Underdog fires BEFORE Shade's Haunt damage
          if (ef.id === 55 && !ef.ko) {
            const undPre3 = f.hp;
            f.hp = Math.max(0, f.hp - 3);
            if (f.hp <= 0) { f.ko = true; f.killedBy = 55; }
            const undMsg3 = f.ko
              ? `${ef.name} counters! 3 damage to ${f.name}! (${undPre3} HP → KO!)`
              : `${ef.name} counters! 3 damage to ${f.name}! (${undPre3} → ${f.hp} HP)`;
            preRollCallouts.push(['UNDERDOG!', 'var(--uncommon)', undMsg3, enemyName]);
            log(`<span class="log-ability">${ef.name}</span> — Underdog! 3 counter-damage to ${f.name}!`);
            playDamageSfx(3);
            hitDamage(tNameHaunt);
            if (f.ko) return; // Attacker KO'd by Underdog — skip Haunt damage
          }
          const preHp = ef.hp;
          ef.hp = Math.max(0, ef.hp - 1);
          if (ef.hp <= 0) { ef.ko = true; ef.killedBy = 111; }
          const hauntMsg = ef.ko
            ? `Shade haunts ${ef.name}! (${preHp} HP → KO!)`
            : `Shade haunts ${ef.name}! (${preHp} → ${ef.hp} HP)`;
          preRollCallouts.push(['HAUNT!', 'var(--legendary)', hauntMsg, tNameHaunt]);
          log(`<span class="log-ability">Shade</span> — Haunt! <span class="log-dmg">1 damage to ${ef.name}!</span> ${ef.ko?'<span class="log-ko">KO!</span>':ef.hp+' HP left'}`);
          playDamageSfx(1);
          hitDamage(enemyName);
          // Simon (24) — Brew Time: gain 1 Sacred Fire when taking ANY damage
          if (ef.id === 24 && !ef.ko) {
            B[enemyName].resources.fire++;
            preRollCallouts.push(['BREW TIME!', 'var(--uncommon)', `Simon — Took pre-roll damage → +1 Sacred Fire!`, enemyName]);
            log(`<span class="log-ability">Simon</span> — Brew Time! Took pre-roll damage → <span class="log-ms">+1 Sacred Fire!</span>`);
          }
          // Collect Knight reactions via temp queue mode so they splice AFTER HAUNT! in preRollCallouts
          const _hauntSavedKQ = abilityQueue;
          abilityQueue = [];
          abilityQueueMode = true;
          checkKnightEffects(tNameHaunt, f.name);
          abilityQueueMode = false;
          abilityQueue.forEach(item => preRollCallouts.push([item.name, item.color, item.desc, item.team]));
          abilityQueue = _hauntSavedKQ;
          // Princess Shade (436) — Bounty: +1 additional damage on pre-roll chip (blocked by Cornelius)
          if (!ef.ko && hasSideline(B[tNameHaunt], 436) && !hasSideline(enemy, 45)) {
            const psPreHp3 = ef.hp;
            ef.hp = Math.max(0, ef.hp - 1);
            if (ef.hp <= 0) { ef.ko = true; ef.killedBy = 436; }
            preRollCallouts.push(['BOUNTY!', 'var(--rare)', `Princess Shade — +1 additional damage to ${ef.name}!`, tNameHaunt]);
            log(`<span class="log-ability">Princess Shade</span> (sideline) — Bounty! <span class="log-dmg">+1 additional damage to ${ef.name}!</span> ${ef.ko?'<span class="log-ko">KO!</span>':ef.hp+' HP left'}`);
            playDamageSfx(1);
            hitDamage(enemyName);
            popSidelineCard(B[tNameHaunt], 436);
            if (ef.id === 24 && !ef.ko) {
              B[enemyName].resources.fire++;
              preRollCallouts.push(['BREW TIME!', 'var(--uncommon)', `Simon — Took pre-roll damage → +1 Sacred Fire!`, enemyName]);
              log(`<span class="log-ability">Simon</span> — Brew Time! Took pre-roll damage → <span class="log-ms">+1 Sacred Fire!</span>`);
            }
          } else if (!ef.ko && hasSideline(B[tNameHaunt], 436) && hasSideline(enemy, 45)) {
            const cornGhostPS3 = getSidelineGhost(enemy, 45);
            const enemyNameHaunt = enemy === B.red ? 'red' : 'blue';
            preRollCallouts.push(['ANTIDOTE!', 'var(--uncommon)', `${cornGhostPS3 ? cornGhostPS3.name : 'Cornelius'} blocks Princess Shade's Bounty!`, enemyNameHaunt]);
            log(`<span class="log-ability">Cornelius</span> (sideline) — Antidote! Princess Shade Bounty blocked!`);
          }
        }
      }
    } else if (f.id === 111 && !f.ko && dylanNegates(enemy)) {
      log(`<span class="log-ability">Shade</span> — Haunt blocked by <span class="log-ability">Dylan's Scarecrow</span>!`);
      B.piperBlockedThisRound[tNameHaunt] = true; // v640: Slick Coat gate
    }
  });

  // Lucy (108) — Blue Fire: pending tick from the previous round's win.
  // Lucy's "Win a roll: opponent takes 1 damage before their next roll" arrives here
  // as a separate beat — NOT bundled with the winning roll's damage. The flag is
  // Delayed damage: set by Lucy (108, 1 dmg) or Humar (336, 2 dmg) via B.pendingLucyDmg
  // Consumed before this round's roll. Target is the team holding the pending flag.
  [B.red, B.blue].forEach(team => {
    const tNameLucyTarget = team === B.red ? 'red' : 'blue';
    if (!(B.pendingLucyDmg && B.pendingLucyDmg[tNameLucyTarget] > 0)) return;
    const pendingDmg = B.pendingLucyDmg[tNameLucyTarget];
    const tNameLucyActor = tNameLucyTarget === 'red' ? 'blue' : 'red';
    const isHumar = pendingDmg >= 2;
    const abilityLabel = isHumar ? 'Meteor' : 'Blue Fire';
    const splashName = isHumar ? 'METEOR!' : 'BLUE FIRE!';
    const splashColor = 'var(--legendary)';
    if (!dylanNegates(team)) {
      const f = active(team);
      if (!f.ko) {
        // Phase 4: Masked Hero (55) Underdog fires BEFORE Lucy/Humar delayed damage
        if (f.id === 55 && !f.ko) {
          const lucyAttacker = active(B[tNameLucyActor]);
          if (lucyAttacker && !lucyAttacker.ko) {
            const undPreL = lucyAttacker.hp;
            lucyAttacker.hp = Math.max(0, lucyAttacker.hp - 3);
            if (lucyAttacker.hp <= 0) { lucyAttacker.ko = true; lucyAttacker.killedBy = 55; }
            const undMsgL = lucyAttacker.ko
              ? `${f.name} counters! 3 damage to ${lucyAttacker.name}! (${undPreL} HP → KO!)`
              : `${f.name} counters! 3 damage to ${lucyAttacker.name}! (${undPreL} → ${lucyAttacker.hp} HP)`;
            preRollCallouts.push(['UNDERDOG!', 'var(--uncommon)', undMsgL, tNameLucyTarget]);
            log(`<span class="log-ability">${f.name}</span> — Underdog! 3 counter-damage to ${lucyAttacker.name}!`);
            playDamageSfx(3);
            hitDamage(tNameLucyActor);
            if (lucyAttacker.ko) {
              B.pendingLucyDmg[tNameLucyTarget] = 0; // consume the flag
              return; // Attacker KO'd by Underdog — skip Lucy/Humar damage
            }
          }
        }
        const preHp = f.hp;
        f.hp = Math.max(0, f.hp - pendingDmg);
        if (f.hp <= 0) { f.ko = true; f.killedBy = isHumar ? 336 : 108; }
        const lucyMsg = f.ko
          ? `${abilityLabel} burns ${f.name}! (${preHp} HP → KO!)`
          : `${abilityLabel} burns ${f.name}! (${preHp} → ${f.hp} HP)`;
        preRollCallouts.push([splashName, splashColor, lucyMsg, tNameLucyActor]);
        log(`<span class="log-ability">${abilityLabel}</span> — <span class="log-dmg">${pendingDmg} damage to ${f.name}!</span> ${f.ko?'<span class="log-ko">KO!</span>':f.hp+' HP left'}`);
        playDamageSfx(pendingDmg);
        hitDamage(tNameLucyTarget);
        // Simon (24) — Brew Time: gain 1 Sacred Fire when taking ANY damage
        if (f.id === 24 && !f.ko) {
          B[tNameLucyTarget].resources.fire++;
          preRollCallouts.push(['BREW TIME!', 'var(--uncommon)', `Simon — Took pre-roll damage → +1 Sacred Fire!`, tNameLucyTarget]);
          log(`<span class="log-ability">Simon</span> — Brew Time! Took pre-roll damage → <span class="log-ms">+1 Sacred Fire!</span>`);
        }
        // Princess Shade (436) — Bounty: +1 additional damage on pre-roll chip (blocked by Cornelius)
        if (!f.ko && hasSideline(B[tNameLucyActor], 436) && !hasSideline(B[tNameLucyTarget], 45)) {
          const psPreHpL = f.hp;
          f.hp = Math.max(0, f.hp - 1);
          if (f.hp <= 0) { f.ko = true; f.killedBy = 436; }
          preRollCallouts.push(['BOUNTY!', 'var(--rare)', `Princess Shade — +1 additional damage to ${f.name}!`, tNameLucyActor]);
          log(`<span class="log-ability">Princess Shade</span> (sideline) — Bounty! <span class="log-dmg">+1 additional damage to ${f.name}!</span> ${f.ko?'<span class="log-ko">KO!</span>':f.hp+' HP left'}`);
          playDamageSfx(1);
          hitDamage(tNameLucyTarget);
          popSidelineCard(B[tNameLucyActor], 436);
          // Simon (24) — Brew Time: gain 1 Sacred Fire when taking ANY damage
          if (f.id === 24 && !f.ko) {
            B[tNameLucyTarget].resources.fire++;
            preRollCallouts.push(['BREW TIME!', 'var(--uncommon)', `Simon — Took pre-roll damage → +1 Sacred Fire!`, tNameLucyTarget]);
            log(`<span class="log-ability">Simon</span> — Brew Time! Took pre-roll damage → <span class="log-ms">+1 Sacred Fire!</span>`);
          }
        } else if (!f.ko && hasSideline(B[tNameLucyActor], 436) && hasSideline(B[tNameLucyTarget], 45)) {
          const cornGhostPSL = getSidelineGhost(B[tNameLucyTarget], 45);
          preRollCallouts.push(['ANTIDOTE!', 'var(--uncommon)', `${cornGhostPSL ? cornGhostPSL.name : 'Cornelius'} blocks Princess Shade's Bounty!`, tNameLucyTarget]);
          log(`<span class="log-ability">Cornelius</span> (sideline) — Antidote! Princess Shade Bounty blocked!`);
        }
        // Knight reactions on Lucy's side (the actor). Temp queue mode so reactions
        // splice AFTER BLUE FIRE! in preRollCallouts instead of stomping it.
        const _lucySavedKQ = abilityQueue;
        abilityQueue = [];
        abilityQueueMode = true;
        checkKnightEffects(tNameLucyActor, 'Lucy');
        abilityQueueMode = false;
        abilityQueue.forEach(item => preRollCallouts.push([item.name, item.color, item.desc, item.team]));
        abilityQueue = _lucySavedKQ;
      }
    } else {
      log(`<span class="log-ability">Lucy</span> — Blue Fire blocked by <span class="log-ability">Dylan's Scarecrow</span>!`);
      B.piperBlockedThisRound[tNameLucyActor] = true; // v640: Slick Coat gate
    }
    B.pendingLucyDmg[tNameLucyTarget] = 0; // consume regardless (applied, negated, or target KO'd)
  });

  // Splinter (101) — Toxic Fumes: once activated (first win), deal 1 chip damage to enemy before every roll
  // Negated by Dylan's Scarecrow (same as Haunt). Stops naturally when Splinter is KO'd (no longer active).
  [B.red, B.blue].forEach(team => {
    const f = active(team);
    const enemy = opp(team);
    const tNameSplinter = team === B.red ? 'red' : 'blue';
    if (f.id === 101 && !f.ko && B.splinterActivated && B.splinterActivated[tNameSplinter]) {
      const ef = active(enemy);
      if (!ef.ko) {
        if (dylanNegates(enemy)) {
          log(`<span class="log-ability">Splinter</span> — Toxic Fumes blocked by <span class="log-ability">Dylan's Scarecrow</span>!`);
          B.piperBlockedThisRound[tNameSplinter] = true; // v640: Slick Coat gate
        } else {
          const enemyName = enemy === B.red ? 'red' : 'blue';
          // Phase 4: Masked Hero (55) Underdog fires BEFORE Splinter's Toxic Fumes damage
          if (ef.id === 55 && !ef.ko) {
            const undPre4 = f.hp;
            f.hp = Math.max(0, f.hp - 3);
            if (f.hp <= 0) { f.ko = true; f.killedBy = 55; }
            const undMsg4 = f.ko
              ? `${ef.name} counters! 3 damage to ${f.name}! (${undPre4} HP → KO!)`
              : `${ef.name} counters! 3 damage to ${f.name}! (${undPre4} → ${f.hp} HP)`;
            preRollCallouts.push(['UNDERDOG!', 'var(--uncommon)', undMsg4, enemyName]);
            log(`<span class="log-ability">${ef.name}</span> — Underdog! 3 counter-damage to ${f.name}!`);
            playDamageSfx(3);
            hitDamage(tNameSplinter);
            if (f.ko) return; // Attacker KO'd by Underdog — skip Toxic Fumes damage
          }
          const preHp = ef.hp;
          ef.hp = Math.max(0, ef.hp - 1);
          if (ef.hp <= 0) { ef.ko = true; ef.killedBy = 101; }
          const fumesMsg = ef.ko
            ? `Toxic Fumes choke ${ef.name}! (${preHp} HP → KO!)`
            : `Toxic Fumes choke ${ef.name}! (${preHp} → ${ef.hp} HP)`;
          preRollCallouts.push(['TOXIC FUMES!', 'var(--ghost-rare)', fumesMsg, tNameSplinter]);
          log(`<span class="log-ability">Splinter</span> — Toxic Fumes! <span class="log-dmg">1 damage to ${ef.name}!</span> ${ef.ko?'<span class="log-ko">KO!</span>':ef.hp+' HP left'}`);
          playDamageSfx(1);
          hitDamage(enemyName);
          if (ef.id === 24 && !ef.ko) {
            B[enemyName].resources.fire++;
            preRollCallouts.push(['BREW TIME!', 'var(--uncommon)', `Simon — Took pre-roll damage → +1 Sacred Fire!`, enemyName]);
            log(`<span class="log-ability">Simon</span> — Brew Time! Took pre-roll damage → <span class="log-ms">+1 Sacred Fire!</span>`);
          }
          const _splinterSavedKQ = abilityQueue;
          abilityQueue = [];
          abilityQueueMode = true;
          checkKnightEffects(tNameSplinter, f.name);
          abilityQueueMode = false;
          abilityQueue.forEach(item => preRollCallouts.push([item.name, item.color, item.desc, item.team]));
          abilityQueue = _splinterSavedKQ;
          // Princess Shade (436) — Bounty: +1 additional damage on pre-roll chip (blocked by Cornelius)
          if (!ef.ko && hasSideline(B[tNameSplinter], 436) && !hasSideline(enemy, 45)) {
            const psPreHp4 = ef.hp;
            ef.hp = Math.max(0, ef.hp - 1);
            if (ef.hp <= 0) { ef.ko = true; ef.killedBy = 436; }
            preRollCallouts.push(['BOUNTY!', 'var(--rare)', `Princess Shade — +1 additional damage to ${ef.name}!`, tNameSplinter]);
            log(`<span class="log-ability">Princess Shade</span> (sideline) — Bounty! <span class="log-dmg">+1 additional damage to ${ef.name}!</span> ${ef.ko?'<span class="log-ko">KO!</span>':ef.hp+' HP left'}`);
            playDamageSfx(1);
            hitDamage(enemyName);
            popSidelineCard(B[tNameSplinter], 436);
            if (ef.id === 24 && !ef.ko) {
              B[enemyName].resources.fire++;
              preRollCallouts.push(['BREW TIME!', 'var(--uncommon)', `Simon — Took pre-roll damage → +1 Sacred Fire!`, enemyName]);
              log(`<span class="log-ability">Simon</span> — Brew Time! Took pre-roll damage → <span class="log-ms">+1 Sacred Fire!</span>`);
            }
          } else if (!ef.ko && hasSideline(B[tNameSplinter], 436) && hasSideline(enemy, 45)) {
            const cornGhostPS4 = getSidelineGhost(enemy, 45);
            preRollCallouts.push(['ANTIDOTE!', 'var(--uncommon)', `${cornGhostPS4 ? cornGhostPS4.name : 'Cornelius'} blocks Princess Shade's Bounty!`, enemyName]);
            log(`<span class="log-ability">Cornelius</span> (sideline) — Antidote! Princess Shade Bounty blocked!`);
          }
        }
      }
    }
  });

  } // end pre-roll once-per-turn guard (v687)

  // Toby (97) — Pure Heart: if declared last round, KO Toby before rolling (the sacrifice)
  [B.red, B.blue].forEach(team => {
    const f = active(team);
    const tNameToby = team === B.red ? 'red' : 'blue';
    if (f.id === 97 && !f.ko && B.pureHeartScheduledKO && B.pureHeartScheduledKO[tNameToby]) {
      B.pureHeartScheduledKO[tNameToby] = false;
      f.hp = 0;
      f.ko = true;
      f.killedBy = 97; // self-sacrifice
      preRollCallouts.push(['PURE HEART!', 'var(--ghost-rare)', `${f.name} — The sacrifice is complete. The final roll was played.`, tNameToby]);
      log(`<span class="log-ability">${f.name}</span> — Pure Heart! Toby is defeated before rolling (sacrifice).`);
    }
  });

  // Wandering Sue (84) — Hidden Weakness: if enemy active ghost has 12+ HP, destroy them before rolling
  // Anti-overclock assassin — punishes opponents who stack HP via Seeker, Boris Fortify, etc.
  [B.red, B.blue].forEach(team => {
    const f = active(team);
    if (f.id === 84 && !f.ko) {
      const enemy = opp(team);
      const ef = active(enemy);
      if (!ef.ko && ef.hp >= 12) {
        const preHp = ef.hp;
        ef.hp = 0;
        ef.ko = true;
        ef.killedBy = 84;
        preRollCallouts.push(['HIDDEN WEAKNESS!', 'var(--rare)', `${ef.name} has ${preHp} HP — exposed and destroyed!`, team === B.red ? 'red' : 'blue']);
        log(`<span class="log-ability">${f.name}</span> — Hidden Weakness! ${ef.name} had ${preHp} HP (≥12) — <span class="log-ko">instant KO!</span>`);
      }
    }
  });

  // If a pre-roll ability (Swarm / Meltdown / Haunt / Pure Heart / Hidden Weakness) caused a KO, flush any pending
  // callouts (e.g. MELTDOWN!) BEFORE the swap modal opens — previously the early
  // return discarded them and the callout silently never played.
  const preRollKO = [B.red, B.blue].some(t => active(t).ko);
  if (preRollKO && preRollCallouts.length > 0) {
    // Park phase NOW so rollReady's `if (B.phase !== 'ready') return;` guard fires
    // and prevents rolling from starting while MELTDOWN! is on screen. Without this,
    // doPreRollSetup returns undefined, the phase stays 'ready', rollReady sets it to
    // 'rolling', and dice fly mid-callout — then handleKOs() opens the swap modal
    // mid-resolution. 'ko-pause' is the correct holding state (used by doPressureSwap,
    // doKoSwap, etc.) — handleKOs() will transition to 'ko-swap' when it fires.
    B.phase = 'ko-pause';
    preRollCallouts.forEach((c, i) => {
      setTimeout(() => showAbilityCallout(c[0], c[1], c[2], c[3]), i * 1500);
    });
    refundCommitted();
    setTimeout(() => handleKOs(), preRollCallouts.length * 1500);
    return;
  }
  if (handleKOs()) {
    // No pending callouts — swap flow opens immediately
    refundCommitted();
    return;
  }

  // Harrison (315) — opt-in: spend seeds for extra dice (1 per seed)
  B.harrisonExtraDie = { red: 0, blue: 0 };
  [B.red, B.blue].forEach(team => {
    const f = active(team);
    const tName = team === B.red ? 'red' : 'blue';
    if (f.id === 315 && !f.ko && B.committed[tName].harrison > 0) {
      B.harrisonExtraDie[tName] = B.committed[tName].harrison;
      const cnt = B.committed[tName].harrison;
      B.committed[tName].harrison = 0; // reset after use
      preRollCallouts.push(['ASCEND!', 'var(--rare)', `${f.name} — ${cnt} seed${cnt>1?'s':''} → +${cnt} dice!`, team === B.red ? 'red' : 'blue']);
      log(`<span class="log-ability">${f.name}</span> — Ascend! Spent ${cnt} Healing Seed${cnt>1?'s':''} for +${cnt} extra dice!`);
      // Knight reactions to Ascend — collect via temporary queue then splice into preRollCallouts
      // so HEAVY AIR! / RETRIBUTION! plays sequentially AFTER ASCEND!, not as a simultaneous stomp
      const _savedAscendAQ = abilityQueue;
      abilityQueue = [];
      abilityQueueMode = true;
      checkKnightEffects(tName, f.name);
      abilityQueueMode = false;
      abilityQueue.forEach(item => preRollCallouts.push([item.name, item.color, item.desc, item.team]));
      abilityQueue = _savedAscendAQ;
    }
  });

  // Nick & Knack (409) — Knick Knack: now an interactive picker (see doNickKnackSteal)
  B.nickKnackDecided = { red: false, blue: false };

  // Chow (414) — Secret Ingredient: reset decided flag only, NOT chowExtraDie
  // chowExtraDie persists until consumed in the dice count section (lines ~8207-8208)
  // Resetting it here would kill the bonus before the roll uses it
  if (!B.chowExtraDie) B.chowExtraDie = { red: 0, blue: 0 };
  B.chowDecided = { red: false, blue: false };

  // Castle Gardener (442) — Cultivate: reset per round
  B.cultivateDecided = { red: false, blue: false };

  // Forest Spirit (446) — Hex: reset per round
  B.hexDieRemoval = { red: 0, blue: 0 };

  // Aunt Susan (309)
  B.auntSusanBonus = { red: false, blue: false };
  B.auntSusanHealBonus = { red: false, blue: false };
  [B.red, B.blue].forEach(team => {
    const f = active(team);
    const tName = team === B.red ? 'red' : 'blue';
    if (f.id === 309 && B.committed[tName].auntSusan > 0) {
      B.auntSusanBonus[tName] = B.committed[tName].auntSusan;
      log(`<span class="log-ability">${f.name}</span> — Harvest Dance! Spent ${B.committed[tName].auntSusan} Healing Seed${B.committed[tName].auntSusan>1?'s':''} for +${B.committed[tName].auntSusan * 2} damage!`);
    }
    if (f.id === 309 && B.committed[tName].auntSusanHeal > 0) {
      B.auntSusanHealBonus[tName] = B.committed[tName].auntSusanHeal;
      log(`<span class="log-ability">${f.name}</span> — Harvest Dance! Spent ${B.committed[tName].auntSusanHeal} Healing Seed${B.committed[tName].auntSusanHeal>1?'s':''} for +${B.committed[tName].auntSusanHeal * 2} HP!`);
    }
  });

  // Finn (204) — Flame Blade: opt-in forge button (see useFinnFlameBlade), no auto-conversion

  // Zippa (423) — Glimmer: before rolling, gain Lucky Stones equal to Healing Seeds held (v674: moved from win to pre-roll)
  [B.red, B.blue].forEach(team => {
    const f = active(team);
    const tName = team === B.red ? 'red' : 'blue';
    if (f.id === 423 && !f.ko) {
      const seeds = team.resources.healingSeed || 0;
      if (seeds > 0) {
        team.resources.luckyStone += seeds;
        preRollCallouts.push(['GLIMMER!', 'var(--uncommon)', `${f.name} — ${seeds} Healing Seed${seeds>1?'s':''} held → +${seeds} Lucky Stone${seeds>1?'s':''}!`, tName]);
        log(`<span class="log-ability">${f.name}</span> — Glimmer! <span class="log-ms">+${seeds} Lucky Stone${seeds>1?'s':''}!</span>`);
        checkKnightEffects(tName, f.name);
      }
    }
  });

  // ========================================
  // PHASE 2: COMPUTE DICE COUNTS (rolled later per-click)
  // ========================================
  let redCount = 3, blueCount = 3;
  // Doug (63) Caution duel-phase swap promised the incoming ghost +1 die — apply now.
  if (B.dougCautionDieBonus && B.dougCautionDieBonus.red) { redCount++; B.dougCautionDieBonus.red = false; }
  if (B.dougCautionDieBonus && B.dougCautionDieBonus.blue) { blueCount++; B.dougCautionDieBonus.blue = false; }

  // Knight Light Retribution — bonus dice from opponent abilities
  // Guard: only apply if KL (402) is still the active ghost on that team — if KL was KO'd
  // mid-round the stored dice are silently discarded (not inherited by the replacement ghost).
  if (B.retributionDice) {
    if (B.retributionDice.red > 0) {
      const klRed = active(B.red);
      if (klRed.id === 402 && !klRed.ko) {
        redCount += B.retributionDice.red;
        log(`<span class="log-ability">Knight Light</span> — Retribution! <span class="log-ms">+${B.retributionDice.red} bonus dice!</span>`);
      }
    }
    if (B.retributionDice.blue > 0) {
      const klBlue = active(B.blue);
      if (klBlue.id === 402 && !klBlue.ko) {
        blueCount += B.retributionDice.blue;
        log(`<span class="log-ability">Knight Light</span> — Retribution! <span class="log-ms">+${B.retributionDice.blue} bonus dice!</span>`);
      }
    }
    B.retributionDice = { red: 0, blue: 0 };
  }

  // Bouril (201) — first roll override
  let hankOverride = { red: false, blue: false };
  [B.red, B.blue].forEach(team => {
    const f = active(team);
    const tName = team === B.red ? 'red' : 'blue';
    if (f.id === 201 && f.hankFirstRoll) {
      hankOverride[tName] = true;
      f.hankFirstRoll = false;
    }
  });

  // Maximo (302) — first roll 1 die
  [B.red, B.blue].forEach(team => {
    const f = active(team);
    const tName = team === B.red ? 'red' : 'blue';
    if (f.id === 302 && f.maximoFirstRoll) {
      if (tName === 'red') redCount = 1;
      else blueCount = 1;
      f.maximoFirstRoll = false;
      preRollCallouts.push(['NAP!', 'var(--common)', `${f.name} — still napping, rolling only 1 die!`, tName]);
      log(`<span class="log-ability">${f.name}</span> is still napping — rolling only 1 die!`);
    }
  });

  // Redd (98) — Notorious: +2 dice on first roll after entry
  [B.red, B.blue].forEach(team => {
    const f = active(team);
    const tName = team === B.red ? 'red' : 'blue';
    if (f.id === 98 && f.reddFirstRoll) {
      if (tName === 'red') redCount += 2;
      else blueCount += 2;
      f.reddFirstRoll = false;
      log(`<span class="log-ability">${f.name}</span> — Notorious! Rolling with +2 bonus dice!`);
    }
  });

  // Dallas (60) — Quick Draw: steal 1 enemy die for first 2 rolls after entering from sideline
  [B.red, B.blue].forEach(team => {
    const f = active(team);
    const tName = team === B.red ? 'red' : 'blue';
    const enemyTName = tName === 'red' ? 'blue' : 'red';
    if (f.id === 60 && !f.ko && f.dallasQuickDraw > 0) {
      if (enemyTName === 'red') redCount = Math.max(1, redCount - 1);
      else blueCount = Math.max(1, blueCount - 1);
      if (tName === 'red') redCount += 1; else blueCount += 1; // steal: transfer the die to Dallas
      f.dallasQuickDraw--;
      const rollsLeft = f.dallasQuickDraw;
      preRollCallouts.push(['QUICK DRAW!', 'var(--uncommon)', `${f.name} — stole 1 die from opponent! (${rollsLeft} roll${rollsLeft !== 1 ? 's' : ''} of Quick Draw left)`, team === B.red ? 'red' : 'blue']);
      log(`<span class="log-ability">${f.name}</span> — Quick Draw! Opponent rolls 1 fewer die. (${rollsLeft} uses left)`);
    }
  });

  // Timber (210) — Howl: opponent chooses discard 2 specials OR -1 die
  // Choice is resolved via modal before dice are stored. timberDieReduction tracks result.
  B.timberDieReduction = { red: false, blue: false };
  [B.red, B.blue].forEach(team => {
    const f = active(team);
    if (f.id === 210 && !f.ko) {
      const oppTeamName = team === B.red ? 'blue' : 'red';
      const oppTeam = team === B.red ? B.blue : B.red;
      // Dylan (301) Scarecrow / Piper (107) Slick Coat: negate all enemy before-rolling effects
      if (dylanNegates(oppTeam)) {
        const oppLabel = oppTeamName.charAt(0).toUpperCase() + oppTeamName.slice(1);
        preRollCallouts.push(['BLOCKED!', 'var(--text2)', `${oppLabel} — Scarecrow/Slick Coat negates Timber's Howl!`, oppTeamName]);
        log(`<span class="log-ability">${oppLabel}</span> — Dylan/Piper negates Timber's Howl!`);
        B.piperBlockedThisRound[team === B.red ? 'red' : 'blue'] = true; // v640: Slick Coat gate
        return;
      }
      const r = oppTeam.resources;
      const totalSpecials = (r.ice||0) + (r.fire||0) + (r.surge||0) + (r.moonstone||0) + (r.healingSeed||0) + (r.luckyStone||0);
      if (totalSpecials < 2) {
        // Not enough specials — forced to lose die
        B.timberDieReduction[oppTeamName] = true;
        if (oppTeamName === 'red') redCount = Math.max(1, redCount - 1);
        else blueCount = Math.max(1, blueCount - 1);
        const oppLabel = oppTeamName.charAt(0).toUpperCase() + oppTeamName.slice(1);
        preRollCallouts.push(['HOWL!', 'var(--legendary)', `${oppLabel} has no specials — forced to roll 1 fewer die!`, team === B.red ? 'red' : 'blue']);
        log(`<span class="log-ability">${oppLabel}</span> has no specials — forced to roll 1 fewer die under Timber's Howl!`);
        // Knight reactions to forced Howl — collect via temporary queue then splice into preRollCallouts
        const timberTeamName = team === B.red ? 'red' : 'blue';
        const _savedKQ = abilityQueue;
        abilityQueue = [];
        abilityQueueMode = true;
        checkKnightEffects(timberTeamName, f.name);
        abilityQueueMode = false;
        abilityQueue.forEach(item => preRollCallouts.push([item.name, item.color, item.desc, item.team]));
        abilityQueue = _savedKQ;
      } else {
        // Opponent has resources — queue the choice modal
        const timberTeamName = team === B.red ? 'red' : 'blue';
        B.timberPending = { team: oppTeam, oppTeamName, timberTeam: timberTeamName, redCount, blueCount };
      }
    }
  });

  // Piper (107) — Slick Coat: -1 enemy die IF an enemy auto-fire before-roll ability was
  // actually negated this round. v640 (Wyatt 2026-04-11): reactive, not unconditional.
  // Previously Slick Coat fired the -1 die every single round whenever Piper was active,
  // even when the enemy had nothing to negate — Wyatt's playtest observation.
  [B.red, B.blue].forEach(team => {
    const f = active(team);
    const tName = team === B.red ? 'red' : 'blue';
    const oppTeamName = tName === 'red' ? 'blue' : 'red';
    if (f.id === 107 && !f.ko && B.piperBlockedThisRound[oppTeamName]) {
      if (oppTeamName === 'red') redCount = Math.max(1, redCount - 1);
      else blueCount = Math.max(1, blueCount - 1);
      preRollCallouts.push(['SLICK COAT!', 'var(--ghost-rare)', `${f.name} — negation + enemy rolls 1 fewer die!`, team === B.red ? 'red' : 'blue']);
      log(`<span class="log-ability">${f.name}</span> — Slick Coat! Negated enemy effect + -1 enemy die.`);
    }
  });

  // Cyboo (100) — Spark: while on the sideline, active ghost gains +1 die if it has < 3 HP
  // Negated by Cornelius (45) — Antidote: if the enemy team has Cornelius on their sideline, Spark is blocked.
  [B.red, B.blue].forEach(team => {
    const f = active(team);
    const tName = team === B.red ? 'red' : 'blue';
    const enemyTeamObj = team === B.red ? B.blue : B.red;
    const corneliusBlocksSpark = hasSideline(enemyTeamObj, 45);
    if (!f.ko && f.hp < 3 && hasSideline(team, 100)) {
      if (corneliusBlocksSpark) {
        const cornGhost = getSidelineGhost(enemyTeamObj, 45);
        log(`<span class="log-ability">Cornelius</span> (sideline) — Antidote! <span class="log-ability">Cyboo</span> Spark blocked for ${f.name}!`);
        const blockedByName = cornGhost ? cornGhost.name : 'Cornelius';
        preRollCallouts.push(['ANTIDOTE!', 'var(--uncommon)', `${blockedByName} blocks Cyboo's Spark on ${f.name}!`, tName === 'red' ? 'blue' : 'red']);
      } else {
        if (tName === 'red') redCount += 1;
        else blueCount += 1;
        const cybGhost = getSidelineGhost(team, 100);
        preRollCallouts.push(['SPARK!', 'var(--ghost-rare)', `${cybGhost ? cybGhost.name : 'Cyboo'} (sideline) — ${f.name} is at ${f.hp} HP! +1 bonus die!`, tName]);
        log(`<span class="log-ability">Cyboo</span> (sideline) — Spark! ${f.name} at ${f.hp} HP → +1 die!`);
      }
    }
  });

  // Shoo (13) — Alpine Air: while on the sideline, the active ghost gains +2 HP when HP < 4. Once per ghost.
  // Negated by Cornelius (45) — Antidote: if the enemy team has Cornelius on sideline, Alpine Air is blocked (once-per-ghost use NOT consumed).
  [B.red, B.blue].forEach(team => {
    const f = active(team);
    const enemyTeamObj = team === B.red ? B.blue : B.red;
    if (!f.ko && f.hp < 4 && hasSideline(team, 13) && !f.shooAlpineUsed) {
      const shooGhost = getSidelineGhost(team, 13);
      // Cornelius (45) — Antidote: block before consuming the once-per-ghost use
      if (hasSideline(enemyTeamObj, 45)) {
        const cornGhostShoo = getSidelineGhost(enemyTeamObj, 45);
        preRollCallouts.push(['ANTIDOTE!', 'var(--uncommon)', `${cornGhostShoo ? cornGhostShoo.name : 'Cornelius'} (sideline) — blocks Shoo's Alpine Air on ${f.name}!`, team === B.red ? 'blue' : 'red']);
        log(`<span class="log-ability">Cornelius</span> (sideline) — Antidote! Shoo Alpine Air blocked for ${f.name}.`);
      } else {
        const shooHpBefore = f.hp;
        f.shooAlpineUsed = true;
        // Mr Filbert (59) — Mask Merchant: flip heal to damage when Filbert is on the enemy sideline
        if (hasSideline(enemyTeamObj, 59)) {
          f.hp = Math.max(0, f.hp - 2);
          if (f.hp <= 0) { f.hp = 0; f.ko = true; f.killedBy = 59; }
          preRollCallouts.push(['MASK MERCHANT!', 'var(--uncommon)', `Mr Filbert — Alpine Air cursed! ${f.name} takes 2 damage! (${shooHpBefore}→${f.hp} HP)`, team === B.red ? 'blue' : 'red']);
          log(`<span class="log-ability">Mr Filbert</span> — Mask Merchant! Alpine Air flipped to damage. ${f.name} ${shooHpBefore} → ${f.hp} HP.`);
        } else {
          f.hp += 2;
          const overShoo = f.hp > f.maxHp;
          preRollCallouts.push(['ALPINE AIR!', 'var(--common)', `${shooGhost ? shooGhost.name : 'Shoo'} (sideline) — ${f.name} below 4 HP! +2 HP! (${shooHpBefore}→${f.hp}/${f.maxHp}${overShoo ? ' · overclocked!' : ''})`, team === B.red ? 'red' : 'blue']);
          log(`<span class="log-ability">Shoo</span> (sideline) — Alpine Air! ${f.name} at ${shooHpBefore} HP → +2 HP (${f.hp}/${f.maxHp}${overShoo ? ' overclocked!' : ''}). Used!`);
        }
      }
    }
  });

  // Needle (21) — Big Bro: while on the sideline, if Buttons (ID 8) is the active ghost, +1 die
  // Negated by Cornelius (45) — Antidote: if the enemy team has Cornelius on their sideline, Big Bro is blocked.
  [B.red, B.blue].forEach(team => {
    const f = active(team);
    const tName = team === B.red ? 'red' : 'blue';
    const enemyTeamObjNeedle = team === B.red ? B.blue : B.red;
    if (!f.ko && f.id === 8 && hasSideline(team, 21)) {
      if (hasSideline(enemyTeamObjNeedle, 45)) {
        const cornGhostNeedle = getSidelineGhost(enemyTeamObjNeedle, 45);
        preRollCallouts.push(['ANTIDOTE!', 'var(--uncommon)', `${cornGhostNeedle ? cornGhostNeedle.name : 'Cornelius'} (sideline) — blocks Needle's Big Bro on ${f.name}!`, tName === 'red' ? 'blue' : 'red']);
        log(`<span class="log-ability">Cornelius</span> (sideline) — Antidote! Needle Big Bro blocked for ${f.name}.`);
      } else {
        if (tName === 'red') redCount += 1;
        else blueCount += 1;
        const needleGhost = getSidelineGhost(team, 21);
        preRollCallouts.push(['BIG BRO!', 'var(--common)', `${needleGhost ? needleGhost.name : 'Needle'} (sideline) — ${f.name} is in play! +1 bonus die!`, tName]);
        log(`<span class="log-ability">Needle</span> (sideline) — Big Bro! ${f.name} is in play → +1 die!`);
      }
    }
  });

  // Harrison extra die
  if (B.harrisonExtraDie.red) redCount += B.harrisonExtraDie.red;
  if (B.harrisonExtraDie.blue) blueCount += B.harrisonExtraDie.blue;

  // Chow (414) — Secret Ingredient: +2 dice from discarded seed, then consume
  if (B.chowExtraDie && B.chowExtraDie.red > 0) { redCount += B.chowExtraDie.red; B.chowExtraDie.red = 0; }
  if (B.chowExtraDie && B.chowExtraDie.blue > 0) { blueCount += B.chowExtraDie.blue; B.chowExtraDie.blue = 0; }

  // Twyla (417) — Lucky Dance: MOVED to doLuckyReroll (v675) — bonus dice + seeds granted live when each stone is spent

  // Gordok (430) — River Terror: +1 die next roll after stealing (consumed after use)
  if (B.gordokDieBonus && B.gordokDieBonus.red > 0) {
    redCount += B.gordokDieBonus.red;
    preRollCallouts.push(['RIVER TERROR!', 'var(--rare)', `Gordok — stolen resources! +${B.gordokDieBonus.red} bonus die!`, 'red']);
    log(`<span class="log-ability">Gordok</span> — River Terror! +${B.gordokDieBonus.red} bonus die this roll.`);
    B.gordokDieBonus.red = 0;
  }
  if (B.gordokDieBonus && B.gordokDieBonus.blue > 0) {
    blueCount += B.gordokDieBonus.blue;
    preRollCallouts.push(['RIVER TERROR!', 'var(--rare)', `Gordok — stolen resources! +${B.gordokDieBonus.blue} bonus die!`, 'blue']);
    log(`<span class="log-ability">Gordok</span> — River Terror! +${B.gordokDieBonus.blue} bonus die this roll.`);
    B.gordokDieBonus.blue = 0;
  }

  // Flame Blade item: when swinging, +1 die
  if (B.flameBladeSwing && B.flameBladeSwing.red) {
    redCount += 1;
    preRollCallouts.push(['FLAME BLADE!', 'var(--rare)', `Flame Blade swinging — +1 die this roll!`, 'red']);
    log(`<span class="log-ability">Flame Blade</span> — swinging! <span class="log-ms">+1 die</span> this roll.`);
  }
  if (B.flameBladeSwing && B.flameBladeSwing.blue) {
    blueCount += 1;
    preRollCallouts.push(['FLAME BLADE!', 'var(--rare)', `Flame Blade swinging — +1 die this roll!`, 'blue']);
    log(`<span class="log-ability">Flame Blade</span> — swinging! <span class="log-ms">+1 die</span> this roll.`);
  }

  // Young Cap (429) — Energize: +1 die per Healing Seed spent this pre-roll
  const ycRed = active(B.red);
  if (ycRed && ycRed.id === 429 && !ycRed.ko && ycRed.youngCapDieBonus > 0) {
    redCount += ycRed.youngCapDieBonus;
    ycRed.youngCapDieBonus = 0;
  }
  const ycBlue = active(B.blue);
  if (ycBlue && ycBlue.id === 429 && !ycBlue.ko && ycBlue.youngCapDieBonus > 0) {
    blueCount += ycBlue.youngCapDieBonus;
    ycBlue.youngCapDieBonus = 0;
  }

  // Kairan (68) — Let's Dance: +1 die from previous round's doubles bonus
  // Guard: only apply the bonus if Kairan is STILL the active ghost — die is personal to Kairan,
  // not the team. If Kairan was KO'd or swapped since earning the bonus, the die is lost.
  if (B.letsDanceBonus && B.letsDanceBonus.red > 0) {
    if (active(B.red).id === 68 && !active(B.red).ko) {
      redCount += B.letsDanceBonus.red;
      preRollCallouts.push(["LET'S DANCE!", 'var(--rare)', `${active(B.red).name} — Last round's doubles! +${B.letsDanceBonus.red} bonus die!`, 'red']);
      log(`<span class="log-ability">${active(B.red).name}</span> — Let's Dance! +${B.letsDanceBonus.red} bonus die from last doubles!`);
    }
    B.letsDanceBonus.red = 0;
  }
  if (B.letsDanceBonus && B.letsDanceBonus.blue > 0) {
    if (active(B.blue).id === 68 && !active(B.blue).ko) {
      blueCount += B.letsDanceBonus.blue;
      preRollCallouts.push(["LET'S DANCE!", 'var(--rare)', `${active(B.blue).name} — Last round's doubles! +${B.letsDanceBonus.blue} bonus die!`, 'blue']);
      log(`<span class="log-ability">${active(B.blue).name}</span> — Let's Dance! +${B.letsDanceBonus.blue} bonus die from last doubles!`);
    }
    B.letsDanceBonus.blue = 0;
  }

  // Lucas (433) — Kindling: +1 die next roll after Miracle resurrection (consumed after use)
  if (B.lucasKindlingBonus && B.lucasKindlingBonus.red > 0) {
    redCount += B.lucasKindlingBonus.red;
    preRollCallouts.push(['KINDLING!', 'var(--rare)', `Lucas — Kindling! +${B.lucasKindlingBonus.red} bonus die!`, 'red']);
    log(`<span class="log-ability">Lucas</span> — Kindling! +${B.lucasKindlingBonus.red} bonus die this roll.`);
    B.lucasKindlingBonus.red = 0;
  }
  if (B.lucasKindlingBonus && B.lucasKindlingBonus.blue > 0) {
    blueCount += B.lucasKindlingBonus.blue;
    preRollCallouts.push(['KINDLING!', 'var(--rare)', `Lucas — Kindling! +${B.lucasKindlingBonus.blue} bonus die!`, 'blue']);
    log(`<span class="log-ability">Lucas</span> — Kindling! +${B.lucasKindlingBonus.blue} bonus die this roll.`);
    B.lucasKindlingBonus.blue = 0;
  }

  // Haywire (78) — Wild Chords: permanent +1 die bonus (awarded once per game on triples, always applied)
  if (B.haywireBonus && B.haywireBonus.red > 0) redCount += B.haywireBonus.red;
  if (B.haywireBonus && B.haywireBonus.blue > 0) blueCount += B.haywireBonus.blue;

  // Pip (418) — Toasted: permanent die removal applied to opponent
  if (B.pipDieRemoval && B.pipDieRemoval.red > 0) redCount = Math.max(1, redCount - B.pipDieRemoval.red);
  if (B.pipDieRemoval && B.pipDieRemoval.blue > 0) blueCount = Math.max(1, blueCount - B.pipDieRemoval.blue);

  // Mable Stadango (446) — Hex: consume die removal from Burn spend (applied to opponent's count)
  // FIX: callout name corrected from "Forest Spirit" to "Mable Stadango"
  if (B.hexDieRemoval && B.hexDieRemoval.red > 0) {
    redCount = Math.max(1, redCount - B.hexDieRemoval.red);
    preRollCallouts.push(['HEX!', 'var(--uncommon)', `Mable Stadango — Hex! Red loses ${B.hexDieRemoval.red} die this roll!`, 'blue']);
    log(`<span class="log-ability">Mable Stadango</span> — Hex! <span class="log-dmg">Red loses ${B.hexDieRemoval.red} die this roll!</span>`);
    B.hexDieRemoval.red = 0;
  }
  if (B.hexDieRemoval && B.hexDieRemoval.blue > 0) {
    blueCount = Math.max(1, blueCount - B.hexDieRemoval.blue);
    preRollCallouts.push(['HEX!', 'var(--uncommon)', `Mable Stadango — Hex! Blue loses ${B.hexDieRemoval.blue} die this roll!`, 'red']);
    log(`<span class="log-ability">Mable Stadango</span> — Hex! <span class="log-dmg">Blue loses ${B.hexDieRemoval.blue} die this roll!</span>`);
    B.hexDieRemoval.blue = 0;
  }

  // Professor Hawking (447) — Wisdom: +2 dice while holding a Moonstone (not consumed)
  [B.red, B.blue].forEach(team => {
    const f = active(team);
    const tName = team === B.red ? 'red' : 'blue';
    if (f.id === 447 && !f.ko && team.resources.moonstone > 0) {
      if (tName === 'red') redCount += 2; else blueCount += 2;
      preRollCallouts.push(['WISDOM!', 'var(--rare)', `${f.name} — Holding Moonstone! +2 dice!`, tName]);
      log(`<span class="log-ability">${f.name}</span> — Wisdom! Holding <span class="log-ms">Moonstone</span> → +2 dice!`);
    }
  });

  // Willow (435) — Joy of Painting: Sideline & In Play: +1 die if you lost the last roll
  [B.red, B.blue].forEach(team => {
    const f = active(team);
    const tNameW = team === B.red ? 'red' : 'blue';
    const hasWillowActive = f.id === 435 && !f.ko;
    const hasWillowSideline = hasSideline(team, 435);
    if ((hasWillowActive || hasWillowSideline) && B.willowLostLast[tNameW]) {
      if (tNameW === 'red') redCount++; else blueCount++;
      const wName = hasWillowActive ? f.name : (getSidelineGhost(team, 435) || {}).name || 'Willow';
      const wLabel = hasWillowActive ? '' : ' (sideline)';
      preRollCallouts.push(['JOY OF PAINTING!', 'var(--ghost-rare)', `${wName}${wLabel} — Lost last roll! +1 die!`, tNameW]);
      log(`<span class="log-ability">${wName}${wLabel}</span> — Joy of Painting! Lost last roll → +1 die!`);
    }
  });

  // Dream Cat (28) — Jinx: consume last round's both-doubles bonus
  if (B.dreamCatBonus && B.dreamCatBonus.red > 0) {
    const dcRed = active(B.red);
    redCount += B.dreamCatBonus.red;
    if (dcRed && dcRed.id === 28 && !dcRed.ko) {
      preRollCallouts.push(['JINX!', 'var(--common)', `${dcRed.name} — Both rolled doubles! +${B.dreamCatBonus.red} bonus die!`, 'red']);
      log(`<span class="log-ability">${dcRed.name}</span> — Jinx! Both doubles → +${B.dreamCatBonus.red} bonus die this round.`);
    }
    B.dreamCatBonus.red = 0;
  }
  if (B.dreamCatBonus && B.dreamCatBonus.blue > 0) {
    const dcBlue = active(B.blue);
    blueCount += B.dreamCatBonus.blue;
    if (dcBlue && dcBlue.id === 28 && !dcBlue.ko) {
      preRollCallouts.push(['JINX!', 'var(--common)', `${dcBlue.name} — Both rolled doubles! +${B.dreamCatBonus.blue} bonus die!`, 'blue']);
      log(`<span class="log-ability">${dcBlue.name}</span> — Jinx! Both doubles → +${B.dreamCatBonus.blue} bonus die this round.`);
    }
    B.dreamCatBonus.blue = 0;
  }

  // Scallywags (19) — Frenzy: consume last round's all-under-4 bonus
  if (B.scallywagsFrenzyBonus && B.scallywagsFrenzyBonus.red > 0) {
    const scRed = active(B.red);
    redCount += B.scallywagsFrenzyBonus.red;
    if (scRed && scRed.id === 19 && !scRed.ko) {
      preRollCallouts.push(['FRENZY!', 'var(--common)', `${scRed.name} — All dice were under 4! +${B.scallywagsFrenzyBonus.red} bonus die!`, 'red']);
      log(`<span class="log-ability">${scRed.name}</span> — Frenzy! All dice under 4 last round → +${B.scallywagsFrenzyBonus.red} bonus die.`);
    }
    B.scallywagsFrenzyBonus.red = 0;
  }
  if (B.scallywagsFrenzyBonus && B.scallywagsFrenzyBonus.blue > 0) {
    const scBlue = active(B.blue);
    blueCount += B.scallywagsFrenzyBonus.blue;
    if (scBlue && scBlue.id === 19 && !scBlue.ko) {
      preRollCallouts.push(['FRENZY!', 'var(--common)', `${scBlue.name} — All dice were under 4! +${B.scallywagsFrenzyBonus.blue} bonus die!`, 'blue']);
      log(`<span class="log-ability">${scBlue.name}</span> — Frenzy! All dice under 4 last round → +${B.scallywagsFrenzyBonus.blue} bonus die.`);
    }
    B.scallywagsFrenzyBonus.blue = 0;
  }

  // Committed Surge: +1 die per surge
  if (B.committed.red.surge > 0) {
    redCount += B.committed.red.surge;
    log(`<span class="log-ability">Red</span> committed <span class="log-ms">${B.committed.red.surge} Surge</span> → +${B.committed.red.surge} dice!`);
    const borisRedG = B.red.ghosts.find(g => g.id === 343 && !g.ko);
    if (borisRedG) {
      const borisRedPre = borisRedG.hp;
      if (hasSideline(B.blue, 59)) {
        // Mr Filbert (59) — Mask Merchant: flip Boris Fortify heal to damage
        borisRedG.hp = Math.max(0, borisRedG.hp - 2);
        if (borisRedG.hp <= 0) { borisRedG.hp = 0; borisRedG.ko = true; borisRedG.killedBy = 59; }
        preRollCallouts.push(['MASK MERCHANT!', 'var(--uncommon)', `Mr Filbert — Fortify cursed! ${borisRedG.name} takes 2 damage! (${borisRedPre}→${borisRedG.hp} HP)`, 'blue']);
        log(`<span class="log-ability">Mr Filbert</span> — Mask Merchant! Boris Fortify flipped to damage. ${borisRedG.name} ${borisRedPre} → ${borisRedG.hp} HP.`);
      } else {
        triggerBorisHook(B.red);
        const oc = borisRedG.hp > borisRedG.maxHp;
        preRollCallouts.push(['FORTIFY!', 'var(--uncommon)', `${borisRedG.name} — Surge spent! +2 HP (${borisRedPre}→${borisRedG.hp}/${borisRedG.maxHp}${oc ? ' · overclocked!' : ''})`, 'red']);
      }
    }
  }
  if (B.committed.blue.surge > 0) {
    blueCount += B.committed.blue.surge;
    log(`<span class="log-ability">Blue</span> committed <span class="log-ms">${B.committed.blue.surge} Surge</span> → +${B.committed.blue.surge} dice!`);
    const borisBlueG = B.blue.ghosts.find(g => g.id === 343 && !g.ko);
    if (borisBlueG) {
      const borisBlueRePre = borisBlueG.hp;
      if (hasSideline(B.red, 59)) {
        // Mr Filbert (59) — Mask Merchant: flip Boris Fortify heal to damage
        borisBlueG.hp = Math.max(0, borisBlueG.hp - 2);
        if (borisBlueG.hp <= 0) { borisBlueG.hp = 0; borisBlueG.ko = true; borisBlueG.killedBy = 59; }
        preRollCallouts.push(['MASK MERCHANT!', 'var(--uncommon)', `Mr Filbert — Fortify cursed! ${borisBlueG.name} takes 2 damage! (${borisBlueRePre}→${borisBlueG.hp} HP)`, 'red']);
        log(`<span class="log-ability">Mr Filbert</span> — Mask Merchant! Boris Fortify flipped to damage. ${borisBlueG.name} ${borisBlueRePre} → ${borisBlueG.hp} HP.`);
      } else {
        triggerBorisHook(B.blue);
        const oc = borisBlueG.hp > borisBlueG.maxHp;
        preRollCallouts.push(['FORTIFY!', 'var(--uncommon)', `${borisBlueG.name} — Surge spent! +2 HP (${borisBlueRePre}→${borisBlueG.hp}/${borisBlueG.maxHp}${oc ? ' · overclocked!' : ''})`, 'blue']);
      }
    }
  }

  // Ice Blade item: when swinging (toggle or committed), +1 die (in addition to post-roll +2 dmg on win)
  if (B.committed.red.zainBlade > 0 || (B.iceBladeSwing && B.iceBladeSwing.red)) {
    if (B.iceBladeForgedPermanent && B.iceBladeForgedPermanent.red) {
      redCount += 1;
      preRollCallouts.push(['ICE BLADE!', 'var(--ghost-rare)', `Ice Blade swinging — +1 die this roll!`, 'red']);
      log(`<span class="log-ability">Ice Blade</span> — swinging! <span class="log-ice">+1 die</span> this roll (and +2 damage on win).`);
    }
  }
  if (B.committed.blue.zainBlade > 0 || (B.iceBladeSwing && B.iceBladeSwing.blue)) {
    if (B.iceBladeForgedPermanent && B.iceBladeForgedPermanent.blue) {
      blueCount += 1;
      preRollCallouts.push(['ICE BLADE!', 'var(--ghost-rare)', `Ice Blade swinging — +1 die this roll!`, 'blue']);
      log(`<span class="log-ability">Ice Blade</span> — swinging! <span class="log-ice">+1 die</span> this roll (and +2 damage on win).`);
    }
  }

  // Katrina (70) — Seeker: before rolling, if Katrina has less HP than the enemy active ghost, gain 1 HP
  // Mr Filbert (59) — Mask Merchant: flip the +1 HP heal to -1 damage when Filbert is on the enemy sideline.
  [B.red, B.blue].forEach(team => {
    const f = active(team);
    if (f.id === 70 && !f.ko) {
      const oppG = team === B.red ? active(B.blue) : active(B.red);
      if (f.hp < oppG.hp) {
        const seekerHpBefore = f.hp;
        const enemyTeamObj = team === B.red ? B.blue : B.red;
        if (hasSideline(enemyTeamObj, 59)) {
          f.hp = Math.max(0, f.hp - 1);
          if (f.hp <= 0) { f.hp = 0; f.ko = true; f.killedBy = 59; }
          preRollCallouts.push(['MASK MERCHANT!', 'var(--uncommon)', `Mr Filbert — Seeker cursed! ${f.name} takes 1 damage! (${seekerHpBefore}→${f.hp} HP)`, team === B.red ? 'blue' : 'red']);
          log(`<span class="log-ability">Mr Filbert</span> — Mask Merchant! Seeker flipped to damage. ${f.name} ${seekerHpBefore} → ${f.hp} HP.`);
        } else {
          f.hp += 1;
          const seekerOver = f.hp > f.maxHp;
          preRollCallouts.push(['SEEKER!', 'var(--rare)', `${f.name} — HP below enemy! +1 HP (${seekerHpBefore}→${f.hp}/${f.maxHp}${seekerOver ? ' · overclocked!' : ''})`, team === B.red ? 'red' : 'blue']);
          log(`<span class="log-ability">${f.name}</span> — Seeker! HP below enemy → +1 HP (${f.hp}/${f.maxHp}${seekerOver ? ' overclocked!' : ''})`);
        }
      }
    }
  });

  // Antoinette (82) — Grace: roll as many dice as your opponent (mirrors opponent's count upward, min base 3)
  // Applied last so all other modifiers (Surge, Piper, Redd, etc.) are already baked into counts
  [B.red, B.blue].forEach(team => {
    const f = active(team);
    const tName = team === B.red ? 'red' : 'blue';
    if (f.id === 82 && !f.ko) {
      const myCount   = tName === 'red' ? redCount  : blueCount;
      const oppCount  = tName === 'red' ? blueCount : redCount;
      if (oppCount > myCount) {
        if (tName === 'red') redCount  = oppCount;
        else                 blueCount = oppCount;
        preRollCallouts.push(['GRACE!', 'var(--rare)', `${f.name} — matching opponent's ${oppCount} dice!`, tName]);
        log(`<span class="log-ability">${f.name}</span> — Grace! Matching opponent's ${oppCount} dice!`);
      }
    }
  });

  // Outlaw (43) — Thief: consume stolen-die penalty from last round (applied AFTER Grace so it can't be mirrored back)
  [B.red, B.blue].forEach(team => {
    const tName = team === B.red ? 'red' : 'blue';
    if (B.outlawStolenDie && B.outlawStolenDie[tName] > 0) {
      // This team's Outlaw removes an enemy die — decrement enemy count
      // intentional: spec says "remove", not "steal" — no transfer to Outlaw; subtract-only is correct
      const enemyTName = tName === 'red' ? 'blue' : 'red';
      if (enemyTName === 'red') redCount = Math.max(1, redCount - B.outlawStolenDie[tName]);
      else blueCount = Math.max(1, blueCount - B.outlawStolenDie[tName]);
      const outF = active(team);
      const enemyF = active(enemyTName === 'red' ? B.red : B.blue);
      preRollCallouts.push(['THIEF!', 'var(--uncommon)', `${outF.name} — removed 1 die from ${enemyF.name}! They roll 1 fewer die!`, tName]);
      log(`<span class="log-ability">${outF.name}</span> — Thief! ${enemyF.name} rolls 1 fewer die this round!`);
      B.outlawStolenDie[tName] = 0;
    }
  });

  // Suspicious Jeff (61) — Snicker: sideline die-theft from last round's win (stacks with Outlaw)
  // Cornelius (45) Antidote blocks the die theft if on the enemy's sideline.
  [B.red, B.blue].forEach(team => {
    const tName = team === B.red ? 'red' : 'blue';
    if (B.jeffSnicker && B.jeffSnicker[tName] > 0) {
      const enemyTName = tName === 'red' ? 'blue' : 'red';
      const enemyTeamObj = enemyTName === 'red' ? B.red : B.blue;
      const cornBlocksJeff = hasSideline(enemyTeamObj, 45);
      if (cornBlocksJeff) {
        const cornF = getSidelineGhost(enemyTeamObj, 45);
        const cornName = cornF ? cornF.name : 'Cornelius';
        preRollCallouts.push(['ANTIDOTE!', 'var(--uncommon)', `${cornName} neutralizes Suspicious Jeff's Snicker — die theft blocked!`, enemyTName]);
        log(`<span class="log-ability">Cornelius</span> — Antidote! Suspicious Jeff's Snicker die theft blocked!`);
      } else {
        if (enemyTName === 'red') redCount = Math.max(1, redCount - B.jeffSnicker[tName]);
        else blueCount = Math.max(1, blueCount - B.jeffSnicker[tName]);
        if (tName === 'red') redCount += B.jeffSnicker[tName];
        else blueCount += B.jeffSnicker[tName];
        const jeffF = getSidelineGhost(team, 61);
        const enemyF = active(enemyTeamObj);
        const jeffName = jeffF ? jeffF.name : 'Suspicious Jeff';
        preRollCallouts.push(['SNICKER!', 'var(--uncommon)', `${jeffName} (sideline) — Win stole 1 die from ${enemyF ? enemyF.name : 'opponent'}! They roll 1 fewer die!`, tName]);
        log(`<span class="log-ability">${jeffName}</span> — Snicker! ${enemyF ? enemyF.name : 'Opponent'} rolls 1 fewer die this round!`);
      }
      B.jeffSnicker[tName] = 0;
    }
  });

  // Hugo (52) — Wreckage: consume die penalty for attacking Hugo last round (applied after Outlaw so both stack correctly)
  [B.red, B.blue].forEach(team => {
    const tName = team === B.red ? 'red' : 'blue';
    if (B.hugoWreckage && B.hugoWreckage[tName] > 0) {
      // This team attacked Hugo — pay the die cost
      if (tName === 'red') redCount = Math.max(1, redCount - B.hugoWreckage[tName]);
      else blueCount = Math.max(1, blueCount - B.hugoWreckage[tName]);
      const hugoF = active(opp(team)); // Hugo is on the opposing team
      const penF = active(team);
      preRollCallouts.push(['WRECKAGE!', 'var(--uncommon)', `${hugoF ? hugoF.name + ' — Wreckage!' : 'Wreckage!'} ${penF.name} rolls 1 fewer die for attacking Hugo!`, tName === 'red' ? 'blue' : 'red']);
      log(`<span class="log-ability">Hugo</span> — Wreckage! ${penF.name} rolls 1 fewer die this round!`);
      B.hugoWreckage[tName] = 0;
    }
  });

  // Floop (20) — Muck: consume die penalty for rolling doubles last round while Floop was watching (stacks with Outlaw/Jeff/Hugo)
  [B.red, B.blue].forEach(team => {
    const tName = team === B.red ? 'red' : 'blue';
    if (B.floopMuck && B.floopMuck[tName] > 0) {
      // This team rolled doubles last round while Floop was the opponent — pay the die cost
      if (tName === 'red') redCount = Math.max(1, redCount - B.floopMuck[tName]);
      else blueCount = Math.max(1, blueCount - B.floopMuck[tName]);
      const floopF = active(opp(team)); // Floop is on the opposing team
      const penF = active(team);
      preRollCallouts.push(['MUCK!', 'var(--common)', `${floopF ? floopF.name + ' — Muck!' : 'Muck!'} ${penF.name} rolled doubles last round — they lose 1 die!`, tName === 'red' ? 'blue' : 'red']);
      log(`<span class="log-ability">${floopF ? floopF.name : 'Floop'}</span> — Muck! ${penF.name} rolled doubles → 1 fewer die this round.`);
      B.floopMuck[tName] = 0;
    }
  });

  // Marcus (57) — Glacial Pounding: consume bonus dice from last round's big hit (applied last so it can't be stolen by Outlaw)
  [B.red, B.blue].forEach(team => {
    const tName = team === B.red ? 'red' : 'blue';
    if (B.marcusGlacialBonus && B.marcusGlacialBonus[tName] > 0) {
      const marF = active(team);
      if (marF && marF.id === 57 && !marF.ko) {
        const bonus = B.marcusGlacialBonus[tName];
        if (tName === 'red') redCount += bonus;
        else blueCount += bonus;
        preRollCallouts.push(['GLACIAL POUNDING!', 'var(--uncommon)', `${marF.name} — Took a big hit! +${bonus} bonus dice this roll!`, tName]);
        log(`<span class="log-ability">${marF.name}</span> — Glacial Pounding! +${bonus} bonus dice from last round's big hit!`);
      }
      B.marcusGlacialBonus[tName] = 0;
    }
  });

  // Logey (26) — Heinous: reduce this team's die count by locked dice from last round
  [B.red, B.blue].forEach(team => {
    const tName = team === B.red ? 'red' : 'blue';
    if (B.logeyLockout && B.logeyLockout[tName] > 0) {
      const locked = B.logeyLockout[tName];
      if (tName === 'red') redCount = Math.max(1, redCount - locked);
      else blueCount = Math.max(1, blueCount - locked);
      const f = active(team);
      const loF = active(opp(team));
      preRollCallouts.push(['HEINOUS!', 'var(--common)', `${f.name} — ${locked} dice locked out by ${loF ? loF.name + "'s" : ''} Heinous! Rolling fewer dice!`, tName === 'red' ? 'blue' : 'red']);
      log(`<span class="log-ability">${f.name}</span> — Heinous lockout! ${locked} dice unavailable this round.`);
      B.logeyLockout[tName] = 0;
    }
  });

  // Fredrick (27) — Careful: when Fredrick is active, opponent may only roll up to 3 dice (applied last so it overrides all bonuses)
  [B.red, B.blue].forEach(team => {
    const fredF = active(team);
    if (fredF && fredF.id === 27 && !fredF.ko) {
      const enemyTName = (team === B.red) ? 'blue' : 'red';
      const currentEnemyCount = enemyTName === 'red' ? redCount : blueCount;
      if (currentEnemyCount > 3) {
        if (enemyTName === 'red') redCount = 3;
        else blueCount = 3;
        const enemyF = active(team === B.red ? B.blue : B.red);
        preRollCallouts.push(['CAREFUL!', 'var(--common)', `${fredF.name} — Careful! ${enemyF ? enemyF.name : 'Opponent'} capped at 3 dice!`, enemyTName === 'red' ? 'blue' : 'red']);
        log(`<span class="log-ability">${fredF.name}</span> — Careful! Opponent capped at 3 dice this round.`);
      }
    }
  });

  // Patrick (10) — Stone Form: "Don't roll." Forced LAST so no other modifier restores dice.
  // With 0 dice, classify returns type:'none' which auto-loses to any real roll. The existing
  // Stone Form singles-counter at resolveRound ~8055 still fires: when opponent rolled singles,
  // Patrick negates the damage and deals 3 back; other roll types deal normal damage to Patrick.
  [B.red, B.blue].forEach(team => {
    const f = active(team);
    const tName = team === B.red ? 'red' : 'blue';
    if (f.id === 10 && !f.ko) {
      if (tName === 'red') redCount = 0;
      else blueCount = 0;
      preRollCallouts.push(['STONE FORM!', 'var(--common)', `${f.name} — Don't roll! Singles → negate + 3 counter!`, tName]);
      log(`<span class="log-ability">${f.name}</span> — Stone Form! Doesn't roll this round.`);
    }
  });

  // Late pre-roll KO guard — Boris Fortify and Katrina Seeker run AFTER the early preRollKO
  // check at line 6070, so a Filbert (59) curse that KOs the active ghost during those blocks
  // would fall through to the roll phase with a dead ghost. This second check mirrors the
  // early guard exactly: flush callouts → ko-pause → handleKOs().
  const latePreRollKO = [B.red, B.blue].some(t => active(t).ko);
  if (latePreRollKO && preRollCallouts.length > 0) {
    B.phase = 'ko-pause';
    preRollCallouts.forEach((c, i) => {
      setTimeout(() => showAbilityCallout(c[0], c[1], c[2], c[3]), i * 1500);
    });
    refundCommitted();
    setTimeout(() => handleKOs(), preRollCallouts.length * 1500);
    return;
  }
  if (latePreRollKO && handleKOs()) {
    refundCommitted();
    return;
  }

  // Store pre-roll data for per-click rolling
  B.preRoll = {
    red: { count: redCount, override: hankOverride.red, dice: null },
    blue: { count: blueCount, override: hankOverride.blue, dice: null }
  };

  // If Timber pending, update the stored counts reference so modal callback can adjust
  if (B.timberPending) {
    B.timberPending.preRollCalloutCount = preRollCallouts.length;
  }

  // Drain pre-roll callouts sequentially — each plays for 1.4s before the next fires
  preRollCallouts.forEach((c, i) => {
    setTimeout(() => showAbilityCallout(c[0], c[1], c[2], c[3]), i * 1500);
  });

  renderBattle();
  return preRollCallouts.length; // caller uses this to defer dice until all callouts clear
}

// ========================================
// POST-ROLL TRIGGERS (split out for staged timing)
// ========================================
function doPostRollAndResolve(redDice, blueDice) {
  // Queue post-roll ability callouts so they play one at a time
  abilityQueue = [];
  abilityQueueMode = true;

  // Shade's Shadow (205) — MOVED TO PRE-ROLL (doPreRollSetup)

  // Hank (207) — each 4 rolled: gain 1 Lucky Stone (Tremor)
  [B.red, B.blue].forEach(team => {
    const f = active(team);
    const dice = team === B.red ? redDice : blueDice;
    const tNameHank = team === B.red ? 'red' : 'blue';
    if (f.id === 207 && !f.ko) {
      const fours = countVal(dice, 4);
      if (fours > 0) {
        const _tremFours = fours;
        const _tremTeam = team;
        const _tremName = f.name;
        queueAbility('TREMOR!', 'var(--common)', `${f.name} — rolled ${fours} four${fours>1?'s':''}! +${fours} Lucky Stone${fours>1?'s':''}!`, () => {
          _tremTeam.resources.luckyStone += _tremFours;
          log(`<span class="log-ability">${_tremName}</span> — Tremor! Gained <span class="log-ms">${_tremFours} Lucky Stone${_tremFours>1?'s':''}</span>!`);
          renderBattle();
        }, tNameHank);
        checkKnightEffects(tNameHank, f.name);
        if (hasSideline(opp(team), 33)) {
          const _sandOpp = opp(team);
          const _sandTotal = _sandOpp.resources.luckyStone + fours;
          queueAbility('DEPENDABLE!', 'var(--common)', `Sandwiches — mirrors Tremor! +${fours} Lucky Stone${fours>1?'s':''}! (${_sandTotal} total)`, () => { _sandOpp.resources.luckyStone += _tremFours; renderBattle(); }, tNameHank === 'red' ? 'blue' : 'red');
        }
      }
    }
  });

  // Selene (305) — doubles: choose 1 Healing Seed OR 2 Lucky Stones (deferred modal)
  [B.red, B.blue].forEach(team => {
    const f = active(team);
    const dice = team === B.red ? redDice : blueDice;
    const tNameSel = team === B.red ? 'red' : 'blue';
    if (f.id === 305 && !f.ko && classify(dice).type === 'doubles') {
      B.selenePending = { team, tName: tNameSel };
    }
  });

  // Natalia (327) — even doubles (2s, 4s, 6s): gain 2 Moonstones
  [B.red, B.blue].forEach(team => {
    const f = active(team);
    const dice = team === B.red ? redDice : blueDice;
    const tNameNat = team === B.red ? 'red' : 'blue';
    if (f.id === 327 && !f.ko && hasEvenDoubles(dice)) {
      const _natTeam = team;
      const _natName = f.name;
      const _natSandOpp = opp(team);
      const _natSandTotal = _natSandOpp.resources.moonstone + 2;
      queueAbility('MATERIALIZATION!', 'var(--ghost-rare)', `${f.name} — Even doubles! Gained 2 Moonstones!`, () => {
        _natTeam.resources.moonstone += 2;
        log(`<span class="log-ability">${_natName}</span> — Materialization! Even doubles → gained <span class="log-ms">2 Moonstones</span>!`);
        renderBattle();
      }, tNameNat);
      checkKnightEffects(tNameNat, f.name);
      if (hasSideline(opp(team), 33)) {
        queueAbility('DEPENDABLE!', 'var(--common)', `Sandwiches — mirrors Materialization! +2 Moonstones! (${_natSandTotal} total)`, () => { _natSandOpp.resources.moonstone += 2; renderBattle(); }, tNameNat === 'red' ? 'blue' : 'red');
      }
    }
  });

  // Kaplan (308) — when OPPONENT rolls doubles: gain 1 Healing Seed
  [B.red, B.blue].forEach(team => {
    const f = active(team);
    const oppDice = team === B.red ? blueDice : redDice;
    const tNameKap = team === B.red ? 'red' : 'blue';
    if (f.id === 308 && !f.ko && classify(oppDice).type === 'doubles') {
      const _kapTeam = team;
      const _kapName = f.name;
      const _kapSandOpp = opp(team);
      const _kapSandTotal = _kapSandOpp.resources.healingSeed + 1;
      queueAbility('POLLINATE!', 'var(--uncommon)', `${f.name} — opponent's doubles = free Healing Seed!`, () => {
        _kapTeam.resources.healingSeed++;
        log(`<span class="log-ability">${_kapName}</span> — Pollinate! Opponent rolled doubles → gained <span class="log-ms">1 Healing Seed</span>!`);
        renderBattle();
      }, tNameKap);
      checkKnightEffects(tNameKap, f.name);
      if (hasSideline(opp(team), 33)) {
        queueAbility('DEPENDABLE!', 'var(--common)', `Sandwiches — mirrors Pollinate! +1 Healing Seed! (${_kapSandTotal} total)`, () => { _kapSandOpp.resources.healingSeed++; renderBattle(); }, tNameKap === 'red' ? 'blue' : 'red');
      }
    }
  });

  // Gom Gom Gom (440) — REMOVED from post-roll (moved to WIN-path only in v685)

  // Captain James (443) — Final Strike: triples+ → gain 2 Sacred Fires (win or lose)
  [B.red, B.blue].forEach(team => {
    const f = active(team);
    const dice = team === B.red ? redDice : blueDice;
    const tNameCJ = team === B.red ? 'red' : 'blue';
    if (f.id === 443 && !f.ko && ['triples','quads','penta'].includes(classify(dice).type)) {
      const _cjTeam = team;
      const _cjName = f.name;
      queueAbility('FINAL STRIKE!', 'var(--rare)', `${f.name} — Triples! +2 Sacred Fires!`, () => {
        _cjTeam.resources.fire += 2;
        log(`<span class="log-ability">${_cjName}</span> — Final Strike! Triples+ → gained <span class="log-ms">2 Sacred Fires</span>!`);
        renderBattle();
      }, tNameCJ);
      checkKnightEffects(tNameCJ, f.name);
    }
  });

  // Champ (438) — Thrill (B): +1 Surge on any doubles+ (either team)
  [B.red, B.blue].forEach(team => {
    const f = active(team);
    const tNameChamp = team === B.red ? 'red' : 'blue';
    if (f.id === 438 && !f.ko) {
      const redRoll = classify(redDice);
      const blueRoll = classify(blueDice);
      const eitherDoubles = ['doubles','triples','quads','penta'].includes(redRoll.type) || ['doubles','triples','quads','penta'].includes(blueRoll.type);
      if (eitherDoubles) {
        const _champTeam = team;
        const _champName = f.name;
        queueAbility('THRILL!', 'var(--uncommon)', `${f.name} — Doubles detected! +1 Surge!`, () => {
          _champTeam.resources.surge++;
          log(`<span class="log-ability">${_champName}</span> — Thrill! Doubles → gained <span class="log-ms">1 Surge</span>!`);
          renderBattle();
        }, tNameChamp);
        checkKnightEffects(tNameChamp, f.name);
      }
    }
  });

  abilityQueueMode = false;

  // Drain post-roll callouts sequentially, THEN check moonstone/KOs
  const postRollDone = () => {
    if (handleKOs()) return;

    // ========================================
    // MOONSTONE CHECK
    // ========================================
    B.pendingResolve = { redDice, blueDice, redUsedMs:false, blueUsedMs:false };

  // Only offer moonstones that existed BEFORE this round (not gained during roll)
  const redMsAvail = B.msAvailable ? B.msAvailable.red : 0;
  const blueMsAvail = B.msAvailable ? B.msAvailable.blue : 0;

    // Cross-type simultaneous: one team has exactly MS, other has exactly LS
    // (saves ~5s when neither acts vs the old 5s+5s sequential wait)
    const _redLsCtx = B.lsAvailable ? B.lsAvailable.red : 0;
    const _blueLsCtx = B.lsAvailable ? B.lsAvailable.blue : 0;
    const _redHasLS = _redLsCtx > 0 && B.red.resources.luckyStone > 0;
    const _blueHasLS = _blueLsCtx > 0 && B.blue.resources.luckyStone > 0;
    const _redHasMS  = redMsAvail > 0 && B.red.resources.moonstone > 0;
    const _blueHasMS = blueMsAvail > 0 && B.blue.resources.moonstone > 0;

    if (_redHasMS && _blueHasLS && !_blueHasMS && !_redHasLS) {
      startCrossTypeSpecialsWindow('red', 'blue');
      return;
    }
    if (_blueHasMS && _redHasLS && !_redHasMS && !_blueHasLS) {
      startCrossTypeSpecialsWindow('blue', 'red');
      return;
    }

    // Both teams have Moonstone — show simultaneously (saves up to 5s vs 5s+5s sequential)
    if (_redHasMS && _blueHasMS) {
      startSimultaneousMoonstoneWindows();
      return;
    }

    // Same-team unified specials: one team has BOTH Moonstone + Lucky Stone
    // Show a single reaction window with both resource tiles highlighted, one shared timer.
    if (_redHasMS && _redHasLS) {
      startSameTeamSpecialsWindow('red', () => {
        // After red's unified window, check if blue has anything
        if (_blueHasLS) checkLuckyStones();
        else resolveRound();
      });
      return;
    }
    if (_blueHasMS && _blueHasLS) {
      startSameTeamSpecialsWindow('blue', () => {
        // After blue's unified window, check if red has anything
        if (_redHasLS) checkLuckyStones();
        else resolveRound();
      });
      return;
    }

  if (_redHasMS) {
    B.phase = 'moonstone-red';
    showMoonstoneChoice('red', redDice);
    return;
  }
  if (_blueHasMS) {
    B.phase = 'moonstone-blue';
    showMoonstoneChoice('blue', blueDice);
    return;
  }

    checkLuckyStones();
  };

  // Drain post-roll ability callouts, then check for KOs (Shade's Shadow can KO during queue),
  // then continue to moonstone/lucky stones
  drainAbilityQueue(() => {
    if (handleKOs()) return; // Shade's Shadow or other queued ability caused a KO — swap flow takes over

    // Jackson (50) — Regrow: post-roll HP-for-reroll modal (before moonstone)
    // → then Sonya (69) — Mesmerize: change one die to 2 (free, once per round)
    // → then Jeanie (90) — Hidden Treasure: sideline force-opponent-reroll (once per game)
    // → then Selene → postRollDone
    const afterJeanie = () => {
      if (B.selenePending) {
        B.selenePending._continue = postRollDone;
        showSeleneModal();
        return;
      }
      postRollDone();
    };
    const afterSonya = () => {
      // Jeanie (90) chain: offer Red first, then Blue, then continue
      if (hasSideline(B.red, 90) && B.jeanieUsed && !B.jeanieUsed.red) {
        checkJeanieHiddenTreasure('red', () => {
          if (hasSideline(B.blue, 90) && B.jeanieUsed && !B.jeanieUsed.blue) {
            checkJeanieHiddenTreasure('blue', afterJeanie);
          } else {
            afterJeanie();
          }
        });
        return;
      }
      if (hasSideline(B.blue, 90) && B.jeanieUsed && !B.jeanieUsed.blue) {
        checkJeanieHiddenTreasure('blue', afterJeanie);
        return;
      }
      afterJeanie();
    };
    const afterJackson = () => {
      // Sonya (69) — Mesmerize chain: red first, then blue, then continue
      const sRed  = active(B.red);
      const sBlue = active(B.blue);
      if (sRed  && sRed.id  === 69 && !sRed.ko  && B.sonyaUsedThisRound && !B.sonyaUsedThisRound.red) {
        checkSonyaMesmerize('red',  afterSonya); return;
      }
      if (sBlue && sBlue.id === 69 && !sBlue.ko && B.sonyaUsedThisRound && !B.sonyaUsedThisRound.blue) {
        checkSonyaMesmerize('blue', afterSonya); return;
      }
      afterSonya();
    };
    // Dark Wing (76) — Precision: reroll all dice if not doubles
    const afterDarkWing = () => {
      const jRed  = active(B.red);
      const jBlue = active(B.blue);
      if (jRed  && jRed.id  === 50 && !jRed.ko  && jRed.hp  >= 2 && B.jacksonUsedThisRound && !B.jacksonUsedThisRound.red) {
        checkJacksonRegrow('red',  [...B.redDice],  afterJackson); return;
      }
      if (jBlue && jBlue.id === 50 && !jBlue.ko && jBlue.hp >= 2 && B.jacksonUsedThisRound && !B.jacksonUsedThisRound.blue) {
        checkJacksonRegrow('blue', [...B.blueDice], afterJackson); return;
      }
      afterJackson();
    };
    // Drizzle (328) — Rain Dance fires AFTER Tommy (before Dark Wing), then DW, then Jackson
    const afterDrizzle = () => {
      const dwRed  = active(B.red);
      const dwBlue = active(B.blue);
      if (dwRed  && dwRed.id  === 76 && !dwRed.ko  && B.darkWingUsedThisGame && !B.darkWingUsedThisGame.red) {
        checkDarkWingPrecision('red',  afterDarkWing); return;
      }
      if (dwBlue && dwBlue.id === 76 && !dwBlue.ko && B.darkWingUsedThisGame && !B.darkWingUsedThisGame.blue) {
        checkDarkWingPrecision('blue', afterDarkWing); return;
      }
      afterDarkWing();
    };
    // Tommy Salami (30) — Regulator: fires FIRST so 5s/6s are suppressed before Drizzle, Dark Wing, etc.
    checkTommyRegulator(afterDrizzle);
  });
}

// Moonstone — timed window like Lucky Stone (3s countdown, click die to change)
let msCountdownTimer = null;

function showMoonstoneChoice(team, dice) {
  renderDice(B.redDice, B.blueDice);
  renderBattle();
  B.pendingMoonstone = { team, dice: [...dice], dieIndex:null, phase:'pick-resource' };

  const teamLabel = team.charAt(0).toUpperCase() + team.slice(1);
  narrate(`<b class="${team}-text">${teamLabel}</b> has a <b style="color:var(--moonstone)">Moonstone!</b>&nbsp;Click it to use!`);
  log(`<span class="log-ms">${team.toUpperCase()} has a Moonstone!</span> Click it to use — 5 seconds!`);

  const diceEl = document.getElementById(team + '-dice');
  const resEl = document.getElementById(team + '-resources');

  // Scroll dice area into view so the Moonstone UI is visible
  const arenaEl = document.getElementById('arena') || diceEl;
  arenaEl.scrollIntoView({ behavior:'smooth', block:'center' });
  const msEl = resEl.querySelector('.res-tile.moonstone') || diceEl;

  // Highlight the Moonstone resource — player clicks IT first
  if (msEl && msEl !== diceEl) {
    msEl.classList.add('rerollable');
    msEl.style.cursor = 'pointer';
    msEl.onclick = () => {
      // Player clicked Moonstone — clear the countdown and start fresh for die picking
      clearInterval(msCountdownTimer);
      clearMsCountdown(msEl);
      msEl.classList.remove('rerollable');
      msEl.onclick = null;
      B.pendingMoonstone.phase = 'pick-die';
      narrate(`<b class="${team}-text">${teamLabel}</b> — pick a die to change!`);
      const dieDivs = diceEl.querySelectorAll('.die');
      dieDivs.forEach((d, i) => {
        d.classList.add('rerollable');
        d.style.borderColor = 'var(--moonstone)';
        d.onclick = () => pickMsDie(i);
      });
      // Fresh 5s countdown for picking which die
      let pickRemaining = 5;
      showLsCountdown(diceEl, pickRemaining);
      msCountdownTimer = setInterval(() => {
        pickRemaining--;
        if (pickRemaining <= 0) {
          clearInterval(msCountdownTimer);
          clearMsCountdown(diceEl);
          clearDiceClickable(team);
          skipMoonstone();
        } else {
          showLsCountdown(diceEl, pickRemaining);
        }
      }, 1000);
    };
  } else {
    // No resource tile — fall back to direct dice click
    B.pendingMoonstone.phase = 'pick-die';
    const dieDivs = diceEl.querySelectorAll('.die');
    dieDivs.forEach((d, i) => {
      d.classList.add('rerollable');
      d.style.borderColor = 'var(--moonstone)';
      d.onclick = () => pickMsDie(i);
    });
  }

  // Start 5s countdown — auto-skip if not used
  let remaining = 5;
  showLsCountdown(msEl, remaining);

  clearInterval(msCountdownTimer);
  msCountdownTimer = setInterval(() => {
    remaining--;
    if (remaining <= 0) {
      clearInterval(msCountdownTimer);
      clearMsCountdown(msEl);
      clearDiceClickable(team);
      if (msEl) { msEl.classList.remove('rerollable'); msEl.onclick = null; }
      skipMoonstone();
    } else {
      showLsCountdown(msEl, remaining);
    }
  }, 1000);
}

function clearMsCountdown(el) {
  if (el) { const cd = el.querySelector('.reroll-countdown'); if (cd) cd.remove(); }
}

function pickMsDie(idx) {
  if (!B || !B.pendingMoonstone || B.pendingMoonstone.phase !== 'pick-die') return;
  clearInterval(msCountdownTimer);
  msCountdownTimer = null; // prevent any queued interval callbacks from firing
  const team = B.pendingMoonstone.team;
  B.pendingMoonstone.dieIndex = idx;
  B.pendingMoonstone.phase = 'pick-value';

  // Clear die clickability and countdowns immediately
  clearDiceClickable(team);
  const diceEl = document.getElementById(team + '-dice');
  const resEl = document.getElementById(team + '-resources');
  const msEl = resEl.querySelector('.res-tile.moonstone') || diceEl;
  clearMsCountdown(msEl);
  clearMsCountdown(diceEl);
  document.querySelectorAll('.reroll-countdown').forEach(el => el.remove());

  narrate(`Die ${idx+1} selected — pick a new value!`);

  // Show value picker immediately — no delay that can race with skip timers
  const el = document.getElementById('msPicker');
  document.getElementById('msStep1').innerHTML = `<p style="color:var(--text2);font-size:13px;">Pick new value for die ${idx+1}:</p>`;
  const step2 = document.getElementById('msStep2');
  step2.style.display = 'flex';
  step2.innerHTML = [1,2,3,4,5,6].map(v => `<div class="ms-die-option" onclick="pickMsValue(${v})">${v}</div>`).join('');
  el.classList.add('active');

  // Scroll into view
  el.scrollIntoView({ behavior:'smooth', block:'center' });

  // Auto-skip after 7s if no value picked
  let remaining = 7;
  showLsCountdown(el, remaining);
  msCountdownTimer = setInterval(() => {
    remaining--;
    if (remaining <= 0) {
      clearInterval(msCountdownTimer);
      el.classList.remove('active');
      clearMsCountdown(el);
      skipMoonstone();
    } else {
      showLsCountdown(el, remaining);
    }
  }, 1000);
}

function pickMsValue(val) {
  clearInterval(msCountdownTimer);
  const ms = B.pendingMoonstone;
  if (!ms) return;
  const team = ms.team;
  const t = B[team];
  const f = active(t);

  const el = document.getElementById('msPicker');
  el.classList.remove('active');
  clearMsCountdown(el);

  // Benjamin (203) — Magic Touch: once per turn, don't decrement moonstone
  let magicTouchFired = false;
  if (f.id === 203 && !f.usedMagicTouch) {
    f.usedMagicTouch = true;
    magicTouchFired = true;
    showAbilityCallout('MAGIC TOUCH!', 'var(--moonstone)', `${f.name} — Moonstone used without discarding!`, team);
    log(`<span class="log-ability">${f.name}</span> — Magic Touch! Used Moonstone without discarding it!`);
  } else {
    t.resources.moonstone--;
    playSfx('sfxSpecial', 0.5);
  }

  ms.dice[ms.dieIndex] = val;
  ms.dice.sort((a,b)=>a-b);

  if (team==='red') B.pendingResolve.redDice = ms.dice;
  else B.pendingResolve.blueDice = ms.dice;

  B.redDice = B.pendingResolve.redDice;
  B.blueDice = B.pendingResolve.blueDice;
  renderDice(B.redDice, B.blueDice);

  const teamLabel = team.charAt(0).toUpperCase() + team.slice(1);
  log(`<span class="log-ms">Moonstone used!</span> ${team.toUpperCase()} changed die to ${val} → [${ms.dice.join(', ')}]`);
  narrate(`<b style="color:var(--moonstone)">Moonstone!</b>&nbsp;<b class="${team}-text">${teamLabel}</b> changes die to <b class="gold">${val}</b>! → [${ms.dice.join(', ')}]`);
  B.pendingMoonstone = null;

  // Bigsby (424) — Omen: if Bigsby is the active ghost when a Moonstone is used,
  // Bigsby MUST be sacrificed and replaced with Doom (id 112). Mandatory transformation.
  if (f.id === 424 && !f.ko) {
    const g = f; // mutate the ghost object in-place
    // Preserve original identity for MVP/results/resurrection/standings
    g.originalId = g.id;
    g.originalName = g.name;
    g.originalArt = g.art;
    g.originalMaxHp = g.maxHp;
    g.originalAbility = g.ability;
    g.originalAbilityDesc = g.abilityDesc;
    g.originalRarity = g.rarity;
    g.id = 112; g.name = "Doom"; g.maxHp = 7; g.hp = 7;
    g.ability = "Fiendship"; g.abilityDesc = "+2 bonus damage!";
    g.art = "../testroom/art/originals/doom.jpg"; g.rarity = "legendary"; g.ko = false;
    queueAbility('OMEN!', 'var(--legendary)', 'Bigsby sacrifices himself — DOOM rises!', null, team);
    log(`<span class="log-ability">Bigsby</span> — Omen! <span class="log-dmg">DOOM has arrived!</span>`);
    renderBattle();
  }

  // When Magic Touch fired, showAbilityCallout is on screen for 1400ms — wait 1600ms
  // so the splash fully clears before the next picker / Lucky Stones appear.
  // Without Magic Touch, only a visual dice update happened — 1200ms is enough.
  const msPostDelay = magicTouchFired ? 1600 : 1200;

  // Pause to let the changed dice register visually before continuing
  setTimeout(() => {
    // Check if other team also has moonstone (pre-round only)
    const blueMsLeft = B.msAvailable ? B.msAvailable.blue : 0;
    if (team==='red' && blueMsLeft > 0 && B.blue.resources.moonstone > 0) {
      B.phase = 'moonstone-blue';
      showMoonstoneChoice('blue', B.blueDice);
      return;
    }

    // Cross-type window callback: after MS resolves, offer LS to the other team
    if (B.afterMoonstoneCallback) {
      const _cb = B.afterMoonstoneCallback;
      delete B.afterMoonstoneCallback;
      _cb();
      return;
    }

    checkLuckyStones();
  }, msPostDelay);
}

function skipMoonstone() {
  if (!B.pendingMoonstone) return;
  const team = B.pendingMoonstone.team;
  clearInterval(msCountdownTimer);
  document.getElementById('msPicker').classList.remove('active');
  clearDiceClickable(team);
  log(`<span style="color:var(--text2)">${team.toUpperCase()} holds their Moonstone.</span>`);
  B.pendingMoonstone = null;

  const blueMsSkip = B.msAvailable ? B.msAvailable.blue : 0;
  if (team==='red' && blueMsSkip > 0 && B.blue.resources.moonstone > 0) {
    B.phase = 'moonstone-blue';
    showMoonstoneChoice('blue', B.blueDice);
    return;
  }
  if (B.afterMoonstoneCallback) {
    const _cb = B.afterMoonstoneCallback;
    delete B.afterMoonstoneCallback;
    _cb();
    return;
  }
  checkLuckyStones();
}

// ============================================================
// SIMULTANEOUS MOONSTONE WINDOW
// Both teams have a Moonstone — show both tiles highlighted at once.
// Shared 5s countdown. Whoever clicks first goes; the other follows.
// If Red acts first → existing red→blue sequential chain handles Blue.
// If Blue acts first → afterMoonstoneCallback offers Red afterward.
// If neither acts in 5s → both skip → checkLuckyStones().
// Saves up to 5s per round vs the old 5s+5s sequential wait.
// ============================================================
function startSimultaneousMoonstoneWindows() {
  B.phase = 'moonstone-shared';
  narrate(`<b class="red-text">Red</b> and <b class="blue-text">Blue</b> both have a <b style="color:var(--moonstone)">Moonstone!</b> Click yours to use it!`);
  log(`<span class="log-ms">Both teams have Moonstones!</span> Click yours to use — 5 seconds!`);

  const redResEl = document.getElementById('red-resources');
  const blueResEl = document.getElementById('blue-resources');
  const redMsTile  = redResEl  && redResEl.querySelector('.res-tile.moonstone');
  const blueMsTile = blueResEl && blueResEl.querySelector('.res-tile.moonstone');

  const state = { closed: false };

  const closeShared = () => {
    if (state.closed) return;
    state.closed = true;
    clearInterval(lsSharedTimer); lsSharedTimer = null;
    [redMsTile, blueMsTile].forEach(tile => {
      if (!tile) return;
      tile.classList.remove('rerollable');
      tile.onclick = null;
      tile.style.cursor = '';
    });
    document.querySelectorAll('.ls-shared-cd').forEach(el => el.remove());
  };

  const updateBadges = (r) => {
    [redMsTile, blueMsTile].forEach(tile => {
      if (!tile) return;
      let cd = tile.querySelector('.ls-shared-cd');
      if (!cd) {
        cd = document.createElement('div');
        cd.className = 'reroll-countdown ls-shared-cd';
        tile.style.position = 'relative';
        tile.appendChild(cd);
      }
      cd.textContent = r;
    });
  };

  let remaining = 5;
  updateBadges(remaining);
  clearInterval(lsSharedTimer); lsSharedTimer = null;
  lsSharedTimer = setInterval(() => {
    remaining--;
    if (remaining <= 0 || state.closed) {
      clearInterval(lsSharedTimer); lsSharedTimer = null;
      if (!state.closed) {
        closeShared();
        log(`<span style="color:var(--text2)">Both teams passed on their Moonstones.</span>`);
        checkLuckyStones();
      }
    } else {
      updateBadges(remaining);
    }
  }, 1000);

  // Red tile click — Red goes first; existing red→blue chain in skipMoonstone/pickMsValue
  // automatically offers Blue afterward (no afterMoonstoneCallback needed).
  if (redMsTile) {
    redMsTile.classList.add('rerollable');
    redMsTile.style.cursor = 'pointer';
    redMsTile.onclick = () => {
      if (state.closed) return;
      closeShared();
      showMoonstoneChoice('red', B.pendingResolve.redDice || B.redDice);
    };
  }

  // Blue tile click — Blue goes first; afterMoonstoneCallback offers Red afterward.
  // Zero out B.msAvailable.blue before showing Red's window so the red→blue chain
  // in skipMoonstone/pickMsValue doesn't re-offer Blue (she already had her window).
  if (blueMsTile) {
    blueMsTile.classList.add('rerollable');
    blueMsTile.style.cursor = 'pointer';
    blueMsTile.onclick = () => {
      if (state.closed) return;
      closeShared();
      showMoonstoneChoice('blue', B.pendingResolve.blueDice || B.blueDice);
      B.afterMoonstoneCallback = () => {
        delete B.afterMoonstoneCallback;
        const redMsLeft = B.msAvailable ? B.msAvailable.red : 0;
        if (redMsLeft > 0 && B.red.resources.moonstone > 0) {
          if (B.msAvailable) B.msAvailable.blue = 0; // prevent double-offer of Blue
          showMoonstoneChoice('red', B.redDice);
          // After Red: skipMoonstone/pickMsValue see Blue=0 → fall to checkLuckyStones ✓
        } else {
          checkLuckyStones();
        }
      };
    };
  }
}

// ============================================================
// SAME-TEAM UNIFIED SPECIALS WINDOW
// One team has BOTH Moonstone + Lucky Stone(s).
// Show a single reaction window with both tiles highlighted, one shared timer.
// Player can use Moonstone once AND Lucky Stones multiple times, all in the same window.
// Timer resets briefly after each action (3s extension).
// ============================================================
function startSameTeamSpecialsWindow(team, finalCallback) {
  B.phase = 'specials-unified-' + team;
  const tLabel = team.charAt(0).toUpperCase() + team.slice(1);
  narrate(`<b class="${team}-text">${tLabel}</b> has a <b style="color:var(--moonstone)">Moonstone</b> and a <b class="gold">Lucky Stone!</b> Click either to use!`);

  const dice = team === 'red' ? B.pendingResolve.redDice : B.pendingResolve.blueDice;
  const diceEl = document.getElementById(team + '-dice');
  const resEl = document.getElementById(team + '-resources');
  const msTile = resEl && resEl.querySelector('.res-tile.moonstone');
  const lsTile = resEl && resEl.querySelector('.res-tile.luckyStone');

  const state = { closed: false, msUsed: false, picking: false, lsUsedCount: 0 };
  let sharedTimer = null;

  // Helper to get fresh DOM refs (renderBattle rebuilds innerHTML, stale refs break)
  const getMsTile = () => { const el = document.getElementById(team + '-resources'); return el && el.querySelector('.res-tile.moonstone'); };
  const getLsTile = () => { const el = document.getElementById(team + '-resources'); return el && el.querySelector('.res-tile.luckyStone'); };

  const updateBadge = (tile, val) => {
    if (!tile) return;
    let cd = tile.querySelector('.unified-cd');
    if (!cd) { cd = document.createElement('div'); cd.className = 'reroll-countdown unified-cd'; tile.style.position = 'relative'; tile.appendChild(cd); }
    cd.textContent = val;
    cd.style.animation = 'none'; requestAnimationFrame(() => { cd.style.animation = ''; });
  };
  const updateAllBadges = (val) => {
    const ms = getMsTile(); const ls = getLsTile();
    if (!state.msUsed && ms && ms.classList.contains('rerollable')) updateBadge(ms, val);
    if (ls && ls.classList.contains('rerollable')) updateBadge(ls, val);
  };
  const clearAllBadges = () => { document.querySelectorAll('.unified-cd').forEach(el => el.remove()); };

  const closeWindow = () => {
    if (state.closed) return;
    state.closed = true;
    clearInterval(sharedTimer); sharedTimer = null;
    clearAllBadges();
    const ms = getMsTile(); const ls = getLsTile();
    if (ms) { ms.classList.remove('rerollable'); ms.onclick = null; ms.style.cursor = ''; clearMsCountdown(ms); }
    if (ls) { ls.classList.remove('rerollable'); ls.onclick = null; ls.style.cursor = ''; }
    clearDiceClickable(team);
    document.querySelectorAll('.reroll-countdown').forEach(el => el.remove());
    finalCallback();
  };

  const startTimer = (secs) => {
    clearInterval(sharedTimer); sharedTimer = null;
    clearAllBadges();
    let remaining = secs;
    updateAllBadges(remaining);
    sharedTimer = setInterval(() => {
      remaining--;
      if (remaining <= 0 || state.closed) {
        clearInterval(sharedTimer); sharedTimer = null;
        if (!state.closed) {
          log(`<span style="color:var(--text2)">${team.toUpperCase()} specials window expired.</span>`);
          closeWindow();
        }
      } else {
        updateAllBadges(remaining);
      }
    }, 1000);
  };

  // Check if LS is still available and re-activate tile (with onclick re-bound)
  const refreshLsTile = () => {
    const ls = getLsTile();
    const lsAvail = B.lsAvailable ? B.lsAvailable[team] : 0;
    if (lsAvail > 0 && B[team].resources.luckyStone > 0 && ls) {
      ls.classList.add('rerollable');
      ls.style.cursor = 'pointer';
      ls.onclick = lsTileClick; // re-bind the click handler
    } else if (ls) {
      ls.classList.remove('rerollable');
      ls.onclick = null;
      ls.style.cursor = '';
    }
  };

  // Check if any action is still available, if not close
  const checkStillAvailable = () => {
    const hasMs = !state.msUsed && B[team].resources.moonstone > 0;
    const lsAvail = B.lsAvailable ? B.lsAvailable[team] : 0;
    const hasLs = lsAvail > 0 && B[team].resources.luckyStone > 0;
    if (!hasMs && !hasLs) {
      setTimeout(closeWindow, 400);
      return false;
    }
    return true;
  };

  // ─── Moonstone tile click ───
  const msTileClick = () => {
      if (state.closed || state.picking || state.msUsed) return;
      state.picking = true;
      clearInterval(sharedTimer); sharedTimer = null;
      clearAllBadges();
      const msCur = getMsTile();
      if (msCur) { msCur.classList.remove('rerollable'); msCur.onclick = null; msCur.style.cursor = ''; }

      // Enter die-pick phase for Moonstone
      B.pendingMoonstone = { team, dice: [...dice], dieIndex: null, phase: 'pick-die' };
      narrate(`<b class="${team}-text">${tLabel}</b> — pick a die to change!`);
      diceEl.querySelectorAll('.die').forEach((d, i) => {
        d.classList.add('rerollable');
        d.style.borderColor = 'var(--moonstone)';
        d.onclick = () => {
          clearInterval(msCountdownTimer);
          clearMsCountdown(diceEl);
          clearDiceClickable(team);
          document.querySelectorAll('.reroll-countdown').forEach(el => el.remove());

          // Now pick value via the standard picker
          B.pendingMoonstone.dieIndex = i;
          B.pendingMoonstone.phase = 'pick-value';
          narrate(`Die ${i+1} selected — pick a new value!`);
          const el = document.getElementById('msPicker');
          document.getElementById('msStep1').innerHTML = `<p style="color:var(--text2);font-size:13px;">Pick new value for die ${i+1}:</p>`;
          const step2 = document.getElementById('msStep2');
          step2.style.display = 'flex';
          step2.innerHTML = [1,2,3,4,5,6].map(v => `<div class="ms-die-option" onclick="pickMsValueUnified(${v})">${v}</div>`).join('');
          el.classList.add('active');
          el.scrollIntoView({ behavior:'smooth', block:'center' });

          let valRem = 7;
          showLsCountdown(el, valRem);
          msCountdownTimer = setInterval(() => {
            valRem--;
            if (valRem <= 0) {
              clearInterval(msCountdownTimer);
              el.classList.remove('active');
              clearMsCountdown(el);
              // Skip moonstone, mark as used phase
              state.msUsed = true;
              state.picking = false;
              B.pendingMoonstone = null;
              log(`<span style="color:var(--text2)">${team.toUpperCase()} holds their Moonstone.</span>`);
              if (checkStillAvailable()) {
                refreshLsTile();
                startTimer(3);
              }
            } else {
              showLsCountdown(el, valRem);
            }
          }, 1000);
        };
      });

      // Die-pick countdown
      let pickRem = 5;
      showLsCountdown(diceEl, pickRem);
      clearInterval(msCountdownTimer);
      msCountdownTimer = setInterval(() => {
        pickRem--;
        if (pickRem <= 0) {
          clearInterval(msCountdownTimer);
          clearMsCountdown(diceEl);
          clearDiceClickable(team);
          state.msUsed = true;
          state.picking = false;
          B.pendingMoonstone = null;
          log(`<span style="color:var(--text2)">${team.toUpperCase()} holds their Moonstone.</span>`);
          if (checkStillAvailable()) {
            refreshLsTile();
            startTimer(3);
          }
        } else {
          showLsCountdown(diceEl, pickRem);
        }
      }, 1000);
  };

  if (msTile) {
    msTile.classList.add('rerollable');
    msTile.style.cursor = 'pointer';
    msTile.onclick = msTileClick;
  }

  // ─── Lucky Stone tile click ───
  const lsTileClick = () => {
    if (state.closed || state.picking) return;
    state.picking = true;
    clearInterval(sharedTimer); sharedTimer = null;
    clearAllBadges();
    const lsCur = getLsTile();
    if (lsCur) { lsCur.classList.remove('rerollable'); lsCur.onclick = null; lsCur.style.cursor = ''; }

    narrate(`<b class="${team}-text">${tLabel}</b> — pick a die to reroll!`);
    const liveDice = team === 'red' ? B.pendingResolve.redDice : B.pendingResolve.blueDice;
    diceEl.querySelectorAll('.die').forEach((d, i) => {
      d.classList.add('rerollable');
      d.onclick = () => {
        clearLsCountdown();
        clearDiceClickable(team);

        // Perform the reroll (prevent doLuckyReroll's own chaining — we handle it here)
        const savedAvail = B.lsAvailable ? B.lsAvailable[team] : 0;
        if (B.lsAvailable) B.lsAvailable[team] = 0;

        doLuckyReroll(team, i, liveDice, () => {
          state.picking = false;
          state.lsUsedCount++;
          if (B.lsAvailable) B.lsAvailable[team] = Math.max(0, savedAvail - 1);
          if (checkStillAvailable()) {
            refreshLsTile();
            // Re-activate MS tile if not used yet
            if (!state.msUsed && B[team].resources.moonstone > 0) {
              const msR = getMsTile();
              if (msR) { msR.classList.add('rerollable'); msR.style.cursor = 'pointer'; msR.onclick = msTileClick; }
            }
            startTimer(3);
          }
        });
      };
    });

    let pickRem = 3;
    showLsCountdown(diceEl, pickRem);
    clearInterval(lsCountdownTimer); lsCountdownTimer = null;
    lsCountdownTimer = setInterval(() => {
      pickRem--;
      if (pickRem <= 0) {
        clearInterval(lsCountdownTimer); lsCountdownTimer = null;
        clearLsCountdown();
        clearDiceClickable(team);
        state.picking = false;
        log(`<span style="color:var(--text2)">${team.toUpperCase()} didn't pick a die in time.</span>`);
        if (checkStillAvailable()) {
          refreshLsTile();
          if (!state.msUsed && B[team].resources.moonstone > 0) {
            const msR2 = getMsTile();
            if (msR2) { msR2.classList.add('rerollable'); msR2.style.cursor = 'pointer'; msR2.onclick = msTileClick; }
          }
          startTimer(3);
        }
      } else {
        showLsCountdown(diceEl, pickRem);
      }
    }, 1000);
  };

  if (lsTile) {
    lsTile.classList.add('rerollable');
    lsTile.style.cursor = 'pointer';
    lsTile.onclick = lsTileClick;
  }

  // Listen for Moonstone value selection completion
  const onMsDone = (e) => {
    if (e.detail.team !== team || state.closed) return;
    document.removeEventListener('unifiedMsDone', onMsDone);
    state.msUsed = true;
    state.picking = false;
    renderBattle();
    if (checkStillAvailable()) {
      refreshLsTile();
      startTimer(3);
    }
  };
  document.addEventListener('unifiedMsDone', onMsDone);

  // Start the initial shared timer
  startTimer(5);
}

// Moonstone value picker callback for the unified specials window
// (separate from pickMsValue to avoid interfering with the standard MS flow)
function pickMsValueUnified(val) {
  clearInterval(msCountdownTimer);
  const ms = B.pendingMoonstone;
  if (!ms) return;
  const team = ms.team;
  const t = B[team];
  const f = active(t);

  const el = document.getElementById('msPicker');
  el.classList.remove('active');
  clearMsCountdown(el);

  // Benjamin (203) — Magic Touch: once per turn, don't decrement moonstone
  let magicTouchFired = false;
  if (f.id === 203 && !f.usedMagicTouch) {
    f.usedMagicTouch = true;
    magicTouchFired = true;
    showAbilityCallout('MAGIC TOUCH!', 'var(--moonstone)', `${f.name} — Moonstone used without discarding!`, team);
    log(`<span class="log-ability">${f.name}</span> — Magic Touch! Used Moonstone without discarding it!`);
  } else {
    t.resources.moonstone--;
    playSfx('sfxSpecial', 0.5);
  }

  ms.dice[ms.dieIndex] = val;
  ms.dice.sort((a,b)=>a-b);

  if (team==='red') B.pendingResolve.redDice = ms.dice;
  else B.pendingResolve.blueDice = ms.dice;
  B.redDice = B.pendingResolve.redDice;
  B.blueDice = B.pendingResolve.blueDice;
  renderDice(B.redDice, B.blueDice);

  const teamLabel = team.charAt(0).toUpperCase() + team.slice(1);
  log(`<span class="log-ms">Moonstone used!</span> ${team.toUpperCase()} changed die to ${val} → [${ms.dice.join(', ')}]`);
  narrate(`<b style="color:var(--moonstone)">Moonstone!</b>&nbsp;<b class="${team}-text">${teamLabel}</b> changes die to <b class="gold">${val}</b>! → [${ms.dice.join(', ')}]`);
  B.pendingMoonstone = null;

  // Bigsby (424) — Omen: if Bigsby is the active ghost when a Moonstone is used
  if (f.id === 424 && !f.ko) {
    const g = f;
    g.originalId = g.id; g.originalName = g.name; g.originalArt = g.art;
    g.originalMaxHp = g.maxHp; g.originalAbility = g.ability;
    g.originalAbilityDesc = g.abilityDesc; g.originalRarity = g.rarity;
    g.id = 112; g.name = "Doom"; g.maxHp = 7; g.hp = 7;
    g.ability = "Fiendship"; g.abilityDesc = "+2 bonus damage!";
    g.art = "../testroom/art/originals/doom.jpg"; g.rarity = "legendary"; g.ko = false;
    queueAbility('OMEN!', 'var(--legendary)', 'Bigsby sacrifices himself — DOOM rises!', null, team);
    log(`<span class="log-ability">Bigsby</span> — Omen! <span class="log-dmg">DOOM has arrived!</span>`);
    renderBattle();
  }

  // Dispatch a custom event so the unified window picks up the completion
  const msPostDelay = magicTouchFired ? 1600 : 1200;
  setTimeout(() => {
    document.dispatchEvent(new CustomEvent('unifiedMsDone', { detail: { team } }));
  }, msPostDelay);
}

// ============================================================
// CROSS-TYPE SPECIALS WINDOW
// One team has Moonstone, the other has Lucky Stone.
// Both tiles highlight simultaneously with a shared 5s countdown.
// If neither acts in 5s → both skip (saves ~5s vs 5s+5s sequential).
// If MS player acts first → LS player gets a fresh 5s after MS resolves.
// If LS player acts first → MS player gets a fresh 5s after LS resolves.
// ============================================================
function startCrossTypeSpecialsWindow(msTeam, lsTeam) {
  B.phase = 'specials-shared';
  const tLabel = t => t.charAt(0).toUpperCase() + t.slice(1);
  narrate(`<b class="${msTeam}-text">${tLabel(msTeam)}</b> has a <b style="color:var(--moonstone)">Moonstone</b> and <b class="${lsTeam}-text">${tLabel(lsTeam)}</b> has a <b class="gold">Lucky Stone!</b> Click yours to use it!`);

  const msDice = B.pendingResolve[msTeam === 'red' ? 'redDice' : 'blueDice'];
  const lsDice = B.pendingResolve[lsTeam === 'red' ? 'redDice' : 'blueDice'];

  const msResEl = document.getElementById(msTeam + '-resources');
  const msTile  = msResEl && msResEl.querySelector('.res-tile.moonstone');
  const lsResEl = document.getElementById(lsTeam + '-resources');
  const lsTile  = lsResEl && lsResEl.querySelector('.res-tile.luckyStone');
  const lsDiceEl = document.getElementById(lsTeam + '-dice');
  const msDiceEl = document.getElementById(msTeam + '-dice');

  const state = { closed: false };

  const closeBoth = () => {
    if (state.closed) return;
    state.closed = true;
    clearInterval(lsSharedTimer); lsSharedTimer = null;
    // MS tile cleanup
    if (msTile) {
      msTile.classList.remove('rerollable');
      msTile.onclick = null;
      msTile.style.cursor = '';
      clearMsCountdown(msTile);
    }
    clearInterval(msCountdownTimer);
    // LS tile cleanup
    if (lsTile) {
      lsTile.classList.remove('rerollable');
      lsTile.onclick = null;
      lsTile.style.cursor = '';
    }
    document.querySelectorAll('.ls-shared-cd').forEach(el => el.remove());
    clearLsCountdown();
    clearDiceClickable(lsTeam);
  };

  // Shared countdown badges on both tiles
  const updateBadges = (r) => {
    if (msTile) {
      let cd = msTile.querySelector('.ls-shared-cd');
      if (!cd) {
        cd = document.createElement('div');
        cd.className = 'reroll-countdown ls-shared-cd';
        msTile.style.position = 'relative';
        msTile.appendChild(cd);
      }
      cd.textContent = r;
    }
    if (lsTile) {
      let cd = lsTile.querySelector('.ls-shared-cd');
      if (!cd) {
        cd = document.createElement('div');
        cd.className = 'reroll-countdown ls-shared-cd';
        lsTile.style.position = 'relative';
        lsTile.appendChild(cd);
      }
      cd.textContent = r;
    }
  };

  let remaining = 5;
  updateBadges(remaining);
  clearInterval(lsSharedTimer); lsSharedTimer = null;
  lsSharedTimer = setInterval(() => {
    remaining--;
    if (remaining <= 0 || state.closed) {
      clearInterval(lsSharedTimer); lsSharedTimer = null;
      if (!state.closed) {
        closeBoth();
        log(`<span style="color:var(--text2)">Both teams passed on their specials.</span>`);
        resolveRound();
      }
    } else {
      updateBadges(remaining);
    }
  }, 1000);

  // ─── MS tile click ───────────────────────────────────────────
  if (msTile) {
    msTile.classList.add('rerollable');
    msTile.style.cursor = 'pointer';
    msTile.onclick = () => {
      if (state.closed) return;
      state.closed = true; // Lock out LS click while MS overlay is up
      clearInterval(lsSharedTimer); lsSharedTimer = null;
      document.querySelectorAll('.ls-shared-cd').forEach(el => el.remove());
      // Remove LS tile highlight (overlay blocks LS interaction anyway)
      if (lsTile) { lsTile.classList.remove('rerollable'); lsTile.onclick = null; lsTile.style.cursor = ''; }
      if (msTile) { clearMsCountdown(msTile); msTile.classList.remove('rerollable'); msTile.onclick = null; msTile.style.cursor = ''; }

      // After MS completes (use or skip), offer LS player their window
      B.afterMoonstoneCallback = () => {
        delete B.afterMoonstoneCallback;
        const lsAvail = B.lsAvailable ? B.lsAvailable[lsTeam] : 0;
        if (lsAvail > 0 && B[lsTeam].resources.luckyStone > 0) {
          startLuckyStoneWindow(lsTeam, () => resolveRound());
        } else {
          resolveRound();
        }
      };

      // Enter die-pick phase directly (skip re-showing the tile countdown)
      B.pendingMoonstone = { team: msTeam, dice: [...msDice], dieIndex: null, phase: 'pick-die' };
      narrate(`<b class="${msTeam}-text">${tLabel(msTeam)}</b> — pick a die to change!`);
      msDiceEl.querySelectorAll('.die').forEach((d, i) => {
        d.classList.add('rerollable');
        d.style.borderColor = 'var(--moonstone)';
        d.onclick = () => pickMsDie(i);
      });
      let pickRemaining = 5;
      showLsCountdown(msDiceEl, pickRemaining);
      clearInterval(msCountdownTimer);
      msCountdownTimer = setInterval(() => {
        pickRemaining--;
        if (pickRemaining <= 0) {
          clearInterval(msCountdownTimer);
          clearMsCountdown(msDiceEl);
          clearDiceClickable(msTeam);
          skipMoonstone();
        } else {
          showLsCountdown(msDiceEl, pickRemaining);
        }
      }, 1000);
    };
  }

  // ─── LS tile click ───────────────────────────────────────────
  if (lsTile) {
    lsTile.classList.add('rerollable');
    lsTile.style.cursor = 'pointer';
    lsTile.onclick = () => {
      if (state.closed) return;
      state.closed = true; // Lock out MS click while LS is running
      clearInterval(lsSharedTimer); lsSharedTimer = null;
      document.querySelectorAll('.ls-shared-cd').forEach(el => el.remove());
      if (msTile) { clearMsCountdown(msTile); msTile.classList.remove('rerollable'); msTile.onclick = null; msTile.style.cursor = ''; }
      if (lsTile) { lsTile.classList.remove('rerollable'); lsTile.onclick = null; lsTile.style.cursor = ''; }

      // After LS completes, offer MS player their window
      const afterLs = () => {
        const msAvail = B.msAvailable ? B.msAvailable[msTeam] : 0;
        if (msAvail > 0 && B[msTeam].resources.moonstone > 0) {
          showMoonstoneChoice(msTeam, msTeam === 'red' ? B.redDice : B.blueDice);
          B.afterMoonstoneCallback = () => {
            delete B.afterMoonstoneCallback;
            resolveRound();
          };
        } else {
          resolveRound();
        }
      };

      // LS die-pick phase
      narrate(`<b class="${lsTeam}-text">${tLabel(lsTeam)}</b> — pick a die to reroll!`);
      lsDiceEl.querySelectorAll('.die').forEach((d, i) => {
        d.classList.add('rerollable');
        d.onclick = () => doLuckyReroll(lsTeam, i, lsDice, afterLs);
      });
      let pickRemaining = 3;
      showLsCountdown(lsDiceEl, pickRemaining);
      clearInterval(lsCountdownTimer); lsCountdownTimer = null;
      lsCountdownTimer = setInterval(() => {
        pickRemaining--;
        if (pickRemaining <= 0) {
          clearInterval(lsCountdownTimer); lsCountdownTimer = null;
          clearLsCountdown();
          clearDiceClickable(lsTeam);
          log(`<span style="color:var(--text2)">${lsTeam.toUpperCase()} didn't pick a die in time.</span>`);
          afterLs();
        } else {
          showLsCountdown(lsDiceEl, pickRemaining);
        }
      }, 1000);
    };
  }
}

// ============================================================
// LUCKY STONE — countdown + clickable dice reroll
// ============================================================
let lsCountdownTimer = null;
let lsSharedTimer = null; // separate timer for the simultaneous Lucky Stone window

function checkLuckyStones() {
  // Only offer Lucky Stones that existed BEFORE this round (not gained this turn)
  const redAvail = B.lsAvailable ? B.lsAvailable.red : 0;
  const blueAvail = B.lsAvailable ? B.lsAvailable.blue : 0;
  const redHasLS = redAvail > 0 && B.red.resources.luckyStone > 0;
  const blueHasLS = blueAvail > 0 && B.blue.resources.luckyStone > 0;

  if (!redHasLS && !blueHasLS) { resolveRound(); return; }

  // Both teams have Lucky Stones — show simultaneously (saves up to 3s vs sequential)
  if (redHasLS && blueHasLS) {
    startSimultaneousLuckyStoneWindows();
    return;
  }

  // Only one team has stones — single sequential window (unchanged)
  if (redHasLS) { startLuckyStoneWindow('red', () => resolveRound()); return; }
  startLuckyStoneWindow('blue', () => resolveRound());
}

// Simultaneous Lucky Stone window: both teams' tiles highlight at the same time.
// Shared 5-second countdown. Either team can act; die-pick phases are serialized
// (one team at a time) to avoid timer conflicts on lsCountdownTimer.
function startSimultaneousLuckyStoneWindows() {
  B.phase = 'luckystone-shared';
  narrate(`Both teams have <b class="gold">Lucky Stones!</b> Click yours to use it!`);

  const state = { redDone: false, blueDone: false, pickingTeam: null, closed: false };

  const closeShared = () => {
    if (state.closed) return;
    state.closed = true;
    clearInterval(lsSharedTimer); lsSharedTimer = null;
    clearLsCountdown();
    ['red', 'blue'].forEach(t => {
      clearDiceClickable(t);
      const resEl = document.getElementById(t + '-resources');
      const lsEl = resEl && resEl.querySelector('.res-tile.luckyStone');
      if (lsEl) { lsEl.classList.remove('rerollable'); lsEl.onclick = null; lsEl.style.cursor = ''; }
    });
    document.querySelectorAll('.ls-shared-cd').forEach(el => el.remove());
    resolveRound();
  };

  const checkBothDone = () => { if (state.redDone && state.blueDone) closeShared(); };

  // Show/update the shared countdown badge on both active tiles
  const updateSharedBadges = (remaining) => {
    ['red', 'blue'].forEach(t => {
      const done = t === 'red' ? state.redDone : state.blueDone;
      if (done || state.pickingTeam === t) return;
      const resEl = document.getElementById(t + '-resources');
      const lsEl = resEl && resEl.querySelector('.res-tile.luckyStone');
      if (!lsEl || !lsEl.classList.contains('rerollable')) return;
      let cd = lsEl.querySelector('.ls-shared-cd');
      if (!cd) {
        cd = document.createElement('div');
        cd.className = 'reroll-countdown ls-shared-cd';
        lsEl.style.position = 'relative';
        lsEl.appendChild(cd);
      }
      cd.textContent = remaining;
      cd.style.animation = 'none';
      requestAnimationFrame(() => { cd.style.animation = ''; });
    });
  };

  const restartSharedCountdown = (secs) => {
    if (state.closed) return;
    clearInterval(lsSharedTimer); lsSharedTimer = null;
    document.querySelectorAll('.ls-shared-cd').forEach(el => el.remove());
    let remaining = secs;
    updateSharedBadges(remaining);
    lsSharedTimer = setInterval(() => {
      remaining--;
      if (remaining <= 0 || state.closed) {
        clearInterval(lsSharedTimer); lsSharedTimer = null;
        document.querySelectorAll('.ls-shared-cd').forEach(el => el.remove());
        if (!state.closed) {
          log(`<span style="color:var(--text2)">Lucky Stone window expired.</span>`);
          closeShared();
        }
      } else {
        updateSharedBadges(remaining);
      }
    }, 1000);
  };

  // Activate a team's LS tile in shared mode
  const activateTile = (team) => {
    if (state.closed || (team === 'red' ? state.redDone : state.blueDone)) return;
    const dice = team === 'red' ? B.pendingResolve.redDice : B.pendingResolve.blueDice;
    const resEl = document.getElementById(team + '-resources');
    const lsEl = resEl && resEl.querySelector('.res-tile.luckyStone');
    const diceEl = document.getElementById(team + '-dice');
    const teamLabel = team.charAt(0).toUpperCase() + team.slice(1);
    if (!lsEl) { if (team === 'red') state.redDone = true; else state.blueDone = true; return; }

    lsEl.classList.add('rerollable');
    lsEl.style.cursor = 'pointer';
    lsEl.onclick = () => {
      if (state.closed || state.pickingTeam) return; // serialized: wait if other team is picking
      state.pickingTeam = team;
      // Pause shared countdown while this team picks a die
      clearInterval(lsSharedTimer); lsSharedTimer = null;
      document.querySelectorAll('.ls-shared-cd').forEach(el => el.remove());
      lsEl.classList.remove('rerollable'); lsEl.onclick = null; lsEl.style.cursor = '';

      narrate(`<b class="${team}-text">${teamLabel}</b> — pick a die to reroll!`);
      const dieDivs = diceEl.querySelectorAll('.die');
      dieDivs.forEach((d, i) => {
        d.classList.add('rerollable');
        d.onclick = () => {
          clearLsCountdown();
          clearDiceClickable(team);
          // Zero lsAvailable[team] so doLuckyReroll won't spawn a new sequential window;
          // we handle multi-stone re-offering ourselves in the callback.
          const savedAvail = B.lsAvailable ? B.lsAvailable[team] : 0;
          if (B.lsAvailable) B.lsAvailable[team] = 0;

          doLuckyReroll(team, i, dice, () => {
            state.pickingTeam = null;
            if (B.lsAvailable) B.lsAvailable[team] = Math.max(0, savedAvail - 1);
            const tObj = B[team];
            const stillAvail = B.lsAvailable ? B.lsAvailable[team] : 0;
            if (tObj.resources.luckyStone > 0 && stillAvail > 0) {
              // More stones — re-activate tile, resume shared countdown.
              // stillAvail is already correctly set to savedAvail-1 (line above),
              // representing the remaining authorized uses. Do NOT decrement again here —
              // the next click will capture the correct savedAvail from B.lsAvailable[team].
              setTimeout(() => { if (state.closed) return; activateTile(team); restartSharedCountdown(5); }, 600);
            } else {
              if (team === 'red') state.redDone = true; else state.blueDone = true;
              if (!state.closed) {
                const otherDone = team === 'red' ? state.blueDone : state.redDone;
                if (!otherDone) setTimeout(() => restartSharedCountdown(5), 600);
                else checkBothDone();
              }
            }
          });
        };
      });

      // 3s die-pick sub-countdown (safe: serialized by pickingTeam)
      let pickRem = 3;
      showLsCountdown(diceEl, pickRem);
      lsCountdownTimer = setInterval(() => {
        pickRem--;
        if (pickRem <= 0) {
          clearLsCountdown();
          clearDiceClickable(team);
          log(`<span style="color:var(--text2)">${team.toUpperCase()} didn't pick a die in time.</span>`);
          state.pickingTeam = null;
          if (team === 'red') state.redDone = true; else state.blueDone = true;
          if (!state.closed) {
            const otherDone = team === 'red' ? state.blueDone : state.redDone;
            if (!otherDone) setTimeout(() => restartSharedCountdown(3), 100);
            else checkBothDone();
          }
        } else { showLsCountdown(diceEl, pickRem); }
      }, 1000);
    };
  };

  // Activate both tiles simultaneously
  activateTile('red');
  activateTile('blue');
  checkBothDone(); // in case neither team had a tile element
  restartSharedCountdown(5);
}

function startLuckyStoneWindow(team, callback) {
  B.phase = 'luckystone-' + team;
  const dice = team === 'red' ? B.pendingResolve.redDice : B.pendingResolve.blueDice;
  const teamLabel = team.charAt(0).toUpperCase() + team.slice(1);

  narrate(`<b class="${team}-text">${teamLabel}</b> has a <b class="gold">Lucky Stone!</b>&nbsp;Click it to use!`);

  // Highlight the Lucky Stone resource tile — player clicks IT first
  const resEl = document.getElementById(team + '-resources');
  const lsEl = resEl.querySelector('.res-tile.luckyStone');
  const diceEl = document.getElementById(team + '-dice');
  const countdownTarget = lsEl || diceEl;

  if (lsEl) {
    lsEl.classList.add('rerollable');
    lsEl.style.cursor = 'pointer';
    lsEl.onclick = () => {
      // Player clicked Lucky Stone — stop the old tile countdown, start a fresh one for die picking
      clearInterval(lsCountdownTimer);
      clearLsCountdown(); // remove countdown display from the tile
      lsEl.classList.remove('rerollable');
      lsEl.onclick = null;
      narrate(`<b class="${team}-text">${teamLabel}</b> — pick a die to reroll!`);
      const dieDivs = diceEl.querySelectorAll('.die');
      dieDivs.forEach((d, i) => {
        d.classList.add('rerollable');
        d.onclick = () => doLuckyReroll(team, i, dice, callback);
      });
      // Fresh 3s countdown on the dice row — mirrors Moonstone's pick-die phase
      let pickRemaining = 3;
      showLsCountdown(diceEl, pickRemaining);
      lsCountdownTimer = setInterval(() => {
        pickRemaining--;
        if (pickRemaining <= 0) {
          clearLsCountdown();
          clearDiceClickable(team);
          log(`<span style="color:var(--text2)">${team.toUpperCase()} didn't pick a die in time.</span>`);
          callback();
        } else {
          showLsCountdown(diceEl, pickRemaining);
        }
      }, 1000);
    };
  } else {
    // No resource tile visible — fall back to direct dice click
    const dieDivs = diceEl.querySelectorAll('.die');
    dieDivs.forEach((d, i) => {
      d.classList.add('rerollable');
      d.onclick = () => doLuckyReroll(team, i, dice, callback);
    });
  }

  // Start countdown (3, 2, 1) — auto-skip if not used
  let remaining = 3;
  showLsCountdown(countdownTarget, remaining);

  lsCountdownTimer = setInterval(() => {
    remaining--;
    if (remaining <= 0) {
      clearLsCountdown();
      clearDiceClickable(team);
      if (lsEl) { lsEl.classList.remove('rerollable'); lsEl.onclick = null; }
      log(`<span style="color:var(--text2)">${team.toUpperCase()} didn't use their Lucky Stone.</span>`);
      callback();
    } else {
      showLsCountdown(countdownTarget, remaining);
    }
  }, 1000);
}

function showLsCountdown(parentEl, num) {
  let cd = parentEl.querySelector('.reroll-countdown');
  if (!cd) {
    cd = document.createElement('div');
    cd.className = 'reroll-countdown';
    parentEl.style.position = 'relative';
    parentEl.appendChild(cd);
  }
  cd.textContent = num;
  cd.style.animation = 'none';
  requestAnimationFrame(() => { cd.style.animation = ''; });
}

function clearLsCountdown() {
  if (lsCountdownTimer) { clearInterval(lsCountdownTimer); lsCountdownTimer = null; }
  document.querySelectorAll('.reroll-countdown').forEach(el => el.remove());
}

function clearDiceClickable(team) {
  const diceEl = document.getElementById(team + '-dice');
  diceEl.querySelectorAll('.die').forEach(d => {
    d.classList.remove('rerollable');
    d.onclick = null;
  });
}

function doLuckyReroll(team, dieIndex, dice, callback) {
  clearLsCountdown();
  clearDiceClickable(team);
  playSfx('sfxSpecial', 0.4);

  const t = B[team];
  const oldVal = dice[dieIndex];

  // Animate the die rolling
  const diceEl = document.getElementById(team + '-dice');
  const dieDivs = diceEl.querySelectorAll('.die');
  const targetDie = dieDivs[dieIndex];
  targetDie.classList.add('rolling');
  targetDie.textContent = '?';
  playSfx('sfxDiceRoll');

  setTimeout(() => {
    // Lucky Stones are 15% luckier — bias toward higher values
    const lsRoll = Math.random();
    const newVal = lsRoll < 0.12 ? 1 : lsRoll < 0.22 ? 2 : lsRoll < 0.34 ? 3 : lsRoll < 0.50 ? 4 : lsRoll < 0.70 ? 5 : 6;
    dice[dieIndex] = newVal;
    dice.sort((a, b) => a - b);
    t.resources.luckyStone--;

    if (team === 'red') B.pendingResolve.redDice = dice;
    else B.pendingResolve.blueDice = dice;
    B.redDice = B.pendingResolve.redDice;
    B.blueDice = B.pendingResolve.blueDice;

    // Re-render dice directly (revealDice needs IDs from showRolling which aren't present here)
    targetDie.classList.remove('rolling');
    renderDice(
      team === 'red' ? dice : B.pendingResolve.redDice,
      team === 'blue' ? dice : B.pendingResolve.blueDice
    );

    // Track Lucky Stone usage for Twyla (417) Lucky Dance
    if (B.luckyStoneSpentThisTurn) B.luckyStoneSpentThisTurn[team] = (B.luckyStoneSpentThisTurn[team] || 0) + 1;

    // Twyla (417) — Lucky Dance: each Lucky Stone spent adds +1 bonus die AND +1 Healing Seed LIVE
    const twylaFighter = active(B[team]);
    if (twylaFighter.id === 417 && !twylaFighter.ko) {
      // Add bonus die to the live dice array
      const lsRoll2 = Math.random();
      const bonusDie = lsRoll2 < 0.12 ? 1 : lsRoll2 < 0.22 ? 2 : lsRoll2 < 0.34 ? 3 : lsRoll2 < 0.50 ? 4 : lsRoll2 < 0.70 ? 5 : 6;
      dice.push(bonusDie);
      dice.sort((a, b) => a - b);
      // Sync dice back to battle state
      if (team === 'red') { B.pendingResolve.redDice = dice; B.redDice = dice; }
      else { B.pendingResolve.blueDice = dice; B.blueDice = dice; }
      // Grant Healing Seed
      B[team].resources.healingSeed++;
      log(`<span class="log-ability">${twylaFighter.name}</span> — Lucky Dance! <span class="log-heal">+1 Healing Seed!</span> <span class="log-ice">+1 bonus die (${bonusDie})!</span>`);
      showAbilityCallout('LUCKY DANCE!', 'var(--rare)', `${twylaFighter.name} — +1 die and +1 Healing Seed!`, team);
      // Re-render dice to show the new bonus die
      renderDice(
        team === 'red' ? dice : B.pendingResolve.redDice,
        team === 'blue' ? dice : B.pendingResolve.blueDice
      );
    }

    log(`<span class="log-ms">Lucky Stone!</span> ${team.charAt(0).toUpperCase()+team.slice(1)} rerolled ${oldVal} → <b>${newVal}</b> → [${dice.join(', ')}]`);
    narrate(`<b class="gold">Lucky Stone!</b> Rerolled ${oldVal} → <b>${newVal}</b>!`);
    renderBattle();

    // If player has more Lucky Stones available, go directly to dice-pick mode
    // (skip the tile-click step — keep the flow seamless within the same window)
    const stillAvail = B.lsAvailable ? B.lsAvailable[team] : 0;
    if (t.resources.luckyStone > 0 && stillAvail > 0) {
      B.lsAvailable[team]--;
      setTimeout(() => {
        const teamLabel = team.charAt(0).toUpperCase() + team.slice(1);
        narrate(`<b class="${team}-text">${teamLabel}</b> has <b class="gold">${t.resources.luckyStone} Lucky Stone${t.resources.luckyStone>1?'s':''}!</b> Pick a die to reroll!`);
        const diceElInner = document.getElementById(team + '-dice');
        const liveDice = team === 'red' ? B.pendingResolve.redDice : B.pendingResolve.blueDice;
        diceElInner.querySelectorAll('.die').forEach((d, i) => {
          d.classList.add('rerollable');
          d.onclick = () => doLuckyReroll(team, i, liveDice, callback);
        });
        // Brief 3s countdown for the next die pick
        let pickRem = 3;
        showLsCountdown(diceElInner, pickRem);
        lsCountdownTimer = setInterval(() => {
          pickRem--;
          if (pickRem <= 0) {
            clearLsCountdown();
            clearDiceClickable(team);
            log(`<span style="color:var(--text2)">${team.toUpperCase()} didn't pick a die in time.</span>`);
            callback();
          } else {
            showLsCountdown(diceElInner, pickRem);
          }
        }, 1000);
      }, 600);
    } else {
      setTimeout(callback, 600);
    }
  }, 500);
}

// ============================================================
// DICE HIGHLIGHTING — visually tell the story of why someone won
// ============================================================
function highlightWinnerDice(winTeam, winRoll, loseTeam, tiebreaker) {
  const winEl  = document.getElementById(winTeam  + '-dice');
  const loseEl = document.getElementById(loseTeam + '-dice');
  if (!winEl || !loseEl) return;

  // Clear ALL stale highlight classes from both rows before applying fresh state
  const ALL_HL = ['die-win','die-win-doubles','die-win-triples','die-win-mega','die-win-secondary','die-loser'];
  [winEl, loseEl].forEach(el =>
    el.querySelectorAll('.die').forEach(d => d.classList.remove(...ALL_HL))
  );

  const winDivs  = [...winEl.querySelectorAll('.die')];
  const loseDivs = [...loseEl.querySelectorAll('.die')];

  // Dim every losing die
  loseDivs.forEach(d => d.classList.add('die-loser'));

  // Tiebreaker — same hand type & value, remaining die decided it
  if (tiebreaker) {
    // Secondary glow on the matched (tied) dice so players can see what hand tied
    // Skip for singles — there's only one matched die and it's just a number, not a "hand"
    if (winRoll.type !== 'singles') {
      const matchCount = { doubles:2, triples:3, quads:4, penta:5 }[winRoll.type] || 0;
      let winCount = 0, loseCount = 0;
      winDivs.forEach(d => {
        if (winCount < matchCount && parseInt(d.textContent) === winRoll.value) {
          d.classList.add('die-win-secondary');
          winCount++;
        }
      });
      // Symmetric: loser's matched group also gets dim-gold so both rows tell the story
      loseDivs.forEach(d => {
        if (loseCount < matchCount && parseInt(d.textContent) === winRoll.value) {
          d.classList.add('die-win-secondary'); // overrides die-loser grey via CSS specificity
          loseCount++;
        }
      });
    }
    // Primary gold glow on the decisive tiebreaker die (overrides secondary if same die)
    let done = false;
    [...winDivs].reverse().forEach(d => {
      if (!done && parseInt(d.textContent) === tiebreaker.value) {
        d.classList.remove('die-win-secondary'); // ensure gold fully overrides
        d.classList.add('die-win');
        done = true;
      }
    });
    // Fallback: if Blackout removed the tiebreaker die, highlight the highest remaining
    if (!done && winDivs.length > 0) {
      winDivs[winDivs.length - 1].classList.add('die-win');
    }
    return;
  }

  // Pick the CSS class based on hand tier
  let hlClass = 'die-win'; // singles default
  if (winRoll.type === 'doubles') hlClass = 'die-win-doubles';
  else if (winRoll.type === 'triples') hlClass = 'die-win-triples';
  else if (winRoll.type === 'quads' || winRoll.type === 'penta') hlClass = 'die-win-mega';

  if (winRoll.type === 'singles') {
    // Highlight just the highest die (the decision-maker)
    let done = false;
    [...winDivs].reverse().forEach(d => {
      if (!done && parseInt(d.textContent) === winRoll.value) {
        d.classList.add(hlClass);
        done = true;
      }
    });
  } else if (winRoll.type === 'doubles') {
    // Highlight the matching pair
    let count = 0;
    winDivs.forEach(d => {
      if (count < 2 && parseInt(d.textContent) === winRoll.value) {
        d.classList.add(hlClass);
        count++;
      }
    });
  } else {
    // triples / quads / penta — all matching dice light up
    winDivs.forEach(d => {
      if (parseInt(d.textContent) === winRoll.value) d.classList.add(hlClass);
    });
  }
}

// v386: Safe wrapper — catches any thrown error in the damage/cinematic pipeline
// and recovers the game to a rollable state. Without this, a ReferenceError or
// TypeError anywhere inside the 2000-line resolveRound body silently kills the
// round and freezes the UI (no damage applied, no callouts, no roll buttons).
// The wrapper surfaces the error to the log/narrator so it can be diagnosed AND
// forces B.phase='ready' + resetRollButtons() so the game keeps running.
function resolveRound() {
  try {
    _resolveRoundImpl();
  } catch (err) {
    console.error('[resolveRound CRASH]', err);
    try { log(`<span class="log-dmg">INTERNAL ERROR</span> in resolveRound: ${err && err.message ? err.message : String(err)} — game recovered, please roll again.`); } catch (_) {}
    try { narrate(`<b class="gold">⚠ Round resolution crashed</b> — <span style="color:var(--text2)">${err && err.message ? err.message : 'unknown error'}</span>`); } catch (_) {}
    // Force the game out of 'resolving' so roll buttons come back alive
    try {
      if (typeof B !== 'undefined' && B) {
        B.phase = 'ready';
        B.preRoll = null;
        B.pendingResolve = null;
        B.sylviaPendingResult = null;
        B.sylviaResuming = false;
        B.bogeyReflectResuming = false;
        B.bogeyReflectChoice = null;
        B.bogeyReflectPending = null;
      }
      abilityQueue = [];
      abilityQueueMode = false;
      if (typeof narrateQueue !== 'undefined') narrateQueue = [];
      if (typeof resetRollButtons === 'function') resetRollButtons();
      if (typeof renderBattle === 'function') renderBattle();
    } catch (_) {}
  }
}
function _resolveRoundImpl() {
  B.phase = 'resolving';
  // v331: resolveRound can be re-entered after the Sylvia player-rolled modal resolves.
  // When resuming, we skip the Blackout pass (already applied) and the header log line
  // (already printed) so nothing double-fires. All downstream logic (winner determination,
  // damage calc, cinematics) is pure w.r.t. dice state and safe to re-run.
  const sylviaResuming = !!B.sylviaResuming;
  B.sylviaResuming = false;
  // Clear any stale roll narrations ("X rolls...", "X rolled [...]") that built up in the
  // narrator queue while both teams were rolling. Without this, up to 4 queued items (each
  // holding 1800ms) delay the damage narration by 5–7 seconds after the HP bar has already
  // visually dropped — the narrator then explains an event the player already watched long ago.
  // We clear only the PENDING queue (not the currently-displaying item), so whatever is
  // mid-display finishes its 1800ms hold, then the damage narration fires immediately after.
  narrateQueue = [];
  const redDice = B.pendingResolve.redDice;
  const blueDice = B.pendingResolve.blueDice;

  // Blackout (403) — remove named number from opponent's dice
  // Only fires if Smudge is active and alive on the team that set the number
  // Callouts are collected here and prepended to the post-roll ability queue below,
  // so BLACKOUT! plays sequentially instead of being stomped by the first queued ability.
  // Use B.blackoutCallouts so the queue survives a Sylvia-resuming re-entry.
  if (!sylviaResuming) B.blackoutCallouts = [];
  const blackoutCallouts = B.blackoutCallouts || [];
  if (!sylviaResuming) {
    ['red', 'blue'].forEach(team => {
      const oppTeam = team === 'red' ? 'blue' : 'red';
      const t = B[team];
      const smudgeActive = active(t).id === 403 && !active(t).ko;
      if (B.blackoutNum && B.blackoutNum[team] && smudgeActive) {
        const num = B.blackoutNum[team];
        const originalDice = team === 'red' ? blueDice : redDice;
        const filtered = [];
        let removed = 0;
        originalDice.forEach(d => {
          if (d === num) { removed++; }
          else { filtered.push(d); }
        });
        if (removed > 0) {
          if (team === 'red') { blueDice.splice(0, blueDice.length, ...filtered); }
          else { redDice.splice(0, redDice.length, ...filtered); }
          blackoutCallouts.push({ name: 'BLACKOUT!', color: 'var(--rare)', desc: `Smudge — ${removed} dice showing ${num} vanished!`, team: team });
          log(`<span class="log-ability">Smudge</span> — Blackout! Named ${num} — <span class="log-dmg">${removed} opponent dice removed!</span>`);
        }
        // No callout if opponent didn't roll the number — silent miss, don't interrupt the flow
      }
    });
    // Reset blackout picks
    B.blackoutNum = {};
  }

  B.redDice = redDice; B.blueDice = blueDice;
  // Sync visual dice display after Blackout may have removed dice from either array.
  // Without this, the blacked-out die stays visible on screen even though it no longer
  // counts in the calculation, and highlightWinnerDice indexes into stale DOM elements.
  renderDice(B.redDice, B.blueDice);

  const rR = classify(redDice), bR = classify(blueDice);
  if (!sylviaResuming) {
    log(`Red [${redDice.join(',')}] <span style="color:var(--text2)">(${rR.type} ${rR.value})</span> vs Blue [${blueDice.join(',')}] <span style="color:var(--text2)">(${bR.type} ${bR.value})</span>`);
  }

  // Captain James (443) — Final Strike: triples or higher → gain 2 Sacred Fires
  // (Fires win or lose, just needs triples+. Placed in post-roll section near Gom Gom Gom/Sable.)

  // Determine winner with cascading tiebreakers
  // Rule: compare best hand type first. If same type AND same value,
  // compare remaining dice highest-to-lowest. Missing dice = 0.
  const typeRank = {penta:5,quads:4,triples:3,doubles:2,singles:1,none:0};
  let winner = null;
  let tiebreaker = null; // {value: N} — the remaining die that broke the tie

  // Hector (96) — Protector: when Hector is active on either team, singles beat doubles.
  // Singles promote to effective rank 2.5 — still lose to triples, quads, penta, etc.
  const _rAct = active(B.red), _bAct = active(B.blue);
  const hectorActive = (_rAct.id === 96 && !_rAct.ko) || (_bAct.id === 96 && !_bAct.ko);
  const rEffRank = (hectorActive && rR.type === 'singles' && bR.type === 'doubles') ? 2.5 : typeRank[rR.type];
  const bEffRank = (hectorActive && bR.type === 'singles' && rR.type === 'doubles') ? 2.5 : typeRank[bR.type];

  if (rEffRank > bEffRank) winner = 'red';
  else if (bEffRank > rEffRank) winner = 'blue';
  else if (rR.value > bR.value) winner = 'red';
  else if (bR.value > rR.value) winner = 'blue';
  else {
    // Same hand type AND same value — cascading tiebreaker on remaining dice
    // Remove the matched dice, then compare highest-to-lowest
    const rRemain = [...redDice];
    const bRemain = [...blueDice];
    // Remove the matching group (e.g., for doubles of 6, remove two 6s from each)
    const matchCount = {doubles:2, triples:3, quads:4, penta:5, singles:1, none:0}[rR.type] || 0;
    for (let i = 0; i < matchCount; i++) {
      const ri = rRemain.indexOf(rR.value);
      if (ri >= 0) rRemain.splice(ri, 1);
      const bi = bRemain.indexOf(bR.value);
      if (bi >= 0) bRemain.splice(bi, 1);
    }
    // Sort remaining descending and compare
    rRemain.sort((a,b) => b-a);
    bRemain.sort((a,b) => b-a);
    const maxLen = Math.max(rRemain.length, bRemain.length);
    for (let i = 0; i < maxLen; i++) {
      const rv = i < rRemain.length ? rRemain[i] : 0;
      const bv = i < bRemain.length ? bRemain[i] : 0;
      if (rv > bv) { winner = 'red'; tiebreaker = {value: rv}; break; }
      if (bv > rv) { winner = 'blue'; tiebreaker = {value: bv}; break; }
    }
  }

  // Highlight dice immediately — winner dice glow, losers fade
  if (winner) {
    const loser = winner === 'red' ? 'blue' : 'red';
    const wRoll = winner === 'red' ? rR : bR;
    setTimeout(() => highlightWinnerDice(winner, wRoll, loser, tiebreaker), 80);
  }

  // ========================================
  // SYLVIA (313) — PORPOISE PLAYER-ROLLED DODGE
  // v331: if the losing fighter is Sylvia and no result is pending yet,
  // show the Sylvia modal so the player rolls 1 die themselves. The modal
  // stores B.sylviaPendingResult then re-enters resolveRound with
  // B.sylviaResuming=true to pick up where we left off.
  // Ties (winner === null) don't trigger — Sylvia only cares about losses.
  // ========================================
  if (winner !== null && !sylviaResuming && !B.sylviaPendingResult) {
    const loserTeamName = winner === 'red' ? 'blue' : 'red';
    const loserF = active(B[loserTeamName]);
    if (loserF && loserF.id === 313 && !loserF.ko) {
      showSylviaModal(loserTeamName, () => {
        B.sylviaResuming = true;
        resolveRound();
      });
      return;
    }
  }

  if (winner === null) {
    // ========================================
    // TIE — reset dice highlight so previous round's glow doesn't linger
    // ========================================
    let dupyFrolicKO = false;
    ['red','blue'].forEach(team => {
      const el = document.getElementById(team + '-dice');
      if (el) el.querySelectorAll('.die').forEach(d => {
        d.classList.remove('die-win','die-win-doubles','die-win-triples','die-win-mega','die-win-secondary','die-loser');
      });
    });

    // Mark both active ghosts as having rolled (so Ambush/Lurk don't fire next round).
    active(B.red)._rolledOnce = true;
    active(B.blue)._rolledOnce = true;
    log(`<span class="log-ability">TIE!</span> No damage dealt.`);
    narrate(`Both roll ${describeRoll(rR)} — <b class="gold">a standoff!</b> No damage dealt.`);
    playSfx('sfxSpecial', 0.3);

    // Queue tie-round ability callouts so they play sequentially
    abilityQueue = [];
    abilityQueueMode = true;

    // Tweak and Twonk (303) — sideline: tie → gain 4 Surge (Roaring Crowd)
    // Sandwiches (33) — Dependable: mirrors the Surge grant to opponent.
    [B.red, B.blue].forEach(team => {
      const tNameTie = team === B.red ? 'red' : 'blue';
      if (hasSideline(team, 303)) {
        const tweakGhost = getSidelineGhost(team, 303);
        const oppTeamTweak = opp(team);
        const sandwichMirrorsTweak = hasSideline(oppTeamTweak, 33);
        const surgeTotal = team.resources.surge + 4;
        queueAbility('ROARING CROWD!', 'var(--common)', `Tweak and Twonk — Tie! +4 Surge! (${surgeTotal} total)`, () => {
          team.resources.surge += 4;
          popSidelineCard(team, 303);
          log(`<span class="log-ability">Tweak and Twonk</span> (sideline) — Roaring Crowd! Tie → gained <span class="log-ms">4 Surge</span>!`);
          renderBattle();
        }, tNameTie);
        // Knight reactions must be queued WHILE abilityQueueMode===true (not inside onShow
        // where abilityQueueMode is false and checkKnightEffects fires showAbilityCallout
        // directly, stomping the ROARING CROWD! callout still on screen).
        checkKnightEffects(tNameTie, 'Tweak and Twonk', tweakGhost);
        if (sandwichMirrorsTweak) {
          queueAbility('DEPENDABLE!', 'var(--common)', `Sandwiches — mirrors Roaring Crowd! +4 Surge! (${oppTeamTweak.resources.surge + 4} total)`, () => { oppTeamTweak.resources.surge += 4; renderBattle(); }, tNameTie === 'red' ? 'blue' : 'red');
        }
      }
    });

    // Jimmy (352) — Sideline & In Play: tie → gain 5 Lucky Stones + 1 Magic Firefly
    [B.red, B.blue].forEach(team => {
      const f = active(team);
      const tNameJim = team === B.red ? 'red' : 'blue';
      const hasJimmyActive = f.id === 352 && !f.ko;
      const hasJimmySideline = hasSideline(team, 352);
      if (hasJimmyActive || hasJimmySideline) {
        const oppTeamJim = team === B.red ? B.blue : B.red;
        const sandwichMirrorsJim = hasSideline(oppTeamJim, 33);
        const lsTotal = team.resources.luckyStone + 5;
        const ffTotal = (team.resources.firefly || 0) + 1;
        const jimmyGhost = hasJimmyActive ? f : team.ghosts.find(g => g.id === 352);
        queueAbility('CHIRP!', 'var(--common)', `${jimmyGhost.name} — Tie! +5 Lucky Stones + 1 Magic Firefly! (${lsTotal} LS, ${ffTotal} FF)`, () => {
          team.resources.luckyStone += 5;
          team.resources.firefly = (team.resources.firefly || 0) + 1;
          log(`<span class="log-ability">${jimmyGhost.name}</span> — Chirp! Tie → gained <span class="log-ms">5 Lucky Stones</span> + <span class="log-ms">1 Magic Firefly</span>!`);
          renderBattle();
        }, tNameJim);
        checkKnightEffects(tNameJim, jimmyGhost.name);
        if (sandwichMirrorsJim) {
          queueAbility('DEPENDABLE!', 'var(--common)', `Sandwiches — mirrors Chirp! +5 Lucky Stones + 1 Magic Firefly!`, () => { oppTeamJim.resources.luckyStone += 5; oppTeamJim.resources.firefly = (oppTeamJim.resources.firefly || 0) + 1; renderBattle(); }, tNameJim === 'red' ? 'blue' : 'red');
        }
      }
    });

    // Goobs (444) — Dance Break: Sideline & In Play: on a tie, both players gain 1 of every resource
    // Check BOTH teams; fire once even if both teams have Goobs
    {
      let goobFired = false;
      [B.red, B.blue].forEach(team => {
        if (goobFired) return;
        const f = active(team);
        const tNameGoob = team === B.red ? 'red' : 'blue';
        const hasGoobActive = f.id === 444 && !f.ko;
        const hasGoobSideline = hasSideline(team, 444);
        if (hasGoobActive || hasGoobSideline) {
          goobFired = true;
          const goobGhost = hasGoobActive ? f : team.ghosts.find(g => g.id === 444);
          const goobName = goobGhost ? goobGhost.name : 'Goobs';
          const goobTeam = B[tNameGoob];
          const goobActiveGhost = active(goobTeam);
          queueAbility('DANCE PARTY!', 'var(--uncommon)', `${goobName} — Tie! Both players gain 1 Magic Firefly! ${goobActiveGhost.name} +5 HP!`, () => {
            [B.red, B.blue].forEach(t => {
              if (!t.resources.firefly) t.resources.firefly = 0;
              t.resources.firefly += 1;
            });
            goobActiveGhost.hp += 5;
            log(`<span class="log-ability">${goobName}</span> — Dance Party! Both teams gain <span class="log-ms">+1 Magic Firefly!</span> <span class="log-heal">${goobActiveGhost.name} +5 HP!</span>`);
            renderBattle();
          }, tNameGoob);
          checkKnightEffects(tNameGoob, goobName);
        }
      });
    }

    // Kairan (68) — Let's Dance: doubles (win, lose, or tie) → +1 die next roll
    [B.red, B.blue].forEach(team => {
      const f = active(team);
      const tNameKai = team === B.red ? 'red' : 'blue';
      const kaiRoll = team === B.red ? rR : bR;
      if (f.id === 68 && !f.ko && kaiRoll.type === 'doubles') {
        B.letsDanceBonus[tNameKai] = (B.letsDanceBonus[tNameKai] || 0) + 1;
        queueAbility("LET'S DANCE!", 'var(--rare)', `${f.name} — Doubles on a tie! +1 die next roll!`, null, tNameKai);
        checkKnightEffects(tNameKai, f.name);
        log(`<span class="log-ability">${f.name}</span> — Let's Dance! Doubles tie → +1 die next round.`);
      }
    });

    // Outlaw (43) — Thief: doubles (tie) → steal 1 enemy die next roll
    [B.red, B.blue].forEach(team => {
      const f = active(team);
      const tNameOut = team === B.red ? 'red' : 'blue';
      const outRoll = team === B.red ? rR : bR;
      if (f.id === 43 && !f.ko && outRoll.type === 'doubles') {
        B.outlawStolenDie[tNameOut] = (B.outlawStolenDie[tNameOut] || 0) + 1;
        queueAbility('THIEF!', 'var(--uncommon)', `${f.name} — Doubles tie! Stealing 1 die from enemy next round!`, null, tNameOut);
        log(`<span class="log-ability">${f.name}</span> — Thief! Doubles tie → steal 1 enemy die next round.`);
        checkKnightEffects(tNameOut, f.name);
      }
    });

    // Haywire (78) — Wild Chords: tie — triples or better grants +1 permanent die AND Haywire +2 damage for the rest of the game (once per game)
    [B.red, B.blue].forEach(team => {
      const f = active(team);
      const tNameHW = team === B.red ? 'red' : 'blue';
      const hwRoll = team === B.red ? rR : bR;
      if (f.id === 78 && !f.ko && isTripleOrBetter(hwRoll.type) && B.haywireUsed && !B.haywireUsed[tNameHW]) {
        B.haywireBonus[tNameHW] = (B.haywireBonus[tNameHW] || 0) + 1;
        B.haywireDamageBonus[tNameHW] = 2;
        B.haywireUsed[tNameHW] = true;
        queueAbility('WILD CHORDS!', 'var(--rare)', `${f.name} — Triples or better on a tie! +1 permanent die AND Haywire gains +2 damage for the rest of the game! (Once per game)`, null, tNameHW);
        log(`<span class="log-ability">${f.name}</span> — Wild Chords! Triples or better tie → +1 permanent die + Haywire +2 damage for the rest of the game!`);
        checkKnightEffects(tNameHW, f.name);
      }
    });

    // Scallywags (19) — Frenzy: tie — if Scallywags' own dice are all under 4, gain +1 die next turn
    [B.red, B.blue].forEach(team => {
      const f = active(team);
      const tNameSC = team === B.red ? 'red' : 'blue';
      const scDice = team === B.red ? redDice : blueDice;
      if (f.id === 19 && !f.ko && scDice && scDice.length > 0 && scDice.every(d => d < 4)) {
        B.scallywagsFrenzyBonus[tNameSC] = (B.scallywagsFrenzyBonus[tNameSC] || 0) + 1;
        queueAbility('FRENZY!', 'var(--common)', `${f.name} — All dice under 4 on a tie! +1 die next roll!`, null, tNameSC);
        log(`<span class="log-ability">${f.name}</span> — Frenzy! Tie: all dice under 4 → +1 die next round.`);
        checkKnightEffects(tNameSC, f.name);
      }
    });

    // Floop (20) — Muck: tie — if opponent rolled doubles, they lose 1 die next round
    [B.red, B.blue].forEach(team => {
      const f = active(team);
      if (f.id === 20 && !f.ko) {
        const enemyTeam = opp(team);
        const enemyTName = enemyTeam === B.red ? 'red' : 'blue';
        const enemyRoll = enemyTeam === B.red ? rR : bR;
        if (enemyRoll.type === 'doubles') {
          B.floopMuck[enemyTName] = (B.floopMuck[enemyTName] || 0) + 1;
          queueAbility('MUCK!', 'var(--common)', `${f.name} — ${active(enemyTeam).name} rolled doubles on a tie! They lose 1 die next round!`, null, team === B.red ? 'red' : 'blue');
          log(`<span class="log-ability">${f.name}</span> — Muck! ${active(enemyTeam).name} rolled doubles → -1 die next round.`);
          checkKnightEffects(team === B.red ? 'red' : 'blue', f.name);
        }
      }
    });

    // Logey (26) — Heinous: tie — count opponent's 5+ dice, lock them out next roll
    [B.red, B.blue].forEach(team => {
      const f = active(team);
      if (f.id === 26 && !f.ko) {
        const enemyTeam = opp(team);
        const enemyTName = enemyTeam === B.red ? 'red' : 'blue';
        const enemyDice = enemyTeam === B.red ? redDice : blueDice;
        const locked = (enemyDice || []).filter(d => d >= 5).length;
        if (locked > 0) {
          B.logeyLockout[enemyTName] = (B.logeyLockout[enemyTName] || 0) + locked;
          queueAbility('HEINOUS!', 'var(--common)', `${f.name} — Tie! ${locked} of ${active(enemyTeam).name}'s dice (5+) locked out next roll!`, null, team === B.red ? 'red' : 'blue');
          log(`<span class="log-ability">${f.name}</span> — Heinous! Tie: locked ${locked} of enemy's 5+ dice.`);
          checkKnightEffects(team === B.red ? 'red' : 'blue', f.name);
        }
      }
    });

    // Sable (413) — Smoldering Soul: all odd dice → +1 Sacred Fire (active or sideline, tie path)
    [B.red, B.blue].forEach(team => {
      const f = active(team);
      const tNameSable = team === B.red ? 'red' : 'blue';
      const sableDice = team === B.red ? redDice : blueDice;
      const hasSableActive = f.id === 413 && !f.ko;
      const hasSableSideline = hasSideline(team, 413);
      if ((hasSableActive || hasSableSideline) && sableDice && sableDice.length > 0 && sableDice.every(d => d % 2 === 1)) {
        team.resources.fire++;
        const sableName = hasSableActive ? f.name : (getSidelineGhost(team, 413) || { name: 'Sable' }).name;
        const sableLoc = hasSableActive ? '' : ' (sideline)';
        queueAbility('SMOLDERING SOUL!', 'var(--uncommon)', `${sableName}${sableLoc} — All dice odd! +1 Sacred Fire!`, null, tNameSable);
        log(`<span class="log-ability">${sableName}</span> — Smoldering Soul! All dice odd → <span class="log-ms">+1 Sacred Fire!</span>`);
        checkKnightEffects(tNameSable, sableName);
      }
    });

    // Pip (418) — Toasted: triples+ → remove 1 enemy die permanently + 2 Sacred Fires (once per game, tie path)
    [B.red, B.blue].forEach(team => {
      const f = active(team);
      const tNamePip = team === B.red ? 'red' : 'blue';
      const pipRoll = team === B.red ? rR : bR;
      if (f.id === 418 && !f.ko && isTripleOrBetter(pipRoll.type) && B.pipToastedUsed && !B.pipToastedUsed[tNamePip]) {
        B.pipToastedUsed[tNamePip] = true;
        const oppName = tNamePip === 'red' ? 'blue' : 'red';
        B.pipDieRemoval[oppName] = (B.pipDieRemoval[oppName] || 0) + 1;
        team.resources.fire += 2;
        queueAbility('TOASTED!', 'var(--rare)', `${f.name} — ${pipRoll.type}! Enemy permanently loses 1 die + 2 Sacred Fires! (Once per game)`, null, tNamePip);
        log(`<span class="log-ability">${f.name}</span> — Toasted! ${pipRoll.type} → enemy -1 die permanently + <span class="log-ms">+2 Sacred Fires!</span>`);
        checkKnightEffects(tNamePip, f.name);
      }
    });

    // Dream Cat (28) — Jinx: tie where BOTH teams rolled doubles → +1 die next round
    // In a tie rR.type === bR.type, so rR.type === 'doubles' means both had doubles.
    if (rR.type === 'doubles') {
      [B.red, B.blue].forEach(team => {
        const f = active(team);
        if (f.id === 28 && !f.ko) {
          const tNameDC = team === B.red ? 'red' : 'blue';
          B.dreamCatBonus[tNameDC] = (B.dreamCatBonus[tNameDC] || 0) + 1;
          queueAbility('JINX!', 'var(--common)', `${f.name} — Both teams rolled doubles on a tie! +1 die next round!`, null, tNameDC);
          log(`<span class="log-ability">${f.name}</span> — Jinx! Both rolled doubles (tie) → +1 die next round.`);
          checkKnightEffects(tNameDC, f.name);
        }
      });
    }

    // Opa (48) — Rest: tie → gain +1 HP (overclocks! Rule #9 — do NOT add Math.min cap)
    // Mr Filbert (59) — Mask Merchant: flips heal to -1 damage when on enemy sideline.
    [B.red, B.blue].forEach(team => {
      const f = active(team);
      const tNameOpaTie = team === B.red ? 'red' : 'blue';
      if (f.id === 48 && !f.ko) {
        const opaEnemy = opp(team);
        if (hasSideline(opaEnemy, 59)) {
          const opaFlippedTie = Math.max(0, f.hp - 1);
          const opaGhostTie = f;
          queueAbility('MASK MERCHANT!', 'var(--uncommon)', `Mr Filbert — Rest cursed! ${f.name} takes 1 damage! (${f.hp}→${opaFlippedTie} HP)`, () => { opaGhostTie.hp = opaFlippedTie; if (opaGhostTie.hp <= 0) { opaGhostTie.hp = 0; opaGhostTie.ko = true; opaGhostTie.killedBy = 59; } renderBattle(); }, tNameOpaTie);
          log(`<span class="log-ability">${f.name}</span> — Rest! Mr Filbert curses → -1 HP (${opaFlippedTie} HP).`);
        } else {
          const opaNewHpTie = f.hp + 1;
          const opaOverTie = opaNewHpTie > f.maxHp;
          queueAbility('REST!', 'var(--uncommon)', `${f.name} — Tie! +1 HP! (${f.hp}→${opaNewHpTie} HP${opaOverTie ? ' · overclocked!' : ''})`, () => { f.hp++; renderBattle(); }, tNameOpaTie);
          log(`<span class="log-ability">${f.name}</span> — Rest! Tie → +1 HP (${opaNewHpTie} HP${opaOverTie ? ' overclocked!' : ''}).`);
        }
        checkKnightEffects(tNameOpaTie, f.name);
      }
    });

    // Ancient One (22) — Friend to All: sideline passive → active ghost gains +3 HP on ties
    // Negated by Cornelius (45) — Antidote: if the enemy team has Cornelius on sideline, Friend to All is blocked.
    // Mr Filbert (59) — Mask Merchant: flips the +3 heal to 3 damage when on enemy sideline (Cornelius takes priority).
    [B.red, B.blue].forEach(team => {
      const f = active(team);
      const tNameAO = team === B.red ? 'red' : 'blue';
      if (!hasSideline(team, 22) || f.ko) return;
      const aoEnemy = opp(team);
      if (hasSideline(aoEnemy, 45)) {
        const cornGhostAO = getSidelineGhost(aoEnemy, 45);
        queueAbility('ANTIDOTE!', 'var(--uncommon)', `${cornGhostAO ? cornGhostAO.name : 'Cornelius'} (sideline) — blocks Ancient One's Friend to All on ${f.name}!`, () => { renderBattle(); }, tNameAO);
        checkKnightEffects(tNameAO, cornGhostAO ? cornGhostAO.name : 'Cornelius');
        log(`<span class="log-ability">Cornelius</span> (sideline) — Antidote! Friend to All blocked for ${f.name}.`);
      } else if (hasSideline(aoEnemy, 59)) {
        const aoFlipped = Math.max(0, f.hp - 3);
        queueAbility('MASK MERCHANT!', 'var(--uncommon)', `Mr Filbert — Friend to All cursed! ${f.name} takes 3 damage! (${f.hp}→${aoFlipped} HP)`, () => { f.hp = Math.max(0, f.hp - 3); if (f.hp <= 0) { f.hp = 0; f.ko = true; f.killedBy = 59; } renderBattle(); }, tNameAO);
        checkKnightEffects(tNameAO, 'Mr Filbert');
        log(`<span class="log-ability">${f.name}</span> — Friend to All! Mr Filbert curses → -3 HP (${aoFlipped} HP).`);
      } else {
        const aoNewHp = f.hp + 3;
        const aoOver = aoNewHp > f.maxHp;
        queueAbility('FRIEND TO ALL!', 'var(--common)', `Ancient One — Tie! ${f.name} gains +3 HP! (${f.hp}→${aoNewHp} HP${aoOver ? ' · overclocked!' : ''})`, () => { f.hp += 3; renderBattle(); }, tNameAO);
        checkKnightEffects(tNameAO, 'Ancient One');
        log(`<span class="log-ability">${f.name}</span> — Friend to All! Tie → +3 HP (${aoNewHp} HP${aoOver ? ' overclocked!' : ''}).`);
      }
    });

    // Maximo (302) — end of round: gain 1 Healing Seed
    // Sandwiches (33) — Dependable: if opponent gains a seed, mirror it.
    // (Wisp 344 is permanently shelved — no resource-denial guard here)
    [B.red, B.blue].forEach(team => {
      const f = active(team);
      const tNameMax = team === B.red ? 'red' : 'blue';
      if (f.id === 302 && !f.ko) {
        const oppTeamMax    = opp(team);
        const sandwichMirrorsMax = hasSideline(oppTeamMax, 33);
        queueAbility('NAP!', 'var(--common)', `${f.name} — +1 Healing Seed and +1 Lucky Stone while napping!`, () => {
          team.resources.healingSeed++;
          team.resources.luckyStone++;
          log(`<span class="log-ability">${f.name}</span> — Nap! Gained <span class="log-ms">1 Healing Seed</span> + <span class="log-ms">1 Lucky Stone</span>.`);
          renderBattle();
        }, tNameMax);
        // Knight reactions must be queued WHILE abilityQueueMode===true (not inside onShow
        // where abilityQueueMode is false and checkKnightEffects fires showAbilityCallout
        // directly, stomping the NAP! callout still on screen).
        checkKnightEffects(tNameMax, f.name);
        if (sandwichMirrorsMax) {
          queueAbility('DEPENDABLE!', 'var(--common)', `Sandwiches — mirrors Nap! +1 Healing Seed + 1 Lucky Stone!`, () => { oppTeamMax.resources.healingSeed++; oppTeamMax.resources.luckyStone++; renderBattle(); }, tNameMax === 'red' ? 'blue' : 'red');
        }
      }
    });

    // Dupy (12) — Frolic: tie → instant KO the opposing ghost
    [B.red, B.blue].forEach(team => {
      const f = active(team);
      const ef = active(opp(team));
      const tNameDupy = team === B.red ? 'red' : 'blue';
      if (f.id === 12 && !f.ko && !ef.ko) {
        ef.hp = 0;
        ef.ko = true;
        ef.killedBy = 12;
        dupyFrolicKO = true;
        playDamageSfx();
        queueAbility('FROLIC!', 'var(--common)', `${f.name} — Tie! ${ef.name} instantly KO'd!`, () => { hitDamage(tNameDupy); renderBattle(); }, tNameDupy);
        log(`<span class="log-ability">${f.name}</span> — Frolic! Tie → ${ef.name} <span class="log-ko">instantly KO'd!</span>`);
        checkKnightEffects(tNameDupy, f.name);
      }
    });

    abilityQueueMode = false;

    // Reset committed resources + Blackout picks + per-round ability flags
    B.committed.red = { ice:0, fire:0, surge:0, auntSusan:0, auntSusanHeal:0, harrison:0, zainBlade:0 };
    B.committed.blue = { ice:0, fire:0, surge:0, auntSusan:0, auntSusanHeal:0, harrison:0, zainBlade:0 };
    B.blackoutNum = {};
    B.pressureUsed = { red: false, blue: false };
    if (B.romyPrediction) { B.romyPrediction.red = null; B.romyPrediction.blue = null; }
    if (B.guardianFairyStandby) { B.guardianFairyStandby.red = false; B.guardianFairyStandby.blue = false; }
    if (B.eloiseUsedThisRound) { B.eloiseUsedThisRound.red = false; B.eloiseUsedThisRound.blue = false; }
    // bogeyArmed removed v430 — Bogey reflect is now reactive (no pre-arm state)
    // Duel Phase: tie rounds DON'T clear duelLastLoser — the previous non-tie loser's
    // initiative is sticky, so it carries forward through tie rounds. "Easier to
    // understand: tie round just keeps the last loser as first mover." (Wyatt, v394)
    if (B.galeForceDecided) { B.galeForceDecided.red = false; B.galeForceDecided.blue = false; }
    if (B.jacksonUsedThisRound) { B.jacksonUsedThisRound.red = false; B.jacksonUsedThisRound.blue = false; }
    if (B.sonyaUsedThisRound) { B.sonyaUsedThisRound.red = false; B.sonyaUsedThisRound.blue = false; }
    // Dark Wing (76) Precision: NO per-round reset — once-per-GAME flag persists across rounds (v595)
    if (B.mallowDecided) { B.mallowDecided.red = false; B.mallowDecided.blue = false; }
    if (B.fangUndercoverArmed) { B.fangUndercoverArmed.red = false; B.fangUndercoverArmed.blue = false; } // clear — tied, no damage taken
    if (B.tylerDecidedThisRound) { B.tylerDecidedThisRound.red = false; B.tylerDecidedThisRound.blue = false; }
    if (B.booTeamworkDecidedThisRound) { B.booTeamworkDecidedThisRound.red = false; B.booTeamworkDecidedThisRound.blue = false; }
    if (B.luckyStoneSpentThisTurn) { B.luckyStoneSpentThisTurn.red = 0; B.luckyStoneSpentThisTurn.blue = 0; }
    if (B.preRollAbilitiesFiredThisTurn) { B.preRollAbilitiesFiredThisTurn.red = false; B.preRollAbilitiesFiredThisTurn.blue = false; }
    // Willow (435) — Joy of Painting: tie = nobody lost, clear both flags
    if (B.willowLostLast) { B.willowLostLast.red = false; B.willowLostLast.blue = false; }
    // Reset item swing toggles each round (player must actively choose to swing)
    if (B.flameBladeSwing) { B.flameBladeSwing.red = false; B.flameBladeSwing.blue = false; }
    if (B.iceBladeSwing) { B.iceBladeSwing.red = false; B.iceBladeSwing.blue = false; }
    // Toby — Pure Heart: carry forward scheduled KO, then clear declaration (tie path)
    if (B.pureHeartDeclared) {
      if (B.pureHeartDeclared.red === true && B.pureHeartScheduledKO) B.pureHeartScheduledKO.red = true;
      if (B.pureHeartDeclared.blue === true && B.pureHeartScheduledKO) B.pureHeartScheduledKO.blue = true;
      B.pureHeartDeclared.red = null;
      B.pureHeartDeclared.blue = null;
    }
    B.selenePending = null; // discard any doubles-triggered Selene reward from this tie round — it must not ghost into the next round's post-roll flow
    B.wiseAlPending = null;
    B.gordokPending = null;

    B.round++;
    B.phase = 'ko-pause'; // brief hold on tie so narration lands
    B.preRoll = null;
    renderDice(redDice, blueDice);
    renderBattle();

    // Drain tie-round ability callouts, then resume.
    // drainAbilityQueue now fires its callback 1500ms after the LAST callout fires —
    // 100ms after the 1400ms splash auto-dismisses — so roll buttons only become live
    // after the last callout is fully cleared.  The old 600ms wrapper (v111) that
    // compensated for the former 900ms early-callback window has been removed.
    // Narrate first, then enable buttons 350ms later — same breathing-room pattern as
    // the no-KO path (v110), KO path (v114), and openKoSwap all-swaps-done (v113).
    // Previously: B.phase='ready' + resetRollButtons() fired BEFORE narrate(), making
    // roll buttons live the instant the callback ran — zero reading time on "Round N".
    drainAbilityQueue(() => {
      // Dupy (12) — Frolic killed on this tie — hand off to KO swap flow
      if (dupyFrolicKO) {
        if (!handleKOs()) renderBattle();
        return;
      }
      narrate(`<b class="gold">Round ${B.round}</b> — <b class="red-text">${active(B.red).name}</b>&nbsp;vs&nbsp;<b class="blue-text">${active(B.blue).name}</b>`);
      renderBattle();
      setTimeout(() => { startNextRound(); }, 350);
    });
    return;
  }

  // ========================================
  // PHASE 5: RESOLVE DAMAGE
  // ========================================
  const winTeamName = winner;
  const winTeam = B[winner];
  const loseTeamName = winner === 'red' ? 'blue' : 'red';
  const loseTeam = opp(winTeam);
  // Mr Filbert (59) — Mask Merchant: while on the enemy sideline, any healing the opponent receives
  // is flipped to damage instead. filbertCursesWin = Filbert is on loseTeam's bench → wF heals → damage.
  const filbertCursesWin = hasSideline(loseTeam, 59);
  const filbertCursesLose = hasSideline(winTeam, 59);
  // Slag Heap (339) is permanently shelved — slagResidueBlocksWin always false; dead code removed in v363
  // Sandwiches (33) — Dependable: while on the sideline, if opponent gains a Special, you gain it too.
  // sandwichForLose = Sandwiches on loseTeam bench → mirrors winTeam Special grants to loseTeam.
  // sandwichForWin  = Sandwiches on winTeam bench  → mirrors loseTeam Special grants to winTeam.
  const sandwichForLose = hasSideline(loseTeam, 33);
  const sandwichForWin  = hasSideline(winTeam, 33);
  const wF = active(winTeam);
  const lF = active(loseTeam);
  // Per-ghost first-roll tracking for Nikon (2) Ambush and Cave Dweller (46) Lurk.
  // B.round === 1 is WRONG for KO-swap replacements — a ghost brought in round 4 has their
  // "first roll" in round 4, not round 1. Solution: tag each ghost object with _rolledOnce
  // (falsy until they've resolved their first roll as either winner or loser). Checked here,
  // BEFORE being set to true, so the first call into resolveRound correctly captures state.
  const nikonIsFirstRoll = (wF.id === 2 && !wF._rolledOnce);
  const caveDwellerIsFirstRoll = (wF.id === 46 && !wF._rolledOnce);
  wF._rolledOnce = true;
  lF._rolledOnce = true;
  const wR = winner==='red' ? rR : bR;
  const lR = winner==='red' ? bR : rR;
  const winDice = winner==='red' ? redDice : blueDice;
  const loseDice = winner==='red' ? blueDice : redDice;

  let dmg = wR.damage;

  // v386: collectKC defined BEFORE any ability block that might call it (was TDZ-declared
  // at line ~8163 but referenced by Skylar Winter Barrage at 8131 and Tyler Heating Up
  // at 8144 — would throw ReferenceError if either fighter was active with ice/fire
  // committed. Same bug class as v305 teamLabel and v377 calloutCount.)
  const resolveKnightCallouts = [];
  const collectKC = (t, n, s) => {
    const savedQ = abilityQueue, savedM = abilityQueueMode;
    abilityQueue = []; abilityQueueMode = true;
    checkKnightEffects(t, n, s);
    resolveKnightCallouts.push(...abilityQueue);
    abilityQueue = savedQ; abilityQueueMode = savedM;
  };

  // Champ (438) — Thrill (A): immune to damage from Specials (committed resources)
  const champImmuneToSpecials = lF.id === 438 && !lF.ko;
  if (champImmuneToSpecials && (B.committed[winTeamName].ice > 0 || B.committed[winTeamName].fire > 0 || B.committed[winTeamName].surge > 0)) {
    log(`<span class="log-ability">${lF.name}</span> — Thrill! Immune to all committed resource damage!`);
  }

  // Committed Ice Shards: +1 per shard (Skylar Winter Barrage: +2 each)
  let skylarTriggered = false;
  if (B.committed[winTeamName].ice > 0 && !champImmuneToSpecials) {
    const skylarActive = wF.id === 104 && !wF.ko;
    const perShard = skylarActive ? 2 : 1;
    const iceDmg = B.committed[winTeamName].ice * perShard;
    dmg += iceDmg;
    if (skylarActive) {
      skylarTriggered = true;
      collectKC(winTeamName, wF.name);
    }
    log(`<span class="log-ms">Ice Shards committed!</span> <span class="log-dmg">+${iceDmg} damage!</span>${skylarActive ? ' (Winter Barrage ×2!)' : ''}`);
  }
  // Committed Sacred Fires: +3 per fire (Tyler 105 Heating Up: ×2 = +6 per fire)
  // Rook (416) — Charcoal: immune to Sacred Fire damage when Rook is the LOSER/target
  let tylerFireTriggered = false;
  if (B.committed[winTeamName].fire > 0 && lF.id !== 416 && !champImmuneToSpecials) {
    const tylerWins = wF.id === 105 && !wF.ko;
    const perFire = tylerWins ? 6 : 3;
    // Lucy's Shadow (439) — Mentor: doubles Sacred Fire damage when Lucy (108) is active winner
    const lucyShadowBoost = (wF.id === 108 && hasSideline(winTeam, 439)) ? 2 : 1;
    const fireDmg = B.committed[winTeamName].fire * perFire * lucyShadowBoost;
    dmg += fireDmg;
    if (tylerWins) {
      tylerFireTriggered = true;
      collectKC(winTeamName, wF.name);
    }
    const lucyShadowTag = lucyShadowBoost === 2 ? ' (Mentor ×2!)' : '';
    log(`<span class="log-ms">Sacred Fires committed!</span> <span class="log-dmg">+${fireDmg} damage!</span>${tylerWins ? ' (Heating Up ×2!)' : ''}${lucyShadowTag}`);

    // Eternal Flame (406) — Sacred Fires not discarded (grant deferred to ETERNAL FLAME! onShow)
  }
  // Rook (416) — Charcoal: Sacred Fire immunity log
  if (B.committed[winTeamName].fire > 0 && lF.id === 416) {
    log(`<span class="log-ability">${lF.name}</span> — Charcoal! Immune to Sacred Fire damage!`);
  }

  // Aunt Susan (309) — +2 damage per seed committed (also blocked by Champ Thrill)
  if (B.auntSusanBonus[winTeamName] > 0 && !champImmuneToSpecials) {
    const susanDmg = B.auntSusanBonus[winTeamName] * 2;
    dmg += susanDmg;
    log(`<span class="log-ability">${wF.name}</span> — Harvest Dance! <span class="log-dmg">+${susanDmg} bonus damage!</span>`);
  }

  // Rook (416) — Charcoal: Win: +1 dmg per Surge committed this round (also blocked by Champ Thrill)
  if (wF.id === 416 && !wF.ko && B.committed[winTeamName].surge > 0 && !champImmuneToSpecials) {
    const rookSurgeDmg = B.committed[winTeamName].surge;
    dmg += rookSurgeDmg;
    collectKC(winTeamName, wF.name);
    log(`<span class="log-ability">${wF.name}</span> — Charcoal! <span class="log-dmg">+${rookSurgeDmg} damage</span> from ${rookSurgeDmg} Surge committed!`);
  }

  // Haywire (78) — Wild Chords permanent +2 damage on any winning roll (after trigger)
  // Added to base before doubles/triples multipliers so the bonus scales with Mountain King etc., same precedent as Pudge 311.
  if (wF.id === 78 && !wF.ko && (B.haywireDamageBonus[winTeamName] || 0) > 0) {
    const hwDmg = B.haywireDamageBonus[winTeamName];
    dmg += hwDmg;
    log(`<span class="log-ability">${wF.name}</span> — Wild Chords damage! <span class="log-dmg">+${hwDmg} damage!</span>`);
  }

  // v386: collectKC + resolveKnightCallouts moved to ~line 8125, before any ability
  // block that might reference them. (Was: `const collectKC = …` here, which created
  // a Temporal Dead Zone for Skylar/Tyler at lines ~8131/~8144.)

  // Little Boo (9) — Mercy: enemy rolled triples count as a 1,2,3 roll instead.
  // Override wR.type to 'singles' BEFORE all damage-multiplier checks so Larry Flying Kick,
  // Haywire Wild Chords, Bubble Boys Pop, and all other triples-gated abilities see 'singles'.
  // Adjust dmg by -2 to swap base from 3 (triples) to 1 (singles); committed resources preserved.
  let mercyTriggered = false;
  if (lF.id === 9 && !lF.ko && wR.type === 'triples') {
    wR.type = 'singles';
    wR.damage = 1;
    dmg -= 2; // triples base 3 → singles base 1; committed ice/fire bonuses untouched
    mercyTriggered = true;
    collectKC(loseTeamName, lF.name);
    log(`<span class="log-ability">${lF.name}</span> — Mercy! Enemy triples converted to [1,2,3]! Base damage reduced 3 → 1!`);
  }

  // Bigsby (424) — Omen: Win: +1 damage
  if (wF.id === 424 && !wF.ko) {
    dmg += 1;
    collectKC(winTeamName, wF.name);
    log(`<span class="log-ability">${wF.name}</span> — Omen! <span class="log-dmg">+1 damage!</span>`);
  }

  // Mike (445) — Torrent: Win: +1 damage
  if (wF.id === 445 && !wF.ko) {
    dmg += 1;
    collectKC(winTeamName, wF.name);
    log(`<span class="log-ability">${wF.name}</span> — Torrent! <span class="log-dmg">+1 damage!</span>`);
  }

  // Twyla (417) — Lucky Dance: MOVED to dice count section (v674 rework: Lucky Stones give dice + Healing Seeds, not damage + HP)

  // Pudge (311) — doubles: +2 damage
  let pudgeSelfDmg = false;
  if (wF.id === 311 && !wF.ko && wR.type === 'doubles') {
    dmg += 2;
    pudgeSelfDmg = true;
    collectKC(winTeamName, wF.name);
  }

  // The Mountain King (110) — Beast Mode: doubles deal 2X damage
  let mountainKingTriggered = false;
  let mountainKingBaseDmg = 0;
  if (wF.id === 110 && !wF.ko && wR.type === 'doubles') {
    mountainKingBaseDmg = dmg;
    dmg *= 2;
    mountainKingTriggered = true;
    collectKC(winTeamName, wF.name);
  }

  // Stone Cold (73) — One-two-one!: winning with double 1s → 3X damage
  // Accept any roll containing two or more 1s (doubles, triples, quads of 1).
  let stoneColdTriggered = false;
  let stoneColdBaseDmg = 0;
  if (wF.id === 73 && !wF.ko && winDice && winDice.filter(d => d === 1).length >= 2) {
    stoneColdBaseDmg = dmg;
    dmg *= 3;
    stoneColdTriggered = true;
    collectKC(winTeamName, wF.name);
    log(`<span class="log-ability">${wF.name}</span> — One-two-one! Double 1s → 3X damage!`);
  }

  // Larry (35) — Flying Kick: triples deal 3X damage
  let larryTriggered = false;
  let larryBaseDmg = 0;
  if (wF.id === 35 && !wF.ko && wR.type === 'triples') {
    larryBaseDmg = dmg;
    dmg *= 3;
    larryTriggered = true;
    collectKC(winTeamName, wF.name);
    log(`<span class="log-ability">${wF.name}</span> — Flying Kick! Triples → 3X damage!`);
  }

  // Buttons (8) — Perfect Plan: triple 6s deal +15 bonus damage.
  // The dream: 1 HP kamikaze — if it lands, it nukes anything. 3+15=18 damage minimum.
  // Accept any roll with at least 3 sixes in the winning dice (triples/quads/penta of 6).
  let buttonsTriggered = false;
  let buttonsBaseDmg = 0;
  if (wF.id === 8 && !wF.ko && winDice && winDice.filter(d => d === 6).length >= 3) {
    buttonsBaseDmg = dmg;
    dmg += 15;
    buttonsTriggered = true;
    collectKC(winTeamName, wF.name);
    log(`<span class="log-ability">${wF.name}</span> — Perfect Plan! Triple 6s! ${buttonsBaseDmg} + 15 = ${dmg} damage!`);
  }

  // Nikon (2) — Ambush: first roll win deals 3X damage
  // nikonIsFirstRoll is captured above (before _rolledOnce is set) — works for starters AND KO-swap replacements.
  let nikonTriggered = false;
  let nikonBaseDmg = 0;
  if (wF.id === 2 && !wF.ko && nikonIsFirstRoll) {
    nikonBaseDmg = dmg;
    dmg *= 3;
    nikonTriggered = true;
    collectKC(winTeamName, wF.name);
    log(`<span class="log-ability">${wF.name}</span> — Ambush! First roll ambush → 3X damage!`);
  }

  // Cave Dweller (46) — Lurk: first roll win deals 3X damage
  // caveDwellerIsFirstRoll captured above — correct for starters AND KO-swap replacements.
  let caveDwellerTriggered = false;
  let caveDwellerBaseDmg = 0;
  if (wF.id === 46 && !wF.ko && caveDwellerIsFirstRoll) {
    caveDwellerBaseDmg = dmg;
    dmg *= 3;
    caveDwellerTriggered = true;
    collectKC(winTeamName, wF.name);
    log(`<span class="log-ability">${wF.name}</span> — Lurk! First roll ambush → 3X damage!`);
  }

  // Doom (112) — Fiendship: every win deals +2 bonus damage
  let doomTriggered = false;
  if (wF.id === 112 && !wF.ko) {
    dmg += 2;
    doomTriggered = true;
    collectKC(winTeamName, wF.name);
  }

  // Lucy (108) — Blue Fire: Win → gain 1 Sacred Fire (REWORKED 2026-04-12, swapped with Humar)
  let lucyTriggered = false;
  let lucyShadowExtraFire = false;
  if (wF.id === 108 && !wF.ko) {
    lucyTriggered = true;
    collectKC(winTeamName, wF.name);
    log(`<span class="log-ability">${wF.name}</span> — Blue Fire! Gain <span class="log-ms">1 Sacred Fire</span>!`);
    // Lucy's Shadow (439) — Mentor: +1 extra Sacred Fire when Lucy wins
    if (hasSideline(winTeam, 439)) {
      lucyShadowExtraFire = true;
      log(`<span class="log-ability">Lucy's Shadow</span> — Mentor! +1 extra Sacred Fire!`);
    }
  }

  // Gom Gom Gom (440) — Chaos: Win with doubles → gain 1 Sacred Fire (v685: moved from post-roll to win-path only)
  let gomTriggered = false;
  if (wF.id === 440 && !wF.ko && ['doubles','triples','quads','penta'].includes(wR.type)) {
    gomTriggered = true;
    collectKC(winTeamName, wF.name);
    log(`<span class="log-ability">${wF.name}</span> — Chaos! Win with doubles → <span class="log-ms">+1 Sacred Fire</span>!`);
  }

  // Humar (336) — Meteor: Win → opponent takes 2 damage before next roll + gain 1 Burn (was Lucy's old ability, buffed 1→2 dmg)
  let humarTriggered = false;
  if (wF.id === 336 && !wF.ko) {
    B.pendingLucyDmg[loseTeamName] = 2; // reuse pendingLucyDmg but with 2 damage
    if (!winTeam.resources.burn) winTeam.resources.burn = 0;
    winTeam.resources.burn += 1;
    humarTriggered = true;
    collectKC(winTeamName, wF.name);
    log(`<span class="log-ability">${wF.name}</span> — Meteor! <span class="log-dmg">2 delayed damage</span> + <span class="log-dmg">1 Burn</span>!`);
  }

  // Wim (65) — Slash: all winning dice odd → +5 damage
  let wimTriggered = false;
  let wimBaseDmg = 0;
  if (wF.id === 65 && !wF.ko && winDice && winDice.length > 0 && winDice.every(d => d % 2 === 1)) {
    wimBaseDmg = dmg;
    dmg += 5;
    wimTriggered = true;
    collectKC(winTeamName, wF.name);
    log(`<span class="log-ability">${wF.name}</span> — Slash! All dice odd → +5 damage!`);
  }

  // Snorton (67) — Fissure: two or more 6s in winning dice → +5 damage
  let snortonTriggered = false;
  let snortonBaseDmg = 0;
  if (wF.id === 67 && !wF.ko && winDice && winDice.filter(d => d === 6).length >= 2) {
    snortonBaseDmg = dmg;
    dmg += 5;
    snortonTriggered = true;
    collectKC(winTeamName, wF.name);
    log(`<span class="log-ability">${wF.name}</span> — Fissure! Two 6s → +5 damage!`);
  }

  // Pelter (86) — Snowball: doubles win → +2 bonus damage
  let pelterTriggered = false;
  let pelterBaseDmg = 0;
  if (wF.id === 86 && !wF.ko && wR.type === 'doubles') {
    pelterBaseDmg = dmg;
    dmg += 2;
    pelterTriggered = true;
    collectKC(winTeamName, wF.name);
    log(`<span class="log-ability">${wF.name}</span> — Snowball! Doubles win → +2 damage!`);
  }

  // Doc (42) — Savage: doubles win → +5 bonus damage
  let docTriggered = false;
  let docBaseDmg = 0;
  if (wF.id === 42 && !wF.ko && wR.type === 'doubles') {
    docBaseDmg = dmg;
    dmg += 5;
    docTriggered = true;
    collectKC(winTeamName, wF.name);
    log(`<span class="log-ability">${wF.name}</span> — Savage! Doubles win → +5 damage!`);
  }

  // Charlie (18) — Rush: double 2s → exactly 7 damage (fixed output override)
  let charlieTriggered = false;
  let charlieBaseDmg = 0;
  if (wF.id === 18 && !wF.ko && wR.type === 'doubles' && wR.value === 2) {
    charlieBaseDmg = dmg;
    dmg = 7;
    charlieTriggered = true;
    collectKC(winTeamName, wF.name);
    log(`<span class="log-ability">${wF.name}</span> — Rush! Double 2s → exactly 7 damage!`);
  }

  // Bill & Bob (36) — Bait n Switch: while below 4 HP, winning rolls deal 2X damage
  let billBobTriggered = false;
  let billBobBaseDmg = 0;
  if (wF.id === 36 && !wF.ko && wF.hp < 4) {
    billBobBaseDmg = dmg;
    dmg *= 2;
    billBobTriggered = true;
    collectKC(winTeamName, wF.name);
    log(`<span class="log-ability">${wF.name}</span> — Bait n Switch! Below 4 HP → 2X damage!`);
  }

  // Alucard (38) — Colony Call: doubles win → +2 damage per alive sideline ghost. Once per game.
  let alucardTriggered = false;
  let alucardBaseDmg = 0;
  let alucardSidelineCount = 0;
  if (wF.id === 38 && !wF.ko && wR.type === 'doubles' && B.alucardUsed && !B.alucardUsed[winTeamName]) {
    alucardSidelineCount = winTeam.ghosts.filter((g, i) => i !== winTeam.activeIdx && !g.ko).length;
    if (alucardSidelineCount > 0) {
      alucardBaseDmg = dmg;
      dmg += alucardSidelineCount * 2;
      alucardTriggered = true;
      B.alucardUsed[winTeamName] = true;
      collectKC(winTeamName, wF.name);
      log(`<span class="log-ability">${wF.name}</span> — Colony Call! ${alucardSidelineCount} sideline ghost${alucardSidelineCount>1?'s':''} × 2 = +${alucardSidelineCount*2} damage!`);
    }
  }

  // Castle Guards (39) — Flamethrower: each 3 in winning dice multiplies damage by 2.
  // e.g. one 3 = 2X, two 3s = 4X, three 3s = 8X. Only fires when at least one 3 is rolled.
  let castleGuardsTriggered = false;
  let castleGuardsBaseDmg = 0;
  let castleGuardsThreeCount = 0;
  if (wF.id === 39 && !wF.ko && winDice && winDice.length > 0) {
    castleGuardsThreeCount = winDice.filter(d => d === 3).length;
    if (castleGuardsThreeCount > 0) {
      castleGuardsBaseDmg = dmg;
      for (let t = 0; t < castleGuardsThreeCount; t++) dmg *= 2;
      castleGuardsTriggered = true;
      collectKC(winTeamName, wF.name);
      log(`<span class="log-ability">${wF.name}</span> — Flamethrower! ${castleGuardsThreeCount} three${castleGuardsThreeCount>1?'s':''} → ${castleGuardsBaseDmg} × ${Math.pow(2,castleGuardsThreeCount)} = ${dmg} damage!`);
    }
  }

  // Team Zippy (40) — Teamwork: singles win deals +2 bonus damage.
  // Ported from boobattles: `if (roll.type === 'singles') damage += 2`.
  let teamZippyTriggered = false;
  let teamZippyBaseDmg = 0;
  if (wF.id === 40 && !wF.ko && wR.type === 'singles') {
    teamZippyBaseDmg = dmg;
    dmg += 2;
    teamZippyTriggered = true;
    collectKC(winTeamName, wF.name);
    log(`<span class="log-ability">${wF.name}</span> — Teamwork! Singles win → +2 damage!`);
  }

  // Greg (49) — Chase: if Greg has more HP than the opposing ghost, rolls deal 2X damage.
  // Faithfully ported from GHOSTS abilityDesc: "If Greg has more health than the opposing ghost, Greg's rolls do x2 damage."
  let gregTriggered = false;
  let gregBaseDmg = 0;
  if (wF.id === 49 && !wF.ko && wF.hp > lF.hp) {
    gregBaseDmg = dmg;
    dmg *= 2;
    gregTriggered = true;
    collectKC(winTeamName, wF.name);
    log(`<span class="log-ability">${wF.name}</span> — Chase! Greg has ${wF.hp} HP vs enemy ${lF.hp} HP → 2X damage!`);
  }

  // Tommy Salami (30) — Regulator: bonus dice from chain-6s were already added in checkTommyRegulator.
  // No win-path damage bonus — the extra dice ARE the benefit (more dice = higher hand type / more damage).
  let tommyTriggered = false;
  let tommyRegulatedCount = (B.tommyRegulatorBonus && B.tommyRegulatorBonus[winTeamName]) || 0;
  if (wF.id === 30 && !wF.ko && tommyRegulatedCount > 0) {
    tommyTriggered = true;
    collectKC(winTeamName, wF.name);
  }

  // Romy (114) — Valley Guardian: if prediction matches any winning die, +3 damage
  // Capture prediction now; clear both teams so neither carries over to next round.
  const romyPredRed = (B.romyPrediction || {}).red;
  const romyPredBlue = (B.romyPrediction || {}).blue;
  if (B.romyPrediction) { B.romyPrediction.red = null; B.romyPrediction.blue = null; }
  const romyWinPred = winTeamName === 'red' ? romyPredRed : romyPredBlue;
  let romyTriggered = false;
  if (wF.id === 114 && !wF.ko && romyWinPred != null && winDice && winDice.includes(romyWinPred)) {
    dmg += 3;
    romyTriggered = true;
    collectKC(winTeamName, wF.name);
  }

  // Hector (96) — Protector: singles win → +1 bonus damage
  let hectorTriggered = false;
  if (wF.id === 96 && !wF.ko && wR.type === 'singles') {
    dmg += 1;
    hectorTriggered = true;
    collectKC(winTeamName, wF.name);
  }

  // Toby (97) — Pure Heart: win with declaration → instant KO enemy (boost dmg to exactly KO)
  let pureHeartKO = false;
  if (wF.id === 97 && !wF.ko && B.pureHeartDeclared && B.pureHeartDeclared[winTeamName] === true) {
    dmg = Math.max(dmg, lF.hp); // guarantee KO via normal damage resolution at Beat 3
    pureHeartKO = true;
    collectKC(winTeamName, wF.name);
    log(`<span class="log-ability">${wF.name}</span> — Pure Heart! Instant KO — ${lF.name} is defeated!`);
  }

  // Zain (206) — Ice Blade: permanent +2 damage on ALL winning rolls once forged AND swinging
  // Fires for ANY ghost on the team, not just Zain.
  let zainIceBladeTriggered = false;
  if (B.iceBladeForgedPermanent && B.iceBladeForgedPermanent[winTeamName] && (B.committed[winTeamName].zainBlade > 0 || (B.iceBladeSwing && B.iceBladeSwing[winTeamName]))) {
    dmg += 2;
    zainIceBladeTriggered = true;
  }

  // Flame Blade: +5 Burn on win when swinging
  let flameBladeWinTriggered = false;
  if (B.flameBlade && B.flameBlade[winTeamName] && B.flameBladeSwing && B.flameBladeSwing[winTeamName]) {
    if (!winTeam.resources.burn) winTeam.resources.burn = 0;
    winTeam.resources.burn += 5;
    flameBladeWinTriggered = true;
    log(`<span class="log-ability">Flame Blade</span> — Win while swinging! <span class="log-dmg">+5 Burn!</span>`);
  }

  // Red Hunter (345) — if opponent has any specials (resources, including committed): +3 damage
  let redHunterTriggered = false;
  if (wF.id === 345 && !wF.ko) {
    const eRes = loseTeam.resources;
    const eCom = B.committed[loseTeamName];
    const hasSpecials = (eRes.moonstone + (eCom.moonstone||0)) > 0
      || (eRes.ice + (eCom.ice||0)) > 0
      || (eRes.fire + (eCom.fire||0)) > 0
      || (eRes.surge + (eCom.surge||0)) > 0
      || (eRes.healingSeed + (eCom.healingSeed||0)) > 0
      || (eRes.luckyStone + (eCom.luckyStone||0)) > 0;
    if (hasSpecials) {
      dmg += 3;
      redHunterTriggered = true;
      collectKC(winTeamName, wF.name);
    }
  }

  // Timpleton (312) — Big Target: v640 rework — Win a roll, deal +3 damage if enemy HP > Timpleton's HP.
  // Was an Entry strike (triggerEntry) until v640. Now a Win-path damage multiplier, patterned after Red Hunter.
  let timpletonTriggered = false;
  if (wF.id === 312 && !wF.ko && lF && !lF.ko && lF.hp > wF.hp) {
    dmg += 3;
    timpletonTriggered = true;
    collectKC(winTeamName, wF.name);
  }

  // Sylvia (313) — loser dodge check: roll 1 die, if it's a 6 negate all damage.
  // v331: the die is rolled by the PLAYER via the Sylvia modal (showSylviaModal) before
  // resolveRound's second pass reaches this block. B.sylviaPendingResult = { value, dodged }
  // is set by doSylviaRoll(). If it's missing (defensive fallback), we roll 1 die here.
  // Note: callouts are intentionally NOT queued here — they are queued in the cinematic section
  // (where abilityQueueMode=true) to prevent them firing synchronously and being stomped.
  let sylviaDodged = false;
  let sylviaDodgeRolls = []; // store for callout (array form for back-compat with callout)
  if (lF.id === 313 && !lF.ko) {
    let rolledValue;
    if (B.sylviaPendingResult && typeof B.sylviaPendingResult.value === 'number') {
      rolledValue = B.sylviaPendingResult.value;
      sylviaDodged = !!B.sylviaPendingResult.dodged;
      B.sylviaPendingResult = null; // consume
    } else {
      // Defensive fallback — should never hit in normal flow
      rolledValue = Math.floor(Math.random()*6)+1;
      sylviaDodged = (rolledValue >= 5); // 5 or 6 dodge
    }
    sylviaDodgeRolls = [rolledValue];
    if (sylviaDodged) {
      dmg = 0;
      log(`<span class="log-ability">${lF.name}</span> — Porpoise! Rolled [${rolledValue}] — <span class="log-ms">ALL DAMAGE NEGATED!</span>`);
    } else {
      log(`<span class="log-ability">${lF.name}</span> — Porpoise dodge: [${rolledValue}] (needed 5 or 6).`);
    }
    collectKC(loseTeamName, lF.name);
  }

  // Tabitha (95) — Rally: while on the sideline, +2 damage to the active ghost's doubles wins
  // Negated by Cornelius (45) — Antidote: if the LOSING team has Cornelius on sideline, Rally is blocked.
  let tabithaTriggered = false;
  const corneliusBlocksRally = hasSideline(loseTeam, 45);   // win-team's sideline effects blocked (Cornelius on loseTeam)
  const corneliusOnWinTeam = hasSideline(winTeam, 45);       // lose-team's sideline effects blocked (Cornelius on winTeam)
  // Tracks whether Cornelius actually negated a sideline effect this round (for ANTIDOTE! callout)
  let corneliusSidelineBlockedList = [];
  if (hasSideline(winTeam, 95) && wR.type === 'doubles' && !wF.ko) {
    if (corneliusBlocksRally) {
      const cornGhost2 = getSidelineGhost(loseTeam, 45);
      log(`<span class="log-ability">Cornelius</span> (sideline) — Antidote! <span class="log-ability">Tabitha</span> Rally blocked!`);
    } else {
      dmg += 2;
      tabithaTriggered = true;
      const tabithaGhost = getSidelineGhost(winTeam, 95);
      collectKC(winTeamName, 'Tabitha', tabithaGhost);
      log(`<span class="log-ability">Tabitha</span> (sideline) — Rally! Doubles win gets +2 damage!`);
    }
  }

  // Admiral (71) — Comrades: while on the sideline, +2 damage to your even doubles rolls.
  // "Even doubles" = win type is doubles AND the paired value is even (2, 4, or 6).
  // FIX v279: was winDice.every(d => d%2===0) — that required ALL dice to be even, so [4,4,3]
  // (double 4s with an odd third die) wrongly failed. Correct check is wR.value % 2 === 0.
  let admiralTriggered = false;
  let admiralBaseDmg = 0;
  if (hasSideline(winTeam, 71) && !wF.ko && wR.type === 'doubles' && wR.value % 2 === 0) {
    if (!corneliusBlocksRally) {
      admiralBaseDmg = dmg;
      dmg += 2;
      admiralTriggered = true;
      const admiralGhost = getSidelineGhost(winTeam, 71);
      collectKC(winTeamName, 'Admiral', admiralGhost);
      log(`<span class="log-ability">Admiral</span> (sideline) — Comrades! Even doubles → +2 damage!`);
    } else { corneliusSidelineBlockedList.push('Admiral'); log(`<span class="log-ability">Cornelius</span> — Antidote! Admiral Comrades blocked.`); }
  }

  // Dark Jeff (74) — Cackle: while on the sideline, all your rolls deal +1 damage.
  // Passive sideline damage booster — applies to any win when Dark Jeff is benched.
  let darkJeffTriggered = false;
  let darkJeffBaseDmg = 0;
  if (hasSideline(winTeam, 74) && !wF.ko) {
    if (!corneliusBlocksRally) {
      darkJeffBaseDmg = dmg;
      dmg += 1;
      darkJeffTriggered = true;
      const djGhost = getSidelineGhost(winTeam, 74);
      collectKC(winTeamName, 'Dark Jeff', djGhost);
      log(`<span class="log-ability">Dark Jeff</span> (sideline) — Cackle! +1 damage to all rolls!`);
    } else { corneliusSidelineBlockedList.push('Dark Jeff'); log(`<span class="log-ability">Cornelius</span> — Antidote! Dark Jeff Cackle blocked.`); }
  }

  // Bilbo (80) — Little Buddy: while on the sideline, your ghost in play gains +2 damage on singles wins.
  // Dark Castle sideline singles booster — pairs naturally with Team Zippy Teamwork (+2 singles) and Hector Protector (+1 singles).
  let bilboTriggered = false;
  let bilboBaseDmg = 0;
  if (hasSideline(winTeam, 80) && !wF.ko && wR.type === 'singles') {
    if (!corneliusBlocksRally) {
      bilboBaseDmg = dmg;
      dmg += 2;
      bilboTriggered = true;
      const bilboGhost = getSidelineGhost(winTeam, 80);
      collectKC(winTeamName, 'Bilbo', bilboGhost);
      log(`<span class="log-ability">Bilbo</span> (sideline) — Little Buddy! Singles win → +2 damage!`);
    } else { corneliusSidelineBlockedList.push('Bilbo'); log(`<span class="log-ability">Cornelius</span> — Antidote! Bilbo Little Buddy blocked.`); }
  }

  // Pale Nimbus (88) — Hidden Storm: while on the sideline, +2 damage if winning dice sum < 7.
  // Frost Valley sideline damage booster — rewards low-total rolls (1+2+3=6, 1+1+4=6, etc.) from the bench.
  let paleNimbusTriggered = false;
  let paleNimbusBaseDmg = 0;
  if (hasSideline(winTeam, 88) && !wF.ko && winDice && winDice.reduce((s, d) => s + d, 0) < 7) {
    if (!corneliusBlocksRally) {
      paleNimbusBaseDmg = dmg;
      dmg += 2;
      paleNimbusTriggered = true;
      const pnGhost = getSidelineGhost(winTeam, 88);
      collectKC(winTeamName, 'Pale Nimbus', pnGhost);
      log(`<span class="log-ability">Pale Nimbus</span> (sideline) — Hidden Storm! Roll sum ${winDice.reduce((s,d)=>s+d,0)} < 7 → +2 damage!`);
    } else { corneliusSidelineBlockedList.push('Pale Nimbus'); log(`<span class="log-ability">Cornelius</span> — Antidote! Pale Nimbus Hidden Storm blocked.`); }
  }

  // Laura (79) — Catchy Tune: Sideline & In Play: winning rolls in numeric order gain +3 damage. If triggered, also gain 2 Magic Fireflies.
  // Sequences like 1-2-3, 2-3-4, 3-4-5, 4-5-6 all qualify (any length ≥2 consecutive run without repeats).
  let lauraCatchyTriggered = false;
  let lauraCatchyBaseDmg = 0;
  const hasLauraActive = wF.id === 79 && !wF.ko;
  const hasLauraSideline = hasSideline(winTeam, 79);
  if ((hasLauraActive || hasLauraSideline) && winDice && winDice.length >= 2) {
    const _lauraSorted = [...winDice].sort((a, b) => a - b);
    const _lauraSeq = _lauraSorted.every((v, i) => i === 0 || v === _lauraSorted[i - 1] + 1);
    if (_lauraSeq) {
      if (!corneliusBlocksRally || hasLauraActive) {
        lauraCatchyBaseDmg = dmg;
        dmg += 3;
        lauraCatchyTriggered = true;
        // +1 Magic Firefly
        if (!winTeam.resources.firefly) winTeam.resources.firefly = 0;
        winTeam.resources.firefly += 2;
        const lauraName = hasLauraActive ? wF.name : (getSidelineGhost(winTeam, 79) || {}).name || 'Laura';
        const lauraLabel = hasLauraActive ? '' : ' (sideline)';
        collectKC(winTeamName, lauraName);
        log(`<span class="log-ability">${lauraName}${lauraLabel}</span> — Catchy Tune! [${_lauraSorted.join('-')}] in order → +3 damage + 2 Magic Fireflies!`);
      } else { corneliusSidelineBlockedList.push('Laura'); log(`<span class="log-ability">Cornelius</span> — Antidote! Laura Catchy Tune blocked.`); }
    }
  }

  // Gary (92) — Lucky Novice: gain +1 Ice Shard for each 1 rolled by your active ghost.
  // v598 BUFF (Wyatt 2026-04-11): Gary now fires whether he is on the sideline OR in play.
  // When Gary is active, the dice he's counting are his own.
  // Cornelius (45) Antidote still blocks sideline Gary — but an ACTIVE Gary is not a
  // sideline ability and is unaffected by Cornelius.
  const winGaryActive = wF.id === 92 && !wF.ko;
  const winGarySide = hasSideline(winTeam, 92);
  const loseGaryActive = lF.id === 92 && !lF.ko;
  const loseGarySide = hasSideline(loseTeam, 92);
  const garyOnesWin = ((winGaryActive || (winGarySide && !corneliusBlocksRally)) && winDice) ? winDice.filter(d => d === 1).length : 0;
  const garyOnesLose = ((loseGaryActive || (loseGarySide && !corneliusOnWinTeam)) && loseDice) ? loseDice.filter(d => d === 1).length : 0;
  // v599 BALANCE BUFF (Wyatt 2026-04-11): Lucky Novice grants +2 Ice Shards per 1 rolled, not +1.
  const garyIceWin = garyOnesWin * 2;
  const garyIceLose = garyOnesLose * 2;
  if (garyOnesWin > 0) {
    const garyWinGhost = winGaryActive ? wF : getSidelineGhost(winTeam, 92);
    collectKC(winTeamName, 'Gary', garyWinGhost);
    const winLoc = winGaryActive ? 'active' : 'sideline';
    log(`<span class="log-ability">Gary</span> (${winLoc}) — Lucky Novice! ${garyOnesWin} rolled 1${garyOnesWin > 1 ? 's' : ''} → +${garyIceWin} Ice Shards!`);
  }
  if (garyOnesLose > 0) {
    const garyLoseGhost = loseGaryActive ? lF : getSidelineGhost(loseTeam, 92);
    collectKC(loseTeamName, 'Gary', garyLoseGhost);
    const loseLoc = loseGaryActive ? 'active' : 'sideline';
    log(`<span class="log-ability">Gary</span> (${loseLoc}) — Lucky Novice! ${garyOnesLose} rolled 1${garyOnesLose > 1 ? 's' : ''} → +${garyIceLose} Ice Shards!`);
  }

  // Bandit Pete (93) — Bandit: while on the sideline, if either player rolls only 2 dice, active ghost gains +3 damage.
  // Frost Valley sideline booster — punishes die-drain builds (Piper, Hugo, Outlaw) by turning a 2-die roll into a damage trigger.
  let banditPeteTriggered = false;
  let banditPeteBaseDmg = 0;
  if (hasSideline(winTeam, 93) && !wF.ko && winDice && loseDice && (winDice.length === 2 || loseDice.length === 2)) {
    if (!corneliusBlocksRally) {
      banditPeteBaseDmg = dmg;
      dmg += 3;
      banditPeteTriggered = true;
      const bpGhost = getSidelineGhost(winTeam, 93);
      collectKC(winTeamName, 'Bandit Pete', bpGhost);
      const bpWho = winDice.length === 2 ? 'Your ghost rolled only 2 dice' : 'Opponent rolled only 2 dice';
      log(`<span class="log-ability">Bandit Pete</span> (sideline) — Bandit! ${bpWho} → +3 damage!`);
    } else { corneliusSidelineBlockedList.push('Bandit Pete'); log(`<span class="log-ability">Cornelius</span> — Antidote! Bandit Pete Bandit blocked.`); }
  }

  // Zach (87) — Craftsman: while on the sideline, Guard Thomas gains +3 damage on Doubles.
  // Frost Valley sideline synergy — specific Guard Thomas / Zach pairing: doubles win + GT active + Zach benched → +3 bonus.
  let zachCraftsmanTriggered = false;
  let zachCraftsmanBaseDmg = 0;
  if (hasSideline(winTeam, 87) && wF.id === 41 && !wF.ko && wR.type === 'doubles') {
    if (!corneliusBlocksRally) {
      zachCraftsmanBaseDmg = dmg;
      dmg += 3;
      zachCraftsmanTriggered = true;
      const zachGhost = getSidelineGhost(winTeam, 87);
      collectKC(winTeamName, 'Zach', zachGhost);
      log(`<span class="log-ability">Zach</span> (sideline) — Craftsman! Guard Thomas doubles → +3 damage!`);
    } else { corneliusSidelineBlockedList.push('Zach'); log(`<span class="log-ability">Cornelius</span> — Antidote! Zach Craftsman blocked.`); }
  }

  // Lou (32) — Bros: while on the sideline, Grawr (id=34) gains +1 Damage and +1 Health on Winning Rolls.
  // Frost Valley common — dedicated Grawr support. Damage bonus computed here; HP grant deferred to onShow in cinematic queue.
  let louBrosTriggered = false;
  let louBrosBaseDmg = 0;
  if (hasSideline(winTeam, 32) && wF.id === 34 && !wF.ko) {
    if (!corneliusBlocksRally) {
      louBrosBaseDmg = dmg;
      dmg += 1;
      louBrosTriggered = true;
      log(`<span class="log-ability">Lou</span> (sideline) — Bros! Grawr wins → +1 damage!`);
    } else { corneliusSidelineBlockedList.push('Lou'); log(`<span class="log-ability">Cornelius</span> — Antidote! Lou Bros blocked.`); }
  }

  // Chip (16) — Acrobatic Dive: even rolled doubles add +3 damage if you deal damage.
  // "Even doubles" = win type is doubles AND the paired value is even (2, 4, or 6) AND dmg > 0.
  // FIX v279: was winDice.every(d => d%2===0) — required ALL dice to be even, so [4,4,3]
  // (double 4s with an odd third die) wrongly failed. Correct check is wR.value % 2 === 0.
  let chipTriggered = false;
  let chipBaseDmg = 0;
  if (wF.id === 16 && !wF.ko && wR.type === 'doubles' && dmg > 0 && wR.value % 2 === 0) {
    chipBaseDmg = dmg;
    dmg += 3;
    chipTriggered = true;
    collectKC(winTeamName, wF.name);
    log(`<span class="log-ability">${wF.name}</span> — Acrobatic Dive! Even doubles → +3 damage! (${chipBaseDmg} + 3 = ${dmg})`);
  }

  // Ancient Librarian (3) — Knowledge: for each 2 rolled by BOTH players combined, add +1 damage (only if winning ghost deals damage).
  // Set 1 common — both teams' dice count, so high-die-count opponents ironically fuel the bonus. Pure damage engine.
  let librarianTriggered = false;
  let librarianBaseDmg = 0;
  let librarianTwos = 0;
  if (wF.id === 3 && !wF.ko && dmg > 0 && winDice && loseDice) {
    librarianTwos = [...winDice, ...loseDice].filter(d => d === 2).length;
    if (librarianTwos > 0) {
      librarianBaseDmg = dmg;
      dmg += librarianTwos;
      librarianTriggered = true;
      collectKC(winTeamName, wF.name);
      log(`<span class="log-ability">${wF.name}</span> — Knowledge! ${librarianTwos} two${librarianTwos > 1 ? 's' : ''} rolled (both teams) → +${librarianTwos} damage!`);
    }
  }

  // Sparky (64) — Tinder: each rolled 1 adds +3 damage, but only if Sparky wins and damage > 0 (the 1s "ignite").
  // Set 1 rare damage multiplier — rewards low-die faces (1s are usually the worst roll, now lethal).
  let sparkyTriggered = false;
  let sparkyBaseDmg = 0;
  let sparkyOneCount = 0;
  if (wF.id === 64 && !wF.ko && dmg > 0 && winDice) {
    sparkyOneCount = winDice.filter(d => d === 1).length;
    if (sparkyOneCount > 0) {
      sparkyBaseDmg = dmg;
      dmg += sparkyOneCount * 3;
      sparkyTriggered = true;
      collectKC(winTeamName, wF.name);
      log(`<span class="log-ability">${wF.name}</span> — Tinder! ${sparkyOneCount} rolled 1${sparkyOneCount > 1 ? 's' : ''} × 3 = +${sparkyOneCount * 3} damage!`);
    }
  }

  // Splinter (101) — Toxic Fumes: first win activates fumes; 1 pre-roll chip damage every subsequent round
  let splinterJustActivated = false;
  if (wF.id === 101 && !wF.ko && B.splinterActivated && !B.splinterActivated[winTeamName]) {
    B.splinterActivated[winTeamName] = true;
    splinterJustActivated = true;
    log(`<span class="log-ability">${wF.name}</span> — Toxic Fumes! Activated — 1 pre-roll damage every round from here on.`);
  }

  // Kodako (1) — Swift WIN case: rolling 1-2-3 (all three values present) while winning → deal exactly 4 damage (overrides all modifiers)
  let kodakoSwiftWin = false;
  if (wF.id === 1 && !wF.ko && winDice && [1,2,3].every(v => winDice.includes(v))) {
    dmg = 4;
    kodakoSwiftWin = true;
    collectKC(winTeamName, wF.name);
    log(`<span class="log-ability">${wF.name}</span> — Swift! 1-2-3 combo → exactly 4 damage!`);
  }

  // Guard Thomas (41) — Stoic: while Guard Thomas has less than 6 HP, singles rolls deal 0 damage to him.
  // Defensive immunity — no stat change needed, just zero out dmg and flag it.
  let guardThomasStoic = false;
  if (lF.id === 41 && !lF.ko && lF.hp < 6 && wR.type === 'singles' && dmg > 0) {
    guardThomasStoic = true;
    dmg = 0;
    log(`<span class="log-ability">${lF.name}</span> — Stoic! Below 6 HP — immune to singles! ${wF.name}'s singles roll blocked!`);
  }

  // Bogey (53) — Bogus: REACTIVE reflect — player sees incoming damage and chooses whether to bounce it.
  // v430: Sylvia re-entry pattern. First pass: open modal with live damage preview, return early.
  // Second pass (bogeyReflectResuming): read choice and either zero dmg + mark used, or fall through.
  // Fires after guardThomasStoic — Stoic may have zeroed dmg, Bogus only triggers on real damage.
  let bogeyReflected = false;
  let bogeyReflectDmg = 0;
  let bogeyHpAfter = 0;
  const bogeyReflectResuming = !!B.bogeyReflectResuming;
  B.bogeyReflectResuming = false;
  if (lF.id === 53 && !lF.ko && B.bogeyUsed && !B.bogeyUsed[loseTeamName] && dmg > 0) {
    if (!bogeyReflectResuming && !B.bogeyReflectChoice) {
      // First pass — pause resolveRound, open modal with live damage preview
      B.bogeyReflectPending = { loseTeamName, dmg };
      const subEl = document.getElementById('bogeyReflectSub');
      if (subEl) subEl.innerHTML =
        `<b>${wF.name}</b> hits <b>${lF.name}</b> for <b>${dmg}</b> damage. Reflect it back?` +
        `<br><i>(Once per game — save it for a bigger hit?)</i>`;
      document.getElementById('bogeyOverlay').classList.add('active');
      return; // pause — doBogeyReflectChoice() will re-enter resolveRound
    }
    // Second pass — read choice and clear pending state
    const bogeyChoice = B.bogeyReflectChoice;
    B.bogeyReflectChoice = null;
    B.bogeyReflectPending = null;
    if (bogeyChoice === 'yes') {
      bogeyReflectDmg = dmg;
      dmg = 0; // Bogey takes nothing — all damage bounces back
      bogeyReflected = true;
      B.bogeyUsed[loseTeamName] = true;   // once per game — never offered again
      collectKC(loseTeamName, lF.name, lF);
      log(`<span class="log-ability">${lF.name}</span> — Bogus! ${bogeyReflectDmg} damage reflected back to ${wF.name}!`);
    }
    // bogeyChoice === 'no': dmg falls through unchanged, bogeyUsed stays false (reflect preserved)
  }

  // Kodako (1) — Swift LOSE case: rolling 1-2-3 while losing → negate all incoming damage, deal 4 back to winner
  let kodakoSwiftLose = false;
  if (lF.id === 1 && !lF.ko && loseDice && [1,2,3].every(v => loseDice.includes(v)) && dmg > 0) {
    dmg = 0; // Kodako takes nothing — Swift counters the hit
    kodakoSwiftLose = true;
    collectKC(loseTeamName, lF.name);
    log(`<span class="log-ability">${lF.name}</span> — Swift! 1-2-3 while losing → negate damage, deal 4 back to ${wF.name}!`);
  }

  // Patrick (10) — Stone Form: losing to a singles roll negates all incoming damage and deals 3 counter-damage back to the winner.
  // Fires after Kodako Swift Lose — if Swift already zeroed dmg, Patrick won't double-trigger on the same hit.
  let patrickStoneForm = false;
  const patrickStoneDmg = 3;
  let stoneFormHpAfter = 0;
  if (lF.id === 10 && !lF.ko && wR.type === 'singles' && dmg > 0) {
    dmg = 0; // Patrick takes nothing — Stone Form counters singles
    patrickStoneForm = true;
    collectKC(loseTeamName, lF.name);
    log(`<span class="log-ability">${lF.name}</span> — Stone Form! Singles roll negated — dealing 3 back to ${wF.name}!`);
  }

  // Dealer (37) — House Rules: Dealer's losing dice in strict consecutive ascending order → negate all incoming damage.
  // e.g. [1,2,3], [2,3,4], [3,4,5], [4,5,6] — any length run that is perfectly sequential.
  let dealerHouseRules = false;
  if (lF.id === 37 && !lF.ko && dmg > 0 && loseDice && loseDice.length >= 2) {
    const _sortedDealerDice = [...loseDice].sort((a, b) => a - b);
    const _isSequential = _sortedDealerDice.every((v, i) => i === 0 || v === _sortedDealerDice[i - 1] + 1);
    if (_isSequential) {
      dmg = 0;
      dealerHouseRules = true;
      collectKC(loseTeamName, lF.name);
      log(`<span class="log-ability">${lF.name}</span> — House Rules! Dice [${_sortedDealerDice.join(', ')}] in order — ${wF.name}'s attack negated!`);
    }
  }

  // Sky (72) — Elusive: if incoming damage is greater than 2, negate it entirely.
  // A pure big-damage shield — lets through 1-2 damage, blocks 3+.
  let skyElusive = false;
  let skyElusiveBlockedDmg = 0;
  if (lF.id === 72 && !lF.ko && dmg > 2) {
    skyElusiveBlockedDmg = dmg;
    dmg = 0;
    skyElusive = true;
    collectKC(loseTeamName, lF.name);
    log(`<span class="log-ability">${lF.name}</span> — Elusive! ${skyElusiveBlockedDmg} incoming damage > 2 — ${wF.name}'s hit negated!`);
  }

  // City Cyboo (77) — Barrier: takes no damage from enemy doubles.
  // A 1 HP doubles-immune defender — the win roll type must be 'doubles' for Barrier to trigger.
  let cityCybooBarrier = false;
  let cityCybooBlockedDmg = 0;
  if (lF.id === 77 && !lF.ko && wR.type === 'doubles' && dmg > 0) {
    cityCybooBlockedDmg = dmg;
    dmg = 0;
    cityCybooBarrier = true;
    collectKC(loseTeamName, lF.name);
    log(`<span class="log-ability">${lF.name}</span> — Barrier! Enemy doubles blocked! ${cityCybooBlockedDmg} damage negated!`);
  }

  // Puff (5) — Cute: enemy doubles and triples deal -1 damage (minimum 0).
  // Partial reduction, NOT full negation — Cameron Force of Nature does NOT trigger from Cute alone.
  let puffCute = false;
  let puffCuteOriginalDmg = 0;
  if (lF.id === 5 && !lF.ko && (wR.type === 'doubles' || wR.type === 'triples') && dmg > 0) {
    puffCuteOriginalDmg = dmg;
    dmg = Math.max(0, dmg - 1);
    puffCute = true;
    collectKC(loseTeamName, lF.name);
    log(`<span class="log-ability">${lF.name}</span> — Cute! ${wR.type} roll softened — ${puffCuteOriginalDmg} → ${dmg} damage!`);
  }

  // King Jay (106) — Reflection: lose the roll & loser's dice total = 7 → reflect all damage back to winner
  // Fires after Sylvia (both can't be active at the same time, but ordering is: Sylvia negates first, then Jay reflects what's left)
  let kingJayReflected = false;
  let kingJayReflectDmg = 0;
  let kingJayHpAfter = 0;
  if (lF.id === 106 && !lF.ko && dmg > 0 && loseDice && loseDice.reduce((a, b) => a + b, 0) === 7) {
    kingJayReflectDmg = dmg;
    dmg = 0; // loser takes nothing — all damage goes back
    kingJayReflected = true;
    collectKC(loseTeamName, lF.name);
    log(`<span class="log-ability">${lF.name}</span> — Reflection! Dice total = 7! ${kingJayReflectDmg} damage reflected back to ${wF.name}!`);
  }

  // Guardian Fairy (99) — Wish: REACTIVE — if losing team has GF on sideline and damage > 0,
  // defer damage application and show a modal letting the player choose to swap GF in.
  // GF intercepts BEFORE damage is applied to lF.
  let guardianFairyAbsorbed = false;
  let guardianFairyAbsorbedDmg = 0;
  let guardianFairyKOd = false;
  let gfSacrifice = null;
  let gfHpAfter = 0;
  let guardianFairyReactiveTriggered = false;
  if (!kingJayReflected && dmg > 0) {
    const gfG = getSidelineGhost(loseTeam, 99);
    if (gfG && !gfG.ko) {
      // Store pending state — damage deferred to modal handler
      guardianFairyReactiveTriggered = true;
      gfSacrifice = gfG;
      guardianFairyAbsorbedDmg = dmg;
      B.guardianFairyReactivePending = {
        loseTeamName, gfGhost: gfG, dmg, lF, wFName: wF.name, wFId: (wF.originalId || wF.id),
        resume: null // set later during drain
      };
      dmg = 0; // defer ALL damage — modal handler will apply it
      guardianFairyAbsorbed = true; // flag so "0 damage" log doesn't fire
    }
  }

  // Fang Undercover (7) — Skilled Coward: armed → negate all incoming damage, trigger post-round swap
  // Fires after Guardian Fairy (GF takes priority if both are in play; Fang Undercover fires only if GF didn't absorb)
  let fangUndercoverActivated = false;
  if (!kingJayReflected && !guardianFairyAbsorbed &&
      lF.id === 7 && !lF.ko && B.fangUndercoverArmed && B.fangUndercoverArmed[loseTeamName] && dmg > 0) {
    B.fangUndercoverArmed[loseTeamName] = false; // consume the arm
    fangUndercoverActivated = true;
    B.fangUndercoverSwapPending = loseTeamName; // signal drain callback to show ghost-picker
    dmg = 0; // Fang takes no damage — dodge activated
    collectKC(loseTeamName, lF.name);
    log(`<span class="log-ability">${lF.name}</span> — Skilled Coward! Dodge activated! Fang will swap to the sideline!`);
  }
  if (B.fangUndercoverArmed) { B.fangUndercoverArmed[loseTeamName] = false; B.fangUndercoverArmed[winTeamName] = false; } // clear any unused arm

  // Gus (31) — Gale Force: won and declared Gale Force → override all damage to 0, force enemy ghost swap.
  // Fires after Guardian Fairy (GF absorption irrelevant here since Gus is the winner).
  let galeForceSwap = false;
  let galeForceSLIdx = -1;
  if (wF.id === 31 && !wF.ko && B.galeForcePending && B.galeForcePending[winTeamName]) {
    galeForceSLIdx = loseTeam.ghosts.findIndex((g, i) => i !== loseTeam.activeIdx && !g.ko);
    if (galeForceSLIdx >= 0) {
      dmg = 0; // override ALL computed damage — no hit
      galeForceSwap = true;
      collectKC(winTeamName, wF.name);
      log(`<span class="log-ability">${wF.name}</span> — Gale Force! No damage — ${loseTeamName} must choose a replacement ghost!`);
    }
  }
  if (B.galeForcePending) { B.galeForcePending[winTeamName] = false; B.galeForcePending[loseTeamName] = false; } // consumed or unused

  // --- Mirror Matt (410) — Seven Years: doubles ONLY damage reflected to winner ---
  let mirrorMattReflected = false;
  let mirrorMattReflectDmg = 0;
  if (lF.id === 410 && !lF.ko && dmg > 0 && wR.type === 'doubles') {
    mirrorMattReflectDmg = dmg;
    wF.hp = Math.max(0, wF.hp - dmg);
    if (wF.hp <= 0) { wF.ko = true; wF.killedBy = 410; }
    dmg = 0; // Mirror Matt takes nothing
    mirrorMattReflected = true;
    collectKC(loseTeamName, lF.name);
    log(`<span class="log-ability">${lF.name}</span> — SEVEN YEARS! ${wR.type} reflected! <span class="log-dmg">${mirrorMattReflectDmg} damage bounced to ${wF.name}!</span> ${wF.ko?'<span class="log-ko">KO!</span>':wF.hp+' HP left'}`);
  }

  // Garrick (427) — Watchfire: Lose: -1 damage (damage reduction)
  if (lF.id === 427 && !lF.ko && dmg > 0) {
    dmg = Math.max(0, dmg - 1);
    log(`<span class="log-ability">${lF.name}</span> — Watchfire! Absorbs 1 damage. (${dmg > 0 ? dmg + ' damage remaining' : 'All damage absorbed!'})`);
  }

  // Gordok (430) — River Terror: Win: you MAY steal 2 resources instead of dealing damage (player choice)
  let gordokStole = false;
  if (wF.id === 430 && !wF.ko && dmg > 0) {
    const gordokOppRes = loseTeam.resources;
    const gordokResTypes = ['ice', 'fire', 'surge', 'luckyStone', 'moonstone', 'healingSeed'];
    const gordokTotalRes = gordokResTypes.reduce((sum, r) => sum + (gordokOppRes[r] || 0), 0);
    if (gordokTotalRes >= 2) {
      if (autoPlayRunning) {
        // AI auto-picks: always steal
        let gordokStolen = 0;
        const gordokStolenList = [];
        for (let i = 0; i < 2 && gordokStolen < 2; i++) {
          const avail = gordokResTypes.filter(r => (gordokOppRes[r] || 0) > 0);
          if (avail.length === 0) break;
          const pick = avail[Math.floor(Math.random() * avail.length)];
          gordokOppRes[pick]--;
          winTeam.resources[pick] = (winTeam.resources[pick] || 0) + 1;
          gordokStolenList.push(pick);
          gordokStolen++;
        }
        dmg = 0;
        gordokStole = true;
        if (!B.gordokDieBonus) B.gordokDieBonus = { red: 0, blue: 0 };
        B.gordokDieBonus[winTeamName] = 1;
        winTeam.resources.moonstone++;
        collectKC(winTeamName, wF.name);
        log(`<span class="log-ability">${wF.name}</span> — River Terror! Stole ${gordokStolenList.join(', ')} instead of dealing damage! <span class="log-ice">+1 die next roll!</span> <span class="log-ms">+1 Moonstone!</span>`);
      } else {
        // Human player: defer to modal choice
        B.gordokPending = { winTeam, winTeamName, loseTeam, lF, wF, dmg, resume: null };
        dmg = 0; // defer damage — modal handler will apply
        gordokStole = true; // flag so "0 damage" log doesn't fire
      }
    }
  }

  // Pal Al (431) — Squall: Win: you MAY gain 4 Ice Shards instead of dealing damage (player choice)
  let wiseAlSqualled = false;
  if (wF.id === 431 && !wF.ko && dmg > 0) {
    if (autoPlayRunning) {
      // AI auto-picks: take ice if < 6
      const wiseAlIce = winTeam.resources.ice || 0;
      if (wiseAlIce < 6) {
        winTeam.resources.ice += 4;
        dmg = 0;
        wiseAlSqualled = true;
        collectKC(winTeamName, wF.name);
        log(`<span class="log-ability">${wF.name}</span> — Squall! <span class="log-ice">+4 Ice Shards</span> instead of dealing damage!`);
      }
    } else {
      // Human player: defer to modal choice
      B.wiseAlPending = { winTeam, winTeamName, loseTeam, lF, wF, dmg, resume: null };
      dmg = 0; // defer damage — modal handler will apply
      wiseAlSqualled = true; // flag so "0 damage" log doesn't fire
    }
  }

  // --- APPLY DAMAGE (game state updates immediately) ---
  const winColor = winTeamName === 'red' ? 'red-text' : 'blue-text';
  const loseColor = winTeamName === 'red' ? 'blue-text' : 'red-text';
  if (dmg > 0) {
    lF.hp = Math.max(0, lF.hp - dmg);
    if (lF.hp <= 0) { lF.ko = true; lF.killedBy = (wF.originalId || wF.id); }
    log(`<span class="log-dmg">${wF.name} deals ${dmg} to ${lF.name}!</span> ${lF.ko?'<span class="log-ko">KO!</span>':lF.hp+' HP left'}`);
  } else if (!mirrorMattReflected && !gordokStole && !wiseAlSqualled && !kingJayReflected && !guardianFairyAbsorbed && !bogeyReflected && !kodakoSwiftLose && !patrickStoneForm && !dealerHouseRules && !skyElusive && !cityCybooBarrier && !puffCute && !fangUndercoverActivated) {
    log(`${wF.name} wins but deals 0 damage.`);
  }

  // Jasper (428) — Flame Dive: Win: interactive bonus die reveal (Balatron-style)
  // HP mutations deferred to showJasperModal → finishJasperRoll.
  let jasperTriggered = false;
  let jasperBonusDie = 0;
  if (wF.id === 428 && !wF.ko) {
    jasperBonusDie = Math.floor(Math.random() * 6) + 1;
    jasperTriggered = true;
    collectKC(winTeamName, wF.name);
    // Stash for modal — HP mutations deferred to finishJasperRoll
    B.jasperPending = {
      bonusDie: jasperBonusDie,
      wFName: wF.name,
      lFName: lF.name,
      winTeamName: winTeamName
    };
  }

  // Mirror Matt (410) — Seven Years reflected damage callout (deferred to cinematic)
  // HP already applied synchronously above, callout queued later in ability queue section.

  // King Jay reflected damage — applies to the winner
  // wF.hp deferred to onShow so HP bar updates when REFLECTION! callout fires, not silently during beat 4.
  // wF.ko is set synchronously here so Cameron (25) Force of Nature check immediately below sees the correct KO state.
  if (kingJayReflected && kingJayReflectDmg > 0) {
    kingJayHpAfter = Math.max(0, wF.hp - kingJayReflectDmg);
    if (kingJayHpAfter <= 0) { wF.ko = true; wF.killedBy = lF.id; }
    log(`<span class="log-dmg">${lF.name} reflects ${kingJayReflectDmg} back! ${wF.name} takes the hit!</span> ${wF.ko?'<span class="log-ko">KO!</span>':kingJayHpAfter+' HP left'}`);
  }

  // Bogey reflected damage — applies to the winner (lF takes 0; wF eats the full hit)
  // wF.hp deferred to onShow so HP bar updates when BOGUS! callout fires, not silently during beat 4.
  // wF.ko is set synchronously so Cameron (25) Force of Nature check immediately below sees the correct KO state.
  if (bogeyReflected && bogeyReflectDmg > 0) {
    bogeyHpAfter = Math.max(0, wF.hp - bogeyReflectDmg);
    if (bogeyHpAfter <= 0) { wF.ko = true; wF.killedBy = lF.id; }
    log(`<span class="log-dmg">${lF.name} — BOGUS! ${bogeyReflectDmg} damage bounced back to ${wF.name}!</span> ${wF.ko?'<span class="log-ko">KO!</span>':bogeyHpAfter+' HP left'}`);
  }

  // Kodako (1) — Swift lose counter: 4 damage dealt back to the winner
  // wF.hp deferred to onShow so HP bar updates when SWIFT! callout fires, not silently during beat 4.
  // wF.ko is set synchronously here so Cameron (25) Force of Nature check immediately below sees the correct KO state.
  let swiftLoseHpAfter = 0;
  if (kodakoSwiftLose) {
    swiftLoseHpAfter = Math.max(0, wF.hp - 4);
    if (swiftLoseHpAfter <= 0) { wF.ko = true; wF.killedBy = lF.id; }
    log(`<span class="log-dmg">${lF.name} — Swift counter! 4 damage to ${wF.name}!</span> ${wF.ko?'<span class="log-ko">KO!</span>':swiftLoseHpAfter+' HP left'}`);
  }

  // Patrick (10) — Stone Form counter: 3 damage dealt back to the winner for throwing a singles roll
  // wF.hp deferred to onShow so HP bar updates when STONE FORM! callout fires, not silently during beat 4.
  // wF.ko is set synchronously here so Cameron (25) Force of Nature check at line ~8814 sees the correct KO state.
  if (patrickStoneForm) {
    stoneFormHpAfter = Math.max(0, wF.hp - patrickStoneDmg);
    if (stoneFormHpAfter <= 0) { wF.ko = true; wF.killedBy = lF.id; }
    log(`<span class="log-dmg">${lF.name} — Stone Form counter! ${patrickStoneDmg} damage to ${wF.name}!</span> ${wF.ko?'<span class="log-ko">KO!</span>':stoneFormHpAfter+' HP left'}`);
  }

  // Cameron (25) — Force of Nature: Cameron wins a roll but the loser's defensive ability negates the damage → destroy the loser.
  // Fires after all counter-damage (Patrick, Kodako, King Jay, Bogey) so wF.ko is accurate.
  // Guardian Fairy absorption is NOT a negation — Cameron's damage DID land (on GF), so it does NOT trigger Force of Nature.
  let cameronForceOfNature = false;
  if (wF.id === 25 && !wF.ko && !lF.ko && !guardianFairyAbsorbed &&
      (guardThomasStoic || patrickStoneForm || kodakoSwiftLose || bogeyReflected || kingJayReflected || dealerHouseRules || skyElusive || cityCybooBarrier || fangUndercoverActivated)) {
    lF.hp = 0;
    lF.ko = true;
    lF.killedBy = 25;
    cameronForceOfNature = true;
    collectKC(winTeamName, wF.name);
    log(`<span class="log-ability">${wF.name}</span> — Force of Nature! Damage negated — ${lF.name} instantly destroyed!`);
  }

  // Pudge self-damage (game state — HP mutation deferred to BELLY FLOP! onShow)
  // pudgeSelfDmgApplied tracks that damage landed so the visual fires even on a fatal hit —
  // without it, wF.ko=true from the fatal self-hit causes the animation to be silently skipped.
  let pudgeSelfDmgApplied = false;
  let pudgeHpAfter = 0;
  if (pudgeSelfDmg && !wF.ko) {
    pudgeHpAfter = Math.max(0, wF.hp - 1); // compute only — HP bar deferred to onShow
    if (pudgeHpAfter <= 0) { wF.ko = true; wF.killedBy = -1; } // ko flag synchronous (Cameron check); killedBy=-1 = self-inflicted (Belly Flop), so no kill credit goes to the loser
    pudgeSelfDmgApplied = true;
    log(`<span class="log-dmg">${wF.name} takes 1 self-damage from Belly Flop!</span> ${wF.ko?'<span class="log-ko">KO!</span>':pudgeHpAfter+' HP left'}`);
  }

  // Prince Balatron (113) — Party Time: lose & survive → player rolls 1 counter die
  // Counter fires even if wF is not KO'd by the main roll — Balatron always fights back when alive.
  // The counter die is pre-computed here (so wF.ko/Cameron cascade stays accurate) but the
  // reveal + HP mutation + log are deferred to showBalatronModal → finishBalatronRoll so the
  // player gets the dramatic click-to-roll moment. See function block near showSylviaModal.
  let balatronCounterDie = 0;
  let balatronHpAfter = 0;
  let balatronTriggered = false;
  if (lF.id === 113 && !lF.ko && !wF.ko) {
    balatronCounterDie = Math.floor(Math.random() * 6) + 1;
    balatronHpAfter = Math.max(0, wF.hp - balatronCounterDie); // compute only — HP bar deferred to modal
    const willKo = balatronHpAfter <= 0;
    if (willKo) { wF.ko = true; wF.killedBy = lF.id; } // ko flag synchronous (Cameron check)
    balatronTriggered = true;
    collectKC(loseTeamName, lF.name);
    // Stash everything the modal will need. Log is deferred to finishBalatronRoll so the
    // combat log doesn't spoil the reveal before the player clicks the roll button.
    B.balatronPending = {
      counterDie: balatronCounterDie,
      hpAfter: balatronHpAfter,
      wasKo: willKo,
      lFName: lF.name,
      wFName: wF.name,
      loseTeamName: loseTeamName
    };
  }

  // Bubble Boys (44) — Pop: if the opposing ghost rolled triples, Bubble Boys are instantly defeated.
  // Two cases: (1) BB lost and enemy winner rolled triples; (2) BB won but losing roll was also triples.
  let bubbleBoysPopped = false;
  let bubbleBoysName = '';
  let bubbleBoysEnemyName = '';
  // Case 1: Bubble Boys lost, enemy winner rolled triples
  if (lF.id === 44 && !lF.ko && wR.type === 'triples') {
    lF.hp = 0;
    lF.ko = true;
    lF.killedBy = (wF.originalId || wF.id);
    bubbleBoysPopped = true;
    bubbleBoysName = lF.name;
    bubbleBoysEnemyName = wF.name;
    collectKC(loseTeamName, lF.name);
    log(`<span class="log-ability">${lF.name}</span> — Pop! ${wF.name} rolled triples — Bubble Boys burst!`);
  }
  // Case 2: Bubble Boys won, but the losing roll was also triples (enemy still activated Pop)
  if (wF.id === 44 && !wF.ko && lR.type === 'triples') {
    wF.hp = 0;
    wF.ko = true;
    wF.killedBy = lF.id;
    bubbleBoysPopped = true;
    bubbleBoysName = wF.name;
    bubbleBoysEnemyName = lF.name;
    collectKC(winTeamName, wF.name);
    log(`<span class="log-ability">${wF.name}</span> — Pop! ${lF.name} rolled triples — Bubble Boys burst even in victory!`);
  }

  // Night Master (103) — Bullseye: win with doubles → destroy an enemy sideline ghost that has < 4 HP
  // Snipes the first eligible target (lowest index). KO applied now; callout fires via queue.
  let bullseyeTarget = null;
  if (wF.id === 103 && !wF.ko && wR.type === 'doubles') {
    const loseActiveIdx = loseTeam.activeIdx;
    const bsCandidate = loseTeam.ghosts.find((g, i) => i !== loseActiveIdx && !g.ko && g.hp < 4);
    if (bsCandidate) {
      bullseyeTarget = { ghost: bsCandidate, priorHp: bsCandidate.hp };
      bsCandidate.hp = 0;
      bsCandidate.ko = true;
      bsCandidate.killedBy = 103;
      collectKC(winTeamName, wF.name);
      log(`<span class="log-ability">${wF.name}</span> — Bullseye! ${bsCandidate.name} (${bullseyeTarget.priorHp} HP) sniped from the enemy sideline!`);
    }
  }

  // Flora (75) — Restore: rolling doubles (win OR lose) heals +2 HP. Fires after damage is applied.
  // Win case: Flora won with doubles — heal her after lF took damage.
  // Lose case: Flora lost but rolled doubles and survived — heal even in defeat.
  // Mr Filbert (59) — Mask Merchant: if Filbert is on the enemy sideline, the +2 heal flips to -2 damage.
  // HP mutation deferred to onShow so the bar jumps exactly when RESTORE!/MASK MERCHANT! flashes.
  let floraRestored = false;
  let floraRestoredName = '';
  let floraRestoredHp = 0;
  let floraFlipped = false;
  let floraFlippedName = '';
  let floraFlippedFrom = 0;
  let floraFlippedTo = 0;
  let floraGhost = null; // captured reference for onShow callback
  if (wF.id === 75 && !wF.ko && wR.type === 'doubles') {
    const flBefore = wF.hp;
    floraGhost = wF;
    if (filbertCursesWin) {
      floraFlippedTo = Math.max(0, wF.hp - 2); // compute only — defer mutation to onShow
      if (floraFlippedTo <= 0) { wF.ko = true; wF.killedBy = 59; } // KO flag synchronous (Cameron check)
      floraFlipped = true; floraFlippedName = wF.name; floraFlippedFrom = flBefore;
      collectKC(winTeamName, wF.name);
      log(`<span class="log-ability">${wF.name}</span> — Restore! Mr Filbert curses it → -2 HP! (${flBefore} → ${floraFlippedTo})`);
    } else {
      floraRestoredHp = wF.hp + 2; // compute only — defer mutation to onShow
      floraRestoredName = wF.name; floraRestored = true;
      collectKC(winTeamName, wF.name);
      log(`<span class="log-ability">${wF.name}</span> — Restore! Doubles win → +2 HP! (${flBefore} → ${floraRestoredHp}/${wF.maxHp}${floraRestoredHp > wF.maxHp ? ' overclocked!' : ''})`);
    }
  }
  if (lF.id === 75 && !lF.ko && lR.type === 'doubles') {
    const flBefore = lF.hp;
    floraGhost = lF;
    if (filbertCursesLose) {
      floraFlippedTo = Math.max(0, lF.hp - 2); // compute only — defer mutation to onShow
      if (floraFlippedTo <= 0) { lF.ko = true; lF.killedBy = 59; } // KO flag synchronous
      floraFlipped = true; floraFlippedName = lF.name; floraFlippedFrom = flBefore;
      collectKC(loseTeamName, lF.name);
      log(`<span class="log-ability">${lF.name}</span> — Restore! Mr Filbert curses it → -2 HP! (${flBefore} → ${floraFlippedTo})`);
    } else {
      floraRestoredHp = lF.hp + 2; // compute only — defer mutation to onShow
      floraRestoredName = lF.name; floraRestored = true;
      collectKC(loseTeamName, lF.name);
      log(`<span class="log-ability">${lF.name}</span> — Restore! Rolled doubles → +2 HP even in defeat! (${flBefore} → ${floraRestoredHp}/${lF.maxHp}${floraRestoredHp > lF.maxHp ? ' overclocked!' : ''})`);
    }
  }

  // Simon (24) — Brew Time: REMOVED from post-roll damage. Only triggers on before-the-roll effects.
  let simonBrewTriggered = false;

  // Sad Sal (29) — Tough Job: losing ANY roll grants +1 Ice Shard (no dmg guard — triggers even on 0 damage)
  // Boobattles ref: "loser.ability === 'Tough Job' → iceShards += 1" — loss condition only, no HP threshold.
  let sadSalTriggered = false;
  if (lF.id === 29) {
    sadSalTriggered = true;
    collectKC(loseTeamName, lF.name);
    log(`<span class="log-ability">${lF.name}</span> — Tough Job! Lost the roll → +1 Ice Shard!`);
  }

  // Hugo (52) — Wreckage: when Hugo takes real roll damage, the attacker loses 1 die next roll
  // Fires even if Hugo is KO'd — attacking Hugo costs you regardless. Flag stored on the WIN team.
  let hugoWreckageTriggered = false;
  if (lF.id === 52 && dmg > 0) {
    B.hugoWreckage[winTeamName] = (B.hugoWreckage[winTeamName] || 0) + 1;
    hugoWreckageTriggered = true;
    collectKC(loseTeamName, lF.name);
    log(`<span class="log-ability">${lF.name}</span> — Wreckage! Took ${dmg} damage → ${wF.name} loses 1 die next roll!`);
  }

  // Marcus (57) — Glacial Pounding: if Marcus (loser) took 3+ real damage and survived, he gains +4 bonus dice next roll
  // Must fire AFTER all defensive mods (Stoic, Bogus, King Jay, GF) so dmg reflects what actually landed on lF
  let marcusGlacialTriggered = false;
  if (lF.id === 57 && !lF.ko && dmg >= 3) {
    B.marcusGlacialBonus[loseTeamName] = (B.marcusGlacialBonus[loseTeamName] || 0) + 4;
    marcusGlacialTriggered = true;
    collectKC(loseTeamName, lF.name);
    log(`<span class="log-ability">${lF.name}</span> — Glacial Pounding! Took ${dmg} damage → +4 bonus dice next roll!`);
  }

  // Troubling Haters (83) — Growing Mob: win with 4+ damage → +2 HP (overclocks per v294)
  // Mr Filbert (59) — Mask Merchant: flips the +2 heal to -2 damage when on enemy sideline.
  // HP mutation deferred to onShow so HP bar jumps WITH the callout, not before it (same as Opa/Villager/Jeffery pattern).
  let growingMobTriggered = false;
  let growingMobHpAfter = 0;
  let growingMobFlipped = false;
  if (wF.id === 83 && !wF.ko && dmg >= 4) {
    const gmBefore = wF.hp;
    if (filbertCursesWin) {
      growingMobHpAfter = Math.max(0, wF.hp - 2); growingMobFlipped = true; growingMobTriggered = true;
      collectKC(winTeamName, wF.name);
      log(`<span class="log-ability">${wF.name}</span> — Growing Mob! Mr Filbert curses it → -2 HP! (${gmBefore} → ${growingMobHpAfter})`);
    } else {
      growingMobHpAfter = wF.hp + 2; growingMobTriggered = true;
      collectKC(winTeamName, wF.name);
      log(`<span class="log-ability">${wF.name}</span> — Growing Mob! Dealt ${dmg} damage → +2 HP! (${gmBefore} → ${growingMobHpAfter}/${wF.maxHp}${growingMobHpAfter > wF.maxHp ? ' overclocked!' : ''})`);
    }
  }

  // Munch (66) — Scraps: upon defeating a ghost, gain 4 health (overclocks per v294)
  // Mr Filbert (59) — Mask Merchant: flips the +4 heal to -4 damage when on enemy sideline.
  // HP mutation deferred to onShow so HP bar jumps WITH the callout, not before it (same as Opa/Villager/Jeffery pattern).
  let munchScrapTriggered = false;
  let munchHpBefore = 0;
  let munchHpAfter = 0;
  let munchFlipped = false;
  if (wF.id === 66 && !wF.ko && lF.ko) {
    munchHpBefore = wF.hp;
    if (filbertCursesWin) {
      munchHpAfter = Math.max(0, wF.hp - 4); munchFlipped = true; munchScrapTriggered = true;
      collectKC(winTeamName, wF.name);
      log(`<span class="log-ability">${wF.name}</span> — Scraps! Mr Filbert curses it → -4 HP! (${munchHpBefore} → ${munchHpAfter})`);
    } else {
      munchHpAfter = wF.hp + 4; munchScrapTriggered = true;
      collectKC(winTeamName, wF.name);
      log(`<span class="log-ability">${wF.name}</span> — Scraps! ${lF.name} defeated → +4 HP! (${munchHpBefore} → ${munchHpAfter}/${wF.maxHp}${munchHpAfter > wF.maxHp ? ' overclocked!' : ''})`);
    }
  }

  // On-win resource gains — deferred to callout onShow so tiles update WITH the splash, not 800ms before it.
  // Beat 4 renderBattle() fires at t=1900ms; the ability queue starts at t=2700ms — without this deferral,
  // the player sees "+2 Surge" appear during the HP bar drop, then sees PLUNDER! announce it 800ms later.
  if (wF.id === 209 && !wF.ko) { collectKC(winTeamName, wF.name); }
  if (wF.id === 307 && !wF.ko) { collectKC(winTeamName, wF.name); }
  if (wF.id === 342 && !wF.ko) { collectKC(winTeamName, wF.name); }
  if (wF.id === 336 && !wF.ko) { collectKC(winTeamName, wF.name); }
  if (wF.id === 309 && !wF.ko) { collectKC(winTeamName, wF.name); }
  if (wF.id === 81 && !wF.ko) { collectKC(winTeamName, wF.name); }   // Spockles Valley Magic
  if (wF.id === 58 && !wF.ko) { collectKC(winTeamName, wF.name); }   // Ashley Burning Soul
  if (wF.id === 206 && !wF.ko) { collectKC(winTeamName, wF.name); }  // Zain Ice Blade — win grants +1 Ice Shard
  // Dylan (301) Stained Glass — Sideline & In Play: winning rolls gain +1 Burn
  const hasDylanWin = (wF.id === 301 && !wF.ko) || hasSideline(winTeam, 301);
  if (hasDylanWin) { collectKC(winTeamName, wF.id === 301 ? wF.name : 'Dylan'); }
  // Farmer Jeff (314) — Harvest: active OR sideline fires on any 6 rolled, win OR lose (v636 buff).
  const hasFJWin = (wF.id === 314 && !wF.ko) || hasSideline(winTeam, 314);
  if (hasFJWin) {
    const sixes = countVal(winDice, 6);
    if (sixes > 0) { const jeffGhost = getSidelineGhost(winTeam, 314) || wF; collectKC(winTeamName, 'Farmer Jeff', jeffGhost); }
  }
  const hasFJLose = (lF.id === 314 && !lF.ko) || hasSideline(loseTeam, 314);
  if (hasFJLose) {
    const sixesLose = countVal(loseDice, 6);
    if (sixesLose > 0) { const jeffGhostLose = getSidelineGhost(loseTeam, 314) || lF; collectKC(loseTeamName, 'Farmer Jeff', jeffGhostLose); }
  }

  // Aunt Susan heal bonus (game state — preview only; actual HP mutation deferred to HARVEST DANCE! onShow)
  // Also checks for Mr. Filbert (59) curse: heal → damage (same pattern as Shoo/Boris/Katrina/Opa).
  B.auntSusanHealResult = {};
  ['red', 'blue'].forEach(tn => {
    if (B.auntSusanHealBonus[tn] > 0) {
      const f = active(B[tn]);
      if (!f.ko) {
        const healAmt = B.auntSusanHealBonus[tn] * 2;
        const enemyT = tn === 'red' ? B.blue : B.red;
        const filbertFlips = hasSideline(enemyT, 59);
        const hpBefore = f.hp;
        if (filbertFlips) {
          const hpAfter = Math.max(0, hpBefore - healAmt);
          B.auntSusanHealResult[tn] = { f, healAmt, before: hpBefore, after: hpAfter, filbertFlipped: true };
          log(`<span class="log-ability">Mr Filbert</span> — Harvest Dance cursed! ${f.name} takes ${healAmt} damage! (${hpBefore}→${hpAfter} HP)`);
        } else {
          const hpAfter = hpBefore + healAmt;
          const susanOver = hpAfter > f.maxHp;
          B.auntSusanHealResult[tn] = { f, healAmt, before: hpBefore, after: hpAfter, overclocked: susanOver };
          log(`<span class="log-heal">${f.name}</span> — Harvest Dance! Healed +${healAmt} HP (${hpBefore}→${hpAfter}/${f.maxHp})${susanOver ? ' · overclocked!' : ''}!`);
        }
      }
    }
  });

  // On-lose resource gains — deferred to BITTER END! onShow (same Beat-4 race as on-win grants)
  if (lF.id === 404 && !lF.ko) { collectKC(loseTeamName, lF.name); }
  // NOTE: Sad Sal (29) collectKC already called at line ~10004 (no-ko-guard block) — do NOT add a second one here

  // On-KO triggers (game state) — resource grants deferred to BEDTIME STORY!/BITTER END! onShow
  let powderFinalGiftTriggered = false;
  if (lF.ko) {
    if (hasSideline(loseTeam, 310)) {
      const grannyGhost = getSidelineGhost(loseTeam, 310);
      collectKC(loseTeamName, 'Granny', grannyGhost);
    }
    // Powder (23) — Final Gift: KO'd → team gains 3 Ice Shards for the next ghost
    if (lF.id === 23) {
      powderFinalGiftTriggered = true;
      collectKC(loseTeamName, lF.name); // Knight reactions fire on FINAL GIFT! (same pattern as Granny/Chagrin KO paths)
      log(`<span class="log-ability">${lF.name}</span> — Final Gift! KO'd... leaving 3 Ice Shards for the next ghost.`);
    }
    if (lF.id === 404) { collectKC(loseTeamName, lF.name); } // Chagrin on-KO surge → BITTER END! onShow below
  }

  // Granny Bedtime Story fires for the WINNER's team too when the winner self-KOs (Pudge Belly Flop)
  if (wF.ko && hasSideline(winTeam, 310)) {
    const grannyGhost = getSidelineGhost(winTeam, 310);
    collectKC(winTeamName, 'Granny', grannyGhost);
  }

  // Bo (109) — Miracle: upon defeating a Ghost, revive a previously KO'd ally to sideline at 1 HP.
  // Detection in game-state section; actual revive deferred to MIRACLE! onShow so the resurrection
  // is visually synchronized with the callout splash (same Beat-4 deferral pattern as Granny/Dart).
  let boMiracleTarget = null;
  if (wF.id === 109 && !wF.ko && lF.ko) {
    const revived = winTeam.ghosts.find((g, i) => i !== winTeam.activeIdx && g.ko);
    if (revived) {
      boMiracleTarget = revived;
      collectKC(winTeamName, wF.name);
    }
  }

  // End-of-round (game state) — Maximo seed deferred to NAP! onShow
  [B.red, B.blue].forEach(team => {
    const f = active(team);
    const tNameMax2 = team === B.red ? 'red' : 'blue';
    if (f.id === 302 && !f.ko) { collectKC(tNameMax2, f.name); }
  });

  // (Eternal Flame game state already handled at line ~2657)

  // ========================================
  // CINEMATIC ABILITY QUEUE — visuals play sequentially
  // ========================================
  abilityQueue = [];
  abilityQueueMode = true;

  // BLACKOUT! fires before winner calc, so its callouts lead the queue
  blackoutCallouts.forEach(b => queueAbility(b.name, b.color, b.desc, null, b.team));

  // Damage modifier callouts
  if (B.auntSusanBonus[winTeamName] > 0) {
    const cnt = B.auntSusanBonus[winTeamName];
    queueAbility('HARVEST DANCE!', 'var(--rare)', `${wF.name} — ${cnt} seed${cnt>1?'s':''} → +${cnt*2} damage!`, null, winTeamName);
  }
  // Aunt Susan heal callouts (both teams) — actual HP mutation happens inside onShow so the bar
  // jumps exactly when HARVEST DANCE! (or MASK MERCHANT!) fires, not before.
  ['red', 'blue'].forEach(tn => {
    if (B.auntSusanHealBonus[tn] > 0) {
      const cnt = B.auntSusanHealBonus[tn];
      const res = (B.auntSusanHealResult || {})[tn];
      if (res) {
        const { f, healAmt, before, after, overclocked, filbertFlipped } = res;
        if (filbertFlipped) {
          queueAbility('MASK MERCHANT!', 'var(--uncommon)',
            `Mr Filbert — Harvest Dance cursed! ${f.name} takes ${healAmt} damage! (${before}→${after} HP)`,
            () => { f.hp = Math.max(0, f.hp - healAmt); if (f.hp <= 0) { f.hp = 0; f.ko = true; f.killedBy = 59; } renderBattle(); }, tn);
        } else {
          const hpDelta = `${before}→${after} HP${overclocked ? ' · overclocked!' : ''}`;
          queueAbility('HARVEST DANCE!', 'var(--rare)',
            `${f.name} — ${cnt} seed${cnt>1?'s':''} → +${cnt*2} HP! ${hpDelta}`,
            () => { f.hp += healAmt; renderBattle(); }, tn);
        }
      }
    }
  });
  if (pudgeSelfDmg || (wF.id === 311 && wR.type === 'doubles')) {
    queueAbility('BELLY FLOP!', 'var(--common)', `${wF.name} — Doubles! +2 damage, 1 self-damage! (${pudgeHpAfter} HP left)`, pudgeSelfDmgApplied ? () => { wF.hp = pudgeHpAfter; renderBattle(); } : null, winTeamName);
  }
  if (mountainKingTriggered) {
    queueAbility('BEAST MODE!', 'var(--legendary)', `${wF.name} — Doubles! ${mountainKingBaseDmg} × 2 = ${dmg} damage!`, null, winTeamName);
  }
  if (stoneColdTriggered) {
    queueAbility('ONE-TWO-ONE!', 'var(--rare)', `${wF.name} — Double 1s! ${stoneColdBaseDmg} × 3 = ${dmg} damage!`, null, winTeamName);
  }
  if (larryTriggered) {
    queueAbility('FLYING KICK!', 'var(--uncommon)', `${wF.name} — Triples! ${larryBaseDmg} × 3 = ${dmg} damage!`, null, winTeamName);
  }
  if (buttonsTriggered) {
    queueAbility('PERFECT PLAN!', 'var(--common)', `${wF.name} — TRIPLE 6s!!! ${buttonsBaseDmg} + 15 = ${dmg} damage!!`, null, winTeamName);
  }
  if (nikonTriggered) {
    queueAbility('AMBUSH!', 'var(--common)', `${wF.name} — First roll! ${nikonBaseDmg} × 3 = ${dmg} damage!`, null, winTeamName);
  }
  if (caveDwellerTriggered) {
    queueAbility('LURK!', 'var(--uncommon)', `${wF.name} — First roll ambush! ${caveDwellerBaseDmg} × 3 = ${dmg} damage!`, null, winTeamName);
  }
  if (doomTriggered) {
    queueAbility('FIENDSHIP!', 'var(--legendary)', `${wF.name} — Win! +2 bonus damage dealt!`, null, winTeamName);
  }
  if (lucyTriggered) {
    queueAbility('BLUE FIRE!', 'var(--legendary)', `${wF.name} — Win! +1 Sacred Fire!`, () => { winTeam.resources.fire++; renderBattle(); }, winTeamName);
  }
  if (lucyShadowExtraFire) {
    queueAbility('MENTOR!', 'var(--rare)', `Lucy's Shadow — Mentor! +1 extra Sacred Fire!`, () => { winTeam.resources.fire++; renderBattle(); }, winTeamName);
  }
  if (gomTriggered) {
    queueAbility('CHAOS!', 'var(--common)', `${wF.name} — Win with doubles! +1 Sacred Fire!`, () => { winTeam.resources.fire++; renderBattle(); }, winTeamName);
  }
  if (wimTriggered) {
    queueAbility('SLASH!', 'var(--rare)', `${wF.name} — All dice odd! ${wimBaseDmg} + 5 = ${dmg} damage!`, null, winTeamName);
  }
  if (snortonTriggered) {
    queueAbility('FISSURE!', 'var(--rare)', `${wF.name} — Two 6s! ${snortonBaseDmg} + 5 = ${dmg} damage!`, null, winTeamName);
  }
  if (floraRestored) {
    queueAbility('RESTORE!', 'var(--rare)', `${floraRestoredName} — Doubles! +2 HP! Now at ${floraRestoredHp} HP!`, () => { floraGhost.hp = floraRestoredHp; renderBattle(); }, floraGhost === wF ? winTeamName : loseTeamName);
  }
  if (floraFlipped) {
    queueAbility('MASK MERCHANT!', 'var(--uncommon)', `Mr Filbert — Restore cursed! ${floraFlippedName} takes 2 damage instead! (${floraFlippedFrom} → ${floraFlippedTo} HP)`, () => { floraGhost.hp = floraFlippedTo; renderBattle(); }, floraGhost === wF ? winTeamName : loseTeamName);
  }
  if (pelterTriggered) {
    queueAbility('SNOWBALL!', 'var(--rare)', `${wF.name} — Doubles! ${pelterBaseDmg} + 2 = ${dmg} damage!`, null, winTeamName);
  }
  if (docTriggered) {
    queueAbility('SAVAGE!', 'var(--uncommon)', `${wF.name} — Doubles! ${docBaseDmg} + 5 = ${dmg} damage!`, null, winTeamName);
  }
  if (charlieTriggered) {
    queueAbility('RUSH!', 'var(--common)', `${wF.name} — Double 2s! Override → exactly 7 damage!`, null, winTeamName);
  }
  if (billBobTriggered) {
    queueAbility('BAIT N SWITCH!', 'var(--uncommon)', `${wF.name} — Below 4 HP! ${billBobBaseDmg} × 2 = ${dmg} damage!`, null, winTeamName);
  }
  if (alucardTriggered) {
    queueAbility('COLONY CALL!', 'var(--uncommon)', `${wF.name} — Doubles! ${alucardSidelineCount} sideline ghost${alucardSidelineCount>1?'s':''} × 2 = ${alucardBaseDmg} + ${alucardSidelineCount*2} = ${dmg} damage! (Once per game used)`, null, winTeamName);
  }
  if (castleGuardsTriggered) {
    queueAbility('FLAMETHROWER!', 'var(--uncommon)', `${wF.name} — ${castleGuardsThreeCount} three${castleGuardsThreeCount>1?'s':''} rolled! ${castleGuardsBaseDmg} × ${Math.pow(2,castleGuardsThreeCount)} = ${dmg} damage!`, null, winTeamName);
  }
  if (teamZippyTriggered) {
    queueAbility('TEAMWORK!', 'var(--uncommon)', `${wF.name} — Singles win! ${teamZippyBaseDmg} + 2 = ${dmg} damage!`, null, winTeamName);
  }
  if (gregTriggered) {
    queueAbility('CHASE!', 'var(--uncommon)', `${wF.name} — More HP than ${lF.name}! (${wF.hp} vs ${lF.hp}) ${gregBaseDmg} × 2 = ${dmg} damage!`, null, winTeamName);
  }
  if (tommyTriggered) {
    queueAbility('REGULATOR!', 'var(--common)', `${wF.name} — Rolled 6s! +${tommyRegulatedCount} bonus dice added!`, null, winTeamName);
  }
  if (growingMobTriggered) {
    const growingMobGhost = wF; // safe closure reference
    if (growingMobFlipped) {
      queueAbility('MASK MERCHANT!', 'var(--uncommon)', `Mr Filbert — Growing Mob cursed! ${growingMobGhost.name} takes 2 damage instead! (→ ${growingMobHpAfter} HP)`, () => { growingMobGhost.hp = growingMobHpAfter; if (growingMobGhost.hp <= 0) { growingMobGhost.hp = 0; growingMobGhost.ko = true; growingMobGhost.killedBy = 59; } renderBattle(); }, winTeamName);
    } else {
      queueAbility('GROWING MOB!', 'var(--rare)', `${growingMobGhost.name} — ${dmg} damage dealt! +2 HP! Now at ${growingMobHpAfter} HP!`, () => { growingMobGhost.hp = growingMobHpAfter; renderBattle(); }, winTeamName);
    }
  }
  if (munchScrapTriggered) {
    const munchGhost = wF; // safe closure reference
    if (munchFlipped) {
      queueAbility('MASK MERCHANT!', 'var(--uncommon)', `Mr Filbert — Scraps cursed! ${munchGhost.name} takes 4 damage instead! (${munchHpBefore} → ${munchHpAfter} HP)`, () => { munchGhost.hp = munchHpAfter; if (munchGhost.hp <= 0) { munchGhost.hp = 0; munchGhost.ko = true; munchGhost.killedBy = 59; } renderBattle(); }, winTeamName);
    } else {
      queueAbility('SCRAPS!', 'var(--rare)', `${munchGhost.name} — ${lF.name} defeated! +4 HP! (${munchHpBefore} → ${munchHpAfter}/${munchGhost.maxHp})`, () => { munchGhost.hp = munchHpAfter; renderBattle(); }, winTeamName);
    }
  }
  if (romyTriggered) {
    queueAbility('VALLEY GUARDIAN!', 'var(--legendary)', `${wF.name} — Predicted ${romyWinPred}... HIT! +3 damage!`, null, winTeamName);
  }
  if (hectorTriggered) {
    queueAbility('PROTECTOR!', 'var(--ghost-rare)', `${wF.name} — Singles win! +1 bonus damage!`, null, winTeamName);
  }
  if (tabithaTriggered) {
    queueAbility('RALLY!', 'var(--ghost-rare)', `Tabitha cheers from the sideline — Doubles! +2 damage!`, null, winTeamName);
  }
  if (darkJeffTriggered) {
    queueAbility('CACKLE!', 'var(--rare)', `Dark Jeff (sideline) — ${darkJeffBaseDmg} + 1 = ${dmg} damage!`, null, winTeamName);
  }
  if (admiralTriggered) {
    queueAbility('COMRADES!', 'var(--rare)', `Admiral (sideline) — Even doubles! ${admiralBaseDmg} + 2 = ${dmg} damage!`, null, winTeamName);
  }
  if (bilboTriggered) {
    queueAbility('LITTLE BUDDY!', 'var(--rare)', `Bilbo (sideline) — Singles win! ${bilboBaseDmg} + 2 = ${dmg} damage!`, null, winTeamName);
  }
  if (paleNimbusTriggered) {
    const pnSum = winDice ? winDice.reduce((s, d) => s + d, 0) : '?';
    queueAbility('HIDDEN STORM!', 'var(--rare)', `Pale Nimbus (sideline) — Roll sum ${pnSum} < 7! ${paleNimbusBaseDmg} + 2 = ${dmg} damage!`, null, winTeamName);
  }
  if (lauraCatchyTriggered) {
    const _lSeq = winDice ? [...winDice].sort((a, b) => a - b).join('-') : '?';
    const _lauraIsActive = wF.id === 79;
    const _lauraLbl = _lauraIsActive ? wF.name : 'Laura (sideline)';
    queueAbility('CATCHY TUNE!', 'var(--rare)', `${_lauraLbl} — [${_lSeq}] In order! +3 damage + 2 Magic Fireflies!`, () => { renderBattle(); }, winTeamName);
  }
  // Gary (92) — Lucky Novice: win-team Gary — 1s in winning dice grant ice shards (active OR sideline, v598)
  if (garyOnesWin > 0) {
    const garyWinIceTotal = winTeam.resources.ice + garyIceWin;
    const _garyWinId = winGaryActive ? 92 : (getSidelineGhost(winTeam, 92) || { id: 92 }).id;
    const _garyWinLoc = winGaryActive ? 'active' : 'sideline';
    queueAbility('LUCKY NOVICE!', 'var(--rare)', `Gary (${_garyWinLoc}) — ${garyOnesWin} rolled 1${garyOnesWin > 1 ? 's' : ''}! +${garyIceWin} Ice Shards! (${garyWinIceTotal} total)`, () => { winTeam.resources.ice += garyIceWin; creditGhost(winTeamName, _garyWinId, 'ice', garyIceWin); renderBattle(); }, winTeamName);
    if (sandwichForLose) queueAbility('DEPENDABLE!', 'var(--common)', `Sandwiches — mirrors Lucky Novice! +${garyIceWin} Ice Shards! (${loseTeam.resources.ice + garyIceWin} total)`, () => { loseTeam.resources.ice += garyIceWin; creditGhost(loseTeamName, 33, 'ice', garyIceWin); renderBattle(); }, loseTeamName);
    // Knight reactions already collected via collectKC at game-state section (line ~9526) — do NOT double-fire here
  }
  if (banditPeteTriggered) {
    const bpWhoQ = winDice && winDice.length === 2 ? 'Your ghost rolled only 2 dice!' : 'Opponent rolled only 2 dice!';
    queueAbility('BANDIT!', 'var(--rare)', `Bandit Pete (sideline) — ${bpWhoQ} ${banditPeteBaseDmg} + 3 = ${dmg} damage!`, null, winTeamName);
  }
  // Bandit Pete knight reactions already collected via collectKC at game-state section (~line 9545) — do NOT double-fire here
  if (zachCraftsmanTriggered) {
    queueAbility('CRAFTSMAN!', 'var(--rare)', `Zach (sideline) — Guard Thomas doubles! ${zachCraftsmanBaseDmg} + 3 = ${dmg} damage!`, null, winTeamName);
  }
  // Zach knight reactions already collected via collectKC at game-state section (~line 9561) — do NOT double-fire here
  if (louBrosTriggered) {
    // HP heal deferred so the tile updates exactly as the BROS! splash fires — same pattern as Opa Rest / Calvin Overclock
    const louHpBefore = wF.hp;
    const louHpAfter = wF.hp + 1;
    const louOver = louHpAfter > wF.maxHp;
    if (filbertCursesWin) {
      const louFlipped = Math.max(0, wF.hp - 1);
      const louGhost = wF;
      queueAbility('MASK MERCHANT!', 'var(--uncommon)', `Mr Filbert — Bros heal cursed! ${wF.name} takes 1 damage instead! (${wF.hp}→${louFlipped} HP)`, () => { louGhost.hp = louFlipped; if (louGhost.hp <= 0) { louGhost.hp = 0; louGhost.ko = true; louGhost.killedBy = 59; } renderBattle(); }, winTeamName);
      log(`<span class="log-ability">Lou</span> (sideline) — Bros heal cursed by Mr Filbert! ${wF.name} loses 1 HP.`);
    } else {
      queueAbility('BROS!', 'var(--common)', `Lou (sideline) — ${wF.name} wins! ${louBrosBaseDmg} + 1 = ${dmg} damage! +1 HP! (${louHpBefore}→${louHpAfter} HP${louOver ? ' · overclocked!' : ''})`, () => { wF.hp++; renderBattle(); }, winTeamName);
      log(`<span class="log-ability">Lou</span> (sideline) — Bros! Grawr wins → +1 HP (${louHpBefore}→${louHpAfter}${louOver ? ' overclocked!' : ''}).`);
    }
  }
  // Lou knight reactions already collected via collectKC at game-state section (~line 9577) — do NOT double-fire here
  if (chipTriggered) {
    queueAbility('ACROBATIC DIVE!', 'var(--common)', `${wF.name} — Even doubles! +3 damage! (${chipBaseDmg} + 3 = ${dmg})`, null, winTeamName);
  }
  // Chip knight reactions already collected via collectKC at game-state section (~line 9589) — do NOT double-fire here
  if (librarianTriggered) {
    queueAbility('KNOWLEDGE!', 'var(--common)', `Ancient Librarian — ${librarianTwos} 2${librarianTwos > 1 ? 's' : ''} rolled by both teams! ${librarianBaseDmg} + ${librarianTwos} = ${dmg} damage!`, null, winTeamName);
  }
  // Ancient Librarian knight reactions already collected via collectKC at game-state section (~line 9604) — do NOT double-fire here
  if (sparkyTriggered) {
    queueAbility('TINDER!', 'var(--rare)', `${wF.name} — ${sparkyOneCount} rolled 1${sparkyOneCount > 1 ? 's' : ''} × 3 = +${sparkyOneCount * 3} damage! (${sparkyBaseDmg} + ${sparkyOneCount * 3} = ${dmg})`, null, winTeamName);
  }
  // Sparky knight reactions already collected via collectKC at game-state section (~line 9620) — do NOT double-fire here
  if (!tabithaTriggered && corneliusBlocksRally && hasSideline(winTeam, 95) && wR.type === 'doubles' && !wF.ko) {
    // Cornelius (45) — Antidote: blocked Tabitha Rally — show the negation callout
    const cornGhost3 = getSidelineGhost(loseTeam, 45);
    const blockerName = cornGhost3 ? cornGhost3.name : 'Cornelius';
    queueAbility('ANTIDOTE!', 'var(--uncommon)', `${blockerName} neutralizes Tabitha's Rally — +0 damage!`, null, loseTeamName);
  }
  // Cornelius (45) — Antidote: blocked any other sideline damage boosters (Admiral/Dark Jeff/Bilbo/Pale Nimbus/Laura/Bandit Pete/Zach/Lou)
  if (corneliusSidelineBlockedList.length > 0) {
    const cornGhost4 = getSidelineGhost(loseTeam, 45);
    const antidoteName = cornGhost4 ? cornGhost4.name : 'Cornelius';
    const blockedStr = corneliusSidelineBlockedList.join(', ');
    queueAbility('ANTIDOTE!', 'var(--uncommon)', `${antidoteName} neutralizes: ${blockedStr} — sideline buffs blocked!`, null, loseTeamName);
  }
  if (kodakoSwiftWin) {
    queueAbility('SWIFT!', 'var(--common)', `${wF.name} — 1-2-3! Combo locked in → exactly 4 damage!`, null, winTeamName);
  }
  // Kodako knight reactions already collected via collectKC at game-state section (~line 9638) — do NOT double-fire here
  if (pureHeartKO) {
    queueAbility('PURE HEART!', 'var(--ghost-rare)', `${wF.name} — All-in! ${lF.name} instantly defeated!`, null, winTeamName);
  }
  // Pure Heart/Toby knight reactions already collected via collectKC at game-state section (~line 9356) — do NOT double-fire here
  if (skylarTriggered) {
    const shardsUsed = B.committed[winTeamName].ice;
    queueAbility('WINTER BARRAGE!', 'var(--ghost-rare)', `${wF.name} — ${shardsUsed} Ice Shard${shardsUsed>1?'s':''} × 2 = +${shardsUsed*2} damage!`, null, winTeamName);
  }
  // Skylar knight reactions already collected via collectKC at game-state section (~line 9052) — do NOT double-fire here
  if (tylerFireTriggered) {
    const firesUsed = B.committed[winTeamName].fire;
    queueAbility('HEATING UP!', 'var(--ghost-rare)', `${wF.name} — ${firesUsed} Sacred Fire${firesUsed>1?'s':''} × 2 = +${firesUsed*6} damage!`, null, winTeamName);
  }
  // Tyler knight reactions already collected via collectKC at game-state section (~line 9065) — do NOT double-fire here
  if (zainIceBladeTriggered) {
    queueAbility('ICE BLADE!', 'var(--ghost-rare)', `${wF.name} — Ice Blade strikes! +2 damage!`, null, winTeamName);
  }
  if (zainIceBladeTriggered) checkKnightEffects(winTeamName, wF.name); // Knight Terror/Light react to ICE BLADE! (committed blade)
  // Flame Blade: +5 Burn on win callout
  if (flameBladeWinTriggered) {
    queueAbility('FLAME BLADE!', 'var(--rare)', `Flame Blade strikes! +5 Burn!`, null, winTeamName);
  }
  if (redHunterTriggered) {
    queueAbility('RUMBLE!', 'var(--ghost-rare)', `${wF.name} — Enemy has resources! +3 damage!`, null, winTeamName);
  }
  // Red Hunter knight reactions already collected via collectKC at game-state section (line ~9384) — do NOT double-fire here
  if (timpletonTriggered) {
    queueAbility('BIG TARGET!', 'var(--rare)', `${wF.name} — ${lF.name}'s HP higher than Timpleton! +3 damage!`, null, winTeamName);
  }
  // Timpleton knight reactions already collected via collectKC in the game-state Big Target block above — do NOT double-fire here
  // Sylvia dodge callouts (queued here — abilityQueueMode=true — not in the game-state section)
  if (lF.id === 313 && !lF.ko && sylviaDodgeRolls.length > 0) {
    if (sylviaDodged) queueAbility('PORPOISE!', 'var(--rare)', `${lF.name} rolls [${sylviaDodgeRolls.join(', ')}] — DODGED!`, null, loseTeamName);
    else queueAbility('PORPOISE — MISS', 'var(--border)', `${lF.name} rolls [${sylviaDodgeRolls.join(', ')}] — odd! No dodge.`, null, loseTeamName);
  }
  // Sylvia knight reactions already collected via collectKC at game-state section — do NOT double-fire here

  // Eternal Flame callout — grant fires in onShow so counter updates when the splash fires, not before
  if (B.committed[winTeamName].fire > 0 && winTeam.ghosts.some(g => g.id === 406 && !g.ko)) {
    const _etFlameTeam = winTeam;
    const _etFlameCount = B.committed[winTeamName].fire;
    queueAbility('ETERNAL FLAME!', 'var(--uncommon)', `Fed and Hayden — ${_etFlameCount} Sacred Fire${_etFlameCount > 1 ? 's' : ''} preserved!`, () => {
      _etFlameTeam.resources.fire += _etFlameCount;
      log(`<span class="log-ability">Fed and Hayden</span> — Eternal Flame! ${_etFlameCount} Sacred Fire${_etFlameCount > 1 ? 's' : ''} not discarded! (${_etFlameTeam.resources.fire} total)`);
      renderBattle();
    }, winTeamName);
    checkKnightEffects(winTeamName, 'Fed and Hayden'); // Knight Terror/Light react to ETERNAL FLAME!
    if (sandwichForLose) queueAbility('DEPENDABLE!', 'var(--common)', `Sandwiches — mirrors Eternal Flame! +${_etFlameCount} Sacred Fire${_etFlameCount > 1 ? 's' : ''}! (${loseTeam.resources.fire + _etFlameCount} total)`, () => { loseTeam.resources.fire += _etFlameCount; renderBattle(); }, loseTeamName);
  }

  // Prince Balatron (113) — Party Time: NO auto-callout here. B.balatronPending was set in
  // the compute block above; the interactive reveal modal fires at the START of the
  // drainAbilityQueue post-callback (see showBalatronModal injection below), giving the
  // player a click-to-roll moment instead of a flat combat-log line.

  // Night Master (103) — Bullseye: sideline snipe callout — onShow updates sideline display
  if (bullseyeTarget) {
    queueAbility('BULLSEYE!', 'var(--ghost-rare)', `${wF.name} — Doubles! ${bullseyeTarget.ghost.name} (${bullseyeTarget.priorHp} HP) sniped from the enemy sideline!`, () => { renderBattle(); }, winTeamName);
  }

  // Bubble Boys (44) — Pop: callout fires after Bullseye, onShow re-renders so KO greys out BB
  if (bubbleBoysPopped) {
    queueAbility('POP!', 'var(--uncommon)', `${bubbleBoysName} — ${bubbleBoysEnemyName} rolled triples! Bubble Boys burst!`, () => { renderBattle(); }, loseTeamName);
  }

  // King Jay (106) — Reflection: lost + dice total 7 → damage reflected to winner
  // onShow defers wF.hp mutation so the HP bar drops exactly when REFLECTION! fires, not silently during beat 4.
  if (kingJayReflected) {
    const reflectKoSuffix = wF.ko ? ' — KO!' : ` — ${kingJayHpAfter} HP left`;
    queueAbility('REFLECTION!', 'var(--ghost-rare)', `${lF.name} — Lucky 7! ${kingJayReflectDmg} damage reflected back!${reflectKoSuffix}`, () => { wF.hp = kingJayHpAfter; renderBattle(); }, loseTeamName);
  }
  // King Jay knight reactions already collected via collectKC at game-state section (line ~9746) — do NOT double-fire here

  // Guardian Fairy (99) — Wish: absorbed damage callout (onShow re-renders sideline to grey out GF if KO'd)
  if (guardianFairyAbsorbed && gfSacrifice) {
    const gfKoSuffix = guardianFairyKOd ? ' — GUARDIAN FAIRY FALLS!' : ` — ${gfHpAfter} HP remaining.`;
    queueAbility('WISH!', 'var(--ghost-rare)', `${gfSacrifice.name} — Takes ${guardianFairyAbsorbedDmg} damage for ${lF.name}!${gfKoSuffix}`, () => { gfSacrifice.hp = gfHpAfter; renderBattle(); }, loseTeamName);
  }
  // Guardian Fairy knight reactions already collected via collectKC at game-state section (line ~9767) — do NOT double-fire here

  // Guard Thomas (41) — Stoic: immunity callout fires after Wish so defenses resolve in order
  if (guardThomasStoic) {
    queueAbility('STOIC!', 'var(--uncommon)', `${lF.name} — Below 6 HP! Singles roll negated — taking no damage!`, null, loseTeamName);
  }
  if (guardThomasStoic) checkKnightEffects(loseTeamName, lF.name); // Knight Terror/Light react to STOIC!

  // Bogey (53) — Bogus: reflect callout fires after Stoic — shows the reflected amount and winner's remaining HP
  // HP bar updates in onShow callback so it drops exactly when BOGUS! flashes, not silently at beat 4.
  if (bogeyReflected) {
    const bogeyKoSuffix = wF.ko ? ' — KO!' : ` — ${bogeyHpAfter} HP left`;
    queueAbility('BOGUS!', 'var(--uncommon)', `${lF.name} — REFLECT! ${bogeyReflectDmg} damage bounced back to ${wF.name}!${bogeyKoSuffix}`,
      () => { wF.hp = bogeyHpAfter; renderBattle(); }, loseTeamName);
  }
  // Bogey knight reactions already collected via collectKC at game-state section (line ~9662) — do NOT double-fire here

  // Mirror Matt (410) — Seven Years: reflected damage callout
  if (mirrorMattReflected) {
    const mmKoSuffix = wF.ko ? ' — KO!' : ` — ${wF.hp} HP left`;
    queueAbility('SEVEN YEARS!', 'var(--uncommon)', `${lF.name} — REFLECT! ${wR.type} → ${mirrorMattReflectDmg} damage bounced to ${wF.name}!${mmKoSuffix}`, null, loseTeamName);
  }

  // Jasper (428) — Flame Dive: NO auto-callout here. B.jasperPending was set in the
  // resolver; the interactive modal (showJasperModal) fires in the post-drain callback.

  // Twyla (417) — Lucky Dance: v674 rework moved to dice count section (dice + Healing Seeds pre-roll)

  // Garrick (427) — Watchfire: damage reduction callout (on loss)
  if (lF.id === 427 && !lF.ko) {
    // callout only if Garrick was hit — logged inline above
  }

  if (kodakoSwiftLose) {
    const swiftLoseKoSuffix = wF.ko ? ' — KO!' : ` — ${swiftLoseHpAfter} HP left`;
    queueAbility('SWIFT!', 'var(--common)', `${lF.name} — 1-2-3! Negate damage, deal 4 back to ${wF.name}!${swiftLoseKoSuffix}`,
      () => { wF.hp = swiftLoseHpAfter; renderBattle(); }, loseTeamName);
  }
  // Kodako SWIFT! lose-path knight reactions already collected via collectKC at game-state section (line ~9671) — do NOT double-fire here

  // Patrick (10) — Stone Form: singles negated + 3 counter-damage callout
  // onShow defers wF.hp mutation so the HP bar drops at the same moment the callout fires.
  if (patrickStoneForm) {
    const stoneFormKoSuffix = wF.ko ? ' — KO!' : ` — ${stoneFormHpAfter} HP left`;
    queueAbility('STONE FORM!', 'var(--common)', `${lF.name} — Singles blocked! ${patrickStoneDmg} damage to ${wF.name}!${stoneFormKoSuffix}`,
      () => { wF.hp = stoneFormHpAfter; renderBattle(); }, loseTeamName);
  }
  // Patrick knight reactions already collected via collectKC at game-state section (line ~9683) — do NOT double-fire here

  // Dealer (37) — House Rules: dice in consecutive order → damage negated callout
  if (dealerHouseRules) {
    const _dealerSorted = [...loseDice].sort((a, b) => a - b);
    queueAbility('HOUSE RULES!', 'var(--uncommon)', `${lF.name} — [${_dealerSorted.join('-')}] In order! ${wF.name}'s attack is nullified!`, null, loseTeamName);
  }
  // Dealer knight reactions already collected via collectKC at game-state section (line ~9696) — do NOT double-fire here

  // Sky (72) — Elusive: incoming big damage (>2) negated callout
  if (skyElusive) {
    queueAbility('ELUSIVE!', 'var(--rare)', `${lF.name} — ${skyElusiveBlockedDmg} damage? Too much! ${wF.name}'s attack negated!`, null, loseTeamName);
  }
  // Sky knight reactions already collected via collectKC at game-state section (line ~9709) — do NOT double-fire here

  // City Cyboo (77) — Barrier: enemy doubles negated callout
  if (cityCybooBarrier) {
    queueAbility('BARRIER!', 'var(--rare)', `${lF.name} — Enemy doubles BLOCKED! ${cityCybooBlockedDmg} damage negated!`, null, loseTeamName);
  }
  // City Cyboo knight reactions already collected via collectKC at game-state section (line ~9721) — do NOT double-fire here

  // Puff (5) — Cute: doubles/triples softened by 1 callout
  if (puffCute) {
    const puffSuffix = dmg === 0 ? ` — 0 damage! Fully absorbed!` : ` — ${wF.name} deals ${dmg} instead!`;
    queueAbility('CUTE!', 'var(--common)', `${lF.name} — ${wR.type}! -1 damage (${puffCuteOriginalDmg} → ${dmg})${puffSuffix}`, null, loseTeamName);
  }
  // Puff knight reactions already collected via collectKC at game-state section (line ~9733) — do NOT double-fire here

  // Little Boo (9) — Mercy: enemy triples converted to [1,2,3] singles callout
  if (mercyTriggered) {
    queueAbility('MERCY!', 'var(--common)', `${lF.name} — Enemy triples count as [1,2,3]! Base damage: 3 → 1. ${wF.name}'s big roll softened!`, null, loseTeamName);
  }
  // Little Boo knight reactions already collected via collectKC at game-state section (line ~9093) — do NOT double-fire here

  // Fang Undercover (7) — Skilled Coward: dodge activated → negate hit, ghost-picker fires after queue drains
  if (fangUndercoverActivated) {
    queueAbility('SKILLED COWARD!', 'var(--common)', `${lF.name} — Dodge! ${wF.name}'s attack negated! Fang slips to the sideline...`, null, loseTeamName);
  }
  // Fang Undercover knight reactions already collected via collectKC at game-state section (line ~9784) — do NOT double-fire here

  // Cameron (25) — Force of Nature: damage negated → loser instantly destroyed (queued after defense callouts)
  if (cameronForceOfNature) {
    queueAbility('FORCE OF NATURE!', 'var(--common)', `${wF.name} — Damage negated... ${lF.name} is instantly DESTROYED!`, () => { renderBattle(); }, loseTeamName);
  }
  // Cameron knight reactions already collected via collectKC at game-state section (line ~9862) — do NOT double-fire here

  // Gus (31) — Gale Force: win + primed → zero damage, opponent CHOOSES which sideline ghost to swap in.
  // Fires after all defense callouts. The actual swap is deferred to a picker modal that opens after
  // the queue drains (same post-drain pattern as Winston Scheme) — opponent gets to pick, not auto-pick.
  if (galeForceSwap && !wF.ko) {
    queueAbility('GALE FORCE!', 'var(--common)', `${wF.name} — No damage! ${loseTeamName === 'red' ? 'Red' : 'Blue'} team must choose a replacement!`, null, winTeamName);
  }
  // Gus knight reactions already collected via collectKC at game-state section (line ~9798) — do NOT double-fire here

  // Hugo (52) — Wreckage: took real damage → attacker loses 1 die next roll
  if (hugoWreckageTriggered) {
    queueAbility('WRECKAGE!', 'var(--uncommon)', `${lF.name} — Took ${dmg} damage! ${wF.name} loses 1 die next roll!`, null, loseTeamName);
  }
  // Hugo knight reactions already collected via collectKC at game-state section (line ~10019) — do NOT double-fire here

  // Marcus (57) — Glacial Pounding: taking 3+ damage charges up +4 bonus dice for next roll
  if (marcusGlacialTriggered) {
    queueAbility('GLACIAL POUNDING!', 'var(--uncommon)', `${lF.name} — Took ${dmg} damage! Charging up... +4 bonus dice next roll!`, null, loseTeamName);
  }
  // Marcus knight reactions already collected via collectKC at game-state section (line ~10029) — do NOT double-fire here

  // On-win callouts — onShow grants the resource the moment the splash appears (not 800ms earlier at Beat 4)
  if (wF.id === 209 && !wF.ko) { queueAbility('PLUNDER!', 'var(--common)', `${wF.name} — Win! +2 Surge!`, () => { winTeam.resources.surge += 2; renderBattle(); }, winTeamName); }
  // Dart knight reactions already collected via collectKC at game-state section (line ~10075) — do NOT double-fire here
  if (wF.id === 209 && !wF.ko && sandwichForLose) queueAbility('DEPENDABLE!', 'var(--common)', `Sandwiches — mirrors Plunder! +2 Surge! (${loseTeam.resources.surge + 2} total)`, () => { loseTeam.resources.surge += 2; renderBattle(); }, loseTeamName);
  if (wF.id === 307 && !wF.ko) { queueAbility('DAUGHTER OF THE STREAM!', 'var(--rare)', `${wF.name} — Win! +3 Ice Shards!`, () => { winTeam.resources.ice += 3; renderBattle(); }, winTeamName); }
  // Artemis knight reactions already collected via collectKC at game-state section (line ~10076) — do NOT double-fire here
  if (wF.id === 307 && !wF.ko && sandwichForLose) queueAbility('DEPENDABLE!', 'var(--common)', `Sandwiches — mirrors Daughter of the Stream! +3 Ice Shards!`, () => { loseTeam.resources.ice += 3; creditGhost(loseTeamName, 33, 'ice', 3); renderBattle(); }, loseTeamName);
  if (wF.id === 81 && !wF.ko) { queueAbility('VALLEY MAGIC!', 'var(--rare)', `${wF.name} — Win! +2 Ice Shards! (${winTeam.resources.ice + 2} total)`, () => { winTeam.resources.ice += 2; renderBattle(); }, winTeamName); }
  // Spockles knight reactions already collected via collectKC at game-state section (line ~10080) — do NOT double-fire here
  if (wF.id === 81 && !wF.ko && sandwichForLose) queueAbility('DEPENDABLE!', 'var(--common)', `Sandwiches — mirrors Valley Magic! +2 Ice Shards! (${loseTeam.resources.ice + 2} total)`, () => { loseTeam.resources.ice += 2; creditGhost(loseTeamName, 33, 'ice', 2); renderBattle(); }, loseTeamName);
  // Zain (206) — Ice Blade: win any roll → gain 1 Ice Shard (fires every win, regardless of blade swing)
  if (wF.id === 206 && !wF.ko) { queueAbility('ICE SHARD!', 'var(--ghost-rare)', `${wF.name} — Win! +1 Ice Shard! (${winTeam.resources.ice + 1} total)`, () => { winTeam.resources.ice++; creditGhost(winTeamName, 206, 'ice', 1); renderBattle(); }, winTeamName); }
  // Zain ICE SHARD knight reactions already collected via collectKC at game-state section (line ~10082) — do NOT double-fire here
  if (wF.id === 206 && !wF.ko && sandwichForLose) queueAbility('DEPENDABLE!', 'var(--common)', `Sandwiches — mirrors Ice Shard! +1 Ice Shard! (${loseTeam.resources.ice + 1} total)`, () => { loseTeam.resources.ice++; creditGhost(loseTeamName, 33, 'ice', 1); renderBattle(); }, loseTeamName);
  // Dylan (301) — Stained Glass: Sideline & In Play, winning rolls gain +1 Burn
  if (hasDylanWin) {
    if (!winTeam.resources.burn) winTeam.resources.burn = 0;
    const dylanName = (wF.id === 301) ? wF.name : (getSidelineGhost(winTeam, 301) || {}).name || 'Dylan';
    const dylanLabel = (wF.id === 301) ? '' : ' (sideline)';
    queueAbility('STAINED GLASS!', 'var(--common)', `${dylanName}${dylanLabel} — Win! +1 Burn!`, () => { winTeam.resources.burn += 1; renderBattle(); }, winTeamName);
    log(`<span class="log-ability">${dylanName}${dylanLabel}</span> — Stained Glass! Gain <span class="log-dmg">1 Burn</span>!`);
  }
  // Roger (54) — Tempest: win with 4+ dice containing 2 different pairs → +3 Sacred Fires
  if (wF.id === 54 && !wF.ko && winDice && winDice.length >= 4) {
    const _dieCounts = {};
    winDice.forEach(d => _dieCounts[d] = (_dieCounts[d]||0)+1);
    const _pairCount = Object.values(_dieCounts).filter(c => c >= 2).length;
    if (_pairCount >= 2) {
      collectKC(winTeamName, wF.name);  // Roger Tempest — Knight Terror/Light react when ability fires
      const _newFires = winTeam.resources.fire + 3;
      queueAbility('TEMPEST!', 'var(--uncommon)', `${wF.name} — 2 pairs! Boom shaka laka! +3 Sacred Fires! (${_newFires} total)`, () => { winTeam.resources.fire += 3; renderBattle(); }, winTeamName);
      if (sandwichForLose) queueAbility('DEPENDABLE!', 'var(--common)', `Sandwiches — mirrors Tempest! +3 Sacred Fires! (${loseTeam.resources.fire + 3} total)`, () => { loseTeam.resources.fire += 3; renderBattle(); }, loseTeamName);
    }
  }
  // Ashley (58) — Burning Soul: win a roll → gain +1 Sacred Fire
  if (wF.id === 58 && !wF.ko) { queueAbility('BURNING SOUL!', 'var(--uncommon)', `${wF.name} — Win! +1 Sacred Fire! (${winTeam.resources.fire + 1} total)`, () => { winTeam.resources.fire++; renderBattle(); }, winTeamName); }
  // Ashley knight reactions already collected via collectKC at game-state section (line ~10081) — do NOT double-fire here
  if (wF.id === 58 && !wF.ko && sandwichForLose) queueAbility('DEPENDABLE!', 'var(--common)', `Sandwiches — mirrors Burning Soul! +1 Sacred Fire! (${loseTeam.resources.fire + 1} total)`, () => { loseTeam.resources.fire++; renderBattle(); }, loseTeamName);
  // Opa (48) — Rest: win → gain +1 HP (overclocks! Rule #9 — do NOT add Math.min cap)
  // Mr Filbert (59) — Mask Merchant: flips the +1 heal to -1 damage when on enemy sideline.
  if (wF.id === 48 && !wF.ko) {
    if (filbertCursesWin) {
      const opaFlipped = Math.max(0, wF.hp - 1);
      const opaGhost = wF;
      queueAbility('MASK MERCHANT!', 'var(--uncommon)', `Mr Filbert — Rest cursed! ${wF.name} takes 1 damage! (${wF.hp}→${opaFlipped} HP)`, () => { opaGhost.hp = opaFlipped; if (opaGhost.hp <= 0) { opaGhost.hp = 0; opaGhost.ko = true; opaGhost.killedBy = 59; } renderBattle(); }, winTeamName);
      log(`<span class="log-ability">${wF.name}</span> — Rest! Mr Filbert curses → -1 HP (${opaFlipped} HP).`);
    } else {
      const opaNewHp = wF.hp + 1;
      const opaOver = opaNewHp > wF.maxHp;
      queueAbility('REST!', 'var(--uncommon)', `${wF.name} — Won! +1 HP! (${wF.hp}→${opaNewHp} HP${opaOver ? ' · overclocked!' : ''})`, () => { wF.hp++; renderBattle(); }, winTeamName);
      log(`<span class="log-ability">${wF.name}</span> — Rest! Win → +1 HP (${opaNewHp} HP${opaOver ? ' overclocked!' : ''}).`);
    }
  }
  if (wF.id === 48 && !wF.ko) checkKnightEffects(winTeamName, wF.name); // Knight Terror/Light react to REST! (both heal and Filbert-curse branches)
  // Villager (11) — Hospitality: sideline passive — active ghost gains +1 HP every winning roll (Filbert-aware, Cornelius-aware).
  if (hasSideline(winTeam, 11) && !wF.ko) {
    if (corneliusBlocksRally) {
      const cornVillager = getSidelineGhost(loseTeam, 45);
      const antidoteNameV = cornVillager ? cornVillager.name : 'Cornelius';
      queueAbility('ANTIDOTE!', 'var(--uncommon)', `${antidoteNameV} neutralizes Villager's Hospitality — heal blocked!`, null, winTeamName);
      log(`<span class="log-ability">Cornelius</span> — Antidote! Villager Hospitality blocked.`);
    } else if (filbertCursesWin) {
      const villagerFlipped = Math.max(0, wF.hp - 1);
      const villagerGhost = wF;
      queueAbility('MASK MERCHANT!', 'var(--uncommon)', `Mr Filbert — Hospitality cursed! ${wF.name} takes 1 damage! (${wF.hp}→${villagerFlipped} HP)`, () => { villagerGhost.hp = villagerFlipped; if (villagerGhost.hp <= 0) { villagerGhost.hp = 0; villagerGhost.ko = true; villagerGhost.killedBy = 59; } renderBattle(); }, winTeamName);
      log(`<span class="log-ability">${wF.name}</span> — Hospitality! Filbert curses → -1 HP (${villagerFlipped} HP).`);
    } else {
      const villagerNewHp = wF.hp + 1;
      const vilOver = villagerNewHp > wF.maxHp;
      queueAbility('HOSPITALITY!', 'var(--common)', `Villager — ${wF.name} wins! +1 HP from the sideline! (${wF.hp}→${villagerNewHp} HP${vilOver ? ' · overclocked!' : ''})`, () => { wF.hp++; renderBattle(); }, winTeamName);
      log(`<span class="log-ability">${wF.name}</span> — Hospitality! Villager sideline → +1 HP (${villagerNewHp} HP${vilOver ? ' overclocked!' : ''}).`);
    }
  }
  if (hasSideline(winTeam, 11) && !wF.ko) checkKnightEffects(winTeamName, wF.name); // Knight Terror/Light react to HOSPITALITY! (all branches)
  // Jeffery (14) — Chuckle: sideline passive — active ghost gains +3 HP when the winning roll DEFEATS the enemy ghost (lF.ko).
  // "Wins a battle" = KO an enemy ghost, NOT merely winning a roll. Filbert-aware, Cornelius-aware.
  // Phase 3 debug breadcrumb — helps Wyatt verify the Chuckle path fires correctly
  console.log('[CHUCKLE DEBUG]', {
    hasSideline: hasSideline(winTeam, 14),
    wFko: wF.ko,
    lFko: lF.ko,
    cornelius: corneliusBlocksRally,
    filbert: filbertCursesWin
  });
  if (hasSideline(winTeam, 14) && !wF.ko && lF.ko) {
    if (corneliusBlocksRally) {
      const cornJeffery = getSidelineGhost(loseTeam, 45);
      const antidoteNameJ = cornJeffery ? cornJeffery.name : 'Cornelius';
      queueAbility('ANTIDOTE!', 'var(--uncommon)', `${antidoteNameJ} neutralizes Jeffery's Chuckle — heal blocked!`, null, winTeamName);
      log(`<span class="log-ability">Cornelius</span> — Antidote! Jeffery Chuckle blocked.`);
    } else if (filbertCursesWin) {
      const jeffFlipped = Math.max(0, wF.hp - 3);
      const jeffGhost = wF;
      queueAbility('MASK MERCHANT!', 'var(--uncommon)', `Mr Filbert — Chuckle cursed! ${wF.name} takes 3 damage! (${wF.hp}→${jeffFlipped} HP)`, () => { jeffGhost.hp = jeffFlipped; if (jeffGhost.hp <= 0) { jeffGhost.hp = 0; jeffGhost.ko = true; jeffGhost.killedBy = 59; } renderBattle(); }, winTeamName);
      log(`<span class="log-ability">${wF.name}</span> — Chuckle! Filbert curses → -3 HP (${jeffFlipped} HP).`);
    } else {
      const jeffNewHp = wF.hp + 3;
      const jeffOver = jeffNewHp > wF.maxHp;
      queueAbility('CHUCKLE!', 'var(--common)', `Jeffery — ${wF.name} wins! +3 HP from the sideline! (${wF.hp}→${jeffNewHp} HP${jeffOver ? ' · overclocked!' : ''})`, () => { wF.hp += 3; renderBattle(); }, winTeamName);
      log(`<span class="log-ability">${wF.name}</span> — Chuckle! Jeffery sideline → +3 HP (${jeffNewHp} HP${jeffOver ? ' overclocked!' : ''}).`);
    }
  }
  if (hasSideline(winTeam, 14) && !wF.ko && lF.ko) checkKnightEffects(winTeamName, wF.name); // Knight Terror/Light react to CHUCKLE! (all branches, KO-gated)
  // Calvin (342) — Overclock: win heals 1 HP + gains 1 Healing Seed. Mr Filbert flips the heal to damage.
  if (wF.id === 342 && !wF.ko) {
    if (filbertCursesWin) {
      const calFlipped = Math.max(0, wF.hp - 1);
      queueAbility('MASK MERCHANT!', 'var(--uncommon)', `Mr Filbert — Overclock cursed! ${wF.name} takes 1 damage! (${wF.hp}→${calFlipped} HP)`, () => { wF.hp = calFlipped; if (wF.hp <= 0) { wF.hp = 0; wF.ko = true; wF.killedBy = 59; } renderBattle(); }, winTeamName);
      log(`<span class="log-ability">Mr Filbert</span> — Mask Merchant! Calvin Overclock flipped to damage. ${wF.name} ${wF.hp} → ${calFlipped} HP.`);
    } else {
      queueAbility('OVERCLOCK!', 'var(--uncommon)', `${wF.name} — Win heals 1 HP + 1 Healing Seed! ${wF.hp}→${wF.hp + 1} HP${wF.hp + 1 > wF.maxHp ? ' · overclocked!' : ''}`, () => { wF.hp++; winTeam.resources.healingSeed++; renderBattle(); }, winTeamName);
      log(`<span class="log-ability">${wF.name}</span> — Overclock! +1 HP (${wF.hp + 1} HP${wF.hp + 1 > wF.maxHp ? ' overclocked!' : ''}) + <span class="log-heal">+1 Healing Seed!</span>`);
    }
  }
  // Calvin knight reactions already collected via collectKC at game-state section (line ~10077) — do NOT double-fire here
  if (humarTriggered) { queueAbility('METEOR!', 'var(--legendary)', `${wF.name} — Win! 2 delayed damage + 1 Burn gained!`, () => { renderBattle(); }, winTeamName); }
  // Humar knight reactions already collected via collectKC at game-state section (line ~10078) — do NOT double-fire here
  // Humar Sandwiches mirror removed — Meteor deals delayed damage + burn, not mirrorable resources
  if (wF.id === 309 && !wF.ko) { queueAbility('HARVEST DANCE!', 'var(--rare)', `${wF.name} — Win → +1 Healing Seed!`, () => { winTeam.resources.healingSeed++; renderBattle(); }, winTeamName); }
  // Aunt Susan knight reactions already collected via collectKC at game-state section (line ~10079) — do NOT double-fire here
  if (wF.id === 309 && !wF.ko && sandwichForLose) queueAbility('DEPENDABLE!', 'var(--common)', `Sandwiches — mirrors Harvest Dance! +1 Healing Seed! (${loseTeam.resources.healingSeed + 1} total)`, () => { loseTeam.resources.healingSeed++; renderBattle(); }, loseTeamName);
  // Splinter (101) — Toxic Fumes: first win triggers activation callout
  if (splinterJustActivated) {
    queueAbility('TOXIC FUMES!', 'var(--ghost-rare)', `${wF.name} — First Win! Toxic Fumes activated — 1 chip damage before every roll from now on!`, null, winTeamName);
  }
  // Farmer Jeff (314) — Harvest: active OR sideline fires on any 6 rolled, win OR lose (v636 buff).
  if (hasFJWin && countVal(winDice, 6) > 0) {
    const sx = countVal(winDice, 6);
    const fjIsActive = wF.id === 314 && !wF.ko;
    const _jeffId = fjIsActive ? 314 : (getSidelineGhost(winTeam, 314) || { id: 314 }).id;
    const fjLabel = fjIsActive ? 'Farmer Jeff' : 'Farmer Jeff (sideline)';
    queueAbility('HARVEST!', 'var(--ghost-rare)', `${fjLabel} — ${sx} six${sx>1?'es':''} = ${sx} Healing Seed${sx>1?'s':''}!`, () => { winTeam.resources.healingSeed += sx; creditGhost(winTeamName, _jeffId, 'seed', sx); if (!fjIsActive) popSidelineCard(winTeam, 314); renderBattle(); }, winTeamName);
    // Farmer Jeff knight reactions already collected via collectKC at game-state section — do NOT double-fire here
    if (sandwichForLose) queueAbility('DEPENDABLE!', 'var(--common)', `Sandwiches — mirrors Harvest! +${sx} Healing Seed${sx>1?'s':''}! (${loseTeam.resources.healingSeed + sx} total)`, () => { loseTeam.resources.healingSeed += sx; creditGhost(loseTeamName, 33, 'seed', sx); renderBattle(); }, loseTeamName);
  }
  if (hasFJLose && countVal(loseDice, 6) > 0) {
    const sxL = countVal(loseDice, 6);
    const fjIsActiveLose = lF.id === 314 && !lF.ko;
    const _jeffIdLose = fjIsActiveLose ? 314 : (getSidelineGhost(loseTeam, 314) || { id: 314 }).id;
    const fjLabelLose = fjIsActiveLose ? 'Farmer Jeff' : 'Farmer Jeff (sideline)';
    queueAbility('HARVEST!', 'var(--ghost-rare)', `${fjLabelLose} — ${sxL} six${sxL>1?'es':''} = ${sxL} Healing Seed${sxL>1?'s':''}!`, () => { loseTeam.resources.healingSeed += sxL; creditGhost(loseTeamName, _jeffIdLose, 'seed', sxL); if (!fjIsActiveLose) popSidelineCard(loseTeam, 314); renderBattle(); }, loseTeamName);
    // Farmer Jeff lose-path knight reactions already collected via collectKC at game-state section — do NOT double-fire here
    if (sandwichForWin) queueAbility('DEPENDABLE!', 'var(--common)', `Sandwiches — mirrors Harvest! +${sxL} Healing Seed${sxL>1?'s':''}! (${winTeam.resources.healingSeed + sxL} total)`, () => { winTeam.resources.healingSeed += sxL; creditGhost(winTeamName, 33, 'seed', sxL); renderBattle(); }, winTeamName);
  }

  // Simon (24) — Brew Time: post-roll trigger REMOVED. Only fires on pre-roll chip damage now.

  // Sad Sal (29) — Tough Job: lost → +1 Ice Shard (onShow deferred so ice tile updates WITH the splash)
  if (sadSalTriggered) {
    const sadSalIceTotal = loseTeam.resources.ice + 1;
    queueAbility('TOUGH JOB!', 'var(--common)', `${lF.name} — Lost the roll... but gained 1 Ice Shard! (${sadSalIceTotal} total)`, () => { loseTeam.resources.ice++; renderBattle(); }, loseTeamName);
    // Sad Sal knight reactions already collected via collectKC at game-state section (line ~10009) — do NOT double-fire here
    if (sandwichForWin) queueAbility('DEPENDABLE!', 'var(--common)', `Sandwiches — mirrors Tough Job! +1 Ice Shard! (${winTeam.resources.ice + 1} total)`, () => { winTeam.resources.ice++; creditGhost(winTeamName, 33, 'ice', 1); renderBattle(); }, winTeamName);
  }

  // Gary (92) — Lucky Novice: lose-team Gary — 1s in losing dice still grant ice shards (active OR sideline, v598)
  if (garyOnesLose > 0) {
    const garyLoseIceTotal = loseTeam.resources.ice + garyIceLose;
    const _garyLoseId = loseGaryActive ? 92 : (getSidelineGhost(loseTeam, 92) || { id: 92 }).id;
    const _garyLoseLoc = loseGaryActive ? 'active' : 'sideline';
    queueAbility('LUCKY NOVICE!', 'var(--rare)', `Gary (${_garyLoseLoc}) — ${garyOnesLose} rolled 1${garyOnesLose > 1 ? 's' : ''}! +${garyIceLose} Ice Shards! (${garyLoseIceTotal} total)`, () => { loseTeam.resources.ice += garyIceLose; creditGhost(loseTeamName, _garyLoseId, 'ice', garyIceLose); renderBattle(); }, loseTeamName);
    if (sandwichForWin) queueAbility('DEPENDABLE!', 'var(--common)', `Sandwiches — mirrors Lucky Novice! +${garyIceLose} Ice Shards! (${winTeam.resources.ice + garyIceLose} total)`, () => { winTeam.resources.ice += garyIceLose; creditGhost(winTeamName, 33, 'ice', garyIceLose); renderBattle(); }, winTeamName);
    // Gary lose-path knight reactions already collected via collectKC at game-state section (line ~9531) — do NOT double-fire here
  }

  // On-lose callouts — onShow applies the surge grant with the splash
  if (lF.id === 404 && !lF.ko) { queueAbility('BITTER END!', 'var(--rare)', `${lF.name} — Lost but gained 1 Surge!`, () => { loseTeam.resources.surge++; renderBattle(); }, loseTeamName); }
  // Chagrin knight reactions already collected via collectKC at game-state section (line ~10109) — do NOT double-fire here
  if (lF.id === 404 && !lF.ko && sandwichForWin) queueAbility('DEPENDABLE!', 'var(--common)', `Sandwiches — mirrors Bitter End! +1 Surge! (${winTeam.resources.surge + 1} total)`, () => { winTeam.resources.surge++; renderBattle(); }, winTeamName);
  // On-KO callouts — onShow applies the Granny resource grant with the splash
  if (lF.ko) {
    if (hasSideline(loseTeam, 310)) {
      if (wR.type === 'singles') {
        queueAbility('BEDTIME STORY!', 'var(--uncommon)', `Granny consoles — singles KO → 2 Lucky Stones!`, () => { loseTeam.resources.luckyStone += 2; creditGhost(loseTeamName, 310, 'ls', 2); popSidelineCard(loseTeam, 310); renderBattle(); }, loseTeamName);
        if (sandwichForWin) queueAbility('DEPENDABLE!', 'var(--common)', `Sandwiches — mirrors Bedtime Story! +2 Lucky Stones! (${winTeam.resources.luckyStone + 2} total)`, () => { winTeam.resources.luckyStone += 2; renderBattle(); }, winTeamName);
      } else if (wR.type === 'doubles') {
        queueAbility('BEDTIME STORY!', 'var(--uncommon)', `Granny consoles — doubles KO → Moonstone!`, () => { loseTeam.resources.moonstone++; creditGhost(loseTeamName, 310, 'ms', 1); popSidelineCard(loseTeam, 310); renderBattle(); }, loseTeamName);
        if (sandwichForWin) queueAbility('DEPENDABLE!', 'var(--common)', `Sandwiches — mirrors Bedtime Story! +1 Moonstone! (${winTeam.resources.moonstone + 1} total)`, () => { winTeam.resources.moonstone++; renderBattle(); }, winTeamName);
      } else if (isTripleOrBetter(wR.type)) {
        queueAbility('BEDTIME STORY!', 'var(--uncommon)', `Granny consoles — ${wR.type} KO → 3 Sacred Fires!`, () => { loseTeam.resources.fire += 3; creditGhost(loseTeamName, 310, 'fire', 3); popSidelineCard(loseTeam, 310); renderBattle(); }, loseTeamName);
        if (sandwichForWin) queueAbility('DEPENDABLE!', 'var(--common)', `Sandwiches — mirrors Bedtime Story! +3 Sacred Fires! (${winTeam.resources.fire + 3} total)`, () => { winTeam.resources.fire += 3; renderBattle(); }, winTeamName);
      }
    }
    if (lF.id === 404) { queueAbility('BITTER END!', 'var(--rare)', `${lF.name} — KO'd but still gains 1 Surge!`, () => { loseTeam.resources.surge++; renderBattle(); }, loseTeamName); }
    if (lF.id === 404 && sandwichForWin) queueAbility('DEPENDABLE!', 'var(--common)', `Sandwiches — mirrors Bitter End (KO)! +1 Surge! (${winTeam.resources.surge + 1} total)`, () => { winTeam.resources.surge++; renderBattle(); }, winTeamName);
  }
  // Granny callout when winner self-KOs (Pudge Belly Flop doubles = always surge for Granny on winner's team)
  if (wF.ko && hasSideline(winTeam, 310)) {
    if (wR.type === 'singles') {
      queueAbility('BEDTIME STORY!', 'var(--uncommon)', `Granny consoles — singles KO → 2 Lucky Stones!`, () => { winTeam.resources.luckyStone += 2; creditGhost(winTeamName, 310, 'ls', 2); popSidelineCard(winTeam, 310); renderBattle(); }, winTeamName);
      if (sandwichForLose) queueAbility('DEPENDABLE!', 'var(--common)', `Sandwiches — mirrors Bedtime Story! +2 Lucky Stones! (${loseTeam.resources.luckyStone + 2} total)`, () => { loseTeam.resources.luckyStone += 2; renderBattle(); }, loseTeamName);
    } else if (wR.type === 'doubles') {
      queueAbility('BEDTIME STORY!', 'var(--uncommon)', `Granny consoles — doubles KO → Moonstone!`, () => { winTeam.resources.moonstone++; creditGhost(winTeamName, 310, 'ms', 1); popSidelineCard(winTeam, 310); renderBattle(); }, winTeamName);
      if (sandwichForLose) queueAbility('DEPENDABLE!', 'var(--common)', `Sandwiches — mirrors Bedtime Story! +1 Moonstone! (${loseTeam.resources.moonstone + 1} total)`, () => { loseTeam.resources.moonstone++; renderBattle(); }, loseTeamName);
    } else if (isTripleOrBetter(wR.type)) {
      queueAbility('BEDTIME STORY!', 'var(--uncommon)', `Granny consoles — ${wR.type} KO → 3 Sacred Fires!`, () => { winTeam.resources.fire += 3; creditGhost(winTeamName, 310, 'fire', 3); popSidelineCard(winTeam, 310); renderBattle(); }, winTeamName);
      if (sandwichForLose) queueAbility('DEPENDABLE!', 'var(--common)', `Sandwiches — mirrors Bedtime Story! +3 Sacred Fires! (${loseTeam.resources.fire + 3} total)`, () => { loseTeam.resources.fire += 3; renderBattle(); }, loseTeamName);
    }
  }

  // Powder (23) — Final Gift: KO'd → loseTeam gains 3 Ice Shards (onShow deferred for visual sync)
  if (powderFinalGiftTriggered) {
    const powderIceTotal = loseTeam.resources.ice + 3;
    queueAbility('FINAL GIFT!', 'var(--common)', `${lF.name} — Defeated... but leaves 3 Ice Shards behind! (${powderIceTotal} total)`, () => { loseTeam.resources.ice += 3; creditGhost(loseTeamName, 23, 'ice', 3); renderBattle(); }, loseTeamName);
    if (sandwichForWin) queueAbility('DEPENDABLE!', 'var(--common)', `Sandwiches — mirrors Final Gift! +3 Ice Shards! (${winTeam.resources.ice + 3} total)`, () => { winTeam.resources.ice += 3; creditGhost(winTeamName, 33, 'ice', 3); renderBattle(); }, winTeamName);
  }

  // Chester (426) — Well Read: Win: singles → +1 Healing Seed, doubles+ → +1 Magic Firefly
  if (wF.id === 426 && !wF.ko) {
    const chesterIsDoubles = ['doubles','triples','quads','penta'].includes(wR.type);
    if (chesterIsDoubles) {
      queueAbility('WELL READ!', 'var(--uncommon)', `${wF.name} — Doubles+ Win! +1 Burn!`, () => { if (!winTeam.resources.burn) winTeam.resources.burn = 0; winTeam.resources.burn++; renderBattle(); }, winTeamName);
      log(`<span class="log-ability">${wF.name}</span> — Well Read! +1 Burn!`);
    } else {
      queueAbility('WELL READ!', 'var(--uncommon)', `${wF.name} — Win! +1 Healing Seed!`, () => { winTeam.resources.healingSeed++; renderBattle(); }, winTeamName);
      log(`<span class="log-ability">${wF.name}</span> — Well Read! +1 Healing Seed!`);
    }
    checkKnightEffects(winTeamName, wF.name);
  }

  // Zippa (423) — Glimmer: v674 rework — moved to pre-roll section (before rolling, gain Lucky Stones for Healing Seeds held)

  // Starling (441) — Moonbeam: Win with doubles+ → +1 Moonstone + 1 Magic Firefly
  if (wF.id === 441 && !wF.ko && ['doubles','triples','quads','penta'].includes(wR.type)) {
    const _starWTeam = winTeam;
    const _starSandOpp = opp(winTeam);
    queueAbility('MOONBEAM!', 'var(--rare)', `${wF.name} — Doubles+ Win! +1 Magic Firefly!`, () => {
      _starWTeam.resources.firefly = (_starWTeam.resources.firefly || 0) + 1;
      log(`<span class="log-ability">${wF.name}</span> — Moonbeam! +1 Magic Firefly!`);
      renderBattle();
    }, winTeamName);
    checkKnightEffects(winTeamName, wF.name);
  }

  // Harvey (448) — Harvest Moon: Win: gain +1 Moonstone for each 5 you rolled
  if (wF.id === 448 && !wF.ko) {
    const fives = winDice.filter(d => d === 5).length;
    if (fives > 0) {
      queueAbility('HARVEST MOON!', 'var(--uncommon)', `${wF.name} — Win! ${fives} five${fives>1?'s':''} rolled = +${fives} Moonstone${fives>1?'s':''}!`, () => {
        winTeam.resources.moonstone += fives;
        renderBattle();
      }, winTeamName);
      log(`<span class="log-ability">${wF.name}</span> — Harvest Moon! ${fives}x 5s → <span class="log-ms">+${fives} Moonstone${fives>1?'s':''}!</span>`);
      checkKnightEffects(winTeamName, wF.name);
      // Sandwiches mirror for Moonstone
      if (sandwichForLose) {
        queueAbility('DEPENDABLE!', 'var(--common)', `Sandwiches — mirrors Harvest Moon! +${fives} Moonstone${fives>1?'s':''}!`, () => { loseTeam.resources.moonstone += fives; renderBattle(); }, loseTeamName);
      }
    }
  }

  // Gordok (430) — River Terror: callout for steal (logic applied pre-damage) — only for autoPlay (human uses modal)
  if (gordokStole && !B.gordokPending) {
    queueAbility('RIVER TERROR!', 'var(--rare)', `${wF.name} — stole resources instead of dealing damage! +1 Moonstone!`, null, winTeamName);
  }

  // Pal Al (431) — Squall: callout for ice gain (logic applied pre-damage) — only for autoPlay (human uses modal)
  if (wiseAlSqualled && !B.wiseAlPending) {
    queueAbility('SQUALL!', 'var(--rare)', `${wF.name} — +4 Ice Shards instead of dealing damage!`, null, winTeamName);
  }

  // Garrick (427) — Watchfire: Win + KO → +1 Sacred Fire
  if (wF.id === 427 && !wF.ko && lF.ko) {
    queueAbility('WATCHFIRE!', 'var(--uncommon)', `${wF.name} — KO! +1 Sacred Fire!`, () => { winTeam.resources.fire++; renderBattle(); }, winTeamName);
    log(`<span class="log-ability">${wF.name}</span> — Watchfire! KO → <span class="log-ms">+1 Sacred Fire!</span>`);
    checkKnightEffects(winTeamName, wF.name);
  }

  // Nyx & Bessie (415) — Moo! Caw!: sideline KO → 3 Healing Seeds
  if (hasSideline(winTeam, 415) && !wF.ko && lF.ko) {
    const nyxG = getSidelineGhost(winTeam, 415);
    const nyxName = nyxG ? nyxG.name : 'Nyx & Bessie';
    queueAbility('MOO! CAW!', 'var(--uncommon)', `${nyxName} (sideline) — KO! +4 Healing Seeds!`, () => { winTeam.resources.healingSeed += 4; renderBattle(); }, winTeamName);
    log(`<span class="log-ability">${nyxName}</span> — Moo! Caw! KO → <span class="log-heal">+4 Healing Seeds!</span>`);
    checkKnightEffects(winTeamName, wF.name);
  }

  // Valkin the Grand (432) — Grand Spoils: active Valkin KO → full resource suite
  if (wF.id === 432 && !wF.ko && lF.ko) {
    queueAbility('GRAND SPOILS!', 'var(--legendary)', `${wF.name} — KO! Grand Spoils: +1 Fire, +2 Ice, +1 Lucky, +1 Moon, +2 Seed!`, () => {
      winTeam.resources.fire += 1;
      winTeam.resources.ice += 2;
      winTeam.resources.luckyStone += 1;
      winTeam.resources.moonstone += 1;
      winTeam.resources.healingSeed += 2;
      renderBattle();
    }, winTeamName);
    log(`<span class="log-ability">${wF.name}</span> — Grand Spoils! KO → <span class="log-ms">+1🔥 +2❄️ +1🍀 +1🌙 +2🌱!</span>`);
    checkKnightEffects(winTeamName, wF.name);
  }

  // Bo (109) — Miracle callout: fires after enemy KO effects; onShow applies the revive so the
  // resurrection is visually synchronized with the legendary splash rather than jumping the HP bar.
  // Vigil (433) sideline — Kindling: +6 Sacred Fires on any resurrection.
  // Both triggers also fire for any future resurrection sources (e.g. Shepherd's Flock 360 when implemented).
  if (boMiracleTarget) {
    const bt = boMiracleTarget; // capture for closure
    // If resurrecting a transformed ghost (Bigsby→Doom), restore original identity
    if (bt.originalId) {
      bt.id = bt.originalId; bt.name = bt.originalName; bt.art = bt.originalArt;
      bt.maxHp = bt.originalMaxHp; bt.ability = bt.originalAbility;
      bt.abilityDesc = bt.originalAbilityDesc; bt.rarity = bt.originalRarity;
      delete bt.originalId; delete bt.originalName; delete bt.originalArt;
      delete bt.originalMaxHp; delete bt.originalAbility; delete bt.originalAbilityDesc; delete bt.originalRarity;
    }
    const lucasActive = hasSideline(winTeam, 433);
    const calloutText = `${wF.name} — KO! ${bt.name} resurrected to sideline at 1 HP + 3 Magic Fireflies!`;
    queueAbility('MIRACLE!', 'var(--legendary)', calloutText, () => {
      bt.ko = false;
      bt.hp = 1;
      winTeam.resources.firefly = (winTeam.resources.firefly || 0) + 3;
      log(`<span class="log-ability">Bo</span> — Miracle! <span class="log-heal">${bt.name} revived at 1 HP!</span> <span class="log-ms">+3 Magic Fireflies!</span>`);
      if (lucasActive) {
        // Lucas (433) — Kindling: revived ghost enters play at 4 HP, Bo to sideline, +1 die next roll
        bt.hp += 3; // 1 + 3 = 4 HP total
        const revivedIdx = winTeam.ghosts.indexOf(bt);
        if (revivedIdx !== -1) winTeam.activeIdx = revivedIdx; // swap revived ghost to active
        if (!B.lucasKindlingBonus) B.lucasKindlingBonus = { red: 0, blue: 0 };
        B.lucasKindlingBonus[winTeamName] = 1; // +1 die next roll
        log(`<span class="log-ability">Lucas</span> — Kindling! <span class="log-heal">${bt.name} charges into play at ${bt.hp} HP! +1 die next roll!</span>`);
        queueAbility('KINDLING!', 'var(--rare)', `Lucas — ${bt.name} charges into play at ${bt.hp} HP! +3 HP, +1 die next roll!`, null, winTeamName);
      }
      renderBattle();
    }, winTeamName);
  }

  // Kairan (68) — Let's Dance: rolling doubles (win or lose) → +1 die next roll
  [B.red, B.blue].forEach(team => {
    const f = active(team);
    const tNameKai = team === B.red ? 'red' : 'blue';
    const kaiRoll = team === B.red ? rR : bR;
    if (f.id === 68 && !f.ko && kaiRoll.type === 'doubles') {
      B.letsDanceBonus[tNameKai] = (B.letsDanceBonus[tNameKai] || 0) + 1;
      const ctx = f === wF ? 'Winner doubles' : 'Loser doubles still counts';
      queueAbility("LET'S DANCE!", 'var(--rare)', `${f.name} — ${ctx}! +1 die next roll!`, null, tNameKai);
      checkKnightEffects(tNameKai, f.name); // Knight Terror / Knight Light react to LET'S DANCE!
      log(`<span class="log-ability">${f.name}</span> — Let's Dance! Doubles → +1 die next round.`);
    }
  });

  // Outlaw (43) — Thief: doubles → remove 1 enemy die next roll.
  // Farewell pattern (Wyatt 2026-04-11): a dying Outlaw still plants the die
  // penalty on the enemy for next round. Uses wF/lF so a KO'd Outlaw still fires.
  // Indexing note: B.outlawStolenDie[myTName] keys by Outlaw's OWN team — the
  // consumption block at line ~7199 reads it that way and subtracts from the enemy.
  [[wF, wR, winTeamName], [lF, lR, loseTeamName]].forEach(([f, roll, myTName]) => {
    if (f.id !== 43) return;
    if (roll.type !== 'doubles') return;
    B.outlawStolenDie[myTName] = (B.outlawStolenDie[myTName] || 0) + 1;
    const ctx = f === wF ? 'Winner doubles' : (f.ko ? 'Final doubles' : 'Loser doubles');
    queueAbility('THIEF!', 'var(--uncommon)', `${f.name} — ${ctx}! Stealing 1 die from enemy next round!`, null, myTName);
    checkKnightEffects(myTName, f.name);
    log(`<span class="log-ability">${f.name}</span> — Thief! ${ctx} → steal 1 enemy die next round.`);
  });

  // Suspicious Jeff (61) — Snicker: sideline passive — when your ghost DEFEATS an enemy ghost (lF.ko), steal 1 enemy die next roll.
  // "Wins a battle" = KO the enemy, NOT merely winning a roll. Same family correction as Jeffery Chuckle.
  if (hasSideline(winTeam, 61) && !wF.ko && lF.ko) {
    const jeffSideF = getSidelineGhost(winTeam, 61);
    const jeffName = jeffSideF ? jeffSideF.name : 'Suspicious Jeff';
    B.jeffSnicker[winTeamName] = (B.jeffSnicker[winTeamName] || 0) + 1;
    queueAbility('SNICKER!', 'var(--uncommon)', `${jeffName} (sideline) — Your ghost won! Stealing 1 die from ${lF.name} next round!`, null, winTeamName);
    log(`<span class="log-ability">${jeffName}</span> — Snicker! Win → steal 1 enemy die next round.`);
  }

  // Haywire (78) — Wild Chords: rolling triples or better grants +1 permanent die AND Haywire +2 damage for the rest of the game (once per game, win or lose)
  [B.red, B.blue].forEach(team => {
    const f = active(team);
    const tNameHW = team === B.red ? 'red' : 'blue';
    const hwRoll = team === B.red ? rR : bR;
    if (f.id === 78 && !f.ko && isTripleOrBetter(hwRoll.type) && B.haywireUsed && !B.haywireUsed[tNameHW]) {
      B.haywireBonus[tNameHW] = (B.haywireBonus[tNameHW] || 0) + 1;
      B.haywireDamageBonus[tNameHW] = 2;
      B.haywireUsed[tNameHW] = true;
      queueAbility('WILD CHORDS!', 'var(--rare)', `${f.name} — Triples or better! +1 permanent die AND Haywire gains +2 damage for the rest of the game! (Once per game)`, null, tNameHW);
      log(`<span class="log-ability">${f.name}</span> — Wild Chords! Triples or better → +1 permanent die + Haywire +2 damage for the rest of the game!`);
      checkKnightEffects(tNameHW, f.name);
    }
  });

  // Sable (413) — Smoldering Soul: all odd dice → +1 Sacred Fire (active or sideline, win/loss path)
  [B.red, B.blue].forEach(team => {
    const f = active(team);
    const tNameSable = team === B.red ? 'red' : 'blue';
    const sableDice = team === B.red ? redDice : blueDice;
    const hasSableActive = f.id === 413 && !f.ko;
    const hasSableSideline = hasSideline(team, 413);
    if ((hasSableActive || hasSableSideline) && sableDice && sableDice.length > 0 && sableDice.every(d => d % 2 === 1)) {
      team.resources.fire++;
      const sableName = hasSableActive ? f.name : (getSidelineGhost(team, 413) || { name: 'Sable' }).name;
      const sableLoc = hasSableActive ? '' : ' (sideline)';
      queueAbility('SMOLDERING SOUL!', 'var(--uncommon)', `${sableName}${sableLoc} — All dice odd! +1 Sacred Fire!`, null, tNameSable);
      log(`<span class="log-ability">${sableName}</span> — Smoldering Soul! All dice odd → <span class="log-ms">+1 Sacred Fire!</span>`);
      checkKnightEffects(tNameSable, sableName);
    }
  });

  // Pip (418) — Toasted: triples+ → remove 1 enemy die permanently + 2 Sacred Fires (once per game, win/loss path)
  [B.red, B.blue].forEach(team => {
    const f = active(team);
    const tNamePip = team === B.red ? 'red' : 'blue';
    const pipRoll = team === B.red ? rR : bR;
    if (f.id === 418 && !f.ko && isTripleOrBetter(pipRoll.type) && B.pipToastedUsed && !B.pipToastedUsed[tNamePip]) {
      B.pipToastedUsed[tNamePip] = true;
      const oppName = tNamePip === 'red' ? 'blue' : 'red';
      B.pipDieRemoval[oppName] = (B.pipDieRemoval[oppName] || 0) + 1;
      team.resources.fire += 2;
      queueAbility('TOASTED!', 'var(--rare)', `${f.name} — ${pipRoll.type}! Enemy permanently loses 1 die + 2 Sacred Fires! (Once per game)`, null, tNamePip);
      log(`<span class="log-ability">${f.name}</span> — Toasted! ${pipRoll.type} → enemy -1 die permanently + <span class="log-ms">+2 Sacred Fires!</span>`);
      checkKnightEffects(tNamePip, f.name);
    }
  });

  // Dream Cat (28) — Jinx: if BOTH teams rolled doubles, Dream Cat gains +1 die next round
  [B.red, B.blue].forEach(team => {
    const f = active(team);
    if (f.id === 28 && !f.ko) {
      const tNameDC = team === B.red ? 'red' : 'blue';
      const ownRoll = team === B.red ? rR : bR;
      const foeRoll = team === B.red ? bR : rR;
      if (ownRoll.type === 'doubles' && foeRoll.type === 'doubles') {
        B.dreamCatBonus[tNameDC] = (B.dreamCatBonus[tNameDC] || 0) + 1;
        queueAbility('JINX!', 'var(--common)', `${f.name} — Both teams rolled doubles! +1 die next round!`, null, tNameDC);
        log(`<span class="log-ability">${f.name}</span> — Jinx! Both rolled doubles → +1 die next round.`);
        checkKnightEffects(tNameDC, f.name);
      }
    }
  });

  // Scallywags (19) — Frenzy: if Scallywags' own dice are all under 4, gain +1 die next round.
  // Farewell pattern (Wyatt 2026-04-11): fires even if Scallywags is KO'd by this roll
  // — the +1 die is granted to the team (his replacement) as his parting gift.
  // Uses wF/lF (captured pre-damage) and winDice/loseDice so Scallywags's death
  // mid-round does not drop the ability.
  [[wF, winDice, winTeamName], [lF, loseDice, loseTeamName]].forEach(([f, dice, myTName]) => {
    if (f.id !== 19) return;
    if (!dice || dice.length === 0 || !dice.every(d => d < 4)) return;
    B.scallywagsFrenzyBonus[myTName] = (B.scallywagsFrenzyBonus[myTName] || 0) + 1;
    const ctx = f === wF ? 'Win' : (f.ko ? 'Down' : 'Loss');
    queueAbility('FRENZY!', 'var(--common)', `${f.name} — ${ctx}! All dice under 4! +1 die next roll!`, null, myTName);
    log(`<span class="log-ability">${f.name}</span> — Frenzy! ${ctx}: all dice under 4 → +1 die next round.`);
    checkKnightEffects(myTName, f.name);
  });

  // Floop (20) — Muck: if opponent rolled doubles, they lose 1 die next round.
  // Fires whenever Floop was the ACTIVE fighter at roll time — win, lose, OR killed.
  // Uses wF/lF (captured pre-damage at line ~9025) instead of active(team) so a
  // dying Floop still triggers Muck, and skips the !f.ko gate entirely.
  // Wyatt spec 2026-04-11: "No ifs, ands, or buts."
  [[wF, winTeamName, lR, loseTeamName], [lF, loseTeamName, wR, winTeamName]].forEach(([f, myTName, enemyRoll, enemyTName]) => {
    if (f.id !== 20) return;
    if (enemyRoll.type !== 'doubles') return;
    B.floopMuck[enemyTName] = (B.floopMuck[enemyTName] || 0) + 1;
    const ctx = f === wF ? 'Win' : (f.ko ? 'Down' : 'Loss');
    const enemyName = f === wF ? lF.name : wF.name;
    queueAbility('MUCK!', 'var(--common)', `${f.name} — ${ctx}! ${enemyName} rolled doubles → they lose 1 die next round!`, null, myTName);
    log(`<span class="log-ability">${f.name}</span> — Muck! ${enemyName} rolled doubles → -1 die next round.`);
    checkKnightEffects(myTName, f.name);
  });

  // Logey (26) — Heinous: win/lose — count opponent's 5+ dice, lock them out next roll
  // Farewell pattern (Wyatt 2026-04-11): dying Logey still locks out enemy 5+ dice.
  if (wF.id === 26) {
    const locked = (loseDice || []).filter(d => d >= 5).length;
    if (locked > 0) {
      B.logeyLockout[loseTeamName] = (B.logeyLockout[loseTeamName] || 0) + locked;
      const wCtx = wF.ko ? 'Down' : 'Win';
      queueAbility('HEINOUS!', 'var(--common)', `${wF.name} — ${wCtx}! ${locked} of ${lF.name}'s 5+ dice locked out next roll!`, null, winTeamName);
      log(`<span class="log-ability">${wF.name}</span> — Heinous! ${wCtx}: locked ${locked} of ${lF.name}'s 5+ dice.`);
    }
  }
  if (lF.id === 26) {
    const locked = (winDice || []).filter(d => d >= 5).length;
    if (locked > 0) {
      B.logeyLockout[winTeamName] = (B.logeyLockout[winTeamName] || 0) + locked;
      const lCtx = lF.ko ? 'Down' : 'Loss';
      queueAbility('HEINOUS!', 'var(--common)', `${lF.name} — ${lCtx}! ${locked} of ${wF.name}'s 5+ dice locked out next roll!`, null, loseTeamName);
      log(`<span class="log-ability">${lF.name}</span> — Heinous! ${lCtx}: locked ${locked} of ${wF.name}'s 5+ dice.`);
    }
  }

  // End-of-round callouts — Maximo seed granted with NAP! splash via onShow
  // Sandwiches (33) — Dependable: if opponent gains a seed, you mirror it.
  [B.red, B.blue].forEach(team => {
    const f = active(team);
    if (f.id === 302 && !f.ko) {
      const isWinSide = team === winTeam;
      const sandwichMirrors = isWinSide ? sandwichForLose : sandwichForWin;
      const oppTeam         = isWinSide ? loseTeam : winTeam;
      queueAbility('NAP!', 'var(--common)', `${f.name} — round ends, +1 Healing Seed and +1 Lucky Stone!`, () => { team.resources.healingSeed++; team.resources.luckyStone++; renderBattle(); }, team === B.red ? 'red' : 'blue');
      // Maximo knight reactions already collected via collectKC at game-state section (line ~10155) — do NOT double-fire here
      if (sandwichMirrors) queueAbility('DEPENDABLE!', 'var(--common)', `Sandwiches — mirrors Nap! +1 Healing Seed + 1 Lucky Stone!`, () => { oppTeam.resources.healingSeed++; oppTeam.resources.luckyStone++; renderBattle(); }, isWinSide ? loseTeamName : winTeamName);
    }
  });

  // Knight reactions (HEAVY AIR!/RETRIBUTION!) collected from all pre-cinematic ability triggers.
  // These play last in the queue — after all ability callouts — so each Knight reaction follows
  // the full round's events rather than firing synchronously and being stomped.
  resolveKnightCallouts.forEach(kc => queueAbility(kc.name, kc.color, kc.desc, kc.onShow, kc.team));

  abilityQueueMode = false;

  // ========================================
  // CINEMATIC PLAYBACK — damage hits first, then abilities sequence
  // ========================================
  // ========================================
  // CINEMATIC BEATS — pauses let each moment land
  // ========================================
  // Beat 1: Announce the winner (pause to let dice highlight register)
  let beatTimer = 0;
  const BEAT_ANNOUNCE = 600;  // pause after dice highlight, before narration
  const BEAT_DAMAGE  = 800;   // pause after narration, before damage hit
  const BEAT_HP      = 500;   // pause after hit animation, before HP bar drops
  const BEAT_POST    = 800;   // pause after HP update, before ability queue

  setTimeout(() => {
    // Beat 2: Narration
    if (dmg > 0) {
      let dmgNarr = '';
      if (wR.type === 'penta') {
        dmgNarr = `IMPOSSIBLE! FIVE ${wR.value}'s! <b class="${winColor}">${wF.name}</b> unleashes <b class="gold">${dmg} damage</b>!`;
      } else if (wR.type === 'quads') {
        dmgNarr = `DEVASTATING! <b class="${winColor}">${wF.name}</b> slams FOUR ${wR.value}'s! <b class="gold">${dmg} damage</b>!`;
      } else if (wR.type === 'triples') {
        dmgNarr = `<b class="${winColor}">${wF.name}</b> CRUSHES with triple ${wR.value}'s! <b class="gold">${dmg} damage</b> rocks <b class="${loseColor}">${lF.name}</b>!`;
      } else if (wR.type === 'doubles') {
        dmgNarr = `<b class="${winColor}">${wF.name}</b> lands a solid hit with double ${wR.value}'s — <b class="gold">${dmg} damage</b> to <b class="${loseColor}">${lF.name}</b>!`;
      } else {
        dmgNarr = `<b class="${winColor}">${wF.name}</b> edges out <b class="${loseColor}">${lF.name}</b> — <b class="gold">${dmg} damage</b>!`;
      }
      narrate(dmgNarr);

      // Beat 3: Damage hit (after narration sinks in)
      setTimeout(() => {
        playDamageSfx(dmg);
        const hitEl = document.getElementById(loseTeamName + '-fighter');
        hitEl.classList.add('hit');
        setTimeout(() => hitEl.classList.remove('hit'), 500);

        // Beat 4: HP bar drops (after hit animation)
        setTimeout(() => {
          updateHpBar(loseTeamName, lF.hp, lF.maxHp);
          if (lF.ko) {
            playSfx('sfxShatter', 0.7);
            narrate(`<b class="ko-text">${lF.name} goes down!</b>&nbsp;<b class="${winColor}">${wF.name}</b> stands victorious!`);
          } else {
            narrate(`<b class="${loseColor}">${lF.name}</b> holds on — <b class="gold">${lF.hp} HP</b> remaining.`);
          }
          renderBattle();
        }, BEAT_HP);
      }, BEAT_DAMAGE);
    } else {
      if (galeForceSwap) {
        narrate(`<b class="${winColor}">${wF.name}</b> wins! <b class="gold">GALE FORCE!</b> — forcing a swap instead of damage!`);
      } else {
        narrate(`<b class="${winColor}">${wF.name}</b> wins the roll but deals 0 damage!`);
      }
    }
  }, BEAT_ANNOUNCE);

  // Pudge self-damage visual (after all damage beats)
  const pudgeDelay = BEAT_ANNOUNCE + BEAT_DAMAGE + BEAT_HP + 400;
  if (pudgeSelfDmgApplied) {
    setTimeout(() => {
      playDamageSfx(1);
      hitDamage(winTeamName);
    }, pudgeDelay);
  }

  // Ability queue drains after all damage beats finish.
  // dmg=0 path: the "deals 0 damage" narration fires at BEAT_ANNOUNCE (600ms) and holds
  // its drainNarrate lock for 1800ms (until t=2400ms).  With the old value of
  // BEAT_ANNOUNCE+200=800ms the drain callback fired at t=800ms — well inside the
  // narration window.  The no-KO path then called narrate("Round N") at t=1550ms, but
  // that message queued behind the still-active 0-damage lock and didn't display until
  // t=2400ms, while roll buttons went live at t=1900ms — a 500ms window where buttons
  // were clickable but zero round-context was visible.
  // Fix: wait BEAT_ANNOUNCE + 1800 + 200 = 2600ms so the callback fires 200ms after the
  // 0-damage narration releases, giving "Round N — X vs Y" a clear slot to display
  // immediately before roll buttons activate.  For non-empty queues the ability callouts
  // also now fire after the 0-damage line clears (more cinematically correct).
  const totalDmgBeats = dmg > 0 ? (BEAT_ANNOUNCE + BEAT_DAMAGE + BEAT_HP + BEAT_POST) : (BEAT_ANNOUNCE + 1800 + 200);
  const dmgDelay = totalDmgBeats;
  setTimeout(() => {
    drainAbilityQueue(() => {
      // Prince Balatron (113) — Party Time: if the loser is Balatron, fire the
      // interactive counter-die modal FIRST (before any round state is reset)
      // so the reveal lands on top of the current scene. Once the player clicks
      // and the shuffle finishes, finishBalatronRoll() calls runPostDrain() to
      // continue with the normal reset + modal chain.
      const runPostDrain = () => {
      // Reset committed resources + per-round ability flags
      B.committed.red = { ice:0, fire:0, surge:0, auntSusan:0, auntSusanHeal:0, harrison:0, zainBlade:0 };
      B.committed.blue = { ice:0, fire:0, surge:0, auntSusan:0, auntSusanHeal:0, harrison:0, zainBlade:0 };
      B.pressureUsed = { red: false, blue: false };
      if (B.romyPrediction) { B.romyPrediction.red = null; B.romyPrediction.blue = null; }
      if (B.guardianFairyStandby) { B.guardianFairyStandby.red = false; B.guardianFairyStandby.blue = false; }
      if (B.eloiseUsedThisRound) { B.eloiseUsedThisRound.red = false; B.eloiseUsedThisRound.blue = false; }
      // bogeyArmed removed v430 — Bogey reflect is now reactive (no pre-arm state)
      if (B.galeForceDecided) { B.galeForceDecided.red = false; B.galeForceDecided.blue = false; }
      if (B.jacksonUsedThisRound) { B.jacksonUsedThisRound.red = false; B.jacksonUsedThisRound.blue = false; }
      if (B.sonyaUsedThisRound) { B.sonyaUsedThisRound.red = false; B.sonyaUsedThisRound.blue = false; }
      // Dark Wing (76) Precision: NO per-round reset — once-per-GAME flag persists across rounds (v595)
      if (B.mallowDecided) { B.mallowDecided.red = false; B.mallowDecided.blue = false; }
      // fangUndercoverSwapPending already consumed above; clear arm flag for safety
      if (B.fangUndercoverArmed) { B.fangUndercoverArmed.red = false; B.fangUndercoverArmed.blue = false; }
      if (B.tylerDecidedThisRound) { B.tylerDecidedThisRound.red = false; B.tylerDecidedThisRound.blue = false; }
      if (B.booTeamworkDecidedThisRound) { B.booTeamworkDecidedThisRound.red = false; B.booTeamworkDecidedThisRound.blue = false; }
      if (B.luckyStoneSpentThisTurn) { B.luckyStoneSpentThisTurn.red = 0; B.luckyStoneSpentThisTurn.blue = 0; }
    if (B.preRollAbilitiesFiredThisTurn) { B.preRollAbilitiesFiredThisTurn.red = false; B.preRollAbilitiesFiredThisTurn.blue = false; }
      // Willow (435) — Joy of Painting: winner didn't lose, loser did
      if (B.willowLostLast) { B.willowLostLast[winTeamName] = false; B.willowLostLast[loseTeamName] = true; }
      // Reset item swing toggles each round (player must actively choose to swing)
      if (B.flameBladeSwing) { B.flameBladeSwing.red = false; B.flameBladeSwing.blue = false; }
      if (B.iceBladeSwing) { B.iceBladeSwing.red = false; B.iceBladeSwing.blue = false; }
      // Toby — Pure Heart: carry forward the scheduled KO flag, then clear declaration
      if (B.pureHeartDeclared) {
        if (B.pureHeartDeclared.red === true && B.pureHeartScheduledKO) B.pureHeartScheduledKO.red = true;
        if (B.pureHeartDeclared.blue === true && B.pureHeartScheduledKO) B.pureHeartScheduledKO.blue = true;
        B.pureHeartDeclared.red = null;
        B.pureHeartDeclared.blue = null;
      }

      // MVP round credit: diff team resources + ghost HPs against the pre-roll snapshot
      try { creditRoundDelta(winTeamName); } catch (e) { console.warn('[MVP] credit failed:', e); }

      // Duel Phase: record this round's loser so they get first move next round
      B.duelLastLoser = loseTeamName;

      B.round++;
      B.preRoll = null;
      // Re-render dice then re-apply highlights SYNCHRONOUSLY in the same tick.
      // The previous code used setTimeout(10) which allowed the browser to paint
      // one neutral frame between innerHTML wipe and highlight re-apply — visible
      // as a ~6-frame flash where winners shrank to scale(1.0) and losers grew
      // from scale(0.94) to scale(1.0), making it look like the losing dice briefly
      // became the winners. Calling highlight synchronously coalesces both DOM
      // changes into one paint.
      renderDice(redDice, blueDice);
      highlightWinnerDice(winTeamName, wR, loseTeamName, tiebreaker);

      // Calvin & Anna (91) — Toboggan: when C&A scores a KO, offer to swap with sideline ghost
      const tobogganAlive = (wF.id === 91 && !wF.ko && lF.ko)
        ? winTeam.ghosts.filter((g, i) => i !== winTeam.activeIdx && !g.ko)
        : [];

      // Fang Outside (6) — Skillful Coward: after any win, offer to swap Fang to sideline
      const fangOutsideAlive = (wF.id === 6 && !wF.ko)
        ? winTeam.ghosts.filter((g, i) => i !== winTeam.activeIdx && !g.ko)
        : [];

      // Winston (15) — Scheme: doubles win → offer to force-swap opponent's active ghost
      const winstonSchemeSideline = (wF.id === 15 && !wF.ko && wR.type === 'doubles')
        ? loseTeam.ghosts.filter((g, i) => i !== loseTeam.activeIdx && !g.ko)
        : [];

      const proceedToKoHandling = () => {
        if (lF.ko) {
          B.phase = 'ko-pause';
          renderBattle();
          setTimeout(() => {
            if (!handleKOs()) {
              // Narrate the new matchup first, then enable roll buttons 350ms later —
              // same breathing-room pattern as the no-KO path (v110/v114 fix).
              narrate(`<b class="gold">Round ${B.round}</b> — <b class="red-text">${active(B.red).name}</b>&nbsp;vs&nbsp;<b class="blue-text">${active(B.blue).name}</b>`);
              renderBattle();
              setTimeout(() => { startNextRound(); }, 350);
            }
          }, 1800);
        } else {
          B.phase = 'ko-pause';
          renderBattle();
          setTimeout(() => {
            if (!handleKOs()) {
              // Narrate the new matchup first, then enable roll buttons 350ms later —
              // gives the player a beat to read "Round N — X vs Y" before the game unblocks.
              narrate(`<b class="gold">Round ${B.round}</b> — <b class="red-text">${active(B.red).name}</b>&nbsp;vs&nbsp;<b class="blue-text">${active(B.blue).name}</b>`);
              renderBattle();
              setTimeout(() => { startNextRound(); }, 350);
            }
          }, 750);
        }
      };

      // Fang Undercover (7) — Skilled Coward: if dodge was activated this round, show ghost-picker for lose team
      const fuSwapTeam = B.fangUndercoverSwapPending;
      B.fangUndercoverSwapPending = null;

      // Winston (15) — Scheme: fires after Toboggan/FangOutside, before KO handling
      const checkWinstonScheme = () => {
        if (winstonSchemeSideline.length > 0) {
          showWinstonSchemeModal(winTeamName, loseTeamName, winstonSchemeSideline, proceedToKoHandling);
        } else {
          proceedToKoHandling();
        }
      };

      const afterFangUndercover = () => {
        if (tobogganAlive.length > 0) {
          showTobogganModal(winTeamName, tobogganAlive, checkWinstonScheme);
        } else if (fangOutsideAlive.length > 0) {
          showFangOutsideModal(winTeamName, fangOutsideAlive, checkWinstonScheme);
        } else {
          checkWinstonScheme();
        }
      };

      // Gus (31) — Gale Force: if triggered, offer the LOSING player a ghost picker before other post-drain logic.
      // Spec: "force your opponent to CHOOSE a different ghost" — the opponent decides which sideline ghost enters.
      // If only 1 sideline option, auto-swap (no real choice). If multiple, show picker modal (same as Winston pattern).
      const checkGaleForcePicker = () => {
        if (galeForceSwap && !wF.ko) {
          const gfAlive = loseTeam.ghosts.filter((g, i) => i !== loseTeam.activeIdx && !g.ko);
          if (gfAlive.length > 1) {
            showGaleForcePickerModal(winTeamName, loseTeamName, gfAlive, afterFangUndercover);
            return;
          } else if (gfAlive.length === 1) {
            // Only 1 option — auto-swap, fire entry effects, then continue
            loseTeam.activeIdx = loseTeam.ghosts.indexOf(gfAlive[0]);
            renderBattle();
            log(`<span class="log-ability">Gus</span> — Gale Force! ${gfAlive[0].name} was the only option — enters automatically!`);
            const entryCount = triggerEntry(loseTeam, false);
            const delay = entryCount > 0 ? entryCount * 1500 + 300 : 300;
            setTimeout(afterFangUndercover, delay);
            return;
          }
        }
        afterFangUndercover();
      };

      if (fuSwapTeam) {
        const fuTeam = B[fuSwapTeam];
        const fuSidelineGhosts = fuTeam.ghosts.filter((g, i) => i !== fuTeam.activeIdx && !g.ko);
        if (fuSidelineGhosts.length > 0) {
          showFangUndercoverSwapModal(fuSwapTeam, fuSidelineGhosts, checkGaleForcePicker);
        } else {
          // No sideline ghosts (all KO'd since the arm was set) — just proceed
          checkGaleForcePicker();
        }
      } else {
        checkGaleForcePicker();
      }
      }; // end runPostDrain

      // Jasper Flame Dive modal: show after Balatron if pending
      const afterJasper = () => {
        runPostDrain();
      };
      const afterBalatron = () => {
        if (B.jasperPending) {
          showJasperModal(afterJasper);
        } else {
          afterJasper();
        }
      };

      // Guardian Fairy reactive modal: show before Balatron/postDrain if GF pending
      const afterGfReactive = () => {
        // Balatron modal injection: if the pending flag is set, play the interactive
        // counter-die reveal first, then runPostDrain() continues the normal flow.
        if (B.balatronPending) {
          showBalatronModal(afterBalatron);
        } else {
          afterBalatron();
        }
      };

      // Pal Al / Gordok choice modals: fire before Guardian Fairy (winner decides first)
      const afterWiseAlGordok = () => {
        if (B.guardianFairyReactivePending) {
          const gfp = B.guardianFairyReactivePending;
          gfp.resume = afterGfReactive;
          const gfG = gfp.gfGhost;
          const gfName = gfG.name || 'Guardian Fairy';
          document.getElementById('guardianFairySub').innerHTML =
            `<b>${gfName}</b> (${gfG.hp} HP) can take this ${gfp.dmg} damage hit for <b>${gfp.lF.name}</b>!<br>` +
            `<i>Guardian Fairy swaps in and absorbs the damage. ${gfp.lF.name} goes to sideline at current HP.</i>`;
          document.getElementById('guardianFairyOverlay').classList.add('active');
        } else {
          afterGfReactive();
        }
      };

      const afterGordokChoice = () => {
        if (B.wiseAlPending) {
          showWiseAlModal(afterWiseAlGordok);
        } else {
          afterWiseAlGordok();
        }
      };

      if (B.gordokPending) {
        showGordokModal(afterGordokChoice);
      } else {
        afterGordokChoice();
      }
    });
  }, dmgDelay);
}

function handleKOs() {
  // Check for game-over first
  const redAllDown = B.red.ghosts.every(g => g.ko);
  const blueAllDown = B.blue.ghosts.every(g => g.ko);
  if (redAllDown && blueAllDown) { showGameOver('draw'); renderBattle(); return true; }
  if (redAllDown) { showGameOver('blue'); renderBattle(); return true; }
  if (blueAllDown) { showGameOver('red'); renderBattle(); return true; }

  // Check if any active ghost is KO'd and needs a replacement pick
  const teamsNeedingSwap = [];
  ['red','blue'].forEach(team => {
    const t = B[team];
    const f = active(t);
    if (f.ko) {
      const alive = t.ghosts.filter((g,i) => i !== t.activeIdx && !g.ko);
      if (alive.length > 0) teamsNeedingSwap.push(team);
    }
  });

  if (teamsNeedingSwap.length > 0) {
    // Queue the KO swap picks — caller must NOT resume to 'ready'
    B.koSwapQueue = teamsNeedingSwap.slice();
    B.phase = 'ko-swap';
    renderBattle();
    openKoSwap();
    return true; // signal: don't resume, swap in progress
  }

  renderBattle();
  return false;
}

function openKoSwap() {
  if (!B.koSwapQueue || B.koSwapQueue.length === 0) {
    // All swaps done — announce the new matchup first, then enable roll buttons
    // 350ms later. Same breathing-room pattern as the v110 no-KO path: narrate()
    // fires before B.phase='ready' so roll buttons don't become live while the
    // entry narration (still draining in drainNarrate) or round announcement is
    // still on screen. Previously B.phase='ready' + resetRollButtons() fired
    // BEFORE narrate(), making buttons clickable before the round line appeared.
    B.koSwapQueue = null;
    renderBattle();
    narrate(`<b class="gold">Round ${B.round}</b> — <b class="red-text">${active(B.red).name}</b>&nbsp;vs&nbsp;<b class="blue-text">${active(B.blue).name}</b>`);
    setTimeout(() => { startNextRound(); }, 350);
    return;
  }
  const team = B.koSwapQueue[0];
  const t = B[team];
  const fallen = active(t);
  const alive = t.ghosts.filter((g,i) => i !== t.activeIdx && !g.ko);

  // If only one option, auto-pick (no real choice)
  if (alive.length === 1) {
    const teamLabel = team.charAt(0).toUpperCase() + team.slice(1);
    narrate(`<b class="ko-text">${fallen.name} is down!</b>&nbsp;<b class="${team}-text">${teamLabel}:</b>&nbsp;<b>${alive[0].name}</b> steps up!`);
    setTimeout(() => doKoSwap(team, t.ghosts.indexOf(alive[0])), 800);
    return;
  }

  const teamLabel = team.charAt(0).toUpperCase() + team.slice(1);
  narrate(`<b class="ko-text">${fallen.name} is down!</b>&nbsp;<b class="${team}-text">${teamLabel}</b> — who answers the call?`);
  // Delay renderBattle() so the narrator text appears (drainNarrate fires at t+150ms)
  // and is readable before the gold-pulsing picker cards become interactive.
  // Without this delay, sideline cards go clickable at t=0 — before the player
  // even sees the "who answers the call?" prompt. 300ms gives the text time to
  // fade in and register before the picker lights up.
  setTimeout(() => renderBattle(), 300); // sideline cards with ko-swap-pick class become clickable
}

function doKoSwap(team, idx) {
  const t = B[team];
  const fallen = active(t);
  // doKoSwap fires only when a ghost is KO'd by damage — entry effects always fire.
  // Tyson's Hop (skipEntry=true) is handled exclusively via useTysonHop → doSwap.
  const skipEntry = false;
  t.activeIdx = idx;
  const f = active(t);
  // Returning from sideline = full HP
  f.hp = f.maxHp;

  log(`<span class="log-ko">${fallen.name} is down!</span> <span class="log-ability">${f.name} enters at full HP!</span>`);
  const entryCalloutCount = triggerEntry(t, skipEntry);

  renderBattle();

  // Remove this team from the queue
  B.koSwapQueue.shift();

  // Check if entry effects caused new KOs (e.g. Nerina's Leviathan)
  const redAllDown = B.red.ghosts.every(g => g.ko);
  const blueAllDown = B.blue.ghosts.every(g => g.ko);
  if (redAllDown && blueAllDown) { showGameOver('draw'); return; }
  if (redAllDown) { showGameOver('blue'); return; }
  if (blueAllDown) { showGameOver('red'); return; }

  // Check if entry damage KO'd someone new — add to queue
  ['red','blue'].forEach(tm => {
    const tt = B[tm];
    if (active(tt).ko && !B.koSwapQueue.includes(tm)) {
      const alive = tt.ghosts.filter((g,i) => i !== tt.activeIdx && !g.ko);
      if (alive.length > 0) B.koSwapQueue.push(tm);
    }
  });

  // Wait for all entry callouts to finish before showing the next KO swap picker.
  // entryCalloutCount accounts for both the entry ability AND any Knight reactions
  // (each 1500ms apart), so 2 callouts = 3000ms.
  // Minimum 800ms even with 0 callouts — gives the player time to read
  // "[Ghost] enters the arena!" before the next KO picker or roll buttons appear.
  // Matches the 800ms auto-pick delay in openKoSwap for symmetric breathing room.
  const splashDelay = entryCalloutCount > 0 ? entryCalloutCount * 1500 : 800;
  setTimeout(openKoSwap, splashDelay);
}

function showGameOver(winner) {
  B.phase = 'over';
  fadeOutMusic();
  // Victory fanfare (delayed to let music fade a bit)
  setTimeout(() => playSfx('sfxVictory', 0.6), 600);
  // Clean up any active overlays/animations
  const splash = document.getElementById('abilitySplash');
  if (splash) splash.classList.remove('active');
  clearLsCountdown();
  disableRollButtons();

  // Record standings
  let matchMvp = null;
  let redMvpId = null;
  let blueMvpId = null;
  if (winner === 'red' || winner === 'blue') {
    const winTeam = B[winner];
    const loseTeamName = winner === 'red' ? 'blue' : 'red';
    const loseTeamObj = B[loseTeamName];
    winTeam.ghosts.forEach(g => recordWin(g.originalId || g.id));
    loseTeamObj.ghosts.forEach(g => recordLoss(g.originalId || g.id));
    // Record KO'D (times defeated) and Kills (KOs scored) from killedBy tags
    const allGhosts = [...winTeam.ghosts, ...loseTeamObj.ghosts];
    allGhosts.forEach(g => {
      if (g.ko) {
        recordKO(g.originalId || g.id); // this ghost was defeated
        if (g.killedBy && g.killedBy > 0) recordKill(g.killedBy); // credit the killer
      }
    });
    // MVP: pick the winning team's top scorer and record in standings
    try {
      matchMvp = pickMatchMvp(winner);
      if (matchMvp) recordMvp(matchMvp.originalId || matchMvp.id);
      // Compute stats-based MVPs for BOTH teams for the end-of-match display.
      // The losing team gets an MVP too — even if every ghost was KO'd — based
      // on who actually contributed most (KOs scored, damage, rolls won,
      // resources generated). This is display-only; standings still only count
      // the winning team's MVP via recordMvp() above.
      const redPick = pickMatchMvp('red');
      const bluePick = pickMatchMvp('blue');
      redMvpId = redPick ? redPick.id : null;
      blueMvpId = bluePick ? bluePick.id : null;
    } catch (e) { console.warn('[MVP] pick failed:', e); }
  }

  const el = document.getElementById('gameOver');
  el.classList.add('active');
  const title = document.getElementById('goTitle');
  const rounds = B.round - 1;
  if (winner === 'draw') { title.textContent = 'DRAW!'; title.className = ''; }
  else { title.textContent = `TEAM ${winner.toUpperCase()} WINS!`; title.className = `${winner}-win`; }

  // Round count
  document.getElementById('goRounds').textContent = `${rounds} round${rounds !== 1 ? 's' : ''} played`;

  // Battle summary with ghost statuses
  function buildTeamCol(teamObj, teamLabel, teamColor, mvpId) {
    const gd = id => ghostData(id);

    const rows = teamObj.ghosts.map((g, i) => {
      const displayId = g.originalId || g.id;
      const displayName = g.originalName || g.name;
      const displayArt = g.originalArt || g.art;
      const data = gd(displayId);
      // MVP badge follows the stats-based pick from pickMatchMvp() — awarded
      // even if the MVP ghost was KO'd (wiped-team case).
      const isMvp = (mvpId != null && (g.id === mvpId || g.originalId === mvpId));
      const artSrc = displayArt || (data && data.art);
      const artHtml = artSrc
        ? `<img class="go-ghost-art" src="${artSrc}" alt="${displayName}" loading="lazy" onerror="this.outerHTML='<div class=\\'go-ghost-art-placeholder\\'>👻</div>'">`
        : `<div class="go-ghost-art-placeholder">&#128123;</div>`;
      const statusText = g.ko
        ? "KO'd"
        : `${g.hp}/${g.maxHp} HP`;
      const statusClass = g.ko ? 'ko' : 'survived';
      const mvpBadge = isMvp ? '<span class="go-mvp-badge">MVP</span>' : '';
      return `<div class="go-ghost-row${isMvp ? ' mvp' : ''}">
        ${artHtml}
        <div class="go-ghost-info">
          <div class="go-ghost-name">${displayName}</div>
          <div class="go-ghost-status ${statusClass}">${statusText}</div>
        </div>
        ${mvpBadge}
      </div>`;
    }).join('');

    return `<div class="go-team-col">
      <h3 class="${teamColor}-label">Team ${teamLabel}</h3>
      ${rows}
    </div>`;
  }

  const summaryHtml = buildTeamCol(B.red, 'Red', 'red', redMvpId) + buildTeamCol(B.blue, 'Blue', 'blue', blueMvpId);
  document.getElementById('goSummary').innerHTML = summaryHtml;

  // Callback for multiplayer to update stats
  if (typeof onGameOver === 'function') {
    onGameOver(winner, { matchMvp, redMvpId, blueMvpId, rounds: B.round - 1 });
  }
}

// ============================================================
// SWAP
// ============================================================
function openSwap(team) {
  if (!B || B.phase!=='ready') return;
  const t = B[team];
  const opts = t.ghosts.filter((g,i) => i!==t.activeIdx);
  document.getElementById('swapTitle').textContent = `Swap ${team.toUpperCase()} Active Ghost`;
  document.getElementById('swapOptions').innerHTML = opts.map(g => {
    const realIdx = t.ghosts.indexOf(g);
    const gd = ghostData(g.id);
    const hpRatio = g.hp / g.maxHp;
    const hpColor = hpRatio > 0.6 ? 'var(--hp-green)' : hpRatio > 0.3 ? 'var(--hp-yellow)' : 'var(--hp-red)';
    return `<div class="swap-option ${g.ko?'ko':''}" onclick="doSwap('${team}',${realIdx})" style="display:flex; gap:10px; align-items:center;">
      ${gd.art ? `<img src="${gd.art}" style="width:50px; height:50px; border-radius:6px; object-fit:cover; border:1px solid var(--${gd.rarity});">` : ''}
      <div>
        <div class="so-name">${g.name}</div>
        <div class="so-info"><span style="color:${hpColor}; font-weight:700;">&hearts; ${g.hp}/${g.maxHp}</span> ${g.ko?'<span style="color:var(--accent); font-weight:800;">(KO)</span>':''} &middot; <span style="color:var(--moonstone);">${gd.ability}</span></div>
      </div>
    </div>`;
  }).join('');
  document.getElementById('swapOverlay').classList.add('active');
}

function doSwap(team, idx) {
  const t = B[team];
  if (t.ghosts[idx].ko) return;
  const oldGhost = active(t);
  const oldName = oldGhost.name;
  const skipEntry = (oldGhost.id === 365); // Tyson — Hop: no entry effects
  t.activeIdx = idx;
  const f = active(t);
  // Returning from sideline = full HP
  f.hp = f.maxHp;

  log(`<span class="log-ability">${oldName} swaps out — ${f.name} enters at full HP!</span>`);
  if (skipEntry) {
    log(`<span class="log-ability">Tyson</span> — Hop! No entry effects triggered.`);
  }
  triggerEntry(t, skipEntry);

  document.getElementById('swapOverlay').classList.remove('active');
  if (!handleKOs()) renderBattle();
}

// ============================================================
// ABILITY CALLOUT
// ============================================================
// Narration queue — prevents rapid narrations from overwriting each other
let narrateQueue = [];
let narrateActive = false;
function narrate(html) {
  const el = document.getElementById('narrator');
  if (!el) return;
  if (!html) { el.innerHTML = ''; narrateQueue = []; narrateActive = false; return; }
  narrateQueue.push(html);
  if (!narrateActive) drainNarrate();
}
function drainNarrate() {
  const el = document.getElementById('narrator');
  if (!el || narrateQueue.length === 0) { narrateActive = false; return; }
  narrateActive = true;
  const html = narrateQueue.shift();
  el.style.opacity = '0';
  setTimeout(() => {
    el.innerHTML = '<span>' + html + '</span>';
    el.style.opacity = '1';
    // Always hold 1800ms — even as the last item in the queue.
    // Without this, `narrateActive` drops to false immediately after display,
    // so any narrate() called within ~800–1500ms (e.g. "Y enters the arena!"
    // after "X is down!") bypasses the queue and stomps the current line.
    // After the 1800ms hold, drain the next queued item if one arrived,
    // otherwise release the lock so future calls fire immediately.
    setTimeout(() => {
      if (narrateQueue.length > 0) drainNarrate();
      else narrateActive = false;
    }, 1800);
  }, 150);
}

// ============================================================
// AUDIO
// ============================================================
function playSfx(id, vol) {
  const el = document.getElementById(id);
  if (!el) return;
  el.currentTime = 0;
  el.volume = Math.min(vol || 0.8, 1.0);
  el.play().catch(() => {});
}

function playDamageSfx(dmg) {
  if (dmg >= 3) playSfx('sfx3Damage');
  else if (dmg === 2) playSfx('sfx2Damage');
  else playSfx('sfx1Damage');
}

function startMusic() {
  const music = document.getElementById('bgMusic');
  music.currentTime = 0;
  music.volume = 0.2;
  music.play().catch(() => {});
}

function fadeOutMusic() {
  const music = document.getElementById('bgMusic');
  clearInterval(music._fadeInt);
  music._fadeInt = setInterval(() => {
    if (music.volume > 0.03) { music.volume -= 0.03; }
    else { clearInterval(music._fadeInt); music.pause(); music.volume = 0.2; }
  }, 60);
}

function stopMusicHard() {
  const music = document.getElementById('bgMusic');
  clearInterval(music._fadeInt);
  music.pause();
  music.currentTime = 0;
}

// Unlock audio on first user interaction (browsers block autoplay)
(function unlockAudio() {
  const unlock = () => {
    document.querySelectorAll('audio').forEach(a => {
      a.play().then(() => a.pause()).catch(() => {});
    });
    document.removeEventListener('click', unlock);
    document.removeEventListener('touchstart', unlock);
  };
  document.addEventListener('click', unlock, { once: true });
  document.addEventListener('touchstart', unlock, { once: true });
})();

function showTriplesEffect(side, rollType) {
  const banner = document.getElementById('triplesBanner');
  const flash = document.getElementById('triplesFlash');
  const bannerText = { penta:'PENTA!!', quads:'QUADS!', triples:'TRIPLES!' };
  banner.textContent = bannerText[rollType] || 'TRIPLES!';

  playSfx('triplesSfx', 1.0);

  // Glow on dice
  const diceEl = document.getElementById(side + '-dice');
  if (diceEl) {
    diceEl.querySelectorAll('.die').forEach(d => d.classList.add('triples-glow'));
  }

  // Flash
  flash.className = 'triples-flash ' + side + '-flash';
  flash.style.transition = 'none';
  flash.style.opacity = '0.6';
  requestAnimationFrame(() => { flash.style.transition = 'opacity 0.8s ease-out'; flash.style.opacity = '0'; });

  // Screen shake
  document.body.classList.add('screen-shake');
  setTimeout(() => document.body.classList.remove('screen-shake'), 500);

  // Banner pop
  banner.className = 'triples-banner ' + side + '-triples';
  requestAnimationFrame(() => {
    banner.classList.add('show');
    setTimeout(() => {
      banner.classList.remove('show');
      banner.classList.add('fade');
      setTimeout(() => { banner.className = 'triples-banner'; }, 500);
    }, 1200);
  });
}

// Ability splash themes mapped from color vars
const SPLASH_THEMES = {
  'var(--magma)':      'theme-fire',
  'var(--moonstone)':  'theme-blue',
  'var(--rare)':       'theme-blue',
  'var(--ghost-rare)': 'theme-purple',
  'var(--uncommon)':   'theme-green',
  'var(--legendary)':  'theme-gold',
  'var(--accent)':     'theme-red',
  '#22c55e':           'theme-green',
  '#fbbf24':           'theme-gold',
  '#a855f7':           'theme-purple',
};

// ============================================================
// ABILITY QUEUE — cinematic sequential playback
// ============================================================
let abilityQueue = [];
let abilityQueueMode = false;

function queueAbility(name, color, desc, onShow, team) {
  if (abilityQueueMode) {
    abilityQueue.push({ name, color, desc, onShow, team });
  } else {
    showAbilityCallout(name, color, desc, team);
    if (onShow) onShow();
  }
}

function drainAbilityQueue(callback) {
  abilityQueueMode = false;
  if (abilityQueue.length === 0) {
    try { callback(); } catch (e) { console.error('[drainAbilityQueue empty-callback CRASH]', e); try { log(`<span class="log-dmg">ERROR in post-drain callback:</span> ${e && e.message ? e.message : String(e)}`); } catch (_) {} try { B.phase = 'ready'; resetRollButtons(); renderBattle(); } catch (_) {} }
    return;
  }
  let i = 0;
  function next() {
    if (i >= abilityQueue.length) {
      abilityQueue = [];
      // 1500ms: each splash displays for 1400ms, so firing the callback at 900ms
      // (the old value) meant the last splash still had 500ms left on screen when
      // the callback ran — causing roll buttons, modals, and narration to appear
      // while the callout was still visible.  1500ms gives 100ms of clearance after
      // the last splash auto-dismisses, eliminating the race across ALL drain paths.
      // v386: wrap callback in try/catch so a broken post-drain handler never freezes the game
      setTimeout(() => {
        try { callback(); } catch (e) {
          console.error('[drainAbilityQueue callback CRASH]', e);
          try { log(`<span class="log-dmg">ERROR in post-drain callback:</span> ${e && e.message ? e.message : String(e)}`); } catch (_) {}
          try { B.phase = 'ready'; resetRollButtons(); renderBattle(); } catch (_) {}
        }
      }, 1500);
      return;
    }
    const a = abilityQueue[i++];
    // v386: wrap each ability's onShow in try/catch — a single broken closure must not
    // kill the whole cinematic queue and freeze the game.
    try { showAbilityCallout(a.name, a.color, a.desc, a.team); } catch (e) { console.error('[showAbilityCallout CRASH]', a, e); }
    if (a.onShow) {
      try { a.onShow(); } catch (e) { console.error('[ability onShow CRASH]', a.name, e); try { log(`<span class="log-dmg">ERROR in ${a.name} onShow:</span> ${e && e.message ? e.message : String(e)}`); } catch (_) {} }
    }
    setTimeout(next, 1300);
  }
  next();
}

// showAbilityCallout — v407: no more full-screen proscenium splash.
// Instead: the firing fighter's card glows with a themed spotlight pulse,
// and the narrator strip shows the ability name + desc for the callout beat.
// #abilitySplash DOM element kept (display:none) so .active toggling still works
// for any external code that reads it (3 callsites) — safe no-op.
function showAbilityCallout(name, color, desc, team) {
  // Maintain splash .active compatibility (visual no-op — CSS sets display:none)
  const el = document.getElementById('abilitySplash');
  const theme = SPLASH_THEMES[color] || '';
  el.className = 'ability-splash ' + theme;
  el.classList.add('active');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => { el.classList.remove('active'); }, 1400);

  // Play the ability SFX — audio cue is good, keep it
  playSfx('sfxSpecial', 0.85);

  // Card spotlight glow — pulse the firing fighter's slot
  if (team) {
    const slotId = team === 'red' ? 'red-fighter' : 'blue-fighter';
    const slot = document.getElementById(slotId);
    if (slot) {
      const fireTheme = theme.replace('theme-', '') || 'default';
      clearTimeout(slot._abilityFireTimer);
      slot.classList.remove(
        'ability-fire', 'ability-fire-fire', 'ability-fire-blue',
        'ability-fire-purple', 'ability-fire-green', 'ability-fire-gold',
        'ability-fire-red', 'ability-fire-default'
      );
      void slot.offsetWidth; // force reflow so re-trigger restarts the animation
      slot.classList.add('ability-fire', 'ability-fire-' + fireTheme);
      slot._abilityFireTimer = setTimeout(() => {
        slot.classList.remove(
          'ability-fire', 'ability-fire-fire', 'ability-fire-blue',
          'ability-fire-purple', 'ability-fire-green', 'ability-fire-gold',
          'ability-fire-red', 'ability-fire-default'
        );
      }, 1200);
    }
  }

  // Narrator strip — ability name (colored) + desc for the duration of the beat
  const narrator = document.getElementById('narrator');
  if (narrator) {
    clearTimeout(narrator._abilityTimer);
    narrator.classList.add('ability-active');
    narrator.innerHTML = '<b style="color:' + (color || 'var(--moonstone)') + '">' + name + '</b>' +
      (desc ? ' <span style="opacity:0.72;font-size:12px;font-weight:500">\u2014 ' + desc + '</span>' : '');
    narrator._abilityTimer = setTimeout(() => { narrator.classList.remove('ability-active'); }, 1300);
  }

  // Small hype-pop callout strip — unobtrusive, keep it
  const small = document.getElementById('abilityCallout');
  if (small) {
    small.style.visibility = '';
    small.textContent = name;
    small.style.color = color || 'var(--moonstone)';
    small.classList.remove('hype-pop');
    void small.offsetWidth;
    small.classList.add('hype-pop');
    clearTimeout(small._timer);
    small._timer = setTimeout(() => { small.textContent = ''; small.classList.remove('hype-pop'); }, 2200);
  }
}

// ============================================================
// RENDERING
// ============================================================
function renderCardSlot(ghost, isFighter) {
  const g = ghostData(ghost.id);
  const rarityLabel = g.rarity.replace('-',' ');
  const artHtml = g.art
    ? `<img class="card-img" src="${g.art}" alt="${ghost.name}" loading="lazy" onerror="this.outerHTML='<div class=\\'card-img-placeholder\\'>👻</div>'">`
    : `<div class="card-img-placeholder">👻</div>`;
  let statusHtml = '';
  if (isFighter) {
    if (ghost.hankFirstRoll) statusHtml += `<span class="status-tag pressure">Lazy (1-2-3)</span>`;
    if (ghost.maximoFirstRoll) statusHtml += `<span class="status-tag streak">Napping (1 die)</span>`;
    // Check if opponent has Timber (210) — Howl debuff indicator
    if (B) {
      const thisTeam = B.red.ghosts.includes(ghost) ? B.red : B.blue;
      const thisTeamName = thisTeam === B.red ? 'red' : 'blue';
      const oppTeam = thisTeam === B.red ? B.blue : B.red;
      const oppActive = active(oppTeam);
      if (oppActive && oppActive.id === 210 && !oppActive.ko) {
        statusHtml += `<span class="status-tag pressure" style="background:var(--surface3);">⚠️ Timber · Choose Each Roll</span>`;
      }
      // Retribution indicator — Knight Light (402) has pending bonus dice stored up
      if (ghost.id === 402 && !ghost.ko && B.retributionDice) {
        const stored = B.retributionDice[thisTeamName] || 0;
        if (stored > 0) {
          statusHtml += `<span class="status-tag" style="background:rgba(52,152,219,0.15);color:var(--rare);">+${stored} ⚡ Retribution</span>`;
        }
      }
      // Zain (206) — Ice Blade: persistent forged status
      if (ghost.id === 206 && !ghost.ko && ghost.iceBladeForged) {
        statusHtml += `<span class="status-tag" style="background:rgba(103,232,249,0.18);color:#67e8f9;border:1px solid rgba(103,232,249,0.45);" title="Ice Blade forged — swing for +1 die and +2 damage on win">🗡️ Ice Blade</span>`;
      }
            // Finn (204) Forge indicator:
      // • Finn on sideline → show Forge state on the active fighter's card
      // • Finn IS the active fighter → show "dormant" on his own card so players
      //   know they need to bench him for Forge to activate
      if (ghost.id === 204) {
        statusHtml += `<span class="status-tag" style="background:rgba(100,116,139,0.18);color:#94a3b8;" title="Finn can forge the Flame Blade (sideline or active)">🔥 Flame Blade: ${B.flameBlade && B.flameBlade[thisTeamName] ? 'FORGED' : 'ready to forge'}</span>`;
      } else if (hasSideline(thisTeam, 204)) {
        const canForge = (thisTeam.resources.ice >= 2) || (thisTeam.resources.fire >= 2);
        if (canForge) {
          statusHtml += `<span class="status-tag" style="background:rgba(251,191,36,0.16);color:#fbbf24;border:1px solid rgba(251,191,36,0.35);">🔨 Forge: ready</span>`;
        } else {
          statusHtml += `<span class="status-tag" style="background:rgba(100,116,139,0.18);color:#94a3b8;">🔨 Forge: idle</span>`;
        }
      }
    }
    // Overclock indicator — moonstone cyan pulse, matching HP bar + HP text colors when hp > maxHp
    if (ghost.hp > ghost.maxHp) {
      const overAmt = ghost.hp - ghost.maxHp;
      statusHtml += `<span class="status-tag overclock">💧 +${overAmt} Overheal</span>`;
    }
  }
  // HP color
  const hpRatio = ghost.hp / ghost.maxHp;
  const hpColor = hpRatio > 1 ? 'var(--moonstone)' : hpRatio > 0.6 ? 'var(--hp-green)' : hpRatio > 0.3 ? 'var(--hp-yellow)' : 'var(--hp-red)';
  return `
    <div class="card-name-banner rarity-${g.rarity}">${ghost.name}</div>
    <div class="card-rarity-badge rarity-${g.rarity}">${rarityLabel}</div>
    <div class="card-hp-badge" style="color:${hpColor}">${ghost.hp}/${ghost.maxHp}</div>
    ${artHtml}
    <div class="ability-banner">${g.ability}</div>
    <div class="card-info">
      <div class="ci-desc">${g.abilityDesc}</div>
    </div>
    ${statusHtml ? `<div class="fighter-status">${statusHtml}</div>` : ''}`;
}

function updateHpBar(team, hp, maxHp) {
  const pct = Math.max(0, hp / maxHp * 100);
  const bar = document.getElementById(`${team}-hpBar`);
  bar.style.width = Math.min(pct, 100) + '%';
  const isOverclock = hp > maxHp;
  bar.classList.toggle('hp-low', !isOverclock && pct <= 50 && pct > 25);
  bar.classList.toggle('hp-critical', !isOverclock && pct <= 25);
  bar.classList.toggle('hp-overclock', isOverclock);
  const hpText = document.getElementById(`${team}-hpText`);
  hpText.textContent = `${Math.max(0, hp)} / ${maxHp}`;
  if (isOverclock) hpText.style.color = 'var(--moonstone)';
  else hpText.style.color = '';
}

// Visual hit — shake the card + drain the HP bar for a team
function hitDamage(teamName) {
  const t = B[teamName];
  const f = active(t);
  const el = document.getElementById(teamName + '-fighter');
  el.classList.add('hit');
  setTimeout(() => el.classList.remove('hit'), 500);
  updateHpBar(teamName, f.hp, f.maxHp);
}

function renderBattle() {
  if (!B) return;

  ['red','blue'].forEach(team => {
    const t = B[team];
    const f = active(t);
    const sl = t.ghosts.filter((_,i) => i !== t.activeIdx);

    // Fighter
    const fighterEl = document.getElementById(`${team}-fighter`);
    const fData = ghostData(f.id);
    fighterEl.className = `arena-card fighter-slot team-${team} rarity-${fData.rarity} ${f.ko?'ko':''}`;
    fighterEl.innerHTML = renderCardSlot(f, true);

    // HP Bar
    updateHpBar(team, f.hp, f.maxHp);

    // Sideline
    const slLeft = document.getElementById(`${team}-sl-left`);
    const slRight = document.getElementById(`${team}-sl-right`);
    const isKoPickTeam = B.phase === 'ko-swap' && B.koSwapQueue && B.koSwapQueue[0] === team;
    [slLeft, slRight].forEach((el, i) => {
      if (sl[i]) {
        el.style.visibility = 'visible';
        const slData = ghostData(sl[i].id);
        const isPick = isKoPickTeam && !sl[i].ko;
        const realIdx = t.ghosts.indexOf(sl[i]);
        el.className = `arena-card sideline-slot rarity-${slData.rarity} ${sl[i].ko?'ko':''} ${isPick?'ko-swap-pick':''}`;
        let slCardHtml = renderCardSlot(sl[i], false);
        // Burn badge: show how much burn is stacked on this sideline ghost
        if (B.burn && B.burn[team] && B.burn[team][realIdx]) {
          const bc = B.burn[team][realIdx];
          slCardHtml += `<div class="burn-badge">🔥${bc}</div>`;
        }
        el.innerHTML = slCardHtml;
        el.onclick = isPick ? () => doKoSwap(team, realIdx) : null;
      } else {
        el.style.visibility = 'hidden';
        el.onclick = null;
      }
    });

    // Resources — single tile per resource (boobattles style)
    const r = t.resources;
    const c = B.committed[team];
    // Pre-roll controls are available during 'ready' OR during the Duel Phase
    // when it's this team's turn — matches the isPreRollActive() handler gate.
    const isReady = isPreRollActive(team);
    // Sylvia (313): ice is free (not consumed on commit), so r.ice already includes committed ice
    const isSylviaActive = f && f.id === 313 && !f.ko;
    const totalIce = isSylviaActive ? r.ice : (r.ice + c.ice);
    const totalFire = r.fire + c.fire;
    const totalSurge = r.surge + c.surge;
    let rh = '';

    if (r.moonstone > 0) {
      rh += `<div class="res-tile moonstone" title="Moonstone: after rolling, click it — then pick any die and set it to any value you choose"><span class="res-main">💎</span><span class="res-count">${r.moonstone}</span><span class="res-label">MS</span></div>`;
    }
    if (totalIce > 0) {
      const committed = c.ice > 0;
      const click = isReady ? `onclick="cycleCommit('${team}','ice')"` : '';
      const label = committed ? `${c.ice}/${totalIce}⚔` : totalIce;
      const tileLabel = committed ? `+${c.ice} DMG` : 'ICE';
      const iceTitle = committed
        ? `${c.ice} of ${totalIce} Ice Shard${totalIce>1?'s':''} committed — +${c.ice} damage if you win${c.ice < totalIce ? ' (click to commit more)' : ''}`
        : `Ice Shards: ${totalIce} available — click to commit (+1 dmg each)`;
      rh += `<div class="res-tile ice ${committed?'committed':''} ${isReady?'clickable':''}" ${click} title="${iceTitle}"><span class="res-main"><img src="../boobattles/iceshard.png"></span><span class="res-count">${label}</span><span class="res-label ${committed?'res-label-bonus':''}">${tileLabel}</span></div>`;
    }
    if (totalFire > 0) {
      const committed = c.fire > 0;
      const click = isReady ? `onclick="cycleCommit('${team}','fire')"` : '';
      const label = committed ? `${c.fire}/${totalFire}⚔` : totalFire;
      const tileLabel = committed ? `+${c.fire*3} DMG` : 'FIRE';
      const fireTitle = committed
        ? `${c.fire} of ${totalFire} Sacred Fire committed — +${c.fire*3} damage if you win${c.fire < totalFire ? ' (click to commit more)' : ''}`
        : `Sacred Fire: ${totalFire} available — click to commit (+3 dmg each)`;
      rh += `<div class="res-tile fire ${committed?'committed':''} ${isReady?'clickable':''}" ${click} title="${fireTitle}"><span class="res-main"><img src="../boobattles/sacredfire.png"></span><span class="res-count">${label}</span><span class="res-label ${committed?'res-label-bonus':''}">${tileLabel}</span></div>`;
    }
    if (totalSurge > 0) {
      const committed = c.surge > 0;
      const click = isReady ? `onclick="cycleCommit('${team}','surge')"` : '';
      const label = committed ? `${c.surge}/${totalSurge}⚔` : totalSurge;
      const tileLabel = committed ? `+${c.surge} ${c.surge>1?'DICE':'DIE'}` : 'SURGE';
      const surgeTitle = committed
        ? `${c.surge} of ${totalSurge} Surge committed — +${c.surge} extra ${c.surge>1?'dice':'die'} this roll${c.surge < totalSurge ? ' (click to commit more)' : ''}`
        : `Surge: ${totalSurge} available — click to commit (+1 extra die each)`;
      rh += `<div class="res-tile surge ${committed?'committed':''} ${isReady?'clickable':''}" ${click} title="${surgeTitle}"><span class="res-main">⚡</span><span class="res-count">${label}</span><span class="res-label ${committed?'res-label-bonus':''}">${tileLabel}</span></div>`;
    }
    if (r.healingSeed > 0) {
      const canHeal = isReady && f.hp < f.maxHp;
      const click = canHeal ? `onclick="spendHealingSeed('${team}')"` : '';
      const seedTitle = canHeal
        ? `Healing Seed: click to heal 1 HP (${f.hp}/${f.maxHp})`
        : f.hp > f.maxHp
          ? `Healing Seed: HP is overclocked (${f.hp}/${f.maxHp}) — Seeds cannot heal above max HP`
          : f.hp === f.maxHp
            ? `Healing Seed: HP is already full (${f.hp}/${f.maxHp}) — can't use now`
            : `Healing Seed: heal 1 HP — only usable during your turn`;
      rh += `<div class="res-tile healingSeed ${canHeal?'clickable':''}" ${click} title="${seedTitle}"><span class="res-main">🌱</span><span class="res-count">${r.healingSeed}</span><span class="res-label">SEED</span></div>`;
    }
    if (r.luckyStone > 0) {
      rh += `<div class="res-tile luckyStone" title="Lucky Stone: use after rolling to reroll any one of your dice"><span class="res-main">🍀</span><span class="res-count">${r.luckyStone}</span><span class="res-label">LUCK</span></div>`;
    }
    // Magic Fireflies — clickable wildcard resource (pre-roll only)
    if (r.firefly > 0) {
      const ffClick = isReady ? `onclick="showFireflyPicker('${team}')"` : '';
      rh += `<div class="res-tile firefly ${isReady?'clickable':''}" ${ffClick} title="Magic Fireflies: ${r.firefly} available — click to convert to any resource"><span class="res-main">✨</span><span class="res-count">${r.firefly}</span><span class="res-label">FIREFLY</span></div>`;
    }
    // Burn resource pool — clickable to place on enemy sideline ghosts (pre-roll only)
    if (r.burn > 0) {
      const burnClick = isReady ? `onclick="showBurnPicker('${team}')"` : '';
      rh += `<div class="res-tile fire ${isReady?'clickable':''}" ${burnClick} title="Burn: ${r.burn} available — click to place on an enemy sideline ghost (deals damage on entry)"><span class="res-main">🔥</span><span class="res-count">${r.burn}</span><span class="res-label">BURN</span></div>`;
    }
    // Castle Guide (420) — Burn: show total burn already placed on enemy sideline ghosts
    if (B.burn) {
      const enemyTeam = team === 'red' ? 'blue' : 'red';
      const burnObj = B.burn[enemyTeam] || {};
      const totalBurn = Object.values(burnObj).reduce((s, v) => s + v, 0);
      if (totalBurn > 0) {
        const burnDetails = Object.entries(burnObj).map(([idx, cnt]) => {
          const g = B[enemyTeam].ghosts[parseInt(idx)];
          return g ? `${g.name}: ${cnt}` : '';
        }).filter(Boolean).join(', ');
        rh += `<div class="res-tile fire" title="Burn placed on enemy: ${burnDetails}"><span class="res-main">💥</span><span class="res-count">${totalBurn}</span><span class="res-label">PLACED</span></div>`;
      }
    }
    // Happy Crystal (208) — sacrifice tile
    if (isReady && f.id === 208 && !f.ko) {
      rh += `<div class="res-tile moonstone clickable" onclick="sacrificeHappyCrystal('${team}')" title="Sacrifice for 1 Moonstone"><span class="res-main">💀</span><span class="res-label">Sac</span></div>`;
    }
    // Aunt Susan (309) — commit healing seeds for damage or heal (click=add, right-click=remove)
    if (isReady && f.id === 309 && (r.healingSeed > 0 || c.auntSusan > 0 || c.auntSusanHeal > 0)) {
      rh += `<div class="res-tile healingSeed clickable ${c.auntSusan>0?'committed':''}" onclick="toggleAuntSusan('${team}')" oncontextmenu="event.preventDefault();uncommitAuntSusan('${team}')" title="Click: +2 dmg per seed. Right-click: remove"><span class="res-main">🌱</span><span class="res-label">${c.auntSusan>0?'+'+c.auntSusan*2+'dmg':'+2dmg'}</span></div>`;
      rh += `<div class="res-tile healingSeed clickable ${c.auntSusanHeal>0?'committed':''}" onclick="toggleAuntSusanHeal('${team}')" oncontextmenu="event.preventDefault();uncommitAuntSusanHeal('${team}')" title="Click: +2 HP per seed. Right-click: remove" style="${c.auntSusanHeal>0?'border-color:#22c55e;box-shadow:0 0 8px rgba(34,197,113,0.4);':''}"><span class="res-main">🌱</span><span class="res-label">${c.auntSusanHeal>0?'+'+c.auntSusanHeal*2+'hp':'+2hp'}</span></div>`;
    }
    // Snapshot current resources for flash detection
    const newSnap = { moonstone:r.moonstone, ice:totalIce, fire:totalFire, surge:r.surge+c.surge, healingSeed:r.healingSeed, luckyStone:r.luckyStone, firefly:r.firefly||0 };
    const prev = prevResources[team] || {};
    document.getElementById(`${team}-resources`).innerHTML = rh;
    // Flash any resource tile that increased
    const resEl = document.getElementById(`${team}-resources`);
    ['moonstone','ice','fire','surge','healingSeed','luckyStone','firefly'].forEach(key => {
      if ((newSnap[key]||0) > (prev[key]||0)) {
        const tile = resEl.querySelector(`.res-tile.${key}`);
        if (tile) { tile.classList.remove('res-gained'); void tile.offsetWidth; tile.classList.add('res-gained'); }
      }
    });
    prevResources[team] = newSnap;

    // Persistent permanent effect badges
    const opp_team = team === 'red' ? 'blue' : 'red';
    let permHtml = '';
    if (B.haywireBonus && B.haywireBonus[team] > 0) permHtml += `<div class="permanent-buff">\u{1F3B5} +${B.haywireBonus[team]} Die (Wild Chords)</div>`;
    if (B.haywireDamageBonus && B.haywireDamageBonus[team] > 0) permHtml += `<div class="permanent-buff">\u{1F3B5} +${B.haywireDamageBonus[team]} Dmg (Wild Chords)</div>`;
    if (B.pipDieRemoval && B.pipDieRemoval[team] > 0) permHtml += `<div class="permanent-debuff">🍞 -${B.pipDieRemoval[team]} Die (Toasted)</div>`;
    if (permHtml) {
      const permRow = document.createElement('div');
      permRow.className = 'permanent-effects-row';
      permRow.innerHTML = permHtml;
      resEl.appendChild(permRow);
    }
  });

  document.getElementById('turnIndicator').textContent = '';
  const logWrap = document.getElementById('battleLog').parentElement;
  document.getElementById('battleLog').innerHTML = B.log.map(l=>`<div class="log-entry">${l}</div>`).join('');
  logWrap.scrollTop = 0;

  // Ability buttons (pre-roll actions)
  ['red','blue'].forEach(team => {
    const el = document.getElementById(`${team}-ability-buttons`);
    const f = active(B[team]);
    const enemy = opp(B[team]);
    let html = '';
    if (isPreRollActive(team)) {
      // Death Howl (202) — Pressure button (once per round)
      if (f.id === 202 && !f.ko && !dylanNegates(enemy) && !(B.pressureUsed && B.pressureUsed[team])) {
        const enemySideline = enemy.ghosts.filter((g,i) => i !== enemy.activeIdx && !g.ko);
        if (enemySideline.length > 0) {
          html += `<button class="ability-btn pressure" onclick="usePressure('${team}')">🔥 Pressure</button>`;
        }
      }
      // Tyson (365) — Hop: swap self to bench before rolling (no entry effects)
      if (f.id === 365 && !f.ko) {
        const aliveSl = B[team].ghosts.filter((g,i) => i !== B[team].activeIdx && !g.ko);
        if (aliveSl.length > 0) {
          const blocked = dylanNegates(enemy);
          html += `<button class="ability-btn ${blocked?'':'pressure'}" onclick="useTysonHop('${team}')" ${blocked?'disabled title="Blocked by Dylan"':''}>${blocked?'🚫':'🐰'} Hop${blocked?' (Blocked)':''}</button>`;
        }
      }
      // Harrison (315) — Ascend: spend seeds for extra dice (click=add, right-click=remove)
      if (f.id === 315 && !f.ko && (B[team].resources.healingSeed > 0 || B.committed[team].harrison > 0)) {
        const cnt = B.committed[team].harrison;
        html += `<button class="ability-btn ${cnt>0?'committed':'pressure'}" onclick="toggleHarrison('${team}')" oncontextmenu="event.preventDefault();uncommitHarrison('${team}')" style="${cnt>0?'border-color:#22c55e;box-shadow:0 0 8px rgba(34,197,113,0.4);':''}">🌱 Ascend${cnt>0?' (+'+cnt+' dice)':''}</button>`;
      }
      // Mable Stadango (446) — Hex: spend Burn for die removal + Sacred Fire
      if (f.id === 446 && !f.ko && (B[team].resources.burn || 0) >= 1) {
        html += `<button class="ability-btn pressure" onclick="useHex('${team}')">🌿 Hex (${B[team].resources.burn} Burn)</button>`;
      }
      // Finn (204) — Flame Blade: forge button (2 Healing Seeds + 1 Sacred Fire) OR swing toggle if forged
      if (B[team].ghosts.some(g => g.id === 204 && !g.ko)) {
        if (!B.flameBlade || !B.flameBlade[team]) {
          const r = B[team].resources;
          const canForge = (r.healingSeed || 0) >= 2 && (r.fire || 0) >= 1;
          if (canForge) {
            html += `<button class="ability-btn pressure" onclick="useFinnFlameBlade('${team}')" title="Finn — forge the Flame Blade (2 Healing Seeds + 1 Sacred Fire)" style="border-color:#fb923c;color:#fb923c;">🔥 Forge Flame Blade (2🌱 + 1🔥)</button>`;
          } else {
            html += `<button class="ability-btn" disabled title="Need 2 Healing Seeds + 1 Sacred Fire" style="opacity:0.4;border-color:#fb923c;color:#fb923c;">🔥 Forge Flame Blade (2🌱 + 1🔥)</button>`;
          }
        }
      }
      // Flame Blade toggle (if forged — shown for any active ghost on the team)
      if (B.flameBlade && B.flameBlade[team]) {
        const fbSwung = B.flameBladeSwing && B.flameBladeSwing[team];
        html += `<button class="ability-btn ${fbSwung?'committed':'pressure'}" onclick="toggleFlameBlade('${team}')" title="${fbSwung?'Sheathing — click to stop swinging':'Swing the Flame Blade — +1 die to your roll AND +5 Burn if you win'}" style="border-color:#fb923c;color:${fbSwung?'#fff':'#fb923c'};${fbSwung?'background:linear-gradient(135deg,#b45309,#fb923c);':''}">🔥 ${fbSwung?'Flame Blade SWINGING (+1 die, +5 Burn on win)':'Swing Flame Blade'}</button>`;
      }
      // Zain (206) — Ice Blade: forge button (Sideline & In Play) OR swing toggle (any active ghost, if forged)
      const hasZainForForge = (f.id === 206 && !f.ko) || B[team].ghosts.some(g => g.id === 206 && !g.ko && B[team].ghosts.indexOf(g) !== B[team].activeIdx);
      if (hasZainForForge && !B.iceBladeForgedPermanent[team]) {
        const r = B[team].resources;
        const canForge = r.ice >= 1 && r.moonstone >= 1;
        if (canForge) {
          html += `<button class="ability-btn pressure" onclick="useZainForge('${team}')" title="Forge the Ice Blade — spend 1 Ice Shard + 1 Moonstone" style="border-color:#67e8f9;color:#67e8f9;">🗡️ Forge Ice Blade (1❄️ + 1💎)</button>`;
        } else {
          html += `<button class="ability-btn" disabled title="Need 1 Ice Shard + 1 Moonstone to forge" style="opacity:0.4;border-color:#67e8f9;color:#67e8f9;">🗡️ Forge Ice Blade (1❄️ + 1💎)</button>`;
        }
      }
      // Ice Blade toggle (if forged — shown for any active ghost on the team)
      if (B.iceBladeForgedPermanent && B.iceBladeForgedPermanent[team]) {
        const ibSwung = (B.iceBladeSwing && B.iceBladeSwing[team]) || (B.committed[team].zainBlade > 0);
        html += `<button class="ability-btn ${ibSwung?'committed':'pressure'}" onclick="toggleIceBlade('${team}')" title="${ibSwung?'Sheathing — click to stop swinging':'Swing the Ice Blade — +1 die to your roll AND +2 damage if you win'}" style="border-color:#67e8f9;color:${ibSwung?'#fff':'#67e8f9'};${ibSwung?'background:linear-gradient(135deg,#0e7490,#67e8f9);':''}">🗡️ ${ibSwung?'Ice Blade SWINGING (+1 die, +2 dmg on win)':'Swing Ice Blade'}</button>`;
      }
      // Smudge (403) — Blackout: name a number
      if (f.id === 403 && !f.ko) {
        html += `<div class="blackout-picker">
          <span class="blackout-label">Blackout:</span>
          ${[1,2,3,4,5,6].map(n =>
            `<button class="blackout-num ${B.blackoutNum && B.blackoutNum[team] === n ? 'active' : ''}" onclick="setBlackout('${team}', ${n})">${n}</button>`
          ).join('')}
        </div>`;
      }
      // No voluntary swap — swapping only happens via abilities (Tyson Hop, Pressure) or KO
    }
    el.innerHTML = html;
  });
}

function renderDice(rd, bd) {
  const redEl = document.getElementById('red-dice');
  const blueEl = document.getElementById('blue-dice');
  if (!rd && !bd) {
    redEl.innerHTML = [0,0,0].map(()=>`<div class="die die-red">?</div>`).join('');
    blueEl.innerHTML = [0,0,0].map(()=>`<div class="die die-blue">?</div>`).join('');
  } else {
    if (rd) redEl.innerHTML = rd.map(d => `<div class="die die-red">${d}</div>`).join('');
    if (bd) blueEl.innerHTML = bd.map(d => `<div class="die die-blue">${d}</div>`).join('');
  }
}

// Show rolling animation for one side
function showRolling(team, count) {
  const el = document.getElementById(team + '-dice');
  const cls = 'die-' + team;
  // Give each die an ID so revealDice can target them sequentially
  el.innerHTML = Array(count).fill(0).map((_, i) =>
    `<div class="die ${cls} rolling" id="${team}-die-${i}">?</div>`
  ).join('');
}

// Reveal dice values one at a time — 300ms stagger (Feature 7)
function revealDice(team, values) {
  const cls = 'die-' + team;
  values.forEach((v, i) => {
    setTimeout(() => {
      const d = document.getElementById(team + '-die-' + i);
      if (d) {
        d.classList.remove('rolling');
        d.textContent = v;
      }
    }, i * 300);
  });
  // Immediately highlight the hand type after all dice reveal
  const revealDone = values.length * 300 + 50;
  setTimeout(() => highlightRollPreview(team, values), revealDone);
}

function highlightRollPreview(team, dice) {
  const roll = classify(dice);
  if (roll.type === 'none') return;
  const diceEl = document.getElementById(team + '-dice');
  if (!diceEl) return;
  const dieDivs = [...diceEl.querySelectorAll('.die')];

  if (roll.type === 'singles') {
    // Subtle bump on the highest die
    let done = false;
    [...dieDivs].reverse().forEach(d => {
      if (!done && parseInt(d.textContent) === roll.value) {
        d.style.transform = 'scale(1.12)';
        d.style.transition = 'transform 0.3s';
        done = true;
      }
    });
  } else if (roll.type === 'doubles') {
    // Glow on the matching pair
    let count = 0;
    dieDivs.forEach(d => {
      if (count < 2 && parseInt(d.textContent) === roll.value) {
        d.style.transform = 'scale(1.15)';
        d.style.boxShadow = '0 0 14px rgba(251,191,36,0.5)';
        d.style.borderColor = '#fbbf24';
        d.style.transition = 'all 0.3s';
        count++;
      }
    });
  } else {
    // Triples+ — all matching dice glow
    dieDivs.forEach(d => {
      if (parseInt(d.textContent) === roll.value) {
        d.style.transform = 'scale(1.2)';
        d.style.boxShadow = '0 0 20px rgba(251,191,36,0.7)';
        d.style.borderColor = '#fbbf24';
        d.style.transition = 'all 0.3s';
      }
    });
  }
}

function clearAllOverlays() {
  const overlayIds = [
    'gameOver','swapOverlay','msPicker','stealOverlay','pressureOverlay',
    'seleneOverlay','timberOverlay','romyOverlay','tobyOverlay','guardianFairyOverlay',
    'tylerOverlay','eloiseOverlay','booOverlay','bogeyOverlay','gusOverlay',
    'mallowOverlay','jacksonOverlay','jeanieOverlay','sonyaOverlay','darkWingOverlay',
    'raditzHuntOverlay','dougCautionOverlay','tobogganOverlay','fangOutsideOverlay',
    'fangUndercoverArmOverlay','fangUndercoverSwapOverlay','winstonSchemeOverlay',
    'galeForcePickerOverlay','wiseAlOverlay','gordokOverlay','cultivateOverlay',
    'chowOverlay','hexOverlay','nickKnackOverlay','jasperOverlay','balatronOverlay',
    'tommyOverlay','sylviaOverlay','burnOverlay','fireflyOverlay','abilitySplash','vsSplash'
  ];
  overlayIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active');
  });
  clearLsCountdown();
  clearTimeout(afkTimer);
}

function resetBattle() {
  stopMusicHard();
  B = null; S.battle = null;
  S.redPicks = []; S.bluePicks = [];
  abilityQueue = [];
  abilityQueueMode = false;
  clearAllOverlays();
  const bv = document.getElementById('battle-view');
  if (bv) bv.style.display = 'none';
  const ts = document.getElementById('team-select');
  if (ts) ts.style.display = 'block';
  const appEl = document.querySelector('.app');
  if (appEl) appEl.classList.remove('battle-active');
  resetRollButtons();
  narrate('');
  renderDice(null, null);
  // Callback for multiplayer to handle post-reset
  if (typeof onBattleReset === 'function') onBattleReset();
}

function rematchBattle() {
  stopMusicHard();
  const redIds = S.redPicks.slice();
  const blueIds = S.bluePicks.slice();
  B = null; S.battle = null;
  abilityQueue = [];
  abilityQueueMode = false;
  clearAllOverlays();
  resetRollButtons();
  narrate('');
  renderDice(null, null);
  // Restore picks and start fresh battle
  S.redPicks = redIds;
  S.bluePicks = blueIds;
  startBattle();
}

// ============================================================
// KEYBOARD SHORTCUTS (adapted for multiplayer)
// ============================================================
document.addEventListener('keydown', e => {
  if ((e.key === 'Enter' || e.key === ' ') && document.getElementById('gameOver')?.classList.contains('active')) {
    e.preventDefault();
    rematchBattle();
    return;
  }
  if (e.key === 'Escape') {
    const overlays = ['swapOverlay','msPicker','stealOverlay','gameOver'];
    overlays.forEach(id => document.getElementById(id)?.classList.remove('active'));
  }
});

// No auto-init — multiplayer controls when battle starts
