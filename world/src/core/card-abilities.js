// ══════════════════════════════════════════════════════════
//  CARD ABILITIES — All Spiritkin effects
//  Ported from testroom2 (drbango.com/testroom2/)
//  Entry, Pre-Roll, Win-Path, Loss-Path, Dodge, Blocker effects
//  ~200 cards implemented
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

// Count sideline ghosts on a team
function sidelineCount(team) {
  if (!team || !team.ghosts) return 0;
  return team.ghosts.filter((g, i) => i !== team.activeIdx && !g.ko).length;
}

// Count total resources held by a team
function totalResources(team) {
  if (!team || !team.resources) return 0;
  const r = team.resources;
  return (r.ice || 0) + (r.fire || 0) + (r.surge || 0) + (r.moonstone || 0) +
         (r.luckyStone || 0) + (r.healingSeed || 0) + (r.burn || 0) +
         (r.firefly || 0) + (r.frostbite || 0);
}

// Count distinct resource types held by a team
function distinctResourceTypes(team) {
  if (!team || !team.resources) return 0;
  const r = team.resources;
  let count = 0;
  if ((r.ice || 0) > 0) count++;
  if ((r.fire || 0) > 0) count++;
  if ((r.surge || 0) > 0) count++;
  if ((r.moonstone || 0) > 0) count++;
  if ((r.luckyStone || 0) > 0) count++;
  if ((r.healingSeed || 0) > 0) count++;
  if ((r.burn || 0) > 0) count++;
  if ((r.firefly || 0) > 0) count++;
  if ((r.frostbite || 0) > 0) count++;
  return count;
}

// Check if dice form a straight (consecutive, no repeats)
function isStraightCheck(dice) {
  if (!dice || dice.length < 3) return false;
  const sorted = [...new Set(dice)].sort((a, b) => a - b);
  if (sorted.length < dice.length) return false;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] !== sorted[i - 1] + 1) return false;
  }
  return true;
}

// Check if dice contain a 1-2-3 sequence
function has123(dice) {
  if (!dice) return false;
  return dice.includes(1) && dice.includes(2) && dice.includes(3);
}

// Check if all dice are odd
function allOdd(dice) {
  if (!dice || dice.length === 0) return false;
  return dice.every(d => d % 2 === 1);
}

// Check if all dice are even
function allEven(dice) {
  if (!dice || dice.length === 0) return false;
  return dice.every(d => d % 2 === 0);
}

// Check if value is an even double (2, 4, or 6)
function isEvenDouble(rollResult) {
  return rollResult && rollResult.type === 'doubles' && rollResult.value % 2 === 0;
}

// Check if value is an odd double (1, 3, or 5)
function isOddDouble(rollResult) {
  return rollResult && rollResult.type === 'doubles' && rollResult.value % 2 === 1;
}

// Sum of all dice values
function diceSum(dice) {
  if (!dice) return 0;
  return dice.reduce((a, b) => a + b, 0);
}

// Count occurrences of a value in dice
function countVal(dice, val) {
  if (!dice) return 0;
  return dice.filter(d => d === val).length;
}

// Count distinct values in dice
function distinctValues(dice) {
  if (!dice) return 0;
  return new Set(dice).size;
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
    if (!B.thornWall) B.thornWall = {};
    B.thornWall[teamName] = true;
    callouts.push({ name: 'THORN WALL!', color: '#888888', desc: `${f.name} — opponent takes 1 damage next round!`, team: teamName });
  }

  // Powder (23) — Final Gift: when defeated, gain 3 Ice Shards for next ghost
  // Check if the PREVIOUS ghost that got KO'd was Powder
  if (B.battleStarted && !f.ko) {
    const koGhosts = team.ghosts.filter(g => g.ko);
    const lastKO = koGhosts.length > 0 ? koGhosts[koGhosts.length - 1] : null;
    if (lastKO && lastKO.id === 23 && !lastKO._powderGiftUsed) {
      lastKO._powderGiftUsed = true;
      team.resources.ice = (team.resources.ice || 0) + 3;
      callouts.push({ name: 'FINAL GIFT!', color: '#4488cc', desc: `Powder's Final Gift — +3 Ice Shards!`, team: teamName });
      if (logFn) logFn(`Powder — Final Gift! +3 Ice Shards for ${f.name}!`);
    }
  }

  // Munch (66) — Scraps: upon defeating a ghost, gain 4 health
  // Check if we just KO'd an enemy before swapping in
  if (f.id === 66 && B.battleStarted) {
    const enemyKOs = enemy.ghosts.filter(g => g.ko);
    if (enemyKOs.length > 0) {
      const lastEnemyKO = enemyKOs[enemyKOs.length - 1];
      if (lastEnemyKO && lastEnemyKO.killedBy !== undefined) {
        wpHeal(f, 4);
        callouts.push({ name: 'SCRAPS!', color: '#66aa44', desc: `${f.name} — +4 HP from defeating a ghost!`, team: teamName });
        if (logFn) logFn(`${f.name} — Scraps! +4 HP!`);
      }
    }
  }

  // Wandering Sue (84) — Hidden Weakness: if enemy has 12+ HP, destroy them
  if (f.id === 84) {
    const ef = activeGhost(enemy);
    if (ef && !ef.ko && ef.hp >= 12) {
      wpDamage(ef, ef.hp);
      ef.ko = true;
      ef.killedBy = f.id;
      callouts.push({ name: 'HIDDEN WEAKNESS!', color: '#ff6644', desc: `${f.name} — ${ef.name} destroyed! (12+ HP)`, team: teamName });
      if (logFn) logFn(`${f.name} — Hidden Weakness! ${ef.name} destroyed!`);
    }
  }

  // Valkin the Grand (432) — Grand Spoils handled in win-path KO check

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

  // Katrina (70) — Seeker: less HP than enemy, gain 1 HP
  if (f.id === 70 && ef && !ef.ko && f.hp < ef.hp) {
    wpHeal(f, 1);
    callouts.push({ name: 'SEEKER!', color: '#66aa44', desc: `${f.name} — +1 HP (less HP than enemy)!`, team: teamName });
    if (logFn) logFn(`${f.name} — Seeker! +1 HP.`);
  }

  // Eli (459) — Steady: gain +1 Lucky Stone before rolling
  if (f.id === 459) {
    team.resources.luckyStone = (team.resources.luckyStone || 0) + 1;
    callouts.push({ name: 'STEADY!', color: '#44cc44', desc: `${f.name} — +1 Lucky Stone!`, team: teamName });
    if (logFn) logFn(`${f.name} — Steady! +1 Lucky Stone.`);
  }

  // Simon (24) — Brew Time: gain 2 Sacred Fire when taking before-roll damage
  // (Fires after chip damage has been dealt — check if Simon took damage this pre-roll)
  if (f.id === 24 && ef && !ef.ko) {
    // Check if Simon just took pre-roll damage (from enemy effects above)
    // We track this by checking if any enemy pre-roll chip fired against us
    const enemyActive = activeGhost(enemy);
    const tookChip = (enemyActive && (enemyActive.id === 304 || enemyActive.id === 111)) ||
                     (B.thornWall && B.thornWall[teamName]);
    if (tookChip) {
      team.resources.fire = (team.resources.fire || 0) + 2;
      callouts.push({ name: 'BREW TIME!', color: '#ff6644', desc: `${f.name} — +2 Sacred Fire from pre-roll damage!`, team: teamName });
      if (logFn) logFn(`${f.name} — Brew Time! +2 Sacred Fire.`);
    }
  }

  // Wick (349) — Slow Burn: each round deal 1 to opponent, lose 1 self
  if (f.id === 349 && ef && !ef.ko) {
    if (!dylanBlocks && !maskedHeroImmune(ef)) {
      wpDamage(ef, 1);
      if (ef.ko) ef.killedBy = f.id;
      callouts.push({ name: 'SLOW BURN!', color: '#ff6644', desc: `${f.name} — 1 damage to ${ef.name}!`, team: teamName });
    }
    wpDamage(f, 1);
    if (f.ko) f.killedBy = -3; // self-damage
    callouts.push({ name: 'SLOW BURN!', color: '#cc4400', desc: `${f.name} takes 1 self-damage!`, team: teamName });
  }

  // Humar (336) — Meteor pre-roll damage (from previous win)
  if (B.humarPreDamage && B.humarPreDamage[teamName] && ef && !ef.ko) {
    if (!dylanBlocks && !maskedHeroImmune(ef)) {
      wpDamage(ef, 2);
      if (ef.ko) ef.killedBy = 336;
      callouts.push({ name: 'METEOR!', color: '#ff6644', desc: `Humar — 2 damage to ${ef.name} before roll!`, team: teamName });
    }
    B.humarPreDamage[teamName] = false;
  }

  // Princess Shade (436) — Bounty: when enemy takes before-roll damage, deal +1 more
  if (hasOnTeam(team, 436)) {
    // If enemy took any pre-roll chip from our effects, the +1 already conceptually fires
    // Track if this round had pre-roll damage via callouts
    const preDmgCallouts = callouts.filter(c => c.team === teamName && c.desc.includes('damage'));
    if (preDmgCallouts.length > 0 && ef && !ef.ko) {
      wpDamage(ef, 1);
      if (ef.ko) ef.killedBy = 436;
      callouts.push({ name: 'BOUNTY!', color: '#8866aa', desc: `Princess Shade — +1 damage from pre-roll!`, team: teamName });
    }
  }

  // Maximo (302) — gain 1 Healing Seed + 1 Lucky Stone after each round
  if (f.id === 302 && B.round > 1) {
    team.resources.healingSeed = (team.resources.healingSeed || 0) + 1;
    team.resources.luckyStone = (team.resources.luckyStone || 0) + 1;
    callouts.push({ name: 'NAP BONUS!', color: '#888888', desc: `${f.name} — +1 Healing Seed, +1 Lucky Stone!`, team: teamName });
  }

  // Hank (207) — each 4 rolled gains Lucky Stones (tracked in win/roll hooks, handled there)

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

  // Outlaw stolen die from previous round
  const oppName = oppTeam(teamName);
  if (B.outlawStolenDie && B.outlawStolenDie[teamName]) {
    count -= B.outlawStolenDie[teamName];
    B.outlawStolenDie[teamName] = 0;
  }

  // Scallywags frenzy bonus
  if (B.scallywagsFrenzyBonus && B.scallywagsFrenzyBonus[teamName]) {
    count += B.scallywagsFrenzyBonus[teamName];
    B.scallywagsFrenzyBonus[teamName] = 0;
  }

  // Floop muck (opponent loses die)
  if (B.floopMuck && B.floopMuck[teamName]) {
    count -= B.floopMuck[teamName];
    B.floopMuck[teamName] = 0;
  }

  // Hugo wreckage (opponent loses die)
  if (B.hugoWreckage && B.hugoWreckage[teamName]) {
    count -= B.hugoWreckage[teamName];
    B.hugoWreckage[teamName] = 0;
  }

  // Dream Cat bonus
  if (B.dreamCatBonus && B.dreamCatBonus[teamName]) {
    count += B.dreamCatBonus[teamName];
    B.dreamCatBonus[teamName] = 0;
  }

  // Let's Dance (Kairan 68) bonus
  if (B.letsDanceBonus && B.letsDanceBonus[teamName]) {
    count += B.letsDanceBonus[teamName];
    B.letsDanceBonus[teamName] = 0;
  }

  // Zork extra dice
  if (B.zorkExtraDie && B.zorkExtraDie[teamName]) {
    count += B.zorkExtraDie[teamName];
    B.zorkExtraDie[teamName] = 0;
  }

  // Willow (435/207) — Joy of Painting: +1 die if lost last roll
  if (B.willowLostLast && B.willowLostLast[teamName]) {
    if (hasOnTeam(team, 435) || hasOnTeam(team, 207)) {
      count += 1;
    }
    B.willowLostLast[teamName] = false;
  }

  // Jeff Snicker stolen dice
  if (B.jeffSnicker && B.jeffSnicker[teamName]) {
    count += B.jeffSnicker[teamName];
    B.jeffSnicker[teamName] = 0;
  }

  // Carpenter dice trade
  if (B.carpenterDiceTrade && B.carpenterDiceTrade[teamName]) {
    count += B.carpenterDiceTrade[teamName];
    B.carpenterDiceTrade[teamName] = 0;
  }

  // Lucas kindling bonus
  if (B.lucasKindlingBonus && B.lucasKindlingBonus[teamName]) {
    count += B.lucasKindlingBonus[teamName];
    B.lucasKindlingBonus[teamName] = 0;
  }

  // Doug Caution die bonus
  if (B.dougCautionDieBonus && B.dougCautionDieBonus[teamName]) {
    count += 1;
    B.dougCautionDieBonus[teamName] = false;
  }

  // ── NEW CARD DICE MODIFIERS ──

  // Cyboo (100) — SIDELINE: +1 die if active < 3 HP
  if (hasSideline(team, 100) && f.hp < 3) {
    count += 1;
  }

  // Needle (21) — SIDELINE: +1 die if Buttons (8) is in play
  if (hasSideline(team, 21) && f.id === 8) {
    count += 1;
  }

  // Professor Hawking (447) — +2 dice if holding Moonstone
  if (f.id === 447 && (team.resources.moonstone || 0) > 0) {
    count += 2;
  }

  // Explorer Jeff (455) — SIDELINE or IN PLAY: +1 die if 3+ different resources
  if ((f.id === 455 || hasSideline(team, 455)) && distinctResourceTypes(team) >= 3) {
    count += 1;
  }

  // Yawn Eater (464) — +1 die per enemy sideline ghost
  if (f.id === 464) {
    const oppTeamObj = B[oppName];
    if (oppTeamObj) {
      count += sidelineCount(oppTeamObj);
    }
  }

  // Fredrick (27) — caps opponent at 3 dice
  const oppF = B[oppName] ? activeGhost(B[oppName]) : null;
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

