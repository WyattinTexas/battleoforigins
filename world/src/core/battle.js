// BATTLE
// Battle system — encounters, dice engine, combat, UI
// Extracted from index.html — v7.4.0
// All functions and variables remain global.

// ═══════ ENCOUNTER SYSTEM ═══════

function getCard(id) { return ALL_CARDS.find(c => c.id === id); }

function getWildEncounter() {
  // Determine which region the player is in
  const inDarkCastle = Math.floor(G.x) > 88 && Math.floor(G.y) < 42;
  const inRollingHills = Math.floor(G.y) >= 45;
  const inVolcanicIsles = Math.floor(G.x) > 60 && Math.floor(G.y) < 43;
  const regionSets = inDarkCastle
    ? ['Dark Castle', 'Set 1']
    : inVolcanicIsles
    ? ['Volcanic Isles', 'Set 1']
    : inRollingHills
    ? ['Rolling Hills', 'Set 1']
    : ['Frost Valley', 'Set 1'];
  const fvCards = ALL_CARDS.filter(c => regionSets.includes(c.set) && c.rarity !== 'legendary');
  const weights = { common: 50, uncommon: 25, rare: 10, 'ghost-rare': 3 };

  // Scout discipline finds rarer
  if (G.discipline === 'scout') {
    weights.rare = 20;
    weights['ghost-rare'] = 8;
  }

  // Tracker skill: rare enemies 50% more frequent
  if (hasSkill('rng_2')) {
    weights.rare = Math.floor(weights.rare * 1.5);
    weights['ghost-rare'] = Math.floor(weights['ghost-rare'] * 1.5);
  }

  const weighted = [];
  for (const c of fvCards) {
    const w = weights[c.rarity] || 10;
    for (let i = 0; i < w; i++) weighted.push(c);
  }
  return weighted[Math.floor(Math.random() * weighted.length)];
}


// ═══════ DICE ENGINE ═══════

function rollDie() { return Math.floor(Math.random() * 6) + 1; }
function rollDice(n) { return Array.from({length: n}, () => rollDie()).sort((a,b) => a-b); }

// Weighted dice rolls for cinematic drama (from adventure engine)
function weightedRoll(ghost, count) {
  const dice = [];
  for (let i = 0; i < count; i++) dice.push(rollDie());
  if (!ghost) return dice.sort((a, b) => a - b);
  // Penta nudge: 5+ dice = 10% all match
  if (count >= 5 && Math.random() < 0.10) {
    const v = Math.ceil(Math.random() * 4) + 2;
    for (let i = 0; i < dice.length; i++) dice[i] = v;
    return dice.sort((a, b) => a - b);
  }
  // 1 HP: 25% forced doubles; 2 HP: 15%
  if (ghost.hp === 1 && Math.random() < 0.25) {
    const v = Math.ceil(Math.random() * 4) + 2;
    dice[0] = v; if (dice.length >= 2) dice[1] = v;
  } else if (ghost.hp === 2 && Math.random() < 0.15) {
    const v = Math.ceil(Math.random() * 4) + 2;
    dice[0] = v; if (dice.length >= 2) dice[1] = v;
  }
  // Low HP quality boost
  if (ghost.hp <= 2 && ghost.hp > 0 && dice.length >= 2) {
    const minIdx = dice.indexOf(Math.min(...dice));
    if (dice[minIdx] <= 2 && Math.random() < 0.30)
      dice[minIdx] = Math.ceil(Math.random() * 3) + 3;
  }
  return dice.sort((a, b) => a - b);
}

// Helper: count a specific die value
function countDieVal(dice, val) { return dice.filter(d => d === val).length; }
function isStraight(dice) {
  if (!dice || dice.length < 3) return false;
  const sorted = [...new Set(dice)].sort((a,b) => a - b);
  if (sorted.length < dice.length) return false; // no repeats allowed
  for (let i = 1; i < sorted.length; i++) { if (sorted[i] !== sorted[i-1] + 1) return false; }
  return true;
}

// Helper: get active ghost for a battle team side
function activePlayerGhost() { return B && B.player ? B.player.ghosts[B.player.activeIdx] : null; }
function activeEnemyGhost() { return B && B.enemy ? B.enemy.ghosts[B.enemy.activeIdx] : null; }

// Helper: get sideline ghosts for player team (from battle state)
function getSidelineGhosts() {
  if (!B || !B.player) return [];
  return B.player.ghosts.filter((g, i) => i !== B.player.activeIdx && !g.ko && g.hp > 0);
}

// Helper: get sideline ghosts for enemy team (from battle state)
function getEnemySidelineGhosts() {
  if (!B || !B.enemy) return [];
  return B.enemy.ghosts.filter((g, i) => i !== B.enemy.activeIdx && !g.ko && g.hp > 0);
}

// ═══════ RESOURCE COMMIT SYSTEM ═══════

function commitResource(type) {
  if (!B || B.phase !== 'ready') return;
  if (!B.resources || !B.resources[type] || B.resources[type] <= 0) return;

  if (!B.committed) B.committed = {};
  B.committed[type] = (B.committed[type] || 0) + 1;
  B.resources[type]--;

  renderBattle();
  if (typeof SFX !== 'undefined' && SFX.notify) SFX.notify();
}

function uncommitResource(type) {
  if (!B || B.phase !== 'ready') return;
  if (!B.committed || !B.committed[type] || B.committed[type] <= 0) return;

  B.committed[type]--;
  if (B.committed[type] <= 0) delete B.committed[type];
  B.resources[type] = (B.resources[type] || 0) + 1;

  renderBattle();
}

// Helper: check if team is fully defeated
function isTeamDefeated(team) {
  return team.ghosts.every(g => g.ko);
}

// KO swap check — returns 'continue', 'swapping', 'victory', or 'defeat'
function checkKO() {
  const pg = activePlayerGhost();
  const eg = activeEnemyGhost();

  const playerKO = pg && pg.ko;
  const enemyKO = eg && eg.ko;

  // Simultaneous KO: both active ghosts down at the same time
  if (playerKO && enemyKO) {
    const pAlive = B.player.ghosts.filter((g, i) => i !== B.player.activeIdx && !g.ko && g.hp > 0);
    const eAlive = B.enemy.ghosts.filter((g, i) => i !== B.enemy.activeIdx && !g.ko && g.hp > 0);
    if (pAlive.length === 0 && eAlive.length === 0) {
      // Both teams wiped — player wins (attacker advantage)
      B.phase = 'over';
      return 'victory';
    }
    if (pAlive.length === 0) {
      B.phase = 'over';
      return 'defeat';
    }
    if (eAlive.length === 0) {
      B.phase = 'over';
      return 'victory';
    }
    // Both have reserves: auto-swap enemy, then player picks
    const eNextIdx = B.enemy.ghosts.indexOf(eAlive[0]);
    doKoSwap('enemy', eNextIdx);
    if (pAlive.length === 1) {
      doKoSwap('player', B.player.ghosts.indexOf(pAlive[0]));
      return 'continue';
    }
    B.phase = 'ko-swap';
    B.koSwapTeam = 'player';
    B.log.push({ text: 'Choose your next Spiritkin!', type: 'ability' });
    renderBattle();
    return 'swapping';
  }

  // Check player active ghost KO
  if (playerKO) {
    const alive = B.player.ghosts.filter((g, i) => i !== B.player.activeIdx && !g.ko && g.hp > 0);
    if (alive.length === 0) {
      B.phase = 'over';
      return 'defeat';
    }
    if (alive.length === 1) {
      doKoSwap('player', B.player.ghosts.indexOf(alive[0]));
      return 'continue';
    }
    // Player picks
    B.phase = 'ko-swap';
    B.koSwapTeam = 'player';
    B.log.push({ text: 'Choose your next Spiritkin!', type: 'ability' });
    renderBattle();
    return 'swapping';
  }

  // Check enemy active ghost KO (auto-swap)
  if (enemyKO) {
    const alive = B.enemy.ghosts.filter((g, i) => i !== B.enemy.activeIdx && !g.ko && g.hp > 0);
    if (alive.length === 0) {
      B.phase = 'over';
      return 'victory';
    }
    const nextIdx = B.enemy.ghosts.indexOf(alive[0]);
    doKoSwap('enemy', nextIdx);
    return 'continue';
  }

  return 'continue';
}

// Perform KO swap
function doKoSwap(teamKey, ghostIdx) {
  const team = B[teamKey];
  team.activeIdx = ghostIdx;
  const newActive = team.ghosts[ghostIdx];
  B.log.push({ text: `${newActive.name} enters the battle!`, type: 'ability' });

  // Fire entry ability for newly swapped-in ghost
  if (!newActive.entryFired) {
    newActive.entryFired = true;
    const enemyTeamKey = teamKey === 'player' ? 'enemy' : 'player';
    const target = B[enemyTeamKey].ghosts[B[enemyTeamKey].activeIdx];

    // Entry abilities
    if (newActive.id === 34 && target) { // Grawr
      target.hp = Math.max(0, target.hp - 1);
      B.log.push({ text: `${newActive.name} (Menace): 1 damage on entry!`, type: 'ability' });
      if (target.hp <= 0) target.ko = true;
    }
    if (newActive.id === 56) { // Chad
      if (teamKey === 'player') {
        B.resources.iceShards = (B.resources.iceShards || 0) + 2;
        B.log.push({ text: `${newActive.name} (Sploop!): +2 Ice Shards!`, type: 'ability' });
      } else {
        B.log.push({ text: `${newActive.name} (Sploop!): Enemy gained 2 Ice Shards.`, type: 'ability' });
      }
    }
    if (newActive.id === 94 && target) { // Jenkins
      const jd = rollDice(4);
      const jDmg = classify(jd).damage;
      target.hp = Math.max(0, target.hp - jDmg);
      B.log.push({ text: `${newActive.name} (Barrage): Entry roll [${jd.join(', ')}] = ${jDmg} damage!`, type: 'ability' });
      if (target.hp <= 0) target.ko = true;
    }
    if (newActive.id === 306 && target) { // Nerina
      target.hp = Math.max(0, target.hp - 3);
      B.log.push({ text: `${newActive.name} (Leviathan): 3 damage on entry!`, type: 'ability' });
      if (target.hp <= 0) target.ko = true;
    }
  }

  B.phase = 'ready';
  B.koSwapTeam = null;
  renderBattle();

  // After swap, check if the entry ability caused another KO
  if (teamKey === 'player') {
    const eg2 = activeEnemyGhost();
    if (eg2 && eg2.ko) {
      setTimeout(() => {
        const result = checkKO();
        if (result === 'victory') {
          renderBattle();
        }
      }, 300);
    }
  }
}

function classify(dice) {
  if (!dice?.length) return { type: 'none', value: 0, damage: 0 };
  if (dice.length === 1) return { type: 'singles', value: dice[0], damage: 1 };
  const counts = {};
  dice.forEach(d => counts[d] = (counts[d] || 0) + 1);
  const maxCount = Math.max(...Object.values(counts));
  const vals = Object.entries(counts).filter(([,v]) => v === maxCount).map(([k]) => +k);
  const maxVal = Math.max(...vals);
  if (maxCount >= 5) return { type: 'penta', value: maxVal, damage: 5 };
  if (maxCount >= 4) return { type: 'quads', value: maxVal, damage: 4 };
  if (maxCount >= 3) return { type: 'triples', value: maxVal, damage: 3 };
  if (maxCount >= 2) return { type: 'doubles', value: maxVal, damage: 2 };
  return { type: 'singles', value: Math.max(...dice), damage: 1 };
}

function tierRank(type) {
  return { none: 0, singles: 1, doubles: 2, triples: 3, quads: 4, penta: 5 }[type] || 0;
}

function compareRolls(a, b) {
  if (tierRank(a.type) > tierRank(b.type)) return 'a';
  if (tierRank(a.type) < tierRank(b.type)) return 'b';
  if (a.value > b.value) return 'a';
  if (a.value < b.value) return 'b';
  return 'tie';
}

// ═══════ RARITY HELPERS ═══════

function rarityGlowClass(rarity) {
  return 'rarity-glow-' + (rarity || 'common');
}

// ═══════ INTERACTIVE ABILITY MODALS ═══════

function showAbilityChoice(title, options, callback) {
  // Create a modal overlay in the battle arena
  const modal = document.createElement('div');
  modal.id = 'abilityChoiceModal';
  modal.style.cssText = 'position:absolute;inset:0;background:rgba(0,0,0,0.7);z-index:50;display:flex;align-items:center;justify-content:center;';
  modal.innerHTML = `<div style="background:#1a1a2e;border:2px solid #daa520;border-radius:10px;padding:20px;text-align:center;max-width:300px;">
    <div style="color:#daa520;font-weight:bold;font-size:14px;margin-bottom:12px;">${title}</div>
    <div style="display:flex;gap:10px;justify-content:center;">
      ${options.map((opt, i) => `<button style="padding:8px 16px;background:#2a3a5a;border:1px solid #4a6a8a;color:#fff;border-radius:6px;cursor:pointer;font-size:12px;" onclick="resolveAbilityChoice(${i})">${opt.label}</button>`).join('')}
    </div>
  </div>`;
  document.querySelector('.battle-arena')?.appendChild(modal);
  window._abilityChoiceCallback = callback;
}

function resolveAbilityChoice(idx) {
  document.getElementById('abilityChoiceModal')?.remove();
  if (window._abilityChoiceCallback) {
    window._abilityChoiceCallback(idx);
    window._abilityChoiceCallback = null;
  }
}

// Smudge/Blackout (403) — number picker for dice nullify
function showSmudgeNumberPicker(callback) {
  const modal = document.createElement('div');
  modal.id = 'abilityChoiceModal';
  modal.style.cssText = 'position:absolute;inset:0;background:rgba(0,0,0,0.7);z-index:50;display:flex;align-items:center;justify-content:center;';
  modal.innerHTML = `<div style="background:#1a1a2e;border:2px solid #8a3aaa;border-radius:10px;padding:20px;text-align:center;max-width:320px;">
    <div style="color:#c77dff;font-weight:bold;font-size:14px;margin-bottom:12px;">SMUDGE — Name a number (1-6)</div>
    <div style="color:#aaa;font-size:11px;margin-bottom:10px;">If the opponent rolls it, that die won't count.</div>
    <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">
      ${[1,2,3,4,5,6].map(n => `<button style="width:40px;height:40px;background:#2a2a4a;border:2px solid #6a4a8a;color:#fff;border-radius:8px;cursor:pointer;font-size:18px;font-weight:bold;" onclick="resolveAbilityChoice(${n})">${n}</button>`).join('')}
    </div>
  </div>`;
  document.querySelector('.battle-arena')?.appendChild(modal);
  window._abilityChoiceCallback = callback;
}

// ═══════ BATTLE ITEMS (Equipped Gear) ═══════

function getEquippedGear() {
  return {
    weapon: G.equipped?.weapon || null,
    armor: G.equipped?.head || null,
    accessory: G.equipped?.accessory || null,
  };
}

// Apply equipped accessory start-of-battle effects to B.resources
function applyAccessoryBattleEffects() {
  if (!G.equipped || !G.equipped.accessory) return;
  const schematic = G.equipped.accessory.schematic;
  if (schematic === 'ember_stone') B.resources.sacredFire = (B.resources.sacredFire || 0) + 1;
  if (schematic === 'healing_root') B.resources.healingSeeds = (B.resources.healingSeeds || 0) + 1;
  if (schematic === 'lucky_charm') B.resources.luckyStones = (B.resources.luckyStones || 0) + 1;
  if (schematic === 'frost_shard_charm') B.resources.iceShards = (B.resources.iceShards || 0) + 1;
  if (schematic === 'surge_crystal') B.resources.surge = (B.resources.surge || 0) + 1;
  if (schematic === 'moonstone_ring') B.resources.moonstone = (B.resources.moonstone || 0) + 1;
  if (schematic === 'firefly_lantern') {
    B.resources.firefly = (B.resources.firefly || 0) + 1;
    // Take 2 damage
    const pg = B.player.ghosts[B.player.activeIdx];
    if (pg) pg.hp = Math.max(1, pg.hp - 2);
  }
}

function renderGearIcons() {
  const { weapon, armor } = getEquippedGear();
  if (!weapon && !armor) return '';
  let html = '<div class="battle-gear-icons" style="display:flex;gap:6px;align-items:center;justify-content:center;margin-bottom:4px;">';
  if (weapon) {
    html += `<span title="${weapon.name}: +${weapon.bonusDamage || 0} dmg" style="background:#2a3a5a;border:1px solid #4a6a8a;border-radius:4px;padding:2px 6px;font-size:11px;color:#6af;">${weapon.icon || '⚔️'} +${weapon.bonusDamage || 0}</span>`;
  }
  if (armor) {
    html += `<span title="${armor.name}: -${armor.damageReduction || 0} dmg taken" style="background:#3a2a2a;border:1px solid #8a4a4a;border-radius:4px;padding:2px 6px;font-size:11px;color:#fa6;">${armor.icon || '🛡️'} -${armor.damageReduction || 0}</span>`;
  }
  html += '</div>';
  return html;
}

// ═══════ 3D DICE PHYSICS ENGINE (ported from testroom) ═══════

// Check if 3D dice should be used (screens > 600px)
function use3dDice() { return window.innerWidth > 600; }

// Pip layout definitions
const PIP_LAYOUTS = {
  1: ['c'],
  2: ['tl','br'],
  3: ['tl','c','br'],
  4: ['tl','tr','bl','br'],
  5: ['tl','tr','c','bl','br'],
  6: ['tl','tr','ml','mr','bl','br']
};
const PIP_STYLES = {
  tl:'top:18%;left:18%', tr:'top:18%;right:18%',
  ml:'top:50%;left:18%;transform:translateY(-50%)',
  c:'top:50%;left:50%;transform:translate(-50%,-50%)',
  mr:'top:50%;right:18%;transform:translateY(-50%)',
  bl:'bottom:18%;left:18%', br:'bottom:18%;right:18%'
};

function pip3dHTML(val) {
  return (PIP_LAYOUTS[val]||PIP_LAYOUTS[1]).map(p=>`<span class="pip3d" style="${PIP_STYLES[p]}"></span>`).join('');
}

function cube3dHTML(team) {
  const c = 'face-' + team;
  // front=1, right=2, top=3, bottom=4, left=5, back=6
  return [
    ['front',1],['back',6],['right',2],['left',5],['top',3],['bottom',4]
  ].map(([f,v])=>`<div class="die-face ${c} face-${f}">${pip3dHTML(v)}</div>`).join('');
}

const FACE_TARGET = {
  1:{rx:0,ry:0}, 2:{rx:0,ry:-90}, 3:{rx:90,ry:0},
  4:{rx:-90,ry:0}, 5:{rx:0,ry:90}, 6:{rx:0,ry:180}
};
function nearestSnap(cur,tgt){const n=Math.round((cur-tgt)/360);return tgt+n*360;}

let _dicePhysics = {};

// Throw Profiles — choreographed dice paths
const THROW_PROFILES = [
  // THE BLOOM
  (i, n) => { const t = n > 1 ? i / (n - 1) : 0.5; return { vx: 13 + t * 15, vy: -(25 - t * 20) }; },
  // THE BANK SHOT
  (i, n) => { const t = n > 1 ? i / (n - 1) : 0.5; return { vx: 10 + t * 14, vy: -(20 + t * 4) }; },
  // THE CROSS-TABLE
  (i, n) => { const t = n > 1 ? i / (n - 1) : 0.5; return { vx: 24 + t * 6, vy: -(8 + t * 10) }; },
  // THE SPIRAL
  (i, n) => { const t = n > 1 ? i / (n - 1) : 0.5; return { vx: 28 - t * 18, vy: -(10 + t * 12) }; },
  // THE SCATTER
  (i, n) => {
    const angles = [0.15, 0.55, 0.85, 0.35, 0.7];
    const a = angles[i % angles.length];
    return { vx: 14 + a * 14, vy: -(6 + (1 - a) * 20) };
  },
  // THE GENTLE TOSS
  (i, n) => { const t = n > 1 ? i / (n - 1) : 0.5; return { vx: 7 + t * 5, vy: -(9 + t * 3) }; },
];

function pickThrowProfile(count) {
  const profile = THROW_PROFILES[Math.floor(Math.random() * THROW_PROFILES.length)];
  const noise = () => 1 + (Math.random() - 0.5) * 0.25;
  return Array.from({ length: count }, (_, i) => {
    const v = profile(i, count);
    return { vx: v.vx * noise() * 1.15, vy: v.vy * noise() * 1.15 };
  });
}

function update3dDice(team, values) {
  const physics = _dicePhysics[team];
  if (!physics || !physics.dice) return;
  physics.values = values;
  values.forEach((v, i) => {
    const d = physics.dice[i];
    if (!d || d.value === v) return;
    d.value = v;
    d.el.classList.remove('highlight-single', 'highlight-double', 'highlight-triple',
      'die-win-singles-3d', 'die-win-doubles-3d', 'die-win-triples-3d', 'die-win-mega-3d',
      'die-win-secondary-3d', 'die-loser-3d', 'triples-glow-3d');
    const tgt = FACE_TARGET[v];
    d.rx = nearestSnap(d.rx, tgt.rx);
    d.ry = nearestSnap(d.ry, tgt.ry);
    d.el.classList.add('value-update');
    d.cube.style.transform = `rotateX(${d.rx}deg) rotateY(${d.ry}deg) rotateZ(${d.rz}deg)`;
    setTimeout(() => d.el.classList.remove('value-update'), 450);
  });
}

function flatDieHTML(val, team) {
  if (val === '?' || val === 0 || !val) return `<div class="die ${team}">?</div>`;
  return `<div class="die ${team}"><div style="position:relative;width:100%;height:100%;" class="face-${team}">${pip3dHTML(val)}</div></div>`;
}

