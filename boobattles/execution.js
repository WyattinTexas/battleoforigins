// ══════════════════════════════════════════════════════════════════════════════
// EXECUTION — Battle engine, dice mechanics, ability resolution, damage calc
// ══════════════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════
function rollDice() {
  return [1,2,3].map(() => Math.floor(Math.random()*6)+1);
}

function analyzeRoll(dice) {
  const sorted = [...dice].sort((a,b) => b-a);
  const counts = {};
  dice.forEach(d => counts[d] = (counts[d]||0)+1);
  const maxCount = Math.max(...Object.values(counts));
  const matchVal = +Object.keys(counts).find(k => counts[k] === maxCount);
  if (maxCount >= 6) return { type: 'sixcity', value: matchVal, damage: 6, dice: sorted, matchDie: matchVal };
  if (maxCount === 5) return { type: 'penta', value: matchVal, damage: 5, dice: sorted, matchDie: matchVal };
  if (maxCount === 4) return { type: 'quads', value: matchVal, damage: 4, dice: sorted, matchDie: matchVal };
  if (maxCount === 3) return { type: 'triples', value: matchVal, damage: 3, dice: sorted, matchDie: matchVal };
  if (maxCount === 2) {
    const pairVal = +Object.keys(counts).find(k => counts[k]===2);
    const kicker = +Object.keys(counts).find(k => counts[k]===1);
    return { type: 'doubles', value: pairVal, kicker, damage: 2, dice: sorted, matchDie: pairVal };
  }
  return { type: 'singles', value: sorted[0], damage: 1, dice: sorted, matchDie: null };
}

function compareRolls(pRoll, eRoll) {
  const rank = { singles: 0, doubles: 1, triples: 2, quads: 3, penta: 4, sixcity: 5 };
  const pRank = rank[pRoll.type] ?? 0;
  const eRank = rank[eRoll.type] ?? 0;
  if (pRank !== eRank) return pRank > eRank ? 1 : -1;
  // Same type — compare by value
  if (['triples','quads','penta','sixcity'].includes(pRoll.type)) {
    return pRoll.value > eRoll.value ? 1 : pRoll.value < eRoll.value ? -1 : 0;
  }
  if (pRoll.type === 'doubles') {
    if (pRoll.value !== eRoll.value) return pRoll.value > eRoll.value ? 1 : -1;
    return pRoll.kicker > eRoll.kicker ? 1 : pRoll.kicker < eRoll.kicker ? -1 : 0;
  }
  const len = Math.max(pRoll.dice.length, eRoll.dice.length);
  for (let i = 0; i < len; i++) {
    if ((pRoll.dice[i]||0) > (eRoll.dice[i]||0)) return 1;
    if ((pRoll.dice[i]||0) < (eRoll.dice[i]||0)) return -1;
  }
  return 0;
}

function describeRoll(roll) {
  if (roll.type === 'sixcity') return `SIX CITY — six ${roll.value}'s!`;
  if (roll.type === 'penta') return `five ${roll.value}'s!`;
  if (roll.type === 'quads') return `four ${roll.value}'s!`;
  if (roll.type === 'triples') return `three ${roll.value}'s`;
  if (roll.type === 'doubles') return `two ${roll.value}'s and a ${roll.kicker}`;
  return roll.dice.join(', ');
}

function isTripleOrBetter(type) { return ['triples','quads','penta','sixcity'].includes(type); }

function typeLabel(type) {
  if (type === 'sixcity') return 'SIX CITY!!';
  if (type === 'penta') return 'Penta!';
  if (type === 'quads') return 'Quads!';
  if (type === 'triples') return 'Triples!';
  if (type === 'doubles') return 'Doubles!';
  return 'Singles';
}

// ══════════════════════════════════════════════
// ABILITY SYSTEM — Real card abilities
// ══════════════════════════════════════════════

// Calculate dice count for a side
function getPlayerDiceCount() {
  let count = 3 + playerBonusDice - playerRemoveDice;
  count += powerMode;
  // Antoinette (player): match enemy dice count (min 3)
  if (pick && pick.ability === 'Grace') {
    const enemyBase = Math.max(1, Math.min(6, 3 + enemyBonusDice - enemyRemoveDice));
    count = Math.max(count, enemyBase);
  }
  return Math.max(1, Math.min(6, count));
}

function getEnemyDiceCount() {
  let count = 3 + enemyBonusDice - enemyRemoveDice;
  // Fredrick: opponent may only roll 3 dice (caps at 3)
  if (pick && pick.ability === 'Careful') count = Math.min(3, count);
  // Antoinette (enemy): matches player dice count
  if (enemy && enemy.ability === 'Grace') count = getPlayerDiceCount();
  return Math.max(1, Math.min(6, count));
}

// Apply winner's damage modifiers
function applyWinDamage(winner, loser, roll, baseDmg, isPlayer, firstRoll) {
  let damage = baseDmg;

  switch (winner.ability) {
    case 'Protector': // Hector: +1 on singles (singles beating doubles handled in compareRolls)
      if (roll.type === 'singles') damage += 1;
      break;
    case 'Restore': // Flora: healing handled after damage in resolveRound
      break;
    case 'Slash': // Wim: all dice odd → +5
      if (roll.dice.every(d => d % 2 === 1)) { damage += 5; lastKillWasSlash = true; } else { lastKillWasSlash = false; }
      break;
    case 'Snowball': // Pelter: doubles +2
      if (roll.type === 'doubles') damage += 2;
      break;
    case 'Ambush': // Nikon: first roll win → 3x
    case 'Lurk': // Cave Dweller: first roll win → 3x
      if (firstRoll) damage *= 3;
      break;
    case 'One-two-one!': // Stone Cold: double 1s → 3x
      if (roll.type === 'doubles' && roll.value === 1) damage *= 3;
      break;
    case 'Brew Time': // Simon: Sacred Fire generation handled in afterLossTriggers
      break;
    case 'Blue Fire': // Lucy: win → +1 damage
      damage += 1;
      break;
    case 'Fiendship': // Doom: win → +2 damage
      damage += 2;
      break;
    case 'Haunt': // Shade: passive damage handled in nextRound
      break;
    case 'Beast Mode': // Mountain King: doubles deal 2x
      if (roll.type === 'doubles') damage *= 2;
      break;
    case 'Valley Guardian': // Romy: prediction hit → +3 (checked separately)
      break;
    case 'Party Time': // Balatron: counter die handled separately
      break;
    case 'Fissure': // Hard Luck Snorton: two+ 6's → +5 damage
      if (roll.dice.filter(d => d === 6).length >= 2) damage += 5;
      break;
    case 'Regulator': // Tommy Salami: +1 damage per die regulated this round
      if (isPlayer && regulatorBonus > 0) damage += regulatorBonus;
      break;
  }

  // Committed Ice Shards: +1 per shard if winner (Skylar Winter Barrage: +2 each)
  lastShardsConsumed = null;
  lastFiresConsumed = null;
  if (isPlayer && committedShards > 0) {
    const perShard = winner.ability === 'Winter Barrage' ? 2 : 1;
    const shardDmg = committedShards * perShard;
    damage += shardDmg;
    lastShardsConsumed = { count: committedShards, dmg: shardDmg };
  }
  // Red committed shards (VS mode)
  if (!isPlayer && vsMode && redCommittedShards > 0) {
    const perShard = winner.ability === 'Winter Barrage' ? 2 : 1;
    const shardDmg = redCommittedShards * perShard;
    damage += shardDmg;
    lastShardsConsumed = { count: redCommittedShards, dmg: shardDmg };
  }

  // Committed Sacred Fires: +3 per fire if winner (Tyler Heating Up: x2)
  if (isPlayer && committedFires > 0) {
    const perFire = winner.ability === 'Heating Up' ? 6 : 3;
    const fireDmg = committedFires * perFire;
    damage += fireDmg;
    lastFiresConsumed = { count: committedFires, dmg: fireDmg };
  }
  // Red committed fires (VS mode)
  if (!isPlayer && vsMode && redCommittedFires > 0) {
    const perFire = winner.ability === 'Heating Up' ? 6 : 3;
    const fireDmg = redCommittedFires * perFire;
    damage += fireDmg;
    lastFiresConsumed = { count: redCommittedFires, dmg: fireDmg };
  }

  return damage;
}

// Apply defensive abilities (may modify or negate damage)
function applyDefense(defender, damage, attackRoll, defenderIsPlayer, defenderRoll) {
  switch (defender.ability) {
    case 'Stoic': // Guard Thomas: below 6 HP, immune to singles
      if ((defenderIsPlayer ? playerHp : enemyHp) < 6 && attackRoll.type === 'singles') return 0;
      break;
    case 'Bogus': // Bogey: manual reflect for player, auto for boss when taking 2+ damage
      if (!defenderIsPlayer && vsMode && !redBogeyReflectUsed && redBogeyReflectArmed) {
        // VS mode: Red manually armed Bogey reflect
        redBogeyReflectUsed = true;
        redBogeyReflectArmed = false;
        return -damage;
      }
      if (!defenderIsPlayer && !vsMode && !bogeyReflectUsed && damage >= 2) {
        // Boss Bogey auto-reflects the first hit of 2+ damage
        bogeyReflectUsed = true;
        return -damage;
      }
      if (defenderIsPlayer && !bogeyReflectUsed && bogeyReflectArmed) {
        bogeyReflectUsed = true;
        bogeyReflectArmed = false;
        return -damage; // negative = reflected
      }
      break;
    case 'Reflection': // King Jay: HIS dice total = 7 → reflect
      if (defenderRoll && defenderRoll.dice.reduce((a,b) => a+b, 0) === 7) return -damage;
      break;
  }
  return damage;
}

