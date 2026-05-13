// WORLD_EVENTS
// World events — random events, world boss
// Extracted from index.html — v7.1.0
// All functions and variables remain global.

// ═══════ RANDOM WORLD EVENTS ═══════
const WORLD_EVENTS = [
  { id: 'essence_rain', name: 'Essence Rain', desc: 'All essences drop with +200 quality bonus!', duration: 300000, effect: 'essenceBonus' },
  { id: 'spirit_surge', name: 'Spirit Surge', desc: 'Encounter rate doubled!', duration: 300000, effect: 'encounterBoost' },
  { id: 'crafters_blessing', name: "Crafter's Blessing", desc: 'All experiment rolls get +20 bonus!', duration: 300000, effect: 'craftBoost' },
  { id: 'peaceful_hour', name: 'Peaceful Hour', desc: 'Roaming enemies stop chasing for 5 minutes.', duration: 300000, effect: 'peace' },
];

function isWorldEventActive(effectName) {
  if (!G.activeWorldEvent) return false;
  if (Date.now() > G.activeWorldEvent.endsAt) { G.activeWorldEvent = null; return false; }
  return effectName ? G.activeWorldEvent.effect === effectName : true;
}

function tryTriggerWorldEvent() {
  if (isWorldEventActive()) return; // already active
  if (Math.random() > 0.2) return; // 20% chance
  const evt = WORLD_EVENTS[Math.floor(Math.random() * WORLD_EVENTS.length)];
  G.activeWorldEvent = { id: evt.id, effect: evt.effect, name: evt.name, desc: evt.desc, endsAt: Date.now() + evt.duration };
  // Dramatic notification
  notify(`WORLD EVENT: ${evt.name} -- ${evt.desc}`);
  updateWorldEventBanner();
}

function updateWorldEventBanner() {
  const banner = document.getElementById('worldEventBanner');
  if (!banner) return;
  if (isWorldEventActive()) {
    const remaining = Math.max(0, Math.ceil((G.activeWorldEvent.endsAt - Date.now()) / 1000));
    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;
    banner.innerHTML = `<span style="color:#ffcc44;font-weight:bold;">${G.activeWorldEvent.name}</span> <span style="color:#aaa;">${G.activeWorldEvent.desc}</span> <span style="color:#888;">(${mins}:${secs < 10 ? '0' : ''}${secs})</span>`;
    banner.style.display = 'block';
  } else {
    banner.style.display = 'none';
  }
}

// World event timer — check every 10 minutes, update banner every second
setInterval(tryTriggerWorldEvent, 600000); // 10 minutes
setInterval(updateWorldEventBanner, 1000); // update countdown

// ═══════ NPC GATHERING QUESTS ═══════

// ═══════ WORLD BOSS SYSTEM ═══════

const BOSS_SCHEMATIC_DROPS = [
  'frostfire_blade', 'golden_dice', 'shades_cape', 'valkins_crystal', 'moonstone_ring'
];

const WORLD_BOSS_POOL = {
  rolling_hills: [
    { cardId: 210, name: 'Timber', title: 'Dances with Wolves', hp: 18, players: '2-3', region: 'rolling_hills' },
    { cardId: 202, name: 'Dark Fang', title: 'The Unseen Predator', hp: 9, players: '1-2', region: 'rolling_hills' },
    { cardId: 428, name: 'Jasper', title: 'The Restless Flame', hp: 18, players: '2', region: 'rolling_hills' },
  ],
  frost_valley: [
    { cardId: 106, name: 'King Jay', title: 'The Frozen Throne', hp: 14, players: '2', region: 'frost_valley' },
    { cardId: 114, name: 'Romy', title: 'Seer of the Frozen Vale', hp: 14, players: '2-4', region: 'frost_valley', requires: 'Blue Flame' },
    { cardId: 110, name: 'The Mountain King', title: 'The Immovable', hp: 30, players: '2-5', region: 'frost_valley' },
  ],
  volcanic_isles: [
    { cardId: 418, name: 'Pip', title: 'The Living Ember', hp: 15, players: '3', region: 'volcanic_isles', requires: 'Ice Scepter' },
    { cardId: 336, name: 'Humar', title: 'Herald of the Meteor', hp: 16, players: '3-5', region: 'volcanic_isles', requires: 'Ice Scepter' },
    { cardId: 306, name: 'Nerina', title: 'Terror of the Depths', hp: 35, players: '2-5', region: 'volcanic_isles' },
  ],
  dark_castle: [
    { cardId: 108, name: 'Lucy', title: 'Warden of the Blue Flame', hp: 16, players: '3', region: 'dark_castle', requires: 'Dark Castle Key' },
    { cardId: 111, name: 'Shade', title: 'The Endless Whisper', hp: 12, players: '3', region: 'dark_castle', requires: 'Dark Castle Key' },
    { cardId: 424, name: 'Bigsby', title: 'The Omen Bearer', hp: 16, players: '1-3', region: 'dark_castle' },
  ],
  dark_spire: [
    { cardId: 432, name: 'Valkin the Grand', title: 'The Corruptor', hp: 25, players: '2-3', region: 'dark_spire', requires: 'Dark Spire Key' },
  ],
};

