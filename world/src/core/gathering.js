// GATHERING
// Gathering systems — wisps, nodes, friendlies, roaming enemies, survey
// Extracted from index.html — v7.1.0
// All functions and variables remain global.

// ═══════ SPIRIT WISPS — chase to collect ═══════
const spiritWisps = [];
const WISP_MAX = 8;
const WISP_SPAWN_INTERVAL = 5000; // check every 5s
const WISP_LIFETIME = 12000; // 12 seconds before despawn
const WISP_COLLECT_RANGE = 0.8; // tiles

const WISP_TYPES = [
  { id: 'frost_shard', name: 'Frost Shard', color: '#4af', glowColor: 'rgba(68,170,255,0.3)', material: 'Frost Shard', desc: 'Used in Frost Magic crafting' },
  { id: 'ember_dust', name: 'Ember Dust', color: '#f84', glowColor: 'rgba(255,136,68,0.3)', material: 'Ember Dust', desc: 'Used in Flame Magic crafting' },
  { id: 'spirit_thread', name: 'Spirit Thread', color: '#fd4', glowColor: 'rgba(255,221,68,0.3)', material: 'Spirit Thread', desc: 'Used in Charm Crafting' },
  { id: 'mask_fragment', name: 'Mask Fragment', color: '#c6f', glowColor: 'rgba(200,100,255,0.3)', material: 'Mask Fragment', desc: 'Used in Mask Making' },
];

function spawnSpiritWisps() {
  if (spiritWisps.length >= WISP_MAX) return;

  // Only spawn in encounter zones (tile 6) near the player
  const playerTX = Math.floor(G.x), playerTY = Math.floor(G.y);

  // Find a nearby encounter zone tile
  for (let attempt = 0; attempt < 15; attempt++) {
    const rx = playerTX + Math.floor(Math.random() * 30) - 15;
    const ry = playerTY + Math.floor(Math.random() * 30) - 15;
    if (rx < 2 || rx >= WORLD_W - 2 || ry < 2 || ry >= WORLD_H - 2) continue;
    if (worldMap[ry]?.[rx] !== 6) continue; // must be encounter zone

    const wispType = WISP_TYPES[Math.floor(Math.random() * WISP_TYPES.length)];
    spiritWisps.push({
      x: rx + Math.random(),
      y: ry + Math.random(),
      type: wispType,
      spawnedAt: Date.now(),
      angle: Math.random() * Math.PI * 2,
      speed: 0.02 + Math.random() * 0.02, // faster than patrol enemies
      turnRate: 0.1 + Math.random() * 0.15, // how erratically they turn
      collected: false,
    });
    break;
  }
}

setInterval(spawnSpiritWisps, WISP_SPAWN_INTERVAL);

function collectWisp(wisp) {
  // Add material to inventory
  if (!G.materials) G.materials = {};
  G.materials[wisp.type.id] = (G.materials[wisp.type.id] || 0) + 1;

  // Sound + notification
  SFX.craftSuccess(); // reuse the sparkle chime
  notify(`✨ Caught ${wisp.type.name}! (${G.materials[wisp.type.id]} total)`);

  // Exploration XP for catching wisps
  addProfessionXP('exploration', 3);

  saveGame();
}

// ═══════ RESOURCE NODES — harvestable deposits ═══════
const RESOURCE_NODE_TYPES = [
  { id: 'iron_ore', name: 'Iron Ore', color: '#8a7a6a', glowColor: 'rgba(160,140,120,0.3)', desc: 'Used by Blacksmiths and Swordsmiths', shape: 'rock' },
  { id: 'volcanic_glass', name: 'Volcanic Glass', color: '#cc4400', glowColor: 'rgba(200,60,0,0.3)', desc: 'Used in Flame Magic crafting', shape: 'crystal' },
  { id: 'frozen_crystal', name: 'Frozen Crystal', color: '#88ccee', glowColor: 'rgba(100,180,230,0.3)', desc: 'Used in Frost Magic crafting', shape: 'crystal' },
  { id: 'ancient_wood', name: 'Ancient Wood', color: '#6a5a3a', glowColor: 'rgba(100,80,50,0.3)', desc: 'Used by Blaster Engineers', shape: 'log' },
];

