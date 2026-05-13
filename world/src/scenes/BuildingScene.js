// ═══════════════════════════════════════════════════
// BUILDING SCENE — Interior rooms for hub buildings
// Player enters via door tile, interacts with NPC inside
// ═══════════════════════════════════════════════════

const BUILDING_LAYOUTS = {
  inn: {
    name: 'The Frosty Inn',
    npcName: 'Innkeeper Mira',
    npcTint: 0xdaa520,
    floorColor: 0x5a4a3a,
    wallColor: 0x3a2a1a,
    accentColor: 0x6a5a4a,
    furniture: [
      { type: 'rect', x: 2, y: 2, w: 2, h: 1, color: 0x4a3a2a, label: 'Bed' },
      { type: 'rect', x: 8, y: 2, w: 2, h: 1, color: 0x4a3a2a, label: 'Bed' },
      { type: 'rect', x: 5, y: 5, w: 1, h: 1, color: 0x5a4a3a, label: 'Table' },
      { type: 'rect', x: 4, y: 5, w: 1, h: 1, color: 0x3a3a3a, label: 'Chair' },
      { type: 'rect', x: 6, y: 5, w: 1, h: 1, color: 0x3a3a3a, label: 'Chair' },
    ],
    counterY: 1,
  },
  workshop: {
    name: 'The Forge',
    npcName: 'Smith Ember',
    npcTint: 0xe07020,
    floorColor: 0x4a4a4a,
    wallColor: 0x2a2a2a,
    accentColor: 0x5a3a2a,
    furniture: [
      { type: 'rect', x: 2, y: 3, w: 1, h: 1, color: 0x884422, label: 'Anvil' },
      { type: 'rect', x: 9, y: 3, w: 1, h: 1, color: 0xcc4400, label: 'Forge' },
      { type: 'rect', x: 3, y: 6, w: 2, h: 1, color: 0x554433, label: 'Workbench' },
      { type: 'rect', x: 7, y: 6, w: 2, h: 1, color: 0x443322, label: 'Storage' },
    ],
    counterY: 1,
  },
  arena: {
    name: 'Polaris Arena',
    npcName: 'Arena Master Voss',
    npcTint: 0xcc4444,
    floorColor: 0x8a7a5a,
    wallColor: 0x554433,
    accentColor: 0x665544,
    furniture: [
      { type: 'rect', x: 3, y: 4, w: 1, h: 1, color: 0x664422, label: 'Dummy' },
      { type: 'rect', x: 8, y: 4, w: 1, h: 1, color: 0x664422, label: 'Dummy' },
      { type: 'rect', x: 5, y: 3, w: 2, h: 2, color: 0x887755, label: 'Ring' },
    ],
    counterY: 1,
  },
  cantina: {
    name: 'The Frozen Mug',
    npcName: 'Bartender Grix',
    npcTint: 0x66aa88,
    floorColor: 0x3a3028,
    wallColor: 0x2a2018,
    accentColor: 0x4a3a2a,
    furniture: [
      { type: 'rect', x: 2, y: 4, w: 1, h: 1, color: 0x443322, label: 'Table' },
      { type: 'rect', x: 4, y: 5, w: 1, h: 1, color: 0x443322, label: 'Table' },
      { type: 'rect', x: 8, y: 4, w: 1, h: 1, color: 0x443322, label: 'Table' },
      { type: 'rect', x: 7, y: 6, w: 1, h: 1, color: 0x443322, label: 'Stool' },
    ],
    counterY: 1,
  },
  dungeons: {
    name: 'The Dungeons',
    npcName: 'Dungeon Keeper Vex',
    npcTint: 0x553355,
    floorColor: 0x2a2030,
    wallColor: 0x1a1020,
    accentColor: 0x3a2a3a,
    furniture: [
      { type: 'rect', x: 2, y: 4, w: 1, h: 1, color: 0x1a1018, label: 'Chest' },
      { type: 'rect', x: 9, y: 4, w: 1, h: 1, color: 0x1a1018, label: 'Chest' },
      { type: 'rect', x: 5, y: 5, w: 2, h: 2, color: 0x332233, label: 'Stairs' },
    ],
    counterY: 1,
  },
};

class BuildingScene extends Phaser.Scene {
  constructor() { super('BuildingScene'); }

