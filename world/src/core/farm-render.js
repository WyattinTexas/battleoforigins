// ══════════════════════════════════════════════════════════
//  FARM RENDERER — Layered visual rendering for farming
//  Renders: soil tiles, crop sprites, quality stars,
//           season effects, harvest celebrations
//  Uses ERW assets: fertilized-soil.png, atlas-sheet4-crops.png,
//                   nature-particles.png, existing plant sprites
// ══════════════════════════════════════════════════════════

// ─── Atlas Mapping ──────────────────────────────────────
//
//  atlas-sheet4-crops.png (1088x576, 32x32 grid = 34 cols x 18 rows)
//
//  Crop growth sprites are in the lower half of the atlas.
//  Each crop has ~8 frames showing seed→sprout→growing→mature→harvest.
//  We map each crop to a row region and frame count.
//
//  The atlas layout (from visual inspection):
//    Row 7-8:   Summer crops start (blueberry, wheat, melon, corn...)
//    Row 9-10:  More summer crops (hot pepper, radish, red cabbage, tomato)
//    Row 11-12: Spring crops (carrot, cauliflower, potato, parsnip...)
//    Row 13-14: More spring (garlic, green bean, strawberry, coffeebean)
//    Row 15-16: Fall crops (pumpkin, broccoli, artichoke, eggplant...)
//    Top-right: Soil patches (rows 0-4, cols 26-33)
//
//  For crops with existing individual sprites (erw/plants/),
//  we prefer those. New crops use atlas regions or tinted fallbacks.

// Map crop types to atlas frame regions (col, row, numFrames)
// These reference the erw_crops spritesheet loaded as 32x32 grid
const CROP_ATLAS_MAP = {
  // Existing crops — use individual plant sprites (loaded by gardening.js)
  healing_herb: { useIndividual: true, spriteBase: 'plant_healing_herb' },
  frost_lily:   { useIndividual: true, spriteBase: 'plant_frost_lily' },
  fire_bloom:   { useIndividual: true, spriteBase: 'plant_fire_bloom' },
  moon_flower:  { useIndividual: true, spriteBase: 'plant_moon_flower' },
  lucky_clover: { useIndividual: true, spriteBase: 'plant_lucky_clover' },

  // New crops — atlas regions (col * 34 + row offset)
  // Summer crops section (approximate atlas positions)
  sunwheat:      { atlasStart: 7 * 34 + 1,  frames: 8 },  // wheat row
  golden_pumpkin:{ atlasStart: 15 * 34 + 20, frames: 6 },  // pumpkin (fall section)
  honey_bloom:   { atlasStart: 7 * 34 + 10,  frames: 8 },  // blueberry-like
  ice_berry:     { atlasStart: 7 * 34 + 10,  frames: 8 },  // reuse blueberry tinted
  crystal_moss:  { atlasStart: 11 * 34 + 10, frames: 6 },  // cauliflower-like
  ember_pepper:  { atlasStart: 11 * 34 + 0,  frames: 8 },  // hot pepper
  magma_root:    { atlasStart: 9 * 34 + 10,  frames: 8 },  // potato-like
  shadow_vine:   { atlasStart: 13 * 34 + 10, frames: 8 },  // green bean
  spirit_orchid: { atlasStart: 13 * 34 + 18, frames: 6 },  // strawberry-like
};

// Soil tile frame indices from fertilized-soil.png (20x7 @ 32x32)
// Row 0: top-edge soil tiles, Row 1-2: center soil, Row 3-4: wet variants,
// Row 5-6: edge transitions. White gaps = transparent (no tile).
const SOIL_FRAMES = {
  dry: {
    center: [21, 22, 23, 24, 25],     // middle row center tiles
    topLeft: 20, topRight: 26,
    botLeft: 40, botRight: 46,
    top: [21, 22, 23], bot: [41, 42, 43],
    left: [20, 40], right: [26, 46],
  },
  wet: {
    center: [61, 62, 63, 64, 65],     // lower row center tiles (darker)
    topLeft: 60, topRight: 66,
    botLeft: 80, botRight: 86,
    top: [61, 62, 63], bot: [81, 82, 83],
    left: [60, 80], right: [66, 86],
  },
};

