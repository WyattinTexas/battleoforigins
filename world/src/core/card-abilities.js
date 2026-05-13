// ══════════════════════════════════════════════════════════
//  CARD ABILITIES — All Spiritkin effects
//  Ported from testroom2 (drbango.com/testroom2/)
//  Entry, Pre-Roll, Win-Path, Dodge, KO, Blocker effects
// ══════════════════════════════════════════════════════════

// ── HELPER FUNCTIONS ───────────────────────────────────

// Check if a ghost is on the sideline (alive, not active)
function hasSideline(team, ghostId) {
  if (!team || !team.ghosts) return false;
  return team.ghosts.some((g, i) => i !== team.activeIdx && !g.ko && g.id === ghostId);
}

// Get a sideline ghost by ID
function getSidelineGhost(team, ghostId) {
  if (!team || !team.ghosts) return null;
  return team.ghosts.find((g, i) => i !== team.activeIdx && !g.ko && g.id === ghostId);
}

// Check if a ghost is anywhere on a team (active or sideline)
function hasOnTeam(team, ghostId) {
  if (!team || !team.ghosts) return false;
  return team.ghosts.some(g => !g.ko && g.id === ghostId);
}

// Get ghost data from ALL_CARDS
function ghostData(id) {
  if (typeof ALL_CARDS !== 'undefined') return ALL_CARDS.find(c => c.id === id) || null;
  return null;
}

// ── ENTRY EFFECTS ──────────────────────────────────────
// Called when a ghost enters the field (initial or KO swap)
// Returns array of callout objects: [{name, color, desc, team}]

