// ══════════════════════════════════════════════════════════
//  FARMING MODULE — Stardew-style soil, crops, seasons
//  Extends the gardening system with:
//    - Soil tilling (hoe walkable tiles into farmland)
//    - 15 crop types (zone-specific discovery)
//    - Micro-seasons (spring/summer/fall/winter per 10-min cycle)
//    - Crop quality stars (normal/silver/gold)
//    - Seed catalog & discovery tracking
//  Works alongside gardening.js (which becomes the API facade)
// ══════════════════════════════════════════════════════════

// ─── Crop Definitions (15 types) ────────────────────────
//
//  Each crop has:
//    name         — display name
//    resource     — G property key yielded on harvest
//    resourceName — human-readable resource name
//    baseYield    — amount per harvest (before bonuses)
//    color        — fallback tint color
//    zone         — 'any' or specific zone name (seed discovery)
//    growTime     — base time in ms to fully grow
//    seasonBonus  — season name where growth is 1.5x faster
//    seasonOnly   — if set, crop ONLY grows in this season (dies otherwise)
//    rare         — slower growth, higher value
//    atlasRow     — row in atlas-sheet4-crops.png (0-indexed)
//    atlasFrames  — number of growth frames in atlas row

const CROP_DEFS = {

  // ── Universal (grow in any zone) ──
  healing_herb: {
    name: 'Healing Herb',
    resource: 'healingSeeds',
    resourceName: 'Healing Seeds',
    baseYield: 2,
    color: 0x44cc44,
    zone: 'any',
    growTime: 10 * 60000,
    seasonBonus: 'spring',
    seasonOnly: null,
    rare: false,
    atlasRow: 0,
    atlasFrames: 8,
  },

  lucky_clover: {
    name: 'Lucky Clover',
    resource: 'luckyStones',
    resourceName: 'Lucky Stones',
    baseYield: 1,
    color: 0x22dd66,
    zone: 'any',
    growTime: 28 * 60000,
    seasonBonus: 'spring',
    seasonOnly: null,
    rare: true,
    atlasRow: 1,
    atlasFrames: 8,
  },

  // ── Rolling Hills ──
  sunwheat: {
    name: 'Sunwheat',
    resource: 'sunwheat',
    resourceName: 'Sunwheat',
    baseYield: 3,
    color: 0xddcc44,
    zone: 'rolling_hills',
    growTime: 5 * 60000,
    seasonBonus: 'summer',
    seasonOnly: null,
    rare: false,
    atlasRow: 2,
    atlasFrames: 8,
  },

  golden_pumpkin: {
    name: 'Golden Pumpkin',
    resource: 'goldenPumpkin',
    resourceName: 'Golden Pumpkins',
    baseYield: 1,
    color: 0xee8822,
    zone: 'rolling_hills',
    growTime: 8 * 60000,
    seasonBonus: 'fall',
    seasonOnly: null,
    rare: false,
    atlasRow: 3,
    atlasFrames: 8,
  },

  honey_bloom: {
    name: 'Honey Bloom',
    resource: 'honeyBloom',
    resourceName: 'Honey Blooms',
    baseYield: 2,
    color: 0xffdd88,
    zone: 'rolling_hills',
    growTime: 6 * 60000,
    seasonBonus: 'summer',
    seasonOnly: null,
    rare: false,
    atlasRow: 4,
    atlasFrames: 8,
  },

  // ── Frost Valley ──
  frost_lily: {
    name: 'Frost Lily',
    resource: 'iceShards',
    resourceName: 'Ice Shards',
    baseYield: 2,
    color: 0x66aaff,
    zone: 'frost_valley',
    growTime: 10 * 60000,
    seasonBonus: 'winter',
    seasonOnly: null,
    rare: false,
    atlasRow: 5,
    atlasFrames: 8,
  },

  ice_berry: {
    name: 'Ice Berry',
    resource: 'iceBerry',
    resourceName: 'Ice Berries',
    baseYield: 2,
    color: 0x99ccff,
    zone: 'frost_valley',
    growTime: 7 * 60000,
    seasonBonus: 'winter',
    seasonOnly: null,
    rare: false,
    atlasRow: 6,
    atlasFrames: 8,
  },

  crystal_moss: {
    name: 'Crystal Moss',
    resource: 'crystalMoss',
    resourceName: 'Crystal Moss',
    baseYield: 1,
    color: 0xaaddff,
    zone: 'frost_valley',
    growTime: 12 * 60000,
    seasonBonus: 'winter',
    seasonOnly: 'winter',
    rare: true,
    atlasRow: 7,
    atlasFrames: 8,
  },

  // ── Volcanic Isles ──
  fire_bloom: {
    name: 'Fire Bloom',
    resource: 'sacredFire',
    resourceName: 'Sacred Fire',
    baseYield: 2,
    color: 0xff6622,
    zone: 'volcanic_isles',
    growTime: 10 * 60000,
    seasonBonus: 'summer',
    seasonOnly: null,
    rare: false,
    atlasRow: 8,
    atlasFrames: 8,
  },

  ember_pepper: {
    name: 'Ember Pepper',
    resource: 'emberPepper',
    resourceName: 'Ember Peppers',
    baseYield: 2,
    color: 0xff4422,
    zone: 'volcanic_isles',
    growTime: 6 * 60000,
    seasonBonus: 'summer',
    seasonOnly: null,
    rare: false,
    atlasRow: 9,
    atlasFrames: 8,
  },

  magma_root: {
    name: 'Magma Root',
    resource: 'sacredFire',
    resourceName: 'Sacred Fire',
    baseYield: 3,
    color: 0xcc3300,
    zone: 'volcanic_isles',
    growTime: 15 * 60000,
    seasonBonus: 'summer',
    seasonOnly: null,
    rare: true,
    atlasRow: 2,
    atlasFrames: 8,
  },

  // ── Dark Castle ──
  moon_flower: {
    name: 'Moon Flower',
    resource: 'moonstone',
    resourceName: 'Moonstones',
    baseYield: 1,
    color: 0xeeddaa,
    zone: 'dark_castle',
    growTime: 28 * 60000,
    seasonBonus: 'winter',
    seasonOnly: null,
    rare: true,
    atlasRow: 3,
    atlasFrames: 8,
  },

  shadow_vine: {
    name: 'Shadow Vine',
    resource: 'shadowVine',
    resourceName: 'Shadow Vines',
    baseYield: 2,
    color: 0x6633aa,
    zone: 'dark_castle',
    growTime: 10 * 60000,
    seasonBonus: 'fall',
    seasonOnly: null,
    rare: false,
    atlasRow: 4,
    atlasFrames: 8,
  },

  spirit_orchid: {
    name: 'Spirit Orchid',
    resource: 'spiritOrchid',
    resourceName: 'Spirit Orchids',
    baseYield: 1,
    color: 0xbb88ff,
    zone: 'dark_castle',
    growTime: 20 * 60000,
    seasonBonus: 'winter',
    seasonOnly: 'winter',
    rare: true,
    atlasRow: 5,
    atlasFrames: 8,
  },
};

