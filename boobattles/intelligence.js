// ══════════════════════════════════════════════════════════════════════════════
// INTELLIGENCE — Boss AI scripts, dice variation, ghost draw system
// ══════════════════════════════════════════════════════════════════════════════

// Boss 0 scripts vary by starter ghost — MUST total enough damage to kill Logey (6 HP)
const BOSS0_SCRIPTS = {
  // Dream Cat (Jinx): R1 doubles win, R2 both doubles → Jinx!, R3 triples with bonus die → kill
  // No 5s or 6s in player dice — keeps Logey's Heinous from triggering
  'Dream Cat': {
    enemy:  [[3,2,1], [1,1,4], [2,1,3]],
    player: [[1,1,3], [2,2,3], [4,4,4]]
    // R1: P doubles(1) wins → 2 dmg (4/6)
    // R2: P doubles(2) beats E doubles(1). Both doubles → JINX! +1 die! → 2 dmg (2/6)
    // R3: P triples(4) + bonus die → 3 dmg. DEAD! Overkill!
  },
  // Outlaw (Thief): R1 doubles → Thief steals die, R2 doubles, R3 doubles → kill
  // No 5s or 6s in player dice — keeps Logey's Heinous from triggering
  'Outlaw': {
    enemy:  [[3,1,2], [3,1,2], [2,1,3]],
    player: [[2,2,4], [1,1,3], [4,4,2]]
    // R1: P doubles(2) wins → 2 dmg (4/6). THIEF steals a die!
    // R2: E has 2 dice [3,1]. P doubles(1) wins → 2 dmg (2/6)
    // R3: P doubles(4) wins → 2 dmg (0/6). DEAD!
  },
  // Wim (Slash): R1 doubles win, R2 all-odd → SLASH +5 = 7 dmg instant kill!
  // No 5s or 6s in player dice — keeps Logey's Heinous from triggering
  'Wim': {
    enemy:  [[3,2,1], [2,1,3]],
    player: [[2,2,4], [3,1,1]]
    // R1: P doubles(2) wins → 2 dmg (4/6)
    // R2: P[3,1,1] all odd! SLASH +5! → 7 dmg! DEAD in 2 rounds!
  }
};

// Boss 1: Bogey (7 HP, Bogus — reflect once). Total P dmg: 2+2+2+1=7 ✓
// Arc: Player leads → reflect SURPRISE → enemy hits → player low → comeback
const BOSS1_SCRIPT = {
  enemy:  [[3,2,1], [2,1,3], [5,5,2], [3,1,2], [2,1,3], [1,3,2]],
  player: [[4,4,6], [5,5,3], [4,3,1], [6,6,4], [5,5,4], [6,4,3]]
  // R1: P doubles(4) wins → 2 dmg (Bogey 5/7)
  // R2: P doubles(5) wins → 2 dmg BUT REFLECTED! Player takes 2!
  // R3: E doubles(5) wins → 2 dmg to player. DOWN LOW!
  // R4: P doubles(6) wins → 2 dmg (Bogey 3/7). COMEBACK!
  // R5: P doubles(5) wins → 2 dmg (Bogey 1/7)
  // R6: P singles(6) wins → 1 dmg. BOGEY DEAD!
};

// Boss 2: Guard Thomas (9 HP, Stoic). Total P dmg: 2+2+0+2+2+2=10 (>9) ✓
// Arc: Push below 6 → STOIC blocks! → forced doubles → grind win
const BOSS2_SCRIPT = {
  enemy:  [[3,2,1], [2,1,3], [5,4,2], [3,2,1], [5,5,3], [3,1,2], [2,1,3], [1,2,3]],
  player: [[4,4,6], [5,5,4], [4,3,1], [6,5,4], [4,2,1], [6,6,4], [4,4,5], [5,5,6]]
  // R1: P doubles(4) → 2 dmg (GT 7/9)
  // R2: P doubles(5) → 2 dmg (GT 5/9). BELOW 6!
  // R3: E singles(5) → 1 dmg to player
  // R4: P singles(6) wins... STOIC BLOCKS! 0 dmg!
  // R5: E doubles(5) → 2 dmg to player. Pressure!
  // R6: P doubles(6) → 2 dmg (GT 3/9). Through!
  // R7: P doubles(4) → 2 dmg (GT 1/9)
  // R8: P doubles(5) → 2 dmg. GT DEAD!
};