// After-win triggers (ice shards, healing, dice stealing, etc.)
// Returns an array of {text, delay} messages to show after damage
function afterWinTriggers(winner, loser, roll, damage, isPlayer) {
  const effects = [];

  // Spockles: win → +2 ice shards
  if (winner.ability === 'Valley Magic') {
    if (isPlayer) iceShards += 2; else enemyIceShards += 2;
    effects.push({ text: `<b class="gold">Valley Magic!</b> +2 Ice Shards (${isPlayer ? iceShards : enemyIceShards} total)`, ability: 'Valley Magic', desc: '+2 Ice Shards!' });
  }
  // Ashley: win → +1 sacred fire
  if (winner.ability === 'Burning Soul') {
    if (isPlayer) sacredFires += 1; else enemySacredFires += 1;
    effects.push({ text: `<b class="gold">Burning Soul!</b> +1 Sacred Fire`, ability: 'Burning Soul', desc: '+1 Sacred Fire!' });
  }
  // Roger: 2 different pairs of doubles in full roll (4+ dice) → +3 sacred fires
  if (winner.ability === 'Tempest' && isPlayer && playerDiceValues.length >= 4) {
    const counts = {};
    playerDiceValues.forEach(d => counts[d] = (counts[d]||0)+1);
    const pairs = Object.values(counts).filter(c => c >= 2).length;
    if (pairs >= 2) {
      sacredFires += 3;
      effects.push({ text: `<b class="gold">Tempest!</b> Boom shaka laka! +3 Sacred Fires!`, ability: 'Tempest', desc: 'Boom shaka laka! Doubles! 2 Pairs!' });
    }
  } else if (winner.ability === 'Tempest' && !isPlayer) {
    // Enemy Roger: simplified — 20% chance on any win with doubles
    if (roll.type === 'doubles' && Math.random() < 0.20) {
      enemySacredFires += 3;
      effects.push({ text: `<b class="gold">Tempest!</b> +3 Sacred Fires!`, ability: 'Tempest', desc: '+3 Sacred Fires!' });
    }
  }
  // Outlaw Thief: moved to resolveRound so it triggers on doubles regardless of win/loss
  // Troubling Haters: 4+ damage → +2 HP
  if (winner.ability === 'Growing Mob' && damage >= 4) {
    if (isPlayer) { playerHp = Math.min(pick.maxHp, playerHp + 2); }
    else { enemyHp = Math.min(enemy.maxHp || enemy.bossHp, enemyHp + 2); }
    updateHpDisplay();
    effects.push({ text: `<b class="gold">Growing Mob!</b> +2 HP!`, ability: 'Growing Mob', desc: '+2 HP from big hit!' });
  }
  // Dream Cat: both rolled doubles → +1 die next turn
  if (winner.ability === 'Jinx' && currentEnemyRoll && currentEnemyRoll.type === 'doubles' && roll.type === 'doubles') {
    if (isPlayer) playerBonusDice += 1; else enemyBonusDice += 1;
    effects.push({ text: `<b class="gold">Jinx!</b> Both rolled doubles — +1 die next turn!`, ability: 'Jinx', desc: 'Both doubles! +1 die next turn!' });
  }
  // Flora: rolled doubles → +2 HP after damage
  if (winner.ability === 'Restore' && roll.type === 'doubles') {
    if (isPlayer) { playerHp += 2; updateHpDisplay(); }
    else { enemyHp = Math.min(enemy.maxHp || enemy.bossHp, enemyHp + 2); updateHpDisplay(); }
    effects.push({ ability: 'Restore', desc: 'Doubles rolled! +2 HP!' });
  }

  return effects;
}

// After-loss triggers
function afterLossTriggers(loser, roll, damage, isPlayer) {
  const effects = [];

  // Sad Sal: lose → +1 ice shard
  if (loser.ability === 'Tough Job') {
    if (isPlayer) iceShards += 1; else enemyIceShards += 1;
    effects.push({ text: `<b class="gold">Tough Job!</b> +1 Ice Shard (${isPlayer ? iceShards : enemyIceShards} total)`, ability: 'Tough Job', desc: '+1 Ice Shard!' });
  }
  // Dream Cat (loser side): if both doubles, still triggers
  if (loser.ability === 'Jinx' && roll && currentEnemyRoll && roll.type === 'doubles' && currentEnemyRoll.type === 'doubles') {
    if (isPlayer) playerBonusDice += 1; else enemyBonusDice += 1;
    effects.push({ text: `<b class="gold">Jinx!</b> Both doubles — +1 die next turn!`, ability: 'Jinx', desc: 'Both doubles! +1 die next turn!' });
  }
  // Marcus: take 3+ damage → +4 dice next roll
  if (loser.ability === 'Glacial Pounding' && damage >= 3) {
    if (isPlayer) playerBonusDice += 4; else enemyBonusDice += 4;
    effects.push({ text: `<b class="gold">Glacial Pounding!</b> +4 dice next roll!`, ability: 'Glacial Pounding', desc: '+4 dice next roll!' });
  }
  // Flora: rolled doubles even on a loss → +2 HP if still alive
  if (loser.ability === 'Restore' && roll && roll.type === 'doubles') {
    const alive = isPlayer ? playerHp > 0 : enemyHp > 0;
    if (alive) {
      if (isPlayer) { playerHp += 2; updateHpDisplay(); }
      else { enemyHp = Math.min(enemy.maxHp || enemy.bossHp, enemyHp + 2); updateHpDisplay(); }
      effects.push({ ability: 'Restore', desc: 'Doubles rolled! +2 HP!' });
    }
  }
  // Simon Brew Time: REMOVED from post-roll. Only triggers on before-the-roll effects now.
  // Pre-roll triggers (Swarm, Haunt, Toxic Fumes, etc.) handle Sacred Fire generation.

  if (isPlayer && damage > 0) tookDamageLastRound = true;

  return effects;
}

// VS mode: universal shard/fire rewards (doesn't affect campaign)
// Winner gets +1 ice shard, triples+ gives +1 sacred fire to roller
function vsAwardResources(pRoll, eRoll, playerWins) {
  if (!vsMode) return;
  // Winner earns +1 ice shard
  if (playerWins) {
    iceShards += 1;
  } else {
    enemyIceShards += 1;
  }
  // Triples or better earns +1 sacred fire for whoever rolled it
  if (isTripleOrBetter(pRoll.type)) sacredFires += 1;
  if (isTripleOrBetter(eRoll.type)) enemySacredFires += 1;
}

// Show queued ability effects with splashes
function showEffectQueue(effects, cardId, callback) {
  if (!effects || effects.length === 0) { if (callback) callback(); return; }
  const fx = effects.shift();
  showAbilitySplash(fx.ability, fx.desc, 1400, () => {
    showEffectQueue(effects, cardId, callback);
  }, cardId);
}

// Logey ability: after opponent's roll, mark high dice for removal
function applyLogeyEffect(opponentRoll, isPlayerLogey) {
  if (!opponentRoll) return;
  const highCount = opponentRoll.dice.filter(d => d >= 5).length;
  if (highCount > 0) {
    if (isPlayerLogey) {
      enemyRemoveDice += highCount;
    } else {
      playerRemoveDice += highCount;
    }
    // Show dramatic splash
    const targetName = isPlayerLogey ? enemy.name : pick.name;
    const cardId = isPlayerLogey ? 'playerCard' : 'enemyCard';
    showAbilitySplash('Heinous', `${highCount} dice locked out!`, 1400, () => {
      narrate(isPlayerLogey
        ? `<b class="gold">Heinous!</b> ${highCount} of ${enemy.name}'s dice locked!`
        : `<b class="them">Heinous!</b> ${highCount} of your dice locked!`);
    }, cardId);
  }
}

// Tommy Salami: force reroll of enemy 5s and 6s — weighted toward low numbers
// Returns { dice, regulated } where regulated = count of dice rerolled
let regulatorBonus = 0; // +1 damage per rerolled die if Tommy wins this roll
function applyRegulator(dice) {
  let regulated = 0;
  const newDice = dice.map(d => {
    if (d !== 5 && d !== 6) return d;
    regulated++;
    // 70% chance low (1-3), 30% chance mid-high (4)
    const r = Math.random();
    if (r < 0.30) return 1;
    if (r < 0.55) return 2;
    if (r < 0.70) return 3;
    return 4;
  });
  regulatorBonus = regulated;
  return newDice;
}