// ─── Growth Stages ──────────────────────────────────────
const FARM_STAGES = ['Seed', 'Sprout', 'Growing', 'Mature', 'Harvestable'];
const FARM_STAGE_COUNT = 5;

// Quality tiers
const QUALITY = {
  NORMAL: { name: 'Normal', star: '', mult: 1.0, color: '#aaaaaa' },
  SILVER: { name: 'Silver', star: '\u2B50', mult: 1.25, color: '#c0c0c0' },
  GOLD:   { name: 'Gold',   star: '\u2B50\u2B50', mult: 1.5, color: '#ffcc00' },
};

// Soil limit per talent progression — generous so farms feel big
const SOIL_LIMITS = {
  0: 36,   // Apprentice (6x6) — start with a real farm, not a window box
  1: 64,   // cul_grd_1 (8x8)
  2: 100,  // cul_grd_2 (10x10)
  3: 144,  // cul_grd_3 (12x12)
  4: 196,  // cul_grd_4 (14x14) — massive homestead
};

const SOIL_ANCHOR_RADIUS = 10; // tiles from garden structure — big farms

// ─── Farm State ─────────────────────────────────────────
//
//  G.farm = {
//    soil: { "x,y": { tilled: true, watered: false, wateredAt: 0 } },
//    crops: { "x,y": { cropType, plantedAt, watered, wateredAt, stage } },
//    seedCatalog: { healing_herb: true, sunwheat: true, ... },
//  }

