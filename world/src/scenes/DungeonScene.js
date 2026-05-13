// ═══════════════════════════════════════════════════════════════
// DUNGEON SCENE — Shared scene for ALL dungeons.
// Reads a config from DUNGEONS (dungeon-configs.js) and runs the dungeon.
// Architecture: each system is a separate small block so you can change
// one (e.g. KO modal, room-clear rules) without touching the others.
//
// Systems:
//   _buildMap()         — parse mapAscii into a tile grid, render once
//   _spawnPlayer()      — place player at entry, camera follow
//   _spawnEnemies()     — create mob + boss sprites from config
//   _handleMovement()   — WASD + wall/door collision
//   _checkAggro()       — walk into mob -> launch battle
//   _onBattleEnd()      — react to win (defeat mob, heal, open doors) / loss (KO)
//   _showKOModal()      — KO'd avatar overlay + "Leave Dungeon" button
//   _spawnStaircase()   — appears after boss dies
//   _exitDungeon()      — fade back to overworld entry, apply gold loss
// ═══════════════════════════════════════════════════════════════

class DungeonScene extends Phaser.Scene {
  constructor() { super('DungeonScene'); }

  init(data) {
    this.dungeonId = data.dungeonId;
    this.config = getDungeonConfig(this.dungeonId);
    this.returnX = data.returnX; // overworld pixel coords to drop the player at on exit
    this.returnY = data.returnY;
  }

  create() {
    if (!this.config) {
      console.error('[DungeonScene] No config; bailing back to overworld.');
      this._exitDungeon({ reason: 'bug' });
      return;
    }

    this.T = 32; // tile size in px

    // Parse map and runtime state
    this._parseMap();
    this._state = {
      defeatedMobs: new Set(),  // mobIds
      bossDefeated: false,
      doorsOpen: new Set(),     // door indices that have opened
      koActive: false,          // is the player currently in the KO modal?
    };

    // Camera background
    this.cameras.main.setBackgroundColor(this.config.palette.bg);

    this._buildMap();
    this._spawnEnemies();
    this._spawnPlayer();
    this._setupInput();
    this._setupHUD();
    this._setupResumeHandler();

    // Hide overworld DOM HUD (chat input etc.)
    const hud = document.getElementById('hud-overlay');
    if (hud) hud.style.display = 'none';

    this.cameras.main.fadeIn(400, 0, 0, 0);
  }

  // ═══════════════════════════════════════════════════════════
  //  MAP PARSING + RENDERING
  // ═══════════════════════════════════════════════════════════
  _parseMap() {
    const ascii = this.config.mapAscii;
    this.mapH = ascii.length;
    this.mapW = ascii[0].length;
    this.grid = []; // grid[y][x] = D_TILE value
    this.entry = null;
    this.stairsSlot = null;

    for (let y = 0; y < this.mapH; y++) {
      this.grid[y] = [];
      const row = ascii[y];
      for (let x = 0; x < this.mapW; x++) {
        const ch = row[x] || '#';
        let t = D_TILE.WALL;
        if (ch === '.') t = D_TILE.FLOOR;
        else if (ch === '#') t = D_TILE.WALL;
        else if (ch === '|') t = D_TILE.DOOR_CLOSED;
        else if (ch === 'E') { t = D_TILE.FLOOR; this.entry = { x, y }; }
        else if (ch === 'S') { t = D_TILE.FLOOR; this.stairsSlot = { x, y }; }
        this.grid[y][x] = t;
      }
    }
  }