// Boss 3: Stone Cold (7 HP, One-two-one!). P dmg: 2+1+3+2=8>7, kills at R5
// Arc: Build lead → ONE-TWO-ONE! 6 dmg devastation → TRIPLES COMEBACK!
const BOSS3_SCRIPT = {
  enemy:  [[4,2,1], [3,2,1], [1,1,4], [2,1,3], [3,2,1], [2,1,3], [1,3,2]],
  player: [[5,5,3], [6,4,3], [3,2,1], [4,4,4], [5,5,4], [6,5,4], [5,4,3]]
  // R1: P doubles(5) → 2 dmg (SC 8/10)
  // R2: P singles(6) → 1 dmg (SC 7/10)
  // R3: E double 1s! ONE-TWO-ONE! 6 DMG to player!!!
  // R4: P TRIPLES(4)! → 3 dmg (SC 4/10). COMEBACK!
  // R5: P doubles(5) → 2 dmg (SC 2/10)
  // R6: P singles(6) → 1 dmg (SC 1/10)
  // R7: P singles(5) → 1 dmg. SC DEAD!
};

// Boss 4: Pelter (11 HP, Snowball +2 on doubles). Total P dmg: 2+2+3+2+2=11 ✓
// Arc: SNOWBALL opener 4 dmg → trades → SNOWBALL again → TRIPLES COMEBACK!
const BOSS4_SCRIPT = {
  enemy:  [[4,4,6], [3,2,1], [2,1,3], [5,5,3], [2,1,3], [3,2,1], [1,3,2]],
  player: [[5,3,2], [5,5,6], [4,4,5], [4,2,1], [6,6,6], [5,5,4], [6,6,4]]
  // R1: E doubles(4) SNOWBALL! 4 dmg to player!
  // R2: P doubles(5) → 2 dmg (Pelter 9/11)
  // R3: P doubles(4) → 2 dmg (Pelter 7/11)
  // R4: E doubles(5) SNOWBALL! 4 dmg! Player barely alive!
  // R5: P TRIPLES(6)!!! → 3 dmg (Pelter 4/11). BIG COMEBACK!
  // R6: P doubles(5) → 2 dmg (Pelter 2/11)
  // R7: P doubles(6) → 2 dmg. Pelter DEAD!
};

// Boss 5: Antoinette (12 HP, Grace). Total P dmg: 2+2+1+2+3+2=12 ✓
// Arc: Long grind, trading blows, triples turning point
const BOSS5_SCRIPT = {
  enemy:  [[4,3,2], [5,5,4], [3,1,2], [4,4,6], [2,1,3], [5,4,3], [3,2,1], [2,1,3]],
  player: [[5,5,6], [4,3,1], [4,4,5], [3,2,1], [6,5,4], [6,6,2], [5,5,5], [4,4,6]]
  // R1: P doubles(5) → 2 dmg (A 10/12)
  // R2: E doubles(5) → 2 dmg to player
  // R3: P doubles(4) → 2 dmg (A 8/12)
  // R4: E doubles(4) → 2 dmg to player. Even fight!
  // R5: P singles(6) → 1 dmg (A 7/12)
  // R6: P doubles(6) → 2 dmg (A 5/12)
  // R7: P TRIPLES(5)! → 3 dmg (A 2/12). Turning point!
  // R8: P doubles(4) → 2 dmg. A DEAD!
};

// Boss 6: King Jay (13 HP, Reflection — KJ's dice total 7 when KJ LOSES = reflect)
// Total P dmg to KJ: 2+2+0(reflected)+2+0(reflected)+2+3+3=14>13 ✓
// Arc: Player attacks → REFLECTION bounces damage back! → adapts → triples finish
const BOSS6_SCRIPT = {
  enemy:  [[4,3,2], [4,3,1], [4,2,1], [5,4,3], [3,1,2], [4,2,1], [3,1,2], [2,1,3], [3,1,2]],
  player: [[5,5,6], [6,6,2], [6,5,3], [4,2,1], [5,5,4], [6,6,3], [4,4,5], [5,5,5], [6,6,6]]
  // R1: P doubles(5) → 2 dmg (KJ 11/13). E total=9, safe
  // R2: P doubles(6) → 2 dmg (KJ 9/13). E total=8, safe
  // R3: P singles(6) wins → but E total=4+2+1=7! REFLECTION! Player takes 1!
  // R4: E singles(5) → 1 dmg to player
  // R5: P doubles(5) → 2 dmg (KJ 7/13). E total=6, safe
  // R6: P doubles(6) wins → but E total=4+2+1=7! REFLECTION! Player takes 2!
  // R7: P doubles(4) → 2 dmg (KJ 5/13). E total=6, safe
  // R8: P TRIPLES(5)! → 3 dmg (KJ 2/13). BIG COMEBACK!
  // R9: P TRIPLES(6)!! → 3 dmg! KJ DEAD!!!
};