// Fixed node positions — always in dangerous spots
const RESOURCE_NODES = [
  // Frost Valley — mountain passes and frozen lake edges
  { x: 29, y: 43, type: 'iron_ore' },      // mountain pass south
  { x: 30, y: 44, type: 'iron_ore' },      // mountain pass south
  { x: 38, y: 20, type: 'frozen_crystal' }, // near frozen lake
  { x: 42, y: 19, type: 'frozen_crystal' }, // frozen lake edge
  { x: 50, y: 30, type: 'ancient_wood' },   // deep forest east

  // Mountain passage (between regions — very dangerous)
  { x: 59, y: 21, type: 'iron_ore' },      // east passage
  { x: 60, y: 20, type: 'volcanic_glass' }, // transition zone

  // Volcanic Isles — near lava, on beaches
  { x: 70, y: 8, type: 'volcanic_glass' },  // near lava river
  { x: 75, y: 20, type: 'volcanic_glass' }, // volcanic interior
  { x: 80, y: 30, type: 'volcanic_glass' }, // deep volcanic
  { x: 68, y: 35, type: 'ancient_wood' },   // palm forest

  // Rolling Hills — scattered in open fields far from Meadowbrook
  { x: 15, y: 55, type: 'ancient_wood' },   // deep woods
  { x: 40, y: 50, type: 'iron_ore' },       // hillside deposit
  { x: 45, y: 60, type: 'frozen_crystal' }, // cold stream
  { x: 20, y: 65, type: 'ancient_wood' },   // far south forest
];

// Track node respawn times
const nodeRespawnTimers = {}; // nodeIndex -> timestamp when available again
const NODE_RESPAWN_TIME = 300000; // 5 minutes

let harvestingNode = null; // currently harvesting node index
let harvestStartTime = 0;
const HARVEST_DURATION = 4000; // 4 seconds

function startHarvest(nodeIdx) {
  const node = RESOURCE_NODES[nodeIdx];
  if (!node) return;

  // Check respawn timer
  if (nodeRespawnTimers[nodeIdx] && Date.now() < nodeRespawnTimers[nodeIdx]) {
    const secs = Math.ceil((nodeRespawnTimers[nodeIdx] - Date.now()) / 1000);
    notify(`This node is depleted. Respawns in ${secs}s.`);
    return;
  }

  harvestingNode = nodeIdx;
  harvestStartTime = Date.now();
  notify(`Harvesting ${RESOURCE_NODE_TYPES.find(t => t.id === node.type).name}...`);
}

function updateHarvest() {
  if (harvestingNode === null) return;

  // Cancel if player moves too far from node
  const node = RESOURCE_NODES[harvestingNode];
  const dist = Math.sqrt((G.x - node.x) ** 2 + (G.y - node.y) ** 2);
  if (dist > 2.5 || G.inBattle) {
    harvestingNode = null;
    notify('Harvesting interrupted!');
    return;
  }

  // Check if harvest is complete
  if (Date.now() - harvestStartTime >= HARVEST_DURATION) {
    completeHarvest();
  }
}

function completeHarvest() {
  if (harvestingNode === null) return;
  const node = RESOURCE_NODES[harvestingNode];
  const nodeType = RESOURCE_NODE_TYPES.find(t => t.id === node.type);

  // Add material
  if (!G.materials) G.materials = {};
  G.materials[node.type] = (G.materials[node.type] || 0) + 1;

  // Set respawn timer
  nodeRespawnTimers[harvestingNode] = Date.now() + NODE_RESPAWN_TIME;

  SFX.craftSuccess();
  notify(`⛏️ Harvested ${nodeType.name}! (${G.materials[node.type]} total)`);
  addProfessionXP('crafting', 5);

  harvestingNode = null;
  saveGame();
}

// ═══════ FRIENDLY SPIRITKIN — peaceful drops near hubs ═══════
const friendlySpirits = [];
const FRIENDLY_MAX = 8;
const FRIENDLY_SPAWN_INTERVAL = 10000; // check every 10s
const FRIENDLY_COLLECT_RANGE = 1.5; // tiles — must be close
const FRIENDLY_SCARE_SPEED = 0.08; // how fast player must be moving to scare them

const FRIENDLY_TYPES = [
  { id: 'little_boo', name: 'Little Boo', color: '#aaccff', bodyColor: '#88aadd', eyeColor: '#fff', drop: { id: 'essence_fragment', name: 'Essence Fragment' } },
  { id: 'puff_pal', name: 'Puff', color: '#ffccdd', bodyColor: '#ddaabb', eyeColor: '#fff', drop: { id: 'spirit_dust', name: 'Spirit Dust' } },
  { id: 'happy_crystal', name: 'Happy Crystal', color: '#ccffcc', bodyColor: '#aaddaa', eyeColor: '#fff', drop: { id: 'crystal_chip', name: 'Crystal Chip' } },
  { id: 'tiny_glow', name: 'Tiny Glow', color: '#ffffaa', bodyColor: '#dddd88', eyeColor: '#fff', drop: { id: 'glow_mote', name: 'Glow Mote' } },
];