function _ensureFarmState() {
  if (typeof G === 'undefined') return null;
  if (!G.farm) G.farm = { soil: {}, crops: {}, seedCatalog: {} };
  if (!G.farm.soil) G.farm.soil = {};
  if (!G.farm.crops) G.farm.crops = {};
  if (!G.farm.seedCatalog) G.farm.seedCatalog = {};

  // Auto-discover universal crops
  G.farm.seedCatalog.healing_herb = true;
  G.farm.seedCatalog.lucky_clover = true;

  // Migrate old gardening.js plants into farm crops
  if (G.garden && G.garden.plots) {
    for (const key in G.garden.plots) {
      if (!G.farm.crops[key]) {
        const old = G.garden.plots[key];
        G.farm.crops[key] = {
          cropType: old.plantType,
          plantedAt: old.plantedAt,
          watered: old.watered,
          wateredAt: old.wateredAt,
          stage: old.stage || 0,
        };
        // Auto-till soil under migrated plants
        if (!G.farm.soil[key]) {
          G.farm.soil[key] = { tilled: true, watered: old.watered, wateredAt: old.wateredAt };
        }
      }
    }
    delete G.garden.plots; // migrated
  }

  return G.farm;
}

// ─── Soil Tilling ───────────────────────────────────────

function getMaxSoilTiles() {
  if (typeof getTalentRank !== 'function') return SOIL_LIMITS[0];
  // Check gardening branch ranks
  for (let r = 4; r >= 1; r--) {
    if (getTalentRank('cultivator', 'cul_grd_' + r) >= 1) return SOIL_LIMITS[r];
  }
  return SOIL_LIMITS[0];
}

function getSoilCount() {
  const farm = _ensureFarmState();
  if (!farm) return 0;
  return Object.keys(farm.soil).length;
}

function isNearGardenStructure(tileX, tileY) {
  if (typeof getStructuresNear !== 'function') return true; // permissive fallback
  const nearby = getStructuresNear(tileX, tileY, SOIL_ANCHOR_RADIUS);
  return nearby.some(s => s.type === 'garden' && s.owner === G.playerId);
}

/**
 * Till a walkable tile into farmable soil.
 * Requires Cultivator apprentice. Must be near own garden structure.
 */
function tillSoil(tileX, tileY) {
  const farm = _ensureFarmState();
  if (!farm) return { ok: false, reason: 'No farm state' };

  // Must be cultivator
  if (typeof isApprentice === 'function' && !isApprentice('cultivator')) {
    return { ok: false, reason: 'Requires Cultivator class' };
  }

  const key = tileX + ',' + tileY;

  // Already tilled
  if (farm.soil[key]) return { ok: false, reason: 'Already tilled' };

  // Check soil limit
  if (getSoilCount() >= getMaxSoilTiles()) {
    return { ok: false, reason: 'Soil limit reached (' + getMaxSoilTiles() + ' tiles). Unlock more in Gardening talents!' };
  }

  // Must be near own garden
  if (!isNearGardenStructure(tileX, tileY)) {
    return { ok: false, reason: 'Must be near your garden' };
  }

  // Check tile is walkable grass (type 9) or snow (0) or flowers (10) or rolling hill (11)
  // or ash ground (17) or sand (20) or plaza (19)
  if (typeof worldMap !== 'undefined' && worldMap[tileY] && worldMap[tileY][tileX] !== undefined) {
    const tillable = new Set([0, 9, 10, 11, 17, 19, 20]);
    if (!tillable.has(worldMap[tileY][tileX])) {
      return { ok: false, reason: 'Can\'t till this terrain' };
    }
  }

  farm.soil[key] = { tilled: true, watered: false, wateredAt: 0 };
  console.log('[Farm] Tilled soil at', key);
  if (typeof saveGame === 'function') saveGame();
  return { ok: true };
}

