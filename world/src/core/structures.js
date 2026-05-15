// ══════════════════════════════════════════════════════════
//  WORLD STRUCTURES SYSTEM
//  Unified system for all player-placed structures:
//  Houses, gardens, taverns, labs, arenas, inns, stations, etc.
//  G.structures = [{ id, type, x, y, owner, data, placedAt }]
// ══════════════════════════════════════════════════════════

const STRUCTURE_TYPES = {
  house:    { name: 'House',         color: 0xdd9933, w: 2, h: 2, icon: '⌂', desc: 'Respawn point' },
  garden:   { name: 'Garden',        color: 0x66cc66, w: 2, h: 2, icon: '❀', desc: 'Attracts spirits, grow plants' },
  tavern:   { name: 'Tavern',        color: 0x885544, w: 3, h: 2, icon: '☗', desc: 'Rest for buffs, cast Preparation' },
  workshop: { name: 'Workshop',      color: 0x997744, w: 2, h: 2, icon: '⚒', desc: '+20% crafting success nearby' },
  trade_post:{ name: 'Trade Post',   color: 0x448844, w: 2, h: 2, icon: '⚖', desc: 'Player trading' },
  warehouse:{ name: 'Warehouse',     color: 0x666688, w: 3, h: 2, icon: '▤', desc: 'Shared storage' },
  lab:      { name: 'Laboratory',    color: 0xaa55ff, w: 3, h: 2, icon: '⚗', desc: 'DNA mutations (Scientists)' },
  arena:    { name: 'Battle Arena',  color: 0xdd5544, w: 3, h: 3, icon: '⚔', desc: 'PvP battles' },
  inn:      { name: 'Inn',           color: 0xcc8833, w: 2, h: 2, icon: '⛺', desc: 'Rest bonus for returning players' },
  station:  { name: 'Train Station', color: 0x888888, w: 4, h: 2, icon: '⚐', desc: 'Teleport to other stations' },
  town_hall:{ name: 'Town Hall',     color: 0xddcc44, w: 3, h: 3, icon: '⛩', desc: 'Settlement on world map' },
  trellis:  { name: 'Garden Trellis',color: 0x558844, w: 1, h: 1, icon: '⌗', desc: 'Boosts nearby garden yield' },
  greenhouse:{ name: 'Greenhouse',   color: 0x44aa55, w: 3, h: 2, icon: '◻', desc: 'Gardens inside produce year-round' },
  fountain: { name: 'Spirit Fountain',color: 0x4488cc,w: 2, h: 2, icon: '♒', desc: 'Attracts spirits to settlement' },
  // ── Farm structures ──
  fence:     { name: 'Fence',         color: 0x8a6a3a, w: 1, h: 1, icon: '⌗', desc: 'Farm border, keeps the look tidy' },
  well:      { name: 'Water Well',    color: 0x4488aa, w: 2, h: 2, icon: '⊙', desc: 'Water all crops within 5 tiles' },
  flower_bed:{ name: 'Flower Bed',    color: 0xee88aa, w: 1, h: 1, icon: '✿', desc: 'Decorative flowers' },
  lamp_post: { name: 'Lamp Post',     color: 0xddaa44, w: 1, h: 1, icon: '☀', desc: 'Night light, protects crops from frost' },
  sprinkler: { name: 'Sprinkler',     color: 0x4488cc, w: 1, h: 1, icon: '❊', desc: 'Auto-waters nearby crops each season' },
};

function ensureStructureDefaults() {
  if (!G.structures) G.structures = [];
  if (!G.placementMode) G.placementMode = null;
}

