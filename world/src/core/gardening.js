// ══════════════════════════════════════════════════════════
//  GARDENING MODULE — Plant, grow, water, harvest
//  Self-contained module for the Battle of Origins world.
//  Exposes: PLANT_TYPES, plantSeed(), tickGarden(),
//           harvestPlant(), waterPlant(), renderGardenPlants(),
//           getPlantStatus(), loadGardenAssets()
//  Sprites: ERW Grass Land 2.0 crop sprites (32x32, 8 stages)
// ══════════════════════════════════════════════════════════

// ─── Plant Type Definitions ─────────────────────────────
//
//  Each plant has:
//    name         — display name
//    resource     — G property key yielded on harvest
//    resourceName — human-readable resource name
//    yield        — amount per harvest
//    color        — fallback tint if sprites missing
//    spriteBase   — sprite key prefix (stages 0-7)
//    growthStages — array of 5 durations in ms:
//                   [seed, sprout, growing, mature, harvestable]
//                   Each value = time to REACH that stage.
//    rare         — if true, uses slow growth timings
//
//  Growth stages map to 8 ERW crop frames:
//    stage 0 (seed)        → frame 0-1
//    stage 1 (sprout)      → frame 2-3
//    stage 2 (growing)     → frame 4-5
//    stage 3 (mature)      → frame 6
//    stage 4 (harvestable) → frame 7

const PLANT_TYPES = {

  healing_herb: {
    name: 'Healing Herb',
    resource: 'healingSeeds',
    resourceName: 'Healing Seeds',
    yield: 2,
    color: 0x44cc44,
    spriteBase: 'plant_healing_herb',
    rare: false,
    growthStages: [
      0,           // seed — instant (planted)
      2  * 60000,  // sprout at 2 min
      5  * 60000,  // growing at 5 min
      8  * 60000,  // mature at 8 min
      10 * 60000,  // harvestable at 10 min
    ],
  },

  fire_bloom: {
    name: 'Fire Bloom',
    resource: 'sacredFire',
    resourceName: 'Sacred Fire',
    yield: 2,
    color: 0xff6622,
    spriteBase: 'plant_fire_bloom',
    rare: false,
    growthStages: [
      0,
      2  * 60000,
      5  * 60000,
      8  * 60000,
      10 * 60000,
    ],
  },

  frost_lily: {
    name: 'Frost Lily',
    resource: 'iceShards',
    resourceName: 'Ice Shards',
    yield: 2,
    color: 0x66aaff,
    spriteBase: 'plant_frost_lily',
    rare: false,
    growthStages: [
      0,
      2  * 60000,
      5  * 60000,
      8  * 60000,
      10 * 60000,
    ],
  },

  moon_flower: {
    name: 'Moon Flower',
    resource: 'moonstone',
    resourceName: 'Moonstones',
    yield: 1,
    color: 0xeeddaa,
    spriteBase: 'plant_moon_flower',
    rare: true,
    growthStages: [
      0,
      5  * 60000,   // sprout at 5 min
      13 * 60000,   // growing at 13 min
      21 * 60000,   // mature at 21 min
      28 * 60000,   // harvestable at 28 min
    ],
  },

  lucky_clover: {
    name: 'Lucky Clover',
    resource: 'luckyStones',
    resourceName: 'Lucky Stones',
    yield: 1,
    color: 0x22dd66,
    spriteBase: 'plant_lucky_clover',
    rare: true,
    growthStages: [
      0,
      5  * 60000,
      13 * 60000,
      21 * 60000,
      28 * 60000,
    ],
  },
};

// ─── Stage names for UI ─────────────────────────────────
const STAGE_NAMES = ['Seed', 'Sprout', 'Growing', 'Mature', 'Harvestable'];

// ERW crop frame indices per growth stage (8-frame sprites)
const STAGE_FRAMES = [0, 2, 4, 6, 7];