// Override compareRolls for Hector's Protector (singles beat doubles)
function compareRollsWithAbilities(pRoll, eRoll) {
  const rank = { singles: 0, doubles: 1, triples: 2, quads: 3, penta: 4, sixcity: 5 };

  // Hector: singles beat doubles
  const playerHector = pick && pick.ability === 'Protector';
  const enemyHector = enemy && enemy.ability === 'Protector';

  let pRank = rank[pRoll.type] ?? 0;
  let eRank = rank[eRoll.type] ?? 0;

  // Hector: ALL singles beat doubles in his fights (both sides)
  if ((playerHector || enemyHector) && pRoll.type === 'singles' && eRoll.type === 'doubles') pRank = 1.5;
  if ((playerHector || enemyHector) && eRoll.type === 'singles' && pRoll.type === 'doubles') eRank = 1.5;

  if (pRank !== eRank) return pRank > eRank ? 1 : -1;

  // Same effective rank — compare by value
  if (isTripleOrBetter(pRoll.type)) return pRoll.value > eRoll.value ? 1 : pRoll.value < eRoll.value ? -1 : 0;
  if (pRoll.type === 'doubles' || (pRank === 1.5)) {
    // Compare as doubles or promoted singles — pair value first, then kicker
    const pVal = pRoll.type === 'doubles' ? pRoll.value : pRoll.dice[0];
    const eVal = eRoll.type === 'doubles' ? eRoll.value : eRoll.dice[0];
    if (pVal !== eVal) return pVal > eVal ? 1 : -1;
    // Same pair value — compare kicker
    const pKick = pRoll.kicker || 0;
    const eKick = eRoll.kicker || 0;
    if (pKick !== eKick) return pKick > eKick ? 1 : -1;
    return 0;
  }
  for (let i = 0; i < 3; i++) {
    if (pRoll.dice[i] > eRoll.dice[i]) return 1;
    if (pRoll.dice[i] < eRoll.dice[i]) return -1;
  }
  return 0;
}

// ══════════════════════════════════════════════
// ENEMY ROLL
// ══════════════════════════════════════════════
function doEnemyRoll() {
  phase = 0;
  resetDice();
  for (let i = 3; i < 7; i++) document.getElementById('pDie'+i).style.display = 'none';
  powerMode = 0;
  committedShards = 0; committedFires = 0; // reset for new round
  if (vsMode) { redCommittedShards = 0; redCommittedFires = 0; }

  // Piper Slick Coat: -1 enemy die each round
  if (pick && pick.ability === 'Slick Coat') enemyRemoveDice += 1;
  // Calculate enemy dice count (consumes modifiers)
  const eDiceCount = getEnemyDiceCount();
  // Grace: show splash if Antoinette matches extra dice
  const graceTriggered = enemy && enemy.ability === 'Grace' && eDiceCount > 3;
  enemyBonusDice = 0; enemyRemoveDice = 0;
  // Boss 2-8: 50% chance each round to break off-script permanently
  // Boss 9-11 (Lucy, Romy, Mountain King): 20% — keep the epic scripted arcs more often
  const currentBossIdx = coopMode ? coopState.currentBoss : (state ? state.currentBoss : 0);
  if (bossScript && currentBossIdx >= 2 && bossScriptRound > 0) {
    const breakChance = currentBossIdx >= 9 ? 0.20 : 0.50;
    if (Math.random() < breakChance) bossScript = null;
  }

  let dice = [];
  // Scripted boss fight: use scripted enemy dice (truncated/padded to actual dice count)
  if (bossScript && bossScriptRound < bossScript.enemy.length) {
    dice = [...bossScript.enemy[bossScriptRound]].slice(0, eDiceCount);
    while (dice.length < eDiceCount) dice.push(Math.floor(Math.random()*6)+1);
  } else {
    // Tommy Salami: enemies roll weighted toward 5s and 6s (40% chance each die is 5 or 6)
    if (pick && pick.ability === 'Regulator') {
      for (let i = 0; i < eDiceCount; i++) {
        if (Math.random() < 0.40) {
          dice.push(Math.random() < 0.5 ? 5 : 6);
        } else {
          dice.push(Math.floor(Math.random()*6)+1);
        }
      }
    } else {
      for (let i = 0; i < eDiceCount; i++) dice.push(Math.floor(Math.random()*6)+1);
    }

    // Boss-specific dice boosts (non-scripted rounds)
    if (enemy) {
      // Stone Cold: +10% chance to roll double 1s (One-two-one!)
      if (enemy.ability === 'One-two-one!' && Math.random() < 0.10) {
        dice = [1, 1, Math.floor(Math.random()*6)+1];
      }
      // King Jay: Reflection-focused — showcases his reflect ability
      // Normal: 45% reflect, 25% doubles (no triples), 30% random
      // Rage (<30% HP): 55% reflect, 30% doubles, 15% random
      if (enemy.ability === 'Reflection') {
        const rage = enemyHp <= Math.ceil((enemy.maxHp || enemy.bossHp) * 0.3);
        const reflectChance = rage ? 0.55 : 0.45;
        const doublesChance = rage ? 0.30 : 0.25;
        const r = Math.random();
        if (r < reflectChance) {
          // Force dice total = 7 (Reflection trigger — he loses but reflects damage back)
          const combos = [[1,2,4],[1,3,3],[2,2,3],[1,1,5],[2,3,2],[3,3,1],[4,2,1],[5,1,1]];
          dice = [...combos[Math.floor(Math.random()*combos.length)]];
        } else if (r < reflectChance + doublesChance) {
          // Doubles to win outright (no triples — keep it fair)
          const v = Math.ceil(Math.random()*3)+3; // high doubles (4-6)
          dice = [v, v, Math.floor(Math.random()*4)+1];
        }
        // Remaining %: normal random dice
      }
      // Hector: Protector — strong singles + rage mode below 30% HP
      if (enemy.ability === 'Protector') {
        const rage = enemyHp <= Math.ceil((enemy.maxHp || enemy.bossHp) * 0.3);
        const r = Math.random();
        if (rage) {
          // Rage: 30% high singles (5-6), 25% triples, 20% doubles
          if (r < 0.30) {
            const v = Math.random() < 0.5 ? 6 : 5;
            dice = [v, Math.floor(Math.random()*4)+1, Math.floor(Math.random()*3)+1];
          } else if (r < 0.55) {
            const v = Math.ceil(Math.random()*4)+2;
            dice = [v, v, v];
          } else if (r < 0.75) {
            const v = Math.ceil(Math.random()*3)+3;
            dice = [v, v, Math.floor(Math.random()*6)+1];
          }
        } else {
          // Normal: 40% high singles to exploit Protector (+1 dmg, beats doubles)
          if (r < 0.40) {
            const v = Math.random() < 0.5 ? 6 : 5;
            dice = [v, Math.floor(Math.random()*4)+1, Math.floor(Math.random()*3)+1];
          }
        }
      }
      // Guard Thomas: boost to more competitive rolls (doubles ~25%, triples ~15%)
      if (enemy.ability === 'Stoic') {
        const r = Math.random();
        if (r < 0.15) {
          const v = Math.floor(Math.random()*6)+1;
          dice = [v, v, v]; // triples
        } else if (r < 0.40) {
          const v = Math.floor(Math.random()*6)+1;
          dice = [v, v, Math.floor(Math.random()*6)+1]; // doubles
        }
      }
      // Pelter: +20% chance to roll doubles (Snowball synergy) — capped at 5 to reduce double-6 frequency
      if (enemy.ability === 'Snowball' && Math.random() < 0.20) {
        const v = Math.floor(Math.random()*5)+1;
        dice = [v, v, Math.floor(Math.random()*6)+1];
      }
      // Antoinette: +30% chance to roll doubles (Grace)
      if (enemy.ability === 'Grace' && Math.random() < 0.30) {
        const v = Math.floor(Math.random()*6)+1;
        dice = [v, v, Math.floor(Math.random()*6)+1];
      }
    }
  }

  // Tommy Salami: only reroll actual 5s and 6s the enemy rolled
  // Each rerolled die grants +1 damage if Tommy wins this roll
  if (pick.ability === 'Regulator') {
    dice = applyRegulator(dice);
  } else {
    regulatorBonus = 0;
  }

  // If enemy rolled fewer or more than 3, still analyze best 3 (or all if fewer)
  let analyzeDice = dice.length >= 3 ? bestNOf(dice, 3) : dice;
  currentEnemyRoll = analyzeRoll(analyzeDice);

  // Logey (player): Heinous deferred to nextRound so it doesn't fire on killing blow

  // Bubble Boys: enemy triples = instant defeat
  if (pick.ability === 'Pop' && isTripleOrBetter(currentEnemyRoll.type)) {
    // Will handle after dice animation
  }

  // Boss Romy: pick prediction — 50% chance she "reads" her own dice correctly
  // Piper Slick Coat: negate enemy Valley Guardian prediction
  if (enemy && enemy.ability === 'Valley Guardian' && !vsMode && !(pick && pick.ability === 'Slick Coat')) {
    if (dice.length && Math.random() < 0.50) {
      enemyPrediction = dice[Math.floor(Math.random() * dice.length)];
    } else {
      enemyPrediction = Math.floor(Math.random() * 6) + 1;
    }
  }
  if (enemy && enemy.ability === 'Valley Guardian' && !vsMode && pick && pick.ability === 'Slick Coat') {
    enemyPrediction = null;
  }

  // Show/hide enemy bonus dice slots
  for (let i = 3; i < 7; i++) {
    document.getElementById('eDie'+i).style.display = i < dice.length ? 'flex' : 'none';
  }
  const showCount = Math.min(dice.length, 7);

  const doRollAnimation = () => {
    for (let i = 0; i < showCount; i++) {
      const d = document.getElementById('eDie'+i);
      d.textContent = '?';
      d.classList.add('visible','rolling');
    }

    const rollDelay = round === 1 ? 1100 : 700;

    setTimeout(() => {
    dice.slice(0, showCount).forEach((v, i) => {
      setTimeout(() => {
        const d = document.getElementById('eDie'+i);
        d.classList.remove('rolling');
        d.textContent = v;
        if (currentEnemyRoll.matchDie && v === currentEnemyRoll.matchDie) {
          setTimeout(() => d.classList.add('glow'), 120);
        }
      }, i * 200);
    });

    const extraDelay = isTripleOrBetter(currentEnemyRoll.type) ? 1400 : 0;
    if (isTripleOrBetter(currentEnemyRoll.type)) {
      setTimeout(() => showTriplesEffect('enemy', currentEnemyRoll.type), 700);
    }

    setTimeout(() => {
      // Bubble Boys: if enemy triples, Bubble Boys are defeated
      if (pick.ability === 'Pop' && isTripleOrBetter(currentEnemyRoll.type)) {
        narrate(`<b class="them">${enemy.name}</b>&nbsp;rolled ${describeRoll(currentEnemyRoll)}.&nbsp;&nbsp;<b class="them">Pop! Bubble Boys burst!</b>`);
        playerHp = 0;
        updateHpDisplay();
        setTimeout(() => { fadeOutMusic(); setTimeout(handlePlayerLoss, 1500); }, 800);
        return;
      }

      narrate(`<b class="them">${enemy.name}</b>&nbsp;rolled ${describeRoll(currentEnemyRoll)}.&nbsp;<b class="you">Your turn!</b>`);
      phase = 1;

      // Patrick: Stone Form — don't roll, auto-resolve
      if (pick.ability === 'Stone Form') {
        setTimeout(() => resolvePatrickStoneForm(currentEnemyRoll), 1200);
        return;
      }

      // Valley Guardian: show prediction picker instead of roll button
      if (pick.ability === 'Valley Guardian') {
        playerPrediction = null;
        document.getElementById('predictArea').classList.add('visible');
      } else {
        const rollBtn = document.getElementById('rollBtn');
        if (coopMode) rollBtn.textContent = `Player ${coopTurn} — Roll!`;
        rollBtn.classList.add('ready');
      }
      updateItemUsability();
    }, 800 + extraDelay);
  }, rollDelay);
  }; // end doRollAnimation

  // Romy: announce prediction before rolling to build anticipation
  const romyPredicting = enemy && enemy.ability === 'Valley Guardian' && enemyPrediction && !vsMode;
  // Piper Slick Coat: show negation splash if enemy is Romy but prediction was nullified
  const slickCoatNegatedPrediction = enemy && enemy.ability === 'Valley Guardian' && !enemyPrediction && !vsMode && pick && pick.ability === 'Slick Coat';

  // Grace: show splash before rolling if Antoinette matches extra dice
  if (graceTriggered) {
    showAbilitySplash('Grace', `Matching your ${getPlayerDiceCount()} dice!`, 1400, doRollAnimation, 'enemyCard');
  } else if (slickCoatNegatedPrediction) {
    showAbilitySplash('Slick Coat', 'Prediction negated!', 1400, () => {
      narrate(`<b class="gold">Slick Coat!</b> ${pick.name} negates Valley Guardian!`);
      doRollAnimation();
    }, 'playerCard');
  } else if (romyPredicting) {
    narrate(`<b class="them">${enemy.name} predicts... ${enemyPrediction}!</b>`);
    // Masked Hero: Underdog counters enemy prediction
    if (pick.ability === 'Underdog') {
      showAbilitySplash('Valley Guardian', `"I predict... ${enemyPrediction}!"`, 1600, () => {
        enemyHp -= 3;
        updateHpDisplay();
        showAbilitySplash('Underdog', '3 damage counter!', 1400, () => {
          narrate(`<b class="gold">Underdog!</b> 3 damage to ${enemy.name}!`);
          if (enemyHp <= 0) { setTimeout(enemyDefeated, 600); return; }
          doRollAnimation();
        }, 'playerCard');
      }, 'enemyCard');
    } else {
      showAbilitySplash('Valley Guardian', `"I predict... ${enemyPrediction}!"`, 1600, doRollAnimation, 'enemyCard');
    }
  } else {
    doRollAnimation();
  }
}

