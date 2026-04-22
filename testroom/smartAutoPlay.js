// Smart Auto-Play Simulation — paste into browser console
// Replaces basic autoPlay with ability-aware AI
function smartAutoPlay(numGames = 50) {
  if (autoPlayRunning) { console.log('Auto-play already running'); return; }
  autoPlayRunning = true;
  autoPlayQueue = numGames;
  autoPlayTotal = numGames;
  console.log(`🧠 Smart Auto-play: starting ${numGames} games...`);
  smartPlayNext();
}

function smartPlayNext() {
  if (autoPlayQueue <= 0) {
    autoPlayRunning = false;
    console.log(`✅ Smart auto-play complete! ${autoPlayTotal} games played.`);
    if (B) {
      B = null;
      document.getElementById('battle-view').style.display = 'none';
      document.getElementById('team-select').style.display = '';
      document.querySelector('.app').classList.remove('battle-active');
      clearAllOverlays();
    }
    return;
  }

  const gameNum = autoPlayTotal - autoPlayQueue + 1;
  autoPlayQueue--;

  S.redPicks = autoPickTeam();
  S.bluePicks = autoPickTeam();
  while (S.bluePicks.some(id => S.redPicks.includes(id))) {
    S.bluePicks = autoPickTeam();
  }

  if (gameNum % 10 === 1 || gameNum === autoPlayTotal) {
    const rn = S.redPicks.map(id => ghostData(id).name);
    const bn = S.bluePicks.map(id => ghostData(id).name);
    console.log(`🧠 Game ${gameNum}/${autoPlayTotal}: Red [${rn}] vs Blue [${bn}]`);
  }

  prevResources = { red: {}, blue: {} };
  narrateQueue = []; narrateActive = false;
  B = {
    red: makeTeam(S.redPicks), blue: makeTeam(S.bluePicks),
    round:1, log:[], phase:'ready',
    pendingMoonstone:null, pendingSteal:null,
    committed: { red: { ice:0, fire:0, surge:0, auntSusan:0, auntSusanHeal:0, harrison:0, zainBlade:0 }, blue: { ice:0, fire:0, surge:0, auntSusan:0, auntSusanHeal:0, harrison:0, zainBlade:0 } },
    retributionDice: { red: 0, blue: 0 },
    cameronBonusDice: { red: 0, blue: 0 },
    pressureUsed: { red: false, blue: false },
    blackoutNum: {},
    harrisonExtraDie: { red: 0, blue: 0 },
    auntSusanBonus: { red: false, blue: false },
    auntSusanHealBonus: { red: false, blue: false },
    hugoWreckage: { red: 0, blue: 0 },
    marcusGlacialBonus: { red: 0, blue: 0 },
    alucardUsed: { red: false, blue: false },
    bogeyUsed: { red: false, blue: false },
    darkWingUsedThisGame: { red: false, blue: false },
    splinterActivated: { red: false, blue: false },
    pendingLucyDmg: { red: 0, blue: 0 },
    floopMuck: { red: 0, blue: 0 },
    logeyLockout: { red: 0, blue: 0 },
    scallywagsFrenzyBonus: { red: 0, blue: 0 },
    dreamCatBonus: { red: 0, blue: 0 },
    haywireBonus: { red: 0, blue: 0 },
    haywireDamageBonus: { red: 0, blue: 0 },
    haywireUsed: { red: false, blue: false },
    pureHeartDeclared: { red: null, blue: null },
    pureHeartScheduledKO: { red: false, blue: false },
    fangUndercoverArmed: { red: false, blue: false },
    tommyRegulatorBonus: { red: 0, blue: 0 },
    letsDanceBonus: { red: 0, blue: 0 },
    jacksonUsedThisRound: { red: false, blue: false },
    eloiseUsedThisRound: { red: false, blue: false },
    outlawStolenDie: { red: 0, blue: 0 },
    jeffSnicker: { red: 0, blue: 0 },
    romyPrediction: { red: null, blue: null },
    // v672: state for 20 new cards (409–433)
    pipToastedUsed: { red: false, blue: false },
    pipDieRemoval: { red: 0, blue: 0 },
    luckyStoneSpentThisTurn: { red: 0, blue: 0 },
    preRollAbilitiesFiredThisTurn: { red: false, blue: false },
    burn: { red: {}, blue: {} },
    chowExtraDie: { red: 0, blue: 0 },
    lucasKindlingBonus: { red: 0, blue: 0 },
    iceBladeForgedPermanent: { red: false, blue: false },
    flameBlade: { red: false, blue: false },
    flameBladeSwing: { red: false, blue: false },
    iceBladeSwing: { red: false, blue: false },
    gordokDieBonus: { red: 0, blue: 0 },
    hexDieRemoval: { red: 0, blue: 0 },
    willowLostLast: { red: false, blue: false }
  };
  S.battle = B;

  // Fire entry effects (game state only)
  smartTriggerEntry(B.red);
  smartTriggerEntry(B.blue);

  smartSimRounds(gameNum);
}

// Simplified entry effects — game state only, no UI
function smartTriggerEntry(team) {
  const f = active(team);
  const enemy = opp(team);
  const tName = team === B.red ? 'red' : 'blue';

  // Helper: apply Knight Terror (401) HEAVY AIR! / Knight Light (402) RETRIBUTION! reaction to
  // an entry ability. Matches index.html triggerEntry collectKnightReactions() calls:
  // Bouril line 3474, Nerina line 3490, Maximo line 3499.
  // (Timpleton no longer fires on entry — v640 rework moved Big Target to the win-path.)
  // The knight is always on the ENEMY side; the entering ghost (f) takes 2 HP or enemy gains +1 LS.
  const applyEntryKnightRxn = () => {
    const ek = active(enemy);
    if (ek.ko || (ek.id !== 401 && ek.id !== 402)) return;
    if (ek.id === 401) { f.hp = Math.max(0, f.hp - 2); if (f.hp <= 0) { f.ko = true; f.killedBy = 401; } }
    else { enemy.resources.luckyStone++; } // Knight Light RETRIBUTION!
  };

  // Bouril (201) — first roll locked to 1-2-3; knight reacts to SLUMBER! on entry
  if (f.id === 201) { f.hankFirstRoll = true; applyEntryKnightRxn(); }
  // Maximo (302) — first roll is 1 die; knight reacts to NAP! on entry
  if (f.id === 302) { f.maximoFirstRoll = true; applyEntryKnightRxn(); }
  // Zain (206) — Ice Blade: opt-in pre-roll forge (see useZainForge in index.html), no entry effect
  // Nerina (306) — 3 damage to enemy active; knight reacts to LEVIATHAN! on entry
  if (f.id === 306) {
    const ef = active(enemy);
    if (!ef.ko) {
      ef.hp = Math.max(0, ef.hp - 3);
      if (ef.hp <= 0) { ef.ko = true; ef.killedBy = f.id; }
      applyEntryKnightRxn();
    }
  }
  // Timpleton (312) — Big Target: no longer fires on entry (v640 rework).
  // +3 damage on win-path when enemy HP > Timpleton's HP — see smartSimRounds win-path block.
  // Grawr (34) — Menace: on entry, deal 1 damage to the enemy active ghost. Matches index.html lines 3546–3557.
  // collectKnightReactions() fires in index.html after the damage — applyEntryKnightRxn() mirrors that.
  if (f.id === 34) {
    const ef = active(enemy);
    if (!ef.ko) {
      ef.hp = Math.max(0, ef.hp - 1);
      if (ef.hp <= 0) { ef.ko = true; ef.killedBy = f.id; }
      applyEntryKnightRxn();
    }
  }
  // Jenkins (94) — Greeting: on entry, roll 4 dice and deal damage by roll TYPE (singles=1, doubles=2,
  // triples=3, quads=4, penta=5). Matches index.html lines 3514–3531 (rollDice(4) → classify → .damage).
  // The 4-die advantage is better hit-type odds, not a face-sum. collectKnightReactions mirrors the
  // index.html call inside the same guard. rollDice() is globally available from index.html.
  if (f.id === 94) {
    const ef = active(enemy);
    if (!ef.ko) {
      const jenkinsDice = rollDice(4);
      const jenkinsDmg = classify(jenkinsDice).damage; // 1/2/3/4/5 by roll type
      ef.hp = Math.max(0, ef.hp - jenkinsDmg);
      if (ef.hp <= 0) { ef.ko = true; ef.killedBy = f.id; }
      applyEntryKnightRxn();
    }
  }
  // Redd (98) — Notorious: first roll after entry gets +2 extra dice.
  // Matches index.html lines 3502–3508 (set reddFirstRoll = true on entry).
  // Knight reaction fires on entry (Redd announces dice burst → knight reacts).
  if (f.id === 98) { f.reddFirstRoll = true; applyEntryKnightRxn(); }

  // Hermit (47) — Solitude: on entry, gain +2 HP per KO'd ghost on both teams.
  // Overclock allowed — no Math.min cap (late-game scaling tank). No knight reaction in index.html.
  // Matches index.html lines 3567–3580.
  if (f.id === 47) {
    const koCount = [...B.red.ghosts, ...B.blue.ghosts].filter(g => g.ko).length;
    if (koCount > 0) { f.hp += koCount * 2; } // overclocked! when hp > maxHp
  }

  // Castle Guide (420) — Light the Way: entry → +1 Surge, +1 Lucky Stone, +1 Burn (as resource)
  // FIX: aligned with index.html — gives Burn as a team resource, NOT placed on enemy sideline
  if (f.id === 420) {
    team.resources.surge++;
    team.resources.luckyStone++;
    if (!team.resources.burn) team.resources.burn = 0;
    team.resources.burn++;
    applyEntryKnightRxn();
  }

  // Castle Guide (420) — Burn: check if the entering ghost has burn stacked on it
  // Mike (445) — Torrent: sideline ghosts immune to Burn while Mike is on the team
  if (B.burn && B.burn[tName]) {
    const burnCount = B.burn[tName][team.activeIdx] || 0;
    const mikeProtects = hasSideline(team, 445);
    if (burnCount > 0 && !f.ko && mikeProtects) {
      // Mike's Torrent: sideline immune to Burn — consume burn, deal 0
      delete B.burn[tName][team.activeIdx];
      if (B.burnSource && B.burnSource[tName]) delete B.burnSource[tName][team.activeIdx];
    } else if (burnCount > 0 && !f.ko && f.id !== 416) {
      f.hp = Math.max(0, f.hp - burnCount);
      if (f.hp <= 0) {
        f.ko = true;
        let topBurner = -2;
        const sources = B.burnSource && B.burnSource[tName] && B.burnSource[tName][team.activeIdx];
        if (sources) {
          let maxCount = 0;
          for (const [sid, cnt] of Object.entries(sources)) {
            if (cnt > maxCount) { maxCount = cnt; topBurner = parseInt(sid); }
          }
        }
        f.killedBy = topBurner;
      }
      delete B.burn[tName][team.activeIdx];
      if (B.burnSource && B.burnSource[tName]) delete B.burnSource[tName][team.activeIdx];
    } else if (burnCount > 0 && f.id === 416) {
      // Rook (416) — Immune to Burn: consume burn but take no damage
      delete B.burn[tName][team.activeIdx];
      if (B.burnSource && B.burnSource[tName]) delete B.burnSource[tName][team.activeIdx];
    }
  }

  // Rascals (437) — Stampede: Entry → gain 3 Burn (v685: moved from post-roll to entry)
  if (f.id === 437 && !f.ko) {
    if (!team.resources.burn) team.resources.burn = 0;
    team.resources.burn += 3;
    applyEntryKnightRxn();
  }

  // Nicholas (51) — Sneak Attack: while on the enemy sideline, deal 2 damage to the entering ghost.
  // Matches index.html lines 3617–3639 (hasSideline(enemy, 51) && !f.ko → f.hp -= 2, KO check).
  // No Cornelius (45) block — index.html does not block Nicholas with Cornelius.
  // Does NOT fire at battle start (round 1) — only mid-battle swaps
  if (hasSideline(enemy, 51) && !f.ko && B.round > 1) {
    f.hp = Math.max(0, f.hp - 2);
    if (f.hp <= 0) { f.ko = true; f.killedBy = 51; }
  }
}

// AI: pick best KO swap replacement
function smartPickSwap(team) {
  const t = B[team];
  const alive = t.ghosts.map((g,i) => ({g, i})).filter(x => x.i !== t.activeIdx && !x.g.ko);
  if (alive.length === 0) return -1;
  if (alive.length === 1) return alive[0].i;

  // Score each candidate
  let best = alive[0], bestScore = -999;
  for (const c of alive) {
    let score = c.g.hp; // base: HP
    // Lou (32) must stay on sideline to buff Grawr (34) — penalize bringing Lou in while Grawr is alive
    const grawrAlive = t.ghosts.some(g => g.id === 34 && !g.ko);
    if (c.g.id === 32 && grawrAlive) score -= 50;
    // Bonus for entry damage dealers
    if (c.g.id === 306) score += 5; // Nerina: 3 entry damage
    if (c.g.id === 312) score += 3; // Timpleton: +3 damage on win when enemy HP > mine
    if (c.g.id === 94)  score += 3; // Jenkins: avg ~1.8 entry damage (doubles-biased 4-die roll)
    // Bonus for resource generators
    if ([209,307,309,336].includes(c.g.id)) score += 2;
    // Bonus for high max HP (tanks)
    score += c.g.maxHp * 0.3;
    if (score > bestScore) { bestScore = score; best = c; }
  }
  return best.i;
}

// AI: pick best Blackout number (most statistically impactful)
function smartBlackoutPick() {
  // With 3 dice, blocking the middle values (3,4) removes the most expected damage
  // But blocking high values (5,6) prevents the scariest doubles/triples
  // Optimal: block 6 (highest doubles value), then 5, then 4
  // But 3-4 are most commonly rolled — block 4 as compromise (most likely to appear AND form doubles)
  return 4; // blocks the most common doubles value
}

// AI: pick best Moonstone die change
function smartMoonstoneChange(dice) {
  // Try each die changed to each value 1-6, pick the best classify result
  const typeRank = {penta:5, quads:4, triples:3, doubles:2, singles:1, none:0};
  let bestDice = [...dice], bestScore = -1;

  for (let di = 0; di < dice.length; di++) {
    for (let val = 1; val <= 6; val++) {
      if (dice[di] === val) continue;
      const test = [...dice];
      test[di] = val;
      const r = classify(test.sort((a,b)=>a-b));
      const score = typeRank[r.type] * 10 + r.value;
      if (score > bestScore) {
        bestScore = score;
        bestDice = test;
      }
    }
  }
  return bestDice.sort((a,b)=>a-b);
}

// AI: Lucky Stone — reroll the lowest die
function smartLuckyStone(dice) {
  const minIdx = dice.indexOf(Math.min(...dice));
  const newDice = [...dice];
  newDice[minIdx] = Math.floor(Math.random()*6)+1;
  return newDice.sort((a,b)=>a-b);
}