// Flatten boss pool for lookups by cardId
function getAllWorldBosses() {
  const all = [];
  for (const region of Object.keys(WORLD_BOSS_POOL)) {
    for (const boss of WORLD_BOSS_POOL[region]) all.push(boss);
  }
  return all;
}

function getWorldBossByCardId(cardId) {
  return getAllWorldBosses().find(b => b.cardId === cardId);
}

// Map encounter zones to regions (used for boss spawning)
function getZoneRegion(zone) {
  if (!zone || !zone.name) return 'rolling_hills';
  const n = zone.name.toLowerCase();
  if (n.includes('frost') || n.includes('ice') || n.includes('snow') || n.includes('frozen')) return 'frost_valley';
  if (n.includes('volcan') || n.includes('lava') || n.includes('ember') || n.includes('fire') || n.includes('isle')) return 'volcanic_isles';
  if (n.includes('dark castle') || n.includes('castle') || n.includes('shadow')) return 'dark_castle';
  if (n.includes('spire') || n.includes('dark spire')) return 'dark_spire';
  return 'rolling_hills';
}

let worldBossState = null;
let worldBossListener = null;
let lastBossSpawnCycle = -1;

function getWorldBossCycle() {
  return Math.floor(Date.now() / (1000 * 60 * 300));
}

function getBossForCycle(cycle) {
  // Pick a random region, then a random boss from that region
  const regions = Object.keys(WORLD_BOSS_POOL);
  const region = regions[cycle % regions.length];
  const bosses = WORLD_BOSS_POOL[region];
  const boss = bosses[seededHash(cycle, 31337) % bosses.length];
  return { ...boss, _region: region };
}

function checkWorldBoss() {
  if (!uid) return;
  const currentCycle = getWorldBossCycle();

  // Check if we need to spawn a new boss
  db.ref('overworld/worldboss').once('value').then(snap => {
    const data = snap.val();

    if (data && data.active) {
      // Boss exists — check if expired
      if (Date.now() > data.expiresAt) {
        // Boss expired, despawn
        db.ref('overworld/worldboss').remove();
        worldBossState = null;
        updateWorldBossBar();
        return;
      }
      // Boss is alive and active
      worldBossState = data;
      updateWorldBossBar();
    } else {
      // No active boss — check if this cycle should spawn one
      const cycleHash = seededHash(currentCycle, 77777);
      // Boss spawns every cycle (every 30 min)
      if (lastBossSpawnCycle !== currentCycle) {
        lastBossSpawnCycle = currentCycle;
        spawnWorldBoss(currentCycle);
      }
    }
  });
}

function spawnWorldBoss(cycle) {
  const boss = getBossForCycle(cycle);
  const bossRegion = boss._region || 'rolling_hills';

  // Pick an encounter zone that matches the boss's region
  const regionZones = ENCOUNTER_ZONES
    .map((z, i) => ({ zone: z, idx: i }))
    .filter(({ zone }) => getZoneRegion(zone) === bossRegion);
  // Fallback to any zone if no region match found
  const candidates = regionZones.length > 0 ? regionZones : ENCOUNTER_ZONES.map((z, i) => ({ zone: z, idx: i }));
  const pick = candidates[cycle % candidates.length];
  const zone = pick.zone;
  const zoneIdx = pick.idx;

  const bx = zone.x + Math.floor(zone.w / 2);
  const by = zone.y + Math.floor(zone.h / 2);
  const now = Date.now();

  const bossData = {
    active: true,
    bossId: boss.cardId,
    bossName: boss.name,
    bossTitle: boss.title,
    bossPlayers: boss.players,
    bossRegion: bossRegion,
    maxHp: boss.hp,
    hp: boss.hp,
    zoneIdx: zoneIdx,
    x: bx,
    y: by,
    spawnedAt: now,
    expiresAt: now + 600000, // 10 minutes
    cycle: cycle,
    contributors: {},
  };

  // Only write if no boss currently active (atomic check)
  db.ref('overworld/worldboss').transaction(current => {
    if (current && current.active && Date.now() < (current.expiresAt || 0)) {
      return; // abort — boss already exists
    }
    return bossData;
  }).then(result => {
    if (result.committed) {
      worldBossState = bossData;
      showBossSpawnNotification(boss.name, zone.name, boss.title, boss.players);
      updateWorldBossBar();
    }
  });
}