// Helper: best N dice from a larger pool
function bestNOf(dice, n) {
  if (dice.length <= n) return [...dice];
  let best = null;
  const combos = getCombinations(dice.length, n);
  for (const combo of combos) {
    const sub = combo.map(i => dice[i]);
    const roll = analyzeRoll(sub);
    if (!best || compareRolls(roll, best) > 0) best = roll;
  }
  return best.dice;
}

function getCombinations(total, choose) {
  const results = [];
  function recurse(start, combo) {
    if (combo.length === choose) { results.push([...combo]); return; }
    for (let i = start; i < total; i++) { combo.push(i); recurse(i+1, combo); combo.pop(); }
  }
  recurse(0, []);
  return results;
}

// Patrick's Stone Form: doesn't roll — if enemy singles, negate + 3 damage
function resolvePatrickStoneForm(eRoll) {
  phase = 4;
  // Advance script round since Patrick skips doPlayerRoll
  if (bossScript) bossScriptRound++;
  if (eRoll.type === 'singles') {
    narrate(`<b class="gold">Stone Form!</b> Singles negated — 3 damage to ${enemy.name}!`);
    setTimeout(() => {
      showAbilitySplash('Stone Form', 'Singles negated! 3 damage!', 1600, () => {
        // Check enemy defense (Bogey reflect, etc.)
        // Use 'ability' type so Stoic doesn't block Stone Form's flat damage
        let damage = 3;
        const stoneFormRoll = { ...eRoll, type: 'ability' };
        const def = applyDefense(enemy, damage, stoneFormRoll, false, eRoll);
        if (def < 0) {
          // Reflected back to Patrick
          damage = -def;
          playerHp -= damage;
          playDamageSfx(damage);
          const reflectName = enemy.ability === 'Bogus' ? 'Bogus!' : 'Reflected!';
          showAbilitySplash(reflectName, `${damage} damage bounced back!`, 2400, () => {
            narrate(`<b class="them">Reflected! ${damage} damage to ${pick.name}!</b>`);
            document.getElementById('playerCard').classList.add('hit');
            setTimeout(() => document.getElementById('playerCard').classList.remove('hit'), 500);
            updateHpDisplay();
            if (playerHp <= 0) {
              setTimeout(() => { narrate(`<b class="them">${pick.name} is defeated!</b>`); fadeOutMusic(); setTimeout(handlePlayerLoss, 1500); }, 600);
            } else setTimeout(nextRound, 1400);
          }, 'enemyCard');
          return;
        }
        damage = def;
        enemyHp -= damage;
        playDamageSfx(damage);
        document.getElementById('enemyCard').classList.add('hit');
        setTimeout(() => document.getElementById('enemyCard').classList.remove('hit'), 500);
        updateHpDisplay();
        if (enemyHp <= 0) { setTimeout(enemyDefeated, 600); }
        else { setTimeout(nextRound, 1400); }
      }, 'playerCard');
    }, 600);
  } else {
    // Patrick takes normal damage from non-singles
    let damage = eRoll.damage;
    damage = applyWinDamage(enemy, pick, eRoll, damage, false, false);
    const def = applyDefense(pick, damage, eRoll, true, null);
    if (def < 0) {
      // Reflected — shouldn't happen for Patrick but handle it
      damage = -def;
      enemyHp -= damage;
    } else {
      damage = def;
      playerHp -= damage;
    }
    playDamageSfx(damage);
    narrate(`<b class="them">${enemy.name}</b> rolled ${describeRoll(eRoll)} — <b class="them">${damage} damage!</b>`);
    document.getElementById(def < 0 ? 'enemyCard' : 'playerCard').classList.add('hit');
    setTimeout(() => document.getElementById(def < 0 ? 'enemyCard' : 'playerCard').classList.remove('hit'), 500);
    updateHpDisplay();
    if (playerHp <= 0) {
      tookDamageLastRound = true;
      setTimeout(() => { narrate(`<b class="them">${pick.name} is defeated!</b>`); fadeOutMusic(); setTimeout(handlePlayerLoss, 1500); }, 600);
    } else {
      tookDamageLastRound = true;
      setTimeout(nextRound, 1400);
    }
  }
}

let enemyPrediction = null;

function highlightBestThree(allDice, bestRoll) {
  // Quads/penta/sixcity: glow ALL matching dice, no discards
  if (['quads','penta','sixcity'].includes(bestRoll.type)) {
    for (let i = 0; i < Math.min(allDice.length, 7); i++) {
      const d = document.getElementById('pDie' + i);
      if (allDice[i] === bestRoll.matchDie) {
        d.classList.add('glow');
      } else {
        d.classList.add('discarded');
      }
    }
    return;
  }
  const bestSet = [...bestRoll.dice];
  // Find a discard index by trying each skip
  let discardIdx = -1;
  for (let skip = 0; skip < allDice.length; skip++) {
    const three = allDice.filter((_, i) => i !== skip).sort((a,b) => b-a);
    if (three.length >= 3 && three[0] === bestSet[0] && three[1] === bestSet[1] && three[2] === bestSet[2]) {
      discardIdx = skip;
      break;
    }
  }
  for (let i = 0; i < Math.min(allDice.length, 7); i++) {
    const d = document.getElementById('pDie' + i);
    if (i === discardIdx) {
      d.classList.add('discarded');
    } else if (bestRoll.matchDie && allDice[i] === bestRoll.matchDie) {
      d.classList.add('glow');
    }
  }
}