function triggerEntry(team, teamName, logFn) {
  if (!B || !team) return [];
  const f = activeGhost(team);
  if (!f || f.ko) return [];
  const enemyName = oppTeam(teamName);
  const enemy = B[enemyName];
  if (!enemy) return [];
  const callouts = [];

  // ── Burn damage on entry ──
  if (B.burn && B.burn[teamName]) {
    const idx = team.activeIdx;
    const burnCount = B.burn[teamName][idx] || 0;
    if (burnCount > 0 && !f.ko) {
      // Mike (445) — Torrent: sideline immune to Burn
      if (hasSideline(team, 445)) {
        delete B.burn[teamName][idx];
        callouts.push({ name: 'TORRENT!', color: '#aa66ff', desc: `Mike — Sideline immune to Burn! ${f.name} takes no damage.`, team: teamName });
        if (logFn) logFn(`Mike — Torrent! ${f.name} immune to Burn.`);
      // Rook (416) — Immune to Burn
      } else if (f.id === 416) {
        delete B.burn[teamName][idx];
        callouts.push({ name: 'BURN IMMUNE!', color: '#aa66ff', desc: `${f.name} — Immune to Burn!`, team: teamName });
      } else {
        const pre = f.hp;
        wpDamage(f, burnCount);
        if (f.ko) f.killedBy = -2; // burn kill
        delete B.burn[teamName][idx];
        callouts.push({ name: 'BURN!', color: '#ff6644', desc: `${f.name} takes ${burnCount} Burn damage! (${pre}→${f.hp} HP)${f.ko ? ' KO!' : ''}`, team: teamName });
        if (logFn) logFn(`${f.name} — Burn! ${burnCount} damage on entry! (${pre}→${f.hp} HP)`);
      }
    }
  }

  // ── Frostbite on entry ──
  if (B.frostbite && B.frostbite[teamName]) {
    const idx = team.activeIdx;
    const fbCount = B.frostbite[teamName][idx] || 0;
    if (fbCount > 0 && !f.ko) {
      if (hasSideline(team, 445)) {
        delete B.frostbite[teamName][idx];
        callouts.push({ name: 'TORRENT!', color: '#aa66ff', desc: `Mike — Sideline immune to Frostbite!`, team: teamName });
      } else if (f.id === 416) {
        delete B.frostbite[teamName][idx];
        callouts.push({ name: 'FROSTBITE IMMUNE!', color: '#aa66ff', desc: `${f.name} — Immune to Frostbite!`, team: teamName });
      } else {
        if (!B.frostbiteDicePenalty) B.frostbiteDicePenalty = {};
        B.frostbiteDicePenalty[teamName] = fbCount;
        delete B.frostbite[teamName][idx];
        callouts.push({ name: 'FROSTBITE!', color: '#3b82f6', desc: `${f.name} enters frostbitten! -${fbCount} dice this roll!`, team: teamName });
      }
    }
  }

  // ── Per-ghost entry abilities ──

  // Bouril (201) — Slumber: first roll locked to 1-2-3
  if (f.id === 201) {
    f.hankFirstRoll = true;
    callouts.push({ name: 'SLUMBER!', color: '#66aa44', desc: `${f.name} — first roll locked to 1-2-3!`, team: teamName });
    if (logFn) logFn(`${f.name} enters lazily — first roll will be 1-2-3.`);
  }

  // Nerina (306) — Leviathan: deal 3 damage to enemy active
  if (f.id === 306) {
    const ef = activeGhost(enemy);
    if (ef && !ef.ko) {
      wpDamage(ef, 3);
      if (ef.ko) ef.killedBy = f.id;
      callouts.push({ name: 'LEVIATHAN!', color: '#ffcc00', desc: `${f.name} — 3 entry damage to ${ef.name}!`, team: teamName });
      if (logFn) logFn(`${f.name} — Leviathan! 3 damage to ${ef.name}!`);
    }
  }

  // Maximo (302) — Nap: first roll is 1 die only
  if (f.id === 302) {
    f.maximoFirstRoll = true;
    callouts.push({ name: 'NAP!', color: '#888888', desc: `${f.name} — first roll is 1 die only!`, team: teamName });
  }

  // Redd (98) — Notorious: +2 dice for first roll
  if (f.id === 98) {
    f.reddFirstRoll = true;
    callouts.push({ name: 'NOTORIOUS!', color: '#cc44ff', desc: `${f.name} — +2 dice for this roll!`, team: teamName });
    if (logFn) logFn(`${f.name} — Notorious! +2 bonus dice for the first roll!`);
  }

  // Jenkins (94) — Greeting: roll 4 dice, deal damage by type
  if (f.id === 94) {
    const ef = activeGhost(enemy);
    if (ef && !ef.ko) {
      const jenkinsDice = rollDice(4);
      const jenkinsRoll = classify(jenkinsDice);
      const jenkinsDmg = jenkinsRoll.damage;
      wpDamage(ef, jenkinsDmg);
      if (ef.ko) ef.killedBy = f.id;
      callouts.push({ name: 'GREETING!', color: '#cc44ff', desc: `${f.name} — rolled [${jenkinsDice.join(',')}] (${jenkinsRoll.type}) → ${jenkinsDmg} damage to ${ef.name}!`, team: teamName });
      if (logFn) logFn(`${f.name} — Greeting! Rolled [${jenkinsDice.join(',')}] → ${jenkinsDmg} damage to ${ef.name}!`);
    }
  }

  // Grawr (34) — Menace: deal 1 damage to enemy active
  if (f.id === 34) {
    const ef = activeGhost(enemy);
    if (ef && !ef.ko) {
      wpDamage(ef, 1);
      if (ef.ko) ef.killedBy = f.id;
      callouts.push({ name: 'MENACE!', color: '#66aa44', desc: `${f.name} — 1 entry damage to ${ef.name}!`, team: teamName });
      if (logFn) logFn(`${f.name} — Menace! 1 damage to ${ef.name}!`);
    }
  }

  // Hermit (47) — Solitude: +2 HP per KO'd ghost (both teams)
  if (f.id === 47) {
    const sides = B.red ? [B.red, B.blue] : [B.player, B.enemy];
    const koCount = sides.flatMap(s => s.ghosts).filter(g => g.ko).length;
    if (koCount > 0) {
      const gain = koCount * 2;
      wpHeal(f, gain);
      callouts.push({ name: 'SOLITUDE!', color: '#66aa44', desc: `${f.name} — +${gain} HP from ${koCount} fallen ghosts!`, team: teamName });
    }
  }

  // Chad (56) — Sploop!: gain 2 Ice Shards
  if (f.id === 56) {
    team.resources.ice = (team.resources.ice || 0) + 2;
    callouts.push({ name: 'SPLOOP!', color: '#66aa44', desc: `${f.name} — +2 Ice Shards!`, team: teamName });
    // Sandwiches (33) — Dependable: mirror
    if (hasOnTeam(enemy, 33)) {
      enemy.resources.ice = (enemy.resources.ice || 0) + 2;
      callouts.push({ name: 'DEPENDABLE!', color: '#888888', desc: `Sandwiches mirrors Sploop! +2 Ice Shards!`, team: enemyName });
    }
  }

  // Raditz (62) — Hunt: may force opponent swap (primed for pre-roll)
  if (f.id === 62) {
    const enemySideline = enemy.ghosts.filter((g, i) => i !== enemy.activeIdx && !g.ko);
    if (enemySideline.length > 0) {
      if (!B.raditzHuntReady) B.raditzHuntReady = {};
      B.raditzHuntReady[teamName] = true;
      callouts.push({ name: 'HUNT!', color: '#ff6644', desc: `${f.name} — may force an opponent swap before rolling!`, team: teamName });
    }
  }

  // Dallas (60) — Quick Draw: steal 1 die for first 2 rolls (only from sideline entry)
  if (f.id === 60 && B.battleStarted) {
    f.dallasQuickDraw = 2;
    callouts.push({ name: 'QUICK DRAW!', color: '#66aa44', desc: `${f.name} — stealing 1 opponent die for 2 rolls!`, team: teamName });
  }

  // Lars/Castle Guide (420) — Light the Way: +1 Surge, +1 Lucky Stone, +1 Burn
  if (f.id === 420) {
    team.resources.surge = (team.resources.surge || 0) + 1;
    team.resources.luckyStone = (team.resources.luckyStone || 0) + 1;
    team.resources.burn = (team.resources.burn || 0) + 1;
    callouts.push({ name: 'LIGHT THE WAY!', color: '#66aa44', desc: `${f.name} — +1 Surge, +1 Lucky Stone, +1 Burn!`, team: teamName });
  }

  // Rascals (437) — Stampede: +3 Burn
  if (f.id === 437 && !f.ko) {
    team.resources.burn = (team.resources.burn || 0) + 3;
    callouts.push({ name: 'STAMPEDE!', color: '#888888', desc: `${f.name} — Entry! +3 Burn!`, team: teamName });
  }

  // Nicholas (51) — Sneak Attack: sideline deals 2 damage to entering enemy
  if (hasSideline(enemy, 51) && !f.ko && B.battleStarted) {
    wpDamage(f, 2);
    if (f.ko) f.killedBy = 51;
    callouts.push({ name: 'SNEAK ATTACK!', color: '#66aa44', desc: `Nicholas — 2 damage to ${f.name} on entry!`, team: enemyName });
    if (logFn) logFn(`Nicholas — Sneak Attack! 2 damage to ${f.name}!`);
  }

  // Tadpole (358) — Splash: gain 1 Surge
  if (f.id === 358) {
    team.resources.surge = (team.resources.surge || 0) + 1;
    callouts.push({ name: 'SPLASH!', color: '#888888', desc: `${f.name} — +1 Surge!`, team: teamName });
  }

  // Bramble (320) — Thorn Wall: opponent takes 1 damage next round
  if (f.id === 320) {
    // Prime thorn flag for next round's pre-roll
    if (!B.thornWall) B.thornWall = {};
    B.thornWall[teamName] = true;
    callouts.push({ name: 'THORN WALL!', color: '#888888', desc: `${f.name} — opponent takes 1 damage next round!`, team: teamName });
  }

  return callouts;
}