  _buildMap() {
    const T = this.T;
    const p = this.config.palette;
    const g = this.add.graphics();
    for (let y = 0; y < this.mapH; y++) {
      for (let x = 0; x < this.mapW; x++) {
        const t = this.grid[y][x];
        let color;
        if (t === D_TILE.WALL) color = p.wall;
        else if (t === D_TILE.DOOR_CLOSED) color = p.doorClosed;
        else if (t === D_TILE.DOOR_OPEN) color = p.doorOpen;
        else color = p.floor;
        g.fillStyle(color, 1);
        g.fillRect(x * T, y * T, T, T);
        // Subtle floor speckle for texture
        if (t === D_TILE.FLOOR && ((x + y) & 3) === 0) {
          g.fillStyle(p.floorAccent, 0.6);
          g.fillRect(x * T + 8, y * T + 8, 4, 4);
        }
      }
    }
    this._mapGfx = g;

    // Door sprites we can recolor when they open — track by index
    this._doorSprites = this.config.doors.map((d, i) => {
      const rect = this.add.rectangle(
        d.x * T + T / 2, d.y * T + T / 2, T - 2, T - 2, p.doorClosed
      ).setStrokeStyle(1, 0x223344).setDepth(2);
      return rect;
    });

    this.cameras.main.setBounds(0, 0, this.mapW * T, this.mapH * T);
  }

  // ═══════════════════════════════════════════════════════════
  //  ENEMY SPAWNS (mobs + boss) — uses card art when available
  // ═══════════════════════════════════════════════════════════
  _spawnEnemies() {
    this.enemies = []; // unified list: { mobId/bossId, isBoss, sprite, label, cardId, x, y, room, defeated }

    const makeEnemy = (def, isBoss) => {
      const card = (typeof ALL_CARDS !== 'undefined') ? ALL_CARDS.find(c => c.id === def.cardId) : null;
      const name = card ? card.name : '???';
      const T = this.T;
      const cx = def.x * T + T / 2;
      const cy = def.y * T + T / 2;

      // Visual: use card art if it was preloaded; otherwise colored rectangle.
      const artKey = `card_${def.cardId}`;
      let sprite;
      if (this.textures.exists(artKey)) {
        const size = isBoss ? 56 : 40;
        sprite = this.add.image(cx, cy, artKey).setDisplaySize(size, size).setDepth(8);
      } else {
        sprite = this.add.rectangle(cx, cy, isBoss ? 56 : 40, isBoss ? 56 : 40,
          isBoss ? 0xcc2244 : 0x7777aa, 0.95).setStrokeStyle(2, 0xffffff).setDepth(8);
      }

      const labelColor = isBoss ? '#ff8844' : '#ffcc88';
      const label = this.add.text(cx, cy - (isBoss ? 38 : 28),
        isBoss ? `${name.toUpperCase()} — BOSS` : name, {
          fontSize: isBoss ? '11px' : '9px',
          fontFamily: 'monospace', fontStyle: 'bold', color: labelColor,
          backgroundColor: '#00000099', padding: { x: 3, y: 1 },
        }).setOrigin(0.5).setDepth(9);

      // Subtle pulse for the boss so it reads as important
      if (isBoss) {
        this.tweens.add({ targets: sprite, scaleX: '+=0.06', scaleY: '+=0.06',
          duration: 900, yoyo: true, repeat: -1 });
      }

      return {
        id: isBoss ? def.bossId : def.mobId, isBoss,
        cardId: def.cardId, name, room: def.room,
        x: def.x, y: def.y, cx, cy,
        sprite, label, defeated: false,
      };
    };

    for (const m of this.config.mobs) this.enemies.push(makeEnemy(m, false));
    this.enemies.push(makeEnemy(this.config.boss, true));
  }