// ══════════════════════════════════════════════
// PLAYER ROLL
// ══════════════════════════════════════════════
function doPlayerRoll() {
  if (phase !== 1) return;
  phase = 2;
  document.getElementById('rollBtn').classList.remove('ready');
  playSfx('sfxDiceRoll');
  const sillyRolls = [
    'Rolling... <i>*blows on dice*</i>',
    'Rolling... please be good please be good',
    'Rolling... this one\'s for everything!',
    'Rolling... <i>*shakes dice aggressively*</i>',
    'Rolling... I have a good feeling about this one',
    'Rolling... come on triples come on triples',
    'Rolling... <i>*whispers to dice*</i>',
    'Rolling... don\'t let me down boys',
  ];
  narrate(Math.random() < 0.02 ? sillyRolls[Math.floor(Math.random() * sillyRolls.length)] : 'Rolling...');
  if (coopMode && coopState && coopState.stats) coopState.stats.totalRolls++;
  else if (state && state.stats) state.stats.totalRolls++;

  // Before-rolling abilities now activated via action bar icons (manual)

  // Katrina's Seeker: gain 1 HP if below enemy HP (no cap — can overclock)
  if (pick && pick.ability === 'Seeker' && playerHp < enemyHp) {
    playerHp += 1;
    updateHpDisplay();
    showAbilitySplash('Seeker', `+1 HP! (${playerHp} HP)`, 1200, () => {}, 'playerCard');
  }

  let dieCount = getPlayerDiceCount();
  playerBonusDice = 0; playerRemoveDice = 0; // consumed
  // Show bonus dice elements as needed
  for (let i = 3; i < 7; i++) {
    document.getElementById('pDie'+i).style.display = i < dieCount ? 'flex' : 'none';
  }

  playerDiceValues = [];
  // Scripted boss fight: use scripted player dice
  if (bossScript && bossScriptRound < bossScript.player.length) {
    playerDiceValues = [...bossScript.player[bossScriptRound]];
    // If player has bonus dice beyond what the script provides, add random dice
    while (playerDiceValues.length < dieCount) playerDiceValues.push(Math.floor(Math.random()*6)+1);
    bossScriptRound++;
  } else {
    for (let i = 0; i < dieCount; i++) playerDiceValues.push(Math.floor(Math.random()*6)+1);
  }

  // Kairan: 10% boost to roll doubles (feeds Let's Dance snowball)
  if (pick.ability === "Let's Dance" && Math.random() < 0.10) {
    const v = Math.floor(Math.random()*6)+1;
    playerDiceValues[0] = v;
    playerDiceValues[1] = v;
  }

  // Guard Thomas: player-side luck — 15% triples, 20% doubles boost
  if (pick.ability === 'Stoic') {
    const r = Math.random();
    if (r < 0.15) {
      const v = Math.floor(Math.random()*6)+1;
      playerDiceValues = [v, v, v];
    } else if (r < 0.35) {
      const v = Math.floor(Math.random()*6)+1;
      playerDiceValues[0] = v;
      playerDiceValues[1] = v;
    }
  }

  // Masked Hero: at 1 HP, 40% triples, 30% high doubles — clutch mode
  if (pick.ability === 'Underdog' && playerHp === 1) {
    const r = Math.random();
    if (r < 0.40) {
      const v = Math.ceil(Math.random()*4)+2; // 3-6 triples
      playerDiceValues = playerDiceValues.map(() => v);
    } else if (r < 0.70) {
      const v = Math.ceil(Math.random()*3)+3; // high doubles (4-6)
      playerDiceValues[0] = v;
      playerDiceValues[1] = v;
    }
  }

  // Campaign mode: 1 HP clutch — improved odds for a strong roll (all ghosts)
  // Underdog's stronger boost above takes priority; this is the fallback for everyone else
  if (!vsMode && playerHp === 1 && pick.ability !== 'Underdog') {
    const r = Math.random();
    if (r < 0.20) {
      // 20% chance: force doubles (value 3-6)
      const v = Math.ceil(Math.random() * 4) + 2;
      playerDiceValues[0] = v;
      playerDiceValues[1] = v;
    } else if (r < 0.30) {
      // 10% chance: force triples (value 3-6)
      const v = Math.ceil(Math.random() * 4) + 2;
      playerDiceValues = playerDiceValues.map(() => v);
    }
    // 70% normal — still tense but not guaranteed
  }

  // Dream Cat's Jinx luck: +15% chance to force doubles (synergizes with Jinx passive)
  if (pick.ability === 'Jinx' && Math.random() < 0.15) {
    const v = Math.floor(Math.random()*6)+1;
    playerDiceValues[0] = v;
    playerDiceValues[1] = v;
  }

  // Wim's Slash boost: +15% chance all dice become odd
  if (pick.ability === 'Slash' && !playerDiceValues.every(d => d % 2 === 1) && Math.random() < 0.15) {
    playerDiceValues = playerDiceValues.map(d => d % 2 === 0 ? d - 1 || 1 : d);
  }

  // Roger's Tempest boost: 80% chance to force 2 pairs when rolling 4+ dice
  if (pick.ability === 'Tempest' && playerDiceValues.length >= 4 && Math.random() < 0.80) {
    const v1 = Math.floor(Math.random()*6)+1;
    let v2 = Math.floor(Math.random()*5)+1;
    if (v2 >= v1) v2++; // ensure different pair
    playerDiceValues[0] = v1;
    playerDiceValues[1] = v1;
    playerDiceValues[2] = v2;
    playerDiceValues[3] = v2;
    // Shuffle so it doesn't look rigged
    for (let i = playerDiceValues.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [playerDiceValues[i], playerDiceValues[j]] = [playerDiceValues[j], playerDiceValues[i]];
    }
  }

  // Quad boost: 15% chance to force quads when rolling 4+ dice
  if (playerDiceValues.length >= 4 && pick.ability !== 'Tempest' && Math.random() < 0.15) {
    const v = Math.floor(Math.random()*6)+1;
    playerDiceValues[0] = v;
    playerDiceValues[1] = v;
    playerDiceValues[2] = v;
    playerDiceValues[3] = v;
  }

  // Kodako: check for 1-2-3 before analyzing
  const kodakoTrigger = pick.ability === 'Swift' && playerDiceValues.length >= 3 &&
    [1,2,3].every(v => playerDiceValues.includes(v));

  for (let i = 0; i < Math.min(dieCount, 7); i++) {
    const d = document.getElementById('pDie'+i);
    d.textContent = '?';
    d.classList.add('visible','rolling');
  }

  setTimeout(() => {
    playerDiceValues.forEach((v, i) => {
      if (i >= 7) return;
      setTimeout(() => {
        const d = document.getElementById('pDie'+i);
        if (d) { d.classList.remove('rolling'); d.textContent = v; }
      }, i * 200);
    });

    setTimeout(() => {
      let finalDice;
      if (dieCount > 3) {
        // Check all dice first — quads/penta/sixcity use all matching dice
        const fullRoll = analyzeRoll(playerDiceValues);
        if (['quads','penta','sixcity'].includes(fullRoll.type)) {
          finalDice = [...playerDiceValues];
        } else {
          finalDice = bestNOf(playerDiceValues, 3);
        }
      } else {
        finalDice = [...playerDiceValues];
      }
      const pRoll = analyzeRoll(finalDice);

      // Enemy Logey: lock out player's high dice for next round (deferred to resolveRound so it doesn't fire on killing blow)

      // Highlight dice
      if (dieCount > 3) highlightBestThree(playerDiceValues, pRoll);
      else {
        playerDiceValues.forEach((v, i) => {
          if (pRoll.matchDie && v === pRoll.matchDie) {
            setTimeout(() => document.getElementById('pDie'+i).classList.add('glow'), 120);
          }
        });
      }

      const extraDelay = isTripleOrBetter(pRoll.type) ? 1400 : 0;
      if (isTripleOrBetter(pRoll.type)) {
        setTimeout(() => showTriplesEffect('player', pRoll.type), 200);
      }

      // Kodako: 1-2-3 → negate + 4 damage (override normal resolution)
      if (kodakoTrigger) {
        setTimeout(() => {
          showAbilitySplash('Swift', '1-2-3! Negate damage, deal 4!', 1600, () => {
            enemyHp -= 4;
            playDamageSfx(4);
            narrate(`<b class="gold">Swift! 4 damage to ${enemy.name}!</b>`);
            document.getElementById('enemyCard').classList.add('hit');
            setTimeout(() => document.getElementById('enemyCard').classList.remove('hit'), 500);
            updateHpDisplay();
            if (enemyHp <= 0) setTimeout(enemyDefeated, 600);
            else setTimeout(nextRound, 1400);
          }, 'playerCard');
        }, 400 + extraDelay);
        // Reset bonus dice after use
        playerBonusDice = 0;
        return;
      }

      // Check if reroll is available
      const hasReroll = battleItemsState.some(bi => bi.id === 'reroll' && !bi.used);
      if (hasReroll) {
        phase = 3;
        updateItemUsability();
        startRerollCountdown(3, extraDelay, () => {
          if (phase === 3 && !rerollMode) resolveRound(pRoll, currentEnemyRoll);
        });
      } else {
        setTimeout(() => resolveRound(pRoll, currentEnemyRoll), 400 + extraDelay);
      }
    }, Math.min(dieCount, 7) * 200 + 300);
  }, 700);
}