function showBossSpawnNotification(bossName, zoneName, bossTitle, bossPlayers) {
  return; // REMOVED — boss notifications were distracting
}

function updateWorldBossBar() {
  const bar = document.getElementById('worldBossBar');
  if (!bar || !worldBossState || !worldBossState.active) {
    if (bar) bar.style.display = 'none';
    return;
  }

  return; // BOSS UI REMOVED — bar.style.display = 'block'; clearTimeout(window._bossBarHide); window._bossBarHide = setTimeout(() => { bar.style.opacity = '0'; setTimeout(() => { if (bar.style.opacity === '0') bar.style.display = 'none'; }, 600); }, 6000);
  const titleStr = worldBossState.bossTitle ? `${worldBossState.bossName} — ${worldBossState.bossTitle}` : worldBossState.bossName;
  const playersStr = worldBossState.bossPlayers ? ` | Party: ${worldBossState.bossPlayers}` : '';
  document.getElementById('bossBarName').textContent = titleStr;

  const hpPct = Math.max(0, (worldBossState.hp / worldBossState.maxHp) * 100);
  document.getElementById('bossBarHp').style.width = hpPct + '%';

  const contribCount = worldBossState.contributors ? Object.keys(worldBossState.contributors).length : 0;
  document.getElementById('bossBarInfo').textContent = `HP: ${Math.max(0, worldBossState.hp)} / ${worldBossState.maxHp} | Contributors: ${contribCount}${playersStr}`;

  const remaining = Math.max(0, worldBossState.expiresAt - Date.now());
  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);
  document.getElementById('bossBarTimer').textContent = `Time remaining: ${mins}:${secs.toString().padStart(2, '0')}`;
}

function focusWorldBoss() {
  // Scroll map toward boss location (just notify direction)
  if (!worldBossState) return;
  const zone = ENCOUNTER_ZONES[worldBossState.zoneIdx];
  if (zone) {
    const focusLabel = worldBossState.bossTitle ? `${worldBossState.bossName} — ${worldBossState.bossTitle}` : worldBossState.bossName;
    notify(`${focusLabel} is in ${zone.name}! Head there to fight!`);
  }
}

function startWorldBossListener() {
  if (window._useLocalStorage) return;
  if (worldBossListener) return;
  worldBossListener = db.ref('overworld/worldboss');
  worldBossListener.on('value', snap => {
    const data = snap.val();
    if (data && data.active) {
      const wasNull = !worldBossState || !worldBossState.active;
      const justDefeated = worldBossState && worldBossState.active && data.hp <= 0;

      worldBossState = data;

      // Check if boss was just defeated
      if (data.hp <= 0) {
        onWorldBossDefeated();
        return;
      }

      // Show spawn notification if this is new to us
      if (wasNull) {
        const zone = ENCOUNTER_ZONES[data.zoneIdx];
        showBossSpawnNotification(data.bossName, zone ? zone.name : 'the wilds', data.bossTitle, data.bossPlayers);
      }

      updateWorldBossBar();
    } else {
      worldBossState = null;
      updateWorldBossBar();
    }
  });
}

