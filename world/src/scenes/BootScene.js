// ═══════════════════════════════════════════════════
// BOOT SCENE — Load real assets, title screen
// Wave 6: Character sprite select + name input
// ═══════════════════════════════════════════════════

// Character sprite definitions — all 8 options
const CHARACTER_SPRITES = [
  { key: 'char_boy',          file: 'Boy_walk.png',          label: 'Wanderer' },
  { key: 'char_girl',         file: 'Girl_walk.png',         label: 'Rogue' },
  { key: 'char_caveman',      file: 'Caveman_walk.png',      label: 'Brawler' },
  { key: 'char_cavegirl',     file: 'Cavegirl_walk.png',     label: 'Outcast' },
  { key: 'char_eskimo',       file: 'Eskimo_walk.png',       label: 'Northerner' },
  { key: 'char_flam',         file: 'Flam_walk.png',         label: 'Flamekin' },
  { key: 'char_fighterred',   file: 'FighterRed_walk.png',   label: 'Duelist' },
  { key: 'char_fighterwhite', file: 'FighterWhite_walk.png', label: 'Blackbelt' },
];

class BootScene extends Phaser.Scene {
  constructor() { super('BootScene'); }

  preload() {
    // ── Character sprites (16x16 per frame, 4 cols x 4 rows = 64x64 sheet) ──
    // Default player sprite (Boy) — always loaded as 'player' for backward compat
    this.load.spritesheet('player', 'assets/characters/Boy_walk.png', { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet('enemy_sprite', 'assets/characters/FighterRed_walk.png', { frameWidth: 16, frameHeight: 16 });

    // Creature sprites for wild enemies (16x16 per frame, 4x4 = 64x64 sheets)
    const CREATURE_FILES = ['Bear','Dragon','Axolot','AxolotBlue','Butterfly','ButterflyBlue','BlueBat','Slime','Mushroom','Bamboo','Skull'];
    for (const name of CREATURE_FILES) {
      this.load.spritesheet('creature_' + name.toLowerCase(), 'assets/monsters/' + name + '.png', { frameWidth: 16, frameHeight: 16 });
    }

    // Wave 6: Load ALL 8 character spritesheets for sprite select
    for (const cs of CHARACTER_SPRITES) {
      this.load.spritesheet(cs.key, 'assets/characters/' + cs.file, { frameWidth: 16, frameHeight: 16 });
    }

    // NPC sprites (16x16 per frame, 4 cols x 1 row = 64x16 sheet)
    this.load.spritesheet('npc_elder', 'assets/characters/NPC_ElderFrost.png', { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet('npc_knight', 'assets/characters/NPC_Knight_idle.png', { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet('npc_hunter', 'assets/characters/NPC_Hunter_idle.png', { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet('npc_child', 'assets/characters/NPC_Child.png', { frameWidth: 16, frameHeight: 16 });

    // Valkin the Grand — epic boss sprite (256x256 frames, orc mage from ERW)
    this.load.spritesheet('valkin_walk', 'assets/characters/Valkin_walk.png', { frameWidth: 256, frameHeight: 256 });
    this.load.spritesheet('valkin_idle', 'assets/characters/Valkin_idle.png', { frameWidth: 256, frameHeight: 256 });

    // ── Tilesets (spritesheet: 16x16 per tile) — legacy Ninja Adventure ──
    this.load.spritesheet('tiles_nature', 'assets/tiles/TilesetNature.png', { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet('tiles_water', 'assets/tiles/TilesetWater.png', { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet('tiles_field', 'assets/tiles/TilesetField.png', { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet('tiles_house', 'assets/tiles/TilesetHouse.png', { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet('tiles_desert', 'assets/tiles/TilesetDesert.png', { frameWidth: 16, frameHeight: 16 });

    // Frost Dungeon entrance art (single image, rendered at 96x96 in world)
    this.load.image('frost_dungeon', 'assets/tiles/FrostDungeon.png');

    // Wooden frost-covered door halves (16x32 each, butt together at tile center)
    this.load.image('door_l', 'assets/tiles/door_l.png');
    this.load.image('door_r', 'assets/tiles/door_r.png');

    // Dungeon tile + lighting assets (icy flagstone + rock walls + vignette)
    for (let i = 1; i <= 5; i++) {
      this.load.image(`d_floor_${i}`, `assets/tiles/floor_${i}.png`);
    }
    this.load.image('d_vignette', 'assets/tiles/vignette.png');
    // Hand-pixeled frost-cavern wall set — top/bottom/sides (variants),
    // 4 organic curved corner pieces, horizontal divider, interior.
    for (let i = 1; i <= 3; i++) this.load.image(`d_wall_top_${i}`, `assets/tiles/wall_top_${i}.png`);
    for (let i = 1; i <= 2; i++) this.load.image(`d_wall_bottom_${i}`, `assets/tiles/wall_bottom_${i}.png`);
    for (let i = 1; i <= 2; i++) this.load.image(`d_wall_left_${i}`, `assets/tiles/wall_left_${i}.png`);
    for (let i = 1; i <= 2; i++) this.load.image(`d_wall_right_${i}`, `assets/tiles/wall_right_${i}.png`);
    for (const c of ['se', 'sw', 'ne', 'nw']) this.load.image(`d_wall_corner_${c}`, `assets/tiles/wall_corner_${c}.png`);
    for (let i = 1; i <= 2; i++) this.load.image(`d_wall_hdiv_${i}`, `assets/tiles/wall_hdiv_${i}.png`);
    for (let i = 1; i <= 2; i++) this.load.image(`d_wall_interior_${i}`, `assets/tiles/wall_interior_${i}.png`);
    // Decorative props (atmosphere, non-blocking) + snow particle
    for (const name of ['crystals_small','crystals_lg','stalagmite','frost_pile','old_crate',
                        'broken_sword','skull','frozen_barrel','frozen_statue']) {
      this.load.image(`d_prop_${name}`, `assets/tiles/prop_${name}.png`);
    }
    this.load.image('d_snowflake', 'assets/tiles/snowflake.png');
    // King Jay intro hallway pieces
    this.load.image('d_trapdoor', 'assets/tiles/trapdoor_open.png');
    this.load.image('d_trapdoor_2x2', 'assets/tiles/trapdoor_2x2.png');
    this.load.image('d_trapdoor_wide', 'assets/tiles/trapdoor_wide.png');
    this.load.image('d_hallway_entry', 'assets/tiles/hallway_entry.png');
    this.load.image('d_hallway_passage', 'assets/tiles/hallway_south_passage.png');
    this.load.image('d_stairwell_down', 'assets/tiles/stairwell_down.png');
    // King Jay portrait — shown in the inline dialog's left panel
    this.load.image('portrait_king_jay', 'https://drbango.com/testroom/art/originals/king_jay.jpg');

    // ── ERW Grass Land 2.0 tilesets (32x32 native) ──
    this.load.spritesheet('erw_terrain', 'assets/erw/tilesets/terrain-grass.png', { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet('erw_wall', 'assets/erw/tilesets/wall1.png', { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet('erw_water', 'assets/erw/tilesets/animated-water-tiles-(full-tile).png', { frameWidth: 32, frameHeight: 32 });

    // ── ERW Highlands V1.4.1 (Frost Valley snow terrain, 32x32, 57 cols x 52 rows) ──
    this.load.spritesheet('erw_highlands', 'assets/erw/highlands/tilesets.png', { frameWidth: 32, frameHeight: 32 });

    // ── ERW Volcano V1.6 (Volcanic Isles rock + lava, 32x32, 64 cols x 64 rows) ──
    this.load.spritesheet('erw_volcano', 'assets/erw/volcano/tileset.png', { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet('erw_lava', 'assets/erw/volcano/lava-16frames.png', { frameWidth: 32, frameHeight: 32 });

    // ── ERW Crypt V1.6 (Dark Castle dungeon terrain, 32x32, 50 cols x 58 rows) ──
    this.load.spritesheet('erw_crypt', 'assets/erw/crypt/tileset-terrain.png', { frameWidth: 32, frameHeight: 32 });

    // ── ERW animated props ──
    this.load.spritesheet('erw_campfire', 'assets/erw/props-animated/campfire1.png', { frameWidth: 160, frameHeight: 160 });
    this.load.spritesheet('erw_campfire_smoke', 'assets/erw/props-animated/campfire-smoke.png', { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('erw_chest_open', 'assets/erw/props-animated/chest-opening.png', { frameWidth: 192, frameHeight: 192 });
    this.load.spritesheet('erw_chest_close', 'assets/erw/props-animated/chest-closing.png', { frameWidth: 192, frameHeight: 192 });
    this.load.spritesheet('erw_butterfly1', 'assets/erw/props-animated/butterfly1.png', { frameWidth: 150, frameHeight: 106 });
    this.load.spritesheet('erw_butterfly2', 'assets/erw/props-animated/butterfly2.png', { frameWidth: 150, frameHeight: 106 });
    this.load.spritesheet('erw_particles', 'assets/erw/props-animated/nature-particles.png', { frameWidth: 96, frameHeight: 96 });
    this.load.spritesheet('erw_shrine_avail', 'assets/erw/props-animated/shrine-buff-available.png', { frameWidth: 295, frameHeight: 311 });
    this.load.spritesheet('erw_shrine_buff', 'assets/erw/props-animated/shrine-getting-buff.png', { frameWidth: 295, frameHeight: 311 });
    this.load.spritesheet('erw_flag1', 'assets/erw/props-animated/flag1.png', { frameWidth: 128, frameHeight: 128 });
    this.load.spritesheet('erw_lamp', 'assets/erw/props-animated/lamp-post-1.png', { frameWidth: 96, frameHeight: 96 });
    this.load.spritesheet('erw_dummy', 'assets/erw/props-animated/training-dummy-hit1.png', { frameWidth: 128, frameHeight: 128 });

    // ── ERW farming assets ──
    this.load.spritesheet('erw_soil', 'assets/erw/tilesets/fertilized-soil.png', { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet('erw_crops', 'assets/erw/props-static/atlas-sheet4-crops.png', { frameWidth: 32, frameHeight: 32 });
    this.load.image('erw_fence_curved', 'assets/erw/props-static/fence-curved.png');
    this.load.image('erw_fence_straight', 'assets/erw/props-static/fence-straight.png');
    this.load.spritesheet('erw_gate_open', 'assets/erw/props-animated/gate1-opening.png', { frameWidth: 128, frameHeight: 128 });
    this.load.spritesheet('erw_well_up', 'assets/erw/props-animated/well-bucket-up.png', { frameWidth: 187, frameHeight: 187 });
    this.load.spritesheet('erw_well_down', 'assets/erw/props-animated/well-bucket-down.png', { frameWidth: 187, frameHeight: 187 });
    this.load.spritesheet('erw_lamp2', 'assets/erw/props-animated/lamp-post-2.png', { frameWidth: 96, frameHeight: 96 });
    this.load.image('erw_flower1', 'assets/erw/flowers/flower1.png');
    this.load.image('erw_flower2', 'assets/erw/flowers/flower2.png');
    this.load.image('erw_flower3', 'assets/erw/flowers/flower3.png');
    this.load.image('erw_flower4', 'assets/erw/flowers/flower4.png');

    // ── ERW static props (loaded as images) ──
    this.load.image('erw_pine', 'assets/erw/props-static/pine-tree.png');
    this.load.image('erw_props1', 'assets/erw/props-static/atlas-sheet1.png');
    this.load.image('erw_fortress', 'assets/erw/props-static/fortress-front.png');
    this.load.image('erw_orc_tents', 'assets/erw/props-static/orc-tents.png');
    this.load.image('erw_loot', 'assets/erw/props-static/loot-drops.png');
    this.load.image('chest_wooden', 'assets/erw/props/chest_wooden.png');
    this.load.image('chest_wooden2', 'assets/erw/props/chest_wooden2.png');
    this.load.image('chest_wooden3', 'assets/erw/props/chest_wooden3.png');

    // ── ERW tree sprites (full multi-tile trees with trunks + canopies) ──
    this.load.image('erw_tree_green1', 'assets/erw/trees/green1.png');
    this.load.image('erw_tree_green2', 'assets/erw/trees/green2.png');
    this.load.image('erw_tree_green3', 'assets/erw/trees/green3.png');
    this.load.image('erw_tree_green4', 'assets/erw/trees/green4.png');
    this.load.image('erw_tree_green5', 'assets/erw/trees/green5.png');
    this.load.image('erw_tree_dead1', 'assets/erw/trees/dead1.png');
    this.load.image('erw_tree_dead2', 'assets/erw/trees/dead2.png');
    this.load.image('erw_tree_dead3', 'assets/erw/trees/dead3.png');
    this.load.image('erw_tree_dead_sm1', 'assets/erw/trees/dead-small1.png');
    this.load.image('erw_tree_dead_sm2', 'assets/erw/trees/dead-small2.png');
    this.load.image('erw_tree_palm1', 'assets/erw/trees/palm1.png');
    this.load.image('erw_tree_palm2', 'assets/erw/trees/palm2.png');
    this.load.image('erw_tree_palm3', 'assets/erw/trees/palm3.png');
    this.load.image('erw_tree_pine1', 'assets/erw/trees/pine1.png');
    this.load.image('erw_tree_pine2', 'assets/erw/trees/pine2.png');
    this.load.image('erw_tree_pine3', 'assets/erw/trees/pine3.png');

    // ── ERW snow-covered pine trees (Highlands pack — Frost Valley) ──
    this.load.image('erw_tree_snow_big', 'assets/erw/trees-snow/pine-snow-big.png');
    this.load.image('erw_tree_snow_med', 'assets/erw/trees-snow/pine-snow-medium.png');
    this.load.image('erw_tree_snow_sm', 'assets/erw/trees-snow/pine-snow-small.png');

    // ── ERW flower sprites (Rolling Hills) ──
    this.load.image('erw_flower1', 'assets/erw/flowers/flower1.png');
    this.load.image('erw_flower2', 'assets/erw/flowers/flower2.png');
    this.load.image('erw_flower3', 'assets/erw/flowers/flower3.png');
    this.load.image('erw_flower4', 'assets/erw/flowers/flower4.png');

    // ── ERW building sprites ──
    this.load.image('erw_cabin', 'assets/erw/buildings/cabin.png');
    this.load.image('erw_tent', 'assets/erw/buildings/tent.png');
    this.load.image('erw_tent_small', 'assets/erw/buildings/tent-small.png');

    // ── Grand Castle sprite (single large image for Dark Castle) ──
    this.load.image('grand_castle', 'assets/castle/sprites/grand_castle.png');

    // ── Crypt pack props (Dark Castle region — dark village atmosphere) ──
    this.load.spritesheet('crypt_torch', 'assets/erw/crypt/props/torch_burning.png', { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('crypt_candle', 'assets/erw/crypt/props/candle_burning.png', { frameWidth: 64, frameHeight: 64 });
    this.load.image('crypt_statue1', 'assets/erw/crypt/props/statue1.png');
    this.load.image('crypt_statue2', 'assets/erw/crypt/props/statue2.png');
    this.load.image('crypt_banner1', 'assets/erw/crypt/props/banner1.png');
    this.load.image('crypt_banner2', 'assets/erw/crypt/props/banner2.png');
    this.load.image('crypt_candelabrum', 'assets/erw/crypt/props/candelabrum1.png');
    this.load.image('crypt_bones', 'assets/erw/crypt/props/bones1.png');
    this.load.image('crypt_vase', 'assets/erw/crypt/props/vase1.png');

    // ── ERW ground scatter (grass tufts + small rocks for Rolling Hills) ──
    this.load.image('erw_tuft1', 'assets/erw/scatter/tuft1.png');
    this.load.image('erw_tuft2', 'assets/erw/scatter/tuft2.png');
    this.load.image('erw_tuft3', 'assets/erw/scatter/tuft3.png');
    this.load.image('erw_tuft4', 'assets/erw/scatter/tuft4.png');
    this.load.image('erw_rock1', 'assets/erw/scatter/rock1.png');
    this.load.image('erw_rock2', 'assets/erw/scatter/rock2.png');
    this.load.image('erw_rock3', 'assets/erw/scatter/rock3.png');

    // ── Card art (load ALL cards so every enemy has art) ──
    for (const card of ALL_CARDS) {
      if (card.art) {
        // Fix relative paths — card art paths start with ../testroom/
        let artPath = card.art;
        if (artPath.startsWith('../')) artPath = artPath; // keep relative
        this.load.image(`card_${card.id}`, artPath);
      }
    }

    // ── Garden plant sprites ──
    if (typeof loadGardenAssets === 'function') loadGardenAssets(this);

    // ── Audio ──
    this.load.audio('music_hub', 'assets/audio/hub.ogg');
    this.load.audio('music_battle', 'assets/audio/battle.ogg');
    this.load.audio('music_frost', 'assets/audio/frost_valley.ogg');

    // ── Showcase card art for loading/title screen ──
    const showcaseCards = ['flora', 'gary', 'kodako', 'redd', 'munch', 'sylvia'];
    for (const name of showcaseCards) {
      this.load.image('showcase_' + name, 'https://drbango.com/testroom/art/originals/' + name + '.png');
    }

    // ── Premium loading screen ──
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#0a0a1a');

    // Subtle particle field behind everything
    for (let i = 0; i < 40; i++) {
      const dot = this.add.circle(
        Phaser.Math.Between(0, width), Phaser.Math.Between(0, height),
        Phaser.Math.Between(1, 2), 0x6688cc, Phaser.Math.FloatBetween(0.05, 0.25)
      );
      this.tweens.add({ targets: dot, alpha: 0, duration: Phaser.Math.Between(1500, 3000), yoyo: true, repeat: -1 });
    }

    // "Loading World..." text
    const loadText = this.add.text(width / 2, height - 70, 'Loading World...', {
      fontSize: '14px', fontFamily: 'Georgia, serif', fontStyle: 'italic', color: '#8899bb',
    }).setOrigin(0.5);

    // Loading bar track (bottom of screen)
    const barW = Math.min(400, width * 0.7);
    const barH = 10;
    const barY = height - 40;
    const barX = width / 2 - barW / 2;
    // Outer track
    this.add.rectangle(width / 2, barY, barW + 4, barH + 4, 0x1a1a3a).setStrokeStyle(1, 0x334466);
    // Fill — gradient-ish using overlapping rectangles
    const fillBase = this.add.rectangle(barX + 2, barY, 1, barH - 2, 0x2266aa).setOrigin(0, 0.5);
    const fillGlow = this.add.rectangle(barX + 2, barY, 1, barH - 4, 0x44aaff).setOrigin(0, 0.5).setAlpha(0.6);

    // Percentage text
    const pctText = this.add.text(width / 2, barY, '0%', {
      fontSize: '10px', fontFamily: 'monospace', color: '#aaccff',
    }).setOrigin(0.5).setAlpha(0.8);

    // Card showcase slots — fade in as loading progresses
    this._showcaseSlots = [];
    const cardCount = showcaseCards.length;
    const slotSpacing = Math.min(120, (width - 80) / cardCount);
    const slotStartX = width / 2 - ((cardCount - 1) * slotSpacing) / 2;
    const slotY = height / 2 - 20;

    for (let i = 0; i < cardCount; i++) {
      // Placeholder glow circle behind each card slot
      const glow = this.add.circle(slotStartX + i * slotSpacing, slotY, 50, 0x2244aa, 0.08);
      this.tweens.add({ targets: glow, alpha: 0.02, duration: 2000, yoyo: true, repeat: -1, delay: i * 300 });
      this._showcaseSlots.push({ key: 'showcase_' + showcaseCards[i], x: slotStartX + i * slotSpacing, y: slotY, revealed: false });
    }

    // Progress handler — fill bar + reveal cards as loading progresses
    this.load.on('progress', (p) => {
      const fillW = (barW - 4) * p;
      fillBase.width = fillW;
      fillGlow.width = fillW;
      pctText.setText(Math.floor(p * 100) + '%');

      // Reveal showcase cards as we pass thresholds
      for (let i = 0; i < this._showcaseSlots.length; i++) {
        const slot = this._showcaseSlots[i];
        const threshold = (i + 1) / (this._showcaseSlots.length + 1);
        if (!slot.revealed && p >= threshold && this.textures.exists(slot.key)) {
          slot.revealed = true;
          const img = this.add.image(slot.x, slot.y + 30, slot.key)
            .setDisplaySize(90, 90).setAlpha(0).setOrigin(0.5);
          this.tweens.add({ targets: img, alpha: 0.7, y: slot.y, duration: 800, ease: 'Power2' });
        }
      }
    });
  }

  create() {
    const { width, height } = this.scale;

    // ── Player walk animations (using default 'player' texture) ──
    // Spritesheet: 4 cols (directions) x 4 rows (frames), 16x16 each
    // Col 0=DOWN, Col 1=UP, Col 2=LEFT, Col 3=RIGHT
    // Row 0=idle, Row 1=step (only 2 used)
    // Frame index = row * 4 + col
    this.createWalkAnims('player');

    // Wave 6: Also create walk anims for all character sprites
    for (const cs of CHARACTER_SPRITES) {
      this.createWalkAnims(cs.key);
    }

    // Creature walk anims
    const CREATURE_KEYS = ['bear','dragon','axolot','axolotblue','butterfly','butterflyblue','bluebat','slime','mushroom','bamboo','skull'];
    for (const ck of CREATURE_KEYS) {
      this.createWalkAnims('creature_' + ck);
    }

    // ── ERW animated prop animations ──
    if (this.textures.exists('erw_water')) {
      this.anims.create({ key: 'erw_water_flow', frames: this.anims.generateFrameNumbers('erw_water', { start: 0, end: 7 }), frameRate: 4, repeat: -1 });
    }
    if (this.textures.exists('erw_lava')) {
      this.anims.create({ key: 'erw_lava_flow', frames: this.anims.generateFrameNumbers('erw_lava', { start: 0, end: 15 }), frameRate: 6, repeat: -1 });
    }
    if (this.textures.exists('erw_campfire')) {
      this.anims.create({ key: 'erw_campfire_burn', frames: this.anims.generateFrameNumbers('erw_campfire', { start: 0, end: 7 }), frameRate: 8, repeat: -1 });
    }
    if (this.textures.exists('erw_campfire_smoke')) {
      this.anims.create({ key: 'erw_smoke', frames: this.anims.generateFrameNumbers('erw_campfire_smoke', { start: 0, end: 15 }), frameRate: 6, repeat: -1 });
    }
    if (this.textures.exists('erw_butterfly1')) {
      this.anims.create({ key: 'erw_butterfly1_fly', frames: this.anims.generateFrameNumbers('erw_butterfly1', { start: 0, end: 23 }), frameRate: 10, repeat: -1 });
    }
    if (this.textures.exists('erw_butterfly2')) {
      this.anims.create({ key: 'erw_butterfly2_fly', frames: this.anims.generateFrameNumbers('erw_butterfly2', { start: 0, end: 23 }), frameRate: 10, repeat: -1 });
    }
    if (this.textures.exists('erw_particles')) {
      this.anims.create({ key: 'erw_nature_particles', frames: this.anims.generateFrameNumbers('erw_particles', { start: 0, end: 15 }), frameRate: 6, repeat: -1 });
    }
    if (this.textures.exists('erw_chest_open')) {
      this.anims.create({ key: 'erw_chest_opening', frames: this.anims.generateFrameNumbers('erw_chest_open', { start: 0, end: 8 }), frameRate: 10, repeat: 0 });
    }
    if (this.textures.exists('erw_shrine_avail')) {
      this.anims.create({ key: 'erw_shrine_glow', frames: this.anims.generateFrameNumbers('erw_shrine_avail', { start: 0, end: 10 }), frameRate: 6, repeat: -1 });
    }
    if (this.textures.exists('erw_flag1')) {
      this.anims.create({ key: 'erw_flag_wave', frames: this.anims.generateFrameNumbers('erw_flag1', { start: 0, end: 10 }), frameRate: 8, repeat: -1 });
    }
    if (this.textures.exists('erw_lamp')) {
      this.anims.create({ key: 'erw_lamp_flicker', frames: this.anims.generateFrameNumbers('erw_lamp', { start: 0, end: 11 }), frameRate: 6, repeat: -1 });
    }
    if (this.textures.exists('crypt_torch')) {
      this.anims.create({ key: 'crypt_torch_burn', frames: this.anims.generateFrameNumbers('crypt_torch', { start: 0, end: 7 }), frameRate: 8, repeat: -1 });
    }
    if (this.textures.exists('crypt_candle')) {
      this.anims.create({ key: 'crypt_candle_burn', frames: this.anims.generateFrameNumbers('crypt_candle', { start: 0, end: 7 }), frameRate: 6, repeat: -1 });
    }

    // ── Title screen ──
    this.cameras.main.setBackgroundColor('#0a0a1a');

    // Dense twinkling star field
    for (let i = 0; i < 150; i++) {
      const star = this.add.circle(Phaser.Math.Between(0, width), Phaser.Math.Between(0, height),
        Phaser.Math.Between(1, 3), 0xffffff, Phaser.Math.FloatBetween(0.1, 0.7));
      this.tweens.add({ targets: star, alpha: 0.05, duration: Phaser.Math.Between(800, 2500), yoyo: true, repeat: -1, delay: Phaser.Math.Between(0, 2000) });
    }
    // Colored accent stars
    const accentColors = [0xffcc44, 0x44aaff, 0xff6644, 0x66ff88];
    for (let i = 0; i < 20; i++) {
      const astar = this.add.circle(Phaser.Math.Between(0, width), Phaser.Math.Between(0, height),
        Phaser.Math.Between(1, 2), Phaser.Math.RND.pick(accentColors), Phaser.Math.FloatBetween(0.1, 0.4));
      this.tweens.add({ targets: astar, alpha: 0, duration: Phaser.Math.Between(1500, 3000), yoyo: true, repeat: -1 });
    }

    // ── Fanned card showcase (angled hand of cards) ──
    const showcaseNames = ['flora', 'gary', 'kodako', 'redd', 'munch', 'sylvia'];
    const fanCount = showcaseNames.length;
    const fanCenterX = width / 2;
    const fanY = height * 0.52;
    const cardW = Math.min(100, width / 8);
    const cardH = cardW * 1.2;
    const fanSpread = Math.min(70, width / 12); // horizontal spacing
    const fanAngleRange = 30; // total degrees across all cards

    this._fanCards = [];
    for (let i = 0; i < fanCount; i++) {
      const key = 'showcase_' + showcaseNames[i];
      const normI = (i - (fanCount - 1) / 2); // centered index: -2.5 to 2.5
      const tx = fanCenterX + normI * fanSpread;
      const angle = normI * (fanAngleRange / fanCount);
      const yOffset = Math.abs(normI) * 8; // outer cards slightly lower (arc)

      if (this.textures.exists(key)) {
        // Card border/frame
        const border = this.add.rectangle(tx, fanY + yOffset, cardW + 6, cardH + 6, 0x2a2a4a, 0.9)
          .setStrokeStyle(2, 0x4466aa).setAngle(angle);
        // Card art
        const card = this.add.image(tx, fanY + yOffset, key)
          .setDisplaySize(cardW, cardH).setAngle(angle);
        // Floating animation
        this.tweens.add({
          targets: [card, border],
          y: fanY + yOffset - 6,
          duration: 2000 + i * 200,
          yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
          delay: i * 150
        });
        // Subtle glow behind
        const glow = this.add.circle(tx, fanY + yOffset, cardW * 0.6, 0x3366cc, 0.08);
        this.tweens.add({ targets: glow, alpha: 0.02, duration: 2500, yoyo: true, repeat: -1, delay: i * 200 });
        this._fanCards.push({ card, border, glow });
      }
    }

    // Player character preview (use saved sprite if returning) — above cards
    const previewKey = (G.spriteKey && G.spriteKey !== 'player' && this.textures.exists(G.spriteKey)) ? G.spriteKey : 'player';
    this._titlePreview = this.add.sprite(width / 2, height * 0.35, previewKey, 0).setScale(5);

    // ── Grand title with gold glow ──
    // Glow layer (blurred gold shadow behind text)
    const titleGlow = this.add.text(width / 2, height * 0.12, 'BATTLE OF ORIGINS', {
      fontSize: '54px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: '#ffcc44',
      shadow: { offsetX: 0, offsetY: 0, color: '#ffaa00', blur: 20, fill: true },
    }).setOrigin(0.5).setAlpha(0.5);
    this.tweens.add({ targets: titleGlow, alpha: 0.3, duration: 2000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // Main title
    this.add.text(width / 2, height * 0.12, 'BATTLE OF ORIGINS', {
      fontSize: '54px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: '#ffe680',
      shadow: { offsetX: 2, offsetY: 2, color: '#000000', blur: 10, fill: true },
      stroke: '#aa7700', strokeThickness: 2,
    }).setOrigin(0.5);

    // Subtitle
    this.add.text(width / 2, height * 0.21, 'Collect Spiritkin. Roll Dice. Win.', {
      fontSize: '16px', fontFamily: 'Georgia, serif', fontStyle: 'italic', color: '#8899bb',
    }).setOrigin(0.5);

    // Version
    this.add.text(width / 2, height * 0.26, 'Pre-Beta', {
      fontSize: '11px', fontFamily: 'monospace', color: '#556677',
    }).setOrigin(0.5);

    // ── START button — grand, glowing, breathing ──
    const btnW = 220, btnH = 56;
    const btnY = height * 0.78;

    // Button glow backing
    const btnGlow = this.add.rectangle(width / 2, btnY, btnW + 16, btnH + 16, 0x2266aa, 0.3)
      .setStrokeStyle(0);
    this.tweens.add({ targets: btnGlow, alpha: 0.1, scaleX: 1.08, scaleY: 1.08, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // Button body — gradient look via layered rects
    const btnOuter = this.add.rectangle(width / 2, btnY, btnW, btnH, 0x1a3366)
      .setStrokeStyle(2, 0x4488cc);
    const btnInner = this.add.rectangle(width / 2, btnY - 1, btnW - 4, btnH / 2, 0x2255aa, 0.3)
      .setOrigin(0.5, 1); // top highlight

    const btnHit = this.add.rectangle(width / 2, btnY, btnW, btnH, 0x000000, 0.001)
      .setInteractive({ useHandCursor: true });

    const btnLabel = this.add.text(width / 2, btnY, 'START', {
      fontSize: '30px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: '#ffffff',
      shadow: { offsetX: 0, offsetY: 0, color: '#44aaff', blur: 10, fill: true },
    }).setOrigin(0.5);

    // Breathing animation on the label
    this.tweens.add({ targets: btnLabel, alpha: 0.85, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    btnHit.on('pointerover', () => {
      btnOuter.setFillStyle(0x2255aa);
      btnOuter.setStrokeStyle(2, 0x66aaee);
      btnLabel.setColor('#ffffcc');
    });
    btnHit.on('pointerout', () => {
      btnOuter.setFillStyle(0x1a3366);
      btnOuter.setStrokeStyle(2, 0x4488cc);
      btnLabel.setColor('#ffffff');
    });
    btnHit.on('pointerdown', () => {
      if (G.team.length === 0) {
        // New game — give starter ghost, then proceed through onboarding flow
        const starterIds = [39, 66, 91];
        for (const id of starterIds) {
          const card = ALL_CARDS.find(c => c.id === id);
          if (card) {
            G.team.push({ id: card.id, name: card.name, hp: card.maxHp, maxHp: card.maxHp,
              ko: false, ability: card.ability, abilityDesc: card.desc, rarity: card.rarity,
              usedOncePerGame: false, entryFired: false });
            notify(`${card.name} joins your team!`);
            break;
          }
        }
        saveGame();
        // Onboarding: Step 1 avatar select, Step 2 class choice, then world
        this.showSpriteSelect();
        return;
      }
      this.cameras.main.fadeOut(600, 0, 0, 0);
      this.time.delayedCall(600, () => this.scene.start('WorldScene'));
    });
  }

  // ── Helper: create walk animations for a given texture key ──
  createWalkAnims(textureKey) {
    if (!this.textures.exists(textureKey)) return;
    const prefix = textureKey === 'player' ? '' : textureKey + '_';
    // Only create if they don't already exist
    if (!this.anims.exists(prefix + 'walk_down')) {
      this.anims.create({ key: prefix + 'walk_down',  frames: this.anims.generateFrameNumbers(textureKey, { frames: [0, 4] }), frameRate: 4, repeat: -1 });
    }
    if (!this.anims.exists(prefix + 'walk_up')) {
      this.anims.create({ key: prefix + 'walk_up',    frames: this.anims.generateFrameNumbers(textureKey, { frames: [1, 5] }), frameRate: 4, repeat: -1 });
    }
    if (!this.anims.exists(prefix + 'walk_left')) {
      this.anims.create({ key: prefix + 'walk_left',  frames: this.anims.generateFrameNumbers(textureKey, { frames: [2, 6] }), frameRate: 4, repeat: -1 });
    }
    if (!this.anims.exists(prefix + 'walk_right')) {
      this.anims.create({ key: prefix + 'walk_right', frames: this.anims.generateFrameNumbers(textureKey, { frames: [3, 7] }), frameRate: 4, repeat: -1 });
    }
  }

  // ═══════ STEP 1: CHOOSE YOUR AVATAR (new game only) ═══════
  showSpriteSelect() {
    const { width, height } = this.scale;

    // Clear the scene and rebuild with sprite select screen
    this._spriteSelectGroup = [];

    // Full dark overlay
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x0a0a1a, 0.95)
      .setDepth(100);
    this._spriteSelectGroup.push(overlay);

    // Subtle star particles behind
    for (let i = 0; i < 60; i++) {
      const dot = this.add.circle(
        Phaser.Math.Between(0, width), Phaser.Math.Between(0, height),
        Phaser.Math.Between(1, 2), 0x6688cc, Phaser.Math.FloatBetween(0.05, 0.2)
      ).setDepth(100);
      this.tweens.add({ targets: dot, alpha: 0, duration: Phaser.Math.Between(1500, 3000), yoyo: true, repeat: -1 });
      this._spriteSelectGroup.push(dot);
    }

    // Step indicator
    const stepText = this.add.text(width / 2, height * 0.04, 'STEP 1 OF 2', {
      fontSize: '11px', fontFamily: 'monospace', color: '#556677', letterSpacing: 4,
    }).setOrigin(0.5).setDepth(101);
    this._spriteSelectGroup.push(stepText);

    // Header with gold glow
    const headerGlow = this.add.text(width / 2, height * 0.10, "WHO ARE YOU?", {
      fontSize: '32px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: '#ffcc44',
      shadow: { offsetX: 0, offsetY: 0, color: '#ffaa00', blur: 16, fill: true },
    }).setOrigin(0.5).setDepth(101).setAlpha(0.4);
    this.tweens.add({ targets: headerGlow, alpha: 0.25, duration: 2000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this._spriteSelectGroup.push(headerGlow);

    const header = this.add.text(width / 2, height * 0.10, "WHO ARE YOU?", {
      fontSize: '32px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: '#ffe680',
      shadow: { offsetX: 1, offsetY: 1, color: '#000000', blur: 6, fill: true },
      stroke: '#aa7700', strokeThickness: 1,
    }).setOrigin(0.5).setDepth(101);
    this._spriteSelectGroup.push(header);

    const subtitle = this.add.text(width / 2, height * 0.17, 'Pick a look. This is purely cosmetic.', {
      fontSize: '13px', fontFamily: 'Georgia, serif', fontStyle: 'italic', color: '#667799',
    }).setOrigin(0.5).setDepth(101);
    this._spriteSelectGroup.push(subtitle);

    // 4x2 grid of character options
    const cols = 4, rows = 2;
    const cellW = 140, cellH = 130;
    const gridW = cols * cellW;
    const gridStartX = (width - gridW) / 2 + cellW / 2;
    const gridStartY = height * 0.30 + cellH / 2;

    // Selection state
    let selectedKey = null;
    let selectedBorder = null;
    const allCellBgs = [];

    // Large preview of selected avatar (right side or center bottom)
    const previewX = width / 2;
    const previewY = height * 0.78;
    const previewSprite = this.add.sprite(previewX, previewY, 'player', 0)
      .setScale(6).setDepth(103).setAlpha(0);
    this._spriteSelectGroup.push(previewSprite);

    const previewName = this.add.text(previewX, previewY + 55, '', {
      fontSize: '14px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: '#ffe680',
    }).setOrigin(0.5).setDepth(103);
    this._spriteSelectGroup.push(previewName);

    // Next button (initially hidden)
    const nextBtnW = 200, nextBtnH = 48;
    const nextBtnY = height * 0.92;
    const nextGlow = this.add.rectangle(width / 2, nextBtnY, nextBtnW + 12, nextBtnH + 12, 0x2266aa, 0.25)
      .setDepth(102).setVisible(false);
    this.tweens.add({ targets: nextGlow, alpha: 0.1, scaleX: 1.06, scaleY: 1.06, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const nextBg = this.add.rectangle(width / 2, nextBtnY, nextBtnW, nextBtnH, 0x1a3366)
      .setStrokeStyle(2, 0x4488cc)
      .setInteractive({ useHandCursor: true }).setDepth(102).setVisible(false);
    const nextLabel = this.add.text(width / 2, nextBtnY, 'NEXT', {
      fontSize: '22px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: '#ffffff',
      shadow: { offsetX: 0, offsetY: 0, color: '#44aaff', blur: 8, fill: true },
    }).setOrigin(0.5).setDepth(103).setVisible(false);
    this._spriteSelectGroup.push(nextGlow, nextBg, nextLabel);

    nextBg.on('pointerover', () => { nextBg.setFillStyle(0x2255aa); nextBg.setStrokeStyle(2, 0x66aaee); nextLabel.setColor('#ffffcc'); });
    nextBg.on('pointerout', () => { nextBg.setFillStyle(0x1a3366); nextBg.setStrokeStyle(2, 0x4488cc); nextLabel.setColor('#ffffff'); });
    nextBg.on('pointerdown', () => {
      if (!selectedKey) return;
      G.spriteKey = selectedKey;
      saveGame();
      // Clean up
      for (const obj of this._spriteSelectGroup) {
        if (obj && obj.destroy) obj.destroy();
      }
      this._spriteSelectGroup = [];
      // Step 2: class selection
      this.showClassChoice();
    });

    CHARACTER_SPRITES.forEach((cs, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx = gridStartX + col * cellW;
      const cy = gridStartY + row * cellH;

      // Cell background
      const cellBg = this.add.rectangle(cx, cy, cellW - 10, cellH - 10, 0x151530, 0.8)
        .setStrokeStyle(2, 0x333355)
        .setInteractive({ useHandCursor: true })
        .setDepth(102);
      allCellBgs.push(cellBg);

      // Sprite preview (frame 0 = front-facing idle)
      const spritePreview = this.add.sprite(cx, cy - 15, cs.key, 0).setScale(4).setDepth(103);

      // Label
      const label = this.add.text(cx, cy + 40, cs.label, {
        fontSize: '12px', fontFamily: 'monospace', color: '#8888aa',
      }).setOrigin(0.5).setDepth(103);

      this._spriteSelectGroup.push(cellBg, spritePreview, label);

      // Hover
      cellBg.on('pointerover', () => {
        if (selectedKey !== cs.key) {
          cellBg.setStrokeStyle(2, 0x5566aa);
          cellBg.setFillStyle(0x1a1a40, 0.9);
        }
      });
      cellBg.on('pointerout', () => {
        if (selectedKey !== cs.key) {
          cellBg.setStrokeStyle(2, 0x333355);
          cellBg.setFillStyle(0x151530, 0.8);
        }
      });

      // Click to select
      cellBg.on('pointerdown', () => {
        // Deselect previous
        if (selectedBorder) {
          selectedBorder.setStrokeStyle(2, 0x333355);
          selectedBorder.setFillStyle(0x151530, 0.8);
        }

        selectedKey = cs.key;
        selectedBorder = cellBg;
        cellBg.setStrokeStyle(3, 0x44aaff);
        cellBg.setFillStyle(0x1a2255, 0.95);

        // Update large preview
        previewSprite.setTexture(cs.key, 0).setAlpha(1);
        previewName.setText(cs.label);

        // Update title preview if it still exists
        if (this._titlePreview && this._titlePreview.active) {
          this._titlePreview.setTexture(cs.key, 0);
        }

        // Show next button
        nextGlow.setVisible(true);
        nextBg.setVisible(true);
        nextLabel.setVisible(true);
      });
    });
  }

  // ═══════ STEP 2: CHOOSE YOUR STARTING PATH / CLASS (new game only) ═══════
  showClassChoice() {
    const { width, height } = this.scale;
    this._classSelectGroup = [];

    // Full dark overlay
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x0a0a1a, 0.97)
      .setDepth(100);
    this._classSelectGroup.push(overlay);

    // Subtle star particles
    for (let i = 0; i < 60; i++) {
      const dot = this.add.circle(
        Phaser.Math.Between(0, width), Phaser.Math.Between(0, height),
        Phaser.Math.Between(1, 2), 0x6688cc, Phaser.Math.FloatBetween(0.05, 0.2)
      ).setDepth(100);
      this.tweens.add({ targets: dot, alpha: 0, duration: Phaser.Math.Between(1500, 3000), yoyo: true, repeat: -1 });
      this._classSelectGroup.push(dot);
    }

    // Step indicator
    const stepText = this.add.text(width / 2, height * 0.04, 'STEP 2 OF 2', {
      fontSize: '11px', fontFamily: 'monospace', color: '#556677', letterSpacing: 4,
    }).setOrigin(0.5).setDepth(101);
    this._classSelectGroup.push(stepText);

    // Header with gold glow
    const headerGlow = this.add.text(width / 2, height * 0.10, 'CHOOSE YOUR PATH', {
      fontSize: '32px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: '#ffcc44',
      shadow: { offsetX: 0, offsetY: 0, color: '#ffaa00', blur: 16, fill: true },
    }).setOrigin(0.5).setDepth(101).setAlpha(0.4);
    this.tweens.add({ targets: headerGlow, alpha: 0.25, duration: 2000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this._classSelectGroup.push(headerGlow);

    const header = this.add.text(width / 2, height * 0.10, 'CHOOSE YOUR PATH', {
      fontSize: '32px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: '#ffe680',
      shadow: { offsetX: 1, offsetY: 1, color: '#000000', blur: 6, fill: true },
      stroke: '#aa7700', strokeThickness: 1,
    }).setOrigin(0.5).setDepth(101);
    this._classSelectGroup.push(header);

    const subtitle = this.add.text(width / 2, height * 0.17, 'This unlocks your first talent. You can learn others later.', {
      fontSize: '14px', fontFamily: 'Georgia, serif', fontStyle: 'italic', color: '#8899bb',
    }).setOrigin(0.5).setDepth(101);
    this._classSelectGroup.push(subtitle);

    // Avatar preview (top right corner)
    const avatarKey = G.spriteKey || 'player';
    const avatarPreview = this.add.sprite(width - 60, 60, avatarKey, 0).setScale(4).setDepth(103);
    const avatarGlow = this.add.circle(width - 60, 60, 28, 0x2244aa, 0.15).setDepth(102);
    this._classSelectGroup.push(avatarPreview, avatarGlow);

    // Class definitions
    const classes = [
      { key: 'trainer',        name: 'Trainer',        desc: 'Hit harder. Roll better. Win fights others can\'t.',  color: 0x44dd66, accent: 0x33aa55, icon: '\u2694\uFE0F' },
      { key: 'cultivator',     name: 'Cultivator',     desc: 'Grow rare plants. Brew healing items. Outlast everyone.',  color: 0x66cc66, accent: 0x449944, icon: '\uD83C\uDF3F' },
      { key: 'fortune_teller', name: 'Fortune Teller', desc: 'Bend luck. See the future. Turn bad rolls into wins.',  color: 0x44bbff, accent: 0x3388cc, icon: '\uD83D\uDD2E' },
      { key: 'artisan',        name: 'Artisan',        desc: 'Build gear. Upgrade your team. Make something powerful.',  color: 0xdd9933, accent: 0xaa7722, icon: '\uD83D\uDD28' },
      { key: 'scientist',      name: 'Scientist',      desc: 'Unlock secrets. Analyze Spiritkin. Know what others miss.',  color: 0xaa55ff, accent: 0x8833cc, icon: '\uD83E\uDDEA' },
    ];

    // Card layout — 5 cards in a row
    const cardW = 180, cardH = 220, gap = 16;
    const totalW = classes.length * cardW + (classes.length - 1) * gap;
    const startX = (width - totalW) / 2 + cardW / 2;
    const cardY = height * 0.48;

    let selectedClass = null;
    let selectedCardBg = null;
    const allCardBgs = [];
    const allCardGlows = [];

    // Begin Journey button (initially hidden)
    const beginBtnW = 260, beginBtnH = 52;
    const beginBtnY = height * 0.88;
    const beginGlow = this.add.rectangle(width / 2, beginBtnY, beginBtnW + 14, beginBtnH + 14, 0x2266aa, 0.25)
      .setDepth(102).setVisible(false);
    this.tweens.add({ targets: beginGlow, alpha: 0.1, scaleX: 1.06, scaleY: 1.06, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const beginBg = this.add.rectangle(width / 2, beginBtnY, beginBtnW, beginBtnH, 0x1a3366)
      .setStrokeStyle(2, 0x4488cc)
      .setInteractive({ useHandCursor: true }).setDepth(102).setVisible(false);
    const beginLabel = this.add.text(width / 2, beginBtnY, 'BEGIN JOURNEY', {
      fontSize: '24px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: '#ffffff',
      shadow: { offsetX: 0, offsetY: 0, color: '#44aaff', blur: 10, fill: true },
    }).setOrigin(0.5).setDepth(103).setVisible(false);
    this._classSelectGroup.push(beginGlow, beginBg, beginLabel);

    beginBg.on('pointerover', () => { beginBg.setFillStyle(0x2255aa); beginBg.setStrokeStyle(2, 0x66aaee); beginLabel.setColor('#ffffcc'); });
    beginBg.on('pointerout', () => { beginBg.setFillStyle(0x1a3366); beginBg.setStrokeStyle(2, 0x4488cc); beginLabel.setColor('#ffffff'); });
    beginBg.on('pointerdown', () => {
      if (!selectedClass) return;

      // Save starting class
      G.startingClass = selectedClass.key;
      G.discipline = selectedClass.key; // backwards compat with discipline field

      // Pre-learn the Apprentice talent for the chosen class ONLY
      // Clear any auto-unlocked apprentices first
      const classKeys = ['trainer', 'cultivator', 'fortune_teller', 'artisan', 'scientist'];
      for (const ck of classKeys) {
        if (!G.talents) G.talents = {};
        if (!G.talents[ck]) G.talents[ck] = {};
        // Remove auto-unlocked apprentice from all classes
        delete G.talents[ck]._app;
      }
      // Now learn the chosen class apprentice
      G.talents[selectedClass.key]._app = 1;

      notify(`Path chosen: ${selectedClass.name}!`);
      saveGame();

      // Clean up
      for (const obj of this._classSelectGroup) {
        if (obj && obj.destroy) obj.destroy();
      }
      this._classSelectGroup = [];

      // Cinematic intro before world loads
      this.cameras.main.fadeOut(600, 0, 0, 0);
      this.time.delayedCall(600, () => {
        // Black screen — show cinematic text crawl
        // Hide canvas entirely during cinematic
        const cvs = document.querySelector('canvas');
        if (cvs) cvs.style.display = 'none';
        const hudOv = document.getElementById('hud-overlay');
        if (hudOv) hudOv.style.display = 'none';

        const overlay = document.createElement('div');
        overlay.id = 'cinematicIntroOverlay';
        const os = overlay.style;
        os.position = 'fixed'; os.top = '0'; os.left = '0';
        os.width = '100vw'; os.height = '100vh'; os.zIndex = '99999';
        os.background = '#000'; os.display = 'flex';
        os.alignItems = 'center'; os.justifyContent = 'center';
        os.flexDirection = 'column';
        document.body.appendChild(overlay);

        const textEl = document.createElement('div');
        const ts = textEl.style;
        ts.fontFamily = 'Georgia, serif'; ts.fontSize = '24px';
        ts.color = '#ccd8e8'; ts.textAlign = 'center';
        ts.lineHeight = '1.8'; ts.letterSpacing = '2px';
        ts.textShadow = '0 0 30px rgba(120,160,255,0.3)';
        ts.opacity = '0'; ts.transition = 'opacity 1.5s ease';
        ts.maxWidth = '600px';
        overlay.appendChild(textEl);

        // ── Theatrical delivery — let each line breathe ──

        // Beat 1: silence. Just black. Let them sit in it.

        // Line 1 — slow fade in
        setTimeout(() => {
          textEl.textContent = 'A world full of Spiritkin awaits.';
          textEl.style.opacity = '1';
        }, 1200);
        // Hold... then fade
        setTimeout(() => { textEl.style.opacity = '0'; }, 4000);

        // Line 2 — the threat. Purple glow, bigger
        setTimeout(() => {
          textEl.style.fontSize = '26px';
          textEl.style.color = '#bb88ee';
          textEl.style.textShadow = '0 0 40px rgba(160,80,255,0.5)';
          textEl.textContent = 'Something ancient stirs. Valkin the Grand is watching.';
          textEl.style.opacity = '1';
        }, 5200);
        // Hold longer — let the name sink in
        setTimeout(() => { textEl.style.opacity = '0'; }, 8500);

        // Line 3 — the title drop. Gold. Italic. Big.
        setTimeout(() => {
          textEl.style.fontSize = '30px';
          textEl.style.fontStyle = 'italic';
          textEl.style.color = '#ffe680';
          textEl.style.textShadow = '0 0 50px rgba(255,200,60,0.4)';
          textEl.textContent = 'Your battle begins now.';
          textEl.style.opacity = '1';
        }, 9800);
        // Final hold — let it land
        setTimeout(() => { textEl.style.opacity = '0'; }, 13000);

        // Transition to world
        setTimeout(() => {
          overlay.style.transition = 'opacity 0.8s ease';
          overlay.style.opacity = '0';
          if (cvs) cvs.style.display = '';
          if (hudOv) hudOv.style.display = '';
          setTimeout(() => { overlay.remove(); }, 800);
          this.scene.start('WorldScene');
        }, 14000);
      });
    });

    classes.forEach((cls, i) => {
      const cx = startX + i * (cardW + gap);

      // Card glow (behind card, subtle pulse)
      const cardGlow = this.add.rectangle(cx, cardY, cardW + 8, cardH + 8, cls.color, 0.06)
        .setDepth(101);
      allCardGlows.push(cardGlow);
      this._classSelectGroup.push(cardGlow);

      // Card background
      const cardBg = this.add.rectangle(cx, cardY, cardW, cardH, 0x111128, 0.92)
        .setStrokeStyle(2, 0x333355)
        .setInteractive({ useHandCursor: true })
        .setDepth(102);
      allCardBgs.push(cardBg);
      this._classSelectGroup.push(cardBg);

      // Top color accent bar
      const accentBar = this.add.rectangle(cx, cardY - cardH / 2 + 4, cardW - 4, 6, cls.color, 0.7)
        .setDepth(103);
      this._classSelectGroup.push(accentBar);

      // Icon
      const icon = this.add.text(cx, cardY - 55, cls.icon, {
        fontSize: '40px',
      }).setOrigin(0.5).setDepth(103);
      this._classSelectGroup.push(icon);

      // Class name
      const nameText = this.add.text(cx, cardY - 10, cls.name, {
        fontSize: '18px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: '#ffffff',
        shadow: { offsetX: 1, offsetY: 1, color: '#000000', blur: 3, fill: true },
      }).setOrigin(0.5).setDepth(103);
      this._classSelectGroup.push(nameText);

      // Divider line
      const divider = this.add.rectangle(cx, cardY + 12, cardW - 40, 1, cls.color, 0.3).setDepth(103);
      this._classSelectGroup.push(divider);

      // Description
      const descText = this.add.text(cx, cardY + 28, cls.desc, {
        fontSize: '11px', fontFamily: 'Georgia, serif', fontStyle: 'italic', color: '#8899bb',
        align: 'center', wordWrap: { width: cardW - 24 }, lineSpacing: 3,
      }).setOrigin(0.5, 0).setDepth(103);
      this._classSelectGroup.push(descText);

      // Hover effects
      cardBg.on('pointerover', () => {
        if (selectedClass?.key !== cls.key) {
          cardBg.setStrokeStyle(2, 0x5566aa);
          cardBg.setFillStyle(0x151535, 0.95);
          cardGlow.setAlpha(0.12);
        }
      });
      cardBg.on('pointerout', () => {
        if (selectedClass?.key !== cls.key) {
          cardBg.setStrokeStyle(2, 0x333355);
          cardBg.setFillStyle(0x111128, 0.92);
          cardGlow.setAlpha(0.06);
        }
      });

      // Click to select
      cardBg.on('pointerdown', () => {
        // Deselect previous
        if (selectedCardBg) {
          const prevIdx = allCardBgs.indexOf(selectedCardBg);
          selectedCardBg.setStrokeStyle(2, 0x333355);
          selectedCardBg.setFillStyle(0x111128, 0.92);
          if (prevIdx >= 0) allCardGlows[prevIdx].setAlpha(0.06);
        }

        selectedClass = cls;
        selectedCardBg = cardBg;
        cardBg.setStrokeStyle(3, cls.color);
        cardBg.setFillStyle(0x1a1a44, 0.98);
        cardGlow.setAlpha(0.2);

        // Show begin button
        beginGlow.setVisible(true);
        beginBg.setVisible(true);
        beginLabel.setVisible(true);
      });
    });
  }
}