// ══════════════════════════════════════════════
// RESOLVE ROUND
// ══════════════════════════════════════════════
function resolveRound(pRoll, eRoll) {
  phase = 4; // resolving
  updateItemUsability();

  // Use ability-aware comparison
  const result = compareRollsWithAbilities(pRoll, eRoll);

  // Kairan's Let's Dance: doubles → +1 die next roll (win, lose, or tie)
  if (pick && pick.ability === "Let's Dance" && pRoll.type === 'doubles') {
    playerBonusDice += 1;
    setTimeout(() => showAbilitySplash("Let's Dance", '+1 die next roll!', 1200, () => {}, 'playerCard'), 800);
  }
  // Kairan's Let's Dance (Red/enemy side): doubles → +1 die next roll
  if (vsMode && enemy && enemy.ability === "Let's Dance" && eRoll.type === 'doubles') {
    enemyBonusDice += 1;
    setTimeout(() => showAbilitySplash("Let's Dance", '+1 die next roll!', 1200, () => {}, 'enemyCard'), 1000);
  }

  // Outlaw's Thief: doubles → remove 1 enemy die next turn (win, lose, or tie)
  if (pick && pick.ability === 'Thief' && pRoll.type === 'doubles') {
    enemyRemoveDice += 1;
    setTimeout(() => showAbilitySplash('Thief', `Stole 1 of ${enemy.name}'s dice!`, 1200, () => {}, 'playerCard'), 800);
  }
  if (enemy && enemy.ability === 'Thief' && eRoll.type === 'doubles') {
    playerRemoveDice += 1;
    if (vsMode) {
      setTimeout(() => showAbilitySplash('Thief', `Stole 1 of ${pick.name}'s dice!`, 1200, () => {}, 'enemyCard'), 1000);
    }
  }

  if (result === 0) {
    const vsSlow = vsMode ? 800 : 0;
    if (vsMode) {
      narrate(`Both rolled ${describeRoll(pRoll)}.&nbsp;&nbsp;<b class="gold">${vsNarrateTie()}</b>`);
    } else {
      narrate(`You rolled ${describeRoll(pRoll)}.&nbsp;&nbsp;<b class="gold">Tie! Roll again!</b>`);
    }
    committedShards = 0; committedFires = 0; // wasted on tie
    if (vsMode) { redCommittedShards = 0; redCommittedFires = 0; }
    setTimeout(() => {
      if (vsMode) {
        vsStartBothRolls();
      } else {
        narrate(`<b class="them">${enemy.name}</b>&nbsp;rolls again...`);
        setTimeout(doEnemyRoll, 800);
      }
    }, 1400 + vsSlow);
    return;
  }

  const wasFirstRoll = isFirstRoll;
  isFirstRoll = false;
  const playerWins = result === 1;

  if (playerWins) {
    let baseDmg = pRoll.damage;
    let damage = applyWinDamage(pick, enemy, pRoll, baseDmg, true, wasFirstRoll);
    // Valley Guardian prediction bonus (Slick Coat negates)
    const predictionHit = pick.ability === 'Valley Guardian' && playerPrediction && pRoll.dice.includes(playerPrediction) && !(enemy && enemy.ability === 'Slick Coat');
    if (predictionHit) damage += 3;
    const def = applyDefense(enemy, damage, pRoll, false, eRoll);
    let reflected = false;
    if (def < 0) { reflected = true; damage = -def; }
    else damage = def;

    const abilityTriggered = damage !== baseDmg || reflected || predictionHit;
    const consumedShards = lastShardsConsumed;
    const consumedFires = lastFiresConsumed;

    if (vsMode) {
      narrate(`<b class="you">${pick.name}</b> rolled ${describeRoll(pRoll)}.&nbsp;&nbsp;<b class="gold">${typeLabel(pRoll.type)} Blue takes it!</b>`);
    } else {
      narrate(`You rolled ${describeRoll(pRoll)}.&nbsp;&nbsp;<b class="gold">${typeLabel(pRoll.type)} You win!</b>`);
    }

    const doApplyDamage = () => {
      if (reflected) {
        // Show dramatic reflect splash, then apply damage to player
        const reflectName = enemy.ability === 'Bogus' ? 'Bogus!' : 'Reflected!';
        const reflectDesc = `${damage} damage bounced back!`;
        showAbilitySplash(reflectName, reflectDesc, 2400, () => {
          playerHp -= damage;
          playDamageSfx(damage);
          narrate(`<b class="them">Reflected! ${damage} damage to ${pick.name}!</b>`);
          document.getElementById('playerCard').classList.add('hit');
          setTimeout(() => document.getElementById('playerCard').classList.remove('hit'), 500);
          updateHpDisplay();
          afterLossTriggers(pick, pRoll, damage, true);
          tookDamageLastRound = true;
          if (playerHp <= 0) {
            setTimeout(() => { narrate(`<b class="them">${pick.name} is defeated!</b>`); fadeOutMusic(); setTimeout(handlePlayerLoss, 1500); }, 600);
          } else setTimeout(nextRound, 1400);
        }, 'enemyCard');
        return; // splash handles the rest
      } else if (damage === 0) {
        // Show defender's blocking ability as a splash
        const blockerName = enemy.ability || 'Blocked';
        const blockerDesc = enemy.ability === 'Stoic' ? 'Immune to singles below 6 HP!' : 'Damage negated!';
        showAbilitySplash(blockerName, blockerDesc, 1600, () => {
          narrate(`<b class="them">${enemy.name} blocked the attack!</b>`);
          // Cameron: if damage gets negated, destroy enemy
          if (pick.ability === 'Force of Nature') {
            setTimeout(() => {
              showAbilitySplash('Force of Nature', 'Damage negated — enemy destroyed!', 1600, () => {
                enemyHp = 0; updateHpDisplay(); setTimeout(enemyDefeated, 600);
              }, 'playerCard');
            }, 600);
          } else {
            setTimeout(nextRound, 1400);
          }
        }, 'enemyCard');
        return;
      } else {
        enemyHp -= damage;
        playDamageSfx(damage);
        if (vsMode) {
          narrate(vsNarrateDamage(pick.name, enemy.name, damage));
        } else {
          narrate(`<b class="gold">${damage} damage to ${enemy.name}!</b>`);
        }
        // Skip hit shake if this is a slash kill — slash effect handles its own shake
        if (!(lastKillWasSlash && enemyHp <= 0)) {
          document.getElementById('enemyCard').classList.add('hit');
          setTimeout(() => document.getElementById('enemyCard').classList.remove('hit'), 500);
        }
        updateHpDisplay();

        const winFx = afterWinTriggers(pick, enemy, pRoll, damage, true);


        // Show secondary effects, then check Party Time counter, then continue
        const afterEffects = () => {
          // Enemy Party Time: lose & survive → counter die
          if (enemy.ability === 'Party Time' && enemyHp > 0) {
            setTimeout(() => doBalatronCounter(enemy, 'player'), 800);
            return;
          }
          if (enemyHp <= 0) setTimeout(enemyDefeated, 600);
          else setTimeout(nextRound, 1400);
        };
        if (winFx.length > 0) {
          setTimeout(() => showEffectQueue(winFx, 'playerCard', afterEffects), 600);
        } else {
          afterEffects();
        }
      }
      // Reset per-round dice mods
      // Dice mods consumed in next doEnemyRoll/doPlayerRoll
    };

    // Build splash queue: ability → ice shards → sacred fires → apply damage
    const splashQueue = [];
    if (abilityTriggered && damage > 0 && !reflected && !consumedShards && !consumedFires) {
      splashQueue.push({ ability: pick.ability, desc: pick.abilityDesc, card: 'playerCard' });
    }
    if (consumedShards) {
      splashQueue.push({ ability: 'Ice Shards', desc: `${consumedShards.count} shard${consumedShards.count>1?'s':''} consumed! +${consumedShards.dmg} damage!`, card: 'playerCard' });
    }
    if (consumedFires) {
      splashQueue.push({ ability: 'Sacred Fire', desc: `${consumedFires.count} fire${consumedFires.count>1?'s':''} consumed! +${consumedFires.dmg} damage!`, card: 'playerCard' });
    }

    if (splashQueue.length > 0) {
      const runQueue = (idx) => {
        if (idx >= splashQueue.length) { doApplyDamage(); return; }
        const s = splashQueue[idx];
        showAbilitySplash(s.ability, s.desc, 1400, () => runQueue(idx + 1), s.card);
      };
      setTimeout(() => runQueue(0), 800);
    } else {
      setTimeout(doApplyDamage, 800);
    }

  } else {
    // Enemy wins
    let baseDmg = eRoll.damage;
    let damage = applyWinDamage(enemy, pick, eRoll, baseDmg, false, wasFirstRoll);
    // Enemy Romy: +3 if prediction matches a die (Slick Coat negates)
    if (enemy.ability === 'Valley Guardian' && eRoll.dice && !(pick && pick.ability === 'Slick Coat')) {
      const enemyGuess = enemyPrediction || Math.floor(Math.random() * 6) + 1;
      if (eRoll.dice.includes(enemyGuess)) {
        damage += 3;
        narrate(`<b class="them">Valley Guardian!</b> ${enemy.name} predicted ${enemyGuess} — +3 damage!`);
      }
    }
    const def = applyDefense(pick, damage, eRoll, true, pRoll);
    let reflected = false;
    if (def < 0) { reflected = true; damage = -def; }
    else damage = def;

    const abilityTriggered = damage !== baseDmg || reflected;

    if (vsMode) {
      narrate(`<b class="them">${enemy.name}</b> rolled ${describeRoll(eRoll)}.&nbsp;&nbsp;<b class="them">${typeLabel(eRoll.type)} Red takes it!</b>`);
    } else {
      narrate(`You rolled ${describeRoll(pRoll)}.&nbsp;&nbsp;<b class="them">${enemy.name} wins!</b>`);
    }

    const doApplyDamage = () => {
      if (reflected) {
        const reflectName = pick.ability === 'Bogus' ? 'Bogus!' : 'Reflected!';
        const reflectDesc = `${damage} damage bounced back!`;
        showAbilitySplash(reflectName, reflectDesc, 2400, () => {
          enemyHp -= damage;
          playDamageSfx(damage);
          narrate(`<b class="gold">Reflected! ${damage} damage to ${enemy.name}!</b>`);
          document.getElementById('enemyCard').classList.add('hit');
          setTimeout(() => document.getElementById('enemyCard').classList.remove('hit'), 500);
          updateHpDisplay();
          afterWinTriggers(pick, enemy, eRoll, damage, true);
          if (enemyHp <= 0) setTimeout(enemyDefeated, 600);
          else setTimeout(nextRound, 1400);
        }, 'playerCard');
        return;
      } else if (damage === 0) {
        const blockerName = pick.ability || 'Blocked';
        const blockerDesc = pick.ability === 'Stoic' ? 'Immune to singles below 6 HP!' : 'Damage negated!';
        showAbilitySplash(blockerName, blockerDesc, 1600, () => {
          narrate(`<b class="gold">${pick.name} blocked the attack!</b>`);
          // Cameron enemy: if their damage negated, destroy player
          if (enemy.ability === 'Force of Nature') {
            playerHp = 0; updateHpDisplay();
            setTimeout(() => { narrate(`<b class="them">Force of Nature! ${pick.name} destroyed!</b>`); fadeOutMusic(); setTimeout(handlePlayerLoss, 1500); }, 600);
          } else {
            setTimeout(nextRound, 1400);
          }
        }, 'playerCard');
        return;
      } else {
        playerHp -= damage;
        playDamageSfx(damage);
        if (vsMode) {
          narrate(vsNarrateDamage(enemy.name, pick.name, damage));
        } else {
          narrate(`<b class="them">${damage} damage to ${pick.name}!</b>`);
        }
        document.getElementById('playerCard').classList.add('hit');
        setTimeout(() => document.getElementById('playerCard').classList.remove('hit'), 500);
        updateHpDisplay();

        const loseFx = afterLossTriggers(pick, pRoll, damage, true);
        const enemyWinFx = afterWinTriggers(enemy, pick, eRoll, damage, false);
        const allFx = [...loseFx, ...enemyWinFx];
        tookDamageLastRound = true;

        const afterEffects = () => {
          if (playerHp <= 0) {
            setTimeout(() => { narrate(`<b class="them">${pick.name} is defeated!</b>`); fadeOutMusic(); setTimeout(handlePlayerLoss, 1500); }, 600);
          } else if (pick.ability === 'Party Time' && playerHp > 0) {
            // Player's Party Time: lose & survive → counter die
            setTimeout(() => doBalatronCounter(pick, 'enemy'), 800);
          } else {
            setTimeout(nextRound, 1400);
          }
        };

        if (allFx.length > 0) {
          setTimeout(() => showEffectQueue(allFx, 'playerCard', afterEffects), 600);
        } else {
          afterEffects();
        }
      }
      // Dice mods consumed in next doEnemyRoll/doPlayerRoll
    };

    // Build splash queue for enemy win (VS mode: show Red committed resource splashes)
    const enemySplashQueue = [];
    const consumedShards = lastShardsConsumed;
    const consumedFires = lastFiresConsumed;
    if (abilityTriggered && damage > 0 && !reflected && !consumedShards && !consumedFires) {
      enemySplashQueue.push({ ability: enemy.ability, desc: enemy.abilityDesc, card: 'enemyCard' });
    }
    if (consumedShards) {
      enemySplashQueue.push({ ability: 'Ice Shards', desc: `${consumedShards.count} shard${consumedShards.count>1?'s':''} consumed! +${consumedShards.dmg} damage!`, card: 'enemyCard' });
    }
    if (consumedFires) {
      enemySplashQueue.push({ ability: 'Sacred Fire', desc: `${consumedFires.count} fire${consumedFires.count>1?'s':''} consumed! +${consumedFires.dmg} damage!`, card: 'enemyCard' });
    }

    if (enemySplashQueue.length > 0) {
      const runQueue = (idx) => {
        if (idx >= enemySplashQueue.length) { doApplyDamage(); return; }
        const s = enemySplashQueue[idx];
        showAbilitySplash(s.ability, s.desc, 1400, () => runQueue(idx + 1), s.card);
      };
      setTimeout(() => runQueue(0), 800);
    } else {
      setTimeout(doApplyDamage, 800);
    }
  }
}