// ─── Garden State ───────────────────────────────────────
//
//  G.garden = {
//    plots: {
//      "x,y": {
//        plantType:  string (key into PLANT_TYPES),
//        plantedAt:  number (Date.now()),
//        watered:    boolean,
//        wateredAt:  number (Date.now() or 0),
//        stage:      number (0-4, cached from last tick),
//      }
//    }
//  }

function _ensureGardenState() {
  if (typeof G === 'undefined') return null;
  if (!G.garden) G.garden = { plots: {} };
  if (!G.garden.plots) G.garden.plots = {};
  return G.garden;
}

// ─── Growth Calculation ─────────────────────────────────

// Get the current growth stage (0-4) for a plant
function _calcStage(plot) {
  const def = PLANT_TYPES[plot.plantType];
  if (!def) return 0;

  const now = Date.now();
  let elapsed = now - plot.plantedAt;

  // Watering doubles growth speed (halves effective time)
  if (plot.watered) {
    const wateredDuration = now - (plot.wateredAt || plot.plantedAt);
    // Time before watering counts normal, time after counts double
    const normalTime = (plot.wateredAt || plot.plantedAt) - plot.plantedAt;
    elapsed = normalTime + wateredDuration * 2;
  }

  // Walk stages backwards to find the highest reached
  for (let s = def.growthStages.length - 1; s >= 0; s--) {
    if (elapsed >= def.growthStages[s]) return s;
  }
  return 0;
}

// Get progress within current stage (0.0 - 1.0)
function _calcProgress(plot) {
  const def = PLANT_TYPES[plot.plantType];
  if (!def) return 0;

  const now = Date.now();
  let elapsed = now - plot.plantedAt;

  if (plot.watered) {
    const wateredDuration = now - (plot.wateredAt || plot.plantedAt);
    const normalTime = (plot.wateredAt || plot.plantedAt) - plot.plantedAt;
    elapsed = normalTime + wateredDuration * 2;
  }

  const stage = _calcStage(plot);
  if (stage >= 4) return 1.0; // fully grown

  const stageStart = def.growthStages[stage];
  const stageEnd = def.growthStages[stage + 1];
  if (stageEnd <= stageStart) return 1.0;

  return Math.min(1.0, (elapsed - stageStart) / (stageEnd - stageStart));
}

// Overall progress 0-1 (across all stages)
function _calcTotalProgress(plot) {
  const def = PLANT_TYPES[plot.plantType];
  if (!def) return 0;

  const now = Date.now();
  let elapsed = now - plot.plantedAt;

  if (plot.watered) {
    const wateredDuration = now - (plot.wateredAt || plot.plantedAt);
    const normalTime = (plot.wateredAt || plot.plantedAt) - plot.plantedAt;
    elapsed = normalTime + wateredDuration * 2;
  }

  const total = def.growthStages[def.growthStages.length - 1];
  if (total <= 0) return 1.0;
  return Math.min(1.0, elapsed / total);
}

// Time remaining until harvestable (ms)
function _timeRemaining(plot) {
  const def = PLANT_TYPES[plot.plantType];
  if (!def) return 0;

  const now = Date.now();
  let elapsed = now - plot.plantedAt;

  if (plot.watered) {
    const wateredDuration = now - (plot.wateredAt || plot.plantedAt);
    const normalTime = (plot.wateredAt || plot.plantedAt) - plot.plantedAt;
    elapsed = normalTime + wateredDuration * 2;
  }

  const total = def.growthStages[def.growthStages.length - 1];
  const remaining = total - elapsed;

  // If watered, actual remaining time is halved
  if (plot.watered) return Math.max(0, remaining / 2);
  return Math.max(0, remaining);
}

// ─── Public API ─────────────────────────────────────────

/**
 * Plant a seed on a garden tile.
 * @param {number} tileX - tile X coordinate
 * @param {number} tileY - tile Y coordinate
 * @param {string} plantType - key from PLANT_TYPES
 * @returns {boolean} success
 */
