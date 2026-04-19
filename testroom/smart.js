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
    committed: { red: { ice:0, fire:0, surge:0, auntSusan:0, auntSusanHeal:0, harrison:0 }, blue: { ice:0, fire:0, surge:0, auntSusan:0, auntSusanHeal:0, harrison:0 } },
    retributionDice: { red: 0, blue: 0 },
    pressureUsed: { red: false, blue: false },
    motherNatureSummer: { red: false, blue: false },
    blackoutNum: {},
    harrisonExtraDie: { red: 0, blue: 0 },
    auntSusanBonus: { red: false, blue: false },
    auntSusanHealBonus: { red: false, blue: false }
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

  // Bouril (201) — first roll locked to 1-2-3
  if (f.id === 201) f.hankFirstRoll = true;
  // Maximo (302) — first roll is 1 die
  if (f.id === 302) f.maximoFirstRoll = true;
  // Zain (206) — spend 2 ice for 1 moonstone
  if (f.id === 206 && team.resources.ice >= 2) {
    team.resources.ice -= 2;
    team.resources.moonstone++;
  }
  // Nerina (306) — 3 damage to enemy active
  if (f.id === 306) {
    const ef = active(enemy);
    if (!ef.ko) {
      ef.hp = Math.max(0, ef.hp - 3);
      if (ef.hp <= 0) { ef.ko = true; ef.killedBy = f.id; }
    }
  }
  // Timpleton (312) — if enemy HP > mine, deal 3
  if (f.id === 312) {
    const ef = active(enemy);
    if (!ef.ko && ef.hp > f.hp) {
      ef.hp = Math.max(0, ef.hp - 3);
      if (ef.hp <= 0) { ef.ko = true; ef.killedBy = f.id; }
    }
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
    // Bonus for entry damage dealers
    if (c.g.id === 306) score += 5; // Nerina: 3 entry damage
    if (c.g.id === 312) score += 3; // Timpleton: conditional 3 damage
    // Bonus for resource generators
    if ([209,307,309,336,362].includes(c.g.id)) score += 2;
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

  // Ember Force (304) — 1 pre-roll damage
  ['red','blue'].forEach(teamKey => {
    const team = B[teamKey];
    const f = active(team);
    const enemy = opp(team);
    if (f.id === 304 && !f.ko && !hasSideline(enemy, 301)) {
      const ef = active(enemy);
      if (!ef.ko) {
        ef.hp = Math.max(0, ef.hp - 1);
        if (ef.hp <= 0) { ef.ko = true; ef.killedBy = f.id; }
      }
    }
  });

  // Shade's Shadow (205) — sideline: 1 dmg if enemy < 4 HP
  ['red','blue'].forEach(teamKey => {
    const team = B[teamKey];
    const enemy = opp(team);
    if (hasSideline(team, 205) && !hasSideline(enemy, 301)) {
      const ef = active(enemy);
      if (!ef.ko && ef.hp < 4) {
        ef.hp = Math.max(0, ef.hp - 1);
        if (ef.hp <= 0) { ef.ko = true; ef.killedBy = 205; }
      }
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

    // Surge: spend up to 2
    const surgeToSpend = Math.min(r.surge, 2);
    if (surgeToSpend > 0) {
      B.committed[team].surge = surgeToSpend;
      r.surge -= surgeToSpend;
    }

    // Ice Shards: commit all
    if (r.ice > 0) {
      B.committed[team].ice = r.ice;
      r.ice = 0;
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

    // Aunt Susan (309): spend seeds for damage or heal
    if (f.id === 309 && !f.ko && r.healingSeed > 0) {
      if (f.hp <= f.maxHp * 0.4) {
        // Low HP: invest in healing
        const seeds = Math.min(r.healingSeed, 2);
        B.committed[team].auntSusanHeal = seeds;
        r.healingSeed -= seeds;
      } else {
        // Healthy: invest in damage
        const seeds = Math.min(r.healingSeed, 2);
        B.committed[team].auntSusan = seeds;
        r.healingSeed -= seeds;
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

  // Smithy (204) sideline: convert 2 ice/fire into moonstone
  ['red','blue'].forEach(teamKey => {
    const team = B[teamKey];
    if (hasSideline(team, 204)) {
      if (team.resources.ice >= 2) { team.resources.ice -= 2; team.resources.moonstone++; }
      if (team.resources.fire >= 2) { team.resources.fire -= 2; team.resources.moonstone++; }
    }
  });

  // ===== COMPUTE DICE COUNTS =====
  let redCount = 3, blueCount = 3;

  // Bouril (201) first roll override
  ['red','blue'].forEach(teamKey => {
    const f = active(B[teamKey]);
    if (f.id === 201 && f.hankFirstRoll) { f.hankFirstRoll = false; }
    if (f.id === 302 && f.maximoFirstRoll) {
      if (teamKey === 'red') redCount = 1; else blueCount = 1;
      f.maximoFirstRoll = false;
    }
  });

  // Timber (210) — opponent loses a die or 2 specials
  ['red','blue'].forEach(teamKey => {
    const team = B[teamKey];
    const f = active(team);
    if (f.id === 210 && !f.ko) {
      const oppKey = teamKey === 'red' ? 'blue' : 'red';
      const oppTeam = B[oppKey];
      const r = oppTeam.resources;
      const total = (r.ice||0) + (r.fire||0) + (r.surge||0) + (r.moonstone||0) + (r.healingSeed||0) + (r.luckyStone||0);
      if (total < 2) {
        if (oppKey === 'red') redCount = Math.max(1, redCount - 1);
        else blueCount = Math.max(1, blueCount - 1);
      } else {
        // AI: discard 2 cheapest specials rather than lose a die
        let discarded = 0;
        for (const res of ['luckyStone','ice','surge','healingSeed','fire','moonstone']) {
          while (r[res] > 0 && discarded < 2) { r[res]--; discarded++; }
          if (discarded >= 2) break;
        }
      }
    }
  });

  // Mother Nature (366) seasons
  ['red','blue'].forEach(teamKey => {
    const team = B[teamKey];
    const f = active(team);
    const oppKey = teamKey === 'red' ? 'blue' : 'red';
    if (f.id === 366 && !f.ko) {
      const season = B.round % 4;
      if (season === 1) f.hp = Math.min(f.maxHp, f.hp + 1);
      else if (season === 2) B.motherNatureSummer[teamKey] = true;
      else if (season === 3) team.resources.healingSeed++;
      else { if (oppKey === 'red') redCount = Math.max(1, redCount - 1); else blueCount = Math.max(1, blueCount - 1); }
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

  // Committed Surge adds dice
  redCount += B.committed.red.surge || 0;
  blueCount += B.committed.blue.surge || 0;

  // Aunt Susan bonuses
  B.auntSusanBonus = { red: false, blue: false };
  B.auntSusanHealBonus = { red: false, blue: false };
  ['red','blue'].forEach(team => {
    if (active(B[team]).id === 309) {
      if (B.committed[team].auntSusan > 0) B.auntSusanBonus[team] = B.committed[team].auntSusan;
      if (B.committed[team].auntSusanHeal > 0) B.auntSusanHealBonus[team] = B.committed[team].auntSusanHeal;
    }
  });

  // ===== ROLL DICE =====
  let redDice, blueDice;
  // Bouril override
  if (active(B.red).id === 201 && active(B.red).hankFirstRoll) {
    redDice = [1,2,3]; active(B.red).hankFirstRoll = false;
  } else {
    redDice = weightedRoll('red', redCount).sort((a,b)=>a-b);
  }
  if (active(B.blue).id === 201 && active(B.blue).hankFirstRoll) {
    blueDice = [1,2,3]; active(B.blue).hankFirstRoll = false;
  } else {
    blueDice = weightedRoll('blue', blueCount).sort((a,b)=>a-b);
  }

  // ===== POST-ROLL TRIGGERS =====
  // Hank (207) — each 4 = +1 Lucky Stone
  ['red','blue'].forEach(teamKey => {
    const t = B[teamKey]; const f = active(t);
    const dice = teamKey === 'red' ? redDice : blueDice;
    if (f.id === 207 && !f.ko) {
      const fours = dice.filter(d => d === 4).length;
      if (fours > 0) t.resources.luckyStone += fours;
    }
  });

  // Natalia (327) — even doubles = +1 moonstone
  ['red','blue'].forEach(teamKey => {
    const t = B[teamKey]; const f = active(t);
    const dice = teamKey === 'red' ? redDice : blueDice;
    if (f.id === 327 && !f.ko && hasEvenDoubles(dice)) t.resources.moonstone++;
  });

  // Kaplan (308) — opponent doubles = +1 seed
  ['red','blue'].forEach(teamKey => {
    const t = B[teamKey]; const f = active(t);
    const oppDice = teamKey === 'red' ? blueDice : redDice;
    if (f.id === 308 && !f.ko && classify(oppDice).type === 'doubles') t.resources.healingSeed++;
  });

  // ===== AI: MOONSTONE (change a die to improve hand) =====
  ['red','blue'].forEach(teamKey => {
    const t = B[teamKey];
    if (t.resources.moonstone > 0) {
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
        }
        if (teamKey === 'red') { redDice.splice(0, redDice.length, ...improved); }
        else { blueDice.splice(0, blueDice.length, ...improved); }
      }
    }
  });

  // ===== AI: LUCKY STONE (reroll lowest die) =====
  ['red','blue'].forEach(teamKey => {
    const t = B[teamKey];
    if (t.resources.luckyStone > 0) {
      const dice = teamKey === 'red' ? redDice : blueDice;
      const improved = smartLuckyStone(dice);
      t.resources.luckyStone--;
      if (teamKey === 'red') { redDice.splice(0, redDice.length, ...improved); }
      else { blueDice.splice(0, blueDice.length, ...improved); }
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
  let winner = null;
  if (typeRank[rR.type] > typeRank[bR.type]) winner = 'red';
  else if (typeRank[bR.type] > typeRank[rR.type]) winner = 'blue';
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

  // ===== TIE EFFECTS =====
  if (!winner) {
    // Tweak and Twonk (303) sideline: tie → +3 Surge
    ['red','blue'].forEach(teamKey => {
      if (hasSideline(B[teamKey], 303)) B[teamKey].resources.surge += 3;
    });
    // Jimmy (352) active: tie → +5 Lucky Stones
    ['red','blue'].forEach(teamKey => {
      const f = active(B[teamKey]);
      if (f.id === 352 && !f.ko) B[teamKey].resources.luckyStone += 5;
    });
    // Maximo (302) end-of-round: +1 seed
    ['red','blue'].forEach(teamKey => {
      const f = active(B[teamKey]);
      if (f.id === 302 && !f.ko) B[teamKey].resources.healingSeed++;
    });
  }

  // ===== APPLY DAMAGE =====
  if (winner) {
    const winTeamName = winner;
    const wTeam = B[winner], lTeamName = winner==='red'?'blue':'red', lTeam = B[lTeamName];
    const wF = active(wTeam), lF = active(lTeam);
    const wR = winner==='red'?rR:bR;
    const winDice = winner==='red' ? redDice : blueDice;
    let dmg = wR.damage;

    // Ice Shards
    dmg += B.committed[winTeamName].ice || 0;
    // Sacred Fire (+3 each)
    const fireCommitted = B.committed[winTeamName].fire || 0;
    dmg += fireCommitted * 3;
    // Eternal Flame (406) — don't discard sacred fires
    if (fireCommitted > 0 && wTeam.ghosts.some(g => g.id === 406 && !g.ko)) {
      wTeam.resources.fire += fireCommitted;
    }
    // Aunt Susan damage bonus (+2 per seed)
    if (B.auntSusanBonus[winTeamName] > 0) dmg += B.auntSusanBonus[winTeamName] * 2;
    // Mother Nature Summer (+1)
    if (B.motherNatureSummer[winTeamName]) { dmg += 1; B.motherNatureSummer[winTeamName] = false; }
    // Dusk (364) — after round 5: +1 damage
    if (wF.id === 364 && !wF.ko && B.round > 5) dmg += 1;
    // Pudge (311) — doubles: +2 damage, 1 self-damage
    if (wF.id === 311 && wR.type === 'doubles') {
      dmg += 2;
      wF.hp = Math.max(0, wF.hp - 1);
      if (wF.hp <= 0) { wF.ko = true; wF.killedBy = lF.id; }
    }
    // Red Hunter (345) — enemy has resources: +3 damage
    if (wF.id === 345) {
      const eRes = lTeam.resources;
      if ((eRes.moonstone + eRes.ice + eRes.fire + eRes.surge + eRes.healingSeed + eRes.luckyStone) > 0) dmg += 3;
    }
    // Sylvia (313) — dodge check
    if (lF.id === 313 && !lF.ko) {
      const dr = [Math.floor(Math.random()*6)+1, Math.floor(Math.random()*6)+1];
      if (dr.includes(6)) dmg = 0;
    }

    // Apply damage
    if (dmg > 0) {
      lF.hp = Math.max(0, lF.hp - dmg);
      if (lF.hp <= 0) { lF.ko = true; lF.killedBy = wF.id; }
    }

    // Aunt Susan heal bonus
    ['red','blue'].forEach(tn => {
      if (B.auntSusanHealBonus[tn] > 0) {
        const f = active(B[tn]);
        if (!f.ko) f.hp = Math.min(f.maxHp, f.hp + B.auntSusanHealBonus[tn] * 2);
      }
    });

    // On-win resource gains
    if (wF.id === 209 && !wF.ko) wTeam.resources.surge += 2;        // Dart: +2 Surge
    if (wF.id === 307 && !wF.ko) { wTeam.resources.surge++; wTeam.resources.ice++; } // Bridget
    if (wF.id === 342 && !wF.ko) wF.hp++;                            // Overclock: +1 HP
    if (wF.id === 336 && !wF.ko) wTeam.resources.fire++;              // Sacred Flame
    if (wF.id === 309 && !wF.ko) wTeam.resources.healingSeed++;       // Aunt Susan: +1 seed on win
    if (wF.id === 362 && !wF.ko) { wTeam.resources.healingSeed += 2; lTeam.resources.healingSeed++; }
    // Farmer Jeff (314) sideline: sixes = seeds
    if (hasSideline(wTeam, 314)) {
      const sixes = winDice.filter(d => d === 6).length;
      if (sixes > 0) wTeam.resources.healingSeed += sixes;
    }

    // On-lose resource gains
    if (lF.id === 404 && !lF.ko) lTeam.resources.surge++;

    // On-KO triggers
    if (lF.ko) {
      if (hasSideline(lTeam, 310)) {
        if (wR.type === 'singles') lTeam.resources.luckyStone++;
        else if (wR.type === 'doubles') lTeam.resources.surge++;
        else if (['triples','quads','penta'].includes(wR.type)) lTeam.resources.moonstone++;
      }
      if (lF.id === 404) lTeam.resources.surge++;
    }
    if (wF.ko && hasSideline(wTeam, 310)) {
      if (wR.type === 'singles') wTeam.resources.luckyStone++;
      else if (wR.type === 'doubles') wTeam.resources.surge++;
      else if (['triples','quads','penta'].includes(wR.type)) wTeam.resources.moonstone++;
    }
  }

  // End-of-round: Maximo (302) +1 seed
  ['red','blue'].forEach(teamKey => {
    const f = active(B[teamKey]);
    if (f.id === 302 && !f.ko) B[teamKey].resources.healingSeed++;
  });

  // Reset committed
  B.committed.red = { ice:0, fire:0, surge:0, auntSusan:0, auntSusanHeal:0, harrison:0 };
  B.committed.blue = { ice:0, fire:0, surge:0, auntSusan:0, auntSusanHeal:0, harrison:0 };
  B.motherNatureSummer = { red: false, blue: false };

  B.round++;
  setTimeout(() => smartSimRounds(gameNum), 0);
}

console.log('🧠 smartAutoPlay loaded! Run: smartAutoPlay(100)');