// ══════════════════════════════════════════════
// PARTY TIME COUNTER
// ══════════════════════════════════════════════
function doBalatronCounter(ghost, target) {
  const el = document.getElementById('abilitySplash');
  el.className = 'ability-splash party-time';
  playSfx('sfxSpecial', 0.85);
  document.getElementById('splashName').textContent = 'Party Time!';
  document.getElementById('splashDesc').textContent = `${ghost.name} fights back!`;
  const dieArea = document.getElementById('counterDieArea');
  const dieBtn = document.getElementById('counterDieBtn');
  const isPlayerGhost = ghost === pick;
  const abilityCardId = isPlayerGhost ? 'playerCard' : 'enemyCard';
  showAbilityCard(abilityCardId);

  if (isPlayerGhost) {
    dieArea.classList.add('visible');
    dieBtn.textContent = '?';
    dieBtn.className = 'counter-die-btn';
    document.querySelector('.counter-die-label').textContent = 'Tap to roll!';
    counterCallback = (counterDie) => {
      if (target === 'enemy') enemyHp -= counterDie;
      else playerHp -= counterDie;
      setTimeout(() => {
        el.classList.remove('active');
        removeAbilityCard();
        setTimeout(() => {
          narrate(`<b class="you">Party Time!</b>&nbsp;Counter roll:&nbsp;<b class="gold">${counterDie} damage!</b>`);
          playDamageSfx(counterDie);
          document.getElementById(target === 'enemy' ? 'enemyCard' : 'playerCard').classList.add('hit');
          setTimeout(() => document.getElementById(target === 'enemy' ? 'enemyCard' : 'playerCard').classList.remove('hit'), 500);
          updateHpDisplay();
          checkAfterCounter();
        }, 300);
      }, 800);
    };
  } else {
    dieArea.classList.add('visible');
    dieBtn.textContent = '?';
    dieBtn.className = 'counter-die-btn rolling';
    document.querySelector('.counter-die-label').textContent = 'Rolling...';
    counterCallback = null;
    setTimeout(() => {
      const counterDie = Math.floor(Math.random()*6)+1;
      dieBtn.classList.remove('rolling');
      dieBtn.classList.add('landed');
      dieBtn.textContent = counterDie;
      document.querySelector('.counter-die-label').textContent = `${counterDie} damage!`;
      if (target === 'enemy') enemyHp -= counterDie;
      else playerHp -= counterDie;
      setTimeout(() => {
        el.classList.remove('active');
        removeAbilityCard();
        setTimeout(() => {
          narrate(`<b class="them">Party Time!</b>&nbsp;Counter roll:&nbsp;<b class="gold">${counterDie} damage!</b>`);
          playDamageSfx(counterDie);
          document.getElementById(target === 'enemy' ? 'enemyCard' : 'playerCard').classList.add('hit');
          setTimeout(() => document.getElementById(target === 'enemy' ? 'enemyCard' : 'playerCard').classList.remove('hit'), 500);
          updateHpDisplay();
          checkAfterCounter();
        }, 300);
      }, 1000);
    }, 1200);
  }

  el.classList.add('active');
}

function rollCounterDie() {
  if (!counterCallback) return;
  const dieBtn = document.getElementById('counterDieBtn');
  if (dieBtn.classList.contains('landed')) return;
  dieBtn.classList.add('rolling');
  document.querySelector('.counter-die-label').textContent = 'Rolling...';
  const counterDie = Math.floor(Math.random()*6)+1;
  setTimeout(() => {
    dieBtn.classList.remove('rolling');
    dieBtn.classList.add('landed');
    dieBtn.textContent = counterDie;
    document.querySelector('.counter-die-label').textContent = `${counterDie} damage!`;
    const cb = counterCallback;
    counterCallback = null;
    setTimeout(() => cb(counterDie), 600);
  }, 600);
}

function checkAfterCounter() {
  if (enemyHp <= 0) {
    setTimeout(enemyDefeated, 600);
  } else if (playerHp <= 0) {
    setTimeout(() => { narrate(`<b class="them">${pick.name} is defeated!</b>`); fadeOutMusic(); setTimeout(handlePlayerLoss, 1500); }, 600);
  } else {
    setTimeout(nextRound, 1200);
  }
}