// ── PRE-ROLL CHIP DAMAGE ───────────────────────────────
// Fires before dice roll each round. Returns callouts array.
// Source: testroom2 index.html ~line 7688-8200

function triggerPreRoll(teamName, logFn) {
  if (!B) return [];
  const team = B[teamName];
  if (!team) return [];
  const f = activeGhost(team);
  if (!f || f.ko) return [];
  const enemyName = oppTeam(teamName);
  const enemy = B[enemyName];
  if (!enemy) return [];
  const ef = activeGhost(enemy);
  const callouts = [];

  // Guard: only fire once per turn
  if (B.preRollAbilitiesFiredThisTurn && B.preRollAbilitiesFiredThisTurn[teamName]) return [];
  if (!B.preRollAbilitiesFiredThisTurn) B.preRollAbilitiesFiredThisTurn = {};
  B.preRollAbilitiesFiredThisTurn[teamName] = true;

  // Dylan (301) — Scarecrow: blocks most pre-roll chip damage
  const dylanBlocks = ef && ef.id === 301 && !ef.ko;

  // Ember Force (304) — 1 damage before every roll
  if (f.id === 304 && ef && !ef.ko) {
    if (dylanBlocks) {
      callouts.push({ name: 'SCARECROW!', color: '#888888', desc: `Dylan blocks Ember Force!`, team: enemyName });
    } else if (!maskedHeroImmune(ef)) {
      wpDamage(ef, 1);
      if (ef.ko) ef.killedBy = f.id;
      callouts.push({ name: 'EMBER FORCE!', color: '#ff6644', desc: `${f.name} — 1 chip damage to ${ef.name}!`, team: teamName });
      if (logFn) logFn(`${f.name} — Ember Force! 1 damage to ${ef.name}!`);
    }
  }

  // Shade (111) — Shadow: 1 damage before every roll
  if (f.id === 111 && ef && !ef.ko) {
    // Piper (107) — negates Shade
    const piperNegates = hasSideline(enemy, 107) || (ef.id === 107 && !ef.ko);
    if (dylanBlocks) {
      callouts.push({ name: 'SCARECROW!', color: '#888888', desc: `Dylan blocks Shade's Shadow!`, team: enemyName });
    } else if (piperNegates) {
      callouts.push({ name: 'PIPER!', color: '#66aa44', desc: `Piper negates Shade's damage!`, team: enemyName });
    } else if (!maskedHeroImmune(ef)) {
      wpDamage(ef, 1);
      if (ef.ko) ef.killedBy = f.id;
      callouts.push({ name: 'SHADOW!', color: '#8866aa', desc: `${f.name} — 1 chip damage to ${ef.name}!`, team: teamName });
    }
  }

  // Shade's Shadow (205) — 1 damage if enemy <4 HP (from sideline)
  if (hasSideline(team, 205) && ef && !ef.ko && ef.hp < 4) {
    if (dylanBlocks) {
      callouts.push({ name: 'SCARECROW!', color: '#888888', desc: `Dylan blocks Shade's Shadow!`, team: enemyName });
    } else if (!maskedHeroImmune(ef)) {
      wpDamage(ef, 1);
      if (ef.ko) ef.killedBy = 205;
      callouts.push({ name: "SHADE'S SHADOW!", color: '#8866aa', desc: `Shade's Shadow — 1 damage to ${ef.name} (< 4 HP)!`, team: teamName });
    }
  }

  // Splinter (101) — Toxic Fumes: 1 damage after first win
  if (f.id === 101 && B.splinterActivated && B.splinterActivated[teamName] && ef && !ef.ko) {
    if (dylanBlocks) {
      callouts.push({ name: 'SCARECROW!', color: '#888888', desc: `Dylan blocks Splinter's Toxic Fumes!`, team: enemyName });
    } else if (!maskedHeroImmune(ef)) {
      wpDamage(ef, 1);
      if (ef.ko) ef.killedBy = f.id;
      callouts.push({ name: 'TOXIC FUMES!', color: '#66cc44', desc: `${f.name} — 1 chip damage to ${ef.name}!`, team: teamName });
    }
  }

  // Thorn Wall from Bramble (320) — 1 damage
  if (B.thornWall && B.thornWall[enemyName]) {
    if (!f.ko) {
      wpDamage(f, 1);
      if (f.ko) f.killedBy = 320;
      callouts.push({ name: 'THORN WALL!', color: '#888888', desc: `Bramble's thorns deal 1 damage to ${f.name}!`, team: enemyName });
    }
    delete B.thornWall[enemyName];
  }

  return callouts;
}

