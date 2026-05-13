// ═══════════════════════════════════════════════════
// WORLD SCENE — Full overworld with sprites, NPCs, enemies
// ═══════════════════════════════════════════════════

class WorldScene extends Phaser.Scene {
  constructor() { super('WorldScene'); }

  create() {
    // Safety: clear stale battle state from previous session
    G.inBattle = false;
    B = null;

    const T = 32;
    const MW = WORLD_W, MH = WORLD_H; // 110x85 from world-gen.js

    this.cameras.main.fadeIn(600);
    this.cameras.main.setBackgroundColor('#d8e8f0');

    // ── Render the world map ──
    // Build the impassable lookup set once
    this._impassableSet = new Set([1, 3, 7, 13, 15, 16, 21, 23, 25]);
    this._tileSize = T;

    // Convert hex color string to Phaser number
    function hexToNum(hex) { return parseInt(hex.replace('#', ''), 16); }

    // ── ERW terrain tile mapping (32x32, 55 cols in terrain-grass.png) ──
    // ONLY used for Rolling Hills (grass region y>=45) and sand/path where appropriate.
    // Frost Valley, Volcanic Isles, Dark Castle keep their flat colors — ERW is a grass pack.
    // Use small consistent frame sets (3-4 frames) to avoid patchwork look.
    const ERW_TERRAIN = {
      // Dense grass — 4 visually similar frames for uniform ground
      grass:      [416, 417, 471, 472],
      // Lighter grass variant for hills
      hillGrass:  [418, 419, 473, 474],
      // Dirt path — consistent brown fills
      dirt:       [1131, 1132, 1186, 1187],
      // Stone floor — plaza / town center
      stone:      [2335, 2336, 2390, 2391],
      // Sand — beach areas
      sand:       [2628, 2629, 2683, 2684],
    };

    // Only map tile types that make sense for ERW grass pack
    // Region-aware: check if tile is in Rolling Hills (y >= 45) or a beach/sand zone
    const hasERW = this.textures.exists('erw_terrain');

    // Draw entire map
    const mapGfx = this.add.graphics();
    for (let y = 0; y < MH; y++) {
      for (let x = 0; x < MW; x++) {
        const tileType = worldMap[y] ? worldMap[y][x] : 0;

        // Determine if this tile should use ERW terrain
        let erwGroup = null;
        if (hasERW) {
          const isRollingHills = y >= 45;  // Rolling Hills is the southern half
          const isBeach = tileType === 20; // sand is sand everywhere

          if (isRollingHills) {
            // Rolling Hills — this is where ERW grass belongs
            if (tileType === 9 || tileType === 10) erwGroup = 'grass';
            else if (tileType === 11) erwGroup = 'hillGrass';
            else if (tileType === 2) erwGroup = 'dirt';
            else if (tileType === 19) erwGroup = 'stone';
          }
          // Sand tiles anywhere
          if (isBeach) erwGroup = 'sand';
        }

        if (erwGroup) {
          const frames = ERW_TERRAIN[erwGroup];
          const frame = frames[(x * 3 + y * 5) % frames.length];
          this.add.image(x * T + T / 2, y * T + T / 2, 'erw_terrain', frame).setDepth(0);
        } else {
          // Flat color — Frost Valley, Volcanic, Dark Castle, water, mountains, etc.
          const colorHex = TILE_COLORS[tileType] || '#d8e8f0';
          const color = hexToNum(colorHex);
          mapGfx.fillStyle(color, 1);
          mapGfx.fillRect(x * T, y * T, T, T);
        }
      }
    }

    // ── Sprite overlays: stamp real tileset art on trees, flowers, buildings ──
    // ERW terrain handles ground; these overlay objects on top
    // Frame index = row * COLS + col  (Nature=24cols, House=33cols, Desert=20cols)
    const TILE_SPRITES = {
      10: { key: 'tiles_nature', frames: [156, 157, 158, 159, 160], depth: 1 }, // flowers — colorful blooms (row 6)
      1:  { key: 'tiles_nature', frames: [30, 31, 32], depth: 2 },              // frost trees — snowy crowns (row 1, cols 6-8)
      13: { key: 'tiles_nature', frames: [44, 45, 46, 47], depth: 2 },          // warm trees — green crowns (row 1, cols 20-23)
      21: { key: 'tiles_desert', frames: [70, 71, 90, 91], depth: 2 },          // palm trees — fronds (rows 3-4)
      25: { key: 'tiles_nature', frames: [24, 25, 120, 121], depth: 2 },        // dark/dead trees (row 1 + row 5)
      5:  { key: 'tiles_house', frames: [12, 13, 14], depth: 2 },               // buildings — house fronts (row 0)
      8:  { key: 'tiles_house', frames: [16, 17, 18], depth: 2 },               // workshop — stone buildings (row 0)
      12: { key: 'tiles_house', frames: [45, 46, 47], depth: 2 },               // cantina — warm fronts (row 1)
    };
    for (let y = 0; y < MH; y++) {
      for (let x = 0; x < MW; x++) {
        const tileType = worldMap[y] ? worldMap[y][x] : 0;
        const si = TILE_SPRITES[tileType];
        if (si) {
          const frame = si.frames[(x * 7 + y * 13) % si.frames.length];
          this.add.image(x * T + T / 2, y * T + T / 2, si.key, frame).setScale(2).setDepth(si.depth);
        }
      }
    }

    // ── ERW Animated Props — bring the world to life ──
    this._erwAnimSprites = [];

    // Campfires at hub towns
    const campfireSpots = [
      { x: HUB.x + 4, y: HUB.y + 4 },
      { x: HUB_MEADOW.x + 3, y: HUB_MEADOW.y + 3 },
      { x: HUB_VOLCANIC.x + 2, y: HUB_VOLCANIC.y + 2 },
    ];
    if (this.textures.exists('erw_campfire')) {
      for (const spot of campfireSpots) {
        const cf = this.add.sprite(spot.x * T + T/2, spot.y * T + T/2, 'erw_campfire', 0)
          .setScale(0.4).setDepth(3);
        if (this.anims.exists('erw_campfire_burn')) cf.play('erw_campfire_burn');
        this._erwAnimSprites.push(cf);

        if (this.textures.exists('erw_campfire_smoke')) {
          const smoke = this.add.sprite(spot.x * T + T/2, spot.y * T - 8, 'erw_campfire_smoke', 0)
            .setScale(0.5).setDepth(4).setAlpha(0.6);
          if (this.anims.exists('erw_smoke')) smoke.play('erw_smoke');
          this._erwAnimSprites.push(smoke);
        }
      }
    }

    // Butterflies in Rolling Hills grass/flower areas ONLY (y >= 45)
    if (this.textures.exists('erw_butterfly1')) {
      for (let i = 0; i < 12; i++) {
        let bx, by, attempts = 0;
        do {
          bx = 5 + Math.floor(Math.random() * (MW - 10));
          by = 46 + Math.floor(Math.random() * (MH - 50)); // Only Rolling Hills (y >= 45)
          attempts++;
        } while (attempts < 50 && worldMap[by]?.[bx] !== 9 && worldMap[by]?.[bx] !== 10 && worldMap[by]?.[bx] !== 11);

        if (attempts < 50) {
          const animKey = i % 2 === 0 ? 'erw_butterfly1_fly' : 'erw_butterfly2_fly';
          const texKey = i % 2 === 0 ? 'erw_butterfly1' : 'erw_butterfly2';
          const bf = this.add.sprite(bx * T + T/2, by * T + T/2, texKey, 0)
            .setScale(0.35).setDepth(5).setAlpha(0.85);
          if (this.anims.exists(animKey)) bf.play(animKey);
          this.tweens.add({
            targets: bf,
            x: bf.x + Phaser.Math.Between(-60, 60),
            y: bf.y + Phaser.Math.Between(-40, 40),
            duration: Phaser.Math.Between(4000, 8000),
            yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
          });
          this._erwAnimSprites.push(bf);
        }
      }
    }

    // Nature particles floating in Rolling Hills grassy areas ONLY
    if (this.textures.exists('erw_particles')) {
      for (let i = 0; i < 8; i++) {
        let px, py, attempts = 0;
        do {
          px = 5 + Math.floor(Math.random() * (MW - 10));
          py = 46 + Math.floor(Math.random() * (MH - 50)); // Only Rolling Hills
          attempts++;
        } while (attempts < 50 && worldMap[py]?.[px] !== 9 && worldMap[py]?.[px] !== 10);

        if (attempts < 50) {
          const pt = this.add.sprite(px * T + T/2, py * T, 'erw_particles', 0)
            .setScale(0.4).setDepth(4).setAlpha(0.5);
          if (this.anims.exists('erw_nature_particles')) pt.play('erw_nature_particles');
          this.tweens.add({
            targets: pt, y: pt.y - 30, alpha: 0.2,
            duration: Phaser.Math.Between(5000, 10000), yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
          });
          this._erwAnimSprites.push(pt);
        }
      }
    }

    // No physics static group — collision is handled by tile lookup in update()

    // ── Player ──
    // Reset to hub if saved position is problematic (blocked OR far from any hub)
    const spawnTX = Math.floor(G.x);
    const spawnTY = Math.floor(G.y);
    const nearAnyHub = [HUB, HUB_MEADOW, HUB_VOLCANIC, HUB_DARK].some(
      h => Math.abs(spawnTX - h.x) < 20 && Math.abs(spawnTY - h.y) < 20
    );
    if (spawnTX < 0 || spawnTY < 0 || spawnTX >= MW || spawnTY >= MH ||
        this._impassableSet.has(worldMap[spawnTY]?.[spawnTX]) || !nearAnyHub) {
      console.log('[WorldScene] Resetting to Polaris Hub from', spawnTX, spawnTY);
      G.x = HUB.x + 3;
      G.y = HUB.y + 2;
      saveGame();
    }

    // Snap to tile center to avoid sub-pixel spawn issues
    const spawnPX = Math.floor(G.x) * T + T / 2;
    const spawnPY = Math.floor(G.y) * T + T / 2;
    console.log('[WorldScene] Spawning player at tile', Math.floor(G.x), Math.floor(G.y), '-> px', spawnPX, spawnPY);

    // Store scene reference for global access (NPC dialogue triggers, etc.)
    window._worldScene = this;

    // Wave 6: Use selected character sprite (G.spriteKey), fall back to 'player'
    const playerTexture = (G.spriteKey && G.spriteKey !== 'player' && this.textures.exists(G.spriteKey)) ? G.spriteKey : 'player';
    this._playerTexture = playerTexture;
    this.player = this.physics.add.sprite(spawnPX, spawnPY, playerTexture, 0);
    this.player.setScale(2);
    this.player.setDepth(10);
    this.player.setCollideWorldBounds(true);

    // Fallback colored square behind the sprite — guarantees visibility even if texture fails
    this._playerFallbackRect = this.add.rectangle(spawnPX, spawnPY, 24, 24, 0x44ff44, 0.6).setDepth(8);

    // Bright player indicator — large pulsing glow so you can always find yourself
    this._playerMarker = this.add.circle(spawnPX, spawnPY, 28, 0x44aaff, 0.55).setDepth(9);
    this._playerMarkerRing = this.add.circle(spawnPX, spawnPY, 34, 0x44aaff, 0).setDepth(9).setStrokeStyle(3, 0x44aaff, 0.8);
    this.tweens.add({ targets: this._playerMarkerRing, scaleX: 1.5, scaleY: 1.5, alpha: 0, duration: 1000, yoyo: false, repeat: -1 });
    // No physics collider — tile collision handled manually in update()

    // ── Camera ──
    // CRITICAL: Snap camera to player position FIRST, then start smooth follow.
    // Without this, the camera starts at (0,0) and the slow lerp takes many
    // frames to reach the player — making the character invisible on load.
    const cam = this.cameras.main;
    cam.setBounds(0, 0, MW * T, MH * T);
    cam.setZoom(1.5);
    // Initial snap then instant follow — startFollow handles viewport math internally
    cam.setScroll(spawnPX - cam.width / (2 * cam.zoom), spawnPY - cam.height / (2 * cam.zoom));
    cam.startFollow(this.player, true, 1, 1);

    // UI elements use setScrollFactor(0) on the main camera — no separate UI camera needed

    // ── NPCs (positions from npcs.js NPCS + HOSTILE_NPCS data) ──
    this.npcSprites = [];
    // Friendly — Frost Valley hub
    this.spawnNPC('Elder Frost', (HUB.x + 2) * T, (HUB.y - 1) * T, 'npc_elder', 0xdaa520);
    this.spawnNPC('Smith Ember', HUB.x * T, (HUB.y + 5) * T, 'npc_knight', 0xe07020);
    this.spawnNPC('Crazy Lou', (HUB.x + 7) * T, (HUB.y + 1) * T, 'npc_hunter', 0xc0a040);
    // Friendly — Rolling Hills
    this.spawnNPC('Farmer Bea', 24 * T, 58 * T, 'npc_elder', 0x6a8a4a);
    this.spawnNPC('Herbalist Sage', 28 * T, 60 * T, 'npc_knight', 0x4a8a6a);
    // Friendly — Volcanic Isles
    this.spawnNPC('Captain Flint', 74 * T, 16 * T, 'npc_hunter', 0xcc6644);
    this.spawnNPC('Lava Tender', 76 * T, 14 * T, 'npc_knight', 0xff8844);
    // Friendly — Dark Castle
    this.spawnNPC('Shadow Warden', 93 * T, 20 * T, 'npc_hunter', 0x8a6aaa);
    this.spawnNPC('Cursed Scholar', 95 * T, 22 * T, 'npc_elder', 0x6a4a8a);

    // Hostile NPCs (from HOSTILE_NPCS positions)
    this.spawnNPC('Brawler Jax', 30 * T, 20 * T, 'creature_bear', 0xcc4444, true);
    this.spawnNPC('Ice Queen Vera', 40 * T, 15 * T, 'npc_knight', 0x6688cc, true);
    this.spawnNPC('Bandit Marcus', 28 * T, 48 * T, 'creature_dragon', 0xa88844, true);
    this.spawnNPC('Lava Raider Kira', 68 * T, 25 * T, 'npc_hunter', 0xee8844, true);
    this.spawnNPC('Shadow Knight Vex', 92 * T, 18 * T, 'npc_elder', 0x8866aa, true);
    this.spawnNPC('The Exile', 55 * T, 35 * T, 'npc_knight', 0x666666, true);

    // ── Enemies ──
    this.enemies = this.physics.add.group();
    for (let i = 0; i < 8; i++) this.spawnEnemy();
    this._spawnTimer = this.time.addEvent({ delay: 4000, callback: this.spawnEnemy, callbackScope: this, loop: true });
    this.physics.add.overlap(this.player, this.enemies, this.onEnemyContact, null, this);
    // 2-second grace period — no battles immediately after scene load
    this._spawnGrace = true;
    this.time.delayedCall(2000, () => { this._spawnGrace = false; });

    // ── Spirit Wisps (glowing collectible orbs) ──
    this.wisps = this.physics.add.group();
    for (let i = 0; i < 5; i++) this.spawnWisp();
    this.time.addEvent({ delay: 6000, callback: this.spawnWisp, callbackScope: this, loop: true });
    this.physics.add.overlap(this.player, this.wisps, this.onWispCollect, null, this);

    // ── Controls ──
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys('W,A,S,D');
    this.eKey = this.input.keyboard.addKey('E');
    this.cKey = this.input.keyboard.addKey('C');
    this.tKey = this.input.keyboard.addKey('T');
    this.iKey = this.input.keyboard.addKey('I');
    this.pKey = this.input.keyboard.addKey('P');
    this.yKey = this.input.keyboard.addKey('Y');
    this.fKey = this.input.keyboard.addKey('F');
    this.bKey = this.input.keyboard.addKey('B');

    // ── HUD ──
    this.buildHUD();

    // ── HUD positioning: divide canvas size by zoom to get visible area ──
    const zoom = cam.zoom || 1.5;
    const hudW = this.scale.width / zoom;
    const hudH = this.scale.height / zoom;

    // ── Buff HUD (above action bar, centered) ──
    this._buffHudText = this.add.text(hudW / 2, hudH - 80, '', {
      fontSize: '8px', fontFamily: 'monospace', color: '#88ff88',
      backgroundColor: '#000000aa', padding: { x: 6, y: 2 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(200).setVisible(false);

    // ── Render player structures ──
    this._structureSprites = [];
    this._renderStructures();

    // ── Dialogue box (scrollFactor 0 — raw canvas coords) ──
    const dlgW = this.scale.width;
    const dlgH = this.scale.height;
    this.dialogueContainer = this.add.container(0, 0).setDepth(300).setScrollFactor(0);
    this.dialogueBg = this.add.rectangle(dlgW / 2, dlgH - 60, dlgW - 40, 60, 0x111128, 0.92)
      .setStrokeStyle(2, 0x4444aa);
    this.dialogueNameText = this.add.text(30, dlgH - 82, '', {
      fontSize: '14px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: '#ffdd44',
    });
    this.dialogueBodyText = this.add.text(30, dlgH - 64, '', {
      fontSize: '13px', fontFamily: 'Georgia, serif', color: '#ccccee',
      wordWrap: { width: dlgW - 80 },
    });
    this.dialogueContainer.add([this.dialogueBg, this.dialogueNameText, this.dialogueBodyText]);
    this.dialogueContainer.setVisible(false);

    // ── World bounds ──
    this.physics.world.setBounds(0, 0, MW * T, MH * T);

    // ── Region labels on the map ──
    const regionLabels = [
      { text: 'FROST VALLEY', x: 25, y: 5, color: '#88bbff' },
      { text: 'Polaris Hub', x: HUB.x + 3, y: HUB.y - 3, color: '#daa520' },
      { text: 'ROLLING HILLS', x: 30, y: 47, color: '#88cc44' },
      { text: 'Meadowbrook', x: 26, y: 56, color: '#6a8a4a' },
      { text: 'VOLCANIC ISLES', x: 72, y: 7, color: '#ff8844' },
      { text: 'DARK CASTLE', x: 98, y: 5, color: '#aa66cc' },
    ];
    for (const rl of regionLabels) {
      this.add.text(rl.x * T, rl.y * T, rl.text, {
        fontSize: '10px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: rl.color,
        backgroundColor: '#00000066', padding: { x: 4, y: 2 },
      }).setDepth(5);
    }

    // ── Building labels in Polaris ──
    const buildings = [
      { name: 'Trading Post', x: HUB.x + 1, y: HUB.y + 1 },
      { name: 'Arena', x: HUB.x + 5, y: HUB.y + 1 },
      { name: 'Workshop', x: HUB.x + 1, y: HUB.y + 3 },
      { name: 'Inn', x: HUB.x + 5, y: HUB.y + 3 },
      { name: 'Cantina', x: HUB.x + 3, y: HUB.y + 5 },
      { name: 'Dungeons', x: HUB.x + 3, y: HUB.y + 7 },
    ];
    for (const b of buildings) {
      // Building marker (slightly brighter square on top of tile)
      this.add.rectangle(b.x * T + T/2, b.y * T + T/2, T - 2, T - 2, 0x8a7a5a)
        .setStrokeStyle(1, 0xaaa888).setDepth(3);
      this.add.text(b.x * T + T/2, b.y * T - 6, b.name, {
        fontSize: '7px', fontFamily: 'monospace', color: '#eecc88',
        backgroundColor: '#00000066', padding: { x: 2, y: 1 },
      }).setOrigin(0.5).setDepth(6);
    }

    // ── Wave 3: Building Interactions ──
    this._interactBuildings = [
      { name: 'Trading Post', x: HUB.x + 1, y: HUB.y + 1, action: 'tradingPost' },
      { name: 'Arena', x: HUB.x + 5, y: HUB.y + 1, action: 'arena' },
      { name: 'Workshop', x: HUB.x + 1, y: HUB.y + 3, action: 'workshop' },
      { name: 'Inn', x: HUB.x + 5, y: HUB.y + 3, action: 'inn' },
      { name: 'Cantina', x: HUB.x + 3, y: HUB.y + 5, action: 'cantina' },
      { name: 'Dungeons', x: HUB.x + 3, y: HUB.y + 7, action: 'dungeons' },
    ];

    // ── Wave 3: Signposts ──
    this._signposts = [
      { x: HUB.x + 3, y: HUB.y - 2, text: 'Welcome to Polaris Hub! North: Frost Valley zones. South: Rolling Hills.' },
      { x: 28, y: 42, text: 'CAUTION: Mountain pass ahead. Rolling Hills region beyond.' },
      { x: 58, y: 20, text: 'Volcanic Isles passage. Beware lava flows and strong Spiritkin.' },
      { x: 90, y: 20, text: 'Dark Castle entrance. Only the brave pass this threshold.' },
      { x: 26, y: 56, text: 'Meadowbrook — a peaceful settlement among the rolling green hills.' },
      { x: 74, y: 13, text: 'Volcanic Settlement — built on sand and ash. Trade and rest here.' },
    ];
    for (const sp of this._signposts) {
      this.add.text(sp.x * T + T/2, sp.y * T + T/2, '\u{1F4DC}', {
        fontSize: '16px',
      }).setOrigin(0.5).setDepth(6);
    }

    // ── Wave 3: Lore Tablets ──
    this._loreTablets = [
      { id: 'lore_polaris', x: 20, y: 16, text: 'The first settlers named this land after the Polaris star, a beacon visible even through spirit storms. Frost Valley was where Spiritkin and humans first learned to coexist.' },
      { id: 'lore_lake', x: 40, y: 20, text: 'The Frozen Lake was once a sacred pool where Spiritkin emerged from the spirit world. When the Great Frost came, the lake sealed shut — trapping hundreds of spirits beneath the ice.' },
      { id: 'lore_hills', x: 30, y: 55, text: 'Rolling Hills was farmland before the Spiritkin arrived. Farmer Bea says the flowers here bloom in colors that don\'t exist anywhere else — fed by spirit energy seeping up from below.' },
      { id: 'lore_castle', x: 98, y: 12, text: 'The Dark Castle was built by the Valkin, ancient spirit wardens who believed darkness could be harnessed. When they vanished, the castle remained — and something still stirs inside.' },
    ];
    this._loreTabletSprites = [];
    for (const lt of this._loreTablets) {
      if (G.loreCollected.includes(lt.id)) continue; // already collected
      const glow = this.add.rectangle(lt.x * T + T/2, lt.y * T + T/2, 14, 14, 0xffcc00, 0.85)
        .setStrokeStyle(1, 0xffee44).setDepth(8);
      const outerGlow = this.add.rectangle(lt.x * T + T/2, lt.y * T + T/2, 20, 20, 0xffcc00, 0.2)
        .setDepth(7);
      this.tweens.add({ targets: outerGlow, scaleX: 1.5, scaleY: 1.5, alpha: 0.05, duration: 1200, yoyo: true, repeat: -1 });
      this._loreTabletSprites.push({ id: lt.id, x: lt.x, y: lt.y, text: lt.text, glow, outerGlow });
    }

    // ── Wave 3: Region transition tracking ──
    this._lastRegion = getCurrentRegion(G.x, G.y);

    // ── Encounter zone labels ──
    for (const zone of ENCOUNTER_ZONES) {
      this.add.text((zone.x + zone.w/2) * T, zone.y * T - 8, zone.name, {
        fontSize: '8px', fontFamily: 'monospace', color: '#aa88dd',
        backgroundColor: '#00000044', padding: { x: 2, y: 1 },
      }).setOrigin(0.5).setDepth(5);
    }

    // ── Menu buttons bar (top-center) ──
    const menuY = 8;
    const btnW = 68, btnH = 24, btnGap = 4;
    const buttons = [
      { label: 'TEAM (T)', key: 'T', action: () => this.showTeamLineup(), color: 0x445588 },
      { label: 'ITEMS (I)', key: 'I', action: () => this.showInventory(), color: 0x885544 },
      { label: 'CRAFT (C)', key: 'C', action: () => { GameAudio.menuOpen(); this.scene.launch('CraftScene'); this.scene.pause(); }, color: 0x665533 },
      { label: 'PROF (P)', key: 'P', action: () => this.showProfessionPanel(), color: 0x664488 },
      { label: 'TALENT (Y)', key: 'Y', action: () => { GameAudio.menuOpen(); this.scene.launch('TalentScene'); this.scene.pause(); }, color: 0x884466 },
      { label: 'BUILD (B)', key: 'B', action: () => this._showBuildMenu(), color: 0x997744 },
      { label: 'HELP (H)', key: 'H', action: () => this.showHelpPanel(), color: 0x448844 },
    ];
    const startX = hudW / 2 - (buttons.length * (btnW + btnGap)) / 2;
    this._menuBtns = [];
    buttons.forEach((btn, i) => {
      const x = startX + i * (btnW + btnGap) + btnW / 2;
      const bg = this.add.rectangle(x, menuY + btnH/2, btnW, btnH, btn.color, 0.85)
        .setScrollFactor(0).setDepth(200).setInteractive({ useHandCursor: true })
        .setStrokeStyle(1, 0x666666);
      const label = this.add.text(x, menuY + btnH/2, btn.label, {
        fontSize: '8px', fontFamily: 'monospace', fontStyle: 'bold', color: '#ffffff',
      }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
      bg.on('pointerdown', btn.action);
      bg.on('pointerover', () => bg.setAlpha(1));
      bg.on('pointerout', () => bg.setAlpha(0.85));
      this._menuBtns.push({ bg, label });
    });

    // ── Class Action Bar (bottom center) ──
    this._buildActionBar();

    // ── Controls hint ──
    this._controlsHint = this.add.text(6, hudH - 14, 'WASD: Move | E: Interact', {
      fontSize: '8px', fontFamily: 'monospace', color: '#444444',
    }).setScrollFactor(0).setDepth(200);

    // ── Resize handler — reposition HUD on window resize ──
    this.scale.on('resize', () => {
      // Raw canvas dimensions for scrollFactor(0) UI
      this._repositionHUD(this.scale.width, this.scale.height);
    });

    // ── Region text ──
    this.regionText = this.add.text(640, 40, '', {
      fontSize: '16px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: '#ffffff',
      backgroundColor: '#00000066', padding: { x: 12, y: 4 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(200);

    // Notify callback for globals
    _notifyCallback = (text) => this.showNotification(text);
    console.log('[WorldScene] create: HUD + UI done');

    // Panel manager for inventory/team overlays
    this.panels = new PanelManager(this);
    console.log('[WorldScene] create: PanelManager done');

    // Wave 4: Arena reward handler — when WorldScene resumes after battle,
    // check if it was an arena battle and award bonus gold
    this.events.on('resume', () => {
      if (this._pendingArenaCheck) {
        this._pendingArenaCheck = false;
        // B is null after battle ends; check battlesWon delta to determine win
        const winsNow = G.rep?.battlesWon || 0;
        if (winsNow > (this._arenaWinsBefore || 0)) {
          // Player won the arena battle
          G.arenaWins = (G.arenaWins || 0) + 1;
          G.coins += 50;
          saveGame();
          checkAndNotifyTitles();
          this.showNotification('Arena Victory! +50 gold!');
        }
        this._arenaWinsBefore = null;
      }
    });

    // ── Wave 5: World Boss resume handler ──
    this.events.on('resume', () => {
      if (this._pendingWorldBossCheck) {
        this._pendingWorldBossCheck = false;
        const winsNow = G.rep?.battlesWon || 0;
        if (winsNow > (this._worldBossWinsBefore || 0)) {
          G.coins += 100;
          // Award rare essence as boss loot
          const rareCards = ALL_CARDS.filter(c => c.rarity === 'rare' || c.rarity === 'ghost-rare' || c.rarity === 'legendary');
          const lootCard = rareCards[Math.floor(Math.random() * rareCards.length)];
          if (lootCard) {
            G.essences.push({ name: lootCard.name, fromName: lootCard.name, rarity: lootCard.rarity, potency: 8, stability: 8, resonance: 8, region: 'World Boss', subtype: 'Boss Essence' });
          }
          saveGame();
          this.showNotification('WORLD BOSS DEFEATED! +100 gold, +10 XP, rare essence!');
        }
        this._worldBossWinsBefore = null;
      }
    });

    // ── Wave 5: Black Riders (night-only enemies) ──
    this._blackRiders = [];
    this._blackRiderTimer = null;
    this._wasNight = false;

    // ── Wave 5: World Boss ──
    this._worldBossSprite = null;
    this._worldBossLabel = null;
    this._worldBossGlow = null;
    this._worldBossRegion = null;
    this._worldBossRespawnTime = 0;
    this.spawnWorldBoss();

    // ── Wave 5: Sparkle Trails ──
    this.createSparkleTrails();

    // ── Wave 5: Help Panel (H key) ──
    this.hKey = this.input.keyboard.addKey('H');

    // ── Wave 5: Daily Challenge ──
    this.initDailyChallenge();

    // Star Fox comm overlay
    try {
      this.comm = new CommOverlay(this);
      console.log('[WorldScene] create: CommOverlay done');
    } catch(e) {
      console.error('[WorldScene] CommOverlay FAILED:', e);
      this.comm = null;
    }

    // ── Wave 6: Onboarding Tutorial ──
    this._isNewGame = (G.rep.battlesWon === 0 && !G.tutorialComplete);
    this._tutorialArrow = null;
    if (this._isNewGame && G.tutorialStep === 0) {
      // Delay slightly so the scene fully renders before showing the first message
      this.time.delayedCall(1500, () => this.startTutorial());
    }

    // ── Wave 6: Multiplayer Presence ──
    this._otherPlayerSprites = {};
    this.initMultiplayerPresence();

    // ── Periodic save (every 30s) ──
    this.time.addEvent({
      delay: 30000,
      callback: () => saveGame(),
      callbackScope: this,
      loop: true,
    });

    // ── Live multiplayer presence (90ms — near real-time) ──
    // ~11 writes/sec per player. Fine for small groups testing.
    // TODO: Throttle to 500ms when 10+ players are online to stay under Firebase limits.
    this._lastPresenceX = G.x;
    this._lastPresenceY = G.y;
    this._presenceTimer = this.time.addEvent({
      delay: 90,
      callback: () => {
        // Send if player moved at all (0.3 tile threshold for sub-tile smoothness)
        if (Math.abs(G.x - this._lastPresenceX) > 0.3 || Math.abs(G.y - this._lastPresenceY) > 0.3) {
          this._lastPresenceX = G.x;
          this._lastPresenceY = G.y;
          MultiplayerPresence.updatePresence({
            name: G.name, x: G.x, y: G.y, spriteKey: G.spriteKey,
            level: G.level, activeName: G.team[G.activeIdx]?.name,
          });
        }
      },
      callbackScope: this,
      loop: true,
    });

    // ── Stale player cleanup (remove ghosts not seen in 60s) ──
    this.time.addEvent({
      delay: 15000,
      callback: () => {
        const now = Date.now();
        for (const [pid, entry] of Object.entries(this._otherPlayerSprites)) {
          if (now - entry.lastSeen > 60000) {
            this.removeOtherPlayer(pid);
          }
        }
      },
      callbackScope: this,
      loop: true,
    });

    // ── Music ──
    try {
      this._currentMusic = 'frost';
      if (this.sound.get('music_hub')) {
        this.sound.play('music_hub', { loop: true, volume: 0.3 });
      }
    } catch(e) { console.log('[Audio] Music skipped:', e.message); }
    console.log('[WorldScene] create: COMPLETE');
  }

  // ── Tile collision helper (replaces 2270 static physics bodies) ──
  isTileBlocked(px, py) {
    const tx = Math.floor(px / this._tileSize);
    const ty = Math.floor(py / this._tileSize);
    if (tx < 0 || ty < 0 || tx >= WORLD_W || ty >= WORLD_H) return true;
    return this._impassableSet.has(worldMap[ty]?.[tx]);
  }

  update(time, delta) {
    try {
    if (G.inBattle) return;
    if (!this._updateLogged) { this._updateLogged = true; console.log('[WorldScene] update() running, player:', this.player?.x, this.player?.y); }

    // Don't process movement/hotkeys while typing in chat
    if (this._chatOpen) {
      this.player.setVelocity(0, 0);
      return;
    }

    const speed = 140;
    let vx = 0, vy = 0;

    if (this.cursors.left.isDown || this.wasd.A.isDown) { vx = -speed; this._lastDir = 'left'; }
    else if (this.cursors.right.isDown || this.wasd.D.isDown) { vx = speed; this._lastDir = 'right'; }
    if (this.cursors.up.isDown || this.wasd.W.isDown) { vy = -speed; this._lastDir = 'up'; }
    else if (this.cursors.down.isDown || this.wasd.S.isDown) { vy = speed; this._lastDir = 'down'; }

    if (vx !== 0 && vy !== 0) { vx *= 0.707; vy *= 0.707; }

    // Tile-based collision: check destination before applying velocity
    const T = this._tileSize;
    const halfBody = 10; // approximate half-width of player collision body
    const px = this.player.x;
    const py = this.player.y;
    const dt = (delta || 16) / 1000;
    const nextX = px + vx * dt;
    const nextY = py + vy * dt;

    // Check X movement
    if (vx !== 0) {
      const probeX = vx > 0 ? nextX + halfBody : nextX - halfBody;
      if (this.isTileBlocked(probeX, py - halfBody) || this.isTileBlocked(probeX, py + halfBody)) {
        vx = 0;
      }
    }
    // Check Y movement
    if (vy !== 0) {
      const probeY = vy > 0 ? nextY + halfBody : nextY - halfBody;
      if (this.isTileBlocked(px - halfBody, probeY) || this.isTileBlocked(px + halfBody, probeY)) {
        vy = 0;
      }
    }

    this.player.setVelocity(vx, vy);

    // Safety: if player is currently INSIDE a blocked tile, push them out
    if (this.isTileBlocked(px, py)) {
      const safeTX = Math.floor(px / T);
      const safeTY = Math.floor(py / T);
      let escaped = false;
      for (let r = 1; r < 15 && !escaped; r++) {
        for (let dy = -r; dy <= r && !escaped; dy++) {
          for (let dx = -r; dx <= r && !escaped; dx++) {
            if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
            const checkTX = safeTX + dx, checkTY = safeTY + dy;
            if (checkTX >= 0 && checkTY >= 0 && checkTX < WORLD_W && checkTY < WORLD_H &&
                !this._impassableSet.has(worldMap[checkTY]?.[checkTX])) {
              this.player.setPosition(checkTX * T + T / 2, checkTY * T + T / 2);
              this.player.setVelocity(0, 0);
              escaped = true;
            }
          }
        }
      }
      // If still stuck after 15-tile radius, warp to hub
      if (!escaped) {
        this.player.setPosition((HUB.x + 3) * T, (HUB.y + 2) * T);
        this.player.setVelocity(0, 0);
      }
    }

    // Track player marker + fallback rect
    if (this._playerMarker) this._playerMarker.setPosition(this.player.x, this.player.y);
    if (this._playerMarkerRing) this._playerMarkerRing.setPosition(this.player.x, this.player.y);
    if (this._playerFallbackRect) this._playerFallbackRect.setPosition(this.player.x, this.player.y);

    // Animate walk or show idle frame
    // Wave 6: Use correct animation prefix for selected character sprite
    const animPrefix = (this._playerTexture && this._playerTexture !== 'player') ? this._playerTexture + '_' : '';
    if (vx !== 0 || vy !== 0) {
      this.player.play(`${animPrefix}walk_${this._lastDir}`, true);
    } else {
      this.player.stop();
      // Idle: show frame 0 of last direction (col index: down=0, up=1, left=2, right=3)
      const idleFrame = { down: 0, up: 1, left: 2, right: 3 }[this._lastDir || 'down'];
      this.player.setFrame(idleFrame);
    }

    G.x = this.player.x / 32;
    G.y = this.player.y / 32;

    // Day/night cycle
    this.updateDayNight();

    // Region detection
    const region = getCurrentRegion(G.x, G.y);
    const regionNames = { frost_valley: 'Frost Valley', rolling_hills: 'Rolling Hills', volcanic_isles: 'Volcanic Isles', dark_castle: 'Dark Castle' };
    this.regionText.setText(regionNames[region] || '');

    // NPC + Building interactions — read E once, share across all checks
    // NPCs check FIRST so dialogue takes priority over entering nearby buildings
    // Manual once-per-press guard (JustDown can be unreliable in Phaser 4)
    const eDown = this.eKey.isDown;
    if (eDown && !this._ePrevDown) {
      this._ePressed = true;
    } else {
      this._ePressed = false;
    }
    this._ePrevDown = eDown;
    this._eConsumed = false;
    this.checkNPCProximity();
    this.checkBuildingProximity();

    // Panel hotkeys
    if (Phaser.Input.Keyboard.JustDown(this.cKey)) {
      GameAudio.menuOpen();
      this.scene.launch('CraftScene');
      this.scene.pause();
    }
    if (Phaser.Input.Keyboard.JustDown(this.tKey)) {
      this.showTeamLineup();
    }
    if (Phaser.Input.Keyboard.JustDown(this.iKey)) {
      this.showInventory();
    }
    if (Phaser.Input.Keyboard.JustDown(this.pKey)) {
      this.showProfessionPanel();
    }
    if (Phaser.Input.Keyboard.JustDown(this.yKey)) {
      GameAudio.menuOpen();
      this.scene.launch('TalentScene');
      this.scene.pause();
    }
    if (Phaser.Input.Keyboard.JustDown(this.bKey)) {
      this._showBuildMenu();
    }

    // Tick buffs + update HUDs
    if (typeof tickBuffs === 'function') tickBuffs();
    this._updateBuffHUD();
    this._updateActionBar();

    // Valkin event hunt AI
    if (this._valkinEvent && this._valkinEvent.active && typeof updateValkinHunt === 'function') {
      updateValkinHunt(this);
    }

    // Structure proximity interactions
    this._checkStructureProximity();

    // Wave 3: Signpost interactions (E key near signposts)
    this.checkSignpostProximity();

    // Wave 3: Lore tablet collection (walk over)
    this.checkLoreTablets();

    // Wave 3: Region transition banners + exploration XP
    this.checkRegionTransition(region);

    // Switch chat region if needed
    if (this.updateChatRegion) this.updateChatRegion();

    // Dynamic encounter rate — faster spawns inside encounter zones
    const zoneIdx = getCurrentZone(G.x, G.y);
    if (zoneIdx >= 0 && !this._inZone) {
      this._inZone = true;
      if (this._spawnTimer) this._spawnTimer.remove();
      this._spawnTimer = this.time.addEvent({ delay: 2500, callback: this.spawnEnemy, callbackScope: this, loop: true });
    } else if (zoneIdx < 0 && this._inZone) {
      this._inZone = false;
      if (this._spawnTimer) this._spawnTimer.remove();
      this._spawnTimer = this.time.addEvent({ delay: 4000, callback: this.spawnEnemy, callbackScope: this, loop: true });
    }

    // Wave 5: Black Riders — night-only dangerous enemies
    this.updateBlackRiders();

    // Wave 5: World Boss proximity check
    this.checkWorldBossProximity();

    // Wave 5: Help panel hotkey
    if (Phaser.Input.Keyboard.JustDown(this.hKey)) {
      this.showHelpPanel();
    }

    // Wave 5: Daily challenge check
    this.updateDailyChallenge();

    // Cultivator: Spirit pet follower + Nature's Calm heal
    this.updateSpiritPet();
    this.updateNaturesCalmHeal();

    // Wave 6: Tutorial progression checks
    this.updateTutorial(vx, vy);

    this.updateHUD();
    } catch (e) { console.error('[WorldScene] update error:', e); }
  }

  // ═══════ NPCs ═══════

  spawnNPC(name, x, y, spriteKey, tint, hostile = false) {
    const npc = this.physics.add.staticSprite(x, y, spriteKey, 0).setScale(2);
    if (tint) npc.setTint(tint);

    const label = this.add.text(x, y - 40, name, {
      fontSize: '10px', fontFamily: 'monospace', color: hostile ? '#ff8888' : '#88ff88',
      backgroundColor: '#00000088', padding: { x: 3, y: 1 },
    }).setOrigin(0.5).setDepth(11);

    // Exclamation mark for hostile
    let marker = null;
    if (hostile) {
      marker = this.add.text(x, y - 52, '!', {
        fontSize: '16px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: '#ff4444',
      }).setOrigin(0.5).setDepth(11);
      this.tweens.add({ targets: marker, y: y - 58, duration: 800, yoyo: true, repeat: -1 });
    }

    this.npcSprites.push({ sprite: npc, name, label, marker, hostile, x, y });
  }

  checkNPCProximity() {
    if (this._eConsumed) return; // building already handled E this frame
    const ePressed = this._ePressed;

    for (const npc of this.npcSprites) {
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, npc.x, npc.y);

      if (dist < 80) {
        npc.label.setColor(npc.hostile ? '#ffaa44' : '#ffdd44');
        // Show interaction hint
        if (!npc._hint) {
          npc._hint = this.add.text(npc.x, npc.y + 24, '[E]', {
            fontSize: '10px', fontFamily: 'monospace', fontStyle: 'bold', color: '#ffffff',
            backgroundColor: '#000000aa', padding: { x: 3, y: 1 },
          }).setOrigin(0.5).setDepth(12);
        }

        // Fortune hint (show [F] when Fortune Teller apprentice + off cooldown)
        if (typeof canGiveFortune === 'function' && canGiveFortune()) {
          if (!npc._fortuneHint) {
            npc._fortuneHint = this.add.text(npc.x, npc.y + 38, '', {
              fontSize: '9px', fontFamily: 'monospace', fontStyle: 'bold', color: '#44bbff',
              backgroundColor: '#000000aa', padding: { x: 3, y: 1 },
            }).setOrigin(0.5).setDepth(12);
          }
          const ready = isFortuneReady();
          npc._fortuneHint.setText(ready ? '[F] Fortune' : '[F] ' + getFortuneCooldownSec() + 's');
          npc._fortuneHint.setColor(ready ? '#44bbff' : '#666688');

          // F key: give fortune to this NPC
          if (ready && Phaser.Input.Keyboard.JustDown(this.fKey)) {
            const result = giveFortune(npc.name, false); // false = NPC, 1/10th XP
            if (result) {
              // Show fortune result as floating text
              const color = result.type === 'good' ? '#88ff44' : '#ff6666';
              const icon = result.type === 'good' ? '★' : '☆';
              const floatText = this.add.text(npc.x, npc.y - 16, icon + ' ' + result.name + ' ' + icon, {
                fontSize: '12px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: color,
                backgroundColor: '#000000cc', padding: { x: 6, y: 3 },
              }).setOrigin(0.5).setDepth(100);
              this.tweens.add({
                targets: floatText, y: npc.y - 60, alpha: 0, duration: 2000,
                ease: 'Power2', onComplete: () => floatText.destroy(),
              });
              // Show description below
              const descText = this.add.text(npc.x, npc.y, result.desc, {
                fontSize: '9px', fontFamily: 'monospace', color: '#aaaacc',
                backgroundColor: '#000000aa', padding: { x: 4, y: 2 },
              }).setOrigin(0.5).setDepth(100);
              this.tweens.add({
                targets: descText, y: npc.y - 30, alpha: 0, duration: 2500, delay: 500,
                ease: 'Power2', onComplete: () => descText.destroy(),
              });
              GameAudio.collect();
              // Check for talent auto-unlocks
              if (typeof checkFortuneUnlocks === 'function') checkFortuneUnlocks();
            }
          }
        }

        if (ePressed) {
          this._eConsumed = true;
          console.log('[NPC] E pressed near', npc.name, 'comm=', !!this.comm, 'commActive=', this.comm?.isActive);
          if (this.comm && this.comm.isActive) {
            this.comm.dismiss();
          } else if (npc.hostile) {
            this.triggerTrainerBattle(npc);
          } else if (npc.name === 'Crazy Lou' && this.comm) {
            this.showZaraMenu();
          } else if (this.comm) {
            console.log('[NPC] Calling comm.show for', npc.name);
            try {
              this.comm.show(npc.name, this.getNPCDialogue(npc.name), { color: '#88ff88' });
            } catch(e) {
              console.error('[NPC] comm.show FAILED:', e);
              this.showDialogue(npc.name, this.getNPCDialogue(npc.name));
            }
          } else {
            console.log('[NPC] CommOverlay null — using fallback dialogue');
            this.showDialogue(npc.name, this.getNPCDialogue(npc.name));
          }
        }
      } else {
        npc.label.setColor(npc.hostile ? '#ff8888' : '#88ff88');
        if (npc._hint) { npc._hint.destroy(); npc._hint = null; }
        if (npc._fortuneHint) { npc._fortuneHint.destroy(); npc._fortuneHint = null; }
      }
    }
  }

  getNPCDialogue(name) {
    // Use the rich NPC_DIALOGUE_MAP from npcs.js if available
    if (typeof NPC_DIALOGUE_MAP !== 'undefined' && NPC_DIALOGUE_MAP[name] && NPC_DIALOGUE_MAP[name].getLine) {
      return NPC_DIALOGUE_MAP[name].getLine();
    }
    // Fallback for any NPC not in the map
    const lines = {
      'Elder Frost': ['The spirits remember what men forget.', 'Frost Valley was the first land the Spiritkin claimed.'],
      'Smith Ember': ['Iron sings when you heat it right.', 'Bring me ore and I will make you something worth carrying.'],
      'Crazy Lou': ['Every Spiritkin has a story.', 'The battle is won before the dice are rolled.'],
    };
    const pool = lines[name] || ['...'];
    return pool[Math.floor(Math.random() * pool.length)];
  }

  showDialogue(name, text) {
    this.dialogueNameText.setText(name);
    this.dialogueBodyText.setText(text);
    this.dialogueContainer.setVisible(true);
    if (this._dialogueTimer) this._dialogueTimer.remove();
    this._dialogueTimer = this.time.delayedCall(4000, () => this.dialogueContainer.setVisible(false));
  }

  // ═══════ CRAZY LOU — Valkin Raid Trigger ═══════

  showZaraMenu() {
    // Check cooldown (30 seconds for testing, raise later)
    const cooldownMs = 30 * 1000;
    const now = Date.now();
    const onCooldown = G.lastValkinSummon && (now - G.lastValkinSummon < cooldownMs);
    const cooldownLeft = onCooldown ? Math.ceil((cooldownMs - (now - G.lastValkinSummon)) / 1000) : 0;

    if (onCooldown) {
      this.comm.show('Crazy Lou', `The rift is still sealing... ${cooldownLeft}s remain before I can summon again.`, { color: '#c0a040' });
      return;
    }

    // Auto-trigger Valkin — no choice needed
    this.comm.show('Crazy Lou', 'He comes. Prepare yourself.', { color: '#ff8844', duration: 2500 });
    this.time.delayedCall(1500, () => this.triggerZaraValkinRaid());
  }

  triggerZaraValkinRaid() {
    G.lastValkinSummon = Date.now();
    if (typeof saveGame === 'function') saveGame();

    // Lou's warning
    this.comm.show('Crazy Lou', 'He comes. Prepare yourself.', { color: '#ff8844', duration: 2500 });

    // Screen shake + dramatic pause, then spawn
    this.time.delayedCall(1500, () => {
      this.cameras.main.shake(500, 0.008);
      if (typeof GameAudio !== 'undefined') GameAudio.defeat();

      // Spawn Valkin event
      if (typeof spawnValkinEvent === 'function') {
        spawnValkinEvent(this);
      }

      // Also write to Firebase so other players see the boss
      if (typeof db !== 'undefined' && !db._stub && typeof uid !== 'undefined') {
        const bossData = {
          active: true,
          bossId: 432,
          bossName: 'Valkin the Grand',
          bossTitle: 'The Corruptor',
          bossPlayers: '2-3',
          maxHp: 25,
          hp: 25,
          x: 55, y: 30,
          spawnedAt: firebase.database.ServerValue.TIMESTAMP,
          expiresAt: Date.now() + 600000, // 10 minutes
          cycle: -1, // manual summon
          contributors: {},
          summonedBy: G.name || 'Unknown',
        };
        db.ref('overworld/worldboss').set(bossData);
      }
    });
  }

  showNotification(text) {
    const cx = this.scale.width / 2;
    const notif = this.add.text(cx, 60, text, {
      fontSize: '14px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: '#ffffff',
      backgroundColor: '#000000aa', padding: { x: 10, y: 5 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(300);
    this.tweens.add({ targets: notif, alpha: 0, y: 30, duration: 2000, delay: 1500, onComplete: () => notif.destroy() });
  }

  // ═══════ WAVE 3: BUILDING INTERACTIONS ═══════

  checkBuildingProximity() {
    if (!this._ePressed) return;
    // Don't interact if a panel, comm overlay, or dialogue is active
    if (this.panels.isOpen()) return;
    if (this.comm && this.comm.isActive) return;

    const px = this.player.x;
    const py = this.player.y;
    const T = this._tileSize;
    const INTERACT_DIST = 60; // pixels

    for (const bld of this._interactBuildings) {
      const bx = bld.x * T + T / 2;
      const by = bld.y * T + T / 2;
      const dist = Phaser.Math.Distance.Between(px, py, bx, by);
      if (dist > INTERACT_DIST) continue;

      this._eConsumed = true;
      if (bld.action === 'tradingPost') {
        // Trading post is open-air — use panel directly
        this.openTradingPost();
      } else {
        // Enter building interior
        if (typeof GameAudio !== 'undefined') GameAudio.menuOpen();
        this.cameras.main.fadeOut(300);
        this.time.delayedCall(300, () => {
          this.scene.launch('BuildingScene', {
            building: bld.action,
            returnX: this.player.x,
            returnY: this.player.y,
          });
          this.scene.pause();
        });
      }
      return;
    }
  }

  showBuildingPanel(title, message) {
    this.panels.open(title, (container, w, h) => {
      const text = this.add.text(w / 2, h / 2 - 20, message, {
        fontSize: '14px', fontFamily: 'Georgia, serif', color: '#aaaacc',
        wordWrap: { width: w - 40 }, align: 'center',
      }).setOrigin(0.5).setScrollFactor(0);
      container.add(text);
    }, { width: 360, height: 160 });
  }

  interactInn() {
    const cost = 5;
    if (G.coins < cost) {
      this.showNotification('Not enough gold! Inn costs 5 gold.');
      return;
    }
    // Check if any team member is hurt
    const anyHurt = G.team.some(g => g.hp < g.maxHp || g.ko);
    if (!anyHurt) {
      this.showNotification('Your team is already at full health!');
      return;
    }
    G.coins -= cost;
    for (const ghost of G.team) {
      ghost.hp = ghost.maxHp;
      ghost.ko = false;
    }
    saveGame();
    this.showNotification('Team fully healed at the Inn! (-5 gold)');
  }

  interactCantina() {
    const tips = [
      'Bartender says: "The elder knows which zones are running hot. Ask him."',
      '"Heard a traveler found a lore tablet near the frozen lake. Golden, glowing thing."',
      '"The Workshop crafts the best gear. Bring essences from encounter zones."',
      '"Some say the Dark Castle holds ancient Spiritkin sealed away for centuries."',
      '"If your team is hurt, the Inn can fix them up — just 5 gold."',
      '"Encounter zones cycle quality every 12 hours. Patience pays off."',
      '"The Rolling Hills are peaceful, but don\'t let that fool you — the Spiritkin there are crafty."',
      '"Captain Flint at the Volcanic settlement used to be a pirate. Don\'t tell him I said that."',
      '"Spirit Wisps carry resources. Collect them before they vanish!"',
      '"They say a master crafter can forge legendary weapons. Get your mastery up."',
    ];
    const tip = tips[Math.floor(Math.random() * tips.length)];
    if (this.comm) {
      this.comm.show('The Frozen Mug', tip, { color: '#cc9944' });
    } else {
      this.showDialogue('The Frozen Mug', tip);
    }
  }

  // ═══════ WAVE 3: SIGNPOST INTERACTIONS ═══════

  checkSignpostProximity() {
    if (this._eConsumed || !this._ePressed) return;
    if (this.panels.isOpen()) return;
    if (this.comm && this.comm.isActive) return;

    const px = this.player.x;
    const py = this.player.y;
    const T = this._tileSize;
    const INTERACT_DIST = 50;

    for (const sp of this._signposts) {
      const sx = sp.x * T + T / 2;
      const sy = sp.y * T + T / 2;
      const dist = Phaser.Math.Distance.Between(px, py, sx, sy);
      if (dist > INTERACT_DIST) continue;

      if (this.comm) {
        this.comm.show('Signpost', sp.text, { color: '#ccbb88' });
      } else {
        this.showNotification(sp.text);
      }
      return;
    }
  }

  // ═══════ WAVE 3: LORE TABLETS ═══════

  checkLoreTablets() {
    const px = this.player.x;
    const py = this.player.y;
    const T = this._tileSize;
    const COLLECT_DIST = 30;

    for (let i = this._loreTabletSprites.length - 1; i >= 0; i--) {
      const lt = this._loreTabletSprites[i];
      const lx = lt.x * T + T / 2;
      const ly = lt.y * T + T / 2;
      const dist = Phaser.Math.Distance.Between(px, py, lx, ly);
      if (dist > COLLECT_DIST) continue;

      // Collect this lore tablet
      if (!G.loreCollected.includes(lt.id)) {
        G.loreCollected.push(lt.id);
        saveGame();
      }

      // Remove visuals
      if (lt.glow) lt.glow.destroy();
      if (lt.outerGlow) lt.outerGlow.destroy();
      this._loreTabletSprites.splice(i, 1);

      // Show lore text in a panel
      this.panels.open('LORE DISCOVERED', (container, w, h) => {
        const title = this.add.text(w / 2, 16, `Lore Tablet (${G.loreCollected.length}/4)`, {
          fontSize: '13px', fontFamily: 'monospace', fontStyle: 'bold', color: '#ffcc44',
        }).setOrigin(0.5).setScrollFactor(0);
        const body = this.add.text(w / 2, h / 2, lt.text, {
          fontSize: '13px', fontFamily: 'Georgia, serif', color: '#ccccee',
          wordWrap: { width: w - 40 }, align: 'center', lineSpacing: 4,
        }).setOrigin(0.5).setScrollFactor(0);
        container.add([title, body]);
      }, { width: 420, height: 220 });

      this.showNotification('Lore tablet discovered!');
      return; // one at a time
    }
  }

  // ═══════ WAVE 3: REGION TRANSITION BANNERS ═══════

  checkRegionTransition(currentRegion) {
    if (currentRegion === this._lastRegion) return;
    const isFirstSet = this._lastRegion === undefined;
    this._lastRegion = currentRegion;

    // Wave 4: track visited regions for Explorer title
    if (!G.regionsVisited) G.regionsVisited = [];
    if (!G.regionsVisited.includes(currentRegion)) {
      G.regionsVisited.push(currentRegion);
      saveGame();
      checkAndNotifyTitles();
    }

    // Award exploration XP on region change (skip the initial set on scene load)
    if (!isFirstSet && typeof addProfessionXP === 'function') {
      addProfessionXP('exploration', 5);
    }

    const regionDisplay = {
      frost_valley: { name: 'Frost Valley', color: '#88bbff' },
      rolling_hills: { name: 'Rolling Hills', color: '#88cc44' },
      volcanic_isles: { name: 'Volcanic Isles', color: '#ff8844' },
      dark_castle: { name: 'Dark Castle', color: '#aa66cc' },
    };
    const info = regionDisplay[currentRegion];
    if (!info) return;
    if (!isFirstSet) GameAudio.levelUp();

    // Trigger Valkin event when entering Dark Castle (once per session)
    if (currentRegion === 'dark_castle' && !isFirstSet && !this._valkinEvent && typeof spawnValkinEvent === 'function') {
      this.time.delayedCall(3000, () => spawnValkinEvent(this));
    }

    // Large banner text — fade in, hold, fade out
    const banner = this.add.text(640, 200, `Entering ${info.name}`, {
      fontSize: '28px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: info.color,
      backgroundColor: '#000000aa', padding: { x: 24, y: 12 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(400).setAlpha(0);

    // Subtitle with region flavor
    const flavors = {
      frost_valley: 'Land of ice and ancient spirits',
      rolling_hills: 'Where green hills meet the sky',
      volcanic_isles: 'Fire and paradise intertwined',
      dark_castle: 'Shadows hold secrets',
    };
    const subtitle = this.add.text(640, 240, flavors[currentRegion] || '', {
      fontSize: '14px', fontFamily: 'Georgia, serif', fontStyle: 'italic', color: '#999999',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(400).setAlpha(0);

    // Fade in
    this.tweens.add({
      targets: [banner, subtitle], alpha: 1, duration: 600,
      onComplete: () => {
        // Hold then fade out
        this.tweens.add({
          targets: [banner, subtitle], alpha: 0, y: '-=20', duration: 1200, delay: 2000,
          onComplete: () => { banner.destroy(); subtitle.destroy(); }
        });
      }
    });
  }

  // ═══════ Enemies ═══════

  spawnEnemy() {
    if (!this.enemies || this.enemies.getLength() >= 12) return;
    const px = this.player ? this.player.x : 800;
    const py = this.player ? this.player.y : 800;
    const angle = Math.random() * Math.PI * 2;
    const dist = Phaser.Math.Between(250, 500);
    const ex = px + Math.cos(angle) * dist;
    const ey = py + Math.sin(angle) * dist;

    const wildCard = ALL_CARDS[Math.floor(Math.random() * ALL_CARDS.length)];
    const creatureKeys = ['creature_bear','creature_dragon','creature_axolot','creature_axolotblue','creature_butterfly','creature_butterflyblue','creature_bluebat','creature_slime','creature_mushroom','creature_bamboo'];
    const creatureKey = creatureKeys[Math.floor(Math.random() * creatureKeys.length)];
    const enemy = this.enemies.create(ex, ey, creatureKey, 0).setScale(1.8);
    enemy.cardData = wildCard;
    enemy.setDepth(9);
    enemy.setTint(wildCard.rarity === 'rare' ? 0xaa55ff : wildCard.rarity === 'uncommon' ? 0x5599ff : 0xffffff);

    enemy.label = this.add.text(ex, ey - 28, wildCard.name, {
      fontSize: '9px', fontFamily: 'monospace', color: '#ffaaaa',
      backgroundColor: '#00000088', padding: { x: 2, y: 1 },
    }).setOrigin(0.5).setDepth(11);

    // Wander with directional walk animations
    const prefix = creatureKey + '_';
    enemy._lastX = ex;
    enemy._lastY = ey;
    enemy._animPrefix = prefix;
    // Start with a random walk anim
    if (this.anims.exists(prefix + 'walk_down')) enemy.play(prefix + 'walk_down');

    this.tweens.add({
      targets: enemy, x: ex + Phaser.Math.Between(-60, 60), y: ey + Phaser.Math.Between(-60, 60),
      duration: Phaser.Math.Between(2000, 4000), yoyo: true, repeat: -1,
      onUpdate: () => {
        if (!enemy.active) return;
        if (enemy.label) enemy.label.setPosition(enemy.x, enemy.y - 28);
        // Update walk direction
        const dx = enemy.x - (enemy._lastX || enemy.x);
        const dy = enemy.y - (enemy._lastY || enemy.y);
        const p = enemy._animPrefix;
        if (Math.abs(dx) > Math.abs(dy)) {
          const key = dx > 0 ? p + 'walk_right' : p + 'walk_left';
          if (enemy.anims.currentAnim?.key !== key && this.anims.exists(key)) enemy.play(key, true);
        } else if (Math.abs(dy) > 0.1) {
          const key = dy > 0 ? p + 'walk_down' : p + 'walk_up';
          if (enemy.anims.currentAnim?.key !== key && this.anims.exists(key)) enemy.play(key, true);
        }
        enemy._lastX = enemy.x;
        enemy._lastY = enemy.y;
      }
    });
  }

  onEnemyContact(player, enemy) {
    if (G.inBattle || G.team.length === 0) return;
    // Grace period: no battles for 2 seconds after scene load
    if (this._spawnGrace) return;
    const cardData = enemy.cardData;
    const isBlackRider = !!enemy._isBlackRider;

    // Clean up Black Rider tracking if applicable
    if (isBlackRider) {
      const riderIdx = this._blackRiders.findIndex(r => r.sprite === enemy);
      if (riderIdx >= 0) {
        if (this._blackRiders[riderIdx].label) this._blackRiders[riderIdx].label.destroy();
        this._blackRiders.splice(riderIdx, 1);
      }
    }

    if (enemy.label) enemy.label.destroy();
    enemy.destroy();

    // Set up battle using real engine
    G.inBattle = true;
    const playerGhosts = buildPlayerBattleTeam();

    // Dark Riders have unique teams; wild encounters are single ghost
    let enemyIds;
    let battleName;
    if (isBlackRider && enemy._riderTeam) {
      enemyIds = enemy._riderTeam;
      battleName = enemy._riderName;
    } else {
      const scaledMaxHp = Math.round(cardData.maxHp * (1 + (G.level - 1) * 0.15));
      enemyIds = [cardData.id];
      battleName = null;
    }

    const playerIds = playerGhosts.map(g => g.id);
    if (typeof initBattle === 'function') {
      initBattle(playerIds, enemyIds, { type: isBlackRider ? 'blackrider' : 'wild' });
    }

    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.time.delayedCall(300, () => {
      this.scene.launch('BattleScene', {
        enemyCard: cardData,
        blackRider: isBlackRider,
        trainerName: isBlackRider ? battleName : undefined,
      });
      this.scene.pause();
    });
  }

  triggerTrainerBattle(npc) {
    if (G.inBattle || G.team.length === 0) return;
    const trainerData = HOSTILE_NPCS.find(h => h.name === npc.name);
    if (!trainerData) return;
    if (isHostileNPCDefeatedToday(trainerData.id)) {
      this.showDialogue(npc.name, trainerData.dialogue?.[0] || 'Come back tomorrow.');
      return;
    }

    // Show challenge dialogue then battle
    if (this.comm) this.comm.show(npc.name, trainerData.challenge, { color: '#ff6644' });
    this.time.delayedCall(2500, () => {
      // Set up battle state directly (DON'T call triggerHostileNPCBattle — it uses DOM)
      G.inBattle = true;
      const playerGhosts = buildPlayerBattleTeam();
      const trainerTeamSize = { frost_valley: 1, rolling_hills: 2, volcanic_isles: 2, dark_castle: 3 }[getCurrentRegion(G.x, G.y)] || 3;
      const trainerCardIds = trainerData.team.slice(0, trainerTeamSize);
      const enemyGhosts = trainerCardIds.map(id => {
        const card = getCard(id);
        if (!card) return null;
        return { id: card.id, name: card.name, hp: card.maxHp, maxHp: card.maxHp, ko: false,
          ability: card.ability, abilityDesc: card.desc, rarity: card.rarity,
          usedOncePerGame: false, entryFired: false };
      }).filter(Boolean);

      if (enemyGhosts.length === 0) { G.inBattle = false; return; }

      // Use new battle engine factory
      const playerIds = playerGhosts.map(g => g.id);
      const enemyIds = enemyGhosts.map(g => g.id);
      if (typeof initBattle === 'function') {
        initBattle(playerIds, enemyIds, { type: 'trainer', isHostileNPC: trainerData.id });
      }

      this.cameras.main.fadeOut(300);
      this.time.delayedCall(300, () => {
        this.scene.launch('BattleScene', { enemyCard: getCard(trainerData.team[0]), trainerName: npc.name });
        this.scene.pause();
      });
    });
  }

  // ═══════ TEAM LINEUP ═══════

  showTeamLineup() {
    if (this.panels.isOpen()) { this.panels.close(); return; }
    GameAudio.menuOpen();

    const hasEssences = (G.essences?.length || 0) > 0;

    this.panels.open('TEAM LINEUP — Click to set active', (container, w, h) => {
      if (G.team.length === 0) {
        const empty = this.add.text(w / 2, 40, 'No Spiritkin!', {
          fontSize: '16px', fontFamily: 'Georgia, serif', color: '#ff6644',
        }).setOrigin(0.5).setScrollFactor(0);
        container.add(empty);
        return;
      }

      // Essence count header
      if (hasEssences) {
        const essLabel = this.add.text(w - 14, 0, `Essences: ${G.essences.length}`, {
          fontSize: '10px', fontFamily: 'monospace', color: '#aa88dd',
        }).setOrigin(1, 0).setScrollFactor(0);
        container.add(essLabel);
      }

      G.team.forEach((ghost, i) => {
        const y = 12 + i * 56;
        const isActive = i === G.activeIdx;
        const isDamaged = !ghost.ko && ghost.hp > 0 && ghost.hp < ghost.maxHp;

        // Clickable row
        const rowBg = this.add.rectangle(w / 2, y + 20, w - 20, 48, isActive ? 0x224422 : 0x222244, 0.6)
          .setStrokeStyle(1, isActive ? 0x44aa44 : 0x334466)
          .setInteractive({ useHandCursor: true }).setScrollFactor(0);
        rowBg.on('pointerover', () => rowBg.setFillStyle(isActive ? 0x336633 : 0x333366));
        rowBg.on('pointerout', () => rowBg.setFillStyle(isActive ? 0x224422 : 0x222244, 0.6));
        rowBg.on('pointerdown', () => {
          if (!ghost.ko && ghost.hp > 0) {
            G.activeIdx = i;
            this.panels.close();
            this.showNotification(`${ghost.name} is now active!`);
            saveGame();
          } else {
            this.showNotification(`${ghost.name} is KO'd!`);
          }
        });

        const indicator = isActive ? '\u25b6 ' : '  ';
        const nameColor = isActive ? '#88ff88' : ghost.ko ? '#ff4444' : '#cccccc';
        const nameText = this.add.text(14, y + 8, `${indicator}${ghost.name}`, {
          fontSize: '14px', fontFamily: 'monospace', fontStyle: isActive ? 'bold' : 'normal', color: nameColor,
        }).setScrollFactor(0);

        // FEED button — only show if ghost is damaged and player has essences
        const feedBtnX = w - 80;
        if (isDamaged && hasEssences) {
          const feedBtn = this.add.text(feedBtnX, y + 8, '[FEED]', {
            fontSize: '10px', fontFamily: 'monospace', fontStyle: 'bold', color: '#44cc88',
            backgroundColor: '#113322', padding: { x: 4, y: 2 },
          }).setInteractive({ useHandCursor: true }).setScrollFactor(0);
          feedBtn.on('pointerover', () => feedBtn.setColor('#88ffbb'));
          feedBtn.on('pointerout', () => feedBtn.setColor('#44cc88'));
          feedBtn.on('pointerdown', () => {
            if ((G.essences?.length || 0) === 0) {
              this.showNotification('No essences to feed!');
              return;
            }
            // Consume 1 essence and heal 3 HP
            const consumed = G.essences.pop();
            const healAmt = Math.min(3, ghost.maxHp - ghost.hp);
            ghost.hp += healAmt;
            saveGame();
            this.showNotification(`Fed ${consumed.fromName || consumed.name || 'essence'} to ${ghost.name}! +${healAmt} HP`);
            // Refresh panel
            this.panels.close();
            this.showTeamLineup();
          });
          container.add(feedBtn);
        }

        const hpText = this.add.text(isDamaged && hasEssences ? feedBtnX - 6 : w - 14, y + 8, `HP ${ghost.hp}/${ghost.maxHp}`, {
          fontSize: '12px', fontFamily: 'monospace', color: ghost.hp <= 0 ? '#ff4444' : isDamaged ? '#ffaa44' : '#aaaaaa',
        }).setOrigin(1, 0).setScrollFactor(0);

        const abilityText = this.add.text(14, y + 28, `  ${ghost.ability || ''}`, {
          fontSize: '11px', fontFamily: 'monospace', fontStyle: 'italic', color: '#888888',
        }).setScrollFactor(0);

        container.add([rowBg, nameText, hpText, abilityText]);
      });
    }, { width: 360, height: Math.min(G.team.length * 56 + 50, 420) });
  }

  // ═══════ INVENTORY PANEL ═══════

  showInventory() {
    if (this.panels.isOpen()) { this.panels.close(); return; }
    GameAudio.menuOpen();
    this._invTab = this._invTab || 'essences';

    this.panels.open('INVENTORY', (container, w, h) => {
      this._buildInventoryContent(container, w, h);
    }, { width: 480, height: 380 });
  }

  _buildInventoryContent(container, w, h) {
    const tabs = ['essences', 'gear', 'materials'];
    const tabW = w / tabs.length;

    // Tab bar
    tabs.forEach((tab, i) => {
      const isActive = tab === this._invTab;
      const tabBg = this.add.rectangle(tabW * i + tabW / 2, 14, tabW - 4, 24, isActive ? 0x445588 : 0x222233)
        .setStrokeStyle(1, isActive ? 0x6688cc : 0x333344)
        .setInteractive({ useHandCursor: true }).setScrollFactor(0);
      const tabText = this.add.text(tabW * i + tabW / 2, 14, tab.toUpperCase(), {
        fontSize: '11px', fontFamily: 'monospace', fontStyle: 'bold', color: isActive ? '#ffffff' : '#888888',
      }).setOrigin(0.5).setScrollFactor(0);
      tabBg.on('pointerdown', () => {
        this._invTab = tab;
        this.panels.close();
        this.showInventory();
      });
      container.add([tabBg, tabText]);
    });

    const cy = 36;

    if (this._invTab === 'essences') {
      const essences = G.essences || [];
      if (essences.length === 0) {
        container.add(this.add.text(w / 2, cy + 30, 'No essences yet.\nDefeat spirits to collect!', {
          fontSize: '13px', fontFamily: 'Georgia, serif', color: '#666', align: 'center',
        }).setOrigin(0.5, 0).setScrollFactor(0));
      } else {
        const shown = essences.slice(-8);
        shown.forEach((ess, i) => {
          const y = cy + 6 + i * 36;
          const rColors = { common: '#aaa', uncommon: '#5599ff', rare: '#aa55ff', 'ghost-rare': '#ff55aa', legendary: '#ffaa22' };
          container.add(this.add.text(14, y, ess.fromName || ess.name, {
            fontSize: '13px', fontFamily: 'monospace', color: rColors[ess.rarity] || '#ccc',
          }).setScrollFactor(0));
          container.add(this.add.text(w - 14, y, `P:${ess.potency} S:${ess.stability} R:${ess.resonance}`, {
            fontSize: '10px', fontFamily: 'monospace', color: '#888',
          }).setOrigin(1, 0).setScrollFactor(0));
          container.add(this.add.text(14, y + 16, `${ess.region || 'Unknown'} — ${ess.subtype || 'Essence'}`, {
            fontSize: '10px', fontFamily: 'monospace', fontStyle: 'italic', color: '#555',
          }).setScrollFactor(0));
        });
        if (essences.length > 8) {
          container.add(this.add.text(w / 2, cy + 8 * 36 + 8, `...and ${essences.length - 8} more`, {
            fontSize: '11px', fontFamily: 'monospace', color: '#555',
          }).setOrigin(0.5, 0).setScrollFactor(0));
        }
      }

    } else if (this._invTab === 'gear') {
      const equipped = G.equipped || {};
      let y = cy + 6;

      // Equipped section
      container.add(this.add.text(14, y, 'EQUIPPED:', {
        fontSize: '12px', fontFamily: 'monospace', fontStyle: 'bold', color: '#ffdd44',
      }).setScrollFactor(0));
      y += 20;

      for (const [slot, item] of Object.entries(equipped)) {
        const slotLabel = slot.charAt(0).toUpperCase() + slot.slice(1);
        const itemName = item ? item.name : '(empty)';
        container.add(this.add.text(14, y, `${slotLabel}:`, {
          fontSize: '12px', fontFamily: 'monospace', color: '#aaa',
        }).setScrollFactor(0));
        container.add(this.add.text(100, y, itemName, {
          fontSize: '12px', fontFamily: 'monospace', color: item ? '#88ff88' : '#555',
        }).setScrollFactor(0));

        if (item) {
          const unBtn = this.add.text(w - 14, y, '[UNEQUIP]', {
            fontSize: '10px', fontFamily: 'monospace', color: '#cc6644',
          }).setOrigin(1, 0).setInteractive({ useHandCursor: true }).setScrollFactor(0);
          unBtn.on('pointerdown', () => {
            G.gear.push(item);
            G.equipped[slot] = null;
            saveGame();
            this.panels.close();
            this.showInventory();
          });
          container.add(unBtn);
        }
        y += 20;
      }

      // Gear inventory
      y += 10;
      container.add(this.add.text(14, y, 'INVENTORY:', {
        fontSize: '12px', fontFamily: 'monospace', fontStyle: 'bold', color: '#ffdd44',
      }).setScrollFactor(0));
      y += 20;

      const gear = G.gear || [];
      if (gear.length === 0) {
        container.add(this.add.text(14, y, 'No gear. Craft some at the Workshop!', {
          fontSize: '12px', fontFamily: 'Georgia, serif', color: '#666',
        }).setScrollFactor(0));
      } else {
        gear.slice(0, 6).forEach((item, i) => {
          const iy = y + i * 28;
          container.add(this.add.text(14, iy, item.name, {
            fontSize: '12px', fontFamily: 'monospace', color: '#ccc',
          }).setScrollFactor(0));
          const slot = item.slot || 'accessory';
          const eqBtn = this.add.text(w - 14, iy, `[EQUIP \u2192 ${slot}]`, {
            fontSize: '10px', fontFamily: 'monospace', color: '#44aa44',
          }).setOrigin(1, 0).setInteractive({ useHandCursor: true }).setScrollFactor(0);
          eqBtn.on('pointerdown', () => {
            if (G.equipped[slot]) G.gear.push(G.equipped[slot]);
            G.equipped[slot] = item;
            G.gear.splice(G.gear.indexOf(item), 1);
            saveGame();
            this.panels.close();
            this.showInventory();
          });
          container.add(eqBtn);
        });
      }

    } else if (this._invTab === 'materials') {
      let y = cy + 6;
      const mats = {
        'Ice Shards': G.iceShards || 0,
        'Sacred Fire': G.sacredFire || 0,
        'Surge': G.surge || 0,
        'Moonstone': G.moonstone || 0,
      };
      if (G.materials) {
        for (const [k, v] of Object.entries(G.materials)) {
          if (v > 0) mats[k] = v;
        }
      }
      for (const [name, count] of Object.entries(mats)) {
        container.add(this.add.text(14, y, `${name}: ${count}`, {
          fontSize: '13px', fontFamily: 'monospace', color: count > 0 ? '#88ccff' : '#555',
        }).setScrollFactor(0));
        y += 22;
      }
    }
  }

  // ═══════ PROFESSION PANEL ═══════

  showProfessionPanel() {
    if (this.panels.isOpen()) { this.panels.close(); return; }
    GameAudio.menuOpen();

    this.panels.open('PROFESSIONS', (container, w, h) => {
      const categories = [
        { key: 'combat',      label: 'Combat',      icon: '\u2694\uFE0F', color: '#ff6644' },
        { key: 'exploration', label: 'Exploration',  icon: '\uD83E\uDDED', color: '#44bbff' },
        { key: 'crafting',    label: 'Crafting',     icon: '\uD83D\uDD28', color: '#ffaa22' },
        { key: 'trade',       label: 'Trade',        icon: '\uD83D\uDCB0', color: '#44dd44' },
        { key: 'charisma',    label: 'Charisma',     icon: '\uD83C\uDF89', color: '#cc88ff' },
      ];

      // Discipline badge
      let y = 6;
      if (G.discipline && typeof PLAYER_DISCIPLINES !== 'undefined' && PLAYER_DISCIPLINES[G.discipline]) {
        const disc = PLAYER_DISCIPLINES[G.discipline];
        container.add(this.add.text(w / 2, y, disc.icon + ' ' + disc.name + ' Discipline', {
          fontSize: '14px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: disc.color,
        }).setOrigin(0.5, 0).setScrollFactor(0));
        y += 18;
        container.add(this.add.text(w / 2, y, disc.desc, {
          fontSize: '10px', fontFamily: 'monospace', fontStyle: 'italic', color: '#888899',
        }).setOrigin(0.5, 0).setScrollFactor(0));
        y += 20;
      }

      // Divider
      container.add(this.add.rectangle(w / 2, y, w - 20, 1, 0x334466).setScrollFactor(0));
      y += 8;

      // Skill points summary
      var totalMilestones = Object.values(G.professionXP || {}).reduce(function(sum, xp) { return sum + Math.floor(xp / 100); }, 0);
      var available = Math.max(0, totalMilestones - (G.skillPointsUsed || 0));
      var capVal = (typeof SKILL_POINT_CAP !== 'undefined') ? SKILL_POINT_CAP : 80;
      container.add(this.add.text(w / 2, y, 'Skill Points: ' + available + ' available (' + (G.skillPointsUsed || 0) + ' / ' + capVal + ' used)', {
        fontSize: '11px', fontFamily: 'monospace', color: available > 0 ? '#88ff88' : '#888888',
      }).setOrigin(0.5, 0).setScrollFactor(0));
      y += 22;

      // Category rows
      for (var ci = 0; ci < categories.length; ci++) {
        var cat = categories[ci];
        var xp = (G.professionXP && G.professionXP[cat.key]) || 0;
        var mastery = (typeof getProfessionMasteryInfo === 'function') ? getProfessionMasteryInfo(xp) : { name: 'Novice', min: 0 };

        // Row background
        var rowBg = this.add.rectangle(w / 2, y + 24, w - 16, 52, 0x111122, 0.6)
          .setStrokeStyle(1, 0x334466).setScrollFactor(0);
        container.add(rowBg);

        // Icon + label
        container.add(this.add.text(14, y + 8, cat.icon + ' ' + cat.label, {
          fontSize: '14px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: cat.color,
        }).setScrollFactor(0));

        // XP value
        container.add(this.add.text(w - 14, y + 8, xp + ' XP', {
          fontSize: '12px', fontFamily: 'monospace', color: '#aaaacc',
        }).setOrigin(1, 0).setScrollFactor(0));

        // Mastery rank
        var rankColors = { Novice: '#666', Apprentice: '#88aacc', Journeyman: '#aaccee', Expert: '#ffcc44', Master: '#ff8844', 'Grand Master': '#ff44ff' };
        container.add(this.add.text(14, y + 28, 'Rank: ' + mastery.name, {
          fontSize: '11px', fontFamily: 'monospace', color: rankColors[mastery.name] || '#888',
        }).setScrollFactor(0));

        // XP progress bar
        var nextLevel = null;
        if (typeof PROFESSION_MASTERY_LEVELS !== 'undefined') {
          for (var li = 0; li < PROFESSION_MASTERY_LEVELS.length; li++) {
            if (PROFESSION_MASTERY_LEVELS[li].min > xp) { nextLevel = PROFESSION_MASTERY_LEVELS[li]; break; }
          }
        }
        var barW = 160, barH = 8;
        var barX = w - 14 - barW;
        var barY = y + 32;
        container.add(this.add.rectangle(barX + barW / 2, barY + barH / 2, barW, barH, 0x222233).setScrollFactor(0));
        if (nextLevel) {
          var prevMin = mastery.min;
          var progress = Math.min(1, (xp - prevMin) / (nextLevel.min - prevMin));
          if (progress > 0) {
            var fillColor = parseInt(cat.color.replace('#', ''), 16);
            container.add(this.add.rectangle(barX + (barW * progress) / 2, barY + barH / 2, barW * progress, barH - 2, fillColor, 0.7).setOrigin(0.5, 0.5).setScrollFactor(0));
          }
        } else {
          // Max rank
          var fillColorMax = parseInt(cat.color.replace('#', ''), 16);
          container.add(this.add.rectangle(barX + barW / 2, barY + barH / 2, barW, barH - 2, fillColorMax, 0.7).setScrollFactor(0));
        }

        y += 58;
      }
    }, { width: 420, height: 400 });
  }

  // ═══════ WAVE 4: TRADING POST ═══════

  openTradingPost() {
    if (this.panels.isOpen()) { this.panels.close(); return; }
    this._marketTab = this._marketTab || 'buy';

    this.panels.open('TRADING POST', (container, w, h) => {
      this._buildMarketContent(container, w, h);
    }, { width: 420, height: 380 });
  }

  _buildMarketContent(container, w, h) {
    const tabs = ['buy', 'sell'];
    const tabW = w / tabs.length;

    // Gold display
    const goldText = this.add.text(w / 2, 2, `Gold: ${G.coins}`, {
      fontSize: '13px', fontFamily: 'monospace', fontStyle: 'bold', color: '#ffdd44',
    }).setOrigin(0.5, 0).setScrollFactor(0);
    container.add(goldText);

    // Tab bar
    tabs.forEach((tab, i) => {
      const isActive = tab === this._marketTab;
      const tabBg = this.add.rectangle(tabW * i + tabW / 2, 26, tabW - 4, 24, isActive ? 0x445566 : 0x222233)
        .setStrokeStyle(1, isActive ? 0x6699aa : 0x333344)
        .setInteractive({ useHandCursor: true }).setScrollFactor(0);
      const tabText = this.add.text(tabW * i + tabW / 2, 26, tab.toUpperCase(), {
        fontSize: '11px', fontFamily: 'monospace', fontStyle: 'bold', color: isActive ? '#ffffff' : '#888888',
      }).setOrigin(0.5).setScrollFactor(0);
      tabBg.on('pointerdown', () => {
        this._marketTab = tab;
        this.panels.close();
        this.openTradingPost();
      });
      container.add([tabBg, tabText]);
    });

    const cy = 46;

    if (this._marketTab === 'buy') {
      const shopItems = [
        { name: 'Healing Potion', desc: 'Heals entire team to full HP', price: 10, icon: '\u2764\uFE0F' },
        { name: 'Essence Detector', desc: 'Shows essence quality for 5 battles', price: 25, icon: '\uD83D\uDD2E' },
        { name: 'Lucky Charm', desc: '+10% recruit chance next battle', price: 15, icon: '\uD83C\uDF40' },
        { name: 'Escape Rope', desc: 'Guaranteed flee from next battle', price: 5, icon: '\uD83E\uDEA2' },
        { name: 'Spirit Snack', desc: '+2 HP to active ghost', price: 8, icon: '\uD83C\uDF6A' },
      ];

      shopItems.forEach((item, i) => {
        const y = cy + i * 54;
        const canAfford = G.coins >= item.price;

        // Row background
        const rowBg = this.add.rectangle(w / 2, y + 20, w - 16, 46, 0x111122, 0.6)
          .setStrokeStyle(1, canAfford ? 0x336644 : 0x333344).setScrollFactor(0);
        container.add(rowBg);

        // Item name + icon
        container.add(this.add.text(14, y + 6, `${item.icon} ${item.name}`, {
          fontSize: '13px', fontFamily: 'monospace', fontStyle: 'bold', color: canAfford ? '#ccddcc' : '#666666',
        }).setScrollFactor(0));

        // Description
        container.add(this.add.text(14, y + 24, item.desc, {
          fontSize: '10px', fontFamily: 'monospace', fontStyle: 'italic', color: '#888888',
        }).setScrollFactor(0));

        // Price + Buy button
        const priceColor = canAfford ? '#ffdd44' : '#ff4444';
        container.add(this.add.text(w - 80, y + 6, `${item.price}g`, {
          fontSize: '12px', fontFamily: 'monospace', fontStyle: 'bold', color: priceColor,
        }).setOrigin(1, 0).setScrollFactor(0));

        if (canAfford) {
          const buyBtn = this.add.text(w - 14, y + 14, '[BUY]', {
            fontSize: '11px', fontFamily: 'monospace', fontStyle: 'bold', color: '#44cc44',
            backgroundColor: '#112211', padding: { x: 4, y: 2 },
          }).setOrigin(1, 0).setInteractive({ useHandCursor: true }).setScrollFactor(0);
          buyBtn.on('pointerover', () => buyBtn.setColor('#88ff88'));
          buyBtn.on('pointerout', () => buyBtn.setColor('#44cc44'));
          buyBtn.on('pointerdown', () => {
            this._buyShopItem(item);
          });
          container.add(buyBtn);
        }
      });

    } else if (this._marketTab === 'sell') {
      const gear = G.gear || [];
      if (gear.length === 0) {
        container.add(this.add.text(w / 2, cy + 30, 'No gear to sell.\nCraft items at the Workshop!', {
          fontSize: '13px', fontFamily: 'Georgia, serif', color: '#666666', align: 'center',
        }).setOrigin(0.5, 0).setScrollFactor(0));
        return;
      }

      gear.slice(0, 6).forEach((item, i) => {
        const y = cy + i * 42;
        const sellPrice = Math.max(5, Math.floor((item.quality || 20) / 4));

        const rowBg = this.add.rectangle(w / 2, y + 16, w - 16, 36, 0x111122, 0.6)
          .setStrokeStyle(1, 0x334455).setScrollFactor(0);
        container.add(rowBg);

        container.add(this.add.text(14, y + 6, item.name, {
          fontSize: '13px', fontFamily: 'monospace', color: '#cccccc',
        }).setScrollFactor(0));

        container.add(this.add.text(14, y + 22, `Q:${item.quality || '?'} | ${item.slot || 'gear'}`, {
          fontSize: '10px', fontFamily: 'monospace', fontStyle: 'italic', color: '#666666',
        }).setScrollFactor(0));

        container.add(this.add.text(w - 80, y + 8, `${sellPrice}g`, {
          fontSize: '12px', fontFamily: 'monospace', fontStyle: 'bold', color: '#ffdd44',
        }).setOrigin(1, 0).setScrollFactor(0));

        const sellBtn = this.add.text(w - 14, y + 10, '[SELL]', {
          fontSize: '11px', fontFamily: 'monospace', fontStyle: 'bold', color: '#cc8844',
          backgroundColor: '#221111', padding: { x: 4, y: 2 },
        }).setOrigin(1, 0).setInteractive({ useHandCursor: true }).setScrollFactor(0);
        sellBtn.on('pointerover', () => sellBtn.setColor('#ffaa66'));
        sellBtn.on('pointerout', () => sellBtn.setColor('#cc8844'));
        sellBtn.on('pointerdown', () => {
          G.coins += sellPrice;
          G.gear.splice(G.gear.indexOf(item), 1);
          if (!G.rep) G.rep = { battlesWon: 0, craftsCompleted: 0, itemsSold: 0, essencesCollected: 0, raresFound: 0 };
          G.rep.itemsSold = (G.rep.itemsSold || 0) + 1;
          if (typeof addProfessionXP === 'function') addProfessionXP('trade', 5);
          saveGame();
          this.showNotification(`Sold ${item.name} for ${sellPrice}g!`);
          this.panels.close();
          this.openTradingPost();
        });
        container.add(sellBtn);
      });

      if (gear.length > 6) {
        container.add(this.add.text(w / 2, cy + 6 * 42 + 8, `...and ${gear.length - 6} more`, {
          fontSize: '11px', fontFamily: 'monospace', color: '#555555',
        }).setOrigin(0.5, 0).setScrollFactor(0));
      }
    }
  }

  _buyShopItem(item) {
    if (G.coins < item.price) {
      this.showNotification('Not enough gold!');
      return;
    }
    G.coins -= item.price;

    switch (item.name) {
      case 'Healing Potion':
        for (const ghost of G.team) {
          ghost.hp = ghost.maxHp;
          ghost.ko = false;
        }
        this.showNotification('Team fully healed!');
        break;
      case 'Essence Detector':
        // Store a buff counter — BattleScene can check this
        G._essenceDetectorBattles = (G._essenceDetectorBattles || 0) + 5;
        this.showNotification('Essence Detector active for 5 battles!');
        break;
      case 'Lucky Charm':
        G._luckyCharmActive = true;
        this.showNotification('Lucky Charm active! +10% recruit chance next battle.');
        break;
      case 'Escape Rope':
        G._escapeRopeCount = (G._escapeRopeCount || 0) + 1;
        this.showNotification(`Escape Rope acquired! (${G._escapeRopeCount} total)`);
        break;
      case 'Spirit Snack':
        const active = G.team[G.activeIdx];
        if (active && !active.ko) {
          const heal = Math.min(2, active.maxHp - active.hp);
          active.hp += heal;
          this.showNotification(`${active.name} ate a Spirit Snack! +${heal} HP`);
        } else {
          this.showNotification('No active ghost to feed!');
          G.coins += item.price; // refund
        }
        break;
    }

    if (typeof addProfessionXP === 'function') addProfessionXP('trade', 3);
    saveGame();
    // Refresh panel
    this.panels.close();
    this.openTradingPost();
  }

  // ═══════ WAVE 4: ARENA CHALLENGE ═══════

  openArena() {
    if (this.panels.isOpen()) { this.panels.close(); return; }

    this.panels.open('ARENA', (container, w, h) => {
      // Header
      const title = this.add.text(w / 2, 10, 'Battle Challenge', {
        fontSize: '16px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: '#ffcc44',
      }).setOrigin(0.5, 0).setScrollFactor(0);
      container.add(title);

      // Stats
      const wins = G.arenaWins || 0;
      container.add(this.add.text(w / 2, 34, `Arena Wins: ${wins}`, {
        fontSize: '12px', fontFamily: 'monospace', color: '#aaaacc',
      }).setOrigin(0.5, 0).setScrollFactor(0));

      // Arena challenge description
      const descLines = [
        'Face the Arena Champions:',
        'a team of 3 rare Spiritkin!',
        '',
        'Reward: 50 gold + Arena Victor title',
      ];
      descLines.forEach((line, i) => {
        container.add(this.add.text(w / 2, 60 + i * 18, line, {
          fontSize: '12px', fontFamily: 'Georgia, serif',
          color: i === 3 ? '#ffdd44' : '#aaaaaa',
        }).setOrigin(0.5, 0).setScrollFactor(0));
      });

      // Team preview — show the 3 arena ghosts
      const arenaTeamIds = [202, 78, 67]; // Dark Fang, Haywire, Snorton (all rare)
      const previewY = 140;
      container.add(this.add.text(w / 2, previewY, 'OPPONENTS:', {
        fontSize: '11px', fontFamily: 'monospace', fontStyle: 'bold', color: '#cc6644',
      }).setOrigin(0.5, 0).setScrollFactor(0));

      arenaTeamIds.forEach((id, i) => {
        const card = typeof getCard === 'function' ? getCard(id) : null;
        if (!card) return;
        const y = previewY + 18 + i * 22;
        container.add(this.add.text(w / 2, y, `${card.name} (${card.rarity}) HP:${card.maxHp} — ${card.ability}`, {
          fontSize: '10px', fontFamily: 'monospace', color: '#aa55ff',
        }).setOrigin(0.5, 0).setScrollFactor(0));
      });

      // Fight button
      const canFight = G.team.length > 0 && G.team.some(g => !g.ko && g.hp > 0);
      const fightY = previewY + 90;
      const fightBg = this.add.rectangle(w / 2, fightY, 140, 36, canFight ? 0x443322 : 0x222222, 0.9)
        .setStrokeStyle(2, canFight ? 0xcc6644 : 0x444444)
        .setInteractive({ useHandCursor: canFight }).setScrollFactor(0);
      const fightText = this.add.text(w / 2, fightY, canFight ? 'FIGHT!' : 'Team KO\'d', {
        fontSize: '16px', fontFamily: 'Georgia, serif', fontStyle: 'bold',
        color: canFight ? '#ff8844' : '#666666',
      }).setOrigin(0.5).setScrollFactor(0);

      if (canFight) {
        fightBg.on('pointerover', () => fightBg.setFillStyle(0x664433));
        fightBg.on('pointerout', () => fightBg.setFillStyle(0x443322, 0.9));
        fightBg.on('pointerdown', () => {
          this.panels.close();
          this._startArenaBattle();
        });
      }

      container.add([fightBg, fightText]);
    }, { width: 380, height: 320 });
  }

  _startArenaBattle() {
    if (G.inBattle || G.team.length === 0) return;
    if (!G.team.some(g => !g.ko && g.hp > 0)) {
      this.showNotification('Your team is KO\'d! Heal at the Inn first.');
      return;
    }

    // Track wins before battle so we can detect victory on resume
    this._pendingArenaCheck = true;
    this._arenaWinsBefore = G.rep?.battlesWon || 0;

    G.inBattle = true;
    const playerGhosts = buildPlayerBattleTeam();

    // Arena team: 3 rares
    const arenaTeamIds = [202, 78, 67]; // Dark Fang, Haywire, Snorton
    const enemyGhosts = arenaTeamIds.map(id => {
      const card = typeof getCard === 'function' ? getCard(id) : null;
      if (!card) return null;
      // Scale HP slightly with player level
      const scaledMaxHp = Math.round(card.maxHp * (1 + (G.level - 1) * 0.1));
      return {
        id: card.id, name: card.name, hp: scaledMaxHp, maxHp: scaledMaxHp,
        ko: false, ability: card.ability, abilityDesc: card.desc, rarity: card.rarity,
        usedOncePerGame: false, entryFired: false,
      };
    }).filter(Boolean);

    if (enemyGhosts.length === 0) { G.inBattle = false; return; }

    // Use new battle engine factory
    const playerIds = playerGhosts.map(g => g.id);
    const enemyIds = enemyGhosts.map(g => g.id);
    if (typeof initBattle === 'function') {
      initBattle(playerIds, enemyIds, { type: 'arena', isArena: true });
    }

    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.time.delayedCall(300, () => {
      this.scene.launch('BattleScene', {
        enemyCard: typeof getCard === 'function' ? getCard(arenaTeamIds[0]) : null,
        trainerName: 'Arena Champion',
      });
      this.scene.pause();
    });
  }

  // ═══════ SPIRIT WISPS ═══════

  spawnWisp() {
    if (!this.wisps || this.wisps.getLength() >= 8) return;
    const px = this.player ? this.player.x : 500;
    const py = this.player ? this.player.y : 500;
    const angle = Math.random() * Math.PI * 2;
    const dist = Phaser.Math.Between(100, 300);
    const wx = px + Math.cos(angle) * dist;
    const wy = py + Math.sin(angle) * dist;

    const WISP_TYPES = [
      { name: 'Frost Shard', color: 0x88ccff },
      { name: 'Ember Dust', color: 0xff8844 },
      { name: 'Spirit Thread', color: 0xaa66ff },
      { name: 'Mask Fragment', color: 0xffffff },
      { name: 'Healing Seed', color: 0x44aa44 },
    ];
    const type = WISP_TYPES[Math.floor(Math.random() * WISP_TYPES.length)];

    const wisp = this.wisps.create(wx, wy, null);
    wisp.setDisplaySize(12, 12).setVisible(false);
    wisp.wispType = type;

    // Glowing circle visual
    const glow = this.add.circle(wx, wy, 6, type.color, 0.8).setDepth(8);
    const outerGlow = this.add.circle(wx, wy, 10, type.color, 0.2).setDepth(7);
    wisp.glowCircle = glow;
    wisp.outerGlow = outerGlow;

    // Pulse animation
    this.tweens.add({ targets: outerGlow, scaleX: 1.5, scaleY: 1.5, alpha: 0.05, duration: 1200, yoyo: true, repeat: -1 });
    // Float animation
    this.tweens.add({ targets: [glow, outerGlow, wisp], y: wy + Phaser.Math.Between(-15, 15), duration: 2000, yoyo: true, repeat: -1 });

    // Auto-despawn after 12 seconds
    this.time.delayedCall(12000, () => {
      if (wisp.active) {
        glow.destroy();
        outerGlow.destroy();
        wisp.destroy();
      }
    });
  }

  onWispCollect(player, wisp) {
    const type = wisp.wispType;
    if (wisp.glowCircle) wisp.glowCircle.destroy();
    if (wisp.outerGlow) wisp.outerGlow.destroy();
    wisp.destroy();
    GameAudio.collect();

    // Grant battle resource
    const resourceMap = { 'Frost Shard': 'iceShards', 'Ember Dust': 'sacredFire', 'Spirit Thread': 'surge', 'Mask Fragment': 'moonstone', 'Healing Seed': 'healingSeeds' };
    const key = resourceMap[type.name];
    if (key && G[key] !== undefined) G[key]++;

    // Also store as crafting material (used by SCHEMATICS with requiresMaterial)
    const materialMap = { 'Frost Shard': 'frost_shard', 'Ember Dust': 'ember_dust', 'Spirit Thread': 'spirit_thread', 'Mask Fragment': 'mask_fragment' };
    const matKey = materialMap[type.name];
    if (matKey) {
      if (!G.materials) G.materials = {};
      G.materials[matKey] = (G.materials[matKey] || 0) + 1;
    }

    // Wave 5: Daily challenge wisp progress
    if (G.dailyChallenge && G.dailyChallenge.type === 'wisps' && !G.dailyChallenge.claimed) {
      G.dailyChallenge.progress++;
    }

    this.showNotification(`Collected ${type.name}!`);
    saveGame();
  }

  // ═══════ DAY/NIGHT CYCLE ═══════

  updateDayNight() {
    const tod = getTimeOfDay();
    if (!this._nightOverlay) {
      this._nightOverlay = this.add.rectangle(
        this.scale.width / 2, this.scale.height / 2,
        this.scale.width * 2, this.scale.height * 2,
        0x000022
      ).setScrollFactor(0).setDepth(150).setAlpha(0);
    }
    this._nightOverlay.setAlpha(tod.nightFactor * 0.5);
  }

  // ═══════ HUD ═══════

  buildHUD() {
    // scrollFactor(0) — use raw canvas dimensions
    const W = this.scale.width;
    const H = this.scale.height;

    // Top-left: player info
    this.hudPlayerText = this.add.text(10, 8, '', {
      fontSize: '11px', fontFamily: 'monospace', color: '#ffffff',
      backgroundColor: '#000000aa', padding: { x: 6, y: 3 },
    }).setScrollFactor(0).setDepth(200);

    // Top-left below: active ghost + HP
    this.hudTeamText = this.add.text(10, 28, '', {
      fontSize: '10px', fontFamily: 'monospace', color: '#88ff88',
      backgroundColor: '#000000aa', padding: { x: 6, y: 2 },
    }).setScrollFactor(0).setDepth(200);

    // Top-right: time of day
    this.hudTimeText = this.add.text(W - 10, 8, '', {
      fontSize: '10px', fontFamily: 'monospace', color: '#aaaacc',
      backgroundColor: '#000000aa', padding: { x: 5, y: 2 },
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(200);

    // ── Minimap (bottom-right) ──
    const mmW = 90, mmH = 65;
    const vW = W, vH = H; // raw canvas for scrollFactor(0)
    this.minimapBg = this.add.rectangle(vW - mmW/2 - 8, vH - mmH/2 - 8, mmW + 4, mmH + 4, 0x000000, 0.7)
      .setStrokeStyle(1, 0x444466).setScrollFactor(0).setDepth(200);

    // Minimap graphics
    this.minimapGfx = this.add.graphics().setScrollFactor(0).setDepth(201);

    // Player dot on minimap
    this.minimapDot = this.add.circle(0, 0, 3, 0x44aaff)
      .setScrollFactor(0).setDepth(202);

    this.drawMinimap();
  }

  drawMinimap() {
    const W = this.scale.width;
    const H = this.scale.height;
    const mmW = 90, mmH = 65;
    const mmX = W - mmW - 8;
    const mmY = H - mmH - 8;
    const scaleX = mmW / WORLD_W;
    const scaleY = mmH / WORLD_H;

    this.minimapGfx.clear();

    // Draw tiles at minimap scale
    for (let y = 0; y < WORLD_H; y += 2) {
      for (let x = 0; x < WORLD_W; x += 2) {
        const tile = worldMap[y]?.[x] || 0;
        const colorHex = TILE_COLORS[tile] || '#888888';
        const color = parseInt(colorHex.replace('#', ''), 16);
        this.minimapGfx.fillStyle(color, 1);
        this.minimapGfx.fillRect(mmX + x * scaleX, mmY + y * scaleY, scaleX * 2, scaleY * 2);
      }
    }

    // Wave 5: Encounter zone colored fills
    for (const zone of ENCOUNTER_ZONES) {
      // Determine region color based on zone position
      const zCenterX = zone.x + zone.w / 2;
      const zCenterY = zone.y + zone.h / 2;
      const zRegion = getCurrentRegion(zCenterX, zCenterY);
      const regionFills = {
        frost_valley: 0x4488ff,
        rolling_hills: 0x44cc44,
        volcanic_isles: 0xff8844,
        dark_castle: 0x9944cc,
      };
      const fillColor = regionFills[zRegion] || 0x8866dd;
      this.minimapGfx.fillStyle(fillColor, 0.2);
      this.minimapGfx.fillRect(
        mmX + zone.x * scaleX, mmY + zone.y * scaleY,
        zone.w * scaleX, zone.h * scaleY
      );
      // Outline on top
      this.minimapGfx.lineStyle(1, fillColor, 0.5);
      this.minimapGfx.strokeRect(
        mmX + zone.x * scaleX, mmY + zone.y * scaleY,
        zone.w * scaleX, zone.h * scaleY
      );
    }
  }

  updateHUD() {
    const wins = G.rep?.battlesWon || 0;
    const sideline = wins >= 5 ? 'UNLOCKED' : `${wins}/5 wins`;

    const xpNeeded = G.level * 3;
    this.hudPlayerText.setText(`${G.name} | LV ${G.level} (${G.xp}/${xpNeeded} XP) | ${G.coins} Gold`);

    const ghost = G.team[G.activeIdx];
    if (ghost) {
      this.hudTeamText.setText(`${ghost.name} HP ${ghost.hp}/${ghost.maxHp} | ${ghost.ability}`);
      this.hudTeamText.setColor(ghost.hp <= ghost.maxHp * 0.33 ? '#ff6644' : '#88ff88');
    } else {
      this.hudTeamText.setText('No Spiritkin!');
    }

    // Quest tracker (uses wins from above)
    let questText = '';
    if (wins < 1) questText = 'Quest: Defeat your first wild Spiritkin!';
    else if (wins < 5) questText = `Quest: Win ${5 - wins} more battles to unlock sideline`;
    else if (wins < 10) questText = `Quest: Defeat ${10 - wins} more for Veteran title`;
    else questText = `Battles won: ${wins}`;
    if (!this.hudQuestText) {
      this.hudQuestText = this.add.text(10, 58, '', {
        fontSize: '11px', fontFamily: 'monospace', color: '#ffcc44',
        backgroundColor: '#000000aa', padding: { x: 6, y: 2 },
      }).setScrollFactor(0).setDepth(200);
    }
    this.hudQuestText.setText(questText);

    // Time of day
    const tod = getTimeOfDay();
    const icons = { dawn: '🌅', day: '☀️', dusk: '🌇', night: '🌙' };
    this.hudTimeText.setText(`${icons[tod.phase] || ''} ${tod.phase}`);

    // Wave 5: Daily challenge HUD
    if (!this.hudDailyText) {
      this.hudDailyText = this.add.text(10, 78, '', {
        fontSize: '10px', fontFamily: 'monospace', color: '#88ccff',
        backgroundColor: '#000000aa', padding: { x: 6, y: 2 },
      }).setScrollFactor(0).setDepth(200);
    }
    if (G.dailyChallenge && !G.dailyChallenge.claimed) {
      const dc = G.dailyChallenge;
      this.hudDailyText.setText(`Daily: ${dc.desc} (${dc.progress}/${dc.goal})`);
      this.hudDailyText.setVisible(true);
    } else if (G.dailyChallenge && G.dailyChallenge.claimed) {
      this.hudDailyText.setText('Daily: COMPLETE!');
      this.hudDailyText.setColor('#44cc44');
      this.hudDailyText.setVisible(true);
    } else {
      this.hudDailyText.setVisible(false);
    }

    // Wave 3: Zone quality display
    const zoneIdx = getCurrentZone(G.x, G.y);
    if (!this.hudZoneText) {
      this.hudZoneText = this.add.text(10, 96, '', {
        fontSize: '11px', fontFamily: 'monospace', color: '#aa88dd',
        backgroundColor: '#000000aa', padding: { x: 6, y: 2 },
      }).setScrollFactor(0).setDepth(200);
    }
    if (zoneIdx >= 0) {
      const zone = ENCOUNTER_ZONES[zoneIdx];
      const quality = getZoneQuality(zoneIdx, getZoneCycleId());
      const qualLabel = getZoneQualityLabel(quality);
      const qualColor = quality >= 1.2 ? '#44ff44' : quality >= 0.8 ? '#cccc44' : '#ff6644';
      this.hudZoneText.setText(`Zone: ${zone.name} (${qualLabel})`);
      this.hudZoneText.setColor(qualColor);
      this.hudZoneText.setVisible(true);
    } else {
      this.hudZoneText.setVisible(false);
    }

    // Wave 3: Mastery display
    if (!this.hudMasteryText) {
      this.hudMasteryText = this.add.text(10, 116, '', {
        fontSize: '11px', fontFamily: 'monospace', color: '#cc9944',
        backgroundColor: '#000000aa', padding: { x: 6, y: 2 },
      }).setScrollFactor(0).setDepth(200);
    }
    // Sync combat mastery XP from battlesWon (read-only from BattleScene)
    if (G.mastery && G.mastery.combat) {
      G.mastery.combat.xp = wins;
    }
    const combatMastery = (typeof getMasteryInfo === 'function') ? getMasteryInfo(wins) : { name: 'Novice' };
    this.hudMasteryText.setText(`Combat: ${combatMastery.name} (${wins} XP)`);

    // Wave 4: Title count display
    if (!this.hudTitleText) {
      this.hudTitleText = this.add.text(10, 136, '', {
        fontSize: '11px', fontFamily: 'monospace', color: '#ccaa44',
        backgroundColor: '#000000aa', padding: { x: 6, y: 2 },
      }).setScrollFactor(0).setDepth(200);
    }
    const titleCount = G.titles?.length || 0;
    if (titleCount > 0) {
      this.hudTitleText.setText(`Titles: ${titleCount}`);
      this.hudTitleText.setVisible(true);
    } else {
      this.hudTitleText.setVisible(false);
    }

    // Minimap player dot
    const W = this.scale.width;
    const H = this.scale.height;
    const mmW = 90, mmH = 65;
    const mmX = W - mmW - 8;
    const mmY = H - mmH - 8;
    this.minimapDot.setPosition(mmX + G.x * (mmW / WORLD_W), mmY + G.y * (mmH / WORLD_H));
  }

  // ═══════ WAVE 5: BLACK RIDERS (night-only enemies) ═══════

  updateBlackRiders() {
    const tod = getTimeOfDay();
    const isNight = tod.phase === 'night';

    // Spawn riders during night
    if (isNight && !this._wasNight) {
      this._wasNight = true;
      this._blackRiderTimer = this.time.addEvent({
        delay: 8000,
        callback: () => this.spawnBlackRiders(),
        callbackScope: this,
        loop: true,
      });
      // Spawn first batch immediately
      this.spawnBlackRiders();
    }

    // Despawn all riders at dawn
    if (!isNight && this._wasNight) {
      this._wasNight = false;
      if (this._blackRiderTimer) { this._blackRiderTimer.remove(); this._blackRiderTimer = null; }
      this.despawnAllBlackRiders();
    }

    // Update rider labels to follow sprites
    for (const rider of this._blackRiders) {
      if (rider.sprite && rider.sprite.active && rider.label) {
        rider.label.setPosition(rider.sprite.x, rider.sprite.y - 40);
      }
    }
  }

  spawnBlackRiders() {
    if (!this.player) return;

    // 8 unique Dark Riders — "Dark Rider" on map, real name in battle
    // Lucy is special: shows her name on map, uses dragon sprite, max 1
    const DARK_RIDERS = [
      { name: 'Lucy',              team: [108],       tint: null, mapName: 'Lucy', sprite: 'creature_dragon', unique: true },
      { name: 'Dark Rider Jeff',   team: [74],        tint: 0x446644 },
      { name: 'Dark Rider Outlaw', team: [43, 93],    tint: 0x886644 },
      { name: 'Dark Rider Shade',  team: [111, 205],  tint: 0x442266 },
      { name: 'Dark Rider Tyler',  team: [105],       tint: 0x664422 },
      { name: 'Dark Rider Doc',    team: [42, 100],   tint: 0x444444 },
      { name: 'Dark Rider Harvey', team: [448, 424],  tint: 0x662244 },
      { name: 'Dark Rider Redd',   team: [98],        tint: 0x220044 },
    ];

    const count = Phaser.Math.Between(2, 3);
    for (let i = 0; i < count; i++) {
      if (this._blackRiders.length >= 8) break;
      const angle = Math.random() * Math.PI * 2;
      const dist = Phaser.Math.Between(200, 450);
      const rx = this.player.x + Math.cos(angle) * dist;
      const ry = this.player.y + Math.sin(angle) * dist;

      const T = this._tileSize;
      const tx = Math.floor(rx / T);
      const ty = Math.floor(ry / T);
      if (tx < 0 || ty < 0 || tx >= WORLD_W || ty >= WORLD_H) continue;
      if (this._impassableSet.has(worldMap[ty]?.[tx])) continue;

      // Pick a random rider identity (unique riders like Lucy can only appear once)
      const usedNames = this._blackRiders.map(r => r.rider?.name).filter(Boolean);
      const available = DARK_RIDERS.filter(r => !r.unique || !usedNames.includes(r.name));
      if (available.length === 0) continue;
      const rider = available[Math.floor(Math.random() * available.length)];
      const spriteKey = rider.sprite || 'creature_skull';

      const sprite = this.enemies.create(rx, ry, spriteKey, 0).setScale(2.5);
      if (rider.tint) sprite.setTint(rider.tint);
      sprite.setDepth(9);
      sprite._isBlackRider = true;
      sprite._riderName = rider.name;
      sprite._riderTeam = rider.team;

      // Use the first ghost in the rider's team as the encounter card
      const leadCard = ALL_CARDS.find(c => c.id === rider.team[0]);
      sprite.cardData = leadCard || ALL_CARDS.find(c => c.rarity === 'rare');

      // Lucy shows her name on the map; others say "Dark Rider"
      const mapLabel = rider.mapName || 'Dark Rider';
      const label = this.add.text(rx, ry - 40, mapLabel, {
        fontSize: '10px', fontFamily: 'monospace', fontStyle: 'bold', color: '#aa44cc',
        backgroundColor: '#00000088', padding: { x: 3, y: 1 },
      }).setOrigin(0.5).setDepth(11);

      // Aggressive movement toward player
      this.tweens.add({
        targets: sprite,
        x: this.player.x + Phaser.Math.Between(-80, 80),
        y: this.player.y + Phaser.Math.Between(-80, 80),
        duration: Phaser.Math.Between(3000, 5000),
        yoyo: true, repeat: -1,
        onUpdate: () => { if (label && sprite.active) label.setPosition(sprite.x, sprite.y - 40); },
      });

      this._blackRiders.push({ sprite, label, rider });
    }
  }

  despawnAllBlackRiders() {
    for (const rider of this._blackRiders) {
      if (rider.label) rider.label.destroy();
      if (rider.sprite && rider.sprite.active) rider.sprite.destroy();
    }
    this._blackRiders = [];
  }

  // ═══════ WAVE 5: WORLD BOSS ═══════

  spawnWorldBoss() {
    const T = this._tileSize;
    const bossLocations = {
      frost_valley:    { x: 25, y: 10 },
      rolling_hills:   { x: 35, y: 60 },
      volcanic_isles:  { x: 75, y: 30 },
      dark_castle:     { x: 95, y: 10 },
    };

    // Pick the boss location in the player's current region, or default to frost
    const region = getCurrentRegion(G.x, G.y);
    const loc = bossLocations[region] || bossLocations.frost_valley;

    // Verify tile is walkable — find nearby walkable tile if blocked
    let bx = loc.x, by = loc.y;
    if (this._impassableSet.has(worldMap[by]?.[bx])) {
      for (let r = 1; r < 5; r++) {
        let found = false;
        for (let dy = -r; dy <= r && !found; dy++) {
          for (let dx = -r; dx <= r && !found; dx++) {
            const cx = bx + dx, cy = by + dy;
            if (cx >= 0 && cy >= 0 && cx < WORLD_W && cy < WORLD_H && !this._impassableSet.has(worldMap[cy]?.[cx])) {
              bx = cx; by = cy; found = true;
            }
          }
        }
        if (found) break;
      }
    }

    const worldX = bx * T + T / 2;
    const worldY = by * T + T / 2;

    // Boss sprite (large, red-tinted)
    this._worldBossSprite = this.add.rectangle(worldX, worldY, 48, 48, 0xcc2222, 0.9)
      .setStrokeStyle(2, 0xff4444).setDepth(9);

    // Pulsing glow
    this._worldBossGlow = this.add.circle(worldX, worldY, 36, 0xff0000, 0.15).setDepth(8);
    this.tweens.add({
      targets: this._worldBossGlow,
      scaleX: 1.6, scaleY: 1.6, alpha: 0.05,
      duration: 1500, yoyo: true, repeat: -1,
    });

    // Label
    this._worldBossLabel = this.add.text(worldX, worldY - 38, 'WORLD BOSS', {
      fontSize: '11px', fontFamily: 'monospace', fontStyle: 'bold', color: '#ff4444',
      backgroundColor: '#00000088', padding: { x: 4, y: 2 },
    }).setOrigin(0.5).setDepth(11);

    // Floating animation on label
    this.tweens.add({
      targets: this._worldBossLabel,
      y: worldY - 44, duration: 1000, yoyo: true, repeat: -1,
    });

    this._worldBossRegion = region;
    this._worldBossX = worldX;
    this._worldBossY = worldY;
    this._worldBossAlive = true;
  }

  checkWorldBossProximity() {
    if (!this._worldBossAlive || !this._worldBossSprite || !this.player) return;

    // Respawn check
    if (!this._worldBossAlive && this._worldBossRespawnTime > 0 && Date.now() >= this._worldBossRespawnTime) {
      this.spawnWorldBoss();
      return;
    }

    const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, this._worldBossX, this._worldBossY);

    // Show interact hint when close
    if (dist < 80) {
      if (!this._worldBossHint) {
        this._worldBossHint = this.add.text(this._worldBossX, this._worldBossY + 30, '[E] Challenge', {
          fontSize: '10px', fontFamily: 'monospace', fontStyle: 'bold', color: '#ff8844',
          backgroundColor: '#000000aa', padding: { x: 3, y: 1 },
        }).setOrigin(0.5).setDepth(12);
      }

      if (this._ePressed && !this._eConsumed && !this.panels.isOpen()) {
        this._eConsumed = true;
        this.triggerWorldBossBattle();
      }
    } else {
      if (this._worldBossHint) { this._worldBossHint.destroy(); this._worldBossHint = null; }
    }
  }

  triggerWorldBossBattle() {
    if (G.inBattle || G.team.length === 0) return;
    if (!G.team.some(g => !g.ko && g.hp > 0)) {
      this.showNotification('Your team is KO\'d! Heal first.');
      return;
    }

    // Track wins before battle
    this._pendingWorldBossCheck = true;
    this._worldBossWinsBefore = G.rep?.battlesWon || 0;

    // Remove boss visuals
    if (this._worldBossSprite) { this._worldBossSprite.destroy(); this._worldBossSprite = null; }
    if (this._worldBossLabel) { this._worldBossLabel.destroy(); this._worldBossLabel = null; }
    if (this._worldBossGlow) { this._worldBossGlow.destroy(); this._worldBossGlow = null; }
    if (this._worldBossHint) { this._worldBossHint.destroy(); this._worldBossHint = null; }
    this._worldBossAlive = false;
    this._worldBossRespawnTime = Date.now() + 5 * 60 * 1000; // 5 minute respawn

    // Schedule respawn
    this.time.delayedCall(5 * 60 * 1000, () => { this.spawnWorldBoss(); });

    // Set up boss battle — 3 ghosts, each with 3x HP
    G.inBattle = true;
    const playerGhosts = buildPlayerBattleTeam();

    // Pick 3 strong ghosts for the boss team
    const bossPool = ALL_CARDS.filter(c => c.rarity === 'rare' || c.rarity === 'ghost-rare' || c.rarity === 'legendary');
    const bossTeam = [];
    const shuffled = [...bossPool].sort(() => Math.random() - 0.5);
    for (let i = 0; i < 3 && i < shuffled.length; i++) {
      const card = shuffled[i];
      const scaledMaxHp = card.maxHp * 3; // 3x HP for boss
      bossTeam.push({
        id: card.id, name: card.name, hp: scaledMaxHp, maxHp: scaledMaxHp,
        ko: false, ability: card.ability, abilityDesc: card.desc, rarity: card.rarity,
        usedOncePerGame: false, entryFired: false,
      });
    }

    if (bossTeam.length === 0) { G.inBattle = false; return; }

    // Use new battle engine factory
    const playerIds = playerGhosts.map(g => g.id);
    const bossIds = bossTeam.map(g => g.id);
    if (typeof initBattle === 'function') {
      initBattle(playerIds, bossIds, { type: 'worldboss', worldBoss: true });
    }

    // Create raid if in a party (co-op boss fight)
    let raidId = null;
    if (G.party && G.party.length > 0 && typeof RaidManager !== 'undefined') {
      raidId = RaidManager.createRaid(bossTeam[0].id, bossTeam[0].name, bossTeam[0].maxHp, bossTeam);
    }

    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.time.delayedCall(300, () => {
      this.scene.launch('BattleScene', {
        enemyCard: getCard(bossTeam[0].id),
        trainerName: 'WORLD BOSS',
        worldBoss: true,
        raidId: raidId,
      });
      this.scene.pause();
    });
  }

  // ═══════ RAID INVITE HANDLER ═══════

  setupRaidInviteListener() {
    if (typeof RaidManager === 'undefined' || typeof db === 'undefined' || db._stub) return;

    RaidManager.listenForInvites((invite) => {
      if (G.inBattle) return; // already in battle, ignore
      if (!invite || !invite.raidId) return;

      // Auto-join the raid — show notification and launch battle
      this.showNotification(`${invite.from} started a raid! Joining...`);
      if (typeof GameAudio !== 'undefined') GameAudio.levelUp();

      this.time.delayedCall(1500, () => {
        if (G.inBattle) return;
        G.inBattle = true;

        // Build our own battle state against the raid boss
        const playerGhosts = buildPlayerBattleTeam();
        const bossCards = (invite.bossTeamIds || []).map(id => {
          const card = typeof getCard === 'function' ? getCard(id) : ALL_CARDS.find(c => c.id === id);
          if (!card) return null;
          const scaledMaxHp = card.maxHp * 3;
          return { id: card.id, name: card.name, hp: scaledMaxHp, maxHp: scaledMaxHp,
            ko: false, ability: card.ability, abilityDesc: card.desc, rarity: card.rarity,
            usedOncePerGame: false, entryFired: false };
        }).filter(Boolean);

        if (bossCards.length === 0) { G.inBattle = false; return; }

        // Use new battle engine factory
        const playerIds = playerGhosts.map(g => g.id);
        const bossCardIds = bossCards.map(g => g.id);
        if (typeof initBattle === 'function') {
          initBattle(playerIds, bossCardIds, { type: 'raid', worldBoss: true, raidId: invite.raidId });
        }

        // Join the raid
        RaidManager.listenToRaid(invite.raidId);
        db.ref('raids/' + invite.raidId + '/participants/' + G.playerId).set({
          name: G.name, level: G.level, totalDamage: 0, alive: true,
        });

        this.cameras.main.fadeOut(300, 0, 0, 0);
        this.time.delayedCall(300, () => {
          this.scene.launch('BattleScene', {
            enemyCard: typeof getCard === 'function' ? getCard(bossCards[0].id) : null,
            trainerName: `RAID: ${invite.bossName}`,
            worldBoss: true,
            raidId: invite.raidId,
          });
          this.scene.pause();
        });
      });
    });
  }

  // ═══════ WAVE 5: SPARKLE TRAILS ═══════

  createSparkleTrails() {
    const T = this._tileSize;

    // Define trail paths from hubs toward encounter zones, per region
    const trailPaths = [
      // Frost Valley: Polaris Hub -> Crystal Glade
      { region: 'frost_valley', points: [
        {x:17,y:19},{x:18,y:18},{x:19,y:17},{x:20,y:16},{x:21,y:15},{x:22,y:14},{x:23,y:13},{x:24,y:13},{x:25,y:12},{x:26,y:12},{x:20,y:20},{x:19,y:22},{x:18,y:24},
      ]},
      // Rolling Hills: Meadowbrook -> Sunlit Meadow
      { region: 'rolling_hills', points: [
        {x:25,y:54},{x:23,y:53},{x:20,y:53},{x:18,y:53},{x:16,y:53},{x:14,y:53},{x:13,y:52},{x:30,y:56},{x:32,y:56},{x:33,y:55},{x:34,y:55},{x:35,y:55},
      ]},
      // Volcanic Isles: Settlement -> Magma Pools
      { region: 'volcanic_isles', points: [
        {x:73,y:15},{x:72,y:14},{x:71,y:13},{x:70,y:12},{x:69,y:11},{x:68,y:11},{x:75,y:18},{x:76,y:20},{x:77,y:22},{x:78,y:24},{x:78,y:26},
      ]},
      // Dark Castle: Warden -> Shadow Realm
      { region: 'dark_castle', points: [
        {x:93,y:18},{x:93,y:16},{x:93,y:14},{x:93,y:12},{x:93,y:10},{x:94,y:9},{x:95,y:16},{x:96,y:14},{x:97,y:12},{x:98,y:10},
      ]},
    ];

    const regionColors = {
      frost_valley: 0x88ccff,
      rolling_hills: 0x66dd66,
      volcanic_isles: 0xff9944,
      dark_castle: 0xaa66dd,
    };

    for (const trail of trailPaths) {
      const color = regionColors[trail.region] || 0xffffff;
      for (const pt of trail.points) {
        // Skip if tile is impassable
        if (this._impassableSet.has(worldMap[pt.y]?.[pt.x])) continue;

        const sx = pt.x * T + T / 2 + Phaser.Math.Between(-6, 6);
        const sy = pt.y * T + T / 2 + Phaser.Math.Between(-6, 6);

        const dot = this.add.circle(sx, sy, Phaser.Math.Between(2, 4), color, 0.5).setDepth(6);

        // Gentle floating animation (y oscillation + alpha pulse)
        this.tweens.add({
          targets: dot,
          y: sy + Phaser.Math.Between(-8, 8),
          alpha: { from: 0.2, to: 0.6 },
          duration: Phaser.Math.Between(1500, 3000),
          yoyo: true,
          repeat: -1,
          delay: Phaser.Math.Between(0, 2000),
        });
      }
    }
  }

  // ═══════ WAVE 5: HELP PANEL ═══════

  showHelpPanel() {
    if (this.panels.isOpen()) { this.panels.close(); return; }
    GameAudio.menuOpen();

    this.panels.open('HELP & TIPS', (container, w, h) => {
      let y = 4;

      // Controls section
      const controlsTitle = this.add.text(w / 2, y, 'CONTROLS', {
        fontSize: '14px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: '#ffcc44',
      }).setOrigin(0.5, 0).setScrollFactor(0);
      container.add(controlsTitle);
      y += 22;

      const controls = [
        'WASD / Arrows  -  Move',
        'E              -  Interact / Talk',
        'T              -  Team Lineup',
        'I              -  Inventory',
        'C              -  Crafting (Workshop)',
        'P              -  Professions',
        'H              -  This Help Screen',
        'ESC            -  Close Panel',
      ];
      for (const line of controls) {
        const ct = this.add.text(14, y, line, {
          fontSize: '11px', fontFamily: 'monospace', color: '#aaaacc',
        }).setScrollFactor(0);
        container.add(ct);
        y += 16;
      }

      // Divider
      y += 6;
      container.add(this.add.rectangle(w / 2, y, w - 20, 1, 0x334466).setScrollFactor(0));
      y += 10;

      // Tips section
      const tipsTitle = this.add.text(w / 2, y, 'GAME TIPS', {
        fontSize: '14px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: '#44bbff',
      }).setOrigin(0.5, 0).setScrollFactor(0);
      container.add(tipsTitle);
      y += 22;

      const tips = [
        'Collect spirit wisps for battle resources.',
        'Craft gear at the Workshop using essences.',
        'Heal your team at the Inn for 5 gold.',
        'Visit the Cantina for random gameplay tips.',
        'Encounter zones cycle quality every 12 hours.',
        'Defeat trainers for bonus XP and gold.',
        'Complete daily challenges for 25 gold bonus.',
        'World Bosses drop rare essences on defeat.',
        'Black Riders appear at night - extra XP!',
        'Explore all 4 regions for the Explorer title.',
      ];
      for (const tip of tips) {
        const dot = this.add.text(14, y, '\u2022 ' + tip, {
          fontSize: '11px', fontFamily: 'Georgia, serif', color: '#888899',
          wordWrap: { width: w - 32 },
        }).setScrollFactor(0);
        container.add(dot);
        y += 18;
      }
    }, { width: 420, height: 460 });
  }

  // ═══════ WAVE 5: DAILY CHALLENGE ═══════

  initDailyChallenge() {
    const seed = getDaySeed();

    // If no challenge exists or it's from a different day, generate a new one
    if (!G.dailyChallenge || G.dailyChallenge.seed !== seed) {
      const challenges = [
        { type: 'battles', desc: 'Defeat 3 wild spirits', goal: 3 },
        { type: 'wisps',   desc: 'Collect 5 wisps', goal: 5 },
        { type: 'trainers', desc: 'Win 2 trainer battles', goal: 2 },
      ];
      // Use seed to deterministically pick the challenge
      const idx = seed % challenges.length;
      const chosen = challenges[idx];
      G.dailyChallenge = {
        seed: seed,
        type: chosen.type,
        desc: chosen.desc,
        progress: 0,
        goal: chosen.goal,
        claimed: false,
      };
      saveGame();
    }
  }

  updateDailyChallenge() {
    if (!G.dailyChallenge || G.dailyChallenge.claimed) return;

    // Check if day changed (reset challenge)
    const currentSeed = getDaySeed();
    if (G.dailyChallenge.seed !== currentSeed) {
      this.initDailyChallenge();
      return;
    }

    // Check completion
    if (G.dailyChallenge.progress >= G.dailyChallenge.goal) {
      G.dailyChallenge.claimed = true;
      G.coins += 25;
      saveGame();
      this.showNotification('Daily Challenge Complete! +25 gold!');
      GameAudio.victory();
    }
  }

  // ═══════ WAVE 6: ONBOARDING TUTORIAL ═══════

  startTutorial() {
    if (G.tutorialComplete || G.tutorialStep > 0) return;
    G.tutorialStep = 1;
    this.showTutorialStep(1);
  }

  showTutorialStep(step) {
    if (!this.comm) return;

    // Clean up previous tutorial arrow
    if (this._tutorialArrow) {
      this._tutorialArrow.destroy();
      this._tutorialArrow = null;
    }

    switch (step) {
      case 1:
        this.comm.show('Guide', 'Welcome to the Spirit World! Use WASD or arrow keys to move around.', { color: '#44ccff' });
        break;

      case 2: {
        this.comm.show('Guide', 'See those glowing orbs? Walk into one to collect resources!', { color: '#44ccff' });
        // Point an arrow toward the nearest wisp
        const nearestWisp = this.findNearestWisp();
        if (nearestWisp) {
          this.showTutorialArrow(nearestWisp.x, nearestWisp.y);
        }
        break;
      }

      case 3: {
        this.comm.show('Guide', 'Now find a wild spirit and touch it to start a battle!', { color: '#44ccff' });
        // Point arrow toward nearest enemy
        const nearestEnemy = this.findNearestEnemy();
        if (nearestEnemy) {
          this.showTutorialArrow(nearestEnemy.x, nearestEnemy.y);
        }
        break;
      }

      case 4:
        this.comm.show('Guide', 'Great job! Press T to manage your team, I for inventory, C to craft. Good luck, adventurer!', { color: '#44ccff', duration: 6000 });
        // Tutorial complete after this message auto-dismisses
        this.time.delayedCall(6500, () => {
          G.tutorialComplete = true;
          G.tutorialStep = 4;
          saveGame();
        });
        break;
    }
  }

  updateTutorial(vx, vy) {
    if (G.tutorialComplete || !this._isNewGame) return;

    switch (G.tutorialStep) {
      case 1:
        // Wait for player to move
        if (vx !== 0 || vy !== 0) {
          if (!this._tutorialMoveCount) this._tutorialMoveCount = 0;
          this._tutorialMoveCount++;
          // Require a few frames of movement to confirm intentional input
          if (this._tutorialMoveCount > 30) {
            G.tutorialStep = 2;
            this._tutorialMoveCount = 0;
            this.time.delayedCall(500, () => this.showTutorialStep(2));
          }
        }
        break;

      case 2:
        // Wait for a wisp collection (battlesWon still 0, check resource gain)
        // Track if any resource changed since tutorial started
        if (!this._tutorialResourceSnapshot) {
          this._tutorialResourceSnapshot = (G.iceShards || 0) + (G.sacredFire || 0) + (G.healingSeeds || 0) + (G.luckyStones || 0) + (G.surge || 0) + (G.moonstone || 0) + (G.firefly || 0);
        }
        const currentResources = (G.iceShards || 0) + (G.sacredFire || 0) + (G.healingSeeds || 0) + (G.luckyStones || 0) + (G.surge || 0) + (G.moonstone || 0) + (G.firefly || 0);
        if (currentResources > this._tutorialResourceSnapshot) {
          G.tutorialStep = 3;
          this._tutorialResourceSnapshot = null;
          this.time.delayedCall(1000, () => this.showTutorialStep(3));
        }
        break;

      case 3:
        // Wait for player to win (or enter) a battle
        if (G.rep.battlesWon > 0) {
          G.tutorialStep = 4;
          this.time.delayedCall(1500, () => this.showTutorialStep(4));
        }
        break;

      // Step 4 auto-completes after the message plays
    }
  }

  findNearestWisp() {
    if (!this.wisps || !this.player) return null;
    let nearest = null;
    let minDist = Infinity;
    const children = this.wisps.getChildren ? this.wisps.getChildren() : [];
    for (const w of children) {
      if (!w.active) continue;
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, w.x, w.y);
      if (d < minDist) { minDist = d; nearest = w; }
    }
    return nearest;
  }

  findNearestEnemy() {
    if (!this.enemies || !this.player) return null;
    let nearest = null;
    let minDist = Infinity;
    const children = this.enemies.getChildren ? this.enemies.getChildren() : [];
    for (const e of children) {
      if (!e.active || e._isBlackRider) continue;
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, e.x, e.y);
      if (d < minDist) { minDist = d; nearest = e; }
    }
    return nearest;
  }

  showTutorialArrow(targetX, targetY) {
    if (this._tutorialArrow) this._tutorialArrow.destroy();

    // Create a pulsing arrow indicator pointing toward the target
    const arrow = this.add.text(targetX, targetY - 40, '\u25BC', {
      fontSize: '24px', color: '#44ccff',
    }).setOrigin(0.5).setDepth(15);

    this.tweens.add({
      targets: arrow,
      y: targetY - 30,
      alpha: { from: 1, to: 0.3 },
      duration: 600,
      yoyo: true,
      repeat: -1,
    });

    this._tutorialArrow = arrow;

    // Auto-remove after 10 seconds (target may move)
    this.time.delayedCall(10000, () => {
      if (arrow && arrow.active) arrow.destroy();
      if (this._tutorialArrow === arrow) this._tutorialArrow = null;
    });
  }

  // ═══════ WAVE 6: MULTIPLAYER PRESENCE ═══════

  initMultiplayerPresence() {
    // Initialize the presence system
    MultiplayerPresence.init();

    // Start listening for other players
    MultiplayerPresence.startListening(
      // onPlayerUpdate
      (pid, data) => {
        this.updateOtherPlayer(pid, data);
      },
      // onPlayerRemove
      (pid) => {
        this.removeOtherPlayer(pid);
      }
    );

    // Set up disconnect cleanup
    MultiplayerPresence.setupDisconnect();

    // Write initial presence
    MultiplayerPresence.updatePresence({
      name: G.name, x: G.x, y: G.y, spriteKey: G.spriteKey,
    });

    console.log('[WorldScene] Multiplayer presence initialized');

    // Listen for incoming buffs, party requests, and raid invites
    this.checkIncomingBuffs();
    this.setupRaidInviteListener();

    // Build party sidebar (will show if G.party has members)
    this.buildPartySidebar();
    this.updatePartySidebar();

    // ── Chat system ──
    this.buildChatBox();
    GameChat.init((msg) => this.onChatMessage(msg));
    const chatRegion = getCurrentRegion(G.x, G.y) || 'frost_valley';
    GameChat.listenToRegion(chatRegion);
    this._chatRegion = chatRegion;
  }

  updateOtherPlayer(pid, data) {
    const T = this._tileSize;

    if (this._otherPlayerSprites[pid]) {
      // Update existing player sprite position
      const entry = this._otherPlayerSprites[pid];
      const targetX = (data.x || 0) * T;
      const targetY = (data.y || 0) * T;

      // Smooth movement — 80ms tween matches 90ms update interval
      if (entry.sprite && entry.sprite.active) {
        this.tweens.killTweensOf(entry.sprite);
        this.tweens.add({
          targets: entry.sprite,
          x: targetX, y: targetY,
          duration: 80, ease: 'Linear',
        });
        if (entry.label && entry.label.active) {
          this.tweens.killTweensOf(entry.label);
          this.tweens.add({
            targets: entry.label,
            x: targetX, y: targetY - 36,
            duration: 80, ease: 'Linear',
          });
          // Update name in case it changed
          const dn = data.name || 'Unknown';
          const lv = (data.level && data.level > 1) ? ` Lv${data.level}` : '';
          entry.label.setText(dn + lv);
        }
      }
      entry.data = data;
      entry.lastSeen = Date.now();
    } else {
      // Create new player sprite (semi-transparent ghost appearance)
      const px = (data.x || 0) * T;
      const py = (data.y || 0) * T;

      // Use the other player's sprite key if available, otherwise default
      const textureKey = (data.spriteKey && this.textures.exists(data.spriteKey)) ? data.spriteKey : 'player';
      const isPartyMember = G.party && G.party.some(p => p.id === data.playerId);
      const sprite = this.add.sprite(px, py, textureKey, 0)
        .setScale(2)
        .setAlpha(isPartyMember ? 0.9 : 0.5)
        .setDepth(isPartyMember ? 9 : 8)
        .setTint(isPartyMember ? 0x44ff88 : 0x8888ff)
        .setInteractive({ useHandCursor: true });

      // Name label
      const displayName = data.name || 'Unknown';
      const lvl = (data.level && data.level > 1) ? ` (Lv${data.level})` : '';
      const labelColor = isPartyMember ? '#44ff88' : '#88aaff';
      const label = this.add.text(px, py - 36, displayName + lvl, {
        fontSize: '10px', fontFamily: 'monospace', fontStyle: 'bold', color: labelColor,
        backgroundColor: '#00000088', padding: { x: 3, y: 1 },
      }).setOrigin(0.5).setDepth(11).setAlpha(isPartyMember ? 0.9 : 0.7);

      // Click to interact — party up & buff
      sprite.on('pointerdown', () => {
        this.showPlayerInteraction(pid, data);
      });
      sprite.on('pointerover', () => { sprite.setAlpha(0.8); sprite.setTint(0xaaccff); });
      sprite.on('pointerout', () => { sprite.setAlpha(0.5); sprite.setTint(0x8888ff); });

      this._otherPlayerSprites[pid] = {
        sprite, label, data, pid,
        lastSeen: Date.now(),
      };
    }
  }

  removeOtherPlayer(pid) {
    const entry = this._otherPlayerSprites[pid];
    if (!entry) return;
    if (entry.sprite && entry.sprite.active) entry.sprite.destroy();
    if (entry.label && entry.label.active) entry.label.destroy();
    delete this._otherPlayerSprites[pid];
  }

  // ═══════ PLAYER INTERACTION — Party Up & Buff ═══════

  showPlayerInteraction(pid, data) {
    if (this.panels.isOpen()) { this.panels.close(); return; }
    const name = data.name || 'Unknown';
    const lvl = data.level || 1;
    const alreadyInParty = G.party && G.party.some(p => p.id === data.playerId);

    this.panels.open(`${name} \u2014 Level ${lvl}`, (container, w, h) => {
      let y = 10;

      // Player info
      container.add(this.add.text(w / 2, y, `${name} is exploring ${data.region || 'the world'}`, {
        fontSize: '12px', fontFamily: 'Georgia, serif', fontStyle: 'italic', color: '#aabbcc',
      }).setOrigin(0.5).setScrollFactor(0));
      y += 30;

      // Invite to Party (or already in party)
      if (alreadyInParty) {
        container.add(this.add.text(w / 2, y + 12, '\u2714 In your party', {
          fontSize: '13px', fontFamily: 'monospace', fontStyle: 'bold', color: '#44ff88',
        }).setOrigin(0.5).setScrollFactor(0));
      } else if (G.party && G.party.length >= 4) {
        container.add(this.add.text(w / 2, y + 12, 'Party full (4/4)', {
          fontSize: '13px', fontFamily: 'monospace', color: '#888',
        }).setOrigin(0.5).setScrollFactor(0));
      } else {
        const invBg = this.add.rectangle(w / 2, y + 16, w - 40, 36, 0x224488, 0.8)
          .setStrokeStyle(1, 0x4488cc).setInteractive({ useHandCursor: true }).setScrollFactor(0);
        container.add(invBg);
        container.add(this.add.text(w / 2, y + 16, 'Invite to Party', {
          fontSize: '14px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: '#88ccff',
        }).setOrigin(0.5).setScrollFactor(0));
        invBg.on('pointerdown', () => {
          this.sendPartyRequest(pid, data);
          this.panels.close();
        });
      }
      y += 46;

      // Inspect — show their active spiritkin
      container.add(this.add.text(w / 2, y, 'Active Spiritkin:', {
        fontSize: '11px', fontFamily: 'monospace', fontStyle: 'bold', color: '#ffdd44',
      }).setOrigin(0.5).setScrollFactor(0));
      y += 18;
      container.add(this.add.text(w / 2, y, data.activeName || 'Unknown', {
        fontSize: '12px', fontFamily: 'monospace', color: '#cccccc',
      }).setOrigin(0.5).setScrollFactor(0));
    }, { width: 320, height: 140 });
  }

  sendPartyRequest(pid, data) {
    if (db._stub) { this.showNotification('Multiplayer offline'); return; }
    const targetId = data.playerId || pid;
    const name = data.name || 'Unknown';
    db.ref('party_requests/' + targetId + '/' + G.playerId).set({
      from: G.name, fromId: G.playerId, level: G.level,
      sessionKey: MultiplayerPresence._sessionKey,
      timestamp: Date.now(),
    });
    this.showNotification(`Party invite sent to ${name}!`);
    if (typeof GameAudio !== 'undefined') GameAudio.collect();

    // Listen for acceptance
    db.ref('party_accepted/' + G.playerId + '/' + targetId).on('value', (snap) => {
      const acc = snap.val();
      if (!acc) return;
      // They accepted — add them to our party
      if (!G.party) G.party = [];
      if (!G.party.find(p => p.id === targetId)) {
        G.party.push({ id: targetId, name: acc.name, level: acc.level });
        saveGame();
        this.showNotification(`${acc.name} joined your party!`);
        if (typeof GameAudio !== 'undefined') GameAudio.levelUp();
        this.updatePartySidebar();
      }
      // Clean up acceptance signal
      snap.ref.remove();
      db.ref('party_accepted/' + G.playerId + '/' + targetId).off();
    });
  }

  // Check for incoming party requests + buffs
  checkIncomingBuffs() {
    if (db._stub || !G.playerId) return;
    if (this._buffListenerSet) return;
    this._buffListenerSet = true;

    // Listen for buffs sent to us (from Fortune Teller or future systems)
    db.ref('buffs/' + G.playerId).on('child_added', (snap) => {
      const data = snap.val();
      if (!data) return;
      const buffNames = {
        battleBlessing: 'Battle Blessing (+1 dmg)',
        spiritShield: 'Spirit Shield (-1 dmg taken)',
        luckyAura: 'Lucky Aura (+20% recruit)',
        goodFortune: 'Good Fortune',
      };
      this.showNotification(`${data.from} sent you ${buffNames[data.buff] || data.buff}!`);
      if (typeof GameAudio !== 'undefined') GameAudio.levelUp();
      if (!G.activeBuffs) G.activeBuffs = [];
      G.activeBuffs.push({ type: data.buff, from: data.from, fights: 3 });
      saveGame();
      snap.ref.remove();
    });

    // Listen for party requests — show accept/decline popup
    db.ref('party_requests/' + G.playerId).on('child_added', (snap) => {
      const data = snap.val();
      if (!data) return;
      if (typeof GameAudio !== 'undefined') GameAudio.collect();
      this.showPartyInvitePopup(data, snap);
    });
  }

  // ═══════ PARTY INVITE POPUP (accept/decline) ═══════

  showPartyInvitePopup(data, snap) {
    // Dismiss any existing invite popup
    if (this._invitePopup) this._invitePopup.forEach(o => o.destroy());
    this._invitePopup = [];

    const W = this.scale.width;
    const popY = 140;

    const bg = this.add.rectangle(W / 2, popY, 340, 70, 0x112244, 0.92)
      .setStrokeStyle(2, 0x4488cc).setScrollFactor(0).setDepth(500);
    const txt = this.add.text(W / 2, popY - 14, `${data.from} (Lv${data.level}) wants to party up!`, {
      fontSize: '12px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: '#88ccff',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(501);

    const accBg = this.add.rectangle(W / 2 - 55, popY + 16, 90, 28, 0x226622)
      .setStrokeStyle(1, 0x44aa44).setInteractive({ useHandCursor: true }).setScrollFactor(0).setDepth(501);
    const accTxt = this.add.text(W / 2 - 55, popY + 16, 'Accept', {
      fontSize: '12px', fontFamily: 'monospace', fontStyle: 'bold', color: '#88ff88',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(502);

    const decBg = this.add.rectangle(W / 2 + 55, popY + 16, 90, 28, 0x662222)
      .setStrokeStyle(1, 0xaa4444).setInteractive({ useHandCursor: true }).setScrollFactor(0).setDepth(501);
    const decTxt = this.add.text(W / 2 + 55, popY + 16, 'Decline', {
      fontSize: '12px', fontFamily: 'monospace', fontStyle: 'bold', color: '#ff8888',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(502);

    this._invitePopup = [bg, txt, accBg, accTxt, decBg, decTxt];

    const cleanup = () => {
      this._invitePopup.forEach(o => o.destroy());
      this._invitePopup = [];
    };

    accBg.on('pointerdown', () => {
      // Accept — add to our party + notify sender
      if (!G.party) G.party = [];
      if (G.party.length >= 4) {
        this.showNotification('Party is full!');
        cleanup();
        snap.ref.remove();
        return;
      }
      if (!G.party.find(p => p.id === data.fromId)) {
        G.party.push({ id: data.fromId, name: data.from, level: data.level });
        saveGame();
      }
      // Write acceptance so sender knows
      db.ref('party_accepted/' + data.fromId + '/' + G.playerId).set({
        name: G.name, level: G.level, timestamp: Date.now(),
      });
      this.showNotification(`${data.from} joined your party!`);
      if (typeof GameAudio !== 'undefined') GameAudio.levelUp();
      this.updatePartySidebar();
      cleanup();
      snap.ref.remove();
    });

    decBg.on('pointerdown', () => {
      cleanup();
      snap.ref.remove();
    });

    // Auto-dismiss after 15 seconds
    this.time.delayedCall(15000, () => {
      if (this._invitePopup.length > 0) {
        cleanup();
        snap.ref.remove();
      }
    });
  }

  // ═══════ PARTY SIDEBAR (Guild Wars style, right side) ═══════

  buildPartySidebar() {
    this._partySidebarObjs = [];
  }

  updatePartySidebar() {
    // Clean up old sidebar
    if (this._partySidebarObjs) {
      this._partySidebarObjs.forEach(o => o.destroy());
    }
    this._partySidebarObjs = [];

    if (!G.party || G.party.length === 0) return;

    const W = this.scale.width;
    const sidebarW = 170;
    const sx = W - sidebarW / 2 - 8;
    let sy = 130;

    // Background
    const bgH = 40 + G.party.length * 32 + 30;
    const bg = this.add.rectangle(sx, sy + bgH / 2 - 10, sidebarW, bgH, 0x0a0a1a, 0.85)
      .setStrokeStyle(1, 0x334466).setScrollFactor(0).setDepth(190);
    this._partySidebarObjs.push(bg);

    // Header
    const header = this.add.text(sx, sy, `Party [${G.party.length}/4]`, {
      fontSize: '12px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: '#44ff88',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(191);
    this._partySidebarObjs.push(header);
    sy += 20;

    // Members
    G.party.forEach((member, i) => {
      const my = sy + i * 32;
      // Green dot (online indicator — assume online if in party)
      const dot = this.add.circle(sx - sidebarW / 2 + 16, my + 8, 4, 0x44ff88).setScrollFactor(0).setDepth(191);
      const nameTxt = this.add.text(sx - sidebarW / 2 + 28, my, member.name, {
        fontSize: '11px', fontFamily: 'monospace', fontStyle: 'bold', color: '#ccddcc',
      }).setScrollFactor(0).setDepth(191);
      const lvlTxt = this.add.text(sx + sidebarW / 2 - 12, my, `Lv${member.level || '?'}`, {
        fontSize: '9px', fontFamily: 'monospace', color: '#888',
      }).setOrigin(1, 0).setScrollFactor(0).setDepth(191);
      this._partySidebarObjs.push(dot, nameTxt, lvlTxt);
    });

    // Leave Party button
    const leaveY = sy + G.party.length * 32 + 6;
    const leaveBg = this.add.rectangle(sx, leaveY, sidebarW - 20, 22, 0x442222, 0.7)
      .setStrokeStyle(1, 0x664444).setInteractive({ useHandCursor: true }).setScrollFactor(0).setDepth(191);
    const leaveTxt = this.add.text(sx, leaveY, 'Leave Party', {
      fontSize: '10px', fontFamily: 'monospace', color: '#ff8888',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(192);
    leaveBg.on('pointerdown', () => {
      G.party = [];
      saveGame();
      this.updatePartySidebar();
      this.showNotification('Left the party.');
    });
    this._partySidebarObjs.push(leaveBg, leaveTxt);
  }

  // ═══════ CHAT SYSTEM ═══════

  buildChatBox() {
    // scrollFactor(0) — use raw canvas dimensions
    const W = this.scale.width;
    const H = this.scale.height;
    const chatW = Math.min(260, W * 0.4);
    const chatH = 100;
    // Position above the action bar, left-aligned but with generous padding
    const chatX = 20;
    const chatY = H - chatH - 85;

    // Chat container (fixed to screen)
    this._chatBg = this.add.rectangle(chatX + chatW / 2, chatY + chatH / 2, chatW, chatH, 0x0a0a1a, 0.75)
      .setStrokeStyle(1, 0x334466).setScrollFactor(0).setDepth(180);

    // Header
    this._chatHeader = this.add.text(chatX + 8, chatY + 4, 'Chat', {
      fontSize: '10px', fontFamily: 'monospace', fontStyle: 'bold', color: '#88aacc',
    }).setScrollFactor(0).setDepth(181);

    // Messages area
    this._chatMessages = ['Welcome to Battle of Origins!'];
    this._chatMsgTexts = [];
    this._chatMsgY = chatY + 20;
    this._chatMsgX = chatX + 8;
    this._chatMsgW = chatW - 16;
    this._chatMsgMaxLines = 6;

    // Input hint
    this._chatInputHint = this.add.text(chatX + 8, chatY + chatH - 18, 'Press Enter to chat...', {
      fontSize: '10px', fontFamily: 'monospace', color: '#556677',
    }).setScrollFactor(0).setDepth(181);

    // Render the initial welcome message
    this.refreshChatDisplay();

    // Input state
    this._chatOpen = false;
    this._chatInput = '';
    this._chatCursor = null;

    // Enter key to toggle chat input
    this.input.keyboard.on('keydown-ENTER', () => {
      if (G.inBattle) return;
      if (this._chatOpen) {
        // Send message
        if (this._chatInput.trim()) {
          GameChat.send(this._chatInput.trim());
        }
        this._chatInput = '';
        this._chatOpen = false;
        this._chatInputHint.setText('Press Enter to chat...');
        this._chatInputHint.setColor('#556677');
        if (this._chatCursor) { this._chatCursor.destroy(); this._chatCursor = null; }
      } else {
        this._chatOpen = true;
        this._chatInput = '';
        this._chatInputHint.setText('> _');
        this._chatInputHint.setColor('#aaccee');
      }
    });

    // Capture typing when chat is open
    this.input.keyboard.on('keydown', (event) => {
      if (!this._chatOpen) return;
      if (event.key === 'Enter' || event.key === 'Escape') return;
      if (event.key === 'Backspace') {
        this._chatInput = this._chatInput.slice(0, -1);
      } else if (event.key.length === 1 && this._chatInput.length < 120) {
        this._chatInput += event.key;
        event.stopPropagation();
      }
      this._chatInputHint.setText('> ' + this._chatInput + '_');
    });

    // ESC to cancel chat
    this.input.keyboard.on('keydown-ESC', () => {
      if (this._chatOpen) {
        this._chatOpen = false;
        this._chatInput = '';
        this._chatInputHint.setText('Press Enter to chat...');
        this._chatInputHint.setColor('#556677');
      }
    });
  }

  onChatMessage(msg) {
    // Add to display
    const line = `${msg.name}: ${msg.text}`;
    this._chatMessages.push(line);
    if (this._chatMessages.length > this._chatMsgMaxLines) {
      this._chatMessages.shift();
    }
    this.refreshChatDisplay();
  }

  refreshChatDisplay() {
    // Clear old text objects
    this._chatMsgTexts.forEach(t => t.destroy());
    this._chatMsgTexts = [];

    this._chatMessages.forEach((line, i) => {
      const t = this.add.text(this._chatMsgX, this._chatMsgY + i * 18, line, {
        fontSize: '10px', fontFamily: 'monospace', color: '#aabbcc',
        wordWrap: { width: this._chatMsgW },
      }).setScrollFactor(0).setDepth(181);
      this._chatMsgTexts.push(t);
    });
  }

  // Switch chat region when player crosses regions
  updateChatRegion() {
    const region = getCurrentRegion(G.x, G.y) || 'frost_valley';
    if (region !== this._chatRegion) {
      this._chatRegion = region;
      this._chatMessages = [];
      this.refreshChatDisplay();
      GameChat.listenToRegion(region);
      this._chatHeader.setText(`Chat - ${region.replace('_', ' ')}`);
    }
  }

  // ══════════════════════════════════════════════════════
  //  RESPONSIVE HUD — reposition on window resize
  // ══════════════════════════════════════════════════════

  _repositionHUD(W, H) {
    // W, H are raw canvas dimensions (not zoom-divided)
    const btnSize = Math.min(40, Math.floor(W / 14));
    const gap = 4;
    const barBottomPad = 4;
    const barY = H - barBottomPad - btnSize / 2;
    const barH = btnSize + 14;

    // Menu bar
    if (this._menuBtns) {
      const btnW = 68, btnGap = 4;
      const startX = W / 2 - (this._menuBtns.length * (btnW + btnGap)) / 2;
      this._menuBtns.forEach((btn, i) => {
        const x = startX + i * (btnW + btnGap) + btnW / 2;
        btn.bg.setPosition(x, 20);
        btn.label.setPosition(x, 20);
      });
    }

    // Action bar background
    if (this._actionBarBg) this._actionBarBg.setPosition(W / 2, H - barH / 2);
    if (this._actionButtons) {
      const totalW = this._actionButtons.length * (btnSize + gap) - gap;
      const startX = W / 2 - totalW / 2 + btnSize / 2;
      this._actionButtons.forEach((btn, i) => {
        const x = startX + i * (btnSize + gap);
        btn.bg.setPosition(x, barY); btn.bg.setSize(btnSize, btnSize);
        btn.icon.setPosition(x, barY - 8);
        btn.label.setPosition(x, barY + 16);
        btn.statusText.setPosition(x, barY + 28);
      });
    }

    // XP bars
    if (this._xpBars) {
      const xpBarW = 90, xpY = H - 4;
      const xpStartX = W / 2 - (this._xpBars.length * (xpBarW + 4)) / 2;
      this._xpBars.forEach((bar, i) => {
        const bx = xpStartX + i * (xpBarW + 4) + xpBarW / 2;
        bar.barBg.setPosition(bx, xpY);
        bar.barFill.setPosition(bx - xpBarW / 2, xpY);
        bar.barLabel.setPosition(bx, xpY - 6);
      });
    }

    // Buff HUD
    if (this._buffHudText) this._buffHudText.setPosition(W / 2, H - barH - 10);

    // Controls hint
    if (this._controlsHint) this._controlsHint.setPosition(6, H - barH - 6);

    // Minimap — above the action bar on the right
    if (this.minimapBg) {
      const mmW = 120, mmH = 90;
      this.minimapBg.setPosition(W - mmW/2 - 6, H - barH - mmH/2 - 4);
    }
  }

  // ══════════════════════════════════════════════════════
  //  CLASS ACTION BAR (bottom center, MMO-style)
  // ══════════════════════════════════════════════════════

  _buildActionBar() {
    // scrollFactor(0) elements use RAW canvas coords, NOT divided by zoom
    const W = this.scale.width;
    const H = this.scale.height;
    // Scale button size based on viewport — smaller on small screens
    const btnSize = Math.min(40, Math.floor(W / 14));
    const gap = 4;
    const barBottomPad = 4;
    const barY = H - barBottomPad - btnSize / 2;

    // Action definitions
    this._actionButtons = [];
    const actions = [
      { id: 'fortune', label: '★', name: 'Fortune', color: 0x44bbff,
        check: () => typeof canGiveFortune === 'function' && canGiveFortune(),
        action: () => this._useFortuneFromBar(),
        status: () => {
          if (typeof hasActiveFortune === 'function' && hasActiveFortune()) return 'ACTIVE';
          if (typeof isFortuneReady === 'function' && !isFortuneReady()) return getFortuneCooldownSec() + 's';
          return 'READY';
        }
      },
      { id: 'build', label: '⚒', name: 'Build', color: 0xdd9933,
        check: () => typeof isApprentice === 'function' && isApprentice('artisan'),
        action: () => this._showBuildMenu(),
        status: () => 'READY',
      },
      { id: 'garden', label: '❀', name: 'Garden', color: 0x66cc66,
        check: () => typeof isApprentice === 'function' && isApprentice('cultivator'),
        action: () => { if (typeof placeStructure === 'function') this._placementMode('garden'); },
        status: () => 'READY',
      },
      { id: 'extract', label: '⚗', name: 'DNA', color: 0xaa55ff,
        check: () => typeof isApprentice === 'function' && isApprentice('scientist'),
        action: () => { if (typeof notify === 'function') notify('DNA extraction available in battle!'); },
        status: () => 'BATTLE',
      },
      { id: 'recruit', label: '♥', name: 'Recruit', color: 0x44dd66,
        check: () => typeof isApprentice === 'function' && isApprentice('trainer'),
        action: () => { if (typeof notify === 'function') notify('Recruit spiritkin during encounters!'); },
        status: () => 'BATTLE',
      },
    ];

    const visibleActions = actions.filter(a => a.check());
    const totalW = visibleActions.length * (btnSize + gap) - gap;
    const startX = W / 2 - totalW / 2 + btnSize / 2;

    // Dark background bar — hugs the bottom edge, scaled
    const barH = btnSize + 14;
    this._actionBarBg = this.add.rectangle(W / 2, H - barH / 2, Math.min(W - 10, totalW + 30), barH, 0x0a0a1a, 0.9)
      .setStrokeStyle(1, 0x334466).setScrollFactor(0).setDepth(300);

    visibleActions.forEach((a, i) => {
      const x = startX + i * (btnSize + gap);

      const bg = this.add.rectangle(x, barY, btnSize, btnSize, 0x1a1a2e, 0.95)
        .setStrokeStyle(2, a.color).setScrollFactor(0).setDepth(301)
        .setInteractive({ useHandCursor: true });

      const iconSize = Math.max(12, Math.floor(btnSize * 0.45)) + 'px';
      const labelSize = Math.max(7, Math.floor(btnSize * 0.2)) + 'px';
      const icon = this.add.text(x, barY - btnSize * 0.15, a.label, {
        fontSize: iconSize, fontFamily: 'monospace', color: '#ffffff',
      }).setOrigin(0.5).setScrollFactor(0).setDepth(302);

      const label = this.add.text(x, barY + btnSize * 0.3, a.name, {
        fontSize: labelSize, fontFamily: 'monospace', fontStyle: 'bold',
        color: '#' + a.color.toString(16).padStart(6, '0'),
      }).setOrigin(0.5).setScrollFactor(0).setDepth(302);

      const statusText = this.add.text(x, barY + btnSize * 0.45, '', {
        fontSize: labelSize, fontFamily: 'monospace', color: '#888888',
      }).setOrigin(0.5).setScrollFactor(0).setDepth(302);

      bg.on('pointerdown', a.action);
      bg.on('pointerover', () => { bg.setFillStyle(0x333366); bg.setStrokeStyle(3, 0xffffff); });
      bg.on('pointerout', () => { bg.setFillStyle(0x1a1a2e); bg.setStrokeStyle(2, a.color); });

      this._actionButtons.push({ id: a.id, bg, icon, label, statusText, statusFn: a.status, color: a.color });
    });

    // XP bars inside the bar background
    this._xpBars = [];
    const xpSources = [
      { id: 'fortune', name: 'Fortune', color: 0x44bbff, getXP: () => G.fortuneXP || 0 },
      { id: 'crafting', name: 'Craft', color: 0xdd9933, getXP: () => (G.professionXP || {}).crafting || 0 },
      { id: 'combat', name: 'Combat', color: 0x44dd66, getXP: () => (G.professionXP || {}).combat || 0 },
      { id: 'exploration', name: 'Explore', color: 0xaa55ff, getXP: () => (G.professionXP || {}).exploration || 0 },
    ];
    const xpBarW = 90;
    const xpY = H - 4;
    const xpStartX = W / 2 - (xpSources.length * (xpBarW + 4)) / 2;
    xpSources.forEach((xp, i) => {
      const bx = xpStartX + i * (xpBarW + 4) + xpBarW / 2;
      const barBg = this.add.rectangle(bx, xpY, xpBarW, 6, 0x111122, 0.8)
        .setStrokeStyle(1, 0x222244).setScrollFactor(0).setDepth(300);
      const barFill = this.add.rectangle(bx - xpBarW / 2, xpY, 0, 4, xp.color, 0.7)
        .setOrigin(0, 0.5).setScrollFactor(0).setDepth(301);
      const barLabel = this.add.text(bx, xpY - 6, xp.name + ': 0', {
        fontSize: '7px', fontFamily: 'monospace', color: '#556677',
      }).setOrigin(0.5).setScrollFactor(0).setDepth(301);
      this._xpBars.push({ ...xp, barBg, barFill, barLabel, maxW: xpBarW - 2 });
    });
  }

  _updateActionBar() {
    // Update status text on each action button
    if (this._actionButtons) {
      for (const btn of this._actionButtons) {
        const status = btn.statusFn();
        btn.statusText.setText(status);
        btn.statusText.setColor(status === 'READY' ? '#88ff88' : (status === 'ACTIVE' ? '#ffdd44' : '#666688'));
      }
    }
    // Update XP bars
    if (this._xpBars) {
      for (const bar of this._xpBars) {
        const xp = bar.getXP();
        const nextMilestone = Math.max(100, Math.ceil(xp / 100) * 100);
        const progress = (xp % 100) / 100;
        bar.barFill.setSize(Math.max(1, progress * bar.maxW), 6);
        bar.barLabel.setText(bar.name + ': ' + xp);
      }
    }
  }

  _useFortuneFromBar() {
    // Find nearest NPC to give fortune to
    if (!this.npcSprites) return;
    let nearest = null, nearestDist = Infinity;
    for (const npc of this.npcSprites) {
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, npc.x, npc.y);
      if (dist < 100 && dist < nearestDist) { nearest = npc; nearestDist = dist; }
    }
    if (!nearest) {
      if (typeof notify === 'function') notify('Walk near an NPC or player to give a Fortune');
      return;
    }
    // Allow giving multiple fortunes (active fortune doesn't block)
    if (typeof isFortuneReady === 'function' && !isFortuneReady()) {
      if (typeof notify === 'function') notify('Fortune on cooldown: ' + getFortuneCooldownSec() + 's');
      return;
    }
    const result = giveFortune(nearest.name, false);
    if (result) {
      const color = result.type === 'good' ? '#88ff44' : '#ff6666';
      const icon = result.type === 'good' ? '★' : '☆';
      const floatText = this.add.text(nearest.x, nearest.y - 16, icon + ' ' + result.name + ' ' + icon, {
        fontSize: '12px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: color,
        backgroundColor: '#000000cc', padding: { x: 6, y: 3 },
      }).setOrigin(0.5).setDepth(100);
      this.tweens.add({ targets: floatText, y: nearest.y - 60, alpha: 0, duration: 2000, ease: 'Power2', onComplete: () => floatText.destroy() });
      const descText = this.add.text(nearest.x, nearest.y, result.desc, {
        fontSize: '9px', fontFamily: 'monospace', color: '#aaaacc',
        backgroundColor: '#000000aa', padding: { x: 4, y: 2 },
      }).setOrigin(0.5).setDepth(100);
      this.tweens.add({ targets: descText, y: nearest.y - 30, alpha: 0, duration: 2500, delay: 500, ease: 'Power2', onComplete: () => descText.destroy() });
      GameAudio.collect();
      if (result.darkRiderUnlocked) {
        this.time.delayedCall(1500, () => {
          const drText = this.add.text(this.scale.width / 2, this.scale.height / 2, 'The darkness you\'ve sown has taken root within you...', {
            fontSize: '16px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: '#cc2244',
            backgroundColor: '#000000dd', padding: { x: 20, y: 12 },
          }).setOrigin(0.5).setScrollFactor(0).setDepth(500);
          this.tweens.add({ targets: drText, alpha: 0, duration: 5000, delay: 3000, onComplete: () => drText.destroy() });
        });
      }
    }
  }

  // ══════════════════════════════════════════════════════
  //  BUFF HUD
  // ══════════════════════════════════════════════════════

  _updateBuffHUD() {
    if (!this._buffHudText || typeof getActiveBuffs !== 'function') return;
    const buffs = getActiveBuffs();
    if (buffs.length === 0) { this._buffHudText.setVisible(false); return; }
    let text = '';
    for (const b of buffs) {
      const remaining = b.expiresAt > 0 ? Math.ceil((b.expiresAt - Date.now()) / 1000) : '∞';
      const timeStr = typeof remaining === 'number' ? (remaining > 60 ? Math.ceil(remaining / 60) + 'm' : remaining + 's') : remaining;
      text += b.icon + ' ' + b.name + ' (' + timeStr + ')  ';
    }
    this._buffHudText.setText(text.trim());
    this._buffHudText.setVisible(true);
  }

  // ══════════════════════════════════════════════════════
  //  STRUCTURE RENDERING + INTERACTION
  // ══════════════════════════════════════════════════════

  _renderStructures() {
    if (this._structureSprites) {
      this._structureSprites.forEach(s => { if (s.rect) s.rect.destroy(); if (s.label) s.label.destroy(); });
    }
    this._structureSprites = [];
    if (!G.structures || typeof STRUCTURE_TYPES === 'undefined') return;
    const T = 32;
    for (const s of G.structures) {
      const info = STRUCTURE_TYPES[s.type];
      if (!info) continue;
      const px = s.x * T + (info.w * T) / 2;
      const py = s.y * T + (info.h * T) / 2;
      const rect = this.add.rectangle(px, py, info.w * T, info.h * T, info.color, 0.4)
        .setStrokeStyle(1, info.color).setDepth(3);
      const label = this.add.text(px, py - 4, info.icon + ' ' + info.name, {
        fontSize: '8px', fontFamily: 'monospace', fontStyle: 'bold', color: '#ffffff',
        backgroundColor: '#00000088', padding: { x: 2, y: 1 },
      }).setOrigin(0.5).setDepth(4);
      this._structureSprites.push({ id: s.id, rect, label });
    }
  }

  _checkStructureProximity() {
    if (typeof getStructuresNear !== 'function') return;
    if (!this._ePressed || this._eConsumed) return;
    if (this.panels.isOpen() || (this.comm && this.comm.isActive)) return;

    const nearby = getStructuresNear(Math.floor(G.x), Math.floor(G.y), 2);
    for (const s of nearby) {
      if (s.type === 'garden') {
        this._eConsumed = true;
        this.showGardenPanel(s);
        return;
      }
    }
  }

  // ═══════ GARDEN INTERACTION PANEL ═══════

  showGardenPanel(structure) {
    if (this.panels.isOpen()) { this.panels.close(); return; }
    if (typeof ensureGardenData !== 'function') return;
    GameAudio.menuOpen();

    const status = typeof getGardenStatus === 'function' ? getGardenStatus(structure.id) : [];
    const isOwner = structure.owner === G.playerId;

    this.panels.open('❀ Garden', (container, w, h) => {
      let y = 8;

      // Owner info
      container.add(this.add.text(w / 2, y, isOwner ? 'Your Garden' : `${structure.ownerName}'s Garden`, {
        fontSize: '11px', fontFamily: 'Georgia, serif', fontStyle: 'italic', color: '#88cc88',
      }).setOrigin(0.5).setScrollFactor(0));
      y += 22;

      // Plants
      if (status.length === 0) {
        container.add(this.add.text(w / 2, y, 'Empty — no plants yet', {
          fontSize: '11px', fontFamily: 'monospace', color: '#888888',
        }).setOrigin(0.5).setScrollFactor(0));
        y += 20;
      } else {
        status.forEach(plant => {
          // Plant name + progress bar
          container.add(this.add.text(20, y, plant.name, {
            fontSize: '11px', fontFamily: 'monospace', color: plant.color,
          }).setOrigin(0, 0.5).setScrollFactor(0));

          // Progress bar
          const barW = 100, barH = 8;
          const barX = w - 30 - barW;
          container.add(this.add.rectangle(barX + barW/2, y, barW, barH, 0x333333).setScrollFactor(0));
          const fillW = barW * plant.progress;
          const fillColor = plant.ready ? 0x44dd44 : 0x668844;
          if (fillW > 0) {
            container.add(this.add.rectangle(barX + fillW/2, y, fillW, barH, fillColor).setScrollFactor(0));
          }
          container.add(this.add.text(w - 20, y, plant.ready ? '✓' : `${Math.floor(plant.progress * 100)}%`, {
            fontSize: '9px', fontFamily: 'monospace', color: plant.ready ? '#44dd44' : '#aaaaaa',
          }).setOrigin(1, 0.5).setScrollFactor(0));

          y += 18;
        });
      }

      y += 8;

      // Buttons (only for owner)
      if (isOwner) {
        // Plant button
        if (status.length < 4) {
          const seeds = ['frost_seed', 'ember_seed', 'spirit_seed', 'moon_seed'];
          const seedNames = { frost_seed: '❄ Frost', ember_seed: '🔥 Ember', spirit_seed: '✦ Spirit', moon_seed: '☽ Moon' };
          seeds.forEach((seed, i) => {
            const btnX = 20 + i * 72;
            const btn = this.add.rectangle(btnX + 30, y + 14, 62, 26, 0x224422, 0.9)
              .setStrokeStyle(1, 0x448844).setInteractive({ useHandCursor: true }).setScrollFactor(0);
            container.add(btn);
            container.add(this.add.text(btnX + 30, y + 14, seedNames[seed], {
              fontSize: '9px', fontFamily: 'monospace', fontStyle: 'bold', color: '#88ff88',
            }).setOrigin(0.5).setScrollFactor(0));
            btn.on('pointerdown', () => {
              if (typeof plantInGarden === 'function') {
                plantInGarden(structure.id, seed);
                this.panels.close();
                this.showNotification('Planted!');
              }
            });
          });
          y += 36;
        }

        // Harvest button
        const readyCount = status.filter(p => p.ready).length;
        if (readyCount > 0) {
          const hvBtn = this.add.rectangle(w / 2, y + 14, w - 40, 30, 0x225522, 0.9)
            .setStrokeStyle(2, 0x44aa44).setInteractive({ useHandCursor: true }).setScrollFactor(0);
          container.add(hvBtn);
          container.add(this.add.text(w / 2, y + 14, `Harvest (${readyCount} ready)`, {
            fontSize: '13px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: '#44ff44',
          }).setOrigin(0.5).setScrollFactor(0));
          hvBtn.on('pointerdown', () => {
            if (typeof harvestGarden === 'function') {
              const harvested = harvestGarden(structure.id);
              this.panels.close();
              harvested.forEach(h => this.showNotification(`+${h.amount} ${h.resource}!`));
              if (typeof GameAudio !== 'undefined') GameAudio.collect();
            }
          });
          y += 36;
        }

        // Meditate button (Shaman talent)
        if (typeof getTalentRank === 'function' && getTalentRank('shaman', 'shm_grd_1') >= 1) {
          const medBtn = this.add.rectangle(w / 2, y + 14, w - 40, 30, 0x222255, 0.9)
            .setStrokeStyle(2, 0x6666cc).setInteractive({ useHandCursor: true }).setScrollFactor(0);
          container.add(medBtn);
          container.add(this.add.text(w / 2, y + 14, '🧘 Meditate (+1 die buff)', {
            fontSize: '12px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: '#aaccff',
          }).setOrigin(0.5).setScrollFactor(0));
          medBtn.on('pointerdown', () => {
            if (typeof addBuff === 'function') {
              const duration = getTalentRank('shaman', 'shm_grd_3') >= 1 ? 30 : 10;
              addBuff('meditation', duration);
              this.panels.close();
              this.showNotification(`Meditation: +1 die for ${duration} min`);
              if (typeof GameAudio !== 'undefined') GameAudio.heal();
            }
          });
        }
      }
    }, { width: 340, height: 260 });
  }

  // ═══════ SPIRIT PET FOLLOWER ═══════

  updateSpiritPet() {
    if (!G.spiritPet || !this.player) return;

    // Create pet sprite if not exists
    if (!this._petSprite) {
      this._petSprite = this.add.circle(this.player.x - 20, this.player.y - 10, 5, 0xaa66ff, 0.7).setDepth(9);
      this._petGlow = this.add.circle(this.player.x - 20, this.player.y - 10, 8, 0xaa66ff, 0.15).setDepth(8);
      this._petLabel = this.add.text(this.player.x - 20, this.player.y - 22, G.spiritPet.name, {
        fontSize: '7px', fontFamily: 'monospace', color: '#cc88ff',
      }).setOrigin(0.5).setDepth(10);

      // Pulse glow
      this.tweens.add({ targets: this._petGlow, scaleX: 1.5, scaleY: 1.5, alpha: 0.05, duration: 1500, yoyo: true, repeat: -1 });
    }

    // Lerp pet toward player (trails behind with smooth motion)
    const targetX = this.player.x - 20;
    const targetY = this.player.y - 10;
    this._petSprite.x += (targetX - this._petSprite.x) * 0.06;
    this._petSprite.y += (targetY - this._petSprite.y) * 0.06;
    this._petGlow.setPosition(this._petSprite.x, this._petSprite.y);
    this._petLabel.setPosition(this._petSprite.x, this._petSprite.y - 12);
  }

  // ═══════ NATURE'S CALM PASSIVE HEAL ═══════

  updateNaturesCalmHeal() {
    if (typeof checkNaturesCalmHeal !== 'function') return;
    if (!this._lastHealCheck) this._lastHealCheck = 0;
    const now = Date.now();
    if (now - this._lastHealCheck < 120000) return; // every 2 minutes
    this._lastHealCheck = now;

    if (checkNaturesCalmHeal()) {
      this.showNotification('Nature\'s Calm: +1 HP');
      if (typeof GameAudio !== 'undefined') GameAudio.heal();
    }
  }

  // ══════════════════════════════════════════════════════
  //  BUILD MENU (B key)
  // ══════════════════════════════════════════════════════

  _showBuildMenu() {
    if (typeof getBuildableStructures !== 'function') return;
    const buildable = getBuildableStructures();
    if (buildable.length === 0) {
      if (typeof notify === 'function') notify('No structures available. Learn Artisan or Cultivator skills first.');
      return;
    }
    GameAudio.menuOpen();
    this.panels.open('BUILD', (container, panelW, panelH) => {
      let y = 10;
      const title = this.add.text(panelW / 2, y, 'Select a structure to build', {
        fontSize: '12px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: '#ffdd44',
      }).setOrigin(0.5, 0);
      container.add(title);
      y += 28;
      for (const item of buildable) {
        const row = this.add.rectangle(panelW / 2, y + 16, panelW - 20, 32, 0x222244, 0.8)
          .setStrokeStyle(1, item.color).setInteractive({ useHandCursor: true });
        container.add(row);
        const txt = this.add.text(14, y + 8, item.icon + '  ' + item.name, {
          fontSize: '11px', fontFamily: 'Georgia, serif', fontStyle: 'bold',
          color: '#' + item.color.toString(16).padStart(6, '0'),
        });
        container.add(txt);
        const desc = this.add.text(panelW - 14, y + 20, item.desc, {
          fontSize: '8px', fontFamily: 'monospace', color: '#888899',
        }).setOrigin(1, 0.5);
        container.add(desc);
        row.on('pointerover', () => row.setFillStyle(0x333366));
        row.on('pointerout', () => row.setFillStyle(0x222244));
        row.on('pointerdown', () => { this.panels.close(); this._placementMode(item.type); });
        y += 38;
      }
    }, { width: 400, height: Math.min(500, 60 + buildable.length * 38) });
  }

  _placementMode(structureType) {
    const info = STRUCTURE_TYPES[structureType];
    if (!info) return;
    const T = 32;
    const ghost = this.add.rectangle(0, 0, info.w * T, info.h * T, info.color, 0.3)
      .setStrokeStyle(2, 0xffffff).setDepth(500);
    const ghostLabel = this.add.text(0, -20, 'Click to place ' + info.name + ' (ESC to cancel)', {
      fontSize: '10px', fontFamily: 'monospace', color: '#ffffff',
      backgroundColor: '#000000cc', padding: { x: 6, y: 3 },
    }).setOrigin(0.5).setDepth(501);
    const moveHandler = (pointer) => {
      const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const tx = Math.floor(worldPoint.x / T);
      const ty = Math.floor(worldPoint.y / T);
      ghost.setPosition(tx * T + (info.w * T) / 2, ty * T + (info.h * T) / 2);
      ghostLabel.setPosition(ghost.x, ghost.y - (info.h * T) / 2 - 14);
    };
    const clickHandler = (pointer) => {
      const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const tx = Math.floor(worldPoint.x / T);
      const ty = Math.floor(worldPoint.y / T);
      const result = placeStructure(structureType, tx, ty);
      if (result) {
        ghost.destroy(); ghostLabel.destroy();
        this.input.off('pointermove', moveHandler);
        this.input.off('pointerdown', clickHandler);
        this.input.keyboard.off('keydown-ESC', escHandler);
        this._renderStructures();
        GameAudio.collect();
        if (typeof notify === 'function') notify(info.name + ' placed!');
      } else {
        if (typeof notify === 'function') notify('Can\'t build here — overlapping structure');
      }
    };
    const escHandler = () => {
      ghost.destroy(); ghostLabel.destroy();
      this.input.off('pointermove', moveHandler);
      this.input.off('pointerdown', clickHandler);
      this.input.keyboard.off('keydown-ESC', escHandler);
    };
    this.input.on('pointermove', moveHandler);
    this.input.on('pointerdown', clickHandler);
    this.input.keyboard.on('keydown-ESC', escHandler);
  }
}