// Show rolling animation — 3D physics dice bouncing across the battle field
function showRolling3d(team, count) {
  if (count === 0) return;

  // Roll dice across the battle field
  const board = document.querySelector('.battle-field');
  if (!board) return;
  const boardRect = board.getBoundingClientRect();
  const W = boardRect.width;
  const H = boardRect.height;
  const dieSize = 38;
  const half = dieSize / 2;
  const pad = 12;
  const minX = pad, maxX = W - pad - dieSize;
  const minY = pad, maxY = H - pad - dieSize;

  // Clean up previous physics for this team
  if (_dicePhysics[team]) {
    cancelAnimationFrame(_dicePhysics[team].raf);
    _dicePhysics[team].els.forEach(e => e.remove());
  }

  const dice = [];
  const els = [];
  const isPlayer = team === 'player';
  const handX = isPlayer ? minX + 10 : maxX - 10;
  const handY = maxY - 5;
  const throwVecs = pickThrowProfile(count);

  for (let i = 0; i < count; i++) {
    const die = document.createElement('div');
    die.className = 'die-physics';
    die.style.width = dieSize + 'px';
    die.style.height = dieSize + 'px';
    die.style.zIndex = '100';
    die.style.setProperty('--dh', half + 'px');
    die.innerHTML = `<div class="die-cube">${cube3dHTML(team)}</div>`;
    board.appendChild(die);
    els.push(die);

    const tv = throwVecs[i];
    dice.push({
      el: die, cube: die.querySelector('.die-cube'),
      x: handX + (Math.random() - 0.5) * 6, y: handY + (Math.random() - 0.5) * 6,
      vx: (isPlayer ? 1 : -1) * tv.vx,
      vy: tv.vy,
      rx: Math.random() * 720, ry: Math.random() * 720, rz: Math.random() * 360,
      vrx: (Math.random() - 0.5) * 55,
      vry: (Math.random() - 0.5) * 55,
      vrz: (Math.random() - 0.5) * 40,
      bounceCount: 0
    });
  }

  function getBounceCoeff(d) {
    return Math.max(0.3, 0.65 * Math.pow(0.8, d.bounceCount));
  }
  function getSurfaceFriction(speed) {
    if (speed > 8) return 0.982;
    if (speed > 3) return 0.965;
    return 0.935;
  }
  function getRotFriction(speed) {
    if (speed > 8) return 0.972;
    if (speed > 3) return 0.950;
    return 0.920;
  }

  function step() {
    // Dice-to-dice repulsion
    for (let a = 0; a < dice.length; a++) {
      for (let b = a + 1; b < dice.length; b++) {
        const da = dice[a], db = dice[b];
        const dx = da.x - db.x, dy = da.y - db.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < dieSize && dist > 0.1) {
          const push = (dieSize - dist) * 0.15;
          const nx = dx / dist, ny = dy / dist;
          da.vx += nx * push; da.vy += ny * push;
          db.vx -= nx * push; db.vy -= ny * push;
        }
      }
    }
    dice.forEach(d => {
      d.x += d.vx; d.y += d.vy;
      d.rx += d.vrx; d.ry += d.vry; d.rz += d.vrz;
      const speed = Math.abs(d.vx) + Math.abs(d.vy);

      const bc = getBounceCoeff(d);
      if (d.x < minX) {
        d.x = minX; d.vx = Math.abs(d.vx) * bc;
        d.vry *= 1.4; d.vrz *= 1.3;
        d.bounceCount++;
      }
      if (d.x > maxX) {
        d.x = maxX; d.vx = -Math.abs(d.vx) * bc;
        d.vry *= 1.4; d.vrz *= 1.3;
        d.bounceCount++;
      }
      if (d.y < minY) {
        d.y = minY; d.vy = Math.abs(d.vy) * bc;
        d.vrx *= 1.4; d.vrz *= 1.3;
        d.bounceCount++;
      }
      if (d.y > maxY) {
        d.y = maxY; d.vy = -Math.abs(d.vy) * bc;
        d.vrx *= 1.4; d.vrz *= 1.3;
        d.bounceCount++;
      }

      const fric = getSurfaceFriction(speed);
      const rFric = getRotFriction(speed);
      d.vx *= fric; d.vy *= fric;
      d.vrx *= rFric; d.vry *= rFric; d.vrz *= rFric;

      // Rotation homing — settle onto nearest face as dice slow
      if (speed < 6) {
        const strength = 0.08 * (1 - speed / 6);
        d.rx += (Math.round(d.rx / 90) * 90 - d.rx) * strength;
        d.ry += (Math.round(d.ry / 90) * 90 - d.ry) * strength;
        d.rz += (Math.round(d.rz / 90) * 90 - d.rz) * strength;
      }
      d.el.style.left = d.x + 'px';
      d.el.style.top = d.y + 'px';
      d.cube.style.transform = `rotateX(${d.rx}deg) rotateY(${d.ry}deg) rotateZ(${d.rz}deg)`;
    });
    _dicePhysics[team].raf = requestAnimationFrame(step);
  }

  _dicePhysics[team] = { raf: requestAnimationFrame(step), dice, els };
}

// Settle 3D dice to their final positions in the dice tray
function settleToSlot(team, values) {
  const physics = _dicePhysics[team];
  if (!physics || !physics.dice.length) return;

  cancelAnimationFrame(physics.raf);

  // Calculate tray position within the battle field
  const board = document.querySelector('.battle-field');
  const boardRect = board.getBoundingClientRect();
  const diceSetId = team === 'player' ? 'pDice' : 'eDice';
  const trayEl = document.getElementById(diceSetId);
  const trayRect = trayEl.getBoundingClientRect();
  const offsetX = trayRect.left - boardRect.left;
  const offsetY = trayRect.top - boardRect.top;
  const trayW = trayRect.width;
  const dieSize = 38;
  const gap = 6;

  const totalDiceW = values.length * dieSize + (values.length - 1) * gap;
  const trayStartX = offsetX + (trayW - totalDiceW) / 2;
  const trayMidY = offsetY + trayRect.height / 2 - dieSize / 2;

  values.forEach((v, i) => {
    const d = physics.dice[i];
    if (!d) return;

    const tx = trayStartX + i * (dieSize + gap);
    const ty = trayMidY;

    const tgt = FACE_TARGET[v];
    const frx = nearestSnap(d.rx, tgt.rx);
    const fry = nearestSnap(d.ry, tgt.ry);
    const frz = nearestSnap(d.rz, 0);
    d.rx = frx; d.ry = fry; d.rz = frz;
    d.value = v;

    setTimeout(() => {
      d.el.classList.add('settling');
      d.el.style.left = tx + 'px';
      d.el.style.top = ty + 'px';
      d.cube.style.transform = `rotateX(${frx}deg) rotateY(${fry}deg) rotateZ(${frz}deg)`;
    }, i * 80);
  });

  // Mark as settled after animation completes
  const settleDelay = values.length * 80 + 750;
  setTimeout(() => {
    physics.settled = true;
    physics.values = values;
    physics.els.forEach(e => e.style.zIndex = '10');
  }, settleDelay);
}

// Clean up 3D dice for a team
function cleanup3dDice(team) {
  if (_dicePhysics[team]) {
    cancelAnimationFrame(_dicePhysics[team].raf);
    _dicePhysics[team].els.forEach(e => e.remove());
    delete _dicePhysics[team];
  }
}

// Highlight 3D dice based on roll result (winner/loser)
function highlight3dDice(team, dice, roll, isWinner) {
  const physics = _dicePhysics[team];
  if (!physics || !physics.dice) return;

  const counts = {};
  dice.forEach(d => counts[d] = (counts[d] || 0) + 1);

  physics.dice.forEach((d, i) => {
    if (!d || !d.el) return;
    // Clear previous highlights
    d.el.classList.remove('highlight-single', 'highlight-double', 'highlight-triple',
      'die-win-singles-3d', 'die-win-doubles-3d', 'die-win-triples-3d', 'die-win-mega-3d',
      'die-win-secondary-3d', 'die-loser-3d', 'triples-glow-3d');

    const v = dice[i];
    const isMatchingDie = (v === roll.value && counts[v] >= 2);

    if (isWinner) {
      if (isMatchingDie || roll.type === 'singles') {
        if (roll.type === 'penta' || roll.type === 'quads') d.el.classList.add('die-win-mega-3d');
        else if (roll.type === 'triples') d.el.classList.add('die-win-triples-3d');
        else if (roll.type === 'doubles') d.el.classList.add('die-win-doubles-3d');
        else d.el.classList.add('die-win-singles-3d');
      }
    } else {
      d.el.classList.add('die-loser-3d');
    }
  });
}

// ═══════ BATTLE SYSTEM ═══════

let B = null; // Battle state


function triggerWildEncounter() {
  if (G.inBattle || G.team.length === 0) return;
  // Close any open UI overlays before battle
  document.querySelectorAll('.modal-overlay.active, #npcDialogueBox').forEach(el => { if (el.id === 'npcDialogueBox') el.style.display='none'; else el.classList.remove('active'); });


  const wildCard = getWildEncounter();
  if (!wildCard) return;

  SFX.encounterStart();
  battleFledThisSession = false;
  G.inBattle = true;
  Music.play('battle');

  // Build player team from G.team (up to 3)
  const playerGhosts = buildPlayerBattleTeam();

  // Wild encounters are always 1v1
  const enemyCount = 1;
  const enemyCards = [wildCard];
  for (let i = 1; i < enemyCount; i++) {
    const extra = getWildEncounter();
    if (extra) enemyCards.push(extra);
  }
  const enemyGhosts = enemyCards.map(c => ({
    id: c.id, name: c.name, hp: c.maxHp, maxHp: c.maxHp, ko: false,
    ability: c.ability, abilityDesc: c.desc, rarity: c.rarity, usedOncePerGame: false, entryFired: false
  }));

  // Scale enemy HP based on player level
  for (const eg of enemyGhosts) {
    if (G.level <= 3) { eg.maxHp = Math.max(2, eg.maxHp - 1); eg.hp = eg.maxHp; }
    else if (G.level >= 7) { eg.maxHp += 1; eg.hp = eg.maxHp; }
  }

  B = {
    round: 1,
    player: {
      ghosts: playerGhosts,
      activeIdx: 0,
      resources: { iceShards: G.iceShards || 0, sacredFire: G.sacredFire || 0, healingSeeds: G.healingSeeds || 0, luckyStones: G.luckyStones || 0, surge: G.surge || 0, moonstone: G.moonstone || 0, firefly: G.firefly || 0 },
    },
    enemy: {
      ghosts: enemyGhosts,
      activeIdx: 0,
      resources: { iceShards: 0, sacredFire: 0, healingSeeds: 0, luckyStones: 0, surge: 0, moonstone: 0, firefly: 0 },
    },
    enemyCard: wildCard,
    enemyCards: enemyCards,
    log: [],
    phase: 'ready',
    playerDice: [],
    enemyDice: [],
    entryFired: false,
    resources: { iceShards: G.iceShards || 0, sacredFire: G.sacredFire || 0, healingSeeds: G.healingSeeds || 0, luckyStones: G.luckyStones || 0, surge: G.surge || 0, moonstone: G.moonstone || 0, firefly: G.firefly || 0 },
    zoneIdx: getCurrentZone(G.x, G.y),
    nextRoundMods: { playerExtraDice: 0, enemyExtraDice: 0, playerMaxDice: 99, enemyMaxDice: 99 },
    enemyUsedResource: false,
    damageTakenThisRound: 0,
    koSwapTeam: null,
    committed: {},
  };

  applyAccessoryBattleEffects();

  // Show dramatic splash text before battle overlay
  if (typeof showWildAppearedSplash === 'function') {
    showWildAppearedSplash(wildCard.name);
  }

  showBattleOverlay();
  document.getElementById('battleTitle').textContent = enemyCount > 1
    ? `Wild ${wildCard.name} and ${enemyCount - 1} more appeared!`
    : `Wild ${wildCard.name} appeared!`;

  renderBattle();
  notify(`Wild ${wildCard.name} appeared!`);
}

// Build player battle team from G.team (up to 3 alive ghosts)
function buildPlayerBattleTeam() {
  // Find alive ghosts, prioritizing the active one
  let alive = G.team.filter(g => !g.ko && g.hp > 0);
  if (alive.length === 0) {
    // Force heal first team member
    G.team[0].hp = Math.max(1, G.team[0].hp);
    G.team[0].ko = false;
    alive = [G.team[0]];
  }
  // Put active ghost first
  const activeG = G.team[G.activeIdx];
  if (activeG && !activeG.ko && activeG.hp > 0) {
    alive = [activeG, ...alive.filter(g => g !== activeG)];
  }
  // Sideline unlocks after 5 battle wins — before that, 1v1 only
  const sidelineUnlocked = (G.rep?.battlesWon || 0) >= 5;
  const maxTeamSize = sidelineUnlocked ? 3 : 1;
  return alive.slice(0, maxTeamSize).map(g => ({
    ...g, hp: Math.max(1, g.hp), ko: false, usedOncePerGame: false, entryFired: false,
    _teamIdx: G.team.indexOf(g) // track which G.team slot this came from
  }));
}


function showBattleOverlay() {
  // Clean up any previous battle result banners
  const arena = document.getElementById('battleArena');
  const oldBanner = arena?.querySelector('.battle-result-banner');
  if (oldBanner) oldBanner.remove();
  const oldCelebrate = document.querySelector('.sprite-celebrate');
  if (oldCelebrate) oldCelebrate.classList.remove('sprite-celebrate');

  // Pre-battle zoom effect (300ms camera push)
  window._viewpointZoom = 1.0;
  const zoomStart = Date.now();
  const zoomDuration = 300;
  function zoomIn() {
    const elapsed = Date.now() - zoomStart;
    const t = Math.min(1, elapsed / zoomDuration);
    window._viewpointZoom = 1.0 + t * 0.15; // zoom to 1.15x
    if (t < 1) requestAnimationFrame(zoomIn);
    else {
      // Reset zoom and show battle overlay
      window._viewpointZoom = 1;
      const overlay = document.getElementById('battleOverlay');
      overlay.classList.add('active');
      requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add('visible')));
    }
  }
  zoomIn();
}

function renderBattle() {
  if (!B) return;

  document.getElementById('battleRound').textContent = `Round ${B.round}`;

  // Player fighter
  const pg = activePlayerGhost();
  if (!pg) return;
  const pCard = getCard(pg.id);
  document.getElementById('pFighterName').textContent = pg.name;
  document.getElementById('pFighterAbility').textContent = pg.ability + (pg.abilityDesc ? ': ' + pg.abilityDesc : '');
  const pArt = document.getElementById('pFighterArt');
  pArt.parentElement.querySelector('.sprite-fallback')?.remove();
  pArt.src = pCard?.art || '';
  pArt.style.display = '';
  pArt.onerror = function() {
    this.style.display = 'none';
    this.parentElement.querySelector('.sprite-fallback')?.remove();
    const fb = document.createElement('div');
    fb.className = 'sprite-fallback';
    const rarityBg = {common:'#555',uncommon:'#2a6a2a',rare:'#2a4a8a','ghost-rare':'#6a2a8a',legendary:'#8a6a1a'}[pg.rarity] || '#444';
    fb.style.background = rarityBg;
    fb.textContent = pg.name;
    this.parentElement.insertBefore(fb, this);
  };
  const pPct = Math.max(0, pg.hp / pg.maxHp * 100);
  const pBar = document.getElementById('pHpBar');
  pBar.style.width = pPct + '%';
  pBar.className = 'hp-bar-inner ' + (pPct > 50 ? 'green' : pPct > 25 ? 'yellow' : 'red');
  document.getElementById('pHpText').textContent = `HP ${Math.max(0,pg.hp)}/${pg.maxHp}`;

  // Enemy fighter
  const eg = activeEnemyGhost();
  if (!eg) return;
  const eCard = getCard(eg.id) || B.enemyCard;
  document.getElementById('eFighterName').textContent = eg.name;
  document.getElementById('eFighterAbility').textContent = eg.ability + (eg.abilityDesc ? ': ' + eg.abilityDesc : '');
  const eArt = document.getElementById('eFighterArt');
  eArt.parentElement.querySelector('.sprite-fallback')?.remove();
  eArt.src = eCard?.art || '';
  eArt.style.display = '';
  eArt.onerror = function() {
    this.style.display = 'none';
    this.parentElement.querySelector('.sprite-fallback')?.remove();
    const fb = document.createElement('div');
    fb.className = 'sprite-fallback';
    const rarityBg = {common:'#555',uncommon:'#2a6a2a',rare:'#2a4a8a','ghost-rare':'#6a2a8a',legendary:'#8a6a1a'}[eg.rarity] || '#444';
    fb.style.background = rarityBg;
    fb.textContent = eg.name;
    this.parentElement.insertBefore(fb, this);
  };
  const ePct = Math.max(0, eg.hp / eg.maxHp * 100);
  const eBar = document.getElementById('eHpBar');
  eBar.style.width = ePct + '%';
  eBar.className = 'hp-bar-inner ' + (ePct > 50 ? 'green' : ePct > 25 ? 'yellow' : 'red');
  document.getElementById('eHpText').textContent = `HP ${Math.max(0,eg.hp)}/${eg.maxHp}`;

  // Dice
  const pDiceEl = document.getElementById('pDice');
  const eDiceEl = document.getElementById('eDice');
  pDiceEl.innerHTML = B.playerDice.map(d => `<div class="die player">${d}</div>`).join('');
  eDiceEl.innerHTML = B.enemyDice.map(d => `<div class="die enemy">${d}</div>`).join('');

  // Narrator text — show last 3 events in clean format, auto-scroll
  const logEl = document.getElementById('battleLog');
  const recentEvents = B.log.slice(-3);
  const typeClass = { damage: 'dmg', heal: 'heal', ability: 'ability' };
  logEl.innerHTML = recentEvents.map(l => {
    const cls = typeClass[l.type] || '';
    return cls ? `<span class="${cls}">${l.text}</span>` : l.text;
  }).join('<br>');
  // Auto-scroll narrator to show latest event
  const narratorEl = logEl.closest('.battle-narrator');
  if (narratorEl) narratorEl.scrollTop = narratorEl.scrollHeight;

  // Render sideline ghosts
  renderSideline('player', 'pSideline');
  renderSideline('enemy', 'eSideline');

  // Resources display
  const resEl = document.getElementById('pResources');
  if (resEl && B.resources) {
    const res = B.resources;
    let resHtml = '';
    if (res.iceShards > 0) resHtml += `<span class="res-ice">ICE:${res.iceShards}</span> `;
    if (res.sacredFire > 0) resHtml += `<span class="res-fire">FIRE:${res.sacredFire}</span> `;
    if (res.healingSeeds > 0) resHtml += `<span class="res-seed">SEED:${res.healingSeeds}</span> `;
    if (res.surge > 0) resHtml += `<span class="res-surge">SRG:${res.surge}</span> `;
    if (res.luckyStones > 0) resHtml += `<span style="color:#ca4;font-weight:bold;font-size:11px;">LUCK:${res.luckyStones}</span> `;
    if (res.moonstone > 0) resHtml += `<span style="color:#c8f;font-weight:bold;font-size:11px;">MOON:${res.moonstone}</span> `;
    if (res.firefly > 0) resHtml += `<span style="color:#ff8;font-weight:bold;font-size:11px;">FLY:${res.firefly}</span> `;
    if ((res.burn || 0) > 0) resHtml += `<span style="color:#f44;font-weight:bold;font-size:11px;">BURN:${res.burn}</span> `;
    resEl.innerHTML = resHtml || '<span style="color:#555;">No resources</span>';
  }

  // Actions
  const actionsEl = document.getElementById('battleActions');
  if (B.phase === 'ko-swap') {
    actionsEl.innerHTML = '<span style="color:#daa520;font-weight:bold;">Click a sideline ghost to swap in!</span>';
  } else if (B.phase === 'over') {
    const playerDefeated = isTeamDefeated(B.player);
    const enemyDefeated = isTeamDefeated(B.enemy);
    const won = enemyDefeated;
    actionsEl.innerHTML = `<button class="battle-btn btn-roll" onclick="endBattle(${won})">${won ? 'Victory!' : 'Defeated...'}</button>`;
    if (!B._bannerShown) { B._bannerShown = true; showBattleResultBanner(won); }
  } else if (pg.ko || eg.ko) {
    // A ghost is KO'd but we haven't entered ko-swap or over phase yet — trigger checkKO
    const koResult = checkKO();
    if (koResult === 'victory') {
      B.phase = 'over';
      actionsEl.innerHTML = `<button class="battle-btn btn-roll" onclick="endBattle(true)">Victory!</button>`;
      if (!B._bannerShown) { B._bannerShown = true; showBattleResultBanner(true); }
    } else if (koResult === 'defeat') {
      B.phase = 'over';
      actionsEl.innerHTML = `<button class="battle-btn btn-roll" onclick="endBattle(false)">Defeated...</button>`;
      if (!B._bannerShown) { B._bannerShown = true; showBattleResultBanner(false); }
    }
    // 'swapping' is handled by ko-swap above on re-render
  } else {
    // Normal ready state — show commit bar + FIGHT/RUN buttons
    let commitHtml = '';
    if (B.phase === 'ready' && B.resources) {
      const res = B.resources;
      const com = B.committed || {};
      const hasAny = res.iceShards > 0 || res.sacredFire > 0 || res.healingSeeds > 0 || res.surge > 0 || res.luckyStones > 0 || res.moonstone > 0;
      const hasCommitted = Object.keys(com).length > 0;
      if (hasAny || hasCommitted) {
        commitHtml = '<div class="battle-commit-bar">';
        if (res.iceShards > 0) commitHtml += `<button class="commit-btn" onclick="commitResource('iceShards')" title="Commit Ice Shard (+1 dmg on win)">ICE ${res.iceShards}</button>`;
        if (res.sacredFire > 0) commitHtml += `<button class="commit-btn commit-fire" onclick="commitResource('sacredFire')" title="Commit Sacred Fire (+3 dmg on win)">FIRE ${res.sacredFire}</button>`;
        if (res.healingSeeds > 0) commitHtml += `<button class="commit-btn commit-heal" onclick="commitResource('healingSeeds')" title="Heal 2 HP after roll">SEED ${res.healingSeeds}</button>`;
        if (res.surge > 0) commitHtml += `<button class="commit-btn commit-surge" onclick="commitResource('surge')" title="+1 die this roll">SURGE ${res.surge}</button>`;
        if (res.luckyStones > 0) commitHtml += `<button class="commit-btn commit-lucky" onclick="commitResource('luckyStones')" title="Reroll lowest die">LUCK ${res.luckyStones}</button>`;
        if (res.moonstone > 0) commitHtml += `<button class="commit-btn commit-moon" onclick="commitResource('moonstone')" title="Set highest die to 6">MOON ${res.moonstone}</button>`;
        commitHtml += '</div>';
        // Show committed resources
        if (hasCommitted) {
          commitHtml += '<div class="battle-committed">';
          for (const [k, v] of Object.entries(com)) {
            if (v > 0) {
              const label = {iceShards:'ICE',sacredFire:'FIRE',healingSeeds:'SEED',surge:'SURGE',luckyStones:'LUCK',moonstone:'MOON'}[k] || k;
              commitHtml += `<span class="committed-tag" onclick="uncommitResource('${k}')" title="Click to uncommit">${label} x${v} ✓</span>`;
            }
          }
          commitHtml += '</div>';
        }
      }
    }
    actionsEl.innerHTML = renderGearIcons() + commitHtml +
      '<button class="battle-btn btn-roll" id="btnRoll" onclick="battleRoll()">FIGHT</button>' +
      '<button class="battle-btn btn-flee" onclick="fleeBattle()">RUN</button>';
  }
}