// Growth stage → sprite frame index (for 8-frame crop sprites)
// stage 0 (seed) = frame 0, stage 1 (sprout) = frame 2,
// stage 2 (growing) = frame 4, stage 3 (mature) = frame 6,
// stage 4 (harvestable) = frame 7
const STAGE_TO_FRAME = [0, 2, 4, 6, 7];

// ─── Sprite Pool Management ─────────────────────────────

function _clearFarmSprites(scene) {
  if (scene._farmSprites) {
    for (const entry of scene._farmSprites) {
      if (entry.sprite) entry.sprite.destroy();
      if (entry.waterIcon) entry.waterIcon.destroy();
      if (entry.glow) entry.glow.destroy();
      if (entry.star) entry.star.destroy();
      if (entry.soilSprite) entry.soilSprite.destroy();
    }
  }
  scene._farmSprites = [];
}

// ─── Main Render Function ───────────────────────────────

/**
 * Render the entire farm: soil + crops + effects.
 * Call from WorldScene update (slow tick, every ~5s).
 * @param {Phaser.Scene} scene
 */
function renderFarm(scene) {
  _clearFarmSprites(scene);

  if (typeof _ensureFarmState !== 'function') return;
  const farm = _ensureFarmState();
  if (!farm) return;

  const T = 32;

  // Layer 1: Soil tiles
  _renderSoilLayer(scene, farm, T);

  // Layer 2: Crop sprites
  _renderCropLayer(scene, farm, T);
}

// ─── Soil Rendering ─────────────────────────────────────

function _renderSoilLayer(scene, farm, T) {
  const soilTiles = getAllSoilTiles();
  const soilSet = new Set();
  for (const s of soilTiles) soilSet.add(s.tileX + ',' + s.tileY);

  for (const soil of soilTiles) {
    const px = soil.tileX * T + T / 2;
    const py = soil.tileY * T + T / 2;

    let sprite;

    if (scene.textures.exists('erw_soil')) {
      // Pick a soil frame — use deterministic selection based on position
      const hash = (soil.tileX * 7 + soil.tileY * 13) % 5;
      const frameSet = soil.watered ? SOIL_FRAMES.wet : SOIL_FRAMES.dry;

      // Check neighbors for edge detection
      const hasTop = soilSet.has(soil.tileX + ',' + (soil.tileY - 1));
      const hasBot = soilSet.has(soil.tileX + ',' + (soil.tileY + 1));
      const hasLeft = soilSet.has((soil.tileX - 1) + ',' + soil.tileY);
      const hasRight = soilSet.has((soil.tileX + 1) + ',' + soil.tileY);

      let frame;
      if (!hasTop && !hasLeft) frame = frameSet.topLeft;
      else if (!hasTop && !hasRight) frame = frameSet.topRight;
      else if (!hasBot && !hasLeft) frame = frameSet.botLeft;
      else if (!hasBot && !hasRight) frame = frameSet.botRight;
      else frame = frameSet.center[hash];

      // Clamp frame to valid range (20 cols * 7 rows = 140 frames max)
      if (frame >= 140) frame = frameSet.center[0];

      sprite = scene.add.image(px, py, 'erw_soil', frame).setDepth(1);
    } else {
      // Fallback: brown rectangle
      const color = soil.watered ? 0x5a3a1a : 0x7a5a3a;
      sprite = scene.add.rectangle(px, py, T - 2, T - 2, color, 0.85).setDepth(1);
    }

    scene._farmSprites.push({ soilSprite: sprite });
  }
}

// ─── Crop Rendering ─────────────────────────────────────