function smartSimRounds(gameNum) {
  if (!B || B.round > 50) {
    autoRecordGame('draw');
    return;
  }

  const redAllDown = B.red.ghosts.every(g => g.ko);
  const blueAllDown = B.blue.ghosts.every(g => g.ko);
  if (redAllDown && blueAllDown) { autoRecordGame('draw'); return; }
  if (redAllDown) { autoRecordGame('blue'); return; }
  if (blueAllDown) { autoRecordGame('red'); return; }

  // Auto-swap KO'd ghosts with smart picking
  ['red','blue'].forEach(team => {
    const t = B[team];
    if (active(t).ko) {
      const idx = smartPickSwap(team);
      if (idx >= 0) {
        t.activeIdx = idx;
        active(t).hp = active(t).maxHp; // full HP on entry
        smartTriggerEntry(t);
      }
    }
  });

  // Check again after entry effects (Nerina etc can KO)
  const redDown2 = B.red.ghosts.every(g => g.ko);
  const blueDown2 = B.blue.ghosts.every(g => g.ko);
  if (redDown2 && blueDown2) { autoRecordGame('draw'); return; }
  if (redDown2) { autoRecordGame('blue'); return; }
  if (blueDown2) { autoRecordGame('red'); return; }

  // ===== PRE-ROLL EFFECTS =====

  // v687: Pre-roll chip damage abilities fire ONCE per turn (mirrors index.html guard)
  const preRollAlreadyFired = B.preRollAbilitiesFiredThisTurn.red && B.preRollAbilitiesFiredThisTurn.blue;
  if (!preRollAlreadyFired) {
  B.preRollAbilitiesFiredThisTurn.red = true;
  B.preRollAbilitiesFiredThisTurn.blue = true;

  // Ember Force (304) — 1 pre-roll damage
  ['red','blue'].forEach(teamKey => {
    const team = B[teamKey];
    const f = active(team);
    const enemy = opp(team);
    const enemyKey = teamKey === 'red' ? 'blue' : 'red';
    if (f.id === 304 && !f.ko && !hasSideline(enemy, 301)) {
      const ef = active(enemy);
      if (!ef.ko) {
        // Phase 4: Masked Hero (55) Underdog fires BEFORE Ember Force damage — if attacker KO'd, skip
        if (ef.id === 55 && !ef.ko) {
          f.hp = Math.max(0, f.hp - 3);
          if (f.hp <= 0) { f.ko = true; f.killedBy = 55; }
          if (f.ko) return; // Attacker KO'd by Underdog — skip Ember Force damage
        }
        ef.hp = Math.max(0, ef.hp - 1);
        if (ef.hp <= 0) { ef.ko = true; ef.killedBy = f.id; }
        if (ef.id === 24 && !ef.ko) { B[enemyKey].resources.fire++; }
        if (!ef.ko && hasAlive(team, 436)) {
          ef.hp = Math.max(0, ef.hp - 1);
          if (ef.hp <= 0) { ef.ko = true; ef.killedBy = 436; }
          if (ef.id === 24 && !ef.ko) { B[enemyKey].resources.fire++; }
        }
      }
    }
  });

  // Shade's Shadow (205) — sideline: 1 dmg if enemy < 4 HP
  ['red','blue'].forEach(teamKey => {
    const team = B[teamKey];
    const enemy = opp(team);
    const enemyKey = teamKey === 'red' ? 'blue' : 'red';
    if (hasSideline(team, 205) && !hasSideline(enemy, 301)) {
      const ef = active(enemy);
      if (!ef.ko && ef.hp < 4) {
        // Phase 4: Masked Hero (55) Underdog fires BEFORE Shade's Shadow damage
        if (ef.id === 55 && !ef.ko) {
          const att = active(team);
          att.hp = Math.max(0, att.hp - 3);
          if (att.hp <= 0) { att.ko = true; att.killedBy = 55; }
          if (att.ko) return; // Attacker KO'd by Underdog — skip Shade's Shadow damage
        }
        ef.hp = Math.max(0, ef.hp - 1);
        if (ef.hp <= 0) { ef.ko = true; ef.killedBy = 205; }
        if (ef.id === 24 && !ef.ko) { B[enemyKey].resources.fire++; }
        if (!ef.ko && hasAlive(team, 436)) {
          ef.hp = Math.max(0, ef.hp - 1);
          if (ef.hp <= 0) { ef.ko = true; ef.killedBy = 436; }
          if (ef.id === 24 && !ef.ko) { B[enemyKey].resources.fire++; }
        }
      }
    }
  });

  // Shade (111) — HAUNT!: active ghost deals 1 damage to enemy before EVERY roll (no round restriction — v592 fix).
  // Dylan Scarecrow (301) on enemy sideline blocks. Piper (107) Slick Coat negates if Piper is the active enemy.
  // Masked Hero (55) — Underdog: counter 3 damage back to Shade if targeted.
  // Matches index.html lines 6623–6671.
  ['red','blue'].forEach(teamKey => {
    const team = B[teamKey];
    const f = active(team);
    const enemy = opp(team);
    const enemyKey = teamKey === 'red' ? 'blue' : 'red';
    if (f.id !== 111 || f.ko || hasSideline(enemy, 301)) return;
    const ef = active(enemy);
    if (ef.ko || ef.id === 107) return; // Piper Slick Coat negates
    // Phase 4: Masked Hero (55) Underdog fires BEFORE Shade's Haunt damage
    if (ef.id === 55 && !ef.ko) {
      f.hp = Math.max(0, f.hp - 3);
      if (f.hp <= 0) { f.ko = true; f.killedBy = 55; }
      if (f.ko) return; // Shade KO'd by Underdog — skip Haunt damage
    }
    ef.hp = Math.max(0, ef.hp - 1);
    if (ef.hp <= 0) { ef.ko = true; ef.killedBy = 111; }
    if (ef.id === 24 && !ef.ko) { B[enemyKey].resources.fire++; }
    if (!ef.ko && hasAlive(team, 436)) {
      ef.hp = Math.max(0, ef.hp - 1);
      if (ef.hp <= 0) { ef.ko = true; ef.killedBy = 436; }
      if (ef.id === 24 && !ef.ko) { B[enemyKey].resources.fire++; }
    }
  });

  // Splinter (101) — Toxic Fumes: once activated (first win), deal 1 chip damage to enemy before every roll.
  // Dylan Scarecrow (301) on enemy sideline blocks (same guard as Shade). Matches index.html lines 6694–6717.
  ['red','blue'].forEach(teamKey => {
    const team = B[teamKey];
    const f = active(team);
    const enemy = opp(team);
    const enemyKey = teamKey === 'red' ? 'blue' : 'red';
    if (f.id !== 101 || f.ko || !B.splinterActivated[teamKey] || hasSideline(enemy, 301)) return;
    const ef = active(enemy);
    if (ef.ko) return;
    // Phase 4: Masked Hero (55) Underdog fires BEFORE Splinter's Toxic Fumes damage
    if (ef.id === 55 && !ef.ko) {
      f.hp = Math.max(0, f.hp - 3);
      if (f.hp <= 0) { f.ko = true; f.killedBy = 55; }
      if (f.ko) return; // Splinter KO'd by Underdog — skip Toxic Fumes damage
    }
    ef.hp = Math.max(0, ef.hp - 1);
    if (ef.hp <= 0) { ef.ko = true; ef.killedBy = 101; }
    if (ef.id === 24 && !ef.ko) { B[enemyKey].resources.fire++; }
    if (!ef.ko && hasAlive(team, 436)) {
      ef.hp = Math.max(0, ef.hp - 1);
      if (ef.hp <= 0) { ef.ko = true; ef.killedBy = 436; }
      if (ef.id === 24 && !ef.ko) { B[enemyKey].resources.fire++; }
    }
  });

  // Lucy (108) / Humar (336) — pending delayed damage fires before the target's next roll.
  // FIX: damage now correctly targets active(team) where teamKey holds the flag (the target team).
  // Previous code incorrectly damaged active(enemy) — the WRONG team.
  // Dylan Scarecrow (301) on target's sideline negates. Matches index.html lines 7696–7756.
  ['red','blue'].forEach(teamKey => {
    const team = B[teamKey];
    const enemy = opp(team);
    const enemyKey = teamKey === 'red' ? 'blue' : 'red';
    if (B.pendingLucyDmg[teamKey] <= 0) return;
    const pendingDmg = B.pendingLucyDmg[teamKey];
    B.pendingLucyDmg[teamKey] = 0;                                    // always consume the flag
    if (hasSideline(team, 301)) return;                               // Dylan on TARGET team negates
    const tf = active(team);                                          // target = the team holding the flag
    if (tf.ko) return;
    // Phase 4: Masked Hero (55) Underdog fires BEFORE Lucy/Humar delayed damage
    if (tf.id === 55 && !tf.ko) {
      const lucyAtt = active(enemy);
      if (lucyAtt && !lucyAtt.ko) {
        lucyAtt.hp = Math.max(0, lucyAtt.hp - 3);
        if (lucyAtt.hp <= 0) { lucyAtt.ko = true; lucyAtt.killedBy = 55; }
        if (lucyAtt.ko) return; // Attacker KO'd by Underdog — skip Lucy/Humar damage
      }
    }
    tf.hp = Math.max(0, tf.hp - pendingDmg);
    if (tf.hp <= 0) { tf.ko = true; tf.killedBy = pendingDmg >= 2 ? 336 : 108; }
    if (tf.id === 24 && !tf.ko) { B[teamKey].resources.fire++; }
    // Princess Shade (436) — Royal Decree: attacker (enemy) has Princess Shade on sideline
    if (!tf.ko && hasAlive(enemy, 436)) {
      tf.hp = Math.max(0, tf.hp - 1);
      if (tf.hp <= 0) { tf.ko = true; tf.killedBy = 436; }
      if (tf.id === 24 && !tf.ko) { B[teamKey].resources.fire++; }
    }
  });

  } // end pre-roll once-per-turn guard (v687)

  // Toby (97) — Pure Heart SACRIFICE: if declaration was made last round, KO Toby before rolling.
  // Mirrors index.html doPreRollSetup lines 6724–6734: f.ko=true, killedBy=-1 (self-sacrifice, no enemy kill credit).
  ['red','blue'].forEach(teamKey => {
    const f = active(B[teamKey]);
    if (f.id === 97 && !f.ko && B.pureHeartScheduledKO[teamKey]) {
      B.pureHeartScheduledKO[teamKey] = false;
      f.ko = true; f.killedBy = -1; // self-sacrifice — no kill credit to enemy
    }
  });

  // Toby (97) — Pure Heart DECLARATION: AI declares when Toby is active, declaration is fresh (null),
  // not already scheduled for sacrifice, and enemy active has >2 HP (instant KO is worthwhile).
  // Mirrors doPreRollSetup lines 5653–5667 (modal) + doTobyPureHeart(true) path (line 4499).
  ['red','blue'].forEach(teamKey => {
    const f = active(B[teamKey]);
    const enemy = opp(B[teamKey]);
    const ef = active(enemy);
    if (f.id === 97 && !f.ko && B.pureHeartDeclared[teamKey] === null && !B.pureHeartScheduledKO[teamKey]) {
      B.pureHeartDeclared[teamKey] = ef.hp > 2; // declare only when instant KO is meaningfully worthwhile
    }
  });

  // Romy (114) — Valley Guardian: pre-roll number prediction (AI picks 1–6 randomly; all faces equally likely).
  // Mirrors index.html rollReady lines 5639–5654 (romyOverlay modal) + doRomyPrediction line 4480.
  // Piper (107) SLICK COAT! blocks the prediction → sets -1 sentinel (no die value equals -1).
  // Matches index.html lines 5622–5636 (Piper guard in rollReady).
  ['red','blue'].forEach(teamKey => {
    const _rF = active(B[teamKey]);
    const _rEf = active(opp(B[teamKey]));
    if (_rF.id === 114 && !_rF.ko && B.romyPrediction[teamKey] == null) {
      B.romyPrediction[teamKey] = (_rEf.id === 107 && !_rEf.ko) ? -1 : Math.ceil(Math.random() * 6);
    }
  });

  // Katrina (70) — SEEKER!: if Katrina's HP < opponent's active HP, gain +1 HP before rolling
  // Filbert (59) on enemy sideline flips heal → -1 damage (MASK MERCHANT curse)
  // Matches index.html lines 7148–7170 (doPreRollSetup forEach)
  ['red','blue'].forEach(teamKey => {
    const team = B[teamKey];
    const f = active(team);
    const enemy = opp(team);
    const ef = active(enemy);
    if (f.id === 70 && !f.ko && !ef.ko && f.hp < ef.hp) {
      if (hasSideline(enemy, 59)) {
        f.hp = Math.max(0, f.hp - 1);                              // Filbert flips heal → damage
        if (f.hp <= 0) { f.ko = true; f.killedBy = 59; }
      } else {
        f.hp++;                                                     // overclocks! Rule #9 — no cap
      }
    }
  });

  // Shoo (13) — Alpine Air: sideline → active ghost gains +2 HP when HP < 4. Once per ghost.
  // Cornelius (45) on enemy sideline blocks without consuming the once-per-ghost flag.
  // Filbert (59) on enemy sideline flips +2 heal → -2 damage (MASK MERCHANT curse).
  // Matches index.html lines 6970–6999 (doPreRollSetup forEach).
  ['red','blue'].forEach(teamKey => {
    const team = B[teamKey];
    const f = active(team);
    const enemy = opp(team);
    if (!f.ko && f.hp < 4 && hasSideline(team, 13) && !f.shooAlpineUsed) {
      if (hasSideline(enemy, 45)) return; // Cornelius blocks — does NOT consume the flag
      f.shooAlpineUsed = true;
      if (hasSideline(enemy, 59)) {
        f.hp = Math.max(0, f.hp - 2);    // Filbert flips heal → 2 damage
        if (f.hp <= 0) { f.ko = true; f.killedBy = 59; }
      } else {
        f.hp += 2;                         // overclocks! Rule #9 — no cap
      }
    }
  });

  // Magic Fireflies — AI converts all fireflies to the most-needed resource (pre-roll).
  // Priority: Sacred Fire if team has a fire payoff card and none → Ice if team has ice synergy and none → lowest count resource.
  ['red','blue'].forEach(teamKey => {
    const team = B[teamKey];
    while ((team.resources.firefly || 0) > 0) {
      const r = team.resources;
      const hasFirePayoff = team.ghosts.some(g => !g.ko && [58, 89, 420, 428, 429].includes(g.id)); // Flicker, Mallow, Castle Guide, Jasper, Pip
      const hasIceSynergy = team.ghosts.some(g => !g.ko && [206, 305, 424, 204].includes(g.id)); // Zain, Selene, Bigsby, Finn
      let chosen = 'fire'; // default
      if (hasFirePayoff && (r.fire || 0) === 0) { chosen = 'fire'; }
      else if (hasIceSynergy && (r.ice || 0) === 0) { chosen = 'ice'; }
      else {
        // Pick the resource with the lowest count
        const candidates = [
          { key: 'fire', count: r.fire || 0 },
          { key: 'ice', count: r.ice || 0 },
          { key: 'moonstone', count: r.moonstone || 0 },
          { key: 'luckyStone', count: r.luckyStone || 0 },
          { key: 'healingSeed', count: r.healingSeed || 0 },
          { key: 'surge', count: r.surge || 0 }
        ];
        candidates.sort((a, b) => a.count - b.count);
        chosen = candidates[0].key;
      }
      r.firefly--;
      r[chosen] = (r[chosen] || 0) + 1;
    }
  });

  // Mallow (89) — Dozy Cozy: sideline → spend 1 Sacred Fire to give active ghost +3 HP (pre-roll).
  // Sim always says "yes" when fire is available — net +3 HP for 1 fire is strictly positive.
  // Filbert (59) on enemy sideline flips +3 heal → -3 damage (MASK MERCHANT curse).
  // Matches index.html doMallowChoice('yes') path (lines 4597–4617).
  ['red','blue'].forEach(teamKey => {
    const team = B[teamKey];
    const f = active(team);
    const enemy = opp(team);
    if (!f.ko && hasSideline(team, 89) && team.resources && team.resources.fire >= 1) {
      team.resources.fire -= 1;
      if (hasSideline(enemy, 59)) {
        f.hp = Math.max(0, f.hp - 3);    // Filbert flips heal → 3 damage
        if (f.hp <= 0) { f.ko = true; f.killedBy = 59; }
      } else {
        f.hp += 3;                         // overclocks! Rule #9 — no cap
      }
    }
  });

  // Death Howl (202) — Pressure: force opponent to swap active ghost with a sideline ghost (pre-roll, once per round).
  // Opponent's chosen ghost enters at full HP and triggers entry effects.
  // Dylan Scarecrow (301) on enemy sideline blocks Pressure entirely.
  // Sim always uses Pressure when available — disrupts opponent's HP management.
  // Matches index.html usePressure() → doPressureSwap() flow (lines 4074–4145).
  ['red','blue'].forEach(teamKey => {
    const team = B[teamKey];
    const f = active(team);
    const enemy = opp(team);
    if (f.id !== 202 || f.ko || B.pressureUsed[teamKey]) return;
    if (hasSideline(enemy, 301)) return; // Dylan Scarecrow blocks Pressure
    const enemyKey = teamKey === 'red' ? 'blue' : 'red';
    const aliveSideline = B[enemyKey].ghosts
      .map((g, i) => ({ g, i }))
      .filter(x => x.i !== B[enemyKey].activeIdx && !x.g.ko);
    if (aliveSideline.length === 0) return; // no sideline ghost to swap in
    // Opponent AI picks the sideline ghost with the highest maxHp (best available fighter)
    const best = aliveSideline.reduce((a, b) => b.g.maxHp > a.g.maxHp ? b : a);
    B[enemyKey].activeIdx = best.i;
    best.g.hp = best.g.maxHp; // enters at full HP per doPressureSwap
    smartTriggerEntry(B[enemyKey]);
    B.pressureUsed[teamKey] = true;
  });

  // Tyson (365) — Hop: opt-in pre-roll self-swap. Swap Tyson out for the best available sideline ghost.
  // No entry effects trigger for the incoming ghost (per spec: "No entry effects trigger").
  // Dylan Scarecrow (301) on enemy sideline blocks Hop entirely (matches useTysonHop dylanNegates check).
  // Sim AI hops whenever there's a sideline ghost with more HP than Tyson — almost always beneficial
  // given Tyson's 3 max HP. If no better option exists, Tyson stays in (no wasted swap).
  // Matches index.html useTysonHop() → openSwap() flow (lines 4046–4069).
  ['red','blue'].forEach(teamKey => {
    const team = B[teamKey];
    const f = active(team);
    const enemy = opp(team);
    if (f.id !== 365 || f.ko) return;
    if (hasSideline(enemy, 301)) return; // Dylan Scarecrow blocks Hop
    const aliveSideline = team.ghosts
      .map((g, i) => ({ g, i }))
      .filter(x => x.i !== team.activeIdx && !x.g.ko);
    if (aliveSideline.length === 0) return; // no sideline ghost to swap to
    // AI only hops if a sideline ghost has more HP than Tyson (avoids pointless same-HP swaps)
    const best = aliveSideline.reduce((a, b) => b.g.hp > a.g.hp ? b : a);
    if (best.g.hp <= f.hp) return; // no better option — Tyson stays in
    team.activeIdx = best.i;
    // No smartTriggerEntry call — "No entry effects trigger" is core to Hop's design
  });

  // Fang Undercover (7) — Skilled Coward: arm dodge pre-roll whenever Fang is active and has a sideline ghost.
  // AI always arms — negating all incoming damage is strictly positive; worst case the flag is cleared on tie (no cost).
  // Mirrors index.html doPreRollSetup lines 5863–5882 (modal shows each round; sim always chooses "yes").
  ['red','blue'].forEach(teamKey => {
    const team = B[teamKey];
    const f = active(team);
    if (f.id !== 7 || f.ko || B.fangUndercoverArmed[teamKey]) return;
    const hasSl = team.ghosts.some((g, i) => i !== team.activeIdx && !g.ko);
    if (hasSl) B.fangUndercoverArmed[teamKey] = true;
  });

  // Wandering Sue (84) — Hidden Weakness: if enemy active ghost has 12+ HP, instant KO before rolling.
  // Anti-overclock assassin — punishes HP stacking via Katrina Seeker, Boris Fortify, Shoo Alpine Air, etc.
  // No Dylan guard in index.html (lines 6738–6754) — this targets the enemy directly, not a buffable damage type.
  ['red','blue'].forEach(teamKey => {
    const team = B[teamKey];
    const f = active(team);
    if (f.id !== 84 || f.ko) return;
    const enemy = opp(team);
    const ef = active(enemy);
    if (!ef.ko && ef.hp >= 12) {
      ef.hp = 0;
      ef.ko = true;
      ef.killedBy = 84;
    }
  });

  // Nick & Knack (409) — Knick Knack: auto-steal 1 random resource from opponent before rolling
  ['red','blue'].forEach(teamKey => {
    const team = B[teamKey];
    const f = active(team);
    const oppKey = teamKey === 'red' ? 'blue' : 'red';
    const oppTeam = B[oppKey];
    if (f.id === 409 && !f.ko) {
      const resTypes = ['ice', 'fire', 'surge', 'luckyStone', 'moonstone', 'healingSeed'];
      const available = resTypes.filter(r => (oppTeam.resources[r] || 0) > 0);
      if (available.length > 0) {
        const stolen = available[Math.floor(Math.random() * available.length)];
        oppTeam.resources[stolen]--;
        team.resources[stolen] = (team.resources[stolen] || 0) + 1;
        // Nick & Knack gains +3 HP on steal (overclocks past maxHp per game rules)
        f.hp += 3;
      }
    }
  });

  // Zippa (423) — Glimmer: before rolling, gain Lucky Stones equal to Healing Seeds held (v674: moved from win to pre-roll)
  ['red','blue'].forEach(teamKey => {
    const f = active(B[teamKey]);
    if (f.id === 423 && !f.ko) {
      const seeds = B[teamKey].resources.healingSeed || 0;
      if (seeds > 0) {
        B[teamKey].resources.luckyStone += seeds;
      }
    }
  });

  // Forest Spirit (446) — Hex: AI auto-spends Burn to remove enemy dice + gain Sacred Fire per Burn spent
  // Matches index.html useHex: spend 1 Burn → -1 enemy die + +1 Sacred Fire
  B.hexDieRemoval = { red: 0, blue: 0 };
  ['red','blue'].forEach(teamKey => {
    const f = active(B[teamKey]);
    const oppKey = teamKey === 'red' ? 'blue' : 'red';
    if (f.id === 446 && !f.ko && (B[teamKey].resources.burn || 0) >= 1) {
      // AI: spend all available burn (opponent always has 3+ base dice)
      const burnToSpend = B[teamKey].resources.burn;
      B[teamKey].resources.burn = 0;
      B.hexDieRemoval[oppKey] = (B.hexDieRemoval[oppKey] || 0) + burnToSpend;
      B[teamKey].resources.fire += burnToSpend; // +1 Sacred Fire per Burn spent
    }
  });

  // Chow (414) — Secret Ingredient: auto-discard 1 Healing Seed for +2 dice
  B.chowExtraDie = { red: 0, blue: 0 };
  ['red','blue'].forEach(teamKey => {
    const f = active(B[teamKey]);
    if (f.id === 414 && !f.ko && B[teamKey].resources.healingSeed >= 1) {
      B[teamKey].resources.healingSeed--;
      B.chowExtraDie[teamKey] = 2;
      // Cameron (25) — opponent used a special (Healing Seed)
      const oppK = teamKey === 'red' ? 'blue' : 'red';
      if (B[oppK].ghosts.some(g => g.id === 25 && !g.ko)) {
        if (!B.cameronBonusDice) B.cameronBonusDice = {red:0,blue:0};
        B.cameronBonusDice[oppK]++;
      }
    }
  });

  // Castle Gardener (442) — Cultivate: auto-convert all Healing Seeds to Sacred Fire
  ['red','blue'].forEach(teamKey => {
    const f = active(B[teamKey]);
    if (f.id === 442 && !f.ko && B[teamKey].resources.healingSeed >= 1) {
      const seeds = B[teamKey].resources.healingSeed;
      B[teamKey].resources.healingSeed = 0;
      B[teamKey].resources.fire = (B[teamKey].resources.fire || 0) + (seeds * 2);
      // Boopies (419) sideline mirror
      if (hasSideline(B[teamKey], 419)) B[teamKey].resources.luckyStone = (B[teamKey].resources.luckyStone || 0) + seeds;
    }
  });

  // Young Cap (429) — Energize: AI auto-heals with seeds when active (+1 HP, +1 die, +1 Ice Shard, +1 Surge per seed used)
  // Matches index.html useHealingSeed() → Energize block. AI uses 1 seed per round (same as manual play).
  ['red','blue'].forEach(teamKey => {
    const f = active(B[teamKey]);
    if (f.id === 429 && !f.ko && B[teamKey].resources.healingSeed >= 1) {
      B[teamKey].resources.healingSeed--;
      f.hp = Math.min(f.maxHp, f.hp + 1);
      if (!f.youngCapDieBonus) f.youngCapDieBonus = 0;
      f.youngCapDieBonus++;
      B[teamKey].resources.ice++;
      // Cameron (25) — opponent used a special (Healing Seed via Young Cap)
      const oppK = teamKey === 'red' ? 'blue' : 'red';
      if (B[oppK].ghosts.some(g => g.id === 25 && !g.ko)) {
        if (!B.cameronBonusDice) B.cameronBonusDice = {red:0,blue:0};
        B.cameronBonusDice[oppK]++;
      }
      B[teamKey].resources.surge++;
      // Boopies (419) sideline mirror
      if (hasSideline(B[teamKey], 419)) B[teamKey].resources.luckyStone++;
    }
  });

  // Handle any pre-roll KOs
  ['red','blue'].forEach(team => {
    const t = B[team];
    if (active(t).ko) {
      const idx = smartPickSwap(team);
      if (idx >= 0) {
        t.activeIdx = idx;
        active(t).hp = active(t).maxHp;
        smartTriggerEntry(t);
      }
    }
  });

  // ===== AI RESOURCE COMMITMENT =====
  ['red','blue'].forEach(team => {
    const t = B[team];
    const f = active(t);
    const r = t.resources;

    // Zain (206) — Ice Blade: forge if not yet forged (spends 1 Ice Shard + 1 Moonstone, permanent).
    // Forge runs BEFORE ice is moved to committed so the remaining ice can still be committed for dmg.
    // Matches index.html useZainForge() → f.iceBladeForged = true (line 3961).
    if (f.id === 206 && !f.ko && !f.iceBladeForged && r.ice >= 1 && r.moonstone >= 1) {
      r.ice--;
      r.moonstone--;
      f.iceBladeForged = true;
      B.iceBladeForgedPermanent[team] = true; // permanent +2 damage for all wins
    }

    // Surge: spend up to 2
    const surgeToSpend = Math.min(r.surge, 2);
    if (surgeToSpend > 0) {
      B.committed[team].surge = surgeToSpend;
      r.surge -= surgeToSpend;
    }

    // Ice Shards: commit all (Sylvia 313 — free ice: commit but don't consume)
    if (r.ice > 0) {
      B.committed[team].ice = r.ice;
      if (f.id !== 313) r.ice = 0; // Sylvia keeps her ice
    }

    // Sacred Fire: commit all
    if (r.fire > 0) {
      B.committed[team].fire = r.fire;
      r.fire = 0;
    }

    // Harrison (315): spend seeds for extra dice (up to 2)
    if (f.id === 315 && !f.ko && r.healingSeed > 0) {
      const seeds = Math.min(r.healingSeed, 2);
      B.committed[team].harrison = seeds;
      r.healingSeed -= seeds;
    }

    // Aunt Susan (309): spend seeds for damage (heal removed)
    if (f.id === 309 && !f.ko && r.healingSeed > 0) {
      const seeds = Math.min(r.healingSeed, 2);
      B.committed[team].auntSusan = seeds;
      r.healingSeed -= seeds;
    }

    // Burn resource: auto-place all burn on highest-HP enemy sideline ghost
    if (r.burn && r.burn > 0) {
      const oppKey = team === 'red' ? 'blue' : 'red';
      const opp = B[oppKey];
      const sidelineGhosts = opp.ghosts
        .map((g, i) => ({ ghost: g, index: i }))
        .filter(x => x.index !== opp.activeIdx && !x.ghost.ko);
      if (sidelineGhosts.length > 0) {
        // Pick highest HP target
        sidelineGhosts.sort((a, b) => b.ghost.hp - a.ghost.hp);
        const target = sidelineGhosts[0];
        if (!B.burn) B.burn = { red: {}, blue: {} };
        if (!B.burn[oppKey]) B.burn[oppKey] = {};
        B.burn[oppKey][target.index] = (B.burn[oppKey][target.index] || 0) + r.burn;
        // Track burn source for KO credit
        const burnPlacerId = f.originalId || f.id;
        if (!B.burnSource) B.burnSource = { red: {}, blue: {} };
        if (!B.burnSource[oppKey]) B.burnSource[oppKey] = {};
        if (!B.burnSource[oppKey][target.index]) B.burnSource[oppKey][target.index] = {};
        B.burnSource[oppKey][target.index][burnPlacerId] = (B.burnSource[oppKey][target.index][burnPlacerId] || 0) + r.burn;
        r.burn = 0;
      }
    }

    // Happy Crystal (208): sacrifice if we have 0 moonstones and HP > 1
    if (f.id === 208 && !f.ko && r.moonstone === 0 && f.hp > 1) {
      f.hp = 0; f.ko = true; f.killedBy = -1;
      r.moonstone++;
    }

    // Smudge (403): set blackout number
    if (f.id === 403 && !f.ko) {
      B.blackoutNum[team] = smartBlackoutPick();
    }

    // Cameron (25) — Unstoppable Force: count how many specials this team committed/spent
    // Each committed special triggers +1 die for Cameron on the opponent's team.
    const camSpecialsUsed = (B.committed[team].surge || 0) + (B.committed[team].ice || 0) +
                            (B.committed[team].fire || 0) + (B.committed[team].auntSusan || 0) +
                            (B.committed[team].harrison || 0);
    if (camSpecialsUsed > 0) {
      const oppKey = team === 'red' ? 'blue' : 'red';
      const oppTeam = B[oppKey];
      if (oppTeam.ghosts.some(g => g.id === 25 && !g.ko)) {
        if (!B.cameronBonusDice) B.cameronBonusDice = { red: 0, blue: 0 };
        B.cameronBonusDice[oppKey] += camSpecialsUsed;
      }
    }
  });

  // Handle Happy Crystal KOs
  ['red','blue'].forEach(team => {
    const t = B[team];
    if (active(t).ko) {
      const idx = smartPickSwap(team);
      if (idx >= 0) {
        t.activeIdx = idx;
        active(t).hp = active(t).maxHp;
        smartTriggerEntry(t);
      }
    }
  });

  // Finn (204) — Flame Blade: auto-forge if Finn alive on team, have 2+ Healing Seeds + 1+ Sacred Fire, not yet forged
  ['red','blue'].forEach(teamKey => {
    const team = B[teamKey];
    const finnAlive = team.ghosts.some(g => g.id === 204 && !g.ko);
    if (finnAlive && (!B.flameBlade || !B.flameBlade[teamKey]) && (team.resources.healingSeed || 0) >= 1 && (team.resources.fire || 0) >= 1) {
      team.resources.healingSeed -= 1;
      team.resources.fire -= 1;
      if (!B.flameBlade) B.flameBlade = { red: false, blue: false };
      B.flameBlade[teamKey] = true;
    }
  });
  // Flame Blade: AI always swings when forged (maximises die count and enables +3 Burn on win)
  ['red','blue'].forEach(teamKey => {
    if (B.flameBlade && B.flameBlade[teamKey]) {
      if (!B.flameBladeSwing) B.flameBladeSwing = { red: false, blue: false };
      B.flameBladeSwing[teamKey] = true;
    }
  });
  // Sophia (457) — Mask: AI always keeps mask active when owned
  ['red','blue'].forEach(teamKey => {
    if (B.sophiaMask && B.sophiaMask[teamKey]) {
      B.sophiaMaskActive[teamKey] = true;
    }
  });

  // ===== COMPUTE DICE COUNTS =====
  let redCount = 3, blueCount = 3;

  // Maximo (302) first roll override — Bouril (201) hankFirstRoll is NOT cleared here;
  // it is checked and cleared in the ROLL DICE block below where [1,2,3] is actually applied.
  ['red','blue'].forEach(teamKey => {
    const f = active(B[teamKey]);
    if (f.id === 302 && f.maximoFirstRoll) {
      if (teamKey === 'red') redCount = 1; else blueCount = 1;
      f.maximoFirstRoll = false;
    }
  });

  // Timber (210) — opponent loses a die or 2 specials
  // NOTE: ice/fire/surge may have already been moved into B.committed[oppKey] by the
  // AI RESOURCE COMMITMENT block above. We must include committed totals here so we
  // match the real-game check (which fires BEFORE any commitment in doPreRollSetup).
  ['red','blue'].forEach(teamKey => {
    const team = B[teamKey];
    const f = active(team);
    if (f.id === 210 && !f.ko) {
      const oppKey = teamKey === 'red' ? 'blue' : 'red';
      const oppTeam = B[oppKey];
      if (hasSideline(oppTeam, 301)) return; // Dylan Scarecrow blocks Timber's Howl — matches index.html line 6902 dylanNegates(oppTeam)
      const r = oppTeam.resources;
      const c = B.committed[oppKey];
      const total = (r.ice||0) + (r.fire||0) + (r.surge||0) + (r.moonstone||0) + (r.healingSeed||0) + (r.luckyStone||0)
                  + (c.ice||0) + (c.fire||0) + (c.surge||0);
      if (total < 2) {
        if (oppKey === 'red') redCount = Math.max(1, redCount - 1);
        else blueCount = Math.max(1, blueCount - 1);
      } else {
        // AI: discard 2 cheapest specials rather than lose a die.
        // ice/fire/surge may live in B.committed[oppKey] rather than r, so drain
        // committed buckets for those first, then fall through to pool resources.
        let discarded = 0;
        for (const res of ['luckyStone','ice','surge','healingSeed','fire','moonstone']) {
          // For ice/fire/surge: prefer committed bucket (already allocated this round)
          if (res === 'ice' || res === 'fire' || res === 'surge') {
            while (c[res] > 0 && discarded < 2) { c[res]--; discarded++; }
          } else {
            while (r[res] > 0 && discarded < 2) { r[res]--; discarded++; }
          }
          if (discarded >= 2) break;
        }
      }
    }
  });

  // Boo Brothers (17) — Teamwork: active + base dice ≥ 2 → trade 1 die for +1 HP (pre-roll).
  // Sim auto-says "yes" — survival value of +1 HP outweighs -1 die in all scenarios.
  // Filbert (59) on enemy sideline flips +1 HP heal → -1 damage (MASK MERCHANT curse).
  // Matches index.html doBooChoice('yes') path (lines 4657–4690).
  ['red','blue'].forEach(teamKey => {
    const team = B[teamKey];
    const f = active(team);
    const enemy = opp(team);
    if (f.id === 17 && !f.ko && (ghostData(17)?.dice ?? 3) >= 2) {
      if (teamKey === 'red') redCount = Math.max(1, redCount - 1);
      else blueCount = Math.max(1, blueCount - 1);
      if (hasSideline(enemy, 59)) {
        f.hp = Math.max(0, f.hp - 1);                    // Filbert flips heal → damage
        if (f.hp <= 0) { f.ko = true; f.killedBy = 59; }
      } else {
        f.hp++;                                           // overclocks! Rule #9 — no cap
      }
    }
  });

  // Tyler (105) — Heating Up: spend 2 HP → +1 die (pre-roll, requires HP ≥ 3).
  // AI always trades when eligible — die bonus outweighs 2 HP in almost all scenarios.
  // Matches index.html doTylerChoice('yes') path: f.hp -= 2; B.preRoll[team].count += 1.
  ['red','blue'].forEach(teamKey => {
    const f = active(B[teamKey]);
    if (f.id === 105 && !f.ko && f.hp >= 3) {
      f.hp -= 2;                                              // pay the HP cost
      if (teamKey === 'red') redCount = Math.min(6, redCount + 1);
      else blueCount = Math.min(6, blueCount + 1);
    }
  });

  // Eloise (85) — Change of Heart: spend 1 Ice Shard to swap HP with enemy active ghost (pre-roll, once per round).
  // AI heuristic: always swap when enemy HP > Eloise HP (gaining HP is EV-positive for 1 ice).
  // Matches index.html doEloiseChoice('yes') path (lines 4574–4586): spend 1 ice, swap f.hp ↔ oppF.hp.
  ['red','blue'].forEach(teamKey => {
    const team = B[teamKey];
    const f = active(team);
    const enemy = opp(team);
    const ef = active(enemy);
    if (f.id !== 85 || f.ko || ef.ko || B.eloiseUsedThisRound[teamKey]) return;
    if (team.resources.ice >= 1 && f.hp < ef.hp) {         // only swap when it benefits Eloise
      const temp = f.hp;
      f.hp = ef.hp;
      ef.hp = temp;
      team.resources.ice -= 1;
      B.eloiseUsedThisRound[teamKey] = true;
    } else {
      B.eloiseUsedThisRound[teamKey] = true;               // mark used (no swap) — won't re-offer
    }
  });

  // Ice Blade swing: always swing when forged → +1 die for that roll (fires for any active ghost, not just Zain).
  // Sim always swings when forged (maximises die count and enables +2 dmg on win).
  ['red','blue'].forEach(teamKey => {
    if (B.iceBladeForgedPermanent && B.iceBladeForgedPermanent[teamKey]) {
      B.committed[teamKey].zainBlade = 1;
      if (!B.iceBladeSwing) B.iceBladeSwing = { red: false, blue: false };
      B.iceBladeSwing[teamKey] = true;
      if (teamKey === 'red') redCount++; else blueCount++;
    }
  });

  // Needle (21) — Big Bro: while on the sideline, if Buttons (id 8) is the active ghost, +1 die.
  // Blocked by Cornelius (45) on the enemy sideline. Matches index.html lines 7011–7030.
  ['red','blue'].forEach(teamKey => {
    const f = active(B[teamKey]);
    const enemyKey = teamKey === 'red' ? 'blue' : 'red';
    if (!f.ko && f.id === 8 && hasSideline(B[teamKey], 21) && !hasSideline(B[enemyKey], 45)) {
      if (teamKey === 'red') redCount++; else blueCount++;
    }
  });

  // Cyboo (100) — Spark: while on sideline, if own active ghost has < 3 HP, grant +1 die.
  // Blocked by Cornelius (45) on the enemy sideline. Matches index.html lines 6960–6978.
  ['red','blue'].forEach(teamKey => {
    const f = active(B[teamKey]);
    const enemyKey = teamKey === 'red' ? 'blue' : 'red';
    if (!f.ko && f.hp < 3 && hasSideline(B[teamKey], 100) && !hasSideline(B[enemyKey], 45)) {
      if (teamKey === 'red') redCount++; else blueCount++;
    }
  });

  // Redd (98) — Notorious: first roll after entry gets +2 extra dice; flag cleared after use.
  // Matches index.html lines 6875–6884 (consume reddFirstRoll → +2 dice, clear flag).
  ['red','blue'].forEach(teamKey => {
    const f = active(B[teamKey]);
    if (f.id === 98 && f.reddFirstRoll) {
      if (teamKey === 'red') redCount += 2; else blueCount += 2;
      f.reddFirstRoll = false;
    }
  });

  // Harrison extra dice
  B.harrisonExtraDie = { red: 0, blue: 0 };
  ['red','blue'].forEach(team => {
    if (B.committed[team].harrison > 0) {
      B.harrisonExtraDie[team] = B.committed[team].harrison;
      B.committed[team].harrison = 0;
    }
  });
  redCount += B.harrisonExtraDie.red || 0;
  blueCount += B.harrisonExtraDie.blue || 0;

  // Lucas (433) — Kindling: +1 die next roll after Miracle resurrection (consumed after use)
  if (B.lucasKindlingBonus && B.lucasKindlingBonus.red > 0) { redCount += B.lucasKindlingBonus.red; B.lucasKindlingBonus.red = 0; }
  if (B.lucasKindlingBonus && B.lucasKindlingBonus.blue > 0) { blueCount += B.lucasKindlingBonus.blue; B.lucasKindlingBonus.blue = 0; }

  // Chow (414) — Secret Ingredient: +2 dice from discarded seed
  if (B.chowExtraDie && B.chowExtraDie.red > 0) redCount += B.chowExtraDie.red;
  if (B.chowExtraDie && B.chowExtraDie.blue > 0) blueCount += B.chowExtraDie.blue;

  // Twyla (417) — Lucky Dance: MOVED to Lucky Stone section (v675) — bonus dice + seeds granted when each stone is spent

  // Gordok (430) — River Terror: +1 die next roll after stealing (consumed after use)
  if (B.gordokDieBonus && B.gordokDieBonus.red > 0) { redCount += B.gordokDieBonus.red; B.gordokDieBonus.red = 0; }
  if (B.gordokDieBonus && B.gordokDieBonus.blue > 0) { blueCount += B.gordokDieBonus.blue; B.gordokDieBonus.blue = 0; }

  // Young Cap (429) — Energize: +1 die per Healing Seed spent this pre-roll (consumed after use)
  ['red','blue'].forEach(teamKey => {
    const f = active(B[teamKey]);
    if (f && f.id === 429 && !f.ko && f.youngCapDieBonus > 0) {
      if (teamKey === 'red') redCount += f.youngCapDieBonus; else blueCount += f.youngCapDieBonus;
      f.youngCapDieBonus = 0;
    }
  });

  // Zork (463) — Stoke: AI auto-spends all Burn for +1 die each (always beneficial)
  ['red','blue'].forEach(teamKey => {
    const t = B[teamKey]; const f = active(t);
    if (f.id === 463 && !f.ko && t.resources.burn > 0) {
      const burnSpent = t.resources.burn;
      t.resources.burn = 0;
      if (teamKey === 'red') redCount += burnSpent; else blueCount += burnSpent;
      if (B.zorkDecided) B.zorkDecided[teamKey] = true;
    }
  });

  // Flame Blade item: when swinging, +1 die
  if (B.flameBladeSwing && B.flameBladeSwing.red) redCount += 1;
  if (B.flameBladeSwing && B.flameBladeSwing.blue) blueCount += 1;

  // Pip (418) — Toasted: permanent die removal
  if (B.pipDieRemoval && B.pipDieRemoval.red > 0) redCount = Math.max(1, redCount - B.pipDieRemoval.red);
  if (B.pipDieRemoval && B.pipDieRemoval.blue > 0) blueCount = Math.max(1, blueCount - B.pipDieRemoval.blue);

  // Forest Spirit (446) — Hex: consume die removal from Burn spend
  if (B.hexDieRemoval && B.hexDieRemoval.red > 0) { redCount = Math.max(1, redCount - B.hexDieRemoval.red); B.hexDieRemoval.red = 0; }
  if (B.hexDieRemoval && B.hexDieRemoval.blue > 0) { blueCount = Math.max(1, blueCount - B.hexDieRemoval.blue); B.hexDieRemoval.blue = 0; }

  // Professor Hawking (447) — Wisdom: +2 dice while holding a Moonstone (not consumed)
  ['red','blue'].forEach(teamKey => {
    const f = active(B[teamKey]);
    if (f.id === 447 && !f.ko && B[teamKey].resources.moonstone > 0) {
      if (teamKey === 'red') redCount += 2; else blueCount += 2;
    }
  });

  // Committed Surge adds dice
  redCount += B.committed.red.surge || 0;
  blueCount += B.committed.blue.surge || 0;

  // Hugo (52) — WRECKAGE!: attacker loses 1 die next roll (matches index.html lines 7237–7245)
  // B.hugoWreckage[tName] is set when Hugo (loser) takes real damage; it reduces the ATTACKER's dice.
  ['red','blue'].forEach(tName => {
    if ((B.hugoWreckage[tName] || 0) > 0) {
      if (tName === 'red') redCount = Math.max(1, redCount - B.hugoWreckage[tName]);
      else blueCount = Math.max(1, blueCount - B.hugoWreckage[tName]);
      B.hugoWreckage[tName] = 0;
    }
  });
  // Floop (20) — MUCK!: if Floop was active last round and the opponent rolled doubles, opponent loses 1 die.
  // Penalty stored on the opposing team key — consumed here and cleared. Matches index.html lines 7262–7270.
  ['red','blue'].forEach(tName => {
    if ((B.floopMuck[tName] || 0) > 0) {
      if (tName === 'red') redCount = Math.max(1, redCount - B.floopMuck[tName]);
      else blueCount = Math.max(1, blueCount - B.floopMuck[tName]);
      B.floopMuck[tName] = 0;
    }
  });
  // Logey (26) — HEINOUS!: count opponent's 5+ dice from last round → lock them out this roll (matches index.html lines 7288–7303).
  // B.logeyLockout[tName] is set when Logey counts 5+ dice on the enemy roll; consumed here and cleared.
  ['red','blue'].forEach(tName => {
    if ((B.logeyLockout[tName] || 0) > 0) {
      if (tName === 'red') redCount = Math.max(1, redCount - B.logeyLockout[tName]);
      else blueCount = Math.max(1, blueCount - B.logeyLockout[tName]);
      B.logeyLockout[tName] = 0;
    }
  });
  // Outlaw (43) — THIEF!: consume stolen-die penalty from last round — reduce ENEMY die count (matches index.html lines 7201–7216).
  // B.outlawStolenDie[tName] is keyed by Outlaw's OWN team; it removes from the ENEMY team's count.
  ['red','blue'].forEach(tName => {
    if ((B.outlawStolenDie[tName] || 0) > 0) {
      const enemyTName = tName === 'red' ? 'blue' : 'red';
      if (enemyTName === 'red') redCount = Math.max(1, redCount - B.outlawStolenDie[tName]);
      else blueCount = Math.max(1, blueCount - B.outlawStolenDie[tName]);
      B.outlawStolenDie[tName] = 0;
    }
  });
  // Suspicious Jeff (61) — SNICKER!: consume stolen-die from last round — subtract from enemy AND add to Jeff's team (true transfer).
  // B.jeffSnicker[tName] is keyed by Jeff's OWN team; enemy loses a die, Jeff's team gains a die (matches index.html lines 7280–7283).
  ['red','blue'].forEach(tName => {
    if ((B.jeffSnicker[tName] || 0) > 0) {
      const enemyTName = tName === 'red' ? 'blue' : 'red';
      if (enemyTName === 'red') redCount = Math.max(1, redCount - B.jeffSnicker[tName]);
      else blueCount = Math.max(1, blueCount - B.jeffSnicker[tName]);
      if (tName === 'red') redCount += B.jeffSnicker[tName];
      else blueCount += B.jeffSnicker[tName];
      B.jeffSnicker[tName] = 0;
    }
  });
  // Scallywags (19) — FRENZY!: consume last round's all-under-4 die bonus (matches index.html lines 7080–7098).
  // Bonus stored whenever Scallywags was active and rolled all dice < 4. Consumed unconditionally —
  // even if Scallywags died between rounds (index.html adds to count before !f.ko callout guard).
  ['red','blue'].forEach(tName => {
    if ((B.scallywagsFrenzyBonus[tName] || 0) > 0) {
      if (tName === 'red') redCount += B.scallywagsFrenzyBonus[tName];
      else blueCount += B.scallywagsFrenzyBonus[tName];
      B.scallywagsFrenzyBonus[tName] = 0;
    }
  });
  // Dream Cat (28) — JINX!: consume last round's both-doubles bonus (matches index.html lines 7060–7078).
  // Bonus stored whenever Dream Cat was active and BOTH teams rolled doubles. Consumed unconditionally —
  // die is granted to Dream Cat's team regardless of whether Dream Cat survived.
  ['red','blue'].forEach(tName => {
    if ((B.dreamCatBonus[tName] || 0) > 0) {
      if (tName === 'red') redCount += B.dreamCatBonus[tName];
      else blueCount += B.dreamCatBonus[tName];
      B.dreamCatBonus[tName] = 0;
    }
  });
  // Willow (435) — Joy of Painting: Sideline & In Play: +1 die if you lost the last roll
  // Matches index.html lines 8044–8057. willowLostLast[team] set in win/loss/tie paths below.
  ['red','blue'].forEach(tName => {
    const _wf = active(B[tName]);
    const hasWillowActive = _wf.id === 435 && !_wf.ko;
    const hasWillowSideline = hasSideline(B[tName], 435);
    if ((hasWillowActive || hasWillowSideline) && B.willowLostLast[tName]) {
      if (tName === 'red') redCount++; else blueCount++;
      // Knight Terror (401) / Knight Light (402) react to Joy of Painting
      const oppK = tName === 'red' ? 'blue' : 'red';
      const knight = active(B[oppK]);
      if (knight && !knight.ko) {
        if (knight.id === 401) { _wf.hp = Math.max(0, _wf.hp - 2); if (_wf.hp <= 0) { _wf.ko = true; _wf.killedBy = 401; } }
        else if (knight.id === 402) { B.retributionDice[oppK] = (B.retributionDice[oppK] || 0) + 1; }
      }
    }
  });
  // Haywire (78) — WILD CHORDS!: permanent +1 die bonus added every round once triggered (never consumed/cleared).
  // Mirrors index.html lines 7057–7058: `if (haywireBonus.red > 0) redCount += haywireBonus.red` (permanent, not reset).
  if ((B.haywireBonus.red || 0) > 0) redCount += B.haywireBonus.red;
  if ((B.haywireBonus.blue || 0) > 0) blueCount += B.haywireBonus.blue;

  // Marcus (57) — GLACIAL POUNDING!: +4 bonus dice next roll after taking 3+ damage
  // Bonus goes to the PLAYER — whoever is active gets the dice, even if Marcus died from the hit.
  ['red','blue'].forEach(tName => {
    if ((B.marcusGlacialBonus[tName] || 0) > 0) {
      if (tName === 'red') redCount += B.marcusGlacialBonus[tName];
      else blueCount += B.marcusGlacialBonus[tName];
      B.marcusGlacialBonus[tName] = 0;
    }
  });

  // Kairan (68) — Let's Dance: consume last round's doubles die bonus (matches index.html lines 7036–7054).
  // Guard: only apply if Kairan is STILL the active ghost — the die is personal to Kairan, lost on KO or swap.
  ['red','blue'].forEach(tName => {
    if ((B.letsDanceBonus[tName] || 0) > 0) {
      const kaiF = active(B[tName]);
      if (kaiF.id === 68 && !kaiF.ko) {
        if (tName === 'red') redCount += B.letsDanceBonus[tName];
        else blueCount += B.letsDanceBonus[tName];
      }
      B.letsDanceBonus[tName] = 0; // always clear, even if Kairan swapped/KO'd
    }
  });

  // Knight Light (402) RETRIBUTION! — bonus dice stored from last round's reactions, consumed HERE before rolling.
  // Matches index.html lines 6823–6838: `redCount += B.retributionDice.red` before dice are rolled, then cleared.
  // If KL was KO'd between storage and consumption, silently discard (same guard as index.html line 6826).
  ['red','blue'].forEach(tName => {
    const rd = B.retributionDice[tName] || 0;
    if (rd > 0) {
      const kl = active(B[tName]);
      if (kl.id === 402 && !kl.ko) {
        if (tName === 'red') redCount += rd; else blueCount += rd;
      }
      B.retributionDice[tName] = 0;
    }
  });

  // Cameron (25) — Unstoppable Force: bonus dice from opponent special usage
  if (B.cameronBonusDice) {
    ['red','blue'].forEach(tName => {
      if (B.cameronBonusDice[tName] > 0) {
        const camTeam = B[tName];
        if (camTeam.ghosts.some(g => g.id === 25 && !g.ko)) {
          if (tName === 'red') redCount += B.cameronBonusDice[tName];
          else blueCount += B.cameronBonusDice[tName];
        }
        B.cameronBonusDice[tName] = 0;
      }
    });
  }

  // Boris (343) — FORTIFY!: when Surge is committed, Boris gains +2 HP (overclocks — no cap per Rule #9)
  // Fires for the whole team's committed Surge (Boris can be active or sideline — matches index.html line 7094+)
  ['red','blue'].forEach(team => {
    const surgeCmt = B.committed[team].surge || 0;
    if (surgeCmt > 0) {
      const boris = B[team].ghosts.find(g => g.id === 343 && !g.ko);
      if (boris) {
        const enemyTeam = team === 'red' ? 'blue' : 'red';
        if (hasSideline(B[enemyTeam], 59)) {
          // Mr Filbert (59) — Mask Merchant: flip Fortify heal to damage
          boris.hp = Math.max(0, boris.hp - 2);
          if (boris.hp <= 0) { boris.hp = 0; boris.ko = true; boris.killedBy = 59; }
        } else {
          boris.hp += 2; // overclocks — no cap (Rule #9)
        }
      }
    }
  });

  // Aunt Susan bonuses
  B.auntSusanBonus = { red: false, blue: false };
  B.auntSusanHealBonus = { red: false, blue: false };
  ['red','blue'].forEach(team => {
    if (active(B[team]).id === 309) {
      if (B.committed[team].auntSusan > 0) B.auntSusanBonus[team] = B.committed[team].auntSusan;
      if (B.committed[team].auntSusanHeal > 0) B.auntSusanHealBonus[team] = B.committed[team].auntSusanHeal;
    }
  });

  // Yawn Eater (464) — Feast: +1 die per enemy sideline ability
  ['red','blue'].forEach(tName => {
    const f = active(B[tName]);
    if (f.id === 464 && !f.ko) {
      const enemyTeam = B[tName === 'red' ? 'blue' : 'red'];
      const sidelineCount = enemyTeam.ghosts.filter((g, i) => {
        if (i === enemyTeam.activeIdx || g.ko) return false;
        const gd = ghostData(g.id);
        return gd && gd.abilityDesc && (gd.abilityDesc.includes('Sideline') || gd.abilityDesc.includes('sideline'));
      }).length;
      if (sidelineCount > 0) {
        if (tName === 'red') redCount += sidelineCount;
        else blueCount += sidelineCount;
      }
    }
  });

  // Antoinette (82) — GRACE!: matches opponent's dice count (upward mirror only). +1 damage on doubles.
  // Applied after all other bonuses so surge/retribution/frenzy/etc. are already baked in.
  // Fredrick (27) cap still applies after Grace — matches index.html lines 7184–7199 ordering.
  ['red','blue'].forEach(tName => {
    const f = active(B[tName]);
    if (f.id === 82 && !f.ko) {
      const myCount  = tName === 'red' ? redCount  : blueCount;
      const oppCount = tName === 'red' ? blueCount : redCount;
      if (oppCount > myCount) {
        if (tName === 'red') redCount  = oppCount;
        else                 blueCount = oppCount;
      }
    }
  });

  // Sophia (457) — Mask of Night: roll the same number of dice as the enemy ghost
  ['red','blue'].forEach(tName => {
    if (B.sophiaMask && B.sophiaMask[tName] === 'night' && B.sophiaMaskActive && B.sophiaMaskActive[tName]) {
      const myCount = tName === 'red' ? redCount : blueCount;
      const oppCount = tName === 'red' ? blueCount : redCount;
      if (myCount !== oppCount) {
        if (tName === 'red') redCount = oppCount;
        else blueCount = oppCount;
      }
    }
  });

  // Fredrick (27) — CAREFUL!: when Fredrick is active, cap opponent dice at 3 (applied LAST — overrides all bonuses).
  // Matches index.html lines 7305–7319: applied after all doPreRollSetup bonuses so surge/retribution/frenzy can't exceed 3.
  // No Dylan check — index.html does not guard Fredrick's cap against Dylan (301).
  ['red','blue'].forEach(tName => {
    const f = active(B[tName]);
    if (f.id === 27 && !f.ko) {
      const oppKey = tName === 'red' ? 'blue' : 'red';
      if (oppKey === 'red' && redCount > 3) redCount = 3;
      else if (oppKey === 'blue' && blueCount > 3) blueCount = 3;
    }
  });

  // ===== ROLL DICE =====
  let redDice, blueDice;
  // Laura (79) — Catchy Tune: inject locked die, roll one fewer
  const ctLockedRed = (B.catchyTuneUnlocked.red && B.catchyTuneLockedDie.red !== null && redCount > 0) ? B.catchyTuneLockedDie.red : null;
  const ctLockedBlue = (B.catchyTuneUnlocked.blue && B.catchyTuneLockedDie.blue !== null && blueCount > 0) ? B.catchyTuneLockedDie.blue : null;
  const redRollCount = ctLockedRed !== null ? Math.max(0, redCount - 1) : redCount;
  const blueRollCount = ctLockedBlue !== null ? Math.max(0, blueCount - 1) : blueCount;

  // Bouril override
  if (active(B.red).id === 201 && active(B.red).hankFirstRoll) {
    redDice = [1,2,3]; active(B.red).hankFirstRoll = false;
  } else {
    redDice = weightedRoll('red', redRollCount).sort((a,b)=>a-b);
    if (ctLockedRed !== null) { redDice.push(ctLockedRed); redDice.sort((a,b)=>a-b); }
  }
  if (active(B.blue).id === 201 && active(B.blue).hankFirstRoll) {
    blueDice = [1,2,3]; active(B.blue).hankFirstRoll = false;
  } else {
    blueDice = weightedRoll('blue', blueRollCount).sort((a,b)=>a-b);
    if (ctLockedBlue !== null) { blueDice.push(ctLockedBlue); blueDice.sort((a,b)=>a-b); }
  }

  // Dark Wing (76) — Precision: if rolled singles (no matching dice), reroll all dice once.
  // AI always rerolls on singles — getting doubles is never worse. Matches index.html
  // checkDarkWingPrecision (line 5114) + doDarkWingChoice('yes') (line 5128).
  // Only fires when classify returns 'singles' (triples/quads are already better than doubles;
  // AI declines the technically-offered reroll on those — correct sim AI decision).
  ['red','blue'].forEach(teamKey => {
    const f = active(B[teamKey]);
    if (f.id !== 76 || f.ko || B.darkWingUsedThisGame[teamKey]) return;
    const curDice = teamKey === 'red' ? redDice : blueDice;
    if (classify(curDice).type !== 'singles') return; // already doubles or better — keep dice
    const rerolled = weightedRoll(teamKey, curDice.length).sort((a, b) => a - b);
    if (teamKey === 'red') { redDice.splice(0, redDice.length, ...rerolled); }
    else { blueDice.splice(0, blueDice.length, ...rerolled); }
    B.darkWingUsedThisGame[teamKey] = true;
  });

  // Tommy Salami (30) — REGULATOR!: when Tommy rolls a 6, gain +1 bonus die rolled immediately.
  // Chains as long as bonus dice keep rolling 6s. Modifies Tommy's own dice array.
  // B.tommyRegulatorBonus[tommyTeam] stores total bonus dice added (for callouts only, no win-path damage).
  // Matches index.html checkTommyRegulator.
  B.tommyRegulatorBonus.red = 0; B.tommyRegulatorBonus.blue = 0;
  ['red','blue'].forEach(tKey => {
    const tF = active(B[tKey]);
    if (tF.id !== 30 || tF.ko) return;
    const tommyDice = tKey === 'red' ? redDice : blueDice;
    let newSixes = tommyDice.filter(d => d === 6).length;
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
      tommyDice.sort((a, b) => a - b);
      B.tommyRegulatorBonus[tKey] = totalBonus;
    }
  });

  // Jackson (50) — Regrow: after rolling (and Dark Wing reroll + Tommy mutation), may spend HP to reroll
  // the lowest die. Can repeat as long as HP >= 2. AI heuristic: always spend — rerolling lowest is EV-positive.
  B.jacksonUsedThisRound.red = false; B.jacksonUsedThisRound.blue = false;
  B.eloiseUsedThisRound.red = false; B.eloiseUsedThisRound.blue = false;
  ['red','blue'].forEach(tKey => {
    const jF = active(B[tKey]);
    if (jF.id !== 50 || jF.ko) return;
    const jDice = tKey === 'red' ? redDice : blueDice;
    // Keep rerolling lowest die as long as HP allows
    while (jF.hp >= 2) {
      const newVal = weightedRoll(tKey, 1)[0];
      jDice[0] = newVal;
      jDice.sort((a, b) => a - b);
      jF.hp -= 1;
    }
  });

  // Snapshot Moonstones + Lucky Stones BEFORE post-roll triggers grant new ones.
  // Resources gained mid-round (Natalia, Hank, etc.) should NOT be usable this turn.
  // Mirrors index.html B.msAvailable / B.lsAvailable snapshot (line 6966–6973).
  const simMsAvailable = { red: B.red.resources.moonstone, blue: B.blue.resources.moonstone };
  const simLsAvailable = { red: B.red.resources.luckyStone, blue: B.blue.resources.luckyStone };

  // ===== POST-ROLL TRIGGERS =====
  // Hank (207) — each 4 = +1 Lucky Stone (+ Sandwiches DEPENDABLE! mirror — index.html line 7392)
  ['red','blue'].forEach(teamKey => {
    const t = B[teamKey]; const f = active(t);
    const dice = teamKey === 'red' ? redDice : blueDice;
    if (f.id === 207 && !f.ko) {
      const fours = dice.filter(d => d === 4).length;
      if (fours > 0) {
        t.resources.luckyStone += fours;
        const oppKey = teamKey === 'red' ? 'blue' : 'red';
        if (hasSideline(B[oppKey], 33)) B[oppKey].resources.luckyStone += fours; // DEPENDABLE! mirror
      }
    }
  });

  // Maisie (458) — Lucky: all 1s count as 5s (mutate dice FIRST)
  ['red','blue'].forEach(teamKey => {
    const t = B[teamKey]; const f = active(t);
    if (f.id === 458 && !f.ko) {
      const dice = teamKey === 'red' ? redDice : blueDice;
      for (let i = 0; i < dice.length; i++) { if (dice[i] === 1) dice[i] = 5; }
      dice.sort((a, b) => a - b);
    }
  });

  // Sophia (457) — Mask of Day: gain 1 Burn for each 1 or 2 you roll (post-roll, both teams)
  ['red','blue'].forEach(teamKey => {
    if (B.sophiaMask && B.sophiaMask[teamKey] === 'day' && B.sophiaMaskActive && B.sophiaMaskActive[teamKey]) {
      const dice = teamKey === 'red' ? redDice : blueDice;
      const lowRolls = dice.filter(d => d === 1 || d === 2).length;
      if (lowRolls > 0) {
        const t = B[teamKey];
        if (!t.resources.burn) t.resources.burn = 0;
        t.resources.burn += lowRolls;
      }
    }
  });

  // Natalia (327) — even doubles = +2 moonstones (+ Sandwiches DEPENDABLE! mirror — index.html line 7427)
  ['red','blue'].forEach(teamKey => {
    const t = B[teamKey]; const f = active(t);
    const dice = teamKey === 'red' ? redDice : blueDice;
    if (f.id === 327 && !f.ko && hasEvenDoubles(dice)) {
      t.resources.moonstone += 2;
      const oppKey = teamKey === 'red' ? 'blue' : 'red';
      if (hasSideline(B[oppKey], 33)) B[oppKey].resources.moonstone += 2; // DEPENDABLE! mirror
    }
  });

  // Kaplan (308) — opponent doubles = +1 seed (+ Sandwiches DEPENDABLE! mirror — index.html line 7450)
  ['red','blue'].forEach(teamKey => {
    const t = B[teamKey]; const f = active(t);
    const oppDice = teamKey === 'red' ? blueDice : redDice;
    if (f.id === 308 && !f.ko && classify(oppDice).type === 'doubles') {
      t.resources.healingSeed++;
      const oppKey = teamKey === 'red' ? 'blue' : 'red';
      if (hasSideline(B[oppKey], 33)) B[oppKey].resources.healingSeed++; // DEPENDABLE! mirror
    }
  });

  // Rascals (437) — Stampede: MOVED to entry in v685 (see smartTriggerEntry)

  // Gom Gom Gom (440) — Chaos: MOVED to win-path only in v685 (was post-roll both teams)

  // Champ (438) — Thrill (B): +1 Surge on any doubles+ (either team)
  ['red','blue'].forEach(teamKey => {
    const t = B[teamKey]; const f = active(t);
    if (f.id === 438 && !f.ko) {
      const redRoll = classify(redDice);
      const blueRoll = classify(blueDice);
      const eitherDoubles = ['doubles','triples','quads','penta'].includes(redRoll.type) || ['doubles','triples','quads','penta'].includes(blueRoll.type);
      if (eitherDoubles) { t.resources.surge++; }
    }
  });

  // Ronan (461) — Mixup: if you roll doubles+ → gain +1 Ice Shard & +1 Burn (win or lose)
  ['red','blue'].forEach(teamKey => {
    const t = B[teamKey]; const f = active(t);
    const ronanDice = teamKey === 'red' ? redDice : blueDice;
    if (f.id === 461 && !f.ko && ['doubles','triples','quads','penta'].includes(classify(ronanDice).type)) {
      if (!t.resources.ice) t.resources.ice = 0;
      t.resources.ice += 1;
      if (!t.resources.burn) t.resources.burn = 0;
      t.resources.burn += 1;
    }
  });

  // ===== AI: MOONSTONE (change a die to improve hand) =====
  // Only use moonstones that existed BEFORE this round (snapshot), not mid-roll gains (Natalia etc.)
  ['red','blue'].forEach(teamKey => {
    const t = B[teamKey];
    if (simMsAvailable[teamKey] > 0 && t.resources.moonstone > 0) {
      const dice = teamKey === 'red' ? redDice : blueDice;
      const improved = smartMoonstoneChange(dice);
      // Only use if it actually improves the hand
      const oldR = classify([...dice].sort((a,b)=>a-b));
      const newR = classify(improved);
      const typeRank = {penta:5,quads:4,triples:3,doubles:2,singles:1,none:0};
      const oldScore = typeRank[oldR.type] * 10 + oldR.value;
      const newScore = typeRank[newR.type] * 10 + newR.value;
      if (newScore > oldScore) {
        // Benjamin (203) — Magic Touch: don't spend moonstone once per turn
        if (active(t).id === 203 && !active(t).usedMagicTouch) {
          active(t).usedMagicTouch = true;
        } else {
          t.resources.moonstone--;
          simMsAvailable[teamKey]--;
        }
        if (teamKey === 'red') { redDice.splice(0, redDice.length, ...improved); }
        else { blueDice.splice(0, blueDice.length, ...improved); }
        // Bigsby (424) — Omen: Moonstone use → sacrifice Bigsby, replace with Doom (112)
        const msF = active(t);
        if (msF.id === 424 && !msF.ko) {
          // Preserve original identity for standings/results
          msF.originalId = msF.id;
          msF.originalName = msF.name;
          msF.originalArt = msF.art;
          msF.originalMaxHp = msF.maxHp;
          msF.originalAbility = msF.ability;
          msF.originalAbilityDesc = msF.abilityDesc;
          msF.originalRarity = msF.rarity;
          msF.id = 112; msF.name = "Doom"; msF.maxHp = 7; msF.hp = 7;
          msF.ability = "Fiendship"; msF.abilityDesc = "+2 bonus damage!";
          msF.art = "art/originals/doom.jpg"; msF.rarity = "legendary"; msF.ko = false;
        }
      }
    }
  });

  // ===== AI: LUCKY STONE (reroll lowest die) =====
  // Only use lucky stones that existed BEFORE this round (snapshot), not mid-roll gains (Hank etc.)
  ['red','blue'].forEach(teamKey => {
    const t = B[teamKey];
    if (simLsAvailable[teamKey] > 0 && t.resources.luckyStone > 0) {
      const dice = teamKey === 'red' ? redDice : blueDice;
      const improved = smartLuckyStone(dice);
      t.resources.luckyStone--;
      simLsAvailable[teamKey]--;
      // Track Lucky Stone usage for Twyla (417) Lucky Dance
      if (B.luckyStoneSpentThisTurn) B.luckyStoneSpentThisTurn[teamKey] = (B.luckyStoneSpentThisTurn[teamKey] || 0) + 1;
      // Boopies (419) — Boopie Magic: sideline — when active spends Healing Seed... (Lucky Stone spending, not seed — no trigger here)
      if (teamKey === 'red') { redDice.splice(0, redDice.length, ...improved); }
      else { blueDice.splice(0, blueDice.length, ...improved); }
      // Twyla (417) — Lucky Dance: each stone spent adds +1 bonus die + +1 Healing Seed (v675)
      const twylaF = active(B[teamKey]);
      if (twylaF.id === 417 && !twylaF.ko) {
        const lsRoll2 = Math.random();
        const bonusDie = lsRoll2 < 0.12 ? 1 : lsRoll2 < 0.22 ? 2 : lsRoll2 < 0.34 ? 3 : lsRoll2 < 0.50 ? 4 : lsRoll2 < 0.70 ? 5 : 6;
        const tDice = teamKey === 'red' ? redDice : blueDice;
        tDice.push(bonusDie);
        tDice.sort((a, b) => a - b);
        B[teamKey].resources.healingSeed++;
      }
    }
  });

  // ===== BLACKOUT (Smudge 403) =====
  ['red','blue'].forEach(team => {
    const oppTeam = team === 'red' ? 'blue' : 'red';
    const smudgeActive = active(B[team]).id === 403 && !active(B[team]).ko;
    if (B.blackoutNum[team] && smudgeActive) {
      const num = B.blackoutNum[team];
      const targetDice = team === 'red' ? blueDice : redDice;
      const filtered = targetDice.filter(d => d !== num);
      targetDice.splice(0, targetDice.length, ...filtered);
    }
  });
  B.blackoutNum = {};

  // ===== RESOLVE: CLASSIFY & DETERMINE WINNER =====
  const rR = classify(redDice), bR = classify(blueDice);
  const typeRank = {penta:5,quads:4,triples:3,doubles:2,singles:1,none:0};
  // Hector (96) — Protector: when Hector is active on either team, singles beat doubles.
  // Singles get effective rank 2.5 (still lose to triples/quads/penta). Matches index.html lines 8611–8618.
  const _hR = active(B.red), _hB = active(B.blue);
  const hectorActive = (_hR.id === 96 && !_hR.ko) || (_hB.id === 96 && !_hB.ko);
  const rEffRank = (hectorActive && rR.type === 'singles' && bR.type === 'doubles') ? 2.5 : typeRank[rR.type];
  const bEffRank = (hectorActive && bR.type === 'singles' && rR.type === 'doubles') ? 2.5 : typeRank[bR.type];
  let winner = null;
  if (rEffRank > bEffRank) winner = 'red';
  else if (bEffRank > rEffRank) winner = 'blue';
  else if (rR.value > bR.value) winner = 'red';
  else if (bR.value > rR.value) winner = 'blue';
  if (!winner) {
    const rRemain = [...redDice], bRemain = [...blueDice];
    const mc = {doubles:2,triples:3,quads:4,penta:5,singles:1,none:0}[rR.type]||0;
    for (let i=0;i<mc;i++) { const ri=rRemain.indexOf(rR.value); if(ri>=0)rRemain.splice(ri,1); const bi=bRemain.indexOf(bR.value); if(bi>=0)bRemain.splice(bi,1); }
    rRemain.sort((a,b)=>b-a); bRemain.sort((a,b)=>b-a);
    for (let i=0;i<Math.max(rRemain.length,bRemain.length);i++) {
      const rv=i<rRemain.length?rRemain[i]:0, bv=i<bRemain.length?bRemain[i]:0;
      if(rv>bv){winner='red';break;} if(bv>rv){winner='blue';break;}
    }
  }

  // Captain James (443) — Final Strike: triples+ → gain 2 Sacred Fires (win or lose)
  ['red','blue'].forEach(cjKey => {
    const cjF = active(B[cjKey]);
    const cjDice = cjKey === 'red' ? redDice : blueDice;
    if (cjF.id === 443 && !cjF.ko && ['triples','quads','penta'].includes(classify(cjDice).type)) {
      B[cjKey].resources.fire += 2;
    }
  });

  // ===== TIE EFFECTS =====
  if (!winner) {
    // Tweak and Twonk (303) sideline: tie → +4 Surge (matches index.html line 8697 ROARING CROWD! "+4 Surge"; was wrong at +3)
    // Sandwiches (33) DEPENDABLE! mirror: opponent also gains +4 Surge if Sandwiches on their sideline (matches index.html line 8716-8718)
    ['red','blue'].forEach(teamKey => {
      if (hasSideline(B[teamKey], 303)) {
        B[teamKey].resources.surge += 4;
        const oppKey = teamKey === 'red' ? 'blue' : 'red';
        if (hasSideline(B[oppKey], 33)) B[oppKey].resources.surge += 4; // DEPENDABLE! mirror
      }
    });
    // Jimmy (352) Sideline & In Play: tie → +3 Lucky Stones + 1 Magic Firefly
    // Sandwiches (33) DEPENDABLE! mirror: opponent also gains +3 Lucky Stones + 1 Magic Firefly if Sandwiches on their sideline
    ['red','blue'].forEach(teamKey => {
      const f = active(B[teamKey]);
      const hasJimmyActive = f.id === 352 && !f.ko;
      const hasJimmySideline = hasSideline(B[teamKey], 352);
      if (hasJimmyActive || hasJimmySideline) {
        B[teamKey].resources.luckyStone += 3;
        B[teamKey].resources.firefly = (B[teamKey].resources.firefly || 0) + 1;
        const oppKey = teamKey === 'red' ? 'blue' : 'red';
        if (hasSideline(B[oppKey], 33)) {
          B[oppKey].resources.luckyStone += 3;
          B[oppKey].resources.firefly = (B[oppKey].resources.firefly || 0) + 1;
        }
      }
    });
    // Goob Party (444) — Dance Break: Sideline & In Play: on a tie, both players gain 1 Magic Firefly
    // Fire once even if both teams have Goob Party. Matches index.html tie-path Goob Party block.
    {
      let goobFired = false;
      ['red','blue'].forEach(teamKey => {
        if (goobFired) return;
        const f = active(B[teamKey]);
        const hasGoobActive = f.id === 444 && !f.ko;
        const hasGoobSideline = hasSideline(B[teamKey], 444);
        if (hasGoobActive || hasGoobSideline) {
          goobFired = true;
          [B.red, B.blue].forEach(t => {
            if (!t.resources.firefly) t.resources.firefly = 0;
            t.resources.firefly += 2;
          });
        }
      });
    }
    // Ancient One (22) — Friend to All: sideline passive → active ghost gains +3 HP on ties
    // Cornelius (45) on enemy sideline blocks. Filbert (59) on enemy sideline flips to -3 damage.
    // Overclocks per Rule #9 — no Math.min cap. Matches index.html lines 8868–8893.
    ['red','blue'].forEach(teamKey => {
      if (!hasSideline(B[teamKey], 22)) return;
      const f = active(B[teamKey]);
      if (f.ko) return;
      const enemy = opp(B[teamKey]);
      if (hasSideline(enemy, 45)) return;            // Cornelius blocks Friend to All
      if (hasSideline(enemy, 59)) {
        f.hp = Math.max(0, f.hp - 3);               // Filbert flips heal → 3 damage
        if (f.hp <= 0) { f.ko = true; f.killedBy = 59; }
      } else {
        f.hp += 3;                                   // overclocks! Rule #9
      }
    });
    // Opa (48) — Rest: active ghost ties → +1 HP. Filbert (59) on enemy sideline flips to -1 damage.
    // Overclocks per Rule #9 — no Math.min cap. Matches index.html lines 8848–8864.
    ['red','blue'].forEach(teamKey => {
      const f = active(B[teamKey]);
      if (f.id !== 48 || f.ko) return;
      const enemy = opp(B[teamKey]);
      if (hasSideline(enemy, 59)) {
        f.hp = Math.max(0, f.hp - 1);
        if (f.hp <= 0) { f.ko = true; f.killedBy = 59; }
      } else {
        f.hp++; // overclocks! Rule #9
      }
    });
    // Maximo (302) NAP! on tie is handled by the unconditional end-of-round block below —
    // do NOT add it here or he gets +2 seeds on every tie round (double-fire bug).
    // Mark both active ghosts as having resolved a roll so Nikon/Cave Dweller AMBUSH/LURK
    // don't fire on a 2nd-round win after a 1st-round tie. Mirrors index.html lines 8687–8688.
    active(B.red)._rolledOnce = true;
    active(B.blue)._rolledOnce = true;
    // Floop (20) — MUCK!: tie — if Floop is active and opponent rolled doubles, opponent loses 1 die next round.
    // Mirrors index.html tie-path block at lines 8811–8825.
    ['red','blue'].forEach(teamKey => {
      const f = active(B[teamKey]);
      if (f.id !== 20 || f.ko) return;
      const enemyKey = teamKey === 'red' ? 'blue' : 'red';
      const enemyR = teamKey === 'red' ? bR : rR;
      if (enemyR.type === 'doubles') B.floopMuck[enemyKey] = (B.floopMuck[enemyKey] || 0) + 1;
    });
    // Logey (26) — HEINOUS!: tie — count opponent's 5+ dice, lock them out next roll.
    // Mirrors index.html tie-path block at lines 8827–8842.
    ['red','blue'].forEach(teamKey => {
      const f = active(B[teamKey]);
      if (f.id !== 26 || f.ko) return;
      const enemyKey = teamKey === 'red' ? 'blue' : 'red';
      const enemyDice = teamKey === 'red' ? blueDice : redDice;
      const locked = (enemyDice || []).filter(d => d >= 5).length;
      if (locked > 0) B.logeyLockout[enemyKey] = (B.logeyLockout[enemyKey] || 0) + locked;
    });
    // Outlaw (43) — THIEF!: tie — if Outlaw is active and rolled doubles, steal 1 enemy die next round.
    // Mirrors index.html tie-path block at lines 8774–8783.
    ['red','blue'].forEach(teamKey => {
      const f = active(B[teamKey]);
      if (f.id !== 43 || f.ko) return;
      const myR = teamKey === 'red' ? rR : bR;
      if (myR.type === 'doubles') B.outlawStolenDie[teamKey] = (B.outlawStolenDie[teamKey] || 0) + 1;
    });
    // Scallywags (19) — FRENZY!: tie — if own dice are all under 4, gain +1 die next turn.
    // Mirrors index.html tie-path block at lines 8798–8809.
    ['red','blue'].forEach(teamKey => {
      const f = active(B[teamKey]);
      if (f.id !== 19 || f.ko) return;
      const scDice = teamKey === 'red' ? redDice : blueDice;
      if (scDice && scDice.length > 0 && scDice.every(d => d < 4)) {
        B.scallywagsFrenzyBonus[teamKey] = (B.scallywagsFrenzyBonus[teamKey] || 0) + 1;
      }
    });
    // Dream Cat (28) — JINX!: tie — in a tie both teams always roll the same type (equal sums required),
    // so rR.type === 'doubles' means BOTH teams rolled doubles. Mirrors index.html lines 8844–8854.
    if (rR.type === 'doubles') {
      ['red','blue'].forEach(teamKey => {
        const f = active(B[teamKey]);
        if (f.id === 28 && !f.ko) B.dreamCatBonus[teamKey] = (B.dreamCatBonus[teamKey] || 0) + 1;
      });
    }
    // Haywire (78) — WILD CHORDS!: tie — triples or better still grants +1 permanent die (once per game).
    // In a tie, both teams roll the same type, so rR.type covers both. Mirrors index.html lines 8784–8796.
    if (['triples','quads','penta'].includes(rR.type)) {
      ['red','blue'].forEach(teamKey => {
        const f = active(B[teamKey]);
        if (f.id === 78 && !f.ko && !B.haywireUsed[teamKey]) {
          B.haywireBonus[teamKey] = (B.haywireBonus[teamKey] || 0) + 1;
          B.haywireDamageBonus[teamKey] = 2;
          B.haywireUsed[teamKey] = true;
        }
      });
    }
    // Kairan (68) — Let's Dance: doubles (tie) → +1 die next roll. Each team checked independently
    // since in a tie both may roll different types (singles vs singles with same sum — though rare).
    // Mirrors index.html tie-path block at lines 8758–8770.
    ['red','blue'].forEach(teamKey => {
      const f = active(B[teamKey]);
      if (f.id !== 68 || f.ko) return;
      const kaiRoll = teamKey === 'red' ? rR : bR;
      if (kaiRoll.type === 'doubles') {
        B.letsDanceBonus[teamKey] = (B.letsDanceBonus[teamKey] || 0) + 1;
      }
    });
    // Sable (413) — Smoldering Soul: all odd dice → +1 Sacred Fire (active or sideline, tie path)
    ['red','blue'].forEach(teamKey => {
      const f = active(B[teamKey]);
      const sableDice = teamKey === 'red' ? redDice : blueDice;
      const hasSableActive = f.id === 413 && !f.ko;
      const hasSableSideline = hasSideline(B[teamKey], 413);
      if ((hasSableActive || hasSableSideline) && sableDice && sableDice.length > 0 && sableDice.every(d => d % 2 === 1)) {
        B[teamKey].resources.fire++;
      }
    });
    // Pip (418) — Toasted: triples+ → remove 1 enemy die permanently + 2 Sacred Fires (once per game, tie path)
    ['red','blue'].forEach(teamKey => {
      const f = active(B[teamKey]);
      const pipRoll = teamKey === 'red' ? rR : bR;
      if (f.id === 418 && !f.ko && isTripleOrBetter(pipRoll.type) && B.pipToastedUsed && !B.pipToastedUsed[teamKey]) {
        B.pipToastedUsed[teamKey] = true;
        const oppName = teamKey === 'red' ? 'blue' : 'red';
        B.pipDieRemoval[oppName] = (B.pipDieRemoval[oppName] || 0) + 1;
        B[teamKey].resources.fire += 2;
      }
    });
    // Reset luckyStoneSpentThisTurn on tie (mirrors index.html line 9168)
    if (B.luckyStoneSpentThisTurn) { B.luckyStoneSpentThisTurn.red = 0; B.luckyStoneSpentThisTurn.blue = 0; }
    if (B.preRollAbilitiesFiredThisTurn) { B.preRollAbilitiesFiredThisTurn.red = false; B.preRollAbilitiesFiredThisTurn.blue = false; }
    // Willow (435) — Joy of Painting: tie = nobody lost, clear both flags (mirrors index.html line 10115)
    if (B.willowLostLast) { B.willowLostLast.red = false; B.willowLostLast.blue = false; }
    // Reset item swing toggles on tie
    if (B.flameBladeSwing) { B.flameBladeSwing.red = false; B.flameBladeSwing.blue = false; }
    if (B.iceBladeSwing) { B.iceBladeSwing.red = false; B.iceBladeSwing.blue = false; }
    // Fang Undercover (7) — clear arm on tie (no damage taken this round). Mirrors index.html line 8968.
    B.fangUndercoverArmed.red = false;
    B.fangUndercoverArmed.blue = false;
  }

  // ===== APPLY DAMAGE =====
  if (winner) {
    const winTeamName = winner;
    const wTeam = B[winner], lTeamName = winner==='red'?'blue':'red', lTeam = B[lTeamName];
    const wF = active(wTeam), lF = active(lTeam);
    // Per-ghost first-roll tracking for Nikon (2) AMBUSH! and Cave Dweller (46) LURK!
    // Must be computed BEFORE setting _rolledOnce = true. Mirrors index.html lines 9019–9022.
    // wF._wasFirstRoll is also stored for the knight-reaction block (which runs after _rolledOnce is set).
    const nikonIsFirstRoll = (wF.id === 2 && !wF._rolledOnce);
    const caveDwellerIsFirstRoll = (wF.id === 46 && !wF._rolledOnce);
    wF._wasFirstRoll = !wF._rolledOnce;  // snapshot for knight block below (ef._wasFirstRoll check)
    wF._rolledOnce = true;
    lF._rolledOnce = true;
    const wR = winner==='red'?rR:bR;
    const lR = winner==='red'?bR:rR; // v672 fix: lR was used but never defined — crashed sim on Bubble Boys/Floop/Outlaw/Dream Cat
    const winDice = winner==='red' ? redDice : blueDice;
    let dmg = wR.damage;

    // Toby (97) — Pure Heart: win with declaration → instant KO (boost dmg to lF.hp to guarantee KO).
    // Mirrors index.html lines 9366–9372: `dmg = lF.hp; pureHeartKO = true;`
    if (wF.id === 97 && !wF.ko && B.pureHeartDeclared[winTeamName] === true) { dmg = lF.hp; }

    // Romy (114) — Valley Guardian: if Romy wins and any winning die matches her prediction, +3 damage.
    // Mirrors index.html lines 9357–9367: capture romyPrediction[winTeam], check winDice.includes(pred).
    const _romyPred = B.romyPrediction ? B.romyPrediction[winTeamName] : null;
    if (wF.id === 114 && !wF.ko && _romyPred != null && _romyPred !== -1 && winDice.includes(_romyPred)) { dmg += 3; }

    // Champ (438) — Thrill (A): immune to damage from Specials (committed resources)
    const champImmuneToSpecials = lF.id === 438 && !lF.ko;
    // Ice Shards (+1 each; Skylar (104) WINTER BARRAGE! doubles to +2 each when Skylar wins)
    // Matches index.html lines 9059–9071: `const perShard = skylarActive ? 2 : 1;`
    const iceCommitted = B.committed[winTeamName].ice || 0;
    if (!champImmuneToSpecials) {
      const icePerShard = (wF.id === 104 && !wF.ko) ? 2 : 1;
      dmg += iceCommitted * icePerShard;
    }
    // Sacred Fire (+3 each; Tyler (105) Heating Up doubles to +6 each when Tyler wins)
    // Rook (416) — Charcoal: immune to Sacred Fire damage when Rook is the loser
    const fireCommitted = B.committed[winTeamName].fire || 0;
    if (fireCommitted > 0 && lF.id !== 416 && !champImmuneToSpecials) {
      const firePerUnit = (wF.id === 105 && !wF.ko) ? 6 : 3;
      // Lucy's Shadow (439) — Mentor: doubles Sacred Fire damage when Lucy (108) is active winner
      const lucyShadowBoost = (wF.id === 108 && hasSideline(wTeam, 439)) ? 2 : 1;
      dmg += fireCommitted * firePerUnit * lucyShadowBoost;
    }
    // Eternal Flame (406) — don't discard sacred fires
    if (fireCommitted > 0 && wTeam.ghosts.some(g => g.id === 406 && !g.ko)) {
      wTeam.resources.fire += fireCommitted;
    }
    // Aunt Susan damage bonus (+2 per seed) — blocked by Champ Thrill
    if (B.auntSusanBonus[winTeamName] > 0 && !champImmuneToSpecials) dmg += B.auntSusanBonus[winTeamName] * 2;
    // Haywire (78) — Wild Chords permanent +2 damage on any winning roll after the trigger
    if (wF.id === 78 && !wF.ko && (B.haywireDamageBonus[winTeamName] || 0) > 0) {
      dmg += B.haywireDamageBonus[winTeamName];
    }
    // Rook (416) — Charcoal: Win: +1 dmg per Surge committed — blocked by Champ Thrill
    if (wF.id === 416 && !wF.ko && B.committed[winTeamName].surge > 0 && !champImmuneToSpecials) {
      dmg += B.committed[winTeamName].surge;
    }
    // Bigsby (424) — Omen: Win: +1 damage
    if (wF.id === 424 && !wF.ko) { dmg += 1; }
    // Mike (445) — Torrent: Win: +1 damage
    if (wF.id === 445 && !wF.ko && wR.type === 'doubles' && wR.value % 2 === 0) { dmg += 2; }
    // Twyla (417) — Lucky Dance: v674 rework — moved to dice count section (Lucky Stones give dice + Healing Seeds, not damage + HP)
    // Pudge (311) — doubles: +2 damage, 1 self-damage
    if (wF.id === 311 && wR.type === 'doubles') {
      dmg += 2;
      wF.hp = Math.max(0, wF.hp - 1);
      if (wF.hp <= 0) { wF.ko = true; wF.killedBy = -1; } // self-inflicted (Belly Flop) — no kill credit to enemy; matches index.html line 9873
    }
    // Zain (206) — Ice Blade: permanent +2 damage on ALL wins once forged AND swinging (team-wide)
    if (B.iceBladeForgedPermanent && B.iceBladeForgedPermanent[winTeamName] && (B.committed[winTeamName].zainBlade > 0 || (B.iceBladeSwing && B.iceBladeSwing[winTeamName]))) dmg += 2;
    // Flame Blade: +3 Burn on win when swinging
    if (B.flameBlade && B.flameBlade[winTeamName] && B.flameBladeSwing && B.flameBladeSwing[winTeamName]) {
      if (!wTeam.resources.burn) wTeam.resources.burn = 0;
      wTeam.resources.burn += 3;
    }
    // Sophia (457) — Mask of Night: +1 damage on win when active
    if (B.sophiaMask && B.sophiaMask[winTeamName] === 'night' && B.sophiaMaskActive && B.sophiaMaskActive[winTeamName]) {
      dmg += 1;
    }
    // Red Hunter (345) — enemy has resources (pool + committed ice/fire/surge): +3 damage
    // Matches index.html lines 9372–9385: checks both eRes AND B.committed[loseTeamName].
    // In the sim, ice/fire/surge are moved to committed BEFORE this block runs — checking
    // only resources misses opponents who've committed, causing Red Hunter to skip the +3 dmg.
    if (wF.id === 345 && !wF.ko) {
      const eRes = lTeam.resources;
      const eCom = B.committed[lTeamName];
      if ((eRes.moonstone + eRes.healingSeed + eRes.luckyStone
          + eRes.ice + (eCom.ice||0) + eRes.fire + (eCom.fire||0) + eRes.surge + (eCom.surge||0)) > 0) dmg += 3;
    }
    // Timpleton (312) — Big Target: win a roll → +3 damage if enemy HP > Timpleton's HP.
    // Matches index.html resolveRound (v640 rework: entry → win-path). lF guard mirrors index.html.
    if (wF.id === 312 && !wF.ko && lF && !lF.ko && lF.hp > wF.hp) { dmg += 3; }
    // Hector (96) — Protector: singles win → +1 bonus damage. Matches index.html lines 9343–9349.
    if (wF.id === 96 && !wF.ko && wR.type === 'singles') { dmg += 1; }
    // Team Zippy (40) — Teamwork: singles win → +2 bonus damage. Matches index.html lines 9289–9299.
    if (wF.id === 40 && !wF.ko && wR.type === 'singles') { dmg += 2; }
    // Ridley (462) — Nimble: singles +1 damage, doubles+ +2 damage.
    if (wF.id === 462 && !wF.ko) {
      if (wR.type === 'singles') { dmg += 1; }
      else if (['doubles','triples','quads','penta'].includes(wR.type)) { dmg += 2; }
    }
    // Greg (49) — Chase: if Greg has more HP than the opposing ghost, winning rolls deal 2X damage.
    // Matches index.html lines 9305–9311: `if (wF.id===49 && !wF.ko && wF.hp>lF.hp) { dmg*=2; collectKC(...); }`
    if (wF.id === 49 && !wF.ko && wF.hp > lF.hp) { dmg *= 2; }
    // Wim (65) — Slash: all winning dice odd → +5 damage. Matches index.html lines 9191–9199 collectKC call.
    if (wF.id === 65 && !wF.ko && winDice.length > 0 && winDice.every(d => d % 2 === 1)) { dmg += 5; }
    // Snorton (67) — Fissure: two or more 6s in winning dice → +5 damage. Matches index.html lines 9205–9211.
    if (wF.id === 67 && !wF.ko && winDice.filter(d => d === 6).length >= 2) { dmg += 5; }
    // Stone Cold (73) — One-two-one!: two or more 1s in winning dice → 3X damage. Matches index.html lines 9128–9136.
    if (wF.id === 73 && !wF.ko && winDice.filter(d => d === 1).length >= 2) { dmg *= 3; }
    // The Mountain King (110) — Beast Mode: doubles win → 2X damage. Matches index.html lines 9118–9126.
    if (wF.id === 110 && !wF.ko && wR.type === 'doubles') { dmg *= 2; }
    // Doom (112) — Fiendship: every win deals +2 bonus damage (unconditional). Matches index.html lines 9188–9193.
    if (wF.id === 112 && !wF.ko) { dmg += 2; }
    // Doc (42) — Savage: doubles win → +5 bonus damage. Matches index.html lines 9224–9233.
    if (wF.id === 42 && !wF.ko && wR.type === 'doubles') { dmg += 5; }
    // Alucard (38) — Colony Call: doubles win → +2 damage per alive sideline ghost. Once per game.
    // Matches index.html lines 9261–9268: checks !B.alucardUsed[winTeamName], counts alive sideline ghosts.
    if (wF.id === 38 && !wF.ko && wR.type === 'doubles' && !B.alucardUsed[winTeamName]) {
      const alucardSl = wTeam.ghosts.filter((g, i) => i !== wTeam.activeIdx && !g.ko).length;
      if (alucardSl > 0) { dmg += alucardSl * 2; B.alucardUsed[winTeamName] = true; }
    }
    // Charlie (18) — Rush: double 2s → exactly 7 damage (override, not additive).
    // Matches index.html lines 9238–9244: `if (wF.id===18 && !wF.ko && wR.type==='doubles' && wR.value===2) { dmg=7; }`
    if (wF.id === 18 && !wF.ko && wR.type === 'doubles' && wR.value === 2) { dmg = 7; }
    // Bill & Bob (36) — Bait n Switch: while below 4 HP, winning rolls deal 2X damage.
    // Matches index.html lines 9249–9255: `if (wF.id===36 && !wF.ko && wF.hp<4) { dmg *= 2; }`
    if (wF.id === 36 && !wF.ko && wF.hp < 4) { dmg *= 2; }
    // Castle Guards (39) — Flamethrower: each 3 in winning dice multiplies damage by 2 (stacking).
    // e.g. one 3 = 2X, two 3s = 4X, three 3s = 8X. Only fires when at least one 3 is rolled.
    // Matches index.html lines 9278–9287: `threeCount = winDice.filter(d=>d===3).length; for t of threeCount: dmg *= 2`
    if (wF.id === 39 && !wF.ko && winDice.length > 0) {
      const cgThrees = winDice.filter(d => d === 3).length;
      if (cgThrees > 0) { for (let t = 0; t < cgThrees; t++) dmg *= 2; }
    }
    // Larry (35) — Flying Kick: triples win → 3X damage. Matches index.html lines 9130–9136.
    if (wF.id === 35 && !wF.ko && wR.type === 'triples') { dmg *= 3; }
    // Chip (16) — Acrobatic Dive: even doubles win → +3 damage (paired value is 2, 4, or 6, and dmg > 0).
    // Matches index.html lines 9585–9591: `wR.type==='doubles' && dmg>0 && wR.value%2===0`.
    if (wF.id === 16 && !wF.ko && wR.type === 'doubles' && dmg > 0 && wR.value % 2 === 0) { dmg += 3; }
    // Yawn Eater (464) — Feast: odd doubles +1 damage
    if (wF.id === 464 && !wF.ko && wR.type === 'doubles' && dmg > 0 && wR.value % 2 === 1) { dmg += 1; }
    // Ancient Librarian (3) — Knowledge: +1 damage for each 2 rolled by BOTH teams combined (only when AL wins and dmg > 0).
    // Matches index.html lines 9598–9606: count all 2s in [...winDice, ...loseDice], add to dmg.
    if (wF.id === 3 && !wF.ko && dmg > 0 && winDice) {
      const libTwos = [...winDice, ...(winner === 'red' ? blueDice : redDice)].filter(d => d === 2).length;
      if (libTwos > 0) dmg += libTwos;
    }
    // Buttons (8) — Perfect Plan: triple 6s (3+ sixes in winning dice) → +15 damage. Matches index.html lines 9143–9149.
    if (wF.id === 8 && !wF.ko && winDice.filter(d => d === 6).length >= 3) { dmg += 15; }
    // Nikon (2) — Ambush: win first roll → 3X damage. Matches index.html lines 9155–9161.
    // nikonIsFirstRoll is captured above before _rolledOnce is set — correct for starters AND KO-swap replacements.
    if (wF.id === 2 && !wF.ko && nikonIsFirstRoll) { dmg *= 3; }
    // Cave Dweller (46) — Lurk: win first roll → 3X damage. Matches index.html lines 9167–9173.
    if (wF.id === 46 && !wF.ko && caveDwellerIsFirstRoll) { dmg *= 3; }
    // Lou (32) BROS! — while on sideline, Grawr (id=34) active wins: +1 damage + +1 HP grant below.
    // Cornelius (45) on enemy sideline blocks both bonuses. Matches index.html lines 9566–9577.
    let louBrosActive = false;
    if (hasSideline(wTeam, 32) && wF.id === 34 && !wF.ko && !hasSideline(lTeam, 45)) {
      dmg += 1;
      louBrosActive = true;
    }
    // Tabitha (95) — Rally: while on sideline, +2 damage to active ghost's doubles wins.
    // Cornelius (45) on losing team sideline blocks it. Matches index.html lines 9439–9450.
    if (hasSideline(wTeam, 95) && !wF.ko && wR.type === 'doubles' && !hasSideline(lTeam, 45)) { dmg += 2; }
    // Admiral (71) — Comrades: while on sideline, +2 damage on even doubles wins.
    // "Even doubles" = wR.type === 'doubles' AND wR.value % 2 === 0 (the paired face is 2, 4, or 6).
    // Cornelius (45) on losing team sideline blocks it. Matches index.html lines 9452–9467.
    if (hasSideline(wTeam, 71) && !wF.ko && wR.type === 'doubles' && wR.value % 2 === 0 && !hasSideline(lTeam, 45)) { dmg += 2; }
    // Pelter (86) — Snowball: doubles win → +2 bonus damage. Matches index.html lines 9228–9234.
    if (wF.id === 86 && !wF.ko && wR.type === 'doubles') { dmg += 2; }
    // Dark Jeff (74) — Cackle: while on sideline, +1 damage to ALL your wins (no roll-type condition).
    // Cornelius (45) on enemy sideline blocks it. Matches index.html lines 9469–9482.
    if (hasSideline(wTeam, 74) && !wF.ko && !hasSideline(lTeam, 45)) { dmg += 1; }
    // Bandit Pete (93) — Bandit: while on sideline, if either player rolled only 2 dice → +3 damage.
    // Cornelius (45) on enemy sideline blocks it. Matches index.html lines 9550–9564.
    if (hasSideline(wTeam, 93) && !wF.ko && (redDice.length === 2 || blueDice.length === 2) && !hasSideline(lTeam, 45)) { dmg += 3; }
    // Pale Nimbus (88) — Hidden Storm: while on sideline, +2 damage if winning dice sum < 7.
    // Cornelius (45) on enemy sideline blocks it. Matches index.html lines 9499–9511.
    if (hasSideline(wTeam, 88) && !wF.ko && winDice && winDice.reduce((s,d)=>s+d,0) < 7 && !hasSideline(lTeam, 45)) { dmg += 2; }
    // Zach (87) — Craftsman: while on sideline, Guard Thomas (41) active doubles win → +3 damage.
    // Cornelius (45) on enemy sideline blocks it. Matches index.html lines 9566–9578.
    if (hasSideline(wTeam, 87) && wF.id === 41 && !wF.ko && wR.type === 'doubles' && !hasSideline(lTeam, 45)) { dmg += 3; }
    // Laura (79) — Catchy Tune: Sideline & In Play: straight unlocks permanent die-lock.
    // AI auto-locks highest die. Check both winner and loser for straight activation.
    if (!B.catchyTuneUnlocked[winner] && hasAlive(wTeam, 79) && winDice && isStraight(winDice) && !hasSideline(lTeam, 45)) {
      B.catchyTuneUnlocked[winner] = true;
    }
    const loser = winner === 'red' ? 'blue' : 'red';
    if (!B.catchyTuneUnlocked[loser] && hasAlive(lTeam, 79) && loseDice && isStraight(loseDice) && !hasSideline(wTeam, 45)) {
      B.catchyTuneUnlocked[loser] = true;
    }
    // AI locks highest die for next roll
    if (B.catchyTuneUnlocked[winner] && winDice && winDice.length > 0) {
      B.catchyTuneLockedDie[winner] = Math.max(...winDice);
    }
    if (B.catchyTuneUnlocked[loser] && loseDice && loseDice.length > 0) {
      B.catchyTuneLockedDie[loser] = Math.max(...loseDice);
    }
    // Bilbo (80) — Little Buddy: while on sideline, +2 damage to active ghost's singles wins.
    // Cornelius (45) on losing team sideline blocks it. Matches index.html lines 9484–9496.
    if (hasSideline(wTeam, 80) && !wF.ko && wR.type === 'singles' && !hasSideline(lTeam, 45)) { dmg += 2; }
    // Tommy Salami (30) — REGULATOR!: bonus dice from chain-6s were already added in the post-roll mutation block.
    // No win-path damage bonus — the extra dice ARE the benefit (more dice = higher hand type / more damage).
    // Kodako (1) — Swift WIN case: rolling 1-2-3 (all three values present in winDice) while winning → set dmg to exactly 4 (overrides all modifiers).
    // Matches index.html lines 9633–9640: `if (wF.id===1 && !wF.ko && winDice && [1,2,3].every(v=>winDice.includes(v))) { dmg=4; ... }`
    if (wF.id === 1 && !wF.ko && [1,2,3].every(v => winDice.includes(v))) {
      dmg = 4;
    }
    // Mirror Matt (410) — Seven Years: doubles ONLY damage reflected to attacker (1 HP, so singles kill him normally)
    let mirrorMattReflected = false;
    if (lF.id === 410 && !lF.ko && dmg > 0 && wR.type === 'doubles') {
      wF.hp = Math.max(0, wF.hp - dmg);
      if (wF.hp <= 0) { wF.ko = true; wF.killedBy = 410; }
      dmg = 0;
      mirrorMattReflected = true;
    }
    // Garrick (427) — Watchfire: Lose: -1 damage (damage reduction)
    if (lF.id === 427 && !lF.ko && dmg > 0) {
      dmg = Math.max(0, dmg - 1);
    }
    // Gordok (430) — River Terror: Win: steal 2 resources instead of dealing damage
    let gordokStole = false;
    if (wF.id === 430 && !wF.ko && dmg > 0) {
      const gordokResTypes = ['ice', 'fire', 'surge', 'luckyStone', 'moonstone', 'healingSeed'];
      const gordokTotalRes = gordokResTypes.reduce((sum, r) => sum + (lTeam.resources[r] || 0), 0);
      if (gordokTotalRes > 0) {
        let gordokStolen = 0;
        for (let i = 0; i < 2 && gordokStolen < 2; i++) {
          const avail = gordokResTypes.filter(r => (lTeam.resources[r] || 0) > 0);
          if (avail.length === 0) break;
          const pick = avail[Math.floor(Math.random() * avail.length)];
          lTeam.resources[pick]--;
          wTeam.resources[pick] = (wTeam.resources[pick] || 0) + 1;
          gordokStolen++;
        }
        dmg = 0;
        gordokStole = true;
        // v674: Gordok gains +1 die next roll when he steals
        if (!B.gordokDieBonus) B.gordokDieBonus = { red: 0, blue: 0 };
        B.gordokDieBonus[winTeamName] = 1;
        // v677: Gordok also gains +1 Moonstone on steal
        wTeam.resources.moonstone++;
      }
    }
    // Pal Al (431) — Squall: Win: gain 4 Ice Shards instead of dealing damage (auto when ice < 6)
    let wiseAlSqualled = false;
    if (wF.id === 431 && !wF.ko && dmg > 0) {
      if ((wTeam.resources.ice || 0) < 6) {
        wTeam.resources.ice += 4;
        dmg = 0;
        wiseAlSqualled = true;
      }
    }
    // Sophia (457) — Masquerade: Win: gain Mask of Day or Mask of Night instead of dealing damage (once per game)
    // AI strategy: pick Mask of Night if enemy has high dice potential, otherwise Mask of Day for burn farming
    let sophiaMasqueraded = false;
    if (wF.id === 457 && !wF.ko && dmg > 0 && B.sophiaMask && !B.sophiaMask[winTeamName]) {
      // Check enemy dice potential — if opponent likely has 5+ dice, Night is better
      const enemyF = active(lTeam);
      const enemyHasBoosts = (lTeam.resources.surge || 0) > 0 || (B.foremanDieBonus && B.foremanDieBonus[lTeamName] > 0);
      const pickNight = enemyHasBoosts || Math.random() < 0.6; // lean toward Night but not always
      B.sophiaMask[winTeamName] = pickNight ? 'night' : 'day';
      B.sophiaMaskActive[winTeamName] = true;
      dmg = 0;
      sophiaMasqueraded = true;
    }
    // Cameron (25) — Unstoppable Force: Cameron's damage cannot be negated.
    // When Cameron wins, all negation abilities are bypassed — damage goes through.
    const cameronUnnegatable = (wF.id === 25 && !wF.ko);
    let kingJayReflected = false;
    let kingJayReflectDmg = 0;

    // Sylvia (313) — dodge check: roll 1 die, 6 = negate all damage (~16.7%)
    // abilityDesc: "When you lose a roll: roll 1 die. If you roll a 6, negate all damage."
    // doSylviaRoll() in index.html uses Math.floor(Math.random()*6)+1 — exactly 1 die.
    if (lF.id === 313 && !lF.ko && !cameronUnnegatable) {
      if ((Math.floor(Math.random()*6)+1) >= 5) dmg = 0; // 5 or 6 dodge
    }
    // Patrick (10) — Stone Form: losing to a singles roll → negate ALL incoming damage and deal 3 counter-damage to the winner.
    if (lF.id === 10 && !lF.ko && wR.type === 'singles' && dmg > 0 && !cameronUnnegatable) {
      dmg = 0;
      wF.hp = Math.max(0, wF.hp - 3);
      if (wF.hp <= 0) { wF.ko = true; wF.killedBy = lF.id; }
    }
    // Kodako (1) — Swift LOSE case: rolling 1-2-3 (all three values present in loseDice) while losing → negate all incoming damage, deal 4 counter-damage back to winner.
    // Matches index.html lines 9666–9673: `if (lF.id===1 && !lF.ko && loseDice && [1,2,3].every(v=>loseDice.includes(v)) && dmg>0) { dmg=0; ... deal 4 back to wF }`
    // loseDice is winner==='red' ? blueDice : redDice — computed inline since `loseDice` const isn't defined until the on-lose resource gains block below.
    if (lF.id === 1 && !lF.ko && dmg > 0 && !cameronUnnegatable && [1,2,3].every(v => (winner === 'red' ? blueDice : redDice).includes(v))) {
      dmg = 0;
      wF.hp = Math.max(0, wF.hp - 4);
      if (wF.hp <= 0) { wF.ko = true; wF.killedBy = lF.id; }
    }
    // Sky (72) — Elusive: if incoming damage > 2, negate entirely (pure big-hit shield; 1-2 dmg passes through).
    // Matches index.html lines 9705–9711: `if (lF.id===72 && !lF.ko && dmg>2) { dmg=0; collectKC(...); }`
    if (lF.id === 72 && !lF.ko && dmg > 2 && !cameronUnnegatable) { dmg = 0; }
    // Dealer (37) — House Rules: loser's dice in strict consecutive ascending order → negate all incoming damage.
    // e.g. [1,2,3], [2,3,4], [3,4,5], [4,5-6] — any length run that is perfectly sequential (≥2 dice).
    // Matches index.html lines 9690–9699: sort loseDice, check every(v,i) i===0||v===prev+1, then dmg=0.
    if (lF.id === 37 && !lF.ko && dmg > 0 && !cameronUnnegatable) {
      const _dD = (winner === 'red' ? blueDice : redDice).slice();
      if (isStraight(_dD)) { dmg = 0; }
    }
    // Dealer (37) — House Rules WIN: straight → +3 damage.
    if (wF.id === 37 && !wF.ko && dmg > 0) {
      const _dW = (winner === 'red' ? redDice : blueDice).slice();
      if (isStraight(_dW)) { dmg += 3; }
    }
    // Wanderer (4) — Curiosity: straight → +2 damage.
    if (wF.id === 4 && !wF.ko && dmg > 0) {
      const _wD = (winner === 'red' ? redDice : blueDice).slice();
      if (isStraight(_wD)) { dmg += 2; }
    }
    // City Cyboo (77) — Barrier: takes no damage from enemy doubles.
    // 1 HP defender immune to the most common win type. Matches index.html lines 9713–9723.
    if (lF.id === 77 && !lF.ko && wR.type === 'doubles' && dmg > 0 && !cameronUnnegatable) { dmg = 0; }
    // Guard Thomas (41) — Stoic: immune to singles when below 6 HP (his max). Matches index.html lines 9642–9649.
    if (lF.id === 41 && !lF.ko && lF.hp < 6 && wR.type === 'singles' && dmg > 0 && !cameronUnnegatable) { dmg = 0; }
    // Bogey (53) — Bogus: reactive reflect — AI always reflects when offered. If Bogey is the loser,
    // dmg > 0, and once-per-game bogeyUsed is false → reflect the full dmg back to the winner (dmg = 0).
    // Matches index.html lines 9675–9697: bogeyReflectResuming two-pass; sim skips the modal, always chooses 'yes'.
    // Counter-damage applied immediately (wF.hp deferred to onShow in real game, but sim applies synchronously).
    if (lF.id === 53 && !lF.ko && !B.bogeyUsed[lTeamName] && dmg > 0 && !cameronUnnegatable) {
      const bogeyReflDmg = dmg;
      dmg = 0;
      B.bogeyUsed[lTeamName] = true;
      wF.hp = Math.max(0, wF.hp - bogeyReflDmg);
      if (wF.hp <= 0) { wF.ko = true; wF.killedBy = lF.id; }
    }
    // Fang Undercover (7) — Skilled Coward: armed + incoming damage > 0 → negate all damage, swap Fang to sideline.
    // Fires after Bogey (same order as index.html lines 9812–9822).
    // In the real game the swap is a post-drain modal (fangUndercoverSwapPending); sim swaps synchronously.
    if (lF.id === 7 && !lF.ko && B.fangUndercoverArmed[lTeamName] && dmg > 0 && !cameronUnnegatable) {
      dmg = 0;
      B.fangUndercoverArmed[lTeamName] = false;
      // Fang retreats — pick best available sideline ghost as replacement
      const fuSlots = lTeam.ghosts.map((g, i) => ({ g, i })).filter(x => x.i !== lTeam.activeIdx && !x.g.ko);
      if (fuSlots.length > 0) {
        const fuBest = fuSlots.reduce((a, b) => b.g.hp > a.g.hp ? b : a);
        lTeam.activeIdx = fuBest.i;
        smartTriggerEntry(lTeam);
      }
    }
    // Clear any unused arm for both teams (mirrors index.html line 9822 post-check clear).
    B.fangUndercoverArmed[lTeamName] = false;
    B.fangUndercoverArmed[winTeamName] = false;

    // King Jay (106) — REFLECTION!: lose the roll & loser's dice total = 7 → reflect ALL damage back to the winner (dmg → 0).
    if (lF.id === 106 && !lF.ko && dmg > 0 && !cameronUnnegatable) {
      const _kjDice = winner === 'red' ? blueDice : redDice;
      if (_kjDice && _kjDice.length > 0 && _kjDice.reduce((a, b) => a + b, 0) === 7) {
        kingJayReflectDmg = dmg;
        dmg = 0;
        kingJayReflected = true;
        wF.hp = Math.max(0, wF.hp - kingJayReflectDmg);
        if (wF.hp <= 0) { wF.ko = true; wF.killedBy = lF.id; }
      }
    }

    // Cameron (25) — Unstoppable Force: negation is already blocked above via cameronUnnegatable flag.
    // No instant KO needed — damage just goes through normally.

    // Guardian Fairy (99) — Wish: reactive — AI auto-activates GF when damage would KO the active ghost
    // and fairy has more HP than the damage
    if (dmg > 0 && !kingJayReflected) {
      const gfG = getSidelineGhost(lTeam, 99);
      if (gfG && !gfG.ko && lF.hp - dmg <= 0 && gfG.hp > dmg) {
        // GF absorbs the damage instead
        const gfIdx = lTeam.ghosts.indexOf(gfG);
        gfG.hp = Math.max(0, gfG.hp - dmg);
        if (gfG.hp <= 0) { gfG.ko = true; gfG.killedBy = wF.id; }
        if (gfIdx !== -1) lTeam.activeIdx = gfIdx; // swap GF to active
        dmg = 0; // lF protected
      }
    }

    // Apply damage
    if (dmg > 0) {
      lF.hp = Math.max(0, lF.hp - dmg);
      if (lF.hp <= 0) { lF.ko = true; lF.killedBy = wF.id; }
    }

    // Jasper (428) — Flame Dive: Win: roll 1d6 bonus damage + 1 self-damage
    if (wF.id === 428 && !wF.ko) {
      const jasperBonusDie = Math.floor(Math.random() * 6) + 1;
      lF.hp = Math.max(0, lF.hp - jasperBonusDie);
      if (lF.hp <= 0 && !lF.ko) { lF.ko = true; lF.killedBy = 428; }
      wF.hp = Math.max(0, wF.hp - 1);
      if (wF.hp <= 0) { wF.ko = true; wF.killedBy = -1; }
    }

    // Bubble Boys (44) — Pop: whenever the opponent rolled triples on this round, Bubble Boys are instantly
    // defeated — even if Bubble Boys won the roll ("burst even in victory!").
    // Case 1: BB is the loser and the winner rolled triples → BB instantly KO'd.
    // Case 2: BB won the roll but the loser rolled triples → BB still pops regardless.
    // Matches index.html lines 9962–9988 (two-case check with bubbleBoysPopped flag + queueAbility callout).
    if (lF.id === 44 && !lF.ko && wR.type === 'triples') { lF.hp = 0; lF.ko = true; lF.killedBy = wF.id; }
    if (wF.id === 44 && !wF.ko && lR.type === 'triples') { wF.hp = 0; wF.ko = true; wF.killedBy = lF.id; }

    // Night Master (103) — Bullseye: win with doubles → instantly KO the first enemy sideline ghost with < 4 HP.
    // Fires on ANY doubles win — matches index.html lines 9990–10003:
    // `wF.id===103 && !wF.ko && wR.type==='doubles'` → find first non-active, non-ko'd loseTeam ghost with hp<4.
    if (wF.id === 103 && !wF.ko && wR.type === 'doubles') {
      const _nmTarget = lTeam.ghosts.find((g, i) => i !== lTeam.activeIdx && !g.ko && g.hp < 4);
      if (_nmTarget) { _nmTarget.hp = 0; _nmTarget.ko = true; _nmTarget.killedBy = 103; }
    }

    // Slicer (460) — Parting Gift: Sideline & In Play — win with quads+ → destroy any enemy sideline ghost.
    // Auto-picks highest-HP target. No HP restriction unlike Night Master.
    const slicerActive = wF.id === 460 && !wF.ko;
    const slicerSideline = hasSideline(wTeam, 460);
    if ((slicerActive || slicerSideline) && (wR.type === 'quads' || wR.type === 'penta' || wR.type.endsWith('-of-a-kind'))) {
      const slicerCandidates = lTeam.ghosts.filter((g, i) => i !== lTeam.activeIdx && !g.ko);
      if (slicerCandidates.length > 0) {
        const best = slicerCandidates.reduce((a, b) => b.hp > a.hp ? b : a);
        best.hp = 0; best.ko = true; best.killedBy = 460;
      }
    }

    // Prince Balatron (113) — Party Time: lose & survive → roll 1 counter die for damage against the winner.
    // Fires after main damage is applied so we can check whether Balatron actually survived (!lF.ko).
    // Winner must also still be alive (!wF.ko) — matches index.html line 9921 guard: `!lF.ko && !wF.ko`.
    // Counter die is 1–6; can KO the winner (wF.killedBy = lF.id).
    // Matches index.html lines 9921–9938 (balatronCounterDie pre-compute + B.balatronPending stash).
    if (lF.id === 113 && !lF.ko && !wF.ko) {
      const balatronDie = Math.floor(Math.random() * 6) + 1;
      wF.hp = Math.max(0, wF.hp - balatronDie);
      if (wF.hp <= 0) { wF.ko = true; wF.killedBy = lF.id; }
    }

    // Aunt Susan heal bonus — overclocks per Rule #9 (no Math.min cap)
    // When Filbert (59) is on the enemy sideline, he flips the heal into damage (MASK MERCHANT curse)
    ['red','blue'].forEach(tn => {
      if (B.auntSusanHealBonus[tn] > 0) {
        const f = active(B[tn]);
        const enemyT = tn === 'red' ? B.blue : B.red;
        if (!f.ko) {
          if (hasSideline(enemyT, 59)) {
            // Filbert flips Harvest Dance heal → damage
            f.hp = Math.max(0, f.hp - B.auntSusanHealBonus[tn] * 2);
            if (f.hp <= 0) { f.ko = true; f.killedBy = 59; }
          } else {
            f.hp += B.auntSusanHealBonus[tn] * 2; // overclocks! Rule #9 — do NOT add Math.min cap
          }
        }
      }
    });

    // On-win resource gains — Sandwiches (33) DEPENDABLE! mirrors Specials to lTeam when on their sideline
    const sandwichLose = hasSideline(lTeam, 33);
    if (wF.id === 209 && !wF.ko) { wTeam.resources.surge += 2;       if (sandwichLose) lTeam.resources.surge += 2; }       // Dart: +2 Surge
    if (wF.id === 307 && !wF.ko) { wTeam.resources.ice += 3; if (sandwichLose) { lTeam.resources.ice += 3; } } // Artemis: v674 — +3 Ice Shards (was Surge+Ice)
    if (wF.id === 342 && !wF.ko) {
      if (hasSideline(lTeam, 59)) {
        // Filbert (59) — Mask Merchant: flips Overclock heal → 1 damage (matches index.html filbertCursesWin path at line 10619)
        wF.hp = Math.max(0, wF.hp - 1);
        if (wF.hp <= 0) { wF.ko = true; wF.killedBy = 59; }
      } else {
        wF.hp++; // overclocks! Rule #9 — no cap
        wTeam.resources.healingSeed++; // v674: Calvin gains +1 Healing Seed on win
      }
    }
    if (wF.id === 336 && !wF.ko) { wTeam.resources.fire++;            if (sandwichLose) lTeam.resources.fire++;  }           // Humar Sacred Flame
    if (wF.id === 309 && !wF.ko) { wTeam.resources.healingSeed += 2;  if (sandwichLose) lTeam.resources.healingSeed += 2; }   // Aunt Susan: +2 seeds on win
    if (wF.id === 81  && !wF.ko) { wTeam.resources.ice += 2;          if (sandwichLose) lTeam.resources.ice += 2; }          // Spockles: VALLEY MAGIC! +2 Ice on win — matches index.html line 10538
    // Splinter (101) — Toxic Fumes: first win activates poison (chip damage fires pre-roll every subsequent round).
    // Matches index.html lines 9656–9661: `if (wF.id===101 && !wF.ko && !B.splinterActivated[winTeamName]) { B.splinterActivated[winTeamName]=true; }`
    if (wF.id === 101 && !wF.ko && !B.splinterActivated[winTeamName]) { B.splinterActivated[winTeamName] = true; }
    // Lucy (108) — Blue Fire: Win → gain 1 Sacred Fire (REWORKED 2026-04-12, swapped with Humar)
    if (wF.id === 108 && !wF.ko) { wTeam.resources.fire++;             if (sandwichLose) lTeam.resources.fire++; }
    // Lucy's Shadow (439) — Mentor: +1 extra Sacred Fire when Lucy (108) wins
    if (wF.id === 108 && !wF.ko && hasSideline(wTeam, 439)) { wTeam.resources.fire++; }
    // Gom Gom Gom (440) — Chaos: Win with doubles → gain 1 Sacred Fire (v685: moved from post-roll to win-path only)
    if (wF.id === 440 && !wF.ko && ['doubles','triples','quads','penta'].includes(wR.type)) { wTeam.resources.fire++; if (sandwichLose) lTeam.resources.fire++; }
    if (wF.id === 206 && !wF.ko) { wTeam.resources.ice++;             if (sandwichLose) lTeam.resources.ice++;   }           // Zain: ICE SHARD! +1 Ice on win — matches index.html line 10541
    if (wF.id === 58  && !wF.ko) { wTeam.resources.fire++;            if (sandwichLose) lTeam.resources.fire++;  }           // Ashley: BURNING SOUL! +1 Sacred Fire on win — matches index.html line 10557
    // Dylan (301) — Stained Glass: Win → gain 1 Burn
    // Dylan (301) Stained Glass — Sideline & In Play: winning rolls gain +1 Burn
    const hasDylanWinSim = (wF.id === 301 && !wF.ko) || hasSideline(wTeam, 301);
    if (hasDylanWinSim) { if (!wTeam.resources.burn) wTeam.resources.burn = 0; wTeam.resources.burn += 1; }
    // Selene (305) — Heart of the Hills: doubles win → choose 1 Healing Seed OR 2 Lucky Stones.
    // AI heuristic: pick 2 Lucky Stones (2 post-roll rerolls > 1 seed) unless Selene is at <½ HP,
    // in which case prefer a Healing Seed for future recovery value.
    // Sandwiches (33) on loser's sideline mirrors the chosen resources. Matches index.html doSeleneChoice.
    if (wF.id === 305 && !wF.ko && wR.type === 'doubles') {
      const _selSeed = wF.hp < Math.ceil(wF.maxHp / 2);
      if (_selSeed) { wTeam.resources.healingSeed += 2;   if (sandwichLose) lTeam.resources.healingSeed += 2;   }
      else          { wTeam.resources.luckyStone += 3; if (sandwichLose) lTeam.resources.luckyStone += 3; }
    }
    if (wF.id === 54  && !wF.ko && winDice.length >= 4) {                                                                    // Roger: TEMPEST! +3 Sacred Fires if 2+ pairs — matches index.html lines 10545-10556
      const _rc = {}; winDice.forEach(d => _rc[d] = (_rc[d]||0)+1);
      if (Object.values(_rc).filter(c => c >= 2).length >= 2) { wTeam.resources.fire += 3; if (sandwichLose) lTeam.resources.fire += 3; }
    }
    // Farmer Jeff (314) active OR sideline: sixes = seeds (+ DEPENDABLE! mirror)
    const hasFJWin = (wF.id === 314 && !wF.ko) || hasSideline(wTeam, 314);
    if (hasFJWin) {
      const sixes = winDice.filter(d => d === 6).length;
      if (sixes > 0) {
        wTeam.resources.healingSeed += sixes;
        if (sandwichLose) lTeam.resources.healingSeed += sixes; // DEPENDABLE! mirror
      }
    }
    // Gary (92) win-team: each 1 in winDice = +2 Ice Shards (v598: fires active OR sideline; v599: +2 per 1, was +1).
    // Active Gary fires regardless of Cornelius; sideline Gary blocked by Cornelius on enemy (lTeam) sideline.
    // Matches index.html lines 9608–9622, 10423–10429.
    const garyWinActive = wF.id === 92 && !wF.ko;
    const garyWinSide = !garyWinActive && hasSideline(wTeam, 92) && !hasSideline(lTeam, 45);
    if (garyWinActive || garyWinSide) {
      const ones = winDice.filter(d => d === 1).length;
      if (ones > 0) { wTeam.resources.ice += ones * 2; if (sandwichLose) lTeam.resources.ice += ones * 2; }
    }
    // Opa (48) — Rest: active ghost wins → +1 HP. Filbert (59) on enemy sideline flips to -1 damage.
    // Matches index.html lines 10563–10575 (filbertCursesWin = hasSideline(loseTeam, 59))
    if (wF.id === 48 && !wF.ko) {
      if (hasSideline(lTeam, 59)) { wF.hp = Math.max(0, wF.hp - 1); if (wF.hp <= 0) { wF.ko = true; wF.killedBy = 59; } }
      else { wF.hp++; } // overclocks! Rule #9 — no cap
    }
    // Villager (11) — Hospitality: sideline → active ghost +1 HP on win.
    // Cornelius (45) on enemy sideline blocks. Filbert (59) on enemy sideline flips to -1 damage.
    // Matches index.html lines 10578–10595 (corneliusBlocksRally first, filbertCursesWin second)
    if (hasSideline(wTeam, 11) && !wF.ko) {
      if (hasSideline(lTeam, 45)) { /* Cornelius blocks — no heal, no curse */ }
      else if (hasSideline(lTeam, 59)) { wF.hp = Math.max(0, wF.hp - 1); if (wF.hp <= 0) { wF.ko = true; wF.killedBy = 59; } }
      else { wF.hp++; } // overclocks! Rule #9 — no cap
    }
    // Jeffery (14) — Chuckle: sideline → active ghost +3 HP when winning roll DEFEATS the enemy (lF.ko).
    // "wins a battle" = KO, not just win-a-roll (v593 fix in index.html — sim must match).
    // Cornelius (45) on enemy sideline blocks. Filbert (59) on enemy sideline flips to -3 damage.
    // Matches index.html line 10712: hasSideline(winTeam, 14) && !wF.ko && lF.ko
    if (hasSideline(wTeam, 14) && !wF.ko && lF.ko) {
      if (hasSideline(lTeam, 45)) { /* Cornelius blocks — no heal, no curse */ }
      else if (hasSideline(lTeam, 59)) { wF.hp = Math.max(0, wF.hp - 3); if (wF.hp <= 0) { wF.ko = true; wF.killedBy = 59; } }
      else { wF.hp += 3; } // overclocks! Rule #9 — no cap
    }
    // Lou (32) BROS! — Grawr (34) active wins: +1 HP. Cornelius already blocked above (louBrosActive=false if Cornelius present).
    // Filbert (59) on enemy sideline flips to -1 damage. Matches index.html lines 10320–10334.
    if (louBrosActive && !wF.ko) {
      if (hasSideline(lTeam, 59)) { wF.hp = Math.max(0, wF.hp - 1); if (wF.hp <= 0) { wF.ko = true; wF.killedBy = 59; } }
      else { wF.hp++; } // overclocks! Rule #9 — no cap
    }
    // Troubling Haters (83) — Growing Mob: win with 4+ damage → +2 HP (overclocks per Rule #9).
    // Filbert (59) on enemy sideline flips the +2 heal to -2 damage. Matches index.html lines 10033–10050.
    if (wF.id === 83 && !wF.ko && dmg >= 4) {
      if (hasSideline(lTeam, 59)) { wF.hp = Math.max(0, wF.hp - 2); if (wF.hp <= 0) { wF.ko = true; wF.killedBy = 59; } }
      else { wF.hp += 2; } // overclocks! Rule #9 — no cap
    }
    // Flora (75) — Restore: roll doubles → +2 HP (win path, overclocks per Rule #9).
    // Filbert (59) on enemy sideline flips +2 heal → -2 damage. Matches index.html lines 9963–9973.
    if (wF.id === 75 && !wF.ko && wR.type === 'doubles') {
      if (hasSideline(lTeam, 59)) { wF.hp = Math.max(0, wF.hp - 2); if (wF.hp <= 0) { wF.ko = true; wF.killedBy = 59; } }
      else { wF.hp += 2; } // overclocks! Rule #9 — no cap
    }
    // Flora (75) — Restore: roll doubles → +2 HP even on a loss (overclocks per Rule #9).
    // Filbert (59) on wTeam (winner's sideline) flips +2 heal → -2 damage. Matches index.html lines 9975–9985.
    if (lF.id === 75 && !lF.ko && (winner === 'red' ? bR : rR).type === 'doubles') {
      if (hasSideline(wTeam, 59)) { lF.hp = Math.max(0, lF.hp - 2); if (lF.hp <= 0) { lF.ko = true; lF.killedBy = 59; } }
      else { lF.hp += 2; } // overclocks! Rule #9 — no cap
    }

    // Kairan (68) — Let's Dance: rolling doubles (win or loss) → +1 die next roll.
    // Fires for BOTH winner and loser independently — Kairan may be on either team.
    // Mirrors index.html win/loss-path block at lines 10762–10770.
    ['red','blue'].forEach(teamKey => {
      const f = active(B[teamKey]);
      if (f.id !== 68 || f.ko) return;
      const kaiRoll = teamKey === 'red' ? rR : bR;
      if (kaiRoll.type === 'doubles') {
        B.letsDanceBonus[teamKey] = (B.letsDanceBonus[teamKey] || 0) + 1;
      }
    });

    // On-lose resource gains — Sandwiches (33) DEPENDABLE! mirrors Specials to wTeam when on their sideline
    const sandwichWin = hasSideline(wTeam, 33);
    const loseDice = winner === 'red' ? blueDice : redDice;
    if (lF.id === 24 && dmg > 0) { lTeam.resources.fire++;    if (sandwichWin) wTeam.resources.fire++;   }  // Simon (24): Brew Time — dmg guard, no KO guard (matches index.html line 9998)
    if (lF.id === 29)            { lTeam.resources.ice++;     if (sandwichWin) wTeam.resources.ice++;    }  // Sad Sal (29): Tough Job — loss only, no dmg/KO guard (matches index.html line 10007)
    if (lF.id === 404 && !lF.ko) { lTeam.resources.surge++;   if (sandwichWin) wTeam.resources.surge++;  }  // Chagrin (404): Bitter End non-KO (matches index.html lines 10673–10675)
    // Gary (92) lose-team: each 1 in loseDice = +2 Ice Shards (v598: fires active OR sideline; v599: +2 per 1, was +1).
    // Active Gary fires regardless of Cornelius; sideline Gary blocked by Cornelius on win team (wTeam) sideline.
    // Matches index.html lines 9610–9627, 10797–10803.
    const garyLoseActive = lF.id === 92 && !lF.ko;
    const garyLoseSide = !garyLoseActive && hasSideline(lTeam, 92) && !hasSideline(wTeam, 45);
    if (garyLoseActive || garyLoseSide) {
      const ones = loseDice.filter(d => d === 1).length;
      if (ones > 0) { lTeam.resources.ice += ones * 2; if (sandwichWin) wTeam.resources.ice += ones * 2; }
    }
    // Farmer Jeff (314) lose-team active OR sideline: sixes in loseDice = seeds (v636 buff: fires on ANY 6, win OR lose).
    // Matches index.html lines 10193–10195 (game-state collectKC) and 10759–10764 (cinematic queueAbility + sandwichForWin mirror).
    const hasFJLose = (lF.id === 314 && !lF.ko) || hasSideline(lTeam, 314);
    if (hasFJLose) {
      const sixesLose = loseDice.filter(d => d === 6).length;
      if (sixesLose > 0) { lTeam.resources.healingSeed += sixesLose; if (sandwichWin) wTeam.resources.healingSeed += sixesLose; }
    }
    // Hugo (52) — WRECKAGE!: when Hugo takes real damage, the attacker loses 1 die next roll.
    // Set on winTeamName so the attacker's dice are reduced at the top of the NEXT round. Matches index.html line 10017.
    if (lF.id === 52 && dmg > 0) { B.hugoWreckage[winTeamName] = (B.hugoWreckage[winTeamName] || 0) + 1; }
    // Marcus (57) — GLACIAL POUNDING!: if Marcus takes 3+ real damage, the PLAYER gains +4 bonus dice next roll.
    // Fires even if Marcus dies — bonus carries to whoever comes in next.
    if (lF.id === 57 && dmg >= 3) { B.marcusGlacialBonus[loseTeamName] = (B.marcusGlacialBonus[loseTeamName] || 0) + 4; }
    // Floop (20) — MUCK!: win or lose (including KO), if opponent rolled doubles → they lose 1 die next round.
    // wF = winner (if Floop won, loser rolled lR); lF = loser (if Floop lost/died, winner rolled wR).
    // Uses wF/lF captured pre-damage — same as index.html lines 10844–10858. No !f.ko gate (Wyatt spec).
    if (wF.id === 20 && lR.type === 'doubles') { B.floopMuck[loseTeamName] = (B.floopMuck[loseTeamName] || 0) + 1; }
    if (lF.id === 20 && wR.type === 'doubles') { B.floopMuck[winTeamName] = (B.floopMuck[winTeamName] || 0) + 1; }
    // Logey (26) — HEINOUS!: win/lose — count opponent's 5+ dice, lock them out next roll.
    // Uses wF/lF captured pre-damage (no post-KO-swap reread). Mirrors index.html lines 10860–10876.
    if (wF.id === 26 && !wF.ko) { const locked26w = (loseDice || []).filter(d => d >= 5).length; if (locked26w > 0) B.logeyLockout[loseTeamName] = (B.logeyLockout[loseTeamName] || 0) + locked26w; }
    if (lF.id === 26 && !lF.ko) { const locked26l = (winDice  || []).filter(d => d >= 5).length; if (locked26l > 0) B.logeyLockout[winTeamName]  = (B.logeyLockout[winTeamName]  || 0) + locked26l;  }
    // Outlaw (43) — THIEF!: win/lose — if Outlaw rolled doubles, steal 1 enemy die next round.
    // "Farewell pattern": a dying Outlaw still plants the penalty (no !f.ko gate). Mirrors index.html lines 10800–10813.
    // B.outlawStolenDie is keyed by Outlaw's OWN team; COMPUTE DICE reduces the enemy's count.
    if (wF.id === 43 && wR.type === 'doubles') { B.outlawStolenDie[winTeamName]  = (B.outlawStolenDie[winTeamName]  || 0) + 1; }
    if (lF.id === 43 && lR.type === 'doubles') { B.outlawStolenDie[loseTeamName] = (B.outlawStolenDie[loseTeamName] || 0) + 1; }
    // Suspicious Jeff (61) — SNICKER!: sideline passive — when your ghost DEFEATS an enemy ghost (lF.ko), steal 1 die next round.
    // "Wins a battle" = KO, NOT just win-a-roll (v593 Wyatt clarification). Matches index.html lines 10883–10891.
    // B.jeffSnicker[winTeamName] is consumed by COMPUTE DICE: enemy loses a die AND Jeff's team gains one (true steal/transfer).
    if (hasSideline(wTeam, 61) && !wF.ko && lF.ko) { B.jeffSnicker[winTeamName] = (B.jeffSnicker[winTeamName] || 0) + 1; }
    // Scallywags (19) — FRENZY!: win/loss — if own dice are all under 4, gain +1 die next turn.
    // Uses wF/lF captured pre-damage (no post-KO-swap reread). Mirrors index.html lines 10830–10841.
    if (wF.id === 19 && !wF.ko && winDice && winDice.every(d => d < 4)) { B.scallywagsFrenzyBonus[winTeamName] = (B.scallywagsFrenzyBonus[winTeamName] || 0) + 1; }
    if (lF.id === 19 && !lF.ko && loseDice && loseDice.every(d => d < 4)) { B.scallywagsFrenzyBonus[loseTeamName] = (B.scallywagsFrenzyBonus[loseTeamName] || 0) + 1; }
    // Dream Cat (28) — JINX!: non-tie — triggers only when BOTH teams rolled doubles this round.
    // Check wR.type and lR.type simultaneously (unlike tie path where they're always equal).
    // Mirrors index.html lines 10815–10827. Uses pre-damage wF/lF captures; !f.ko gate retained to match spec.
    if (wR.type === 'doubles' && lR.type === 'doubles') {
      if (wF.id === 28 && !wF.ko) B.dreamCatBonus[winTeamName]  = (B.dreamCatBonus[winTeamName]  || 0) + 1;
      if (lF.id === 28 && !lF.ko) B.dreamCatBonus[loseTeamName] = (B.dreamCatBonus[loseTeamName] || 0) + 1;
    }
    // Haywire (78) — WILD CHORDS!: win/loss — triples or better grants +1 permanent die AND Haywire +2 damage (once per game).
    // Fires on both win and loss paths — Haywire earns the bonus regardless of who won. Mirrors index.html lines 10801–10813.
    if (['triples','quads','penta'].includes(wR.type) && wF.id === 78 && !wF.ko && !B.haywireUsed[winTeamName]) {
      B.haywireBonus[winTeamName] = (B.haywireBonus[winTeamName] || 0) + 1;
      B.haywireDamageBonus[winTeamName] = 2;
      B.haywireUsed[winTeamName] = true;
    }
    if (['triples','quads','penta'].includes(lR.type) && lF.id === 78 && !lF.ko && !B.haywireUsed[loseTeamName]) {
      B.haywireBonus[loseTeamName] = (B.haywireBonus[loseTeamName] || 0) + 1;
      B.haywireDamageBonus[loseTeamName] = 2;
      B.haywireUsed[loseTeamName] = true;
    }

    // Sable (413) — Smoldering Soul: all odd dice → +1 Sacred Fire (active or sideline, win/loss path)
    ['red','blue'].forEach(teamKey => {
      const _f = active(B[teamKey]);
      const sableDice = teamKey === 'red' ? redDice : blueDice;
      const hasSableActive = _f.id === 413 && !_f.ko;
      const hasSableSideline = hasSideline(B[teamKey], 413);
      if ((hasSableActive || hasSableSideline) && sableDice && sableDice.length > 0 && sableDice.every(d => d % 2 === 1)) {
        B[teamKey].resources.fire++;
      }
    });
    // Pip (418) — Toasted: triples+ → remove 1 enemy die permanently + 2 Sacred Fires (once per game, win/loss path)
    ['red','blue'].forEach(teamKey => {
      const _f = active(B[teamKey]);
      const pipRoll = teamKey === 'red' ? rR : bR;
      if (_f.id === 418 && !_f.ko && isTripleOrBetter(pipRoll.type) && B.pipToastedUsed && !B.pipToastedUsed[teamKey]) {
        B.pipToastedUsed[teamKey] = true;
        const oppName = teamKey === 'red' ? 'blue' : 'red';
        B.pipDieRemoval[oppName] = (B.pipDieRemoval[oppName] || 0) + 1;
        B[teamKey].resources.fire += 2;
      }
    });
    // Chester (426) — Well Read: Win: singles → +1 Healing Seed, doubles+ → +1 Magic Firefly
    if (wF.id === 426 && !wF.ko) {
      const chesterIsDoubles = ['doubles','triples','quads','penta'].includes(wR.type);
      if (chesterIsDoubles) {
        wTeam.resources.firefly = (wTeam.resources.firefly || 0) + 1;
      } else {
        wTeam.resources.healingSeed++;
      }
    }
    // Starling (441) — Moonbeam: Win with doubles+ → +1 Moonstone + 1 Magic Firefly
    if (wF.id === 441 && !wF.ko && ['doubles','triples','quads','penta'].includes(wR.type)) {
      wTeam.resources.luckyStone++;
      wTeam.resources.firefly = (wTeam.resources.firefly || 0) + 1;
      // Sandwiches mirror for Lucky Stone only (Fireflies are not mirrorable)
      const sandwichLose = hasSideline(lTeam, 33);
      if (sandwichLose) { lTeam.resources.luckyStone++; }
    }
    // Zippa (423) — Glimmer: v674 rework — moved to pre-roll section

    // Harvey (448) — Harvest Moon: Win: gain +1 Moonstone for each 5 you rolled
    if (wF.id === 448 && !wF.ko) {
      const fives = winDice.filter(d => d === 5).length;
      if (fives > 0) {
        wTeam.resources.moonstone += fives;
        // Sandwiches mirror for Moonstone
        const sandwichLoseH = hasSideline(lTeam, 33);
        if (sandwichLoseH) { lTeam.resources.moonstone += fives; }
      }
    }

    // On-KO triggers
    // Granny (310) BEDTIME STORY! — resource based on WINNER's roll type (matches index.html lines 10811–10826)
    // singles → 2 Lucky Stones, doubles → 1 Moonstone, triples+ → 3 Sacred Fires
    if (lF.ko) {
      if (hasSideline(lTeam, 310)) {
        if (wR.type === 'singles') lTeam.resources.luckyStone += 2;           // matches index.html line 10815: luckyStone += 2
        else if (wR.type === 'doubles') lTeam.resources.moonstone++;
        else if (['triples','quads','penta'].includes(wR.type)) lTeam.resources.fire += 3;
        // DEPENDABLE! mirror — Sandwiches (33) on wTeam grants wTeam the same consolation resources
        if (hasSideline(wTeam, 33)) {
          if (wR.type === 'singles') wTeam.resources.luckyStone += 2;         // matches index.html line 10816: luckyStone += 2
          else if (wR.type === 'doubles') wTeam.resources.moonstone++;
          else if (['triples','quads','penta'].includes(wR.type)) wTeam.resources.fire += 3;
        }
      }
      if (lF.id === 404) { lTeam.resources.surge++; if (sandwichWin) wTeam.resources.surge++; }  // Chagrin KO path (matches index.html lines 10690–10691)
      if (lF.id === 23)  { lTeam.resources.ice += 3; if (sandwichWin) wTeam.resources.ice += 3; }  // Powder FINAL GIFT! — KO → +3 Ice Shards + DEPENDABLE! mirror (matches index.html lines 10708–10712)
      // Garrick (427) — Watchfire: Win + KO → +1 Sacred Fire
      if (wF.id === 427 && !wF.ko) { wTeam.resources.fire++; }
      // Nyx & Bessie (415) — Moo! Caw!: sideline KO → 3 Healing Seeds
      if (hasSideline(wTeam, 415) && !wF.ko) { wTeam.resources.healingSeed += 4; }
      // Valkin the Grand (432) — Grand Spoils: active Valkin KO → full resource suite
      if (wF.id === 432 && !wF.ko) {
        wTeam.resources.fire += 1;
        wTeam.resources.ice += 2;
        wTeam.resources.luckyStone += 1;
        wTeam.resources.moonstone += 1;
        wTeam.resources.healingSeed += 2;
      }
      // Munch (66) — Scraps: win a KO → +4 HP (overclocks per Rule #9 — no Math.min cap).
      // Filbert (59) on loser's sideline flips +4 heal → -4 damage. Matches index.html lines 10059–10070.
      if (wF.id === 66 && !wF.ko) {
        if (hasSideline(lTeam, 59)) { wF.hp = Math.max(0, wF.hp - 4); if (wF.hp <= 0) { wF.ko = true; wF.killedBy = 59; } }
        else { wF.hp += 4; } // overclocks! Rule #9 — no cap
      }
      // Bo (109) — MIRACLE!: when Bo wins a KO, revive the first KO'd ally on Bo's sideline at 1 HP.
      // Matches index.html Miracle block. Critical for sim accuracy: without this, Bo sims systematically
      // undervalue her legendary ability to refuel the team after a KO.
      // v672 fix: removed Vela (432) Second Breath — id 432 is now Valkin the Grand (Grand Spoils, handled above).
      // Lucas (433) sideline — Kindling: revived ghost enters play, Bo to sideline, +1 die next roll.
      if (wF.id === 109 && !wF.ko) {
        const boReviveTarget = wTeam.ghosts.find((g, i) => i !== wTeam.activeIdx && g.ko);
        if (boReviveTarget) {
          boReviveTarget.ko = false;
          boReviveTarget.hp = 1;
          wTeam.resources.firefly = (wTeam.resources.firefly || 0) + 3;
          const lucasActive = hasSideline(wTeam, 433);
          if (lucasActive) {
            // Lucas Kindling: revived ghost enters play at 4 HP, Bo to sideline, +1 die
            boReviveTarget.hp += 3; // 1 + 3 = 4 HP total
            const revivedIdx = wTeam.ghosts.indexOf(boReviveTarget);
            if (revivedIdx !== -1) wTeam.activeIdx = revivedIdx;
            if (!B.lucasKindlingBonus) B.lucasKindlingBonus = { red: 0, blue: 0 };
            B.lucasKindlingBonus[wTeamName] = 1;
          }
        }
      }
      // Calvin & Anna (91) — TOBOGGAN!: when C&A scores a KO, AI swaps C&A to sideline and brings
      // in the highest-HP available sideline ghost. Matches index.html lines 11032–11034 (detection)
      // + doTobogganChoice (lines 5237–5275): winTeam.activeIdx = idx. C&A keeps their HP on sideline.
      // AI ALWAYS swaps when alive sideline exists — retreating after a KO is nearly always optimal
      // (preserves C&A's remaining HP while a fresh ghost comes in to face the opponent's next ghost).
      if (wF.id === 91 && !wF.ko) {
        const tobogganSideline = wTeam.ghosts
          .map((g, i) => ({ g, i }))
          .filter(x => x.i !== wTeam.activeIdx && !x.g.ko);
        if (tobogganSideline.length > 0) {
          const best = tobogganSideline.reduce((a, b) => b.g.hp > a.g.hp ? b : a);
          wTeam.activeIdx = best.i;
        }
      }
    }
    if (wF.ko && hasSideline(wTeam, 310)) {
      if (wR.type === 'singles') wTeam.resources.luckyStone++;
      else if (wR.type === 'doubles') wTeam.resources.moonstone++;
      else if (['triples','quads','penta'].includes(wR.type)) wTeam.resources.fire += 3;
      // DEPENDABLE! mirror — Sandwiches (33) on lTeam grants lTeam the same consolation resources
      if (hasSideline(lTeam, 33)) {
        if (wR.type === 'singles') lTeam.resources.luckyStone++;
        else if (wR.type === 'doubles') lTeam.resources.moonstone++;
        else if (['triples','quads','penta'].includes(wR.type)) lTeam.resources.fire += 3;
      }
    }

    // Fang Outside (6) — SKILLFUL COWARD!: after winning any roll, AI swaps Fang to sideline and brings
    // in the best available sideline ghost (highest HP). Matches index.html showFangOutsideModal →
    // doFangOutsideChoice: wF.id===6 win trigger, wTeam.activeIdx updated, triggerEntry fires for new ghost.
    // AI ALWAYS swaps when alive sideline exists — Fang is 2 HP, retreating is nearly always optimal.
    // No entry effects modeled in the swap (triggerEntry is a cinematic-only side effect in the sim).
    if (wF.id === 6 && !wF.ko) {
      const fangSideline = wTeam.ghosts
        .map((g, i) => ({ g, i }))
        .filter(x => x.i !== wTeam.activeIdx && !x.g.ko);
      if (fangSideline.length > 0) {
        const best = fangSideline.reduce((a, b) => b.g.hp > a.g.hp ? b : a);
        wTeam.activeIdx = best.i;
      }
    }

    // Winston (15) — SCHEME!: doubles win → AI force-swaps opponent's active ghost with their weakest
    // (lowest HP) sideline ghost. Matches index.html lines 11041–11084: winstonSchemeSideline built from
    // loseTeam sideline, doWinstonSchemeChoice sets loseTeam.activeIdx. AI always swaps when sideline
    // exists — bringing in the opponent's weakest ghost is optimal play for Winston.
    if (wF.id === 15 && !wF.ko) {
      const winstonTargets = lTeam.ghosts
        .map((g, i) => ({ g, i }))
        .filter(x => x.i !== lTeam.activeIdx && !x.g.ko);
      if (winstonTargets.length > 0) {
        const weakest = winstonTargets.reduce((a, b) => b.g.hp < a.g.hp ? b : a);
        lTeam.activeIdx = weakest.i;
      }
    }
  }

  // End-of-round: Maximo (302) +1 seed + 1 Lucky Stone + Sandwiches (33) DEPENDABLE! mirror
  ['red','blue'].forEach(teamKey => {
    const f = active(B[teamKey]);
    if (f.id === 302 && !f.ko) {
      B[teamKey].resources.healingSeed++;
      B[teamKey].resources.luckyStone++;
      const oppKey = teamKey === 'red' ? 'blue' : 'red';
      if (hasSideline(B[oppKey], 33)) { B[oppKey].resources.healingSeed++; B[oppKey].resources.luckyStone++; }
    }
  });

  // ===== KNIGHT TERROR (401) HEAVY AIR! + KNIGHT LIGHT (402) RETRIBUTION! =====
  // Passive reactions: each named ability the ENEMY uses → KT deals 2 HP to enemy active, KL stores +1 bonus die.
  // KL stores dice in B.retributionDice[teamKey]; consumed at START of NEXT round's COMPUTE DICE block.
  // Matches index.html: checkKnightEffects() → B.retributionDice[oppTeamName]++ → consumed line 6827.
  // Reactions are estimated from which known ability-firer cards were active/sideline on the enemy team this round.
  ['red','blue'].forEach(teamKey => {
    const knightTeam = B[teamKey];
    const knight = active(knightTeam);
    if (knight.ko || (knight.id !== 401 && knight.id !== 402)) return;
    const enemyKey = teamKey === 'red' ? 'blue' : 'red';
    const enemyTeam = B[enemyKey];
    const ef = active(enemyTeam);
    // NOTE: do NOT return early on ef.ko — KO-path reactions (Granny 310, Powder 23) need ef.ko === true.
    // Knight Terror damage is guarded below to skip already-KO'd ghosts.

    let rxns = 0;
    const winnerWasEnemy = (winner === enemyKey);
    const loserWasEnemy  = (winner === teamKey);
    // AUDIT #2 FIX: _eD/_kD must be declared BEFORE the winnerWasEnemy/loserWasEnemy blocks
    // that use them. They were previously declared at the bottom of this closure (line ~1186),
    // causing a TDZ ReferenceError on every win round — silently killing all dice-conditional
    // knight reactions (Kodako, Wim, Snorton, Doc, Alucard, Charlie, Larry, Chip, Buttons, etc.)
    const _eD = enemyKey === 'red' ? redDice : blueDice;  // enemy's dice this round
    const _kD = teamKey  === 'red' ? redDice : blueDice;  // knight's own-team dice this round

    // Pre-roll chip abilities (fire every round regardless of outcome)
    if (ef.id === 304) rxns++;                           // Ember Force SWARM!
    if (ef.id === 111 && !ef.ko) rxns++;                 // Shade HAUNT! (active, fires every round — matches index.html line 6650 checkKnightEffects call)
    if (hasSideline(enemyTeam, 205)) rxns++;             // Shade's Shadow MELTDOWN! (sideline closer)
    if (ef.id === 70 && ef.hp < knight.hp) rxns++;       // Katrina SEEKER! (fires when Katrina HP < knight HP — same condition as pre-roll block line ~224)
    if (ef.id === 315 && (B.harrisonExtraDie[enemyKey] || 0) > 0) rxns++;  // Harrison ASCEND! fires pre-roll when seeds committed → extra dice (matches index.html line 6787 checkKnightEffects call)
    // v672: Nick & Knack (409) KNICK KNACK! fires pre-roll when opponent has resources to steal
    if (ef.id === 409 && !ef.ko) { const oppRes = B[teamKey].resources; if (['ice','fire','surge','luckyStone','moonstone','healingSeed'].some(r => (oppRes[r]||0) > 0)) rxns++; }
    // v672: Chow (414) SECRET INGREDIENT! fires pre-roll when Chow has a Healing Seed
    if (ef.id === 414 && !ef.ko && (B[enemyKey].resources.healingSeed || 0) >= 1) rxns++;
    if (ef.id === 210 && !hasSideline(B[teamKey], 301)) {
      // Knight reaction ONLY fires in the forced-die-loss branch (opponent has <2 specials → must lose a die).
      // When opponent has ≥2 specials they choose to DISCARD instead — checkKnightEffects NOT called. Matches index.html line 6923.
      // Must check both pool AND committed (AI commits ice/fire/surge before this block; real game checks pre-commitment pool).
      const oR = B[teamKey].resources, oC = B.committed[teamKey];
      const oppSpecials = (oR.ice||0)+(oR.fire||0)+(oR.surge||0)+(oR.moonstone||0)+(oR.healingSeed||0)+(oR.luckyStone||0)+(oC.ice||0)+(oC.fire||0)+(oC.surge||0);
      if (oppSpecials < 2) rxns++;
    }

    // Win-path named abilities (only if the enemy team won this round)
    if (winnerWasEnemy) {
      if ([209,307,342,336,309,345,81,206,301].includes(ef.id) && !ef.ko) rxns++; // Dart PLUNDER!, Artemis STREAM!, Calvin OVERCLOCK!, Humar SACRED FLAME!, AuntSusan HARVEST DANCE!, RedHunter RUMBLE!, Spockles VALLEY MAGIC!, Zain ICE SHARD!, Dylan STAINED GLASS! — all require !wF.ko in index.html
      if (((ef.id === 314 && !ef.ko) || hasSideline(enemyTeam, 314)) && _eD.filter(d => d === 6).length > 0) rxns++;  // Farmer Jeff HARVEST! (active OR sideline win-path: only fires when ≥1 six in enemy's winning dice)
      if (ef.id === 48 && !ef.ko)  rxns++;                 // Opa REST! — active ghost wins → +1 HP; !ef.ko matches index.html line 10701: !wF.ko guard before checkKnightEffects
      if (hasSideline(enemyTeam, 11) && !ef.ko)  rxns++;  // Villager HOSPITALITY! fires only when active ghost is alive (matches index.html line 10703: !wF.ko guard)
      // Jeffery (14) CHUCKLE! intentionally NOT counted here.
      // CHUCKLE! only fires when lF.ko=true (kills), but at that moment the loser's active ghost is
      // already KO'd. checkKnightEffects()'s !oppActive.ko guard then silences the reaction (index.html
      // line 10723). Net effect in the real game: 0 reactions from CHUCKLE!, always.
      // Counting rxns++ here inflated Heavy Air / Retribution on every non-KO enemy win — a phantom +2 HP
      // damage per win-round that never actually fires in index.html.
      if (hasSideline(enemyTeam, 32) && ef.id === 34 && !ef.ko)  rxns++;  // Lou BROS! fires ONLY when Grawr (34) is the active ghost AND alive (matches index.html line 9665: wF.id === 34 && !wF.ko guard)
      // Fed and Hayden ETERNAL FLAME! — fires when winning team committed fire > 0 AND has Fed and Hayden alive (active or sideline)
      // Matches index.html line 10403: checkKnightEffects(winTeamName, 'Fed and Hayden') called from ETERNAL FLAME! queueAbility.
      // Uses enemyTeam.ghosts.some (not hasSideline) — Fed and Hayden can be active or sideline; matches line 10395 winTeam.ghosts.some().
      if (B.committed[enemyKey].fire > 0 && enemyTeam.ghosts.some(g => g.id === 406 && !g.ko)) rxns++;
      // Kodako (1) SWIFT! win case: fires when Kodako wins and rolled 1-2-3 (matches index.html line 9638 collectKC call)
      if (ef.id === 1 && !ef.ko && [1,2,3].every(v => _eD.includes(v))) rxns++;
      // Wim (65) SLASH! — fires when Wim wins and all his dice are odd (matches index.html line 9197 collectKC call)
      if (ef.id === 65 && !ef.ko && _eD.length > 0 && _eD.every(d => d % 2 === 1)) rxns++;
      // Snorton (67) FISSURE! — fires when Snorton wins with 2+ sixes (matches index.html line 9209 collectKC call)
      if (ef.id === 67 && !ef.ko && _eD.filter(d => d === 6).length >= 2) rxns++;
      // Doc (42) SAVAGE! — fires when Doc wins with doubles (matches index.html line 9231 collectKC call)
      if (ef.id === 42 && !ef.ko && classify(_eD).type === 'doubles') rxns++;
      // Alucard (38) COLONY CALL! — fires when Alucard wins with doubles and hasn't used Colony Call yet (once per game)
      // Matches index.html line 9263 collectKC: only fires when sideline > 0 AND not yet used.
      if (ef.id === 38 && !ef.ko && classify(_eD).type === 'doubles' && !B.alucardUsed[enemyKey]) rxns++;
      // Charlie (18) RUSH! — fires when Charlie wins with double 2s (matches index.html line 9242 collectKC call)
      if (ef.id === 18 && !ef.ko && classify(_eD).type === 'doubles' && classify(_eD).value === 2) rxns++;
      // Bill & Bob (36) BAIT N SWITCH! — fires when B&B wins while below 4 HP (matches index.html line 9253 collectKC call)
      if (ef.id === 36 && !ef.ko && ef.hp < 4) rxns++;
      // Castle Guards (39) FLAMETHROWER! — fires when CG wins with at least one 3 in their dice (matches index.html line 9284 collectKC call)
      if (ef.id === 39 && !ef.ko && _eD.filter(d => d === 3).length > 0) rxns++;
      // Larry (35) FLYING KICK! — fires when Larry wins with triples (matches index.html line 9134 collectKC call)
      if (ef.id === 35 && !ef.ko && classify(_eD).type === 'triples') rxns++;
      // Chip (16) ACROBATIC DIVE! — fires when Chip wins with even doubles (matched value is 2, 4, or 6) and dmg > 0 (matches index.html line 9589 collectKC call)
      if (ef.id === 16 && !ef.ko && classify(_eD).type === 'doubles' && classify(_eD).value % 2 === 0) rxns++;
      // Buttons (8) PERFECT PLAN! — fires when Buttons wins with 3+ sixes in winning dice (matches index.html line 9147 collectKC call)
      if (ef.id === 8 && !ef.ko && _eD.filter(d => d === 6).length >= 3) rxns++;
      // Stone Cold (73) ONE-TWO-ONE! — fires when Stone Cold wins with 2+ ones (matches index.html line 9134 collectKC call)
      if (ef.id === 73 && !ef.ko && _eD.filter(d => d === 1).length >= 2) rxns++;
      // Mountain King (110) BEAST MODE! — fires when Mountain King wins with doubles (matches index.html line 9125 collectKC call)
      if (ef.id === 110 && !ef.ko && classify(_eD).type === 'doubles') rxns++;
      // Doom (112) FIENDSHIP! — fires on any Doom win (unconditional collectKC, matches index.html line 9193)
      if (ef.id === 112 && !ef.ko) rxns++;
      // Nikon (2) AMBUSH! — fires on Nikon's first roll win. ef._wasFirstRoll was set in the win block before _rolledOnce was set. Matches index.html line 9159 collectKC call.
      if (ef.id === 2 && !ef.ko && ef._wasFirstRoll) rxns++;
      // Cave Dweller (46) LURK! — fires on Cave Dweller's first roll win. Matches index.html line 9171 collectKC call.
      if (ef.id === 46 && !ef.ko && ef._wasFirstRoll) rxns++;
      // Hector (96) PROTECTOR! — fires when Hector wins with singles. Matches index.html line 9348 collectKC call.
      if (ef.id === 96 && !ef.ko && classify(_eD).type === 'singles') rxns++;
      // Toby (97) PURE HEART! — fires when Toby wins and had declared Pure Heart this round.
      // B.pureHeartDeclared is still true here (state transition happens after knight block). Matches index.html line 9371 collectKC call.
      if (ef.id === 97 && !ef.ko && B.pureHeartDeclared[enemyKey] === true) rxns++;
      // Romy (114) VALLEY GUARDIAN! — fires when Romy wins and her prediction hits any winning die.
      // Matches index.html line 9366 collectKC(winTeamName, wF.name) inside the romyTriggered guard.
      if (ef.id === 114 && !ef.ko && B.romyPrediction) { const _rP = B.romyPrediction[enemyKey]; if (_rP != null && _rP !== -1 && _eD.includes(_rP)) rxns++; }
      // Ancient Librarian (3) KNOWLEDGE! — fires when AL wins and at least one 2 appears across BOTH teams' dice.
      // Matches index.html line 9604 collectKC(winTeamName, wF.name) call inside the `librarianTwos > 0` guard.
      if (ef.id === 3 && !ef.ko && [..._eD, ..._kD].filter(d => d === 2).length > 0) rxns++;
      // Admiral (71) COMRADES! — fires when winning team has Admiral on sideline and even doubles (matches index.html line 9464 collectKC call)
      // enemyTeam won (winnerWasEnemy=true), so _eD is the winner's dice — classify to check even doubles.
      if (hasSideline(enemyTeam, 71) && classify(_eD).type === 'doubles' && classify(_eD).value % 2 === 0) rxns++;
      // Dark Jeff (74) CACKLE! — fires when winning team has Dark Jeff on sideline (matches index.html line 9476 collectKC call)
      if (hasSideline(enemyTeam, 74)) rxns++;
      // Bandit Pete (93) BANDIT! — fires when winning team has Bandit Pete on sideline and either player rolled only 2 dice (matches index.html line 9560 collectKC call)
      if (hasSideline(enemyTeam, 93) && (_eD.length === 2 || _kD.length === 2)) rxns++;
      // Pale Nimbus (88) HIDDEN STORM! — fires when winning team has Pale Nimbus on sideline and winning dice sum < 7 (matches index.html line 9572 collectKC call); !ef.ko matches index.html's !wF.ko guard
      if (hasSideline(enemyTeam, 88) && !ef.ko && _eD.reduce((s,d)=>s+d,0) < 7) rxns++;
      // Zach (87) CRAFTSMAN! — fires when winning team has Zach on sideline and Guard Thomas (41) won with doubles (matches index.html line 9650: !wF.ko guard)
      if (hasSideline(enemyTeam, 87) && ef.id === 41 && !ef.ko && classify(_eD).type === 'doubles') rxns++;
      // Laura (79) CATCHY TUNE! — fires when winning team has Laura on sideline and winning dice are consecutive ascending (matches index.html line 9588: !wF.ko guard)
      if (hasSideline(enemyTeam, 79) && !ef.ko && _eD.length >= 2) { const _lS = [..._eD].sort((a,b)=>a-b); if (_lS.every((v,i)=>i===0||v===_lS[i-1]+1)) rxns++; }
      // Bilbo (80) LITTLE BUDDY! — fires when winning team has Bilbo on sideline and active ghost won with singles (matches index.html line 9557: !wF.ko guard)
      if (hasSideline(enemyTeam, 80) && !ef.ko && classify(_eD).type === 'singles') rxns++;
      // v672: new card knight reactions
      if (ef.id === 416 && !ef.ko && B.committed[enemyKey].surge > 0) rxns++;  // Rook CHARCOAL! win-path
      if (ef.id === 424 && !ef.ko) rxns++;  // Bigsby OMEN! win-path
      if (ef.id === 417 && !ef.ko && B.luckyStoneSpentThisTurn && B.luckyStoneSpentThisTurn[enemyKey] > 0) rxns++; // Twyla LUCKY DANCE!
      if (ef.id === 426 && !ef.ko) rxns++;  // Chester WELL READ! win-path
      if (ef.id === 423 && !ef.ko && (B[enemyKey].resources.healingSeed || 0) > 0) rxns++; // Zippa GLIMMER!
      if (ef.id === 428 && !ef.ko) rxns++;  // Jasper FLAME DIVE! win-path
      if (ef.id === 430 && !ef.ko) rxns++;  // Gordok RIVER TERROR! win-path
      if (ef.id === 431 && !ef.ko) rxns++;  // Pal Al SQUALL! win-path
      if (ef.id === 457 && !ef.ko && !(B.sophiaMask && B.sophiaMask[enemyKey])) rxns++;  // Sophia MASQUERADE! win-path (only if mask not yet claimed)
      if (ef.id === 432 && !ef.ko && active(B[teamKey]).ko) rxns++;  // Valkin GRAND SPOILS! on KO
      if (hasSideline(enemyTeam, 415) && !ef.ko && active(B[teamKey]).ko) rxns++;  // Nyx & Bessie MOO! CAW!
      if (ef.id === 427 && !ef.ko && active(B[teamKey]).ko) rxns++;  // Garrick WATCHFIRE! KO fire
    }
    // Lose-path named abilities (only if the enemy team lost this round)
    if (loserWasEnemy) {
      if ([24,29,404].includes(ef.id)) rxns++;            // Simon BREW TIME!, SadSal TOUGH JOB!, Chagrin BITTER END! (fire even when KO'd — matches index.html no-ko-guard triggers)
      if (ef.id === 313 && !ef.ko) rxns++;               // Sylvia PORPOISE! — alive-only; matches index.html lines 9480, 10513: !lF.ko guard on both dodge trigger sites
      if (ef.id === 23 && ef.ko) rxns++;                 // Powder FINAL GIFT! — fires only on KO (matches index.html line 10127 collectKC)
      if (ef.id === 52) rxns++;                          // Hugo WRECKAGE! — fires whenever Hugo loses (dmg > 0 approximated; nearly always true — matches index.html line 10019 collectKC)
      if (ef.id === 57) rxns++;                           // Marcus GLACIAL POUNDING! — fires even if Marcus dies (bonus goes to player, not Marcus)
      if (ef.id === 10 && !ef.ko && (teamKey === 'red' ? rR : bR).type === 'singles') rxns++; // Patrick STONE FORM! — fires when Patrick loses to singles (matches index.html line 9683 collectKC); teamKey is the WINNER's team, so their roll type is checked
      // Kodako (1) SWIFT! lose case: fires when Kodako loses and rolled 1-2-3 (matches index.html line 9671 collectKC call)
      if (ef.id === 1 && !ef.ko && [1,2,3].every(v => _eD.includes(v))) rxns++;
      // Sky (72) ELUSIVE! — fires when Sky loses to incoming dmg > 2 (doubles/triples/quads all deal ≥3 dmg).
      // Proxy: check winner's raw roll damage (wR.damage); doesn't include ice/fire boosts but is correct ~95% of cases.
      // Matches index.html line 9709 collectKC(loseTeamName, lF.name). teamKey is winner here (loserWasEnemy).
      if (ef.id === 72 && !ef.ko && (teamKey === 'red' ? rR : bR).damage > 2) rxns++;
      // Prince Balatron (113) PARTY TIME! — fires when Balatron loses and survives; counter die always fires. Matches index.html line 9927 collectKC call.
      if (ef.id === 113 && !ef.ko && !active(B[teamKey]).ko) rxns++;
      // Farmer Jeff (314) HARVEST! lose-team: fires when Jeff is active OR on sideline and enemy team LOST but rolled sixes.
      // v636 buff added this lose-team path; index.html line 10203-10205 collectKC(loseTeamName). Queued in v639.
      if (((ef.id === 314 && !ef.ko) || hasSideline(enemyTeam, 314)) && _eD.filter(d => d === 6).length > 0) rxns++;
    }
    // KO-path named abilities (fire on ANY KO of the enemy's active ghost — not restricted to loserWasEnemy)
    if (hasSideline(enemyTeam, 310) && ef.ko) rxns++;   // Granny BEDTIME STORY! fires whenever enemy's active ghost is KO'd (lF.ko or wF.ko self-KO — matches index.html collectKC calls at lines 10122, 10136)
    // Tie-path named abilities (only on ties)
    if (!winner && ((ef.id === 352 && !ef.ko) || hasSideline(enemyTeam, 352))) rxns++;  // Jimmy CHIRP! Sideline & In Play: tie → +3 Lucky Stones + 1 Magic Firefly
    if (!winner && hasSideline(enemyTeam, 303)) rxns++;  // Tweak and Twonk ROARING CROWD! sideline: tie → +4 Surge (no active-ghost ko guard in index.html line 8765 — sideline ability, no ef.ko needed)
    if (!winner && hasSideline(enemyTeam, 22) && !ef.ko) rxns++;  // Ancient One FRIEND TO ALL! sideline tie healer; !ef.ko matches index.html line 8939: `|| f.ko) return` guard on active ghost
    if (!winner && ef.id === 48 && !ef.ko) rxns++;        // Opa REST! tie-path: active tie → +1 HP; !ef.ko matches index.html line 8916: !f.ko guard (win-path guard was fixed in v646 — this is the separate tie-path entry)
    // Gary (92) fires for both win and lose sides on any rolled 1 (v598: active OR sideline)
    if ((ef.id === 92 && !ef.ko) || hasSideline(enemyTeam, 92)) rxns++;  // Gary LUCKY NOVICE! (active or sideline)

    // End-of-round named abilities (fire unconditionally, but still require alive ghost)
    if (ef.id === 302 && !ef.ko) rxns++;                 // Maximo NAP! (every round); !ef.ko matches index.html lines 10275 and 11007: `!f.ko` guards

    // Post-roll passive triggers — dice-conditional: use actual roll results for accuracy
    // Counting these unconditionally inflated knight reactions by ~6× (Kaplan) to ~18× (Natalia).
    // NOTE: _eD and _kD are now declared above (moved up to fix TDZ) — used here and in winnerWasEnemy/loserWasEnemy blocks.
    if (ef.id === 207 && _eD.includes(4)) rxns++;         // Hank TREMOR! fires only when Hank rolls a 4
    if (ef.id === 327 && hasEvenDoubles(_eD)) rxns++;     // Natalia MATERIALIZATION! fires only on even doubles
    if (ef.id === 308 && classify(_kD).type === 'doubles') rxns++;  // Kaplan POLLINATE! fires only when Kaplan's OPPONENT (=knight team) rolled doubles
    // v672: Sable (413) SMOLDERING SOUL! fires when all dice odd (active or sideline)
    if ((ef.id === 413 && !ef.ko) || hasSideline(enemyTeam, 413)) { if (_eD.length > 0 && _eD.every(d => d % 2 === 1)) rxns++; }
    // v672: Pip (418) TOASTED! fires on triples+ (once per game)
    if (ef.id === 418 && !ef.ko && isTripleOrBetter(classify(_eD).type) && B.pipToastedUsed && !B.pipToastedUsed[enemyKey]) rxns++;
    if (ef.id === 305 && winnerWasEnemy && classify(_eD).type === 'doubles') rxns++;  // Selene HEART OF THE HILLS! fires only on doubles win (~16.7% of rounds) — matches index.html doSeleneChoice line 4205 checkKnightEffects call
    if (ef.id === 311 && winnerWasEnemy && classify(_eD).type === 'doubles') rxns++;  // Pudge BELLY FLOP! fires on doubles win (~41.7% of wins) — matches index.html line 9102 collectKC call
    // Roger TEMPEST! fires on 4+ dice win with 2 distinct pairs — matches index.html lines 10546–10551
    if (ef.id === 54 && winnerWasEnemy && _eD.length >= 4) { const _dc = {}; _eD.forEach(d => _dc[d] = (_dc[d]||0)+1); if (Object.values(_dc).filter(c => c >= 2).length >= 2) rxns++; }
    // Dealer (37) HOUSE RULES! — fires when Dealer loses and his dice are in strict consecutive ascending order.
    // Uses _eD (enemy = loser's dice) for the sequential check. Matches index.html line 9696 collectKC call.
    if (ef.id === 37 && !ef.ko && _eD.length >= 2) {
      if (loserWasEnemy && isStraight(_eD)) rxns++; // Dealer lose: negate
      if (winnerWasEnemy && isStraight(_eD)) rxns++; // Dealer win: +3 damage
    }
    // City Cyboo (77) BARRIER! — fires when winner (knight's team, _kD) rolled doubles and City Cyboo lost.
    // Matches index.html line 9721 collectKC(loseTeamName, lF.name).
    if (loserWasEnemy && ef.id === 77 && !ef.ko && classify(_kD).type === 'doubles') rxns++;
    // Guard Thomas (41) STOIC! — fires when GT loses to singles while below 6 HP. Matches index.html line 10441 checkKnightEffects call.
    if (loserWasEnemy && ef.id === 41 && !ef.ko && ef.hp < 6 && (teamKey === 'red' ? rR : bR).type === 'singles') rxns++;
    // Bogey (53) BOGUS! — fires when Bogey reflects incoming damage (once per game). Matches index.html line 9694 collectKC call.
    if (loserWasEnemy && ef.id === 53 && !ef.ko && !B.bogeyUsed[enemyKey]) rxns++;  // only when reflect is still available
    // Team Zippy (40) TEAMWORK! — fires when Team Zippy wins with singles. Matches index.html line 9297 collectKC call.
    if (winnerWasEnemy && ef.id === 40 && !ef.ko && classify(_eD).type === 'singles') rxns++;
    // Greg (49) CHASE! — fires when Greg wins AND has more HP than the losing ghost. Matches index.html line 9309 collectKC call.
    if (winnerWasEnemy && ef.id === 49 && !ef.ko && ef.hp > active(B[teamKey]).hp) rxns++;
    // Kairan (68) LET'S DANCE! — fires whenever Kairan (on enemy side, alive) rolled doubles, win or loss or tie.
    // _eD is always the enemy team's dice for this iteration. Matches index.html checkKnightEffects calls at lines 8760, 10764.
    if (ef.id === 68 && !ef.ko && classify(_eD).type === 'doubles') rxns++;

    if (rxns <= 0) return;

    if (knight.id === 401) { // HEAVY AIR!: 2 HP damage per reaction to enemy active ghost
      if (!ef.ko) {          // Skip damage if ghost already KO'd (Granny/Powder trigger on KO'd ghost)
        ef.hp = Math.max(0, ef.hp - rxns * 2);
        if (ef.hp <= 0) { ef.ko = true; ef.killedBy = knight.id; }
      }
    } else {                 // RETRIBUTION! (402): +N bonus dice next roll — stored in B.retributionDice, consumed in COMPUTE DICE
      B.retributionDice[teamKey] = (B.retributionDice[teamKey] || 0) + rxns;
    }
  });

  // Reset committed
  B.committed.red = { ice:0, fire:0, surge:0, auntSusan:0, auntSusanHeal:0, harrison:0, zainBlade:0 };
  B.committed.blue = { ice:0, fire:0, surge:0, auntSusan:0, auntSusanHeal:0, harrison:0, zainBlade:0 };
  // Reset per-round once-use flags (matches index.html line 10955: pressureUsed reset each round)
  B.pressureUsed = { red: false, blue: false };
  B.jacksonUsedThisRound.red = false; B.jacksonUsedThisRound.blue = false;
  B.eloiseUsedThisRound.red = false; B.eloiseUsedThisRound.blue = false;
  // Reset Lucky Stone tracking for Twyla (417) Lucky Dance (matches index.html line 11486)
  if (B.luckyStoneSpentThisTurn) { B.luckyStoneSpentThisTurn.red = 0; B.luckyStoneSpentThisTurn.blue = 0; }
  if (B.preRollAbilitiesFiredThisTurn) { B.preRollAbilitiesFiredThisTurn.red = false; B.preRollAbilitiesFiredThisTurn.blue = false; }
  // Willow (435) — Joy of Painting: winner didn't lose, loser did (mirrors index.html line 12563)
  if (B.willowLostLast && winner) { B.willowLostLast[winner] = false; const loser = winner === 'red' ? 'blue' : 'red'; B.willowLostLast[loser] = true; }
  // Reset item swing toggles each round (player must actively choose to swing)
  if (B.flameBladeSwing) { B.flameBladeSwing.red = false; B.flameBladeSwing.blue = false; }
  if (B.iceBladeSwing) { B.iceBladeSwing.red = false; B.iceBladeSwing.blue = false; }
  // NOTE: B.darkWingUsedThisGame is intentionally NOT reset here — once per game, matches index.html darkWingUsedThisGame.
  // Toby (97) — Pure Heart: carry scheduled KO forward if declaration was active, then reset declaration.
  // Mirrors index.html lines 8971–8976 (tie path) + 11010–11015 (win/loss path): both run after the round resolves.
  ['red','blue'].forEach(tk => {
    if (B.pureHeartDeclared[tk] === true) B.pureHeartScheduledKO[tk] = true;
    B.pureHeartDeclared[tk] = null;
  });
  // Romy (114) — Valley Guardian: clear prediction after each round (new prediction next round).
  // Mirrors index.html lines 9357–9360: clears both teams' predictions at start of resolveRound.
  if (B.romyPrediction) { B.romyPrediction.red = null; B.romyPrediction.blue = null; }

  B.round++;
  setTimeout(() => smartSimRounds(gameNum), 0);
}

console.log('🧠 smartAutoPlay loaded! Run: smartAutoPlay(100)');