// Render sideline ghosts for a team
function renderSideline(teamKey, elementId) {
  const team = B[teamKey];
  const el = document.getElementById(elementId);
  if (!el || !team || team.ghosts.length <= 1) { if (el) el.innerHTML = ''; return; }
  const sideline = team.ghosts.filter((g, i) => i !== team.activeIdx);
  el.innerHTML = sideline.map(g => {
    const pct = Math.max(0, g.hp / g.maxHp * 100);
    const hpColor = pct > 50 ? '#4a8' : pct > 25 ? '#aa8' : '#a44';
    const realIdx = team.ghosts.indexOf(g);
    const isSwapPick = B.phase === 'ko-swap' && B.koSwapTeam === teamKey && !g.ko;
    const card = getCard(g.id);
    const artSrc = card?.art || '';
    return `<div class="sideline-ghost ${g.ko ? 'ko' : ''} ${isSwapPick ? 'swap-pick' : ''}"
      ${isSwapPick ? `onclick="doKoSwap('${teamKey}', ${realIdx})"` : ''}>
      <img class="sl-art" src="${artSrc}" alt="${g.name}" onerror="this.style.display='none'">
      <div class="sl-name">${g.name}</div>
      <div class="sl-ability-name">${g.ability || ''}</div>
      <div class="sl-ability-desc">${g.abilityDesc || card?.desc || ''}</div>
      <div class="sl-hp"><div class="sl-hp-fill" style="width:${pct}%;background:${hpColor};"></div></div>
      ${g.ko ? '<div style="font-size:8px;color:#a44;margin-top:2px;">KO</div>' : `<div style="font-size:8px;color:#888;margin-top:2px;">${g.hp}/${g.maxHp}</div>`}
    </div>`;
  }).join('');
}

// ═══════ BATTLE SCREEN SHAKE ═══════
function battleShake() {
  const arena = document.getElementById('battleArena');
  arena.classList.remove('shake');
  void arena.offsetWidth; // reflow
  arena.classList.add('shake');
  setTimeout(() => arena.classList.remove('shake'), 300);
}

// ═══════ HP BAR FLASH ═══════
function flashHpBar(barId) {
  const bar = document.getElementById(barId);
  if (!bar) return;
  bar.classList.add('flash-red');
  setTimeout(() => bar.classList.remove('flash-red'), 200);
}

// ═══════ FLOATING DAMAGE NUMBER ═══════
function showDmgFloat(target, amount, isHeal) {
  const spriteEl = document.querySelector(`.battle-sprite.${target} img`);
  if (!spriteEl) return;
  const rect = spriteEl.getBoundingClientRect();
  const arena = document.getElementById('battleArena');
  const arenaRect = arena.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = 'dmg-float' + (isHeal ? ' heal' : '');
  el.textContent = (isHeal ? '+' : '-') + amount;
  el.style.left = (rect.left - arenaRect.left + rect.width / 2 - 20) + 'px';
  el.style.top = (rect.top - arenaRect.top + 10) + 'px';
  arena.appendChild(el);
  setTimeout(() => el.remove(), 1000);
}

// ═══════ SPRITE HIT REACTION ═══════
function spriteHitReact(target) {
  const img = document.querySelector(`.battle-sprite.${target} img`);
  if (!img) return;
  img.classList.remove('hit', 'sprite-bounce');
  void img.offsetWidth;
  img.classList.add('hit', 'sprite-bounce');
  setTimeout(() => img.classList.remove('hit', 'sprite-bounce'), 400);
}

// ═══════ VICTORY/DEFEAT BANNER ═══════
function showBattleResultBanner(won) {
  const arena = document.getElementById('battleArena');
  const existing = arena.querySelector('.battle-result-banner');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.className = 'battle-result-banner ' + (won ? 'victory' : 'defeat');
  el.textContent = won ? 'VICTORY' : 'DEFEAT';
  arena.appendChild(el);
  // Winner sprite celebrates
  const winSprite = document.querySelector(`.battle-sprite.${won ? 'player' : 'enemy'} img`);
  if (winSprite) { winSprite.classList.add('sprite-celebrate'); }
}