function _renderCropLayer(scene, farm, T) {
  for (const key in farm.crops) {
    const crop = farm.crops[key];
    const def = typeof CROP_DEFS !== 'undefined' ? CROP_DEFS[crop.cropType] : null;
    if (!def) continue;

    const parts = key.split(',');
    const tx = parseInt(parts[0]);
    const ty = parseInt(parts[1]);
    const px = tx * T + T / 2;
    const py = ty * T + T / 2;

    const stage = typeof _calcCropStage === 'function' ? _calcCropStage(crop) : (crop.stage || 0);
    const frameIdx = STAGE_TO_FRAME[Math.min(stage, 4)];

    const entry = { sprite: null, waterIcon: null, glow: null, star: null };

    // Try to render with sprites
    const atlasInfo = CROP_ATLAS_MAP[crop.cropType];
    let rendered = false;

    if (atlasInfo && atlasInfo.useIndividual) {
      // Use individual plant sprites (existing gardening.js assets)
      const texKey = atlasInfo.spriteBase + '_' + frameIdx;
      if (scene.textures.exists(texKey)) {
        entry.sprite = scene.add.image(px, py, texKey).setDepth(3);
        rendered = true;
      }
    } else if (atlasInfo && scene.textures.exists('erw_crops')) {
      // Use atlas spritesheet frame
      const atlasFrame = atlasInfo.atlasStart + Math.min(frameIdx, atlasInfo.frames - 1);
      entry.sprite = scene.add.image(px, py, 'erw_crops', atlasFrame).setDepth(3);
      rendered = true;
    }

    if (!rendered) {
      // Fallback: colored circle that grows with stage
      const radius = 4 + stage * 3;
      entry.sprite = scene.add.circle(px, py, radius, def.color, 0.85).setDepth(3);
    }

    // Watered indicator
    if (crop.watered) {
      entry.waterIcon = scene.add.text(px + 10, py - 12, '\uD83D\uDCA7', {
        fontSize: '8px',
      }).setOrigin(0.5).setDepth(6);
    }

    // Harvestable glow + quality star preview
    if (stage >= 4) {
      // Pulsing glow
      entry.glow = scene.add.circle(px, py, 14, def.color, 0.25).setDepth(2);
      scene.tweens.add({
        targets: entry.glow,
        alpha: { from: 0.15, to: 0.4 },
        scale: { from: 1.0, to: 1.3 },
        duration: 800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });

      // Quality star indicator
      const quality = typeof _determineQuality === 'function'
        ? _determineQuality(crop, tx, ty)
        : { star: '', color: '#aaaaaa' };

      if (quality.star) {
        entry.star = scene.add.text(px, py - 14, quality.star, {
          fontSize: '10px',
        }).setOrigin(0.5).setDepth(8);
      }
    }

    scene._farmSprites.push(entry);
  }
}

// ─── Season HUD ─────────────────────────────────────────

/**
 * Render the season indicator HUD element.
 * Call from WorldScene create or on season change.
 * @param {Phaser.Scene} scene
 */
function renderSeasonHUD(scene) {
  // Clean up old HUD
  if (scene._seasonHUD) {
    for (const obj of scene._seasonHUD) {
      if (obj && obj.destroy) obj.destroy();
    }
  }
  scene._seasonHUD = [];

  if (typeof getSeason !== 'function') return;
  const season = getSeason();

  const cam = scene.cameras.main;
  const x = cam.width - 120;
  const y = 50;

  // Background pill
  const bg = scene.add.rectangle(x, y, 100, 28, 0x000000, 0.5)
    .setScrollFactor(0).setDepth(99).setOrigin(0.5);
  scene._seasonHUD.push(bg);

  // Season icon + name
  const label = scene.add.text(x, y, season.icon + ' ' + season.name, {
    fontSize: '13px',
    fontFamily: 'Georgia, serif',
    fontStyle: 'bold',
    color: season.color,
    shadow: { offsetX: 1, offsetY: 1, color: '#000000', blur: 3, fill: true },
  }).setScrollFactor(0).setDepth(100).setOrigin(0.5);
  scene._seasonHUD.push(label);

  // Progress bar underneath
  const barW = 80;
  const barY = y + 18;
  const barBg = scene.add.rectangle(x, barY, barW, 3, 0x333333, 0.7)
    .setScrollFactor(0).setDepth(99).setOrigin(0.5);
  scene._seasonHUD.push(barBg);

  const fillW = barW * season.progress;
  const barFill = scene.add.rectangle(x - barW / 2 + fillW / 2, barY, fillW, 3,
    Phaser.Display.Color.HexStringToColor(season.color).color, 0.9)
    .setScrollFactor(0).setDepth(100).setOrigin(0.5);
  scene._seasonHUD.push(barFill);
}