// ── DICE COUNT MODIFIERS ───────────────────────────────
// Calculate total dice for a team's roll (called before rolling)
// Returns the modified dice count

function calculateDiceCount(teamName) {
  if (!B) return 3;
  const team = B[teamName];
  if (!team) return 3;
  const f = activeGhost(team);
  if (!f) return 3;

  let count = 3; // base

  // Committed surge
  count += getCommittedExtraDice(teamName);

  // Talent bonus dice (World integration)
  if (typeof getTalentBonusDice === 'function') count += getTalentBonusDice();

  // Buff dice mod (fortune, meditation, etc.)
  if (typeof consumeBuffDiceMod === 'function') count += consumeBuffDiceMod();

  // Fortune bad dice
  if (typeof consumeFortuneBadDice === 'function') count += consumeFortuneBadDice();

  // Redd (98) — Notorious: +2 on first roll
  if (f.reddFirstRoll) { count += 2; f.reddFirstRoll = false; }

  // Maximo (302) — Nap: 1 die on first roll
  if (f.maximoFirstRoll) { count = 1; f.maximoFirstRoll = false; }

  // Dallas (60) — Quick Draw: steal 1 opponent die
  if (f.dallasQuickDraw && f.dallasQuickDraw > 0) {
    count += 1;
    f.dallasQuickDraw--;
  }

  // Retribution dice (from ability triggers)
  if (B.retributionDice && B.retributionDice[teamName]) {
    count += B.retributionDice[teamName];
    B.retributionDice[teamName] = 0;
  }

  // Cameron (25) bonus dice
  if (B.cameronBonusDice && B.cameronBonusDice[teamName]) {
    count += B.cameronBonusDice[teamName];
    B.cameronBonusDice[teamName] = 0;
  }

  // Haywire bonus
  if (B.haywireBonus && B.haywireBonus[teamName]) {
    count += B.haywireBonus[teamName];
    B.haywireBonus[teamName] = 0;
  }

  // Tyler Heat Up
  if (B.tylerHeatUpDieBonus && B.tylerHeatUpDieBonus[teamName]) {
    count += B.tylerHeatUpDieBonus[teamName];
    B.tylerHeatUpDieBonus[teamName] = 0;
  }

  // Frostbite penalty
  if (B.frostbiteDicePenalty && B.frostbiteDicePenalty[teamName]) {
    count -= B.frostbiteDicePenalty[teamName];
    B.frostbiteDicePenalty[teamName] = 0;
  }

  // Catchy Tune bonus
  if (B.catchyTuneDieBonus && B.catchyTuneDieBonus[teamName]) {
    count += B.catchyTuneDieBonus[teamName];
    B.catchyTuneDieBonus[teamName] = 0;
  }

  // Winston bonus
  if (B.winstonDiceBonus && B.winstonDiceBonus[teamName]) {
    count += B.winstonDiceBonus[teamName];
    B.winstonDiceBonus[teamName] = 0;
  }

  // Gordok bonus
  if (B.gordokDieBonus && B.gordokDieBonus[teamName]) {
    count += B.gordokDieBonus[teamName];
    B.gordokDieBonus[teamName] = 0;
  }

  // Foreman bonus
  if (B.foremanDieBonus && B.foremanDieBonus[teamName]) {
    count += B.foremanDieBonus[teamName];
    B.foremanDieBonus[teamName] = 0;
  }

  // Boo Teamwork debt
  if (B.booTeamworkDieDebt && B.booTeamworkDieDebt[teamName]) {
    count -= B.booTeamworkDieDebt[teamName];
    B.booTeamworkDieDebt[teamName] = 0;
  }

  // Pip die removal
  if (B.pipDieRemoval && B.pipDieRemoval[teamName]) {
    count -= B.pipDieRemoval[teamName];
    B.pipDieRemoval[teamName] = 0;
  }

  // Hex die removal
  if (B.hexDieRemoval && B.hexDieRemoval[teamName]) {
    count -= B.hexDieRemoval[teamName];
    B.hexDieRemoval[teamName] = 0;
  }

  // Fredrick (27) — caps opponent at 3 dice
  const oppName = oppTeam(teamName);
  const oppF = B[oppName] ? active(B[oppName]) : null;
  if (oppF && oppF.id === 27 && !oppF.ko && count > 3) {
    count = 3;
  }

  // Antoinette (82) — mirrors opponent's count upward
  if (f.id === 82 && !f.ko) {
    const oppCount = B.lastRollDiceCount ? B.lastRollDiceCount[oppName] || 3 : 3;
    if (oppCount > count) count = oppCount;
  }

  // Floor at 1
  return Math.max(1, count);
}