// ── Can the player build this structure type? ──────────
function canBuildStructure(type) {
  const checks = {
    house:     function() { return typeof getTalentRank === 'function' && getTalentRank('artisan', 'art_con_1') >= 1; },
    garden:    function() { return typeof isApprentice === 'function' && isApprentice('cultivator'); },
    tavern:    function() { return typeof getTalentRank === 'function' && getTalentRank('artisan', 'art_twn_2') >= 1; },
    workshop:  function() { return typeof getTalentRank === 'function' && getTalentRank('artisan', 'art_con_3') >= 1; },
    trade_post:function() { return typeof getTalentRank === 'function' && getTalentRank('artisan', 'art_twn_3') >= 1; },
    warehouse: function() { return typeof getTalentRank === 'function' && getTalentRank('artisan', 'art_twn_4') >= 1; },
    lab:       function() { return typeof getTalentRank === 'function' && getTalentRank('architect', 'arc_civ_2') >= 1; },
    arena:     function() { return typeof getTalentRank === 'function' && getTalentRank('architect', 'arc_civ_3') >= 1; },
    inn:       function() { return typeof getTalentRank === 'function' && getTalentRank('architect', 'arc_civ_1') >= 1; },
    station:   function() { return typeof getTalentRank === 'function' && getTalentRank('architect', 'arc_civ_4') >= 1; },
    town_hall: function() { return typeof isMaster === 'function' && isMaster('architect'); },
    trellis:   function() { return typeof getTalentRank === 'function' && getTalentRank('architect', 'arc_enh_1') >= 1; },
    greenhouse:function() { return typeof getTalentRank === 'function' && getTalentRank('architect', 'arc_enh_3') >= 1; },
    fountain:  function() { return typeof getTalentRank === 'function' && getTalentRank('architect', 'arc_enh_4') >= 1; },
    // Farm structures
    fence:     function() { return typeof isApprentice === 'function' && isApprentice('cultivator'); },
    well:      function() { return typeof getTalentRank === 'function' && getTalentRank('cultivator', 'cul_grd_1') >= 1; },
    flower_bed:function() { return true; }, // anyone can place flowers
    lamp_post: function() { return typeof isApprentice === 'function' && isApprentice('artisan'); },
    sprinkler: function() { return typeof getTalentRank === 'function' && getTalentRank('terraformer', 'ter_wat_1') >= 1; },
  };
  return checks[type] ? checks[type]() : false;
}

// ── Get list of structures player can currently build ──
function getBuildableStructures() {
  const list = [];
  for (const type in STRUCTURE_TYPES) {
    if (canBuildStructure(type)) {
      list.push({ type, ...STRUCTURE_TYPES[type] });
    }
  }
  return list;
}

// ── Place a structure ──────────────────────────────────
function placeStructure(type, tileX, tileY) {
  if (!canBuildStructure(type)) return null;
  if (!G.structures) G.structures = [];

  const info = STRUCTURE_TYPES[type];
  if (!info) return null;

  // Check for overlap with existing structures
  for (const s of G.structures) {
    const sInfo = STRUCTURE_TYPES[s.type] || { w: 1, h: 1 };
    if (tileX < s.x + sInfo.w && tileX + info.w > s.x &&
        tileY < s.y + sInfo.h && tileY + info.h > s.y) {
      return null; // overlap
    }
  }

  const structure = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    type: type,
    x: tileX,
    y: tileY,
    owner: G.playerId || 'unknown',
    ownerName: G.name || 'Unknown',
    placedAt: Date.now(),
    data: {},
  };

  G.structures.push(structure);

  // First garden gives you your first spirit pet (Cultivator)
  if (type === 'garden' && !G.hasFirstPet) {
    G.hasFirstPet = true;
    G.spiritPet = { name: 'Garden Wisp', level: 1, maxLevel: 9, xp: 0, bonded: true };
  }

  if (typeof saveGame === 'function') saveGame();
  return structure;
}

// ── Remove a structure ─────────────────────────────────
function removeStructure(structureId) {
  if (!G.structures) return false;
  const idx = G.structures.findIndex(s => s.id === structureId);
  if (idx === -1) return false;
  const s = G.structures[idx];
  if (s.owner !== G.playerId) return false; // can only remove your own
  G.structures.splice(idx, 1);
  if (typeof saveGame === 'function') saveGame();
  return true;
}

// ── Find structures near a tile position ───────────────
function getStructuresNear(tileX, tileY, radiusTiles) {
  if (!G.structures) return [];
  const r = radiusTiles || 3;
  return G.structures.filter(s => {
    const dx = Math.abs(s.x - tileX);
    const dy = Math.abs(s.y - tileY);
    return dx <= r && dy <= r;
  });
}

// ── Find the nearest structure of a specific type ──────
function getNearestStructure(tileX, tileY, type) {
  if (!G.structures) return null;
  let best = null, bestDist = Infinity;
  for (const s of G.structures) {
    if (type && s.type !== type) continue;
    const dist = Math.abs(s.x - tileX) + Math.abs(s.y - tileY);
    if (dist < bestDist) { bestDist = dist; best = s; }
  }
  return best;
}

// ── Is player near a specific structure type? ──────────
function isNearStructure(type, radiusTiles) {
  const near = getStructuresNear(Math.floor(G.x), Math.floor(G.y), radiusTiles || 3);
  return near.some(s => s.type === type);
}