// ─── Harvest Effect ─────────────────────────────────────

/**
 * Play a harvest celebration at a tile with quality feedback.
 * Enhanced version of gardening.js playHarvestEffect.
 */
function playFarmHarvestEffect(scene, tileX, tileY, harvestResult) {
  const T = 32;
  const px = tileX * T + T / 2;
  const py = tileY * T + T / 2;
  const color = harvestResult.color || 0x44cc44;

  // Sparkle animation
  if (scene.textures.exists('harvest_sparkle')) {
    const sparkle = scene.add.sprite(px, py, 'harvest_sparkle', 0)
      .setDepth(10).setScale(0.5);
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

  // Rising particles
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const dist = 10 + Math.random() * 14;
    const particle = scene.add.circle(
      px + Math.cos(angle) * 4,
      py + Math.sin(angle) * 4,
      2 + Math.random() * 2,
      color, 0.9
    ).setDepth(10);

    scene.tweens.add({
      targets: particle,
      x: px + Math.cos(angle) * dist,
      y: py + Math.sin(angle) * dist - 24,
      alpha: 0,
      scale: 0.2,
      duration: 600 + Math.random() * 400,
      ease: 'Cubic.easeOut',
      onComplete: () => particle.destroy(),
    });
  }

  // Quality-colored floating text
  const qualityColor = harvestResult.quality ? harvestResult.quality.color : '#ffffff';
  const qualityStar = harvestResult.quality ? harvestResult.quality.star : '';
  const floatText = scene.add.text(px, py - 10,
    '+' + harvestResult.amount + ' ' + harvestResult.resourceName + ' ' + qualityStar, {
    fontSize: '11px',
    fontFamily: 'Georgia, serif',
    fontStyle: 'bold',
    color: qualityColor,
    stroke: '#000000',
    strokeThickness: 2,
  }).setOrigin(0.5).setDepth(11);

  scene.tweens.add({
    targets: floatText,
    y: py - 50,
    alpha: 0,
    duration: 1800,
    ease: 'Cubic.easeOut',
    onComplete: () => floatText.destroy(),
  });

  // Nature particles (if loaded)
  if (scene.textures.exists('erw_nature_particles')) {
    const np = scene.add.sprite(px, py - 16, 'erw_nature_particles', 0)
      .setDepth(9).setScale(0.4).setAlpha(0.7);
    if (!scene.anims.exists('nature_particle_anim')) {
      scene.anims.create({
        key: 'nature_particle_anim',
        frames: scene.anims.generateFrameNumbers('erw_nature_particles', { start: 0, end: 15 }),
        frameRate: 12,
        repeat: 0,
      });
    }
    np.play('nature_particle_anim');
    np.on('animationcomplete', () => np.destroy());
  }
}

// ─── Tilling Visual Effect ──────────────────────────────

/**
 * Play a "digging" effect when soil is tilled.
 */
function playTillEffect(scene, tileX, tileY) {
  const T = 32;
  const px = tileX * T + T / 2;
  const py = tileY * T + T / 2;

  // Dirt particles burst upward
  for (let i = 0; i < 6; i++) {
    const dx = (Math.random() - 0.5) * 20;
    const particle = scene.add.circle(
      px + dx, py,
      2 + Math.random() * 2,
      0x8a6a3a, 0.8
    ).setDepth(10);

    scene.tweens.add({
      targets: particle,
      y: py - 15 - Math.random() * 20,
      x: px + dx * 2,
      alpha: 0,
      scale: 0.3,
      duration: 400 + Math.random() * 200,
      ease: 'Cubic.easeOut',
      onComplete: () => particle.destroy(),
    });
  }

  // Quick flash on the tile
  const flash = scene.add.rectangle(px, py, T, T, 0x8a6a3a, 0.3).setDepth(1);
  scene.tweens.add({
    targets: flash,
    alpha: 0,
    duration: 400,
    onComplete: () => flash.destroy(),
  });
}