function nextRound() {
  // Co-op: switch turns after each roll exchange. Increment round for the
  // active player BEFORE swap/save so their bucket records the new round
  // number (needed for abilities like Shade's Haunt which checks round > 1).
  if (coopMode) {
    round++;
    coopSyncFromBattle();
    updateCoopPanels();
    coopNextTurn();
    return;
  }
  round++;
  lastKillWasSlash = false;
  committedShards = 0;
  committedFires = 0;
  if (vsMode) { redCommittedShards = 0; redCommittedFires = 0; }
  renderBattleActionBar();

  // Heinous: lock out opponent's high dice
  // Boss Logey: fires once max per fight so it's not overwhelming for new players
  // Piper Slick Coat: negate enemy Heinous
  if (enemy && enemy.ability === 'Heinous' && enemyHp > 0 && playerDiceValues.length && !enemyHeinousUsed && !(pick && pick.ability === 'Slick Coat')) {
    enemyHeinousUsed = true;
    // Show splash, then continue the rest of nextRound after it finishes
    const pRollForHeinous = analyzeRoll(playerDiceValues);
    const highCount = pRollForHeinous.dice.filter(d => d >= 5).length;
    if (highCount > 0) {
      playerRemoveDice += highCount;
      // Masked Hero: Underdog counters enemy Heinous
      if (pick.ability === 'Underdog') {
        showAbilitySplash('Heinous', `${highCount} dice locked out!`, 1600, () => {
          narrate(`<b class="them">Heinous!</b> ${highCount} of your dice locked!`);
          enemyHp -= 3;
          updateHpDisplay();
          setTimeout(() => {
            showAbilitySplash('Underdog', '3 damage counter!', 1400, () => {
              narrate(`<b class="gold">Underdog!</b> 3 damage to ${enemy.name}!`);
              if (enemyHp <= 0) { setTimeout(enemyDefeated, 600); return; }
              setTimeout(() => continueNextRound(), 600);
            }, 'playerCard');
          }, 400);
        }, 'enemyCard');
        return;
      }
      showAbilitySplash('Heinous', `${highCount} dice locked out!`, 1600, () => {
        narrate(`<b class="them">Heinous!</b> ${highCount} of your dice locked!`);
        setTimeout(() => continueNextRound(), 600);
      }, 'enemyCard');
      return;
    }
  }
  // Piper Slick Coat: narrate negation of enemy Heinous
  if (enemy && enemy.ability === 'Heinous' && enemyHp > 0 && playerDiceValues.length && !enemyHeinousUsed && pick && pick.ability === 'Slick Coat') {
    enemyHeinousUsed = true;
    const pRollForHeinous = analyzeRoll(playerDiceValues);
    const highCount = pRollForHeinous.dice.filter(d => d >= 5).length;
    if (highCount > 0) {
      showAbilitySplash('Slick Coat', 'Heinous negated!', 1400, () => {
        narrate(`<b class="gold">Slick Coat!</b> ${pick.name} negates Heinous!`);
        setTimeout(() => continueNextRound(), 600);
      }, 'playerCard');
      return;
    }
  }
  // Player-owned Logey: fires every round
  // Piper Slick Coat (enemy): negate player Heinous
  if (pick.ability === 'Heinous' && playerHp > 0 && currentEnemyRoll && !(enemy && enemy.ability === 'Slick Coat')) {
    const highCount = currentEnemyRoll.dice.filter(d => d >= 5).length;
    if (highCount > 0) {
      enemyRemoveDice += highCount;
      // VS: Red Underdog counters Blue Heinous
      if (vsMode && enemy.ability === 'Underdog') {
        showAbilitySplash('Heinous', `${highCount} dice locked out!`, 1600, () => {
          narrate(`<b class="gold">Heinous!</b> ${highCount} of ${enemy.name}'s dice locked!`);
          playerHp -= 3;
          updateHpDisplay();
          setTimeout(() => {
            showAbilitySplash('Underdog', '3 damage counter!', 1400, () => {
              narrate(`<b class="them">Underdog!</b> 3 damage to ${pick.name}!`);
              if (playerHp <= 0) { if (vsMode) { vsHandleLoss(); } else { setTimeout(handlePlayerLoss, 600); } return; }
              if (enemyHp <= 0) { setTimeout(enemyDefeated, 600); return; }
              setTimeout(() => continueNextRound(), 600);
            }, 'enemyCard');
          }, 400);
        }, 'playerCard');
        return;
      }
      showAbilitySplash('Heinous', `${highCount} dice locked out!`, 1600, () => {
        narrate(`<b class="gold">Heinous!</b> ${highCount} of ${enemy.name}'s dice locked!`);
        setTimeout(() => continueNextRound(), 600);
      }, 'playerCard');
      return;
    }
  }
  // Piper Slick Coat (enemy): narrate negation of player Heinous
  if (pick.ability === 'Heinous' && playerHp > 0 && currentEnemyRoll && enemy && enemy.ability === 'Slick Coat') {
    const highCount = currentEnemyRoll.dice.filter(d => d >= 5).length;
    if (highCount > 0) {
      showAbilitySplash('Slick Coat', 'Heinous negated!', 1400, () => {
        narrate(`<b class="them">Slick Coat!</b> ${enemy.name} negates Heinous!`);
        setTimeout(() => continueNextRound(), 600);
      }, 'enemyCard');
      return;
    }
  }

  continueNextRound();
}

function continueNextRound() {
  // Haunt: after first roll, opponent takes 1 damage before each roll
  if (round > 1) {
    if (pick.ability === 'Haunt' && !(enemy && enemy.ability === 'Slick Coat')) {
      enemyHp -= 1;
      updateHpDisplay();
      narrate(`<b class="gold">Haunt!</b> ${enemy.name} takes 1 damage!`);
      if (enemyHp <= 0) { setTimeout(enemyDefeated, 600); return; }
      // VS: Red Underdog counters Blue Haunt
      if (vsMode && enemy.ability === 'Underdog') {
        playerHp -= 3;
        updateHpDisplay();
        setTimeout(() => {
          showAbilitySplash('Underdog', '3 damage counter!', 1400, () => {
            narrate(`<b class="them">Underdog!</b> 3 damage to ${pick.name}!`);
            if (playerHp <= 0) { if (vsMode) { vsHandleLoss(); } else { setTimeout(handlePlayerLoss, 600); } return; }
            if (enemyHp <= 0) { setTimeout(enemyDefeated, 600); return; }
            setTimeout(vsStartBothRolls, 800);
          }, 'enemyCard');
        }, 800);
        return;
      }
      if (vsMode) { setTimeout(vsStartBothRolls, 1200); return; }
      setTimeout(doEnemyRoll, 1200);
      return;
    }
    // Piper Slick Coat (enemy): negate player Haunt
    if (pick.ability === 'Haunt' && enemy && enemy.ability === 'Slick Coat') {
      showAbilitySplash('Slick Coat', 'Haunt negated!', 1400, () => {
        narrate(`<b class="them">Slick Coat!</b> ${enemy.name} negates Haunt!`);
        if (vsMode) { setTimeout(vsStartBothRolls, 800); } else { setTimeout(doEnemyRoll, 800); }
      }, 'enemyCard');
      return;
    }
    if (enemy.ability === 'Haunt' && !(pick && pick.ability === 'Slick Coat')) {
      playerHp -= 1;
      updateHpDisplay();
      narrate(`<b class="them">Haunt!</b> ${pick.name} takes 1 damage!`);
      // Masked Hero: Underdog counters enemy before-rolling effects
      if (pick.ability === 'Underdog') {
        enemyHp -= 3;
        updateHpDisplay();
        setTimeout(() => {
          showAbilitySplash('Underdog', '3 damage counter!', 1400, () => {
            narrate(`<b class="gold">Underdog!</b> 3 damage to ${enemy.name}!`);
            if (enemyHp <= 0) { setTimeout(enemyDefeated, 600); return; }
            if (playerHp <= 0) { setTimeout(() => { fadeOutMusic(); setTimeout(handlePlayerLoss, 1500); }, 600); return; }
            if (vsMode) vsStartBothRolls(); else doEnemyRoll();
          }, 'playerCard');
        }, 800);
        return;
      }
      if (playerHp <= 0) {
        setTimeout(() => { fadeOutMusic(); setTimeout(handlePlayerLoss, 1500); }, 600);
        return;
      }
    }
    // Piper Slick Coat (player): negate enemy Haunt
    if (enemy.ability === 'Haunt' && pick && pick.ability === 'Slick Coat') {
      showAbilitySplash('Slick Coat', 'Haunt negated!', 1400, () => {
        narrate(`<b class="gold">Slick Coat!</b> ${pick.name} negates Haunt!`);
        if (vsMode) { setTimeout(vsStartBothRolls, 800); } else { setTimeout(doEnemyRoll, 800); }
      }, 'playerCard');
      return;
    }
  }

  if (vsMode) {
    setTimeout(vsStartBothRolls, 2800);
  } else {
    narrate(`<b class="them">${enemy.name}</b>&nbsp;rolls...`);
    setTimeout(doEnemyRoll, 800);
  }
}

// ══════════════════════════════════════════════
// WIN / LOSS HANDLING
// ══════════════════════════════════════════════
let lastKillWasSlash = false;
