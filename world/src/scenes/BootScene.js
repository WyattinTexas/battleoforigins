// ═══════════════════════════════════════════════════
// BOOT SCENE — Load real assets, title screen
// Wave 6: Character sprite select + name input
// ═══════════════════════════════════════════════════

// Character sprite definitions — all 8 options
const CHARACTER_SPRITES = [
  { key: 'char_boy',          file: 'Boy_walk.png',          label: 'Boy' },
  { key: 'char_girl',         file: 'Girl_walk.png',         label: 'Girl' },
  { key: 'char_caveman',      file: 'Caveman_walk.png',      label: 'Caveman' },
  { key: 'char_cavegirl',     file: 'Cavegirl_walk.png',     label: 'Cavegirl' },
  { key: 'char_eskimo',       file: 'Eskimo_walk.png',       label: 'Eskimo' },
  { key: 'char_flam',         file: 'Flam_walk.png',         label: 'Flam' },
  { key: 'char_fighterred',   file: 'FighterRed_walk.png',   label: 'Fighter Red' },
  { key: 'char_fighterwhite', file: 'FighterWhite_walk.png', label: 'Fighter White' },
];

class BootScene extends Phaser.Scene {
  constructor() { super('BootScene'); }

  preload() {
    // ── Character sprites (16x16 per frame, 4 cols x 4 rows = 64x64 sheet) ──
    // Default player sprite (Boy) — always loaded as 'player' for backward compat
    this.load.spritesheet('player', 'assets/characters/Boy_walk.png', { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet('enemy_sprite', 'assets/characters/FighterRed_walk.png', { frameWidth: 16, frameHeight: 16 });

    // Wave 6: Load ALL 8 character spritesheets for sprite select
    for (const cs of CHARACTER_SPRITES) {
      this.load.spritesheet(cs.key, 'assets/characters/' + cs.file, { frameWidth: 16, frameHeight: 16 });
    }

    // NPC sprites (16x16 per frame, 4 cols x 1 row = 64x16 sheet)
    this.load.spritesheet('npc_elder', 'assets/characters/NPC_ElderFrost.png', { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet('npc_knight', 'assets/characters/NPC_Knight_idle.png', { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet('npc_hunter', 'assets/characters/NPC_Hunter_idle.png', { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet('npc_child', 'assets/characters/NPC_Child.png', { frameWidth: 16, frameHeight: 16 });

    // ── Tilesets (spritesheet: 16x16 per tile) ──
    this.load.spritesheet('tiles_nature', 'assets/tiles/TilesetNature.png', { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet('tiles_water', 'assets/tiles/TilesetWater.png', { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet('tiles_field', 'assets/tiles/TilesetField.png', { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet('tiles_house', 'assets/tiles/TilesetHouse.png', { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet('tiles_desert', 'assets/tiles/TilesetDesert.png', { frameWidth: 16, frameHeight: 16 });

    // ── Card art (load ALL cards so every enemy has art) ──
    for (const card of ALL_CARDS) {
      if (card.art) {
        // Fix relative paths — card art paths start with ../testroom/
        let artPath = card.art;
        if (artPath.startsWith('../')) artPath = artPath; // keep relative
        this.load.image(`card_${card.id}`, artPath);
      }
    }

    // ── Audio ──
    this.load.audio('music_hub', 'assets/audio/hub.ogg');
    this.load.audio('music_battle', 'assets/audio/battle.ogg');
    this.load.audio('music_frost', 'assets/audio/frost_valley.ogg');

    // Loading bar
    const { width, height } = this.scale;
    const bar = this.add.rectangle(width/2, height/2 + 40, 300, 16, 0x333333);
    const fill = this.add.rectangle(width/2 - 148, height/2 + 40, 4, 12, 0x4488ff).setOrigin(0, 0.5);
    this.add.text(width/2, height/2, 'Loading...', { fontSize: '16px', color: '#888' }).setOrigin(0.5);
    this.load.on('progress', (p) => { fill.width = 296 * p; });
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

    // ── Title screen ──
    this.cameras.main.setBackgroundColor('#1a1a2e');

    for (let i = 0; i < 80; i++) {
      const star = this.add.circle(Phaser.Math.Between(0, width), Phaser.Math.Between(0, height),
        Phaser.Math.Between(1, 2), 0xffffff, Phaser.Math.FloatBetween(0.2, 0.8));
      this.tweens.add({ targets: star, alpha: 0.1, duration: Phaser.Math.Between(1000, 3000), yoyo: true, repeat: -1 });
    }

    // Player character preview (use saved sprite if returning)
    const previewKey = (G.spriteKey && G.spriteKey !== 'player' && this.textures.exists(G.spriteKey)) ? G.spriteKey : 'player';
    this._titlePreview = this.add.sprite(width / 2, height * 0.55, previewKey, 0).setScale(5);

    this.add.text(width / 2, height * 0.2, 'BATTLE OF ORIGINS', {
      fontSize: '52px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: '#ffffff',
      shadow: { offsetX: 2, offsetY: 2, color: '#000000', blur: 8, fill: true }
    }).setOrigin(0.5);

    this.add.text(width / 2, height * 0.3, 'Online', {
      fontSize: '18px', fontFamily: 'Georgia, serif', fontStyle: 'italic', color: '#aaaacc',
    }).setOrigin(0.5);

    this.add.text(width / 2, height * 0.34, 'v62', {
      fontSize: '11px', fontFamily: 'monospace', color: '#555577',
    }).setOrigin(0.5);

    const btnBg = this.add.rectangle(width / 2, height * 0.75, 180, 50, 0xeeeeee, 0.9)
      .setInteractive({ useHandCursor: true }).setStrokeStyle(2, 0x333333);
    this.add.text(width / 2, height * 0.75, 'START', {
      fontSize: '26px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: '#1a1a1a',
    }).setOrigin(0.5);

    btnBg.on('pointerover', () => btnBg.setFillStyle(0xffffff));
    btnBg.on('pointerout', () => btnBg.setFillStyle(0xeeeeee, 0.9));
    btnBg.on('pointerdown', () => {
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
        // Wave 6: Show sprite select FIRST, then name, then discipline
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

  // ═══════ WAVE 6: SPRITE SELECT (new game only) ═══════
  showSpriteSelect() {
    const { width, height } = this.scale;

    // Clear the scene and rebuild with sprite select screen
    this._spriteSelectGroup = [];

    // Dim overlay
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.8)
      .setDepth(100);
    this._spriteSelectGroup.push(overlay);

    // Header
    const header = this.add.text(width / 2, height * 0.08, 'CHOOSE YOUR CHARACTER', {
      fontSize: '28px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: '#ffffff',
      shadow: { offsetX: 1, offsetY: 1, color: '#000000', blur: 4, fill: true },
    }).setOrigin(0.5).setDepth(101);
    this._spriteSelectGroup.push(header);

    const subtitle = this.add.text(width / 2, height * 0.15, 'Pick your adventurer sprite', {
      fontSize: '14px', fontFamily: 'Georgia, serif', fontStyle: 'italic', color: '#888899',
    }).setOrigin(0.5).setDepth(101);
    this._spriteSelectGroup.push(subtitle);

    // 4x2 grid of character options
    const cols = 4, rows = 2;
    const cellW = 140, cellH = 130;
    const gridW = cols * cellW;
    const gridH = rows * cellH;
    const gridStartX = (width - gridW) / 2 + cellW / 2;
    const gridStartY = height * 0.28 + cellH / 2;

    // Selection highlight (starts null)
    let selectedKey = null;
    let selectedBorder = null;

    // Confirm button (initially hidden)
    const confirmBg = this.add.rectangle(width / 2, height * 0.88, 200, 44, 0x44aa44, 0.9)
      .setInteractive({ useHandCursor: true }).setStrokeStyle(2, 0x66cc66)
      .setDepth(102).setVisible(false);
    const confirmText = this.add.text(width / 2, height * 0.88, 'CONFIRM', {
      fontSize: '20px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: '#ffffff',
    }).setOrigin(0.5).setDepth(103).setVisible(false);
    this._spriteSelectGroup.push(confirmBg, confirmText);

    confirmBg.on('pointerover', () => confirmBg.setFillStyle(0x55cc55));
    confirmBg.on('pointerout', () => confirmBg.setFillStyle(0x44aa44, 0.9));
    confirmBg.on('pointerdown', () => {
      if (!selectedKey) return;
      G.spriteKey = selectedKey;
      saveGame();
      // Clean up sprite select UI
      for (const obj of this._spriteSelectGroup) {
        if (obj && obj.destroy) obj.destroy();
      }
      this._spriteSelectGroup = [];
      // Next step: name input
      this.showNameInput();
    });

    CHARACTER_SPRITES.forEach((cs, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx = gridStartX + col * cellW;
      const cy = gridStartY + row * cellH;

      // Cell background
      const cellBg = this.add.rectangle(cx, cy, cellW - 10, cellH - 10, 0x222244, 0.7)
        .setStrokeStyle(2, 0x444466)
        .setInteractive({ useHandCursor: true })
        .setDepth(102);

      // Sprite preview (frame 0 = front-facing idle)
      const spritePreview = this.add.sprite(cx, cy - 15, cs.key, 0).setScale(4).setDepth(103);

      // Label
      const label = this.add.text(cx, cy + 40, cs.label, {
        fontSize: '12px', fontFamily: 'monospace', color: '#aaaacc',
      }).setOrigin(0.5).setDepth(103);

      this._spriteSelectGroup.push(cellBg, spritePreview, label);

      // Hover
      cellBg.on('pointerover', () => {
        if (selectedKey !== cs.key) cellBg.setStrokeStyle(2, 0x88aacc);
      });
      cellBg.on('pointerout', () => {
        if (selectedKey !== cs.key) cellBg.setStrokeStyle(2, 0x444466);
      });

      // Click to select
      cellBg.on('pointerdown', () => {
        // Deselect previous
        if (selectedBorder) selectedBorder.setStrokeStyle(2, 0x444466);

        selectedKey = cs.key;
        selectedBorder = cellBg;
        cellBg.setStrokeStyle(3, 0x44aaff);

        // Update title preview if it still exists
        if (this._titlePreview && this._titlePreview.active) {
          this._titlePreview.setTexture(cs.key, 0);
        }

        // Show confirm button
        confirmBg.setVisible(true);
        confirmText.setVisible(true);
      });
    });
  }

  // ═══════ WAVE 6: NAME INPUT (after sprite select) ═══════
  showNameInput() {
    const { width, height } = this.scale;
    this._nameSelectGroup = [];

    // Overlay
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.8)
      .setDepth(100);
    this._nameSelectGroup.push(overlay);

    // Header
    const header = this.add.text(width / 2, height * 0.12, 'ENTER YOUR NAME', {
      fontSize: '28px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: '#ffffff',
      shadow: { offsetX: 1, offsetY: 1, color: '#000000', blur: 4, fill: true },
    }).setOrigin(0.5).setDepth(101);
    this._nameSelectGroup.push(header);

    // Character preview with chosen sprite
    const previewKey = G.spriteKey || 'player';
    const charPreview = this.add.sprite(width / 2, height * 0.3, previewKey, 0).setScale(5).setDepth(101);
    this._nameSelectGroup.push(charPreview);

    // ── Text input field ──
    const inputBg = this.add.rectangle(width / 2, height * 0.48, 320, 40, 0x111128, 0.95)
      .setStrokeStyle(2, 0x4444aa).setDepth(102);
    this._nameSelectGroup.push(inputBg);

    let currentName = '';
    const maxLen = 16;

    const inputText = this.add.text(width / 2, height * 0.48, '|', {
      fontSize: '20px', fontFamily: 'monospace', color: '#ffffff',
    }).setOrigin(0.5).setDepth(103);
    this._nameSelectGroup.push(inputText);

    const hint = this.add.text(width / 2, height * 0.55, 'Type your name, then press ENTER   (or pick one below)', {
      fontSize: '11px', fontFamily: 'monospace', fontStyle: 'italic', color: '#666688',
    }).setOrigin(0.5).setDepth(101);
    this._nameSelectGroup.push(hint);

    // Blinking cursor
    const cursorBlink = this.time.addEvent({
      delay: 500, loop: true,
      callback: () => {
        const cursor = inputText.text.endsWith('|') ? inputText.text.slice(0, -1) : inputText.text + '|';
        inputText.setText(currentName + (cursor.endsWith('|') ? '|' : ''));
        inputText.setText(currentName + (this._cursorVisible ? '|' : ''));
        this._cursorVisible = !this._cursorVisible;
      }
    });
    this._cursorVisible = true;

    // Keyboard listener for typing
    const onKeyDown = (event) => {
      if (event.key === 'Backspace') {
        currentName = currentName.slice(0, -1);
        inputText.setText(currentName + '|');
      } else if (event.key === 'Enter') {
        if (currentName.trim().length > 0) {
          finalizeName(currentName.trim());
        }
      } else if (event.key.length === 1 && currentName.length < maxLen) {
        // Only allow alphanumeric + spaces
        if (/[a-zA-Z0-9 ]/.test(event.key)) {
          currentName += event.key;
          inputText.setText(currentName + '|');
        }
      }
    };
    this.input.keyboard.on('keydown', onKeyDown);

    // ── Preset name buttons ──
    const presets = ['Adventurer', 'Wanderer', 'Seeker', 'Explorer', 'Spirit Walker', 'Champion'];
    const btnW = 140, btnH = 32, btnGap = 10;
    const presetsPerRow = 3;
    const rowCount = Math.ceil(presets.length / presetsPerRow);
    const presetStartY = height * 0.62;

    presets.forEach((name, i) => {
      const col = i % presetsPerRow;
      const row = Math.floor(i / presetsPerRow);
      const totalRowW = presetsPerRow * btnW + (presetsPerRow - 1) * btnGap;
      const rowStartX = (width - totalRowW) / 2 + btnW / 2;
      const bx = rowStartX + col * (btnW + btnGap);
      const by = presetStartY + row * (btnH + btnGap);

      const bg = this.add.rectangle(bx, by, btnW, btnH, 0x334466, 0.85)
        .setStrokeStyle(1, 0x556688)
        .setInteractive({ useHandCursor: true }).setDepth(102);
      const txt = this.add.text(bx, by, name, {
        fontSize: '13px', fontFamily: 'Georgia, serif', color: '#ccccee',
      }).setOrigin(0.5).setDepth(103);

      this._nameSelectGroup.push(bg, txt);

      bg.on('pointerover', () => bg.setFillStyle(0x445588));
      bg.on('pointerout', () => bg.setFillStyle(0x334466, 0.85));
      bg.on('pointerdown', () => {
        finalizeName(name);
      });
    });

    const finalizeName = (name) => {
      // Clean up
      this.input.keyboard.off('keydown', onKeyDown);
      cursorBlink.remove();

      G.name = name;
      saveGame();

      for (const obj of this._nameSelectGroup) {
        if (obj && obj.destroy) obj.destroy();
      }
      this._nameSelectGroup = [];

      // Next step: discipline choice
      this.showDisciplineChoice();
    };
  }

  // ═══════ DISCIPLINE CHOICE (new game only) ═══════
  showDisciplineChoice() {
    const { width, height } = this.scale;

    // Dim the title screen
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.75)
      .setDepth(100);

    // Header
    this.add.text(width / 2, height * 0.12, 'CHOOSE YOUR DISCIPLINE', {
      fontSize: '28px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: '#ffffff',
      shadow: { offsetX: 1, offsetY: 1, color: '#000000', blur: 4, fill: true },
    }).setOrigin(0.5).setDepth(101);

    this.add.text(width / 2, height * 0.19, 'This shapes your journey through the Spirit World', {
      fontSize: '14px', fontFamily: 'Georgia, serif', fontStyle: 'italic', color: '#888899',
    }).setOrigin(0.5).setDepth(101);

    // Discipline cards
    const disciplines = [
      { key: 'fighter',  icon: '\u2694\uFE0F', name: 'Fighter',  desc: '+10% combat XP gain',                        color: 0x662222 },
      { key: 'scout',    icon: '\uD83E\uDDED', name: 'Scout',    desc: '+10% exploration XP\n+20% recruit chance',    color: 0x223355 },
      { key: 'artisan',  icon: '\uD83D\uDD28', name: 'Artisan',  desc: '+10% crafting XP\n+1 assembly roll bonus',    color: 0x554422 },
      { key: 'merchant', icon: '\uD83D\uDCB0', name: 'Merchant', desc: 'Start with +50 gold\n+10% trade XP',         color: 0x225522 },
    ];

    const cardW = 200, cardH = 160, gap = 20;
    const totalW = disciplines.length * cardW + (disciplines.length - 1) * gap;
    const startX = (width - totalW) / 2 + cardW / 2;
    const cardY = height * 0.48;

    disciplines.forEach((d, i) => {
      const cx = startX + i * (cardW + gap);

      // Card background
      const cardBg = this.add.rectangle(cx, cardY, cardW, cardH, d.color, 0.85)
        .setStrokeStyle(2, 0x555566)
        .setInteractive({ useHandCursor: true })
        .setDepth(102);

      // Icon
      this.add.text(cx, cardY - 45, d.icon, {
        fontSize: '36px',
      }).setOrigin(0.5).setDepth(103);

      // Name
      this.add.text(cx, cardY - 8, d.name, {
        fontSize: '18px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: '#ffffff',
      }).setOrigin(0.5).setDepth(103);

      // Description
      this.add.text(cx, cardY + 28, d.desc, {
        fontSize: '12px', fontFamily: 'monospace', color: '#bbbbcc', align: 'center',
        lineSpacing: 4,
      }).setOrigin(0.5, 0).setDepth(103);

      // Hover effects
      cardBg.on('pointerover', () => { cardBg.setStrokeStyle(3, 0xffffff); cardBg.setAlpha(1); });
      cardBg.on('pointerout', () => { cardBg.setStrokeStyle(2, 0x555566); cardBg.setAlpha(0.85); });

      // Click to choose
      cardBg.on('pointerdown', () => {
        G.discipline = d.key;

        // Apply Merchant starting bonus
        if (d.key === 'merchant') {
          G.coins = (G.coins || 100) + 50;
        }

        notify(`Discipline chosen: ${d.name}!`);
        saveGame();

        // Transition to world
        this.cameras.main.fadeOut(600, 0, 0, 0);
        this.time.delayedCall(600, () => this.scene.start('WorldScene'));
      });
    });
  }
}
