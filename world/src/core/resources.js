// ══════════════════════════════════════════════════════════
//  RESOURCE SYSTEM — Commitment, consumption, caps
//  Ported from testroom2 (drbango.com/testroom2/)
//  Resources: ice, fire, surge, moonstone, luckyStone,
//             healingSeed, burn, firefly, frostbite
// ══════════════════════════════════════════════════════════

// Default resource set for a new team
function makeDefaultResources() {
  return {
    ice: 0,
    fire: 0,
    surge: 0,
    moonstone: 0,
    luckyStone: 0,
    healingSeed: 0,
    burn: 0,
    firefly: 0,
    frostbite: 0,
  };
}

// Default committed bucket
function makeDefaultCommitted() {
  return {
    ice: 0,
    fire: 0,
    surge: 0,
    auntSusan: 0,
    auntSusanHeal: 0,
    harrison: 0,
    zainBlade: 0,
  };
}

// Resource caps (enforced each render frame)
const RESOURCE_CAPS = {
  moonstone: 1,
  firefly: 1,
  surge: 99, // uncapped in storage, capped at 2 when committing
};

// Max surge commit per round
const SURGE_COMMIT_CAP = 2;

// Enforce global caps on a team's resources
function enforceResourceCaps(team) {
  if (!team || !team.resources) return;
  if (team.resources.moonstone > RESOURCE_CAPS.moonstone) {
    team.resources.moonstone = RESOURCE_CAPS.moonstone;
  }
  if ((team.resources.firefly || 0) > RESOURCE_CAPS.firefly) {
    team.resources.firefly = RESOURCE_CAPS.firefly;
  }
}

// Cycle-commit a resource (click to commit, click again to uncommit)
// type = 'ice' | 'fire' | 'surge'
// Returns the new committed count
function cycleCommit(teamName, type) {
  if (!B) return 0;
  const t = B[teamName];
  const c = B.committed[teamName];
  if (!t || !c) return 0;

  const f = t.ghosts[t.activeIdx];
  const total = (t.resources[type] || 0) + (c[type] || 0);
  if (total <= 0) return 0;

  // Surge cap: max 2 committed
  if (type === 'surge' && c.surge >= SURGE_COMMIT_CAP) {
    // Uncommit all
    t.resources.surge += c.surge;
    c.surge = 0;
    return 0;
  }

  // Sylvia (313) — Free Ice Shards: commit without consuming
  if (type === 'ice' && f && f.id === 313) {
    const sylviaIceMax = t.resources.ice;
    if (c.ice < sylviaIceMax) {
      c.ice++;
    } else {
      c.ice = 0;
    }
  } else {
    c[type] = (c[type] || 0) + 1;
    t.resources[type]--;
    if (c[type] > total) {
      t.resources[type] = total;
      c[type] = 0;
    }
  }
  return c[type];
}

// Refund all committed resources back to team (on round reset or battle end)
function refundCommitted(teamNames) {
  const sides = teamNames || (B.red ? ['red', 'blue'] : ['player', 'enemy']);
  sides.forEach(team => {
    const t = B[team];
    const c = B.committed[team];
    if (!t || !c) return;
    const f = t.ghosts[t.activeIdx];

    // Sylvia (313) — ice was never consumed, don't refund
    if (!(f && f.id === 313)) {
      t.resources.ice = (t.resources.ice || 0) + (c.ice || 0);
    }
    t.resources.fire = (t.resources.fire || 0) + (c.fire || 0);
    t.resources.surge = (t.resources.surge || 0) + (c.surge || 0);
    t.resources.healingSeed = (t.resources.healingSeed || 0) +
      (c.auntSusan || 0) + (c.auntSusanHeal || 0) + (c.harrison || 0);

    B.committed[team] = makeDefaultCommitted();
  });
}

// Spend a healing seed to heal 1 willpower (pre-roll only)
// Returns true if heal was applied
function spendHealingSeed(teamName, logFn) {
  if (!B) return false;
  const t = B[teamName];
  if (!t) return false;
  const f = t.ghosts[t.activeIdx];
  if (!f || (t.resources.healingSeed || 0) <= 0) return false;
  if (f.hp >= f.maxHp) return false;

  // Dark Fang (202) — Pressure: blocks healing
  if (typeof deathHowlBlocksHealing === 'function' && deathHowlBlocksHealing(teamName)) {
    t.resources.healingSeed--;
    if (logFn) logFn(`Dark Fang — Pressure! ${f.name}'s Healing Seed consumed but healing blocked!`);
    return false;
  }

  t.resources.healingSeed--;
  if (typeof wpHeal === 'function') wpHeal(f, 1);
  if (logFn) logFn(`${f.name} used a Healing Seed! Healed to ${f.hp} HP.`);
  return true;
}