function spawnFriendlySpirits() {
  if (friendlySpirits.length >= FRIENDLY_MAX) return;

  // Spawn near one of the hub locations
  const hubs = [
    { x: HUB.x + 3, y: HUB.y + 3, name: 'Polaris' },     // Frost Valley hub
    { x: 25, y: 59, name: 'Meadowbrook' },                  // Rolling Hills hub
    { x: 75, y: 15, name: 'Volcanic' },                     // Volcanic hub
  ];

  const hub = hubs[Math.floor(Math.random() * hubs.length)];

  // Spawn within safe radius of hub (5-7 tiles away)
  const angle = Math.random() * Math.PI * 2;
  const dist = 3 + Math.random() * 4;
  const sx = hub.x + Math.cos(angle) * dist;
  const sy = hub.y + Math.sin(angle) * dist;

  // Check tile is walkable
  const tile = worldMap[Math.floor(sy)]?.[Math.floor(sx)];
  if (tile === undefined || tile === 1 || tile === 3 || tile === 7 || tile === 15 || tile === 16 || tile === 21 || tile === 13 || tile === 23 || tile === 25) return;

  const fType = FRIENDLY_TYPES[Math.floor(Math.random() * FRIENDLY_TYPES.length)];
  friendlySpirits.push({
    x: sx, y: sy,
    homeX: sx, homeY: sy,
    type: fType,
    spawnedAt: Date.now(),
    angle: Math.random() * Math.PI * 2,
    state: 'idle', // idle, wandering, scared, gifting
    giftCooldown: 0, // can't be gifted from again until cooldown
    scaredTimer: 0,
  });
}

setInterval(spawnFriendlySpirits, FRIENDLY_SPAWN_INTERVAL);

// ═══════ ROAMING ENEMIES — visible, patrol, detect, chase ═══════
const roamingEnemies = [];
const ROAM_SPAWN_INTERVAL = 5000; // check spawns every 5s
const ROAM_MAX = 25; // max enemies on map at once
const ROAM_DETECT_RANGE = 6; // tiles — how far they can "see" you
const ROAM_CHASE_SPEED = 0.03; // tiles per frame — slightly slower than player
const ROAM_LEASH_RANGE = 14; // tiles — give up chase after this distance from home
const ROAM_SAFE_RADIUS = 8; // tiles from hub = no spawns

function spawnRoamingEnemies() {
  if (roamingEnemies.length >= ROAM_MAX) return;
  // Spawn 1-3 enemies per cycle in valid locations
  const spawns = 1 + Math.floor(Math.random() * 2);
  for (let i = 0; i < spawns && roamingEnemies.length < ROAM_MAX; i++) {
    // Pick a random position on walkable terrain, far from hubs
    let attempts = 0;
    while (attempts < 30) {
      attempts++;
      const sx = 4 + Math.floor(Math.random() * (WORLD_W - 8));
      const sy = 4 + Math.floor(Math.random() * (WORLD_H - 8));
      const tile = worldMap[sy]?.[sx];
      // Must be walkable
      if (tile === 1 || tile === 3 || tile === 7 || tile === 5 || tile === 8 || tile === 12 || tile === 15 || tile === 16 || tile === 13 || tile === 21 || tile === 23 || tile === 25) continue;
      // Must be far from hubs
      const dFH = Math.sqrt((sx - (HUB.x+3))**2 + (sy - (HUB.y+3))**2);
      const dRH = Math.sqrt((sx - 25)**2 + (sy - 59)**2);
      const dVI = Math.sqrt((sx - 75)**2 + (sy - 15)**2);
      if (Math.min(dFH, dRH, dVI) < ROAM_SAFE_RADIUS) continue;
      // Must not be too close to player
      const dPlayer = Math.sqrt((sx - G.x)**2 + (sy - G.y)**2);
      if (dPlayer < 10) continue;

      // Pick a card based on region + deep wilderness danger zones
      const inVI = sx > 60;
      const inRH = sy >= 45;
      const minHubDist = Math.min(dFH, dRH, dVI);
      const dangerFactor = Math.min(1, (minHubDist - ROAM_SAFE_RADIUS) / 17);
      const isDeepWild = minHubDist > 20; // deep wilderness = far from ALL hubs

      let pool;
      if (isDeepWild) {
        // Deep wilderness: weighted toward dangerous enemies
        const roll = Math.random();
        if (roll < 0.10) {
          pool = ALL_CARDS.filter(c => c.rarity === 'legendary');
        } else if (roll < 0.30) {
          pool = ALL_CARDS.filter(c => c.rarity === 'ghost-rare');
        } else if (roll < 0.70) {
          pool = ALL_CARDS.filter(c => c.rarity === 'rare');
        } else {
          pool = ALL_CARDS.filter(c => c.rarity === 'uncommon' || c.rarity === 'rare');
        }
      } else {
        pool = ALL_CARDS.filter(c => {
          if (c.rarity === 'legendary') return dangerFactor > 0.8;
          if (c.rarity === 'ghost-rare') return dangerFactor > 0.5;
          if (c.rarity === 'rare') return dangerFactor > 0.3;
          return true;
        });
      }
      if (!pool.length) pool = ALL_CARDS.filter(c => c.rarity === 'common');
      const card = pool[Math.floor(Math.random() * pool.length)];
      if (!card) continue;

      // Deep wilderness enemies are visually bigger + redder glow
      const isElite = isDeepWild && (card.rarity === 'rare' || card.rarity === 'ghost-rare' || card.rarity === 'legendary');

      roamingEnemies.push({
        id: Date.now() + Math.random(),
        card,
        x: sx, y: sy,
        homeX: sx, homeY: sy,
        state: 'patrol', // patrol, alert, chase, returning
        patrolAngle: Math.random() * Math.PI * 2,
        alertTimer: 0,
        speed: 0.015 + Math.random() * 0.01, // patrol speed (slower)
        chaseSpeed: ROAM_CHASE_SPEED + Math.random() * 0.01,
        isElite: isElite, // bigger sprite, redder glow
        isLegendaryBoss: false,
        bonusHp: isElite ? Math.floor(card.maxHp * 0.5) : 0,
      });
      break;
    }
  }
}