// Boss 7: Hector (15 HP, Protector — singles beat doubles, +1 dmg on singles)
// Total P dmg: 1+3+1+3+1+3+1+3=16>15 ✓. Player takes 2+2=4 from Protector
// Arc: Doubles CRUSHED by Protector → player learns TRIPLES ONLY → epic climax
const BOSS7_SCRIPT = {
  enemy:  [[6,4,2], [3,1,2], [5,3,1], [2,1,3], [5,4,2], [3,1,2], [4,3,1], [2,1,3], [5,3,2], [3,1,2]],
  player: [[5,5,3], [6,5,4], [4,4,6], [5,5,5], [6,5,3], [4,4,4], [6,5,4], [6,6,6], [6,5,4], [6,6,6]]
  // R1: P doubles(5) vs E singles(6)... PROTECTOR! E wins! 2 dmg!
  // R2: P singles(6) beats E singles(3) → 1 dmg (14/15)
  // R3: P doubles(4) vs E singles(5)... PROTECTOR! 2 dmg!
  // R4: P TRIPLES(5)! → 3 dmg (11/15). Learns the way!
  // R5: P singles(6) beats E singles(5) → 1 dmg (10/15)
  // R6: P TRIPLES(4)! → 3 dmg (7/15)
  // R7: P singles(6) beats E singles(4) → 1 dmg (6/15)
  // R8: P TRIPLES(6)!!! → 3 dmg (3/15)
  // R9: P singles(6) beats E singles(5) → 1 dmg (2/15)
  // R10: P TRIPLE 6s!!! → 3 dmg! HECTOR DEAD! TOURNAMENT WON!!!
};

// Boss 8: Prince Balatron (6 HP, Party Time — lose & survive → counter die)
// Arc: Player wins → Balatron counters! Trading blows. Tense knife fight.
const BOSS8_SCRIPT = {
  enemy:  [[3,2,1], [4,3,1], [5,5,3], [3,1,2], [2,1,3]],
  player: [[5,5,4], [6,4,3], [4,2,1], [6,6,4], [5,4,3]]
  // R1: P doubles(5) → 2 dmg (Bal 4/6). Party Time counter!
  // R2: P singles(6) → 1 dmg (Bal 3/6). Party Time counter!
  // R3: E doubles(5) → 2 dmg to player
  // R4: P doubles(6) → 2 dmg (Bal 1/6). Party Time counter!
  // R5: P singles(5) → 1 dmg. Balatron DEAD!
};

// Boss 9: Lucy (8 HP, Blue Fire — win → +1 damage on every win)
// Arc: Lucy hits hard with Blue Fire stacking. Player needs big rolls.
const BOSS9_SCRIPT = {
  enemy:  [[5,4,2], [3,2,1], [5,5,4], [2,1,3], [4,3,1], [3,1,2]],
  player: [[4,3,1], [5,5,6], [4,2,1], [6,6,4], [5,5,3], [6,4,3]]
  // R1: E singles(5) + Blue Fire = 2 dmg to player!
  // R2: P doubles(5) → 2 dmg (Lucy 6/8)
  // R3: E doubles(5) + Blue Fire = 3 dmg to player! Ouch!
  // R4: P doubles(6) → 2 dmg (Lucy 4/8)
  // R5: P doubles(5) → 2 dmg (Lucy 2/8)
  // R6: P singles(6) → 1 dmg (Lucy 1/8)... then 1 more needed
};

// Boss 10: Romy (8 HP, Valley Guardian — predict die, +3 if correct)
// Arc: Romy predicts correctly once for devastating damage. Player survives and fights back.
const BOSS10_SCRIPT = {
  enemy:  [[4,3,2], [5,4,3], [3,2,1], [2,1,3], [3,1,2], [2,1,3]],
  player: [[5,5,6], [4,2,1], [4,4,5], [6,6,4], [5,5,3], [6,4,3]]
  // R1: P doubles(5) → 2 dmg (Romy 6/8)
  // R2: E singles(5) + Valley Guardian prediction hit! +3 = 4 dmg! Devastating!
  // R3: P doubles(4) → 2 dmg (Romy 4/8). Comeback!
  // R4: P doubles(6) → 2 dmg (Romy 2/8)
  // R5: P doubles(5) → 2 dmg. Romy DEAD!
};