  init(data) {
    this.buildingType = data.building;
    this.returnX = data.returnX;
    this.returnY = data.returnY;
    this.roomId = data.roomId || null;
  }

  create() {
    // Prefer ROOM_CONFIGS (zone-specific), fall back to legacy BUILDING_LAYOUTS
    const layout = (this.roomId && typeof ROOM_CONFIGS !== 'undefined' && ROOM_CONFIGS[this.roomId])
      ? ROOM_CONFIGS[this.roomId]
      : BUILDING_LAYOUTS[this.buildingType];
    if (!layout) { this.exitBuilding(); return; }

    const T = 32;
    const roomW = (layout.size && layout.size.w) || 12;
    const roomH = (layout.size && layout.size.h) || 9;
    const W = this.scale.width;
    const H = this.scale.height;

    // Normalize room config (support both legacy BUILDING_LAYOUTS and ROOM_CONFIGS formats)
    const npcName = npcName || (layout.npc && layout.npc.name) || 'NPC';
    const npcTint = npcTint || (layout.npc && layout.npc.tint) || 0xffffff;
    const roomName = layout.name || this.buildingType;

    // Center the room in viewport
    const ox = Math.floor((W - roomW * T) / 2);
    const oy = Math.floor((H - roomH * T) / 2);

    // Background
    this.cameras.main.setBackgroundColor('#0a0a14');

    // ── Draw room ──
    const gfx = this.add.graphics();

    // Floor
    for (let y = 0; y < roomH; y++) {
      for (let x = 0; x < roomW; x++) {
        const isWall = y === 0 || x === 0 || x === roomW - 1;
        const color = isWall ? layout.wallColor : layout.floorColor;
        gfx.fillStyle(color, 1);
        gfx.fillRect(ox + x * T, oy + y * T, T, T);
        // Subtle grid
        gfx.lineStyle(1, 0x000000, 0.15);
        gfx.strokeRect(ox + x * T, oy + y * T, T, T);
      }
    }

    // Counter/desk at top
    const counterW = 6;
    const counterX = Math.floor((roomW - counterW) / 2);
    gfx.fillStyle(layout.accentColor, 1);
    for (let x = counterX; x < counterX + counterW; x++) {
      gfx.fillRect(ox + x * T, oy + layout.counterY * T, T, T);
    }
    gfx.lineStyle(2, 0x000000, 0.3);
    gfx.strokeRect(ox + counterX * T, oy + layout.counterY * T, counterW * T, T);

    // Furniture
    for (const f of layout.furniture) {
      gfx.fillStyle(f.color, 1);
      gfx.fillRect(ox + f.x * T, oy + f.y * T, f.w * T, f.h * T);
      if (f.label) {
        this.add.text(ox + f.x * T + (f.w * T) / 2, oy + f.y * T + (f.h * T) / 2, f.label, {
          fontSize: '8px', fontFamily: 'monospace', color: '#888',
        }).setOrigin(0.5).setDepth(2);
      }
    }

    // ── Door (bottom center) ──
    const doorX = Math.floor(roomW / 2);
    const doorY = roomH - 1;
    gfx.fillStyle(0x664422, 1);
    gfx.fillRect(ox + doorX * T - T / 2, oy + doorY * T, T * 2, T);
    this.add.text(ox + doorX * T + T / 2, oy + doorY * T + T / 2, 'EXIT', {
      fontSize: '10px', fontFamily: 'monospace', fontStyle: 'bold', color: '#ffcc44',
    }).setOrigin(0.5).setDepth(5);

    // ── Room title ──
    this.add.text(ox + (roomW * T) / 2, oy - 20, layout.name, {
      fontSize: '18px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: '#ffdd44',
      shadow: { offsetX: 1, offsetY: 1, color: '#000', blur: 4, fill: true },
    }).setOrigin(0.5).setDepth(5);

    // ── NPC (behind counter) ──
    const npcPX = ox + (roomW / 2) * T;
    const npcPY = oy + (layout.counterY - 0.2) * T;
    this.npc = this.add.sprite(npcPX, npcPY, 'npc_knight', 0).setScale(2.5).setTint(npcTint).setDepth(3);
    this.add.text(npcPX, npcPY - 28, npcName, {
      fontSize: '10px', fontFamily: 'monospace', fontStyle: 'bold', color: '#88ff88',
      backgroundColor: '#00000088', padding: { x: 3, y: 1 },
    }).setOrigin(0.5).setDepth(4);

    // ── Player ──
    const playerStartX = ox + (roomW / 2) * T;
    const playerStartY = oy + (roomH - 2.5) * T;
    const playerTex = (G.spriteKey && this.textures.exists(G.spriteKey)) ? G.spriteKey : 'player';
    this.player = this.add.sprite(playerStartX, playerStartY, playerTex, 0).setScale(2.5).setDepth(10);
    this._playerMarker = this.add.circle(playerStartX, playerStartY, 18, 0x44aaff, 0.4).setDepth(9);

    // ── Controls ──
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys('W,A,S,D');
    this.eKey = this.input.keyboard.addKey('E');

    // ── State ──
    this._roomBounds = { left: ox + T, top: oy + 2 * T, right: ox + (roomW - 1) * T, bottom: oy + (roomH - 1) * T };
    this._doorRect = { x: ox + (doorX - 0.5) * T, y: oy + (doorY - 0.3) * T, w: T * 2, h: T * 1.3 };
    this._npcRect = { x: npcPX - 40, y: npcPY + T * 0.5, w: 80, h: T };
    this._interacted = false;

    // ── Hint ──
    this._hintText = this.add.text(ox + (roomW * T) / 2, oy + roomH * T + 14, 'WASD: Move | E: Talk to ' + npcName + ' | Walk to EXIT to leave', {
      fontSize: '11px', fontFamily: 'monospace', color: '#888',
    }).setOrigin(0.5).setDepth(5);

    // [E] hint near NPC
    this._npcHint = this.add.text(npcPX, npcPY + 22, '', {
      fontSize: '10px', fontFamily: 'monospace', fontStyle: 'bold', color: '#ffffff',
      backgroundColor: '#000000aa', padding: { x: 3, y: 1 },
    }).setOrigin(0.5).setDepth(12);

    if (typeof GameAudio !== 'undefined') GameAudio.menuOpen();
  }