// ── WIN-PATH ABILITIES ─────────────────────────────────
// Called after damage is dealt on a winning roll.
// Returns callouts array.

function triggerWinPath(teamName, rollResult, logFn) {
  if (!B) return [];
  const team = B[teamName];
  if (!team) return [];
  const f = activeGhost(team);
  if (!f || f.ko) return [];
  const callouts = [];

  // Splinter (101) — activate Toxic Fumes after first win
  if (f.id === 101 && !B.splinterActivated[teamName]) {
    B.splinterActivated[teamName] = true;
    callouts.push({ name: 'TOXIC FUMES!', color: '#66cc44', desc: `${f.name} — Toxic Fumes activated! 1 chip damage each round!`, team: teamName });
  }

  // Dart (209) — Dart: +2 Surge on win
  if (f.id === 209) {
    team.resources.surge = (team.resources.surge || 0) + 2;
    callouts.push({ name: 'DART!', color: '#aa66ff', desc: `${f.name} — +2 Surge!`, team: teamName });
  }

  // Sacred Flame (336) — +1 Sacred Fire on win
  if (f.id === 336) {
    team.resources.fire = (team.resources.fire || 0) + 1;
    callouts.push({ name: 'SACRED FLAME!', color: '#ff6644', desc: `${f.name} — +1 Sacred Fire!`, team: teamName });
  }

  // Pudge (311) — +2 damage on doubles, but -1 HP self damage
  if (f.id === 311 && rollResult && rollResult.type === 'doubles') {
    // Extra damage already applied in resolve. Self-damage:
    wpDamage(f, 1);
    callouts.push({ name: 'PUDGE!', color: '#66aa44', desc: `${f.name} — +2 damage on doubles! Self: -1 HP.`, team: teamName });
  }

  // Timpleton (312) — Big Target: +3 damage if enemy HP > own
  if (f.id === 312) {
    const enemyName = oppTeam(teamName);
    const ef = B[enemyName] ? active(B[enemyName]) : null;
    if (ef && ef.hp > f.hp) {
      // Extra damage applied during resolve
      callouts.push({ name: 'BIG TARGET!', color: '#ff6644', desc: `${f.name} — +3 damage (enemy HP > yours)!`, team: teamName });
    }
  }

  // Farmer Jeff (314) — +1 Healing Seed per 6 rolled (sideline)
  if (hasSideline(team, 314)) {
    // Count 6s in the roll (would need dice array — simplified here)
    team.resources.healingSeed = (team.resources.healingSeed || 0) + 1;
    callouts.push({ name: 'FARMER JEFF!', color: '#66aa44', desc: `Farmer Jeff — +1 Healing Seed!`, team: teamName });
  }

  // Pow (Willpower card) — +2 damage for each 2 rolled
  if (B.wpPow && B.wpPow[teamName]) {
    // Damage bonus applied during resolve
    B.wpPow[teamName] = false;
  }

  return callouts;
}