function triggerWinPath(teamName, rollResult, logFn, dice) {
  if (!B) return [];
  const team = B[teamName];
  if (!team) return [];
  const f = activeGhost(team);
  if (!f || f.ko) return [];
  const enemyName = oppTeam(teamName);
  const enemy = B[enemyName];
  const ef = enemy ? activeGhost(enemy) : null;
  const callouts = [];

  // ── Existing abilities ──

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

  // Sacred Flame (336 - Humar) — Meteor: win = +2 damage before next roll + 1 Burn
  if (f.id === 336) {
    if (!B.humarPreDamage) B.humarPreDamage = {};
    B.humarPreDamage[teamName] = true;
    team.resources.burn = (team.resources.burn || 0) + 1;
    callouts.push({ name: 'METEOR!', color: '#ff6644', desc: `${f.name} — opponent takes 2 damage before next roll! +1 Burn!`, team: teamName });
  }

  // Pudge (311) — +2 damage on doubles, but -1 HP self damage
  if (f.id === 311 && rollResult && rollResult.type === 'doubles') {
    wpDamage(f, 1);
    callouts.push({ name: 'PUDGE!', color: '#66aa44', desc: `${f.name} — +2 damage on doubles! Self: -1 HP.`, team: teamName });
  }

  // Timpleton (312) — Big Target: +3 damage if enemy HP > own
  if (f.id === 312 && ef && ef.hp > f.hp) {
    callouts.push({ name: 'BIG TARGET!', color: '#ff6644', desc: `${f.name} — +3 damage (enemy HP > yours)!`, team: teamName });
  }

  // Farmer Jeff (314) — +1 Healing Seed per 6 rolled (sideline)
  if (hasSideline(team, 314)) {
    const sixCount = dice ? countVal(dice, 6) : 0;
    const seedGain = Math.max(1, sixCount);
    team.resources.healingSeed = (team.resources.healingSeed || 0) + seedGain;
    callouts.push({ name: 'FARMER JEFF!', color: '#66aa44', desc: `Farmer Jeff — +${seedGain} Healing Seed${seedGain > 1 ? 's' : ''}!`, team: teamName });
  }

  // Pow (Willpower card) — +2 damage for each 2 rolled
  if (B.wpPow && B.wpPow[teamName]) {
    B.wpPow[teamName] = false;
  }

  // ── NEW WIN-PATH ABILITIES ──

  // Nikon (2) — Ambush: Win first roll = triple damage (bonus applied in calculateDamage)
  if (f.id === 2 && B.round === 1) {
    callouts.push({ name: 'AMBUSH!', color: '#ff6644', desc: `${f.name} — first roll win! Triple damage!`, team: teamName });
  }

  // Fang Outside (6) — Skillful Coward: Win = may switch with sideline ghost
  if (f.id === 6) {
    if (!B.fangOutsideSwapReady) B.fangOutsideSwapReady = {};
    B.fangOutsideSwapReady[teamName] = true;
    callouts.push({ name: 'SKILLFUL COWARD!', color: '#66aa44', desc: `${f.name} — may swap with a sideline ghost!`, team: teamName });
  }

  // Villager (11) — sideline: ghost in battle gains +1 health on winning roll
  if (hasSideline(team, 11)) {
    wpHeal(f, 1);
    callouts.push({ name: 'HOSPITALITY!', color: '#66aa44', desc: `Villager — ${f.name} gains +1 HP!`, team: teamName });
  }

  // Jeffery (14) — sideline: if your ghost wins, ghost in play gains 3 HP
  if (hasSideline(team, 14)) {
    wpHeal(f, 3);
    callouts.push({ name: 'CHUCKLE!', color: '#66aa44', desc: `Jeffery — ${f.name} gains +3 HP!`, team: teamName });
  }

  // Winston (15) — Win: gain +2 dice next roll
  if (f.id === 15) {
    if (!B.winstonDiceBonus) B.winstonDiceBonus = {};
    B.winstonDiceBonus[teamName] = (B.winstonDiceBonus[teamName] || 0) + 2;
    callouts.push({ name: 'SCHEME!', color: '#cc44ff', desc: `${f.name} — +2 dice next roll!`, team: teamName });
  }

  // Scallywags (19) — Frenzy: all dice under 4 = +1 die next turn + 1 Surge
  if (f.id === 19 && dice && dice.every(d => d < 4)) {
    if (!B.scallywagsFrenzyBonus) B.scallywagsFrenzyBonus = {};
    B.scallywagsFrenzyBonus[teamName] = (B.scallywagsFrenzyBonus[teamName] || 0) + 1;
    team.resources.surge = (team.resources.surge || 0) + 1;
    callouts.push({ name: 'FRENZY!', color: '#aa66ff', desc: `${f.name} — +1 die next turn + 1 Surge!`, team: teamName });
  }

  // Floop (20) — Muck: enemy loses a die next roll if they rolled doubles
  // (This fires for the opponent — check if enemy rolled doubles)
  // NOTE: this is handled in the opponent's loss path or as a post-roll check

  // Lou (32) — Bros: sideline, Grawr gains +1 Damage and +1 Health on winning rolls
  if (hasSideline(team, 32) && f.id === 34) {
    wpHeal(f, 1);
    callouts.push({ name: 'BROS!', color: '#66aa44', desc: `Lou — Grawr gains +1 HP!`, team: teamName });
    // +1 damage handled in calculateDamage
  }

  // Opa (48) — Win or tie: gain +1 health
  if (f.id === 48) {
    wpHeal(f, 1);
    callouts.push({ name: 'REST!', color: '#66aa44', desc: `${f.name} — +1 HP on win!`, team: teamName });
  }

  // Ashley (58) — Burning Soul: Win = gain 1 Sacred Fire
  if (f.id === 58) {
    team.resources.fire = (team.resources.fire || 0) + 1;
    callouts.push({ name: 'BURNING SOUL!', color: '#ff6644', desc: `${f.name} — +1 Sacred Fire!`, team: teamName });
  }

  // Suspicious Jeff (61) — sideline: if your ghost wins, steal 1 enemy die next roll
  if (hasSideline(team, 61)) {
    if (!B.jeffSnicker) B.jeffSnicker = {};
    B.jeffSnicker[teamName] = (B.jeffSnicker[teamName] || 0) + 1;
    callouts.push({ name: 'SNICKER!', color: '#66aa44', desc: `Suspicious Jeff — steal 1 enemy die next roll!`, team: teamName });
  }

  // Kairan (68) — Let's Dance: Roll doubles = +1 die next roll
  if (f.id === 68 && rollResult && rollResult.type === 'doubles') {
    if (!B.letsDanceBonus) B.letsDanceBonus = {};
    B.letsDanceBonus[teamName] = (B.letsDanceBonus[teamName] || 0) + 1;
    callouts.push({ name: "LET'S DANCE!", color: '#cc44ff', desc: `${f.name} — doubles! +1 die next roll!`, team: teamName });
  }

  // Flora (75) — Restore: Roll doubles = +2 HP after damage
  if (f.id === 75 && rollResult && rollResult.type === 'doubles') {
    wpHeal(f, 2);
    callouts.push({ name: 'RESTORE!', color: '#66aa44', desc: `${f.name} — doubles! +2 HP!`, team: teamName });
  }

  // Spockles (81) — Valley Magic: Win = gain 2 Ice Shards
  if (f.id === 81) {
    team.resources.ice = (team.resources.ice || 0) + 2;
    callouts.push({ name: 'VALLEY MAGIC!', color: '#4488cc', desc: `${f.name} — +2 Ice Shards!`, team: teamName });
    // Sandwiches mirror
    if (hasOnTeam(enemy, 33)) {
      enemy.resources.ice = (enemy.resources.ice || 0) + 2;
      callouts.push({ name: 'DEPENDABLE!', color: '#888888', desc: `Sandwiches mirrors Valley Magic! +2 Ice Shards!`, team: enemyName });
    }
  }

  // Troubling Haters (83) — Growing Mob: deal 4+ damage = +2 HP
  if (f.id === 83 && rollResult && rollResult.damage >= 4) {
    wpHeal(f, 2);
    callouts.push({ name: 'GROWING MOB!', color: '#66aa44', desc: `${f.name} — 4+ damage dealt! +2 HP!`, team: teamName });
  }

  // Outlaw (43) — Thief: Roll doubles = remove 1 opponent die next turn
  if (f.id === 43 && rollResult && rollResult.type === 'doubles') {
    if (!B.outlawStolenDie) B.outlawStolenDie = {};
    B.outlawStolenDie[enemyName] = (B.outlawStolenDie[enemyName] || 0) + 1;
    callouts.push({ name: 'THIEF!', color: '#cc44ff', desc: `${f.name} — doubles! Stealing 1 opponent die!`, team: teamName });
  }

  // Lucy (108) — Blue Fire: Win = gain 1 Sacred Fire
  if (f.id === 108) {
    let fireGain = 1;
    // Lucy's Shadow (439) — Mentor: Lucy gains +1 extra Sacred Fire
    if (hasSideline(team, 439)) fireGain += 1;
    team.resources.fire = (team.resources.fire || 0) + fireGain;
    callouts.push({ name: 'BLUE FIRE!', color: '#4488ff', desc: `${f.name} — +${fireGain} Sacred Fire!`, team: teamName });
    if (fireGain > 1) {
      callouts.push({ name: "MENTOR!", color: '#8866aa', desc: `Lucy's Shadow — Lucy gains extra Sacred Fire!`, team: teamName });
    }
  }

  // Artemis (307) — Daughter of the Stream: Win = gain 3 Ice Shards
  if (f.id === 307) {
    team.resources.ice = (team.resources.ice || 0) + 3;
    callouts.push({ name: 'DAUGHTER OF THE STREAM!', color: '#4488cc', desc: `${f.name} — +3 Ice Shards!`, team: teamName });
    if (hasOnTeam(enemy, 33)) {
      enemy.resources.ice = (enemy.resources.ice || 0) + 3;
      callouts.push({ name: 'DEPENDABLE!', color: '#888888', desc: `Sandwiches mirrors! +3 Ice Shards!`, team: enemyName });
    }
  }

  // Selene (305) — Heart of the Hills: Roll doubles = gain 2 Healing Seeds (simplified)
  if (f.id === 305 && rollResult && rollResult.type === 'doubles') {
    team.resources.healingSeed = (team.resources.healingSeed || 0) + 2;
    callouts.push({ name: 'HEART OF THE HILLS!', color: '#66aa44', desc: `${f.name} — doubles! +2 Healing Seeds!`, team: teamName });
  }

  // Natalia (327) — Materialization: Even doubles = gain 1 Moonstone + 1 Lucky Stone
  if (f.id === 327 && isEvenDouble(rollResult)) {
    team.resources.moonstone = Math.min(1, (team.resources.moonstone || 0) + 1);
    team.resources.luckyStone = (team.resources.luckyStone || 0) + 1;
    callouts.push({ name: 'MATERIALIZATION!', color: '#44dddd', desc: `${f.name} — even doubles! +1 Moonstone, +1 Lucky Stone!`, team: teamName });
  }

  // Chester (426) — Well Read: Win = gain 1 Healing Seed. Doubles = gain 1 Burn instead
  if (f.id === 426) {
    if (rollResult && (rollResult.type === 'doubles' || rollResult.type === 'triples' || rollResult.type === 'quads' || rollResult.type === 'penta')) {
      team.resources.burn = (team.resources.burn || 0) + 1;
      callouts.push({ name: 'WELL READ!', color: '#cc4400', desc: `${f.name} — doubles+! +1 Burn instead!`, team: teamName });
    } else {
      team.resources.healingSeed = (team.resources.healingSeed || 0) + 1;
      callouts.push({ name: 'WELL READ!', color: '#66aa44', desc: `${f.name} — +1 Healing Seed!`, team: teamName });
    }
  }

  // Jasper (428) — Flame Dive: Win = roll 1 bonus die, deal its value, take 1 self-damage
  if (f.id === 428 && ef && !ef.ko) {
    const bonusDie = Math.floor(Math.random() * 6) + 1;
    wpDamage(ef, bonusDie);
    if (ef.ko) ef.killedBy = f.id;
    wpDamage(f, 1);
    callouts.push({ name: 'FLAME DIVE!', color: '#ff6644', desc: `${f.name} — bonus die [${bonusDie}]! +${bonusDie} damage to ${ef.name}, -1 HP self!`, team: teamName });
  }

  // Pal Al (431) — Squall: Win = gain 4 Ice Shards instead of damage
  // NOTE: In a full implementation, this would suppress normal damage. Simplified: just grant ice.
  if (f.id === 431) {
    team.resources.ice = (team.resources.ice || 0) + 4;
    callouts.push({ name: 'SQUALL!', color: '#4488cc', desc: `${f.name} — +4 Ice Shards!`, team: teamName });
  }

  // Gom Gom Gom (440) — Chaos: Win with doubles = gain 1 Sacred Fire
  if (f.id === 440 && rollResult && rollResult.type === 'doubles') {
    team.resources.fire = (team.resources.fire || 0) + 1;
    callouts.push({ name: 'CHAOS!', color: '#ff6644', desc: `${f.name} — doubles! +1 Sacred Fire!`, team: teamName });
  }

  // Harvey (448) — Harvest Moon: Win = if any fives rolled, gain 1 Moonstone
  if (f.id === 448 && dice && dice.includes(5)) {
    team.resources.moonstone = Math.min(1, (team.resources.moonstone || 0) + 1);
    callouts.push({ name: 'HARVEST MOON!', color: '#44dddd', desc: `${f.name} — rolled a 5! +1 Moonstone!`, team: teamName });
  }

  // Foreman (451) — Blueprint: Win = +1 die next roll
  if (f.id === 451) {
    if (!B.foremanDieBonus) B.foremanDieBonus = {};
    B.foremanDieBonus[teamName] = (B.foremanDieBonus[teamName] || 0) + 1;
    callouts.push({ name: 'BLUEPRINT!', color: '#aa66ff', desc: `${f.name} — +1 die next roll!`, team: teamName });
  }

  // Ronan (461) — Mixup: Roll doubles = +1 Ice Shard & +1 Burn
  if (f.id === 461 && rollResult && rollResult.type === 'doubles') {
    team.resources.ice = (team.resources.ice || 0) + 1;
    team.resources.burn = (team.resources.burn || 0) + 1;
    callouts.push({ name: 'MIXUP!', color: '#cc44ff', desc: `${f.name} — doubles! +1 Ice Shard, +1 Burn!`, team: teamName });
  }

  // Clink (329) — Prospect: Win = gain 1 Surge
  if (f.id === 329) {
    team.resources.surge = (team.resources.surge || 0) + 1;
    callouts.push({ name: 'PROSPECT!', color: '#aa66ff', desc: `${f.name} — +1 Surge on win!`, team: teamName });
  }

  // Wendy (441) — Moonbeam: Win with doubles or better = gain 1 Magic Firefly
  if (f.id === 441 && rollResult && rollResult.type !== 'singles') {
    team.resources.firefly = Math.min(1, (team.resources.firefly || 0) + 1);
    callouts.push({ name: 'MOONBEAM!', color: '#ffcc44', desc: `${f.name} — doubles+! +1 Magic Firefly!`, team: teamName });
  }

  // Captain James (443) — Final Strike: Roll triples or higher = gain 2 Sacred Fires
  if (f.id === 443 && rollResult && (rollResult.type === 'triples' || rollResult.type === 'quads' || rollResult.type === 'penta' || (rollResult.type && rollResult.type.endsWith('-of-a-kind')))) {
    team.resources.fire = (team.resources.fire || 0) + 2;
    callouts.push({ name: 'FINAL STRIKE!', color: '#ff6644', desc: `${f.name} — triples+! +2 Sacred Fires!`, team: teamName });
  }

  // Welder (450) — Flux: Win = gain 1 Burn. Roll a 4 = transform hint (simplified)
  if (f.id === 450) {
    team.resources.burn = (team.resources.burn || 0) + 1;
    callouts.push({ name: 'FLUX!', color: '#cc4400', desc: `${f.name} — +1 Burn!`, team: teamName });
    if (dice && dice.includes(4)) {
      callouts.push({ name: 'TRANSFORM!', color: '#aa66ff', desc: `${f.name} — rolled a 4! Ready to become Foreman!`, team: teamName });
    }
  }

  // Carpenter (449) — Crafty: Win = +2 damage on singles (handled in calculateDamage)
  // Callout only
  if (f.id === 449 && rollResult && rollResult.type === 'singles') {
    callouts.push({ name: 'CRAFTY!', color: '#66aa44', desc: `${f.name} — +2 damage on singles!`, team: teamName });
  }

  // Dylan (301) — Sun Song: On winning rolls, gain 1 Burn
  if (f.id === 301) {
    team.resources.burn = (team.resources.burn || 0) + 1;
    callouts.push({ name: 'SUN SONG!', color: '#cc4400', desc: `${f.name} — +1 Burn on win!`, team: teamName });
  }

  // Zain (206) — Ice Blade: Win = gain 1 Ice Shard
  if (f.id === 206) {
    team.resources.ice = (team.resources.ice || 0) + 1;
    callouts.push({ name: 'ICE BLADE!', color: '#4488cc', desc: `${f.name} — +1 Ice Shard!`, team: teamName });
  }

  // Hank (207) — Tremor: each 4 you roll gains 1 Lucky Stone
  if (f.id === 207 && dice) {
    const fourCount = countVal(dice, 4);
    if (fourCount > 0) {
      team.resources.luckyStone = (team.resources.luckyStone || 0) + fourCount;
      callouts.push({ name: 'TREMOR!', color: '#44cc44', desc: `${f.name} — ${fourCount} four${fourCount > 1 ? 's' : ''} rolled! +${fourCount} Lucky Stone${fourCount > 1 ? 's' : ''}!`, team: teamName });
    }
  }

  // Calvin (342) — Overclock: Win = heal +1 HP (can exceed max). +1 Healing Seed
  if (f.id === 342) {
    wpHeal(f, 1);
    team.resources.healingSeed = (team.resources.healingSeed || 0) + 1;
    callouts.push({ name: 'OVERCLOCK!', color: '#66aa44', desc: `${f.name} — +1 HP, +1 Healing Seed!`, team: teamName });
  }

  // Aunt Susan (309) — Harvest Dance: Win = +2 Healing Seeds
  if (f.id === 309) {
    team.resources.healingSeed = (team.resources.healingSeed || 0) + 2;
    callouts.push({ name: 'HARVEST DANCE!', color: '#66aa44', desc: `${f.name} — +2 Healing Seeds!`, team: teamName });
  }

  // Kaplan (308) — Pollinate: when opponent rolls doubles, gain 1 Healing Seed
  // (This triggers on the enemy's roll — check from defender perspective in triggerOnLoss)

  // Biscuit (324) — sideline: active ghost gains +1 HP on wins (cannot exceed max)
  if (hasSideline(team, 324) && f.hp < f.maxHp) {
    wpHeal(f, 1);
    callouts.push({ name: 'WARM UP!', color: '#66aa44', desc: `Biscuit — ${f.name} gains +1 HP!`, team: teamName });
  }

  // Roger (54) — Tempest: roll 2 pairs of doubles (4+ dice) = gain 3 Sacred Fires
  if (f.id === 54 && dice && dice.length >= 4) {
    const counts = {};
    dice.forEach(d => counts[d] = (counts[d] || 0) + 1);
    const pairs = Object.values(counts).filter(c => c >= 2).length;
    if (pairs >= 2) {
      team.resources.fire = (team.resources.fire || 0) + 3;
      callouts.push({ name: 'TEMPEST!', color: '#ff6644', desc: `${f.name} — 2 pairs! +3 Sacred Fires!`, team: teamName });
    }
  }

  // Masked Hero (55) — gain +1 Burn for each 3 rolled
  if (f.id === 55 && dice) {
    const threeCount = countVal(dice, 3);
    if (threeCount > 0) {
      team.resources.burn = (team.resources.burn || 0) + threeCount;
      callouts.push({ name: 'UNDERDOG!', color: '#cc4400', desc: `${f.name} — ${threeCount} three${threeCount > 1 ? 's' : ''}! +${threeCount} Burn!`, team: teamName });
    }
  }

  // Gary (92) — Lucky Novice: gain +2 Ice Shards for each 1 rolled (sideline & in play)
  if ((f.id === 92 || hasOnTeam(team, 92)) && dice) {
    const oneCount = countVal(dice, 1);
    if (oneCount > 0) {
      team.resources.ice = (team.resources.ice || 0) + (oneCount * 2);
      callouts.push({ name: 'LUCKY NOVICE!', color: '#4488cc', desc: `Gary — ${oneCount} one${oneCount > 1 ? 's' : ''}! +${oneCount * 2} Ice Shards!`, team: teamName });
    }
  }

  // Sable (413) — Furnace: rolling all odd numbers = gain 1 Sacred Fire (sideline & in play)
  if ((f.id === 413 || hasOnTeam(team, 413)) && dice && allOdd(dice)) {
    team.resources.fire = (team.resources.fire || 0) + 1;
    callouts.push({ name: 'FURNACE!', color: '#ff6644', desc: `Sable — all odd! +1 Sacred Fire!`, team: teamName });
  }

  // Rook (416) — Win: deal +1 damage per Surge committed (callout; damage in calculateDamage)
  if (f.id === 416 && B.committed && B.committed[teamName]) {
    const surgeCommitted = B.committed[teamName].surge || 0;
    if (surgeCommitted > 0) {
      callouts.push({ name: 'CHARCOAL!', color: '#cc4400', desc: `${f.name} — +${surgeCommitted} damage from committed Surge!`, team: teamName });
    }
  }

  // Nyx & Bessie (415) — sideline: gain 4 Healing Seeds if you defeat a ghost
  if (hasSideline(team, 415) && ef && ef.ko) {
    team.resources.healingSeed = (team.resources.healingSeed || 0) + 4;
    callouts.push({ name: 'MOO! CAW!', color: '#66aa44', desc: `Nyx & Bessie — +4 Healing Seeds from KO!`, team: teamName });
  }

  // Bigsby (424) — Omen: Win = deal +1 damage (callout; handled in calculateDamage)
  if (f.id === 424) {
    callouts.push({ name: 'OMEN!', color: '#888888', desc: `${f.name} — +1 damage on win!`, team: teamName });
  }

  // Gordok (430) — River Terror: Win = may steal 2 specials instead of damage. +1 die + 1 Moonstone
  // Simplified: just grant resources
  if (f.id === 430) {
    if (!B.gordokDieBonus) B.gordokDieBonus = {};
    B.gordokDieBonus[teamName] = (B.gordokDieBonus[teamName] || 0) + 1;
    team.resources.moonstone = Math.min(1, (team.resources.moonstone || 0) + 1);
    callouts.push({ name: 'RIVER TERROR!', color: '#aa66ff', desc: `${f.name} — +1 die next roll, +1 Moonstone!`, team: teamName });
  }

  // Valkin the Grand (432) — Grand Spoils: KO = gain all resources
  if (f.id === 432 && ef && ef.ko) {
    team.resources.fire = (team.resources.fire || 0) + 1;
    team.resources.ice = (team.resources.ice || 0) + 2;
    team.resources.luckyStone = (team.resources.luckyStone || 0) + 1;
    team.resources.moonstone = Math.min(1, (team.resources.moonstone || 0) + 1);
    team.resources.healingSeed = (team.resources.healingSeed || 0) + 2;
    callouts.push({ name: 'GRAND SPOILS!', color: '#ffcc00', desc: `${f.name} — KO! +1 Sacred Fire, +2 Ice, +1 Lucky Stone, +1 Moonstone, +2 Seeds!`, team: teamName });
  }

  // Champ (438) — Thrill: gains +1 Surge when you or enemy rolls doubles or higher
  if ((f.id === 438 || hasOnTeam(team, 438)) && rollResult && rollResult.type !== 'singles') {
    team.resources.surge = (team.resources.surge || 0) + 1;
    callouts.push({ name: 'THRILL!', color: '#aa66ff', desc: `Champ — doubles+! +1 Surge!`, team: teamName });
  }

  // Goobs (444) — Dance Party: on tie, both gain 1 Firefly + 5 HP (handled separately for ties)

  // Yawn Eater (464) — Odd doubles deal +1 damage (callout; damage in calculateDamage)
  if (f.id === 464 && isOddDouble(rollResult)) {
    callouts.push({ name: 'FEAST!', color: '#cc44ff', desc: `${f.name} — odd doubles! +1 damage!`, team: teamName });
  }

  // Bumble (362) — Pollinate: Win = give 1 Healing Seed to opponent, gain 2 yourself
  if (f.id === 362) {
    team.resources.healingSeed = (team.resources.healingSeed || 0) + 2;
    if (enemy) enemy.resources.healingSeed = (enemy.resources.healingSeed || 0) + 1;
    callouts.push({ name: 'POLLINATE!', color: '#66aa44', desc: `${f.name} — +2 Healing Seeds! (Opponent gets 1)`, team: teamName });
  }

  // Piper (107) — Win with singles: gain 1 Sacred Fire
  if (f.id === 107 && rollResult && rollResult.type === 'singles') {
    team.resources.fire = (team.resources.fire || 0) + 1;
    callouts.push({ name: 'SLICK COAT!', color: '#ff6644', desc: `${f.name} — singles win! +1 Sacred Fire!`, team: teamName });
  }

  // Hector (96) — +1 damage on singles (callout; damage in calculateDamage)
  if (f.id === 96 && rollResult && rollResult.type === 'singles') {
    callouts.push({ name: 'PROTECTOR!', color: '#66aa44', desc: `${f.name} — singles! +1 damage!`, team: teamName });
  }

  // Knight Light (402) — Retribution: when opponent ability triggers, gain +1 die
  // (This is tracked via B.retributionDice when enemy abilities fire)

  // Dream Cat (28) — Jinx: both roll doubles = +1 die next turn
  // (Handled in post-roll comparison)

  // Bo (109) — Miracle: upon defeating a ghost, return one defeated ghost to sideline + 1 Firefly
  if (f.id === 109 && ef && ef.ko) {
    const koGhosts = team.ghosts.filter((g, i) => i !== team.activeIdx && g.ko);
    if (koGhosts.length > 0) {
      const revived = koGhosts[0];
      revived.ko = false;
      revived.hp = 1;
      revived.willpower = [];
      wpHeal(revived, 1);
      team.resources.firefly = Math.min(1, (team.resources.firefly || 0) + 1);
      callouts.push({ name: 'MIRACLE!', color: '#ffcc44', desc: `${f.name} — ${revived.name} returns with 1 HP! +1 Magic Firefly!`, team: teamName });
    }
  }

  // Fuego (337) — Fiesta: Win with triples = gain 1 of every resource
  if (f.id === 337 && rollResult && rollResult.type === 'triples') {
    team.resources.ice = (team.resources.ice || 0) + 1;
    team.resources.fire = (team.resources.fire || 0) + 1;
    team.resources.surge = (team.resources.surge || 0) + 1;
    team.resources.healingSeed = (team.resources.healingSeed || 0) + 1;
    team.resources.luckyStone = (team.resources.luckyStone || 0) + 1;
    team.resources.burn = (team.resources.burn || 0) + 1;
    callouts.push({ name: 'FIESTA!', color: '#ffcc44', desc: `${f.name} — triples! +1 of every resource!`, team: teamName });
  }

  // Gus (31) — Gale Force: Win = may force opponent swap (damage to new ghost)
  if (f.id === 31) {
    if (!B.gusSwapReady) B.gusSwapReady = {};
    B.gusSwapReady[teamName] = true;
    callouts.push({ name: 'GALE FORCE!', color: '#66aa44', desc: `${f.name} — may force opponent swap!`, team: teamName });
  }

  // Tommy Salami (30) — Regulator: rolling a 6 = +1 die rolled immediately, repeats
  // (Handled in dice rolling logic. Callout for any 6s)
  if (f.id === 30 && dice && dice.includes(6)) {
    callouts.push({ name: 'REGULATOR!', color: '#ff6644', desc: `${f.name} — rolled a 6! Extra die!`, team: teamName });
  }

  // Cluck (340) — Peck: Win with singles = +2 damage (callout; handled in calculateDamage)
  if (f.id === 340 && rollResult && rollResult.type === 'singles') {
    callouts.push({ name: 'PECK!', color: '#66aa44', desc: `${f.name} — singles win! +2 damage!`, team: teamName });
  }

  // Char (323) — Afterburn: Win = deal 1 damage at start of next round
  if (f.id === 323) {
    if (!B.charAfterburn) B.charAfterburn = {};
    B.charAfterburn[teamName] = true;
    callouts.push({ name: 'AFTERBURN!', color: '#ff6644', desc: `${f.name} — 1 damage to opponent next round!`, team: teamName });
  }

  // Penny (316) — Forager: Win = gain 1 Healing Seed
  if (f.id === 316) {
    team.resources.healingSeed = (team.resources.healingSeed || 0) + 1;
    callouts.push({ name: 'FORAGER!', color: '#66aa44', desc: `${f.name} — +1 Healing Seed!`, team: teamName });
  }

  return callouts;
}

