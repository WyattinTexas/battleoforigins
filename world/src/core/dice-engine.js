// ══════════════════════════════════════════════════════════
//  DICE ENGINE — Classification, comparison, weighted rolls
//  Ported from testroom2 (drbango.com/testroom2/)
//  Pure logic — no DOM, no rendering
// ══════════════════════════════════════════════════════════

// Roll n dice (1-6 each), sorted ascending
function rollDice(n) {
  const d = [];
  for (let i = 0; i < n; i++) d.push(Math.floor(Math.random() * 6) + 1);
  return d.sort((a, b) => a - b);
}

// Weighted roll — cinematic luck system
// Subtle nudges that make tight moments more exciting:
// - 1 HP: 25% chance of forced doubles (3-6 value) — clutch comeback energy
// - 2 HP: 15% chance of forced doubles — still dangerous but not as desperate
// - 5+ dice: 10% penta nudge — reward the player for earning extra dice
// - General: low HP rolls get a slight quality boost (reroll lowest die if below average)
function weightedRoll(teamObj, count) {
  const dice = [];
  for (let i = 0; i < count; i++) dice.push(Math.floor(Math.random() * 6) + 1);

  // Need a fighter reference for HP-based weighting
  const f = teamObj && teamObj.ghosts ? teamObj.ghosts[teamObj.activeIdx] : null;

  // Penta nudge: 5+ dice → 10% chance all dice match (huge cinematic moment)
  if (count >= 5 && Math.random() < 0.10) {
    const v = Math.ceil(Math.random() * 4) + 2; // 3–6 for exciting penta
    for (let i = 0; i < dice.length; i++) dice[i] = v;
    return dice.sort((a, b) => a - b);
  }

  // Clutch doubles: low HP → chance of forced doubles
  if (f && f.hp === 1 && Math.random() < 0.25) {
    const v = Math.ceil(Math.random() * 4) + 2; // 3–6
    dice[0] = v;
    if (dice.length >= 2) dice[1] = v;
  } else if (f && f.hp === 2 && Math.random() < 0.15) {
    const v = Math.ceil(Math.random() * 4) + 2;
    dice[0] = v;
    if (dice.length >= 2) dice[1] = v;
  }

  // Low HP quality boost: if at 1-2 HP, reroll the lowest die if it's below 3
  if (f && f.hp <= 2 && f.hp > 0 && dice.length >= 2) {
    const minIdx = dice.indexOf(Math.min(...dice));
    if (dice[minIdx] <= 2 && Math.random() < 0.30) {
      dice[minIdx] = Math.ceil(Math.random() * 3) + 3; // reroll to 4-6
    }
  }

  return dice.sort((a, b) => a - b);
}

// Classify a dice roll into type + value + damage
// Returns: { type, value, damage }
// Types: 'singles' (1), 'doubles' (2), 'triples' (3), 'quads' (4),
//        'penta' (5), 'N-of-a-kind' (6+)
function classify(dice) {
  if (!dice || !dice.length) return { type: 'none', value: 0, damage: 0 };
  if (dice.length === 1) return { type: 'singles', value: dice[0], damage: 1 };

  const c = {};
  dice.forEach(d => c[d] = (c[d] || 0) + 1);
  const mx = Math.max(...Object.values(c));
  const vals = Object.entries(c).filter(([, v]) => v === mx).map(([k]) => +k);
  const mv = Math.max(...vals);

  if (mx >= 6) return { type: mx + '-of-a-kind', value: mv, damage: mx };
  if (mx >= 5) return { type: 'penta', value: mv, damage: 5 };
  if (mx >= 4) return { type: 'quads', value: mv, damage: 4 };
  if (mx >= 3) return { type: 'triples', value: mv, damage: 3 };
  if (mx >= 2) return { type: 'doubles', value: mv, damage: 2 };
  return { type: 'singles', value: Math.max(...dice), damage: 1 };
}