// ── LOSS-PATH ABILITIES ────────────────────────────────

function triggerOnLoss(teamName, logFn) {
  if (!B) return [];
  const team = B[teamName];
  if (!team) return [];
  const f = activeGhost(team);
  if (!f || f.ko) return [];
  const callouts = [];

  // Willow (207) — Momentum: track loss for next-turn bonus
  if (hasSideline(team, 207)) {
    if (!B.willowLostLast) B.willowLostLast = {};
    B.willowLostLast[teamName] = true;
  }

  return callouts;
}

// ── DODGE MECHANICS ────────────────────────────────────

// Sylvia (313) — Roll 2d6, if result = 6 → dodge (take 0 damage)
function checkSylviaDodge(teamName) {
  if (!B) return false;
  const team = B[teamName];
  if (!team) return false;
  const f = activeGhost(team);
  if (!f || f.id !== 313 || f.ko) return false;

  const dodgeRoll = Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6) + 1;
  return dodgeRoll === 6;
}

// Fang (7) — Armed Dodge: when armed, dodge + swap out
function checkFangDodge(teamName) {
  if (!B) return false;
  const team = B[teamName];
  if (!team) return false;
  const f = activeGhost(team);
  if (!f || f.id !== 7 || f.ko) return false;
  return !!(B.fangUndercoverArmed && B.fangUndercoverArmed[teamName]);
}