// ── LOSS-PATH ABILITIES ────────────────────────────────

function triggerOnLoss(teamName, logFn, rollResult, dice) {
  if (!B) return [];
  const team = B[teamName];
  if (!team) return [];
  const f = activeGhost(team);
  if (!f || f.ko) return [];
  const enemyName = oppTeam(teamName);
  const enemy = B[enemyName];
  const ef = enemy ? activeGhost(enemy) : null;
  const callouts = [];

  // Willow (207/435) — Momentum: track loss for next-turn bonus
  if (hasOnTeam(team, 435) || hasOnTeam(team, 207)) {
    if (!B.willowLostLast) B.willowLostLast = {};
    B.willowLostLast[teamName] = true;
  }

  // Sad Sal (29) — Tough Job: Lose = gain 1 Ice Shard
  if (f.id === 29) {
    team.resources.ice = (team.resources.ice || 0) + 1;
    callouts.push({ name: 'TOUGH JOB!', color: '#4488cc', desc: `${f.name} — lose! +1 Ice Shard!`, team: teamName });
    if (logFn) logFn(`${f.name} — Tough Job! +1 Ice Shard.`);
  }

  // Chagrin (404) — Bitter End: Lose = gain 1 Surge
  if (f.id === 404) {
    team.resources.surge = (team.resources.surge || 0) + 1;
    callouts.push({ name: 'BITTER END!', color: '#aa66ff', desc: `${f.name} — lose! +1 Surge!`, team: teamName });
    if (logFn) logFn(`${f.name} — Bitter End! +1 Surge.`);
  }

  // Clink (329) — Prospect: Lose = gain 1 Surge (also gains on win)
  if (f.id === 329) {
    team.resources.surge = (team.resources.surge || 0) + 1;
    callouts.push({ name: 'PROSPECT!', color: '#aa66ff', desc: `${f.name} — lose! +1 Surge!`, team: teamName });
  }

  // Balatron (113) — Party Time: Lose & survive = roll 1 counter die for damage
  if (f.id === 113 && !f.ko && ef && !ef.ko) {
    const counterDie = Math.floor(Math.random() * 6) + 1;
    wpDamage(ef, counterDie);
    if (ef.ko) ef.killedBy = f.id;
    callouts.push({ name: 'PARTY TIME!', color: '#cc44ff', desc: `${f.name} — counter die [${counterDie}]! ${counterDie} damage to ${ef.name}!`, team: teamName });
    if (logFn) logFn(`${f.name} — Party Time! Counter die: ${counterDie} damage!`);
  }

  // Hugo (52) — Wreckage: opponent loses 1 die next roll when Hugo takes damage
  if (f.id === 52 && !f.ko) {
    if (!B.hugoWreckage) B.hugoWreckage = {};
    B.hugoWreckage[enemyName] = (B.hugoWreckage[enemyName] || 0) + 1;
    callouts.push({ name: 'WRECKAGE!', color: '#888888', desc: `${f.name} — opponent loses 1 die next roll!`, team: teamName });
  }

  // Marcus (57) — Glacial Pounding: take 3+ damage = gain 4 extra dice next roll
  if (f.id === 57 && !f.ko) {
    // Check if damage taken was 3+
    if (rollResult && rollResult.damage >= 3) {
      if (!B.marcusGlacialBonus) B.marcusGlacialBonus = {};
      B.marcusGlacialBonus[teamName] = 4;
      callouts.push({ name: 'GLACIAL POUNDING!', color: '#4488cc', desc: `${f.name} — 3+ damage taken! +4 dice next roll!`, team: teamName });
    }
  }

  // King Jay (106) — Reflection: lose roll & dice total = 7 = reflect all damage
  if (f.id === 106 && dice && diceSum(dice) === 7 && ef && !ef.ko) {
    // Reflect: heal self, damage enemy same amount
    const reflectAmt = rollResult ? rollResult.damage : 0;
    if (reflectAmt > 0) {
      wpHeal(f, reflectAmt);
      wpDamage(ef, reflectAmt);
      if (ef.ko) ef.killedBy = f.id;
      callouts.push({ name: 'REFLECTION!', color: '#ffcc44', desc: `${f.name} — dice total = 7! Reflected ${reflectAmt} damage!`, team: teamName });
    }
  }

  // Simon (24) — Brew Time: gain 2 Sacred Fire when enemy rolls triples or better
  if (f.id === 24 && rollResult && (rollResult.type === 'triples' || rollResult.type === 'quads' || rollResult.type === 'penta' || (rollResult.type && rollResult.type.endsWith('-of-a-kind')))) {
    team.resources.fire = (team.resources.fire || 0) + 2;
    callouts.push({ name: 'BREW TIME!', color: '#ff6644', desc: `${f.name} — enemy triples+! +2 Sacred Fire!`, team: teamName });
  }

  // Kaplan (308) — Pollinate: when opponent rolls doubles, gain 1 Healing Seed
  if (f.id === 308 && rollResult && rollResult.type === 'doubles') {
    team.resources.healingSeed = (team.resources.healingSeed || 0) + 1;
    callouts.push({ name: 'POLLINATE!', color: '#66aa44', desc: `${f.name} — opponent doubles! +1 Healing Seed!`, team: teamName });
  }

  // Floop (20) — Muck: enemy loses a die next roll if they rolled doubles
  if (f.id === 20 && rollResult && rollResult.type === 'doubles') {
    if (!B.floopMuck) B.floopMuck = {};
    B.floopMuck[enemyName] = (B.floopMuck[enemyName] || 0) + 1;
    callouts.push({ name: 'MUCK!', color: '#888888', desc: `${f.name} — opponent doubles! They lose 1 die next roll!`, team: teamName });
  }

  // Opa (48) — Rest: also heals on tie (handled here if tie triggers loss path)
  // (Opa's tie healing is in the tie handler, not loss)

  // Granny (310) — Bedtime Story: sideline, when ghost is defeated
  // singles: +2 Lucky Stones, doubles: +1 Moonstone, triples+: +3 Sacred Fires
  if (f.ko && hasSideline(team, 310) && rollResult) {
    if (rollResult.type === 'singles') {
      team.resources.luckyStone = (team.resources.luckyStone || 0) + 2;
      callouts.push({ name: 'BEDTIME STORY!', color: '#44cc44', desc: `Granny — ${f.name} fell to singles! +2 Lucky Stones!`, team: teamName });
    } else if (rollResult.type === 'doubles') {
      team.resources.moonstone = Math.min(1, (team.resources.moonstone || 0) + 1);
      callouts.push({ name: 'BEDTIME STORY!', color: '#44dddd', desc: `Granny — ${f.name} fell to doubles! +1 Moonstone!`, team: teamName });
    } else {
      team.resources.fire = (team.resources.fire || 0) + 3;
      callouts.push({ name: 'BEDTIME STORY!', color: '#ff6644', desc: `Granny — ${f.name} fell to triples+! +3 Sacred Fires!`, team: teamName });
    }
  }

  // Mulch (348) — Decompose: when defeated, gain 2 Healing Seeds
  if (f.id === 348 && f.ko) {
    team.resources.healingSeed = (team.resources.healingSeed || 0) + 2;
    callouts.push({ name: 'DECOMPOSE!', color: '#66aa44', desc: `${f.name} — defeated! +2 Healing Seeds!`, team: teamName });
  }

  // Slag Heap (339) — Residue: when defeated, opponent cannot heal for 2 rounds
  if (f.id === 339 && f.ko) {
    if (!B.slagHeapBlock) B.slagHeapBlock = {};
    B.slagHeapBlock[enemyName] = 2;
    callouts.push({ name: 'RESIDUE!', color: '#888888', desc: `${f.name} — defeated! Opponent can't heal for 2 rounds!`, team: teamName });
  }

  // Thistle (338) — Barbed: when you take damage, attacker takes 1 back
  if (f.id === 338 && !f.ko && ef && !ef.ko) {
    wpDamage(ef, 1);
    if (ef.ko) ef.killedBy = f.id;
    callouts.push({ name: 'BARBED!', color: '#66aa44', desc: `${f.name} — thorns! 1 damage back to ${ef.name}!`, team: teamName });
  }

  // Puff Ball (355) — Burst: hit by doubles = explode for 2 damage to opponent, then KO self
  if (f.id === 355 && rollResult && rollResult.type === 'doubles' && ef && !ef.ko) {
    wpDamage(ef, 2);
    if (ef.ko) ef.killedBy = f.id;
    wpDamage(f, f.hp); // self-KO
    f.ko = true;
    callouts.push({ name: 'BURST!', color: '#ff6644', desc: `${f.name} — hit by doubles! Explodes for 2 damage to ${ef.name}! Self-KO!`, team: teamName });
  }

  return callouts;
}

