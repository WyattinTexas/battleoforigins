# ERW Grass Land 2.0 — Asset Manifest for Battle of Origins World

**Source:** Epic RPG World - Grass Land 2.0 v2.0 by RafaelMatos (itch.io)
**Native tile size:** 32x32
**Integration note:** World currently uses 16x16 tiles at 2x scale. ERW tiles load at 1:1 (no scaling needed).

---

## Tilesets (32x32 grid)

| File | Size | Cols x Rows | Frames | Use |
|------|------|-------------|--------|-----|
| `terrain-grass.png` | 1760x2304 | 55x72 | 3,960 | Main ground: grass variants, dirt, paths, transitions |
| `terrain-grass-transparent.png` | 1760x2304 | 55x72 | 3,960 | Same with transparent BG (for layering) |
| `wall1.png` | 512x480 | 16x15 | 240 | Cliff/elevation edges |
| `wall1-3tiles.png` | 512x512 | 16x16 | 256 | Taller (3-tile) cliff walls |
| `hole-main.png` | 512x480 | 16x15 | 240 | Ground pits/holes |
| `fertilized-soil.png` | 640x224 | 20x7 | 140 | Farm plot tiles |
| `waterfall.png` | 288x416 | 9x13 | 117 | Animated waterfall frames |

### Beach & Water Transitions
| File | Size | Use |
|------|------|-----|
| `beach-thick-foam.png` | 1088x480 | Beach tiles with thick foam edges |
| `beach-no-foam.png` | 1088x480 | Beach tiles, clean edges |
| `beach-coast-transition.png` | 640x416 | Coast platform to beach blend |
| `platform--grass-to-water-spritesheet.png` | 960x929 | Grass-to-water edge tiles |
| `platform---grass--coast---spritesheet.png` | 1088x953 | Grass coastline tiles |
| `water-to-grass---river-orientation-spritesheet.png` | 960x929 | River bank tiles |
| *(+ transparency/grass2 variants of each)* | | |

---

## Animated Props (sprite strips — horizontal frames)

| File | Size | Frame Size | Frames | Use |
|------|------|-----------|--------|-----|
| `campfire1.png` | 1280x160 | 160x160 | 8 | Campfire with flames |
| `campfire2.png` | 1280x160 | 160x160 | 8 | Campfire variant |
| `campfire-smoke.png` | 1024x64 | 64x64 | 16 | Smoke overlay for campfire |
| `chest-opening.png` | 1728x192 | 192x192 | 9 | Chest open animation (with squeeze FX) |
| `chest-closing.png` | 1536x192 | 192x192 | 8 | Chest close animation |
| `shrine-buff-available.png` | 3245x311 | 295x311 | 11 | Shrine glowing (buff ready) |
| `shrine-getting-buff.png` | 2065x311 | 295x311 | 7 | Shrine activation (getting buff) |
| `shrine-base.png` | 224x192 | — | static | Shrine base (no animation) |
| `lamp-post-1.png` | 1216x96 | 96x96 | ~12 | Animated lamp post |
| `lamp-post-2.png` | 1024x96 | 96x96 | ~10 | Lamp post variant |
| `flag1.png` | 1440x128 | 128x128 | ~11 | Enemy flag waving |
| `flag2.png` | 768x128 | 128x128 | 6 | Flag variant |
| `gate1-opening.png` | 1728x128 | 128x128 | ~13 | Fence gate opening |
| `gate1-closing.png` | 1536x128 | 128x128 | 12 | Fence gate closing |
| `training-dummy-hit1.png` | 1152x128 | 128x128 | 9 | Training dummy hit reaction |
| `well-bucket-up.png` | 2370x187 | 187x187 | ~12 | Water well bucket rising |
| `well-bucket-down.png` | 1896x187 | 187x187 | ~10 | Water well bucket lowering |
| `butterfly1.png` | 3600x106 | 150x106 | 24 | Butterfly flying path |
| `butterfly2.png` | 3600x106 | 150x106 | 24 | Butterfly variant |
| `nature-particles.png` | 1536x96 | 96x96 | 16 | Floating leaf/pollen particles |
| `wind-fx.png` | 14976x64 | ~288x64 | 48+ | Cartoonish wind effect |
| `chimney-smoke-white.png` | 1536x64 | 64x64 | 24 | White chimney smoke |
| `cabin-door-opening.png` | 1440x128 | 128x128 | ~11 | Cabin door open |
| `cabin-door-closing.png` | 1248x128 | 128x128 | ~9 | Cabin door close |

---

## Static Props (atlas sheets — use as image, not spritesheet)

| File | Size | Contents |
|------|------|----------|
| `atlas-sheet1.png` | 1408x2560 | Trees, rocks, fences, wells, crates, barrels, palms, beach details, lamp posts |
| `atlas-sheet2.png` | 1408x2560 | Watchtower, stronghold walls, shrines, tents, carriages, barricades, weapons, cabin interior, grass tufts, log walls |
| `atlas-sheet3.png` | 1408x832 | Stone/wooden bridges, dragon fossil (full skeleton), cave entrance, mine entrance |
| `atlas-sheet4-crops.png` | 1088x576 | Crops (10 types, multi-stage), seed boxes/bags, tools (5 tiers), scarecrows |
| `pine-tree.png` | 512x640 | Pine tree variants |
| `fence-curved.png` | 256x192 | Curved fence pieces |
| `fence-straight.png` | 256x192 | Straight fence pieces |
| `fortress-front.png` | 1056x960 | Fortress front parts |
| `loot-drops.png` | 864x288 | Item drop sprites |
| `orc-tents.png` | 832x352 | Orc tent set 1 |
| `orc-tents2.png` | 416x352 | Orc tent set 2 |