// Puff — doubles/triples do -1 damage
function checkPuffReduction(teamName, rollType) {
  if (!B) return 0;
  const team = B[teamName];
  if (!team) return 0;
  const f = activeGhost(team);
  if (!f) return 0;
  // Check if Puff is active on defending team
  // Puff reduces incoming doubles/triples damage by 1
  if (f.id === 99 && !f.ko && (rollType === 'doubles' || rollType === 'triples')) {
    return 1;
  }
  return 0;
}

// ── DARK FANG (202) — Pressure Win Bonus ───────────────
// +1 damage for each KO'd ghost (both teams)

function getDarkFangBonus(teamName) {
  if (!B) return 0;
  const team = B[teamName];
  if (!team) return 0;
  const f = activeGhost(team);
  if (!f || f.id !== 202 || f.ko) return 0;
  const sides = B.red ? [B.red, B.blue] : [B.player, B.enemy];
  return sides.flatMap(s => s.ghosts).filter(g => g.ko).length;
}

// ── CALCULATE TOTAL DAMAGE ─────────────────────────────
// Full damage calculation with all modifiers

function calculateDamage(teamName, rollResult, dice) {
  if (!B || !rollResult) return 0;
  let dmg = rollResult.damage;

  // Committed resource bonuses
  dmg += getCommittedDamageBonus(teamName);

  // Dark Fang (202) KO scaling
  dmg += getDarkFangBonus(teamName);

  // Timpleton (312) — Big Target: +3 if enemy HP > own
  const team = B[teamName];
  const f = team ? active(team) : null;
  const oppName = oppTeam(teamName);
  const ef = B[oppName] ? active(B[oppName]) : null;
  if (f && f.id === 312 && ef && ef.hp > f.hp) dmg += 3;

  // Pudge (311) — +2 on doubles
  if (f && f.id === 311 && rollResult.type === 'doubles') dmg += 2;

  // Pow (Willpower card) — +2 per 2 rolled
  if (B.wpPow && B.wpPow[teamName] && dice) {
    const twos = dice.filter(d => d === 2).length;
    dmg += twos * 2;
  }

  // Bonanza (Willpower card)
  if (B.wpBonanza && B.wpBonanza[teamName]) {
    dmg += B.wpBonanza[teamName];
  }

  // Haywire damage bonus
  if (B.haywireDamageBonus && B.haywireDamageBonus[teamName]) {
    dmg += B.haywireDamageBonus[teamName];
    B.haywireDamageBonus[teamName] = 0;
  }

  // Equipment bonus (World integration)
  if (typeof G !== 'undefined' && G.equipped && G.equipped.weapon) {
    dmg += (G.equipped.weapon.bonusDamage || G.equipped.weapon.bonus || 0);
  }

  // Party blessing buff
  if (typeof G !== 'undefined' && G.activeBuffs) {
    if (G.activeBuffs.some(b => b.type === 'battleBlessing' && b.fights > 0)) dmg += 1;
  }

  return Math.max(1, dmg);
}

// ── CALCULATE DAMAGE REDUCTION ─────────────────────────

function calculateDamageReduction(teamName, rollResult) {
  if (!B) return 0;
  let reduction = 0;
  const team = B[teamName];
  const f = team ? active(team) : null;

  // Shell (Willpower card) — block 1 damage
  if (f && f.shellActive) {
    reduction += 1;
    f.shellActive = false;
  }

  // Puff reduction
  if (rollResult) {
    reduction += checkPuffReduction(teamName, rollResult.type);
  }

  // Equipment armor (World integration)
  if (typeof G !== 'undefined' && G.equipped && G.equipped.head) {
    reduction += (G.equipped.head.damageReduction || G.equipped.head.defense || 0);
  }

  // Party shield buff
  if (typeof G !== 'undefined' && G.activeBuffs) {
    if (G.activeBuffs.some(b => b.type === 'spiritShield' && b.fights > 0)) reduction += 1;
  }

  return reduction;
}