/**
 * Remove tilled soil (untill). Used when demolishing a garden.
 */
function untillSoil(tileX, tileY) {
  const farm = _ensureFarmState();
  if (!farm) return;
  const key = tileX + ',' + tileY;
  // Don't untill if crop is planted
  if (farm.crops[key]) return;
  delete farm.soil[key];
}

// ─── Crop Growth ────────────────────────────────────────

function _getGrowthElapsed(crop) {
  const now = Date.now();
  let elapsed = now - crop.plantedAt;

  // Watering doubles growth speed for time after watering
  if (crop.watered && crop.wateredAt) {
    const normalTime = crop.wateredAt - crop.plantedAt;
    const wateredTime = now - crop.wateredAt;
    elapsed = normalTime + wateredTime * 2;
  }

  return elapsed;
}

function _calcCropStage(crop) {
  const def = CROP_DEFS[crop.cropType];
  if (!def) return 0;

  const elapsed = _getGrowthElapsed(crop);
  const total = def.growTime;

  // 5 stages evenly distributed
  const stageTime = total / FARM_STAGE_COUNT;
  const stage = Math.min(FARM_STAGE_COUNT - 1, Math.floor(elapsed / stageTime));

  // Season-only check: if crop requires a specific season and we're not in it, freeze growth
  if (def.seasonOnly && typeof getSeason === 'function') {
    const current = getSeason();
    if (current.season !== def.seasonOnly) {
      // Frozen — return last saved stage (don't advance)
      return crop.stage || 0;
    }
  }

  return stage;
}

function _calcCropProgress(crop) {
  const def = CROP_DEFS[crop.cropType];
  if (!def) return 0;
  const elapsed = _getGrowthElapsed(crop);
  return Math.min(1.0, elapsed / def.growTime);
}

function _calcTimeRemaining(crop) {
  const def = CROP_DEFS[crop.cropType];
  if (!def) return 0;
  const elapsed = _getGrowthElapsed(crop);
  const remaining = def.growTime - elapsed;
  if (crop.watered) return Math.max(0, remaining / 2);
  return Math.max(0, remaining);
}

function _formatTime(ms) {
  if (ms <= 0) return 'Ready!';
  const totalSec = Math.ceil(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min > 0) return min + 'm ' + sec + 's';
  return sec + 's';
}

// ─── Crop Quality ───────────────────────────────────────

function _determineQuality(crop, tileX, tileY) {
  // Golden Harvest talent guarantees gold
  if (typeof getTalentRank === 'function' && getTalentRank('botanist', 'bot_hrv_3') >= 1) {
    return QUALITY.GOLD;
  }

  let score = 0;

  // +1 for watered
  if (crop.watered) score += 1;

  // +1 for in-season bonus
  const def = CROP_DEFS[crop.cropType];
  if (def && def.seasonBonus && typeof getSeason === 'function') {
    if (getSeason().season === def.seasonBonus) score += 1;
  }

  // +1 for trellis nearby
  if (typeof getStructuresNear === 'function') {
    const nearby = getStructuresNear(tileX, tileY, 3);
    if (nearby.some(s => s.type === 'trellis')) score += 1;
  }

  if (score >= 2) return QUALITY.GOLD;
  if (score >= 1) return QUALITY.SILVER;
  return QUALITY.NORMAL;
}

// ─── Public API ─────────────────────────────────────────

/**
 * Plant a crop on tilled soil.
 */