function plantSeed(tileX, tileY, plantType) {
  const garden = _ensureGardenState();
  if (!garden) return false;

  // Validate plant type
  if (!PLANT_TYPES[plantType]) {
    console.warn('[Garden] Unknown plant type:', plantType);
    return false;
  }

  const key = tileX + ',' + tileY;

  // Don't plant on occupied tile
  if (garden.plots[key]) {
    console.warn('[Garden] Tile already occupied:', key);
    return false;
  }

  garden.plots[key] = {
    plantType: plantType,
    plantedAt: Date.now(),
    watered: false,
    wateredAt: 0,
    stage: 0,
  };

  console.log('[Garden] Planted', PLANT_TYPES[plantType].name, 'at', key);
  if (typeof saveGame === 'function') saveGame();
  return true;
}

/**
 * Water a plant to make it grow 2x faster.
 * @param {number} tileX
 * @param {number} tileY
 * @returns {boolean} success
 */
function waterPlant(tileX, tileY) {
  const garden = _ensureGardenState();
  if (!garden) return false;

  const key = tileX + ',' + tileY;
  const plot = garden.plots[key];
  if (!plot) return false;
  if (plot.watered) return false; // already watered

  plot.watered = true;
  plot.wateredAt = Date.now();

  console.log('[Garden] Watered plant at', key);
  if (typeof saveGame === 'function') saveGame();
  return true;
}

/**
 * Harvest a fully grown plant. Adds resources to G.
 * @param {number} tileX
 * @param {number} tileY
 * @returns {{ name: string, resource: string, resourceName: string, amount: number } | null}
 */
function harvestPlant(tileX, tileY) {
  const garden = _ensureGardenState();
  if (!garden) return null;

  const key = tileX + ',' + tileY;
  const plot = garden.plots[key];
  if (!plot) return null;

  const stage = _calcStage(plot);
  if (stage < 4) {
    console.warn('[Garden] Plant not ready:', key, 'stage', stage);
    return null;
  }

  const def = PLANT_TYPES[plot.plantType];
  if (!def) return null;

  // Calculate yield (base + talent bonuses)
  let amount = def.yield;

  // Botanist: +25% yield per rank (bot_hrv_1)
  if (typeof getTalentRank === 'function') {
    const harvestRank = getTalentRank('botanist', 'bot_hrv_1');
    if (harvestRank > 0) amount = Math.ceil(amount * (1 + 0.25 * harvestRank));
  }

  // Trellis nearby: +1 yield
  if (typeof getStructuresNear === 'function') {
    const nearbyStructures = getStructuresNear(tileX, tileY, 3);
    if (nearbyStructures.some(s => s.type === 'trellis')) {
      amount += 1;
    }
  }

  // Eternal Harvest (bot_hrv_4): double everything
  if (typeof getTalentRank === 'function' && getTalentRank('botanist', 'bot_hrv_4') >= 1) {
    amount *= 2;
  }

  // Add resource to G
  if (G[def.resource] !== undefined) {
    G[def.resource] += amount;
  }

  // Track achievement / rep
  if (G.rep) {
    if (!G.rep.plantsHarvested) G.rep.plantsHarvested = 0;
    G.rep.plantsHarvested += 1;
  }

  // Remove the plant
  delete garden.plots[key];

  console.log('[Garden] Harvested', def.name, '→ +' + amount, def.resourceName);
  if (typeof saveGame === 'function') saveGame();

  return {
    name: def.name,
    resource: def.resource,
    resourceName: def.resourceName,
    amount: amount,
  };
}

/**
 * Tick all garden plants — updates cached stage values.
 * Call this periodically (e.g. every 5-10 seconds).
 * Also handles auto-harvest for Botanist talent (bot_hrv_2).
 * @returns {{ harvested: Array, stageChanges: Array }} events that occurred
 */