function engageWorldBoss() {
  if (!worldBossState || !worldBossState.active || worldBossState.hp <= 0) return;
  if (G.inBattle || G.team.length === 0) return;

  // Check proximity to boss
  const dist = Math.sqrt((G.x - worldBossState.x) ** 2 + (G.y - worldBossState.y) ** 2);
  if (dist > 4) {
    notify('Get closer to the World Boss to engage!');
    return;
  }

  SFX.encounterStart();
  G.inBattle = true;

  // Build player team (up to 3)
  const playerGhosts = buildPlayerBattleTeam();

  // Boss card data — use the new region-based roster
  const bossEntry = getWorldBossByCardId(worldBossState.bossId) || getAllWorldBosses()[0];
  const bossCard = getCard(bossEntry.cardId) || {
    id: bossEntry.cardId, name: bossEntry.name, rarity: 'legendary',
    maxHp: bossEntry.hp, ability: 'World Boss', desc: 'A mighty spirit that requires many wardens to defeat.',
  };

  // Boss engagement HP = use the roster HP directly (matches raid mode)
  const engagementHp = Math.min(worldBossState.hp, bossEntry.hp);

  const bossGhost = {
    id: bossCard.id, name: bossCard.name, hp: engagementHp, maxHp: engagementHp,
    ko: false, ability: bossCard.ability, abilityDesc: bossCard.desc, rarity: 'legendary',
    usedOncePerGame: false, entryFired: false
  };

  B = {
    round: 1,
    player: {
      ghosts: playerGhosts,
      activeIdx: 0,
      resources: { iceShards: 0, sacredFire: 0, healingSeeds: 0, luckyStones: 0, surge: 0, moonstone: 0, firefly: 0 },
    },
    enemy: {
      ghosts: [bossGhost],
      activeIdx: 0,
      resources: { iceShards: 0, sacredFire: 0, healingSeeds: 0, luckyStones: 0, surge: 0, moonstone: 0, firefly: 0 },
    },
    enemyCard: bossCard,
    enemyCards: [bossCard],
    log: [],
    phase: 'ready',
    playerDice: [],
    enemyDice: [],
    entryFired: false,
    resources: { iceShards: 0, sacredFire: 0, healingSeeds: 0, luckyStones: 0, surge: 0, moonstone: 0, firefly: 0 },
    zoneIdx: worldBossState.zoneIdx,
    isWorldBoss: true,
    bossStartHp: engagementHp,
    nextRoundMods: { playerExtraDice: 0, enemyExtraDice: 0, playerMaxDice: 99, enemyMaxDice: 99 },
    enemyUsedResource: false,
    damageTakenThisRound: 0,
    koSwapTeam: null,
  };

  applyAccessoryBattleEffects();

  showBattleOverlay();
  const bossDisplayTitle = bossEntry.title ? `${bossCard.name} — ${bossEntry.title}` : bossCard.name;
  document.getElementById('battleTitle').textContent = `WORLD BOSS: ${bossDisplayTitle}`;
  document.getElementById('battleTitle').style.color = '#ff4444';

  renderBattle();
  const playersHint = bossEntry.players ? ` (Party: ${bossEntry.players})` : '';
  notify(`Engaging World Boss: ${bossDisplayTitle}!${playersHint}`);
}

function endWorldBossBattle(damageDealt) {
  if (!worldBossState || !uid) return;

  // Report damage to Firebase
  const updates = {};
  updates[`contributors/${uid}`] = {
    name: G.name,
    damage: (worldBossState.contributors?.[uid]?.damage || 0) + damageDealt,
  };

  // Decrement boss HP
  db.ref('overworld/worldboss').transaction(current => {
    if (!current || !current.active) return current;
    current.hp = Math.max(0, current.hp - damageDealt);
    if (!current.contributors) current.contributors = {};
    current.contributors[uid] = {
      name: G.name,
      damage: (current.contributors[uid]?.damage || 0) + damageDealt,
    };
    return current;
  });

  notify(`Dealt ${damageDealt} damage to ${worldBossState.bossName}!`);
}