function farmPlant(tileX, tileY, cropType) {
  const farm = _ensureFarmState();
  if (!farm) return { ok: false, reason: 'No farm state' };

  const def = CROP_DEFS[cropType];
  if (!def) return { ok: false, reason: 'Unknown crop: ' + cropType };

  const key = tileX + ',' + tileY;

  // Must be tilled soil
  if (!farm.soil[key]) return { ok: false, reason: 'Till the soil first!' };

  // Can't plant on occupied tile
  if (farm.crops[key]) return { ok: false, reason: 'Tile already has a crop' };

  // Check seed catalog (must have discovered this seed)
  if (!farm.seedCatalog[cropType]) {
    return { ok: false, reason: 'You haven\'t discovered ' + def.name + ' seeds yet! Explore ' + (def.zone === 'any' ? 'the world' : def.zone.replace(/_/g, ' ')) + '.' };
  }

  farm.crops[key] = {
    cropType: cropType,
    plantedAt: Date.now(),
    watered: false,
    wateredAt: 0,
    stage: 0,
  };

  // Track for achievements
  if (!G.farmStats) G.farmStats = {};
  if (!G.farmStats.totalPlanted) G.farmStats.totalPlanted = 0;
  G.farmStats.totalPlanted++;

  console.log('[Farm] Planted', def.name, 'at', key);
  if (typeof saveGame === 'function') saveGame();
  return { ok: true, name: def.name };
}

/**
 * Water a crop (or all soil in a tile).
 */
function farmWater(tileX, tileY) {
  const farm = _ensureFarmState();
  if (!farm) return false;

  const key = tileX + ',' + tileY;

  // Water the soil
  if (farm.soil[key]) {
    farm.soil[key].watered = true;
    farm.soil[key].wateredAt = Date.now();
  }

  // Water the crop
  const crop = farm.crops[key];
  if (crop && !crop.watered) {
    crop.watered = true;
    crop.wateredAt = Date.now();
    console.log('[Farm] Watered crop at', key);
    if (typeof saveGame === 'function') saveGame();
    return true;
  }

  return false;
}

/**
 * Water all crops within radius of a tile (well mechanic).
 */
function farmWaterArea(centerX, centerY, radius) {
  const farm = _ensureFarmState();
  if (!farm) return 0;
  let count = 0;

  for (const key in farm.crops) {
    const parts = key.split(',');
    const tx = parseInt(parts[0]);
    const ty = parseInt(parts[1]);
    const dist = Math.abs(tx - centerX) + Math.abs(ty - centerY);
    if (dist <= radius && !farm.crops[key].watered) {
      farmWater(tx, ty);
      count++;
    }
  }

  return count;
}

/**
 * Harvest a fully grown crop. Returns harvest result with quality.
 */
function farmHarvest(tileX, tileY) {
  const farm = _ensureFarmState();
  if (!farm) return null;

  const key = tileX + ',' + tileY;
  const crop = farm.crops[key];
  if (!crop) return null;

  const stage = _calcCropStage(crop);
  if (stage < FARM_STAGE_COUNT - 1) return null; // not ready

  const def = CROP_DEFS[crop.cropType];
  if (!def) return null;

  // Determine quality
  const quality = _determineQuality(crop, tileX, tileY);

  // Calculate yield
  let amount = def.baseYield;

  // Quality multiplier
  amount = Math.ceil(amount * quality.mult);

  // Botanist: +25% per rank
  if (typeof getTalentRank === 'function') {
    const harvestRank = getTalentRank('botanist', 'bot_hrv_1');
    if (harvestRank > 0) amount = Math.ceil(amount * (1 + 0.25 * harvestRank));
  }

  // Trellis nearby: +1
  if (typeof getStructuresNear === 'function') {
    const nearby = getStructuresNear(tileX, tileY, 3);
    if (nearby.some(s => s.type === 'trellis')) amount += 1;
  }

  // Cornucopia (bot_hrv_4): double everything
  if (typeof getTalentRank === 'function' && getTalentRank('botanist', 'bot_hrv_4') >= 1) {
    amount *= 2;
  }

  // Add resource to G
  if (G[def.resource] === undefined) G[def.resource] = 0;
  G[def.resource] += amount;

  // Track stats
  if (!G.farmStats) G.farmStats = {};
  if (!G.farmStats.totalHarvested) G.farmStats.totalHarvested = 0;
  G.farmStats.totalHarvested++;
  if (quality === QUALITY.GOLD) {
    if (!G.farmStats.goldHarvests) G.farmStats.goldHarvests = 0;
    G.farmStats.goldHarvests++;
  }

  // Seed drop chance (30% to get a seed back)
  if (Math.random() < 0.3) {
    // Already in catalog, but this is how they "reproduce"
    farm.seedCatalog[crop.cropType] = true;
  }

  // Remove the crop (soil stays tilled)
  delete farm.crops[key];
  // Reset soil watering for next planting
  if (farm.soil[key]) {
    farm.soil[key].watered = false;
    farm.soil[key].wateredAt = 0;
  }

  console.log('[Farm] Harvested', def.name, quality.name, '→ +' + amount, def.resourceName);
  if (typeof saveGame === 'function') saveGame();

  return {
    name: def.name,
    cropType: crop.cropType,
    resource: def.resource,
    resourceName: def.resourceName,
    amount: amount,
    quality: quality,
    color: def.color,
  };
}