function tickGarden() {
  const garden = _ensureGardenState();
  if (!garden) return { harvested: [], stageChanges: [] };

  const events = { harvested: [], stageChanges: [] };
  const toRemove = [];

  for (const key in garden.plots) {
    const plot = garden.plots[key];
    const oldStage = plot.stage || 0;
    const newStage = _calcStage(plot);

    if (newStage !== oldStage) {
      plot.stage = newStage;
      events.stageChanges.push({
        key: key,
        plantType: plot.plantType,
        oldStage: oldStage,
        newStage: newStage,
        name: (PLANT_TYPES[plot.plantType] || {}).name || 'Unknown',
        stageName: STAGE_NAMES[newStage] || 'Unknown',
      });
    }

    // Auto-harvest (Botanist: bot_hrv_2)
    if (newStage >= 4 && typeof getTalentRank === 'function') {
      const autoRank = getTalentRank('botanist', 'bot_hrv_2');
      if (autoRank >= 1) {
        const coords = key.split(',');
        const result = harvestPlant(parseInt(coords[0]), parseInt(coords[1]));
        if (result) {
          events.harvested.push(result);
          toRemove.push(key);
        }
      }
    }
  }

  return events;
}

/**
 * Get status info for a single plant (for UI display).
 * @param {number} tileX
 * @param {number} tileY
 * @returns {object|null}
 */
function getPlantStatus(tileX, tileY) {
  const garden = _ensureGardenState();
  if (!garden) return null;

  const key = tileX + ',' + tileY;
  const plot = garden.plots[key];
  if (!plot) return null;

  const def = PLANT_TYPES[plot.plantType];
  if (!def) return null;

  const stage = _calcStage(plot);
  const progress = _calcTotalProgress(plot);
  const remaining = _timeRemaining(plot);

  return {
    name: def.name,
    plantType: plot.plantType,
    stage: stage,
    stageName: STAGE_NAMES[stage],
    progress: progress,
    ready: stage >= 4,
    watered: plot.watered,
    color: def.color,
    resourceName: def.resourceName,
    yield: def.yield,
    timeRemaining: remaining,
    timeRemainingStr: _formatTime(remaining),
    spriteFrame: STAGE_FRAMES[stage],
  };
}

/**
 * Get status for all plants in all gardens.
 * @returns {Array<object>}
 */
function getAllPlantStatus() {
  const garden = _ensureGardenState();
  if (!garden) return [];

  const results = [];
  for (const key in garden.plots) {
    const coords = key.split(',');
    const status = getPlantStatus(parseInt(coords[0]), parseInt(coords[1]));
    if (status) {
      status.tileX = parseInt(coords[0]);
      status.tileY = parseInt(coords[1]);
      results.push(status);
    }
  }
  return results;
}

// Format milliseconds as "Xm Ys"
function _formatTime(ms) {
  if (ms <= 0) return 'Ready!';
  const totalSec = Math.ceil(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min > 0) return min + 'm ' + sec + 's';
  return sec + 's';
}

// ─── Sprite Loading ─────────────────────────────────────
//
//  Call loadGardenAssets(scene) in your Boot/Preload scene.
//  Each plant gets 8 individual image keys:
//    plant_healing_herb_0 ... plant_healing_herb_7

/**
 * Load all garden plant sprites into the Phaser texture cache.
 * Call during a preload() phase.
 * @param {Phaser.Scene} scene
 */