// ── Get player's own structures ────────────────────────
function getOwnStructures() {
  if (!G.structures) return [];
  return G.structures.filter(s => s.owner === G.playerId);
}

// ── Count structures of a type ─────────────────────────
function countStructures(type) {
  if (!G.structures) return 0;
  return G.structures.filter(s => s.type === type).length;
}

// ═══════ GARDEN SYSTEM (Cultivator Talent Effects) ═══════

// Initialize garden data on a structure
function ensureGardenData(structure) {
  if (!structure.data) structure.data = {};
  if (!structure.data.plants) structure.data.plants = [];
  if (structure.data.lastHarvest === undefined) structure.data.lastHarvest = 0;
  if (structure.data.spiritAttraction === undefined) structure.data.spiritAttraction = 0;
  return structure.data;
}

// Plant a seed in a garden
function plantInGarden(structureId, seedType) {
  const garden = (G.structures || []).find(s => s.id === structureId && s.type === 'garden');
  if (!garden) return false;
  const data = ensureGardenData(garden);
  if (data.plants.length >= 4) return false; // max 4 plants

  const seedDefs = {
    frost_seed:  { name: 'Frost Bloom',  growTime: 120000, color: '#88ccff', yield: 'iceShards' },
    ember_seed:  { name: 'Ember Root',   growTime: 180000, color: '#ff8844', yield: 'sacredFire' },
    spirit_seed: { name: 'Spirit Vine',  growTime: 240000, color: '#aa66ff', yield: 'healingSeeds' },
    moon_seed:   { name: 'Moon Blossom', growTime: 300000, color: '#eeddaa', yield: 'moonstone' },
  };
  const def = seedDefs[seedType] || seedDefs.frost_seed;

  data.plants.push({
    type: seedType,
    name: def.name,
    color: def.color,
    yield: def.yield,
    plantedAt: Date.now(),
    growTime: def.growTime,
    harvested: false,
  });

  if (typeof saveGame === 'function') saveGame();
  return true;
}

// Harvest ready plants from a garden
function harvestGarden(structureId) {
  const garden = (G.structures || []).find(s => s.id === structureId && s.type === 'garden');
  if (!garden) return [];
  const data = ensureGardenData(garden);
  const now = Date.now();
  const harvested = [];

  data.plants = data.plants.filter(plant => {
    const elapsed = now - plant.plantedAt;
    if (elapsed >= plant.growTime && !plant.harvested) {
      // Yield the resource
      const amount = 1;
      if (G[plant.yield] !== undefined) G[plant.yield] += amount;
      harvested.push({ name: plant.name, resource: plant.yield, amount });
      return false; // remove from garden
    }
    return true; // keep growing
  });

  data.lastHarvest = now;
  if (typeof saveGame === 'function') saveGame();
  return harvested;
}

// Get growth progress for all plants in a garden (0-1)
function getGardenStatus(structureId) {
  const garden = (G.structures || []).find(s => s.id === structureId && s.type === 'garden');
  if (!garden) return [];
  const data = ensureGardenData(garden);
  const now = Date.now();
  return data.plants.map(plant => ({
    name: plant.name,
    color: plant.color,
    progress: Math.min(1, (now - plant.plantedAt) / plant.growTime),
    ready: (now - plant.plantedAt) >= plant.growTime,
  }));
}

// ═══════ TALENT EFFECT HELPERS ═══════

// Check if player has a specific cultivator talent
function hasCultivatorTalent(talentId) {
  return typeof getTalentRank === 'function' && getTalentRank('cultivator', talentId) >= 1;
}

// Get bonus dice from talents (for BattleScene)
function getTalentBonusDice() {
  let bonus = 0;
  // Battle Companion (cul_pet_3): +1 die
  if (hasCultivatorTalent('cul_pet_3') && G.spiritPet) bonus += 1;
  // Rooted (cul_har_4): +1 die when near a garden
  if (hasCultivatorTalent('cul_har_4') && isNearStructure('garden', 5)) bonus += 1;
  return bonus;
}

// Check if player should passively heal (Nature's Calm — cul_har_1)
function checkNaturesCalmHeal() {
  if (!hasCultivatorTalent('cul_har_1')) return false;
  if (!isNearStructure('garden', 5)) return false;
  // Heal 1 HP to active ghost
  const active = G.team && G.team[G.activeIdx];
  if (active && active.hp < active.maxHp && !active.ko) {
    active.hp = Math.min(active.maxHp, active.hp + 1);
    if (typeof saveGame === 'function') saveGame();
    return true;
  }
  return false;
}