// ─── Watering Visual Effect ─────────────────────────────

/**
 * Play a water splash effect.
 */
function playWaterEffect(scene, tileX, tileY) {
  const T = 32;
  const px = tileX * T + T / 2;
  const py = tileY * T + T / 2;

  // Blue droplets
  for (let i = 0; i < 5; i++) {
    const dx = (Math.random() - 0.5) * 16;
    const drop = scene.add.circle(
      px + dx, py - 8,
      1.5 + Math.random() * 1.5,
      0x4488cc, 0.8
    ).setDepth(10);

    scene.tweens.add({
      targets: drop,
      y: py + 4 + Math.random() * 8,
      alpha: 0,
      duration: 500 + Math.random() * 300,
      ease: 'Cubic.easeIn',
      onComplete: () => drop.destroy(),
    });
  }
}

// ─── Well Watering Animation ────────────────────────────

/**
 * Play a well watering broadcast animation (waters area).
 */
function playWellWaterEffect(scene, centerX, centerY, radius) {
  const T = 32;
  const px = centerX * T + T / 2;
  const py = centerY * T + T / 2;

  // Expanding water ring
  const ring = scene.add.circle(px, py, 8, 0x4488cc, 0.4).setDepth(8);
  scene.tweens.add({
    targets: ring,
    scaleX: radius * 2,
    scaleY: radius * 2,
    alpha: 0,
    duration: 1200,
    ease: 'Cubic.easeOut',
    onComplete: () => ring.destroy(),
  });

  // Water text
  const text = scene.add.text(px, py - 20, '\uD83D\uDCA7 Watered!', {
    fontSize: '12px',
    fontFamily: 'Georgia, serif',
    fontStyle: 'bold',
    color: '#88ccff',
    stroke: '#000000',
    strokeThickness: 2,
  }).setOrigin(0.5).setDepth(11);

  scene.tweens.add({
    targets: text,
    y: py - 50,
    alpha: 0,
    duration: 1500,
    ease: 'Cubic.easeOut',
    onComplete: () => text.destroy(),
  });
}

// ─── Seed Discovery Animation ───────────────────────────

/**
 * Play seed discovery notification.
 */
function playSeedDiscoveryEffect(scene, seedName) {
  const cam = scene.cameras.main;
  const cx = cam.width / 2;
  const cy = cam.height * 0.25;

  // Discovery banner
  const bg = scene.add.rectangle(cx, cy, 280, 40, 0x1a3322, 0.9)
    .setStrokeStyle(2, 0x44aa44)
    .setScrollFactor(0).setDepth(200);

  const text = scene.add.text(cx, cy, '\uD83C\uDF31 New Seed: ' + seedName + '!', {
    fontSize: '14px',
    fontFamily: 'Georgia, serif',
    fontStyle: 'bold',
    color: '#88ff88',
    shadow: { offsetX: 0, offsetY: 0, color: '#44aa44', blur: 6, fill: true },
  }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

  // Slide in, hold, slide out
  bg.setAlpha(0).setScale(0.8);
  text.setAlpha(0).setScale(0.8);

  scene.tweens.add({
    targets: [bg, text],
    alpha: 1,
    scaleX: 1,
    scaleY: 1,
    duration: 300,
    ease: 'Back.easeOut',
    onComplete: () => {
      scene.time.delayedCall(2000, () => {
        scene.tweens.add({
          targets: [bg, text],
          alpha: 0,
          y: cy - 30,
          duration: 500,
          ease: 'Cubic.easeIn',
          onComplete: () => { bg.destroy(); text.destroy(); },
        });
      });
    },
  });
}

console.log('[FarmRender] Farm renderer loaded');