function loadGardenAssets(scene) {
  const plants = [
    { base: 'plant_healing_herb', file: 'healing-herb' },
    { base: 'plant_fire_bloom',   file: 'fire-bloom' },
    { base: 'plant_frost_lily',   file: 'frost-lily' },
    { base: 'plant_moon_flower',  file: 'moon-flower' },
    { base: 'plant_lucky_clover', file: 'lucky-clover' },
  ];

  for (const p of plants) {
    for (let i = 0; i < 8; i++) {
      const key = p.base + '_' + i;
      if (!scene.textures.exists(key)) {
        scene.load.image(key, 'assets/erw/plants/' + p.file + '-' + i + '.png');
      }
    }
  }

  // Harvest sparkle spritesheet (16 frames, 96x96 each in a 1536x96 strip)
  if (!scene.textures.exists('harvest_sparkle')) {
    scene.load.spritesheet('harvest_sparkle', 'assets/erw/plants/harvest-sparkle.png', {
      frameWidth: 96, frameHeight: 96,
    });
  }

  // Flower icons for harvest popups
  const flowers = ['green', 'red', 'blue', 'yellow', 'purple'];
  for (const f of flowers) {
    const key = 'flower_' + f;
    if (!scene.textures.exists(key)) {
      scene.load.image(key, 'assets/erw/plants/flower-' + f + '.png');
    }
  }
}

// ─── Visual Rendering ───────────────────────────────────
//
//  renderGardenPlants(scene) draws a sprite for each plant
//  on its garden tile. Call after structures render.
//  Manages a sprite pool: _gardenSprites on the scene.

/**
 * Render all garden plants on the world map.
 * Call from WorldScene update or after structure render.
 * @param {Phaser.Scene} scene
 */
function renderGardenPlants(scene) {
  // Clean up old sprites
  if (scene._gardenSprites) {
    scene._gardenSprites.forEach(s => {
      if (s.sprite) s.sprite.destroy();
      if (s.waterIcon) s.waterIcon.destroy();
      if (s.glowFx) s.glowFx.destroy();
    });
  }
  scene._gardenSprites = [];

  const garden = _ensureGardenState();
  if (!garden) return;

  const T = 32; // tile size

  for (const key in garden.plots) {
    const plot = garden.plots[key];
    const def = PLANT_TYPES[plot.plantType];
    if (!def) continue;

    const coords = key.split(',');
    const tx = parseInt(coords[0]);
    const ty = parseInt(coords[1]);
    const px = tx * T + T / 2;
    const py = ty * T + T / 2;

    const stage = _calcStage(plot);
    const frame = STAGE_FRAMES[stage];
    const texKey = def.spriteBase + '_' + frame;

    let sprite;
    if (scene.textures.exists(texKey)) {
      sprite = scene.add.image(px, py, texKey).setDepth(5);
    } else {
      // Fallback: colored circle placeholder
      const radius = 4 + stage * 3;
      sprite = scene.add.circle(px, py, radius, def.color, 0.85).setDepth(5);
    }

    const entry = { sprite: sprite, waterIcon: null, glowFx: null };

    // Watered indicator — small blue droplet
    if (plot.watered) {
      const drop = scene.add.text(px + 10, py - 12, '💧', {
        fontSize: '8px',
      }).setOrigin(0.5).setDepth(6);
      entry.waterIcon = drop;
    }

    // Harvestable glow — pulsing highlight
    if (stage >= 4) {
      const glow = scene.add.circle(px, py, 14, def.color, 0.25).setDepth(4);

      // Pulse animation
      scene.tweens.add({
        targets: glow,
        alpha: { from: 0.15, to: 0.4 },
        scale: { from: 1.0, to: 1.3 },
        duration: 800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });

      entry.glowFx = glow;
    }

    scene._gardenSprites.push(entry);
  }
}

/**
 * Play a harvest celebration effect at a tile.
 * @param {Phaser.Scene} scene
 * @param {number} tileX
 * @param {number} tileY
 * @param {number} color — plant color tint
 */