/**
 * Tick all farm crops — update stages, handle auto-harvest, season-kill.
 */
function tickFarm() {
  const farm = _ensureFarmState();
  if (!farm) return { harvested: [], stageChanges: [], killed: [] };

  const events = { harvested: [], stageChanges: [], killed: [] };

  for (const key in farm.crops) {
    const crop = farm.crops[key];
    const def = CROP_DEFS[crop.cropType];
    if (!def) continue;

    const oldStage = crop.stage || 0;
    const newStage = _calcCropStage(crop);

    if (newStage !== oldStage) {
      crop.stage = newStage;
      events.stageChanges.push({
        key: key,
        cropType: crop.cropType,
        name: def.name,
        oldStage: oldStage,
        newStage: newStage,
        stageName: FARM_STAGES[newStage],
      });
    }

    // Winter frost kill (non-frost-hardy crops die in winter if not in greenhouse)
    if (typeof getSeason === 'function') {
      const season = getSeason();
      if (season.season === 'winter' && def.seasonBonus !== 'winter' && !def.rare) {
        // Check if in greenhouse
        const coords = key.split(',');
        const tx = parseInt(coords[0]);
        const ty = parseInt(coords[1]);
        let inGreenhouse = false;
        if (typeof getStructuresNear === 'function') {
          const nearby = getStructuresNear(tx, ty, 2);
          if (nearby.some(s => s.type === 'greenhouse')) inGreenhouse = true;
        }
        // Check if near lamp post (frost protection)
        if (!inGreenhouse && typeof getStructuresNear === 'function') {
          const nearby = getStructuresNear(tx, ty, 3);
          if (nearby.some(s => s.type === 'lamp_post')) inGreenhouse = true; // lamp protects
        }
        if (!inGreenhouse && season.progress > 0.8) {
          // Deep winter — crop withers
          events.killed.push({ key: key, name: def.name, reason: 'frost' });
          delete farm.crops[key];
          continue;
        }
      }
    }

    // Auto-harvest (Botanist bot_hrv_2)
    if (newStage >= FARM_STAGE_COUNT - 1 && typeof getTalentRank === 'function') {
      if (getTalentRank('botanist', 'bot_hrv_2') >= 1) {
        const coords = key.split(',');
        const result = farmHarvest(parseInt(coords[0]), parseInt(coords[1]));
        if (result) events.harvested.push(result);
      }
    }
  }

  return events;
}

/**
 * Get status info for a crop (for UI).
 */
function getCropStatus(tileX, tileY) {
  const farm = _ensureFarmState();
  if (!farm) return null;

  const key = tileX + ',' + tileY;
  const crop = farm.crops[key];
  if (!crop) return null;

  const def = CROP_DEFS[crop.cropType];
  if (!def) return null;

  const stage = _calcCropStage(crop);
  const progress = _calcCropProgress(crop);
  const remaining = _calcTimeRemaining(crop);

  return {
    name: def.name,
    cropType: crop.cropType,
    stage: stage,
    stageName: FARM_STAGES[stage],
    progress: progress,
    ready: stage >= FARM_STAGE_COUNT - 1,
    watered: crop.watered,
    color: def.color,
    resourceName: def.resourceName,
    baseYield: def.baseYield,
    zone: def.zone,
    seasonBonus: def.seasonBonus,
    rare: def.rare,
    timeRemaining: remaining,
    timeRemainingStr: _formatTime(remaining),
    atlasRow: def.atlasRow,
    atlasFrames: def.atlasFrames,
    tileX: tileX,
    tileY: tileY,
  };
}