function onWorldBossDefeated() {
  if (!worldBossState) return;

  const contributors = worldBossState.contributors || {};
  const myContribution = contributors[uid];

  if (myContribution) {
    // Find top contributor
    let topName = '';
    let topDmg = 0;
    for (const [cuid, c] of Object.entries(contributors)) {
      if (c.damage > topDmg) { topDmg = c.damage; topName = c.name; }
    }

    // Rewards proportional to damage
    const totalDmg = Object.values(contributors).reduce((s, c) => s + (c.damage || 0), 0);
    const myPct = totalDmg > 0 ? myContribution.damage / totalDmg : 0;
    const coinReward = Math.max(5, Math.floor(myPct * 50));
    const xpReward = Math.max(2, Math.floor(myPct * 10));

    G.coins += coinReward;
    G.xp += xpReward;

    // Boss Slayer title for top contributor
    if (uid === Object.entries(contributors).sort((a,b) => b[1].damage - a[1].damage)[0]?.[0]) {
      if (!G.titles.includes('Boss Slayer')) {
        G.titles.push('Boss Slayer');
        notify('Title earned: Boss Slayer!');
      }
    }

    // Rare essence drop
    const bossEntry = getWorldBossByCardId(worldBossState.bossId);
    if (bossEntry) {
      const bossCard = getCard(bossEntry.cardId) || { id: bossEntry.cardId, name: bossEntry.name, rarity: 'legendary' };
      const essence = generateEssence(bossCard, worldBossState.zoneIdx);
      G.essences.push(essence);
      notify(`World Boss defeated! +${coinReward} coins, +${xpReward} XP, +1 ${essence.name}`);
    } else {
      notify(`World Boss defeated! +${coinReward} coins, +${xpReward} XP`);
    }

    // Rare schematic drop chance — top contributor: 20%, others: 5%
    const sortedContributors = Object.entries(contributors).sort((a,b) => b[1].damage - a[1].damage);
    const isTopContributor = sortedContributors[0]?.[0] === uid;
    const schematicDropChance = isTopContributor ? 0.20 : 0.05;
    if (Math.random() < schematicDropChance) {
      if (!G.learnedSchematics) G.learnedSchematics = [];
      // Pick a random schematic the player hasn't learned yet
      const unlearned = BOSS_SCHEMATIC_DROPS.filter(s => !G.learnedSchematics.includes(s));
      if (unlearned.length > 0) {
        const drop = unlearned[Math.floor(Math.random() * unlearned.length)];
        G.learnedSchematics.push(drop);
        const dropName = drop.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        notify(`RARE SCHEMATIC DROP: ${dropName}! Check your crafting menu.`);
        addChatMessage('system', `${G.name} found a rare schematic: ${dropName}!`);
      }
    }

    // Level up check
    const xpNeeded = G.level * 3;
    if (G.xp >= xpNeeded) {
      G.level++;
      G.xp -= xpNeeded;
      SFX.levelUp();
      notify(`Level Up! You are now level ${G.level}!`);
      G.team.forEach(g => { g.hp = g.maxHp; g.ko = false; });
    }

    // Chat announcement
    const topEntry = Object.entries(contributors).sort((a,b) => b[1].damage - a[1].damage)[0];
    if (topEntry) {
      addChatMessage('system', `${worldBossState.bossName} has been defeated! ${topEntry[1].name} dealt the finishing blow!`);
    }

    saveGame();
    updateHUD();
  }

  // Clean up boss from Firebase
  db.ref('overworld/worldboss').remove();
  worldBossState = null;
  updateWorldBossBar();
}