function battleRoll() {
  if (!B || B.phase === 'rolling' || B.phase === 'ko-swap' || B.phase === 'over') return;

  const pg = activePlayerGhost();
  const eg = activeEnemyGhost();
  if (!pg || !eg) return;

  // ── SMUDGE/BLACKOUT (403): Pre-roll number pick — must choose before dice fly ──
  if (pg.id === 403 && !B._smudgeNumberChosen) {
    B.phase = 'rolling'; // prevent double-click
    showSmudgeNumberPicker((num) => {
      B._smudgeNumber = num;
      B._smudgeNumberChosen = true;
      B.log.push({ text: `${pg.name} (Blackout): Named ${num}! Enemy dice showing ${num} won't count.`, type: 'ability' });
      B.phase = 'ready'; // reset so battleRoll can proceed
      battleRoll();
    });
    return;
  }
  // Enemy Smudge (403): AI picks a random number
  if (eg.id === 403 && !B._smudgeNumberChosenEnemy) {
    B._smudgeNumberEnemy = Math.ceil(Math.random() * 6);
    B._smudgeNumberChosenEnemy = true;
    B.log.push({ text: `${eg.name} (Blackout): Named ${B._smudgeNumberEnemy}! Your dice showing ${B._smudgeNumberEnemy} won't count.`, type: 'ability' });
  }

  B.phase = 'rolling';
  B.enemyUsedResource = false;
  B.cameronActive = false;

  // ── ENTRY ABILITIES (Round 1 only) ──
  if (!B.entryFired) {
    B.entryFired = true;

    // Player entry
    if (pg.id === 34) { // Grawr — Menace: deal 1 damage on entry
      eg.hp = Math.max(0, eg.hp - 1);
      B.log.push({ text: `${pg.name} (Menace): Deals 1 damage on entry!`, type: 'ability' });
      if (eg.hp <= 0) { eg.ko = true; }
    }
    if (pg.id === 56) { // Chad — Sploop: gain 2 Ice Shards
      B.resources.iceShards += 2;
      B.log.push({ text: `${pg.name} (Sploop!): Gained 2 Ice Shards! [Total: ${B.resources.iceShards}]`, type: 'ability' });
    }
    if (pg.id === 94) { // Jenkins — Barrage: roll 4 dice for damage
      const jDice = rollDice(4);
      const jDmg = classify(jDice).damage;
      eg.hp = Math.max(0, eg.hp - jDmg);
      B.log.push({ text: `${pg.name} (Barrage): Entry roll [${jDice.join(', ')}] = ${jDmg} damage!`, type: 'ability' });
      if (eg.hp <= 0) { eg.ko = true; }
    }

    // Rascals (437): Stampede — gain 3 Burn on entry
    if (pg.id === 437) {
      B.resources.burn = (B.resources.burn || 0) + 3;
      B.log.push({ text: `${pg.name} (Stampede): Entry — +3 Burn! [Total: ${B.resources.burn}]`, type: 'ability' });
    }
    // Enemy entry
    if (eg.id === 437) { // Rascals — Stampede: gain 3 Burn on entry
      B.log.push({ text: `${eg.name} (Stampede): Entry — gained 3 Burn!`, type: 'ability' });
      B.enemyUsedResource = true;
    }
    if (eg.id === 34) { // Grawr
      pg.hp = Math.max(0, pg.hp - 1);
      B.log.push({ text: `${eg.name} (Menace): Deals 1 damage on entry!`, type: 'damage' });
      if (pg.hp <= 0) { pg.ko = true; }
      B.enemyUsedResource = true;
    }
    if (eg.id === 56) { // Chad
      B.log.push({ text: `${eg.name} (Sploop!): Enemy gained 2 Ice Shards.`, type: 'ability' });
      B.enemyUsedResource = true;
    }
    if (eg.id === 94) { // Jenkins
      const jDice = rollDice(4);
      const jDmg = classify(jDice).damage;
      pg.hp = Math.max(0, pg.hp - jDmg);
      B.log.push({ text: `${eg.name} (Barrage): Entry roll [${jDice.join(', ')}] = ${jDmg} damage!`, type: 'damage' });
      if (pg.hp <= 0) { pg.ko = true; }
    }
    // Nerina (306): Leviathan — 3 damage on entry
    if (pg.id === 306) {
      eg.hp = Math.max(0, eg.hp - 3);
      B.log.push({ text: `${pg.name} (Leviathan): 3 damage on entry!`, type: 'ability' });
      if (eg.hp <= 0) eg.ko = true;
    }
    if (eg.id === 306) {
      pg.hp = Math.max(0, pg.hp - 3);
      B.log.push({ text: `${eg.name} (Leviathan): 3 damage on entry!`, type: 'damage' });
      if (pg.hp <= 0) pg.ko = true;
    }
    // Bouril (201): Slumber — first roll is 1-2-3
    if (pg.id === 201) {
      B.log.push({ text: `${pg.name} (Slumber): First roll is 1-2-3...`, type: 'ability' });
      B.bourilActive = 'player';
    }
    if (eg.id === 201) {
      B.log.push({ text: `${eg.name} (Slumber): First roll is 1-2-3...`, type: 'ability' });
      B.bourilActive = 'enemy';
    }
    // Maximo (302): Nap — first roll is 1 die only
    if (pg.id === 302) {
      B.log.push({ text: `${pg.name} (Nap): First roll is 1 die only...`, type: 'ability' });
      B.maximoActive = 'player';
    }
    if (eg.id === 302) {
      B.log.push({ text: `${eg.name} (Nap): First roll is 1 die only...`, type: 'ability' });
      B.maximoActive = 'enemy';
    }

    // Nicholas (51): Sneak Attack — sideline: deal 2 damage when enemy enters play
    // Cornelius (45): Antidote — negate enemy sideline effects
    {
      const _pCornelius = getSidelineGhosts().some(g => g.id === 45);
      const _eCornelius = getEnemySidelineGhosts().some(g => g.id === 45);
      if (!_eCornelius) {
        const pSide = getSidelineGhosts();
        for (const sg of pSide) {
          if (sg.id === 51 && !eg.ko) {
            eg.hp = Math.max(0, eg.hp - 2);
            B.log.push({ text: `${sg.name} (Sneak Attack): Sideline — deals 2 damage on enemy entry!`, type: 'ability' });
            if (eg.hp <= 0) eg.ko = true;
          }
        }
      }
      if (!_pCornelius) {
        const eSide = getEnemySidelineGhosts();
        for (const sg of eSide) {
          if (sg.id === 51 && !pg.ko) {
            pg.hp = Math.max(0, pg.hp - 2);
            B.log.push({ text: `${sg.name} (Sneak Attack): Sideline — deals 2 damage on your entry!`, type: 'damage' });
            if (pg.hp <= 0) pg.ko = true;
          }
        }
      }
    }
    // Raditz (62): Hunt — on entry, force swap opponent's active ghost
    if (pg.id === 62) {
      const eSide = getEnemySidelineGhosts();
      if (eSide.length > 0 && !eg.ko) {
        const swapTarget = eSide[Math.floor(Math.random() * eSide.length)];
        const swapIdx = B.enemy.ghosts.indexOf(swapTarget);
        if (swapIdx >= 0) {
          B.enemy.activeIdx = swapIdx;
          B.log.push({ text: `${pg.name} (Hunt): Forces ${swapTarget.name} into battle!`, type: 'ability' });
        }
      }
    }
    if (eg.id === 62) {
      const pSide = getSidelineGhosts();
      if (pSide.length > 0 && !pg.ko) {
        const swapTarget = pSide[Math.floor(Math.random() * pSide.length)];
        const swapIdx = B.player.ghosts.indexOf(swapTarget);
        if (swapIdx >= 0) {
          B.player.activeIdx = swapIdx;
          B.log.push({ text: `${eg.name} (Hunt): Forces ${swapTarget.name} into battle!`, type: 'damage' });
        }
      }
    }

    // Redd (98): entry — gain +2 dice this roll
    if (pg.id === 98) {
      B.nextRoundMods.playerExtraDice += 2;
      B.log.push({ text: `${pg.name} (Notorious): Entry — +2 dice this roll!`, type: 'ability' });
    }
    if (eg.id === 98) {
      B.nextRoundMods.enemyExtraDice += 2;
      B.log.push({ text: `${eg.name} (Notorious): Entry — +2 dice this roll!`, type: 'ability' });
    }

    // Dallas (60): Quick Draw — when entering from sideline, steal 1 die for 2 rolls
    if (pg.id === 60) {
      B.dallasStealPlayer = 2;
      B.log.push({ text: `${pg.name} (Quick Draw): Stole 1 enemy die for 2 rolls!`, type: 'ability' });
    }
    if (eg.id === 60) {
      B.dallasStealEnemy = 2;
      B.log.push({ text: `${eg.name} (Quick Draw): Stole 1 of your dice for 2 rolls!`, type: 'ability' });
    }

    // If someone KO'd from entry, check for swap
    if (pg.ko || eg.ko) {
      const koResult = checkKO();
      if (koResult !== 'continue') {
        B.phase = koResult === 'swapping' ? 'ko-swap' : 'over';
        renderBattle();
        return;
      }
    }
  }

  // ── SPLINTER (101): Toxic Fumes — after winning a roll, deal 1 damage before every roll ──
  if (B.splinterActivePlayer && !eg.ko) {
    eg.hp = Math.max(0, eg.hp - 1);
    B.log.push({ text: `Splinter (Toxic Fumes): 1 damage before the roll.`, type: 'ability' });
    if (eg.hp <= 0) { eg.ko = true; const _kr = checkKO(); if (_kr !== 'continue') { B.phase = _kr === 'swapping' ? 'ko-swap' : 'over'; renderBattle(); return; } }
  }
  if (B.splinterActiveEnemy && !pg.ko) {
    pg.hp = Math.max(0, pg.hp - 1);
    B.log.push({ text: `Splinter (Toxic Fumes): 1 damage before the roll.`, type: 'damage' });
    flashHpBar('pHpBar');
    if (pg.hp <= 0) { pg.ko = true; const _pkr = checkKO(); if (_pkr !== 'continue') { B.phase = _pkr === 'swapping' ? 'ko-swap' : 'over'; renderBattle(); return; } }
  }

  // ── MASKED HERO (55): If enemy has pre-roll ability (Shade/Ember Force), deal 3 damage before it triggers ──
  if (pg.id === 55 && (eg.id === 111 || eg.id === 304) && !eg.ko) {
    eg.hp = Math.max(0, eg.hp - 3);
    B.log.push({ text: `${pg.name} (Masked Hero): Intercepts enemy pre-roll ability — 3 damage!`, type: 'ability' });
    if (eg.hp <= 0) { eg.ko = true; const _kr = checkKO(); if (_kr !== 'continue') { B.phase = _kr === 'swapping' ? 'ko-swap' : 'over'; renderBattle(); return; } }
  }
  if (eg.id === 55 && (pg.id === 111 || pg.id === 304) && !pg.ko) {
    pg.hp = Math.max(0, pg.hp - 3);
    B.log.push({ text: `${eg.name} (Masked Hero): Intercepts your pre-roll ability — 3 damage!`, type: 'damage' });
    flashHpBar('pHpBar');
    if (pg.hp <= 0) { pg.ko = true; const _pkr = checkKO(); if (_pkr !== 'continue') { B.phase = _pkr === 'swapping' ? 'ko-swap' : 'over'; renderBattle(); return; } }
  }

  // ── BEFORE-ROLL ABILITIES ──
  // Shade (111) — Haunt: deal 1 damage before roll
  if (pg.id === 111 && !eg.ko) {
    eg.hp = Math.max(0, eg.hp - 1);
    B.log.push({ text: `${pg.name} (Haunt): Opponent takes 1 damage before the roll.`, type: 'ability' });
    if (eg.hp <= 0) { eg.ko = true; const _kr = checkKO(); if (_kr !== 'continue') { B.phase = _kr === 'swapping' ? 'ko-swap' : 'over'; renderBattle(); return; } }
  }
  if (eg.id === 111 && !pg.ko) {
    pg.hp = Math.max(0, pg.hp - 1);
    B.log.push({ text: `${eg.name} (Haunt): You take 1 damage before the roll.`, type: 'damage' });
    flashHpBar('pHpBar');
    B.enemyUsedResource = true;
    if (pg.hp <= 0) { pg.ko = true; const _pkr = checkKO(); if (_pkr !== 'continue') { B.phase = _pkr === 'swapping' ? 'ko-swap' : 'over'; renderBattle(); return; } }
  }
  // Ember Force (304): deal 1 damage before roll
  if (pg.id === 304 && !eg.ko) {
    eg.hp = Math.max(0, eg.hp - 1);
    B.log.push({ text: `${pg.name} (Ember Force): Opponent takes 1 damage before the roll.`, type: 'ability' });
    if (eg.hp <= 0) { eg.ko = true; const _kr = checkKO(); if (_kr !== 'continue') { B.phase = _kr === 'swapping' ? 'ko-swap' : 'over'; renderBattle(); return; } }
  }
  if (eg.id === 304 && !pg.ko) {
    pg.hp = Math.max(0, pg.hp - 1);
    B.log.push({ text: `${eg.name} (Ember Force): You take 1 damage before the roll.`, type: 'damage' });
    flashHpBar('pHpBar');
    B.enemyUsedResource = true;
    if (pg.hp <= 0) { pg.ko = true; const _pkr = checkKO(); if (_pkr !== 'continue') { B.phase = _pkr === 'swapping' ? 'ko-swap' : 'over'; renderBattle(); return; } }
  }

  // Simon (24): Brew Time — when taking before-roll damage, gain 1 Sacred Fire
  if (pg.id === 24 && (eg.id === 111 || eg.id === 304) && !pg.ko) {
    B.resources.sacredFire += 1;
    B.log.push({ text: `${pg.name} (Brew Time): Took pre-roll damage — +1 Sacred Fire! [Total: ${B.resources.sacredFire}]`, type: 'ability' });
  }
  if (eg.id === 24 && (pg.id === 111 || pg.id === 304) && !eg.ko) {
    B.log.push({ text: `${eg.name} (Brew Time): Took pre-roll damage — gained 1 Sacred Fire.`, type: 'ability' });
    B.enemyUsedResource = true;
  }

  // Eloise (85): Change of Heart — spend 1 Ice Shard to swap HP with enemy before rolling
  if (pg.id === 85 && B.resources.iceShards >= 1 && !eg.ko) {
    B.resources.iceShards -= 1;
    const tempHp = pg.hp;
    pg.hp = eg.hp;
    eg.hp = tempHp;
    B.log.push({ text: `${pg.name} (Change of Heart): Spent 1 Ice Shard — swapped HP! [You: ${pg.hp} HP, Enemy: ${eg.hp} HP]`, type: 'ability' });
    if (eg.hp <= 0) { eg.ko = true; const _kr = checkKO(); if (_kr !== 'continue') { B.phase = _kr === 'swapping' ? 'ko-swap' : 'over'; renderBattle(); return; } }
  }
  if (eg.id === 85 && !pg.ko) {
    // Enemy AI always uses it if they can (simulate having 1 shard)
    const tempHp = eg.hp;
    eg.hp = pg.hp;
    pg.hp = tempHp;
    B.log.push({ text: `${eg.name} (Change of Heart): Swapped HP! [You: ${pg.hp} HP, Enemy: ${eg.hp} HP]`, type: 'ability' });
    B.enemyUsedResource = true;
    if (pg.hp <= 0) { pg.ko = true; const _pkr = checkKO(); if (_pkr !== 'continue') { B.phase = _pkr === 'swapping' ? 'ko-swap' : 'over'; renderBattle(); return; } }
  }

  // Timber (210): Howl — opponent loses 1 die this roll
  if (pg.id === 210 && !eg.ko) {
    B.nextRoundMods.enemyExtraDice -= 1;
    B.log.push({ text: `${pg.name} (Howl): Opponent loses 1 die this roll!`, type: 'ability' });
  }
  if (eg.id === 210 && !pg.ko) {
    B.nextRoundMods.playerExtraDice -= 1;
    B.log.push({ text: `${eg.name} (Howl): You lose 1 die this roll!`, type: 'ability' });
    B.enemyUsedResource = true;
  }

  // Piper (107): Slick Coat — negate enemy before-roll effects, -1 enemy die
  if (pg.id === 107) {
    B.nextRoundMods.enemyExtraDice -= 1;
    B.log.push({ text: `${pg.name} (Slick Coat): -1 enemy die next roll!`, type: 'ability' });
  }
  if (eg.id === 107) {
    B.nextRoundMods.playerExtraDice -= 1;
    B.log.push({ text: `${eg.name} (Slick Coat): -1 die for you!`, type: 'ability' });
  }

  // Tyler (105): Heating Up — spend 2 HP to gain +1 die
  if (pg.id === 105 && pg.hp > 2) {
    pg.hp -= 2;
    B.nextRoundMods.playerExtraDice += 1;
    B.log.push({ text: `${pg.name} (Heating Up): Spent 2 HP — +1 die! [HP: ${pg.hp}]`, type: 'ability' });
  }
  if (eg.id === 105 && eg.hp > 2) {
    eg.hp -= 2;
    B.nextRoundMods.enemyExtraDice += 1;
    B.log.push({ text: `${eg.name} (Heating Up): Spent 2 HP — +1 die!`, type: 'ability' });
  }

  // Harrison (315): Ascend — discard Healing Seeds for +1 die each
  if (pg.id === 315 && B.resources.healingSeeds > 0) {
    const seedsSpent = B.resources.healingSeeds;
    B.resources.healingSeeds = 0;
    B.nextRoundMods.playerExtraDice += seedsSpent;
    B.log.push({ text: `${pg.name} (Ascend): Discarded ${seedsSpent} Healing Seeds — +${seedsSpent} dice!`, type: 'ability' });
  }
  if (eg.id === 315) {
    B.nextRoundMods.enemyExtraDice += 1; // simulate enemy having 1 seed
    B.log.push({ text: `${eg.name} (Ascend): Discards seeds — +1 die!`, type: 'ability' });
  }

  // Dallas (60): Quick Draw — steal 1 die for 2 rolls (decrement counter)
  if (B.dallasStealPlayer > 0) {
    B.nextRoundMods.enemyExtraDice -= 1;
    B.nextRoundMods.playerExtraDice += 1;
    B.dallasStealPlayer--;
    B.log.push({ text: `Dallas (Quick Draw): Stolen die active! [${B.dallasStealPlayer} rolls left]`, type: 'ability' });
  }
  if (B.dallasStealEnemy > 0) {
    B.nextRoundMods.playerExtraDice -= 1;
    B.nextRoundMods.enemyExtraDice += 1;
    B.dallasStealEnemy--;
    B.log.push({ text: `Dallas (Quick Draw): Your die stolen! [${B.dallasStealEnemy} rolls left]`, type: 'ability' });
  }

  // Toby (97): Pure Heart — auto-declares the final roll, Toby dies next turn but winning KOs enemy
  if (pg.id === 97 && !pg.tobyDeclared && !pg.ko) {
    pg.tobyDeclared = true;
    pg.tobyDeathRound = B.round + 1;
    B.log.push({ text: `${pg.name} (Pure Heart): Declares the final roll! Win this round to defeat the enemy. Toby will fall next turn.`, type: 'ability' });
  }
  if (eg.id === 97 && !eg.tobyDeclared && !eg.ko) {
    eg.tobyDeclared = true;
    eg.tobyDeathRound = B.round + 1;
    B.log.push({ text: `${eg.name} (Pure Heart): Declares the final roll! Must win or be destroyed.`, type: 'ability' });
  }
  // Toby: check if this is the death round
  if (pg.id === 97 && pg.tobyDeclared && B.round >= pg.tobyDeathRound && !pg.ko) {
    pg.hp = 0; pg.ko = true;
    B.log.push({ text: `${pg.name} (Pure Heart): Toby's sacrifice... he falls.`, type: 'damage' });
    const _tkr = checkKO();
    if (_tkr !== 'continue') { B.phase = _tkr === 'swapping' ? 'ko-swap' : 'over'; renderBattle(); return; }
  }
  if (eg.id === 97 && eg.tobyDeclared && B.round >= eg.tobyDeathRound && !eg.ko) {
    eg.hp = 0; eg.ko = true;
    B.log.push({ text: `${eg.name} (Pure Heart): Toby's sacrifice... he falls.`, type: 'damage' });
    const _tkr = checkKO();
    if (_tkr !== 'continue') { B.phase = _tkr === 'swapping' ? 'ko-swap' : 'over'; renderBattle(); return; }
  }

  // Zork (463): Smolder — discard Burn to gain +1 die per Burn
  if (pg.id === 463 && (B.resources.burn || 0) > 0) {
    const burnSpent = B.resources.burn;
    B.resources.burn = 0;
    B.nextRoundMods.playerExtraDice += burnSpent;
    B.log.push({ text: `${pg.name} (Smolder): Discarded ${burnSpent} Burn — +${burnSpent} dice!`, type: 'ability' });
  }
  if (eg.id === 463) {
    B.nextRoundMods.enemyExtraDice += 1;
    B.log.push({ text: `${eg.name} (Smolder): Discards Burn — +1 die!`, type: 'ability' });
  }

  // Haywire (78): apply permanent dice bonus
  if (pg.id === 78 && (B.haywirePermanentDice || 0) > 0) {
    B.nextRoundMods.playerExtraDice += B.haywirePermanentDice;
  }
  if (eg.id === 78 && (B.haywirePermanentDiceEnemy || 0) > 0) {
    B.nextRoundMods.enemyExtraDice += B.haywirePermanentDiceEnemy;
  }

  // Boo Brothers (17): Teamwork — remove 1 die to gain 1 HP and +1 damage
  if (pg.id === 17 && !pg.ko && (3 + B.nextRoundMods.playerExtraDice) >= 2) {
    B.nextRoundMods.playerExtraDice -= 1;
    const bbHeal = Math.min(1, pg.maxHp - pg.hp);
    pg.hp += bbHeal;
    B.booTeamworkBonus = (B.booTeamworkBonus || 0) + 1;
    B.log.push({ text: `${pg.name} (Teamwork): -1 die, +1 HP, +1 damage this roll!`, type: 'ability' });
  }
  if (eg.id === 17 && !eg.ko && (3 + B.nextRoundMods.enemyExtraDice) >= 2) {
    B.nextRoundMods.enemyExtraDice -= 1;
    const bbHeal = Math.min(1, eg.maxHp - eg.hp);
    eg.hp += bbHeal;
    B.booTeamworkBonusEnemy = (B.booTeamworkBonusEnemy || 0) + 1;
    B.log.push({ text: `${eg.name} (Teamwork): -1 die, +1 HP, +1 damage!`, type: 'ability' });
  }

  // ── COMMITTED RESOURCES: Surge → extra dice ──
  if (B.committed && B.committed.surge) {
    B.nextRoundMods.playerExtraDice += B.committed.surge;
    B.log.push({ text: `Surge committed: +${B.committed.surge} dice!`, type: 'ability' });
  }

  // ── DICE COUNTS (apply nextRoundMods) ──
  SFX.diceRoll();
  let pDiceCount = Math.min(3 + B.nextRoundMods.playerExtraDice, B.nextRoundMods.playerMaxDice);
  let eDiceCount = Math.min(3 + B.nextRoundMods.enemyExtraDice, B.nextRoundMods.enemyMaxDice);
  // Reset mods after applying
  B.nextRoundMods = { playerExtraDice: 0, enemyExtraDice: 0, playerMaxDice: 99, enemyMaxDice: 99 };
  B.damageTakenThisRound = 0;

  // Maximo (302): Nap — first roll is 1 die only
  if (B.maximoActive === 'player') {
    pDiceCount = 1;
    B.maximoActive = null;
  } else if (B.maximoActive === 'enemy') {
    eDiceCount = 1;
    B.maximoActive = null;
  }

  // Ghost Tracker skill: +1 die on first roll
  if (hasSkill('sr_2') && B.round === 1) {
    pDiceCount += 1;
    B.log.push({ text: 'Ghost Tracker: +1 die on first roll!', type: 'ability' });
  }

  // Professor Hawking (447): +2 dice if holding a Moonstone
  if (pg.id === 447 && (B.resources.moonstone || 0) > 0) {
    pDiceCount += 2;
    B.log.push({ text: `${pg.name} (Lunar Study): Holding Moonstone — +2 dice!`, type: 'ability' });
  }
  if (eg.id === 447) {
    eDiceCount += 2;
    B.log.push({ text: `${eg.name} (Lunar Study): Holding Moonstone — +2 dice!`, type: 'ability' });
  }

  // Fredrick (27): opponent may only roll up to 3 dice
  if (pg.id === 27) { eDiceCount = Math.min(eDiceCount, 3); }
  if (eg.id === 27) { pDiceCount = Math.min(pDiceCount, 3); }

  // Antoinette (82): roll as many dice as opponent
  if (pg.id === 82) { pDiceCount = eDiceCount; B.log.push({ text: `${pg.name} (Mirror Roll): Matching opponent's ${eDiceCount} dice!`, type: 'ability' }); }
  if (eg.id === 82) { eDiceCount = pDiceCount; B.log.push({ text: `${eg.name} (Mirror Roll): Matching your ${pDiceCount} dice!`, type: 'ability' }); }

  // Ensure at least 1 die
  pDiceCount = Math.max(1, pDiceCount);
  eDiceCount = Math.max(1, eDiceCount);

  const pDiceEl = document.getElementById('pDice');
  const eDiceEl = document.getElementById('eDice');

  // Clean up any lingering 3D dice from previous roll
  cleanup3dDice('player');
  cleanup3dDice('enemy');

  pDiceEl.innerHTML = Array.from({length: pDiceCount}, () => '<div class="die player rolling">?</div>').join('');
  eDiceEl.innerHTML = Array.from({length: eDiceCount}, () => '<div class="die enemy rolling">?</div>').join('');

  // Launch 3D dice physics (screens > 600px only)
  const _using3d = use3dDice();
  if (_using3d) {
    showRolling3d('player', pDiceCount);
    showRolling3d('enemy', eDiceCount);
  }

  // Disable roll button during animation
  const rollBtn = document.getElementById('btnRoll');
  if (rollBtn) rollBtn.disabled = true;

  // ── ACTUAL ROLL (weighted for low-HP drama) — roll now, reveal theatrically ──
  let pDice = weightedRoll(pg, pDiceCount);
  let eDice = weightedRoll(eg, eDiceCount);

  // Bouril (201): force first roll to 1-2-3
  if (B.bourilActive === 'player') {
    pDice = [1, 2, 3];
    B.bourilActive = null;
  } else if (B.bourilActive === 'enemy') {
    eDice = [1, 2, 3];
    B.bourilActive = null;
  }

  // Tommy Salami (30): rolling a 6 gains +1 die
  if (pg.id === 30) {
    let sixes = pDice.filter(d => d === 6).length;
    while (sixes > 0) {
      const extraDie = rollDie();
      pDice.push(extraDie);
      B.log.push({ text: `${pg.name} (Hot Streak): Rolled a 6 — bonus die [${extraDie}]!`, type: 'ability' });
      sixes = (extraDie === 6) ? 1 : 0;
    }
  }
  if (eg.id === 30) {
    let sixes = eDice.filter(d => d === 6).length;
    while (sixes > 0) {
      const extraDie = rollDie();
      eDice.push(extraDie);
      B.log.push({ text: `${eg.name} (Hot Streak): Rolled a 6 — bonus die [${extraDie}]!`, type: 'ability' });
      sixes = (extraDie === 6) ? 1 : 0;
    }
  }

  // Jeanie (90): Hidden Treasure — force opponent to reroll all dice, once per game
  if (pg.id === 90 && !pg.usedOncePerGame) {
    pg.usedOncePerGame = true;
    eDice = rollDice(eDice.length);
    B.log.push({ text: `${pg.name} (Hidden Treasure): Forced enemy to reroll! New: [${eDice.join(', ')}]`, type: 'ability' });
  }
  if (eg.id === 90 && !eg.usedOncePerGame) {
    eg.usedOncePerGame = true;
    pDice = rollDice(pDice.length);
    B.log.push({ text: `${eg.name} (Hidden Treasure): Forced you to reroll! New: [${pDice.join(', ')}]`, type: 'ability' });
  }

  // ── COMMITTED RESOURCES: Lucky Stone → auto-reroll lowest die ──
  if (B.committed && B.committed.luckyStones) {
    for (let ls = 0; ls < B.committed.luckyStones; ls++) {
      const minIdx = pDice.indexOf(Math.min(...pDice));
      const oldVal = pDice[minIdx];
      pDice[minIdx] = rollDie();
      B.log.push({ text: `Lucky Stone: Rerolled ${oldVal} → ${pDice[minIdx]}!`, type: 'ability' });
    }
    pDice.sort((a, b) => a - b);
  }

  // Jackson (50): Trade 1 HP to reroll lowest die (auto)
  if (pg.id === 50 && pg.hp > 1) {
    pg.hp -= 1;
    const minIdx = pDice.indexOf(Math.min(...pDice));
    const oldVal = pDice[minIdx];
    pDice[minIdx] = rollDie();
    B.log.push({ text: `${pg.name} (Gambler): Traded 1 HP to reroll ${oldVal} → ${pDice[minIdx]}!`, type: 'ability' });
    pDice.sort((a, b) => a - b);
  }
  if (eg.id === 50 && eg.hp > 1) {
    eg.hp -= 1;
    const minIdx = eDice.indexOf(Math.min(...eDice));
    const oldVal = eDice[minIdx];
    eDice[minIdx] = rollDie();
    B.log.push({ text: `${eg.name} (Gambler): Traded 1 HP to reroll ${oldVal} → ${eDice[minIdx]}!`, type: 'ability' });
    eDice.sort((a, b) => a - b);
  }

  // ── COMMITTED RESOURCES: Moonstone → set highest die to 6 ──
  if (B.committed && B.committed.moonstone) {
    for (let ms = 0; ms < B.committed.moonstone; ms++) {
      const maxIdx = pDice.length - 1 - ms;
      if (maxIdx >= 0 && pDice[maxIdx] < 6) {
        const oldVal = pDice[maxIdx];
        pDice[maxIdx] = 6;
        B.log.push({ text: `Moonstone: Set die ${oldVal} → 6!`, type: 'ability' });
      }
    }
    pDice.sort((a, b) => a - b);
  }

  // ── SMUDGE/BLACKOUT (403): Remove dice matching the named number ──
  if (B._smudgeNumberChosen && B._smudgeNumber && pg.id === 403) {
    const named = B._smudgeNumber;
    const removed = eDice.filter(d => d === named).length;
    if (removed > 0) {
      eDice = eDice.filter(d => d !== named);
      if (eDice.length === 0) eDice = [1]; // must have at least 1 die
      B.log.push({ text: `${pg.name} (Blackout): Removed ${removed} enemy die(s) showing ${named}!`, type: 'ability' });
    }
    B._smudgeNumberChosen = false;
    B._smudgeNumber = null;
  }
  if (B._smudgeNumberChosenEnemy && B._smudgeNumberEnemy && eg.id === 403) {
    const named = B._smudgeNumberEnemy;
    const removed = pDice.filter(d => d === named).length;
    if (removed > 0) {
      pDice = pDice.filter(d => d !== named);
      if (pDice.length === 0) pDice = [1]; // must have at least 1 die
      B.log.push({ text: `${eg.name} (Blackout): Removed ${removed} of your dice showing ${named}!`, type: 'damage' });
    }
    B._smudgeNumberChosenEnemy = false;
    B._smudgeNumberEnemy = null;
  }

  // ── SONYA (69): Mesmerize — change one die to a 2 each roll ──
  if (pg.id === 69) {
    const minIdx = pDice.indexOf(Math.min(...pDice));
    if (pDice[minIdx] !== 2) {
      const old = pDice[minIdx];
      pDice[minIdx] = 2;
      pDice.sort((a, b) => a - b);
      B.log.push({ text: `${pg.name} (Mesmerize): Changed ${old} → 2!`, type: 'ability' });
    }
  }
  if (eg.id === 69) {
    const minIdx = eDice.indexOf(Math.min(...eDice));
    if (eDice[minIdx] !== 2) {
      const old = eDice[minIdx];
      eDice[minIdx] = 2;
      eDice.sort((a, b) => a - b);
      B.log.push({ text: `${eg.name} (Mesmerize): Changed ${old} → 2!`, type: 'ability' });
    }
  }

  // ── LITTLE BOO (9): Mercy — enemy triples count as 1-2-3 roll instead ──
  if (pg.id === 9 && eDice.length >= 3) {
    const eCounts = {};
    eDice.forEach(d => eCounts[d] = (eCounts[d] || 0) + 1);
    const eMaxCount = Math.max(...Object.values(eCounts));
    if (eMaxCount >= 3) {
      eDice.length = 0;
      eDice.push(1, 2, 3);
      B.log.push({ text: `${pg.name} (Mercy): Enemy triples downgraded to 1-2-3!`, type: 'ability' });
    }
  }
  if (eg.id === 9 && pDice.length >= 3) {
    const pCounts = {};
    pDice.forEach(d => pCounts[d] = (pCounts[d] || 0) + 1);
    const pMaxCount = Math.max(...Object.values(pCounts));
    if (pMaxCount >= 3) {
      pDice.length = 0;
      pDice.push(1, 2, 3);
      B.log.push({ text: `${eg.name} (Mercy): Your triples downgraded to 1-2-3!`, type: 'damage' });
    }
  }

  // ── STAGED DICE REVEAL ──
  // Animation timing: 3D uses longer physics (1500ms rolling + 750ms settle), flat uses flicker
  const _revealDelay = _using3d ? 2400 : 1200;

  if (_using3d) {
    // 3D DICE PATH: physics roll for 1.5s, then settle to slots showing final values
    setTimeout(() => {
      settleToSlot('player', pDice);
      settleToSlot('enemy', eDice);
      // Also update flat dice underneath for consistency
      pDiceEl.innerHTML = pDice.map(d => `<div class="die player">${d}</div>`).join('');
      eDiceEl.innerHTML = eDice.map(d => `<div class="die enemy">${d}</div>`).join('');
    }, 1500);
  } else {
    // FLAT DICE PATH: original flicker animation for mobile
    // Stage 1: rapid flicker (0–400ms)
    let _flickerInterval = setInterval(() => {
      pDiceEl.innerHTML = pDice.map(() => `<div class="die player rolling">${Math.ceil(Math.random()*6)}</div>`).join('');
      eDiceEl.innerHTML = eDice.map(() => `<div class="die enemy rolling">${Math.ceil(Math.random()*6)}</div>`).join('');
    }, 80);

    // Stage 2: slow down, occasionally flash real values (400ms)
    setTimeout(() => {
      clearInterval(_flickerInterval);
      _flickerInterval = setInterval(() => {
        pDiceEl.innerHTML = pDice.map((d) => `<div class="die player rolling">${Math.random() < 0.3 ? d : Math.ceil(Math.random()*6)}</div>`).join('');
        eDiceEl.innerHTML = eDice.map((d) => `<div class="die enemy rolling">${Math.random() < 0.3 ? d : Math.ceil(Math.random()*6)}</div>`).join('');
      }, 150);
    }, 400);

    // Stage 3: reveal one at a time, left to right (800ms)
    setTimeout(() => {
      clearInterval(_flickerInterval);
      pDiceEl.innerHTML = pDice.map(() => `<div class="die player rolling">${Math.ceil(Math.random()*6)}</div>`).join('');
      eDiceEl.innerHTML = eDice.map(() => `<div class="die enemy rolling">${Math.ceil(Math.random()*6)}</div>`).join('');
      pDice.forEach((d, i) => {
        setTimeout(() => {
          const dice = pDiceEl.querySelectorAll('.die');
          if (dice[i]) { dice[i].textContent = d; dice[i].classList.remove('rolling'); dice[i].classList.add('revealed'); }
        }, i * 120);
      });
      eDice.forEach((d, i) => {
        setTimeout(() => {
          const dice = eDiceEl.querySelectorAll('.die');
          if (dice[i]) { dice[i].textContent = d; dice[i].classList.remove('rolling'); dice[i].classList.add('revealed'); }
        }, i * 120);
      });
    }, 800);
  }

  // Stage 4: all dice revealed — apply committed resources and resolve
  setTimeout(() => {

    B.playerDice = pDice;
    B.enemyDice = eDice;

    let pRoll = classify(pDice);
    let eRoll = classify(eDice);
    let winner = compareRolls(pRoll, eRoll);

    // Hector (96): Protector — singles beat doubles, +1 damage on singles
    if (pg.id === 96 && pRoll.type === 'singles' && eRoll.type === 'doubles') {
      winner = 'a';
      B.log.push({ text: `${pg.name} (Protector): Singles beat doubles!`, type: 'ability' });
    }
    if (eg.id === 96 && eRoll.type === 'singles' && pRoll.type === 'doubles') {
      winner = 'b';
      B.log.push({ text: `${eg.name} (Protector): Singles beat doubles!`, type: 'ability' });
    }

    // Kodako (1): if dice are exactly [1,2,3], negate enemy damage and deal 4
    if (pg.id === 1 && pDice.length === 3 && pDice.slice().sort((a,b)=>a-b).join(',') === '1,2,3') {
      eg.hp = Math.max(0, eg.hp - 4);
      B.log.push({ text: `${pg.name} (Origin Surge): 1-2-3 = negate damage & deal 4!`, type: 'ability' });
      if (eg.hp <= 0) { eg.ko = true; }
      winner = 'kodako';
    }
    if (eg.id === 1 && eDice.length === 3 && eDice.slice().sort((a,b)=>a-b).join(',') === '1,2,3') {
      pg.hp = Math.max(0, pg.hp - 4);
      B.log.push({ text: `${eg.name} (Origin Surge): 1-2-3 = negate damage & deal 4!`, type: 'damage' });
      if (pg.hp <= 0) { pg.ko = true; }
      winner = 'kodako';
    }

    B.log.push({ text: `Round ${B.round}: You rolled [${pDice.join(', ')}] --- ${pRoll.type} (${pRoll.value}'s)`, type: 'ability' });
    B.log.push({ text: `${eg.name} rolled [${eDice.join(', ')}] --- ${eRoll.type} (${eRoll.value}'s)`, type: 'ability' });

    // 3D dice highlighting
    if (_using3d) {
      const pWins = (winner === 'a');
      const eWins = (winner === 'b');
      highlight3dDice('player', pDice, pRoll, pWins);
      highlight3dDice('enemy', eDice, eRoll, eWins);
    }

    // Logey (26): opponent's 5+ dice are unavailable next roll — reduce their dice count
    if (pg.id === 26) {
      const enemyHighDice = eDice.filter(d => d >= 5).length;
      if (enemyHighDice > 0) {
        B.nextRoundMods.enemyExtraDice -= enemyHighDice;
        B.log.push({ text: `${pg.name} (Dream Drain): Enemy rolled ${enemyHighDice} high dice (5+) — they lose ${enemyHighDice} dice next round!`, type: 'ability' });
      }
    }
    if (eg.id === 26) {
      const playerHighDice = pDice.filter(d => d >= 5).length;
      if (playerHighDice > 0) {
        B.nextRoundMods.playerExtraDice -= playerHighDice;
        B.log.push({ text: `${eg.name} (Dream Drain): You rolled ${playerHighDice} high dice (5+) — you lose ${playerHighDice} dice next round!`, type: 'ability' });
      }
    }

    // Dream Cat (28): both roll doubles — player gains +2 dice next turn
    if (pg.id === 28 && pRoll.type === 'doubles' && eRoll.type === 'doubles') {
      B.nextRoundMods.playerExtraDice += 2;
      B.log.push({ text: `${pg.name} (Dream Doubles): Both rolled doubles — +2 dice next round!`, type: 'ability' });
    }
    if (eg.id === 28 && pRoll.type === 'doubles' && eRoll.type === 'doubles') {
      B.nextRoundMods.enemyExtraDice += 2;
      B.log.push({ text: `${eg.name} (Dream Doubles): Both rolled doubles — enemy gains +2 dice next round!`, type: 'ability' });
    }

    // Kaplan (308): Pollinate — when opponent rolls doubles, gain 1 Healing Seed
    if (pg.id === 308 && eRoll.type === 'doubles') {
      B.resources.healingSeeds += 1;
      B.log.push({ text: `${pg.name} (Pollinate): Enemy rolled doubles — +1 Healing Seed! [Total: ${B.resources.healingSeeds}]`, type: 'ability' });
    }
    if (eg.id === 308 && pRoll.type === 'doubles') {
      B.log.push({ text: `${eg.name} (Pollinate): You rolled doubles — enemy gains 1 Healing Seed.`, type: 'ability' });
      B.enemyUsedResource = true;
    }

    // Scallywags (19): Frenzy — if all rolled dice are under 4, gain +1 die next turn
    if (pg.id === 19 && pDice.every(d => d < 4)) {
      B.nextRoundMods.playerExtraDice += 1;
      B.log.push({ text: `${pg.name} (Frenzy): All dice under 4 — +1 die next round!`, type: 'ability' });
    }
    if (eg.id === 19 && eDice.every(d => d < 4)) {
      B.nextRoundMods.enemyExtraDice += 1;
      B.log.push({ text: `${eg.name} (Frenzy): All dice under 4 — +1 die next round!`, type: 'ability' });
    }

    // Floop (20): Muck — enemy loses a die next turn if they roll doubles
    if (pg.id === 20 && eRoll.type === 'doubles') {
      B.nextRoundMods.enemyExtraDice -= 1;
      B.log.push({ text: `${pg.name} (Muck): Enemy rolled doubles — loses 1 die next round!`, type: 'ability' });
    }
    if (eg.id === 20 && pRoll.type === 'doubles') {
      B.nextRoundMods.playerExtraDice -= 1;
      B.log.push({ text: `${eg.name} (Muck): You rolled doubles — lose 1 die next round!`, type: 'ability' });
    }

    if (winner === 'kodako') {
      // Kodako ability already applied damage, skip normal resolution
      B.round++;
      B.phase = 'ready';
      if (rollBtn) rollBtn.disabled = false;
      renderBattle();
    } else if (winner === 'a') {
      let dmg = pRoll.damage;

      // Hunter bonus
      if (G.discipline === 'hunter') dmg += (Math.random() < 0.2 ? 1 : 0);

      // ── WIN BONUS ABILITIES (player) ──
      // Doc (42): +5 on doubles
      if (pg.id === 42 && pRoll.type === 'doubles') {
        dmg += 5;
        B.log.push({ text: `${pg.name} (Savage): +5 damage on doubles!`, type: 'ability' });
      }
      // Sparky (64): 1's add +3 each
      if (pg.id === 64) {
        const ones = pDice.filter(d => d === 1).length;
        if (ones > 0) {
          dmg += ones * 3;
          B.log.push({ text: `${pg.name} (Tinder): ${ones} one(s) = +${ones * 3} damage!`, type: 'ability' });
        }
      }
      // Pelter (86): doubles +2
      if (pg.id === 86 && pRoll.type === 'doubles') {
        dmg += 2;
        B.log.push({ text: `${pg.name} (Snowball): +2 damage on doubles!`, type: 'ability' });
      }
      // Pudge (311): doubles +2 damage, take 1 self-damage
      if (pg.id === 311 && pRoll.type === 'doubles') {
        dmg += 2;
        B.log.push({ text: `${pg.name} (Heavyweight): +2 damage on doubles!`, type: 'ability' });
        pg.hp = Math.max(1, pg.hp - 1);
        B.log.push({ text: `${pg.name} takes 1 self-damage from the effort.`, type: 'damage' });
      }
      // Humar (336): +2 bonus damage on win
      if (pg.id === 336) {
        dmg += 2;
        B.log.push({ text: `${pg.name} (Meteor): +2 damage!`, type: 'ability' });
      }
      // Aunt Susan (309): Harvest Dance — discard 1 Healing Seed for +2 damage; win = +2 Healing Seeds
      if (pg.id === 309) {
        if (B.resources.healingSeeds >= 1) {
          B.resources.healingSeeds -= 1;
          dmg += 2;
          B.log.push({ text: `${pg.name} (Harvest Dance): Spent 1 Healing Seed — +2 damage!`, type: 'ability' });
        }
        B.resources.healingSeeds += 2;
        B.log.push({ text: `${pg.name} (Harvest Dance): Win — +2 Healing Seeds! [Total: ${B.resources.healingSeeds}]`, type: 'ability' });
      }

      // Timpleton (312): Big Target — win: +3 damage if enemy HP > Timpleton HP
      if (pg.id === 312 && eg.hp > pg.hp) {
        dmg += 3;
        B.log.push({ text: `${pg.name} (Big Target): Enemy has more HP — +3 damage!`, type: 'ability' });
      }
      // Greg (49): x2 damage when HP advantage
      if (pg.id === 49 && pg.hp > eg.hp) {
        dmg *= 2;
        B.log.push({ text: `${pg.name} (Bravado): HP advantage — 2X damage!`, type: 'ability' });
      }
      // Jasper (428): Flame Dive — win: roll 1 bonus die for extra damage, take 1 self-damage
      if (pg.id === 428) {
        const bonusDie = rollDie();
        dmg += bonusDie;
        pg.hp = Math.max(1, pg.hp - 1);
        B.log.push({ text: `${pg.name} (Flame Dive): Bonus die [${bonusDie}] = +${bonusDie} damage! Takes 1 self-damage.`, type: 'ability' });
      }
      // Zippa (423): Glimmer — +1 damage per Healing Seed held
      if (pg.id === 423 && B.resources.healingSeeds > 0) {
        const bonus = B.resources.healingSeeds;
        dmg += bonus;
        B.log.push({ text: `${pg.name} (Glimmer): ${bonus} Healing Seeds = +${bonus} damage!`, type: 'ability' });
      }
      // Red Hunter (345): Rumble — win: if opponent has specials, +3 damage
      if (pg.id === 345 && B.enemyUsedResource) {
        dmg += 3;
        B.log.push({ text: `${pg.name} (Rumble): Enemy has specials — +3 damage!`, type: 'ability' });
      }
      // Ashley (58): Burning Soul — win: gain 1 Sacred Fire
      if (pg.id === 58) {
        B.resources.sacredFire += 1;
        B.log.push({ text: `${pg.name} (Burning Soul): +1 Sacred Fire! [Total: ${B.resources.sacredFire}]`, type: 'ability' });
      }
      // Ridley (462): Nimble — singles +1, doubles +2
      if (pg.id === 462) {
        if (pRoll.type === 'doubles') { dmg += 2; B.log.push({ text: `${pg.name} (Nimble): Doubles +2 damage!`, type: 'ability' }); }
        else if (pRoll.type === 'singles') { dmg += 1; B.log.push({ text: `${pg.name} (Nimble): Singles +1 damage!`, type: 'ability' }); }
      }
      // Michael (445): even doubles +2 damage
      if (pg.id === 445 && pRoll.type === 'doubles' && pRoll.value % 2 === 0) {
        dmg += 2;
        B.log.push({ text: `${pg.name} (Torrent): Even doubles — +2 damage!`, type: 'ability' });
      }
      // The Mountain King (110): doubles deal 2X damage
      if (pg.id === 110 && pRoll.type === 'doubles') {
        dmg *= 2;
        B.log.push({ text: `${pg.name} (Beast Mode): Doubles = 2X damage!`, type: 'ability' });
      }
      // Bigsby (424): win: +1 damage
      if (pg.id === 424) {
        dmg += 1;
        B.log.push({ text: `${pg.name} (Omen): +1 damage on win!`, type: 'ability' });
      }
      // Chester (426): Win: +1 Healing Seed. Win with doubles: also +2 Burn
      if (pg.id === 426) {
        B.resources.healingSeeds = (B.resources.healingSeeds || 0) + 1;
        B.log.push({ text: `${pg.name} (Harvest): Win — +1 Healing Seed! [Total: ${B.resources.healingSeeds}]`, type: 'ability' });
        if (pRoll.type === 'doubles') {
          B.resources.burn = (B.resources.burn || 0) + 2;
          B.log.push({ text: `${pg.name} (Harvest): Doubles — +2 Burn! [Total: ${B.resources.burn}]`, type: 'ability' });
        }
      }
      // Ronan (461): doubles: gain +1 Ice Shard & +1 Burn
      if (pg.id === 461 && pRoll.type === 'doubles') {
        B.resources.iceShards += 1;
        B.resources.burn = (B.resources.burn || 0) + 1;
        B.log.push({ text: `${pg.name} (Mixup): Doubles — +1 Ice Shard, +1 Burn!`, type: 'ability' });
      }
      // Hank (207): each 4 rolled = +1 Lucky Stone
      if (pg.id === 207) {
        const fours = pDice.filter(d => d === 4).length;
        if (fours > 0) {
          B.resources.luckyStones = Math.min(5, (B.resources.luckyStones || 0) + fours);
          B.log.push({ text: `${pg.name} (Tremor): ${fours} four(s) = +${fours} Lucky Stones!`, type: 'ability' });
        }
      }

      // Twyla (417): Lucky Dance — each Lucky Stone adds +1 die and gains +1 Healing Seed
      if (pg.id === 417 && (B.resources.luckyStones || 0) > 0) {
        const stones = B.resources.luckyStones;
        B.resources.healingSeeds = (B.resources.healingSeeds || 0) + stones;
        B.log.push({ text: `${pg.name} (Lucky Dance): ${stones} Lucky Stones = +${stones} Healing Seeds! +${stones} dice next roll!`, type: 'ability' });
        B.nextRoundMods.playerExtraDice += stones;
      }
      // Gordok (430): River Terror — win: choose deal damage OR steal 2 specials, +1 die next roll
      if (pg.id === 430) {
        B._gordokChoicePending = true;
        const gordokDmg = dmg;
        showAbilityChoice(`${pg.name} — River Terror`, [
          { label: `⚔️ Deal ${gordokDmg} Damage` },
          { label: '💎 Steal 2 Resources' }
        ], (idx) => {
          if (idx === 0) {
            // Deal normal damage
            eg.hp = Math.max(0, eg.hp - gordokDmg);
            if (eg.hp <= 0) eg.ko = true;
            B.log.push({ text: `${pg.name} (River Terror): Chose damage — dealt ${gordokDmg}!`, type: 'damage' });
            showDmgFloat('enemy', gordokDmg, false);
            spriteHitReact('enemy');
          } else {
            // Steal 2 specials
            B.resources.iceShards += 1;
            B.resources.sacredFire += 1;
            B.log.push({ text: `${pg.name} (River Terror): Stole 2 specials!`, type: 'ability' });
          }
          B.nextRoundMods.playerExtraDice += 1;
          B.log.push({ text: `${pg.name} (River Terror): +1 die next roll!`, type: 'ability' });
          B._gordokChoicePending = false;
          renderBattle();
          // Check KO after Gordok choice
          if (eg.ko) {
            setTimeout(() => {
              const koResult = checkKO();
              if (koResult === 'victory' || koResult === 'defeat') {
                B.phase = 'over';
                renderBattle();
              }
            }, 200);
          }
        });
        // Negate normal damage for Gordok wins — handled inside the choice callback
        dmg = 0;
      }
      // Mable Stadango (446): Hex — win: gain 1 Burn
      if (pg.id === 446) {
        B.resources.burn = (B.resources.burn || 0) + 1;
        B.log.push({ text: `${pg.name} (Hex): Win — +1 Burn! [Total: ${B.resources.burn}]`, type: 'ability' });
        // If placing Burn, remove 1 enemy die next roll
        B.nextRoundMods.enemyExtraDice -= 1;
        B.log.push({ text: `${pg.name} (Hex): Burn placed — enemy loses 1 die next roll!`, type: 'ability' });
      }
      // Roger (54): Tempest — roll 2 pairs of doubles (4+ dice): gain 3 Sacred Fires
      if (pg.id === 54 && pDice.length >= 4) {
        const freq = {};
        pDice.forEach(d => { freq[d] = (freq[d] || 0) + 1; });
        const pairsCount = Object.values(freq).filter(c => c >= 2).length;
        if (pairsCount >= 2) {
          B.resources.sacredFire += 3;
          B.log.push({ text: `${pg.name} (Tempest): 2 pairs of doubles — +3 Sacred Fires! [Total: ${B.resources.sacredFire}]`, type: 'ability' });
        }
      }
      // Rook (416): Charcoal — immune to Sacred Fire/Burn, win: +1 damage per Surge
      if (pg.id === 416 && (B.resources.surge || 0) > 0) {
        const surgeBonus = B.resources.surge;
        dmg += surgeBonus;
        B.log.push({ text: `${pg.name} (Charcoal): ${surgeBonus} Surge = +${surgeBonus} damage!`, type: 'ability' });
        // Boris (343): Fortify — when Surge is spent, Boris gains 2 HP
        const boris = B.player.ghosts.find(g => g.id === 343 && !g.ko);
        if (boris) {
          boris.hp += 2; // can exceed max HP per card text
          B.log.push({ text: `Boris (Fortify): Surge spent — +2 HP! [HP: ${boris.hp}]`, type: 'ability' });
        }
      }
      // Sylvia (313): Porpoise — Ice Shards cost nothing (already free in commit), handled in loss section
      // Calvin & Anna (91): Toboggan — when you defeat a ghost, may switch to sideline ghost (auto in 1v1 = log only)
      if (pg.id === 91 && eg.ko) {
        B.log.push({ text: `${pg.name} (Toboggan): KO! May swap to sideline ghost.`, type: 'ability' });
      }
      // Valkin the Grand (432): Grand Spoils — on KO: gain all resource types
      if (pg.id === 432 && eg.ko) {
        B.resources.sacredFire += 1;
        B.resources.iceShards += 2;
        B.resources.luckyStones = Math.min(5, (B.resources.luckyStones || 0) + 1);
        B.resources.moonstone = (B.resources.moonstone || 0) + 1;
        B.resources.healingSeeds = (B.resources.healingSeeds || 0) + 2;
        B.log.push({ text: `${pg.name} (Grand Spoils): KO! +1 Sacred Fire, +2 Ice Shards, +1 Lucky Stone, +1 Moonstone, +2 Healing Seeds!`, type: 'ability' });
      }
      // Bo (109): Miracle — on KO: return a defeated ghost to sideline, gain 3 Magic Fireflies
      if (pg.id === 109 && eg.ko) {
        const defeated = B.player.ghosts.find(g => g.ko && g !== pg);
        if (defeated) {
          defeated.ko = false;
          defeated.hp = 1;
          B.log.push({ text: `${pg.name} (Miracle): ${defeated.name} returned to sideline with 1 HP!`, type: 'ability' });
        }
        B.resources.magicFireflies = Math.min(5, (B.resources.magicFireflies || 0) + 3);
        B.log.push({ text: `${pg.name} (Miracle): +3 Magic Fireflies! [Total: ${B.resources.magicFireflies}]`, type: 'ability' });
      }
      // Pip (418): Toasted — triples or better: permanently remove 1 enemy die (once per game)
      if (pg.id === 418 && !pg.usedOncePerGame && pRoll.type === 'triples') {
        pg.usedOncePerGame = true;
        B.nextRoundMods.enemyMaxDice -= 1;
        B.log.push({ text: `${pg.name} (Toasted): Triples! Permanently removed 1 enemy die!`, type: 'ability' });
      }

      // Wim (65): Slash — +5 damage when all dice are odd
      if (pg.id === 65 && pDice.every(d => d % 2 === 1)) {
        dmg += 5;
        B.log.push({ text: `${pg.name} (Slash): All dice odd — +5 damage!`, type: 'ability' });
      }

      // Nikon (2): Ambush — win first roll: triple damage
      if (pg.id === 2 && B.round === 1) {
        dmg *= 3;
        B.log.push({ text: `${pg.name} (Ambush): First roll win — TRIPLE damage!`, type: 'ability' });
      }
      // Cave Dweller (46): 3X damage on first roll win
      if (pg.id === 46 && B.round === 1) {
        dmg *= 3;
        B.log.push({ text: `${pg.name} (Cave Strike): First roll win — 3X damage!`, type: 'ability' });
      }
      // Wanderer (4): Curiosity — roll a straight (consecutive, no repeats): +2 damage
      if (pg.id === 4 && isStraight(pDice)) {
        dmg += 2;
        B.log.push({ text: `${pg.name} (Curiosity): Straight [${pDice.join(',')}] — +2 damage!`, type: 'ability' });
      }
      // Dealer (37): Straight — +3 damage and negate incoming damage this round
      if (pg.id === 37 && isStraight(pDice)) {
        dmg += 3;
        B._dealerNegatePlayer = true;
        B.log.push({ text: `${pg.name} (Straight): [${pDice.join(',')}] — +3 damage & negate incoming!`, type: 'ability' });
      }
      // Boo Brothers (17): Teamwork — +1 damage bonus from removing a die
      if (pg.id === 17 && B.booTeamworkBonus > 0) {
        dmg += B.booTeamworkBonus;
        B.log.push({ text: `${pg.name} (Teamwork): +${B.booTeamworkBonus} damage from sacrifice!`, type: 'ability' });
        B.booTeamworkBonus = 0;
      }
      // Larry (35): Flying Kick — triples deal 3X damage
      if (pg.id === 35 && pRoll.type === 'triples') {
        dmg *= 3;
        B.log.push({ text: `${pg.name} (Flying Kick): Triples = 3X damage!`, type: 'ability' });
      }
      // Bill & Bob (36): Below 4 HP: 2X damage
      if (pg.id === 36 && pg.hp < 4) {
        dmg *= 2;
        B.log.push({ text: `${pg.name} (Desperation): Below 4 HP — 2X damage!`, type: 'ability' });
      }
      // Snorton (67): Fissure — +5 damage if 2+ sixes rolled
      if (pg.id === 67 && pDice.filter(d => d === 6).length >= 2) {
        dmg += 5;
        B.log.push({ text: `${pg.name} (Fissure): Two 6's — +5 damage!`, type: 'ability' });
      }
      // Haywire (78): Wild Chords — triples or better: +1 permanent die, +2 permanent damage (once per game)
      if (pg.id === 78 && !pg.usedOncePerGame && (pRoll.type === 'triples' || pRoll.type === 'quads' || pRoll.type === 'penta')) {
        pg.usedOncePerGame = true;
        B.haywirePermanentDice = (B.haywirePermanentDice || 0) + 1;
        B.haywirePermanentDmg = (B.haywirePermanentDmg || 0) + 2;
        B.log.push({ text: `${pg.name} (Wild Chords): ${pRoll.type}! +1 permanent die, +2 permanent damage!`, type: 'ability' });
      }
      if (pg.id === 78 && (B.haywirePermanentDmg || 0) > 0) {
        dmg += B.haywirePermanentDmg;
        B.log.push({ text: `${pg.name} (Wild Chords): Permanent +${B.haywirePermanentDmg} damage!`, type: 'ability' });
      }
      // Hector (96): Protector — +1 damage on singles
      if (pg.id === 96 && pRoll.type === 'singles') {
        dmg += 1;
        B.log.push({ text: `${pg.name} (Protector): +1 damage on singles!`, type: 'ability' });
      }
      // Toby (97): Pure Heart — winning the declared roll defeats the enemy ghost
      if (pg.id === 97 && pg.tobyDeclared) {
        eg.hp = 0; eg.ko = true;
        B.log.push({ text: `${pg.name} (Pure Heart): The declared roll is won — enemy ghost is defeated!`, type: 'ability' });
      }
      // Night Master (103): Bullseye — win with doubles: destroy enemy sideline ghost <4 HP
      if (pg.id === 103 && pRoll.type === 'doubles') {
        const eSide = getEnemySidelineGhosts();
        const target = eSide.find(g => g.hp < 4 && !g.ko);
        if (target) {
          target.hp = 0; target.ko = true;
          B.log.push({ text: `${pg.name} (Bullseye): Doubles — destroyed ${target.name} on enemy sideline!`, type: 'ability' });
        }
      }
      // Lucy (108): Blue Fire — win: gain 1 Sacred Fire
      if (pg.id === 108) {
        B.resources.sacredFire += 1;
        B.log.push({ text: `${pg.name} (Blue Fire): +1 Sacred Fire! [Total: ${B.resources.sacredFire}]`, type: 'ability' });
      }
      // Dark Fang (202): Pressure — win: +1 damage per KO'd ghost
      if (pg.id === 202) {
        const koCount = B.enemy.ghosts.filter(g => g.ko).length;
        if (koCount > 0) {
          dmg += koCount;
          B.log.push({ text: `${pg.name} (Pressure): +${koCount} damage from ${koCount} KO'd ghost(s)!`, type: 'ability' });
        }
      }
      // Boris (343): Fortify — when you spend a Surge: Boris gains 2 HP
      // (Checked in resource spend section — flag set, applied here)
      // Gus (31): Gale Force — win: force opponent swap (in 3v3, auto-swap to next alive)
      if (pg.id === 31) {
        const eSide = getEnemySidelineGhosts();
        if (eSide.length > 0 && !eg.ko) {
          // Force swap: damage goes to the new ghost
          const nextIdx = B.enemy.ghosts.indexOf(eSide[0]);
          if (nextIdx >= 0) {
            B.log.push({ text: `${pg.name} (Gale Force): Forces enemy to swap ghost!`, type: 'ability' });
            // The new ghost takes the damage instead
          }
        }
      }

      // Puff (5) on enemy: enemy doubles/triples -1 damage (only relevant if enemy wins, handled below)

      // ── CORNELIUS (45): Antidote — negate enemy sideline effects ──
      const _enemyHasCornelius = getEnemySidelineGhosts().some(g => g.id === 45);
      const _playerHasCornelius = getSidelineGhosts().some(g => g.id === 45);
      if (_enemyHasCornelius) {
        B.log.push({ text: `Cornelius (Antidote): Your sideline effects negated!`, type: 'damage' });
      }
      if (_playerHasCornelius) {
        B.log.push({ text: `Cornelius (Antidote): Enemy sideline effects negated!`, type: 'ability' });
      }

      // ── SIDELINE BONUS DAMAGE (player team) ──
      if (!_enemyHasCornelius) {
        const sideWin = getSidelineGhosts();
        for (const sg of sideWin) {
          // Dark Jeff (74): sideline — +1 damage to all your rolls
          if (sg.id === 74) {
            dmg += 1;
            B.log.push({ text: `${sg.name} (Cackle): Sideline — +1 damage!`, type: 'ability' });
          }
          // Bilbo (80): sideline — +2 damage on singles
          if (sg.id === 80 && pRoll.type === 'singles') {
            dmg += 2;
            B.log.push({ text: `${sg.name} (Little Buddy): Sideline — singles +2 damage!`, type: 'ability' });
          }
          // Tabitha (95): sideline — +2 damage on doubles
          if (sg.id === 95 && pRoll.type === 'doubles') {
            dmg += 2;
            B.log.push({ text: `${sg.name} (Rally): Sideline — doubles +2 damage!`, type: 'ability' });
          }
          // Bandit Pete (93): sideline — if rolling 2 or fewer dice, +3 damage
          if (sg.id === 93 && pDice.length <= 2) {
            dmg += 3;
            B.log.push({ text: `${sg.name} (sideline): +3 damage (${pDice.length} dice)!`, type: 'ability' });
          }
        }
      }

      // ── SIDELINE BONUS DAMAGE — Pale Nimbus (88): if roll total < 7, +2 damage ──
      if (!_enemyHasCornelius) {
        const sideWin2 = getSidelineGhosts();
        for (const sg of sideWin2) {
          if (sg.id === 88) {
            const rollTotal = pDice.reduce((a,b) => a + b, 0);
            if (rollTotal < 7) {
              dmg += 2;
              B.log.push({ text: `${sg.name} (sideline): Roll total ${rollTotal} < 7 — +2 damage!`, type: 'ability' });
            }
          }
        }
      }

      // Resource damage bonuses — only committed resources are consumed
      if (B.committed && B.committed.iceShards > 0) {
        // Skylar (104): Ice Shards deal 3x instead of 1x (active or sideline)
        const hasSkylar = pg.id === 104 || getSidelineGhosts().some(g => g.id === 104);
        const iceMultiplier = hasSkylar ? 3 : 1;
        const iceDmg = B.committed.iceShards * iceMultiplier;
        dmg += iceDmg;
        B.log.push({ text: `Ice Shards (${B.committed.iceShards}): +${iceDmg} damage!${hasSkylar ? ' (Skylar: 3x!)' : ''}`, type: 'ability' });
      }
      if (B.committed && B.committed.sacredFire > 0) {
        const fireDmg = B.committed.sacredFire * 3;
        dmg += fireDmg;
        B.log.push({ text: `Sacred Fire (${B.committed.sacredFire}): +${fireDmg} damage!`, type: 'ability' });
      }

      // Romy (114): predict a die number, if any die matches, +3 damage
      if (pg.id === 114) {
        const dieCounts = {};
        pDice.forEach(d => { dieCounts[d] = (dieCounts[d] || 0) + 1; });
        const predicted = parseInt(Object.entries(dieCounts).sort((a,b) => b[1] - a[1])[0][0]);
        if (pDice.includes(predicted)) {
          dmg += 3;
          B.log.push({ text: `${pg.name} (Foresight): Predicted ${predicted} — match! +3 damage!`, type: 'ability' });
        }
      }

      // Spirit Breaker skill: +15% damage to ghost-rare+
      if (hasSkill('sr_3') && ['ghost-rare', 'legendary'].includes(eg.rarity)) {
        const bonusDmg = Math.max(1, Math.floor(dmg * 0.15));
        dmg += bonusDmg;
        B.log.push({ text: `Spirit Breaker: +${bonusDmg} damage vs ${eg.rarity}!`, type: 'ability' });
      }

      // Guardian Fairy (99) enemy: Wish — sideline: leap in to take the hit (once per game)
      {
        const egf = getEnemySidelineGhosts().find(g => g.id === 99 && !g.usedOncePerGame);
        if (egf && dmg > 0) {
          egf.usedOncePerGame = true;
          egf.hp = 0;
          egf.ko = true;
          B.log.push({ text: `${egf.name} (Wish): Leaps in from sideline to take the hit! KO'd!`, type: 'ability' });
          dmg = 0;
        }
      }

      // Sky (72) enemy: Elusive — if incoming damage >2, negate and counter-roll 1 die
      if (eg.id === 72 && dmg > 2 && !eg.ko) {
        const counterDie = rollDie();
        pg.hp = Math.max(0, pg.hp - counterDie);
        B.log.push({ text: `${eg.name} (Elusive): Damage >2 negated! Counter-roll [${counterDie}] = ${counterDie} damage back!`, type: 'damage' });
        if (pg.hp <= 0) { pg.ko = true; }
        dmg = 0;
      }

      // Puff (5) enemy: player doubles/triples -1 damage
      if (eg.id === 5 && (pRoll.type === 'doubles' || pRoll.type === 'triples') && pg.id !== 25) {
        dmg = Math.max(0, dmg - 1);
        B.log.push({ text: `${eg.name} (Cute): Your doubles/triples do -1 damage!`, type: 'ability' });
      }

      // ── EQUIPPED GEAR: Weapon bonus damage ──
      const _wpn = getEquippedGear().weapon;
      if (_wpn && _wpn.bonusDamage) {
        dmg += _wpn.bonusDamage;
        B.log.push({ text: `${_wpn.name}: +${_wpn.bonusDamage} damage!`, type: 'ability' });
      }

      // Dealer (37): negate incoming damage if enemy rolled a straight
      if (B._dealerNegateEnemy) {
        B.log.push({ text: `${eg.name} (Straight): Incoming damage negated!`, type: 'ability' });
        dmg = 0;
        B._dealerNegateEnemy = false;
      }

      eg.hp = Math.max(0, eg.hp - dmg);
      if (eg.hp <= 0) eg.ko = true;
      B.log.push({ text: `You deal <strong style="color:#2a2;">${dmg}</strong> damage!`, type: 'damage' });
      showDmgFloat('enemy', dmg, false);
      spriteHitReact('enemy');

      // Check Boss Phase 2 trigger
      if (typeof checkBossPhase2 === 'function') checkBossPhase2();

      // Splinter (101): Toxic Fumes — after winning, deal 1 damage before every roll
      if (pg.id === 101 && !B.splinterActivePlayer) {
        B.splinterActivePlayer = true;
        B.log.push({ text: `${pg.name} (Toxic Fumes): Activated! 1 damage before every roll from now on.`, type: 'ability' });
      }

      // Munch (66): heal 4 HP on KO
      if (pg.id === 66 && eg.ko) {
        const healAmt = Math.min(4, pg.maxHp - pg.hp);
        pg.hp += healAmt;
        if (healAmt > 0) { B.log.push({ text: `${pg.name} (Scraps): Healed ${healAmt} HP from KO!`, type: 'heal' }); showDmgFloat('player', healAmt, true); }
      }

      // Garrick (427): Watchfire — win: KO = gain 1 Sacred Fire
      if (pg.id === 427 && eg.ko) {
        B.resources.sacredFire += 1;
        B.log.push({ text: `${pg.name} (Watchfire): KO! +1 Sacred Fire! [Total: ${B.resources.sacredFire}]`, type: 'ability' });
      }

      // Spockles (81): win = +2 Ice Shards
      if (pg.id === 81) {
        B.resources.iceShards += 2;
        B.log.push({ text: `${pg.name} (Valley Magic): +2 Ice Shards! [Total: ${B.resources.iceShards}]`, type: 'ability' });
      }

      // Opa (48): win = +1 HP (blocked by Dark Fang Pressure)
      if (pg.id === 48 && eg.id !== 202) {
        const healAmt = Math.min(1, pg.maxHp - pg.hp);
        pg.hp += healAmt;
        if (healAmt > 0) B.log.push({ text: `${pg.name} (Rest): +1 HP on win!`, type: 'heal' });
      } else if (pg.id === 48 && eg.id === 202) {
        B.log.push({ text: `${pg.name} (Rest): Healing blocked by ${eg.name}'s Pressure!`, type: 'ability' });
      }

      // Selene (305): Heart of the Hills — roll doubles on win: gain 2 Healing Seeds OR 3 Lucky Stones
      if (pg.id === 305 && pRoll.type === 'doubles') {
        // Interactive choice modal — pause resolution until player picks
        B._seleneChoicePending = true;
        showAbilityChoice(`${pg.name} — Heart of the Hills`, [
          { label: '🌿 2 Healing Seeds' },
          { label: '🪨 3 Lucky Stones' }
        ], (idx) => {
          if (idx === 0) {
            B.resources.healingSeeds = (B.resources.healingSeeds || 0) + 2;
            B.log.push({ text: `${pg.name} (Heart of the Hills): Chose 2 Healing Seeds! [Total: ${B.resources.healingSeeds}]`, type: 'ability' });
          } else {
            B.resources.luckyStones = Math.min(5, (B.resources.luckyStones || 0) + 3);
            B.log.push({ text: `${pg.name} (Heart of the Hills): Chose 3 Lucky Stones! [Total: ${B.resources.luckyStones}]`, type: 'ability' });
          }
          B._seleneChoicePending = false;
          renderBattle();
        });
      }
      if (eg.id === 305 && eRoll.type === 'doubles') {
        B.log.push({ text: `${eg.name} (Heart of the Hills): Doubles — enemy gains resources.`, type: 'ability' });
        B.enemyUsedResource = true;
      }

      // Winston (15): Scheme — win: swap opponent's ghost, +2 dice next roll
      if (pg.id === 15 && !eg.ko) {
        const eSide = getEnemySidelineGhosts();
        if (eSide.length > 0) {
          const swapTarget = eSide[Math.floor(Math.random() * eSide.length)];
          const swapIdx = B.enemy.ghosts.indexOf(swapTarget);
          if (swapIdx >= 0) {
            B.enemy.activeIdx = swapIdx;
            B.log.push({ text: `${pg.name} (Scheme): Swapped enemy to ${swapTarget.name}!`, type: 'ability' });
          }
        }
        B.nextRoundMods.playerExtraDice += 2;
        B.log.push({ text: `${pg.name} (Scheme): +2 dice next roll!`, type: 'ability' });
      }

      // Kairan (68): Let's Dance — roll doubles: +1 die next roll
      if (pg.id === 68 && pRoll.type === 'doubles') {
        B.nextRoundMods.playerExtraDice += 1;
        B.log.push({ text: `${pg.name} (Let's Dance): Doubles — +1 die next roll!`, type: 'ability' });
      }

      // Outlaw (43): roll doubles on win — remove 1 opponent die next turn
      if (pg.id === 43 && pRoll.type === 'doubles') {
        B.nextRoundMods.enemyExtraDice -= 1;
        B.log.push({ text: `${pg.name} (Thief): Doubles! Stealing 1 enemy die next round!`, type: 'ability' });
      }

      // Flora (75): doubles = +2 HP
      if (pg.id === 75 && pRoll.type === 'doubles') {
        const healAmt = Math.min(2, pg.maxHp - pg.hp);
        pg.hp += healAmt;
        if (healAmt > 0) B.log.push({ text: `${pg.name} (Restore): +2 HP from doubles!`, type: 'heal' });
      }

      // Dart (209): win = gain 2 Surge
      if (pg.id === 209) {
        B.resources.surge = Math.min(5, (B.resources.surge || 0) + 2);
        B.log.push({ text: `${pg.name} (Surge): +2 Surge on win! [Total: ${B.resources.surge}]`, type: 'ability' });
      }
      // Zain (206): win = gain 1 Ice Shard
      if (pg.id === 206) {
        B.resources.iceShards += 1;
        B.log.push({ text: `${pg.name} (Frostblade): +1 Ice Shard on win! [Total: ${B.resources.iceShards}]`, type: 'ability' });
      }

      // Cameron (25): if enemy used a resource this round, +1 die next round
      if (pg.id === 25) {
        if (B.enemyUsedResource) {
          B.nextRoundMods.playerExtraDice += 1;
          B.log.push({ text: `${pg.name} (Relentless): Enemy used a special — +1 die next round!`, type: 'ability' });
        }
        // "Damage cannot be negated" — flag checked against Puff
        B.cameronActive = true;
      }

      // ── SIDELINE WIN ABILITIES (player team) ──
      if (!_enemyHasCornelius) {
        const pSideline = getSidelineGhosts();
        for (const sg of pSideline) {
          // Sandwiches (33): sideline — if opponent gains a Special, you gain it too
          if (sg.id === 33 && B.enemyUsedResource) {
            B.resources.iceShards += 1;
            B.log.push({ text: `${sg.name} (sideline): Enemy gained a special — you gain 1 Ice Shard! [Total: ${B.resources.iceShards}]`, type: 'ability' });
          }
          // Gary (92): sideline — each 1 rolled = +2 Ice Shards
          if (sg.id === 92) {
            const ones = countDieVal(pDice, 1);
            if (ones > 0) {
              B.resources.iceShards += ones * 2;
              B.log.push({ text: `${sg.name} (sideline): +${ones * 2} Ice Shards from 1's! [Total: ${B.resources.iceShards}]`, type: 'ability' });
            }
          }
          // Farmer Jeff (314): sideline — each 6 = +1 Healing Seed
          if (sg.id === 314) {
            const sixes = countDieVal(pDice, 6);
            if (sixes > 0) {
              B.resources.healingSeeds += sixes;
              B.log.push({ text: `${sg.name} (sideline): +${sixes} Healing Seed from 6's! [Total: ${B.resources.healingSeeds}]`, type: 'ability' });
            }
          }
          // Villager (11): sideline — +1 HP on winning rolls
          if (sg.id === 11 && !pg.ko && pg.hp < pg.maxHp) {
            pg.hp = Math.min(pg.maxHp, pg.hp + 1);
            B.log.push({ text: `${sg.name} (Hospitality): Sideline — +1 HP on win!`, type: 'heal' });
          }
        }
      }

      // ── ENEMY LOSS DEFENSIVE ABILITIES ──
      // Garrick (427) enemy: lose = take -1 damage
      if (eg.id === 427 && dmg > 0 && !eg.ko) {
        eg.hp = Math.min(eg.maxHp, eg.hp + 1);
        B.log.push({ text: `${eg.name} (Watchfire): Lose — reduced damage by 1!`, type: 'ability' });
      }
      // Sad Sal (29) enemy: lose = gain resources
      if (eg.id === 29 && !eg.ko) {
        B.log.push({ text: `${eg.name} (Tough Job): Gains 1 Ice Shard on loss.`, type: 'ability' });
        B.enemyUsedResource = true;
      }
      // Prince Balatron (113) enemy: lose & survive = counter die
      if (eg.id === 113 && !eg.ko) {
        const counterDie = rollDie();
        pg.hp = Math.max(0, pg.hp - counterDie);
        B.log.push({ text: `${eg.name} (Party Time): Counter die [${counterDie}] = ${counterDie} damage to you!`, type: 'damage' });
        if (pg.hp <= 0) { pg.ko = true; }
      }
      // King Jay (106) enemy: lose & dice total = 7 — reflect damage
      if (eg.id === 106 && !eg.ko) {
        const eSum = eDice.reduce((a, b) => a + b, 0);
        if (eSum === 7) {
          pg.hp = Math.max(0, pg.hp - dmg);
          B.log.push({ text: `${eg.name} (Reflection): Dice total = 7 — reflects ${dmg} damage!`, type: 'damage' });
          if (pg.hp <= 0) { pg.ko = true; }
        }
      }
      // Hugo (52) enemy: Wreckage — opponent loses 1 die when Hugo takes damage
      if (eg.id === 52 && dmg > 0 && !eg.ko) {
        B.nextRoundMods.playerExtraDice -= 1;
        B.log.push({ text: `${eg.name} (Wreckage): Took damage — you lose 1 die next roll!`, type: 'ability' });
      }
      // Marcus (57) enemy: take 3+ damage — gain 4 extra dice next round
      if (eg.id === 57 && !eg.ko && dmg >= 3) {
        B.nextRoundMods.enemyExtraDice += 4;
        B.log.push({ text: `${eg.name} (Glacial Pounding): Took ${dmg} damage — +4 dice next round!`, type: 'ability' });
      }
      // Mirror Matt (410) enemy: if player wins with doubles, reflect damage
      if (eg.id === 410 && pRoll.type === 'doubles' && !eg.ko) {
        eg.hp = Math.min(eg.maxHp, eg.hp + dmg);
        pg.hp = Math.max(0, pg.hp - dmg);
        B.log.push({ text: `${eg.name} (Seven Years): Doubles reflected — ${dmg} damage back at you!`, type: 'damage' });
        if (pg.hp <= 0) { pg.ko = true; }
      }
      // Sylvia (313) enemy: lose: roll 1 die, 5 or 6 negates damage
      if (eg.id === 313 && dmg > 0 && !eg.ko) {
        const saveDie = rollDie();
        if (saveDie >= 5) {
          eg.hp = Math.min(eg.maxHp, eg.hp + dmg);
          B.log.push({ text: `${eg.name} (Porpoise): Save roll [${saveDie}] — negated all damage!`, type: 'ability' });
        } else {
          B.log.push({ text: `${eg.name} (Porpoise): Save roll [${saveDie}] — no save.`, type: 'ability' });
        }
      }
      // Powder (23) enemy: death trigger — this is enemy-side, no resource to give player (just log)
      if (eg.id === 23 && eg.ko) {
        B.log.push({ text: `${eg.name} (Final Gift): Defeated — releases Ice Shards into the wind.`, type: 'ability' });
      }
      // Troubling Haters (83) enemy: deal 4+ damage = gain +2 HP
      if (eg.id === 83 && winner === 'b' && eRoll.damage >= 4 && !eg.ko) {
        const heal83 = Math.min(2, eg.maxHp - eg.hp);
        if (heal83 > 0) { eg.hp += heal83; B.log.push({ text: `${eg.name} (Growing Mob): Big hit — +${heal83} HP!`, type: 'heal' }); }
      }

      SFX.hit();
      battleShake();
      flashHpBar('eHpBar');
      if (eg.ko) B.log.push({ text: `${eg.name} is defeated!`, type: 'damage' });

    } else if (winner === 'b') {
      let dmg = eRoll.damage;

      // Boss Phase 2: +1 damage to all enemy rolls
      if (typeof getBossPhase2DamageBonus === 'function') {
        const phase2Bonus = getBossPhase2DamageBonus();
        if (phase2Bonus > 0) {
          dmg += phase2Bonus;
          B.log.push({ text: `Phase 2: +${phase2Bonus} damage!`, type: 'damage' });
        }
      }

      // ── ENEMY WIN BONUS ABILITIES ──
      // Wim (65) enemy: Slash — +5 damage when all dice are odd
      if (eg.id === 65 && eDice.every(d => d % 2 === 1)) {
        dmg += 5;
        B.log.push({ text: `${eg.name} (Slash): All dice odd — +5 damage!`, type: 'damage' });
      }
      // Nikon (2): Ambush — win first roll: triple damage
      if (eg.id === 2 && B.round === 1) {
        dmg *= 3;
        B.log.push({ text: `${eg.name} (Ambush): First roll win — TRIPLE damage!`, type: 'damage' });
      }
      // Cave Dweller (46): 3X damage on first roll win
      if (eg.id === 46 && B.round === 1) {
        dmg *= 3;
        B.log.push({ text: `${eg.name} (Cave Strike): First roll win — 3X damage!`, type: 'damage' });
      }
      // Wanderer (4): Curiosity — straight: +2 damage
      if (eg.id === 4 && isStraight(eDice)) {
        dmg += 2;
        B.log.push({ text: `${eg.name} (Curiosity): Straight — +2 damage!`, type: 'damage' });
      }
      // Dealer (37): Straight — +3 damage and negate incoming damage
      if (eg.id === 37 && isStraight(eDice)) {
        dmg += 3;
        B._dealerNegateEnemy = true;
        B.log.push({ text: `${eg.name} (Straight): [${eDice.join(',')}] — +3 damage & negate incoming!`, type: 'damage' });
      }
      // Boo Brothers (17): Teamwork — enemy version damage bonus
      if (eg.id === 17 && (B.booTeamworkBonusEnemy || 0) > 0) {
        dmg += B.booTeamworkBonusEnemy;
        B.log.push({ text: `${eg.name} (Teamwork): +${B.booTeamworkBonusEnemy} damage from sacrifice!`, type: 'damage' });
        B.booTeamworkBonusEnemy = 0;
      }
      // Larry (35): Flying Kick — triples = 3X damage
      if (eg.id === 35 && eRoll.type === 'triples') {
        dmg *= 3;
        B.log.push({ text: `${eg.name} (Flying Kick): Triples = 3X damage!`, type: 'damage' });
      }
      // Bill & Bob (36): Below 4 HP: 2X damage
      if (eg.id === 36 && eg.hp < 4) {
        dmg *= 2;
        B.log.push({ text: `${eg.name} (Desperation): Below 4 HP — 2X damage!`, type: 'damage' });
      }
      // Snorton (67): Fissure — +5 damage if 2+ sixes
      if (eg.id === 67 && eDice.filter(d => d === 6).length >= 2) {
        dmg += 5;
        B.log.push({ text: `${eg.name} (Fissure): Two 6's — +5 damage!`, type: 'damage' });
      }
      // Haywire (78): Wild Chords — triples or better: +1 permanent die, +2 permanent damage (once per game)
      if (eg.id === 78 && !eg.usedOncePerGame && (eRoll.type === 'triples' || eRoll.type === 'quads' || eRoll.type === 'penta')) {
        eg.usedOncePerGame = true;
        B.haywirePermanentDiceEnemy = (B.haywirePermanentDiceEnemy || 0) + 1;
        B.haywirePermanentDmgEnemy = (B.haywirePermanentDmgEnemy || 0) + 2;
        B.log.push({ text: `${eg.name} (Wild Chords): ${eRoll.type}! +1 permanent die, +2 permanent damage!`, type: 'damage' });
      }
      if (eg.id === 78 && (B.haywirePermanentDmgEnemy || 0) > 0) {
        dmg += B.haywirePermanentDmgEnemy;
      }
      // Hector (96): +1 damage on singles
      if (eg.id === 96 && eRoll.type === 'singles') {
        dmg += 1;
        B.log.push({ text: `${eg.name} (Protector): +1 damage on singles!`, type: 'damage' });
      }
      // Toby (97): Pure Heart — enemy winning the declared roll defeats your ghost
      if (eg.id === 97 && eg.tobyDeclared) {
        pg.hp = 0; pg.ko = true;
        B.log.push({ text: `${eg.name} (Pure Heart): Declared roll won — your ghost is defeated!`, type: 'damage' });
      }
      // Night Master (103): Bullseye — win with doubles: destroy player sideline ghost <4 HP
      if (eg.id === 103 && eRoll.type === 'doubles') {
        const pSide = getSidelineGhosts();
        const target = pSide.find(g => g.hp < 4 && !g.ko);
        if (target) {
          target.hp = 0; target.ko = true;
          B.log.push({ text: `${eg.name} (Bullseye): Doubles — destroyed ${target.name} on your sideline!`, type: 'damage' });
        }
      }
      // Lucy (108): Blue Fire — enemy win: gain Sacred Fire (logged only)
      if (eg.id === 108) {
        B.log.push({ text: `${eg.name} (Blue Fire): Gains 1 Sacred Fire.`, type: 'ability' });
        B.enemyUsedResource = true;
      }
      // Dark Fang (202): Pressure — win: +1 damage per KO'd ghost
      if (eg.id === 202) {
        const koCount = B.player.ghosts.filter(g => g.ko).length;
        if (koCount > 0) {
          dmg += koCount;
          B.log.push({ text: `${eg.name} (Pressure): +${koCount} damage from ${koCount} KO'd ghost(s)!`, type: 'damage' });
        }
      }
      // Doc (42): Savage — +5 damage on doubles
      if (eg.id === 42 && eRoll.type === 'doubles') {
        dmg += 5;
        B.log.push({ text: `${eg.name} (Savage): +5 damage on doubles!`, type: 'damage' });
      }
      // Sparky (64): Tinder — 1's add +3 each
      if (eg.id === 64) {
        const ones = eDice.filter(d => d === 1).length;
        if (ones > 0) { dmg += ones * 3; B.log.push({ text: `${eg.name} (Tinder): ${ones} one(s) = +${ones * 3} damage!`, type: 'damage' }); }
      }
      // Pelter (86): Snowball — doubles +2
      if (eg.id === 86 && eRoll.type === 'doubles') {
        dmg += 2;
        B.log.push({ text: `${eg.name} (Snowball): +2 damage on doubles!`, type: 'damage' });
      }
      // Pudge (311): Belly Flop — doubles +2, take 1 self-damage
      if (eg.id === 311 && eRoll.type === 'doubles') {
        dmg += 2;
        eg.hp = Math.max(1, eg.hp - 1);
        B.log.push({ text: `${eg.name} (Belly Flop): Doubles +2 damage, takes 1 self-damage!`, type: 'damage' });
      }
      // Humar (336): Meteor — win: +2 damage
      if (eg.id === 336) {
        dmg += 2;
        B.log.push({ text: `${eg.name} (Meteor): +2 damage!`, type: 'damage' });
      }
      // Timpleton (312): Big Target — win: +3 if player HP > Timpleton HP
      if (eg.id === 312 && pg.hp > eg.hp) {
        dmg += 3;
        B.log.push({ text: `${eg.name} (Big Target): Your HP is higher — +3 damage!`, type: 'damage' });
      }
      // Greg (49): x2 damage when HP advantage
      if (eg.id === 49 && eg.hp > pg.hp) {
        dmg *= 2;
        B.log.push({ text: `${eg.name} (Bravado): HP advantage — 2X damage!`, type: 'damage' });
      }
      // Jasper (428): Flame Dive — win: roll 1 bonus die for extra damage, take 1 self-damage
      if (eg.id === 428) {
        const bonusDie = rollDie();
        dmg += bonusDie;
        eg.hp = Math.max(1, eg.hp - 1);
        B.log.push({ text: `${eg.name} (Flame Dive): Bonus die [${bonusDie}] = +${bonusDie} damage! Takes 1 self-damage.`, type: 'damage' });
      }
      // Red Hunter (345): Rumble — win: if opponent has specials, +3 damage
      if (eg.id === 345 && (B.resources.iceShards > 0 || B.resources.sacredFire > 0 || (B.resources.surge || 0) > 0 || (B.resources.healingSeeds || 0) > 0)) {
        dmg += 3;
        B.log.push({ text: `${eg.name} (Rumble): You have specials — +3 damage!`, type: 'damage' });
      }
      // Ashley (58): Burning Soul — win: gain 1 Sacred Fire
      if (eg.id === 58) {
        B.log.push({ text: `${eg.name} (Burning Soul): Gains 1 Sacred Fire.`, type: 'ability' });
        B.enemyUsedResource = true;
      }
      // Ridley (462): Nimble — singles +1, doubles +2
      if (eg.id === 462) {
        if (eRoll.type === 'doubles') { dmg += 2; B.log.push({ text: `${eg.name} (Nimble): Doubles +2 damage!`, type: 'damage' }); }
        else if (eRoll.type === 'singles') { dmg += 1; B.log.push({ text: `${eg.name} (Nimble): Singles +1 damage!`, type: 'damage' }); }
      }
      // Michael (445): Torrent — even doubles +2 damage
      if (eg.id === 445 && eRoll.type === 'doubles' && eRoll.value % 2 === 0) {
        dmg += 2;
        B.log.push({ text: `${eg.name} (Torrent): Even doubles — +2 damage!`, type: 'damage' });
      }
      // The Mountain King (110): Beast Mode — doubles deal 2X damage
      if (eg.id === 110 && eRoll.type === 'doubles') {
        dmg *= 2;
        B.log.push({ text: `${eg.name} (Beast Mode): Doubles = 2X damage!`, type: 'damage' });
      }
      // Bigsby (424): Omen — +1 damage on win
      if (eg.id === 424) {
        dmg += 1;
        B.log.push({ text: `${eg.name} (Omen): +1 damage on win!`, type: 'damage' });
      }
      // Chester (426): Win: +1 Healing Seed. Win with doubles: also +2 Burn
      if (eg.id === 426) {
        B.log.push({ text: `${eg.name} (Harvest): Win — gains 1 Healing Seed.`, type: 'ability' });
        B.enemyUsedResource = true;
        if (eRoll.type === 'doubles') {
          B.log.push({ text: `${eg.name} (Harvest): Doubles — gains 2 Burn.`, type: 'ability' });
        }
      }
      // Ronan (461): Mixup — doubles: gain +1 Ice Shard & +1 Burn
      if (eg.id === 461 && eRoll.type === 'doubles') {
        B.log.push({ text: `${eg.name} (Mixup): Doubles — gains resources.`, type: 'ability' });
        B.enemyUsedResource = true;
      }
      // Hank (207): Tremor — each 4 = +1 Lucky Stone (enemy gains resources)
      if (eg.id === 207) {
        const fours = eDice.filter(d => d === 4).length;
        if (fours > 0) B.log.push({ text: `${eg.name} (Tremor): ${fours} four(s) — gains Lucky Stones.`, type: 'ability' });
      }
      // Gordok (430): River Terror — win: steal 2 specials, +1 die next roll, no normal damage
      if (eg.id === 430) {
        if (B.resources.iceShards > 0) B.resources.iceShards = Math.max(0, B.resources.iceShards - 1);
        if (B.resources.sacredFire > 0) B.resources.sacredFire = Math.max(0, B.resources.sacredFire - 1);
        B.nextRoundMods.enemyExtraDice += 1;
        B.log.push({ text: `${eg.name} (River Terror): Stole 2 specials! +1 die next roll!`, type: 'damage' });
        dmg = 0;
      }
      // Mable Stadango (446): Hex — win: gain 1 Burn, remove 1 player die
      if (eg.id === 446) {
        B.nextRoundMods.playerExtraDice -= 1;
        B.log.push({ text: `${eg.name} (Hex): Burn placed — you lose 1 die next roll!`, type: 'damage' });
      }
      // Roger (54): Tempest — 2 pairs of doubles (4+ dice): gain 3 Sacred Fires
      if (eg.id === 54 && eDice.length >= 4) {
        const freq = {};
        eDice.forEach(d => { freq[d] = (freq[d] || 0) + 1; });
        const pairsCount = Object.values(freq).filter(c => c >= 2).length;
        if (pairsCount >= 2) B.log.push({ text: `${eg.name} (Tempest): 2 pairs — gains 3 Sacred Fires!`, type: 'ability' });
      }
      // Rook (416): Charcoal — immune to Sacred Fire/Burn, win: +1 damage per Surge
      if (eg.id === 416) {
        dmg += 1; // simulate having 1 Surge
        B.log.push({ text: `${eg.name} (Charcoal): Surge boost — +1 damage!`, type: 'damage' });
      }
      // Twyla (417): Lucky Dance — Lucky Stones add dice & Healing Seeds
      if (eg.id === 417) {
        B.nextRoundMods.enemyExtraDice += 1;
        B.log.push({ text: `${eg.name} (Lucky Dance): Lucky Stone — +1 die next roll!`, type: 'ability' });
      }
      // Zippa (423): Glimmer — +1 damage per Healing Seed (simulate 1)
      if (eg.id === 423) {
        dmg += 1;
        B.log.push({ text: `${eg.name} (Glimmer): Healing Seed boost — +1 damage!`, type: 'damage' });
      }
      // Pip (418): Toasted — triples: permanently remove 1 player die (once per game)
      if (eg.id === 418 && !eg.usedOncePerGame && eRoll.type === 'triples') {
        eg.usedOncePerGame = true;
        B.nextRoundMods.playerMaxDice = (B.nextRoundMods.playerMaxDice || 99) - 1;
        B.log.push({ text: `${eg.name} (Toasted): Triples! Permanently removed 1 of your dice!`, type: 'damage' });
      }
      // Romy (114): Foresight — predict a die number, if match +3 damage
      if (eg.id === 114) {
        const dieCounts = {};
        eDice.forEach(d => { dieCounts[d] = (dieCounts[d] || 0) + 1; });
        const predicted = parseInt(Object.entries(dieCounts).sort((a,b) => b[1] - a[1])[0][0]);
        if (eDice.includes(predicted)) {
          dmg += 3;
          B.log.push({ text: `${eg.name} (Foresight): Predicted ${predicted} — match! +3 damage!`, type: 'damage' });
        }
      }
      // Spockles (81): Valley Magic — win: gain 2 Ice Shards
      if (eg.id === 81) {
        B.log.push({ text: `${eg.name} (Valley Magic): Gains 2 Ice Shards.`, type: 'ability' });
        B.enemyUsedResource = true;
      }
      // Opa (48): Rest — win: gain +1 HP
      if (eg.id === 48 && pg.id !== 202) {
        const healAmt = Math.min(1, eg.maxHp - eg.hp);
        eg.hp += healAmt;
        if (healAmt > 0) B.log.push({ text: `${eg.name} (Rest): +1 HP on win!`, type: 'heal' });
      }
      // Munch (66): Scraps — defeating a ghost: gain 4 HP
      if (eg.id === 66 && pg.ko) {
        const healAmt = Math.min(4, eg.maxHp - eg.hp);
        eg.hp += healAmt;
        if (healAmt > 0) B.log.push({ text: `${eg.name} (Scraps): Healed ${healAmt} HP from KO!`, type: 'heal' });
      }
      // Flora (75): Restore — doubles: +2 HP
      if (eg.id === 75 && eRoll.type === 'doubles') {
        const healAmt = Math.min(2, eg.maxHp - eg.hp);
        eg.hp += healAmt;
        if (healAmt > 0) B.log.push({ text: `${eg.name} (Restore): +2 HP from doubles!`, type: 'heal' });
      }
      // Dart (209): Plunder — win: gain 2 Surge
      if (eg.id === 209) {
        B.log.push({ text: `${eg.name} (Plunder): Gains 2 Surge.`, type: 'ability' });
        B.enemyUsedResource = true;
      }
      // Zain (206): Ice Blade — win: gain 1 Ice Shard
      if (eg.id === 206) {
        B.log.push({ text: `${eg.name} (Ice Blade): Gains 1 Ice Shard.`, type: 'ability' });
        B.enemyUsedResource = true;
      }
      // Aunt Susan (309): Harvest Dance — win: +2 damage (simulated seed spend), gains seeds
      if (eg.id === 309) {
        dmg += 2;
        B.log.push({ text: `${eg.name} (Harvest Dance): Spends seed — +2 damage! Gains 2 Healing Seeds.`, type: 'damage' });
        B.enemyUsedResource = true;
      }
      // Garrick (427): Watchfire — win: KO = gain 1 Sacred Fire
      if (eg.id === 427 && pg.ko) {
        B.log.push({ text: `${eg.name} (Watchfire): KO! Gains 1 Sacred Fire.`, type: 'ability' });
        B.enemyUsedResource = true;
      }
      // Gus (31): Gale Force — win: force opponent to swap ghost
      if (eg.id === 31) {
        const pSide = getSidelineGhosts();
        if (pSide.length > 0 && !pg.ko) {
          B.log.push({ text: `${eg.name} (Gale Force): Forces you to swap ghost!`, type: 'damage' });
        }
      }
      // Winston (15) enemy: Scheme — win: swap your ghost, +2 dice next roll
      if (eg.id === 15 && !pg.ko) {
        const pSide = getSidelineGhosts();
        if (pSide.length > 0) {
          const swapTarget = pSide[Math.floor(Math.random() * pSide.length)];
          const swapIdx = B.player.ghosts.indexOf(swapTarget);
          if (swapIdx >= 0) {
            B.player.activeIdx = swapIdx;
            B.log.push({ text: `${eg.name} (Scheme): Swapped your ghost to ${swapTarget.name}!`, type: 'damage' });
          }
        }
        B.nextRoundMods.enemyExtraDice += 2;
        B.log.push({ text: `${eg.name} (Scheme): +2 dice next roll!`, type: 'damage' });
      }
      // Cameron (25): Unstoppable Force — if player used resource, +1 die next round; damage cannot be negated
      if (eg.id === 25) {
        B.nextRoundMods.enemyExtraDice += 1;
        B.log.push({ text: `${eg.name} (Unstoppable Force): +1 die next round!`, type: 'damage' });
      }
      // Valkin the Grand (432): Grand Spoils — on KO: gains all resources
      if (eg.id === 432 && pg.ko) {
        B.log.push({ text: `${eg.name} (Grand Spoils): KO! Gains a bounty of resources!`, type: 'ability' });
        B.enemyUsedResource = true;
      }
      // Bo (109): Miracle — on KO: return a defeated ghost to sideline
      if (eg.id === 109 && pg.ko) {
        const defeated = B.enemy.ghosts.find(g => g.ko && g !== eg);
        if (defeated) {
          defeated.ko = false;
          defeated.hp = 1;
          B.log.push({ text: `${eg.name} (Miracle): ${defeated.name} returned to sideline with 1 HP!`, type: 'ability' });
        }
      }
      // Calvin & Anna (91): Toboggan — on KO may swap
      if (eg.id === 91 && pg.ko) {
        B.log.push({ text: `${eg.name} (Toboggan): KO! May swap to sideline ghost.`, type: 'ability' });
      }
      // Selene (305): Heart of the Hills — doubles on win: gain resources (already has eg impl above)
      // Champ (438): Thrill — +1 Surge when anyone rolls doubles
      if (eg.id === 438 && (pRoll.type === 'doubles' || eRoll.type === 'doubles')) {
        B.log.push({ text: `${eg.name} (Thrill): Doubles spotted — gains Surge.`, type: 'ability' });
        B.enemyUsedResource = true;
      }

      // Splinter (101) enemy: Toxic Fumes — after winning, deal 1 damage before every roll
      if (eg.id === 101 && !B.splinterActiveEnemy) {
        B.splinterActiveEnemy = true;
        B.log.push({ text: `${eg.name} (Toxic Fumes): Activated! 1 damage before every roll from now on.`, type: 'damage' });
      }

      // Puff (5): enemy doubles/triples -1 damage (negated by Cameron's "cannot be negated")
      if (pg.id === 5 && (eRoll.type === 'doubles' || eRoll.type === 'triples') && eg.id !== 25) {
        dmg = Math.max(0, dmg - 1);
        B.log.push({ text: `${pg.name} (Cute): Enemy doubles/triples do -1 damage!`, type: 'ability' });
      }

      // Guardian Fairy (99): Wish — sideline: leap in to take the hit instead (once per game)
      {
        const _pHasCorneliusHere = getSidelineGhosts().some(g => g.id === 45);
        // Guardian Fairy is NOT blocked by enemy Cornelius — it protects your own ghost
        const gf = getSidelineGhosts().find(g => g.id === 99 && !g.usedOncePerGame);
        if (gf && dmg > 0) {
          gf.usedOncePerGame = true;
          gf.hp = 0;
          gf.ko = true;
          B.log.push({ text: `${gf.name} (Wish): Leaps in from sideline to take the hit! KO'd!`, type: 'ability' });
          dmg = 0;
        }
      }

      // Sky (72): Elusive — if incoming damage >2, negate and counter-roll 1 die
      if (pg.id === 72 && dmg > 2 && !pg.ko) {
        const counterDie = rollDie();
        eg.hp = Math.max(0, eg.hp - counterDie);
        B.log.push({ text: `${pg.name} (Elusive): Damage >2 negated! Counter-roll [${counterDie}] = ${counterDie} damage back!`, type: 'ability' });
        if (eg.hp <= 0) { eg.ko = true; B.log.push({ text: `${eg.name} is defeated by counter!`, type: 'damage' }); }
        dmg = 0;
      }

      // ── EQUIPPED GEAR: Armor damage reduction ──
      const _armr = getEquippedGear().armor;
      if (_armr && _armr.damageReduction) {
        const reduced = Math.min(dmg, _armr.damageReduction);
        dmg = Math.max(0, dmg - _armr.damageReduction);
        if (reduced > 0) B.log.push({ text: `${_armr.name}: -${reduced} damage!`, type: 'ability' });
      }

      // Dealer (37): negate incoming damage if straight was rolled
      if (B._dealerNegatePlayer) {
        B.log.push({ text: `Dealer (Straight): Incoming damage negated!`, type: 'ability' });
        dmg = 0;
        B._dealerNegatePlayer = false;
      }

      pg.hp = Math.max(0, pg.hp - dmg);
      B.damageTakenThisRound = dmg;
      if (pg.hp <= 0) pg.ko = true;
      B.log.push({ text: `${eg.name} deals <strong style="color:#c03030;">${dmg}</strong> damage to you!`, type: 'damage' });
      showDmgFloat('player', dmg, false);
      spriteHitReact('player');

      SFX.hit();
      battleShake();
      flashHpBar('pHpBar');

      // Mirror Matt (410): if opponent wins with doubles, reflect damage
      if (pg.id === 410 && eRoll.type === 'doubles' && !pg.ko) {
        // Undo player damage, apply to enemy
        pg.hp = Math.min(pg.maxHp, pg.hp + dmg);
        eg.hp = Math.max(0, eg.hp - dmg);
        B.log.push({ text: `${pg.name} (Seven Years): Doubles reflected — ${dmg} damage back!`, type: 'ability' });
        if (eg.hp <= 0) { eg.ko = true; B.log.push({ text: `${eg.name} is defeated by reflection!`, type: 'damage' }); }
      }
      // Garrick (427): lose = take -1 damage; KO = gain 1 Sacred Fire
      if (pg.id === 427 && dmg > 0 && !pg.ko) {
        pg.hp = Math.min(pg.maxHp, pg.hp + 1); // undo 1 of the damage
        B.log.push({ text: `${pg.name} (Watchfire): Lose — reduced damage by 1!`, type: 'ability' });
      }
      // Sylvia (313): Porpoise — lose: roll 1 die, 5 or 6 negates all damage
      if (pg.id === 313 && dmg > 0 && !pg.ko) {
        const saveDie = rollDie();
        if (saveDie >= 5) {
          pg.hp = Math.min(pg.maxHp, pg.hp + dmg); // undo all damage
          B.log.push({ text: `${pg.name} (Porpoise): Save roll [${saveDie}] — negated all damage!`, type: 'ability' });
        } else {
          B.log.push({ text: `${pg.name} (Porpoise): Save roll [${saveDie}] — no save.`, type: 'ability' });
        }
      }
      // Sad Sal (29): lose = gain 1 Ice Shard
      if (pg.id === 29 && !pg.ko) {
        B.resources.iceShards += 1;
        B.log.push({ text: `${pg.name} (Tough Job): +1 Ice Shard on loss. [Total: ${B.resources.iceShards}]`, type: 'ability' });
      }

      // Prince Balatron (113): lose & survive = counter die
      if (pg.id === 113 && !pg.ko) {
        const counterDie = rollDie();
        const counterDmg = counterDie;
        eg.hp = Math.max(0, eg.hp - counterDmg);
        B.log.push({ text: `${pg.name} (Party Time): Counter die [${counterDie}] = ${counterDmg} damage!`, type: 'ability' });
        if (eg.hp <= 0) { eg.ko = true; B.log.push({ text: `${eg.name} is defeated by counter!`, type: 'damage' }); }
      }

      // Bogey (53): reflect damage once per game (ENEMY)
      if (eg.id === 53 && !eg.usedOncePerGame && !pg.ko) {
        eg.usedOncePerGame = true;
        pg.hp = Math.max(0, pg.hp - dmg);
        eg.hp = Math.min(eg.maxHp, eg.hp + dmg);
        B.log.push({ text: `${eg.name} (Reflector): Reflects ${dmg} damage back!`, type: 'ability' });
        if (pg.hp <= 0) pg.ko = true;
      }
      // Bogey (53): reflect damage once per game (PLAYER)
      if (pg.id === 53 && !pg.usedOncePerGame && !pg.ko && dmg > 0) {
        pg.usedOncePerGame = true;
        eg.hp = Math.max(0, eg.hp - dmg);
        pg.hp = Math.min(pg.maxHp, pg.hp + dmg);
        B.log.push({ text: `${pg.name} (Bogus): Damage reflected! ${dmg} back at ${eg.name}!`, type: 'ability' });
        if (eg.hp <= 0) { eg.ko = true; B.log.push({ text: `${eg.name} is defeated by reflection!`, type: 'damage' }); }
      }

      // Pudge (311): loss on doubles = self-damage
      if (pg.id === 311 && eRoll.type === 'doubles' && !pg.ko) {
        pg.hp = Math.max(0, pg.hp - 1);
        B.log.push({ text: `${pg.name} (Belly Flop): Self-damage from loss!`, type: 'damage' });
        if (pg.hp <= 0) pg.ko = true;
      }

      // Powder (23): death trigger — gain 3 Ice Shards on KO
      if (pg.id === 23 && pg.ko) {
        B.resources.iceShards += 3;
        B.log.push({ text: `${pg.name} (Frost Legacy): +3 Ice Shards on defeat! [Total: ${B.resources.iceShards}]`, type: 'ability' });
      }

      // Granny (310): Sideline — on teammate defeat: singles: +3 Lucky Stones, doubles: +1 Moonstone, triples: +3 Sacred Fire
      if (pg.ko) {
        const _pHasCorneliusGranny = getEnemySidelineGhosts().some(g => g.id === 45);
        if (!_pHasCorneliusGranny) {
          const grannyPlayer = getSidelineGhosts().find(g => g.id === 310 && !g.ko);
          if (grannyPlayer) {
            if (eRoll.type === 'triples') {
              B.resources.sacredFire = (B.resources.sacredFire || 0) + 3;
              B.log.push({ text: `${grannyPlayer.name} (Sideline): Teammate defeated on triples — +3 Sacred Fire! [Total: ${B.resources.sacredFire}]`, type: 'ability' });
            } else if (eRoll.type === 'doubles') {
              B.resources.moonstone = (B.resources.moonstone || 0) + 1;
              B.log.push({ text: `${grannyPlayer.name} (Sideline): Teammate defeated on doubles — +1 Moonstone! [Total: ${B.resources.moonstone}]`, type: 'ability' });
            } else {
              B.resources.luckyStones = Math.min(5, (B.resources.luckyStones || 0) + 3);
              B.log.push({ text: `${grannyPlayer.name} (Sideline): Teammate defeated on singles — +3 Lucky Stones! [Total: ${B.resources.luckyStones}]`, type: 'ability' });
            }
          }
        }
      }
      // Granny (310) enemy: Sideline — on teammate defeat
      if (eg.ko) {
        const _eHasCorneliusGranny = getSidelineGhosts().some(g => g.id === 45);
        if (!_eHasCorneliusGranny) {
          const grannyEnemy = getEnemySidelineGhosts().find(g => g.id === 310 && !g.ko);
          if (grannyEnemy) {
            if (pRoll.type === 'triples') {
              B.log.push({ text: `${grannyEnemy.name} (Sideline): Teammate defeated on triples — gains 3 Sacred Fire.`, type: 'ability' });
            } else if (pRoll.type === 'doubles') {
              B.log.push({ text: `${grannyEnemy.name} (Sideline): Teammate defeated on doubles — gains 1 Moonstone.`, type: 'ability' });
            } else {
              B.log.push({ text: `${grannyEnemy.name} (Sideline): Teammate defeated on singles — gains 3 Lucky Stones.`, type: 'ability' });
            }
            B.enemyUsedResource = true;
          }
        }
      }

      // King Jay (106): lose & dice total = 7 — reflect all damage
      if (pg.id === 106 && !pg.ko) {
        const pSum = pDice.reduce((a, b) => a + b, 0);
        if (pSum === 7) {
          eg.hp = Math.max(0, eg.hp - dmg);
          B.log.push({ text: `${pg.name} (Lucky Seven): Dice total = 7 — reflects ${dmg} damage!`, type: 'ability' });
          if (eg.hp <= 0) { eg.ko = true; B.log.push({ text: `${eg.name} is defeated by reflection!`, type: 'damage' }); }
        }
      }

      // Hugo (52): Wreckage — opponent loses 1 die when Hugo takes roll damage
      if (pg.id === 52 && dmg > 0 && !pg.ko) {
        B.nextRoundMods.enemyExtraDice -= 1;
        B.log.push({ text: `${pg.name} (Wreckage): Took damage — enemy loses 1 die next roll!`, type: 'ability' });
      }

      // Marcus (57): take 3+ damage — gain 4 extra dice next round
      if (pg.id === 57 && !pg.ko && B.damageTakenThisRound >= 3) {
        B.nextRoundMods.playerExtraDice += 4;
        B.log.push({ text: `${pg.name} (Rage): Took ${B.damageTakenThisRound} damage — +4 dice next round!`, type: 'ability' });
      }

      // Kairan (68) enemy: Let's Dance — doubles: +1 die next roll
      if (eg.id === 68 && eRoll.type === 'doubles') {
        B.nextRoundMods.enemyExtraDice += 1;
        B.log.push({ text: `${eg.name} (Let's Dance): Doubles — +1 die next roll!`, type: 'ability' });
      }
      // Outlaw (43): enemy wins with doubles — remove 1 player die next turn
      if (eg.id === 43 && eRoll.type === 'doubles') {
        B.nextRoundMods.playerExtraDice -= 1;
        B.log.push({ text: `${eg.name} (Thief): Doubles! Stealing 1 of your dice next round!`, type: 'ability' });
      }

      // ── ENEMY SIDELINE WIN ABILITIES ──
      {
        const _pHasCorneliusLoss = getSidelineGhosts().some(g => g.id === 45);
        if (_pHasCorneliusLoss) {
          B.log.push({ text: `Cornelius (Antidote): Enemy sideline effects negated!`, type: 'ability' });
        }
        if (!_pHasCorneliusLoss) {
          const eSideWin = getEnemySidelineGhosts();
          for (const sg of eSideWin) {
            // Dark Jeff (74) enemy: sideline — +1 damage to all rolls
            if (sg.id === 74) {
              dmg += 1;
              B.log.push({ text: `${sg.name} (Cackle): Sideline — +1 damage!`, type: 'damage' });
            }
            // Bilbo (80) enemy: sideline — +2 damage on singles
            if (sg.id === 80 && eRoll.type === 'singles') {
              dmg += 2;
              B.log.push({ text: `${sg.name} (Little Buddy): Sideline — singles +2 damage!`, type: 'damage' });
            }
            // Tabitha (95) enemy: sideline — +2 damage on doubles
            if (sg.id === 95 && eRoll.type === 'doubles') {
              dmg += 2;
              B.log.push({ text: `${sg.name} (Rally): Sideline — doubles +2 damage!`, type: 'damage' });
            }
            // Bandit Pete (93): sideline — if rolling 2 or fewer dice, +3 damage
            if (sg.id === 93 && eDice.length <= 2) {
              dmg += 3;
              B.log.push({ text: `${sg.name} (sideline): Enemy rolled ${eDice.length} dice — +3 damage!`, type: 'damage' });
            }
            // Pale Nimbus (88): sideline — if roll total < 7, +2 damage
            if (sg.id === 88) {
              const rollTotal = eDice.reduce((a,b) => a + b, 0);
              if (rollTotal < 7) {
                dmg += 2;
                B.log.push({ text: `${sg.name} (sideline): Roll total ${rollTotal} < 7 — +2 damage!`, type: 'damage' });
              }
            }
            // Sandwiches (33): sideline — if player gains a Special, enemy gains it too
            if (sg.id === 33 && (B.resources.iceShards > 0 || B.resources.sacredFire > 0)) {
              B.log.push({ text: `${sg.name} (sideline): Mirrors your specials.`, type: 'ability' });
            }
            // Gary (92): sideline — each 1 rolled = gain Ice Shards
            if (sg.id === 92) {
              const ones = eDice.filter(d => d === 1).length;
              if (ones > 0) B.log.push({ text: `${sg.name} (sideline): ${ones} one(s) — gains Ice Shards!`, type: 'ability' });
            }
            // Farmer Jeff (314): sideline — each 6 = gain Healing Seed
            if (sg.id === 314) {
              const sixes = eDice.filter(d => d === 6).length;
              if (sixes > 0) B.log.push({ text: `${sg.name} (sideline): ${sixes} six(es) — gains Healing Seeds!`, type: 'ability' });
            }
            // Villager (11) enemy: sideline — +1 HP on winning rolls
            if (sg.id === 11 && !eg.ko && eg.hp < eg.maxHp) {
              eg.hp = Math.min(eg.maxHp, eg.hp + 1);
              B.log.push({ text: `${sg.name} (Hospitality): Sideline — +1 HP on win!`, type: 'heal' });
            }
          }
        }
      }

      if (pg.ko) B.log.push({ text: `${pg.name} is defeated...`, type: 'damage' });

    } else {
      // ── TIE ──
      // Dupy (12): tie = instant KO
      if (pg.id === 12) {
        eg.hp = 0; eg.ko = true;
        B.log.push({ text: `${pg.name} (Frolic): Tie = instant KO!`, type: 'ability' });
      } else if (eg.id === 12) {
        pg.hp = 0; pg.ko = true;
        B.log.push({ text: `${eg.name} (Frolic): Tie = instant KO!`, type: 'damage' });
      } else {
        B.log.push({ text: 'Tie! Re-roll.', type: '' });
      }

      // Opa (48): tie = +1 HP
      if (pg.id === 48 && !pg.ko) {
        const healAmt = Math.min(1, pg.maxHp - pg.hp);
        pg.hp += healAmt;
        if (healAmt > 0) B.log.push({ text: `${pg.name} (Rest): +1 HP on tie!`, type: 'heal' });
      }
      // Opa (48) enemy: tie = +1 HP
      if (eg.id === 48 && !eg.ko) {
        const healAmt = Math.min(1, eg.maxHp - eg.hp);
        eg.hp += healAmt;
        if (healAmt > 0) B.log.push({ text: `${eg.name} (Rest): +1 HP on tie!`, type: 'heal' });
      }
    }

    // ── END-OF-ROUND PASSIVES ──
    // Troubling Haters (83): deal 4+ damage = gain +2 HP
    if (pg.id === 83 && winner === 'a' && pRoll.damage >= 4 && !pg.ko) {
      const heal83 = Math.min(2, pg.maxHp - pg.hp);
      if (heal83 > 0) { pg.hp += heal83; B.log.push({ text: `${pg.name} (Growing Mob): Big hit — +${heal83} HP!`, type: 'heal' }); }
    }
    // Champ (438): gain +1 Surge when anyone rolls doubles
    if (pg.id === 438 && (pRoll.type === 'doubles' || eRoll.type === 'doubles')) {
      B.resources.surge = Math.min(5, (B.resources.surge || 0) + 1);
      B.log.push({ text: `${pg.name} (Thrill): Doubles spotted — +1 Surge! [Total: ${B.resources.surge}]`, type: 'ability' });
    }
    // Maximo (302): gain 1 Healing Seed + 1 Lucky Stone each round
    if (pg.id === 302 && !pg.ko) {
      B.resources.healingSeeds = Math.min(5, (B.resources.healingSeeds || 0) + 1);
      B.resources.luckyStones = Math.min(5, (B.resources.luckyStones || 0) + 1);
      B.log.push({ text: `${pg.name} (Nap): +1 Healing Seed, +1 Lucky Stone`, type: 'ability' });
    }
    // Maximo (302) enemy: gain resources each round
    if (eg.id === 302 && !eg.ko) {
      B.log.push({ text: `${eg.name} (Nap): Gains 1 Healing Seed + 1 Lucky Stone.`, type: 'ability' });
      B.enemyUsedResource = true;
    }
    // Champ (438) enemy: gain Surge on doubles (end-of-round)
    if (eg.id === 438 && (pRoll.type === 'doubles' || eRoll.type === 'doubles') && !eg.ko) {
      B.log.push({ text: `${eg.name} (Thrill): Doubles spotted — gains Surge.`, type: 'ability' });
      B.enemyUsedResource = true;
    }
    // Troubling Haters (83) enemy: deal 4+ damage = gain +2 HP
    if (eg.id === 83 && winner === 'b' && eRoll.damage >= 4 && !eg.ko) {
      const heal83e = Math.min(2, eg.maxHp - eg.hp);
      if (heal83e > 0) { eg.hp += heal83e; B.log.push({ text: `${eg.name} (Growing Mob): Big hit — +${heal83e} HP!`, type: 'heal' }); }
    }
    // Boris (343) enemy: when Surge spent, gains 2 HP
    if (eg.id === 343 && B.enemyUsedResource && !eg.ko) {
      const heal343 = 2;
      eg.hp += heal343;
      B.log.push({ text: `${eg.name} (Fortify): Surge spent — +${heal343} HP! [HP: ${eg.hp}]`, type: 'heal' });
    }
    // Dark Fang (202) enemy: while active, player cannot heal
    // (Handled by checking eg.id === 202 in player heal sections)
    // Skylar (104) enemy: Ice Shards deal +2 (enemy resource boost, logged only)
    if ((eg.id === 104 || getEnemySidelineGhosts().some(g => g.id === 104)) && winner === 'b') {
      B.log.push({ text: `Skylar (Winter Barrage): Enemy Ice Shards deal boosted damage!`, type: 'ability' });
    }

    // ── COMMITTED RESOURCES: Healing Seed → heal active ghost 2 HP each ──
    if (B.committed && B.committed.healingSeeds > 0 && !pg.ko) {
      const healTotal = B.committed.healingSeeds * 2;
      const actualHeal = Math.min(healTotal, pg.maxHp - pg.hp);
      if (actualHeal > 0) {
        pg.hp += actualHeal;
        B.log.push({ text: `Healing Seed (${B.committed.healingSeeds}): Healed ${actualHeal} HP!`, type: 'heal' });
        showDmgFloat('player', actualHeal, true);
      }
    }

    // Clear committed resources after use
    B.committed = {};

    B.round++;
    // Show damage result first, then check for KO swap
    renderBattle();
    setTimeout(() => {
      if (!B) return;
      // Check if any ghost was KO'd this round — handle swap
      if (pg.ko || eg.ko) {
        const koResult = checkKO();
        if (koResult === 'victory' || koResult === 'defeat') {
          B.phase = 'over';
          renderBattle();
          return;
        }
        if (koResult === 'swapping') {
          // Phase is already ko-swap, renderBattle already called by checkKO
          return;
        }
        // 'continue' — swap happened automatically, proceed
      }
      B.phase = 'ready';
      if (rollBtn) rollBtn.disabled = false;
      renderBattle();
    }, 200);
  }, _revealDelay);
}