  update() {
    if (!this.player) return;

    // Movement
    const speed = 3;
    let dx = 0, dy = 0;
    if (this.cursors.left.isDown || this.wasd.A.isDown) dx = -speed;
    else if (this.cursors.right.isDown || this.wasd.D.isDown) dx = speed;
    if (this.cursors.up.isDown || this.wasd.W.isDown) dy = -speed;
    else if (this.cursors.down.isDown || this.wasd.S.isDown) dy = speed;

    let nx = this.player.x + dx;
    let ny = this.player.y + dy;

    // Clamp to room bounds
    nx = Math.max(this._roomBounds.left, Math.min(this._roomBounds.right, nx));
    ny = Math.max(this._roomBounds.top, Math.min(this._roomBounds.bottom, ny));
    this.player.setPosition(nx, ny);
    this._playerMarker.setPosition(nx, ny);

    // Check NPC proximity
    const distToNPC = Math.abs(nx - (this._npcRect.x + this._npcRect.w / 2)) + Math.abs(ny - this._npcRect.y);
    if (distToNPC < 60) {
      this._npcHint.setText('[E]');
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) {
        this.handleNPCInteraction();
      }
    } else {
      this._npcHint.setText('');
    }

    // Check door proximity (exit)
    const dr = this._doorRect;
    if (nx > dr.x && nx < dr.x + dr.w && ny > dr.y && ny < dr.y + dr.h) {
      this.exitBuilding();
    }
  }

  handleNPCInteraction() {
    const type = this.buildingType;
    if (type === 'inn') {
      this.interactInn();
    } else if (type === 'workshop') {
      this.scene.launch('CraftScene', { returnScene: 'BuildingScene' });
      this.scene.pause();
    } else if (type === 'arena') {
      this.interactArena();
    } else if (type === 'cantina') {
      this.interactCantina();
    } else if (type === 'dungeons') {
      this.interactDungeons();
    }
  }

  interactInn() {
    if (this._panel) return;
    const allFull = G.team.every(g => g.hp >= g.maxHp);
    if (allFull) {
      this.showMessage('Your team is already at full health!');
      return;
    }
    if (G.coins < 5) {
      this.showMessage('Not enough gold! (Need 5)');
      return;
    }
    G.coins -= 5;
    for (const ghost of G.team) { ghost.hp = ghost.maxHp; ghost.ko = false; }
    saveGame();
    if (typeof GameAudio !== 'undefined') GameAudio.heal();
    this.showMessage('Your team has been fully healed! (-5 Gold)');
  }

  interactArena() {
    // Launch arena battle
    G.inBattle = true;
    const arenaCards = ALL_CARDS.filter(c => c.rarity === 'rare' || c.rarity === 'legendary');
    const pick = () => arenaCards[Math.floor(Math.random() * arenaCards.length)];
    const enemyGhosts = [];
    for (let i = 0; i < 3; i++) {
      const card = pick();
      if (!card) continue;
      const scaledHp = Math.round(card.maxHp * (1 + (G.level - 1) * 0.1));
      enemyGhosts.push({
        id: card.id, name: card.name, hp: scaledHp, maxHp: scaledHp,
        ko: false, ability: card.ability, abilityDesc: card.desc, rarity: card.rarity,
        usedOncePerGame: false, entryFired: false
      });
    }
    if (enemyGhosts.length === 0) { G.inBattle = false; return; }
    const playerGhosts = buildPlayerBattleTeam();
    const _res = { iceShards: 0, sacredFire: 0, healingSeeds: 0, luckyStones: 0, surge: 0, moonstone: 0, firefly: 0 };
    B = {
      round: 1, player: { ghosts: playerGhosts, activeIdx: 0, resources: { ..._res } },
      enemy: { ghosts: enemyGhosts, activeIdx: 0, resources: {} },
      enemyCard: enemyGhosts[0], zoneIdx: -1, phase: 'ready', log: [],
      playerDice: [], enemyDice: [], resources: { ..._res }, committed: {},
      nextRoundMods: { playerExtraDice: 0, enemyExtraDice: 0, playerMaxDice: 99, enemyMaxDice: 99 },
    };
    this._arenaWinsBefore = G.rep?.battlesWon || 0;
    this.scene.launch('BattleScene', { trainerName: 'Arena Champion', returnScene: 'BuildingScene' });
    this.scene.pause();
    // Listen for resume (battle ended)
    this.events.once('resume', () => {
      G.inBattle = false;
      if ((G.rep?.battlesWon || 0) > this._arenaWinsBefore) {
        G.coins += 50;
        G.arenaWins = (G.arenaWins || 0) + 1;
        if (typeof checkAndNotifyTitles === 'function') checkAndNotifyTitles();
        saveGame();
        this.showMessage('Arena Victory! +50 Gold!');
      }
    });
  }

  interactCantina() {
    const tips = [
      'They say the World Boss drops rare essences...',
      'Craft at the Workshop for powerful gear.',
      'Black Riders only appear at night. Be careful.',
      'Feed your team essences to heal between battles.',
      'The Dark Castle holds the strongest Spiritkin.',
      'Collect all four lore tablets for a special title.',
      'Higher zone quality means better essence drops.',
    ];
    this.showMessage(tips[Math.floor(Math.random() * tips.length)]);
  }

  interactDungeons() {
    this.showMessage('The dungeons are sealed for now. Come back later, traveler...');
  }

  showMessage(text) {
    if (this._msgText) this._msgText.destroy();
    if (this._msgBg) this._msgBg.destroy();

    const W = this.scale.width;
    const y = this.scale.height / 2;
    this._msgBg = this.add.rectangle(W / 2, y, W * 0.7, 50, 0x000000, 0.85)
      .setStrokeStyle(1, 0x4466aa).setDepth(100);
    this._msgText = this.add.text(W / 2, y, text, {
      fontSize: '14px', fontFamily: 'Georgia, serif', color: '#ffffff',
      wordWrap: { width: W * 0.65 },
    }).setOrigin(0.5).setDepth(101);

    this.time.delayedCall(2500, () => {
      if (this._msgText) { this._msgText.destroy(); this._msgText = null; }
      if (this._msgBg) { this._msgBg.destroy(); this._msgBg = null; }
    });
  }

  exitBuilding() {
    if (typeof GameAudio !== 'undefined') GameAudio.menuOpen();
    this.cameras.main.fadeOut(300);
    this.time.delayedCall(300, () => {
      this.scene.stop();
      this.scene.resume('WorldScene');
      const ws = this.scene.get('WorldScene');
      if (ws) ws.cameras.main.fadeIn(300);
    });
  }
}