// Boss 11: The Mountain King (9 HP, Beast Mode — doubles deal 2x)
// THE CHAMPIONSHIP — epic back-and-forth brawl with devastating Beast Modes
// Player gets smashed to the edge, mounts impossible comeback with triples
const BOSS11_SCRIPT = {
  enemy:  [[3,2,1], [5,5,6], [4,3,1], [3,1,2], [6,6,4], [2,1,3], [4,2,1], [3,1,2], [2,1,3]],
  player: [[5,4,3], [4,3,1], [5,5,4], [6,4,3], [3,2,1], [4,4,5], [6,5,4], [5,5,5], [6,6,6]]
  // R1: P singles(5) → 1 dmg (MK 8/9). Feeling him out.
  // R2: E doubles(5) BEAST MODE!! 4 dmg! The King strikes!
  // R3: P doubles(5) → 2 dmg (MK 6/9). Player fights back!
  // R4: P singles(6) → 1 dmg (MK 5/9). Trading blows.
  // R5: E doubles(6) BEAST MODE!!! 4 dmg! Player CRUSHED to 1 HP!
  // R6: P doubles(4) → 2 dmg (MK 3/9). STILL STANDING!
  // R7: P singles(6) → 1 dmg (MK 2/9). Crawling forward.
  // R8: P TRIPLES(5)! → 3 dmg! Overkill! But wait — show it...
  // ...or R8 brings to 0. MK should die at 2-3=negative. DEAD!
  // Alt: if MK at 2, triples = 3. DEAD! CHAMPIONSHIP WON!!!
  // Backup R9 if needed: TRIPLE 6s for the absolute climax.
};

// Shift scripted dice ±2 so fights feel fresh each play
// Rejects shifts that would change any roll's type (singles/doubles/triples)
function varyScript(base) {
  if (!base) return null;
  const candidates = [-2,-1,0,1,2].sort(() => Math.random() - 0.5);
  let shift = 0;
  for (const s of candidates) {
    let safe = true;
    for (let r = 0; r < base.enemy.length; r++) {
      for (const dice of [base.enemy[r], base.player[r]]) {
        if (!dice) continue;
        const original = analyzeRoll(dice).type;
        const shifted = dice.map(d => Math.max(1, Math.min(6, d + s)));
        if (analyzeRoll(shifted).type !== original) { safe = false; break; }
      }
      if (!safe) break;
    }
    if (safe) { shift = s; break; }
  }
  if (shift === 0) return base; // no safe shift found, use original
  const result = {
    enemy: base.enemy.map(r => r.map(d => Math.max(1, Math.min(6, d + shift)))),
    player: base.player.map(r => r.map(d => Math.max(1, Math.min(6, d + shift))))
  };
  // Post-process: occasionally bump individual enemy low dice for variety
  // Only bumps that don't change the roll's hand type (singles stay singles, etc.)
  result.enemy = result.enemy.map(round => {
    const originalType = analyzeRoll(round).type;
    const bumped = round.map(d => {
      if (Math.random() < 0.25) {
        return Math.min(6, d + Math.floor(Math.random() * 2) + 1);
      }
      return d;
    });
    // Reject the bump if it changed the hand type
    if (analyzeRoll(bumped).type !== originalType) return round;
    return bumped;
  });
  return result;
}

// Featured ghosts with individual draw boost chances
const FEATURED_GHOSTS = [
  { name: 'Prince Balatron', chance: 0.15 },
  { name: 'Kairan', chance: 0.15 },
  { name: 'Katrina', chance: 0.08, minBoss: 4 },
  { name: 'Romy', chance: 0.12, minBoss: 4 },
  { name: 'Eloise', chance: 0.18 },
  { name: 'Guard Thomas', chance: 0.18 },
];

function drawGhost(weights) {
  const available = ALL_GHOSTS.filter(g => !state.usedCards.includes(g.name));
  if (available.length === 0) return null;

  // Check each featured ghost for a boost draw
  const eligibleFeatured = FEATURED_GHOSTS.filter(f =>
    available.some(g => g.name === f.name) && (!f.minBoss || state.currentBoss >= f.minBoss)
  );
  for (const feat of eligibleFeatured.sort(() => Math.random() - 0.5)) {
    if (Math.random() < feat.chance) {
      const ghost = available.find(g => g.name === feat.name);
      state.usedCards.push(ghost.name);
      return { ...ghost, hp: ghost.maxHp };
    }
  }

  // Pick rarity by weight
  const roll = Math.random();
  let cumulative = 0;
  let targetRarity = 'common';
  for (const [rarity, weight] of Object.entries(weights)) {
    cumulative += weight;
    if (roll < cumulative) { targetRarity = rarity; break; }
  }

  let pool = available.filter(g => g.rarity === targetRarity);
  if (pool.length === 0) pool = available; // fallback

  // Reduce Patrick's drop rate — 50% chance to skip him if others available
  if (pool.length > 1 && Math.random() < 0.50) {
    pool = pool.filter(g => g.name !== 'Patrick');
  }

  const ghost = pool[Math.floor(Math.random() * pool.length)];
  state.usedCards.push(ghost.name);
  return { ...ghost, hp: ghost.maxHp };
}