function fleeBattle() {
  if (!B) return;

  // Clean up 3D dice
  cleanup3dDice('player');
  cleanup3dDice('enemy');

  // Aggressive encounters cost you for fleeing (Wilderness Master skips penalty)
  if (B.isAggressive && !hasSkill('sr_4')) {
    const coinLoss = Math.min(G.coins, 2 + Math.floor(Math.random() * 3));
    G.coins = Math.max(0, G.coins - coinLoss);
    // Take 1 damage to active team member
    const active = G.team.find(g => !g.ko);
    if (active) {
      active.hp = Math.max(1, active.hp - 1);
    }
    B.log.push({ text: `You barely escaped! Lost ${coinLoss} coins and took a hit.`, type: 'damage' });
    notify(`🏃 Escaped! Lost ${coinLoss} coins.`);
  } else if (B.isAggressive && hasSkill('sr_4')) {
    B.log.push({ text: 'Wilderness Master: clean escape!', type: 'ability' });
    notify('🏃 Clean escape! (Wilderness Master)');
  } else {
    B.log.push({ text: 'You fled the battle!', type: '' });
  }

  battleFledThisSession = true;
  // Reset "no flee" quest progress
  if (G.quests?.active) {
    G.quests.active.forEach(q => {
      if (q.type === 'win_no_flee' && !q.completed) q.progress = 0;
    });
  }
  // Sync team HP and save resources back (use ?? to preserve 0 values)
  syncBattleTeamToGameState();
  G.iceShards = B.resources?.iceShards ?? G.iceShards;
  G.sacredFire = B.resources?.sacredFire ?? G.sacredFire;
  G.healingSeeds = B.resources?.healingSeeds ?? G.healingSeeds;
  G.luckyStones = B.resources?.luckyStones ?? G.luckyStones;
  G.surge = B.resources?.surge ?? G.surge;
  G.moonstone = B.resources?.moonstone ?? G.moonstone;
  G.firefly = B.resources?.firefly ?? G.firefly;
  G.inBattle = false;
  B = null;
  document.getElementById('battleOverlay').classList.remove('active', 'visible');
  requestAnimationFrame(render);
  gameLoop();
}