  // ═══════════════════════════════════════════════════════════
  //  PLAYER SPAWN + CAMERA
  // ═══════════════════════════════════════════════════════════
  _spawnPlayer() {
    const T = this.T;
    const spawnPX = this.entry.x * T + T / 2;
    const spawnPY = this.entry.y * T + T / 2;

    const tex = (G.spriteKey && this.textures.exists(G.spriteKey)) ? G.spriteKey : 'player';
    this.player = this.physics.add.sprite(spawnPX, spawnPY, tex, 0);
    this.player.setScale(2).setDepth(10).setCollideWorldBounds(true);

    // Pulsing marker so you always find yourself
    this._marker = this.add.circle(spawnPX, spawnPY, 24, 0x88ccff, 0.4).setDepth(9);
    this.tweens.add({ targets: this._marker, scaleX: 1.4, scaleY: 1.4, alpha: 0.1,
      duration: 1000, yoyo: false, repeat: -1 });

    const cam = this.cameras.main;
    cam.setZoom(1.6);
    cam.setScroll(spawnPX - cam.width / (2 * cam.zoom), spawnPY - cam.height / (2 * cam.zoom));
    cam.startFollow(this.player, true, 1, 1);
  }

  // ═══════════════════════════════════════════════════════════
  //  INPUT
  // ═══════════════════════════════════════════════════════════
  _setupInput() {
    this.keys = this.input.keyboard.addKeys({
      W: 'W', A: 'A', S: 'S', D: 'D',
      up: 'UP', down: 'DOWN', left: 'LEFT', right: 'RIGHT',
      E: 'E',
    });
  }