function playHarvestEffect(scene, tileX, tileY, color) {
  const T = 32;
  const px = tileX * T + T / 2;
  const py = tileY * T + T / 2;

  // Sparkle animation if available
  if (scene.textures.exists('harvest_sparkle')) {
    const sparkle = scene.add.sprite(px, py, 'harvest_sparkle', 0)
      .setDepth(10).setScale(0.5);

    // Create animation if not yet defined
    if (!scene.anims.exists('harvest_sparkle_anim')) {
      scene.anims.create({
        key: 'harvest_sparkle_anim',
        frames: scene.anims.generateFrameNumbers('harvest_sparkle', { start: 0, end: 15 }),
        frameRate: 20,
        repeat: 0,
      });
    }

    sparkle.play('harvest_sparkle_anim');
    sparkle.on('animationcomplete', () => sparkle.destroy());
  }

  // Rising particles — small colored circles
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const dist = 8 + Math.random() * 12;
    const particle = scene.add.circle(
      px + Math.cos(angle) * 4,
      py + Math.sin(angle) * 4,
      2 + Math.random() * 2,
      color, 0.9
    ).setDepth(10);

    scene.tweens.add({
      targets: particle,
      x: px + Math.cos(angle) * dist,
      y: py + Math.sin(angle) * dist - 20,
      alpha: 0,
      scale: 0.3,
      duration: 600 + Math.random() * 400,
      ease: 'Cubic.easeOut',
      onComplete: () => particle.destroy(),
    });
  }

  // Floating "+resource" text
  const floatText = scene.add.text(px, py - 10, '✦', {
    fontSize: '14px', fontFamily: 'Georgia, serif',
    color: '#' + (color & 0xffffff).toString(16).padStart(6, '0'),
  }).setOrigin(0.5).setDepth(11);

  scene.tweens.add({
    targets: floatText,
    y: py - 40,
    alpha: 0,
    duration: 1200,
    ease: 'Cubic.easeOut',
    onComplete: () => floatText.destroy(),
  });
}

// ─── Integration Helpers ────────────────────────────────

/**
 * Remove all plants from a tile range (e.g. when a structure is demolished).
 * @param {number} x1
 * @param {number} y1
 * @param {number} x2
 * @param {number} y2
 */
function clearGardenArea(x1, y1, x2, y2) {
  const garden = _ensureGardenState();
  if (!garden) return;

  for (let x = x1; x <= x2; x++) {
    for (let y = y1; y <= y2; y++) {
      delete garden.plots[x + ',' + y];
    }
  }
  if (typeof saveGame === 'function') saveGame();
}

/**
 * Count total active plants across all gardens.
 * @returns {number}
 */
function getGardenPlantCount() {
  const garden = _ensureGardenState();
  if (!garden) return 0;
  return Object.keys(garden.plots).length;
}

/**
 * Check if a tile has a plant on it.
 * @param {number} tileX
 * @param {number} tileY
 * @returns {boolean}
 */
function hasPlant(tileX, tileY) {
  const garden = _ensureGardenState();
  if (!garden) return false;
  return !!garden.plots[tileX + ',' + tileY];
}

/**
 * Get plants within a radius of a tile (for structure bonuses).
 * @param {number} cx - center tile X
 * @param {number} cy - center tile Y
 * @param {number} radius - tile radius
 * @returns {Array}
 */
function getPlantsNear(cx, cy, radius) {
  const garden = _ensureGardenState();
  if (!garden) return [];

  const results = [];
  for (const key in garden.plots) {
    const coords = key.split(',');
    const tx = parseInt(coords[0]);
    const ty = parseInt(coords[1]);
    const dist = Math.abs(tx - cx) + Math.abs(ty - cy);
    if (dist <= radius) {
      const status = getPlantStatus(tx, ty);
      if (status) results.push(status);
    }
  }
  return results;
}

// ─── Backward Compatibility ─────────────────────────────
//
//  The existing structures.js has plantInGarden/harvestGarden
//  that work on structure IDs. This module works on tile coords.
//  Both systems coexist — structures.js handles the garden
//  panel UI, this module provides the deeper growth system
//  with sprites and watering.
//
//  To bridge: when a garden structure is placed at (sx, sy),
//  planting via the panel can call:
//    plantSeed(sx + slotX, sy + slotY, plantType)
//  where slotX/slotY are offsets within the 2x2 garden grid.

console.log('[Garden] Gardening module loaded — ' + Object.keys(PLANT_TYPES).length + ' plant types');