// Sync all battle team HP back to G.team
function syncBattleTeamToGameState() {
  if (!B || !B.player) return;
  for (const bg of B.player.ghosts) {
    const teamIdx = bg._teamIdx !== undefined ? bg._teamIdx : G.team.findIndex(g => g.id === bg.id);
    if (teamIdx >= 0 && G.team[teamIdx]) {
      G.team[teamIdx].hp = bg.hp;
      G.team[teamIdx].ko = bg.ko;
    }
  }
}

function endBattle(won) {
  if (!B) return;

  // Clean up 3D dice
  cleanup3dDice('player');
  cleanup3dDice('enemy');

  // Save resources back (use ?? to preserve 0 values from spent resources)
  G.iceShards = B.resources?.iceShards ?? G.iceShards;
  G.sacredFire = B.resources?.sacredFire ?? G.sacredFire;
  G.healingSeeds = B.resources?.healingSeeds ?? G.healingSeeds;
  G.luckyStones = B.resources?.luckyStones ?? G.luckyStones;
  G.surge = B.resources?.surge ?? G.surge;
  G.moonstone = B.resources?.moonstone ?? G.moonstone;
  G.firefly = B.resources?.firefly ?? G.firefly;

  // Sync ALL player team HP back to G.team
  syncBattleTeamToGameState();

  // Handle world boss battle end
  if (B.isWorldBoss) {
    const bossGhost = activeEnemyGhost();
    const damageDealt = Math.max(0, B.bossStartHp - (bossGhost ? bossGhost.hp : 0));
    if (damageDealt > 0) {
      endWorldBossBattle(damageDealt);
    }

    // Reset Boss Phase 2 state
    if (typeof resetBossPhase2 === 'function') resetBossPhase2();

    document.getElementById('battleTitle').style.color = '';
    G.inBattle = false;
    B = null;
    document.getElementById('battleOverlay').classList.remove('active', 'visible');
    updateHUD();
    saveGame();
    requestAnimationFrame(render);
    gameLoop();
    return;
  }

  // Handle Hostile NPC battle end
  if (B.isHostileNPC && won) {
    const npc = HOSTILE_NPCS.find(n => n.id === B.isHostileNPC);
    if (npc) {
      markHostileNPCDefeated(npc.id);
      notify(npc.defeated);
    }
  }

  // Handle Black Rider battle end — bonus loot
  if (B.isBlackRider && won) {
    G.coins += 50;
    const materials = ['iron_ore', 'volcanic_glass', 'frozen_crystal', 'mask_fragment'];
    const mat = materials[Math.floor(Math.random() * materials.length)];
    if (!G.materials) G.materials = {};
    G.materials[mat] = (G.materials[mat] || 0) + 1;
    notify(`Black Rider defeated! +50 coins, +1 ${mat.replace(/_/g, ' ')}, +1 rare essence`);
  }

  if (won) {
    if (!G.rep) G.rep = { battlesWon:0, craftsCompleted:0, itemsSold:0, essencesCollected:0, raresFound:0 };
    G.rep.battlesWon++;

    // Sideline unlock notification at 5 wins
    if (G.rep.battlesWon === 5) {
      notify('Sideline slots unlocked! You can now bring a team of 3 into battle!');
    }

    checkAndNotifyTitles();

    // XP reward — based on highest rarity enemy defeated
    const bestRarity = B.enemy.ghosts.filter(g => g.ko).reduce((best, g) => {
      const order = { common: 0, uncommon: 1, rare: 2, 'ghost-rare': 3, legendary: 4 };
      return (order[g.rarity] || 0) > (order[best] || 0) ? g.rarity : best;
    }, B.enemyCard?.rarity || 'common');
    const xpGain = { common: 1, uncommon: 2, rare: 3, 'ghost-rare': 4, legendary: 5 }[bestRarity] || 1;
    G.xp += xpGain;

    const xpNeeded = G.level * 3;
    if (G.xp >= xpNeeded) {
      G.level++;
      G.xp -= xpNeeded;
      SFX.levelUp();
      Music.playJingle('levelup');
      notify(`Level Up! You are now level ${G.level}!`);
      G.team.forEach(g => { g.hp = g.maxHp; g.ko = false; });
      showLevelUpCelebration(G.level);
    }

    // Coin reward — bonus for multi-enemy battles
    const enemiesDefeated = B.enemy.ghosts.filter(g => g.ko).length;
    const coinGain = 1 + Math.floor(Math.random() * 3) + (enemiesDefeated > 1 ? enemiesDefeated - 1 : 0);
    G.coins += coinGain;

    const essence = generateEssence(B.enemyCard, B.zoneIdx);
    G.essences.push(essence);

    if (!G.rep) G.rep = { battlesWon:0, craftsCompleted:0, itemsSold:0, essencesCollected:0, raresFound:0 };
    G.rep.essencesCollected++;
    if (['rare','ghost-rare','legendary'].includes(B.enemyCard.rarity)) {
      G.rep.raresFound++;
    }
    checkAndNotifyTitles();

    SFX.victory();
    notify(`+${xpGain} XP, +${coinGain} coins`);

    // Prominent essence reward popup
    showEssenceReward(essence);

    if (G.rep.battlesWon === 1) {
      // First victory — special celebration!
      if (typeof showFirstVictoryPopup === 'function') {
        setTimeout(() => showFirstVictoryPopup(), 800);
      }
      if (typeof spawnVictoryParticles === 'function') {
        setTimeout(() => spawnVictoryParticles(), 200);
      }
    }
    if (G.essences.length === 1) {
      setTimeout(() => notify('Essence stats: Potency, Stability, Resonance, Purity'), 2500);
    }

    checkQuestProgress('battle_won', { rarity: B.enemyCard.rarity });
    checkQuestProgress('essence_collected', essence);
    advanceWeeklyChallenge('battle');
    advanceWeeklyChallenge('essence');

    addProfessionXP('combat', 10);
    addProfessionXP('exploration', 5);
    if (B.enemyCard && ['rare','ghost-rare','legendary'].includes(B.enemyCard.rarity)) {
      addProfessionXP('combat', 10);
      addProfessionXP('exploration', 5);
    }

    advanceOnboarding(2);
    setTimeout(() => advanceOnboarding(3), 3000);

    let recruitChance = G.discipline === 'hunter' ? 0.6 : 0.4;
    if (hasSkill('sr_2')) recruitChance += 0.1;
    if (Math.random() < recruitChance) {
      showRecruitModal(B.enemyCard);
      G.inBattle = false;
      B = null;
      document.getElementById('battleOverlay').classList.remove('active', 'visible');
      updateHUD();
      saveGame();
      return;
    }
  } else {
    if (hasSkill('sr_4')) {
      const nextAlive = G.team.findIndex(g => !g.ko && g.hp > 0);
      if (nextAlive >= 0) G.activeIdx = nextAlive;
    }

    SFX.defeat();
    Music.playJingle('defeat');
    notify('All Spiritkin defeated! Retreating to safety...');

    addProfessionXP('combat', 5);
    addProfessionXP('exploration', 2);

    setTimeout(() => {
      G.x = 16; G.y = 9;
      G.team.forEach(g => { g.hp = Math.max(1, Math.floor(g.maxHp * 0.75)); g.ko = false; });
      notify('Respawned at hub. Your team has been partially healed.');

      const arena2 = document.getElementById('battleArena');
      const bannerEl2 = arena2?.querySelector('.battle-result-banner');
      if (bannerEl2) bannerEl2.remove();
      
      G.inBattle = false;
      B = null;
      document.getElementById('battleOverlay').classList.remove('active', 'visible');
      updateHUD();
      saveGame();
      requestAnimationFrame(render);
      gameLoop();
    }, 2000);
    return;
  }

  // Spawn victory particles on overworld
  if (typeof spawnVictoryParticles === 'function') spawnVictoryParticles();

  // Clean up battle completely
  const arena = document.getElementById('battleArena');
  const bannerEl = arena?.querySelector('.battle-result-banner');
  if (bannerEl) bannerEl.remove();

  G.inBattle = false;
  B = null;
  document.getElementById('battleOverlay').classList.remove('active', 'visible');
  updateHUD();
  saveGame();
  requestAnimationFrame(render);
  gameLoop();
}