function updateRoamingEnemies() {
  if (G.inBattle) return;
  const px = G.x, py = G.y;
  const peacefulHour = isWorldEventActive('peace');

  for (let i = roamingEnemies.length - 1; i >= 0; i--) {
    const e = roamingEnemies[i];
    const distToPlayer = Math.sqrt((e.x - px)**2 + (e.y - py)**2);
    const distToHome = Math.sqrt((e.x - e.homeX)**2 + (e.y - e.homeY)**2);

    // Peaceful Hour: force chase/alert enemies back to patrol
    if (peacefulHour && (e.state === 'chase' || e.state === 'alert')) {
      e.state = 'patrol';
    }

    switch (e.state) {
      case 'patrol':
        // Wander slowly in a direction, occasionally turn
        e.patrolAngle += (Math.random() - 0.5) * 0.15;
        const pdx = Math.cos(e.patrolAngle) * e.speed;
        const pdy = Math.sin(e.patrolAngle) * e.speed;
        const pnx = e.x + pdx, pny = e.y + pdy;
        const ptile = worldMap[Math.floor(pny)]?.[Math.floor(pnx)];
        if (ptile !== undefined && ptile !== 1 && ptile !== 3 && ptile !== 7 && ptile !== 15 && ptile !== 16 && ptile !== 13 && ptile !== 21 && ptile !== 23 && ptile !== 25) {
          e.x = pnx; e.y = pny;
          // Stable direction: only update when angle changes significantly
          const na = ((e.patrolAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
          const newDir = na > 5.5 || na < 0.8 ? 'right' : na < 2.4 ? 'down' : na < 3.9 ? 'left' : 'up';
          if (e.dir !== newDir) e.dir = newDir;
        } else {
          e.patrolAngle += Math.PI * 0.5; // turn on collision
        }
        // Stay near home
        if (distToHome > 8) e.patrolAngle = Math.atan2(e.homeY - e.y, e.homeX - e.x);
        // Detect player (skip during Peaceful Hour)
        if (!peacefulHour && distToPlayer < ROAM_DETECT_RANGE) {
          e.state = 'alert';
          e.alertTimer = 40; // ~0.6s pause before chase
        }
        break;

      case 'alert':
        // Brief pause — "noticed you" — then chase
        e.alertTimer--;
        if (e.alertTimer <= 0) {
          e.state = 'chase';
        }
        break;

      case 'chase':
        // Move toward player
        const angle = Math.atan2(py - e.y, px - e.x);
        const cdx = Math.cos(angle) * e.chaseSpeed;
        const cdy = Math.sin(angle) * e.chaseSpeed;
        const cnx = e.x + cdx, cny = e.y + cdy;
        const ctile = worldMap[Math.floor(cny)]?.[Math.floor(cnx)];
        if (ctile !== undefined && ctile !== 1 && ctile !== 3 && ctile !== 7 && ctile !== 15 && ctile !== 16 && ctile !== 13 && ctile !== 21 && ctile !== 23 && ctile !== 25) {
          e.x = cnx; e.y = cny;
          // Stable chase direction
          const ca = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
          const chaseDir = ca > 5.5 || ca < 0.8 ? 'right' : ca < 2.4 ? 'down' : ca < 3.9 ? 'left' : 'up';
          if (e.dir !== chaseDir) e.dir = chaseDir;
        }
        // Catch player — trigger battle!
        if (distToPlayer < 1.2) {
          triggerRoamingBattle(e);
          roamingEnemies.splice(i, 1); // remove this enemy
          return;
        }
        // Give up if too far from home
        if (distToHome > ROAM_LEASH_RANGE) {
          e.state = 'returning';
        }
        // Give up if player gets far
        if (distToPlayer > ROAM_DETECT_RANGE * 2.5) {
          e.state = 'returning';
        }
        break;

      case 'returning':
        // Walk back to home position
        const rAngle = Math.atan2(e.homeY - e.y, e.homeX - e.x);
        e.x += Math.cos(rAngle) * e.speed;
        e.y += Math.sin(rAngle) * e.speed;
        // Stable return direction
        const ra = ((rAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        const retDir = ra > 5.5 || ra < 0.8 ? 'right' : ra < 2.4 ? 'down' : ra < 3.9 ? 'left' : 'up';
        if (e.dir !== retDir) e.dir = retDir;
        if (distToHome < 2) {
          e.state = 'patrol';
          e.patrolAngle = Math.random() * Math.PI * 2;
        }
        break;
    }

    // Despawn if very far from player (cleanup)
    if (distToPlayer > 40) {
      roamingEnemies.splice(i, 1);
    }
  }
}

function triggerRoamingBattle(enemy) {
  if (G.inBattle || G.team.length === 0) return;
  // Close any open UI overlays before battle
  document.querySelectorAll('.modal-overlay.active, #npcDialogueBox').forEach(el => { if (el.id === 'npcDialogueBox') el.style.display='none'; else el.classList.remove('active'); });

  const card = enemy.card;
  const warnings = [
    `${card.name} caught up to you!`,
    `${card.name} attacks!`,
    `No escape — ${card.name} strikes!`,
  ];

  G.inBattle = true;
  SFX.encounterStart();
  Music.play('battle');

  // Build player team (up to 3)
  const playerGhosts = buildPlayerBattleTeam();

  // Enemy team — just the roaming enemy (1 ghost)
  const enemyGhosts = [{
    id: card.id, name: card.name, hp: card.maxHp, maxHp: card.maxHp, ko: false,
    ability: card.ability, abilityDesc: card.desc, rarity: card.rarity, usedOncePerGame: false, entryFired: false
  }];

  // Scale enemy HP
  for (const eg of enemyGhosts) {
    if (G.level <= 3) { eg.maxHp = Math.max(2, eg.maxHp - 1); eg.hp = eg.maxHp; }
    else if (G.level >= 7) { eg.maxHp += 1; eg.hp = eg.maxHp; }
  }

  B = {
    round: 1,
    player: {
      ghosts: playerGhosts,
      activeIdx: 0,
      resources: { iceShards: 0, sacredFire: 0, healingSeeds: 0, luckyStones: 0, surge: 0, moonstone: 0, firefly: 0 },
    },
    enemy: {
      ghosts: enemyGhosts,
      activeIdx: 0,
      resources: { iceShards: 0, sacredFire: 0, healingSeeds: 0, luckyStones: 0, surge: 0, moonstone: 0, firefly: 0 },
    },
    enemyCard: card,
    enemyCards: [card],
    log: [],
    phase: 'ready',
    playerDice: [],
    enemyDice: [],
    entryFired: false,
    resources: { iceShards: 0, sacredFire: 0, healingSeeds: 0, luckyStones: 0, surge: 0, moonstone: 0, firefly: 0 },
    isAggressive: true,
    nextRoundMods: { playerExtraDice: 0, enemyExtraDice: 0, playerMaxDice: 99, enemyMaxDice: 99 },
    enemyUsedResource: false,
    damageTakenThisRound: 0,
    koSwapTeam: null,
  };

  applyAccessoryBattleEffects();

  showBattleOverlay();
  document.getElementById('battleTitle').textContent = warnings[Math.floor(Math.random() * warnings.length)];
  renderBattle();
  notify(`⚠️ ${card.name} attacks!`);
}

// Spawn timer
setInterval(spawnRoamingEnemies, ROAM_SPAWN_INTERVAL);

// ═══════ LEGENDARY ROAMING BOSS — rare deep wilderness spawn ═══════
const LEGENDARY_BOSS_INTERVAL = 60000; // check every 60s
const LEGENDARY_BOSS_CHANCE = 0.10; // 10% chance per check
function trySpawnLegendaryBoss() {
  // Only 1 legendary boss at a time
  if (roamingEnemies.some(e => e.isLegendaryBoss)) return;
  if (Math.random() > LEGENDARY_BOSS_CHANCE) return;
  // Find a deep wilderness spot (20+ tiles from all hubs)
  for (let attempts = 0; attempts < 50; attempts++) {
    const sx = 4 + Math.floor(Math.random() * (WORLD_W - 8));
    const sy = 4 + Math.floor(Math.random() * (WORLD_H - 8));
    const tile = worldMap[sy]?.[sx];
    if (tile === 1 || tile === 3 || tile === 7 || tile === 5 || tile === 8 || tile === 12 || tile === 15 || tile === 16 || tile === 13 || tile === 21 || tile === 23 || tile === 25) continue;
    const dFH = Math.sqrt((sx - (HUB.x+3))**2 + (sy - (HUB.y+3))**2);
    const dRH = Math.sqrt((sx - 25)**2 + (sy - 59)**2);
    const dVI = Math.sqrt((sx - 75)**2 + (sy - 15)**2);
    if (Math.min(dFH, dRH, dVI) < 20) continue;
    const dPlayer = Math.sqrt((sx - G.x)**2 + (sy - G.y)**2);
    if (dPlayer < 12) continue;
    // Pick a legendary card
    const legendaryPool = ALL_CARDS.filter(c => c.rarity === 'legendary');
    const card = legendaryPool[Math.floor(Math.random() * legendaryPool.length)];
    if (!card) return;
    roamingEnemies.push({
      id: Date.now() + Math.random(),
      card,
      x: sx, y: sy,
      homeX: sx, homeY: sy,
      state: 'patrol',
      patrolAngle: Math.random() * Math.PI * 2,
      alertTimer: 0,
      speed: 0.012, // slow patrol — menacing
      chaseSpeed: ROAM_CHASE_SPEED + 0.015, // faster chase
      isElite: true,
      isLegendaryBoss: true,
      bonusHp: card.maxHp, // double HP
    });
    break;
  }
}
setInterval(trySpawnLegendaryBoss, LEGENDARY_BOSS_INTERVAL);

const depletedSpots = new Map(); // key: "tileX,tileY" → depletion timestamp
let surveyActive = false;
let surveyTimer = null;

function getSurveyConcentration(tileX, tileY, zoneIdx) {
  const cycleId = getZoneCycleId();
  // Deterministic concentration seeded from position + cycle
  const raw = seededHash(tileX * 3571 + tileY * 7919, cycleId * 51929);
  let concentration = raw * 100; // 0-100%

  // Zone quality boosts concentration
  if (zoneIdx >= 0) {
    const zoneQ = getZoneQuality(zoneIdx, cycleId);
    concentration *= (0.6 + zoneQ * 0.4); // quality scales it
  }

  // Scout discipline bonus: +20%
  if (G.discipline === 'scout') concentration += 20;

  // Pathfinder skill: +20% concentration
  if (hasSkill('rng_1')) concentration += 20;

  return Math.min(100, Math.max(0, Math.round(concentration)));
}

function startSurvey() {
  if (G.inBattle || surveyActive) return;

  // Check if in or near an encounter zone
  const tileX = Math.floor(G.x);
  const tileY = Math.floor(G.y);
  let zoneIdx = getCurrentZone(G.x, G.y);

  // Also check nearby tiles for zone proximity
  if (zoneIdx < 0) {
    for (let dy = -2; dy <= 2 && zoneIdx < 0; dy++) {
      for (let dx = -2; dx <= 2 && zoneIdx < 0; dx++) {
        zoneIdx = getCurrentZone(G.x + dx, G.y + dy);
      }
    }
  }

  if (zoneIdx < 0) {
    notify('No spirit energy here. Move to an encounter zone to survey.');
    return;
  }

  // Check if spot is depleted
  const spotKey = `${tileX},${tileY}`;
  const depletedAt = depletedSpots.get(spotKey);
  if (depletedAt && Date.now() - depletedAt < 60000) {
    const remaining = Math.ceil((60000 - (Date.now() - depletedAt)) / 1000);
    notify(`This spot is depleted. Try another or wait ${remaining}s.`);
    return;
  }

  surveyActive = true;
  const concentration = getSurveyConcentration(tileX, tileY, zoneIdx);

  // Show survey overlay
  const overlay = document.getElementById('surveyOverlay');
  overlay.classList.add('active');

  const concEl = document.getElementById('surveyConcentration');
  concEl.textContent = `${concentration}%`;
  concEl.className = 'survey-concentration ' + (concentration > 60 ? 'high' : concentration > 30 ? 'medium' : 'low');

  const statusEl = document.getElementById('surveyStatus');
  const progressEl = document.getElementById('surveyProgressFill');
  progressEl.style.width = '0%';

  // Survey sound: low hum
  if (SFX._ensureCtx && SFX._ensureCtx()) {
    const ctx = SFX.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 120;
    gain.gain.value = 0.06;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    // Will stop after survey completes
    SFX._surveyOsc = osc;
    SFX._surveyGain = gain;
  }

  // Determine success
  let willSucceed = false;
  if (concentration > 60) {
    willSucceed = true;
  } else if (concentration > 30) {
    willSucceed = Math.random() < 0.5;
  } else {
    willSucceed = false;
  }

  statusEl.textContent = 'Surveying spirit energy...';

  // 3-second extraction progress
  let elapsed = 0;
  const totalTime = 3000;
  const stepInterval = 50;
  surveyTimer = setInterval(() => {
    elapsed += stepInterval;
    const pct = Math.min(100, (elapsed / totalTime) * 100);
    progressEl.style.width = pct + '%';

    if (elapsed >= totalTime) {
      clearInterval(surveyTimer);
      surveyTimer = null;

      // Stop survey sound + rise pitch on success
      if (SFX._surveyOsc) {
        if (willSucceed && SFX._surveyGain) {
          SFX._surveyOsc.frequency.linearRampToValueAtTime(400, SFX.ctx.currentTime + 0.2);
          SFX._surveyGain.gain.linearRampToValueAtTime(0.001, SFX.ctx.currentTime + 0.3);
          setTimeout(() => { try { SFX._surveyOsc.stop(); } catch(e) {} }, 400);
        } else {
          try { SFX._surveyOsc.stop(); } catch(e) {}
        }
        SFX._surveyOsc = null;
        SFX._surveyGain = null;
      }

      if (willSucceed) {
        // Extract an essence!
        const zone = ENCOUNTER_ZONES[zoneIdx];
        // Pick a random card from region
        const regionSets = zone.name.includes('Shadow') || zone.name.includes('Throne')
          ? ['Dark Castle', 'Set 1']
          : zone.name.includes('Magma') || zone.name.includes('Obsidian')
          ? ['Volcanic Isles', 'Set 1']
          : zone.name.includes('Sunlit') || zone.name.includes('Bramble')
          ? ['Rolling Hills', 'Set 1']
          : ['Frost Valley', 'Set 1'];
        const pool = ALL_CARDS.filter(c => regionSets.includes(c.set) && c.rarity !== 'legendary');
        const card = pool[Math.floor(Math.random() * pool.length)] || ALL_CARDS[0];
        const essence = generateEssence(card, zoneIdx);
        G.essences.push(essence);

        // Reputation
        if (!G.rep) G.rep = { battlesWon:0, craftsCompleted:0, itemsSold:0, essencesCollected:0, raresFound:0 };
        G.rep.essencesCollected++;
        checkAndNotifyTitles();
        checkQuestProgress('essence_collected', essence);
        advanceWeeklyChallenge('essence');

        statusEl.innerHTML = `<span style="color:#4f8;">Extracted: ${essence.name}!</span>`;
        SFX.craftSuccess();

        // Deplete this spot for 60 seconds
        depletedSpots.set(spotKey, Date.now());

        saveGame();
      } else {
        statusEl.innerHTML = `<span style="color:#f88;">No concentration here. Try another spot.</span>`;
      }

      // Auto-close after 2 seconds
      setTimeout(() => {
        overlay.classList.remove('active');
        surveyActive = false;
      }, 2000);
    }
  }, stepInterval);
}

// Show/hide survey button based on zone proximity
function updateSurveyButton() {
  const btn = document.getElementById('hudSurveyBtn');
  if (!btn) return;
  let nearZone = getCurrentZone(G.x, G.y) >= 0;
  if (!nearZone) {
    for (let dy = -2; dy <= 2 && !nearZone; dy++) {
      for (let dx = -2; dx <= 2 && !nearZone; dx++) {
        if (getCurrentZone(G.x + dx, G.y + dy) >= 0) nearZone = true;
      }
    }
  }
  btn.classList.toggle('visible', nearZone);
}

// Clean depleted spots periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, ts] of depletedSpots) {
    if (now - ts > 60000) depletedSpots.delete(key);
  }
}, 10000);

// Draw survey ring on canvas when surveying
function renderSurveyRing(ctx, camX, camY, time) {
  if (!surveyActive) return;
  const px = G.x * TILE - camX + TILE / 2;
  const py = G.y * TILE - camY + TILE / 2;

  // Pulsing ring
  const ringPhase = (time * 2) % 1;
  const ringRadius = 10 + ringPhase * 40;
  const ringAlpha = Math.max(0, 0.6 - ringPhase * 0.8);

  const zoneIdx = getCurrentZone(G.x, G.y);
  const concentration = zoneIdx >= 0 ? getSurveyConcentration(Math.floor(G.x), Math.floor(G.y), zoneIdx) : 0;
  const ringColor = concentration > 60 ? '60,255,120' : concentration > 30 ? '200,160,60' : '255,80,80';

  ctx.strokeStyle = `rgba(${ringColor},${ringAlpha})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(px, py, ringRadius, 0, Math.PI * 2);
  ctx.stroke();

  // Second ring offset
  const ring2Phase = ((time * 2) + 0.5) % 1;
  const ring2Radius = 10 + ring2Phase * 40;
  const ring2Alpha = Math.max(0, 0.4 - ring2Phase * 0.6);
  ctx.strokeStyle = `rgba(${ringColor},${ring2Alpha})`;
  ctx.beginPath();
  ctx.arc(px, py, ring2Radius, 0, Math.PI * 2);
  ctx.stroke();
}

// ═══════ GOO FEEDING ENCOUNTERS — peaceful creatures near encounter zones ═══════
const GOOS = [];
const GOO_MAX = 5;
const GOO_FEED_RANGE = 1.5; // tiles

const GOO_COLORS = ['#88ff88', '#88bbff', '#ffbb88', '#ff88ff'];
const GOO_REWARDS = [
  { id: 'frost_shard', name: 'Frost Shard' },
  { id: 'ember_dust', name: 'Ember Dust' },
  { id: 'spirit_thread', name: 'Spirit Thread' },
  { id: 'mask_fragment', name: 'Mask Fragment' },
];
const GOO_RARE_REWARDS = [
  { id: 'frozen_crystal', name: 'Frozen Crystal' },
  { id: 'volcanic_glass', name: 'Volcanic Glass' },
  { id: 'ancient_wood', name: 'Ancient Wood' },
];

function spawnGoos() {
  if (GOOS.length >= GOO_MAX) return;
  for (const zone of ENCOUNTER_ZONES) {
    if (Math.random() < 0.1 && GOOS.length < GOO_MAX) {
      GOOS.push({
        x: zone.x + Math.random() * zone.w,
        y: zone.y + Math.random() * zone.h,
        color: GOO_COLORS[Math.floor(Math.random() * GOO_COLORS.length)],
        hungry: true,
        fedCount: 0,
        spawnedAt: Date.now(),
        bouncePhase: Math.random() * Math.PI * 2,
      });
    }
  }
}
setInterval(spawnGoos, 20000);

function feedNearbyGoo() {
  if (G.inBattle) return;
  const px = G.x, py = G.y;

  for (let i = GOOS.length - 1; i >= 0; i--) {
    const goo = GOOS[i];
    const dist = Math.sqrt((goo.x - px) ** 2 + (goo.y - py) ** 2);
    if (dist > GOO_FEED_RANGE) continue;
    if (!goo.hungry) { notify('This Goo is already full!'); return; }

    // Check if player has any essences to feed
    if (!G.essences || G.essences.length === 0) {
      notify('You need essences to feed a Goo!');
      return;
    }

    // Consume one essence (remove the last one)
    const fedEssence = G.essences.pop();
    goo.fedCount++;
    SFX.craftSuccess();

    if (goo.fedCount >= 3) {
      // Final feeding — rare reward and despawn
      const rare = GOO_RARE_REWARDS[Math.floor(Math.random() * GOO_RARE_REWARDS.length)];
      if (!G.materials) G.materials = {};
      G.materials[rare.id] = (G.materials[rare.id] || 0) + 1;
      notify(`Goo is overjoyed! It gifts you a rare ${rare.name} and fades away happily!`);
      GOOS.splice(i, 1);
    } else {
      // Normal feeding — give a common material
      const reward = GOO_REWARDS[Math.floor(Math.random() * GOO_REWARDS.length)];
      if (!G.materials) G.materials = {};
      G.materials[reward.id] = (G.materials[reward.id] || 0) + 1;
      goo.hungry = false;
      // Goo becomes hungry again after 10 seconds
      setTimeout(() => { goo.hungry = true; }, 10000);
      notify(`Goo happily munches! It gives you ${reward.name}! (${goo.fedCount}/3 feedings)`);
    }

    addProfessionXP('exploration', 4);
    saveGame();
    return;
  }

  notify('No Goo nearby to feed.');
}

function renderGoos(ctx, camX, camY, time) {
  for (const goo of GOOS) {
    const gx = goo.x * TILE - camX;
    const gy = goo.y * TILE - camY;

    // Skip if off screen
    if (gx < -40 || gx > canvas.width + 40 || gy < -40 || gy > canvas.height + 40) continue;

    // Bounce animation
    const bounce = Math.sin(time * 3 + goo.bouncePhase) * 4;
    const drawY = gy + bounce;

    // Body — small blob
    const bodyRadius = goo.hungry ? 8 : 10;
    const grad = ctx.createRadialGradient(gx + TILE / 2, drawY + TILE / 2, 2, gx + TILE / 2, drawY + TILE / 2, bodyRadius);
    grad.addColorStop(0, '#fff');
    grad.addColorStop(0.5, goo.color);
    grad.addColorStop(1, goo.color + '88');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(gx + TILE / 2, drawY + TILE / 2, bodyRadius, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    const eyeY = drawY + TILE / 2 - 2;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(gx + TILE / 2 - 3, eyeY, 2.5, 0, Math.PI * 2);
    ctx.arc(gx + TILE / 2 + 3, eyeY, 2.5, 0, Math.PI * 2);
    ctx.fill();
    // Pupils
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(gx + TILE / 2 - 3, eyeY, 1.2, 0, Math.PI * 2);
    ctx.arc(gx + TILE / 2 + 3, eyeY, 1.2, 0, Math.PI * 2);
    ctx.fill();

    // Happy face when fed (not hungry)
    if (!goo.hungry) {
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(gx + TILE / 2, drawY + TILE / 2 + 1, 3, 0, Math.PI);
      ctx.stroke();
    }

    // Glow when nearby player
    const dist = Math.sqrt((goo.x - G.x) ** 2 + (goo.y - G.y) ** 2);
    if (dist < GOO_FEED_RANGE) {
      ctx.strokeStyle = goo.color;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.4 + Math.sin(time * 4) * 0.2;
      ctx.beginPath();
      ctx.arc(gx + TILE / 2, drawY + TILE / 2, bodyRadius + 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Prompt
      ctx.fillStyle = goo.color;
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(goo.hungry ? '[E] Feed' : 'Full!', gx + TILE / 2, drawY - 4);
    }
  }

  // Despawn old goos (5 minutes)
  for (let i = GOOS.length - 1; i >= 0; i--) {
    if (Date.now() - GOOS[i].spawnedAt > 300000) GOOS.splice(i, 1);
  }
}