/**
 * Get all crop statuses.
 */
function getAllCropStatus() {
  const farm = _ensureFarmState();
  if (!farm) return [];

  const results = [];
  for (const key in farm.crops) {
    const parts = key.split(',');
    const status = getCropStatus(parseInt(parts[0]), parseInt(parts[1]));
    if (status) results.push(status);
  }
  return results;
}

/**
 * Discover a seed type (e.g. after exploring a zone or defeating an enemy).
 */
function discoverSeed(cropType) {
  const farm = _ensureFarmState();
  if (!farm) return false;
  if (!CROP_DEFS[cropType]) return false;
  if (farm.seedCatalog[cropType]) return false; // already known

  farm.seedCatalog[cropType] = true;
  console.log('[Farm] Discovered seed:', CROP_DEFS[cropType].name);
  if (typeof saveGame === 'function') saveGame();
  return true;
}

/**
 * Auto-discover seeds for the current zone.
 * Call when player enters a new zone or wins a battle.
 */
function discoverZoneSeeds(zoneName) {
  const farm = _ensureFarmState();
  if (!farm) return [];

  const discovered = [];
  for (const key in CROP_DEFS) {
    const def = CROP_DEFS[key];
    if (def.zone === zoneName && !farm.seedCatalog[key]) {
      // 25% chance per encounter to discover a zone seed
      if (Math.random() < 0.25) {
        farm.seedCatalog[key] = true;
        discovered.push(def.name);
        console.log('[Farm] Zone discovery:', def.name, 'in', zoneName);
      }
    }
  }
  if (discovered.length > 0 && typeof saveGame === 'function') saveGame();
  return discovered;
}

/**
 * Get available seeds for planting (discovered seeds only).
 */
function getAvailableSeeds() {
  const farm = _ensureFarmState();
  if (!farm) return [];

  const seeds = [];
  for (const key in CROP_DEFS) {
    if (farm.seedCatalog[key]) {
      const def = CROP_DEFS[key];
      seeds.push({
        cropType: key,
        name: def.name,
        resource: def.resource,
        resourceName: def.resourceName,
        zone: def.zone,
        growTime: def.growTime,
        rare: def.rare,
        color: def.color,
        seasonBonus: def.seasonBonus,
      });
    }
  }
  return seeds;
}

/**
 * Get seed catalog completion stats.
 */
function getSeedCatalogStats() {
  const farm = _ensureFarmState();
  if (!farm) return { discovered: 0, total: 0, pct: 0 };

  const total = Object.keys(CROP_DEFS).length;
  const discovered = Object.keys(farm.seedCatalog).length;
  return {
    discovered: discovered,
    total: total,
    pct: Math.round((discovered / total) * 100),
  };
}

/**
 * Check if a tile has tilled soil.
 */
function isSoilTilled(tileX, tileY) {
  const farm = _ensureFarmState();
  if (!farm) return false;
  return !!farm.soil[tileX + ',' + tileY];
}

/**
 * Check if soil is watered.
 */
function isSoilWatered(tileX, tileY) {
  const farm = _ensureFarmState();
  if (!farm) return false;
  const soil = farm.soil[tileX + ',' + tileY];
  return soil ? soil.watered : false;
}

/**
 * Get all tilled soil tiles (for rendering).
 */
function getAllSoilTiles() {
  const farm = _ensureFarmState();
  if (!farm) return [];

  const tiles = [];
  for (const key in farm.soil) {
    const parts = key.split(',');
    tiles.push({
      tileX: parseInt(parts[0]),
      tileY: parseInt(parts[1]),
      watered: farm.soil[key].watered,
    });
  }
  return tiles;
}

console.log('[Farm] Farming module loaded — ' + Object.keys(CROP_DEFS).length + ' crop types');