---

## Characters

| File | Size | Frame Size | Animations | Use |
|------|------|-----------|------------|-----|
| `orc-mage-1.png` | 4608x1536 | ~256x256 | idle, walk, atk1, atk2, death, hurt | Orc mage (green) with hand FX |
| `orc-mage-2.png` | 4608x1536 | ~256x256 | same | Orc mage (alt color) with hand FX |
| `orc-warrior-1.png` | 4096x2304 | ~256x256 | idle, walk, atk1, atk2 (spin), death, hurt | Orc warrior (red) with weapon FX |
| `orc-warrior-2.png` | 4096x2304 | ~256x256 | same | Orc warrior (alt color) with weapon FX |
| `orc-mage-energy-fx.png` | 3072x160 | 160x160 | — | Energy burst FX overlay |
| `orc-mage-spike-fx.png` | 2496x160 | 160x160 | — | Spike projectile FX overlay |
| `vendor-idle.png` | 1024x128 | 128x128 | idle | NPC vendor |
| `bird1-idle.png` | 1440x96 | 96x96 | idle | Bird idle |
| `bird1-walk.png` | 768x96 | 96x96 | walk | Bird walking |
| `duck1-idle.png` | 1728x96 | 96x96 | idle | Duck idle |
| `duck1-walk.png` | 768x96 | 96x96 | walk | Duck walking |
| `frog1-idle.png` | 1632x96 | 96x96 | idle | Frog idle |
| `frog1-walk.png` | 960x96 | 96x96 | walk | Frog walking |

---

## Reference Mockups (not loaded in game)

| File | Shows |
|------|-------|
| `reference/mockup-ruins.gif` | Stone ruins with shrine, dragon bones, obelisk |
| `reference/mockup-orc-camp.gif` | Orc camp with tents, watchtowers, characters |
| `reference/mockup-bridge-village.gif` | Wooden bridge, water well, vendor, paths |
| `reference/mockup-stone-bridge.gif` | Stone bridge over river, cave, mine, animals |
| `reference/mockup-waterfall.gif` | Waterfall scene |

---

## Phaser Loading Cheat Sheet

```javascript
// In BootScene.js preload():

// Main terrain (32x32 tiles)
this.load.spritesheet('erw_terrain', 'assets/erw/tilesets/terrain-grass.png', { frameWidth: 32, frameHeight: 32 });
this.load.spritesheet('erw_wall', 'assets/erw/tilesets/wall1.png', { frameWidth: 32, frameHeight: 32 });

// Animated props (use frame width from table above)
this.load.spritesheet('erw_campfire', 'assets/erw/props-animated/campfire1.png', { frameWidth: 160, frameHeight: 160 });
this.load.spritesheet('erw_chest_open', 'assets/erw/props-animated/chest-opening.png', { frameWidth: 192, frameHeight: 192 });
this.load.spritesheet('erw_shrine_avail', 'assets/erw/props-animated/shrine-buff-available.png', { frameWidth: 295, frameHeight: 311 });
this.load.spritesheet('erw_butterfly', 'assets/erw/props-animated/butterfly1.png', { frameWidth: 150, frameHeight: 106 });
this.load.spritesheet('erw_particles', 'assets/erw/props-animated/nature-particles.png', { frameWidth: 96, frameHeight: 96 });

// Static atlases (load as images, crop regions manually or use as texture atlas)
this.load.image('erw_props1', 'assets/erw/props-static/atlas-sheet1.png');
this.load.image('erw_props2', 'assets/erw/props-static/atlas-sheet2.png');
this.load.image('erw_props3', 'assets/erw/props-static/atlas-sheet3.png');

// Characters
this.load.spritesheet('erw_orc_mage', 'assets/erw/characters/orc-mage-1.png', { frameWidth: 256, frameHeight: 256 });
this.load.spritesheet('erw_orc_warrior', 'assets/erw/characters/orc-warrior-1.png', { frameWidth: 256, frameHeight: 256 });
this.load.spritesheet('erw_bird', 'assets/erw/characters/bird1-idle.png', { frameWidth: 96, frameHeight: 96 });
```

---

## Integration Priority for World

### Phase 1 — Visual Upgrade (swap terrain)
1. Replace flat-color ground with `terrain-grass.png` tile stamps
2. Add `wall1.png` cliff edges around elevation changes
3. Use water transition tiles for rivers/lakes

### Phase 2 — World Life
4. Add campfire animations to town areas
5. Butterfly/particle ambient sprites
6. Bird/duck/frog ambient wildlife near water

### Phase 3 — Gameplay Props
7. Chest open/close for loot rewards
8. Shrine buff stations (Spiritkin encounter points)
9. Orc enemies for combat encounters

### Phase 4 — Structures
10. Cabin system for NPC buildings
11. Bridges connecting regions
12. Watchtower/stronghold for boss areas

---

## Source Files (full pack)
Original unmodified pack at: `~/Downloads/ERW - Grass Land 2.0 v2.0/`
Contains 5,915 files including individual sprites, Tiled Editor files, and Godot variants.
Only game-ready spritesheets were copied to this repo.