  // ═══════════════════════════════════════════════════════════
  //  HUD — dungeon name + room progress + exit hint
  // ═══════════════════════════════════════════════════════════
  _setupHUD() {
    this._titleText = this.add.text(this.scale.width / 2, 10, this.config.name.toUpperCase(), {
      fontSize: '16px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: '#bfe4ff',
      backgroundColor: '#000000cc', padding: { x: 10, y: 4 },
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(200);

    this._hintText = this.add.text(10, this.scale.height - 20,
      'WASD: Move  |  Walk into enemy: Fight  |  ESC: Leave dungeon (-' + this.config.goldLossOnFail + 'g)', {
      fontSize: '10px', fontFamily: 'monospace', color: '#aaaacc',
    }).setScrollFactor(0).setDepth(200);

    // ESC key for voluntary exit
    this.escKey = this.input.keyboard.addKey('ESC');
  }

  // ═══════════════════════════════════════════════════════════
  //  BATTLE RESUME HANDLER — fires when BattleScene returns
  // ═══════════════════════════════════════════════════════════
  _setupResumeHandler() {
    this.events.on('resume', () => {
      if (!this._pendingEnemy) return;
      const enemy = this._pendingEnemy;
      this._pendingEnemy = null;

      const playerWiped = !G.team.some(g => !g.ko && g.hp > 0);
      if (playerWiped) {
        this._onBattleLoss(enemy);
      } else {
        this._onBattleWin(enemy);
      }
    });
  }

  // ═══════════════════════════════════════════════════════════
  //  MAIN UPDATE LOOP
  // ═══════════════════════════════════════════════════════════
  update() {
    if (G.inBattle) return;       // battle in progress — pause world updates
    if (this._state.koActive) return; // KO modal up — block movement
    if (this.cameras.main._fading) return;

    this._handleMovement();
    this._checkAggro();
    this._checkStaircase();

    if (Phaser.Input.Keyboard.JustDown(this.escKey)) {
      this._confirmEscape();
    }

    // Keep marker on player
    if (this._marker && this.player) {
      this._marker.setPosition(this.player.x, this.player.y);
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  MOVEMENT — WASD/arrows, blocked by walls + closed doors
  // ═══════════════════════════════════════════════════════════
  _handleMovement() {
    const speed = 160;
    let vx = 0, vy = 0;
    const k = this.keys;
    if (k.A.isDown || k.left.isDown)  vx = -speed;
    if (k.D.isDown || k.right.isDown) vx =  speed;
    if (k.W.isDown || k.up.isDown)    vy = -speed;
    if (k.S.isDown || k.down.isDown)  vy =  speed;

    // Normalize diagonal
    if (vx && vy) { vx *= 0.707; vy *= 0.707; }

    // Predict next position and reject if it hits an impassable tile.
    const T = this.T;
    const dt = 1 / 60; // approx — physics uses delta but this is plenty for tile checks
    const nx = this.player.x + vx * dt;
    const ny = this.player.y + vy * dt;

    if (this._isWalkable(nx, this.player.y)) this.player.setVelocityX(vx);
    else this.player.setVelocityX(0);
    if (this._isWalkable(this.player.x, ny)) this.player.setVelocityY(vy);
    else this.player.setVelocityY(0);

    // Walk anim
    const moving = vx !== 0 || vy !== 0;
    if (moving) {
      const tex = this.player.texture.key;
      const prefix = (tex === 'player') ? '' : tex + '_';
      const dir = Math.abs(vx) > Math.abs(vy)
        ? (vx > 0 ? 'walk_right' : 'walk_left')
        : (vy > 0 ? 'walk_down' : 'walk_up');
      try { this.player.anims.play(prefix + dir, true); } catch(e) {}
    } else {
      this.player.anims && this.player.anims.stop();
    }
  }

  _isWalkable(px, py) {
    const tx = Math.floor(px / this.T);
    const ty = Math.floor(py / this.T);
    if (tx < 0 || ty < 0 || tx >= this.mapW || ty >= this.mapH) return false;
    const t = this.grid[ty][tx];
    if (D_IMPASSABLE.has(t)) return false;
    // Boss-gated staircase: can only step on stairs after boss dies
    if (t === D_TILE.STAIRS && !this._state.bossDefeated) return false;
    return true;
  }

  // ═══════════════════════════════════════════════════════════
  //  AGGRO — walking into a mob triggers a battle
  // ═══════════════════════════════════════════════════════════
  _checkAggro() {
    if (!this.config.aggroOnContact) return;
    for (const e of this.enemies) {
      if (e.defeated) continue;
      const dx = this.player.x - e.cx;
      const dy = this.player.y - e.cy;
      const r = e.isBoss ? 30 : 26;
      if (dx * dx + dy * dy < r * r) {
        this._launchBattle(e);
        return;
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  STAIRCASE — only appears after boss defeat; step on it = exit
  // ═══════════════════════════════════════════════════════════
  _checkStaircase() {
    if (!this._state.bossDefeated || !this.stairsSlot) return;
    const sx = this.stairsSlot.x * this.T + this.T / 2;
    const sy = this.stairsSlot.y * this.T + this.T / 2;
    const dx = this.player.x - sx;
    const dy = this.player.y - sy;
    if (dx * dx + dy * dy < 24 * 24) {
      this._exitDungeon({ reason: 'victory' });
    }
  }

  _spawnStaircase() {
    if (!this.stairsSlot) return;
    const T = this.T;
    const x = this.stairsSlot.x * T + T / 2;
    const y = this.stairsSlot.y * T + T / 2;
    this.grid[this.stairsSlot.y][this.stairsSlot.x] = D_TILE.STAIRS;

    const p = this.config.palette;
    // Rebuild map tile on top of mapGfx so the staircase visually appears
    this._mapGfx.fillStyle(p.stairs, 1);
    this._mapGfx.fillRect(this.stairsSlot.x * T, this.stairsSlot.y * T, T, T);
    // Drawn glyph: triple chevron pointing up
    this.add.text(x, y, '▲\n▲\n▲', {
      fontSize: '10px', fontFamily: 'monospace', color: '#1a2230', align: 'center', lineSpacing: -2,
    }).setOrigin(0.5).setDepth(3);
    // Glow
    const glow = this.add.circle(x, y, 30, 0x88ccff, 0.3).setDepth(2);
    this.tweens.add({ targets: glow, scaleX: 1.5, scaleY: 1.5, alpha: 0.05,
      duration: 1400, yoyo: true, repeat: -1 });
    // Hint
    this.add.text(x, y + 28, '[Step on stairs to exit]', {
      fontSize: '9px', fontFamily: 'monospace', color: '#bfe4ff',
      backgroundColor: '#000000aa', padding: { x: 3, y: 1 },
    }).setOrigin(0.5).setDepth(11);
  }

  // ═══════════════════════════════════════════════════════════
  //  BATTLE LAUNCH — build enemy team, init engine, scene-launch
  // ═══════════════════════════════════════════════════════════
  _launchBattle(enemy) {
    if (G.inBattle || typeof buildPlayerBattleTeam !== 'function') return;
    if (!G.team.some(g => !g.ko && g.hp > 0)) return;

    const card = ALL_CARDS.find(c => c.id === enemy.cardId);
    if (!card) { console.warn('[Dungeon] missing card for', enemy); return; }

    // Build enemy ghost (HP-scaled per config)
    const mult = enemy.isBoss ? this.config.bossHpMultiplier : this.config.mobHpMultiplier;
    const scaledMaxHp = Math.max(1, Math.round(card.maxHp * mult));
    const enemyGhost = {
      id: card.id, name: card.name, hp: scaledMaxHp, maxHp: scaledMaxHp,
      ko: false, ability: card.ability, abilityDesc: card.desc, rarity: card.rarity,
      usedOncePerGame: false, entryFired: false,
    };

    this._pendingEnemy = enemy;
    G.inBattle = true;
    const playerGhosts = buildPlayerBattleTeam();

    if (typeof initBattle === 'function') {
      initBattle(playerGhosts.map(g => g.id), [enemyGhost.id], { type: 'dungeon', dungeonId: this.dungeonId, bossFight: enemy.isBoss });
    }

    this.cameras.main.fadeOut(250, 0, 0, 0);
    this.time.delayedCall(250, () => {
      this.scene.launch('BattleScene', {
        enemyCard: card,
        trainerName: enemy.isBoss ? `${enemy.name.toUpperCase()} (BOSS)` : enemy.name,
        dungeon: true,
        returnScene: 'DungeonScene',
      });
      this.scene.pause();
    });
  }

  // ═══════════════════════════════════════════════════════════
  //  POST-BATTLE — win or loss
  // ═══════════════════════════════════════════════════════════
  _onBattleWin(enemy) {
    enemy.defeated = true;
    // Remove visuals
    if (enemy.sprite) enemy.sprite.destroy();
    if (enemy.label) enemy.label.destroy();

    // Heal team back to full if config says so (and it wasn't the final boss).
    // Final boss healing is irrelevant since we exit after.
    if (this.config.healBetweenFights && !enemy.isBoss) {
      for (const g of G.team) { if (!g.ko) g.hp = g.maxHp; }
    }

    // Camera back
    this.cameras.main.fadeIn(250, 0, 0, 0);

    if (enemy.isBoss) {
      this._state.bossDefeated = true;
      G.coins = (G.coins || 0) + this.config.bossRewardGold;
      this.showNotification(`Final boss defeated! +${this.config.bossRewardGold} gold. Find the staircase to exit.`);
      this._spawnStaircase();
      saveGame();
      return;
    }

    // Non-boss win: check if its room is fully cleared → open the door it gates
    this._checkRoomClear(enemy.room);
    this.showNotification(`Defeated ${enemy.name}!`);
    saveGame();
  }

  _checkRoomClear(roomId) {
    const remaining = this.enemies.filter(e => e.room === roomId && !e.defeated);
    if (remaining.length > 0) return;
    // Open every door gated by this room
    this.config.doors.forEach((d, i) => {
      if (d.unlockedBy !== roomId) return;
      if (this._state.doorsOpen.has(i)) return;
      this._state.doorsOpen.add(i);
      this.grid[d.y][d.x] = D_TILE.DOOR_OPEN;
      // Recolor door tile
      const T = this.T;
      const p = this.config.palette;
      this._mapGfx.fillStyle(p.doorOpen, 1);
      this._mapGfx.fillRect(d.x * T, d.y * T, T, T);
      if (this._doorSprites[i]) this._doorSprites[i].setVisible(false);
    });
  }

  _onBattleLoss(enemy) {
    this.cameras.main.fadeIn(250, 0, 0, 0);
    this._showKOModal();
  }

  // ═══════════════════════════════════════════════════════════
  //  KO MODAL — solo flow: lying-down avatar + "Leave Dungeon" button
  //  (Multiplayer rez wires in Commit 2.)
  // ═══════════════════════════════════════════════════════════
  _showKOModal() {
    this._state.koActive = true;

    // Lying-down sprite: rotate the player 90deg, dim the texture, add ZZZ
    if (this.player) {
      this.player.setRotation(Math.PI / 2);
      this.player.setAlpha(0.7);
      this.player.anims && this.player.anims.stop();
    }
    if (this._marker) this._marker.setVisible(false);

    // Floating Z squiggles
    this._koZs = [];
    for (let i = 0; i < 3; i++) {
      const z = this.add.text(this.player.x + (i - 1) * 6, this.player.y - 20 - i * 8, 'z', {
        fontSize: (10 - i * 2) + 'px', fontFamily: 'monospace', fontStyle: 'bold',
        color: '#bfe4ff',
      }).setOrigin(0.5).setDepth(11);
      this.tweens.add({
        targets: z, y: z.y - 14, alpha: 0,
        duration: 2200, delay: i * 400, repeat: -1,
      });
      this._koZs.push(z);
    }

    // Modal box
    const W = this.scale.width, H = this.scale.height;
    const overlay = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.55)
      .setScrollFactor(0).setDepth(220);
    const box = this.add.rectangle(W / 2, H / 2, 380, 200, 0x1a2230, 0.97)
      .setStrokeStyle(2, 0x4488cc).setScrollFactor(0).setDepth(221);
    const title = this.add.text(W / 2, H / 2 - 70, 'YOU WERE DEFEATED', {
      fontSize: '18px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: '#ff8888',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(222);
    const body = this.add.text(W / 2, H / 2 - 20,
      `Your team has been knocked out.\n\nLeaving the dungeon will cost you ${this.config.goldLossOnFail} gold.`, {
      fontSize: '12px', fontFamily: 'monospace', color: '#ccddee', align: 'center',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(222);

    const btnBg = this.add.rectangle(W / 2, H / 2 + 50, 220, 40, 0x884444, 0.95)
      .setStrokeStyle(2, 0xcc6666).setInteractive({ useHandCursor: true })
      .setScrollFactor(0).setDepth(222);
    const btnText = this.add.text(W / 2, H / 2 + 50, `Leave Dungeon  ( -${this.config.goldLossOnFail}g )`, {
      fontSize: '13px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: '#ffffff',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(223);

    btnBg.on('pointerover', () => btnBg.setFillStyle(0xaa5555));
    btnBg.on('pointerout',  () => btnBg.setFillStyle(0x884444, 0.95));
    btnBg.on('pointerdown', () => this._exitDungeon({ reason: 'fail' }));

    this._koModal = [overlay, box, title, body, btnBg, btnText];
  }

  // ═══════════════════════════════════════════════════════════
  //  ESC = voluntary exit (still costs gold — leaving counts as failure)
  // ═══════════════════════════════════════════════════════════
  _confirmEscape() {
    if (this._state.koActive) return;
    // Simple confirm using the same modal style
    const W = this.scale.width, H = this.scale.height;
    const overlay = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.55)
      .setScrollFactor(0).setDepth(220);
    const box = this.add.rectangle(W / 2, H / 2, 380, 180, 0x1a2230, 0.97)
      .setStrokeStyle(2, 0x4488cc).setScrollFactor(0).setDepth(221);
    const title = this.add.text(W / 2, H / 2 - 60, 'LEAVE DUNGEON?', {
      fontSize: '16px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: '#ffcc88',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(222);
    const body = this.add.text(W / 2, H / 2 - 18,
      `Leaving now will cost you ${this.config.goldLossOnFail} gold.`, {
      fontSize: '12px', fontFamily: 'monospace', color: '#ccddee',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(222);

    const yesBg = this.add.rectangle(W / 2 - 60, H / 2 + 40, 110, 36, 0x884444, 0.95)
      .setStrokeStyle(1, 0xcc6666).setInteractive({ useHandCursor: true }).setScrollFactor(0).setDepth(222);
    const yesT  = this.add.text(W / 2 - 60, H / 2 + 40, 'Yes (-' + this.config.goldLossOnFail + 'g)', {
      fontSize: '12px', fontFamily: 'monospace', color: '#ffffff',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(223);

    const noBg = this.add.rectangle(W / 2 + 60, H / 2 + 40, 110, 36, 0x336666, 0.95)
      .setStrokeStyle(1, 0x66aaaa).setInteractive({ useHandCursor: true }).setScrollFactor(0).setDepth(222);
    const noT  = this.add.text(W / 2 + 60, H / 2 + 40, 'Stay', {
      fontSize: '12px', fontFamily: 'monospace', color: '#ffffff',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(223);

    const elems = [overlay, box, title, body, yesBg, yesT, noBg, noT];
    const cleanup = () => elems.forEach(e => e.destroy());
    yesBg.on('pointerdown', () => { cleanup(); this._exitDungeon({ reason: 'fail' }); });
    noBg.on('pointerdown',  cleanup);
  }

  // ═══════════════════════════════════════════════════════════
  //  EXIT — fade back to overworld, apply gold loss on failure
  // ═══════════════════════════════════════════════════════════
  _exitDungeon(opts) {
    const reason = (opts && opts.reason) || 'fail';
    if (this._state._exiting) return;
    this._state._exiting = true;

    // Failure tax
    if (reason === 'fail') {
      G.coins = Math.max(0, (G.coins || 0) - this.config.goldLossOnFail);
    }
    G.inBattle = false;
    saveGame();

    // Restore overworld DOM HUD
    const hud = document.getElementById('hud-overlay');
    if (hud) hud.style.display = '';

    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.time.delayedCall(420, () => {
      // Drop player at the overworld return position (set by WorldScene before launch)
      if (typeof this.returnX === 'number' && typeof this.returnY === 'number') {
        G.x = this.returnX / 32;
        G.y = this.returnY / 32;
      }
      this.scene.stop('DungeonScene');
      this.scene.resume('WorldScene');
      // Snap world scene player position to return location, if available
      const ws = this.scene.get('WorldScene');
      if (ws && ws.player && typeof this.returnX === 'number') {
        ws.player.setPosition(this.returnX, this.returnY);
        if (ws.cameras && ws.cameras.main) ws.cameras.main.fadeIn(400, 0, 0, 0);
      }
      if (ws && typeof ws.showNotification === 'function') {
        if (reason === 'victory') ws.showNotification(`${this.config.name} cleared! +${this.config.bossRewardGold} gold.`);
        else ws.showNotification(`Left ${this.config.name}. -${this.config.goldLossOnFail} gold.`);
      }
    });
  }

  // ═══════════════════════════════════════════════════════════
  //  Light wrapper around the world's notify (HUD reuse)
  // ═══════════════════════════════════════════════════════════
  showNotification(msg) {
    const t = this.add.text(this.scale.width / 2, 48, msg, {
      fontSize: '12px', fontFamily: 'monospace', color: '#bfe4ff',
      backgroundColor: '#000000cc', padding: { x: 8, y: 4 },
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(250);
    this.tweens.add({ targets: t, alpha: 0, y: 30, duration: 2200, delay: 1200,
      onComplete: () => t.destroy() });
  }
}