// Render the world boss on the map
function renderWorldBoss(ctx, camX, camY, time) {
  if (!worldBossState || !worldBossState.active || worldBossState.hp <= 0) return;

  const bx = worldBossState.x * TILE - camX;
  const by = worldBossState.y * TILE - camY;

  // Skip if off screen
  if (bx < -100 || bx > canvas.width + 100 || by < -100 || by > canvas.height + 100) return;

  // Phase 2 visual: intense red glow aura
  const isPhase2 = worldBossState.hp <= worldBossState.maxHp * 0.5;

  // Pulsing aura (3x normal size, more intense in Phase 2)
  const pulseSize = isPhase2 ? (50 + Math.sin(time * 4) * 12) : (40 + Math.sin(time * 2) * 8);
  const auraAlpha = isPhase2 ? (0.3 + Math.sin(time * 5) * 0.15) : (0.15 + Math.sin(time * 3) * 0.1);
  ctx.fillStyle = isPhase2 ? `rgba(255,0,0,${auraAlpha})` : `rgba(255,40,40,${auraAlpha})`;
  ctx.beginPath();
  ctx.arc(bx + TILE/2, by + TILE/2, pulseSize, 0, Math.PI * 2);
  ctx.fill();

  // Phase 2 outer ring
  if (isPhase2) {
    const ringAlpha = 0.2 + Math.sin(time * 6) * 0.15;
    ctx.strokeStyle = `rgba(255,0,0,${ringAlpha})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(bx + TILE/2, by + TILE/2, pulseSize + 8, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Inner glow
  const innerAlpha = isPhase2 ? (0.4 + Math.sin(time * 6) * 0.15) : (0.25 + Math.sin(time * 4) * 0.1);
  ctx.fillStyle = isPhase2 ? `rgba(255,20,20,${innerAlpha})` : `rgba(255,100,40,${innerAlpha})`;
  ctx.beginPath();
  ctx.arc(bx + TILE/2, by + TILE/2, 24, 0, Math.PI * 2);
  ctx.fill();

  // Boss body (large glowing circle)
  const grad = ctx.createRadialGradient(bx + TILE/2, by + TILE/2, 4, bx + TILE/2, by + TILE/2, 18);
  grad.addColorStop(0, '#ff6644');
  grad.addColorStop(0.6, '#cc2222');
  grad.addColorStop(1, '#660000');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(bx + TILE/2, by + TILE/2, 18, 0, Math.PI * 2);
  ctx.fill();

  // Boss border
  ctx.strokeStyle = '#ff4444';
  ctx.lineWidth = 2;
  ctx.shadowColor = '#ff4444';
  ctx.shadowBlur = 15;
  ctx.beginPath();
  ctx.arc(bx + TILE/2, by + TILE/2, 18, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Boss name + title above
  ctx.fillStyle = '#ff6644';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  const bossLabel = worldBossState.bossTitle ? `${worldBossState.bossName} — ${worldBossState.bossTitle}` : worldBossState.bossName;
  ctx.fillText(bossLabel, bx + TILE/2, by - 28);

  // HP bar above boss
  const hpPct = Math.max(0, worldBossState.hp / worldBossState.maxHp);
  const barW = 50;
  const barH = 5;
  const barX = bx + TILE/2 - barW/2;
  const barY = by - 22;
  ctx.fillStyle = '#1a0a0a';
  ctx.fillRect(barX, barY, barW, barH);
  ctx.fillStyle = hpPct > 0.5 ? '#cc2222' : hpPct > 0.25 ? '#cc6622' : '#ff4444';
  ctx.fillRect(barX, barY, barW * hpPct, barH);
  ctx.strokeStyle = '#4a1a1a';
  ctx.lineWidth = 1;
  ctx.strokeRect(barX, barY, barW, barH);

  // Interaction prompt if nearby
  const dist = Math.sqrt((G.x - worldBossState.x) ** 2 + (G.y - worldBossState.y) ** 2);
  if (dist < 4) {
    const promptAlpha = 0.6 + Math.sin(time * 3) * 0.3;
    ctx.fillStyle = `rgba(255,100,68,${promptAlpha})`;
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('[E] Fight Boss', bx + TILE/2, by - 40);
  }
}

// ═══════ BOSS PHASE 2 MECHANICS ═══════
let bossPhase2Active = false;

function checkBossPhase2() {
  if (!B || !B.isWorldBoss) return;
  if (bossPhase2Active) return; // already in Phase 2

  const eg = typeof activeEnemyGhost === 'function' ? activeEnemyGhost() : null;
  if (!eg) return;

  // Trigger Phase 2 at 50% HP
  if (eg.hp <= eg.maxHp * 0.5 && eg.hp > 0) {
    bossPhase2Active = true;
    B.bossPhase2 = true;

    // Log the phase transition
    if (B.log) {
      B.log.push({ text: `${eg.name} enters Phase 2!`, type: 'damage' });
    }
    notify(`${eg.name} enters Phase 2! +1 damage, healing blocked!`);

    if (typeof SFX !== 'undefined' && SFX.hit) SFX.hit();
    if (typeof battleShake === 'function') battleShake();
    if (typeof renderBattle === 'function') renderBattle();
  }
}

// Apply Phase 2 damage bonus (+1 to all enemy rolls)
function getBossPhase2DamageBonus() {
  return (B && B.bossPhase2) ? 1 : 0;
}

// Check if boss healing should be blocked
function isBossHealingBlocked() {
  return !!(B && B.bossPhase2);
}

// Reset Phase 2 state when battle ends
function resetBossPhase2() {
  bossPhase2Active = false;
}

// Check boss every 10 seconds
setInterval(checkWorldBoss, 60000) // check every 60s instead of 10s;

// Update boss bar timer every second
setInterval(updateWorldBossBar, 1000);