// Calculate total bonus damage from committed resources
function getCommittedDamageBonus(teamName) {
  if (!B || !B.committed || !B.committed[teamName]) return 0;
  const c = B.committed[teamName];
  let bonus = 0;
  bonus += (c.ice || 0);       // +1 per ice
  bonus += (c.fire || 0) * 3;  // +3 per sacred fire
  // Bonanza willpower card bonus
  if (B.wpBonanza && B.wpBonanza[teamName]) {
    bonus += B.wpBonanza[teamName];
  }
  return bonus;
}

// Get extra dice from committed surge
function getCommittedExtraDice(teamName) {
  if (!B || !B.committed || !B.committed[teamName]) return 0;
  return B.committed[teamName].surge || 0;
}

// Resource display info for UI
const RESOURCE_DISPLAY = {
  ice:         { emoji: '❄️', label: 'Ice',          color: '#4488cc' },
  fire:        { emoji: '🔥', label: 'Sacred Fire',  color: '#ff6644' },
  surge:       { emoji: '⚡', label: 'Surge',        color: '#aa66ff' },
  moonstone:   { emoji: '💎', label: 'Moonstone',    color: '#44dddd' },
  luckyStone:  { emoji: '🍀', label: 'Lucky Stone',  color: '#44cc44' },
  healingSeed: { emoji: '🌱', label: 'Seed',         color: '#66aa44' },
  burn:        { emoji: '🔥', label: 'Burn',         color: '#cc4400' },
  firefly:     { emoji: '✨', label: 'Firefly',      color: '#ffcc44' },
  frostbite:   { emoji: '❄️', label: 'Frostbite',    color: '#88bbdd' },
};

// ── Moonstone: change one die to a 6 (pre-roll commit, applied after roll) ──
function useMoonstone(teamName, logFn) {
  if (!B) return false;
  const t = B[teamName];
  if (!t || (t.resources.moonstone || 0) <= 0) return false;
  // Mark moonstone as committed — applied in smartMoonstoneChange after dice roll
  if (!B._moonstoneReady) B._moonstoneReady = {};
  B._moonstoneReady[teamName] = true;
  t.resources.moonstone--;
  if (logFn) logFn('Moonstone committed! Lowest die will become a 6.');
  return true;
}

// ── Lucky Stone: reroll lowest die (pre-roll commit, applied after roll) ──
function useLuckyStone(teamName, logFn) {
  if (!B) return false;
  const t = B[teamName];
  if (!t || (t.resources.luckyStone || 0) <= 0) return false;
  if (!B._luckyStoneReady) B._luckyStoneReady = {};
  B._luckyStoneReady[teamName] = true;
  t.resources.luckyStone--;
  if (logFn) logFn('Lucky Stone committed! Lowest die will be rerolled.');
  return true;
}

// ── Apply moonstone after roll: change lowest die to 6 ──
function smartMoonstoneChange(diceArray) {
  if (!B || !B._moonstoneReady) return;
  // Find which team this belongs to by checking both
  ['red', 'blue'].forEach(team => {
    if (B._moonstoneReady[team]) {
      B._moonstoneReady[team] = false;
      // Change the lowest die to 6
      let minIdx = 0;
      for (let i = 1; i < diceArray.length; i++) {
        if (diceArray[i] < diceArray[minIdx]) minIdx = i;
      }
      diceArray[minIdx] = 6;
    }
  });
}

// ── Apply lucky stone after roll: reroll lowest die ──
function smartLuckyStone(diceArray) {
  if (!B || !B._luckyStoneReady) return;
  ['red', 'blue'].forEach(team => {
    if (B._luckyStoneReady[team]) {
      B._luckyStoneReady[team] = false;
      // Reroll the lowest die
      let minIdx = 0;
      for (let i = 1; i < diceArray.length; i++) {
        if (diceArray[i] < diceArray[minIdx]) minIdx = i;
      }
      diceArray[minIdx] = Math.ceil(Math.random() * 6);
    }
  });
}