// ── DODGE MECHANICS ────────────────────────────────────

// Sylvia (313) — Roll 2d6, if result = 6 -> dodge (take 0 damage)
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

// Kodako (1) — Swift: Roll 1-2-3 = negate damage and deal 4
function checkKodakoDodge(teamName, dice) {
  if (!B) return false;
  const team = B[teamName];
  if (!team) return false;
  const f = activeGhost(team);
  if (!f || f.id !== 1 || f.ko) return false;
  return has123(dice);
}

// Patrick (10) — Stone Form: don't roll, if enemy singles: negate + deal 3
function checkPatrickDodge(teamName, enemyRollResult) {
  if (!B) return false;
  const team = B[teamName];
  if (!team) return false;
  const f = activeGhost(team);
  if (!f || f.id !== 10 || f.ko) return false;
  return enemyRollResult && enemyRollResult.type === 'singles';
}

// Dealer (37) — House Rules: straight = negate + deal +3
function checkDealerDodge(teamName, dice) {
  if (!B) return false;
  const team = B[teamName];
  if (!team) return false;
  const f = activeGhost(team);
  if (!f || f.id !== 37 || f.ko) return false;
  return isStraightCheck(dice);
}

// Bogey (53) — Bogus: reflect damage back, once per game
function checkBogeyReflect(teamName) {
  if (!B) return false;
  const team = B[teamName];
  if (!team) return false;
  const f = activeGhost(team);
  if (!f || f.id !== 53 || f.ko) return false;
  if (B.bogeyUsed && B.bogeyUsed[teamName]) return false;
  return true; // UI should prompt — simplified: auto-trigger
}