// Compare two classified rolls — returns 'red', 'blue', or null (tie)
// Uses cascading tiebreakers: type rank → matched value → remaining dice high-to-low
// hectorActive: if true, singles beat doubles (Hector 96 — Protector)
function compareRolls(rR, bR, redDice, blueDice, hectorActive) {
  const typeRank = { penta: 5, quads: 4, triples: 3, doubles: 2, singles: 1, none: 0 };
  function getRank(type) {
    if (typeRank[type] !== undefined) return typeRank[type];
    if (type.endsWith('-of-a-kind')) return parseInt(type); // 6-of-a-kind → 6
    return 0;
  }

  // Hector: singles promote to 2.5 (beats doubles, loses to triples+)
  const rEffRank = (hectorActive && rR.type === 'singles' && bR.type === 'doubles') ? 2.5 : getRank(rR.type);
  const bEffRank = (hectorActive && bR.type === 'singles' && rR.type === 'doubles') ? 2.5 : getRank(bR.type);

  if (rEffRank > bEffRank) return 'red';
  if (bEffRank > rEffRank) return 'blue';
  if (rR.value > bR.value) return 'red';
  if (bR.value > rR.value) return 'blue';

  // Same hand type AND same value — cascading tiebreaker on remaining dice
  const rRemain = [...(redDice || [])];
  const bRemain = [...(blueDice || [])];
  const matchCount = { doubles: 2, triples: 3, quads: 4, penta: 5, singles: 1, none: 0 }[rR.type] || 0;
  for (let i = 0; i < matchCount; i++) {
    const ri = rRemain.indexOf(rR.value);
    if (ri >= 0) rRemain.splice(ri, 1);
    const bi = bRemain.indexOf(bR.value);
    if (bi >= 0) bRemain.splice(bi, 1);
  }
  rRemain.sort((a, b) => b - a);
  bRemain.sort((a, b) => b - a);
  const maxLen = Math.max(rRemain.length, bRemain.length);
  for (let i = 0; i < maxLen; i++) {
    const rv = i < rRemain.length ? rRemain[i] : 0;
    const bv = i < bRemain.length ? bRemain[i] : 0;
    if (rv > bv) return 'red';
    if (bv > rv) return 'blue';
  }

  return null; // true tie
}

// Describe a roll result for display
function describeRoll(r) {
  if (r.type.endsWith('-of-a-kind')) return `${r.damage} ${r.value}'s!!!`;
  if (r.type === 'penta') return `five ${r.value}'s!`;
  if (r.type === 'quads') return `four ${r.value}'s!`;
  if (r.type === 'triples') return `three ${r.value}'s`;
  if (r.type === 'doubles') return `two ${r.value}'s`;
  return `${r.value} high`;
}

// Roll type label for UI display
function typeLabel(type) {
  if (type.endsWith('-of-a-kind')) return type.toUpperCase() + '!!!';
  if (type === 'penta') return 'PENTA!!';
  if (type === 'quads') return 'QUADS!';
  if (type === 'triples') return 'TRIPLES!';
  if (type === 'doubles') return 'DOUBLES!';
  return '';
}

// Check if a roll type is triples or better
function isTripleOrBetter(type) {
  return ['triples', 'quads', 'penta'].includes(type) || type.endsWith('-of-a-kind');
}

// Moonstone optimization — find the best die to change to maximize hand
function smartMoonstoneChange(dice) {
  if (!dice || dice.length === 0) return dice;
  // Find the most common value, then change the lowest non-matching die to that value
  const c = {};
  dice.forEach(d => c[d] = (c[d] || 0) + 1);
  const bestVal = +Object.entries(c).sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];
  // Find the lowest die that ISN'T the best value and change it
  for (let i = 0; i < dice.length; i++) {
    if (dice[i] !== bestVal) {
      dice[i] = bestVal;
      break;
    }
  }
  return dice.sort((a, b) => a - b);
}

// Lucky Stone — reroll the lowest die (aim for 4-6)
function smartLuckyStone(dice) {
  if (!dice || dice.length === 0) return dice;
  const minIdx = dice.indexOf(Math.min(...dice));
  dice[minIdx] = Math.floor(Math.random() * 6) + 1;
  return dice.sort((a, b) => a - b);
}