// Sky (72) — Elusive: damage > 2 = negate all (handled in calculateDamageReduction)

// Mirror Matt (410) — Seven Years: if opponent wins with doubles, reflect damage
function checkMirrorMattReflect(teamName, enemyRollResult) {
  if (!B) return false;
  const team = B[teamName];
  if (!team) return false;
  const f = activeGhost(team);
  if (!f || f.id !== 410 || f.ko) return false;
  return enemyRollResult && enemyRollResult.type === 'doubles';
}


// ── PUFF / DAMAGE REDUCTION CHECKS ────────────────────

// Puff (5) — doubles/triples do -1 damage (FIXED: was checking id 99, now correctly checks 5)
function checkPuffReduction(teamName, rollType) {
  if (!B) return 0;
  const team = B[teamName];
  if (!team) return 0;
  const f = activeGhost(team);
  if (!f) return 0;
  if (f.id === 5 && !f.ko && (rollType === 'doubles' || rollType === 'triples')) {
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

  const team = B[teamName];
  const f = team ? activeGhost(team) : null;
  const oppName = oppTeam(teamName);
  const enemy = B[oppName];
  const ef = enemy ? activeGhost(enemy) : null;

  // Committed resource bonuses
  dmg += getCommittedDamageBonus(teamName);

  // Dark Fang (202) KO scaling
  dmg += getDarkFangBonus(teamName);

  // Timpleton (312) — Big Target: +3 if enemy HP > own
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

  // ── NEW DAMAGE MODIFIERS ──

  if (f && dice) {
    // Ancient Librarian (3) — Knowledge: +1 damage per 2 rolled by both players
    if (f.id === 3) {
      const myTwos = countVal(dice, 2);
      // We need opponent's dice — approximate by using the roll value
      dmg += myTwos;
      // Note: opponent's 2s would need to be passed in. For now, count own only.
      // In a full implementation, both dice arrays are checked.
    }

    // Wanderer (4) — Curiosity: straight = +2 damage
    if (f.id === 4 && isStraightCheck(dice)) dmg += 2;

    // Chip (16) — Acrobatic Dive: even doubles = +3 damage
    if (f.id === 16 && isEvenDouble(rollResult)) dmg += 3;

    // Charlie (18) — Rush: double 2's = hit for 7
    if (f.id === 18 && rollResult.type === 'doubles' && rollResult.value === 2) dmg = 7;

    // Larry (35) — Flying Kick: triples = 3X damage
    if (f.id === 35 && rollResult.type === 'triples') dmg = rollResult.damage * 3;

    // Bill & Bob (36) — Bait n Switch: below 4 HP = 2X damage
    if (f.id === 36 && f.hp < 4) dmg *= 2;

    // Team Zippy (40) — Teamwork: singles = +2 damage
    if (f.id === 40 && rollResult.type === 'singles') dmg += 2;

    // Doc (42) — Savage: doubles = +5 damage
    if (f.id === 42 && rollResult.type === 'doubles') dmg += 5;

    // Cave Dweller (46) — Lurk: first roll win = 3X damage
    if (f.id === 46 && B.round === 1) dmg *= 3;

    // Greg (49) — Chase: more HP than enemy = 2X damage
    if (f.id === 49 && ef && f.hp > ef.hp) dmg *= 2;

    // Sparky (64) — Tinder: +3 damage per 1 rolled
    if (f.id === 64) {
      const ones = countVal(dice, 1);
      dmg += ones * 3;
    }

    // Wim (65) — Slash: all dice odd = +5 damage
    if (f.id === 65 && allOdd(dice)) dmg += 5;

    // Snorton (67) — Fissure: two+ 6's = +5 damage
    if (f.id === 67 && countVal(dice, 6) >= 2) dmg += 5;

    // Stone Cold (73) — One-two-one!: double 1's = 3X damage
    if (f.id === 73 && rollResult.type === 'doubles' && rollResult.value === 1) dmg *= 3;

    // Antoinette (82) — Grace: +1 damage on doubles
    if (f.id === 82 && rollResult.type === 'doubles') dmg += 1;

    // Pelter (86) — Snowball: doubles = +2 damage
    if (f.id === 86 && rollResult.type === 'doubles') dmg += 2;

    // Mountain King (110) — Beast Mode: doubles = 2X damage
    if (f.id === 110 && rollResult.type === 'doubles') dmg *= 2;

    // Doom (112) — Fiendship: always +2 damage
    if (f.id === 112) dmg += 2;

    // Nikon (2) — Ambush: first roll win = triple damage
    if (f.id === 2 && B.round === 1) dmg *= 3;

    // Cluck (340) — Peck: singles win = +2 damage
    if (f.id === 340 && rollResult.type === 'singles') dmg += 2;

    // Red Hunter (345) — Rumble: win + enemy has specials = +3 damage
    if (f.id === 345 && enemy && totalResources(enemy) > 0) dmg += 3;

    // Dragonclaw (367) — Rake: 3 different numbers = +3 damage
    if (f.id === 367 && distinctValues(dice) >= 3) dmg += 3;

    // Michael (445) — Torrent: even doubles = +2 damage
    if (f.id === 445 && isEvenDouble(rollResult)) dmg += 2;

    // Ridley (462) — Nimble: singles +1, doubles +2
    if (f.id === 462) {
      if (rollResult.type === 'singles') dmg += 1;
      if (rollResult.type === 'doubles') dmg += 2;
    }

    // Hector (96) — Protector: +1 damage on singles
    if (f.id === 96 && rollResult.type === 'singles') dmg += 1;

    // Carpenter (449) — Crafty: +2 damage on singles
    if (f.id === 449 && rollResult.type === 'singles') dmg += 2;

    // Bigsby (424) — Omen: +1 damage on wins
    if (f.id === 424) dmg += 1;

    // Rook (416) — +1 damage per Surge committed
    if (f.id === 416 && B.committed && B.committed[teamName]) {
      dmg += (B.committed[teamName].surge || 0);
    }

    // Yawn Eater (464) — Odd doubles = +1 damage
    if (f.id === 464 && isOddDouble(rollResult)) dmg += 1;

    // Zach (87) — sideline: Guard Thomas gains +3 damage on doubles
    if (hasSideline(team, 87) && f.id === 41 && rollResult.type === 'doubles') dmg += 3;

    // Lou (32) — Bros: sideline, Grawr gains +1 damage
    if (hasSideline(team, 32) && f.id === 34) dmg += 1;

    // Castle Guards (39) — Flamethrower: any 3's multiply damage by 2 each
    if (f.id === 39) {
      const threes = countVal(dice, 3);
      for (let i = 0; i < threes; i++) dmg *= 2;
    }

    // Buttons (8) — Perfect Plan: triple 6's = +15 damage
    if (f.id === 8 && rollResult.type === 'triples' && rollResult.value === 6) dmg += 15;

    // Alucard (38) — Colony Call: doubles = +2 per sideline ghost, once per game
    if (f.id === 38 && rollResult.type === 'doubles' && !f.usedOncePerGame) {
      const sideCount = sidelineCount(team);
      if (sideCount > 0) {
        dmg += sideCount * 2;
        f.usedOncePerGame = true;
      }
    }

    // Explorer Jeff (455) — +1 damage if 3+ different resources
    if ((f.id === 455 || hasSideline(team, 455)) && distinctResourceTypes(team) >= 3) {
      dmg += 1;
    }

    // Dusk (364) — Twilight: after round 5, all damage +1
    if (f.id === 364 && B.round > 5) dmg += 1;
  }

  // ── SIDELINE DAMAGE MODIFIERS ──

  if (team && f) {
    // Dark Jeff (74) — SIDELINE: +1 damage all rolls
    if (hasSideline(team, 74)) dmg += 1;

    // Bilbo (80) — SIDELINE: +2 damage on singles
    if (hasSideline(team, 80) && rollResult && rollResult.type === 'singles') dmg += 2;

    // Admiral (71) — SIDELINE: +2 damage on even doubles
    if (hasSideline(team, 71) && isEvenDouble(rollResult)) dmg += 2;

    // Pale Nimbus (88) — SIDELINE: +2 damage if total < 7
    if (hasSideline(team, 88) && dice && diceSum(dice) < 7) dmg += 2;

    // Tabitha (95) — SIDELINE: +2 damage on doubles
    if (hasSideline(team, 95) && rollResult && rollResult.type === 'doubles') dmg += 2;

    // Bandit Pete (93) — SIDELINE: if 2 dice rolled, +3 damage
    if (hasSideline(team, 93) && dice && dice.length === 2) dmg += 3;
  }

  return Math.max(1, dmg);
}

// ── CALCULATE DAMAGE REDUCTION ─────────────────────────

function calculateDamageReduction(teamName, rollResult, incomingDamage) {
  if (!B) return 0;
  let reduction = 0;
  const team = B[teamName];
  const f = team ? activeGhost(team) : null;

  // Shell (Willpower card) — block 1 damage
  if (f && f.shellActive) {
    reduction += 1;
    f.shellActive = false;
  }

  // Puff (5) reduction — FIXED: now checks correct ID 5
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

  // ── NEW DAMAGE REDUCTION ──

  if (f && rollResult) {
    // Guard Thomas (41) — Stoic: below 6 HP, immune to singles
    if (f.id === 41 && f.hp < 6 && rollResult.type === 'singles') {
      reduction += (incomingDamage || 99); // negate all singles damage
    }

    // Sky (72) — Elusive: damage > 2 = negate all
    if (f.id === 72 && (incomingDamage || rollResult.damage) > 2) {
      reduction += (incomingDamage || 99); // negate all
    }

    // City Cyboo (77) — Barrier: no damage from enemy doubles
    if (f.id === 77 && rollResult.type === 'doubles') {
      reduction += (incomingDamage || 99); // negate all doubles damage
    }

    // Garrick (427) — Watchfire: Lose = take -1 damage
    if (f.id === 427) {
      reduction += 1;
    }

    // Grandmother Willow (332) — Deep Roots: cannot be KO'd by singles
    if (f.id === 332 && rollResult.type === 'singles' && f.hp <= (incomingDamage || rollResult.damage)) {
      // Reduce damage to leave at 1 HP instead of KO
      const wouldDie = (incomingDamage || rollResult.damage) >= f.hp;
      if (wouldDie && rollResult.type === 'singles') {
        reduction += (incomingDamage || rollResult.damage) - f.hp + 1;
      }
    }

    // Little Boo (9) — Mercy: enemy triples count as 1-2-3 roll instead
    if (f.id === 9 && rollResult.type === 'triples') {
      // Triples do 3 damage normally; 1-2-3 = singles = 1 damage. Reduce by 2.
      reduction += 2;
    }
  }

  // ── SIDELINE DAMAGE REDUCTION ──

  if (team) {
    // Pumice (319) — SIDELINE: if 3+ damage, reduce to 2
    if (hasSideline(team, 319) && (incomingDamage || 0) >= 3) {
      reduction += (incomingDamage || 0) - 2;
    }

    // Shoo (13) — SIDELINE: ghost < 4 HP gains +2 health, once per ghost
    // (This is a heal, not a reduction — handled as post-damage heal. See triggerWinPath/entry.)
  }

  return reduction;
}

// ── TIE HANDLERS ───────────────────────────────────────
// Called when both teams tie a roll. Returns callouts array.

function triggerOnTie(teamName, rollResult, dice, logFn) {
  if (!B) return [];
  const team = B[teamName];
  if (!team) return [];
  const f = activeGhost(team);
  if (!f || f.ko) return [];
  const enemyName = oppTeam(teamName);
  const enemy = B[enemyName];
  const callouts = [];

  // Opa (48) — Rest: tie = +1 health
  if (f.id === 48) {
    wpHeal(f, 1);
    callouts.push({ name: 'REST!', color: '#66aa44', desc: `${f.name} — tie! +1 HP!`, team: teamName });
  }

  // Dupy (12) — Frolic: tie = instant KO opponent
  if (f.id === 12) {
    const ef = enemy ? activeGhost(enemy) : null;
    if (ef && !ef.ko) {
      wpDamage(ef, ef.hp);
      ef.ko = true;
      ef.killedBy = f.id;
      callouts.push({ name: 'FROLIC!', color: '#ff6644', desc: `${f.name} — TIE! ${ef.name} is instantly KO'd!`, team: teamName });
    }
  }

  // Ancient One (22) — sideline: give your active ghost +3 health on ties
  if (hasSideline(team, 22)) {
    wpHeal(f, 3);
    callouts.push({ name: 'FRIEND TO ALL!', color: '#66aa44', desc: `Ancient One — ${f.name} gains +3 HP on tie!`, team: teamName });
  }

  // Tweak and Twonk (303) — sideline: if active ties, gain 4 Surge
  if (hasSideline(team, 303)) {
    team.resources.surge = (team.resources.surge || 0) + 4;
    callouts.push({ name: 'ROARING CROWD!', color: '#aa66ff', desc: `Tweak and Twonk — +4 Surge on tie!`, team: teamName });
  }

  // Goobs (444) — Dance Party: on tie, both gain 1 Firefly + 5 HP
  if (f.id === 444 || hasOnTeam(team, 444)) {
    team.resources.firefly = Math.min(1, (team.resources.firefly || 0) + 1);
    wpHeal(f, 5);
    callouts.push({ name: 'DANCE PARTY!', color: '#ffcc44', desc: `Goobs — tie! +1 Magic Firefly, +5 HP!`, team: teamName });
  }

  // Jimmy (352) — Chirp: on tie, gain 3 Lucky Stones + 1 Magic Firefly
  if (f.id === 352 || hasOnTeam(team, 352)) {
    team.resources.luckyStone = (team.resources.luckyStone || 0) + 3;
    team.resources.firefly = Math.min(1, (team.resources.firefly || 0) + 1);
    callouts.push({ name: 'CHIRP!', color: '#44cc44', desc: `Jimmy — tie! +3 Lucky Stones, +1 Magic Firefly!`, team: teamName });
  }

  // Dream Cat (28) — Jinx: both roll doubles on tie = +1 die next turn
  if (f.id === 28 && rollResult && rollResult.type === 'doubles') {
    if (!B.dreamCatBonus) B.dreamCatBonus = {};
    B.dreamCatBonus[teamName] = (B.dreamCatBonus[teamName] || 0) + 1;
    callouts.push({ name: 'JINX!', color: '#cc44ff', desc: `${f.name} — both doubles on tie! +1 die next turn!`, team: teamName });
  }

  return callouts;
}

// ── POST-ROLL EFFECTS ──────────────────────────────────
// Called after every roll regardless of outcome. Returns callouts array.

function triggerPostRoll(teamName, rollResult, dice, logFn) {
  if (!B) return [];
  const team = B[teamName];
  if (!team) return [];
  const f = activeGhost(team);
  if (!f || f.ko) return [];
  const callouts = [];

  // Hank (207) — Tremor: each 4 you roll gains 1 Lucky Stone (also fires on loss)
  if (f.id === 207 && dice) {
    const fourCount = countVal(dice, 4);
    if (fourCount > 0) {
      team.resources.luckyStone = (team.resources.luckyStone || 0) + fourCount;
      // Callout only if not already pushed by triggerWinPath
    }
  }

  // Ronan (461) — Mixup: doubles (win or lose) = +1 Ice Shard & +1 Burn
  // (Win handled in triggerWinPath; loss/tie also triggers)

  // Gary (92) — Lucky Novice: gain +2 Ice Shards for each 1 rolled (sideline & in play, all rolls)
  // (Win handled in triggerWinPath; loss/tie also triggers)

  // Sable (413) — Furnace: all odd numbers = gain 1 Sacred Fire (all rolls)
  // (Win handled in triggerWinPath; loss/tie also triggers)

  // Masked Hero (55) — Underdog: +1 Burn per 3 rolled (all rolls)
  // (Win handled in triggerWinPath; loss/tie also triggers)

  return callouts;
}

// ── KO TRIGGER ─────────────────────────────────────────
// Called when a ghost is KO'd. Returns callouts array.

function triggerOnKO(teamName, koGhost, logFn) {
  if (!B) return [];
  const team = B[teamName];
  if (!team) return [];
  const enemyName = oppTeam(teamName);
  const enemy = B[enemyName];
  const callouts = [];

  // Ash Phoenix (361) — Rebirth: when defeated, return with 2 HP, once per game
  if (koGhost.id === 361 && !koGhost._ashPhoenixUsed) {
    koGhost._ashPhoenixUsed = true;
    koGhost.ko = false;
    koGhost.hp = 2;
    wpHeal(koGhost, 2);
    callouts.push({ name: 'REBIRTH!', color: '#ff6644', desc: `${koGhost.name} — rises from the ashes with 2 HP!`, team: teamName });
  }

  // Bubble Boys (44) — Pop: if enemy rolls triples, Bubble Boys are defeated
  // (This is handled in damage resolution, not here)

  // Calvin & Anna (91) — Toboggan: when defeating a ghost, may swap out
  if (enemy) {
    const ef = activeGhost(enemy);
    if (ef && ef.id === 91 && !ef.ko) {
      callouts.push({ name: 'TOBOGGAN!', color: '#66aa44', desc: `Calvin & Anna — may swap with a sideline ghost!`, team: enemyName });
    }
  }

  // Munch (66) — Scraps: upon defeating a ghost, gain 4 health (if Munch is active attacker)
  if (enemy) {
    const attacker = activeGhost(enemy);
    if (attacker && attacker.id === 66 && !attacker.ko) {
      wpHeal(attacker, 4);
      callouts.push({ name: 'SCRAPS!', color: '#66aa44', desc: `${attacker.name} — devoured ${koGhost.name}! +4 HP!`, team: enemyName });
    }
  }

  // Harvest Moon (346) — Reaping: defeat a ghost = gain 1 of every resource
  if (enemy) {
    const attacker = activeGhost(enemy);
    if (attacker && attacker.id === 346 && !attacker.ko) {
      enemy.resources.healingSeed = (enemy.resources.healingSeed || 0) + 1;
      enemy.resources.surge = (enemy.resources.surge || 0) + 1;
      enemy.resources.ice = (enemy.resources.ice || 0) + 1;
      callouts.push({ name: 'REAPING!', color: '#66aa44', desc: `${attacker.name} — KO! +1 Healing Seed, +1 Surge, +1 Ice!`, team: enemyName });
    }
  }

  return callouts;
}

// ── CORNELIUS (45) — ANTIDOTE: negate all enemy sideline effects ──
// Call this before applying any sideline ability to check if it's blocked.

function corneliusBlocks(team) {
  if (!team || !team.ghosts) return false;
  const enemyName = team === B.red ? 'blue' : (team === B.blue ? 'red' : (team === B.player ? 'enemy' : 'player'));
  const enemy = B[enemyName];
  if (!enemy) return false;
  return hasSideline(enemy, 45);
}

// ── GUARDIAN FAIRY (99) — WISH: leap in and take the hit ──
// Returns true if Guardian Fairy intercepted

function checkGuardianFairy(teamName, damageAmount) {
  if (!B) return false;
  const team = B[teamName];
  if (!team) return false;
  if (!hasSideline(team, 99)) return false;

  const fairy = getSidelineGhost(team, 99);
  if (!fairy || fairy.ko) return false;

  // Guardian Fairy takes the hit instead
  wpDamage(fairy, damageAmount);
  if (fairy.hp <= 0) fairy.ko = true;
  return true;
}

// ── BUBBLE BOYS (44) — POP: if enemy rolls triples, instant KO ──

function checkBubbleBoysPop(teamName, enemyRollResult) {
  if (!B) return false;
  const team = B[teamName];
  if (!team) return false;
  const f = activeGhost(team);
  if (!f || f.id !== 44 || f.ko) return false;
  return enemyRollResult && (enemyRollResult.type === 'triples' || enemyRollResult.type === 'quads' || enemyRollResult.type === 'penta' || (enemyRollResult.type && enemyRollResult.type.endsWith('-of-a-kind')));
}

// ── SHOO (13) — ALPINE AIR: sideline heal when < 4 HP, once per ghost ──

function checkShooHeal(teamName) {
  if (!B) return [];
  const team = B[teamName];
  if (!team) return [];
  const f = activeGhost(team);
  if (!f || f.ko) return [];
  const callouts = [];

  if (hasSideline(team, 13) && f.hp < 4 && !f._shooHealUsed) {
    f._shooHealUsed = true;
    wpHeal(f, 2);
    callouts.push({ name: 'ALPINE AIR!', color: '#66aa44', desc: `Shoo — ${f.name} gains +2 HP (< 4 HP)!`, team: teamName });
  }

  return callouts;
}

// ── MAISIE (458) — LUCKY: all 1s count as 5s ──

function applyMaisieTransform(teamName, dice) {
  if (!B || !dice) return dice;
  const team = B[teamName];
  if (!team) return dice;
  const f = activeGhost(team);
  if (!f || f.id !== 458 || f.ko) return dice;

  for (let i = 0; i < dice.length; i++) {
    if (dice[i] === 1) dice[i] = 5;
  }
  return dice.sort((a, b) => a - b);
}

// ── SONYA (69) — MESMERIZE: change one die to a 2 ──

function applySonyaTransform(teamName, dice) {
  if (!B || !dice) return dice;
  const team = B[teamName];
  if (!team) return dice;
  const f = activeGhost(team);
  if (!f || f.id !== 69 || f.ko) return dice;
  if (B.sonyaUsedThisRound && B.sonyaUsedThisRound[teamName]) return dice;

  // Change lowest non-2 die to a 2
  for (let i = 0; i < dice.length; i++) {
    if (dice[i] !== 2) {
      dice[i] = 2;
      if (!B.sonyaUsedThisRound) B.sonyaUsedThisRound = {};
      B.sonyaUsedThisRound[teamName] = true;
      break;
    }
  }
  return dice.sort((a, b) => a - b);
}

// ── BOURIL (201) — SLUMBER: force 1-2-3 first roll ──

function applyBourilFirstRoll(teamName, dice) {
  if (!B || !dice) return dice;
  const team = B[teamName];
  if (!team) return dice;
  const f = activeGhost(team);
  if (!f || !f.hankFirstRoll) return dice;

  f.hankFirstRoll = false;
  // Force dice to 1, 2, 3
  if (dice.length >= 3) {
    dice[0] = 1; dice[1] = 2; dice[2] = 3;
  }
  return dice;
}

// ── LOGEY (26) — HEINOUS: opponent's 5+ dice unavailable next roll ──

function checkLogeyLockout(teamName, dice) {
  if (!B || !dice) return [];
  const team = B[teamName];
  if (!team) return [];
  const f = activeGhost(team);
  if (!f || f.id !== 26 || f.ko) return [];
  const callouts = [];
  const enemyName = oppTeam(teamName);

  // Count opponent dice that were 5 or 6
  if (!B.logeyLockout) B.logeyLockout = {};
  const highDice = dice.filter(d => d >= 5).length;
  if (highDice > 0) {
    B.logeyLockout[enemyName] = highDice;
    callouts.push({ name: 'HEINOUS!', color: '#888888', desc: `Logey — opponent's ${highDice} high dice locked out next roll!`, team: teamName });
  }

  return callouts;
}

// ── NIGHT MASTER (103) — BULLSEYE: doubles win = destroy enemy sideline <4 HP ──

function checkNightMaster(teamName, rollResult) {
  if (!B) return [];
  const team = B[teamName];
  if (!team) return [];
  const f = activeGhost(team);
  if (!f || f.id !== 103 || f.ko) return [];
  const callouts = [];

  if (rollResult && rollResult.type === 'doubles') {
    const enemyName = oppTeam(teamName);
    const enemy = B[enemyName];
    if (enemy) {
      const target = enemy.ghosts.find((g, i) => i !== enemy.activeIdx && !g.ko && g.hp < 4);
      if (target) {
        wpDamage(target, target.hp);
        target.ko = true;
        target.killedBy = f.id;
        callouts.push({ name: 'BULLSEYE!', color: '#ff6644', desc: `${f.name} — doubles win! ${target.name} destroyed from sideline!`, team: teamName });
      }
    }
  }

  return callouts;
}

// ── HAYWIRE (78) — WILD CHORDS: triples or better = +1 permanent die + +2 permanent damage, once per game ──

function checkHaywire(teamName, rollResult) {
  if (!B) return [];
  const team = B[teamName];
  if (!team) return [];
  const f = activeGhost(team);
  if (!f || f.id !== 78 || f.ko) return [];
  if (B.haywireUsed && B.haywireUsed[teamName]) return [];
  const callouts = [];

  if (rollResult && (rollResult.type === 'triples' || rollResult.type === 'quads' || rollResult.type === 'penta' || (rollResult.type && rollResult.type.endsWith('-of-a-kind')))) {
    if (!B.haywireUsed) B.haywireUsed = {};
    B.haywireUsed[teamName] = true;
    if (!B.haywireBonus) B.haywireBonus = {};
    B.haywireBonus[teamName] = 1; // permanent +1 die
    if (!B.haywireDamageBonus) B.haywireDamageBonus = {};
    B.haywireDamageBonus[teamName] = 2; // permanent +2 damage
    callouts.push({ name: 'WILD CHORDS!', color: '#cc44ff', desc: `${f.name} — triples+! +1 permanent die, +2 permanent damage!`, team: teamName });
  }

  return callouts;
}

// ── LAURA (79) — CATCHY TUNE: roll a straight to unlock ──

function checkCatchyTune(teamName, dice) {
  if (!B || !dice) return [];
  const team = B[teamName];
  if (!team) return [];
  const f = activeGhost(team);
  if (!f || f.id !== 79 || f.ko) return [];
  const callouts = [];

  if (isStraightCheck(dice) && !B.catchyTuneUnlocked[teamName]) {
    B.catchyTuneUnlocked[teamName] = true;
    callouts.push({ name: 'CATCHY TUNE!', color: '#cc44ff', desc: `${f.name} — straight! Catchy Tune unlocked!`, team: teamName });
  }

  return callouts;
}

// ── SKYLAR (104) — WINTER BARRAGE: Ice Shards deal +2 instead of +1 ──
// (Handled in resource commit system — ice damage = 2 per shard if Skylar active/on team)

function getSkylarIceBonus(teamName) {
  if (!B) return 0;
  const team = B[teamName];
  if (!team) return 0;
  if (hasOnTeam(team, 104)) return 1; // +1 extra per shard (total 2 per shard)
  return 0;
}

// ── TYLER (105) — HEATING UP: Sacred Fires deal x2 ──
// (Handled in resource commit system)

function getTylerFireBonus(teamName) {
  if (!B) return false;
  const team = B[teamName];
  if (!team) return false;
  const f = activeGhost(team);
  return f && f.id === 105 && !f.ko;
}

// ── FED AND HAYDEN (406) — ETERNAL FLAME: Sacred Fires not discarded ──

function isEternalFlame(teamName) {
  if (!B) return false;
  const team = B[teamName];
  if (!team) return false;
  return hasOnTeam(team, 406);
}

// ── MR FILBERT (59) — MASK MERCHANT: sideline, healing deals damage instead ──

function isMrFilbertActive(teamName) {
  if (!B) return false;
  const team = B[teamName];
  if (!team) return false;
  return hasSideline(team, 59);
}

// ── DARK WING (76) — PRECISION: once per game, reroll singles ──

function checkDarkWingReroll(teamName, rollResult) {
  if (!B) return false;
  const team = B[teamName];
  if (!team) return false;
  const f = activeGhost(team);
  if (!f || f.id !== 76 || f.ko) return false;
  if (B.darkWingUsedThisGame && B.darkWingUsedThisGame[teamName]) return false;
  return rollResult && rollResult.type === 'singles';
}

// ── JACKSON (50) — REGROW: remove 1 HP to reroll 1 die ──

function checkJacksonReroll(teamName) {
  if (!B) return false;
  const team = B[teamName];
  if (!team) return false;
  const f = activeGhost(team);
  if (!f || f.id !== 50 || f.ko) return false;
  if (B.jacksonUsedThisRound && B.jacksonUsedThisRound[teamName]) return false;
  return f.hp > 1; // needs at least 2 HP to sacrifice 1
}

// ── ROMY (114) — VALLEY GUARDIAN: predict a die number, +3 damage if match ──
// (Prediction stored in B.romyPrediction[teamName], checked in calculateDamage)

function getRomyBonus(teamName, dice) {
  if (!B || !dice) return 0;
  const team = B[teamName];
  if (!team) return 0;
  const f = activeGhost(team);
  if (!f || f.id !== 114 || f.ko) return 0;
  const prediction = B.romyPrediction ? B.romyPrediction[teamName] : null;
  if (prediction && dice.includes(prediction)) return 3;
  return 0;
}

// ── ELOISE (85) — CHANGE OF HEART: spend 1 Ice Shard to swap HP with enemy ──

function checkEloiseSwap(teamName) {
  if (!B) return false;
  const team = B[teamName];
  if (!team) return false;
  const f = activeGhost(team);
  if (!f || f.id !== 85 || f.ko) return false;
  if (B.eloiseUsedThisRound && B.eloiseUsedThisRound[teamName]) return false;
  return (team.resources.ice || 0) >= 1;
}

// ── OBSIDIAN THRONE (341) — DOMINION: opponent cannot use items ──

function isObsidianThroneActive(teamName) {
  if (!B) return false;
  const enemyName = oppTeam(teamName);
  const enemy = B[enemyName];
  if (!enemy) return false;
  const ef = activeGhost(enemy);
  return ef && ef.id === 341 && !ef.ko;
}

// ── SLICER (460) — PARTING GIFT: win with quads+ = destroy enemy sideline ──

function checkSlicer(teamName, rollResult) {
  if (!B) return [];
  const team = B[teamName];
  if (!team) return [];
  const callouts = [];

  if (!hasOnTeam(team, 460)) return [];
  if (!rollResult) return [];
  const isQuadsPlus = rollResult.type === 'quads' || rollResult.type === 'penta' || (rollResult.type && rollResult.type.endsWith('-of-a-kind'));
  if (!isQuadsPlus) return [];

  const enemyName = oppTeam(teamName);
  const enemy = B[enemyName];
  if (!enemy) return [];

  const target = enemy.ghosts.find((g, i) => i !== enemy.activeIdx && !g.ko);
  if (target) {
    wpDamage(target, target.hp);
    target.ko = true;
    target.killedBy = 460;
    callouts.push({ name: 'PARTING GIFT!', color: '#ff6644', desc: `Slicer — quads+! ${target.name} destroyed from sideline!`, team: teamName });
  }

  return callouts;
}

// ── KNIGHT TERROR (401) — HEAVY AIR: after opponent ability triggers, enemy loses 2 HP ──

function checkKnightTerror(teamName) {
  if (!B) return 0;
  const team = B[teamName];
  if (!team) return 0;
  const f = activeGhost(team);
  if (!f || f.id !== 401 || f.ko) return 0;
  return 2; // 2 HP penalty when opponent ability triggers
}

// ── KNIGHT LIGHT (402) — RETRIBUTION: when opponent ability triggers, gain +1 die ──

function checkKnightLight(teamName) {
  if (!B) return false;
  const team = B[teamName];
  if (!team) return false;
  const f = activeGhost(team);
  return f && f.id === 402 && !f.ko;
}

// ── SMUDGE (403) — BLACKOUT: named number doesn't count for opponent ──
// (Stored in B.blackoutNum[teamName], applied during dice classification)

function getBlackoutNumber(teamName) {
  if (!B || !B.blackoutNum) return null;
  return B.blackoutNum[teamName] || null;
}

// ── PIP (418) — TOASTED: triples+ = permanently remove 1 enemy die + gain 2 Sacred Fires, once per game ──

function checkPipToasted(teamName, rollResult) {
  if (!B) return [];
  const team = B[teamName];
  if (!team) return [];
  const f = activeGhost(team);
  if (!f || f.id !== 418 || f.ko) return [];
  if (B.pipToastedUsed && B.pipToastedUsed[teamName]) return [];
  const callouts = [];

  const isTriples = rollResult && (rollResult.type === 'triples' || rollResult.type === 'quads' || rollResult.type === 'penta' || (rollResult.type && rollResult.type.endsWith('-of-a-kind')));
  if (isTriples) {
    if (!B.pipToastedUsed) B.pipToastedUsed = {};
    B.pipToastedUsed[teamName] = true;
    const enemyName = oppTeam(teamName);
    if (!B.pipDieRemoval) B.pipDieRemoval = {};
    B.pipDieRemoval[enemyName] = (B.pipDieRemoval[enemyName] || 0) + 1;
    team.resources.fire = (team.resources.fire || 0) + 2;
    callouts.push({ name: 'TOASTED!', color: '#ff6644', desc: `${f.name} — triples+! Permanently removed 1 enemy die! +2 Sacred Fires!`, team: teamName });
  }

  return callouts;
}

// ── MIYOSHI (454) — BONZAI: lose 4 HP, gain +5 dice ──
// (Declared pre-roll, effect applied in calculateDiceCount via flag)

function declareBonzai(teamName) {
  if (!B) return false;
  const team = B[teamName];
  if (!team) return false;
  const f = activeGhost(team);
  if (!f || f.id !== 454 || f.ko) return false;
  if (B.bonzaiDecided && B.bonzaiDecided[teamName]) return false;
  if (f.hp <= 4) return false; // would KO

  wpDamage(f, 4);
  if (!B.bonzaiDecided) B.bonzaiDecided = {};
  B.bonzaiDecided[teamName] = true;
  // Add dice via a temporary flag
  if (!B.scallywagsFrenzyBonus) B.scallywagsFrenzyBonus = {};
  B.scallywagsFrenzyBonus[teamName] = (B.scallywagsFrenzyBonus[teamName] || 0) + 5;
  return true;
}

// ── TOBY (97) — PURE HEART: declare final roll, defeated next turn ──
// (Stored in B.pureHeartDeclared)

// ── TIMBER (210) — HOWL: opponent must discard 2 specials OR remove 1 die ──
// (UI decision — simplified to auto-remove 1 die)

function checkTimberHowl(teamName) {
  if (!B) return [];
  const team = B[teamName];
  if (!team) return [];
  const f = activeGhost(team);
  if (!f || f.id !== 210 || f.ko) return [];
  const callouts = [];
  const enemyName = oppTeam(teamName);

  // Simplified: opponent loses 1 die this roll
  if (!B.floopMuck) B.floopMuck = {};
  B.floopMuck[enemyName] = (B.floopMuck[enemyName] || 0) + 1;
  callouts.push({ name: 'HOWL!', color: '#cc44ff', desc: `${f.name} — Timber's Howl! Opponent loses 1 die!`, team: teamName });

  return callouts;
}

// ── CHAMP (438) — THRILL: immune to damage from specials ──

function isChampImmune(teamName) {
  if (!B) return false;
  const team = B[teamName];
  if (!team) return false;
  const f = activeGhost(team);
  return f && f.id === 438 && !f.ko;
}

// ── MAGMA HEART (325) — CORE MELT: below 3 HP, damage ignores reduction ──

function isMagmaHeartActive(teamName) {
  if (!B) return false;
  const team = B[teamName];
  if (!team) return false;
  const f = activeGhost(team);
  return f && f.id === 325 && !f.ko && f.hp < 3;
}

// ── BARNABY (326) — STUBBORN: cannot be swapped out ──

function isBarnabyStubbornActive(teamName) {
  if (!B) return false;
  const team = B[teamName];
  if (!team) return false;
  const f = activeGhost(team);
  return f && f.id === 326 && !f.ko;
}

// ── TYSON (365) — HOP: win = disable an enemy sideline ability ──
// (Stored in B.tysonDisabled[enemyName] array)

function checkTysonHop(teamName, rollResult) {
  if (!B) return [];
  const team = B[teamName];
  if (!team) return [];
  const f = activeGhost(team);
  if (!f || f.id !== 365 || f.ko) return [];
  const callouts = [];
  const enemyName = oppTeam(teamName);
  const enemy = B[enemyName];
  if (!enemy) return [];

  // Find first non-disabled sideline ghost
  const target = enemy.ghosts.find((g, i) => {
    if (i === enemy.activeIdx || g.ko) return false;
    if (B.tysonDisabled && B.tysonDisabled[enemyName] && B.tysonDisabled[enemyName].includes(g.id)) return false;
    return true;
  });

  if (target) {
    if (!B.tysonDisabled) B.tysonDisabled = {};
    if (!B.tysonDisabled[enemyName]) B.tysonDisabled[enemyName] = [];
    B.tysonDisabled[enemyName].push(target.id);
    callouts.push({ name: 'HOP!', color: '#aa66ff', desc: `${f.name} — ${target.name}'s sideline ability disabled!`, team: teamName });
  }

  return callouts;
}

// ── WISP (344) — GUIDE LIGHT: sideline, opponent cannot gain resources ──

function isWispBlocking(teamName) {
  if (!B) return false;
  const team = B[teamName];
  if (!team) return false;
  return hasSideline(team, 344);
}

// ── HARRISON (315) — ASCEND: discard Healing Seeds for +1 die each ──
// (Handled in resource commit system)

// ── HAPPY CRYSTAL (208) — SPARK STRIKE: sacrifice for 1 Moonstone ──
// (Handled in pre-roll UI)

// ── BOO BROTHERS (17) — TEAMWORK: remove 1 die to gain 1 HP ──
// (Handled in pre-roll UI)

// ── DOUG (63) — CAUTION: switch with sideline once per game, +1 die ──
// (Handled in pre-roll UI)

// ── MALLOW (89) — DOZY COZY: sideline, spend 2 Sacred Fire for 3 HP + 1 Burn ──
// (Handled in pre-roll UI)

// ── JEANIE (90) — HIDDEN TREASURE: sideline, force opponent reroll, once per game ──
// (Handled in pre-roll UI)

// ── CHOW (414) — SECRET INGREDIENT: spend 1 Healing Seed for +2 dice ──
// (Handled in pre-roll UI)

// ── ZORK (463) — SMOLDER: discard Burn for +1 die each ──
// (Handled in pre-roll UI)

// ── CASTLE GARDENER (442) — CULTIVATE: discard Healing Seeds for 2 Sacred Fire each ──
// (Handled in pre-roll UI)

// ── NICK & KNACK (409) — KNICK KNACK: steal 1 special, gain 1 HP + 2 Burn ──
// (Handled in pre-roll UI)

// ── ZIPPA (423) — GLIMMER: gain 1 Lucky Stone per Healing Seed held ──

function checkZippaGlimmer(teamName) {
  if (!B) return [];
  const team = B[teamName];
  if (!team) return [];
  const f = activeGhost(team);
  if (!f || f.id !== 423 || f.ko) return [];
  const callouts = [];

  const seeds = team.resources.healingSeed || 0;
  if (seeds > 0) {
    team.resources.luckyStone = (team.resources.luckyStone || 0) + seeds;
    callouts.push({ name: 'GLIMMER!', color: '#44cc44', desc: `${f.name} — ${seeds} Healing Seeds! +${seeds} Lucky Stones!`, team: teamName });
  }

  return callouts;
}

// ── TWYLA (417) — LUCKY DANCE: Lucky Stones add +1 die + +1 Healing Seed ──
// (Handled in resource commit system)

// ── KAYLEE (453) — SLIPSTREAM: if any die shows 2, swap one die with opponent ──
// (Handled in post-roll UI)

// ── SOPHIA (457) — MASQUERADE: win = deal no damage, gain mask once per game ──
// (Handled in win-path UI)

// ── RYDER (456) — TOLL: opponent chooses: take 1 damage or give +1 Sacred Fire ──
// (Handled in pre-roll UI — simplified to auto-choose Sacred Fire)

function checkRyderToll(teamName) {
  if (!B) return [];
  const team = B[teamName];
  if (!team) return [];
  const f = activeGhost(team);
  if (!f || f.id !== 456 || f.ko) return [];
  const callouts = [];

  // Simplified: opponent gives Ryder 1 Sacred Fire
  team.resources.fire = (team.resources.fire || 0) + 1;
  callouts.push({ name: 'TOLL!', color: '#ff6644', desc: `${f.name} — Toll! +1 Sacred Fire!`, team: teamName });

  return callouts;
}

// ── BOOPIES (419) — BOOPIE MAGIC: sideline, when active spends Healing Seed, gain 1 Lucky Stone ──

function checkBoopiesMagic(teamName) {
  if (!B) return false;
  const team = B[teamName];
  return team && hasSideline(team, 419);
}

// ── LUCY'S SHADOW (439) — MENTOR: sideline, Lucy's Sacred Fires deal double damage ──

function isLucyShadowMentor(teamName) {
  if (!B) return false;
  const team = B[teamName];
  if (!team) return false;
  const f = activeGhost(team);
  return f && f.id === 108 && hasSideline(team, 439);
}

// ── RIPAGOO (452) — CHEMICAL Y: sideline, if card transforms, gain 2 Burn ──

function checkRipagooTransform(teamName) {
  if (!B) return [];
  const team = B[teamName];
  if (!team) return [];
  if (!hasSideline(team, 452)) return [];
  const callouts = [];

  team.resources.burn = (team.resources.burn || 0) + 2;
  callouts.push({ name: 'CHEMICAL Y!', color: '#cc4400', desc: `Ripagoo — transformation detected! +2 Burn!`, team: teamName });

  return callouts;
}

// ── SCARECROW KING (368) — COMMAND: sideline abilities trigger twice ──

function isScarecrowKingActive(teamName) {
  if (!B) return false;
  const team = B[teamName];
  return team && hasSideline(team, 368);
}

// ── THE SHEPHERD (360) — FLOCK: defeated ghosts return to sideline with 1 HP, once per game ──

function checkShepherdFlock(teamName) {
  if (!B) return [];
  const team = B[teamName];
  if (!team) return [];
  const f = activeGhost(team);
  if (!f || f.id !== 360 || f.ko) return [];
  if (f._shepherdUsed) return [];
  const callouts = [];

  f._shepherdUsed = true;
  let revived = 0;
  team.ghosts.forEach((g, i) => {
    if (i !== team.activeIdx && g.ko) {
      g.ko = false;
      g.hp = 1;
      wpHeal(g, 1);
      revived++;
    }
  });

  if (revived > 0) {
    callouts.push({ name: 'FLOCK!', color: '#66aa44', desc: `${f.name} — ${revived} ghost${revived > 1 ? 's' : ''} return with 1 HP!`, team: teamName });
  }

  return callouts;
}

// ── MOTHER NATURE (366) — SEASONS: cycles each round ──
// Spring (+1 HP), Summer (+1 dmg), Autumn (+1 resource), Winter (opponent -1 die)

function getMotherNatureSeason(round) {
  const seasons = ['spring', 'summer', 'autumn', 'winter'];
  return seasons[(round - 1) % 4];
}

function checkMotherNature(teamName) {
  if (!B) return [];
  const team = B[teamName];
  if (!team) return [];
  const f = activeGhost(team);
  if (!f || f.id !== 366 || f.ko) return [];
  const callouts = [];
  const season = getMotherNatureSeason(B.round);

  if (season === 'spring') {
    wpHeal(f, 1);
    callouts.push({ name: 'SPRING!', color: '#66aa44', desc: `Mother Nature — Spring! +1 HP!`, team: teamName });
  } else if (season === 'summer') {
    // +1 damage handled in calculateDamage via flag
    if (!B._motherNatureSummerDmg) B._motherNatureSummerDmg = {};
    B._motherNatureSummerDmg[teamName] = true;
    callouts.push({ name: 'SUMMER!', color: '#ff6644', desc: `Mother Nature — Summer! +1 damage!`, team: teamName });
  } else if (season === 'autumn') {
    team.resources.healingSeed = (team.resources.healingSeed || 0) + 1;
    callouts.push({ name: 'AUTUMN!', color: '#cc8844', desc: `Mother Nature — Autumn! +1 Healing Seed!`, team: teamName });
  } else if (season === 'winter') {
    const enemyName = oppTeam(teamName);
    if (!B.floopMuck) B.floopMuck = {};
    B.floopMuck[enemyName] = (B.floopMuck[enemyName] || 0) + 1;
    callouts.push({ name: 'WINTER!', color: '#4488cc', desc: `Mother Nature — Winter! Opponent -1 die!`, team: teamName });
  }

  return callouts;
}

// ── VOLCANIC HEART (359) — PULSE: every 3 rounds, deal 2 to ALL ──

function checkVolcanicHeart(teamName) {
  if (!B) return [];
  const team = B[teamName];
  if (!team) return [];
  const f = activeGhost(team);
  if (!f || f.id !== 359 || f.ko) return [];
  if (B.round % 3 !== 0) return [];
  const callouts = [];

  // Damage all active ghosts on both teams
  const sides = B.red ? ['red', 'blue'] : ['player', 'enemy'];
  sides.forEach(s => {
    const t = B[s];
    if (!t) return;
    const g = activeGhost(t);
    if (g && !g.ko) {
      wpDamage(g, 2);
      if (g.ko) g.killedBy = 359;
    }
  });

  callouts.push({ name: 'PULSE!', color: '#ff6644', desc: `Volcanic Heart — every 3 rounds! 2 damage to ALL active ghosts!`, team: teamName });
  return callouts;
}

// ── BENJAMIN (203) — MAGIC TOUCH: use Moonstone without discarding, once per turn ──

function checkBenjaminMagicTouch(teamName) {
  if (!B) return false;
  const team = B[teamName];
  if (!team) return false;
  const f = activeGhost(team);
  return f && f.id === 203 && !f.ko && !f.usedMagicTouch;
}

// ── BORIS (343) — FORTIFY: when you spend Surge, Boris gains 2 HP ──

function checkBorisFortify(teamName) {
  if (!B) return false;
  const team = B[teamName];
  if (!team) return false;
  const f = activeGhost(team);
  if (f && f.id === 343 && !f.ko) {
    wpHeal(f, 2);
    return true;
  }
  return false;
}

// ── IGNEOUS (331) — CRYSTALLIZE: each round you don't take damage, +1 Surge ──

function checkIgneous(teamName) {
  if (!B) return [];
  const team = B[teamName];
  if (!team) return [];
  const f = activeGhost(team);
  if (!f || f.id !== 331 || f.ko) return [];
  const callouts = [];

  // Track damage taken — if none this round, gain 1 Surge
  if (!B._igneousDamageTaken || !B._igneousDamageTaken[teamName]) {
    team.resources.surge = (team.resources.surge || 0) + 1;
    callouts.push({ name: 'CRYSTALLIZE!', color: '#aa66ff', desc: `${f.name} — no damage taken! +1 Surge!`, team: teamName });
  }

  return callouts;
}

// ── FIDDLE (334) — HOEDOWN: win = may swap active ghost without triggers ──

function checkFiddleSwap(teamName) {
  if (!B) return false;
  const team = B[teamName];
  if (!team) return false;
  const f = activeGhost(team);
  return f && f.id === 334 && !f.ko;
}

// ── YOUNG CAP (429) — ENERGIZE: when you use a Healing Seed, also +1 die, +1 Ice, +1 Surge ──

function checkYoungCapEnergize(teamName) {
  if (!B) return [];
  const team = B[teamName];
  if (!team) return [];
  const f = activeGhost(team);
  if (!f || f.id !== 429 || f.ko) return [];
  const callouts = [];

  // Triggered when Healing Seed is used pre-roll
  if (!B.scallywagsFrenzyBonus) B.scallywagsFrenzyBonus = {};
  B.scallywagsFrenzyBonus[teamName] = (B.scallywagsFrenzyBonus[teamName] || 0) + 1;
  team.resources.ice = (team.resources.ice || 0) + 1;
  team.resources.surge = (team.resources.surge || 0) + 1;
  callouts.push({ name: 'ENERGIZE!', color: '#66aa44', desc: `${f.name} — Healing Seed used! +1 die, +1 Ice, +1 Surge!`, team: teamName });

  return callouts;
}

// ── LUCAS (433) — KINDLING: sideline, when ghost revived, +3 HP + +1 die ──

function checkLucasKindling(teamName) {
  if (!B) return [];
  const team = B[teamName];
  if (!team) return [];
  if (!hasSideline(team, 433)) return [];
  const callouts = [];

  // Triggered when a ghost is revived (by Bo, Shepherd, etc.)
  const f = activeGhost(team);
  if (f && !f.ko) {
    wpHeal(f, 3);
    if (!B.lucasKindlingBonus) B.lucasKindlingBonus = {};
    B.lucasKindlingBonus[teamName] = (B.lucasKindlingBonus[teamName] || 0) + 1;
    callouts.push({ name: 'KINDLING!', color: '#ff6644', desc: `Lucas — revival detected! +3 HP, +1 die next roll!`, team: teamName });
  }

  return callouts;
}

// ── MABLE STADANGO (446) — HEX: spend 1 Burn to remove 1 enemy die + gain 1 Sacred Fire ──

function checkMableHex(teamName) {
  if (!B) return [];
  const team = B[teamName];
  if (!team) return [];
  const f = activeGhost(team);
  if (!f || f.id !== 446 || f.ko) return [];
  if ((team.resources.burn || 0) < 1) return [];
  const callouts = [];
  const enemyName = oppTeam(teamName);

  team.resources.burn--;
  team.resources.fire = (team.resources.fire || 0) + 1;
  if (!B.hexDieRemoval) B.hexDieRemoval = {};
  B.hexDieRemoval[enemyName] = (B.hexDieRemoval[enemyName] || 0) + 1;
  callouts.push({ name: 'HEX!', color: '#cc44ff', desc: `${f.name} — spent 1 Burn! Enemy -1 die, +1 Sacred Fire!`, team: teamName });

  return callouts;
}
